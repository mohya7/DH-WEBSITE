/*
 * 4.3 — rich text: TipTap JSON to React elements, allowed nodes only, and
 * table-of-contents anchors unique per article. Rendered with the website's
 * adapters; the snapshot's published blog bodies are rendered too.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { headingAnchors, parseRichText, RichText, slugify, type RichDocument, type RichNode } from "@digitalhub/blocks";
import { blockContext } from "../../src/content/blocks";
import { snapshotContent } from "../helpers";
import { siteFrom, tags } from "./harness";

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/content/site")>();
  const { snapshotContent: load } = await import("../helpers");
  const site = actual.createSite(load());
  return { ...actual, getSite: () => site };
});

const content = snapshotContent();
const site = siteFrom(content);
const ctx = blockContext(site, { kind: "blog-post", slug: "x" });
const html = (doc: RichDocument | null) => renderToStaticMarkup(<RichText doc={doc} ctx={ctx} />);
const doc = (...nodes: RichNode[]): RichDocument => ({ type: "doc", content: nodes });
const text = (value: string, marks?: RichNode["marks"]): RichNode => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const p = (...nodes: RichNode[]): RichNode => ({ type: "paragraph", content: nodes });
const h = (level: number, value: string): RichNode => ({ type: "heading", attrs: { level }, content: [text(value)] });

describe("rich text", () => {
  it("renders every allowed node as its element", () => {
    const media = content.media[0];
    const out = html(
      doc(
        h(2, "Intro"),
        p(text("Plain "), text("bold", [{ type: "bold" }]), text(" "), text("italic", [{ type: "italic" }]), text(" "), text("code", [{ type: "code" }])),
        h(3, "Lists"),
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("one"))] }] },
        { type: "orderedList", content: [{ type: "listItem", content: [p(text("first"))] }] },
        { type: "blockquote", content: [p(text("quoted"))] },
        { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1 < 2;")] },
        h(4, "Table"),
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2 }, content: [p(text("Head"))] }] },
            { type: "tableRow", content: [{ type: "tableCell", content: [p(text("A"))] }, { type: "tableCell", attrs: { rowspan: 1 }, content: [p(text("B"))] }] },
          ],
        },
        { type: "image", attrs: { mediaId: media.id, alt: "A picture" } },
      ),
    );
    expect(out).toContain('<h2 id="intro">Intro</h2>');
    expect(out).toContain("<p>Plain <strong>bold</strong> <em>italic</em> <code>code</code></p>");
    expect(out).toContain('<h3 id="lists">Lists</h3><ul><li><p>one</p></li></ul><ol><li><p>first</p></li></ol><blockquote><p>quoted</p></blockquote>');
    expect(out).toContain('<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>');
    expect(out).toContain('<table><tbody><tr><th colSpan="2"><p>Head</p></th></tr><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>');
    const [img] = tags(out).filter((tag) => tag.name === "img");
    expect(img.attrs.get("src")).toBe(media.path);
    expect(img.attrs.get("alt")).toBe("A picture");
    expect(img.attrs.get("width")).toBe(String(media.width));
  });

  it("renders nothing for a node that is not allowed, or not allowed where it is, and ignores attributes it does not know", () => {
    const out = html(
      doc(
        { type: "horizontalRule" },
        { type: "iframe", attrs: { src: "https://example.com" } } as RichNode,
        { type: "heading", attrs: { level: 1, onclick: "x" }, content: [text("Level one becomes h2")] },
        p({ type: "heading", attrs: { level: 2 }, content: [text("nested heading")] }, text("kept")),
        { type: "bulletList", content: [p(text("paragraph straight in a list"))] },
        { type: "image", attrs: { src: "https://evil.example/x.png", alt: "no media id" } },
        { type: "paragraph", attrs: { style: "color:red", class: "x" }, content: [text("styled")] },
      ),
    );
    expect(out).toBe('<h2 id="level-one-becomes-h2">Level one becomes h2</h2><p>kept</p><ul></ul><p>styled</p>');
  });

  it("links: an internal { type, id } to its published path; an unpublished target keeps its text without a link", () => {
    const service = content.collections.services[0];
    const out = html(
      doc(
        p(
          text("live", [{ type: "link", attrs: { type: "service", id: service.id } }]),
          text(" "),
          text("gone", [{ type: "link", attrs: { type: "service", id: "00000000-0000-4000-8000-000000000000" } }]),
        ),
      ),
    );
    expect(out).toBe(`<p><a href="${service.path}">live</a> gone</p>`);
  });

  it("links: external only http, https, mailto, and tel; anything else keeps its text without a link", () => {
    const link = (href: string) => text(href, [{ type: "link", attrs: { href } }]);
    const safe = ["https://example.com/a?b=1", "http://example.com", "mailto:hello@example.com", "tel:+201000000000"];
    for (const href of safe) expect(html(doc(p(link(href))))).toBe(`<p><a href="${href.replace(/&/g, "&amp;")}">${href}</a></p>`);
    const unsafe = ["javascript:alert(1)", " JavaScript:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.example", "/relative", ""];
    for (const href of unsafe) expect(html(doc(p(link(href)))), JSON.stringify(href)).not.toContain("<a");
  });

  it("anchors: from heading text, apostrophes dropped, unique within the article", () => {
    const article = doc(h(2, "Why it matters"), h(3, "Egypt’s data"), h(2, "Why it matters"), h(2, "Why it matters"), h(2, "1. Critical reports — weekly!"), h(2, "!!!"));
    expect(headingAnchors(article).map((anchor) => anchor.id)).toEqual(["why-it-matters", "egypts-data", "why-it-matters-2", "why-it-matters-3", "1-critical-reports-weekly", "section"]);
    const ids = tags(html(article)).flatMap((tag) => (tag.attrs.get("id") ? [tag.attrs.get("id")] : []));
    expect(ids).toEqual(headingAnchors(article).map((anchor) => anchor.id));
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("an empty, invalid, or non-document body renders nothing", () => {
    for (const value of [null, "", "  ", "not json", '{"type":"paragraph"}', "[]"]) expect(html(parseRichText(value))).toBe("");
  });

  it("renders every published blog body in the snapshot with unique heading ids and no raw HTML", () => {
    for (const post of content.collections["blog-posts"]) {
      const body = parseRichText((post.fields as { body?: string }).body);
      expect(body, post.slug).not.toBeNull();
      const out = html(body);
      const ids = tags(out).flatMap((tag) => (tag.attrs.get("id") ? [tag.attrs.get("id")!] : []));
      expect(new Set(ids).size, post.slug).toBe(ids.length);
      expect(ids.length, post.slug).toBe(headingAnchors(body).length);
      expect(out, post.slug).not.toMatch(/<(script|style|iframe|h1)\b/);
    }
  });
});
