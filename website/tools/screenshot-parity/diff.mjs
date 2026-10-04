import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/**
 * Compare two PNG buffers. Rectangles in `ignoreRects` are painted the same
 * flat colour on both sides first, so a change inside one does not count.
 * Rectangles are CSS pixels, which match the screenshot because captures use
 * scale: "css".
 */
export function comparePng(leftBuffer, rightBuffer, { pixelmatchThreshold, ignoreRects = [] }) {
  const left = PNG.sync.read(leftBuffer);
  const right = PNG.sync.read(rightBuffer);
  if (left.width !== right.width || left.height !== right.height) {
    return {
      differentPixels: null,
      sizeMismatch: true,
      width: left.width,
      height: left.height,
      otherWidth: right.width,
      otherHeight: right.height,
      diff: null,
    };
  }

  paintIgnored(left, ignoreRects);
  paintIgnored(right, ignoreRects);

  const diff = new PNG({ width: left.width, height: left.height });
  const differentPixels = pixelmatch(left.data, right.data, diff.data, left.width, left.height, {
    threshold: pixelmatchThreshold,
    includeAA: false,
    diffColor: [255, 0, 0],
  });

  return {
    differentPixels,
    sizeMismatch: false,
    width: left.width,
    height: left.height,
    diff: PNG.sync.write(diff),
  };
}

function paintIgnored(png, rects) {
  for (const rect of rects) {
    const x0 = clamp(Math.floor(rect.x), 0, png.width);
    const y0 = clamp(Math.floor(rect.y), 0, png.height);
    const x1 = clamp(Math.ceil(rect.x + rect.width), 0, png.width);
    const y1 = clamp(Math.ceil(rect.y + rect.height), 0, png.height);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (png.width * y + x) << 2;
        png.data[i] = 128;
        png.data[i + 1] = 128;
        png.data[i + 2] = 128;
        png.data[i + 3] = 255;
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A capture matches when the pixel count is within the threshold.
 * Anything else fails unless the register lists that page, width, and browser
 * with a reason.
 */
export function judge(capture, register, maxDifferentPixels) {
  if (capture.status === "error") return "error";
  const within = !capture.sizeMismatch && capture.differentPixels <= maxDifferentPixels;
  if (within) return "match";
  const listed = register.differences.some((entry) =>
    entry.old === capture.old &&
    entry.new === capture.new &&
    entry.width === capture.width &&
    entry.browser === capture.browser &&
    typeof entry.reason === "string" &&
    entry.reason.trim() !== "");
  return listed ? "accepted" : "differs";
}

export function readRegister(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.differences)) {
    throw new Error("accepted-differences.json needs a differences array.");
  }
  for (const entry of parsed.differences) {
    if (!entry.old || !entry.new || !entry.width || !entry.browser || !String(entry.reason ?? "").trim()) {
      throw new Error("Every accepted difference needs old, new, width, browser, and a reason.");
    }
  }
  return parsed;
}
