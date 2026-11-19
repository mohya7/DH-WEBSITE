# Delivery approval (gate 2): GAP-NEXT-UPGRADE

## Decision

Approved for the owner. test-report.md round 1 is `Verdict: APPROVED`. This is not an owner decision: the push and the PR wait for the owner's confirmation.

## What I verified myself

- `git log cdef7c9..HEAD`: `e3c6463` plan, `dd43e1e` red evidence (base `npm audit --json` with both GHSA ids, in audit-before.json), then `5995a8d` the fix. The red commit comes before the fix (B-6). Subjects are `GAP-NEXT-UPGRADE: <imperative>`, each with a `Co-Authored-By` trailer (B-4).
- `git diff --stat cdef7c9...HEAD`: only `website/package.json`, `website/package-lock.json` and `docs/changes/GAP-NEXT-UPGRADE/*`. The GAP-11 files, fast-uri, Studio, known-findings.json and workflows are untouched.
- package.json: only `"next": "16.4.3"` changed to `"16.4.6"`, still an exact pin. In the lockfile, the changed version lines are 10 lines of 16.4.3 to 16.4.6. The drift grep on `node_modules/` path lines returns nothing, so no package was added or removed.
- I re-ran `npm audit` in website/ on the head. Only `fast-uri` (moderate, pre-existing, out of scope) is listed. Neither GHSA-mfr8-8qww-v76h nor GHSA-vc7v-qv4w-wrv8 appears. `npm ls next @next/env` gives 16.4.6 for both.
- The tester's evidence is concrete: commands, exit codes and output lines, on a detached checkout of 5995a8d. It agrees with the developer's evidence, including the empty `diff -rq` of base and head `out/` and the identical section result.json SHA-256.
- Coverage table: every row has evidence or is marked NOT RUN with a named cover.

## Open items

1. Screenshot parity tool NOT RUN (Playwright WebKit is not installed, and installing it is a download that needs owner consent). Parity is shown by the byte-identical `out/` trees instead. I accept that as evidence, but the owner should know it was not run.
2. The /careers/apply `#section` section-compare failure is pre-existing (same as on the base) and not caused by this change.
3. API, e2e, gitleaks: NOT RUN locally. CI on the PR covers them.
4. PR checks on the final head: not run yet (no push).
5. The owner confirms the push and the PR, then squash-merges.

## Draft pull request description

---
## What and why

GAP-NEXT-UPGRADE: upgrade `next` in website/ from 16.4.3 to 16.4.6 to clear GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 (moderate). GAP-01 covers only Critical and High, so this change has a new id.

## Scope and boundaries

In scope: `website/package.json` (exact pin 16.4.6) and `website/package-lock.json`, regenerated with `npm install next@16.4.6 --save-exact`. Only `next`, `@next/env` and the 8 `@next/swc-*` packages change version. No code change was needed.
Out of scope, not touched: the GAP-11 files (`website/scripts/check-output.ts`, `website/src/design/*`, `website/test/design.test.ts`, `website/test/output.test.ts`, PR #69), fast-uri, the Studio, `known-findings.json`, workflows and baselines.

## Security impact

Dependency only. It clears two moderate advisories in `next`. No route, policy, data or secret changes. fast-uri (moderate) remains, as before; it is out of scope.

## Tests and evidence

All in website/, with CONTENT_SOURCE=snapshot and PUBLIC_SITE_URL=https://digitalhub.com.eg, on 5995a8d:
- Red, on base cdef7c9: `npm audit --json` exit 1 lists both GHSA ids (audit-before.json).
- `npm audit`: only fast-uri. `npm audit --audit-level=high`: 0. `run-npm-audit.sh website`: 0 (0 new).
- `npm run typecheck` 0; `npm test` 0 (461 passed, 1 skipped); `npm run design:check` 0; `npm run build` 0 ("Build output checks passed."); `npm run check:csp` 0; browser suite 0 (4 passed, 25 skipped, same as base).
- `diff -rq` of base and head `out/`: empty, exit 0 (byte-identical).
- `compare:sections`: 104/119 match, 14 accepted, 1 pre-existing failure (/careers/apply), identical result.json on base and head.
- semgrep: 0 new.
- NOT RUN: `compare:screenshots` (WebKit not installed; covered by the identical `out/`), gitleaks (Security workflow), API and e2e (CI and e2e jobs).
- CI run ids: to be added.

## Owner decisions

The owner's request (19 Nov 2026, in the change prompt): "upgrade Next.js in website/ from 16.4.3 to the lowest patched version (16.4.6)". The advisories list 16.4.5 as first patched. The plan followed the owner's literal 16.4.6 (O-1).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no routes changed)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (the npm audit red/green check; the Security workflow gates future regressions)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint re-run after the merge.

## Review findings accepted

- Screenshot parity tool not run (WebKit missing); the byte-identical `out/` is accepted as evidence.
- The plan-review Minor: allowed `out/` differences judged by hand. None occurred.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (coverage table in docs/changes/GAP-NEXT-UPGRADE/implementation.md)
- [x] `docs/deferred-items.md` updated for any exception (none)
- [x] Documentation updated (change records)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
---

Verdict: APPROVED
