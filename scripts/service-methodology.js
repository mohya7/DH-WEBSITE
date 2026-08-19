'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function decodeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function patchImgAttrs(attrs, src, alt) {
  let next = String(attrs || '');
  if (/\bsrc\s*=/.test(next)) next = next.replace(/\bsrc\s*=\s*(["'])[\s\S]*?\1/i, `src="${src}"`);
  else next += ` src="${src}"`;
  if (/\balt\s*=/.test(next)) next = next.replace(/\balt\s*=\s*(["'])[\s\S]*?\1/i, `alt="${alt}"`);
  else next += ` alt="${alt}"`;
  return next.replace(/\s+/g, ' ').trim();
}

function extractMethodology(html) {
  const sectionMatch = html.match(/<section\b[^>]*\bid=["']method["'][^>]*>([\s\S]*?)<\/section>/i);
  if (!sectionMatch) return null;
  const section = sectionMatch[1] || '';
  const head = section.match(/<header class="method-head"[^>]*>([\s\S]*?)<\/header>/i);
  const headBlock = head ? head[1] : '';
  const label = decodeHtml((headBlock.match(/<span class="label">([\s\S]*?)<\/span>/i) || [])[1] || '');
  const title = decodeHtml((headBlock.match(/<h2>([\s\S]*?)<\/h2>/i) || [])[1] || '');
  const lead = decodeHtml((headBlock.match(/<p>([\s\S]*?)<\/p>/i) || [])[1] || '');
  const stages = [];
  const rowRe = /<article\b[^>]*class="[^"]*method-row[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let row;
  while ((row = rowRe.exec(section))) {
    const block = row[1] || '';
    const attrs = ((block.match(/<div class="method-frame[^"]*">\s*<img\b([^>]*)>/i) || [])[1] || '');
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const src = String(srcMatch && srcMatch[1] || '').replace(/^\.\.\//, '').replace(/^\//, '');
    const stageTitle = decodeHtml((block.match(/<h3>([\s\S]*?)<\/h3>/i) || [])[1] || '');
    const description = decodeHtml((block.match(/<div class="method-copy">[\s\S]*?<p>([\s\S]*?)<\/p>/i) || [])[1] || '');
    stages.push({
      title: stageTitle,
      description,
      image: src,
      alt: altMatch ? decodeHtml(altMatch[1]) : (stageTitle ? `${stageTitle} visual` : ''),
    });
  }
  if (!label && !title && !lead && !stages.length) return null;
  return { label, title, lead, stages };
}

function syncServiceMethodology(data) {
  const services = (data.collections && data.collections.services) || [];
  const updated = [];
  for (const service of services) {
    if (!service || service.status === 'draft') continue;
    const methodology = service.methodology;
    if (!methodology || typeof methodology !== 'object') continue;
    const stages = Array.isArray(methodology.stages) ? methodology.stages : [];
    if (!stages.length && !methodology.title && !methodology.label && !methodology.lead) continue;
    const href = String(service.href || '').replace(/^\//, '');
    if (!href || !href.endsWith('.html')) continue;
    const file = path.join(ROOT, href);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    const original = html;

    html = html.replace(
      /(<section\b[^>]*\bid=["']method["'][^>]*>)([\s\S]*?)(<\/section>)/i,
      (full, open, body, close) => {
        let next = body;
        if (methodology.label) {
          next = next.replace(
            /(<header class="method-head"[^>]*>[\s\S]*?<span class="label">)([\s\S]*?)(<\/span>)/i,
            `$1${escapeHtml(methodology.label)}$3`
          );
        }
        if (methodology.title) {
          next = next.replace(
            /(<header class="method-head"[^>]*>[\s\S]*?<h2>)([\s\S]*?)(<\/h2>)/i,
            `$1${escapeHtml(methodology.title)}$3`
          );
        }
        if (methodology.lead) {
          next = next.replace(
            /(<header class="method-head"[^>]*>[\s\S]*?<p>)([\s\S]*?)(<\/p>)/i,
            `$1${escapeHtml(methodology.lead)}$3`
          );
        }

        let stageIndex = 0;
        next = next.replace(
          /<article\b([^>]*class="[^"]*method-row[^"]*"[^>]*)>([\s\S]*?)<\/article>/gi,
          (rowFull, openAttrs, block) => {
            const stage = stages[stageIndex];
            const num = String(stageIndex + 1);
            stageIndex += 1;
            if (!stage) return rowFull;
            let row = block;
            const title = stage.title || '';
            const description = stage.description || '';
            const src = stage.image
              ? escapeAttr(`../${String(stage.image).replace(/^\.\.\//, '').replace(/^\//, '')}`)
              : null;
            const alt = escapeAttr(stage.alt || (title ? `${title} visual` : 'Methodology stage'));

            row = row.replace(
              /(<div class="method-spine-node"[^>]*>)([\s\S]*?)(<\/div>)/i,
              `$1${num}$3`
            );
            row = row.replace(
              /(<span class="method-step-num"[^>]*>)([\s\S]*?)(<\/span>)/i,
              `$1${num}$3`
            );
            if (title) {
              row = row.replace(/<h3>[\s\S]*?<\/h3>/i, `<h3>${escapeHtml(title)}</h3>`);
            }
            if (description) {
              row = row.replace(
                /(<div class="method-copy">[\s\S]*?<p>)([\s\S]*?)(<\/p>)/i,
                `$1${escapeHtml(description)}$3`
              );
            }
            if (src) {
              row = row.replace(
                /(<div class="method-frame[^"]*">\s*)<img\b([^>]*)>/i,
                (imgFull, before, attrs) => `${before}<img ${patchImgAttrs(attrs, src, alt)}>`
              );
            }
            return `<article${openAttrs}>${row}</article>`;
          }
        );

        return `${open}${next}${close}`;
      }
    );

    if (html !== original) {
      fs.writeFileSync(file, html, 'utf8');
      updated.push(href);
    }
  }
  return { updated };
}

function seedMethodology(data) {
  const services = (data.collections && data.collections.services) || [];
  let changed = 0;
  for (const service of services) {
    const href = String(service.href || '').replace(/^\//, '');
    if (!href) continue;
    const file = path.join(ROOT, href);
    if (!fs.existsSync(file)) continue;
    const methodology = extractMethodology(fs.readFileSync(file, 'utf8'));
    if (!methodology) continue;
    service.methodology = methodology;
    changed += 1;
  }
  return changed;
}

module.exports = {
  syncServiceMethodology,
  seedMethodology,
  extractMethodology,
};

if (require.main === module) {
  const adminPath = path.join(ROOT, 'content', 'admin-content.json');
  const sitePath = path.join(ROOT, 'content', 'site-content.json');
  const admin = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  const seeded = seedMethodology(admin);
  fs.writeFileSync(adminPath, `${JSON.stringify(admin, null, 2)}\n`, 'utf8');
  const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  seedMethodology(site);
  fs.writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(ROOT, 'content', 'site-content.js'),
    `/* Generated by the Digital Hub CMS. Do not edit directly. */\nwindow.DH_CONTENT = ${JSON.stringify(site)};\n`,
    'utf8'
  );
  const sync = syncServiceMethodology(admin);
  console.log(JSON.stringify({ seeded, sync }, null, 2));
}
