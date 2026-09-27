/*
 * partner_focus: the focus-area cards on a partner page. Each card's icon is
 * part of the design, per partner and position, as on the old pages.
 */
import type { BlockContext } from "../context";
import type { PartnerFocusFields } from "../generated/schema-types";

const icons: Record<string, string[]> = {
  microsoft: ["ti-cloud", "ti-apps", "ti-chart-dots"],
  huawei: ["ti-server-2", "ti-network", "ti-cpu"],
  nexthink: ["ti-rocket", "ti-chart-bar", "ti-shield-check"],
  efinance: ["ti-credit-card", "ti-building-bank", "ti-cloud-lock"],
  vodafone: ["ti-cloud-up", "ti-antenna-bars-5", "ti-headset"],
};

export function PartnerFocus({ fields, ctx }: { fields: PartnerFocusFields; ctx: BlockContext }) {
  const set = icons[ctx.page.slug] ?? [];
  return (
    <section className="section partner-focus" data-section-reveal="">
      <div className="section-inner">
        <div className="hub-head" data-reveal="">
          <div>
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            <h2>{fields.heading}</h2>
          </div>
        </div>
        <div className="partner-focus-grid">
          {fields.items.map((item, index) => (
            <article key={index} className="partner-focus-card" data-reveal="">
              <span className="partner-focus-card__icon">
                <i className={`ti ${set[index] ?? "ti-point"}`}></i>
              </span>
              <h3 className="partner-focus-card__title">{item.title}</h3>
              <p className="partner-focus-card__desc">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
