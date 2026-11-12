/*
 * ADM-04: an admin can change a Studio user's role and reactivate a deactivated user
 * from User Management. A role change signs the user out (their access token is
 * refused at once); creating a user on a deactivated email offers "Reactivate
 * instead", which gives a new temporary password.
 *
 * The test makes its own editor through the API (not the seeded editor, which other
 * specs use), names it with a per-run stamp (e2e-adm04-...), and deactivates it in
 * finally, so no extra active admin is left for later specs.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { openArea, signIn } from "./helpers";

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email: e2eAdminEmail, password: e2ePassword } });
  expect(login.ok(), "sign in for setup").toBeTruthy();
  return { Authorization: `Bearer ${(await login.json() as { accessToken: string }).accessToken}` };
}

function userRow(page: Page, email: string) {
  return page.locator(".ant-table-tbody tr.ant-table-row").filter({ has: page.getByRole("cell", { name: email, exact: true }) });
}

/* Picks an option from an open antd select once its list has finished opening (see helpers.addSection). */
async function pickOption(page: Page, title: string) {
  const dropdown = page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)");
  const option = dropdown.locator(`.ant-select-item-option[title="${title}"]`);
  await expect(option).toBeVisible();
  await expect(dropdown).not.toHaveClass(/-(appear|enter)\b/);
  await option.click();
}

test("ADM-04 users: change a role, deactivate, reactivate", async ({ page, request }) => {
  const stamp = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`;
  const email = `e2e-adm04-${stamp}@digitalhub.test`;
  const password = `Adm04-${stamp}-Kq7!`;
  const headers = await adminHeaders(request);
  let userId: string | null = null;

  try {
    // 1. Set-up through the API: an editor of this run, signed in, its access token kept.
    const created = await request.post(`${e2eApiOrigin}/api/v1/users`, { headers, data: { email, role: "editor", password } });
    expect(created.status(), `create the editor: ${await created.text()}`).toBe(201);
    userId = (await created.json() as { id: string }).id;
    const signedIn = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email, password } });
    expect(signedIn.ok(), "the editor signs in").toBeTruthy();
    const editorToken = (await signedIn.json() as { accessToken: string }).accessToken;

    // 2. Change the role from User Management.
    await signIn(page, "admin");
    await openArea(page, "User Management");
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
    const row = userRow(page, email);
    await expect(row).toHaveCount(1);
    await row.getByRole("combobox", { name: `Role for ${email}` }).click();
    await pickOption(page, "admin");
    const confirm = page.getByRole("dialog", { name: "Change role?" });
    await expect(confirm).toBeVisible();
    const changed = page.waitForResponse((entry) => entry.url().endsWith(`/api/v1/users/${userId}/role`) && entry.request().method() === "PUT");
    await confirm.getByRole("button", { name: "Change role", exact: true }).click();
    expect((await changed).status()).toBe(200);
    await expect(confirm).toBeHidden();
    await expect(row.locator(".ant-select")).toContainText("admin");

    // 3. The editor's old access token is refused; the API lists the user as admin.
    const me = await request.get(`${e2eApiOrigin}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${editorToken}` } });
    expect(me.status(), "the old access token after the role change").toBe(401);
    const listed = await request.get(`${e2eApiOrigin}/api/v1/users`, { headers });
    expect(listed.ok()).toBeTruthy();
    const listedRow = (await listed.json() as { items: { id: string; role: string; active: boolean }[] }).items.find((item) => item.id === userId);
    expect(listedRow?.role).toBe("admin");

    // 4. Deactivate (an existing button).
    const deactivated = page.waitForResponse((entry) => entry.url().endsWith(`/api/v1/users/${userId}/deactivate`) && entry.request().method() === "POST");
    await row.getByRole("button", { name: "Deactivate", exact: true }).click();
    expect((await deactivated).status()).toBe(200);
    await expect(row.getByRole("cell", { name: "Inactive", exact: true })).toBeVisible();

    // 5. Creating the same email offers "Reactivate instead"; confirming shows a temporary password.
    await page.getByRole("button", { name: "Create user", exact: true }).click();
    const create = page.getByRole("dialog", { name: "Create user" });
    await expect(create).toBeVisible();
    await create.getByRole("textbox").first().fill(email);
    await create.locator("input[type=password]").fill(`Other-${stamp}-Kq7!`);
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(create.getByText("That email belongs to a deactivated user.", { exact: true })).toBeVisible();
    await create.getByRole("button", { name: "Reactivate instead", exact: true }).click();
    const reactivate = page.getByRole("dialog", { name: `Reactivate ${email}?` });
    await expect(reactivate).toBeVisible();
    const reactivated = page.waitForResponse((entry) => entry.url().endsWith(`/api/v1/users/${userId}/reactivate`) && entry.request().method() === "POST");
    await reactivate.getByRole("button", { name: "Reactivate", exact: true }).click();
    expect((await reactivated).status()).toBe(200);
    const shown = page.getByRole("dialog", { name: "Temporary password" });
    await expect(shown).toBeVisible();
    const temporary = await shown.locator("input").first().inputValue();
    expect(temporary.length).toBeGreaterThanOrEqual(12);
    await shown.getByRole("button", { name: "I have copied it", exact: true }).click();
    await expect(shown).toBeHidden();

    // 6. The temporary password signs in and must be changed; the original no longer works.
    const withTemporary = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email, password: temporary } });
    expect(withTemporary.status(), "sign in with the temporary password").toBe(200);
    expect((await withTemporary.json() as { mustChangePassword: boolean }).mustChangePassword).toBe(true);
    const withOriginal = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email, password } });
    expect(withOriginal.status(), "sign in with the original password").toBe(401);
  } finally {
    // 7. No extra active admin is left for later specs.
    if (userId !== null) {
      await request.post(`${e2eApiOrigin}/api/v1/users/${userId}/deactivate`, { headers });
    }
  }
});
