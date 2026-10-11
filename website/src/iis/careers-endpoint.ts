/*
 * The careers form posts to a same-site path (data-submit-url, or
 * CAREERS_APPLICATION_ENDPOINT at build). Phase D routes that path to the
 * Node hiring system. An absolute URL is rejected: connect-src is 'self',
 * so the browser would report it now and block it once the policy is enforced.
 *
 * The check resolves the value against https://website.invalid. A backslash
 * is a path separator in that parser, so "/\host/..." becomes https://host/...
 * and must fail. Whitespace and control characters are rejected as written,
 * because the parser removes them.
 */

const sameSiteBase = "https://website.invalid";

/** A problem sentence, or null when the endpoint is empty or a same-site path. */
export function careersEndpointError(endpoint: string): string | null {
  if (endpoint === "") return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(endpoint) || endpoint.startsWith("//")) {
    return absoluteUrl(endpoint);
  }
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    return `The careers form endpoint must be a same-site path starting with /. "${endpoint}" does not.`;
  }

  let resolved: URL | undefined;
  try {
    resolved = new URL(endpoint, sameSiteBase);
  } catch {
    resolved = undefined;
  }
  if (resolved !== undefined && resolved.origin !== sameSiteBase) return absoluteUrl(endpoint);
  if (endpoint.includes("\\") || /%5c/i.test(endpoint) || /[\u0000-\u001F\u007F]|\s/u.test(endpoint) || resolved === undefined) {
    return `The careers form endpoint must be a same-site path. "${endpoint}" contains a backslash, space, or control character.`;
  }
  return null;
}

function absoluteUrl(endpoint: string): string {
  return `The careers form endpoint must be a same-site path. "${endpoint}" is an absolute URL. Phase D routes the path to the Node hiring system.`;
}

/** Values of data-submit-url in a built page. That is the attribute the careers script posts to. */
export function careersEndpointsIn(html: string): string[] {
  return [...html.matchAll(/\bdata-submit-url="([^"]*)"/gi)].map((match) => match[1]);
}
