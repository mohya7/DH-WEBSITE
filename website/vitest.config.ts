import path from "node:path";
import { defineConfig } from "vitest/config";

const modules = path.resolve(process.cwd(), "node_modules");

export default defineConfig({
  resolve: {
    alias: {
      "@digitalhub/blocks": path.resolve(process.cwd(), "..", "packages", "blocks", "src"),
      "@": path.resolve(process.cwd(), "src"),
      // packages/blocks has no node_modules of its own; it uses the website's React, as in the build.
      react: path.join(modules, "react"),
      "react-dom": path.join(modules, "react-dom"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    env: { PUBLIC_SITE_URL: "https://digitalhub.com.eg" },
  },
});
