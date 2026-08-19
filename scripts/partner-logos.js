'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function contentSlug(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return slug || 'item';
}

function partnerSlug(item) {
  const href = String(item.href || '');
  const fromHref = href.match(/(?:^|\/)([a-z0-9-]+)\.html$/i);
  if (fromHref) return fromHref[1].toLowerCase();
  const id = String(item.id || '');
  if (id.startsWith('partner-')) return id.slice('partner-'.length).toLowerCase();
  return contentSlug(item.name);
}

function publishedPartners(data) {
  return ((data.collections && data.collections.partners) || [])
    .filter((item) => item && item.status !== 'draft' && item.image)
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function assetSrc(image, depth) {
  const clean = String(image || '').replace(/^\//, '');
  return `${'../'.repeat(depth)}${clean}`;
}

function patchImgAttrs(attrs, src, alt) {
  let next = String(attrs || '');
  if (/\bsrc\s*=/.test(next)) next = next.replace(/\bsrc\s*=\s*(["'])[\s\S]*?\1/i, `src="${src}"`);
  else next += ` src="${src}"`;
  if (/\balt\s*=/.test(next)) next = next.replace(/\balt\s*=\s*(["'])[\s\S]*?\1/i, `alt="${alt}"`);
  else next += ` alt="${alt}"`;
  return next.replace(/\s+/g, ' ').trim();
}

function updateImgsInHtml(html, matcher, src, alt) {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    if (/digital-hub-logo/i.test(full)) return full;
    if (!matcher(full, attrs)) return full;
    return `<img ${patchImgAttrs(attrs, src, alt)}>`;
  });
}

function syncFile(relPath, partners, depth) {
  const file = path.join(ROOT, relPath);
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const fileSlug = path.basename(relPath, '.html').toLowerCase();

  for (const item of partners) {
    const slug = partnerSlug(item);
    const src = escapeAttr(assetSrc(item.image, depth));
    const alt = escapeAttr(item.alt || `${item.name} logo`);
    const hrefNeedle = new RegExp(`(?:\\.\\./)?partners/${slug}\\.html|${slug}\\.html`, 'i');

    // Trust-bar / hub cards: logo sits inside the partner link.
    html = html.replace(
      /<a\b([^>]*\bhref\s*=\s*["'][^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi,
      (full, openAttrs, body) => {
        const hrefMatch = openAttrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
        if (!hrefMatch || !hrefNeedle.test(hrefMatch[1])) return full;
        if (!/<img\b/i.test(body)) return full;
        const nextBody = updateImgsInHtml(body, () => true, src, alt);
        return `<a${openAttrs}>${nextBody}</a>`;
      }
    );

    // Home partners grid: logo is a sibling of the Explore More link.
    html = html.replace(
      /<article\b[^>]*class="[^"]*\bpartner\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi,
      (block) => {
        if (!hrefNeedle.test(block)) return block;
        return updateImgsInHtml(
          block,
          (full, attrs) => /\bpartner-logo-img\b/.test(full) || /\bpartner-logo-img\b/.test(attrs),
          src,
          alt
        );
      }
    );

    // Partner detail hero logo for this page.
    if (fileSlug === slug) {
      html = html.replace(
        /(<div\b[^>]*class="[^"]*\bpartner-view-logo\b[^"]*"[^>]*>\s*)<img\b([^>]*)>/i,
        (full, open, attrs) => `${open}<img ${patchImgAttrs(attrs, src, alt)}>`
      );
    }
  }

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    return true;
  }
  return false;
}

function syncPartnerLogos(data) {
  const partners = publishedPartners(data);
  if (!partners.length) return { updated: [] };

  const targets = [
    { path: 'index.html', depth: 0 },
    { path: 'partners/index.html', depth: 1 },
  ];

  for (const item of partners) {
    targets.push({ path: `partners/${partnerSlug(item)}.html`, depth: 1 });
  }

  const updated = [];
  for (const target of targets) {
    if (syncFile(target.path, partners, target.depth)) updated.push(target.path);
  }
  return { updated };
}

module.exports = {
  syncPartnerLogos,
  partnerSlug,
  publishedPartners,
};

if (require.main === module) {
  const dataPath = path.join(ROOT, 'content', 'admin-content.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const result = syncPartnerLogos(data);
  console.log(JSON.stringify(result, null, 2));
}
