# GAP-11c-deferred: test report

## Round 1

Commit tested: `e0fd044` (detached worktree `../dh-platform-claude-gap-11c-deferred-test`, now removed). Records-only change, no red-test commit (plan section 5), so the red/green check does not apply.

### Checks

- `git diff --stat 266b124 e0fd044`, exit 0: only `docs/deferred-items.md` and `docs/changes/GAP-11c-deferred/{plan,plan-review,plan-approval,implementation}.md`. Condition 5 met.
- `grep -n -E "^- (Rule waived|Justification|Owner decision|Follow-up owner|Expires|Follow-up pull request):" docs/deferred-items.md`, exit 0: template 13-18, D-002 23/26/33-36, D-003 40/43/50-53. Six lines per entry, in order, no placeholders.
- Owner quotes match plan section 9 verbatim ("Yes, defer both", "The /change pipeline", 2026-12-15). Expiry is after today (2026-11-22).
- Condition 1: D-002 Rule waived cites only GAP-11 "Done when" (refinement plan line 160); no section 8 phrase. Met.
- Condition 2: the "no inline-SVG scripts today" claim was removed. Met. I checked it anyway (below): 0 of 28 pages.
- Wording matches `docs/changes/GAP-11c/test-report.md` Minors 1 and 2 (returns `[]`; `RangeError` at 5000 and 20000).
- D-003 claim "generated output never nests that deep" (the developer did not verify it). In `website/`: `npm ci` exit 0; `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` exit 0 ("Build output checks passed."). I then ran a scratch script, written outside the tree and deleted afterwards, that parsed every `out/**/*.html` with parse5 and walked it iteratively: `{ pages: 28, maxDepth: 16, file: 'out\about.html', pagesWithSvgScript: 0 }`, exit 0. The deepest page is 16 levels against the 5000-level failure point, so the claim holds for the snapshot content.
- Conditions 3, 4 and 6: recorded in implementation.md. Nothing pushed. Gate 2 checks the workflow triggers.
- .NET, Vitest, typecheck, design:check, compare:sections, Studio, e2e: NOT RUN, because no code changed. CI (`ci.yml`) covers them on the pull request.
- Security: npm audit, Semgrep, gitleaks: NOT RUN, because there are no dependency or code changes. The `security.yml` jobs cover them on the pull request. There are no routes, logins or secrets in the diff (read by eye).

### Findings

None.

### Coverage rows verified

| Item | Status | Evidence |
| --- | --- | --- |
| D-002 entry in template form | Verified | grep above |
| D-003 entry in template form | Verified | grep above; depth 16 measured |
| Both entries name GAP-11d and its wait on GAP-11b | Verified | Justification lines |
| Owner quote, owner and expiry from the owner only | Verified | match plan section 9 |
| Only records files changed | Verified | diff --stat |

Verdict: APPROVED
