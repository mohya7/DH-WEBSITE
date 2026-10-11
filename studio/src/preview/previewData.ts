/*
 * What the preview's section components read besides the draft itself: the
 * published collection items (lists such as service and case cards), the paths
 * { type, id } references resolve to, and the media the sections show.
 *
 * Everything comes from the endpoints the Studio already uses. A published item
 * with an unsaved-to-the-website working copy is read from its latest revision,
 * which is what the website shows; other published items from their document.
 * Drafts are never listed and never linked, as on the website.
 */
import type { BlockCollections, BlockItem } from "@digitalhub/blocks";
import { request } from "../api/http";
import { publicPath, type CollectionName } from "../content/model";

type ListRow = { id: string; slug: string; title: string; sortOrder: number; hasWorkingCopy: boolean };
type Document = { slug: string; title: string; sortOrder?: number; fields?: Record<string, unknown> };

export interface PreviewMedia {
  path: string;
  width: number | null;
  height: number | null;
  widths: number[];
  alt: string;
  decorative: boolean;
}

export interface PreviewData {
  collections: BlockCollections;
  /** "type:id" of every published, linkable item, to its public path. */
  paths: Map<string, string>;
}

/** Reference types (packages/sections/defs.json) and vacancies, to their collections. */
export const referenceCollections: Record<string, CollectionName> = {
  page: "pages",
  service: "services",
  partner: "partners",
  case_study: "case-studies",
  blog_post: "blog-posts",
  vacancy: "vacancies",
};

async function published(collection: CollectionName): Promise<BlockItem[]> {
  const rows: ListRow[] = [];
  for (let page = 1; ; page++) {
    const list = await request(`/api/v1/${collection}?page=${page}&pageSize=100&status=published`);
    if (!list.ok || list.body === null) throw new Error(`The published ${collection} could not be loaded for the preview.`);
    const body = list.body as { items: ListRow[]; total: number };
    rows.push(...body.items);
    if (body.items.length === 0 || rows.length >= body.total) break;
  }
  const items = await Promise.all(rows.map(async (row) => {
    const document = row.hasWorkingCopy ? await latestRevision(collection, row.id) : await current(collection, row.id);
    return {
      id: row.id,
      slug: document.slug,
      path: publicPath(collection, document.slug),
      title: document.title,
      sortOrder: document.sortOrder ?? row.sortOrder,
      fields: (document.fields ?? {}) as never,
    } satisfies BlockItem;
  }));
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

async function current(collection: CollectionName, id: string): Promise<Document> {
  const result = await request(`/api/v1/${collection}/${id}`);
  if (!result.ok || result.body === null) throw new Error(`A published ${collection} item could not be loaded for the preview.`);
  return (result.body as { content: Document }).content;
}

async function latestRevision(collection: CollectionName, id: string): Promise<Document> {
  const list = await request(`/api/v1/${collection}/${id}/revisions`);
  const revisions = list.ok && list.body !== null ? (list.body as { items: Array<{ id: string; version: number }> }).items : [];
  const newest = revisions.slice().sort((a, b) => b.version - a.version)[0];
  if (newest === undefined) return current(collection, id);
  const result = await request(`/api/v1/${collection}/${id}/revisions/${newest.id}`);
  if (!result.ok || result.body === null) return current(collection, id);
  return (result.body as { snapshot: Document }).snapshot;
}

export async function loadPreviewData(): Promise<PreviewData> {
  const [pages, services, partners, caseStudies, blogPosts, vacancies, teamMembers, newsItems] = await Promise.all([
    published("pages"),
    published("services"),
    published("partners"),
    published("case-studies"),
    published("blog-posts"),
    published("vacancies"),
    published("team-members"),
    published("news-items"),
  ]);
  const paths = new Map<string, string>();
  const linkable: Array<[string, BlockItem[]]> = [["page", pages], ["service", services], ["partner", partners], ["case_study", caseStudies], ["blog_post", blogPosts], ["vacancy", vacancies]];
  for (const [type, items] of linkable) {
    for (const item of items) if (item.path !== null) paths.set(`${type}:${item.id}`, item.path);
  }
  return {
    collections: {
      services: services as BlockCollections["services"],
      partners: partners as BlockCollections["partners"],
      caseStudies: caseStudies as BlockCollections["caseStudies"],
      blogPosts: blogPosts as BlockCollections["blogPosts"],
      newsItems: newsItems as BlockCollections["newsItems"],
      vacancies: vacancies as BlockCollections["vacancies"],
      teamMembers: teamMembers as BlockCollections["teamMembers"],
    },
    paths,
  };
}

/** The widths the API stored for an image, from its generatedSizes (numbers or { width }). */
export function storedWidths(generated: unknown): number[] {
  if (!Array.isArray(generated)) return [];
  const widths = generated
    .map((entry) => (typeof entry === "number" ? entry : typeof entry === "object" && entry !== null ? (entry as { width?: unknown }).width : undefined))
    .filter((width): width is number => typeof width === "number" && Number.isInteger(width));
  return [...new Set(widths)].sort((a, b) => a - b);
}

export async function loadMedia(id: string): Promise<PreviewMedia | null> {
  const result = await request(`/api/v1/media/${id}`);
  if (!result.ok || result.body === null) return null;
  const image = (result.body as { image: { path: string; width: number | null; height: number | null; generatedSizes: unknown; alt: string; decorative: boolean } }).image;
  return { path: image.path, width: image.width, height: image.height, widths: storedWidths(image.generatedSizes), alt: image.alt, decorative: image.decorative };
}
