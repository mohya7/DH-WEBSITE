// @vitest-environment jsdom
/*
 * ADM-04: User Management changes a user's role after a confirmation, reactivates a
 * deactivated user (showing the temporary password once), and offers "Reactivate
 * instead" when a new user's email belongs to a deactivated user. The API is faked.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

type Reply = { ok: boolean; status: number; body: unknown; problem: { code?: string; title?: string } | null };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body: string | undefined }>,
  handler: (async () => {
    throw new Error("no handler");
  }) as (path: string, init?: RequestInit) => Promise<Reply>,
}));

vi.mock("../src/api/http", () => ({
  request: vi.fn(async (path: string, init?: RequestInit) => {
    api.calls.push({ path, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
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
 * render() makes, so cleanup() cannot unmount it, and a redraw after the file ends
 * fails ("window is not defined"; ADM-06b-flake). Both toasts are spies, as in
 * listPaging.test.tsx.
 */
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }));
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, message: { ...actual.message, success: toast.success, warning: toast.warning } };
});

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u-1", role: "admin", email: "me@x.test" }, ready: true }),
}));

const { UsersPage } = await import("../src/pages/UsersPage");
const { ConfigProvider } = await import("antd");

/* jsdom never fires animationend, so a Modal with motion never finishes opening. */
function NoMotion({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>;
}

type UserRow = { id: string; email: string; role: string; active: boolean; mustChangePassword: boolean };

const rows = (): UserRow[] => [
  { id: "u-1", email: "me@x.test", role: "admin", active: true, mustChangePassword: false },
  { id: "u-2", email: "ed@x.test", role: "editor", active: true, mustChangePassword: false },
  { id: "u-3", email: "old@x.test", role: "hr", active: false, mustChangePassword: false },
];

const ok = (body: unknown): Reply => ({ ok: true, status: 200, body, problem: null });
const failed = (status: number, problem: { code: string; title: string }): Reply => ({ ok: false, status, body: problem, problem });

/** The users list, plus the extra routes a test expects; any other call throws. */
function usersApi(routes: Record<string, () => Reply> = {}) {
  return async (path: string, init?: RequestInit): Promise<Reply> => {
    const method = init?.method ?? "GET";
    if (path === "/api/v1/users" && method === "GET") return ok({ items: rows() });
    const route = routes[`${method} ${path}`];
    if (route) return route();
    throw new Error(`unexpected ${method} ${path}`);
  };
}

function calls(method: string, path: string) {
  return api.calls.filter((call) => call.method === method && call.path === path);
}

function row(email: string) {
  return screen.getByText(email).closest("tr")!;
}

async function renderPage() {
  render(<NoMotion><UsersPage /></NoMotion>);
  await screen.findByText("ed@x.test");
}

/** Opens a row's role select and picks an option by its label. */
async function chooseRole(email: string, label: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: `Role for ${email}` }));
  await waitFor(() => expect(document.querySelector(`.ant-select-item-option[title="${label}"]`)).not.toBeNull());
  fireEvent.click(document.querySelector(`.ant-select-item-option[title="${label}"]`)!);
}

function shownRole(email: string) {
  return screen.getByRole("combobox", { name: `Role for ${email}` }).closest(".ant-select")!.textContent;
}

beforeEach(() => {
  api.calls = [];
  toast.success.mockClear();
  toast.warning.mockClear();
});

afterEach(() => {
  cleanup();
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
});

describe("user management", () => {
  it("changes a user's role after confirming", async () => {
    api.handler = usersApi({ "PUT /api/v1/users/u-2/role": () => ok({ id: "u-2", email: "ed@x.test", role: "admin", active: true, mustChangePassword: false }) });
    await renderPage();

    await chooseRole("ed@x.test", "admin");
    const dialog = await screen.findByRole("dialog", { name: "Change role?" });
    expect(within(dialog).getByText("ed@x.test becomes admin. They are signed out and sign in again with the new role.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Change role" }));

    await waitFor(() => expect(calls("GET", "/api/v1/users")).toHaveLength(2));
    const puts = calls("PUT", "/api/v1/users/u-2/role");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0].body ?? "null")).toEqual({ role: "admin" });
    expect(toast.success).toHaveBeenCalledWith("Role changed. ed@x.test must sign in again.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a cancelled role change sends nothing", async () => {
    api.handler = usersApi();
    await renderPage();

    await chooseRole("ed@x.test", "HR");
    const dialog = await screen.findByRole("dialog", { name: "Change role?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.calls.filter((call) => call.method === "PUT")).toHaveLength(0);
    expect(shownRole("ed@x.test")).toContain("editor");
  });

  it("your own row and inactive rows have no role select", async () => {
    api.handler = usersApi();
    await renderPage();

    expect(screen.queryByRole("combobox", { name: "Role for me@x.test" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Role for old@x.test" })).toBeNull();
    expect(within(row("me@x.test")).getByText("admin", { selector: ".status-chip" })).toBeTruthy();
    expect(within(row("old@x.test")).getByText("hr", { selector: ".status-chip" })).toBeTruthy();
  });

  it("shows why a role change was refused", async () => {
    api.handler = usersApi({
      "PUT /api/v1/users/u-2/role": () => failed(400, { code: "last_admin", title: "The last active admin cannot lose the admin role." }),
    });
    await renderPage();

    await chooseRole("ed@x.test", "admin");
    const dialog = await screen.findByRole("dialog", { name: "Change role?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Change role" }));

    await screen.findByText("The last active admin cannot lose the admin role.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls("PUT", "/api/v1/users/u-2/role")).toHaveLength(1);
    expect(calls("GET", "/api/v1/users")).toHaveLength(1);
    expect(shownRole("ed@x.test")).toContain("editor");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reactivates an inactive user and shows the temporary password", async () => {
    api.handler = usersApi({
      "POST /api/v1/users/u-3/reactivate": () =>
        ok({ id: "u-3", email: "old@x.test", role: "hr", active: true, mustChangePassword: true, temporaryPassword: "Tmp-Pass-1234!ab" }),
    });
    await renderPage();

    fireEvent.click(within(row("old@x.test")).getByRole("button", { name: "Reactivate" }));
    const confirm = await screen.findByRole("dialog", { name: "Reactivate old@x.test?" });
    expect(within(confirm).getByText("They get a temporary password and must change it at sign-in.")).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Reactivate" }));

    const shown = await screen.findByRole("dialog", { name: "Temporary password" });
    expect(within(shown).getByDisplayValue("Tmp-Pass-1234!ab")).toBeTruthy();
    expect(calls("POST", "/api/v1/users/u-3/reactivate")).toHaveLength(1);
    await waitFor(() => expect(calls("GET", "/api/v1/users")).toHaveLength(2));

    fireEvent.click(within(shown).getByRole("button", { name: "I have copied it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers to reactivate when a new user's email is deactivated", async () => {
    api.handler = usersApi({
      "POST /api/v1/users": () => failed(409, { code: "email_taken", title: "A user with that email already exists." }),
      "POST /api/v1/users/u-3/reactivate": () =>
        ok({ id: "u-3", email: "old@x.test", role: "hr", active: true, mustChangePassword: true, temporaryPassword: "Tmp-Pass-1234!ab" }),
    });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    const create = await screen.findByRole("dialog", { name: "Create user" });
    fireEvent.change(within(create).getAllByRole("textbox")[0], { target: { value: " OLD@x.test " } });
    fireEvent.click(within(create).getByRole("button", { name: "Create" }));

    await within(create).findByText("That email belongs to a deactivated user.");
    fireEvent.click(within(create).getByRole("button", { name: "Reactivate instead" }));
    const confirm = await screen.findByRole("dialog", { name: "Reactivate old@x.test?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Reactivate" }));

    const shown = await screen.findByRole("dialog", { name: "Temporary password" });
    expect(calls("POST", "/api/v1/users/u-3/reactivate")).toHaveLength(1);
    fireEvent.click(within(shown).getByRole("button", { name: "I have copied it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a taken active email shows the API's message", async () => {
    api.handler = usersApi({
      "POST /api/v1/users": () => failed(409, { code: "email_taken", title: "A user with that email already exists." }),
    });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    const create = await screen.findByRole("dialog", { name: "Create user" });
    fireEvent.change(within(create).getAllByRole("textbox")[0], { target: { value: "ed@x.test" } });
    fireEvent.click(within(create).getByRole("button", { name: "Create" }));

    await screen.findByText("A user with that email already exists.");
    expect(screen.queryByRole("button", { name: "Reactivate instead" })).toBeNull();
    fireEvent.click(within(create).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
