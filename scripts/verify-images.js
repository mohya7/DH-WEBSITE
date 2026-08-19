'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'legacy', 'admin'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(html|js|json|css)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

function dirSize(d) {
  let s = 0;
  if (!fs.existsSync(d)) return 0;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    s += ent.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return s;
}

const missing = [];
const re = /(?:src|href|content)=["']([^"']*assets\/[^"']+\.(?:png|jpe?g|svg|webp|gif))["']|url\((?:\.\.\/)?(assets\/[^)]+\.(?:png|jpe?g|svg|webp|gif))\)/gi;
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1] || m[2];
    const cleaned = raw.replace(/^https?:\/\/digitalhub\.com\.eg\//i, '');
    let abs;
    if (cleaned.startsWith('assets/')) abs = path.join(ROOT, cleaned);
    else abs = path.resolve(path.dirname(file), cleaned);
    if (!fs.existsSync(abs)) {
      missing.push({
        file: path.relative(ROOT, file).split(path.sep).join('/'),
        src: raw,
      });
    }
  }
}

const admin = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/admin-content.json'), 'utf8'));
for (const [col, items] of Object.entries(admin.collections || {})) {
  for (const item of items) {
    if (!item.image) continue;
    if (!fs.existsSync(path.join(ROOT, item.image))) {
      missing.push({ file: `admin-content:${col}`, src: item.image });
    }
  }
}

let total = 0;
let withWH = 0;
let lazy = 0;
let eager = 0;
let fp = 0;
for (const file of walk(ROOT).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    total += 1;
    const a = m[1];
    if (/\bwidth\s*=/i.test(a) && /\bheight\s*=/i.test(a)) withWH += 1;
    if (/loading\s*=\s*["']lazy["']/i.test(a)) lazy += 1;
    if (/loading\s*=\s*["']eager["']/i.test(a)) eager += 1;
    if (/fetchpriority\s*=\s*["']high["']/i.test(a)) fp += 1;
  }
}

console.log(JSON.stringify({
  missingCount: missing.length,
  missing: missing.slice(0, 50),
  markup: { total, withWH, withoutWH: total - withWH, lazy, eager, fetchpriorityHigh: fp },
  sizesKB: {
    team: Math.round(dirSize(path.join(ROOT, 'assets/team')) / 1024),
    careers: Math.round(dirSize(path.join(ROOT, 'assets/careers')) / 1024),
    blog: Math.round(dirSize(path.join(ROOT, 'assets/blog')) / 1024),
    cases: Math.round(dirSize(path.join(ROOT, 'assets/cases')) / 1024),
  },
}, null, 2));

function fetchPage(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: 8765, path: pathname, timeout: 10000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function extractAssets(html, pagePath) {
  const urls = new Set();
  const base = new URL(pagePath, 'http://127.0.0.1:8765');
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/gi,
    /url\(["']?([^"')]+)["']?\)/gi,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html))) {
      const raw = m[1];
      if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('#')) continue;
      if (/^https?:/i.test(raw) && !/127\.0\.0\.1|localhost|digitalhub\.com\.eg/i.test(raw)) continue;
      try {
        const u = new URL(raw, base);
        if (u.origin === 'http://127.0.0.1:8765') urls.add(u.pathname);
      } catch (_) { /* ignore */ }
    }
  }
  return [...urls];
}

function headSize(pathname) {
  return new Promise((resolve) => {
    http.request({ hostname: '127.0.0.1', port: 8765, path: pathname, method: 'HEAD', timeout: 10000 }, (res) => {
      const len = Number(res.headers['content-length'] || 0);
      resolve(len);
    }).on('error', () => resolve(0)).end();
  });
}

async function weigh(pathname) {
  const page = await fetchPage(pathname);
  const assets = extractAssets(page.body, pathname);
  let totalBytes = Buffer.byteLength(page.body);
  const localAssets = [];
  for (const asset of assets) {
    if (asset === pathname) continue;
    const size = await headSize(asset);
    totalBytes += size;
    if (/\.(png|jpe?g|webp|svg|gif)$/i.test(asset)) localAssets.push({ asset, size });
  }
  localAssets.sort((a, b) => b.size - a.size);
  return {
    path: pathname,
    status: page.status,
    totalKB: Math.round(totalBytes / 102.4) / 10,
    totalMB: Math.round(totalBytes / 104857.6) / 10,
    assetCount: assets.length,
    topImages: localAssets.slice(0, 8).map((x) => ({ asset: x.asset, kb: Math.round(x.size / 102.4) / 10 })),
  };
}

(async () => {
  try {
    const pages = await Promise.all([
      weigh('/'),
      weigh('/services/enterprise-software.html'),
      weigh('/careers/'),
    ]);
    console.log('pageWeight', JSON.stringify(pages, null, 2));
  } catch (err) {
    console.log('pageWeightError', err.message);
  }
})();
