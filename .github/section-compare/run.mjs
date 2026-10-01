/*
 * CI driver for website/tools/section-compare: opens the comparison page the
 * harness serves, waits for its result (window.__result), and writes it out.
 * The comparison itself is the harness's; nothing here changes what it checks.
 *
 *   node .github/section-compare/run.mjs <url> <outDir>
 *
 * Writes result.json (the harness's own result), report.md (also appended to
 * the job summary), page.html and page.png. Exits 1 only when the harness does
 * not produce a result; differences are reported, not failed on.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [url = "http://127.0.0.1:4190/", outDir = "section-compare-output"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const consoleLines = [];
page.on("console", (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
page.on("pageerror", (error) => consoleLines.push(`[pageerror] ${error.message}`));

let result = null;
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__result !== undefined, null, { timeout: 15 * 60 * 1000, polling: 1000 });
  result = await page.evaluate(() => window.__result);
} catch (error) {
  consoleLines.push(`[driver] ${error instanceof Error ? error.message : String(error)}`);
}

fs.writeFileSync(path.join(outDir, "page.html"), await page.content());
await page.screenshot({ path: path.join(outDir, "page.png"), fullPage: true });
fs.writeFileSync(path.join(outDir, "console.log"), consoleLines.join("\n") + "\n");
await browser.close();

if (result === null) {
  const message = "The section comparison produced no result. See console.log and page.png in the artifact.";
  fs.writeFileSync(path.join(outDir, "report.md"), `## Section comparison\n\n${message}\n`);
  console.error(message);
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");

const count = (status) => result.results.filter((entry) => entry.status === status).length;
const pages = new Map();
for (const entry of result.results) {
  const row = pages.get(entry.page) ?? { total: 0, match: 0 };
  row.total += 1;
  if (entry.status === "match") row.match += 1;
  pages.set(entry.page, row);
}
const lines = [
  "## Section comparison",
  "",
  `**${result.matched} of ${result.total}** sections on feature/interviewer-portal match the build — ` +
    `${count("differs")} differ, ${count("renders nothing")} render nothing, ${count("extra in new")} extra in the build.`,
  "",
  "| Old page | Matched |",
  "|---|---|",
  ...[...pages].map(([name, row]) => `| \`${name}\` | ${row.match} / ${row.total} |`),
  "",
  "Every section that is not a match:",
  "",
  ...result.results
    .filter((entry) => entry.status !== "match")
    .map((entry) => `- ${entry.status}: \`${entry.page}\` \`${entry.id}\``),
  "",
];
fs.writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
console.log(lines.join("\n"));
