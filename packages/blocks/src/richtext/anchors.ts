/*
 * Table-of-contents anchors for an article's headings. Generated from the
 * heading text as the old article pages did — lowercase, every run of other
 * characters a hyphen ("1. Critical reports…" → "1-critical-reports-…") —
 * with apostrophes dropped ("Egypt’s" → "egypts"). Unique within the article:
 * a repeated heading gets -2, -3, and so on.
 */
import { allowedHere, textOf, type RichDocument, type RichNode } from "./document";

export interface HeadingAnchor {
  level: 2 | 3 | 4;
  text: string;
  id: string;
}

export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

export function headingLevel(node: RichNode): 2 | 3 | 4 {
  const level = Number(node.attrs?.level);
  return level >= 4 ? 4 : level === 3 ? 3 : 2;
}

/** Every heading the renderer renders, in document order, with its unique anchor. */
export function headingAnchors(doc: RichDocument | null): HeadingAnchor[] {
  const anchors: HeadingAnchor[] = [];
  const used = new Set<string>();
  const walk = (node: RichNode) => {
    if (node.type === "heading") {
      const text = textOf(node).trim();
      const base = slugify(text);
      let id = base;
      let suffix = 2;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      anchors.push({ level: headingLevel(node), text, id });
      return;
    }
    for (const child of node.content ?? []) if (allowedHere(node.type, child.type)) walk(child);
  };
  if (doc) walk(doc);
  return anchors;
}
