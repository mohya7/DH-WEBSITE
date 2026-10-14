// CI security gate. Fails only on NEW findings: anything listed in known-findings.json
// (with an owner and a reason) is reported as a warning and does not fail the job.
// Nothing is suppressed in the tools themselves; they still report everything.
//
// Each tool is validated in one pass. That pass checks every field the gate reads,
// and anything unexpected fails closed with the file and field named. Severity is
// applied only after that pass succeeds. The only leniency is what the tools
// themselves write:
//   npm    a `via` array may contain dependency-name strings beside advisory objects
//   NuGet  an omitted frameworks / topLevelPackages / transitivePackages /
//          vulnerabilities array is an empty list (a clean project is `{ path }`)
//   gitleaks  unchanged: each finding must carry the five fields below
//
// An empty file, a blank file, a report of the wrong shape, or an npm audit that
// could not run fails the job. A missing file and malformed JSON still fail.
//
//   node gate.mjs npm <npm-audit.json> <label>      High and Critical advisories (npm audit --json)
//   node gate.mjs dotnet <dotnet-list.json>         High and Critical (dotnet list package --vulnerable --format json)
//   node gate.mjs gitleaks <gitleaks-report.json>   every finding, by fingerprint; values are never printed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const known = JSON.parse(fs.readFileSync(path.join(here, "known-findings.json"), "utf8"));

// Fields the gate reads. gate.test.mjs mutates each of these, so a field added
// here without a matching mutation case fails the suite. `optional` is only the
// removal that the real tool already produces (an omitted NuGet array, or the
// npm `error` key, which is valid only when it is absent).
export const consumedFields = {
  npm: [
    { field: "auditReportVersion", path: ["auditReportVersion"], accepts: ["number"], optional: false },
    { field: "metadata", path: ["metadata"], accepts: ["object"], optional: false },
    { field: "vulnerabilities", path: ["vulnerabilities"], accepts: ["object"], optional: false },
    { field: "vulnerability", path: ["vulnerabilities", "next"], accepts: ["object"], optional: true },
    { field: "severity", path: ["vulnerabilities", "next", "severity"], accepts: ["string"], optional: false },
    { field: "via", path: ["vulnerabilities", "next", "via"], accepts: ["array"], optional: false },
    { field: "via", path: ["vulnerabilities", "next", "via", 1], accepts: ["string"], optional: true },
    { field: "severity", path: ["vulnerabilities", "next", "via", 1, "severity"], accepts: ["string"], optional: false },
    { field: "url", path: ["vulnerabilities", "next", "via", 1, "url"], accepts: ["string"], optional: false },
    { field: "title", path: ["vulnerabilities", "next", "via", 1, "title"], accepts: ["string"], optional: false },
    { field: "error", path: ["error"], accepts: [], optional: true, absent: true },
  ],
  dotnet: [
    { field: "projects", path: ["projects"], accepts: ["array"], optional: false },
    { field: "project", path: ["projects", 0], accepts: ["object"], optional: true },
    { field: "path", path: ["projects", 0, "path"], accepts: ["string"], optional: false },
    { field: "frameworks", path: ["projects", 0, "frameworks"], accepts: ["array"], optional: true },
    { field: "framework", path: ["projects", 0, "frameworks", 0], accepts: ["object"], optional: true },
    { field: "topLevelPackages", path: ["projects", 0, "frameworks", 0, "topLevelPackages"], accepts: ["array"], optional: true },
    { field: "transitivePackages", path: ["projects", 0, "frameworks", 0, "transitivePackages"], accepts: ["array"], optional: true },
    { field: "package", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0], accepts: ["object"], optional: true },
    { field: "id", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0, "id"], accepts: ["string"], optional: false },
    { field: "resolvedVersion", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0, "resolvedVersion"], accepts: ["string"], optional: false },
    { field: "vulnerabilities", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0, "vulnerabilities"], accepts: ["array"], optional: true },
    { field: "advisory", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0, "vulnerabilities", 0], accepts: ["object"], optional: true },
    { field: "severity", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0, "vulnerabilities", 0, "severity"], accepts: ["string"], optional: false },
    { field: "advisoryurl", path: ["projects", 0, "frameworks", 0, "topLevelPackages", 0, "vulnerabilities", 0, "advisoryurl"], accepts: ["string"], optional: false },
  ],
  gitleaks: [
    { field: "report", path: [], accepts: ["array"], optional: false },
    { field: "entry", path: [0], accepts: ["object"], optional: true },
    { field: "RuleID", path: [0, "RuleID"], accepts: ["string"], optional: false },
    { field: "File", path: [0, "File"], accepts: ["string"], optional: false },
    { field: "StartLine", path: [0, "StartLine"], accepts: ["number"], optional: false },
    { field: "Fingerprint", path: [0, "Fingerprint"], accepts: ["string"], optional: false },
    { field: "Commit", path: [0, "Commit"], accepts: ["string"], optional: false },
  ],
};

const [kind, file, label = ""] = process.argv.slice(2);

function reject(message) {
  console.error(`${file}: ${message}`);
  process.exit(1);
}

// A missing file throws, and malformed JSON throws. Both already fail the process.
function read(reportFile) {
  const text = fs.readFileSync(reportFile, "utf8").replace(/^\uFEFF/, "").trim();
  if (!text) reject("the tool produced no output");
  return JSON.parse(text);
}

const serious = (severity) => ["high", "critical"].includes(String(severity).toLowerCase());
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && value.length > 0;

// A present field of the wrong type fails. A field the tool left out is an empty list.
function presentArray(owner, field, labelText) {
  if (!Object.hasOwn(owner, field)) return [];
  if (!Array.isArray(owner[field])) reject(`${labelText} field ${field} is not an array`);
  return owner[field];
}

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

function keepSerious(found) {
  const kept = [];
  for (const item of found) {
    if (!serious(item.severity)) continue;
    if (kept.some((other) => other.id === item.id && other.pkg === item.pkg && other.project === item.project)) continue;
    kept.push(item);
  }
  return kept;
}

function validateNpm(audit) {
  if (!isRecord(audit)) reject("npm audit report has the wrong shape");
  if (Object.hasOwn(audit, "error")) reject("npm audit report field error is set");
  if (!Object.hasOwn(audit, "auditReportVersion")) reject("npm audit report field auditReportVersion is missing");
  if (!Object.hasOwn(audit, "vulnerabilities")) reject("npm audit report field vulnerabilities is missing");
  if (!Object.hasOwn(audit, "metadata")) reject("npm audit report field metadata is missing");
  if (typeof audit.auditReportVersion !== "number" || !Number.isFinite(audit.auditReportVersion)) {
    reject("npm audit report field auditReportVersion is not a number");
  }
  if (!isRecord(audit.metadata)) reject("npm audit report field metadata is not an object");
  if (!isRecord(audit.vulnerabilities)) reject("npm audit report field vulnerabilities is not an object");
  const found = [];
  for (const [pkg, entry] of Object.entries(audit.vulnerabilities)) {
    if (!isRecord(entry)) reject("npm audit report field vulnerability is not an object");
    if (!nonEmpty(entry.severity)) reject("npm audit report field severity is not a string");
    if (!Array.isArray(entry.via)) reject("npm audit report field via is not an array");
    for (const via of entry.via) {
      // npm puts dependency names in the same array as advisory objects.
      if (typeof via === "string") continue;
      if (!isRecord(via)) reject("npm audit report field via is not an advisory");
      if (!("severity" in via) && !("url" in via) && !("title" in via)) reject("npm audit report field via is not an advisory");
      if (!nonEmpty(via.severity)) reject("npm audit report field severity is not a string");
      if (!nonEmpty(via.url)) reject("npm audit report field url is not a string");
      if (typeof via.title !== "string") reject("npm audit report field title is not a string");
      const id = via.url.replace("https://github.com/advisories/", "");
      found.push({ id, pkg, severity: via.severity, title: via.title });
    }
  }
  return found;
}

function validateDotnet(report) {
  if (!isRecord(report) || !Array.isArray(report.projects)) reject("NuGet report field projects is missing");
  const found = [];
  for (const project of report.projects) {
    if (!isRecord(project)) reject("NuGet report field project is not an object");
    if (!nonEmpty(project.path)) reject("NuGet report field path is not a string");
    const frameworks = presentArray(project, "frameworks", "NuGet report");
    for (const framework of frameworks) {
      if (!isRecord(framework)) reject("NuGet report field framework is not an object");
      const packages = [
        ...presentArray(framework, "topLevelPackages", "NuGet report"),
        ...presentArray(framework, "transitivePackages", "NuGet report"),
      ];
      for (const pkg of packages) {
        if (!isRecord(pkg)) reject("NuGet report field package is not an object");
        if (!nonEmpty(pkg.id)) reject("NuGet report field id is not a string");
        if (!nonEmpty(pkg.resolvedVersion)) reject("NuGet report field resolvedVersion is not a string");
        for (const advisory of presentArray(pkg, "vulnerabilities", "NuGet report")) {
          if (!isRecord(advisory)) reject("NuGet report field advisory is not an object");
          if (!nonEmpty(advisory.severity)) reject("NuGet report field severity is not a string");
          if (!nonEmpty(advisory.advisoryurl)) reject("NuGet report field advisoryurl is not a string");
          const id = advisory.advisoryurl.replace("https://github.com/advisories/", "");
          found.push({
            id,
            pkg: `${pkg.id} ${pkg.resolvedVersion}`,
            severity: advisory.severity,
            project: path.basename(project.path),
          });
        }
      }
    }
  }
  return found;
}

function validateGitleaks(report) {
  if (!Array.isArray(report)) reject("gitleaks report field report is not an array");
  const found = [];
  for (const finding of report) {
    if (!isRecord(finding)) reject("gitleaks report entry is not an object");
    for (const field of ["RuleID", "File", "StartLine", "Fingerprint", "Commit"]) {
      const value = finding[field];
      const ok = field === "StartLine" ? typeof value === "number" && Number.isFinite(value) : nonEmpty(value);
      if (!ok) reject(`gitleaks report field ${field} is missing`);
    }
    found.push({
      id: finding.Fingerprint,
      rule: finding.RuleID,
      file: finding.File,
      line: finding.StartLine,
      commit: finding.Commit.slice(0, 7),
    });
  }
  return found;
}

function main() {
  if (kind === "npm") {
    const found = keepSerious(validateNpm(read(file)));
    finish(found, new Set((known.npm[label] ?? []).map((entry) => entry.id)), (item) => `${item.severity} ${item.pkg} ${item.id}: ${item.title}`);
  } else if (kind === "dotnet") {
    const found = keepSerious(validateDotnet(read(file)));
    finish(found, new Set((known.dotnet ?? []).map((entry) => entry.id)), (item) => `${item.severity} ${item.pkg} ${item.id} (${item.project})`);
  } else if (kind === "gitleaks") {
    const found = validateGitleaks(read(file));
    finish(found, new Set((known.gitleaks ?? []).map((entry) => entry.fingerprint)), (item) => `${item.rule} in ${item.file}:${item.line} (commit ${item.commit})`);
  } else {
    console.error("usage: node gate.mjs npm|dotnet|gitleaks <report.json> [label]");
    process.exitCode = 2;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
