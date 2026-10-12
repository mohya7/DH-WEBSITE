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

/** An absolute URL. A usable canonical override from the content wins; anything else uses the configured origin and the page path. */
export function canonicalUrl(origin: string, path: string, override: string | null | undefined): string {
  const value = override?.trim();
  if (value) {
    if (value.startsWith("/") && !value.startsWith("//")) return origin + value;
    try {
      const url = new URL(value);
      if ((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && !url.search) return url.href;
    } catch {
      /* The override is not a URL. The path on this site is used instead. */
    }
  }
  return origin + (path.startsWith("/") ? path : `/${path}`);
}

function shareImage(site: Site, item: AnyContentItem): { image?: string; imageAlt?: string } {
  const id = item.shareImageId ?? site.content.settings.defaultShareImageId;
  const asset = site.media(id);
  if (!asset) return {};
  const override = item.shareImageAltOverride?.trim() || site.content.settings.defaultShareImageAltOverride?.trim();
  const alt = override || (!asset.decorative ? asset.alt?.trim() : "") || undefined;
  return { image: asset.path, imageAlt: alt };
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

export type { MediaAsset };
