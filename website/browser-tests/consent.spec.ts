import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

/*
 * Runs against a build whose site settings name a container:
 *   SNAPSHOT_SETTINGS_FIXTURE=consent CONTENT_SOURCE=snapshot npm run build
 * Tag Manager is never really contacted: every Tag Manager or Google Analytics
 * request is answered here with an empty script and recorded.
 */
const builtWithContainer = fs.readFileSync('out/index.html', 'utf8').includes('id="cookieBanner"');
test.skip(!builtWithContainer, 'needs a build with a container id (SNAPSHOT_SETTINGS_FIXTURE=consent)');

const year = 60 * 60 * 24 * 365;
const name = 'Zelda-Quill-991';
const email = 'zelda.quill.991@example.invalid';
const denied = { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
const grants = {
  accept: { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' },
  analytics: { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
  reject: { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
};
const labels = { accept: 'Accept all', analytics: 'Analytics only', reject: 'Reject all' } as const;
type Kind = keyof typeof labels;

const tagHost = (url: string) => /(^|\.)(googletagmanager\.com|google-analytics\.com|google\.com|doubleclick\.net)$/.test(new URL(url).hostname);

/** The data layer as plain values: gtag() entries (arguments objects) become arrays. */
function dataLayer(page: Page): Promise<unknown[]> {
  return page.evaluate(() => (window.dataLayer ?? []).map((entry) =>
    Object.prototype.toString.call(entry) === '[object Arguments]' ? Array.from(entry as ArrayLike<unknown>) : entry));
}

/** Records every Tag Manager / Google request, and the data layer at the moment gtm.js is requested. */
async function watchTags(page: Page) {
  const seen = { requests: [] as string[], atGtmRequest: [] as unknown[][] };
  await page.route(tagHost, async (route) => {
    const url = route.request().url();
    seen.requests.push(url);
    if (url.includes('/gtm.js')) seen.atGtmRequest.push(await dataLayer(page));
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });
  return seen;
}

function expectLoadOrder(layer: unknown[] | undefined, update: Record<string, string>) {
  expect(layer).toHaveLength(3);
  expect(layer![0]).toEqual(['consent', 'default', denied]);
  expect(layer![1]).toEqual(['consent', 'update', update]);
  expect(layer![2]).toEqual({ 'gtm.start': expect.any(Number), event: 'gtm.js' });
}

async function setCookie(page: Page, baseURL: string | undefined, value: string) {
  await page.context().addCookies([{ name: 'dh_consent', value, url: baseURL! }]);
}

async function choose(page: Page, kind: Kind) {
  await page.getByRole('button', { name: labels[kind] }).click();
  await expect(page.locator('#cookieBanner')).toBeHidden();
}

/** Clicks a link without leaving the page, so the click still bubbles to the document. */
async function clickInPlace(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((link) => {
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    (link as HTMLElement).click();
  });
}

const events = async (page: Page, event: string) => (await dataLayer(page)).filter((entry) => (entry as { event?: string })?.event === event).length;

test('before consent and after Reject all: no Google request, no gtm.js, no event, only the denied defaults', async ({ page }) => {
  const tags = await watchTags(page);
  await page.goto('/');
  await expect(page.locator('#cookieBanner')).toBeVisible();
  expect(tags.requests).toEqual([]);
  expect(await dataLayer(page)).toEqual([['consent', 'default', denied]]);
  await clickInPlace(page, 'a.nav-cta');
  expect(await events(page, 'cta_clicked')).toBe(0);

  await choose(page, 'reject');
  await expectChoice(page, { analytics: false, marketing: false });
  await clickInPlace(page, 'a.nav-cta');
  expect(await dataLayer(page)).toEqual([['consent', 'default', denied]]);
  expect(await page.locator('html').getAttribute('data-analytics')).toBeNull();

  await page.goto('/services/data-analytics');
  await expect(page.locator('#cookieBanner')).toBeHidden();
  expect(await dataLayer(page)).toEqual([['consent', 'default', denied]]);
  expect(tags.requests).toEqual([]);
});

for (const kind of ['accept', 'analytics'] as const) {
  test(`${labels[kind]}: at the gtm.js request the data layer is defaults, update, then the gtm.js event`, async ({ page }) => {
    const tags = await watchTags(page);
    await page.goto('/');
    await choose(page, kind);
    await expect.poll(() => tags.atGtmRequest.length).toBe(1);
    expectLoadOrder(tags.atGtmRequest[0], grants[kind]);
    expect(tags.requests).toEqual(['https://www.googletagmanager.com/gtm.js?id=GTM-TEST1234']);
    await expectChoice(page, { analytics: true, marketing: kind === 'accept' });
  });
}

test('a saved granted choice loads Tag Manager on later visits in the same order, without the banner', async ({ page, baseURL }) => {
  const tags = await watchTags(page);
  await setCookie(page, baseURL, 'v=1&a=1&m=0');
  await page.goto('/about');
  await expect.poll(() => tags.atGtmRequest.length).toBe(1);
  expectLoadOrder(tags.atGtmRequest[0], grants.analytics);
  await expect(page.locator('#cookieBanner')).toBeHidden();
});

test('revoking pushes the update to denied and stops events; later pages do not load Tag Manager', async ({ page }) => {
  const tags = await watchTags(page);
  await page.goto('/');
  await choose(page, 'accept');
  await clickInPlace(page, 'a.nav-cta');
  expect(await events(page, 'cta_clicked')).toBe(1);
  await page.getByRole('link', { name: 'Cookie settings' }).click();
  await choose(page, 'reject');
  const layer = await dataLayer(page);
  expect(layer.at(-1)).toEqual(['consent', 'update', grants.reject]);
  expect(await page.locator('html').getAttribute('data-analytics')).toBeNull();
  await clickInPlace(page, 'a.nav-cta');
  expect(await events(page, 'cta_clicked')).toBe(1);
  expect((await dataLayer(page)).length).toBe(layer.length);
  await page.goto('/contact');
  expect(tags.requests.filter((url) => url.includes('/gtm.js'))).toHaveLength(1);
});

for (const [label, value] of [
  ['a value that does not decode', '%E0%A4%A'],
  ['no version', 'a=1&m=1'],
  ['another version', 'v=2&a=1&m=1'],
  ['a duplicate key', 'v=1&a=1&m=1&a=0'],
  ['an unknown key', 'v=1&a=1&m=1&x=1'],
  ['garbage', 'yes'],
] as const) {
  test(`a cookie with ${label} is no choice: the banner asks again and Cookie settings works`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tags = await watchTags(page);
    await setCookie(page, baseURL, value);
    await page.goto('/');
    await expect(page.locator('#cookieBanner')).toBeVisible();
    expect(tags.requests).toEqual([]);
    await choose(page, 'analytics');
    await expectChoice(page, { analytics: true, marketing: false });
    await page.getByRole('link', { name: 'Cookie settings' }).click();
    await expect(page.locator('#cookieBanner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics only' })).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });
}

test('Cookie settings shows the saved choice pressed and focused, and focus returns to it after a choice', async ({ page }) => {
  await watchTags(page);
  for (const kind of ['reject', 'analytics', 'accept'] as const) {
    await page.context().clearCookies();
    await page.goto('/');
    await choose(page, kind);
    const settings = page.getByRole('link', { name: 'Cookie settings' });
    await settings.click();
    await expect(page.locator('#cookieBanner')).toBeVisible();
    for (const other of ['reject', 'analytics', 'accept'] as const) {
      await expect(page.getByRole('button', { name: labels[other] })).toHaveAttribute('aria-pressed', other === kind ? 'true' : 'false');
    }
    await expect(page.getByRole('button', { name: labels[kind] })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#cookieBanner')).toBeHidden();
    await expect(settings).toBeFocused();
  }
});

for (const [width, height] of [[1280, 800], [768, 1024], [390, 844], [320, 640]] as const) {
  test(`at ${width}px the open banner fits, takes no focus, ignores Escape, and never covers Cookie settings`, async ({ page }) => {
    await watchTags(page);
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/contact']) {
      await page.goto(path);
      const banner = page.locator('#cookieBanner');
      await expect(banner).toBeVisible();
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(banner).toBeVisible();
      const bannerHeight = await banner.evaluate((element) => (element as HTMLElement).offsetHeight);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe(`${bannerHeight}px`);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1)).toBe(true);
      const link = await page.locator('[data-cookie-settings]').boundingBox();
      const box = await banner.boundingBox();
      expect(link && box).toBeTruthy();
      expect(link!.y + link!.height <= box!.y || box!.y + box!.height <= link!.y).toBe(true);
      expect(link!.y).toBeGreaterThanOrEqual(0);
    }
    await choose(page, 'reject');
    // The design's reduced-motion rule gives every element a 0.01ms transition, so the padding settles a frame later.
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe('0px');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });
}

for (const [path, selector] of [
  ['/', 'a.nav-cta'],
  ['/', 'a.mn-cta'],
  ['/cases', '.hub-cta a'],
  ['/services/data-analytics', '.svc-cta-row a'],
  ['/cases/ministry-planning', '.cs-cta a'],
  ['/about', '.about-hero__cta a'],
] as const) {
  test(`cta_clicked fires for ${selector} on ${path} only after consent`, async ({ page, baseURL }) => {
    await watchTags(page);
    await setCookie(page, baseURL, 'v=1&a=0&m=0');
    await page.goto(path);
    expect(await page.locator(selector).count()).toBeGreaterThan(0);
    await clickInPlace(page, selector);
    expect(await events(page, 'cta_clicked')).toBe(0);
    await setCookie(page, baseURL, 'v=1&a=1&m=0');
    await page.goto(path);
    await clickInPlace(page, selector);
    expect(await events(page, 'cta_clicked')).toBe(1);
  });
}

test('after Reject all a contact form submission pushes no event', async ({ page }) => {
  const tags = await watchTags(page);
  await page.route('**/api/v1/public/contact', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/contact');
  await choose(page, 'reject');
  await page.locator('[name="situation"]').selectOption('dx');
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="org"]').fill('Quill Organisation');
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="message"]').fill('Please call Zelda about the private brief.');
  await page.locator('#contactForm button[type="submit"]').click();
  await expect(page.getByRole('status')).toBeVisible();
  expect(await dataLayer(page)).toEqual([['consent', 'default', denied]]);
  expect(tags.requests).toEqual([]);
});

test('a submitted name and email never appear in the data layer', async ({ page }) => {
  await watchTags(page);
  await page.route('**/api/v1/public/contact', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/contact');
  await choose(page, 'accept');
  await page.locator('[name="situation"]').selectOption('dx');
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="org"]').fill('Quill Organisation');
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="message"]').fill('Please call Zelda about the private brief.');
  await page.locator('#contactForm button[type="submit"]').click();
  await expect(page.getByRole('status')).toBeVisible();
  await clickInPlace(page, 'a.nav-cta');
  const dumped = JSON.stringify(await dataLayer(page));
  expect(dumped).toContain('contact_form_submitted');
  expect(dumped).toContain('cta_clicked');
  for (const secret of [name, email, 'Quill Organisation', 'private brief']) expect(dumped).not.toContain(secret);
});

async function expectChoice(page: Page, choice: { analytics: boolean; marketing: boolean }) {
  const cookie = (await page.context().cookies()).find((item) => item.name === 'dh_consent');
  expect(cookie?.value).toBe(`v=1&a=${choice.analytics ? '1' : '0'}&m=${choice.marketing ? '1' : '0'}`);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + year - 120);
  expect(cookie?.expires).toBeLessThan(Date.now() / 1000 + year + 120);
}
