import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "../scripts/generate-schema-types";
import type { HeroFields, Section, ServicesFields } from "../src/content/generated/schema-types";
import { sectionTypes } from "../src/content/generated/schema-types";
import { validateContent } from "../src/content/validate";
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
      JSON.stringify({ $id: "https://digitalhub.local/sections/odd", type: "object", additionalProperties: false, properties: { code: { type: "string", pattern: "^[A-Z]+$" } } }),
    );
    expect(() => generate({ sections, collections })).toThrow(/unsupported keyword "pattern"/);
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
    expect(validateContent(content).join("\n")).toMatch(/Collection "blog-posts" has 2 items but the content says 3/);
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
