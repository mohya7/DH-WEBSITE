/*
 * Inline text: a section field that is one line of text which may carry bold,
 * italic, and links — a heading with an emphasised phrase, a lede with a strong
 * clause, a lead ending in an on-page link. Stored as a TipTap document of one
 * paragraph (defs.json, x-dh-kind "inlineText").
 *
 * The rules are the API's (api/src/DigitalHub.Api/Content/InlineText.cs): at
 * most 4096 UTF-8 bytes; one paragraph of text nodes; marks bold, italic, and
 * link only; a link is a { type, id } content reference or a #fragment, never
 * an external address or a raw path. Where marks are not allowed, the text must
 * be plain. No JSX here, so build scripts and the Studio can use it.
 */

export const inlineTextMaxBytes = 4096;

export const inlineReferenceTypes = ["service", "partner", "case_study", "blog_post", "page", "vacancy"] as const;

export type InlineLink = { type: string; id: string } | { href: string };

export interface InlinePart {
  text: string;
  bold: boolean;
  italic: boolean;
  link: InlineLink | null;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unknownKeys(node: Json, allowed: string[], what: string, problems: string[]): void {
  for (const key of Object.keys(node)) if (!allowed.includes(key)) problems.push(`"${key}" is not allowed on ${what}.`);
}

function depth(value: unknown): number {
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(depth));
  if (isObject(value)) return 1 + Math.max(0, ...Object.values(value).map(depth));
  return 0;
}

function linkProblems(mark: Json, problems: string[]): void {
  unknownKeys(mark, ["type", "attrs"], "link", problems);
  const attrs = mark.attrs;
  if (!isObject(attrs)) {
    problems.push("A link needs a destination.");
    return;
  }
  const href = typeof attrs.href === "string" ? attrs.href : null;
  const type = typeof attrs.type === "string" ? attrs.type : null;
  const id = typeof attrs.id === "string" ? attrs.id : null;
  if (href !== null) {
    unknownKeys(attrs, ["href"], "link", problems);
    if (type !== null || id !== null) problems.push("A link cannot be both an address and a content reference.");
    else if (!href.startsWith("#") || href.length < 2) problems.push(`The link "${href.slice(0, 60)}" is not allowed. Use a content reference, or a #fragment on the same page.`);
    return;
  }
  unknownKeys(attrs, ["type", "id"], "link", problems);
  if (type === null || !(inlineReferenceTypes as readonly string[]).includes(type)) problems.push("A link must name a content item.");
  if (id === null || !uuid.test(id)) problems.push("A link must carry the item id.");
}

/**
 * What is wrong with a stored inline-text value, as readable lines. Empty means
 * it is valid. An empty or blank value is valid: the field is simply not set.
 */
export function inlineTextProblems(value: string | null | undefined, options: { allowMarks: boolean }): string[] {
  const problems: string[] = [];
  if (value === null || value === undefined || value.trim() === "") return problems;
  if (new TextEncoder().encode(value).length > inlineTextMaxBytes) return [`This text is longer than ${inlineTextMaxBytes} bytes.`];

  let root: unknown;
  try {
    root = JSON.parse(value);
  } catch {
    return ["This text must be a document."];
  }
  if (depth(root) > 16) return ["This text must be a document."];
  if (!isObject(root) || root.type !== "doc") return ["This text must be a document."];

  unknownKeys(root, ["type", "content"], "text", problems);
  if (!Array.isArray(root.content)) return problems;
  if (root.content.length > 1) return [...problems, "This text must be a single paragraph."];

  for (const paragraph of root.content) {
    if (!isObject(paragraph) || paragraph.type !== "paragraph") {
      problems.push(`"${isObject(paragraph) ? String(paragraph.type ?? "") : ""}" is not allowed: this text must be a single paragraph.`);
      continue;
    }
    unknownKeys(paragraph, ["type", "content"], "paragraph", problems);
    if (!Array.isArray(paragraph.content)) continue;
    for (const node of paragraph.content) {
      if (!isObject(node) || node.type !== "text") {
        problems.push(`"${isObject(node) ? String(node.type ?? "") : ""}" is not allowed inside this text.`);
        continue;
      }
      unknownKeys(node, ["type", "text", "marks"], "text", problems);
      if (typeof node.text !== "string") problems.push("Every part of this text must contain text.");
      if (node.marks === undefined) continue;
      if (!Array.isArray(node.marks)) {
        problems.push("Marks must be a list.");
        continue;
      }
      for (const mark of node.marks) {
        if (!isObject(mark)) {
          problems.push("Marks must be objects.");
          continue;
        }
        const kind = typeof mark.type === "string" ? mark.type : "";
        if (!options.allowMarks) problems.push(`"${kind}" is not allowed here: this text must be plain.`);
        else if (kind === "bold" || kind === "italic") unknownKeys(mark, ["type"], "mark", problems);
        else if (kind === "link") linkProblems(mark, problems);
        else problems.push(`"${kind}" is not allowed.`);
      }
    }
  }
  return problems;
}

/**
 * The parts of a stored inline-text value, in order, each with its marks. A
 * value that is not a valid document gives no parts: the build rejects it
 * before rendering (website validate.ts), so nothing invalid is ever shown.
 */
export function parseInlineText(value: string | null | undefined): InlinePart[] {
  if (inlineTextProblems(value, { allowMarks: true }).length > 0 || !value || !value.trim()) return [];
  const root = JSON.parse(value) as { content?: { content?: { text: string; marks?: { type: string; attrs?: Json }[] }[] }[] };
  return (root.content?.[0]?.content ?? []).map((node) => {
    const marks = node.marks ?? [];
    const link = marks.find((mark) => mark.type === "link")?.attrs;
    return {
      text: node.text,
      bold: marks.some((mark) => mark.type === "bold"),
      italic: marks.some((mark) => mark.type === "italic"),
      link: !link ? null : typeof link.href === "string" ? { href: link.href } : { type: String(link.type), id: String(link.id) },
    };
  });
}

/** The plain text of an inline-text value, for places that must stay plain (the home hero's animated lines). */
export function inlinePlainText(value: string | null | undefined): string {
  return parseInlineText(value)
    .map((part) => part.text)
    .join("");
}

/** An inline-text value holding plain text: one paragraph, one text node, or none when empty. */
export function inlineTextFrom(text: string): string {
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) }] });
}
