/*
 * ADM-02: checkContent runs the build's schema, media and redirect checks on any
 * content, so content the Content API accepted can be fed to them. These tests
 * show it passes good content and reports each ADM-02 case the build stops on.
 */
import { describe, expect, it } from "vitest";
import type { BuildContent } from "../src/content/build-content";
import { checkContent } from "../src/content/check-content";
import type { Reference } from "../src/content/generated/schema-types";
import { createSite } from "../src/content/site";
import { snapshotContent } from "./helpers";

type Json = Record<string, unknown>;

/** The first object under `value` that holds `key` as an object or string, depth first. */
function findHolder(value: unknown, key: string, test: (held: unknown) => boolean): Json | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findHolder(entry, key, test);
      if (found) return found;
    }
    return undefined;
  }
  if (value !== null && typeof value === "object") {
    const object = value as Json;
    if (key in object && test(object[key])) return object;
    for (const entry of Object.values(object)) {
      const found = findHolder(entry, key, test);
      if (found) return found;
    }
  }
  return undefined;
}

function sectionOfType(content: BuildContent, type: string): Json {
  for (const page of content.pages) {
    const section = page.sections.find((candidate) => candidate.type === type);
    if (section) return section.fields as Json;
  }
  throw new Error(`The snapshot has no ${type} section.`);
}

describe("checkContent", () => {
  it("passes the committed snapshot", () => {
    expect(checkContent(snapshotContent())).toEqual([]);
  });

  it("refuses two redirects that differ by a trailing slash", () => {
    const content = snapshotContent();
    content.redirects = [
      { fromPath: "/x", toPath: "/", statusCode: 301 },
      { fromPath: "/x/", toPath: "/about", statusCode: 301 },
    ];
    expect(checkContent(content)).toContain("Two redirects start at /x/.");
  });

  it("refuses a section reference id that is not a uuid", () => {
    const content = snapshotContent();
    const holder = findHolder(sectionOfType(content, "case_cards"), "reference", (held) => held !== null && typeof held === "object");
    if (!holder) throw new Error("The snapshot's case_cards section has no reference.");
    (holder.reference as Json).id = "not-a-uuid";
    const problems = checkContent(content);
    expect(problems.some((line) => line.includes('must match format "uuid"'))).toBe(true);
  });

  it("stops on an upper-case media id", () => {
    const content = snapshotContent();
    const holder = findHolder(content.pages, "mediaId", (held) => typeof held === "string" && held !== "");
    if (!holder) throw new Error("The snapshot's pages use no media.");
    const upper = (holder.mediaId as string).toUpperCase();
    expect(upper).not.toBe(holder.mediaId);
    holder.mediaId = upper;
    expect(checkContent(content)).toContain(`Media ${upper} is used by published content but is not in the media list.`);
  });

  it("drops an upper-case reference without a problem line", () => {
    // A characterisation, not a website rule to keep: it records why the API refuses upper case (ADM-02 B7).
    const content = snapshotContent();
    const holder = findHolder(content.pages, "reference", (held) => held !== null && typeof held === "object");
    if (!holder) throw new Error("The snapshot's pages hold no reference.");
    const reference = holder.reference as Pick<Reference, "type" | "id">;
    expect(createSite(snapshotContent()).resolve(reference)).not.toBeNull();
    reference.id = reference.id.toUpperCase();
    expect(checkContent(content)).toEqual([]);
    expect(createSite(content).resolve(reference)).toBeNull();
  });
});
