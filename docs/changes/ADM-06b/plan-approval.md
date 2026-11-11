# ADM-06b: plan approval (gate 1)

Technical lead, gate 1, 11 November 2026. Plan: `docs/changes/ADM-06b/plan.md`,
round 2. Review: `docs/changes/ADM-06b/plan-review.md`, Round 2, `Verdict: APPROVED`
with three new Minors. Worktree `/home/user/dh-change-adm06b`, branch
`change/ADM-06b`, base `f171f7a`. Nothing committed; this file is the only one
written.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7).

## Decision

Approved, with the conditions below. O-ADM06B-1 is still PENDING and blocks the
first push only. Development, the three local commits, local red and green, the
tester and gate 2's local checks do not wait for it.

## Read

- `docs/changes/README.md`, `AGENTS.md` (worktree copy).
- `ENGINEERING_STANDARDS.md` from `origin/claude/cool-heisenberg-mh6zx9`
  (P-4 to P-8, B-2 to B-8 read at lines 25-42).
- `/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md` (lines 17-32,
  221-225, 266-270) and `admin-audit-2026-10-28.md` (ADM-06, lines 133-145).
- `plan.md` round 2 in full; `plan-review.md` rounds 1 and 2 in full.

## Why it is the right change at the right time

- **Execution order.** The refinement plan puts G3-1 in slot 2, 3 to 16 November,
  in the order "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a" (line 26). ADM-06 is
  first; ADM-06b is its second half and the last piece before ADM-03. Slot 1
  (Wave 1: #44 GAP-07, #50 semgrep-timeout) is a separate slot and is not
  overtaken. Wave 0-before-Wave 1 and ISO-4-after-ISO-5 do not apply to a G3 item.
  ADM-06 is a Blocker, so it goes before any Major.
- **No owner decision gates ADM-06.** O-14 to O-17 attach to ADM-01b, ADM-08
  (delete), the noindex rule and a Minor (`admin-audit` lines 75, 115, 131, 307);
  none to ADM-06.
- **Owner's request**, quoted in the plan as given: "merge  and start next task"
  and "continue work" (Mohamed Elbadry, 10 November 2026, project thread). That
  is the request to proceed. It is not read as an answer to O-ADM06B-1, and this
  approval does not read it that way either.
- **Scope fits the audit.** The fix line "Add paging controls to the audit, inbox
  and media screens" plus the audit's preview-loader bullet. Adding redirects is
  the same `Table` change on an endpoint the audit lists as affected (B-8 holds).
  Leaving the collection list out is right: its reorder needs the whole set
  (`CollectionListPage.tsx:63`), and ADM-08 owns reordering.
- **Design.** The token-only `components.Pagination` override applies
  `docs/phase-b-studio.md` line 480 ("need `components` overrides"); it does not
  change the settled navy look. I checked: `studio/src/theme.ts` has no
  `Pagination` entry today; `packages/theme/tokens.ts:3-5` gives `card #0E1B2C`,
  `raised #111F32`, `input #091624`; the only `pagination` uses in `studio/src`
  are the four `pagination={false}` lines the plan names. The look is now checked
  by assertions, not by judgement.
- **Red first (P-4, B-6, G3 rule).** Commit 1 (e2e only), commit 2 (unit and
  preview tests), commit 3 (fix). S1-S12, P2, P3 are red locally before the fix
  without needing ADM-06a; E1/E2 red in CI waits on O-ADM06B-1. The "No" branch
  correctly sends any reading that E1/E2 red is mandatory to the owner. My reading
  for this gate: the G3 red-first rule is met by S1-S12, P2 and P3; E1/E2 CI red
  is wanted but its absence is a NOT RUN with reason, not an exception I can grant
  or refuse. If the owner answers "No", gate 2 will check that the NOT RUN is
  recorded as the plan says and will not treat it as waived by me.

## Conflicts with open work

Checked myself on 11 November:

```
$ gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open' --jq '.[]|"\(.number) \(.head.ref) \(.head.sha[0:7]) draft=\(.draft)"'
50 change/semgrep-timeout 608c4a5 draft=false
49 change/ADM-06 4ab5809 draft=true
44 change/GAP-07 e8a8d9d draft=false
```

- Files: #50 touches `.github/security/*` and `docs/changes/semgrep-timeout/`;
  #49 touches `api/` and `docs/changes/ADM-06/`; #44 touches `.github/security/*`,
  `.github/workflows/security.yml` and `docs/changes/GAP-07/`. ADM-06b touches
  only `studio/` and `docs/changes/ADM-06b/`. No shared file.
- Every remote branch ahead of the base was diffed against the eight files the
  plan changes. Only `origin/phase-c/section-9` touches `previewData.ts` and its
  test; that branch was merged as PR #16 on 13 October and is stale. No conflict.
- Later G3 items (ADM-07, 12, 03, 15, 16, 21) will edit the same screens. They
  must rebase on ADM-06b and not be built in parallel on these files (plan 2.8).
- **Dependency on #49.** #49 head `4ab5809`: every CI check passed except Semgrep
  (`completed/failure`), the parser timeout that #50 fixes. ADM-06b's final head
  must contain #49 (plan 3.5), and its Semgrep job will hit the same timeout until
  #50 has merged. Plan 2.1 still quotes #49's head as `c870b7e`; that is stale
  and harmless, since 3.5 keys on #49's squash commit, not its head.

## Schedule and risk

- The plan targets merge on Thursday 12 November, after #49. With slot 2 at one
  pull request a day and #49 not yet merged, the earliest realistic merge is the
  working day after #49 merges. If #49 merges on 12 November, ADM-06b lands on
  13 November at the soonest.
- Seven more G3-1 blockers remain after ADM-06 (ADM-03, 02, 07, 10, 05, 04, 12,
  01a) against a 16 November exit gate at one merge a day. That cannot all fit,
  whatever this change does. The owner has an unanswered card about moving the
  G3-1 gate. This approval does not assume an answer, and does not move or
  shorten anything to fit the date: no step in the plan (red-first, draft PR,
  `merge-base` check, wait for the red run to conclude) is to be skipped for
  schedule reasons.
- Risk is low. Studio-only, no API, migration, route, policy, secret, dependency,
  workflow or harness change. Rollback is a revert. The one real risk, merging
  before #49 (20 rows a page on every paged screen), is not prevented by CI
  (no branch protection, P-1 Partial) and is covered by the draft PR, its first
  line, the integrator, and the `merge-base --is-ancestor` check at gate 2. I
  accept that.

## Reviewer's Minors (round 2)

All three are accepted as not blocking. None changes a value, a test criterion or
the scope.

1. **`itemActiveBg` reason cites `Segmented` wrongly.** Confirmed:
   `theme.ts:72-76` gives `Segmented` an accent tint `rgba(31, 158, 233, 0.12)`,
   not `surfaces.raised`. The value is right; the reason should cite the design
   document's `Segmented` row and `Tag.defaultBg` (`theme.ts:78`). Accepted as
   wording. Condition 3 below.
2. **Stale "observation for ADM-08" wording in 4 and 5.5.** Accepted as wording.
   Section 3.4 and section 11 are authoritative. Condition 4 below.
3. **Use `toHaveCSS` instead of a one-shot `getComputedStyle`.** Accepted, and
   made a condition (5 below), because a racy read in E1/E2 would be a flaky gate.
   The criterion and the colour values are unchanged, so this is not a plan change.

## Conditions the developer must meet

1. **O-ADM06B-1 before any push.** Do not push `change/ADM-06b` or open the pull
   request until the owner has answered O-ADM06B-1 in words. Quote the words, date
   and place in `implementation.md`. Do not infer the answer from ADM-06a, from
   "continue work" or from this approval.
2. **Merge order.** Open the pull request as a draft whose first line is "Do not
   merge before #49 (ADM-06a)." Keep it a draft until #49 has merged and the base
   is merged into the head (merge only after any push, B-5). The final head must
   pass `git merge-base --is-ancestor <#49 squash sha> <head>` with exit 0; gate 2
   will not approve without it quoted.
3. **Minor 1.** In `implementation.md`, give the `itemActiveBg` reason as the
   design document's `Segmented` row and `Tag.defaultBg`, not "same as `Segmented`
   in `theme.ts`". The value stays `surfaces.raised`.
4. **Minor 2.** The ADM-08 destination is the one in plan 3.4: the coverage rows,
   a "For ADM-08" section in `implementation.md` naming
   `CollectionListPage.tsx:63`, `:65-69`, `:76` and `OverviewPage.tsx:28`, and the
   same section in the PR body. The tester checks that destination.
5. **Minor 3.** Write the E1 and E2 colour checks as
   `await expect(locator).toHaveCSS(property, "rgb(...)")` on the
   `.ant-pagination-item` (non-active) and `.ant-pagination-item-active` locators
   and their `a` children, with the values in plan 3.2 and 5.1. Move the mouse off
   the pager first. Do not loosen a value if it fails; report it as a design
   finding.
6. **Red run in CI (only if O-ADM06B-1 is "Yes").** Push nothing after commit 1
   until the "Studio — typecheck, build, end-to-end" check run on it has
   conclusion `failure` with E1 and E2 named at the pager locator. A `cancelled`
   run is re-run, not counted.
7. **Semgrep.** Semgrep must be green on the final head. If it fails on the parser
   timeout, the remedy is #50 merging and the base being merged in, not a change
   to Semgrep settings or any gate in this pull request (P-6).
8. **Scope.** Only the files in plan section 4. `package.json`,
   `package-lock.json`, `tsconfig*.json`, `vitest.config.ts`,
   `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`, workflows and `api/`
   stay untouched; `git diff --exit-code` on the two package files after `npm ci`
   is quoted (B-7). In `theme.ts`, only the six-token `Pagination` entry.
9. **Commits.** The three subjects in plan 5.2, `ADM-06b:` prefix, a body saying
   why, and the attribution trailer (B-4). Stage exact paths (B-5).
10. **If the plan cannot be followed** (for example the red run shows a
    `matchMedia` TypeError rather than the missing pager, or a computed colour
    differs from the token), stop and send the change back to step 1. Do not
    adjust the plan or the test.

## Owner decisions

| Id | Question | Status | Blocks |
| --- | --- | --- | --- |
| O-ADM06B-1 | Push the e2e red commit first? | PENDING, not yet asked | The first push only |
| G3-1 exit-gate date | Owner's unanswered card about moving 16 November | Not this change's decision | Nothing in this plan; noted for the integrator |

Verdict: APPROVED
