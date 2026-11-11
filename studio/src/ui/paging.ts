/*
 * Paging helpers shared by the Studio's list screens (ADM-06). Pure: no React
 * and no antd, so the unit tests type-check it with the node config.
 */

/** The last page of a list of `total` rows, never below 1. */
export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Sets `page` and `pageSize` on the query and returns it. Other parameters are kept. */
export function withPage(params: URLSearchParams, page: number, pageSize: number): URLSearchParams {
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params;
}

/**
 * Applies only the newest of several list requests. A screen takes a ticket
 * before each request and applies the response only while that ticket is the
 * latest, so a slow page 2 cannot replace page 3 after the user has moved on.
 */
export function latestOnly(): { start(): number; isLatest(ticket: number): boolean } {
  let latest = 0;
  return {
    start() {
      latest += 1;
      return latest;
    },
    isLatest(ticket: number) {
      return ticket === latest;
    },
  };
}

/**
 * What a screen does with a reload that came back with no rows (ADM-06b).
 * - a page number: past the last page after a change, so load that last page
 *   instead. Only once per reload chain (`jumped` is true on the retry).
 * - "show": nothing is promised (first page, or no rows at all); show it.
 * - "fail": the list promises rows it does not give; stop and show the load
 *   error rather than ask again (P-5).
 */
export function afterEmptyPage(page: number, total: number, pageSize: number, jumped: boolean): number | "show" | "fail" {
  if (page <= 1 || total <= 0) return "show";
  const last = lastPage(total, pageSize);
  return !jumped && last < page ? last : "fail";
}
