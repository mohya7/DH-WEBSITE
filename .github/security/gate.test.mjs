// Runs the gate against fixtures in a temp folder. No extra dependency.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  assert.match(npm.out, /field auditReportVersion is missing/);
  const nuget = run(["dotnet", write("shape-nuget.json", JSON.stringify({ version: 1, parameters: "", sources: [] }))]);
  assert.equal(nuget.code, 1, nuget.out);
  assert.match(nuget.out, /field projects is missing/);
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
  url: "https://github.com/advisories/GHSA-cjq9-62q9-8jv4",
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
    const baseline = run([tool, write(`${tool}-mutation-base.json`, JSON.stringify(fixture.body)), fixture.label].filter((part, index) => index < 2 || part));
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
        const result = run([tool, file, fixture.label].filter((part, index) => index < 2 || part));
        if (accepted) {
          assert.equal(result.code, 0, `${tool} ${key} ${kind}\n${result.out}`);
        } else {
          assert.equal(result.code, 1, `${tool} ${key} ${kind}\n${result.out}`);
          assert.ok(result.out.includes(file), `${tool} ${key} ${kind} did not name the file\n${result.out}`);
          assert.match(result.out, new RegExp(`\\b${spec.field}\\b`), `${tool} ${key} ${kind} did not name the field\n${result.out}`);
        }
      }
      count += 1;
      const removed = applyMutation(fixture.body, spec.path, undefined, true);
      const removedFile = write(`${tool}-${count}-removed.json`, JSON.stringify(removed));
      const removedResult = run([tool, removedFile, fixture.label].filter((part, index) => index < 2 || part));
      if (spec.optional) {
        assert.equal(removedResult.code, 0, `${tool} ${key} removed\n${removedResult.out}`);
      } else {
        assert.equal(removedResult.code, 1, `${tool} ${key} removed\n${removedResult.out}`);
        assert.ok(removedResult.out.includes(removedFile), `${tool} ${key} removed did not name the file`);
        assert.match(removedResult.out, new RegExp(`\\b${spec.field}\\b`), `${tool} ${key} removed did not name the field\n${removedResult.out}`);
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
  const { validateNpm, validateDotnet, validateGitleaks, keepSerious, consumedFields: fields } = await import(pathToFileURL(gate).href);
  const dotnetBody = structuredClone(mutationFixtures.dotnet.body);
  // The listed transitivePackages field is the array. Its items use the same
  // package shape as topLevelPackages, which is the path the list records.
  dotnetBody.projects[0].frameworks[0].transitivePackages = [];
  const fixtures = {
    npm: mutationFixtures.npm.body,
    dotnet: dotnetBody,
    gitleaks: mutationFixtures.gitleaks.body,
  };
  for (const [tool, body] of Object.entries(fixtures)) {
    const reads = new Set();
    const proxied = watchReads(structuredClone(body), [], reads);
    // Array.isArray does not touch the proxy. The gitleaks list names that root value.
    if (fields[tool].some((spec) => spec.path.length === 0)) reads.add("[]");
    const found = tool === "npm" ? validateNpm(proxied) : tool === "dotnet" ? validateDotnet(proxied) : validateGitleaks(proxied);
    const kept = tool === "gitleaks" ? found : keepSerious(found);
    assert.ok(Array.isArray(kept));
    const shapes = new Set(fields[tool].map((spec) => fieldShape(spec.path)));
    const unexpected = [...reads].filter((recorded) => !shapes.has(fieldShape(JSON.parse(recorded))));
    assert.deepEqual(unexpected, [], `${tool} read a field that is not listed: ${unexpected.join(", ")}`);
    const missing = fields[tool].filter((spec) => ![...reads].some((recorded) => fieldShape(JSON.parse(recorded)) === fieldShape(spec.path)));
    assert.deepEqual(missing.map((spec) => spec.path), [], `${tool} listed a field it did not read`);
  }
});
