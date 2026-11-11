# ADM-06b: delivery approval (gate 2)

Technical lead, gate 2, 11 November 2026, two rounds. Branch `change/ADM-06b`. Round 1 on local head
`cfd24f8` (pushed head `5d108fe` plus test round 2); round 2 on `e519133` (plus test round 3, docs only).
Read: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md` and
`.github/pull_request_template.md` (both from `origin/claude/cool-heisenberg-mh6zx9`;
neither is on the base), `.claude/agents/tester.md`, and `plan.md` (round 3),
`plan-review.md`, `plan-approval.md` (conditions 1 to 16), `implementation.md` and
`test-report.md` (rounds 1 and 2) in full.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7).

## Decision (final, round 2 of this gate, head `e519133`)

**Approved, with the open items below as conditions.** The record defect that I
sent back in round 1 of this gate (the section after this one) is fixed:

```
$ git log --oneline -1
e519133 ADM-06b: Record test round 3 with the finished CI (APPROVED)
$ git diff --name-only cfd24f8 HEAD
docs/changes/ADM-06b/test-report.md
$ git diff --exit-code cfd24f8 HEAD -- studio api website .github >/dev/null; echo $?
0
$ grep -c "^Verdict:" docs/changes/ADM-06b/test-report.md
1                                   (line 548: "Verdict: APPROVED", end of round 3)
$ git merge-base --is-ancestor 1f53484 HEAD; echo $?      -> 0
$ git merge-base --is-ancestor 3e1fc47 HEAD; echo $?      -> 0
```

- Round 3 records the finished CI on `5d108fe`. Its run and job ids match what I
  read myself (runs `42934036321` and `42934036305`, studio job `130239529364`,
  `28 passed (3.0m)`, E1 `:46` and E2 `:93` passed). Rounds 1 and 2 now end with
  plain result lines, so the file has one verdict line.
- It corrects round 2's "0 warnings" claim with the pre-existing antd
  static-`message` warning I found in the CI log (my note 1 below). That is now
  recorded where it belongs.
- `e519133` has a subject with the prefix, a body saying why, and the trailer
  (B-4).
- Nothing outside `docs/changes/ADM-06b/test-report.md` changed since `cfd24f8`,
  so everything verified below on `cfd24f8` and `5d108fe` still holds for
  `e519133`.
- Condition 6 / P-4: met, as reasoned under "The CI red on `58caf70`" below. No
  further red run is needed.

## Decision (round 1 of this gate, head `cfd24f8`, superseded)

**Sent back, for one record defect only, to the tester. No code change is
asked for.** The code, the tests, the red-first history and the CI evidence are
good enough to approve, and I would approve them as they stand (see "What I
verified").

The defect: gate 2 requires `test-report.md` to end its latest round with
`Verdict: APPROVED`. Round 2 ends `Verdict: PASS` (line 441), and so did round 1.
`PASS` is not one of the three verdict lines in `docs/changes/README.md` ("Verdict
lines") or `.claude/agents/tester.md` (lines 66-71), and `/change` routes on that
line. Round 2 also left "CI green with E1 and E2" (plan 5.4, a planned check) as
Open, because the `studio` run on `5d108fe` was still in progress.

**To clear it:** the tester adds a round 3 to `test-report.md` (or an addendum to
round 2) that reads the finished CI on `5d108fe` (run ids below) and ends with a
valid verdict line. That is a docs-only commit. Then gate 2 again: if nothing else
in the head has changed, it is a re-check of this file, not a new review.

## What I verified myself

Worked in a detached worktree of my own, `/home/user/dh-gate2-adm06b` at `cfd24f8`,
removed afterwards. No push, commit, database, process or port.

### Base and merge order (conditions 2 and 16)

```
$ git rev-parse origin/rebuild/dotnet-platform
1f5348467866a340b34079b54419aee97155288c
$ git merge-base --is-ancestor 1f53484 HEAD; echo $?
0
$ git merge-base --is-ancestor 3e1fc47 HEAD; echo $?
0
$ git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD; echo $?
0
```

`5d108fe` is a merge (parents `721e6e8`, `1f53484`). No pushed commit was
rebased, amended or reordered (`58caf70`, `f1b4215`, `8c4ab16`, `cbff1f1`,
`933b3b9`, `161b5b5` all present in order; condition 12).

### Scope (conditions 8, 13, 14)

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD
 20 files changed: docs/changes/ADM-06b/* (5), studio/e2e/paging.spec.ts,
 studio/src/{content/MediaPicker.tsx, pages/AuditPage.tsx, pages/ContactInboxPage.tsx,
 pages/MediaLibraryPage.tsx, pages/RedirectsPage.tsx, preview/previewData.ts, theme.ts,
 ui/ListPager.tsx, ui/paging.ts}, studio/test/{listPaging.test.tsx, paging.test.ts,
 previewData.test.ts, support/pagedApi.ts}, studio/tsconfig.node.json
$ git diff --name-only origin/rebuild/dotnet-platform HEAD | grep -vE "^(studio/|docs/changes/ADM-06b/)"; echo $?
1                      (nothing outside the change's folders)
$ git diff 1f53484 HEAD -- studio/tsconfig.node.json studio/src/theme.ts | grep -E "^[+-][^+-]"
   theme.ts: + the six-token Pagination entry only (itemBg, itemLinkBg surfaces.card;
             itemActiveBg surfaces.raised; itemActiveColor, itemActiveColorHover
             accent.studio; itemInputBg surfaces.input)
   tsconfig.node.json: the one include line, + "src/ui/paging.ts", nothing else
$ grep -rnE "ResizeObserver|motion" studio/src; echo $?
1
```

Every file is in plan section 4 or condition 13. I read the diff of every `src`
file. One addition is beyond the round-3 plan text: `afterEmptyPage` in
`src/ui/paging.ts` and the removal of the early `setCurrent` calls, from the
tester's two round-1 Minors. Both narrow rules the plan already had (3.1 (4), the
clamp; P-5) rather than add a feature, each has a red commit before its fix, and
they are named as behaviour changes for the owner. I accept them inside the
approved scope.

### Red first (P-4, B-6, G3 rule)

`git log` shows each red commit before its fix:
`58caf70` (e2e only) before `f1b4215` (unit and preview tests) before `8c4ab16`
(fix); `933b3b9` (S12 red) before `161b5b5`; `c15a886` (S13 to S15 red) before
`9ac4d7e`. The tester reproduced the local reds at `f1b4215` (`14 failed | 8 passed (22)`),
`933b3b9` (S12 only) and `c15a886` (`9 failed | 50 passed (59)`). I did not re-run
those reds; I re-ran the green.

### The CI red on `58caf70` and condition 6: met, with the reasoning below

Read from the job log myself (`gh api repos/mohya7/DH-WEBSITE/actions/jobs/130234325372/logs`):
run `42932462397`, head `58caf706`, `pull_request`, created 00:34:51 UTC (before
#49 merged at 00:37:34 UTC), job conclusion `failure`:

```
  ✘   4 e2e/paging.spec.ts:40:1 › ADM-06 inbox: the 51st enquiry is on page 2 and opens (1.5m)
  ✘   5 e2e/paging.spec.ts:87:1 › ADM-06 audit log and redirects: the 51st row is on page 2 (1.5m)
  1) ... Error: locator.click: Test timeout of 90000ms exceeded.
       - waiting for getByRole('navigation', { name: 'Inbox pages', exact: true }).locator('.ant-pagination').getByTitle('2', { exact: true })
       > 74 |   await pageTwo(pager).click();
  2) ... Test timeout of 90000ms exceeded.
       Error: apiRequestContext.delete: Target page, context or browser has been closed
       > 148 |       await request.delete(`${e2eApiOrigin}/api/v1/redirects/${id}`, { headers });
  2 failed
  26 passed (5.6m)
```

- **E1** is named at the pager locator, as condition 6 asks.
- **E2** is named as failed, but Playwright printed the cleanup line, not the
  pager line. I accept it as red at the audit pager, by elimination:
  - The API log for E2 has, in order: login, 51 `POST /api/v1/redirects` (all 201),
    the browser login, the Overview loads (two `GET /api/v1/audit`), the Audit log
    screen's first load (two more), then one last `GET /api/v1/audit` at
    00:38:49.226, about 0.4 s later, which is the Filter request. Nothing follows
    for the remaining ~86 s; there is no `GET /api/v1/redirects`.
  - In `58caf70`'s spec, after Filter (line 117) the only waits that can run to the
    90 s test timeout are `await filtered` (line 120) and
    `pageTwo(auditPager).click()` (line 125). The others (lines 122, 123) are
    `expect`s with the config's 15 s timeout and would have failed at their own
    line. `filtered` was registered before the click and the Filter response
    arrived (200), so the stall is line 125: the missing audit pager.
  - The CI artefact with the trace could not be downloaded from here (the proxy
    refused the storage host), so this rests on the server log and the spec.
- **`ef6fb38` does not need a fresh red.** It adds `timeout: 15_000` to the three
  pager clicks and the two `waitForResponse` calls and changes nothing else
  (`git diff 58caf70 HEAD -- studio/e2e/paging.spec.ts`: five call sites and the
  constant). That brings the spec to plan 5.1's own wording ("not found within
  15 s") and only shortens waits; no assertion, locator, count or colour changed
  (P-6 holds). A red run of `ef6fb38` alone would need it pushed as a head on its
  own, which condition 12 forbids. The same assertions are red at `58caf70` and
  green at `5d108fe`, which is what P-4 and the G3 checklist ask.
- Side effect of the red, harmless: E2's 51 redirects were not deleted in that
  run. They lived only in that CI job's `DigitalHubContent_E2e`.

### The CI green on `5d108fe`

Read myself (`gh api .../commits/5d108fe.../check-runs`, the job log, and the two
runs):

- CI run `42934036321` (`pull_request`, head `5d108fe`, conclusion `success`):
  - `Studio — typecheck, build, end-to-end`, job `130239529364`, `success`; every
    step `success`. Log: `Test Files 10 passed (10)`, `Tests 60 passed (60)`;
    `✓ 4 e2e/paging.spec.ts:46:1 › ADM-06 inbox: the 51st enquiry is on page 2 and opens (4.9s)`,
    `✓ 5 e2e/paging.spec.ts:93:1 › ADM-06 audit log and redirects: the 51st row is on page 2 (7.1s)`,
    `28 passed (3.0m)`, no retry or flaky entry.
  - `API — Release build, migrations, integration tests` (`130239529303`),
    `Website — typecheck, tests, design check, snapshot build`,
    `Website — browser tests, default and consent builds`,
    `Section comparison against feature/interviewer-portal`,
    `Security gate self-test`, `actionlint (every workflow)`: `success`.
  - `Screenshot parity (optional, label "screenshots")`: `skipped` (label not set).
- Security run `42934036305` (`pull_request`, head `5d108fe`, `success`): Semgrep,
  both gitleaks scans, npm audit (studio, website), NuGet audit: `success`
  (condition 7 met on this head). `CodeQL`: `skipped` (private repository, G-10
  Partial).

### Fastest covering suite, re-run at `cfd24f8`

```
$ cd /home/user/dh-gate2-adm06b/studio && npm ci                 -> added 245 packages
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
$ npx tsc -b; echo $?
0
$ npm test; echo $?
 Test Files  10 passed (10)
      Tests  60 passed (60)
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 933ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git status --short
(empty)
```

E1 and E2: NOT RUN here (no SQL Server, no `dotnet`); covered by CI job
`130239529364` above.

### Coverage table rows

Every row of `test-report.md` round 2's coverage table has evidence, except
"CI green with E1 and E2" (Open there); I have supplied that evidence above. The
rows "ADM-06 closed" and "Collection list and overview past 100" (PR body) close
only at merge and in the PR body.

### Open pull requests

```
$ gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open' --jq '.[]|"\(.number) \(.head.ref)"'
51 change/ADM-06b
44 change/GAP-07
```

#44 changes no `studio/` file. No conflict.

### Commits (B-4, B-5)

Every subject has the `ADM-06b:` prefix and is imperative; every commit carries
the attribution trailer. Code commits have bodies that say why. Three records
commits have no body: `d907336`, `5d108fe` (the merge) and `cfd24f8`. Their
subjects say what they are; `5d108fe` is pushed and must not be rewritten. I
accept this, and ask that later records commits carry a one-line why.

## Notes that do not block

1. **antd warning in CI only.** The CI unit-test log shows, on stderr, for
   "after a failed page load, Mark handled reloads the page shown":
   `Warning: [antd: message] Static function can not consume context like dynamic theme.`
   It comes from the static `message.success` already used by
   `ContactInboxPage.tsx` on the base, not from this change, and my local run shows
   no warning. But the records' "0 warnings" checks were piped on stdout only.
   Accepted; the follow-up, if any, belongs to whichever change replaces static
   `message`.
2. **Tester's probe f.** A page 1 that comes back empty with `total > 0` shows an
   empty list with a pager and no error. Today's API cannot produce it, and it does
   not loop. Accepted.

## Open items before the owner is asked (conditions for approval)

These are conditions of this approval, for the integrator:

1. ~~`test-report.md` ends with a valid verdict line.~~ Met at `e519133`.
2. The final head contains `1f53484` and `3e1fc47` (both `--is-ancestor` 0, quoted
   above for `e519133`); re-quote if the base moves and is merged again.
3. **CI green on the final pushed head.** The head will move past `5d108fe`
   (`cfd24f8`, `e519133`, and this file once committed). Docs-only commits do not change the code, but
   B-3 and the template's "PR checks are green on the final head" ask for the run
   ids on that head. Quote them in the PR body.
4. **PR body.** Replace the current draft text with the description below. In
   particular:
   - remove "Do not merge before #49 (ADM-06a)." and the "holds only the
     end-to-end red test" paragraph; the first line becomes "#49 merged as
     `1f53484`; included in this head." (plan 3.5);
   - the "For ADM-08" section (condition 4);
   - the "Behaviour changes for the owner" section (condition 15), with all three
     changes;
   - the red and green run ids.
5. Mark the pull request ready for review only after 1 to 4.
6. The owner's merge confirmation, under `AGENTS.md`. If the owner objects to any
   of the three behaviour changes, the change goes back to the architect ("opening
   counts as a submit" is the ready alternative for the picker).
7. After the merge, the integrator re-runs the suites on `rebuild/dotnet-platform`
   (`AGENTS.md`). ADM-06 closes then (ADM-06a and ADM-06b both merged).

## Definition of Done (template), as of `e519133`

| Box | Can be ticked truthfully? |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes. Audit ADM-06 bullets (inbox, audit, media, picker, preview loader) plus redirects (plan 3.4); collection list moved to ADM-08 |
| Code follows the engineering standards | Yes. API calls through `request` in `http.ts` (A-12); shared pure helpers; fail closed in the preview loader and the screens (P-5) |
| No new prohibited constructs | Yes. No untyped values in `src`, no direct `fetch`, no config reads; shims test-only |
| Every new or changed route has a guard | Yes, vacuously: no route changed; the audit log still loads only for admins and the API enforces `studio-admin` |
| Tests exist for the behaviour changed; every security fix has a regression test | Yes for tests (S1 to S15, U1 to U4, P1 to P3, E1, E2). Changed-line coverage: no gate exists yet (G-8 Gap) and none was measured; say so |
| PR checks green on the final head (run ids) | **Open.** Green on `5d108fe` (runs `42934036321`, `42934036305`); the final head will be later |
| Independent code review run; findings fixed or accepted | Yes. Plan review rounds 1 to 3, tester rounds 1 to 3 (two Minors fixed), this gate |
| Reviewed by someone other than the author | Yes, by pipeline roles; the owner's review is still to come |
| Rollback understood | Yes. Revert the PR; no migration or stored data |
| Deployment note | Until Phase D: the integrator merges into `rebuild/dotnet-platform` and re-runs the suites after the merge. **Open** until then |

Governance boxes: `AGENTS.md` coverage table or phase document: not updated (the
change's own coverage tables are in `docs/changes/ADM-06b/`); `docs/deferred-items.md`:
no exception; documentation: the records in `docs/changes/ADM-06b/`.

## Draft pull request description

```markdown
#49 merged as `1f53484`; included in this head.

## What and why

ADM-06b is the Studio half of admin audit finding ADM-06, "paging is broken on
every list endpoint" (Blocker, track G3, batch G3-1). ADM-06a (#49, `1f53484`)
fixed the API binding of `page` and `pageSize`. Before this change, only the
newest 50 enquiries and audit entries, 48 library images and 24 picker images
could be reached, and the preview loader could repeat items.

This change:
- adds a pager to the inbox, the audit log, the redirects screen, the media
  library and the image picker, with the existing page sizes (50, 50, 50, 48, 24);
- keeps the submitted search or filters apart from what is typed, so page clicks
  page through what is on screen;
- reloads the current page after a change, and goes to the new last page once if
  that page has emptied;
- keeps the first occurrence of each row in the preview loader, and fails with
  its existing error when a list does not page (fail closed, P-5);
- gives antd's `Pagination` a token-only theme entry, so the pager stays on the
  navy surfaces (`docs/phase-b-studio.md`, "need `components` overrides").

Plan, reviews, gate approvals, implementation record and test reports:
`docs/changes/ADM-06b/`.

## Scope and boundaries

In scope: `studio/src/ui/paging.ts`, `studio/src/ui/ListPager.tsx`,
`studio/src/theme.ts` (the `Pagination` entry only), `ContactInboxPage.tsx`,
`AuditPage.tsx`, `RedirectsPage.tsx`, `MediaLibraryPage.tsx`,
`content/MediaPicker.tsx`, `preview/previewData.ts`, one `include` entry in
`studio/tsconfig.node.json`, and the tests (`test/listPaging.test.tsx`,
`test/paging.test.ts`, `test/previewData.test.ts`, `test/support/pagedApi.ts`,
`e2e/paging.spec.ts`).

Out of scope: every `api/` file (ADM-06a); the collection list and the Overview
counts (see "For ADM-08"); typeahead searches and `AppShell` counts; inbox tiles
(ADM-21); audit filters (ADM-15); media Replace and thumbnails, and a media
end-to-end test past page 1 (ADM-16); package files, other tsconfig files, test
and e2e config, harness and workflows.

## Security impact

None to routes, policies, secrets or dependencies. The screens call the same
routes through `studio/src/api/http.ts` and add only `page` and `pageSize`,
within the API's limits. Rows are rendered as React text, as before. The preview
loader fails closed on a list that does not page. `npm audit` (studio): 0.

## Tests and evidence

- Red first:
  - `58caf70` (end-to-end only) pushed alone, as the owner chose ("Yes, red test
    first like #49", Mohamed Elbadry, 11 November 2026, project thread). CI run
    `42932462397`, job `130234325372` "Studio — typecheck, build, end-to-end":
    `failure`, "2 failed, 26 passed". E1 failed at the inbox pager
    (`paging.spec.ts:74`, waiting for page "2" in "Inbox pages"). E2 hit the
    90 s test timeout at the audit-log pager; Playwright reported the cleanup's
    closed-context error at `:148`. The API log (51 redirect creates, the Filter
    request, no redirects request) places the stall at the audit pager click.
    `ef6fb38` then gave the pager clicks and response waits a 15 s timeout, so a
    missing pager fails at its own line; no assertion changed.
  - Unit and preview tests red locally before each fix: `f1b4215` (14 failed:
    S1 to S12, P2, P3, and the helpers not yet present), `933b3b9` (S12),
    `c15a886` (9 failed: failed-load and at-most-once tests).
- Green on `5d108fe` (this head's code):
  - CI run `42934036321`: "Studio — typecheck, build, end-to-end" job
    `130239529364` `success` (Vitest `60 passed (60)`; Playwright `28 passed (3.0m)`,
    including `paging.spec.ts:46` inbox and `paging.spec.ts:93` audit log and
    redirects); API job `130239529303` `success`; website jobs, section
    comparison, security gate self-test and actionlint `success`; screenshot
    parity `skipped` (optional label).
  - Security run `42934036305`: Semgrep, gitleaks (both), npm audit (studio,
    website), NuGet audit `success`; CodeQL `skipped` (private repository).
  - Locally: `npx tsc -b` 0; `npm test` 60 passed; `npm run build` 0 with the
    preview design check; lockfile unchanged after `npm ci`.
- Final head `<sha>`: CI run `<id>`, security run `<id>` — to be filled in.
- Media past page 1 end to end: NOT RUN by design (upload limit of 20 an hour in
  the e2e harness); covered by Vitest S9 to S12 and ADM-06a's
  `Media_list_returns_page_two`; belongs to ADM-16.
- Final head contains #49 and #50: `git merge-base --is-ancestor 1f53484 HEAD` 0,
  `git merge-base --is-ancestor 3e1fc47 HEAD` 0.

## Owner decisions

- O-ADM06B-1: "Yes, red test first like #49" (Mohamed Elbadry, 11 November 2026,
  project thread).

### Behaviour changes for the owner

Not yet accepted by the owner; please confirm or object:
1. The image picker now reopens with the last submitted search; text typed but not
   submitted before closing is cleared.
2. After a page fails to load, the pager stays on the page whose rows are shown,
   next to the error.
3. If the server reports rows on a page it then returns empty, the screen shows its
   "could not be loaded" message once instead of asking again.

## For ADM-08

The Studio's collection list and the Overview counts are not paged by this
change. Past 100 items in one collection, these lists drop rows silently:
- `studio/src/pages/CollectionListPage.tsx:63`: `canReorder` requires
  `page.total === page.items.length`, so reordering needs the whole set. Paging
  this screen needs a new reorder design, which ADM-08 owns.
- `studio/src/pages/CollectionListPage.tsx:65-69`: published and draft counts are
  computed from the loaded items.
- `studio/src/pages/CollectionListPage.tsx:76`: `pageSize: "100"`, one page only.
- `studio/src/pages/OverviewPage.tsx:28`: `pageSize=100` per collection, for the
  Overview counts.
Today's content is far below the cap (at most 9 items in a collection).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no route changed)
- [x] Tests exist for the behaviour changed (changed-line coverage: no gate yet, G-8; not measured)
- [ ] PR checks are green on the final head (run IDs quoted) — tick when the final head's runs are in
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author (pipeline roles); owner review pending
- [x] Rollback is understood: revert this PR; no schema or data change
- [ ] Deployment note: the integrator merges into rebuild/dotnet-platform and re-runs the suites after the merge

## Review findings accepted

- Tester probe f: an empty page 1 with `total > 0` shows an empty list with no
  error; today's API cannot produce it, and it does not loop.
- Three records commits (`d907336`, `5d108fe`, `cfd24f8`) have no body; their
  subjects say what they are.
- CI shows a pre-existing antd warning about the static `message` function in one
  unit test; not from this change.

## Governance

- [x] Coverage tables updated (`docs/changes/ADM-06b/`)
- [x] `docs/deferred-items.md`: no exception
- [x] Documentation updated (`docs/changes/ADM-06b/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
