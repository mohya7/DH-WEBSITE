# ADM-06b: plan

Change id: `ADM-06b`. Branch: `change/ADM-06b`, worktree `/home/user/dh-change-adm06b`,
cut from `origin/rebuild/dotnet-platform` at `f171f7a`, not tracking it.
Architect, round 2, 11 November 2026. Round 1 came back CHANGES NEEDED
(`plan-review.md` Round 1: two Majors, six Minors). Section 12 answers each one.

**This change is ADM-06b, the second of two.** ADM-06a (PR #49, branch
`change/ADM-06`) fixes the API binding. ADM-06b adds the Studio paging controls,
makes the preview loader safe against repeated rows, and adds a Studio end-to-end
test past page 1. ADM-06 closes only when both have merged (ADM-06a `plan.md` 3.3).

## 1. Item

- **Closes (with ADM-06a):** ADM-06, "paging is broken on every list endpoint",
  `docs/quality/admin-audit-2026-10-28.md` lines 133-145. This half closes the
  Studio side of three rows in that audit's requirement table:
  - FR-S-15 audit log, "Paging and filters broken (ADM-06, ADM-15)" (paging only;
    filters stay with ADM-15);
  - FR-S-18 contact inbox, "Only the newest 50 reachable (ADM-06)";
  - FR-S-07 media, "limited to the newest 48 or 24 (ADM-06, ADM-16)" (paging only;
    Replace and thumbnails stay with ADM-16).
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. ADM-06a's plan
  (3.3, round 2) made ADM-06b the next slot-2 change after ADM-06a, targeted to
  merge Thursday 12 November, ahead of ADM-03.
- **Owner's request:** "merge  and start next task" (Mohamed Elbadry,
  10 November 2026, project thread), then "continue work" (Mohamed Elbadry,
  10 November 2026, project thread). The orchestrator took ADM-06b as that task.
- **Done when**, quoted from the audit (the ADM-06 bullets this half closes):
  > - Only the newest 50 enquiries and audit entries can be reached. The media library
  >   shows the newest 48 of 56, the picker the newest 24.
  > - The preview loader (`studio/src/preview/previewData.ts:56-61`) would repeat items
  >   past 20.
  > - Ranked a blocker because enquiries past the 50th become unreachable.
  > - Fix:
  >   - Add paging controls to the audit, inbox and media screens.
- **Rows moved here from ADM-06a** (ADM-06a `plan.md` section 11, Status "Moved to ADM-06b"):
  - Fix: "Add paging controls to the audit, inbox and media screens";
  - Studio screens reach enquiries, audit entries and media past the first page;
  - Preview loader walks pages without repeats (Studio test).
  - ADM-06a 3.3 also asked this plan to decide on the redirects screen (cap 50)
    and the collection list (cap 100). Section 3.4 decides.
- **Batch exit gate**, quoted from the refinement plan, Track G3:
  > A clean website build from `DigitalHubContent_Studio` with no patched content;
  > each blocker reproduced before its fix and passing after it
- **Track rule** (refinement plan, Track G3): "Every fix carries a regression
  test that fails first." `docs/changes/README.md`, G3 checklist: "The
  regression test is committed and shown failing before the fix."

### Required reading

| Document | Where read | Present |
| --- | --- | --- |
| `docs/changes/README.md`, `.claude/agents/architect.md`, `.claude/commands/change.md` | worktree | Yes |
| `AGENTS.md` | worktree (the copy on `origin/claude/cool-heisenberg-mh6zx9` differs only in naming the two files below in its reading list) | Yes |
| `ENGINEERING_STANDARDS.md` | `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md` | Yes, not on the base |
| `docs/PROJECT_PROFILE.md` | same branch, `git show` | Yes, not on the base |
| `docs/deferred-items.md` | same branch, `git show` ("No entries yet.") | Yes, not on the base |
| `docs/quality/refinement-plan-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes |
| `docs/quality/admin-audit-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes |
| `docs/changes/ADM-06/*` | `/home/user/dh-change-adm06` (branch `change/ADM-06`) | Yes: plan (round 2), plan-review, plan-approval, implementation, test-report, delivery-approval |
| `docs/adr/0001-split-public-forms-api.md` | not needed (G2 only); `docs/adr/` does not exist on the base | n/a |
| `docs/phase-b-studio.md` | worktree | Yes (3.1 "list with pagination"; component table lists `Pagination`) |

`docs/changes/ADM-06b/` had no files before this plan, so this is round 1 and
there is nothing to answer yet.

Rules that apply: P-4 (failing test first), P-5 (fail closed), P-6, P-7, P-8,
B-6 (red test committed before the fix), B-8 (one topic), A-8 (lists are
paginated with a maximum page size), A-12 (the Studio calls the API through
`studio/src/api/http.ts`).

## 2. Current state

### 2.1 The base and ADM-06a

```
$ git -C /home/user/dh-change-adm06b log --oneline -1
f171f7a GAP-04: Run the website browser suite in CI, default and consent builds (#43)
$ git -C /home/user/dh-change-adm06b status
On branch change/ADM-06b
nothing to commit, working tree clean
$ gh api repos/mohya7/DH-WEBSITE/pulls/49 --jq '{state,merged,head:.head.sha,base:.base.ref,title}'
{"base":"rebuild/dotnet-platform","head":"c870b7e012a94d8129f3aa4f6231789368d38c40","merged":false,"state":"open","title":"ADM-06: Bind PageQuery from the query root (ADM-06a)"}
```

- PR #49 is open and holds only ADM-06a's red-test commit `c870b7e` on the remote.
  Its body says: "This pull request holds only the failing tests for now
  (`c870b7e`). The fix follows once CI shows them red." On 10 November its CI
  jobs (`api`, `studio`, `website`, browser tests) were in progress.
- ADM-06a's local branch has the fix `17894c7` ("Bind PageQuery from the query
  root") and the records; its `delivery-approval.md` ends `Verdict: APPROVED`.
- ADM-06a changes only `api/` files and `docs/changes/ADM-06/`. ADM-06b changes
  only `studio/` files and `docs/changes/ADM-06b/` (section 4). The two changes
  share no file.
- The base's merges are squash merges: every recent subject on
  `rebuild/dotnet-platform` ends with the PR number, for example `(#43)`, `(#42)`,
  `(#41)`.

### 2.2 What the API does before and after ADM-06a

From ADM-06a `plan.md` 2.2 (reproduced there, and confirmed by its reviewer):
any request that sends `page=` gets page 1 of 20; a request that sends only
`pageSize` works. After ADM-06a, `page` and `pageSize` bind from the query root
and `[Range(1, 10_000)]` / `[Range(1, 100)]` are enforced (400 outside them).

So every Studio screen that sends `page=2` today gets page 1 of 20. Paging
controls only work once ADM-06a has merged (section 3.5).

### 2.3 The screens, as they are

Every call below sends only `pageSize`, and no screen has a paging control.

| Screen | File and lines | Request | Shown | Control |
| --- | --- | --- | --- | --- |
| Audit log (admin) | `studio/src/pages/AuditPage.tsx:44-58` | `/api/v1/audit?pageSize=50` plus filters | antd `Table`, `pagination={false}` (line 74) | none |
| Inbox | `studio/src/pages/ContactInboxPage.tsx:36-46` | `/api/v1/contact-requests?pageSize=50` plus `search` | cards (`article.contact-card`, lines 89-100); tiles: `page.total`, and New/Handled counted from the loaded items (lines 69-79) | none |
| Media library | `studio/src/pages/MediaLibraryPage.tsx:35-42` | `/api/v1/media?pageSize=48&search=...` | tile grid (lines 91-98); `total` is ignored, only `items` kept (line 41) | none |
| Media picker | `studio/src/content/MediaPicker.tsx:50-60` | `/api/v1/media?pageSize=24&search=...` | tile grid in a `Modal` (lines 108-120) | none |
| Redirects | `studio/src/pages/RedirectsPage.tsx:29-39` | `/api/v1/redirects?pageSize=50` plus `search` | antd `Table`, `pagination={false}` (line 74) | none |
| Collection lists | `studio/src/pages/CollectionListPage.tsx:75-85` | `/api/v1/{collection}?pageSize=100` plus `search`, `status` | cards; reorder only when `page.total === page.items.length` (line 63); status counts from loaded items (lines 65-69) | none |

Other list calls, not browse screens: `OverviewPage.tsx:28` (`pageSize=100` per
collection, for counts) and `:42` (`audit?pageSize=8`, recent activity);
`AppShell.tsx:34,46,123` (`pageSize=1`, counts and global search); the reference
search boxes `FormWalker.tsx:249`, `InlineTextEditor.tsx:198`,
`RichTextEditor.tsx:222`, `NavigationPage.tsx:140` (`pageSize=8` typeahead).
`UsersPage.tsx:86` and `ApplicationsPage.tsx:48` have `pagination={false}`, but
their endpoints do not take `PageQuery` (ADM-06a 2.1 lists the five that do).

Nothing in `studio/src` uses antd `Pagination` or a `Table` pagination config
today (`grep -rn "Pagination\|pagination" studio/src`: only the four
`pagination={false}` lines).

### 2.4 The preview loader

`studio/src/preview/previewData.ts:54-62`, function `published`:

```ts
for (let page = 1; ; page++) {
  const list = await request(`/api/v1/${collection}?page=${page}&pageSize=100&status=published`);
  ...
  rows.push(...body.items);
  if (body.items.length === 0 || rows.length >= body.total) break;
}
```

- The loop is correct for an API that pages. With today's API it gets page 1 of
  20 on every call, so a collection with 25 published items yields 40 rows: page
  1 twice (20 + 20 >= 25). Each row then becomes a preview item, so cards repeat.
- Nothing in the loader notices a repeated id. If the API defect came back, or a
  row shifted across a page boundary between two requests (an item published or
  reordered meanwhile), the preview would show the repeat silently.
- `PreviewDrawer.tsx:15,44` shows a thrown error as an `Alert` with its message.
- The existing test, `studio/test/previewData.test.ts` (82 lines), mocks
  `request` and covers revision failures only. `studio/tsconfig.node.json`
  excludes that file from `tsc -b`.

### 2.5 The old admin panel has no paging control to copy

The settled design is the old admin panel's look (navy). Read-only, from the
design branch in this repository:

```
$ git ls-tree -r --name-only origin/feature/interviewer-portal | grep -i -E "admin|studio|dashboard"
ADMIN.md
admin/admin.css
admin/admin.js
admin/index.html
content/admin-content.json
$ git show origin/feature/interviewer-portal:admin/admin.js | grep -n -i -E "pagin|pager|load more|perPage"
(no output)
$ git show origin/feature/interviewer-portal:ADMIN.md | grep -n -i "audit"
95:- Audit history for the latest 50 content actions.
```

The old panel showed fixed slices and never paged, so there is no old paging
pattern to copy.

**Corrected in round 2.** `docs/phase-b-studio.md` line 501 does not list
`Pagination` as already themed. It is a row of the table introduced at line 480,
"These components will fight the language and need `components` overrides or a
thin wrapper", and the row reads "`Pagination` / `Empty` / `Result` / `Spin` |
Default illustrations and light wells." `studio/src/theme.ts` overrides `Button`,
`Input`, `Select`, `Table`, `Card`, `Modal`, `Drawer`, `Segmented`, `Tag` and
`Typography`, but not `Pagination` (`grep -n "Pagination" studio/src/theme.ts`:
no output). So the settled design asks for a `components.Pagination` override
before the pager is used. Section 3.2 brings one into scope.

What antd 6.6.5 does without it (read from the tarball in 2.6,
`es/pagination/style/index.js`):
- lines 566-577, the component token defaults: `itemBg`, `itemActiveBg`,
  `itemLinkBg` and `itemInputBg` default to `colorBgContainer`; `itemActiveColor`
  to `colorPrimary`;
- line 417: every page item is painted with `backgroundColor: token.itemBg`;
- lines 440-445: the active item gets `itemActiveBg`, a `colorPrimary` border,
  and `itemActiveColor` text;
- lines 431-437: hover and press use `colorBgTextHover` and `colorBgTextActive`
  from the dark algorithm.

With today's tokens the defaults would derive from `surfaces.card` and
`action.primary`. That is probably not light. But it is not shown, and it does
not follow the design document's rule for this component, which asks for the
override. So the plan takes option (a) in 3.2, not option (b).

### 2.6 antd 6.6.5 behaviour that matters

`studio/package-lock.json:2896-2897` pins `antd` 6.6.5. Its pagination is
`@rc-component/pagination` ~1.4.0. To check three details I downloaded both
tarballs with `npm pack` into the session scratchpad
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm06b-antd/`),
outside the repository, and only read them. Nothing was installed or run, and the
worktree is unchanged.

- **Size changer on by default above 50 rows.**
  `@rc-component/pagination` `es/Pagination.js:43,47`:
  `totalBoundaryShowSizeChanger = 50`, `showSizeChanger = total > totalBoundaryShowSizeChanger`.
  So a pager over 120 enquiries would offer 10/20/50/100 per page unless it is
  turned off.
- **Page items are found by title.** `es/Pager.js`: each page is
  `<li title="2" class="ant-pagination-item ant-pagination-item-2" tabIndex=0>`.
  Next is `title="Next Page"` (`es/locale/en_US.js:9`).
- **jsdom needs `window.matchMedia`.** antd `es/pagination/Pagination.js:45` calls
  `useBreakpoint(responsive)`, which subscribes through
  `es/_util/responsiveObserver.js:96`, `window.matchMedia(mediaQuery)`. jsdom has
  no `matchMedia`, so a render test must stub it.

### 2.7 Tests and harness

- **Vitest:** `studio/vitest.config.ts` includes `test/**/*.test.ts(x)`,
  `environment: "node"`. A file opts into jsdom with `// @vitest-environment jsdom`.
  `studio/test/case-study-theme.test.tsx` already renders an antd-based component
  (`FormWalker`) with `@testing-library/react` that way. `@testing-library/react`
  16.3.3 and `jsdom` 30.1.2 are already dev dependencies.
- **Type check:** `tsconfig.node.json` includes `test/**/*.ts` (so a new `.ts`
  test file is type-checked) but not `.tsx`, and excludes `test/previewData.test.ts`.
  `tsconfig.app.json` includes `src`.
- **Studio end-to-end:** `studio/playwright.config.ts`, one worker, files in
  alphabetical order, a 90 s test timeout. The harness (`e2e/env.ts`) starts the
  API on `DigitalHubContent_E2e` and refuses any other catalogue. It sets
  `Contact__PermitLimit: "1000"` and `Auth__LoginPermitLimit: "1000"` for the e2e
  API. It does not raise `Media:UploadPermitLimit` (20 uploads an hour per user,
  `Program.cs:113`). Existing specs seed through the API: `studio.spec.ts:140`
  posts to `/api/v1/public/contact`; `verification.spec.ts:432-445` signs in for a
  token and creates items.
- **CI:** `ci.yml` job `studio` ("Studio — typecheck, build, end-to-end") runs, in
  order: `npm ci`, `npx tsc -b`, `npm test`, `npm run build`, then the end-to-end
  suite against SQL Server. **A failing unit test stops the job before the
  end-to-end step** (no `if: always()` on it). Section 5.4 depends on this.
- **This container:** Node `v22.23.4`, npm present. `studio/node_modules` is not
  installed (`npm ls antd` prints `(empty)`). The registry is reachable through the
  proxy (`npm view antd@6.6.5 version` printed `6.6.5`). There is no SQL Server,
  so the Studio end-to-end suite runs only in CI.

### 2.8 Work in flight on the same files

```
$ gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open' --jq '.[]|"\(.number) \(.head.ref)"'
49 change/ADM-06
44 change/GAP-07
```

Neither changes a file under `studio/`. Later G3 items will touch the same
screens: ADM-07 (redirect warnings, `RedirectsPage.tsx`), ADM-12 (alt text in
the library, `MediaLibraryPage.tsx`), ADM-03 (rich-text images, possibly
`MediaPicker.tsx`), ADM-15 (`AuditPage.tsx`), ADM-16 (media), ADM-21 (inbox).
ADM-06b is ahead of all of them in slot 2. They rebase on it; none may be built
in parallel on these files (`AGENTS.md`: "Parallel work must change different
files").

## 3. Design

### 3.1 Approach

**Server-driven paging, one shared shape, the existing page sizes.**

1. **A small pure module, `studio/src/ui/paging.ts`** (no React, no antd, so it is
   type-checked with the node config when its test imports it):
   - `lastPage(total, pageSize)`: `Math.max(1, Math.ceil(total / pageSize))`.
   - `withPage(params, page, pageSize)`: sets `page` and `pageSize` on a
     `URLSearchParams` and returns it.
   - `latestOnly()`: returns `{ start(): number; isLatest(ticket): boolean }`.
     Each screen keeps one in a `useRef`, takes a ticket before each list request
     and applies the response only if it is still the latest. Clicking page 2 then
     page 3 quickly can no longer leave page 2 on screen with page 3 selected.
2. **A shared pager, `studio/src/ui/ListPager.tsx`**:
   - `ListPager`: antd `Pagination` inside `<nav aria-label={label}>`, for the
     card and tile screens (inbox, media library, picker). The labels are fixed:
     "Inbox pages", "Media library pages" and "Image picker pages". **No label may
     contain "Studio".** Playwright's `getByRole("navigation", { name: "Studio" })`
     matches by case-insensitive substring and finds the sidebar in
     `appearance.spec.ts:36,59`, `studio.spec.ts:113` and `verification.spec.ts`.
     A second match would break those locators in strict mode.
   - `tablePager(current, pageSize, total, onChange)`: the same settings as an
     antd `Table` `pagination` config, for the table screens (audit, redirects).
   - Both settings: `current`, `pageSize`, `total`, `showSizeChanger: false`
     (2.6: antd would otherwise offer other sizes above 50 rows),
     `hideOnSinglePage: true` (a screen with one page looks as it does today), and
     `showTotal: (total, [from, to]) => \`${from}–${to} of ${total}\``.
     `ListPager` takes `size="small"` for the picker only.
3. **Each screen** keeps its current page in state and sends
   `page=<current>&pageSize=<size>` on every list request. Sizes are unchanged:
   audit 50, inbox 50, media library 48, picker 24, redirects 50. All are within
   the API's maximum of 100 (A-8).
4. **Rules for the current page, the same on every screen:**
   - **Applied, not typed (round 2).** Each screen keeps the search or filters it
     last submitted ("applied") apart from what is in the inputs ("typed"). Only
     a submit copies typed to applied: Enter or the search button on a search
     box, or Filter on the audit log. Every list request, whether from a page
     click or a reload after a change, uses the applied values. Typing a new
     filter and then clicking "2" pages through the filter already on screen. The
     pager's total therefore always matches the rows shown. S2 and S6 assert this.
   - A new search or filter (inbox search, audit Filter, library and picker
     search, redirects search) loads page 1.
   - After a change on the screen (inbox Mark handled; library Save and Delete;
     redirects Create and Delete), the screen reloads its current page.
   - If that reload comes back empty with `page > 1` and `total > 0`, the screen
     loads `lastPage(total, pageSize)` instead. Deleting the only row of the last
     page shows the new last page, not an empty list.
   - After an upload from the library's Upload dialog, the library loads page 1,
     where the new image is (the list is newest first). The existing e2e tests
     10.15 and P2.8 rely on seeing the uploaded image.
   - The picker opens on page 1 with its current search each time it opens.
   - The inbox tiles are unchanged: "Total requests" is still `total`, and New and
     Handled still count the loaded page. That is ADM-21 ("The tiles count only
     the loaded page"), not this change.
5. **The preview loader** (`previewData.ts`, `published`) keeps its loop and adds
   two rules:
   - It keeps the first occurrence of each id and drops a later repeat. A row that
     shifted across a page boundary between two requests then appears once.
   - If a non-empty page adds no new id, the API is not paging. The loader then
     throws `The published ${collection} could not be loaded for the preview.`,
     the message the loader already throws for a failed list. `PreviewDrawer`
     shows it as an error (2.4). This fails closed (P-5): a preview with silently
     repeated or missing cards is worse than a clear error.
   - The stop condition becomes "unique rows >= total, or an empty page".

### 3.2 The look

**Round 2: a token-only `components.Pagination` override in `studio/src/theme.ts`
(the reviewer's option a).** This applies the settled design, which asks for it
(2.5). It does not change the design.

- The override uses only existing tokens from `@digitalhub/theme/tokens.ts`. No
  new colour value is introduced:

  | Pagination token | Value | Hex | Why |
  | --- | --- | --- | --- |
  | `itemBg` | `surfaces.card` | `#0E1B2C` | Items sit on the card they belong to |
  | `itemLinkBg` | `surfaces.card` | `#0E1B2C` | Same, for the jump links |
  | `itemActiveBg` | `surfaces.raised` | `#111F32` | Same choice as `Segmented` and the design's "active thumb to `surface.raised`" (`phase-b-studio.md`, `Segmented` row) |
  | `itemActiveColor` | `accent.studio` | `#1F9EE9` | Accent for selection, as `colorLink` and `controlOutline` already are |
  | `itemActiveColorHover` | `accent.studio` | `#1F9EE9` | No light hover |
  | `itemInputBg` | `surfaces.input` | `#091624` | Inputs use `surfaces.input`, as `Input` and `Select` do |

- Nothing else in `theme.ts` changes. No screen uses `Pagination` today (2.3), so
  the override changes no existing screen. antd's `Table` renders its pager with
  the same `Pagination` component, so the audit and redirects pagers take the
  override too.
- No change to `studio/src/index.css`. The pager sits under the list, as antd
  places it for `Table`. `ListPager` puts it under the grid, right-aligned, with
  `mt-4`, a Tailwind utility the screens already use.
- **The check is an assertion, not a judgement.** E1 (5.1) reads the computed
  style of the inbox pager on page 2 and requires:
  - `.ant-pagination-item:not(.ant-pagination-item-active)`: `background-color`
    is `rgb(14, 27, 44)` (`surfaces.card`);
  - `.ant-pagination-item-active`: `background-color` is `rgb(17, 31, 50)`
    (`surfaces.raised`), and its link `color` is `rgb(31, 158, 233)`
    (`accent.studio`);
  - the item link `color` on a non-active item is `rgb(244, 248, 252)`
    (`text.primary`, antd's `colorText`, `style/index.js:426`).

  So "no light well" passes or fails by itself. E2 makes the same two background
  checks on the audit log's table pager, which proves the override reaches
  `Table`. Without the override, the active background would be `#0E1B2C`, and
  E1 fails on it. A later token change that makes the pager light fails E1 too.
- The screenshots attached by E1 and E2 stay as extra evidence for the reviewer.
  They are not the criterion.
- `appearance.spec.ts` is **not** a safeguard for the pager (round 2). It checks
  only the body background and the sidebar width (`expectOldStudio`). It runs
  first, when the paged screens fit on one page, so `hideOnSinglePage` hides the
  pager.

### 3.3 Alternatives rejected

- **"Load more" or infinite scroll.** The audit's fix says "paging controls";
  `docs/phase-b-studio.md` lists `Pagination` among the Studio's components. A
  growing list also keeps thousands of audit rows in the page and gives page 2 no
  stable place.
- **antd `Table` client-side pagination over all rows.** The API returns at most
  100 rows a request (A-8). Loading every row to page them in the browser is the
  defect in another form.
- **Page number in the URL (`?page=2`).** It gives back and forward, but needs
  router changes on five screens and the picker, which is a modal with no URL.
  Nothing in the audit asks for it. A later change can add it without undoing
  this one.
- **A `usePagedList` hook that owns loading for every screen.** The five screens
  load different shapes with different filters and after-change rules. A hook that
  covers all of them would be bigger than the five small edits. The shared parts
  are the pure helpers and the pager settings.
- **Changing page sizes**, for example 20 everywhere. Not asked for. Page 1 of
  every screen stays as staff know it.
- **Showing that antd's defaults fit, with no override (the reviewer's option b).**
  Rejected: the design document puts `Pagination` in the "need `components`
  overrides" table (2.5). A scratch render would show only today's derived values,
  and a later change to `colorBgContainer` would move the pager silently. The
  override costs six lines of existing tokens.
- **Leaving `previewData.ts` unchanged.** ADM-06a fixes the cause, and the loader
  is correct for an API that pages. But the loader trusts the API completely: the
  same defect, or a row shifting between requests, repeats cards silently. The
  two rules in 3.1 (5) are a few lines and make the audit's "would repeat items"
  impossible on the Studio side. They also give the red-first test the G3 rule
  needs (5.1, P2 and P3).
- **Dropping repeats silently in every case.** Then an API that ignores `page`
  produces a preview missing everything past the first page, with no message.
  Rejected for P-5.

### 3.4 Scope decisions: redirects and the collection list

**Redirects (cap 50): in scope.**
- The audit names redirects among the endpoints with the defect ("Affected:
  audit, contact requests, redirects, media and every collection"). The screen has
  the same cap (`pageSize: "50"`, `pagination={false}`) as the audit log, which is
  in scope.
- Redirect rows grow with every slug change on published content (FR-S-10) and
  are never pruned. Past 50, the rest can only be found by search.
- The change is the audit log's change on the same `Table` (`tablePager`). It adds
  one screen to a topic that is already "Studio paging controls" (B-8), and no new
  pattern.
- ADM-07 will change this screen next. Doing it now means ADM-07 rebases once on a
  paged screen, rather than a later paging change rebasing on ADM-07.

**Collection lists (cap 100): out of scope.**
- The content is far below the cap. The website snapshot
  (`website/fixtures/snapshot/content.json`) holds 9 pages, 4 services,
  5 partners, 4 case studies, 3 blog posts, 0 vacancies, 6 team members and
  3 news items.
- Paging this screen is not a pager change. Reordering needs the whole set:
  `canReorder` requires `page.total === page.items.length` (line 63), and
  `persistOrder` posts every item's version. The status counts (lines 65-69) are
  computed from the loaded items. Paging needs a new reorder and counts from the
  API. ADM-08 is about to change reordering ("Reorder without raising item
  versions").
- The audit's fix names only the audit, inbox and media screens.
- Destination: ADM-08, which owns reordering. It is not a Minor, so no D-NNN
  entry. The same applies to `OverviewPage.tsx:28` (`pageSize=100` per collection,
  used for counts).
- **Where the ADM-08 architect will find it (round 2).** Three records travel with
  the merged change, and no file outside this change's scope is edited:
  1. this plan's coverage table (section 11), rows "Collection list past 100" and
     "Overview counts past 100";
  2. a section headed **"For ADM-08"** in `docs/changes/ADM-06b/implementation.md`,
     which the developer writes. It names `CollectionListPage.tsx:63`
     (`canReorder` needs the whole set), `:65-69` (status counts from loaded
     items), `:76` (`pageSize: "100"`) and `OverviewPage.tsx:28`, and says that
     past 100 items these lists drop rows silently;
  3. the same "For ADM-08" section in the pull request body, which stays in the
     merged history.
  The coordinator passes the note on to whoever plans ADM-08. The ADM-08
  architect reads `docs/changes/` for earlier records on the same screens, as
  this plan read ADM-06a's.
- If the owner wants the collection list paged now, that is a new item for slot 2;
  section 9 notes it.

### 3.5 Stacked on `change/ADM-06`, or cut from the base: cut from the base

The worktree is already cut from `f171f7a`. It stays that way. ADM-06b is **not**
stacked on `change/ADM-06`.

- **No shared files** (2.1). ADM-06b's code, Vitest tests and end-to-end test
  compile and run without ADM-06a's commit.
- **The red tests fail today and the green Vitest tests pass without ADM-06a.**
  The Vitest tests use a fake API that pages correctly (5.1), so they test the
  Studio, not the API. Only the end-to-end test needs the real API to page, and
  so needs ADM-06a merged.
- **Stacking costs more than it saves with squash merges** (2.1). A branch cut from
  `change/ADM-06` carries ADM-06a's five commits. Once #49 is squashed into the
  base, those commits no longer match the base, and the branch must be rebased
  with `--onto` or carry a confusing diff. A branch cut from the base just merges
  the base once ADM-06a is in it.
- **Merge order is kept by the integrator, not by CI (corrected in round 2).**
  - `rebuild/dotnet-platform` has no branch protection and no required checks
    (reviewer: `gh api repos/mohya7/DH-WEBSITE/branches/rebuild%2Fdotnet-platform`
    gives `"protected":false`, `"contexts":[]`; `ENGINEERING_STANDARDS.md` P-1
    "Partial: no branch protection recorded"). A red check does not stop a merge.
  - `ci.yml` runs on `pull_request`, which tests the head merged with the base as
    it is when the run starts. A run started after #49 has merged is green even if
    the head itself lacks ADM-06a. So E1 and E2 warn; they do not enforce.
  - **What happens if ADM-06b merges first.** After ADM-06b, every list request
    sends `page=`, page 1 included. Before ADM-06a, any request with `page=` binds
    the whole `PageQuery` under the `page.` prefix, so `pageSize` is lost as well
    (2.2). The inbox, audit log and redirects would drop from 50 rows to 20, the
    library from 48 to 20 and the picker from 24 to 20, while the pager still
    counts 50 or 48 a page. That is worse than today.
  - **Safeguards this plan controls:**
    1. The pull request is opened as a **draft**. Its body's first line is
       **"Do not merge before #49 (ADM-06a)."** It stays a draft with that line
       until #49 has merged and the base has been merged into the head.
    2. Only then is it marked ready for review. The first line is changed to
       "#49 merged as `<sha>`; included in this head."
    3. The tester and gate 2 check that the final head contains #49's squash
       commit:
       `git merge-base --is-ancestor <#49 squash sha> <head>`, exit 0, quoted.
       Gate 2 does not approve without it.
    4. The integrator merges #49 before this pull request, as `AGENTS.md`
       requires one merge at a time.
- **Sequence:**
  1. The developer builds and commits locally on `f171f7a` at any time (5.2).
  2. Before the first push, while the commits are still unpublished, the developer
     rebases them onto the current `origin/rebuild/dotnet-platform` if ADM-06a has
     merged by then (B-3).
  3. After any push, only merges: `git merge origin/rebuild/dotnet-platform`,
     never a rewrite of pushed history (B-5).
  4. The final head must contain ADM-06a. If ADM-06a has not merged when ADM-06b
     is otherwise ready, the change waits. It does not stack.

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `studio/src/ui/paging.ts` | `lastPage`, `withPage`, `latestOnly` (3.1, 1). Pure TypeScript, no React or antd import. |
| `studio/src/ui/ListPager.tsx` | `ListPager` (antd `Pagination` in a labelled `nav`) and `tablePager` (the `Table` pagination config), with the shared settings in 3.1 (2). |
| `studio/test/support/pagedApi.ts` | Test helper, self-contained (no `src` import): `pagedBody(rows, path)` reads `page` (default 1) and `pageSize` (default 20) from the request path, as the API does after ADM-06a, and returns `{ items, page, pageSize, total }`. It throws if `pageSize > 100` or `page < 1`, so a test fails if a screen sends what the API would reject. Not a `*.test.*` file, so Vitest does not run it; `tsc -b` type-checks it (node config). |
| `studio/test/paging.test.ts` | Unit tests for `paging.ts` (5.1, U1 to U3). |
| `studio/test/listPaging.test.tsx` | Render tests for the five screens (5.1, S1 to S12), `// @vitest-environment jsdom`. |
| `studio/e2e/paging.spec.ts` | End-to-end tests past page 1 (5.1, E1 and E2). |
| `docs/changes/ADM-06b/*` | Pipeline records. |

### Files to change

| File | Change |
| --- | --- |
| `studio/src/theme.ts` | Add `components.Pagination` with the six token-only values in 3.2. Nothing else changes. |
| `studio/src/pages/ContactInboxPage.tsx` | Applied search kept apart from the typed search (3.1, 4); current page in state; `page` and `pageSize=50` on the request; `ListPager` under the cards; the page rules in 3.1 (4); `latestOnly`. Tiles unchanged. |
| `studio/src/pages/AuditPage.tsx` | Applied filters kept apart from the typed ones; current page in state; `page` and `pageSize=50`; `pagination={tablePager(...)}` replaces `pagination={false}`; Filter loads page 1; `latestOnly`. Filters and columns unchanged (ADM-15). |
| `studio/src/pages/RedirectsPage.tsx` | As the audit log, with an applied search: `tablePager`, `page` and `pageSize=50`; search loads page 1; Create and Delete reload the current page, clamped to the last page. |
| `studio/src/pages/MediaLibraryPage.tsx` | Applied search; keep `total` as well as `items`; current page in state; `withPage(..., 48)`; `ListPager` under the grid; search loads page 1; Save and Delete reload the current page, clamped; the Upload dialog's close or select loads page 1. |
| `studio/src/content/MediaPicker.tsx` | Applied search; keep `total`; current page in state; `withPage(..., 24)`; `ListPager size="small"` between the grid and "Upload"; opening the modal loads page 1 with the current search; search loads page 1. `rememberMedia` still records every loaded item. |
| `studio/src/preview/previewData.ts` | `published`: keep the first occurrence of each id; throw the existing error if a non-empty page adds no new id; stop on unique rows >= total or an empty page (3.1, 5). Nothing else in the file changes. |
| `studio/test/previewData.test.ts` | Add a `describe("published lists across pages")` block with P1 to P3 (5.1). The existing block is unchanged. The file is already excluded from `tsc -b`, so the mock typing needs no config change. |

### Out of scope (left alone on purpose)

- `CollectionListPage.tsx` and `OverviewPage.tsx` (3.4). Destination: an
  observation for ADM-08.
- The reference search boxes (`FormWalker.tsx`, `InlineTextEditor.tsx`,
  `RichTextEditor.tsx`, `NavigationPage.tsx`, `pageSize=8`) and `AppShell.tsx`
  (`pageSize=1`). They are typeahead searches and counts, not lists to browse.
- `UsersPage.tsx`, `ApplicationsPage.tsx`: their endpoints are not paged.
- Inbox tiles counting the loaded page (ADM-21); audit filters, user emails and
  the "to" date (ADM-15); media Replace, thumbnails, "Used in" titles (ADM-16);
  redirect validation and warnings (ADM-02, ADM-07).
- Tie-breakers on newest-first orderings in the API (ADM-06a passed them to ADM-15
  and ADM-16).
- `studio/src/index.css`, and every part of `theme.ts` other than the new
  `Pagination` entry (3.2).
- `studio/package.json`, `studio/package-lock.json`, `tsconfig*.json`,
  `vitest.config.ts`, `playwright.config.ts`, `e2e/env.ts`, `e2e/helpers.ts`,
  `.github/workflows/*`. No dependency, config, harness or workflow change.
  `Media:UploadPermitLimit` is not raised for the e2e API (5.1, "Why media has no
  e2e test here").
- Every `api/` file. The API fix is ADM-06a.

## 5. Test plan

### 5.1 Failing tests, written first

**How the render tests are set up** (`studio/test/listPaging.test.tsx`):
- First line `// @vitest-environment jsdom`.
- `vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380")` at module level,
  as `case-study-theme.test.tsx` does.
- A `window.matchMedia` stub, in this file only (2.6). It returns
  `{ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }`.
- `vi.mock("../src/api/http", ...)`: `request` is a `vi.fn` that answers list
  paths with `pagedBody` (from `test/support/pagedApi.ts`) and records every path.
  `jsonInit` is a plain implementation. Mocking `http` also keeps `auth/session.ts`
  (and its `BroadcastChannel`) out of the test.
- `vi.mock("../src/auth/AuthProvider", ...)`: `useAuth` returns
  `{ user: { role: "admin" }, ready: true }`.
- Pager items are found by title, `getByTitle("2")` (2.6). Rows are found by their
  visible text.
- Data: rows named with three-digit numbers, newest first, so "Enquiry 051" is
  the 51st row.

Every S test is red today for the same reason: the screen has no pager, so there
is no element with title "2" (or "Next Page"). The tests do not need ADM-06a,
because the fake API pages correctly.

| Id | Test name | Screen | What it asserts |
| --- | --- | --- | --- |
| S1 | `inbox reaches the 51st enquiry on page 2` | `ContactInboxPage` | 120 enquiries. Page 1 shows "Enquiry 001" and not "Enquiry 051". Click title "2": "Enquiry 051" shows and "Enquiry 001" does not. The last list request has `page=2` and `pageSize=50`. No size changer (`.ant-pagination-options` absent). |
| S2 | `inbox pages through the applied search and a new search goes back to page 1` | `ContactInboxPage` | Type "Enquiry 1" in the search box **without submitting**, then click "2". The request has `page=2` and no `search` (the applied search is still empty). Then submit the search. The request has `page=1` and `search=Enquiry 1`. |
| S3 | `inbox keeps the latest page when responses arrive out of order` | `ContactInboxPage` | The page-2 response is held back. Click "2", then "3". Release page 3, then page 2. Page 3's rows show; page 2's do not. |
| S4 | `marking an enquiry handled reloads the same page` | `ContactInboxPage` | On page 2, open "Enquiry 051" and click "Mark handled". The next list request has `page=2`. |
| S5 | `audit log reaches the 51st entry on page 2` | `AuditPage` | 120 entries. Page 1 does not show entity id `entity-051`. Click "2": it shows. The request has `page=2&pageSize=50`. |
| S6 | `audit pages through the applied filters and Filter goes back to page 1` | `AuditPage` | Type an action **without clicking Filter**, then click "2". The request has `page=2` and no `action`. Then click "Filter". The request has `page=1` and that `action`. |
| S7 | `redirects reach the 51st redirect on page 2` | `RedirectsPage` | 51 redirects. Page 1 does not show `/r-051`. Click "2": it shows. The request has `page=2&pageSize=50`. |
| S8 | `deleting the only row of the last page shows the page before` | `RedirectsPage` | 51 redirects, on page 2. Click Delete on `/r-051` (the fake deletes it). The screen reloads page 2, gets an empty page with total 50, then loads page 1, and `/r-001` shows. |
| S9 | `media library reaches the 49th image on page 2` | `MediaLibraryPage` | 56 images (the audit's number). Page 1 has 48 tiles and no "Image 049". Click "2": 8 tiles, "Image 049" among them. The request has `page=2&pageSize=48`. |
| S10 | `media library search goes back to page 1` | `MediaLibraryPage` | On page 2, search. The request has `page=1` and `search`. |
| S11 | `picker reaches the 25th image and selects it` | `MediaPicker` (`open`) | 30 images. Page 1 has 24 tiles and no "Image 025". Click "2": click "Image 025". `onSelect` gets that image's id. The request has `page=2&pageSize=24`. |
| S12 | `picker opens on page 1` | `MediaPicker` | Open, go to page 2, close (re-render with `open={false}`), open again. The request on reopening has `page=1`. |

**Preview loader** (`studio/test/previewData.test.ts`, new describe block). Uses
the file's existing mocking pattern. `services` gets the rows under test; every
other collection gets an empty list; each service id answers
`/api/v1/services/<id>` with a document.

| Id | Test name | Red today? | What it asserts |
| --- | --- | --- | --- |
| P1 | `loads every published item across pages, once each` | No: a guard that passes today | 250 published services and an API that pages. `collections.services` has 250 items with 250 distinct ids. The list requests were `page=1`, `2` and `3`, each with `pageSize=100`, and there was no fourth. |
| P2 | `fails with a clear error when the list ignores the page` | **Yes** | The defect's shape: every list request returns the same first 20 of 25 rows, whatever `page` says. Expected: `loadPreviewData()` rejects with `The published services could not be loaded for the preview.` Today it resolves with 40 services, 20 of them repeats. |
| P3 | `shows a row once when it shifts across a page boundary` | **Yes** | Total 250. Page 1 returns ids 1-100, page 2 returns ids 100-199 (id 100 again), page 3 returns ids 200-250. Expected: 250 distinct services and no repeat. Today: 251 rows, id 100 twice. |

**Pure helpers** (`studio/test/paging.test.ts`, node environment). Red today
because `src/ui/paging.ts` does not exist (an import failure, not an assertion).
That is acceptable for new helpers; S1 to S12 and P2 to P3 are the behavioural
regression tests.

| Id | Test name | What it asserts |
| --- | --- | --- |
| U1 | `lastPage is never below 1` | `lastPage(0, 50) === 1`, `lastPage(50, 50) === 1`, `lastPage(51, 50) === 2`, `lastPage(120, 50) === 3`. |
| U2 | `withPage sets page and pageSize and keeps other parameters` | `withPage(new URLSearchParams("search=x"), 2, 48).toString() === "search=x&page=2&pageSize=48"`. |
| U3 | `latestOnly accepts only the newest ticket` | `a = start(); b = start()`: `isLatest(a)` is false, `isLatest(b)` is true. |

**End-to-end** (`studio/e2e/paging.spec.ts`; runs only in CI `studio`). Each test
seeds through the API and finds its rows by a per-run stamp, so it does not depend
on other spec files.

- **E1** `ADM-06 inbox: the 51st enquiry is on page 2 and opens`
  - Post one marker enquiry, `E2E paging marker <stamp>`, then 50 fillers, to
    `/api/v1/public/contact` (the body shape of `studio.spec.ts:140-149`). Each
    returns 201. The e2e contact limit is 1000 (2.7).
  - Sign in as admin and open "Inbox". Page 1 shows 50 `article.contact-card`
    and not the marker. The inbox is newest first and every older enquiry is
    older than the marker, so the marker is exactly the 51st.
  - Click the pager's "2" (`page.locator(".ant-pagination").getByTitle("2", { exact: true })`).
    The marker heading shows.
  - **Pager look (round 2, 3.2).** On page 2, read `getComputedStyle`:
    - a non-active `.ant-pagination-item` has `background-color`
      `rgb(14, 27, 44)` and link `color` `rgb(244, 248, 252)`;
    - `.ant-pagination-item-active` has `background-color` `rgb(17, 31, 50)` and
      link `color` `rgb(31, 158, 233)`.
    Move the mouse off the pager first, so no hover colour is read.
  - The pager is found inside `getByRole("navigation", { name: "Inbox pages", exact: true })`.
    The sidebar locator `getByRole("navigation", { name: "Studio" })` still
    matches exactly one element; assert that count is 1.
  - Click the marker, and the drawer shows its message.
  - Attach a screenshot of page 2 (`test.info().attach`).
- **E2** `ADM-06 audit log and redirects: the 51st row is on page 2`
  - Get an admin token (as `verification.spec.ts:432`). Create a marker redirect
    `/e2e-paging-<stamp>-zz` to `/`, then 50 redirects `/e2e-paging-<stamp>-00`
    to `-49`, each to `/`, through `POST /api/v1/redirects`. Each writes a
    `create_redirect` audit entry (`AdminStore.cs:161`).
  - **Audit log:** sign in, open "Audit log", type `create_redirect` in Action and
    click Filter. Page 1 has 50 rows and not the marker's redirect id. Click "2":
    the row with the marker's id in "Entity id" shows. Any other `create_redirect`
    entry is older than the marker, so the marker is the 51st. The two background
    checks from E1 hold on this table's pager, which shows the override reaches
    `Table`. Screenshot.
  - **Redirects:** open "Redirects" and search `e2e-paging-<stamp>`: 51 matches,
    sorted by path, so `-zz` is last. Page 1 has 50 rows and no `-zz`. Click "2":
    `-zz` shows. Screenshot.
  - **Cleanup (round 2):** the ids of every redirect E2 creates are pushed to a
    list as soon as each create returns. The deletes run in a `try/finally`
    around the rest of the test, so they run when E2 passes, when it fails (as in
    the red run), and when it fails half-way through seeding. The audit entries
    stay: the audit log is append-only (S-8).
  - E1's 51 enquiries stay until the next reset of `DigitalHubContent_E2e`. That
    is harmless: no later spec counts enquiries, and 10.19 (`studio.spec.ts:138`)
    finds its own, newer enquiry by heading on page 1.
- **Why media has no e2e test here (round 2, weighed).**
  - Page 2 of the library needs 49 images, and of the picker 25. The e2e API keeps
    `Media:UploadPermitLimit` at 20 an hour per user (`Program.cs:113`).
  - Splitting uploads between admin and editor does not work: 20 + 5 uses up the
    admin budget that 10.15 and P2.8 need later in the same hour.
  - `e2e/env.ts` has a precedent: it already raises `Contact__PermitLimit` and
    `Auth__LoginPermitLimit` "only for the e2e API". An e2e-only
    `Media__UploadPermitLimit` would not weaken a production guard. I still leave
    it out, for three reasons:
    1. It changes the shared harness every spec runs under, in a pull request
       whose topic is Studio screens (B-8).
    2. Each upload is processed into resized variants and needs a unique image,
       so 49 uploads add real run time to every CI run.
    3. ADM-16 ("images are hard to find, recognise and replace", a Major) has
       "paging" in its fix and needs its own end-to-end test (G3 checklist: a test
       for each Major). That is where a media end-to-end test past page 1 belongs,
       with the harness change argued in its own plan.
  - What proves media here: S9 and S10 (library) and S11 and S12 (picker) against
    a fake that pages like the fixed API, plus ADM-06a's
    `ListPagingTests.Media_list_returns_page_two` for the API. No end-to-end.
    Section 11 says so.
- **Red on today's Studio:** E1 and E2 fail at the pager locator (`getByTitle("2")`
  not found within 15 s). The 50-row and "not on page 1" assertions before it
  pass, because today's screens send only `pageSize`.
- **On ADM-06b without ADM-06a (corrected in round 2):** every request now sends
  `page=`, so the API drops `pageSize` and returns 20 rows. E1 fails at "Page 1
  shows 50 `article.contact-card`" (20 shown), and E2 at the audit log's 50-row
  check. Neither reaches the pager. This warns about a wrong merge order; it does
  not prevent one (3.5).

### 5.2 Commit order (B-6, P-4)

Three commits, so the end-to-end red can be shown in CI. A failing unit test would
stop the `studio` job before the end-to-end step (2.7).

1. `ADM-06b: Test that Studio lists reach rows past page 1 end to end`
   - `studio/e2e/paging.spec.ts` only.
2. `ADM-06b: Test the Studio paging controls and the preview loader`
   - `studio/test/listPaging.test.tsx`, `studio/test/support/pagedApi.ts`,
     `studio/test/paging.test.ts`, and the new block in
     `studio/test/previewData.test.ts`.
3. `ADM-06b: Add paging controls to the audit, inbox, redirects and media screens`
   - Every file under "Files to change" except the tests, plus `paging.ts` and
     `ListPager.tsx`.

### 5.3 Local evidence, in this container

Set up once, then check that the lockfile is untouched (B-7):

```bash
cd /home/user/dh-change-adm06b/studio
npm ci
git -C /home/user/dh-change-adm06b diff --exit-code -- studio/package-lock.json studio/package.json
```

**After commit 2 (red):**

```bash
npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts
```

Expected:
- `listPaging.test.tsx`: 12 failed (S1 to S12), each on the missing pager item.
- `previewData.test.ts`: the 8 existing tests pass; P1 passes; P2 and P3 fail.
- `paging.test.ts`: the file fails to load (`Failed to resolve import "../src/ui/paging"`).
  Vitest reports it as a failed suite.
- Exit 1. Quote the summary lines and one assertion message per failing test.
- Also run `npm test` once and confirm every test outside these three files
  still passes, which shows commit 2 changed nothing else.

**After commit 3 (green):**

```bash
npx vitest run test/listPaging.test.tsx test/previewData.test.ts test/paging.test.ts
npm test
npx tsc -b
VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
git -C /home/user/dh-change-adm06b status --short
```

Expected:
- All three files pass: 12 + 11 + 3 = 26 tests.
- `npm test`: every Studio unit test passes; quote the count.
- `tsc -b`: exit 0. This type-checks the screens, `paging.ts`, `ListPager.tsx`
  and `test/support/pagedApi.ts`.
- `npm run build`: exit 0, including the preview design check
  (`scripts/check-preview-design.ts`).
- `git status --short`: only the planned files. `dist/` and `node_modules/` are
  ignored.

**End-to-end locally: NOT RUN.** There is no SQL Server in this container, and
the harness needs `DigitalHubContent_E2e`. Covered by CI job `studio` (5.4). No
local port is used. If a later step starts Vite or the API, it uses 42xx
(`DH_E2E_API_PORT`, `DH_E2E_STUDIO_PORT`) and stops only what it started.

### 5.4 CI evidence on the pull request

- **Red end-to-end (needs O-ADM06B-1, section 9).** If the owner answers "Yes":
  - Push commit 1 alone and open the pull request **as a draft**, with the first
    line "Do not merge before #49 (ADM-06a)." (3.5).
  - CI `studio` reaches the end-to-end step, because commit 1 has no unit test
    change.
  - **Wait for that run to finish (round 2).** `ci.yml` has
    `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`, so a
    second push cancels it. On ADM-06a's red commit `c870b7e`, the `studio` check
    ended `cancelled` for that reason. Push nothing more until the check run
    "Studio — typecheck, build, end-to-end" on commit 1 has conclusion
    `failure`. Check it with
    `gh api repos/mohya7/DH-WEBSITE/commits/<commit 1 sha>/check-runs --jq '.check_runs[]|{name,status,conclusion,id}'`.
  - Record the run id and quote the log lines naming E1 and E2 as failed at the
    pager locator, and no other failure. A `cancelled` run is not red evidence; if
    it happens, re-run the job on commit 1 and wait again.
  - Then push commits 2 and 3 (and the base merge, 3.5).
  - Commit 2 does not need its own CI run. Its red is shown locally (5.3), and in
    CI it would stop before the end-to-end step.
- **Head contains ADM-06a:** quote
  `git merge-base --is-ancestor <#49 squash sha> <final head>; echo $?` giving
  `0` (3.5).
- **Green**, on a final head that contains ADM-06a:
  - `studio`: type check, unit tests, build, and the whole end-to-end suite,
    E1 and E2 included. Quote the Playwright summary from the run log and the
    count of tests passed. Before this change the suite had 22 tests in Phase B
    (`AGENTS.md`) and more since; quote the count as run.
  - The `studio-e2e-report` artifact holds the screenshots from E1 and E2 (3.2).
    The pager's look is checked by E1's and E2's computed-style assertions, not
    by the screenshots.
  - `api`, `website`, the website browser tests, `section-compare`: unchanged by
    this change, and they must stay green.
  - `security.yml` (gitleaks, Semgrep, audits) and `workflow-lint.yml`
    (actionlint): green.

### 5.5 Track checklist (G3), from `docs/changes/README.md`

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Section 1 quotes the bullets this half closes. 2.3 and 2.4 show them in the code. The fix is the audit's "Add paging controls to the audit, inbox and media screens", plus redirects (3.4) and the preview loader (the audit's bullet 4) |
| The regression test is committed and shown failing before the fix | Commits 1 and 2 come before commit 3. S1 to S12, P2 and P3 are shown failing locally, then passing (5.3). E1 and E2 are shown failing in CI if O-ADM06B-1 is "Yes" (5.4). If it is "No", see section 9 |
| The end-to-end suite gets a test for each Major | ADM-06 is a Blocker. E1 and E2 are added anyway, as ADM-06a's plan promised |
| A Minor that is not fixed becomes a D-NNN entry | Not a Minor. The collection list is not part of ADM-06's fix; it goes to ADM-08 as an observation (3.4) |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | 2.3 to 2.4 and the red runs reproduce it; the green runs show it passing. ADM-06 is done only when both ADM-06a and ADM-06b have merged |

## 6. Security impact

- **Routes, policies, API:** none changed. ADM-06b changes only `studio/`. The
  screens call the same routes through `request` in `studio/src/api/http.ts`
  (A-12). Only `page` and `pageSize` are added, within the API's limits. The
  audit log is still requested only when the user is an admin
  (`AuditPage.tsx:37-42`), and the API still enforces `studio-admin`.
- **Data shown:** rows past the first page that each role could already reach
  through the API (ADM-06a section 6). No new field is shown. Rows are rendered
  by React as text, as today, so the 10.19 answer to XSS (escaped enquiry text)
  is unchanged.
- **Preview:** fails closed on a list that does not page (3.1, 5). No working-copy
  title or slug is added to any message (the existing tests in
  `previewData.test.ts` still guard that).
- **Theme:** `theme.ts` gains a `Pagination` entry made of existing colour tokens.
  No behaviour or security effect.
- **Logins, secrets, configuration:** none. No harness rate limit is raised. E1
  posts 51 enquiries within the existing e2e contact limit of 1000. E2 uses the
  existing e2e admin account.
- **Dependencies:** none added. `Pagination` is part of `antd` 6.6.5, already
  locked. `package.json` and `package-lock.json` are unchanged and checked by
  `git diff --exit-code` (5.3). The tarballs in 2.6 were read in the scratchpad
  only.

## 7. Migrations

None. No API, entity, schema or data change.

## 8. Rollback

Revert the pull request. Nothing is stored and there is no migration. A revert
brings back the capped screens, and E1, E2 and S1 to S12 would go red, which
shows it. The e2e data (51 enquiries, 51 redirect audit entries) lives only in
`DigitalHubContent_E2e`, which the harness resets before every run.

## 9. Owner decisions needed

- **O-ADM06B-1. Status: PENDING. BLOCKED for the push step only.**
  - **Question:** "May the developer push ADM-06b's first commit (the end-to-end
    paging test only) to `change/ADM-06b` and open the pull request before the
    other commits are pushed, so that CI's `studio` job shows the end-to-end test
    failing first? CI would be red on that pull request until the rest is
    pushed."
  - **Answers to offer:** "Yes, push the red test first" (recommended), or "No,
    push only when finished".
  - **Not assumed from ADM-06a.** PR #49's body shows ADM-06a's red commit was
    pushed first (2.1). I have not seen the owner's words for that (O-ADM06-1),
    and they would cover ADM-06a only. So this plan does not take an answer from
    them.
  - **Why it is asked:**
    - G3 requires the regression test "shown failing before the fix".
    - E1 and E2 need SQL Server; this container has none (2.7).
    - CI runs only on pull requests, and a push happens only after the owner
      confirms (`.claude/commands/change.md`, "Stop for the owner").
  - **What does not wait:** development, the three commits in order, local red and
    green (5.3), the review, testing and both gates.
  - **If "Yes":** follow 5.4. Quote the owner's words, date and place in
    `implementation.md`.
  - **If "No":**
    - The G3 red-first row is still met by S1 to S12, P2 and P3. They are the
      regression tests for the Studio defect, and they are shown failing locally
      before commit 3 (5.3).
    - E1 and E2 are then shown passing in CI but never failing. Their red is
      recorded as NOT RUN, with the reason (no SQL Server locally; CI not run on
      commit 1) and the CI job that covers their green (`studio`).
    - I do not treat this as an exception, because the G3 rule is met by the
      Vitest tests. If the plan reviewer or the tech lead reads the rule as
      covering E1 and E2 too, the delivery is BLOCKED ON OWNER. It is unblocked
      only when the owner accepts NOT RUN red for E1 and E2 in words, recorded as
      a D-NNN entry with the quote and an expiry. No role may decide that for the
      owner (P-7).
- **Noted, not a decision.**
  - Redirects are in scope and the collection list is not (3.4). If the owner
    wants the collection list paged now, or redirects left out, say so before
    gate 1.
  - Page sizes stay as they are (audit 50, inbox 50, library 48, picker 24,
    redirects 50).

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| ADM-06b merges before ADM-06a | Every paged screen shows 20 rows a page while its pager counts 50 or 48: worse than today | Not prevented by CI: there is no branch protection (3.5). Kept by the integrator, with a draft pull request whose first line is "Do not merge before #49", and the `merge-base --is-ancestor` check at gate 2. E1 and E2 warn by failing at their 50-row checks |
| ADM-06a slips past 12 November | ADM-06b waits; ADM-06 and the G3-1 exit gate stay open | 3.5 forbids stacking. The integrator tells the owner at the gate (ADM-06a 3.3) |
| antd shows the size changer above 50 rows | Staff can pick 100 per page; page counts differ from the plan | `showSizeChanger: false` in both pager settings; S1 asserts `.ant-pagination-options` is absent and `pageSize=50` is sent |
| jsdom lacks `matchMedia` | Render tests crash for a reason that is not the defect | The stub in `listPaging.test.tsx` (5.1). The red run must show the pager assertion failing, not a `matchMedia` TypeError |
| Out-of-order responses | Page 2's rows show under page 3's highlight | `latestOnly`; S3 |
| A delete or Mark handled leaves the user past the last page | Empty list with rows still in the set | The clamp rule in 3.1 (4); S8 |
| After an upload the new image is on page 1 but the library stays on page 2 | Staff cannot see what they uploaded; e2e 10.15 and P2.8 could fail | Upload loads page 1 (3.1, 4); those e2e tests still run in `studio` |
| The pager clashes with the navy look | The settled design is broken | The token-only `components.Pagination` override (3.2). E1's computed-style assertions on the inbox pager and E2's on the audit table pager fail on any light or wrong item background |
| A pager `nav` label matches the sidebar locator | `getByRole("navigation", { name: "Studio" })` finds two elements; existing specs fail in strict mode | Fixed labels without "Studio" (3.1, 2); E1 asserts the sidebar locator still matches exactly one |
| A page click sends typed but unsubmitted filters | Rows and the pager's total disagree | Applied and typed values kept apart (3.1, 4); S2 and S6 |
| The red `studio` run is cancelled by the next push | No end-to-end red evidence | Push nothing after commit 1 until its run has conclusion `failure` (5.4) |
| E2 stops half-way and leaves redirects behind | Later specs see 51 extra redirects | Deletes in `try/finally` (5.1) |
| The preview error fires on a healthy API | Preview breaks for staff | It fires only when a whole non-empty page adds no new id. A one-row shift is dropped, not an error (P3). P1 guards the healthy case |
| E2's 51 redirects or the extra audit entries affect later specs | Other e2e tests change | E2 deletes its redirects in `finally`. No later test asserts a redirect count or an absolute audit count (P2.1 reads only the newest 8 audit entries for "real activity") |
| A redirect rule from ADM-02 or ADM-07 rejects E2's paths | E2 fails after those changes | The paths are lowercase, with no trailing slash, and target `/`: valid under today's and the planned rules (as ADM-06a test 4) |
| Equal timestamps on the inbox or audit lists | The marker is not exactly 51st | Every filler is created after the marker by a separate, later request, so it is newer. A tie would fail E1 or E2, never pass them wrongly |
| Later G3 items edit the same screens in parallel | Merge conflicts | ADM-06b is next in slot 2 (2.8); the others rebase on it |
| `npm ci` changes the lockfile | B-7 broken | `git diff --exit-code` on `package.json` and `package-lock.json` (5.3) |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Fix: paging controls on the audit screen | Audit ADM-06, Fix 2; moved from ADM-06a | Planned | |
| Fix: paging controls on the inbox screen | Audit ADM-06, Fix 2; moved from ADM-06a | Planned | |
| Fix: paging controls on the media library | Audit ADM-06, Fix 2; moved from ADM-06a | Planned: unit (S9, S10) plus ADM-06a's `Media_list_returns_page_two`; no end-to-end (media end-to-end belongs to ADM-16) | |
| Media picker reaches images past the newest 24 | Audit ADM-06, bullet 3 | Planned: unit (S11, S12) plus ADM-06a's `Media_list_returns_page_two`; no end-to-end (media end-to-end belongs to ADM-16) | |
| Studio reaches enquiries past the 50th (the reason it is a Blocker) | Audit ADM-06, bullets 3 and 5; moved from ADM-06a | Planned | |
| Studio reaches audit entries past the 50th | Audit ADM-06, bullet 3; moved from ADM-06a | Planned | |
| Studio reaches media past the newest 48 | Audit ADM-06, bullet 3; moved from ADM-06a | Planned: unit (S9 to S12) plus ADM-06a's `Media_list_returns_page_two`; no end-to-end | |
| Preview loader never repeats items (Studio test) | Audit ADM-06, bullet 4; moved from ADM-06a | Planned | |
| Redirects screen reaches redirects past the 50th | Audit ADM-06, bullet 2; ADM-06a 3.3 asked for a decision (3.4: in scope) | Planned | |
| Pager follows the navy look (`components.Pagination` override) | `docs/phase-b-studio.md` lines 480 and 501; `AGENTS.md` settled design | Planned (E1, E2 computed styles) | |
| Collection list past 100 | Audit ADM-06, bullet 2; ADM-06a 3.3 asked for a decision | Moved to ADM-08: "For ADM-08" in `implementation.md` and the PR body (3.4) | |
| Overview counts past 100 (`OverviewPage.tsx:28`) | Found here (2.3) | Moved to ADM-08: "For ADM-08" in `implementation.md` and the PR body (3.4) | |
| Merge order: final head contains #49 | Found here (3.5) | Planned (`merge-base --is-ancestor` at gate 2) | |
| Studio end-to-end test past page 1 | ADM-06a 3.3 and 5.5 | Planned | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Planned (CI red for E1 and E2 waits on O-ADM06B-1) | |
| ADM-06 closed (ADM-06a and ADM-06b both merged) | ADM-06a 3.3 | Planned | |

## 12. Revision log

- **Round 1 (11 November 2026):** first version.
- **Round 2 (11 November 2026):** answers `plan-review.md` Round 1, which ended
  CHANGES NEEDED. O-ADM06B-1 stays PENDING; nothing in this round assumes an
  answer.
  - **Finding 1, Major: CI does not enforce the merge order, and the effect of an
    early merge was understated.**
    - Accepted. 3.5 now says the integrator keeps the order. There is no branch
      protection, and `pull_request` runs test the head merged with the base of
      the moment, so E1 and E2 warn and do not enforce.
    - The safeguards are added:
      - the pull request is a draft whose first line is "Do not merge before #49
        (ADM-06a)." until #49 has merged and the base is merged into the head;
      - the tester and gate 2 quote `git merge-base --is-ancestor <#49 squash sha> <head>`
        giving 0 (3.5, 5.4, coverage row);
      - the integrator merges #49 first.
    - The effect is corrected in 3.5, 5.1 and the risk table: every request sends
      `page=`, so every paged screen shows 20 rows while the pager counts 50 or
      48. E1 fails at its 50-card check and E2 at the audit log's 50-row check.
  - **Finding 2, Major: `Pagination` is in the design's "needs overrides" table, and
    the look check had no criterion.**
    - Accepted, option (a). 2.5 is corrected: line 501 sits in the table at line
      480, and `theme.ts` has no `Pagination` entry.
    - 3.2 brings a token-only `components.Pagination` override into scope:
      `itemBg` and `itemLinkBg` `surfaces.card`, `itemActiveBg` `surfaces.raised`,
      `itemActiveColor` and `itemActiveColorHover` `accent.studio`, `itemInputBg`
      `surfaces.input`. The token names and their defaults were read from antd
      6.6.5 `es/pagination/style/index.js:417,426,440-445,566-577`. `theme.ts`
      moves into "Files to change"; option (b) is listed as rejected in 3.3.
    - E1 now asserts computed colours on the inbox pager: non-active item
      `rgb(14, 27, 44)` with text `rgb(244, 248, 252)`; active item
      `rgb(17, 31, 50)` with text `rgb(31, 158, 233)`. E2 asserts the backgrounds
      on the audit table's pager.
    - `appearance.spec.ts` is removed as a safeguard for this risk, with the
      reason (3.2).
  - **Finding 3, Minor: the red run can be cancelled.** Accepted. 5.4 now says
    nothing is pushed after commit 1 until the `studio` check run on it has
    conclusion `failure`, checked with `gh api .../check-runs`. A `cancelled` run
    is not evidence and is re-run. It cites the `concurrency` group in `ci.yml`
    (lines 23-25) and ADM-06a's cancelled run.
  - **Finding 4, Minor: E2's cleanup.** Accepted. Each created redirect's id is
    recorded at once, and the deletes run in `try/finally`, so a red run or a
    half-way failure still cleans up. 5.1 says E1's enquiries stay until the next
    reset and why that is harmless (10.19 finds its own, newer enquiry on page 1).
  - **Finding 5, Minor: the ADM-08 destination.** Accepted. 3.4 names three
    records that ADM-08's architect will find without any edit outside scope:
    - the coverage rows "Collection list past 100" and "Overview counts past 100";
    - a "For ADM-08" section in `implementation.md`, naming
      `CollectionListPage.tsx:63,65-69,76` and `OverviewPage.tsx:28`;
    - the same section in the PR body.
    The coordinator also passes the note on.
  - **Finding 6, Minor: applied or typed filters.** Accepted. 3.1 (4) fixes the
    rule: page clicks and reloads use the last applied search or filters, never
    unsubmitted input. S2 and S6 now click "2" after typing but before submitting,
    and assert that the request carries the applied values.
  - **Finding 7, Minor: "Studio" in the pager labels.** Accepted. 3.1 (2) fixes the
    labels to "Inbox pages", "Media library pages" and "Image picker pages", and
    forbids "Studio" in them, with the reason. E1 asserts the sidebar locator still
    matches exactly one element. A risk row is added.
  - **Finding 8, Minor: media end to end, and the coverage rows.** Accepted.
    - 5.1 weighs an e2e-only `Media__UploadPermitLimit` in `e2e/env.ts` against
      its precedent. It is left out for three reasons:
      - it changes the shared harness in a Studio-screens pull request (B-8);
      - 49 unique, processed uploads add run time to every CI run;
      - ADM-16, a Major with "paging" in its fix, needs its own end-to-end test
        and can argue the harness change there.
    - The three media rows in section 11 now say "unit (S9 to S12) plus ADM-06a's
      `Media_list_returns_page_two`; no end-to-end".
