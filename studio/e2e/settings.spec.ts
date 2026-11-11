/*
 * ADM-10: saving Site settings cleared the default share image. The form never sent
 * the field, and the API copied the missing value over the stored one as null. There
 * was also no control to set it.
 *
 * The test uploads two images of its own, drawn in the browser with different colours
 * and a corner pixel from the run stamp, because the library de-duplicates on the
 * processed image hash and a shared fixture would come back as another spec's row. It
 * restores the settings it read and deletes only the images it created, in finally.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { openArea, signIn } from "./helpers";

type Settings = Record<string, unknown> & { version: number; defaultShareImageId: string | null };

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email: e2eAdminEmail, password: e2ePassword } });
  expect(login.ok(), "sign in for setup").toBeTruthy();
  return { Authorization: `Bearer ${(await login.json() as { accessToken: string }).accessToken}` };
}

async function readSettings(request: APIRequestContext, headers: Record<string, string>): Promise<Settings> {
  const read = await request.get(`${e2eApiOrigin}/api/v1/settings`, { headers });
  expect(read.ok(), `read the settings: ${await read.text()}`).toBeTruthy();
  return await read.json() as Settings;
}

/** A 16 by 16 PNG of one colour, with its top-left pixel set from the run stamp. */
async function drawPng(page: Page, fill: string, stampPixel: [number, number, number]): Promise<Buffer> {
  const dataUrl = await page.evaluate(({ fill, stampPixel }) => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d")!;
    context.fillStyle = fill;
    context.fillRect(0, 0, 16, 16);
    context.fillStyle = `rgb(${stampPixel[0]}, ${stampPixel[1]}, ${stampPixel[2]})`;
    context.fillRect(0, 0, 1, 1);
    return canvas.toDataURL("image/png");
  }, { fill, stampPixel });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function pickImage(page: Page, button: "Choose image" | "Change image", alt: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Choose an image" });
  await expect(dialog).toBeVisible();
  const box = dialog.getByPlaceholder("Search alt text, caption, or file name");
  const searched = page.waitForResponse((entry) => /\/api\/v1\/media\?/.test(entry.url()) && entry.url().includes(`search=${encodeURIComponent(alt)}`));
  await box.fill(alt);
  await box.press("Enter");
  await searched;
  await dialog.locator(".media-tile").filter({ hasText: alt }).click();
  await expect(dialog).toBeHidden();
}

async function save(page: Page) {
  const saved = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/settings") && entry.request().method() === "PUT");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const response = await saved;
  expect(response.ok(), `save the settings: ${await response.text()}`).toBeTruthy();
  await expect(page.locator(".ant-message").getByText("Settings saved.", { exact: true }).last()).toBeVisible();
}

async function reloadSettings(page: Page) {
  const loaded = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/settings") && entry.request().method() === "GET");
  await page.reload();
  await loaded;
  await expect(page.getByRole("heading", { name: "Site settings" })).toBeVisible();
}

test("ADM-10 settings: the default share image survives a save, and can be changed and cleared", async ({ page, request }) => {
  const stamp = `adm10-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const headers = await adminHeaders(request);
  const kept = await readSettings(request, headers);
  const created: string[] = [];

  try {
    // Two images nothing else has: far-apart colours, and a corner pixel from the stamp.
    const seed = [...stamp].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 16_777_216, 7);
    const stampPixel: [number, number, number] = [(seed >> 16) & 255, (seed >> 8) & 255, seed & 255];
    const images: Array<{ id: string; path: string; alt: string }> = [];
    for (const [suffix, fill] of [["a", "rgb(220, 30, 40)"], ["b", "rgb(20, 60, 210)"]] as const) {
      const alt = `${stamp}-${suffix}`;
      const uploaded = await request.post(`${e2eApiOrigin}/api/v1/media`, {
        headers,
        multipart: {
          file: { name: `${alt}.png`, mimeType: "image/png", buffer: await drawPng(page, fill, stampPixel) },
          alt,
          decorative: "false",
        },
      });
      expect(uploaded.ok(), `upload image ${suffix}: ${await uploaded.text()}`).toBeTruthy();
      const body = await uploaded.json() as { id: string; path: string; duplicate: boolean };
      expect(body.duplicate, `image ${suffix} is new, not another row`).toBe(false);
      created.push(body.id);
      images.push({ id: body.id, path: body.path, alt });
    }
    const [imageA, imageB] = images;
    expect(imageA.id).not.toBe(imageB.id);

    await signIn(page);
    await openArea(page, "Site settings");
    await expect(page.getByRole("heading", { name: "Site settings" })).toBeVisible();

    // 1. Choose image -a and save. After a reload, the form shows it.
    await pickImage(page, kept.defaultShareImageId === null ? "Choose image" : "Change image", imageA.alt);
    await save(page);
    await reloadSettings(page);
    await expect(page.getByText(imageA.path, { exact: true })).toBeVisible();
    expect((await readSettings(request, headers)).defaultShareImageId).toBe(imageA.id);

    // 2. A save that changes only the email keeps the image (the finding).
    await page.getByLabel("Email", { exact: true }).fill(`${stamp}@digitalhub.test`);
    await save(page);
    await reloadSettings(page);
    await expect(page.getByText(imageA.path, { exact: true })).toBeVisible();
    const afterEmail = await readSettings(request, headers);
    expect(afterEmail.email).toBe(`${stamp}@digitalhub.test`);
    expect(afterEmail.defaultShareImageId).toBe(imageA.id);

    // 3. Change to image -b.
    await pickImage(page, "Change image", imageB.alt);
    await save(page);
    expect((await readSettings(request, headers)).defaultShareImageId).toBe(imageB.id);

    // 4. Clear.
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await save(page);
    expect((await readSettings(request, headers)).defaultShareImageId).toBeNull();
  } finally {
    // Restore every key read at the start, at the current version, so the original
    // share image comes back and this test's images are released.
    const current = await request.get(`${e2eApiOrigin}/api/v1/settings`, { headers });
    if (current.ok()) {
      const { version } = await current.json() as { version: number };
      await request.put(`${e2eApiOrigin}/api/v1/settings`, { headers, data: { ...kept, version } });
    }
    for (const id of created) {
      await request.delete(`${e2eApiOrigin}/api/v1/media/${id}`, { headers });
    }
  }
});
