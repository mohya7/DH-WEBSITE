import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pairs } from "./pairs.mjs";
import { absentPages, compareImages, comparePng, entriesFor, guardProblems, readRegister, staleSelectors } from "./diff.mjs";
import { startServer } from "./server.mjs";
import { writeReport } from "./report.mjs";
import { BROWSERS, WIDTHS, captureOne, slug, withBrowser, writeCapture } from "./capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(here, "..", "..");
const defaultOld = "D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main";

/**
 * A port from the environment. Each agent has its own range, so any port from
 * 1024 to 65535 is accepted; the two servers must use different ports.
 */
export function portFromEnv(name, fallback, env = process.env) {
  const raw = env[name] ?? String(fallback);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${name} must be a port from 1024 to 65535. Got "${raw}".`);
  }
  return port;
}

/** SCREENSHOT_BROWSERS: a comma list of chromium, firefox, webkit. Default: all three. */
export function browsersFromEnv(env = process.env) {
  const raw = env.SCREENSHOT_BROWSERS?.trim();
  if (!raw) return [...BROWSERS];
  const names = raw.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  const unknown = names.filter((name) => !BROWSERS.includes(name));
  if (unknown.length > 0 || names.length === 0) {
    throw new Error(`SCREENSHOT_BROWSERS must list ${BROWSERS.join(", ")}. Got "${raw}".`);
  }
  return [...new Set(names)];
}

export async function compareSites(options) {
  const threshold = JSON.parse(fs.readFileSync(path.join(here, "threshold.json"), "utf8"));
  const masks = JSON.parse(fs.readFileSync(path.join(here, "masks.json"), "utf8")).masks;
  const register = readRegister(fs.readFileSync(options.registerFile ?? path.join(here, "accepted-differences.json"), "utf8"));
  const absent = absentPages(fs.readFileSync(path.join(here, "..", "section-compare", "accepted-differences.json"), "utf8"));
  const maskSelectors = options.masks === false ? [] : masks.filter((mask) => mask.effect === "hide").map((mask) => mask.selector);
  const pagePairs = options.pairs ?? pairs.map(([candidate, baseline]) => ({ old: baseline, new: candidate }));
  const widths = options.widths ?? WIDTHS;
  const browsers = options.browsers ?? browsersFromEnv();
  const baselinePort = options.baselinePort ?? portFromEnv("SCREENSHOT_PORT", 4390);
  const candidatePort = options.candidatePort ?? portFromEnv("SCREENSHOT_CANDIDATE_PORT", 4391);
  if (baselinePort === candidatePort) throw new Error("SCREENSHOT_PORT and SCREENSHOT_CANDIDATE_PORT must be different ports.");

  // A browser that was asked for and cannot launch stops the run before any page is served.
  for (const browser of browsers) {
    try {
      await withBrowser(browser, [widths[0]], async () => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not launch ${browser}, which SCREENSHOT_BROWSERS asks for.\n${message}`);
    }
  }

  const baselineServer = await startServer({ root: options.baselineRoot, port: baselinePort });
  const candidateServer = await startServer({ root: options.candidateRoot, port: candidatePort, overlay: options.candidateOverlay ?? null });

  const results = [];
  try {
    for (const browser of browsers) {
      await withBrowser(browser, widths, async ({ page, width }) => {
        for (const pair of pagePairs) {
          process.stdout.write(`${browser} ${width} ${pair.old} … `);
          const capture = { old: pair.old, new: pair.new, width, browser, status: "pending", differentPixels: null, sizeMismatch: false, problems: [], notes: [], scores: [], files: null, register: [] };
          try {
            await compareOne(page, capture, { baselinePort, candidatePort, maskSelectors, register, absent, options, threshold });
          } catch (error) {
            capture.status = "error";
            capture.problems.push(error instanceof Error ? error.message : String(error));
          }
          console.log(capture.status === "match" || capture.status === "absent-accepted" ? capture.status : `${capture.status} (${capture.differentPixels ?? (capture.sizeMismatch ? "size" : "-")}${capture.problems.length ? `; ${capture.problems.length} problem(s)` : ""})`);
          results.push(capture);
        }
      });
    }
  } finally {
    await close(baselineServer);
    await close(candidateServer);
  }

  const reportPath = writeReport(options.outDir, { results, threshold, masks, register });
  const failed = results.filter((result) => !["match", "absent-accepted"].includes(result.status)).length;
  return { results, failed, reportPath };
}

async function compareOne(page, capture, { baselinePort, candidatePort, maskSelectors, register, absent, options, threshold }) {
  const entries = entriesFor(register, capture);
  capture.register = entries.map((entry) => entry.id);
  const guardSelectors = entries.flatMap((entry) => entry.selectors);
  const hideSelectors = [...maskSelectors, ...guardSelectors];
  const flattenImages = options.flattenImages !== false;

  const before = await captureOne(page, `http://127.0.0.1:${baselinePort}${capture.old}`, { hideSelectors, guardSelectors, flattenImages });
  if (!before.png) throw new Error(`The old page ${capture.old} answered ${before.status}.`);
  const after = await captureOne(page, `http://127.0.0.1:${candidatePort}${capture.new}`, { hideSelectors, guardSelectors, flattenImages, paint: options.paintCandidate === true });
  if (!after.png) {
    if (after.status === 404 && absent.has(capture.old)) {
      capture.status = "absent-accepted";
      capture.notes.push("Absent from the new site; the section register accepts it (absent-page).");
      return;
    }
    throw new Error(`The new page ${capture.new} answered ${after.status}${after.status === 404 ? ", and the section register does not list it as absent" : ""}.`);
  }

  capture.notes.push(...before.notes.map((note) => `old: ${note}`), ...after.notes.map((note) => `new: ${note}`));
  capture.problems.push(...staleSelectors(entries, before.hidden, after.hidden));
  capture.problems.push(...guardProblems(entries, before.guard, `old ${capture.old}`), ...guardProblems(entries, after.guard, `new ${capture.new}`));
  if (!before.stable) capture.problems.push(`the old page never gave two identical captures in ${before.attempts} attempts`);
  if (!after.stable) capture.problems.push(`the new page never gave two identical captures in ${after.attempts} attempts`);

  const images = compareImages(before.images, after.images);
  capture.problems.push(...images.problems);
  capture.scores = images.scores;

  const diff = comparePng(before.png, after.png, { pixelmatchThreshold: threshold.pixelmatchThreshold });
  capture.differentPixels = diff.differentPixels;
  capture.sizeMismatch = diff.sizeMismatch;
  capture.imageWidth = diff.width;
  capture.imageHeight = diff.height;
  capture.otherWidth = diff.otherWidth;
  capture.otherHeight = diff.otherHeight;

  const pixelsOk = !diff.sizeMismatch && diff.differentPixels <= threshold.maxDifferentPixels;
  const unstable = !before.stable || !after.stable;
  capture.status = capture.problems.some((problem) => problem.startsWith("register entry")) ? "error"
    : unstable ? "unstable"
    : pixelsOk && capture.problems.length === 0 ? "match"
    : "differs";

  if (capture.status !== "match") {
    const stem = `${capture.browser}-${capture.width}-${slug(capture.old)}`;
    const dir = path.join(options.outDir, "captures");
    capture.files = {
      old: `captures/${writeCapture(dir, `${stem}-old.png`, before.png)}`,
      new: `captures/${writeCapture(dir, `${stem}-new.png`, after.png)}`,
    };
    if (diff.diff) capture.files.diff = `captures/${writeCapture(dir, `${stem}-diff.png`, diff.diff)}`;
  }
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
  const outDir = process.env.SCREENSHOT_OUT ?? path.join(here, "output");
  compareSites({ baselineRoot: oldRoot, candidateRoot: newRoot, outDir }).then((outcome) => {
    console.log(`Report: ${outcome.reportPath}`);
    if (outcome.failed > 0) process.exitCode = 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
