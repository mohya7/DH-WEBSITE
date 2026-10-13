// Runs the gate against fixtures in a temp folder. No extra dependency.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

function run(args) {
  const result = spawnSync(process.execPath, [gate, ...args], { encoding: "utf8" });
  return { code: result.status, out: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

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
  for (const [kind, label] of [["npm", "website"], ["npm", "studio"], ["dotnet", ""], ["gitleaks", "pr-diff"], ["gitleaks", "full-history"]]) {
    const file = write(`empty-${kind}-${label || "none"}.json`, "");
    const result = run([kind, file, label].filter((part, index) => index < 2 || part));
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, new RegExp(path.basename(file).replace(".", "\\.")));
    assert.match(result.out, /the tool produced no output/);
  }
});

test("a blank report fails and names the file", () => {
  for (const [kind, label] of [["npm", "website"], ["dotnet", ""], ["gitleaks", "full-history"]]) {
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
});

test("a missing report fails", () => {
  const result = run(["npm", path.join(dir, "missing.json"), "website"]);
  assert.equal(result.code, 1);
  assert.match(result.out, /ENOENT/);
});

test("the wrong shape fails", () => {
  const npm = run(["npm", write("shape-npm.json", "{}"), "studio"]);
  assert.equal(npm.code, 1, npm.out);
  assert.match(npm.out, /missing the expected top-level keys/);
  const nuget = run(["dotnet", write("shape-nuget.json", JSON.stringify({ version: 1, parameters: "", sources: [] }))]);
  assert.equal(nuget.code, 1, nuget.out);
  assert.match(nuget.out, /missing projects/);
  const leaks = run(["gitleaks", write("shape-leaks.json", "{}"), "full-history"]);
  assert.equal(leaks.code, 1, leaks.out);
  assert.match(leaks.out, /not an array/);
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

test("a known-only npm report passes", () => {
  const result = run(["npm", write("known-npm.json", npmReport(known.npm.website)), "website"]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /3 known, 0 new/);
});

test("a new High advisory fails", () => {
  const advisories = [...known.npm.website, { id: "GHSA-new-high-0000", package: "example-high", severity: "high", title: "synthetic high" }];
  const result = run(["npm", write("new-high.json", npmReport(advisories)), "website"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /GHSA-new-high-0000/);
});

test("a new Critical advisory fails", () => {
  const advisories = [...known.npm.website, { id: "GHSA-new-crit-0000", package: "example-critical", severity: "critical", title: "synthetic critical" }];
  const result = run(["npm", write("new-critical.json", npmReport(advisories)), "website"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /critical example-critical GHSA-new-crit-0000/);
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
