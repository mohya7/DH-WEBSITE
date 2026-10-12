/*
 * npm run seo — after the pages are stripped, as part of `npm run build`.
 *
 * Writes sitemap.xml, robots.txt, and llms.txt into out/ from the prepared
 * content and PUBLIC_SITE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import type { BuildContent } from "../src/content/build-content";
import { createSite } from "../src/content/site";
import { renderLlms, renderRobots, renderSitemap } from "../src/seo/files";
import { readSiteUrl, SiteUrlError } from "../src/seo/site-url";

function main(): void {
  const root = process.cwd();
  const contentFile = path.join(root, ".content", "content.json");
  const outDir = path.join(root, "out");
  if (!fs.existsSync(contentFile) || !fs.existsSync(outDir)) {
    throw new SiteUrlError("The site has not been built. Run `npm run build` in website/.");
  }
  const origin = readSiteUrl();
  const site = createSite(JSON.parse(fs.readFileSync(contentFile, "utf8")) as BuildContent);
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(site, origin));
  fs.writeFileSync(path.join(outDir, "robots.txt"), renderRobots(origin));
  fs.writeFileSync(path.join(outDir, "llms.txt"), renderLlms(site, origin));
  console.log(`SEO files: sitemap.xml, robots.txt, and llms.txt for ${origin}.`);
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof SiteUrlError ? `\n${error.message}\n` : error);
  process.exit(1);
}
