import type { NextConfig } from "next";

/*
 * Static export: no Node server in production. Images are not configured on
 * purpose: static export cannot run Next's optimiser, so any use of next/image
 * fails the build instead of shipping unsized images. Pages use the website's
 * own Image adapter (src/adapters/Image.tsx) instead.
 *
 * agentRules: false stops `next dev` writing AGENTS.md and CLAUDE.md into
 * website/ when it detects an AI agent. The project's agent rules are the pair
 * at the repository root. The two names stay in .gitignore as a backstop.
 */
const config: NextConfig = {
  output: "export",
  agentRules: false,
};

export default config;
