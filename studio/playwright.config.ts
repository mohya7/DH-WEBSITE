import { defineConfig } from "@playwright/test";
import { e2eApiOrigin, e2eEnv, e2eStudioOrigin, e2eStudioPort } from "./e2e/env";

const env = e2eEnv();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: e2eStudioOrigin,
    trace: "retain-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: [
    {
      command: 'node studio/e2e/start-api.ts',
      url: `${e2eApiOrigin}/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
      cwd: env.repoRoot,
      env: env.apiEnv,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${e2eStudioPort} --strictPort`,
      url: e2eStudioOrigin,
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: env.studioRoot,
      env: env.studioEnv,
    },
  ],
});
