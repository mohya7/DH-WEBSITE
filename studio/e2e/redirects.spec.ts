/*
 * ADM-07: a manual redirect can take over a live page or loop, and can point at
 * nothing. Parts 1 and 2 were fixed by ADM-02 and are proven here again, end to end;
 * part 3 is the target check this change adds: a redirect to an address with no page
 * is created, but the Studio warns on create and marks its row "No page".
 *
 * The test seeds its own page through the API, names everything with a per-run
 * stamp (adm07-...), and removes what it made in finally.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { openArea, signIn } from "./helpers";

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email: e2eAdminEmail, password: e2ePassword } });
  expect(login.ok(), "sign in for setup").toBeTruthy();
  return { Authorization: `Bearer ${(await login.json() as { accessToken: string }).accessToken}` };
}

async function addRedirect(page: Page, fromPath: string, toPath: string) {
  const dialog = page.getByRole("dialog", { name: "Add redirect" });
  if (!(await dialog.isVisible())) {
    await page.getByRole("button", { name: "Add redirect", exact: true }).click();
    await expect(dialog).toBeVisible();
  }
  await dialog.getByPlaceholder("/old-path").fill(fromPath);
  await dialog.getByPlaceholder("/new-path").fill(toPath);
  const answered = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/redirects") && entry.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  return await answered;
}

function rowFrom(page: Page, fromPath: string) {
  return page.locator(".ant-table-tbody tr.ant-table-row").filter({ has: page.getByRole("cell", { name: fromPath, exact: true }) });
}

test("ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged", async ({ page, request }) => {
  const stamp = `adm07-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const slug = `e2e-${stamp}`;
  const headers = await adminHeaders(request);
  let pageId: string | null = null;

  try {
    const created = await request.post(`${e2eApiOrigin}/api/v1/pages`, {
      headers,
      data: { slug, title: `ADM-07 ${stamp}`, metaDescription: `A page used to prove the ADM-07 redirect checks, ${stamp}.` },
    });
    expect(created.ok(), `create the page: ${await created.text()}`).toBeTruthy();
    const item = await created.json() as { id: string; version: number };
    pageId = item.id;
    const published = await request.post(`${e2eApiOrigin}/api/v1/pages/${item.id}/publish`, { headers, data: { version: item.version } });
    expect(published.ok(), `publish the page: ${await published.text()}`).toBeTruthy();

    await signIn(page);
    await openArea(page, "Redirects");
    await expect(page.getByRole("heading", { name: "Redirects", exact: true })).toBeVisible();

    // 1. A redirect from a live page's address, with a trailing slash, is refused (part 1).
    expect((await addRedirect(page, `/${slug}/`, "/")).status()).toBe(400);
    await expect(page.getByText("A redirect source cannot equal the path of a live page.", { exact: true })).toBeVisible();

    // 2. A redirect to its own address, with a trailing slash, is refused (part 2).
    expect((await addRedirect(page, `/${stamp}-a`, `/${stamp}-a/`)).status()).toBe(400);
    await expect(page.getByText("A redirect cannot point at itself.", { exact: true })).toBeVisible();

    // 3. A redirect to an address with no page is created, with a warning, and its row is marked (part 3).
    expect((await addRedirect(page, `/${stamp}-old`, `/${stamp}-nowhere`)).status()).toBe(201);
    await expect(page.locator(".ant-message").getByText(
      `Redirect created, but no published page answers at /${stamp}-nowhere. Visitors who follow it see the 404 page.`,
      { exact: true },
    )).toBeVisible();
    const searched = page.waitForResponse((entry) => /\/api\/v1\/redirects\?/.test(entry.url()) && entry.url().includes(`search=${stamp}`));
    await page.getByPlaceholder("Search paths").fill(stamp);
    await page.getByPlaceholder("Search paths").press("Enter");
    await searched;
    await expect(rowFrom(page, `/${stamp}-old`).getByText("No page", { exact: true })).toBeVisible();

    // 4. A redirect to the live page is created quietly, and its row is not marked.
    expect((await addRedirect(page, `/${stamp}-ok`, `/${slug}/`)).status()).toBe(201);
    await expect(page.locator(".ant-message").getByText("Redirect created.", { exact: true })).toBeVisible();
    await expect(rowFrom(page, `/${stamp}-ok`)).toHaveCount(1);
    await expect(rowFrom(page, `/${stamp}-ok`).getByText("No page", { exact: true })).toHaveCount(0);
  } finally {
    const listed = await request.get(`${e2eApiOrigin}/api/v1/redirects?pageSize=100&search=${encodeURIComponent(stamp)}`, { headers });
    if (listed.ok()) {
      for (const row of (await listed.json() as { items: { id: string }[] }).items) {
        await request.delete(`${e2eApiOrigin}/api/v1/redirects/${row.id}`, { headers });
      }
    }
    if (pageId !== null) {
      const loaded = await request.get(`${e2eApiOrigin}/api/v1/pages/${pageId}`, { headers });
      if (loaded.ok()) {
        let { version, status } = await loaded.json() as { version: number; status: string };
        if (status === "published") {
          const unpublished = await request.post(`${e2eApiOrigin}/api/v1/pages/${pageId}/unpublish`, { headers, data: { version } });
          if (unpublished.ok()) version = (await unpublished.json() as { version: number }).version;
        }
        await request.delete(`${e2eApiOrigin}/api/v1/pages/${pageId}?version=${version}`, { headers });
      }
    }
  }
});
