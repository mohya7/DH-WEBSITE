import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

const engines = { chromium, firefox, webkit };

export const WIDTHS = [1440, 768, 390];
export const VIEWPORT_HEIGHT = 900;
export const BROWSERS = ["chromium", "firefox", "webkit"];

/**
 * Full-page captures with motion settled.
 * Reduced motion is on. The page's own styles then finish finite animations
 * and stop marquees. Playwright also finishes finite animations at capture
 * time. Fonts and images are waited on. Masks with effect "hide" remove the
 * element (the hero canvases sit behind the headline, so a rectangle over
 * them would also hide the headline).
 */
export async function capturePair(page, { baselineUrl, candidateUrl, paintCandidate, hideSelectors }) {
  const baseline = await captureOne(page, baselineUrl, { paint: false, hideSelectors });
  const candidate = await captureOne(page, candidateUrl, { paint: paintCandidate, hideSelectors });
  return { baseline, candidate };
}

async function captureOne(page, url, { paint, hideSelectors }) {
  const response = await page.goto(url, { waitUntil: "load", timeout: 90_000 });
  if (!response || response.status() >= 400) {
    throw new Error(`${url} returned ${response ? response.status() : "no response"}`);
  }
  await page.evaluate(settle, { paint, hideSelectors });
  return page.screenshot({
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    timeout: 90_000,
    type: "png",
  });
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

async function settle({ paint, hideSelectors }) {
  const runtime = document.querySelector('script[src*="content-runtime"]');
  if (runtime && !document.documentElement.hasAttribute("data-content-revision")) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 8000);
      window.addEventListener("dh:content-ready", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  document.querySelectorAll("[data-reveal], [data-section-reveal], .divider").forEach((el) => {
    el.classList.add("in");
  });
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = el.getAttribute("data-count");
    if (!target) return;
    el.textContent = target + (el.getAttribute("data-suffix") || "");
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
  if (window.scrollY !== 0) window.scrollTo(0, 0);

  async function loadImage(img) {
    const url = img.currentSrc || img.getAttribute("src");
    if (!url) return;
    img.loading = "eager";
    if (!(img.complete && img.naturalWidth > 0)) {
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, 15000);
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
        if (img.complete) finish();
      });
    }
    try { await img.decode(); } catch { /* A broken image is the same on both sides. */ }
  }

  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await Promise.all([...document.images].map(loadImage));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  if (paint) {
    for (const id of ["heroFluidCanvas", "heroSandCanvas"]) {
      const canvas = document.getElementById(id);
      if (!canvas || canvas.tagName !== "CANVAS") continue;
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = width;
      canvas.height = height;
      canvas.style.opacity = "1";
      canvas.style.mixBlendMode = "normal";
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "#ff00ff";
      context.fillRect(0, 0, width, height);
    }
  }
  for (const selector of hideSelectors) {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.setProperty("visibility", "hidden", "important");
    });
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
