/**
 * Checks the two Playwright JSON reports of the website browser suite, as the CI
 * job "Website — browser tests, default and consent builds" runs it.
 *
 *   node tools/browser-suite/check-report.mjs <expected.json> default=<report.json> consent=<report.json>
 *
 * Playwright exits 0 when tests are skipped, and the two spec files choose the
 * build they run in from out/index.html, so the exit code alone cannot show that
 * all the tests ran. This check reads both reports and the committed expectation:
 *
 * Fails whatever the date (a gate that cannot see fails):
 * - BROWSER_TESTS_BLOCKING_FROM unset, not YYYY-MM-DD, not a real date, or later
 *   than 2026-11-23 (Wave 1's last blocking day: a report week may not be moved
 *   past it from a step env or $GITHUB_ENV; an owner exception moves this cap in
 *   the same change);
 * - expected.json or a report missing, empty, not JSON, without a suites array,
 *   or with top-level errors (for example the web server did not start);
 * - the reports list different tests, or fewer than minimumTests;
 * - a test skipped that the expectation does not list for that build, or a test
 *   the expectation lists as skipped that ran or is not in the report.
 *
 * Test failures (status unexpected or flaky, or any result other than passed or
 * skipped) are printed as "failed: <build>: <test>". Before
 * BROWSER_TESTS_BLOCKING_FROM (UTC) they are a warning and the check exits 0;
 * from that date they fail it.
 *
 * Every problem and every failure is printed before the exit code is decided.
 * With GITHUB_STEP_SUMMARY set, a table is appended to the job summary.
 *
 * Exit 0 when the check passes (or only test failures, in report mode), 1 when
 * it fails, 2 for wrong arguments.
 */
import fs from "node:fs";

const labels = ["default", "consent"];
const latestBlockingDate = "2026-11-23";
const usage = "usage: node tools/browser-suite/check-report.mjs <expected.json> default=<report.json> consent=<report.json>";

function parseArguments(args) {
  if (args.length !== 3) return null;
  const [expectedPath, ...pairs] = args;
  if (expectedPath === "" || expectedPath.includes("=")) return null;
  const reports = {};
  for (const pair of pairs) {
    const match = /^([a-z]+)=(.+)$/.exec(pair);
    if (!match || !labels.includes(match[1]) || match[1] in reports) return null;
    reports[match[1]] = match[2];
  }
  if (!labels.every((label) => label in reports)) return null;
  return { expectedPath, reports };
}

/** The UTC date from which failures block, or a problem. */
function blockingDate(value) {
  if (value === undefined || value === "") return { problem: "BROWSER_TESTS_BLOCKING_FROM is not set" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { problem: `BROWSER_TESTS_BLOCKING_FROM is not a date in YYYY-MM-DD form: ${value}` };
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { problem: `BROWSER_TESTS_BLOCKING_FROM is not a real date: ${value}` };
  }
  if (value > latestBlockingDate) {
    return {
      problem: `BROWSER_TESTS_BLOCKING_FROM is ${value}, after ${latestBlockingDate}, the latest blocking date allowed`,
      annotation: `::error title=Browser tests blocking date::BROWSER_TESTS_BLOCKING_FROM=${value} is after the latest allowed date ${latestBlockingDate}`,
    };
  }
  return { date: value };
}

/** Reads a JSON file, or returns the problem that stops it being read. */
function readJson(file, what, missing) {
  if (!fs.existsSync(file)) return { problem: `${what} ${file} does not exist; ${missing}` };
  const text = fs.readFileSync(file, "utf8");
  if (text.trim() === "") return { problem: `${what} ${file} is empty` };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { problem: `${what} ${file} is not valid JSON` };
  }
}

function expectationProblems(expected) {
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) return ["expected.json is not a JSON object"];
  const problems = [];
  if (!Number.isInteger(expected.minimumTests) || expected.minimumTests < 1) problems.push("expected.json: minimumTests is not a positive whole number");
  const builds = expected.builds;
  for (const label of labels) {
    const build = builds && typeof builds === "object" ? builds[label] : undefined;
    const filesOk = build && Array.isArray(build.skippedFiles) && build.skippedFiles.every((file) => typeof file === "string" && file !== "");
    const testsOk =
      build &&
      Array.isArray(build.skippedTests) &&
      build.skippedTests.every((test) => test && typeof test.file === "string" && typeof test.title === "string" && test.title !== "");
    if (!filesOk || !testsOk) problems.push(`expected.json: builds.${label} needs skippedFiles (file names) and skippedTests ({ file, title })`);
  }
  return problems;
}

/** Every test in a report: id "<file> › <describe…> › <title>", with its file and spec title. */
function collectTests(suites, file, titles, into) {
  for (const suite of suites) {
    if (suite === null || typeof suite !== "object") continue;
    const suiteFile = file ?? (typeof suite.file === "string" ? suite.file : String(suite.title));
    const path = file === null ? [suiteFile] : [...titles, String(suite.title)];
    for (const spec of Array.isArray(suite.specs) ? suite.specs : []) {
      const tests = Array.isArray(spec?.tests) ? spec.tests : [];
      if (tests.length === 0) into.push({ id: [...path, String(spec?.title)].join(" › "), file: suiteFile, title: String(spec?.title), test: null });
      for (const test of tests) into.push({ id: [...path, String(spec.title)].join(" › "), file: suiteFile, title: String(spec.title), test });
    }
    if (Array.isArray(suite.suites)) collectTests(suite.suites, suiteFile, path, into);
  }
  return into;
}

function firstLine(message) {
  // Playwright colours its messages; the job log shows the plain text.
  const plain = String(message ?? "").replace(/\u001b\[[0-9;]*m/g, "");
  return plain.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

function failureReason(test) {
  if (test === null) return "no test entry";
  const results = Array.isArray(test.results) ? test.results : [];
  if (results.length === 0) return `status ${String(test.status)}, no results`;
  const bad = results.find((result) => result?.status !== "passed" && result?.status !== "skipped");
  const error = bad?.error?.message ?? bad?.errors?.[0]?.message;
  const detail = error ? `: ${firstLine(error)}` : "";
  return `status ${String(test.status)}, results ${results.map((result) => String(result?.status)).join(",")}${detail}`;
}

/** Sorts one build's tests into passed, skipped as expected, failed, and problems. */
function judgeBuild(label, tests, expectation) {
  const counts = { passed: 0, skipped: 0, failed: 0 };
  const failures = [];
  const problems = [];
  const skippedFiles = new Set(expectation?.skippedFiles ?? []);
  const skippedTests = expectation?.skippedTests ?? [];
  const isExpectedSkip = (entry) =>
    skippedFiles.has(entry.file) || skippedTests.some((skip) => skip.file === entry.file && skip.title === entry.title);

  for (const entry of tests) {
    const status = entry.test?.status;
    const skip = isExpectedSkip(entry);
    if (status === "skipped") {
      if (skip) counts.skipped += 1;
      else problems.push(`unexpected skip: ${label}: ${entry.id}`);
      continue;
    }
    if (skip) problems.push(`expected to skip but ran: ${label}: ${entry.id} (status ${String(status)})`);
    const results = Array.isArray(entry.test?.results) ? entry.test.results : [];
    const passed = status === "expected" && results.length > 0 && results.every((result) => result?.status === "passed" || result?.status === "skipped");
    if (passed) {
      if (!skip) counts.passed += 1;
    } else {
      counts.failed += 1;
      failures.push(`failed: ${label}: ${entry.id} (${failureReason(entry.test)})`);
    }
  }

  if (expectation) {
    for (const file of skippedFiles) {
      if (!tests.some((entry) => entry.file === file)) problems.push(`expected to skip but not in the report: ${label}: ${file}`);
    }
    for (const skip of skippedTests) {
      if (!tests.some((entry) => entry.file === skip.file && entry.title === skip.title)) {
        problems.push(`expected to skip but not in the report: ${label}: ${skip.file} › ${skip.title}`);
      }
    }
  }
  return { counts, failures, problems };
}

function writeSummary(rows, testCount, failures, problems, verdict) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const lines = [
    "## Website browser tests",
    "",
    verdict,
    "",
    `Distinct tests: ${testCount}`,
    "",
    "| Build | Passed | Skipped as expected | Failed |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.label} | ${row.counts.passed} | ${row.counts.skipped} | ${row.counts.failed} |`),
    "",
  ];
  if (problems.length > 0) lines.push("### Problems", "", ...problems.map((problem) => `- ${problem}`), "");
  if (failures.length > 0) lines.push("### Failures", "", ...failures.map((failure) => `- ${failure}`), "");
  fs.appendFileSync(file, `${lines.join("\n")}\n`);
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args === null) {
    console.error(usage);
    return 2;
  }

  const problems = [];
  const failures = [];

  const blocking = blockingDate(process.env.BROWSER_TESTS_BLOCKING_FROM);
  if (blocking.problem) problems.push(blocking.problem);

  let expected = null;
  const expectedRead = readJson(args.expectedPath, "expected.json", "the expectation is committed beside this script");
  if (expectedRead.problem) {
    problems.push(expectedRead.problem);
  } else {
    const shapeProblems = expectationProblems(expectedRead.value);
    problems.push(...shapeProblems);
    if (shapeProblems.length === 0) expected = expectedRead.value;
  }

  const rows = [];
  const idSets = {};
  for (const label of labels) {
    const file = args.reports[label];
    const read = readJson(file, `${label} report`, "Playwright wrote no report");
    if (read.problem) {
      problems.push(read.problem);
      continue;
    }
    const report = read.value;
    if (report === null || typeof report !== "object" || Array.isArray(report) || !Array.isArray(report.suites)) {
      problems.push(`${label} report ${file} has no suites array`);
      continue;
    }
    if (report.errors !== undefined && !Array.isArray(report.errors)) problems.push(`${label}: the report's errors is not a list`);
    if (Array.isArray(report.errors) && report.errors.length > 0) {
      problems.push(`${label}: Playwright reported ${report.errors.length} error(s) outside any test: ${firstLine(report.errors[0]?.message)}`);
    }
    const tests = collectTests(report.suites, null, [], []);
    const judged = judgeBuild(label, tests, expected?.builds[label] ?? null);
    problems.push(...judged.problems);
    failures.push(...judged.failures);
    idSets[label] = new Set(tests.map((entry) => entry.id));
    rows.push({ label, counts: judged.counts });
    if (expected && idSets[label].size < expected.minimumTests) {
      problems.push(`${label}: ${idSets[label].size} tests listed, fewer than ${expected.minimumTests}`);
    }
  }

  let testCount = 0;
  if (idSets.default && idSets.consent) {
    const onlyDefault = [...idSets.default].filter((id) => !idSets.consent.has(id));
    const onlyConsent = [...idSets.consent].filter((id) => !idSets.default.has(id));
    for (const id of onlyDefault) problems.push(`the two reports list different tests: only in default: ${id}`);
    for (const id of onlyConsent) problems.push(`the two reports list different tests: only in consent: ${id}`);
    testCount = new Set([...idSets.default, ...idSets.consent]).size;
  }

  for (const failure of failures) console.log(failure);
  for (const problem of problems) console.log(`problem: ${problem}`);

  const builds = rows
    .map((row) => `${row.label} ${row.counts.passed} passed, ${row.counts.skipped} skipped as expected${row.counts.failed > 0 ? `, ${row.counts.failed} failed` : ""}`)
    .join("; ");
  const failureWord = failures.length === 1 ? "failure" : "failures";
  console.log(`browser suite: ${testCount} tests; ${builds}; ${failures.length} ${failureWord}`);

  let verdict;
  let code;
  if (blocking.annotation) console.log(blocking.annotation);
  if (problems.length > 0) {
    verdict = `The check could not confirm the suite ran as expected: ${problems.length} problem(s). This fails before and after the blocking date.`;
    console.log(`::error title=Browser tests::${problems.length} problem(s); the suite did not run as expected`);
    code = 1;
  } else if (failures.length > 0 && blocking.date <= new Date().toISOString().slice(0, 10)) {
    verdict = `${failures.length} failure(s). Blocking since ${blocking.date}.`;
    console.log(`::error title=Browser tests (blocking since ${blocking.date})::${failures.length} failure(s)`);
    code = 1;
  } else if (failures.length > 0) {
    verdict = `${failures.length} failure(s). Report mode until ${blocking.date}; from that date they fail the job.`;
    console.log(`::warning title=Browser tests (report mode until ${blocking.date})::${failures.length} failure(s)`);
    code = 0;
  } else {
    verdict = "Every test ran in the build it targets and passed.";
    code = 0;
  }
  writeSummary(rows, testCount, failures, problems, verdict);
  return code;
}

process.exitCode = main();
