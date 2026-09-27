/*
 * npm run prepare:content — runs before `next build` and `next dev`.
 *
 * Reads the source named by CONTENT_SOURCE, checks it, and writes .content/ and
 * public/media/. Exits non-zero with the reason on any problem, including when
 * no source is configured.
 */
import { ContentConfigError, describeConfig, readContentConfig } from "../src/content/config";
import { ContentCheckError, prepareContent } from "../src/content/prepare";
import { ContentSourceError } from "../src/content/sources";
import { RouteError } from "../src/content/routes";

async function main(): Promise<void> {
  const config = readContentConfig();
  console.log(`Content source: ${describeConfig(config)}`);

  const manifest = await prepareContent(config);

  console.log(`Content generated at ${manifest.contentGeneratedAt}`);
  console.log(`Items: ${Object.entries(manifest.counts).map(([name, count]) => `${name} ${count}`).join(", ")}`);
  console.log(`Routes: ${manifest.routes.length} pages, plus 404 (${manifest.errorPages["404"] ? "published" : "not published"}) and 500 (${manifest.errorPages["500"] ? "published" : "not published"})`);
  console.log(`Media: ${manifest.media.assetsUsed} of ${manifest.media.assetsListed} assets used; ${manifest.media.files} files, ${manifest.media.bytes.toLocaleString("en-US")} bytes copied to public/media/`);

  if (!manifest.errorPages["404"] || !manifest.errorPages["500"]) {
    console.warn("Warning: an error page is not published. Its route is built with no content until it is.");
  }
  if (manifest.unresolvedReferences.length === 0) {
    console.log("Unresolved references: none");
  } else {
    console.warn(`Unresolved references: ${manifest.unresolvedReferences.length}. These render nothing:`);
    for (const reference of manifest.unresolvedReferences) {
      console.warn(`  ${reference.type}:${reference.id} used by ${reference.usedBy}`);
    }
  }
}

main().catch((error: unknown) => {
  const known = [ContentConfigError, ContentSourceError, ContentCheckError, RouteError].some((type) => error instanceof type);
  console.error(known ? `\n${(error as Error).message}\n` : error);
  process.exit(1);
});
