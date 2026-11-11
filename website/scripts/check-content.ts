/*
 * npm run check:content -- <file>
 *
 * Runs the website build's schema, media and redirect checks (checkContent) on a
 * BuildContent JSON file, such as a saved response of GET /api/v1/build/content.
 * Prints each problem on its own line and exits 1, or prints the pass line and
 * exits 0. It does not run the route or output checks; only a build does.
 */
import fs from "node:fs";
import type { BuildContent } from "../src/content/build-content";
import { checkContent } from "../src/content/check-content";

function main(): number {
  const file = process.argv[2];
  if (!file) {
    console.error("Name the content file: npm run check:content -- <file>");
    return 2;
  }
  const content = JSON.parse(fs.readFileSync(file, "utf8")) as BuildContent;
  const problems = checkContent(content);
  if (problems.length > 0) {
    for (const problem of problems) console.log(problem);
    return 1;
  }
  console.log("The content passed the website's schema, media and redirect checks (not the route or output checks).");
  return 0;
}

process.exit(main());
