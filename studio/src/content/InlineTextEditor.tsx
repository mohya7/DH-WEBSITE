import Link from "@tiptap/extension-link";
import { EditorContent, Node, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button, Modal, Space } from "antd";
import { useEffect, useState } from "react";
import { request } from "../api/http";
import { labelFromKey, referenceCollections } from "./model";

/*
 * Inline text (x-dh-kind "inlineText"): one line that may carry bold, italic,
 * and links, stored as a TipTap document of one paragraph. The rules are the
 * API's (Content/InlineText.cs): no other marks or nodes, no line breaks, and a
 * link is either a content item ({ type, id }, resolved when the site is built)
 * or a #fragment on the same page, never an external address. Where marks are
 * not allowed the editor offers none and saves plain text.
 */

const maxBytes = 4096;

/** A document whose only child is one paragraph: Enter has nowhere to split to. */
const OneParagraph = Node.create({ name: "doc", topNode: true, content: "paragraph" });

const InlineLink = Link.extend({
  addAttributes() {
    return {
      href: { default: null },
      type: { default: null },
      id: { default: null },
    };
  },
}).configure({ openOnClick: false, autolink: false, linkOnPaste: false });

type LinkAttrs = { href?: string | null; type?: string | null; id?: string | null };

function emptyDocument(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** The stored value as an editor document. Plain text saved before this field was inline text opens as that text. */
export function parseInlineValue(value: string): JSONContent {
  if (value.trim().length === 0) return emptyDocument();
  try {
    const parsed = JSON.parse(value) as JSONContent;
    if (parsed.type === "doc") return parsed;
  } catch {
    // Not a document: plain text.
  }
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value.replace(/\s+/g, " ") }] }] };
}

/** The editor's document as the stored value: allowed marks and attributes only, and "" when there is no text. */
export function cleanInlineValue(document: JSONContent, allowMarks: boolean): string {
  const parts = (document.content ?? [])
    .flatMap((paragraph) => paragraph.content ?? [])
    .filter((node) => node.type === "text" && typeof node.text === "string" && node.text.length > 0)
    .map((node) => {
      const marks = allowMarks
        ? (node.marks ?? []).flatMap((mark) => {
            if (mark.type === "bold" || mark.type === "italic") return [{ type: mark.type }];
            if (mark.type !== "link") return [];
            const attrs = (mark.attrs ?? {}) as LinkAttrs;
            if (typeof attrs.type === "string" && typeof attrs.id === "string") return [{ type: "link", attrs: { type: attrs.type, id: attrs.id } }];
            if (typeof attrs.href === "string" && attrs.href.startsWith("#") && attrs.href.length > 1) return [{ type: "link", attrs: { href: attrs.href } }];
            return [];
          })
        : [];
      return marks.length > 0 ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
    });
  if (parts.length === 0) return "";
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: parts }] });
}

export function InlineTextEditor({
  value,
  onChange,
  fieldPath,
  allowMarks,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  fieldPath: string;
  allowMarks: boolean;
  label: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      OneParagraph,
      StarterKit.configure({
        document: false,
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        underline: false,
        link: false,
        trailingNode: false,
        dropcursor: false,
        gapcursor: false,
        bold: allowMarks ? {} : false,
        italic: allowMarks ? {} : false,
      }),
      ...(allowMarks ? [InlineLink] : []),
    ],
    content: parseInlineValue(value),
    editorProps: {
      attributes: { "data-field": fieldPath, class: "inline-text-editor__line", role: "textbox", "aria-multiline": "false", "aria-label": label },
      handleKeyDown(_view, event) {
        // One line: Enter never adds a paragraph or a break.
        return event.key === "Enter";
      },
      handlePaste(view, event) {
        // Pasted text arrives as one line of plain text; its formatting and any links are dropped.
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return false;
        view.dispatch(view.state.tr.insertText(text.replace(/\s+/g, " ")));
        return true;
      },
    },
    onUpdate: ({ editor: current }) => onChange(cleanInlineValue(current.getJSON(), allowMarks)),
  });

  useEffect(() => {
    if (editor === null) return;
    if (cleanInlineValue(editor.getJSON(), allowMarks) === value) return;
    editor.commands.setContent(parseInlineValue(value), { emitUpdate: false });
  }, [editor, value, allowMarks]);

  const tooLong = new TextEncoder().encode(value).length > maxBytes;

  return (
    <div className="rich-text-editor inline-text-editor" data-field={fieldPath} data-inline-text="">
      {allowMarks ? (
        <Space wrap className="mb-2">
          <Button size="small" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</Button>
          <Button size="small" onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</Button>
          <Button size="small" onClick={() => setLinkOpen(true)}>Link</Button>
          <Button size="small" onClick={() => editor?.chain().focus().extendMarkRange("link").unsetMark("link").run()}>Remove link</Button>
        </Space>
      ) : (
        <p className="mb-1 text-xs" style={{ color: "var(--dh-text-muted)" }}>Plain text here: bold, italic, and links are allowed only in case studies.</p>
      )}
      <EditorContent editor={editor} />
      {tooLong ? <p className="mt-2 text-sm" style={{ color: "var(--dh-error)" }}>This text is longer than {maxBytes} bytes.</p> : null}
      {allowMarks ? (
        <InlineLinkDialog
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          onFragment={(href) => {
            editor?.chain().focus().extendMarkRange("link").setMark("link", { href, type: null, id: null }).run();
            setLinkOpen(false);
          }}
          onContent={(type, id) => {
            editor?.chain().focus().extendMarkRange("link").setMark("link", { href: null, type, id }).run();
            setLinkOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Whether a #fragment is one the API accepts: a # and at least one character after it. */
export function fragmentProblem(value: string): string | null {
  const href = value.trim();
  return href.startsWith("#") && href.length > 1 ? null : "Enter a #fragment on this page, such as #services.";
}

function InlineLinkDialog({
  open,
  onClose,
  onFragment,
  onContent,
}: {
  open: boolean;
  onClose: () => void;
  onFragment: (href: string) => void;
  onContent: (type: string, id: string) => void;
}) {
  const [mode, setMode] = useState<"content" | "fragment">("content");
  const [type, setType] = useState("page");
  const [fragment, setFragment] = useState("#");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  async function find(term: string, collectionType = type) {
    const collection = referenceCollections[collectionType];
    if (collection === undefined) return;
    const result = await request(`/api/v1/${collection}?pageSize=8&search=${encodeURIComponent(term)}`);
    if (!result.ok || result.body === null) return;
    setItems((result.body as { items: Array<{ id: string; title: string }> }).items);
  }

  return (
    <Modal title="Link" open={open} onCancel={onClose} footer={null}>
      <Space className="mb-3">
        <Button type={mode === "content" ? "primary" : "default"} onClick={() => setMode("content")}>Content</Button>
        <Button type={mode === "fragment" ? "primary" : "default"} onClick={() => setMode("fragment")}>On this page</Button>
      </Space>
      {mode === "fragment" ? (
        <div>
          <input className="native-control mb-2" value={fragment} onChange={(event) => setFragment(event.target.value)} aria-label="Fragment" />
          {error !== null ? <p className="text-sm" style={{ color: "var(--dh-error)" }}>{error}</p> : null}
          <Button
            type="primary"
            onClick={() => {
              const problem = fragmentProblem(fragment);
              setError(problem);
              if (problem === null) onFragment(fragment.trim());
            }}
          >
            Add link
          </Button>
          <p className="mt-2 text-xs" style={{ color: "var(--dh-text-muted)" }}>Links in this text go to content or to a place on this page. External addresses are not allowed.</p>
        </div>
      ) : (
        <div>
          <select
            className="native-control mb-2"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setItems([]);
              if (search.length > 0) void find(search, event.target.value);
            }}
          >
            {Object.keys(referenceCollections).map((name) => (
              <option key={name} value={name}>{labelFromKey(name)}</option>
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
                <button type="button" className="reference-hit py-1 text-left" onClick={() => onContent(type, item.id)}>
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
