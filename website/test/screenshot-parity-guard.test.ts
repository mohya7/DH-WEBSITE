// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GUARD_MAX_DESCENDANTS,
  GUARD_MAX_ELEMENT_SHARE,
  GUARD_MAX_ENTRY_SHARE,
  GUARD_MAX_HEIGHT,
  GUARD_MAX_MATCHES,
  GUARD_MAX_TOTAL_SHARE,
  GUARD_MAX_WIDTH,
  MAX_REGISTER_ENTRIES,
  guardProblems,
  readRegister,
  unionArea,
  wholeCaptureReason,
} from "../tools/screenshot-parity/diff.mjs";
import type { Measured } from "../tools/screenshot-parity/diff.mjs";
import { installGuard } from "../tools/screenshot-parity/capture.mjs";
import type { PageGuard } from "../tools/screenshot-parity/capture.mjs";

/*
 * A tiny fixture page. jsdom has no layout, so each element states its box in
 * data-x, data-y, data-w and data-h, and getClientRects reads them; a Range over
 * an element returns the text rects it states in data-text ("x,y,w,h;..."). An
 * element styled display: contents or none has no box of its own. The selector
 * matching, the hide-then-measure sequence, the landmark, descendant and
 * display checks, and the guard are the tool's own (installGuard, guardProblems).
 * These run in CI; the real-browser versions are in screenshot-parity-browser.test.ts.
 */
const repeat = (count: number, html: string) => Array.from({ length: count }, () => html).join("");
const fixture = `
<header data-w="1440" data-h="80"><nav data-w="1000" data-h="40"><a href="/" data-w="80" data-h="20">Home</a></nav></header>
<main data-w="1440" data-h="2520">
  <section id="hero" data-w="1440" data-h="600">
    <h1 data-w="790" data-h="120">Title</h1>
    <p class="lead" data-w="700" data-h="48">Lead</p>
  </section>
  <section id="wide" data-w="1440" data-h="400"><p class="wide" data-w="900" data-h="40">A 900 px wide block</p></section>
  <section id="tall" data-w="1440" data-h="400"><p class="tall" data-w="600" data-h="300">A 300 px tall block</p></section>
  <section id="cards" data-w="1440" data-h="400"><ul data-w="1200" data-h="300">${repeat(20, '<li data-w="200" data-h="30"><a class="card-link" href="/x" data-w="200" data-h="20">Card</a></li>')}</ul></section>
  <section id="menu" data-w="1440" data-h="200"><ul data-w="600" data-h="80">
    <li class="has-nav" data-w="300" data-h="40"><nav data-w="300" data-h="40"><a href="/" data-w="80" data-h="20">x</a></nav></li>
    <li class="rich" data-w="300" data-h="40">${repeat(8, '<span data-w="20" data-h="20">s</span>')}</li>
  </ul></section>
  <section id="chips" data-w="1440" data-h="1200">${Array.from({ length: 10 }, (_, i) => `<span class="chip" data-x="${(i % 2) * 720}" data-y="${1500 + Math.floor(i / 2) * 120}" data-w="720" data-h="120">chip</span>`).join("")}</section>
  <section id="boxless" data-w="1440" data-h="200">
    <p class="contents" style="display: contents" data-text="0,0,1385,1000">Text that paints across the page.</p>
    <p class="gone" style="display: none">Hidden text.</p>
    <span class="holder" data-w="100" data-h="20"><b style="display: contents" data-text="0,0,1300,900">inner text</b></span>
    <span class="hollow" data-w="100" data-h="20"><i style="display: contents"></i></span>
    <p class="painted" data-w="100" data-h="20" data-text="0,0,1385,600">Short box, long text.</p>
  </section>
  <section id="contact" data-w="1440" data-h="120"><a href="mailto:sales@example.com" data-w="616" data-h="24">sales@example.com</a></section>
</main>
<footer class="footer" data-w="1440" data-h="400">
  <div class="footer-cols" data-w="1200" data-h="200">
    <div class="footer-col" data-w="274" data-h="150">${repeat(4, '<a href="/s" data-w="274" data-h="30">Service</a>')}</div>
    <div class="footer-col" data-w="274" data-h="150">${repeat(4, '<a href="/c" data-w="274" data-h="30">Company</a>')}</div>
  </div>
  <div class="footer-contact" data-w="290" data-h="30"><a href="mailto:sales@example.com" data-w="290" data-h="30">sales@example.com</a></div>
  <div class="footer-bottom" data-w="1200" data-h="20"><span data-w="233" data-h="19">© 2026 Digital Hub</span><span data-w="100" data-h="19">Links</span></div>
</footer>`;
const PAGE = { width: 1440, height: 3000 };

let originalRects: typeof Element.prototype.getClientRects;
let originalRangeRects: typeof Range.prototype.getClientRects;
let guard: PageGuard;
const rect = (x: number, y: number, width: number, height: number) =>
  ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) }) as DOMRect;
const list = (rects: DOMRect[]) => Object.assign(rects, { item: (i: number) => rects[i] ?? null }) as unknown as DOMRectList;
beforeAll(() => {
  document.body.innerHTML = fixture;
  document.documentElement.setAttribute("data-w", String(PAGE.width));
  document.documentElement.setAttribute("data-h", String(PAGE.height));
  document.body.setAttribute("data-w", String(PAGE.width));
  document.body.setAttribute("data-h", String(PAGE.height));
  originalRects = Element.prototype.getClientRects;
  originalRangeRects = Range.prototype.getClientRects;
  Element.prototype.getClientRects = function (this: Element) {
    const display = (this as HTMLElement).style?.display;
    const width = Number(this.getAttribute("data-w") ?? 0);
    const height = Number(this.getAttribute("data-h") ?? 0);
    if (display === "contents" || display === "none" || width <= 0 || height <= 0) return list([]);
    return list([rect(Number(this.getAttribute("data-x") ?? 0), Number(this.getAttribute("data-y") ?? 0), width, height)]);
  };
  Range.prototype.getClientRects = function (this: Range) {
    const owner = this.startContainer as Element;
    const text = owner.getAttribute?.("data-text");
    return list(text ? text.split(";").map((part) => { const [x, y, w, h] = part.split(",").map(Number); return rect(x, y, w, h); }) : []);
  };
  for (const el of [document.documentElement, document.body]) {
    Object.defineProperty(el, "scrollWidth", { configurable: true, value: PAGE.width });
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: PAGE.height });
  }
  installGuard();
  guard = (window as unknown as Record<symbol, PageGuard>)[Symbol.for("screenshot-parity-guard")];
});
afterAll(() => {
  Element.prototype.getClientRects = originalRects;
  Range.prototype.getClientRects = originalRangeRects;
});

/** One query, measured, then hidden: what the tool does at capture time. */
const measure = (selectors: string[]): Measured => guard.hideAndMeasure([], selectors).guard;

/** Both layers, as the tool applies them: the static check when the register is read, the guard on the page. */
function verdict(selector: string): { layer: "static" | "runtime" | "accepted"; message: string } {
  const reason = wholeCaptureReason(selector);
  if (reason) return { layer: "static", message: reason };
  const entry = { id: "probe", pairs: [], widths: [], browsers: [], selectors: [selector], reason: "probe" };
  const problems = guardProblems([entry], measure([selector]), "new /fixture");
  return problems.length > 0 ? { layer: "runtime", message: problems.join(" | ") } : { layer: "accepted", message: "" };
}

describe("screenshot parity: runtime guard limits", () => {
  it("are the stated constants", () => {
    expect([GUARD_MAX_DESCENDANTS, GUARD_MAX_WIDTH, GUARD_MAX_HEIGHT, GUARD_MAX_ELEMENT_SHARE, GUARD_MAX_ENTRY_SHARE, GUARD_MAX_MATCHES]).toEqual([6, 800, 120, 0.02, 0.08, 12]);
  });

  it("accepts a small link, and each of the five approved selectors on the fixture", () => {
    for (const selector of [
      "footer.footer .footer-cols > .footer-col:nth-child(2) a",
      "footer.footer .footer-contact a[href^=\"mailto:\"]",
      "footer.footer .footer-bottom > span:first-child",
      "footer.footer .footer-cols > .footer-col:nth-child(1) a",
      "main a[href^=\"mailto:sales@\"]",
    ]) {
      expect(verdict(selector), selector).toEqual({ layer: "accepted", message: "" });
    }
    expect(measure(["footer.footer .footer-cols > .footer-col:nth-child(2) a"]).matches["footer.footer .footer-cols > .footer-col:nth-child(2) a"]).toHaveLength(4);
  });

  it("refuses body, html > :is(body), [class], *:first-child, main > section, body > :where(main), and an escape before any page loads", () => {
    const cases: [string, RegExp][] = [
      ["body", /the element it hides is <body>, a whole-page or whole-region container/],
      ["html > :is(body)", /the functional pseudo-class :is\(\)/],
      ["[class]", /it must start with an element name/],
      ["*:first-child", /it contains \*, which matches any element/],
      ["main > section", /the element it hides is <section>; only a, span, p/],
      ["body > :where(main)", /the functional pseudo-class :where\(\)/],
      ["html > \\62 ody", /it contains a backslash \(a CSS escape\)/],
    ];
    for (const [selector, message] of cases) {
      const result = verdict(selector);
      expect(result.layer, selector).toBe("static");
      expect(result.message, selector).toMatch(message);
    }
  });

  it("refuses a 900 px wide block on the page", () => {
    expect(verdict("main p.wide")).toEqual({
      layer: "runtime",
      message: 'register entry probe: "main p.wide" on new /fixture matches <p> 900x40 px, refused by the runtime guard: it is 900 px wide (limit 800)',
    });
  });

  it("refuses a tall block, a large area, a region with many descendants, and an element holding a landmark", () => {
    expect(verdict("main p.tall").message).toMatch(/it is 300 px tall \(limit 120\)/);
    expect(verdict("main h1").message).toMatch(/<h1> 790x120 px, refused by the runtime guard: it covers 2\.19% of the page \(limit 2\.00%\)/);
    expect(verdict("main li.rich").message).toMatch(/it has 8 descendant elements \(limit 6\)/);
    expect(verdict("main li.has-nav").message).toMatch(/it is or contains a main, header, nav, or footer element/);
  });

  it("refuses an entry that matches too many elements or hides too much in total", () => {
    expect(verdict("main a.card-link").message).toBe("register entry probe on new /fixture matches 20 elements, refused by the runtime guard (limit 12)");
    // Ten elements of 720x120 px, each exactly 2% of the page and so within every per-element limit: 20% in total.
    expect(verdict("main span.chip").message).toContain("register entry probe on new /fixture hides 20.00% of the page, refused by the runtime guard (limit 8.00%)");
  });

  it("refuses <html> and <body> if a selector ever reaches them", () => {
    const entry = { id: "probe", pairs: [], widths: [], browsers: [], selectors: ["html", "body"], reason: "probe" };
    const problems = guardProblems([entry], measure(["html", "body"]), "old /fixture");
    expect(problems[0]).toMatch(/"html" on old \/fixture matches <html> 1440x3000 px, refused by the runtime guard: it is <html>; it is or contains a main, header, nav, or footer element; .*it has \d+ descendant elements/);
    expect(problems[1]).toMatch(/"body" on old \/fixture matches <body> 1440x3000 px, refused by the runtime guard: it is <body>/);
  });

  it("leaves an invalid selector to the stale-selector check", () => {
    expect(measure(["main a["]).matches["main a["]).toBeNull();
  });
});

describe("screenshot parity: the guard measures exactly the nodes it hides", () => {
  it("queries each selector once, and remeasures the same nodes after the page changes what the selector matches", () => {
    const main = document.querySelector("main")!;
    main.insertAdjacentHTML("beforeend", '<p class="full" style="width: 1440px; height: 1000px;" data-w="1440" data-h="1000">full</p>');
    const selector = 'main p[style="width: 1440px; height: 1000px;"]';
    const spy = vi.spyOn(document, "querySelectorAll");
    try {
      const first = guard.hideAndMeasure([], [selector]);
      expect(spy.mock.calls.filter(([s]) => s === selector)).toHaveLength(1);
      expect(first.hidden[selector]).toBe(1);
      const p = main.querySelector("p.full") as HTMLElement;
      expect(p.style.visibility).toBe("hidden");
      // Hiding changed the style attribute: a fresh query would now find nothing.
      expect(document.querySelectorAll(selector)).toHaveLength(0);
      spy.mockClear();

      const later = guard.remeasure();
      expect(spy).not.toHaveBeenCalled();
      expect(later.matches[selector]).toHaveLength(1);
      const entry = { id: "full-style", pairs: [], widths: [], browsers: [], selectors: [selector], reason: "probe" };
      for (const measured of [first.guard, later]) {
        expect(guardProblems([entry], measured, "new /fixture").join(" | ")).toMatch(/matches <p> 1440x1000 px, refused by the runtime guard: it is 1440 px wide/);
      }
    } finally {
      spy.mockRestore();
      main.querySelector("p.full")?.remove();
    }
  });

  it("is not fooled by a script that removes the probe attribute after hiding", () => {
    const main = document.querySelector("main")!;
    main.insertAdjacentHTML("beforeend", '<p class="mutating" data-probe="x" data-w="900" data-h="100">mutating</p>');
    const selector = "main p[data-probe]";
    const result = guard.hideAndMeasure([], [selector]);
    main.querySelector("p.mutating")!.removeAttribute("data-probe");
    const later = guard.remeasure();
    const entry = { id: "mutating", pairs: [], widths: [], browsers: [], selectors: [selector], reason: "probe" };
    expect(result.hidden[selector]).toBe(1);
    expect(later.matches[selector]).toHaveLength(1);
    expect(guardProblems([entry], later, "new /fixture").join(" | ")).toMatch(/it is 900 px wide \(limit 800\)/);
    main.querySelector("p.mutating")!.remove();
  });

  it("makes a hidden node that leaves the page an error", () => {
    const main = document.querySelector("main")!;
    main.insertAdjacentHTML("beforeend", '<a class="leaving" href="/x" data-w="80" data-h="20">leaving</a>');
    guard.hideAndMeasure([], ["main a.leaving"]);
    main.querySelector("a.leaving")!.remove();
    const later = guard.remeasure();
    expect(later.removed).toBe(1);
    expect(guardProblems([], later, "new /fixture")).toEqual(["register entry guard on new /fixture: 1 hidden element(s) left the page after hiding, so the capture is not stable"]);
  });
});

describe("screenshot parity: the guard bounds what hiding removes", () => {
  it("measures the painted extent (text and descendants), not only the element's own box", () => {
    const [painted] = measure(["main p.painted"]).matches["main p.painted"]!;
    expect([painted.width, painted.height]).toEqual([1385, 600]);
    expect(verdict("main p.painted").message).toMatch(/matches <p> 1385x600 px, refused by the runtime guard: it is 1385 px wide \(limit 800\); it is 600 px tall \(limit 120\)/);
  });

  it("refuses a display: contents element that holds text", () => {
    expect(verdict("main p.contents").message).toMatch(/it has no box of its own \(display: contents\), so its size does not bound what it hides/);
    expect(verdict("main p.contents").message).toMatch(/1385x1000 px/);
  });

  it("refuses a display: none element that holds text, and an element holding a display: contents descendant", () => {
    expect(verdict("main p.gone").message).toMatch(/it has no box of its own \(display: none\)/);
    expect(verdict("main span.holder").message).toMatch(/it has no box of its own \(a display: contents descendant\)/);
  });

  it("accepts an element whose display: contents descendant is empty", () => {
    expect(verdict("main span.hollow")).toEqual({ layer: "accepted", message: "" });
  });
});

describe("screenshot parity: the total cap and the entry maximum", () => {
  it("is the stated constant", () => {
    expect([GUARD_MAX_TOTAL_SHARE, MAX_REGISTER_ENTRIES]).toEqual([0.15, 10]);
  });

  it("counts overlapping boxes once", () => {
    expect(unionArea([{ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 }])).toBe(175);
  });

  it("refuses 13 entries that each pass but together hide most of the page", () => {
    // Codex's case: 13 entries of 4 small anchors each, 52 boxes of 240x110 on a 1440x1000 page.
    const page = { width: 1440, height: 1000 };
    const entries = Array.from({ length: 13 }, (_, e) => ({ id: "group-" + e, pairs: [], widths: [], browsers: [], selectors: ["main a.g" + e], reason: "probe" }));
    const matches: Measured["matches"] = {};
    entries.forEach((entry, e) => {
      matches[entry.selectors[0]] = Array.from({ length: 4 }, (_, i) => {
        const n = e * 4 + i;
        return { tag: "a", boxless: null, landmark: false, descendants: 0, x: (n % 6) * 240, y: Math.floor(n / 6) * 110, width: 240, height: 110 };
      });
    });
    const problems = guardProblems(entries, { page, matches, removed: 0 }, "new /chained");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^register entry total on new \/chained: the entries together hide 95\.33% of the page, refused by the runtime guard \(limit 15\.00%\)$/);
  });

  it("accepts the five committed selectors together on the fixture", () => {
    const selectors = [
      "footer.footer .footer-cols > .footer-col:nth-child(2) a",
      "footer.footer .footer-contact a[href^=\"mailto:\"]",
      "footer.footer .footer-bottom > span:first-child",
      "footer.footer .footer-cols > .footer-col:nth-child(1) a",
      "main a[href^=\"mailto:sales@\"]",
    ];
    const entries = selectors.map((selector, i) => ({ id: "approved-" + i, pairs: [], widths: [], browsers: [], selectors: [selector], reason: "probe" }));
    expect(guardProblems(entries, measure(selectors), "new /fixture")).toEqual([]);
  });

  it("refuses a register with more than the maximum number of entries", () => {
    const entry = (i: number) => ({ id: "e" + i, pairs: [{ old: "/a.html", new: "/a" }], widths: [1440], browsers: ["chromium"], selectors: ["footer.footer a.e" + i], reason: "Decided." });
    const raw = (n: number) => JSON.stringify({ differences: Array.from({ length: n }, (_, i) => entry(i)) });
    expect(() => readRegister(raw(MAX_REGISTER_ENTRIES))).not.toThrow();
    expect(() => readRegister(raw(MAX_REGISTER_ENTRIES + 1))).toThrow(/has 11 entries; at most 10 are allowed\. Raising the limit is a code change\./);
  });
});

describe("screenshot parity: Codex's 52 selectors (codex-check-pr-21-fix.md)", () => {
  const padded = "html > :is(body)" + ":not(.codex-absent)".repeat(300);
  const table: [string, "static" | "accepted"][] = [
    ["body", "static"], ["html", "static"], [":root", "static"], ["*", "static"], ["main", "static"], ["footer", "static"],
    ["footer.footer", "static"], [".footer", "static"], ["header", "static"], ["nav", "static"], ["#__next", "static"],
    ["html > body", "static"], ["body > *", "static"], ["body > footer.footer", "static"], ["body footer", "static"],
    ["footer.footer a, body", "static"], ["BODY", "static"], ["Footer.Footer", "static"], [" BODY \n", "static"],
    ["html \n > \n body", "static"], [":is(body)", "static"], [":where(footer)", "static"], [":not(.x)", "static"],
    ["html:not(.x)", "static"], ["body[class]", "static"], ["body:first-child", "static"], ["*:first-child", "static"],
    ["main[id]", "static"], ["[class]", "static"], ["footer.footer > *", "static"], ["footer.footer *", "static"],
    ["html > :is(body)", "static"], ["body > :where(main)", "static"], ["body > :is(main, footer)", "static"],
    [":is(html, body):first-child", "static"], [":not(.x):first-child", "static"], ["[class]:first-child", "static"],
    ["html > [class]", "static"], ["footer.footer > :is(*)", "static"], ["footer.footer :where(*)", "static"],
    ["main > section", "static"], ["section[id]", "static"], ["main > div", "static"], ["html > \\62 ody", "static"],
    ["b\\6f dy[class]", "static"], ["body > .f\\6f oter", "static"], ["body > :is(.footer)", "static"],
    ["body > :is(#__next)", "static"], ["body > :not(.codex-nothing)", "static"],
    ["footer.footer a[href=\"text,with,comma\"]", "static"],
    ["footer.footer .footer-cols > .footer-col:nth-child(2) a", "accepted"],
    [padded, "static"],
  ];

  it("lists all 52", () => {
    expect(table).toHaveLength(52);
  });

  it.each(table)("%j is %s", (selector, layer) => {
    const result = verdict(selector);
    expect(result.layer).toBe(layer);
    if (layer !== "accepted") expect(result.message).not.toBe("");
  });

  // Without the static line, the guard alone still refuses each one on the page: it
  // hides something too big, or it hides nothing, which staleSelectors makes an error.
  it.each(table)("%j is refused by the runtime guard alone, unless approved", (selector, layer) => {
    const entry = { id: "probe", pairs: [], widths: [], browsers: [], selectors: [selector], reason: "probe" };
    const measured = measure([selector]);
    const matched = measured.matches[selector];
    const refused = matched === null || matched.length === 0 || guardProblems([entry], measured, "new /fixture").length > 0;
    expect(refused).toBe(layer !== "accepted");
  });
});
