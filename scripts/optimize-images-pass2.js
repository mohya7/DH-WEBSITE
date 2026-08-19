'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const QUALITY = 80;

const jobs = [
  { src: 'assets/huawei-logo.png', out: 'assets/huawei-logo.webp', max: 600 },
  { src: 'assets/AWS-logo.png', out: 'assets/AWS-logo.webp', max: 600 },
  { src: 'assets/news/partnership.jpg', out: 'assets/news/partnership.webp', max: 1200 },
  { src: 'assets/news/events.jpg', out: 'assets/news/events.webp', max: 1200 },
  { src: 'assets/news/projects.jpg', out: 'assets/news/projects.webp', max: 1200 },
  { src: 'assets/method/build.jpg', out: 'assets/method/build.webp', max: 1200 },
  { src: 'assets/method/discover.jpg', out: 'assets/method/discover.webp', max: 1200 },
  { src: 'assets/method/deploy.jpg', out: 'assets/method/deploy.webp', max: 1200 },
  { src: 'assets/method/architect.jpg', out: 'assets/method/architect.webp', max: 1200 },
  { src: 'assets/services/integration.jpg', out: 'assets/services/integration.webp', max: 1200 },
  { src: 'assets/services/enterprise-apps.jpg', out: 'assets/services/enterprise-apps.webp', max: 1200 },
  { src: 'assets/services/modernization.jpg', out: 'assets/services/modernization.webp', max: 1200 },
  { src: 'assets/services/digital-portals.jpg', out: 'assets/services/digital-portals.webp', max: 1200 },
  { src: 'assets/history/code.jpg', out: 'assets/history/code.webp', max: 1200 },
  { src: 'assets/history/consult.jpg', out: 'assets/history/consult.webp', max: 1200 },
  { src: 'assets/history/growth.jpg', out: 'assets/history/growth.webp', max: 1200 },
  { src: 'assets/history/launch.jpg', out: 'assets/history/launch.webp', max: 1200 },
  { src: 'assets/history/ai.jpg', out: 'assets/history/ai.webp', max: 1200 },
];

function walkFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'legacy') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, acc);
    else if (/\.(html|js|json|css|md|txt)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

async function main() {
  const created = [];
  for (const job of jobs) {
    const src = path.join(ROOT, job.src);
    if (!fs.existsSync(src)) continue;
    const out = path.join(ROOT, job.out);
    await sharp(src, { failOn: 'none' })
      .rotate()
      .resize({ width: job.max, height: job.max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 5 })
      .toFile(out);
    created.push({ out: job.out, kb: Math.round(fs.statSync(out).size / 102.4) / 10 });
  }

  const replacements = jobs.map((j) => [j.src, j.out]);
  const rewritten = [];
  for (const file of walkFiles(ROOT)) {
    if (file.includes('optimize-images')) continue;
    let text = fs.readFileSync(file, 'utf8');
    const original = text;
    for (const [from, to] of replacements) text = text.split(from).join(to);
    if (text !== original) {
      fs.writeFileSync(file, text, 'utf8');
      rewritten.push(path.relative(ROOT, file).split(path.sep).join('/'));
    }
  }

  for (const job of jobs) {
    const src = path.join(ROOT, job.src);
    if (fs.existsSync(src) && fs.existsSync(path.join(ROOT, job.out))) fs.unlinkSync(src);
  }

  console.log(JSON.stringify({ created, rewrittenCount: rewritten.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
