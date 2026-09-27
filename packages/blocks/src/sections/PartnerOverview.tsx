/* partner_overview: the overview article on a partner page. The last paragraph closes it. */
import type { BlockContext } from "../context";
import type { PartnerOverviewFields } from "../generated/schema-types";

export function PartnerOverview({ fields, ctx }: { fields: PartnerOverviewFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const paragraphs = fields.paragraphs ?? [];
  const chips = fields.chips ?? [];
  return (
    <section className="partner-view-body" data-section-reveal="">
      <div className="section-inner">
        <article className="partner-overview is-blurred" data-reveal="">
          <div className="partner-overview__rail" aria-hidden="true">
            <span className="partner-overview__index">{fields.index}</span>
            <span className="partner-overview__rail-line"></span>
          </div>
          <div className="partner-overview__main">
            <header className="partner-overview__header">
              {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
              {fields.lede ? <p className="partner-overview__lede">{fields.lede}</p> : null}
            </header>
            {paragraphs.map((text, index) => (
              <p key={index} className={index === paragraphs.length - 1 && paragraphs.length > 1 ? "partner-overview__body partner-overview__body--closing" : "partner-overview__body"}>
                {text}
              </p>
            ))}
            <div className="partner-overview__capabilities">
              <div className="partner-overview__capabilities-head">
                {fields.deliverablesLabel ? <span className="partner-overview__capabilities-label">{fields.deliverablesLabel}</span> : null}
                {fields.deliverablesHeading ? <h2 className="partner-overview__subtitle">{fields.deliverablesHeading}</h2> : null}
              </div>
              {chips.length > 0 ? (
                <ul className="partner-overview__chips">
                  {chips.map((chip, index) => (
                    <li key={index}>{chip}</li>
                  ))}
                </ul>
              ) : null}
              {fields.action ? (
                <Link href={fields.action.href} className="partner-overview__cta">
                  {`${fields.action.label} `}
                  <i className="ti ti-arrow-right"></i>
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
