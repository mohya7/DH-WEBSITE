/*
 * ADM-06: Studio lists reach rows past the first page.
 *
 * Each test seeds its own rows through the API and finds them by a per-run
 * stamp, so it does not depend on other spec files. The colour checks are the
 * criterion for the pager's look (plan 3.2): the token-only
 * components.Pagination override in src/theme.ts keeps the pager on the navy
 * surfaces. The screenshots are extra evidence only.
 */
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { openArea, signIn } from "./helpers";

// Token values, from packages/theme/tokens.ts.
const surfacesCard = "rgb(14, 27, 44)"; // surfaces.card #0E1B2C
const surfacesRaised = "rgb(17, 31, 50)"; // surfaces.raised #111F32
const accentStudio = "rgb(31, 158, 233)"; // accent.studio #1F9EE9
const textPrimary = "rgb(244, 248, 252)"; // text.primary #F4F8FC

function pageTwo(pager: Locator) {
  return pager.locator(".ant-pagination").getByTitle("2", { exact: true });
}

async function expectNavyBackgrounds(page: Page, pager: Locator) {
  // No hover colour may be read.
  await page.mouse.move(0, 0);
  const other = pager.locator(".ant-pagination-item:not(.ant-pagination-item-active)").first();
  const active = pager.locator(".ant-pagination-item-active");
  await expect(other).toHaveCSS("background-color", surfacesCard);
  await expect(active).toHaveCSS("background-color", surfacesRaised);
  return { other, active };
}

async function tokenFor(request: APIRequestContext, email: string) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email, password: e2ePassword } });
  expect(login.ok(), `sign in as ${email}`).toBeTruthy();
  return (await login.json() as { accessToken: string }).accessToken;
}

test("ADM-06 inbox: the 51st enquiry is on page 2 and opens", async ({ page, request }) => {
  const stamp = Date.now().toString(36);
  const marker = `E2E paging marker ${stamp}`;
  const markerMessage = `Paging marker message ${stamp}.`;

  async function enquiry(name: string, message: string, index: number) {
    const created = await request.post(`${e2eApiOrigin}/api/v1/public/contact`, {
      data: {
        situation: "gov",
        name,
        organization: "Digital Hub",
        role: "Buyer",
        email: `paging-${stamp}-${index}@example.com`,
        message,
      },
    });
    expect(created.status(), `enquiry ${name}`).toBe(201);
  }

  // The marker first, then 50 newer fillers: the inbox is newest first, so the
  // marker is exactly the 51st row.
  await enquiry(marker, markerMessage, 0);
  for (let index = 1; index <= 50; index += 1) {
    await enquiry(`E2E paging filler ${stamp} ${String(index).padStart(2, "0")}`, "A filler enquiry for the paging test.", index);
  }

  await signIn(page);
  await openArea(page, "Inbox");
  await expect(page.locator("article.contact-card")).toHaveCount(50);
  await expect(page.getByRole("heading", { name: marker, exact: true })).toHaveCount(0);

  // The pager's label must not match the sidebar's "Studio" locator.
  await expect(page.getByRole("navigation", { name: "Studio" })).toHaveCount(1);
  const pager = page.getByRole("navigation", { name: "Inbox pages", exact: true });
  await pageTwo(pager).click();
  await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();

  const { other, active } = await expectNavyBackgrounds(page, pager);
  await expect(other.locator("a")).toHaveCSS("color", textPrimary);
  await expect(active.locator("a")).toHaveCSS("color", accentStudio);

  await test.info().attach("inbox page 2", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  await page.getByRole("heading", { name: marker, exact: true }).click();
  await expect(page.locator(".ant-drawer").getByText(markerMessage)).toBeVisible();
});

test("ADM-06 audit log and redirects: the 51st row is on page 2", async ({ page, request }) => {
  const stamp = Date.now().toString(36);
  const prefix = `/e2e-paging-${stamp}`;
  const markerPath = `${prefix}-zz`;
  const token = await tokenFor(request, e2eAdminEmail);
  const headers = { Authorization: `Bearer ${token}` };
  const created: string[] = [];

  async function redirect(fromPath: string) {
    const response = await request.post(`${e2eApiOrigin}/api/v1/redirects`, { headers, data: { fromPath, toPath: "/" } });
    expect(response.status(), `create redirect ${fromPath}`).toBe(201);
    const body = await response.json() as { id: string };
    created.push(body.id);
    return body.id;
  }

  try {
    // The marker first, then 50 newer ones. Each writes a create_redirect audit
    // entry, newest first, so the marker's entry is the 51st.
    const markerId = await redirect(markerPath);
    for (let index = 0; index < 50; index += 1) {
      await redirect(`${prefix}-${String(index).padStart(2, "0")}`);
    }

    await signIn(page);

    // Audit log.
    await openArea(page, "Audit log");
    await expect(page.getByRole("heading", { name: "Audit log", exact: true })).toBeVisible();
    await page.getByPlaceholder("Action").fill("create_redirect");
    const filtered = page.waitForResponse((entry) =>
      /\/api\/v1\/audit\?/.test(entry.url()) && entry.url().includes("action=create_redirect"));
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await filtered;
    const auditRows = page.locator(".ant-table-tbody tr.ant-table-row");
    await expect(auditRows).toHaveCount(50);
    await expect(page.getByRole("cell", { name: markerId, exact: true })).toHaveCount(0);
    const auditPager = page.locator(".ant-table-wrapper");
    await pageTwo(auditPager).click();
    await expect(page.getByRole("cell", { name: markerId, exact: true })).toBeVisible();
    await expectNavyBackgrounds(page, auditPager);
    await test.info().attach("audit log page 2", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

    // Redirects: 51 matches sorted by path, so "-zz" is last.
    await openArea(page, "Redirects");
    await expect(page.getByRole("heading", { name: "Redirects", exact: true })).toBeVisible();
    const searched = page.waitForResponse((entry) =>
      /\/api\/v1\/redirects\?/.test(entry.url()) && entry.url().includes(`search=e2e-paging-${stamp}`));
    await page.getByPlaceholder("Search paths").fill(`e2e-paging-${stamp}`);
    await page.getByPlaceholder("Search paths").press("Enter");
    await searched;
    const redirectRows = page.locator(".ant-table-tbody tr.ant-table-row");
    await expect(redirectRows).toHaveCount(50);
    await expect(page.getByRole("cell", { name: markerPath, exact: true })).toHaveCount(0);
    await pageTwo(page.locator(".ant-table-wrapper")).click();
    await expect(page.getByRole("cell", { name: markerPath, exact: true })).toBeVisible();
    await test.info().attach("redirects page 2", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  } finally {
    // Runs on a pass, a failure, and a failure half-way through seeding. The
    // audit entries stay: the audit log is append-only.
    for (const id of created) {
      await request.delete(`${e2eApiOrigin}/api/v1/redirects/${id}`, { headers });
    }
  }
});
