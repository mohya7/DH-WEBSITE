/*
 * The public website's address, VITE_PUBLIC_SITE_URL, set per environment.
 *
 * There is no default. A missing or malformed value is an error, raised when the
 * Studio is started or built (vite.config.ts) and again when the app loads, so a
 * wrong address can never ship as a silent fallback.
 */

export const siteUrlVariable = "VITE_PUBLIC_SITE_URL";

/**
 * The website's address without a trailing slash, so a public path can be
 * appended to it. Only an absolute http(s) URL with no credentials, query, or
 * fragment is accepted.
 */
export function parseSiteUrl(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (raw === "") {
    throw new Error(`${siteUrlVariable} is not set. Set it to the public website's address for this environment, for example https://www.digitalhub.com.eg.`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${siteUrlVariable} must be an absolute http(s) URL, such as https://www.digitalhub.com.eg. Got "${raw}".`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${siteUrlVariable} must be an absolute http(s) URL, such as https://www.digitalhub.com.eg. Got "${raw}".`);
  }

  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new Error(`${siteUrlVariable} must be the website's address only, with no credentials, query, or fragment. Got "${raw}".`);
  }

  return url.href.replace(/\/+$/, "");
}
