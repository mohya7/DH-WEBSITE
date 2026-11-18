/*
 * ADM-07 part 3: the build reports every redirect whose target has no page in out/.
 *
 * The rule is the API's (RedirectTargets): a target resolves when its address, with
 * trailing slashes removed, is a page the build wrote. Error pages, .html spellings,
 * other cases and media do not count. The lookup is in the walked file list, so it
 * answers the same on a case-insensitive file system.
 *
 * The module is imported as a namespace and the function read through a cast, so this
 * file typechecks before the function exists and fails on an assertion instead.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as output from "../scripts/check-output";
import type { Redirect } from "../src/content/build-content";
import { tempDir } from "./helpers";

type Report = (outDir: string, redirects: readonly Redirect[]) => string[];

function report(): Report {
  const candidate = (output as unknown as { redirectTargetReport?: unknown }).redirectTargetReport;
  expect(typeof candidate, "check-output.ts exports redirectTargetReport").toBe("function");
  return candidate as Report;
}

function build(files: string[]): string {
  const out = tempDir("redirect-targets");
  for (const name of files) {
    fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
    fs.writeFileSync(path.join(out, name), "x");
  }
  return out;
}

const redirect = (fromPath: string, toPath: string): Redirect => ({ fromPath, toPath, statusCode: 301 });

describe("redirect target report", () => {
  it("reports a redirect whose target has no page", () => {
    const out = build(["index.html", "about.html"]);
    expect(report()(out, [redirect("/a", "/about"), redirect("/b", "/missing")])).toEqual([
      "Redirect /b -> /missing: no page in the build answers at /missing.",
    ]);
  });

  it("a trailing slash, the home page and the fixed pages resolve", () => {
    const out = build(["index.html", "about.html", "privacy-careers.html"]);
    expect(report()(out, [redirect("/c", "/about/"), redirect("/d", "/"), redirect("/e", "/privacy-careers")])).toEqual([]);
  });

  it("error pages, html spellings, upper case and media do not count", () => {
    const out = build(["index.html", "404.html", "500.html", "about.html", "media/x.webp"]);
    const targets = ["/404", "/500", "/about.html", "/About", "/media/x.webp"];
    const lines = report()(out, targets.map((to, index) => redirect(`/f${index}`, to)));
    expect(lines).toEqual(targets.map((to, index) => `Redirect /f${index} -> ${to}: no page in the build answers at ${to}.`));
  });

  it("no redirects, no lines", () => {
    const out = build(["index.html"]);
    expect(report()(out, [])).toEqual([]);
  });
});
