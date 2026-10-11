import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { designFileList, designHash } from "../../website/src/design/folder";
import { designBase, designDifferences, designSource } from "../vite/websiteDesign";

/* The preview's stylesheets come from website/design/ only (Phase C, 9.1). */
describe("preview design files", () => {
  const copyOfSource = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dh-preview-design-"));
    for (const name of designFileList(designSource)) {
      const to = path.join(dir, ...name.split("/"));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(designSource, ...name.split("/")), to);
    }
    return dir;
  };

  it("are served under the website's own design hash", () => {
    expect(designBase()).toBe(`/website-design/${designHash(designSource)}/`);
    expect(designFileList(designSource)).toContain("css/hub-pages.css");
  });

  it("pass when a copy is byte for byte the source", () => {
    expect(designDifferences(copyOfSource())).toEqual([]);
  });

  it("fail on one changed byte, a missing file, or an extra file", () => {
    const changed = copyOfSource();
    fs.appendFileSync(path.join(changed, "css", "hub-pages.css"), " ");
    expect(designDifferences(changed)).toEqual(["differs: css/hub-pages.css"]);

    const missing = copyOfSource();
    fs.rmSync(path.join(missing, "css", "tv.css"));
    expect(designDifferences(missing)).toEqual(["missing: css/tv.css"]);

    const extra = copyOfSource();
    fs.writeFileSync(path.join(extra, "css", "studio.css"), "body{}");
    expect(designDifferences(extra)).toEqual(["extra: css/studio.css"]);
  });
});
