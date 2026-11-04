import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stripOutput } from "../scripts/strip-runtime";
import { removals, runtimeTracesIn, stripRuntime } from "../src/build/strip-runtime";
import { tempDir } from "./helpers";

/* The shape of a page as `next build` exports it (Next 16.3.6), trimmed. */
const exported =
  '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>' +
  '<link rel="stylesheet" href="/design/h/css/tv.css" data-precedence="design"/>' +
  '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/1inwntv0b4r-7.js"/>' +
  '<script src="/_next/static/chunks/41qfcvra0dvw4.js" async=""></script>' +
  '<script src="/_next/static/chunks/turbopack-10o2r97o993jw.js" async=""></script>' +
  '<link rel="modulepreload" href="/design/h/js/hero-fluid.js"/>' +
  '<script src="/_next/static/chunks/0cz1d0mv5g_q7.js" noModule=""></script></head>' +
  '<body><div hidden=""><!--$--><!--/$--></div><script src="/design/h/index.inline-1.js"></script>' +
  '<main><h1>Title &amp; more</h1><section data-section="hero"></section></main>' +
  '<script src="/design/h/js/nav-stay-on-page.js"></script><!--$--><!--/$-->' +
  '<script src="/_next/static/chunks/1inwntv0b4r-7.js" id="_R_" async=""></script>' +
  '<script>(self.__next_f=self.__next_f||[]).push([0])</script>' +
  '<script>self.__next_f.push([1,"1:\\"$Sreact.fragment\\"\\n2:I[1,[],\\"\\"]"])</script></body></html>';

/* The same page as `next build` exports it with Next 16.4.3 (from the branch's
   about.html before stripping), trimmed the same way. The `_R_` element is now
   an inline Turbopack bootstrap naming chunks without /_next/; copied verbatim. */
const turbopackBootstrap =
  '<script id="_R_">(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push({"otherChunks":["static/chunks/2rxg2vmc3djp4.js","static/chunks/3rwt2kk_qwk5n.js","static/chunks/3r-o8o3vf8kuq.js"],"runtimeModuleIds":[56944]});</script>';
const exported1643 =
  '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>' +
  '<link rel="stylesheet" href="/design/h/css/tv.css" data-precedence="design"/>' +
  '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/2rxg2vmc3djp4.js"/>' +
  '<script src="/_next/static/chunks/3rwt2kk_qwk5n.js" async=""></script>' +
  '<script src="/_next/static/chunks/turbopack-3-ry682tkyiqk.js" async=""></script>' +
  '<script src="/_next/static/chunks/0cz1d0mv5g_q7.js" noModule=""></script></head>' +
  '<body><div hidden=""><!--$--><!--/$--></div><script src="/design/h/index.inline-1.js"></script>' +
  '<main><h1>Title &amp; more</h1><section data-section="hero"></section></main>' +
  '<script src="/design/h/js/nav-stay-on-page.js"></script><!--$--><!--/$-->' +
  turbopackBootstrap +
  '<script src="/_next/static/chunks/2rxg2vmc3djp4.js" async=""></script>' +
  '<script>(self.__next_f=self.__next_f||[]).push([0])</script>' +
  '<script>self.__next_f.push([1,"1:\\"$Sreact.fragment\\"\\n2:\\"/_next/static/chunks/0oj_k98gemfd4.js\\"\\n"])</script></body></html>';
const unknownTurbopack = "<script>globalThis.TURBOPACK=[]</script>";

describe("stripping Next's client runtime from a page", () => {
  it("removes each part of the runtime, and nothing else", () => {
    const { html, removed } = stripRuntime(exported);
    expect(removed).toEqual({
      "runtime script tags": 4,
      "runtime preload link": 1,
      "payload scripts": 2,
      "empty metadata outlet": 1,
      "empty boundary markers": 1,
      "Turbopack bootstrap script": 0,
    });
    expect(html).toBe(
      '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>' +
        '<link rel="stylesheet" href="/design/h/css/tv.css" data-precedence="design"/>' +
        '<link rel="modulepreload" href="/design/h/js/hero-fluid.js"/></head>' +
        '<body><script src="/design/h/index.inline-1.js"></script>' +
        '<main><h1>Title &amp; more</h1><section data-section="hero"></section></main>' +
        '<script src="/design/h/js/nav-stay-on-page.js"></script></body></html>',
    );
    expect(runtimeTracesIn(html)).toEqual([]);
  });

  it("leaves the first design script first in <body>, as on the old pages", () => {
    expect(stripRuntime(exported).html).toContain('<body><script src="/design/h/index.inline-1.js">');
  });

  it("does not remove what it does not recognise, so the output check can catch it", () => {
    for (const unknown of ['<link rel="stylesheet" href="/_next/static/css/a.css"/>', "<script>self.__next_x=1</script><!--$?-->", unknownTurbopack]) {
      const { html } = stripRuntime(`<html><head>${unknown}</head><body></body></html>`);
      expect(html).toContain(unknown);
    }
    expect(runtimeTracesIn('<link rel="stylesheet" href="/_next/static/css/a.css"/>')).toEqual(["a /_next/ URL"]);
    expect(runtimeTracesIn(unknownTurbopack)).toEqual(["the Turbopack runtime"]);
  });

  it("removes Next 16.4.3's inline Turbopack bootstrap", () => {
    const { html, removed } = stripRuntime(exported1643);
    expect(removed).toEqual({
      "runtime script tags": 4,
      "Turbopack bootstrap script": 1,
      "runtime preload link": 1,
      "payload scripts": 2,
      "empty metadata outlet": 1,
      "empty boundary markers": 1,
    });
    expect(html).not.toContain('id="_R_"');
    expect(html).not.toContain("TURBOPACK");
    expect(html).toBe(
      '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>' +
        '<link rel="stylesheet" href="/design/h/css/tv.css" data-precedence="design"/></head>' +
        '<body><script src="/design/h/index.inline-1.js"></script>' +
        '<main><h1>Title &amp; more</h1><section data-section="hero"></section></main>' +
        '<script src="/design/h/js/nav-stay-on-page.js"></script></body></html>',
    );
    expect(runtimeTracesIn(html)).toEqual([]);
  });

  it("the trace check catches the Turbopack bootstrap if it is left in", () => {
    expect(runtimeTracesIn(turbopackBootstrap)).toEqual(["the Turbopack runtime", "a Next chunk path"]);
  });

  it("explains why each removal is safe", () => {
    for (const removal of removals) expect(removal.why.length, removal.name).toBeGreaterThan(40);
  });
});

describe("stripping the output folder", () => {
  function out(files: Record<string, string>): string {
    const dir = tempDir("strip");
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), text);
    }
    return dir;
  }

  it("strips every page, deletes payload files and runtime scripts, and removes emptied folders", () => {
    const dir = out({
      "index.html": exported,
      "about.html": exported,
      "about/__next.about.__PAGE__.txt": "0:{}",
      "index.txt": "0:{}",
      "_next/static/chunks/a.js": "",
      "_next/static/chunks/turbopack-b.js": "",
      "design/h/css/tv.css": "",
      "media/x.webp": "x",
    });
    const result = stripOutput(dir);
    expect(result).toMatchObject({ pages: 2, payloadFiles: 2, runtimeFiles: 2, problems: [] });
    expect(result.removed["runtime script tags"]).toBe(8);
    expect(fs.existsSync(path.join(dir, "_next"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "about"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "design/h/css/tv.css"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "media/x.webp"))).toBe(true);
    expect(runtimeTracesIn(fs.readFileSync(path.join(dir, "index.html"), "utf8"))).toEqual([]);
  });

  it("strips a Next 16.4.3 page with no problem, and names a page that keeps a Turbopack trace", () => {
    const clean = out({ "index.html": exported1643, "_next/static/chunks/2rxg2vmc3djp4.js": "" });
    const result = stripOutput(clean);
    expect(result).toMatchObject({ pages: 1, runtimeFiles: 1, problems: [] });
    expect(result.removed["Turbopack bootstrap script"]).toBe(1);
    expect(runtimeTracesIn(fs.readFileSync(path.join(clean, "index.html"), "utf8"))).toEqual([]);
    const left = out({ "careers.html": `<html><head></head><body>${unknownTurbopack}</body></html>` });
    expect(stripOutput(left).problems.join("\n")).toMatch(/careers\.html still contains the Turbopack runtime/);
  });

  it("stops when _next/ holds anything but runtime scripts, or a page keeps a trace", () => {
    const dir = out({ "index.html": '<html><head><link rel="stylesheet" href="/_next/static/css/a.css"/></head></html>', "_next/static/css/a.css": "" });
    const problems = stripOutput(dir).problems.join("\n");
    expect(problems).toMatch(/index\.html still contains a \/_next\/ URL/);
    expect(problems).toMatch(/_next\/ holds files that are not runtime scripts/);
    expect(fs.existsSync(path.join(dir, "_next/static/css/a.css"))).toBe(true);
  });
});
