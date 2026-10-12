import { expect, test, type Page } from "@playwright/test";
import { e2eCatalog, e2eEnv, productionCatalog } from "./env";
import { openArea, signIn } from "./helpers";

const adminScreens = [
  "Overview",
  "Services",
  "Case Studies",
  "Blog",
  "News",
  "Partners",
  "Inbox",
  "Leadership Team",
  "Pages",
  "Vacancies",
  "Site settings",
  "Media library",
  "Navigation",
  "Redirects",
  "Error pages",
  "User Management",
  "Audit log",
] as const;

const editorScreens = adminScreens.filter((name) => name !== "User Management" && name !== "Audit log");

test.describe.configure({ mode: "serial" });

test("12.5 admin sees every screen on DigitalHubContent_E2e", async ({ page }) => {
  const env = e2eEnv();
  expect(env.connectionString).toMatch(new RegExp(`(?:Database|Initial Catalog)=${e2eCatalog}(?:;|$)`));
  expect(env.connectionString).not.toMatch(new RegExp(`(?:Database|Initial Catalog)=${productionCatalog}(?:;|$)`));

  await signIn(page, "admin");
  await expectOldStudio(page);
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "User Management" })).toBeVisible();

  for (const name of adminScreens) {
    await openArea(page, name);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expectOldStudio(page);
  }

  await openArea(page, "Pages");
  await page.getByRole("button", { name: "Add page" }).click();
  await expect(page.getByRole("button", { name: "Save content" })).toBeVisible();
  await expectOldStudio(page);

  await openArea(page, "Site settings");
  for (const label of ["Analytics container ID", "Cookie banner title", "Cookie banner text", "Accept all label", "Reject all label", "Analytics only label", "Cookie settings label"]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }
});

test("12.5 editor sees every allowed screen and not administration", async ({ page }) => {
  await signIn(page, "editor");
  await expectOldStudio(page);
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "User Management" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "Audit log" })).toHaveCount(0);

  for (const name of editorScreens) {
    await openArea(page, name);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expectOldStudio(page);
  }

  await page.goto("/users");
  await expect(page.getByText("You do not have access to this area.")).toBeVisible();
});

async function expectOldStudio(page: Page) {
  const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(pageBg).toBe("rgb(7, 17, 31)");
  await expect(page.locator(".studio-sidebar")).toBeVisible();
  const width = await page.locator(".studio-sidebar").evaluate((node) => Math.round(node.getBoundingClientRect().width));
  expect(width).toBeGreaterThanOrEqual(240);
  expect(width).toBeLessThanOrEqual(280);
}
