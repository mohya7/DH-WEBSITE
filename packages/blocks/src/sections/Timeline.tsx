/*
 * timeline: the company history on the About page — a photo per year beside a
 * list of years, driven by js/about-page.js. The first year starts active.
 * Each slide's art modifier is the design, cycling by position as on the old page.
 */
import type { BlockContext } from "../context";
import type { TimelineFields } from "../generated/schema-types";

const arts = ["launch", "consult", "code", "growth", "ai"];

export function Timeline({ fields, ctx }: { fields: TimelineFields; ctx: BlockContext }) {
  const { Image } = ctx;
  const items = fields.items;
  return (
    <section className="section about-history" id="history">
      <div className="section-inner">
        <div className="jtl" id="jtlWrap">
          <header className="about-head about-history__head">
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            <h2>{fields.heading}</h2>
            {fields.lead ? <p>{fields.lead}</p> : null}
          </header>
          <div className="jtl-visual">
            <div className="jtl-slides">
              {items.map((item, index) => (
                <figure key={index} className={index === 0 ? "jtl-slide is-active" : "jtl-slide"} data-jtl={String(index)}>
                  <div className={`jtl-slide__art jtl-slide__art--${arts[index % arts.length]} jtl-slide__art--photo`}>
                    {item.image ? <Image mediaId={item.image.mediaId} alt={item.image.alt} decorative={item.image.decorative} sizes="(max-width: 900px) 100vw, 50vw" /> : null}
                  </div>
                </figure>
              ))}
            </div>
          </div>

          <div className="jtl-track">
            <div className="jtl-line" aria-hidden="true">
              <span className="jtl-line__fill"></span>
            </div>
            <ol className="jtl-list" role="list">
              {items.map((item, index) => (
                <li key={index} className={index === 0 ? "jtl-item is-active" : "jtl-item"} data-jtl={String(index)}>
                  <span className="jtl-dot" aria-hidden="true"></span>
                  <button type="button" className="jtl-item__btn" aria-pressed={index === 0 ? "true" : "false"}>
                    <span className="jtl-year">{item.year}</span>
                    <span className="jtl-text">{item.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
