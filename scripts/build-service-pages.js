const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../services/enterprise-software.html');
const template = fs.readFileSync(templatePath, 'utf8');

function navActive(html, slug) {
  const links = [
    ['enterprise-software.html', 'Enterprise Software Solutions'],
    ['data-analytics.html', 'Data &amp; Analytics Solutions'],
    ['ai-automation.html', 'AI &amp; Intelligent Automation'],
    ['outsourcing.html', 'Outsourcing Technical Talents'],
  ];
  let out = html;
  links.forEach(([file]) => {
    out = out.replace(
      new RegExp(`<a href="${file}" class="is-active"`, 'g'),
      `<a href="${file}"`
    );
  });
  out = out.replace(
    `<a href="${slug}"`,
    `<a href="${slug}" class="is-active"`
  );
  return out;
}

const pages = [
  {
    slug: 'data-analytics.html',
    title: 'Data &amp; Analytics Solutions | Digital Hub S.A.E',
    description: 'We transform fragmented data into governed, trusted, and actionable intelligence that drives faster and smarter decisions for Egypt and GCC enterprises.',
    heroEyebrow: 'Data &amp; Analytics',
    heroH1: 'Turn fragmented data into governed intelligence',
    heroSub: 'Whether you&rsquo;re unifying enterprise sources or building executive dashboards, Digital Hub is the data partner trusted by ministries, banks, and enterprises across Egypt and the GCC.',
    heroCta: 'Discuss your data program',
    heroChecks: [
      'Data strategy, warehousing, and modern lakehouse platforms',
      'Governed pipelines with quality, MDM, and security built in',
      'BI dashboards and open data portals stakeholders actually use',
    ],
    heroBadge: 'Data Intelligence',
    heroFrameTitle: 'Trusted data for decisions that can&rsquo;t wait',
    heroFrameMeta: 'Data strategy, engineering, governance, and executive reporting &mdash; designed for regulated sectors and national-scale programs.',
    heroStats: ['8', '30+', '5+'],
    heroStatLabels: ['Capabilities', 'Clients', 'Years'],
    problemH2: 'Your data was never designed to work together.',
    problemP: 'Most Egyptian and Gulf enterprises are running on fragmented sources, manual spreadsheets, and disconnected systems. Insights stall before they reach the <a href="#services" class="accent">executive dashboards and AI models that need them</a>.',
    pipelineLabel: 'Data Flow Audit',
    nodes: ['Source Systems', 'Legacy DW', 'Spreadsheets', 'Analytics / AI'],
    nodeIcons: ['ti-database-import', 'ti-server-2', 'ti-table', 'ti-chart-bar'],
    cards: [
      ['ti-unlink', 'Siloed data sources', 'Critical data lives in disconnected systems &mdash; every report becomes a manual reconciliation exercise.'],
      ['ti-shield-off', 'No governance or trust', 'Without quality frameworks and ownership, teams don&rsquo;t trust the numbers they see in dashboards.'],
      ['ti-clock-exclamation', 'Insights arrive too late', 'Batch exports and email chains mean leadership decides on yesterday&rsquo;s data, not today&rsquo;s reality.'],
    ],
    problemBottom1: 'The result is organizations that invest in data tools but still can&rsquo;t answer basic questions with confidence.',
    problemBottom2: 'We fix this by building governed data platforms designed around how decisions are actually made &mdash; not retrofitted after the fact.',
    quoteCite: 'Digital Hub &middot; Data &amp; Analytics Team',
    eswdLine2: 'Data &amp; Analytics Solutions',
    eswdIntro: 'We transform fragmented data into governed, trusted, and actionable intelligence across the full data lifecycle.',
    scenes: [
      {
        label: 'Data strategy &amp; assessment',
        menuTitle: 'Data strategy &amp; assessment',
        desc: 'A clear data roadmap that aligns business objectives, maturity, governance needs, and future analytics capabilities.',
        items: ['Data maturity assessment', 'Source &amp; governance mapping', 'Prioritized analytics roadmap'],
        icons: ['ti-compass', 'ti-map', 'ti-list-check'],
      },
      {
        label: 'Enterprise data warehousing',
        menuTitle: 'Enterprise data warehousing',
        desc: 'Centralized warehouses that unify multiple sources into a reliable foundation for reporting and decision-making.',
        items: ['Multi-source warehouse design', 'Azure &amp; cloud-native platforms', 'Executive reporting foundations'],
        icons: ['ti-database', 'ti-cloud', 'ti-chart-dots'],
      },
      {
        label: 'Data engineering &amp; pipelines',
        menuTitle: 'Data engineering &amp; pipelines',
        desc: 'Automated ETL/ELT pipelines that collect, cleanse, transform, and deliver reliable data across enterprise systems.',
        items: ['ETL/ELT pipeline development', 'Lakehouse &amp; modern platforms', 'Real-time ingestion patterns'],
        icons: ['ti-git-merge', 'ti-layers-linked', 'ti-bolt'],
      },
      {
        label: 'BI, portals &amp; DataOps',
        menuTitle: 'BI, portals &amp; DataOps',
        desc: 'Dashboards, open data portals, and operational discipline that keep data platforms reliable and continuously improving.',
        items: ['Executive BI dashboards', 'Open data &amp; citizen portals', 'DataOps monitoring &amp; support'],
        icons: ['ti-chart-bar', 'ti-world', 'ti-settings-automation'],
      },
    ],
    methodIntro: 'From data strategy through governed platforms &mdash; a delivery model that turns fragmented sources into trusted intelligence.',
    methodSteps: [
      ['Assess &amp; roadmap', 'Evaluate data maturity, sources, governance gaps, and analytics goals. Define a prioritized roadmap aligned to business objectives.', 'ti-compass'],
      ['Architect &amp; govern', 'Design warehouse, lakehouse, or hybrid platforms with quality frameworks, MDM, and security controls built in from day one.', 'ti-ruler-2'],
      ['Engineer &amp; integrate', 'Build ETL/ELT pipelines, unify enterprise sources, and deploy dashboards and portals stakeholders can trust daily.', 'ti-code'],
      ['Operate &amp; improve', 'Apply DataOps discipline &mdash; monitored pipelines, controlled changes, and continuous refinement of data quality and insights.', 'ti-rocket'],
    ],
    cases: [
      {
        href: '../cases/ministry-planning.html',
        meta: 'Government &middot; B2G &mdash; Ministry of Planning &amp; Economic Development',
        title: 'National Planning Data Warehouse &amp; Dashboards',
        metric: '3+ years of continuous digital partnership',
        body: 'Data warehouse, cybersecurity, advanced dashboards, and platform support for Egypt&rsquo;s Ministry of Planning &amp; Economic Development.',
        chips: ['Data &amp; Analytics', 'Data Warehousing', 'Executive Dashboards', 'Azure'],
      },
      {
        href: '../cases/data-center-transformation.html',
        meta: 'Banking &middot; Enterprise DX &mdash; Credit Guarantee Corporation &middot; Central Bank of Egypt',
        title: 'Unified Information Infrastructure for Banking',
        metric: 'End-to-end data center and infrastructure transformation',
        body: 'Complete data center and enterprise information infrastructure for one of Egypt&rsquo;s most critical financial institutions under CBE oversight.',
        chips: ['Data &amp; Analytics', 'Infrastructure', 'Enterprise Integration'],
      },
    ],
    ctaText: 'Tell us about your data sources and goals. Our data &amp; analytics team responds within one business day with a concrete next step &mdash; not a brochure.',
    ctaBtn: 'Discuss your data program',
    formLabel: 'Describe your data challenge',
    formPlaceholder: 'Describe your data challenge',
  },
  {
    slug: 'ai-automation.html',
    title: 'AI &amp; Intelligent Automation | Digital Hub S.A.E',
    description: 'Secure, business-ready AI solutions that automate work, unlock knowledge, and elevate decision-making at scale for Egypt and GCC organizations.',
    heroEyebrow: 'AI &amp; Intelligent Automation',
    heroH1: 'Deploy business-ready AI at enterprise scale',
    heroSub: 'Whether you&rsquo;re automating document-heavy workflows or deploying governed AI assistants, Digital Hub helps Egyptian and Gulf organizations move from pilots to production safely.',
    heroCta: 'Discuss an AI use case',
    heroChecks: [
      'Generative AI assistants grounded in trusted enterprise knowledge',
      'Intelligent document processing and agentic workflows',
      'Responsible AI governance, security, and cloud integration',
    ],
    heroBadge: 'Intelligent Automation',
    heroFrameTitle: 'AI that works inside your policies and systems',
    heroFrameMeta: 'Strategy, assistants, document intelligence, and agentic automation &mdash; deployed with governance suited to regulated enterprises.',
    heroStats: ['8', '500+', '5+'],
    heroStatLabels: ['Capabilities', 'Endpoints monitored', 'Years'],
    problemH2: 'Manual work and siloed knowledge are limiting scale.',
    problemP: 'Most organizations have the data and the ambition for AI &mdash; but workflows still depend on manual steps, documents trapped in inboxes, and knowledge scattered across systems that <a href="#services" class="accent">AI can&rsquo;t safely reach</a>.',
    pipelineLabel: 'Automation Audit',
    nodes: ['Documents', 'Manual Steps', 'Siloed Knowledge', 'AI Platform'],
    nodeIcons: ['ti-file-text', 'ti-click', 'ti-books', 'ti-brain'],
    cards: [
      ['ti-clock', 'Manual, repetitive work', 'High-value teams spend hours on tasks that should be automated &mdash; slowing service delivery and scale.'],
      ['ti-lock', 'Knowledge locked in silos', 'Policies, records, and expertise sit in disconnected systems assistants can&rsquo;t access with confidence.'],
      ['ti-alert-triangle', 'No AI governance', 'Without controls, AI pilots stall at compliance review instead of reaching production safely.'],
    ],
    problemBottom1: 'The result is organizations experimenting with AI while operations still run on manual workarounds.',
    problemBottom2: 'We fix this by deploying governed AI solutions integrated with how your teams actually work &mdash; not isolated chatbot demos.',
    quoteCite: 'Digital Hub &middot; AI &amp; Automation Team',
    eswdLine2: 'AI &amp; Intelligent Automation',
    eswdIntro: 'We deploy secure, business-ready AI solutions that automate work, unlock knowledge, and elevate decision-making at scale.',
    scenes: [
      {
        label: 'AI strategy &amp; readiness',
        menuTitle: 'AI strategy &amp; readiness',
        desc: 'A practical adoption roadmap that identifies high-value use cases, data foundations, risks, and implementation priorities.',
        items: ['Use-case prioritization', 'Data &amp; risk assessment', 'Responsible AI roadmap'],
        icons: ['ti-compass', 'ti-scan', 'ti-route'],
      },
      {
        label: 'Generative AI assistants',
        menuTitle: 'Generative AI assistants',
        desc: 'Conversational assistants that provide instant, accurate, multilingual access to services, systems, and enterprise knowledge.',
        items: ['Enterprise chatbots &amp; copilots', 'Multilingual service assistants', 'Secure user experiences'],
        icons: ['ti-message-chatbot', 'ti-language', 'ti-shield-check'],
      },
      {
        label: 'Document intelligence',
        menuTitle: 'Document intelligence',
        desc: 'AI-powered extraction, classification, validation, and processing of documents, forms, certificates, invoices, and records.',
        items: ['Intelligent document processing', 'Form &amp; certificate extraction', 'Validation workflows'],
        icons: ['ti-file-search', 'ti-forms', 'ti-checkbox'],
      },
      {
        label: 'Agents &amp; governance',
        menuTitle: 'Agents &amp; governance',
        desc: 'Autonomous workflows and control frameworks that ensure AI solutions are secure, auditable, compliant, and scalable.',
        items: ['AI agents &amp; agentic workflows', 'RAG knowledge assistants', 'Responsible AI governance'],
        icons: ['ti-robot', 'ti-books', 'ti-gavel'],
      },
    ],
    methodIntro: 'A governed path from use-case identification to production AI &mdash; secure, auditable, and aligned with enterprise policy.',
    methodSteps: [
      ['Assess &amp; prioritize', 'Identify high-value use cases, data readiness, risks, and governance requirements. Build a practical adoption roadmap.', 'ti-compass'],
      ['Design &amp; govern', 'Architect solutions with responsible AI controls &mdash; RAG grounding, access policies, audit trails, and compliance alignment.', 'ti-ruler-2'],
      ['Build &amp; automate', 'Develop assistants, agents, and document processing workflows integrated with cloud AI and existing systems.', 'ti-code'],
      ['Deploy &amp; scale', 'Production rollout with monitoring, feedback loops, and continuous optimization as adoption grows.', 'ti-rocket'],
    ],
    cases: [
      {
        href: '../cases/nexthink-dex-bank.html',
        meta: 'Banking &middot; DEX &mdash; Major Egyptian Bank',
        title: 'Real-Time DEX Monitoring Across 500+ Endpoints',
        metric: 'Live visibility into endpoint health and employee experience',
        body: 'Deployed Nexthink DEX across the full IT environment &mdash; intelligent monitoring and operational visibility at enterprise scale.',
        chips: ['AI &amp; Automation', 'Intelligent Operations', 'Nexthink DEX'],
      },
      {
        href: '../cases/ministry-planning.html',
        meta: 'Government &middot; B2G &mdash; Ministry of Planning &amp; Economic Development',
        title: 'Advanced Dashboards for Government Planning Systems',
        metric: '3+ years of platform support and analytics delivery',
        body: 'Advanced dashboards and platform support powering Egypt&rsquo;s national planning systems with continuous operational intelligence.',
        chips: ['AI &amp; Automation', 'Executive Dashboards', 'Platform Support'],
      },
    ],
    ctaText: 'Describe your AI use case. Our intelligent automation team responds within one business day with a concrete next step &mdash; not a brochure.',
    ctaBtn: 'Discuss an AI use case',
    formLabel: 'Describe your AI or automation challenge',
    formPlaceholder: 'Describe your AI or automation challenge',
  },
  {
    slug: 'outsourcing.html',
    title: 'Outsourcing Technical Talents | Digital Hub S.A.E',
    description: 'Screened, deployment-ready technical professionals — data engineers, software developers, AI specialists, and QA engineers — available as a seamless extension of your team.',
    heroEyebrow: 'Outsourcing Technical Talents',
    heroH1: 'Scale delivery with vetted technical professionals',
    heroSub: 'When delivery timelines outpace hiring cycles, Digital Hub provides screened, deployment-ready talent &mdash; data engineers, developers, AI specialists, and QA engineers embedded as an extension of your team.',
    heroCta: 'Tell us what roles you need',
    heroChecks: [
      'Data engineers, developers, AI specialists, and QA engineers',
      'Screened for enterprise stacks and regulated-sector delivery',
      'Flexible engagement models across Egypt and GCC time zones',
    ],
    heroBadge: 'Technical Talent',
    heroFrameTitle: 'Your delivery team, extended — without the hiring friction',
    heroFrameMeta: 'Long-term technical partnerships across data, software, AI, and quality assurance &mdash; integrated into your tools, rituals, and security policies.',
    heroStats: ['4', '30+', '5+'],
    heroStatLabels: ['Disciplines', 'Clients', 'Years'],
    problemH2: 'Delivery demand is outpacing your ability to hire.',
    problemP: 'Most enterprises face the same bottleneck: projects are approved, backlogs grow, but hiring cycles take months. Critical roles stay open while delivery pressure <a href="#services" class="accent">never slows down</a>.',
    pipelineLabel: 'Staffing Audit',
    nodes: ['Open Roles', 'Hiring Cycle', 'Backlog Growth', 'Delivery Target'],
    nodeIcons: ['ti-user-search', 'ti-hourglass', 'ti-list-details', 'ti-target'],
    cards: [
      ['ti-clock-pause', 'Slow hiring cycles', 'Critical roles stay open for months while project timelines and stakeholder expectations keep moving.'],
      ['ti-user-exclamation', 'Hard-to-find skill sets', 'Data, AI, and enterprise integration talent is scarce &mdash; especially with sector and language requirements.'],
      ['ti-arrows-random', 'Inconsistent delivery capacity', 'Teams scale up and down reactively instead of maintaining steady velocity across programs.'],
    ],
    problemBottom1: 'The result is organizations where approved initiatives wait for people instead of moving forward with momentum.',
    problemBottom2: 'We fix this by embedding vetted technical professionals who integrate with your delivery model from week one.',
    quoteCite: 'Digital Hub &middot; Technical Talent Team',
    eswdLine2: 'Outsourcing Technical Talents',
    eswdIntro: 'Screened, deployment-ready technical professionals available as a seamless extension of your team across data, development, AI, and QA.',
    scenes: [
      {
        label: 'Data engineers',
        menuTitle: 'Data engineers',
        desc: 'Pipeline builders, warehouse specialists, and analytics engineers who integrate with your data platforms and governance standards.',
        items: ['ETL/ELT &amp; pipeline engineers', 'Warehouse &amp; lakehouse specialists', 'Analytics engineering support'],
        icons: ['ti-database', 'ti-layers-linked', 'ti-chart-dots'],
      },
      {
        label: 'Software developers',
        menuTitle: 'Software developers',
        desc: 'Full-stack and enterprise developers across .NET, cloud-native, and integration stacks ready to join your sprints and rituals.',
        items: ['Enterprise application developers', 'Cloud-native &amp; API engineers', 'Integration specialists'],
        icons: ['ti-code', 'ti-cloud', 'ti-plug-connected'],
      },
      {
        label: 'AI specialists',
        menuTitle: 'AI specialists',
        desc: 'Practitioners in generative AI, RAG, and intelligent automation who can move use cases from roadmap to production safely.',
        items: ['Generative AI engineers', 'RAG &amp; assistant developers', 'Automation workflow specialists'],
        icons: ['ti-brain', 'ti-message-chatbot', 'ti-robot'],
      },
      {
        label: 'QA engineers',
        menuTitle: 'QA engineers',
        desc: 'Test automation and quality assurance specialists ensuring enterprise-grade delivery across web, mobile, and API layers.',
        items: ['Test automation engineers', 'Manual &amp; regression QA', 'API &amp; performance testing'],
        icons: ['ti-test-pipe', 'ti-bug', 'ti-gauge'],
      },
    ],
    methodIntro: 'From role definition to ongoing delivery &mdash; a staffing model built for long-term partnerships in Egypt and the GCC.',
    methodSteps: [
      ['Define &amp; match', 'Clarify roles, skills, timeline, and engagement model. Match screened candidates aligned with your stack and sector requirements.', 'ti-compass'],
      ['Onboard &amp; integrate', 'Embed talent into your tools, ceremonies, and security policies. Bilingual professionals aligned with Egypt and GCC time zones.', 'ti-ruler-2'],
      ['Deliver &amp; govern', 'Accountable contributors working to your backlog, with NDAs, access controls, and compliance suited to regulated sectors.', 'ti-code'],
      ['Scale &amp; retain', 'Flex team size as priorities shift. Long-term partnerships that reduce hiring friction and keep delivery velocity consistent.', 'ti-rocket'],
    ],
    cases: [
      {
        href: '../cases/ministry-planning.html',
        meta: 'Government &middot; Long-term delivery partnership',
        title: 'Enterprise Delivery Across Egypt and the Gulf',
        metric: '5+ years supporting ministries, banks, and enterprises',
        body: 'Technical teams supporting ministries, banks, and enterprises across six sectors with global technology partnerships.',
        chips: ['Outsourcing', 'Enterprise Delivery', 'Regulated Sectors'],
      },
      {
        href: '../cases/data-center-transformation.html',
        meta: 'Banking &middot; Extended delivery team',
        title: '30+ Enterprise Clients Across Regulated Industries',
        metric: 'Long-term engagements as an extension of client teams',
        body: 'Digital Hub talent operates inside client delivery teams &mdash; not as a short-term contractor swap &mdash; across banking, government, and industry.',
        chips: ['Outsourcing', 'Banking', 'Government'],
      },
    ],
    ctaText: 'Tell us the roles and timeline you need. Our technical talent team responds within one business day with a concrete next step.',
    ctaBtn: 'Tell us what roles you need',
    formLabel: 'Describe the roles or skills you need',
    formPlaceholder: 'Describe the roles or skills you need',
  },
];

function buildHeroChecks(checks) {
  return checks.map((text) =>
    `<li><span class="hero-check" aria-hidden="true"><i class="ti ti-check"></i></span>${text}</li>`
  ).join('\n          ');
}

function buildPage(cfg) {
  let html = template;

  html = html
    .replace(/<title>.*?<\/title>/, `<title>${cfg.title}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${cfg.description}" />`)
    .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${cfg.slug}" />`);

  html = navActive(html, cfg.slug);

  html = html
    .replace('Digital Hub for <strong>Enterprise Software</strong>', `Digital Hub for <strong>${cfg.heroEyebrow}</strong>`)
    .replace('<h1>Built for your organization, scaled for enterprise impact</h1>', `<h1>${cfg.heroH1}</h1>`)
    .replace(
      '<p class="hero-sub">Whether you&rsquo;re modernizing legacy systems or delivering mission-critical platforms, Digital Hub is the software partner trusted by enterprises across Egypt and the GCC.</p>',
      `<p class="hero-sub">${cfg.heroSub}</p>`
    )
    .replace('Tell us what you&rsquo;re building', cfg.heroCta)
    .replace(
      /<ul class="hero-checklist">[\s\S]*?<\/ul>/,
      `<ul class="hero-checklist">\n          ${buildHeroChecks(cfg.heroChecks)}\n        </ul>`
    )
    .replace('Enterprise Delivery', cfg.heroBadge)
    .replace(
      '<p class="hero-frame__title">Secure platforms for organizations that can&rsquo;t afford failure</p>',
      `<p class="hero-frame__title">${cfg.heroFrameTitle}</p>`
    )
    .replace(
      '<p class="hero-frame__meta">Custom applications, legacy modernization, and system integration &mdash; designed around how your teams actually work.</p>',
      `<p class="hero-frame__meta">${cfg.heroFrameMeta}</p>`
    );

  const statHtml = cfg.heroStats.map((val, i) => {
    const cls = i === 1 ? ' class="orange"' : '';
    return `<div class="hero-frame__stat"><strong${cls}>${val}</strong><span>${cfg.heroStatLabels[i]}</span></div>`;
  }).join('\n              ');
  html = html.replace(
    /<div class="hero-frame__stats">(?:\s*<div class="hero-frame__stat">[\s\S]*?<\/div>){3}\s*<\/div>/,
    `<div class="hero-frame__stats">\n              ${statHtml}\n            </div>`
  );

  html = html
    .replace('<h2>Your systems were built for a different problem.</h2>', `<h2>${cfg.problemH2}</h2>`)
    .replace(
      /<p>Most Egyptian and Gulf enterprises are running on software[\s\S]*?<\/p>\n      <\/header>/,
      `<p>${cfg.problemP}</p>\n      </header>`
    )
    .replace('Pipeline Audit', cfg.pipelineLabel);

  const nodeBlocks = cfg.nodes.map((label, i) => {
    const classes = ['pp-node--source', 'pp-node--legacy', 'pp-node--silo', 'pp-node--ai'][i];
    return `<div class="pp-node ${classes}">\n              <div class="pp-node__icon"><i class="ti ${cfg.nodeIcons[i]}"></i></div>\n              <span class="pp-node__label">${label}</span>\n            </div>`;
  });
  const connBlocks = [1, 2, 3].map((n) =>
    `<div class="pp-conn pp-conn--broken">\n              <div class="pp-conn__line"></div>\n              <div class="pp-conn__break pp-conn__break--${n}" data-break="${n}">&#x2715;</div>\n            </div>`
  );
  const trackParts = [];
  nodeBlocks.forEach((node, i) => {
    trackParts.push(node);
    if (connBlocks[i]) trackParts.push(connBlocks[i]);
  });
  html = html.replace(
    /<div class="pp-track" aria-hidden="true">[\s\S]*?<\/div>\n\n          <div class="pp-annotations">/,
    `<div class="pp-track" aria-hidden="true">\n            ${trackParts.join('\n\n            ')}\n          </div>\n\n          <div class="pp-annotations">`
  );

  const cardBlocks = cfg.cards.map(([icon, title, body], i) =>
    `<article class="pp-card pp-card--${i + 1}" data-break="${i + 1}">\n              <div class="pp-card__icon" aria-hidden="true"><i class="ti ${icon}"></i></div>\n              <div class="pp-card__body">\n                <h3>${title}</h3>\n                <p>${body}</p>\n              </div>\n            </article>`
  ).join('\n\n            ');
  html = html.replace(
    /<div class="pp-annotations">[\s\S]*?<\/div>\n        <\/div>/,
    `<div class="pp-annotations">\n            ${cardBlocks}\n          </div>\n        </div>`
  );

  html = html
    .replace(
      '<p>The result is organizations where IT is constantly catching up to the business &mdash; not enabling it.</p>',
      `<p>${cfg.problemBottom1}</p>`
    )
    .replace(
      '<p>We fix this by building software that is designed around your operations from the start &mdash; not retrofitted to them after the fact.</p>',
      `<p>${cfg.problemBottom2}</p>`
    )
    .replace('Digital Hub &middot; Enterprise Software Team', cfg.quoteCite)
    .replace('<span class="eswd-head__line2">Enterprise Software Solutions</span>', `<span class="eswd-head__line2">${cfg.eswdLine2}</span>`)
    .replace(
      '<p>We build secure, scalable, and integration-ready digital platforms that power complex operations and accelerate enterprise transformation.</p>',
      `<p>${cfg.eswdIntro}</p>`
    );

  cfg.scenes.forEach((scene, i) => {
    html = html.replace(
      new RegExp(`(<div class="eswd-scene[\\s\\S]*?data-scene="${i}">\\s*<span class="eswd-scene__label">)[^<]+(</span>)`),
      `$1${scene.label}$2`
    );
    html = html.replace(
      new RegExp(`(<button type="button" class="eswd-menu__item[^"]*" data-target="${i}">[\\s\\S]*?<span class="eswd-menu__title">)[^<]+(</span>)`),
      `$1${scene.menuTitle}$2`
    );
    html = html.replace(
      new RegExp(`(<button type="button" class="eswd-menu__item[^"]*" data-target="${i}">[\\s\\S]*?<p class="eswd-menu__desc">)[^<]+(</p>)`),
      `$1${scene.desc}$2`
    );
    const listItems = scene.items.map((item, j) =>
      `<li><i class="ti ${scene.icons[j]}" aria-hidden="true"></i> ${item}</li>`
    ).join('\n                ');
    html = html.replace(
      new RegExp(`(<button type="button" class="eswd-menu__item[^"]*" data-target="${i}">[\\s\\S]*?<ul class="eswd-menu__list">)[\\s\\S]*?(</ul>)`),
      `$1\n                ${listItems}\n              $2`
    );
  });

  html = html.replace(
    '<span class="eswd-deck__progress-label" id="eswdSceneName">Enterprise applications</span>',
    `<span class="eswd-deck__progress-label" id="eswdSceneName">${cfg.scenes[0].menuTitle}</span>`
  );

  html = html.replace(
    '<p>Every engagement follows the same structured delivery model. You know what&rsquo;s happening at every stage.</p>',
    `<p>${cfg.methodIntro}</p>`
  );

  const methodRows = html.match(/<article class="method-row[\s\S]*?<\/article>/g) || [];
  cfg.methodSteps.forEach(([title, body, icon], i) => {
    if (!methodRows[i]) return;
    let row = methodRows[i]
      .replace(/<h3>.*?<\/h3>/, `<h3>${title}</h3>`)
      .replace(/<p>We map your current processes[\s\S]*?<\/p>/, `<p>${body}</p>`)
      .replace(/<p>We design the solution architecture[\s\S]*?<\/p>/, `<p>${body}</p>`)
      .replace(/<p>We develop in iterative sprints[\s\S]*?<\/p>/, `<p>${body}</p>`)
      .replace(/<p>We manage production deployment[\s\S]*?<\/p>/, `<p>${body}</p>`)
      .replace(/<i class="ti ti-[^"]+"><\/i>/, `<i class="ti ${icon}"></i>`);
    html = html.replace(methodRows[i], row);
  });

  const caseCards = cfg.cases.map((c) =>
    `<a class="slash-card" href="${c.href}" data-reveal>\n          <div class="slash-card-inner">\n            <span class="slash-prefix" aria-hidden="true">/</span>\n            <div class="slash-content">\n              <p class="slash-meta">${c.meta}</p>\n              <h3>${c.title}</h3>\n              <p class="slash-metric">${c.metric}</p>\n              <p>${c.body}</p>\n              <div class="slash-chips">\n                ${c.chips.map((chip) => `<span>${chip}</span>`).join('')}\n              </div>\n              <span class="slash-link">Read case study <i class="ti ti-arrow-right"></i></span>\n            </div>\n          </div>\n        </a>`
  ).join('\n        ');
  html = html.replace(
    /<div class="cases-list">[\s\S]*?<\/div>\n    <\/div>\n  <\/section>\n\n  <!-- SECTION 7/,
    `<div class="cases-list">\n        ${caseCards}\n      </div>\n    </div>\n  </section>\n\n  <!-- SECTION 7`
  );

  html = html
    .replace(
      '<p>Tell us what you&rsquo;re trying to solve. Our enterprise software team responds within one business day with a concrete next step &mdash; not a brochure.</p>',
      `<p>${cfg.ctaText}</p>`
    )
    .replace(/<label for="message">.*?<\/label>/, `<label for="message">${cfg.formLabel}</label>`)
    .replace(/placeholder="Describe what you're trying to build"/, `placeholder="${cfg.formPlaceholder}"`)
    .replace('>Tell us what you&rsquo;re building <i class="ti ti-arrow-right"></i></button>', `>${cfg.ctaBtn} <i class="ti ti-arrow-right"></i></button>`);

  return html;
}

pages.forEach((cfg) => {
  const outPath = path.join(__dirname, '../services', cfg.slug);
  fs.writeFileSync(outPath, buildPage(cfg), 'utf8');
  console.log('Wrote', cfg.slug);
});
