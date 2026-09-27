/*
 * industries: the sector cards on service pages. Each card's icon is part of
 * the design, by position, the same on every service page.
 */
import type { BlockContext } from "../context";
import type { IndustriesFields } from "../generated/schema-types";

const icons = ["ti-building", "ti-building-bank", "ti-tools", "ti-flame", "ti-school", "ti-antenna"];

export function Industries({ fields }: { fields: IndustriesFields; ctx: BlockContext }) {
  return (
    <section className="industries" id="industries">
      <div className="container">
        <header className="section-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </header>
        <div className="industries-grid">
          {fields.items.map((item, index) => (
            <article key={index} className="industry-card" data-feature-block="">
              <div className="industry-card__glow" aria-hidden="true"></div>
              <div className="industry-card__icon">
                <i className={`ti ${icons[index] ?? "ti-building"}`}></i>
              </div>
              <h3 className="industry-card__title">{item.title}</h3>
              <p className="industry-card__desc">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
