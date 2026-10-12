/*
 * sitemap.xml, robots.txt, and llms.txt, written at build from the published
 * content. Unpublished items, noindex pages, and the error pages are absent.
 */
import type { AnyContentItem } from "../content/build-content";
import type { Site } from "../content/site";
import { canonicalUrl, documentDescription } from "./head";
import { editorialLastMod } from "./jsonld";

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function indexablePages(site: Site): AnyContentItem[] {
  return site.routes.filter((route) => !route.item.noIndex).map((route) => route.item);
}

export function renderSitemap(site: Site, origin: string): string {
  const urls = indexablePages(site)
    .map((item) => {
      const loc = canonicalUrl(origin, item.path ?? "/", item.canonicalOverride);
      const lastmod = editorialLastMod(item);
      return `  <url><loc>${xml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
    })
    .sort();
  return `<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function renderRobots(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

function link(item: AnyContentItem, origin: string): string {
  return `- [${item.title.replace(/[\[\]]/g, "")}](${canonicalUrl(origin, item.path ?? "/", item.canonicalOverride)})`;
}

/** A short description of the site and its main pages, from the content. */
export function renderLlms(site: Site, origin: string): string {
  const settings = site.content.settings;
  const pages = indexablePages(site);
  const byCollection = (name: AnyContentItem["collection"]) => pages.filter((item) => item.collection === name).sort((a, b) => a.title.localeCompare(b.title));
  const companyPaths = new Set(["/about", "/partners", "/cases", "/blogs", "/careers", "/news", "/contact"]);
  const company = pages.filter((item) => item.collection === "pages" && item.path && companyPaths.has(item.path)).sort((a, b) => a.path!.localeCompare(b.path!));
  const home = pages.find((item) => item.path === "/");
  const summary = (home && documentDescription(home)) || settings.defaultMetaDescription?.trim();
  const address = [settings.streetAddress, settings.locality, settings.region, settings.postalCode, settings.country].flatMap((part) => part?.trim() ? [part.trim()] : []);
  const lines = [`# ${settings.organizationName?.trim() || settings.legalName?.trim() || "Website"}`, ""];
  if (summary) lines.push(`> ${summary}`, "");
  const section = (heading: string, items: AnyContentItem[]) => {
    if (items.length === 0) return;
    lines.push(`## ${heading}`, ...items.map((item) => link(item, origin)), "");
  };
  section("Services", byCollection("services"));
  section("Partners", byCollection("partners"));
  section("Company", company);
  if (settings.email || settings.phone || address.length > 0) {
    lines.push("## Contact");
    if (settings.email) lines.push(`Email: ${settings.email.trim()}`);
    if (settings.phone) lines.push(`Phone: ${settings.phone.trim()}`);
    if (address.length > 0) lines.push(`Address: ${address.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}
