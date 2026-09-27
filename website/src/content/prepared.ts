/*
 * The prepared content: what the prepare step writes and every page reads.
 *
 *   .content/content.json    the source's response, unchanged
 *   .content/manifest.json   where it came from, and what the build will contain
 *   public/media/            the media files published content uses
 *
 * Next renders pages in several worker processes. Reading one prepared copy
 * means every page comes from the same content, and the API is asked once.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { UnresolvedReference } from "./build-content";
import { describeConfig, websiteRoot, type ContentConfig } from "./config";
import type { PageType } from "./routes";

export const preparedDir = path.join(websiteRoot, ".content");
export const publicMediaDir = path.join(websiteRoot, "public", "media");

export interface Manifest {
  /** "snapshot (fixtures/snapshot)" or "api (<url>)". Never the token. */
  source: string;
  /** SHA-256 of content.json, so a changed snapshot is never built from an old copy. */
  contentSha256: string;
  preparedAt: string;
  contentGeneratedAt: string;
  counts: Record<string, number>;
  routes: { path: string; pageType: PageType; collection: string; slug: string }[];
  errorPages: { "404": boolean; "500": boolean };
  skipped: { collection: string; slug: string; reason: string }[];
  media: { assetsListed: number; assetsUsed: number; files: number; bytes: number };
  unresolvedReferences: UnresolvedReference[];
}

export class PreparedContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreparedContentError";
  }
}

export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function readPrepared(config: ContentConfig, dir: string = preparedDir): { raw: string; manifest: Manifest } {
  const manifestFile = path.join(dir, "manifest.json");
  const contentFile = path.join(dir, "content.json");
  const rerun = "Run `npm run build` (or `npm run prepare:content`) in website/.";

  if (!fs.existsSync(manifestFile) || !fs.existsSync(contentFile)) {
    throw new PreparedContentError(`The content has not been prepared. ${rerun}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as Manifest;
  const expected = describeConfig(config);
  if (manifest.source !== expected) {
    throw new PreparedContentError(`The prepared content came from ${manifest.source}, but the configured source is ${expected}. ${rerun}`);
  }

  const raw = fs.readFileSync(contentFile, "utf8");
  if (sha256(raw) !== manifest.contentSha256) {
    throw new PreparedContentError(`The prepared content does not match its manifest. ${rerun}`);
  }

  if (config.source === "snapshot") {
    const snapshot = fs.readFileSync(path.join(config.snapshotDir, "content.json"), "utf8");
    if (sha256(snapshot) !== manifest.contentSha256) {
      throw new PreparedContentError(`The snapshot has changed since the content was prepared. ${rerun}`);
    }
  }

  return { raw, manifest };
}
