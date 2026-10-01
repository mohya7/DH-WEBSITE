import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { e2eApiOrigin, e2eCatalog, e2eEditorEmail, e2eEnv, e2ePassword, productionCatalog } from "./env";
import { expectNoStoredToken, openArea, signIn } from "./helpers";

const pixel = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "pixel.png");
const scriptMessage = "<script>alert(1)</script> Please call about a programme.";

test.describe.configure({ mode: "serial" });

let publishedPageUrl = "";
let imageAlt = "";

test("10.12 sign-in reload and sign-out, 10.20 no token in storage", async ({ page }) => {
  await signIn(page);
  await expectNoStoredToken(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  /* Scoped to the header chip. A bare getByText also matches the sign_in rows
     in Overview's recent activity, which carry the same address, so it resolved
     to three elements whenever those entries sat in the top of the audit list. */
  await expect(page.locator(".studio-user-chip").getByText("e2e-admin@digitalhub.test")).toBeVisible();
  await expectNoStoredToken(page);
  await page.getByRole("button", { name: "e2e-admin@digitalhub.test account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in to Content Studio" })).toBeVisible();
});

test("10.13 edit a section on a page and publish", async ({ page }) => {
  await signIn(page);
  await openArea(page, "Pages");
  await page.getByRole("button", { name: "Add page" }).click();
  await fillItemField(page, "title", "E2E published page");
  await fillItemField(page, "slug", "e2e-published-page");
  await fillItemField(page, "metaDescription", "A page used to prove Studio publish from an edited section.");
  await addSection(page, "Call to action");
  await page.locator("[data-field='sections[0].heading'] input").fill("Talk to the team");
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published. Changes appear on the website at the next build.")).toBeVisible();
  await expect(page.getByText("published", { exact: true }).first()).toBeVisible();
  publishedPageUrl = page.url();
  expect(publishedPageUrl).toMatch(/\/pages\/[0-9a-f-]{36}/i);
});

test("10.14 the second save shows the conflict message", async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const pageA = await first.newPage();
  const pageB = await second.newPage();
  try {
    await signIn(pageA);
    await signIn(pageB);
    await pageA.goto(publishedPageUrl);
    await pageB.goto(publishedPageUrl);
    await expect(pageA.getByRole("heading", { name: "E2E published page" })).toBeVisible();
    await expect(pageB.getByRole("heading", { name: "E2E published page" })).toBeVisible();
    await expect(pageA.locator("[data-field='title'] input")).toHaveValue("E2E published page");
    await expect(pageB.locator("[data-field='title'] input")).toHaveValue("E2E published page");
    await fillItemField(pageA, "title", "First session title");
    await pageA.getByRole("button", { name: "Save content" }).click();
    await expect(pageA.getByText("Saved.")).toBeVisible();
    await fillItemField(pageB, "title", "Second session title");
    await pageB.getByRole("button", { name: "Save content" }).click();
    await expect(pageB.getByRole("dialog", { name: "Someone else changed this item." })).toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});

test("10.15 upload an image with alt text and use it in a section", async ({ page }) => {
  imageAlt = "E2E pixel " + Date.now();
  await signIn(page);
  await openArea(page, "Media library");
  await page.getByRole("button", { name: "Upload" }).click();
  const uploadModal = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
  await expect(uploadModal).toBeVisible();
  await uploadModal.locator("input[type='file']").setInputFiles(pixel);
  await uploadModal.locator(".ant-form-item").filter({ hasText: "Alt text" }).locator("input").fill(imageAlt);
  await uploadModal.getByRole("button", { name: "Upload and use" }).click();
  await expect(page.getByText(imageAlt)).toBeVisible();

  await openArea(page, "Pages");
  await page.getByRole("button", { name: "Add page" }).click();
  await fillItemField(page, "title", "E2E media page");
  await fillItemField(page, "slug", "e2e-media-page");
  await fillItemField(page, "metaDescription", "A page that uses the uploaded e2e image in a profile section.");
  await addSection(page, "Profile");
  const profile = page.locator("article").filter({ has: page.locator("strong", { hasText: "Profile" }) });
  await profile.getByText("Choose image", { exact: true }).click();
  await page.locator(".ant-modal").filter({ hasText: "Choose an image" }).getByRole("button", { name: imageAlt }).click();
  await profile.getByRole("textbox", { name: "Name *" }).fill("Ada");
  await profile.getByRole("textbox", { name: "Quote *" }).fill("The image is in this section.");
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("10.16 deleting the used image lists every place", async ({ page }) => {
  await signIn(page);
  await openArea(page, "Media library");
  await page.getByRole("button", { name: imageAlt }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("This image is used, so it was not deleted.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /pages .+ section / })).toBeVisible();
});

test("10.17 an editor does not see admin screens and admin APIs return 403", async ({ page, request }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "User Management" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "Audit log" })).toHaveCount(0);
  await page.goto("/users");
  await expect(page.getByText("You do not have access to this area.")).toBeVisible();

  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, {
    data: { email: e2eEditorEmail, password: e2ePassword },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json() as { accessToken: string }).accessToken;
  const users = await request.get(`${e2eApiOrigin}/api/v1/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const audit = await request.get(`${e2eApiOrigin}/api/v1/audit`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(users.status()).toBe(403);
  expect(audit.status()).toBe(403);
});

test("10.18 end-to-end uses DigitalHubContent_E2e", () => {
  const env = e2eEnv();
  expect(env.connectionString).toMatch(new RegExp(`(?:Database|Initial Catalog)=${e2eCatalog}(?:;|$)`));
  expect(env.connectionString).not.toMatch(new RegExp(`(?:Database|Initial Catalog)=${productionCatalog}(?:;|$)`));
});

test("10.19 a script in a contact message is stored and shown as text", async ({ page, request }) => {
  const name = "E2E XSS " + Date.now();
  const created = await request.post(`${e2eApiOrigin}/api/v1/public/contact`, {
    data: {
      situation: "gov",
      name,
      organization: "Digital Hub",
      role: "Buyer",
      email: `xss-${Date.now()}@example.com`,
      message: scriptMessage,
    },
  });
  expect(created.status()).toBe(201);

  await signIn(page);
  await openArea(page, "Inbox");
  await page.getByRole("heading", { name }).click();
  const drawer = page.locator(".ant-drawer");
  await expect(drawer.getByText(scriptMessage)).toBeVisible();
  expect(await drawer.locator("script").count()).toBe(0);
  const html = await drawer.locator(".ant-typography").filter({ hasText: scriptMessage }).innerHTML();
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});

test("10.21 a section reference offers pages and links one", async ({ page }) => {
  /* Self-contained: it publishes its own target page under a title no other
     test uses or renames, then links to it from a page of its own. */
  const stamp = Date.now().toString(36);
  const targetTitle = `E2E reference target ${stamp}`;
  await signIn(page);

  await openArea(page, "Pages");
  await page.getByRole("button", { name: "Add page" }).click();
  await fillItemField(page, "title", targetTitle);
  await fillItemField(page, "slug", `e2e-reference-target-${stamp}`);
  await fillItemField(page, "metaDescription", "A page published so a section on another page can link to it.");
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published. Changes appear on the website at the next build.")).toBeVisible();
  const targetUrl = page.url();
  expect(targetUrl).toMatch(/\/pages\/[0-9a-f-]{36}/i);
  const targetId = targetUrl.split("/").pop() ?? "";

  await openArea(page, "Pages");
  await page.getByRole("button", { name: "Add page" }).click();
  await fillItemField(page, "title", `E2E reference host ${stamp}`);
  await fillItemField(page, "slug", `e2e-reference-host-${stamp}`);
  await addSection(page, "Service cards");
  await page.locator("[data-field='sections[0].heading'] input").fill("Services with a page link");
  await page.locator("[data-field='sections[0].items']").getByRole("button", { name: "Add items" }).click();
  await page.locator("[data-field='sections[0].items[0].title'] input").fill("Consultation");

  const reference = page.locator("[data-field='sections[0].items[0].reference']");
  const type = reference.getByLabel("Linked item type");
  await expect(type.locator("option")).toHaveText(["Service", "Partner", "Case study", "Blog post", "Page"]);
  await type.selectOption("page");
  await reference.getByPlaceholder("Search the linked item").fill(targetTitle);
  await reference.getByRole("button", { name: targetTitle }).click();
  await expect(reference.getByText(`Linked item ${targetId}`)).toBeVisible();

  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await page.locator("article").filter({ hasText: "Service cards" }).getByRole("button", { name: "Edit" }).click();
  const saved = page.locator("[data-field='sections[0].items[0].reference']");
  await expect(saved.getByLabel("Linked item type")).toHaveValue("page");
  await expect(saved.getByText(`Linked item ${targetId}`)).toBeVisible();
});

async function fillItemField(page: import("@playwright/test").Page, field: string, value: string) {
  const control = page.locator(`[data-field='${field}']`).locator("input, textarea").first();
  await expect(control).toBeVisible();
  await control.fill(value);
}

async function addSection(page: import("@playwright/test").Page, label: string) {
  await page.locator(".ant-select").filter({ hasText: "Add section" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.locator("article").filter({ hasText: label })).toBeVisible();
}
