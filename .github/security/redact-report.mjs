// Drops matched source and metavars before the Semgrep report is uploaded.
// The scan can contain a secret in those fields. The gate has already run.
import { readFileSync, writeFileSync } from "node:fs";

const [reportPath, redactedPath] = process.argv.slice(2);
if (process.argv.length !== 4 || reportPath === "" || redactedPath === "") {
  console.error("redact-report.mjs needs the report path and the redacted path");
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
if (Array.isArray(report.results)) {
  for (const result of report.results) {
    const severity = result && result.extra && typeof result.extra.severity === "string" ? result.extra.severity : "";
    if (result && typeof result === "object") result.extra = { severity };
  }
}
if (Array.isArray(report.errors)) report.errors = report.errors.map(() => ({ type: "redacted" }));
writeFileSync(redactedPath, JSON.stringify(report));
