export type StudioArea = {
  path: string;
  label: string;
  group: "Website content" | "Website & system" | null;
  adminOnly?: boolean;
};

export const areas: StudioArea[] = [
  { path: "/", label: "Overview", group: null },
  { path: "/services", label: "Services", group: "Website content" },
  { path: "/case-studies", label: "Case Studies", group: "Website content" },
  { path: "/blog-posts", label: "Blog", group: "Website content" },
  { path: "/news", label: "News", group: "Website content" },
  { path: "/partners", label: "Partners", group: "Website content" },
  { path: "/contact", label: "Inbox", group: "Website content" },
  { path: "/team", label: "Leadership Team", group: "Website content" },
  { path: "/pages", label: "Pages", group: "Website content" },
  { path: "/vacancies", label: "Vacancies", group: "Website content" },
  { path: "/settings", label: "Site settings", group: "Website & system" },
  { path: "/media", label: "Media library", group: "Website & system" },
  { path: "/navigation", label: "Navigation", group: "Website & system" },
  { path: "/redirects", label: "Redirects", group: "Website & system" },
  { path: "/error-pages", label: "Error pages", group: "Website & system" },
  { path: "/users", label: "User Management", group: "Website & system", adminOnly: true },
  { path: "/audit", label: "Audit log", group: "Website & system", adminOnly: true },
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
