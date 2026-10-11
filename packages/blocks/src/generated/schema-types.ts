/*
 * GENERATED FILE — do not edit.
 * Source: packages/sections/*.json and packages/collections/*.json
 * Regenerate: npm run gen:types (in website/). The build fails if this is stale.
 */

/* ---- Shared definitions (packages/sections/defs.json) ---- */

export interface Media {
  mediaId: string;
  alt: string;
  decorative: boolean;
}

/** inlineText: TipTap JSON document of one paragraph, serialized as a string: text with bold, italic, and link marks only; a link is a { type, id } reference or a #fragment. At most 4096 UTF-8 bytes. */
export type InlineText = string;

export interface Reference {
  type: "service" | "partner" | "case_study" | "blog_post" | "page";
  id: string;
}

export interface Link {
  label: string;
  /** url */
  href: string;
}

export interface TextPair {
  title: string;
  /** longText */
  text: string;
}

export type Block = {
  kind: "paragraph";
  /** longText */
  text: string;
} | {
  kind: "list";
  items: string[];
};

/* ---- Sections (packages/sections) ---- */

/** Fields of the `blog_list` section. */
export interface BlogListFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  action?: Link;
  filters?: string[];
  items: Array<{
    image?: Media;
    category?: string;
    title: string;
    /** longText */
    text?: string;
    readTime?: string;
    reference?: Reference;
  }>;
}

/** Fields of the `call_to_action` section. */
export interface CallToActionFields {
  heading: string;
  /** longText */
  text?: string;
  action?: Link;
}

/** Fields of the `case_cards` section. */
export interface CaseCardsFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  action?: Link;
  filters?: string[];
  items: Array<{
    image?: Media;
    title: string;
    /** longText */
    text?: string;
    action?: Link;
    reference?: Reference;
  }>;
}

/** Fields of the `contact_details` section. */
export interface ContactDetailsFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  channels?: Link[];
  form: {
    situationLabel: string;
    situationPlaceholder?: string;
    situations?: Array<{
      value: string;
      label: string;
    }>;
    namePlaceholder?: string;
    organizationPlaceholder?: string;
    rolePlaceholder?: string;
    emailPlaceholder?: string;
    /** longText */
    messagePlaceholder?: string;
    buttonText: string;
    buttonTexts?: Array<{
      value: string;
      label: string;
    }>;
    sendingText?: string;
    /** longText */
    successMessage: string;
    /** longText */
    errorMessage?: string;
  };
}

/** Fields of the `delivery_flow` section. */
export interface DeliveryFlowFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  inputs?: string[];
  hub?: string[];
  outputs?: string[];
}

/** Fields of the `faq` section. */
export interface FaqFields {
  items: Array<{
    question: string;
    /** longText */
    answer: string;
  }>;
}

/** Fields of the `feature_grid` section. */
export interface FeatureGridFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  items: Array<{
    index?: string;
    title: string;
    /** longText */
    text?: string;
    points?: string[];
    image?: Media;
  }>;
}

/** Fields of the `hero` section. */
export interface HeroFields {
  eyebrow?: string;
  heading: InlineText;
  /** longText */
  lead?: string;
  kicker?: string;
  client?: string;
  back?: Link;
  image?: Media;
  tags?: string[];
  actions?: Link[];
  proof?: Array<{
    value: string;
    label: string;
  }>;
  logos?: Array<{
    image: Media;
    /** url */
    href?: string;
    reference?: Reference;
  }>;
}

/** Fields of the `hub_hero` section. */
export interface HubHeroFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
}

/** Fields of the `industries` section. */
export interface IndustriesFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  items: TextPair[];
}

/** Fields of the `logo_bar` section. */
export interface LogoBarFields {
  label?: string;
  logos: Media[];
}

/** Fields of the `methodology` section. */
export interface MethodologyFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  steps: Array<{
    index?: string;
    title: string;
    /** longText */
    text: string;
    image?: Media;
  }>;
}

/** Fields of the `news_carousel` section. */
export interface NewsCarouselFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  action?: Link;
  items: Array<{
    image?: Media;
    category?: string;
    place?: string;
    title: string;
    /** longText */
    text?: string;
    /** longText */
    details?: string;
    detailsLabel?: string;
    year?: string;
    month?: string;
  }>;
}

/** Fields of the `partner_focus` section. */
export interface PartnerFocusFields {
  eyebrow?: string;
  heading: string;
  items: TextPair[];
}

/** Fields of the `partner_grid` section. */
export interface PartnerGridFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  action?: Link;
  items: Array<{
    image?: Media;
    title?: string;
    /** longText */
    text?: string;
    action?: Link;
    reference?: Reference;
  }>;
}

/** Fields of the `partner_overview` section. */
export interface PartnerOverviewFields {
  eyebrow?: string;
  index?: string;
  /** longText */
  lede?: string;
  paragraphs?: string[];
  deliverablesLabel?: string;
  deliverablesHeading?: string;
  chips?: string[];
  action?: Link;
}

/** Fields of the `pillars` section. */
export interface PillarsFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  items: TextPair[];
}

/** Fields of the `problem` section. */
export interface ProblemFields {
  eyebrow?: string;
  heading: string;
  lead?: InlineText;
  diagramTitle?: string;
  diagramStatus?: string;
  flow?: string[];
  cards?: TextPair[];
  outcomes?: TextPair[];
  /** longText */
  quote?: string;
  cite?: string;
  blocks?: Block[];
}

/** Fields of the `profile` section. */
export interface ProfileFields {
  image?: Media;
  name: string;
  role?: string;
  /** longText */
  quote: string;
  cite?: string;
}

/** Fields of the `related_items` section. */
export interface RelatedItemsFields {
  eyebrow?: string;
  heading: string;
  items: Array<{
    type: "service" | "partner" | "case_study" | "blog_post";
    id: string;
    label?: string;
    title: string;
    /** longText */
    text: string;
    action?: string;
    image?: Media;
  }>;
}

/** Fields of the `rich_text` section. */
export interface RichTextFields {
  eyebrow?: string;
  heading: string;
  /** richText: TipTap JSON document, serialized as a string. */
  body?: string;
  blocks?: Block[];
}

/** Fields of the `service_cards` section. */
export interface ServiceCardsFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  diagramLabel?: string;
  items?: Array<{
    title: string;
    /** longText */
    text?: string;
    action?: Link;
    reference?: Reference;
    marks?: string[];
  }>;
}

/** Fields of the `service_hero` section. */
export interface ServiceHeroFields {
  eyebrow?: string;
  heading: string;
  lead?: InlineText;
  action?: Link;
  marks?: string[];
}

/** Fields of the `stats` section. */
export interface StatsFields {
  eyebrow?: string;
  heading?: string;
  /** longText */
  lead?: string;
  items: Array<{
    value: string;
    /** longText */
    label: string;
  }>;
}

/** Fields of the `team_grid` section. */
export interface TeamGridFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  members: Array<{
    image?: Media;
    name: string;
    role: string;
  }>;
}

/** Fields of the `timeline` section. */
export interface TimelineFields {
  eyebrow?: string;
  heading: string;
  /** longText */
  lead?: string;
  items: Array<{
    year: string;
    /** longText */
    text: string;
    image?: Media;
  }>;
}

/** Fields of the `vacancy_list` section. */
export interface VacancyListFields {
  heading: string;
  /** longText */
  lead: string;
  actionLabel: string;
  /** longText */
  emptyMessage: string;
}

/** Fields of the `values` section. */
export interface ValuesFields {
  breadcrumb?: string[];
  badge?: string[];
  photos?: Media[];
  items: TextPair[];
}

export const sectionTypes = [
  "blog_list",
  "call_to_action",
  "case_cards",
  "contact_details",
  "delivery_flow",
  "faq",
  "feature_grid",
  "hero",
  "hub_hero",
  "industries",
  "logo_bar",
  "methodology",
  "news_carousel",
  "partner_focus",
  "partner_grid",
  "partner_overview",
  "pillars",
  "problem",
  "profile",
  "related_items",
  "rich_text",
  "service_cards",
  "service_hero",
  "stats",
  "team_grid",
  "timeline",
  "vacancy_list",
  "values",
] as const;

export type SectionType = (typeof sectionTypes)[number];

export interface SectionFieldsByType {
  blog_list: BlogListFields;
  call_to_action: CallToActionFields;
  case_cards: CaseCardsFields;
  contact_details: ContactDetailsFields;
  delivery_flow: DeliveryFlowFields;
  faq: FaqFields;
  feature_grid: FeatureGridFields;
  hero: HeroFields;
  hub_hero: HubHeroFields;
  industries: IndustriesFields;
  logo_bar: LogoBarFields;
  methodology: MethodologyFields;
  news_carousel: NewsCarouselFields;
  partner_focus: PartnerFocusFields;
  partner_grid: PartnerGridFields;
  partner_overview: PartnerOverviewFields;
  pillars: PillarsFields;
  problem: ProblemFields;
  profile: ProfileFields;
  related_items: RelatedItemsFields;
  rich_text: RichTextFields;
  service_cards: ServiceCardsFields;
  service_hero: ServiceHeroFields;
  stats: StatsFields;
  team_grid: TeamGridFields;
  timeline: TimelineFields;
  vacancy_list: VacancyListFields;
  values: ValuesFields;
}

/** A section as it appears on a page: its type, and fields matching that type's schema. */
export type Section = {
  [T in SectionType]: { type: T; fields: SectionFieldsByType[T] };
}[SectionType];

/* ---- Collections (packages/collections) ---- */

/** Item fields of the `blog-posts` collection. */
export interface BlogPostsFields {
  /** Summary. longText */
  summary?: string | null;
  /** Image. mediaId: Id of a media library item. */
  imageId?: string | null;
  /** Image alt text */
  imageAltOverride?: string | null;
  /** Category */
  category?: string | null;
  /** Category label */
  categoryLabel?: string | null;
  /** Read time */
  readTime?: number | null;
  /** Accent */
  accent?: string | null;
  /** Cluster */
  cluster?: string | null;
  /** Article. richText: TipTap JSON document, serialized as a string. */
  body?: string | null;
  /** Answer. longText */
  answerBlock?: string | null;
  /** FAQ. longText */
  faq?: string | null;
  /** Publication date. date: Calendar date, YYYY-MM-DD. No time and no zone. */
  datePublished?: string | null;
  /** Modified date. date: Calendar date, YYYY-MM-DD. No time and no zone. */
  dateModified?: string | null;
  /** Featured */
  featured?: boolean | null;
}

/** Item fields of the `case-studies` collection. */
export interface CaseStudiesFields {
  /** Summary. longText */
  summary?: string | null;
  /** Image. mediaId: Id of a media library item. */
  imageId?: string | null;
  /** Image alt text */
  imageAltOverride?: string | null;
  /** Metric */
  metric?: string | null;
  /** Categories */
  categories?: string[] | null;
  /** Featured */
  featured?: boolean | null;
}

/** Item fields of the `news-items` collection. */
export interface NewsItemsFields {
  /** Summary. longText */
  summary?: string | null;
  /** Details. longText */
  details?: string | null;
  /** Image. mediaId: Id of a media library item. */
  imageId?: string | null;
  /** Image alt text */
  imageAltOverride?: string | null;
  /** Category */
  category?: string | null;
  /** Location */
  location?: string | null;
  /** Year */
  year?: string | null;
  /** Month */
  month?: string | null;
  /** Featured */
  featured?: boolean | null;
}

/** Item fields of the `pages` collection. */
export type PagesFields = Record<string, never>;

/** Item fields of the `partners` collection. */
export interface PartnersFields {
  /** Summary. longText */
  summary?: string | null;
  /** Image. mediaId: Id of a media library item. */
  imageId?: string | null;
  /** Image alt text */
  imageAltOverride?: string | null;
  /** Variant */
  variant?: string | null;
  /** Featured */
  featured?: boolean | null;
}

/** Item fields of the `services` collection. */
export interface ServicesFields {
  /** Summary. longText */
  summary?: string | null;
  /** Icon */
  icon?: string | null;
  /** Visual */
  visual?: string | null;
  /** Featured */
  featured?: boolean | null;
}

/** Item fields of the `team-members` collection. */
export interface TeamMembersFields {
  /** Role */
  role?: string | null;
  /** Portrait. mediaId: Id of a media library item. */
  imageId?: string | null;
  /** Portrait alt text */
  imageAltOverride?: string | null;
  /** Email */
  email?: string | null;
  /** LinkedIn. url */
  linkedIn?: string | null;
  /** Featured */
  featured?: boolean | null;
}

/** Item fields of the `vacancies` collection. */
export interface VacanciesFields {
  /** Summary. longText */
  summary?: string | null;
  /** Department */
  department?: string | null;
  /** Location */
  location?: string | null;
  /** Employment type */
  employmentType?: string | null;
  /** About the role. longText */
  aboutRole?: string | null;
  /** Key responsibilities. longText */
  keyResponsibilities?: string | null;
  /** Required skills. longText */
  requiredSkills?: string | null;
  /** Nice to have. longText */
  niceToHave?: string | null;
  /** What the role offers. longText */
  roleOffers?: string | null;
  /** Interview stages */
  interviewStages?: string[] | null;
  /** Featured */
  featured?: boolean | null;
}

export const collectionNames = [
  "blog-posts",
  "case-studies",
  "news-items",
  "pages",
  "partners",
  "services",
  "team-members",
  "vacancies",
] as const;

export type CollectionName = (typeof collectionNames)[number];

export interface CollectionFieldsByName {
  "blog-posts": BlogPostsFields;
  "case-studies": CaseStudiesFields;
  "news-items": NewsItemsFields;
  "pages": PagesFields;
  "partners": PartnersFields;
  "services": ServicesFields;
  "team-members": TeamMembersFields;
  "vacancies": VacanciesFields;
}
