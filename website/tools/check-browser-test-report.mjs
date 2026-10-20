/**
 * Checks the Vitest JSON report of test/screenshot-parity-browser.test.ts, as the
 * screenshot-parity CI job runs it with Chromium installed.
 *
 *   node tools/check-browser-test-report.mjs <report.json> <minimum passed>
 *
 * Vitest exits 0 when every test is skipped, which is what happens without a
 * browser, so its exit code alone cannot show that the Chromium regressions ran.
 * This passes only when:
 * - the report exists, parses, and has at least one test file;
 * - at least <minimum passed> tests passed;
 * - every test that did not pass is the one placeholder, matched by its exact
 *   title, at most once, and only as skipped or pending. The placeholder is the
 *   `describe.runIf(!hasChromium)` test that Vitest lists as skipped even when
 *   Chromium is installed.
 * A failed, skipped, todo, or `.only`-skipped real test fails the check.
 *
 * Exit 0 when the check passes, 1 when it fails, 2 for wrong arguments.
 */
import fs from "node:fs";

const placeholderTitle = "needs Playwright's Chromium, which this environment does not have (the website CI job installs none)";
const placeholderStatuses = new Set(["skipped", "pending"]);

/** The problems in a parsed report; an empty list means it passes. */
function reportProblems(report, minimumPassed) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) return ["the report is not a JSON object"];
  if (!Array.isArray(report.testResults)) return ["the report has no testResults array"];
  if (report.testResults.length === 0) return ["the report contains no test files"];

  const problems = [];
  const rows = [];
  for (const [index, file] of report.testResults.entries()) {
    if (file === null || typeof file !== "object" || !Array.isArray(file.assertionResults)) {
      problems.push(`test file ${index} has no assertionResults array`);
      continue;
    }
    rows.push(...file.assertionResults);
  }

  let passed = 0;
  let placeholders = 0;
  for (const row of rows) {
    const status = row && typeof row === "object" ? row.status : undefined;
    const title = row && typeof row === "object" && typeof row.title === "string" ? row.title : "(no title)";
    if (status === "passed") {
      passed += 1;
    } else if (title === placeholderTitle && placeholderStatuses.has(status) && placeholders === 0) {
      placeholders += 1;
    } else {
      problems.push(`${String(status)}: ${title}`);
    }
  }

  if (report.success === false) problems.push("Vitest reported success: false");
  if (passed < minimumPassed) problems.push(`only ${passed} passed; at least ${minimumPassed} must pass`);
  console.log(`chromium regressions: passed ${passed}, placeholder ${placeholders}, problems ${problems.length}`);
  return problems;
}

function fail(message, code = 1) {
  console.error(`browser test report: ${message}`);
  process.exit(code);
}

function main(args) {
  if (args.length !== 2) fail("usage: node tools/check-browser-test-report.mjs <report.json> <minimum passed>", 2);
  const [reportPath, minimumText] = args;
  if (!/^[1-9][0-9]*$/.test(minimumText)) fail(`the minimum passed count must be a positive integer, not "${minimumText}"`, 2);
  if (!fs.existsSync(reportPath)) fail(`${reportPath} does not exist; Vitest wrote no report`);
  const text = fs.readFileSync(reportPath, "utf8");
  if (text.trim() === "") fail(`${reportPath} is empty`);
  let report;
  try {
    report = JSON.parse(text);
  } catch (error) {
    fail(`${reportPath} is not valid JSON: ${error.message}`);
  }
  const problems = reportProblems(report, Number(minimumText));
  if (problems.length > 0) fail(problems.join("\n"));
}

main(process.argv.slice(2));
