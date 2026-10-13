/**
 * The apply page has no form. Applications go by email until the hiring
 * application exists (Phase G). The second sentence is the apply page's
 * existing hero lead.
 */
export function HowToApply({ email }: { email: string }) {
  const address = email.trim();
  return <section className="section careers-detail hub-section--tight"><div className="careers-detail__inner">
    <nav className="careers-crumb" aria-label="Breadcrumb" data-reveal="">
      <a href="/"><i className="ti ti-home" aria-hidden="true" /> Home</a>
      <span className="careers-crumb__sep" aria-hidden="true">/</span><a href="/careers">Careers</a>
      <span className="careers-crumb__sep" aria-hidden="true">/</span><span className="careers-crumb__current">Apply</span>
    </nav>
    <section className="careers-apply" id="apply" data-reveal="">
      <h2>How to apply</h2>
      <p>Email your CV. Our careers team reviews every application.</p>
      {address ? <a className="btn-pill" href={`mailto:${address}`}>{address}</a> : null}
    </section>
  </div></section>;
}
