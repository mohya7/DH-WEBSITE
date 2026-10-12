/*
 * The public site address, from PUBLIC_SITE_URL. Canonical URLs, the sitemap,
 * robots.txt, and llms.txt are built from it. There is no default: a missing
 * or malformed value stops the build.
 *
 * Accepted: an absolute http or https URL with no userinfo and no query.
 * https://digitalhub.com.eg and http://127.0.0.1:4380 are accepted.
 * ftp://x, //x, https://user:pw@x, https://x?y=1, and javascript: are refused.
 */
export class SiteUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteUrlError";
  }
}

const how = "Set PUBLIC_SITE_URL to the absolute website address, for example https://digitalhub.com.eg.";

export function readSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.PUBLIC_SITE_URL?.trim() ?? "";
  if (!raw) throw new SiteUrlError(`PUBLIC_SITE_URL is not set. ${how}`);
  if (raw.startsWith("//")) throw new SiteUrlError(`PUBLIC_SITE_URL must be an absolute http(s) URL. ${how}`);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SiteUrlError(`PUBLIC_SITE_URL is not a valid URL: "${raw}". ${how}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SiteUrlError(`PUBLIC_SITE_URL must be http or https, not "${url.protocol}". ${how}`);
  }
  if (url.username || url.password) throw new SiteUrlError(`PUBLIC_SITE_URL must not contain a username or password. ${how}`);
  if (url.search) throw new SiteUrlError(`PUBLIC_SITE_URL must not contain a query string. ${how}`);
  if (url.pathname !== "/" && url.pathname !== "") throw new SiteUrlError(`PUBLIC_SITE_URL must be the site origin, not a page path. ${how}`);
  return url.origin;
}
