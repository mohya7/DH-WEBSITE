/*
 * npm run check:output — runs after `next build` as part of `npm run build`.
 *
 * Checks the static export in out/ and prints the route report:
 *   - every route in the manifest has its page, and there are no other pages
 *     besides the error pages, so nothing outside the published content exists
 *   - no ?v= cache-busting query string on any of the site's own URLs, in any
 *     page or stylesheet; scripts and stylesheets carry no query string at all,
 *     because the framework hashes their file names. External links are not
 *     assets and are left alone (a YouTube watch?v= link is content)
 *   - every image and framework asset an HTML page references is in out/, and
 *     images come from the build output, never another host
 *   - no source, fixture, or prepared-content file is in out/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifest } from "../src/content/prepared";

export interface OutputReport {
  pages: { route: string; file: string; pageType: string }[];
  errorPages: string[];
  assets: number;
  images: number;
  problems: string[];
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function htmlFileFor(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

const errorFiles = ["404.html", "500.html", "_not-found.html"];

/** A URL served by this site: no scheme and not protocol-relative. */
function isOwnUrl(url: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("//");
}

const cacheBuster = /[?&]v=/;

/** Every URL in src, href, and srcset attributes, and in CSS url() and @import. */
function referencedUrls(text: string, kind: "html" | "css"): string[] {
  const urls: string[] = [];
  if (kind === "html") {
    for (const match of text.matchAll(/\b(?:src|href|srcset)="([^"]*)"/gi)) {
      urls.push(...match[1].split(",").map((entry) => entry.trim().split(/\s+/)[0]).filter(Boolean));
    }
  }
  for (const match of text.matchAll(/url\(\s*['"]?([^'")\s]+)|@import\s+['"]([^'"]+)['"]/g)) {
    urls.push(match[1] ?? match[2]);
  }
  return urls;
}
const forbiddenNames = [/^content\.json$/, /^manifest\.json$/, /^package(-lock)?\.json$/, /\.tsx?$/, /^tsconfig/, /^next\.config/];

export function checkOutput(outDir: string, manifest: Manifest): OutputReport {
  const problems: string[] = [];
  if (!fs.existsSync(outDir)) {
    return { pages: [], errorPages: [], assets: 0, images: 0, problems: [`${outDir} does not exist. Run next build first.`] };
  }

  const files = walk(outDir).map((file) => path.relative(outDir, file).split(path.sep).join("/"));
  const fileSet = new Set(files);

  // Pages: exactly the manifest's routes, plus the error pages.
  const expected = new Map(manifest.routes.map((route) => [htmlFileFor(route.path), route]));
  const pages: OutputReport["pages"] = [];
  for (const [file, route] of expected) {
    if (!fileSet.has(file)) problems.push(`Route ${route.path} has no ${file}.`);
    else pages.push({ route: route.path, file, pageType: route.pageType });
  }
  const errorPages = errorFiles.filter((file) => fileSet.has(file));
  for (const file of ["404.html", "500.html"]) {
    if (!fileSet.has(file)) problems.push(`${file} is missing.`);
  }
  for (const file of files.filter((name) => name.endsWith(".html"))) {
    if (!expected.has(file) && !errorFiles.includes(file)) problems.push(`${file} is not a route of the published content.`);
  }

  // Nothing that is not meant to be served.
  for (const file of files) {
    const base = path.posix.basename(file);
    if (file.startsWith("fixtures/") || file.startsWith(".content/") || forbiddenNames.some((pattern) => pattern.test(base))) {
      problems.push(`${file} should not be in the build output.`);
    }
  }

  // No ?v= on the site's own URLs, and every referenced asset exists.
  let assets = 0;
  let images = 0;
  for (const file of files) {
    const extension = path.posix.extname(file);
    if (extension !== ".html" && extension !== ".css") continue;
    const text = fs.readFileSync(path.join(outDir, file), "utf8");
    for (const url of referencedUrls(text, extension === ".html" ? "html" : "css")) {
      if (isOwnUrl(url) && cacheBuster.test(url)) problems.push(`${file} references ${url} with a ?v= query string.`);
    }
    if (extension !== ".html") continue;

    for (const match of text.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
      const url = match[1];
      if (!url.startsWith("/_next/")) continue;
      if (url.includes("?")) problems.push(`${file} loads ${url} with a query string.`);
      else if (!fileSet.has(url.slice(1))) problems.push(`${file} loads ${url}, which is not in the output.`);
      else assets += 1;
    }

    for (const match of text.matchAll(/<img\b[^>]*>/g)) {
      const tag = match[0];
      const src = /\bsrc="([^"]+)"/.exec(tag)?.[1];
      const width = /\bwidth="(\d+)"/.exec(tag)?.[1];
      const height = /\bheight="(\d+)"/.exec(tag)?.[1];
      if (!src) problems.push(`${file} has an <img> with no src.`);
      if (!width || !height) problems.push(`${file} has an <img> without explicit width and height: ${tag}`);
      const srcset = /\bsrcSet="([^"]+)"/i.exec(tag)?.[1] ?? "";
      const urls = [src, ...srcset.split(",").map((entry) => entry.trim().split(/\s+/)[0])].filter(Boolean) as string[];
      for (const url of urls) {
        if (!url.startsWith("/media/") && !url.startsWith("/_next/static/")) problems.push(`${file} has an image that is not served from the build output: ${url}`);
        else if (!fileSet.has(url.slice(1))) problems.push(`${file} uses ${url}, which is not in the output.`);
      }
      images += 1;
    }
  }

  return { pages, errorPages, assets, images, problems };
}

function main(): void {
  const websiteRoot = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(websiteRoot, ".content", "manifest.json"), "utf8")) as Manifest;
  const report = checkOutput(path.join(websiteRoot, "out"), manifest);

  console.log(`\nBuilt from ${manifest.source}, content generated at ${manifest.contentGeneratedAt}`);
  console.log(`${report.pages.length} pages, plus error pages: ${report.errorPages.join(", ")}`);
  for (const page of report.pages) console.log(`  ${page.route.padEnd(40)} ${page.pageType.padEnd(11)} out/${page.file}`);
  console.log(`${report.images} images and ${report.assets} framework asset references checked.`);

  if (report.problems.length > 0) {
    console.error(`\nThe build output failed its checks:\n- ${report.problems.join("\n- ")}\n`);
    process.exit(1);
  }
  console.log("Build output checks passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
