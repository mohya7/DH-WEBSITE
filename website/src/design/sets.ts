/*
 * What each page type loads, and in what order, exactly as the pages on
 * feature/interviewer-portal load it (Phase C, Section 3).
 *
 * Local paths are inside website/design/ and are served from the content-hashed
 * folder /design/<hash>/. External URLs load from the same hosts as today.
 * `scripts/design-sources.ts --sets` compares every set with the old pages.
 *
 * Not ported: content/site-content.js and js/content-runtime.js (the old runtime
 * content loader; content is rendered at build instead), js/webgl-fluid.mjs
 * (unused), and the contact page's inline script (the old contact form handler;
 * Section 5.4 builds the form).
 */

export const GOOGLE_FONTS = "https://fonts.googleapis.com";
export const GOOGLE_FONTS_STATIC = "https://fonts.gstatic.com";
export const POPPINS = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap";
export const TABLER_ICONS = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css";
export const GSAP = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
export const SCROLL_TRIGGER = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js";
export const LENIS = "https://cdn.jsdelivr.net/gh/studio-freight/lenis@1.0.23/bundled/lenis.min.js";

export type HeadItem =
  | { rel: "preconnect"; href: string; crossOrigin?: true }
  | { rel: "stylesheet"; href: string }
  | { rel: "modulepreload"; href: string };

export interface ScriptItem {
  src: string;
  module?: true;
}

/**
 * Where a script sits in the body, as on the old pages:
 *   body-start  first thing in <body>
 *   after-nav   straight after the header's </nav>
 *   hero        inside the home hero, after its canvases
 *   body-end    after the footer
 */
export type ScriptSlot = "body-start" | "after-nav" | "hero" | "body-end";

export interface DesignSet {
  /** The old pages this set was taken from. */
  from: string[];
  head: HeadItem[];
  scripts: Partial<Record<ScriptSlot, ScriptItem[]>>;
}

const fonts: HeadItem[] = [
  { rel: "preconnect", href: GOOGLE_FONTS },
  { rel: "preconnect", href: GOOGLE_FONTS_STATIC, crossOrigin: true },
  { rel: "stylesheet", href: POPPINS },
  { rel: "stylesheet", href: TABLER_ICONS },
];

const css = (...names: string[]): HeadItem[] => names.map((name) => ({ rel: "stylesheet", href: `css/${name}.css` }));
const js = (...names: string[]): ScriptItem[] => names.map((name) => ({ src: `js/${name}.js` }));
const motion: ScriptItem[] = [{ src: GSAP }, { src: SCROLL_TRIGGER }, { src: LENIS }];

export const designSets = {
  home: {
    from: ["index.html"],
    head: [
      ...fonts,
      { rel: "modulepreload", href: "js/hero-fluid.js" },
      { rel: "modulepreload", href: "js/webgl-fluid-lib.js" },
      { rel: "stylesheet", href: "index.inline.css" },
      ...css("tv", "responsive"),
    ],
    scripts: {
      "body-start": [{ src: "index.inline-1.js" }],
      "after-nav": [{ src: "index.inline-2.js" }],
      hero: [{ src: "js/hero-fluid.js", module: true }],
      "body-end": [
        { src: "index.inline-3.js" },
        ...motion,
        { src: "index.inline-4.js" },
        { src: "index.inline-5.js" },
        { src: "index.inline-6.js" },
        ...js("nav-stay-on-page"),
      ],
    },
  },
  about: {
    from: ["about-us.html"],
    head: [...fonts, ...css("service-page", "about-page", "tv", "responsive")],
    scripts: { "body-end": [...motion, ...js("about-page", "nav-stay-on-page")] },
  },
  contact: {
    from: ["get-in-touch.html"],
    head: [...fonts, ...css("service-page", "hub-pages", "tv", "responsive"), { rel: "stylesheet", href: "get-in-touch.inline.css" }],
    scripts: { "body-end": js("shared", "hub-pages") },
  },
  hub: {
    from: ["partners/index.html", "cases/index.html", "blogs/index.html", "news/index.html", "partners/microsoft.html", "partners/huawei.html", "partners/nexthink.html", "partners/efinance.html", "partners/vodafone.html"],
    head: [...fonts, ...css("service-page", "hub-pages", "tv", "responsive")],
    scripts: { "body-end": js("shared", "nav-stay-on-page", "hub-pages") },
  },
  "blog-post": {
    from: ["blogs/digital-employee-experience.html", "blogs/azure-digital-egypt-2030.html", "blogs/enterprise-ai-production.html", "blogs/digital-transformation-signs.html", "blogs/augment-vs-outsource-tech-team.html"],
    head: [...fonts, ...css("service-page", "hub-pages", "tv", "responsive")],
    scripts: { "body-end": js("shared", "nav-stay-on-page") },
  },
  careers: {
    from: ["careers/index.html"],
    head: [...fonts, ...css("service-page", "hub-pages", "careers-page", "tv", "responsive")],
    scripts: { "body-end": js("shared", "nav-stay-on-page", "hub-pages") },
  },
  apply: {
    from: ["careers/apply.html"],
    head: [...fonts, ...css("service-page", "hub-pages", "careers-page", "tv", "responsive")],
    scripts: { "body-end": js("shared", "nav-stay-on-page", "hub-pages", "careers-apply") },
  },
  vacancy: {
    from: ["careers/data-analyst.html", "careers/dotnet-backend-developer.html", "careers/full-stack-developer.html"],
    head: [...fonts, ...css("service-page", "hub-pages", "careers-page", "tv", "responsive")],
    scripts: { "body-end": js("shared", "nav-stay-on-page", "hub-pages") },
  },
  "case-study": {
    from: ["cases/ministry-planning.html", "cases/data-center-transformation.html", "cases/nexthink-dex-bank.html"],
    head: [{ rel: "stylesheet", href: TABLER_ICONS }, ...css("shared", "responsive")],
    scripts: { "body-end": js("shared", "nav-stay-on-page") },
  },
  service: {
    from: ["services/ai-automation.html", "services/data-analytics.html", "services/enterprise-software.html", "services/outsourcing.html"],
    head: [...fonts, ...css("service-page", "tv", "responsive")],
    scripts: { "body-end": [...motion, ...js("service-page", "nav-stay-on-page")] },
  },
} satisfies Record<string, DesignSet>;

export type DesignSetName = keyof typeof designSets;

/**
 * The set for a page. Pages are matched by slug, other page types by type.
 * 404 and 500 use the hub set (confirmed); so does any page added later that
 * has no counterpart on the old site.
 */
export function designSetFor(pageType: string, slug: string): DesignSetName {
  if (pageType === "home") return "home";
  if (pageType === "page") {
    if (slug === "about") return "about";
    if (slug === "contact") return "contact";
    if (slug === "careers") return "careers";
    if (slug === "apply") return "apply";
    return "hub";
  }
  if (pageType === "service") return "service";
  if (pageType === "case-study") return "case-study";
  if (pageType === "blog-post") return "blog-post";
  if (pageType === "vacancy") return "vacancy";
  return "hub";
}
