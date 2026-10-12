/*
 * The item editor's load race (found while proving 10.15): "Add page" opens the
 * editor while its item is still loading. The editor used to show its fields at
 * once, and the load, when it arrived, set every field, so a title typed in that
 * gap was replaced by "Untitled" and saved that way (10.13, then 10.14 failed).
 */
import { expect, test } from "@playwright/test";
import { openArea, signIn } from "./helpers";

test("typing in a new item's title before its load arrives keeps the typed text", async ({ page }) => {
  const typed = `Typed before the load ${Date.now()}`;
  await signIn(page);
  await openArea(page, "Pages");

  // Hold the editor's item load until the test releases it: a slow GET.
  let release = () => {};
  const arrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route(/\/api\/v1\/pages\/[0-9a-f-]{36}$/i, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    held += 1;
    await arrived;
    await route.continue();
  });

  await page.getByRole("button", { name: "Add page" }).click();
  await expect.poll(() => held, { message: "the editor is waiting for its item" }).toBeGreaterThan(0);

  // The item has not arrived. Type into the title wherever the editor offers it now.
  const title = page.locator("[data-field='title'] input");
  const typedEarly = await title.count() > 0;
  if (typedEarly) await title.fill(typed);

  release();
  await expect(page.locator(".status-chip")).toBeVisible(); // the load has arrived and been applied
  if (!typedEarly) await title.fill(typed); // the editor offered no field before its item: type now
  await expect(title).toHaveValue(typed);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(typed);
});
