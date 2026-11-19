# GAP-09-status: implementation

Base `8d8e01d`. Plan `e1815fe`, approved in `plan-approval.md` (Verdict: APPROVED).

## What changed

| File | Change | Plan scope |
| --- | --- | --- |
| `ENGINEERING_STANDARDS.md:56` | G-3 Status: removed "; image tag floats" only | Section 4, O-1 |
| `ENGINEERING_STANDARDS.md:68` | G-15 "Enforced by" and "Status" cells rewritten with the text in plan section 3 | Section 4 |
| `docs/changes/GAP-09-status/implementation.md` | This record | Section 4 |

## Commits

- Red test: none. Documentation only; the plan names no failing test (section 5).
- `5ac6bfd` GAP-09-status: Record G-15 and G-3 status after GAP-09
- This record is committed on its own after `5ac6bfd`.

## Checks (plan section 5), run in the worktree

1. `git diff --stat 8d8e01d...HEAD` (exit 0), after `5ac6bfd`:
   `ENGINEERING_STANDARDS.md | 4 +-` and `docs/changes/GAP-09-status/` plan,
   plan-review, plan-approval only. This record adds one more file in the same folder.
2. `git diff -U0 ENGINEERING_STANDARDS.md` (before commit): two hunks, `@@ -56 +56 @@`
   (`| G-3 |`, only "; image tag floats" removed) and `@@ -68 +68 @@` (`| G-15 |`).
3. Facts re-verified:
   - unpinned `uses:` count: `0` (grep -c prints 0, exit 1 because no line matched).
   - `@sha256:` in `ci.yml`: lines 49 and 202, `2022-CU28-ubuntu-22.04@sha256:4525e3ef...`.
   - `NODE_VERSION: "22.23.4"` at `ci.yml:33`, `security.yml:64`; `dotnet-version: "10.0.404"`
     at `ci.yml:77`, `:252`, `codeql.yml:54`, `security.yml:117`.
   - `runs-on: ubuntu-latest`: `codeql.yml:36`; `security.yml:72`, `:86`, `:108`, `:128`, `:143`, `:166`.
   - `python-version: "3.12"` at `security.yml:172`.
4. `awk -F'|' 'NR==56||NR==68{print NR, NF}' ENGINEERING_STANDARDS.md` -> `56 7`, `68 7`.

Track checklist: no gate added; canary N/A; pinning unchanged (check 3); no baseline touched.
NOT RUN: .NET, Vitest, Playwright, builds. No code path changes; CI, Security and
Workflow lint run on the PR.

Condition 4 (rebase if `change/adr-0001-accept` merges first): it has not merged
into the base used here; applies before the push.

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| G-15 status cell reflects GAP-09 | GAP-09 delivery-approval.md:82 | Done | `5ac6bfd`, line 68; check 3 |
| Residuals (`ubuntu-latest`, Python 3.12, no enforcing check) stated | GAP-09 plan.md:186-208; owner request | Done | line 68 Status cell; check 3 runs-on and python lines |
| G-3 status drops "image tag floats" only | O-1 | Done | check 2 hunk `@@ -56 +56 @@` |
| No standard row other than G-3 and G-15 changed | owner request | Done | check 2 (two hunks only), check 4 |
| Register status update, if required | owner request | Not required | register has no status column (plan section 2) |

Status: READY FOR TEST
