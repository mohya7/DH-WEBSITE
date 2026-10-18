/*
 * The preview document: a draft's sections, rendered by the website's own section
 * components (packages/blocks) to static HTML, inside a page that loads exactly the
 * stylesheets the website loads for that page type (website/src/design/sets.ts),
 * from the website's own design files (vite/websiteDesign.ts).
 *
 * It is shown in a sandboxed iframe without scripts, so nothing runs in it and no
 * style crosses between the Studio and the preview in either direction.
 */
import { Section, type BlockContext, type ImageAdapterProps, type LinkAdapterProps, type PageKind } from "@digitalhub/blocks";
import type { Section as SectionData } from "@digitalhub/blocks/generated/schema-types";
import { designSetFor, designSets } from "@digitalhub/website-design/sets";
import { renderToStaticMarkup } from "react-dom/server";
import type { CollectionName } from "../content/model";
import type { PreviewData, PreviewMedia } from "./previewData";
import { materialiseCounters } from "./counters";
import { withWebsiteUrls } from "./previewUrls";

export { materialiseCounters } from "./counters";

declare const __WEBSITE_DESIGN_BASE__: string;

export type PreviewSection = { type: string; visible: boolean; fields: Record<string, unknown> };

export interface PreviewInput {
  collection: CollectionName;
  slug: string;
  title: string;
  sections: PreviewSection[];
}

/** The website's page type for an item, as its routes decide it (website/src/content/routes.ts). */
export function pageKindOf(collection: CollectionName, slug: string): PageKind {
  if (collection === "pages") return slug === "home" ? "home" : "page";
  if (collection === "services") return "service";
  if (collection === "partners") return "partner";
  if (collection === "case-studies") return "case-study";
  if (collection === "blog-posts") return "blog-post";
  return "vacancy";
}

const headingSections = new Set(["hero", "hub_hero", "service_hero"]);

/**
 * The state the website's reveal scripts end in. The design keeps [data-reveal] and
 * friends invisible until a script adds .in; the preview runs no scripts, so it
 * renders them revealed. The stylesheets themselves are untouched. Counters show
 * their final values here; the shared section markup still starts at zero.
 */
export function revealed(html: string): string {
  const document = new DOMParser().parseFromString(materialiseCounters(html), "text/html");
  for (const element of document.querySelectorAll("[data-reveal], [data-section-reveal], [data-stagger-item]")) element.classList.add("in");
  return document.body.innerHTML;
}

function srcSet(media: PreviewMedia, origin: string): string | undefined {
  if (media.width === null) return undefined;
  const variants = media.widths.filter((width) => width < media.width!);
  if (variants.length === 0) return undefined;
  const stem = media.path.replace(/\.[^./]+$/, "");
  return [...variants.map((width) => `${origin}${stem}-w${width}.webp ${width}w`), `${origin}${media.path} ${media.width}w`].join(", ");
}

export interface RenderResult {
  html: string;
  /** Media ids the sections asked for that are not loaded yet. */
  missingMedia: string[];
  /** Sections that could not be rendered (usually an unfinished draft), by position. */
  failed: Array<{ index: number; type: string; message: string }>;
}

/** The page's <main>, rendered with the website's section components. */
export function renderSections(input: PreviewInput, data: PreviewData, media: Map<string, PreviewMedia | null>, origin: string): RenderResult {
  const missing = new Set<string>();
  const Image = ({ mediaId, alt, decorative, sizes, className, loading = "lazy", fetchPriority, attributes }: ImageAdapterProps) => {
    if (!mediaId) return null;
    const asset = media.get(mediaId);
    if (asset === undefined) {
      missing.add(mediaId);
      return null;
    }
    if (asset === null) return null;
    const set = srcSet(asset, origin);
    const text = decorative ? "" : alt?.trim() || (asset.decorative ? "" : asset.alt.trim());
    return <img src={`${origin}${asset.path}`} width={asset.width ?? undefined} height={asset.height ?? undefined} srcSet={set} sizes={set ? (sizes ?? "100vw") : undefined} alt={text} className={className} loading={loading} decoding="async" fetchPriority={fetchPriority} {...attributes} />;
  };
  const Link = ({ href, className, children, attributes }: LinkAdapterProps) => <a href={href} className={className} {...attributes}>{children}</a>;
  const kind = pageKindOf(input.collection, input.slug);
  const ctx: BlockContext = {
    page: { kind, slug: input.slug },
    Image,
    Link,
    resolve: (reference) => (reference ? data.paths.get(`${reference.type}:${reference.id}`) ?? null : null),
    collections: data.collections,
  };

  const visible = input.sections.filter((section) => section.visible);
  const failed: RenderResult["failed"] = [];
  const parts = visible.map((section, index) => {
    try {
      return renderToStaticMarkup(<Section section={{ type: section.type, fields: section.fields } as SectionData} ctx={ctx} />);
    } catch (error) {
      failed.push({ index, type: section.type, message: error instanceof Error ? error.message : String(error) });
      return "";
    }
  });
  const heading = visible.some((section) => headingSections.has(section.type)) ? "" : renderToStaticMarkup(<h1>{input.title}</h1>);
  const set = designSetFor(kind, input.slug);
  const main = renderToStaticMarkup(<main data-page-type={kind} data-design-set={set} data-preview="" />).replace("</main>", `${heading}${parts.join("")}</main>`);
  return { html: revealed(main), missingMedia: [...missing], failed };
}

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The whole document for the iframe's srcdoc. Links resolve against the website's
 * address and open in a new tab; design files and media load from the Studio's own
 * origin, where drafts' media already exist.
 */
export function previewDocument(input: PreviewInput, mainHtml: string, websiteAddress: string, origin: string): string {
  const set = designSetFor(pageKindOf(input.collection, input.slug), input.slug);
  const links = designSets[set].head
    .filter((item) => item.rel === "stylesheet")
    .map((item) => `<link rel="stylesheet" href="${escapeAttribute(/^https?:\/\//.test(item.href) ? item.href : `${origin}${__WEBSITE_DESIGN_BASE__}${item.href}`)}">`);
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // A target only: it sets no base URL, so base-uri 'none' allows it.
    '<base target="_blank">',
    `<title>${escapeAttribute(input.title)}</title>`,
    ...links,
    "</head>",
    `<body>${withWebsiteUrls(mainHtml, websiteAddress)}</body>`,
    "</html>",
  ].join("\n");
}
