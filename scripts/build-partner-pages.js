#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY = path.join(ROOT, 'legacy');
const PARTNERS_DIR = path.join(LEGACY, 'partners');
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');

const INTRO = [
  'Digital Hub builds strategic partnerships with leading technology providers to deliver secure, scalable, and business-focused digital transformation solutions. Our partner ecosystem combines global technology platforms with Digital Hub\u2019s local delivery expertise, system integration capabilities, and strong understanding of government and enterprise environments.',
  'Through these partnerships, we help organizations modernize infrastructure, adopt cloud solutions, improve digital services, enhance workplace experience, automate operations, and build intelligent, data-driven platforms that support long-term growth.',
];

const PARTNERS = [
  {
    slug: 'microsoft',
    name: 'Microsoft',
    tag: 'Cloud & Productivity',
    tagOrange: false,
    icon: 'ti-brand-windows',
    logo: 'microsoft-logo.png',
    logoClass: 'partner-view-logo--ms',
    cardClass: 'partner-card-hub__logo--ms',
    heroTitle: 'Microsoft',
    lead: 'Enterprise cloud, productivity, data, AI, automation, and business application solutions for government and enterprise transformation.',
    paragraphs: [
      'Digital Hub collaborates with Microsoft to deliver enterprise cloud, productivity, data, AI, automation, and business application solutions.',
      'Through Microsoft Azure, Microsoft 365, Power Platform, Dynamics 365, and Microsoft AI services, we support organizations in building secure digital environments, automating workflows, improving collaboration, and enabling smarter decision-making.',
    ],
    capabilities: [
      'Cloud migration and application modernization',
      'Workflow automation and business process digitization',
      'Data analytics and AI adoption',
      'Dynamics 365 enablement',
      'Integration with existing enterprise systems',
    ],
    outcome:
      'This partnership enables Digital Hub to deliver practical Microsoft-based solutions that improve operational efficiency, reduce manual work, and accelerate digital transformation through a reliable and scalable technology foundation.',
    focusAreas: [
      { icon: 'ti-cloud', title: 'Cloud & Azure', desc: 'Secure Azure landing zones, cloud migration, and application modernization for enterprise and government workloads.' },
      { icon: 'ti-apps', title: 'Business Applications', desc: 'Dynamics 365 and Power Platform to digitize processes, automate workflows, and improve collaboration.' },
      { icon: 'ti-chart-dots', title: 'Data & AI', desc: 'Microsoft data services and AI adoption that turn information into smarter, faster decisions.' },
    ],
    homeSummary:
      'Azure, Microsoft 365, Power Platform, and Dynamics 365 for government and enterprise digital transformation across Egypt and the Gulf.',
    seoDescription:
      'Digital Hub partners with Microsoft to deliver Azure, Microsoft 365, Power Platform, Dynamics 365, and AI solutions for enterprise and government digital transformation.',
  },
  {
    slug: 'huawei',
    name: 'Huawei',
    tag: 'Cloud & Infrastructure',
    tagOrange: false,
    icon: 'ti-cloud',
    logo: 'huawei-logo.png',
    heroTitle: 'Huawei',
    lead: 'Advanced cloud, infrastructure, networking, storage, and AI-ready technology solutions for mission-critical environments.',
    paragraphs: [
      'Digital Hub collaborates with Huawei to deliver advanced cloud, infrastructure, networking, storage, and AI-ready technology solutions.',
      'Through Huawei\u2019s enterprise technology portfolio and cloud capabilities, we support organizations in building resilient, high-performance, and scalable digital environments. This collaboration is especially relevant for clients that require secure infrastructure, strong connectivity, reliable data center capabilities, and future-ready platforms for digital transformation.',
    ],
    capabilities: [
      'Cloud infrastructure enablement',
      'Enterprise infrastructure modernization',
      'Networking and storage solutions',
      'Hybrid cloud environments',
      'AI-ready platforms',
      'Secure deployment models for government and enterprise workloads',
    ],
    outcome:
      'This partnership strengthens Digital Hub\u2019s ability to deliver robust technology foundations that support mission-critical operations and future digital expansion.',
    focusAreas: [
      { icon: 'ti-server-2', title: 'Cloud Infrastructure', desc: 'Huawei Cloud enablement and hybrid environments built for performance, resilience, and scale.' },
      { icon: 'ti-network', title: 'Networking & Storage', desc: 'Enterprise networking and storage modernization for secure, mission-critical operations.' },
      { icon: 'ti-cpu', title: 'AI-Ready Platforms', desc: 'Future-ready foundations and secure deployment models for government and enterprise workloads.' },
    ],
    homeSummary:
      'Huawei Cloud and enterprise infrastructure for telcos, government, and large enterprises \u2014 secure, scalable platforms across Egypt and the Gulf.',
    seoDescription:
      'Digital Hub partners with Huawei to deliver cloud infrastructure, networking, storage, and AI-ready enterprise technology across Egypt and the GCC.',
  },
  {
    slug: 'nexthink',
    name: 'Nexthink',
    tag: 'Digital Employee Experience',
    tagOrange: true,
    icon: 'ti-device-desktop-analytics',
    logo: 'nexthink-logo.png',
    heroTitle: 'Nexthink',
    lead: 'Digital Employee Experience solutions that help organizations monitor, analyze, and improve the performance of the digital workplace.',
    paragraphs: [
      'Digital Hub partners with Nexthink to deliver Digital Employee Experience solutions that help organizations monitor, analyze, and improve the performance of the digital workplace.',
      'Nexthink provides visibility into endpoint performance, user experience, application behavior, and IT service quality. Through this partnership, Digital Hub helps clients shift from reactive technical support to proactive experience management, enabling IT teams to detect issues earlier, reduce downtime, and improve employee productivity.',
    ],
    capabilities: [
      'Solution deployment and environment configuration',
      'Endpoint monitoring and performance analysis',
      'Dashboards and reporting',
      'Technical support and continuous optimization',
    ],
    outcome:
      'This partnership enables organizations to improve IT operations, enhance employee satisfaction, and make better technology decisions based on real-time workplace insights.',
    focusAreas: [
      { icon: 'ti-rocket', title: 'DEX Deployment', desc: 'End-to-end Nexthink rollout, environment configuration, and endpoint monitoring at scale.' },
      { icon: 'ti-chart-bar', title: 'Experience Analytics', desc: 'Dashboards and reporting that translate endpoint telemetry into clear business insight.' },
      { icon: 'ti-shield-check', title: 'Proactive IT', desc: 'Shift from reactive technical support to proactive experience management and optimization.' },
    ],
    homeSummary:
      'Authorized Nexthink partner for banks, telcos, and enterprises \u2014 deploy the leading Digital Employee Experience platform at scale.',
    seoDescription:
      'Digital Hub is an authorized Nexthink partner delivering Digital Employee Experience monitoring, deployment, and optimization across Egypt and the GCC.',
  },
  {
    slug: 'efinance',
    name: 'eFinance',
    tag: 'Digital Payments & Fintech',
    tagOrange: false,
    icon: 'ti-credit-card',
    logo: 'efinance-logo.svg',
    heroTitle: 'eFinance',
    lead: 'Digital payments, financial technology, sovereign cloud, and transaction-based digital transformation for public and enterprise services.',
    paragraphs: [
      'Digital Hub collaborates with eFinance to support digital payments, financial technology, sovereign cloud, and transaction-based digital transformation initiatives.',
      'This collaboration focuses on enabling secure, integrated, and reliable digital services for organizations that require strong transaction processing, financial integration, digital collection, cloud hosting, and data-driven service delivery.',
    ],
    capabilities: [
      'Integration with digital payment channels',
      'Fintech enablement',
      'Transaction-based systems',
      'Sovereign cloud support',
    ],
    outcome:
      'Together, Digital Hub and eFinance support organizations in improving service accessibility, strengthening digital financial operations, and delivering more connected public and enterprise services.',
    focusAreas: [
      { icon: 'ti-credit-card', title: 'Digital Payments', desc: 'Integration with digital payment channels and reliable transaction-based systems.' },
      { icon: 'ti-building-bank', title: 'Fintech Enablement', desc: 'Secure, integrated fintech services, digital collection, and financial integration.' },
      { icon: 'ti-cloud-lock', title: 'Sovereign Cloud', desc: 'Sovereign cloud hosting and data-driven delivery for public and enterprise services.' },
    ],
    homeSummary:
      'Digital payments, fintech integration, and sovereign cloud capabilities for secure transaction-based government and enterprise services.',
    seoDescription:
      'Digital Hub partners with eFinance to deliver digital payments, fintech integration, sovereign cloud, and transaction-based digital transformation.',
  },
  {
    slug: 'vodafone',
    name: 'Vodafone',
    tag: 'Cloud & Connectivity',
    tagOrange: false,
    icon: 'ti-antenna-bars-5',
    logo: 'vodafone-logo.svg',
    heroTitle: 'Vodafone',
    lead: 'Cloud solutions and enterprise connectivity for organizations that require reliable, secure, and scalable digital infrastructure.',
    paragraphs: [
      'Digital Hub partners with Vodafone to deliver cloud solutions and enterprise connectivity for organizations that require reliable, secure, and scalable digital infrastructure.',
      'Through this collaboration, Digital Hub supports clients with cloud enablement, connectivity planning, business continuity, and digital communication requirements. Vodafone\u2019s cloud and connectivity capabilities complement Digital Hub\u2019s expertise in software development, system integration, migration planning, application modernization, and managed support.',
    ],
    capabilities: [
      'Cloud enablement and migration planning',
      'Connectivity planning and business continuity',
      'Application modernization with connected infrastructure',
      'Managed support for cloud-ready environments',
    ],
    outcome:
      'This partnership helps Digital Hub deliver cloud-ready and connected digital environments that support modern enterprise operations and future business growth.',
    focusAreas: [
      { icon: 'ti-cloud-up', title: 'Cloud Enablement', desc: 'Cloud migration planning and connected infrastructure for scalable digital operations.' },
      { icon: 'ti-antenna-bars-5', title: 'Enterprise Connectivity', desc: 'Reliable connectivity planning and business continuity for modern enterprise operations.' },
      { icon: 'ti-headset', title: 'Managed Support', desc: 'Application modernization and managed support for secure, cloud-ready environments.' },
    ],
    homeSummary:
      'Vodafone cloud and enterprise connectivity combined with Digital Hub integration expertise for scalable, connected digital operations.',
    seoDescription:
      'Digital Hub partners with Vodafone to deliver cloud solutions, enterprise connectivity, and integrated digital infrastructure across Egypt and the GCC.',
  },
];

const WAVES = `<div class="site-waves">
    <div class="wave wave-1"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1600,300 1800,200 C2000,100 2200,300 2400,200" fill="none" stroke="#1A9AD6" stroke-opacity="0.16" stroke-width="1.5"/></svg></div>
    <div class="wave wave-2"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,320 C300,260 500,380 800,320 C1100,260 1300,380 1600,320 C1900,260 2100,380 2400,320" fill="none" stroke="#1A9AD6" stroke-opacity="0.12" stroke-width="1.25"/></svg></div>
    <div class="wave wave-3"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,420 C240,300 480,560 720,420 C960,280 1200,560 1440,420 C1680,280 1920,560 2160,420 C2280,360 2340,400 2400,420" fill="none" stroke="#36B0E5" stroke-opacity="0.10" stroke-width="1.25"/></svg></div>
    <div class="wave wave-4"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,540 C300,480 500,600 800,540 C1100,480 1300,600 1600,540 C1900,480 2100,600 2400,540" fill="none" stroke="#F4970B" stroke-opacity="0.12" stroke-width="1.25"/></svg></div>
  </div>`;

function esc(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function partnerNav(prefix, active) {
  const items = PARTNERS.map((p) => {
    const cls = active === p.slug ? ' class="is-active"' : '';
    const current = active === p.slug ? ' aria-current="page"' : '';
    return `<a href="${prefix}${p.slug}.html"${cls}${current}><i class="ti ${p.icon}"></i> ${p.name}</a>`;
  }).join('\n          ');
  return items;
}

function partnerMobileNav(prefix, active) {
  return PARTNERS.map((p) => {
    const cls = active === p.slug ? ' class="is-active"' : '';
    return `<a href="${prefix}${p.slug}.html"${cls}>${p.name}</a>`;
  }).join('\n      ');
}

function shell({ depth, activeNav, bodyClass, title, description, canonical, content, jsonLd }) {
  const up = depth === 0 ? '' : '../'.repeat(depth);
  const partnersPrefix = depth <= 1 ? (depth === 0 ? 'partners/' : '') : '../partners/';
  const partnersIndex = depth === 1 ? 'index.html' : `${up}partners/index.html`;
  const partnersActive = activeNav === 'partners' ? ' is-active' : '';
  const partnersCurrent = activeNav === 'partners' ? ' aria-current="page"' : '';

  return `<!doctype html>
<html lang="en" class="nav-shown">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Digital Hub S.A.E" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="https://www.digitalhub.com.eg/assets/digital-hub-logo.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="https://www.digitalhub.com.eg/assets/digital-hub-logo.png" />
${jsonLd ? `<script type="application/ld+json">\n${jsonLd}\n</script>\n` : ''}<meta name="theme-color" content="#0A1628" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css" />
<link rel="stylesheet" href="${up}css/service-page.css" />
<link rel="stylesheet" href="${up}css/hub-pages.css" />
<link rel="stylesheet" href="${up}css/tv.css" />
<link rel="stylesheet" href="${up}css/responsive.css" />
</head>
<body class="${bodyClass}">

<div class="site-bg" aria-hidden="true">
  <div class="site-grid"></div>
  ${WAVES}
</div>

<nav class="nav" id="nav" aria-label="Primary">
  <div class="nav-inner glass-surface">
    <a href="${up}index.html" class="brand" aria-label="Digital Hub home">
      <img class="brand-logo" src="${up}assets/digital-hub-logo.png" alt="Digital Hub" decoding="async">
    </a>
    <ul class="nav-links" role="menubar">
      <li class="has-dd" role="none">
        <a class="nav-link" role="menuitem" tabindex="0">Services <i class="ti ti-chevron-down"></i></a>
        <div class="dd" role="menu">
          <a href="${up}services/enterprise-software.html"><i class="ti ti-code"></i> Enterprise Software Solutions</a>
          <a href="${up}services/data-analytics.html"><i class="ti ti-chart-bar"></i> Data &amp; Analytics Solutions</a>
          <a href="${up}services/ai-automation.html"><i class="ti ti-brain"></i> AI &amp; Intelligent Automation</a>
          <a href="${up}services/outsourcing.html"><i class="ti ti-users"></i> Outsourcing Technical Talents</a>
        </div>
      </li>
      <li class="has-dd" role="none">
        <a class="nav-link${partnersActive}" role="menuitem" tabindex="0"${partnersCurrent}>Partners <i class="ti ti-chevron-down"></i></a>
        <div class="dd" role="menu">
          ${partnerNav(partnersPrefix, activeNav && activeNav !== 'partners' ? activeNav : null)}
        </div>
      </li>
      <li><a class="nav-link" href="${up}cases/index.html">Case Studies</a></li>
      <li><a class="nav-link" href="${up}blogs/index.html">Blogs</a></li>
      <li><a class="nav-link" href="${up}about-us.html">About Us</a></li>
      <li><a class="nav-link" href="${up}careers/index.html">Careers</a></li>
    </ul>
    <a class="nav-cta" href="${up}index.html#contact">Get in touch <i class="ti ti-arrow-right"></i></a>
    <button class="nav-burger" id="navBurger" aria-label="Open menu" aria-expanded="false"><i class="ti ti-menu-2"></i></button>
  </div>
</nav>

<div class="mobile-nav" id="mobileNav" aria-hidden="true">
  <details>
    <summary>Services <i class="ti ti-chevron-down"></i></summary>
    <div class="sub">
      <a href="${up}services/enterprise-software.html">Enterprise Software Solutions</a>
      <a href="${up}services/data-analytics.html">Data &amp; Analytics Solutions</a>
      <a href="${up}services/ai-automation.html">AI &amp; Intelligent Automation</a>
      <a href="${up}services/outsourcing.html">Outsourcing Technical Talents</a>
    </div>
  </details>
  <details${activeNav ? ' open' : ''}>
    <summary>Partners <i class="ti ti-chevron-down"></i></summary>
    <div class="sub">
      <a href="${partnersIndex}"${activeNav === 'partners' ? ' class="is-active"' : ''}>All partners</a>
      ${partnerMobileNav(partnersPrefix, activeNav && activeNav !== 'partners' ? activeNav : null)}
    </div>
  </details>
  <a href="${up}cases/index.html">Case Studies</a>
  <a href="${up}blogs/index.html">Blogs</a>
  <a href="${up}about-us.html">About Us</a>
  <a href="${up}careers/index.html">Careers</a>
  <a class="mn-cta" href="${up}index.html#contact">Get in Touch</a>
</div>

<main>
${content}
</main>

<footer class="footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <img class="footer-logo" src="${up}assets/digital-hub-logo.png" alt="Digital Hub">
        <p class="footer-tagline">Empowering Digital Evolution &mdash; Egypt &amp; GCC</p>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <h4>Services</h4>
          <a href="${up}services/enterprise-software.html">Enterprise Software</a>
          <a href="${up}services/data-analytics.html">Data &amp; Analytics</a>
          <a href="${up}services/ai-automation.html">AI &amp; Automation</a>
          <a href="${up}services/outsourcing.html">Outsourcing</a>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <a href="${up}about-us.html">About Us</a>
          <a href="${up}cases/index.html">Case Studies</a>
          <a href="${up}blogs/index.html">Blogs</a>
          <a href="${partnersIndex}">Partners</a>
          <a href="${up}index.html#contact">Contact</a>
        </div>
      </div>
      <div class="footer-contact">
        <h4>Contact</h4>
        <a href="mailto:sales@digitalhubgroup.com">sales@digitalhubgroup.com</a>
        <a href="tel:+201555553064">+20 155 555 3064</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2024 Digital Hub S.A.E. All rights reserved.</span>
      <span>Microsoft Partner &middot; Nexthink Authorized Reseller &middot; Huawei &middot; eFinance &middot; Vodafone</span>
    </div>
  </div>
</footer>

<script src="${up}js/shared.js"></script>
<script src="${up}js/nav-stay-on-page.js"></script>
<script src="${up}js/hub-pages.js"></script>
</body>
</html>`;
}

function partnerCard(partner, prefix = '') {
  const logoClass = partner.cardClass ? ` ${partner.cardClass}` : '';
  return `<a class="partner-card-hub" href="${prefix}${partner.slug}.html" data-reveal aria-label="Explore ${partner.name} partnership">
          <div class="partner-card-hub__logo${logoClass}">
            <img src="../assets/${partner.logo}" alt="${partner.name}" loading="lazy" decoding="async">
          </div>
          <h3 class="partner-card-hub__title">${partner.name}</h3>
          <p class="partner-card-hub__desc">${partner.homeSummary}</p>
          <span class="partner-card-hub__link">Explore partnership <i class="ti ti-arrow-right"></i></span>
        </a>`;
}

function buildIndexPage() {
  const cards = PARTNERS.map((p) => partnerCard(p)).join('\n        ');
  const content = `
  <section class="hub-hero" data-section-reveal>
    <div class="hub-hero__inner">
      <div class="hub-banner" data-reveal>
        <span class="label">Strategic Partners</span>
        <h1>Technology partnerships that <em>power delivery</em></h1>
        <p class="lead">${INTRO[0]}</p>
      </div>
    </div>
  </section>

  <section class="section hub-section hub-section--tight" data-section-reveal>
    <div class="section-inner">
      <div class="hub-head" data-reveal>
        <div>
          <span class="label">Our ecosystem</span>
          <h2>Five strategic technology partners.</h2>
          <p>${INTRO[1]}</p>
        </div>
      </div>
      <div class="partners-hub-grid">
        ${cards}
      </div>
    </div>
  </section>

  <section class="section hub-cta" data-section-reveal>
    <div class="section-inner">
      <div class="hub-cta__card" data-reveal>
        <h2>Need a partner-led solution?</h2>
        <p>Tell us your platform, infrastructure, or workplace experience goals and we will map the right partner stack and delivery model.</p>
        <a class="btn-pill" href="../index.html#contact">Talk to our team <i class="ti ti-arrow-right"></i></a>
      </div>
    </div>
  </section>`;

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Digital Hub Strategic Partners',
      description: INTRO[0],
      url: 'https://www.digitalhub.com.eg/partners/',
      publisher: { '@type': 'Organization', name: 'Digital Hub S.A.E' },
    },
    null,
    2
  );

  return shell({
    depth: 1,
    activeNav: 'partners',
    bodyClass: 'page-hub page-partners',
    title: 'Strategic Partners | Digital Hub S.A.E',
    description: INTRO[0],
    canonical: 'https://www.digitalhub.com.eg/partners/',
    content,
    jsonLd,
  });
}

function buildPartnerPage(partner) {
  const others = PARTNERS.filter((p) => p.slug !== partner.slug);
  const related = others
    .slice(0, 3)
    .map((p) => partnerCard(p))
    .join('\n        ');

  const tagClass = partner.tagOrange ? ' partner-view-tag--orange' : '';
  const logoClass = partner.logoClass ? ` ${partner.logoClass}` : '';
  const lede = partner.paragraphs[0] || '';
  const bodyCopy = partner.paragraphs
    .slice(1)
    .map((p) => `<p class="partner-overview__body">${p}</p>`)
    .join('\n        ');
  const capabilities = partner.capabilities
    .map((c) => `<li>${c}</li>`)
    .join('\n            ');
  const focusCards = (partner.focusAreas || [])
    .map(
      (f) => `<article class="partner-focus-card" data-reveal>
          <span class="partner-focus-card__icon"><i class="ti ${f.icon}"></i></span>
          <h3 class="partner-focus-card__title">${f.title}</h3>
          <p class="partner-focus-card__desc">${f.desc}</p>
        </article>`
    )
    .join('\n        ');

  const content = `
  <section class="partner-view-hero" data-section-reveal>
    <div class="section-inner partner-view-hero__grid">
      <div data-reveal>
        <a class="partner-view-back" href="index.html"><i class="ti ti-arrow-left"></i> Back to partners</a>
        <div class="partner-view-kicker">
          <span class="partner-view-tag${tagClass}">${partner.tag}</span>
        </div>
        <h1 class="partner-view-title">${partner.heroTitle}</h1>
        <p class="partner-view-lead">${partner.lead}</p>
      </div>
      <div class="partner-view-logo${logoClass}" data-reveal>
        <img src="../assets/${partner.logo}" alt="${partner.name}" loading="eager" decoding="async">
      </div>
    </div>
  </section>

  <section class="partner-view-body" data-section-reveal>
    <div class="section-inner">
      <article class="partner-overview is-blurred" data-reveal>
        <div class="partner-overview__rail" aria-hidden="true">
          <span class="partner-overview__index">01</span>
          <span class="partner-overview__rail-line"></span>
        </div>
        <div class="partner-overview__main">
          <header class="partner-overview__header">
            <span class="label">Partnership overview</span>
            <p class="partner-overview__lede">${lede}</p>
          </header>
          ${bodyCopy}
          <p class="partner-overview__body partner-overview__body--closing">${partner.outcome}</p>
          <div class="partner-overview__capabilities">
            <div class="partner-overview__capabilities-head">
              <span class="partner-overview__capabilities-label">Deliverables</span>
              <h2 class="partner-overview__subtitle">What we deliver with ${partner.name}</h2>
            </div>
            <ul class="partner-overview__chips">
              ${capabilities}
            </ul>
            <a class="partner-overview__cta" href="../index.html#contact">Start a conversation <i class="ti ti-arrow-right"></i></a>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section class="section partner-focus" data-section-reveal>
    <div class="section-inner">
      <div class="hub-head" data-reveal>
        <div>
          <span class="label">What we deliver together</span>
          <h2>Focus areas with ${partner.name}.</h2>
        </div>
      </div>
      <div class="partner-focus-grid">
        ${focusCards}
      </div>
    </div>
  </section>

  <section class="section partner-view-related" data-section-reveal>
    <div class="section-inner">
      <div class="hub-head" data-reveal>
        <div>
          <span class="label">More partners</span>
          <h2>Explore the full ecosystem.</h2>
        </div>
      </div>
      <div class="partners-hub-grid">
        ${related}
      </div>
    </div>
  </section>

  <section class="section hub-cta" data-section-reveal>
    <div class="section-inner">
      <div class="hub-cta__card" data-reveal>
        <h2>Discuss a ${partner.name} solution</h2>
        <p>Share your environment, goals, and timeline. We will recommend the right partner-led approach and delivery plan.</p>
        <a class="btn-pill" href="../index.html#contact">Get in touch <i class="ti ti-arrow-right"></i></a>
      </div>
    </div>
  </section>`;

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${partner.name} Partnership | Digital Hub`,
      description: partner.seoDescription,
      url: `https://www.digitalhub.com.eg/partners/${partner.slug}.html`,
      publisher: { '@type': 'Organization', name: 'Digital Hub S.A.E' },
    },
    null,
    2
  );

  return shell({
    depth: 1,
    activeNav: partner.slug,
    bodyClass: 'page-hub page-partner-view',
    title: `${partner.name} Partnership | Digital Hub S.A.E`,
    description: partner.seoDescription,
    canonical: `https://www.digitalhub.com.eg/partners/${partner.slug}.html`,
    content,
    jsonLd,
  });
}

function updateNavInFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(LEGACY, path.dirname(filePath));
  const depth = rel === '' ? 0 : rel.split(path.sep).length;
  const up = depth === 0 ? '' : '../'.repeat(depth);
  const partnersPrefix = `${up}partners/`;
  const partnersIndex = `${up}partners/index.html`;

  const desktopNav = `<div class="dd" role="menu">\n          ${partnerNav(partnersPrefix)}\n        </div>`;
  const mobileNav = `<div class="sub">\n      <a href="${partnersIndex}">All partners</a>\n      ${partnerMobileNav(partnersPrefix)}\n    </div>`;

  const desktopRe = /<div class="dd" role="menu">\s*<a href="[^"]*#partners"[^>]*>[\s\S]*?<\/div>/g;
  const mobileRe = /<summary>Partners[\s\S]*?<div class="sub">[\s\S]*?<\/div>/g;

  if (!desktopRe.test(html)) return false;
  html = html.replace(desktopRe, desktopNav);
  html = html.replace(mobileRe, (match) => {
    if (!match.includes('Partners')) return match;
    return match.replace(/<div class="sub">[\s\S]*?<\/div>/, mobileNav);
  });

  html = html.replace(
    /Microsoft Partner &middot; Nexthink Authorized Reseller &middot; AWS Partner/g,
    'Microsoft Partner &middot; Nexthink Authorized Reseller &middot; Huawei &middot; eFinance &middot; Vodafone'
  );

  html = html.replace(
    new RegExp(`<a href="${up === '' ? '' : up.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}index\\.html#partners">Partners</a>`, 'g'),
    `<a href="${partnersIndex}">Partners</a>`
  );

  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

function walkHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, files);
    else if (entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function copyAssets() {
  for (const name of ['efinance-logo.svg', 'vodafone-logo.svg', 'microsoft-logo.png', 'huawei-logo.png', 'nexthink-logo.png']) {
    const src = path.join(LEGACY, 'assets', name);
    const dest = path.join(PUBLIC_ASSETS, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}

function main() {
  fs.mkdirSync(PARTNERS_DIR, { recursive: true });

  fs.writeFileSync(path.join(PARTNERS_DIR, 'index.html'), buildIndexPage(), 'utf8');
  for (const partner of PARTNERS) {
    fs.writeFileSync(path.join(PARTNERS_DIR, `${partner.slug}.html`), buildPartnerPage(partner), 'utf8');
  }

  const htmlFiles = walkHtml(LEGACY).filter((f) => !f.startsWith(PARTNERS_DIR));
  let updated = 0;
  for (const file of htmlFiles) {
    if (updateNavInFile(file)) updated += 1;
  }

  copyAssets();

  console.log(`Generated ${PARTNERS.length + 1} partner pages in legacy/partners/`);
  console.log(`Updated navigation in ${updated} legacy HTML files`);
}

main();
