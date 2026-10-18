/*
 * The document head for one page, taken only from that page's SEO fields and
 * the site settings. A missing field is omitted. Nothing is filled in from
 * another page or from a fixed sentence.
 */
import type { AnyContentItem, MediaAsset, SiteSettings } from "../content/build-content";
import type { PageType } from "../content/routes";
import type { Site } from "../content/site";

export interface PageHead {
  title: string;
  description?: string;
  canonical: string;
  noIndex: boolean;
  siteName?: string;
  image?: string;
  imageAlt?: string;
  openGraphType: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}

const calendarDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** The robots meta the old indexable pages carried, and the one noindex pages carried. */
export const indexableRobots = "index, follow, max-image-preview:large";
export const noIndexRobots = "noindex, follow";

export function documentTitle(item: { title: string; metaTitle: string | null }): string {
  const meta = item.metaTitle?.trim();
  return meta || item.title;
}

export function documentDescription(item: { metaDescription: string | null }): string | undefined {
  const description = item.metaDescription?.trim();
  return description || undefined;
}

export class CanonicalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalError";
  }
}

const safePath = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

function canonicalProblem(page: string, raw: string, reason: string): CanonicalError {
  return new CanonicalError(`${page}: canonical override "${raw}" ${reason}`);
}

/** One leading slash, no trailing index, and only the characters a site path uses. */
function normaliseCanonicalPath(value: string, page: string, raw: string): string {
  if (value.includes("#") || value.includes("?") || /\s/.test(value) || /[<>"'\\]/.test(value)) {
    throw canonicalProblem(page, raw, "has a space, a fragment, or an unsafe character.");
  }
  let path = value.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  path = path.replace(/\/index(?:\.html)?$/, "");
  if (path === "") path = "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (!safePath.test(path)) throw canonicalProblem(page, raw, "is not a safe path on this site.");
  return path;
}

/** An absolute same-origin https URL. A bad override stops the build and names the page. */
export function canonicalUrl(origin: string, path: string, override: string | null | undefined): string {
  const page = path.startsWith("/") ? path : `/${path}`;
  const value = override?.trim();
  if (!value) return origin + page;
  if (value.startsWith("/") && !value.startsWith("//")) return origin + normaliseCanonicalPath(value, page, value);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw canonicalProblem(page, value, "is not a same-origin https URL.");
  }
  if (url.protocol !== "https:") throw canonicalProblem(page, value, "must be https.");
  if (url.hash) throw canonicalProblem(page, value, "must not have a fragment.");
  if (url.search || url.username || url.password) throw canonicalProblem(page, value, "is not a same-origin https URL.");
  if (url.host !== new URL(origin).host) throw canonicalProblem(page, value, "is on another host.");
  return origin + normaliseCanonicalPath(url.pathname, page, value);
}

function shareImage(site: Site, item: AnyContentItem): { image?: string; imageAlt?: string } {
  const id = item.shareImageId ?? site.content.settings.defaultShareImageId;
  const asset = site.media(id);
  if (!asset) return {};
  // A library alt describes the file, which may be reused from another page. Use it only when this page supplies its own alt.
  const own = item.shareImageAltOverride?.trim();
  return { image: asset.path, imageAlt: own || documentTitle(item) };
}

function calendar(value: string | null | undefined): string | undefined {
  const date = value?.trim();
  return date && calendarDate.test(date) ? date : undefined;
}

export function pageHead(site: Site, item: AnyContentItem, pageType: PageType | "error", path: string, origin: string): PageHead {
  const fields = item.fields as { datePublished?: string | null; dateModified?: string | null };
  const image = shareImage(site, item);
  const siteName = site.content.settings.legalName?.trim() || site.content.settings.organizationName?.trim() || undefined;
  return {
    title: documentTitle(item),
    description: documentDescription(item),
    canonical: canonicalUrl(origin, path, item.canonicalOverride),
    noIndex: item.noIndex,
    siteName,
    image: image.image ? origin + image.image : undefined,
    imageAlt: image.imageAlt,
    openGraphType: pageType === "blog-post" ? "article" : "website",
    publishedTime: pageType === "blog-post" ? calendar(fields.datePublished) : undefined,
    modifiedTime: pageType === "blog-post" ? calendar(fields.dateModified) : undefined,
  };
}

export function siteNameOf(settings: SiteSettings): string | undefined {
  return settings.legalName?.trim() || settings.organizationName?.trim() || undefined;
}

/** The Next.js metadata fields for one page head. A missing value is left unset. */
export function headMetadata(head: PageHead) {
  return {
    title: head.title,
    description: head.description,
    alternates: { canonical: head.canonical },
    robots: head.noIndex ? noIndexRobots : indexableRobots,
    openGraph: {
      type: head.openGraphType,
      siteName: head.siteName,
      title: head.title,
      description: head.description,
      url: head.canonical,
      images: head.image ? [{ url: head.image, alt: head.imageAlt }] : undefined,
      publishedTime: head.publishedTime,
      modifiedTime: head.modifiedTime,
    },
    twitter: {
      card: head.image ? ("summary_large_image" as const) : ("summary" as const),
      title: head.title,
      description: head.description,
      images: head.image,
    },
  };
}

/**
 * Next adds its own `<meta name="robots" content="noindex">` on the 404 and 500
 * pages, in front of the tag from headMetadata. Remove that extra tag so the
 * page keeps the one robots value.
 */
export function dropNextNoIndexTag(html: string): string {
  return html.replace(/<meta name="robots" content="noindex"\s*\/?>/g, "");
}

export type { MediaAsset };
