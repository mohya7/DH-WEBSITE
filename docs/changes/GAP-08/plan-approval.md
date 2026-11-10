# GAP-08: add actionlint (plan approval, gate 1)

Role: tech-lead, gate 1. Branch `change/GAP-08`, worktree
`/home/user/wt-GAP-08`, base `6470fac`. Date 2026-11-01. Governing documents
read from the read-only copies outside the repository (`docs/changes/README.md`,
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, the refinement plan, `ENVIRONMENT.md`),
since they are not on the base. Read in full: `plan.md` (round 1) and
`plan-review.md` (round 1, `Verdict: APPROVED`, three Minors, no Blockers or
Majors).

This approval moves the plan to the developer. It is not the owner's
confirmation that `AGENTS.md` requires, and it is not an owner decision.

## Decision

Approved, with the conditions below.

## Reasons

- **Right change.** GAP-08 is a Wave 1 item (refinement plan line 72; Wave 1
  table "Add actionlint | GAP-08 | Agent | 0 findings across all workflows").
  The owner's words cover starting it: "Start waves 0 & 1 and update me with
  each gap done" and then "continue working on wave 0 & 1" (Mohamed Elbadry,
  2026-11-01, project thread). Wave 1 "waits on O-4, O-6, O-8 and O-11"; GAP-08
  depends on none of them (O-4 is the SQL Server version, O-6 compliance, O-8
  migrations, O-11 careers design).
- **Execution order.** Slot 1, G1. Wave 0 before Wave 1 holds as long as this
  pull request merges after Wave 0 (GAP-01 is still in its pipeline). Wave 1's
  merge window opens 3 November. Planning and building now is fine; when it
  merges is the integrator's call, one a day, Wave 0 first. Nothing is pushed
  or merged without the owner's OK.
- **No conflict with open branches.** I checked each one against the files this
  plan creates (`.github/workflows/workflow-lint.yml`, `.github/lint/**`,
  `docs/changes/GAP-08/**`), none of which exist on the base:
  - `origin/change/ci-runner-pin` (PR #38): changes only `.github/workflows/ci.yml`
    and its `docs/changes/ci-runner-pin/` records. No shared file. The reviewer
    linted its `ci.yml` clean (exit 0).
  - `change/GAP-12`: `ServerHeaderTests.cs` and `docs/changes/GAP-12/`. No overlap.
  - `change/GAP-01`, `change/GAP-06`, `change/GAP-11`: no commits past `6470fac`
    yet, and no uncommitted `.github` changes in their worktrees
    (`git status --porcelain` filtered on `.github`, empty in every worktree).
    GAP-01 may touch `.github/security/known-findings.json` and GAP-06 may add a
    `ci.yml` job. Neither is a file this plan touches. Whichever of them lands
    after GAP-08 is linted by this gate, which is the point of it.
  - PR #37 (pipeline docs) adds governing documents only, outside `.github/`.
  - The other remote branches are older Phase C to E work. None adds a
    `.github/lint/` folder or a `workflow-lint.yml`.
- **One gate (B-8).** One new workflow and one new script folder. `ci.yml`,
  `security.yml`, `codeql.yml`, `.github/security/` and `dependabot.yml` are
  untouched. Keeping it out of `ci.yml` (PR #38, GAP-06, GAP-09 all edit it) and
  out of `security.yml` (golden copies) is the right call.
- **Risk is low and well covered.** The tools are pinned by version and sha256,
  and the reviewer re-verified both independently. Baseline is 0 findings,
  confirmed by the reviewer. The canary catches a silently dropped shellcheck,
  a config file and `-ignore`. Report mode follows section 3 of the standard
  (this adds protection, it does not replace any). Rollback is a revert.
- **Owner decisions.** None needed. The required-status-check step is correctly
  left to GAP-03 and O-9 and stated for the owner's information.

## Conditions the developer must meet

1. **Reviewer Minor 2.** Self-test case 17 also asserts that
   `workflow-lint.yml` has no `if:` key on the job or any step, and no `paths:`
   or `paths-ignore:` key under its triggers.
2. **Reviewer Minor 3.** The canary's header comment says that `@v4` is
   deliberate (actionlint checks action inputs by tag) and that any "every
   `uses:` is a SHA" check must be scoped to `.github/workflows/`. The draft
   pull request description repeats this for GAP-09.
3. **Reviewer Minor 1, blocking date.** `ACTIONLINT_BLOCKING_FROM` is at least
   seven days after the actual merge date and no later than `2026-11-23`. If
   the merge slips past 16 November, so that both cannot hold, the developer or
   integrator stops and the change goes BLOCKED ON OWNER (a schedule exception
   under P-7). Neither bound is dropped silently. The tester checks the date
   against the planned merge date, and the integrator re-checks it before merge.
4. The self-test is committed red, before `run-actionlint.sh` exists, and the
   red run is quoted in `implementation.md`.
5. Every step of the plan's test plan (0 to 8) is quoted with command, exit
   code and output. Steps not run are marked NOT RUN with the CI job that
   covers them.
6. The final `git diff --stat origin/rebuild/dotnet-platform...HEAD` shows only
   `.github/workflows/workflow-lint.yml`, `.github/lint/**` and
   `docs/changes/GAP-08/**`. If the base moves before delivery (for example
   GAP-01 or PR #38 merges first), the developer rebases and re-runs the lint
   on the new base's workflows. Any finding that appears is reported, not
   fixed in this pull request.

## Reviewer Minors accepted

None is left as it is. All three become conditions 1 to 3 above. They need no
change to the plan's design, so the plan does not go back to the architect.

Verdict: APPROVED
