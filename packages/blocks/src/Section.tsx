/*
 * Renders one section by its type. Every one of the 28 section types has its
 * component here; a type without one is a build error, not a silent gap.
 */
import type { ReactNode } from "react";
import type { BlockContext } from "./context";
import type { Section as SectionData, SectionFieldsByType, SectionType } from "./generated/schema-types";
import { BlogList } from "./sections/BlogList";
import { CallToAction } from "./sections/CallToAction";
import { CaseCards } from "./sections/CaseCards";
import { ContactDetails } from "./sections/ContactDetails";
import { Hero } from "./sections/Hero";
import { DeliveryFlow } from "./sections/DeliveryFlow";
import { Faq } from "./sections/Faq";
import { FeatureGrid } from "./sections/FeatureGrid";
import { HubHero } from "./sections/HubHero";
import { Pillars } from "./sections/Pillars";
import { NewsCarousel } from "./sections/NewsCarousel";
import { PartnerFocus } from "./sections/PartnerFocus";
import { PartnerGrid } from "./sections/PartnerGrid";
import { PartnerOverview } from "./sections/PartnerOverview";
import { Problem } from "./sections/Problem";
import { RelatedItems } from "./sections/RelatedItems";
import { RichTextSection } from "./sections/RichTextSection";
import { Industries } from "./sections/Industries";
import { LogoBar } from "./sections/LogoBar";
import { Methodology } from "./sections/Methodology";
import { Profile } from "./sections/Profile";
import { ServiceCards } from "./sections/ServiceCards";
import { ServiceHero } from "./sections/ServiceHero";
import { Stats } from "./sections/Stats";
import { TeamGrid } from "./sections/TeamGrid";
import { Timeline } from "./sections/Timeline";
import { VacancyList } from "./sections/VacancyList";
import { Values } from "./sections/Values";

type Renderers = { [T in SectionType]: (fields: SectionFieldsByType[T], ctx: BlockContext) => ReactNode };

const renderers: Renderers = {
  blog_list: (fields, ctx) => <BlogList fields={fields} ctx={ctx} />,
  case_cards: (fields, ctx) => <CaseCards fields={fields} ctx={ctx} />,
  call_to_action: (fields, ctx) => <CallToAction fields={fields} ctx={ctx} />,
  contact_details: (fields, ctx) => <ContactDetails fields={fields} ctx={ctx} />,
  delivery_flow: (fields, ctx) => <DeliveryFlow fields={fields} ctx={ctx} />,
  faq: (fields, ctx) => <Faq fields={fields} ctx={ctx} />,
  feature_grid: (fields, ctx) => <FeatureGrid fields={fields} ctx={ctx} />,
  hero: (fields, ctx) => <Hero fields={fields} ctx={ctx} />,
  hub_hero: (fields, ctx) => <HubHero fields={fields} ctx={ctx} />,
  pillars: (fields, ctx) => <Pillars fields={fields} ctx={ctx} />,
  news_carousel: (fields, ctx) => <NewsCarousel fields={fields} ctx={ctx} />,
  partner_grid: (fields, ctx) => <PartnerGrid fields={fields} ctx={ctx} />,
  partner_focus: (fields, ctx) => <PartnerFocus fields={fields} ctx={ctx} />,
  partner_overview: (fields, ctx) => <PartnerOverview fields={fields} ctx={ctx} />,
  problem: (fields, ctx) => <Problem fields={fields} ctx={ctx} />,
  related_items: (fields, ctx) => <RelatedItems fields={fields} ctx={ctx} />,
  rich_text: (fields, ctx) => <RichTextSection fields={fields} ctx={ctx} />,
  industries: (fields, ctx) => <Industries fields={fields} ctx={ctx} />,
  logo_bar: (fields, ctx) => <LogoBar fields={fields} ctx={ctx} />,
  methodology: (fields, ctx) => <Methodology fields={fields} ctx={ctx} />,
  profile: (fields, ctx) => <Profile fields={fields} ctx={ctx} />,
  service_cards: (fields, ctx) => <ServiceCards fields={fields} ctx={ctx} />,
  service_hero: (fields, ctx) => <ServiceHero fields={fields} ctx={ctx} />,
  stats: (fields, ctx) => <Stats fields={fields} ctx={ctx} />,
  team_grid: (fields, ctx) => <TeamGrid fields={fields} ctx={ctx} />,
  timeline: (fields, ctx) => <Timeline fields={fields} ctx={ctx} />,
  vacancy_list: (fields, ctx) => <VacancyList fields={fields} ctx={ctx} />,
  values: (fields, ctx) => <Values fields={fields} ctx={ctx} />,
};

export function Section({ section, ctx }: { section: SectionData; ctx: BlockContext }) {
  const render = renderers[section.type] as (fields: unknown, ctx: BlockContext) => ReactNode;
  return <>{render(section.fields, ctx)}</>;
}
