import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tempDir } from "./helpers";

// tools/check-browser-test-report.mjs, run as CI runs it, on reports in Vitest's
// JSON shape. The screenshot-parity job passes 30: every case in
// test/screenshot-parity-browser.test.ts must pass.

const websiteRoot = path.resolve(__dirname, "..");
const script = path.join(websiteRoot, "tools", "check-browser-test-report.mjs");
const placeholder = "needs Playwright's Chromium, which this environment does not have (the website CI job installs none)";

type Row = { title: string; status: string };
const real = (count: number, status = "passed"): Row[] => Array.from({ length: count }, (_, i) => ({ title: `case-${i + 1} gives error`, status }));
const placeholderRow: Row = { title: placeholder, status: "skipped" };
const report = (rows: Row[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    success: true,
    ...extra,
    testResults: [{ name: "test/screenshot-parity-browser.test.ts", assertionResults: rows.map((row) => ({ ancestorTitles: [], fullName: row.title, ...row })) }],
  });

function run(content: string | null, minimum = "30", args?: string[]) {
  const dir = tempDir("browser-report-");
  const file = path.join(dir, "screenshot-browser.json");
  if (content !== null) fs.writeFileSync(file, content);
  const result = spawnSync(process.execPath, [script, ...(args ?? [file, minimum])], { encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: result.status, out: result.stdout + result.stderr };
}

const cases: { name: string; content: string | null; minimum?: string; code: number; message: RegExp }[] = [
  { name: "good run: 30 passed and the placeholder", content: report([...real(30), placeholderRow]), code: 0, message: /passed 30, placeholder 1, problems 0/ },
  { name: "placeholder only, no browser: every case skipped", content: report([...real(30, "skipped"), placeholderRow]), code: 1, message: /skipped: case-1 gives error[\s\S]*only 0 passed; at least 30 must pass/ },
  { name: "zero test files", content: JSON.stringify({ success: true, testResults: [] }), code: 1, message: /the report contains no test files/ },
  { name: "no testResults array", content: JSON.stringify({ success: true }), code: 1, message: /the report has no testResults array/ },
  { name: "unparseable report", content: "{ not json", code: 1, message: /is not valid JSON/ },
  { name: "empty report", content: "  \n", code: 1, message: /is empty/ },
  { name: "missing report", content: null, code: 1, message: /does not exist; Vitest wrote no report/ },
  { name: "23 passed exactly, 7 cases gone, against the CI floor of 30", content: report([...real(23), placeholderRow]), code: 1, message: /only 23 passed; at least 30 must pass/ },
  { name: "23 passed exactly, against a floor of 23", content: report([...real(23), placeholderRow]), minimum: "23", code: 0, message: /passed 23, placeholder 1, problems 0/ },
  { name: "22 passed against a floor of 23", content: report([...real(22), placeholderRow]), minimum: "23", code: 1, message: /only 22 passed; at least 23 must pass/ },
  { name: "a real test skipped under words from the placeholder title", content: report([...real(29), { title: "needs Playwright pseudo-before", status: "skipped" }, placeholderRow]), code: 1, message: /skipped: needs Playwright pseudo-before/ },
  { name: "a real test skipped under the exact placeholder title (a second one)", content: report([...real(29), { title: placeholder, status: "skipped" }, placeholderRow]), code: 1, message: /skipped: needs Playwright's Chromium/ },
  { name: "a failed test", content: report([...real(29), { title: "marker gives error", status: "failed" }, placeholderRow], { success: false }), code: 1, message: /failed: marker gives error[\s\S]*Vitest reported success: false/ },
  { name: "a real test skipped (it.skip)", content: report([...real(29), { title: "marker gives error", status: "skipped" }, placeholderRow]), code: 1, message: /skipped: marker gives error/ },
  { name: "a todo test", content: report([...real(29), { title: "marker gives error", status: "todo" }, placeholderRow]), code: 1, message: /todo: marker gives error/ },
  { name: ".only: one test ran, the rest skipped", content: report([{ title: "only probe", status: "passed" }, ...real(30, "skipped"), placeholderRow]), code: 1, message: /only 1 passed; at least 30 must pass/ },
  { name: "the placeholder failed", content: report([...real(30), { title: placeholder, status: "failed" }]), code: 1, message: /failed: needs Playwright's Chromium/ },
  { name: "a test file without assertionResults", content: JSON.stringify({ success: true, testResults: [{ name: "x" }] }), code: 1, message: /test file 0 has no assertionResults array/ },
];

describe("check-browser-test-report.mjs", () => {
  it.each(cases)("$name: exit $code", ({ content, minimum, code, message }) => {
    const result = run(content, minimum);
    expect(result.code, result.out).toBe(code);
    expect(result.out).toMatch(message);
  });

  it("refuses wrong arguments with exit 2", () => {
    expect(run(report(real(30)), undefined, []).code).toBe(2);
    expect(run(report(real(30)), "0").code).toBe(2);
    expect(run(report(real(30)), "thirty").code).toBe(2);
  });

  it("knows the placeholder by the exact title the browser test file uses", () => {
    const browserTests = fs.readFileSync(path.join(websiteRoot, "test", "screenshot-parity-browser.test.ts"), "utf8");
    expect(browserTests).toContain(`it.skip(${JSON.stringify(placeholder)}`);
    expect(fs.readFileSync(script, "utf8")).toContain(`const placeholderTitle = ${JSON.stringify(placeholder)};`);
  });

  it("is what the screenshot-parity job runs, with the floor of 30", () => {
    const workflow = fs.readFileSync(path.join(websiteRoot, "..", ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain('node tools/check-browser-test-report.mjs "${RUNNER_TEMP}/screenshot-browser.json" 30');
    expect(workflow).not.toMatch(/node\s+--input-type|node\s+-e\s/);
  });
});
