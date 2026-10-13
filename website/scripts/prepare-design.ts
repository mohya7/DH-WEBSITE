/*
 * npm run prepare:design — runs before `next build` and `next dev`.
 *
 * Copies website/design/ to public/design/<hash>/, byte for byte, with its
 * layout unchanged. The hash covers every file, so a changed file gives a new
 * folder and the old one is never served stale.
 */
import { publishDesign } from "../src/design/folder";
import fs from "node:fs";
import path from "node:path";
import { behaviorUrl, consentStyleUrl, homeSrStyleUrl } from "../src/design/behaviors";
import type { BuildContent } from "../src/content/build-content";
import { tagManagerId } from "../src/content/tag-manager";

const { hash, files } = publishDesign();
console.log(`Design: ${files} files copied to public/design/${hash}/`);
fs.mkdirSync("public/assets", { recursive: true });
fs.copyFileSync("assets/digital-hub-logo.png", "public/assets/digital-hub-logo.png");
const behaviorDir = path.resolve("public/behaviors");
if (!behaviorDir.startsWith(path.resolve("public") + path.sep)) throw new Error("Invalid behavior output directory");
fs.rmSync(behaviorDir, { recursive: true, force: true });
fs.mkdirSync(behaviorDir, { recursive: true });
const publicFile = (url: string) => path.join("public", url.replace(/^\/+/, ""));
for (const name of ["contact", "careers"] as const) fs.copyFileSync(`behaviors/${name}.js`, publicFile(behaviorUrl(name)));
fs.copyFileSync("behaviors/home-sr.css", publicFile(homeSrStyleUrl()));
// The consent files ship only when the prepared content's site settings name a container.
const content = JSON.parse(fs.readFileSync(path.join(".content", "content.json"), "utf8")) as BuildContent;
if (tagManagerId(content.settings)) {
  fs.copyFileSync("behaviors/consent.js", publicFile(behaviorUrl("consent")));
  fs.copyFileSync("behaviors/consent.css", publicFile(consentStyleUrl()));
  console.log("Consent: banner script and stylesheet copied (a container id is set).");
} else {
  console.log("Consent: no container id, so no consent file is copied.");
}
