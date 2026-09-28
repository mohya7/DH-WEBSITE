/*
 * Checks content against the same JSON Schemas the API validates with, before
 * anything is rendered. The generated types say what a section's fields look
 * like; this proves the content the build received actually looks like that.
 */
import fs from "node:fs";
import path from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { inlineMarksAllowed, inlineTextProblems } from "@digitalhub/blocks/inline/document";
import type { AnyContentItem, BuildContent } from "./build-content";
import { websiteRoot } from "./config";
import { collectionNames, sectionTypes } from "./generated/schema-types";
import { isSafeMediaPath } from "./media";
import { allItems } from "./routes";

const packagesRoot = path.resolve(websiteRoot, "..", "packages");

type Validators = {
  sections: Map<string, ValidateFunction>;
  collections: Map<string, ValidateFunction>;
  /** Per section type, the fields declared as inline text, directly or through defs.json. */
  inlineText: Map<string, string[]>;
};

let validators: Validators | undefined;

function readJson(file: string): object {
  return JSON.parse(fs.readFileSync(file, "utf8")) as object;
}

function loadValidators(): Validators {
  if (validators) return validators;

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addKeyword("x-dh-kind");
  ajv.addKeyword("x-dh-label");
  ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  ajv.addSchema(readJson(path.join(packagesRoot, "sections", "defs.json")));

  const sections = new Map<string, ValidateFunction>();
  const inlineText = new Map<string, string[]>();
  for (const type of sectionTypes) {
    const schema = readJson(path.join(packagesRoot, "sections", `${type}.json`)) as { properties?: Record<string, { $ref?: string; "x-dh-kind"?: string }> };
    sections.set(type, ajv.compile(schema));
    inlineText.set(
      type,
      Object.entries(schema.properties ?? {})
        .filter(([, property]) => property["x-dh-kind"] === "inlineText" || (property["x-dh-kind"] === undefined && property.$ref?.endsWith("/inlineText") === true))
        .map(([name]) => name),
    );
  }
  const collections = new Map<string, ValidateFunction>();
  for (const name of collectionNames) {
    collections.set(name, ajv.compile(readJson(path.join(packagesRoot, "collections", `${name}.json`))));
  }

  validators = { sections, collections, inlineText };
  return validators;
}

function describeErrors(validate: ValidateFunction): string {
  return (validate.errors ?? [])
    .map((error) => `${error.instancePath || "(root)"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

/** Keys whose string value is a media id. Rich text images use mediaId as well. */
const mediaIdKeys = new Set(["mediaId", "imageId", "shareImageId", "defaultShareImageId"]);

function missingMediaIds(content: BuildContent): string[] {
  const known = new Set(content.media.map((asset) => asset.id));
  const missing = new Set<string>();
  const { media: _media, ...rest } = content;

  const walk = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      if (key !== undefined && mediaIdKeys.has(key) && !known.has(value)) missing.add(value);
      const text = value.trimStart();
      if (text.startsWith("{") || text.startsWith("[")) {
        try {
          walk(JSON.parse(text));
        } catch {
          // Not JSON.
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry));
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [name, entry] of Object.entries(value)) walk(entry, name);
    }
  };

  walk(rest);
  return [...missing].sort();
}

/**
 * Every problem found, as readable lines. An empty list means the content can be
 * built. Nothing is fixed up here: a problem stops the build.
 */
export function validateContent(content: BuildContent): string[] {
  const problems: string[] = [];
  const { sections, collections, inlineText } = loadValidators();

  for (const key of ["pages", "collections", "errorPages", "media", "navigation", "settings", "redirects", "references", "unresolvedReferences", "counts"] as const) {
    if (content[key] === undefined || content[key] === null) problems.push(`The content has no "${key}".`);
  }
  if (problems.length > 0) return problems;

  for (const name of collectionNames) {
    const items = name === "pages" ? content.pages : content.collections[name];
    if (!Array.isArray(items)) {
      problems.push(`Collection "${name}" is missing.`);
      continue;
    }
    if (content.counts[name] !== items.length) {
      problems.push(`Collection "${name}" has ${items.length} items but the content says ${content.counts[name]}.`);
    }
    for (const item of items) {
      if (item.collection !== name) problems.push(`${item.collection}/${item.slug} is listed under "${name}".`);
    }
  }

  const checkItem = (item: AnyContentItem, where: string): void => {
    const validateFields = collections.get(item.collection);
    if (!validateFields) {
      problems.push(`${where}: unknown collection "${item.collection}".`);
      return;
    }
    if (!validateFields(item.fields)) {
      problems.push(`${where}: fields do not match collections/${item.collection}.json: ${describeErrors(validateFields)}`);
    }
    item.sections.forEach((section, index) => {
      const validateSection = sections.get(section.type);
      if (!validateSection) {
        problems.push(`${where}: section ${index + 1} has unknown type "${section.type}".`);
        return;
      }
      if (!validateSection(section.fields)) {
        problems.push(`${where}: section ${index + 1} (${section.type}) does not match sections/${section.type}.json: ${describeErrors(validateSection)}`);
        return;
      }
      for (const name of inlineText.get(section.type) ?? []) {
        const value = (section.fields as Record<string, unknown>)[name];
        const allowMarks = inlineMarksAllowed(item.collection, section.type, name);
        for (const message of inlineTextProblems(typeof value === "string" ? value : null, { allowMarks })) {
          problems.push(`${where}: section ${index + 1} (${section.type}) ${name}: ${message}`);
        }
      }
    });
  };

  for (const item of allItems(content)) checkItem(item, `${item.collection}/${item.slug}`);
  for (const [code, page] of Object.entries(content.errorPages)) {
    if (page) checkItem(page, `error page ${code}`);
  }

  for (const asset of content.media) {
    if (!isSafeMediaPath(asset.path)) problems.push(`Media ${asset.id} has an unexpected path "${asset.path}".`);
    if (!(asset.width > 0 && asset.height > 0)) problems.push(`Media ${asset.id} has no dimensions.`);
    if (!asset.widths.every((width) => Number.isInteger(width) && width > 0)) {
      problems.push(`Media ${asset.id} has invalid stored widths ${JSON.stringify(asset.widths)}.`);
    }
  }
  for (const id of missingMediaIds(content)) {
    problems.push(`Media ${id} is used by published content but is not in the media list.`);
  }

  return problems;
}
