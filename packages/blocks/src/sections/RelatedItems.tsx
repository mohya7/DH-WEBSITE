/*
 * related_items: links to other published items. An item whose target is not
 * published renders nothing (4.4). Two forms on the old site:
 *   partner pages: section.partner-view-related — partner cards with logo,
 *                  name, summary, and action
 *   case studies:  .cs-related — label and title links
 * A title or text left empty shows the target's own title or summary.
 */
import type { BlockContext, BlockItem } from "../context";
import type { RelatedItemsFields } from "../generated/schema-types";
import { resolvedRelatedItems } from "../select";
import { PartnerHubCard } from "./PartnerHubCard";

type Resolved = { item: RelatedItemsFields["items"][number]; target: BlockItem; path: string };

export function RelatedItems({ fields, ctx }: { fields: RelatedItemsFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const resolved: Resolved[] = resolvedRelatedItems(fields, ctx);
  if (resolved.length === 0) return null;

  const head = (
    <>
      {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
      {ctx.page.kind === "partner" ? <h2>{fields.heading}</h2> : <h2 className="h2">{fields.heading}</h2>}
    </>
  );

  if (ctx.page.kind === "partner") {
    return (
      <section className="section partner-view-related" data-section-reveal="">
        <div className="section-inner">
          <div className="hub-head" data-reveal="">
            <div>{head}</div>
          </div>
          <div className="partners-hub-grid">
            {resolved.map(({ item, target, path }) =>
              item.type === "partner" ? (
                <PartnerHubCard
                  key={target.id}
                  partner={target as BlockItem<"partners">}
                  path={path}
                  image={item.image ?? { mediaId: (target as BlockItem<"partners">).fields.imageId }}
                  title={item.title}
                  text={item.text}
                  action={item.action}
                  ctx={ctx}
                />
              ) : null,
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-inner">
        <header data-reveal="" style={{ marginBottom: "24px" }}>
          {head}
        </header>
        <div className="cs-related">
          {resolved.map(({ item, target, path }) => (
            <Link key={target.id} href={path} attributes={{ "data-reveal": "" }}>
              {item.label ? <span className="cs-related__label">{item.label}</span> : null}
              <span className="cs-related__title">{item.title?.trim() || target.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
