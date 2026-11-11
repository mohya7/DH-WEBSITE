# ADM-06: implementation

Developer, round 1, 10 November 2026. This is ADM-06a: the API binding fix and
its tests (plan section 3.3). Branch `change/ADM-06`, worktree
`/home/user/dh-change-adm06`. `plan-approval.md` ends `Verdict: APPROVED`
(gate 1, with six conditions; each is answered below). Not pushed; no pull
request (condition 5).

## Base (condition 1)

- `change/ADM-06` was already fast-forwarded to `a866cf6` (GAP-12) before I
  started; its head was `39968ce` ("ADM-06: Plan") on top of `a866cf6`.
  `git diff --stat a866cf6 39968ce` shows only the three plan records, so the
  code under test was `a866cf6`'s.
- **The base has moved again.** `git fetch origin rebuild/dotnet-platform` now
  gives `f5dd209` ("GAP-08: Lint every workflow with actionlint (#41)"). It
  changes only `.github/lint/*`, `.github/workflows/workflow-lint.yml` and
  `docs/changes/GAP-08/*`; none of this change's files
  (`git diff --name-only a866cf6 origin/rebuild/dotnet-platform | grep -E
  "PageQuery|ConventionProbe|ListPaging|ADM-06"`: no match). I did not rebase.
  Whoever brings the branch up to date before the pull request must keep the
  red and fix commits separate and in order.

## What changed

| File | Plan scope row (section 4) | Commit | Change |
| --- | --- | --- | --- |
| `api/tests/DigitalHub.Api.Tests/PageQueryBindingTests.cs` (new) | Tests 1 to 3 | `c870b7e` | `[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`, no database use. Test 1 reads `IActionDescriptorCollectionProvider` and `IModelMetadataProvider` from the real host, selects every `ControllerActionDescriptor` in the `DigitalHub.Api` assembly with a `PageQuery` parameter, asserts the exact sorted set of the five actions (condition 4), then asserts each effective model name (`BindingInfo?.BinderModelName ?? type metadata BinderModelName`) is `""`, listing any that are not. Test 2 creates five notes, then checks `?page=2&pageSize=2` is 200, page 2, size 2, two items, and that they are the third and fourth of `?page=1&pageSize=100` (by id). Test 3 is a `[Theory]` over the four out-of-range queries, asserting 400 and the `errors.Page` / `errors.PageSize` key, not the message. |
| `api/tests/DigitalHub.Api.Tests/ListPagingTests.cs` (new) | Tests 4 to 8 | `c870b7e` | `[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`, admin session through the same `AdminAsync` / `EnsurePrimaryAdminActiveAsync` / `SendAsync` pattern as `AdminApiTests`. Each test makes three rows unique by an 8-character suffix, filters to them, and asserts `?page=2&pageSize=2` gives 200, `page` 2, `pageSize` 2, `total` 3 and exactly one item, the expected one. Cleanup runs in `finally` (condition 4). Details below. |
| `api/tests/DigitalHub.Api.Tests/ConventionProbeController.cs` | Probe rename | `c870b7e` | The `List` parameter is renamed `query` to `page` (line 33 and its uses on lines 36 and 37). Nothing else. In commit 1, not a separate rename commit (condition 2: it changes binding). |
| `api/src/DigitalHub.Api/Conventions/PageQuery.cs` | The fix | `17894c7` | `[ModelBinder(Name = "")]` on `PageQuery`, `using Microsoft.AspNetCore.Mvc;`, and a two-line comment naming ADM-06. `PageResult<T>` unchanged. |
| `docs/changes/ADM-06/implementation.md` | Pipeline records | this commit | This file. |

Tests 4 to 8 as written (plan 5.1):

- **4 `Redirects_list_returns_page_two`:** creates `/adm06-<suffix>-a`, `-b`,
  `-c` to `/` through `POST /api/v1/redirects`; lists
  `?search=adm06-<suffix>&page=2&pageSize=2`; expects `fromPath`
  `/adm06-<suffix>-c` (order by `FromPath`); deletes the three redirects.
- **5 `Contact_requests_list_returns_page_two`:** inserts three
  `ContactRequest` rows through `ContentDbContext` (fields as in
  `AdminApiTests.Contact_handled_records_who_and_when`), `Name`
  `ADM06 <suffix> A/B/C`, `CreatedAt` now minus 3, 2 and 1 minutes; lists
  `?search=<suffix>&page=2&pageSize=2`; expects the oldest (`A`) by id; removes
  the rows through `ContentDbContext`.
- **6 `Media_list_returns_page_two`:** inserts three `MediaAsset` rows through
  `ContentDbContext` (shape of `ContentApiTests.NewMedia`), `OriginalName`
  `adm06-<suffix>-a/b/c.webp`, unique `ContentHash` and `Path`, `CreatedAt`
  minus 3, 2 and 1 minutes; not the upload route (rate limit); expects the
  oldest by id; removes the rows.
- **7 `Audit_list_returns_page_two`:** `before = DateTime.UtcNow` immediately
  before the first create and `after = DateTime.UtcNow` immediately after the
  third response, **no padding** (condition 4); three redirects with its own
  suffix; lists `?action=create_redirect&from=<before:O>&to=<after:O>` page 2
  (expects the first redirect's `entityId`) and page 1 (expects the third then
  second redirect's `entityId`, and no audit `id` shared with page 2); deletes
  its redirects. The audit rows stay (the app login has `DENY DELETE` on
  `audit_log`).
- **8 `Collection_list_returns_page_two`:** creates pages titled
  `ADM06 <suffix> A/B/C` with slugs `adm06-<suffix>-a/b/c` through
  `POST /api/v1/pages`; lists `/api/v1/pages?search=<suffix>&page=2&pageSize=2`;
  expects title `ADM06 <suffix> C` and the third page's id; deletes the pages
  with `?version=1`.

Not touched (condition 6): anything in `studio/`, the controllers, the stores,
`ConventionTests.cs`, and every file of open pull requests #42 to #44 (and of
#41, now merged as `f5dd209`).

## Commits (condition 2)

| SHA | Subject | Files |
| --- | --- | --- |
| `c870b7e` | ADM-06: Test that paged lists honour page and pageSize | the two new test files and the probe rename; nothing in `api/src/` (`git show --stat c870b7e`) |
| `17894c7` | ADM-06: Bind PageQuery from the query root | `api/src/DigitalHub.Api/Conventions/PageQuery.cs` only |
| this commit | ADM-06: Record implementation | `docs/changes/ADM-06/implementation.md` |

Each was staged by exact path, and each message has a body saying why and the
two attribution trailers.

## Commands run

Environment for every command: the .NET SDK 10.0.114 from the scratchpad's
`dn.sh`, in `/home/user/dh-change-adm06/api`. Every `dotnet test` ran through a
small wrapper
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/bin/runtests.sh`)
that creates a fresh `HOME` under the scratchpad, sets

```
ConnectionStrings__Content=Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True
```

(a closed port; `ApiFactory.ToTestCatalog` rewrites the catalog to
`DigitalHubContent_Test`; no database was reached or written), runs
`dotnet test tests/DigitalHub.Api.Tests -c Release --no-build <args>`, and
deletes the `HOME` afterwards. No SQL Server exists in this container. No port
was opened.

### 1. Baseline at `a866cf6` (condition 1)

```
dotnet build DigitalHub.slnx -c Release
exit 0
    13 Warning(s)
    0 Error(s)

runtests.sh --logger "trx;LogFileName=<scratch>/adm06-base-a866cf6.trx"
exit 1
Failed!  - Failed:   316, Passed:   167, Skipped:     0, Total:   483, Duration: 13 s - DigitalHub.Api.Tests.dll (net10.0)
```

Passed names were taken from the TRX (`UnitTestResult` with
`outcome="Passed"`, `testName`, sorted) into
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm06-base-a866cf6-passed.txt`:
167 names. Against the architect's `cc99e20` list (163) the only difference is
four added names, all `ServerHeaderTests` (GAP-12); nothing was lost. The 316
failures are tests that need SQL Server.

### 2. Red, after `c870b7e` (condition 3)

```
dotnet build tests/DigitalHub.Api.Tests -c Release
exit 0
    13 Warning(s)
    0 Error(s)

runtests.sh --filter "FullyQualifiedName~DigitalHub.Api.Tests.PageQueryBindingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests." \
  --logger "console;verbosity=normal"
exit 1
Total tests: 13
     Passed: 7
     Failed: 6
```

Per class, as plan 5.3 expected:

| Class | Cases | Pass | Fail |
| --- | --- | --- | --- |
| `PageQueryBindingTests` | 6 | 1 (`pageSize=0`) | 5 |
| `ConventionTests` | 7 | 6 | 1 (`Notes_list_uses_the_page_envelope`) |

`StudioConventionTests` did not run (the trailing dots exclude it).

Each failure, as run:

```
Failed PageQueryBindingTests.Every_paged_list_binds_page_and_page_size_from_the_query_root
   Assert.Empty() Failure: Collection was not empty
Collection: ["AuditController.List (model name: <null>)", "ContactRequestsController.List (model name: <null>"···, "ContentController.List (model name: <null>)", "MediaController.List (model name: <null>)", "RedirectsController.List (model name: <null>)"]
     at ...PageQueryBindingTests.cs:line 63

Failed PageQueryBindingTests.Page_two_returns_the_second_slice_with_the_requested_size
   Assert.Equal() Failure: Values differ
Expected: 2
Actual:   1
     at ...PageQueryBindingTests.cs:line 84          (the "page" assertion)

Failed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=0&pageSize=5", field: "Page")
Failed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=10001", field: "Page")
Failed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=2&pageSize=101", field: "PageSize")
   (each) Assert.Equal() Failure: Values differ
Expected: BadRequest
Actual:   OK
     at ...PageQueryBindingTests.cs:line 101

Passed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "pageSize=0", field: "PageSize")

Failed ConventionTests.Notes_list_uses_the_page_envelope
   Assert.Equal() Failure: Values differ
Expected: 2
Actual:   4
     at ...ConventionTests.cs:line 43                (the item-count assertion)
```

The exact-set assertion in test 1 passed at red (all five actions were found);
it failed on the model names, `<null>` for all five, as the plan and the
reviewer recorded.

### 3. Green, after `17894c7` (condition 3)

```
dotnet build DigitalHub.slnx -c Release
exit 0
    13 Warning(s)
    0 Error(s)
```

All 13 warnings are the existing ones in
`api/tools/DigitalHub.ContentImport/ContentWriter.cs` (CS8601 and CS8604, lines
219 to 689); none is in a file this change touches. Same count as the baseline.

```
runtests.sh --filter "FullyQualifiedName~DigitalHub.Api.Tests.PageQueryBindingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests." \
  --logger "console;verbosity=normal"
exit 0
  Passed ...PageQueryBindingTests.Every_paged_list_binds_page_and_page_size_from_the_query_root
  Passed ...PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=0&pageSize=5", field: "Page")
  Passed ...PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=10001", field: "Page")
  Passed ...PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=2&pageSize=101", field: "PageSize")
  Passed ...PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "pageSize=0", field: "PageSize")
  Passed ...PageQueryBindingTests.Page_two_returns_the_second_slice_with_the_requested_size
  Passed ...ConventionTests.(all seven, including Notes_list_uses_the_page_envelope)
Total tests: 13
     Passed: 13
```

### 4. Full database-free suite after the fix, diffed against the baseline

```
runtests.sh --logger "trx;LogFileName=<scratch>/adm06-after.trx"
exit 1
Failed!  - Failed:   321, Passed:   173, Skipped:     0, Total:   494, Duration: 12 s - DigitalHub.Api.Tests.dll (net10.0)
```

- `comm -23 base after` (passed before, not now): **empty**. No regression.
- `comm -13 base after` (newly passing): the six `PageQueryBindingTests` cases.
- Total 494 = 483 + 11 new cases (6 + 5). Failed 321 = 316 + the five
  `ListPagingTests`, each failing on
  `Microsoft.Data.SqlClient.SqlException : A network-related or instance-specific error occurred while establishing a connection to SQL Server`
  (no database here).

### NOT RUN

| What | Reason | Covered by |
| --- | --- | --- |
| Tests 4 to 8 (`ListPagingTests`), red and green | No SQL Server in this container; the Docker daemon is not running (plan 2.5, review Round 1) | CI job `api` ("API — Release build, migrations, integration tests") on the pull request |
| Red of tests 4 to 8 in CI | Needs commit 1 pushed alone, which waits on O-ADM06-1 (below) | CI job `api`, only if the owner answers "Yes" |
| Full integration suite with a database | No SQL Server | CI job `api` |
| Studio Vitest, Playwright, website build, section comparison | This change touches no file in `studio/`, `website/` or `packages/` | CI jobs `studio`, `website`, `section-compare` |
| `security.yml` (gitleaks, Semgrep, audits) | Not runnable here as CI runs it; no dependency, secret or workflow change | CI workflow `security.yml` |

## Migrations

None. No entity, schema or data change (plan section 7).

## Owner decision O-ADM06-1 (condition 5)

**Status: PENDING.** No answer has been given, and none is recorded here. The
plan marks it "BLOCKED for the push step only". Nothing was pushed and no pull
request was opened. Development, both commits, local red and local green did
not depend on it.

- If the owner answers "Yes, push the red tests first": push `c870b7e` alone,
  open the pull request, record the failing `api` run id (it must fail exactly
  the five `ListPagingTests`, the five failing `PageQueryBindingTests` cases and
  `Notes_list_uses_the_page_envelope`), then push `17894c7`.
- If the owner answers "No, push only when finished": tests 4 to 8 have no red
  evidence and the G3 rule is not met for them; the delivery is BLOCKED ON
  OWNER until the owner accepts NOT RUN red in words (a D-NNN entry) or answers
  "Yes" (plan section 9). No other role can decide this.

## Processes

I started no server and opened no port. My three builds left six MSBuild node
processes (PIDs 6940, 6941, 9083, 9084, 9465, 9466, started 23:27 to 23:30
UTC); I stopped them. The `VBCSCompiler` process (PID 864, started 23:07, before
this session's work) is not mine and was left running.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `?page=2&pageSize=5` returns the requested page and size, not page 1 of 20 | Audit ADM-06, bullet 1 | Done (local) | Test 2 red at `c870b7e` (`Expected: 2 Actual: 1` on `page`), green at `17894c7`; `Notes_list_uses_the_page_envelope` likewise |
| Fixed on audit (`GET /api/v1/audit`) | Audit ADM-06, bullet 2 | Done (binding local); page-2 test NOT RUN locally | Test 1: `AuditController.List` model name `<null>` at red, `""` at green. Test 7 written, runs in CI `api` |
| Fixed on contact requests (`GET /api/v1/contact-requests`) | Audit ADM-06, bullet 2 | Done (binding local); page-2 test NOT RUN locally | Test 1 (`ContactRequestsController.List`). Test 5 in CI `api` |
| Fixed on redirects (`GET /api/v1/redirects`) | Audit ADM-06, bullet 2 | Done (binding local); page-2 test NOT RUN locally | Test 1 (`RedirectsController.List`). Test 4 in CI `api` |
| Fixed on media (`GET /api/v1/media`) | Audit ADM-06, bullet 2 | Done (binding local); page-2 test NOT RUN locally | Test 1 (`MediaController.List`). Test 6 in CI `api` |
| Fixed on every collection (`GET /api/v1/{collection}`) | Audit ADM-06, bullet 2 | Done (binding local); page-2 test NOT RUN locally | Test 1 (`ContentController.List`, the one action for all eight collections). Test 8 in CI `api` |
| Enquiries and audit entries past 50 reachable through the API | Audit ADM-06, bullet 3 | Done (binding local); behaviour NOT RUN locally | Test 1 and test 2 locally; tests 5 and 7 in CI `api` |
| Media past 48 or 24 reachable through the API | Audit ADM-06, bullet 3 | Done (binding local); behaviour NOT RUN locally | Test 1 locally; test 6 in CI `api` |
| Preview loader no longer repeats items past 20 (API side) | Audit ADM-06, bullet 4 | Done (local) | The loader sends `?page=N&pageSize=100` to `ContentController.List`; test 1 shows that action binds from the root, test 2 shows `page` is honoured. No Studio change |
| Fix: "Rename the parameter, or bind with `Name = ""`" | Audit ADM-06, Fix 1 | Done | `17894c7`: `[ModelBinder(Name = "")]` on `PageQuery` |
| Fix: "Add a page-2 test per endpoint" | Audit ADM-06, Fix 3 | Written; NOT RUN locally | `ListPagingTests` tests 4 to 8 in `c870b7e`; run in CI `api` |
| `[Range]` page and page-size limits enforced when `page` is sent | Found in plan 2.2, A-8 | Done (local) | Test 3: three cases 200 at red, all four 400 with `errors.Page`/`errors.PageSize` at green |
| Regression test committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Met locally for tests 1 to 3 and the probe test; tests 4 to 8 waiting on O-ADM06-1 | Red run (section 2 above) on `c870b7e`, before `17894c7`. CI red for tests 4 to 8 needs O-ADM06-1 "Yes"; a "No" makes the delivery BLOCKED ON OWNER |
| No database-free test regressed | Plan 5.3 | Done | Section 4: 0 names lost against the 167-name `a866cf6` baseline |
| Release build, no new warnings | Plan 5.3 | Done | 0 errors, 13 warnings, all pre-existing in `ContentWriter.cs` |
| Fix: "Add paging controls to the audit, inbox and media screens" | Audit ADM-06, Fix 2 | Moved to ADM-06b | Plan 3.3 |
| Studio screens reach enquiries, audit entries and media past the first page | Audit ADM-06, bullet 3 | Moved to ADM-06b | Plan 3.3 |
| Preview loader walks pages without repeats (Studio test) | Audit ADM-06, bullet 4 | Moved to ADM-06b | Plan 3.3 |

ADM-06 itself stays open until ADM-06b merges.

## Notes for the tester

- The base moved to `f5dd209` (GAP-08) after gate 1; no file overlaps. I did
  not rebase.
- Tests 4 to 8 have never run. Their first run will be in CI `api`. Points I
  could not verify without a database: redirects to `/` are accepted (no
  redirect from `/` exists in the test database); `search=<suffix>` matches
  only the seeded rows; page delete with `?version=1` succeeds on a fresh draft
  (as in `AdminApiTests`).
- The A-8 row of `ENGINEERING_STANDARDS.md` (not on the base) would now cite
  `PageQueryBindingTests` and `ListPagingTests` as evidence (plan section 4).

Status: READY FOR TEST
