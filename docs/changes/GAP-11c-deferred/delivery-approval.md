# GAP-11c-deferred: delivery approval (gate 2)

## Decision

Approved for the owner. This approval is not the owner's confirmation; the
push and the pull request wait for the owner.

## What I verified myself

- `plan-review.md` latest round and `plan-approval.md` both end `Verdict: APPROVED`;
  `test-report.md` round 1 ends `Verdict: APPROVED`, no findings.
- `git diff --stat origin/rebuild/dotnet-platform...HEAD` (head `e0fd044`): only
  `docs/deferred-items.md` (+33 / -1) and `docs/changes/GAP-11c-deferred/*`.
  Matches plan section 4. No code changed.
- I read the `docs/deferred-items.md` diff: D-002 and D-003 replace "No entries
  yet.", each with the six template lines in order, no placeholders. Owner
  quotes match the owner's answers verbatim ("Yes, defer both"; "2026-12-15";
  "The /change pipeline"). Gate 1 conditions 1 and 2 are met (no section 8
  citation; the unverified "no inline-SVG scripts" claim removed).
- Id clash: no remote `change/*` branch's `docs/deferred-items.md` has a `## D-0nn`
  heading. D-001 on `change/GAP-05` (local, per the developer and plan) is the
  only other claim; D-002 and D-003 are free.
- Commits (`git log origin/rebuild/dotnet-platform..HEAD`): `cd889ea`, `5439950`,
  `e0fd044`, all with the `GAP-11c-deferred:` prefix, imperative subjects and the
  `Co-Authored-By` trailer (B-4). `5439950` has a body saying why; the two record
  commits have no body, acceptable for records.
- Failing-test-first (B-6): not applicable, records only, no security fix.
- Tester evidence is concrete (commands, exit codes, a measured max depth of 16
  over 28 built pages, 0 pages with SVG scripts). I did not re-run a suite:
  there is no code suite covering a markdown change; my re-run check is the
  diff and grep above.
- Coverage table: every row has evidence in implementation.md and is verified
  in test-report.md.

## Open items

- `test-report.md` is untracked in the worktree; the developer or the pipeline
  must commit it (with this file) before the push. Then the final head changes.
- PR checks (CI, CodeQL, Security, Workflow lint) on the final head: not run yet.
- Owner confirmation to push and open the PR; owner squash-merge.
- If GAP-05 lands first with a different numbering, re-check ids.
- Expiry 2026-12-15: GAP-11b and GAP-11d must merge by then, or the owner must
  decide again.

## Draft pull request description

```markdown
## What and why

GAP-11c-deferred. GAP-11c gate 2 required the two accepted residuals of the
script-integrity check to be recorded in `docs/deferred-items.md`. This adds
D-002 (inline SVG `<script href>` is not checked for integrity) and D-003
(very deep nesting overflows the recursive walk in `scriptElements`). Both are
fixed in GAP-11d, which waits for GAP-11b. Owner request: "do item 3".

## Scope and boundaries

In scope: `docs/deferred-items.md`, and the change records in
`docs/changes/GAP-11c-deferred/`. Out of scope: all code, including
`website/scripts/check-output.ts` and its tests (GAP-11d); D-001 (GAP-05); the
refinement plan table.

## Security impact

None. No routes, policies, data, secrets or dependencies. Two known gaps in the
integrity check become visible and time-bound; nothing is loosened (D-003 fails
closed).

## Tests and evidence

- `git diff --stat origin/rebuild/dotnet-platform...HEAD`: only
  `docs/deferred-items.md` and `docs/changes/GAP-11c-deferred/*`.
- `grep -n -E "^- (Rule waived|Justification|Owner decision|Follow-up owner|Expires|Follow-up pull request):" docs/deferred-items.md`,
  exit 0: six lines per entry, in order (D-002 23/26/33-36, D-003 40/43/50-53).
- Tester, on `e0fd044`: `npm ci` exit 0; `CONTENT_SOURCE=snapshot npm run build`
  exit 0 ("Build output checks passed."); a parse5 walk of `out/**/*.html` gave
  28 pages, max depth 16, 0 pages with an SVG script.
- .NET, Vitest, Playwright, npm audit, Semgrep, gitleaks: NOT RUN, no code or
  dependency change. Covered by CI (`ci.yml`) and Security (`security.yml`) on
  this PR. CI run ids: <to fill on the final head>.

## Owner decisions

- O-1: "Yes, defer both" (owner, 2026-11-22, via the coordinator).
- O-2: "2026-12-15" (owner, 2026-11-22, via the coordinator).
- O-3: "The /change pipeline" (owner, 2026-11-22, via the coordinator).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns) — no code changed
- [x] No new prohibited constructs in touched code — no code changed
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope — no routes changed
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test — no behaviour changed
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: nothing deploys until Phase D; the owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint re-run after the merge

## Review findings accepted

Plan review Minors 1 to 3 were addressed as gate 1 conditions. Tester: no findings.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated — not applicable
- [x] `docs/deferred-items.md` updated for any exception
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
