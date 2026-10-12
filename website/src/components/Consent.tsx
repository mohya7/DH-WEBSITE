import type { SiteSettings } from "@/content/build-content";
import { tagManagerId } from "@/content/tag-manager";
import { behaviorUrl, consentStyleUrl } from "@/design/behaviors";

export { tagManagerId };

export const consentDefaults = {
  title: "Cookies on this site",
  body: "We use necessary cookies to run the site. Analytics and marketing stay off until you allow them.",
  accept: "Accept all",
  reject: "Reject all",
  analytics: "Analytics only",
  settings: "Cookie settings",
};

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

/**
 * Banner, stylesheet, and script. Renders nothing when there is no container id.
 * A non-modal bottom banner: a dialog role without aria-modal, because the page
 * behind it stays usable. consent.js reserves its height below the footer.
 */
export function Consent({ settings }: { settings: SiteSettings }) {
  const container = tagManagerId(settings);
  if (!container) return null;
  const copy = consentCopy(settings);
  return <>
    <link rel="stylesheet" href={consentStyleUrl()} />
    <div className="cookie-banner" id="cookieBanner" role="dialog" aria-labelledby="cookieBannerTitle" hidden>
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
