/*
 * vacancy_list: the careers page's open roles, from the published vacancies,
 * as the old runtime rendered its jobs. With none published it shows its
 * empty-state message and stays on the page (Phase A decision; allowed
 * difference: the old page listed test jobs).
 */
import type { BlockContext } from "../context";
import type { VacancyListFields } from "../generated/schema-types";

export function VacancyList({ fields, ctx }: { fields: VacancyListFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const vacancies = ctx.collections.vacancies.filter((item) => item.path && item.status !== "ended");
  return (
    <section className="section careers-opps" id="opportunities">
      <div className="section-inner">
        <div className="careers-opps__head" data-reveal="">
          <h2>{fields.heading}</h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </div>
        <div className="careers-opps__list" data-reveal="">
          {vacancies.length === 0 ? (
            <p>{fields.emptyMessage}</p>
          ) : (
            vacancies.map((item) => (
              <article key={item.id} className="careers-job-card">
                <div>
                  <h3>{item.title}</h3>
                  <p className="cms-job-meta">
                    {[item.fields.department, item.fields.employmentType, item.fields.location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Link href={item.path!} className="btn-pill">
                  {`${fields.actionLabel ?? "More Info"} `}
                  <i className="ti ti-arrow-up-right" aria-hidden="true"></i>
                </Link>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
