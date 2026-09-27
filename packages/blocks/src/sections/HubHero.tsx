/*
 * hub_hero: the banner on the hub pages (partners, cases, blogs, news, careers),
 * contact, and apply. The last words of the heading are highlighted in <em>,
 * as the old runtime did.
 */
import type { BlockContext } from "../context";
import type { HubHeroFields } from "../generated/schema-types";
import { accentSplit } from "../util";

export function HubHero({ fields, ctx }: { fields: HubHeroFields; ctx: BlockContext }) {
  const { regular, accent } = accentSplit(fields.heading);
  const apply = ctx.page.kind === "page" && ctx.page.slug === "apply";
  const reveal = ctx.page.kind === "page" && ctx.page.slug === "partners" ? { "data-section-reveal": "" } : {};
  return (
    <section className="hub-hero" {...reveal}>
      <div className="hub-hero__inner">
        <div className="hub-banner" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h1>
            {regular ? `${regular} ` : null}
            <em>{accent}</em>
          </h1>
          {fields.lead ? (
            <p className="lead" {...(apply ? { "data-careers-apply-lead": "" } : {})}>
              {fields.lead}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
