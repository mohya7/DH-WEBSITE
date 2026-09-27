/*
 * The response of GET /api/v1/build/content, which is also exactly what
 * fixtures/snapshot/content.json holds.
 *
 * The envelope mirrors api/src/DigitalHub.Api/Content/BuildContentStore.cs.
 * Section and item fields come from the generated schema types, so they match
 * packages/sections and packages/collections.
 */
import type { CollectionFieldsByName, CollectionName, Section } from "./generated/schema-types";

export type { CollectionName, Section };

/** Collections other than pages, as the endpoint groups them. */
export type ItemCollectionName = Exclude<CollectionName, "pages">;

export interface ContentItem<C extends CollectionName = CollectionName> {
  id: string;
  collection: C;
  slug: string;
  /** Clean public path, or null for items that are not pages of their own. */
  path: string | null;
  title: string;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalOverride: string | null;
  noIndex: boolean;
  shareImageId: string | null;
  shareImageAltOverride: string | null;
  /** ISO time. Null would mean the item was never published: such an item is never rendered. */
  publishedAt: string | null;
  updatedAt: string;
  fields: CollectionFieldsByName[C];
  /** Visible sections only, in order. Empty for collections without sections. */
  sections: Section[];
}

export type AnyContentItem = { [C in CollectionName]: ContentItem<C> }[CollectionName];

export interface MediaAsset {
  id: string;
  /** Site-relative path of the stored file, e.g. /media/<hash>.webp. */
  path: string;
  originalName: string;
  contentType: string;
  width: number;
  height: number;
  size: number;
  /** Widths of the stored smaller variants, ascending. */
  widths: number[];
  /** Default alt text; a usage may override it. */
  alt: string | null;
  decorative: boolean;
  caption: string | null;
}

export interface NavigationNode {
  id: string;
  menu: string;
  label: string;
  kind: "group" | "internal" | "external";
  /** Resolved path for an internal link; null when its target is not published. */
  path: string | null;
  url: string | null;
  sortOrder: number;
  children: NavigationNode[];
}

export interface SiteSettings {
  phone: string | null;
  whatsApp: string | null;
  email: string | null;
  linkedIn: string | null;
  facebook: string | null;
  instagram: string | null;
  tikTok: string | null;
  footerText: string | null;
  streetAddress: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  defaultMetaTitle: string | null;
  defaultMetaDescription: string | null;
  defaultShareImageId: string | null;
  defaultShareImageAltOverride: string | null;
  organizationName: string | null;
  legalName: string | null;
  analyticsContainerId: string | null;
  cookieBannerText: string | null;
}

export interface Redirect {
  fromPath: string;
  toPath: string;
  statusCode: number;
}

export interface UnresolvedReference {
  type: string;
  id: string;
  usedBy: string;
  reason: string;
}

export interface BuildContent {
  generatedAt: string;
  counts: Record<CollectionName, number>;
  /** Routable pages. The error pages are not among them. */
  pages: ContentItem<"pages">[];
  collections: { [C in ItemCollectionName]: ContentItem<C>[] };
  /** Null when that error page is not published. */
  errorPages: { "404": ContentItem<"pages"> | null; "500": ContentItem<"pages"> | null };
  media: MediaAsset[];
  navigation: NavigationNode[];
  settings: SiteSettings;
  redirects: Redirect[];
  /** "type:id" of every published, linkable item, to its path. */
  references: Record<string, string>;
  unresolvedReferences: UnresolvedReference[];
}
