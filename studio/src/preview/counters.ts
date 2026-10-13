/**
 * The final counter text the website's scripts write: parseInt(data-count, 10)
 * plus data-suffix, the same rules as website/design/js/about-page.js and
 * index.inline-3.js. The shared markup still starts at 0; only the preview
 * fills the value, because the preview runs no scripts.
 */
export function materialiseCounters(html: string): string {
  return html.replace(/<div class="stat-num"([^>]*)>[\s\S]*?<\/div>/g, (full, attrs: string) => {
    const count = /\bdata-count="([^"]*)"/.exec(attrs)?.[1];
    if (count === undefined) return full;
    const suffix = /\bdata-suffix="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const target = Number.parseInt(count, 10);
    if (!Number.isFinite(target)) return full;
    return `<div class="stat-num"${attrs}>${target}${suffix}</div>`;
  });
}
