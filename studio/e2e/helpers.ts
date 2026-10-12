import { expect, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eEditorEmail, e2ePassword } from "./env";

export async function openArea(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name, exact: true }).click();
}

export async function signIn(page: Page, role: "admin" | "editor" = "admin") {
  await page.goto("/");
  await page.getByLabel("Email").fill(role === "admin" ? e2eAdminEmail : e2eEditorEmail);
  await page.getByLabel("Password").fill(e2ePassword);
  await page.getByRole("button", { name: "Sign in to Content Studio" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

/*
 * Adds a section through the editor's "Add section" select.
 *
 * antd opens the select's list with a slide-up animation, and the list takes clicks
 * while it is still moving. On CI (10.15) the click on the option landed during that
 * animation (the list still had ant-slide-up-appear-active), was lost, and the list
 * stayed open with nothing added. Playwright's own "stable" check had passed: the
 * animation had not started moving yet when it measured.
 *
 * So the option is clicked only when it is stable: antd has finished the opening
 * motion (rc-motion drops the -appear/-enter classes on animationend), and the
 * option, scrolled into the list's view, keeps the same box across animation frames.
 */
export async function addSection(page: Page, label: string) {
  const cards = page.locator("article.section-card");
  const before = await cards.count();
  await page.locator(".ant-select").filter({ hasText: "Add section" }).click();
  const option = page.getByRole("option", { name: label, exact: true });
  await expect(option).toBeVisible();
  await expect(page.locator(".ant-select-dropdown").filter({ has: option })).not.toHaveClass(/-(appear|enter)\b/);
  await option.scrollIntoViewIfNeeded();
  await expect.poll(() => option.evaluate((element) => new Promise<boolean>((resolve) => {
    const first = element.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const next = element.getBoundingClientRect();
      resolve(first.x === next.x && first.y === next.y && first.width === next.width && first.height === next.height);
    }));
  })), { message: `the "${label}" option has stopped moving` }).toBe(true);
  await option.click();
  await expect(cards).toHaveCount(before + 1);
  await expect(cards.last().locator("strong")).toHaveText(label);
}

export async function expectNoStoredToken(page: Page) {
  const stored = await page.evaluate(() => {
    const read = (storage: Storage) => {
      const values: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key === null) {
          continue;
        }

        values.push(`${key}=${storage.getItem(key) ?? ""}`);
      }

      return values;
    };

    return { local: read(localStorage), session: read(sessionStorage) };
  });

  for (const entry of [...stored.local, ...stored.session]) {
    expect(entry, entry).not.toMatch(/accessToken|refreshToken|Bearer |eyJ[A-Za-z0-9_-]{10,}/i);
  }
}
