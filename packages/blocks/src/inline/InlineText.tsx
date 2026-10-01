/*
 * Renders an inline-text value as React elements, never an HTML string: bold
 * as <strong>, italic as <em>, links as <a class="accent"> — the old pages'
 * inline link style. A link to a content item renders only if the item is
 * published; otherwise its text renders without a link (4.4). A #fragment
 * renders as it is. Consecutive parts with the same link share one <a>.
 */
import { Fragment, type ReactNode } from "react";
import type { BlockContext } from "../context";
import { parseInlineText, type InlineLink, type InlinePart } from "./document";

const sameLink = (a: InlineLink | null, b: InlineLink | null) => JSON.stringify(a) === JSON.stringify(b);

function styled(part: InlinePart): ReactNode {
  let out: ReactNode = part.text;
  if (part.italic) out = <em>{out}</em>;
  if (part.bold) out = <strong>{out}</strong>;
  return out;
}

export function InlineText({ value, ctx }: { value: string | null | undefined; ctx: BlockContext }) {
  const parts = parseInlineText(value);
  const runs: { link: InlineLink | null; parts: InlinePart[] }[] = [];
  for (const part of parts) {
    const last = runs[runs.length - 1];
    if (last && sameLink(last.link, part.link)) last.parts.push(part);
    else runs.push({ link: part.link, parts: [part] });
  }
  return (
    <>
      {runs.map((run, index) => {
        const children = run.parts.map((part, partIndex) => <Fragment key={partIndex}>{styled(part)}</Fragment>);
        const href = run.link === null ? null : "href" in run.link ? run.link.href : ctx.resolve(run.link);
        return href ? (
          <ctx.Link key={index} href={href} className="accent">
            {children}
          </ctx.Link>
        ) : (
          <Fragment key={index}>{children}</Fragment>
        );
      })}
    </>
  );
}
