import { describe, expect, it } from "vitest";
import { allItems, buildRoutes, RouteError } from "../src/content/routes";
import { createSite } from "../src/content/site";
import { snapshotContent } from "./helpers";

describe("routes", () => {
  it("route every published item that has a path, at exactly that path", () => {
    const content = snapshotContent();
    const { routes } = buildRoutes(content);
    const withPaths = allItems(content).filter((item) => item.path !== null);
    // Only the three listed articles are published; HTML-only posts stay drafts.
    expect(content.collections['blog-posts']).toHaveLength(3);
    expect(routes).toHaveLength(25);
    expect(routes.map((route) => route.path).sort()).toEqual(withPaths.map((item) => item.path).sort());
    for (const route of routes) expect(route.item.path).toBe(route.path);
  });

  it("cover every page type in the snapshot", () => {
    const types = new Set(buildRoutes(snapshotContent()).routes.map((route) => route.pageType));
    expect([...types].sort()).toEqual(["blog-post", "case-study", "home", "page", "partner", "service"]);
  });

  it("route vacancies at /careers/<slug> alongside /careers/apply", () => {
    const content = snapshotContent();
    const template = content.collections["case-studies"][0];
    content.collections.vacancies = [{ ...template, id: "00000000-0000-0000-0000-000000000001", collection: "vacancies", slug: "engineer", path: "/careers/engineer", sections: [], fields: {} }] as never;
    content.counts.vacancies = 1;
    const paths = buildRoutes(content).routes.filter((route) => route.path.startsWith("/careers")).map((route) => [route.path, route.pageType]);
    expect(paths).toEqual([["/careers", "page"], ["/careers/apply", "page"], ["/careers/engineer", "vacancy"]]);
  });

  it("give team members, news items, and error pages no page of their own", () => {
    const content = snapshotContent();
    const { routes, skipped } = buildRoutes(content);
    expect(skipped.map((entry) => entry.collection).sort()).toEqual([...Array(3).fill("news-items"), ...Array(6).fill("team-members")]);
    expect(routes.some((route) => route.item.slug.startsWith("error-"))).toBe(false);
  });

  it("never route an item that was not published", () => {
    const content = snapshotContent();
    const draft = content.collections["blog-posts"][0];
    draft.publishedAt = null;
    const { routes, skipped } = buildRoutes(content);
    expect(routes.some((route) => route.path === draft.path)).toBe(false);
    expect(skipped).toContainEqual({ collection: "blog-posts", slug: draft.slug, reason: "not published" });
  });

  it("use clean URLs only", () => {
    for (const bad of ["/about.html", "/About", "/about/", "about", "/a b", "/blogs//x"]) {
      const content = snapshotContent();
      content.pages[1].path = bad;
      expect(() => buildRoutes(content), bad).toThrow(/is not a clean URL path/);
    }
  });

  it("refuse two items claiming one path", () => {
    const content = snapshotContent();
    content.collections.services[1].path = content.collections.services[0].path;
    expect(() => buildRoutes(content)).toThrow(/both claim "\/services\//);
  });

  it("refuse paths the site reserves", () => {
    for (const reserved of ["/media", "/_next/x", "/api/v1", "/404", "/500"]) {
      const content = snapshotContent();
      content.pages[1].path = reserved;
      expect(() => buildRoutes(content), reserved).toThrow(RouteError);
    }
  });

  it("need a published home page", () => {
    const content = snapshotContent();
    content.pages = content.pages.filter((page) => page.path !== "/");
    expect(() => buildRoutes(content)).toThrow(/no published home page/);
  });
});

describe("site lookups", () => {
  it("find a route by the segments Next passes, including the home page", () => {
    const site = createSite(snapshotContent());
    expect(site.routeFor(undefined)?.pageType).toBe("home");
    expect(site.routeFor([])?.pageType).toBe("home");
    expect(site.routeFor(["services", "ai-automation"])?.item.slug).toBe("ai-automation");
    expect(site.routeFor(["services", "missing"])).toBeUndefined();
  });

  it("resolve a reference to a published item, and nothing else", () => {
    const content = snapshotContent();
    const site = createSite(content);
    const partner = content.collections.partners[0];
    expect(site.resolve({ type: "partner", id: partner.id })).toBe(partner.path);
    expect(site.resolve({ type: "partner", id: "00000000-0000-0000-0000-000000000000" })).toBeNull();
    expect(site.resolve(null)).toBeNull();
  });
});
