/*
 * What the listing sections list. The components and sectionRenders share these,
 * so "renders nothing when empty" (4.4, 4.5) has one definition. No JSX here:
 * build scripts import it without React.
 */
import type { BlockContext, BlockItem } from "./context";
import type { CaseCardsFields, CollectionFieldsByName, FaqFields, RelatedItemsFields, Section } from "./generated/schema-types";
import { findItem } from "./lookup";

export type Published<C extends keyof CollectionFieldsByName> = BlockItem<C> & { path: string };

export const publishedBlogPosts = (ctx: BlockContext) => ctx.collections.blogPosts.filter((item): item is Published<"blog-posts"> => Boolean(item.path));

export const publishedCaseStudies = (ctx: BlockContext) => ctx.collections.caseStudies.filter((item): item is Published<"case-studies"> => Boolean(item.path));

/** Whether case_cards lists the published case studies (home, cases hub) rather than its own items. */
export const caseCardsFromCollection = (ctx: BlockContext) => ctx.page.kind === "home" || (ctx.page.kind === "page" && ctx.page.slug === "cases");

/** A service page's case cards whose case study is published. */
export function resolvedCaseItems(fields: CaseCardsFields, ctx: BlockContext) {
  return (fields.items ?? []).flatMap((item) => {
    const path = ctx.resolve(item.reference);
    return path ? [{ item, path, target: ctx.collections.caseStudies.find((entry) => entry.id === item.reference?.id) }] : [];
  });
}

export function resolvedRelatedItems(fields: RelatedItemsFields, ctx: BlockContext) {
  return fields.items.flatMap((item) => {
    const path = ctx.resolve(item);
    const target = findItem(ctx, item);
    return path && target ? [{ item, target, path }] : [];
  });
}

export const faqItems = (fields: FaqFields) => (fields.items ?? []).filter((item) => item.question && item.answer);

/** Whether a section renders anything: a listing section with nothing to list renders nothing. */
export function sectionRenders(section: Section, ctx: BlockContext): boolean {
  switch (section.type) {
    case "blog_list":
      return publishedBlogPosts(ctx).length > 0;
    case "case_cards":
      return caseCardsFromCollection(ctx) ? publishedCaseStudies(ctx).length > 0 : resolvedCaseItems(section.fields, ctx).length > 0;
    case "related_items":
      return resolvedRelatedItems(section.fields, ctx).length > 0;
    case "faq":
      return faqItems(section.fields).length > 0;
    default:
      return true;
  }
}
