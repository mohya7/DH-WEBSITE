/*
 * Page body until Section 5 composes pages: the item's sections, rendered by the
 * components in packages/blocks, inside the page's design frame (Section 3).
 *
 * Pages whose sections include a hero carry their <h1> in it, as on the old
 * site. Other pages (blog posts, the error pages) keep the scaffold's <h1>, and
 * blog posts their image, until Section 5 builds their templates.
 */
import { Section, type PageKind } from "@digitalhub/blocks";
import { Image } from "@/adapters/Image";
import { blockContext } from "@/content/blocks";
import type { AnyContentItem } from "@/content/site";
import { getSite } from "@/content/site";
import type { PageType } from "@/content/routes";
import { DesignFrame, DesignScripts } from "@/design/Design";
import { designSetFor } from "@/design/sets";

const headingSections = new Set(["hero", "hub_hero", "service_hero"]);

export function PageScaffold({ item, pageType }: { item: AnyContentItem | null; pageType: PageType | "error" }) {
  const set = designSetFor(pageType, item?.slug ?? "");
  if (!item) {
    return (
      <DesignFrame set={set}>
        <main data-page-type={pageType} data-design-set={set} />
      </DesignFrame>
    );
  }

  const fields = item.fields as { imageId?: string | null; imageAltOverride?: string | null };
  const ctx = {
    ...blockContext(getSite(), { kind: pageType as PageKind, slug: item.slug }),
    slots: { hero: <DesignScripts set={set} slot="hero" /> },
  };
  const hasHeading = item.sections.some((section) => headingSections.has(section.type));

  return (
    <DesignFrame set={set}>
      <main data-page-type={pageType} data-collection={item.collection} data-slug={item.slug} data-design-set={set}>
        {hasHeading ? null : <h1>{item.title}</h1>}
        {item.collection === "blog-posts" && fields.imageId ? (
          <Image mediaId={fields.imageId} alt={fields.imageAltOverride} sizes="(max-width: 900px) 100vw, 50vw" />
        ) : null}
        {item.sections.map((section, index) => (
          <Section key={index} section={section} ctx={ctx} />
        ))}
      </main>
    </DesignFrame>
  );
}
