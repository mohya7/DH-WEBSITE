# GAP-11c delivery approval (gate 2)

## Decision

Approved for the owner. This is not the owner's confirmation: the push, the pull request and the squash-merge wait for the owner.

## Verified myself

- Commits `origin/rebuild/dotnet-platform..a9653c4`: 3b6e97f plan, a5e41f8 failing tests (only `website/test/output.test.ts`, +42), 6466c63 test escape correction (still red), 7ef1851 fix, a9653c4 record. Failing tests come before the fix (B-6). Subjects are `GAP-11c: <imperative>`, each with a body and the `Co-Authored-By` trailer (B-4).
- Diff scope matches the plan: `check-output.ts`, `output.test.ts`, `package.json`, `package-lock.json` (one added root devDependency line `"parse5": "8.0.1"`, nothing else), and the change records. `SRI_BLOCKING_FROM` is still `"2026-11-26"`. The existing GAP-11 tests are not touched (the test diff adds lines only).
- Fix reviewed: parse5 tree walk (including `<template>` content), WHATWG `URL` resolution against a sentinel `.invalid` origin, fail closed on a src that does not parse, and an integrity list accepted when one token is a full sha384.
- Re-ran `npx vitest run test/output.test.ts` in `website/`: exit 0, 30 of 30 passed.
- The test report gives a command, exit code and output for each check. Every coverage row has evidence. The tester's red-at-base and green-at-head runs, the `out/` `diff -r` (exit 0), audit, `npm ls parse5` and the security probes are recorded.

## Tester Minors accepted

1. SVG `<script href>` is not checked. This is not a regression, because the base regexp missed it too. Follow-up: GAP-11d (record it in `docs/deferred-items.md`).
2. The recursive walk overflows the stack at about 5000 nesting levels. It fails closed (the build check throws), and generated output never nests that deep. Follow-up: an iterative walk, in the same GAP-11d.

## Open Definition of Done items

- PR checks green on the final head: CI, Security (semgrep, gitleaks) and Workflow lint have not run. They run after the push.
- Not run locally, covered by the CI `website` job: e2e, design:check, compare:sections and the browser suites. gitleaks is covered by `security.yml`.
- Governance: the two follow-ups above are to be added to `docs/deferred-items.md`, either at the merge or in GAP-11d.
- After the merge: the suites run again on rebuild/dotnet-platform.

## Draft pull request description

```markdown
## What and why

GAP-11c: the external-script integrity check in `website/scripts/check-output.ts` now reads `<script>` tags with a real HTML parser (parse5, the WHATWG tokenizer that jsdom already uses), and it resolves `src` with WHATWG URL resolution. The regexp check missed four cases: a `src` after a quoted `>`, whitespace or backslashes around `src`, and an entity-encoded `src`. It also rejected an integrity list that held a valid sha384. This closes the GAP-11 tester round-2 Minors 1 and 2.

## Scope and boundaries

In scope: `check-output.ts` (`checkScriptIntegrity` and its helpers), new tests in `test/output.test.ts`, and parse5 8.0.1 pinned as a devDependency (already in the tree through jsdom, deduped). Out of scope: `SRI_BLOCKING_FROM` (unchanged, 2026-11-26), the existing GAP-11 tests (unchanged), and rendered output (`out/` is identical to the base).

## Security impact

The change hardens a build-time gate. There is no route, data or secret change. The only dependency change is a direct pin on parse5@8.0.1, a version already installed. `npm audit --audit-level=high` exits 0.

## Tests and evidence

- Red first: a5e41f8 and 6466c63 hold tests 1 to 5, which fail on the regexp check. Test 6 and the guards pass.
- `npx vitest run test/output.test.ts`: exit 0, 30 passed. The full website suite: 479 passed. typecheck, build and check:csp: exit 0 (see test-report.md).
- `diff -r` of `out/` between base and head: exit 0.
- `npm ls parse5`: one deduped 8.0.1.
- Semgrep on the changed files: no findings.
- NOT RUN locally: e2e, design:check, compare:sections and the browser suites (the local e2e harness is broken), covered by the CI `website` job. gitleaks is covered by the `security.yml` job.
- CI run ids: to be added after the push.

## Owner decisions

- O-1: "CI level is enough" (the audit criterion is `npm audit --audit-level=high`, as in `security.yml`).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no route is changed)
- [x] Tests exist for the behaviour changed; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run (plan-reviewer, tester, tech-lead gates) and its findings are fixed or accepted below
- [x] The approver's review is recorded, and the AI governance rules were followed
- [x] Rollback is understood: revert this PR
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint run again after the merge.

## Review findings accepted

1. SVG `<script href>` is not checked. This is not a regression, because the old check missed it too. Follow-up: GAP-11d.
2. Nesting deeper than about 5000 levels overflows the recursive walk. It fails closed, and generated output never nests that deep. Follow-up: an iterative walk, in GAP-11d.

## Governance

- [x] Change records in `docs/changes/GAP-11c/`
- [ ] `docs/deferred-items.md` updated for the two follow-ups
- [x] Documentation updated (the doc comment in `check-output.ts`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
