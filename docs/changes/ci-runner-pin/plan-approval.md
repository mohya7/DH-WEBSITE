# Plan approval: ci-runner-pin (gate 1)

Technical lead, 1 November 2026. Gate 1, the plan. Reviewed `plan.md` (architect,
round 2) and `plan-review.md` (rounds 1 and 2, latest `Verdict: APPROVED`) on
`change/ci-runner-pin` at `6470fac`.

Read first: `docs/changes/README.md` and `.claude/agents/tech-lead.md` (PR #37
branch, `675268a`), `AGENTS.md`, `ENGINEERING_STANDARDS.md` (from
`origin/claude/cool-heisenberg-mh6zx9`), and
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`.

This approval moves the change to the developer. It is not the owner's
confirmation that `AGENTS.md` requires, and it is not an owner decision.

## Decision

Approved. It is the right change, at the right size, at the right point in the
order. The reviewer's two findings are resolved, and no branch conflicts with it.

## Reasons

**The right change.** I checked the cause myself rather than relying on the plan:

- `gh api repos/mohya7/DH-WEBSITE/actions/jobs/124875085547/logs` (Studio, PR #37):
  `Image: ubuntu-26.04`, then `Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64`.
- `gh api repos/mohya7/DH-WEBSITE/actions/jobs/118617022817/logs` (Studio, base
  `6470fac`, 20 October): `Image: ubuntu-24.04` and `26 passed (2.6m)`.
- The same code was green on 24.04 and fails on 26.04 at the browser install. The
  image is the only thing that changed. Pinning the image is the smallest fix
  that restores a supported platform without weakening anything (P-6). Upgrading
  Playwright is the long-term fix, but it means new lockfiles (B-7) and a reviewed
  screenshot re-baseline, so the plan is right to make it a follow-up.
- Scope matches the owner's words. The owner approved "pin ci.yml to
  ubuntu-24.04" with "ok solve the issue" (Mohamed Elbadry, 1 November 2026,
  project thread). Pinning all five `ci.yml` jobs is within "pin ci.yml". Leaving
  `security.yml` and `codeql.yml` alone keeps their golden copies out of this
  pull request (B-8).

**The plan's state, checked here.**

- `grep -n "runs-on" .github/workflows/ci.yml`: lines 39, 120, 175, 269 and 334, all
  `runs-on: ubuntu-latest`. `jobs:` is at line 36. This matches Section 2.
- `/opt/node22/bin/node --test .github/security/gate.test.mjs`, exit 0:
  `# tests 62`, `# pass 62`, `# fail 0`. This matches the baseline.

**Order.** The refinement plan runs two merge slots a day, with Wave 0 (28
October to 3 November) first. This change is not a refinement item, and it adds
no gate. But while it is unmerged, every pull request in both slots, including
the Wave 0 dependency upgrades due by 3 November, shows a red Studio and section
comparison for a reason that has nothing to do with them. That hides real
failures and stalls the Wave 0 deadline. It should take the next slot 1 merge,
ahead of other G1 work. It does not jump ahead of anything it depends on, and
nothing depends on it except a green CI.

**Conflicts with open branches.** `git branch -r` had only four refs locally, so
I listed the remote with `git ls-remote --heads origin` and fetched every head
(`FETCH_HEAD` only, no local branches). I diffed `.github/workflows/ci.yml` from
each branch's merge base with `6470fac`:

| Branch | ci.yml changed vs its merge base | `runs-on` lines touched | State |
| --- | --- | --- | --- |
| `ci/github-actions` | 338 lines (creates the file) | 4 | Merged as PR #13, 11 October |
| `phase-d/ci-security` | none | 0 | Merged as PR #24, 14 October |
| `phase-c/screenshot-parity` | +65 / −20 | 1 | Merged as PR #21, 19 October |
| `phase-c/api-security-fixes` | +3 / −1 | 0 | Merged as PR #31 |
| `phase-c/section-5`, `section-6`, `section-9`, `standalone` | 2 to 8 lines | 0 | Old Phase C branches from 12 to 18 October, behind the base |
| `claude/project-thread-fmllvw` (PR #37) | none | 0 | Open |
| `claude/cool-heisenberg-mh6zx9` | none (adds `.github/pull_request_template.md` only) | 0 | Unmerged plan branch |
| Every other head | none | 0 | |

`gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open'` lists one open pull request,
#37, and it does not touch `ci.yml`. The branches that touched `ci.yml` were
squash-merged, so they do not appear as ancestors, but they are not open. Nothing
conflicts with this change.

**Risk.** It is low, and the plan names it correctly. The rollback is a revert.
The one real residual risk is that `ubuntu-24.04` rolls weekly and will be retired
some day. That is caught by the PR's own CI run and by the Playwright-upgrade
follow-up. I accept it.

**Owner decisions.** None outstanding. The one this change needs is quoted with
date and place, and no exception is taken, so no D-NNN entry is needed.

## Reviewer Minors accepted

None left open. Finding 2 (the provisioner version and Section 6's wording) was
resolved in round 2, and I checked that `Image: ubuntu-24.04` comes from the
`Runner Image` group of job 118617022817.

## Conditions for the developer

1. **Only the planned lines change.** Five `runs-on` values in
   `.github/workflows/ci.yml`, and one 3 to 5 line comment above `jobs:`. Do not
   change `security.yml`, `codeql.yml`, the golden copies, actions, the SQL Server
   image, Node or .NET versions, or any `continue-on-error`. T4 and T5 must show
   this.
2. **Failing check first.** Record T1 (`5`) and T2 (`0`, exit 1) before the edit,
   with the commands and outputs, in `implementation.md`, then the same commands
   after the edit.
3. **The comment.** It must not contain `node -e`, `python -c`, `python3 -c` or
   `--input-type`. Re-run `gate.test.mjs` afterwards (62 of 62 expected) and the
   local YAML parse, and quote both.
4. **Commit (B-4).** An imperative subject, for example
   `CI: pin every ci.yml job to ubuntu-24.04`, a body that says why (Playwright
   1.56.1 cannot install Chromium on Ubuntu 26.04, citing job 124875085547), and the
   attribution trailer. The pipeline records go in their own commit or in the same
   one, but not mixed with any other topic.
5. **Do not push or open the pull request.** The orchestrator does that.

## Notes for the tester and gate 2

- C3: the pass bar is `26 passed`, 0 failed, 0 flaky, quoted next to job
  118617022817's line. The `22 of 22` in `CLAUDE.md` is not the bar.
- C5, screenshot parity: not required for gate 2. The job is optional and
  label-triggered, and the pin applies to it in the same way. NOT RUN with that
  reason is acceptable. Adding the `screenshots` label is the owner's choice.
- C6: the Security workflow's "npm audit (website)" failure is already there on
  PR #37 (run 41315679989), and it belongs to GAP-01. It does not block this
  change if the advisory is the same one. A new failure, or any failure in the
  gate self-test, does block it.
- After this merges, PR #37 needs a fresh CI run on top of it. Its red Studio and
  section comparison jobs are this issue, not that pull request.

Verdict: APPROVED
