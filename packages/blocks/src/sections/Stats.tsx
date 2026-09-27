/*
 * stats: the counters. Two forms on the old site:
 *   home:  section#numbers with a heading block; the row as the old runtime
 *          rendered it (every stat data-reveal, none data-stagger)
 *   about: section#stats.about-stats, the row only, as written in the page
 *          (every stat after the first also data-stagger)
 * The counter script animates each .stat-num from 0 to data-count.
 */
import type { BlockContext } from "../context";
import type { StatsFields } from "../generated/schema-types";
import { statValue } from "../util";

function Stat({ value, label, stagger }: { value: string; label: string; stagger: boolean }) {
  const { count, suffix } = statValue(value);
  return (
    <div className="stat" data-reveal="" {...(stagger ? { "data-stagger": "" } : {})}>
      <div className="stat-num" data-count={count} {...(suffix ? { "data-suffix": suffix } : {})}>
        0
      </div>
      <p className="stat-label">{label}</p>
    </div>
  );
}

export function Stats({ fields, ctx }: { fields: StatsFields; ctx: BlockContext }) {
  if (ctx.page.kind === "home") {
    return (
      <section className="section numbers" id="numbers" aria-label="By the numbers" data-section-reveal="">
        <div className="section-inner">
          <div className="numbers-head" data-reveal="">
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            {fields.heading ? <h2 className="h2">{fields.heading}</h2> : null}
            {fields.lead ? <p className="lead">{fields.lead}</p> : null}
          </div>
          <div className="numbers-row stagger">
            {fields.items.map((item, index) => (
              <Stat key={index} value={item.value} label={item.label} stagger={false} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section numbers about-stats" id="stats" aria-label="By the numbers">
      <div className="section-inner">
        <div className="numbers-row stagger">
          {fields.items.map((item, index) => (
            <Stat key={index} value={item.value} label={item.label} stagger={index > 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
