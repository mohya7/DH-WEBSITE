/*
 * 4.6 — a test per section component, rendering the snapshot's own sections
 * (every instance of every type on every published page) through <Section>,
 * with the website's adapters. Each must render one <section>, carry the ids
 * and classes the ported scripts read (Section 3's script-dependency table),
 * and agree with sectionRenders about whether it renders anything. Elements a
 * ported script creates itself (.eswd-menu__media in service-page.js,
 * .news-carousel__dot in index.inline-5.js) are not in the old HTML either.
 *
 * The markup itself is compared element for element with the old pages after
 * their runtime ran; that comparison is reported in the pull request.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sectionRenders, type PageKind } from "@digitalhub/blocks";
import { sectionTypes, type SectionType } from "@digitalhub/blocks/generated/schema-types";
import { mainSections } from "../../scripts/check-output";
import { blockContext } from "../../src/content/blocks";
import type { BuildContent } from "../../src/content/build-content";
import { snapshotContent } from "../helpers";
import { count, instances, missing, render, siteFrom, withoutPreloads, type Instance } from "./harness";

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/content/site")>();
  const { snapshotContent: load } = await import("../helpers");
  const site = actual.createSite(load());
  return { ...actual, getSite: () => site };
});

type Expect = (instance: Instance) => string[];
const on = (paths: Record<string, string[]>, otherwise: string[] = []): Expect => (instance) => paths[instance.path] ?? otherwise;
const byKind = (kinds: Partial<Record<PageKind, string[]>>): Expect => (instance) => kinds[instance.kind] ?? [];

/**
 * What each type must render, by page: its root, and every id and selector from
 * the script-dependency table that it provides. A type with no instance in the
 * snapshot (faq) is tested with its own data below.
 */
const expectations: Record<SectionType, Expect> = {
  blog_list: on({
    "/": ["section.section.blogs#blogs[data-section-reveal]", "#blogsCarousel", "#blogsViewport", "#blogsTrack", "#blogsPrev", "#blogsNext", ".blog-dest"],
    "/blogs": ["section.hub-section", ".hub-filters", ".hub-filter", "[data-category]"],
  }),
  call_to_action: byKind({
    partner: ["section.section.hub-cta[data-section-reveal]"],
    page: ["section.hub-cta"],
    "case-study": ["section.section", ".cs-cta", ".btn-primary"],
  }),
  case_cards: on(
    {
      "/": ["section.section.cases#cases[data-section-reveal]"],
      "/cases": ["section.hub-section", ".hub-filters", ".hub-filter", "[data-category]"],
    },
    ["section.section.cases#cases"],
  ),
  contact_details: () => ["section.contact-page#contact"],
  delivery_flow: () => ["section.section.delivery-flow#delivery[data-section-reveal]"],
  faq: () => [],
  feature_grid: () => [
    "section.eswd-section#services", "#eswdDeck", "#eswdStage", "#eswdMenu", "#eswdProgressBar", "#eswdSceneNum", "#eswdSceneName", "#eswdStageGlow",
    ".eswd-scene", ".eswd-menu__item", ".eswd-menu__title", ".eswd-deck__progress", ".eswd-scene__label", ".eswd-scene__photo",
  ],
  hero: on({ "/": ["section#top", "#heroSandCanvas", "#heroFluidCanvas", ".h1-wrap", ".h1-line", "h1"] }, ["section", "h1"]),
  hub_hero: on({ "/careers/apply": ["section.hub-hero", "h1", "[data-careers-apply-lead]"] }, ["section.hub-hero", "h1"]),
  // The table lists [data-feature-block] under feature_grid; on the old pages it is on the industry cards.
  industries: () => ["section.industries#industries", "article.industry-card[data-feature-block]"],
  logo_bar: on({ "/": ["section.trust-logos[data-section-reveal]"], "/about": ['section.trust-logos[aria-label="Clients"]'] }),
  methodology: () => ["section.method#method", "#methodRows", "#methodWire", "#methodWireLine", "#methodWireBg", "#methodWireDot", "#methodWireNodes", ".method-wire-wrap", ".method-row", ".method-spine-node", ".method-frame"],
  news_carousel: on({
    "/": ["section.section.news#news", "#newsCarousel", "#newsViewport", "#newsTrack", "#newsPrev", "#newsNext", "#newsDots", ".news-slide"],
    "/news": ["section.hub-section", ".news-hub-grid", ".news-hub-item", ".news-slide__details", ".news-slide__panel"],
  }),
  partner_focus: () => ["section.section.partner-focus[data-section-reveal]"],
  partner_grid: on({ "/": ["section.section.partners#partners[data-section-reveal]"], "/partners": ["section.hub-section[data-section-reveal]"] }),
  partner_overview: () => ["section.partner-view-body[data-section-reveal]", ".partner-overview"],
  pillars: () => ["section.section.about-pillars#mission"],
  problem: byKind({
    service: ["section.problem#problem", "#problemPipeline", "#problemPipelineStatus", ".pp-card", ".pp-canvas", ".pp-node", ".pp-conn__line", ".pp-conn__break"],
    "case-study": ["section.section", ".cs-section[data-reveal]", "h2.h2"],
  }),
  profile: () => ["section.section.about-ceo#ceo"],
  related_items: byKind({ partner: ["section.section.partner-view-related[data-section-reveal]"], "case-study": ["section.section", ".cs-related"] }),
  rich_text: () => ["section.section", ".cs-section[data-reveal]", "h2.h2"],
  service_cards: on({
    "/": ["section.section.services#services", "#servicesScroll", "#servicesPin", "#servicesTrack", ".services-viewport", ".svc-card"],
    "/about": ["section.section.about-services#services", "#aboutConstellation", ".pp-canvas", ".pp-node", ".pp-conn__line"],
  }),
  service_hero: () => ["section.hero#top", "h1"],
  stats: on({ "/": ["section.section.numbers#numbers", ".numbers-row", ".stat-num[data-count]"], "/about": ["section.numbers#stats", ".numbers-row", ".stat-num[data-count]"] }),
  team_grid: () => [
    "section.section.about-leaders#leadership", "#teamStrip", "#teamStripViewport", "#teamStripInner", "#teamStripProgress", "#teamStripPrev", "#teamStripNext",
    ".team-strip__item", ".team-card__action",
  ],
  timeline: () => ["section.section.about-history#history", "#jtlWrap", ".jtl-item", ".jtl-slide", ".jtl-track", ".jtl-line", ".jtl-line__fill", ".jtl-dot", ".jtl-item__btn", ".jtl-visual"],
  vacancy_list: () => ["section.section.careers-opps#opportunities", ".careers-opps__list"],
  values: () => ["section.section.careers-values"],
};

const content = snapshotContent();
const site = siteFrom(content);

/** Renders and checks the shape every section shares: nothing, or exactly one <section>. */
function renderChecked(from: ReturnType<typeof siteFrom>, instance: Instance): string {
  const html = withoutPreloads(render(from, instance.section, instance));
  const renders = sectionRenders(instance.section, blockContext(from, instance));
  if (!renders) {
    expect(html, `${instance.path} ${instance.section.type}`).toBe("");
    return html;
  }
  expect(html.startsWith("<section") && html.endsWith("</section>"), `${instance.path} ${instance.section.type} is one <section>`).toBe(true);
  expect(mainSections(`<main>${html}</main>`), `${instance.path} ${instance.section.type} is one <section>`).toBe(1);
  return html;
}

describe("section components", () => {
  it("cover every section type in packages/sections", () => {
    expect(Object.keys(expectations).sort()).toEqual([...sectionTypes].sort());
    expect(sectionTypes).toHaveLength(28);
  });

  for (const type of sectionTypes.filter((name) => name !== "faq")) {
    it(`${type}: renders every snapshot instance with the markup the ported scripts read`, () => {
      const found = instances(site, type);
      expect(found.length, `the snapshot has a ${type} section`).toBeGreaterThan(0);
      for (const instance of found) {
        const html = renderChecked(site, instance);
        expect(missing(html, expectations[type](instance)), `${instance.path} #${instance.index}`).toEqual([]);
      }
    });
  }

  it("faq: renders the old blog-post FAQ markup, first item open, and nothing without complete items", () => {
    const section = { type: "faq" as const, fields: { items: [{ question: "Q1 & more", answer: "A1" }, { question: "Q2", answer: "A2" }, { question: "", answer: "dropped" }] } };
    const instance = { path: "/about", kind: "page" as const, slug: "about", index: 0, section };
    const html = renderChecked(site, instance);
    expect(html).toBe(
      '<section class="blog-view-faq" aria-label="Frequently asked questions"><h2>FAQ</h2>' +
        '<details class="blog-view-faq__item" open=""><summary>Q1 &amp; more</summary><div class="blog-view-faq__answer"><p>A1</p></div></details>' +
        '<details class="blog-view-faq__item"><summary>Q2</summary><div class="blog-view-faq__answer"><p>A2</p></div></details></section>',
    );
    expect(renderChecked(site, { ...instance, section: { type: "faq", fields: { items: [] } } })).toBe("");
  });
});

/**
 * The snapshot with one collection's items replaced, as if the others were
 * unpublished: they leave the collection and the reference table, so a
 * reference to them no longer resolves.
 */
function withCollection(name: keyof BuildContent["collections"], items: unknown[]): BuildContent {
  const copy = snapshotContent();
  const collections = copy.collections as Record<string, { id: string }[]>;
  const kept = new Set((items as { id: string }[]).map((item) => item.id));
  const gone = new Set(collections[name].filter((item) => !kept.has(item.id)).map((item) => item.id));
  collections[name] = items as { id: string }[];
  const references = copy.references as Record<string, string>;
  for (const key of Object.keys(references)) if (gone.has(key.slice(key.indexOf(":") + 1))) delete references[key];
  return copy;
}

describe("team grid", () => {
  it("uses each portrait's stored alt text, or the member's override, not the name and role", () => {
    const [instance] = instances(site, "team_grid");
    const members = content.collections["team-members"];
    const media = new Map(content.media.map((asset) => [asset.id, asset]));
    const alts = (html: string) => [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map((match) => match[1].replace(/&amp;/g, "&"));
    const stored = members.map((member) => media.get((member.fields as { imageId: string }).imageId)!.alt);
    expect(stored[0]).toBe("Kareem Adel, CEO of Digital Hub");
    expect(alts(renderChecked(site, instance))).toEqual(stored);

    const copy = snapshotContent();
    (copy.collections["team-members"][0].fields as { imageAltOverride?: string }).imageAltOverride = "Kareem Adel speaking";
    expect(alts(renderChecked(siteFrom(copy), instance))[0]).toBe("Kareem Adel speaking");
  });
});

describe("references (4.4)", () => {
  it("related items whose target is not published render nothing; a section with none left renders nothing", () => {
    const partners = content.collections.partners;
    const [kept, ...dropped] = partners;
    const fewer = siteFrom(withCollection("partners", [kept]));
    for (const instance of instances(site, "related_items").filter((entry) => entry.kind === "partner")) {
      const html = renderChecked(fewer, instance);
      const before = count(renderChecked(site, instance), "a.partner-card-hub");
      const targets = (instance.section.fields as { items: { type: string; id: string }[] }).items;
      const live = targets.filter((ref) => ref.type === "partner" && ref.id === kept.id).length;
      expect(count(html, "a.partner-card-hub")).toBe(live);
      expect(before).toBeGreaterThanOrEqual(live);
      for (const partner of dropped) expect(html).not.toContain(`>${partner.title}<`);
    }
  });

  it("a service page's case card whose case study is not published renders nothing", () => {
    const none = siteFrom(withCollection("case-studies", []));
    for (const instance of instances(site, "case_cards").filter((entry) => entry.kind === "service")) {
      expect(count(renderChecked(site, instance), "article")).toBeGreaterThanOrEqual(0);
      expect(renderChecked(none, instance)).toBe("");
    }
  });

  it("every link a section renders points at a published path, a page anchor, or an external address", () => {
    const published = new Set(site.routes.map((route) => route.path));
    for (const type of sectionTypes) {
      for (const instance of instances(site, type)) {
        for (const match of render(site, instance.section, instance).matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
          const href = match[1].replace(/&amp;/g, "&");
          const local = href.startsWith("/") ? href.split(/[?#]/)[0] : null;
          const ok = local === null ? /^(https?:|mailto:|tel:|#)/.test(href) : published.has(local) || /^\/(media|design|assets)\//.test(local);
          expect(ok, `${instance.path} ${type}: ${href}`).toBe(true);
        }
      }
    }
  });
});

describe("listing sections (4.5)", () => {
  it("case cards render nothing on home and the cases hub when no case study is published", () => {
    const none = siteFrom(withCollection("case-studies", []));
    for (const instance of instances(site, "case_cards").filter((entry) => entry.kind === "page" || entry.kind === "home")) {
      expect(count(renderChecked(site, instance), "[data-category]") + count(renderChecked(site, instance), "a")).toBeGreaterThan(0);
      expect(renderChecked(none, instance)).toBe("");
    }
  });

  it("the blog list renders nothing when no post is published", () => {
    const none = siteFrom(withCollection("blog-posts", []));
    for (const instance of instances(site, "blog_list")) {
      expect(renderChecked(site, instance)).not.toBe("");
      expect(renderChecked(none, instance)).toBe("");
    }
  });

  it("the vacancy list shows its empty-state message with no vacancy, and the vacancies when there are some", () => {
    const [instance] = instances(site, "vacancy_list");
    const fields = instance.section.fields as { emptyMessage: string };
    const none = siteFrom(withCollection("vacancies", []));
    const empty = renderChecked(none, instance);
    expect(empty).toContain(`<div class="careers-opps__list" data-reveal=""><p>${fields.emptyMessage}</p></div>`);

    const vacancy = {
      ...(content.collections.services[0] as object),
      id: "7d0c1f4e-0000-4000-8000-000000000001",
      collection: "vacancies",
      slug: "test-role",
      title: "Test Role",
      path: "/careers/test-role",
      fields: { department: "Engineering", employmentType: "Full-time", location: "Cairo" },
      sections: [],
    };
    const one = renderChecked(siteFrom(withCollection("vacancies", [vacancy])), instance);
    expect(one).not.toContain(fields.emptyMessage);
    expect(one).toContain('<article class="careers-job-card"><div><h3>Test Role</h3><p class="cms-job-meta">Engineering · Full-time · Cairo</p></div>');
  });
});

describe("packages/blocks (4.2, 4.3)", () => {
  const root = path.join(process.cwd(), "..", "packages", "blocks", "src");
  const files: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push({ file: path.relative(root, full), text: fs.readFileSync(full, "utf8") });
    }
  };
  walk(root);

  it("imports nothing from Next and nothing from the website: only React and its own files", () => {
    for (const { file, text } of files) {
      for (const match of text.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
        expect(match[1] === "react" || match[1].startsWith("."), `${file} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it("never sets HTML from a string", () => {
    for (const { file, text } of files) expect(text, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});
