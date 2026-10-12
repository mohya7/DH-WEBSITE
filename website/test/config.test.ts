import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentConfigError, describeConfig, readContentConfig, settingsFixtureDir, snapshotDir } from "../src/content/config";
import { readSnapshotRaw } from "../src/content/sources";

describe("content source configuration", () => {
  it("fails with a clear message when no source is configured", () => {
    expect(() => readContentConfig({})).toThrow(ContentConfigError);
    expect(() => readContentConfig({})).toThrow(/No content source is configured\. Set CONTENT_SOURCE=snapshot .* or CONTENT_SOURCE=api with CONTENT_API_URL and CONTENT_BUILD_TOKEN/);
  });

  it("treats a blank CONTENT_SOURCE as not configured", () => {
    expect(() => readContentConfig({ CONTENT_SOURCE: "   " })).toThrow(/No content source is configured/);
  });

  it("has no default even when the API variables are set", () => {
    expect(() => readContentConfig({ CONTENT_API_URL: "http://localhost:5097", CONTENT_BUILD_TOKEN: "t" })).toThrow(/No content source is configured/);
  });

  it("refuses an unknown source", () => {
    expect(() => readContentConfig({ CONTENT_SOURCE: "database" })).toThrow(/must be "snapshot" or "api", not "database"/);
    expect(() => readContentConfig({ CONTENT_SOURCE: "Snapshot" })).toThrow(ContentConfigError);
  });

  it("reads the snapshot from website/fixtures/snapshot/", () => {
    const config = readContentConfig({ CONTENT_SOURCE: "snapshot" });
    expect(config).toEqual({ source: "snapshot", snapshotDir });
    expect(snapshotDir.endsWith(path.join("website", "fixtures", "snapshot"))).toBe(true);
  });

  it("lays a test settings fixture over the snapshot only, never over the API", () => {
    const config = readContentConfig({ CONTENT_SOURCE: "snapshot", SNAPSHOT_SETTINGS_FIXTURE: "consent" });
    expect(config).toEqual({ source: "snapshot", snapshotDir, settingsFixture: path.join(settingsFixtureDir, "consent.json") });
    expect(describeConfig(config)).toBe("snapshot (fixtures/snapshot, settings from fixtures/settings/consent.json)");
    const content = JSON.parse(readSnapshotRaw(snapshotDir, path.join(settingsFixtureDir, "consent.json")));
    expect(content.settings.analyticsContainerId).toBe("GTM-TEST1234");
    expect(JSON.parse(readSnapshotRaw(snapshotDir)).settings.analyticsContainerId).toBeNull();
    expect(() => readContentConfig({ CONTENT_SOURCE: "snapshot", SNAPSHOT_SETTINGS_FIXTURE: "../snapshot/content" })).toThrow(/file name in website\/fixtures\/settings/);
    expect(() => readContentConfig({ CONTENT_SOURCE: "snapshot", SNAPSHOT_SETTINGS_FIXTURE: "missing" })).toThrow(/does not exist/);
    expect(() => readContentConfig({ CONTENT_SOURCE: "api", CONTENT_API_URL: "http://localhost:5097", CONTENT_BUILD_TOKEN: "t", SNAPSHOT_SETTINGS_FIXTURE: "consent" })).toThrow(/snapshot test builds only/);
  });

  it("needs both the API URL and the build token for the API source", () => {
    expect(() => readContentConfig({ CONTENT_SOURCE: "api" })).toThrow(/needs CONTENT_API_URL and CONTENT_BUILD_TOKEN/);
    expect(() => readContentConfig({ CONTENT_SOURCE: "api", CONTENT_BUILD_TOKEN: "t" })).toThrow(/needs CONTENT_API_URL\./);
    expect(() => readContentConfig({ CONTENT_SOURCE: "api", CONTENT_API_URL: "http://localhost:5097" })).toThrow(/needs CONTENT_BUILD_TOKEN\./);
  });

  it("refuses an API URL that is not http or https", () => {
    expect(() => readContentConfig({ CONTENT_SOURCE: "api", CONTENT_API_URL: "not a url", CONTENT_BUILD_TOKEN: "t" })).toThrow(/not a valid URL/);
    expect(() => readContentConfig({ CONTENT_SOURCE: "api", CONTENT_API_URL: "ftp://host", CONTENT_BUILD_TOKEN: "t" })).toThrow(/must be http or https/);
  });

  it("reads the API source and never describes it with the token", () => {
    const config = readContentConfig({ CONTENT_SOURCE: "api", CONTENT_API_URL: "http://localhost:5097/", CONTENT_BUILD_TOKEN: "secret-token-value" });
    expect(config).toEqual({ source: "api", apiUrl: "http://localhost:5097", token: "secret-token-value" });
    expect(describeConfig(config)).toBe("api (http://localhost:5097)");
    expect(describeConfig(config)).not.toContain("secret-token-value");
  });
});
