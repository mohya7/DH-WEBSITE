/*
 * The data half of the section components' context: the page, reference
 * resolution, and the published collections. No React, so build scripts
 * (check-output) can use it with sectionRenders.
 */
import type { BlockCollections, BlockContext, PageKind } from "@digitalhub/blocks/context";
import type { Site } from "./site";

export function blockCollections(site: Site): BlockCollections {
  const { collections } = site.content;
  return {
    services: collections.services,
    partners: collections.partners,
    caseStudies: collections["case-studies"],
    blogPosts: collections["blog-posts"],
    newsItems: collections["news-items"],
    vacancies: collections.vacancies,
    teamMembers: collections["team-members"],
  };
}

export function blockData(site: Site, page: { kind: PageKind; slug: string }): Omit<BlockContext, "Image" | "Link"> {
  return {
    page,
    resolve: (reference) => site.resolve(reference as never),
    collections: blockCollections(site),
  };
}
