/*
 * Section 2 scaffold: proves every route receives its item and typed sections.
 * Section 5 replaces the body with the real page composition; until then each
 * section is an empty, labelled slot and no stylesheet is loaded.
 */
import { Image } from "@/adapters/Image";
import type { AnyContentItem } from "@/content/site";
import type { PageType } from "@/content/routes";

export function PageScaffold({ item, pageType }: { item: AnyContentItem; pageType: PageType | "error" }) {
  const fields = item.fields as { imageId?: string | null; imageAltOverride?: string | null };

  return (
    <main data-page-type={pageType} data-collection={item.collection} data-slug={item.slug}>
      <h1>{item.title}</h1>
      {fields.imageId ? <Image mediaId={fields.imageId} alt={fields.imageAltOverride} sizes="(max-width: 900px) 100vw, 50vw" /> : null}
      {item.sections.map((section, index) => (
        <section key={index} data-section={section.type} />
      ))}
    </main>
  );
}
