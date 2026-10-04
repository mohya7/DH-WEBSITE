/*
 * npm run webconfig — runs after `next build` as part of `npm run build`.
 *
 * Writes out/web.config from the prepared content's redirects. The pages are
 * already in out/; this adds the IIS configuration that serves them.
 */
import fs from "node:fs";
import path from "node:path";
import type { BuildContent } from "../src/content/build-content";
import { WebConfigError, renderWebConfig } from "../src/iis/web-config";

/** Next's app router also emits _not-found.html. The site uses 404.html; the extra file is not served. */
function removeNotFound(outDir: string): void {
  const gone: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(outDir, full).split(path.sep).join("/");
      if (relative === "_not-found.html" || relative === "_not-found" || relative.startsWith("_not-found/")) {
        fs.rmSync(full, { recursive: true, force: true });
        gone.push(relative);
      } else if (entry.isDirectory()) walk(full);
    }
  };
  walk(outDir);
  if (gone.length > 0) console.log(`Removed Next's not-found export: ${gone.join(", ")}.`);
}

function main(): void {
  const root = process.cwd();
  const contentFile = path.join(root, ".content", "content.json");
  const outDir = path.join(root, "out");
  if (!fs.existsSync(contentFile) || !fs.existsSync(outDir)) {
    throw new WebConfigError("The site has not been built. Run `npm run build` in website/.");
  }
  const content = JSON.parse(fs.readFileSync(contentFile, "utf8")) as BuildContent;
  removeNotFound(outDir);
  fs.writeFileSync(path.join(outDir, "web.config"), renderWebConfig(content.redirects));
  console.log(`web.config: ${content.redirects.length} redirect(s) from the redirects table, written to out/web.config.`);
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof WebConfigError ? `\n${error.message}\n` : error);
  process.exit(1);
}
