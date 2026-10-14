import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Image boxes may differ by less than this many CSS pixels (sub-pixel rounding only). */
export const BOX_TOLERANCE = 0.5;
/** Intrinsic aspect ratios may differ by this fraction (re-encoded widths round their height). */
export const ASPECT_TOLERANCE = 0.01;

/**
 * Compare two PNG buffers. Every pixel counts: pixelmatch's threshold is 0 and
 * anti-aliased pixels are included. Rectangles in `ignoreRects` are painted the
 * same flat colour on both sides first.
 */
export function comparePng(leftBuffer, rightBuffer, { pixelmatchThreshold = 0, ignoreRects = [] } = {}) {
  const left = PNG.sync.read(leftBuffer);
  const right = PNG.sync.read(rightBuffer);
  if (left.width !== right.width || left.height !== right.height) {
    return { differentPixels: null, sizeMismatch: true, width: left.width, height: left.height, otherWidth: right.width, otherHeight: right.height, diff: null };
  }

  paintIgnored(left, ignoreRects);
  paintIgnored(right, ignoreRects);

  const diff = new PNG({ width: left.width, height: left.height });
  const differentPixels = pixelmatch(left.data, right.data, diff.data, left.width, left.height, {
    threshold: pixelmatchThreshold,
    includeAA: true,
    diffColor: [255, 0, 0],
  });
  return { differentPixels, sizeMismatch: false, width: left.width, height: left.height, diff: PNG.sync.write(diff) };
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
 * Similarity of two equal-size RGBA thumbnails: 1 minus the mean per-channel
 * difference (red, green, blue) over 255. 1 is identical. null when either side
 * could not be read.
 */
export function imageSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let total = 0;
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      total += Math.abs(a[i + c] - b[i + c]);
      count++;
    }
  }
  return 1 - total / count / 255;
}

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/**
 * The images on the two sides, paired in document order. A missing, moved,
 * resized, or reshaped image is a problem. The pixels are not compared (they
 * are flattened before capture); the similarity score is reported instead.
 */
export function compareImages(oldImages, newImages) {
  const problems = [];
  const scores = [];
  const count = Math.max(oldImages.length, newImages.length);
  for (let i = 0; i < count; i++) {
    const before = oldImages[i];
    const after = newImages[i];
    if (!before || !after) {
      const only = before ?? after;
      problems.push(`image ${i + 1} (${only.element}, ${only.src}) is ${before ? "missing from the new page" : "only on the new page"}`);
      continue;
    }
    const a = before.box;
    const b = after.box;
    const moved = !near(a.x, b.x, BOX_TOLERANCE) || !near(a.y, b.y, BOX_TOLERANCE);
    const resized = !near(a.width, b.width, BOX_TOLERANCE) || !near(a.height, b.height, BOX_TOLERANCE);
    if (moved || resized) {
      problems.push(`image ${i + 1} (${after.element}) box ${fmtBox(a)} is ${fmtBox(b)} on the new page`);
    }
    if (before.aspect && after.aspect && !sameShape(before.aspect, after)) {
      problems.push(`image ${i + 1} (${after.element}) aspect ratio ${before.aspect.toFixed(3)} is ${after.aspect.toFixed(3)} on the new page`);
    } else if (!before.aspect !== !after.aspect) {
      problems.push(`image ${i + 1} (${after.element}) loaded on only one side`);
    }
    scores.push({ index: i + 1, element: after.element, oldSrc: before.src, newSrc: after.src, similarity: imageSimilarity(before.thumb, after.thumb) });
  }
  return { problems, scores };
}

/**
 * The same intrinsic shape: within ASPECT_TOLERANCE, or off only by the rounding of one dimension when the
 * media pipeline scaled the file (a 718×206 logo stored at 184×52, where 52.8 was rounded down).
 */
export function sameShape(oldAspect, after) {
  if (Math.abs(oldAspect / after.aspect - 1) <= ASPECT_TOLERANCE) return true;
  const size = after.natural;
  if (!size || !size.width || !size.height) return false;
  return Math.abs(size.width / oldAspect - size.height) <= 1 || Math.abs(size.height * oldAspect - size.width) <= 1;
}

function fmtBox(box) {
  return `${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`;
}

/** Elements that hold a whole page or a whole region: an entry may never hide one. */
const CONTAINER_TAGS = new Set(["html", "body", "main", "header", "footer", "nav"]);
const CONTAINER_CLASSES = new Set(["footer"]);
const CONTAINER_IDS = new Set(["__next"]);

/**
 * Why one register selector could hide a whole capture or region, or null when
 * it is narrow enough. The rule: one selector (no comma list) that either has a
 * descendant or child combinator or narrows by an attribute or a structural
 * pseudo-class (:nth-child, :first-child, ...), and whose last compound, the
 * element actually hidden, is not html, body, main, header, footer, nav,
 * .footer, #__next, :root, or a bare *.
 */
export function wholeCaptureReason(selector) {
  // Blank out [...] and (...) contents so their characters are not read as structure.
  let flat = "";
  let depth = 0;
  for (const ch of selector.trim()) {
    if (ch === "[" || ch === "(") { if (depth === 0) flat += ch; depth++; continue; }
    if (ch === "]" || ch === ")") { depth--; if (depth === 0) flat += ch; continue; }
    flat += depth > 0 ? "" : ch;
  }
  if (flat.includes(",")) return "it is a selector list; give each selector separately";
  const compounds = flat.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const last = compounds[compounds.length - 1] ?? "";
  const narrowed = compounds.length > 1 || /\[|:(nth-child|nth-last-child|nth-of-type|nth-last-of-type|first-child|last-child|first-of-type|last-of-type|only-child)\b/.test(flat);
  if (!narrowed) return "it has no descendant or child part, no attribute, and no :nth-child or :first-child part";
  const tag = /^([a-zA-Z][\w-]*|\*)/.exec(last)?.[1]?.toLowerCase();
  if (tag && CONTAINER_TAGS.has(tag)) return `the element it hides is <${tag}>, a whole-page or whole-region container`;
  const cls = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).find((name) => CONTAINER_CLASSES.has(name));
  if (cls) return `the element it hides is .${cls}, a whole-region container`;
  const id = [...last.matchAll(/#([\w-]+)/g)].map((m) => m[1]).find((name) => CONTAINER_IDS.has(name));
  if (id) return `the element it hides is #${id}, a whole-page container`;
  if (/:root\b/.test(last)) return "the element it hides is :root, the whole page";
  if (last === "*") return "the element it hides is *, any element";
  return null;
}

/**
 * The screenshot register. Each entry hides one or more selectors on both
 * sides, for the page pairs, widths, and browsers it names. Everything else on
 * those pages is still compared with zero tolerance. An entry cannot accept a
 * whole capture: it must name at least one selector, and each selector must
 * pass wholeCaptureReason.
 */
export function readRegister(raw, browsers = ["chromium", "firefox", "webkit"]) {
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.differences)) throw new Error("accepted-differences.json needs a differences array.");
  const ids = new Set();
  for (const entry of parsed.differences) {
    const where = `accepted-differences.json entry ${JSON.stringify(entry.id ?? "(no id)")}`;
    if (typeof entry.id !== "string" || !entry.id.trim()) throw new Error(`${where} needs an id.`);
    if (ids.has(entry.id)) throw new Error(`${where} is listed twice.`);
    ids.add(entry.id);
    if (!Array.isArray(entry.pairs) || entry.pairs.length === 0 || !entry.pairs.every((pair) => typeof pair?.old === "string" && typeof pair?.new === "string")) {
      throw new Error(`${where} needs pairs: [{ "old": ..., "new": ... }].`);
    }
    if (!Array.isArray(entry.widths) || entry.widths.length === 0 || !entry.widths.every(Number.isInteger)) throw new Error(`${where} needs widths.`);
    if (!Array.isArray(entry.browsers) || entry.browsers.length === 0 || !entry.browsers.every((name) => browsers.includes(name))) {
      throw new Error(`${where} needs browsers from ${browsers.join(", ")}.`);
    }
    if (!Array.isArray(entry.selectors) || entry.selectors.length === 0 || !entry.selectors.every((s) => typeof s === "string" && s.trim())) {
      throw new Error(`${where} needs at least one selector. A whole capture cannot be accepted.`);
    }
    for (const selector of entry.selectors) {
      const why = wholeCaptureReason(selector);
      if (why) throw new Error(`${where}: selector ${JSON.stringify(selector)} is refused because ${why}. A whole capture or region cannot be accepted.`);
    }
    if (typeof entry.reason !== "string" || !entry.reason.trim()) throw new Error(`${where} needs a reason.`);
  }
  return parsed;
}

/** The register entries that apply to one capture. */
export function entriesFor(register, capture) {
  return register.differences.filter((entry) =>
    entry.pairs.some((pair) => pair.old === capture.old && pair.new === capture.new) &&
    entry.widths.includes(capture.width) &&
    entry.browsers.includes(capture.browser));
}

/** Entry selectors that hid nothing on either side: stale entries are errors. */
export function staleSelectors(entries, oldHidden, newHidden) {
  const stale = [];
  for (const entry of entries) {
    for (const selector of entry.selectors) {
      const a = oldHidden?.[selector] ?? 0;
      const b = newHidden?.[selector] ?? 0;
      if (a === -1 || b === -1) stale.push(`register entry ${entry.id}: "${selector}" is not a valid selector`);
      else if (a === 0 && b === 0) stale.push(`register entry ${entry.id}: "${selector}" hides nothing on either side`);
    }
  }
  return stale;
}

/** Old page paths the section register accepts as absent from the new site (kind "absent-page"). */
export function absentPages(sectionRegisterRaw) {
  const entries = JSON.parse(sectionRegisterRaw);
  return new Set(entries.filter((entry) => entry.kind === "absent-page").flatMap((entry) => entry.pages));
}
