// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withWebsiteUrls } from "../src/preview/previewUrls";

/*
 * The Studio's CSP has base-uri 'none' and the srcdoc preview inherits it, so the
 * preview resolves its own links against the website instead of using <base href>.
 */
describe("preview URLs", () => {
  const site = "https://digitalhub.com.eg";

  it("resolves relative links and images against the website, as <base href> did", () => {
    const html = withWebsiteUrls(
      '<a href="/contact">Contact</a><a href="services/x">X</a><a href="#top">Top</a><img src="/images/logo.svg" srcset="/a.webp 640w, /b.webp 1024w">',
      site,
    );
    expect(html).toContain('href="https://digitalhub.com.eg/contact"');
    expect(html).toContain('href="https://digitalhub.com.eg/services/x"');
    expect(html).toContain('href="https://digitalhub.com.eg/#top"');
    expect(html).toContain('src="https://digitalhub.com.eg/images/logo.svg"');
    expect(html).toContain('srcset="https://digitalhub.com.eg/a.webp 640w, https://digitalhub.com.eg/b.webp 1024w"');
  });

  it("leaves absolute URLs alone: media on the Studio's origin, mail and phone links", () => {
    const html = withWebsiteUrls(
      '<img src="https://studio.example/media/abc.webp"><a href="mailto:hello@digitalhub.com.eg">Mail</a><a href="tel:+201000000000">Call</a><a href="https://partner.example/x">Out</a>',
      site,
    );
    expect(html).toContain('src="https://studio.example/media/abc.webp"');
    expect(html).toContain('href="mailto:hello@digitalhub.com.eg"');
    expect(html).toContain('href="tel:+201000000000"');
    expect(html).toContain('href="https://partner.example/x"');
  });

  it("the preview document sets only a link target, never a base URL", () => {
    // previewDocument.tsx needs the blocks aliases that only vite.config.ts sets up,
    // so its <base> line is checked in the source; the browser check covers the rest.
    const source = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "preview", "previewDocument.tsx"), "utf8");
    expect(source).toContain(`'<base target="_blank">'`);
    expect(source).not.toMatch(/<base[^>]*href=/);
    expect(source).toContain("withWebsiteUrls(mainHtml, websiteAddress)");
  });
});
