# ADM-06: test report

## Round 1

Tester, 10 November 2026. Commit tested: **`8ab00e0`** ("ADM-06: Record
implementation"). Red commit: `c870b7e`. Fix: `17894c7`. Base: `a866cf6`.
Detached worktrees `/home/user/adm06-test-red` (`c870b7e`) and
`/home/user/adm06-test-head` (`8ab00e0`), both removed afterwards. Governing
documents: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, the four ADM-06
records, `ENGINEERING_STANDARDS.md` (from `origin/claude/cool-heisenberg-mh6zx9`),
and the audit entry ADM-06 in `/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`.

Environment for every .NET command: SDK 10.0.114 from the scratchpad `dn.sh`,
Release only, a fresh `HOME` under the scratchpad for each run (deleted after),
and

```
ConnectionStrings__Content=Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True
```

Port 4299 has no listener; `ApiFactory.ToTestCatalog` rewrites the catalog to
`DigitalHubContent_Test`. No SQL Server exists here, so no database was reached
or written. No port was opened (all HTTP checks ran through the in-process test
host). Nothing was pushed or committed.

### 1. Commit scope

```
git show --stat c870b7e   -> ConventionProbeController.cs (6 +-), ListPagingTests.cs (+266), PageQueryBindingTests.cs (+110); nothing in api/src
git show --stat 17894c7   -> api/src/DigitalHub.Api/Conventions/PageQuery.cs | 4 ++++ (only file)
git show --stat 8ab00e0   -> docs/changes/ADM-06/implementation.md (only file)
git log --format="%h %p"  -> 8ab00e0<-17894c7<-c870b7e<-39968ce<-a866cf6
```

Red before fix, in order, as plan 5.2 requires. Base drift: `origin/rebuild/dotnet-platform`
is now `f5dd209`; `git diff --name-only a866cf6 origin/rebuild/dotnet-platform | grep -E "PageQuery|ConventionProbe|ListPaging|ADM-06|AdminControllers|ContentController|MediaController"`
gives no match, as the developer reported.

### 2. The red test was red (`c870b7e`)

```
cd /home/user/adm06-test-red/api
dotnet build tests/DigitalHub.Api.Tests -c Release
exit 0    13 Warning(s)    0 Error(s)

dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.PageQueryBindingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests." \
  --logger "console;verbosity=normal"
exit 1
  Failed ...PageQueryBindingTests.Every_paged_list_binds_page_and_page_size_from_the_query_root
Collection: ["AuditController.List (model name: <null>)", "ContactRequestsController.List (model name: <null>"···, "ContentController.List (model name: <null>)", "MediaController.List (model name: <null>)", "RedirectsController.List (model name: <null>)"]
     at ...PageQueryBindingTests.cs:line 63
  Failed ...Out_of_range_page_or_page_size_is_rejected(query: "page=0&pageSize=5", field: "Page")      Expected: BadRequest  Actual: OK   (line 101)
  Failed ...Out_of_range_page_or_page_size_is_rejected(query: "page=10001", field: "Page")             Expected: BadRequest  Actual: OK   (line 101)
  Failed ...Out_of_range_page_or_page_size_is_rejected(query: "page=2&pageSize=101", field: "PageSize") Expected: BadRequest  Actual: OK   (line 101)
  Passed ...Out_of_range_page_or_page_size_is_rejected(query: "pageSize=0", field: "PageSize")
  Failed ...Page_two_returns_the_second_slice_with_the_requested_size                                 Expected: 2  Actual: 1   (line 84, the "page" assertion)
  Failed ...ConventionTests.Notes_list_uses_the_page_envelope                                         Expected: 2  Actual: 4   (ConventionTests.cs:43, item count)
  (the other six ConventionTests passed)
Total tests: 13
     Passed: 7
     Failed: 6
```

Every failure is on the assertion and for the reason plan 5.3 gives (model name
`<null>` for all five actions; 200 instead of 400; page 1 instead of 2; probe
returns more than two items). None is a build, connection or timeout failure.
The exact-set assertion in test 1 passed (all five actions found).

Independent confirmation on the real routes (section 5): at `c870b7e`, an admin
`GET ...?page=2&pageSize=5` on media, redirects, audit, contact requests, pages
and vacancies bound `page=1, pageSize=20`; `page=0` and `page=abc` bound
`page=1` with 200; `page.Page=7` bound `page=7`. This is the audit's defect,
reproduced on all five production actions.

Tests 4 to 8 (`ListPagingTests`) at red: NOT RUN against a database (no SQL
Server). Code review (section 7) agrees they would fail first on the `page`
assertion (`Expected: 2 Actual: 1`) at red. CI red needs O-ADM06-1.

### 3. Green on the head (`8ab00e0`)

```
cd /home/user/adm06-test-head/api
dotnet build DigitalHub.slnx -c Release
exit 0    13 Warning(s)    0 Error(s)
```

All 13 warnings are in `api/tools/DigitalHub.ContentImport/ContentWriter.cs`
(`grep warning build.log | grep -v ContentWriter.cs` is empty); same count as base.

```
dotnet test ... --filter "<same as above>" --logger "console;verbosity=normal"
exit 0
  Passed ...Every_paged_list_binds_page_and_page_size_from_the_query_root
  Passed ...Out_of_range_page_or_page_size_is_rejected (all four cases)
  Passed ...Page_two_returns_the_second_slice_with_the_requested_size
  Passed ...ConventionTests (all seven, including Notes_list_uses_the_page_envelope)
Total tests: 13
     Passed: 13
```

### 4. Full database-free suite at the head, against the baseline

```
dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=<scratch>/tst/head-full.trx"
exit 1
Failed!  - Failed:   321, Passed:   173, Skipped:     0, Total:   494, Duration: 12 s - DigitalHub.Api.Tests.dll (net10.0)
```

Passed names from the TRX compared as a multiset (several data-row names are
truncated with `···` and repeat, so a plain `comm` reports false losses)
against `adm06-base-a866cf6-passed.txt` (167):

```
head passed 173, base 167
lost []
new  = the six PageQueryBindingTests cases
```

No regression. The 321 failures are the 316 database tests of the base plus the
five `ListPagingTests`, each failing on
`Microsoft.Data.SqlClient.SqlException : A network-related or instance-specific error occurred while establishing a connection to SQL Server`
(confirmed with `--filter "FullyQualifiedName~DigitalHub.Api.Tests.ListPagingTests."`, exit 1).

### 5. Security and edge cases on the five paged routes

The API needs SQL Server for a real sign-in (`SessionCheck` reads the database
on every request), so a live Kestrel host on 42xx could not authenticate
anyone. Instead, an out-of-tree xUnit harness
(`<scratch>/tst/probe/ProbeTests.cs`, referencing the head's test project; not
in the repository) runs the real `ApiFactory` host with two test-only changes:
`OnTokenValidated` is a no-op (signature, issuer, audience, lifetime and roles
are still validated; tokens are signed with the test key in `ApiFactory`), and a
global action filter that runs after MVC's model-state filter echoes the bound
`PageQuery` instead of calling the store. Everything before the action (routing,
authentication, authorization, `StudioAccess`, model binding, validation, error
shape) is the production pipeline. The same harness was built and run against
`c870b7e` (`<scratch>/tst/red/`) for comparison.

```
dotnet build -c Release -p:ProbeTarget=/home/user/adm06-test-head   -> exit 0
dotnet test -c Release --no-build                                   -> exit 0, Passed: 2
(red copy, -p:ProbeTarget=/home/user/adm06-test-red, --filter Matrix) -> exit 0
```

**Role matrix**, `GET <route>?page=2&pageSize=5`:

| Route | anonymous | admin | editor | hr | signed in, no role | unknown role |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/v1/media` | 401 | 200 (2, 5) | 200 (2, 5) | 403 | 403 | 403 |
| `/api/v1/redirects` | 401 | 200 (2, 5) | 200 (2, 5) | 403 | 403 | 403 |
| `/api/v1/audit` | 401 | 200 (2, 5) | 403 | 403 | 403 | 403 |
| `/api/v1/contact-requests` | 401 | 200 (2, 5) | 200 (2, 5) | 403 | 403 | 403 |
| `/api/v1/pages` | 401 | 200 (2, 5) | 200 (2, 5) | 403 | 403 | 403 |
| `/api/v1/vacancies` | 401 | 200 (2, 5) | 200 (2, 5) | 200 (2, 5) | 403 | 403 |

`diff` of the ROLE/MIX/HOST lines between red and head: the only differences
are the bound values in the 200 rows (red `1, 20`; head `2, 5`). **Every 401 and
403 is identical before and after the fix.** 401 and 403 bodies are
`application/problem+json`, `{"type":"https://tools.ietf.org/html/rfc7807","title":...,"status":...,"code":"unauthorized"|"forbidden"}`.

Wrong role with an out-of-range query (`page=0&pageSize=500`): editor on audit
403, hr on media 403, hr on pages 403, anonymous on audit and pages 401. The
authorization filter still runs before binding, so a caller without access
cannot use validation messages to probe a route.

**Edge cases** as admin, identical on all five routes (5 of 5 for each row):

| Query | Head | Red |
| --- | --- | --- |
| (none) | 200 (1, 20) | 200 (1, 20) |
| `page=2&pageSize=5` | 200 (2, 5) | 200 (1, 20) |
| `page=2` / `pageSize=5` | 200 (2, 20) / 200 (1, 5) | 200 (1, 20) / 200 (1, 5) |
| `Page=3&PAGESIZE=7` | 200 (3, 7) | |
| `page=10000&pageSize=100` (maximum) | 200 (10000, 100) | |
| `page=0`, `page=-1`, `page=10001`, `page=2147483647` | 400 `errors.Page` "must be between 1 and 10000" | `page=0`: 200 (1, 20) |
| `pageSize=0`, `pageSize=-5`, `pageSize=101`, `pageSize=2147483647` | 400 `errors.PageSize` "must be between 1 and 100" | `pageSize=101`: 400 (no `page` key, as before) |
| `page=abc`, `page=1.5`, `page=２` (full-width), `page=%E2%80%8E2` | 400 `errors.Page` "is not valid" | `page=abc`: 200 (1, 20) |
| `pageSize=1e3` | 400 `errors.PageSize` | |
| `page=` / `pageSize=` / `page=%20` | 400 "The value '' is invalid." / same / "' '" | |
| overflow `page=2147483648`, `page=-2147483649`, `page=99999999999999999999999` | 400 `errors.Page` "is not valid" | |
| repeated `page=2&page=3` | 200 (2, 20): first value wins | |
| repeated `page=3&page=abc` / `page=abc&page=3` | 200 (3, 20) / 400 "The value 'abc,3' is not valid" | |
| `page.Page=7`, `page.page=7&page.pageSize=9` (old prefix) | 200 (1, 20): prefix keys ignored | `page.Page=7`: 200 (7, 20) |
| `page[]=2` | 200 (1, 20): ignored | |
| `page=0x10` | 200 (16, 20) | |
| `page=2%00` | 200 (2, 20) | |
| `page=2;pageSize=3` | 400 `errors.Page` | |
| `page=` + 5,000 zeros + `2` | 200 (2, 20) | |

Every 400 is `application/problem+json; charset=utf-8`:

```
{"type":"https://tools.ietf.org/html/rfc7807","title":"One or more fields are invalid.","status":400,"errors":{"Page":["The field Page must be between 1 and 10000."]},"code":"validation_failed"}
```

That is the A-6 shape (`title`, `status`, `code`, per-field `errors`). No stack
trace, type name, SQL or path appears in any 400, 401 or 403 body. No 500
occurred for any query on any route. Overflow cannot reach the store:
`(page - 1) * pageSize` is at most 9,999 x 100 = 999,900.

Host check: the API has no host filter (`AllowedHosts: "*"` in
`appsettings.json`, unchanged by this change). `GET /api/v1/audit` with
`Host: www.digitalhub.com.eg` and no token gives 401 problem+json, the same as
any host. The public website is a separate static build; this change adds no
route and changes no host handling.

Unknown fields and body size: not applicable. The five routes are `GET` with no
body; unknown query keys were ignored before and are ignored now (`page[]`,
`page.Page`). No new or changed route.

Logins and permissions: no change. The matrix above proves the change grants
nothing: HR still cannot list media, redirects, audit, contact requests or
pages; an editor still cannot list the audit log; a token with no role or an
unknown role gets 403 everywhere.

### 6. Dependency and secret checks

```
cd /home/user/adm06-test-head/api
RUNNER_TEMP=<scratch>/tst/rt sh ../.github/security/run-dotnet-audit.sh
exit 0
The given project `DigitalHub.Api` has no vulnerable packages given the current sources.
The given project `DigitalHub.Api.Tests` has no vulnerable packages given the current sources.
The given project `DigitalHub.ContentImport` has no vulnerable packages given the current sources.
dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.

cd website && npm audit --audit-level=high   -> exit 0, "1 moderate severity vulnerability" (below the gate; no lockfile in this change)
cd studio  && npm audit --audit-level=high   -> exit 0, "found 0 vulnerabilities"
```

`git diff a866cf6 8ab00e0 -- api | grep -iE "^\+.*(password|secret|token|key|connectionstring)"`:
only `ApiFactory.AdminEmail`/`ApiFactory.AdminPassword` references (existing
test-only constants) and the word "keys" in a comment. No secret in the diff.
My logs contain only the closed-port placeholder string above.

### 7. Review of tests 4 to 8 (not runnable here), and the three assumptions

| Assumption (implementation.md, notes for the tester) | Evidence | Verdict |
| --- | --- | --- |
| A redirect to `/` is accepted | `RedirectPaths.Problem("/")` returns null (starts with `/`, no forbidden sequence); `from != to`; `OccupiesLivePathAsync` checks only the source; `ResolveDestinationAsync` follows `/` only if a redirect from `/` exists and returns `Loop` only if it reaches the source. `SessionCheckTests.cs:46` already creates `toPath = "/"` and expects success | Holds |
| `search=<suffix>` matches only the seeded rows | Redirects: `FromPath`/`ToPath` `Contains`; contact: `Name`/`Email`/`Organization`/`Message`; media: `Alt`/`Caption`/`OriginalName`; pages: `Title`/`Slug` or working-copy text. The suffix is 8 random hex characters, with no `%`/`_` LIKE wildcards. Test 7's redirects use their own suffix | Holds (collision odds negligible) |
| Page delete with `?version=1` succeeds on a fresh draft | `AdminApiTests.Audit_filters_by_user_action_content_type_and_date` (line 460) creates a page with only `slug` and `title` and deletes it with `?version=1`, asserting 204 | Holds |

Further checks:

- Ordering: redirects by `FromPath` (page 2 = `-c`); contact and media newest
  first by `CreatedAt` with seeded times 1 minute apart (page 2 = oldest, `rows[0]`);
  pages by `Title` then `Slug`, ordinal ignore-case, `pages` not in
  `OrderedCollections` (page 2 = `C`). All match the assertions.
- JSON shapes: contact projection, `MediaBody`, content list items and audit
  rows all expose `id` (and `fromPath`, `title`, `entityId` where asserted).
  Audit `entityId` is `created.Id.ToString()` (lowercase `D`), and the test
  compares `Guid.ToString()`: same format.
- Test 7's window: `audit_log.at` is `datetime2` (precision 7) in
  `InitialPlatform`; `At = DateTime.UtcNow` in the same process as `before` and
  `after`; `from`/`to` are sent in `O` format and bound as UTC, as the existing
  audit test does. The only writers of `create_redirect` are `AdminStore.cs:161`
  and `ContentStore.cs:1090`, and every test class that touches the database is
  in `[Collection("SqlServer")]` (checked: no class using `ContentDbContext` or
  `SqlConnection` is outside it), so nothing else writes in the window.
- Seeded entities match existing seed shapes (`ContactRequest` as in
  `AdminApiTests.Contact_handled_records_who_and_when`; `MediaAsset` as in
  `ContentApiTests.NewMedia`). The only check constraint on these tables is
  `contact_requests.status IN ('new','handled')`; `"new"` is used. The app login
  is denied only `UPDATE, DELETE` on `audit_log` (`ci.yml:104`), so the cleanup
  deletes of contact requests and media are allowed.
- Cleanup runs in `finally` in all five tests.

No defect found by review. Their first real run is CI `api`.

### 8. Callers of the new 400s

`grep -rnoE "pageSize=[0-9]+|[?&]page=..."` over `studio/src`, `studio/e2e`,
`website/src`, `packages` and `api/tests`: Studio sends `pageSize` 1, 8, 24, 48
or 100, and only `previewData.ts:57` sends `page` (from 1). No caller sends a
value the fix now rejects.

### NOT RUN

| What | Reason | Covered by |
| --- | --- | --- |
| `ListPagingTests` (tests 4 to 8), red and green | No SQL Server in this container | CI `ci.yml` job `api` ("API — Release build, migrations, integration tests"); red only if O-ADM06-1 is "Yes" |
| Full integration suite with a database | No SQL Server | CI job `api` |
| Live Kestrel host on a 42xx port | Sign-in needs SQL Server; used the in-process test host instead (section 5) | CI job `api` for authenticated flows |
| `npm test`, `typecheck`, `build`, `design:check`, `compare:sections` (website); `npm test`, `build`, `test:e2e` (studio) | No file in `website/`, `studio/` or `packages/` changes (`git diff --name-only a866cf6 8ab00e0` has none); Studio `node_modules` not installed | CI jobs `website`, `studio`, `section-compare` |
| Semgrep, gitleaks | Not installed here | `security.yml` jobs `semgrep` ("Semgrep (ERROR fails, WARNING reported)"), `gitleaks-pr`, `gitleaks-history` |

### Findings

No Blocker, Major or Minor finding against the code or tests.

Observations (not defects of this change; for the record):

1. **G3 red for tests 4 to 8 is still open.** The G3 rule "shown failing before
   the fix" is met locally for tests 1 to 3 and the probe test, and by this
   report's real-route reproduction, but not for the five database tests. This
   waits on owner decision O-ADM06-1 (PENDING), exactly as plan section 9 says.
   If the owner answers "No", the delivery becomes BLOCKED ON OWNER until a
   D-NNN entry records the owner's acceptance. Gate 2 must carry this forward.
2. **Validation messages echo the raw query value**, for example
   `"The value 'abc,3' is not valid for Page."`. That is ASP.NET Core's default
   message, JSON-encoded inside `application/problem+json`, and it already
   applied to `pageSize` before this change. It is now also reachable for
   `page`. No injection risk seen; candidate for a later A-6 tidy-up, not this
   change.
3. **Lenient integer parsing**: `page=0x10` binds 16, `page=+2` and `page=2%00`
   bind 2, and a repeated `page` takes the first value. Framework behaviour; the
   `[Range]` limits still apply, so no out-of-range value gets through.
4. **Out-of-range `page` and `pageSize` now return 400 instead of 200.** This is
   the behaviour change accepted at gate 1 as restoring the declared A-8 limit.
   No caller sends such a value (section 8).
5. **Tie-breaking** on newest-first lists (audit, media, contact) is still out of
   scope (plan 3.2), passed to ADM-15 and ADM-16.

### Coverage table rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `?page=2&pageSize=5` returns the requested page and size, not page 1 of 20 | Audit ADM-06, bullet 1 | Verified | Section 2 (red `Expected: 2 Actual: 1`), section 3 (green), section 5 (all five routes: red `1, 20`, head `2, 5`) |
| Fixed on audit | Audit ADM-06, bullet 2 | Verified (binding); page-2 test NOT RUN | Test 1 at red and green; section 5 rows `/api/v1/audit`; test 7 reviewed (section 7), runs in CI `api` |
| Fixed on contact requests | Audit ADM-06, bullet 2 | Verified (binding); page-2 test NOT RUN | Test 1; section 5; test 5 reviewed |
| Fixed on redirects | Audit ADM-06, bullet 2 | Verified (binding); page-2 test NOT RUN | Test 1; section 5; test 4 reviewed |
| Fixed on media | Audit ADM-06, bullet 2 | Verified (binding); page-2 test NOT RUN | Test 1; section 5; test 6 reviewed |
| Fixed on every collection | Audit ADM-06, bullet 2 | Verified (binding); page-2 test NOT RUN | Test 1 (`ContentController.List`); section 5 rows `/api/v1/pages` and `/api/v1/vacancies` (incl. HR); test 8 reviewed |
| Enquiries, audit entries and media past the first page reachable through the API | Audit ADM-06, bullet 3 | Verified (binding) | Section 5: `page=2` and up to `page=10000` bind on all routes |
| Preview loader no longer repeats items past 20 (API side) | Audit ADM-06, bullet 4 | Verified (binding) | `previewData.ts:57` sends `?page=N&pageSize=100`; section 5 shows `page` honoured on `/api/v1/pages` and the other collections |
| Fix: bind with `Name = ""` | Audit ADM-06, Fix 1 | Verified | `17894c7` diff: `[ModelBinder(Name = "")]` on `PageQuery`, nothing else |
| Fix: a page-2 test per endpoint | Audit ADM-06, Fix 3 | Written and reviewed; NOT RUN | `ListPagingTests` tests 4 to 8; section 7; CI `api` |
| `[Range]` limits enforced when `page` is sent | Plan 2.2, A-8 | Verified | Test 3 red/green; section 5 edge table (boundaries, negatives, overflow, non-numeric) |
| Regression test committed and shown failing before the fix | G3 checklist | Met for tests 1 to 3 and the probe test; open for tests 4 to 8 | Section 1 (commit order), section 2; tests 4 to 8 wait on O-ADM06-1 |
| No database-free test regressed | Plan 5.3 | Verified | Section 4: 0 lost of 167 |
| Release build, no new warnings | Plan 5.3 | Verified | Section 3: 0 errors, 13 warnings, all in `ContentWriter.cs` |
| Anonymous and wrong-role behaviour unchanged | Security (tester) | Verified | Section 5: 401/403 identical at red and head |
| Out-of-range values give RFC 7807 400 with no internals | A-6, security (tester) | Verified | Section 5 |
| No new vulnerable package or secret | Security (tester) | Verified | Section 6 |
| Studio paging controls; Studio preview test | Audit ADM-06, Fix 2, bullets 3 and 4 | Moved to ADM-06b | Plan 3.3 |

Processes: I opened no port. My builds left MSBuild node processes (started
23:34 to 23:39 UTC), which I stopped. `VBCSCompiler` PID 864 (started 23:07,
before my work) is not mine and was left running. Both worktrees were removed.

Verdict: APPROVED
