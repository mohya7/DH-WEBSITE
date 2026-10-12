/*
 * Listings read the published collections from the site. A draft in the
 * prepared content must not appear on the home page, the blogs page, careers,
 * or the apply page's vacancy data.
 */
import { describe, expect, it } from "vitest";
import type { ContentItem } from "../src/content/build-content";
import { snapshotContent } from "./helpers";
import { instances, render, siteFrom } from "./blocks/harness";

const draftPost = {
  id: "draft-post",
  collection: "blog-posts",
  slug: "draft-post",
  path: "/blogs/draft-post",
  title: "DRAFT POST TITLE",
  sortOrder: 99,
  metaTitle: null,
  metaDescription: null,
  canonicalOverride: null,
  noIndex: false,
  shareImageId: null,
  shareImageAltOverride: null,
  publishedAt: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  fields: { summary: null, datePublished: null, dateModified: null, category: null, cluster: null, faq: null },
  sections: [],
} as ContentItem<"blog-posts">;

const draftVacancy = {
  id: "draft-vacancy",
  collection: "vacancies",
  slug: "draft-role",
  path: "/careers/draft-role",
  title: "DRAFT VACANCY TITLE",
  sortOrder: 99,
  metaTitle: null,
  metaDescription: null,
  canonicalOverride: null,
  noIndex: false,
  shareImageId: null,
  shareImageAltOverride: null,
  publishedAt: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  fields: {},
  sections: [],
} as ContentItem<"vacancies">;

describe("published listings", () => {
  it("leaves a draft post and a draft vacancy out of the home, blogs, careers, and apply data", () => {
    const content = snapshotContent();
    content.collections["blog-posts"].push(draftPost);
    content.collections.vacancies.push(draftVacancy);
    const site = siteFrom(content);
    expect(site.content.collections["blog-posts"].some((item) => item.title === draftPost.title)).toBe(false);
    expect(site.content.collections.vacancies.some((item) => item.title === draftVacancy.title)).toBe(false);
    const home = instances(site, "blog_list").find((instance) => instance.path === "/");
    const blogs = instances(site, "blog_list").find((instance) => instance.path === "/blogs");
    const careers = instances(site, "vacancy_list").find((instance) => instance.path === "/careers");
    expect(home && blogs && careers).toBeTruthy();
    for (const instance of [home!, blogs!, careers!]) {
      expect(render(site, instance.section, instance)).not.toContain(draftPost.title);
      expect(render(site, instance.section, instance)).not.toContain(draftVacancy.title);
    }
    const offered = JSON.stringify(site.content.collections.vacancies.map((vacancy) => ({ slug: vacancy.slug, title: vacancy.title })));
    expect(offered).not.toContain(draftVacancy.title);
  });
});
