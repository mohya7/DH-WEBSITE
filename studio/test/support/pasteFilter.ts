/*
 * A fake of POST /api/v1/rich-text/paste for the editor's render tests.
 * Self-contained on purpose: it imports nothing from src.
 *
 * It copies the server's image rule only, from
 * api/src/DigitalHub.Api/Content/RichText.cs:
 *   - Paste (105-137): the body is a document, or a bare list of nodes
 *     (130-133); anything else gives an empty document.
 *   - ImageNode (305-336): an image is dropped when its attrs has a key named
 *     src, url or href (309-313), when mediaId is not a GUID string (315-317),
 *     or when it has no alt text and is not decorative (323-324). A kept image
 *     is rebuilt as mediaId, alt when not blank, decorative when true (326-335).
 *   - FilterPaste (98-103): imagesDropped is true when an image was removed.
 * Every other node passes through as it is, which the server does not do: the
 * end-to-end test E2 (e2e/rich-text.spec.ts) pastes against the real route.
 */
export type PasteAnswer = { document: string; imagesDropped: boolean };

type PastedNode = { type?: unknown; attrs?: unknown; content?: unknown; [key: string]: unknown };

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNode(value: unknown): value is PastedNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function imageNode(node: PastedNode): PastedNode | null {
  if (!isNode(node.attrs)) return null;
  const attrs = node.attrs as Record<string, unknown>;
  if ("src" in attrs || "url" in attrs || "href" in attrs) return null;

  const mediaId = attrs.mediaId;
  if (typeof mediaId !== "string" || !guid.test(mediaId)) return null;

  const decorative = attrs.decorative === true;
  const alt = typeof attrs.alt === "string" ? attrs.alt : null;
  if (!decorative && (alt === null || alt.trim() === "")) return null;

  const kept: Record<string, unknown> = { mediaId: mediaId.toLowerCase() };
  if (alt !== null && alt.trim() !== "") kept.alt = alt.trim();
  if (decorative) kept.decorative = true;
  return { type: "image", attrs: kept };
}

export function pasteFilter(raw: string): PasteAnswer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  let list: unknown[] = [];
  if (Array.isArray(parsed)) list = parsed;
  else if (isNode(parsed) && parsed.type === "doc" && Array.isArray(parsed.content)) list = parsed.content;

  let imagesDropped = false;
  function take(nodes: unknown[]): PastedNode[] {
    const kept: PastedNode[] = [];
    for (const node of nodes) {
      if (!isNode(node)) continue;
      if (node.type === "image") {
        const image = imageNode(node);
        if (image === null) imagesDropped = true;
        else kept.push(image);
        continue;
      }
      kept.push(Array.isArray(node.content) ? { ...node, content: take(node.content) } : node);
    }
    return kept;
  }

  return { document: JSON.stringify({ type: "doc", content: take(list) }), imagesDropped };
}
