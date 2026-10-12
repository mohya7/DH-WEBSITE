import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { websiteRoot } from "../content/config";

export function behaviorUrl(name: "contact" | "careers" | "consent"): string {
  const bytes = fs.readFileSync(path.join(websiteRoot, "behaviors", `${name}.js`));
  return `/behaviors/${name}.${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.js`;
}

export function consentStyleUrl(): string {
  const bytes = fs.readFileSync(path.join(websiteRoot, "behaviors", "consent.css"));
  return `/behaviors/consent.${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.css`;
}
