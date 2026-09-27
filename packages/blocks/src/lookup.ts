/*
 * Finds the published item a { type, id } reference points at. Only published
 * items are in the collections, so an unpublished or missing target is not found.
 */
import type { BlockContext, BlockItem } from "./context";

export function findItem(ctx: BlockContext, reference: { type: string; id: string } | null | undefined): BlockItem | undefined {
  if (!reference) return undefined;
  const { collections } = ctx;
  const list: BlockItem[] =
    reference.type === "service" ? collections.services
    : reference.type === "partner" ? collections.partners
    : reference.type === "case_study" ? collections.caseStudies
    : reference.type === "blog_post" ? collections.blogPosts
    : reference.type === "vacancy" ? collections.vacancies
    : [];
  return list.find((item) => item.id === reference.id);
}

/** The visual of the service a page belongs to: code, data, ai, or team. */
export function serviceVisual(ctx: BlockContext): string {
  return ctx.collections.services.find((item) => item.slug === ctx.page.slug)?.fields.visual ?? "";
}
