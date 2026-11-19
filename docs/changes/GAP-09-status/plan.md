# GAP-09-status: record G-15 after GAP-09

## 1. Item

- Closes the Governance item in `docs/changes/GAP-09/delivery-approval.md:82-83`:
  "the G-15 status cell in `ENGINEERING_STANDARDS.md:68` changes after the merge,
  not in this change, as the plan says."
- Register item GAP-09 (G-15), G1 Wave 1. Done when
  (`docs/quality/refinement-plan-2026-10-28.md:73`): "Actions by commit SHA, the
  image by digest, Node and .NET exact"; step table (`:159`): "Every `uses:` names
  a 40-character SHA; the image reference carries `@sha256:`; `node-version` and
  `dotnet-version` are exact".
- Track: G1, Wave 1 (documentation follow-up; no gate is added).

## 2. Current state

Base `8d8e01d` (GAP-09, PR #68, merged).

- `ENGINEERING_STANDARDS.md:68`:
  `| G-15 | Tools and actions pinned exactly | — | gitleaks, Semgrep exact | Partial: actions on major tags, `mssql/server:2022-latest` (step 3) |`
  The status text is now false: both named defects are fixed.
- Unpinned `uses:` across `.github/workflows/*.yml` and `.github/security/*.yml`
  (the P-1 check from `docs/changes/GAP-09/implementation.md:11`): count `0`.
- Image: `ci.yml:49` and `:202`
  `mcr.microsoft.com/mssql/server:2022-CU28-ubuntu-22.04@sha256:4525e3ef…7b7f`.
- .NET: `dotnet-version: "10.0.404"` at `ci.yml:77`, `:252`, `codeql.yml:54`,
  `security.yml:117`. Node via `env.NODE_VERSION` (22.23.4 per GAP-09 records).
- CI proof on PR #68 (`docs/changes/GAP-09/ci-evidence.md`): CI 44505740223,
  CodeQL 44505740178, Security 44505740140, Workflow lint 44505740158, all pass;
  digest, SDK 10.0.404 and Node v22.23.4 seen in the logs.
- Residuals GAP-09 deliberately left (`docs/changes/GAP-09/plan.md:186-208`):
  `runs-on: ubuntu-latest` at `codeql.yml:36`, `security.yml:72`, `:86`, `:108`,
  `:128`, `:143`, `:166`; `python-version: "3.12"` at `security.yml:172`.
  `ci.yml` already uses `ubuntu-24.04`.
- Enforcement: no CI gate checks pinning; P-1 to P-5 were run by hand in GAP-09.
  The "Enforced by" cell therefore cannot claim a check.
- Register (`refinement-plan…:57-`) has no status column; progress is measured from
  the standard's Status column (`:232`, `:236`). No register edit is needed.
- G-3 (`ENGINEERING_STANDARDS.md:56`) says "image tag floats", which GAP-09 also
  fixed. O-1 (answered): drop that phrase.

## 3. Design

Rewrite the G-15 row's "Enforced by" and "Status" cells:

| G-15 | Tools and actions pinned exactly | — | gitleaks, Semgrep exact; every action by commit SHA, the SQL Server image by digest, Node 22.23.4 and .NET SDK 10.0.404 (GAP-09, #68) | Partial: `runs-on: ubuntu-latest` in `security.yml` and `codeql.yml`, `python-version: "3.12"` in `security.yml`; no CI check enforces pinning |

And, per O-1, the G-3 row's Status cell only:

| G-3 | … | Partial: production version not recorded |

("image tag floats" removed; the rest of the row unchanged; the production
version stays with GAP-10.)

Rejected: "Met" — residuals remain and nothing stops a new floating reference
(would overstate, P-8). Rejected: also pinning `runs-on`/Python here — that is
workflow code, not this documentation change (B-8).

## 4. Scope

- `ENGINEERING_STANDARDS.md`: G-15 row (line 68), and the G-3 row's Status cell (line 56), per O-1.
- `docs/changes/GAP-09-status/*`: pipeline records.

Out of scope: G-10, G-11, G-13 and all other rows; the rest of G-3 (production version, GAP-10); the register and step tables in
`docs/quality/refinement-plan-2026-10-28.md` (no status column to update); the
metric "Standard rules met" (G-15 stays Partial, count unchanged); any workflow.

## 5. Test plan

Documentation only; no failing test applies. Checks, run in the worktree:

1. `git diff --stat rebuild/dotnet-platform...HEAD` (or working tree) shows only
   `ENGINEERING_STANDARDS.md` and `docs/changes/GAP-09-status/`.
2. `git diff -U0 ENGINEERING_STANDARDS.md` shows exactly two changed lines, one starting
   `| G-3 |` (only "; image tag floats" removed) and one starting `| G-15 |`.
3. Every fact in the new cell re-verified:
   `grep -nE "uses:" .github/workflows/*.yml .github/security/*.yml | grep -vcE "@[0-9a-f]{40}( |$)"` → `0`;
   `grep -n "@sha256:" .github/workflows/ci.yml` → 2 lines;
   `grep -rn "dotnet-version\|NODE_VERSION:" .github/workflows`;
   `grep -n "runs-on: ubuntu-latest" .github/workflows/*.yml` → `codeql.yml:36` and
   `security.yml:72`, `:86`, `:108`, `:128`, `:143`, `:166` (the plain
   `ubuntu-latest` match also hits comments at `ci.yml:39` and `:430`);
   `grep -n "python-version" .github/workflows/security.yml` → `:172`.
4. Table still renders: both rows keep 5 cells (`awk -F'|' 'NR==56||NR==68{print NR, NF}' ENGINEERING_STANDARDS.md` → `56 7` and `68 7`).

Track checklist (G1 Waves 1-3): one gate per PR — no gate added; canary — N/A, no
gate; pinning — unchanged, verified by check 3; baselines only shrink — none touched.
CI, Security, Workflow lint run on the PR; no code paths change.

## 6. Security impact

None: text only. No route, policy, data, login, secret or dependency changes.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request.

## 9. Owner decisions needed

- **O-1 (answered)**: G-3 (`ENGINEERING_STANDARDS.md:56`) reads "Partial: production version
  not recorded; image tag floats". GAP-09 pinned the image by digest, so "image tag
  floats" is now false. Should this change also drop "image tag floats" from G-3
  (leaving "Partial: production version not recorded", which GAP-10 owns), or leave
  G-3 for GAP-10? Owner's answer, relayed by the coordinator on 2026-11-19: "Fix G-3 too
  (Recommended)". Drop only "image tag floats"; keep "production version not
  recorded" for GAP-10. No decision remains open.

## 10. Risks

- Overclaiming (calling G-15 Met): prevented by design; check 3 confirms residuals.
- Touching other rows: check 2.
- Broken table: check 4.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| G-15 status cell reflects GAP-09 | GAP-09 delivery-approval.md:82 | Planned | |
| Residuals (`ubuntu-latest`, Python 3.12, no enforcing check) stated | GAP-09 plan.md:186-208; owner request | Planned | |
| G-3 status drops "image tag floats" only | O-1 | Planned | |
| No standard row other than G-3 and G-15 changed | owner request | Planned | |
| Register status update, if required | owner request | Planned (expected: not required, no status column) | |

## 12. Revision log

- Round 0: first plan. No review records yet.
- Round 0, revision 1: O-1 answered by the owner ("Fix G-3 too (Recommended)").
  Scope now G-3 and G-15; check 2 expects exactly those two lines; check 4 covers
  both rows; coverage row added.
- Round 1 (plan-review.md, CHANGES NEEDED):
  - Major, G-3 line number: G-3 is at `ENGINEERING_STANDARDS.md:56` (57 is G-4).
    Every reference changed to :56; check 4 is now `NR==56||NR==68` expecting
    `56 7` and `68 7` (re-run on the base: `56 7`, `68 7`). The revision-1 claim
    that `57 7` was verified had checked the G-4 row; withdrawn.
  - Minor, check 3: now greps `runs-on: ubuntu-latest`, so the `ci.yml:39` and
    `:430` comments no longer match.
  - Minor, optional: the `security.yml` lines 72, 86, 108, 128, 143, 166 are listed
    in Current state and in check 3.
