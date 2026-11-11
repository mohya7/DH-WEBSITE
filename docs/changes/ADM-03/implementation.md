# ADM-03: implementation

Developer, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`, round 2
(`877b2b5`). Gate 1: `plan-approval.md` (`d071811`), `Verdict: APPROVED` with
conditions 1 to 16. Worktree `/home/user/dh-change-adm03`, branch
`change/ADM-03`, cut from `origin/rebuild/dotnet-platform` at `77296ba`.
I pushed nothing in any round (condition 1). The integrator pushed `0975b00`
alone as draft pull request #52, and later `59d3c65` (section R).

**Result, round 2: the tester's round-1 rework is done (section R).**
`test-report.md` round 1 (`f72dc56`) approved `59d3c65` with four Minors.
Findings 1 and 2 are fixed, failing tests first (`c4d93b9`, then `1177ac7`).
Finding 3 is this record, brought up to date. Finding 4 (the pull request body)
is the integrator's. Sections 1 to 13 are the round-1 record, corrected where
section R says so.

**Result, round 1:** commits 1 to 3 are made, in the plan's order. The render
tests were red before the fix (`12 failed | 2 passed (14)`) and are green after
it (`14 passed (14)`). E1 and E2 cannot run locally; they were red in CI on
`0975b00` alone and green on `59d3c65` (section R). Commits 4 and 5 are not
made: O-ADM03-2 has no owner answer.

## R. Round 2: rework after the test report (round 1, four Minors)

This developer session was cut off a second time, by a usage limit, after
`59d3c65` and before it reported. The commits were intact. The rework below was
made after the coordinator relayed the test report.

### Each finding, and how it is answered

| Finding | Answer | Red | Fix |
| --- | --- | --- | --- |
| 1 (Minor). A selection made while a paste is being checked is replaced when the answer arrives; the records say "Nothing is lost" | The answer replaces a selection only when it is the one the paste was made over and the document has not changed since, which is what any paste does. With a caret it is inserted at the caret, as before. With any other selection (one made after the paste; the Image button leaves its new image selected) it is inserted after the selection and replaces nothing. The records are corrected (below) | `c4d93b9`: T16 (image inserted meanwhile), T17 (stored image selected meanwhile), T18 (whole document selected meanwhile). T19 is a guard for the kept behaviour | `1177ac7` |
| 2 (Minor). The "nothing was added" notice stays after a later paste that did add something; the same for the drop notice | A paste that is added clears those two notices, and only those: a checked paste whose answer is inserted and drops no image, and a paste with no image, which ProseMirror inserts. The image notice is not touched; it stays sticky, for ADM-22 | `c4d93b9`: T20 (after a failed check), T21 (after a refused drop) | `1177ac7` |
| 3 (Minor). `implementation.md` is out of date on three points | This round's edits: who pushed and the CI red and green runs (below; header; sections 4, 6, 8, 13); the coverage rows for E1 and E2; every "Nothing is lost" (below; section 9) | | This commit |
| 4 (Minor). The pull request body lacks condition 14's three sections | Not mine: the integrator writes the pull request body. Sections 9, 10 and 11 of this record are the text for "Behaviour changes for the owner", "For ADM-22" and "For ADM-05", and are up to date with this round | | Integrator |

### The insert rule, and why it is a developer's fix and not a new design

Plan 3.1 (3) says two things that the tester showed cannot both hold: insert
with `replaceSelection` "at the selection of that moment", and "Nothing is
lost". They agree for a caret. They disagree when something is selected after
the paste was made. The tester left the choice to "the developer or the
architect", and the coordinator asked for the answer to be inserted "without
replacing content the user did not have selected at paste time", following the
plan's intent, or else BACK TO ARCHITECT.

I took the plan's stated intent as the rule and changed only the case where
the two sentences disagree:

- **A caret when the answer arrives:** `replaceSelection`, exactly as the plan
  says and as before. Nothing is replaced.
- **The same selection as at paste time, in an unchanged document**
  (`state.doc.eq(...)` and `state.selection.eq(...)` against the state the
  paste was made in): `replaceSelection`. The person pasted over that
  selection, and a paste replaces it, as a paste with no image does at once.
- **Any other selection:** `replaceRange(to, to, piece)` at the selection's
  end, then the caret at the end of what was added. Nothing is replaced. The
  open depths are the same `piece` as before, so pasted text still joins a
  sentence.

Results, read from the last `onChange` document in each test:

| Test | Before the answer | After the answer |
| --- | --- | --- |
| T16 | "Start", the picked image (selected) | "Start", image, "Pasted", empty paragraph |
| T17 | "Before", stored image (selected), "After" | "Before", image, "Pasted", "After" |
| T18 | whole document selected | "Before", image, "After", "Pasted" |
| T19 (guard) | whole document selected, then pasted over | "Pasted" only |

**For the tech lead and the architect:** the one choice I made that the plan
does not state is where the content goes when a later selection exists: after
it. It is the nearest thing to "at the caret" that replaces nothing. If that is
read as a design decision, it is the architect's to confirm or change; the
tests T16 to T18 assert only that nothing is replaced and that the pasted text
is there, not where it lands.

### "Nothing is lost", corrected

The phrase is in plan 3.1 (3), plan section 9 and this record's section 9,
item 4. I cannot change the plan. What is true after `1177ac7`, and what
section 9 item 4 now says:

- **Kept:** everything in the editor when the answer arrives. Text typed while
  the check was out (T1, T5), an image inserted meanwhile (T16), and anything
  selected meanwhile (T17, T18) are not replaced by the answer.
- **Replaced, as any paste does:** what the person had selected when they
  pasted, if it is still selected and the document is unchanged (T19).
- **Not added, with a notice:** the pasted content itself, when the check
  fails or the document was replaced while it was out (T8, T15). The clipboard
  still holds it.
- **Not added, with no notice:** the pasted content, when the field was closed
  before the answer (T9; the tester's observation (b)). There is nobody to
  tell.
- **Dropped, with the image notice:** pasted images with no known media id.
  That is the filter doing its job, not a loss.
- **Two pastes answered in the other order** are inserted in answer order.
  Both are added.

### CI evidence on draft pull request #52

I did not read CI myself and I did not push. This is as the coordinator relayed
it and as the tester recorded it from the REST API in `test-report.md`, round 1,
section 3.

- **Who pushed.** The integrator pushed `0975b00` alone as draft pull request
  #52, on its own notice to the owner (section 8, O-ADM03-1). After that run
  ended, the integrator pushed `59d3c65`. The tester saw the remote branch move
  to `59d3c65` at 04:08 UTC on 11 November 2026, after the red run had ended at
  04:08:00.
- **Red, on `0975b00` alone (plan 5.4, condition 13).** Run `42956506481`, job
  `130312770458`, "Studio — typecheck, build, end-to-end": conclusion
  `failure`, not cancelled. `2 failed`, `28 passed`. E1 fails at
  `rich-text.spec.ts:140` and E2 at `rich-text.spec.ts:193`, both at the empty
  paste-request assertion, the first assertion after the typing:
  ```
    1) e2e/rich-text.spec.ts:88:1 › …
      Error: paste requests sent while typing
      > 140 |   expect(pastes.map((sent) => sent.postData()), "paste requests sent while typing").toEqual([]);
    2) e2e/rich-text.spec.ts:162:1 › …
      Error: paste requests sent while inserting and typing
      > 193 |   expect(pastes.map((sent) => sent.postData()), "paste requests sent while inserting and typing").toEqual([]);
    2 failed
    28 passed (4.5m)
  ```
  They are the only failures.
- **Green, on `59d3c65`.** Run `42957284006`, job `130315262853`, same job
  name: `success`. `30 passed (4.7m)`, E1 and E2 among them; unit tests
  `74 passed (74)`.
- **So in Chromium, against the real API,** the synthetic paste reaches
  ProseMirror, the caret after `Control+End` is in a paragraph, and the real
  paste route answers 200. Those were the plan's open risks (section 6).
- **This round's commits are not pushed.** CI on `c4d93b9` and `1177ac7` is NOT
  RUN. E1 and E2 are not changed by this round; whether they still pass with
  `1177ac7` is covered by CI `studio` on the next pushed head. E2's paste is
  made with a caret, which takes the unchanged `replaceSelection` path.

### Commits this round

| SHA | Subject | Files |
| --- | --- | --- |
| `c4d93b9` (red) | ADM-03: Test that a paste check never replaces a later selection or leaves a stale notice | `studio/test/richText.test.tsx` |
| `1177ac7` (fix) | ADM-03: Insert a checked paste without replacing a later selection, and clear its stale notices | `studio/src/content/RichTextEditor.tsx` |
| this commit | The record | `docs/changes/ADM-03/implementation.md` |

Made on top of `f72dc56` (the test report). Nothing was amended, rebased or
pushed.

### What changed in the code

`studio/src/content/RichTextEditor.tsx` only:

- `filteredPaste` keeps the editor state the paste was made in
  (`pastedInto = view.state`) and applies the rule above when the answer
  arrives. `Selection` is imported from `@tiptap/pm/state`; `@tiptap/pm` is
  already a direct dependency.
- `clearNotAddedNotice(setNotice)` sets the notice to `null` only when it is
  the "could not be checked" notice or the drop notice. It is called when a
  checked paste is inserted and no image was dropped, and in `handlePaste` when
  the paste holds no image and is left to ProseMirror.
- `setNotice` is passed to `filteredPaste` as React's state setter type, so it
  can read the current notice.

`studio/test/richText.test.tsx`: T16 to T21 added; the helper `paste` gains a
`keepSelection` argument and the helpers `selectImage` and `selectAll` are
added. The fourteen earlier tests are unchanged.

### Red, at `c4d93b9`

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 failed (1)
      Tests  5 failed | 15 passed (20)
1
$ npm test; echo $?
 ❯ test/richText.test.tsx (20 tests | 5 failed)
 Test Files  1 failed | 10 passed (11)
      Tests  5 failed | 75 passed (80)
1
```

Only the new tests fail. The fourteen earlier tests and the guard T19 pass.

| Id | Test | Message |
| --- | --- | --- |
| T16 | an image inserted while a paste is being checked is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T17 | an image selected while a paste is being checked is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T18 | a document selected while a paste is being checked is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T20 | a paste that is added clears the notice that nothing was added | `AssertionError: expected 'The paste could not be checked, so no…' to be null` |
| T21 | a paste that is added clears the notice that a drop was refused | `AssertionError: expected 'The dropped content included an image…' to be null` |

T19 (`a paste over a selection replaces that selection`) passes before and
after: it holds the behaviour the fix must keep.

### Green, at `1177ac7`

```
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  20 passed (20)
0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  80 passed (80)
0
$ npx tsc -b; echo $?
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 1.30s
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git -C /home/user/dh-change-adm03 diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
$ git -C /home/user/dh-change-adm03 status --short; echo $?
0
```

The scratch type check of the e2e files (section 4) gave exit 0 again. No port
was used and nothing wrote to any database.

### Behaviour changes for the owner, added this round

Section 9 carries them: item 4 is rewritten, and item 9 is new.

## 1. The session was restarted part-way

The first developer session was cut off by a container restart after commit 1.
This session picked the work up from the repository, not from memory:

- **Commit 1 (`0975b00`) existed.** I checked it against plan 5.1 and condition
  15 before building on it (section 6). It stands as it is; it was not amended.
- **`studio/test/support/pasteFilter.ts` was in the working tree, untracked.**
  I read it against `RichText.cs:98-137` and `:305-336`. It was complete and
  matches the plan's row in section 4, so it is committed unchanged in commit 2.
- **`studio/node_modules` was not installed.** I ran `npm ci` (section 4).
- Everything else (commit 2's test file, commit 3, this record) was written in
  this session. No commit was rebased, amended, reordered or squashed
  (condition 12).

## 2. Commits

| # | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 (red, e2e) | `0975b00` | ADM-03: Test that rich-text images survive typing, inserting and pasting end to end | `studio/e2e/rich-text.spec.ts` |
| 2 (red, render) | `da940bb` | ADM-03: Test the rich-text editor's image handling | `studio/test/richText.test.tsx`, `studio/test/support/pasteFilter.ts` |
| 3 (fix) | `eff1880` | ADM-03: Keep library images in rich text and filter only pasted content | `studio/src/content/RichTextEditor.tsx` |
| 4, 5 | not made | Only on "Yes" to O-ADM03-2, which is unanswered (section 8) | |

This record is committed on its own after commit 3. Each commit staged exact
paths and carries the attribution trailer.

## 3. What changed, file by file, against the plan's Scope

### `studio/src/content/RichTextEditor.tsx` (plan 3.1, items 1 to 6)

| Plan item | What the code does |
| --- | --- |
| 1. `onUpdate` only reports | `onUpdate` calls `onChange(cleanDocument(current.getJSON()))` and nothing else. The `raw.includes('"src"')` test and the call to the filter are gone. |
| 2. The filter runs for a paste | `handlePaste(view, event, slice)`. Image files on the clipboard: unchanged. No image node in the slice (`hasImage`): `false`. Otherwise `true`, and `filteredPaste` sends the slice only, as a bare list: `slice.content.toJSON().map(cleanNode).map(withoutUnknownMediaIds)`, through `request` and `jsonInit` (A-12). |
| 3. The answer is inserted, never set | `filteredPaste` replaces `filterPaste`. After the answer: if the editor is gone (`mounted` ref false, or `view.isDestroyed`), nothing. If the `replaced` counter moved, or the request failed, threw, or gave no body: the notice "The paste could not be checked, so nothing was added. Paste again." and nothing inserted. Otherwise one transaction, `view.state.tr.replaceSelection(piece)`, where `piece` is a `Slice` over `Fragment.fromJSON(schema, content)` with the pasted slice's open depths capped by `Slice.maxOpen(fragment)`. An empty fragment inserts nothing. A fragment that cannot be built gives the same "could not be checked" notice. `imagesDropped` shows the existing image notice. `setContent` is no longer called from the paste path. **Round 2 (`1177ac7`):** a selection made after the paste is not replaced; the answer goes in after it (section R). |
| 4. Only a library image survives a paste | `StudioImage.parseHTML()` returns `img[mediaid]`, then the parent's `img[src]:not([src^="data:"])`. The module-level set `knownMediaIds` (lower case) is filled in three places only: the document the editor is created with, a document the `value` effect sets, and `insertImage`. `withoutUnknownMediaIds` sets `mediaId` to `null` on every image node, at any depth, whose id is not in the set, before the slice is sent. |
| 5. An outside drop with an image is refused | `handleDrop(_view, _event, slice, moved)`: `false` when `moved` or when the slice has no image; otherwise the notice "The dropped content included an image, so it was not added. Use the image button for images." and `true`. |
| 6. The Markdown image pattern stays text | `StudioImage.addInputRules()` returns `[]`. |

- **The `value` effect (condition 8).** Its guard,
  `cleanDocument(editor.getJSON()) === value`, is unchanged, and T1 still guards
  it. Two things were added inside it, where it calls `setContent`: it adds the
  new document's media ids to the set (`noteMediaIds`), and it raises the
  replaced-document counter (`replaced.current += 1`).
- **The set of known ids is its own thing (condition 9).** It is not
  `MediaPicker`'s `paths` map, is not filled from `rememberMedia` and is not
  read through `rememberedMedia`. The existing
  `rememberMedia(choice.id, choice.path)` call in `insertImage` stays as it was;
  the line after it adds the chosen id to the set. `MediaPicker.tsx` is not
  touched.
- **The invariant (condition 5).** The comment beside `knownMediaIds` says: the
  set holds only ids from a document the editor was created with, a document set
  through `value`, or the picker; this is safe only because every host passes
  `value` from the API or from this editor's own `onChange`; a host that feeds
  `value` from anything else must not use this editor unchanged. The two hosts
  today are `studio/src/content/FormWalker.tsx:110` (page and item fields) and
  `studio/src/pages/ErrorPagesPage.tsx:68` (the 404 and 500 bodies). Both pass a
  value loaded from the API or handed back by the editor.
- **Unchanged:** `cleanNode`, `cleanDocument`, `parseDocument`, the toolbar,
  `LinkDialog`, and `insertImage`'s node (`decorative: false`, since commit 5 is
  not made).
- The three notices are now constants at the top of the module. The image
  notice's wording is unchanged.

### `studio/test/richText.test.tsx` (new; plan 5.1, T1, T2, T4 to T15)

- Fourteen tests in `describe("ADM-03 rich text images")`, named as the plan's
  table names them; a comment above each gives its id. T3 is not written.
  **Round 2 (`c4d93b9`):** T16 to T21 are added, twenty tests in all
  (section R).
- Setup as the plan lists it: jsdom, the `VITE_PUBLIC_SITE_URL` stub, the
  `matchMedia`, `ResizeObserver`, `getClientRects`, `getBoundingClientRect` and
  `elementFromPoint` stubs (in this file only; they assert nothing), the mocked
  `../src/api/http`, the real `MediaPicker` inside `ConfigProvider` with motion
  off, a host that keeps `value` in state, `afterEach(cleanup)`.
- **Waiting.** No test waits a length of time. Paste answers are held and
  released by the test (`api.held`, `release()`); `settle` is the zero-delay
  flush the plan defines.
- **T13 pastes twice (condition 6).** The same assertions run after the first
  paste (one request) and after the second (two requests): neither request has
  `"src"`, `evil.example` or the foreign GUID; no image node; no `img` element;
  the last `onChange` document without the GUID; "Lure" present; the image
  notice.
- **T10** asserts the last `onChange` document's content equals exactly the
  paragraphs "Startone" and "two".
- **T8** asserts `text()` does not contain "Pasted" and then that it is exactly
  "Start" (the plan: "still reads 'Start' only").
- **T11** calls the `handleDrop` prop three times: an outside drop with an
  image (`true`, notice, nothing added, no request), the same slice with
  `moved` true (`not.toBe(true)`), and a slice with no image (`not.toBe(true)`).

### `studio/test/support/pasteFilter.ts` (new)

The fake of `POST /api/v1/rich-text/paste`. It imports nothing
(`grep -n 'from "' studio/test/support/pasteFilter.ts` finds nothing), and its
header comment names the server lines it copies: `Paste` 105-137, `ImageNode`
305-336, `FilterPaste` 98-103. It is type-checked by `tsc -b` through
`tsconfig.node.json` (`test/**/*.ts`).

### `studio/e2e/rich-text.spec.ts` (new; commit 1, from the first session)

E1 and E2 as plan 5.1 describes them. See section 6 for the check against the
plan and condition 15, and for the two places it differs from the plan's
wording.

### Not changed

No `api/` file, `MediaPicker.tsx`, `listPaging.test.tsx`,
`InlineTextEditor.tsx`, `website/`, `packages/`, `package.json`,
`package-lock.json`, `tsconfig*.json`, `vitest.config.ts`,
`playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`, `verification.spec.ts`
or workflow (condition 11):

```
$ git diff --stat 77296ba..HEAD        (at eff1880)
 docs/changes/ADM-03/plan-approval.md  |  317 ++++++++++
 docs/changes/ADM-03/plan-review.md    |  342 +++++++++++
 docs/changes/ADM-03/plan.md           | 1023 +++++++++++++++++++++++++++++++++
 studio/e2e/rich-text.spec.ts          |  225 ++++++++
 studio/src/content/RichTextEditor.tsx |  163 +++++-
 studio/test/richText.test.tsx         |  463 +++++++++++++++
 studio/test/support/pasteFilter.ts    |   74 +++
 7 files changed, 2584 insertions(+), 23 deletions(-)
```

## 4. Commands and results

All in `/home/user/dh-change-adm03/studio`, Node `v22.23.4`. No port was used,
no process was started or stopped, and nothing wrote to any database.

### Setup (B-7)

```
$ npm ci
added 245 packages, and audited 247 packages in 10s
found 0 vulnerabilities
exit 0
$ git -C /home/user/dh-change-adm03 diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
```

### After commit 2 (red)

Run on the working tree just before commit 2 was made, with today's editor;
`git diff da940bb -- studio/test` is empty, so it is the content of `da940bb`.

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 failed (1)
      Tests  12 failed | 2 passed (14)
1
```

One assertion per red test, as printed. Each is an assertion about the editor;
none is a missing browser API or a compile error.

| Id | Test | Message |
| --- | --- | --- |
| T1 | typing after a stored library image keeps the image and every character | `AssertionError: expected [] to have a length of 1 but got +0` |
| T2 | inserting a library image keeps it | `AssertionError: expected [] to have a length of 1 but got +0` |
| T4 | a pasted web image is dropped with a notice and the text is kept | `AssertionError: expected false to be true // Object.is equality` (the payload is not a list) |
| T5 | a paste never replaces what is already in the editor | `AssertionError: expected [] to have a length of 1 but got +0` |
| T6 | pasting a copied library image keeps it | `AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]` |
| T8 | a failed filter request adds nothing and says so | `AssertionError: expected 'StartPasted\n\n\n\n' not to contain 'Pasted'` |
| T9 | a filter answer after the editor is gone is ignored | `AssertionError: expected 1 to be +0 // Object.is equality` |
| T11 | an outside drop that carries an image is refused with a notice | `AssertionError: expected undefined to be true // Object.is equality` |
| T12 | typing the Markdown image pattern leaves it as text | `AssertionError: expected 'See \n\n' to contain 'See ![x](https://cdn.example/a.png)'` |
| T13 | a crafted image with a media id from another page is dropped and its address is never sent | `AssertionError: expected '{"type":"doc","content":[{"type":"par…' not to contain '"src"'` |
| T14 | a library image copied from another rich-text field on the page is kept | `AssertionError: expected [] to deeply equal [ Array(1) ]` |
| T15 | a filter answer after the document was replaced adds nothing | `AssertionError: expected 'Before\n\nAfterPasted\n\n' to contain 'Other item'` |

Passing, as planned: T7 (`a paste without an image does not call the filter`)
and T10 (`pasting into a sentence joins the text as a normal paste does`).
These are the messages the plan's table gives.

```
$ npm test; echo $?
 ❯ test/richText.test.tsx (14 tests | 12 failed)
 Test Files  1 failed | 10 passed (11)
      Tests  12 failed | 62 passed (74)
1
```

Every test outside `richText.test.tsx` passes: 10 files, 60 tests (62 less the
two guards).

### After commit 3 (green), at `eff1880`

```
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  14 passed (14)
0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  74 passed (74)
0
$ npx tsc -b; echo $?
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 883ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git -C /home/user/dh-change-adm03 diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
$ git -C /home/user/dh-change-adm03 status --short; echo $?
0
```

`git status --short` printed nothing: the tree was clean after commit 3. The
build's only warning is Vite's existing note about chunk size.

### End-to-end spec: type-checked, not run

No `tsconfig` includes `studio/e2e/*.spec.ts`. As ADM-06b did, I type-checked
the e2e files with a scratch config outside the repository
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/tsconfig.e2e.adm03.json`:
extends `studio/tsconfig.node.json`, `include` `studio/e2e/*.ts`, `lib`
`ES2023` and `DOM`):

```
$ npx tsc -p <scratch>/tsconfig.e2e.adm03.json --noEmit; echo $?
0
$ npx tsc -p <scratch>/tsconfig.e2e.adm03.json --listFilesOnly | grep rich-text
/home/user/dh-change-adm03/studio/e2e/rich-text.spec.ts
```

Run at `da940bb` content and again at `eff1880`: exit 0 both times.

### NOT RUN, with the CI job that covers each

| Check | Why not | Covered by |
| --- | --- | --- |
| E1 and E2, red on commit 1 | No SQL Server and no API in this container; the harness needs `DigitalHubContent_E2e` | CI `studio` ("Studio — typecheck, build, end-to-end") on `0975b00` pushed alone by the integrator: run `42956506481`, `failure`, E1 and E2 the only failures (section R) |
| E1 and E2, green; the rest of the Studio end-to-end suite | Same | CI `studio` on `59d3c65`: run `42957284006`, `30 passed` (section R). On the round-2 head: the next pushed head |
| API tests (`dotnet test tests/DigitalHub.Api.Tests -c Release`) | No `api/` file changes; the database-backed tests need SQL Server | CI `api` |
| Website tests, browser tests, `section-compare`, `security.yml`, `workflow-lint.yml` | No file of theirs changes | Their CI jobs on the final head |
| The optional re-run of server runs A to F (plan 5.3) | Optional; `RichText.cs` is untouched and the plan's 2.3 (b) holds the output | CI `studio`, E2, against the real route |

## 5. Migrations

None. No API, entity, schema or data change.

## 6. Commit 1 checked against plan 5.1 and condition 15

Read in full before building on it. It follows the plan:

- Each test makes its own page and image with a per-run stamp (`stampFor()`):
  the upload's file name and alt text, the slug, the title and the heading all
  carry it. One upload per test, random pixels in memory.
- Both collect every request to `/api/v1/rich-text/paste` with
  `page.on("request")`.
- In both, the first assertion after the typing is that the paste-request list
  is empty.
- Images are counted with `toHaveCount`, never checked for visibility.
- E1 reads the page back through the API and checks the body for the media id,
  "After Edited." and no `"src"`. E2 checks exactly one paste request, its 200
  answer and no `"src"` in its `document`.

**Two places it differs from the plan's wording.** Neither changes an
assertion. They are here for the tester and the tech lead to accept or send
back.

1. **A click on the section's "Edit" button, which the plan does not list.**
   The plan's E1 says: open `/pages/<id>`, then wait for
   `[data-field='sections[0].heading'] input`. A loaded item shows its sections
   closed (`ItemEditorPage.tsx:66`, `openSection` starts `null`; line 346 renders
   the fields only for the open section), so that input does not exist until
   "Edit" is clicked (line 342). The spec waits for the title, clicks "Edit" in
   `article.section-card`, then waits for the heading as planned. It does the
   same after each reload, in E1 and E2. E2's first visit needs no click:
   adding a section opens it (line 316).
2. **E2 focuses the editor before `Control+End`.** After the picker's modal
   closes, the spec calls `body.focus()` and then presses `Control+End`. The
   plan lists only the key press.

**The caret after an insert (plan 5.1, E2; risk row).** Checked in jsdom with a
throwaway test that is not committed: after `insertImage` at the end of a
document, the document is paragraph, image, empty paragraph, and the selection
is a node selection on the image. So the trailing paragraph is there, no
`Enter` is needed, and `Control+End` is needed.

**In a browser (round 2):** E2 passed in CI on `59d3c65` (section R), so in
Chromium the caret lands in the paragraph and the synthetic `ClipboardEvent`
reaches ProseMirror (plan section 10). No assertion was weakened
(condition 15).

## 7. Security

- **No pasted address is sent or rendered.** `cleanNode` reduces an image to
  `mediaId`, `alt` and `decorative` before the slice is sent; the server
  rebuilds the node from those; `src` is `rendered: false`. T4 and T13 assert no
  `"src"` in the request; T13 asserts no `img` element in the editor.
- **A pasted media id counts only if this session got it from the API** (a
  loaded document or the picker). Any other id goes to the filter as `null` and
  the image is dropped with the notice. T13 pastes a crafted
  `img[mediaid][src]` twice and the id is never sent, never in the document and
  never made known by the first paste.
- **Fail closed (P-5):** a paste whose check fails, throws, cannot be built, or
  returns after the document was replaced inserts nothing (T8, T15); an outside
  drop with an image is refused (T11); the Markdown image rule is off (T12).
- **The invariant the set rests on** is in section 3 and in the code comment:
  every host must pass `value` from the API or from the editor's own
  `onChange`. Both hosts do.
- **Ids are never removed from the set (condition 7).** An id stays known for
  the life of the tab, so an image deleted from the library during the session
  can still be pasted from the clipboard. A page or item save refuses it
  ("<id> is not in the library.", `ContentStore.cs:752-753`). The error-page
  save stores it until ADM-05 adds the library check.
- **Worst case left, as the plan states it:** a page that knows the id of an
  image already in this session's documents or picker can make a paste carry
  that image with the page's alt text. It is a library image the person already
  has, and the save checks it as any other.
- No route, policy, secret, dependency, configuration or rate limit changed.
  `RichText.cs` and `Validate` on save are untouched.

## 8. Owner decisions, as they stand

- **O-ADM03-1 (push the end-to-end red test alone first, as a draft pull
  request).** The owner has not been asked this question for ADM-03 and has not
  answered it. The owner answered the same question "Yes" for ADM-06a and
  ADM-06b: "Yes, red test first like #49" (Mohamed Elbadry, 11 November 2026,
  project thread), given for ADM-06b. The integrator has told the owner in the
  thread that it will push the failing browser test first, as before. That
  notice is the integrator's, not an owner answer. I pushed nothing.
  **Round 2:** the integrator then pushed `0975b00` alone as draft pull request
  #52: pushed on the integrator's notice to the owner, following the ADM-06a
  and ADM-06b precedent; no owner answer for ADM-03.
- **O-ADM03-2 (insert an image the library marks decorative as decorative).**
  Asked by card with a recommendation of "Yes". Unanswered. So T3, the S11
  expectation in `listPaging.test.tsx`, `MediaPicker.tsx` and the `decorative`
  line in `insertImage` are not written, and commits 4 and 5 are not made
  (condition 10). If it is "No" or unanswered at gate 2, the row goes to ADM-22
  (below).

## 9. Behaviour changes for the owner

For the pull request body (condition 14). Each keeps today's protection once
the filter leaves `onUpdate`. **One takes away something that works today: a
drop from another page that carries an image is now refused whole, where today
its text is kept and only its image is removed.**

1. A drop from another page that carries an image is refused, with a notice.
2. Typing `![alt](url)` stays as text. Today the text is removed with the image.
3. Two new notices: "The paste could not be checked, so nothing was added.
   Paste again." and "The dropped content included an image, so it was not
   added. Use the image button for images."
4. Content pasted with an image is added when the check returns, not at once.
   It lands at the caret, so it can follow text typed in that moment. If
   something was selected after the paste was made (the Image button leaves its
   new image selected), it lands after that selection and replaces nothing.
   Two such pastes made one straight after the other can land in the other
   order. What is in the editor is kept; only what was selected when the paste
   was made is replaced, as any paste does. The pasted content itself is not
   added if the check fails (item 3's notice), if another item is opened
   meanwhile (item 5), or if the field is closed meanwhile (no notice).
5. If another item is opened in the same editor while a paste is being checked,
   that paste is not added, and the "could not be checked" notice shows.
6. A library image copied in another browser tab, or in another Studio, is
   dropped on paste with the image notice, unless this tab has already loaded
   or picked that image. The Image button adds it. Today every pasted image is
   lost, so nothing that works today stops working.
7. Dragging an image inside the editor with the copy key held (Ctrl-drag) is
   refused with the drop notice. Dragging to move it works. Copy and paste
   makes a copy.
8. A paste of table cells that hold an image is added as a table at the caret,
   not merged into the selected cells.
9. (Round 2.) The two new notices of item 3 go away when a later paste is
   added. The older notice, "This paste included an image. Use the image
   button so you can add alt text.", still stays until the editor is reloaded.

## 10. For ADM-22

Found here and left alone (plan section 4):

- The editor shows an image as its alt text, not as a picture: `src` is
  `rendered: false`, and a stored node has no path.
- The image notice, once shown, stays until the editor is reloaded. (Round 2:
  the two notices this change adds are cleared by a later paste that is added;
  nothing else clears them.)
- StarterKit lets the editor make marks and nodes the server refuses on save
  (for example strike and underline); only image-carrying pastes are filtered.
- A paste of table cells that hold an image goes through the filter and is
  inserted as a table at the caret, not merged into the selected cells:
  `editorProps.handlePaste` runs before the table plugin's. Today that paste
  loses its images.
- A library image copied in another tab is dropped on paste. A library lookup
  could allow it (plan 3.3).
- Per-use alt text and a decorative switch inside rich text.
- **If O-ADM03-2 is "No" or unanswered at gate 2:** an image the library marks
  decorative, with no alt text, is inserted as `alt: ""`, `decorative: false`.
  It now stays in the editor, and the save refuses the item until the image is
  removed. Evidence: plan 2.3 (b), run D (the filter drops it) and run E
  (`Validate`: "needs alt text, or the image must be marked decorative.").

## 11. For ADM-05

The error-page save, `AdminStore.UpdateErrorPageAsync` (`AdminStore.cs:549-599`),
does not check that a rich-text image's media id is in the library, as
`ContentStore.cs:752-753` does for pages and items. ADM-05 routes that save
through the draft and publish flow, so the check belongs there. After this
change the Studio cannot put an unknown id into that editor by paste (T13).

An id stays known for the life of the tab, so an image deleted from the library
during the session can still be pasted from the clipboard; a page or item save
refuses it; the error-page save stores it until ADM-05 adds the library check.

## 12. Differences from the plan

Nothing in the plan's Scope, design or test list was changed. For review:

- The two test-step details in commit 1 (section 6: the "Edit" click, and the
  focus before `Control+End`).
- `filteredPaste` also treats a `request` that throws (a network error, or an
  answer that is not JSON) as a failed request: nothing inserted, the "could not
  be checked" notice. The plan says "on a failed request"; `request` in
  `studio/src/api/http.ts` can throw as well as return `ok: false`.
- The red run was made on the working tree just before commit 2, not on a
  checkout of `da940bb`; the test files are identical (section 4).
- **Round 2.** Plan 3.1 (3) says the answer is inserted with
  `replaceSelection` "at the selection of that moment". After `1177ac7` that
  holds for a caret and for the selection the paste was made over. For a
  selection made later, the answer is inserted after it (section R, with the
  reason and the note for the architect). The plan's "Nothing is lost" is
  stated exactly in section R.
- **Round 2.** A later paste that is added clears this change's two notices.
  The plan lists "a notice, once shown, stays" as left for ADM-22; that is now
  true of the image notice only.

## 13. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: filter only real paste events, in `handlePaste` | Audit ADM-03, Fix 1 | Done | `eff1880`; T4 (one request, a list, the slice only), T7 (no request without an image), T1 and T2 (no request when typing or inserting), red at `da940bb`, green at `eff1880` |
| Fix: keep image nodes with a valid `mediaId` | Audit ADM-03, Fix 2 | Done | `eff1880`; T1, T2, T6, T14 red then green |
| Fix: never replace the document from `onUpdate` | Audit ADM-03, Fix 3 | Done | `eff1880`: `onUpdate` only calls `onChange`; T1, T5 red then green |
| Inserting a library image keeps it | Audit ADM-03, bullet 3 | Done; in a browser in CI | T2 red then green. E2 red on `0975b00`, green on `59d3c65` (section R) |
| Typing after an existing image keeps every character | Audit ADM-03, bullet 3 | Done; in a browser in CI | T1 ("After Edited.") red then green. E1 red on `0975b00`, green on `59d3c65` (section R) |
| A stored library image survives editing, saving and a reload | Audit ADM-03, title; FR-S-06 | Done in CI; NOT RUN locally (no SQL Server) | E1: CI run `42957284006` on `59d3c65` (section R) |
| A pasted web image is still dropped, with its notice | `docs/phase-b-studio.md` 7.7, 6.9 | Done; in a browser in CI | T4 red then green. E2 green on `59d3c65` (section R) |
| The paste filter is still the server's | `docs/phase-b-studio.md` 7.7 | Done; real route in CI | `filteredPaste` posts to `/api/v1/rich-text/paste`; no `api/` file changed. E2 against the real route, answer 200: CI run `42957284006` |
| No image without a media id enters by drop or by typing | Found here (plan 2.3 c) | Done | T11, T12 red then green |
| A pasted media id the session did not get from the API is dropped; no pasted address is sent or rendered | `plan-review.md` Round 1, finding 1; P-4 | Done | T13, pasted twice (condition 6), red then green |
| A paste answer never lands in a replaced document | `plan-review.md` Round 1, finding 5 | Done | T15 red then green; T9 for an unmounted editor |
| What is typed, inserted or selected while a paste is checked is kept | Plan 3.1 (3); `test-report.md` round 1, finding 1 | Done (round 2) | T5; T16, T17, T18 red at `c4d93b9`, green at `1177ac7`; T19 guards the paste-time selection |
| The "not added" notices do not outlive a paste that is added | `test-report.md` round 1, finding 2 | Done (round 2) | T20, T21 red at `c4d93b9`, green at `1177ac7` |
| The record says who pushed, the CI runs, and what can be lost | `test-report.md` round 1, finding 3 | Done (round 2) | Section R |
| The pull request body has condition 14's three sections | `test-report.md` round 1, finding 4; condition 14 | Not mine: the integrator's step | Sections 9, 10, 11 are the text |
| Library check on the error-page save | `plan-review.md` Round 1, finding 1 | Moved to ADM-05 | Section 11 |
| Paste of table cells with an image; image copied in another tab | `plan-review.md` Round 1, findings 1 and 5 | Moved to ADM-22 | Section 10 |
| A decorative library image is inserted as decorative | Found here (plan 2.3 c) | Not built: O-ADM03-2 is unanswered. Moves to ADM-22 if "No" or unanswered at gate 2 | Section 8; section 10, last bullet |
| The editor shows the picture, not only its alt text | Found here (plan 2.3 a) | Moved to ADM-22 | Section 10 |
| A notice clears; marks the server refuses | Found here (plan 4) | Moved to ADM-22 | Section 10 |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Done | `0975b00` and `da940bb` precede `eff1880`; `12 failed | 2 passed (14)` at `da940bb` (section 4). E1 and E2 red in CI on `0975b00` alone, run `42956506481` (section R). Round 2: `c4d93b9` precedes `1177ac7`, `5 failed | 15 passed (20)` |
| Studio end-to-end test for rich-text images | G3 exit gate | Done in CI; NOT RUN locally (no SQL Server) | Red on `0975b00`, green on `59d3c65` (section R). On the round-2 head: NOT RUN until it is pushed; CI `studio` |
| `tsc -b`, `npm test` and `npm run build` pass | Plan 5.3; CI `studio` | Done | Section R, at `1177ac7`: exit 0, `80 passed (80)`, build exit 0 with the preview design check |

Status: READY FOR TEST
