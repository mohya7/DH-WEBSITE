/*
 * partner_grid: the published partners, as the old runtime rendered them from
 * its partner collection. Two forms:
 *   home: section#partners — the first six as flip cards, and a "View all" link
 *   hub:  the partners hub — every partner as a card
 * The section supplies the headings; the cards come from the partners.
 */
import type { BlockContext, BlockItem } from "../context";
import type { PartnerGridFields } from "../generated/schema-types";
import { PartnerHubCard } from "./PartnerHubCard";

export function PartnerGrid({ fields, ctx }: { fields: PartnerGridFields; ctx: BlockContext }) {
  const { Image, Link } = ctx;
  const partners = ctx.collections.partners.filter((item): item is BlockItem<"partners"> & { path: string } => Boolean(item.path));
  const logo = (partner: BlockItem<"partners">) => ({ mediaId: partner.fields.imageId, alt: partner.fields.imageAltOverride });

  if (ctx.page.kind === "home") {
    return (
      <section className="section partners" id="partners" data-section-reveal="">
        <div className="section-inner">
          <div className="partners-head" data-reveal="">
            <div className="head-left">
              {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
              <h2 className="h2">{fields.heading}</h2>
              {fields.lead ? <p className="lead">{fields.lead}</p> : null}
            </div>
            {fields.action ? (
              <Link href={fields.action.href} className="tlink">
                {`${fields.action.label} `}
                <i className="ti ti-arrow-right"></i>
              </Link>
            ) : null}
          </div>

          <div className="partners-grid stagger">
            {partners.slice(0, 6).map((partner) => (
              <article key={partner.id} className="partner" data-reveal="" tabIndex={0}>
                <div className="partner-card">
                  <div className="partner-card__bg" aria-hidden="true"></div>
                  <div className="partner-card__dim" aria-hidden="true"></div>
                  <div className="partner-card__blur" aria-hidden="true"></div>
                  <div className="partner-logo-wrap">
                    <Image {...logo(partner)} className="partner-logo-img" sizes="165px" />
                  </div>
                  <div className="partner-reveal">
                    <p>{partner.fields.summary}</p>
                    <Link href={partner.path} className="partner-btn">
                      Explore More
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section hub-section hub-section--tight" data-section-reveal="">
      <div className="section-inner">
        <div className="hub-head" data-reveal="">
          <div>
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            <h2>{fields.heading}</h2>
            {fields.lead ? <p>{fields.lead}</p> : null}
          </div>
        </div>
        <div className="partners-hub-grid">
          {partners.map((partner) => (
            <PartnerHubCard key={partner.id} partner={partner} path={partner.path} image={logo(partner)} ctx={ctx} />
          ))}
        </div>
      </div>
    </section>
  );
}
