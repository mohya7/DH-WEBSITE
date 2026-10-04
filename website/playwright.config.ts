import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4177', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL, reducedMotion: 'reduce' },
  webServer: { command: 'node tools/serve-built.mjs', url: 'http://127.0.0.1:4177', reuseExistingServer: false },
});
