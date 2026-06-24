const SCENE_THEMES = ['blue', 'cyan', 'orange', 'teal'];

function buildAppsMock(mock = {}) {
  const crumbs = mock.crumbs || ['Workspace', 'Operations', 'Approvals'];
  const metrics = mock.metrics || ['1,284', '97%', '42', '$8.4M', '312', '0.4s'];
  const crumbHtml = crumbs.map((c) => `<span>${c}</span>`).join('');
  const tileHtml = metrics.map((m) =>
    `<div class="eswd-mock-grid__tile"><span></span><strong>${m}</strong></div>`
  ).join('\n                    ');
  return `<div class="eswd-mock-bar">
                <i></i><i></i><i></i>
                <span class="eswd-mock-bar__crumbs">${crumbHtml}</span>
              </div>
              <div class="eswd-mock-layout">
                <div class="eswd-mock-aside">
                  <div class="eswd-mock-aside__brand"></div>
                  <div class="eswd-mock-aside__item is-active"></div>
                  <div class="eswd-mock-aside__item"></div>
                  <div class="eswd-mock-aside__item"></div>
                  <div class="eswd-mock-aside__item"></div>
                </div>
                <div class="eswd-mock-main">
                  <div class="eswd-mock-main__head">
                    <span class="eswd-mock-main__title"></span>
                    <span class="eswd-mock-main__chip"></span>
                  </div>
                  <div class="eswd-mock-grid">
                    ${tileHtml}
                  </div>
                </div>
              </div>`;
}

function buildPortalMock(mock = {}) {
  const url = mock.url || 'portal.your-organization.gov';
  return `<div class="eswd-mock-browser">
                <div class="eswd-mock-browser__dots"><span></span><span></span><span></span></div>
                <div class="eswd-mock-browser__url">${url}</div>
              </div>
              <div class="eswd-mock-portal">
                <div class="eswd-mock-portal__hero">
                  <strong></strong>
                  <span></span>
                  <em></em>
                </div>
                <div class="eswd-mock-portal__cols">
                  <div class="eswd-mock-portal__card"><span></span><span></span><span></span></div>
                  <div class="eswd-mock-portal__card"><span></span><span></span><span></span></div>
                  <div class="eswd-mock-portal__card"><span></span><span></span><span></span></div>
                </div>
              </div>`;
}

function buildIntegrationMock(mock = {}) {
  const nodes = mock.nodes || [
    ['ERP', 'SAP'], ['CRM', 'Dynamics'], ['DB', 'Oracle'], ['API', 'REST'],
  ];
  const nodeHtml = nodes.map(([label, sub], i) =>
    `<div class="eswd-mock-node eswd-mock-node--${i + 1}">${label}<small>${sub}</small></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-network">
                <svg class="eswd-mock-network__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M 18 18 L 50 50"/>
                  <path d="M 82 18 L 50 50"/>
                  <path d="M 18 82 L 50 50"/>
                  <path d="M 82 82 L 50 50"/>
                </svg>
                ${nodeHtml}
                <div class="eswd-mock-hub"></div>
              </div>`;
}

function buildModernMock(mock = {}) {
  const chips = mock.chips || ['Azure', 'AWS', 'Kubernetes', 'CI/CD'];
  const chipHtml = chips.map((c) => `<span>${c}</span>`).join('');
  return `<div class="eswd-mock-transform">
                <div class="eswd-mock-legacy">
                  <div class="eswd-mock-legacy__label">Legacy system</div>
                  <div class="eswd-mock-legacy__rows">
                    <code></code><code></code><code></code><code></code><code></code><code></code>
                  </div>
                </div>
                <div class="eswd-mock-arrow" aria-hidden="true"></div>
                <div class="eswd-mock-cloud">
                  <div class="eswd-mock-cloud__label">Cloud-ready platform</div>
                  <div class="eswd-mock-cloud__icon"></div>
                  <div class="eswd-mock-cloud__chips">${chipHtml}</div>
                </div>
              </div>
              <div class="eswd-mock-pipeline">
                <span class="eswd-mock-pipeline__label">Pipeline</span>
                <div class="eswd-mock-pipeline__step"></div>
                <div class="eswd-mock-pipeline__step"></div>
                <div class="eswd-mock-pipeline__step"></div>
                <div class="eswd-mock-pipeline__step"></div>
              </div>`;
}

function buildDataRoadmapMock(mock = {}) {
  const stages = mock.stages || ['Assess', 'Govern', 'Unify', 'Activate'];
  const stageHtml = stages.map((s, i) =>
    `<div class="eswd-mock-roadmap__step${i === 0 ? ' is-active' : ''}"><span>0${i + 1}</span><strong>${s}</strong></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-roadmap">
                <div class="eswd-mock-roadmap__track" aria-hidden="true"></div>
                ${stageHtml}
              </div>
              <div class="eswd-mock-roadmap__panel">
                <span class="eswd-mock-roadmap__chip">Maturity score</span>
                <strong>${mock.score || '72%'}</strong>
                <em>${mock.note || 'Governance &amp; source mapping in progress'}</em>
              </div>`;
}

function buildDataLayersMock(mock = {}) {
  const layers = mock.layers || ['Sources', 'Lakehouse', 'Warehouse', 'Marts'];
  const layerHtml = layers.map((l, i) =>
    `<div class="eswd-mock-layer" style="--layer-i:${i}"><span>${l}</span><em>${mock.volumes?.[i] || ''}</em></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-stack">
                ${layerHtml}
              </div>
              <div class="eswd-mock-stack__meta">
                <div><strong>${mock.sources || '24'}</strong><span>Sources</span></div>
                <div><strong>${mock.tables || '1.2k'}</strong><span>Tables</span></div>
                <div><strong>${mock.sla || '99.5%'}</strong><span>SLA</span></div>
              </div>`;
}

function buildDataFlowMock(mock = {}) {
  const nodes = mock.nodes || ['ERP', 'API', 'ETL', 'Lake'];
  const parts = [];
  nodes.forEach((n, i) => {
    parts.push(`<div class="eswd-mock-flow__node">${n}</div>`);
    if (i < nodes.length - 1) parts.push('<div class="eswd-mock-flow__conn" aria-hidden="true"></div>');
  });
  const metrics = mock.metrics || ['12M rows', '99.2%', 'Real-time', '24 jobs'];
  const metricHtml = metrics.map((m) => `<span>${m}</span>`).join('');
  return `<div class="eswd-mock-flow">
                ${parts.join('\n                ')}
              </div>
              <div class="eswd-mock-flow__stats">${metricHtml}</div>`;
}

function buildDataBiMock(mock = {}) {
  const kpis = mock.kpis || ['847', '98%', '$2.1B'];
  const kpiLabels = mock.kpiLabels || ['Reports', 'Quality', 'Value tracked'];
  const kpiHtml = kpis.map((k, i) =>
    `<div class="eswd-mock-bi__kpi"><strong>${k}</strong><span>${kpiLabels[i] || ''}</span></div>`
  ).join('\n                ');
  const bars = mock.bars || [65, 82, 45, 90, 72, 58];
  const barHtml = bars.map((h) =>
    `<div class="eswd-mock-bi__bar" style="--h:${h}%"></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-bi">
                <div class="eswd-mock-bi__kpis">${kpiHtml}</div>
                <div class="eswd-mock-bi__chart">${barHtml}</div>
              </div>`;
}

function buildAiRoadmapMock(mock = {}) {
  const cases = mock.cases || ['Support bot', 'Doc intake', 'Knowledge search'];
  const caseHtml = cases.map((c, i) =>
    `<div class="eswd-mock-airoad__card"><span>Priority ${i + 1}</span><strong>${c}</strong><em>${mock.scores?.[i] || 'High ROI'}</em></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-airoad">${caseHtml}</div>`;
}

function buildAiChatMock(mock = {}) {
  return `<div class="eswd-mock-chat">
                <div class="eswd-mock-chat__user">${mock.user || 'What is the status of claim #4421?'}</div>
                <div class="eswd-mock-chat__bot">
                  <span class="eswd-mock-chat__avatar" aria-hidden="true"><i class="ti ti-sparkles"></i></span>
                  <p>${mock.bot || 'Approved — payout scheduled in 3 business days. Source: policy KB v2.4'}</p>
                </div>
                <div class="eswd-mock-chat__chips">
                  <span>Grounded</span><span>Arabic / EN</span><span>Audit trail</span>
                </div>
              </div>`;
}

function buildAiDocsMock(mock = {}) {
  const fields = mock.fields || [['Vendor', 'ACME Ltd'], ['Amount', 'EGP 24,500'], ['Status', 'Verified']];
  const fieldHtml = fields.map(([k, v]) =>
    `<div class="eswd-mock-doc__field"><span>${k}</span><strong>${v}</strong></div>`
  ).join('\n                  ');
  return `<div class="eswd-mock-doc">
                <div class="eswd-mock-doc__preview">
                  <div class="eswd-mock-doc__page"></div>
                  <div class="eswd-mock-doc__scan" aria-hidden="true"></div>
                </div>
                <div class="eswd-mock-doc__extract">
                  ${fieldHtml}
                </div>
              </div>`;
}

function buildAiAgentsMock(mock = {}) {
  const agents = mock.agents || ['Triage', 'Extract', 'Route', 'Notify'];
  const agentHtml = agents.map((a, i) =>
    `<div class="eswd-mock-agent${i === 1 ? ' is-active' : ''}"><span>0${i + 1}</span><strong>${a}</strong></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-agents">
                <div class="eswd-mock-agents__wire" aria-hidden="true"></div>
                ${agentHtml}
              </div>
              <div class="eswd-mock-agents__foot">
                <span>Governance</span><span>RAG</span><span>Human review</span>
              </div>`;
}

function buildTalentQaMock(mock = {}) {
  const tests = mock.tests || ['API suite', 'Regression', 'E2E', 'Performance'];
  const pass = mock.pass || [98, 100, 92, 88];
  const rowHtml = tests.map((t, i) =>
    `<div class="eswd-mock-qa__row"><span>${t}</span><strong>${pass[i]}%</strong><em class="eswd-mock-qa__bar" style="--w:${pass[i]}%"></em></div>`
  ).join('\n                ');
  return `<div class="eswd-mock-qa">
                <div class="eswd-mock-qa__head"><span>Test run #184</span><strong>${mock.status || 'Passing'}</strong></div>
                ${rowHtml}
              </div>`;
}

const MOCK_BUILDERS = {
  apps: buildAppsMock,
  portal: buildPortalMock,
  integration: buildIntegrationMock,
  modern: buildModernMock,
  'data-roadmap': buildDataRoadmapMock,
  'data-layers': buildDataLayersMock,
  'data-flow': buildDataFlowMock,
  'data-bi': buildDataBiMock,
  'ai-roadmap': buildAiRoadmapMock,
  'ai-chat': buildAiChatMock,
  'ai-docs': buildAiDocsMock,
  'ai-agents': buildAiAgentsMock,
  'talent-qa': buildTalentQaMock,
};

function buildSceneMock(scene) {
  const builder = MOCK_BUILDERS[scene.visual];
  if (!builder) return buildAppsMock(scene.mock);
  return builder(scene.mock || {});
}

function buildEswdScene(scene, index) {
  const theme = scene.theme || SCENE_THEMES[index] || 'blue';
  const active = index === 0 ? ' is-active' : '';
  const visualClass = scene.image ? 'photo' : scene.visual;
  const inner = scene.image
    ? `<div class="eswd-scene__photo"><img src="${scene.image}" alt="${scene.imageAlt || scene.label}" loading="lazy" decoding="async"></div>`
    : `<div class="eswd-scene__mock">\n              ${buildSceneMock(scene)}\n            </div>`;
  return `<div class="eswd-scene eswd-scene--${visualClass} eswd-scene--${theme}${active}" data-scene="${index}">
            <span class="eswd-scene__label">${scene.label}</span>
            ${inner}
          </div>`;
}

function buildEswdStage(scenes) {
  return scenes.map(buildEswdScene).join('\n\n          ');
}

module.exports = {
  buildEswdStage,
  SCENE_THEMES,
};
