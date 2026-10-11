/*
 * Runs website/tools/section-compare: serves the old site and the build, opens the
 * comparison page (compare.html), waits for its result (window.__result), and writes
 * it out. compare.html applies accepted-differences.json itself; nothing here changes
 * what it checks.
 *
 *   npm run compare:sections
 *     SECTION_COMPARE_OLD   the old site (default: the local DH-WEBSITE-main checkout);
 *                           SECTION_COMPARE_SOURCE is the older name for the same thing
 *     SECTION_COMPARE_NEW   the build (default: out/)
 *     SECTION_COMPARE_PORT  the server's port (default 4190; each agent sets its own range)
 *     SECTION_COMPARE_OUT   where result.json, report.md, page.html, page.png and
 *                           console.log go (default: artifacts/section-compare)
 *
 * Or, when a server is already running:
 *   node tools/section-compare/run.mjs <url> <outDir>
 *
 * Also writes artifacts/section-comparison.json, as before. Fails (exit 1) when there
 * is no result, when any section or header/footer is neither a match nor accepted by
 * the register, or when the 119 old sections or the 16 Section 5 regions are not all
 * accounted for.
 */
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const given = process.argv[2]?.startsWith('http') ? { url: process.argv[2], outDir: process.argv[3] ?? 'artifacts/section-compare' } : null;
const outDir = given?.outDir ?? process.env.SECTION_COMPARE_OUT ?? 'artifacts/section-compare';
fs.mkdirSync(outDir, { recursive: true });

let server = null;
let url = given?.url;
if (!url) {
  const oldRoot = process.env.SECTION_COMPARE_OLD ?? process.env.SECTION_COMPARE_SOURCE ?? 'D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main';
  const newRoot = path.resolve(process.env.SECTION_COMPARE_NEW ?? 'out');
  // Read only: never switch branches, write files, or start a session in the source.
  const branch = execFileSync('git', ['-C', oldRoot, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  if (branch !== 'feature/interviewer-portal') throw new Error('Comparison source must stay on feature/interviewer-portal.');
  const port = Number(process.env.SECTION_COMPARE_PORT ?? 4190);
  server = spawn(process.execPath, [path.join(here, 'server.mjs'), oldRoot, newRoot, String(port)], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => { if (chunk.toString().includes('open http')) resolve(); });
    server.on('error', reject);
    server.on('exit', (code) => reject(new Error(`Comparison server exited (${code})`)));
  });
  url = `http://127.0.0.1:${port}/`;
}

let browser;
let result = null;
const consoleLines = [];
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('console', (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => consoleLines.push(`[pageerror] ${error.message}`));
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__result, undefined, { timeout: 15 * 60 * 1000, polling: 1000 });
    result = await page.evaluate(() => window.__result);
  } catch (error) {
    consoleLines.push(`[driver] ${error instanceof Error ? error.message : String(error)}`);
  }
  fs.writeFileSync(path.join(outDir, 'page.html'), await page.content());
  await page.screenshot({ path: path.join(outDir, 'page.png'), fullPage: true });
  fs.writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n') + '\n');
} finally {
  await browser?.close();
  server?.kill();
}

if (result === null) {
  const message = 'The section comparison produced no result. See console.log and page.png.';
  fs.writeFileSync(path.join(outDir, 'report.md'), `## Section comparison\n\n${message}\n`);
  console.error(message);
  process.exit(1);
}

const section5 = result.results.filter((row) => /^\/blogs\/.+\.html$/.test(row.page) && row.page !== '/blogs/index.html' || row.page === '/careers/apply.html' && row.id === 'section');
result.section5 = { expected: 16, total: section5.length, matched: section5.filter((row) => row.status === 'match').length, accepted: section5.filter((row) => row.status === 'accepted').length };
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/section-comparison.json', JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');

const chromeOf = (status) => result.chromeResults.filter((row) => row.status === status).length;
const failingRows = [...result.results, ...result.chromeResults].filter((row) => !['match', 'accepted'].includes(row.status));
const complete = result.total === 119 && result.section5.total === 16 && result.section5.matched + result.section5.accepted === 16;
const pass = complete && result.failing === 0;
const summary = [
  `${result.matched}/${result.total} sections match; ${result.accepted} accepted; ${result.failing} failures (including chrome).`,
  `Chrome: ${chromeOf('match')} match; ${chromeOf('accepted')} accepted out of ${result.chromeResults.length}.`,
  `Section 5 formerly missing sections: ${result.section5.matched} match, ${result.section5.accepted} accepted (${result.section5.total}/16 found).`,
];
for (const line of summary) console.log(line);
for (const row of [...result.results, ...result.chromeResults].filter((row) => row.status !== 'match')) console.log(`${row.status}: ${row.page} #${row.id}${row.acceptance ? ' (' + row.acceptance + ')' : ''}`);

const show = (line) => '`' + String(line).replace(/`/g, "'").slice(0, 200) + '`';
const report = [
  '## Section comparison',
  '',
  ...summary.map((line) => `- ${line}`),
  '',
  pass
    ? '**Pass.** Every section and header/footer that is not a match is accepted by website/tools/section-compare/accepted-differences.json.'
    : `**Fail.** ${failingRows.length} not accepted${complete ? '' : '; not every old section or Section 5 region was accounted for'}.`,
  '',
];
if (failingRows.length > 0) {
  report.push('### Not accepted', '');
  for (const row of failingRows) {
    report.push(`- ${row.status}: \`${row.page}\` \`${row.id}\``);
    for (const d of row.diff ?? []) report.push(`  - old ${show(d.old)}`, `  - new ${show(d.now)}`);
  }
  report.push('');
}
const accepted = [...result.results, ...result.chromeResults].filter((row) => row.status === 'accepted');
report.push('### Accepted in this run', '', ...accepted.map((row) => `- \`${row.page}\` \`${row.id}\` — ${row.acceptance}`), '');
fs.writeFileSync(path.join(outDir, 'report.md'), report.join('\n'));
process.exitCode = pass ? 0 : 1;
