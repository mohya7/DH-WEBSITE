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
