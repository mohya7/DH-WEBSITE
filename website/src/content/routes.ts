/*
 * The route table: one static page per published item that has a public path.
 *
 * Paths are not rebuilt here. The API resolves every item's path
 * (ContentPaths.PublicPath) and the website renders exactly those, so a route
 * and the links pointing at it can never disagree.
 */
import type { AnyContentItem, BuildContent, CollectionName } from "./build-content";

export type PageType = "home" | "page" | "service" | "partner" | "case-study" | "blog-post" | "vacancy";

export interface PageRoute {
  path: string;
  /** Path segments, as the [[...path]] route receives them. Empty for the home page. */
  segments: string[];
  pageType: PageType;
  item: AnyContentItem;
}

export interface RouteTable {
  routes: PageRoute[];
  /** Items left out and why: never published, or no page of their own. */
  skipped: { collection: CollectionName; slug: string; reason: string }[];
}

const pageTypes: Record<CollectionName, PageType | null> = {
  pages: "page",
  services: "service",
  partners: "partner",
  "case-studies": "case-study",
  "blog-posts": "blog-post",
  vacancies: "vacancy",
  "team-members": null,
  "news-items": null,
};

/** Lowercase segments of letters, digits, and hyphens. No extension, no trailing slash. */
const cleanPath = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/**
 * First segments the site itself uses: framework assets, media files, the ported
 * design folder, the API the contact form posts to, and the error pages.
 */
const reservedFirstSegments = new Set(["_next", "media", "design", "assets", "behaviors", "api", "404", "500", "_not-found"]);

export class RouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteError";
  }
}

export function allItems(content: BuildContent): AnyContentItem[] {
  return [...content.pages, ...Object.values(content.collections).flat()] as AnyContentItem[];
}

export function buildRoutes(content: BuildContent): RouteTable {
  const routes: PageRoute[] = [];
  const skipped: RouteTable["skipped"] = [];
  const problems: string[] = [];
  const byPath = new Map<string, AnyContentItem>();

  for (const item of allItems(content)) {
    const pageType = pageTypes[item.collection];

    // Defence in depth: the endpoint returns published items only.
    if (item.publishedAt === null) {
      skipped.push({ collection: item.collection, slug: item.slug, reason: "not published" });
      continue;
    }
    if (pageType === null || item.path === null) {
      skipped.push({ collection: item.collection, slug: item.slug, reason: "no page of its own" });
      continue;
    }

    const path = item.path;
    if (!cleanPath.test(path)) {
      problems.push(`${item.collection}/${item.slug}: "${path}" is not a clean URL path.`);
      continue;
    }
    const segments = path === "/" ? [] : path.slice(1).split("/");
    if (segments.length > 0 && reservedFirstSegments.has(segments[0])) {
      problems.push(`${item.collection}/${item.slug}: "${path}" uses a path the site reserves.`);
      continue;
    }
    const clash = byPath.get(path);
    if (clash) {
      problems.push(`${item.collection}/${item.slug} and ${clash.collection}/${clash.slug} both claim "${path}".`);
      continue;
    }
    byPath.set(path, item);

    routes.push({ path, segments, pageType: path === "/" ? "home" : pageType, item });
  }

  if (problems.length > 0) {
    throw new RouteError(`The content cannot be routed:\n- ${problems.join("\n- ")}`);
  }
  if (!byPath.has("/")) {
    throw new RouteError("There is no published home page (path \"/\").");
  }

  routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { routes, skipped };
}
