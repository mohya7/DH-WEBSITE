/*
 * Renders a TipTap document as React elements — never an HTML string. Allowed
 * nodes only: paragraph, headings h2–h4, bold, italic, code, links, bullet and
 * ordered lists, blockquote, images from the media library, tables, and code
 * blocks, each only where the API allows it. Anything else renders nothing.
 * Only the allowed attributes are read.
 *
 * Links: an internal link is { type, id } and renders only if its target is
 * published; otherwise its text renders without a link. An external link must
 * be http, https, mailto, or tel.
 */
import { Fragment, type ReactNode } from "react";
import type { BlockContext } from "../context";
import { headingAnchors, headingLevel } from "./anchors";
import { allowedHere, type RichDocument, type RichMark, type RichNode } from "./document";

const safeScheme = /^(https?:|mailto:|tel:)/i;

function linkHref(mark: RichMark, ctx: BlockContext): string | null {
  const attrs = mark.attrs ?? {};
  if (typeof attrs.type === "string" && typeof attrs.id === "string") return ctx.resolve({ type: attrs.type, id: attrs.id });
  const href = typeof attrs.href === "string" ? attrs.href.trim() : "";
  return safeScheme.test(href) ? href : null;
}

function span(int: number): number | undefined {
  return Number.isInteger(int) && int > 1 ? int : undefined;
}

export function RichText({ doc, ctx }: { doc: RichDocument | null; ctx: BlockContext }) {
  if (!doc) return null;
  const anchors = headingAnchors(doc);
  let heading = 0;

  const text = (node: RichNode, key: number): ReactNode => {
    let out: ReactNode = node.text ?? "";
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") out = <strong>{out}</strong>;
      else if (mark.type === "italic") out = <em>{out}</em>;
      else if (mark.type === "code") out = <code>{out}</code>;
      else if (mark.type === "link") {
        const href = linkHref(mark, ctx);
        if (href) out = <ctx.Link href={href}>{out}</ctx.Link>;
      }
    }
    return <Fragment key={key}>{out}</Fragment>;
  };

  const children = (node: RichNode): ReactNode[] =>
    (node.content ?? []).map((child, index) => (allowedHere(node.type, child.type) ? render(child, index) : null));

  const render = (node: RichNode, key: number): ReactNode => {
    switch (node.type) {
      case "text":
        return text(node, key);
      case "paragraph":
        return <p key={key}>{children(node)}</p>;
      case "heading": {
        const anchor = anchors[heading++];
        const Tag = `h${headingLevel(node)}` as "h2" | "h3" | "h4";
        return (
          <Tag key={key} id={anchor?.id}>
            {children(node)}
          </Tag>
        );
      }
      case "bulletList":
        return <ul key={key}>{children(node)}</ul>;
      case "orderedList":
        return <ol key={key}>{children(node)}</ol>;
      case "listItem":
        return <li key={key}>{children(node)}</li>;
      case "blockquote":
        return <blockquote key={key}>{children(node)}</blockquote>;
      case "codeBlock": {
        const language = typeof node.attrs?.language === "string" && /^[a-z0-9+#-]+$/i.test(node.attrs.language) ? node.attrs.language : undefined;
        return (
          <pre key={key}>
            <code className={language ? `language-${language}` : undefined}>{children(node)}</code>
          </pre>
        );
      }
      case "image": {
        const attrs = node.attrs ?? {};
        if (typeof attrs.mediaId !== "string") return null;
        return <ctx.Image key={key} mediaId={attrs.mediaId} alt={typeof attrs.alt === "string" ? attrs.alt : ""} decorative={attrs.decorative === true} sizes="(max-width: 900px) 100vw, 760px" />;
      }
      case "table":
        return (
          <table key={key}>
            <tbody>{children(node)}</tbody>
          </table>
        );
      case "tableRow":
        return <tr key={key}>{children(node)}</tr>;
      case "tableCell":
      case "tableHeader": {
        const Cell = node.type === "tableHeader" ? "th" : "td";
        return (
          <Cell key={key} colSpan={span(Number(node.attrs?.colspan))} rowSpan={span(Number(node.attrs?.rowspan))}>
            {children(node)}
          </Cell>
        );
      }
      default:
        return null;
    }
  };

  return <>{children(doc)}</>;
}
