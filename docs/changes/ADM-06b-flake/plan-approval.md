# ADM-06b-flake: plan approval (gate 1)

Technical lead, gate 1, 11 November 2026. Plan: `docs/changes/ADM-06b-flake/plan.md`
at `f003e7c`. Review: `plan-review.md` round 1 at `79edc2f`, `Verdict: APPROVED`,
no Blockers, no Majors, five Minors. Branch `change/ADM-06b-flake`, base `77296ba`
(`origin/rebuild/dotnet-platform` is still at `77296ba` after `git fetch`).

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires and it is not an owner decision (P-7).

## Decision

Approved, with the conditions below. The cause is shown with evidence, the fix
is the smallest one, it is test-only, and it makes the file stricter instead of
hiding the error (P-6).

## Reasons

1. **Right change.** A CI step that fails with every test passing is CI telling
   lies. That is the refinement plan's Wave 1 ("make CI honest", 3 to 16 November),
   and the defect sits in a test ADM-06b (G3-1) added. One topic, one file (B-8).
2. **Evidence I checked myself.** In a scratchpad copy of `studio/`
   (`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/tl/studio`,
   `node_modules` linked; the worktree was not edited, and `git status --short` is
   empty):
   - Guard only (`expect(document.body.innerHTML).toBe("")` after `cleanup()`):
     `npx vitest run test/listPaging.test.tsx` gave exit 1,
     `Tests  18 failed | 3 passed (21)`. The first failure is
     `contact inbox paging > marking an enquiry handled reloads the same page`, and
     the failure is
     `AssertionError: expected '<div class="ant-message ant-message-l…' to be '' // Object.is equality`.
   - Guard plus the partial `antd` mock and `toast.success.mockClear()` in
     `beforeEach` (I did not add the two spy assertions), with `--silent=false`:
     exit 0, `Tests  21 passed (21)`, no `Errors` line, and
     `grep -c "antd: message"` gives `0`.
   So the plan's red and green both reproduce here, as they did for the reviewer.
   I did not rerun the probe. The architect and the reviewer each ran it 3 of 3,
   and the tester reruns it (below).
3. **No conflict with open work.** Open pull requests (`gh api .../pulls?state=open`):
   #52 `change/ADM-03` and #44 `change/GAP-07`. #52 changes
   `studio/test/richText.test.tsx` and `studio/test/support/pasteFilter.ts`, not
   this file. #44 changes nothing under `studio/`. Among the remote branches, only
   `origin/change/ADM-06b` touches `listPaging.test.tsx` or `ContactInboxPage.tsx`,
   and it is already squashed into the base as #51 (`git diff --stat` of the base
   against it for those two files is empty). `origin/phase-c/section-9` changes
   `studio/vitest.config.ts`, which this plan leaves alone.
4. **Execution order.** This does not jump the queue. #44 (GAP-07, Wave 0)
   keeps its place ahead of anything from Wave 1. This change only fixes a test
   harness, so it can take whichever slot the integrator has free. Merging it
   before #44 reruns its `studio` job would help #44, but the integrator decides
   that, and this change must not delay #44. With #52 and #44 open, a third pull
   request leaves the queue at three, which is not past the plan's pause threshold.
   ISO and Blocker or Major ordering does not apply.
5. **Owner decisions.** The plan needs none: no behaviour change, no exception,
   no D-NNN. I agree with section 9.
6. **Risk** is low. Only one test file changes. The worst case is a false red from
   the guard after a later antd change, and the guard's message prints the leftover
   HTML. Rollback is a revert.

## Should the red commit be pushed alone first?

**No, it is not needed.** The owner's ADM-06b answer ("Yes, red test first like
#49") was given for ADM-06b, not for this change. I do not treat it as an owner
decision here, and I am not inventing one. It is not needed for these reasons:

- B-6 requires a red commit before the fix for security fixes. This is not one.
  P-4 is met by the red commit coming before the green one in the branch's history,
  and by checking that order in review.
- This red is deterministic and local (18 failed, 3 passed, every time). It does
  not depend on the race and does not need a CI runner to show it. A CI run of the
  red commit would only add a failing `studio` job that tells us nothing new.

So the developer pushes the red and the green commits together, in that order, as
plan 5.2 says. If the owner later asks for a CI red as well, that is the owner's
call and it does not block this change.

## Reviewer's Minors

| # | Minor | Decision |
| --- | --- | --- |
| 1 | Timeout margin of the two Mark handled tests under load | **Accepted to leave unfixed**, as an observation. Changing timeouts is a separate topic (B-8). Condition 2 records it |
| 2 | 2.5 overstates what the probe proves | Condition 3 fixes the wording in the change records, not in the plan |
| 3 | "eight screens" should be seven files; 18.76 s vs 9 s should be 11 999 ms for the file | Condition 3 |
| 4 | Ask CI for a positive signal: 0 matches for `antd: message` | Taken as a gate 2 requirement (G2 below) |
| 5 | The test file is not type-checked | **Accepted**, observation only, out of scope. It was already true for the whole file |

The plan itself is not rewritten for Minors 1 to 3. The developer records the
corrections in `implementation.md`, where gate 2 reads them. The plan stays as it
was approved.

## Conditions for the developer

1. Follow plan 3.1 and 5.2 exactly. There are two commits, both changing only
   `studio/test/listPaging.test.tsx` (plus `docs/changes/ADM-06b-flake/` records,
   which may go in separate commits):
   1. `ADM-06b-flake: Fail a paging test when a toast outlives cleanup`, with the
      guard only;
   2. `ADM-06b-flake: Replace the static toast with a spy in the paging tests`, with
      the partial `antd` mock and its comment, `toast.success.mockClear()` in
      `beforeEach`, and `expect(toast.success).toHaveBeenCalledWith("Marked handled.")`
      in both Mark handled tests.
   Do not change or remove any existing assertion, test, timeout or config. Do not
   use `onUnhandledError`, `dangerouslyIgnoreUnhandledErrors`, retries or skips.
   Do not touch `studio/src/`, `vitest.config.ts`, `support/pagedApi.ts`,
   `package.json` or the lockfile.
2. In `implementation.md`, record Minor 1 as an observation that is not fixed here:
   both Mark handled tests run close to the 5 s default timeout under load (the
   reviewer's 12 parallel runs timed out on the base and on the fix alike), and a
   `Test timed out in 5000ms` in those tests is not this defect.
3. In `implementation.md`, record the reviewer's corrections to the plan's text.
   The probe proves that the toast's root is the only React root still updating
   *on an animation frame*. Static `message` is used in seven files (six pages plus
   `AppShell`), not eight screens. The comparable CI time is
   `test/listPaging.test.tsx (21 tests) 11999ms`.
4. Run every command in plan 5.3 and quote each one as run: command, exit code and
   the relevant output lines (P-8). Include the red summary
   `Tests 18 failed | 3 passed (21)` at commit 1 with one assertion message, the
   green `Tests 21 passed (21)`, `npm test` `Tests 60 passed (60)` with no `Errors`
   line, `tsc -b`, the build, the 40-run count (labelled a stability check, not
   evidence of the fix), and the probe red on the base and green at commit 2, run
   in a scratchpad copy only.
5. Show that `git diff --exit-code -- studio/package.json studio/package-lock.json`
   exits 0 (B-7). Show that
   `git diff --name-only origin/rebuild/dotnet-platform...HEAD` lists only
   `studio/test/listPaging.test.tsx` and `docs/changes/ADM-06b-flake/*`.
6. Push the red and green commits together, red first. Do not push the red one
   alone (see above). Do not squash or reorder them on the branch. Every commit
   follows B-4: the `ADM-06b-flake:` prefix, an imperative subject, a body that
   says why, and the attribution trailer.
7. If the plan cannot be followed as written (for example, the mock does not
   reach the screen's import), stop and send the change back to step 1. Do not
   improvise.

## What the tester must do

1. Work on a detached checkout of the developer's head, not on the branch.
2. Rerun the probe of plan 2.5 in a scratchpad copy: red on the base `77296ba`
   (CI stack, `ReferenceError: window is not defined` at
   `performWorkOnRootViaSchedulerTask`) and green at the head (exit 0, empty
   `PROBE body after cleanup:`). Quote both.
3. Check out the red commit and confirm `Tests 18 failed | 3 passed (21)`. Check
   out the head and confirm `Tests 21 passed (21)`.
4. Run `npm ci`, `npm test`, `npx tsc -b` and the build at the head, and quote
   them. With `--silent=false`, count `antd: message` in the file's output: 1 on
   the base and 0 at the head.
5. Check that both new `toHaveBeenCalledWith("Marked handled.")` assertions
   fail if the spy is not wired. For example, temporarily remove
   `message.success` from the screen in a scratchpad copy and confirm they go red.
   This shows they are not vacuous. Use a scratchpad copy only, and never edit
   the worktree.
6. Confirm the scope (condition 5) and the commit order and trailers (condition 6)
   from `git log` and `git diff`. Confirm nothing in P-6's forbidden list was used.
7. Fill the plan's coverage table (section 11) with evidence for every row. Mark
   CI rows NOT RUN until the pull request's job exists, and name the job.

## What gate 2 will require

- **G1.** The pull request's `studio` job ("Studio — typecheck, build, end-to-end")
  is green on the final head. Quoted from its log: `✓ test/listPaging.test.tsx (21 tests)`,
  `Tests  60 passed (60)`, and no `Unhandled Errors` block or `Errors` line.
  Then type check, build and the end-to-end step pass.
- **G2.** The same log has 0 matches for `antd: message` (the base job
  `130455431268` has 1), quoted with the grep command.
- **G3.** In `git log origin/rebuild/dotnet-platform..HEAD`, the red commit comes
  before the green one, and `implementation.md` quotes the local red summary.
- **G4.** The tester's probe rerun, red on the base and green at the head, is in
  `test-report.md` with its commands and output.
- **G5.** The other workflows (`api`, `website`, website browser tests,
  `section-compare`, `security.yml`, `workflow-lint.yml`) are green on the final
  head. A Mark handled timeout, if one appears, is handled as Minor 1 and not as
  this defect. A rerun of PR #44's `studio` job after the merge is welcome, but it
  is not required.
- **G6.** The diff matches this plan and conditions 1 to 7. The coverage table has
  evidence in every row. `test-report.md` ends `Verdict: APPROVED` in its latest
  round. The Definition of Done boxes in `.github/pull_request_template.md` can
  each be ticked truthfully. The template is not on the base; it is on
  `origin/claude/cool-heisenberg-mh6zx9`, so gate 2 reads it from there.

Verdict: APPROVED
