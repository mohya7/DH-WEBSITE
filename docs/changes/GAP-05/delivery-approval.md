# GAP-05 delivery approval (gate 2)

## Round 1

Tech lead, 2026-11-22. Branch `change/GAP-05`, head `c3d3fbf`. The base was
merged in at `afac55f`, which includes ISO-3 (#79).

## Decision

**Changes needed.** This goes back to the developer. Since the last base merge
the base has moved: `origin/rebuild/dotnet-platform` is now at `aca11b0`
(#80, GAP-11c-deferred), which adds D-002 and D-003 to `docs/deferred-items.md`.
This branch adds D-001 to the same file, at the same place: both sides replace
the line "No entries yet." The two branches no longer merge cleanly. Test 4
reads that file, so the tested head would not be the head that merges. Apart
from this, the delivery is sound and I would approve it.

## What I verified myself

- `git fetch`. `git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD`
  is false, so the base is not in the branch. `git merge-tree --write-tree
  origin/rebuild/dotnet-platform HEAD` reports a conflict in
  `docs/deferred-items.md`, stages 1, 2 and 3. That is the only conflicting file.
- D-001 is still free: #80 took D-002 and D-003 and left D-001 unused, so the id stays.
- **Scope.** `git diff origin/rebuild/dotnet-platform...HEAD --stat` shows nine
  files, all in the plan's scope: `ci.yml`, `deferred-items.md`,
  `parity-gates.test.ts`, `accepted-differences.json`, `compare.html` and the
  change records.
- **`ci.yml` diff** (C-5):
  - The `continue-on-error: true` line is removed from "Compare sections".
  - The section-compare comment is rewritten to say the step blocks.
  - The screenshot comment now cites D-001 and its expiry, 2026-12-14.
  - Line 410's `continue-on-error` stays.
  - No `uses:`, image or version line changes.
- **Failing test first** (C-1). `3cd972e` adds only `parity-gates.test.ts` and
  comes before the fix in `dc8cc13`. The `ci.yml` edit (`74fd862`) comes after
  the merge of ISO-3 (`afac55f`, C-2).
- **Re-run.** `npx vitest run test/parity-gates.test.ts` in `website/` exited 0:
  "Tests 5 passed (5)".
- **B-4.** Every non-merge commit has the subject `GAP-05: ...` and a
  `Co-Authored-By: Claude Opus 5.5` trailer.
- **The tester's report.** Round 1 ends APPROVED:
  - Locally, the section comparison exits 0 with `0 failures`.
  - The C-6 mutations m1 to m5 each exit 1, done locally with nothing pushed.
  - Minors F-1 (test 3 does not cover label text) and F-2 (test title) are
    accepted. The blocking `section-compare` job covers label text.

## What the developer must do (findings for the developer)

- **D-1.** `git fetch origin` and `git merge origin/rebuild/dotnet-platform`
  (a merge, not a rebase). Resolve `docs/deferred-items.md` so that D-001,
  D-002 and D-003 are all present, in id order, each unchanged. Quote the
  resolution diff in `implementation.md`.
- **D-2.** After the merge, re-run and quote:
  - `npx vitest run test/parity-gates.test.ts`
  - `npm test`
  - `npm run typecheck` and `npm run build`
  - the local `npm run compare:sections`

  Then it goes to the tester again on the new head.
- **D-3** (optional, from tester F-2). Correct the misleading test title, or record it as accepted.

## Open Definition of Done items (still open after D-1 to D-3)

- PR checks green on the final head, with run ids. Not run: nothing is pushed
  until the owner confirms. This includes the blocking `section-compare` job
  showing `0 failures`, and one labelled `screenshots` run reviewed by hand.
- actionlint and gitleaks: NOT RUN locally (not installed). They are covered by
  CI "Workflow lint" and `security.yml`.
- `screenshot-parity-browser.test.ts`: NOT RUN, because port 4284 is held by a
  process the tester did not start. Covered by CI `screenshot-parity`.
- The owner's confirmation of the push, and the owner's squash-merge.

## Draft pull request description

## What and why

GAP-05: the section comparison now blocks, and the screenshot comparison has a
recorded exception.

- The careers apply section is accepted as it renders today, under O-11. The
  new `apply-form` entry rebuilds the expected section and requires an exact
  match.
- The stale `apply-by-email` entry is removed, along with its handler.
- `continue-on-error` is removed from "Compare sections".
- The screenshot comparison stays non-blocking under D-001, which expires on 2026-12-14.

## Scope and boundaries

In scope: `.github/workflows/ci.yml` (the section-compare step and the two
comments), `website/tools/section-compare/accepted-differences.json`,
`compare.html`, `website/test/parity-gates.test.ts` (new),
`docs/deferred-items.md` (D-001) and `docs/changes/GAP-05/`.

Out of scope: `ApplyForm.tsx` and the public API; the 126 screenshot
differences (follow-up under D-001); the section comparison canary (GAP-21);
every other `ci.yml` job.

## Security impact

None. There are no route, policy, secret, dependency or migration changes, and
no action pin changes. The design gate is stronger.

## Tests and evidence

- `npx vitest run test/parity-gates.test.ts`: exit 0, 5 passed.
- The tests were committed failing first, in `3cd972e`.
- Local `npm run compare:sections`: exit 0, `0 failures`, `**Pass.**`.
- Five mutations, each exit 1 (see `test-report.md`).
- CI run ids: to be added after the push.
- NOT RUN: actionlint and gitleaks (covered by CI); `screenshot-parity-browser`
  (port held; covered by CI `screenshot-parity`).

## Owner decisions

- O-11: "(a) Accept current form" (owner, 2026-11-19, via the orchestrator).
- O-21: "Exception, expires 14 Dec" (owner, 2026-11-19, via the orchestrator).
- D-001 follow-up owner: "The /change pipeline" (owner, 2026-11-19, via the orchestrator).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (CI proof on the final head is pending)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no routes changed)
- [x] Tests exist for the behaviour changed; no security fix in this change
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run (plan review rounds 1 to 3, tester, gate 2)
- [x] The approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood: revert this PR
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges, and CI re-runs on rebuild/dotnet-platform.

## Review findings accepted

- Tester F-1: test 3 does not cover label text. The blocking `section-compare` job catches it.
- Tester F-2: the test title (unless fixed under D-3).
- Plan review F-8: test 2 skips its old-page checks in the shallow CI checkout. `section-compare` is the backstop.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (`docs/changes/GAP-05/`)
- [x] `docs/deferred-items.md` updated for any exception (D-001)
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Round 1 outcome: changes needed (D-1 to D-3).

## Round 2

Tech lead, 2026-11-22. Head `ba22dbd`. The base `aca11b0` was merged in at
`79169c5`. `implementation.md` is at Round 4, and `test-report.md` Round 2 is
APPROVED.

### Decision

**Approved.** D-1 to D-3 are answered. The change now goes to the owner, who
confirms the push and squash-merges.

### What I verified myself

- **Base.** After `git fetch`, `origin/rebuild/dotnet-platform` is still at
  `aca11b0`, and `git merge-base --is-ancestor origin/rebuild/dotnet-platform
  HEAD` is true.
- **D-1.** `git diff --no-index` of the base's `docs/deferred-items.md` against
  the branch's shows 22 insertions and no deletions. The headings are D-001
  (line 21), D-002 (43) and D-003 (60), so D-002 and D-003 are unchanged.
- **Scope.** The diff touches the same nine files as Round 1. No new file
  entered the diff in the merge or in `ba22dbd`.
- **D-2.** I re-ran `npx vitest run test/parity-gates.test.ts`; it exited 0
  with "Tests 5 passed (5)". The tester's Round 2 table quotes:
  - the build, exit 0;
  - the clean section comparison, exit 0, "0 failures", `**Pass.**`;
  - the one-word change, exit 1, "1 failures";
  - `screenshot-parity-browser.test.ts`, exit 0, "30 passed | 1 skipped". This
    was NOT RUN in Round 1 and has now run.
- **D-3.** `ba22dbd` fixes the title (tester F-2).
- **B-4.** The `ba22dbd` subject starts with "GAP-05:" and carries the
  `Co-Authored-By` trailer. `79169c5` is a merge commit.

### Open Definition of Done items

- PR checks green on the final head, with run ids. Not run, because nothing has
  been pushed. After the owner confirms the push, CI must show:
  - `section-compare` blocking with "0 failures";
  - Workflow lint (actionlint) and Security (gitleaks), green;
  - one `screenshots`-labelled run, its report reviewed by hand and quoted.
- The owner's confirmation of the push, and the owner's squash-merge. This
  approval is not either of them.

### Draft pull request description (head `ba22dbd`)

## What and why

GAP-05: the section comparison now blocks, and the screenshot comparison has a
recorded exception, D-001.

- The careers apply section is accepted as it renders today, under O-11. The
  new `apply-form` entry rebuilds the expected section and requires an exact
  match.
- The stale `apply-by-email` entry and its handler are removed.
- `continue-on-error` is removed from "Compare sections".
- "Compare screenshots" stays non-blocking until 2026-12-14, under D-001.

## Scope and boundaries

In scope:
- `.github/workflows/ci.yml`: the section-compare step and the two comments;
- `website/tools/section-compare/accepted-differences.json` and `compare.html`;
- `website/test/parity-gates.test.ts` (new);
- `docs/deferred-items.md` (D-001 added; D-002 and D-003 unchanged);
- `docs/changes/GAP-05/`.

Out of scope:
- `ApplyForm.tsx` and the public API;
- the 126 screenshot differences (the follow-up under D-001);
- the section-compare canary (GAP-21);
- every other `ci.yml` job.

## Security impact

None. There are no route, policy, secret, dependency, migration or action-pin
changes. The design gate is stronger.

## Tests and evidence

Run on `ba22dbd`, as quoted in `docs/changes/GAP-05/test-report.md` Round 2:

- `npx vitest run test/parity-gates.test.ts`: exit 0, 5 passed. The tests were
  committed failing first, in `3cd972e`.
- Build: exit 0, "Build output checks passed."
- Clean `npm run compare:sections`: exit 0. "104/119 sections match; 15
  accepted; 0 failures (including chrome)."
- A one-word change to the apply form: exit 1, "differs: /careers/apply.html
  #section".
- `screenshot-parity-browser.test.ts`: exit 0, 30 passed, 1 skipped.
- CI run ids: to be added after the push.

## Owner decisions

All three were given on 2026-11-19, via the orchestrator:
- O-11: "(a) Accept current form".
- O-21: "Exception, expires 14 Dec".
- D-001 follow-up owner: "The /change pipeline".

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (CI proof on the final head is pending)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no routes changed)
- [x] Tests exist for the behaviour changed; no security fix in this change
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run (plan review rounds 1 to 3, tester rounds 1 and 2, gate 2)
- [x] The approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood: revert this PR
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into rebuild/dotnet-platform, and CI re-runs after the merge.

## Review findings accepted

- Tester F-1: test 3 does not cover label text. The blocking `section-compare` job catches it.
- Plan review F-8: test 2 skips its old-page checks in the shallow CI checkout. `section-compare` is the backstop.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (`docs/changes/GAP-05/`)
- [x] `docs/deferred-items.md` updated for any exception (D-001)
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Verdict: APPROVED
