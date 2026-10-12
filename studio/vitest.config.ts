/*
 * Unit tests run without vite.config.ts: that file refuses to start without
 * VITE_PUBLIC_SITE_URL, and the tests set (or clear) it themselves.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
  },
});
