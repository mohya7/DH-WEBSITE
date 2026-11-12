// @vitest-environment jsdom
/*
 * ADM-05: the Error pages screen shows each page's state, publishes through the
 * page publish route, and lists what blocks a publish or a save. A Save on a
 * published page is a draft, and says so.
 *
 * The API is faked: every request goes to api.handler, and a path the test does
 * not expect throws. The RichTextEditor is the real one.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380");

// antd reads breakpoints through window.matchMedia, which jsdom lacks.
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

// antd observes sizes through ResizeObserver, which jsdom lacks.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: NoResizeObserver });

type Problem = { code?: string; title?: string; errors?: Record<string, string[]>; warnings?: Record<string, string[]> };
type Reply = { ok: boolean; status: number; body: unknown; problem: Problem | null };

const api = vi.hoisted(() => ({
  handler: (async () => {
    throw new Error("no handler");
  }) as (path: string, init?: RequestInit) => Promise<Reply>,
  calls: [] as Array<{ method: string; path: string; body: string | undefined }>,
}));

vi.mock("../src/api/http", () => ({
  request: vi.fn(async (path: string, init?: RequestInit) => {
    api.calls.push({ method: init?.method ?? "GET", path, body: typeof init?.body === "string" ? init.body : undefined });
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
 * render() makes, so cleanup() cannot unmount it (ADM-06b-flake). The toasts are
 * spies, as in redirects.test.tsx.
 */
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, message: { ...actual.message, success: toast.success, warning: toast.warning, error: toast.error } };
});

const { ErrorPagesPage } = await import("../src/pages/ErrorPagesPage");
const { ConfigProvider } = await import("antd");

function NoMotion({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>;
}

type ErrorPage = {
  type: string;
  id: string;
  title: string;
  body: string;
  version: number;
  status: string;
  state: string;
  hasWorkingCopy: boolean;
  publishedAt: string | null;
  notice: string | null;
};

const doc = (text: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

function errorPage(type: "404" | "500", state: "draft" | "published" | "changed", version = 3): ErrorPage {
  const published = state !== "draft";
  return {
    type,
    id: `p-${type}`,
    title: type === "404" ? "Page not found" : "Something went wrong",
    body: doc(`${type} body`),
    version,
    status: published ? "published" : "draft",
    state,
    hasWorkingCopy: state === "changed",
    publishedAt: published ? "2026-11-01T00:00:00Z" : null,
    notice: published ? "Published changes appear on the website at the next build." : null,
  };
}

const ok = (body: unknown, status = 200): Reply => ({ ok: true, status, body, problem: null });
const fail = (status: number, problem: Problem): Reply => ({ ok: false, status, body: problem, problem });

type Answers = {
  save?: (page: ErrorPage, sent: { version: number; title: string; body: string }) => Reply | Promise<Reply>;
  publish?: (id: string, sent: { version: number }) => Reply | Promise<Reply>;
};

/** An answer the test releases itself, to hold a request in flight. */
function held() {
  let release: (reply: Reply) => void = () => {};
  const answer = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { answer, release: (reply: Reply) => release(reply) };
}

/** An error-pages API holding these pages. Save and publish answer as the test says. */
function errorPagesApi(pages: ErrorPage[], answers: Answers = {}) {
  return async (path: string, init?: RequestInit): Promise<Reply> => {
    const method = init?.method ?? "GET";
    if (path === "/api/v1/error-pages" && method === "GET") return ok({ items: pages.map((page) => ({ ...page })) });
    const save = /^\/api\/v1\/error-pages\/(404|500)$/.exec(path);
    if (save && method === "PUT" && answers.save) {
      const page = pages.find((item) => item.type === save[1])!;
      return answers.save(page, JSON.parse(String(init?.body)) as { version: number; title: string; body: string });
    }
    const publish = /^\/api\/v1\/pages\/([^/]+)\/publish$/.exec(path);
    if (publish && method === "POST" && answers.publish) {
      return answers.publish(publish[1], JSON.parse(String(init?.body)) as { version: number });
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

/** A save the API accepts: the page comes back with the next version, as the list will show it. */
function acceptSave(pages: ErrorPage[]) {
  return (page: ErrorPage, sent: { version: number; title: string; body: string }): Reply => {
    const state = page.status === "published" ? "changed" : "draft";
    const saved: ErrorPage = { ...page, title: sent.title, body: sent.body, version: sent.version + 1, state, hasWorkingCopy: state === "changed" };
    pages.splice(pages.indexOf(page), 1, saved);
    return ok(saved);
  };
}

function cardOf(type: "404" | "500") {
  const card = screen.getByRole("heading", { name: `${type} page` }).closest(".section-card");
  if (!(card instanceof HTMLElement)) throw new Error(`no card for ${type}`);
  return card;
}

const publishButton = (type: "404" | "500") => within(cardOf(type)).getByRole("button", { name: "Publish" }) as HTMLButtonElement;
const saveButton = (type: "404" | "500") => within(cardOf(type)).getByRole("button", { name: "Save" });
const titleInput = (type: "404" | "500") => {
  const input = cardOf(type).querySelector("input");
  if (input === null) throw new Error(`no title input for ${type}`);
  return input;
};
const listCalls = () => api.calls.filter((call) => call.method === "GET" && call.path === "/api/v1/error-pages");

async function renderScreen() {
  render(<NoMotion><ErrorPagesPage /></NoMotion>);
  await screen.findByRole("heading", { name: "404 page" });
  await screen.findByRole("heading", { name: "500 page" });
}

beforeEach(() => {
  api.calls.length = 0;
  toast.success.mockClear();
  toast.warning.mockClear();
  toast.error.mockClear();
});

afterEach(() => {
  cleanup();
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
});

describe("error pages screen", () => {
  it("shows each page's state", async () => {
    api.handler = errorPagesApi([errorPage("404", "draft"), errorPage("500", "changed")]);
    await renderScreen();

    expect(within(cardOf("404")).getByText("draft", { selector: ".status-chip" })).toBeTruthy();
    expect(within(cardOf("500")).getByText("changed", { selector: ".status-chip" })).toBeTruthy();
  });

  it("publishes with the page's version and reloads", async () => {
    const pages = [errorPage("404", "draft"), errorPage("500", "published")];
    api.handler = errorPagesApi(pages, {
      publish: (id) => {
        const page = pages.find((item) => item.id === id)!;
        pages.splice(pages.indexOf(page), 1, { ...page, version: page.version + 1, status: "published", state: "published", publishedAt: "2026-11-12T00:00:00Z" });
        return ok({ id, state: "published", status: "published", version: page.version + 1, warnings: {} });
      },
    });
    await renderScreen();

    fireEvent.click(publishButton("404"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("404 page published. Changes appear on the website at the next build."));
    const publishes = api.calls.filter((call) => call.method === "POST");
    expect(publishes).toEqual([{ method: "POST", path: "/api/v1/pages/p-404/publish", body: JSON.stringify({ version: 3 }) }]);
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    await waitFor(() => expect(within(cardOf("404")).getByText("published", { selector: ".status-chip" })).toBeTruthy());
  });

  it("will not publish unsaved edits", async () => {
    const pages = [errorPage("404", "draft"), errorPage("500", "draft")];
    api.handler = errorPagesApi(pages, { save: acceptSave(pages) });
    await renderScreen();
    expect(publishButton("404").disabled).toBe(false);

    fireEvent.change(titleInput("404"), { target: { value: "Lost" } });

    await waitFor(() => expect(publishButton("404").disabled).toBe(true));
    expect(within(cardOf("404")).getByText("Save before publishing, so the check runs on what is on screen.")).toBeTruthy();
    expect(publishButton("500").disabled).toBe(false);

    fireEvent.click(saveButton("404"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("404 page saved."));
    await waitFor(() => expect(publishButton("404").disabled).toBe(false));
    expect(within(cardOf("404")).queryByText("Save before publishing, so the check runs on what is on screen.")).toBeNull();
    expect(publishButton("500").disabled).toBe(false);
  });

  it("lists what blocks a publish", async () => {
    api.handler = errorPagesApi([errorPage("404", "draft"), errorPage("500", "draft")], {
      publish: () => fail(400, {
        code: "publish_blocked",
        title: "Publishing is blocked until every check passes.",
        errors: { media: ["m-1 is not in the library."] },
      }),
    });
    await renderScreen();

    fireEvent.click(publishButton("404"));

    const card = cardOf("404");
    expect(await within(card).findByText("Publishing is blocked until every check passes.")).toBeTruthy();
    expect(within(card).getByText("media: m-1 is not in the library.")).toBeTruthy();
    expect(within(cardOf("500")).queryByText("media: m-1 is not in the library.")).toBeNull();
    expect(listCalls()).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says a save on a published page is a draft", async () => {
    const pages = [errorPage("404", "published"), errorPage("500", "published")];
    api.handler = errorPagesApi(pages, { save: acceptSave(pages) });
    await renderScreen();

    fireEvent.click(saveButton("404"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("404 page saved as a draft. Publish to put it on the website.");
  });

  it("a stale publish says someone else changed the page", async () => {
    api.handler = errorPagesApi([errorPage("404", "draft"), errorPage("500", "draft")], {
      publish: () => fail(409, { code: "concurrency_conflict", title: "This item was changed by someone else." }),
    });
    await renderScreen();

    fireEvent.click(publishButton("404"));

    expect(await screen.findByText("Someone else changed this page.")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("lists what blocks a save", async () => {
    const pages = [errorPage("404", "draft"), errorPage("500", "draft")];
    let refuse = true;
    const accept = acceptSave(pages);
    api.handler = errorPagesApi(pages, {
      save: (page, sent) => refuse
        ? fail(400, { code: "validation_failed", title: "One or more fields are invalid.", errors: { media: ["m-1 is not in the library."] } })
        : accept(page, sent),
    });
    await renderScreen();

    fireEvent.change(titleInput("404"), { target: { value: "Lost" } });
    fireEvent.click(saveButton("404"));

    const card = cardOf("404");
    expect(await within(card).findByText("One or more fields are invalid.")).toBeTruthy();
    expect(within(card).getByText("media: m-1 is not in the library.")).toBeTruthy();
    expect(listCalls()).toHaveLength(1);
    expect(publishButton("404").disabled).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    refuse = false;
    fireEvent.click(saveButton("404"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("404 page saved."));
    await waitFor(() => expect(within(cardOf("404")).queryByText("media: m-1 is not in the library.")).toBeNull());
    expect(within(cardOf("404")).queryByText("One or more fields are invalid.")).toBeNull();
    expect(publishButton("404").disabled).toBe(false);
  });

  // Test report round 1, Minor 1: a double-click sent a second request with the same version.
  it("sends one save while a save is in flight", async () => {
    const pages = [errorPage("404", "draft"), errorPage("500", "draft")];
    const accept = acceptSave(pages);
    const pending = held();
    const seen: { first: { page: ErrorPage; sent: { version: number; title: string; body: string } } | null } = { first: null };
    api.handler = errorPagesApi(pages, {
      save: (page, sent) => {
        if (seen.first !== null) return fail(409, { code: "concurrency_conflict", title: "This item was changed by someone else." });
        seen.first = { page, sent };
        return pending.answer;
      },
    });
    await renderScreen();

    fireEvent.change(titleInput("404"), { target: { value: "Lost" } });
    fireEvent.click(saveButton("404"));
    await waitFor(() => expect((saveButton("404") as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(saveButton("404"));
    expect(api.calls.filter((call) => call.method === "PUT")).toHaveLength(1);

    pending.release(accept(seen.first!.page, seen.first!.sent));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("404 page saved."));
    await waitFor(() => expect((saveButton("404") as HTMLButtonElement).disabled).toBe(false));
    expect(api.calls.filter((call) => call.method === "PUT")).toHaveLength(1);
    expect(screen.queryByText("Someone else changed this page.")).toBeNull();
  });

  it("sends one publish while a publish is in flight", async () => {
    const pages = [errorPage("404", "draft"), errorPage("500", "draft")];
    const pending = held();
    let publishes = 0;
    api.handler = errorPagesApi(pages, {
      publish: (id) => {
        publishes += 1;
        if (publishes > 1) return fail(409, { code: "concurrency_conflict", title: "This item was changed by someone else." });
        return pending.answer.then((reply) => {
          const page = pages.find((item) => item.id === id)!;
          pages.splice(pages.indexOf(page), 1, { ...page, version: page.version + 1, status: "published", state: "published" });
          return reply;
        });
      },
    });
    await renderScreen();

    fireEvent.click(publishButton("404"));
    await waitFor(() => expect(publishButton("404").disabled).toBe(true));
    fireEvent.click(publishButton("404"));
    expect(publishes).toBe(1);

    pending.release(ok({ id: "p-404", state: "published", status: "published", version: 4, warnings: {} }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("404 page published. Changes appear on the website at the next build."));
    await waitFor(() => expect(publishButton("404").disabled).toBe(false));
    expect(publishes).toBe(1);
    expect(screen.queryByText("Someone else changed this page.")).toBeNull();
  });
});
