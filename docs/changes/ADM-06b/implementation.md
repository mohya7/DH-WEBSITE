# ADM-06b: implementation

Developer, 11 November 2026. Plan: `docs/changes/ADM-06b/plan.md`, round 2.
Gate 1: `plan-approval.md`, `Verdict: APPROVED` with conditions 1 to 10.
Worktree `/home/user/dh-change-adm06b`, branch `change/ADM-06b`, cut from
`f171f7a`, not tracking. Nothing pushed.

**Result: the plan cannot be followed as written at one point (section 1).
`tsc -b` fails on the new `test/paging.test.ts`, and the only fixes are a
`tsconfig.node.json` change (out of scope, condition 8) or a change to the
planned test file. Under condition 10 I stop and send the change back.** Every
other step of the plan is done: the three commits in the plan's order, local red,
and local green for all unit tests, the app type check, the Vite build and the
preview design check.

## 1. Why this goes back to the architect

### What happened

After commit 3 (the fix), `npx tsc -b` failed. Reported here before any fix,
and not fixed:

```
$ cd /home/user/dh-change-adm06b/studio && npx tsc -b; echo $?
test/paging.test.ts(2,48): error TS6307: File '/home/user/dh-change-adm06b/studio/src/ui/paging.ts' is not listed within the file list of project '/home/user/dh-change-adm06b/studio/tsconfig.node.json'. Projects must list all files or use an 'include' pattern.
1
```

`npm run build` runs `tsc -b` first, so it fails the same way (exit 1, same
single error). CI's `studio` job runs `npx tsc -b` before `npm test`, so it would
stop there.

### Why the plan does not hold

Plan 3.1 (1) says `paging.ts` is pure "so it is type-checked with the node config
when its test imports it", and 2.7 says `tsconfig.node.json` "includes
`test/**/*.ts` (so a new `.ts` test file is type-checked)". Both are true, but
`tsconfig.node.json` is a `composite` project, and a composite project refuses a
file that its `include` does not list, even when it is only imported (TS6307).
Its `include` lists only two Studio sources, by name:

```
$ git show f171f7a:studio/tsconfig.node.json | grep -n include
17:  "include": ["vite.config.ts", "vitest.config.ts", "vite/**/*.ts", "scripts/**/*.ts", "test/**/*.ts", "e2e/env.ts", "src/content/siteUrl.ts", "src/content/model.ts", "../website/src/design/folder.ts", "../website/src/design/lock.ts"],
```

So a `.ts` test under `test/` that imports any other file from `src/` fails
`tsc -b`. That is presumably why `test/previewData.test.ts` is in that file's
`exclude`.

Everything else type-checks: `npx tsc -b tsconfig.app.json` exit 0 (screens,
`paging.ts`, `ListPager.tsx`, `theme.ts`, `previewData.ts`); the node project's
only error is the one above; `test/support/pagedApi.ts` imports nothing from
`src` and passes.

### Options for the architect (I chose none of them)

| Option | Change | Cost |
| --- | --- | --- |
| a | Add `"src/ui/paging.ts"` to `tsconfig.node.json` `include`, as `src/content/siteUrl.ts` and `src/content/model.ts` already are for their tests | One line in a file the plan and condition 8 keep untouched. `paging.ts` is pure, so it compiles under the node config (it did: the only error is TS6307) |
| b | Name the test `test/paging.test.tsx` | No config change; Vitest still runs it. It leaves the node project, so the test file is no longer type-checked (as no `.tsx` test is today). Differs from the planned file name |
| c | Add `test/paging.test.ts` to `tsconfig.node.json` `exclude`, as `previewData.test.ts` is | A config change, and the test is not type-checked |

Any of them makes `tsc -b` and `npm run build` pass; I verified that nothing else
fails (section 4). The fix commit `8c4ab16` stays as it is; the chosen option
would be one more commit (or, for b, a rename in commit 2 before anything is
pushed).

### Two smaller deviations, for the same review

These are test-environment shims in `test/listPaging.test.tsx` only, the same kind
as the plan's `matchMedia` stub. I made them because without them the red run
failed for reasons other than the missing pager (condition 10's concern), and I
report them so the architect and the reviewer can accept or reject them:

1. **`ResizeObserver` stub.** The first red run failed S5 and S6 with
   `ReferenceError: ResizeObserver is not defined`
   (`@rc-component/resize-observer`, used by antd `Table`/`DatePicker`). jsdom has
   no `ResizeObserver`. The stub is a class with empty `observe`, `unobserve` and
   `disconnect`.
2. **Motion off for the picker tests.** The first red run failed S11 and S12 with
   `Unable to find an element with the text: Image 001`: the antd `Modal` stayed in
   `ant-zoom-appear-active`, because jsdom never fires `animationend`, so
   `afterOpenChange` (where the picker loads) never ran. S11 and S12 render the
   picker inside `<ConfigProvider theme={{ token: { motion: false } }}>`, antd's
   own switch for motion. The picker's code is unchanged in that respect: it still
   loads in `afterOpenChange`.

With both shims, every S test fails at `getByTitle("2")`, as plan 5.1 says
(section 3).

## 2. Owner decision O-ADM06B-1

Answered. The coordinator relayed it on 11 November 2026: the owner tapped
**"Yes, red test first like #49"** on the decision card asking "For the Studio
paging fix, push the failing browser test first too?" (Mohamed Elbadry,
11 November 2026, project thread).

I pushed nothing. The coordinator said the orchestrator will push the e2e commit
alone after the tester and gate 2. Conditions 2 and 6 (draft pull request whose
first line is "Do not merge before #49 (ADM-06a).", wait for the `studio` check
run on `58caf70` to conclude `failure`) apply to that push.

## 3. Commits

| Order | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 | `58caf70` | ADM-06b: Test that Studio lists reach rows past page 1 end to end | `studio/e2e/paging.spec.ts` |
| 2 | `f1b4215` | ADM-06b: Test the Studio paging controls and the preview loader | `studio/test/listPaging.test.tsx`, `studio/test/support/pagedApi.ts`, `studio/test/paging.test.ts`, `studio/test/previewData.test.ts` |
| 3 | `8c4ab16` | ADM-06b: Add paging controls to the audit, inbox, redirects and media screens | the nine `src` files in section 5 |
| 4 | this file | ADM-06b: Record the implementation and send it back to the architect | `docs/changes/ADM-06b/implementation.md` |

Each subject has the `ADM-06b:` prefix, each body says why, each ends with the
attribution trailer. Paths were staged one by one. Base `f171f7a`; ADM-06a (#49)
is not merged into this branch (plan 3.5: the head must contain it before the
pull request leaves draft).

## 4. Commands and results

### Setup (B-7)

```
$ cd /home/user/dh-change-adm06b/studio && npm ci
found 0 vulnerabilities            (exit 0)
$ git -C /home/user/dh-change-adm06b diff --exit-code -- studio/package-lock.json studio/package.json; echo $?
0
```

Re-run after the fix: still exit 0. The lockfile and `package.json` are unchanged.

### After commit 2 (red)

First run, before the two shims in section 1 (reported, then the shims were
added to the uncommitted test file):

```
$ npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts   (exit 1)
 FAIL  test/listPaging.test.tsx > audit log paging > audit log reaches the 51st entry on page 2
 FAIL  test/listPaging.test.tsx > audit log paging > audit pages through the applied filters and Filter goes back to page 1
ReferenceError: ResizeObserver is not defined
 FAIL  test/listPaging.test.tsx > media picker paging > picker reaches the 25th image and selects it
TestingLibraryElementError: Unable to find an element with the text: Image 001.
 FAIL  test/listPaging.test.tsx > media picker paging > picker opens on page 1
TestingLibraryElementError: Unable to find an element with the text: Image 001.
```

The run as committed in `f1b4215`:

```
$ npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts; echo $?
 FAIL  test/paging.test.ts [ test/paging.test.ts ]
Error: Cannot find module '../src/ui/paging' imported from /home/user/dh-change-adm06b/studio/test/paging.test.ts
 FAIL  test/listPaging.test.tsx > contact inbox paging > inbox reaches the 51st enquiry on page 2
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > inbox pages through the applied search and a new search goes back to page 1
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > inbox keeps the latest page when responses arrive out of order
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > marking an enquiry handled reloads the same page
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > audit log reaches the 51st entry on page 2
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > audit pages through the applied filters and Filter goes back to page 1
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > redirects reach the 51st redirect on page 2
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > deleting the only row of the last page shows the page before
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > media library reaches the 49th image on page 2
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > media library search goes back to page 1
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > picker reaches the 25th image and selects it
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  ... > picker opens on page 1
TestingLibraryElementError: Unable to find an element with the title: 2.
 FAIL  test/previewData.test.ts > published lists across pages > fails with a clear error when the list ignores the page
AssertionError: promise resolved "{ collections: { …(7) }, …(2) }" instead of rejecting
 FAIL  test/previewData.test.ts > published lists across pages > shows a row once when it shifts across a page boundary
AssertionError: expected [ 'svc-001', 'svc-002', …(249) ] to have a length of 250 but got 251
 Test Files  3 failed (3)
      Tests  14 failed | 8 passed (22)
1
```

- `listPaging.test.tsx`: 12 failed, each at the missing pager item, as planned.
  No `matchMedia` or `ResizeObserver` error.
- `previewData.test.ts`: 10 tests, 2 failed (P2, P3). The 8 that pass are the 7
  existing tests and P1. **Count note:** plan 5.3 says "the 8 existing tests";
  the file has 7 (2 `it` plus a 5-row `it.each`). Nothing was removed.
- `paging.test.ts`: fails to load, as planned.

Whole suite at red:

```
$ npm test; echo $?
 ❯ test/previewData.test.ts (10 tests | 2 failed)
 ❯ test/paging.test.ts (0 test)
 ❯ test/listPaging.test.tsx (12 tests | 12 failed)
 Test Files  3 failed | 7 passed (10)
      Tests  14 failed | 33 passed (47)
1
```

Every test outside the three files passed, so commit 2 changed nothing else.

### After commit 3 (green, except `tsc -b`)

```
$ npx vitest run --reporter=verbose test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts; echo $?
 ✓ test/paging.test.ts > paging helpers > lastPage is never below 1
 ✓ test/paging.test.ts > paging helpers > withPage sets page and pageSize and keeps other parameters
 ✓ test/paging.test.ts > paging helpers > latestOnly accepts only the newest ticket
 ✓ test/previewData.test.ts > published revision failures > (7 existing tests)
 ✓ test/previewData.test.ts > published lists across pages > loads every published item across pages, once each
 ✓ test/previewData.test.ts > published lists across pages > fails with a clear error when the list ignores the page
 ✓ test/previewData.test.ts > published lists across pages > shows a row once when it shifts across a page boundary
 ✓ test/listPaging.test.tsx > contact inbox paging > (S1 to S4)
 ✓ test/listPaging.test.tsx > audit log paging > (S5, S6)
 ✓ test/listPaging.test.tsx > redirects paging > (S7, S8)
 ✓ test/listPaging.test.tsx > media library paging > (S9, S10)
 ✓ test/listPaging.test.tsx > media picker paging > (S11, S12)
 Test Files  3 passed (3)
      Tests  25 passed (25)
0
```

25, not the plan's 26, for the count note above (12 + 10 + 3). The log has no
React `act` warning and no unhandled error (`grep -ciE "warning|not wrapped in act|unhandled"`: 0).

Mutation check of S3: with `isLatest` changed to always return true in a scratch
copy of `paging.ts`, S3 failed (`1 failed | 11 skipped`); the file was restored
byte for byte (`cmp`) before commit 3.

```
$ npm test; echo $?
 Test Files  10 passed (10)
      Tests  50 passed (50)
0

$ npx tsc -b; echo $?
test/paging.test.ts(2,48): error TS6307: File '.../studio/src/ui/paging.ts' is not listed within the file list of project '.../studio/tsconfig.node.json'. ...
1                                                   <- section 1

$ npx tsc -b tsconfig.app.json; echo $?
0

$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build; echo $?
(stops in tsc -b with the same TS6307 line)
1                                                   <- section 1

$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npx vite build; echo $?
✓ built in 825ms
0
$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid node scripts/check-preview-design.ts; echo $?
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
0
```

The two steps of `npm run build` after `tsc -b` pass when run alone.

### End-to-end spec: compiled and type-checked, not run

No `tsconfig` includes `studio/e2e/*.spec.ts`. I type-checked every e2e file with
a scratch config outside the repository
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/tsconfig.e2e.json`,
extending `studio/tsconfig.node.json`, `include` `studio/e2e/*.ts`, `lib`
`ES2023` and `DOM`):

```
$ npx tsc -p <scratch>/tsconfig.e2e.json --noEmit; echo $?
0
$ npx tsc -p <scratch>/tsconfig.e2e.json --listFilesOnly | grep studio/e2e/paging
/home/user/dh-change-adm06b/studio/e2e/paging.spec.ts
```

Run at commit 1 and again after commit 3: exit 0 both times.

- **E1, E2 red and green: NOT RUN.** There is no SQL Server in this container and
  no `dotnet` (`npx playwright test --list` stops in `playwright.config.ts` with
  `spawnSync dotnet ENOENT`, from `e2e/env.ts:108`). Covered by CI job `studio`
  ("Studio — typecheck, build, end-to-end"): red on commit `58caf70` alone
  (O-ADM06B-1 is "Yes"; condition 6), green on a final head that contains #49.
- No port was used and no process was started.

### Scope check

```
$ git diff --stat 045b084 HEAD   (before this file)
 studio/e2e/paging.spec.ts             | 151
 studio/src/content/MediaPicker.tsx    |  40
 studio/src/pages/AuditPage.tsx        |  56
 studio/src/pages/ContactInboxPage.tsx |  46
 studio/src/pages/MediaLibraryPage.tsx |  57
 studio/src/pages/RedirectsPage.tsx    |  49
 studio/src/preview/previewData.ts     |  15
 studio/src/theme.ts                   |   8
 studio/src/ui/ListPager.tsx           |  45
 studio/src/ui/paging.ts               |  34
 studio/test/listPaging.test.tsx       | 420
 studio/test/paging.test.ts            |  23
 studio/test/previewData.test.ts       |  63
 studio/test/support/pagedApi.ts       |  16
 14 files changed, 977 insertions(+), 46 deletions(-)
$ git status --short
(empty)
```

Exactly the files in plan section 4. No `package*.json`, `tsconfig*.json`,
`vitest.config.ts`, `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`,
workflow or `api/` file changed.

## 5. What changed, file by file

| File | Plan scope | Change |
| --- | --- | --- |
| `studio/src/ui/paging.ts` | create | `lastPage`, `withPage`, `latestOnly`, no React or antd import |
| `studio/src/ui/ListPager.tsx` | create | `ListPager` (antd `Pagination` in `<nav aria-label>`, `mt-4`, right-aligned; the label type allows only "Inbox pages", "Media library pages", "Image picker pages") and `tablePager`. Shared: `showSizeChanger: false`, `hideOnSinglePage: true`, `showTotal` "`from`–`to` of `total`" |
| `studio/src/theme.ts` | change | `components.Pagination` with the six tokens only (below). Nothing else |
| `studio/src/pages/ContactInboxPage.tsx` | change | typed `search` and `applied`; `current`; `page` + `pageSize=50` through `withPage`; `ListPager` under the cards; search loads page 1; Mark handled reloads the current page, clamped with `lastPage`; `latestOnly`. Tiles unchanged |
| `studio/src/pages/AuditPage.tsx` | change | typed filters and `applied` filters; Filter applies them and loads page 1; `pagination={tablePager(...)}`; `pageSize=50`; `latestOnly`. Filters and columns unchanged |
| `studio/src/pages/RedirectsPage.tsx` | change | as the audit log, with an applied search; Create and Delete reload the current page, clamped |
| `studio/src/pages/MediaLibraryPage.tsx` | change | applied search; `total` kept; `withPage(..., 48)` (the `search` parameter is still always sent, as before); `ListPager` under the grid; Save and Delete reload the current page, clamped; the Upload dialog's close or select loads page 1 |
| `studio/src/content/MediaPicker.tsx` | change | applied search; `total` kept; `withPage(..., 24)`; `ListPager size="small"` between the grid and "Upload"; each opening (`afterOpenChange`) loads page 1 with the applied search; `rememberMedia` still records every loaded item |
| `studio/src/preview/previewData.ts` | change | `published` only: keeps the first occurrence of each id; throws the existing message when a non-empty page adds no new id; stops on unique rows >= total or an empty page |
| `studio/test/support/pagedApi.ts` | create | `pagedBody(rows, path)`; throws for `page < 1` or `> 10000`, `pageSize < 1` or `> 100` |
| `studio/test/paging.test.ts` | create | U1 to U3 |
| `studio/test/listPaging.test.tsx` | create | S1 to S12, with the shims in section 1 |
| `studio/test/previewData.test.ts` | change | new block "published lists across pages", P1 to P3; existing block unchanged |
| `studio/e2e/paging.spec.ts` | create | E1, E2 (below) |

A note for the reviewer on the picker: before this change, reopening it loaded
with whatever was typed in its search box; now it uses the last submitted search
(plan 3.1 (4), "every list request uses the applied values").

### The `Pagination` override (condition 3)

| Token | Value | Hex | Reason |
| --- | --- | --- | --- |
| `itemBg` | `surfaces.card` | `#0E1B2C` | Items sit on the card they belong to |
| `itemLinkBg` | `surfaces.card` | `#0E1B2C` | Same, for the jump links |
| `itemActiveBg` | `surfaces.raised` | `#111F32` | The design document's `Segmented` row ("active thumb to `surface.raised`", `docs/phase-b-studio.md`) and `Tag.defaultBg` (`theme.ts`, `surfaces.raised`). Not `Segmented` in `theme.ts`, which uses an accent tint |
| `itemActiveColor` | `accent.studio` | `#1F9EE9` | Accent for selection, as `colorLink` and `controlOutline` |
| `itemActiveColorHover` | `accent.studio` | `#1F9EE9` | No light hover |
| `itemInputBg` | `surfaces.input` | `#091624` | Inputs use `surfaces.input`, as `Input` and `Select` |

All six token names exist in antd 6.6.5 (`node_modules/antd/es/pagination/style/index.d.ts`).

### E1 and E2 (condition 5)

- Colour checks use `await expect(locator).toHaveCSS(property, "rgb(...)")`, after
  `page.mouse.move(0, 0)`: non-active `.ant-pagination-item` background
  `rgb(14, 27, 44)`; `.ant-pagination-item-active` background `rgb(17, 31, 50)`;
  in E1 also their `a` children: `rgb(244, 248, 252)` and `rgb(31, 158, 233)`.
- E1: 1 marker + 50 fillers through `/api/v1/public/contact`, each 201; 50
  `article.contact-card` and no marker on page 1; sidebar
  `getByRole("navigation", { name: "Studio" })` count 1; page 2 inside
  `getByRole("navigation", { name: "Inbox pages", exact: true })`; the marker
  opens and the drawer shows its message; screenshot attached.
- E2: admin token; marker redirect `/e2e-paging-<stamp>-zz`, then `-00` to `-49`,
  each to `/`, each id recorded on creation; everything after the first create is
  inside `try/finally`, which deletes every recorded id. Audit log filtered on
  `create_redirect` (waits for that response), 50 rows, marker id only on page 2,
  background checks on the table pager. Redirects searched on
  `e2e-paging-<stamp>` (waits for that response), 50 rows, `-zz` only on page 2.
  Screenshots attached.

## 6. For ADM-08

The Studio's collection list and the overview counts are **not** paged by
ADM-06b (plan 3.4). Past 100 items in one collection, these lists drop rows
silently:

- `studio/src/pages/CollectionListPage.tsx:63`: `canReorder` requires
  `page.total === page.items.length`, so reordering needs the whole set loaded.
  Paging this screen needs a new reorder design, which ADM-08 ("Reorder without
  raising item versions") owns.
- `studio/src/pages/CollectionListPage.tsx:65-69`: the published and draft counts
  are computed from the loaded items, not from the API.
- `studio/src/pages/CollectionListPage.tsx:76`: `pageSize: "100"`, one page only.
- `studio/src/pages/OverviewPage.tsx:28`: `pageSize=100` per collection, used for
  the overview's counts.

Today's content is far below the cap (the website snapshot holds at most 9 items
in a collection). The same section goes in the pull request body.

## 7. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: paging controls on the audit screen | Audit ADM-06, Fix 2; moved from ADM-06a | Done locally; e2e NOT RUN | `8c4ab16`; S5, S6 red at `f1b4215`, green at `8c4ab16`; E2 in CI `studio` |
| Fix: paging controls on the inbox screen | Audit ADM-06, Fix 2; moved from ADM-06a | Done locally; e2e NOT RUN | `8c4ab16`; S1 to S4 red, then green; E1 in CI `studio` |
| Fix: paging controls on the media library | Audit ADM-06, Fix 2; moved from ADM-06a | Done (unit); no end-to-end, by plan | S9, S10 red, then green; ADM-06a's `Media_list_returns_page_two`; media e2e belongs to ADM-16 |
| Media picker reaches images past the newest 24 | Audit ADM-06, bullet 3 | Done (unit); no end-to-end, by plan | S11, S12 red, then green |
| Studio reaches enquiries past the 50th | Audit ADM-06, bullets 3 and 5 | Done locally; e2e NOT RUN | S1 green; E1 in CI `studio` |
| Studio reaches audit entries past the 50th | Audit ADM-06, bullet 3 | Done locally; e2e NOT RUN | S5 green; E2 in CI `studio` |
| Studio reaches media past the newest 48 | Audit ADM-06, bullet 3 | Done (unit) | S9 to S12 green |
| Preview loader never repeats items | Audit ADM-06, bullet 4 | Done | P2, P3 red at `f1b4215` (resolved with 40 services; 251 rows), green at `8c4ab16`; P1 green throughout |
| Redirects screen reaches redirects past the 50th | Audit ADM-06, bullet 2; plan 3.4 | Done locally; e2e NOT RUN | S7, S8 red, then green; E2 in CI `studio` |
| Pager follows the navy look | `docs/phase-b-studio.md` lines 480, 501 | Done in code; assertions NOT RUN | `theme.ts` six tokens (section 5); E1, E2 `toHaveCSS` in CI `studio` |
| Collection list past 100 | Audit ADM-06, bullet 2 | Moved to ADM-08 | Section 6 of this file; PR body |
| Overview counts past 100 | Found in plan 2.3 | Moved to ADM-08 | Section 6 of this file; PR body |
| Merge order: final head contains #49 | Plan 3.5 | Open | Not merged in; checked at gate 2 with `git merge-base --is-ancestor` |
| Studio end-to-end test past page 1 | ADM-06a 3.3, 5.5 | Written; NOT RUN | `58caf70`; type-checked (exit 0); CI `studio` |
| Regression tests shown failing before the fix | G3 checklist | Done locally for S1 to S12, P2, P3; E1, E2 red NOT RUN | Section 4; E1/E2 red in CI on `58caf70` alone (O-ADM06B-1 "Yes") |
| `tsc -b` and `npm run build` pass | Plan 5.3 | **Failing** | TS6307, section 1 |
| ADM-06 closed | ADM-06a 3.3 | Open | Needs #49 and this change merged |

Status: BACK TO ARCHITECT
