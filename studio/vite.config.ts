import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { parseSiteUrl, siteUrlVariable } from "./src/content/siteUrl";
import { websiteDesign } from "./vite/websiteDesign";

const studioRoot = fileURLToPath(new URL("./", import.meta.url));
const themeRoot = fileURLToPath(new URL("../packages/theme/", import.meta.url));
const blocksRoot = fileURLToPath(new URL("../packages/blocks/src/", import.meta.url));
const websiteDesignSets = fileURLToPath(new URL("../website/src/design/", import.meta.url));

const api = process.env.DH_API_URL ?? "http://127.0.0.1:5088";
const port = Number(process.env.DH_STUDIO_PORT ?? 5173);

export default defineConfig(({ mode }) => {
  /* The website's address is configuration with no default (Phase C, 9.2): refuse
     to start or build without a valid one, instead of shipping a silent fallback. */
  parseSiteUrl(loadEnv(mode, studioRoot, "VITE_")[siteUrlVariable]);

  return {
    plugins: [react(), tailwindcss(), websiteDesign()],
    resolve: {
      alias: [
        { find: "@digitalhub/theme", replacement: themeRoot },
        { find: /^@digitalhub\/blocks$/, replacement: `${blocksRoot}index.ts` },
        { find: /^@digitalhub\/blocks\//, replacement: blocksRoot },
        { find: /^@digitalhub\/website-design\//, replacement: websiteDesignSets },
      ],
      // The blocks live outside studio/: they must use the Studio's single React.
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      fs: {
        // The Studio, the shared packages, and the website's design-set definitions only.
        allow: [studioRoot, fileURLToPath(new URL("../packages/", import.meta.url)), websiteDesignSets],
      },
      proxy: {
        "/api": {
          target: api,
        },
        "/media": {
          target: api,
          bypass(request) {
            const path = request.url?.split("?")[0] ?? "";
            if (path === "/media" || path === "/media/") {
              return "/index.html";
            }
          },
        },
      },
    },
  };
});
