/*
 * A fake list endpoint that pages as the API does after ADM-06a: `page`
 * (default 1) and `pageSize` (default 20) are read from the query, and a value
 * the API would reject with 400 throws here, so a test fails if a screen sends
 * it. Self-contained on purpose: it imports nothing from src.
 */
export type PagedBody<T> = { items: T[]; page: number; pageSize: number; total: number };

export function pagedBody<T>(rows: readonly T[], path: string): PagedBody<T> {
  const query = new URL(path, "http://studio.test").searchParams;
  const page = query.has("page") ? Number(query.get("page")) : 1;
  const pageSize = query.has("pageSize") ? Number(query.get("pageSize")) : 20;
  if (!Number.isInteger(page) || page < 1 || page > 10_000) throw new Error(`The API would reject page=${query.get("page")}: ${path}`);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error(`The API would reject pageSize=${query.get("pageSize")}: ${path}`);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length };
}
