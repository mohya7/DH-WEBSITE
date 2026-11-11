# ADM-06b: plan review

## Round 1

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-06b/plan.md`,
round 1, in worktree `/home/user/dh-change-adm06b` (branch `change/ADM-06b`, base
`f171f7a`). No earlier review rounds.

Read: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md` and
`docs/PROJECT_PROFILE.md` (from `origin/claude/cool-heisenberg-mh6zx9`),
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`,
`/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`,
`docs/phase-b-studio.md`, ADM-06a's records in `/home/user/dh-change-adm06/docs/changes/ADM-06/`.
Every check below was read-only.

### Findings

**1. Major. Sections 3.5, 5.1 ("On ADM-06b without ADM-06a") and 10 (first risk row):
nothing in CI stops ADM-06b from merging before ADM-06a, and the plan gets wrong
what happens if it does.**

- What is wrong, part 1: 3.5 says "Merge order is enforced by a test ... CI cannot go
  green, so ADM-06b cannot merge before ADM-06a." A red check does not block a merge
  here. The integration branch has no protection and no required checks:
  ```
  $ gh api repos/mohya7/DH-WEBSITE/branches/rebuild%2Fdotnet-platform --jq '{protected, protection}'
  {"protected":false,"protection":{"enabled":false,"required_status_checks":{"checks":[],"contexts":[],"enforcement_level":"off"}}}
  ```
  `ENGINEERING_STANDARDS.md` P-1 says the same: "Partial: no branch protection
  recorded". So the order depends on the integrator, as it does for every other PR.
  The E1 and E2 tests only warn. Also, `ci.yml` runs on `pull_request`, which tests
  the PR head merged with the base as it is at the time of the run. A run started
  before #49 merges stays red, and one started after #49 merges is green whether or
  not the head contains ADM-06a. A test does not "enforce" anything about the head.
- What is wrong, part 2: the plan describes ADM-06b-without-ADM-06a as "the pager
  shows, but page 2 comes back as page 1 of 20" and "staff see page 1 twice"
  (risk table). That understates it. After ADM-06b, every screen sends `page=` on
  every request, page 1 included. Before ADM-06a, any request with `page=` binds the
  whole `PageQuery` under the `page.` prefix, so `pageSize` is lost too (audit:
  "`?page=2&pageSize=5` returns page 1 of 20"; plan 2.2). Merged alone, ADM-06b
  would cut the inbox, audit log and redirects from 50 rows to 20, the library from
  48 to 20 and the picker from 24 to 20, while the pager still counts 50 or 48 per
  page. That is worse than today. E1 would fail earlier than the plan says, at
  "Page 1 shows 50 `article.contact-card`", not at "marker visible".
- What would satisfy me:
  - 3.5 and the risk row say the order is kept by the integrator, not by CI. They
    name the safeguards the plan can control, for example: the PR stays a draft (or
    its body opens with "Do not merge before #49") until #49 has merged, and the
    delivery approval checks that the base merged into the final head contains
    #49's squash commit.
  - 5.1 and section 10 describe the real effect without ADM-06a: 20 rows a page on
    every paged screen, and E1/E2 failing at the 50-row assertions.

**2. Major. Sections 2.5, 3.2 and 10 (pager clash row): the plan misreads the design
document it cites. Its only design check is a look at screenshots, with no criterion.**

- What is wrong: 2.5 says `docs/phase-b-studio.md` line 501 "already lists antd
  `Pagination` among the themed components". It does not. Line 501 is in the table
  introduced at line 480 as "These components will fight the language and need
  `components` overrides or a thin wrapper". Its row reads:
  "`Pagination` / `Empty` / `Result` / `Spin` | Default illustrations and light
  wells." `studio/src/theme.ts` has overrides for `Button`, `Input`, `Select`,
  `Table`, `Card` and others, but none for `Pagination`
  (`grep -n "Pagination" studio/src/theme.ts`: no output). Section 4 still puts
  `theme.ts` out of scope. Section 10 lists `appearance.spec.ts` as a safeguard, but
  that spec checks only `body` background and sidebar width (`expectOldStudio`). It
  runs first in alphabetical order, when the inbox and the other screens are probably
  on a single page, so `hideOnSinglePage` hides the pager and the spec never sees it.
  As a result, the plan adds a component the settled design document names as off
  style, keeps the one file that themes components out of scope, and relies on "if
  those screenshots show the pager clashing ... the developer stops", with nothing
  that defines a clash.
- What would satisfy me: correct 2.5. Then decide before gate 1, in one of two ways:
  - (a) Bring a `components.Pagination` override in `theme.ts` into scope, built
    only from the existing tokens (`surfaces.*`, `text.*`, `border.subtle`,
    `accent.studio`), as the design document asks. This applies the settled design;
    it does not change it.
  - (b) Show evidence that antd 6.6.5 with the dark algorithm and the current tokens
    renders no light item or well, for example a computed-style read from a scratch
    render.

  In both cases, add a concrete assertion to E1 (for example the computed
  `background-color` of `.ant-pagination-item` and `.ant-pagination-item-active`
  equals or derives from a studio surface token, and is not light) so that the
  "clash" check passes or fails without anyone's judgement. Remove `appearance.spec.ts`
  from the safeguards for this risk, or say why it covers it.

**3. Minor. Section 5.4 (red end-to-end): the red run can be cancelled by the next
push.**

- `ci.yml` has `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
  That already happened on ADM-06a: on `c870b7e` (the red commit) the check run
  "Studio — typecheck, build, end-to-end" ended `cancelled`. Only `api` showed the red.
- What would satisfy me: 5.4 says commits 2 and 3 are pushed only after the `studio`
  job on commit 1 has reached a conclusion of `failure`, with E1 and E2 named in its
  log. A cancelled run is not red evidence.

**4. Minor. Section 5.1, E2: cleanup is "at the end", so the red run leaves its data
behind.**

- In the planned red run, E2 stops at the pager locator, so its 51 redirects are
  never deleted, and preview, studio and verification specs then run against them.
  I found no later spec that counts redirects (`grep -n -i redirect studio/e2e/*.ts`:
  only screen names in `appearance.spec.ts` and `verification.spec.ts`), so the
  impact is small. But 5.4 requires "fail E1 and E2 ... and nothing else", and that
  should not depend on luck.
- What would satisfy me: cleanup in `test.afterAll` or a `try/finally`, and a
  statement that the 51 enquiries from E1 stay until the next reset, which is
  harmless (10.19 finds its own enquiry by heading on page 1, newest first).

**5. Minor. Sections 3.4 and 11 (collection list "Moved to ADM-08 as an
observation"): the destination is not a record anyone will read.**

- Excluding the collection list matches the audit. Its Fix names "the audit, inbox
  and media screens", and the reorder argument (`canReorder` needs
  `page.total === page.items.length`, `CollectionListPage.tsx:63`) holds. But
  ADM-08 is in G3-2 (17 November to 11 December) and has no plan yet. An
  "observation passed to ADM-08" lives only in this plan. `AGENTS.md` says "Moved
  items name their destination".
- What would satisfy me: name the concrete place where the ADM-08 architect will
  find it (for example a line in this change's PR body and `implementation.md`
  coverage table under a heading "For ADM-08", or a note in the refinement plan's
  G3-2 tracking if the owner keeps one). The `OverviewPage.tsx:28` counts at
  `pageSize=100` should go there too.

**6. Minor. Sections 3.1 (4), 5.1 (S2, S6): the plan does not say which search or filter
a page change uses.**

- `AuditPage.load()` reads the typed values of `action`, `entityType`, `userId`
  and `range` from state (lines 44-50). `ContactInboxPage.load(term = search)` and
  `RedirectsPage.load(term = search)` read the typed search. If a page click calls
  `load` the same way, typing a new filter and then clicking "2" without pressing
  Filter pages through the new, unapplied filter. The pager's total then disagrees
  with the rows on screen.
- What would satisfy me: one sentence fixing the rule (page changes keep the last
  applied filter or search), and an assertion in S2 or S6 that a page click after
  typing, but before submitting, sends the applied values.

**7. Minor. Sections 3.1 (2), 4 (`ListPager.tsx`): the `nav` label must not contain
"Studio".**

- `appearance.spec.ts:36,59`, `studio.spec.ts:113` and `verification.spec.ts` find
  the sidebar with `getByRole("navigation", { name: "Studio" })`. Playwright matches
  names case-insensitively by substring unless `exact` is set, so a pager labelled,
  for example, "Studio inbox pages" would make those locators match two elements and
  fail in strict mode.
- What would satisfy me: the plan fixes the labels (for example "Inbox pages",
  "Audit log pages", "Media pages") and says they must not contain "Studio".

**8. Minor. Sections 5.1 ("Why media has no e2e test") and 11: the media rows should
say what proves them.**

- The upload limit is real (`Program.cs:113`, `Media:UploadPermitLimit` default 20,
  not raised in `e2e/env.ts`). The library needs 49 images and the picker 25.
  Splitting uploads between admin and editor (20 + 5) would use up the admin budget
  that 10.15 and P2.8 need later in the same hour. So leaving media out is
  defensible. But the rejected alternative is described too thinly. `e2e/env.ts`
  already raises `Contact__PermitLimit` and `Auth__LoginPermitLimit` "only for the
  e2e API", so an e2e-only `Media__UploadPermitLimit` has precedent and is not a
  production guard. The plan should say why that precedent is not followed (for
  example harness change kept out of a Studio-only PR, and run time for 49 unique
  uploads).
- Section 11 marks "Studio reaches media past the newest 48" and "Media picker
  reaches images past the newest 24" as plain "Planned". They should say "unit
  (S9 to S12) plus ADM-06a's API page-2 test for media; no end-to-end", so the
  tester does not read them as covered end to end.

### Checked and found sound

- **Fit.** The Done-when bullets in section 1 match `admin-audit-2026-10-28.md`
  lines 137-145 word for word. The batch exit gate and the track rule match
  refinement plan lines 221 and 225. The rows moved from ADM-06a match ADM-06a
  `plan.md` 3.3.
- **Scope choices against the audit.** Redirects are in: the audit's "Affected:
  audit, contact requests, redirects, media and every collection", the same
  `pageSize: "50"` and `pagination={false}` (`RedirectsPage.tsx:30,74`), and the
  same `Table` pattern. Adding redirects is the same topic (B-8). The collection
  list is out: it is not in the audit's Fix, and its reorder and count logic
  (`CollectionListPage.tsx:63-69`) needs the whole set. Only the destination record
  (finding 5) is weak.
- **Current state.** Every line reference in 2.3 checks out (`pageSize` at
  `AuditPage.tsx:45`, `ContactInboxPage.tsx:37`, `MediaLibraryPage.tsx:36`,
  `MediaPicker.tsx:51`, `RedirectsPage.tsx:30`, `CollectionListPage.tsx:76`; the
  only `pagination` uses are the four `pagination={false}` lines). Redirects are
  ordered by `FromPath` (`AdminStore.cs:113`), the audit by `At` descending
  (`:452`), contact requests by `CreatedAt` descending (`:485`), and media by
  `CreatedAt` descending (`MediaLibrary.cs:38`). So the "51st" placements in E1
  and E2 hold, and `-zz` sorts after `-49`.
- **Cut from the base.** ADM-06a touches only `api/` and `docs/changes/ADM-06/`
  (`git diff --stat a866cf6..4ab5809` in the ADM-06 worktree). ADM-06b touches only
  `studio/` and its own records. No file is shared. With squash merges (`(#43)`,
  `(#42)`, `(#41)` on the base), not stacking is the right choice, and 3.5's push
  sequence respects B-2, B-3 and B-5. PR #49 now carries the fix and records
  (head `4ab5809`, open, not merged). Its `studio` job passed and its `api` job passed.
- **Red order and reasons.**
  - `ci.yml` `studio` runs `tsc -b`, `npm test` and `build` before the end-to-end
    step, with no `if: always()`. So the end-to-end red does need commit 1 alone
    (subject to finding 3).
  - P2 and P3 are red today for the stated reasons. `published()`
    (`previewData.ts:54-62`) pushes every row with no id check. P2's 25-row case
    gives 40 rows. P3 gives 251 rows with id 100 twice. P1 passes today.
  - S1 to S12 are red at the missing pager: today's screens send only `pageSize`,
    which the fake answers correctly, and no screen renders `.ant-pagination`.
  - The U tests fail on a missing module, and the plan says so honestly.
  - Today's Studio fails E1 at the pager locator, after the 50-card assertion passes.
- **Test harness facts.** `vitest.config.ts` (node environment, `.test.ts(x)`),
  `tsconfig.node.json` (includes `test/**/*.ts`, excludes `test/previewData.test.ts`).
  The existing `previewData.test.ts` mocking pattern is reusable. `playwright.config.ts`
  uses 1 worker and a 90 s timeout. CI adds the `html` reporter
  (`--reporter=list,html,junit`) and uploads `reports/studio` and
  `studio/test-results` as `studio-e2e-report`, so screenshot attachments reach the
  reviewer. The contact limit is 1000 and the login limit is 1000 in `e2e/env.ts`.
- **Quality gates.** No gate, guard, baseline, workflow, config, harness or
  dependency is changed or weakened (P-6). `package-lock.json` is checked with
  `git diff --exit-code` after `npm ci` (B-7). The tarball reading was done outside
  the repository.
- **Security.** No route, policy or record scope changes. Calls stay on
  `studio/src/api/http.ts` (A-12). The audit log is still admin-only in the
  Studio (`AuditPage.tsx:36-42`) and the API. Page sizes stay within the API's
  `[Range(1, 100)]` (A-8). Rows are still rendered as text. No secrets. There are no
  migrations, and the plan uses the right database names (`DigitalHubContent_E2e`
  only).
- **Preview loader.** Fails closed (P-5) only when a whole non-empty page adds no
  new id. A single shifted row is de-duplicated (P3), and P1 guards the healthy
  path. The error message is the existing one, with no working-copy title or slug.
- **Owner decisions.** O-ADM06B-1 is PENDING, blocks only the push step, and is not
  inferred from ADM-06a or from "continue work". ADM-06a's own records still show
  O-ADM06-1 as PENDING (`delivery-approval.md:230`), so the plan is accurate when it
  says it has not seen the owner's words for it. The "No" branch does not let any
  role waive the rule. A NOT RUN red for E1 and E2, if the reviewer or tech lead
  reads the rule as covering them, goes to the owner as a D-NNN entry. No D-NNN is
  claimed.
- **Design otherwise.** No theme or CSS file is edited. The pager placement uses
  existing Tailwind 4 utilities (`index.css` imports `tailwindcss/utilities.css`).
  The design branch's `admin/admin.js` has no pager to copy. Only finding 2 remains.
- **Rollback** is a revert with no stored state or migration. **Risks** are
  specific and each names its check, apart from the two rows corrected in findings
  1 and 2.

Round 1 result: CHANGES NEEDED (two Majors, six Minors).

## Round 2

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-06b/plan.md`,
round 2 (revision log, section 12). Read-only checks only. The antd 6.6.5 sources
quoted below were read from the architect's tarball extract in the session
scratchpad (`.../scratchpad/adm06b-antd/x/package/es/`), outside the repository.

### Round-1 findings

1. **Major, merge order: resolved.** 3.5 now says the integrator keeps the order
   and cites the missing branch protection and the `pull_request` merge-ref
   behaviour. The plan adds three safeguards: a draft PR whose first line is "Do
   not merge before #49 (ADM-06a).", a `git merge-base --is-ancestor <#49 squash
   sha> <head>` check quoted at gate 2, and the integrator merging #49 first. The
   early-merge effect is corrected in 3.5, 5.1 and section 10: 20 rows a page, E1
   failing at the 50-card check, E2 at the audit log's 50-row check. This matches
   2.2 and the audit's "`?page=2&pageSize=5` returns page 1 of 20".
2. **Major, Pagination look: resolved.** 2.5 now quotes `docs/phase-b-studio.md`
   lines 480 and 501 correctly. Option (a) is taken: `theme.ts` moves into "Files
   to change" for one `components.Pagination` entry, and option (b) is rejected
   with a reason. The plan replaces the screenshot judgement with computed-style
   assertions in E1 and E2, and drops `appearance.spec.ts` as a safeguard. The two
   questions asked for this round are checked under "Pagination override" below.
3. **Minor, cancelled red run: resolved.** 5.4 waits for conclusion `failure` on
   commit 1's "Studio — typecheck, build, end-to-end" check run, using a
   `gh api .../check-runs` command. A `cancelled` run is re-run and not counted.
4. **Minor, E2 cleanup: resolved.** Ids are recorded as each redirect is created,
   and the deletes run in `try/finally`. The plan says why E1's 51 enquiries are
   harmless until the next reset.
5. **Minor, ADM-08 destination: resolved.** Coverage rows, a "For ADM-08" section
   in `implementation.md` and the PR body, with line references, carry the
   collection-list and Overview items. Two places still use the old wording
   (round-2 finding 2).
6. **Minor, applied versus typed filters: resolved.** 3.1 (4) states the rule.
   S2 and S6 now click "2" after typing without submitting and assert the applied
   values. Both are still red today at the missing pager.
7. **Minor, "Studio" in nav labels: resolved.** The labels are fixed ("Inbox
   pages", "Media library pages", "Image picker pages"), and E1 asserts the
   sidebar locator matches exactly one element.
8. **Minor, media end to end: resolved.** The `e2e/env.ts` precedent is weighed,
   and the three reasons are sound: B-8, run time, and ADM-16 owning a media
   end-to-end test as a Major. The media coverage rows now say "unit plus ADM-06a's
   `Media_list_returns_page_two`; no end-to-end".

### Pagination override (the two questions asked for this round)

**Token-only, and the settled design stays as it is: yes.**
- All six values are imports from `packages/theme/tokens.ts`. No new literal is
  introduced:

  | Token | Source | Value |
  | --- | --- | --- |
  | `itemBg` | `surfaces.card` | `#0E1B2C` |
  | `itemLinkBg` | `surfaces.card` | `#0E1B2C` |
  | `itemActiveBg` | `surfaces.raised` | `#111F32` |
  | `itemActiveColor` | `accent.studio` | `#1F9EE9` |
  | `itemActiveColorHover` | `accent.studio` | `#1F9EE9` |
  | `itemInputBg` | `surfaces.input` | `#091624` |

- All six are real component tokens in antd 6.6.5 (`es/pagination/style/index.js`
  `prepareComponentToken`, lines 566-577):
  - `itemBg` paints every item (line 417);
  - `itemActiveBg` and `itemActiveColor` style the active item (lines 440-445);
  - `itemInputBg` is used at line 149;
  - `itemLinkBg` is used in `bordered.js:53`.
- No existing screen renders `Pagination`. Users and Applications keep
  `pagination={false}`. So the entry changes no current screen, and nothing else
  in `theme.ts` or `index.css` changes. This applies the design document's own
  instruction (line 480, "need `components` overrides") and does not change the
  settled navy look. The active item stays distinct through antd's `colorPrimary`
  border (`action.primary`, `#1593DA`) and accent text, even though `#111F32` is
  close to `#0E1B2C`.

**The E1 and E2 colours match the tokens: yes.** The hex-to-rgb conversions all
check out:
- `#0E1B2C` is `rgb(14, 27, 44)`;
- `#111F32` is `rgb(17, 31, 50)`;
- `#1F9EE9` is `rgb(31, 158, 233)`;
- `#F4F8FC` is `rgb(244, 248, 252)`.

The non-active link colour is antd's `token.colorText` (line 426), which
`studioTheme` sets to `text.primary`, `#F4F8FC`. The active link colour is
`itemActiveColor`, and on hover `itemActiveColorHover`, which is the same value.
So the assertion holds even if the mouse is still on item 2, and the plan also
moves it away. Non-active hover and press use `colorBgTextHover` and
`colorBgTextActive` (lines 431-437), which moving the mouse avoids.
- One cascade point I checked: `studio/src/index.css:33` has an unlayered global
  `a { color: var(--dh-accent); }`. antd puts its styles in a cascade layer only
  when `ConfigProvider` gets `layer` (`es/config-provider/index.js:341-347`), and
  `App.tsx:12` does not set it. So antd's `.ant-pagination .ant-pagination-item a`
  (two classes) outranks the bare `a`, and the expected `rgb(244, 248, 252)`
  stands. If E1 ever reads the accent colour there instead, that is a real design
  finding, not a reason to loosen the assertion.
- `index.css:828-830` makes `.ant-table` and `.ant-table-wrapper` transparent. That
  does not touch `.ant-pagination-item`, so E2's table-pager checks read the same
  values.

### New findings (round 2)

**1. Minor. Section 3.2, the `itemActiveBg` row: the reason cites `theme.ts`
wrongly.**
- The row says `surfaces.raised` is the "Same choice as `Segmented`". In
  `studio/src/theme.ts:72-76`, `Segmented` uses `itemSelectedBg` and
  `itemActiveBg` `"rgba(31, 158, 233, 0.12)"` (an accent tint), not
  `surfaces.raised`. The value is still well supported by the design document's
  `Segmented` row ("active thumb to `surface.raised`") and by `Tag.defaultBg`.
- What would satisfy me: cite the design document row (and `Tag`) and drop "Same
  choice as `Segmented`". No value changes.

**2. Minor. Sections 4 ("Out of scope") and 5.5 (D-NNN row): the ADM-08 wording is
stale.**
- Both still say "an observation for ADM-08" / "goes to ADM-08 as an observation".
  3.4 and section 11 now name concrete records.
- What would satisfy me: point both to 3.4's "For ADM-08" records, so the tester
  checks the same destination everywhere.

**3. Minor. Section 5.1, E1 and E2 "read `getComputedStyle`": use the retrying
assertion.**
- A one-shot `evaluate(getComputedStyle)` read right after the page-2 render can
  race the re-render.
- What would satisfy me: write the checks as
  `await expect(locator).toHaveCSS("background-color", "rgb(...)")`, which retries
  within the 15 s `expect` timeout (`playwright.config.ts`), on the
  `.ant-pagination-item` and `.ant-pagination-item-active` locators and their `a`
  children. The criterion stays the same.

### Checked again and still sound

- Scope (redirects in, collection list out), cut from the base, the three-commit
  order and the red reasons for S1 to S12, P2 and P3 and E1/E2 are unchanged from
  round 1 and still hold. S2 and S6 now type before clicking "2", which still fails
  first at the missing pager today.
- `theme.ts` is the only new file in scope. It is a Studio file, and no parallel
  change touches it: open PRs #49 (`api/`, `docs/changes/ADM-06/`) and #44
  (GAP-07).
- No gate, guard, harness, workflow or dependency is weakened. `e2e/env.ts`,
  `playwright.config.ts` and `ci.yml` stay out of scope.
- Security, migrations (none), database names and rollback are unchanged and sound.
  The rollback now also reverts the `Pagination` entry, which nothing else uses.
- O-ADM06B-1 stays PENDING, blocks only the push, and is not inferred from ADM-06a
  or from "continue work". The "No" branch still sends any reading that E1/E2 red
  is required to the owner as a D-NNN entry. That is a delivery-time condition and
  does not block this plan.

Round 2 result: APPROVED (three Minors).

## Round 3

Reviewer: plan-reviewer, 11 November 2026. Plan: `docs/changes/ADM-06b/plan.md`,
round 3 (section 12), written after the developer's BACK TO ARCHITECT
(`implementation.md` at `cbff1f1`). Branch head `cbff1f1`. Commits `58caf70`
(e2e), `f1b4215` (unit tests), `8c4ab16` (fix), `cbff1f1` (record). Nothing
pushed. Read-only checks. My experiments ran from
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/r3/`,
with a symlink to the worktree's existing `studio/node_modules`. Nothing was
installed, and the worktree is unchanged apart from the architect's `plan.md`
edit.

### The five points asked for this round

**1. The `tsconfig.node.json` include, judged against P-6: sound.**
- The cause is as the developer reported. `tsconfig.node.json` is `composite: true`
  and lists Studio sources by name (`src/content/siteUrl.ts`,
  `src/content/model.ts`), so an imported `src` file that is not listed gives
  TS6307. I reproduced it with a scratch composite copy of the node project:
  - without the entry: `test/paging.test.ts(2,48): error TS6307: File '.../src/ui/paging.ts' is not listed ...`;
  - with `src/ui/paging.ts` added: that error is gone.
- With composite off, the node project plus `src/ui/paging.ts` type-checks with
  `tsc -p ... --noEmit`, exit 0. So `paging.ts` (no imports, only
  `URLSearchParams` from `@types/node`) compiles cleanly under `lib: ES2023`,
  `strict`.
- Against P-6: the entry adds a file to a type-check gate and removes nothing.
  Rejecting (c), excluding the test, is right: that would take a file out of a
  gate when a non-weakening fix exists. Rejecting (b), renaming to `.tsx`, is also
  right: no `.tsx` test is type-checked by either project, so it is (c) by another
  name.
- Option (a) follows the existing pattern exactly. Section 4 keeps every other
  line of the file out of scope. A file in both projects is already the case for
  `siteUrl.ts` and `model.ts`.

**2. The two jsdom workarounds: accepted.**
- The `ResizeObserver` stub, like `matchMedia`, fills a browser API jsdom lacks,
  asserts nothing and stays in `listPaging.test.tsx` only. Vitest isolates
  environments per file, so it does not leak.
- `ConfigProvider theme={{ token: { motion: false } }}` around S11 and S12 uses
  antd's own motion switch, in the test only. The picker still loads in
  `afterOpenChange` (`8c4ab16`, `MediaPicker.tsx:119-123`), so the path under test
  is the production path. Real motion is still covered in CI by 10.15 and P2.8,
  which open the picker in Chromium.
- The developer's evidence: the first red run failed S5 and S6 on
  `ReferenceError: ResizeObserver is not defined`, and S11 and S12 on "Unable to
  find an element with the text: Image 001". The run committed in `f1b4215` fails
  all twelve S tests at `getByTitle("2")`, as 5.1 requires. Both shims were made
  before the red commit and reported, not hidden.

**3. The picker search reset and the new S12 assertions: acceptable, with one Minor
(new finding 1).**
- Before ADM-06b, `afterOpenChange` called `load(search)` with whatever was in the
  box (`f171f7a`, `MediaPicker.tsx:94-95`). Under the round-2 rule, `8c4ab16` loads
  with `applied` while the box keeps the typed text. That leaves exactly the
  box/result mismatch the plan says it is fixing. Resetting the box on opening
  removes it.
- The new S12 assertions (the typed term is not sent on reopening, and the box shows
  the applied search) would pass the request half and fail the box half on
  `cbff1f1`, which matches the plan's stated red ("the box still shows the typed
  term").
- See new finding 1 on the choice of direction and new finding 2 on the commit
  shape.

**4. The corrected test count: correct.**
- `test/previewData.test.ts` at `f171f7a` has two `it` (lines 50, 64) and one
  `it.each` with five rows (lines 73-79): 7 tests.
- Plus P1 to P3, that file has 10. With 12 S tests and 3 U tests, the three files
  hold 25 tests.
- The developer's green run quotes `Tests 25 passed (25)`. The red run quotes
  `14 failed | 8 passed (22)`: 12 S, P2 and P3 failed; the 7 existing tests and P1
  passed; `paging.test.ts` failed to load. That is consistent.
- The commit 4 S12 assertions extend an existing test, so the count stays 25.

**5. A new commit 4 on top of `cbff1f1`: sound, with two Minors (new findings 2 and 3).**
- Adding a commit instead of rewriting keeps the SHAs that `implementation.md`
  quotes valid. Commit 1, `58caf70`, stays the e2e-only commit to push alone for
  the red run.
- At `58caf70`, `tsc -b` passes, because no `tsconfig` includes `e2e/*.spec.ts`.
  The developer type-checked the spec with a scratch config, exit 0. So the
  `studio` job reaches the end-to-end step on that push.
- The intermediate commits `f1b4215` and `8c4ab16` fail `tsc -b`. That does not
  matter: CI runs only on each pushed head, and the second push's head will contain
  commit 4.

### Round-2 Minors

- Round 2, finding 3 (retrying CSS assertions): **met in code.**
  `58caf70:studio/e2e/paging.spec.ts:29-30,78-79` uses `toHaveCSS`. The constants
  at lines 15-18 equal `surfaces.card`, `surfaces.raised`, `accent.studio` and
  `text.primary` (`rgb(14, 27, 44)`, `rgb(17, 31, 50)`, `rgb(31, 158, 233)`,
  `rgb(244, 248, 252)`). `8c4ab16:studio/src/theme.ts:85-92` has exactly the six
  token-only entries the plan lists. 5.1 still says "read `getComputedStyle`".
  That is a wording nit only.
- Round 2, findings 1 and 2: **still open, carried as Minors** (new finding 4).

### New findings (round 3)

**1. Minor. Sections 3.1 (4) and 4 (`MediaPicker.tsx`): the reset discards input,
and an alternative that keeps today's behaviour was not weighed.**
- Today, reopening the picker searches with whatever is in the box. Round 3
  resets the box and drops an unsubmitted term instead. A second option also
  keeps box and images in agreement and changes nothing staff see today: treat
  opening as a submit, so on opening `applied` is set to the box's text and page 1
  loads with it. Under the round-2 rule ("only a submit copies typed to applied")
  that needs one more named submit, which is a small, clear amendment.
- Discarding the text is a minor UX change outside the ADM-06 defect. I do not
  rate it as an owner decision under P-7. But the plan should either pick the
  option that keeps today's behaviour, or state in 3.3 why discarding is
  preferred and list it under section 9 "Noted, not a decision" so the owner sees
  it at the gate.

**2. Minor. Section 5.2, commit 4: the new assertions and the code they test go into
one commit.**
- The plan shows S12's new red only by a local run "on `cbff1f1` with the new
  assertions before the `MediaPicker.tsx` edit". The pipeline's pattern, and the
  G3 rule "regression test is committed and shown failing before the fix", is
  red-then-fix as separate commits. Splitting costs nothing, since nothing has
  been pushed:
  - 4a: `tsconfig.node.json` plus the S12 assertions, red, quoted;
  - 4b: `MediaPicker.tsx`, green.
- What would satisfy me: split commit 4 that way. Or, if the plan keeps one commit,
  say why the in-commit red is enough. I accept the plan's argument that this is
  the change's own behaviour, not the audit defect, so this is not a Major.

**3. Minor. Sections 3.5 (sequence, step 2) and 5.2/5.4: the rebase rule conflicts
with "`58caf70` is pushed alone".**
- 3.5 step 2 still says to rebase the unpublished commits onto the current base
  before the first push if ADM-06a has merged by then. That would replace
  `58caf70` and every SHA in `implementation.md`. Also,
  `origin/rebuild/dotnet-platform` has already moved: `git ls-remote` gives
  `3e1fc47`, one commit past `f171f7a` (#50, semgrep-timeout, `.github/security/*`
  and its records only, no `studio/` file). #49 is still open, not merged.
- What would satisfy me: one rule. For example, "push `58caf70` as it is; the
  `pull_request` run tests it merged with the current base anyway; after the push,
  bring the base in only by `git merge` (B-3, B-5)". Drop or narrow step 2 so it
  cannot rewrite the commits that 5.4 and `implementation.md` name.

**4. Minor, carried from round 2 (findings 1 and 2), still unchanged in the text.**
- 3.2's `itemActiveBg` row still says "Same choice as `Segmented`" (plan line 366).
  `theme.ts` `Segmented` uses an accent tint.
- Section 4 "Out of scope" (line 563) and the 5.5 D-NNN row (line 860) still say
  "observation for ADM-08" instead of pointing to 3.4's "For ADM-08" records.

### Checked and still sound

- **Owner decision.** O-ADM06B-1 is ANSWERED in section 9 with the owner's exact
  words, "Yes, red test first like #49" (Mohamed Elbadry, 11 November 2026, project
  thread), and the same quote is in `implementation.md` section 2. The plan applies
  it only to ADM-06b. It still does not infer ADM-06a's decision from "continue
  work". 5.4 keeps the draft-PR first line and the wait for `failure`. No D-NNN is
  needed.
- **Scope.** The new files in scope are `tsconfig.node.json` (one entry) and the
  existing `MediaPicker.tsx` and `listPaging.test.tsx`. `8c4ab16`'s 14 changed
  files match section 4. There is no dependency, workflow, harness or `api/`
  change, and #50 on the base shares no file.
- **Gates.** Nothing is weakened (P-6). `tsc -b`, `npm test`, `npm run build` and
  the preview design check are all required green after commit 4 (5.3), and CI
  `studio` runs the same.
- Everything approved in rounds 1 and 2 (design, pager tokens, merge-order
  safeguards, E1/E2, red reasons, security, rollback) is unchanged by round 3.

Verdict: APPROVED
