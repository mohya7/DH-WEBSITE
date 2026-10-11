import { defineConfig } from '@playwright/test';
const baseURL = `http://127.0.0.1:${process.env.WEBSITE_TEST_PORT ?? 4177}`;

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  use: { baseURL, browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL, contextOptions: { reducedMotion: 'reduce' } },
  webServer: { command: 'node tools/serve-built.mjs', url: baseURL, reuseExistingServer: false },
});
