/**
 * The apply page has no form. Applications are by email to the careers address.
 * The hero lead is separate and is not repeated here.
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
      <p>Email your CV, your LinkedIn profile and your availability to</p>
      {address ? <a className="btn-pill" href={`mailto:${address}`}>{address}</a> : null}
      <p>Put the role you are applying for in the subject line.</p>
    </section>
  </div></section>;
}
