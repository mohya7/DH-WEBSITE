/*
 * One JSON-LD graph per page. Properties come from the page and the site
 * settings. A missing optional property is left out: it is never a null, an
 * empty string, or a value made up to satisfy a schema.
 */
import type { AnyContentItem, SiteSettings } from "../content/build-content";
import type { PageType } from "../content/routes";
import type { Site } from "../content/site";
import type { NavigationNode } from "../content/build-content";
import { canonicalUrl, documentDescription, documentTitle } from "./head";

const calendarDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export interface FaqItem {
  question: string;
  answer: string;
}

type Json = Record<string, unknown>;

function kept(value: Json): Json {
  const out: Json = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null || entry === "") continue;
    out[key] = entry;
  }
  return out;
}

function sameAs(settings: SiteSettings): string[] {
  return [settings.linkedIn, settings.facebook, settings.instagram, settings.tikTok].flatMap((url) => {
    const value = url?.trim();
    if (!value) return [];
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? [value] : [];
    } catch {
      return [];
    }
  });
}

function siteLogo(site: Site, origin: string): string | undefined {
  const asset = site.content.media.find((item) => item.originalName === "digital-hub-logo.png");
  return asset?.path ? `${origin}${asset.path}` : undefined;
}

function contactPoint(settings: SiteSettings): Json | undefined {
  const telephone = settings.phone?.trim();
  const email = settings.email?.trim();
  if (!telephone && !email) return undefined;
  return kept({ "@type": "ContactPoint", telephone, email });
}

function postalAddress(settings: SiteSettings): Json | undefined {
  const address = kept({
    "@type": "PostalAddress",
    streetAddress: settings.streetAddress?.trim(),
    addressLocality: settings.locality?.trim(),
    addressRegion: settings.region?.trim(),
    postalCode: settings.postalCode?.trim(),
    addressCountry: settings.country?.trim(),
  });
  return Object.keys(address).length > 1 ? address : undefined;
}

/** dateModified, otherwise datePublished. No publish timestamp and no build time: the sitemap omits lastmod when this is null. */
export function editorialLastMod(item: AnyContentItem): string | null {
  const fields = item.fields as { dateModified?: string | null; datePublished?: string | null };
  if (fields.dateModified && calendarDate.test(fields.dateModified)) return fields.dateModified;
  if (fields.datePublished && calendarDate.test(fields.datePublished)) return fields.datePublished;
  return null;
}

/**
 * JobPosting datePosted. An editorial date wins. A vacancy can be published
 * without one, and Google's datePosted is the posting date, so the publish
 * timestamp is used only here. The sitemap must not use this function.
 */
export function jobDatePosted(item: AnyContentItem): string | null {
  const editorial = editorialLastMod(item);
  if (editorial) return editorial;
  const published = item.publishedAt?.slice(0, 10);
  return published && calendarDate.test(published) ? published : null;
}

function navigationLabel(site: Site, path: string): string | undefined {
  const walk = (nodes: NavigationNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.kind === "internal" && node.path === path && node.label.trim()) return node.label.trim();
      const nested = walk(node.children);
      if (nested) return nested;
    }
    return undefined;
  };
  const header = site.content.navigation.filter((node) => node.menu === "header");
  return walk(header) ?? walk(site.content.navigation);
}

/** The short name: Home, otherwise the navigation label, otherwise the item title. Never the SEO title. */
export function shortName(site: Site, item: AnyContentItem, path: string): string {
  if (path === "/") return "Home";
  return navigationLabel(site, path) ?? item.title;
}

/** Partner detail crumbs are "{name} Partnership". Other crumbs use the short name. */
function breadcrumbName(site: Site, item: AnyContentItem, path: string): string {
  const name = shortName(site, item, path);
  if (item.collection === "partners") return `${name} Partnership`;
  return name;
}

export function faqItems(item: AnyContentItem): FaqItem[] {
  const fromSections = item.sections.flatMap((section) => {
    if (section.type !== "faq") return [];
    return section.fields.items.flatMap((entry) => {
      const question = entry.question.trim();
      const answer = entry.answer.trim();
      return question && answer ? [{ question, answer }] : [];
    });
  });
  const fromPost = item.collection === "blog-posts" ? parseFaq(item.fields.faq) : [];
  return [...fromSections, ...fromPost];
}

function parseFaq(value: string | null | undefined): FaqItem[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as { items?: { question?: unknown; answer?: unknown }[] };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.flatMap((entry) => {
      if (typeof entry?.question !== "string" || typeof entry.answer !== "string") return [];
      const question = entry.question.trim();
      const answer = entry.answer.trim();
      return question && answer ? [{ question, answer }] : [];
    });
  } catch {
    return [];
  }
}

function breadcrumbs(site: Site, item: AnyContentItem | null, path: string, origin: string): Json {
  const paths = path === "/" ? ["/"] : ["/", ...path.split("/").filter(Boolean).map((_, index, parts) => `/${parts.slice(0, index + 1).join("/")}`)];
  const byPath = new Map(site.routes.map((route) => [route.path, route.item]));
  const crumbs = paths.flatMap((crumbPath, index) => {
    const found = byPath.get(crumbPath);
    const current = index === paths.length - 1 ? item : undefined;
    const source = found ?? current;
    if (!source) return [];
    if (source !== item && source.noIndex) return [];
    return [{
      "@type": "ListItem",
      position: 0,
      name: breadcrumbName(site, source, crumbPath),
      item: crumbPath === path && item ? canonicalUrl(origin, path, item.canonicalOverride) : canonicalUrl(origin, crumbPath, source.canonicalOverride),
    }];
  });
  crumbs.forEach((crumb, index) => {
    crumb.position = index + 1;
  });
  return { "@type": "BreadcrumbList", itemListElement: crumbs };
}

function pageEntity(site: Site, item: AnyContentItem, pageType: PageType | "error", path: string, origin: string): Json | undefined {
  const url = canonicalUrl(origin, path, item.canonicalOverride);
  const org = `${origin}/#organization`;
  if (pageType === "service") {
    return kept({ "@type": "Service", name: item.title, description: documentDescription(item), url, provider: { "@id": org } });
  }
  if (pageType === "blog-post" && item.collection === "blog-posts") {
    const imageId = item.shareImageId ?? site.content.settings.defaultShareImageId;
    const image = site.media(imageId);
    return kept({
      "@type": "Article",
      headline: documentTitle(item),
      description: documentDescription(item),
      datePublished: calendarDate.test(item.fields.datePublished ?? "") ? item.fields.datePublished : undefined,
      dateModified: calendarDate.test(item.fields.dateModified ?? "") ? item.fields.dateModified : undefined,
      image: image ? origin + image.path : undefined,
      author: { "@id": org },
      mainEntityOfPage: url,
    });
  }
  if (pageType === "vacancy" && item.collection === "vacancies") {
    const description = item.fields.summary?.trim() || item.fields.aboutRole?.trim();
    const address = postalAddress(site.content.settings);
    const place = item.fields.location?.trim() || address
      ? kept({ "@type": "Place", name: item.fields.location?.trim(), address })
      : undefined;
    return kept({
      "@type": "JobPosting",
      title: item.title,
      description,
      datePosted: jobDatePosted(item) ?? undefined,
      employmentType: item.fields.employmentType?.trim(),
      hiringOrganization: { "@id": org },
      jobLocation: place,
      url,
    });
  }
  return undefined;
}

export function structuredData(site: Site, item: AnyContentItem | null, pageType: PageType | "error", path: string, origin: string): Json {
  const settings = site.content.settings;
  const organization = kept({
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: settings.organizationName?.trim(),
    legalName: settings.legalName?.trim(),
    url: `${origin}/`,
    email: settings.email?.trim(),
    telephone: settings.phone?.trim(),
    logo: siteLogo(site, origin),
    contactPoint: contactPoint(settings),
    address: postalAddress(settings),
    sameAs: sameAs(settings),
  });
  if (Array.isArray(organization.sameAs) && organization.sameAs.length === 0) delete organization.sameAs;
  const website = kept({
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: settings.organizationName?.trim() || settings.legalName?.trim(),
    url: `${origin}/`,
    publisher: { "@id": `${origin}/#organization` },
  });
  const graph = [organization, website, breadcrumbs(site, item, path, origin)];
  if (item) {
    const entity = pageEntity(site, item, pageType, path, origin);
    if (entity) graph.push(entity);
    const questions = faqItems(item);
    if (questions.length > 0) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: questions.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: { "@type": "Answer", text: entry.answer },
        })),
      });
    }
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** JSON that cannot close a surrounding script element, whatever the content says. */
export function jsonLdText(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const required: Record<string, string[]> = {
  Organization: ["name", "url"],
  WebSite: ["name", "url"],
  BreadcrumbList: ["itemListElement"],
  Service: ["name", "url"],
  Article: ["headline"],
  JobPosting: ["title", "hiringOrganization"],
  FAQPage: ["mainEntity"],
};

/** Problems in one graph: wrong shape, a null, or a string that is the word undefined or null. */
export function graphProblems(value: unknown, forbidden: readonly string[] = []): string[] {
  const problems: string[] = [];
  const walk = (node: unknown, where: string): void => {
    if (node === null) problems.push(`${where} is null`);
    else if (node === undefined) problems.push(`${where} is undefined`);
    else if (typeof node === "string") {
      if (node === "undefined" || node === "null") problems.push(`${where} is the string "${node}"`);
      for (const text of forbidden) if (node.includes(text)) problems.push(`${where} contains ${text}`);
    } else if (Array.isArray(node)) node.forEach((entry, index) => walk(entry, `${where}[${index}]`));
    else if (typeof node === "object") {
      const record = node as Json;
      const type = typeof record["@type"] === "string" ? record["@type"] : undefined;
      for (const key of required[type ?? ""] ?? []) if (!(key in record)) problems.push(`${where} ${type} is missing ${key}`);
      for (const [key, entry] of Object.entries(record)) walk(entry, `${where}.${key}`);
    }
  };
  if (!value || typeof value !== "object" || (value as Json)["@context"] !== "https://schema.org" || !Array.isArray((value as Json)["@graph"])) {
    return ["the graph is not a schema.org @graph"];
  }
  walk(value, "graph");
  return problems;
}
