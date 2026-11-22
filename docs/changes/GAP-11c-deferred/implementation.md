# GAP-11c-deferred: implementation

## What changed

- `docs/deferred-items.md` (Scope: Change): "No entries yet." replaced by
  D-002 (inline SVG `<script href>` not checked) and D-003 (recursive walk
  overflow), in the template's six lines, in order. Commit `5439950`.
- `docs/changes/GAP-11c-deferred/implementation.md` (Scope: Create): this file.

No code changed, so there is no red-test commit (plan section 5).

## Gate 1 conditions

1. Minor 1: D-002's Rule waived line cites only GAP-11 "Done when"
   (refinement plan line 160). The ENGINEERING_STANDARDS.md section 8 phrase
   is not present.
2. Minor 2: I did not build the website, so I deleted the claim "generated
   pages contain no inline-SVG scripts today". D-002 keeps "not a regression",
   sourced to the GAP-11c test report and delivery approval.
3. Minor 3: workflows read from `.github/workflows/`. `grep -n paths
   .github/workflows/*.yml` finds no `paths` or `paths-ignore` filter in any
   workflow (only a comment in workflow-lint.yml saying it has none). So all
   four trigger on a docs-only pull request to `rebuild/dotnet-platform`:
   - CI (`ci.yml`): `pull_request` types opened, synchronize, reopened, labeled.
   - CodeQL (`codeql.yml`): `pull_request` to `rebuild/dotnet-platform`.
   - Security (`security.yml`): `pull_request`.
   - Workflow lint (`workflow-lint.yml`): `pull_request`.
4. Ids re-checked before commit, after `git fetch origin`, over every local and
   remote `change/*` branch (`git show <b>:docs/deferred-items.md | grep -oE
   'D-0[0-9]+'`): only `change/GAP-05` claims an id, D-001. D-002 and D-003
   are free.
5. Only `docs/deferred-items.md` and `docs/changes/GAP-11c-deferred/*` changed
   (see below). Owner quotes copied from plan section 9.
6. Not pushed.

## Commands

- `grep -n -E "^- (Rule waived|Justification|Owner decision|Follow-up owner|Expires|Follow-up pull request):" docs/deferred-items.md`
  exit 0: lines 13-18 (the template block), 23, 26, 33-36 (D-002), 40, 43,
  50-53 (D-003). Six per entry, in order, no placeholders.
- `git diff --stat origin/rebuild/dotnet-platform` exit 0: only
  `docs/changes/GAP-11c-deferred/{plan,plan-review,plan-approval}.md` and
  `docs/deferred-items.md` (before this file was added).
- Expires 2026-12-15 is a valid date after today (2026-11-22).
- Website build, .NET, Vitest, Playwright: NOT RUN; no code changed. CI,
  CodeQL, Security and Workflow lint run on the pull request.

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| D-002 SVG `<script href>` entry added in template form | delivery-approval.md l.17, 24; test-report.md l.55 | Done | `5439950`, deferred-items.md lines 21-36; grep above |
| D-003 recursive walk overflow entry added in template form | delivery-approval.md l.18, 24; test-report.md l.56 | Done | `5439950`, deferred-items.md lines 38-53; grep above |
| Both entries name GAP-11d and its wait on GAP-11b | owner request | Done | Justification lines of D-002 and D-003 |
| Owner quote, owner and expiry filled from the owner only | deferred-items.md header | Done | lines 33-35 and 50-52 match plan section 9 verbatim |
| Only records files changed | owner request | Done | `git diff --stat` above |

Status: READY FOR TEST
