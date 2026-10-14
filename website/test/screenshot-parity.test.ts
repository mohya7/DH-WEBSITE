import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { pairs as shared } from "../tools/page-pairs.mjs";
import { pairs } from "../tools/screenshot-parity/pairs.mjs";
import { absentPages, compareImages, comparePng, entriesFor, imageSimilarity, readRegister, sameShape, staleSelectors, wholeCaptureReason } from "../tools/screenshot-parity/diff.mjs";
import { browsersFromEnv, portFromEnv } from "../tools/screenshot-parity/compare.mjs";
import { fileFor } from "../tools/screenshot-parity/server.mjs";
import { worstImages } from "../tools/screenshot-parity/report.mjs";

const tool = path.join(process.cwd(), "tools", "screenshot-parity");
const sectionTool = path.join(process.cwd(), "tools", "section-compare");

function image(width: number, height: number, pixel: (x: number, y: number) => number[]) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const [r, g, b, a] = pixel(x, y);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const img = (b: ReturnType<typeof box>, aspect = 1.5, thumb: number[] | null = null) => ({ kind: "img", element: "img.card", src: "/a.webp", box: b, aspect, thumb });

describe("screenshot parity: page pairs", () => {
  it("uses the one shared list, which compare.html imports and does not repeat", () => {
    expect(pairs).toBe(shared);
    expect(shared).toHaveLength(26);
    const html = fs.readFileSync(path.join(sectionTool, "compare.html"), "utf8");
    expect(html).toContain('import { pairs } from "/page-pairs.mjs";');
    // No pair defined inline, in any quoting or spacing.
    expect(html).not.toMatch(/\bconst\s+pairs\b/);
    expect(html).not.toMatch(/\[\s*["'`]\/[^"'`]*["'`]\s*,\s*["'`]\/[^"'`]*["'`]\s*\]/);
    const server = fs.readFileSync(path.join(sectionTool, "server.mjs"), "utf8");
    expect(server).toContain('url === "/page-pairs.mjs"');
  });
});

describe("screenshot parity: masks and threshold", () => {
  it("lists every mask with a reason, and does not mask the static carousels or marquees", () => {
    const file = JSON.parse(fs.readFileSync(path.join(tool, "masks.json"), "utf8"));
    expect(file.masks.length).toBeGreaterThan(0);
    for (const mask of file.masks) {
      expect(mask.selector).toMatch(/^#hero(Fluid|Sand)Canvas$/);
      expect(mask.effect).toBe("hide");
      expect(mask.reason.length).toBeGreaterThan(40);
    }
    const leftIn = file.reviewedNotMasked.map((entry: { selector: string }) => entry.selector);
    expect(leftIn).toEqual(expect.arrayContaining(["#newsViewport", "#blogsViewport", ".trust-track", ".marquee-track"]));
  });

  it("allows zero differing pixels and counts anti-aliased pixels too", () => {
    const threshold = JSON.parse(fs.readFileSync(path.join(tool, "threshold.json"), "utf8"));
    expect(threshold.maxDifferentPixels).toBe(0);
    expect(threshold.pixelmatchThreshold).toBe(0);
    expect(threshold.explanation).toMatch(/includeAA true/);
    // A soft edge: the middle column is a blend of its neighbours, the shape pixelmatch treats as anti-aliasing.
    const edge = (mid: number) => image(5, 5, (x) => (x < 2 ? [0, 0, 0, 255] : x === 2 ? [mid, mid, mid, 255] : [255, 255, 255, 255]));
    expect(comparePng(edge(128), edge(100)).differentPixels).toBe(5);
  });
});

describe("screenshot parity: register", () => {
  const entry = {
    id: "footer-company-column",
    pairs: [{ old: "/index.html", new: "/" }],
    widths: [1440, 768, 390],
    browsers: ["chromium", "firefox"],
    selectors: [".footer-col:nth-child(3)"],
    reason: "Decided.",
  };
  const raw = (differences: unknown[]) => JSON.stringify({ differences });

  // The approved entries, pinned: a changed selector or a widened pair list turns this red.
  const approved = [
    { id: "footer-company-column-links", pairs: 24, selectors: ["footer.footer .footer-cols > .footer-col:nth-child(2) a"] },
    { id: "footer-main-email", pairs: 18, selectors: ["footer.footer .footer-contact a[href^=\"mailto:\"]"] },
    { id: "footer-copyright-build-year", pairs: 24, selectors: ["footer.footer .footer-bottom > span:first-child"] },
    { id: "article-footer-service-labels", pairs: 3, selectors: ["footer.footer .footer-cols > .footer-col:nth-child(1) a"] },
    { id: "contact-section-email", pairs: 1, selectors: ["main a[href^=\"mailto:sales@\"]"] },
  ];

  it("holds only the entries the marketing lead approved, each complete", () => {
    const { differences } = readRegister(fs.readFileSync(path.join(tool, "accepted-differences.json"), "utf8"));
    expect(differences.map((d) => d.id)).toEqual(approved.map((a) => a.id));
    for (const [i, d] of differences.entries()) {
      expect(d.selectors).toEqual(approved[i].selectors);
      expect(d.pairs).toHaveLength(approved[i].pairs);
      expect(d.widths).toEqual([1440, 768, 390]);
      expect(d.browsers).toEqual(["chromium", "firefox", "webkit"]);
      expect(d.reason).toMatch(/^Marketing lead decision/);
    }
  });

  it("accepts the five approved selectors", () => {
    for (const selector of approved.flatMap((a) => a.selectors)) expect(wholeCaptureReason(selector)).toBeNull();
    expect(() => readRegister(raw(approved.map((a) => ({ ...entry, id: a.id, selectors: a.selectors }))))).not.toThrow();
  });

  const refused = (selector: string) => () => readRegister(raw([{ ...entry, selectors: [selector] }]));
  const bare = /no descendant or child part, no attribute, and no :nth-child or :first-child part/;

  it("refuses body", () => {
    expect(refused("body")).toThrow(/selector "body" is refused because it has no descendant or child part/);
    expect(refused("html > body")).toThrow(/selector "html > body" is refused because the element it hides is <body>, a whole-page or whole-region container/);
  });

  it("refuses html", () => {
    expect(refused("html")).toThrow(bare);
    expect(refused("html:first-child")).toThrow(/the element it hides is <html>/);
  });

  it("refuses :root", () => {
    expect(refused(":root")).toThrow(bare);
    expect(refused("html:root[lang]")).toThrow(/the element it hides is <html>/);
    expect(refused("[lang]:root")).toThrow(/the element it hides is :root, the whole page/);
  });

  it("refuses *", () => {
    expect(refused("*")).toThrow(bare);
    expect(refused("body > *")).toThrow(/the element it hides is \*, any element/);
  });

  it("refuses main", () => {
    expect(refused("main")).toThrow(bare);
    expect(refused("body > main")).toThrow(/the element it hides is <main>/);
  });

  it("refuses footer.footer", () => {
    expect(refused("footer.footer")).toThrow(bare);
    expect(refused("body > footer.footer")).toThrow(/the element it hides is <footer>/);
    expect(refused("body .footer")).toThrow(/the element it hides is \.footer, a whole-region container/);
  });

  it("refuses a bare footer", () => {
    expect(refused("footer")).toThrow(/selector "footer" is refused because it has no descendant or child part/);
    expect(refused("body footer")).toThrow(/the element it hides is <footer>/);
  });

  it("refuses header, nav, #__next, and selector lists", () => {
    expect(refused("body > header")).toThrow(/<header>/);
    expect(refused("body nav")).toThrow(/<nav>/);
    expect(refused("body > #__next")).toThrow(/#__next, a whole-page container/);
    expect(refused("footer.footer a, body")).toThrow(/selector list/);
  });

  it("refuses an entry that would accept a whole capture, or that is incomplete", () => {
    const { selectors: _none, ...whole } = entry;
    expect(() => readRegister(raw([whole]))).toThrow(/at least one selector/);
    expect(() => readRegister(raw([{ ...entry, selectors: [] }]))).toThrow(/at least one selector/);
    expect(() => readRegister(raw([{ ...entry, reason: " " }]))).toThrow(/reason/);
    expect(() => readRegister(raw([{ ...entry, browsers: ["safari"] }]))).toThrow(/browsers/);
    expect(() => readRegister(raw([{ ...entry, pairs: [] }]))).toThrow(/pairs/);
    expect(() => readRegister(raw([entry, entry]))).toThrow(/twice/);
    expect(() => readRegister(raw([{ old: "/index.html", new: "/", width: 1440, browser: "chromium", reason: "Old format." }]))).toThrow();
  });

  it("applies an entry only to the pairs, widths, and browsers it names", () => {
    const register = readRegister(raw([entry]));
    expect(entriesFor(register, { old: "/index.html", new: "/", width: 768, browser: "firefox" })).toHaveLength(1);
    expect(entriesFor(register, { old: "/index.html", new: "/", width: 768, browser: "webkit" })).toHaveLength(0);
    expect(entriesFor(register, { old: "/about-us.html", new: "/about", width: 768, browser: "firefox" })).toHaveLength(0);
    expect(entriesFor(register, { old: "/index.html", new: "/", width: 1024, browser: "firefox" })).toHaveLength(0);
  });

  it("makes an entry that hides nothing an error", () => {
    const selector = entry.selectors[0];
    expect(staleSelectors([entry], { [selector]: 0 }, { [selector]: 0 })).toEqual([`register entry ${entry.id}: "${selector}" hides nothing on either side`]);
    expect(staleSelectors([entry], { [selector]: 1 }, { [selector]: 0 })).toEqual([]);
    expect(staleSelectors([entry], { [selector]: -1 }, { [selector]: -1 })[0]).toMatch(/not a valid selector/);
  });

  it("reads the pages the section register accepts as absent", () => {
    const absent = absentPages(fs.readFileSync(path.join(sectionTool, "accepted-differences.json"), "utf8"));
    expect([...absent].sort()).toEqual(["/blogs/augment-vs-outsource-tech-team.html", "/blogs/digital-transformation-signs.html"]);
  });
});

describe("screenshot parity: images", () => {
  it("fails a moved, resized, reshaped, or missing image and passes the same box", () => {
    const same = compareImages([img(box(10, 20, 300, 200))], [img(box(10, 20, 300, 200), 1.505)]);
    expect(same.problems).toEqual([]);
    expect(compareImages([img(box(10, 20, 300, 200))], [img(box(10, 21, 300, 200))]).problems[0]).toMatch(/box/);
    expect(compareImages([img(box(10, 20, 300, 200))], [img(box(10, 20, 320, 200))]).problems[0]).toMatch(/box/);
    expect(compareImages([img(box(10, 20, 300, 200))], [img(box(10, 20, 300, 200), 1)]).problems[0]).toMatch(/aspect ratio/);
    expect(compareImages([img(box(10, 20, 300, 200)), img(box(10, 300, 300, 200))], [img(box(10, 20, 300, 200))]).problems[0]).toMatch(/missing from the new page/);
  });

  it("allows one pixel of rounding when the media pipeline scaled a file, and nothing more", () => {
    const scaled = (width: number, height: number) => ({ ...img(box(10, 20, 153.6, 48), width / height), natural: { width, height } });
    // 718×206 stored at 184×52: 52.8 rounded down.
    expect(sameShape(718 / 206, scaled(184, 52))).toBe(true);
    expect(compareImages([img(box(10, 20, 153.6, 48), 718 / 206)], [scaled(184, 52)]).problems).toEqual([]);
    // 1620×540 stored at 165×54: 55 rounded down.
    expect(sameShape(3, scaled(165, 54))).toBe(true);
    // Two pixels off, or a different picture, is a different shape.
    expect(sameShape(3, scaled(165, 53))).toBe(false);
    expect(sameShape(3, scaled(165, 70))).toBe(false);
  });

  it("scores similarity from thumbnails and lists the least similar first", () => {
    const white = new Array(16).fill(255);
    const black = [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255];
    expect(imageSimilarity(white, white)).toBe(1);
    expect(imageSimilarity(white, black)).toBe(0);
    expect(imageSimilarity(null, white)).toBeNull();
    const result = (old: string, similarity: number) => ({ old, width: 1440, browser: "chromium", scores: [{ index: 1, element: "img", oldSrc: "a", newSrc: "b", similarity }] });
    expect(worstImages([result("/a", 0.99), result("/b", 0.4), result("/c", 0.8)], 2).map((score) => score.old)).toEqual(["/b", "/c"]);
    // One row per image: the same picture at three widths is listed once, at its worst.
    const widths = [1440, 768, 390].map((width, i) => ({ ...result("/b", 0.4 + i / 100), width }));
    const listed = worstImages([...widths, result("/c", 0.8)]);
    expect(listed.map((score) => [score.old, score.width])).toEqual([["/b", 1440], ["/c", 1440]]);
  });
});

describe("screenshot parity: configuration", () => {
  it("takes any two ports from 1024 to 65535", () => {
    expect(portFromEnv("SCREENSHOT_PORT", 4390, {})).toBe(4390);
    expect(portFromEnv("SCREENSHOT_PORT", 4390, { SCREENSHOT_PORT: "4298" })).toBe(4298);
    expect(() => portFromEnv("SCREENSHOT_PORT", 4390, { SCREENSHOT_PORT: "80" })).toThrow(/1024 to 65535/);
    expect(() => portFromEnv("SCREENSHOT_PORT", 4390, { SCREENSHOT_PORT: "70000" })).toThrow(/1024 to 65535/);
    expect(() => portFromEnv("SCREENSHOT_PORT", 4390, { SCREENSHOT_PORT: "x" })).toThrow();
  });

  it("chooses browsers from SCREENSHOT_BROWSERS, default all three", () => {
    expect(browsersFromEnv({})).toEqual(["chromium", "firefox", "webkit"]);
    expect(browsersFromEnv({ SCREENSHOT_BROWSERS: "chromium, Firefox" })).toEqual(["chromium", "firefox"]);
    expect(() => browsersFromEnv({ SCREENSHOT_BROWSERS: "chromium,safari" })).toThrow(/SCREENSHOT_BROWSERS/);
  });

  it("refuses a path that leaves the site root", () => {
    expect(fileFor(tool, "/../package.json")).toBeNull();
    expect(fileFor(tool, "/pairs.mjs")).toMatch(/pairs\.mjs$/);
  });
});
