# ADM-03: plan review

## Round 1

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`,
round 1, commit `15164df` in worktree `/home/user/dh-change-adm03` (branch
`change/ADM-03`, base `77296ba`). No earlier review rounds.

Read: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md` and
`docs/PROJECT_PROFILE.md` (from `origin/claude/cool-heisenberg-mh6zx9`),
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`,
`/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`,
`docs/phase-b-studio.md` (6.5, 6.9, 7.7), `docs/changes/ADM-06b/plan-review.md`.

Every check was read-only in the repository. I re-ran the architect's prototype
tests and added six probes of my own (P1 to P7 below) in a scratch folder
outside the repository, using the modules in
`/home/user/dh-change-adm06b/studio/node_modules`. No browser, SQL Server or
port was used, so anything about Chromium below is NOT RUN and says so.

### Findings

**1. Major. Sections 3.1 (4), 5.1 and 6: the new `img[mediaid]` parse rule opens
an input an outside page controls. The plan names the attack, understates its
worst case, relies on a save check that one of the editor's two hosts does not
have, and plans no test for it (P-4: "Attack tests come from the design, before
the code").**

- What the rule does. Any pasted `<img mediaid="…">`, from any web page, becomes
  an image node. The server filter keeps it if the id is a GUID and it has alt
  text or `decorative` is true. The filter does not check that the id is in the
  library. Probe P5 against the prototype fix and the plan's fake filter, pasting
  `<img mediaid="44444444-…" src="https://evil.example/t.gif" alt="tracking" decorative="true"><img mediaid="nope" …>`:
  ```
  P5 sent [{"type":"image","attrs":{"mediaId":"44444444-4444-4444-8444-444444444444","alt":"tracking","decorative":true}},{"type":"image","attrs":{"mediaId":"nope","alt":"b","decorative":false}}]
  P5 editor json {…"Start"…,{"type":"image","attrs":{"mediaId":"44444444-4444-4444-8444-444444444444","alt":"tracking","decorative":true,"src":null}},{"type":"paragraph"}]}
  P5 dom <p>Start</p><img mediaid="44444444-…" alt="tracking" decorative="true" draggable="true" …>
  ```
  The good part holds: no `src` is sent, stored or rendered, and the non-GUID
  image is dropped with the notice. The real `ImageNode` (`RichText.cs:305-336`)
  applies the same rule as the fake.
- What section 6 gets wrong, part 1. It says "The worst case is a library image
  the person did not choose, visible in the editor before saving." An id that is
  **not** in the library also passes the filter. For pages and items the save
  then answers "<id> is not in the library." (`ContentStore.cs:752-753`). With
  `decorative="true"` and an empty `alt` the node passes too, and the editor
  draws an image as its alt text only (plan 4, "Found here"), so the person is
  likely to see nothing to remove (NOT RUN in a browser). That is the state 3.3
  calls a regression for the drop and the input rule: "an image … sit in the
  editor until a save refuses it". Today nothing can put an arbitrary media id
  in the editor, because every image is deleted. The same state arises
  innocently when staff paste from another Studio (another database), or paste
  an image whose library row was since deleted.
- What section 6 gets wrong, part 2. "the store refuses a media id that is not
  in the library (`ContentStore.cs:752-753`)" is true for `CheckAsync` only.
  `RichTextEditor` has a second host the plan never mentions,
  `studio/src/pages/ErrorPagesPage.tsx:68`. Its save is
  `AdminStore.UpdateErrorPageAsync` (`AdminStore.cs:549-599`), which runs
  `RichText.Validate` (558) and then writes the body. It has no library check.
  So through the 404 and 500 editor a pasted image with an unknown GUID is
  saved. That server gap is older than this plan and is not ADM-03's to fix, but
  this plan is what makes it reachable from the Studio, and section 6 states the
  opposite.
- No planned test covers any of this. T6 pastes the editor's own image; T4
  pastes an image with no `mediaid`. Nothing asserts that a foreign
  `img[mediaid][src]` sends no `src`, renders no `src`, and is dropped when the
  id is not a GUID. Such a test is red today (today the whole document is sent
  and every image goes), so it can be written first with the others.
- What would satisfy me:
  - Section 6 states the real worst case (an unknown GUID passes the filter;
    blocks the save of a page or item; may show nothing when decorative with no
    alt) and corrects the library-check sentence for error pages, naming
    `ErrorPagesPage.tsx` as a host in 2.2.
  - The plan decides what to do about an id the library does not hold: close it
    in this change, or leave it and say why, with the destination named (the
    "For ADM-22" note, and ADM-05 for the error-page save). If leaving it changes
    what staff see compared with today, it goes in section 9 with the others.
  - One more red-first render test in commit 2 for the crafted paste, asserting
    the three points above (payload has no `"src"` and no `evil.example`; the
    editor's `img` has no `src` attribute; the non-GUID image is dropped with the
    notice), and a row for it in 5.3's expected counts.

**2. Minor. Section 9, O-ADM03-2: the question does not tell the owner what "Yes"
looks like in the editor, and the change becomes two fixes (B-8).**

- On "Yes", a decorative library image with empty alt is inserted as
  `{ alt: "", decorative: true }`. The editor draws images as alt text only, so
  this node probably shows nothing at all until ADM-22 (NOT RUN in a browser).
  T3 checks the JSON only. The owner should read that in the question, since it
  bears on "Yes" versus "leave it for ADM-22".
- It is a second fix in a second file (`MediaPicker.tsx`, which the plan's own
  risk table says ADM-12 and ADM-16 may touch). B-8: "One module, one fix … A
  large one says why." Keeping it conditional and in its own commits 4 and 5 is
  right. The plan should add that, on "Yes", the pull request body says why the
  two travel together.

**3. Minor. Section 5.1, E1 and E2: the written order of assertions contradicts
"The first assertion that fails today is the empty paste-request list".**

- E1 lists "The editor shows 'After Edited.' and still one `img`" before "The
  list of paste requests is empty". In that order the first failure today is the
  text or image check, after a 15 s wait (`playwright.config.ts:12`), and what
  the editor holds at that point depends on when the answers land. E2 has the
  same shape. Put the request-list assertion first, straight after the typing,
  in both tests, so the red run fails for the stated, timing-free reason.
- "shows `img[mediaid=…]`": say `toHaveCount(1)`, not visibility. An `img` with
  no `src` may have no box.

**4. Minor. Sections 5.1 and 5.3: how the render tests wait is not stated, and
the type check is not run where CI runs it.**

- The prototype settles with a fixed 20 ms sleep, including before the
  assertions that something did *not* happen (T1 and T7 "no paste request", T8
  "nothing added", T9 "`onChange` not called"). It works because the mock
  resolves in microtasks, and my re-run agrees (10 failed, 2 passed; then 12
  passed). The plan should say the rule: answers are held and released by the
  test, and a wait only flushes already-resolved promises. Then nobody later
  reads the sleep as a timeout to tune.
- T10 in the prototype has no assertion, only a log. The plan's T10 does assert
  "Startone" and "two", and I confirmed both editors give that. Just make sure
  the committed T10 asserts it.
- `test/support/pasteFilter.ts` is type-checked (`tsconfig.node.json`, strict),
  and CI runs `npx tsc -b` before `npm test`. 5.3 runs `tsc -b` only after commit
  3. Add it after commit 2, so the red state is "tests fail", not "does not
  compile".

**5. Minor. Sections 3.1 (3) and 10: three behaviours of the late insert are not
in the risk table or in section 9.**

- The mounted flag covers an unmount only. If `value` is replaced while the
  request is out, the answer lands in the new document (probe P7:
  `editor "Other itemPasted"`). The window is one request long. Name it as a
  risk, or guard it.
- Two pastes answered out of order are inserted in answer order (P3:
  `"StartBBBAAA"`). Nothing is lost. It belongs beside "it can follow text typed
  in that moment" in section 9.
- `editorProps.handlePaste` runs before the table plugin's `handlePaste`
  (`prosemirror-tables/dist/index.js:2180`). A paste of table cells that hold an
  image therefore goes through the filter and is inserted as a table at the
  caret, not merged into the cells (P4). Today that paste loses its images, so
  this is no worse; record it in the "For ADM-22" note.

**6. Minor. Section 3.1 (5): a copy-drag inside the editor is refused too.**

- ProseMirror passes `moved` as false when the drag started in this editor but
  the copy modifier is held (`prosemirror-view/dist/index.js:3863`,
  `!!(dragging && dragMoves(view, event))`). The plan's rule then refuses a
  Ctrl-drag copy of a library image with "Use the image button for images." It
  fails closed, which is fine. Say so in section 9's list, or state why it is
  left.

### Checked and found sound

- **Fit and quotes.** The audit's ADM-03 text (lines 92-103), the FR-S-06 row
  (line 32), the G3-1 order and exit gate (refinement plan lines 26, 221, 225),
  the README's G3 checklist, and 6.9 and 7.7 of `docs/phase-b-studio.md` are
  quoted word for word. The three audit fixes map to 3.1 items 2, 4 and 1.
- **Reproduction against the audit's wording.** Each bullet is shown: the whole
  document is sent once an image is present and `src` is `null` (R1); the server
  drops the library image for the `src` key (run A, `RichText.cs:309-313`);
  inserting removes it at once (R2); " Edited." ends as "After E", two
  characters kept (R4). R4 uses a chosen release order, which the plan says, and
  T1 makes it a fixed sequence. The real-browser reproduction is E1 in CI.
- **Line references.** `RichTextEditor.tsx` 27-36, 108-115, 117-124, 127-131,
  133-144, 182-200; `MediaPicker.tsx` 7-11, 106, 144; `MediaLibrary.cs:238,267`;
  `FormWalker.tsx:184,201`, `ItemEditorPage.tsx:396`, `MediaLibraryPage.tsx:169`;
  `image.ts:124-130,317-329`; `prosemirror-view` `index.d.ts:708`;
  `Editor.ts:626`; `ci.yml:23-25`; `listPaging.test.tsx:400`. All as stated.
- **Entry points for an image.**
  - Load and the `value` effect: content the server stored and validated.
  - Image button: a library id.
  - Paste: `handlePaste` returns `true` for any slice with an image, so nothing
    unfiltered enters the document or the undo history. Probe P1: undo and redo
    after a filtered paste restore only the filtered node and send no request.
  - Real clipboard HTML from the editor (`view.serializeForClipboard`, with
    `data-pm-slice`) round-trips with the image and joins text correctly (P2).
  - Drop from outside, or from another editor on the page: `moved` is false, so
    refused.
  - Input rules: `@tiptap/extension-image` has one input rule and no paste rule
    or plugin; no Markdown extension is installed (`package.json`).
  - Collaboration: none installed.
  - Remaining gap: finding 1.
- **Server guarantees are not weakened.** No `api/` file changes. The per-update
  call was never a guarantee: any client can skip it. `RichText.Validate` runs on
  every save (`ContentStore.cs:690,726`; `AdminStore.cs:558`) and refuses a `src`
  key, an unknown node or mark, a bad link and a missing alt. `Paste` accepts a
  bare list (`RichText.cs:130-133`) and `cleanNode` sends no `src`. Rejecting
  the server change (3.3) is right: it keeps `ImageNode` and `Image` alike.
- **Architecture.** The call stays on `request` from `studio/src/api/http.ts`
  (A-12). The Studio still uses the server's filter (7.7), and no second copy of
  the rule ships in product code. The rejected alternatives are real ones, and
  "paste first, then replace" is correctly identified as the defect itself.
- **Red tests.** Re-run by me: against today's editor
  `Tests 10 failed | 2 passed (12)` with the plan's ten messages, each an
  assertion about the editor; against the prototype fix `Tests 12 passed (12)`.
  T9 fails without the mounted flag by the plan's account, so it tests the flag.
  T11 and T12 call the real props. Commit order puts both test commits before
  the fix (B-6), and a failing unit test does stop CI before the end-to-end
  step, so pushing commit 1 alone is the only way to see E1 and E2 red.
- **Scope.** No parallel change touches these files (PR #44 is workflow-only).
  The drop refusal and the input rule are inside ADM-03: without them, moving
  the filter out of `onUpdate` would let through what today's code removes. The
  behaviour changes are listed for the owner in section 9, as ADM-06b did.
  `InlineTextEditor.tsx` has no image node and is rightly left.
- **Quality gates.** Nothing is weakened (P-6). S11's expectation only gains a
  field. No dependency, lockfile, config or workflow change; `Fragment` and
  `Slice` come from `@tiptap/pm`, already direct. No new gate.
- **Harness.** Uploads stay under the limit of 20 (`Program.cs:113`, two today
  plus two). The trailing paragraph E2 needs exists (StarterKit registers
  `TrailingNode`; seen in P5). Only `DigitalHubContent_E2e` is written. No
  migration. No secret.
- **Owner decisions.** O-ADM03-1 and O-ADM03-2 are PENDING, quote no owner
  words as an answer, and do not block commits 1 to 3. The "No" branches let no
  role waive the G3 rule. No D-NNN is claimed.
- **Rollback** is a revert with nothing stored differently. **Risks** each name
  their check, apart from the rows asked for in findings 1 and 5.

Round 1 result: CHANGES NEEDED (one Major, five Minors).

## Round 2

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`,
round 2, commit `877b2b5`. Round 1 of this review is at `fda6532`.

Read: the whole round 2 diff of the plan (`git diff fda6532 877b2b5`), its
section 12, the round 2 prototype (`proto/RichTextEditor.fixed.tsx`,
`proto/RichTextEditor.round1.tsx`, `proto/planned.test.tsx`) and
`planned-runs-round2.txt`. Every check was read-only in the repository. I re-ran
the fifteen prototype tests against three editors and added three probes (Q1 to
Q3) in a scratch folder. No browser, SQL Server or port was used.

### Round 1 findings

- **Finding 1, Major: closed.**
  - The design now keeps a pasted media id only if the session got it from the
    API. 3.1 (4) names the three places an id enters the set. Any other id is
    sent as `null`, and the real `ImageNode` drops a non-string `mediaId`
    (`RichText.cs:315-317`) and reports `imagesDropped`.
  - Section 6 states the real worst case and no longer claims a library check
    for the error-page save. 2.2 names both hosts. The server gap has a
    destination (ADM-05) and a coverage row.
  - T13 is the attack test, in commit 2. Re-run by me: red today
    (`not to contain '"src"'`), red against the round 1 design
    (`not to contain '44444444-…'`), green against round 2.
- **Finding 2, Minor: closed.** O-ADM03-2 carries the caveat and the B-8 reason.
  It stays PENDING and no answer is assumed.
- **Finding 3, Minor: closed.** Both end-to-end tests assert the empty
  paste-request list first, and count images.
- **Finding 4, Minor: closed.** The wait rule is stated, the prototype settles
  with a zero-delay flush and still gives the same results, T10 asserts, and
  `tsc -b` runs after commit 2.
- **Finding 5, Minor: closed.** The replaced-document counter and T15 (red
  against round 1: `'Other itemPasted'`) cover the first point. The other two
  are in the risk table, section 9 and the "For ADM-22" note.
- **Finding 6, Minor: closed.** Listed in section 9 with the reason.

### What the coordinator asked me to check: the set of known ids

My probes, against the round 2 prototype with a foreign GUID `5555…`:

```
Q1 drop handled true in editor false sent has id false onChange has id false pastes 3
Q2 sent […{"type":"image","attrs":{"mediaId":null,…}}…{"type":"image","attrs":{"mediaId":null,…}}…,{"type":"image","attrs":{"mediaId":"22222222-…","alt":"Up","decorative":false}}]
Q2 in editor false
Q3 B out has id false C has id false sent has id false
```

- **Pasted content cannot seed it.** The set is filled from the first document,
  from a document the `value` effect sets, and from `insertImage`. A paste with
  an image never enters the document unfiltered, so it cannot reach `onChange`,
  `value` or the set. Q1: the same crafted paste three times, the third after an
  undo, a redo and a drop, is dropped each time and the id is never sent.
- **Dropped content cannot seed it.** The drop is refused before anything is
  read from it (Q1, `handled true`).
- **Nesting does not hide an image.** The rule recurses: a foreign image inside
  a list item and inside a table cell is sent as `null` (Q2).
- **Undo and redo do not weaken it.** History can only restore nodes that were
  in the document, and no foreign id ever is.
- **The second host does not weaken it.** The set is one per module, so both
  hosts share it. `ErrorPagesPage.tsx` loads its bodies from the API. A foreign
  id pasted into a second editor is dropped, and remounting an editor with
  another editor's output adds nothing foreign (Q3). T14 shows the shared set
  keeps a legitimate copy between fields.
- **`value` is not fed from anywhere else today.** No Studio source builds a
  rich-text document from the clipboard or browser storage
  (`grep -rn 'clipboard\|localStorage\|sessionStorage' studio/src` finds only
  `InlineTextEditor.tsx`'s plain-text paste). See finding 1 below.

### New findings (round 2)

**1. Minor. Section 3.1 (4): the rule rests on an unstated condition.**
- "From a document the `value` effect sets" is safe only because every host
  passes a value that came from the API or from the editor itself. That is true
  today for both hosts. A later host that fed `value` from anything else would
  seed the set silently. State the condition in 3.1 (4) and ask for a comment
  beside the set, or add a risk row.

**2. Minor. Section 5.1, T13: it proves one paste, not that a paste leaves the
set alone.**
- Pasting the crafted HTML a second time in T13, with the same assertions,
  would fail if a later change added pasted ids to the set. One more line.

**3. Minor. Sections 3.1 (4) and 6: an id is never removed from the set.**
- If an image is deleted from the library during the session, its id stays
  known. A paste of it is then kept; a page or item save refuses it, and the
  error-page save stores it. This is narrow and needs a library image already
  on the person's clipboard. Add it to the "Worst case left" bullet and to the
  "For ADM-05" note.

**4. Minor. Section 4, "Files to change": the `RichTextEditor.tsx` row still
says "the `value` effect … unchanged".**
- Round 2 adds two things to that effect: it fills the set and raises the
  counter. The condition that decides whether it runs is unchanged. Say that.

None of these changes the design, the tests' red state or the commit order.

### Checked and found sound (round 2)

- **Re-run.** Today's editor: `Tests 13 failed | 2 passed (15)`. Round 1
  design: `Tests 2 failed | 13 passed (15)` (T13, T15). Round 2 design:
  `Tests 15 passed (15)`. These match `planned-runs-round2.txt` and the plan's
  counts in 5.1 and 5.3 (12 red and 2 guards without T3).
- **Fails closed.** A legitimate image the tab has not seen is dropped with the
  notice, and the Image button adds it. Today every pasted image is lost, so
  nothing that works today stops working. It is listed for the owner.
- **Alternatives.** The per-id library lookup and the server-side check are
  real options and the reasons against them hold: the first lets pasted content
  drive requests, the second is an API change and a split.
- **No server change, no weakened gate.** Still no `api/` file, dependency,
  config or workflow change. `Validate` on save is untouched.
- **Scope.** Still one module. The set and the counter are part of closing the
  paste path this change opens, not a new topic.
- **Owner decisions.** O-ADM03-1 and O-ADM03-2 are PENDING. O-ADM03-1 blocks
  only the first push; O-ADM03-2 blocks only commits 4 and 5. Neither is
  assumed, and no D-NNN is claimed. Section 9's "noted, not decisions" list now
  holds every behaviour change I found.
- Everything listed as sound in Round 1 still holds; round 2 touched none of it.

Round 2 result: APPROVED (no Blocker, no Major, four Minors to carry into the
plan approval as conditions or a wording pass).

## Round 3

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`,
round 3, commit `213cdb8`. Reviewed: `git diff 877b2b5 213cdb8 --
docs/changes/ADM-03/plan.md` only, and its fit with the code at the branch head
(`6fcf2ef`; red test `c4d93b9`, fix `1177ac7`, order assertions `eb696cc`).
Read-only; one local run of the render tests. No browser, SQL Server or port.

### What round 3 changes

- 3.1 (3): where a late paste answer goes. A caret takes it at the caret. The
  selection the paste was made over, with the document unchanged, is replaced.
  Any other selection is kept and the content goes straight after it.
- 3.1 (3): a paste that is added clears this change's own two notices.
- "Nothing is lost" is replaced, in 3.1 (3), section 9 and the risk table, by a
  statement of what is kept and what a paste replaces.

### Assessment

- **The rule is right, and it corrects a contradiction I passed in round 2.**
  Round 2 said both "`replaceSelection` at the selection of that moment" and
  "Nothing is lost". My probes then used only carets, so I did not see that
  they disagree once something is selected after the paste. The tester did.
- **It keeps content when it cannot tell.** Rule 2 needs both `doc.eq` and
  `selection.eq` against the state kept at paste time. Anything else falls to
  rule 3, which replaces nothing. That is the fail-safe direction (P-5).
- **"After the selection" is a reasoned choice.** It is the nearest
  non-replacing place to the caret rule and keeps reading order. The rejected
  options (before the selection, collapse to head) are named with the reason.
- **The code matches the plan.** `RichTextEditor.tsx:328-339`:
  `state.selection.empty || untouched` gives `replaceSelection(piece)`;
  otherwise `replaceRange(to, to, piece)` and the caret is set to the end of
  what was added. It is one transaction, so one undo step. The mounted and
  replaced-document guards from round 2 still run first (`:313-319`).
- **The notices.** `clearNotAddedNotice` (`:94-96`) clears only the two notices
  this change added and leaves the image notice, as section 4 says. When a
  paste both adds content and drops an image, the image notice is set, which is
  the more useful one.
- **Tests.** `npx vitest run test/richText.test.tsx` at the head:
  `Tests  20 passed (20)`, exit 0. T16 to T18 assert the full document order
  the plan now fixes (image then "Pasted"; "Pasted" between image and "After";
  "Pasted" after "After"), so the place cannot drift silently. T19 guards the
  paste over a selection. I did not re-run the red state at `c4d93b9`; the
  commit and `test-report.md` round 2 record it.
- **Security.** Nothing changes: the same request, the same known-id rule, no
  new route or input. Not passing the server's answer back through the
  known-id rule is sound: the API is the boundary (S-1) and `ImageNode`
  rebuilds every image it returns.
- **Scope and owner.** Still one module and the same files. The changed
  landing place and the cleared notices are in section 9's list for the owner.
  O-ADM03-1 and O-ADM03-2 are untouched by this round.

### Findings (round 3)

**1. Minor. Sections 5.1 to 5.3 and 11: the plan's test tables stop at T15.**
- T16 to T21 exist only in `implementation.md` section R, and the two new
  coverage rows read "Planned" for tests that are committed and green. The plan
  says this is deliberate. A reader of the plan alone cannot see what each new
  test asserts. A one-line pointer in 5.1 to section R is enough.

**2. Minor. Section 3.1 (3): "A paste that is added clears" is slightly wider
in the code.**
- For a paste with no image the notice is cleared in `handlePaste` before
  ProseMirror inserts (`:201-204`), so it clears even if that paste adds
  nothing. It is harmless. Either word the plan as "a paste that goes ahead",
  or leave it and note it.

**3. Minor. Section 3.1 (3), rule 3: only node, text and whole-document
selections are tested.**
- A cell selection in a table also takes rule 3. By construction nothing is
  replaced, since the insert is at `selection.to`. Where the content lands
  there is untested. Add it to the "For ADM-22" table note; no change here.

None needs a code change or holds the delivery.

Round 3 result: APPROVED (no Blocker, no Major, three Minors).

## Round 4

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`,
round 4, commit `0cb72af`. Reviewed: `git diff fc7fac5 HEAD --
docs/changes/ADM-03/plan.md`, `implementation.md` section 16, the red test T22
(`48f256f`) and the drafted patch
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm03-insertImage-caret.patch`).
Read-only in the repository. I applied the patch to a scratch copy of the
editor outside the repository and ran thirteen probes against the editor
before and after it. No browser, SQL Server or port, so every statement about
keyboard focus in Chromium is NOT RUN.

### What round 4 changes

- New 3.1 item 8: after the Image button, if the new image is node-selected,
  the selection moves to the first text position after it.
- T16's expected document becomes "Start", image, "Pasted". New T23 for an
  image inserted straight before another image. E2 loses `Control+End` and
  keeps `body.focus()`.
- Commit order: tests (T16, T22, T23 fail; 19 pass), the patch (22 pass), the
  record, then the tester and CI.

### Probes

Pick "Diagram" with the Image button, then insert "X" at the selection.
"Before" is the branch head; "After" is the head with the drafted patch.

| Caret before the pick | Before | After |
| --- | --- | --- |
| End of the only paragraph | image selected; image lost: "Intro.", "X" | "Intro.", image, "X" |
| Empty document | image selected; image lost | image, "X" |
| End of a paragraph, another paragraph follows (heading case) | image lost | "Head", image, "XTail" |
| Start of text | caret; image, "XIntro." | same |
| Middle of text | caret; "Int", image, "Xro." | same |
| A range selected | range replaced by the image; caret after | same |
| End of a list item, another item follows | image lost | item 1: "one", image; item 2: "Xtwo" |
| End of the last list item | image lost | item 2: "two", image; then "XTail" |
| End of a table cell | image lost | cell 1: "c1", image; cell 2: "Xc2" |
| End of a blockquote | image lost | quote: "quote", image; then "XTail" |
| End of text, a stored image follows | Diagram lost | "Intro.", Diagram, Chart, "X" |
| A stored image selected | stored image replaced by Diagram, then Diagram lost | stored image replaced by Diagram; "XAfter" |
| Inside a code block | caret; block split around the image | same |

### Assessment

- **The rule is right.** In every probe the new image survives the next key.
  Before the patch it is lost in nine of the thirteen. The rule acts only on a
  node-selected image, so the cases that already leave a caret (start, middle,
  range, code block) are untouched. Finding 1 covers where the caret lands.
- **Scope (B-8).** In scope. This is the audit's third bullet, "Inserting a
  library image removes it at once", one key later, in the same module and the
  same file. Sending it back to the architect before patching was the right
  order.
- **T16, T17, T18.** T16 now takes rule 1 (a caret in the trailing paragraph),
  and its new expected document follows from that. Rule 3 of round 3 keeps its
  tests: T17 selects an image after the paste and T18 selects the whole
  document, each with a full order assertion (`richText.test.tsx`, the T17 and
  T18 blocks at the head). The picker was only ever an accidental route into
  rule 3. No new rule 3 test is needed.
- **Red first.** T22 is red at `48f256f`. T23 is red today by my probe ("End of
  text, a stored image follows": Diagram lost) and its expected order matches
  the patched result. T16's new expectation is red today because the trailing
  empty paragraph is still there. 19 + 3 = 22 matches the plan's counts.
- **P-6.** T16's assertion stays exact and changes by a recorded decision. E2
  becomes stricter. Nothing is weakened.
- **Security, migrations, owner decisions.** No route, request or stored shape
  changes. The caret line is in section 9 for the owner. O-ADM03-1 and
  O-ADM03-2 are untouched.

### Findings (round 4)

**1. Minor. Sections 3.1 (8) and 9: "the line after the new image" is not
always a new line, and three cases are not described.**
- The rule finds the next text position anywhere after the image. When the
  image is the last node of the document it is the trailing empty paragraph.
  Otherwise it is the **start of existing text**: the next paragraph ("XTail"),
  the next list item ("Xtwo"), the next table cell ("Xc2"), or the paragraph
  after a blockquote. Typed text then joins the front of that text, and in a
  list or table the caret has left the item or cell the image went into.
- Nothing is lost, and it is far better than today. But 3.1 (8) names only the
  following-image case, and section 9 tells the owner "the caret is in the line
  after the new image".
- What would satisfy me: 3.1 (8) and section 9 say that the caret goes to the
  next place text can be typed, which may be the start of the following
  paragraph, list item or cell; the list and table cases go in the "For ADM-22"
  note. A guard test for one of them is welcome, not required.

**2. Minor. Section 5.1, E2, and section 12 (5): what E2 does and does not
show after this round.**
- Removing `Control+End` hides nothing: it was the thing hiding the defect.
- `body.focus()` keeps E2 independent of where focus goes when the picker
  closes, and the plan says so and records the question for ADM-22. That is
  honest. It also means E2 does not show that staff can pick and then type
  with no click. The plan should say that in one line beside the E2 step, so
  nobody reads a green E2 as that proof.
- The CI failure was intermittent. One green `studio` run after the patch is
  weak evidence for an intermittent fault. The deterministic proof is T22 and
  T23. The record should say which is which, and the tester should not accept
  the green run alone.

**3. Minor. Section 3.1 (8): "If there is no such position, the selection is
left as it is."**
- In that branch the image stays selected and the defect remains. With
  `TrailingNode` registered (StarterKit default) a text position always exists
  after a last image, and my empty-document probe confirms it. Say that this is
  why the branch is not expected to run.

**4. Minor. Section 5.1: no test for the empty document.**
- It is the first thing a new section's editor is, and before the patch the
  image is lost there too. The patch fixes it (probe above). T22 covers the end
  of text only. One line added to T22 or T23 would hold it.

None of these changes the rule, the patch or the commit order.

Round 4 result: APPROVED (no Blocker, no Major, four Minors).

## Round 5

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`,
round 5, commit `aaa3892`. Reviewed: `git diff 0cb72af aaa3892 --
docs/changes/ADM-03/plan.md` (3.1 item 9, section 5.6, the risk, coverage and
revision rows), `test-report.md` Round 3 finding 1, and the architect's
prototype in `scratchpad/adm03/proto5/`. Read-only in the repository.

I ran sixteen probes of my own against two scratch copies of the editor:
"Today" is the branch head (`33d18d8`); "Fixed" is the architect's
`Editor.fixed.tsx` (callers 1 and 2) plus caller 3, the call after the `value`
effect's `setContent`, which the plan says was not prototyped. No browser, SQL
Server or port, so scrolling and real keyboard focus are NOT RUN.

### Findings

**1. Major. Section 3.1 (9), caller 2 (`onCreate`), and 5.6: the load-time call
can change the document and mark the form as edited when an item is merely
opened. The plan checks scroll and focus, not this.**

- What happens. The helper dispatches a selection-only transaction. TipTap's
  `TrailingNode` (`@tiptap/extensions/src/trailing-node/trailing-node.ts:66`,
  `appendTransaction`) answers any transaction on a document that does not end
  in a paragraph by appending one. That append changes the document, so
  `onUpdate` runs, `onChange` fires, and an undo step exists. My probe, on
  mount, with no act by the person:
  ```
  Today  LOAD [img, p, img] sel NodeSelection 0-1 onChange calls 0 canUndo false doc ["IMG:Chart",{"paragraph":["Mid"]},"IMG:Chart"]
  Fixed  LOAD [img, p, img] sel TextSelection 2-2 onChange calls 1 canUndo true  doc ["IMG:Chart",{"paragraph":["Mid"]},"IMG:Chart","paragraph"]
  Today  LOAD [img, list]   sel NodeSelection 0-1 onChange calls 0 canUndo false
  Fixed  LOAD [img, list]   sel TextSelection 4-4 onChange calls 1 canUndo true  doc ["IMG:Chart",{"bulletList":[…]},"paragraph"]
  ```
- Why it matters. `ItemEditorPage.tsx:80` is `dirty = item !== null && snapshot
  !== saved`. A changed value on open makes the item dirty at once: "Save
  content" is enabled, "Publish" is disabled (`:277-278`), and leaving the page
  raises the unsaved-changes prompt (`:81`, `:89-95`), all before the person has
  touched anything. A save would then store the extra empty paragraph.
- When. The document starts with an image and ends in anything but a paragraph
  (an image, a list, a table, a heading, a code block). A document last saved
  from this editor always ends in a paragraph, so it does not trigger. Content
  that reached the database another way, the bundle import or the API, can.
  Today the same append happens on the person's first click, which is their
  act; caller 2 moves it to the open.
- Caller 3 is clean. `setContent` already carries the append in its own
  dispatch, with `emitUpdate: false`, so the later selection-only dispatch
  changes nothing:
  ```
  Fixed  REPLACE [img,p,img] sel TextSelection 8-8 new onChange calls 0
  Fixed  REPLACE [img only]  sel TextSelection 2-2 new onChange calls 0
  ```
- The same call does not do its job for a document that is only an image.
  There is no text position yet at creation, so the helper leaves the image
  selected, and the first key after a Tab or a toolbar button still deletes it:
  ```
  Fixed  LOAD [img only] sel NodeSelection 0-1 onChange calls 0 doc ["IMG:Chart"]
  ```
  Round 4 said this branch "is not expected to run" because the editor adds a
  paragraph after a last image. At creation it has not added it yet. Item 9's
  title, "never leaves an image selected", and the sweep row "Editor creation
  … Item 9, caller 2" are therefore not true for this document.
- No planned test would see either point. T30 loads image, "After", which ends
  in a paragraph. The risk row for load names only scroll and focus.
- What would satisfy me:
  - The plan states the rule for load: opening an item calls `onChange` zero
    times and adds no undo step, whatever the document.
  - It then either gives a design for caller 2 that keeps that rule for a
    document not ending in a paragraph, and says what happens to an image-only
    document; or takes caller 2 out of this change and sends the load case to
    ADM-22 with probe M1, keeping callers 1 and 3. Either is acceptable. The
    second is the smaller change and leaves load exactly as it is today.
  - If caller 2 stays: T30, or a new test, mounts image, "Mid", image and an
    image-only document, and asserts no `onChange` call and `can().undo()`
    false after mount, red against the round 5 design as written; and the sweep
    gains a row for transactions the editor appends itself.

**2. Minor. Scope (B-8) of the load-time calls.**
- Caller 1 is squarely ADM-03: it is the tester's Major and plan 3.1 (4).
- Callers 2 and 3 are a different path. The selection there is ProseMirror's
  default for a stored document, not something this change's code produces. The
  plan's argument, that it is the same loss and was hidden while every image
  was deleted, is fair, and one helper serves all. I accept it in scope only
  if it is free of side effects, which finding 1 shows caller 2 is not. The
  pull request body should say why load is included, if it stays.

**3. Minor. Section 5.6 and section 9: where the caret lands after a paste.**
- The helper adds no new surprise. It acts only when the pasted image is the
  last thing in the document. Everywhere else ProseMirror already leaves a
  caret, the same in Today and Fixed:
  ```
  PASTE [image mid, text follows]            sel TextSelection … "Midd", image, "Xle"
  PASTE [image end of list item, item follows] … item 1: "one", image; item 2: "Xtwo"
  PASTE [image end of table cell]             … cell 1: "c1", image; cell 2: "Xc2"
  ```
- So the caret after a pasted image can be at the start of the following text,
  list item or cell, as round 4 finding 1 said for the Image button. Section
  9's new sentence, "the caret is in the line after that image", should carry
  the same wording round 4 asked for.

**4. Minor. Section 5.6, counts.**
- The base is right: `richText.test.tsx` has 23 tests and `npm test` gives
  `Tests  83 passed (83)` at the head. 23 + 8 = 31 and 83 + 8 = 91.
- The 9 red and 22 green are predictions from probes, and the plan says so.
  They are credible: my probes agree for the paste at the end, the late
  answer, the load and the redo. If finding 1 adds a test or drops caller 2,
  the counts change and must be restated.

### Checked and found sound

- **Caller 1 is right and enough for the paste.** Fixed: an image pasted at
  the end leaves a text selection, the key lands in the paragraph after it,
  and both images stay. Today the same paste leaves a node selection and the
  key deletes the image. One call after the single dispatch covers all three
  insert rules, the late answer included.
- **Undo and redo.** One undo after the key removes only the key and keeps the
  pasted image, with the key pressed at once and 700 ms later, so T26 does not
  depend on the history's grouping delay. After two undos and two redos the
  selection is a caret and the image survives a key (T32). The Image button's
  own undo and redo also end on a caret, before and after.
- **Load, apart from finding 1.** No focus is taken (`document.activeElement`
  is not the editor after mount). No scroll is requested on load (the flag).
  Under React StrictMode, and with an unmount straight after mount, `onCreate`
  raises no error. For image, "After" and image, image, "After": text
  selection, zero `onChange` calls, no undo step.
- **The sweep.** Every `dispatch`, `insertContent` and `setContent` in the file
  is listed. Leaving the person's own drag alone is right and is recorded for
  ADM-22. Missing: the editor's own appended transactions (finding 1).
- **Tests first.** Tests-only commit, then `RichTextEditor.tsx` only, then the
  record. T6 and T14 gain assertions and lose none (P-6). The E2 step is
  stricter; its red is honestly NOT RUN with the reason.
- **Security.** The helper only sets a selection. Nothing new reaches
  `knownMediaIds`, and no request is added in product code. The E2 step's
  second paste uses an id the session already picked. No route, policy,
  migration, dependency or secret is touched.
- **Owner decisions.** The two caret sentences are in section 9. O-ADM03-1 and
  O-ADM03-2 are untouched.

Round 5 result: CHANGES NEEDED (one Major, three Minors). This is the second
CHANGES NEEDED on this plan (rounds 1 and 5).

Verdict: CHANGES NEEDED
