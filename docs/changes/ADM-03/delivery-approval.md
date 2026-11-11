# ADM-03: delivery approval (gate 2)

Technical lead, gate 2, 11 November 2026. Branch `change/ADM-03`, worktree
`/home/user/dh-change-adm03`. Head `18f4e9b`, local and pushed, draft pull
request #52. Base `77296ba`. Final code head `c1df803` (the `studio/` tree of
`18f4e9b` is identical to it).

This file replaces the earlier text of this gate, which is in the history:

- `6fcf2ef`, `7aece22`: a first approval, on `aef22b5`.
- `85f1cda`: that approval withdrawn, `Verdict: CHANGES NEEDED`, after CI
  failed on `7aece22` (run `42970225620`). The Image button left the new image
  selected and the next key replaced it. I had approved that code.

This round starts from nothing, as gate-1 condition 44 says. Nothing from the
first approval is relied on.

Read: `docs/changes/README.md`, `AGENTS.md` / `CLAUDE.md`,
`ENGINEERING_STANDARDS.md` and `.github/pull_request_template.md` (from
`origin/claude/cool-heisenberg-mh6zx9`; neither is on the base), `plan.md`
round 6, `plan-review.md` Rounds 1 to 6, `plan-approval.md` (conditions 1 to
46), `implementation.md` sections 9 to 11 and 15 to 19, `test-report.md`
Rounds 3 and 4 in full, the diff `77296ba..HEAD` of the four code files, and
the integrator's draft pull request body
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/body-adm03-pre.md`).

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7). This file is the
only one written, and it is not committed. Nothing was pushed.

## Decision

**Approved, with conditions 1 to 9 below for the integrator.**

The audit's three fixes are in, each defect found on the way was fixed red
first, the tester's independent sweep found no path through this change's own
code that still loses an image, and the Studio job passed three times in a row
on the final code. I checked each of those myself.

What this approval does not say, so that nobody reads it as more:

- One known way to lose an image is left for ADM-22 (the "Known limit"). The
  owner must read it before merging.
- Three green runs make an intermittent fault unlikely; they do not prove it
  absent. The proof that can be repeated is the unit tests.
- Three things have never been tried in a real browser: the known limit, where
  keyboard focus is when the image picker closes, and a red for the end-to-end
  steps added after the first commit.

## What I verified myself

### Base, head and pushes

```
$ git fetch origin
pushed 18f4e9b   base 77296ba   head 18f4e9b
$ git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD; echo $?      0
$ git diff --quiet c1df803 HEAD -- studio api website packages .github; echo $?  0
$ gh api repos/mohya7/DH-WEBSITE/pulls/52
draft=true head=18f4e9b mergeable=true base=77296ba
```

Open pull requests: #52 and #44 (GAP-07; no `studio/` file). The base has not
moved.

### Scope

```
$ git diff --name-only 77296ba HEAD | grep -v '^docs/changes/ADM-03/'
studio/e2e/rich-text.spec.ts
studio/src/content/RichTextEditor.tsx
studio/test/richText.test.tsx
studio/test/support/pasteFilter.ts
$ git diff --quiet 77296ba HEAD -- api website packages .github studio/package.json \
    studio/package-lock.json studio/tsconfig*.json studio/vitest.config.ts \
    studio/playwright.config.ts studio/e2e/env.ts studio/e2e/helpers.ts \
    studio/e2e/verification.spec.ts studio/test/listPaging.test.tsx \
    studio/src/content/MediaPicker.tsx studio/src/content/InlineTextEditor.tsx; echo $?
0
$ grep -n "caretAfterSelectedImage\|onCreate" studio/src/content/RichTextEditor.tsx
109:function caretAfterSelectedImage(view: EditorView) {
263:    if (editor !== null) caretAfterSelectedImage(editor.view);
366:      caretAfterSelectedImage(view);
```

- Four files outside the records, the plan's section 4 without the "only on
  Yes" rows. One file or one kind of file per commit: tests, then the editor,
  then the record, in every round.
- The round 6 fix (`93ab48f`), read in full: one call after `filteredPaste`'s
  single dispatch, with its comment, and the helper's header comment reworded.
  The helper's body is unchanged. No `onCreate`, nothing in or after the
  `value` effect (condition 36).
- The round 4 fix (`40ad04a`) and rounds 1 and 2 I read at the earlier gates;
  the file at the head is those plus this call. No untyped value, no direct
  `fetch`, no config read, no new dependency. The API call goes through
  `request` in `http.ts` (A-12).
- Tests since gate 1 round 6: `git diff 0da755c HEAD -- studio/test` adds 209
  lines and removes none. T6 and T14 only gained lines (P-6).
- E2's new step is the plan's and nothing more: a second paste of the picked
  library image, two images, two paste requests, typing with no key before it,
  still two, two after the reload. No wait, retry or extra focus call.

### Red first (P-4, B-6, G3 rule)

`git log`: every test commit precedes its fix (`0975b00`, `da940bb` before
`eff1880`; `c4d93b9` before `1177ac7`; `48f256f`, `10ef86d` before `40ad04a`;
`a2a0852` before `93ab48f`). Rounds 1 and 2 I reproduced at the first gate.
This round, on exports of the commits in the session scratchpad (removed
afterwards; the repository was not checked out or changed):

```
a2a0852  $ npx vitest run test/richText.test.tsx
      Tests  8 failed | 23 passed (31)
   × pasting a copied library image keeps it                                   (T6)
   × a library image copied from another rich-text field on the page is kept   (T14)
   × text and a library image pasted at the end are kept when typing follows   (T25)
   × an image cut and pasted at the end is kept when typing follows, …         (T26)
   × a library image pasted into an empty field is kept when typing follows    (T27)
   × two library images pasted at the end are both kept when typing follows    (T28)
   × a late paste answer that ends in an image keeps it when typing follows    (T29)
   × redoing a pasted image does not leave it selected                         (T32)
   8 × AssertionError: expected 'node' to be 'text'
10ef86d  $ npx vitest run test/richText.test.tsx
      Tests  4 failed | 19 passed (23)                          (T16, T22, T23, T24)
```

- The counts and the eight names are the plan's. T29 and T32, predicted from
  probes only, are red when run.
- All eight stop at the selection-type assertion, before the key. So the red
  shows "the image is left selected". That the key then deletes it I showed
  myself at gate 1 round 6 (paste into an empty field, one key:
  `expected +0 to be 1`), and the tester's P1, P4, P5, P9 and P10 show it
  before the fix and show the image kept after it.

### T30 can fail (condition 35)

On an export of the head with one line added to the editor, round 5's
`onCreate: ({ editor: created }) => caretAfterSelectedImage(created.view)`:

```
      Tests  1 failed | 30 passed (31)
   × opening a document changes nothing
AssertionError: expected [ Array(1) ] to deeply equal []
```

T30 fails against the design the reviewer refused, and only T30. It is a real
guard for "opening an item changes nothing".

### Green at the head

In `/home/user/dh-change-adm03/studio`, at `18f4e9b`:

```
$ npx tsc -b; echo $?                                  0
$ npx vitest run test/richText.test.tsx
      Tests  31 passed (31)
$ npm test
 Test Files  11 passed (11)
      Tests  91 passed (91)
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?   0
$ git status --short                                   (nothing)
```

NOT RUN by me: `npm run build` (the tester ran it at `93ab48f` and `c1df803`,
exit 0, and CI's Studio job builds); the Studio end-to-end suite and the API
tests (no SQL Server here; CI, below).

### Three green Studio runs in a row on the final code (condition 44)

Read from GitHub myself. Run `42976109409`, event `pull_request`, head
`c1df803`, three attempts, each `completed` / `success`:

| Attempt | Studio job | Started to completed (UTC) | Unit tests | End to end |
| --- | --- | --- | --- | --- |
| 1 | `130375585045` | 06:58:39 to 07:04:15 | `91 passed (91)` | `30 passed (3.6m)`; E1 6.7s, E2 10.2s |
| 2 | `130377908974` | 07:04:54 to 07:10:22 | `91 passed (91)` | `30 passed (3.5m)`; E1 9.4s, E2 10.5s |
| 3 | `130437368320` | 09:26:26 to 09:33:08 | `91 passed (91)` | `30 passed (4.4m)`; E1 8.3s, E2 12.5s |

- Three completed successes, no failure and no cancelled attempt between them.
  In each attempt the API, Website, website browser tests and section
  comparison jobs are also `success`; screenshot parity is `skipped`.
- The other check runs on `c1df803` (both npm audits, NuGet audit, Semgrep,
  both gitleaks scans, security gate self-test, actionlint) are `success`;
  CodeQL is `skipped`, as on every head.
- No push interrupted an attempt: `d8cbc90` has no check runs of its own, and
  the runs on `18f4e9b` have later ids than attempt 3's and started after it
  finished.
- E2 in these runs includes the new step: a pasted library image, then real
  keys in Chromium against the real API and paste route, a save and a reload.
- **CI on `18f4e9b`** (records only): in progress when I looked. Seven check
  runs `success` so far, six running, none failed. Open; condition 2.

### The earlier CI runs, for the record

All read by me at the time: `0975b00` red, run `42956506481`, job
`130312770458`, E1 at `:140` and E2 at `:193`; `7aece22` red, run
`42970225620`, job `130356739362`, E2 at `:194`, image count 0; `2e3f510`
green once, job `130364362542`, with attempt 2 cancelled.

### The tester's round 4

`Verdict: APPROVED`, two Minors, on `c1df803`. I read it in full. It did what
condition 43 asked: red and green on checkouts, P1 to P10 with the image
counted after the key, an independent sweep of forty cases, "opening changes
nothing" on ten documents plain and in `StrictMode`, a filtered paste shown to
be one `onChange` call and one undo step, the security probes again, and the
known limit recorded as a limit and not as a pass.

- **Minor 1 (the sweep's `value` effect row was untrue): closed in the
  records.** `implementation.md` section 19 corrects the row, the "Known
  limit" paragraph and the ADM-22 entry now cover content replaced while the
  field is open. The plan's own table still has the old row; that is recorded
  as an accepted finding, not hidden.
- **Minor 2 (pull request body): open, condition 3.**

### Records

- `implementation.md` section 9 has items 10 and 11 in the words of conditions
  22 and 37 and the "Known limit" paragraph of condition 38, widened. Section
  10 has the ADM-22 entries. Sections 18 and 19 give the sweep with observed
  results and mark the sentences that were true only until the next key.
- Every coverage row in `implementation.md` and in the tester's four rounds has
  evidence or a named destination (ADM-22, ADM-05).
- All commits since the base have the `ADM-03:` prefix, a body and the trailer
  (the six since gate 1 round 6 checked now; the rest at earlier gates).
  Nothing was amended or rebased: `0975b00` is still an ancestor of the head.

### The loop limit (condition 46)

Plan sent back twice (rounds 1 and 5). Delivery failed twice (the first
approval withdrawn; test report round 3). Nothing has failed since. The limit
is not reached, and no failure was re-labelled to stay under it. It still
stands: one more failure of either kind goes to the owner.

## Notes that do not block

1. E2 does not check after the reload that "Typed after the paste." is still
   there; it checks the two images and the three earlier texts. The save of
   typed text is covered by E1.
2. `RichTextEditor.tsx` is 458 lines. ADM-22 should move the paste path into
   its own module before adding to it.
3. The tester's observations stand as written: an empty field has an undo step
   on open (older than this change); Backspace at the start of the line after
   an image selects it, as in any ProseMirror editor.

## The draft pull request body

I reviewed the scratchpad file as the body. It follows the template, and it is
honest about the withdrawn approval, the two defects found late, the three
runs, what was not run, O-ADM03-1 and O-ADM03-2. I checked its commit ids, run
ids, job ids and counts against GitHub and my own runs: all correct.

**Changes that are conditions (condition 3):**

A. **The owner's quoted words (P-7).** The body quotes `"continue work"
   (Mohamed Elbadry, 11 November 2026, project thread)`. Those words are not in
   any ADM-03 record, and I cannot see the thread. The plan quotes
   `"merge  and start next task" (Mohamed Elbadry, 10 November 2026, project
   thread)` and the card answer `"Yes, merge #51"` (11 November 2026). Either
   replace the "continue work" clause with the plan's quote, or keep it only if
   the integrator has read those exact words, with that date, in the thread.
   An owner quote is never approximate.

B. **"For ADM-22" gains two lines** that earlier reviews moved there and the
   body lost:
   - "If table cells are selected while a paste is being checked, the pasted
     content goes in after that selection and replaces nothing; where it lands
     in the table is not tested (plan review round 3, Minor 3)."
   - "When a paste carries an image, the server filter also removes a hard
     break and a horizontal rule from it (tester's round 1, probe N1)."

C. **"Review findings accepted" gains three lines:**
   - "Plan round 3 was reviewed by the plan reviewer and gate 1 after the
     tester and the first gate 2 had already seen it. Both then approved it and
     no code changed. Rounds 4 and 6 went in the right order."
   - "A paste with no image clears the 'could not be checked' and refused-drop
     notices as soon as it is made, before the editor inserts it (plan review
     round 3, Minor 2). Harmless; the image notice is never cleared this way."
   - "The plan's test tables in sections 5.1 to 5.3 stop at T15; T16 to T32 and
     their red and green runs are in `implementation.md` and the test report."

D. **The two "pending" lines** are filled with the final head, its run id and
   the Studio job id, and the Definition of Done box for CI is ticked only
   then.

**Suggested, not conditions:**

- Under "Tests and evidence", "Nothing runs when a document is loaded or
  replaced" reads as if nothing can go wrong there. Say "This change adds no
  code that runs when a document is loaded or replaced".
- In "Known limit", add a last sentence: "ADM-22 is in the batch planned for
  14 to 18 December; say if you want this sooner."
- In the three-attempts list, give the unit and end-to-end counts once:
  "each: 91 unit tests and 30 end-to-end tests passed".

## Conditions for the integrator, before the owner is asked

1. **No file under `studio/`, `api/`, `website/`, `packages/` or `.github/`
   changes after `c1df803`.** If one does, this approval lapses: a full tester
   round and this gate again.
2. **CI green on the final pushed head (B-3).** Commit this file and push it
   with nothing else pending, by merge only if the base has moved, never a
   bare push or a force push. Wait for every check run on that head to
   conclude. Quote
   `git diff --quiet c1df803 <final head> -- studio api website packages .github; echo $?`
   giving 0, and the run and Studio job ids. One green run is enough here
   because the three runs stand for the identical `studio/` tree.
3. **Post the pull request body** from the scratchpad file with changes A to D
   above applied. Nothing else in it is to be shortened: every behaviour item,
   the "Known limit" section, "For ADM-22", "For ADM-05".
4. **If the Studio job fails on the final head, stop.** Do not re-run it to
   green. A failure there is a failure of this delivery, the third, and under
   condition 46 the change goes to the owner with the trace and the history.
   A `cancelled` run is re-run and is not a failure.
5. **Mark the pull request ready only after 2 and 3.**
6. **Put these in front of the owner in plain words when asking for the merge**
   (they are in the body; the ask should point at them, not assume they are
   read):
   - the known limit, and that ADM-22 is where it is planned;
   - the one behaviour change that takes something away: a drop from another
     page that carries an image is refused whole;
   - that a first delivery approval was given and withdrawn, and why;
   - O-ADM03-1 as a question, since it was never asked for ADM-03;
   - O-ADM03-2, still unanswered.
   The merge waits for the owner's confirmation in words (`AGENTS.md`). If the
   owner refuses a behaviour item or will not accept the known limit, the
   change goes back to the architect.
7. **O-ADM03-1 stays recorded as it is:** pushed on the integrator's notice;
   no owner answer for ADM-03.
8. **O-ADM03-2 is unanswered at this gate,** so the decorative image is in
   "For ADM-22" and nothing of it is built. A later "Yes" is a new small
   change on top of this one, red first.
9. **After the merge** the integrator re-runs the suites on
   `rebuild/dotnet-platform` and records it (`AGENTS.md`). Slot 2 takes one
   merge a day; #49 and #51 merged on 11 November, so the earliest day is
   12 November. Seven G3-1 items remain against 16 November; that is the
   owner's open question and nothing here assumes an answer.

## Definition of Done (template), as of `18f4e9b`

| Box | Can be ticked truthfully? |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes, with the limit named. The audit's three fix lines and both symptoms are covered by unit tests and by E1 and E2 in a browser. The image-first load case is not met and is stated as the "Known limit" |
| Code follows the engineering standards | Yes. `request` in `http.ts` (A-12); fails closed where it cannot decide (P-5); one module, one fix (B-8) |
| No new prohibited constructs | Yes. No untyped values, no direct `fetch`, no config read |
| Every new or changed route has a guard | Yes, vacuously: no route changed. `POST /api/v1/rich-text/paste` keeps policy `studio` |
| Tests exist for the behaviour changed; every security fix has a regression test | Yes: 31 render tests, E1, E2; T13 is the attack test, red before the fix. Changed-line coverage: no gate exists yet (G-8 is a Gap) and none was measured |
| PR checks green on the final head (run ids) | **Open.** Green three times on `c1df803` (run `42976109409`); `18f4e9b` was still running; the final head will be later (condition 2) |
| Independent code review run; findings fixed or accepted | Yes. Plan review rounds 1 to 6, tester rounds 1 to 4 (one Major and four Minors fixed red first), this gate twice. Accepted findings are listed in the body |
| Reviewed by someone other than the author | Yes, by pipeline roles; the owner's review is still to come |
| Rollback understood | Yes. Revert the pull request; no migration, and stored documents keep their shape |
| Deployment note | Until Phase D: the integrator merges into `rebuild/dotnet-platform` after the owner confirms and re-runs the suites. **Open** until then |

Governance boxes: coverage tables are in `docs/changes/ADM-03/`;
`docs/deferred-items.md`: no exception to a standard is claimed, so no D-NNN
entry (the known limit is a defect moved to ADM-22 and shown to the owner, not
a waived rule); documentation: the records in `docs/changes/ADM-03/`.

## Owner decisions, as they stand

| Id | Question | Status | Blocks |
| --- | --- | --- | --- |
| O-ADM03-1 | Push the end-to-end red test alone first? | Not asked for ADM-03; no owner answer for ADM-03. The integrator pushed `0975b00` alone on its own notice | Nothing now; to be asked with the merge |
| O-ADM03-2 | Insert an image the library marks decorative as decorative? | Asked by card, recommendation "Yes". Unanswered | Nothing here: not built; "For ADM-22" |
| Behaviour changes (eleven items) and the known limit | Shown, not decided | For the owner's merge confirmation | The merge |
| G3-1 exit-gate date | The owner's open question about 16 November | Not this change's decision | Nothing here |

Verdict: APPROVED
