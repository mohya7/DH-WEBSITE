export type StudioArea = {
  path: string;
  label: string;
  group: "Content" | "Library" | "Site" | "Administration";
  adminOnly?: boolean;
};

export const areas: StudioArea[] = [
  { path: "/pages", label: "Pages", group: "Content" },
  { path: "/services", label: "Services", group: "Content" },
  { path: "/partners", label: "Partners", group: "Content" },
  { path: "/case-studies", label: "Case studies", group: "Content" },
  { path: "/blog-posts", label: "Blog posts", group: "Content" },
  { path: "/vacancies", label: "Vacancies", group: "Content" },
  { path: "/team", label: "Team", group: "Content" },
  { path: "/news", label: "News", group: "Content" },
  { path: "/media", label: "Media library", group: "Library" },
  { path: "/navigation", label: "Navigation", group: "Site" },
  { path: "/redirects", label: "Redirects", group: "Site" },
  { path: "/contact", label: "Contact inbox", group: "Site" },
  { path: "/settings", label: "Site settings", group: "Site" },
  { path: "/error-pages", label: "Error pages", group: "Site" },
  { path: "/users", label: "Users", group: "Administration", adminOnly: true },
  { path: "/audit", label: "Audit log", group: "Administration", adminOnly: true },
];

const studioRoles = new Set(["admin", "editor"]);

export function isStudioRole(role: string): boolean {
  return studioRoles.has(role);
}

export function areasForRole(role: string): StudioArea[] {
  if (!isStudioRole(role)) {
    return [];
  }

  return areas.filter((area) => role === "admin" || !area.adminOnly);
}
