/*
 * The content-hashed design folder.
 *
 * website/design/ is served at /design/<hash>/ with its layout unchanged, so every
 * relative url(), @import, and module import resolves exactly as it does on the
 * old site. The hash covers every file's path and bytes: any change to any file
 * gives a new folder, so the folder can be cached as immutable.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const designSourceDir = path.join(process.cwd(), "design");
export const designPublicRoot = path.join(process.cwd(), "public", "design");

export function designFileList(dir: string = designSourceDir): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join("/"));
    }
  };
  walk(dir);
  // .gitattributes keeps line endings untouched in git; it is not served.
  return out.filter((name) => name !== ".gitattributes").sort();
}

export function designHash(dir: string = designSourceDir): string {
  const hash = crypto.createHash("sha256");
  for (const name of designFileList(dir)) {
    hash.update(name);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(dir, ...name.split("/"))));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

let cachedBase: string | undefined;

/** /design/<hash>/ — memoised per process; the folder does not change during a build. */
export function designBase(): string {
  cachedBase ??= `/design/${designHash()}/`;
  return cachedBase;
}

/** A design path as a URL. External URLs are returned unchanged. */
export function designUrl(href: string, base: string = designBase()): string {
  return /^https?:\/\//.test(href) ? href : base + href;
}

/** Copies website/design/ to public/design/<hash>/, removing any older folder. */
export function publishDesign(dir: string = designSourceDir, publicRoot: string = designPublicRoot): { hash: string; files: number } {
  const hash = designHash(dir);
  fs.rmSync(publicRoot, { recursive: true, force: true });
  const files = designFileList(dir);
  for (const name of files) {
    const to = path.join(publicRoot, hash, ...name.split("/"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(dir, ...name.split("/")), to);
  }
  return { hash, files: files.length };
}
