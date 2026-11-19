# GAP-09-status: test report

## Round 1

Commit tested: `db95a4f` (detached worktree `dh-platform-claude-gap-09-status-test`, removed afterwards). Base `8d8e01d`.

### Red test

N/A: documentation-only change; plan section 5 states no failing test applies.

### Plan checks

1. `git diff --stat 8d8e01d HEAD` (exit 0): `ENGINEERING_STANDARDS.md | 4 +-` plus `docs/changes/GAP-09-status/` implementation, plan-approval, plan-review, plan only. Pass.
2. `git diff -U0 8d8e01d HEAD -- ENGINEERING_STANDARDS.md` (exit 0): two hunks, `@@ -56 +56 @@` (G-3, only "; image tag floats" removed) and `@@ -68 +68 @@` (G-15). Pass.
3. Facts in the new cells, verified independently against the workflows:
   - `grep -nE "uses:" .github/workflows/*.yml .github/security/*.yml | grep -vcE "@[0-9a-f]{40}( |$)"` -> `0`. "every action by commit SHA": true.
   - `grep -n "@sha256:" .github/workflows/ci.yml` -> lines 49, 202 (`2022-CU28-ubuntu-22.04@sha256:4525e3ef...7b7f`). "image by digest": true; G-3 "image tag floats" is correctly removed.
   - `NODE_VERSION: "22.23.4"` at `ci.yml:33`, `security.yml:64`; every `node-version` uses `env.NODE_VERSION`. `dotnet-version: "10.0.404"` at `ci.yml:77`, `:252`, `codeql.yml:54`, `security.yml:117`; no other dotnet-version. True.
   - `grep -n "runs-on" .github/workflows/*.yml`: `ubuntu-latest` only at `codeql.yml:36`, `security.yml:72,86,108,128,143,166`; ci.yml and workflow-lint.yml use `ubuntu-24.04`. Residual statement true.
   - `python-version: "3.12"` only at `security.yml:172`. True.
   - gitleaks exact: `GITLEAKS_VERSION: "8.30.1"`, checksum verified; Semgrep `semgrep==1.180.0` (asserted in `gate.test.mjs:1179`). True.
   - "no CI check enforces pinning": no workflow step checks `uses:`/digest pinning (security.expected.yml pins security.yml bytes, which is not a pinning rule). True.
4. `awk -F'|' 'NR==56||NR==68{print NR, NF}' ENGINEERING_STANDARDS.md` -> `56 7`, `68 7`. Pass.

### Track checklist (G1)

No gate added; canary N/A; pinning unchanged (check 3); no baseline touched. Pass.

### Security

Text only. No route, login, dependency or secret change; no secret in the diff.
NOT RUN: npm audit, dotnet audit, Semgrep, gitleaks, .NET/Vitest/Playwright/builds; no code or dependency changes. Covered by `security.yml` (npm/dotnet audit, Semgrep, gitleaks jobs) and `ci.yml` on the PR.

### Beyond the plan

Checked for other floating references (`latest`, unversioned installs): only `runs-on: ubuntu-latest` and `npx playwright install` (version from the lockfile). Nothing the G-15 cell omits that contradicts it.

### Findings

None.

### Coverage rows verified

| Item | Status | Evidence |
| --- | --- | --- |
| G-15 status cell reflects GAP-09 | Verified | check 2, check 3 |
| Residuals stated | Verified | runs-on and python greps |
| G-3 drops "image tag floats" only | Verified | hunk `@@ -56 +56 @@` |
| No other row changed | Verified | two hunks only; check 4 |
| Register update not required | Verified | no status column |

Verdict: APPROVED
