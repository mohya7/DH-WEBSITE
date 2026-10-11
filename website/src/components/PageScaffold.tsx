import { Section, RichText, parseRichText, type PageKind } from "@digitalhub/blocks";
import { blockContext } from "@/content/blocks";
import type { AnyContentItem, Site } from "@/content/site";
import { getSite } from "@/content/site";
import type { PageType } from "@/content/routes";
import { careersEndpoint } from "@/content/forms";
import { DesignFrame, DesignScripts } from "@/design/Design";
import { designSetFor } from "@/design/sets";
import { Header, Footer, SiteBackground } from "./SiteChrome";
import { BlogArticle } from "./BlogArticle";
import { ApplicationForm } from "./ApplicationForm";
import { VacancyPage } from "./VacancyPage";
import { behaviorUrl } from "@/design/behaviors";

const headingSections = new Set(["hero", "hub_hero", "service_hero"]);
export function PageScaffold({ item, pageType, site = getSite() }: { item: AnyContentItem | null; pageType: PageType | "error"; site?: Site }) {
  const set = designSetFor(pageType, item?.slug ?? "");
  if (!item) return <DesignFrame set={set}><Header site={site} set={set} currentPath="" /><main data-page-type={pageType} data-design-set={set} /><Footer site={site} set={set} /></DesignFrame>;
  const ctx = { ...blockContext(site, { kind: pageType as PageKind, slug: item.slug }), slots: { hero: <DesignScripts set={set} slot="hero" /> } };
  const hasHeading = item.sections.some((section) => headingSections.has(section.type));
  const bodyClass = set === "home" ? "" : set === "about" ? "page-about" : set === "service" ? "page-service" : set === "case-study" ? "page-case" : `page-hub${pageType === "partner" ? " page-partner-view" : set === "blog-post" ? " page-blog-view" : set === "contact" ? " page-contact" : ["careers", "apply", "vacancy"].includes(set) ? " page-careers" : ""}`;
  return <DesignFrame set={set}>
    <SiteBackground set={set} /><Header site={site} set={set} currentPath={item.path ?? ""} />
    <main data-page-type={pageType} data-collection={item.collection} data-slug={item.slug} data-design-set={set} data-body-class={bodyClass}>
      {item.collection === "blog-posts" ? <BlogArticle item={item} ctx={ctx} /> : item.collection === "vacancies" ? <VacancyPage item={item} /> : <>
        {hasHeading ? null : <Section section={{ type: "hub_hero", fields: { heading: item.title } }} ctx={ctx} />}
        {item.sections.map((section, index) => {
          if (pageType === "error" && section.type === "rich_text") return <section className="hub-cta" key={index}><div className="section-inner"><div className="hub-cta__card" data-reveal=""><div><RichText doc={parseRichText(section.fields.body)} ctx={ctx} /></div></div></div></section>;
          if (section.type === "contact_details") {
            const settings = site.content.settings;
            const channels = [
              ...(settings.phone ? [{ label: settings.phone, href: `tel:${settings.phone.replace(/[^+\d]/g, "")}` }] : []),
              ...(settings.whatsApp ? [{ label: "WhatsApp", href: settings.whatsApp }] : []),
              ...(settings.email ? [{ label: settings.email, href: `mailto:${settings.email}` }] : []),
            ];
            return <Section key={index} section={{ ...section, fields: { ...section.fields, channels } }} ctx={ctx} />;
          }
          return <Section key={index} section={section} ctx={ctx} />;
        })}
        {set === "apply" ? <ApplicationForm endpoint={careersEndpoint()} /> : null}
      </>}
    </main>
    <Footer site={site} set={set} currentPath={item.path ?? ""} />
    {item.sections.some((section) => section.type === "contact_details") ? <script src={behaviorUrl("contact")} data-contact-messages={JSON.stringify(item.sections.find((section) => section.type === "contact_details")!.fields)} /> : null}
  </DesignFrame>;
}
