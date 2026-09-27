/*
 * The context the section components in packages/blocks render with on the
 * website: the page, the image and link adapters, reference resolution, and the
 * published collections.
 */
import type { BlockContext, PageKind } from "@digitalhub/blocks";
import { Image } from "@/adapters/Image";
import { Link } from "@/adapters/Link";
import { blockData } from "./block-data";
import type { Site } from "./site";

export function blockContext(site: Site, page: { kind: PageKind; slug: string }): BlockContext {
  return { ...blockData(site, page), Image, Link };
}
