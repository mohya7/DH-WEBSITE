/*
 * ADM-05: the 404 and 500 pages go through the same draft and publish flow as
 * every other page, and the Error pages screen can publish them.
 *
 * The end-to-end database is reset empty and holds no error pages, so the test
 * makes both through the API, publishes them, and then works on the screen as an
 * editor: a Save on the published 404 is a draft, and only Publish puts it live.
 * finally unpublishes and deletes both pages, so P2.12 and every later spec see
 * the empty Error pages list again.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { openArea, signIn } from "./helpers";

type Item = { id: string; version: number; status: string; hasWorkingCopy: boolean; live: { sections: { fields: { body?: string } }[] } | null; content: { sections: { fields: { body?: string } }[] } };

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email: e2eAdminEmail, password: e2ePassword } });
  expect(login.ok(), "sign in for setup").toBeTruthy();
  return { Authorization: `Bearer ${(await login.json() as { accessToken: string }).accessToken}` };
}

function doc(text: string) {
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
}

function card(page: Page, type: "404" | "500") {
  return page.locator(".section-card").filter({ has: page.getByRole("heading", { name: `${type} page`, exact: true }) });
}

async function loadPage(request: APIRequestContext, headers: Record<string, string>, id: string) {
  const loaded = await request.get(`${e2eApiOrigin}/api/v1/pages/${id}`, { headers });
  expect(loaded.ok(), `read page ${id}: ${await loaded.text()}`).toBeTruthy();
  return await loaded.json() as Item;
}

test("ADM-05 error pages: save is a draft, publish puts it live", async ({ page, request }) => {
  const headers = await adminHeaders(request);
  const ids: Record<string, string> = {};

  try {
    // 1. Both error pages, made and published through the API.
    for (const [type, title] of [["404", "Page not found"], ["500", "Something went wrong"]] as const) {
      const created = await request.post(`${e2eApiOrigin}/api/v1/pages`, {
        headers,
        data: { slug: `error-${type}`, title, noIndex: true },
      });
      expect(created.ok(), `create error-${type}: ${await created.text()}`).toBeTruthy();
      const item = await created.json() as { id: string; version: number };
      ids[type] = item.id;

      const section = await request.post(`${e2eApiOrigin}/api/v1/pages/${item.id}/sections`, {
        headers,
        data: { version: item.version, type: "rich_text", fields: { heading: title, body: doc("E2E body A") } },
      });
      expect(section.ok(), `add the text section to error-${type}: ${await section.text()}`).toBeTruthy();
      const withSection = await section.json() as { version: number };

      const published = await request.post(`${e2eApiOrigin}/api/v1/pages/${item.id}/publish`, { headers, data: { version: withSection.version } });
      expect(published.ok(), `publish error-${type} at set-up: ${await published.text()}`).toBeTruthy();
    }

    // 2. The editor opens the screen: the 404 card says it is published.
    await signIn(page, "editor");
    await openArea(page, "Error pages");
    await expect(page.getByRole("heading", { name: "Error pages", exact: true })).toBeVisible();
    const notFound = card(page, "404");
    await expect(notFound.locator(".status-chip")).toHaveText("published");

    // 3. A changed body, saved: a draft, and the chip says "changed".
    const body = notFound.locator(".ProseMirror");
    await expect(body).toContainText("E2E body A");
    await body.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("E2E body B");
    await expect(body).toContainText("E2E body B");
    const saved = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/error-pages/404") && entry.request().method() === "PUT");
    await notFound.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator(".ant-message").getByText(/saved as a draft/)).toBeVisible();
    await expect(notFound.locator(".status-chip")).toHaveText("changed");

    // 4. The live page did not change.
    const draft = await loadPage(request, headers, ids["404"]);
    expect(draft.live?.sections[0]?.fields.body ?? "").toContain("E2E body A");
    expect(draft.content.sections[0]?.fields.body ?? "").toContain("E2E body B");

    // 5. Publish puts it live.
    const published = page.waitForResponse((entry) => entry.url().endsWith(`/api/v1/pages/${ids["404"]}/publish`) && entry.request().method() === "POST");
    await notFound.getByRole("button", { name: "Publish", exact: true }).click();
    const answer = await published;
    expect(answer.status(), `publish from the screen: ${await answer.text()}`).toBe(200);
    await expect(notFound.locator(".status-chip")).toHaveText("published");
    const live = await loadPage(request, headers, ids["404"]);
    expect(live.live?.sections[0]?.fields.body ?? "").toContain("E2E body B");
    expect(live.hasWorkingCopy).toBe(false);
  } finally {
    // 6. Both pages go, so the Error pages list is empty again.
    for (const id of Object.values(ids)) {
      const loaded = await request.get(`${e2eApiOrigin}/api/v1/pages/${id}`, { headers });
      if (!loaded.ok()) continue;
      let { version, status } = await loaded.json() as { version: number; status: string };
      if (status === "published") {
        const unpublished = await request.post(`${e2eApiOrigin}/api/v1/pages/${id}/unpublish`, { headers, data: { version } });
        if (unpublished.ok()) version = (await unpublished.json() as { version: number }).version;
      }
      await request.delete(`${e2eApiOrigin}/api/v1/pages/${id}?version=${version}`, { headers });
    }
  }
});
