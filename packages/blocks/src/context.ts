/*
 * What every section component receives besides its own fields.
 *
 * Components import nothing framework-specific. The application that renders
 * them — the website at build, the Studio in its preview — supplies the image
 * and link adapters, the page the section sits on, reference resolution, and
 * the published collection items the old runtime used to render lists from.
 */
import type { ReactNode } from "react";
import type { CollectionFieldsByName, Reference } from "./generated/schema-types";

export type PageKind = "home" | "page" | "service" | "partner" | "case-study" | "blog-post" | "vacancy" | "error";

export interface BlockPage {
  kind: PageKind;
  /** The item's slug: "home", "about", "partners", "microsoft", … */
  slug: string;
}

export interface ImageAdapterProps {
  mediaId: string | null | undefined;
  /** Alt text for this usage; the adapter falls back to the library's default. */
  alt?: string | null;
  decorative?: boolean | null;
  className?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** Extra attributes the old markup carries on the <img>, e.g. aria-hidden. */
  attributes?: Record<string, string>;
}

export interface LinkAdapterProps {
  href: string;
  className?: string;
  children?: ReactNode;
  /** Extra attributes the old markup carries on the <a>: aria-label, data-*, target, rel. */
  attributes?: Record<string, string>;
}

/** A published collection item, as much of it as the blocks read. */
export interface BlockItem<C extends keyof CollectionFieldsByName = keyof CollectionFieldsByName> {
  id: string;
  slug: string;
  path: string | null;
  title: string;
  sortOrder: number;
  fields: CollectionFieldsByName[C];
}

export interface BlockCollections {
  services: BlockItem<"services">[];
  partners: BlockItem<"partners">[];
  caseStudies: BlockItem<"case-studies">[];
  blogPosts: BlockItem<"blog-posts">[];
  newsItems: BlockItem<"news-items">[];
  vacancies: BlockItem<"vacancies">[];
  teamMembers: BlockItem<"team-members">[];
}

export interface BlockContext {
  page: BlockPage;
  Image: (props: ImageAdapterProps) => ReactNode;
  Link: (props: LinkAdapterProps) => ReactNode;
  /** The path of a published target, or null: an unpublished or missing target is never linked. */
  resolve: (reference: Pick<Reference, "type" | "id"> | { type: string; id: string } | null | undefined) => string | null;
  /** Published items, in their sort order. */
  collections: BlockCollections;
  /** Markup the application places inside a section, e.g. the home hero's WebGL script after its canvases. */
  slots?: { hero?: ReactNode };
}
