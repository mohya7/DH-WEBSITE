// @vitest-environment jsdom
/*
 * ADM-07 part 3: the Redirects screen warns when a redirect points at an address
 * where no published page answers. The API says so with targetLive, on the 201
 * body and on each list row; the API itself is faked here.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// antd's Table observes its size through ResizeObserver, which jsdom lacks.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: NoResizeObserver });

type Reply = { ok: boolean; status: number; body: unknown; problem: { title?: string } | null };

const api = vi.hoisted(() => ({
  handler: (async () => {
    throw new Error("no handler");
  }) as (path: string, init?: RequestInit) => Promise<Reply>,
}));

vi.mock("../src/api/http", () => ({
  request: vi.fn(async (path: string, init?: RequestInit) => api.handler(path, init)),
  jsonInit: (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
}));

/*
 * antd's static message renders into a React root of its own, outside the one
 * render() makes, so cleanup() cannot unmount it, and a redraw after the file ends
 * fails ("window is not defined"; ADM-06b-flake). Both toasts are spies, as in
 * listPaging.test.tsx.
 */
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, message: { ...actual.message, success: toast.success, warning: toast.warning } };
});

const { RedirectsPage } = await import("../src/pages/RedirectsPage");
const { ConfigProvider } = await import("antd");

/* jsdom never fires animationend, so a Modal with motion never finishes opening. */
function NoMotion({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>;
}

type Row = { id: string; fromPath: string; toPath: string; statusCode: number; source: string; createdAt: string; targetLive?: boolean };

const row = (id: string, fromPath: string, toPath: string, targetLive?: boolean): Row => ({
  id,
  fromPath,
  toPath,
  statusCode: 301,
  source: "manual",
  createdAt: "2026-11-01T00:00:00Z",
  ...(targetLive === undefined ? {} : { targetLive }),
});

/** A redirects API holding these rows; a POST adds the given row and answers 201 with it. */
function redirectsApi(rows: Row[], created?: Row) {
  return async (path: string, init?: RequestInit): Promise<Reply> => {
    if (path.startsWith("/api/v1/redirects?")) return { ok: true, status: 200, body: pagedBody(rows, path), problem: null };
    if (path === "/api/v1/redirects" && init?.method === "POST" && created) {
      rows.push(created);
      return { ok: true, status: 201, body: created, problem: null };
    }
    throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
  };
}

async function createThroughModal(fromPath: string, toPath: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add redirect" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByPlaceholderText("/old-path"), { target: { value: fromPath } });
  fireEvent.change(within(dialog).getByPlaceholderText("/new-path"), { target: { value: toPath } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
}

beforeEach(() => {
  toast.success.mockClear();
  toast.warning.mockClear();
});

afterEach(() => {
  cleanup();
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
});

describe("redirect targets", () => {
  it("warns when a created redirect points at no page", async () => {
    api.handler = redirectsApi([], row("r-1", "/old", "/nowhere", false));
    render(<NoMotion><RedirectsPage /></NoMotion>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add redirect" })).toBeTruthy());

    await createThroughModal("/old", "/nowhere");

    await waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(1));
    expect(toast.warning).toHaveBeenCalledWith(
      "Redirect created, but no published page answers at /nowhere. Visitors who follow it see the 404 page.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("marks rows whose target has no page", async () => {
    api.handler = redirectsApi([row("r-1", "/gone", "/nowhere", false), row("r-2", "/moved", "/about", true)]);
    render(<NoMotion><RedirectsPage /></NoMotion>);
    await screen.findByText("/gone");

    expect(screen.getAllByText("No page")).toHaveLength(1);
    const gone = screen.getByText("/gone").closest("tr")!;
    expect(within(gone).getByText("No page")).toBeTruthy();
    const moved = screen.getByText("/moved").closest("tr")!;
    expect(within(moved).queryByText("No page")).toBeNull();
  });

  it("a redirect to a page is created quietly", async () => {
    api.handler = redirectsApi([], row("r-1", "/old", "/about", true));
    render(<NoMotion><RedirectsPage /></NoMotion>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add redirect" })).toBeTruthy());

    await createThroughModal("/old", "/about");

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Redirect created.");
    expect(toast.warning).not.toHaveBeenCalled();
    await screen.findByText("/old");
    expect(screen.queryByText("No page")).toBeNull();
  });
});
