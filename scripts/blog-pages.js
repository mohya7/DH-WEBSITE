'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://digitalhub.com.eg';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WORDS_PER_MINUTE = 225;

const BLOG_CLUSTERS = [
  'DEX & Digital Employee Experience',
  'Enterprise Software',
  'Data, Cloud & Digital Egypt 2030',
  'AI & Automation',
  'Technical Talent & Outsourcing',
];

const PILLAR_BY_CLUSTER = {
  'DEX & Digital Employee Experience': {
    href: '../partners/nexthink.html',
    label: 'Nexthink Digital Employee Experience',
    serviceLine: 'Digital Employee Experience',
  },
  'Enterprise Software': {
    href: '../services/enterprise-software.html',
    label: 'Enterprise Software Solutions',
    serviceLine: 'Enterprise Software Solutions',
  },
  'Data, Cloud & Digital Egypt 2030': {
    href: '../services/data-analytics.html',
    label: 'Data & Analytics Solutions',
    serviceLine: 'Data & Analytics Solutions',
  },
  'AI & Automation': {
    href: '../services/ai-automation.html',
    label: 'AI & Intelligent Automation Solutions',
    serviceLine: 'AI & Intelligent Automation Solutions',
  },
  'Technical Talent & Outsourcing': {
    href: '../services/outsourcing.html',
    label: 'Outsourcing Technical Talents',
    serviceLine: 'Outsourcing Technical Talents',
  },
};

/** Blog index filter chip slug + visible label derived from cluster. */
const CLUSTER_FILTER_MAP = {
  'DEX & Digital Employee Experience': {
    category: 'digital-employee-experience',
    categoryLabel: 'Digital Employee Experience',
  },
  'Enterprise Software': {
    category: 'enterprise-software',
    categoryLabel: 'Enterprise Software',
  },
  'Data, Cloud & Digital Egypt 2030': {
    category: 'data-analytics',
    categoryLabel: 'Data & Analytics',
  },
  'AI & Automation': {
    category: 'ai-automation',
    categoryLabel: 'AI & Automation',
  },
  'Technical Talent & Outsourcing': {
    category: 'outsourcing',
    categoryLabel: 'Outsourcing',
  },
};

function categoryFromCluster(cluster) {
  return CLUSTER_FILTER_MAP[cluster] || { category: '', categoryLabel: '' };
}

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

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value) {
  const text = stripTags(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function dateOnly(value, fallback) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function computeReadTime(item) {
  const faqText = (item.faq || []).map((entry) => `${entry.question || ''} ${entry.answer || ''}`).join(' ');
  const calloutText = (item.dataCallouts || []).map((entry) => `${entry.figure || ''} ${entry.source || ''}`).join(' ');
  const tableText = item.comparisonTable
    ? `${(item.comparisonTable.columns || []).join(' ')} ${(item.comparisonTable.rows || []).map((row) => row.join(' ')).join(' ')}`
    : '';
  const total = wordCount([item.answerBlock, item.body, faqText, calloutText, tableText].join(' '));
  if (!total) return 0;
  return Math.max(1, Math.ceil(total / WORDS_PER_MINUTE));
}

function extractTocAndBody(bodyHtml) {
  const toc = [];
  const used = new Set();
  const body = sanitizeHtml(bodyHtml).replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (match, attrs, inner) => {
    const text = stripTags(inner);
    let id = slugify(text);
    let n = 2;
    while (used.has(id)) {
      id = `${slugify(text)}-${n}`;
      n += 1;
    }
    used.add(id);
    toc.push({ id, text });
    const safeAttrs = String(attrs || '').replace(/\s+id\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return `<h2 id="${escapeAttr(id)}"${safeAttrs}>${inner}</h2>`;
  });
  return { toc, body };
}

function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Digital Hub',
    legalName: 'Digital Hub S.A.E.',
    alternateName: 'Digital Hub Egypt',
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/assets/digital-hub-logo.png`,
    },
    foundingDate: '2019',
    slogan: 'Empowering Digital Evolution',
    description: 'Digital Hub is a digital transformation company founded in 2019 and headquartered in New Cairo, Egypt, providing enterprise software, data and analytics, AI automation, and technical talent outsourcing to government, banking, and enterprise clients.',
    email: 'sales@digitalhub.com.eg',
    telephone: '+201555553064',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Pearl des Rois Administrative Building, B07, Unit 311, Fifth Settlement',
      addressLocality: 'New Cairo',
      addressRegion: 'Cairo Governorate',
      addressCountry: 'EG',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'sales@digitalhub.com.eg',
      telephone: '+201555553064',
      availableLanguage: ['en', 'ar'],
    },
    knowsAbout: [
      'Digital Employee Experience',
      'Enterprise Software Development',
      'Data Analytics',
      'Artificial Intelligence Automation',
      'IT Outsourcing',
      'Digital Transformation',
    ],
    sameAs: [
      'https://www.linkedin.com/company/digital-hub-eg',
      'https://www.facebook.com/DigitalHub19/',
      'https://www.instagram.com/digitalhub_eg/',
      'https://www.amcham.org.eg/recruitment/employers/6284/digital-hub',
      'https://wuzzuf.net/jobs/careers/Digital-Hub-Egypt-22501',
    ],
  };
}

function buildJsonLd(item, canonical, imageUrl, published, modified, description) {
  const graph = [organizationNode()];
  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Blogs', item: `${SITE_URL}/blogs/` },
  ];
  if (item.cluster) {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: item.cluster });
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 4,
      name: item.title,
      item: canonical,
    });
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: item.title,
      item: canonical,
    });
  }
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: breadcrumbItems,
  });
  graph.push({
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    headline: item.title,
    description,
    image: imageUrl,
    url: canonical,
    datePublished: published,
    dateModified: modified,
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    articleSection: item.cluster || item.categoryLabel || 'Insights',
    mainEntityOfPage: { '@id': `${canonical}#webpage` },
    inLanguage: 'en',
  });
  const faq = Array.isArray(item.faq) ? item.faq.filter((entry) => entry && entry.question && entry.answer) : [];
  if (faq.length >= 1) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faq.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: stripTags(entry.answer),
        },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function renderToc(toc) {
  if (!toc.length) return '';
  return `<nav class="blog-view-toc" aria-label="Table of contents">
        <p class="blog-view-toc__label">Contents</p>
        <ol>
          ${toc.map((entry) => `<li><a href="#${escapeAttr(entry.id)}">${escapeHtml(entry.text)}</a></li>`).join('\n          ')}
        </ol>
      </nav>`;
}

function renderCallouts(callouts) {
  if (!callouts.length) return '';
  return callouts.map((entry) => `<figure class="blog-view-callout">
          <div class="blog-view-callout__figure">${escapeHtml(entry.figure)}</div>
          <figcaption class="blog-view-callout__source">Source: ${escapeHtml(entry.source)}</figcaption>
        </figure>`).join('\n        ');
}

function renderComparison(table) {
  if (!table || !Array.isArray(table.columns) || !table.columns.length || !Array.isArray(table.rows) || !table.rows.length) return '';
  const head = table.columns.map((col) => `<th scope="col">${escapeHtml(col)}</th>`).join('');
  const body = table.rows.map((row) => `<tr>${table.columns.map((_, i) => `<td>${escapeHtml(row[i] || '')}</td>`).join('')}</tr>`).join('\n            ');
  return `<div class="blog-view-compare" role="region" aria-label="Comparison">
          <table>
            <thead><tr>${head}</tr></thead>
            <tbody>
            ${body}
            </tbody>
          </table>
        </div>`;
}

function renderFaq(faq) {
  if (!faq.length) return '';
  return `<section class="blog-view-faq" aria-label="Frequently asked questions">
        <h2>FAQ</h2>
        ${faq.map((entry, index) => `<details class="blog-view-faq__item"${index === 0 ? ' open' : ''}>
          <summary>${escapeHtml(entry.question)}</summary>
          <div class="blog-view-faq__answer"><p>${escapeHtml(entry.answer)}</p></div>
        </details>`).join('\n        ')}
      </section>`;
}

function renderRelated(item, siblings, pillar) {
  const cards = siblings.slice(0, 3).map((post) => {
    const href = String(post.href || '').replace(/^blogs\//, '');
    return `<a class="blog-view-related__card" href="${escapeAttr(href)}">
            <span class="blog-view-related__tag">${escapeHtml(post.cluster || post.categoryLabel || 'Insight')}</span>
            <strong>${escapeHtml(post.title)}</strong>
          </a>`;
  }).join('\n          ');
  const pillarBlock = pillar
    ? `<a class="blog-view-pillar" href="${escapeAttr(pillar.href)}">Explore ${escapeHtml(pillar.label)} <i class="ti ti-arrow-right" aria-hidden="true"></i></a>`
    : '';
  if (!cards && !pillarBlock) return '';
  return `<section class="blog-view-related">
      <div class="section-inner">
        <div class="blog-view-related__head">
          <span class="label">Keep reading</span>
          <h2>Related in ${escapeHtml(item.cluster || 'this topic')}</h2>
        </div>
        <div class="blog-view-related__grid">
          ${cards}
        </div>
        ${pillarBlock}
      </div>
    </section>`;
}

function formatDisplayDate(value) {
  const date = new Date(`${dateOnly(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateOnly(value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function buildBlogHtml(item, allBlogs = []) {
  const href = String(item.href || '').replace(/^\/+/, '');
  const fileName = path.basename(href);
  const canonical = `${SITE_URL}/${href}`;
  const imagePath = String(item.image || 'assets/blog/dex.webp').replace(/^\/+/, '');
  const imageUrl = `${SITE_URL}/${imagePath}`;
  const published = dateOnly(item.datePublished, item.updatedAt);
  const modified = dateOnly(item.dateModified, item.updatedAt || published);
  const { toc, body } = extractTocAndBody(item.body || '');
  const readTime = computeReadTime({ ...item, body });
  const description = stripTags(item.metaDescription || item.answerBlock || item.summary || item.title).slice(0, 300);
  const seoTitle = stripTags(item.seoTitle || item.title).trim() || item.title;
  const pageTitle = /\| Digital Hub\s*$/i.test(seoTitle) ? seoTitle : `${seoTitle} | Digital Hub`;
  const accentClass = item.accent === 'orange' ? ' blog-view-tag--orange' : '';
  const clusterLabel = item.cluster || item.categoryLabel || 'Insights';
  const faq = Array.isArray(item.faq) ? item.faq.filter((entry) => entry && entry.question && entry.answer) : [];
  const callouts = Array.isArray(item.dataCallouts)
    ? item.dataCallouts.filter((entry) => entry && entry.figure && entry.source)
    : [];
  const relatedIds = Array.isArray(item.relatedPosts) ? item.relatedPosts.slice(0, 3) : [];
  const siblings = relatedIds
    .map((id) => allBlogs.find((post) => post.id === id && post.status === 'published' && post.id !== item.id))
    .filter(Boolean)
    .filter((post) => !item.cluster || post.cluster === item.cluster);
  const pillar = PILLAR_BY_CLUSTER[item.cluster] || null;
  const schema = buildJsonLd(item, canonical, imageUrl, published, modified, description);
  const answerHtml = item.answerBlock
    ? `<p class="blog-view-answer">${escapeHtml(item.answerBlock)}</p>`
    : '';
  const bylineMeta = [
    `Published ${escapeHtml(formatDisplayDate(published))}`,
    `Updated ${escapeHtml(formatDisplayDate(modified))}`,
  ];
  if (readTime > 0) bylineMeta.push(`${readTime} min read`);

  return `<!doctype html>
<html lang="en" class="nav-shown">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeAttr(description)}" />
<!-- SEO:START -->
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${escapeAttr(canonical)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Digital Hub S.A.E" />
<meta property="og:title" content="${escapeAttr(pageTitle)}" />
<meta property="og:description" content="${escapeAttr(description)}" />
<meta property="og:url" content="${escapeAttr(canonical)}" />
<meta property="og:image" content="${escapeAttr(imageUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeAttr(pageTitle)}" />
<meta name="twitter:description" content="${escapeAttr(description)}" />
<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />
<meta property="article:publisher" content="${SITE_URL}/" />
<meta property="article:section" content="${escapeAttr(clusterLabel)}" />
<meta property="article:published_time" content="${escapeAttr(published)}" />
<meta property="article:modified_time" content="${escapeAttr(modified)}" />
<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c')}
</script>
<!-- SEO:END -->
<meta name="theme-color" content="#0A1628" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css" />
<link rel="stylesheet" href="../css/service-page.css?v=svc21" />
<link rel="stylesheet" href="../css/hub-pages.css?v=14" />
<link rel="stylesheet" href="../css/tv.css?v=9" />
<link rel="stylesheet" href="../css/responsive.css?v=25" />
</head>
<body class="page-hub page-blog-view">
<div class="site-bg" aria-hidden="true">
  <div class="site-grid"></div>
  <div class="site-waves">
    <div class="wave wave-1"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1600,300 1800,200 C2000,100 2200,300 2400,200" fill="none" stroke="#1A9AD6" stroke-opacity="0.16" stroke-width="1.5"/></svg></div>
    <div class="wave wave-2"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,320 C300,260 500,380 800,320 C1100,260 1300,380 1600,320 C1900,260 2100,380 2400,320" fill="none" stroke="#1A9AD6" stroke-opacity="0.12" stroke-width="1.25"/></svg></div>
    <div class="wave wave-3"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,420 C240,300 480,560 720,420 C960,280 1200,560 1440,420 C1680,280 1920,560 2160,420 C2280,360 2340,400 2400,420" fill="none" stroke="#36B0E5" stroke-opacity="0.10" stroke-width="1.25"/></svg></div>
    <div class="wave wave-4"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,540 C300,480 500,600 800,540 C1100,480 1300,600 1600,540 C1900,480 2100,600 2400,540" fill="none" stroke="#F4970B" stroke-opacity="0.12" stroke-width="1.25"/></svg></div>
  </div>
</div>
<nav class="nav" id="nav" aria-label="Primary">
  <div class="nav-inner glass-surface">
    <a href="../index.html" class="brand" aria-label="Digital Hub home"><img class="brand-logo" src="../assets/digital-hub-logo.png" alt="Digital Hub" decoding="async"></a>
    <ul class="nav-links" role="menubar">
      <li class="has-dd" role="none"><a class="nav-link" role="menuitem" tabindex="0">Services <i class="ti ti-chevron-down"></i></a><div class="dd" role="menu"><a href="../services/enterprise-software.html"><i class="ti ti-code"></i> Enterprise Software Solutions</a><a href="../services/data-analytics.html"><i class="ti ti-chart-bar"></i> Data &amp; Analytics Solutions</a><a href="../services/ai-automation.html"><i class="ti ti-brain"></i> AI &amp; Intelligent Automation Solutions</a><a href="../services/outsourcing.html"><i class="ti ti-users"></i> Outsourcing Technical Talents</a></div></li>
      <li class="has-dd" role="none"><a class="nav-link" role="menuitem" tabindex="0">Partners <i class="ti ti-chevron-down"></i></a><div class="dd" role="menu">
          <a href="../partners/microsoft.html"><i class="ti ti-brand-windows"></i> Microsoft</a>
          <a href="../partners/huawei.html"><i class="ti ti-cloud"></i> Huawei</a>
          <a href="../partners/nexthink.html"><i class="ti ti-device-desktop-analytics"></i> Nexthink</a>
          <a href="../partners/efinance.html"><i class="ti ti-credit-card"></i> eFinance</a>
          <a href="../partners/vodafone.html"><i class="ti ti-antenna-bars-5"></i> Vodafone</a>
        </div></li>
      <li><a class="nav-link" href="../cases/index.html">Case Studies</a></li>
      <li><a class="nav-link is-active" href="index.html" aria-current="page">Blogs</a></li>
      <li><a class="nav-link" href="../about-us.html">About Us</a></li>
      <li><a class="nav-link" href="../careers/index.html">Careers</a></li>
    </ul>
    <a class="nav-cta" href="../get-in-touch.html">Get in touch <i class="ti ti-arrow-right"></i></a>
    <button class="nav-burger" id="navBurger" aria-label="Open menu" aria-expanded="false"><i class="ti ti-menu-2"></i></button>
  </div>
</nav>
<div class="mobile-nav" id="mobileNav" aria-hidden="true">
  <details><summary>Services <i class="ti ti-chevron-down"></i></summary><div class="sub"><a href="../services/enterprise-software.html">Enterprise Software Solutions</a><a href="../services/data-analytics.html">Data &amp; Analytics Solutions</a><a href="../services/ai-automation.html">AI &amp; Intelligent Automation Solutions</a><a href="../services/outsourcing.html">Outsourcing Technical Talents</a></div></details>
  <details><summary>Partners <i class="ti ti-chevron-down"></i></summary><div class="sub">
      <a href="../partners/index.html">All partners</a>
      <a href="../partners/microsoft.html">Microsoft</a>
      <a href="../partners/huawei.html">Huawei</a>
      <a href="../partners/nexthink.html">Nexthink</a>
      <a href="../partners/efinance.html">eFinance</a>
      <a href="../partners/vodafone.html">Vodafone</a>
    </div></details>
  <a href="../cases/index.html">Case Studies</a><a href="index.html">Blogs</a><a href="../about-us.html">About Us</a><a href="../careers/index.html">Careers</a><a class="mn-cta" href="../get-in-touch.html">Get in Touch</a>
</div>
<main>
  <section class="blog-view-hero">
    <div class="section-inner blog-view-hero__grid">
      <div data-reveal>
        <nav class="blog-view-crumb" aria-label="Breadcrumb">
          <a href="index.html">Blogs</a>
          <span aria-hidden="true">›</span>
          <span>${escapeHtml(clusterLabel)}</span>
        </nav>
        <div class="blog-view-kicker"><span class="blog-view-tag${accentClass}">${escapeHtml(clusterLabel)}</span></div>
        <h1 class="blog-view-title">${escapeHtml(item.title)}</h1>
        <p class="blog-view-byline">${bylineMeta.join(' · ')}</p>
      </div>
      <div class="blog-view-media" data-reveal><img src="../${escapeAttr(imagePath)}" alt="${escapeAttr(item.alt || item.title)}" width="810" height="500" loading="eager" fetchpriority="high" decoding="async"></div>
    </div>
  </section>
  <section class="blog-view-body">
    <div class="section-inner">
      <article class="blog-view-article" data-reveal>
        ${answerHtml}
        ${renderToc(toc)}
        ${body}
        ${renderCallouts(callouts)}
        ${renderComparison(item.comparisonTable)}
        ${renderFaq(faq)}
      </article>
    </div>
  </section>
  ${renderRelated(item, siblings, pillar)}
</main>
<footer class="footer"><div class="footer-inner"><div class="footer-top"><div><img class="footer-logo" src="../assets/digital-hub-logo.png" alt="Digital Hub"><p class="footer-tagline">Empowering Digital Evolution</p></div><div class="footer-cols"><div class="footer-col"><h4>Services</h4><a href="../services/enterprise-software.html">Enterprise Software Solutions</a><a href="../services/data-analytics.html">Data &amp; Analytics Solutions</a><a href="../services/ai-automation.html">AI &amp; Intelligent Automation Solutions</a><a href="../services/outsourcing.html">Outsourcing Technical Talents</a></div><div class="footer-col"><h4>Company</h4><a href="../about-us.html">About Us</a><a href="../cases/index.html">Case Studies</a><a href="index.html">Blogs</a><a href="../partners/index.html">Partners</a></div></div><div class="footer-contact"><h4>Contact</h4><a href="mailto:sales@digitalhub.com.eg">sales@digitalhub.com.eg</a><a href="tel:+201555553064">+20 155 555 3064</a></div></div><div class="footer-bottom"><span>&copy; 2024 Digital Hub S.A.E. All rights reserved.</span><span>Microsoft Partner &middot; Nexthink Authorized Reseller &middot; Huawei &middot; eFinance &middot; Vodafone</span></div></div></footer>
<script src="../js/shared.js"></script>
<script src="../js/nav-stay-on-page.js"></script>
</body>
</html>
`;
}

function blogWarnings(item) {
  const warnings = [];
  const answerWords = wordCount(item.answerBlock);
  if (!item.answerBlock || answerWords < 40 || answerWords > 60) {
    warnings.push('answerBlock missing or outside 40–60 words');
  }
  const faq = Array.isArray(item.faq) ? item.faq.filter((entry) => entry && entry.question && entry.answer) : [];
  if (faq.length < 5) warnings.push('fewer than 5 FAQ entries');
  if (!Array.isArray(item.relatedPosts) || item.relatedPosts.length < 1) warnings.push('no related posts selected');
  if (wordCount(item.body) < 1800) warnings.push('body under 1,800 words');
  if (/\bvs\b/i.test(item.title || '') && !(item.comparisonTable && item.comparisonTable.columns && item.comparisonTable.rows && item.comparisonTable.rows.length)) {
    warnings.push('title contains "vs" but comparisonTable is empty');
  }
  return warnings;
}

function writeBlogPages(data) {
  const blogs = data.collections.blogs || [];
  const published = blogs.filter((item) => item.status === 'published' && item.href);
  let written = 0;
  for (const item of published) {
    const relative = String(item.href).replace(/^\/+/, '');
    if (!relative.startsWith('blogs/') || !relative.endsWith('.html')) continue;
    const outPath = path.join(ROOT, ...relative.split('/'));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buildBlogHtml(item, blogs).replace(/\r?\n/g, '\n'), 'utf8');
    written += 1;
  }
  return written;
}

module.exports = {
  BLOG_CLUSTERS,
  PILLAR_BY_CLUSTER,
  CLUSTER_FILTER_MAP,
  categoryFromCluster,
  WORDS_PER_MINUTE,
  wordCount,
  computeReadTime,
  extractTocAndBody,
  buildBlogHtml,
  blogWarnings,
  writeBlogPages,
  dateOnly,
  sanitizeHtml,
  stripTags,
};
