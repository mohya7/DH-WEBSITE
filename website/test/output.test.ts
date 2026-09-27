import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkOutput, htmlFileFor } from "../scripts/check-output";
import type { Manifest } from "../src/content/prepared";
import { tempDir } from "./helpers";

const manifest = {
  routes: [
    { path: "/", pageType: "home", collection: "pages", slug: "home" },
    { path: "/services/ai", pageType: "service", collection: "services", slug: "ai" },
  ],
} as unknown as Manifest;

const page = (body = "") =>
  `<html><head><script src="/_next/static/chunks/abc123.js" async=""></script></head><body>${body}</body></html>`;

function build(files: Record<string, string>): string {
  const out = tempDir("out");
  const all: Record<string, string> = {
    "index.html": page(),
    "services/ai.html": page('<img src="/media/x.webp" width="10" height="10" srcSet="/media/x-w640.webp 640w, /media/x.webp 900w"/>'),
    "404.html": page(),
    "500.html": page(),
    "_next/static/chunks/abc123.js": "",
    "media/x.webp": "x",
    "media/x-w640.webp": "x",
    ...files,
  };
  for (const [name, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
    fs.writeFileSync(path.join(out, name), text);
  }
  return out;
}

describe("build output checks", () => {
  it("map routes to their exported files", () => {
    expect(htmlFileFor("/")).toBe("index.html");
    expect(htmlFileFor("/services/ai")).toBe("services/ai.html");
  });

  it("pass a complete output", () => {
    const report = checkOutput(build({}), manifest);
    expect(report.problems).toEqual([]);
    expect(report.pages.map((entry) => entry.route)).toEqual(["/", "/services/ai"]);
    expect(report.images).toBe(1);
  });

  it("catch a ?v= query string on the site's own URLs, in pages and stylesheets", () => {
    const report = checkOutput(
      build({
        "index.html": page('<link rel="stylesheet" href="css/about-page.css?v=12"/><img src="/media/x.webp?v=2" width="1" height="1"/>'),
        "_next/static/chunks/site.css": ".a{background:url(/media/x.webp?v=3)}@import \"/fonts.css?a=1&v=4\";",
      }),
      manifest,
    );
    const problems = report.problems.join("\n");
    expect(problems).toMatch(/index\.html references css\/about-page\.css\?v=12/);
    expect(problems).toMatch(/index\.html references \/media\/x\.webp\?v=2/);
    expect(problems).toMatch(/site\.css references \/media\/x\.webp\?v=3/);
    expect(problems).toMatch(/site\.css references \/fonts\.css\?a=1&v=4/);
  });

  it("leave external links alone: a YouTube watch?v= link is content, not an asset", () => {
    const report = checkOutput(build({ "index.html": page('<a href="https://www.youtube.com/watch?v=abc">Video</a>') }), manifest);
    expect(report.problems).toEqual([]);
  });

  it("catch an image from another host", () => {
    const report = checkOutput(build({ "index.html": page('<img src="https://cdn.example.com/x.webp" width="1" height="1"/>') }), manifest);
    expect(report.problems.join("\n")).toMatch(/not served from the build output/);
  });

  it("catch a script loaded with a query string instead of a hashed name", () => {
    const report = checkOutput(build({ "index.html": '<script src="/_next/static/chunks/abc123.js?dpl=1"></script>' }), manifest);
    expect(report.problems.join("\n")).toMatch(/with a query string/);
  });

  it("catch a missing route and a page that is not a route", () => {
    const out = build({ "blogs/draft-post.html": page() });
    fs.rmSync(path.join(out, "services/ai.html"));
    const problems = checkOutput(out, manifest).problems.join("\n");
    expect(problems).toMatch(/Route \/services\/ai has no services\/ai\.html/);
    expect(problems).toMatch(/blogs\/draft-post\.html is not a route of the published content/);
  });

  it("catch an image file that was not copied, and an image without dimensions", () => {
    const out = build({ "index.html": page('<img src="/media/y.webp" alt=""/>') });
    const problems = checkOutput(out, manifest).problems.join("\n");
    expect(problems).toMatch(/uses \/media\/y\.webp, which is not in the output/);
    expect(problems).toMatch(/without explicit width and height/);
  });

  it("catch fixtures and prepared content in the output", () => {
    const problems = checkOutput(build({ "fixtures/snapshot/content.json": "{}", "manifest.json": "{}" }), manifest).problems.join("\n");
    expect(problems).toMatch(/fixtures\/snapshot\/content\.json should not be in the build output/);
    expect(problems).toMatch(/manifest\.json should not be in the build output/);
  });
});
