// @vitest-environment jsdom
/*
 * ADM-06: the Studio's list screens reach rows past the first page.
 *
 * The API is faked by test/support/pagedApi.ts, which pages as the API does
 * after ADM-06a. So these tests check the Studio's screens, not the API.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pagedBody } from "./support/pagedApi";

vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380");

// antd's Pagination reads breakpoints through window.matchMedia, which jsdom lacks.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
});

// antd's Table and DatePicker observe their size through ResizeObserver, which jsdom lacks.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: NoResizeObserver });

type Reply = { ok: boolean; status: number; body: unknown; problem: { title?: string } | null };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string }>,
  handler: (async () => {
    throw new Error("no handler");
  }) as (path: string, init?: RequestInit) => Promise<Reply>,
}));

vi.mock("../src/api/http", () => ({
  request: vi.fn(async (path: string, init?: RequestInit) => {
    api.calls.push({ path, method: init?.method ?? "GET" });
    return api.handler(path, init);
  }),
  jsonInit: (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
}));

/*
 * antd's static message renders into a React root of its own, outside the one
 * render() makes, so cleanup() cannot unmount it. It redraws on every animation
 * frame for 3 seconds, and a redraw that lands as the file ends runs after
 * jsdom is gone ("window is not defined"). The toast is replaced by a spy.
 */
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, message: { ...actual.message, success: toast.success } };
});

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "admin" }, ready: true }),
}));

// Loaded at module level, after the stubs: antd takes seconds to load cold.
const { ContactInboxPage } = await import("../src/pages/ContactInboxPage");
const { AuditPage } = await import("../src/pages/AuditPage");
const { RedirectsPage } = await import("../src/pages/RedirectsPage");
const { MediaLibraryPage } = await import("../src/pages/MediaLibraryPage");
const { MediaPicker } = await import("../src/content/MediaPicker");
const { ConfigProvider } = await import("antd");

/*
 * jsdom never fires animationend, so an antd Modal never finishes opening and
 * never calls afterOpenChange, where the picker loads. With motion off, as
 * antd's token allows, the Modal opens at once.
 */
function NoMotion({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>;
}

const three = (n: number) => String(n).padStart(3, "0");
const ok = (body: unknown): Reply => ({ ok: true, status: 200, body, problem: null });

/** The query of every GET to a list path, oldest first. */
function listQueries(base: string): URLSearchParams[] {
  return api.calls
    .filter((call) => call.method === "GET" && call.path.startsWith(`${base}?`))
    .map((call) => new URLSearchParams(call.path.slice(call.path.indexOf("?") + 1)));
}

function lastListQuery(base: string): URLSearchParams {
  const queries = listQueries(base);
  expect(queries.length, `a list request to ${base}`).toBeGreaterThan(0);
  return queries[queries.length - 1];
}

function search(rows: Array<{ name?: string; fromPath?: string; alt?: string }>, path: string) {
  const term = new URL(path, "http://studio.test").searchParams.get("search")?.trim() ?? "";
  if (term === "") return rows;
  return rows.filter((row) => (row.name ?? row.fromPath ?? row.alt ?? "").includes(term));
}

function enquiries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `c-${three(index + 1)}`,
    name: `Enquiry ${three(index + 1)}`,
    organization: "Digital Hub",
    email: `e${three(index + 1)}@example.com`,
    situation: "gov",
    status: "new",
    createdAt: "2026-11-01T00:00:00Z",
  }));
}

function images(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m-${three(index + 1)}`,
    path: `/media/${three(index + 1)}.png`,
    alt: `Image ${three(index + 1)}`,
    caption: null,
    decorative: false,
    originalName: `${three(index + 1)}.png`,
  }));
}

function inboxApi(rows: ReturnType<typeof enquiries>) {
  return async (path: string, init?: RequestInit): Promise<Reply> => {
    if (path.startsWith("/api/v1/contact-requests?")) return ok(pagedBody(search(rows, path), path));
    const handled = /^\/api\/v1\/contact-requests\/([^/]+)\/handled$/.exec(path);
    if (handled !== null && init?.method === "POST") {
      const row = rows.find((item) => item.id === handled[1])!;
      row.status = "handled";
      return ok({ ...row, message: "Hello.", handledAt: "2026-11-02T00:00:00Z" });
    }
    const detail = /^\/api\/v1\/contact-requests\/([^/?]+)$/.exec(path);
    if (detail !== null) return ok({ ...rows.find((item) => item.id === detail[1])!, message: "Hello." });
    throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
  };
}

function mediaApi(rows: ReturnType<typeof images>) {
  return async (path: string, init?: RequestInit): Promise<Reply> => {
    if (path.startsWith("/api/v1/media?")) return ok(pagedBody(search(rows, path), path));
    throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
  };
}

function pageItem(title: string) {
  return screen.getByTitle(title, { exact: true });
}

beforeEach(() => {
  api.calls.length = 0;
  toast.success.mockClear();
});

afterEach(() => {
  cleanup();
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
});

describe("contact inbox paging", () => {
  it("inbox reaches the 51st enquiry on page 2", async () => {
    api.handler = inboxApi(enquiries(120));
    const view = render(<ContactInboxPage />);
    await screen.findByText("Enquiry 001");
    expect(screen.queryByText("Enquiry 051")).toBeNull();

    fireEvent.click(pageItem("2"));

    await screen.findByText("Enquiry 051");
    expect(screen.queryByText("Enquiry 001")).toBeNull();
    const query = lastListQuery("/api/v1/contact-requests");
    expect(query.get("page")).toBe("2");
    expect(query.get("pageSize")).toBe("50");
    expect(view.container.querySelector(".ant-pagination-options")).toBeNull();
  });

  it("inbox pages through the applied search and a new search goes back to page 1", async () => {
    api.handler = inboxApi(enquiries(120));
    render(<ContactInboxPage />);
    await screen.findByText("Enquiry 001");

    const box = screen.getByPlaceholderText("Search name, organization, email...");
    fireEvent.change(box, { target: { value: "Enquiry 1" } });
    fireEvent.click(pageItem("2"));

    await screen.findByText("Enquiry 051");
    const paged = lastListQuery("/api/v1/contact-requests");
    expect(paged.get("page")).toBe("2");
    expect(paged.has("search")).toBe(false);

    fireEvent.keyDown(box, { key: "Enter", code: "Enter", keyCode: 13 });

    await waitFor(() => expect(lastListQuery("/api/v1/contact-requests").get("search")).toBe("Enquiry 1"));
    const searched = lastListQuery("/api/v1/contact-requests");
    expect(searched.get("page")).toBe("1");
    expect(searched.get("pageSize")).toBe("50");
  });

  it("inbox keeps the latest page when responses arrive out of order", async () => {
    const rows = enquiries(120);
    const healthy = inboxApi(rows);
    const held = new Map<string, () => void>();
    api.handler = async (path, init) => {
      const page = path.startsWith("/api/v1/contact-requests?") ? new URL(path, "http://studio.test").searchParams.get("page") : null;
      if (page === "2" || page === "3") {
        const reply = await healthy(path, init);
        return new Promise<Reply>((resolve) => held.set(page, () => resolve(reply)));
      }
      return healthy(path, init);
    };
    render(<ContactInboxPage />);
    await screen.findByText("Enquiry 001");

    fireEvent.click(pageItem("2"));
    await waitFor(() => expect(held.has("2")).toBe(true));
    fireEvent.click(pageItem("3"));
    await waitFor(() => expect(held.has("3")).toBe(true));

    await act(async () => {
      held.get("3")!();
    });
    await screen.findByText("Enquiry 101");
    await act(async () => {
      held.get("2")!();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText("Enquiry 101")).toBeTruthy();
    expect(screen.queryByText("Enquiry 051")).toBeNull();
  });

  it("marking an enquiry handled reloads the same page", async () => {
    api.handler = inboxApi(enquiries(120));
    render(<ContactInboxPage />);
    await screen.findByText("Enquiry 001");
    fireEvent.click(pageItem("2"));
    fireEvent.click(await screen.findByText("Enquiry 051"));

    const before = listQueries("/api/v1/contact-requests").length;
    fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));

    await waitFor(() => expect(listQueries("/api/v1/contact-requests").length).toBeGreaterThan(before));
    expect(lastListQuery("/api/v1/contact-requests").get("page")).toBe("2");
    expect(toast.success).toHaveBeenCalledWith("Marked handled.");
  });
});

describe("audit log paging", () => {
  function auditApi(count: number) {
    const rows = Array.from({ length: count }, (_, index) => ({
      id: `a-${three(index + 1)}`,
      userId: "user-1",
      action: "update_item",
      entityType: "page",
      entityId: `entity-${three(index + 1)}`,
      at: "2026-11-01T00:00:00Z",
      success: true,
      detail: null,
    }));
    return async (path: string, init?: RequestInit): Promise<Reply> => {
      if (path.startsWith("/api/v1/audit?")) {
        const action = new URL(path, "http://studio.test").searchParams.get("action");
        return ok(pagedBody(action === null ? rows : rows.filter((row) => row.action === action), path));
      }
      throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    };
  }

  it("audit log reaches the 51st entry on page 2", async () => {
    api.handler = auditApi(120);
    render(<AuditPage />);
    await screen.findByText("entity-001");
    expect(screen.queryByText("entity-051")).toBeNull();

    fireEvent.click(pageItem("2"));

    await screen.findByText("entity-051");
    const query = lastListQuery("/api/v1/audit");
    expect(query.get("page")).toBe("2");
    expect(query.get("pageSize")).toBe("50");
  });

  it("audit pages through the applied filters and Filter goes back to page 1", async () => {
    api.handler = auditApi(120);
    render(<AuditPage />);
    await screen.findByText("entity-001");

    fireEvent.change(screen.getByPlaceholderText("Action"), { target: { value: "update_item" } });
    fireEvent.click(pageItem("2"));

    await screen.findByText("entity-051");
    const paged = lastListQuery("/api/v1/audit");
    expect(paged.get("page")).toBe("2");
    expect(paged.has("action")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    await waitFor(() => expect(lastListQuery("/api/v1/audit").get("action")).toBe("update_item"));
    const filtered = lastListQuery("/api/v1/audit");
    expect(filtered.get("page")).toBe("1");
    expect(filtered.get("pageSize")).toBe("50");
  });
});

describe("redirects paging", () => {
  function redirectsApi(count: number) {
    const rows = Array.from({ length: count }, (_, index) => ({
      id: `r-${three(index + 1)}`,
      fromPath: `/r-${three(index + 1)}`,
      toPath: "/",
      statusCode: 301,
      source: "manual",
      createdAt: "2026-11-01T00:00:00Z",
    }));
    return async (path: string, init?: RequestInit): Promise<Reply> => {
      if (path.startsWith("/api/v1/redirects?")) return ok(pagedBody(search(rows, path), path));
      const remove = /^\/api\/v1\/redirects\/([^/?]+)$/.exec(path);
      if (remove !== null && init?.method === "DELETE") {
        rows.splice(rows.findIndex((row) => row.id === remove[1]), 1);
        return { ok: true, status: 204, body: null, problem: null };
      }
      throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    };
  }

  it("redirects reach the 51st redirect on page 2", async () => {
    api.handler = redirectsApi(51);
    render(<RedirectsPage />);
    await screen.findByText("/r-001");
    expect(screen.queryByText("/r-051")).toBeNull();

    fireEvent.click(pageItem("2"));

    await screen.findByText("/r-051");
    const query = lastListQuery("/api/v1/redirects");
    expect(query.get("page")).toBe("2");
    expect(query.get("pageSize")).toBe("50");
  });

  it("deleting the only row of the last page shows the page before", async () => {
    api.handler = redirectsApi(51);
    render(<RedirectsPage />);
    await screen.findByText("/r-001");
    fireEvent.click(pageItem("2"));
    const row = (await screen.findByText("/r-051")).closest("tr")!;

    const before = listQueries("/api/v1/redirects").length;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    await screen.findByText("/r-001");
    const after = listQueries("/api/v1/redirects").slice(before).map((query) => query.get("page"));
    expect(after).toEqual(["2", "1"]);
    expect(screen.queryByText("/r-051")).toBeNull();
  });
});

describe("media library paging", () => {
  it("media library reaches the 49th image on page 2", async () => {
    api.handler = mediaApi(images(56));
    const view = render(<MediaLibraryPage />);
    await screen.findByText("Image 001");
    expect(view.container.querySelectorAll(".media-tile")).toHaveLength(48);
    expect(screen.queryByText("Image 049")).toBeNull();

    fireEvent.click(pageItem("2"));

    await screen.findByText("Image 049");
    expect(view.container.querySelectorAll(".media-tile")).toHaveLength(8);
    const query = lastListQuery("/api/v1/media");
    expect(query.get("page")).toBe("2");
    expect(query.get("pageSize")).toBe("48");
  });

  it("media library search goes back to page 1", async () => {
    api.handler = mediaApi(images(56));
    render(<MediaLibraryPage />);
    await screen.findByText("Image 001");
    fireEvent.click(pageItem("2"));
    await screen.findByText("Image 049");

    const box = screen.getByPlaceholderText("Search alt text, caption, or file name");
    fireEvent.change(box, { target: { value: "Image 05" } });
    fireEvent.keyDown(box, { key: "Enter", code: "Enter", keyCode: 13 });

    await waitFor(() => expect(lastListQuery("/api/v1/media").get("search")).toBe("Image 05"));
    expect(lastListQuery("/api/v1/media").get("page")).toBe("1");
  });
});

describe("media picker paging", () => {
  it("picker reaches the 25th image and selects it", async () => {
    api.handler = mediaApi(images(30));
    const onSelect = vi.fn();
    render(<MediaPicker open onClose={() => {}} onSelect={onSelect} />, { wrapper: NoMotion });
    await screen.findByText("Image 001");
    expect(document.body.querySelectorAll(".media-tile")).toHaveLength(24);
    expect(screen.queryByText("Image 025")).toBeNull();

    fireEvent.click(pageItem("2"));

    fireEvent.click((await screen.findByText("Image 025")).closest("button")!);
    expect(onSelect).toHaveBeenCalledWith({ id: "m-025", path: "/media/025.png", alt: "Image 025" });
    const query = lastListQuery("/api/v1/media");
    expect(query.get("page")).toBe("2");
    expect(query.get("pageSize")).toBe("24");
  });

  it("picker opens on page 1", async () => {
    api.handler = mediaApi(images(30));
    const view = render(<MediaPicker open onClose={() => {}} onSelect={() => {}} />, { wrapper: NoMotion });
    await screen.findByText("Image 001");
    fireEvent.click(pageItem("2"));
    await screen.findByText("Image 025");
    // A term typed but never submitted before the picker closes.
    const box = screen.getByPlaceholderText<HTMLInputElement>("Search alt text, caption, or file name");
    fireEvent.change(box, { target: { value: "Image 02" } });
    expect(box.value).toBe("Image 02");

    view.rerender(<MediaPicker open={false} onClose={() => {}} onSelect={() => {}} />);
    const before = listQueries("/api/v1/media").length;
    view.rerender(<MediaPicker open onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => expect(listQueries("/api/v1/media").length).toBeGreaterThan(before));
    const query = lastListQuery("/api/v1/media");
    expect(query.get("page")).toBe("1");
    // The reopened picker uses the applied search (none), and the box shows it.
    expect(query.get("search")).toBe("");
    await waitFor(() =>
      expect(screen.getByPlaceholderText<HTMLInputElement>("Search alt text, caption, or file name").value).toBe(""),
    );
  });
});

/*
 * Tester's round-1 findings (test-report.md). A failed page load must leave the
 * pager on the page whose rows are shown, and an empty reload may jump to the
 * last page at most once.
 */
describe("failed and inconsistent page loads", () => {
  const failure: Reply = { ok: false, status: 500, body: null, problem: { title: "Server error" } };

  function pageOf(path: string): string | null {
    return new URL(path, "http://studio.test").searchParams.get("page");
  }

  function listApi(base: string, rows: unknown[]) {
    return async (path: string, init?: RequestInit): Promise<Reply> => {
      if (path.startsWith(`${base}?`)) return ok(pagedBody(rows as Array<{ id: string }>, path));
      throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    };
  }

  const auditRows = Array.from({ length: 120 }, (_, index) => ({
    id: `a-${three(index + 1)}`,
    userId: "user-1",
    action: "update_item",
    entityType: "page",
    entityId: `entity-${three(index + 1)}`,
    at: "2026-11-01T00:00:00Z",
    success: true,
    detail: null,
  }));

  const redirectRows = Array.from({ length: 120 }, (_, index) => ({
    id: `r-${three(index + 1)}`,
    fromPath: `/r-${three(index + 1)}`,
    toPath: "/",
    statusCode: 301,
    source: "manual",
    createdAt: "2026-11-01T00:00:00Z",
  }));

  type Screen = {
    name: string;
    base: string;
    rows: () => unknown[];
    healthy: () => (path: string, init?: RequestInit) => Promise<Reply>;
    render: () => void;
    first: string;
    loadError: string;
  };

  const screens: Screen[] = [
    {
      name: "inbox",
      base: "/api/v1/contact-requests",
      rows: () => enquiries(120),
      healthy: () => inboxApi(enquiries(120)),
      render: () => render(<ContactInboxPage />),
      first: "Enquiry 001",
      loadError: "Contact requests could not be loaded.",
    },
    {
      name: "audit log",
      base: "/api/v1/audit",
      rows: () => auditRows,
      healthy: () => listApi("/api/v1/audit", auditRows),
      render: () => render(<AuditPage />),
      first: "entity-001",
      loadError: "Audit log could not be loaded.",
    },
    {
      name: "redirects",
      base: "/api/v1/redirects",
      rows: () => redirectRows,
      healthy: () => listApi("/api/v1/redirects", redirectRows),
      render: () => render(<RedirectsPage />),
      first: "/r-001",
      loadError: "Redirects could not be loaded.",
    },
    {
      name: "media library",
      base: "/api/v1/media",
      rows: () => images(120),
      healthy: () => mediaApi(images(120)),
      render: () => render(<MediaLibraryPage />),
      first: "Image 001",
      loadError: "The library could not be loaded.",
    },
    {
      name: "media picker",
      base: "/api/v1/media",
      rows: () => images(120),
      healthy: () => mediaApi(images(120)),
      render: () => render(<MediaPicker open onClose={() => {}} onSelect={() => {}} />, { wrapper: NoMotion }),
      first: "Image 001",
      loadError: "The library could not be loaded.",
    },
  ];

  function activePage(): string | null {
    return document.body.querySelector(".ant-pagination-item-active")?.getAttribute("title") ?? null;
  }

  it.each(screens)("$name keeps the pager on the page shown when page 2 fails to load", async (target) => {
    const healthy = target.healthy();
    api.handler = async (path, init) =>
      path.startsWith(`${target.base}?`) && pageOf(path) === "2" ? failure : healthy(path, init);
    target.render();
    await screen.findByText(target.first);
    expect(activePage()).toBe("1");

    fireEvent.click(pageItem("2"));

    await screen.findByText("Server error");
    expect(screen.getByText(target.first)).toBeTruthy();
    expect(activePage()).toBe("1");
  });

  it("after a failed page load, Mark handled reloads the page shown", async () => {
    const healthy = inboxApi(enquiries(120));
    api.handler = async (path, init) =>
      path.startsWith("/api/v1/contact-requests?") && pageOf(path) === "2" ? failure : healthy(path, init);
    render(<ContactInboxPage />);
    await screen.findByText("Enquiry 001");
    fireEvent.click(pageItem("2"));
    await screen.findByText("Server error");

    fireEvent.click(screen.getByText("Enquiry 001"));
    const before = listQueries("/api/v1/contact-requests").length;
    fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));

    await waitFor(() => expect(listQueries("/api/v1/contact-requests").length).toBeGreaterThan(before));
    expect(lastListQuery("/api/v1/contact-requests").get("page")).toBe("1");
    expect(toast.success).toHaveBeenCalledWith("Marked handled.");
  });

  it.each(screens.filter((target) => ["inbox", "redirects", "media library"].includes(target.name)))(
    "$name jumps to the last page at most once when pages come back empty with rows promised",
    async (target) => {
      const rows = target.rows();
      let calls = 0;
      api.handler = async (path) => {
        if (!path.startsWith(`${target.base}?`)) throw new Error(`unexpected GET ${path}`);
        calls += 1;
        // A cut-off for the loop this test looks for, so a failing run ends.
        if (calls > 10) return failure;
        if (pageOf(path) === "1") return ok(pagedBody(rows as Array<{ id: string }>, path));
        return ok({ items: [], total: 120 });
      };
      target.render();
      await screen.findByText(target.first);
      const before = listQueries(target.base).length;

      fireEvent.click(pageItem("2"));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(listQueries(target.base).length - before).toBeLessThanOrEqual(2);
      await screen.findByText(target.loadError);
      expect(screen.getByText(target.first)).toBeTruthy();
      expect(activePage()).toBe("1");
    },
  );
});
