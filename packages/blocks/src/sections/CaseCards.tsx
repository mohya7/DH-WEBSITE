/*
 * case_cards. Renders nothing when it has no published case study to show (4.5).
 *
 *   home and the cases hub: the published case studies, as the old runtime
 *     rendered them from its case-study collection (the first four on home),
 *     with metric, categories for the hub filters, and the runtime's label.
 *     The hub adds the filter bar.
 *   service pages: the section's own items, as written in the old pages.
 *     An item whose case study is not published renders nothing (4.4).
 */
import type { BlockContext } from "../context";
import type { CaseCardsFields } from "../generated/schema-types";
import { slugify } from "../richtext/anchors";
import { caseCardsFromCollection, publishedCaseStudies, resolvedCaseItems } from "../select";

function runtimeLabel(title: string, metric: string): string {
  const flat = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return metric && !flat(title).includes(flat(metric)) ? `Read case study: ${title}. ${metric}` : `Read case study: ${title}`;
}

function Head({ fields, ctx, hub }: { fields: CaseCardsFields; ctx: BlockContext; hub: boolean }) {
  const { Link } = ctx;
  if (hub) {
    return (
      <div className="hub-head" data-reveal="">
        <div>
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="section-head row" data-reveal="">
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
  );
}

export function CaseCards({ fields, ctx }: { fields: CaseCardsFields; ctx: BlockContext }) {
  const { Image, Link } = ctx;
  const hub = ctx.page.kind === "page" && ctx.page.slug === "cases";

  if (caseCardsFromCollection(ctx)) {
    const published = publishedCaseStudies(ctx);
    const cases = ctx.page.kind === "home" ? published.slice(0, 4) : published;
    if (cases.length === 0) return null;
    return (
      <section className={hub ? "section hub-section hub-section--tight" : "section cases"} {...(hub ? {} : { id: "cases", "data-section-reveal": "" })}>
        <div className="section-inner">
          <Head fields={fields} ctx={ctx} hub={hub} />
          {hub && fields.filters && fields.filters.length > 0 ? (
            <div className="hub-filters" data-reveal="" role="tablist" aria-label="Filter by service">
              {fields.filters.map((label, index) => (
                <button key={index} type="button" className={index === 0 ? "hub-filter is-active" : "hub-filter"} data-filter={index === 0 ? "all" : slugify(label)} role="tab" aria-selected={index === 0 ? "true" : "false"}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="cases-grid stagger">
            {cases.map((item) => {
              const metric = (item.fields.metric ?? "").trim();
              return (
                <article key={item.id} className="case" data-category={(item.fields.categories ?? []).join(" ")} data-stagger-item="" data-reveal="">
                  <div className="case-glass" aria-hidden="true"></div>
                  <Link href={item.path} className="case-link" attributes={{ "aria-label": runtimeLabel(item.title, metric) }}>
                    <div className="case-media">
                      <Image mediaId={item.fields.imageId} alt={item.fields.imageAltOverride} sizes="(max-width: 900px) 100vw, 33vw" />
                    </div>
                    <div className="case-body">
                      {metric ? <span className="case-metric">{metric}</span> : null}
                      <h3 className="case-title">{item.title}</h3>
                      <p className="case-excerpt">{item.fields.summary}</p>
                      <span className="case-btn">Read More</span>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  const items = resolvedCaseItems(fields, ctx);
  if (items.length === 0) return null;
  return (
    <section className="section cases" id="cases" data-section-reveal="">
      <div className="section-inner">
        <Head fields={fields} ctx={ctx} hub={false} />
        <div className="cases-grid stagger">
          {items.map(({ item, path, target }, index) => {
            const title = item.title || target?.title || "";
            return (
              <article key={index} className="case" data-reveal="">
                <div className="case-glass" aria-hidden="true"></div>
                <Link href={path} className="case-link" attributes={{ "aria-label": `Read case study: ${title}` }}>
                  <div className="case-media">
                    {item.image ? <Image mediaId={item.image.mediaId} alt={item.image.alt} decorative={item.image.decorative} sizes="(max-width: 900px) 100vw, 33vw" /> : null}
                  </div>
                  <div className="case-body">
                    <h3 className="case-title">{title}</h3>
                    <p className="case-excerpt">{item.text || target?.fields.summary || ""}</p>
                    <span className="case-btn">{item.action?.label ?? "Read More"}</span>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
