# GAP-09-status: delivery approval (gate 2)

Head `db95a4f` on `change/GAP-09-status`. The current base is `origin/rebuild/dotnet-platform` at `8027e87`.

## Decision

Approved. The diff matches the plan and the gate-1 conditions. I re-ran the checks myself and their results match the tester's.

## What I verified myself

- `git fetch origin`: the base moved from `8d8e01d` to `8027e87` (ADM-12c, #73). That merge does not touch `ENGINEERING_STANDARDS.md`. Its changes are under `api/`, `studio/` and `docs/changes/ADM-12c/`.
- Gate-1 condition 4: `git merge-base --is-ancestor origin/change/adr-0001-accept origin/rebuild/dotnet-platform` printed "not merged". `change/adr-0001-accept` has not merged, so this change does not need to rebase for it. `git merge-tree --write-tree origin/rebuild/dotnet-platform HEAD` merges cleanly.
- `git diff --stat origin/rebuild/dotnet-platform...HEAD` lists only `ENGINEERING_STANDARDS.md | 4 +-` and the files in `docs/changes/GAP-09-status/`. That is within the plan's scope.
- The diff of `ENGINEERING_STANDARDS.md` changes two lines:
  - Line 56 (G-3) drops only "; image tag floats".
  - Line 68 (G-15) uses the plan's text and stays Partial.
- Facts re-checked:
  - 0 `uses:` lines are not pinned to a 40-character SHA.
  - 7 `runs-on: ubuntu-latest` lines remain, matching the residual the G-15 cell states.
  - Check 4 (`awk`) gives `56 7` and `68 7`, so the table has the same column count.
- Failing test first: N/A. This is a documentation-only change with no security fix, as plan section 5 states.
- Test report Round 1 is `Verdict: APPROVED`. It shows commands and output for checks 1 to 4, and every row of the coverage table has evidence.
- B-4: the subjects take the form `GAP-09-status: <imperative>`, and all three commits carry the `Co-Authored-By` trailer.

## Open items

- `test-report.md` and this file are uncommitted. They must be committed before the push.
- CI, Security and Workflow lint have not run on the final head because no pull request is open yet. Their run IDs must be quoted once they do.
- The owner must confirm the push and do the squash merge.
- If `change/adr-0001-accept` merges before this change, rebase and re-run check 4. Its edit is on line 159 and does not overlap.

## Draft pull request description

## What and why

GAP-09 (#68) pinned every action by SHA, the SQL Server image by digest, and Node and .NET exactly. Two status texts in `ENGINEERING_STANDARDS.md` were therefore false:
- G-15 still said "actions on major tags, `mssql/server:2022-latest`".
- G-3 still said "image tag floats".

This change corrects both rows. G-15 stays Partial.

## Scope and boundaries

In scope: lines 56 (G-3) and 68 (G-15) of `ENGINEERING_STANDARDS.md`, and the change records in `docs/changes/GAP-09-status/`. Out of scope: the workflows themselves, the G-15 residuals (`ubuntu-latest` runners, Python `3.12`, no check that enforces pinning) and every other gate row.

## Security impact

None. This is a text-only change. No routes, data, secrets or dependencies are affected.

## Tests and evidence

- `git diff -U0 origin/rebuild/dotnet-platform...HEAD -- ENGINEERING_STANDARDS.md`: two hunks, `@@ -56 +56 @@` and `@@ -68 +68 @@`.
- `grep -nE "uses:" .github/workflows/*.yml | grep -vcE "@[0-9a-f]{40}( |$)"` prints `0`.
- `grep -n "@sha256:" .github/workflows/ci.yml` matches lines 49 and 202.
- `grep -n runs-on .github/workflows/*.yml | grep latest` returns 7 lines, in `codeql.yml` and `security.yml`.
- `awk -F'|' 'NR==56||NR==68{print NR, NF}' ENGINEERING_STANDARDS.md` prints `56 7` and `68 7`.
- NOT RUN: the .NET, Vitest and Playwright suites, builds and audits, because no code changed. `ci.yml` and `security.yml` cover them on this pull request (run IDs: TBD).

## Owner decisions

O-1, asked in the GAP-09-status plan (`docs/changes/GAP-09-status/plan.md`): "Fix G-3 too (Recommended)".

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards (N/A: documentation only)
- [x] No new prohibited constructs in touched code (N/A)
- [x] Every new or changed route has a guard (N/A: no routes)
- [x] Tests exist for the behaviour changed (N/A: documentation only; checks above)
- [ ] PR checks are green on the final head (run IDs quoted): open
- [x] Independent code review was run: plan-reviewer, tester and tech-lead gates 1 and 2
- [x] The approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood: revert this pull request
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint run again after the merge.

## Review findings accepted

None.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (N/A: the register has no status column)
- [x] `docs/deferred-items.md` updated for any exception (N/A: no exception)
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Verdict: APPROVED
