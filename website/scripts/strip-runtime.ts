/*
 * npm run strip:runtime — runs after `next build` as part of `npm run build`.
 *
 * Removes Next's client runtime from every page in out/ (see
 * src/build/strip-runtime.ts for each removal and why it is safe), then deletes
 * the files only that runtime used: the .txt payloads client-side navigation
 * fetches, and the /_next/ scripts no page references any more. Stops the build
 * if any page still has a trace of the runtime afterwards.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removals, runtimeTracesIn, stripRuntime } from "../src/build/strip-runtime";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function stripOutput(outDir: string): { pages: number; removed: Record<string, number>; payloadFiles: number; runtimeFiles: number; problems: string[] } {
  const removed: Record<string, number> = Object.fromEntries(removals.map((removal) => [removal.name, 0]));
  const problems: string[] = [];
  const files = walk(outDir);
  const pages = files.filter((file) => file.endsWith(".html"));

  for (const file of pages) {
    const result = stripRuntime(fs.readFileSync(file, "utf8"));
    for (const [name, count] of Object.entries(result.removed)) removed[name] += count;
    fs.writeFileSync(file, result.html);
    const left = runtimeTracesIn(result.html);
    if (left.length > 0) problems.push(`${path.relative(outDir, file)} still contains ${left.join(", ")}.`);
  }

  // The .txt files are React Server Components payloads, fetched only by client-side navigation.
  const payloads = files.filter((file) => file.endsWith(".txt"));
  for (const file of payloads) fs.rmSync(file);

  // /_next/ holds only the runtime's scripts. Nothing may reference it now; if something does, stop.
  const nextDir = path.join(outDir, "_next");
  let runtimeFiles = 0;
  if (fs.existsSync(nextDir)) {
    const nextFiles = walk(nextDir);
    const other = nextFiles.filter((file) => !file.endsWith(".js"));
    if (other.length > 0) {
      problems.push(`_next/ holds files that are not runtime scripts: ${other.map((file) => path.relative(outDir, file)).join(", ")}.`);
    } else {
      runtimeFiles = nextFiles.length;
      fs.rmSync(nextDir, { recursive: true });
    }
  }

  // Remove folders the payloads leave empty (for example out/about/ beside about.html).
  const removeEmpty = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) removeEmpty(path.join(dir, entry.name));
    }
    if (dir !== outDir && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  };
  removeEmpty(outDir);

  return { pages: pages.length, removed, payloadFiles: payloads.length, runtimeFiles, problems };
}

function main(): void {
  const outDir = path.join(process.cwd(), "out");
  const result = stripOutput(outDir);
  console.log(`Removed Next's client runtime from ${result.pages} pages:`);
  for (const removal of removals) console.log(`  ${String(result.removed[removal.name]).padStart(4)}  ${removal.name}`);
  console.log(`  ${String(result.payloadFiles).padStart(4)}  .txt payload files deleted`);
  console.log(`  ${String(result.runtimeFiles).padStart(4)}  runtime scripts deleted from _next/`);
  if (result.problems.length > 0) {
    console.error(`\nNext's runtime is still in the output:\n- ${result.problems.join("\n- ")}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
