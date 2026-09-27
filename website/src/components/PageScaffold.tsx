/*
 * Section 2 scaffold: proves every route receives its item and typed sections.
 * Section 5 replaces the body with the real page composition; until then each
 * section is an empty, labelled slot.
 *
 * Since Section 3 the page loads its design set (src/design/sets.ts). The hero
 * scripts go inside the hero slot, where the hero component will place them.
 */
import { Image } from "@/adapters/Image";
import type { AnyContentItem } from "@/content/site";
import type { PageType } from "@/content/routes";
import { DesignFrame, DesignScripts } from "@/design/Design";
import { designSetFor } from "@/design/sets";

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
  const heroIndex = item.sections.findIndex((section) => section.type === "hero");

  return (
    <DesignFrame set={set}>
      <main data-page-type={pageType} data-collection={item.collection} data-slug={item.slug} data-design-set={set}>
        <h1>{item.title}</h1>
        {fields.imageId ? <Image mediaId={fields.imageId} alt={fields.imageAltOverride} sizes="(max-width: 900px) 100vw, 50vw" /> : null}
        {item.sections.map((section, index) => (
          <section key={index} data-section={section.type}>
            {index === heroIndex ? <DesignScripts set={set} slot="hero" /> : null}
          </section>
        ))}
      </main>
    </DesignFrame>
  );
}
