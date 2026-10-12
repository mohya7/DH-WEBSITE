import type { SiteSettings } from "@/content/build-content";
import { behaviorUrl, consentStyleUrl } from "@/design/behaviors";

export const consentDefaults = {
  title: "Cookies on this site",
  body: "We use necessary cookies to run the site. Analytics and marketing stay off until you allow them.",
  accept: "Accept all",
  reject: "Reject all",
  analytics: "Analytics only",
  settings: "Cookie settings",
};

/** A container id the site will load, or null when Tag Manager must stay absent. */
export function tagManagerId(settings: SiteSettings, env: Record<string, string | undefined> = process.env): string | null {
  const value = (env.ANALYTICS_CONTAINER_ID?.trim() || settings.analyticsContainerId || "").trim();
  return /^GTM-[A-Z0-9]{7,}$/.test(value) ? value : null;
}

function text(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function consentCopy(settings: SiteSettings) {
  return {
    title: text(settings.cookieBannerTitle, consentDefaults.title),
    body: text(settings.cookieBannerText, consentDefaults.body),
    accept: text(settings.cookieAcceptLabel, consentDefaults.accept),
    reject: text(settings.cookieRejectLabel, consentDefaults.reject),
    analytics: text(settings.cookieAnalyticsLabel, consentDefaults.analytics),
    settings: text(settings.cookieSettingsLabel, consentDefaults.settings),
  };
}

/** Banner, stylesheet, and script. Renders nothing when there is no container id. */
export function Consent({ settings }: { settings: SiteSettings }) {
  const container = tagManagerId(settings);
  if (!container) return null;
  const copy = consentCopy(settings);
  return <>
    <link rel="stylesheet" href={consentStyleUrl()} />
    <div className="cookie-banner" id="cookieBanner" role="dialog" aria-modal="true" aria-labelledby="cookieBannerTitle" hidden>
      <h2 id="cookieBannerTitle">{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="cookie-banner__actions">
        <button type="button" data-consent="reject">{copy.reject}</button>
        <button type="button" data-consent="analytics">{copy.analytics}</button>
        <button type="button" data-consent="accept">{copy.accept}</button>
      </div>
    </div>
    <script src={behaviorUrl("consent")} data-container={container} />
  </>;
}
