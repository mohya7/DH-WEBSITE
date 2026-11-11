import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { Button, Modal, Space } from "antd";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { jsonInit, request } from "../api/http";
import { referenceCollections } from "./model";
import { MediaPicker, rememberMedia, type MediaChoice } from "./MediaPicker";

type MarkAttrs = { href?: string | null; type?: string | null; id?: string | null };

const StudioLink = Link.extend({
  addAttributes() {
    return {
      href: { default: null },
      type: { default: null },
      id: { default: null },
    };
  },
}).configure({ openOnClick: false, autolink: false });

const StudioImage = Image.extend({
  addAttributes() {
    return {
      mediaId: { default: null },
      alt: { default: "" },
      decorative: { default: false },
      src: { default: null, rendered: false },
    };
  },
  // The editor renders an image as img[mediaid] with no src, so its own HTML
  // must parse back into a node when it is copied or cut and pasted. Whether
  // a pasted media id is kept is decided in filteredPaste, not here.
  parseHTML() {
    return [{ tag: "img[mediaid]" }, { tag: 'img[src]:not([src^="data:"])' }];
  },
  // Typing ![alt](url) stays text: an image enters only with a media id.
  addInputRules() {
    return [];
  },
}).configure({ inline: false, allowBase64: false });

const imageNotice = "This paste included an image. Use the image button so you can add alt text.";
const uncheckedNotice = "The paste could not be checked, so nothing was added. Paste again.";
const dropNotice = "The dropped content included an image, so it was not added. Use the image button for images.";

/*
 * The media ids this Studio session got from the API, in lower case. A pasted
 * image keeps its media id only if the id is here; any other id is sent to
 * the paste filter as null, so the image is dropped.
 *
 * An id enters in three places only: from the document an editor is created
 * with, from a document set through `value`, and from the picker (insertImage).
 * It is shared by every rich-text field open in the tab, so an image can be
 * copied from one field to another. An id is never removed.
 *
 * This is safe only because every host passes `value` from the API or from
 * this editor's own onChange. A host that feeds `value` from anything else
 * (the clipboard, browser storage, an address) must not use this editor
 * unchanged: it would make ids of its own choosing known.
 *
 * It is not MediaPicker's map of paths, which holds every image the picker
 * has listed.
 */
const knownMediaIds = new Set<string>();

function noteMediaIds(node: JSONContent) {
  if (node.type === "image" && typeof node.attrs?.mediaId === "string") knownMediaIds.add(node.attrs.mediaId.toLowerCase());
  node.content?.forEach(noteMediaIds);
}

function withoutUnknownMediaIds(node: JSONContent): JSONContent {
  if (node.type === "image") {
    const mediaId: unknown = node.attrs?.mediaId;
    if (typeof mediaId === "string" && knownMediaIds.has(mediaId.toLowerCase())) return node;
    return { ...node, attrs: { ...node.attrs, mediaId: null } };
  }
  if (node.content === undefined) return node;
  return { ...node, content: node.content.map(withoutUnknownMediaIds) };
}

type SetNotice = Dispatch<SetStateAction<string | null>>;

// A paste was added, so the notices that say a paste or a drop was not added
// no longer hold. Only those two: the image notice stays, as before.
function clearNotAddedNotice(setNotice: SetNotice) {
  setNotice((current) => (current === uncheckedNotice || current === dropNotice ? null : current));
}

function hasImage(slice: Slice): boolean {
  let found = false;
  slice.content.descendants((node) => {
    if (node.type.name === "image") found = true;
    return !found;
  });
  return found;
}

function parseDocument(value: string): JSONContent {
  if (value.trim().length === 0) return { type: "doc", content: [{ type: "paragraph" }] };
  try {
    return JSON.parse(value) as JSONContent;
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

function cleanNode(node: JSONContent): JSONContent {
  const next: JSONContent = { type: node.type };
  if (node.text !== undefined) next.text = node.text;
  if (node.type === "heading" && node.attrs !== undefined) {
    next.attrs = { level: node.attrs.level };
  }
  if (node.type === "image" && node.attrs !== undefined) {
    next.attrs = {
      mediaId: node.attrs.mediaId,
      alt: node.attrs.alt ?? "",
      decorative: node.attrs.decorative === true,
    };
  }
  if (node.type === "codeBlock" && typeof node.attrs?.language === "string") {
    next.attrs = { language: node.attrs.language };
  }
  if (node.marks !== undefined) {
    next.marks = node.marks.map((mark) => {
      if (mark.type !== "link" || mark.attrs === undefined) return { type: mark.type };
      const attrs = mark.attrs as MarkAttrs;
      if (typeof attrs.type === "string" && typeof attrs.id === "string") {
        return { type: "link", attrs: { type: attrs.type, id: attrs.id } };
      }
      return { type: "link", attrs: { href: attrs.href ?? "" } };
    });
  }
  if (node.content !== undefined) next.content = node.content.map(cleanNode);
  return next;
}

function cleanDocument(value: JSONContent): string {
  return JSON.stringify(cleanNode(value));
}

export function RichTextEditor({
  value,
  onChange,
  fieldPath,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  fieldPath: string;
  label: string;
}) {
  const [picker, setPicker] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // False once the editor has been removed: TipTap destroys its view a moment later.
  const mounted = useRef(true);
  // Raised each time the document is replaced from outside, through `value`.
  const replaced = useRef(0);
  const [initial] = useState(() => {
    const first = parseDocument(value);
    noteMediaIds(first);
    return first;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      StudioLink,
      StudioImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initial,
    editorProps: {
      attributes: { "data-field": fieldPath, class: "min-h-40", role: "textbox", "aria-multiline": "true", "aria-label": label },
      handlePaste(view, event, slice) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.some((file) => file.type.startsWith("image/"))) {
          setNotice(imageNotice);
          return true;
        }
        // A paste with no image is left to ProseMirror. One that carries an
        // image is not inserted here: the server filter answers first.
        if (!hasImage(slice)) {
          clearNotAddedNotice(setNotice);
          return false;
        }
        void filteredPaste(view, slice, setNotice, () => mounted.current, () => replaced.current);
        return true;
      },
      handleDrop(_view, _event, slice, moved) {
        // A move inside the editor, or a drop with no image, is left to ProseMirror.
        if (moved || !hasImage(slice)) return false;
        setNotice(dropNotice);
        return true;
      },
    },
    // Reports the document and nothing else: no request, and the document is never replaced from here.
    onUpdate: ({ editor: current }) => {
      onChange(cleanDocument(current.getJSON()));
    },
  });

  useEffect(() => {
    if (editor === null) return;
    if (cleanDocument(editor.getJSON()) === value) return;
    const next = parseDocument(value);
    noteMediaIds(next);
    replaced.current += 1;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  function insertImage(choice: MediaChoice) {
    rememberMedia(choice.id, choice.path);
    knownMediaIds.add(choice.id.toLowerCase());
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { mediaId: choice.id, alt: choice.alt, decorative: false, src: choice.path },
      })
      .run();
    setPicker(false);
  }

  return (
    <div className="rich-text-editor" data-field={fieldPath}>
      <Space wrap className="mb-2">
        <Button size="small" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}>H4</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>Numbered</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleCode().run()}>Code</Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>Code block</Button>
        <Button size="small" onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>Table</Button>
        <Button size="small" onClick={() => setLinkOpen(true)}>Link</Button>
        <Button size="small" onClick={() => setPicker(true)}>Image</Button>
      </Space>
      <EditorContent editor={editor} />
      {notice !== null ? <p className="mt-2 text-sm" style={{ color: "var(--dh-warning)" }}>{notice}</p> : null}
      <MediaPicker open={picker} onClose={() => setPicker(false)} onSelect={insertImage} />
      <LinkDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onExternal={(href) => {
          editor?.chain().focus().setMark("link", { href, type: null, id: null }).run();
          setLinkOpen(false);
        }}
        onInternal={(type, id) => {
          editor?.chain().focus().setMark("link", { href: null, type, id }).run();
          setLinkOpen(false);
        }}
      />
    </div>
  );
}

/*
 * A paste that carries an image. The pasted slice, never the document, goes to
 * the server's paste filter, and the answer is inserted when it arrives.
 * Nothing is inserted before the answer, so what was typed meanwhile stays.
 *
 * The answer replaces only what the person had selected when they pasted, and
 * only if that selection and the document are still as they were; a paste
 * does that. With a caret it is inserted at the caret. With any other
 * selection, one made after the paste (the Image button leaves its new image
 * selected), it is inserted after the selection and replaces nothing.
 */
async function filteredPaste(
  view: EditorView,
  slice: Slice,
  setNotice: SetNotice,
  isMounted: () => boolean,
  replacedCount: () => number,
) {
  const replacedBefore = replacedCount();
  const pastedInto = view.state;
  // cleanNode leaves an image with mediaId, alt and decorative only, so no address is sent.
  const pasted = ((slice.content.toJSON() ?? []) as JSONContent[]).map(cleanNode).map(withoutUnknownMediaIds);

  let filtered: { document: string; imagesDropped: boolean } | null = null;
  try {
    const result = await request("/api/v1/rich-text/paste", jsonInit("POST", { document: JSON.stringify(pasted) }));
    if (result.ok && result.body !== null) filtered = result.body as { document: string; imagesDropped: boolean };
  } catch {
    filtered = null;
  }

  // The editor has been removed: there is nothing to add to, and nobody to tell.
  if (!isMounted() || view.isDestroyed) return;
  // The document was replaced from outside while the filter was out (another
  // item was opened in this editor): the paste belongs to the old document.
  if (replacedCount() !== replacedBefore || filtered === null) {
    setNotice(uncheckedNotice);
    return;
  }

  try {
    const content = (JSON.parse(filtered.document) as JSONContent).content ?? [];
    const fragment = Fragment.fromJSON(view.state.schema, content);
    // Open at the ends as the pasted slice was, so pasted text joins the
    // sentence it lands in, as an ordinary paste does.
    const widest = Slice.maxOpen(fragment);
    const piece = new Slice(fragment, Math.min(slice.openStart, widest.openStart), Math.min(slice.openEnd, widest.openEnd));
    if (fragment.size > 0) {
      const { state } = view;
      const untouched = state.doc.eq(pastedInto.doc) && state.selection.eq(pastedInto.selection);
      const transaction = state.tr;
      if (state.selection.empty || untouched) {
        transaction.replaceSelection(piece);
      } else {
        const after = state.selection.to;
        transaction.replaceRange(after, after, piece);
        // The caret goes to the end of what was added, as after a paste.
        transaction.setSelection(Selection.near(transaction.doc.resolve(transaction.mapping.map(after, 1)), -1));
      }
      view.dispatch(transaction.scrollIntoView());
      if (!filtered.imagesDropped) clearNotAddedNotice(setNotice);
    }
  } catch {
    setNotice(uncheckedNotice);
    return;
  }

  if (filtered.imagesDropped) setNotice(imageNotice);
}

function LinkDialog({
  open,
  onClose,
  onExternal,
  onInternal,
}: {
  open: boolean;
  onClose: () => void;
  onExternal: (href: string) => void;
  onInternal: (type: string, id: string) => void;
}) {
  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [type, setType] = useState("page");
  const [href, setHref] = useState("https://");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  async function find(term: string) {
    const collection = referenceCollections[type];
    const result = await request(`/api/v1/${collection}?pageSize=8&search=${encodeURIComponent(term)}`);
    if (!result.ok || result.body === null) return;
    const page = result.body as { items: Array<{ id: string; title: string }> };
    setItems(page.items);
  }

  return (
    <Modal title="Link" open={open} onCancel={onClose} footer={null}>
      <Space className="mb-3">
        <Button type={mode === "internal" ? "primary" : "default"} onClick={() => setMode("internal")}>Internal</Button>
        <Button type={mode === "external" ? "primary" : "default"} onClick={() => setMode("external")}>External</Button>
      </Space>
      {mode === "external" ? (
        <div>
          <input className="native-control mb-2" value={href} onChange={(event) => setHref(event.target.value)} />
          {error !== null ? <p className="text-sm" style={{ color: "var(--dh-error)" }}>{error}</p> : null}
          <Button
            type="primary"
            onClick={() => {
              const allowed = /^(https?:|mailto:|tel:)/i.test(href.trim());
              if (!allowed) {
                setError("Use http, https, mailto, or tel.");
                return;
              }
              setError(null);
              onExternal(href.trim());
            }}
          >
            Add link
          </Button>
        </div>
      ) : (
        <div>
          <select className="native-control mb-2" value={type} onChange={(event) => setType(event.target.value)}>
            {Object.keys(referenceCollections).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            className="native-control mb-2"
            placeholder="Search items"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              void find(event.target.value);
            }}
          />
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="reference-hit py-1 text-left" onClick={() => onInternal(type, item.id)}>
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs" style={{ color: "var(--dh-text-muted)" }}>The address is resolved when the site is built.</p>
        </div>
      )}
    </Modal>
  );
}
