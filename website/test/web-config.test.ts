import { describe, expect, it } from "vitest";
import type { Redirect } from "../src/content/build-content";
import { WebConfigError, contentSecurityPolicy, renderWebConfig } from "../src/iis/web-config";
import { snapshotContent } from "./helpers";

const redirect = (fromPath: string, toPath: string, statusCode = 301): Redirect => ({ fromPath, toPath, statusCode });

function rule(xml: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = xml.match(new RegExp(`<rule name="${escaped}"[\\s\\S]*?</rule>`));
  if (!found) throw new Error(`no rule named ${name}`);
  return found[0];
}

describe("web.config", () => {
  it("rewrites a clean URL to its html file only when that file exists, and serves / as index.html", () => {
    const xml = renderWebConfig([]);
    const clean = rule(xml, "Clean URLs");
    expect(clean).toContain('stopProcessing="true"');
    expect(clean).toContain('<match url="^(.+?)/?$" ignoreCase="false" />');
    expect(clean).toContain('<add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />');
    expect(clean).toContain('<add input="{DOCUMENT_ROOT}/{R:1}.html" matchType="IsFile" />');
    expect(clean).toContain('<action type="Rewrite" url="{R:1}.html" />');
    expect(xml).toContain('<add value="index.html" />');
    expect(xml).not.toMatch(/<action type="Rewrite" url="[^"]*index\.html"/);
  });

  it("writes every redirect as a 301, ahead of the clean-URL rewrite, and ignores a stored 302", () => {
    const xml = renderWebConfig([
      redirect("/services/old-name", "/services/ai", 302),
      redirect("/a.b", "/about"),
      redirect("/old&gone", "/new&next"),
    ]);
    const first = rule(xml, "Redirect /a.b");
    expect(first).toContain('<match url="^a\\.b/?$" ignoreCase="false" />');
    expect(first).toContain('<action type="Redirect" url="/about" redirectType="Permanent" appendQueryString="false" />');
    expect(xml).not.toContain("302");
    expect(xml).not.toContain("Found");
    expect(xml.indexOf("Redirect /a.b")).toBeLessThan(xml.indexOf("Redirect /old&amp;gone"));
    expect(xml.indexOf("Redirect /old&amp;gone")).toBeLessThan(xml.indexOf('name="Clean URLs"'));
    const escaped = rule(xml, "Redirect /old&amp;gone");
    expect(escaped).toContain('<match url="^old&amp;gone/?$"');
    expect(escaped).toContain('url="/new&amp;next"');
    expect(rule(xml, "Redirect /services/old-name")).toContain('url="/services/ai"');
  });

  it("treats a trailing slash on the stored path as the same redirect", () => {
    const xml = renderWebConfig([redirect("/old/", "/new")]);
    expect(rule(xml, "Redirect /old/")).toContain('<match url="^old/?$"');
  });

  it("refuses a path that is not a same-site path, and a duplicate source", () => {
    expect(() => renderWebConfig([redirect("old", "/new")])).toThrow(WebConfigError);
    expect(() => renderWebConfig([redirect("/../secret", "/new")])).toThrow(/cannot be written/);
    expect(() => renderWebConfig([redirect("//evil.example", "/new")])).toThrow(/cannot be written/);
    expect(() => renderWebConfig([redirect("/old?x=1", "/new")])).toThrow(/cannot be written/);
    expect(() => renderWebConfig([redirect("/old", "/new"), redirect("/old/", "/other")])).toThrow(/Two redirects start at/);
  });

  it("returns the custom 404 and 500 pages with the status that triggered them", () => {
    const xml = renderWebConfig([]);
    expect(xml).toContain('<httpErrors errorMode="Custom" existingResponse="Replace">');
    expect(xml).toContain('<error statusCode="404" path="/404.html" responseMode="ExecuteURL" />');
    expect(xml).toContain('<error statusCode="500" path="/500.html" responseMode="ExecuteURL" />');
    expect(xml).not.toContain('responseMode="Redirect"');
    expect(xml).not.toContain('responseMode="File"');
  });

  it("sends the security headers, with the content security policy in report-only mode", () => {
    const xml = renderWebConfig([]);
    expect(xml).toContain(`name="Content-Security-Policy-Report-Only" value="${contentSecurityPolicy}"`);
    expect(xml).not.toContain('name="Content-Security-Policy"');
    expect(contentSecurityPolicy).toContain("https://cdn.jsdelivr.net");
    expect(contentSecurityPolicy).toContain("https://fonts.googleapis.com");
    expect(contentSecurityPolicy).toContain("https://fonts.gstatic.com");
    expect(contentSecurityPolicy).toContain("style-src-attr 'unsafe-inline'");
    expect(contentSecurityPolicy).toContain("style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net 'unsafe-inline'");
    const scriptSrc = /script-src [^;]+/.exec(contentSecurityPolicy)?.[0] ?? "";
    expect(scriptSrc).toBe("script-src 'self' https://cdn.jsdelivr.net");
    expect(xml).toContain('name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains"');
    expect(xml).toContain('name="X-Content-Type-Options" value="nosniff"');
    expect(xml).toContain('name="Referrer-Policy" value="strict-origin-when-cross-origin"');
    expect(xml).toContain('name="X-Frame-Options" value="DENY"');
  });

  it("caches the design folder for a year and keeps HTML short", () => {
    const xml = renderWebConfig([]);
    expect(xml).toContain('name="Cache-Control" value="public, max-age=0, must-revalidate"');
    expect(xml).toContain('<location path="design">');
    expect(xml).toContain('name="Cache-Control" value="public, max-age=31536000, immutable"');
    expect(xml.indexOf("max-age=31536000, immutable")).toBeGreaterThan(xml.indexOf('path="design"'));
  });

  it("does not route to the API or the hiring system", () => {
    const xml = renderWebConfig([redirect("/old", "/new")]);
    expect(xml).not.toMatch(/type="Proxy"|<proxy|reverseProxy|applicationRequestRouting/i);
    expect(xml).not.toMatch(/url="[^"]*\/api/);
    expect(xml).not.toContain("hiring");
  });

  it("builds a config with no redirect rules when the table is empty, as in the snapshot", () => {
    const xml = renderWebConfig(snapshotContent().redirects);
    expect(snapshotContent().redirects).toEqual([]);
    expect(xml).not.toContain("Redirect /");
    expect(xml).toContain('name="Clean URLs"');
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
  });
});
