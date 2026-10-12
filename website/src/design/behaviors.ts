import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { websiteRoot } from "../content/config";

export function behaviorUrl(name: "contact" | "careers"): string {
  const bytes = fs.readFileSync(path.join(websiteRoot, "behaviors", `${name}.js`));
  return `/behaviors/${name}.${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.js`;
}
