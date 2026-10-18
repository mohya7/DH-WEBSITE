/**
 * Every href, src and srcset in the preview's body, resolved against the website's
 * address: what <base href> did before. The Studio's CSP has base-uri 'none', and
 * a srcdoc frame inherits it, so the preview cannot set a base URL (finding M4).
 * Absolute URLs, such as media on the Studio's origin, stay as they are.
 */
export function withWebsiteUrls(html: string, websiteAddress: string): string {
  const base = `${websiteAddress}/`;
  const resolve = (value: string) => {
    try {
      return new URL(value.trim(), base).href;
    } catch {
      return value;
    }
  };
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of document.querySelectorAll("[href], [src]")) {
    for (const name of ["href", "src"]) {
      const value = element.getAttribute(name);
      if (value !== null) element.setAttribute(name, resolve(value));
    }
  }
  for (const element of document.querySelectorAll("[srcset]")) {
    const candidates = element.getAttribute("srcset")!.split(",").map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return [resolve(url), ...descriptor].join(" ");
    });
    element.setAttribute("srcset", candidates.join(", "));
  }
  return document.body.innerHTML;
}
