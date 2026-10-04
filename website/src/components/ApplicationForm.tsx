/** Markup from careers/apply.html on feature/interviewer-portal. Behaviour is a plain script. */
export function ApplicationForm({ endpoint }: { endpoint: string }) {
  return <section className="section careers-detail hub-section--tight"><div className="careers-detail__inner">
    <nav className="careers-crumb" aria-label="Breadcrumb" data-reveal="">
      <a href="/"><i className="ti ti-home" aria-hidden="true" /> Home</a>
      <span className="careers-crumb__sep" aria-hidden="true">/</span><a href="/careers">Careers</a>
      <span className="careers-crumb__sep" aria-hidden="true">/</span><span className="careers-crumb__current">Apply</span>
    </nav>
    <section className="careers-apply careers-apply--form" id="apply" data-reveal="">
      <p data-careers-apply-intro="">Share your background and CV. We’re always meeting strong talent across engineering, data, and delivery.</p>
      <form className="careers-apply-form" action={endpoint} method="post" data-submit-url={endpoint} data-role="General application" encType="multipart/form-data">
        <input type="hidden" name="role" value="General application" /><input type="hidden" name="roleSlug" value="" />
        <input type="hidden" name="expectedSalaryRange" value="" /><input type="hidden" name="noticePeriod" value="" />
        <label className="careers-apply-form__trap" aria-hidden="true">Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
        <div><label className="field-label" htmlFor="apply-name">Full Name (English) <span className="field-required">*</span></label><input className="input" id="apply-name" name="fullName" type="text" placeholder="Your full name in English" required autoComplete="name" /></div>
        <div className="field-row">
          <div><label className="field-label" htmlFor="apply-phone">Phone Number <span className="field-required">*</span></label><input className="input" id="apply-phone" name="phone" type="tel" placeholder="+20 ..." required autoComplete="tel" /></div>
          <div><label className="field-label" htmlFor="apply-email">Email <span className="field-required">*</span></label><input className="input" id="apply-email" name="email" type="email" placeholder="you@email.com" required autoComplete="email" /></div>
        </div>
        <div className="field-row">
          <div><label className="field-label" htmlFor="apply-current-salary">Current Salary (EGP – K) <span className="field-required">*</span></label><input className="input" id="apply-current-salary" name="currentSalary" type="number" min="0" step="1" placeholder="e.g. 15" required /></div>
          <div><label className="field-label" htmlFor="apply-experience">Years of experience <span className="field-required">*</span></label><select className="select" id="apply-experience" name="yearsOfExperience" required data-careers-select="experience"><option value="">Select years of experience</option></select></div>
        </div>
        <div className="field-row">
          <div><label className="field-label" htmlFor="apply-expected-salary">Expected Salary (EGP – K) <span className="field-required">*</span></label><input className="input" id="apply-expected-salary" name="expectedSalary" type="number" min="0" step="1" placeholder="e.g. 25" required /></div>
          <div><label className="field-label" htmlFor="apply-notice">Notice Period (weeks) <span className="field-required">*</span></label><input className="input" id="apply-notice" name="noticePeriodWeeks" type="number" min="0" max="52" step="1" placeholder="e.g. 2 (enter 0 if immediate)" required /></div>
        </div>
        <div className="field-row">
          <div><label className="field-label" htmlFor="apply-resume">CV <span className="field-required">*</span></label><input className="careers-apply-form__file" id="apply-resume" name="resume" type="file" accept=".pdf,.doc,.docx" required /><p className="careers-apply-form__hint">PDF or Word, max 5 MB</p></div>
          <div><label className="field-label" htmlFor="apply-linkedin">LinkedIn <span className="field-required">*</span></label><input className="input" id="apply-linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/..." required /></div>
        </div>
        <button type="submit" className="submit-btn">Submit application <i className="ti ti-arrow-right" aria-hidden="true" /></button>
      </form>
    </section>
  </div></section>;
}
