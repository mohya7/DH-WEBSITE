# ADM-03: delivery approval (gate 2)

Technical lead, gate 2, 11 November 2026. Branch `change/ADM-03`, worktree
`/home/user/dh-change-adm03`. Local head `a625f00` (test report round 2);
pushed head `aef22b5`, draft pull request #52. Base `77296ba`.

Read: `docs/changes/README.md`, `AGENTS.md` / `CLAUDE.md`,
`ENGINEERING_STANDARDS.md` and `.github/pull_request_template.md` (both from
`origin/claude/cool-heisenberg-mh6zx9`; neither is on the base), `plan.md`
round 3 and its whole diff against round 2, `plan-review.md` (Rounds 1 and 2),
`plan-approval.md` (conditions 1 to 16), `implementation.md` (sections R, 1 to
14) and `test-report.md` (rounds 1 and 2) in full, the diff of
`RichTextEditor.tsx` against the base in full, and `rich-text.spec.ts`.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7). This file is the
only one written, and it is not committed. Nothing was pushed.

## Decision

**Approved, with conditions 1 to 9 below for the integrator.** The code, the
tests, the red-first history and the CI evidence are sound, and I checked each
myself. Four things are open and are conditions, not reasons to send the code
back:

- Plan round 3 was never seen by the plan reviewer or by gate 1 (condition 1).
- The final head is not pushed, so CI on it does not exist yet (condition 4).
- The pull request body is still the commit-1 text (condition 5).
- `implementation.md` has three statements the later pushes made stale
  (condition 3).

## One process gap I found: plan round 3 skipped steps 2 and 3

- `213cdb8` changed the design text of plan 3.1 (3), the rule for where a late
  paste answer goes. `plan-review.md` still ends at Round 2 (written against
  `877b2b5`), and `plan-approval.md` is as I wrote it for round 2
  (`git diff --stat d071811 HEAD` on both files is empty).
- `docs/changes/README.md`, Loops: a changed plan goes "to the architect, then to
  the reviewer again". For ADM-06b round 3 that was done. Here the architect's
  round 3 went straight to the developer and the tester.
- I cannot write a gate-1 approval for round 3: gate 1 needs the reviewer's
  `Verdict: APPROVED` on the latest plan round, and there is none. I do not
  write one.
- What I can say, having read the round 3 diff and `1177ac7` line by line:
  - Round 2's 3.1 (3) contradicted itself ("at the selection of that moment"
    and "Nothing is lost"). The tester proved it. Round 3 resolves it towards
    the plan's own stated intent and removes no protection.
  - The code is the rule: `state.selection.empty || untouched` takes
    `replaceSelection`; anything else takes `replaceRange(after, after, piece)`
    with `after = state.selection.to`. `untouched` needs both `doc.eq` and
    `selection.eq` against the state kept at paste time. The replaced-document
    counter is still checked before any insert.
  - It was built red first (`c4d93b9` before `1177ac7`), its place is pinned by
    exact-document assertions (`eb696cc`), and the tester attacked it with
    probes L1 to L6 against the real server filter and could not make it
    replace anything the person had not pasted over.
  - The architect declining the tester's observation (a) is reasonable: the
    answer comes from the API, which is the boundary (S-1).
- So I see no design fault, and the risk of the skipped step is low. It is
  still a skipped step, and my reading is not the reviewer's. Condition 1 closes
  it before the owner is asked. If the reviewer returns anything but APPROVED,
  this approval lapses and the change goes back to the architect.

## What I verified myself

### Base and pushes

```
$ git fetch origin
$ git log --format='%h %cs %s' origin/rebuild/dotnet-platform -1
77296ba 2026-11-11 ADM-06b: Add paging controls to the Studio's long lists (#51)
$ git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD; echo $?
0
$ git rev-parse --short origin/change/ADM-03
aef22b5
$ git diff --stat origin/change/ADM-03 HEAD
 docs/changes/ADM-03/test-report.md | 236 ++++
$ gh api repos/mohya7/DH-WEBSITE/pulls/52
52 draft=true state=open head=aef22b5 base=rebuild/dotnet-platform base_sha=77296ba mergeable=true
```

The base has not moved. The local head differs from the pushed head only by the
test report. Open pull requests: #52 and #44 (GAP-07, `277a636`, no `studio/`
file).

### Scope (conditions 3, 9, 10, 11 of gate 1)

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
```

- Four files outside the records, exactly the plan's section 4 without the
  "only on Yes" rows. `MediaPicker.tsx` and `listPaging.test.tsx` are untouched,
  as O-ADM03-2 being unanswered requires.
- One file per code commit, in the planned order (`git show --name-only`):
  `0975b00` e2e spec; `da940bb` render tests and the fake; `eff1880` the editor;
  `c4d93b9` tests; `1177ac7` the editor; `eb696cc` tests.
- The diff of `RichTextEditor.tsx`, read in full, matches plan 3.1 items 1 to 6
  as amended by round 3:
  - `onUpdate` is one line, `onChange(cleanDocument(...))`. `setContent` is gone
    from the paste path.
  - `handlePaste` sends only an image-carrying slice, through `request` and
    `jsonInit` (A-12), after `cleanNode` and `withoutUnknownMediaIds`.
  - `knownMediaIds` is written in three places only (`noteMediaIds` from the
    first document and from the `value` effect; `insertImage`). It is not the
    picker's map; `rememberMedia` is still called, unchanged (condition 9).
  - The comment beside the set carries the invariant, the "never removed" fact
    and the warning for other hosts (conditions 5 and 7).
  - The `value` effect's guard is unchanged; it adds `noteMediaIds(next)` and
    `replaced.current += 1` (condition 8).
  - `handleDrop` refuses an outside drop with an image; `addInputRules` returns
    `[]`; `parseHTML` puts `img[mediaid]` first.
  - A thrown request is treated as a failed one. That is stricter than the
    plan's wording and fails closed. Accepted.
- No untyped value, no direct `fetch`, no config read, no new dependency.

### Red first (P-4, B-6, G3 rule)

`git log`: `0975b00` and `da940bb` precede `eff1880`; `c4d93b9` precedes
`1177ac7`. I reproduced both reds from an export of each commit
(`git archive <sha> studio packages` into the session scratchpad, with the
worktree's `node_modules` linked; removed afterwards; nothing in the repository
was checked out or changed):

```
da940bb  $ npx vitest run test/richText.test.tsx
      Tests  12 failed | 2 passed (14)                         exit 1
c4d93b9  $ npx vitest run test/richText.test.tsx
      Tests  5 failed | 15 passed (20)                         exit 1
   × an image inserted while a paste is being checked is kept      (T16)
   × an image selected while a paste is being checked is kept      (T17)
   × a document selected while a paste is being checked is kept    (T18)
   × a paste that is added clears the notice that nothing was added (T20)
   × a paste that is added clears the notice that a drop was refused (T21)
   AssertionError: expected [] to deeply equal [ Array(1) ]
   AssertionError: expected 'The paste could not be checked, so no…' to be null
   AssertionError: expected 'The dropped content included an image…' to be null
```

Neither output has an "is not a function" or "is not defined" line. The counts
and messages are the developer's and the tester's.

### The CI red on `0975b00` (condition 13)

Read from the job log myself: run `42956506481`, job `130312770458`, "Studio —
typecheck, build, end-to-end", `completed` / `failure`, 04:01:35 to 04:08:00
UTC, head `0975b00`.

```
 Test Files  10 passed (10)
  ✘   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text
  ✘   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered
    Error: paste requests sent while typing
    > 140 |   expect(pastes.map((sent) => sent.postData()), "paste requests sent while typing").toEqual([]);
    Error: paste requests sent while inserting and typing
    > 193 |   expect(pastes.map((sent) => sent.postData()), "paste requests sent while inserting and typing").toEqual([]);
  2 failed
  28 passed (4.5m)
```

E1 and E2 are the only failures, each at the empty paste-request assertion. The
run was not cancelled. Every other check run on `0975b00` is `success` or
`skipped` (CodeQL, screenshot parity). Condition 13 is met.

### The CI green on `aef22b5`, the pushed head

Run `42959042545`, job `130321040327`, same job name, `completed` / `success`,
04:24:59 to 04:31:31 UTC, head `aef22b5`:

```
 Test Files  11 passed (11)
      Tests  80 passed (80)
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
  ✓   8 e2e/rich-text.spec.ts:88:1 › ADM-03 rich text: typing after a stored image keeps the image and the text (8.5s)
  ✓   9 e2e/rich-text.spec.ts:162:1 › ADM-03 rich text: an inserted image stays, and a pasted web image is filtered (11.7s)
  30 passed (4.6m)
```

All 15 check runs on `aef22b5`: 13 `success` (API `130321040083`, Website
`130321040256`, website browser tests `130321040296`, section comparison
`130321362143`, both npm audits, NuGet audit, Semgrep `130321060198`, both
gitleaks scans, security gate self-test, actionlint) and 2 `skipped` (CodeQL,
screenshot parity), as on every earlier head. Also seen: `59d3c65` all
`success` (studio job `130315262853`); `fb7615f` Studio and API `cancelled` by
the next push, which is not evidence and is not used.

### Fastest covering suite, re-run at `a625f00`

In `/home/user/dh-change-adm03/studio` (its `studio/` tree is identical to
`aef22b5`):

```
$ npx tsc -b; echo $?                                  0
$ npx vitest run test/richText.test.tsx; echo $?
 Test Files  1 passed (1)
      Tests  20 passed (20)                            0
$ npm test; echo $?
 Test Files  11 passed (11)
      Tests  80 passed (80)                            0
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?   0
$ git status --short                                   (nothing but this file)
```

NOT RUN by me: the Studio end-to-end suite and the API tests (no SQL Server in
this container; CI jobs `studio` and `api`, read above), and `npm run build`
(the tester ran it at `fb7615f`, exit 0, and CI's `studio` job builds on
`aef22b5`).

### The end-to-end spec against condition 15

Read `rich-text.spec.ts:88-225`. Every page, slug, heading and image carries
`stampFor()`. The empty paste-request list is the first assertion after the
typing in both tests (lines 140 and 193). Images are counted with
`toHaveCount`. E1 reads the stored body back for the media id, "After Edited."
and no `"src"`; E2 requires exactly one paste request, status 200, no `"src"`.
The two additions the developer declared (the "Edit" click, `body.focus()`
before `Control+End`) are steps, not assertions, and I accept them.

### Coverage tables

Every row of `implementation.md` section 13 and of both tester tables has
evidence or a named destination. Rows moved: the error-page library check to
ADM-05; table cells, the cross-tab image, the picture in the editor, the sticky
image notice, refused marks and the decorative image to ADM-22. Two rows are
open and are conditions here: the pull request body (5) and the records (3).

### Commits (B-4, B-5)

All 17 commits since the base have the `ADM-03:` prefix, an imperative subject,
a body saying why and the attribution trailer. Exact paths were staged; no
commit mixes code with another role's record. `0975b00` is an ancestor of the
pushed head, so nothing was rebased or amended.

## Decisions on the tester's open findings

- **Finding 4 (pull request body): open, condition 5.** I read the body on
  GitHub: it is still the commit-1 text. The full draft is below.
- **Finding 5 (records lag the pushes): accepted as true, to be corrected by an
  addendum, condition 3.** Three statements were right when written and are not
  now: section R "This round's commits are not pushed. CI on `c4d93b9` and
  `1177ac7` is NOT RUN"; the coverage row "On the round-2 head: NOT RUN until it
  is pushed"; section 14 "CI on these commits is NOT RUN until the integrator
  pushes". They understate the evidence; they do not overstate it. I do not
  send the delivery back to the developer-and-tester loop for that. A final
  records commit is needed anyway, so a dated addendum goes in with it.
- **Finding 6 (the tested commit is not the head): closed by this gate.**
  `git diff --stat fb7615f HEAD -- studio` is six added lines in
  `richText.test.tsx` and nothing in `studio/src`. I ran the suite at the head
  (80 passed), and CI ran the whole Studio job, end to end, on `aef22b5`. No
  further tester round is needed unless a file under `studio/` changes
  (condition 2).
- **The round-2 red (`c4d93b9`) has local evidence only: accepted.** The G3 rule
  and B-6 ask for the test committed and shown failing before the fix. It is
  committed before `1177ac7`, and three roles saw it fail on that commit: the
  developer, the tester on a checkout, and I on an export, with the same count
  and messages. Plan 5.4 asks for a CI red only for the end-to-end tests,
  because they cannot run locally; T16 to T21 are unit tests that can, and no
  end-to-end test changed in round 2. This is not a NOT RUN that needs an
  owner's acceptance.

## Notes that do not block

1. A paste made straight after the Image button, while the new image is still
   selected, replaces that image (tester, round 2, section 4). It is a paste
   over a selection and a plain paste does the same. It is in the behaviour
   list below so the owner reads it.
2. `RichTextEditor.tsx` is now 432 lines, the largest file in
   `studio/src/content/`. ADM-22 will add to it. Worth splitting the paste path
   into its own module then, not in this change (B-8).
3. The session set never forgets an id. Recorded for ADM-05; see the draft.

## Conditions for the integrator

1. **Plan round 3 goes to the plan reviewer.** Run the plan-reviewer on the
   round 3 change (`git diff 877b2b5 213cdb8 -- docs/changes/ADM-03/plan.md`)
   and record Round 3 in `plan-review.md`; then gate 1 records round 3 in
   `plan-approval.md`. Both are records only. Do this before the pull request
   leaves draft. If the reviewer's verdict is not APPROVED, this approval lapses
   and the change goes back to the architect.
2. **No file under `studio/` changes after `aef22b5`.** If one does, the change
   goes back to the tester for a full round and to this gate again.
3. **Records addendum (finding 5).** The developer adds a dated section 15 to
   `implementation.md`, and changes nothing above it, saying: `fb7615f` and then
   `aef22b5` were pushed by the integrator; the Studio and API runs on `fb7615f`
   were cancelled by the next push; run `42959042545`, job `130321040327`, on
   `aef22b5` passed with 80 unit tests and 30 end-to-end tests, E1 and E2 among
   them; `c4d93b9` was never a pushed head on its own, so its red is local
   evidence (developer, tester, gate 2). Records only.
4. **CI green on the final pushed head.** The head will move past `aef22b5`
   (`a625f00`, the records of conditions 1 and 3, this file). Push them
   together, by merge only if the base has moved (B-3, B-5), never a bare push
   or a force push. Wait for every check run to conclude; a cancelled run is
   re-run. Quote the run and job ids in the pull request body where the draft
   says `<final head>`.
5. **Pull request body (finding 4, gate-1 condition 14).** Replace the current
   text with the draft below. Remove the "This draft holds only…" paragraph.
   Keep the three headed sections and every item in them.
6. **O-ADM03-1 stays recorded as it is:** pushed on the integrator's notice to
   the owner, following the ADM-06a and ADM-06b precedent; no owner answer for
   ADM-03. Do not write it as answered unless the owner gives words for ADM-03.
   Asking the owner the one-line question when the pull request is presented is
   still the right way to close it.
7. **O-ADM03-2 is unanswered at gate 2,** so by gate-1 condition 10 the
   decorative image goes to ADM-22 with runs D and E as evidence, and nothing of
   it is built here. If the owner later says "Yes", it is a new small change on
   top of this one, red first, not an addition to this pull request after
   approval.
8. **Mark the pull request ready only after 1 to 5.** Then the owner's merge
   confirmation under `AGENTS.md`. The behaviour list is put in front of the
   owner as it is written below, with the first item called out. If the owner
   refuses an item, the change goes back to the architect.
9. **After the merge** the integrator re-runs the suites on
   `rebuild/dotnet-platform` (`AGENTS.md`) and records it. One slot-2 merge a
   day: #49 and #51 merged on 11 November, so the earliest day for this is
   12 November.

## Definition of Done (template), as of `a625f00`

| Box | Can be ticked truthfully? |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes. The audit's three fix lines and its two symptoms (image removed on insert; " Edited." losing characters) are each covered by a unit test and by E1 or E2 in a browser |
| Code follows the engineering standards | Yes. API call through `request` in `http.ts` (A-12); fails closed on every path that cannot decide (P-5); one module, one fix (B-8) |
| No new prohibited constructs | Yes. No untyped values (`unknown` is narrowed), no direct `fetch`, no config read, no data access outside the API client |
| Every new or changed route has a guard | Yes, vacuously: no route added or changed. `POST /api/v1/rich-text/paste` keeps policy `studio` |
| Tests exist for the behaviour changed; every security fix has a regression test | Yes: T1, T2, T4 to T21, E1, E2; T13 is the attack test, red before the fix. Changed-line coverage: no gate exists yet (G-8 is a Gap) and none was measured; say so |
| PR checks green on the final head (run ids) | **Open.** Green on `aef22b5` (run `42959042545`); the final head will be later (condition 4) |
| Independent code review run; findings fixed or accepted | Yes for the code: plan review rounds 1 and 2, tester rounds 1 and 2 (two Minors fixed red first), this gate. **Open for plan round 3** until condition 1 |
| Reviewed by someone other than the author | Yes, by pipeline roles; the owner's review is still to come |
| Rollback understood | Yes. Revert the pull request; no migration, nothing stored differently |
| Deployment note | Until Phase D: the integrator merges into `rebuild/dotnet-platform` and re-runs the suites after the merge. **Open** until then |

Governance boxes: coverage tables are in `docs/changes/ADM-03/`;
`docs/deferred-items.md`: no exception is claimed and no D-NNN entry is needed
(the two tester Minors were fixed; the rest is moved to ADM-22 and ADM-05 by
note, not waived); documentation: the records in `docs/changes/ADM-03/`.

## Draft pull request description

Title: `ADM-03: Keep images and typed text in rich-text fields`

Keep whatever attribution header the integrator's tooling puts at the top of the
body. Replace `<final head>`, `<run id>` and `<job id>` once condition 4 is met.

```markdown
## What and why

ADM-03 is an admin audit blocker (track G3, batch G3-1;
`docs/quality/admin-audit-2026-10-28.md`). In the Studio, a rich-text field
that holds an image lost the image on the first keystroke, an image added with
the Image button vanished at once, and text typed after an image was lost (the
audit typed " Edited." and kept two characters).

The cause was in the Studio's editor. Every image node carries a `src` key, so
the editor sent the whole document to the paste filter on every change, the
server dropped the library image because of that key, and the answer was set
back over the document while the person typed.

The fix, in `studio/src/content/RichTextEditor.tsx` only:

- Typing and inserting no longer call the paste filter. The editor only reports
  its document.
- Only a paste that carries an image is sent to the server's filter, and only
  the pasted piece, never the document. The answer is inserted; it never
  replaces the document.
- A library image now survives copy and paste inside the Studio.
- So that moving the filter opens no other way in: a drop from outside that
  carries an image is refused, typing the Markdown image pattern stays text,
  and a pasted media id counts only if this Studio tab already got it from the
  API (in a loaded document or from the image picker).

The plan (three rounds), the plan reviews, both gates, the developer's record
and the test report (two rounds) are in `docs/changes/ADM-03/`.

## Scope and boundaries

In scope:

- `studio/src/content/RichTextEditor.tsx`
- `studio/test/richText.test.tsx` (20 render tests) and
  `studio/test/support/pasteFilter.ts` (a test-only copy of the server's image
  rule)
- `studio/e2e/rich-text.spec.ts` (2 browser tests)
- `docs/changes/ADM-03/`

Not touched, on purpose: every `api/` file (the server filter already keeps an
image with a valid media id when no `src` is sent, and already accepts a list
of nodes), `MediaPicker.tsx`, `InlineTextEditor.tsx`, `website/`, `packages/`,
`package.json`, `package-lock.json`, every `tsconfig`, the Vitest and
Playwright configs, the e2e harness and every workflow. No dependency added. No
migration.

## Security impact

- No route, policy, secret, dependency, configuration or rate limit changes.
  `POST /api/v1/rich-text/paste` keeps policy `studio` and is called far less:
  once per image-carrying paste, not on every keystroke.
- The server's allow-list is untouched. Every save still runs
  `RichText.Validate`.
- This change adds one parse rule, `img[mediaid]`, so the editor's own images
  can be pasted back. A web page could put that attribute on an image of its
  own. That is closed in the editor: a pasted media id is kept only if this tab
  already got it from the API; any other id is sent to the filter as `null` and
  the image is dropped with the notice. No address from pasted HTML is ever
  sent, stored or rendered.
- Attack test, red before the fix: T13 pastes a crafted
  `img[mediaid][src]` twice and asserts no `"src"`, no foreign address and no
  foreign id in any request, document or `onChange` value. The tester repeated
  it in nine variants, through a drop, a remount, undo and redo, and on the
  error-page editor, against the real server filter.
- Fails closed: a paste whose check fails, throws, cannot be built or returns
  after the document was replaced adds nothing and says so.
- Worst case left: a page that knows the id of an image this tab has already
  loaded or picked can make a paste carry that library image with the page's
  alt text. It is an image the person already has, and the save checks it as
  any other.
- Left for ADM-05: see "For ADM-05".

## Tests and evidence

Red first:

- End-to-end, in CI on `0975b00` pushed alone: run `42956506481`, job
  `130312770458`, "Studio — typecheck, build, end-to-end", `failure`.
  `2 failed`, `28 passed`. The two failures are the new tests, at
  `rich-text.spec.ts:140` ("paste requests sent while typing") and `:193`
  ("paste requests sent while inserting and typing"). Every other check on that
  commit passed.
- Render tests, at `da940bb`, before the fix `eff1880`:
  `npx vitest run test/richText.test.tsx` exit 1, `12 failed | 2 passed (14)`.
- Rework after the test report, at `c4d93b9`, before the fix `1177ac7`: exit 1,
  `5 failed | 15 passed (20)`. This commit was never a pushed head on its own,
  so this red is local: run by the developer, by the tester on a checkout, and
  by the tech lead on an export of the commit. They are unit tests; no
  end-to-end test changed.

Green:

- Local, at the head: `npx tsc -b` exit 0;
  `npx vitest run test/richText.test.tsx` `20 passed (20)`; `npm test`
  `80 passed (80)`, 11 files; `npm run build` exit 0 with the preview design
  check; `git diff --exit-code` on the Studio lockfile and `package.json`
  exit 0.
- CI on `59d3c65`: run `42957284006`, studio job `130315262853`, `success`,
  `30 passed`.
- CI on `aef22b5`: run `42959042545`, studio job `130321040327`, `success`,
  unit tests `80 passed (80)`, end-to-end `30 passed (4.6m)` with both new
  tests. API, Website, website browser tests, section comparison, both npm
  audits, NuGet audit, Semgrep, both gitleaks scans, the security gate
  self-test and actionlint: `success`. CodeQL and screenshot parity: `skipped`,
  as on every head.
- CI on `<final head>`: run `<run id>`, studio job `<job id>`: to be filled in.
- The tester also ran the 20 render tests and 25 probes with the real
  `RichText.FilterPaste` in place of the test copy: all pass.

NOT RUN locally, with the CI job that covers it:

- Studio end-to-end suite: no SQL Server in the build container. CI `studio`.
- API tests: no `api/` file changes. CI `api`.
- The Studio and API jobs on `fb7615f` were cancelled by the next push and are
  not used as evidence.

## Owner decisions

- **O-ADM03-1, push the failing browser test first as a draft pull request.**
  The owner was not asked this for ADM-03 and has not answered it for ADM-03.
  For the same question on ADM-06b the owner said: "Yes, red test first like
  #49" (Mohamed Elbadry, 11 November 2026, project thread). The integrator gave
  notice in the thread that it would do the same here, and pushed `0975b00`
  alone on that notice. That is the integrator's act, not an owner decision.
- **O-ADM03-2, insert an image the library marks decorative as decorative.**
  Asked by card with a recommendation of "Yes". Unanswered. Nothing of it is
  built here; it is recorded under "For ADM-22".

No exception to the engineering standards is claimed, and there is no D-NNN
entry.

### Behaviour changes for the owner

None of these is an exception. Each follows from the fix and keeps the
protection the old code gave. They are listed so they can be refused before
the merge.

**One takes away something that works today:**

1. A drop from another page that carries an image is now refused whole, with a
   notice. Today its text is kept and only its image is removed. Pasting the
   same content still works.

The rest:

2. Typing `![alt](url)` stays as text. Today the text is removed with the
   image.
3. Two new notices: "The paste could not be checked, so nothing was added.
   Paste again." and "The dropped content included an image, so it was not
   added. Use the image button for images."
4. Content pasted with an image is added when the server's check returns, not
   at once.
   - It goes in at the caret, so it can follow text typed in that moment.
   - If something was selected after pasting (the Image button leaves its new
     image selected), it goes in straight after that selection and replaces
     nothing.
   - What was selected at the moment of pasting is replaced, as with any paste.
     So a paste made straight after the Image button, with the new image still
     selected, replaces that image.
   - Two such pastes made one straight after the other can land in the other
     order. Both are added.
5. The pasted content is not added if the check fails (notice), if another
   item is opened in the same editor meanwhile (notice), or if the field is
   closed meanwhile (no notice; nobody is there to read it).
6. The two new notices go away when a later paste is added. The older notice,
   "This paste included an image. Use the image button so you can add alt
   text.", still stays until the editor is reloaded.
7. A library image copied in another browser tab, or in another Studio, is
   dropped on paste with the image notice, unless this tab has already loaded
   or picked that image. The Image button adds it. Today every pasted image is
   lost, so nothing that works today stops working.
8. Dragging an image inside the editor with the copy key held (Ctrl-drag) is
   refused with the drop notice. Dragging to move it works. Copy and paste
   makes a copy.
9. A paste of table cells that hold an image is added as a table at the caret,
   not merged into the selected cells. Today that paste loses its images.

## For ADM-22

Found here and left alone:

- The editor shows an image as its alt text, not as a picture.
- The image notice, once shown, stays until the editor is reloaded.
- The editor can make marks and nodes the server refuses on save (for example
  strike and underline); only image-carrying pastes are filtered. When a paste
  carries an image, the server filter also removes a hard break and a rule.
- A paste of table cells that hold an image is inserted as a table at the
  caret, not merged into the selected cells.
- A library image copied in another tab is dropped on paste. A library lookup
  could allow it (plan 3.3).
- Per-use alt text and a decorative switch inside rich text.
- **The decorative image (O-ADM03-2, unanswered).** An image the library marks
  decorative, with no alt text, is inserted as `alt: ""`, `decorative: false`.
  It now stays in the editor, and the save refuses the item until the image is
  removed: "needs alt text, or the image must be marked decorative." Before
  this fix the image vanished, so nobody reached that point. Evidence: plan
  2.3 (b), runs D and E.
- `RichTextEditor.tsx` is 432 lines; the paste path is a candidate to move to
  its own module when ADM-22 adds to it.

## For ADM-05

- The error-page save, `AdminStore.UpdateErrorPageAsync`
  (`AdminStore.cs:549-599`), does not check that a rich-text image's media id
  is in the library, as `ContentStore.cs:752-753` does for pages and items.
  ADM-05 routes that save through the draft and publish flow, so the check
  belongs there. After this change the Studio cannot put an unknown id into
  that editor by paste (T13; tester probe E1).
- A media id stays known for the life of the tab, so an image deleted from the
  library during the session can still be pasted from the clipboard. A page or
  item save refuses it; the error-page save stores it until ADM-05 adds the
  library check.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no route changed)
- [x] Tests exist for the behaviour changed; the security fix has a regression test, T13 (changed-line coverage: no gate yet, G-8; not measured)
- [ ] PR checks are green on the final head (run IDs quoted) — tick when the runs on `<final head>` are in
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below — tick when plan round 3 has its plan review (the code has been reviewed by the tester in two rounds and by the tech lead)
- [x] Reviewed by someone other than the author (pipeline roles); owner review pending
- [x] Rollback is understood: revert this PR; no schema or data change, nothing stored differently
- [ ] Deployment note: the integrator merges into rebuild/dotnet-platform after the owner confirms, and re-runs the suites after the merge

## Review findings accepted

- Plan round 3 (`213cdb8`), which made the late-paste rule the design, was
  written after the rework and went to the tester and gate 2 without a plan
  review round. The tech lead read it against the code and found no fault; the
  plan review is being added as a record before this leaves draft.
- Tester observation (a): the filter's answer is inserted as it comes. Only the
  API can send it, and the real filter rebuilds every image node. Not taken;
  it can be added later.
- Tester observation (b): a paste whose field is closed before the answer is
  dropped without a notice.
- The round-2 red (`c4d93b9`) has local evidence only, from three roles; it was
  never a pushed head on its own.
- The e2e spec adds two steps the plan did not list (an "Edit" click to open a
  stored section; a focus before `Control+End`). No assertion is weakened.
- Parts of `implementation.md` written before the later pushes say CI was not
  run; its last section and the test report give the runs.

## Governance

- [x] Coverage tables updated (`docs/changes/ADM-03/`)
- [x] `docs/deferred-items.md`: no exception
- [x] Documentation updated (`docs/changes/ADM-03/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
