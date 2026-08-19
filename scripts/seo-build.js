'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://digitalhub.com.eg';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const overrides = {
  'index.html': {
    title: 'Digital Hub | Digital Transformation Company in Egypt',
    description: 'Digital Hub is an Egyptian digital transformation company delivering enterprise software, data and analytics, AI automation, and technical talent to government, banking, and enterprise clients across Egypt and Saudi Arabia.',
  },
  'about-us.html': {
    description: 'Meet Digital Hub, an Egypt-based enterprise technology partner delivering software, data, AI, automation, and outsourcing solutions across EMEA.',
  },
  'partners/index.html': {
    description: 'Explore Digital Hub partnerships with Microsoft, Huawei, Nexthink, eFinance, and Vodafone for secure enterprise transformation.',
  },
  'partners/huawei.html': {
    description: 'Digital Hub partners with Huawei to deliver cloud infrastructure, networking, storage, and AI-ready enterprise technology.',
  },
  'partners/vodafone.html': {
    description: 'Digital Hub partners with Vodafone to deliver cloud solutions, enterprise connectivity, and integrated digital infrastructure.',
  },
  'partners/microsoft.html': {
    description: 'Digital Hub partners with Microsoft to deliver Azure, Microsoft 365, Power Platform, Dynamics 365, and AI solutions for enterprise and government.',
  },
  'partners/nexthink.html': {
    description: 'Digital Hub is an authorized Nexthink reseller delivering Digital Employee Experience monitoring, deployment, and optimization across Egypt, Saudi Arabia, and North Africa.',
  },
  'services/enterprise-software.html': {
    title: 'Enterprise Software Solutions | Digital Hub S.A.E',
    description: 'We build secure, scalable platforms around how your teams actually operate — custom applications, digital portals, and integrations engineered for regulated enterprises.',
  },
  'services/data-analytics.html': {
    title: 'Data & Analytics Solutions | Digital Hub S.A.E',
    description: 'We turn scattered, untrusted data into one beautiful, governed source of truth, engineered on Microsoft Fabric and Azure, and designed in Power BI so decisions get made in seconds, not weeks.',
  },
  'services/ai-automation.html': {
    title: 'AI & Intelligent Automation | Digital Hub S.A.E',
    description: 'We design AI agents that think, act and scale: digital co-workers embedded in your real workflows, connecting email, CRM, documents and dashboards into one intelligent operation — with governance suited to regulated enterprises.',
  },
  'services/outsourcing.html': {
    title: 'Outsourcing Technical Talents | Digital Hub S.A.E',
    description: 'When delivery timelines outpace hiring, Digital Hub embeds screened, deployment-ready professionals — data engineers, developers, AI specialists, and QA — as a seamless extension of your team with flexible time zone coverage.',
  },
  'cases/ministry-planning.html': {
    description: 'How Digital Hub supports Egypt’s national planning systems with a governed data warehouse, cybersecurity, dashboards, and continuous platform support.',
  },
  'cases/data-center-transformation.html': {
    description: 'How Digital Hub delivered data center and enterprise infrastructure transformation for Credit Guarantee Corporation in Egypt’s banking ecosystem.',
  },
  'careers/apply.html': {
    description: 'Apply for an open role at Digital Hub and submit your experience, availability, LinkedIn profile, and CV securely to the HR team.',
  },
  'careers/dotnet-backend-developer.html': {
    description: 'Apply for the .NET Backend Developer role at Digital Hub in New Cairo and build reliable enterprise backends, APIs, and integrations.',
  },
  'blogs/azure-digital-egypt-2030.html': {
    title: 'Microsoft Azure and Digital Egypt 2030 | Digital Hub',
  },
  'blogs/digital-transformation-signs.html': {
    title: '5 Signs You Need Digital Transformation | Digital Hub',
  },
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'admin' || entry.name === 'node_modules' || entry.name === '.git') return [];
      return walk(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&nbsp;/g, ' ');
}

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function textFrom(html) {
  return decodeHtml(String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim());
}

function match(html, expression) {
  const result = html.match(expression);
  return result ? result[1].trim() : '';
}

function canonicalFor(relativePath) {
  const posixPath = relativePath.replace(/\\/g, '/');
  if (posixPath === 'index.html') return `${SITE_URL}/`;
  if (posixPath.endsWith('/index.html')) return `${SITE_URL}/${posixPath.slice(0, -'index.html'.length)}`;
  return `${SITE_URL}/${posixPath}`;
}

function absoluteAsset(source, relativePath) {
  if (!source) return `${SITE_URL}/assets/digital-hub-logo.png`;
  if (/^https?:\/\//i.test(source)) return source;
  const pageDirectory = path.posix.dirname(`/${relativePath.replace(/\\/g, '/')}`);
  const assetPath = path.posix.normalize(path.posix.join(pageDirectory, source));
  return `${SITE_URL}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
}

function imageFor(relativePath, html, existingImage) {
  const posixPath = relativePath.replace(/\\/g, '/');
  if (posixPath === 'index.html' || posixPath.startsWith('services/')) return `${SITE_URL}/assets/blog/transformation.webp`;
  if (posixPath.startsWith('careers/')) return `${SITE_URL}/assets/careers/hero.webp`;
  if (existingImage) return existingImage;
  const scopedImage = match(html, /<img\b[^>]*src="([^"]*assets\/(?:blog|cases)\/[^"]+)"/i);
  if (scopedImage) return absoluteAsset(scopedImage, posixPath);
  if (posixPath.startsWith('blogs/')) return `${SITE_URL}/assets/blog/dex.webp`;
  if (posixPath.startsWith('cases/')) return `${SITE_URL}/assets/cases/planning.webp`;
  return `${SITE_URL}/assets/digital-hub-logo.png`;
}

function organization() {
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

function breadcrumb(relativePath, title, canonical) {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` }];
  if (parts.length > 1) {
    const section = parts[0];
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: section.charAt(0).toUpperCase() + section.slice(1),
      item: `${SITE_URL}/${section}/`,
    });
  }
  if (!relativePath.endsWith('index.html')) {
    items.push({ '@type': 'ListItem', position: items.length + 1, name: title.split('|')[0].trim(), item: canonical });
  }
  return { '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: items };
}

function schemaFor(relativePath, title, description, canonical, image, html, existing) {
  const posixPath = relativePath.replace(/\\/g, '/');
  const graph = [organization()];
  if (posixPath === 'index.html') {
    graph.push({
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Digital Hub S.A.E',
      url: `${SITE_URL}/`,
      publisher: { '@id': ORGANIZATION_ID },
      inLanguage: 'en',
    });
    graph.push({
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      name: title,
      description,
      url: canonical,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: image },
      inLanguage: 'en',
    });
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  const serviceName = posixPath.startsWith('services/')
    ? (textFrom(match(html, /<h1\b[^>]*class="[^"]*svc-display[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)) || title.split('|')[0].trim())
    : '';
  const serviceDescription = posixPath.startsWith('services/')
    ? (textFrom(match(html, /<p\b[^>]*class="[^"]*svc-lede[^"]*"[^>]*>([\s\S]*?)<\/p>/i)) || description)
    : '';
  graph.push(breadcrumb(posixPath, serviceName || title, canonical));
  let page;
  if (/^blogs\/(?!index\.html)/.test(posixPath)) {
    const published = existing.published || '2026-06-15';
    const modified = existing.modified || published;
    page = {
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      headline: title.split('|')[0].trim(),
      description,
      image,
      url: canonical,
      datePublished: published,
      dateModified: modified,
      author: { '@id': ORGANIZATION_ID },
      publisher: { '@id': ORGANIZATION_ID },
      articleSection: existing.section || 'Insights',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      inLanguage: 'en',
    };
  } else if (/^careers\/(?!index\.html|apply\.html)/.test(posixPath)) {
    const roleTitle = textFrom(match(html, /<header\b[^>]*class="[^"]*careers-detail__meta[^"]*"[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)) || title.split('|')[0].trim();
    const tags = Array.from(html.matchAll(/<span>([^<]+)<\/span>/gi)).map((entry) => textFrom(entry[1]));
    const employment = tags.find((value) => /full|part|intern|contract|project/i.test(value)) || 'Full time';
    let employmentType = 'FULL_TIME';
    if (/intern/i.test(employment)) employmentType = 'INTERN';
    else if (/part/i.test(employment)) employmentType = 'PART_TIME';
    else if (/contract|project/i.test(employment)) employmentType = 'CONTRACTOR';
    page = {
      '@type': 'JobPosting',
      '@id': `${canonical}#job`,
      title: roleTitle,
      description,
      datePosted: '2026-07-20',
      employmentType,
      directApply: true,
      hiringOrganization: { '@id': ORGANIZATION_ID },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'New Cairo',
          addressRegion: 'Cairo',
          addressCountry: 'EG',
        },
      },
      url: canonical,
    };
  } else if (posixPath.startsWith('services/')) {
    page = {
      '@type': 'Service',
      '@id': `${canonical}#service`,
      name: serviceName,
      description: serviceDescription,
      url: canonical,
      provider: { '@id': ORGANIZATION_ID },
    };
  } else if (/^cases\/(?!index\.html)/.test(posixPath)) {
    page = {
      '@type': 'Article',
      '@id': `${canonical}#case-study`,
      headline: title.split('|')[0].trim(),
      description,
      image,
      url: canonical,
      author: { '@id': ORGANIZATION_ID },
      publisher: { '@id': ORGANIZATION_ID },
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
    };
  } else {
    let type = 'WebPage';
    if (posixPath === 'about-us.html') type = 'AboutPage';
    if (/^(blogs|cases|partners|careers)\/index\.html$/.test(posixPath)) type = posixPath === 'blogs/index.html' ? 'Blog' : 'CollectionPage';
    page = {
      '@type': type,
      '@id': `${canonical}#webpage`,
      name: title,
      description,
      url: canonical,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: image },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
      inLanguage: 'en',
    };
  }
  graph.push(page);
  if (posixPath === 'partners/nexthink.html') {
    graph.push({
      '@type': 'Service',
      '@id': `${canonical}#service`,
      name: 'Nexthink Digital Employee Experience',
      description,
      url: canonical,
      provider: { '@id': ORGANIZATION_ID },
      areaServed: ['Egypt', 'Saudi Arabia', 'North Africa'],
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function stripExistingSeo(head) {
  return head
    .replace(/\s*<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->\s*/gi, '\n')
    .replace(/\s*<meta\s+name="robots"[^>]*>\s*/gi, '\n')
    .replace(/\s*<link\s+rel="canonical"[^>]*>\s*/gi, '\n')
    .replace(/\s*<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\s*/gi, '\n')
    .replace(/\s*<meta\s+property="article:[^"]+"[^>]*>\s*/gi, '\n')
    .replace(/\s*<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, '\n');
}

function seoBlock(relativePath, title, description, canonical, image, schema, existing) {
  const isApplyPage = relativePath.replace(/\\/g, '/') === 'careers/apply.html';
  const type = relativePath.replace(/\\/g, '/').startsWith('blogs/') && !relativePath.endsWith('index.html') ? 'article' : 'website';
  const lines = [
    '<!-- SEO:START -->',
    `<meta name="robots" content="${isApplyPage ? 'noindex, follow' : 'index, follow, max-image-preview:large'}" />`,
    `<link rel="canonical" href="${escapeAttribute(canonical)}" />`,
    `<meta property="og:type" content="${type}" />`,
    '<meta property="og:site_name" content="Digital Hub S.A.E" />',
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    `<meta property="og:url" content="${escapeAttribute(canonical)}" />`,
    `<meta property="og:image" content="${escapeAttribute(image)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttribute(image)}" />`,
  ];
  if (type === 'article') {
    lines.push(`<meta property="article:publisher" content="${SITE_URL}/" />`);
    lines.push(`<meta property="article:section" content="${escapeAttribute(existing.section || 'Insights')}" />`);
    lines.push(`<meta property="article:published_time" content="${escapeAttribute(existing.published || '2026-06-15')}" />`);
    lines.push(`<meta property="article:modified_time" content="${escapeAttribute(existing.modified || existing.published || '2026-06-15')}" />`);
  }
  lines.push('<script type="application/ld+json">');
  lines.push(JSON.stringify(schema, null, 2).replace(/</g, '\\u003c'));
  lines.push('</script>');
  lines.push('<!-- SEO:END -->');
  return lines.join('\n');
}

function processPage(filePath) {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  // Blog articles are authored via CMS and written by scripts/blog-pages.js.
  if (/^blogs\/(?!index\.html$).+\.html$/i.test(relativePath)) return;
  let html = fs.readFileSync(filePath, 'utf8').replace(/ � /g, ' — ');
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  if (!headMatch) throw new Error(`Missing <head> in ${relativePath}`);
  let head = headMatch[1];
  const existing = {
    image: match(head, /<meta\s+property="og:image"\s+content="([^"]+)"/i),
    published: match(head, /<meta\s+property="article:published_time"\s+content="([^"]+)"/i),
    modified: match(head, /<meta\s+property="article:modified_time"\s+content="([^"]+)"/i),
    section: decodeHtml(match(head, /<meta\s+property="article:section"\s+content="([^"]+)"/i)),
  };
  const currentTitle = decodeHtml(textFrom(match(head, /<title>([\s\S]*?)<\/title>/i)));
  const currentDescription = decodeHtml(match(head, /<meta\s+name="description"\s+content="([^"]*)"/i));
  const pageOverride = overrides[relativePath] || {};
  const title = pageOverride.title || currentTitle;
  const description = pageOverride.description || currentDescription;
  if (!title || !description) throw new Error(`Missing title or description in ${relativePath}`);
  if (pageOverride.title) head = head.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttribute(title)}</title>`);
  if (pageOverride.description) head = head.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeAttribute(description)}" />`);
  head = stripExistingSeo(head);
  const canonical = canonicalFor(relativePath);
  const image = imageFor(relativePath, html, existing.image);
  const schema = schemaFor(relativePath, title, description, canonical, image, html, existing);
  const block = seoBlock(relativePath, title, description, canonical, image, schema, existing);
  const descriptionTag = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i;
  head = head.replace(descriptionTag, (tag) => `${tag}\n${block}`);
  html = html.replace(headMatch[0], `<head>${head}</head>`);
  fs.writeFileSync(filePath, html.replace(/\r?\n/g, '\n'), 'utf8');
}

const pages = walk(ROOT);
pages.forEach(processPage);
console.log(`SEO metadata built for ${pages.length} public pages.`);
