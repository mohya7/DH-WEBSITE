import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/api/http", () => ({ request: vi.fn() }));

const id = "11111111-1111-1111-1111-111111111111";
const workingTitle = "UNPUBLISHED WORKING COPY";
const workingSlug = "draft";

describe("published revision failures", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380");
    vi.resetModules();
  });

  async function load(response: { ok: boolean; body: unknown }, revision?: { ok: boolean; body: unknown }) {
    const http = await import("../src/api/http");
    vi.mocked(http.request).mockImplementation(async (path) => {
      if (path.startsWith("/api/v1/services?")) {
        return { ok: true, status: 200, body: { items: [{ id, slug: workingSlug, title: workingTitle, sortOrder: 1, hasWorkingCopy: true }], total: 1 }, problem: null };
      }
      if (path === `/api/v1/services/${id}/revisions`) return { ok: response.ok, status: response.ok ? 200 : 500, body: response.body, problem: null };
      if (path === `/api/v1/services/${id}/revisions/rev-1`) {
        const document = revision ?? { ok: false, body: null };
        return { ok: document.ok, status: document.ok ? 200 : 500, body: document.body, problem: null };
      }
      if (path === `/api/v1/services/${id}`) {
        return { ok: true, status: 200, body: { content: { slug: workingSlug, title: workingTitle, fields: {} } }, problem: null };
      }
      if (path.includes("?")) return { ok: true, status: 200, body: { items: [], total: 0 }, problem: null };
      throw new Error(`unexpected ${path}`);
    });
    return import("../src/preview/previewData");
  }

  async function expectOmitted(revisionBody: unknown) {
    const { loadPreviewData, previewDependencyWarning } = await load(
      { ok: true, body: { items: [{ id: "rev-1", version: 1 }] } },
      { ok: true, body: revisionBody },
    );
    const data = await loadPreviewData();
    const warning = previewDependencyWarning(data.omitted);
    const dumped = JSON.stringify({ collections: data.collections, paths: [...data.paths], omitted: data.omitted, warning });
    expect(data.collections.services).toEqual([]);
    expect(data.omitted).toEqual([`services/${id}`]);
    expect(warning).toContain(`services/${id}`);
    expect(dumped).not.toContain(workingTitle);
    expect(dumped).not.toContain(workingSlug);
  }

  it("omits the dependency on a revision HTTP 500 and does not use the working copy", async () => {
    const { loadPreviewData, previewDependencyWarning } = await load({ ok: false, body: null });
    const data = await loadPreviewData();
    const dumped = JSON.stringify({ collections: data.collections, paths: [...data.paths] });
    expect(data.collections.services).toEqual([]);
    expect(data.omitted).toEqual([`services/${id}`]);
    expect(dumped).not.toContain(workingTitle);
    expect(dumped).not.toContain(workingSlug);
    const warning = previewDependencyWarning(data.omitted);
    expect(warning).toContain(`services/${id}`);
    expect(warning).not.toContain(workingTitle);
    expect(warning).not.toContain(workingSlug);
  });

  it("omits the dependency when the revisions list is empty", async () => {
    const { loadPreviewData } = await load({ ok: true, body: { items: [] } });
    const data = await loadPreviewData();
    const dumped = JSON.stringify({ collections: data.collections, paths: [...data.paths] });
    expect(data.omitted).toEqual([`services/${id}`]);
    expect(dumped).not.toContain(workingTitle);
    expect(dumped).not.toContain(workingSlug);
  });

  it.each([
    ["an empty snapshot", { snapshot: {} }],
    ["no snapshot", {}],
    ["a missing slug", { snapshot: { title: "Published service" } }],
    ["a non-string title", { snapshot: { slug: "published-service", title: 12 } }],
    ["a null snapshot", { snapshot: null }],
  ])("omits the dependency when the revision has %s", async (_label, body) => {
    await expectOmitted(body);
  });
});

describe("published lists across pages", () => {
  type Row = { id: string; slug: string; title: string; sortOrder: number; hasWorkingCopy: boolean };

  beforeEach(() => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380");
    vi.resetModules();
  });

  const serviceId = (n: number) => `svc-${String(n).padStart(3, "0")}`;
  const row = (n: number): Row => ({ id: serviceId(n), slug: `service-${n}`, title: `Service ${n}`, sortOrder: n, hasWorkingCopy: false });
  const rows = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => row(from + index));

  /** `list` answers the services list for a page and page size; every other collection is empty. */
  async function load(list: (page: number, pageSize: number) => { items: Row[]; total: number }) {
    const http = await import("../src/api/http");
    const listCalls: URLSearchParams[] = [];
    vi.mocked(http.request).mockImplementation(async (path) => {
      if (path.startsWith("/api/v1/services?")) {
        const query = new URLSearchParams(path.slice(path.indexOf("?") + 1));
        listCalls.push(query);
        return { ok: true, status: 200, body: list(Number(query.get("page") ?? "1"), Number(query.get("pageSize") ?? "20")), problem: null };
      }
      const item = /^\/api\/v1\/services\/(svc-\d+)$/.exec(path);
      if (item !== null) {
        return { ok: true, status: 200, body: { content: { slug: `slug-${item[1]}`, title: `Service ${item[1]}`, fields: {} } }, problem: null };
      }
      if (path.includes("?")) return { ok: true, status: 200, body: { items: [], total: 0 }, problem: null };
      throw new Error(`unexpected ${path}`);
    });
    const preview = await import("../src/preview/previewData");
    return { ...preview, listCalls };
  }

  it("loads every published item across pages, once each", async () => {
    const all = rows(1, 250);
    const { loadPreviewData, listCalls } = await load((page, pageSize) => ({
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    }));
    const data = await loadPreviewData();
    const ids = data.collections.services.map((item) => item.id);
    expect(ids).toHaveLength(250);
    expect(new Set(ids).size).toBe(250);
    expect(listCalls.map((query) => query.get("page"))).toEqual(["1", "2", "3"]);
    expect(listCalls.map((query) => query.get("pageSize"))).toEqual(["100", "100", "100"]);
  });

  it("fails with a clear error when the list ignores the page", async () => {
    const all = rows(1, 25);
    const { loadPreviewData } = await load(() => ({ items: all.slice(0, 20), total: all.length }));
    await expect(loadPreviewData()).rejects.toThrow("The published services could not be loaded for the preview.");
  });

  it("shows a row once when it shifts across a page boundary", async () => {
    const pages: Record<number, Row[]> = { 1: rows(1, 100), 2: rows(100, 199), 3: rows(200, 250) };
    const { loadPreviewData } = await load((page) => ({ items: pages[page] ?? [], total: 250 }));
    const data = await loadPreviewData();
    const ids = data.collections.services.map((item) => item.id);
    expect(ids).toHaveLength(250);
    expect(new Set(ids).size).toBe(250);
  });
});
