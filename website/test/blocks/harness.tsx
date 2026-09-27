/*
 * Renders sections from the snapshot the way the website does: the real image
 * and link adapters, reference resolution, and the published collections.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Section, type PageKind } from "@digitalhub/blocks";
import type { Section as SectionData, SectionType } from "@digitalhub/blocks/generated/schema-types";
import { blockContext } from "../../src/content/blocks";
import type { BuildContent } from "../../src/content/build-content";
import { createSite, type Site } from "../../src/content/site";

export interface Instance {
  path: string;
  kind: PageKind;
  slug: string;
  index: number;
  section: SectionData;
}

export function instances(site: Site, type: SectionType): Instance[] {
  return site.routes.flatMap((route) =>
    (route.item?.sections ?? []).flatMap((section, index) =>
      section.type === type ? [{ path: route.path, kind: route.pageType, slug: route.item!.slug, index, section }] : [],
    ),
  );
}

export function render(site: Site, section: SectionData, page: { kind: PageKind; slug: string }): string {
  return renderToStaticMarkup(<Section section={section} ctx={blockContext(site, page)} />);
}

export const siteFrom = (content: BuildContent) => createSite(content);

type Tag = { name: string; attrs: Map<string, string> };

/** The start tags of some markup, with their attributes. Enough to check selectors without a DOM. */
export function tags(html: string): Tag[] {
  return [...html.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>"'/]+(?:="[^"]*")?)*)\s*\/?>/g)].map((match) => ({
    name: match[1].toLowerCase(),
    attrs: new Map([...match[2].matchAll(/([^\s=>"'/]+)(?:="([^"]*)")?/g)].map((attr) => [attr[1], attr[2] ?? ""])),
  }));
}

/** Whether a start tag matches a simple selector: tag, #id, .class (any number), [attr] or [attr="value"]. */
function matches(tag: Tag, selector: string): boolean {
  const name = /^[a-z][\w-]*/.exec(selector)?.[0];
  if (name && tag.name !== name) return false;
  const classes = (tag.attrs.get("class") ?? "").split(/\s+/);
  for (const part of selector.matchAll(/([#.])([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (part[1] === "#" && tag.attrs.get("id") !== part[2]) return false;
    if (part[1] === "." && !classes.includes(part[2])) return false;
    if (part[3] && (!tag.attrs.has(part[3]) || (part[4] !== undefined && tag.attrs.get(part[3]) !== part[4]))) return false;
  }
  return true;
}

export const count = (html: string, selector: string) => tags(html).filter((tag) => matches(tag, selector)).length;

/** The selectors, from a list, that the markup does not contain. */
export const missing = (html: string, selectors: string[]) => selectors.filter((selector) => count(html, selector) === 0);

/** React hoists an image preload to <head> in a page; rendered alone, it leads the markup. */
export const withoutPreloads = (html: string) => html.replace(/^(?:<link rel="preload"[^>]*\/>)+/, "");
