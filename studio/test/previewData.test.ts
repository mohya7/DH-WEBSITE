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

  async function load(response: { ok: boolean; body: unknown }) {
    const http = await import("../src/api/http");
    vi.mocked(http.request).mockImplementation(async (path) => {
      if (path.startsWith("/api/v1/services?")) {
        return { ok: true, status: 200, body: { items: [{ id, slug: workingSlug, title: workingTitle, sortOrder: 1, hasWorkingCopy: true }], total: 1 }, problem: null };
      }
      if (path === `/api/v1/services/${id}/revisions`) return { ok: response.ok, status: response.ok ? 200 : 500, body: response.body, problem: null };
      if (path === `/api/v1/services/${id}`) {
        return { ok: true, status: 200, body: { content: { slug: workingSlug, title: workingTitle, fields: {} } }, problem: null };
      }
      if (path.includes("?")) return { ok: true, status: 200, body: { items: [], total: 0 }, problem: null };
      throw new Error(`unexpected ${path}`);
    });
    return import("../src/preview/previewData");
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
});
