function buildCasesSection() {
  return `  <!-- SECTION 6 — CASE STUDIES -->
  <section class="section cases" id="cases" data-section-reveal>
    <div class="section-inner">
      <div class="section-head row" data-reveal>
        <div class="head-left">
          <span class="label">Case Studies</span>
          <h2 class="h2">Results we&rsquo;ve delivered.</h2>
          <p class="lead">Real projects. Real outcomes. Across Egypt&rsquo;s most demanding institutions.</p>
        </div>
        <a class="tlink" href="../cases/index.html">View all case studies <i class="ti ti-arrow-right"></i></a>
      </div>

      <div class="cases-grid stagger">
        <article class="case" data-reveal>
          <div class="case-glass" aria-hidden="true"></div>
          <a class="case-link" href="../cases/ministry-planning.html" aria-label="Read case study: Ministry of Planning and Economic Development">
            <div class="case-media">
              <img src="../assets/cases/planning.webp" alt="Government planning and data systems" loading="lazy" decoding="async">
            </div>
            <div class="case-body">
              <h3 class="case-title">3+ years powering Egypt&rsquo;s national planning systems</h3>
              <p class="case-excerpt">Full development of Egyptian planning systems for the Ministry of Planning &amp; Economic Development &mdash; data warehouse, cybersecurity, advanced dashboards, and platform support.</p>
              <span class="case-btn">Read More</span>
            </div>
          </a>
        </article>

        <article class="case" data-reveal>
          <div class="case-glass" aria-hidden="true"></div>
          <a class="case-link" href="../cases/data-center-transformation.html" aria-label="Read case study: Credit Guarantee Corporation">
            <div class="case-media">
              <img src="../assets/cases/banking.webp" alt="Banking infrastructure transformation" loading="lazy" decoding="async">
            </div>
            <div class="case-body">
              <h3 class="case-title">End-to-end data center transformation for Central Bank of Egypt</h3>
              <p class="case-excerpt">Infrastructure and digital transformation consulting for the Credit Guarantee Corporation &mdash; establishing a complete data center and enterprise information infrastructure.</p>
              <span class="case-btn">Read More</span>
            </div>
          </a>
        </article>

        <article class="case" data-reveal>
          <div class="case-glass" aria-hidden="true"></div>
          <a class="case-link" href="../cases/nexthink-dex-bank.html" aria-label="Read case study: Leading Egyptian Bank DEX">
            <div class="case-media">
              <img src="../assets/cases/dex.webp" alt="Digital employee experience monitoring" loading="lazy" decoding="async">
            </div>
            <div class="case-body">
              <h3 class="case-title">500+ endpoints under real-time Nexthink DEX monitoring</h3>
              <p class="case-excerpt">Deployed Nexthink DEX across a major bank&rsquo;s full IT environment &mdash; giving the IT team live visibility into endpoint health and employee experience at scale.</p>
              <span class="case-btn">Read More</span>
            </div>
          </a>
        </article>

        <article class="case" data-reveal>
          <div class="case-glass" aria-hidden="true"></div>
          <a class="case-link" href="../cases/index.html" aria-label="Case study coming soon">
            <div class="case-media">
              <img src="../assets/cases/banking.webp" alt="Enterprise digital transformation" loading="lazy" decoding="async">
            </div>
            <div class="case-body">
              <h3 class="case-title">National e-services portal for a government ministry</h3>
              <p class="case-excerpt">End-to-end design and delivery of a citizen-facing digital services platform &mdash; unified identity, workflow automation, and analytics for leadership dashboards.</p>
              <span class="case-btn">Read More</span>
            </div>
          </a>
        </article>
      </div>
    </div>
  </section>`;
}

module.exports = { buildCasesSection };
