# ADM-03: plan approval (gate 1)

Technical lead, gate 1, 11 November 2026. Plan: `docs/changes/ADM-03/plan.md`,
round 2 (`877b2b5`). Review: `docs/changes/ADM-03/plan-review.md`, Round 2
(`00396b4`), `Verdict: APPROVED` with four Minors. Worktree
`/home/user/dh-change-adm03`, branch `change/ADM-03`, local only, base `77296ba`.
This file is the only one written, and it is not committed.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7).

## Decision

Approved, with conditions 1 to 16 below. Commits 1 to 3, local red and green,
the tester and gate 2's local checks can start now. Two owner questions are
open. O-ADM03-2 holds back commits 4 and 5 only. O-ADM03-1 concerns the first
push only, and its state is recorded below exactly as it stands: the owner has
not answered it for ADM-03.

## Read

- `docs/changes/README.md`, `AGENTS.md` / `CLAUDE.md` (worktree copy).
- `ENGINEERING_STANDARDS.md` from `origin/claude/cool-heisenberg-mh6zx9`
  (P-1 to P-8, B-1 to B-9).
- `/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md` (Execution
  order; Track G3) and `admin-audit-2026-10-28.md` (ADM-03 lines 92-103; ADM-05
  lines 118-131; ADM-22 lines 282-287).
- `plan.md` round 2 in full; `plan-review.md` Rounds 1 and 2 in full.
- `docs/changes/ADM-06b/plan-approval.md`, as the model.

## Why it is the right change at the right time

- **Execution order.** The refinement plan puts G3-1 in slot 2, 3 to 16
  November, in the order "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a". ADM-06 is
  closed: `git log origin/rebuild/dotnet-platform` shows `1f53484` (#49, ADM-06a)
  and `77296ba` (#51, ADM-06b), both dated 11 November. ADM-03 is next. It is a
  Blocker, so it goes before any Major. Wave 0 before Wave 1 and ISO-4 after
  ISO-5 do not apply to a G3 item. Slot 1 is not overtaken.
- **No numbered owner decision gates ADM-03.** O-14 to O-17 attach to ADM-01b,
  ADM-08, ADM-05 and a Minor in the audit; none to ADM-03.
- **Scope fits the audit.** The three fix lines ("Filter only real paste events,
  in `handlePaste`", "Keep image nodes with a valid `mediaId`", "Never replace
  the document from `onUpdate`") are plan 3.1 items 2, 4 and 1. The drop refusal
  and the input rule being switched off are inside the same fix: without them,
  taking the filter out of `onUpdate` would let through what today's code
  removes. One module, one fix (B-8); no API half, so no merge-order risk.
- **The defect is where the plan says.** Read by me in the worktree:
  `RichTextEditor.tsx` `StudioImage` gives every node `src: { default: null,
  rendered: false }`; `onUpdate` tests `raw.includes('"type":"image"') &&
  raw.includes('"src"')` and then skips `onChange`; `filterPaste` calls
  `editor.commands.setContent(...)` with the answer. `RichText.cs:309-313` drops
  any image whose `attrs` has a `src` key, and `:315-317` checks only that
  `mediaId` is a GUID string. `Paste` takes a bare array (`:130-133`).
- **Both hosts and the server gap are as stated.** `FormWalker.tsx:110` and
  `ErrorPagesPage.tsx:68` are the only users of `RichTextEditor`.
  `ContentStore.cs:752-753` adds "is not in the library."; `AdminStore.cs`
  `UpdateErrorPageAsync` runs `RichText.Validate` at 558-560 and has no library
  check. Sending that gap to ADM-05 is right: the audit's ADM-05 fix is "Route
  saves through the draft and publish flow", which is where the check lives.
- **The round 1 Major is closed by design, not by wording.** A pasted media id
  counts only if this session already got it from the API; anything else is sent
  as `null` and dropped by the unchanged server filter. T13 is the attack test,
  in commit 2, before the fix (P-4, B-6). The reviewer re-ran it red today, red
  against the round 1 design, and green against round 2.
- **Red first (G3 rule, P-4, B-6).** Commit 1 (e2e only), commit 2 (render
  tests), commit 3 (fix). Twelve render tests are red locally before the fix.
  E1 and E2 can only be shown red in CI, which needs commit 1 pushed alone; see
  O-ADM03-1.

## Conflicts with open work

Checked myself on 11 November:

```
$ gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open' --jq '.[]|"\(.number) \(.head.ref) \(.head.sha[0:7]) draft=\(.draft)"'
44 change/GAP-07 277a636 draft=false
```

- #44's files (`gh api .../pulls/44/files`): `.github/security/*`,
  `.github/workflows/security.yml`, `docs/changes/GAP-07/*`. No `studio/` file.
- Every remote branch was diffed against the base for the files the plan
  creates or changes. Only `origin/change/ADM-06b` shows `MediaPicker.tsx` and
  `listPaging.test.tsx`; that branch is merged as #51, and
  `git diff origin/change/ADM-06b 77296ba` on those files is empty. No conflict.
- `git merge-base HEAD origin/rebuild/dotnet-platform` is `77296ba`, the current
  tip. The branch holds only `plan.md` and `plan-review.md`.
- Later G3 items (ADM-12, ADM-16, ADM-22) will touch `MediaPicker.tsx` or
  `RichTextEditor.tsx`. They rebase on ADM-03 and are not built in parallel on
  these files.

## One thing the plan does not mention

`MediaPicker.tsx:28-32` already has a module-level map, `paths`, filled by
`rememberMedia(id, path)` from every picker listing page (line 70), from an
upload (line 105) and from `insertImage` (`RichTextEditor.tsx:134`, a line the
plan's quote of `insertImage` leaves out). It maps an id to a path for display.
It is not the plan's set of known ids, and it is wider: it holds every image the
picker has listed, not only those loaded in a document or chosen. The plan's
rule names three places an id enters the set. Condition 9 keeps the two apart.
This does not change the design, so it is a condition and not a return to the
architect.

## Risk

- Low for the platform: Studio only, two source files, no API, migration, route,
  policy, secret, dependency, config, harness or workflow change. Rollback is a
  revert; nothing is stored differently.
- The real risk is in the end-to-end tests, which nobody can run here (no SQL
  Server). Whether a synthetic `ClipboardEvent` reaches ProseMirror in Chromium
  is NOT RUN. The plan's answer is right: the red run must fail at the empty
  paste-request list, before the paste step, and a paste step that fails after
  the fix is reported, not loosened (condition 15).
- The render tests use a fake of the server filter. E2 against the real route in
  CI is what guards drift. Accepted.
- `rich-text.spec.ts` sorts between `preview.spec.ts` and `studio.spec.ts`
  (one worker, alphabetical). I checked the later specs' count assertions:
  the only count of content cards (`verification.spec.ts:122`) follows a search
  for that test's own unique term. Uploads go from two to four against a limit
  of 20 (`Program.cs:113`). No effect on later specs, provided the new data is
  stamped (condition 15).

## Schedule

- #49 and #51 both merged on 11 November. On one slot-2 pull request a day,
  ADM-03's earliest merge is 12 November, and only if the red CI run, the green
  CI run, the tester and gate 2 are done by then.
- Seven G3-1 items remain after ADM-03 against the 16 November exit gate. That
  does not fit at one a day. It is not this change's decision; the integrator
  puts it to the owner at the gate. No step in this plan (red first, the wait
  for the red run to conclude, the draft pull request) is to be shortened for
  the date.

## Reviewer's Minors (round 2)

All four are accepted as not blocking. None changes the design, a test's red
state, the counts or the commit order. I do not send the plan back for wording;
each is met in the code, the tests or `implementation.md`.

1. **The set is safe only while hosts pass `value` from the API or the editor.**
   Confirmed for both hosts today. Made a condition (5): the invariant is
   written beside the set and in `implementation.md`.
2. **T13 proves one paste, not that a paste leaves the set alone.** Made a
   condition (6): T13 pastes the crafted HTML twice. It is the same test, so the
   counts stay 12 red and 2 guards.
3. **An id is never removed from the set.** Accepted as a narrow case: it needs
   a library image deleted during the session and still on the person's
   clipboard; a page or item save refuses it; only the error-page save stores
   it, which is the gap already going to ADM-05. Made a condition (7): it is
   written into the worst case and the "For ADM-05" note.
4. **Section 4 still says the `value` effect is unchanged.** Accepted as wording
   in the plan. 3.1 (3) and (4) are authoritative: the effect now fills the set
   and raises the counter; its condition is unchanged. Condition 8.

## Conditions the developer must meet

1. **The developer does not push.** No `git push`, no pull request, no remote
   branch. Every commit stays local on `change/ADM-03`. Pushing is the
   integrator's step (conditions 12 and 13).
2. **O-ADM03-1 is recorded as it is.** In `implementation.md` and anywhere else
   it appears, write the status in these terms and no stronger: the owner has
   not been asked this question for ADM-03 and has not answered it; the owner
   answered the same question "Yes" for ADM-06a and ADM-06b ("Yes, red test
   first like #49", Mohamed Elbadry, 11 November 2026, project thread, given for
   ADM-06b); the integrator has told the owner in the thread that it will push
   the failing browser test first as before. Never write "ANSWERED", "Yes" or an
   owner quote against O-ADM03-1 unless the owner gives words for ADM-03, quoted
   with date and place.
3. **Commit order (B-6, P-4).** Exactly as plan 5.2, with those subjects:
   - 1: `studio/e2e/rich-text.spec.ts` only.
   - 2: `studio/test/richText.test.tsx` (T1, T2, T4 to T15) and
     `studio/test/support/pasteFilter.ts` only.
   - 3: `studio/src/content/RichTextEditor.tsx` only, 3.1 items 1 to 6.
   - `ADM-03:` prefix, a body saying why, the attribution trailer (B-4). Stage
     exact paths (B-5). Records in `docs/changes/ADM-03/` go in with the step
     that produces them, never mixed into commit 1.
4. **Exact red and green counts, quoted with command and exit code (P-8).**
   - After commit 2: `npx tsc -b` exit 0.
     `npx vitest run test/richText.test.tsx` exit 1 with
     `12 failed | 2 passed (14)`: red T1, T2, T4, T5, T6, T8, T9, T11, T12, T13,
     T14, T15; passing T7 and T10. One assertion message per red test, each an
     assertion about the editor, not a missing browser API or a compile error.
     `npm test`: every test outside that file passes, count quoted.
   - After commit 3: `14 passed (14)`; `npm test` all passed, count quoted;
     `npx tsc -b` exit 0; the build with its preview design check exit 0;
     `git status --short` showing only planned files.
   - Any other count, a red guard, or a planned-red test that passes before the
     fix: stop and report (condition 16). Do not adjust a test to reach the
     count (P-6).
5. **Minor 1: the invariant.** A comment beside the set in `RichTextEditor.tsx`
   says: the set holds only ids from a document the editor was created with, a
   document set through `value`, or the picker; this is safe only because every
   host passes `value` from the API or from this editor's own `onChange`; a host
   that feeds `value` from anything else must not use this editor unchanged.
   `implementation.md` states the same and names the two hosts,
   `FormWalker.tsx:110` and `ErrorPagesPage.tsx:68`.
6. **Minor 2: T13 pastes twice.** T13 pastes the crafted HTML a second time and
   repeats its assertions after it: two paste requests in all, neither with
   `"src"`, `evil.example` or the foreign GUID; no image node, no `img` element;
   the last `onChange` document without the GUID. Written in commit 2, so it is
   part of the red test.
7. **Minor 3: ids are never removed.** `implementation.md` section on security
   and the "For ADM-05" note (and the same note in the pull request body) each
   say: an id stays known for the life of the tab, so an image deleted from the
   library during the session can still be pasted from the clipboard; a page or
   item save refuses it; the error-page save stores it until ADM-05 adds the
   library check.
8. **Minor 4: the `value` effect.** `implementation.md` says what changed in the
   effect (it adds the document's media ids to the set and raises the
   replaced-document counter where it calls `setContent`) and that its guard,
   `cleanDocument(editor.getJSON()) === value`, is unchanged. T1 still guards
   it.
9. **The set of known ids is its own thing.** It is not `MediaPicker`'s `paths`
   map and is not filled from `rememberMedia` or read through `rememberedMedia`.
   Ids enter it in the plan's three places only. The existing
   `rememberMedia(choice.id, choice.path)` call in `insertImage` stays as it is.
   `MediaPicker.tsx` is not touched in commits 1 to 3. If reusing the map looks
   better, that is a plan change: stop and report.
10. **O-ADM03-2 before commits 4 and 5.** T3, the S11 expectation,
    `MediaPicker.tsx` and the `decorative` line in `insertImage` are not written
    until the owner has answered O-ADM03-2 in words, quoted with date and place
    in `implementation.md`. Do not infer "Yes" from the recommendation, the card
    or this approval. On "Yes": commit 4 red (T3 and S11 fail, everything else
    passes), then commit 5 green, each quoted. If it is "No" or unanswered at
    gate 2: the decorative row goes to the "For ADM-22" note with runs D and E
    as evidence, and the coverage table says so.
11. **Scope.** Only the files in plan section 4. No `api/` file, no
    `InlineTextEditor.tsx`, `website/`, `packages/`, `package.json`,
    `package-lock.json`, `tsconfig*.json`, `vitest.config.ts`,
    `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`,
    `verification.spec.ts` or workflow. Quote
    `git diff --exit-code -- studio/package-lock.json studio/package.json` after
    `npm ci` (B-7). `test/support/pasteFilter.ts` imports nothing from `src`.
    The jsdom stubs live in `richText.test.tsx` only and assert nothing.
12. **Merge only, once anything is pushed.** Commits 1 to 3 (and 4, 5) are never
    rebased, amended, reordered or squashed, before or after a push; their SHAs
    are quoted in the records. The base is brought in only with `git merge`
    (B-3, B-5). Never a bare `git push`, never a force push.
13. **The red run in CI, when commit 1 is pushed.** Commit 1 goes up alone as
    the branch head, on a draft pull request. Nothing more is pushed until the
    "Studio — typecheck, build, end-to-end" check run on that SHA has conclusion
    `failure`, with E1 and E2 the only failing tests and each failing at the
    empty paste-request assertion. Quote the run id and those log lines. A
    `cancelled` run is re-run, not counted. If E1 or E2 fails anywhere else, or
    another test fails, stop and report.
14. **Pull request body.** It follows `.github/pull_request_template.md` and has
    three sections with these headings:
    - **Behaviour changes for the owner:** the eight items of plan section 9 in
      plain words, with the two new notices quoted. Say plainly which one takes
      away something that works today: a drop from another page that carries an
      image is now refused whole, where today its text is kept.
    - **For ADM-22:** the list in plan section 4, plus the decorative row if
      condition 10 sends it there.
    - **For ADM-05:** the error-page save's missing library check
      (`AdminStore.cs:549-599` against `ContentStore.cs:752-753`), with
      condition 7's sentence.
    On "Yes" to O-ADM03-2 it also carries the B-8 paragraph from plan section 9.
    The same three sections are in `implementation.md`. The pull request stays a
    draft until the final head is green.
15. **End-to-end tests.** Every page and image E1 and E2 make carries a per-run
    stamp. In both, the empty paste-request list is the first assertion after
    the typing. Images are counted with `toHaveCount`, never checked for
    visibility. If, after the fix, the synthetic paste does not reach the editor
    in Chromium, or the caret lands on the image, report it with the CI log; do
    not weaken or remove an assertion.
16. **If the plan cannot be followed,** stop, write BACK TO ARCHITECT in
    `implementation.md` with the output, and change neither the plan nor a test.

## Owner decisions

Recorded as they stand on 11 November 2026. Nothing here is an owner answer
unless it is in quotation marks with a name and date.

| Id | Question | Status | Blocks |
| --- | --- | --- | --- |
| O-ADM03-1 | Push the end-to-end red test alone first, as a draft pull request? | **Not asked for ADM-03; no owner answer for ADM-03.** | The first push, by the plan's own rule (5.4, section 9) |
| O-ADM03-2 | Insert an image the library marks decorative as decorative? | **Asked by card, recommendation "Yes", with the caveat that such an image probably shows nothing in the editor until ADM-22. Unanswered.** | Commits 4 and 5 only |
| Behaviour changes (plan section 9 list) | Not a question; shown, not decided | No record that the owner has seen the list yet | Nothing at gate 1; condition 14 |
| G3-1 exit-gate date | The owner's open question about 16 November | Not this change's decision | Nothing in this plan |

**O-ADM03-1, in full.**

- What exists: the owner's words for the same question on an earlier change,
  "Yes, red test first like #49" (Mohamed Elbadry, 11 November 2026, project
  thread), given for ADM-06b, after the same step was taken for ADM-06a (#49).
  Plan section 9 says, correctly, that those words cover ADM-06b and are not
  taken as an answer for ADM-03.
- What has happened for ADM-03: the integrator has told the owner in the thread
  that it will push the failing browser test first, as before, and treats that
  as a reversible step. Telling the owner is not the owner answering.
- My position at this gate: I do not record that as a "Yes", and this approval
  neither grants nor stands in for one. The step itself is small and can be
  undone: a draft pull request on a change branch, nothing merged, no protected
  branch touched; closing the draft and deleting the branch undoes it, apart
  from the CI run and the pull request number. It is not an exception to a
  standard and not a change in what staff see. So I do not hold the pipeline
  with BLOCKED ON OWNER over it. If the integrator pushes commit 1 on its
  notice, that is the integrator's act and is written as such: "pushed on the
  integrator's notice to the owner, following the ADM-06a and ADM-06b
  precedent; no owner answer for ADM-03". One line to the owner asking the
  question would close it properly, and I recommend it.
- If the owner objects, before or after the push: the draft is closed, the plan's
  "No" branch applies, and E1 and E2 red in CI is recorded NOT RUN with the
  reason. Gate 2 will then check that it is recorded so, and will not treat it
  as waived by me.
- At gate 2 I will check which of these three states is true and that the
  records say exactly that.

**The behaviour list.** Plan section 9 asks the owner to "say so before gate 1 if
any is not wanted". I have no record that the list was put in front of the owner
before this gate, so silence is not read as acceptance. I accept the items at
this gate as consequences of the defect fix that keep today's protection and
fail closed (P-5), as ADM-06b's picker reset was handled. They go to the owner in
the pull request body (condition 14), and the owner's merge confirmation is
where they are accepted or refused. If the owner refuses one, the change goes
back to the architect.

Result for plan round 2: approved, with conditions 1 to 16. Superseded by the
section below, which holds the file's only verdict.

## Gate 1 again: plan round 3

Technical lead, 11 November 2026. Plan: `plan.md` round 3 (`213cdb8`). Review:
`plan-review.md` Round 3 (`fc7fac5`), `Verdict: APPROVED`, three Minors.

**This round is recorded late, and I say so.** Round 3 was written after the
developer's rework (`c4d93b9`, `1177ac7`) and went to the tester and to gate 2
before the plan reviewer or this gate saw it. I found that at gate 2 and made
the review a condition (`delivery-approval.md`, condition 1). The reviewer has
now passed it, so this gate can record it. The order was wrong; the content is
not.

Read again: `git diff 877b2b5 213cdb8 -- docs/changes/ADM-03/plan.md` in full,
`plan-review.md` Round 3 in full, and `RichTextEditor.tsx` at the head.
`git diff --quiet aef22b5 HEAD -- studio api website packages .github` exits 0:
the four commits since the tested head are records only.

### Decision

Approved. Round 3 changes one rule and two wordings, and adds no condition for
the developer. Conditions 1 to 16 stand as met or closed at gate 2.

### Why I accept round 3

- **It removes a contradiction in the plan I approved.** Round 2's 3.1 (3) said
  both "`replaceSelection` at the selection of that moment" and "Nothing is
  lost". The reviewer and I both passed that. The tester showed they disagree
  once something is selected after the paste. Round 3 keeps the intent.
- **The rule keeps content when it cannot tell.** A caret takes the content at
  the caret. The selection pasted over is replaced only if both the document
  and the selection are as they were at paste time. Any other selection is
  kept and the content goes straight after it. That is the fail-safe direction
  (P-5).
- **The code is the rule.** I read it: `state.selection.empty || untouched`
  takes `replaceSelection(piece)`; otherwise `replaceRange(after, after, piece)`
  with `after = state.selection.to`. One transaction. The mounted flag and the
  replaced-document counter are still checked first.
- **Red first, and pinned.** `c4d93b9` precedes `1177ac7`; I reproduced
  `5 failed | 15 passed (20)` on an export of `c4d93b9` at gate 2. `eb696cc`
  makes T16 to T18 assert the exact document, so the place cannot drift.
- **Scope, security and owner questions are unchanged.** Same module, same
  request, same known-id rule, no new input. O-ADM03-1 and O-ADM03-2 are as
  recorded above and at gate 2. The changed landing place and the cleared
  notices are behaviour changes for the owner and are in the pull request
  body's list.

### Reviewer's Minors (round 3)

All three are accepted as not blocking. None needs a code or test change, and I
do not send the plan back for a fourth round of wording.

1. **The plan's test tables stop at T15, and two coverage rows say "Planned"
   for committed tests.** Accepted as a record note. `implementation.md`
   section R and section 13 are the record of T16 to T21, with their red and
   green runs; `test-report.md` round 2 verifies them. Noted in the pull
   request body under "Review findings accepted".
2. **"A paste that is added clears" is slightly wider in the code.** Confirmed:
   for a paste with no image, `handlePaste` clears the two notices before
   ProseMirror inserts, so they clear even if that paste adds nothing. It is
   harmless: the notice it clears is about an earlier paste or drop, and the
   image notice is never cleared this way. Accepted as it is, and noted in the
   pull request body under "Review findings accepted".
3. **A table cell selection takes the insert-after rule, and where the content
   lands is untested.** Nothing is replaced, by construction. Accepted, and
   moved to ADM-22: added to the "For ADM-22" section of the pull request body,
   beside the existing table-cell paste item.

### Owner decisions, as of round 3

| Id | Question | Status | Blocks |
| --- | --- | --- | --- |
| O-ADM03-1 | Push the end-to-end red test alone first? | Not asked for ADM-03; no owner answer for ADM-03. The integrator pushed `0975b00` alone on its own notice to the owner | Nothing now; recorded as it happened |
| O-ADM03-2 | Insert an image the library marks decorative as decorative? | Asked by card, recommendation "Yes". Unanswered | Nothing here: not built; moved to the "For ADM-22" note |
| Behaviour changes | Shown, not decided | In the pull request body for the owner's merge confirmation | The merge |
| G3-1 exit-gate date | The owner's open question about 16 November | Not this change's decision | Nothing in this plan |

Verdict: APPROVED
