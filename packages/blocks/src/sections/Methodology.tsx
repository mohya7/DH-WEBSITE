/*
 * methodology: the numbered stages on service pages, alternating sides along an
 * animated wire. The wire's SVG is filled in by the page script
 * (js/service-page.js); rows alternate reverse and orange by position.
 */
import type { BlockContext } from "../context";
import type { MethodologyFields } from "../generated/schema-types";

const rowLooks = ["", " method-row--reverse method-row--orange", " method-row--orange", " method-row--reverse"];

export function Methodology({ fields, ctx }: { fields: MethodologyFields; ctx: BlockContext }) {
  const { Image } = ctx;
  return (
    <section className="method" id="method">
      <div className="method-inner">
        <header className="method-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </header>

        <div className="method-rows" id="methodRows">
        <div className="method-wire-wrap" aria-hidden="true">
          <svg className="method-wire" id="methodWire" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="methodWireGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F4970B"></stop>
                <stop offset="45%" stopColor="#FF6B4A"></stop>
                <stop offset="100%" stopColor="#36B0E5"></stop>
              </linearGradient>
              <filter id="methodWireGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur"></feGaussianBlur>
                <feMerge>
                  <feMergeNode in="blur"></feMergeNode>
                  <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
              </filter>
              <filter id="methodWireDotGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>
                <feMerge>
                  <feMergeNode in="blur"></feMergeNode>
                  <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
              </filter>
            </defs>
            <path className="method-wire__bg" id="methodWireBg"></path>
            <path className="method-wire__line" id="methodWireLine"></path>
            <g className="method-wire__nodes" id="methodWireNodes"></g>
            <circle className="method-wire__dot" id="methodWireDot" r="4.5"></circle>
          </svg>
        </div>

          {fields.steps.map((step, index) => (
            <article key={index} className={`method-row${rowLooks[index % rowLooks.length]}`} data-reveal="" data-stagger="">
              <div className="method-visual">
                <div className="method-frame method-frame--photo">
                  {step.image ? <Image mediaId={step.image.mediaId} alt={step.image.alt} decorative={step.image.decorative} sizes="(max-width: 900px) 100vw, 50vw" /> : null}
                </div>
              </div>
              <div className="method-spine-node" aria-hidden="true">
                {step.index ?? String(index + 1)}
              </div>
              <div className="method-copy">
                <div className="method-copy__head">
                  <span className="method-step-num" aria-hidden="true">
                    {step.index ?? String(index + 1)}
                  </span>
                  <h3>{step.title}</h3>
                </div>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
