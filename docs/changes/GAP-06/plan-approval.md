# Plan approval: GAP-06 (gate 1)

Tech lead, gate 1, 1 November 2026. Reviewed `plan.md` round 2 and `plan-review.md`
rounds 1 and 2 on `change/GAP-06` (HEAD `6470fac`, equal to
`origin/rebuild/dotnet-platform` at `6470fac3668aeeacabe4a47c39807d239ac33a09`).
Governing files were read from the session's read-only reference copies:
`.claude/agents/tech-lead.md`, `docs/changes/README.md`, `ENVIRONMENT.md`,
`ENGINEERING_STANDARDS.md` (O-8 row, line 155) and
`docs/quality/refinement-plan-2026-10-28.md` (execution order, Wave 1 table).

This approval is a pipeline role. It is not the owner's confirmation of the
migration change that `AGENTS.md` requires ("Show every migration before applying
it"), and it is not an owner decision.

## Decision

Approved, with the conditions below.

## Reasons

- **Reviewer passed it.** `plan-review.md` round 2 ends `Verdict: APPROVED`. The
  round 1 Major (canary not rejected) is resolved and was re-verified by the reviewer
  on `GAP06R_Canary`: `exit=1` with `-I -b`, `exit=0` with `-I` only, both with
  `Msg 207 … Invalid column name 'new_col'`. Its five round 1 Minors are resolved.
  One new Minor (local shallow fetch) is open; I make it condition 1.
- **Right change.** It closes GAP-06 exactly as the Wave 1 table words it: wrap the
  raw SQL of `NavigationLinkRefs` and `AddRefreshTokenSessionStart` in `EXEC`, and
  add migration checks to CI. The evidence in 2.3 (6 of 15 with `-b`; 13 of 15 and
  exit 0 without `-b`; 15 of 15 twice after the fix; schema 468/468 identical; data
  identical from migration 6; the 50002 guard still rolls back) was reproduced
  independently by the reviewer. The design changes no migration id, no designer and
  no snapshot, so catalogs that already ran the two migrations cannot be reached.
- **Right point in the order.** GAP-06 is Wave 1, slot 1 (3 to 16 November). The
  owner's words authorise working on both waves now: "Start waves 0 & 1 and update
  me with each gap done", then "continue working on wave 0 & 1" (Mohamed Elbadry,
  1 November 2026, project thread). That is authority to build in parallel, not to
  reorder merges, so condition 6 queues the merge behind Wave 0.
- **One gate (B-8)**, with a seven-day report week, a committed canary that blocks
  at once and guards `-b`, the existing blocking `database update` step unchanged,
  and no new `uses:`, `image:` or version line (pinning stays with GAP-09/GAP-10 and
  PR #38). It is G1 Waves 1 to 3 compliant.
- **No conflicting branch on these files.** I checked every local change branch
  against `6470fac`: GAP-01 touches `.github/security/*` and the website lockfile
  (main worktree); GAP-08 adds `.github/lint/*` and `workflow-lint.yml`; GAP-12
  touches `Program.cs`, a new test and `docs/security-deployment.md`; GAP-11 and
  GAP-04 have no committed changes yet. None touches the two migrations or
  `api/tools/`. The only shared file is `.github/workflows/ci.yml`: PR #38
  (`origin/change/ci-runner-pin`) changes the header and the `runs-on` lines only,
  and GAP-04 will add to it later. GAP-06 only adds one step after line 90 of the
  `api` job, so any conflict is textual and local (condition 7).
- **Owner decisions.** None is needed to build or merge this. O-8 ("How Phase D
  applies migrations") stays open and is not prejudged; the standard's O-8 row says
  "the idempotent-script fix keeps the reviewed-script route open". The owner's
  confirmation of the migration edit is placed at the pipeline's stop after gate 2,
  before any push (plan 5.2 step 3). The Studio-copy test is owner-run (plan 5.5)
  and stays NOT RUN, pending owner.
- **Risk is acceptable.** The worst case of the edit is a mangled quote; 5.2, 5.3 #4
  and #5 catch it before merge, and `--word-diff` shows only the move. The worst
  case of the gate is a false pass, which the canary and the history-row counts
  guard.

## Conditions the developer must meet

1. **Never make the shared repository shallow (reviewer round 2, new Minor 1).**
   `run.sh` must not run `git fetch --depth=1` in a full clone. Pass `--depth=1`
   only when `git rev-parse --is-shallow-repository` prints `true` (CI); otherwise
   read `origin/$BASE_REF` when it exists locally, and if it does not exist, fail as
   "gate cannot run" rather than fetch. Do not run the plan's raw fetch command by
   hand. Quote `git rev-parse --is-shallow-repository` → `false` before and after
   each local run of 5.1 and 5.3 #1. If it ever prints `true`, stop and report to
   the coordinator; do not try to repair it yourself.
2. **Show before applying, in order.** Commit 1 (check, canary, `ci.yml` step, no
   migration edit) with the red-first output of 5.1 quoted, including the
   report-mode run and the `-b` self-test, comes before commit 2. Before commit 2's
   migrations touch any catalog, `implementation.md` holds the `git diff`, the
   `--word-diff` proof and the generated `EXEC(N'…')` SQL of both migrations (5.2).
3. **Throwaway catalogs only.** Locally, only `GAP06_`-prefixed catalogs on
   `dh-mssql`; `DigitalHubContent_Test` only after the coordinator confirms that no
   other agent (GAP-12's tester in particular) is using it, otherwise 5.3 #7 is
   NOT RUN locally and covered by CI job `api`. Never `DigitalHubContent` or
   `DigitalHubContent_Studio`. Quote 5.3 #10 (`0`) at the end.
4. **The schema-listing query in full** goes into `implementation.md`, so that the
   owner can paste it as `$schema` in 5.5 (reviewer round 2, Minor 4 note).
5. **The blocking date is a real date that the script validates.** The committed
   `MIGRATION_CHECKS_BLOCKING_FROM` is a literal `YYYY-MM-DD` (expected merge day
   plus 7), never the placeholder text. `run.sh` treats a missing or malformed value
   as "gate cannot run" and fails. Gate 2 checks the date; the integrator moves it in
   the same merge if the merge slips.
6. **Merge order.** Nothing is pushed or merged without the owner's OK. When the
   owner allows it, GAP-06 queues in slot 1 behind Wave 0 (GAP-01 to GAP-03) unless
   the owner says otherwise in words that can be quoted.
7. **`ci.yml` rebase.** Whichever of PR #38, GAP-04, GAP-09 and GAP-06 merges
   second rebases. After a rebase, re-check that the step still sits directly after
   "Apply migrations to the fresh database", uses the job's `working-directory: api`,
   and that the `api` job's checkout still lets `git fetch` reach `origin` (if a
   later change sets `persist-credentials: false` there, the fetch fails and the gate
   cannot run; that must be solved, not skipped). If GAP-08's actionlint is on the
   base by then, the new step and `run.sh` must pass it with 0 findings.
8. **Secrets.** No `set -x`; `SA_PASSWORD` is never echoed, including in failure
   messages and the step summary.

## Reviewer Minors accepted

- Round 1 Minors 2 to 6: resolved in round 2, accepted as resolved.
- Round 2 new Minor 1 (local shallow fetch): not left open; it is condition 1.
- Round 2 note on 5.5's `$schema` placeholder: accepted, with condition 4.
- Accepted as a known limit (plan 3.3, section 10): migrations 4, 8 and 15 stay
  unwrapped; a future migration that breaks one of them is caught by step 3's
  second run.

## Open for the owner (not blocking this gate)

- Confirmation of the two migration edits (plan section 7 and the generated SQL from
  `implementation.md`), at the stop after gate 2, before push.
- The `DigitalHubContent_Studio` copy test (plan 5.5): NOT RUN, pending owner.
- O-8 remains open and is not answered by this change.

Verdict: APPROVED
