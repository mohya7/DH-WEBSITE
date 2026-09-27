/*
 * The labelled prose block on case-study pages (.cs-section): used by the
 * case-study problem ("Challenge") and rich_text ("Solution", "Results").
 */
import type { ReactNode } from "react";
import type { Block } from "../generated/schema-types";

export function Prose({ eyebrow, heading, blocks, children }: { eyebrow?: string; heading: string; blocks?: Block[]; children?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-inner cs-section" data-reveal="">
        {eyebrow ? <span className="label">{eyebrow}</span> : null}
        <h2 className="h2">{heading}</h2>
        {(blocks ?? []).map((block, index) =>
          block.kind === "paragraph" ? (
            <p key={index}>{block.text}</p>
          ) : (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          ),
        )}
        {children}
      </div>
    </section>
  );
}
