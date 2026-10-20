/**
 * The general application. The CV is emailed to the careers address.
 */
import { ApplyForm } from "./ApplyForm";

export function HowToApply({ email }: { email: string }) {
  return <section className="section careers-detail hub-section--tight"><div className="careers-detail__inner">
    <nav className="careers-crumb" aria-label="Breadcrumb" data-reveal="">
      <a href="/"><i className="ti ti-home" aria-hidden="true" /> Home</a>
      <span className="careers-crumb__sep" aria-hidden="true">/</span><a href="/careers">Careers</a>
      <span className="careers-crumb__sep" aria-hidden="true">/</span><span className="careers-crumb__current">Apply</span>
    </nav>
    <ApplyForm email={email} />
  </div></section>;
}
