'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SOCIAL_ITEMS = [
  { key: 'linkedin', label: 'LinkedIn', icon: 'ti-brand-linkedin' },
  { key: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook' },
  { key: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram' },
  { key: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok' },
];

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function socialHtml(social) {
  const data = social && typeof social === 'object' ? social : {};
  return SOCIAL_ITEMS
    .filter((item) => /^https?:\/\//i.test(String(data[item.key] || '').trim()))
    .map((item) => {
      const href = escapeAttr(String(data[item.key]).trim());
      return `<a href="${href}" target="_blank" rel="noopener" aria-label="${item.label}"><i class="ti ${item.icon}"></i></a>`;
    })
    .join('\n          ');
}

function syncSiteSocial(data) {
  const social = data && data.pages && data.pages.home && data.pages.home.social;
  if (!social || typeof social !== 'object') return { updated: [] };
  const file = path.join(ROOT, 'index.html');
  if (!fs.existsSync(file)) return { updated: [] };
  let html = fs.readFileSync(file, 'utf8');
  const next = socialHtml(social);
  if (!next) return { updated: [] };
  const replaced = html.replace(
    /(<div class="footer-social">)([\s\S]*?)(<\/div>)/i,
    `$1\n          ${next}\n        $3`
  );
  if (replaced === html) return { updated: [] };
  fs.writeFileSync(file, replaced, 'utf8');
  return { updated: ['index.html'] };
}

module.exports = { syncSiteSocial, socialHtml, SOCIAL_ITEMS };
