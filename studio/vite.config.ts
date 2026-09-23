import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const themeRoot = fileURLToPath(new URL("../packages/theme/", import.meta.url));

const api = process.env.DH_API_URL ?? "http://127.0.0.1:5088";
const port = Number(process.env.DH_STUDIO_PORT ?? 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@digitalhub/theme": themeRoot,
    },
  },
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
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
});
