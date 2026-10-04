import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const oldRoot = process.env.SECTION_COMPARE_SOURCE ?? 'D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main';
// Read only: never switch branches, write files, or start a session in the source.
const branch = execFileSync('git', ['-C', oldRoot, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
if (branch !== 'feature/interviewer-portal') throw new Error('Comparison source must stay on feature/interviewer-portal.');
const port = Number(process.env.SECTION_COMPARE_PORT ?? 4190);
const server = spawn(process.execPath, ['tools/section-compare/server.mjs', oldRoot, path.resolve('out'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.on('data', (chunk) => { if (chunk.toString().includes('open http')) resolve(); }); server.on('error', reject); server.on('exit', (code) => reject(new Error(`Comparison server exited (${code})`))); });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.__result, undefined, { timeout: 180000 });
  const result = await page.evaluate(() => window.__result);
  const section5 = result.results.filter((row) => /^\/blogs\/.+\.html$/.test(row.page) && row.page !== '/blogs/index.html' || row.page === '/careers/apply.html' && row.id === 'section');
  result.section5 = { expected: 16, total: section5.length, matched: section5.filter((row) => row.status === 'match').length, accepted: section5.filter((row) => row.status === 'accepted').length };
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/section-comparison.json', JSON.stringify(result, null, 2) + '\n');
  console.log(`${result.matched}/${result.total} sections match; ${result.accepted} accepted; ${result.failing} failures (including chrome).`);
  console.log(`Chrome: ${result.chromeResults.filter((row) => row.status === 'match').length} match; ${result.chromeResults.filter((row) => row.status === 'accepted').length} accepted out of ${result.chromeResults.length}.`);
  console.log(`Section 5 formerly missing sections: ${result.section5.matched} match, ${result.section5.accepted} accepted (${result.section5.total}/16 found).`);
  for (const row of [...result.results, ...result.chromeResults].filter((row) => row.status !== 'match')) console.log(`${row.status}: ${row.page} #${row.id}${row.acceptance ? ' (' + row.acceptance + ')' : ''}`);
  process.exitCode = result.total !== 119 || result.failing || result.section5.total !== 16 || result.section5.matched + result.section5.accepted !== 16 ? 1 : 0;
} finally {
  await browser?.close();
  server.kill();
}
