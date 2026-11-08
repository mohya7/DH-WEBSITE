// Runs the gate against fixtures in a temp folder. No extra dependency.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectRunCommands, parseWorkflowYaml } from "./workflow-yaml.mjs";
import { semgrepCounted, semgrepFailOnRules } from "./gate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const gate = path.join(here, "gate.mjs");
const known = JSON.parse(fs.readFileSync(path.join(here, "known-findings.json"), "utf8"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dh-gate-"));
const canary = "CANARY-NOT-A-SECRET";

function write(name, contents) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
}

// Every gate this file spawns, in order. N11 reads it to prove where run() sends
// each tool.
const spawnedGates = [];

function runGate(gateFile, args) {
  spawnedGates.push(gateFile);
  const result = spawnSync(process.execPath, [gateFile, ...args], { encoding: "utf8" });
  return { code: result.status, out: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

// The gate files every fixture copy carries, byte for byte.
const gateFiles = ["gate.mjs", "fail-on-rules.json"];

// A fixture repository: a byte copy of the real gate in
// <tmp>/<name>/.github/security/ beside its own known-findings.json, and, unless
// register is null, <tmp>/<name>/docs/deferred-items.md, where the copied gate
// looks for the register exactly as the real one does.
function fixtureRepo(name, knownDocument, register) {
  const securityDir = path.join(dir, name, ".github", "security");
  fs.mkdirSync(securityDir, { recursive: true });
  for (const file of gateFiles) fs.copyFileSync(path.join(here, file), path.join(securityDir, file));
  fs.writeFileSync(path.join(securityDir, "known-findings.json"), `${JSON.stringify(knownDocument, null, 2)}\n`);
  if (register !== null) {
    fs.mkdirSync(path.join(dir, name, "docs"));
    fs.writeFileSync(path.join(dir, name, "docs", "deferred-items.md"), register);
  }
  return securityDir;
}

// A register in the form of docs/deferred-items.md, template block included, so
// the copied gate also has to skip the fenced example.
function registerText(entries) {
  const lines = [
    "# Deferred-items register",
    "",
    "Each entry has this form:",
    "",
    "```markdown",
    "## D-NNN: <short title>",
    "",
    "- Expires: <YYYY-MM-DD>",
    "```",
    "",
  ];
  for (const [id, expires] of entries) {
    lines.push(`## ${id}: gate self-test fixture`, "", "- Rule waived: S-7", `- Expires: ${expires}`, "");
  }
  return `${lines.join("\n")}`;
}

const fixtureEntry = (id, pkg, severity, deferred, expires) => ({
  id,
  package: `${pkg} 1.0.0`,
  severity,
  title: `fixture ${pkg}`,
  owner: "gate self-test",
  reason: "Fixture entry; not a real advisory.",
  deferred,
  expires,
});

// The npm and NuGet tests below never read the real npm and dotnet allow-list:
// an entry there that expires would otherwise fail the self-test, and through
// `needs:` skip gitleaks and Semgrep. Those sections are checked for shape here
// (N10) and for expiry by the npm and NuGet jobs.
//
// fixture-clean: the real allow-list with the npm and dotnet sections emptied.
// run() sends npm and dotnet to it; gitleaks and semgrep keep the real gate.
const cleanKnown = structuredClone(known);
cleanKnown.npm.website = [];
cleanKnown.npm.studio = [];
cleanKnown.dotnet = [];
const cleanGateDir = fixtureRepo("fixture-clean", cleanKnown, null);
const cleanGate = path.join(cleanGateDir, "gate.mjs");

function run(args) {
  if (args[0] === "npm" || args[0] === "dotnet") return runGate(cleanGate, args);
  return runGate(gate, args);
}

// fixture-repo: the known-list tests. npm.website holds three valid entries
// (D-901 to D-903, valid through 2999-12-31), so a known advisory is passed and
// does not hide a new one. npm.studio (D-900) and dotnet (D-904) hold one
// expired entry each.
const fixtureKnown = structuredClone(known);
fixtureKnown.npm.website = [
  fixtureEntry("GHSA-fixture-known-0001", "fixture-critical", "critical", "D-901", "2999-12-31"),
  fixtureEntry("GHSA-fixture-known-0002", "fixture-high-a", "high", "D-902", "2999-12-31"),
  fixtureEntry("GHSA-fixture-known-0003", "fixture-high-b", "high", "D-903", "2999-12-31"),
];
fixtureKnown.npm.studio = [fixtureEntry("GHSA-fixture-expired-0900", "fixture-expired", "high", "D-900", "2000-01-01")];
fixtureKnown.dotnet = [fixtureEntry("GHSA-fixture-expired-0904", "Fixture.Expired", "high", "D-904", "2000-01-01")];
const fixtureRegister = registerText([
  ["D-900", "2000-01-01"],
  ["D-901", "2999-12-31"],
  ["D-902", "2999-12-31"],
  ["D-903", "2999-12-31"],
  ["D-904", "2000-01-01"],
]);
const fixtureGateDir = fixtureRepo("fixture-repo", fixtureKnown, fixtureRegister);
const fixtureGate = path.join(fixtureGateDir, "gate.mjs");

function runFixture(args) {
  return runGate(fixtureGate, args);
}

// fixture-no-register: one valid-looking npm.website entry and no docs/ folder.
const noRegisterKnown = structuredClone(known);
noRegisterKnown.npm.website = [fixtureEntry("GHSA-fixture-known-0001", "fixture-critical", "critical", "D-901", "2999-12-31")];
const noRegisterGateDir = fixtureRepo("fixture-no-register", noRegisterKnown, null);
const noRegisterGate = path.join(noRegisterGateDir, "gate.mjs");

// fixture-expired-real: the real allow-list plus an expired npm.studio entry
// and an expired dotnet entry, with a register that holds both.
const expiredRealKnown = structuredClone(known);
expiredRealKnown.npm.studio = [...(known.npm.studio ?? []), fixtureEntry("GHSA-fixture-expired-0900", "fixture-expired", "high", "D-900", "2000-01-01")];
expiredRealKnown.dotnet = [...(known.dotnet ?? []), fixtureEntry("GHSA-fixture-expired-0904", "Fixture.Expired", "high", "D-904", "2000-01-01")];
const expiredRealGateDir = fixtureRepo("fixture-expired-real", expiredRealKnown, registerText([["D-900", "2000-01-01"], ["D-904", "2000-01-01"]]));
const expiredRealGate = path.join(expiredRealGateDir, "gate.mjs");

const fixtureGateDirs = [fixtureGateDir, cleanGateDir, noRegisterGateDir, expiredRealGateDir];

function npmReport(advisories) {
  const vulnerabilities = {};
  for (const item of advisories) {
    const pkg = item.package.split(" ")[0];
    vulnerabilities[pkg] ??= { severity: item.severity, via: [pkg] };
    vulnerabilities[pkg].via.push({
      severity: item.severity,
      title: item.title,
      url: `https://github.com/advisories/${item.id}`,
    });
  }
  return JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: advisories.length },
      dependencies: { prod: 0, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 0 },
    },
  });
}

const cleanNpm = npmReport([]);
const cleanNuget = JSON.stringify({
  version: 1,
  parameters: "",
  sources: [],
  projects: [{ path: "Example.csproj" }],
});

test("an empty report fails and names the file", () => {
  for (const [kind, label] of [["npm", "website"], ["npm", "studio"], ["dotnet", ""], ["gitleaks", "pr-diff"], ["gitleaks", "full-history"], ["semgrep", ""]]) {
    const file = write(`empty-${kind}-${label || "none"}.json`, "");
    const result = run([kind, file, label].filter((part, index) => index < 2 || part));
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, new RegExp(path.basename(file).replace(".", "\\.")));
    assert.match(result.out, /the tool produced no output/);
  }
});

test("a blank report fails and names the file", () => {
  for (const [kind, label] of [["npm", "website"], ["dotnet", ""], ["gitleaks", "full-history"], ["semgrep", ""]]) {
    const file = write(`blank-${kind}.json`, " \n\t");
    const result = run([kind, file, label].filter((part, index) => index < 2 || part));
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /the tool produced no output/);
    assert.ok(result.out.includes(file));
  }
});

test("malformed JSON fails", () => {
  const file = write("malformed.json", "{");
  const result = run(["npm", file, "website"]);
  assert.equal(result.code, 1);
  const semgrep = run(["semgrep", write("malformed-semgrep.json", "{")]);
  assert.equal(semgrep.code, 1, semgrep.out);
});

test("a missing report fails", () => {
  const result = run(["npm", path.join(dir, "missing.json"), "website"]);
  assert.equal(result.code, 1);
  assert.match(result.out, /ENOENT/);
});

test("the wrong shape fails", () => {
  const npm = run(["npm", write("shape-npm.json", "{}"), "studio"]);
  assert.equal(npm.code, 1, npm.out);
  assert.match(npm.out, /field auditReportVersion is missing/);
  const nuget = run(["dotnet", write("shape-nuget.json", JSON.stringify({ version: 1, parameters: "", sources: [] }))]);
  assert.equal(nuget.code, 1, nuget.out);
  assert.match(nuget.out, /field projects is missing/);
  const leaks = run(["gitleaks", write("shape-leaks.json", "{}"), "full-history"]);
  assert.equal(leaks.code, 1, leaks.out);
  assert.match(leaks.out, /not an array/);
  const semgrepArray = run(["semgrep", write("shape-semgrep-array.json", "[]")]);
  assert.equal(semgrepArray.code, 1, semgrepArray.out);
  assert.match(semgrepArray.out, /semgrep report is not an object/);
  const semgrepObject = run(["semgrep", write("shape-semgrep-object.json", "{}")]);
  assert.equal(semgrepObject.code, 1, semgrepObject.out);
  assert.match(semgrepObject.out, /field results is not an array/);
  const semgrepResults = run(["semgrep", write("shape-semgrep-results.json", JSON.stringify({ results: [] }))]);
  assert.equal(semgrepResults.code, 1, semgrepResults.out);
  assert.match(semgrepResults.out, /field errors is not an array/);
});

test("an npm error object fails", () => {
  const file = write("npm-error.json", JSON.stringify({ error: { code: "ENOAUDIT", summary: "could not run", detail: "" } }));
  const result = run(["npm", file, "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field error is set/);
  assert.ok(result.out.includes(file));
});

test("an npm error string or null fails and names the field", () => {
  for (const [name, error] of [["npm-error-string.json", "ENOAUDIT"], ["npm-error-null.json", null]]) {
    const report = JSON.parse(cleanNpm);
    report.error = error;
    const file = write(name, JSON.stringify(report));
    const result = run(["npm", file, "studio"]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /field error is set/);
    assert.ok(result.out.includes(file));
  }
});

test("an npm via that is not an array fails and names the field", () => {
  const report = JSON.parse(cleanNpm);
  report.vulnerabilities = {
    review: { severity: "high", via: { severity: "high", url: "https://github.com/advisories/GHSA-review-high" } },
  };
  const file = write("npm-invalid-via.json", JSON.stringify(report));
  const result = run(["npm", file, "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field via is not an array/);
  assert.ok(result.out.includes(file));
  assert.equal(result.out.includes("GHSA-review-high"), false);
});

test("a null npm version or metadata fails and names the field", () => {
  const version = run(["npm", write("npm-invalid-metadata.json", JSON.stringify({ auditReportVersion: null, metadata: null, vulnerabilities: {} })), "studio"]);
  assert.equal(version.code, 1, version.out);
  assert.match(version.out, /field auditReportVersion is not a number/);
  const metadata = run(["npm", write("npm-null-metadata.json", JSON.stringify({ auditReportVersion: 2, metadata: null, vulnerabilities: {} })), "studio"]);
  assert.equal(metadata.code, 1, metadata.out);
  assert.match(metadata.out, /field metadata is not an object/);
});

test("a clean report passes", () => {
  const npm = run(["npm", write("clean-npm.json", cleanNpm), "studio"]);
  assert.equal(npm.code, 0, npm.out);
  assert.match(npm.out, /0 new/);
  const nuget = run(["dotnet", write("clean-nuget.json", cleanNuget)]);
  assert.equal(nuget.code, 0, nuget.out);
  assert.match(nuget.out, /0 new/);
  const leaks = run(["gitleaks", write("clean-leaks.json", "[]"), "full-history"]);
  assert.equal(leaks.code, 0, leaks.out);
  assert.match(leaks.out, /0 new/);
  const semgrep = run(["semgrep", write("clean-semgrep.json", JSON.stringify({ results: [], errors: [] }))]);
  assert.equal(semgrep.code, 0, semgrep.out);
  assert.match(semgrep.out, /0 new/);
  const bareFramework = JSON.stringify({
    version: 1,
    parameters: "",
    sources: [],
    projects: [{ path: "Example.csproj", frameworks: [{ framework: "net10.0" }] }],
  });
  const framework = run(["dotnet", write("nuget-framework-no-packages.json", bareFramework)]);
  assert.equal(framework.code, 0, framework.out);
  assert.match(framework.out, /0 new/);
});

test("a NuGet package array or vulnerabilities value that is an object fails and names the field", () => {
  const packages = {
    version: 1,
    parameters: "",
    sources: [],
    projects: [{ path: "Review.csproj", frameworks: [{ framework: "net10.0", topLevelPackages: { bad: "shape" } }] }],
  };
  const packageResult = run(["dotnet", write("nuget-package-array-object.json", JSON.stringify(packages))]);
  assert.equal(packageResult.code, 1, packageResult.out);
  assert.match(packageResult.out, /field topLevelPackages is not an array/);
  const transitive = structuredClone(packages);
  delete transitive.projects[0].frameworks[0].topLevelPackages;
  transitive.projects[0].frameworks[0].transitivePackages = { bad: "shape" };
  const transitiveResult = run(["dotnet", write("nuget-transitive-object.json", JSON.stringify(transitive))]);
  assert.equal(transitiveResult.code, 1, transitiveResult.out);
  assert.match(transitiveResult.out, /field transitivePackages is not an array/);
  const vulnerabilities = {
    version: 1,
    parameters: "",
    sources: [],
    projects: [{
      path: "Review.csproj",
      frameworks: [{
        framework: "net10.0",
        topLevelPackages: [{ id: "Review", resolvedVersion: "1.0", vulnerabilities: { severity: "High", advisoryurl: "https://github.com/advisories/GHSA-review-high" } }],
      }],
    }],
  };
  const vulnResult = run(["dotnet", write("nuget-vulnerabilities-object.json", JSON.stringify(vulnerabilities))]);
  assert.equal(vulnResult.code, 1, vulnResult.out);
  assert.match(vulnResult.out, /field vulnerabilities is not an array/);
  assert.equal(vulnResult.out.includes("GHSA-review-high"), false);
});

test("the fixture gate is the real gate", () => {
  assert.equal(fixtureGateDirs.length, 4);
  for (const fixtureDir of fixtureGateDirs) {
    for (const name of gateFiles) {
      assert.ok(fs.readFileSync(path.join(fixtureDir, name)).equals(fs.readFileSync(path.join(here, name))), `${path.relative(dir, fixtureDir)}/${name} differs from the real one`);
    }
  }
});

test("a known-only npm report passes", () => {
  const result = runFixture(["npm", write("known-npm.json", npmReport(fixtureKnown.npm.website)), "website"]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /3 known, 0 new/);
});

test("a new High advisory fails", () => {
  const advisories = [...fixtureKnown.npm.website, { id: "GHSA-new-high-0000", package: "example-high", severity: "high", title: "synthetic high" }];
  const result = runFixture(["npm", write("new-high.json", npmReport(advisories)), "website"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /GHSA-new-high-0000/);
  assert.match(result.out, /3 known, 1 new/);
});

test("a new Critical advisory fails", () => {
  const advisories = [...fixtureKnown.npm.website, { id: "GHSA-new-crit-0000", package: "example-critical", severity: "critical", title: "synthetic critical" }];
  const result = runFixture(["npm", write("new-critical.json", npmReport(advisories)), "website"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /critical example-critical GHSA-new-crit-0000/);
  assert.match(result.out, /3 known, 1 new/);
});

test("an unknown gitleaks fingerprint fails and does not print the value", () => {
  const report = [{
    Fingerprint: "not-a-known-fingerprint",
    RuleID: "generic-api-key",
    File: "example.txt",
    StartLine: 1,
    Commit: "abcdef0123456789",
    Secret: canary,
    Match: canary,
  }];
  const result = run(["gitleaks", write("unknown-fingerprint.json", JSON.stringify(report)), "full-history"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /generic-api-key in example\.txt:1/);
  assert.equal(result.out.includes(canary), false);
});

test("a gitleaks array of non-objects fails with a shape message", () => {
  const result = run(["gitleaks", write("gitleaks-strings.json", JSON.stringify(["x", "y"])), "full-history"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /gitleaks report entry is not an object/);
  assert.equal(result.out.includes("undefined"), false);
  assert.equal(result.out.includes("\nx\n") || result.out.includes("entry x"), false);
});

test("a gitleaks finding missing the fields the gate reads fails and does not print the value", () => {
  const report = [{ Secret: canary, Match: canary }];
  const file = write("gitleaks-missing-fields.json", JSON.stringify(report));
  const result = run(["gitleaks", file, "full-history"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field RuleID is missing/);
  assert.equal(result.out.includes("undefined"), false);
  assert.equal(result.out.includes(canary), false);
  assert.ok(result.out.includes(file));
});

test("an npm via array of only dependency names passes", () => {
  const report = JSON.parse(cleanNpm);
  report.vulnerabilities = { next: { severity: "high", via: ["next"] } };
  const result = run(["npm", write("npm-via-strings.json", JSON.stringify(report)), "studio"]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /0 new/);
});

test("a moderate NuGet advisory passes and a High one fails", () => {
  const body = (severity) => ({
    version: 1,
    parameters: "",
    sources: [],
    projects: [{
      path: "Review.csproj",
      frameworks: [{
        framework: "net10.0",
        topLevelPackages: [{
          id: "Review",
          resolvedVersion: "1.0",
          vulnerabilities: [{ severity, advisoryurl: "https://github.com/advisories/GHSA-review-level" }],
        }],
      }],
    }],
  });
  const moderate = run(["dotnet", write("nuget-moderate.json", JSON.stringify(body("moderate")))]);
  assert.equal(moderate.code, 0, moderate.out);
  const high = run(["dotnet", write("nuget-high.json", JSON.stringify(body("High")))]);
  assert.equal(high.code, 1, high.out);
  assert.match(high.out, /GHSA-review-level/);
});

const knownAdvisory = {
  severity: "high",
  url: `https://github.com/advisories/${fixtureKnown.npm.website[0].id}`,
  title: "known",
};

const mutationFixtures = {
  npm: {
    label: "website",
    body: {
      auditReportVersion: 2,
      metadata: { vulnerabilities: { total: 1 }, dependencies: { total: 1 } },
      vulnerabilities: { next: { severity: "high", via: ["next", knownAdvisory] } },
    },
  },
  dotnet: {
    label: "",
    body: {
      version: 1,
      parameters: "",
      sources: [],
      projects: [{
        path: "Review.csproj",
        frameworks: [{
          framework: "net10.0",
          topLevelPackages: [{
            id: "Review",
            resolvedVersion: "1.0",
            vulnerabilities: [{ severity: "moderate", advisoryurl: "https://github.com/advisories/GHSA-review-moderate" }],
          }],
          transitivePackages: [{
            id: "Transitive",
            resolvedVersion: "2.0",
            vulnerabilities: [{ severity: "low", advisoryurl: "https://github.com/advisories/GHSA-review-low" }],
          }],
        }],
      }],
    },
  },
  gitleaks: {
    label: "full-history",
    body: [{
      RuleID: "generic-api-key",
      File: "example.txt",
      StartLine: 1,
      Fingerprint: known.gitleaks[0].fingerprint,
      Commit: "abcdef0123456789",
    }],
  },
  semgrep: {
    label: "",
    body: {
      results: [{
        check_id: "javascript.lang.security.audit.detect-eval-with-expression.detect-eval-with-expression",
        path: "website/src/example.ts",
        start: { line: 12, col: 3 },
        extra: { severity: "WARNING", message: canary, lines: canary },
      }],
      errors: [{ level: "warn", path: "api/Example.cs", type: ["PartialParsing", []], message: canary }],
    },
  },
};

// Type-correct replacements that stay a clean report. Keyed by field path so a
// field added to consumedFields without a case here fails the suite.
const acceptedValues = {
  npm: {
    '["auditReportVersion"]': { number: 2 },
    '["metadata"]': { object: { note: "ok" } },
    '["vulnerabilities"]': { object: { lodash: { severity: "low", via: ["lodash"] } } },
    '["vulnerabilities","next"]': { object: { severity: "low", via: ["next"] } },
    '["vulnerabilities","next","severity"]': { string: "moderate" },
    '["vulnerabilities","next","via"]': { array: ["next"] },
    '["vulnerabilities","next","via",1]': { string: "next" },
    '["vulnerabilities","next","via",1,"severity"]': { string: "moderate" },
    '["vulnerabilities","next","via",1,"url"]': { string: knownAdvisory.url },
    '["vulnerabilities","next","via",1,"title"]': { string: "retitled" },
  },
  dotnet: {
    '["projects"]': { array: [] },
    '["projects",0]': { object: { path: "Review.csproj" } },
    '["projects",0,"path"]': { string: "Other.csproj" },
    '["projects",0,"frameworks"]': { array: [] },
    '["projects",0,"frameworks",0]': { object: { framework: "net10.0" } },
    '["projects",0,"frameworks",0,"topLevelPackages"]': { array: [] },
    '["projects",0,"frameworks",0,"transitivePackages"]': { array: [] },
    '["projects",0,"frameworks",0,"topLevelPackages",0]': { object: { id: "Review", resolvedVersion: "1.0" } },
    '["projects",0,"frameworks",0,"topLevelPackages",0,"id"]': { string: "Other" },
    '["projects",0,"frameworks",0,"topLevelPackages",0,"resolvedVersion"]': { string: "9.9" },
    '["projects",0,"frameworks",0,"topLevelPackages",0,"vulnerabilities"]': { array: [] },
    '["projects",0,"frameworks",0,"topLevelPackages",0,"vulnerabilities",0]': {
      object: { severity: "low", advisoryurl: "https://github.com/advisories/GHSA-review-low" },
    },
    '["projects",0,"frameworks",0,"topLevelPackages",0,"vulnerabilities",0,"severity"]': { string: "low" },
    '["projects",0,"frameworks",0,"topLevelPackages",0,"vulnerabilities",0,"advisoryurl"]': {
      string: "https://github.com/advisories/GHSA-review-moderate",
    },
  },
  gitleaks: {
    "": { array: mutationFixtures.gitleaks.body },
    "[0]": { object: mutationFixtures.gitleaks.body[0] },
    '[0,"RuleID"]': { string: "generic-api-key" },
    '[0,"File"]': { string: "other.txt" },
    '[0,"StartLine"]': { number: 2 },
    '[0,"Fingerprint"]': { string: known.gitleaks[0].fingerprint },
    '[0,"Commit"]': { string: "bbbbbbb0123456789" },
  },
  semgrep: {
    '["results"]': { array: [{
      check_id: "javascript.lang.security.audit.detect-eval-with-expression.detect-eval-with-expression",
      path: "website/src/example.ts",
      start: { line: 12 },
      extra: { severity: "WARNING" },
    }] },
    '["errors"]': { array: [] },
    '["errors",0]': { object: { level: "warn", path: "api/Example.cs", type: ["PartialParsing", []] } },
    '["errors",0,"level"]': { string: "warn" },
    '["errors",0,"path"]': { string: "api/Other.cs" },
    '["errors",0,"type"]': { array: ["PartialParsing", []] },
    '["errors",0,"type",0]': { string: "PartialParsing" },
    '["errors",0,"type",1]': { array: [] },
    '["results",0]': { object: {
      check_id: "javascript.lang.security.audit.detect-eval-with-expression.detect-eval-with-expression",
      path: "website/src/example.ts",
      start: { line: 12 },
      extra: { severity: "WARNING" },
    } },
    '["results",0,"check_id"]': { string: "javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop" },
    '["results",0,"path"]': { string: "studio/src/example.ts" },
    '["results",0,"start"]': { object: { line: 12 } },
    '["results",0,"start","line"]': { number: 12 },
    '["results",0,"extra"]': { object: { severity: "WARNING" } },
    '["results",0,"extra","severity"]': { string: "WARNING" },
  },
};

const wrongValues = { null: null, number: 1, string: "mutated", array: ["mutated"], object: { mutated: true } };
const mutationKinds = ["null", "number", "string", "array", "object"];

function loadConsumedFields() {
  const loader = `import { consumedFields } from ${JSON.stringify(pathToFileURL(gate).href)}; if (!consumedFields) process.exit(1); console.log(JSON.stringify(consumedFields));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", loader], { encoding: "utf8" });
  if (result.status !== 0) return { error: result.stderr || result.stdout || "the gate did not export consumedFields" };
  try {
    return { fields: JSON.parse(result.stdout) };
  } catch (error) {
    return { error: error.message };
  }
}

function applyMutation(root, specPath, value, remove) {
  if (specPath.length === 0) return remove ? null : structuredClone(value);
  const copy = structuredClone(root);
  let cursor = copy;
  for (let index = 0; index < specPath.length - 1; index += 1) cursor = cursor[specPath[index]];
  const last = specPath.at(-1);
  if (remove) {
    if (Array.isArray(cursor)) cursor.splice(last, 1);
    else delete cursor[last];
  } else cursor[last] = value;
  return copy;
}

function pathExists(root, specPath) {
  let cursor = root;
  for (const part of specPath) {
    if (cursor === null || typeof cursor !== "object" || !Object.hasOwn(cursor, part)) return false;
    cursor = cursor[part];
  }
  return true;
}

function sampleKey(specPath) {
  return specPath.length === 0 ? "" : JSON.stringify(specPath);
}

const loadedFields = loadConsumedFields();
const consumedFields = loadedFields.fields ?? {};

// A semgrep error rejection appends " (error i of n; level ...; type ...; path ...;
// rule ...)". That detail can contain the words error, level, type and path, so a
// field is matched only in the message before it. Lines without it are unchanged.
function withoutDetail(out) {
  return out.split("\n").map((line) => {
    const at = line.indexOf(" (error ");
    return at === -1 ? line : line.slice(0, at);
  }).join("\n");
}

const mutationCounts = {};

test("the gate exports the consumed field list", () => {
  assert.equal(loadedFields.error ?? "", "");
  assert.ok(loadedFields.fields);
});

for (const [tool, specs] of Object.entries(consumedFields)) {
  test(`${tool} mutations of every consumed field`, () => {
    const fixture = mutationFixtures[tool];
    assert.ok(fixture, `no fixture for ${tool}`);
    const samples = acceptedValues[tool];
    assert.ok(samples, `no mutation cases for ${tool}`);
    // The npm fixture's advisory is known only to the fixture allow-list.
    const runTool = tool === "npm" ? runFixture : run;
    const baseline = runTool([tool, write(`${tool}-mutation-base.json`, JSON.stringify(fixture.body)), fixture.label].filter((part, index) => index < 2 || part));
    assert.equal(baseline.code, 0, baseline.out);
    let count = 0;
    for (const spec of specs) {
      assert.ok(Array.isArray(spec.path), `${tool} ${spec.field} has no path`);
      assert.ok(Array.isArray(spec.accepts), `${tool} ${spec.field} has no accepted types`);
      assert.equal(typeof spec.optional, "boolean", `${tool} ${spec.field} has no optional flag`);
      const key = sampleKey(spec.path);
      if (!spec.absent) assert.equal(pathExists(fixture.body, spec.path), true, `${tool} ${key} is not in the fixture`);
      const sample = samples[key];
      if (spec.accepts.length > 0) assert.ok(sample, `no mutation case for ${tool} ${key}`);
      for (const kind of mutationKinds) {
        count += 1;
        const accepted = spec.accepts.includes(kind);
        if (accepted && (sample?.[kind] === undefined)) assert.fail(`no ${kind} mutation case for ${tool} ${key}`);
        const value = accepted ? sample[kind] : wrongValues[kind];
        const mutated = applyMutation(fixture.body, spec.path, value, false);
        const file = write(`${tool}-${count}-${kind}.json`, JSON.stringify(mutated));
        const result = runTool([tool, file, fixture.label].filter((part, index) => index < 2 || part));
        if (accepted) {
          assert.equal(result.code, 0, `${tool} ${key} ${kind}\n${result.out}`);
        } else {
          assert.equal(result.code, 1, `${tool} ${key} ${kind}\n${result.out}`);
          assert.ok(result.out.includes(file), `${tool} ${key} ${kind} did not name the file\n${result.out}`);
          assert.match(withoutDetail(result.out), new RegExp(`\\b${spec.field}\\b`), `${tool} ${key} ${kind} did not name the field\n${result.out}`);
        }
      }
      count += 1;
      const removed = applyMutation(fixture.body, spec.path, undefined, true);
      const removedFile = write(`${tool}-${count}-removed.json`, JSON.stringify(removed));
      const removedResult = runTool([tool, removedFile, fixture.label].filter((part, index) => index < 2 || part));
      if (spec.optional) {
        assert.equal(removedResult.code, 0, `${tool} ${key} removed\n${removedResult.out}`);
      } else {
        assert.equal(removedResult.code, 1, `${tool} ${key} removed\n${removedResult.out}`);
        assert.ok(removedResult.out.includes(removedFile), `${tool} ${key} removed did not name the file`);
        assert.match(withoutDetail(removedResult.out), new RegExp(`\\b${spec.field}\\b`), `${tool} ${key} removed did not name the field\n${removedResult.out}`);
      }
    }
    mutationCounts[tool] = count;
    assert.equal(count, specs.length * (mutationKinds.length + 1));
    console.log(`${tool} mutations: ${specs.length} fields, ${count} cases`);
  });
}

test("Codex's nine advisory mutations fail and name the file", () => {
  const clean = JSON.parse(cleanNpm);
  const npmEntry = (via) => ({ ...clean, vulnerabilities: { review: { severity: "high", via } } });
  const nugetBody = (vulnerabilities) => ({
    version: 1,
    parameters: "",
    sources: [],
    projects: [{
      path: "Review.csproj",
      frameworks: [{ framework: "net10.0", topLevelPackages: [{ id: "Review", resolvedVersion: "1.0", vulnerabilities }] }],
    }],
  });
  const knownLeak = known.gitleaks[0];
  const validLeak = {
    Fingerprint: knownLeak.fingerprint,
    RuleID: "generic-api-key",
    File: "example.txt",
    StartLine: 1,
    Commit: "abcdef0123456789",
    Secret: canary,
    Match: canary,
  };
  const cases = [
    ["new-npm-via-null-item", "npm", "studio", npmEntry([null])],
    ["new-npm-advisory-severity-object", "npm", "studio", npmEntry([{ severity: { value: "high" }, url: "https://github.com/advisories/GHSA-review-inner", title: "Review advisory" }])],
    ["new-npm-advisory-missing-severity", "npm", "studio", npmEntry([{ url: "https://github.com/advisories/GHSA-review-inner", title: "Review advisory" }])],
    ["new-nuget-advisory-severity-object", "dotnet", "", nugetBody([{ severity: { value: "High" }, advisoryurl: "https://github.com/advisories/GHSA-review-inner" }])],
    ["new-nuget-advisory-missing-severity", "dotnet", "", nugetBody([{ advisoryurl: "https://github.com/advisories/GHSA-review-inner" }])],
    ["new-nuget-transitive-null", "dotnet", "", { version: 1, parameters: "", sources: [], projects: [{ path: "Review.csproj", frameworks: [{ framework: "net10.0", transitivePackages: null }] }] }],
    ["new-gitleaks-line-string", "gitleaks", "full-history", [{ ...validLeak, StartLine: "1" }]],
    ["new-gitleaks-fingerprint-null", "gitleaks", "full-history", [{ ...validLeak, Fingerprint: null }]],
    ["new-gitleaks-commit-array", "gitleaks", "full-history", [{ ...validLeak, Commit: [] }]],
  ];
  assert.equal(cases.length, 9);
  for (const [name, tool, toolLabel, body] of cases) {
    const file = write(`${name}.json`, JSON.stringify(body));
    const result = run([tool, file, toolLabel].filter((part, index) => index < 2 || part));
    assert.equal(result.code, 1, `${name}\n${result.out}`);
    assert.ok(result.out.includes(file), name);
    assert.equal(result.out.includes(canary), false, name);
    assert.equal(result.out.includes("GHSA-review-inner"), false, name);
    assert.equal(result.out.includes("undefined"), false, name);
  }
});

test("confirm-npm-duplicate-vulnerabilities", () => {
  const clean = JSON.parse(cleanNpm);
  const highNpm = {
    ...clean,
    vulnerabilities: {
      review: {
        severity: "high",
        via: [{ severity: "high", url: "https://github.com/advisories/GHSA-review-duplicate", title: "Review advisory" }],
      },
    },
  };
  const text = `${JSON.stringify(highNpm).slice(0, -1)},"vulnerabilities":{}}`;
  const file = write("confirm-npm-duplicate-vulnerabilities.json", text);
  const result = run(["npm", file, "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /duplicate key vulnerabilities/);
  assert.ok(result.out.includes(file), result.out);
  assert.equal(result.out.includes("GHSA-review-duplicate"), false);
});

test("confirm-nuget-duplicate-projects", () => {
  const highDot = {
    version: 1,
    parameters: "",
    sources: [],
    projects: [{
      path: "Review.csproj",
      frameworks: [{
        framework: "net10.0",
        topLevelPackages: [{
          id: "Review",
          resolvedVersion: "1.0",
          vulnerabilities: [{ severity: "High", advisoryurl: "https://github.com/advisories/GHSA-review-duplicate" }],
        }],
      }],
    }],
  };
  const text = `${JSON.stringify(highDot).slice(0, -1)},"projects":[]}`;
  const file = write("confirm-nuget-duplicate-projects.json", text);
  const result = run(["dotnet", file]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /duplicate key projects/);
  assert.ok(result.out.includes(file), result.out);
  assert.equal(result.out.includes("GHSA-review-duplicate"), false);
});

test("a duplicate key nested inside an advisory fails and names the key", () => {
  const clean = JSON.parse(cleanNpm);
  const body = {
    ...clean,
    vulnerabilities: {
      review: {
        severity: "high",
        via: [{ severity: "high", url: "https://github.com/advisories/GHSA-review-nested", title: "Review advisory" }],
      },
    },
  };
  const text = JSON.stringify(body).replace(
    '"url":"https://github.com/advisories/GHSA-review-nested"',
    '"severity":"low","url":"https://github.com/advisories/GHSA-review-nested"',
  );
  const file = write("confirm-npm-duplicate-advisory-key.json", text);
  const result = run(["npm", file, "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /duplicate key severity/);
  assert.ok(result.out.includes(file), result.out);
  assert.equal(result.out.includes("GHSA-review-nested"), false);
});

test("confirm-npm-unknown-severity", () => {
  const clean = JSON.parse(cleanNpm);
  const urgent = {
    ...clean,
    vulnerabilities: {
      review: {
        severity: "high",
        via: [{ severity: "urgent", url: "https://github.com/advisories/GHSA-review-urgent", title: "Review advisory" }],
      },
    },
  };
  const file = write("confirm-npm-unknown-severity.json", JSON.stringify(urgent));
  const result = run(["npm", file, "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field severity is not a known value/);
  assert.ok(result.out.includes(file), result.out);
  assert.equal(result.out.includes("GHSA-review-urgent"), false);
  const upper = structuredClone(urgent);
  upper.vulnerabilities.review.severity = "HIGH";
  upper.vulnerabilities.review.via[0].severity = "high";
  const packageFile = write("confirm-npm-severity-case.json", JSON.stringify(upper));
  const packageResult = run(["npm", packageFile, "studio"]);
  assert.equal(packageResult.code, 1, packageResult.out);
  assert.match(packageResult.out, /field severity is not a known value/);
  const advisoryUpper = structuredClone(urgent);
  advisoryUpper.vulnerabilities.review.via[0].severity = "HIGH";
  const advisoryFile = write("confirm-npm-advisory-severity-case.json", JSON.stringify(advisoryUpper));
  const advisoryResult = run(["npm", advisoryFile, "studio"]);
  assert.equal(advisoryResult.code, 1, advisoryResult.out);
  assert.match(advisoryResult.out, /field severity is not a known value/);
});

test("confirm-gitleaks-line-negative", () => {
  const knownLeak = known.gitleaks[0];
  const validLeak = {
    Fingerprint: knownLeak.fingerprint,
    RuleID: "generic-api-key",
    File: "example.txt",
    StartLine: 1,
    Commit: "abcdef0123456789",
    Secret: canary,
    Match: canary,
  };
  const cases = [
    ["confirm-gitleaks-line-negative.json", -1],
    ["confirm-gitleaks-line-zero.json", 0],
    ["confirm-gitleaks-line-fraction.json", 1.5],
  ];
  for (const [name, line] of cases) {
    const file = write(name, JSON.stringify([{ ...validLeak, StartLine: line }]));
    const result = run(["gitleaks", file, "full-history"]);
    assert.equal(result.code, 1, `${name}\n${result.out}`);
    assert.match(result.out, /field StartLine is not a positive integer/);
    assert.ok(result.out.includes(file), name);
    assert.equal(result.out.includes(canary), false, name);
    assert.equal(result.out.includes("::warning"), false, name);
  }
  for (const [name, body] of [
    ["empty-fingerprint.json", { ...validLeak, Fingerprint: "" }],
    ["empty-rule.json", { ...validLeak, RuleID: "" }],
    ["empty-file.json", { ...validLeak, File: "" }],
    ["empty-commit.json", { ...validLeak, Commit: "" }],
  ]) {
    const file = write(name, JSON.stringify([body]));
    const result = run(["gitleaks", file, "full-history"]);
    assert.equal(result.code, 1, `${name}\n${result.out}`);
    assert.match(result.out, /is missing/);
    assert.ok(result.out.includes(file), name);
    assert.equal(result.out.includes(canary), false, name);
  }
});

function semgrepReport(results, errors = []) {
  return { results, errors };
}

function semgrepResult(severity, line = 4) {
  return {
    check_id: "csharp.lang.security.sqli.csharp-sqli",
    path: "api\\src\\Example.cs",
    start: { line, col: 1 },
    extra: { severity, message: canary, lines: canary, metavars: { $SQL: canary } },
  };
}

test("a semgrep WARNING is reported and does not fail, and matched source is not printed", () => {
  const file = write("semgrep-warning.json", JSON.stringify(semgrepReport([semgrepResult("WARNING")])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /semgrep warning: csharp\.lang\.security\.sqli\.csharp-sqli api\/src\/Example\.cs:4/);
  assert.match(result.out, /0 new/);
  assert.equal(result.out.includes(canary), false, result.out);
  assert.equal(result.out.includes("::error"), false, result.out);
});

test("a semgrep INFO does not fail and is not printed", () => {
  const file = write("semgrep-info.json", JSON.stringify(semgrepReport([semgrepResult("INFO")])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /0 new/);
  assert.equal(result.out.includes("Example.cs"), false, result.out);
  assert.equal(result.out.includes(canary), false, result.out);
});

test("a new semgrep ERROR fails and does not print the match", () => {
  const file = write("semgrep-error.json", JSON.stringify(semgrepReport([semgrepResult("ERROR"), semgrepResult("WARNING", 9)])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /::error title=New finding \(semgrep\)::csharp\.lang\.security\.sqli\.csharp-sqli in api\/src\/Example\.cs:4/);
  assert.match(result.out, /semgrep warning: csharp\.lang\.security\.sqli\.csharp-sqli api\/src\/Example\.cs:9/);
  assert.match(result.out, /1 new/);
  assert.equal(result.out.includes(canary), false, result.out);
});

test("a semgrep scan error fails and does not print the error body", () => {
  const file = write("semgrep-errors.json", JSON.stringify(semgrepReport([], [{ type: "Timeout", level: "error", message: canary }])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field level is not a parse warning/);
  assert.ok(result.out.includes(file), result.out);
  assert.equal(result.out.includes(canary), false, result.out);
});

const partialParse = ["PartialParsing", [{
  path: "api\\src\\Example.cs",
  start: { line: 301, col: 1, offset: 0 },
  end: { line: 301, col: 29, offset: 28 },
}]];

test("a semgrep PartialParsing warning prints the path and does not print the snippet", () => {
  const file = write("semgrep-parse.json", JSON.stringify(semgrepReport([], [{
    type: partialParse,
    level: "warn",
    path: "api\\src\\Example.cs",
    message: canary,
  }])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /semgrep parse warning: api\/src\/Example\.cs/);
  assert.equal(result.out.includes(canary), false, result.out);
});

for (const errorType of ["Timeout", "Out of memory", "Stack overflow", "Fatal error", "Rule parse error"]) {
  test(`a semgrep ${errorType} at warn level fails with zero results`, () => {
    const file = write(`semgrep-${errorType}.json`, JSON.stringify(semgrepReport([], [{
      type: errorType,
      level: "warn",
      path: "api\\src\\Example.cs",
      message: canary,
    }])));
    const result = run(["semgrep", file]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /field type is not a partial parse/);
    assert.ok(result.out.includes(file), result.out);
    assert.equal(result.out.includes(canary), false, result.out);
    assert.equal(result.out.includes("semgrep parse warning"), false, result.out);
  });
}

test("an unknown semgrep error type fails", () => {
  const file = write("semgrep-unknown-type.json", JSON.stringify(semgrepReport([], [{
    type: "NotARealSemgrepError",
    level: "warn",
    path: "api\\src\\Example.cs",
    message: canary,
  }])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field type is not a partial parse/);
  assert.equal(result.out.includes(canary), false, result.out);
});

test("a semgrep error with no type fails", () => {
  const file = write("semgrep-missing-type.json", JSON.stringify(semgrepReport([], [{
    level: "warn",
    path: "api\\src\\Example.cs",
    message: canary,
  }])));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /field type is not a partial parse/);
  assert.equal(result.out.includes(canary), false, result.out);
});

test("a malformed semgrep PartialParsing type fails", () => {
  for (const type of ["PartialParsing", ["PartialParsing"], ["PartialParsing", "locations"]]) {
    const file = write(`semgrep-malformed-${JSON.stringify(type).length}.json`, JSON.stringify(semgrepReport([], [{
      type,
      level: "warn",
      path: "api\\src\\Example.cs",
      message: canary,
    }])));
    const result = run(["semgrep", file]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /field type is not a partial parse/);
    assert.equal(result.out.includes(canary), false, result.out);
  }
});

// A rejected semgrep error is described by its position, level, type tag, path and
// rule. Every fixture carries the canary in message, spans and, for an array type,
// type[1]; none of them may reach the output, and no output line may start a
// workflow command.
function semgrepErrorRun(name, errors) {
  const file = write(`semgrep-detail-${name}.json`, JSON.stringify(semgrepReport([], errors)));
  const result = run(["semgrep", file]);
  assert.equal(result.code, 1, `${name}\n${result.out}`);
  assert.ok(result.out.includes(file), `${name} did not name the file\n${result.out}`);
  assert.equal(result.out.includes(canary), false, `${name}\n${result.out}`);
  assert.equal(result.out.split("\n").some((line) => line.startsWith("::")), false, `${name}\n${result.out}`);
  return result;
}

function semgrepError(fields) {
  return { message: canary, spans: [{ file: canary, start: { line: 1, col: 1 } }], ...fields };
}

const detailParse = ["PartialParsing", [{ path: canary, start: { line: 1, col: 1, offset: 0 } }]];

test("a rejected semgrep error names its type, path and rule", () => {
  const result = semgrepErrorRun("n1", [semgrepError({
    level: "warn",
    type: "Timeout",
    path: "website\\src\\app\\[[...path]]\\page.tsx",
    rule_id: "javascript.lang.security.audit.example",
  })]);
  assert.match(result.out, /field type is not a partial parse/);
  assert.ok(result.out.includes("(error 1 of 1; level warn; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)"), result.out);
});

test("a rejected tagged semgrep error names only its tag", () => {
  const result = semgrepErrorRun("n2", [semgrepError({
    level: "warn",
    type: ["PatternParseError", [canary]],
    path: "api\\src\\Example.cs",
  })]);
  assert.match(result.out, /field type is not a partial parse/);
  assert.ok(result.out.includes("type PatternParseError; path api/src/Example.cs; rule (none))"), result.out);
});

test("a rejected semgrep error gives its position", () => {
  const result = semgrepErrorRun("n3", [
    semgrepError({ level: "warn", type: detailParse, path: "api\\src\\Example.cs" }),
    semgrepError({ level: "warn", type: "Timeout", path: "api\\src\\Example.cs" }),
  ]);
  assert.match(result.out, /field type is not a partial parse/);
  assert.ok(result.out.includes("(error 2 of 2; level warn; type Timeout;"), result.out);
});

test("a semgrep level rejection names the error and its level", () => {
  const result = semgrepErrorRun("n4", [semgrepError({ level: "error", type: "Timeout" })]);
  assert.match(result.out, /field level is not a parse warning/);
  assert.ok(result.out.includes("(error 1 of 1; level error; type Timeout; path (none); rule (none))"), result.out);
});

test("hostile semgrep error types and levels are shown as unrecognised", () => {
  const types = [
    "Timeout\n::error::injected",
    "::error::injected",
    "T".repeat(65),
    "Out;of(memory)",
    "Tïmeout",
    42,
    null,
    {},
    [],
    [42, [canary]],
    ["::error::injected", [canary]],
  ];
  types.forEach((type, index) => {
    const result = semgrepErrorRun(`n5-type-${index}`, [semgrepError({ level: "warn", type, path: "api\\src\\Example.cs" })]);
    assert.match(result.out, /field type is not a partial parse/);
    assert.ok(result.out.includes("type (unrecognised);"), `type ${index}\n${result.out}`);
    assert.equal(result.out.includes("injected"), false, `type ${index}\n${result.out}`);
  });
  const levels = ["error\n::error::injected", "::error::injected", "e".repeat(65), 42, null, {}];
  levels.forEach((level, index) => {
    const result = semgrepErrorRun(`n5-level-${index}`, [semgrepError({ level, type: "Timeout", path: "api\\src\\Example.cs" })]);
    assert.match(result.out, /field level is not a parse warning/);
    assert.ok(result.out.includes("level (unrecognised);"), `level ${index}\n${result.out}`);
    assert.equal(result.out.includes("injected"), false, `level ${index}\n${result.out}`);
  });
});

test("hostile semgrep error paths and rules are shown as unrecognised", () => {
  const strings = ["a\n::error::injected", "a::error::injected", "a".repeat(241), "a;b", "a(b)", "a b"];
  strings.forEach((errorPath, index) => {
    const result = semgrepErrorRun(`n6-path-${index}`, [semgrepError({ level: "warn", type: "Timeout", path: errorPath })]);
    assert.match(result.out, /field type is not a partial parse/);
    assert.ok(result.out.includes("; path (unrecognised); rule (none))"), `path ${index}\n${result.out}`);
    assert.equal(result.out.includes("injected"), false, `path ${index}\n${result.out}`);
  });
  ["", 42, {}, null].forEach((errorPath, index) => {
    const result = semgrepErrorRun(`n6-missing-path-${index}`, [semgrepError({ level: "warn", type: "Timeout", path: errorPath })]);
    assert.match(result.out, /field path is missing/);
    assert.ok(result.out.includes("; path (unrecognised); rule (none))"), `missing path ${index}\n${result.out}`);
  });
  [...strings, "r".repeat(201), 42, {}, null].forEach((rule, index) => {
    const result = semgrepErrorRun(`n6-rule-${index}`, [semgrepError({ level: "warn", type: "Timeout", path: "api\\src\\Example.cs", rule_id: rule })]);
    assert.match(result.out, /field type is not a partial parse/);
    assert.ok(result.out.includes("; path api/src/Example.cs; rule (unrecognised))"), `rule ${index}\n${result.out}`);
    assert.equal(result.out.includes("injected"), false, `rule ${index}\n${result.out}`);
  });
});

test("a rejected semgrep error at the length limits is shown", () => {
  const level = "l".repeat(64);
  const tag = "T".repeat(64);
  const longPath = `${"a/".repeat(119)}bc`;
  const rule = "r".repeat(200);
  assert.equal(longPath.length, 240);
  const result = semgrepErrorRun("n7", [semgrepError({ level, type: [tag, [canary]], path: longPath, rule_id: rule })]);
  assert.match(result.out, /field level is not a parse warning/);
  assert.ok(result.out.includes(`(error 1 of 1; level ${level}; type ${tag}; path ${longPath}; rule ${rule})`), result.out);
});

test("a semgrep error with no path names its type and rule", () => {
  const result = semgrepErrorRun("n8", [semgrepError({ level: "warn", type: "Timeout", rule_id: "csharp.example.rule" })]);
  assert.match(result.out, /field path is missing/);
  assert.ok(result.out.includes("(error 1 of 1; level warn; type Timeout; path (none); rule csharp.example.rule)"), result.out);
});

test("a semgrep error that is not an object gives its position only", () => {
  const result = semgrepErrorRun("n9", [
    semgrepError({ level: "warn", type: detailParse, path: "api\\src\\Example.cs" }),
    semgrepError({ level: "warn", type: detailParse, path: "api\\src\\Example.cs" }),
    "x",
  ]);
  assert.match(result.out, /field error is not an object/);
  assert.match(result.out, /error is not an object \(error 3 of 3\)$/m);
});

test("a malformed PartialParsing type is marked as malformed", () => {
  ["PartialParsing", ["PartialParsing"], ["PartialParsing", "locations"]].forEach((type, index) => {
    const result = semgrepErrorRun(`n10-${index}`, [semgrepError({ level: "warn", type, path: "api\\src\\Example.cs" })]);
    assert.match(result.out, /field type is not a partial parse/);
    assert.ok(result.out.includes("(error 1 of 1; level warn; type PartialParsing (malformed); path api/src/Example.cs; rule (none))"), `${index}\n${result.out}`);
  });
  const result = semgrepErrorRun("n10-level", [semgrepError({ level: "error", type: detailParse, path: "api\\src\\Example.cs" })]);
  assert.match(result.out, /field level is not a parse warning/);
  assert.ok(result.out.includes("type PartialParsing; path api/src/Example.cs;"), result.out);
});

const requiredRoots = [
  "api",
  "website/src",
  "website/scripts",
  "website/behaviors",
  "website/test",
  "website/tools",
  "website/next.config.ts",
  "website/vitest.config.ts",
  "studio/src",
  "studio/scripts",
  "studio/vite",
  "studio/test",
  "studio/e2e",
  "studio/vite.config.ts",
  "studio/vitest.config.ts",
  "studio/playwright.config.ts",
  "packages",
  ".github/security",
];

const requiredPacks = ["p/javascript", "p/typescript", "p/csharp", "p/owasp-top-ten", "p/secrets"];

const requiredExcludes = [
  "node_modules",
  "bin",
  "obj",
  "dist",
  "out",
  "website/design",
  "website/fixtures",
  '"*.Designer.cs"',
  '"*ModelSnapshot.cs"',
  "generated",
];

// One line, exactly. A new command has to be added here in the same commit.
const securityRunAllowList = [
  "node --test .github/security/gate.test.mjs",
  "bash ../.github/security/run-npm-audit.sh ${{ matrix.app }}",
  "dotnet restore DigitalHub.slnx",
  "bash ../.github/security/run-dotnet-audit.sh",
  "bash .github/security/install-gitleaks.sh",
  "bash .github/security/run-gitleaks.sh pr-diff \"$RUNNER_TEMP/gitleaks-pr.json\" \"${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}\"",
  "bash .github/security/run-gitleaks.sh full-history \"$RUNNER_TEMP/gitleaks-history.json\" \"--all\"",
  "pip install \"semgrep==1.180.0\"",
  "bash .github/security/run-semgrep.sh",
  "node .github/security/redact-report.mjs \"$RUNNER_TEMP/semgrep.json\" \"$RUNNER_TEMP/semgrep-redacted.json\"",
];

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

function goldenDifference(label, goldenPath, actual, expected) {
  const left = normalizeNewlines(actual);
  const right = normalizeNewlines(expected);
  if (left === right) return null;
  const actualLines = left.split("\n");
  const expectedLines = right.split("\n");
  const count = Math.max(actualLines.length, expectedLines.length);
  let line = count;
  for (let index = 0; index < count; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      line = index + 1;
      break;
    }
  }
  return `${label} is not the golden copy: differs from ${goldenPath} at line ${line}; update both files in the same commit`;
}

// One line per script the npm, NuGet, and gitleaks jobs run. A new *.sh under
// .github/security is added here, or named in scriptExemptions. run-semgrep.sh
// stays exempt because semgrepShapeProblems already pins it.
const pinnedScripts = [
  ["run-npm-audit.sh", "run-npm-audit.expected.sh"],
  ["run-dotnet-audit.sh", "run-dotnet-audit.expected.sh"],
  ["run-gitleaks.sh", "run-gitleaks.expected.sh"],
  ["install-gitleaks.sh", "install-gitleaks.expected.sh"],
];
const scriptExemptions = ["run-semgrep.sh", "run-semgrep.expected.sh"];

function shellPinProblems(directory, extraNames = [], overlays = {}) {
  const problems = [];
  const names = [...fs.readdirSync(directory).filter((name) => name.endsWith(".sh")), ...extraNames];
  const pinned = new Set(pinnedScripts.map(([script]) => script));
  const exempt = new Set([...scriptExemptions, ...pinnedScripts.map(([, golden]) => golden)]);
  for (const name of names) {
    if (!pinned.has(name) && !exempt.has(name)) problems.push(`${name} is neither pinned nor exempt`);
  }
  for (const [script, golden] of pinnedScripts) {
    const raw = Object.hasOwn(overlays, script)
      ? overlays[script](fs.readFileSync(path.join(directory, script), "utf8"))
      : fs.readFileSync(path.join(directory, script), "utf8");
    const expected = fs.readFileSync(path.join(here, golden), "utf8");
    const problem = goldenDifference(script, `.github/security/${golden}`, raw, expected);
    if (problem) problems.push(problem);
  }
  return problems;
}

function attributesPinProblems(overlay = (text) => text) {
  const actual = overlay(fs.readFileSync(path.join(here, "..", "..", ".gitattributes"), "utf8"));
  const expected = fs.readFileSync(path.join(here, "gitattributes.expected"), "utf8");
  const problem = goldenDifference(".gitattributes", ".github/security/gitattributes.expected", actual, expected);
  return problem ? [problem] : [];
}

function knownFindingEntries(value, trail = "") {
  if (Array.isArray(value)) return value.flatMap((item, index) => knownFindingEntries(item, `${trail}[${index}]`));
  if (value && typeof value === "object") {
    if (Object.hasOwn(value, "id") || Object.hasOwn(value, "fingerprint")) return [[trail, value]];
    return Object.entries(value).flatMap(([key, child]) => (
      key === "description" ? [] : knownFindingEntries(child, trail ? `${trail}.${key}` : key)
    ));
  }
  return [];
}

function knownFindingProblems(document) {
  const problems = [];
  for (const [trail, entry] of knownFindingEntries(document)) {
    if (typeof entry.owner !== "string" || entry.owner.trim() === "") problems.push(`${trail} has no owner`);
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") problems.push(`${trail} has no reason`);
  }
  return problems;
}

function semgrepJobText(workflow) {
  const normalized = normalizeNewlines(workflow);
  const marker = "\n  semgrep:\n";
  const start = normalized.indexOf(marker);
  if (start < 0) return "";
  const job = normalized.slice(start + 1);
  return job.endsWith("\n") ? job : `${job}\n`;
}

function continuedValue(line) {
  return line.trim().replace(/ \\$/, "");
}

function runAllowListProblems(workflow) {
  const problems = [];
  const normalized = normalizeNewlines(workflow);
  for (const line of normalized.split("\n")) {
    const match = line.match(/^ +(?:- )?run: (.*)$/);
    if (!match) continue;
    if (!securityRunAllowList.includes(match[1])) problems.push(`run is not on the allow-list: ${match[1]}`);
  }
  try {
    for (const command of collectRunCommands(parseWorkflowYaml(normalized))) {
      if (!securityRunAllowList.includes(command)) problems.push(`run is not on the allow-list: ${command}`);
    }
  } catch (error) {
    problems.push(`workflow YAML could not be parsed: ${error.message}`);
  }
  return problems;
}

function semgrepShapeProblems(workflow, script) {
  const problems = [];
  const normalizedWorkflow = normalizeNewlines(workflow);
  const normalizedScript = normalizeNewlines(script);
  const job = semgrepJobText(normalizedWorkflow);
  const expectedWorkflow = normalizeNewlines(fs.readFileSync(path.join(here, "security.expected.yml"), "utf8"));
  const expectedJobText = normalizeNewlines(fs.readFileSync(path.join(here, "semgrep-job.expected.yml"), "utf8"));
  const expectedScript = normalizeNewlines(fs.readFileSync(path.join(here, "run-semgrep.expected.sh"), "utf8"));
  const workflowProblem = goldenDifference("security.yml", ".github/security/security.expected.yml", normalizedWorkflow, expectedWorkflow);
  if (workflowProblem) problems.push(workflowProblem);
  let parsedJob = null;
  let expectedJob = null;
  try {
    const parsed = parseWorkflowYaml(normalizedWorkflow);
    parsedJob = parsed && parsed.jobs ? parsed.jobs.semgrep : null;
    expectedJob = parseWorkflowYaml(expectedJobText).semgrep;
  } catch (error) {
    problems.push(`workflow YAML could not be parsed: ${error.message}`);
  }
  if (parsedJob == null) problems.push("jobs.semgrep is missing");
  else if (expectedJob != null && JSON.stringify(parsedJob) !== JSON.stringify(expectedJob)) problems.push("jobs.semgrep is not the golden job");
  const scriptProblem = goldenDifference("run-semgrep.sh", ".github/security/run-semgrep.expected.sh", normalizedScript, expectedScript);
  if (scriptProblem) problems.push(scriptProblem);
  if (normalizedWorkflow.includes("SEMGREP_ROOTS")) problems.push("SEMGREP_ROOTS is set in the workflow");
  if (/(^|\n)[ ]+if:/.test(job)) problems.push("semgrep job has an if");
  if (job.includes("continue-on-error")) problems.push("semgrep job has continue-on-error");
  if (/(^|\n)[ ]+env:/.test(job)) problems.push("semgrep job has an env block");
  const scanCalls = normalizedWorkflow.split("\n").filter((line) => line.includes("bash .github/security/run-semgrep.sh"));
  if (scanCalls.length !== 1) problems.push(`expected one run-semgrep.sh call, found ${scanCalls.length}`);
  const versionPins = normalizedWorkflow.split("\n").filter((line) => line.includes("pip install \"semgrep==1.180.0\""));
  if (versionPins.length !== 1) problems.push(`expected one Semgrep 1.180.0 pin, found ${versionPins.length}`);
  for (const line of normalizedWorkflow.split("\n")) {
    const trimmed = line.trim();
    const isRun = trimmed.startsWith("run:") || trimmed.startsWith("- run:");
    const isSemgrepCommand = trimmed.startsWith("semgrep ");
    if (!isRun && !isSemgrepCommand) continue;
    if (trimmed === "run: bash .github/security/run-semgrep.sh") continue;
    if (trimmed.startsWith("run: node .github/security/redact-report.mjs ")) continue;
    if (trimmed === "run: pip install \"semgrep==1.180.0\"") continue;
    if (/semgrep/.test(trimmed)) problems.push(`workflow has another semgrep command: ${trimmed}`);
  }
  problems.push(...runAllowListProblems(normalizedWorkflow));
  if ((normalizedScript.match(/semgrep scan/g) ?? []).length !== 1) problems.push("run-semgrep.sh must contain exactly one semgrep scan");
  if ((normalizedScript.match(/^\s*semgrep \\$/gm) ?? []).length !== 0) problems.push("run-semgrep.sh has a continued semgrep invocation");
  if (normalizedScript.includes("|| true")) problems.push("run-semgrep.sh contains || true");
  if (normalizedScript.includes("-o ") || normalizedScript.includes("\n  -o ")) problems.push("run-semgrep.sh uses -o");
  if (normalizedScript.includes("$SEMGREP_ROOTS") || normalizedScript.includes("SEMGREP_ROOTS=")) problems.push("run-semgrep.sh reads SEMGREP_ROOTS");
  if (!normalizedScript.includes("set +e\n") || !normalizedScript.includes("\ncode=$?\nset -e\n") || !normalizedScript.includes("if [ \"$code\" -gt 1 ]; then")) {
    problems.push("run-semgrep.sh does not keep the set +e exit check");
  }
  const lines = normalizedScript.split("\n");
  const start = lines.indexOf("semgrep scan \\");
  const end = lines.indexOf("code=$?");
  const scanLines = start >= 0 && end > start ? lines.slice(start, end) : [];
  const packs = scanLines.filter((line) => line.trim().startsWith("--config ")).map((line) => continuedValue(line).slice("--config ".length));
  const excludes = scanLines.filter((line) => line.trim().startsWith("--exclude ")).map((line) => continuedValue(line).slice("--exclude ".length));
  const knownFlags = new Set([
    "semgrep scan \\",
    "--metrics=off \\",
    "--disable-version-check \\",
    "--quiet \\",
    "--json \\",
    "--output \"$RUNNER_TEMP/semgrep.json\" \\",
  ]);
  const roots = scanLines
    .filter((line) => !knownFlags.has(line.trim()) && !line.trim().startsWith("--config ") && !line.trim().startsWith("--exclude "))
    .map((line) => continuedValue(line));
  if (JSON.stringify(packs) !== JSON.stringify(requiredPacks)) problems.push(`packs are ${packs.join(" ")}`);
  if (JSON.stringify(excludes) !== JSON.stringify(requiredExcludes)) problems.push(`excludes are ${excludes.join(" ")}`);
  if (JSON.stringify(roots) !== JSON.stringify(requiredRoots)) problems.push(`roots are ${roots.join(" ")}`);
  return problems;
}

function inlineInterpreterProblems() {
  const problems = [];
  const directory = path.join(here, "..", "workflows");
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith(".yml")) continue;
    const text = fs.readFileSync(path.join(directory, name), "utf8");
    if (/node\s+(?:--input-type=\S+\s+)?-e\b/.test(text) || text.includes("--input-type=module")) problems.push(`${name} has inline node`);
    if (/python3?\s+-c\b/.test(text)) problems.push(`${name} has inline python`);
  }
  return problems;
}

const workflowPath = path.join(here, "..", "workflows", "security.yml");
const scriptPath = path.join(here, "run-semgrep.sh");

test("the semgrep job and scan script match their golden copies", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const script = fs.readFileSync(scriptPath, "utf8");
  assert.deepEqual(semgrepShapeProblems(workflow, script), []);
  assert.deepEqual(inlineInterpreterProblems(), []);
  const ignore = fs.readFileSync(path.join(here, "..", "..", ".semgrepignore"), "utf8");
  const expectedIgnore = fs.readFileSync(path.join(here, "semgrepignore.expected"), "utf8");
  assert.equal(goldenDifference(".semgrepignore", ".github/security/semgrepignore.expected", ignore, expectedIgnore), null);
  const ignoreText = normalizeNewlines(ignore);
  for (const root of requiredRoots) {
    assert.equal(ignoreText.split("\n").some((line) => {
      const trimmed = line.trim();
      return trimmed === root || trimmed === `${root}/`;
    }), false, `${root} is excluded by .semgrepignore`);
  }
  for (const pattern of ["*.cs", "*.tsx", "studio/src/**"]) {
    assert.equal(ignoreText.split("\n").some((line) => line.trim() === pattern), false, `${pattern} is excluded by .semgrepignore`);
  }
});

const packRuleIds = [
  "javascript.lang.security.detect-eval-with-expression.detect-eval-with-expression",
  "typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml",
  "csharp.lang.security.insecure-deserialization.binary-formatter.insecure-binaryformatter-deserialization",
  "javascript.express.security.audit.express-session-hardcoded-secret.express-session-hardcoded-secret",
  "javascript.browser.security.open-redirect.js-open-redirect",
];

test("the five WARNING rules that fail the gate are exactly the pack ids", () => {
  const listed = JSON.parse(fs.readFileSync(path.join(here, "fail-on-rules.json"), "utf8"));
  assert.deepEqual(listed, packRuleIds);
  assert.deepEqual([...semgrepFailOnRules], packRuleIds);
});

test("a listed WARNING fails, and any other WARNING is only printed", () => {
  for (const rule of packRuleIds) {
    const body = semgrepResult("WARNING");
    body.check_id = rule;
    const file = write(`fail-${rule}.json`, JSON.stringify(semgrepReport([body])));
    const result = run(["semgrep", file]);
    assert.equal(result.code, 1, `${rule}\n${result.out}`);
    assert.match(result.out, /::error title=New finding \(semgrep\)::/);
    assert.equal(result.out.includes(canary), false, rule);
  }
  const plain = semgrepResult("WARNING");
  plain.check_id = "javascript.lang.security.audit.detect-child-process.detect-child-process";
  const printed = run(["semgrep", write("plain-warning.json", JSON.stringify(semgrepReport([plain])))]);
  assert.equal(printed.code, 0, printed.out);
  assert.match(printed.out, /semgrep warning: javascript\.lang\.security\.audit\.detect-child-process\.detect-child-process api\/src\/Example\.cs:4/);
  assert.equal(printed.out.includes("::error"), false, printed.out);
});

test("a listed WARNING that matches a known finding does not fail", () => {
  const rule = packRuleIds[0];
  const item = {
    id: `${rule}:api/src/Example.cs:4`,
    rule,
    file: "api/src/Example.cs",
    line: 4,
    severity: "WARNING",
  };
  assert.equal(semgrepCounted(item), true);
  assert.equal([item].filter((entry) => semgrepCounted(entry) && !new Set([item.id]).has(entry.id)).length, 0);
  const other = { ...item, rule: "javascript.lang.security.audit.detect-child-process.detect-child-process", severity: "WARNING" };
  assert.equal(semgrepCounted(other), false);
});

test("a run that is not on the allow-list is rejected", () => {
  const block = runAllowListProblems("jobs:\n  example:\n    steps:\n      - run: echo skipped\n");
  assert.ok(block.some((problem) => problem.includes("echo skipped")), block.join("\n"));
  const flow = runAllowListProblems("jobs:\n  example:\n    steps:\n      - { name: Skip, run: \"echo skipped\" }\n");
  assert.ok(flow.some((problem) => problem.includes("echo skipped")), flow.join("\n"));
  assert.deepEqual(runAllowListProblems(fs.readFileSync(workflowPath, "utf8")), []);
});

test("hiding the semgrep job in a block scalar is rejected", () => {
  const workflow = normalizeNewlines(fs.readFileSync(workflowPath, "utf8"));
  const marker = "\n  semgrep:\n";
  const start = workflow.indexOf(marker);
  const job = workflow.slice(start + 1);
  const hidden = `${workflow.slice(0, start + 1).replace("\nname: Security\n", "\n")}name: |2\n${job}`;
  const problems = semgrepShapeProblems(hidden, fs.readFileSync(scriptPath, "utf8"));
  assert.ok(problems.includes("jobs.semgrep is missing"), problems.join("\n"));
});

test("a security.yml that differs by one character is not the golden copy", () => {
  const workflow = normalizeNewlines(fs.readFileSync(workflowPath, "utf8"));
  const script = normalizeNewlines(fs.readFileSync(scriptPath, "utf8"));
  const marker = "name: Security";
  const index = workflow.indexOf(marker);
  assert.ok(index >= 0);
  const changed = `${workflow.slice(0, index)}name: SecuritY${workflow.slice(index + marker.length)}`;
  const problems = semgrepShapeProblems(changed, script);
  assert.ok(problems.some((problem) => /^security\.yml is not the golden copy: differs from \.github\/security\/security\.expected\.yml at line \d+; update both files in the same commit$/.test(problem)), problems.join("\n"));
});

test("every shell script under .github/security is pinned", () => {
  assert.deepEqual(shellPinProblems(here), []);
  const extra = shellPinProblems(here, ["unpinned-proof.sh"]);
  assert.ok(extra.some((problem) => problem === "unpinned-proof.sh is neither pinned nor exempt"), extra.join("\n"));
});

test("exit 0 after the shebang is not a pinned script", () => {
  for (const [script] of pinnedScripts) {
    const problems = shellPinProblems(here, [], {
      [script]: (text) => text.replace(/^(#!\/bin\/sh\r?\n)/, "$1exit 0\n"),
    });
    assert.ok(problems.some((problem) => problem.startsWith(`${script} is not the golden copy: differs from .github/security/${script.replace(/\.sh$/, ".expected.sh")} at line `) && problem.endsWith("; update both files in the same commit")), `${script}\n${problems.join("\n")}`);
  }
});

test("a skipped gitleaks checksum is not the golden script", () => {
  const problems = shellPinProblems(here, [], {
    "install-gitleaks.sh": (text) => text.replace(
      "echo \"${GITLEAKS_SHA256}  $RUNNER_TEMP/$file\" | sha256sum --check --strict",
      "true || sha256sum --check --strict",
    ),
  });
  assert.ok(problems.some((problem) => problem.startsWith("install-gitleaks.sh is not the golden copy: differs from .github/security/install-gitleaks.expected.sh at line ") && problem.endsWith("; update both files in the same commit")), problems.join("\n"));
});

test("the line-ending attributes match their golden copy", () => {
  assert.deepEqual(attributesPinProblems(), []);
  const problems = attributesPinProblems((text) => text.replace("*.sh text eol=lf", "*.sh text eol=crlf"));
  assert.ok(problems.some((problem) => problem.startsWith(".gitattributes is not the golden copy: differs from .github/security/gitattributes.expected at line ") && problem.endsWith("; update both files in the same commit")), problems.join("\n"));
});

test("every known finding has an owner and a reason", () => {
  assert.ok(knownFindingEntries(known).length > 0);
  assert.deepEqual(knownFindingProblems(known), []);
  const stripped = structuredClone(known);
  delete stripped.semgrep[0].owner;
  stripped.semgrep[0].reason = "  ";
  const problems = knownFindingProblems(stripped);
  assert.ok(problems.some((problem) => problem.includes("has no owner")), problems.join("\n"));
  assert.ok(problems.some((problem) => problem.includes("has no reason")), problems.join("\n"));
});

test("the redactor matches its golden copy", () => {
  const source = fs.readFileSync(path.join(here, "redact-report.mjs"), "utf8");
  const expected = fs.readFileSync(path.join(here, "redact-report.expected.mjs"), "utf8");
  assert.equal(goldenDifference("redact-report.mjs", ".github/security/redact-report.expected.mjs", source, expected), null);
});

test("the redactor drops canary fields", () => {
  const redactor = path.join(here, "redact-report.mjs");
  const report = {
    results: [
      {
        check_id: "rule.one",
        path: "a.js",
        start: { line: 2 },
        extra: { severity: "WARNING", lines: canary, metavars: { $X: canary }, message: canary },
      },
      {
        check_id: "rule.two",
        path: "b.cs",
        start: { line: 9 },
        extra: { severity: "ERROR", lines: canary, metavars: canary, message: canary },
      },
    ],
    errors: [
      { message: canary, type: "Timeout", extra: { lines: canary } },
      { message: canary, path: "c.js" },
    ],
  };
  const input = write("redactor-canary.json", JSON.stringify(report));
  const output = path.join(dir, "redactor-canary-out.json");
  const ran = spawnSync(process.execPath, [redactor, input, output], { encoding: "utf8" });
  assert.equal(ran.status, 0, `${ran.stdout}\n${ran.stderr}`);
  const redacted = fs.readFileSync(output, "utf8");
  assert.equal(redacted.includes(canary), false, redacted);
  const parsed = JSON.parse(redacted);
  assert.deepEqual(parsed.results.map((result) => result.extra), [{ severity: "WARNING" }, { severity: "ERROR" }]);
  assert.deepEqual(parsed.errors, [{ type: "redacted" }, { type: "redacted" }]);
  assert.deepEqual(Object.keys(parsed.results[0]).sort(), ["check_id", "extra", "path", "start"]);
});

const shapeMutations = [
  ["second-scan-same-output", true, (files) => ({
    ...files,
    script: files.script.replace(
      "node .github/security/gate.mjs semgrep \"$RUNNER_TEMP/semgrep.json\"\n",
      "node .github/security/gate.mjs semgrep \"$RUNNER_TEMP/semgrep.json\"\nsemgrep scan --config p/javascript --quiet --json --output \"$RUNNER_TEMP/semgrep.json\" website/src\n",
    ),
  })],
  ["scan-step-if-false", false, (files) => ({
    ...files,
    workflow: files.workflow.replace(
      "      - name: Scan\n        run: bash .github/security/run-semgrep.sh\n",
      "      - name: Scan\n        if: false\n        run: bash .github/security/run-semgrep.sh\n",
    ),
  })],
  ["scan-step-if-event", false, (files) => ({
    ...files,
    workflow: files.workflow.replace(
      "      - name: Scan\n        run: bash .github/security/run-semgrep.sh\n",
      "      - name: Scan\n        if: github.event_name == 'push'\n        run: bash .github/security/run-semgrep.sh\n",
    ),
  })],
  ["second-step-other-output", true, (files) => ({
    ...files,
    workflow: files.workflow.replace(
      "        run: bash .github/security/run-semgrep.sh\n",
      "        run: bash .github/security/run-semgrep.sh\n      - name: Scan again\n        run: semgrep scan --json --output \"$RUNNER_TEMP/other.json\" website/src\n",
    ),
  })],
  ["include-filter", false, (files) => ({
    ...files,
    script: files.script.replace("  --exclude generated \\\n", "  --exclude generated \\\n  --include '*.cs' \\\n"),
  })],
  ["exclude-new-root", false, (files) => ({
    ...files,
    script: files.script.replace("  --exclude generated \\\n", "  --exclude generated \\\n  --exclude studio/vite \\\n"),
  })],
  ["exclude-all", false, (files) => ({
    ...files,
    script: files.script.replace("  --exclude generated \\\n", "  --exclude generated \\\n  --exclude '*' \\\n"),
  })],
  ["continue-on-error", false, (files) => ({
    ...files,
    workflow: files.workflow.replace(
      "      - name: Scan\n        run: bash .github/security/run-semgrep.sh\n",
      "      - name: Scan\n        continue-on-error: true\n        run: bash .github/security/run-semgrep.sh\n",
    ),
  })],
  ["step-shell-redefine-roots", false, (files) => ({
    ...files,
    script: files.script.replace("set +e\n", "set +e\nSEMGREP_ROOTS=website/src\n").replace(
      /  api \\\n(?:  .*\n)*?  \.github\/security\n/,
      "  $SEMGREP_ROOTS\n",
    ),
  })],
  ["step-env-override-roots", false, (files) => ({
    ...files,
    workflow: files.workflow.replace(
      "      - name: Scan\n        run: bash .github/security/run-semgrep.sh\n",
      "      - name: Scan\n        env:\n          SEMGREP_ROOTS: website/src\n        run: bash .github/security/run-semgrep.sh\n",
    ),
  })],
  ["job-env-override-roots", false, (files) => ({
    ...files,
    workflow: files.workflow.replace(
      "    name: Semgrep (ERROR fails, WARNING reported)\n    needs: gate-self-test\n    runs-on: ubuntu-latest\n",
      "    name: Semgrep (ERROR fails, WARNING reported)\n    needs: gate-self-test\n    runs-on: ubuntu-latest\n    env:\n      SEMGREP_ROOTS: website/src\n",
    ),
  })],
  ["root-value-comment", true, (files) => ({
    ...files,
    script: files.script.replace("  .github/security\n", "  .github/security # narrowed\n"),
  })],
  ["roots-before-other-args", true, (files) => ({
    ...files,
    script: files.script.replace("semgrep scan \\\n  --metrics=off \\\n", "semgrep scan \\\n  api \\\n  --metrics=off \\\n"),
  })],
  ["scan-or-true", true, (files) => ({
    ...files,
    script: files.script.replace("  .github/security\n", "  .github/security || true\n"),
  })],
  ["gate-or-true", false, (files) => ({
    ...files,
    script: files.script.replace(
      "node .github/security/gate.mjs semgrep \"$RUNNER_TEMP/semgrep.json\"\n",
      "node .github/security/gate.mjs semgrep \"$RUNNER_TEMP/semgrep.json\" || true\n",
    ),
  })],
  ["second-scan-alternate-spelling", true, (files) => ({
    ...files,
    script: files.script.replace(
      "code=$?\n",
      "semgrep \\\n  scan --config p/javascript --quiet --json -o \"$RUNNER_TEMP/semgrep.json\" website/src\ncode=$?\n",
    ),
  })],
  ["continued-second-overwrite", true, (files) => ({
    ...files,
    script: files.script.replace(
      "set +e\n",
      "set +e\nsemgrep \\\n  scan --quiet --json -o \"$RUNNER_TEMP/semgrep.json\" website/src\n",
    ),
  })],
  ["after-code-second-overwrite", false, (files) => ({
    ...files,
    script: files.script.replace(
      "code=$?\n",
      "code=$?\nsemgrep \\\n  scan --config p/javascript --quiet --json -o \"$RUNNER_TEMP/semgrep.json\" website/src\n",
    ),
  })],
  ["change-pack-name", null, (files) => ({
    ...files,
    script: files.script.replace("--config p/javascript \\\n", "--config p/javascript-typo \\\n"),
  })],
  ["drop-exclude", null, (files) => ({
    ...files,
    script: files.script.replace("  --exclude generated \\\n", ""),
  })],
  ["add-no-git-ignore", null, (files) => ({
    ...files,
    script: files.script.replace("  --quiet \\\n", "  --quiet \\\n  --no-git-ignore \\\n"),
  })],
  ["add-max-target-bytes", null, (files) => ({
    ...files,
    script: files.script.replace("  --json \\\n", "  --json \\\n  --max-target-bytes 1000 \\\n"),
  })],
  ["change-version-pin", null, (files) => ({
    ...files,
    workflow: files.workflow.replace("semgrep==1.180.0", "semgrep==1.180.1"),
  })],
  ["add-baseline-commit", null, (files) => ({
    ...files,
    script: files.script.replace("  --json \\\n", "  --json \\\n  --baseline-commit HEAD \\\n"),
  })],
  ["second-job-writes-report", null, (files) => ({
    ...files,
    workflow: files.workflow + "  semgrep-narrow:\n    name: Narrow scan\n    runs-on: ubuntu-latest\n    steps:\n      - run: semgrep scan --json --output \"$RUNNER_TEMP/semgrep.json\" website/src\n",
  })],
  ["gate-reads-another-report", null, (files) => ({
    ...files,
    script: files.script.replace(
      "node .github/security/gate.mjs semgrep \"$RUNNER_TEMP/semgrep.json\"\n",
      "node .github/security/gate.mjs semgrep \"$RUNNER_TEMP/other.json\"\n",
    ),
  })],
];

test("workflow-shape mutations are rejected", () => {
  const workflow = normalizeNewlines(fs.readFileSync(workflowPath, "utf8"));
  const script = normalizeNewlines(fs.readFileSync(scriptPath, "utf8"));
  assert.equal(shapeMutations.length, 26);
  for (const [name, previouslyCaught, apply] of shapeMutations) {
    const mutated = apply({ workflow, script });
    assert.notDeepEqual(mutated, { workflow, script }, `${name} did not change anything`);
    const problems = semgrepShapeProblems(mutated.workflow, mutated.script);
    const oldResult = previouslyCaught === null ? "new" : previouslyCaught ? "caught" : "not caught";
    console.log(`shape ${name}: old ${oldResult}, new ${problems.length === 0 ? "not caught" : "caught"}`);
    assert.ok(problems.length > 0, `${name} was not caught`);
  }
});

test("known semgrep findings stay listed, and a missing one is named", () => {
  assert.ok(known.semgrep.length > 0);
  const results = known.semgrep.map((entry) => ({
    check_id: entry.rule,
    path: entry.path,
    start: { line: entry.line },
    extra: { severity: "WARNING", lines: canary, message: canary },
  }));
  const present = run(["semgrep", write("semgrep-known.json", JSON.stringify({ results, errors: [] }))]);
  assert.equal(present.code, 0, present.out);
  const image = known.semgrep.find((entry) => entry.path === "api/src/DigitalHub.Images/ImageFiles.cs");
  assert.ok(present.out.includes(`semgrep known warning: ${image.rule} ${image.path}:${image.line}`), present.out);
  assert.equal(present.out.includes("no longer found"), false, present.out);
  assert.equal(present.out.includes(canary), false, present.out);
  const partial = run(["semgrep", write("semgrep-stale.json", JSON.stringify({ results: results.slice(1), errors: [] }))]);
  assert.equal(partial.code, 0, partial.out);
  assert.ok(partial.out.includes(known.semgrep[0].id), partial.out);
  const asError = structuredClone(results[0]);
  asError.extra.severity = "ERROR";
  const knownError = run(["semgrep", write("semgrep-known-error.json", JSON.stringify({ results: [asError], errors: [] }))]);
  assert.equal(knownError.code, 0, knownError.out);
  assert.match(knownError.out, /::warning title=Known finding \(semgrep\)::/);
  assert.equal(knownError.out.includes("::error"), false, knownError.out);
  assert.equal(knownError.out.includes(canary), false, knownError.out);
});

test("semgrep line and severity failures name the field and do not print the match", () => {
  const cases = [
    ["semgrep-line-zero.json", semgrepResult("ERROR", 0), /field line is not a positive integer/],
    ["semgrep-line-negative.json", semgrepResult("ERROR", -1), /field line is not a positive integer/],
    ["semgrep-line-fraction.json", semgrepResult("ERROR", 1.5), /field line is not a positive integer/],
    ["semgrep-severity-lower.json", semgrepResult("error"), /field severity is not a semgrep severity/],
    ["semgrep-severity-warning-lower.json", semgrepResult("warning"), /field severity is not a semgrep severity/],
    ["semgrep-severity-mixed.json", semgrepResult("Error"), /field severity is not a semgrep severity/],
  ];
  for (const [name, body, pattern] of cases) {
    const file = write(name, JSON.stringify(semgrepReport([body])));
    const result = run(["semgrep", file]);
    assert.equal(result.code, 1, `${name}\n${result.out}`);
    assert.match(result.out, pattern, name);
    assert.ok(result.out.includes(file), name);
    assert.equal(result.out.includes(canary), false, name);
  }
  const emptyRule = semgrepResult("ERROR");
  emptyRule.check_id = "";
  const emptyRuleFile = write("semgrep-empty-rule.json", JSON.stringify(semgrepReport([emptyRule])));
  const emptyRuleResult = run(["semgrep", emptyRuleFile]);
  assert.equal(emptyRuleResult.code, 1, emptyRuleResult.out);
  assert.match(emptyRuleResult.out, /field check_id is missing/);
  const emptyPath = semgrepResult("WARNING");
  emptyPath.path = "";
  const emptyPathFile = write("semgrep-empty-path.json", JSON.stringify(semgrepReport([emptyPath])));
  const emptyPathResult = run(["semgrep", emptyPathFile]);
  assert.equal(emptyPathResult.code, 1, emptyPathResult.out);
  assert.match(emptyPathResult.out, /field path is missing/);
});

test("a duplicate semgrep key fails and names the key", () => {
  const text = '{"results":[],"errors":[],"results":[]}';
  const file = write("semgrep-duplicate-results.json", text);
  const result = run(["semgrep", file]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /duplicate key results/);
  assert.ok(result.out.includes(file), result.out);
});

function watchReads(value, specPath, reads) {
  if (value === null || typeof value !== "object") return value;
  const pathOf = (prop) => {
    const part = Array.isArray(value) && /^\d+$/.test(prop) ? Number(prop) : prop;
    return [...specPath, part];
  };
  const note = (prop) => {
    if (typeof prop !== "string" || (Array.isArray(value) && prop === "length")) return;
    reads.add(JSON.stringify(pathOf(prop)));
  };
  return new Proxy(value, {
    get(target, prop, receiver) {
      note(prop);
      const child = Reflect.get(target, prop, receiver);
      return typeof prop === "string" ? watchReads(child, pathOf(prop), reads) : child;
    },
    has(target, prop) {
      note(prop);
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      note(prop);
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}

function fieldShape(specPath) {
  return JSON.stringify(specPath.map((part) => (typeof part === "number" ? "*" : part)));
}

test("every field the gate reads is listed, and every listed field is read", async () => {
  const { validateNpm, validateDotnet, validateGitleaks, validateSemgrep, keepSerious, consumedFields: fields } = await import(pathToFileURL(gate).href);
  const dotnetBody = structuredClone(mutationFixtures.dotnet.body);
  // The listed transitivePackages field is the array. Its items use the same
  // package shape as topLevelPackages, which is the path the list records.
  dotnetBody.projects[0].frameworks[0].transitivePackages = [];
  const fixtures = {
    npm: mutationFixtures.npm.body,
    dotnet: dotnetBody,
    gitleaks: mutationFixtures.gitleaks.body,
    semgrep: mutationFixtures.semgrep.body,
  };
  for (const [tool, body] of Object.entries(fixtures)) {
    const reads = new Set();
    const proxied = watchReads(structuredClone(body), [], reads);
    // Array.isArray does not touch the proxy. The gitleaks list names that root value.
    if (fields[tool].some((spec) => spec.path.length === 0)) reads.add("[]");
    const found = tool === "npm" ? validateNpm(proxied)
      : tool === "dotnet" ? validateDotnet(proxied)
        : tool === "semgrep" ? validateSemgrep(proxied)
          : validateGitleaks(proxied);
    const kept = tool === "gitleaks" || tool === "semgrep" ? found : keepSerious(found);
    assert.ok(Array.isArray(kept));
    const shapes = new Set(fields[tool].map((spec) => fieldShape(spec.path)));
    const unexpected = [...reads].filter((recorded) => !shapes.has(fieldShape(JSON.parse(recorded))));
    assert.deepEqual(unexpected, [], `${tool} read a field that is not listed: ${unexpected.join(", ")}`);
    const missing = fields[tool].filter((spec) => ![...reads].some((recorded) => fieldShape(JSON.parse(recorded)) === fieldShape(spec.path)));
    assert.deepEqual(missing.map((spec) => spec.path), [], `${tool} listed a field it did not read`);
  }
});

// GAP-07: the full dependency tree is audited, and every npm and NuGet
// allow-list entry cites a D-NNN in docs/deferred-items.md and expires.

// Each line that invokes `npm audit`, comments left out.
function npmAuditLines(script) {
  return normalizeNewlines(script).split("\n").filter((line) => !line.trim().startsWith("#") && /(^|\s)npm audit(\s|$)/.test(line));
}

function npmAuditTreeProblems(script) {
  const problems = [];
  const lines = npmAuditLines(script);
  if (lines.length !== 2) problems.push(`expected two npm audit lines, found ${lines.length}`);
  for (const line of lines) {
    for (const flag of ["--omit", "--production", "--only", "--include"]) {
      if (line.split(/\s+/).some((token) => token === flag || token.startsWith(`${flag}=`))) problems.push(`npm audit narrows the tree with ${flag}: ${line.trim()}`);
    }
  }
  return problems;
}

function dotnetAuditTreeProblems(script) {
  const problems = [];
  const lines = normalizeNewlines(script).split("\n").filter((line) => line.trim().startsWith("dotnet list"));
  if (lines.length !== 2) problems.push(`expected two dotnet list lines, found ${lines.length}`);
  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    for (const required of ["DigitalHub.slnx", "--vulnerable", "--include-transitive"]) {
      if (!tokens.includes(required)) problems.push(`dotnet list does not name ${required}: ${line.trim()}`);
    }
  }
  return problems;
}

test("the npm audit script audits the full tree, development packages included", () => {
  const script = fs.readFileSync(path.join(here, "run-npm-audit.sh"), "utf8");
  assert.equal(npmAuditLines(script).length, 2);
  assert.deepEqual(npmAuditTreeProblems(script), []);
  const narrowed = script.replaceAll("npm audit --audit-level=high", "npm audit --omit=dev --audit-level=high");
  assert.notEqual(narrowed, script);
  const problems = npmAuditTreeProblems(narrowed);
  assert.equal(problems.filter((problem) => problem.startsWith("npm audit narrows the tree with --omit")).length, 2, problems.join("\n"));
});

test("the NuGet audit script lists vulnerable packages across the whole graph", () => {
  const script = fs.readFileSync(path.join(here, "run-dotnet-audit.sh"), "utf8");
  assert.deepEqual(dotnetAuditTreeProblems(script), []);
  const direct = script.replaceAll(" --include-transitive", "");
  assert.notEqual(direct, script);
  const problems = dotnetAuditTreeProblems(direct);
  assert.equal(problems.filter((problem) => problem.startsWith("dotnet list does not name --include-transitive")).length, 2, problems.join("\n"));
});

test("an expired npm allow-list entry fails while its advisory is still reported", () => {
  const entry = fixtureKnown.npm.studio[0];
  const result = runFixture(["npm", write("expired-npm-reported.json", npmReport([entry])), "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /1 known, 0 new/);
  assert.match(result.out, /::error title=Allow-list entry \(studio\)::GHSA-fixture-expired-0900 cites D-900, which expired on 2000-01-01/);
});

test("an expired npm allow-list entry fails after its advisory is gone", () => {
  const result = runFixture(["npm", write("expired-npm-gone.json", cleanNpm), "studio"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /0 known, 0 new/);
  assert.match(result.out, /::error title=Allow-list entry \(studio\)::GHSA-fixture-expired-0900 cites D-900, which expired on 2000-01-01/);
});

test("an expired NuGet allow-list entry fails", () => {
  const result = runFixture(["dotnet", write("expired-nuget.json", cleanNuget)]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /0 known, 0 new/);
  assert.match(result.out, /::error title=Allow-list entry \(dotnet\)::GHSA-fixture-expired-0904 cites D-904, which expired on 2000-01-01/);
});

const register = (text) => text.split("\n").map((line) => line.replace(/^ {4}/, "")).join("\n");

test("an entry is valid through its expiry day and expired the day after", async () => {
  const { allowListProblems, parseRegister } = await import(pathToFileURL(gate).href);
  const parsed = parseRegister(register(`
    ## D-010: boundary
    - Expires: 2026-11-30
  `));
  const entries = [{ id: "GHSA-boundary", deferred: "D-010", expires: "2026-11-30" }];
  assert.deepEqual(allowListProblems(entries, "2026-11-29", parsed), []);
  assert.deepEqual(allowListProblems(entries, "2026-11-30", parsed), []);
  const after = allowListProblems(entries, "2026-12-01", parsed);
  assert.equal(after.length, 1, after.join("\n"));
  assert.match(after[0], /^GHSA-boundary cites D-010, which expired on 2026-11-30; fix the finding or record a new owner decision$/);
});

test("an allow-list entry without a D-NNN, with a malformed one, or citing one the register does not hold fails", async () => {
  const { allowListProblems, parseRegister } = await import(pathToFileURL(gate).href);
  const today = "2026-11-01";
  const parsed = parseRegister(register(`
    ## D-012: twelve
    - Expires: 2026-11-30
  `));
  const entry = (deferred) => {
    const value = { id: "GHSA-cite", expires: "2026-11-30" };
    if (deferred !== undefined) value.deferred = deferred;
    return value;
  };
  assert.deepEqual(allowListProblems([entry("D-012")], today, parsed), []);
  const missing = allowListProblems([entry(undefined)], today, parsed);
  assert.ok(missing.some((problem) => /^GHSA-cite has no D-NNN/.test(problem)), missing.join("\n"));
  for (const malformed of ["D-12", "d-012", "D-0123"]) {
    const problems = allowListProblems([entry(malformed)], today, parsed);
    assert.ok(problems.some((problem) => problem.includes(`"${malformed}", which is not a D-NNN id`)), `${malformed}\n${problems.join("\n")}`);
  }
  const absent = allowListProblems([entry("D-999")], today, parsed);
  assert.ok(absent.some((problem) => problem === "GHSA-cite cites D-999, which is not in docs/deferred-items.md"), absent.join("\n"));

  const twice = parseRegister(register(`
    ## D-012: twelve
    - Expires: 2026-11-30

    ## D-012: twelve again
    - Expires: 2026-11-30
  `));
  assert.deepEqual(twice.duplicates, ["D-012"]);
  const duplicate = allowListProblems([entry("D-012")], today, twice);
  assert.ok(duplicate.some((problem) => problem === "GHSA-cite cites D-012, which appears more than once in docs/deferred-items.md"), duplicate.join("\n"));

  const fencedOnly = parseRegister(register(`
    \`\`\`markdown
    ## D-900: example
    - Expires: 2026-11-30
    \`\`\`
  `));
  assert.equal(fencedOnly.entries.has("D-900"), false);
  const fenced = allowListProblems([{ id: "GHSA-cite", deferred: "D-900", expires: "2026-11-30" }], today, fencedOnly);
  assert.ok(fenced.some((problem) => problem === "GHSA-cite cites D-900, which is not in docs/deferred-items.md"), fenced.join("\n"));

  const realAndFenced = parseRegister(register(`
    ~~~
    ## D-900: example
    - Expires: 2026-12-31
    ~~~

    ## D-900: real
    - Expires: 2026-11-30
  `));
  assert.deepEqual(realAndFenced.duplicates, []);
  assert.equal(realAndFenced.entries.get("D-900"), "2026-11-30");
  assert.deepEqual(allowListProblems([{ id: "GHSA-cite", deferred: "D-900", expires: "2026-11-30" }], today, realAndFenced), []);
});

test("an allow-list entry without an expiry, with a malformed or impossible date, or with a date that differs from the register fails", async () => {
  const { allowListProblems, parseRegister } = await import(pathToFileURL(gate).href);
  const today = "2026-11-01";
  const parsed = parseRegister(register(`
    ## D-012: twelve
    - Expires: 2026-11-30

    ## D-013: no expiry
    - Rule waived: S-7

    ## D-014: later in the register
    - Expires: 2026-12-31
  `));
  const entry = (deferred, expires) => {
    const value = { id: "GHSA-date", deferred };
    if (expires !== undefined) value.expires = expires;
    return value;
  };
  assert.deepEqual(allowListProblems([entry("D-012", "2026-11-30")], today, parsed), []);
  const missing = allowListProblems([entry("D-012", undefined)], today, parsed);
  assert.ok(missing.some((problem) => /^GHSA-date has no expires date/.test(problem)), missing.join("\n"));
  for (const bad of ["30-11-2026", "2026-02-30"]) {
    const problems = allowListProblems([entry("D-012", bad)], today, parsed);
    assert.ok(problems.some((problem) => problem.includes(`expires "${bad}", which is not a real YYYY-MM-DD date`)), `${bad}\n${problems.join("\n")}`);
  }
  const noLine = allowListProblems([entry("D-013", "2026-11-30")], today, parsed);
  assert.ok(noLine.some((problem) => problem === "GHSA-date cites D-013, which has no \"- Expires: YYYY-MM-DD\" line in docs/deferred-items.md"), noLine.join("\n"));
  const differs = allowListProblems([entry("D-014", "2026-11-30")], today, parsed);
  assert.ok(differs.some((problem) => problem === "GHSA-date expires on 2026-11-30, but D-014 in docs/deferred-items.md expires on 2026-12-31"), differs.join("\n"));
});

test("an allow-list entry fails closed when docs/deferred-items.md is missing", () => {
  assert.equal(fs.existsSync(path.join(noRegisterGateDir, "..", "..", "docs")), false);
  const result = runGate(noRegisterGate, ["npm", write("no-register.json", cleanNpm), "website"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /::error title=Allow-list entry \(website\)::GHSA-fixture-known-0001 cites D-901, but docs\/deferred-items\.md does not exist/);
});

test("every npm and NuGet entry in known-findings.json cites a D-NNN and carries a valid expiry", async () => {
  const { allowListShapeProblems } = await import(pathToFileURL(gate).href);
  for (const [name, entries] of [["npm.website", known.npm.website], ["npm.studio", known.npm.studio], ["dotnet", known.dotnet]]) {
    assert.ok(Array.isArray(entries), `${name} is not a list`);
    assert.deepEqual(allowListShapeProblems(entries), [], name);
  }
  const broken = structuredClone(known);
  broken.npm.studio.push(
    { id: "GHSA-shape-no-deferred", owner: "gate self-test", reason: "Fixture.", expires: "2000-01-01" },
    { id: "GHSA-shape-soon", owner: "gate self-test", reason: "Fixture.", deferred: "D-999", expires: "soon" },
  );
  const problems = allowListShapeProblems(broken.npm.studio);
  assert.equal(problems.length, 2, problems.join("\n"));
  assert.match(problems[0], /^GHSA-shape-no-deferred has no D-NNN/);
  assert.match(problems[1], /^GHSA-shape-soon has expires "soon", which is not a real YYYY-MM-DD date/);
  assert.equal(problems.some((problem) => /deferred-items|expired/.test(problem)), false, problems.join("\n"));
});

test("the self-test does not depend on the real npm and NuGet allow-list", () => {
  const npmFile = write("expired-real-npm.json", cleanNpm);
  const nugetFile = write("expired-real-nuget.json", cleanNuget);
  const npmExpired = runGate(expiredRealGate, ["npm", npmFile, "studio"]);
  assert.equal(npmExpired.code, 1, npmExpired.out);
  assert.match(npmExpired.out, /D-900, which expired on 2000-01-01/);
  const nugetExpired = runGate(expiredRealGate, ["dotnet", nugetFile]);
  assert.equal(nugetExpired.code, 1, nugetExpired.out);
  assert.match(nugetExpired.out, /D-904, which expired on 2000-01-01/);

  const before = spawnedGates.length;
  const npmRun = run(["npm", npmFile, "studio"]);
  assert.equal(npmRun.code, 0, npmRun.out);
  const nugetRun = run(["dotnet", nugetFile]);
  assert.equal(nugetRun.code, 0, nugetRun.out);
  run(["gitleaks", write("routing-leaks.json", "[]"), "full-history"]);
  run(["semgrep", write("routing-semgrep.json", JSON.stringify({ results: [], errors: [] }))]);
  assert.deepEqual(spawnedGates.slice(before), [cleanGate, cleanGate, gate, gate]);

  const source = normalizeNewlines(fs.readFileSync(fileURLToPath(import.meta.url), "utf8"));
  const runStart = source.indexOf("\nfunction run(args) {\n");
  assert.ok(runStart >= 0, "run() is missing");
  const runBody = source.slice(runStart, source.indexOf("\n}\n", runStart) + 3);
  const realSpawn = "runGate(" + "gate,";
  // The variable gate only: runGate's own spawnSync(process.execPath, [gateFile, ...]) is not a match.
  const directSpawn = new RegExp(["spawnSync\\(process\\.execPath, \\[", "gate\\b"].join(""), "g");
  assert.equal(source.split(realSpawn).length - 1, 1, `the real gate is spawned outside run(): ${realSpawn}`);
  assert.equal(runBody.split(realSpawn).length - 1, 1, "run() does not hold the only spawn of the real gate");
  assert.equal((source.match(directSpawn) ?? []).length, 0, `the real gate is spawned directly: ${directSpawn}`);
  assert.equal(("spawnSync(process.execPath, [" + "gate, ...args]").match(directSpawn)?.length, 1, "the direct-spawn pattern no longer matches a direct spawn");
  const guard = runBody.indexOf("if (args[0] === \"npm\" || args[0] === \"dotnet\") return runGate(cleanGate, args);");
  assert.ok(guard >= 0 && guard < runBody.indexOf(realSpawn), "run() can reach the real gate for npm or dotnet");
});

// The npm jobs run run-npm-audit.sh with whatever npm configuration the runner
// gives it. NODE_ENV=production, NPM_CONFIG_OMIT, npm_config_production or an
// .npmrc can make npm omit development packages without any change to the
// script's flags, so the script refuses to audit unless npm's effective omit
// is empty. A stub npm on PATH answers `npm audit` with a clean report (no
// network) and passes everything else, including `npm config get`, to the
// real npm.
test("the npm audit script refuses an npm configuration that omits packages", () => {
  const realNpm = spawnSync("sh", ["-c", "command -v npm"], { encoding: "utf8" }).stdout.trim();
  assert.ok(realNpm, "npm is not on PATH");
  const stubDir = path.join(dir, "npm-stub");
  fs.mkdirSync(stubDir, { recursive: true });
  const stub = path.join(stubDir, "npm");
  fs.writeFileSync(stub, [
    "#!/bin/sh",
    "if [ \"$1\" = \"audit\" ]; then",
    "  echo \"STUB-NPM-AUDIT $*\" >&2",
    `  case " $* " in *" --json "*) printf '%s\\n' '${cleanNpm}' ;; esac`,
    "  exit 0",
    "fi",
    `exec ${JSON.stringify(realNpm)} "$@"`,
    "",
  ].join("\n"));
  fs.chmodSync(stub, 0o755);
  const baseEnv = { ...process.env };
  for (const key of Object.keys(baseEnv)) {
    if (key === "NODE_ENV" || /^npm_config_(omit|production|only|include|dev)$/i.test(key)) delete baseEnv[key];
  }
  baseEnv.PATH = `${stubDir}${path.delimiter}${baseEnv.PATH}`;
  // App folders beside fixture-clean's gate, so ../.github/security/gate.mjs resolves to it.
  const appDir = (name, npmrc) => {
    const folder = path.join(cleanGateDir, "..", "..", name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "package.json"), "{}\n");
    if (npmrc !== undefined) fs.writeFileSync(path.join(folder, ".npmrc"), npmrc);
    return folder;
  };
  const runScript = (cwd, app, extraEnv = {}) => {
    const runnerTemp = fs.mkdtempSync(path.join(dir, "omit-rt-"));
    const result = spawnSync("sh", [path.join(here, "run-npm-audit.sh"), app], {
      cwd,
      encoding: "utf8",
      env: { ...baseEnv, RUNNER_TEMP: runnerTemp, ...extraEnv },
    });
    return { code: result.status, out: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
  };

  const clean = runScript(appDir("studio"), "studio");
  assert.equal(clean.code, 0, clean.out);
  assert.equal((clean.out.match(/STUB-NPM-AUDIT/g) ?? []).length, 2, clean.out);
  assert.match(clean.out, /studio: 0 finding\(s\) at the gate's level; 0 known, 0 new\./);
  assert.equal(clean.out.includes("::error"), false, clean.out);

  const cases = [
    ["NODE_ENV=production", appDir("studio"), "studio", { NODE_ENV: "production" }],
    ["NPM_CONFIG_OMIT=dev", appDir("studio"), "studio", { NPM_CONFIG_OMIT: "dev" }],
    ["npm_config_production=true", appDir("studio"), "studio", { npm_config_production: "true" }],
    [".npmrc omit=dev", appDir("website", "omit=dev\n"), "website", {}],
  ];
  for (const [name, cwd, app, extraEnv] of cases) {
    const result = runScript(cwd, app, extraEnv);
    assert.equal(result.code, 1, `${name}\n${result.out}`);
    assert.match(result.out, new RegExp(`::error title=npm audit \\(${app}\\)::npm is set to omit "dev"; the audit must cover the full tree, development packages included`), `${name}\n${result.out}`);
    assert.equal(result.out.includes("STUB-NPM-AUDIT"), false, `${name} reached npm audit\n${result.out}`);
  }
});
