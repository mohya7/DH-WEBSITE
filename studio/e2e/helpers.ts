import { expect, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eEditorEmail, e2ePassword } from "./env";

const areaGroup: Record<string, string> = {
  Pages: "Content",
  Services: "Content",
  Partners: "Content",
  "Case studies": "Content",
  "Blog posts": "Content",
  Vacancies: "Content",
  Team: "Content",
  News: "Content",
  "Media library": "Library",
  Navigation: "Site",
  Redirects: "Site",
  "Contact inbox": "Site",
  "Site settings": "Site",
  "Error pages": "Site",
  Users: "Administration",
  "Audit log": "Administration",
};

export async function openArea(page: Page, name: string) {
  const group = areaGroup[name];
  if (group !== undefined) {
    await page.getByRole("navigation", { name: "Studio" }).getByRole("button", { name: group, exact: true }).click();
  }
  await page.getByRole("menuitem", { name, exact: true }).click();
}

export async function signIn(page: Page, role: "admin" | "editor" = "admin") {
  await page.goto("/");
  await page.getByLabel("Email").fill(role === "admin" ? e2eAdminEmail : e2eEditorEmail);
  await page.getByLabel("Password").fill(e2ePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();
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
