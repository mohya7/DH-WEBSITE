/*
 * faq: no page on the old site has an FAQ section, so this uses the one FAQ
 * design it has — the blog-post FAQ (renderFaq in scripts/blog-pages.js,
 * styled by .blog-view-faq in hub-pages.css): the same markup, first item open.
 * Entries without a question or an answer are skipped; none left renders nothing.
 */
import type { BlockContext } from "../context";
import type { FaqFields } from "../generated/schema-types";
import { faqItems } from "../select";

export function Faq({ fields }: { fields: FaqFields; ctx: BlockContext }) {
  const items = faqItems(fields);
  if (items.length === 0) return null;
  return (
    <section className="blog-view-faq" aria-label="Frequently asked questions">
      <h2>FAQ</h2>
      {items.map((item, index) => (
        <details className="blog-view-faq__item" open={index === 0} key={index}>
          <summary>{item.question}</summary>
          <div className="blog-view-faq__answer">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </section>
  );
}
