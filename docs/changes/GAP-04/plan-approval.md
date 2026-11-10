# GAP-04 plan approval (gate 1)

Tech lead, 1 November 2026. Gate 1. Plan: `docs/changes/GAP-04/plan.md`, round 1.
Review: `docs/changes/GAP-04/plan-review.md`, round 1, `Verdict: APPROVED`, no
Blocker, no Major, 7 Minors. Branch `change/GAP-04` at `6470fac` (records
untracked; `git rev-parse --is-shallow-repository` = `false`).

Governing documents read from the read-only copies under
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`
(`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md`,
`docs/changes/README.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`.github/pull_request_template.md`), because they are not on the base branch.

Owner's words in force (Mohamed Elbadry, 2026-11-01, project thread): "Start waves
0 & 1 and update me with each gap done", then "continue working on wave 0 & 1".
This approval is a pipeline role; it is not the owner's confirmation and is not an
owner decision.

## Decision

Approved, with the conditions below.

## Reasons

- **Right change.** GAP-04 is a Wave 1 item (refinement plan, line 68 and line
  154). The Done-when is quoted word for word, and the plan's reading of "all 29"
  (each test runs and passes in the build it targets; a single run cannot execute
  all 29) is correct: the two spec files decide the build from `out/index.html`.
- **The gate cannot pass by skipping.** The checker holds an exact expectation per
  build, requires both reports to list the same ids and at least `minimumTests`,
  fails on unexpected and missing skips, on top-level `errors`, and on unreadable
  reports or a bad date even in report mode (P-5), and counts `flaky` as a failure
  with no retries (P-6). This closes the "exit 0 with 25 skipped" and `.only` holes.
- **Track checklist (G1, Waves 1 to 3).** One gate (B-8); a seven-day report week
  through `BROWSER_TESTS_BLOCKING_FROM`, bounded by 23 November; a committed canary
  run in a blocking step on every pull request; the three added actions pinned by
  40-character SHA (checked by the reviewer with `git ls-remote`); no SQL image;
  Node read from the shared `NODE_VERSION`, whose exact pin is GAP-09's item.
- **Execution order.** Wave 1 merges 3 to 16 November, after Wave 0 (refinement
  plan, line 128). Wave 0 is open: GAP-01 is in development, and its exit gate
  needs the owner's confirmation (line 138). Building, reviewing and testing
  GAP-04 now is within the owner's instruction for waves 0 and 1; merging it is
  not, until Wave 0 closes (condition 1). Slot 1 (G1) is the right slot. Wave 1's
  owner decisions (O-4, O-6, O-8, O-11) belong to other items (GAP-05, GAP-14 and
  others); none bears on this job.
- **Conflicts with open branches.** Checked with `git diff --stat
  6470fac...<branch>` on each:
  - PR #38 (`origin/change/ci-runner-pin`) and `change/GAP-06` change
    `.github/workflows/ci.yml` in other hunks (the `runs-on` lines and comment;
    one step in the `api` job). GAP-04 appends one job at the end. A text conflict
    is unlikely; whichever lands second rebases.
  - `change/GAP-08` adds `workflow-lint.yml` and `.github/lint/`; no shared file.
    The new job must pass its actionlint.
  - `change/GAP-01` touches `website/package*.json`, lockfiles and
    `website/src/build/strip-runtime.ts`; no shared file, but it changes the pages
    this job tests (reviewer Minor 1, condition 3).
  - `change/GAP-11` has no committed diff yet; `change/GAP-12` is API only.
  No other branch adds `website/tools/browser-suite/` or the new test file.
- **Owner decisions.** None needed. Making the check required is an owner action
  under GAP-03, correctly named and not assumed.
- **Risk.** Low and contained: a new job and new files, no change to tests,
  config, dependencies, routes or data; rollback is a revert. The real open risk is
  that tests 6 to 12 have never been seen passing end to end, which only the CI run
  can settle; the plan treats that run as the proof, which is acceptable under P-8
  because the local gap (`cdn.jsdelivr.net` 403) is stated with its reason and the
  covering job.

## Conditions the developer must meet

The developer follows the plan as written and does not edit it. Where a condition
adds to the plan, the developer records how it was met in `implementation.md`.

1. **Merge order and push.** Nothing is pushed and no pull request is opened
   without the owner's OK. GAP-04 does not merge before Wave 0's exit gate is
   confirmed by the owner. The pull request names the check "Website — browser
   tests, default and consent builds" for the owner to make required (GAP-03).
2. **Report date.** `BROWSER_TESTS_BLOCKING_FROM` is set to the planned merge date
   plus seven days, never later than `2026-11-23`. If the merge moves, the date
   moves before merge; if both bounds cannot hold, stop and go back to the owner
   (plan 3.3). Tech lead gate 2 checks it.
3. **GAP-01 interaction (reviewer Minor 1).** Do not rebase onto `change/GAP-01`.
   Record in `implementation.md`: if GAP-01 merges first, this pull request's CI
   run is the 29-of-29 proof on `next` 16.4.3; if GAP-04 merges first, GAP-01's
   pull request must show this job's check line with `0 failures`, and a failure
   there is GAP-01's defect even while this gate is in report mode.
4. **Evidence is the line, not the colour (reviewer Minor 3).** During the report
   week a green job proves nothing. The developer and the tester quote the check
   step's line `browser suite: 29 tests; … 0 failures` with the run id and job id.
   If the first CI run shows a real defect, the change stays not done and is not
   merged with failures; the defect is reported as its own item (B-8) and raised
   to the owner if it blocks Wave 1. No test is skipped, loosened or retried
   (P-6).
5. **Checker reports every problem in one pass (reviewer Minor 4).** The checker
   lists structural problems and test failures together before deciding the exit
   code, so canary 1 still prints its `failed: consent: …` line when
   `minimumTests` rises above the canaries' 29. Add a test that runs the canary-1
   inputs with an expectation of `minimumTests: 30` and asserts exit 1 and both
   the "fewer than 30" message and the `failed: consent: …` line.
6. **Canary path resolution (reviewer Minor 5).** `run-canary.mjs` resolves
   `check-report.mjs`, `expected.json` and `canary/` from its own file
   (`import.meta.url`), not the working directory, so T19 tests what it claims.
7. **T20 by parsing (reviewer Minor 6).** T20 reads `jobs.website-browser` through
   `parseWorkflowYaml` from `.github/security/workflow-yaml.mjs` (exported at line
   7 on the base), not by text search. If the parser cannot represent something
   T20 needs, say which assertion falls back to text and why.
8. **Pull request template (reviewer Minor 2).** `implementation.md` maps every
   section of `.github/pull_request_template.md` (copy in the ref folder):
   "Tests and evidence" (run id and job id of the 29-of-29 line), "Owner
   decisions" (the two quotes above), the Definition of Done boxes "PR checks are
   green on the final head" and "Independent code review" (listed open until they
   are true), and the Governance boxes: `AGENTS.md` coverage table answered "not
   applicable: `AGENTS.md` is not on the base branch", `docs/deferred-items.md`
   "none", and "Documentation updated" (the `website/README.md` paragraph).
9. **Failing test first.** `website/test/browser-suite-report.test.ts` is committed
   and shown failing before the scripts exist; the mutation check in plan 5.2 is
   run and both results recorded.
10. **Stay in scope.** Only the files in plan section 4. No change to
    `browser-tests/`, `playwright.config.ts`, `serve-built.mjs`, `package.json`,
    lockfiles, other jobs in `ci.yml`, or `.github/security/`. Never run
    `git fetch --depth`, or the design check's shallow fetch, in any worktree
    (`ENVIRONMENT.md`); use ports 42xx.

## Reviewer Minors accepted

- **Minor 7** (PR #38 wording) is accepted as is: the reviewer confirmed the plan's
  reasoning and asked for no change beyond keeping the job last in `ci.yml`, which
  the plan already does.
- Minors 1 to 6 are not left open; they are conditions 3, 8, 4, 5, 6 and 7 above.

Verdict: APPROVED
