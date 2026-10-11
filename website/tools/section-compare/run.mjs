/*
 * Runs website/tools/section-compare: serves the old site and the build, opens
 * the comparison page, waits for its result (window.__result), and writes it out.
 * The comparison itself is compare.html; nothing here changes what it checks.
 *
 *   npm run compare:sections
 *   SECTION_COMPARE_OLD=... SECTION_COMPARE_NEW=... SECTION_COMPARE_PORT=4390
 *
 * Or, when a server is already running:
 *   node tools/section-compare/run.mjs <url> <outDir>
 *
 * Writes result.json (the harness's own result), report.md, page.html and page.png.
 *
 * Fails (exit 1) when the harness produces no result, or when any section is
 * not a match and is not in accepted-differences.json with the same status
 * and, for "differs", exactly the same reported differences. Accepted entries
 * that no longer occur are reported as stale, without failing.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const accepted = JSON.parse(fs.readFileSync(path.join(here, "accepted-differences.json"), "utf8")).accepted;
const key = (entry) => `${entry.status} ${entry.page} ${entry.id}`;
const registerPath = "website/tools/section-compare/accepted-differences.json";

const started = await startServerUnlessGiven();
const url = started.url;
const outDir = started.outDir;
fs.mkdirSync(outDir, { recursive: true });

let browser;
let result = null;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const consoleLines = [];
  page.on("console", (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => consoleLines.push(`[pageerror] ${error.message}`));

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
} finally {
  if (browser) await browser.close();
  await started.stop();
}

if (result === null) {
  const message = "The section comparison produced no result. See console.log and page.png in the artifact.";
  fs.writeFileSync(path.join(outDir, "report.md"), `## Section comparison\n\n${message}\n`);
  console.error(message);
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");

const acceptedByKey = new Map(accepted.map((entry) => [key(entry), entry]));
const notMatching = result.results.filter((entry) => entry.status !== "match");
const unexpected = [];
const acceptedNow = [];
for (const entry of notMatching) {
  const allowed = acceptedByKey.get(key(entry));
  if (allowed && JSON.stringify(allowed.diff ?? []) === JSON.stringify(entry.diff ?? [])) acceptedNow.push(entry);
  else unexpected.push({ ...entry, why: allowed ? "accepted, but the differences changed" : "not in the accepted list" });
}
const seen = new Set(notMatching.map(key));
const stale = accepted.filter((entry) => !seen.has(key(entry)));

const count = (status) => result.results.filter((entry) => entry.status === status).length;
const pages = new Map();
for (const entry of result.results) {
  const row = pages.get(entry.page) ?? { total: 0, match: 0 };
  row.total += 1;
  if (entry.status === "match") row.match += 1;
  pages.set(entry.page, row);
}
const show = (line) => "`" + String(line).replace(/`/g, "'").slice(0, 200) + "`";
const lines = [
  "## Section comparison",
  "",
  `**${result.matched} of ${result.total}** sections on feature/interviewer-portal match the build — ` +
    `${count("differs")} differ, ${count("renders nothing")} render nothing, ${count("extra in new")} extra in the build.`,
  "",
  unexpected.length === 0
    ? `**Pass.** Every section that is not a match is an accepted difference (${acceptedNow.length} of ${accepted.length} listed in ${registerPath}).`
    : `**Fail.** ${unexpected.length} section(s) differ in a way that is not accepted.`,
  "",
];
if (unexpected.length > 0) {
  lines.push("### Not accepted", "");
  for (const entry of unexpected) {
    lines.push(`- ${entry.status}: \`${entry.page}\` \`${entry.id}\` — ${entry.why}`);
    for (const d of entry.diff ?? []) lines.push(`  - old ${show(d.old)}`, `  - new ${show(d.now)}`);
  }
  lines.push("");
}
if (stale.length > 0) {
  lines.push("### Accepted but no longer occurring (remove from the list)", "");
  for (const entry of stale) lines.push(`- ${entry.status}: \`${entry.page}\` \`${entry.id}\``);
  lines.push("");
}
lines.push(
  "| Old page | Matched |",
  "|---|---|",
  ...[...pages].map(([name, row]) => `| \`${name}\` | ${row.match} / ${row.total} |`),
  "",
  "Accepted differences in this run:",
  "",
  ...acceptedNow.map((entry) => `- ${entry.status}: \`${entry.page}\` \`${entry.id}\` — ${acceptedByKey.get(key(entry)).reason}`),
  "",
);
fs.writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
console.log(lines.join("\n"));
if (unexpected.length > 0) process.exit(1);

async function startServerUnlessGiven() {
  const given = process.argv[2];
  if (given && given.startsWith("http")) {
    return { url: given, outDir: process.argv[3] ?? "section-compare-output", stop: async () => {} };
  }

  const oldRoot = process.env.SECTION_COMPARE_OLD;
  const newRoot = process.env.SECTION_COMPARE_NEW;
  if (!oldRoot || !newRoot) {
    console.error("Set SECTION_COMPARE_OLD and SECTION_COMPARE_NEW, or pass the comparison URL and an output directory.");
    process.exit(1);
  }
  const port = portFromEnv();
  const child = spawn(process.execPath, [path.join(here, "server.mjs"), oldRoot, newRoot, String(port)], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  const address = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 30_000;
  let up = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(address);
      if (response.ok) {
        up = true;
        break;
      }
    } catch {
      // The server is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!up) {
    child.kill();
    console.error(`The section comparison server did not answer on ${address}.`);
    process.exit(1);
  }
  return {
    url: address,
    outDir: process.env.SECTION_COMPARE_OUT ?? "section-compare-output",
    stop: async () => {
      if (child.exitCode === null) child.kill();
    },
  };
}

function portFromEnv() {
  const raw = process.env.SECTION_COMPARE_PORT ?? "4390";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 4300 || port > 4399) {
    console.error(`SECTION_COMPARE_PORT must be a port in 4300–4399. Got "${raw}".`);
    process.exit(1);
  }
  return port;
}
