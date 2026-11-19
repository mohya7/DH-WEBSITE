// @vitest-environment jsdom
/*
 * ADM-12: the library refuses to leave a used image with no alt text (409 alt_in_use)
 * and names the places that rely on it. The edit dialog must show those places, as it
 * already does for a refused delete. Before the fix it showed only the title.
 *
 * The API is faked here; any request the screen is not expected to make throws.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pagedBody } from "./support/pagedApi";

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

// antd observes some sizes through ResizeObserver, which jsdom lacks.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: NoResizeObserver });

type Reply = { ok: boolean; status: number; body: unknown; problem: Record<string, unknown> | null };

const title = "Add alt text: this image is used without alt text of its own.";
const places = ["blog-posts 11111111-1111-1111-1111-111111111111 image", "pages 22222222-2222-2222-2222-222222222222 share image"];

const image = { id: "m-001", path: "/media/001.png", alt: "Harbour", caption: null, decorative: false, originalName: "001.png" };

vi.mock("../src/api/http", () => ({
  request: vi.fn(async (path: string, init?: RequestInit) => handler(path, init)),
  jsonInit: (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "editor" }, ready: true }),
}));

// Loaded at module level, after the stubs: antd takes seconds to load cold.
const { MediaLibraryPage } = await import("../src/pages/MediaLibraryPage");
const { ConfigProvider } = await import("antd");

/* jsdom never fires animationend, so an antd Modal never finishes opening. */
function NoMotion({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>;
}

const ok = (body: unknown): Reply => ({ ok: true, status: 200, body, problem: null });

async function handler(path: string, init?: RequestInit): Promise<Reply> {
  const method = init?.method ?? "GET";
  if (path.startsWith("/api/v1/media?") && method === "GET") return ok(pagedBody([image], path));
  // The detail lists no places, so any place shown after Save came from the refusal.
  if (path === "/api/v1/media/m-001" && method === "GET") return ok({ image, usages: [] });
  if (path === "/api/v1/media/m-001" && method === "PUT")
    return { ok: false, status: 409, body: null, problem: { status: 409, code: "alt_in_use", title, usages: places } };
  throw new Error(`unexpected ${method} ${path}`);
}

afterEach(() => {
  cleanup();
});

describe("media library save", () => {
  it("save shows the places that need alt text when the API refuses with alt_in_use", async () => {
    render(<MediaLibraryPage />, { wrapper: NoMotion });
    fireEvent.click(await screen.findByRole("button", { name: /Harbour/ }));
    await screen.findByText("This image is not used.");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByDisplayValue("Harbour"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText(new RegExp(title.replace(/[.:]/g, "\\$&")))).toBeTruthy());
    for (const place of places) expect(screen.getAllByText(new RegExp(place)).length).toBeGreaterThan(0);
  });
});
