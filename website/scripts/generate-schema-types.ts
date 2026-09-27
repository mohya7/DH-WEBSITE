/*
 * Generates src/content/generated/schema-types.ts from the JSON Schemas in
 * packages/sections and packages/collections — the same files the API validates
 * against and the Studio builds its forms from.
 *
 *   npm run gen:types              write the file
 *   npm run gen:types -- --check   fail if the committed file is out of date
 *
 * The schemas use a small subset of JSON Schema. This generator handles exactly
 * that subset and refuses anything else, so a new construct in a schema stops
 * the build instead of being typed wrongly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesRoot = path.resolve(websiteRoot, "..", "packages");
const sectionsDir = path.join(packagesRoot, "sections");
const collectionsDir = path.join(packagesRoot, "collections");
const outputFile = path.join(websiteRoot, "src", "content", "generated", "schema-types.ts");

const DEFS_ID = "https://digitalhub.local/sections/defs";

type Schema = {
  $schema?: string;
  $id?: string;
  $defs?: Record<string, Schema>;
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: string[];
  const?: string;
  oneOf?: Schema[];
  format?: string;
  "x-dh-kind"?: string;
  "x-dh-label"?: string;
};

const allowedKeywords = new Set([
  "$schema", "$id", "$defs", "$ref", "type", "properties", "required", "additionalProperties",
  "items", "enum", "const", "oneOf", "format", "x-dh-kind", "x-dh-label",
]);

/**
 * What a field kind means for the value, where the JSON type alone does not say.
 * Only kinds whose meaning is fixed by the Phase A and B briefs are annotated.
 */
const kindNotes: Record<string, string> = {
  richText: "TipTap JSON document, serialized as a string.",
  mediaId: "Id of a media library item.",
};

/** Kinds the TypeScript type already says everything about. */
const plainKinds = new Set(["text", "boolean", "number", "media", "reference"]);

/** The shared definitions in defs.json, by name, to the exported type name. */
const defTypeNames: Record<string, string> = {
  media: "Media",
  reference: "Reference",
  link: "Link",
  textPair: "TextPair",
  block: "Block",
};

function fail(where: string, message: string): never {
  throw new Error(`${where}: ${message}`);
}

function readSchema(file: string): Schema {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Schema;
}

function pascal(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function checkKeywords(schema: Schema, where: string): void {
  for (const key of Object.keys(schema)) {
    if (!allowedKeywords.has(key)) fail(where, `unsupported keyword "${key}"`);
  }
}

function docComment(schema: Schema, indent: string): string {
  const parts: string[] = [];
  if (schema["x-dh-label"]) parts.push(schema["x-dh-label"]);
  const kind = schema["x-dh-kind"];
  if (kind && !plainKinds.has(kind)) parts.push(kindNotes[kind] ? `${kind}: ${kindNotes[kind]}` : kind);
  return parts.length === 0 ? "" : `${indent}/** ${parts.join(". ")} */\n`;
}

function refType(ref: string, where: string): string {
  const prefix = `${DEFS_ID}#/$defs/`;
  if (!ref.startsWith(prefix)) fail(where, `unsupported $ref "${ref}"`);
  const name = ref.slice(prefix.length);
  const typeName = defTypeNames[name];
  if (!typeName) fail(where, `no type name for definition "${name}"`);
  return typeName;
}

function typeOf(schema: Schema, where: string, indent: string): string {
  checkKeywords(schema, where);

  if (schema.$ref !== undefined) {
    const others = Object.keys(schema).filter((key) => key !== "$ref" && !key.startsWith("x-dh-"));
    if (others.length > 0) fail(where, `$ref alongside ${others.join(", ")}`);
    return refType(schema.$ref, where);
  }

  if (schema.oneOf !== undefined) {
    return schema.oneOf.map((option, index) => typeOf(option, `${where}/oneOf/${index}`, indent)).join(" | ");
  }

  if (schema.const !== undefined) return JSON.stringify(schema.const);

  const types = Array.isArray(schema.type) ? schema.type : schema.type === undefined ? [] : [schema.type];
  if (types.length === 0) fail(where, "no type");
  const nullable = types.includes("null");
  const concrete = types.filter((type) => type !== "null");
  if (concrete.length !== 1) fail(where, `unsupported type union ${JSON.stringify(schema.type)}`);

  let base: string;
  switch (concrete[0]) {
    case "string":
      base = schema.enum ? schema.enum.map((value) => JSON.stringify(value)).join(" | ") : "string";
      break;
    case "boolean":
      base = "boolean";
      break;
    case "integer":
    case "number":
      base = "number";
      break;
    case "array": {
      if (schema.items === undefined) fail(where, "array without items");
      const item = typeOf(schema.items, `${where}/items`, indent);
      base = /[|{]/.test(item) ? `Array<${item}>` : `${item}[]`;
      break;
    }
    case "object":
      base = objectType(schema, where, indent);
      break;
    default:
      fail(where, `unsupported type "${concrete[0]}"`);
  }

  if (schema.enum !== undefined && concrete[0] !== "string") fail(where, "enum on a non-string type");
  return nullable ? `${base} | null` : base;
}

function objectType(schema: Schema, where: string, indent: string): string {
  if (schema.additionalProperties !== false) fail(where, "objects must set additionalProperties: false");
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  for (const name of required) {
    if (!(name in properties)) fail(where, `required property "${name}" is not defined`);
  }

  const names = Object.keys(properties);
  if (names.length === 0) return "Record<string, never>";

  const inner = indent + "  ";
  const lines = names.map((name) => {
    const property = properties[name];
    const optional = required.has(name) ? "" : "?";
    const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
    return `${docComment(property, inner)}${inner}${key}${optional}: ${typeOf(property, `${where}/${name}`, inner)};`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}

function declaration(name: string, schema: Schema, where: string): string {
  const body = typeOf(schema, where, "");
  // A single, non-nullable object is an interface; unions and anything else are aliases.
  const singleObject = schema.type === "object" && schema.oneOf === undefined && body.startsWith("{");
  return singleObject ? `export interface ${name} ${body}` : `export type ${name} = ${body};`;
}

function schemaFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

export function generate(dirs: { sections: string; collections: string } = { sections: sectionsDir, collections: collectionsDir }): string {
  const { sections: sectionsDir, collections: collectionsDir } = dirs;
  const defs = readSchema(path.join(sectionsDir, "defs.json"));
  if (defs.$id !== DEFS_ID) fail("defs.json", `expected $id ${DEFS_ID}`);
  const defEntries = Object.entries(defs.$defs ?? {});
  for (const [name] of defEntries) {
    if (!defTypeNames[name]) fail("defs.json", `no type name for definition "${name}"`);
  }

  const sectionNames = schemaFiles(sectionsDir)
    .filter((file) => file !== "defs.json")
    .map((file) => file.slice(0, -".json".length));
  const collectionNames = schemaFiles(collectionsDir).map((file) => file.slice(0, -".json".length));

  const out: string[] = [];
  out.push(
    "/*",
    " * GENERATED FILE — do not edit.",
    " * Source: packages/sections/*.json and packages/collections/*.json",
    " * Regenerate: npm run gen:types (in website/). The build fails if this is stale.",
    " */",
    "",
    "/* ---- Shared definitions (packages/sections/defs.json) ---- */",
    "",
  );

  for (const [name, schema] of defEntries) {
    out.push(declaration(defTypeNames[name], schema, `defs.json/$defs/${name}`), "");
  }

  out.push("/* ---- Sections (packages/sections) ---- */", "");
  for (const name of sectionNames) {
    const schema = readSchema(path.join(sectionsDir, `${name}.json`));
    const expectedId = `https://digitalhub.local/sections/${name}`;
    if (schema.$id !== expectedId) fail(`${name}.json`, `expected $id ${expectedId}`);
    out.push(`/** Fields of the \`${name}\` section. */`);
    out.push(declaration(`${pascal(name)}Fields`, schema, `sections/${name}.json`), "");
  }

  out.push(
    "export const sectionTypes = [",
    ...sectionNames.map((name) => `  ${JSON.stringify(name)},`),
    "] as const;",
    "",
    "export type SectionType = (typeof sectionTypes)[number];",
    "",
    "export interface SectionFieldsByType {",
    ...sectionNames.map((name) => `  ${name}: ${pascal(name)}Fields;`),
    "}",
    "",
    "/** A section as it appears on a page: its type, and fields matching that type's schema. */",
    "export type Section = {",
    "  [T in SectionType]: { type: T; fields: SectionFieldsByType[T] };",
    "}[SectionType];",
    "",
    "/* ---- Collections (packages/collections) ---- */",
    "",
  );

  for (const name of collectionNames) {
    const schema = readSchema(path.join(collectionsDir, `${name}.json`));
    const expectedId = `https://digitalhub.local/collections/${name}`;
    if (schema.$id !== expectedId) fail(`${name}.json`, `expected $id ${expectedId}`);
    out.push(`/** Item fields of the \`${name}\` collection. */`);
    out.push(declaration(`${pascal(name)}Fields`, schema, `collections/${name}.json`), "");
  }

  out.push(
    "export const collectionNames = [",
    ...collectionNames.map((name) => `  ${JSON.stringify(name)},`),
    "] as const;",
    "",
    "export type CollectionName = (typeof collectionNames)[number];",
    "",
    "export interface CollectionFieldsByName {",
    ...collectionNames.map((name) => `  ${JSON.stringify(name)}: ${pascal(name)}Fields;`),
    "}",
    "",
  );

  return out.join("\n");
}

function main(): void {
  const check = process.argv.includes("--check");
  const generated = generate();

  if (check) {
    // Compare without line-ending differences: a Windows checkout may have CRLF.
    const current = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== generated) {
      console.error(
        "src/content/generated/schema-types.ts is out of date with packages/sections or packages/collections.\n" +
          "Run `npm run gen:types` in website/ and commit the result.",
      );
      process.exit(1);
    }
    console.log("Schema types are up to date.");
    return;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, generated);
  console.log(`Wrote ${path.relative(websiteRoot, outputFile)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
