// CI security gate. Fails only on NEW findings: anything listed in known-findings.json
// (with an owner and a reason) is reported as a warning and does not fail the job.
// Nothing is suppressed in the tools themselves; they still report everything.
// An empty file, a blank file, a report of the wrong shape, or an npm audit that
// could not run fails the job. A missing file and malformed JSON still fail.
//
//   node gate.mjs npm <npm-audit.json> <label>      High and Critical advisories (npm audit --json)
//   node gate.mjs dotnet <dotnet-list.json>         High and Critical (dotnet list package --vulnerable --format json)
//   node gate.mjs gitleaks <gitleaks-report.json>   every finding, by fingerprint; values are never printed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const known = JSON.parse(fs.readFileSync(path.join(here, "known-findings.json"), "utf8"));
const [kind, file, label = ""] = process.argv.slice(2);

function reject(message) {
  console.error(`${file}: ${message}`);
  process.exit(1);
}

// A missing file throws, and malformed JSON throws. Both already fail the process.
const read = (f) => {
  const text = fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "").trim();
  if (!text) reject("the tool produced no output");
  return JSON.parse(text);
};

const serious = (severity) => ["high", "critical"].includes(String(severity).toLowerCase());

function finish(found, knownIds, describe) {
  const fresh = found.filter((item) => !knownIds.has(item.id));
  const old = found.filter((item) => knownIds.has(item.id));
  for (const item of old) console.log(`::warning title=Known finding (${label || kind})::${describe(item)} — see .github/security/known-findings.json`);
  for (const item of fresh) console.log(`::error title=New finding (${label || kind})::${describe(item)}`);
  // A pull request's diff scan never contains the old commits, so known secrets are only "stale" on the full history.
  const checksStale = !(kind === "gitleaks" && label !== "full-history");
  const stale = checksStale ? [...knownIds].filter((id) => !found.some((item) => item.id === id)) : [];
  console.log(`${label || kind}: ${found.length} finding(s) at the gate's level; ${old.length} known, ${fresh.length} new.${stale.length ? ` Known but no longer found (remove from known-findings.json): ${stale.join(", ")}` : ""}`);
  process.exitCode = fresh.length > 0 ? 1 : 0;
}

if (kind === "npm") {
  const audit = read(file);
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) reject("npm audit report has the wrong shape");
  if (audit.error && typeof audit.error === "object") reject("npm audit report contains an error object");
  if (!Object.hasOwn(audit, "auditReportVersion") || !Object.hasOwn(audit, "vulnerabilities") || !Object.hasOwn(audit, "metadata")) {
    reject("npm audit report is missing the expected top-level keys");
  }
  if (!audit.vulnerabilities || typeof audit.vulnerabilities !== "object" || Array.isArray(audit.vulnerabilities)) {
    reject("npm audit report vulnerabilities is not an object");
  }
  const found = [];
  for (const [pkg, entry] of Object.entries(audit.vulnerabilities)) {
    for (const via of Array.isArray(entry?.via) ? entry.via : []) {
      if (typeof via !== "object" || !serious(via.severity)) continue;
      const id = String(via.url ?? via.source).replace("https://github.com/advisories/", "");
      if (!found.some((item) => item.id === id && item.pkg === pkg)) found.push({ id, pkg, severity: via.severity, title: via.title });
    }
  }
  finish(found, new Set((known.npm[label] ?? []).map((entry) => entry.id)), (item) => `${item.severity} ${item.pkg} ${item.id}: ${item.title}`);
} else if (kind === "dotnet") {
  const report = read(file);
  if (!report || typeof report !== "object" || Array.isArray(report) || !Array.isArray(report.projects)) {
    reject("NuGet report is missing projects");
  }
  const found = [];
  for (const project of report.projects) {
    // With nothing vulnerable, dotnet writes `{ path }` and omits frameworks.
    const frameworks = Object.hasOwn(project, "frameworks") ? project.frameworks : [];
    if (!Array.isArray(frameworks)) reject("NuGet report frameworks is not an array");
    for (const framework of frameworks) {
      const packages = [
        ...(Array.isArray(framework.topLevelPackages) ? framework.topLevelPackages : []),
        ...(Array.isArray(framework.transitivePackages) ? framework.transitivePackages : []),
      ];
      for (const pkg of packages) {
        for (const vuln of Array.isArray(pkg.vulnerabilities) ? pkg.vulnerabilities : []) {
          if (!serious(vuln.severity)) continue;
          const id = String(vuln.advisoryurl).replace("https://github.com/advisories/", "");
          if (!found.some((item) => item.id === id && item.pkg === pkg.id)) found.push({ id, pkg: `${pkg.id} ${pkg.resolvedVersion}`, severity: vuln.severity, project: path.basename(project.path) });
        }
      }
    }
  }
  finish(found, new Set((known.dotnet ?? []).map((entry) => entry.id)), (item) => `${item.severity} ${item.pkg} ${item.id} (${item.project})`);
} else if (kind === "gitleaks") {
  const report = read(file);
  if (!Array.isArray(report)) reject("gitleaks report is not an array");
  // Rule, file, line, and commit only: the report is redacted and no value is printed.
  const found = report.map((f) => ({ id: f.Fingerprint, rule: f.RuleID, file: f.File, line: f.StartLine, commit: String(f.Commit).slice(0, 7) }));
  finish(found, new Set((known.gitleaks ?? []).map((entry) => entry.fingerprint)), (item) => `${item.rule} in ${item.file}:${item.line} (commit ${item.commit})`);
} else {
  console.error("usage: node gate.mjs npm|dotnet|gitleaks <report.json> [label]");
  process.exitCode = 2;
}
