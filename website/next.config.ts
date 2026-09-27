import type { NextConfig } from "next";

/*
 * Static export: no Node server in production. Images are not configured on
 * purpose: static export cannot run Next's optimiser, so any use of next/image
 * fails the build instead of shipping unsized images. Pages use the website's
 * own Image adapter (src/adapters/Image.tsx) instead.
 */
const config: NextConfig = {
  output: "export",
};

export default config;
