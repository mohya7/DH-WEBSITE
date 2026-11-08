// CI security gate. Fails on NEW findings: anything listed in known-findings.json
// (with an owner and a reason) is reported as a warning and does not fail the job.
// Nothing is suppressed in the tools themselves; they still report everything.
// The npm and dotnet jobs also fail on an allow-list entry that is expired, has
// no D-NNN, or disagrees with docs/deferred-items.md: each such entry cites a
// D-NNN register entry ("deferred") and carries the same expiry ("expires",
// YYYY-MM-DD, valid through that UTC day), whether or not its finding is still
// reported. The register is read only when the section has an entry.
//
// Each tool is validated in one pass. That pass checks every field the gate reads,
// and anything unexpected fails closed with the file and field named. Severity is
// applied only after that pass succeeds. The only leniency is what the tools
// themselves write:
//   npm    a `via` array may contain dependency-name strings beside advisory objects
//   NuGet  an omitted frameworks / topLevelPackages / transitivePackages /
//          vulnerabilities array is an empty list (a clean project is `{ path }`)
//   gitleaks  each finding must carry the five fields below; StartLine is a
//             positive integer, and the other four are non-empty strings
//   semgrep   results and errors must be arrays. Each result needs check_id,
//             path, start.line (a positive integer), and extra.severity
//             (INFO, WARNING, or ERROR, case-sensitive). extra.lines,
//             extra.message, and extra.metavars are not read: they can contain
//             matched source or a secret. An error is a partial parse only when
//             level is "warn" and type is the tagged array Semgrep 1.180 writes:
//             ["PartialParsing", locations]. The path is printed and the job
//             does not fail. Any other type, including Timeout, out of memory,
//             stack overflow, a fatal error, and a rule parse error, fails.
//             A missing or malformed type fails. The error message and spans
//             are not read. A rejected error is described by its position, its
//             level, the tag of its type, its path and its rule_id, each only when
//             it matches a strict pattern, otherwise as (none) or (unrecognised).
//             rule_id is read only for that description and is not a consumed field.
//
// An empty file, a blank file, a report of the wrong shape, or an npm audit that
// could not run fails the job. A missing file and malformed JSON still fail.
//
//   node gate.mjs npm <npm-audit.json> <label>      High and Critical advisories (npm audit --json, full tree,
//                                                   development packages included); expired or uncited entries fail
//   node gate.mjs dotnet <dotnet-list.json>         High and Critical (dotnet list package --vulnerable --include-transitive
//                                                   --format json); expired or uncited entries fail
//   node gate.mjs gitleaks <gitleaks-report.json>   every finding, by fingerprint; values are never printed
//   node gate.mjs semgrep <semgrep.json>            ERROR fails; a WARNING fails when its rule is listed in
//                                                   fail-on-rules.json; any other WARNING is printed; INFO does not fail
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const known = JSON.parse(fs.readFileSync(path.join(here, "known-findings.json"), "utf8"));
const failOnRules = JSON.parse(fs.readFileSync(path.join(here, "fail-on-rules.json"), "utf8"));
if (!Array.isArray(failOnRules) || failOnRules.some((id) => typeof id !== "string" || id === "")) {
  throw new Error("fail-on-rules.json must be a list of rule ids");
}

// Semgrep labels these WARNING. They fail the gate anyway, unless the finding
// is listed in known-findings.json exactly as an ERROR is.
export const semgrepFailOnRules = new Set(failOnRules);

export function semgrepCounted(item) {
  return item.severity === "ERROR" || semgrepFailOnRules.has(item.rule);
}

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
  semgrep: [
    { field: "results", path: ["results"], accepts: ["array"], optional: false },
    { field: "errors", path: ["errors"], accepts: ["array"], optional: false },
    { field: "error", path: ["errors", 0], accepts: ["object"], optional: true },
    { field: "level", path: ["errors", 0, "level"], accepts: ["string"], optional: false },
    { field: "path", path: ["errors", 0, "path"], accepts: ["string"], optional: false },
    { field: "type", path: ["errors", 0, "type"], accepts: ["array"], optional: false },
    { field: "type", path: ["errors", 0, "type", 0], accepts: ["string"], optional: false },
    { field: "type", path: ["errors", 0, "type", 1], accepts: ["array"], optional: false },
    { field: "result", path: ["results", 0], accepts: ["object"], optional: true },
    { field: "check_id", path: ["results", 0, "check_id"], accepts: ["string"], optional: false },
    { field: "path", path: ["results", 0, "path"], accepts: ["string"], optional: false },
    { field: "start", path: ["results", 0, "start"], accepts: ["object"], optional: false },
    { field: "line", path: ["results", 0, "start", "line"], accepts: ["number"], optional: false },
    { field: "extra", path: ["results", 0, "extra"], accepts: ["object"], optional: false },
    { field: "severity", path: ["results", 0, "extra", "severity"], accepts: ["string"], optional: false },
  ],
};

const [kind, file, label = ""] = process.argv.slice(2);

function reject(message) {
  console.error(`${file}: ${message}`);
  process.exit(1);
}

// A missing file throws, and malformed JSON throws. Both already fail the process.
// JSON.parse keeps the last duplicate key, so a repeated key is rejected first.
function read(reportFile) {
  const text = fs.readFileSync(reportFile, "utf8").replace(/^\uFEFF/, "").trim();
  if (!text) reject("the tool produced no output");
  const duplicate = duplicateKey(text);
  if (duplicate !== null) reject(`duplicate key ${duplicate}`);
  return JSON.parse(text);
}

// One pass over the text. Returns the first repeated object key, or null when
// the text has none (including when it is not JSON; JSON.parse then fails).
function duplicateKey(text) {
  let i = 0;
  const n = text.length;
  function skipWs() {
    while (i < n) {
      const code = text.charCodeAt(i);
      if (code !== 32 && code !== 9 && code !== 10 && code !== 13) break;
      i += 1;
    }
  }
  function skipString() {
    i += 1;
    while (i < n) {
      const code = text.charCodeAt(i);
      if (code === 34) {
        i += 1;
        return true;
      }
      i += code === 92 ? 2 : 1;
    }
    return false;
  }
  function readKey() {
    const start = i;
    if (!skipString()) return undefined;
    try {
      return JSON.parse(text.slice(start, i));
    } catch {
      return undefined;
    }
  }
  function scanValue() {
    skipWs();
    if (i >= n) return false;
    const c = text[i];
    if (c === "{") return scanObject();
    if (c === "[") return scanArray();
    if (c === '"') return skipString() ? null : false;
    if (c === "-" || (c >= "0" && c <= "9")) {
      i += 1;
      while (i < n && "0123456789eE+-.".includes(text[i])) i += 1;
      return null;
    }
    if (text.startsWith("true", i) || text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return null;
    }
    return false;
  }
  function scanArray() {
    i += 1;
    skipWs();
    if (text[i] === "]") {
      i += 1;
      return null;
    }
    while (i < n) {
      const nested = scanValue();
      if (nested !== null) return nested;
      skipWs();
      if (text[i] === "]") {
        i += 1;
        return null;
      }
      if (text[i] !== ",") return false;
      i += 1;
    }
    return false;
  }
  function scanObject() {
    i += 1;
    skipWs();
    if (text[i] === "}") {
      i += 1;
      return null;
    }
    const seen = new Set();
    while (i < n) {
      skipWs();
      if (text[i] !== '"') return false;
      const key = readKey();
      if (key === undefined) return false;
      if (seen.has(key)) return key;
      seen.add(key);
      skipWs();
      if (text[i] !== ":") return false;
      i += 1;
      const nested = scanValue();
      if (nested !== null) return nested;
      skipWs();
      if (text[i] === "}") {
        i += 1;
        return null;
      }
      if (text[i] !== ",") return false;
      i += 1;
    }
    return false;
  }
  const found = scanValue();
  return typeof found === "string" ? found : null;
}

const serious = (severity) => ["high", "critical"].includes(String(severity).toLowerCase());
const npmSeverities = new Set(["info", "low", "moderate", "high", "critical"]);
// Semgrep JSON uses uppercase INFO, WARNING, and ERROR. Lowercase is a
// different tool's scale and is rejected.
const semgrepSeverities = new Set(["INFO", "WARNING", "ERROR"]);
// The fixtures use both "High" and "moderate", and the level check below
// already folds case, so Low, Moderate, High, and Critical match either way.
const nugetSeverities = new Set(["low", "moderate", "high", "critical"]);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && value.length > 0;

// A present field of the wrong type fails. A field the tool left out is an empty list.
function presentArray(owner, field, labelText) {
  if (!Object.hasOwn(owner, field)) return [];
  if (!Array.isArray(owner[field])) reject(`${labelText} field ${field} is not an array`);
  return owner[field];
}

function finish(found, knownIds, describe, staleFrom = found) {
  const fresh = found.filter((item) => !knownIds.has(item.id));
  const old = found.filter((item) => knownIds.has(item.id));
  for (const item of old) console.log(`::warning title=Known finding (${label || kind})::${describe(item)} — see .github/security/known-findings.json`);
  for (const item of fresh) console.log(`::error title=New finding (${label || kind})::${describe(item)}`);
  // A pull request's diff scan never contains the old commits, so known secrets are only "stale" on the full history.
  const checksStale = !(kind === "gitleaks" && label !== "full-history");
  const stale = checksStale ? [...knownIds].filter((id) => !staleFrom.some((item) => item.id === id)) : [];
  console.log(`${label || kind}: ${found.length} finding(s) at the gate's level; ${old.length} known, ${fresh.length} new.${stale.length ? ` Known but no longer found (remove from known-findings.json): ${stale.join(", ")}` : ""}`);
  process.exitCode = fresh.length > 0 ? 1 : 0;
}

// The dependency allow-list rule. Each npm and dotnet entry in
// known-findings.json cites "deferred": "D-NNN" and carries "expires":
// "YYYY-MM-DD". docs/deferred-items.md must hold exactly one "## D-NNN: <title>"
// heading for it, outside any fenced block, with a "- Expires: YYYY-MM-DD" line
// giving the same date. These three functions read no file and no clock;
// main() does both.
const registerFile = "docs/deferred-items.md";
const deferredPattern = /^D-\d{3}$/;

function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// The register's entries, D-NNN to its Expires date (null when the entry has no
// single "- Expires: YYYY-MM-DD" line), and the ids whose heading appears more
// than once. Lines inside fenced code blocks are skipped.
export function parseRegister(text) {
  const entries = new Map();
  const duplicates = [];
  const expiresLines = new Map();
  let fence = null;
  let current = null;
  for (const line of String(text).replace(/\r\n/g, "\n").split("\n")) {
    if (fence !== null) {
      const closing = line.match(/^(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    const opening = line.match(/^(`{3,}|~{3,})/);
    if (opening) {
      fence = opening[1];
      continue;
    }
    if (/^#{1,2} /.test(line)) {
      const heading = line.match(/^## (D-\d{3}):(\s|$)/);
      current = heading ? heading[1] : null;
      if (current !== null) {
        if (entries.has(current)) {
          if (!duplicates.includes(current)) duplicates.push(current);
        } else {
          entries.set(current, null);
          expiresLines.set(current, []);
        }
      }
      continue;
    }
    if (current !== null && line.startsWith("- Expires:")) expiresLines.get(current).push(line);
  }
  for (const [id, lines] of expiresLines) {
    const match = lines.length === 1 ? lines[0].match(/^- Expires: (\d{4}-\d{2}-\d{2})\s*$/) : null;
    entries.set(id, match ? match[1] : null);
  }
  return { entries, duplicates };
}

function entryName(entry, index) {
  return isRecord(entry) && nonEmpty(entry.id) ? entry.id : `entry ${index + 1}`;
}

// Shape only: each entry cites a D-NNN and carries a real YYYY-MM-DD date.
export function allowListShapeProblems(entries) {
  const problems = [];
  if (!Array.isArray(entries)) return ["the allow-list section is not a list"];
  entries.forEach((entry, index) => {
    const name = entryName(entry, index);
    if (!isRecord(entry)) {
      problems.push(`${name} is not an object`);
      return;
    }
    if (!Object.hasOwn(entry, "deferred")) problems.push(`${name} has no D-NNN in "deferred"`);
    else if (typeof entry.deferred !== "string" || !deferredPattern.test(entry.deferred)) {
      problems.push(`${name} cites ${JSON.stringify(entry.deferred)}, which is not a D-NNN id`);
    }
    if (!Object.hasOwn(entry, "expires")) problems.push(`${name} has no expires date`);
    else if (!isRealDate(entry.expires)) {
      problems.push(`${name} has expires ${JSON.stringify(entry.expires)}, which is not a real YYYY-MM-DD date`);
    }
  });
  return problems;
}

// Shape, register and expiry. today is a UTC YYYY-MM-DD date; register is the
// result of parseRegister, or null when the register file does not exist.
export function allowListProblems(entries, today, register) {
  const problems = allowListShapeProblems(entries);
  if (!Array.isArray(entries)) return problems;
  entries.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const name = entryName(entry, index);
    const cited = typeof entry.deferred === "string" && deferredPattern.test(entry.deferred) ? entry.deferred : null;
    const expires = isRealDate(entry.expires) ? entry.expires : null;
    if (cited !== null) {
      if (register === null) {
        problems.push(`${name} cites ${cited}, but ${registerFile} does not exist`);
      } else if (!register.entries.has(cited)) {
        problems.push(`${name} cites ${cited}, which is not in ${registerFile}`);
      } else if (register.duplicates.includes(cited)) {
        problems.push(`${name} cites ${cited}, which appears more than once in ${registerFile}`);
      } else if (register.entries.get(cited) === null) {
        problems.push(`${name} cites ${cited}, which has no "- Expires: YYYY-MM-DD" line in ${registerFile}`);
      } else if (expires !== null && register.entries.get(cited) !== expires) {
        problems.push(`${name} expires on ${expires}, but ${cited} in ${registerFile} expires on ${register.entries.get(cited)}`);
      }
    }
    if (expires !== null && today > expires) {
      problems.push(cited !== null
        ? `${name} cites ${cited}, which expired on ${expires}; fix the finding or record a new owner decision`
        : `${name} expired on ${expires}; fix the finding or record a new owner decision`);
    }
  });
  return problems;
}

// Runs after finish(), so new findings and entry problems are both printed, and
// either one fails the job.
function checkAllowList(entries, title) {
  if (Array.isArray(entries) && entries.length === 0) return;
  let register = null;
  try {
    register = parseRegister(fs.readFileSync(path.join(here, "..", "..", registerFile), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const today = new Date().toISOString().slice(0, 10);
  const problems = allowListProblems(entries, today, register);
  for (const problem of problems) console.log(`::error title=Allow-list entry (${title})::${problem}`);
  if (problems.length > 0) process.exitCode = 1;
}

export function keepSerious(found) {
  const kept = [];
  for (const item of found) {
    if (!serious(item.severity)) continue;
    if (kept.some((other) => other.id === item.id && other.pkg === item.pkg && other.project === item.project)) continue;
    kept.push(item);
  }
  return kept;
}

export function validateNpm(audit) {
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
    if (!npmSeverities.has(entry.severity)) reject("npm audit report field severity is not a known value");
    if (!Array.isArray(entry.via)) reject("npm audit report field via is not an array");
    for (const via of entry.via) {
      // npm puts dependency names in the same array as advisory objects.
      if (typeof via === "string") continue;
      if (!isRecord(via)) reject("npm audit report field via is not an advisory");
      if (!("severity" in via) && !("url" in via) && !("title" in via)) reject("npm audit report field via is not an advisory");
      if (!nonEmpty(via.severity)) reject("npm audit report field severity is not a string");
      if (!npmSeverities.has(via.severity)) reject("npm audit report field severity is not a known value");
      if (!nonEmpty(via.url)) reject("npm audit report field url is not a string");
      if (typeof via.title !== "string") reject("npm audit report field title is not a string");
      const id = via.url.replace("https://github.com/advisories/", "");
      found.push({ id, pkg, severity: via.severity, title: via.title });
    }
  }
  return found;
}

export function validateDotnet(report) {
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
          if (!nugetSeverities.has(String(advisory.severity).toLowerCase())) reject("NuGet report field severity is not a known value");
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

export function validateGitleaks(report) {
  if (!Array.isArray(report)) reject("gitleaks report field report is not an array");
  const found = [];
  for (const finding of report) {
    if (!isRecord(finding)) reject("gitleaks report entry is not an object");
    for (const field of ["RuleID", "File", "StartLine", "Fingerprint", "Commit"]) {
      const value = finding[field];
      const positiveLine = Number.isInteger(value) && value > 0;
      const ok = field === "StartLine" ? positiveLine : nonEmpty(value);
      if (!ok) {
        reject(field === "StartLine" && typeof value === "number"
          ? "gitleaks report field StartLine is not a positive integer"
          : `gitleaks report field ${field} is missing`);
      }
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

// A rejected semgrep error is described with values that cannot form a workflow
// command or forge the description: no ":", ";", "(", ")", quote, control
// character or non-ASCII, and a bounded length. Anything else is a placeholder.
const semgrepTagPattern = /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/;
const semgrepPathPattern = /^[A-Za-z0-9._@+\[\]/-]{1,240}$/;
const semgrepRulePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

function shown(value, pattern) {
  if (value === undefined) return "(none)";
  return typeof value === "string" && pattern.test(value) ? value : "(unrecognised)";
}

// Called only when the gate has already decided to reject. Reads level, type
// (only its tag, never type[1]), path and rule_id; never message or spans.
function describeSemgrepError(error, index, count) {
  let tag = "(none)";
  if (error.type !== undefined) {
    const raw = Array.isArray(error.type) ? error.type[0] : error.type;
    tag = typeof raw === "string" && semgrepTagPattern.test(raw) ? raw : "(unrecognised)";
    if (tag === "PartialParsing" && !isPartialParse(error.type)) tag += " (malformed)";
  }
  const errorPath = typeof error.path === "string" ? error.path.replaceAll("\\", "/") : error.path;
  return ` (error ${index + 1} of ${count}; level ${shown(error.level, semgrepTagPattern)}; type ${tag}; path ${shown(errorPath, semgrepPathPattern)}; rule ${shown(error.rule_id, semgrepRulePattern)})`;
}

function isPartialParse(type) {
  return Array.isArray(type)
    && type.length === 2
    && type[0] === "PartialParsing"
    && Array.isArray(type[1]);
}

export function validateSemgrep(report) {
  if (!isRecord(report)) reject("semgrep report is not an object");
  if (!Array.isArray(report.results)) reject("semgrep report field results is not an array");
  if (!Array.isArray(report.errors)) reject("semgrep report field errors is not an array");
  const found = [];
  const parseWarnings = [];
  for (let index = 0; index < report.errors.length; index += 1) {
    const error = report.errors[index];
    if (!isRecord(error)) reject(`semgrep report field error is not an object (error ${index + 1} of ${report.errors.length})`);
    if (error.level !== "warn") reject(`semgrep report field level is not a parse warning${describeSemgrepError(error, index, report.errors.length)}`);
    if (!nonEmpty(error.path)) reject(`semgrep report field path is missing${describeSemgrepError(error, index, report.errors.length)}`);
    if (!isPartialParse(error.type)) reject(`semgrep report field type is not a partial parse${describeSemgrepError(error, index, report.errors.length)}`);
    parseWarnings.push(error.path.replaceAll("\\", "/"));
  }
  found.parseWarnings = parseWarnings;
  for (const result of report.results) {
    if (!isRecord(result)) reject("semgrep report field result is not an object");
    if (!nonEmpty(result.check_id)) reject("semgrep report field check_id is missing");
    if (!nonEmpty(result.path)) reject("semgrep report field path is missing");
    if (!isRecord(result.start)) reject("semgrep report field start is not an object");
    if (!Number.isInteger(result.start.line) || result.start.line < 1) {
      reject("semgrep report field line is not a positive integer");
    }
    if (!isRecord(result.extra)) reject("semgrep report field extra is not an object");
    if (!semgrepSeverities.has(result.extra.severity)) reject("semgrep report field severity is not a semgrep severity");
    const filePath = result.path.replaceAll("\\", "/");
    found.push({
      id: `${result.check_id}:${filePath}:${result.start.line}`,
      rule: result.check_id,
      file: filePath,
      line: result.start.line,
      severity: result.extra.severity,
    });
  }
  return found;
}

function main() {
  if (kind === "npm") {
    const entries = known.npm[label] ?? [];
    const found = keepSerious(validateNpm(read(file)));
    finish(found, new Set(entries.map((entry) => entry.id)), (item) => `${item.severity} ${item.pkg} ${item.id}: ${item.title}`);
    checkAllowList(entries, label || kind);
  } else if (kind === "dotnet") {
    const entries = known.dotnet ?? [];
    const found = keepSerious(validateDotnet(read(file)));
    finish(found, new Set(entries.map((entry) => entry.id)), (item) => `${item.severity} ${item.pkg} ${item.id} (${item.project})`);
    checkAllowList(entries, label || kind);
  } else if (kind === "gitleaks") {
    const found = validateGitleaks(read(file));
    finish(found, new Set((known.gitleaks ?? []).map((entry) => entry.fingerprint)), (item) => `${item.rule} in ${item.file}:${item.line} (commit ${item.commit})`);
  } else if (kind === "semgrep") {
    const found = validateSemgrep(read(file));
    if (!Array.isArray(known.semgrep)) reject("known findings field semgrep is missing");
    const knownIds = new Set(known.semgrep.map((entry) => entry.id));
    for (const parsePath of found.parseWarnings) console.log(`semgrep parse warning: ${parsePath}`);
    for (const item of found) {
      if (item.severity === "WARNING" && !semgrepFailOnRules.has(item.rule)) {
        const noted = knownIds.has(item.id) ? "known warning" : "warning";
        console.log(`semgrep ${noted}: ${item.rule} ${item.file}:${item.line}`);
      }
    }
    const counted = found.filter(semgrepCounted);
    finish(counted, knownIds, (item) => `${item.rule} in ${item.file}:${item.line}`, found);
  } else {
    console.error("usage: node gate.mjs npm|dotnet|gitleaks|semgrep <report.json> [label]");
    process.exitCode = 2;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
