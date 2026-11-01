import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { tempDir } from "./helpers";

// tools/browser-suite/check-report.mjs and run-canary.mjs, run as the CI job
// "Website — browser tests, default and consent builds" runs them, on reports in
// Playwright's JSON shape (suites → specs → tests → results).

const websiteRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(websiteRoot, "..");
const toolDir = path.join(websiteRoot, "tools", "browser-suite");
const checker = path.join(toolDir, "check-report.mjs");
const canaryRunner = path.join(toolDir, "run-canary.mjs");
const expectedFile = path.join(toolDir, "expected.json");

const blocking = "2000-01-01";
const reportMode = "2999-12-31";
const todayUtc = () => new Date().toISOString().slice(0, 10);

const consentTitles = Array.from({ length: 25 }, (_, i) => `consent case ${i + 1}`);
const pagesTitles = [
  "the skipped home intro moves the logo and its classes persist after load",
  "the fallback logo is served and the service navigation script runs",
  "contact validates, posts once to the relative API, and renders configured messages",
  "nothing from Tag Manager loads when the container id is empty",
];
const noTagTitle = pagesTitles[3];
const homeIntroId = `pages.spec.ts › ${pagesTitles[0]}`;

type Outcome = "passed" | "skipped" | "failed" | "flaky";
type Row = { file: string; title: string; outcome: Outcome; describe?: string };

/** The good run of a build: default runs pages.spec.ts only; consent runs all but the no-container test. */
function goodRun(build: "default" | "consent"): Row[] {
  const consent = consentTitles.map((title): Row => ({ file: "consent.spec.ts", title, outcome: build === "consent" ? "passed" : "skipped" }));
  const pages = pagesTitles.map((title): Row => ({
    file: "pages.spec.ts",
    title,
    outcome: title === noTagTitle && build === "consent" ? "skipped" : "passed",
  }));
  return [...consent, ...pages];
}

function change(rows: Row[], match: (row: Row) => boolean, update: Partial<Row>): Row[] {
  return rows.map((row) => (match(row) ? { ...row, ...update } : row));
}

const statusOf: Record<Outcome, string> = { passed: "expected", skipped: "skipped", failed: "unexpected", flaky: "flaky" };
const resultsOf: Record<Outcome, unknown[]> = {
  passed: [{ status: "passed" }],
  skipped: [{ status: "skipped" }],
  failed: [{ status: "failed", error: { message: "Error: gsap is not defined" } }],
  flaky: [{ status: "failed", error: { message: "Error: timed out" } }, { status: "passed" }],
};

function spec(row: Row) {
  return {
    title: row.title,
    ok: row.outcome !== "failed",
    tags: [],
    tests: [{ expectedStatus: row.outcome === "skipped" ? "skipped" : "passed", projectName: "", annotations: [], status: statusOf[row.outcome], results: resultsOf[row.outcome] }],
    file: row.file,
    line: 1,
    column: 1,
  };
}

/** A Playwright JSON report: one top-level suite per file, a nested suite per describe. */
function report(rows: Row[], extra: Record<string, unknown> = {}): string {
  const files = [...new Set(rows.map((row) => row.file))];
  const suites = files.map((file) => {
    const inFile = rows.filter((row) => row.file === file);
    const describes = [...new Set(inFile.filter((row) => row.describe).map((row) => row.describe as string))];
    return {
      title: file,
      file,
      line: 0,
      column: 0,
      specs: inFile.filter((row) => !row.describe).map(spec),
      suites: describes.map((title) => ({ title, file, line: 1, column: 1, specs: inFile.filter((row) => row.describe === title).map(spec) })),
    };
  });
  return JSON.stringify({ config: {}, suites, errors: [], stats: {}, ...extra });
}

type RunOptions = { args?: string[]; date?: string | null; expected?: string; summary?: boolean };

/** Writes the reports to a temp dir (null: no file) and runs the checker as CI does. */
function run(defaultContent: string | null, consentContent: string | null, options: RunOptions = {}) {
  const dir = tempDir("browser-suite-");
  const defaultFile = path.join(dir, "default.json");
  const consentFile = path.join(dir, "consent.json");
  if (defaultContent !== null) fs.writeFileSync(defaultFile, defaultContent);
  if (consentContent !== null) fs.writeFileSync(consentFile, consentContent);
  let expected = expectedFile;
  if (options.expected !== undefined) {
    expected = path.join(dir, "expected.json");
    fs.writeFileSync(expected, options.expected);
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.GITHUB_STEP_SUMMARY;
  delete env.BROWSER_TESTS_BLOCKING_FROM;
  const date = options.date === undefined ? blocking : options.date;
  if (date !== null) env.BROWSER_TESTS_BLOCKING_FROM = date;
  const summaryFile = path.join(dir, "summary.md");
  if (options.summary) env.GITHUB_STEP_SUMMARY = summaryFile;
  const args = options.args ?? [expected, `default=${defaultFile}`, `consent=${consentFile}`];
  const result = spawnSync(process.execPath, [checker, ...args], { encoding: "utf8", env });
  const summary = options.summary && fs.existsSync(summaryFile) ? fs.readFileSync(summaryFile, "utf8") : "";
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: result.status, out: result.stdout + result.stderr, summary };
}

const good = { default: report(goodRun("default")), consent: report(goodRun("consent")) };
const oneConsentFailure = report(change(goodRun("consent"), (row) => row.title === "consent case 3", { outcome: "failed" }));

describe("check-report.mjs: test results and the report week", () => {
  it("T1 good runs of both builds pass and print the 29-test line", () => {
    const result = run(good.default, good.consent, { summary: true });
    expect(result.code, result.out).toBe(0);
    expect(result.out).toContain(
      "browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures",
    );
    expect(result.summary).toMatch(/\| default \| 4 \| 25 \| 0 \|/);
    expect(result.summary).toMatch(/\| consent \| 28 \| 1 \| 0 \|/);
  });

  it("T2 a failed test before the blocking date is reported and warned, exit 0", () => {
    const result = run(good.default, oneConsentFailure, { date: reportMode });
    expect(result.code, result.out).toBe(0);
    expect(result.out).toContain("failed: consent: consent.spec.ts › consent case 3");
    expect(result.out).toContain(`::warning title=Browser tests (report mode until ${reportMode})::1 failure(s)`);
    expect(result.out).toMatch(/; 1 failure$/m);
  });

  it("T3 a failed test after the blocking date fails, exit 1", () => {
    const result = run(good.default, oneConsentFailure, { date: blocking });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("failed: consent: consent.spec.ts › consent case 3");
    expect(result.out).toContain("::error title=Browser tests");
  });

  it("T4 the blocking date itself blocks (today, UTC)", () => {
    const result = run(good.default, oneConsentFailure, { date: todayUtc() });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("failed: consent: consent.spec.ts › consent case 3");
    expect(result.out).toContain(`::error title=Browser tests (blocking since ${todayUtc()})::1 failure(s)`);
  });

  it("T5 a flaky test (failed, then passed) is a failure", () => {
    const flaky = report(change(goodRun("consent"), (row) => row.title === "consent case 4", { outcome: "flaky" }));
    const result = run(good.default, flaky, { date: blocking });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("failed: consent: consent.spec.ts › consent case 4");
  });

  it("T16 tests inside a describe are walked and named with the describe title", () => {
    const nested = (build: "default" | "consent", outcome: Outcome) =>
      report(change(goodRun(build), (row) => row.title === "consent case 1", build === "consent" ? { describe: "group", outcome } : { describe: "group" }));
    const result = run(nested("default", "passed"), nested("consent", "failed"), { date: reportMode });
    expect(result.code, result.out).toBe(0);
    expect(result.out).toContain("failed: consent: consent.spec.ts › group › consent case 1");
  });
});

describe("check-report.mjs: what must run, in report mode too", () => {
  it("T6 a consent build that lost its banner (all 25 consent tests skipped) fails", () => {
    const lost = report(change(goodRun("default"), () => true, {}));
    const result = run(good.default, lost, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("unexpected skip: consent: consent.spec.ts › consent case 1");
  });

  it("T7 a default build that skipped the no-container test (a banner in the default build) fails", () => {
    const banner = report(change(goodRun("default"), (row) => row.title === noTagTitle, { outcome: "skipped" }));
    const result = run(banner, good.consent, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain(`unexpected skip: default: pages.spec.ts › ${noTagTitle}`);
  });

  it("T8 a consent build in which the no-container test ran instead of skipping fails", () => {
    const ran = report(change(goodRun("consent"), (row) => row.title === noTagTitle, { outcome: "passed" }));
    const result = run(good.default, ran, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain(`expected to skip but ran: consent: pages.spec.ts › ${noTagTitle}`);
  });

  it("T9 a pages.spec.ts test skipped in both builds (a test.skip) fails", () => {
    const skip = (build: "default" | "consent") => report(change(goodRun(build), (row) => row.title === pagesTitles[1], { outcome: "skipped" }));
    const result = run(skip("default"), skip("consent"), { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain(`unexpected skip: default: pages.spec.ts › ${pagesTitles[1]}`);
    expect(result.out).toContain(`unexpected skip: consent: pages.spec.ts › ${pagesTitles[1]}`);
  });

  it("T10 a .only (each report lists one test) fails", () => {
    const only = report([{ file: "pages.spec.ts", title: pagesTitles[1], outcome: "passed" }]);
    const result = run(only, only, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toMatch(/default: 1 tests listed, fewer than 29/);
    expect(result.out).toMatch(/consent: 1 tests listed, fewer than 29/);
  });

  it("T11 reports that list different tests fail", () => {
    const renamed = report(change(goodRun("consent"), (row) => row.title === "consent case 25", { title: "consent case 26" }));
    const result = run(good.default, renamed, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("only in default: consent.spec.ts › consent case 25");
    expect(result.out).toContain("only in consent: consent.spec.ts › consent case 26");
  });

  it("T12 a report with top-level errors (the web server did not start) fails", () => {
    const broken = report([], { errors: [{ message: "Error: Timed out waiting 60000ms from config.webServer." }] });
    const result = run(good.default, broken, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("consent: Playwright reported 1 error(s) outside any test: Error: Timed out waiting 60000ms from config.webServer.");
  });

  it.each([
    { name: "missing", content: null, message: /consent report .* does not exist; Playwright wrote no report/ },
    { name: "empty", content: " \n", message: /consent report .* is empty/ },
    { name: "not JSON", content: "{ not json", message: /consent report .* is not valid JSON/ },
    { name: "no suites", content: JSON.stringify({ errors: [] }), message: /consent report .* has no suites array/ },
  ])("T13 a report that is $name fails", ({ content, message }) => {
    const result = run(good.default, content, { date: reportMode });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toMatch(message);
  });

  it("T13 a missing or unreadable expected.json fails", () => {
    expect(run(good.default, good.consent, { args: ["/nonexistent/expected.json", "default=/x", "consent=/y"] }).code).toBe(1);
    const bad = run(good.default, good.consent, { expected: JSON.stringify({ minimumTests: 0, builds: {} }) });
    expect(bad.code, bad.out).toBe(1);
    expect(bad.out).toMatch(/expected\.json/);
  });

  it.each([
    { name: "unset", date: null, message: /BROWSER_TESTS_BLOCKING_FROM is not set/ },
    { name: "not a real date", date: "2026-13-45", message: /BROWSER_TESTS_BLOCKING_FROM is not a real date: 2026-13-45/ },
    { name: "another format", date: "11/23/2026", message: /BROWSER_TESTS_BLOCKING_FROM is not a date in YYYY-MM-DD form: 11\/23\/2026/ },
  ])("T14 a blocking date that is $name fails, even with good reports", ({ date, message }) => {
    const result = run(good.default, good.consent, { date });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toMatch(message);
  });

  it("T15 wrong arguments exit 2", () => {
    const e = expectedFile;
    expect(run(good.default, good.consent, { args: [] }).code).toBe(2);
    expect(run(good.default, good.consent, { args: [e, "default=/x"] }).code).toBe(2);
    expect(run(good.default, good.consent, { args: [e, "default=/x", "default=/y"] }).code).toBe(2);
    expect(run(good.default, good.consent, { args: [e, "default=/x", "other=/y"] }).code).toBe(2);
    expect(run(good.default, good.consent, { args: [e, "default=/x", "consent="] }).code).toBe(2);
    expect(run(good.default, good.consent, { args: [e, "default=/x", "consent=/y", "extra"] }).code).toBe(2);
  });

  it("reports every problem in one pass: the canary-1 inputs against minimumTests 30 still name the failure", () => {
    const expected = JSON.parse(fs.readFileSync(expectedFile, "utf8")) as { minimumTests: number };
    const canary = (name: string) => fs.readFileSync(path.join(toolDir, "canary", name), "utf8");
    const result = run(canary("default.json"), canary("consent-failed.json"), {
      date: blocking,
      expected: JSON.stringify({ ...expected, minimumTests: 30 }),
    });
    expect(result.code, result.out).toBe(1);
    expect(result.out).toMatch(/fewer than 30/);
    expect(result.out).toContain(`failed: consent: ${homeIntroId}`);
  });
});

describe("the committed expectation and canary", () => {
  it("T17 expected.json matches the spec files", () => {
    const expected = JSON.parse(fs.readFileSync(expectedFile, "utf8")) as {
      minimumTests: number;
      builds: Record<string, { skippedFiles: string[]; skippedTests: { file: string; title: string }[] }>;
    };
    expect(expected.minimumTests).toBeGreaterThanOrEqual(29);
    expect(Object.keys(expected.builds).sort()).toEqual(["consent", "default"]);
    for (const build of Object.values(expected.builds)) {
      for (const file of build.skippedFiles) expect(fs.existsSync(path.join(websiteRoot, "browser-tests", file)), file).toBe(true);
      for (const test of build.skippedTests) {
        const source = fs.readFileSync(path.join(websiteRoot, "browser-tests", test.file), "utf8");
        expect(source, test.title).toContain(`test('${test.title}'`);
      }
    }
    expect(expected.builds.default.skippedFiles).toEqual(["consent.spec.ts"]);
    expect(expected.builds.consent.skippedTests).toEqual([{ file: "pages.spec.ts", title: noTagTitle }]);
    const consentSpec = fs.readFileSync(path.join(websiteRoot, "browser-tests", "consent.spec.ts"), "utf8");
    expect(consentSpec).toContain("test.skip(!builtWithContainer");
    const pagesSpec = fs.readFileSync(path.join(websiteRoot, "browser-tests", "pages.spec.ts"), "utf8");
    expect(pagesSpec).toContain("test.skip(builtWithContainer");
  });

  it("T18 run-canary.mjs passes on the committed canaries", () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.GITHUB_STEP_SUMMARY;
    const result = spawnSync(process.execPath, [canaryRunner], { encoding: "utf8", env, cwd: repoRoot });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("canary 1 rejected");
    expect(result.stdout).toContain("canary 2 rejected");
  });

  it("T19 run-canary.mjs fails when the checker it finds beside it accepts everything", () => {
    const dir = tempDir("browser-suite-canary-");
    const copy = path.join(dir, "browser-suite");
    fs.cpSync(toolDir, copy, { recursive: true });
    fs.writeFileSync(path.join(copy, "check-report.mjs"), "console.log('browser suite: accepted');\nprocess.exit(0);\n");
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.GITHUB_STEP_SUMMARY;
    const result = spawnSync(process.execPath, [path.join(copy, "run-canary.mjs")], { encoding: "utf8", env, cwd: websiteRoot });
    fs.rmSync(dir, { recursive: true, force: true });
    expect(result.status, result.stdout + result.stderr).toBe(1);
  });
});

describe("the CI job", () => {
  // The workflow-yaml.mjs reader rejects a construct in the studio job of ci.yml, so
  // the file is cut by text into its header and the website-browser job, and each
  // part is parsed. Only the cut is by text; every assertion reads parsed values.
  type Step = { name?: string; uses?: string; run?: string; if?: string; env?: Record<string, string>; with?: Record<string, unknown> };
  type Job = { name: string; "runs-on": string; env: Record<string, string>; steps: Step[]; defaults?: { run?: { "working-directory"?: string } } } & Record<string, unknown>;

  async function loadJob() {
    const moduleUrl = pathToFileURL(path.join(repoRoot, ".github", "security", "workflow-yaml.mjs")).href;
    const { parseWorkflowYaml } = await import(moduleUrl);
    const text = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const jobsAt = lines.indexOf("jobs:");
    const jobAt = lines.indexOf("  website-browser:");
    expect(jobsAt).toBeGreaterThan(0);
    expect(jobAt, "job website-browser in ci.yml").toBeGreaterThan(jobsAt);
    const laterJob = lines.slice(jobAt + 1).findIndex((line) => /^ {2}\S/.test(line) || /^\S/.test(line));
    expect(laterJob, "website-browser is the last job in ci.yml").toBe(-1);
    const header = parseWorkflowYaml(lines.slice(0, jobsAt).join("\n"));
    const jobs = parseWorkflowYaml(["jobs:", ...lines.slice(jobAt)].join("\n")).jobs as Record<string, Job>;
    expect(Object.keys(jobs)).toEqual(["website-browser"]);
    return { header, job: jobs["website-browser"] };
  }

  it("T20 website-browser runs both builds, the canary and the check on every pull request, pinned and without continue-on-error", async () => {
    const { header, job } = await loadJob();
    expect(job.name).toBe("Website — browser tests, default and consent builds");
    expect(job["runs-on"]).toBe("ubuntu-24.04");
    expect(job.needs).toBeUndefined();
    expect(job.if).toBeUndefined();
    expect(job["continue-on-error"]).toBeUndefined();
    expect(job.defaults?.run?.["working-directory"]).toBe("website");

    const from = job.env.BROWSER_TESTS_BLOCKING_FROM;
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from >= "2026-11-10" && from <= "2026-11-23", from).toBe(true);
    expect(job.env.CONTENT_SOURCE).toBe("snapshot");

    for (const step of job.steps) {
      expect(step, JSON.stringify(step)).not.toHaveProperty("continue-on-error");
      if (step.uses !== undefined) expect(step.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      if (step.if !== undefined) expect(step.uses, "only the upload has an if").toMatch(/^actions\/upload-artifact@/);
    }
    const runs = job.steps.map((step) => step.run ?? "");
    expect(runs).toContain("node tools/browser-suite/run-canary.mjs");
    expect(job.steps.some((step) => step.env?.SNAPSHOT_SETTINGS_FIXTURE === "consent")).toBe(true);
    const check = runs.find((run) => run.includes("node tools/browser-suite/check-report.mjs")) ?? "";
    expect(check).toContain("tools/browser-suite/expected.json");
    expect(check).toMatch(/"default=[^"]+\/default\.json"/);
    expect(check).toMatch(/"consent=[^"]+\/consent\.json"/);
    const canaryIndex = runs.indexOf("node tools/browser-suite/run-canary.mjs");
    const checkIndex = runs.indexOf(check);
    expect(canaryIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeGreaterThan(canaryIndex);
    for (const run of runs) expect(run).not.toMatch(/node\s+(?:--input-type=\S+\s+)?-e\b|--input-type=module/);

    const on = header.on as { pull_request: Record<string, unknown> };
    expect(on.pull_request).toBeTruthy();
    expect(on.pull_request.paths).toBeUndefined();
    expect(on.pull_request["paths-ignore"]).toBeUndefined();
  });
});
