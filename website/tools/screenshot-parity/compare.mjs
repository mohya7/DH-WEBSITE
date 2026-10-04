import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pairs } from "./pairs.mjs";
import { comparePng, judge, readRegister } from "./diff.mjs";
import { startServer } from "./server.mjs";
import { writeReport } from "./report.mjs";
import { BROWSERS, WIDTHS, capturePair, slug, withBrowser, writeCapture } from "./capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(here, "..", "..");
const defaultOld = "D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main";

export function portFromEnv(name, fallback) {
  const raw = process.env[name] ?? String(fallback);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 4300 || port > 4399) {
    throw new Error(`${name} must be a port in 4300–4399. Got "${raw}".`);
  }
  return port;
}

export async function compareSites(options) {
  const threshold = JSON.parse(fs.readFileSync(path.join(here, "threshold.json"), "utf8"));
  const masks = JSON.parse(fs.readFileSync(path.join(here, "masks.json"), "utf8")).masks;
  const register = readRegister(fs.readFileSync(path.join(here, "accepted-differences.json"), "utf8"));
  const hideSelectors = options.masks === false ? [] : masks.filter((mask) => mask.effect === "hide").map((mask) => mask.selector);
  const pagePairs = options.pairs ?? pairs.map(([candidate, baseline]) => ({ old: baseline, new: candidate }));
  const widths = options.widths ?? WIDTHS;
  const browsers = options.browsers ?? BROWSERS;
  const baselinePort = options.baselinePort ?? portFromEnv("SCREENSHOT_PORT", 4390);
  const candidatePort = options.candidatePort ?? portFromEnv("SCREENSHOT_CANDIDATE_PORT", 4391);
  if (baselinePort === candidatePort) throw new Error("The two screenshot servers need different ports.");

  const baselineServer = await startServer({ root: options.baselineRoot, port: baselinePort });
  const candidateServer = await startServer({
    root: options.candidateRoot,
    port: candidatePort,
    overlay: options.candidateOverlay ?? null,
  });

  const results = [];
  try {
    for (const browser of browsers) {
      await withBrowser(browser, widths, async ({ page, width }) => {
        for (const pair of pagePairs) {
          const label = `${browser} ${width} ${pair.old}`;
          process.stdout.write(`${label} … `);
          const capture = {
            old: pair.old,
            new: pair.new,
            width,
            browser,
            differentPixels: null,
            sizeMismatch: false,
            status: "pending",
            error: null,
            files: null,
          };
          try {
            const shots = await capturePair(page, {
              baselineUrl: `http://127.0.0.1:${baselinePort}${pair.old}`,
              candidateUrl: `http://127.0.0.1:${candidatePort}${pair.new}`,
              paintCandidate: options.paintCandidate === true,
              hideSelectors,
            });
            const diff = comparePng(shots.baseline, shots.candidate, {
              pixelmatchThreshold: threshold.pixelmatchThreshold,
            });
            capture.differentPixels = diff.differentPixels;
            capture.sizeMismatch = diff.sizeMismatch;
            capture.imageWidth = diff.width;
            capture.imageHeight = diff.height;
            capture.otherWidth = diff.otherWidth;
            capture.otherHeight = diff.otherHeight;
            capture.status = judge(capture, register, threshold.maxDifferentPixels);
            if (capture.status === "differs") {
              const stem = `${browser}-${width}-${slug(pair.old)}`;
              const dir = path.join(options.outDir, "captures");
              capture.files = {
                old: `captures/${writeCapture(dir, `${stem}-old.png`, shots.baseline)}`,
                new: `captures/${writeCapture(dir, `${stem}-new.png`, shots.candidate)}`,
              };
              if (diff.diff) capture.files.diff = `captures/${writeCapture(dir, `${stem}-diff.png`, diff.diff)}`;
            }
            console.log(capture.status === "match" ? "match" : `${capture.status} (${capture.differentPixels ?? "size"})`);
          } catch (error) {
            capture.status = "error";
            capture.error = error instanceof Error ? error.message : String(error);
            console.log(`error: ${capture.error}`);
          }
          results.push(capture);
        }
      });
    }
  } finally {
    await close(baselineServer);
    await close(candidateServer);
  }

  const reportPath = writeReport(options.outDir, { results, threshold, masks });
  const failed = results.filter((result) => result.status === "differs" || result.status === "error").length;
  return { results, failed, reportPath };
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const oldRoot = process.env.SCREENSHOT_OLD_ROOT ?? defaultOld;
  const newRoot = process.env.SCREENSHOT_NEW_ROOT ?? path.join(websiteRoot, "out");
  const outDir = path.join(here, "output");
  compareSites({ baselineRoot: oldRoot, candidateRoot: newRoot, outDir }).then((outcome) => {
    console.log(`Report: ${outcome.reportPath}`);
    if (outcome.failed > 0) process.exitCode = 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
