# GAP-05 test report

## Round 1

Tester, 2026-11-22. Commit tested: `c3d3fbf` (branch `change/GAP-05`), on a
detached worktree `D:\work\DigitalHub\dh-platform-claude-gap-05-test` (removed
afterwards). Red commit: `3cd972e`. Read: `docs/changes/README.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `plan.md`, `plan-review.md`, `plan-approval.md`
(Round 2, C-1 to C-8), `implementation.md`. No database was used. Ports used:
4292 only. Port 4284 is held by PID 11968 (`node.exe`, not started by me; not
stopped).

### Scope of the change (own commits, first parent)

`git show --name-only` per commit:
- `3cd972e`: `website/test/parity-gates.test.ts`
- `dc8cc13`: `docs/deferred-items.md`, `parity-gates.test.ts`,
  `accepted-differences.json`, `compare.html`
- `74fd862`: `.github/workflows/ci.yml` (6+/8-)
- `4ee01f1`, `c3d3fbf`: `docs/changes/GAP-05/implementation.md`
- `afac55f`: merge of the base (ISO-3, #79), a merge and not a rebase (C-2).

Matches plan section 4. No API, Studio, package or lockfile change.

### Checks

| Check | Command (in `website/` unless stated) | Exit | Output |
| --- | --- | --- | --- |
| Red first (C-1) | at `3cd972e`: `npx vitest run test/parity-gates.test.ts` | 1 | `Tests 5 failed (5)`; "expected true to be false" (section step), "apply-form entry: expected undefined to be defined" (x3), "cites a D-NNN ... expected [] to not have a length of +0". Reasons match plan section 5. The old-page test ran (failed, not skipped; C-8). |
| Green at head | at `c3d3fbf`: same command | 0 | `Tests 5 passed (5)`; old-page part ran (ref present) |
| `npm run typecheck` | | 0 | |
| `npm run build` | `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | "Build output checks passed." |
| `npm run design:check` | | 0 | "All 25 files match: 24 identical, 1 ported with the recorded change." |
| `npm test` | | 1 | `Test Files 2 failed | 23 passed (25)`, `Tests 27 failed | 457 passed | 1 skipped (485)`. Failures: `screenshot-parity-browser.test.ts` (`EADDRINUSE 127.0.0.1:4284`), and `design.test.ts` / `no-hiring-system.test.ts` "Test timed out in 5000ms" |
| Re-run of the timed-out files | `rm -rf artifacts; npx vitest run test/no-hiring-system.test.ts test/design.test.ts` | 0 | `Tests 26 passed (26)` (load timeouts, not defects) |
| Rest of suite without the browser file | `npx vitest run --exclude test/screenshot-parity-browser.test.ts` | 1 | `1 failed | 453 passed`; the one failure was the `design.test.ts` timeout, passing alone (above) |
| `screenshot-parity-browser.test.ts` | | NOT RUN | Port 4284 held by PID 11968 (`netstat -ano`: `127.0.0.1:4284 LISTENING 11968`), hard-coded port in the test. Covered by CI `screenshot-parity` "Chromium regression tests" and the `website` job. GAP-05 changes nothing that test reads. |
| Section comparison, clean build | `SECTION_COMPARE_OLD=<scratch>/old-site` (`git archive feature/interviewer-portal`, `git init -b feature/interviewer-portal`, nothing committed) `SECTION_COMPARE_NEW=$PWD/out SECTION_COMPARE_PORT=4292 SECTION_COMPARE_OUT=<scratch>/sc-clean npm run compare:sections` | 0 | `104/119 sections match; 15 accepted; 0 failures (including chrome).` `**Pass.**` `/careers/apply.html section — apply-form` |
| Acceptance is only the owner-accepted form (one-word and other mutations on copies of `out/careers/apply.html`, same command, port 4292) | m1 "Send application" -> "Submit application" | 1 | `14 accepted; 1 failures`, `differs: /careers/apply.html #section` |
| | m2 consent "I have read the" -> "I have seen the" | 1 | same |
| | m3 action `/api/v1/public/apply` -> `/api/v1/public/applx` | 1 | same |
| | m4 one `maxLength="200"` -> `201` | 1 | same |
| | m5 breadcrumb "Home" -> "House" (outside the form, inside the outer section) | 1 | same |
| `ci.yml` diff (C-5) | `git diff afac55f 74fd862 -- .github` | | Only the `section-compare` comment, removal of `continue-on-error` on "Compare sections", and the `screenshot-parity` comment citing D-001 / 2026-12-14. "Compare screenshots" `continue-on-error` kept. No `uses:`, `image:` or version line changed. No `*_BLOCKING_FROM`. |
| Owner words verbatim (C-7) | read entry and D-001 | | Entry reason: `"(a) Accept current form"`; D-001: "Exception, expires 14 Dec", follow-up owner "The /change pipeline", `Expires: 2026-12-14` |
| actionlint | | NOT RUN | Not installed. CI "Workflow lint" covers it. |
| `dotnet test -c Release`, studio `npm test`/`build`/`test:e2e` | | NOT RUN | No API or Studio file changed by GAP-05 (merge content is ISO-3, tested in its own pipeline). CI `api` and `studio` jobs cover them. |
| CI on the pull request (blocking `section-compare`, labelled `screenshots` run) | | NOT RUN | Nothing pushed; pending the owner's push. |

### Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit website | `npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (below the gate) |
| npm audit studio | `npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| npm audit gate | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` / `studio` (from each app folder) | 0 / 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` `studio: ... 0 new.` |
| dotnet audit | | NOT RUN | No .NET package change. CI `security.yml` dotnet audit job. |
| Semgrep | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` (repo root) | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` |
| gitleaks | | NOT RUN | Not installed. CI `security.yml` gitleaks job. |
| Secrets in diff | `git diff afac55f c3d3fbf \| grep -iE "password\|secret\|token\|apikey"` | 1 | no match |
| Routes, roles, host checks, body limits, error shape | | N/A | No route, login or permission change. |

### Findings

- **F-1 (Minor). Test 3 does not tie the template markup to the component, only its style, action, heading and field names.** Plan section 5 says "A later markup or CSS change to the form then fails in a unit test, not only in CI". Steps: change a label text in `ApplyForm.tsx` (for example "Name" to "Full name") and run `npx vitest run test/parity-gates.test.ts`. Expected: test 3 fails. Actual (by reading the test): it compares only `action`, `h2`, field names and normalised `<style>`, so it passes; only the CI `section-compare` job (now blocking) catches it. Not a gate hole, since the comparison blocks, but the plan's claim is only partly met.
- **F-2 (Minor). The old-page test title always says "(skipped: feature/interviewer-portal not available)"**, including when it runs and passes, so the output reads "✓ ... (skipped: ...)" / "× ... (skipped: ...)". Expected: the skip reason only when skipped. Cosmetic, but it makes C-8 evidence harder to read.

No Blocker or Major.

### Coverage table rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| Careers apply section accepted, "(a) Accept current form" (O-11) | Verified | clean compare `apply-form` accepted; five mutations all rejected, exit 1 |
| `continue-on-error` gone from the section comparison | Verified | `74fd862` diff; test 1 passes |
| Section comparison reports 0 failures | Verified locally | port 4292, exit 0, `0 failures`, `**Pass.**`; CI pending push |
| Screenshot step has D-001 expiring 2026-12-14 (O-21) | Verified | `docs/deferred-items.md`; `ci.yml` comment; test 4 passes |
| Report-mode rule stated and applied | Verified | no `*_BLOCKING_FROM` |
| Failing tests committed first and shown failing | Verified | `3cd972e`, `Tests 5 failed (5)` |
| Test 2 old-page assertions ran (C-8) | Verified | ran in red and green runs |
| Gate shown to fire (C-6) | Verified locally | m1 to m5, exit 1; CI pending push |
| `ci.yml` edited only after ISO-3, no other line changed | Verified | first-parent history, merge `afac55f` before `74fd862`; diff above |

Open for gate 2: CI evidence on the pull request (blocking `section-compare` run, labelled `screenshots` run), and `screenshot-parity-browser.test.ts` locally once 4284 is free.

Round 1 result: APPROVED (superseded by Round 2 below).

## Round 2

Tester, 2026-11-22. Commit tested: `ba22dbd` (merge `79169c5` of base
`aca11b0`, #80, then the F-2 title fix), fresh detached worktree
`D:\work\DigitalHub\dh-platform-claude-gap-05-test`, removed afterwards. Port
4292 only.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Base is an ancestor | `git fetch origin; git merge-base --is-ancestor origin/rebuild/dotnet-platform ba22dbd` | 0 | base `aca11b0` |
| Merge resolution | `git diff origin/rebuild/dotnet-platform ba22dbd -- docs/deferred-items.md` | | Only the D-001 block is added, before D-002; D-002 and D-003 are unchanged |
| Diff against base stays in scope | `git diff --stat origin/rebuild/dotnet-platform ba22dbd` | | 9 files: `ci.yml`, `docs/changes/GAP-05/*`, `docs/deferred-items.md`, `parity-gates.test.ts`, `accepted-differences.json`, `compare.html` |
| F-2 fix | `git diff c3d3fbf ba22dbd -- website/test/parity-gates.test.ts` | | Title is now "the apply-form selector matches the old compared section"; `skipIf` and the code comment with the reason stay. F-2 closed. |
| Parity-gates tests | `npm ci; npx vitest run test/parity-gates.test.ts` | 0 | `Tests 5 passed (5)` (old-page part ran) |
| Typecheck | `npm run typecheck` | 0 | |
| Build | `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | "Build output checks passed." |
| Section comparison, clean | as Round 1, `SECTION_COMPARE_PORT=4292` | 0 | `104/119 sections match; 15 accepted; 0 failures (including chrome).` `**Pass.**`, apply-form accepted |
| One-word change | copy of `out`, "Send application" -> "Submit application", same command | 1 | `14 accepted; 1 failures`, `differs: /careers/apply.html #section` |
| `screenshot-parity-browser.test.ts` | `netstat -ano \| grep ":4284 "` (no output: port free), then `npx vitest run test/screenshot-parity-browser.test.ts` on a fresh checkout of `ba22dbd` | 0 | `Tests 30 passed \| 1 skipped (31)` |
| CI on the pull request | | NOT RUN | Pending the owner's push |

Findings: F-2 is closed. F-1 (Minor: test 3 checks only style, action,
heading and field names, so the blocking `section-compare` job catches other
markup drift) is still open; it is not a blocker. No Blocker or Major.

Verdict: APPROVED
