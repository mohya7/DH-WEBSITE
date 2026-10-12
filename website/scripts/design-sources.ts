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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { designFileList } from "../src/design/folder";
import { designFiles, lockedDesignProblems, sha256, type DesignFile, type DesignSource } from "../src/design/lock";
import { designSets, type DesignSet, type ScriptSlot } from "../src/design/sets";

export type { DesignFile, DesignSource };
export { designFiles, lockedDesignProblems, sha256 };

export { designSourceDir as designDir } from "../src/design/folder";
import { designSourceDir as designDir } from "../src/design/folder";
export const defaultRef = "origin/feature/interviewer-portal";

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
  const locked = lockedDesignProblems(designDir);
  for (const problem of locked) console.log(`  LOCKED             ${problem}`);
  const setProblems = checkSets(read);
  console.log(setProblems.length === 0
    ? `\nLoading order: all ${Object.keys(designSets).length} design sets match the ${Object.values(designSets).reduce((n, set) => n + set.from.length, 0)} old pages they come from.`
    : `\nLoading order problems:\n- ${setProblems.join("\n- ")}`);
  if (rows.some((row) => row.status === "MISMATCH") || extra.length > 0 || locked.length > 0 || setProblems.length > 0) {
    console.error("\nThe design folder does not match its source.");
    if (locked.length > 0) console.error(locked.join("\n"));
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
