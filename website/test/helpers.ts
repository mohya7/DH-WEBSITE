import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BuildContent } from "../src/content/build-content";
import { snapshotDir } from "../src/content/config";

export const snapshotRaw = fs.readFileSync(path.join(snapshotDir, "content.json"), "utf8");

/** A fresh, mutable copy of the snapshot content for each test. */
export function snapshotContent(): BuildContent {
  return JSON.parse(snapshotRaw) as BuildContent;
}

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `dh-website-${prefix}-`));
}
