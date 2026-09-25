/* Part 2 of the Phase B final verification: the twelve checks.
   Each test creates the content it needs, so the file does not depend on the
   order the other spec files run in. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2eEditorEmail, e2ePassword } from "./env";
import { openArea, signIn } from "./helpers";

/* Mirrors collectionRoutes in src/content/model.ts. Kept here rather than
   imported so a change to the app's list is caught by a failing count instead
   of being silently adopted by the test. */
const collections = [
  { path: "pages", collection: "pages", label: "Pages" },
  { path: "services", collection: "services", label: "Services" },
  { path: "partners", collection: "partners", label: "Partners" },
  { path: "case-studies", collection: "case-studies", label: "Case Studies" },
  { path: "blog-posts", collection: "blog-posts", label: "Blog" },
  { path: "vacancies", collection: "vacancies", label: "Vacancies" },
  { path: "team", collection: "team-members", label: "Leadership Team" },
  { path: "news", collection: "news-items", label: "News" },
];

const adminScreens = [
  "Overview", "Services", "Case Studies", "Blog", "News", "Partners", "Inbox",
  "Leadership Team", "Pages", "Vacancies", "Site settings", "Media library",
  "Navigation", "Redirects", "Error pages", "User Management", "Audit log",
];
const editorScreens = adminScreens.filter((name) => name !== "User Management" && name !== "Audit log");

/* Not serial: every test here creates the content it needs, so one failure must
   not skip the other eleven. The project already runs with one worker. */

const stamp = Date.now();
const unique = (label: string) => `${label} ${stamp}-${Math.random().toString(36).slice(2, 7)}`;

test("P2.1 Overview counts match the data, activity is real, and quick actions open the right screen", async ({ page, request }) => {
  const token = await tokenFor(request, e2eAdminEmail);
  // Guarantee at least one audit entry regardless of which spec ran first.
  await createItem(request, token, "news-items", `ov-${stamp}`, unique("Overview activity"));

  let total = 0;
  let published = 0;
  let drafts = 0;
  for (const entry of collections) {
    const result = await request.get(`${e2eApiOrigin}/api/v1/${entry.collection}?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(result.ok(), `${entry.collection} list`).toBeTruthy();
    const body = await result.json() as { items: Array<{ status: string }> };
    total += body.items.length;
    published += body.items.filter((item) => item.status === "published").length;
    drafts += body.items.filter((item) => item.status === "draft").length;
  }

  await signIn(page);
  await expect(statCard(page, "Total cards")).toHaveText(String(total));
  await expect(statCard(page, "Published content")).toHaveText(String(published));
  await expect(statCard(page, "Drafts")).toHaveText(String(drafts));
  await expect(statCard(page, "Collections")).toHaveText(String(collections.length));

  const activity = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Recent activity" }) });
  await expect(activity.getByText("No recent activity to show.")).toHaveCount(0);
  const entries = activity.locator("li");
  expect(await entries.count()).toBeGreaterThan(0);
  // A real entry names an action and carries a parsable timestamp, not "Invalid Date".
  await expect(entries.first().locator("strong")).not.toHaveText("");
  await expect(entries.first().locator("small")).not.toHaveText(/Invalid Date/);

  const quick = page.locator(".quick-panel");
  await quick.getByRole("button", { name: /New article/ }).click();
  await expect(page).toHaveURL(/\/blog-posts$/);
  await expect(page.getByRole("heading", { name: "Blog", exact: true })).toBeVisible();

  await openArea(page, "Overview");
  await quick.getByRole("button", { name: /New case study/ }).click();
  await expect(page).toHaveURL(/\/case-studies$/);
  await expect(page.getByRole("heading", { name: "Case Studies", exact: true })).toBeVisible();

  await openArea(page, "Overview");
  await quick.getByRole("button", { name: /Inbox/ }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
});

test("P2.2 Collection list: views, active view, search, status tabs, and reorder that persists", async ({ page, request }) => {
  const token = await tokenFor(request, e2eAdminEmail);
  const searchable = unique("Findable news");
  await createItem(request, token, "news-items", `list-a-${stamp}`, unique("List news A"));
  await createItem(request, token, "news-items", `list-b-${stamp}`, unique("List news B"));
  await createItem(request, token, "news-items", `list-c-${stamp}`, searchable);

  await signIn(page);
  await openArea(page, "News");
  const grid = page.locator(".content-grid");
  const gridBtn = page.getByRole("button", { name: "Grid", exact: true });
  const listBtn = page.getByRole("button", { name: "List", exact: true });

  // Grid is the default, and the active view is the one marked pressed.
  await expect(gridBtn).toHaveAttribute("aria-pressed", "true");
  await expect(listBtn).toHaveAttribute("aria-pressed", "false");
  await expect(grid).not.toHaveClass(/is-list/);
  expect(await page.locator("article.content-card").count()).toBeGreaterThan(0);

  await listBtn.click();
  await expect(listBtn).toHaveAttribute("aria-pressed", "true");
  await expect(gridBtn).toHaveAttribute("aria-pressed", "false");
  await expect(grid).toHaveClass(/is-list/);
  expect(await page.locator("article.content-card").count()).toBeGreaterThan(0);
  await gridBtn.click();
  await expect(grid).not.toHaveClass(/is-list/);

  // Search narrows the list to the matching item. Each filter waits for the
  // list request itself, so a count is never read against the previous result.
  const box = page.getByPlaceholder("Search this collection...");
  await reload(page, async () => {
    await box.fill(searchable);
    await box.press("Enter");
  });
  await expect(page.locator("article.content-card")).toHaveCount(1);
  await expect(page.locator("article.content-card").first()).toContainText(searchable);

  await reload(page, async () => {
    await box.fill("");
    await box.press("Enter");
  });
  await expect.poll(() => page.locator("article.content-card").count()).toBeGreaterThan(1);

  // Status tabs filter. Everything created here is a draft.
  await reload(page, () => segment(page, "Drafts").click());
  await expect.poll(() => page.locator("article.content-card").count()).toBeGreaterThan(0);
  for (const chip of await page.locator("article.content-card .status-chip").allTextContents()) {
    expect(chip).toBe("draft");
  }
  await reload(page, () => segment(page, "Published").click());
  await expect.poll(() => page.locator("article.content-card .status-chip")
    .allTextContents().then((chips) => chips.every((chip) => chip === "published"))).toBe(true);

  await reload(page, () => segment(page, "All").click());
  await expect.poll(() => page.locator("article.content-card").count()).toBeGreaterThan(1);

  // Reorder with the arrows, then prove it survived a reload.
  const before = await cardTitles(page);
  expect(before.length).toBeGreaterThan(1);
  /* The arrow updates the list optimistically and saves in the background, so
     wait for the save itself. Reloading on the optimistic state alone aborts
     the in-flight POST and the order comes back unchanged. */
  const saved = page.waitForResponse((entry) =>
    /\/news-items\/order$/.test(entry.url()) && entry.request().method() === "POST");
  await page.locator("article.content-card").first().getByRole("button", { name: "Move down" }).click();
  expect((await saved).status()).toBe(200);
  await expect.poll(async () => (await cardTitles(page))[0]).toBe(before[1]);
  const after = await cardTitles(page);
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "News", exact: true })).toBeVisible();
  const reloaded = await cardTitles(page);
  expect(reloaded[0]).toBe(before[1]);
  expect(reloaded[1]).toBe(before[0]);
});

test("P2.3 Duplicate creates a draft copy with the fields and sections, and does not publish", async ({ page }) => {
  const title = unique("Duplicate source");
  await signIn(page);
  await createPage(page, title, `dup-${stamp}`, "A page duplicated to prove fields and sections are copied.");
  await addSection(page, "Call to action");
  await page.locator("[data-field='sections[0].heading'] input").fill("Talk to the team");
  await saveItem(page);

  await openArea(page, "Pages");
  await cardFor(page, title).getByRole("button", { name: "Duplicate" }).click();

  await expect(page.getByRole("heading", { name: `${title} — Copy` })).toBeVisible();
  await expect(page.locator("[data-field='title'] input")).toHaveValue(`${title} — Copy`);
  await expect(page.locator("[data-field='slug'] input")).toHaveValue(/^copy-/);
  await expect(page.locator("[data-field='metaDescription']").locator("input, textarea").first())
    .toHaveValue("A page duplicated to prove fields and sections are copied.");
  // The copy carries the section, collapsed. Open it to read the copied field.
  const copied = page.locator("article").filter({ has: page.locator("strong", { hasText: "Call to action" }) });
  await expect(copied).toBeVisible();
  await copied.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("[data-field='sections[0].heading'] input")).toHaveValue("Talk to the team");
  // The copy is a draft: it carries the draft chip and offers no Unpublish.
  await expect(page.locator(".status-chip")).toHaveText("draft");
  await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(0);

  await openArea(page, "Pages");
  await expect(cardFor(page, `${title} — Copy`).locator(".status-chip")).toHaveText("draft");
  await expect(cardFor(page, title).locator(".status-chip")).toHaveText("draft");
});

test("P2.4 Preview appears only for a published item with a public path, and opens it", async ({ page, request }) => {
  const token = await tokenFor(request, e2eAdminEmail);
  const pageTitle = unique("Preview page");
  const slug = `preview-${stamp}`;
  await signIn(page);

  // A draft has no Preview.
  await createPage(page, pageTitle, slug, "A page used to prove the preview link only appears once published.");
  await saveItem(page);
  await openArea(page, "Pages");
  await expect(cardFor(page, pageTitle).getByRole("link", { name: "Preview" })).toHaveCount(0);

  // Publishing it adds one, pointing at the public path.
  await cardFor(page, pageTitle).getByRole("button", { name: "Edit" }).click();
  await publishItem(page);
  await openArea(page, "Pages");
  const preview = cardFor(page, pageTitle).getByRole("link", { name: "Preview" });
  await expect(preview).toHaveCount(1);
  const href = await preview.getAttribute("href");
  expect(href).toBe(`http://127.0.0.1:8765/${slug}`);
  await expect(preview).toHaveAttribute("target", "_blank");

  // It opens that address. The website itself need not be running for this.
  const opened = page.context().waitForEvent("page");
  await preview.click();
  const tab = await opened;
  expect(tab.url()).toBe(href);
  await tab.close();

  // A published item in a collection with no public path still has no Preview.
  const newsTitle = unique("Preview news");
  const created = await createItem(request, token, "news-items", `preview-news-${stamp}`, newsTitle);
  const publishResult = await request.post(`${e2eApiOrigin}/api/v1/news-items/${created.id}/publish`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { version: created.version },
  });
  expect(publishResult.ok(), "publish the news item").toBeTruthy();
  await openArea(page, "News");
  await expect(cardFor(page, newsTitle).locator(".status-chip")).toHaveText("published");
  await expect(cardFor(page, newsTitle).getByRole("link", { name: "Preview" })).toHaveCount(0);
});

test("P2.5 Editor: save makes a published item changed, publish makes it published", async ({ page }) => {
  const title = unique("State page");
  await signIn(page);
  await createPage(page, title, `state-${stamp}`, "A page used to prove the save and publish state transitions.");
  await saveItem(page);
  await publishItem(page);
  await expect(page.locator(".status-chip")).toHaveText("published");

  await page.locator("[data-field='metaDescription']").locator("input, textarea").first()
    .fill("Edited after publishing, so this item should read as changed.");
  await saveItem(page);
  await expect(page.locator(".status-chip")).toHaveText("changed");
  await expect(page.getByText("These edits are not on the website yet.")).toBeVisible();

  await publishItem(page);
  await expect(page.locator(".status-chip")).toHaveText("published");
});

test("P2.6 Discard draft returns to the live content", async ({ page }) => {
  const live = unique("Discard page");
  await signIn(page);
  await createPage(page, live, `discard-${stamp}`, "A page used to prove discarding a draft restores the live copy.");
  await saveItem(page);
  await publishItem(page);

  await page.locator("[data-field='title'] input").fill(`${live} EDITED`);
  await saveItem(page);
  await expect(page.locator(".status-chip")).toHaveText("changed");

  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByText("Draft discarded.")).toBeVisible();
  await expect(page.locator("[data-field='title'] input")).toHaveValue(live);
  await expect(page.locator(".status-chip")).toHaveText("published");
  await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(0);
});

test("P2.7 Revisions: open, view a snapshot, restore, and it creates a draft rather than publishing", async ({ page }) => {
  const title = unique("Revision page");
  await signIn(page);
  await createPage(page, title, `revision-${stamp}`, "First published description for the revision check.");
  await saveItem(page);
  await publishItem(page);

  await page.locator("[data-field='metaDescription']").locator("input, textarea").first()
    .fill("Second published description for the revision check.");
  await saveItem(page);
  await publishItem(page);
  await expect(page.locator(".status-chip")).toHaveText("published");

  await page.getByRole("button", { name: "Revisions" }).click();
  const drawer = page.locator(".ant-drawer");
  await expect(drawer.getByText("Restore writes a draft. It does not publish.")).toBeVisible();
  // The row div reads "Version 1ViewRestore"; only the span is exactly the label.
  const rows = drawer.locator("span").filter({ hasText: /^Version \d+$/ });
  await expect.poll(() => rows.count()).toBeGreaterThan(1);

  await drawer.getByRole("button", { name: "View" }).first().click();
  const snapshot = drawer.locator("pre");
  await expect(snapshot).toBeVisible();
  await expect(snapshot).toContainText(title);

  await drawer.getByRole("button", { name: "Restore" }).last().click();
  await expect(page.getByText("Restored as a draft.")).toBeVisible();

  // A restore writes a working copy. The live version is untouched.
  await expect(page.locator(".status-chip")).toHaveText("changed");
  await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();
  await expect(page.getByText("These edits are not on the website yet.")).toBeVisible();
});

test("P2.8 Media library: upload with alt text, use it, then deletion is refused and lists the use", async ({ page }) => {
  const alt = unique("Media pixel");
  await signIn(page);
  await openArea(page, "Media library");
  await page.getByRole("button", { name: "Upload" }).click();
  const upload = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
  await expect(upload).toBeVisible();
  await upload.locator("input[type='file']").setInputFiles(uniquePng());
  await upload.locator(".ant-form-item").filter({ hasText: "Alt text" }).locator("input").fill(alt);
  await upload.getByRole("button", { name: "Upload and use" }).click();
  await expect(page.getByText(alt)).toBeVisible();

  const title = unique("Media page");
  await createPage(page, title, `media-${stamp}`, "A page that uses the uploaded image so deletion is refused.");
  await addSection(page, "Profile");
  const profile = page.locator("article").filter({ has: page.locator("strong", { hasText: "Profile" }) });
  await profile.getByText("Choose image", { exact: true }).click();
  await page.locator(".ant-modal").filter({ hasText: "Choose an image" }).getByRole("button", { name: alt }).click();
  await profile.getByRole("textbox", { name: "Name *" }).fill("Ada");
  await profile.getByRole("textbox", { name: "Quote *" }).fill("This section uses the uploaded image.");
  await saveItem(page);

  await openArea(page, "Media library");
  await page.getByRole("button", { name: alt }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("This image is used, so it was not deleted.")).toBeVisible();
  const usage = page.getByRole("listitem").filter({ hasText: /pages .+ section / });
  await expect(usage).toBeVisible();
  await expect(page.getByText(alt).first()).toBeVisible();
});

test("P2.9 Change password from the user menu, then sign in again with the new password", async ({ page }) => {
  const next = "E2e-Changed-Passw0rd!";
  await signIn(page, "editor");
  await changePassword(page, e2eEditorEmail, e2ePassword, next);
  await signOut(page, e2eEditorEmail);

  // The old password no longer works, the new one does.
  await page.goto("/");
  await page.getByLabel("Email").fill(e2eEditorEmail);
  await page.getByLabel("Password").fill(e2ePassword);
  await page.getByRole("button", { name: "Sign in to Content Studio" }).click();
  await expect(page.getByText("The email or password is incorrect.")).toBeVisible();

  await signInWith(page, e2eEditorEmail, next);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Put it back, so this file leaves the editor account as it found it.
  await changePassword(page, e2eEditorEmail, next, e2ePassword);
  await signOut(page, e2eEditorEmail);
  await signIn(page, "editor");
});

test("P2.10 Global search finds an item and opens it", async ({ page }) => {
  const title = unique("Globally searchable article");
  await signIn(page);
  await startNewItem(page, "Blog", "Add article");
  await page.locator("[data-field='title'] input").fill(title);
  await page.locator("[data-field='slug'] input").fill(`global-${stamp}`);
  await saveItem(page);

  await openArea(page, "Overview");
  const box = page.locator("#globalSearch");
  await box.fill(title);
  await box.press("Enter");

  await expect(page).toHaveURL(/\/blog-posts\?q=/);
  await expect(page.getByRole("heading", { name: "Blog", exact: true })).toBeVisible();
  await expect(cardFor(page, title)).toBeVisible();

  await cardFor(page, title).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator("[data-field='title'] input")).toHaveValue(title);
});

test("P2.11 The editor has no User Management, no Audit log, and no Delete", async ({ page, request }) => {
  const token = await tokenFor(request, e2eAdminEmail);
  const title = unique("Editor visibility news");
  const created = await createItem(request, token, "news-items", `editor-${stamp}`, title);

  await signIn(page, "editor");
  const nav = page.getByRole("navigation", { name: "Studio" });
  await expect(nav.getByRole("link", { name: "User Management" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);

  // Delete is absent on a draft, which is the only state where an admin sees it.
  await page.goto(`/news/${created.id}`);
  await expect(page.locator("[data-field='title'] input")).toHaveValue(title);
  await expect(page.locator(".status-chip")).toHaveText("draft");
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

  // An admin on the same item does see it, so the absence is the role, not the state.
  await signOut(page, e2eEditorEmail);
  await signIn(page);
  await page.goto(`/news/${created.id}`);
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
});

test("P2.12 Every sidebar screen loads with no console error, as admin and as editor", async ({ page }) => {
  const failures: string[] = [];
  let screen = "sign-in";
  page.on("console", (entry) => {
    if (entry.type() === "error") failures.push(`${screen}: ${entry.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`${screen}: uncaught ${error.message}`));

  for (const role of ["admin", "editor"] as const) {
    screen = `${role} sign-in`;
    await signIn(page, role);
    for (const name of role === "admin" ? adminScreens : editorScreens) {
      screen = `${role} / ${name}`;
      await openArea(page, name);
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await signOut(page, role === "admin" ? e2eAdminEmail : e2eEditorEmail);
  }

  expect(failures, failures.join("\n")).toEqual([]);
});

async function tokenFor(request: APIRequestContext, email: string) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email, password: e2ePassword } });
  expect(login.ok(), `sign in as ${email}`).toBeTruthy();
  return (await login.json() as { accessToken: string }).accessToken;
}

async function createItem(request: APIRequestContext, token: string, collection: string, slug: string, title: string) {
  const created = await request.post(`${e2eApiOrigin}/api/v1/${collection}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { slug, title },
  });
  expect(created.ok(), `create ${collection}/${slug}`).toBeTruthy();
  return await created.json() as { id: string; version: number };
}

function statCard(page: Page, label: string) {
  return page.locator("article.stat-card").filter({ hasText: label }).locator("strong");
}

/* Runs an action that refetches the collection list and waits for that request
   to come back, so the assertion that follows never reads the previous list. */
async function reload(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse((entry) =>
    /\/api\/v1\/news-items\?/.test(entry.url()) && entry.request().method() === "GET");
  await action();
  await response;
}

function segment(page: Page, label: string) {
  return page.locator(".ant-segmented-item").filter({ hasText: new RegExp(`^${label} \\d+$`) });
}

/* Matches the card heading exactly. hasText is a substring match, so a source
   item and its "… — Copy" would both match and trip strict mode. */
function cardFor(page: Page, title: string) {
  return page.locator("article.content-card")
    .filter({ has: page.getByRole("heading", { level: 3, name: title, exact: true }) });
}

/* The media library de-duplicates on the processed image hash, so re-uploading
   the shared pixel fixture returns the existing asset and keeps its old alt
   text. Each upload test needs image bytes nothing else has used. */
function uniquePng() {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(12);
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = Math.floor(Math.random() * 256);
  const raw = Buffer.concat([
    Buffer.from([0]), pixels.subarray(0, 6),
    Buffer.from([0]), pixels.subarray(6, 12),
  ]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const file = path.join(os.tmpdir(), `dh-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  fs.writeFileSync(file, png);
  return file;
}

async function cardTitles(page: Page) {
  return await page.locator("article.content-card h3").allTextContents();
}

/* "Add page" creates the item and navigates, then the editor loads it and
   repopulates the form. Typing before that lands is overwritten, so wait for the
   loaded value first. */
async function startNewItem(page: Page, area: string, button: string) {
  await openArea(page, area);
  await page.getByRole("button", { name: button }).click();
  await expect(page.locator("[data-field='title'] input")).toHaveValue("Untitled");
}

async function createPage(page: Page, title: string, slug: string, description: string) {
  await startNewItem(page, "Pages", "Add page");
  await page.locator("[data-field='title'] input").fill(title);
  await page.locator("[data-field='slug'] input").fill(slug);
  await page.locator("[data-field='metaDescription']").locator("input, textarea").first().fill(description);
}

async function saveItem(page: Page) {
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

async function publishItem(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published. Changes appear on the website at the next build.")).toBeVisible();
}

async function addSection(page: Page, label: string) {
  await page.locator(".ant-select").filter({ hasText: "Add section" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.locator("article").filter({ hasText: label })).toBeVisible();
}

async function changePassword(page: Page, email: string, current: string, next: string) {
  await page.getByRole("button", { name: `${email} account menu` }).click();
  await page.getByRole("button", { name: "Change password" }).click();
  const modal = page.locator(".ant-modal").filter({ hasText: "Change password" });
  await expect(modal).toBeVisible();
  await modal.locator(".ant-form-item").filter({ hasText: "Current password" }).locator("input").fill(current);
  await modal.locator(".ant-form-item").filter({ hasText: "New password" }).locator("input").fill(next);
  await modal.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();
}

async function signOut(page: Page, email: string) {
  await page.getByRole("button", { name: `${email} account menu` }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in to Content Studio" })).toBeVisible();
}

async function signInWith(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to Content Studio" }).click();
}
