import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.WEBSITE_CONSENT !== '1', 'needs a build with ANALYTICS_CONTAINER_ID');

const year = 60 * 60 * 24 * 365;
const name = 'Zelda-Quill-991';
const email = 'zelda.quill.991@example.invalid';

async function signals(page: Page) {
  return page.evaluate(() => (window.dataLayer ?? []).flatMap((entry) => {
    const values = typeof entry === 'object' && entry && 'callee' in entry ? Array.from(entry as ArrayLike<unknown>) : [entry];
    return values[0] === 'consent' ? [values] : [];
  }));
}

test('consent defaults to denied before Tag Manager loads', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('googletagmanager.com/gtm.js')) requested.push(request.url());
  });
  await page.goto('/');
  expect(requested.some((url) => url.includes('id=GTM-'))).toBe(true);
  const first = await signals(page);
  expect(first[0]?.[1]).toBe('default');
  expect(first[0]?.[2]).toMatchObject({
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
});

test('accept all, reject all, and analytics only update consent and the cookie', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept all' }).click();
  await expectChoice(page, { analytics: true, marketing: true });
  await page.getByRole('link', { name: 'Cookie settings' }).click();
  await page.getByRole('button', { name: 'Reject all' }).click();
  await expectChoice(page, { analytics: false, marketing: false });
  await page.getByRole('link', { name: 'Cookie settings' }).click();
  await page.getByRole('button', { name: 'Analytics only' }).click();
  await expectChoice(page, { analytics: true, marketing: false });
});

test('the choice survives reload and Cookie settings reopens the banner', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject all' }).click();
  await page.reload();
  await expect(page.locator('#cookieBanner')).toBeHidden();
  const settings = page.getByRole('link', { name: 'Cookie settings' });
  await settings.click();
  await expect(page.locator('#cookieBanner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject all' })).toBeFocused();
});

test('the banner is keyboard only and fits a 320px wide viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.locator('#cookieBanner')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(overflow).toBe(true);
  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Analytics only' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Accept all' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Analytics only' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cookieBanner')).toBeHidden();
  await expectChoice(page, { analytics: true, marketing: false });
});

test('a submitted name and email never appear in the data layer', async ({ page }) => {
  await page.route('**/api/v1/public/contact', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Reject all' }).click();
  await page.locator('[name="situation"]').selectOption('dx');
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="org"]').fill('Quill Organisation');
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="message"]').fill('Please call Zelda about the private brief.');
  await page.locator('#contactForm button[type="submit"]').click();
  await expect(page.getByRole('status')).toBeVisible();
  const dumped = await page.evaluate(() => JSON.stringify(window.dataLayer ?? []));
  expect(dumped).toContain('contact_form_submitted');
  expect(dumped).not.toContain(name);
  expect(dumped).not.toContain(email);
  expect(dumped).not.toContain('Quill Organisation');
  expect(dumped).not.toContain('private brief');
  await page.locator('a.nav-cta').evaluate((link) => link.addEventListener('click', (event) => event.preventDefault(), true));
  await page.locator('a.nav-cta').click();
  const afterCta = await page.evaluate(() => JSON.stringify(window.dataLayer ?? []));
  expect(afterCta).toContain('cta_clicked');
  expect(afterCta).not.toContain(name);
  expect(afterCta).not.toContain(email);
});

async function expectChoice(page: Page, choice: { analytics: boolean; marketing: boolean }) {
  const cookie = (await page.context().cookies()).find((item) => item.name === 'dh_consent');
  expect(cookie?.value).toBe(`a=${choice.analytics ? '1' : '0'}&m=${choice.marketing ? '1' : '0'}`);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + year - 120);
  expect(cookie?.expires).toBeLessThan(Date.now() / 1000 + year + 120);
  const updates = await signals(page);
  const last = updates.at(-1)?.[2] as Record<string, string>;
  expect(last.analytics_storage).toBe(choice.analytics ? 'granted' : 'denied');
  expect(last.ad_storage).toBe(choice.marketing ? 'granted' : 'denied');
  expect(last.ad_user_data).toBe(choice.marketing ? 'granted' : 'denied');
  expect(last.ad_personalization).toBe(choice.marketing ? 'granted' : 'denied');
}
