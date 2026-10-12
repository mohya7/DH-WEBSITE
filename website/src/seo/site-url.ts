/*
 * The public site address, from PUBLIC_SITE_URL. Canonical URLs, the sitemap,
 * robots.txt, and llms.txt are built from it. There is no default: a missing
 * or malformed value stops the build.
 *
 * Accepted: an absolute https origin with no userinfo and no query.
 * http is accepted only for localhost and 127.0.0.1. A trailing-dot host is refused.
 * When EXPECTED_PUBLIC_ORIGIN is set, the build stops if the origin differs.
 * ftp://x, //x, https://user:pw@x, https://x?y=1, and javascript: are refused.
 */
export class SiteUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteUrlError";
  }
}

const how = "Set PUBLIC_SITE_URL to the absolute website address, for example https://digitalhub.com.eg.";

function originOf(raw: string, name: string): string {
  if (!raw) throw new SiteUrlError(`${name} is not set. ${how}`);
  if (raw.startsWith("//")) throw new SiteUrlError(`${name} must be an absolute http(s) URL. ${how}`);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SiteUrlError(`${name} is not a valid URL: "${raw}". ${how}`);
  }
  if (url.hostname.endsWith(".")) throw new SiteUrlError(`${name} must not have a trailing dot in the host: "${url.hostname}".`);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SiteUrlError(`${name} must be http or https, not "${url.protocol}". ${how}`);
  }
  if (url.protocol !== "https:" && !loopback) {
    throw new SiteUrlError(`${name} must be https, except http://localhost and http://127.0.0.1. It is "${url.protocol}//${url.host}".`);
  }
  if (url.username || url.password) throw new SiteUrlError(`${name} must not contain a username or password. ${how}`);
  if (url.search) throw new SiteUrlError(`${name} must not contain a query string. ${how}`);
  if (url.pathname !== "/" && url.pathname !== "") throw new SiteUrlError(`${name} must be the site origin, not a page path. ${how}`);
  return url.origin;
}

export function readSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const origin = originOf(env.PUBLIC_SITE_URL?.trim() ?? "", "PUBLIC_SITE_URL");
  const expected = env.EXPECTED_PUBLIC_ORIGIN?.trim();
  if (expected && originOf(expected, "EXPECTED_PUBLIC_ORIGIN") !== origin) {
    throw new SiteUrlError(`PUBLIC_SITE_URL is ${origin}, not the expected origin ${expected}.`);
  }
  return origin;
}
