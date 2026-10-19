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
/** The only elements a register selector may end on: small text and inline elements. */
export const HIDEABLE_TAGS = Object.freeze(["a", "span", "p", "li", "small", "strong", "em", "b", "i", "time", "label", "button", "img", "svg", "h1", "h2", "h3", "h4", "h5", "h6"]);
const STRUCTURAL = new Set(["nth-child", "nth-last-child", "nth-of-type", "nth-last-of-type"]);

/**
 * Why one register selector is refused before any page is loaded, or null.
 * This is the second line; the runtime guard (guardProblems) is the guarantee.
 * The rule: no comma, no backslash (CSS escape), no * outside [...], no
 * functional pseudo-class except :nth-child(An+B) and its relatives (no "of");
 * the selector starts with an element name and its last compound, the element
 * it hides, starts with one of HIDEABLE_TAGS; and it is narrowed by a
 * combinator, an attribute, or a structural pseudo-class.
 */
export function wholeCaptureReason(selector) {
  if (selector.includes(",")) return "it contains a comma (a selector list); give each selector separately";
  if (selector.includes("\\")) return "it contains a backslash (a CSS escape)";
  // Blank out [...] contents (attribute values may hold any character).
  let flat = "";
  let depth = 0;
  for (const ch of selector.trim()) {
    if (ch === "[") { if (depth === 0) flat += ch; depth++; continue; }
    if (ch === "]") { depth--; if (depth === 0) flat += ch; continue; }
    flat += depth > 0 ? "" : ch;
  }
  if (flat.includes("*")) return "it contains *, which matches any element";
  for (const call of flat.matchAll(/:([\w-]+)\(([^)]*)\)?/g)) {
    const name = call[1].toLowerCase();
    if (!STRUCTURAL.has(name)) return `it contains the functional pseudo-class :${name}(), which can match any element`;
    if (/\bof\b/i.test(call[2] ?? "")) return `it contains :${name}(... of ...), which can match any element`;
  }
  const compounds = flat.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const first = compounds[0] ?? "";
  const last = compounds[compounds.length - 1] ?? "";
  if (!/^[a-zA-Z]/.test(first)) return "it must start with an element name, such as footer or main";
  const tag = /^([a-zA-Z][\w-]*)/.exec(last)?.[1]?.toLowerCase();
  if (!tag) return `the element it hides is not named; the last part must start with one of ${HIDEABLE_TAGS.join(", ")}`;
  if (CONTAINER_TAGS.has(tag)) return `the element it hides is <${tag}>, a whole-page or whole-region container`;
  if (!HIDEABLE_TAGS.includes(tag)) return `the element it hides is <${tag}>; only ${HIDEABLE_TAGS.join(", ")} can be hidden`;
  const narrowed = compounds.length > 1 || /\[|:(nth-child|nth-last-child|nth-of-type|nth-last-of-type|first-child|last-child|first-of-type|last-of-type|only-child)\b/.test(flat);
  if (!narrowed) return "it has no descendant or child part, no attribute, and no :nth-child or :first-child part";
  return null;
}

/*
 * The runtime guard: what an entry's selectors actually hide, measured in the
 * browser on both sides of every capture (installGuard in capture.mjs): the same
 * nodes that are hidden, measured before hiding and again after capturing, by
 * the extent they paint (element, descendants, and text), not only their own
 * box. Any breach makes the capture an error. The limits are constants on
 * purpose: the register file cannot change them. These geometry checks are the
 * cheap second line; the guarantee is the measured removal (removedProblems).
 */
/** An element with more descendant elements than this is a region, not a link or a text span. */
export const GUARD_MAX_DESCENDANTS = 6;
/** Widest painted extent a hidden element may have, in CSS px. */
export const GUARD_MAX_WIDTH = 800;
/** Tallest painted extent a hidden element may have, in CSS px. */
export const GUARD_MAX_HEIGHT = 120;
/** Largest share of the full page area one hidden element may cover. */
export const GUARD_MAX_ELEMENT_SHARE = 0.02;
/**
 * Largest share of the full page area one entry may hide in total. Measured worst
 * approved case: footer-company-column-links, 6.98% on the old /get-in-touch.html
 * at 390 px (five links of 376x44 px on a short page).
 */
export const GUARD_MAX_ENTRY_SHARE = 0.08;
/** Most elements one entry may match on one page (the largest approved entry matches 5, on the old pages). */
export const GUARD_MAX_MATCHES = 12;
/**
 * Largest share of the full page area all entries together may hide on one page
 * load: the union of the painted extents, so overlapping entries are not counted
 * twice. Measured worst approved case: 10.14% on the old /get-in-touch.html at
 * 390 px (all four entries on that page together); 15% leaves headroom above it.
 */
export const GUARD_MAX_TOTAL_SHARE = 0.15;
/** Most entries the register may hold (five are approved), so it cannot be padded without a visible code change. */
export const MAX_REGISTER_ENTRIES = 10;

const px = (value) => Math.round(value * 10) / 10;
const pct = (value) => `${(value * 100).toFixed(2)}%`;

/**
 * Runtime guard breaches for one side of a capture. `measured` is what the
 * in-page guard returned there (hideAndMeasure or remeasure); `where` names the
 * side and page. An invalid selector (null) is left to staleSelectors.
 */
export function guardProblems(entries, measured, where) {
  const problems = [];
  if (!measured) return problems;
  const pageArea = Math.max(1, measured.page.width * measured.page.height);
  if (measured.removed > 0) problems.push(`register entry guard on ${where}: ${measured.removed} hidden element(s) left the page after hiding, so the capture is not stable`);
  const painted = [];
  for (const entry of entries) {
    let count = 0;
    let area = 0;
    for (const selector of entry.selectors) {
      const elements = measured.matches[selector];
      if (!elements) continue;
      count += elements.length;
      for (const el of elements) {
        const box = el.width * el.height;
        area += box;
        if (box > 0) painted.push(el);
        const what = `register entry ${entry.id}: "${selector}" on ${where} matches <${el.tag}> ${px(el.width)}x${px(el.height)} px`;
        const reasons = [];
        if (el.tag === "html" || el.tag === "body") reasons.push(`it is <${el.tag}>`);
        if (el.landmark) reasons.push("it is or contains a main, header, nav, or footer element");
        if (el.boxless) reasons.push(`it has no box of its own (${el.boxless}), so its size does not bound what it hides`);
        if (el.descendants > GUARD_MAX_DESCENDANTS) reasons.push(`it has ${el.descendants} descendant elements (limit ${GUARD_MAX_DESCENDANTS})`);
        if (el.width > GUARD_MAX_WIDTH) reasons.push(`it is ${px(el.width)} px wide (limit ${GUARD_MAX_WIDTH})`);
        if (el.height > GUARD_MAX_HEIGHT) reasons.push(`it is ${px(el.height)} px tall (limit ${GUARD_MAX_HEIGHT})`);
        if (box / pageArea > GUARD_MAX_ELEMENT_SHARE) reasons.push(`it covers ${pct(box / pageArea)} of the page (limit ${pct(GUARD_MAX_ELEMENT_SHARE)})`);
        if (reasons.length > 0) problems.push(`${what}, refused by the runtime guard: ${reasons.join("; ")}`);
      }
    }
    if (count > GUARD_MAX_MATCHES) problems.push(`register entry ${entry.id} on ${where} matches ${count} elements, refused by the runtime guard (limit ${GUARD_MAX_MATCHES})`);
    if (area / pageArea > GUARD_MAX_ENTRY_SHARE) problems.push(`register entry ${entry.id} on ${where} hides ${pct(area / pageArea)} of the page, refused by the runtime guard (limit ${pct(GUARD_MAX_ENTRY_SHARE)})`);
  }
  const total = unionArea(painted) / pageArea;
  if (total > GUARD_MAX_TOTAL_SHARE) problems.push(`register entry total on ${where}: the entries together hide ${pct(total)} of the page, refused by the runtime guard (limit ${pct(GUARD_MAX_TOTAL_SHARE)})`);
  return problems;
}

/**
 * The guarantee: what the register removed, measured as pixels (measure.mjs). The
 * masked capture against the same load with the register shown; per entry when
 * needed. The geometry checks above are cheap early refusals; these decide.
 * `removed` is undefined when no entry applies.
 */
export function removedProblems(entries, removed, where) {
  if (!removed) return [];
  if (!removed.stable) return [`register entry guard on ${where}: the page never gave two identical captures with the register shown, so the pixels it removes cannot be measured`];
  if (removed.sizeChanged) return [`register entry guard on ${where}: hiding the register changed the size of the page`];
  const problems = [];
  if (removed.total.share > GUARD_MAX_TOTAL_SHARE) {
    problems.push(`register entry total on ${where}: hiding the entries removes ${pct(removed.total.share)} of the page's pixels (${removed.total.pixels.toLocaleString("en-US")} px, measured), refused by the guard (limit ${pct(GUARD_MAX_TOTAL_SHARE)})`);
  }
  for (const entry of removed.entries ?? []) {
    if (entry.share > GUARD_MAX_ENTRY_SHARE) {
      problems.push(`register entry ${entry.id} on ${where}: hiding it removes ${pct(entry.share)} of the page's pixels (${entry.pixels.toLocaleString("en-US")} px, measured), refused by the guard (limit ${pct(GUARD_MAX_ENTRY_SHARE)})`);
    }
  }
  return problems;
}

/** The measured shares, for the report's notes, so a reviewer sees them on every capture. */
export function removedNote(removed, side) {
  if (!removed || !removed.stable || removed.sizeChanged) return null;
  const entries = removed.entriesMeasured
    ? "; " + removed.entries.map((entry) => `${entry.id} ${pct(entry.share)}`).join(", ")
    : "; each entry at most the total";
  return `${side}: the register removes ${pct(removed.total.share)} of the page (${removed.total.pixels.toLocaleString("en-US")} px, measured)${entries}`;
}

/** The area covered by a set of boxes ({ x, y, width, height }), each point counted once. */
export function unionArea(boxes) {
  const xs = [...new Set(boxes.flatMap((b) => [b.x, b.x + b.width]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const left = xs[i];
    const right = xs[i + 1];
    const spans = boxes
      .filter((b) => b.x <= left && b.x + b.width >= right)
      .map((b) => [b.y, b.y + b.height])
      .sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let end = -Infinity;
    for (const [top, bottom] of spans) {
      if (bottom <= end) continue;
      covered += bottom - Math.max(top, end);
      end = bottom;
    }
    area += covered * (right - left);
  }
  return area;
}

/**
 * The screenshot register. Each entry hides one or more selectors on both
 * sides, for the page pairs, widths, and browsers it names. Everything else on
 * those pages is still compared with zero tolerance. An entry cannot accept a
 * whole capture: it must name at least one selector, and each selector must
 * pass wholeCaptureReason. guardProblems checks what they match at capture time.
 */
export function readRegister(raw, browsers = ["chromium", "firefox", "webkit"]) {
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.differences)) throw new Error("accepted-differences.json needs a differences array.");
  if (parsed.differences.length > MAX_REGISTER_ENTRIES) throw new Error(`accepted-differences.json has ${parsed.differences.length} entries; at most ${MAX_REGISTER_ENTRIES} are allowed. Raising the limit is a code change.`);
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
