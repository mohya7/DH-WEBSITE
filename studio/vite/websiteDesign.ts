/*
 * The website's design files, for the Studio's preview frame (Phase C, 9.1).
 *
 * There is one copy of the design: website/design/, the folder the website build
 * publishes as /design/<hash>/. The Studio never keeps a second copy in its source.
 * It serves that folder, byte for byte, at /website-design/<hash>/ in development
 * and emits it into dist/website-design/<hash>/ when it builds, using the
 * website's own file list and content hash (website/src/design/folder.ts).
 * After a build, website/design/ is checked against the hashes recorded in
 * website/scripts/design-sources.ts, and the emitted copy is checked against
 * that folder. `npm run check:preview-design` runs the same checks on an
 * existing dist. A changed, deleted, or added design file fails the build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { designFileList, designHash } from "../../website/src/design/folder.ts";
import { lockedDesignProblems } from "../../website/src/design/lock.ts";

export const designSource = fileURLToPath(new URL("../../website/design/", import.meta.url));
export const designMount = "website-design";

const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/** /website-design/<hash>/ — the folder name follows the website's own design hash. */
export function designBase(source: string = designSource): string {
  return `/${designMount}/${designHash(source)}/`;
}

/** Every file that differs between the source and a copy, or is missing from either. */
export function designDifferences(copy: string, source: string = designSource): string[] {
  const expected = designFileList(source);
  const actual = fs.existsSync(copy) ? designFileList(copy) : [];
  const problems: string[] = [];
  for (const name of expected) {
    const target = path.join(copy, ...name.split("/"));
    if (!fs.existsSync(target)) problems.push(`missing: ${name}`);
    else if (!fs.readFileSync(target).equals(fs.readFileSync(path.join(source, ...name.split("/"))))) problems.push(`differs: ${name}`);
  }
  for (const name of actual) {
    if (!expected.includes(name)) problems.push(`extra: ${name}`);
  }
  return problems;
}

export function websiteDesign(): Plugin {
  const base = designBase();
  let outDir = "dist";
  let isBuild = false;
  return {
    name: "digitalhub:website-design",
    config: () => ({ define: { __WEBSITE_DESIGN_BASE__: JSON.stringify(base) } }),
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === "build";
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? "").split("?")[0];
        if (!url.startsWith(base)) return next();
        const name = decodeURIComponent(url.slice(base.length));
        // Only the files the website itself publishes; nothing outside the folder.
        if (!designFileList(designSource).includes(name)) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader("Content-Type", types[path.extname(name).toLowerCase()] ?? "application/octet-stream");
        response.setHeader("Cache-Control", "no-cache");
        response.end(fs.readFileSync(path.join(designSource, ...name.split("/"))));
      });
    },
    generateBundle() {
      for (const name of designFileList(designSource)) {
        this.emitFile({ type: "asset", fileName: `${base.slice(1)}${name}`, source: fs.readFileSync(path.join(designSource, ...name.split("/"))) });
      }
    },
    closeBundle() {
      if (!isBuild) return;
      const copy = path.join(outDir, ...base.split("/").filter(Boolean));
      const problems = [...lockedDesignProblems(designSource), ...designDifferences(copy)];
      if (problems.length > 0) {
        throw new Error(`The preview's design files do not match the locked design set:\n${problems.join("\n")}`);
      }
    },
  };
}
