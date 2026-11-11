// @vitest-environment jsdom
/*
 * ADM-03: images in rich text are kept, and only pasted content is filtered.
 *
 * The tests render the real RichTextEditor and the real MediaPicker. The API is
 * faked: /api/v1/rich-text/paste is answered by test/support/pasteFilter.ts,
 * which copies the server's image rule, and every paste body is recorded. A
 * test can hold the paste answers back and release them itself, or make them
 * fail.
 *
 * How the tests wait: no test waits a length of time for something to happen
 * or not to happen. The paste fake answers in microtasks; "settle" only flushes
 * promises that have already resolved and React's updates. So an assertion that
 * something did not happen is made after every held answer has been released
 * and flushed, when nothing is left in flight.
 *
 * jsdom cannot type. A character is inserted through the editor TipTap puts on
 * its element (dom.editor), which runs onUpdate as a keystroke does. Real
 * keystrokes are covered end to end (e2e/rich-text.spec.ts).
 *
 * The editor keeps one set of known media ids for the whole file, so the ids in
 * T13 (the crafted paste) are ones no other test loads or picks.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pasteFilter } from "./support/pasteFilter";

vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380");

// The stubs below stand in for browser APIs jsdom lacks. They assert nothing.

// antd reads breakpoints through window.matchMedia.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
});

// antd observes sizes through ResizeObserver.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: NoResizeObserver });

// ProseMirror scrolls the selection into view after focus(), which needs layout.
const noRects = () => Object.assign([], { item: () => null });
const zeroRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON() {} });
Object.assign(Range.prototype, { getClientRects: noRects, getBoundingClientRect: zeroRect });
Object.assign(Element.prototype, { getClientRects: noRects });
Object.assign(document, { elementFromPoint: () => null });

type Reply = { ok: boolean; status: number; body: unknown; problem: { title?: string } | null };
type LibraryRow = { id: string; path: string; alt: string; decorative: boolean; originalName: string };

const api = vi.hoisted(() => ({
  // The `document` string of every request to /api/v1/rich-text/paste.
  pastes: [] as string[],
  // null: paste answers arrive at once. A list: each answer waits for the test to release it.
  held: null as Array<() => void> | null,
  fail: false,
  library: [] as unknown[],
}));

vi.mock("../src/api/http", () => ({
  jsonInit: (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
  request: vi.fn(async (path: string, init?: RequestInit): Promise<Reply> => {
    if (path.startsWith("/api/v1/media")) {
      return { ok: true, status: 200, body: { items: api.library, page: 1, pageSize: 24, total: api.library.length }, problem: null };
    }
    if (path !== "/api/v1/rich-text/paste") throw new Error(`unexpected request ${path}`);
    const sent = (JSON.parse(String(init?.body)) as { document: string }).document;
    api.pastes.push(sent);
    const held = api.held;
    if (held !== null) await new Promise<void>((resolve) => held.push(resolve));
    if (api.fail) return { ok: false, status: 503, body: null, problem: { title: "Unavailable" } };
    return { ok: true, status: 200, body: pasteFilter(sent), problem: null };
  }),
}));

// Loaded at module level, after the stubs: antd takes seconds to load cold.
const { ConfigProvider } = await import("antd");
const { RichTextEditor } = await import("../src/content/RichTextEditor");
const { DOMParser: ProseMirrorParser } = await import("@tiptap/pm/model");

const imageNotice = "This paste included an image. Use the image button so you can add alt text.";
const failedNotice = "The paste could not be checked, so nothing was added. Paste again.";
const dropNotice = "The dropped content included an image, so it was not added. Use the image button for images.";

const storedId = "22222222-2222-4222-8222-222222222222";
const diagramId = "11111111-1111-4111-8111-111111111111";
const dividerId = "33333333-3333-4333-8333-333333333333";
const otherFieldId = "55555555-5555-4555-8555-555555555555";
// In no document and not in the library: only T13's crafted paste carries it.
const foreignId = "44444444-4444-4444-8444-444444444444";

const webImage = '<img src="https://cdn.example/a.png" alt="Remote">';

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; content?: Node[]; marks?: Array<{ type: string }> };

const paragraph = (text: string): Node => ({ type: "paragraph", content: [{ type: "text", text }] });
const image = (mediaId: string, alt: string, decorative = false): Node => ({ type: "image", attrs: { mediaId, alt, decorative } });
const documentOf = (...content: Node[]) => JSON.stringify({ type: "doc", content });
const stored = documentOf(paragraph("Before"), image(storedId, "Chart"), paragraph("After"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the TipTap editor, reached through its element
type EditorElement = HTMLElement & { editor: any };

const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

async function release(count?: number) {
  const waiting = api.held ?? [];
  for (const answer of waiting.splice(0, count ?? waiting.length)) {
    await act(async () => {
      answer();
    });
  }
  await settle();
}

/*
 * Mounts the editor in a host that keeps `value` in state and passes onChange
 * through, as FormWalker does, and records every value. With `other`, a button
 * replaces the value from outside, as opening another item does.
 */
function mount(initial: string, other?: string) {
  const seen: string[] = [];
  function Host() {
    const [value, setValue] = useState(initial);
    return (
      <>
        <RichTextEditor
          value={value}
          onChange={(next: string) => {
            seen.push(next);
            setValue(next);
          }}
          fieldPath="body"
          label="Body"
        />
        {other !== undefined ? <button type="button" onClick={() => setValue(other)}>open another item</button> : null}
      </>
    );
  }
  const view = render(<ConfigProvider theme={{ token: { motion: false } }}><Host /></ConfigProvider>);
  const dom = () => view.container.querySelector(".ProseMirror") as EditorElement;
  return {
    view,
    seen,
    dom,
    lastDocument: () => JSON.parse(seen.at(-1) ?? "null") as { type: string; content: Node[] },
    async type(text: string) {
      for (const character of text) {
        await act(async () => {
          dom().editor.chain().focus("end").insertContent(character).run();
        });
      }
    },
    // Characters at the selection as it is, replacing it when it is not a caret, as a pressed key does
    // (prosemirror-view's keypress handler: handleTextInput, else tr.insertText over the selection).
    async typeAtSelection(text: string) {
      for (const character of text) {
        await act(async () => {
          const { view } = dom().editor;
          const { from, to } = view.state.selection;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror's handleTextInput prop
          const handled = view.someProp("handleTextInput", (handler: any) => handler(view, from, to, character));
          if (!handled) view.dispatch(view.state.tr.insertText(character));
        });
      }
    },
    // A paste at the end of the document, or with `keepSelection`, at the selection as it is.
    async paste(html: string, keepSelection = false) {
      await act(async () => {
        if (!keepSelection) dom().editor.commands.focus("end");
        fireEvent.paste(dom(), {
          clipboardData: { getData: (type: string) => (type === "text/html" ? html : ""), files: [], types: ["text/html"] },
        });
      });
    },
    // Selects the first image as a click on it does (a node selection).
    async selectImage() {
      await act(async () => {
        let at = -1;
        dom().editor.state.doc.descendants((node: { type: { name: string } }, position: number) => {
          if (at < 0 && node.type.name === "image") at = position;
        });
        dom().editor.commands.setNodeSelection(at);
      });
    },
    async selectAll() {
      await act(async () => {
        dom().editor.commands.selectAll();
      });
    },
    images: () => (dom().editor.getJSON().content as Node[]).filter((node) => node.type === "image"),
    text: () => dom().editor.getText() as string,
    notice: () => view.container.querySelector("p.mt-2")?.textContent ?? null,
  };
}

type Mounted = ReturnType<typeof mount>;

async function pickFromLibrary(editor: Mounted, label: string) {
  await act(async () => {
    fireEvent.click(editor.view.getByRole("button", { name: "Image" }));
  });
  const tile = (await screen.findByText(label)).closest("button") as HTMLButtonElement;
  await act(async () => {
    fireEvent.click(tile);
  });
  await settle();
}

function sliceOf(editor: Mounted, html: string) {
  const box = document.createElement("div");
  box.innerHTML = html;
  return ProseMirrorParser.fromSchema(editor.dom().editor.view.state.schema).parseSlice(box);
}

beforeEach(() => {
  api.pastes.length = 0;
  api.held = null;
  api.fail = false;
  const library: LibraryRow[] = [
    { id: diagramId, path: "/media/a.webp", alt: "Diagram", decorative: false, originalName: "a.png" },
    { id: dividerId, path: "/media/b.webp", alt: "", decorative: true, originalName: "divider.png" },
  ];
  api.library = library;
});

afterEach(cleanup);

describe("ADM-03 rich text images", () => {
  // T1. The audit: "Typing after an existing image kept two characters of ' Edited.'".
  it("typing after a stored library image keeps the image and every character", async () => {
    api.held = [];
    const editor = mount(stored);
    await settle();

    await editor.type(" E");
    await release(1);
    await editor.type("dited.");
    await release();

    expect(editor.images()).toHaveLength(1);
    expect(editor.text()).toContain("After Edited.");
    expect(editor.lastDocument().content[1]).toEqual(image(storedId, "Chart"));
    expect(editor.lastDocument().content[2]).toEqual(paragraph("After Edited."));
    expect(api.pastes).toEqual([]);
  });

  // T2. The audit: "Inserting a library image removes it at once."
  it("inserting a library image keeps it", async () => {
    const editor = mount(documentOf(paragraph("Intro")));
    await settle();

    await pickFromLibrary(editor, "Diagram");

    expect(editor.images()).toHaveLength(1);
    expect(editor.lastDocument().content.filter((node) => node.type === "image")).toEqual([image(diagramId, "Diagram")]);
    expect(editor.seen.at(-1)).not.toContain('"src"');
    expect(api.pastes).toEqual([]);
  });

  // T4.
  it("a pasted web image is dropped with a notice and the text is kept", async () => {
    const editor = mount(documentOf(paragraph("Start")));
    await settle();

    await editor.paste(`<p>Hello <b>web</b></p>${webImage}<p>Tail</p>`);
    await settle();

    expect(editor.images()).toHaveLength(0);
    expect(editor.text()).toContain("Hello web");
    expect(editor.text()).toContain("Tail");
    expect(JSON.stringify(editor.lastDocument())).toContain('"bold"');
    expect(editor.notice()).toBe(imageNotice);
    // One request, holding the pasted slice as a list and not the document.
    expect(api.pastes).toHaveLength(1);
    expect(Array.isArray(JSON.parse(api.pastes[0]))).toBe(true);
    expect(api.pastes[0]).not.toContain('"src"');
    expect(api.pastes[0]).not.toContain("Start");
  });

  // T5.
  it("a paste never replaces what is already in the editor", async () => {
    api.held = [];
    const editor = mount(stored);
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    await editor.type(" typed");
    await release();

    expect(editor.images()).toHaveLength(1);
    expect(editor.images()[0].attrs?.mediaId).toBe(storedId);
    expect(editor.text()).toContain("Before");
    expect(editor.text()).toContain("typed");
    expect(editor.text()).toContain("Pasted");
  });

  // T6.
  it("pasting a copied library image keeps it", async () => {
    const editor = mount(stored);
    await settle();

    const copied = (editor.dom().querySelector("img") as HTMLImageElement).outerHTML;
    await editor.paste(copied);
    await settle();

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([storedId, storedId]);
    expect(editor.notice()).toBeNull();
  });

  // T7. A guard: it passes before the fix too.
  it("a paste without an image does not call the filter", async () => {
    const editor = mount("");
    await settle();

    await editor.paste("<p>Plain <i>text</i> only</p>");
    await settle();

    expect(editor.text()).toContain("Plain text only");
    expect(api.pastes).toEqual([]);
  });

  // T8.
  it("a failed filter request adds nothing and says so", async () => {
    api.fail = true;
    const editor = mount(documentOf(paragraph("Start")));
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    await settle();

    expect(editor.text()).not.toContain("Pasted");
    expect(editor.text()).toBe("Start");
    expect(editor.images()).toHaveLength(0);
    expect(editor.notice()).toBe(failedNotice);
  });

  // T9.
  it("a filter answer after the editor is gone is ignored", async () => {
    api.held = [];
    const editor = mount(stored);
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    const before = editor.seen.length;
    editor.view.unmount();
    await release();

    expect(editor.seen.length - before).toBe(0);
  });

  // T10. A guard: it passes before the fix too.
  it("pasting into a sentence joins the text as a normal paste does", async () => {
    const editor = mount(documentOf(paragraph("Start")));
    await settle();

    await editor.paste(`<p>one</p>${webImage}<p>two</p>`);
    await settle();

    expect(editor.lastDocument().content).toEqual([paragraph("Startone"), paragraph("two")]);
  });

  // T11. jsdom cannot turn drop coordinates into a position, so the editor's handleDrop prop is called directly.
  it("an outside drop that carries an image is refused with a notice", async () => {
    const editor = mount(documentOf(paragraph("Start")));
    await settle();
    const view = editor.dom().editor.view;
    const drop = (html: string, moved: boolean): unknown => {
      let handled: unknown;
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror's handleDrop prop
        handled = view.someProp("handleDrop", (handler: any) => handler(view, new Event("drop"), sliceOf(editor, html), moved));
      });
      return handled;
    };

    const outside = drop(`<p>Dropped</p>${webImage}`, false);

    expect(outside).toBe(true);
    expect(editor.text()).not.toContain("Dropped");
    expect(editor.notice()).toBe(dropNotice);
    expect(api.pastes).toEqual([]);

    // A move inside the editor, and a drop with no image, are left to ProseMirror.
    expect(drop(`<p>Moved</p>${webImage}`, true)).not.toBe(true);
    expect(drop("<p>Text</p>", false)).not.toBe(true);
  });

  // T12.
  it("typing the Markdown image pattern leaves it as text", async () => {
    const editor = mount("");
    await settle();
    const tiptap = editor.dom().editor;

    await act(async () => {
      tiptap.chain().focus("end").insertContent("See ![x](https://cdn.example/a.png").run();
    });
    // The closing bracket goes through handleTextInput, where input rules run, as a typed key does.
    await act(async () => {
      const { from, to } = tiptap.view.state.selection;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror's handleTextInput prop
      const handled = tiptap.view.someProp("handleTextInput", (handler: any) => handler(tiptap.view, from, to, ")"));
      if (!handled) tiptap.view.dispatch(tiptap.view.state.tr.insertText(")", from, to));
    });
    await settle();

    expect(editor.images()).toHaveLength(0);
    expect(editor.text()).toContain("See ![x](https://cdn.example/a.png)");
    expect(api.pastes).toEqual([]);
  });

  // T13. The attack test: a web page puts a media id of its own choosing on a pasted image.
  it("a crafted image with a media id from another page is dropped and its address is never sent", async () => {
    const crafted = `<p>Lure</p><img mediaid="${foreignId}" src="https://evil.example/t.gif" alt="tracking" decorative="true">`
      + '<img mediaid="nope" src="https://evil.example/u.gif" alt="b">';
    const editor = mount(documentOf(paragraph("Start")));
    await settle();

    const dropped = (requests: number) => {
      expect(api.pastes).toHaveLength(requests);
      for (const sent of api.pastes) {
        expect(sent).not.toContain('"src"');
        expect(sent).not.toContain("evil.example");
        expect(sent).not.toContain(foreignId);
      }
      expect(editor.images()).toHaveLength(0);
      expect(editor.dom().querySelectorAll("img")).toHaveLength(0);
      expect(JSON.stringify(editor.lastDocument())).not.toContain(foreignId);
      expect(editor.text()).toContain("Lure");
      expect(editor.notice()).toBe(imageNotice);
    };

    await editor.paste(crafted);
    await settle();
    dropped(1);

    // A second time: the first paste must not have made the id a known one.
    await editor.paste(crafted);
    await settle();
    dropped(2);
  });

  // T14.
  it("a library image copied from another rich-text field on the page is kept", async () => {
    const first = mount(documentOf(image(otherFieldId, "Map")));
    await settle();
    const second = mount(documentOf(paragraph("Second field")));
    await settle();

    const copied = (first.dom().querySelector("img") as HTMLImageElement).outerHTML;
    await second.paste(copied);
    await settle();

    expect(second.images().map((node) => node.attrs?.mediaId)).toEqual([otherFieldId]);
  });

  // T15.
  it("a filter answer after the document was replaced adds nothing", async () => {
    api.held = [];
    const editor = mount(stored, documentOf(paragraph("Other item")));
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    await act(async () => {
      fireEvent.click(editor.view.getByText("open another item"));
    });
    await release();

    expect(editor.text()).toContain("Other item");
    expect(editor.text()).not.toContain("Pasted");
    expect(editor.notice()).toBe(failedNotice);
  });

  /*
   * T16 to T21: the test report's round 1, findings 1 and 2. The answer to a
   * paste check must not replace what the person selected, or what the editor
   * selected for them, after the paste was made.
   */

  // T16. Plan round 4: the Image button leaves a caret after its new image, so the answer takes the caret rule.
  it("an image inserted while a paste is being checked is kept", async () => {
    api.held = [];
    const editor = mount(documentOf(paragraph("Start")));
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    await pickFromLibrary(editor, "Diagram");
    await release();

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([diagramId]);
    expect(editor.text()).toContain("Start");
    expect(editor.text()).toContain("Pasted");
    expect(editor.notice()).toBe(imageNotice);
    // At the caret (plan 3.1 (3), rule 1): the caret is in the paragraph after the picked image, and the answer fills it.
    expect(editor.lastDocument().content).toEqual([paragraph("Start"), image(diagramId, "Diagram"), paragraph("Pasted")]);
  });

  // T17.
  it("an image selected while a paste is being checked is kept", async () => {
    api.held = [];
    const editor = mount(stored);
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    await editor.selectImage();
    await release();

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([storedId]);
    expect(editor.text()).toContain("Before");
    expect(editor.text()).toContain("After");
    expect(editor.text()).toContain("Pasted");
    // Straight after the selected image.
    expect(editor.lastDocument().content).toEqual([paragraph("Before"), image(storedId, "Chart"), paragraph("Pasted"), paragraph("After")]);
  });

  // T18.
  it("a document selected while a paste is being checked is kept", async () => {
    api.held = [];
    const editor = mount(stored);
    await settle();

    await editor.paste(`<p>Pasted</p>${webImage}`);
    await editor.selectAll();
    await release();

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([storedId]);
    expect(editor.text()).toContain("Before");
    expect(editor.text()).toContain("After");
    expect(editor.text()).toContain("Pasted");
    // Straight after the selection, which is the whole document.
    expect(editor.lastDocument().content).toEqual([paragraph("Before"), image(storedId, "Chart"), paragraph("After"), paragraph("Pasted")]);
  });

  // T19. A guard: it passes before the fix too. What was selected when the paste was made is replaced, as a paste does.
  it("a paste over a selection replaces that selection", async () => {
    api.held = [];
    const editor = mount(stored);
    await settle();

    await editor.selectAll();
    await editor.paste(`<p>Pasted</p>${webImage}`, true);
    await release();

    expect(editor.images()).toHaveLength(0);
    expect(editor.text()).toContain("Pasted");
    expect(editor.text()).not.toContain("Before");
    expect(editor.text()).not.toContain("After");
  });

  // T20.
  it("a paste that is added clears the notice that nothing was added", async () => {
    const editor = mount(stored);
    await settle();
    const copied = (editor.dom().querySelector("img") as HTMLImageElement).outerHTML;

    api.fail = true;
    await editor.paste(copied);
    await settle();
    expect(editor.images()).toHaveLength(1);
    expect(editor.notice()).toBe(failedNotice);

    // The notice says "Paste again."
    api.fail = false;
    await editor.paste(copied);
    await settle();

    expect(editor.images()).toHaveLength(2);
    expect(editor.notice()).toBeNull();
  });

  // T21.
  it("a paste that is added clears the notice that a drop was refused", async () => {
    const editor = mount(documentOf(paragraph("Start")));
    await settle();
    const view = editor.dom().editor.view;

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror's handleDrop prop
      view.someProp("handleDrop", (handler: any) => handler(view, new Event("drop"), sliceOf(editor, `<p>Dropped</p>${webImage}`), false));
    });
    expect(editor.notice()).toBe(dropNotice);

    await editor.paste("<p>Plain text</p>");
    await settle();

    expect(editor.text()).toContain("Plain text");
    expect(editor.notice()).toBeNull();
  });

  // T22. CI, E2 on 7aece22: the image was gone after it was picked and text was typed.
  it("typing straight after inserting a library image keeps the image", async () => {
    const editor = mount("");
    await settle();

    // As E2 does: type, so the caret is at the end of the text, then pick.
    await editor.type("Intro.");
    await pickFromLibrary(editor, "Diagram");
    // No caret move in between: the keys go where the Image button left the selection.
    const selectionAfterPick = editor.dom().editor.state.selection.toJSON().type as string;
    await editor.typeAtSelection("After the image.");

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([diagramId]);
    // A caret, not the image selected: a selected image is replaced by the next key.
    expect(selectionAfterPick).toBe("text");
    expect(editor.lastDocument().content).toEqual([paragraph("Intro."), image(diagramId, "Diagram"), paragraph("After the image.")]);
    expect(api.pastes).toEqual([]);
  });

  // T23. Plan round 4, 3.1 (8): with another image straight after the new one, the caret goes beyond both.
  it("inserting a library image before another image leaves neither selected", async () => {
    const editor = mount(documentOf(paragraph("Intro."), image(storedId, "Chart")));
    await settle();

    // The caret at the end of "Intro.", where it is after typing.
    await act(async () => {
      editor.dom().editor.commands.setTextSelection(1 + "Intro.".length);
    });
    await pickFromLibrary(editor, "Diagram");
    const selectionAfterPick = editor.dom().editor.state.selection.toJSON().type as string;
    await editor.typeAtSelection("Next.");

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([diagramId, storedId]);
    expect(selectionAfterPick).toBe("text");
    expect(editor.lastDocument().content).toEqual([
      paragraph("Intro."),
      image(diagramId, "Diagram"),
      image(storedId, "Chart"),
      paragraph("Next."),
    ]);
  });

  // T24. An empty field is what a new section's editor is.
  it("inserting a library image into an empty field keeps it when typing follows", async () => {
    const editor = mount("");
    await settle();

    await pickFromLibrary(editor, "Diagram");
    await editor.typeAtSelection("After the image.");

    expect(editor.images().map((node) => node.attrs?.mediaId)).toEqual([diagramId]);
    expect(editor.lastDocument().content).toEqual([image(diagramId, "Diagram"), paragraph("After the image.")]);
  });
});
