// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GUARD_MAX_DESCENDANTS,
  GUARD_MAX_ELEMENT_SHARE,
  GUARD_MAX_ENTRY_SHARE,
  GUARD_MAX_HEIGHT,
  GUARD_MAX_MATCHES,
  GUARD_MAX_WIDTH,
  guardProblems,
  wholeCaptureReason,
} from "../tools/screenshot-parity/diff.mjs";
import { measureMatches } from "../tools/screenshot-parity/capture.mjs";

/*
 * A tiny fixture page. jsdom has no layout, so each element states its box in
 * data-w and data-h, and getBoundingClientRect reads them. The selector
 * matching, the landmark and descendant checks, and the guard are the tool's own.
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
  <section id="chips" data-w="1440" data-h="1200">${repeat(10, '<span class="chip" data-w="720" data-h="120">chip</span>')}</section>
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

let original: typeof HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  document.body.innerHTML = fixture;
  document.documentElement.setAttribute("data-w", String(PAGE.width));
  document.documentElement.setAttribute("data-h", String(PAGE.height));
  document.body.setAttribute("data-w", String(PAGE.width));
  document.body.setAttribute("data-h", String(PAGE.height));
  original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const width = Number(this.getAttribute("data-w") ?? 0);
    const height = Number(this.getAttribute("data-h") ?? 0);
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) } as DOMRect;
  };
  for (const el of [document.documentElement, document.body]) {
    Object.defineProperty(el, "scrollWidth", { configurable: true, value: PAGE.width });
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: PAGE.height });
  }
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
});

/** Both layers, as the tool applies them: the static check when the register is read, the guard on the page. */
function verdict(selector: string): { layer: "static" | "runtime" | "accepted"; message: string } {
  const reason = wholeCaptureReason(selector);
  if (reason) return { layer: "static", message: reason };
  const entry = { id: "probe", pairs: [], widths: [], browsers: [], selectors: [selector], reason: "probe" };
  const problems = guardProblems([entry], measureMatches({ selectors: [selector] }), "new /fixture");
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
    expect(measureMatches({ selectors: ["footer.footer .footer-cols > .footer-col:nth-child(2) a"] }).matches["footer.footer .footer-cols > .footer-col:nth-child(2) a"]).toHaveLength(4);
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
    expect(verdict("main span.chip").message).toBe("register entry probe on new /fixture hides 20.00% of the page, refused by the runtime guard (limit 8.00%)");
  });

  it("refuses <html> and <body> if a selector ever reaches them", () => {
    const entry = { id: "probe", pairs: [], widths: [], browsers: [], selectors: ["html", "body"], reason: "probe" };
    const problems = guardProblems([entry], measureMatches({ selectors: ["html", "body"] }), "old /fixture");
    expect(problems[0]).toMatch(/"html" on old \/fixture matches <html> 1440x3000 px, refused by the runtime guard: it is <html>; it is or contains a main, header, nav, or footer element; it has \d+ descendant elements/);
    expect(problems[1]).toMatch(/"body" on old \/fixture matches <body> 1440x3000 px, refused by the runtime guard: it is <body>/);
  });

  it("leaves an invalid selector to the stale-selector check", () => {
    expect(measureMatches({ selectors: ["main a["] }).matches["main a["]).toBeNull();
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
    const measured = measureMatches({ selectors: [selector] });
    const matched = measured.matches[selector];
    const refused = matched === null || matched.length === 0 || guardProblems([entry], measured, "new /fixture").length > 0;
    expect(refused).toBe(layer !== "accepted");
  });
});
