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

const page = (body: string, script = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:1000px;overflow:hidden;background:#fff;font:24px Arial}main,p{margin:0}a{display:block;position:absolute}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;

type Case = { id: string; selectors: string[][]; old: string; now: string; expected: "error" | "match"; problem?: RegExp };

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
    const result = results[0] as { status: string; problems: string[]; differentPixels: number | null };
    expect(result.status, result.problems.join("\n")).toBe(c.expected);
    if (c.problem) expect(result.problems.join("\n")).toMatch(c.problem);
    if (c.expected === "match") expect(result.differentPixels).toBe(0);
  }, 120_000);
});

describe.runIf(!hasChromium)("screenshot parity: the register guard in Chromium", () => {
  it.skip("needs Playwright's Chromium, which this environment does not have (the website CI job installs none)", () => {});
});
