/*
 * Removes Next's client runtime from an exported page (Phase C, Section 3,
 * decision: the website ships static HTML plus the ported scripts, like today).
 *
 * React renders every page's HTML at build. In the browser, Next's runtime only
 * hydrates that HTML and powers client-side navigation. The site uses neither:
 * links are ordinary full-page links, and hydration undoes the ported scripts'
 * changes to the page. Each removal below is one piece of that runtime.
 */

export interface Removal {
  name: string;
  why: string;
  pattern: RegExp;
}

export const removals: Removal[] = [
  {
    name: "runtime script tags",
    why: "Load Next's and React's client code from /_next/. That code hydrates the page and runs client-side navigation; the site uses neither.",
    pattern: /<script\b[^>]*\bsrc="\/_next\/[^"]*"[^>]*><\/script>/g,
  },
  {
    name: "runtime preload link",
    why: "Asks the browser to fetch one of the runtime scripts above early. With the scripts gone it would only waste a download.",
    pattern: /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="script")[^>]*\bhref="\/_next\/[^"]*"[^>]*\/?>/g,
  },
  {
    name: "payload scripts",
    why: "self.__next_f bootstrap and push scripts: the React Server Components payload the runtime reads to hydrate. Only the runtime reads it; the page's HTML already holds everything it describes.",
    pattern: /<script>\(?self\.__next_f[\s\S]*?<\/script>/g,
  },
  {
    name: "empty metadata outlet",
    why: "An empty hidden <div> the runtime streams metadata into. It is empty in the exported HTML, and removing it keeps the first script first in <body>, as on the old pages.",
    pattern: /<div hidden=""><!--\$--><!--\/\$--><\/div>/g,
  },
  {
    name: "empty boundary markers",
    why: "Empty <!--$--><!--/$--> comment pairs React leaves for hydration to find. Inert without the runtime; they mark nothing.",
    pattern: /<!--\$--><!--\/\$-->/g,
  },
];

/** Anything of Next's runtime that must not survive in a shipped page. */
export const runtimeTraces: { name: string; pattern: RegExp }[] = [
  { name: "a /_next/ URL", pattern: /\/_next\// },
  { name: "the __next_f payload", pattern: /__next_f/ },
  { name: "a React boundary marker", pattern: /<!--\/?\$[?!]?-->/ },
];

export function stripRuntime(html: string): { html: string; removed: Record<string, number> } {
  const removed: Record<string, number> = {};
  let out = html;
  for (const removal of removals) {
    removed[removal.name] = (out.match(removal.pattern) ?? []).length;
    out = out.replace(removal.pattern, "");
  }
  return { html: out, removed };
}

export function runtimeTracesIn(html: string): string[] {
  return runtimeTraces.filter((trace) => trace.pattern.test(html)).map((trace) => trace.name);
}
