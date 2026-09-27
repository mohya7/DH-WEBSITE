/*
 * The prepare step: read the configured source once, check it, and write the
 * prepared content and media files the pages are built from.
 */
import fs from "node:fs";
import path from "node:path";
import { describeConfig, type ContentConfig } from "./config";
import { mediaFiles, referencedMediaIds } from "./media";
import { preparedDir, publicMediaDir, sha256, type Manifest } from "./prepared";
import { buildRoutes } from "./routes";
import { openSource } from "./sources";
import { validateContent } from "./validate";

export class ContentCheckError extends Error {
  constructor(public readonly problems: string[]) {
    super(`The content failed its checks:\n- ${problems.join("\n- ")}`);
    this.name = "ContentCheckError";
  }
}

export interface PrepareOptions {
  outDir?: string;
  mediaDir?: string;
  fetchImpl?: typeof fetch;
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

export async function prepareContent(config: ContentConfig, options: PrepareOptions = {}): Promise<Manifest> {
  const outDir = options.outDir ?? preparedDir;
  const mediaDir = options.mediaDir ?? publicMediaDir;

  // Remove the old manifest first: if anything below fails, no page can be built from stale content.
  fs.rmSync(path.join(outDir, "manifest.json"), { force: true });

  const opened = await openSource(config, options.fetchImpl);
  const { content } = opened;

  const problems = validateContent(content);
  if (problems.length > 0) throw new ContentCheckError(problems);

  const table = buildRoutes(content);

  const used = referencedMediaIds(content);
  const assets = content.media.filter((asset) => used.has(asset.id));
  fs.rmSync(mediaDir, { recursive: true, force: true });
  fs.mkdirSync(mediaDir, { recursive: true });

  let files = 0;
  let bytes = 0;
  const copyProblems: string[] = [];
  // Files are named by content hash, so several media records can share one file. Copy each once.
  const jobsByFile = new Map<string, { asset: (typeof assets)[number]; file: string }>();
  for (const asset of assets) {
    for (const file of mediaFiles(asset)) {
      if (!jobsByFile.has(file)) jobsByFile.set(file, { asset, file });
    }
  }
  const jobs = [...jobsByFile.values()];
  await inBatches(jobs, 8, async ({ asset, file }) => {
    try {
      const data = await opened.readMedia(file);
      if (file === asset.path && data.length !== asset.size) {
        copyProblems.push(`${file} is ${data.length} bytes; the media list says ${asset.size}.`);
        return;
      }
      if (data.length === 0) {
        copyProblems.push(`${file} is empty.`);
        return;
      }
      fs.writeFileSync(path.join(mediaDir, path.basename(file)), data);
      files += 1;
      bytes += data.length;
    } catch (error) {
      copyProblems.push((error as Error).message);
    }
  });
  if (copyProblems.length > 0) throw new ContentCheckError(copyProblems.sort());

  const manifest: Manifest = {
    source: describeConfig(config),
    contentSha256: sha256(opened.raw),
    preparedAt: new Date().toISOString(),
    contentGeneratedAt: content.generatedAt,
    counts: content.counts,
    routes: table.routes.map((route) => ({
      path: route.path,
      pageType: route.pageType,
      collection: route.item.collection,
      slug: route.item.slug,
    })),
    errorPages: { "404": content.errorPages["404"] !== null, "500": content.errorPages["500"] !== null },
    skipped: table.skipped,
    media: { assetsListed: content.media.length, assetsUsed: assets.length, files, bytes },
    unresolvedReferences: content.unresolvedReferences,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "content.json"), opened.raw);
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
