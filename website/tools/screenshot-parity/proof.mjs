/**
 * Proves the comparison itself. Section 5 is not merged, so this does not
 * judge the new site. It compares the old site with itself, then a copy of
 * one stylesheet with one colour changed, then a painted hero canvas.
 *
 * The old site folder is only read. The stylesheet copy is written under the
 * system temp directory.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pairs } from "./pairs.mjs";
import { WIDTHS } from "./capture.mjs";
import { browsersFromEnv, compareSites, portFromEnv } from "./compare.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const oldRoot = process.env.SCREENSHOT_OLD_ROOT ?? "D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main";
const stylesheet = path.join(oldRoot, "css", "about-page.css");
const fromColour = "#C9DCEF";
const toColour = "#FF4D6A";

const selfPairs = pairs.map(([, oldPath]) => ({ old: oldPath, new: oldPath }));
const aboutPair = { old: "/about-us.html", new: "/about-us.html" };
const homePair = { old: "/index.html", new: "/index.html" };

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function stylesheetCopy() {
  const source = fs.readFileSync(stylesheet, "utf8");
  if (!source.includes(fromColour)) throw new Error(`${stylesheet} no longer contains ${fromColour}.`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dh-screenshot-parity-"));
  const file = path.join(dir, "about-page.css");
  const next = source.replace(fromColour, toColour);
  if (next === source || next.includes(fromColour)) throw new Error("The colour was not changed in the copy.");
  fs.writeFileSync(file, next);
  return file;
}

async function main() {
  const before = hashFile(stylesheet);
  const baselinePort = portFromEnv("SCREENSHOT_PORT", 4390);
  const candidatePort = portFromEnv("SCREENSHOT_CANDIDATE_PORT", 4391);
  const output = process.env.SCREENSHOT_OUT ?? path.join(here, "output");
  // SCREENSHOT_BROWSERS chooses the browsers; one that is asked for and cannot launch stops the proof.
  const ready = browsersFromEnv();
  console.log(`Browsers: ${ready.join(", ")}`);

  console.log("\n1. Old against old");
  const same = await compareSites({
    baselineRoot: oldRoot,
    candidateRoot: oldRoot,
    pairs: selfPairs,
    widths: WIDTHS,
    browsers: ready,
    baselinePort,
    candidatePort,
    outDir: path.join(output, "old-against-old"),
    masks: true,
  });
  if (same.failed !== 0) throw new Error(`Old against old had ${same.failed} failure(s). ${same.reportPath}`);

  console.log("\n2. One colour changed in a copy of about-page.css");
  const copy = stylesheetCopy();
  const colour = await compareSites({
    baselineRoot: oldRoot,
    candidateRoot: oldRoot,
    pairs: [aboutPair, homePair],
    widths: WIDTHS,
    browsers: ready,
    baselinePort,
    candidatePort,
    outDir: path.join(output, "colour-change"),
    masks: true,
    candidateOverlay: { urlPath: "/css/about-page.css", file: copy },
  });
  const aboutDiffers = colour.results.filter((result) => result.old === aboutPair.old && result.status === "differs");
  const homeOk = colour.results.filter((result) => result.old === homePair.old && result.status === "match");
  if (aboutDiffers.length !== WIDTHS.length * ready.length) {
    throw new Error(`The colour change should fail on every about-page capture. Failed ${aboutDiffers.length}. ${colour.reportPath}`);
  }
  if (homeOk.length !== WIDTHS.length * ready.length) {
    throw new Error(`The home page does not use that stylesheet and should still match. ${colour.reportPath}`);
  }
  if (!aboutDiffers.every((result) => result.files && result.files.diff)) {
    throw new Error("The colour-change report is missing a difference image.");
  }

  console.log("\n3. A masked canvas painted on one side");
  const masked = await compareSites({
    baselineRoot: oldRoot,
    candidateRoot: oldRoot,
    pairs: [homePair],
    widths: WIDTHS,
    browsers: ready,
    baselinePort,
    candidatePort,
    outDir: path.join(output, "masked-canvas"),
    masks: true,
    paintCandidate: true,
  });
  if (masked.failed !== 0) throw new Error(`Painting the masked canvases should not fail. ${masked.reportPath}`);

  console.log("\n4. The same paint with masks turned off");
  const open = await compareSites({
    baselineRoot: oldRoot,
    candidateRoot: oldRoot,
    pairs: [homePair],
    widths: [1440],
    browsers: ["chromium"],
    baselinePort,
    candidatePort,
    outDir: path.join(output, "unmasked-canvas"),
    masks: false,
    paintCandidate: true,
  });
  if (open.failed !== 1) throw new Error(`Painting the canvas without the mask should fail. ${open.reportPath}`);

  const after = hashFile(stylesheet);
  if (before !== after) throw new Error("The old site stylesheet was modified. The proof must only change a copy.");

  console.log("\nProof passed.");
  console.log(`Old against old: ${same.reportPath}`);
  console.log(`Colour change: ${colour.reportPath}`);
  console.log(`Masked canvas: ${masked.reportPath}`);
  console.log(`Unmasked canvas: ${open.reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
