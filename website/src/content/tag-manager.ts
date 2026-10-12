/*
 * The Tag Manager container id comes from the site settings only (Studio, Site
 * settings, "Analytics container ID"). There is no build variable for it. Test
 * builds set it through a settings fixture (SNAPSHOT_SETTINGS_FIXTURE).
 *
 * The page markup, the footer control, the CSP in web.config, and the copied
 * consent files all follow this one value, so an empty id builds the site
 * exactly as it was before Tag Manager existed.
 */
import type { SiteSettings } from "./build-content";

/** A container id the site will load, or null when Tag Manager must stay absent. */
export function tagManagerId(settings: Pick<SiteSettings, "analyticsContainerId">): string | null {
  const value = (settings.analyticsContainerId ?? "").trim();
  return /^GTM-[A-Z0-9]{7,}$/.test(value) ? value : null;
}
