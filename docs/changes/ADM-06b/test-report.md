# ADM-06b: test report

Tester: Claude Code (tester role), 11 November 2026. Plan `plan.md` round 3; gate 1
`plan-approval.md` (conditions 1 to 16, `Verdict: APPROVED`); `implementation.md`
round 3, `Status: READY FOR TEST`.

## Round 1

- **Commit tested:** `0558ebd` (ADM-06b: Record round 3 of the implementation). Red
  commits checked: `933b3b9` (4a) and `f1b4215` (commit 2).
- **Where:** a detached worktree of my own, `/home/user/dh-test-adm06b`
  (`git -C /home/user/dh-change-adm06b worktree add --detach /home/user/dh-test-adm06b 0558ebd`).
  The developer's worktree and branch were not touched. Nothing was committed,
  pushed, rebased or amended. No source, test, lockfile or workflow was edited (one
  temporary probe test file was created in the detached worktree for the edge
  cases below and deleted; `git status --short` empty afterwards).
- **Databases and ports:** none used. No SQL Server or `dotnet` in this container;
  no process started, no port used. `DigitalHubContent` not touched.

### 1. Setup (B-7)

```
$ cd /home/user/dh-test-adm06b/studio && npm ci          -> exit 0, "found 0 vulnerabilities"
$ git diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
```

Fresh `node_modules` installed in the tester's worktree; the lockfile is unchanged.

### 2. Red tests were red

**Commit 2, `f1b4215`** (plan 5.3, "After commit 2"):

```
$ npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts      -> exit 1
 FAIL  test/paging.test.ts [ test/paging.test.ts ]
 Error: Cannot find module '../src/ui/paging' imported from .../studio/test/paging.test.ts
 FAIL  (12x) test/listPaging.test.tsx > ... (S1 to S12, every one)
 TestingLibraryElementError: Unable to find an element with the title: 2.      (12 occurrences)
 FAIL  test/previewData.test.ts > published lists across pages > fails with a clear error when the list ignores the page
 AssertionError: promise resolved "{ collections: { …(7) }, …(2) }" instead of rejecting
 FAIL  test/previewData.test.ts > published lists across pages > shows a row once when it shifts across a page boundary
 AssertionError: expected [ 'svc-001', 'svc-002', …(249) ] to have a length of 250 but got 251
 Test Files  3 failed (3)
      Tests  14 failed | 8 passed (22)
$ npx vitest run test/listPaging.test.tsx | grep -ciE "ResizeObserver is not|matchMedia"
0
```

Every S test fails at the missing pager item, P2 and P3 fail on the defect's shape,
P1 passes, the helpers fail to load: as plan 5.1 and 5.3 say. No shim error.

**Commit 4a, `933b3b9`** (condition 11):

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/listPaging.test.tsx; echo $?
     × picker opens on page 1 1284ms
 FAIL  test/listPaging.test.tsx > media picker paging > picker opens on page 1
AssertionError: expected 'Image 02' to be '' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
1
$ npm test
 Test Files  1 failed | 9 passed (10)
      Tests  1 failed | 49 passed (50)
```

S12 is the only failure, on the search box still showing the typed term; `tsc -b`
exit 0. As condition 11 requires.

### 3. Test plan at the head, `0558ebd`

```
$ npx tsc -b; echo $?
0
$ npm test; echo $?
 Test Files  10 passed (10)
      Tests  50 passed (50)
0
$ npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts
 Test Files  3 passed (3)
      Tests  25 passed (25)
$ npx vitest run test/listPaging.test.tsx | grep -ciE "warning|not wrapped in act|unhandled"
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
(!) Some chunks are larger than 500 kB after minification.   (existing warning)
✓ built in 979ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ git status --short
(empty)
```

- **E1, E2 (`studio/e2e/paging.spec.ts`): NOT RUN locally.** No SQL Server and no
  `dotnet` here; the harness needs `DigitalHubContent_E2e`. Covered by CI job
  `studio`, "Studio — typecheck, build, end-to-end", on PR #51. At the time of
  testing, that check run on `58caf70` (id `130234325372`) was `in_progress`, so
  the CI red is not yet evidence (condition 6). Every other check run on
  `58caf70` was `success` or `skipped`.
- `api/` (`dotnet test -c Release`) and `website/` commands: NOT RUN, no file in
  either changed (`git diff --name-only f171f7a HEAD` lists only `studio/` and
  `docs/changes/ADM-06b/`). Covered by CI jobs "API — Release build, migrations,
  integration tests" and "Website — typecheck, tests, design check, snapshot
  build" (both `success` on `58caf70`).

### 4. Scope and conditions

```
$ git diff --name-only f171f7a HEAD | grep -vE "^(studio/|docs/changes/ADM-06b/)"
(no output)
$ git diff f171f7a HEAD -- studio/tsconfig.node.json | grep -E "^[+-] "
-  "include": [..., "src/content/model.ts", "../website/src/design/folder.ts", ...],
+  "include": [..., "src/content/model.ts", "src/ui/paging.ts", "../website/src/design/folder.ts", ...],
$ grep -rnE "ResizeObserver|motion" studio/src
(no output)
```

- Studio diff from `f171f7a`: 15 files, exactly plan section 4 plus the one
  `tsconfig.node.json` entry (condition 13). No `package*.json`, other tsconfig,
  `vitest.config.ts`, `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`,
  workflow or `api/` change (condition 8).
- `theme.ts`: only the six-token `Pagination` entry (condition 8).
- Shims (`matchMedia`, `ResizeObserver`, `motion: false`) only in
  `studio/test/listPaging.test.tsx` (condition 14). `App.tsx`'s `ConfigProvider`
  is unchanged.
- E1/E2 colour checks use `toHaveCSS` after `page.mouse.move(0, 0)` (condition 5).
- "For ADM-08" section present in `implementation.md` section 6 naming
  `CollectionListPage.tsx:63`, `:65-69`, `:76`, `OverviewPage.tsx:28`
  (condition 4); PR body still to carry it.
- "Behaviour changes for the owner" note present in `implementation.md` section 0
  (condition 15); PR body still to carry it.
- PR #51 is a draft, head `58caf70`, body's first content line "Do not merge
  before #49 (ADM-06a)." (condition 2).

### 5. Security

| Check | Command | Result |
| --- | --- | --- |
| npm audit, full tree | `cd studio && npm audit --audit-level=high` | exit 0, "found 0 vulnerabilities" |
| npm audit gate script | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh studio` | exit 0, "studio: 0 finding(s) at the gate's level; 0 known, 0 new." |
| `run-dotnet-audit.sh` | NOT RUN: no `dotnet`; no `api/` change | CI "NuGet vulnerable packages (api) — High and Critical": `success` on `58caf70` |
| Semgrep | NOT RUN: `semgrep` not installed | CI `security.yml` job "Semgrep (ERROR fails, WARNING reported)": `success` on `58caf70`; must be re-checked on the final head (condition 7) |
| gitleaks | NOT RUN: `gitleaks` not installed | CI `security.yml` jobs "Secret scan (gitleaks, this pull request's commits)" and "(full history)": `success` on `58caf70` |
| Secrets in the diff | `git diff f171f7a HEAD -- studio \| grep -E "^\+" \| grep -iE "password\|secret\|token\|api.?key\|bearer\|connectionstring"` | Only references to the existing e2e-only `e2ePassword` export from `e2e/env.ts` (unchanged file) and a runtime `Bearer ${token}` header; no literal secret added |
| New routes | Read every changed `src` file | None. Same routes through `request` in `src/api/http.ts` (A-12); only `page` and `pageSize` added, within the API's limits (50, 48, 24, 50, 100). Audit log still loads only for `role === "admin"` and shows 403 otherwise |
| Role matrix, host checks, unknown fields, body size, error shape | n/a | No route or API change; unchanged from ADM-06a, which owns the binding |
| Rendering | Read | Rows rendered as React text; no `dangerouslySetInnerHTML` added |
| Preview loader | P1 to P3 | Fails closed with the existing message on a list that does not page (P-5) |

### 6. Beyond the plan (probes)

A temporary probe file (copied header and mocks from `listPaging.test.tsx`, deleted
after the run) exercised the inbox:

```
PROBE-a active= 2 row001 shown= true          (page-2 request returns 500)
PROBE-b 50 pager= false                        (exactly 50 rows: no pager)
PROBE-b 51 pager= true total text= 1–50 of 51  (51 rows: pager, en dash total)
PROBE-c pager= false                           (empty inbox: no pager, no error)
PROBE-d 051 shown= false 110 shown= true       (page 2 held, search submitted meanwhile: search result wins)
PROBE-e requests= 61                           (API answering empty pages with total 120: request loop, stopped only by the probe's own cut-off)
```

b, c and d behave correctly. a and e are findings 1 and 2.

### Findings

1. **Minor. A failed page load leaves the pager on the requested page while the
   previous page's rows stay on screen.**
   - Where: `goTo` in `ContactInboxPage.tsx`, `AuditPage.tsx`, `RedirectsPage.tsx`,
     `MediaLibraryPage.tsx`, `MediaPicker.tsx` calls `setCurrent(pageNumber)` before
     `load`; `load` returns on an error without restoring it.
   - Steps: inbox with 120 enquiries; make `GET /api/v1/contact-requests?...page=2...`
     fail (500); click "2".
   - Expected: the error shows, and the pager stays on the page whose rows are shown
     (1), or the rows are cleared.
   - Actual: the error "Server error" shows, the active pager item is "2", and
     "Enquiry 001" (page 1) is still listed. A following "Mark handled" reloads
     page 2 (`load(applied, current)`).
   - Effect: low; the error text is shown. Not covered by the plan's rules in 3.1 (4).

2. **Minor. The "clamp to the last page" rule has no bound, so an API that answers
   an empty page with `total > 0` makes the screen request forever.**
   - Where: `load` in `ContactInboxPage.tsx`, `RedirectsPage.tsx`,
     `MediaLibraryPage.tsx`: `if (body.items.length === 0 && pageNumber > 1 && body.total > 0) await load(term, lastPage(...))`,
     with no check that the clamped page differs from `pageNumber`.
   - Steps: fake API returning page 1 normally and `{ items: [], total: 120 }` for
     every other page; click "2".
   - Expected: at most one retry on the computed last page, then stop (fail closed,
     P-5), as `previewData.ts` does for its own non-paging case.
   - Actual: 61 list requests in 0.5 s, stopped only by the probe's cut-off.
   - Effect: not reachable with today's API (`AdminStore.cs` and
     `MediaLibrary.cs` compute `total` and `items` from the same query, so a fresh
     request converges). Reachable only with a defective or inconsistent API, which
     is exactly what ADM-06 was about.

No Blocker or Major.

### Open items for gate 2 (not findings against the developer)

- **Base not yet merged in.** ADM-06a (PR #49) was squash-merged into
  `rebuild/dotnet-platform` as `1f53484`. At `0558ebd`:
  `git merge-base --is-ancestor 1f53484 HEAD; echo $?` gives `1`, and
  `git merge-base --is-ancestor 3e1fc47 HEAD; echo $?` gives `1`. The integrator
  brings the base in by `git merge` after the CI red on `58caf70` is confirmed
  (conditions 12 and 16). Gate 2 must quote both checks at `0` on the final head.
- **CI red on `58caf70`** (condition 6): the `studio` check run `130234325372` was
  `in_progress` when tested. Its conclusion `failure`, with E1 and E2 named at the
  pager locator and no other failure, is still to be recorded.
- **CI green** on the final head, E1 and E2 included, plus Semgrep on that head
  (condition 7).
- **PR body:** "For ADM-08" (condition 4) and "Behaviour changes for the owner"
  (condition 15) still to be added; the owner's view on the picker reset is
  pending.

### Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: paging controls on the audit screen | Audit ADM-06, Fix 2 | Verified (unit); e2e NOT RUN | S5, S6 red at `f1b4215`, green at `0558ebd`; E2 in CI `studio` |
| Fix: paging controls on the inbox screen | Audit ADM-06, Fix 2 | Verified (unit); e2e NOT RUN | S1 to S4 red, then green; probes b, c, d; E1 in CI `studio` |
| Fix: paging controls on the media library | Audit ADM-06, Fix 2 | Verified (unit); no e2e by plan | S9, S10 red, then green |
| Media picker reaches images past the newest 24 | Audit ADM-06, bullet 3 | Verified (unit) | S11, S12 red at `f1b4215`, green at head |
| Picker box shows the applied search on reopening | Plan 3.1 (4), S12 round 3 | Verified | S12 sole failure at `933b3b9` (`expected 'Image 02' to be ''`), green at head |
| Studio reaches enquiries past the 50th | Audit ADM-06, bullets 3, 5 | Verified (unit); e2e NOT RUN | S1; E1 in CI |
| Studio reaches audit entries past the 50th | Audit ADM-06, bullet 3 | Verified (unit); e2e NOT RUN | S5; E2 in CI |
| Redirects screen reaches redirects past the 50th | Plan 3.4 | Verified (unit); e2e NOT RUN | S7, S8; E2 in CI |
| Preview loader never repeats items | Audit ADM-06, bullet 4 | Verified | P2, P3 red at `f1b4215` (resolved instead of rejecting; 251 rows), green at head; P1 green |
| Pager follows the navy look | `phase-b-studio.md` 480, 501 | Code verified; assertions NOT RUN | `theme.ts` six tokens only; E1/E2 `toHaveCSS` in CI `studio` |
| Out-of-order responses | Plan 3.1 (1), S3 | Verified | S3 green; probe d |
| Clamp after a delete | Plan 3.1 (4), S8 | Verified, with Finding 2 | S8 green; probe e |
| Regression tests shown failing before the fix | G3 checklist | Verified locally; E1/E2 CI red pending | Section 2; CI run `130234325372` in progress |
| `tsc -b` and `npm run build` pass | Plan 5.3; condition 13 | Verified | Section 3, exit 0 both |
| Lockfile unchanged after `npm ci` | B-7 | Verified | `git diff --exit-code` exit 0 |
| Scope (conditions 8, 13) | Gate 1 | Verified | Section 4 |
| Shims test-only (condition 14) | Gate 1 | Verified | `grep -rnE "ResizeObserver\|motion" studio/src`: no output |
| No new route, no secret, no new dependency | Plan 6 | Verified | Section 5 |
| npm audit (studio) | Tester checklist | Verified | exit 0, 0 vulnerabilities; gate script 0 new |
| Semgrep, gitleaks, dotnet audit | `security.yml` | NOT RUN locally | Tools not installed; CI jobs `success` on `58caf70` |
| Collection list and overview past 100 | Plan 3.4 | Moved to ADM-08 (checked) | `implementation.md` section 6; PR body pending |
| Final head contains `1f53484` (#49) and `3e1fc47` | Conditions 2, 16 | Open, for gate 2 | Both `--is-ancestor` give 1 at `0558ebd` |
| ADM-06 closed | ADM-06a 3.3 | Open | Needs this change merged |

Two Minors; the CI red and green and the base merge are open for gate 2.

Round 1 result: no Blocker or Major (two Minors). Superseded by Round 3 below, which holds the file's only verdict line.

## Round 2

- **Commit tested:** `5d108fe` (ADM-06b: Merge rebuild/dotnet-platform (with #49
  and #50) into the change branch). New since round 1: `d907336` (round 1 report),
  `c15a886` (red), `9ac4d7e` (fix), `ef6fb38` (e2e timeouts), `721e6e8` (records),
  `5d108fe` (merge of `1f53484`).
- **Where:** a fresh detached worktree, `/home/user/dh-test-adm06b-r2`
  (`git -C /home/user/dh-change-adm06b worktree add --detach /home/user/dh-test-adm06b-r2 5d108fe`),
  removed afterwards. Nothing committed, pushed or edited apart from this file. A
  temporary probe test was created and deleted (`git status --short` empty). No
  database, no port, no process started.

### 1. Base and merge

```
$ git merge-base --is-ancestor 1f53484 HEAD; echo $?
0
$ git merge-base --is-ancestor 3e1fc47 HEAD; echo $?
0
$ git show 5d108fe -s --format=%P
721e6e87acf679ed1f32589e9bc6fcc8a2fece3e 1f5348467866a340b34079b54419aee97155288c
$ git diff --stat 721e6e8 5d108fe -- studio
(no output)
$ git diff --name-only 721e6e8 5d108fe   vs   git diff --name-only f171f7a 1f53484
identical lists (diff exit 0): the merge brings exactly the base's files
$ git diff --name-only f171f7a 721e6e8 | grep -Fxf <base files>
(no output, exit 1): no file changed on both sides
$ git diff --name-only 1f53484 5d108fe | grep -vE "^(studio/|docs/changes/ADM-06b/)"
(no output, exit 1): the head differs from the base only in this change's files
```

The merge brought nothing under `studio/` and no file that ADM-06b changes.
Conditions 2 and 16 (both `--is-ancestor` checks 0) are met at `5d108fe`.

### 2. Setup

```
$ cd studio && npm ci                                        -> exit 0, "found 0 vulnerabilities"
$ git diff --exit-code -- package-lock.json package.json     -> 0
$ git diff --exit-code f171f7a HEAD -- package-lock.json package.json  -> 0
```

### 3. Red at `c15a886`

```
$ npx tsc -b; echo $?
0
$ npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts
 FAIL ... failed and inconsistent page loads > inbox keeps the pager on the page shown when page 2 fails to load
 FAIL ... > audit log keeps the pager on the page shown when page 2 fails to load
 FAIL ... > redirects keeps the pager on the page shown when page 2 fails to load
 FAIL ... > media library keeps the pager on the page shown when page 2 fails to load
 FAIL ... > media picker keeps the pager on the page shown when page 2 fails to load
AssertionError: expected '2' to be '1' // Object.is equality
 FAIL ... > after a failed page load, Mark handled reloads the page shown
AssertionError: expected '2' to be '1' // Object.is equality
 FAIL ... > inbox jumps to the last page at most once when pages come back empty with rows promised
 FAIL ... > redirects jumps to the last page at most once when pages come back empty with rows promised
 FAIL ... > media library jumps to the last page at most once when pages come back empty with rows promised
AssertionError: expected 10 to be less than or equal to 2
 Test Files  1 failed | 2 passed (3)
      Tests  9 failed | 25 passed (34)
$ npm test
 Test Files  1 failed | 9 passed (10)
      Tests  9 failed | 50 passed (59)
```

Exactly the nine new tests fail, each on the defect from round 1 (active pager
item "2" instead of "1"; more than two list requests). The 50 earlier tests pass.

### 4. Green at the head, `5d108fe`

```
$ npx tsc -b; echo $?
0
$ npm test; echo $?
 Test Files  10 passed (10)
      Tests  60 passed (60)
0
$ npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts
 Test Files  3 passed (3)
      Tests  35 passed (35)
$ npx vitest run test/listPaging.test.tsx | grep -ciE "warning|not wrapped in act|unhandled"
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
✓ built in 1.02s
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
$ npm audit --audit-level=high      -> found 0 vulnerabilities
$ grep -rnE "ResizeObserver|motion" src; echo $?
1
$ git status --short
(empty)
```

60 = 50 + the nine new render tests + one new helper test (`afterEmptyPage`, U4,
added in `9ac4d7e` with the helper; like U1 to U3 it tests a new helper, and the
behaviour it guards is shown red by the three "at most once" tests in `c15a886`).

### 5. Round 1 findings, re-run

The round 1 probes, run again at `5d108fe` (temporary file, deleted afterwards):

```
PROBE-a active= 1 row001 shown= true                                   (was: active= 2)
PROBE-b 50 pager= false / 51 pager= true 1–50 of 51                    (unchanged, correct)
PROBE-c pager= false error= none                                       (unchanged, correct)
PROBE-d 051 shown= false 110 shown= true                               (unchanged, correct)
PROBE-e requests= 2 error= Contact requests could not be loaded. active= 1   (was: 61 requests)
PROBE-f requests= 1 error= none pager= true                            (new, see observation)
```

- **Finding 1 (pager moves before the page arrives): fixed.** `goTo`,
  `submitSearch`, `filter`, `afterUpload` and the picker's opening no longer call
  `setCurrent`; only `load` does, after a successful response. All five screens
  are covered by the new `it.each` test, and Mark handled by its own test.
- **Finding 2 (unbounded jump to the last page): fixed.** `afterEmptyPage` in
  `src/ui/paging.ts` allows one jump, and only to a page lower than the one asked;
  otherwise the screen shows its load error (P-5). Probe e: two requests, then the
  error, pager still on 1.
- **Observation, not a finding (probe f):** a page 1 that comes back empty with
  `total > 0` is shown as an empty list with a pager and no error
  (`afterEmptyPage` returns "show" for page 1). This only happens with an API whose
  `total` and `items` disagree, which today's API cannot produce (round 1,
  Finding 2), and it does not loop. Left to the developer's judgement.

### 6. E2E change, `ef6fb38`

`git show ef6fb38 -- studio/e2e` adds a `stepTimeout = 15_000` constant and passes
it to the three `pageTwo(...).click()` calls and the two `page.waitForResponse`
calls. No `expect`, locator, value, count or colour changed; nothing removed. 15 s
equals the config's `expect` timeout (`playwright.config.ts:12`) and is below the
90 s test timeout (`:11`), so a missing pager now fails at its own line and the
`finally` cleanup still runs. It only shortens waits; it weakens no assertion.

- **E1, E2: NOT RUN locally** (no SQL Server, no `dotnet`). Covered by CI job
  `studio`, "Studio — typecheck, build, end-to-end", on PR #51.

### 7. CI, as read at the time of this round

- `58caf70`: "Studio — typecheck, build, end-to-end" `completed / failure`. Per the
  developer (`ef6fb38` message, run 42932462397), E2's failure was reported as the
  cleanup's closed-context error after the 90 s timeout, not at the pager locator.
  Whether that red satisfies condition 6 ("E1 and E2 named at the pager locator")
  is for gate 2; I did not read the run log.
- `5d108fe`: Semgrep, both gitleaks scans, both npm audits, NuGet audit,
  actionlint, website jobs: `success`. "Studio — typecheck, build, end-to-end",
  "API — Release build, migrations, integration tests" and "Section comparison":
  `in_progress`. The green with E1 and E2 is still to be recorded (condition 7
  Semgrep is green on this head).

### Findings

None. Round 1 Findings 1 and 2 are fixed and verified.

### Open items for gate 2 (not findings against the developer)

- The `studio` CI result on `5d108fe`, E1 and E2 included.
- Whether the `58caf70` red (E2 reported at the cleanup error) meets condition 6.
- PR body: "For ADM-08" (condition 4), "Behaviour changes for the owner"
  (condition 15), and the first line changed from "Do not merge before #49" now
  that #49 is in the head (plan 3.5).

### Coverage table (round 2)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: paging controls on the audit screen | Audit ADM-06, Fix 2 | Verified (unit); e2e NOT RUN | S5, S6 and the failed-load test green at `5d108fe`; E2 in CI `studio` on `5d108fe` |
| Fix: paging controls on the inbox screen | Audit ADM-06, Fix 2 | Verified (unit); e2e NOT RUN | S1 to S4, failed-load, Mark handled, at-most-once tests green; probes a to f; E1 in CI |
| Fix: paging controls on the media library | Audit ADM-06, Fix 2 | Verified (unit); no e2e by plan | S9, S10, failed-load, at-most-once green |
| Media picker reaches images past the newest 24 | Audit ADM-06, bullet 3 | Verified (unit) | S11, S12, failed-load green |
| Picker box shows the applied search on reopening | Plan 3.1 (4), S12 | Verified | Round 1 section 2; S12 green at `5d108fe` |
| Studio reaches enquiries, audit entries, redirects past the 50th | Audit ADM-06, bullets 2, 3, 5 | Verified (unit); e2e NOT RUN | S1, S5, S7 green; E1, E2 in CI |
| Preview loader never repeats items | Audit ADM-06, bullet 4 | Verified | P1 to P3 green at `5d108fe` (red shown in round 1) |
| Pager follows the navy look | `phase-b-studio.md` 480, 501 | Code verified; assertions NOT RUN | `theme.ts` unchanged since round 1; E1/E2 `toHaveCSS` in CI |
| Round 1 Finding 1: pager moves only when the page arrives | Round 1 | Fixed, verified | 6 tests red at `c15a886` (`expected '2' to be '1'`), green at head; probe a |
| Round 1 Finding 2: jump to the last page at most once | Round 1 | Fixed, verified | 3 tests red at `c15a886` (`expected 10 to be less than or equal to 2`), green at head; U4; probe e |
| Red at `c15a886` is exactly the nine new tests | Coordinator round 2 | Verified | Section 3: `9 failed | 50 passed (59)` |
| E2E change adds only timeouts | Coordinator round 2 | Verified | Section 6 |
| Merge `5d108fe` brings nothing that conflicts | Coordinator round 2 | Verified | Section 1 |
| Final head contains `1f53484` (#49) and `3e1fc47` (#50) | Conditions 2, 16 | Verified | Both `--is-ancestor` exit 0 |
| `tsc -b` and `npm run build` pass | Plan 5.3; condition 13 | Verified | Section 4 |
| Lockfile unchanged | B-7 | Verified | Section 2 |
| Scope (conditions 8, 13) and shims test-only (14) | Gate 1 | Verified | Head differs from base only in `studio/` and `docs/changes/ADM-06b/`; no shim in `src` |
| npm audit (studio) | Tester checklist | Verified | 0 vulnerabilities |
| Semgrep, gitleaks, dotnet audit | `security.yml` | NOT RUN locally (tools absent) | CI `success` on `5d108fe` |
| Regression tests shown failing before the fix | G3 checklist | Verified locally; E1/E2 CI red for gate 2 | Round 1 section 2; this round section 3; `58caf70` `studio` `failure` (section 7) |
| CI green with E1 and E2 | Plan 5.4 | Open | `studio` on `5d108fe` in progress |
| Collection list and overview past 100 | Plan 3.4 | Moved to ADM-08 | `implementation.md` section 6; PR body pending |
| ADM-06 closed | ADM-06a 3.3 | Open | Needs this change merged |

Round 2 result: no findings; E1 and E2 still open in CI. Superseded by Round 3 below.

## Round 3 (addendum: CI on `5d108fe`, and the verdict line)

Docs only. No code was re-run locally: the head is still `5d108fe`, the commit
tested in round 2. This round records the finished CI for E1 and E2 and fixes a
record defect found at gate 2: rounds 1 and 2 ended with `Verdict: PASS`, which is
not one of the lines allowed by `docs/changes/README.md` ("Verdict lines") and
`.claude/agents/tester.md`. Those two lines are now plain round results, and the
file's only verdict line is at the end of this section.

### CI, read from the GitHub API

```
$ gh api repos/mohya7/DH-WEBSITE/actions/runs/42934036321 --jq '{name,head_sha,status,conclusion,event}'
{"conclusion":"success","event":"pull_request","head_sha":"5d108fe574a982c6849234f253e0b6533cb5c084","name":"CI","status":"completed"}
$ gh api repos/mohya7/DH-WEBSITE/actions/runs/42934036321/jobs --jq '.jobs[]|"\(.id) | \(.name) | \(.conclusion)"'
130239528805 | Website — typecheck, tests, design check, snapshot build | success
130239529274 | Website — browser tests, default and consent builds | success
130239529303 | API — Release build, migrations, integration tests | success
130239529364 | Studio — typecheck, build, end-to-end | success
130239947654 | Section comparison against feature/interviewer-portal | success
130239948973 | Screenshot parity (optional, label "screenshots") | skipped
$ gh api repos/mohya7/DH-WEBSITE/actions/runs/42934036305 --jq '{name,head_sha,status,conclusion}'
{"conclusion":"success","head_sha":"5d108fe574a982c6849234f253e0b6533cb5c084","name":"Security","status":"completed"}
  jobs: Security gate self-test, Secret scan (gitleaks, this pull request's commits),
  npm audit (studio), NuGet vulnerable packages (api), npm audit (website),
  Semgrep (ERROR fails, WARNING reported), Secret scan (gitleaks, full history): all success
```

Studio job log (`gh api repos/mohya7/DH-WEBSITE/actions/jobs/130239529364/logs`,
readable through the proxy; colour codes stripped):

```
 Test Files  10 passed (10)
      Tests  60 passed (60)
> tsc -b && vite build && node scripts/check-preview-design.ts
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
  ✓   4 e2e/paging.spec.ts:46:1 › ADM-06 inbox: the 51st enquiry is on page 2 and opens (4.9s)
  ✓   5 e2e/paging.spec.ts:93:1 › ADM-06 audit log and redirects: the 51st row is on page 2 (7.1s)
  28 passed (3.0m)
```

No `failed` or `flaky` line in the log. The run's artifacts include
`studio-e2e-report` (691577 bytes), which holds E1's and E2's screenshots. The
coordinator's figures match what I read.

- **E1 and E2: passed in CI** on `5d108fe`, a head that contains #49 (`1f53484`)
  and #50 (`3e1fc47`), round 2 section 1. That includes their `toHaveCSS` colour
  checks on the inbox pager and on the audit table's pager (plan 3.2, condition 5).
  Not run locally (no SQL Server, no `dotnet`).
- **Semgrep green on the final head** (condition 7): yes, job `130239752170`.

### Correction to round 2

Round 2 section 4 quoted `grep -ciE "warning|not wrapped in act|unhandled"` as `0`
for the local `listPaging.test.tsx` run. The CI log shows a stderr block on the
new test "after a failed page load, Mark handled reloads the page shown":
`Warning: [antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.`
and jsdom's `Not implemented: Window's getComputedStyle() method: with pseudo-elements`.
The warning comes from the existing static `message.success("Marked handled.")`
call in `ContactInboxPage.tsx`, which is older than ADM-06b. antd prints it once
per process, and the test passes. It is an observation, not a finding: it fails no
check and is not caused by this change. Not an act warning or an unhandled error.

### Still open, outside the tester's records

- The PR #51 body: "For ADM-08" (condition 4), "Behaviour changes for the owner"
  (condition 15), and the first line, which should no longer say "Do not merge
  before #49" now that #49 is in the head.
- Whether the red on `58caf70` (E2 reported at the cleanup error) meets
  condition 6 is for gate 2 (round 2 section 7).
- The owner's view on the picker reset (condition 15).

### Findings

None. Round 1 Findings 1 and 2 stay fixed (round 2 section 5).

### Coverage table (round 3, final)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: paging controls on the audit screen | Audit ADM-06, Fix 2 | Verified | S5, S6 and the failed-load test green (round 2); E2 passed in CI run 42934036321, job 130239529364 |
| Fix: paging controls on the inbox screen | Audit ADM-06, Fix 2 | Verified | S1 to S4 and the new tests green (round 2); E1 passed in CI (same job) |
| Fix: paging controls on the media library | Audit ADM-06, Fix 2 | Verified (unit); no e2e by plan | S9, S10 and the new tests green; media e2e belongs to ADM-16 |
| Media picker reaches images past the newest 24 | Audit ADM-06, bullet 3 | Verified (unit) | S11, S12 green |
| Picker box shows the applied search on reopening | Plan 3.1 (4), S12 | Verified | Red at `933b3b9` (round 1), green at `5d108fe` |
| Studio reaches enquiries past the 50th | Audit ADM-06, bullets 3, 5 | Verified | S1; E1 `✓ e2e/paging.spec.ts:46:1` in CI |
| Studio reaches audit entries past the 50th | Audit ADM-06, bullet 3 | Verified | S5; E2 `✓ e2e/paging.spec.ts:93:1` in CI |
| Redirects screen reaches redirects past the 50th | Plan 3.4 | Verified | S7, S8; E2 in CI |
| Preview loader never repeats items | Audit ADM-06, bullet 4 | Verified | P2, P3 red at `f1b4215`, green at `5d108fe`; P1 green |
| Pager follows the navy look | `phase-b-studio.md` 480, 501 | Verified | `theme.ts` six tokens; E1 and E2 `toHaveCSS` passed in CI; screenshots in artifact `studio-e2e-report` |
| Round 1 Finding 1: pager moves only when the page arrives | Round 1 | Fixed, verified | Round 2 sections 3 and 5 |
| Round 1 Finding 2: jump to the last page at most once | Round 1 | Fixed, verified | Round 2 sections 3 and 5 |
| E2E change adds only timeouts | Round 2 | Verified | Round 2 section 6 |
| Merge `5d108fe` brings nothing that conflicts | Round 2 | Verified | Round 2 section 1 |
| Final head contains `1f53484` (#49) and `3e1fc47` (#50) | Conditions 2, 16 | Verified | Both `--is-ancestor` exit 0 (round 2) |
| Regression tests shown failing before the fix | G3 checklist | Verified locally; E1/E2 CI red recorded, adequacy for gate 2 | Round 1 section 2; round 2 section 3; `58caf70` `studio` `failure` |
| `tsc -b`, unit tests and build pass | Plan 5.3; condition 13 | Verified | Local (round 2) and CI: `Tests 60 passed (60)`, preview design match |
| CI green with E1 and E2 | Plan 5.4 | Verified | CI run 42934036321 `success`; Playwright `28 passed (3.0m)` |
| API and website unchanged and green | Plan 5.4 | Verified (CI) | Jobs 130239529303, 130239528805, 130239529274, 130239947654 `success` |
| Lockfile unchanged | B-7 | Verified | Round 2 section 2 |
| Scope (conditions 8, 13) and shims test-only (14) | Gate 1 | Verified | Round 2 section 4 |
| npm audit, Semgrep, gitleaks, NuGet audit | `security.yml`; tester checklist | Verified | Local npm audit 0 (round 2); Security run 42934036305 `success`, Semgrep job 130239752170 |
| Collection list and overview past 100 | Plan 3.4 | Moved to ADM-08 | `implementation.md` section 6; PR body pending (outside these records) |
| ADM-06 closed | ADM-06a 3.3 | Open | Needs this change merged |

Verdict: APPROVED
