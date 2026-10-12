/*
 * Which content source the build reads, from configuration only.
 *
 *   CONTENT_SOURCE=snapshot   website/fixtures/snapshot/
 *   CONTENT_SOURCE=api        GET {CONTENT_API_URL}/api/v1/build/content,
 *                             authenticated with CONTENT_BUILD_TOKEN
 *
 * There is no default. Anything else stops the build with a message saying what
 * to set, so a build can never quietly use content from somewhere unexpected.
 *
 * Test only: SNAPSHOT_SETTINGS_FIXTURE=<name> (with CONTENT_SOURCE=snapshot)
 * overlays website/fixtures/settings/<name>.json onto the snapshot's site
 * settings, as if those settings had been saved in the Studio. The consent
 * build uses it to set a container id. It is refused with CONTENT_SOURCE=api,
 * so a real build only ever takes settings from the Content API.
 */
import fs from "node:fs";
import path from "node:path";

export type ContentConfig =
  | { source: "snapshot"; snapshotDir: string; settingsFixture?: string }
  | { source: "api"; apiUrl: string; token: string };

export class ContentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentConfigError";
  }
}

/*
 * website/. npm scripts, Next, and Vitest all run from here. Module-relative paths
 * are not used because Next bundles server code into .next/, away from its source.
 */
export const websiteRoot = findWebsiteRoot(process.cwd());

function findWebsiteRoot(cwd: string): string {
  if (!fs.existsSync(path.join(cwd, "next.config.ts")) || !fs.existsSync(path.join(cwd, "fixtures"))) {
    throw new ContentConfigError(`Run the website build from website/, not ${cwd}.`);
  }
  return cwd;
}

export const snapshotDir = path.join(websiteRoot, "fixtures", "snapshot");
export const settingsFixtureDir = path.join(websiteRoot, "fixtures", "settings");

const howToConfigure =
  "Set CONTENT_SOURCE=snapshot to build from website/fixtures/snapshot/, " +
  "or CONTENT_SOURCE=api with CONTENT_API_URL and CONTENT_BUILD_TOKEN to build from the Content API.";

type Env = Record<string, string | undefined>;

export function readContentConfig(env: Env = process.env): ContentConfig {
  const source = env.CONTENT_SOURCE?.trim();

  if (!source) {
    throw new ContentConfigError(`No content source is configured. ${howToConfigure}`);
  }

  const fixture = env.SNAPSHOT_SETTINGS_FIXTURE?.trim();
  if (source === "snapshot") {
    if (!fixture) return { source: "snapshot", snapshotDir };
    if (!/^[a-z0-9-]+$/.test(fixture)) {
      throw new ContentConfigError(`SNAPSHOT_SETTINGS_FIXTURE must be a file name in website/fixtures/settings/ without .json, not "${fixture}".`);
    }
    const settingsFixture = path.join(settingsFixtureDir, `${fixture}.json`);
    if (!fs.existsSync(settingsFixture)) {
      throw new ContentConfigError(`SNAPSHOT_SETTINGS_FIXTURE names fixtures/settings/${fixture}.json, which does not exist.`);
    }
    return { source: "snapshot", snapshotDir, settingsFixture };
  }
  if (fixture) {
    throw new ContentConfigError("SNAPSHOT_SETTINGS_FIXTURE is for snapshot test builds only. Unset it, or set CONTENT_SOURCE=snapshot.");
  }

  if (source === "api") {
    const apiUrl = env.CONTENT_API_URL?.trim();
    const token = env.CONTENT_BUILD_TOKEN?.trim();
    const missing = [!apiUrl && "CONTENT_API_URL", !token && "CONTENT_BUILD_TOKEN"].filter(Boolean);
    if (missing.length > 0) {
      throw new ContentConfigError(`CONTENT_SOURCE=api needs ${missing.join(" and ")}. ${howToConfigure}`);
    }

    let parsed: URL;
    try {
      parsed = new URL(apiUrl!);
    } catch {
      throw new ContentConfigError(`CONTENT_API_URL is not a valid URL: "${apiUrl}".`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ContentConfigError(`CONTENT_API_URL must be http or https, not "${parsed.protocol}".`);
    }

    return { source: "api", apiUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ""), token: token! };
  }

  throw new ContentConfigError(`CONTENT_SOURCE must be "snapshot" or "api", not "${source}". ${howToConfigure}`);
}

/** The configuration as it may be printed or recorded: never the token. */
export function describeConfig(config: ContentConfig): string {
  const relative = (file: string) => path.relative(websiteRoot, file).split(path.sep).join("/");
  if (config.source === "api") return `api (${config.apiUrl})`;
  return config.settingsFixture
    ? `snapshot (${relative(config.snapshotDir)}, settings from ${relative(config.settingsFixture)})`
    : `snapshot (${relative(config.snapshotDir)})`;
}
