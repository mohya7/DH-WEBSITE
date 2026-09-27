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
 *   - the ported design is in out/design/<hash>/, one folder only, byte for
 *     byte the same as website/design/; every /design/ URL a page loads exists;
 *     and no ported script imports anything with ?v=
 *   - every page loads exactly its design set: its preconnects, stylesheets, and
 *     module preloads each in the set's order (React places preconnects first
 *     and module preloads after the stylesheets), and its scripts in order and
 *     position, with nothing from another set
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifest } from "../src/content/prepared";
import { designFileList, designHash } from "../src/design/folder";
import { designSets, type DesignSetName, type ScriptSlot } from "../src/design/sets";

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

export function checkOutput(outDir: string, manifest: Manifest, options: { designDir?: string } = {}): OutputReport {
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
      if (!url.startsWith("/_next/") && !url.startsWith("/design/")) continue;
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

  if (options.designDir) {
    problems.push(...checkDesignOutput(outDir, files, options.designDir));
    for (const file of [...expected.keys(), "404.html", "500.html"].filter((name) => fileSet.has(name))) {
      problems.push(...checkDesignLoading(file, fs.readFileSync(path.join(outDir, file), "utf8")));
    }
  }

  return { pages, errorPages, assets, images, problems };
}

/** What a built page loads from its design set, grouped the way it can be compared. */
export function pageLoads(html: string): { set: string | undefined; lists: Record<string, string[]> } {
  const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
  const body = html.slice(html.indexOf("<body"));
  const local = (url: string) => url.replace(/^\/design\/[0-9a-f]+\//, "").replace(/&amp;/g, "&");
  const lists: Record<string, string[]> = { preconnect: [], stylesheet: [], modulepreload: [], "before-main": [], hero: [], "body-end": [] };
  for (const tag of head.match(/<link\b[^>]*>/g) ?? []) {
    const rel = /\brel="([^"]*)"/.exec(tag)?.[1] ?? "";
    const href = /\bhref="([^"]*)"/.exec(tag)?.[1] ?? "";
    if (href.startsWith("/_next/") || !(rel in lists)) continue;
    lists[rel].push(`${local(href)}${rel === "preconnect" && /\bcrossorigin/.test(tag) ? " crossorigin" : ""}`);
  }
  const mainStart = body.indexOf("<main");
  const mainEnd = body.indexOf("</main>");
  for (const match of body.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)>/g)) {
    const src = match[2];
    if (src.startsWith("/_next/")) continue;
    const attrs = match[1] + match[3];
    const where = match.index! < mainStart ? "before-main" : mainEnd === -1 || match.index! < mainEnd ? "hero" : "body-end";
    const flags = [/type="module"/.test(attrs) ? " module" : "", /\basync\b/.test(attrs) ? " async" : "", /\bdefer\b/.test(attrs) ? " defer" : ""].join("");
    lists[where].push(local(src) + flags);
  }
  return { set: /data-design-set="([^"]+)"/.exec(body)?.[1], lists };
}

export function expectedLoads(name: DesignSetName): Record<string, string[]> {
  const set = designSets[name];
  const scripts = (slot: ScriptSlot) => ((set.scripts as Partial<Record<ScriptSlot, { src: string; module?: true }[]>>)[slot] ?? []).map((script) => script.src + (script.module ? " module" : ""));
  return {
    preconnect: set.head.flatMap((item) => (item.rel === "preconnect" ? [`${item.href}${item.crossOrigin ? " crossorigin" : ""}`] : [])),
    stylesheet: set.head.flatMap((item) => (item.rel === "stylesheet" ? [item.href] : [])),
    modulepreload: set.head.flatMap((item) => (item.rel === "modulepreload" ? [item.href] : [])),
    "before-main": [...scripts("body-start"), ...scripts("after-nav")],
    hero: scripts("hero"),
    "body-end": scripts("body-end"),
  };
}

export function checkDesignLoading(file: string, html: string): string[] {
  const { set, lists } = pageLoads(html);
  if (!set || !(set in designSets)) return [`${file} does not name its design set.`];
  const expected = expectedLoads(set as DesignSetName);
  const problems: string[] = [];
  for (const [kind, want] of Object.entries(expected)) {
    if (lists[kind].join("\n") !== want.join("\n")) {
      problems.push(`${file} (${set}) ${kind}: loads [${lists[kind].join(", ")}], expected [${want.join(", ")}].`);
    }
  }
  return problems;
}

/** out/design/<hash>/ is exactly website/design/, byte for byte, under its current hash. */
export function checkDesignOutput(outDir: string, files: string[], designDir: string): string[] {
  const problems: string[] = [];
  const hash = designHash(designDir);
  const folders = [...new Set(files.filter((file) => file.startsWith("design/")).map((file) => file.split("/")[1]))];
  if (folders.length !== 1 || folders[0] !== hash) {
    problems.push(`out/design/ should hold exactly one folder, ${hash}; it holds: ${folders.join(", ") || "nothing"}.`);
  }
  const expected = designFileList(designDir);
  const published = files.filter((file) => file.startsWith(`design/${hash}/`)).map((file) => file.slice(`design/${hash}/`.length)).sort();
  for (const name of expected) {
    const outFile = path.join(outDir, "design", hash, ...name.split("/"));
    if (!fs.existsSync(outFile)) problems.push(`design/${hash}/${name} is missing from the output.`);
    else if (!fs.readFileSync(outFile).equals(fs.readFileSync(path.join(designDir, ...name.split("/"))))) {
      problems.push(`design/${hash}/${name} differs from website/design/${name}.`);
    }
  }
  for (const name of published.filter((file) => !expected.includes(file))) problems.push(`design/${hash}/${name} is not in website/design/.`);
  for (const name of expected.filter((file) => /\.m?js$/.test(file))) {
    const text = fs.readFileSync(path.join(designDir, ...name.split("/")), "utf8");
    if (/\bimport\b[^;]*?["'][^"']*[?&]v=[^"']*["']/.test(text)) problems.push(`design/${name} imports a module with a ?v= query string.`);
  }
  return problems;
}

function main(): void {
  const websiteRoot = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(websiteRoot, ".content", "manifest.json"), "utf8")) as Manifest;
  const report = checkOutput(path.join(websiteRoot, "out"), manifest, { designDir: path.join(websiteRoot, "design") });

  console.log(`\nBuilt from ${manifest.source}, content generated at ${manifest.contentGeneratedAt}`);
  console.log(`${report.pages.length} pages, plus error pages: ${report.errorPages.join(", ")}`);
  for (const page of report.pages) console.log(`  ${page.route.padEnd(40)} ${page.pageType.padEnd(11)} out/${page.file}`);
  console.log(`${report.images} images and ${report.assets} framework and design asset references checked.`);
  console.log(`Loading order: every page loads exactly its design set.`);
  console.log(`Design: out/design/${designHash(path.join(websiteRoot, "design"))}/ matches website/design/ byte for byte (${designFileList(path.join(websiteRoot, "design")).length} files).`);

  if (report.problems.length > 0) {
    console.error(`\nThe build output failed its checks:\n- ${report.problems.join("\n- ")}\n`);
    process.exit(1);
  }
  console.log("Build output checks passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
