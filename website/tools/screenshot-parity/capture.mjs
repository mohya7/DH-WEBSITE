import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { comparePng } from "./diff.mjs";
import { measureRemoved } from "./measure.mjs";

const engines = { chromium, firefox, webkit };

export const WIDTHS = [1440, 768, 390];
export const VIEWPORT_HEIGHT = 900;
export const BROWSERS = ["chromium", "firefox", "webkit"];
/** Thumbnail edge for the image similarity score. */
export const THUMB = 32;
/** Captures taken until two in a row are identical (at 390 px a settled service page needed 4). */
export const MAX_ATTEMPTS = 8;

/**
 * One side of a pair, settled and captured.
 *
 * Settling: reduced motion; the whole page is scrolled once so lazy images and
 * scroll-driven scripts have run, then back to the top; reveal targets and
 * counters are given their final state; every image is loaded and decoded;
 * fonts are ready; two animation frames pass.
 *
 * Images: every visible <img> and every url() background is recorded (box,
 * intrinsic aspect ratio, and a small thumbnail for the similarity score), then
 * its pixels are replaced by one flat colour, so a re-encoded file draws the
 * same as the original while its box still counts. The caller compares the
 * boxes and aspect ratios of the two sides.
 *
 * Hidden: masks.json selectors and the register selectors for this capture are
 * hidden with visibility, which keeps their box. How many elements each
 * selector matched is returned, so an entry that hides nothing can fail.
 *
 * Hover is disabled (pointer-events: none), the DOM must be quiet for a second,
 * and every animation is fixed: infinite ones cancelled, finite ones finished.
 *
 * Inside one load the page is captured until two consecutive captures are
 * identical (MAX_ATTEMPTS). The whole load is repeated until two consecutive
 * loads give the same picture (MAX_LOADS, see captureOne). If no two agree,
 * the capture is marked unstable.
 *
 * Returns { status } alone when the page answers 400 or more.
 */
/** Full loads (settle and capture) until two in a row give the same picture. */
export const MAX_LOADS = 4;

export async function captureOne(page, url, options) {
  // In Chromium the first capture of a page in a browser context can differ from later ones, and now and
  // then a later load differs too: measured on the service pages, the background wave layer moved 8,706
  // pixels at 1440 between the first and second capture, and 7,520 at 768 on a later load. Inside one load
  // the captures agree; across loads they did not always. So the page is loaded and captured in full until
  // two consecutive loads give the same picture. The first load also serves as a warm-up.
  let previous = await captureOnce(page, url, options);
  if (!previous.png) return previous;
  for (let load = 2; load <= MAX_LOADS; load++) {
    const next = await captureOnce(page, url, options);
    if (!next.png) return next;
    if (next.png.equals(previous.png)) return withRemoved(page, { ...next, loads: load }, options);
    previous = next;
  }
  return withRemoved(page, { ...previous, stable: false, loads: MAX_LOADS, notes: [...previous.notes, `no two consecutive loads gave the same picture in ${MAX_LOADS} loads`] }, options);
}

/** The page is still on the load that was just captured: measure there what the register removes (measure.mjs). */
async function withRemoved(page, result, { guardEntries = [], entryCap = 0.08 }) {
  if (guardEntries.length === 0) return result;
  const key = "screenshot-parity-guard";
  const selectorsOf = (ids) => guardEntries.filter((entry) => ids.includes(entry.id)).flatMap((entry) => entry.selectors);
  result.removed = await measureRemoved({
    entries: guardEntries,
    maskedPng: result.png,
    screenshot: () => page.screenshot(SCREENSHOT),
    showAll: () => page.evaluate((name) => window[Symbol.for(name)].showAll(), key),
    hideAll: () => page.evaluate((name) => window[Symbol.for(name)].hideAll(), key),
    hideOnly: (ids) => page.evaluate(([name, selectors]) => window[Symbol.for(name)].hideOnly(selectors), [key, selectorsOf(ids)]),
    wait: () => page.evaluate(() => new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 250))),
    diff: (a, b) => comparePng(a, b, { pixelmatchThreshold: 0 }),
    maxAttempts: MAX_ATTEMPTS,
    entryCap,
  });
  return result;
}

/** One full-page capture: the masked capture and the unmasked measurement use the same settings. */
const SCREENSHOT = { fullPage: true, animations: "disabled", caret: "hide", scale: "css", timeout: 90_000, type: "png" };

async function captureOnce(page, url, { maskSelectors = [], guardSelectors = [], paint = false, flattenImages = true }) {
  const response = await page.goto(url, { waitUntil: "load", timeout: 90_000 });
  const status = response ? response.status() : 0;
  if (status === 0 || status >= 400) return { status };

  await page.evaluate(installGuard);
  const info = await page.evaluate(settle, { paint, maskSelectors, guardSelectors, flattenImages, thumb: THUMB, viewport: VIEWPORT_HEIGHT });

  let previous = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const png = await page.screenshot(SCREENSHOT);
    if (previous && previous.equals(png)) return { status, png, attempts: attempt, stable: true, ...info, guardLater: await remeasure(page) };
    previous = png;
    await page.evaluate(() => new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 250)));
  }
  return { status, png: previous, attempts: MAX_ATTEMPTS, stable: false, ...info, guardLater: await remeasure(page) };
}

/** The hidden nodes measured again after capturing, through the stored references; no selector is re-run. */
function remeasure(page) {
  return page.evaluate(() => window[Symbol.for("screenshot-parity-guard")].remeasure());
}

/**
 * Installs the register guard in the page (runs there, so it is self-contained).
 *
 * The invariant: the guard measures exactly the nodes that are hidden.
 * hideAndMeasure queries every selector ONCE, keeps the element references,
 * measures the register ones before hiding them, then hides those same
 * references. remeasure measures the stored references again and never re-runs
 * a selector, so a page that changes an attribute or a style after hiding (and
 * so stops a selector matching) cannot make hidden nodes disappear from the
 * guard; a stored node that has left the page is counted as removed.
 *
 * What is measured is what hiding removes: the union of the client rects of the
 * element, of every descendant element, and of its text (a Range over its
 * contents), clipped to the page. An element's own box alone does not bound it:
 * a display: contents element has no box, but its text still paints.
 */
export function installGuard() {
  const key = Symbol.for("screenshot-parity-guard");
  const pageSize = () => {
    const root = document.documentElement;
    const body = document.body;
    return {
      width: Math.max(root.scrollWidth, root.clientWidth, body ? body.scrollWidth : 0),
      height: Math.max(root.scrollHeight, root.clientHeight, body ? body.scrollHeight : 0),
    };
  };
  const query = (selector) => {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return null;
    }
  };
  const drawn = ["IMG", "SVG", "CANVAS", "VIDEO", "IFRAME", "OBJECT", "EMBED", "PICTURE", "INPUT", "TEXTAREA", "SELECT"];
  /* Nothing to hide: no text and no replaced or drawn content. */
  const empty = (el) => !el.textContent.trim()
    && !drawn.includes(el.tagName.toUpperCase())
    && el.querySelector(drawn.join(", ").toLowerCase()) === null;
  const measure = (el, page) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const rects = [];
    const add = (list) => {
      for (const r of list) {
        if (r.width > 0 && r.height > 0) rects.push({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY });
      }
    };
    add(el.getClientRects());
    const range = document.createRange();
    range.selectNodeContents(el);
    add(range.getClientRects());
    const descendants = el.getElementsByTagName("*");
    for (let index = 0; index < descendants.length && index < 500; index++) add(descendants[index].getClientRects());

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const r of rects) {
      const left = Math.max(0, r.left);
      const top = Math.max(0, r.top);
      const right = Math.min(page.width, r.right);
      const bottom = Math.min(page.height, r.bottom);
      if (right <= left || bottom <= top) continue;
      x0 = Math.min(x0, left);
      y0 = Math.min(y0, top);
      x1 = Math.max(x1, right);
      y1 = Math.max(y1, bottom);
    }

    /* A boxless element (display: contents or none), or one holding a display: contents descendant, is refused unless empty. */
    const display = getComputedStyle(el).display;
    let boxless = null;
    if ((display === "contents" || display === "none") && !empty(el)) boxless = "display: " + display;
    for (let index = 0; boxless === null && index < descendants.length && index < 500; index++) {
      const inner = descendants[index];
      if (getComputedStyle(inner).display === "contents" && !empty(inner)) boxless = "a display: contents descendant";
    }

    return {
      tag: el.tagName.toLowerCase(),
      boxless,
      landmark: el.matches("main, header, nav, footer") || el.querySelector("main, header, nav, footer") !== null,
      descendants: descendants.length,
      x: x1 > x0 ? x0 : 0,
      y: y1 > y0 ? y0 : 0,
      width: x1 > x0 ? x1 - x0 : 0,
      height: y1 > y0 ? y1 - y0 : 0,
    };
  };

  let stored = [];
  const maskHidden = new Set();
  const originals = new Map();
  const hideNode = (el) => {
    if (!originals.has(el)) originals.set(el, [el.style.getPropertyValue("visibility"), el.style.getPropertyPriority("visibility")]);
    el.style.setProperty("visibility", "hidden", "important");
  };
  /* Back to what the page had; a node a mask hides stays hidden. */
  const showNode = (el) => {
    if (maskHidden.has(el) || !originals.has(el)) return;
    const [value, priority] = originals.get(el);
    if (value) el.style.setProperty("visibility", value, priority);
    else el.style.removeProperty("visibility");
  };
  const registerNodes = (selectors) => stored.filter(([selector]) => !selectors || selectors.includes(selector)).flatMap(([, elements]) => elements ?? []);
  const guard = {
    hideAndMeasure(maskSelectors, guardSelectors) {
      const page = pageSize();
      const found = new Map();
      for (const selector of [...guardSelectors, ...maskSelectors]) {
        if (!found.has(selector)) found.set(selector, query(selector));
      }
      const matches = {};
      for (const selector of guardSelectors) {
        const elements = found.get(selector);
        matches[selector] = elements === null ? null : elements.map((el) => measure(el, page));
      }
      const hidden = {};
      for (const selector of maskSelectors) (found.get(selector) ?? []).forEach((el) => maskHidden.add(el));
      for (const [selector, elements] of found) {
        hidden[selector] = elements === null ? -1 : elements.length;
        if (elements) elements.forEach(hideNode);
      }
      stored = guardSelectors.map((selector) => [selector, found.get(selector)]);
      return { hidden, guard: { page, matches, removed: 0 } };
    },
    remeasure() {
      const page = pageSize();
      const matches = {};
      let removed = 0;
      for (const [selector, elements] of stored) {
        if (elements === null) {
          matches[selector] = null;
          continue;
        }
        const present = elements.filter((el) => el.isConnected);
        removed += elements.length - present.length;
        matches[selector] = present.map((el) => measure(el, page));
      }
      return { page, matches, removed };
    },
    /* For measuring what the register removes: the same stored nodes, never a new query. */
    showAll() {
      registerNodes(null).forEach(showNode);
    },
    hideAll() {
      registerNodes(null).forEach(hideNode);
    },
    hideOnly(selectors) {
      registerNodes(null).forEach(showNode);
      registerNodes(selectors).forEach(hideNode);
    },
  };
  Object.defineProperty(window, key, { value: guard, configurable: false, writable: false, enumerable: false });
}

export async function withBrowser(name, widths, run) {
  const engine = engines[name];
  if (!engine) throw new Error(`Unknown browser: ${name}`);
  const browser = await engine.launch({ headless: true, args: name === "chromium" ? chromiumArgs : [] });
  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        locale: "en-US",
        timezoneId: "UTC",
        colorScheme: "dark",
      });
      await context.addInitScript(hideScrollbars);
      const page = await context.newPage();
      try {
        await run({ page, width, browser: name });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const chromiumArgs = [
  "--font-render-hinting=none",
  "--disable-font-subpixel-positioning",
  "--disable-lcd-text",
  "--force-color-profile=srgb",
];

function hideScrollbars() {
  const add = () => {
    if (document.getElementById("screenshot-parity-style")) return;
    const style = document.createElement("style");
    style.id = "screenshot-parity-style";
    style.textContent = "html{scrollbar-width:none!important}::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}";
    (document.head || document.documentElement).appendChild(style);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
  else add();
}

/* Runs in the page. Everything it needs is passed in or defined inside it. */
async function settle({ paint, maskSelectors, guardSelectors, flattenImages, thumb, viewport }) {
  const frames = (n = 2) => new Promise((resolve) => {
    const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
  const notes = [];

  // No hover states: scrolling moves content under the resting mouse pointer, which fires :hover and
  // mouseenter on whatever passes under it (the header logo, the service pipeline cards).
  const noHover = document.createElement("style");
  noHover.textContent = "*,*::before,*::after{pointer-events:none!important}";
  document.documentElement.appendChild(noHover);

  const runtime = document.querySelector('script[src*="content-runtime"]');
  if (runtime && !document.documentElement.hasAttribute("data-content-revision")) {
    const ready = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      window.addEventListener("dh:content-ready", () => {
        clearTimeout(timer);
        resolve(true);
      }, { once: true });
    });
    if (!ready) notes.push("dh:content-ready did not fire within 8 s");
  }

  // Scroll the whole page once, so lazy images load and scroll-driven scripts settle.
  const height = () => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  for (let y = 0; y < height(); y += Math.max(200, Math.floor(viewport * 0.8))) {
    window.scrollTo(0, y);
    await frames(2);
  }
  window.scrollTo(0, height());
  await frames(2);

  document.querySelectorAll("[data-reveal], [data-section-reveal], .divider").forEach((el) => el.classList.add("in"));
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = el.getAttribute("data-count");
    if (target) el.textContent = target + (el.getAttribute("data-suffix") || "");
  });

  const timeline = window.gsap && window.gsap.globalTimeline;
  if (timeline && typeof timeline.getChildren === "function") {
    try {
      for (const child of timeline.getChildren(true, true, true)) {
        const repeats = typeof child.repeat === "function" ? child.repeat() : 0;
        if (repeats === -1) child.pause(0);
        else if (typeof child.progress === "function") child.progress(1);
        if (typeof child.pause === "function") child.pause();
      }
      timeline.pause();
    } catch {
      /* Leave tweens that cannot be paused. Reduced motion already stopped the CSS. */
    }
  }
  if (window.__lenis && typeof window.__lenis.stop === "function") window.__lenis.stop();
  window.scrollTo(0, 0);
  await frames(2);

  // Scripted demos (the service pages' chat and pipeline) start when scrolled into view and change the DOM on
  // timers that reduced motion does not stop. Wait until the DOM has been quiet for a second, at most 15 s.
  const quiet = await new Promise((resolve) => {
    let timer = null;
    let cap = null;
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => done(true), 1000); });
    const done = (value) => { observer.disconnect(); clearTimeout(timer); clearTimeout(cap); resolve(value); };
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => done(true), 1000);
    cap = setTimeout(() => done(false), 15000);
  });
  if (!quiet) notes.push("the page was still changing its DOM after 15 s");

  // The design's reduced-motion rule shortens animations to .01ms but leaves infinite ones infinite, so the
  // background waves (wave-scroll) cycle every frame at an arbitrary phase. Blurs and blend modes over them
  // (the service hero panel's backdrop-filter, the logo's mix-blend-mode) then differ from capture to capture.
  // Pausing them at time 0 is not enough: with a negative animation-delay and a .01ms duration the phase is a
  // floating-point remainder, a sub-pixel offset that varies. So infinite animations are cancelled (the
  // element shows its un-animated style) and finite ones are finished, the same on both sides.
  const fixAnimations = () => {
    for (const animation of document.getAnimations()) {
      try {
        const timing = animation.effect && animation.effect.getComputedTiming ? animation.effect.getComputedTiming() : {};
        if (timing.iterations === Infinity) animation.cancel();
        else animation.finish();
      } catch {
        try { animation.pause(); } catch { /* an animation that cannot be paused is left as it is */ }
      }
    }
  };
  fixAnimations();

  async function loadImage(img) {
    if (!img.getAttribute("src") && !img.currentSrc) return;
    img.loading = "eager";
    if (!(img.complete && img.naturalWidth > 0)) {
      const loaded = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 15000);
        img.addEventListener("load", () => { clearTimeout(timer); resolve(true); }, { once: true });
        img.addEventListener("error", () => { clearTimeout(timer); resolve(true); }, { once: true });
        if (img.complete) { clearTimeout(timer); resolve(true); }
      });
      if (!loaded) notes.push(`image did not load within 15 s: ${img.currentSrc || img.getAttribute("src")}`);
    }
    try { await img.decode(); } catch { /* A broken image is still compared by its box. */ }
  }
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await Promise.all([...document.images].map(loadImage));

  // The layers of a background value, split at top-level commas.
  const layers = (value) => {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      else if (value[i] === ")") depth--;
      else if (value[i] === "," && depth === 0) { out.push(value.slice(start, i).trim()); start = i + 1; }
    }
    out.push(value.slice(start).trim());
    return out;
  };
  const urlOf = (layer) => {
    const m = /^url\(\s*(['"]?)(.*?)\1\s*\)$/.exec(layer);
    return m ? m[2] : null;
  };
  const backgroundImages = new Map();
  const loadBackground = (url) => {
    if (!backgroundImages.has(url)) {
      backgroundImages.set(url, new Promise((resolve) => {
        const image = new Image();
        const timer = setTimeout(() => { notes.push(`background did not load within 15 s: ${url}`); resolve(null); }, 15000);
        image.onload = async () => { clearTimeout(timer); try { await image.decode(); } catch { /* drawn as is */ } resolve(image); };
        image.onerror = () => { clearTimeout(timer); resolve(null); };
        image.src = url;
      }));
    }
    return backgroundImages.get(url);
  };

  if (paint) {
    for (const id of ["heroFluidCanvas", "heroSandCanvas"]) {
      const canvas = document.getElementById(id);
      if (!canvas || canvas.tagName !== "CANVAS") continue;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = w;
      canvas.height = h;
      canvas.style.opacity = "1";
      canvas.style.mixBlendMode = "normal";
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "#ff00ff";
      context.fillRect(0, 0, w, h);
    }
  }

  // Hide masks and register selectors through the guard (installGuard): one query per selector, the register
  // matches measured before hiding, then the same nodes hidden. hidden counts what each matched (-1: invalid).
  const parityGuard = window[Symbol.for("screenshot-parity-guard")];
  if (!parityGuard) throw new Error("The register guard is not installed in the page.");
  const { hidden, guard } = parityGuard.hideAndMeasure(maskSelectors, guardSelectors);
  await frames(2);

  const thumbnail = (source) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = thumb;
      canvas.height = thumb;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, thumb, thumb);
      context.drawImage(source, 0, 0, thumb, thumb);
      return Array.from(context.getImageData(0, 0, thumb, thumb).data);
    } catch {
      return null;
    }
  };
  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return getComputedStyle(el).visibility !== "hidden";
  };
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const images = [];
  for (const img of document.images) {
    if (!shown(img)) continue;
    images.push({
      kind: "img",
      element: describe(img),
      src: img.currentSrc || img.getAttribute("src") || "",
      box: boxOf(img),
      aspect: img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null,
      natural: { width: img.naturalWidth, height: img.naturalHeight },
      thumb: img.naturalWidth > 0 ? thumbnail(img) : null,
      target: img,
    });
  }
  for (const el of document.querySelectorAll("body *")) {
    const value = getComputedStyle(el).backgroundImage;
    if (!value || !value.includes("url(") || !shown(el)) continue;
    const parts = layers(value);
    for (const part of parts) {
      const url = urlOf(part);
      if (!url) continue;
      const image = await loadBackground(url);
      images.push({
        kind: "background",
        element: describe(el),
        src: url,
        box: boxOf(el),
        aspect: image && image.naturalWidth > 0 ? image.naturalWidth / image.naturalHeight : null,
        natural: image ? { width: image.naturalWidth, height: image.naturalHeight } : null,
        thumb: image ? thumbnail(image) : null,
        target: el,
        parts,
      });
    }
  }

  if (flattenImages) {
    const flat = "#7f7f7f";
    for (const entry of images) {
      if (entry.kind === "img") {
        entry.target.style.setProperty("object-position", "-100000px -100000px", "important");
        entry.target.style.setProperty("background", flat, "important");
      } else {
        const replaced = entry.parts.map((layer) => (urlOf(layer) ? `linear-gradient(${flat}, ${flat})` : layer)).join(", ");
        entry.target.style.setProperty("background-image", replaced, "important");
      }
    }
  }
  fixAnimations();
  await frames(2);

  return {
    hidden,
    guard,
    notes,
    images: images.map(({ target, parts, ...rest }) => rest),
  };
}

export function slug(urlPath) {
  const cleaned = urlPath.replace(/^\/+|\/+$/g, "") || "home";
  return cleaned.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function writeCapture(dir, name, buffer) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, buffer);
  return name;
}
