import { Section, RichText, parseRichText, type PageKind } from "@digitalhub/blocks";
import { blockContext } from "@/content/blocks";
import type { AnyContentItem, Site } from "@/content/site";
import { getSite } from "@/content/site";
import type { PageType } from "@/content/routes";
import { DesignFrame, DesignScripts } from "@/design/Design";
import { designSetFor } from "@/design/sets";
import { Header, Footer, SiteBackground } from "./SiteChrome";
import { BlogArticle } from "./BlogArticle";
import { HowToApply } from "./HowToApply";
import { VacancyPage } from "./VacancyPage";
import { behaviorUrl, homeSrStyleUrl } from "@/design/behaviors";
import { jsonLdText, structuredData } from "@/seo/jsonld";
import { readSiteUrl } from "@/seo/site-url";
import { Consent } from "./Consent";

const headingSections = new Set(["hero", "hub_hero", "service_hero"]);

/** Orange and teal remap the locked accent. Anything else, including empty, stays the default blue. */
function caseStudyBodyClass(item: AnyContentItem): string {
  const theme = item.collection === "case-studies" ? item.fields.theme : null;
  const accent = theme === "orange" ? "theme-orange " : theme === "teal" ? "theme-teal " : "";
  return `${accent}page-case`;
}
export function PageScaffold({ item, pageType, site = getSite(), path = item?.path ?? "" }: { item: AnyContentItem | null; pageType: PageType | "error"; site?: Site; path?: string }) {
  const set = designSetFor(pageType, item?.slug ?? "");
  const jsonLd = <script type="application/ld+json">{jsonLdText(structuredData(site, item, pageType, path || "/", readSiteUrl()))}</script>;
  if (!item) return <DesignFrame set={set}><Header site={site} set={set} currentPath="" /><main data-page-type={pageType} data-design-set={set} /><Footer site={site} set={set} /><Consent settings={site.content.settings} />{jsonLd}</DesignFrame>;
  const ctx = { ...blockContext(site, { kind: pageType as PageKind, slug: item.slug }), slots: { hero: <DesignScripts set={set} slot="hero" /> } };
  const hasHeading = item.sections.some((section) => headingSections.has(section.type));
  const hubPage = item?.slug === "blogs" ? " page-blogs" : item?.slug === "partners" ? " page-partners" : "";
  const bodyClass = set === "home" ? "" : set === "about" ? "page-about" : set === "service" ? "page-service" : set === "case-study" ? caseStudyBodyClass(item) : `page-hub${pageType === "partner" ? " page-partner-view" : set === "blog-post" ? " page-blog-view" : set === "contact" ? " page-contact" : ["careers", "apply", "vacancy"].includes(set) ? " page-careers" : hubPage}`;
  return <DesignFrame set={set}>
    {set === "home" ? <link rel="stylesheet" href={homeSrStyleUrl()} /> : null}
    <SiteBackground set={set} /><Header site={site} set={set} currentPath={item.path ?? ""} />
    <main data-page-type={pageType} data-collection={item.collection} data-slug={item.slug} data-design-set={set} data-body-class={bodyClass}>
      {item.collection === "blog-posts" ? <BlogArticle item={item} ctx={ctx} /> : item.collection === "vacancies" ? <VacancyPage item={item} email={site.content.settings.careersEmail || site.content.settings.email || ""} /> : <>
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
        {set === "apply" ? <HowToApply email={site.content.settings.careersEmail || site.content.settings.email || ""} /> : null}
      </>}
    </main>
    <Footer site={site} set={set} currentPath={item.path ?? ""} />
    <Consent settings={site.content.settings} />
    {item.sections.some((section) => section.type === "contact_details") ? <script src={behaviorUrl("contact")} data-contact-messages={JSON.stringify(item.sections.find((section) => section.type === "contact_details")!.fields)} /> : null}
    {jsonLd}
  </DesignFrame>;
}
