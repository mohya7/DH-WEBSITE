/*
 * The two content sources. Each hands back the build content and a way to fetch
 * a media file by its site-relative path.
 */
import fs from "node:fs";
import path from "node:path";
import type { BuildContent } from "./build-content";
import type { ContentConfig } from "./config";
import { isSafeMediaPath } from "./media";

export const BUILD_TOKEN_HEADER = "X-Build-Token";
export const BUILD_CONTENT_PATH = "/api/v1/build/content";

export interface OpenedSource {
  content: BuildContent;
  /** Raw JSON as received, written unchanged to the prepared cache. */
  raw: string;
  readMedia(mediaPath: string): Promise<Buffer>;
}

export class ContentSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentSourceError";
  }
}

type Fetch = typeof fetch;

function parse(raw: string, from: string): BuildContent {
  try {
    return JSON.parse(raw) as BuildContent;
  } catch (error) {
    throw new ContentSourceError(`${from} is not valid JSON: ${(error as Error).message}`);
  }
}

function mediaFileName(mediaPath: string): string {
  if (!isSafeMediaPath(mediaPath)) throw new ContentSourceError(`Refusing unexpected media path "${mediaPath}".`);
  return mediaPath.slice("/media/".length);
}

/** Settings added after the snapshot was generated, which a settings fixture may also set. */
const newerSettingKeys = ["cookieBannerTitle", "cookieAcceptLabel", "cookieRejectLabel", "cookieAnalyticsLabel", "cookieSettingsLabel"];

/**
 * The snapshot's content.json, unchanged, or with a test settings fixture laid
 * over its site settings (SNAPSHOT_SETTINGS_FIXTURE). A fixture may set only
 * keys the settings already have, or the newer cookie banner ones.
 */
export function readSnapshotRaw(snapshotDir: string, settingsFixture?: string): string {
  const file = path.join(snapshotDir, "content.json");
  if (!fs.existsSync(file)) {
    throw new ContentSourceError(`The content snapshot is missing: ${file} does not exist.`);
  }
  const raw = fs.readFileSync(file, "utf8");
  if (!settingsFixture) return raw;
  const content = parse(raw, "fixtures/snapshot/content.json");
  const overlay = parse(fs.readFileSync(settingsFixture, "utf8"), settingsFixture) as unknown as Record<string, unknown>;
  const known = new Set([...Object.keys(content.settings), ...newerSettingKeys]);
  const unknown = Object.keys(overlay).filter((key) => !known.has(key));
  if (unknown.length > 0) throw new ContentSourceError(`${settingsFixture} sets unknown settings: ${unknown.join(", ")}.`);
  return JSON.stringify({ ...content, settings: { ...content.settings, ...overlay } });
}

export function openSnapshot(snapshotDir: string, settingsFixture?: string): OpenedSource {
  const raw = readSnapshotRaw(snapshotDir, settingsFixture);
  return {
    content: parse(raw, "fixtures/snapshot/content.json"),
    raw,
    async readMedia(mediaPath) {
      const from = path.join(snapshotDir, "media", mediaFileName(mediaPath));
      if (!fs.existsSync(from)) throw new ContentSourceError(`The snapshot has no media file ${mediaPath}.`);
      return fs.readFileSync(from);
    },
  };
}

/**
 * One request for the content. The endpoint is rate-limited per address, so the
 * build reads it once and every page is rendered from that one response.
 */
export async function openApi(apiUrl: string, token: string, fetchImpl: Fetch = fetch): Promise<OpenedSource> {
  const url = apiUrl + BUILD_CONTENT_PATH;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { [BUILD_TOKEN_HEADER]: token, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new ContentSourceError(`Could not reach the Content API at ${url}: ${(error as Error).message}`);
  }

  if (response.status === 401) {
    throw new ContentSourceError(`The Content API refused the build token (401) at ${url}. Check CONTENT_BUILD_TOKEN against Build:Token.`);
  }
  if (response.status === 429) {
    throw new ContentSourceError(`The Content API rate-limited the build (429) at ${url}. Wait for the window to pass, then build again.`);
  }
  if (!response.ok) {
    throw new ContentSourceError(`The Content API answered ${response.status} at ${url}.`);
  }

  const raw = await response.text();
  return {
    content: parse(raw, `The response from ${url}`),
    raw,
    async readMedia(mediaPath) {
      mediaFileName(mediaPath);
      const mediaUrl = apiUrl + mediaPath;
      let media: Response;
      try {
        media = await fetchImpl(mediaUrl, { signal: AbortSignal.timeout(60_000) });
      } catch (error) {
        throw new ContentSourceError(`Could not download ${mediaUrl}: ${(error as Error).message}`);
      }
      if (!media.ok) throw new ContentSourceError(`Downloading ${mediaUrl} answered ${media.status}.`);
      const type = media.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) throw new ContentSourceError(`${mediaUrl} is "${type}", not an image.`);
      return Buffer.from(await media.arrayBuffer());
    },
  };
}

export async function openSource(config: ContentConfig, fetchImpl: Fetch = fetch): Promise<OpenedSource> {
  return config.source === "snapshot" ? openSnapshot(config.snapshotDir, config.settingsFixture) : openApi(config.apiUrl, config.token, fetchImpl);
}
