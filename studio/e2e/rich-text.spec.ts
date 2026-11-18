/*
 * ADM-03: images in rich text survive typing, inserting and pasting.
 *
 * Each test makes its own page and its own library image, named with a per-run
 * stamp, so it depends on no other spec file. Both tests collect every request
 * to /api/v1/rich-text/paste: typing and inserting must send none, and a paste
 * that carries an image must send exactly one, holding the pasted content only.
 *
 * An image in the editor is counted, never checked for visibility: the editor
 * renders it without a src, so it may have no box.
 */
import zlib from "node:zlib";
import { expect, test, type APIRequestContext, type Page, type Request } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { addSection, signIn } from "./helpers";

const imageNotice = "This paste included an image. Use the image button so you can add alt text.";

function stampFor() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email: e2eAdminEmail, password: e2ePassword } });
  expect(login.ok(), "sign in for setup").toBeTruthy();
  return { Authorization: `Bearer ${(await login.json() as { accessToken: string }).accessToken}` };
}

/* The media library de-duplicates on the processed image hash (see uniquePng in
   verification.spec.ts), so each upload needs image bytes nothing else has
   used. The same 2 by 2 PNG with random pixels, kept in memory. */
function uniquePngBytes() {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(12);
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = Math.floor(Math.random() * 256);
  const raw = Buffer.concat([
    Buffer.from([0]), pixels.subarray(0, 6),
    Buffer.from([0]), pixels.subarray(6, 12),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function uploadImage(request: APIRequestContext, headers: Record<string, string>, stamp: string, alt: string) {
  const uploaded = await request.post(`${e2eApiOrigin}/api/v1/media`, {
    headers,
    multipart: {
      file: { name: `adm03-${stamp}.png`, mimeType: "image/png", buffer: uniquePngBytes() },
      alt,
    },
  });
  expect(uploaded.ok(), `upload the library image: ${await uploaded.text()}`).toBeTruthy();
  return (await uploaded.json() as { id: string }).id;
}

async function createPage(request: APIRequestContext, headers: Record<string, string>, slug: string, title: string) {
  const created = await request.post(`${e2eApiOrigin}/api/v1/pages`, { headers, data: { slug, title } });
  expect(created.ok(), `create the page: ${await created.text()}`).toBeTruthy();
  return await created.json() as { id: string; version: number };
}

function collectPasteRequests(page: Page) {
  const pastes: Request[] = [];
  page.on("request", (sent) => {
    if (sent.url().includes("/api/v1/rich-text/paste")) pastes.push(sent);
  });
  return pastes;
}

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

test("ADM-03 rich text: typing after a stored image keeps the image and the text", async ({ page, request }) => {
  const stamp = stampFor();
  const alt = `E2E rich text ${stamp}`;
  const heading = `ADM-03 stored ${stamp}`;
  const title = `ADM-03 stored page ${stamp}`;
  const headers = await adminHeaders(request);
  const mediaId = await uploadImage(request, headers, stamp, alt);

  const slug = `adm03-stored-${stamp}`;
  const created = await createPage(request, headers, slug, title);
  const saved = await request.put(`${e2eApiOrigin}/api/v1/pages/${created.id}/save`, {
    headers,
    data: {
      version: created.version,
      slug,
      title,
      fields: {},
      sections: [{
        type: "rich_text",
        visible: true,
        fields: {
          heading,
          body: JSON.stringify({
            type: "doc",
            content: [
              paragraph("Before"),
              { type: "image", attrs: { mediaId, alt, decorative: false } },
              paragraph("After"),
            ],
          }),
        },
      }],
    },
  });
  expect(saved.ok(), `save the stored section: ${await saved.text()}`).toBeTruthy();

  const pastes = collectPasteRequests(page);
  await signIn(page);
  await page.goto(`/pages/${created.id}`);
  await expect(page.locator("[data-field='title'] input")).toHaveValue(title);
  // A loaded item shows its sections closed; "Edit" opens the section's fields.
  await page.locator("article.section-card").getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("[data-field='sections[0].heading'] input")).toHaveValue(heading);
  const body = page.locator("[data-field='sections[0].body'] .ProseMirror");
  const image = body.locator(`img[mediaid="${mediaId}"]`);
  await expect(image).toHaveCount(1);

  await body.getByText("After", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited.");

  // First: typing after an image never calls the paste filter.
  expect(pastes.map((sent) => sent.postData()), "paste requests sent while typing").toEqual([]);
  await expect(body).toContainText("After Edited.");
  await expect(image).toHaveCount(1);

  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.locator("[data-field='title'] input")).toHaveValue(title);
  await page.locator("article.section-card").getByRole("button", { name: "Edit", exact: true }).click();
  await expect(image).toHaveCount(1);
  await expect(body).toContainText("After Edited.");

  const stored = await request.get(`${e2eApiOrigin}/api/v1/pages/${created.id}`, { headers });
  expect(stored.ok(), "read the page back").toBeTruthy();
  const item = await stored.json() as { content: { sections: Array<{ fields: { body: string } }> } };
  const storedBody = item.content.sections[0].fields.body;
  expect(storedBody).toContain(mediaId);
  expect(storedBody).toContain("After Edited.");
  expect(storedBody).not.toContain('"src"');
});

test("ADM-03 rich text: an inserted image stays, and a pasted web image is filtered", async ({ page, request }) => {
  const stamp = stampFor();
  const alt = `E2E rich text ${stamp}`;
  const title = `ADM-03 insert page ${stamp}`;
  const headers = await adminHeaders(request);
  const mediaId = await uploadImage(request, headers, stamp, alt);
  const created = await createPage(request, headers, `adm03-insert-${stamp}`, title);

  const pastes = collectPasteRequests(page);
  await signIn(page);
  await page.goto(`/pages/${created.id}`);
  await expect(page.locator("[data-field='title'] input")).toHaveValue(title);
  await addSection(page, "Rich text");
  await page.locator("[data-field='sections[0].heading'] input").fill(`ADM-03 inserted ${stamp}`);
  const field = page.locator("div.rich-text-editor[data-field='sections[0].body']");
  const body = field.locator(".ProseMirror");
  const image = body.locator(`img[mediaid="${mediaId}"]`);
  await body.click();
  await page.keyboard.type("Intro.");

  await field.getByRole("button", { name: "Image", exact: true }).click();
  const picker = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
  await picker.getByRole("button", { name: alt }).click();
  await expect(picker).toBeHidden();

  // Typed straight after the pick, with no caret move: the Image button leaves
  // the caret after the new image. The focus call stands for keyboard focus
  // being in the editor; it does not move the caret.
  await body.focus();
  await page.keyboard.type("After the image.");

  // First: inserting an image and typing after it never calls the paste filter.
  expect(pastes.map((sent) => sent.postData()), "paste requests sent while inserting and typing").toEqual([]);
  await expect(image).toHaveCount(1);
  await expect(body).toContainText("Intro.");
  await expect(body).toContainText("After the image.");

  await body.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/html", '<p>Pasted line</p><img src="https://cdn.example/x.png" alt="Remote">');
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });

  await expect(body).toContainText("Pasted line");
  await expect(body.locator("img")).toHaveCount(1);
  await expect(image).toHaveCount(1);
  await expect(field.getByText(imageNotice)).toBeVisible();
  expect(pastes, "paste requests after one paste").toHaveLength(1);
  const answer = await pastes[0].response();
  expect(answer?.status(), "the paste filter's answer").toBe(200);
  // The body is JSON whose "document" is itself a JSON string, so it is parsed before it is searched.
  const sent = (pastes[0].postDataJSON() as { document: string }).document;
  expect(sent).not.toContain('"src"');

  // A second paste: the library image picked above, as the editor's own HTML
  // for it. It is kept, and typing straight after it, with no key before,
  // keeps it too: a pasted image is not left selected.
  await body.evaluate((element, html) => {
    const data = new DataTransfer();
    data.setData("text/html", html);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, `<img mediaid="${mediaId}" alt="${alt}" decorative="false">`);
  await expect(image).toHaveCount(2);
  expect(pastes, "paste requests after two pastes").toHaveLength(2);
  await page.keyboard.type("Typed after the paste.");
  await expect(image).toHaveCount(2);
  await expect(body).toContainText("Typed after the paste.");

  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.locator("[data-field='title'] input")).toHaveValue(title);
  await page.locator("article.section-card").getByRole("button", { name: "Edit", exact: true }).click();
  await expect(image).toHaveCount(2);
  await expect(body).toContainText("Intro.");
  await expect(body).toContainText("After the image.");
  await expect(body).toContainText("Pasted line");
});
