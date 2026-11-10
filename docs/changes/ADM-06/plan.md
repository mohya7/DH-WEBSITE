# ADM-06: plan

Change id: `ADM-06`. Branch: `change/ADM-06`, worktree `/home/user/dh-change-adm06`,
cut from `origin/rebuild/dotnet-platform` at `cc99e20`, not tracking it.
Architect, round 2, 10 November 2026. Round 1 came back CHANGES NEEDED
(`plan-review.md` Round 1, four findings). Section 12 answers each one.

**This change is ADM-06a, the first of two.** It fixes the API binding and adds
the page-2 tests. The Studio paging controls are ADM-06b, a follow-up change
(section 3.3 says why). ADM-06 closes only when both have merged.

## 1. Item

- **Closes (with ADM-06b):** ADM-06, "paging is broken on every list endpoint",
  `docs/quality/admin-audit-2026-10-28.md` lines 133-145. It also feeds two rows
  of that audit's requirement table: FR-S-15 audit log ("Paging and filters
  broken (ADM-06, ADM-15)") and FR-S-18 contact inbox ("Only the newest 50
  reachable (ADM-06)"), plus FR-S-07 media ("limited to the newest 48 or 24
  (ADM-06, ADM-16)").
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. It is the first
  item in the batch's order: "G3-1: the admin blockers (ADM-06, 03, 02, 07, 10,
  05, 04, 12, 01a)" (refinement plan, Execution order, step 2).
- **Owner's request:** "merge  and start next task" (Mohamed Elbadry,
  10 November 2026, project thread). The orchestrator took ADM-06 as the next
  task. Wave 1 (slot 1) is separate work with open PRs #40 to #44.
- **Done when**, quoted from the audit:
  > - `[FromQuery] PageQuery page` makes `page=` a binding prefix, so `?page=2&pageSize=5`
  >   returns page 1 of 20. I re-ran it: page 1, pageSize 20, total 240.
  > - Affected: audit, contact requests, redirects, media and every collection.
  > - Only the newest 50 enquiries and audit entries can be reached. The media library
  >   shows the newest 48 of 56, the picker the newest 24.
  > - The preview loader (`studio/src/preview/previewData.ts:56-61`) would repeat items
  >   past 20.
  > - Ranked a blocker because enquiries past the 50th become unreachable.
  > - Fix:
  >   - Rename the parameter, or bind with `Name = ""`.
  >   - Add paging controls to the audit, inbox and media screens.
  >   - Add a page-2 test per endpoint.
- **Batch exit gate**, quoted from the refinement plan, Track G3:
  > A clean website build from `DigitalHubContent_Studio` with no patched content;
  > each blocker reproduced before its fix and passing after it
- **Track rule** (refinement plan, Track G3): "Every fix carries a regression
  test that fails first." `docs/changes/README.md`, G3 checklist: "The
  regression test is committed and shown failing before the fix."

### Required reading

| Document | Where read | Present |
| --- | --- | --- |
| `docs/changes/README.md`, `.claude/agents/architect.md` | worktree | Yes |
| `AGENTS.md` | worktree | Yes |
| `ENGINEERING_STANDARDS.md` | `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md` | Yes, not on the base |
| `docs/PROJECT_PROFILE.md` | same branch, `git show` | Yes, not on the base |
| `docs/deferred-items.md` | same branch, `git show` ("No entries yet.") | Yes, not on the base |
| `docs/quality/refinement-plan-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes |
| `docs/quality/admin-audit-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes |
| `docs/adr/0001-split-public-forms-api.md` | not needed (G2 only); `docs/adr/` does not exist on the base | n/a |

Rules that apply: P-4 (failing test before the fix), P-6 (never weaken a test),
P-7 (owner decides), P-8 (evidence), B-6 (red test committed before the fix),
B-8 (one topic), A-8 ("Lists are paginated with a maximum page size", listed as
Met through "`ConventionTests` page envelope"; section 2.3 shows why that test
missed this defect).

## 2. Current state

### 2.1 The five paged list actions

`PageQuery` (`api/src/DigitalHub.Api/Conventions/PageQuery.cs:5-12`):

```csharp
public sealed class PageQuery
{
    [Range(1, 10_000)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 20;
}
```

`grep -rn "PageQuery" --include=*.cs` finds it bound, as `[FromQuery] PageQuery page`,
in exactly five production actions:

| Route | Action | Policy | Store call |
| --- | --- | --- | --- |
| `GET /api/v1/media` | `MediaController.List`, `MediaController.cs:17` | `studio` (admin, editor) | `MediaLibrary.ListAsync`, `MediaLibrary.cs:24`, newest first by `CreatedAt` |
| `GET /api/v1/redirects` | `RedirectsController.List`, `AdminControllers.cs:33` | `studio` | `AdminStore.ListRedirectsAsync`, `AdminStore.cs:101`, by `FromPath` |
| `GET /api/v1/audit` | `AuditController.List`, `AdminControllers.cs:109-117` | `studio-admin` | `AdminStore.ListAuditAsync`, `AdminStore.cs:428`, newest first by `At` |
| `GET /api/v1/contact-requests` | `ContactRequestsController.List`, `AdminControllers.cs:128` | `studio` | `AdminStore.ListContactRequestsAsync`, `AdminStore.cs:470`, newest first by `CreatedAt` |
| `GET /api/v1/{collection}` (all eight collections) | `ContentController.List`, `ContentController.cs:18` | `[StudioAccess]` (admin, editor; HR for vacancies) | `ContentStore.ListAsync`, `ContentStore.cs:33`, by sort order or title, then slug |

The sixth use is the test-only probe, `ConventionProbeController.List([FromQuery] PageQuery query)`,
`api/tests/DigitalHub.Api.Tests/ConventionProbeController.cs:33`. Its parameter
is named `query`, not `page`.

The stores all page correctly with `Skip((page - 1) * pageSize).Take(pageSize)`
and return `PageResult<T>(Items, Page, PageSize, Total)`. The defect is only in
model binding.

### 2.2 Reproduced: the binding defect, with the fix candidates

A throwaway ASP.NET Core app, built with the .NET SDK 10.0.114 in this container,
copies `PageQuery` and binds it four ways. It lives outside the repository, in
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm06-bind/Program.cs`,
and ran on `127.0.0.1:4291` (Claude Code's 42xx range). I stopped the process
afterwards. The actions:

```csharp
[HttpGet("current")] public object Current([FromQuery] PageQuery page)              // today's code
[HttpGet("named")]   public object Named([FromQuery(Name = "")] PageQuery page)     // audit's fix, per action
[HttpGet("renamed")] public object Renamed([FromQuery] PageQuery paging)            // audit's other fix
[HttpGet("typed")]   public object Typed([FromQuery] PageQueryTyped page)           // [ModelBinder(Name = "")] on the class
```

Output (`curl -s -w " [%{http_code}]"`, bodies cut at 160 characters):

```
current  page=2&pageSize=5      {"page":1,"pageSize":20} [200]
current  pageSize=5             {"page":1,"pageSize":5} [200]
current  page=2                 {"page":1,"pageSize":20} [200]
current  page=0                 {"page":1,"pageSize":20} [200]
current  page=2&pageSize=500    {"page":1,"pageSize":20} [200]
current  paging=3               {"page":1,"pageSize":20} [200]
current  page.page=3            {"page":3,"pageSize":20} [200]
named    page=2&pageSize=5      {"page":2,"pageSize":5} [200]
named    pageSize=5             {"page":1,"pageSize":5} [200]
named    page=2                 {"page":2,"pageSize":20} [200]
named    page=0                 {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"errors":{"Page":["The field Page mu
named    page=2&pageSize=500    {...,"status":400,"errors":{"PageSize":["The field Pag
named    paging=3               {"page":1,"pageSize":20} [200]
named    page.page=3            {"page":1,"pageSize":20} [200]
renamed  page=2&pageSize=5      {"page":2,"pageSize":5} [200]
renamed  page=2                 {"page":2,"pageSize":20} [200]
renamed  page=0                 {...,"status":400,"errors":{"Page":[...
renamed  page=2&pageSize=500    {...,"status":400,"errors":{"PageSize":[...
renamed  paging=3               {"page":1,"pageSize":20} [200]
typed    page=2&pageSize=5      {"page":2,"pageSize":5} [200]
typed    pageSize=5             {"page":1,"pageSize":5} [200]
typed    page=2                 {"page":2,"pageSize":20} [200]
typed    page=0                 {...,"status":400,"errors":{"Page":["The field Page mu
typed    page=2&pageSize=500    {...,"status":400,"errors":{"PageSize":["The field Pag
typed    paging=3               {"page":1,"pageSize":20} [200]
typed    page.page=3            {"page":1,"pageSize":20} [200]
```

What this shows:

1. The audit's finding is exact. `?page=2&pageSize=5` gives page 1, size 20.
2. The mechanism: when any query key equals the parameter name (`page`), MVC
   binds the object under the prefix `page.` (it finds `page.page=3`) and never
   falls back to the root. Without a `page` key it does fall back, so
   `?pageSize=5` alone works. That is why every Studio screen "works": none of
   them sends `page`.
3. A second defect follows: once `page` is sent, the `[Range]` limits are never
   checked. `page=0` and `pageSize=500` are silently replaced by the defaults
   instead of returning 400.
4. All three fixes work for these inputs. The type-level attribute fixes every
   use without changing a controller (section 3).

### 2.3 Why the existing tests did not catch it

- `ConventionTests.Notes_list_uses_the_page_envelope`
  (`ConventionTests.cs:30-45`) calls `?page=1&pageSize=2` on the probe. The
  probe's parameter is named `query`, so there is no prefix clash and the test
  passes. No production action uses that name.
- Every other test that pages sends only `pageSize`:
  `ContentApiTests.cs:482,495,503` (`/api/v1/services?pageSize=100`) and
  `AdminApiTests.cs:439,443,447,454` (`/api/v1/audit?...&pageSize=100`). A grep
  for `page=` in `api/tests` finds only the probe call.

### 2.4 Callers

- Studio (`grep -rn "pageSize\|page=" studio/src`): only the preview loader sends
  `page`, at `studio/src/preview/previewData.ts:54-63` (function `published`,
  request on line 57: `?page=${page}&pageSize=100&status=published`). Because
  `page` is present, the API returns 20 rows of page 1 each time. The loop ends
  when `rows.length >= body.total`, so a collection with more than 20 published
  items gets page 1 repeated. The loader's code is correct for a working API;
  **the API fix alone corrects it**.
- The screens send only `pageSize` and have no paging control:
  `AuditPage.tsx:45` (50, `pagination={false}` on line 74),
  `ContactInboxPage.tsx:37` (50), `MediaLibraryPage.tsx:36` (48),
  `MediaPicker.tsx:51` (24), `RedirectsPage.tsx:30` (50, `pagination={false}`
  on line 74), `CollectionListPage.tsx:76` (100), `OverviewPage.tsx:28,42`,
  `AppShell.tsx:34,46,123`, and the reference search boxes in `FormWalker.tsx:249`,
  `InlineTextEditor.tsx:198`, `RichTextEditor.tsx:222`, `NavigationPage.tsx:140`
  (8 each). Their behaviour does not change with this fix.
- Website and packages: no call sends `page` or `pageSize`. Studio end-to-end:
  `studio/e2e/verification.spec.ts:48` sends only `pageSize=100`.

### 2.5 What runs in this container

- .NET SDK 10.0.114, sourced from the scratchpad's `dn.sh`. A Release build of
  `api/tests/DigitalHub.Api.Tests` succeeded: `exit=0`, `13 Warning(s)`,
  `0 Error(s)`. The tree stayed clean: `bin/` and `obj/` are ignored.
- No SQL Server. Tests that do not touch the database still run. I pointed the
  connection string at an unreachable server on `127.0.0.1,4299`. The string
  names `DigitalHubContent`, and `ApiFactory.ToTestCatalog` rewrites it to
  `DigitalHubContent_Test`, as earlier changes did. Results:
  - `--filter "FullyQualifiedName~ConventionTests"`: `exit=0`,
    `Passed! - Failed: 0, Passed: 8, Skipped: 0, Total: 8`. So the probe and the
    test host run here without a database.
  - Full suite at `cc99e20`: `Failed! - Failed: 315, Passed: 163, Skipped: 0, Total: 478`.
    The 163 passing names are saved, from the TRX, in
    `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm06-base-passed.txt`.
    This is the baseline for the "no new database-free failure" check in 5.3.
- Node 22.23.4 and npm exist. `studio/node_modules` is not installed. This
  change touches no Studio file (section 4).

### 2.6 Open pull requests in slot 1

From `gh api repos/mohya7/DH-WEBSITE/pulls/<n>/files`:

- #40 (GAP-12) changes `api/src/DigitalHub.Api/Program.cs`, `ServerHeaderTests.cs`
  and `docs/security-deployment.md`.
- #41 (GAP-08) changes `.github/lint/*` and `workflow-lint.yml`.
- #42 (GAP-06) changes `ci.yml`, two migrations and `api/tools/migration-checks/*`.
- #43 (GAP-04) changes `ci.yml` and `website/*`.
- #44 (GAP-07) changes `.github/security/*` and `security.yml`.

None of them changes a file in section 4.

## 3. Design

### 3.1 Approach

Bind `PageQuery` from the query root everywhere, by declaring it on the type:

```csharp
[ModelBinder(Name = "")]
public sealed class PageQuery
```

`[FromQuery]` on a parameter sets the binding source and leaves the model name
unset. MVC then takes the name from the type's metadata, here the empty string.
So `page` and `pageSize` bind as top-level keys in all five actions and the probe.
No controller signature changes. The `typed` rows in 2.2 show this for every
input tried, including that `[Range]` is enforced again (400 with the
`ValidationProblemDetails` shape the API already uses for `[ApiController]`
model errors).

A short comment on the attribute says why it is there, naming ADM-06.

### 3.2 Alternatives rejected

- **`[FromQuery(Name = "")]` on each of the five parameters.** This is the audit's
  second option, and it works (`named` rows). Rejected: it needs five edits in
  three controller files, and the next list endpoint written as
  `[FromQuery] PageQuery page` brings the defect back. ADM-02, ADM-07 and ADM-10
  are about to change `AdminControllers.cs`. The type-level attribute keeps this
  change out of those files.
- **Renaming the parameter (for example to `paging`).** This is the audit's first
  option, and it works for `page`/`pageSize` (`renamed` rows). Rejected: it moves
  the trap rather than removing it. `?paging=3` falls into the same prefix
  behaviour, and a later parameter named `page` brings it back. It also touches
  the same three controller files.
- **Two plain `[FromQuery] int page, int pageSize` parameters with `[Range]` on
  each.** Rejected: it duplicates the limits in five places, so A-8's maximum
  page size is no longer stated once.
- **A custom model binder.** Rejected: more code for what one attribute does.
- **Adding a tie-breaker (`ThenBy(Id)`) to the stores' newest-first orderings.**
  The audit, media and contact orderings sort on one timestamp. With equal
  timestamps, OFFSET paging may in principle repeat or skip a row across pages.
  This is out of scope: ADM-06 does not name it, and no test can be shown to fail
  reliably first (P-4). Recorded as a risk (section 10) and an observation for
  ADM-15 and ADM-16, which already change those lists. In the page-2 tests, the
  contact and media tests seed timestamps a minute apart. The audit test relies
  on three sequential requests (section 10).

### 3.3 Why ADM-06 is split (B-8)

ADM-06's fix has three parts in two modules. One is an API binding fix. The
other two are Studio paging controls on three to six screens and their tests.
B-8 is "One module, one fix or one gate per pull request". The split:

- **ADM-06a (this plan):** the API binding fix, a guard test that every paged
  action binds from the root, behavioural red-first tests on the probe, and one
  page-2 integration test per endpoint. One file of production code. It alone
  unblocks the preview loader (2.4) and makes every row reachable through the
  API, which ADM-06b needs.
- **ADM-06b (follow-up, not planned here):** Studio paging controls on the audit
  log (`AuditPage.tsx`), the contact inbox (`ContactInboxPage.tsx`) and the media
  library and picker (`MediaLibraryPage.tsx`, `MediaPicker.tsx`). It also adds a
  Studio unit test that `previewData.published` walks pages without repeats, and
  a Studio end-to-end test that reaches a row past the first page. Its architect
  should also decide on two screens the audit did not name but which have the
  same cap: `RedirectsPage.tsx` (50, `pagination={false}`) and
  `CollectionListPage.tsx` (100). ADM-06b is a separate topic in `studio/`.
- **Red and green for ADM-06b (corrected in round 2).** ADM-06b's red-first
  does not wait on ADM-06a. A Studio test that a screen reaches the 51st enquiry,
  or a picker reaches the 25th image, fails today, with or without ADM-06a. Only
  ADM-06b's green needs ADM-06a merged, because the API must return page 2. Its
  architect can plan and write the red tests at once.

**Slot and date for ADM-06b (added in round 2).**
- ADM-06b is the next slot-2 change after ADM-06a, ahead of ADM-03. Slot 2 takes
  one pull request a working day, so the targets are:
  - ADM-06a merges Wednesday 11 November;
  - ADM-06b merges Thursday 12 November.
- Both must merge inside G3-1, by Monday 16 November, the batch's exit gate. The
  audit ranks ADM-06 a blocker "because enquiries past the 50th become
  unreachable", and only ADM-06b fixes that for staff.
- If ADM-06b has not merged by 16 November, ADM-06 is not done. The G3-1 exit
  gate cannot be confirmed for it, and the integrator tells the owner at the gate.
  Moving the exit gate, or closing it without ADM-06b, is the owner's decision.
  This plan does not assume it.
- **Cost:** one more pull request in slot 2 (G3 planned 17). Every later G3-1 item
  moves one slot-2 day later. Recorded as a risk in section 10.

The binding fix is one attribute, so ADM-06a is a small, low-risk merge.

## 4. Scope

### Files to change

| File | Change |
| --- | --- |
| `api/src/DigitalHub.Api/Conventions/PageQuery.cs` | Add `[ModelBinder(Name = "")]` to `PageQuery`, with a one-line comment naming ADM-06, and `using Microsoft.AspNetCore.Mvc;`. Nothing else. `PageResult<T>` is unchanged. |
| `api/tests/DigitalHub.Api.Tests/ConventionProbeController.cs` | Rename the `List` parameter from `query` to `page` (line 33 and its three uses on 36-37), so the probe has the same shape as the production actions. No other change. |
| `api/tests/DigitalHub.Api.Tests/PageQueryBindingTests.cs` (new) | Tests that need no database (5.1, tests 1 to 3). |
| `api/tests/DigitalHub.Api.Tests/ListPagingTests.cs` (new) | One page-2 integration test per endpoint (5.1, tests 4 to 8). |
| `docs/changes/ADM-06/*` | Pipeline records. |

The new tests go in new files so that ADM-02, 03, 07 and 10 can change
`AdminApiTests.cs`, `MediaLibraryTests.cs` and `ContentApiTests.cs` in parallel
without conflicts (`AGENTS.md`: "Parallel work must change different files").

### Out of scope (left alone on purpose)

- Every file in `studio/`, including `previewData.ts` (no change needed, 2.4).
  All Studio paging controls are in ADM-06b.
- The controllers (`MediaController.cs`, `AdminControllers.cs`,
  `ContentController.cs`): no signature change is needed.
- The stores (`AdminStore.cs`, `ContentStore.cs`, `MediaLibrary.cs`): ordering,
  tie-breakers and filters are left alone. Audit filters are ADM-15, media is
  ADM-16, and redirect rules are ADM-02 and ADM-07.
- `ConventionTests.Notes_list_uses_the_page_envelope`: left unchanged. It goes
  red with the probe rename and green with the fix, which is extra evidence.
- `ENGINEERING_STANDARDS.md` (A-8 status) is not on the base branch. The A-8
  wording is left to whoever lands that file. The tester notes that A-8's
  evidence becomes `PageQueryBindingTests` plus `ListPagingTests`.
- Every file changed by PRs #40 to #44 (2.6).

## 5. Test plan

### 5.1 Failing tests, written first

All tests are in Release. Tests 1 to 3 run in this container. Tests 4 to 8 need
SQL Server and run in CI's `api` job.

**`PageQueryBindingTests.cs`**: `[Collection("SqlServer")]`,
`IClassFixture<ApiFactory>`. These tests never touch the database.

1. `Every_paged_list_binds_page_and_page_size_from_the_query_root`
   - Takes `IActionDescriptorCollectionProvider` and `IModelMetadataProvider`
     from `factory.Services`.
   - Selects every `ControllerActionDescriptor` declared in the
     `DigitalHub.Api` assembly that has a parameter of type `PageQuery`.
   - Asserts the set is exactly `MediaController.List`, `RedirectsController.List`,
     `AuditController.List`, `ContactRequestsController.List` and
     `ContentController.List`. So the test cannot pass vacuously, and a new
     paged list must be added here on purpose.
   - Asserts, for each one, that the effective model name
     (`parameter.BindingInfo?.BinderModelName ?? metadata.GetMetadataForType(typeof(PageQuery)).BinderModelName`)
     is `""`.
   - Red today: all five are `null`. The assertion message lists the actions.
2. `Page_two_returns_the_second_slice_with_the_requested_size`
   - Creates five notes through `POST /api/v1/examples/notes`.
   - Calls `GET /api/v1/examples/notes?page=2&pageSize=2`.
   - Asserts 200, `page` 2, `pageSize` 2, `items.Length` 2, and that the items are
     the third and fourth of `?page=1&pageSize=100`.
   - Red today with the probe renamed to `page`: the body says page 1, size 20.
3. `Out_of_range_page_or_page_size_is_rejected`, a `[Theory]`:
   - `page=0&pageSize=5` gives 400, with an `errors.Page` entry.
   - `page=2&pageSize=101` gives 400, with an `errors.PageSize` entry.
   - `page=10001` gives 400, with an `errors.Page` entry.
   - `pageSize=0`, which works today because there is no `page` key, gives 400.
   - The status and the field key are asserted, not the message text.
   - Red today: the first three return 200 (2.2, `current` rows).

**`ListPagingTests.cs`**: `[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`.
Admin session, using the same sign-in helper pattern as `AdminApiTests`. Each test:

- seeds three rows, made unique by an 8-character suffix;
- filters to exactly those rows;
- asserts that `?page=2&pageSize=2` returns 200, `page` 2, `pageSize` 2,
  `total` 3 and exactly one item, the one expected by the store's order;
- deletes what it created.

4. `Redirects_list_returns_page_two`
   - Creates `/adm06-<suffix>-a`, `-b` and `-c` through `POST /api/v1/redirects`,
     each to `/`.
   - Lists `?search=adm06-<suffix>&page=2&pageSize=2`.
   - Expects `-c`, because the order is by `FromPath`.
5. `Contact_requests_list_returns_page_two`
   - Inserts three `ContactRequest` rows through `ContentDbContext`, the way
     `AdminApiTests.Contact_handled_records_who_and_when` does. Their `Name`
     contains the suffix, and `CreatedAt` is now minus 3, 2 and 1 minutes.
   - Lists `?search=<suffix>&page=2&pageSize=2`.
   - Expects the oldest, because the order is newest first.
6. `Media_list_returns_page_two`
   - Inserts three `MediaAsset` rows through `ContentDbContext`. Each has the
     suffix in `OriginalName`, a unique `ContentHash`, and `CreatedAt` minus 3,
     2 and 1 minutes.
   - Does not use the upload route. That route is limited to 20 uploads an hour
     per user (`Media:UploadPermitLimit`), shared with the whole suite.
   - Lists `?search=<suffix>&page=2&pageSize=2`.
   - Expects the oldest.
7. `Audit_list_returns_page_two`
   - Sets `before = DateTime.UtcNow` immediately before the first create.
   - Creates three redirects with this test's own suffix. Each writes a
     `create_redirect` audit entry (`AdminStore.cs:161`), stamped by
     `DateTime.UtcNow` in the store.
   - Sets `after = DateTime.UtcNow` immediately after the third response.
   - **No padding on either side (round 2).** The audit filter test in
     `AdminApiTests.cs` pads two seconds each way; do not copy that. Padding could
     pull in the three `create_redirect` entries test 4 wrote moments earlier in
     the same class, and `total` 3 would fail in CI only.
   - Lists `?action=create_redirect&from=<before:O>&to=<after:O>&page=2&pageSize=2`.
   - Expects one entry, whose `entityId` is the first redirect's id, because the
     order is newest first.
   - Also lists page 1 and asserts its two `entityId`s are the third and second
     redirects, and that pages 1 and 2 have no `id` in common.
   - The audit rows are not seeded. Their timestamps come from three sequential
     requests, stored as `datetime2(7)`, so they differ in practice. If two ever
     tied, the order assertions would fail rather than pass wrongly (section 10).
   - The collection disables parallel runs, so no other test writes in that
     window.
8. `Collection_list_returns_page_two`
   - Creates three pages through `POST /api/v1/pages`, each with a title and a
     slug (round 2): titles `ADM06 <suffix> A`, `B` and `C`, slugs
     `adm06-<suffix>-a`, `-b` and `-c`. `ContentWrite` requires the slug, as
     `AdminApiTests.Audit_filters_by_user_action_content_type_and_date` shows.
   - Lists `/api/v1/pages?search=<suffix>&page=2&pageSize=2`.
   - Expects `C`. `pages` is not in `OrderedCollections`, so the order is by title.
   - One test covers every collection, because all eight share the one action
     `ContentController.List`. Test 1 proves its binding, and the preview loader
     depends on it.

Before the fix, tests 4 to 8 fail on `page` (1, not 2) and `pageSize` (20,
not 2).

### 5.2 Commit order (B-6, P-4)

1. `ADM-06: Test that paged lists honour page and pageSize`
   - Adds both new test files and the probe rename. No production change.
2. `ADM-06: Bind PageQuery from the query root`
   - Changes only `PageQuery.cs`.

### 5.3 Local evidence, in this container

Set up the environment:

```bash
. /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh
cd /home/user/dh-change-adm06/api
export CS="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"
```

Port 4299 has no listener, and the factory rewrites the catalog to
`DigitalHubContent_Test`. No database is touched. Use a fresh `HOME` for each
run, as in 2.5.

**After commit 1 (red):**

```bash
dotnet build tests/DigitalHub.Api.Tests -c Release
HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.PageQueryBindingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests."
```

The trailing dots keep `StudioConventionTests` out (round 2).

Expected, per class (13 test cases in all):

| Class | Cases | Pass | Fail | Failing cases |
| --- | --- | --- | --- | --- |
| `PageQueryBindingTests` | 6 (test 1, test 2, test 3 × 4) | 1 (test 3, `pageSize=0`) | 5 | Test 1 (all five actions have a `null` model name); test 2 (page 1, not 2); test 3 for `page=0&pageSize=5`, `page=2&pageSize=101` and `page=10001` (200, not 400) |
| `ConventionTests` | 7 | 6 | 1 | `Notes_list_uses_the_page_envelope` |

- Overall: exit 1, `Failed: 6, Passed: 7, Total: 13`.
- `Notes_list_uses_the_page_envelope` fails first on the item count, its first
  body assertion (`ConventionTests.cs:43`): `Assert.Equal() Failure  Expected: 2
  Actual: <n>`. `<n>` is the number of notes in the shared store, up to 20; it was
  4 in the reviewer's run. It never reaches the `page` or `pageSize` assertion.
- Quote each failure's assertion message as run.

**After commit 2 (green):**

- Run the same command. Expected: exit 0, `Failed: 0, Passed: 13, Total: 13`.
- Full suite without a database:
  `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=<scratch>/adm06-after.trx"`
  - Extract the passed names, as in 2.5, and diff them against `adm06-base-passed.txt`.
  - Expected: every base pass still passes, plus the new tests in
    `PageQueryBindingTests`. Any name that passed before and fails now is a
    regression to report.
  - Tests 4 to 8 fail here for lack of a database. Record them as NOT RUN
    locally, covered by CI `api`.
- Release build of the solution: `dotnet build DigitalHub.slnx -c Release`.
  Expected: 0 errors, and no more warnings than the 13 from 2.5.

### 5.4 CI evidence on the pull request

- **Red for tests 4 to 8:** CI runs only on pull requests (`ci.yml`, `on:`
  `pull_request` and push to `rebuild/dotnet-platform`), and developers do not
  push. So the database tests can be shown failing only if commit 1 is pushed
  and a pull request is opened before commit 2. That needs owner decision
  O-ADM06-1 (section 9), which is pending.
  - If the answer is yes, record the run id of job `api` ("API — Release build,
    migrations, integration tests"). It must fail exactly tests 4 to 8, the five
    failing `PageQueryBindingTests` cases and `Notes_list_uses_the_page_envelope`,
    and nothing else. Then push commit 2.
  - If the answer is no, see section 9 for what follows.
- **Green:** every job of `ci.yml` on the final head:
  - `api`: all integration tests pass. That is 478 at `cc99e20` plus the new
    tests, less anything that changed upstream; quote the count from the TRX.
  - `website`, `studio` (unit and end-to-end), `section-compare`.
  - Also `security.yml` (gitleaks, Semgrep, audits).
  - None of these touches this change's files except `api`. They must stay
    green.

### 5.5 Track checklist (G3), from `docs/changes/README.md`

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Section 1 quotes it; 2.2 reproduces it; the fix is the audit's "bind with `Name = ""`", on the type (3.1) |
| The regression test is committed and shown failing before the fix | Commit 1 before commit 2. Shown failing locally for tests 1 to 3 and the probe test (5.3). Tests 4 to 8 are shown failing in CI only if O-ADM06-1 is "Yes". If it is "No", this row is not met: the delivery is BLOCKED ON OWNER until the owner accepts NOT RUN red in words, recorded as a D-NNN entry with the quote and an expiry (section 9). Neither the tech lead nor any other role may waive it (P-7) |
| The end-to-end suite gets a test for each Major | ADM-06 is a Blocker, not a Major. A Studio end-to-end test that reaches page 2 is planned in ADM-06b, where the UI exists |
| A Minor that is not fixed becomes a D-NNN entry | Not a Minor. No D-NNN entry |
| G3-1 exit gate "each blocker reproduced before its fix and passing after it" | 2.2 and 5.3 reproduce it before; 5.3 and 5.4 show it passing after. ADM-06 is marked done only after ADM-06b |

## 6. Security impact

- **Routes and policies:** none changed. The same five actions, with the same
  `studio`, `studio-admin` and `[StudioAccess]` policies. `[ModelBinder]` on a
  type sets no binding source; the `typed` rows in 2.2 confirm it still binds
  from the query string.
- **Input validation:** stronger. The `[Range(1, 10_000)]` page and
  `[Range(1, 100)]` page-size limits are enforced whenever `page` is sent. Today
  they are skipped, and the defaults are used instead (2.2). The 100-row maximum
  (A-8) now always holds.
- **Data reachable:** an authorised user can now reach rows past the first page:
  enquiries past 50, audit entries past 50, media past 48. These rows were always
  within that role's permission. No role gains access to anything new.
- **Logins, secrets, dependencies:** none. No package is added (`ModelBinderAttribute`
  is in the ASP.NET Core shared framework). No configuration change.

## 7. Migrations

None. No entity, schema or data change.

## 8. Rollback

Revert the pull request. Nothing is stored, so nothing needs cleaning up. A
revert brings the defect back, and `PageQueryBindingTests` goes red, which
shows it.

## 9. Owner decisions needed

- **O-ADM06-1. Status: PENDING. BLOCKED for the push step only.**
  - **Question:** "May the developer push ADM-06's red-test commit to
    `change/ADM-06` and open the pull request before the fix commit is pushed, so
    that CI's `api` job shows the five database page-2 tests failing first? CI
    would be red on that pull request until the fix is pushed."
  - **How it was asked:** the coordinator put it to the owner on a decision card
    with two answers:
    - "Yes, push the red tests first" (recommended);
    - "No, push only when finished".
    No answer has been given. This plan assumes neither.
  - **Why it is asked:**
    - G3 requires the regression test "shown failing before the fix".
    - Tests 4 to 8 need SQL Server. This container has none: the Docker daemon is
      not running either (`plan-review.md` Round 1).
    - CI runs only on pull requests.
    - A push happens only after the owner confirms (`.claude/commands/change.md`),
      and developers never push (GAP-01 `implementation.md`: "developer never
      pushes").
  - **What does not wait:** development, commits 1 and 2 in that order, local red
    and local green (5.3), testing and both gates. They do not depend on the
    answer.
  - **What waits:** only the push of commit 1, and with it the CI red run in 5.4.
  - **If the answer is "Yes, push the red tests first":** follow 5.4: commit 1,
    pull request, red `api` run id recorded, then commit 2 and the green run.
    Quote the owner's words, with the date and where they were given, in
    `implementation.md`.
  - **If the answer is "No, push only when finished":** the red evidence for
    tests 4 to 8 is NOT RUN, and the G3 rule ("shown failing before the fix") is
    not met for them. The delivery is then **BLOCKED ON OWNER**. It is unblocked
    only by one of these:
    - **(a)** The owner accepts NOT RUN red for tests 4 to 8 in words. That is
      recorded as a `D-NNN` entry in `docs/deferred-items.md` with:
      - rule waived: G3 "shown failing before the fix" and P-4;
      - the justification: no SQL Server locally, and the binding red is shown by
        tests 1 to 3 and the probe test;
      - the owner's exact words and date;
      - the follow-up owner;
      - an expiry.
    - **(b)** The owner changes the answer to "Yes".
  - **No other role may decide this.** Not the tech lead at gate 2, and not any
    other role (P-7; `docs/changes/README.md`: "A tech-lead approval ... never
    counts as an owner decision under P-7").

- **Noted, not a decision.** The split into ADM-06a and ADM-06b adds one pull
  request to slot 2, and ADM-06b is planned for 12 November, inside G3-1 (3.3).
  B-8 allows a large change if it says why, and 3.3 does. If the owner prefers
  one pull request, say so before gate 1.

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The type-level attribute does not apply under the real host's MVC options, for example a custom metadata provider | The fix silently does nothing | Test 1 reads the effective model name from the real host's metadata provider. Tests 2 and 4 to 8 check behaviour |
| A client sends out-of-range `page` or `pageSize` and today gets 200 | It now gets 400 | Grep (2.4): no Studio, website or end-to-end caller sends `page` below 1, above 10,000 or `pageSize` above 100. The preview sends 100 and starts at 1. CI `studio` end-to-end confirms it |
| A future paged list binds `PageQuery` with an explicit `Name` | The defect comes back for that action | Test 1 requires the exact set of actions and the empty model name |
| Ties on one timestamp make OFFSET paging repeat or skip a row | Rare duplicates or gaps in audit, media or contact pages | Not fixed here (3.2). Passed to ADM-15 and ADM-16 as an observation. In the tests: tests 5 and 6 seed timestamps a minute apart, so they cannot tie. Test 7 does not seed; its three audit timestamps come from `DateTime.UtcNow` on three sequential requests, stored as `datetime2(7)`, so they differ in practice. A tie there would fail test 7's order and no-overlap assertions, never pass it wrongly |
| Test 7's time window catches another test's `create_redirect` entries | `total` is not 3; fails in CI only | No padding on `before` or `after` (5.1, test 7). The collection runs tests one at a time |
| ADM-06b does not merge by 16 November | ADM-06 stays open; the G3-1 exit gate cannot be confirmed for it | ADM-06b is the next slot-2 change (3.3). If it slips, the integrator tells the owner at the gate; the owner decides |
| ADM-06b takes a slot-2 day | ADM-03 and every later G3-1 item move one day later | Stated in 3.3; the owner sees it at gate 1 |
| Seeded rows leak into other tests' totals | Other list assertions change | Unique suffixes, deletion at the end of each test, and no other test asserts an absolute total for these lists (grep 2.3) |
| Redirect rules change under ADM-02 or ADM-07 (path normalisation) | Test 4 or 7 needs new paths | The paths are plain lowercase without trailing slashes, valid under both today's and the planned rules |
| The audit append-only grant (`DENY UPDATE, DELETE ON dbo.audit_log`) | Test 7 cannot delete its audit rows | It deletes only its redirects. The audit rows stay, as everywhere else in the suite |
| No Studio screen uses page 2 yet | Staff see no change until ADM-06b | Stated in 3.3. ADM-06 stays open in the coverage table until ADM-06b |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `?page=2&pageSize=5` returns page 2 of size 5, not page 1 of 20 | Audit ADM-06, bullet 1 | Planned | |
| Fixed on audit (`GET /api/v1/audit`) | Audit ADM-06, bullet 2 | Planned | |
| Fixed on contact requests (`GET /api/v1/contact-requests`) | Audit ADM-06, bullet 2 | Planned | |
| Fixed on redirects (`GET /api/v1/redirects`) | Audit ADM-06, bullet 2 | Planned | |
| Fixed on media (`GET /api/v1/media`) | Audit ADM-06, bullet 2 | Planned | |
| Fixed on every collection (`GET /api/v1/{collection}`) | Audit ADM-06, bullet 2 | Planned | |
| Enquiries and audit entries past 50 reachable through the API | Audit ADM-06, bullet 3 | Planned | |
| Media past 48 or 24 reachable through the API | Audit ADM-06, bullet 3 | Planned | |
| Preview loader no longer repeats items past 20 (API side) | Audit ADM-06, bullet 4 | Planned | |
| Fix: "Rename the parameter, or bind with `Name = ""`" | Audit ADM-06, Fix 1 | Planned | |
| Fix: "Add a page-2 test per endpoint" | Audit ADM-06, Fix 3 | Planned | |
| `[Range]` page and page-size limits enforced when `page` is sent | Found here (2.2), A-8 | Planned | |
| Regression test committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Planned (CI red for tests 4 to 8 waits on O-ADM06-1) | |
| Fix: "Add paging controls to the audit, inbox and media screens" | Audit ADM-06, Fix 2 | Moved to ADM-06b | |
| Studio screens reach enquiries, audit entries and media past the first page | Audit ADM-06, bullet 3 | Moved to ADM-06b | |
| Preview loader walks pages without repeats (Studio test) | Audit ADM-06, bullet 4 | Moved to ADM-06b | |

## 12. Revision log

- **Round 1 (10 November 2026):** first version.
- **Round 2 (10 November 2026):** answers `plan-review.md` Round 1, which ended
  CHANGES NEEDED. The reviewer's independent check of the binding fix on the real
  `ApiFactory` host (all six `PageQuery` parameters `<null>` before, `''` after;
  400s with `errors.Page` and `errors.PageSize`) agrees with 2.2. No design change.
  - **Finding 1, Major: the "no" branch of O-ADM06-1 handed an owner decision to
    the tech lead.**
    - Accepted. Section 9 now marks O-ADM06-1 **PENDING, BLOCKED for the push
      step only**, and names the decision card's two answers without assuming
      either.
    - I chose the reviewer's option (b). A "No" leaves tests 4 to 8 NOT RUN red,
      so the G3 rule is not met for them. The delivery is then BLOCKED ON OWNER
      until the owner either accepts NOT RUN red in words (a D-NNN entry with
      the quote and an expiry) or answers "Yes".
    - The sentence giving the tech lead the decision is removed. 5.4 and the 5.5
      checklist row now match section 9.
  - **Finding 2, Minor: ADM-06b had no slot, and 3.3 said its red was blocked.**
    - Accepted. 3.3 now gives ADM-06b the next slot-2 day after ADM-06a: targets
      11 November for ADM-06a and 12 November for ADM-06b, both inside G3-1 by
      16 November. It says what happens if ADM-06b slips: ADM-06 stays open, the
      exit gate cannot be confirmed for it, and the owner decides. Two risk rows
      are added.
    - The red sentence is corrected: ADM-06b's red-first tests fail today and can
      be written at once; only its green needs ADM-06a.
  - **Finding 3, Minor: the 5.3 red expectations were wrong.**
    - Accepted. `Notes_list_uses_the_page_envelope` is now expected to fail first
      on the item count (`Expected: 2`).
    - The filter now ends each class name with a dot, which excludes
      `StudioConventionTests`.
    - 5.3 states the counts per class: `PageQueryBindingTests` 6 cases (1 pass,
      5 fail) and `ConventionTests` 7 (6 pass, 1 fail). Red: `Failed: 6,
      Passed: 7, Total: 13`. Green: `Passed: 13`.
    - 5.4 now expects the failing set in the red CI run to match.
  - **Finding 4, Minor: details in tests 7 and 8, and the risk table.**
    - Test 7 now takes `before` and `after` with no padding, says why (test 4's
      entries), and asserts page 1's order as well.
    - The claim that tests 5 to 7 seed timestamps is corrected in 3.2 and in the
      risk table. Tests 5 and 6 seed; test 7 relies on sequential requests and
      `datetime2(7)`, and a tie would fail it, never pass it wrongly.
    - Test 8 now names unique slugs (`adm06-<suffix>-a`, `-b`, `-c`) with the
      titles.
