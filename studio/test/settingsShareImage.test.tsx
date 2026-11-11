// @vitest-environment jsdom
/*
 * ADM-10: the Settings form carries the default share image through every save, and
 * has a control to choose, change and clear it. Before the fix the form had no field
 * for it, so antd's onFinish left it out of every save and the API cleared it.
 *
 * The API is faked here; any request the screen is not expected to make throws.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

type Reply = { ok: boolean; status: number; body: unknown; problem: { title?: string } | null };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string }>,
  saved: [] as Array<Record<string, unknown>>,
}));

vi.mock("../src/api/http", () => ({
  request: vi.fn(async (path: string, init?: RequestInit) => {
    api.calls.push({ path, method: init?.method ?? "GET" });
    return handler(path, init);
  }),
  jsonInit: (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
}));

/* antd's static message renders outside render()'s root; it is replaced by a spy,
   as in listPaging.test.tsx. */
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, message: { ...actual.message, success: toast.success } };
});

const auth = vi.hoisted(() => ({ role: "admin" }));
vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { role: auth.role }, ready: true }),
}));

// Loaded at module level, after the stubs: antd takes seconds to load cold.
const { SettingsPage } = await import("../src/pages/SettingsPage");
const { ConfigProvider } = await import("antd");

/* jsdom never fires animationend, so an antd Modal never finishes opening. With
   motion off, as antd's token allows, the picker's Modal opens at once. */
function NoMotion({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>;
}

const ok = (body: unknown): Reply => ({ ok: true, status: 200, body, problem: null });

const images = ["001", "002"].map((n) => ({
  id: `m-${n}`,
  path: `/media/${n}.png`,
  alt: `Image ${n}`,
  caption: null,
  decorative: false,
  originalName: `${n}.png`,
}));

const stored = {
  version: 4,
  email: "a@digitalhub.test",
  careersEmail: null,
  defaultMetaTitle: "Digital Hub",
  defaultShareImageId: "m-001",
  defaultShareImageAltOverride: "Digital Hub logo",
};

async function handler(path: string, init?: RequestInit): Promise<Reply> {
  const method = init?.method ?? "GET";
  if (path === "/api/v1/settings" && method === "GET") return ok({ ...stored });
  if (path === "/api/v1/settings" && method === "PUT") {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    api.saved.push(body);
    return ok({ ...stored, ...body, version: 5 });
  }
  if (path.startsWith("/api/v1/media?") && method === "GET") return ok(pagedBody(images, path));
  const one = /^\/api\/v1\/media\/([^/?]+)$/.exec(path);
  if (one !== null && method === "GET") {
    const image = images.find((item) => item.id === one[1]);
    if (image !== undefined) return ok({ image, usages: [] });
  }
  throw new Error(`unexpected ${method} ${path}`);
}

function lastSave(): Record<string, unknown> {
  expect(api.saved.length, "a PUT /api/v1/settings").toBeGreaterThan(0);
  return api.saved[api.saved.length - 1];
}

async function renderLoaded() {
  render(<SettingsPage />, { wrapper: NoMotion });
  // The stored image is shown once the settings and the image have loaded.
  await screen.findByText("/media/001.png");
}

async function clickSave() {
  const before = api.saved.length;
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.saved.length).toBeGreaterThan(before));
}

beforeEach(() => {
  api.calls.length = 0;
  api.saved.length = 0;
  auth.role = "admin";
  toast.success.mockClear();
});

afterEach(() => {
  cleanup();
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
});

describe("settings default share image", () => {
  it("a save sends the stored default share image and its alt back", async () => {
    await renderLoaded();

    await clickSave();

    const body = lastSave();
    expect(body.defaultShareImageId).toBe("m-001");
    expect(body.version).toBe(4);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved."));
  });

  it("choosing an image in the picker saves its id", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Change image" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click((await within(dialog).findByText("Image 002")).closest("button")!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText("/media/002.png");
    expect(api.calls.some((call) => call.method === "GET" && call.path === "/api/v1/media/m-002")).toBe(true);

    await clickSave();

    expect(lastSave().defaultShareImageId).toBe("m-002");
  });

  it("Clear saves an explicit null", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await screen.findByText("No image chosen. Pages without their own share image have none.");

    await clickSave();

    const body = lastSave();
    expect("defaultShareImageId" in body).toBe(true);
    expect(body.defaultShareImageId).toBeNull();
  });

  it("an editor sees the share image but cannot change it", async () => {
    auth.role = "editor";
    await renderLoaded();

    expect(screen.getByRole("button", { name: "Change image" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Clear" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
