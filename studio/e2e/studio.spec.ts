import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { e2eApiOrigin, e2eCatalog, e2eEditorEmail, e2eEnv, e2ePassword, productionCatalog } from "./env";
import { expectNoStoredToken, signIn } from "./helpers";

const pixel = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "pixel.png");
const scriptMessage = "<script>alert(1)</script> Please call about a programme.";

test.describe.configure({ mode: "serial" });

let publishedPageUrl = "";
let imageAlt = "";

test("10.12 sign-in reload and sign-out, 10.20 no token in storage", async ({ page }) => {
  await signIn(page);
  await expectNoStoredToken(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();
  await expect(page.getByText("e2e-admin@digitalhub.test")).toBeVisible();
  await expectNoStoredToken(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("10.13 edit a section on a page and publish", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "New" }).click();
  await fillItemField(page, "title", "E2E published page");
  await fillItemField(page, "slug", "e2e-published-page");
  await fillItemField(page, "metaDescription", "A page used to prove Studio publish from an edited section.");
  await addSection(page, "Call to action");
  await page.locator("[data-field='sections[0].heading'] input").fill("Talk to the team");
  await page.getByRole("button", { name: "Save" }).click();
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
    await pageA.getByRole("button", { name: "Save" }).click();
    await expect(pageA.getByText("Saved.")).toBeVisible();
    await fillItemField(pageB, "title", "Second session title");
    await pageB.getByRole("button", { name: "Save" }).click();
    await expect(pageB.getByRole("dialog", { name: "Someone else changed this item." })).toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});

test("10.15 upload an image with alt text and use it in a section", async ({ page }) => {
  imageAlt = "E2E pixel " + Date.now();
  await signIn(page);
  await page.getByRole("menuitem", { name: "Media library" }).click();
  await page.getByRole("button", { name: "Upload" }).click();
  const uploadModal = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
  await expect(uploadModal).toBeVisible();
  await uploadModal.locator("input[type='file']").setInputFiles(pixel);
  await uploadModal.locator(".ant-form-item").filter({ hasText: "Alt text" }).locator("input").fill(imageAlt);
  await uploadModal.getByRole("button", { name: "Upload and use" }).click();
  await expect(page.getByText(imageAlt)).toBeVisible();

  await page.getByRole("menuitem", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "New" }).click();
  await fillItemField(page, "title", "E2E media page");
  await fillItemField(page, "slug", "e2e-media-page");
  await fillItemField(page, "metaDescription", "A page that uses the uploaded e2e image in a profile section.");
  await addSection(page, "Profile");
  const profile = page.locator("article").filter({ has: page.locator("strong", { hasText: "Profile" }) });
  await profile.getByText("Choose image", { exact: true }).click();
  await page.locator(".ant-modal").filter({ hasText: "Choose an image" }).getByRole("button", { name: imageAlt }).click();
  await profile.getByRole("textbox", { name: "Name *" }).fill("Ada");
  await profile.getByRole("textbox", { name: "Quote *" }).fill("The image is in this section.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("10.16 deleting the used image lists every place", async ({ page }) => {
  await signIn(page);
  await page.getByRole("menuitem", { name: "Media library" }).click();
  await page.getByRole("button", { name: imageAlt }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("This image is used, so it was not deleted.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /pages .+ section / })).toBeVisible();
});

test("10.17 an editor does not see admin screens and admin APIs return 403", async ({ page, request }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("menuitem", { name: "Users" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Audit log" })).toHaveCount(0);
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
  await page.getByRole("menuitem", { name: "Contact inbox" }).click();
  await page.getByRole("row", { name: new RegExp(name) }).click();
  const drawer = page.locator(".ant-drawer");
  await expect(drawer.getByText(scriptMessage)).toBeVisible();
  expect(await drawer.locator("script").count()).toBe(0);
  const html = await drawer.locator(".ant-typography").filter({ hasText: scriptMessage }).innerHTML();
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
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
