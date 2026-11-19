# Test report: GAP-NEXT-UPGRADE

## Round 1

Commit tested: `5995a8d` (red `dd43e1e`, base `cdef7c9`), on detached worktrees `D:\work\DigitalHub\dh-platform-claude-next-upgrade-test` (5995a8d) and `...-base` (cdef7c9). Both are removed now. All website commands ran with CONTENT_SOURCE=snapshot and PUBLIC_SITE_URL=https://digitalhub.com.eg after a fresh `npm ci` (exit 0) in each tree.

### Scope

`git diff cdef7c9 --name-only`: only `website/package.json`, `website/package-lock.json` and `docs/changes/GAP-NEXT-UPGRADE/*`. None of the GAP-11 files (check-output.ts, src/design/*, design.test.ts, output.test.ts) changed. In package.json the only change is `"next": "16.4.3"` to `"16.4.6"`. In the lockfile, the changed lines that are not version lines are the resolved and integrity lines of next, @next/env and the 8 @next/swc-* packages, plus 4 `libc` blocks. This matches implementation.md.

### Red was red

The red commit adds evidence only (audit-before.json), not a test. On base `cdef7c9`, `npm audit --json` exited 1, and these GHSA ids showed up: GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8 (next), plus GHSA-333x/w74x/wjr9/xhq7 (fast-uri). Both target advisories were present before the change.

### Checks (website/, head 5995a8d)

| Command | Exit | Output |
| --- | --- | --- |
| `npm audit` | 1 | only `fast-uri 3.0.0 - 3.1.8`, moderate (out of scope); no next advisory |
| `npm audit --audit-level=high` | 0 | |
| `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `npm ls next @next/env` | 0 | `next@16.4.6`, `@next/env@16.4.6` |
| `npm run typecheck` | 0 | |
| `npm test` | 0 | `Test Files 24 passed (24)`, `Tests 461 passed \| 1 skipped (462)` |
| `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `npm run build` | 0 | `Build output checks passed.` |
| `CSP_CHECK_PORT=4240 CSP_CHECK_DEBUG_PORT=4241 npm run check:csp` | 0 | one report-only style-src-elem report on /careers/apply (the policy is report-only) |
| `WEBSITE_TEST_PORT=4242 npx playwright test` | 0 | `25 skipped`, `4 passed` |
| `SECTION_COMPARE_PORT=4250 npm run compare:sections` (base and head) | 1 / 1 | both: `104/119 sections match; 14 accepted; 1 failures`. The failure is the /careers/apply #section, and it is on the base too. result.json SHA-256 is `f8963f90eeac4cc1a3b5206b524b09b2e36748534be8d5ec6279e1363cc91c4a` in both runs |
| base `npm run build` (cdef7c9) | 1, rerun 0 | The first run failed and left a partial out/. A rerun with no change passed with `Build output checks passed.` This is the same transient failure the developer recorded |
| `diff -rq <base>/website/out <head>/website/out` (after the base rerun) | 0 | verbatim output below |
| `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` |
| gitleaks | NOT RUN | not installed; covered by the `security.yml` gitleaks job |
| screenshot parity (`compare:screenshots`) vs base and vs portal | NOT RUN | Playwright WebKit is not installed, and downloading it needs owner consent. Covered by the base parity diff below |
| `dotnet test`, studio suites, e2e | NOT RUN | not touched by this change; the local e2e harness is broken. Covered by the CI and e2e jobs on the PR |

The diff -rq output, quoted verbatim:

```
```
(empty, exit 0). The two static exports are byte-identical. Screenshots are rendered from those files, so screenshot parity against the base holds. Parity against feature/interviewer-portal is unchanged from the base: section result.json is identical.

### Security

No routes, policies, logins or secrets changed. No secret is in the diff: a grep for password/secret/token/api key matches only plan prose saying there are none. Both target advisories are cleared. The only remaining advisory is fast-uri (moderate), which was already there before this change and is out of scope.

### Findings

None (no Blocker, Major or Minor).

Observation, not a finding: the first base build failed once before a clean rerun passed. The developer saw the same thing. It is pre-existing and not caused by this change.

### Coverage rows verified

next pinned at 16.4.6 with an npm-generated lockfile; GHSA-mfr8-8qww-v76h cleared; GHSA-vc7v-qv4w-wrv8 cleared; audit-level=high 0; build; npm test; design:check; check:csp; browser suite; section parity vs base (identical) and vs portal (unchanged, 1 pre-existing failure); screenshot parity vs base by an identical out/ (tool NOT RUN); GAP-11 files untouched. API/e2e: NOT RUN, CI.

Verdict: APPROVED
