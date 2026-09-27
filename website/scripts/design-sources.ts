/*
 * The ported design: every file in website/design/ and exactly where it came
 * from on feature/interviewer-portal (Phase C, Section 3).
 *
 *   npm run design:check                  compare website/design/ with the source
 *   npm run design:port                   (re)write website/design/ from the source
 *
 * The source is read with `git show <ref>:<path>` (default ref
 * origin/feature/interviewer-portal), or from a folder with --source-dir, e.g.
 * --source-dir "D:\work\DigitalHub\New Website\DH-WEBSITE-main".
 *
 * Files are copied byte for byte. Inline <style> and <script> blocks are
 * extracted byte for byte from between their tags. The only permitted change is
 * listed in `change` below and in docs/phase-c-website.md, "Ported with changes".
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { designFileList } from "../src/design/folder";
import { designSets, type DesignSet, type ScriptSlot } from "../src/design/sets";

export type DesignSource =
  | { file: string }
  | { page: string; style: number }
  | { page: string; script: number };

export interface DesignFile {
  /** Path inside website/design/, mirroring the source layout. */
  dest: string;
  from: DesignSource;
  /** SHA-256 of the source bytes on feature/interviewer-portal at eb05f064. */
  sourceSha256: string;
  change?: { line: number; before: string; after: string; reason: string };
}

export const designFiles: DesignFile[] = [
  { dest: "css/about-page.css", from: { file: "css/about-page.css" }, sourceSha256: "ac09553e7c31f58346ec25afc86f61ba520f510f693d03e979cdb90df4369c03" },
  { dest: "css/careers-page.css", from: { file: "css/careers-page.css" }, sourceSha256: "26a62fba8533acd4faadd8fd33e0866b4e688f1da353fa34561e78e7473d71df" },
  { dest: "css/hub-pages.css", from: { file: "css/hub-pages.css" }, sourceSha256: "881cc633c3e8410ca7c1e6d003ebc021e3a642228cb83a98c17b25f4e427367d" },
  { dest: "css/responsive.css", from: { file: "css/responsive.css" }, sourceSha256: "123997876c5c939d1f6c41d0851eb2fce9e87570fa2bb7cc68717bb703718f06" },
  { dest: "css/service-page.css", from: { file: "css/service-page.css" }, sourceSha256: "53d9eed5f6813a5f2c9729ff4d6aea4735c5cc7d8fca5b29394883369a9f0e83" },
  { dest: "css/shared.css", from: { file: "css/shared.css" }, sourceSha256: "ace9983cbce214d60096754dd560d8b7fe59b757200cf97191a9697a93f53a47" },
  { dest: "css/tv.css", from: { file: "css/tv.css" }, sourceSha256: "301f869ad918c2bdb4bfb1170da4b9333caab7c160b6f01cc53ea630b59ffcd7" },
  { dest: "index.inline.css", from: { page: "index.html", style: 1 }, sourceSha256: "fe9c34b90fbf1dec08b3fc08c67dfa5051104916e30fe239ac5e06e3fd132421" },
  { dest: "get-in-touch.inline.css", from: { page: "get-in-touch.html", style: 1 }, sourceSha256: "7c9e59a23146f54ab4c94f7611bd03efeaef915ba1a59819e6145a8c150834ea" },
  { dest: "assets/careers/apply-now.svg", from: { file: "assets/careers/apply-now.svg" }, sourceSha256: "76e20114689e8e8a201c573044255fe821d36a5663f621a81ede44971857d574" },
  { dest: "assets/careers/hero.webp", from: { file: "assets/careers/hero.webp" }, sourceSha256: "8e901f6f85744e6cf77d970a2aeb5bd8015d9f143acf7f3f63bb769fb19cbe25" },
  { dest: "js/shared.js", from: { file: "js/shared.js" }, sourceSha256: "1e06a346b3f6f74bf5be5c9be0a393956460fc77560fd283bc02917c557ddece" },
  { dest: "js/nav-stay-on-page.js", from: { file: "js/nav-stay-on-page.js" }, sourceSha256: "363dccceebac9347aa1abfcc6d1290d28f1dd9bb1147a5216114d7fc13179e04" },
  { dest: "js/hub-pages.js", from: { file: "js/hub-pages.js" }, sourceSha256: "b09a0c7338468b59f9c565b0904a750de57f62402e00db47d7b4459b93c7097f" },
  { dest: "js/about-page.js", from: { file: "js/about-page.js" }, sourceSha256: "78a17b61b2157248f0d8a2c5db581877aabd0e4c4050063f2b1771b27a1240cb" },
  { dest: "js/service-page.js", from: { file: "js/service-page.js" }, sourceSha256: "7a8fa7b9156ebbcececfcf0a09cc91e461c3dfe3e328cfeac728dbddebc3a18d" },
  { dest: "js/careers-apply.js", from: { file: "js/careers-apply.js" }, sourceSha256: "6c4840eafe407cbb2084289343296e0c89970f4dc65e220e6e2e7d6df66c9e59" },
  { dest: "js/webgl-fluid-lib.js", from: { file: "js/webgl-fluid-lib.js" }, sourceSha256: "027c72aa44b3eea2b36308fb9a9ab95785f07f02faf5043cb3e833599d6a33b3" },
  {
    dest: "js/hero-fluid.js",
    from: { file: "js/hero-fluid.js" },
    sourceSha256: "36e1e57c754537e63fd96f6329620615ed921a583c123180df9d0def26f7ffc7",
    change: {
      line: 7,
      before: 'import WebGLFluid from "./webgl-fluid-lib.js?v=26";',
      after: 'import WebGLFluid from "./webgl-fluid-lib.js";',
      reason: "No ?v= query strings anywhere (Section 2.6). The design folder is content-hashed instead.",
    },
  },
  { dest: "index.inline-1.js", from: { page: "index.html", script: 1 }, sourceSha256: "71f75819a7efe0ac2646704e088e69b345f01c8b19fcfd5c475ddd90eb2d2e87" },
  { dest: "index.inline-2.js", from: { page: "index.html", script: 2 }, sourceSha256: "34ffe53e5e4463e16375a5c7ce12d9378362885f6bcad375556529dd4ea5e2b9" },
  { dest: "index.inline-3.js", from: { page: "index.html", script: 3 }, sourceSha256: "4f1937dd027e8aa00a86a7a20e4f1d43df0c34cfc98d1d3d038b64ada8ad7bb4" },
  { dest: "index.inline-4.js", from: { page: "index.html", script: 4 }, sourceSha256: "25e5bcaa6ac2342db2eef3238cb0b443455b9f95e8abd85771afd2636a0cbcfc" },
  { dest: "index.inline-5.js", from: { page: "index.html", script: 5 }, sourceSha256: "b9a30aae1ba2368ea454f942b0f66b756673ee632361e62c66f23771d0764284" },
  { dest: "index.inline-6.js", from: { page: "index.html", script: 6 }, sourceSha256: "f3f460eb0bc30ed1f6d0ec12ee29c78f1c043b50d06f9577886aad49bdd0a609" },
];

export { designSourceDir as designDir } from "../src/design/folder";
import { designSourceDir as designDir } from "../src/design/folder";
export const defaultRef = "origin/feature/interviewer-portal";

export function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export type SourceReader = (sourcePath: string) => Buffer;

export function gitReader(ref: string, cwd = process.cwd()): SourceReader {
  return (sourcePath) => execFileSync("git", ["show", `${ref}:${sourcePath}`], { cwd, maxBuffer: 64 * 1024 * 1024 });
}

export function folderReader(dir: string): SourceReader {
  return (sourcePath) => fs.readFileSync(path.join(dir, ...sourcePath.split("/")));
}

/**
 * The bytes between the tags of the nth inline block, counted in document order.
 * Scripts with a src, and JSON-LD scripts, are not inline code and are not counted.
 */
export function extractInline(html: Buffer, kind: "style" | "script", n: number): Buffer {
  const text = html.toString("latin1"); // one char per byte, so indexes are byte offsets
  const pattern = kind === "style" ? /<style\b[^>]*>([\s\S]*?)<\/style>/g : /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let count = 0;
  for (const match of text.matchAll(pattern)) {
    if (kind === "script" && (/\bsrc\s*=/.test(match[1]) || /ld\+json/.test(match[1]))) continue;
    count += 1;
    if (count === n) {
      const body = kind === "style" ? match[1] : match[2];
      const start = match.index! + match[0].indexOf(">") + 1;
      return html.subarray(start, start + Buffer.byteLength(body, "latin1"));
    }
  }
  throw new Error(`No inline ${kind} #${n}.`);
}

export function readSource(file: DesignFile, read: SourceReader): Buffer {
  const from = file.from;
  if ("file" in from) return read(from.file);
  return "style" in from ? extractInline(read(from.page), "style", from.style) : extractInline(read(from.page), "script", from.script);
}

/** The ported bytes: the source, with the one declared line change applied. */
export function portBytes(file: DesignFile, source: Buffer): Buffer {
  if (!file.change) return source;
  const lines = source.toString("utf8").split("\n");
  const index = file.change.line - 1;
  if (lines[index] !== file.change.before) {
    throw new Error(`${file.dest}: line ${file.change.line} is not ${JSON.stringify(file.change.before)}.`);
  }
  lines[index] = file.change.after;
  return Buffer.from(lines.join("\n"), "utf8");
}

export interface CheckRow {
  dest: string;
  source: string;
  sourceSha256: string;
  portedSha256: string;
  status: "identical" | "ported with change" | "MISMATCH";
  detail?: string;
}

export function describeSource(from: DesignSource): string {
  if ("file" in from) return from.file;
  return "style" in from ? `${from.page} <style> #${from.style}` : `${from.page} inline <script> #${from.script}`;
}

export function checkDesign(read: SourceReader, dir = designDir): CheckRow[] {
  return designFiles.map((file) => {
    const source = readSource(file, read);
    const expected = portBytes(file, source);
    const destPath = path.join(dir, ...file.dest.split("/"));
    const ported = fs.existsSync(destPath) ? fs.readFileSync(destPath) : Buffer.alloc(0);
    const row: CheckRow = {
      dest: file.dest,
      source: describeSource(file.from),
      sourceSha256: sha256(source),
      portedSha256: sha256(ported),
      status: "identical",
    };
    if (file.sourceSha256 && file.sourceSha256 !== row.sourceSha256) {
      return { ...row, status: "MISMATCH", detail: `source hash is not the recorded ${file.sourceSha256}` };
    }
    if (!ported.equals(expected)) return { ...row, status: "MISMATCH", detail: "ported bytes differ from the source" };
    if (file.change) return { ...row, status: "ported with change", detail: `line ${file.change.line}` };
    return row;
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const valueOf = (name: string) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  };
  const sourceDir = valueOf("--source-dir");
  const ref = valueOf("--ref") ?? defaultRef;
  const read = sourceDir ? folderReader(sourceDir) : gitReader(ref);
  const origin = sourceDir ? `folder ${sourceDir}` : `git ${ref}`;

  if (args.includes("--write")) {
    fs.rmSync(designDir, { recursive: true, force: true });
    for (const file of designFiles) {
      const bytes = portBytes(file, readSource(file, read));
      const destPath = path.join(designDir, ...file.dest.split("/"));
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, bytes);
    }
    // Byte for byte on every platform: no line-ending conversion on checkout.
    fs.writeFileSync(path.join(designDir, ".gitattributes"), "* -text\n");
    console.log(`Ported ${designFiles.length} files from ${origin} into design/.`);
  }

  const rows = checkDesign(read);
  console.log(`Design files against ${origin}:`);
  for (const row of rows) {
    console.log(`  ${row.status.padEnd(18)} ${row.dest.padEnd(30)} ${row.sourceSha256}  ${row.portedSha256}${row.detail ? `  (${row.detail})` : ""}`);
  }
  const extra = designFileList(designDir).filter((name) => !designFiles.some((file) => file.dest === name));
  for (const name of extra) console.log(`  UNLISTED           ${name}`);
  const setProblems = checkSets(read);
  console.log(setProblems.length === 0
    ? `\nLoading order: all ${Object.keys(designSets).length} design sets match the ${Object.values(designSets).reduce((n, set) => n + set.from.length, 0)} old pages they come from.`
    : `\nLoading order problems:\n- ${setProblems.join("\n- ")}`);
  if (rows.some((row) => row.status === "MISMATCH") || extra.length > 0 || setProblems.length > 0) {
    console.error("\nThe design folder does not match its source.");
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} files match: ${rows.filter((row) => row.status === "identical").length} identical, ${rows.filter((row) => row.status !== "identical").length} ported with the recorded change.`);
}

/* ---- Loading order: each design set against the old pages it came from ---- */

/** Loaded by the old pages but deliberately not ported (Section 3 decisions). */
export const notPorted = [
  "content/site-content.js",
  "js/content-runtime.js",
  "get-in-touch.html inline <script> #1",
];

/** What an old page loads, in order, as design-set entries. */
export function oldPageLoads(page: string, read: SourceReader): string[] {
  const html = read(page).toString("latin1");
  const bodyStart = html.search(/<body\b/);
  const local = (url: string) => url.replace(/^(\.\.\/)+/, "").replace(/\?.*$/, "");
  const inlineDest = (kind: "style" | "script", n: number) =>
    designFiles.find((file) => "page" in file.from && file.from.page === page && (kind in file.from) && (file.from as Record<string, unknown>)[kind] === n)?.dest
    ?? `${page} inline <${kind}> #${n}`;

  const out: string[] = [];
  let styles = 0;
  let scripts = 0;
  for (const match of html.matchAll(/<link\b[^>]*>|<style\b[^>]*>[\s\S]*?<\/style>|<script\b([^>]*)>[\s\S]*?<\/script>/g)) {
    const tag = match[0];
    const at = match.index!;
    const before = html.slice(bodyStart, at);
    const slot: string = at < bodyStart ? "head"
      : [["</footer>", "body-end"], ["<main", "hero"], ["</nav>", "after-nav"]].map(([mark, name]) => [before.lastIndexOf(mark), name] as const)
          .reduce((best, next) => (next[0] > best[0] ? next : best), [-1, "body-start"] as const)[1];
    if (tag.startsWith("<link")) {
      const rel = /\brel="([^"]*)"/.exec(tag)?.[1] ?? "";
      if (!["preconnect", "stylesheet", "modulepreload"].includes(rel)) continue;
      const href = /\bhref="([^"]*)"/.exec(tag)![1];
      const url = /^https?:/.test(href) ? href : local(href);
      out.push(`head ${rel} ${url}${rel === "preconnect" && /\bcrossorigin\b/.test(tag) ? " crossorigin" : ""}`);
    } else if (tag.startsWith("<style")) {
      styles += 1;
      out.push(`head stylesheet ${inlineDest("style", styles)}`);
    } else {
      const attrs = match[1] ?? "";
      if (/ld\+json/.test(attrs)) continue;
      const src = /\bsrc="([^"]*)"/.exec(attrs)?.[1];
      const flags = [/type="module"/.test(attrs) ? " module" : "", /\basync\b/.test(attrs) ? " async" : "", /\bdefer\b/.test(attrs) ? " defer" : ""].join("");
      let name: string;
      if (src) name = /^https?:/.test(src) ? src : local(src);
      else {
        scripts += 1;
        name = inlineDest("script", scripts);
      }
      if (notPorted.includes(name)) continue;
      out.push(`${slot} script ${name}${flags}`);
    }
  }
  return out;
}

/** The same list, from a design set. */
export function setLoads(set: DesignSet): string[] {
  const out = set.head.map((item) => `head ${item.rel} ${item.href}${item.rel === "preconnect" && item.crossOrigin ? " crossorigin" : ""}`);
  for (const slot of ["body-start", "after-nav", "hero", "body-end"] as ScriptSlot[]) {
    for (const script of set.scripts[slot] ?? []) out.push(`${slot} script ${script.src}${script.module ? " module" : ""}`);
  }
  return out;
}

export function checkSets(read: SourceReader): string[] {
  const problems: string[] = [];
  for (const [name, set] of Object.entries(designSets) as [string, DesignSet][]) {
    const expected = setLoads(set);
    for (const page of set.from) {
      const actual = oldPageLoads(page, read);
      if (actual.join("\n") !== expected.join("\n")) {
        problems.push(`${name} vs ${page}:\n    old:  ${actual.join("\n          ")}\n    new:  ${expected.join("\n          ")}`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
