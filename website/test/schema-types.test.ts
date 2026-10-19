import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "../scripts/generate-schema-types";
import type { HeroFields, Section, ServicesFields } from "../src/content/generated/schema-types";
import { sectionTypes } from "../src/content/generated/schema-types";
import { isAllowedSectionHref, validateContent } from "../src/content/validate";
import { snapshotContent, tempDir } from "./helpers";

const packagesRoot = path.resolve(process.cwd(), "..", "packages");

describe("generated schema types", () => {
  it("are up to date with packages/sections and packages/collections", () => {
    const committed = fs.readFileSync(path.join(process.cwd(), "..", "packages", "blocks", "src", "generated", "schema-types.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(generate()).toBe(committed);
  });

  it("cover every section schema — all 28", () => {
    const files = fs.readdirSync(path.join(packagesRoot, "sections")).filter((name) => name.endsWith(".json") && name !== "defs.json");
    expect([...sectionTypes].sort()).toEqual(files.map((name) => name.slice(0, -5)).sort());
    expect(sectionTypes).toHaveLength(28);
  });

  it("refuse a schema construct they do not understand", () => {
    const dir = tempDir("schemas");
    const sections = path.join(dir, "sections");
    const collections = path.join(dir, "collections");
    fs.mkdirSync(sections);
    fs.mkdirSync(collections);
    fs.copyFileSync(path.join(packagesRoot, "sections", "defs.json"), path.join(sections, "defs.json"));
    fs.writeFileSync(
      path.join(sections, "odd.json"),
      JSON.stringify({ $id: "https://digitalhub.local/sections/odd", type: "object", additionalProperties: false, properties: { code: { type: "string", minLength: 2 } } }),
    );
    expect(() => generate({ sections, collections })).toThrow(/unsupported keyword "minLength"/);
  });

  it("keep a pattern-checked string a string, and refuse a pattern on anything else", () => {
    const dir = tempDir("schemas");
    const sections = path.join(dir, "sections");
    const collections = path.join(dir, "collections");
    fs.mkdirSync(sections);
    fs.mkdirSync(collections);
    fs.copyFileSync(path.join(packagesRoot, "sections", "defs.json"), path.join(sections, "defs.json"));
    const odd = (code: object) =>
      JSON.stringify({ $id: "https://digitalhub.local/sections/odd", type: "object", additionalProperties: false, properties: { code } });
    fs.writeFileSync(path.join(sections, "odd.json"), odd({ type: ["string", "null"], pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", "x-dh-kind": "date" }));
    expect(generate({ sections, collections })).toMatch(/\/\*\* date: Calendar date, YYYY-MM-DD\. No time and no zone\. \*\/\n\s+code\?: string \| null;/);
    fs.writeFileSync(path.join(sections, "odd.json"), odd({ type: "integer", pattern: "^[0-9]+$" }));
    expect(() => generate({ sections, collections })).toThrow(/pattern on a non-string type/);
  });

  it("type a section's fields by its type", () => {
    // Compile-time checks, verified by `npm run typecheck`.
    const hero: Section = { type: "hero", fields: { heading: "Heading" } };
    // @ts-expect-error heading is required by sections/hero.json
    const missingHeading: HeroFields = { eyebrow: "x" };
    // @ts-expect-error a hero has no "items" field
    const wrongField: Section = { type: "hero", fields: { heading: "h", items: [] } };
    // @ts-expect-error references are limited to the types in defs.json
    const badReference: HeroFields = { heading: "h", logos: [{ image: { mediaId: "m", alt: "", decorative: true }, reference: { type: "vacancy", id: "x" } }] };
    const service: ServicesFields = { summary: null, featured: true };
    expect([hero, missingHeading, wrongField, badReference, service]).toHaveLength(5);
  });
});

describe("content against the schemas", () => {
  it("the snapshot passes: every section and item field matches its schema", () => {
    expect(validateContent(snapshotContent())).toEqual([]);
  });

  it("reports a section field of the wrong type", () => {
    const content = snapshotContent();
    const hero = content.pages[0].sections[0];
    (hero.fields as Record<string, unknown>).heading = 42;
    expect(validateContent(content).join("\n")).toMatch(/pages\/home: section 1 \(hero\) does not match sections\/hero\.json: \/heading must be string/);
  });

  it("refuses a section link the API would refuse (finding O1), and keeps ordinary ones", () => {
    const refused = [
      "javascript:alert(document.domain)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      " javascript:alert(1)",
      "java\nscript:alert(1)",
      "\u0001javascript:alert(1)",
      "&#106;avascript:alert(1)",
      "//evil.example/",
      "/\\evil.example",
      "file:///etc/passwd",
      "contact",
      "",
    ];
    const accepted = ["https://www.digitalhubgroup.com/", "http://example.com/page", "mailto:sales@digitalhubgroup.com", "tel:+201555553064", "/contact", "/", "#cookie-settings"];
    for (const href of refused) expect(isAllowedSectionHref(href), JSON.stringify(href)).toBe(false);
    for (const href of accepted) expect(isAllowedSectionHref(href), href).toBe(true);
  });

  it("stops the build when a published section link is javascript: or data:", () => {
    for (const href of ["javascript:alert(document.domain)", "data:text/html,<script>alert(1)</script>"]) {
      const content = snapshotContent();
      const page = content.pages.find((item) => item.sections.some((section) => typeof (section.fields as { action?: { href?: unknown } }).action?.href === "string"));
      expect(page, "the snapshot has a section with an action link").toBeDefined();
      const section = page!.sections.find((item) => typeof (item.fields as { action?: { href?: unknown } }).action?.href === "string")!;
      (section.fields as { action: { href: string } }).action.href = href;
      expect(validateContent(content).join("\n")).toMatch(/\/action\/href is not an allowed link/);
    }
  });

  it("reports a field the schema does not define", () => {
    const content = snapshotContent();
    (content.pages[0].sections[0].fields as Record<string, unknown>).subtitle = "extra";
    expect(validateContent(content).join("\n")).toMatch(/must NOT have additional properties/);
  });

  it("reports a missing required field", () => {
    const content = snapshotContent();
    delete (content.pages[0].sections[0].fields as Record<string, unknown>).heading;
    expect(validateContent(content).join("\n")).toMatch(/must have required property 'heading'/);
  });

  it("reports an unknown section type", () => {
    const content = snapshotContent();
    (content.pages[0].sections[0] as { type: string }).type = "carousel";
    expect(validateContent(content).join("\n")).toMatch(/unknown type "carousel"/);
  });

  it("reports item fields that do not match their collection", () => {
    const content = snapshotContent();
    (content.collections.services[0].fields as Record<string, unknown>).featured = "yes";
    expect(validateContent(content).join("\n")).toMatch(/services\/.*fields do not match collections\/services\.json/);
  });

  it("reports a count that does not match the items, as a truncated response would", () => {
    const content = snapshotContent();
    content.collections["blog-posts"].pop();
    expect(validateContent(content).join("\n")).toContain('Collection "blog-posts" has 2 items but the content says 3');
  });

  it("reports media used by content but missing from the media list", () => {
    const content = snapshotContent();
    const post = content.collections["blog-posts"][0];
    const missing = post.fields.imageId!;
    content.media = content.media.filter((asset) => asset.id !== missing);
    expect(validateContent(content).join("\n")).toContain(`Media ${missing} is used by published content`);
  });

  it("refuses a media path that could leave the media folder", () => {
    const content = snapshotContent();
    content.media[0].path = "/media/../../web.config";
    expect(validateContent(content).join("\n")).toMatch(/unexpected path/);
  });
});
