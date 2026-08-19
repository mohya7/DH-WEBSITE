'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ABOUT_FILE = path.join(ROOT, 'about-us.html');
const ART_THEMES = ['launch', 'consult', 'code', 'growth', 'ai'];

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

function extractHistory(html) {
  const sectionMatch = html.match(/<section\b[^>]*\bid=["']history["'][^>]*>([\s\S]*?)<\/section>/i);
  if (!sectionMatch) return null;
  const section = sectionMatch[1] || '';
  const head = section.match(/<header class="about-head about-history__head"[^>]*>([\s\S]*?)<\/header>/i);
  const headBlock = head ? head[1] : '';
  const label = decodeHtml((headBlock.match(/<span class="label">([\s\S]*?)<\/span>/i) || [])[1] || '');
  const title = decodeHtml((headBlock.match(/<h2>([\s\S]*?)<\/h2>/i) || [])[1] || '');
  const lead = decodeHtml((headBlock.match(/<p>([\s\S]*?)<\/p>/i) || [])[1] || '');

  const slides = [];
  const slideRe = /<figure\b[^>]*class="[^"]*jtl-slide[^"]*"[^>]*>[\s\S]*?<img\b([^>]*)>[\s\S]*?<\/figure>/gi;
  let slide;
  while ((slide = slideRe.exec(section))) {
    const attrs = slide[1] || '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    slides.push({
      image: String(srcMatch && srcMatch[1] || '').replace(/^\.\.\//, '').replace(/^\//, ''),
      alt: altMatch ? decodeHtml(altMatch[1]) : '',
    });
  }

  const milestones = [];
  const itemRe = /<li\b[^>]*class="[^"]*jtl-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let item;
  let index = 0;
  while ((item = itemRe.exec(section))) {
    const block = item[1] || '';
    const year = decodeHtml((block.match(/<span class="jtl-year">([\s\S]*?)<\/span>/i) || [])[1] || '');
    const text = decodeHtml((block.match(/<span class="jtl-text">([\s\S]*?)<\/span>/i) || [])[1] || '');
    const slide = slides[index] || {};
    milestones.push({
      year,
      text,
      image: slide.image || '',
      alt: slide.alt || (year ? `${year} milestone` : ''),
    });
    index += 1;
  }

  if (!label && !title && !lead && !milestones.length) return null;
  return { label, title, lead, milestones };
}

function slidesHtml(milestones) {
  return milestones.map((entry, index) => {
    const theme = ART_THEMES[index % ART_THEMES.length];
    const src = escapeAttr(String(entry.image || '').replace(/^\.\.\//, '').replace(/^\//, ''));
    const alt = escapeAttr(entry.alt || (entry.year ? `${entry.year} milestone` : 'History milestone'));
    const active = index === 0 ? ' is-active' : '';
    return `            <figure class="jtl-slide${active}" data-jtl="${index}">
              <div class="jtl-slide__art jtl-slide__art--${theme} jtl-slide__art--photo">
                <img src="${src}" alt="${alt}" loading="lazy" decoding="async" width="1400" height="933">
              </div>
            </figure>`;
  }).join('\n');
}

function listHtml(milestones) {
  return milestones.map((entry, index) => {
    const active = index === 0 ? ' is-active' : '';
    const pressed = index === 0 ? 'true' : 'false';
    return `            <li class="jtl-item${active}" data-jtl="${index}">
              <span class="jtl-dot" aria-hidden="true"></span>
              <button type="button" class="jtl-item__btn" aria-pressed="${pressed}">
                <span class="jtl-year">${escapeHtml(entry.year || '')}</span>
                <span class="jtl-text">${escapeHtml(entry.text || '')}</span>
              </button>
            </li>`;
  }).join('\n');
}

function syncAboutHistory(data) {
  const history = data && data.pages && data.pages.about && data.pages.about.history;
  if (!history || typeof history !== 'object') return { updated: [] };
  const milestones = Array.isArray(history.milestones) ? history.milestones.filter((entry) => entry && (entry.year || entry.text || entry.image)) : [];
  if (!milestones.length && !history.label && !history.title && !history.lead) return { updated: [] };
  if (!fs.existsSync(ABOUT_FILE)) return { updated: [] };

  let html = fs.readFileSync(ABOUT_FILE, 'utf8');
  const original = html;

  html = html.replace(
    /(<section\b[^>]*\bid=["']history["'][^>]*>)([\s\S]*?)(<\/section>)/i,
    (full, open, body, close) => {
      let next = body;
      if (history.label) {
        next = next.replace(
          /(<header class="about-head about-history__head"[^>]*>[\s\S]*?<span class="label">)([\s\S]*?)(<\/span>)/i,
          `$1${escapeHtml(history.label)}$3`
        );
      }
      if (history.title) {
        next = next.replace(
          /(<header class="about-head about-history__head"[^>]*>[\s\S]*?<h2>)([\s\S]*?)(<\/h2>)/i,
          `$1${escapeHtml(history.title)}$3`
        );
      }
      if (history.lead) {
        next = next.replace(
          /(<header class="about-head about-history__head"[^>]*>[\s\S]*?<p>)([\s\S]*?)(<\/p>)/i,
          `$1${escapeHtml(history.lead)}$3`
        );
      }
      if (milestones.length) {
        next = next.replace(
          /(<div class="jtl-slides">)([\s\S]*?)(<\/div>\s*<\/div>\s*<div class="jtl-track">)/i,
          `$1\n${slidesHtml(milestones)}\n          $3`
        );
        next = next.replace(
          /(<ol class="jtl-list"[^>]*>)([\s\S]*?)(<\/ol>)/i,
          `$1\n${listHtml(milestones)}\n          $3`
        );
      }
      return `${open}${next}${close}`;
    }
  );

  if (html !== original) {
    fs.writeFileSync(ABOUT_FILE, html, 'utf8');
    return { updated: ['about-us.html'] };
  }
  return { updated: [] };
}

function seedAboutHistory(data) {
  if (!data.pages) data.pages = {};
  if (!data.pages.about) data.pages.about = {};
  if (!fs.existsSync(ABOUT_FILE)) return 0;
  const history = extractHistory(fs.readFileSync(ABOUT_FILE, 'utf8'));
  if (!history) return 0;
  data.pages.about.history = history;
  return 1;
}

module.exports = {
  syncAboutHistory,
  seedAboutHistory,
  extractHistory,
};

if (require.main === module) {
  const adminPath = path.join(ROOT, 'content', 'admin-content.json');
  const sitePath = path.join(ROOT, 'content', 'site-content.json');
  const admin = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  const seeded = seedAboutHistory(admin);
  fs.writeFileSync(adminPath, `${JSON.stringify(admin, null, 2)}\n`, 'utf8');
  const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  seedAboutHistory(site);
  fs.writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(ROOT, 'content', 'site-content.js'),
    `/* Generated by the Digital Hub CMS. Do not edit directly. */\nwindow.DH_CONTENT = ${JSON.stringify(site)};\n`,
    'utf8'
  );
  const sync = syncAboutHistory(admin);
  console.log(JSON.stringify({ seeded, sync }, null, 2));
}
