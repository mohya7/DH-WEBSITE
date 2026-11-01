/**
 * The canary for the browser-suite check (GAP-21): committed reports that the
 * check must reject. Run on every pull request, before the browser tests, by the
 * CI job "Website — browser tests, default and consent builds".
 *
 *   node tools/browser-suite/run-canary.mjs
 *
 * check-report.mjs, expected.json and canary/ are found beside this file, not in
 * the working directory. The check runs as its own process, as CI runs it.
 *
 * 1. Blocking date passed, the consent run has a failed test:
 *    exit 1, and the failed test is named.
 * 2. Report mode, the consent build lost its banner (every consent test skipped):
 *    exit 1, and the unexpected skip is named.
 *
 * Exit 0 when both are rejected as described, 1 otherwise.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(here, "check-report.mjs");
const expected = path.join(here, "expected.json");
const canary = (name) => path.join(here, "canary", name);

const canaries = [
  {
    name: "canary 1",
    what: "a failed consent-build test after the blocking date",
    date: "2000-01-01",
    reports: { default: "default.json", consent: "consent-failed.json" },
    output: "failed: consent: pages.spec.ts › the skipped home intro moves the logo and its classes persist after load",
  },
  {
    name: "canary 2",
    what: "a consent build that lost its banner, in report mode",
    date: "2999-12-31",
    reports: { default: "default.json", consent: "consent-lost.json" },
    output: "unexpected skip: consent: consent.spec.ts › ",
  },
];

let failed = 0;
for (const item of canaries) {
  const env = { ...process.env, BROWSER_TESTS_BLOCKING_FROM: item.date };
  // The canary's own run must not write into the job summary.
  delete env.GITHUB_STEP_SUMMARY;
  const result = spawnSync(
    process.execPath,
    [checker, expected, `default=${canary(item.reports.default)}`, `consent=${canary(item.reports.consent)}`],
    { encoding: "utf8", env },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status === 1 && output.includes(item.output)) {
    console.log(`${item.name} rejected: ${item.what}`);
  } else {
    failed += 1;
    console.log(`::error title=Browser-suite canary::${item.name} (${item.what}) was not rejected: exit ${String(result.status)}, expected 1 with "${item.output}"`);
    console.log(output);
  }
}

process.exitCode = failed === 0 ? 0 : 1;
