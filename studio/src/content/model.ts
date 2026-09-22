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
  sections: boolean;
  ordered: boolean;
};

export const collectionRoutes: CollectionRoute[] = [
  { path: "pages", collection: "pages", label: "Pages", sections: true, ordered: false },
  { path: "services", collection: "services", label: "Services", sections: true, ordered: true },
  { path: "partners", collection: "partners", label: "Partners", sections: true, ordered: true },
  { path: "case-studies", collection: "case-studies", label: "Case studies", sections: true, ordered: true },
  { path: "blog-posts", collection: "blog-posts", label: "Blog posts", sections: false, ordered: false },
  { path: "vacancies", collection: "vacancies", label: "Vacancies", sections: false, ordered: false },
  { path: "team", collection: "team-members", label: "Team", sections: false, ordered: true },
  { path: "news", collection: "news-items", label: "News", sections: false, ordered: true },
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

export function labelFromKey(key: string): string {
  const spaced = key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
