/** The JSON-LD script bodies in a built page, in order. */
export function jsonLdBodies(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}
