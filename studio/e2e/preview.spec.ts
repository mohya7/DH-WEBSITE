/*
 * Phase C, 9.1: the draft preview renders the website's section components with the
 * website's stylesheets inside an iframe, and no style crosses between the Studio and
 * the preview in either direction.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { e2eAdminEmail, e2eApiOrigin, e2ePassword } from "./env";
import { signIn } from "./helpers";

const stamp = Date.now();
const blueLight = "rgb(54, 176, 229)"; // --blue-light, #36B0E5, in website/design/css

async function draftPageWithHero(request: APIRequestContext, heading: string) {
  const login = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, { data: { email: e2eAdminEmail, password: e2ePassword } });
  expect(login.ok(), "sign in for setup").toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json() as { accessToken: string }).accessToken}` };
  const slug = `preview-frame-${stamp}-${Math.random().toString(36).slice(2, 7)}`;
  const created = await request.post(`${e2eApiOrigin}/api/v1/pages`, { headers, data: { slug, title: "Preview frame" } });
  expect(created.ok(), "create the draft page").toBeTruthy();
  const page = await created.json() as { id: string; version: number };
  const saved = await request.put(`${e2eApiOrigin}/api/v1/pages/${page.id}/save`, {
    headers,
    data: {
      version: page.version,
      slug,
      title: "Preview frame",
      fields: {},
      sections: [{ type: "hub_hero", visible: true, fields: { eyebrow: "Draft", heading, lead: "Rendered by the website's own components." } }],
    },
  });
  expect(saved.ok(), `save the draft sections: ${await saved.text()}`).toBeTruthy();
  return page.id;
}

test("9.1 the draft preview renders the website's section in an iframe, with no style crossing either way", async ({ page, request }) => {
  const heading = `Draft preview ${stamp}`;
  const id = await draftPageWithHero(request, heading);
  await signIn(page);
  await page.goto(`/pages/${id}`);
  await expect(page.locator("[data-field='title'] input")).toHaveValue("Preview frame");
  const studioFont = await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily);

  await page.getByRole("button", { name: "Preview draft" }).click();
  const iframe = page.locator('iframe[title="Website preview"]');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("sandbox", "allow-same-origin allow-popups allow-popups-to-escape-sandbox");
  const frame = page.frameLocator('iframe[title="Website preview"]');

  // The draft's section, rendered by packages/blocks: the hub hero's markup and text.
  const hero = frame.locator("main[data-preview] > section.hub-hero");
  await expect(hero).toHaveCount(1);
  await expect(hero.locator("h1")).toHaveText(heading);
  await expect(hero.locator(".label")).toHaveText("Draft");

  // The website's styling applies inside the frame, from the website's own design files.
  const banner = frame.locator(".hub-banner");
  const accent = frame.locator(".hub-banner h1 em");
  await expect(banner).toHaveCSS("text-align", "center");
  await expect(accent).toHaveCSS("color", blueLight);
  await expect(banner).toHaveCSS("opacity", "1");
  const sheets = await frame.locator("link[rel=stylesheet]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(sheets.some((href) => /\/website-design\/[0-9a-f]{16}\/css\/hub-pages\.css$/.test(href)), sheets.join("\n")).toBe(true);
  const hubSheet = sheets.find((href) => href.endsWith("/css/hub-pages.css"))!;
  const served = await request.get(hubSheet);
  expect(served.ok()).toBeTruthy();
  expect(served.headers()["content-type"]).toContain("text/css");

  // Website → Studio: none of the website's stylesheets is on the Studio page, and an
  // element with the website's class names takes none of its rules there.
  await expect(page.locator('link[href*="/website-design/"]')).toHaveCount(0);
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.id = "website-style-probe";
    probe.className = "hub-banner";
    probe.innerHTML = "<h1>Probe <em>accent</em></h1>";
    document.body.appendChild(probe);
  });
  await expect(page.locator("#website-style-probe")).not.toHaveCSS("text-align", "center");
  await expect(page.locator("#website-style-probe em")).not.toHaveCSS("color", blueLight);
  await expect(page.locator("body")).toHaveCSS("font-family", studioFont);

  // Studio → preview: a style set on the Studio page does not reach inside the frame.
  await page.addStyleTag({ content: ".hub-banner { text-align: right !important; } .hub-banner h1 em { color: rgb(255, 0, 0) !important; } main { outline: 9px solid rgb(255, 0, 0) !important; }" });
  await expect(page.locator("#website-style-probe")).toHaveCSS("text-align", "right");
  await expect(banner).toHaveCSS("text-align", "center");
  await expect(accent).toHaveCSS("color", blueLight);
  await expect(frame.locator("main")).not.toHaveCSS("outline-color", "rgb(255, 0, 0)");

  // Nothing runs in the frame: the sandbox allows no scripts.
  expect(await frame.locator("script").count()).toBe(0);
});

test("9.1 the preview shows unsaved edits from the editor", async ({ page, request }) => {
  const id = await draftPageWithHero(request, `Saved heading ${stamp}`);
  await signIn(page);
  await page.goto(`/pages/${id}`);
  const article = page.locator("article").filter({ has: page.locator("strong", { hasText: "Hub hero" }) });
  await article.getByRole("button", { name: "Edit" }).click();
  await article.getByRole("textbox", { name: "Heading *" }).fill(`Unsaved heading ${stamp}`);
  await page.getByRole("button", { name: "Preview draft" }).click();
  await expect(page.frameLocator('iframe[title="Website preview"]').locator(".hub-hero h1")).toHaveText(`Unsaved heading ${stamp}`);
});
