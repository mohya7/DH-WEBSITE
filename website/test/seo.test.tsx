import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageScaffold } from "../src/components/PageScaffold";
import type { AnyContentItem, BuildContent } from "../src/content/build-content";
import { createSite } from "../src/content/site";
import { CanonicalError, canonicalUrl, documentTitle, dropNextNoIndexTag, headMetadata, indexableRobots, noIndexRobots, pageHead } from "../src/seo/head";
import { indexablePages, renderLlms, renderRobots, renderSitemap } from "../src/seo/files";
import { editorialLastMod, faqItems, graphProblems, jsonLdText, jobDatePosted, shortName, structuredData } from "../src/seo/jsonld";
import { readSiteUrl, SiteUrlError } from "../src/seo/site-url";
import { snapshotContent } from "./helpers";

const origin = "https://digitalhub.com.eg";
const hostile = '</script><script>alert(1)</script> "quoted"';

function siteOf(content: BuildContent) {
  return createSite(content);
}

describe("site URL", () => {
  it("accepts an absolute http or https origin and refuses the rest", () => {
    expect(readSiteUrl({ PUBLIC_SITE_URL: "https://digitalhub.com.eg" })).toBe("https://digitalhub.com.eg");
    expect(readSiteUrl({ PUBLIC_SITE_URL: " http://127.0.0.1:4380/ " })).toBe("http://127.0.0.1:4380");
    expect(readSiteUrl({ PUBLIC_SITE_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
    expect(readSiteUrl({ PUBLIC_SITE_URL: "https://staging.digitalhub.com.eg" })).toBe("https://staging.digitalhub.com.eg");
    expect(readSiteUrl({ PUBLIC_SITE_URL: "https://digitalhub.com.eg", EXPECTED_PUBLIC_ORIGIN: "https://digitalhub.com.eg" })).toBe("https://digitalhub.com.eg");
    for (const value of ["", "   ", "ftp://x", "//x", "https://user:pw@x", "https://x?y=1", "javascript:alert(1)", "https://digitalhub.com.eg/about", "not a url", "http://digitalhub.com.eg", "https://digitalhub.com.eg."]) {
      expect(() => readSiteUrl({ PUBLIC_SITE_URL: value })).toThrow(SiteUrlError);
    }
    expect(() => readSiteUrl({})).toThrow(/PUBLIC_SITE_URL is not set/);
    expect(() => readSiteUrl({ PUBLIC_SITE_URL: "https://staging.digitalhub.com.eg", EXPECTED_PUBLIC_ORIGIN: "https://digitalhub.com.eg" })).toThrow(/expected origin/);
  });
});

describe("page head", () => {
  const site = siteOf(snapshotContent());

  it("uses the page's own fields and omits a description that was never set", () => {
    const home = site.routes.find((route) => route.path === "/")!.item;
    const head = pageHead(site, home, "home", "/", origin);
    expect(head.title).toBe(home.metaTitle);
    expect(head.description).toBe(home.metaDescription);
    expect(head.canonical).toBe("https://digitalhub.com.eg/");
    expect(head.noIndex).toBe(false);
    expect(head.image).toMatch(/^https:\/\/digitalhub.com.eg\/media\//);
    expect(head.imageAlt).toBe(home.metaTitle);
    expect(head.imageAlt).not.toContain("From pilots to production");

    const service = site.routes.find((route) => route.path === "/services/enterprise-software")!.item;
    const serviceHead = pageHead(site, service, "service", service.path!, origin);
    expect(serviceHead.title).toBe("Enterprise Software Solutions | Digital Hub S.A.E");
    expect(serviceHead.description).toBe("We build secure, scalable, and integration-ready digital platforms that power complex operations and accelerate enterprise transformation.");
    expect(serviceHead.image).toMatch(/^https:\/\/digitalhub.com.eg\/media\//);
    expect(headMetadata(serviceHead).robots).toBe(indexableRobots);
    expect(headMetadata({ ...serviceHead, noIndex: true }).robots).toBe(noIndexRobots);
    expect(dropNextNoIndexTag('<meta name="robots" content="noindex"/><meta name="robots" content="noindex, follow"/>')).toBe('<meta name="robots" content="noindex, follow"/>');
    expect(documentTitle({ title: "Visible", metaTitle: null })).toBe("Visible");

    const apply = site.routes.find((route) => route.path === "/careers/apply")!.item;
    expect(apply.noIndex).toBe(true);
    const national = site.routes.find((route) => route.path === "/cases/national-portal")!.item;
    expect(national.metaTitle).toBeNull();
    expect(national.metaDescription).toBeNull();
    expect(national.shareImageId).toBeNull();
  });

  it("accepts a same-origin canonical and refuses the others, naming the page", () => {
    expect(canonicalUrl(origin, "/about", "/legal")).toBe("https://digitalhub.com.eg/legal");
    expect(canonicalUrl(origin, "/about", "/about/index")).toBe("https://digitalhub.com.eg/about");
    expect(canonicalUrl(origin, "/about", "https://digitalhub.com.eg/about/index")).toBe("https://digitalhub.com.eg/about");
    const refused: [string, RegExp][] = [
      ["https://evil.example/page", /another host/],
      ["http://digitalhub.com.eg/about", /must be https/],
      ["/a b", /unsafe character/],
      ["/about#frag", /fragment/],
      ["javascript:alert(1)", /must be https/],
    ];
    for (const [override, reason] of refused) {
      expect(() => canonicalUrl(origin, "/about", override)).toThrow(CanonicalError);
      expect(() => canonicalUrl(origin, "/about", override)).toThrow(reason);
      expect(() => canonicalUrl(origin, "/about", override)).toThrow(/\/about:/);
    }
  });
});

describe("structured data", () => {
  const content = snapshotContent();
  const site = siteOf(content);

  it("gives every published page Organization, WebSite, and BreadcrumbList, and the type that page is", () => {
    for (const route of site.routes) {
      const graph = structuredData(site, route.item, route.pageType, route.path, origin);
      expect(graphProblems(graph)).toEqual([]);
      const types = (graph["@graph"] as { "@type": string }[]).map((node) => node["@type"]);
      expect(types.slice(0, 3)).toEqual(["Organization", "WebSite", "BreadcrumbList"]);
      if (route.pageType === "service") expect(types).toContain("Service");
      if (route.pageType === "blog-post") expect(types).toContain("Article");
      expect(types).not.toContain("JobPosting");
      expect(JSON.stringify(graph)).not.toContain("undefined");
    }
    const article = structuredData(site, site.routes.find((route) => route.pageType === "blog-post")!.item, "blog-post", "/blogs/digital-employee-experience", origin);
    const articleNode = (article["@graph"] as { "@type": string; datePublished?: string; dateModified?: string }[]).find((node) => node["@type"] === "Article");
    expect(articleNode?.datePublished).toBe("2026-06-15");
    expect(articleNode?.dateModified).toBe("2026-08-12");
  });

  it("omits optional properties that the content does not have", () => {
    const service = site.routes.find((route) => route.path === "/services/enterprise-software")!.item;
    const node = (structuredData(site, service, "service", service.path!, origin)["@graph"] as { "@type": string; description?: string }[]).find((entry) => entry["@type"] === "Service");
    expect(node?.description).toBe(service.metaDescription);
    const without = structuredData(site, { ...service, metaDescription: null }, "service", service.path!, origin);
    const blank = (without["@graph"] as { "@type": string; description?: string }[]).find((entry) => entry["@type"] === "Service");
    expect(blank?.description).toBeUndefined();
    const organization = (structuredData(site, service, "service", service.path!, origin)["@graph"] as { "@type": string; address?: { postalCode?: string }; logo?: string; contactPoint?: { telephone?: string; email?: string }; alternateName?: string; foundingDate?: string; slogan?: string; knowsAbout?: string[] }[])[0];
    expect(organization.logo).toMatch(/^https:\/\/digitalhub.com.eg\/media\//);
    expect(organization.contactPoint).toEqual({ "@type": "ContactPoint", telephone: content.settings.phone, email: content.settings.email });
    expect(organization.alternateName).toBeUndefined();
    expect(organization.foundingDate).toBeUndefined();
    expect(organization.slogan).toBeUndefined();
    expect(organization.knowsAbout).toBeUndefined();
    expect(organization.address?.postalCode).toBeUndefined();
    const post = site.routes.find((route) => route.pageType === "blog-post")!.item;
    if (post.collection === "blog-posts") post.fields.dateModified = null;
    const undated = (structuredData(site, post, "blog-post", post.path!, origin)["@graph"] as { "@type": string; dateModified?: string }[]).find((entry) => entry["@type"] === "Article");
    expect(undated?.dateModified).toBeUndefined();
    expect(faqItems(post)).toEqual([]);
  });

  it("describes a vacancy from a test fixture, including a missing optional field left out", () => {
    const vacancy = {
      id: "vacancy-1",
      collection: "vacancies",
      slug: "engineer",
      path: "/careers/engineer",
      title: "Platform engineer",
      sortOrder: 1,
      metaTitle: null,
      metaDescription: null,
      canonicalOverride: null,
      noIndex: false,
      shareImageId: null,
      shareImageAltOverride: null,
      publishedAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      fields: { summary: "Build the platform.", department: null, location: "New Cairo", employmentType: null, aboutRole: null, keyResponsibilities: null, requiredSkills: null, niceToHave: null, roleOffers: null, interviewStages: null, featured: null },
      sections: [],
    } as AnyContentItem;
    content.collections.vacancies.push(vacancy as never);
    const withVacancy = siteOf(content);
    const graph = structuredData(withVacancy, vacancy, "vacancy", "/careers/engineer", origin);
    expect(graphProblems(graph)).toEqual([]);
    const job = (graph["@graph"] as { "@type": string; description?: string; datePosted?: string; employmentType?: string }[]).find((node) => node["@type"] === "JobPosting");
    expect(job?.description).toBe("Build the platform.");
    expect(job?.datePosted).toBe("2026-04-02");
    expect(jobDatePosted(vacancy)).toBe("2026-04-02");
    expect(job?.employmentType).toBeUndefined();
    expect(editorialLastMod({ ...vacancy, publishedAt: null, fields: { ...vacancy.fields, datePublished: null, dateModified: null } } as AnyContentItem)).toBeNull();
  });

  it("keeps a hostile title, description, and FAQ answer inside one inert script", () => {
    const page = content.pages.find((item) => item.path === "/about")!;
    page.metaTitle = hostile;
    page.metaDescription = hostile;
    page.sections = [{ type: "faq", fields: { items: [{ question: "What?", answer: hostile }] } }];
    const built = siteOf(content);
    const data = structuredData(built, page, "page", "/about", origin);
    const html = renderToStaticMarkup(<PageScaffold site={built} item={page} pageType="page" path="/about" />);
    const head = renderToStaticMarkup(<><title>{page.metaTitle}</title><meta name="description" content={page.metaDescription ?? ""} /></>);
    const scripts = html.match(/<script/g)?.length ?? 0;
    const sourced = html.match(/<script src=/g)?.length ?? 0;
    expect(scripts).toBe(sourced + 1);
    const bodies = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(bodies).toHaveLength(1);
    expect(bodies[0][1]).not.toContain("</script>");
    expect(head).not.toContain("<script");
    expect(html).toContain("&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    const parsed = JSON.parse(bodies[0][1]);
    expect(graphProblems(parsed)).toEqual([]);
    const faq = (parsed["@graph"] as { "@type": string; mainEntity?: { acceptedAnswer: { text: string } }[] }[]).find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity?.[0].acceptedAnswer.text).toBe(hostile);
    expect(jsonLdText(data)).toBe(bodies[0][1]);
    expect(bodies[0][1]).toContain("\\u003c/script>");
  });

  it("does not mention an unpublished item", () => {
    content.collections.vacancies.push({
      id: "draft-1",
      collection: "vacancies",
      slug: "secret-draft",
      path: "/careers/secret-draft",
      title: "UNPUBLISHED DRAFT TITLE",
      sortOrder: 2,
      metaTitle: "UNPUBLISHED DRAFT TITLE",
      metaDescription: "draft description",
      canonicalOverride: null,
      noIndex: false,
      shareImageId: null,
      shareImageAltOverride: null,
      publishedAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      fields: {},
      sections: [],
    } as never);
    const built = siteOf(content);
    expect(built.routes.some((route) => route.path === "/careers/secret-draft")).toBe(false);
    const home = built.routes.find((route) => route.path === "/")!.item;
    expect(JSON.stringify(structuredData(built, home, "home", "/", origin))).not.toContain("UNPUBLISHED DRAFT TITLE");
    expect(renderSitemap(built, origin)).not.toContain("secret-draft");
    expect(renderLlms(built, origin)).not.toContain("UNPUBLISHED DRAFT TITLE");
  });
});

describe("sitemap, robots, and llms", () => {
  it("lists only published indexable pages, with absolute URLs and editorial lastmod", () => {
    const content = snapshotContent();
    content.pages.find((page) => page.path === "/news")!.noIndex = true;
    const site = siteOf(content);
    const xml = renderSitemap(site, origin);
    expect(xml).not.toContain("/news");
    expect(xml).not.toContain("/careers/apply");
    expect(xml).not.toContain("/404");
    expect(xml).not.toContain("/500");
    expect(xml).toContain("<loc>https://digitalhub.com.eg/</loc>");
    expect(xml).toContain("<loc>https://digitalhub.com.eg/blogs/digital-employee-experience</loc><lastmod>2026-08-12</lastmod>");
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs.every((loc) => loc.startsWith("https://digitalhub.com.eg/"))).toBe(true);
    expect(indexablePages(site).some((item) => item.noIndex)).toBe(false);
    const blog = site.routes.find((route) => route.path === "/blogs/digital-employee-experience")!.item;
    expect(editorialLastMod(blog)).toBe("2026-08-12");
    expect(xml).toMatch(/<loc>https:\/\/digitalhub\.com\.eg\/about<\/loc><\/url>/);
    expect(xml).not.toMatch(/<loc>https:\/\/digitalhub\.com\.eg\/<\/loc><lastmod>/);
    if (blog.collection === "blog-posts") {
      blog.fields.dateModified = null;
      blog.fields.datePublished = null;
      blog.publishedAt = "2026-10-12T10:07:28.746Z";
      expect(editorialLastMod(blog)).toBeNull();
      const again = renderSitemap(siteOf(content), origin);
      expect(again).toContain("<loc>https://digitalhub.com.eg/blogs/digital-employee-experience</loc></url>");
      expect(again).not.toContain("digital-employee-experience</loc><lastmod>");
    }
    expect(renderRobots(origin)).toBe("User-agent: *\nAllow: /\n\nSitemap: https://digitalhub.com.eg/sitemap.xml\n");
    const llms = renderLlms(site, origin);
    expect(llms).toContain("# Digital Hub");
    expect(llms).toContain("https://digitalhub.com.eg/services/enterprise-software");
    expect(llms).toContain("[About Us](https://digitalhub.com.eg/about)");
    expect(llms).toContain("https://digitalhub.com.eg/blogs/digital-employee-experience");
    expect(llms).toContain("https://digitalhub.com.eg/cases/ministry-planning");
    expect(llms).not.toContain("Built in Egypt");
    expect(llms).not.toContain(".html");
    expect(llms).not.toContain("UNPUBLISHED");
    const about = site.routes.find((route) => route.path === "/about")!.item;
    expect(shortName(site, about, "/about")).toBe("About Us");
    const crumbs = (structuredData(site, about, "page", "/about", origin)["@graph"] as { "@type": string; itemListElement: { name: string }[] }[]).find((node) => node["@type"] === "BreadcrumbList");
    expect(crumbs?.itemListElement.map((crumb) => crumb.name)).toEqual(["Home", "About Us"]);
  });
});
