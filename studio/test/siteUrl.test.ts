import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSiteUrl } from "../src/content/siteUrl";

describe("VITE_PUBLIC_SITE_URL (Phase C, 9.2)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is required: missing or blank fails with a clear error", () => {
    for (const value of [undefined, "", "   "]) {
      expect(() => parseSiteUrl(value)).toThrow("VITE_PUBLIC_SITE_URL is not set. Set it to the public website's address for this environment");
    }
  });

  it("uses a valid absolute http(s) URL, without a trailing slash", () => {
    expect(parseSiteUrl("https://www.digitalhub.com.eg")).toBe("https://www.digitalhub.com.eg");
    expect(parseSiteUrl("https://www.digitalhub.com.eg/")).toBe("https://www.digitalhub.com.eg");
    expect(parseSiteUrl(" http://127.0.0.1:4280 ")).toBe("http://127.0.0.1:4280");
    expect(parseSiteUrl("https://staging.example.com/site/")).toBe("https://staging.example.com/site");
  });

  it("refuses anything that is not an absolute http(s) URL", () => {
    for (const value of ["www.digitalhub.com.eg", "/relative", "ftp://example.com", "javascript:alert(1)", "mailto:a@b.c", "not a url"]) {
      expect(() => parseSiteUrl(value), value).toThrow("VITE_PUBLIC_SITE_URL must be an absolute http(s) URL");
    }
  });

  it("refuses credentials, a query, or a fragment", () => {
    for (const value of ["https://user:pass@example.com", "https://example.com/?a=1", "https://example.com/#top"]) {
      expect(() => parseSiteUrl(value), value).toThrow("VITE_PUBLIC_SITE_URL must be the website's address only");
    }
  });

  it("is read when the Studio loads: no value, no Studio, and no fallback address", async () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    await expect(import("../src/content/model")).rejects.toThrow("VITE_PUBLIC_SITE_URL is not set");
    vi.resetModules();
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "notaurl");
    await expect(import("../src/content/model")).rejects.toThrow("must be an absolute http(s) URL");
    vi.resetModules();
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://www.digitalhub.com.eg/");
    const model = await import("../src/content/model");
    expect(model.websiteOrigin).toBe("https://www.digitalhub.com.eg");
  });
});
