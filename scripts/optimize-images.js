/* One-shot image optimization: extract base64 SVGs, convert photos to WebP, rewrite refs. */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const QUALITY = 80;

const svgJobs = [
  { svg: 'assets/careers/ali.svg', out: 'assets/careers/ali.webp', max: 800 },
  { svg: 'assets/careers/youssef.svg', out: 'assets/careers/youssef.webp', max: 800 },
  { svg: 'assets/careers/endi.svg', out: 'assets/careers/endi.webp', max: 800 },
  { svg: 'assets/careers/laila.svg', out: 'assets/careers/laila.webp', max: 800 },
  { svg: 'assets/team/khaled-kassab.svg', out: 'assets/team/khaled-kassab.webp', max: 800 },
  { svg: 'assets/team/mohamed-elbadry.svg', out: 'assets/team/mohamed-elbadry.webp', max: 800 },
  { svg: 'assets/team/nada-younes.svg', out: 'assets/team/nada-younes.webp', max: 800 },
  { svg: 'assets/team/mahmoud-yasser.svg', out: 'assets/team/mahmoud-yasser.webp', max: 800 },
  { svg: 'assets/team/mohamed-mansour.svg', out: 'assets/team/mohamed-mansour.webp', max: 800 },
];

/** Source photo → webp. Prefer the best/largest source when duplicates exist. */
const rasterJobs = [
  { src: 'assets/careers/Endi.png', out: 'assets/careers/endi.webp', max: 800 },
  { src: 'assets/careers/endi.png', out: 'assets/careers/endi.webp', max: 800 },
  { src: 'assets/careers/Ali Zein.png', out: 'assets/careers/ali-zein.webp', max: 800 },
  { src: 'assets/careers/ali-zein.png', out: 'assets/careers/ali-zein.webp', max: 800 },
  { src: 'assets/careers/ali-zein-800.png', out: 'assets/careers/ali-zein.webp', max: 800 },
  { src: 'assets/careers/Nada azzam.png', out: 'assets/careers/nada-azzam.webp', max: 800 },
  { src: 'assets/careers/nada-azzam.png', out: 'assets/careers/nada-azzam.webp', max: 800 },
  { src: 'assets/careers/Ali Mohi.png', out: 'assets/careers/ali-mohi.webp', max: 800 },
  { src: 'assets/careers/ali-mohi.png', out: 'assets/careers/ali-mohi.webp', max: 800 },
  { src: 'assets/careers/hero.png', out: 'assets/careers/hero.webp', max: 1920 },
  { src: 'assets/team/kareem-adel.jpg', out: 'assets/team/kareem-adel.webp', max: 800 },
  { src: 'assets/team/kareem-adel.jpeg', out: 'assets/team/kareem-adel.webp', max: 800 },
  { src: 'assets/team/Kareem Adel.jpeg', out: 'assets/team/kareem-adel.webp', max: 800 },
  { src: 'assets/team/mohamed-mansour.jpeg', out: 'assets/team/mohamed-mansour.webp', max: 800 },
  { src: 'assets/team/Mohamed Mansour (1).jpeg', out: 'assets/team/mohamed-mansour.webp', max: 800 },
  { src: 'assets/team/mahmoud-yasser.jpeg', out: 'assets/team/mahmoud-yasser.webp', max: 800 },
  { src: 'assets/team/Mahmoud Yasser.jpeg', out: 'assets/team/mahmoud-yasser.webp', max: 800 },
  { src: 'assets/team/nada-younes.jpeg', out: 'assets/team/nada-younes.webp', max: 800 },
  { src: 'assets/team/Nada Younes.jpeg', out: 'assets/team/nada-younes.webp', max: 800 },
  { src: 'assets/team/mohamed-elbadry.jpeg', out: 'assets/team/mohamed-elbadry.webp', max: 800 },
  { src: 'assets/team/Mohamed elbadry.jpeg', out: 'assets/team/mohamed-elbadry.webp', max: 800 },
  { src: 'assets/team/khaled-kassab.jpeg', out: 'assets/team/khaled-kassab.webp', max: 800 },
  { src: 'assets/team/Khaled Kassab.jpeg', out: 'assets/team/khaled-kassab.webp', max: 800 },
  { src: 'assets/blog/dex.jpg', out: 'assets/blog/dex.webp', max: 1620 },
  { src: 'assets/blog/transformation.jpg', out: 'assets/blog/transformation.webp', max: 1620 },
  { src: 'assets/blog/azure.jpg', out: 'assets/blog/azure.webp', max: 1620 },
  { src: 'assets/cases/planning.jpg', out: 'assets/cases/planning.webp', max: 1600 },
  { src: 'assets/cases/banking.jpg', out: 'assets/cases/banking.webp', max: 1600 },
  { src: 'assets/cases/dex.jpg', out: 'assets/cases/dex.webp', max: 1600 },
];

const deleteAfter = [
  'assets/careers/ali.svg',
  'assets/careers/youssef.svg',
  'assets/careers/endi.svg',
  'assets/careers/laila.svg',
  'assets/team/khaled-kassab.svg',
  'assets/team/mohamed-elbadry.svg',
  'assets/team/nada-younes.svg',
  'assets/team/mahmoud-yasser.svg',
  'assets/team/mohamed-mansour.svg',
  'assets/careers/Endi.png',
  'assets/careers/endi.png',
  'assets/careers/Ali Zein.png',
  'assets/careers/ali-zein.png',
  'assets/careers/ali-zein-800.png',
  'assets/careers/Nada azzam.png',
  'assets/careers/nada-azzam.png',
  'assets/careers/Ali Mohi.png',
  'assets/careers/ali-mohi.png',
  'assets/careers/hero.png',
  'assets/team/kareem-adel.jpg',
  'assets/team/kareem-adel.jpeg',
  'assets/team/Kareem Adel.jpeg',
  'assets/team/mohamed-mansour.jpeg',
  'assets/team/Mohamed Mansour (1).jpeg',
  'assets/team/mahmoud-yasser.jpeg',
  'assets/team/Mahmoud Yasser.jpeg',
  'assets/team/nada-younes.jpeg',
  'assets/team/Nada Younes.jpeg',
  'assets/team/mohamed-elbadry.jpeg',
  'assets/team/Mohamed elbadry.jpeg',
  'assets/team/khaled-kassab.jpeg',
  'assets/team/Khaled Kassab.jpeg',
  'assets/blog/dex.jpg',
  'assets/blog/transformation.jpg',
  'assets/blog/azure.jpg',
  'assets/cases/planning.jpg',
  'assets/cases/banking.jpg',
  'assets/cases/dex.jpg',
];

const textReplacements = [
  ['assets/careers/nada-azzam.png', 'assets/careers/nada-azzam.webp'],
  ['assets/careers/endi.png', 'assets/careers/endi.webp'],
  ['assets/careers/Endi.png', 'assets/careers/endi.webp'],
  ['assets/careers/ali-mohi.png', 'assets/careers/ali-mohi.webp'],
  ['assets/careers/ali-zein-800.png', 'assets/careers/ali-zein.webp'],
  ['assets/careers/Ali Zein.png', 'assets/careers/ali-zein.webp'],
  ['assets/careers/ali-zein.png', 'assets/careers/ali-zein.webp'],
  ['assets/careers/hero.png', 'assets/careers/hero.webp'],
  ['assets/team/kareem-adel.jpeg', 'assets/team/kareem-adel.webp'],
  ['assets/team/kareem-adel.jpg', 'assets/team/kareem-adel.webp'],
  ['assets/team/mohamed-mansour.jpeg', 'assets/team/mohamed-mansour.webp'],
  ['assets/team/mahmoud-yasser.jpeg', 'assets/team/mahmoud-yasser.webp'],
  ['assets/team/nada-younes.jpeg', 'assets/team/nada-younes.webp'],
  ['assets/team/mohamed-elbadry.jpeg', 'assets/team/mohamed-elbadry.webp'],
  ['assets/team/khaled-kassab.jpeg', 'assets/team/khaled-kassab.webp'],
  ['assets/blog/dex.jpg', 'assets/blog/dex.webp'],
  ['assets/blog/transformation.jpg', 'assets/blog/transformation.webp'],
  ['assets/blog/azure.jpg', 'assets/blog/azure.webp'],
  ['assets/cases/planning.jpg', 'assets/cases/planning.webp'],
  ['assets/cases/banking.jpg', 'assets/cases/banking.webp'],
  ['assets/cases/dex.jpg', 'assets/cases/dex.webp'],
];

function abs(rel) {
  return path.join(ROOT, rel);
}

function extractBase64(svgText) {
  const m = svgText.match(/data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)/i);
  if (!m) return null;
  return Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
}

async function toWebp(inputBufferOrPath, outRel, maxEdge) {
  const outPath = abs(outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let pipeline = sharp(inputBufferOrPath, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width || maxEdge;
  const height = meta.height || maxEdge;
  if (width > maxEdge || height > maxEdge) {
    pipeline = sharp(inputBufferOrPath, { failOn: 'none' }).rotate().resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  } else {
    pipeline = sharp(inputBufferOrPath, { failOn: 'none' }).rotate();
  }
  await pipeline.webp({ quality: QUALITY, effort: 5 }).toFile(outPath);
  const size = fs.statSync(outPath).size;
  return { outRel, bytes: size, width: meta.width, height: meta.height };
}

async function convertSvgs(report) {
  for (const job of svgJobs) {
    const svgPath = abs(job.svg);
    if (!fs.existsSync(svgPath)) {
      report.skipped.push(job.svg);
      continue;
    }
    const buf = extractBase64(fs.readFileSync(svgPath, 'utf8'));
    if (!buf) {
      report.errors.push(`No base64 in ${job.svg}`);
      continue;
    }
    const result = await toWebp(buf, job.out, job.max);
    report.created.push(result);
  }
}

async function convertRasters(report) {
  const bestByOut = new Map();
  for (const job of rasterJobs) {
    const srcPath = abs(job.src);
    if (!fs.existsSync(srcPath)) continue;
    const size = fs.statSync(srcPath).size;
    const prev = bestByOut.get(job.out);
    if (!prev || size > prev.size) bestByOut.set(job.out, { ...job, size });
  }
  for (const job of bestByOut.values()) {
    const result = await toWebp(abs(job.src), job.out, job.max);
    report.created.push({ ...result, from: job.src });
  }
}

function walkFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'legacy') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, acc);
    else if (/\.(html|js|json|css|md|txt)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

function rewriteRefs(report) {
  const files = walkFiles(ROOT);
  for (const file of files) {
    if (file.includes(`${path.sep}scripts${path.sep}optimize-images.js`)) continue;
    if (file.includes('_audit-report-tmp')) continue;
    let text = fs.readFileSync(file, 'utf8');
    const original = text;
    for (const [from, to] of textReplacements) {
      if (text.includes(from)) text = text.split(from).join(to);
    }
    if (text !== original) {
      fs.writeFileSync(file, text, 'utf8');
      report.rewritten.push(path.relative(ROOT, file).split(path.sep).join('/'));
    }
  }
}

function deleteSources(report) {
  for (const rel of deleteAfter) {
    const p = abs(rel);
    if (!fs.existsSync(p)) continue;
    fs.unlinkSync(p);
    report.deleted.push(rel);
  }
}

async function main() {
  const report = { created: [], deleted: [], rewritten: [], skipped: [], errors: [] };
  await convertSvgs(report);
  await convertRasters(report);
  rewriteRefs(report);
  deleteSources(report);

  const webpTotal = report.created.reduce((sum, item) => sum + (item.bytes || 0), 0);
  console.log(JSON.stringify({
    webpFiles: report.created.length,
    webpTotalKB: Math.round(webpTotal / 102.4) / 10,
    deleted: report.deleted.length,
    rewrittenFiles: report.rewritten.length,
    errors: report.errors,
    sample: report.created.slice(0, 12).map((c) => ({
      out: c.outRel,
      kb: Math.round(c.bytes / 102.4) / 10,
      from: c.from || 'svg-base64',
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
