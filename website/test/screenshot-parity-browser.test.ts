import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compareSites } from "../tools/screenshot-parity/compare.mjs";

/*
 * The register guard in a real browser: the whole tool (compareSites, both
 * sides, the hide-then-measure sequence, the capture) on small fixture pages.
 *
 * LOCAL ONLY: these need Playwright's Chromium. The website CI job installs no
 * browser, so there they are skipped (and reported as skipped). The jsdom tests
 * in screenshot-parity-guard.test.ts run the same in-page guard code in CI.
 */
const hasChromium = (() => {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

const page = (body: string, script = "", css = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:1000px;overflow:hidden;background:#fff;font:24px Arial}main,p{margin:0}a{display:block;position:absolute}${css}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;

/**
 * expected: the comparison's status. removedAtMost: for paint that cannot leave the
 * element's box, the measured removal (new side) must stay this small.
 */
type Case = { id: string; selectors: string[][]; old: string; now: string; expected: "error" | "match" | "differs"; problem?: RegExp; removedAtMost?: number };

/*
 * Paint sources the geometry cannot see (round 3: Codex's false matches, and more).
 * Old and new differ only in the colour the paint source draws (red against blue),
 * across the page, so the only correct outcomes are: the removal is measured and
 * refused, or (for paint that stays inside the element) a small measured removal.
 */
const probe = '<p data-probe style="position:absolute;left:10px;top:10px;width:100px;height:20px">x</p>';
const painted = (id: string, css: (colour: string) => string, body = `<main>${probe}</main>`, script = "", extra: Partial<Case> = {}): Case => ({
  id,
  selectors: [[extra.selectors?.[0]?.[0] ?? "main p[data-probe]"]],
  old: page(body, script, css("#d00000")),
  now: page(body, script, css("#0000d0")),
  expected: "error",
  problem: /removes [\d.]+% of the page's pixels \([\d,]+ px, measured\), refused by the guard/,
  ...extra,
});
const shadowHost = (mode: string, count = 1) =>
  `(()=>{const p=document.querySelector("p[data-probe]");const root=p.attachShadow({mode:"${mode}"});` +
  `for(let i=0;i<${count};i++){const d=document.createElement("div");d.className="s";root.append(d);}` +
  `const st=document.createElement("style");st.textContent=".s{position:fixed;inset:0;background:"+getComputedStyle(document.documentElement).getPropertyValue("--paint")+"}";root.append(st);})()`;
const svgBig = (colour: string) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1440' height='1000'%3E%3Crect width='1440' height='1000' fill='${encodeURIComponent(colour)}'/%3E%3C/svg%3E")`;

const paintCases: Case[] = [
  painted("pseudo-before", (c) => `p[data-probe]::before{content:"";position:fixed;inset:0;background:${c}}`),
  painted("pseudo-after", (c) => `p[data-probe]::after{content:"";position:fixed;inset:0;background:${c}}`),
  painted("box-shadow", (c) => `p[data-probe]{box-shadow:0 0 0 2000px ${c}}`),
  painted("outline", (c) => `p[data-probe]{outline:2000px solid ${c}}`),
  painted("shadow-open", (c) => `:root{--paint:${c}}`, `<main>${probe}</main>`, shadowHost("open")),
  painted("shadow-closed", (c) => `:root{--paint:${c}}`, `<main>${probe}</main>`, shadowHost("closed")),
  painted("shadow-501", (c) => `:root{--paint:${c}}`, `<main>${probe}</main>`, shadowHost("open", 501)),
  painted("empty-contents-pseudo", (c) => `p[data-probe]::before{content:"";position:fixed;inset:0;background:${c}}`, '<main><p data-probe style="display:contents"></p></main>'),
  painted("filter-drop-shadow", (c) => `p[data-probe]{filter:drop-shadow(0 0 0 ${c}) drop-shadow(600px 400px 0 ${c})}p[data-probe]::before{content:"";position:absolute;left:0;top:0;width:100px;height:20px;box-shadow:0 0 0 400px ${c}}`),
  painted("mix-blend-mode", (c) => `body{background:${c}}p[data-probe]::before{content:"";position:fixed;inset:0;background:#fff;mix-blend-mode:difference}`),
  painted("mask-image", (c) => `p[data-probe]::before{content:"";position:fixed;inset:0;background:${c};-webkit-mask-image:linear-gradient(#000,#000);mask-image:linear-gradient(#000,#000)}`),
  painted("clip-path-overflow", (c) => `p[data-probe]{clip-path:inset(-2000px)}p[data-probe]::before{content:"";position:absolute;left:-10px;top:-10px;width:1440px;height:1000px;background:${c}}`),
  painted("svg-overflow", (c) => `svg[data-probe] rect{fill:${c}}`, '<main><svg data-probe width="100" height="20" overflow="visible" style="position:absolute;left:10px;top:10px"><rect width="1440" height="1000"/></svg></main>', "", { selectors: [["main svg[data-probe]"]] }),
  painted("pseudo-content-url", (c) => `p[data-probe]::before{content:${svgBig(c)};position:fixed;left:0;top:0}`),
  painted("pseudo-background", (c) => `p[data-probe]::after{content:"";position:fixed;inset:0;background-image:linear-gradient(${c},${c})}`),
  painted("marker", (c) => `li[data-probe]::marker{font-size:900px;color:${c}}li[data-probe]{position:absolute;left:600px;top:0;width:100px;height:20px;font-size:16px}`, '<main><ul style="margin:0;padding:0"><li data-probe>x</li></ul></main>', "", { selectors: [["main li[data-probe]"]], problem: /refused by the (runtime )?guard/ }),
  painted("first-line", (c) => `p[data-probe]::first-line{font-size:600px;color:${c}}`, `<main>${probe}</main>`, "", { problem: /refused by the (runtime )?guard/ }),
  painted("text-shadow", (c) => `p[data-probe]{text-shadow:0 0 0 ${c}, 0 0 400px ${c}, 0 0 0 ${c};font-size:400px;line-height:1;color:${c}}`),
  painted("animation-grows", (c) => `@keyframes grow{from{inset:500px}to{inset:0}}p[data-probe]::before{content:"";position:fixed;inset:0;background:${c};animation:grow 0.2s forwards}`),
  // Paint that cannot leave the element's box: a small, correctly measured removal and a match.
  painted("backdrop-filter", (c) => `body{background:${c}}p[data-probe]{backdrop-filter:invert(1)}`, `<main>${probe}</main>`, "", { expected: "differs", problem: undefined, removedAtMost: 2_500 }),
  painted("canvas-confined", () => "", `<main><p data-probe style="position:absolute;left:10px;top:10px;width:100px;height:20px"><canvas width="100" height="20"></canvas></p></main>`,
    'const g=document.querySelector("canvas").getContext("2d");g.fillStyle=location.port==="4284"?"#d00000":"#0000d0";g.fillRect(0,0,100,20);', { expected: "match", problem: undefined, removedAtMost: 2_000 }),
  painted("iframe-confined", () => "", `<main><p data-probe style="position:absolute;left:10px;top:10px;width:100px;height:20px"><iframe style="border:0;width:100px;height:20px" srcdoc="&lt;body style='margin:0;background:${"#d00000"}'&gt;"></iframe></p></main>`,
    'if(location.port!=="4284")document.querySelector("iframe").srcdoc="<body style=\'margin:0;background:#0000d0\'>";', { expected: "match", problem: undefined, removedAtMost: 2_000 }),
  // Unstable when shown: a canvas inside the hidden element redraws every frame. Hidden, the page is steady;
  // shown, it never gives two identical captures, so the removal cannot be measured and the capture is refused.
  painted("unstable-when-shown", () => "", `<main><p data-probe style="position:absolute;left:10px;top:10px;width:100px;height:20px"><canvas width="100" height="20"></canvas></p></main>`,
    'const g=document.querySelector("canvas").getContext("2d");let n=0;setInterval(()=>{n++;g.fillStyle="rgb("+(n*37%255)+",0,0)";g.fillRect(0,0,100,20);},16);', { problem: /the page never gave two identical captures with the register shown, so the pixels it removes cannot be measured/ }),
];

const style900 = "width: 900px; height: 100px;";
const full = "width: 1440px; height: 1000px;";
const grid = (side: string) =>
  "<main>" + Array.from({ length: 24 }, (_, n) =>
    `<a class="g${Math.floor(n / 4)}" style="left:${(n % 6) * 240}px;top:${Math.floor(n / 6) * 110}px;width:240px;height:110px">${side}</a>`).join("") + "</main>";

const cases: Case[] = [
  {
    id: "full-style",
    selectors: [[`main p[style="${full}"]`]],
    old: page(`<main><p style="${full}">ORIGINAL PAGE</p></main>`),
    now: page(`<main><p style="${full}">CHANGED PAGE</p></main>`),
    expected: "error",
    problem: /matches <p> 1440x1000 px, refused by the runtime guard: it is 1440 px wide/,
  },
  {
    id: "style-exact",
    selectors: [[`main p[style="${style900}"]`]],
    old: page(`<main><p style="${style900}">ORIGINAL</p></main>`),
    now: page(`<main><p style="${style900}">CHANGED</p></main>`),
    expected: "error",
    problem: /matches <p> 900x100 px, refused by the runtime guard: it is 900 px wide \(limit 800\)/,
  },
  {
    id: "style-suffix",
    selectors: [['main p[style$="height: 100px;"]']],
    old: page(`<main><p style="${style900}">ORIGINAL</p></main>`),
    now: page(`<main><p style="${style900}">CHANGED</p></main>`),
    expected: "error",
    problem: /it is 900 px wide \(limit 800\)/,
  },
  {
    id: "mutation-observer",
    selectors: [["main p[data-probe]"]],
    old: page(`<main><p data-probe="x" style="${style900}">ORIGINAL</p></main>`),
    now: page(
      `<main><p data-probe="x" style="${style900}">CHANGED</p></main>`,
      'new MutationObserver(()=>{document.querySelectorAll("p[data-probe]").forEach(p=>{if(p.style.visibility==="hidden")p.removeAttribute("data-probe");});}).observe(document.body,{subtree:true,attributes:true,attributeFilter:["style"]});',
    ),
    expected: "error",
    problem: /"main p\[data-probe\]" on new \/mutation-observer matches <p> 900x100 px, refused by the runtime guard: it is 900 px wide/,
  },
  {
    id: "display-contents",
    selectors: [["main p[data-test]"]],
    old: page(`<main style="height:1000px;overflow:hidden;color:#d00000"><p data-test style="display:contents">${"ALPHA BETA GAMMA DELTA ".repeat(3000)}</p></main>`),
    now: page(`<main style="height:1000px;overflow:hidden;color:#0000d0"><p data-test style="display:contents">${"ALPHA BETA GAMMA DELTA ".repeat(3000)}</p></main>`),
    expected: "error",
    problem: /it has no box of its own \(display: contents\)/,
  },
  {
    id: "total-cap",
    selectors: Array.from({ length: 6 }, (_, g) => [`main a.g${g}`]),
    old: page(grid("ORIGINAL")),
    now: page(grid("CHANGED")),
    expected: "error",
    problem: /register entry total on (old|new) \/total-cap: the entries together hide 44\.00% of the page, refused by the runtime guard \(limit 15\.00%\)/,
  },
  {
    id: "small-link-control",
    selectors: [["main a[data-small]"]],
    old: page('<main><a data-small style="left:10px;top:10px;width:100px;height:20px">ORIGINAL</a></main>'),
    now: page('<main><a data-small style="left:10px;top:10px;width:100px;height:20px">CHANGED</a></main>'),
    expected: "match",
  },
  ...paintCases,
];

describe.skipIf(!hasChromium)("screenshot parity: the register guard in Chromium (local only)", () => {
  let root = "";
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "parity-guard-"));
    for (const side of ["old", "new"]) fs.mkdirSync(path.join(root, side));
    for (const c of cases) {
      fs.writeFileSync(path.join(root, "old", c.id + ".html"), c.old);
      fs.writeFileSync(path.join(root, "new", c.id + ".html"), c.now);
      const register = {
        differences: c.selectors.map((selectors, i) => ({
          id: `${c.id}-${i}`,
          pairs: [{ old: "/" + c.id, new: "/" + c.id }],
          widths: [1440],
          browsers: ["chromium"],
          selectors,
          reason: "Guard test fixture.",
        })),
      };
      fs.writeFileSync(path.join(root, c.id + ".json"), JSON.stringify(register));
    }
  });
  afterAll(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it.each(cases)("$id gives $expected", async (c) => {
    const { results } = await compareSites({
      baselineRoot: path.join(root, "old"),
      candidateRoot: path.join(root, "new"),
      outDir: path.join(root, "out-" + c.id),
      registerFile: path.join(root, c.id + ".json"),
      browsers: ["chromium"],
      widths: [1440],
      pairs: [{ old: "/" + c.id, new: "/" + c.id }],
      baselinePort: 4284,
      candidatePort: 4285,
      masks: false,
      flattenImages: false,
    });
    const result = results[0] as { status: string; problems: string[]; differentPixels: number | null; removed?: { new: { total: { pixels: number } | null } | null } };
    expect(result.status, result.problems.join("\n")).toBe(c.expected);
    if (c.problem) expect(result.problems.join("\n")).toMatch(c.problem);
    if (c.expected === "match") expect(result.differentPixels).toBe(0);
    if (c.removedAtMost !== undefined) expect(result.removed?.new?.total?.pixels ?? Infinity).toBeLessThanOrEqual(c.removedAtMost);
  }, 120_000);
});

describe.runIf(!hasChromium)("screenshot parity: the register guard in Chromium", () => {
  it.skip("needs Playwright's Chromium, which this environment does not have (the website CI job installs none)", () => {});
});
