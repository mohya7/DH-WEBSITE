import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button, Modal, Space } from "antd";
import { useEffect, useState } from "react";
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
}).configure({ inline: false, allowBase64: false });

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
}: {
  value: string;
  onChange: (value: string) => void;
  fieldPath: string;
}) {
  const [picker, setPicker] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    content: parseDocument(value),
    editorProps: {
      attributes: { "data-field": fieldPath, class: "min-h-40" },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.some((file) => file.type.startsWith("image/"))) {
          setNotice("This paste included an image. Use the image button so you can add alt text.");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const raw = JSON.stringify(current.getJSON());
      if (raw.includes('"type":"image"') && raw.includes('"src"')) {
        void filterPaste(raw, current, onChange, setNotice);
        return;
      }
      onChange(cleanDocument(current.getJSON()));
    },
  });

  useEffect(() => {
    if (editor === null) return;
    if (cleanDocument(editor.getJSON()) === value) return;
    editor.commands.setContent(parseDocument(value), { emitUpdate: false });
  }, [editor, value]);

  function insertImage(choice: MediaChoice) {
    rememberMedia(choice.id, choice.path);
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

async function filterPaste(
  raw: string,
  editor: NonNullable<ReturnType<typeof useEditor>>,
  onChange: (value: string) => void,
  setNotice: (value: string) => void,
) {
  const result = await request("/api/v1/rich-text/paste", jsonInit("POST", { document: raw }));
  if (!result.ok || result.body === null) {
    setNotice("This paste included an image. Use the image button so you can add alt text.");
    return;
  }

  const filtered = result.body as { document: string; imagesDropped: boolean };
  editor.commands.setContent(parseDocument(filtered.document), { emitUpdate: false });
  onChange(cleanDocument(editor.getJSON()));
  if (filtered.imagesDropped) {
    setNotice("This paste included an image. Use the image button so you can add alt text.");
  }
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
