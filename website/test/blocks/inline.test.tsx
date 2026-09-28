/*
 * Inline text (hero.heading, service_hero.lead, problem.lead): the validator
 * that mirrors the API's InlineText.cs, the renderer, the three components that
 * use it, and the logo bar's repeated marquee.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InlineText, inlinePlainText, inlineTextFrom, inlineTextProblems, type PageKind } from "@digitalhub/blocks";
import type { Section } from "@digitalhub/blocks/generated/schema-types";
import { blockContext } from "../../src/content/blocks";
import { validateContent } from "../../src/content/validate";
import { snapshotContent } from "../helpers";
import { count, instances, render, siteFrom, tags } from "./harness";

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/content/site")>();
  const { snapshotContent: load } = await import("../helpers");
  const site = actual.createSite(load());
  return { ...actual, getSite: () => site };
});

const content = snapshotContent();
const site = siteFrom(content);
const service = content.collections.services[0];

type Node = { type: "text"; text: string; marks?: { type: string; attrs?: Record<string, string> }[] };
const doc = (...nodes: Node[]) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: nodes }] });
const t = (text: string, ...marks: NonNullable<Node["marks"]>): Node => ({ type: "text", text, ...(marks.length ? { marks } : {}) });
const bold = { type: "bold" };
const italic = { type: "italic" };
const ref = (type: string, id: string) => ({ type: "link", attrs: { type, id } });
const fragment = (href: string) => ({ type: "link", attrs: { href } });

describe("inline text: the API's rules", () => {
  const ok = (value: string, allowMarks = true) => inlineTextProblems(value, { allowMarks });

  it("accepts one paragraph of text with bold, italic, reference links and #fragments; and an empty value", () => {
    expect(ok(doc(t("Plain "), t("bold", bold), t(" "), t("both", bold, italic), t(" "), t("a page", ref("service", service.id)), t(" "), t("below", fragment("#services"))))).toEqual([]);
    expect(ok("")).toEqual([]);
    expect(ok(JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }))).toEqual([]);
    expect(ok(inlineTextFrom("Plain text"), false)).toEqual([]);
  });

  it("refuses what the API refuses", () => {
    const cases: [string, RegExp][] = [
      ["Plain text, not a document", /must be a document/],
      [JSON.stringify({ type: "paragraph" }), /must be a document/],
      [JSON.stringify({ type: "doc", content: [{ type: "paragraph" }, { type: "paragraph" }] }), /single paragraph/],
      [JSON.stringify({ type: "doc", content: [{ type: "heading", content: [] }] }), /"heading" is not allowed: this text must be a single paragraph/],
      [JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "hardBreak" }] }] }), /"hardBreak" is not allowed inside this text/],
      [doc(t("x", { type: "code" })), /"code" is not allowed/],
      [doc(t("x", fragment("https://example.com"))), /is not allowed\. Use a content reference, or a #fragment/],
      [doc(t("x", fragment("/about"))), /is not allowed\. Use a content reference/],
      [doc(t("x", fragment("#"))), /is not allowed/],
      [doc(t("x", { type: "link", attrs: { href: "#a", type: "service", id: service.id } })), /both an address and a content reference/],
      [doc(t("x", ref("news", service.id))), /must name a content item/],
      [doc(t("x", ref("service", "not-a-uuid"))), /must carry the item id/],
      [doc(t("x", { type: "link" })), /needs a destination/],
      [JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { class: "x" }, content: [] }] }), /"attrs" is not allowed on paragraph/],
      [doc(t("x".repeat(4100))), /longer than 4096 bytes/],
    ];
    for (const [value, message] of cases) expect(ok(value).join("\n"), value.slice(0, 80)).toMatch(message);
  });

  it("where marks are not allowed, any mark is refused", () => {
    expect(inlineTextProblems(doc(t("x", italic)), { allowMarks: false }).join("\n")).toMatch(/"italic" is not allowed here: this text must be plain/);
  });

  it("the website build refuses content the API would refuse: marks outside a case study, plain strings", () => {
    const copy = snapshotContent();
    const home = copy.pages.find((page) => page.slug === "home")!;
    const hero = home.sections.find((section) => section.type === "hero")! as Extract<Section, { type: "hero" }>;
    hero.fields.heading = doc(t("Your strategy is "), t("right", italic));
    const serviceItem = copy.collections.services[0];
    const serviceHero = serviceItem.sections.find((section) => section.type === "service_hero")! as Extract<Section, { type: "service_hero" }>;
    serviceHero.fields.lead = "A plain string, not a document";
    const problems = validateContent(copy).join("\n");
    expect(problems).toMatch(/pages\/home: section 1 \(hero\) heading: "italic" is not allowed here: this text must be plain/);
    expect(problems).toContain(`services/${serviceItem.slug}: section ${serviceItem.sections.indexOf(serviceHero) + 1} (service_hero) lead: This text must be a document.`);
  });
});

describe("inline text: rendering", () => {
  const ctx = blockContext(site, { kind: "service", slug: service.slug });
  const html = (value: string) => renderToStaticMarkup(<InlineText value={value} ctx={ctx} />);

  it("renders bold, italic, and links as elements, every link with class accent", () => {
    expect(html(doc(t("We "), t("build", bold), t(" "), t("well", italic), t(" "), t("fast", bold, italic)))).toBe("We <strong>build</strong> <em>well</em> <strong><em>fast</em></strong>");
    expect(html(doc(t("See "), t("our work", fragment("#services")), t(".")))).toBe('See <a href="#services" class="accent">our work</a>.');
    expect(html(doc(t("Read "), t(service.title, ref("service", service.id))))).toBe(`Read <a href="${service.path}" class="accent">${service.title.replace(/&/g, "&amp;")}</a>`);
  });

  it("keeps consecutive parts of one link in one <a>", () => {
    expect(html(doc(t("one ", fragment("#x")), t("two", bold, fragment("#x")), t(" three", fragment("#y"))))).toBe(
      '<a href="#x" class="accent">one <strong>two</strong></a><a href="#y" class="accent"> three</a>',
    );
  });

  it("an unpublished reference keeps its text without a link; an invalid value renders nothing; text is escaped", () => {
    expect(html(doc(t("gone", ref("service", "00000000-0000-4000-8000-000000000000"))))).toBe("gone");
    expect(html("<b>not a document</b>")).toBe("");
    expect(html(doc(t("a < b & c")))).toBe("a &lt; b &amp; c");
    expect(inlinePlainText(doc(t("a "), t("b", bold)))).toBe("a b");
  });
});

/** A snapshot section of a type, with some fields replaced, rendered where it lives. */
function renderWith(type: Section["type"], path: string, fields: Record<string, unknown>): string {
  const instance = instances(site, type).find((entry) => entry.path === path)!;
  const section = { ...instance.section, fields: { ...instance.section.fields, ...fields } } as Section;
  return render(site, section, instance as { kind: PageKind; slug: string });
}

describe("components with inline text", () => {
  it("case study hero: the heading keeps its emphasis, as on the old page", () => {
    const out = renderWith("hero", "/cases/ministry-planning", { heading: doc(t("3+ years powering Egypt’s "), t("national planning systems", italic)) });
    expect(out).toContain('<h1 class="cs-hero__title">3+ years powering Egypt’s <em>national planning systems</em></h1>');
  });

  it("service hero: the lede keeps its strong clause", () => {
    const out = renderWith("service_hero", "/services/ai-automation", { lead: doc(t("We design AI agents that think, act and scale: "), t("digital co-workers", bold), t(" in your workflows.")) });
    expect(out).toContain('<p class="svc-lede">We design AI agents that think, act and scale: <strong>digital co-workers</strong> in your workflows.</p>');
  });

  it("service problem: the lead ends in an accent link to the services section", () => {
    const out = renderWith("problem", "/services/ai-automation", { lead: doc(t("Most organizations stall. "), t("That's where we come in", fragment("#services")), t(".")) });
    expect(out).toContain('<header class="problem-lead" data-reveal="">');
    expect(out).toMatch(/<p>Most organizations stall\. <a href="#services" class="accent">That(&#x27;|')s where we come in<\/a>\.<\/p>/);
  });

  it("an empty lead renders no paragraph", () => {
    expect(renderWith("service_hero", "/services/ai-automation", { lead: inlineTextFrom("") })).not.toContain("svc-lede");
  });

  it("home hero: the heading's plain text is split into its animated lines", () => {
    const out = renderWith("hero", "/", { heading: inlineTextFrom("Your strategy is right. Your systems are holding it back.") });
    expect(count(out, ".h1-line")).toBe(2);
    expect(out).toContain("Your strategy is right.");
  });
});

describe("logo bar", () => {
  it("renders each stored logo twice for the marquee: once announced, once hidden with an empty alt", () => {
    const [instance] = instances(site, "logo_bar");
    const stored = (instance.section.fields as { logos: { mediaId: string; alt: string; decorative: boolean }[] }).logos;
    const once = stored.filter((logo, index) => stored.findIndex((other) => other.mediaId === logo.mediaId) === index && !logo.decorative);
    const out = render(site, { ...instance.section, fields: { ...instance.section.fields, logos: once } } as Section, instance);
    const items = tags(out).filter((tag) => tag.name === "span" && (tag.attrs.get("class") ?? "").split(" ").includes("trust-item"));
    const images = tags(out).filter((tag) => tag.name === "img");
    expect(items).toHaveLength(once.length * 2);
    expect(images).toHaveLength(once.length * 2);
    items.forEach((item, index) => expect(item.attrs.get("aria-hidden")).toBe(index < once.length ? undefined : "true"));
    images.forEach((image, index) => {
      expect(image.attrs.get("alt")).toBe(index < once.length ? once[index].alt : "");
      expect(image.attrs.get("class")).toBe("trust-item__logo");
    });
    // The same logos, in the same order, in both copies.
    expect(images.slice(once.length).map((image) => image.attrs.get("src"))).toEqual(images.slice(0, once.length).map((image) => image.attrs.get("src")));
  });
});
