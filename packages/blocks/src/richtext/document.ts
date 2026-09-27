/*
 * The TipTap document the Studio stores for rich text (Phase B, 6.4): allowed
 * nodes and attributes only. Anything else is not rendered.
 */
export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
}

export interface RichDocument extends RichNode {
  type: "doc";
  /** Blog posts keep their related items here, beside the TipTap content. */
  relatedItems?: { type: string; id: string }[];
}

/** Parses a stored rich-text value. An empty, invalid, or non-document value is no document. */
export function parseRichText(value: string | null | undefined): RichDocument | null {
  if (!value || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as RichNode;
    return parsed && parsed.type === "doc" ? (parsed as RichDocument) : null;
  } catch {
    return null;
  }
}

const blocks = new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "image", "table", "codeBlock"]);

/** Which nodes may appear inside which: the same rules the API validates documents against (RichText.cs). */
export function allowedHere(parent: string, kind: string): boolean {
  switch (parent) {
    case "doc":
    case "blockquote":
    case "listItem":
    case "tableCell":
    case "tableHeader":
      return blocks.has(kind);
    case "paragraph":
    case "heading":
    case "codeBlock":
      return kind === "text";
    case "bulletList":
    case "orderedList":
      return kind === "listItem";
    case "table":
      return kind === "tableRow";
    case "tableRow":
      return kind === "tableCell" || kind === "tableHeader";
    default:
      return false;
  }
}

/** The text of a node and everything inside it. */
export function textOf(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}
