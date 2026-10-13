/*
 * npm run check:preview-design — after `npm run build`.
 *
 * Fails if the design files in dist/website-design/<hash>/ differ in any byte from
 * website/design/, the single source the website build publishes, or if the folder
 * name is not the website's current design hash.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { designBase, designDifferences, designMount, designSource } from "../vite/websiteDesign.ts";
import { lockedDesignProblems } from "../../website/src/design/lock.ts";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const base = designBase();
const copy = path.join(dist, ...base.split("/").filter(Boolean));
const mounted = path.join(dist, designMount);
const folders = fs.existsSync(mounted) ? fs.readdirSync(mounted) : [];

const problems = [...lockedDesignProblems(designSource), ...designDifferences(copy)];
for (const folder of folders) {
  if (`/${designMount}/${folder}/` !== base) problems.push(`stale folder: ${designMount}/${folder}`);
}

if (problems.length > 0) {
  console.error(`The Studio preview's design files do not match the locked design set (expected ${base}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Preview design: ${base} matches website/design/ byte for byte.`);
