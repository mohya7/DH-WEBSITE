export type CollectionName =
  | "pages"
  | "services"
  | "partners"
  | "case-studies"
  | "blog-posts"
  | "vacancies"
  | "team-members"
  | "news-items";

export type CollectionRoute = {
  path: string;
  collection: CollectionName;
  label: string;
  singular: string;
  description: string;
  sections: boolean;
  ordered: boolean;
  icon: string;
  media: "image" | "logo" | "portrait";
};

export const collectionRoutes: CollectionRoute[] = [
  { path: "pages", collection: "pages", label: "Pages", singular: "page", description: "Edit page documents, sections, and SEO.", sections: true, ordered: false, icon: "Pg", media: "image" },
  { path: "services", collection: "services", label: "Services", singular: "service", description: "Homepage service cards and full service pages.", sections: true, ordered: true, icon: "Sv", media: "image" },
  { path: "partners", collection: "partners", label: "Partners", singular: "partner", description: "Technology partners, logos, and summaries.", sections: true, ordered: true, icon: "Pt", media: "logo" },
  { path: "case-studies", collection: "case-studies", label: "Case Studies", singular: "case study", description: "Project outcomes shown on the work pages.", sections: true, ordered: true, icon: "Cs", media: "image" },
  { path: "blog-posts", collection: "blog-posts", label: "Blog", singular: "article", description: "Articles, clusters, and related posts.", sections: false, ordered: false, icon: "Bl", media: "image" },
  { path: "vacancies", collection: "vacancies", label: "Vacancies", singular: "vacancy", description: "Open roles, locations, and contract types.", sections: false, ordered: false, icon: "Vc", media: "image" },
  { path: "team", collection: "team-members", label: "Leadership Team", singular: "team member", description: "Leadership profiles and display order.", sections: false, ordered: true, icon: "Tm", media: "portrait" },
  { path: "news", collection: "news-items", label: "News", singular: "news item", description: "News cards and expandable details.", sections: false, ordered: true, icon: "Nw", media: "image" },
];

export function routeFor(collection: CollectionName): CollectionRoute {
  const route = collectionRoutes.find((item) => item.collection === collection);
  if (route === undefined) {
    throw new Error("Unknown collection.");
  }

  return route;
}

export function publicPath(collection: CollectionName, slug: string): string | null {
  if (collection === "pages") {
    if (slug === "home") return "/";
    if (slug === "about") return "/about";
    if (slug === "contact") return "/contact";
    if (slug === "apply") return "/careers/apply";
    return `/${slug}`;
  }

  if (collection === "services") return `/services/${slug}`;
  if (collection === "partners") return `/partners/${slug}`;
  if (collection === "case-studies") return `/cases/${slug}`;
  if (collection === "blog-posts") return `/blogs/${slug}`;
  if (collection === "vacancies") return `/careers/${slug}`;
  return null;
}

export const referenceCollections: Record<string, CollectionName> = {
  service: "services",
  partner: "partners",
  case_study: "case-studies",
  blog_post: "blog-posts",
  page: "pages",
  vacancy: "vacancies",
};

/**
 * Whether an inline-text field may carry bold, italic, and links. It may,
 * except a hero's heading on any page but a case study, which stays plain (the
 * home hero's heading is split into animated lines). The same rule as the
 * website build (packages/blocks/src/inline/document.ts) and the API.
 */
export function inlineMarksAllowed(collection: CollectionName, sectionType: string, field: string): boolean {
  return !(sectionType === "hero" && field === "heading" && collection !== "case-studies");
}

export function labelFromKey(key: string): string {
  const spaced = key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const websiteOrigin = import.meta.env.VITE_PUBLIC_SITE_URL ?? "http://127.0.0.1:8765";
