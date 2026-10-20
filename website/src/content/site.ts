/*
 * The data layer pages use. Reads the prepared content once per process.
 *
 * It checks the configuration first, so `next build` run on its own, with no
 * source configured, fails with the same message as the prepare step.
 */
import type { AnyContentItem, BuildContent, ContentItem, MediaAsset } from "./build-content";
import { readContentConfig } from "./config";
import type { Reference } from "./generated/schema-types";
import { readPrepared } from "./prepared";
import { buildRoutes, type PageRoute } from "./routes";

export interface Site {
  content: BuildContent;
  routes: PageRoute[];
  routeFor(segments: string[] | undefined): PageRoute | undefined;
  media(id: string | null | undefined): MediaAsset | undefined;
  /** The path of a published target, or null: an unpublished or missing target is never a link. */
  resolve(reference: Pick<Reference, "type" | "id"> | null | undefined): string | null;
  errorPage(code: "404" | "500"): ContentItem<"pages"> | null;
}

/** Listings read this copy. Unpublished items stay out of every collection, not out of each component. */
function published<T extends { publishedAt: string | null }>(items: T[]): T[] {
  return items.filter((item) => item.publishedAt !== null);
}

function publishedContent(content: BuildContent): BuildContent {
  const collections = content.collections;
  return {
    ...content,
    collections: {
      services: published(collections.services),
      partners: published(collections.partners),
      "case-studies": published(collections["case-studies"]),
      "blog-posts": published(collections["blog-posts"]),
      vacancies: collections.vacancies.filter((item) => item.publishedAt !== null && item.status !== "ended"),
      "team-members": published(collections["team-members"]),
      "news-items": published(collections["news-items"]),
    },
  };
}

export function createSite(content: BuildContent): Site {
  const { routes } = buildRoutes(content);
  content = publishedContent(content);
  const byPath = new Map(routes.map((route) => [route.path, route]));
  const mediaById = new Map(content.media.map((asset) => [asset.id, asset]));

  return {
    content,
    routes,
    routeFor(segments) {
      const path = "/" + (segments ?? []).map((segment) => decodeURIComponent(segment)).join("/");
      return byPath.get(path);
    },
    media(id) {
      return id ? mediaById.get(id) : undefined;
    },
    resolve(reference) {
      if (!reference) return null;
      return content.references[`${reference.type}:${reference.id}`] ?? null;
    },
    errorPage(code) {
      return content.errorPages[code];
    },
  };
}

let site: Site | undefined;

export function getSite(): Site {
  if (!site) {
    const config = readContentConfig();
    const { raw } = readPrepared(config);
    site = createSite(JSON.parse(raw) as BuildContent);
  }
  return site;
}

export type { AnyContentItem, PageRoute };
