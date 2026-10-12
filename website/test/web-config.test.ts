import { describe, expect, it } from "vitest";
import type { Redirect } from "../src/content/build-content";
import { WebConfigError, contentSecurityPolicy, homeContentSecurityPolicy, renderWebConfig } from "../src/iis/web-config";
import { careersEndpointError } from "../src/iis/careers-endpoint";
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
    expect(xml).not.toContain('redirectType="Found"');
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
    const directive = (policy: string, name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
    expect(directive(contentSecurityPolicy, "script-src")).toBe(
      "script-src 'self' https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js https://cdn.jsdelivr.net/gh/studio-freight/lenis@1.0.23/bundled/lenis.min.js",
    );
    expect(directive(contentSecurityPolicy, "style-src")).toBe(
      "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css",
    );
    expect(directive(contentSecurityPolicy, "style-src")).not.toContain("unsafe-inline");
    expect(directive(contentSecurityPolicy, "font-src")).toBe(
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/",
    );
    for (const name of ["script-src", "style-src", "font-src"]) {
      expect(directive(contentSecurityPolicy, name)).not.toMatch(/https:\/\/cdn\.jsdelivr\.net(?:\s|;|$)/);
    }
    expect(directive(contentSecurityPolicy, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
    expect(directive(homeContentSecurityPolicy, "style-src")).toContain("'unsafe-inline'");
    expect(directive(homeContentSecurityPolicy, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
    expect(xml).toContain(`<location path="index.html">`);
    expect(xml).toContain(`value="${homeContentSecurityPolicy}"`);
    expect(rule(xml, "Home page inline style elements")).toContain(`value="${homeContentSecurityPolicy}"`);
    expect(xml).toContain('<preCondition name="IsHome">');
    expect(xml).toContain('<add input="{URL}" pattern="^/$" />');
    expect(xml).toContain('name="Strict-Transport-Security" value="max-age=31536000"');
    expect(xml).not.toContain("includeSubDomains");
    expect(xml).toContain('name="X-Content-Type-Options" value="nosniff"');
    expect(xml).toContain('name="Referrer-Policy" value="strict-origin-when-cross-origin"');
    expect(xml).toContain('name="X-Frame-Options" value="DENY"');
  });

  it("caches the design folder and media for a year, and keeps HTML short", () => {
    const xml = renderWebConfig([]);
    expect(xml).toContain('name="Cache-Control" value="public, max-age=0, must-revalidate"');
    for (const folder of ["design", "media"]) {
      const location = xml.slice(xml.indexOf(`<location path="${folder}">`), xml.indexOf("</location>", xml.indexOf(`<location path="${folder}">`)));
      expect(location).toContain('name="Cache-Control" value="public, max-age=31536000, immutable"');
    }
  });

  it("declares the webp MIME type, removing any mapping the server already has", () => {
    const xml = renderWebConfig([]);
    const block = xml.slice(xml.indexOf("<staticContent>"), xml.indexOf("</staticContent>"));
    expect(block.indexOf('<remove fileExtension=".webp" />')).toBeLessThan(block.indexOf('<mimeMap fileExtension=".webp" mimeType="image/webp" />'));
    expect(block).toContain('<mimeMap fileExtension=".xml" mimeType="application/xml" />');
    expect(block).toContain('<mimeMap fileExtension=".txt" mimeType="text/plain" />');
  });

  it("allows a page's JSON-LD script by its hash, and leaves the policy unchanged when there are none", () => {
    const plain = renderWebConfig([]);
    expect(plain).toContain(contentSecurityPolicy);
    const xml = renderWebConfig([], { home: ["homehash"], pages: ["pagehash"] });
    const home = xml.slice(xml.indexOf('<location path="index.html">'));
    expect(home).toContain("'sha256-homehash'");
    expect(home).not.toContain("pagehash");
    expect(xml.slice(0, xml.indexOf('<location path="index.html">'))).toContain("'sha256-pagehash'");
  });

  it("does not route to the API or the hiring system", () => {
    const xml = renderWebConfig([redirect("/old", "/new")]);
    expect(xml).not.toMatch(/type="Proxy"|<proxy|reverseProxy|applicationRequestRouting/i);
    expect(xml).not.toMatch(/url="[^"]*\/api/);
    expect(xml).not.toContain("hiring");
  });

  it("serves a path that is both a page and a folder, without redirecting to the folder", () => {
    const xml = renderWebConfig([]);
    const site = {
      files: new Set(["blogs.html", "blogs/post.html", "careers.html", "cases.html", "partners.html", "services/ai.html", "design/hash/a.css", "media/abc.webp", "index.html", "404.html"]),
      dirs: new Set(["blogs", "careers", "cases", "partners", "services", "design", "media"]),
    };
    for (const path of ["blogs", "careers", "cases", "partners"]) {
      expect(outcome(xml, site, path)).toEqual({ kind: "rewrite", url: `${path}.html` });
      expect(outcome(xml, site, `${path}/`)).toEqual({ kind: "rewrite", url: `${path}.html` });
    }
    expect(outcome(xml, site, "blogs/post")).toEqual({ kind: "rewrite", url: "blogs/post.html" });
    expect(outcome(xml, site, "services")).toEqual({ kind: "status", status: 404 });
    expect(outcome(xml, site, "services/")).toEqual({ kind: "status", status: 404 });
    expect(outcome(xml, site, "design")).toEqual({ kind: "status", status: 404 });
    expect(outcome(xml, site, "media")).toEqual({ kind: "status", status: 404 });
    expect(outcome(xml, site, "services/ai")).toEqual({ kind: "rewrite", url: "services/ai.html" });
    expect(outcome(xml, site, "design/hash/a.css")).toEqual({ kind: "file", url: "design/hash/a.css" });
    expect(outcome(xml, site, "media/abc.webp")).toEqual({ kind: "file", url: "media/abc.webp" });
    expect(outcome(xml, site, "")).toEqual({ kind: "file", url: "index.html" });
    expect(rule(xml, "Clean URLs")).not.toContain("IsDirectory");
    expect(rule(xml, "Clean URLs")).not.toContain("Redirect");
  });

  it("rejects an absolute careers endpoint and accepts a same-site path", () => {
    expect(careersEndpointError("https://hiring.example/api/careers/applications")).toMatch(/absolute URL/);
    expect(careersEndpointError("//hiring.example/api")).toMatch(/absolute URL/);
    expect(careersEndpointError("/api/careers/applications")).toBeNull();
    expect(careersEndpointError("")).toBeNull();
  });

  it("rejects a careers endpoint that resolves to another origin, or hides a backslash", () => {
    for (const endpoint of [
      "/\\hiring.example/x",
      "/\\\\hiring.example/x",
      "/%5Chiring.example/x",
      "//hiring.example/x",
      "https://hiring.example/x",
      "/x\ny",
    ]) {
      expect(careersEndpointError(endpoint), endpoint).not.toBeNull();
    }
    expect(careersEndpointError("https://hiring.example/x")).toMatch(/absolute URL/);
    expect(careersEndpointError("//hiring.example/x")).toMatch(/absolute URL/);
    expect(careersEndpointError("/\\hiring.example/x")).toMatch(/absolute URL/);
    expect(careersEndpointError("/api/careers/applications")).toBeNull();
  });

  it("builds a config with no redirect rules when the table is empty, as in the snapshot", () => {
    const xml = renderWebConfig(snapshotContent().redirects);
    expect(snapshotContent().redirects).toEqual([]);
    expect(xml).not.toContain("Redirect /");
    expect(xml).toContain('name="Clean URLs"');
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
  });
});

/**
 * What the generated rules do to one request, using the same conditions IIS
 * evaluates. A path that is a directory is not skipped when its .html file exists.
 * A directory with no page becomes a 404, not IIS's directory redirect and 403.
 */
function outcome(
  xml: string,
  site: { files: Set<string>; dirs: Set<string> },
  request: string,
): { kind: "rewrite"; url: string } | { kind: "file"; url: string } | { kind: "status"; status: number } | { kind: "iis-directory" } {
  const path = request.replace(/^\/+/, "");
  const physical = path.endsWith("/") ? path.slice(0, -1) : path;
  const rules = [...xml.matchAll(/<rule name="[^"]*"[\s\S]*?<\/rule>/g)].map((match) => match[0]);
  for (const block of rules) {
    if (block.includes('name="Clean URLs"')) {
      const matched = /^(.+?)\/?$/.exec(path);
      if (!matched) continue;
      const target = matched[1];
      if (block.includes('matchType="IsFile" negate="true"') && site.files.has(physical)) continue;
      if (block.includes('matchType="IsDirectory" negate="true"') && site.dirs.has(physical)) continue;
      if (!site.files.has(`${target}.html`)) continue;
      return { kind: "rewrite", url: `${target}.html` };
    }
    if (block.includes('type="CustomResponse"') && block.includes('statusCode="404"') && block.includes('matchType="IsDirectory"')) {
      if (physical !== "" && site.dirs.has(physical)) return { kind: "status", status: 404 };
    }
  }
  if (path === "" && xml.includes('<add value="index.html" />')) return { kind: "file", url: "index.html" };
  if (site.files.has(physical)) return { kind: "file", url: physical };
  if (site.dirs.has(physical)) return { kind: "iis-directory" };
  return { kind: "status", status: 404 };
}
