/*
 * problem. Two forms on the old site:
 *   service pages: section.problem — lead, a broken-pipeline diagram (four
 *                  nodes, three break points, three cards), outcomes, quote
 *   case studies:  a labelled prose block (.cs-section), the "Challenge"
 *
 * The diagram's icons and its accessible description differ per service and
 * are part of the design, chosen by the service's visual.
 */
import type { BlockContext } from "../context";
import { inlinePlainText } from "../inline/document";
import { InlineText } from "../inline/InlineText";
import type { ProblemFields } from "../generated/schema-types";
import { serviceVisual } from "../lookup";
import { Prose } from "./Prose";

const looks: Record<string, { flow: string; nodes: string[]; cards: string[]; outcome: string }> = {
  ai: { flow: "automation", nodes: ["ti-file-text", "ti-click", "ti-books", "ti-brain"], cards: ["ti-clock", "ti-lock", "ti-alert-triangle"], outcome: "ti-alert-triangle" },
  data: { flow: "data", nodes: ["ti-database-import", "ti-server-2", "ti-table", "ti-chart-bar"], cards: ["ti-unlink", "ti-shield-off", "ti-clock-exclamation"], outcome: "ti-report-search" },
  code: { flow: "platform", nodes: ["ti-server-2", "ti-apps", "ti-arrows-exchange", "ti-layout-dashboard"], cards: ["ti-unlink", "ti-puzzle-off", "ti-layers-off"], outcome: "ti-trending-down" },
  team: { flow: "staffing", nodes: ["ti-user-search", "ti-hourglass", "ti-list-details", "ti-target"], cards: ["ti-clock-pause", "ti-user-exclamation", "ti-arrows-random"], outcome: "ti-user-exclamation" },
};
const nodeKinds = ["source", "legacy", "silo", "ai"];

export function Problem({ fields, ctx }: { fields: ProblemFields; ctx: BlockContext }) {
  if (ctx.page.kind !== "service") {
    return <Prose eyebrow={fields.eyebrow} heading={fields.heading} blocks={fields.blocks} />;
  }

  const look = looks[serviceVisual(ctx)] ?? looks.ai;
  const flow = fields.flow ?? [];
  const cards = fields.cards ?? [];
  const outcomes = fields.outcomes ?? [];
  return (
    <section className="problem" id="problem">
      <div className="container problem-inner">
        <header className="problem-lead" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
          {inlinePlainText(fields.lead) ? (
            <p>
              <InlineText value={fields.lead} ctx={ctx} />
            </p>
          ) : null}
        </header>

        <div className="problem-pipeline" id="problemPipeline" aria-label={`Illustration: broken ${look.flow} flow with three break points`}>
          <div className="pp-canvas">
            <div className="pp-head">
              <span className="pp-head__dot" aria-hidden="true"></span>
              {fields.diagramTitle ? ` ${fields.diagramTitle} ` : " "}
              <span className="pp-head__status" id="problemPipelineStatus">
                {fields.diagramStatus}
              </span>
            </div>

            <div className="pp-track" aria-hidden="true">
              {flow.map((label, index) => (
                <FlowStep key={index} index={index} label={label} icon={look.nodes[index] ?? "ti-point"} last={index === flow.length - 1} />
              ))}
            </div>

            <div className="pp-annotations">
              {cards.map((card, index) => (
                <article key={index} className={`pp-card pp-card--${index + 1}`} data-break={String(index + 1)}>
                  <div className="pp-card__icon" aria-hidden="true">
                    <i className={`ti ${look.cards[index] ?? "ti-point"}`}></i>
                  </div>
                  <div className="pp-card__body">
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="problem-bottom" data-reveal="">
          {outcomes.length > 0 ? (
            <div className="problem-outcomes">
              {outcomes.map((outcome, index) => (
                <div key={index} className={index === 0 ? "problem-outcome" : "problem-outcome problem-outcome--fix"}>
                  <span className="problem-outcome__icon" aria-hidden="true">
                    <i className={`ti ${index === 0 ? look.outcome : "ti-check"}`}></i>
                  </span>
                  <div className="problem-outcome__body">
                    <strong>{outcome.title}</strong>
                    <p>{outcome.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {fields.quote ? (
            <blockquote className="problem-quote">
              <span className="problem-quote__mark" aria-hidden="true"></span>
              <p>{fields.quote}</p>
              {fields.cite ? <cite>{fields.cite}</cite> : null}
            </blockquote>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FlowStep({ index, label, icon, last }: { index: number; label: string; icon: string; last: boolean }) {
  return (
    <>
      <div className={`pp-node pp-node--${nodeKinds[index] ?? "source"}`}>
        <div className="pp-node__icon">
          <i className={`ti ${icon}`}></i>
        </div>
        <span className="pp-node__label">{label}</span>
      </div>
      {last ? null : (
        <div className="pp-conn pp-conn--broken">
          <div className="pp-conn__line"></div>
          <div className={`pp-conn__break pp-conn__break--${index + 1}`} data-break={String(index + 1)}>
            ✕
          </div>
        </div>
      )}
    </>
  );
}
