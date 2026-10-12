/*
 * service_cards. Two forms on the old site:
 *   home:  section#services — the published services as the old runtime
 *          rendered them from its service collection: icon, title, summary,
 *          link, and a small decorative visual chosen by the service's visual
 *   about: the "Service Constellation" diagram — one node per item, linked to
 *          its service. Node modifiers and icons are the design, by position.
 *          A node whose service is not published renders nothing (4.4).
 */
import { Fragment, type ReactNode } from "react";
import type { BlockContext, BlockItem } from "../context";
import type { ServiceCardsFields } from "../generated/schema-types";

const codeWindow = (lines: number) => (
  <div className="svc-code-win">
    <div className="svc-code-bar">
      <span className="svc-code-dot"></span>
      <span className="svc-code-dot"></span>
      <span className="svc-code-dot"></span>
    </div>
    <div className="svc-code-lines">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="svc-code-line"></span>
      ))}
    </div>
  </div>
);

const teamPill = (icon: string, label: string) => (
  <div className="svc-team-pill">
    <span className="svc-team-av">
      <i className={`ti ${icon}`}></i>
    </span>
    {label}
  </div>
);

const repeat = (count: number, className: string) => Array.from({ length: count }, (_, index) => <span key={index} className={className}></span>);

/** The decorative visual on each home service card, as the old runtime drew it. */
function visual(kind: string | null | undefined): ReactNode {
  if (kind === "data") {
    return (
      <div className="svc-viz-data">
        <div className="svc-data-bars">{repeat(5, "svc-data-bar")}</div>
        {repeat(3, "svc-data-node")}
        {repeat(2, "svc-data-line")}
      </div>
    );
  }
  if (kind === "ai") {
    return (
      <div className="svc-viz-ai">
        <div className="svc-ai-orb"></div>
        {repeat(5, "svc-ai-node")}
      </div>
    );
  }
  if (kind === "team") {
    return (
      <div className="svc-viz-team">
        {teamPill("ti-code", "Developer")}
        {teamPill("ti-database", "Data Engineer")}
        {teamPill("ti-brain", "AI Specialist")}
        {teamPill("ti-test-pipe", "QA Engineer")}
      </div>
    );
  }
  return (
    <div className="svc-viz-code">
      {codeWindow(3)}
      {codeWindow(2)}
    </div>
  );
}

const nodeLooks = [
  { modifier: "source", icon: "ti-chart-dots" },
  { modifier: "legacy", icon: "ti-brain" },
  { modifier: "silo", icon: "ti-users" },
  { modifier: "ai", icon: "ti-code" },
  { modifier: "consult", icon: "ti-compass" },
];

function Constellation({ fields, ctx }: { fields: ServiceCardsFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const nodes = (fields.items ?? []).flatMap((item, index) => {
    const look = nodeLooks[index] ?? nodeLooks[nodeLooks.length - 1];
    if (item.reference) {
      const path = ctx.resolve(item.reference);
      return path ? [{ item, look, href: path }] : [];
    }
    return [{ item, look, href: item.action?.href ?? null }];
  });
  return (
    <section className="section about-services" id="services">
      <div className="section-inner">
        <header className="about-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </header>

        <div className="about-constellation problem-pipeline" id="aboutConstellation" aria-label="Digital Hub service areas">
          <div className="pp-canvas">
            <div className="pp-head">
              <span className="pp-head__dot" aria-hidden="true"></span>
              {fields.diagramLabel ? ` ${fields.diagramLabel}` : null}
            </div>
            <div className="pp-track" aria-hidden="true">
              {nodes.map(({ item, look, href }, index) => {
                const inner = (
                  <>
                    <div className="pp-node__icon">
                      <i className={`ti ${look.icon}`}></i>
                    </div>
                    <span className="pp-node__label">{item.title}</span>
                  </>
                );
                const className = `pp-node pp-node--${look.modifier}`;
                return (
                  <Fragment key={index}>
                    {index > 0 ? (
                      <div className="pp-conn">
                        <div className="pp-conn__line"></div>
                      </div>
                    ) : null}
                    {href ? (
                      <Link href={href} className={className}>
                        {inner}
                      </Link>
                    ) : (
                      <a className={className}>{inner}</a>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ServiceCards({ fields, ctx }: { fields: ServiceCardsFields; ctx: BlockContext }) {
  if (ctx.page.kind !== "home") return <Constellation fields={fields} ctx={ctx} />;

  const { Link } = ctx;
  const services = ctx.collections.services.filter((item): item is BlockItem<"services"> & { path: string } => Boolean(item.path));
  return (
    <section className="section services" id="services" data-section-reveal="">
      <div className="services-runway" id="servicesScroll">
        <div className="services-pin" id="servicesPin">
          <header className="services-head" data-reveal="">
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            <h2 className="services-title">{fields.heading}</h2>
          </header>
          <div className="services-viewport">
            <div className="services-track" id="servicesTrack">
              {services.map((service) => (
                <article key={service.id} className="svc-card" data-reveal="">
                  <div className="svc-card__body">
                    <div className="svc-card__icon">
                      <i className={`ti ${service.fields.icon || "ti-sparkles"}`}></i>
                    </div>
                    <h3 className="svc-card__title">{service.title}</h3>
                    <p className="svc-card__desc">{service.fields.summary}</p>
                    <Link href={service.path} className="svc-card__link" attributes={{ "aria-label": `Learn more about ${service.title}` }}>
                      {"Learn more "}
                      <i className="ti ti-arrow-right"></i>
                    </Link>
                  </div>
                  <div className="svc-card__visual" aria-hidden="true">
                    {visual(service.fields.visual)}
                  </div>
                </article>
              ))}
              <div className="services-track-end" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
