# ADM-03: plan

Change id: `ADM-03`. Branch: `change/ADM-03`, worktree `/home/user/dh-change-adm03`,
cut from `origin/rebuild/dotnet-platform` at `77296ba`.
Architect, round 3, 11 November 2026. Round 1 (`15164df`) came back CHANGES
NEEDED (`plan-review.md` Round 1 at `fda6532`: one Major, five Minors), answered
in round 2. Round 3 confirms the developer's insert rule after the tester's
finding 1 (`test-report.md` round 1; `implementation.md` section R at
`fb7615f`). Section 12 answers each point.

**One change, no split.** ADM-06 was split because it had an API half and a
Studio half. ADM-03 is fixed in one module, the Studio's rich-text editor: two
source files under `studio/src/content/`, and no API change (3.4 says why).

## 1. Item

- **Closes:** ADM-03, "images in rich text are deleted, and typing after them is
  lost", `docs/quality/admin-audit-2026-10-28.md` lines 92-103. It is the gap in
  that audit's requirement table for FR-S-06 rich text: "Partly | Images deleted,
  typing lost (ADM-03)".
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. Order in the
  batch: "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a" (refinement plan, Execution
  order, step 2). ADM-06 is closed: ADM-06a merged as #49 (`1f53484`) and ADM-06b
  as #51 (`77296ba`). ADM-03 is next.
- **Owner's request:** "merge  and start next task" (Mohamed Elbadry,
  10 November 2026, project thread), and the card answer "Yes, merge #51"
  (Mohamed Elbadry, 11 November 2026), whose option said the next admin blocker
  starts after the merge. The coordinator took ADM-03 as that task.
- **Done when**, quoted from the audit:
  > **ADM-03: images in rich text are deleted, and typing after them is lost.**
  > - `RichTextEditor.tsx:117-121` sends the whole document to `/rich-text/paste` on
  >   every keystroke once it contains an image node with a `src` key. Every image
  >   node has `src: null`.
  > - The server filter (`RichText.cs:98-103`) then drops library images too, and the
  >   result is set back into the editor while the person types.
  > - Inserting a library image removes it at once. Typing after an existing image
  >   kept two characters of " Edited.".
  > - Fix:
  >   - Filter only real paste events, in `handlePaste`.
  >   - Keep image nodes with a valid `mediaId`.
  >   - Never replace the document from `onUpdate`.
- **Batch exit gate**, quoted from the refinement plan, Track G3:
  > A clean website build from `DigitalHubContent_Studio` with no patched content;
  > each blocker reproduced before its fix and passing after it
- **Track rule** (refinement plan, Track G3): "Every fix carries a regression
  test that fails first." `docs/changes/README.md`, G3 checklist: "The
  regression test is committed and shown failing before the fix."
- **The design this must keep** (`docs/phase-b-studio.md`):
  - 6.9: "Images inside rich text carry a media id only, never a URL. They also
    carry alt text, unless the image is marked decorative."
  - 7.7: "Pasting from Word or a web page keeps only allowed nodes and drops
    everything else. The editor calls the same filter the server uses."

### Required reading

| Document | Where read | Present |
| --- | --- | --- |
| `docs/changes/README.md`, `.claude/agents/architect.md`, `AGENTS.md`, `CLAUDE.md` | worktree | Yes |
| `ENGINEERING_STANDARDS.md` | `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md` | Yes, not on the base |
| `docs/PROJECT_PROFILE.md`, `docs/deferred-items.md` ("No entries yet.") | same branch, `git show` | Yes, not on the base |
| `docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes, not in the worktree |
| `docs/changes/ADM-06/plan.md`, `docs/changes/ADM-06b/plan.md` | worktree | Yes (the model for this plan) |
| `docs/phase-b-studio.md`, `docs/business-analysis.md` (FR-S-06) | worktree | Yes |
| `docs/adr/0001-split-public-forms-api.md` | not needed (G2 only); `docs/adr/` is not on the base | n/a |

Round 2 also read `docs/changes/ADM-03/plan-review.md` (Round 1). There is no
`plan-approval.md` or `implementation.md` yet.

Rules that apply: P-4 (failing test first), P-5 (fail closed), P-6, P-7, P-8,
B-6 (red test committed before the fix), B-7, B-8 (one topic), A-12 (the Studio
calls the API through `studio/src/api/http.ts`).

## 2. Current state

### 2.1 The base

```
$ git -C /home/user/dh-change-adm03 log --oneline -2
77296ba ADM-06b: Add paging controls to the Studio's long lists (#51)
1f53484 ADM-06: Bind PageQuery from the query root (ADM-06a) (#49)
$ git -C /home/user/dh-change-adm03 status
On branch change/ADM-03
nothing to commit, working tree clean
$ gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open' --jq '.[]|"\(.number) \(.head.ref)"'
44 change/GAP-07
```

PR #44 changes only `.github/security/*`, `.github/workflows/security.yml` and
`docs/changes/GAP-07/*` (`gh api .../pulls/44/files`). Nothing open touches a
file in this plan's scope.

### 2.2 The code

`studio/src/content/RichTextEditor.tsx` (283 lines; last changed by `5c07f4b`):

- **Lines 27-36, `StudioImage`.** It replaces the image node's attributes with
  `mediaId`, `alt`, `decorative` and `src: { default: null, rendered: false }`.
  So every image node in the editor has a `src` key, `null` unless the node came
  from a paste or from `insertImage`. It keeps the parent's parse rule
  (`@tiptap/extension-image` 3.31.3, `src/image.ts:124-130`:
  `img[src]:not([src^="data:"])`) and the parent's Markdown input rule
  (`src/image.ts:317-329`).
- **Lines 108-115, `handlePaste(_view, event)`.** It only refuses image files on
  the clipboard. It ignores the third argument ProseMirror passes, the parsed
  slice (`prosemirror-view` 1.42.5, `dist/index.d.ts:708`).
- **Lines 117-124, `onUpdate`.** The defect:
  ```ts
  const raw = JSON.stringify(current.getJSON());
  if (raw.includes('"type":"image"') && raw.includes('"src"')) {
    void filterPaste(raw, current, onChange, setNotice);
    return;
  }
  onChange(cleanDocument(current.getJSON()));
  ```
  The test is true for any document that holds an image, on every keystroke.
  `onChange` is then skipped.
- **Lines 182-200, `filterPaste`.** It posts the whole document to
  `/api/v1/rich-text/paste`, and when the answer arrives it calls
  `editor.commands.setContent(...)` with it, then `onChange`. It does this even
  if the person has typed since, and even if the editor has been removed.
- **Lines 133-144, `insertImage`.** It inserts
  `{ mediaId, alt: choice.alt, decorative: false, src: choice.path }`.
- **Lines 127-131, the `value` effect.** It resets the editor only when the
  `value` prop differs from the editor's own cleaned document. That is not the
  defect and stays as it is (T1 in 5.1 guards it).

**The editor has two hosts** (added in round 2):

- `studio/src/content/FormWalker.tsx:110`, for every `richText` field of a page
  or a collection item. Those saves go through `ContentStore`.
- `studio/src/pages/ErrorPagesPage.tsx:68`, the body of the 404 and 500 pages.
  That save is `AdminStore.UpdateErrorPageAsync` (`AdminStore.cs:549-599`).

`studio/src/content/MediaPicker.tsx`: `MediaChoice` is `{ id, path, alt }`
(lines 7-11), built at lines 106 and 144. The API's media rows also carry
`decorative` (`MediaLibrary.cs:238,267`), which the picker does not pass on.

Server, unchanged by this plan:

- `api/src/DigitalHub.Api/Controllers/RichTextController.cs:8,12-17`:
  `POST /api/v1/rich-text/paste`, policy `studio`, body `{ document }`.
- `api/src/DigitalHub.Api/Content/RichText.cs`:
  - `FilterPaste` (98-103) and `Paste` (105-137). `Paste` accepts a document or,
    at lines 130-133, a bare list of nodes.
  - `ImageNode` (305-336): lines 309-313 drop an image whose `attrs` has a key
    named `src`, `url` or `href`, whatever its value. Lines 315-317 require a
    GUID `mediaId`. Lines 323-324 drop an image with no alt text that is not
    decorative.
  - `Validate` → `Image` (579-619), run on every save
    (`ContentStore.cs:690,726`, `AdminStore.cs:558`): "Images carry a media id,
    not a URL." for any `src` key (593), and the alt-text rule (612-617).
- **Whether the id is in the library** (corrected in round 2):
  - The paste filter does not check it. `ImageNode` checks the shape only: any
    well-formed GUID with alt text, or marked decorative, is kept.
  - A page or item save does: "<id> is not in the library."
    (`ContentStore.cs:752-753`).
  - The error-page save does not. `UpdateErrorPageAsync` runs `RichText.Validate`
    (`AdminStore.cs:558`) and writes the body. That gap is older than this
    change and is the server's; 3.1 (4) keeps this change from making it
    reachable by paste, and 4 passes it to ADM-05.
- `api/tests/DigitalHub.Api.Tests/RichTextTests.cs` covers `Validate` and `Paste`
  as functions. No test calls the route. No Studio test, unit or end-to-end,
  touches the rich-text editor (`grep -rn -i "paste\|rich" studio/e2e studio/test`
  finds only `case-study-theme.test.tsx`, which imports `FormWalker`).

### 2.3 Reproduced before any fix

Nothing in the repository was changed or built. `studio/node_modules` is not
installed in this worktree, so the runs used the modules already installed in
`/home/user/dh-change-adm06b/studio/node_modules` (read only), whose lockfile
and source files are byte-identical to this worktree's:

```
$ for f in studio/src/content/RichTextEditor.tsx studio/src/content/MediaPicker.tsx studio/src/api/http.ts \
           studio/src/content/model.ts studio/package-lock.json api/src/DigitalHub.Api/Content/RichText.cs; do
    diff -q /home/user/dh-change-adm06b/$f /home/user/dh-change-adm03/$f && echo "same $f"; done
same studio/src/content/RichTextEditor.tsx
same studio/src/content/MediaPicker.tsx
same studio/src/api/http.ts
same studio/src/content/model.ts
same studio/package-lock.json
same api/src/DigitalHub.Api/Content/RichText.cs
```

Versions as installed: `@tiptap/core`, `@tiptap/react`, `@tiptap/extension-image`,
`@tiptap/pm` 3.31.3; `prosemirror-view` 1.42.5; `vitest` 5.0.5; `jsdom` 30.1.2.

The scripts and their output are in the session scratchpad, outside the
repository: `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm03/`
(`repro/`, `server/`, `proto/`, `repro-before.txt`, `planned-runs.txt`). They
are evidence for this plan and are not committed. No port was used.

**(a) The editor, in jsdom (`repro/repro.test.tsx`).** It renders the real
`RichTextEditor` with `request` mocked. The mock applies the server's image rule
from `RichText.cs:309-317`. Output, shortened only where marked:

```
R1 getJSON image attrs: {"type":"image","attrs":{"mediaId":"22222222-2222-4222-8222-222222222222","alt":"Chart","decorative":false,"src":null}}
R1 DOM: <p>Before</p><img mediaid="22222222-…" alt="Chart" decorative="false" draggable="true"><p>After</p>
R1 first payload: {"type":"doc","content":[…,{"type":"image","attrs":{"mediaId":"22222222-…","alt":"Chart","decorative":false,"src":null}},{"type":"paragraph","content":[{"type":"text","text":"After "}]}]}
R1 final editor: {"type":"doc","content":[{"type":"paragraph",…"Before"…},{"type":"paragraph",…"After Edited."…}]}

R2 paste calls: 1 {"type":"doc","content":[{"type":"image","attrs":{"mediaId":"11111111-…","alt":"Diagram","decorative":false,"src":"/media/a.png"}},…"Intro"…]}
R2 final editor: {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Intro"}]}]}

R4 typed ' E': requests 2 in flight 2 editor "After E" images 1
R4 response 1 arrived: editor "After " images 0
R4 typed 'dited.': requests 2 editor "After dited." images 0
R4 response 2 arrived: editor "After E" images 0
R4 last onChange: {…"Before"…,{"type":"paragraph","content":[{"type":"text","text":"After E"}]}]}
```

- **R1:** a stored library image has `src: null`. The first keystroke sends the
  whole document, and the image is gone from the editor and from `onChange`.
- **R2:** inserting a library image removes it at once (the audit's third bullet).
- **R4:** with two filter answers in flight, typing " Edited." ends as "After E".
  The editor kept " E", **two characters of " Edited."**, which is the audit's
  figure. The second, older answer overwrote what was typed after the first.

**(b) The real server filter (`server/Program.cs`).** A scratch console project
compiles the worktree's `RichText.cs` by link and calls `FilterPaste`, built with
the .NET SDK 10.0.114 in Release:

```
A  what the editor sends today for a stored library image (R1 payload)
  out: {"type":"doc","content":[{"type":"paragraph",…"Before"…},{"type":"paragraph",…"After "…}]}
  imagesDropped: True
B  the same document without the src key
  out: {"type":"doc","content":[{"type":"image","attrs":{"mediaId":"22222222-2222-4222-8222-222222222222","alt":"Chart"}}]}
  imagesDropped: False
C  a pasted slice as a list: text, a web image (cleaned: mediaId null), a library image
  out: {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello "},{"type":"text","text":"web","marks":[{"type":"bold"}]}]},{"type":"image","attrs":{"mediaId":"22222222-…","alt":"Chart"}}]}
  imagesDropped: True
D  a library image with empty alt, not decorative
  out: {"type":"doc","content":[]}
  imagesDropped: True
E  Validate, library image with empty alt, not decorative: content[0] needs alt text, or the image must be marked decorative.
F  Validate, image with src null: Images carry a media id, not a URL.
```

- **A** is the audit's second bullet: the server drops the library image because
  of the `src` key.
- **B and C** show the server already keeps an image with a valid `mediaId` when
  the Studio does not send `src`, and already accepts a bare list of nodes.

**(c) Other ways an image reaches the editor today**, from the same runs:

| Way in | Today | Evidence |
| --- | --- | --- |
| Paste from a web page, with an image | Text kept, image removed, notice shown. But the whole document is filtered, so library images already in it are removed too | R3; A |
| Paste of an image copied or cut inside the editor | The image is lost silently, with no filter call. The editor renders `<img mediaid=…>` with no `src`, and the only parse rule is `img[src]` | "R3 own-image paste (no src): calls 0", and no image in the result |
| Paste with no image | Not sent to the filter; ProseMirror's schema decides | "R3 text-only paste: calls 0" |
| Drop from another page, with an image | Inserted, then removed by the `onUpdate` filter | Same path as R3 |
| Typing `![alt](url)` | The input rule makes an image node; the filter removes it and the typed text | `image.ts:317-329`; T12 in 5.1: "expected 'See \n\n' to contain 'See ![x](https://cdn.example/a.png)'" |
| The Image button, for an image the library marks decorative with no alt | Removed at once, like any image. If it stayed, the node would be `alt: ""`, `decorative: false`, which a save refuses | R2; D and E |

Once `onUpdate` stops filtering, the drop and input-rule rows would leave an
image with no media id in the editor until a save refuses it. The design in 3.1
closes both.

### 2.4 Tests and harness

- **Vitest** (`studio/vitest.config.ts`): `test/**/*.test.ts(x)`, `environment:
  "node"`; a file opts into jsdom with `// @vitest-environment jsdom`.
  `studio/test/listPaging.test.tsx` is the pattern: `vi.mock("../src/api/http")`,
  stubs for `matchMedia` and `ResizeObserver`, `afterEach(cleanup)`, and
  `ConfigProvider theme={{ token: { motion: false } }}` so the picker's modal
  opens in jsdom.
- **What jsdom lacks for this editor**, found by running it:
  - `Range.prototype.getClientRects`, `Range.prototype.getBoundingClientRect`,
    `Element.prototype.getClientRects`: ProseMirror's `scrollToSelection` throws
    "target.getClientRects is not a function" after `focus()`.
  - `ClipboardEvent`: `view.pasteHTML(html)` throws "ClipboardEvent is not
    defined". `fireEvent.paste(dom, { clipboardData: {...} })` works and goes
    through ProseMirror's real paste handler.
  - Real typing. The tests reach the editor through the property TipTap sets on
    its element (`@tiptap/core/src/Editor.ts:626`, `dom.editor = this`) and use
    `editor.chain().focus("end").insertContent(ch).run()` per character. That
    runs `onUpdate`, as a keystroke does. Real keystrokes are covered end to end.
- **Type check:** `tsconfig.node.json` includes `test/**/*.ts`, not `.tsx`. A
  `.tsx` test is run by Vitest and not type-checked, like `listPaging.test.tsx`.
  A `.ts` helper under `test/support/` is type-checked and must import nothing
  from `src` (ADM-06b round 3, TS6307).
- **Studio end-to-end:** `studio/playwright.config.ts`, one worker, files in
  alphabetical order, 90 s per test. The harness (`e2e/env.ts`) runs the API on
  `DigitalHubContent_E2e` and refuses any other catalogue. Seeding precedents:
  `preview.spec.ts:12-33` (create a page, then `PUT /api/v1/pages/{id}/save` with
  sections); `helpers.ts` `addSection(page, label)`; `verification.spec.ts:474-503`
  `uniquePng()` (the library de-duplicates on the image hash, so a shared fixture
  keeps its old alt text). Uploads are limited to 20 an hour per user
  (`Program.cs:113`); the suite uses two today (10.15, P2.8).
- **CI:** `ci.yml` job `studio` runs `npm ci`, `npx tsc -b`, `npm test`,
  `npm run build`, then the end-to-end suite. A failing unit test stops the job
  before the end-to-end step. `concurrency` cancels a run when a newer push
  arrives (lines 23-25).
- **This container:** Node `v22.23.4`. No SQL Server, so the Studio end-to-end
  suite and the API integration suite run only in CI. The .NET SDK 10.0.114 is
  available through
  `source /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh`.

## 3. Design

### 3.1 Approach

All in `RichTextEditor.tsx`, plus one field in `MediaPicker.tsx` (item 7).

1. **`onUpdate` only reports.** It calls `onChange(cleanDocument(current.getJSON()))`
   and nothing else: no request, no `setContent`. (Audit fix 3.)
2. **The filter runs for a paste, in `handlePaste(view, event, slice)`.**
   (Audit fix 1.)
   - Image files on the clipboard: unchanged (notice, handled).
   - The pasted slice holds no image node: return `false`. ProseMirror pastes it
     as today. Today such a paste never reaches the filter either (2.3 c).
   - The slice holds an image node: return `true` and send **the slice only**,
     never the document:
     `{ document: JSON.stringify(slice.content.toJSON().map(cleanNode)) }`, a
     bare list, to `/api/v1/rich-text/paste` through `request` (A-12).
     `cleanNode` already reduces an image to `mediaId`, `alt`, `decorative`, so
     no `src` key is sent.
3. **The answer is inserted, never set.** When the filter answers:
   - If the editor has been removed (a mounted flag in a ref, or
     `view.isDestroyed`): do nothing. TipTap destroys the view a moment after
     unmount, so the flag is needed; without it `onChange` fired after unmount in
     the prototype.
   - If the editor's document was replaced from outside while the request was
     out (the `value` effect ran `setContent`, for example another item was
     opened in the same editor): insert nothing and show the "could not be
     checked" notice below. A counter in a ref, raised where the effect calls
     `setContent`, is read before the request and again after it. (Round 2;
     without it the reviewer's probe P7 gave `"Other itemPasted"`.)
   - On success: build a fragment from the filtered nodes
     (`Fragment.fromJSON(view.state.schema, content)`, from `@tiptap/pm/model`,
     already a dependency) and dispatch one transaction that
     inserts `piece` by the rule in the next bullet. `piece` is a `Slice` over the fragment whose open depths are the pasted
     slice's, each capped by `Slice.maxOpen(fragment)`. So pasted text joins the
     sentence it is pasted into, as a normal paste does. An empty fragment
     inserts nothing.
   - **Where the answer goes (round 3; replaces round 2's "at the selection of
     that moment").** The editor state at paste time is kept and compared with
     the state when the answer arrives.
     1. The selection is a caret: `replaceSelection(piece)`, at the caret.
     2. The selection is the one the paste was made over and the document has
        not changed since (`doc.eq` and `selection.eq` against the kept state):
        `replaceSelection(piece)`. That is a paste over a selection, which the
        person asked for.
     3. Any other selection, so one made after the paste: insert straight after
        it, `replaceRange(to, to, piece)` with `to` the selection's end, and
        put the caret at the end of what was added. Nothing is replaced.
     "After the selection" is the design, not only the developer's choice. It
     is the nearest place to the caret rule that replaces nothing; it keeps
     reading order; and for the Image button, which leaves its new image
     selected, the pasted content follows the image, as it follows text typed
     in that moment. Inserting before the selection, or collapsing it to its
     head, would do no better and would differ from rule 1 for no reason.
   - A paste that is added clears this change's own two notices, "could not be
     checked" and the drop notice, and only those (round 3). The older image
     notice stays as it was, for ADM-22.
   - If `imagesDropped`: show the existing notice, "This paste included an image.
     Use the image button so you can add alt text."
   - On a failed request, or an answer that cannot be built: insert nothing and
     show "The paste could not be checked, so nothing was added. Paste again."
     This fails closed (P-5), and the clipboard still holds the content.
   - **What is kept (corrected in round 3; round 2 said "Nothing is lost").**
     Everything in the editor when the answer arrives is kept: text typed
     meanwhile, an image inserted meanwhile, and anything selected meanwhile.
     The only content the answer replaces is what was selected when the person
     pasted, if it is still selected and the document is unchanged. The pasted
     content may follow text typed, or a selection made, in that moment. Two
     pastes whose answers come back in the other order are inserted in answer
     order (reviewer's probe P3: `"StartBBBAAA"`); both are added.
4. **A library image survives a copy or cut and paste, and only a library
   image does.** (Audit fix 2; the second half is round 2.)
   - `StudioImage.parseHTML()` returns `img[mediaid]` first, then the existing
     `img[src]:not([src^="data:"])`. The editor's own image HTML is then parsed
     back into a node with its `mediaId`.
   - **A pasted media id counts only if this Studio session already got it from
     the API.** The module keeps a set of media ids, compared in lower case. An
     id enters the set in three places only:
     - from the document the editor is created with;
     - from a document the `value` effect sets into the editor;
     - from the picker, in `insertImage`.
     So the set holds ids the API served in a document, or the person chose
     from the library. It is shared by every rich-text field open in the tab,
     so an image can be copied from one field to another.
   - Before the slice is sent to the filter, every image node whose `mediaId`
     is not in the set has its `mediaId` set to `null`. The server filter then
     drops it like any image with no media id and answers `imagesDropped`, so
     the existing notice shows. The foreign id is never sent, never enters the
     document or the undo history, and never reaches a save.
   - This closes the reviewer's finding 1 inside the Studio. A web page cannot
     put a media id into the editor: a crafted `img[mediaid][src]` is dropped
     whether or not its id is a GUID (T13). It also covers an id from another
     Studio or of a row since deleted, unless this tab loaded it in a document.
   - A library image copied in another browser tab, or another Studio, is
     dropped with the notice unless this tab has seen its id. The Image button
     is the way in. Listed for the owner in section 9.
5. **A drop from outside that carries an image is refused.**
   `handleDrop(view, event, slice, moved)`: when `moved` is false and the slice
   holds an image node, return `true` and show "The dropped content included an
   image, so it was not added. Use the image button for images." A move inside
   the editor (`moved` true) and a drop with no image return `false`, as today.
   ProseMirror also passes `moved` as false for a drag that starts in this
   editor with the copy modifier held (`prosemirror-view/dist/index.js:3863`),
   so a Ctrl-drag copy of an image is refused too. It fails closed; copy and
   paste does the same job. Listed in section 9.
6. **Typing the Markdown image pattern stays text.** `StudioImage.addInputRules()`
   returns `[]`.
7. **Only on "Yes" to O-ADM03-2:** an image the library marks decorative is
   inserted as decorative. `MediaChoice` gains `decorative: boolean`, set from the
   media row at `MediaPicker.tsx:106` and `:144` (`=== true`, so a row without the
   field gives `false`). `insertImage` uses `decorative: choice.decorative`.
   `FormWalker.tsx:184,201`, `ItemEditorPage.tsx:396` and
   `MediaLibraryPage.tsx:169` read only `id`, `path` and `alt`, and are unchanged.

After items 2 to 6 the only ways an image node enters the editor are: a stored
document, the Image button, a move inside the editor, and a paste that the
server filter has passed and whose media id this session already held. The
save's `Validate` stays the final check.

**Checked by prototype.** A scratch copy of the editor with items 1 to 7
(`proto/RichTextEditor.fixed.tsx`, `proto/MediaPicker.fixed.tsx`) type-checks
under the Studio's `tsconfig.app.json` settings (`tsc`, exit 0) and passes the
fifteen tests of 5.1. The same tests against today's editor: 13 fail, 2 pass.
Against the round 1 design (`proto/RichTextEditor.round1.tsx`): T13 and T15
fail, so those two test the round 2 additions (`planned-runs-round2.txt`). The
prototype is evidence that the plan can be followed. The developer writes the
change from this plan.

### 3.2 Why the insert follows the pasted slice's open depths

`planned.test.tsx` T10 pastes `<p>one</p><img src=…><p>two</p>` after "Start".
Today's editor and the prototype both give `"Startone"` then `"two"`. So the
rule in 3.1 (3) gives the same text layout as an ordinary paste.

### 3.3 Alternatives rejected

- **Change the server so a null `src` is ignored.** It would work, but it loosens
  a filter rule to suit one caller, adds an API change and its tests to a Studio
  fix, and is not needed: the Studio should never send `src` (6.9), and
  `cleanNode` already removes it. `Validate` rejects a `src` key too (run F), so
  the two server rules stay alike.
- **Filter on the client only, with no request** (a synchronous `transformPasted`
  that drops images without a media id). Simpler, and it cannot race. Rejected:
  7.7 says "The editor calls the same filter the server uses", and the audit's
  fix says to filter "in `handlePaste`". A second copy of the image rule in
  TypeScript could drift from `RichText.cs`. Dropping the server call would be a
  design change for the owner, not a defect fix.
- **Ask the library about each pasted id** (`GET /api/v1/media/{id}`,
  `MediaController.cs:20-22`), and keep the image only on 200. It is the
  authoritative answer, and it would let an image be pasted from another tab.
  Rejected: the pasted content would decide how many requests the Studio makes,
  and each one also scans every table for the image's uses
  (`MediaLibrary.GetAsync`, `MediaUsage.FindPlacesAsync`). It needs a cap and a
  rule for a failed lookup. The session set needs no request and fails closed.
- **Check the library in the server filter, or in the error-page save.** Either
  is an API change, so a second module and a split. The first is not needed
  once the Studio never sends a foreign id. The second is a real gap, but it
  belongs with the error-page save, which ADM-05 reworks (4).
- **Send every paste to the filter.** Today a paste with no image is not
  filtered (2.3 c). Changing that is new behaviour for every paste, with a
  network round trip each time. Not part of ADM-03.
- **Paste first, then filter and replace.** That is the defect: an answer that
  replaces content loses whatever changed meanwhile.
- **Lock the editor while the filter request is out.** It keeps the paste at the
  exact caret, but a slow request would freeze typing. Inserting at the caret of
  the moment loses nothing.
- **Filter an outside drop like a paste, at the drop point.** It needs the drop
  coordinates turned into a position, which jsdom cannot do, so it could only be
  tested end to end. Refusing the drop is four lines, synchronous, and fails
  closed. The person can paste the same content.
- **Leave the drop and the input rule alone.** Then moving the filter out of
  `onUpdate` would let an image with no media id sit in the editor until a save
  refuses it. Today both are caught (2.3 c), so that would be a regression.
- **Remove the `src` attribute from the node.** `insertImage` and pasted web
  images would then carry nothing to drop, but the attribute is harmless once
  `onUpdate` stops testing for it, and a later change that shows the picture in
  the editor (4, out of scope) may want it.
- **An API test for the list-shaped paste body.** It would pass today, so it is
  not a regression test, and it would add the API test project to this change.
  E2 (5.1) exercises the real route with the real payload in CI.

### 3.4 One change, not two

- Files with behaviour changes: `studio/src/content/RichTextEditor.tsx`, and
  `studio/src/content/MediaPicker.tsx` only on "Yes" to O-ADM03-2. Both are the
  Studio's content editor.
- No `api/` file changes: runs B and C show the server already does what the
  audit's second fix asks, once the Studio sends what 6.9 describes.
- So there is no API half to merge first, and no merge-order risk like ADM-06's.

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `studio/e2e/rich-text.spec.ts` | End-to-end tests E1 and E2 (5.1). |
| `studio/test/richText.test.tsx` | Render tests T1 to T15 (5.1), `// @vitest-environment jsdom`. |
| `studio/test/support/pasteFilter.ts` | A fake of `/api/v1/rich-text/paste` for the render tests. Self-contained (no `src` import). It takes the request's `document` string, accepts a document or a bare list, and applies the image rule of `RichText.cs:305-336`: drop an image whose `attrs` has `src`, `url` or `href`, or no GUID `mediaId`, or no alt text unless decorative; rebuild kept images as `mediaId`, `alt` when not blank, `decorative` when true. Other nodes pass through. It returns `{ document, imagesDropped }`. A comment names the server lines it copies. |
| `docs/changes/ADM-03/*` | Pipeline records. |

### Files to change

| File | Change |
| --- | --- |
| `studio/src/content/RichTextEditor.tsx` | 3.1 items 1 to 6: `onUpdate` only calls `onChange`; `handlePaste` takes the slice and sends an image-carrying slice to the filter; the answer is inserted with `replaceSelection`; the mounted flag and the replaced-document counter; the session set of media ids, filled from loaded documents and the picker, and the `mediaId: null` rule for ids outside it; `parseHTML` and `addInputRules` on `StudioImage`; `handleDrop`. `filterPaste` (182-200) is replaced by the new function. `cleanNode`, `cleanDocument`, `parseDocument`, the `value` effect, the toolbar and `LinkDialog` are unchanged. On "Yes" to O-ADM03-2, `insertImage` also takes `decorative` from the choice. |
| `studio/src/content/MediaPicker.tsx` | **Only on "Yes" to O-ADM03-2.** `MediaChoice` gains `decorative: boolean`; `MediaRow` gains `decorative?: boolean`; the two `onSelect` calls pass it. Nothing else. |
| `studio/test/listPaging.test.tsx` | **Only on "Yes" to O-ADM03-2.** S11's expected choice (line 400) gains `decorative: false`. The assertion becomes stricter; nothing is removed (P-6). |

### Out of scope (left alone on purpose)

- Every `api/` file, including `RichText.cs`, `RichTextController.cs` and
  `RichTextTests.cs` (3.3, 3.4).
- `InlineTextEditor.tsx`: its `onUpdate` (line 128) only calls `onChange`; it has
  no image node.
- `website/` and `packages/blocks/src/richtext/*`: how the website renders rich
  text is unchanged.
- `studio/package.json`, `package-lock.json`, every `tsconfig*.json`,
  `vitest.config.ts`, `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`,
  `verification.spec.ts`, `.github/workflows/*`. No dependency, config, harness
  or workflow change. `@tiptap/pm` is already a direct dependency.
- **Found here, not fixed here.** Each goes to ADM-22 ("rich-text gaps", G3-3),
  through a section headed **"For ADM-22"** in `implementation.md` and in the
  pull request body, as ADM-06b did for ADM-08:
  - The editor shows an image as its alt text, not as a picture: `src` is
    `rendered: false`, and a stored node has no path (R1 DOM in 2.3).
  - A notice, once shown, stays until the editor is reloaded.
  - StarterKit lets the editor make marks and nodes the server refuses on save
    (for example strike and underline); only image-carrying pastes are filtered.
  - A paste of table cells that hold an image goes through the filter and is
    inserted as a table at the caret, not merged into the selected cells:
    `editorProps.handlePaste` runs before the table plugin's
    (`prosemirror-tables/dist/index.js:2180`; reviewer's probe P4). Today that
    paste loses its images, so this is no worse.
  - A library image copied in another tab is dropped on paste (3.1, 4). A
    library lookup could allow it (3.3).
  - Per-use alt text and a decorative switch inside rich text (already in ADM-22:
    "No per-use alt in rich text"). If O-ADM03-2 is not "Yes", the decorative
    library image row of 2.3 (c) goes here too.
- **Found here, for ADM-05** (a section headed **"For ADM-05"** in
  `implementation.md` and in the pull request body): the error-page save,
  `AdminStore.UpdateErrorPageAsync` (`AdminStore.cs:549-599`), does not check
  that a rich-text image's media id is in the library, as `ContentStore.cs:752-753`
  does for pages and items. ADM-05 routes that save through the draft and
  publish flow, so the check belongs there. After this change the Studio cannot
  put an unknown id into that editor by paste (3.1, 4; T13).
- ADM-22's own bullets (table controls, unlink, `/rich-text/paste` accepting only
  TipTap JSON, an `h1` dropped with its text).

## 5. Test plan

### 5.1 Failing tests, written first

**Render tests** (`studio/test/richText.test.tsx`). Setup, each part shown
necessary by the prototype:

- First line `// @vitest-environment jsdom`;
  `vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380")`.
- Stubs in this file only, which assert nothing: `matchMedia` and
  `ResizeObserver` as in `listPaging.test.tsx`; `Range.prototype.getClientRects`
  and `Element.prototype.getClientRects` returning an empty list;
  `Range.prototype.getBoundingClientRect` returning a zero rectangle;
  `document.elementFromPoint` returning `null` (2.4).
- `vi.mock("../src/api/http", ...)`: `jsonInit` as in `listPaging.test.tsx`.
  `request` answers `/api/v1/media…` with two library rows (one with alt
  "Diagram"; one decorative with empty alt, `originalName` "divider.png"),
  answers `/api/v1/rich-text/paste` with `pasteFilter` from
  `test/support/pasteFilter.ts`, records each paste body, and throws on any other
  path. A test can hold paste answers back and release them one by one, or make
  them fail.
- The real `MediaPicker` is used, inside
  `ConfigProvider theme={{ token: { motion: false } }}`. `afterEach(cleanup)`.
- A host component keeps `value` in state and passes `onChange` through, as
  `FormWalker` does, and records every value.
- **How the tests wait (round 2).** No test waits a length of time for
  something to happen or not happen.
  - The paste mock answers in microtasks. A test that needs an answer to be
    late holds it and releases it itself.
  - "Settle" is `await act(async () => { await new Promise((r) => setTimeout(r, 0)); })`.
    It only flushes promises that have already resolved and React's updates.
    The 0 is not a timeout to tune. The prototype passes with it.
  - So an assertion that something did not happen (T1, T7, T8, T9, T13, T15)
    is made after every held answer has been released and flushed. There is
    nothing left in flight that could still make it happen.
  - The picker's tiles are awaited with `findByText`, a wait for something that
    must appear.
- The session set of media ids lasts for the whole test file. T13's crafted id
  must be one that no other test loads or picks.
- Typing: `editor.chain().focus("end").insertContent(ch).run()` per character,
  with the editor taken from `.ProseMirror`'s `editor` property. Paste:
  `fireEvent.paste(dom, { clipboardData: { getData, files: [], types } })`.
- Stored document used by several tests: paragraph "Before", a library image
  (`mediaId` a GUID, alt "Chart", `decorative: false`), paragraph "After".

| Id | Test name | Today | What it asserts |
| --- | --- | --- | --- |
| T1 | `typing after a stored library image keeps the image and every character` | **Red**: "expected [] to have a length of 1" | Paste answers are held. Type " E"; release the first answer; type "dited."; release the rest. The editor still has one image. The last `onChange` value has the image node `{ mediaId, alt: "Chart", decorative: false }` and the paragraph "After Edited.". No request went to `/rich-text/paste`. This is R4 of 2.3 as a test. |
| T2 | `inserting a library image keeps it` | **Red**: same message | Click "Image", then the "Diagram" tile. The editor has one image; the last `onChange` value has that image node, and no `"src"`. No paste request. |
| T3 | `a decorative library image is inserted as decorative` | **Red** | **Only on "Yes" to O-ADM03-2.** Click "Image", then the "divider.png" tile. The image node is `{ mediaId, alt: "", decorative: true }`. |
| T4 | `a pasted web image is dropped with a notice and the text is kept` | **Red**, on the payload: "expected false to be true" | Document "Start". Paste `<p>Hello <b>web</b></p><img src="https://cdn.example/a.png" alt="Remote"><p>Tail</p>`. No image in the editor; "Hello web" and "Tail" are there, with the bold mark; the image notice shows. Exactly one paste request, whose `document` is a list, has no `"src"`, and does not contain "Start" (the slice, not the document). |
| T5 | `a paste never replaces what is already in the editor` | **Red** | Stored document; answers held. Paste `<p>Pasted</p><img src=…>`, then type " typed", then release. The stored image is still there with its `mediaId`; "Before", "typed" and "Pasted" are all there. |
| T6 | `pasting a copied library image keeps it` | **Red**: "expected [ Array(1) ] to deeply equal [ …(2) ]" | Stored document. Paste the editor's own `img` element's `outerHTML`. The editor has two images with the same `mediaId`. No notice. |
| T7 | `a paste without an image does not call the filter` | Passes (guard) | Paste `<p>Plain <i>text</i> only</p>`. The text is there. No paste request. |
| T8 | `a failed filter request adds nothing and says so` | **Red**: "expected 'StartPasted…' not to contain 'Pasted'" | The paste request fails. After pasting text with a web image, the editor still reads "Start" only, has no image, and shows "The paste could not be checked, so nothing was added. Paste again." |
| T9 | `a filter answer after the editor is gone is ignored` | **Red**: "expected 1 to be +0" | Answers held. Paste, unmount, release. `onChange` is not called after the unmount. |
| T10 | `pasting into a sentence joins the text as a normal paste does` | Passes (guard) | Document "Start". Paste `<p>one</p><img src=…><p>two</p>`. Asserts that the last `onChange` document's content equals exactly the paragraphs "Startone" and "two" (3.2). The committed test must carry this assertion; the round 1 prototype only logged it. |
| T11 | `an outside drop that carries an image is refused with a notice` | **Red**: "expected undefined to be true" | Call the editor's `handleDrop` prop (`view.someProp("handleDrop", …)`) with a slice parsed from `<p>Dropped</p><img src=…>` and `moved` false: it returns `true`, "Dropped" is not in the editor, the drop notice shows, no paste request. With `moved` true, and with a slice that has no image, it does not return `true`. jsdom cannot turn drop coordinates into a position, so the prop is called directly. |
| T12 | `typing the Markdown image pattern leaves it as text` | **Red**: "expected 'See \n\n' to contain …" | Insert "See ![x](https://cdn.example/a.png", then pass ")" through the editor's `handleTextInput` prop. No image; the text reads "See ![x](https://cdn.example/a.png)"; no paste request. |
| T13 | `a crafted image with a media id from another page is dropped and its address is never sent` | **Red**: "expected '{"type":"doc",…' not to contain '"src"'" | **Round 2, the attack test for 3.1 (4).** Document "Start". Paste `<p>Lure</p><img mediaid="44444444-4444-4444-8444-444444444444" src="https://evil.example/t.gif" alt="tracking" decorative="true"><img mediaid="nope" src="https://evil.example/u.gif" alt="b">`. Exactly one paste request; its `document` has no `"src"`, no `evil.example` and not the GUID. The editor has no image node, its DOM has no `img` element (so no `src` attribute), and the last `onChange` document does not contain the GUID. "Lure" is there. The image notice shows. |
| T14 | `a library image copied from another rich-text field on the page is kept` | **Red**: "expected [] to deeply equal [ Array(1) ]" | Two editors are mounted. The first holds a library image; the second holds text. Paste the first editor's `img` `outerHTML` into the second. The second has one image with that `mediaId`. |
| T15 | `a filter answer after the document was replaced adds nothing` | **Red**: "expected 'Before\n\nAfterPasted\n\n' to contain 'Other item'" | Answers held. Paste text with a web image; the host then replaces `value` with a document "Other item"; release. The editor reads "Other item" and not "Pasted", and shows the "could not be checked" notice. |

Run against today's editor, the prototype's copy of these tests gave
`Tests 13 failed | 2 passed (15)`; against the prototype fix,
`Tests 15 passed (15)`; against the round 1 design, T13 and T15 failed
(`planned-runs-round2.txt`). If O-ADM03-2 is not "Yes", T3 is not written: 12
red and 2 guards.

**End-to-end** (`studio/e2e/rich-text.spec.ts`; runs only in CI `studio`). Each
test makes its own data with a per-run stamp and depends on no other spec. Both
collect every request to `/api/v1/rich-text/paste` with `page.on("request")`.

- **Shared setup.** An admin token (as `paging.spec.ts` `tokenFor`). One image
  uploaded through `POST /api/v1/media` (multipart `file`, `alt`
  `E2E rich text <stamp>`), with bytes no other test uses: a small PNG built in
  the spec with random pixels, as `verification.spec.ts` `uniquePng` does, but
  kept in memory. Its `id` is kept. That is one upload per test, four in the
  suite, under the limit of 20.
- **E1** `ADM-03 rich text: typing after a stored image keeps the image and the text`
  - Create a page and save one `rich_text` section through the API, as
    `preview.spec.ts:12-33` does: `heading` "ADM-03 stored", `body` the JSON of
    paragraph "Before", the image `{ mediaId, alt, decorative: false }`,
    paragraph "After".
  - Sign in, open `/pages/<id>`, wait for `[data-field='sections[0].heading'] input`
    to hold the heading. In the editor,
    `[data-field='sections[0].body'] .ProseMirror`, `img[mediaid="<id>"]`
    `toHaveCount(1)`. The image is counted, never checked for visibility: an
    `img` with no `src` may have no box.
  - Click the "After" paragraph, press `End`, and type " Edited." with
    `page.keyboard.type`.
  - **First assertion after the typing:** the list of paste requests is empty.
  - Then: the editor contains "After Edited.", and
    `img[mediaid="<id>"]` inside it `toHaveCount(1)`.
  - "Save content", "Saved.". Reload the page: the image count is 1 and
    "After Edited." is there. `GET /api/v1/pages/<id>` with the token: the section's `body`
    contains the media id and "After Edited.", and no `"src"`.
  - **Red today:** the paste-request list is not empty. (The image is gone too,
    but the test stops at the first assertion.)
- **E2** `ADM-03 rich text: an inserted image stays, and a pasted web image is filtered`
  - Create a page through the API. Sign in, open it, `addSection(page, "Rich text")`,
    fill the heading, click the Body editor and type "Intro.".
  - Click the editor's "Image" button; in the "Choose an image" modal click the
    tile named by the alt text.
  - Press `Control+End` and type "After the image." (the caret must be in a
    paragraph, not on the image; the developer adds an `Enter` first if the
    trailing paragraph is not there).
  - **First assertion after the typing:** the list of paste requests is empty.
  - Then: `img[mediaid="<id>"]` in the editor `toHaveCount(1)`, and "Intro." and
    "After the image." are there.
  - Dispatch a paste on the editor from the page: a `ClipboardEvent("paste")`
    whose `DataTransfer` holds `text/html`
    `<p>Pasted line</p><img src="https://cdn.example/x.png" alt="Remote">`.
  - "Pasted line" shows; the image count is still 1; the image notice shows;
    exactly one paste request was made, it answered 200, and its body has no
    `"src"`.
  - "Save content", "Saved.". Reload: one image, and all three texts.
  - **Red today:** the paste-request list is not empty after the insert.
- In both tests the empty paste-request list is asserted first, straight after
  the typing, so the red run fails there. It does not depend on timing: today
  the editor posts on the first change, before the typing ends.
- The pages and the image stay in `DigitalHubContent_E2e` until its next reset.
  No later spec counts pages or media.

### 5.2 Commit order (B-6, P-4)

1. `ADM-03: Test that rich-text images survive typing, inserting and pasting end to end`
   - `studio/e2e/rich-text.spec.ts` only.
2. `ADM-03: Test the rich-text editor's image handling`
   - `studio/test/richText.test.tsx` (T1, T2, T4 to T15) and
     `studio/test/support/pasteFilter.ts`.
3. `ADM-03: Keep library images in rich text and filter only pasted content`
   - `studio/src/content/RichTextEditor.tsx`, 3.1 items 1 to 6.
4. **Only on "Yes" to O-ADM03-2.** `ADM-03: Test that a decorative library image is inserted as decorative`
   - T3 in `richText.test.tsx`; S11's expectation in `listPaging.test.tsx`.
5. **Only on "Yes" to O-ADM03-2.** `ADM-03: Insert a decorative library image as decorative`
   - `MediaPicker.tsx`; the one line in `insertImage`.

Each commit stages exact paths (B-5) and carries the attribution trailer (B-4).
`docs/changes/ADM-03/*` is committed with the step that produces each record.

### 5.3 Local evidence, in this container

Set up once, then check that the lockfile is untouched (B-7):

```bash
cd /home/user/dh-change-adm03/studio
npm ci
git -C /home/user/dh-change-adm03 diff --exit-code -- studio/package-lock.json studio/package.json
```

**After commit 2 (red):**

```bash
npx tsc -b
npx vitest run test/richText.test.tsx
npm test
```

Expected: `tsc -b` exit 0, as CI runs it before the unit tests, so the red state
is "tests fail" and not "does not compile" (`test/support/pasteFilter.ts` is
type-checked). `richText.test.tsx` has 12 failed (T1, T2, T4, T5, T6, T8, T9,
T11 to T15) and 2 passed (T7, T10), exit 1. Quote the summary and one assertion message
per failing test; each must be an assertion about the editor, not a missing
browser API. `npm test`: every test outside that file passes.

**After commit 3 (green):**

```bash
npx vitest run test/richText.test.tsx
npm test
npx tsc -b
VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
git -C /home/user/dh-change-adm03 status --short
```

Expected: 14 passed; `npm test` all passed, count quoted; `tsc -b` exit 0;
build exit 0, including `scripts/check-preview-design.ts`; `git status` shows
only planned files.

**After commit 4 (red) and commit 5 (green), only on "Yes" to O-ADM03-2:**

```bash
npx vitest run test/richText.test.tsx test/listPaging.test.tsx
```

Expected after commit 4: T3 and S11 fail, everything else passes. After commit
5: all pass; then repeat the five green commands above.

**The server filter on the Studio's new payload (optional re-run, Release):**

```bash
source /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh
cd /tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm03/server && dotnet run -c Release
```

It compiles the worktree's `RichText.cs` by link and prints runs A to F of 2.3.
It writes only in the scratchpad.

**NOT RUN locally, with the CI job that covers each:**

- Studio end-to-end, E1 and E2 included: no SQL Server here, and the harness
  needs `DigitalHubContent_E2e`. Covered by CI `studio`.
- API tests (`dotnet test tests/DigitalHub.Api.Tests -c Release`): no API file
  changes, and the database-backed tests need SQL Server. Covered by CI `api`.
- No local port is used. If a later step starts Vite or the API, it uses 42xx
  (`DH_E2E_API_PORT`, `DH_E2E_STUDIO_PORT`) and stops only what it started.
  Nothing writes to `DigitalHubContent`.

### 5.4 CI evidence on the pull request

- **Red end-to-end, only on "Yes" to O-ADM03-1 (section 9):**
  - Push commit 1 alone and open the pull request as a **draft**.
  - Push nothing more until the check run "Studio — typecheck, build,
    end-to-end" on commit 1 has conclusion `failure`:
    `gh api repos/mohya7/DH-WEBSITE/commits/<commit 1 sha>/check-runs --jq '.check_runs[]|{name,status,conclusion,id}'`.
    A `cancelled` run is not evidence; re-run it and wait.
  - Quote the run id and the log lines naming E1 and E2 as the only failures.
  - Then push the remaining commits.
- **Green, on the final head:** `studio` (type check, unit tests, build, the
  whole end-to-end suite with E1 and E2; quote the Playwright summary and the
  count), and `api`, `website`, the website browser tests, `section-compare`,
  `security.yml` and `workflow-lint.yml` unchanged and green.

### 5.5 Track checklist (G3), from `docs/changes/README.md`

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Section 1 quotes it; 2.3 reproduces each bullet, including "kept two characters"; 3.1 items 1, 2 and 4 are the audit's three fixes, in its words |
| The regression test is committed and shown failing before the fix | Commits 1 and 2 before commit 3. T1 to T15 red locally, then green (5.3). E1 and E2 red in CI on commit 1 alone, if O-ADM03-1 is "Yes" (5.4) |
| The end-to-end suite gets a test for each Major | ADM-03 is a Blocker. E1 and E2 are added anyway: jsdom cannot type, and no test calls the paste route today |
| A Minor that is not fixed becomes a D-NNN entry | Not a Minor. What was found and left goes to ADM-22 with a "For ADM-22" note (4) |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | 2.3 and the red runs before; the green runs after |

## 6. Security impact

- **Routes and policies:** none added or changed. `POST /api/v1/rich-text/paste`
  keeps policy `studio`. The Studio calls it through `request` in
  `studio/src/api/http.ts` (A-12).
- **What is sent:** the pasted slice only, and only when it holds an image.
  Today the whole document is posted on every keystroke once it holds an image,
  so the route is called far less.
- **The allow-list is not weakened.** `RichText.cs` is untouched. Every save
  still runs `Validate`, which refuses an image URL, an unknown node, a
  `javascript:` link and an image without alt text
  (`RichTextTests.An_image_url_is_rejected`, `A_disallowed_node_is_rejected`,
  `Disallowed_link_schemes_are_rejected`, `An_image_needs_alt_text_unless_it_is_decorative`).
- **Fail closed (P-5):** a paste whose check fails inserts nothing; an outside
  drop with an image is refused; the Markdown image rule is off; a pasted media
  id this session does not hold is treated as no media id.
- **The new parse rule, `img[mediaid]` (rewritten in round 2).**
  - **The attack.** Any web page can put a `mediaid` attribute on an image, so a
    paste can carry an id the page chose. The server filter checks the id's
    shape only (`RichText.cs:315-317`): a well-formed GUID that is not in the
    library passes it. With `decorative="true"` and no alt text it passes too,
    and the editor would probably draw nothing for it (not run in a browser).
  - **Where that id would have gone, had the plan stopped at round 1.** Into
    the editor, and then: a page or item save refuses it, "<id> is not in the
    library." (`ContentStore.cs:752-753`), blocking the save with nothing
    visible to remove; the error-page save (`AdminStore.cs:549-599`) has no
    library check and would store it. Round 1 said the store refuses it in every
    case. That was wrong for `ErrorPagesPage.tsx`.
  - **What stops it now (3.1, 4).** A pasted media id counts only if this
    Studio session already got it from the API, in a loaded document or from
    the picker. Any other id is sent to the filter as `null`, so the image is
    dropped with the notice. The foreign id never leaves the browser, never
    enters the document or the undo history, and never reaches either save.
  - **No URL is ever taken from pasted HTML.** `cleanNode` sends `mediaId`,
    `alt` and `decorative` only; the server rebuilds the node from those; `src`
    is not rendered.
  - **Attack test, written first (P-4):** T13 pastes a crafted
    `img[mediaid][src]` with a GUID and one with a non-GUID. It asserts no
    `"src"`, no `evil.example` and no foreign GUID in the request, no `img`
    element in the editor, and the notice. It is red today, and it is red
    against the round 1 design.
  - **Worst case left.** A page that knows the id of an image already in this
    session's documents or picker can make a paste carry that image with the
    page's alt text. It is a library image this person already has, it is
    visible as its alt text, and the save checks it as any other. Media ids are
    GUIDs and are not in the built website's addresses (`/media/<file name>`).
  - **Not changed here:** the error-page save still has no library check for an
    id sent straight to the API. That is the server's, older than this change,
    and goes to ADM-05 (4).
- **A paste without an image** is handled as today: ProseMirror's schema, then
  `Validate` on save. Unchanged, and noted for ADM-22 (4).
- **Data, logins, secrets, configuration:** none. No rate limit is raised. E1 and
  E2 use the existing e2e admin account and two uploads.
- **Dependencies:** none added. `Fragment` and `Slice` come from `@tiptap/pm`,
  already a direct dependency. `package.json` and `package-lock.json` are
  unchanged and checked by `git diff --exit-code` (5.3).

## 7. Migrations

None. No API, entity, schema or data change. Stored documents are not rewritten.

## 8. Rollback

Revert the pull request. Nothing is stored differently: the editor emits the
same document shape as before (`cleanDocument` is unchanged). A revert brings
the defect back, and T1 to T15, E1 and E2 would go red. The e2e pages and images
live only in `DigitalHubContent_E2e`, which the harness resets before every run.

## 9. Owner decisions needed

- **O-ADM03-1. Status: PENDING.**
  - **Question:** "May the developer push ADM-03's first commit (the end-to-end
    rich-text test only) to `change/ADM-03` and open a draft pull request before
    the other commits are pushed, so that CI's `studio` job shows the test
    failing first? CI would be red on that pull request until the rest is pushed."
  - **Answers to offer:** "Yes, push the red test first" (recommended), or "No,
    push only when finished".
  - **Not assumed from earlier changes.** The owner answered the same question
    for ADM-06b: "Yes, red test first like #49" (Mohamed Elbadry,
    11 November 2026, project thread). Those words cover ADM-06b. This plan does
    not take them as an answer for ADM-03.
  - **Why it is asked:** G3 requires the regression test "shown failing before
    the fix"; E1 and E2 need SQL Server, which this container lacks; CI runs
    only on a pull request, and a push happens only after the owner confirms.
  - **What does not wait:** development, the commits in order, local red and
    green (5.3), the review, testing and both gates.
  - **If "No":** the G3 row is still met by T1 to T15, shown red locally before
    commit 3. E1 and E2 are then shown passing in CI and never failing; their
    red is recorded NOT RUN with the reason. If the reviewer or the tech lead
    reads the G3 rule as covering E1 and E2 too, the delivery is BLOCKED ON
    OWNER until the owner accepts that in words (a D-NNN entry with an expiry).
- **O-ADM03-2. Status: PENDING.** The coordinator has put it to the owner as a
  card, with a recommendation of "Yes" (11 November 2026). No answer has been
  given, and none is assumed. The coordinator relays the caveat below.
  - **Question:** "When staff insert into rich text an image that the media
    library marks decorative, should the Studio insert it as decorative, so the
    item can be saved? Today such an image has no alt text, and a save refuses an
    image with no alt text unless it is decorative."
  - **Answers to offer:** "Yes, insert it as decorative" (recommended), or "No,
    leave it for ADM-22".
  - **Why recommended:** the library's flag is the person's own statement about
    that image, design 6.9 allows a decorative image in rich text, and without
    it the image stays in the editor but the whole item cannot be saved until the
    image is removed (2.3 b, runs D and E). Before this fix the image vanished,
    so nobody reached that point.
  - **What "Yes" looks like in the editor, which the owner should read before
    answering (round 2).** The editor draws an image as its alt text, not as a
    picture (4, "For ADM-22"). A decorative image with no alt text therefore
    probably shows nothing at all in the editor until ADM-22: it is in the
    document, it saves, and it appears on the website, but the person editing
    cannot see or select it easily. This was not run in a browser. T3 checks
    the stored document only. A decorative library image that does have alt
    text shows that text.
  - **Why it would travel with ADM-03 (B-8).** On "Yes" the pull request body
    says: this is a second, small fix in a second file (`MediaPicker.tsx`); it
    is here because ADM-03's fix is what first lets a decorative image stay in
    the editor, and without it that image blocks the save of the whole item; it
    is in its own two commits (4 and 5) so it can be reverted alone.
  - **Until answered:** commits 4 and 5, T3 and the two "only on Yes" file
    changes are not built. Commits 1 to 3 do not depend on it.
  - **If "No" or unanswered at gate 2:** the row moves to ADM-22 with the
    evidence, in the "For ADM-22" note (4).
- **Noted for the owner in the pull request body, not decisions.** Each is how
  the defect fix keeps today's protection once the filter leaves `onUpdate`
  (2.3 c). Say so before gate 1 if any is not wanted.
  - A drop from another page that carries an image is refused with a notice.
    Today its text is kept and its image removed.
  - Typing `![alt](url)` stays as text. Today the text is removed with the image.
  - Two new notices: "The paste could not be checked, so nothing was added.
    Paste again." and "The dropped content included an image, so it was not
    added. Use the image button for images."
  - Content pasted with an image is added when the check returns: at the caret,
    or, if something was selected after pasting, straight after that selection.
    So it can follow text typed or an image inserted in that moment. Nothing
    already in the editor is replaced, except what was selected at the moment
    of pasting, as with any paste. Two such pastes made one straight after the
    other can land in the other order; both are added. (Reworded in round 3.)
  - A paste that is added removes an earlier "could not be checked" or
    refused-drop notice. The image notice stays until the editor is reloaded.
  - If another item is opened in the same editor while a paste is being
    checked, that paste is not added, and the "could not be checked" notice
    shows.
  - A library image copied in another browser tab, or in another Studio, is
    dropped on paste with the image notice, unless this tab has already loaded
    or picked that image. The Image button adds it. Today every pasted image is
    lost, so nothing that works today stops working.
  - Dragging an image inside the editor with the copy key held (Ctrl-drag) is
    refused with the drop notice. Dragging to move it works. Copy and paste
    makes a copy.
  - A paste of table cells that hold an image is added as a table at the caret,
    not merged into the selected cells.

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The filter answer still replaces content | The defect remains in another form | T5 (stored image, typed text and pasted text all present); the insert is one transaction by the rule in 3.1 (3), and `setContent` is no longer called from the paste path |
| A selection made while a paste is being checked is replaced by the answer (tester's finding 1) | An image just inserted, a selected image or a whole selected document is removed | The three-way rule in 3.1 (3). T16, T17, T18 red at `c4d93b9`, green at `1177ac7`; T19 guards the paste over a selection |
| The place of a late insert drifts in a later change | Pasted content lands somewhere unexpected, with no test failing | T16 to T18 gain an order assertion (round 3, section 12) |
| A stale "nothing was added" notice contradicts a paste that was added | Staff distrust the editor | Cleared on an added paste; T20, T21 |
| Stale answers arrive out of order | Lost or garbled text, as in R4 | T1 holds and releases answers; after the fix typing sends no request at all |
| The fake filter in the render tests drifts from `RichText.cs` | Render tests pass while the real paste fails | E2 pastes against the real API in CI; the fake's comment names the server lines; runs A to F can be re-run (5.3) |
| The server stops accepting a bare list | Pasted text with an image is lost | E2: "Pasted line" must show |
| jsdom lacks layout and clipboard APIs | Render tests fail for a reason that is not the defect | The stubs in 5.1; the red run must show editor assertions (5.3) |
| A synthetic paste in Chromium does not reach ProseMirror | E2 fails at "Pasted line" for a harness reason | Not run here: no SQL Server. The CI red run on commit 1 shows where E2 fails; it must fail at the empty paste-request list, before the paste step. If the paste step fails after the fix, the developer reports it and the plan is revised, not the assertion weakened |
| The caret sits on the image when E2 types | The typed text replaces the image and E2 fails after the fix | E2 presses `Control+End` first, and the step says the caret must be in a paragraph (5.1) |
| The answer arrives after the editor is removed | `onChange` writes into a section that no longer exists | The mounted flag; T9 |
| A web page puts a media id into the editor through `img[mediaid]` | An id the library does not hold blocks a page save with nothing to see, or is stored by the error-page save | The session set (3.1, 4): an id this tab did not get from the API is sent as `null` and dropped. T13, red first, and red against the round 1 design |
| The session set misses an id it should hold | A legitimate cut and paste of a library image is dropped | T6 (same editor) and T14 (another field on the page); E1 and E2 load and pick real images. It fails closed, with the notice |
| `value` is replaced while a paste is being checked | The answer lands in another item's document | The replaced-document counter (3.1, 3); T15, red against the round 1 design |
| Two pastes are answered out of order | They are inserted in answer order | Accepted: nothing is lost (reviewer's probe P3). Listed in section 9 |
| Table cells with an image are pasted into a table | Inserted as a table at the caret, not merged into the cells | Accepted: today the images are lost. In the "For ADM-22" note and section 9 |
| A Ctrl-drag copy of an image inside the editor is refused | A changed habit | Fails closed by design (3.1, 5). Listed in section 9 |
| A render test waits a fixed time for something not to happen | A slow machine makes it pass or fail wrongly | The wait rule in 5.1: answers are held and released by the test; settle only flushes |
| The new parse rule changes how other pasted images parse | Web images kept or lost wrongly | T4 (web image dropped), T6 (own image kept); the old rule stays second in the list |
| Turning off the input rule or refusing drops surprises staff | A changed habit | Listed for the owner in section 9; T11 and T12 fix the behaviour |
| A decorative library image cannot be saved in rich text | Staff must remove the image to save | O-ADM03-2; on "No" it is recorded for ADM-22 |
| `MediaChoice` gains a field | Other callers break | They read only `id`, `path`, `alt` (3.1, 7); `tsc -b`; S11 |
| `npm ci` changes the lockfile | B-7 broken | `git diff --exit-code` (5.3) |
| The red `studio` run is cancelled by the next push | No end-to-end red evidence | Push nothing after commit 1 until its run has conclusion `failure` (5.4) |
| Later G3 items edit the same files in parallel | Merge conflicts | ADM-03 is next in slot 2. ADM-12 (library alt) and ADM-16 (media) may touch `MediaPicker.tsx`; they rebase on this |
| Seven G3-1 items remain after ADM-03 with the exit gate on Monday 16 November | The gate date may not hold at one slot-2 pull request a day | Not this change's decision. The integrator tells the owner at the gate |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: filter only real paste events, in `handlePaste` | Audit ADM-03, Fix 1 | Planned | |
| Fix: keep image nodes with a valid `mediaId` | Audit ADM-03, Fix 2 | Planned | |
| Fix: never replace the document from `onUpdate` | Audit ADM-03, Fix 3 | Planned | |
| Inserting a library image keeps it | Audit ADM-03, bullet 3 | Planned | |
| Typing after an existing image keeps every character | Audit ADM-03, bullet 3 | Planned | |
| A stored library image survives editing, saving and a reload | Audit ADM-03, title; FR-S-06 | Planned | |
| A pasted web image is still dropped, with its notice | `docs/phase-b-studio.md` 7.7, 6.9 | Planned | |
| The paste filter is still the server's | `docs/phase-b-studio.md` 7.7 | Planned | |
| No image without a media id enters by drop or by typing | Found here (2.3 c) | Planned | |
| A pasted media id the session did not get from the API is dropped; no pasted address is sent or rendered | `plan-review.md` Round 1, finding 1; P-4 | Planned (T13) | |
| A paste answer never lands in a replaced document | `plan-review.md` Round 1, finding 5 | Planned (T15) | |
| A paste answer replaces nothing but the selection it was pasted over; a later selection is kept and the content goes after it | `test-report.md` round 1, finding 1; plan 3.1 (3), round 3 | Planned (T16 to T19) | |
| An added paste clears the "not added" notices | `test-report.md` round 1, finding 2 | Planned (T20, T21) | |
| Library check on the error-page save | `plan-review.md` Round 1, finding 1 (server gap, older than this change) | Moved to ADM-05: "For ADM-05" in `implementation.md` and the PR body | |
| Paste of table cells with an image; image copied in another tab | `plan-review.md` Round 1, findings 1 and 5 | Moved to ADM-22: "For ADM-22" note | |
| A decorative library image is inserted as decorative | Found here (2.3 c) | Planned, only on "Yes" to O-ADM03-2; otherwise moved to ADM-22 | |
| The editor shows the picture, not only its alt text | Found here (2.3 a) | Moved to ADM-22: "For ADM-22" in `implementation.md` and the PR body | |
| A notice clears; marks the server refuses | Found here (4) | Moved to ADM-22: same note | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Planned (E1, E2 red in CI waits on O-ADM03-1) | |
| Studio end-to-end test for rich-text images | G3 exit gate: "reproduced before its fix and passing after it" | Planned | |
| `tsc -b`, `npm test` and `npm run build` pass | Plan 5.3; CI `studio` | Planned | |

## 12. Revision log

- **Round 1 (11 November 2026):** first version. No review, approval or
  implementation record existed to answer.
- **Round 2 (11 November 2026):** answers `plan-review.md` Round 1, which ended
  CHANGES NEEDED. O-ADM03-1 and O-ADM03-2 stay PENDING; nothing here assumes an
  answer.
  - **Finding 1, Major: `img[mediaid]` lets an outside page put a media id into
    the editor.** Accepted, and closed in this change, inside the Studio.
    - **Decision.** A pasted media id counts only if this Studio session
      already got it from the API: in a document the editor loaded, or from the
      picker. Any other id is sent to the filter as `null` and the image is
      dropped with the existing notice (3.1, 4). This is the fail-closed
      option; it needs no API change, so there is still no split.
    - **Why not the other routes.** A library lookup per pasted id, and a
      library check in the server filter or the error-page save, are weighed
      and rejected in 3.3.
    - **Section 6 is rewritten.** It now states the real worst case of the bare
      parse rule (an unknown GUID passes the filter; blocks a page or item save;
      probably shows nothing when decorative with no alt) and what stops it. The
      sentence about the library check is corrected: it holds for
      `ContentStore`, not for the error-page save.
    - **2.2 names both hosts**, `FormWalker.tsx:110` and
      `ErrorPagesPage.tsx:68`, and `AdminStore.UpdateErrorPageAsync`.
    - **The server gap goes to ADM-05** with a "For ADM-05" note (4), and has a
      coverage row. After this change the Studio cannot reach it by paste.
    - **Attack test added, red first:** T13, in commit 2. It asserts no `"src"`,
      no `evil.example` and no foreign GUID in the request, no `img` element in
      the editor, the non-GUID image dropped too, and the notice. The prototype
      shows it red today and red against the round 1 design. T14 is added so
      the session set is shown to keep a copy between two fields.
    - **Counts in 5.3** are now 12 failed and 2 passed after commit 2, and 14
      passed after commit 3.
    - **What staff see** (an image copied in another tab is dropped) is in
      section 9's list.
  - **Finding 2, Minor: O-ADM03-2 did not say what "Yes" looks like, and B-8.**
    Accepted. The question now carries the caveat that a decorative image with
    no alt text probably shows nothing in the editor until ADM-22, not run in a
    browser, and that T3 checks the stored document only. On "Yes" the pull
    request body says why the second fix travels with ADM-03 and that it is in
    its own commits. The status records that the owner has been asked by card
    and has not answered.
  - **Finding 3, Minor: E1 and E2 assertion order.** Accepted. In both, the
    empty paste-request list is the first assertion after the typing. Every
    image check is `toHaveCount(1)`, with the reason.
  - **Finding 4, Minor: how render tests wait; T10; `tsc -b`.** Accepted.
    - 5.1 states the rule: answers are held and released by the test, and
      settle is a zero-delay flush, not a timeout. The prototype passes with it
      (it used 20 ms in round 1).
    - T10's row says the committed test asserts the two paragraphs exactly. The
      prototype now does.
    - 5.3 runs `npx tsc -b` after commit 2, expected exit 0.
  - **Finding 5, Minor: three behaviours of the late insert.**
    - **`value` replaced while the request is out: guarded.** A counter raised
      where the effect calls `setContent`; a changed count means nothing is
      inserted and the notice shows (3.1, 3). T15, red against the round 1
      design. Risk row and section 9 entry added.
    - **Two pastes answered out of order: accepted,** since nothing is lost. In
      3.1 (3), the risk table and section 9.
    - **Table cells with an image: recorded** in the "For ADM-22" note, the
      risk table and section 9.
  - **Finding 6, Minor: a Ctrl-drag copy is refused.** Accepted as it is: it
    fails closed. 3.1 (5) says why `moved` is false there, and section 9 lists
    it.
  - Nothing else in the plan changes. The commit order and both owner questions
    stand.
- **Round 3 (11 November 2026):** answers the coordinator's request for a design
  confirmation after `test-report.md` round 1, finding 1, and the developer's
  rework (`c4d93b9` red, `1177ac7` fix, `implementation.md` section R at
  `fb7615f`). Documents only; no code was touched.
  - **The insert rule: confirmed as the design.** Round 2's 3.1 (3) said both
    "`replaceSelection` at the selection of that moment" and "Nothing is lost".
    The tester showed they disagree once something is selected after the paste.
    The intent was the second. The developer's three-way rule keeps it and is
    now the text of 3.1 (3): a caret takes the content at the caret; the
    selection pasted over, with the document unchanged, is replaced as any
    paste does; any other selection is kept and the content goes straight
    after it.
  - **"After the selection" is confirmed**, with the reasons in 3.1 (3). I read
    `1177ac7`: `replaceRange(to, to, piece)` with the caret set to the end of
    what was added. For a selected image `to` is the position after it; for a
    whole-document selection it is the end of the document; for selected text
    it is inside the paragraph, so the content joins the sentence there. None
    replaces anything.
  - **One case decided on the safe side.** If the person pasted over a selection
    and then changed the document elsewhere while keeping that selection, rule
    2 does not apply and the selection is kept, not replaced. That is right:
    when the rule cannot tell, it keeps content.
  - **One strengthening for the developer.** Since the place is now design, T16
    to T18 should also assert the order `implementation.md` section R records:
    T16 "Start", image, "Pasted"; T17 "Before", image, "Pasted", "After"; T18
    "Before", image, "After", "Pasted". It adds assertions and removes none
    (P-6), and needs no code change. The tech lead decides whether gate 2 waits
    for it or it rides with the next commit.
  - **Clearing the two notices: confirmed** (3.1 (3), section 9). It answers the
    tester's finding 2 within this change's own notices and leaves the image
    notice for ADM-22, as section 4 already says.
  - **Tester's observation (a), passing the server's answer through the
    known-id rule: not taken.** The answer comes from the API, which is the
    boundary (S-1), and the real filter rebuilds every image node. It can be
    added later without undoing anything.
  - **Wording corrected** in 3.1 (3), section 9 and the risk table: "Nothing is
    lost" is replaced by what is kept and what a paste replaces. Two risk rows
    and two coverage rows are added.
  - Sections 5.1 to 5.3 are left as the round 2 record of the planned tests.
    T16 to T21 and their red and green runs are in `implementation.md`
    section R.
