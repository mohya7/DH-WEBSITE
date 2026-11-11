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

Verdict: APPROVED
