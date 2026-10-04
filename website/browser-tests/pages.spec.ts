import { test, expect, type Page } from '@playwright/test';

test('the skipped home intro moves the logo and its classes persist after load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('.nav-inner .brand .brand-logo')).toHaveCount(1);
  await expect(page.locator('#navIntro')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass(/nav-shown/);
  for (const name of ['nav-ready', 'loaded', 'intro-grid-reveal']) await expect(page.locator('body')).toHaveClass(new RegExp(name));
  await expect(page.locator('script[src^="/_next/"]')).toHaveCount(0);
  expect(await page.locator('.brand-logo').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('the fallback logo is served and the service navigation script runs', async ({ page, request }) => {
  const response = await request.get('/assets/digital-hub-logo.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/services/ai-automation');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#navBurger').click();
  await expect(page.locator('#mobileNav')).toHaveClass(/open/);
  await expect(page.locator('#navBurger')).toHaveAttribute('aria-expanded', 'true');
  expect(errors).toEqual([]);
});

async function contact(page: Page) {
  await page.goto('/contact');
  await page.locator('[name="situation"]').selectOption('dx');
  await page.locator('[name="name"]').fill('Browser Test');
  await page.locator('[name="org"]').fill('Example');
  await page.locator('[name="email"]').fill('test@example.invalid');
  await page.locator('[name="message"]').fill('Testing the static form.');
}
test('contact validates, posts once to the relative API, and renders configured messages', async ({ page }) => {
  const payloads: Record<string, string>[] = [];
  await page.route('**/api/v1/public/contact', async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ status: payloads.length === 1 ? 400 : 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/contact');
  await page.locator('#submitBtn').click();
  expect(payloads).toHaveLength(0);
  await contact(page);
  await expect(page.locator('#submitText')).toHaveText('Book a transformation workshop');
  await page.locator('#submitBtn').click();
  await expect(page.locator('#contactFormError')).toHaveText('Could not send your message. Please try again.');
  await page.locator('#submitBtn').click();
  await expect(page.locator('#submitText')).toHaveText("Thank you — we'll respond within one business day");
  expect(payloads).toHaveLength(2);
  expect(payloads[1]).toMatchObject({ situation: 'dx', name: 'Browser Test', org: 'Example', email: 'test@example.invalid', website: '' });
});

async function application(page: Page) {
  await page.goto('/careers/apply?role=not-published');
  await page.locator('[name="fullName"]').fill('Browser Test');
  await page.locator('[name="phone"]').fill('+201000000000');
  await page.locator('[name="email"]').fill('test@example.invalid');
  await page.locator('[name="currentSalary"]').fill('15');
  await page.locator('[name="yearsOfExperience"]').selectOption('3-5');
  await page.locator('[name="expectedSalary"]').fill('25');
  await page.locator('[name="noticePeriodWeeks"]').fill('2');
  await page.locator('[name="linkedin"]').fill('https://linkedin.com/in/example');
}
test('careers checks file limits, submits multipart to configuration, and safely resets after success', async ({ page }) => {
  let submissions = 0;
  let body = '';
  await page.route('**/api/careers/applications', async (route) => {
    submissions++;
    body = route.request().postDataBuffer()!.toString();
    expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reference: '<img src=x onerror=alert(1)>' }) });
  });
  await application(page);
  const upload = page.locator('[name="resume"]');
  await upload.setInputFiles({ name: 'cv.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.careers-apply-form__error')).toHaveText('CV must be a PDF, DOC, or DOCX file.');
  await upload.setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.careers-apply-form__error')).toHaveText('CV must be 5 MB or smaller.');
  expect(submissions).toBe(0);
  await upload.setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\ntest') });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.careers-apply-form--success')).toContainText('Application received');
  await expect(page.locator('.careers-apply-form__reference')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.careers-apply-form--success img')).toHaveCount(0);
  expect(submissions).toBe(1);
  expect(body).toContain('name="expectedSalaryRange"\r\n\r\n25');
  expect(body).toContain('name="noticePeriod"\r\n\r\n2');
  expect(body).not.toContain('not-published');
  await page.locator('[data-careers-apply-reset]').click();
  await expect(page.locator('form.careers-apply-form')).toBeVisible();
  await expect(page.locator('[name="fullName"]')).toHaveValue('');
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
});
