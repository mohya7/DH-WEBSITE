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

function extractMenuScenes(html) {
  const scenes = [];
  const itemRe = /<button\b[^>]*class="[^"]*eswd-menu__item[^"]*"[^>]*>([\s\S]*?)<\/button>/gi;
  let match;
  while ((match = itemRe.exec(html))) {
    const block = match[1] || '';
    const title = decodeHtml((block.match(/<span class="eswd-menu__title">([\s\S]*?)<\/span>/i) || [])[1] || '');
    const description = decodeHtml((block.match(/<p class="eswd-menu__desc">([\s\S]*?)<\/p>/i) || [])[1] || '');
    const listMatch = block.match(/<ul class="eswd-menu__list">([\s\S]*?)<\/ul>/i);
    const features = [];
    if (listMatch) {
      const liRe = /<li>\s*<i class="([^"]+)"[^>]*><\/i>\s*([\s\S]*?)<\/li>/gi;
      let li;
      while ((li = liRe.exec(listMatch[1]))) {
        features.push({ icon: normalizeIcon(li[1]), text: decodeHtml(li[2]) });
      }
    }
    scenes.push({ title, description, features });
  }
  return scenes;
}

function extractStageScenes(html) {
  const scenes = [];
  const re = /<div class="eswd-scene[^"]*"[\s\S]*?<span class="eswd-scene__label">([\s\S]*?)<\/span>[\s\S]*?<div class="eswd-scene__photo">\s*<img\b([^>]*)>/gi;
  let match;
  while ((match = re.exec(html))) {
    const label = decodeHtml(match[1] || '');
    const attrs = match[2] || '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const src = String(srcMatch && srcMatch[1] || '').replace(/^\.\.\//, '').replace(/^\//, '');
    scenes.push({
      label,
      image: src,
      alt: altMatch ? decodeHtml(altMatch[1]) : (label ? `${label} visual` : ''),
    });
  }
  return scenes;
}

function extractScenesFromHtml(html) {
  const menu = extractMenuScenes(html);
  const stage = extractStageScenes(html);
  const count = Math.max(menu.length, stage.length);
  const scenes = [];
  for (let i = 0; i < count; i += 1) {
    const m = menu[i] || {};
    const s = stage[i] || {};
    const title = m.title || s.label || `Scene ${i + 1}`;
    scenes.push({
      title,
      label: title,
      description: m.description || '',
      features: Array.isArray(m.features) ? m.features : [],
      image: s.image || '',
      alt: s.alt || (title ? `${title} visual` : ''),
    });
  }
  return scenes;
}

function normalizeIcon(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const name = parts.find((part) => part.indexOf('ti-') === 0) || (raw.indexOf('ti-') === 0 ? raw : '');
  return name || 'ti-circle';
}

function featureListHtml(features) {
  return (features || []).map((feature) => {
    const icon = escapeAttr(normalizeIcon(feature.icon));
    const text = escapeHtml(feature.text || '');
    return `<li><i class="ti ${icon}" aria-hidden="true"></i> ${text}</li>`;
  }).join('\n                ');
}

function syncServiceSuiteImages(data) {
  const services = (data.collections && data.collections.services) || [];
  const updated = [];
  for (const service of services) {
    if (!service || service.status === 'draft') continue;
    const scenes = Array.isArray(service.suiteScenes) ? service.suiteScenes : [];
    const href = String(service.href || '').replace(/^\//, '');
    if (!href || !href.endsWith('.html')) continue;
    if (!scenes.length && !service.title && !service.summary) continue;
    const file = path.join(ROOT, href);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    const original = html;

    if (service.title) {
      html = html.replace(
        /(<h2 class="eswd-head__title">[\s\S]*?<span class="eswd-head__line2">)([\s\S]*?)(<\/span>)/i,
        `$1${escapeHtml(service.title)}$3`
      );
      html = html.replace(
        /(<title>)([\s\S]*?)(<\/title>)/i,
        `$1${escapeHtml(service.title)} | Digital Hub S.A.E$3`
      );
    }
    if (service.summary) {
      html = html.replace(
        /(<header class="eswd-head"[^>]*>[\s\S]*?<p>)([\s\S]*?)(<\/p>)/i,
        `$1${escapeHtml(service.summary)}$3`
      );
      html = html.replace(
        /(<meta name="description" content=")([^"]*)(")/i,
        `$1${escapeAttr(service.summary)}$3`
      );
    }

    if (!scenes.length) {
      if (html !== original) {
        fs.writeFileSync(file, html, 'utf8');
        updated.push(href);
      }
      continue;
    }

    let menuIndex = 0;
    html = html.replace(
      /<button\b([^>]*class="[^"]*eswd-menu__item[^"]*"[^>]*)>([\s\S]*?)<\/button>/gi,
      (full, openAttrs, block) => {
        const scene = scenes[menuIndex];
        menuIndex += 1;
        if (!scene) return full;
        const title = scene.title || scene.label || '';
        const description = scene.description || '';
        const features = Array.isArray(scene.features) ? scene.features.filter((f) => f && f.text) : [];
        let next = block;
        if (title) {
          next = next.replace(
            /<span class="eswd-menu__title">[\s\S]*?<\/span>/i,
            `<span class="eswd-menu__title">${escapeHtml(title)}</span>`
          );
        }
        if (description) {
          next = next.replace(
            /<p class="eswd-menu__desc">[\s\S]*?<\/p>/i,
            `<p class="eswd-menu__desc">${escapeHtml(description)}</p>`
          );
        }
        if (features.length) {
          next = next.replace(
            /<ul class="eswd-menu__list">[\s\S]*?<\/ul>/i,
            `<ul class="eswd-menu__list">\n                ${featureListHtml(features)}\n              </ul>`
          );
        }
        return `<button${openAttrs}>${next}</button>`;
      }
    );

    let stageIndex = 0;
    html = html.replace(
      /(<div class="eswd-scene\b[^"]*"[^>]*>[\s\S]*?<span class="eswd-scene__label">)([\s\S]*?)(<\/span>[\s\S]*?<div class="eswd-scene__photo">\s*)<img\b([^>]*)>/gi,
      (full, beforeLabel, _oldLabel, mid, attrs) => {
        const scene = scenes[stageIndex];
        stageIndex += 1;
        if (!scene) return full;
        const title = scene.title || scene.label || decodeHtml(_oldLabel);
        const src = scene.image
          ? escapeAttr(`../${String(scene.image).replace(/^\.\.\//, '').replace(/^\//, '')}`)
          : null;
        const alt = escapeAttr(scene.alt || (title ? `${title} visual` : 'Service visual'));
        const img = src ? `<img ${patchImgAttrs(attrs, src, alt)}>` : `<img ${attrs}>`;
        return `${beforeLabel}${escapeHtml(title)}${mid}${img}`;
      }
    );

    if (html !== original) {
      fs.writeFileSync(file, html, 'utf8');
      updated.push(href);
    }
  }
  return { updated };
}

function seedSuiteScenes(data) {
  const services = (data.collections && data.collections.services) || [];
  let changed = 0;
  for (const service of services) {
    const href = String(service.href || '').replace(/^\//, '');
    if (!href) continue;
    const file = path.join(ROOT, href);
    if (!fs.existsSync(file)) continue;
    const scenes = extractScenesFromHtml(fs.readFileSync(file, 'utf8'));
    if (!scenes.length) continue;
    service.suiteScenes = scenes;
    changed += 1;
  }
  return changed;
}

module.exports = {
  syncServiceSuiteImages,
  seedSuiteScenes,
  extractScenesFromHtml,
};

if (require.main === module) {
  const adminPath = path.join(ROOT, 'content', 'admin-content.json');
  const sitePath = path.join(ROOT, 'content', 'site-content.json');
  const admin = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  const seeded = seedSuiteScenes(admin);
  fs.writeFileSync(adminPath, `${JSON.stringify(admin, null, 2)}\n`, 'utf8');
  const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  seedSuiteScenes(site);
  fs.writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(ROOT, 'content', 'site-content.js'),
    `/* Generated by the Digital Hub CMS. Do not edit directly. */\nwindow.DH_CONTENT = ${JSON.stringify(site)};\n`,
    'utf8'
  );
  const sync = syncServiceSuiteImages(admin);
  console.log(JSON.stringify({ seeded, sync }, null, 2));
}
