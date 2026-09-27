/*
 * pillars: mission and vision on the About page. The icon and modifier of each
 * card are part of the design, by position: mission, then vision.
 */
import type { BlockContext } from "../context";
import type { PillarsFields } from "../generated/schema-types";

const looks = [
  { modifier: "mission", icon: "ti-target" },
  { modifier: "vision", icon: "ti-eye" },
];

export function Pillars({ fields }: { fields: PillarsFields; ctx: BlockContext }) {
  return (
    <section className="section about-pillars" id="mission">
      <div className="section-inner">
        <header className="about-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
        </header>
        <div className="about-pillars__grid">
          {fields.items.map((item, index) => {
            const look = looks[index % looks.length];
            return (
              <article key={index} className={`about-pillar about-pillar--${look.modifier}`} data-reveal="">
                <div className="about-pillar__icon" aria-hidden="true">
                  <i className={`ti ${look.icon}`}></i>
                </div>
                <div className="about-pillar__body">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
