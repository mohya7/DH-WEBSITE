import type { ContentItem } from "@/content/build-content";

export function VacancyPage({ item, email }: { item: ContentItem<"vacancies">; email: string }) {
  const f = item.fields;
  const lists = [["Responsibilities", f.keyResponsibilities], ["Requirements", f.requiredSkills], ["Nice to have", f.niceToHave], ["What the role offers", f.roleOffers]];
  return <>
    <section className="careers-detail-hero" aria-label="Careers"><p className="careers-detail-hero__title">Careers</p></section>
    <section className="careers-detail"><div className="careers-detail__inner">
      <nav className="careers-crumb" aria-label="Breadcrumb" data-reveal=""><a href="/"><i className="ti ti-home" aria-hidden="true" /> Home</a><span className="careers-crumb__sep" aria-hidden="true">/</span><a href="/careers">Careers</a><span className="careers-crumb__sep" aria-hidden="true">/</span><span className="careers-crumb__current">{item.title}</span></nav>
      <header className="careers-detail__meta" data-reveal=""><div><h1>{item.title}</h1><div className="careers-detail__tags">{[f.employmentType, f.location, f.department].filter(Boolean).map((tag, index) => <span key={index}>{tag}</span>)}</div></div></header>
      {f.aboutRole || f.summary ? <section className="careers-detail__block" data-reveal=""><h2>Job Description</h2>{(f.aboutRole || f.summary)!.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section> : null}
      {lists.map(([heading, value]) => value ? <section className="careers-detail__block" data-reveal="" key={heading}><h2>{heading}</h2><ul>{value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => <li key={index}>{line}</li>)}</ul></section> : null)}
      {f.interviewStages?.length ? <section className="careers-detail__block" data-reveal=""><h2>Interview stages</h2><ol>{f.interviewStages.map((stage, index) => <li key={index}>{stage}</li>)}</ol></section> : null}
      <section className="careers-apply" id="apply" data-reveal="">{email.trim() ? <a className="btn-pill" href={`mailto:${email.trim()}?subject=${encodeURIComponent(`Application: ${item.title}`)}`}>Apply Now <i className="ti ti-arrow-right" aria-hidden="true" /></a> : null}</section>
    </div></section>
  </>;
}
