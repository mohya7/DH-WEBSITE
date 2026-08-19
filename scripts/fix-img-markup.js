/* Add width/height, loading, and fetchpriority to <img> tags across HTML. */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const dimCache = new Map();

const KNOWN = {
  'assets/digital-hub-logo.png': [180, 48],
  'assets/microsoft-logo.png': [165, 36],
  'assets/huawei-logo.webp': [140, 36],
  'assets/nexthink-logo.png': [135, 36],
  'assets/efinance-logo.svg': [120, 36],
  'assets/vodafone-logo.svg': [120, 36],
  'assets/careers/nada-azzam.webp': [400, 400],
  'assets/careers/endi.webp': [400, 400],
  'assets/careers/ali-mohi.webp': [400, 400],
  'assets/careers/ali-zein.webp': [400, 400],
  'assets/team/kareem-adel.webp': [320, 390],
  'assets/team/mohamed-mansour.webp': [320, 390],
  'assets/team/mahmoud-yasser.webp': [320, 390],
  'assets/team/nada-younes.webp': [320, 390],
  'assets/team/mohamed-elbadry.webp': [320, 390],
  'assets/team/khaled-kassab.webp': [320, 390],
  'assets/blog/dex.webp': [810, 500],
  'assets/blog/transformation.webp': [810, 500],
  'assets/blog/azure.webp': [810, 500],
  'assets/cases/planning.webp': [800, 500],
  'assets/cases/banking.webp': [800, 500],
  'assets/cases/dex.webp': [800, 500],
};

function walkHtml(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'admin' || ent.name === 'legacy') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, acc);
    else if (ent.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function normalizeSrc(htmlFile, src) {
  if (!src || src.startsWith('data:') || /^https?:/i.test(src)) return null;
  const clean = src.split('?')[0].split('#')[0];
  const abs = path.resolve(path.dirname(htmlFile), clean);
  if (!abs.startsWith(ROOT)) return null;
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

async function dimsFor(rel) {
  if (!rel) return null;
  if (KNOWN[rel]) return KNOWN[rel];
  if (dimCache.has(rel)) return dimCache.get(rel);
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    dimCache.set(rel, null);
    return null;
  }
  try {
    const meta = await sharp(file, { failOn: 'none' }).metadata();
    const pair = [meta.width || null, meta.height || null];
    dimCache.set(rel, pair[0] && pair[1] ? pair : null);
    return dimCache.get(rel);
  } catch {
    dimCache.set(rel, null);
    return null;
  }
}

function isHeroCandidate(attrs, className, parentHint) {
  if (/fetchpriority\s*=/i.test(attrs)) return false;
  if (/blog-view-media|hero__media|page-hero|cs-hero|svc-hero|careers-detail-hero|nav-intro-logo/i.test(className + ' ' + parentHint)) return true;
  if (/\bhero\b/i.test(className) && /loading\s*=\s*["']eager["']/i.test(attrs)) return true;
  return false;
}

function isAboveFold(attrs, className, parentHint, indexInFile) {
  if (/loading\s*=\s*["']eager["']/i.test(attrs)) return true;
  if (/brand-logo|nav-intro-logo|plogo-img|hero|blog-view-media/i.test(className + ' ' + parentHint)) return true;
  if (indexInFile < 3 && /brand-logo|logo/i.test(className)) return true;
  return false;
}

async function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  let imgIndex = 0;
  const parts = [];
  let last = 0;
  const re = /<img\b([^>]*)>/gi;
  let m;
  const tasks = [];
  while ((m = re.exec(html))) {
    tasks.push({ start: m.index, end: m.index + m[0].length, attrs: m[1], full: m[0] });
  }
  for (const task of tasks) {
    parts.push(html.slice(last, task.start));
    let attrs = task.attrs.trim();
    const src = ((attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const className = ((attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const before = html.slice(Math.max(0, task.start - 120), task.start);
    const rel = normalizeSrc(file, src);
    const dims = await dimsFor(rel);

    if (dims && !/\bwidth\s*=/i.test(attrs)) attrs += ` width="${dims[0]}"`;
    if (dims && !/\bheight\s*=/i.test(attrs)) attrs += ` height="${dims[1]}"`;

    const above = isAboveFold(attrs, className, before, imgIndex);
    if (!/\bloading\s*=/i.test(attrs)) {
      attrs += above ? ' loading="eager"' : ' loading="lazy"';
    }
    if (!/\bdecoding\s*=/i.test(attrs)) attrs += ' decoding="async"';
    if (isHeroCandidate(attrs, className, before) && !/\bfetchpriority\s*=/i.test(attrs)) {
      attrs += ' fetchpriority="high"';
      // ensure hero is eager
      attrs = attrs.replace(/\bloading\s*=\s*["']lazy["']/i, 'loading="eager"');
      if (!/\bloading\s*=/i.test(attrs)) attrs += ' loading="eager"';
    }

    parts.push(`<img ${attrs.trim()}>`);
    last = task.end;
    imgIndex += 1;
  }
  parts.push(html.slice(last));
  const next = parts.join('');
  if (next !== html) fs.writeFileSync(file, next, 'utf8');
  return imgIndex;
}

async function main() {
  const files = walkHtml(ROOT);
  let total = 0;
  for (const file of files) total += await processFile(file);
  console.log(JSON.stringify({ files: files.length, imagesTouchedPass: total }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
