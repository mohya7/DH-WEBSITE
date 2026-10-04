/*
 * The careers form posts to a same-site path (data-submit-url, or
 * CAREERS_APPLICATION_ENDPOINT at build). Phase D routes that path to the
 * Node hiring system. An absolute URL is rejected: connect-src is 'self',
 * so the browser would report it now and block it once the policy is enforced.
 */

/** A problem sentence, or null when the endpoint is empty or a same-site path. */
export function careersEndpointError(endpoint: string): string | null {
  const value = endpoint.trim();
  if (value === "") return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    return `The careers form endpoint must be a same-site path. "${value}" is an absolute URL. Phase D routes the path to the Node hiring system.`;
  }
  if (!value.startsWith("/")) {
    return `The careers form endpoint must be a same-site path starting with /. "${value}" does not.`;
  }
  return null;
}

/** Values of data-submit-url in a built page. That is the attribute the careers script posts to. */
export function careersEndpointsIn(html: string): string[] {
  return [...html.matchAll(/\bdata-submit-url="([^"]*)"/gi)].map((match) => match[1]);
}
