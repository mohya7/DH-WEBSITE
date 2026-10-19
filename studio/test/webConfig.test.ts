import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* The Studio's production headers on IIS (finding M4): public/web.config, which Vite copies into dist/. */
const config = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "web.config"), "utf8");

function headers(xml: string): Map<string, string> {
  const block = /<customHeaders>([\s\S]*?)<\/customHeaders>/.exec(xml)?.[1] ?? "";
  return new Map([...block.matchAll(/<add name="([^"]+)" value="([^"]*)" \/>/g)].map((match) => [match[1], match[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&")]));
}

function directives(policy: string): Map<string, string[]> {
  return new Map(policy.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...values] = part.split(/\s+/);
    return [name, values];
  }));
}

describe("Studio web.config", () => {
  const sent = headers(config);
  const csp = directives(sent.get("Content-Security-Policy") ?? "");

  it("sends nosniff, a referrer policy, and refuses framing both ways", () => {
    expect(sent.get("X-Content-Type-Options")).toBe("nosniff");
    expect(sent.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(sent.get("X-Frame-Options")).toBe("DENY");
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("has the content security policy the review asked for", () => {
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("script-src")).toEqual(["'self'"]);
    expect(csp.get("connect-src")).toEqual(["'self'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
  });

  it("allows the draft preview: a same-origin srcdoc frame and the website's two stylesheet and font hosts", () => {
    expect(csp.get("frame-src")).toEqual(["'self'"]);
    expect(csp.get("child-src")).toEqual(["'self'"]);
    expect(csp.get("style-src")).toEqual(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"]);
    expect(csp.get("font-src")).toEqual(["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"]);
  });

  it("never allows script from anywhere but the Studio itself", () => {
    const policy = sent.get("Content-Security-Policy")!;
    expect(policy).not.toContain("unsafe-eval");
    expect(csp.get("script-src")!.join(" ")).not.toContain("unsafe-inline");
    expect(csp.get("script-src")!.join(" ")).not.toContain("http");
  });

  it("keeps its rules off the API application, and routes client paths to index.html", () => {
    expect(config).toContain('<location path="." inheritInChildApplications="false">');
    expect(config).toContain('<action type="Rewrite" url="/index.html" />');
    expect(config).toContain('matchType="IsFile" negate="true"');
  });

  it("sends /api/... and uploaded files to the API, but keeps /media itself, the media library screen, in the Studio", () => {
    const pattern = /<add input="\{REQUEST_URI\}" pattern="([^"]+)" negate="true" \/>/.exec(config)?.[1];
    expect(pattern).toBeDefined();
    const toApi = new RegExp(pattern!);
    for (const uri of ["/api", "/api/v1/pages", "/media/abc.webp", "/media/abc-w640.webp?v=1"]) expect(toApi.test(uri), uri).toBe(true);
    for (const uri of ["/", "/media", "/media/", "/media?page=2", "/pages/123", "/apis", "/settings"]) expect(toApi.test(uri), uri).toBe(false);
  });

  it("caches hashed files for a year and revalidates index.html", () => {
    for (const folder of ["assets", "website-design"]) {
      const block = new RegExp(`<location path="${folder}"[\\s\\S]*?</location>`).exec(config)?.[0] ?? "";
      expect(block).toContain('cacheControlMaxAge="365.00:00:00"');
      expect(block).toContain('cacheControlCustom="immutable"');
    }
    expect(/<location path="index.html"[\s\S]*?<\/location>/.exec(config)?.[0]).toContain('cacheControlMode="DisableCache"');
  });

  it("is the file the build ships", () => {
    const vite = fs.readFileSync(path.join(import.meta.dirname, "..", "vite.config.ts"), "utf8");
    // Vite copies public/ into dist/ unless publicDir is changed.
    expect(vite).not.toMatch(/publicDir\s*:/);
  });
});
