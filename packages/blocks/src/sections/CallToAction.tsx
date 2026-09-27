/*
 * call_to_action. Three forms on the old site:
 *   partners hub, partner pages:        section.section.hub-cta[data-section-reveal] > .hub-cta__card, flat
 *   cases, blogs, careers, news hubs:   section.hub-cta > .hub-cta__card, copy wrapped in a <div>
 *   case studies:                       section.section > .cs-cta, copy wrapped in a <div>, .btn-primary
 */
import type { BlockContext } from "../context";
import type { CallToActionFields } from "../generated/schema-types";

export function CallToAction({ fields, ctx }: { fields: CallToActionFields; ctx: BlockContext }) {
  const { Link, page } = ctx;
  const caseStudy = page.kind === "case-study";
  const flat = page.kind === "partner" || (page.kind === "page" && page.slug === "partners");

  const copy = (
    <>
      <h2>{fields.heading}</h2>
      {fields.text ? <p>{fields.text}</p> : null}
    </>
  );
  const action = fields.action ? (
    <Link href={fields.action.href} className={caseStudy ? "btn-primary" : "btn-pill"}>
      {`${fields.action.label} `}
      <i className="ti ti-arrow-right"></i>
    </Link>
  ) : null;

  if (caseStudy) {
    return (
      <section className="section">
        <div className="section-inner">
          <div className="cs-cta" data-reveal="">
            <div>{copy}</div>
            {action}
          </div>
        </div>
      </section>
    );
  }

  if (flat) {
    return (
      <section className="section hub-cta" data-section-reveal="">
        <div className="section-inner">
          <div className="hub-cta__card" data-reveal="">
            {copy}
            {action}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hub-cta">
      <div className="section-inner">
        <div className="hub-cta__card" data-reveal="">
          <div>{copy}</div>
          {action}
        </div>
      </div>
    </section>
  );
}
