'use strict';

/**
 * Mobile layout audit (report-only).
 *
 * Discovers public HTML pages from the filesystem, opens each at two viewports
 * on the local CMS server, and reports horizontal overflow, tiny text, and
 * undersized tap targets. Does not modify any CSS or HTML.
 *
 * Usage:
 *   node scripts/mobile-layout-audit.js
 *   npm run audit:mobile
 *
 * Requires the site running at BASE_URL (default http://127.0.0.1:8765).
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8765';
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '320x568', width: 320, height: 568 },
];
const MIN_FONT_PX = 12;
const MIN_TAP = 44;
const REPORT_DIR = path.join(ROOT, 'tmp');
const REPORT_FILE = path.join(REPORT_DIR, 'mobile-layout-audit-report.md');

const SKIP_DIR_NAMES = new Set([
  'admin',
  'node_modules',
  '.git',
  '.cursor',
  'tmp',
  'lib',
  'scripts',
  'content',
  'assets',
  'css',
  'js',
  'docs',
]);

const ROOT_PAGES = new Set(['index.html', 'about-us.html', 'get-in-touch.html']);
const SECTION_DIRS = new Set(['services', 'partners', 'cases', 'blogs', 'careers', 'news']);

function walkHtml(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) return [];
      return walkHtml(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
}

function fileToUrlPath(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function discoverPublicPages() {
  const pages = [];

  for (const name of ROOT_PAGES) {
    const full = path.join(ROOT, name);
    if (fs.existsSync(full)) {
      pages.push({ file: name, urlPath: fileToUrlPath(full) });
    }
  }

  for (const section of SECTION_DIRS) {
    const dir = path.join(ROOT, section);
    for (const file of walkHtml(dir)) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      pages.push({ file: rel, urlPath: fileToUrlPath(file) });
    }
  }

  pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath));
  return pages;
}

async function auditPage(page, urlPath, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(`${BASE_URL}${urlPath}`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  const status = response ? response.status() : 0;
  if (status >= 400) {
    return {
      page: urlPath,
      viewport: viewport.name,
      pass: false,
      problems: [`HTTP ${status}`],
    };
  }

  // Allow late layout (fonts / content-runtime) to settle.
  await page.waitForTimeout(400);

  const findings = await page.evaluate(
    ({ minFontPx, minTap, viewportWidth }) => {
      function cssPath(el) {
        if (!el || el.nodeType !== 1) return '(unknown)';
        if (el.id) return `#${CSS.escape(el.id)}`;
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1 && node !== document.documentElement) {
          let part = node.tagName.toLowerCase();
          if (node.classList && node.classList.length) {
            const cls = [...node.classList].slice(0, 2).map((c) => CSS.escape(c)).join('.');
            if (cls) part += `.${cls}`;
          }
          const parent = node.parentElement;
          if (parent) {
            const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
            if (siblings.length > 1) {
              part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
            }
          }
          parts.unshift(part);
          if (parts.length >= 5) break;
          node = parent;
        }
        return parts.join(' > ');
      }

      const scrollWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0
      );
      const overflow = scrollWidth > viewportWidth + 1;

      let widest = null;
      if (overflow) {
        const all = document.body ? document.body.querySelectorAll('*') : [];
        let bestScore = 0;
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 && rect.height <= 0) continue;
          const right = rect.left + rect.width;
          const span = Math.max(el.scrollWidth, rect.width, right);
          const spills = right > viewportWidth + 1 || el.scrollWidth > viewportWidth + 1;
          if (!spills) continue;
          if (span > bestScore) {
            bestScore = span;
            widest = {
              selector: cssPath(el),
              width: Math.round(Math.max(el.scrollWidth, rect.width)),
              right: Math.round(right),
            };
          }
        }
        if (!widest) {
          widest = {
            selector: 'html',
            width: scrollWidth,
            right: scrollWidth,
          };
        }
      }

      const smallText = [];
      const textSeen = new Set();
      const textNodes = document.body
        ? document.body.querySelectorAll('p, span, a, li, h1, h2, h3, h4, h5, h6, label, button, td, th, figcaption, small, em, strong, div')
        : [];
      for (const el of textNodes) {
        const text = (el.childNodes && [...el.childNodes]
          .filter((n) => n.nodeType === 3 && n.textContent.trim())
          .map((n) => n.textContent.trim())
          .join(' ')) || '';
        if (!text) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const fontSize = parseFloat(style.fontSize);
        if (!Number.isFinite(fontSize) || fontSize >= minFontPx) continue;
        const key = `${cssPath(el)}|${fontSize.toFixed(1)}`;
        if (textSeen.has(key)) continue;
        textSeen.add(key);
        smallText.push({
          selector: cssPath(el),
          fontSize: Math.round(fontSize * 10) / 10,
          sample: text.slice(0, 60),
        });
        if (smallText.length >= 25) break;
      }

      const smallTaps = [];
      const tapSeen = new Set();
      const tapCandidates = document.body
        ? document.body.querySelectorAll('a, button, [role="button"], [role="link"], input[type="submit"], input[type="button"], summary')
        : [];
      for (const el of tapCandidates) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        // Skip visually empty anchors used as layout hooks.
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
        if (!label && !el.querySelector('img, svg, i')) continue;
        if (rect.width >= minTap && rect.height >= minTap) continue;
        const selector = cssPath(el);
        const key = `${selector}|${Math.round(rect.width)}x${Math.round(rect.height)}`;
        if (tapSeen.has(key)) continue;
        tapSeen.add(key);
        smallTaps.push({
          selector,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          label: label.slice(0, 40),
        });
        if (smallTaps.length >= 40) break;
      }

      return {
        scrollWidth,
        viewportWidth,
        overflow,
        widest,
        smallText,
        smallTaps,
      };
    },
    { minFontPx: MIN_FONT_PX, minTap: MIN_TAP, viewportWidth: viewport.width }
  );

  const problems = [];
  if (findings.overflow) {
    const w = findings.widest;
    problems.push(
      `horizontal overflow: scrollWidth=${findings.scrollWidth}px > ${findings.viewportWidth}px` +
        (w ? `; widest=${w.selector} (${w.width}px, right=${w.right}px)` : '')
    );
  }
  for (const t of findings.smallText) {
    problems.push(`text < ${MIN_FONT_PX}px: ${t.selector} (${t.fontSize}px) "${t.sample}"`);
  }
  for (const t of findings.smallTaps) {
    problems.push(
      `tap target < ${MIN_TAP}x${MIN_TAP}: ${t.selector} (${t.width}x${t.height})` +
        (t.label ? ` "${t.label}"` : '')
    );
  }

  return {
    page: urlPath,
    viewport: viewport.name,
    pass: problems.length === 0,
    problems,
    meta: findings,
  };
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function formatTable(rows) {
  const headers = ['Page', 'Viewport', 'Result', 'Problem'];
  const lines = [];
  const col = [48, 10, 6, 80];

  lines.push(
    `| ${pad(headers[0], col[0])} | ${pad(headers[1], col[1])} | ${pad(headers[2], col[2])} | ${pad(headers[3], col[3])} |`
  );
  lines.push(
    `| ${'-'.repeat(col[0])} | ${'-'.repeat(col[1])} | ${'-'.repeat(col[2])} | ${'-'.repeat(col[3])} |`
  );

  for (const row of rows) {
    if (row.problems.length === 0) {
      lines.push(
        `| ${pad(row.page, col[0])} | ${pad(row.viewport, col[1])} | ${pad('PASS', col[2])} | ${pad('—', col[3])} |`
      );
      continue;
    }
    row.problems.forEach((problem, index) => {
      const pageCell = index === 0 ? row.page : '';
      const vpCell = index === 0 ? row.viewport : '';
      const resultCell = index === 0 ? 'FAIL' : '';
      const clipped = problem.length > col[3] ? `${problem.slice(0, col[3] - 1)}…` : problem;
      lines.push(
        `| ${pad(pageCell, col[0])} | ${pad(vpCell, col[1])} | ${pad(resultCell, col[2])} | ${pad(clipped, col[3])} |`
      );
    });
  }
  return lines.join('\n');
}

async function main() {
  const pages = discoverPublicPages();
  if (!pages.length) {
    console.error('No public pages discovered.');
    process.exit(1);
  }

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Discovered ${pages.length} public page(s). Skipping /admin.`);
  console.log(`Viewports: ${VIEWPORTS.map((v) => v.name).join(', ')}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  for (const entry of pages) {
    for (const viewport of VIEWPORTS) {
      process.stdout.write(`  auditing ${entry.urlPath} @ ${viewport.name} ... `);
      try {
        const result = await auditPage(page, entry.urlPath, viewport);
        results.push(result);
        console.log(result.pass ? 'PASS' : `FAIL (${result.problems.length})`);
      } catch (error) {
        const result = {
          page: entry.urlPath,
          viewport: viewport.name,
          pass: false,
          problems: [`audit error: ${error.message || error}`],
        };
        results.push(result);
        console.log('ERROR');
      }
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  const table = formatTable(results);

  const overflowRows = [];
  const textFreq = new Map();
  const tapFreq = new Map();
  for (const row of results) {
    for (const problem of row.problems) {
      if (problem.startsWith('horizontal overflow')) {
        overflowRows.push(`- \`${row.page}\` @ ${row.viewport}: ${problem}`);
      } else if (problem.startsWith('text <')) {
        const key = problem.length > 120 ? `${problem.slice(0, 119)}…` : problem;
        textFreq.set(key, (textFreq.get(key) || 0) + 1);
      } else if (problem.startsWith('tap target')) {
        const key = problem.length > 120 ? `${problem.slice(0, 119)}…` : problem;
        tapFreq.set(key, (tapFreq.get(key) || 0) + 1);
      }
    }
  }
  const topText = [...textFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topTap = [...tapFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  const report = [
    '# Mobile layout audit report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Base URL: ${BASE_URL}`,
    `- Pages: ${pages.length}`,
    `- Checks: ${results.length} (page × viewport)`,
    `- Pass: ${passed.length}`,
    `- Fail: ${failed.length}`,
    `- Criteria: scrollWidth ≤ viewport; text ≥ ${MIN_FONT_PX}px; link/button tap targets ≥ ${MIN_TAP}×${MIN_TAP}`,
    '',
    '## Rollup',
    '',
    `### Horizontal overflow (${overflowRows.length})`,
    '',
    ...(overflowRows.length ? overflowRows : ['- None']),
    '',
    '### Most common text < 12px findings',
    '',
    ...topText.map(([problem, count]) => `- (${count}×) ${problem}`),
    '',
    '### Most common tap targets < 44×44',
    '',
    ...topTap.map(([problem, count]) => `- (${count}×) ${problem}`),
    '',
    '## Summary',
    '',
    table,
    '',
    '## Discovered pages',
    '',
    ...pages.map((p) => `- \`${p.urlPath}\` ← \`${p.file}\``),
    '',
  ].join('\n');

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, report, 'utf8');

  console.log('');
  console.log(table);
  console.log('');
  console.log(`Pass: ${passed.length}  Fail: ${failed.length}  Total checks: ${results.length}`);
  console.log(`Full report: ${path.relative(ROOT, REPORT_FILE).split(path.sep).join('/')}`);

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
