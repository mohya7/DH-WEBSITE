import { expect, test, type Page } from "@playwright/test";
import { e2eCatalog, e2eEnv, productionCatalog } from "./env";
import { openArea, signIn } from "./helpers";

const adminScreens = [
  "Pages",
  "Services",
  "Partners",
  "Case studies",
  "Blog posts",
  "Vacancies",
  "Team",
  "News",
  "Media library",
  "Navigation",
  "Redirects",
  "Contact inbox",
  "Site settings",
  "Error pages",
  "Users",
  "Audit log",
] as const;

const editorScreens = adminScreens.filter((name) => name !== "Users" && name !== "Audit log");

test.describe.configure({ mode: "serial" });

test("12.5 admin sees every screen on DigitalHubContent_E2e", async ({ page }) => {
  const env = e2eEnv();
  expect(env.connectionString).toMatch(new RegExp(`(?:Database|Initial Catalog)=${e2eCatalog}(?:;|$)`));
  expect(env.connectionString).not.toMatch(new RegExp(`(?:Database|Initial Catalog)=${productionCatalog}(?:;|$)`));

  await signIn(page, "admin");
  await expectDarkStudio(page);
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("button", { name: "Content" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("button", { name: "Administration" })).toBeVisible();

  for (const name of adminScreens) {
    await openArea(page, name);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expectDarkStudio(page);
  }

  await openArea(page, "Pages");
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await expectDarkStudio(page);
});

test("12.5 editor sees every allowed screen and not administration", async ({ page }) => {
  await signIn(page, "editor");
  await expectDarkStudio(page);
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("button", { name: "Administration" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Users" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Audit log" })).toHaveCount(0);

  for (const name of editorScreens) {
    await openArea(page, name);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expectDarkStudio(page);
  }

  await page.goto("/users");
  await expect(page.getByText("You do not have access to this area.")).toBeVisible();
});

async function expectDarkStudio(page: Page) {
  const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(pageBg).toBe("rgb(23, 25, 28)");
  await expect(page.locator(".studio-rail")).toBeVisible();
  const railWidth = await page.locator(".studio-rail").evaluate((node) => Math.round(node.getBoundingClientRect().width));
  expect(railWidth).toBeGreaterThanOrEqual(160);
  expect(railWidth).toBeLessThanOrEqual(200);
}
