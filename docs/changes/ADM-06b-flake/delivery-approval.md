# ADM-06b-flake: delivery approval (gate 2)

Technical lead, gate 2, 11 November 2026. Branch `change/ADM-06b-flake`, PR #53
(draft, base `rebuild/dotnet-platform`). Code head and pushed head `4f8be59`.
The local head `576b73b` adds the test report, docs only, not yet pushed. Base
`77296ba`: `origin/rebuild/dotnet-platform` is still
`77296ba83599c45ee35eebd9747011bbd38f1d52`, and
`git merge-base --is-ancestor 77296ba HEAD` exits 0.

Inputs: `plan.md` (`f003e7c`), `plan-review.md` round 1 `APPROVED`,
`plan-approval.md` (`fe052f8`, `APPROVED`, conditions 1 to 7, gate 2
requirements G1 to G6), `implementation.md` (`4f8be59`), and `test-report.md`
round 1 `Verdict: APPROVED` with no findings (`576b73b`).

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires and it is not an owner decision (P-7). After this gate the
change stops for the owner.

## Decision

Approved for the owner's review, with the integrator conditions below. The diff
is the approved plan to the line. The red commit comes before the fix. I
reproduced the red and the green myself. I read the CI evidence on the code head
myself, and it shows the positive signal gate 1 asked for.

## What I verified myself

All scratch work is in
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/tl2/`
(copies from `git archive`, `node_modules` linked). The worktree was not edited:
`git status --short` is empty before this file.

1. **Scope and diff (G6, conditions 1 and 5).** These are the only files that
   `git diff --name-only origin/rebuild/dotnet-platform...HEAD` lists:

   ```
   docs/changes/ADM-06b-flake/implementation.md
   docs/changes/ADM-06b-flake/plan-approval.md
   docs/changes/ADM-06b-flake/plan-review.md
   docs/changes/ADM-06b-flake/plan.md
   docs/changes/ADM-06b-flake/test-report.md
   studio/test/listPaging.test.tsx
   ```

   The `studio/` diff adds 17 lines and removes none (`grep '^-' | grep -v '^---'`
   gives 0). The added lines are:
   - the plan's comment and `vi.hoisted` spy;
   - `vi.mock("antd", …)` replacing only `message.success`;
   - `toast.success.mockClear()` in `beforeEach`;
   - the guard `expect(document.body.innerHTML).toBe("")` after `cleanup()`;
   - `expect(toast.success).toHaveBeenCalledWith("Marked handled.")` in both
     Mark handled tests.

   This matches plan 3.1. Nothing in P-6's forbidden list is used.
   `git diff --exit-code origin/rebuild/dotnet-platform...HEAD -- studio/package.json studio/package-lock.json`
   exits 0 (B-7).
2. **Red before green (G3, P-4).** Oldest first, `git log origin/rebuild/dotnet-platform..HEAD`
   gives:
   - `f003e7c` plan;
   - `79edc2f` review;
   - `fe052f8` gate 1;
   - **`238cb83` red (+2 lines, the guard)**;
   - **`5f351d8` green (+15 lines)**;
   - `4f8be59` implementation record;
   - `576b73b` test report.

   The red was pushed together with the fix, as gate 1 decided. B-6 strictly
   covers security fixes; this is not one, and the order is still kept.
3. **Red reproduced.** `git archive 238cb83`, then
   `npx vitest run test/listPaging.test.tsx`: exit 1,
   `Tests  18 failed | 3 passed (21)`. The first failure is
   `contact inbox paging > marking an enquiry handled reloads the same page`, and
   every `AssertionError` in the log is
   `expected '<div class="ant-message ant-message-l…' to be ''`.
4. **Green reproduced.** I made a `git archive 4f8be59` copy and ran
   `npx vitest run test/listPaging.test.tsx --silent=false`. It gave exit 0 and
   `Tests  21 passed (21)`, with no `Errors` or `Unhandled` line. `antd: message`
   matched 0 times.

   I also ran `npm test` in the worktree, where `git diff --quiet 4f8be59 HEAD -- studio`
   exits 0. It gave exit 0, `Test Files  10 passed (10)`, `Tests  60 passed (60)`,
   and no `Errors` line.

   *Reported as it happened:* my first `npm test`, in the archive copy, exited 1
   with `Test Files 1 failed | 9 passed (10)`. The failing file was
   `test/previewDesign.test.ts`:
   `Cannot find module '../../website/src/design/folder'`. The copy has no
   `website/` folder, so this came from how I set up the copy, not from the
   change. The rerun in the worktree above is the valid result.
5. **CI on the code head (G1, G2, G5).** I checked each id with `gh api` and
   `gh run view`:
   - Run `43006211708` ("CI", `pull_request`, head `4f8be59b2d08…`): `completed`,
     `success`. Its jobs:
     - `130474216590` API: success;
     - `130474217053` Studio: success;
     - `130474217085` and `130474217012` Website: success;
     - `130474678933` Section comparison: success;
     - `130474680946` Screenshot parity: skipped (optional, needs a label).
   - Studio job `130474217053` log, colour codes removed:
     `✓ test/listPaging.test.tsx (21 tests) 8367ms`, `Test Files  10 passed (10)`,
     `Tests  60 passed (60)`, and e2e `28 passed (3.1m)`.
   - `grep -c` on that log: `Unhandled Errors` 0, `antd: message` 0,
     `window is not defined` 0, `Errors  ` 0. On the failing base job
     `130455431268`, the same greps give `Unhandled Errors` 1 and
     `antd: message` 1.
   - Security run `43006211621` (head `4f8be59`): success. All 7 jobs succeeded:
     - gate self-test;
     - npm audit (website and studio);
     - gitleaks (PR commits and full history);
     - NuGet audit;
     - Semgrep.
   - Check runs on `4f8be59` also show `actionlint (every workflow)` success.
     CodeQL is skipped (private repository).
6. **The tester's evidence is real (G4).** `test-report.md` quotes commands,
   exit codes and output:
   - the red at `238cb83`;
   - the probe, written independently and run 3 of 3 red on `77296ba` with the
     CI stack and 3 of 3 green at `4f8be59` with an empty body;
   - three non-vacuity variants of the spy assertions;
   - scope, security and CI ids.

   Every CI id I checked matches its conclusion. I did not rerun the probe. The
   architect, the reviewer and the tester each ran it independently with the same
   result, and gate 1 assigned it to the tester.
7. **Coverage table.** All 11 rows of plan section 11 have evidence in
   `implementation.md` section 7 and in the tester's table. The one row that was
   NOT RUN for the developer ("CI `studio` green on the pull request") is verified
   by the tester and by me (item 5).
8. **Commit messages (B-4).** All seven commits have the `ADM-06b-flake:` prefix,
   an imperative subject, a body that says why, and the
   `Co-Authored-By: Claude Opus 5.5` and `Claude-Session` trailers.
9. **Gate 1 conditions.**
   - 1 (exact plan, two commits): met.
   - 2 (Minor 1 recorded): met, in `implementation.md` 5.1.
   - 3 (Minors 2 and 3 corrected): met, in 5.2.
   - 4 (every command quoted): met.
   - 5 (lockfile and scope): met.
   - 6 (pushed together, red first, B-4): met.
   - 7: did not arise.

## Does the records commit need its own green CI run?

**Yes, but as a merge requirement, not as evidence of the fix.** The proof of the
fix is the deterministic red and green and the probe, together with the CI log
of `4f8be59`. No later commit changes `studio/`.

The final head is still a new commit. The workflows have no `paths` filter
(`ci.yml`, `security.yml` and `workflow-lint.yml` run on every `pull_request`
push), and gitleaks and Semgrep do scan documentation. The Definition of Done
box "PR checks are green on the final head" can only be ticked once the run on
that head exists.

So the integrator pushes `576b73b` plus the commit that carries this file,
waits for CI, Security and Workflow lint to go green on that head, and quotes
those run ids in the body. This is what ADM-06b did with `9a08268`. A
`listPaging` failure on that head would be a new fact, and the change would go
back to the developer.

## Open items

1. CI, Security and Workflow lint on the final head: not run yet, because the
   head is not pushed.
2. PR #53 is a draft and its body still needs to be replaced with the draft
   below.
3. The owner's confirmation: not asked yet. No owner words exist for this change.
4. The Definition of Done box "Reviewed by someone other than the author". All
   five pipeline roles were run as Claude Code subagents. `AGENTS.md` rotation
   expects Cursor to check Claude Code's work. I do not tick this box on the
   pipeline roles alone. It stays open until the owner reviews it or accepts the
   pipeline roles as the independent review.
5. Merge into `rebuild/dotnet-platform` and the rerun of the suites after it.
6. Optional, after the merge: rerun PR #44's `studio` job. A pass there is
   welcome, not required (plan 5.4).

## Conditions on the integrator, before the owner is asked

1. Commit this file with exact-path staging (B-5) and a B-4 subject, for example
   `ADM-06b-flake: Gate 2 (APPROVED)`. Push it with `576b73b` to
   `change/ADM-06b-flake`. Do not rewrite or squash the branch history: the red
   commit must stay before the green one.
2. Wait for these runs on the new head to finish. Quote each run id and
   conclusion in the PR body, in place of the `<…>` placeholders:
   - CI, every job: success, apart from the optional screenshot job, which may be
     skipped;
   - Security, all 7 jobs: success;
   - Workflow lint: success.

   If any of them fails, stop and report it; do not rerun it until it passes. A
   `Test timed out in 5000ms` in a Mark handled test is review Minor 1, not this
   defect, and it is still reported.
3. Check that `origin/rebuild/dotnet-platform` is still `77296ba`. If it has moved
   (for example, #44 or #52 merged first), merge or rebase as the integrator
   normally does, then repeat condition 2 on the resulting head.
4. Replace PR #53's body with the draft below, filled in. Keep its first two lines
   and its last three lines exactly as they are. Then mark it ready for review.
5. Then ask the owner. Give them the PR link, the verdict, and open item 4 (the
   independent review box) as an explicit question. Do not merge before the
   owner confirms.
6. After the owner confirms, merge on its own, without batching it with #44 or
   #52, and rerun the suites on `rebuild/dotnet-platform`. Do not delay #44
   (Wave 0) for this change.

## Draft pull request description

````markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6BRXnUC2ABYkLqs4L3ZEMuU)_

Base `77296ba` (ADM-06b, #51); test-only follow-up to it.

## What and why

A Studio unit-test run on PR #44 failed with every test passing. CI job
`130455431268` (run `43000550486`), step "Unit tests": `Tests 60 passed (60)`,
`Errors 1 error`, `ReferenceError: window is not defined` at React's
`performWorkOnRootViaSchedulerTask`. Vitest attributed the error to
`test/listPaging.test.tsx`, which ADM-06b added.

Cause: the inbox's Mark handled calls antd's static
`message.success("Marked handled.")` (`ContactInboxPage.tsx:100`). That toast
renders into a React root that antd creates itself, outside the one `render()`
makes. So `cleanup()` never unmounts it, and it redraws on every animation frame
for 3 seconds. A redraw that runs after vitest's jsdom teardown has deleted
`window` throws. The race is rare, so most runs pass.

This change, in `studio/test/listPaging.test.tsx` only:
- fails any test that leaves anything in `document.body` after `cleanup()` (a
  guard that is red on the base and catches this leak every time);
- replaces only antd's `message.success` with a spy in this file, so no toast
  root is created; Pagination, Table, Drawer and Modal stay real;
- asserts in both Mark handled tests that the screen asks for the
  "Marked handled." toast, which they did not check before.

Plan, review, gate approvals, implementation record and test report:
`docs/changes/ADM-06b-flake/`.

## Scope and boundaries

In scope: `studio/test/listPaging.test.tsx` (+17, -0) and
`docs/changes/ADM-06b-flake/`.

Out of scope: all of `studio/src/` (no product change); the static `message` in
the other six files that use it, and a move to `App.useApp()` (observation, not
an item); `studio/vitest.config.ts`, `test/support/pagedApi.ts`, the other test
files, package files and workflows; the Mark handled tests' 5 s timeout margin
under load (review Minor 1, recorded, separate topic).

## Security impact

None. Only a unit test file changes. No route, policy, data, login, secret,
configuration, workflow or dependency is touched. `package.json` and
`package-lock.json` are unchanged. `npm audit` (studio): 0.

## Tests and evidence

- Red first, committed before the fix and pushed together with it (gate 1: the
  red is deterministic locally, so it was not pushed alone):
  - `238cb83` (the guard only):
    `npx vitest run test/listPaging.test.tsx` exit 1,
    `Tests 18 failed | 3 passed (21)`. Every failure is
    `expected '<div class="ant-message ant-message-l…' to be ''`. The first is
    the first Mark handled test, and the three tests before it pass.
  - The CI symptom reproduced: a probe that deletes `window` inside an animation
    frame, appended in a scratch copy, never committed. It gives 3 of 3 exit 1 on
    `77296ba` with the CI stack frame for frame, and 3 of 3 exit 0 with an empty
    body after the fix. The architect, the reviewer and the tester each ran it
    independently.
- Green at `5f351d8` (this head's code): `Tests 21 passed (21)`. `npm test`:
  `Test Files 10 passed (10)`, `Tests 60 passed (60)`, no `Errors` line.
  `npx tsc -b` 0, `npm run build` 0, lockfile unchanged after `npm ci`. Run with
  `--silent=false`, `antd: message` gives 0 matches (1 on the base).
- The spy assertions are not vacuous. In scratch copies:
  - removing the call: 2 failed;
  - removing the mock: 18 failed;
  - changing the text: 2 failed.
- CI on `4f8be59` (the code head plus the implementation record):
  - Run `43006211708` `success`. Studio job `130474217053`:
    `✓ test/listPaging.test.tsx (21 tests) 8367ms`, `Tests 60 passed (60)`, e2e
    `28 passed (3.1m)`, 0 `Unhandled Errors`, 0 `antd: message`. The failing base
    job `130455431268` has 1 of each.
  - API `130474216590`, the website jobs, and section comparison: `success`.
    Screenshot parity `skipped` (optional label).
  - Security run `43006211621` `success`, 7 of 7 jobs. actionlint `success`.
    CodeQL `skipped` (private repository).
- Final head `<final head>` (records only on top of `4f8be59`): CI run `<run>`,
  Security run `<run>`, Workflow lint run `<run>`, each with its conclusion.
- 40 local runs before and after: 40 of 40 green both times. This is a stability
  check only; the race was never hit locally, so it is not evidence of the fix.
- End-to-end locally: NOT RUN (no SQL Server in the container). It is covered by
  the Studio CI job above. .NET: NOT RUN (nothing under `api/` changed); covered
  by the API CI job.

## Owner decisions

None needed: no behaviour change, no exception. The owner has not yet been asked
about this change, and no owner words are quoted for it. The ADM-06b answer
"Yes, red test first like #49" was given for ADM-06b, and it is not applied here
as a decision.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (cause named with evidence; smallest fix, test-only; deterministic red before green)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no route changed)
- [x] Tests exist for the behaviour changed (a regression guard plus two spy assertions; changed-line coverage: no gate yet, G-8; not measured; not a security fix)
- [ ] PR checks are green on the final head `<final head>` (runs `<run>`, `<run>`, `<run>`)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author (pipeline roles, all Claude Code subagents; owner review pending)
- [x] Rollback is understood: revert this PR; no schema or data change; a revert brings the rare flake back
- [ ] Deployment note: the integrator merges into rebuild/dotnet-platform and re-runs the suites after the merge

## Review findings accepted

- Review Minor 1: under heavy parallel load both Mark handled tests can exceed
  vitest's 5 s timeout, on the base and with the fix alike. Not this defect, and
  not fixed here (changing timeouts is its own topic, B-8).
- Review Minor 5: `listPaging.test.tsx` is not in a tsconfig `include`, so it is
  not type-checked. This was already true; out of scope.
- Review Minors 2 and 3 (wording and figures in the plan) are corrected in
  `implementation.md` 5.2; the approved plan is unchanged.

## Governance

- [x] Coverage tables updated (`docs/changes/ADM-06b-flake/`)
- [x] `docs/deferred-items.md`: no exception
- [x] Documentation updated (`docs/changes/ADM-06b-flake/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
````

Verdict: APPROVED
