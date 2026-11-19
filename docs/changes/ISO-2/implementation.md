# ISO-2 implementation

- Developer: Claude Code (developer role). Worktree `D:\work\DigitalHub\dh-platform-claude-iso-2`,
  branch `change/ISO-2`, not pushed (no upstream; plan-approval condition 8).
- Plan: `docs/changes/ISO-2/plan.md`, round 2. Gate 1: `plan-approval.md`, `Verdict: APPROVED`,
  with conditions 1 to 9 (answered in section 9 below).
- Track: G2, isolation. Owner's request and go-ahead (19 November 2026) are quoted in plan section 1.
- Local tools: `dotnet` 10.0.401 (Release only), Node from the machine, Semgrep 1.180.0.
  Databases: `DigitalHubContent_Test` only. No migration.

## 1. Base, PR #68 and the rebase

| Step | Command | Result |
|---|---|---|
| Start | `git rev-parse origin/rebuild/dotnet-platform` | `522b17549736851f9f8848b1bdaadd14229b6557`; plan commit `d2d1eea` on top |
| After commit 6 | `gh pr view 68 --json state` | `{"state":"MERGED"}`; `mergedAt` `2026-11-19T13:34:42Z`, merge commit `8d8e01d` |
| C20 | `gh pr list --state open`; `gh pr view <n> --json files` | Open: #72 (`website/package.json`, `website/package-lock.json`, `docs/changes/GAP-NEXT-UPGRADE/*`) and #60 (`studio/e2e/redirects.spec.ts`). No path shared with ISO-2 |
| Fetch | `git fetch origin; git log --oneline 522b175..origin/rebuild/dotnet-platform` | `8027e87` ADM-12c (#73), `8d8e01d` GAP-09 (#68), `881639d` ADM-12 (#70). None touches an ISO-2 file (`git diff --stat 522b175 origin/rebuild/dotnet-platform`: `.github/*`, admin `Content/*`, admin tests, studio, docs) |
| Rebase | `git rebase origin/rebuild/dotnet-platform` | `Successfully rebased and updated refs/heads/change/ISO-2.` No conflict. Local branch only (`git ls-remote --heads origin change/ISO-2` empty), so no shared history was rewritten |

New base `8027e8729213e59b21d4cfa810beb0516944d06f`. Its CI run is **44535111169** (workflow CI,
`push`, conclusion `success`). Baselines from it (plan 5.3 "If the base moves"; condition 4):

| Baseline | Value from run 44535111169 |
|---|---|
| `api-tests.trx` Counters | `total="593" executed="593" passed="593" failed="0"` |
| Integration names, `grep -o 'testName="[^"]*"' \| LC_ALL=C sort \| sha256sum` | 593 lines, `b39d4859a8f15ce02e4a8f0e4a5ce12b56cccce980d1e42800ed48cfea2e8b95` |
| End-to-end `e2e-junit.xml` | `tests="34" failures="0" skipped="0" errors="0"`; names hash `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a` (unchanged from 522b175) |
| Build (Release) | `13 Warning(s)`, `0 Error(s)` |
| Website Vitest | `Test Files 23 passed \| 1 skipped (24)`, `Tests 443 passed \| 31 skipped (474)` (the skipped file is `test/screenshot-parity-browser.test.ts`, 31 tests) |
| Studio Vitest | `Test Files 16 passed (16)`, `Tests 118 passed (118)` |

## 2. Commits

| # | Planned subject | Before rebase | After rebase (final) |
|---|---|---|---|
| — | ISO-2: Plan | `d2d1eea` | `2c99456` |
| 1 | ISO-2: Add a canary the forms-library guard misses (red) | `caf2ec3` | **`7049d28`** (red) |
| 2 | ISO-2: Widen the forms-library guard to authentication and Identity | `2f65c0b` | `917055b` |
| 3 | ISO-2: Add the DigitalHub.PublicApi project, its forms context and its infrastructure copies | `f2a9fee` | `325ff24` |
| 4 | ISO-2: Add the public API's integration suite (red) | `006f846` | **`19db9b5`** (red) |
| 5 | ISO-2: Serve the contact and apply forms from the public API | `03250b3` | `30a9018` |
| 6 | ISO-2: Answer 404 to everything but the two form routes | `3d638c1` | `0568cbb` |
| 6a | ISO-2: Give every test-fixture command a literal SQL text (fix for a C16 finding, section 5) | — | `1193375` |
| 7 | ISO-2: Run the public API suite in CI, and record the second API in the readme and standards | — | the commit that adds this file (head) |

Commits 1 to 7 stay separate and in the planned order; red commits 1 and 4 precede their fixes
(B-6). Commit 6a is an extra commit for an implementation slip inside the plan (section 5).

## 3. What changed, file by file (plan section 4)

### 3.1 Created

| File | Lines | Scope item | Notes |
|---|---|---|---|
| `api/src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj` | 26 | 3.1 | Web SDK, net10.0. `ProjectReference` to `DigitalHub.Forms` only. Packages EF Core SqlServer 10.0.12, Serilog.AspNetCore 10.0.0, Pkcs 9.0.21 (GHSA comment). **No `UserSecretsId`** |
| `api/src/DigitalHub.PublicApi/Program.cs` | 149 | 3.1 | Commit 3: Kestrel, Serilog, `PublicForms` check, services, `Build`/`Run`. Commit 5: `Auth` refusal, forwarded headers, contact rate limiter, exception handler, `AddControllers` with the admin's `InvalidModelStateResponseFactory`, pipeline. Commit 6: `UseMiddleware<PublicRouteGate>()` after `ExceptionShieldMiddleware`, before `RequestBodyLimitMiddleware` |
| `api/src/DigitalHub.PublicApi/appsettings.json` | 35 | 3.1 | `Serilog`, `Contact`, `Apply`, `Email` (blank credentials), `ForwardedHeaders` (`KnownProxies: []`), `Security`, `AllowedHosts: "*"`. No `Auth`, no connection string |
| `api/src/DigitalHub.PublicApi/Controllers/PublicContactController.cs` | 50 | 3.1 | Admin copy without `[AllowAnonymous]`; namespace `DigitalHub.PublicApi.Controllers` |
| `api/src/DigitalHub.PublicApi/Controllers/PublicApplyController.cs` | 25 | 3.1 | Same |
| `api/src/DigitalHub.PublicApi/Data/FormsEntities.cs` | 57 | 3.3 | `ContactRequest`, `Vacancy`, `SiteSettings`, `ApplicationCount` (names from the `dbSetAllow` list) |
| `api/src/DigitalHub.PublicApi/Data/PublicFormsDbContext.cs` | 66 | 3.3 | Four tables, explicit `HasColumnName`, `ValueGeneratedNever` on every key, no navigations or foreign keys |
| `api/src/DigitalHub.PublicApi/Data/PublicFormsData.cs` | 49 | 3.3 | `IFormsData` as in the plan's table; the count goes through `ApplicationCountSql.IncrementAsync(db.Database, ...)` |
| `api/src/DigitalHub.PublicApi/Infrastructure/ProblemResults.cs` | 36 | 3.4, group A | Verbatim except the namespace line |
| `.../Infrastructure/CorrelationIdMiddleware.cs` | 49 | group A | Same |
| `.../Infrastructure/SecurityHeadersMiddleware.cs` | 32 | group A | Same |
| `.../Infrastructure/UnhandledExceptionHandler.cs` | 29 | group A | Same |
| `.../Infrastructure/RateLimitLog.cs` | 45 | group A | Namespace, and `Category = "DigitalHub.PublicApi.RateLimit"` |
| `.../Infrastructure/SensitiveDestructuringPolicy.cs` | 69 | group A | Namespace only |
| `.../Infrastructure/ExceptionShieldMiddleware.cs` | 90 | group B | Namespace only |
| `.../Infrastructure/RequestBodyLimit.cs` | 112 | group B | Namespace only |
| `.../Infrastructure/PublicRouteGate.cs` | 28 | 3.2 | The class in plan 3.2, with a doc comment |
| `api/tests/Shared/ReferenceGuard.cs` | 32 | 3.6 | The class in plan 3.6, `using System.Reflection;` added so it compiles in both projects |
| `api/tests/DigitalHub.Api.Tests/GuardCanary.cs` | 16 | 3.6 (a) | The tester's F1 reproduction, never called |
| `api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj` | 39 | 3.5 | Same shape and packages as the admin test project (no SkiaSharp); references PublicApi and Forms only; linked `ReferenceGuard.cs`; `<UserSecretsId>` in the csproj, never a C# literal |
| `.../PublicApiFactory.cs` | 119 | 3.5 | `UseEnvironment("Testing")`, `ConnectionStrings:PublicForms`, `Apply:*PermitLimit` 1000, no `Auth`. Copies of `TestConfiguration` (reads the store with `AddUserSecrets(typeof(PublicApiFactory).Assembly)` into a standalone `ConfigurationBuilder`), `ToTestCatalog`, `ElevatedTestConnectionString`, `TestConnectionString`. `[CollectionDefinition("PublicFormsSql", DisableParallelization = true)]` |
| `.../FormsDatabase.cs` | 123 | 3.5 | ADO.NET fixtures on the restricted login, parameterised, literal SQL (after 6a). `ElevatedConnectionString()` delegates to the factory's copy |
| `.../PublicRouteTests.cs` | 191 | T-R1, T-R2 | |
| `.../PublicApiIsolationTests.cs` | 222 | T-I1 to T-I7 | |
| `.../PublicApiReferenceTests.cs` | 68 | T-G2 to T-G4 | |
| `.../InfrastructureParityTests.cs` | 111 | T-D1, T-D2 | |
| `.../PublicContactTests.cs` | 241 | T-P | 7 tests and `PublicContactEmptyProxyTests` |
| `.../PublicApplyTests.cs` | 587 | T-P | 13 tests, factories, helpers, `FakeClock` copy |
| `.../PublicBodyLimitTests.cs` | 87 | T-P | |
| `.../PublicRateLimitLogTests.cs` | 103 | T-P | |
| `.../PublicAbortedRequestTests.cs` | 194 | T-P | |
| `.../PublicServerHeaderTests.cs` | 137 | T-P | |
| `docs/changes/ISO-2/implementation.md` | — | 4.1 | This file |

Logger categories of the copied types (plan 3.4): `DigitalHub.PublicApi.Infrastructure.ExceptionShieldMiddleware`
and `DigitalHub.PublicApi.Infrastructure.UnhandledExceptionHandler` (both `ILogger<T>`), and
`DigitalHub.PublicApi.RateLimit` (`RateLimitLog.Category`). `ProblemResults`,
`CorrelationIdMiddleware`, `SecurityHeadersMiddleware`, `RequestBodyLimit*` and
`SensitiveDestructuringPolicy` do not log.

Duplication as built (plan 3.4.1; `wc -l` on the new files): group A 260 (36+49+32+29+45+69);
group B 202 (90+112); group C 60 (Kestrel 1, Serilog 7, forwarded headers 24, `AddControllers` 28);
group D 97 (controllers 50+25, rate limiter 22); groups E and F are the ported test files above
(`PublicApiFactory` 119, `PublicAbortedRequestTests` 194, `PublicServerHeaderTests` 137, the `Network`
theory in `PublicRateLimitLogTests`; `PublicApplyTests` 587, `PublicContactTests` 241,
`PublicBodyLimitTests` 87, the contact test in `PublicRateLimitLogTests`). New code that is not
a copy: `PublicRouteGate` 28, `Data/*` 172, `FormsDatabase` 123, `PublicRouteTests` 191,
`PublicApiIsolationTests` 222, `PublicApiReferenceTests` 68, `InfrastructureParityTests` 111,
`ReferenceGuard` 32, `GuardCanary` 16.

### 3.2 Changed

| File | Change | Commit |
|---|---|---|
| `api/DigitalHub.slnx` | `src/DigitalHub.PublicApi/...` under `/src/` (3), `tests/DigitalHub.PublicApi.Tests/...` under `/tests/` (4) | 3, 4 |
| `api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` | One line: `<Compile Include="..\Shared\ReferenceGuard.cs" Link="Shared\ReferenceGuard.cs" />` | 2 |
| `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs` | T-F1 added (1); `ForbiddenReferences` removed, both tests on `ReferenceGuard` (2). Names unchanged | 1, 2 |
| `website/test/no-hiring-system.test.ts` | Line 114 only, as in plan 3.3 | 3 |
| `.github/workflows/ci.yml` | The one step of plan 3.8, after "Integration tests (Release)", on the post-#68 file | 7 |
| `api/README.md` | Line 3 names `src/DigitalHub.PublicApi`, its two routes, the 404, `ConnectionStrings:PublicForms` and the `Auth` refusal; the tests line adds the public suite | 7 |
| `ENGINEERING_STANDARDS.md` | The "Enforced by" cells of P-5 and S-2 only, worded as plan 3.2 | 7 |

Nothing in plan 4.3 changed (C11, section 6).

## 4. Red and green, commit by commit (plan 3.9, 5.2)

Before every database run: `Get-Process testhost,vstest*` count `0`. Each red state was run on the
pre-rebase commit and again on the rebased commit, in a temporary detached worktree in the session
scratchpad (removed afterwards; `git worktree list` shows none).

### Commit 1 (red), `caf2ec3` and rebased `7049d28`

```
dotnet build DigitalHub.slnx -c Release                       -> 13 Warning(s), 0 Error(s), exit 0
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"
  [FAIL] DigitalHub.Api.Tests.FormsLibraryTests.The_guard_rejects_the_authentication_and_identity_assemblies
  Assert.Contains() Failure: Item not found in collection
  Collection: ["DigitalHub.Api", "Microsoft.Extensions.Identity.Core", "Microsoft.Extensions.Identity.Stores", "DigitalHub.Images", "Microsoft.IdentityModel.Tokens", ···]
  Not found:  "Microsoft.AspNetCore.Identity"
  Failed!  - Failed: 1, Passed: 2, Skipped: 0, Total: 3                      -> exit 1
```

Matches the table: T-F1 red, the two existing tests green. This reproduces F1.

### Commit 2, `2f65c0b` / `917055b`

Build `13 Warning(s)`, `0 Error(s)` (both SHAs). `FormsLibraryTests`: `Passed! - Failed: 0, Passed: 3, Total: 3`, exit 0.

### Commit 3, `f2a9fee` / `325ff24`

Build `13 Warning(s)`, `0 Error(s)` (both SHAs); `grep warning` without ContentImport finds none.
C8 at commit 3 (34 references, none forbidden): `DigitalHub.Forms Microsoft.AspNetCore
Microsoft.AspNetCore.Diagnostics Microsoft.AspNetCore.Hosting.Abstractions ... Serilog.Sinks.Console
System.Collections ... System.Text.Json`. `npx vitest run test/no-hiring-system.test.ts`: `2 passed`.

### Commit 4 (red), `006f846` and rebased `19db9b5`

```
dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=c4.trx" --results-directory <S>
  Failed!  - Failed: 37, Passed: 34, Skipped: 0, Total: 71                   -> exit 1
```

**Report of a failure before its fix.** The first commit-4 run (not committed) failed T-R2 with
`System.InvalidOperationException : Misused header name, 'Allow'` - my test read `Allow` from the
response headers, where HttpClient refuses it (it is a content header). That is a red for the
wrong reason, so the test was corrected to read `response.Content.Headers.Allow` only, before
commit 4 was made. The assertion is unchanged (no `Allow` header). The run quoted here is the one
after that correction.

Outcome per test (the plan's `grep -o 'testName=...outcome=...'` line, `&quot;` shown as `"`):

```
Failed PublicAbortedRequestTests.A_chunked_body_that_ends_early_is_a_400_not_a_server_error(path: "/api/v1/public/contact", requestLogDelayMs: 0)
Failed PublicAbortedRequestTests.A_chunked_body_that_ends_early_is_a_400_not_a_server_error(path: "/api/v1/public/contact", requestLogDelayMs: 300)
Failed PublicAbortedRequestTests.A_client_that_disconnects_mid_body_is_not_a_server_error(path: "/api/v1/public/contact", requestLogDelayMs: 0)
Failed PublicAbortedRequestTests.A_client_that_disconnects_mid_body_is_not_a_server_error(path: "/api/v1/public/contact", requestLogDelayMs: 300)
Failed PublicApiIsolationTests.The_public_api_refuses_to_start_with_auth_settings
Failed PublicApiIsolationTests.The_public_api_starts_under_the_development_host_checks
Failed PublicApplyTests.(all 13)
Failed PublicBodyLimitTests.A_full_contact_form_under_16_KB_is_accepted
Failed PublicBodyLimitTests.The_reviews_20_MB_contact_body_is_refused_and_nothing_is_stored(withLength: False)
Failed PublicBodyLimitTests.The_reviews_20_MB_contact_body_is_refused_and_nothing_is_stored(withLength: True)
Failed PublicContactEmptyProxyTests.Empty_proxy_list_still_rate_limits_one_sender_when_the_forged_address_changes
Failed PublicContactTests.(all 7)
Failed PublicRateLimitLogTests.A_refused_contact_submission_logs_a_warning_without_the_message
Failed PublicRouteTests.Every_other_path_and_method_returns_404
Failed PublicRouteTests.Only_the_two_form_routes_are_mapped
Failed PublicServerHeaderTests.No_server_header_on_a_problem_response(method: "GET", path: "/api/v1/gap-12-no-such-route", status: 404)
Failed PublicServerHeaderTests.No_server_header_on_a_problem_response(method: "GET", path: "/api/v1/users", status: 404)
Failed PublicServerHeaderTests.No_server_header_on_a_problem_response(method: "POST", path: "/api/v1/public/contact", status: 400)
Failed PublicServerHeaderTests.No_server_header_on_a_success
Passed InfrastructureParityTests.The_parity_check_reports_a_difference
Passed InfrastructureParityTests.The_shared_infrastructure_matches_the_admin_copy (6 rows)
Passed PublicApiIsolationTests.The_forms_context_maps_only_the_four_tables
Passed PublicApiIsolationTests.The_public_api_has_no_migrations
Passed PublicApiIsolationTests.The_public_api_holds_no_signing_key
Passed PublicApiIsolationTests.The_public_api_refuses_to_start_without_its_connection_string
Passed PublicApiIsolationTests.The_public_api_registers_no_authentication_scheme_or_identity
Passed PublicApiReferenceTests.The_guard_reads_the_real_references_of_the_public_api
Passed PublicApiReferenceTests.The_guard_reports_every_forbidden_name (14 rows)
Passed PublicApiReferenceTests.The_public_api_and_forms_reference_no_admin_identity_or_token_code (2 rows)
Passed PublicRateLimitLogTests.The_network_drops_the_host_part (3 rows)
Passed PublicServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request
Passed PublicServerHeaderTests.The_host_under_test_is_Kestrel_on_a_loopback_socket
```

(The 13 apply and 7 contact names are listed one by one in the trx; all 20 are `Failed`.)
Against the 3.9 column 4: every red cell is `Failed` and every green cell is `Passed`, by name and
by row; 37 red, 34 green. The failures are for the planned reasons: the form requests get
`Expected: Created / Actual: NotFound` (and `RequestEntityTooLarge`, `BadRequest`,
`ServiceUnavailable`, `TooManyRequests` expected against 404); T-R1 `Expected: 2` (0 endpoints);
T-I3 `Assert.NotNull() Failure` (no refusal yet); T-I5 400 expected, 404 got; the rate-limit log
`Assert.Single()` on an empty collection; the aborted rows have no request-log line or no abort.
T-R2 reported 761 mismatches, every 404 with an empty body (`type (none)`), and the three positive
controls:

```
control POST /api/v1/public/contact {}: 404 (no code), expected 400 validation_failed
control POST /API/V1/PUBLIC/CONTACT {}: 404, expected 400
control POST /api/v1/public/apply (no form): 404 (no type), expected 400 and the HTML page
```

The rebased `19db9b5` run gave the identical outcome list (`diff` of the two outcome files: empty).

### Commit 5 (red on the gate only), `03250b3` and rebased `30a9018`

```
Failed!  - Failed: 3, Passed: 68, Skipped: 0, Total: 71                       -> exit 1
Failed PublicRouteTests.Every_other_path_and_method_returns_404
Failed PublicServerHeaderTests.No_server_header_on_a_problem_response(method: "GET", path: "/api/v1/gap-12-no-such-route", status: 404)
Failed PublicServerHeaderTests.No_server_header_on_a_problem_response(method: "GET", path: "/api/v1/users", status: 404)
```

Exactly the 3.9 column 5 red set; every other test passed, including T-I1 with MVC's core
services registered (no scheme, null `FallbackPolicy`, no endpoint authorization metadata).
T-R2: `764 mismatches`, none of them a control line (the three positive controls pass). Classified
by path with an `awk` over the message:

```
  4 G1 | status 405; Allow POST                       (HEAD on the 4 form paths)
 20 G1 | status 405; type (none); Allow POST          (GET PUT PATCH DELETE OPTIONS on the 4 form paths)
  1 G2 | status 400; code validation_failed           (POST /api/v1/public/contact/)
  1 G2 | status 400; type text/html                   (POST /api/v1/public/apply/)
  2 G2 | status 405; Allow POST                       (HEAD on the 2 trailing-slash paths)
 10 G2 | status 405; type (none); Allow POST          (other methods on the 2 trailing-slash paths)
726 G3 | type (none)                                  (121 other paths x 6 non-HEAD methods)
```

Every mismatch is in G1, G2 or G3; there is at least one in each; none is outside them. HEAD on the
121 other paths is a 404 with no `Allow` or `Set-Cookie`, so it already matches, as the plan's
"for non-HEAD requests" says. The rebased run gave the identical outcome list.

### Commit 6, `3d638c1` / `0568cbb`

Build `13 Warning(s)`, `0 Error(s)` (rebased SHA built in the recheck worktree).
`Passed!  - Failed: 0, Passed: 71, Skipped: 0, Total: 71`, exit 0;
`<Counters total="71" executed="71" passed="71" failed="0" ...>`.

## 5. Failures found after commit 6, reported before the fix

**C16 Semgrep, first run on the rebased head `0568cbb`** (`RUNNER_TEMP=<S> sh .github/security/run-semgrep.sh`):

```
::error title=New finding (semgrep)::csharp.lang.security.sqli.csharp-sqli.csharp-sqli in api/tests/DigitalHub.PublicApi.Tests/FormsDatabase.cs:118
semgrep: 2 finding(s) at the gate's level; 1 known, 1 new.          -> exit 1
```

Line 118 was `command.CommandText = sql;` in a shared `ExecuteAsync(string sql, ...)` helper. The SQL
was always a literal at the call sites and every value a parameter, but the gate (G-10, 0 new) is
right that the helper accepts any string. An implementation slip inside the plan (3.5 asks for
parameterised fixtures), so fixed, not narrowed: commit 6a `1193375` removes the helper and gives
each fixture its own literal `CommandText`. After it: build `0 Error(s)`; public suite
`Passed! - Failed: 0, Passed: 71, Total: 71`; Semgrep `semgrep: 1 finding(s) at the gate's level;
1 known, 0 new.`, exit 0. No baseline or ignore entry was added (P-6).

## 6. Checks after the change (plan 5.3), on the rebased head

Run from `api/` unless stated; `<S>` is the session scratchpad. `npm ci --no-audit --no-fund` in
`website/` first (exit 0) and in `studio/` before its tests (exit 0, `added 245 packages`). Neither
changed a lockfile (`git status` clean of them).

| # | Command | Exit | Result |
|---|---|---|---|
| C1 | `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`; every `warning` line is in `DigitalHub.ContentImport` (0 lines outside it). Equals the new base's 13 |
| C2 | `dotnet test tests/DigitalHub.PublicApi.Tests/... --logger "trx;LogFileName=public-api-tests.trx"` | 0 | `Passed! - Failed: 0, Passed: 71, Skipped: 0, Total: 71`; `<Counters total="71" executed="71" passed="71" failed="0">`. **The "Done when" suite.** Re-run after 6a: same, 71 of 71 |
| C3 | `dotnet test tests/DigitalHub.Api.Tests/... --logger "trx;LogFileName=api-tests.trx"` | 0 | `Passed! - Failed: 0, Passed: 594, Skipped: 0, Total: 594`; Counters `total="594" ... failed="0"`. New base 593 plus T-F1 |
| C4 | `grep -o 'testName="[^"]*"' <S>/api-tests.trx \| grep -v 'The_guard_rejects_the_authentication_and_identity_assemblies' \| LC_ALL=C sort \| sha256sum` | 0 | `b39d4859a8f15ce02e4a8f0e4a5ce12b56cccce980d1e42800ed48cfea2e8b95`, the new base's hash. `comm -23 base head` empty; `comm -13` is exactly `FormsLibraryTests.The_guard_rejects_the_authentication_and_identity_assemblies` |
| C5 | `dotnet test ... --filter "FullyQualifiedName~FormsLibraryTests\|...~CareersTests\|...~ApplyDedupeTests\|...~PublicContact\|...~RequestBodyLimitTests\|...~RateLimitLogTests\|...~AbortedRequestTests"` | 0 | `Passed! - Failed: 0, Passed: 51, Total: 51`. The admin's own form routes are untouched |
| C6 | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;Encrypt=True;TrustServerCertificate=True" dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build` | 0 | `No changes have been made to the model since the last migration.` |
| C7 | `git ls-files api/src/DigitalHub.PublicApi \| grep -i migration`; `git diff --stat origin/rebuild/dotnet-platform...HEAD -- api/src/DigitalHub.Api/Data` | — | Both empty |
| C8 | `ReflectionOnlyLoadFrom(...DigitalHub.PublicApi.dll).GetReferencedAssemblies()` | 0 | 41 names, quoted in full: `DigitalHub.Forms Microsoft.AspNetCore Microsoft.AspNetCore.Diagnostics Microsoft.AspNetCore.Hosting.Abstractions Microsoft.AspNetCore.Http.Abstractions Microsoft.AspNetCore.Http.Extensions Microsoft.AspNetCore.Http.Features Microsoft.AspNetCore.HttpOverrides Microsoft.AspNetCore.Mvc Microsoft.AspNetCore.Mvc.Abstractions Microsoft.AspNetCore.Mvc.Core Microsoft.AspNetCore.RateLimiting Microsoft.AspNetCore.Routing Microsoft.AspNetCore.Server.Kestrel Microsoft.AspNetCore.Server.Kestrel.Core Microsoft.EntityFrameworkCore Microsoft.EntityFrameworkCore.Relational Microsoft.EntityFrameworkCore.SqlServer Microsoft.Extensions.Configuration Microsoft.Extensions.Configuration.Abstractions Microsoft.Extensions.Configuration.Binder Microsoft.Extensions.DependencyInjection.Abstractions Microsoft.Extensions.Features Microsoft.Extensions.Hosting.Abstractions Microsoft.Extensions.Logging.Abstractions Microsoft.Extensions.Options Microsoft.Extensions.Primitives Serilog Serilog.AspNetCore Serilog.Extensions.Hosting Serilog.Settings.Configuration Serilog.Sinks.Console System.Collections System.ComponentModel System.Linq.Expressions System.Linq.Queryable System.Memory System.Net.Primitives System.Runtime System.Text.Json System.Threading.RateLimiting`. None is forbidden by `ReferenceGuard` (no `Microsoft.AspNetCore.Authentication*`, `.Identity*`, `Microsoft.Extensions.Identity*`, `Microsoft.IdentityModel*`); `DigitalHub.Forms` present; `DigitalHub.Api` absent. The 3.6 stop condition did not trigger |
| C9 | `dotnet list src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj package --include-transitive` | 0 | Top level: `Microsoft.EntityFrameworkCore.SqlServer 10.0.12`, `Serilog.AspNetCore 10.0.0`, `System.Security.Cryptography.Pkcs 9.0.21`. No `Microsoft.AspNetCore.Identity.*`, `Microsoft.Extensions.Identity.*` or `Microsoft.AspNetCore.Authentication.JwtBearer`. The transitive identity-named packages are SqlClient's Entra ID set, as plan 3.6 expects: `Azure.Identity 1.17.1`, `Microsoft.Identity.Client*`, `Microsoft.IdentityModel.* 7.7.1/8.14.0`, `System.IdentityModel.Tokens.Jwt 7.7.1` |
| C10 | `dotnet list DigitalHub.slnx package --vulnerable --include-transitive`; `RUNNER_TEMP=<S> sh ../.github/security/run-dotnet-audit.sh` | 0, 0 | All six projects "has no vulnerable packages given the current sources"; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| C11 | `git diff --stat origin/rebuild/dotnet-platform -- api/src/DigitalHub.Api api/src/DigitalHub.Forms api/src/DigitalHub.Images api/tools studio packages docs/adr docs/security-deployment.md .github/security .github/workflows/security.yml .github/workflows/codeql.yml .github/workflows/workflow-lint.yml` (working tree = commit 7 content) | 0 | Empty. `-- api/tests/DigitalHub.Api.Tests`: only `DigitalHub.Api.Tests.csproj` (+1), `FormsLibraryTests.cs`, `GuardCanary.cs` (new). `-- website`: exactly the line-114 change. `-- ENGINEERING_STANDARDS.md`: 2 lines changed, the two "Enforced by" cells. Lockfiles: no change |
| C12 | `git diff origin/rebuild/dotnet-platform -- .github/workflows/ci.yml` | 0 | One hunk `@@ -131,6 +131,15 @@`: the nine added lines of plan 3.8 (the step and a blank line), nothing else. The step sits between "Integration tests (Release)" and "Upload test report" on the post-#68 file; #68's pinned `actions/upload-artifact@ea165f8d... # v4.6.2` line is untouched |
| C13 | Group A and B: `diff <(sed 1,/^namespace/d <admin>) <(sed 1,/^namespace/d <public>)`, and the `using` lines above `namespace` | 0 | All eight: no difference, except `RateLimitLog.cs` line 10 `Category`. `using` lines identical in all eight (the plan allowed `DigitalHub.PublicApi.*` differences; there are none) |
| C13 | Group C: admin `Program.cs` 29, 31-37, 85-108, 169-203 against the public blocks (`diff`) | — | Kestrel line identical; Serilog block identical; forwarded-headers block identical. `AddControllers`: the admin's `options.Conventions.Add(new ApiV1RouteConvention())` and `.AddJsonOptions(... UtcDateTimeJsonConverter ...)` (8 lines) become `AddControllers()` (plan 3.1 step 8: no convention; the converter is not used by the forms, 2.2); the `ConfigureApiBehaviorOptions` block is identical. Rate limiter: the `media-upload` and `build-content` policies and the title `switch` are removed, the title is the literal `"Too many contact submissions."` (plan 3.1 step 6). Pipeline: `DuplicateJsonFieldGuardMiddleware` and `UseAuthentication` are not there, `PublicRouteGate` is added |
| C13 | Group E: `ApiFactory.cs:118-206` against `PublicApiFactory`'s helpers (`diff`) | — | Three differences: `.AddUserSecrets(SecretsId)` becomes `.AddUserSecrets(typeof(PublicApiFactory).Assembly)` (plan 3.5, no C# literal of the id); the `ElevatedTestConnectionString` comment drops the audit-row sentence (this suite writes no audit row); `TestConnectionString` is `internal` with a summary line, because `FormsDatabase` uses it |
| C14 | `cd ../website && npx vitest run test/no-hiring-system.test.ts` | 0 | `Test Files 1 passed (1)`, `Tests 2 passed (2)`. The one-off proof is in section 7 (condition 1) |
| C15 | `cd ../website && npm test`; `cd ../studio && npm test` | 0, 0 | Website `Test Files 24 passed (24)`, `Tests 473 passed \| 1 skipped (474)`. Base CI: `474` tests, `443 passed \| 31 skipped`; the difference is `test/screenshot-parity-browser.test.ts`, whose 31 tests skip in CI and run on this machine. Same total. Studio `Test Files 16 passed (16)`, `Tests 118 passed (118)`, the base's figures |
| C16 | `RUNNER_TEMP=<S> sh .github/security/run-semgrep.sh` (repo root, Semgrep 1.180.0) | 0 | After 6a: `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (first run: 1 new, section 5) |
| C17 | gitleaks | — | **NOT RUN** locally: not installed (`command -v gitleaks`: not found). Covered by the Security workflow's `gitleaks-pr` job on the PR head. In its place `git diff origin/rebuild/dotnet-platform...HEAD \| grep -E '^\+' \| grep -iE "password=\|pwd=\|secret\|SigningKey\|41335d15"` matches: the test csproj `<UserSecretsId>` (expected); `"secret"` and `"signingKey"` in the verbatim copy of `SensitiveDestructuringPolicy`'s redaction set (names, not values); the test's dummy `UseSetting("Auth:SigningKey", "x")` and `configuration["Auth:SigningKey"]` in T-I2/T-I3; comments and plan/approval prose. No value of any secret |
| C18 | actionlint on `ci.yml` | — | **NOT RUN** locally: `actionlint` is not installed, and `.github/lint/install-actionlint.sh` downloads the Linux x86_64 binaries, which do not run on this Windows machine. Covered by the Workflow lint job (blocking) on the PR head. The step has the shape of the existing test step and adds no `uses:` |
| C19 | `cd ../studio && npm run test:e2e` | — | **NOT RUN** locally: the harness fails at "Release migrations" (plan 2.10), and ISO-2 changes nothing it builds. Covered by CI job `studio`, "End-to-end suite", on the PR head: the 34 names must hash to `ed0f1b41...848a` with `tests="34" failures="0"` |
| C20 | `gh pr list --state open`; `gh pr view <n> --json files` | 0 | Section 1: #72 and #60, no shared path. #68 `MERGED` before commit 7 |

User secrets (condition 5), by key name only, never a value:
`dotnet user-secrets list --id <the admin store> | grep -c '^Auth:SigningKey '` prints `1`, and
`grep -c '^ConnectionStrings:Content '` prints `1`. So T-I2 (no `Auth` section, `Auth:SigningKey`
null in the host) and T-I5 passed on a machine whose store holds a signing key.
`PublicApiFactory` reads the store into a standalone `ConfigurationBuilder` and passes only the
rewritten connection string to the host with `UseSetting`; it never adds the store to the host.
The generated `obj/Release/net10.0/DigitalHub.PublicApi.Tests.AssemblyInfo.cs` holds the
`UserSecretsIdAttribute`; the PublicApi project has none.

## 7. One-off proofs (not committed; each ended with the scratch removed)

**T-G1, plan 3.6 (c): the guard fails on Forms and on PublicApi, then the scratch is removed.**
`api/src/DigitalHub.Forms/ScratchGuardCanary.cs` with the `GuardCanary` body; build `0 Error(s)`:

```
FormsLibraryTests.The_forms_library_references_no_admin_api_identity_or_token_code [FAIL]
   Assert.Empty() Failure: Collection was not empty
Collection: ["Microsoft.AspNetCore.Authentication", "Microsoft.AspNetCore.Authentication.BearerToken", "Microsoft.AspNetCore.Authentication.Cookies", "Microsoft.AspNetCore.Identity"]
Failed!  - Failed: 1, Passed: 0, Total: 1                                    -> exit 1
PublicApiReferenceTests.The_public_api_and_forms_reference_no_admin_identity_or_token_code(assembly: "DigitalHub.Forms") [FAIL]
Collection: [the same four]
Failed!  - Failed: 1, Passed: 1, Total: 2                                    -> exit 1
```

File removed. Then `api/src/DigitalHub.PublicApi/ScratchGuardCanary.cs`, build `0 Error(s)`:

```
PublicApiReferenceTests.The_public_api_and_forms_reference_no_admin_identity_or_token_code(assembly: "DigitalHub.PublicApi") [FAIL]
Collection: ["Microsoft.AspNetCore.Authentication", "Microsoft.AspNetCore.Authentication.BearerToken", "Microsoft.AspNetCore.Authentication.Cookies", "Microsoft.AspNetCore.Identity"]
Failed!  - Failed: 1, Passed: 1, Total: 2                                    -> exit 1
```

File removed. `git status --short` after each: only ` M .github/workflows/ci.yml`,
` M ENGINEERING_STANDARDS.md`, ` M api/README.md` (commit 7's edits, in progress), no scratch file.

**T-D1 by hand, plan 3.4.2.** The public `SecurityHeadersMiddleware.cs` has no comment, so a
one-comment edit was made instead: `//x` appended to line 21 (`git diff --stat`: 1 line). Then
`dotnet test ... --filter "FullyQualifiedName~InfrastructureParityTests"`:

```
The_shared_infrastructure_matches_the_admin_copy(file: "SecurityHeadersMiddleware.cs") [FAIL]
   SecurityHeadersMiddleware.cs differs from the admin copy at line 21: admin "            headers["X-Frame-Options"] = "DENY";", public "            headers["X-Frame-Options"] = "DENY"; //x"
Failed!  - Failed: 1, Passed: 6, Total: 7                                    -> exit 1
```

Reverted with `git checkout --`; `git status --short` shows only the three commit-7 files.

**C14, plan-approval condition 1 (R2-1).** Scratch `api/src/DigitalHub.PublicApi/Data/ScratchColumn.cs`
containing `HasColumnName("candidate_note")` (matches `hiringName`, contains no needle):

```
== with the line-114 change
 FAIL  test/no-hiring-system.test.ts > no hiring system > keeps a candidate store, CV storage, and the old careers API out of the product
+   "api/src/DigitalHub.PublicApi/Data/ScratchColumn.cs names candidate_note",
      Tests  1 failed | 1 passed (2)                                         -> exit 1
== line 114 temporarily restored to the base text (git show 522b175:website/test/no-hiring-system.test.ts)
      Tests  2 passed (2)                                                    -> exit 0
```

Both scratch edits removed (`git checkout -- website/test/no-hiring-system.test.ts`, scratch file
deleted); `git status --short` shows only the three commit-7 files, and line 114 is the ISO-2 text.
So the new rule, not a needle, is what reaches the public `Data/` folder.

## 8. Where the build differs from the plan's wording (no design change)

- **T-R2's last assertion** is `Assert.True(mismatches.Count == 0, "<n> mismatches:\n" + list)`
  instead of `Assert.Empty(mismatches)`: the same condition, but the failure message lists every
  mismatch (xUnit truncates a collection), which the G1-G3 classification at commit 5 needed.
- **T-F1 is one `[Fact]`** looping over the four names, so the admin total is 578 (now 593) plus 1, as C3 expects.
- **T-I6** also asserts no skip navigations and no foreign keys (plan 3.3 says there are none).
- **Ported tests.** `Anonymous_contact_is_stored_as_new_without_an_ip` reads the row as a
  column dictionary, so the admin's `GetProperty("IpAddress" | "RemoteIp" | "ClientIp")` checks
  become checks that no `ip_address`, `remote_ip` or `client_ip` column exists; the JSON "no ip"
  check is unchanged. `Script_in_a_contact_message_is_stored_unchanged` keeps the stored-unchanged
  assertion and drops the Studio list and detail read-back (an admin route this suite cannot call).
  `The_reviews_20_MB_contact_body...` checks no row by the marker's email instead of its name. The
  rate-limit log test also asserts `SourceContext="DigitalHub.PublicApi.RateLimit"` (plan 5.1).
  `Consent_and_closed_vacancies_are_refused` creates its draft and ended vacancies before the first
  request, so all three are deleted in one `finally`. A `FakeClock` copy lives in
  `PublicApplyTests.cs` (the admin's is in `SessionLimitTests.cs`).
- **`FormsDatabase.ElevatedConnectionString()`** delegates to `PublicApiFactory.ElevatedTestConnectionString()`,
  so all four `ApiFactory` helper copies sit together in the factory (group E).
- **Commit 6a** is an extra commit (section 5).

## 9. Plan-approval conditions

| # | Condition | How it was met |
|---|---|---|
| 1 | R2-1: `candidate_note` proof, failing with line 114 and passing with the base line, scratch removed | Section 7 |
| 2 | R2-2: T-R1 is the public API's role matrix; seventh hand-off item | Section 10 and hand-off item 7 |
| 3 | No `.github/` in commits 1 to 6; C20 and `gh pr view 68` before commit 7; rebase; only the 3.8 step | Commits 1-6 touch no `.github/` file. #68 `MERGED`; rebased on `8027e87`; C12 shows only the step |
| 4 | After the rebase: commits separate and in order, new SHAs quoted, baselines from the new base's CI run, C1-C5 and C14 re-run | Sections 1, 2 and 6 (run 44535111169). Red states also re-run on the rebased SHAs (section 4) |
| 5 | User secrets read standalone; the store holds `Auth:SigningKey`, shown by key name | Section 6, after the table |
| 6 | Hand-off: six items of 4.1 plus condition 2; PR body's "Open items" carries `AllowedHosts` and F-1 | Section 10. There is no PR yet (condition 8); the PR body must carry items 1 and 4 under "Open items" |
| 7 | `DigitalHubContent_Test` only; one suite at a time; no `testhost`/`vstest` before each run; Release only | Every run Release; the factories refuse any other catalog; `testhost`/`vstest` count `0` before each database run; suites never overlapped |
| 8 | No push and no PR before gate 2 and the owner | Nothing pushed; no PR |
| 9 | Stop conditions stand; no test adjusted to reach a planned state | No stop condition triggered (no forbidden reference, every build green, every red/green set as planned). The one test change before commit 4 corrected a red-for-the-wrong-reason (section 4) and kept the assertion |

## 10. Hand-off

T-R1 (`PublicRouteTests.Only_the_two_form_routes_are_mapped`) is the public API's role matrix: two
anonymous POST routes, `api/v1/public/contact` and `api/v1/public/apply`, and nothing else.

1. **The public API's own `AllowedHosts`** (the website host in Production). `appsettings.json`
   has `"*"`. For ISO-5 or ISO-6; not decided here. Also for the PR body's "Open items".
2. **`ForwardedHeaders:KnownProxies` for the IIS proxy**, for ISO-5. Empty today, so
   `X-Forwarded-For` is ignored and the contact limit keys on the connection address.
3. **Groups D and F, which ISO-4 deletes on the admin side**: `PublicContactController` and
   `PublicApplyController` in `DigitalHub.Api`, the contact policy and title in its rate limiter,
   the 13 apply tests and their helpers and factories in `CareersTests.cs`, `PublicContactTests.cs`
   (but not the Studio test), the contact tests of `RequestBodyLimitTests.cs` and
   `RateLimitLogTests.cs`. ISO-4 must keep a forwarded-headers test on the admin API if the admin
   keeps its forwarded-headers block, because the admin's `PublicContactTests` that cover it go
   with the form routes.
4. **F-1, proposed change `iso-shared-hosting`**, after ISO-4: move group A, the group C blocks and
   the group E helpers into one place (a library under `ReferenceGuard` for product code, a linked
   `api/tests/Shared/` file for test helpers), then retire or shrink T-D1. A proposal for the
   owner to schedule; no owner words are claimed. Also for the PR body's "Open items".
5. **The one setting ISO-3 changes**: `ConnectionStrings:PublicForms` in `PublicApiFactory`
   (`builder.UseSetting("ConnectionStrings:PublicForms", _connectionString)`), to the
   `dh_public_forms` login. The fixtures in `FormsDatabase` keep the restricted test login.
6. **Step 4e (GAP-20) must cite F-1** and not baseline groups A, C or E silently.
7. **ISO-4 must keep `docs/PROJECT_PROFILE.md` line 21 true** ("every `api/v1` route is in the
   role matrix") once the admin copies of the two routes are gone: today the routes are in the
   admin's matrix (`CareersTests.Authorization_matches_for_every_endpoint`) and in T-R1; after
   ISO-4 only T-R1 names them.

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| `DigitalHub.PublicApi` exists as its own process in `api/src/`, in the solution | Refinement plan line 213; ADR 0001 point 1 | Done | `325ff24`; `api/DigitalHub.slnx`; C1 builds it |
| It maps only `POST /api/v1/public/contact` and `POST /api/v1/public/apply` | Refinement plan line 213; ADR 0001 point 1 | Done | T-R1 green from `30a9018` (red at `19db9b5`, 0 endpoints); C2 |
| A test proves every other path returns 404 | Refinement plan line 213 ("Done when"); README G2 checklist | Done | T-R2: red at `19db9b5` (761) and `30a9018` (764, only G1-G3), green at `0568cbb`; C2 |
| Its own small DbContext maps exactly the four tables | Refinement plan line 213; ADR 0001 points 3-4 | Done | T-I6; T-I7; C7 |
| No Identity | Refinement plan line 213; ADR 0001 point 1 | Done | T-I1; T-G2; C8; C9 |
| No signing key (none configured; start-up refuses `Auth` settings) | Refinement plan line 213; ADR 0001 point 1 | Done | T-I2 on a store holding `Auth:SigningKey` (key-name count 1); T-I3 red at `19db9b5`, green at `30a9018`; T-I5 |
| No authentication, no refresh cookie, no Studio controllers | ADR 0001 point 1 | Done | T-I1 (with its control); no `Set-Cookie` in T-P1, T-P2 and every T-R2 request; T-R1 |
| The forms keep their rate limits, body limits, CV checks and email sending | ADR 0001 point 1 | Done | Ported suites green in C2: 7 contact + empty-proxy, 13 apply, 3 body-limit, rate-limit log, 4 aborted rows, server headers |
| Its own integration suite passes against `DigitalHubContent_Test` | Refinement plan line 213 ("Done when"); ADR 0001 Consequences | Done | C2: 71 of 71, exit 0, after 6a too |
| The suite runs in CI (job `api`, artifact `api-test-report`, `public-api-tests.trx`) | Caller's instruction; G-2 | Done locally; CI evidence pending | C12 (the step); the PR-head `api` job's artifact must hold `public-api-tests.trx` with `failed="0"`, `total="71"` - not run (no push before gate 2) |
| F1-1: the guard covers `Microsoft.AspNetCore.Identity` and `Microsoft.AspNetCore.Authentication*`; base references still pass | ISO-1 `delivery-approval.md` "F1: decision" item 1; owner's request | Done | `917055b`; T-F1 green; `FormsLibraryTests` 3 of 3; T-G3 14 rows; T-G2 Forms row |
| F1-2: a canary proves the guard can fail (committed, and shown once on Forms and PublicApi) | ISO-1 `delivery-approval.md` item 2; owner's request | Done | T-F1 red at `7049d28`; `GuardCanary.cs`; T-G3; T-G1 in section 7 |
| F1-2: the guard applies to `DigitalHub.PublicApi`'s own assembly | ISO-1 `delivery-approval.md` item 2; owner's request | Done | T-G2 PublicApi row; C8; T-G1 on PublicApi |
| F1-3: the plan cites the ruling and test-report F1 | ISO-1 `delivery-approval.md` item 3 | Done | Plan sections 1 and 3.6 |
| Every base integration test (593 on the new base, by name) still passes | README "Never weaken a gate, guard or test"; caller's boundaries | Done | C3 594 of 594; C4 hash `b39d4859...8b95`, `comm` as stated |
| Every base end-to-end test (34, by name) still passes | README G2 checklist; caller's boundaries | NOT RUN locally | C19: harness fails at "Release migrations"; CI job `studio` on the PR head |
| No migration and no model change | `AGENTS.md` Schema | Done | C6, C7; section 12 |
| Boundaries: no `dh_public_forms` (ISO-3); admin keeps `/api/v1/public/*` and `AllowedHosts` (ISO-4); no `web.config` change (ISO-5) | Refinement plan lines 214-216 | Done | C11 empty for `api/src/DigitalHub.Api`; C5 51 of 51 |
| GAP-38, part (own API; own login still to come) | Refinement plan line 114 | Done (part) | This change; GAP-38 stays open for ISO-3 |
| Every commit builds, and the failing set at commits 1, 4 and 5 equals the 3.9 table | P-4, B-6; plan review R1-1 | Done | Section 4 (before and after the rebase) |
| Duplication measured, split permanent/temporary; the six "must not drift" files under T-D1; F-1 recorded | Plan review R1-2; G-9 | Done | Section 3.1; T-D1 6 rows, T-D2, the by-hand failure in section 7; hand-off 4 and 6 |
| The hiring-store column rule reaches `api/src/DigitalHub.PublicApi/Data/` | Plan review R1-4; condition 1 | Done | C14; section 7 |
| P-5 and S-2 "Enforced by" name both APIs | Plan review R1-5 | Done | Commit 7; C11 |
| `AllowedHosts` and the other ISO-3/4/5 items in the hand-off and the PR body's "Open items" | Plan review R1-7; condition 6 | Hand-off done; PR body pending | Section 10; the PR does not exist yet |
| T-R1 is the public API's role matrix; ISO-4 keeps PROFILE line 21 true | Plan review R2-2; condition 2 | Done | Section 10, item 7 |
| Semgrep 0 new | G-10 | Done | C16 after `1193375` |

## 12. Migrations

None. `PublicFormsDbContext` has no migrations (T-I7, C7) and `ContentDbContext` is unchanged (C6).

## 13. For the tester

- The public suite needs the same local setup as the admin suite: the admin API's user-secrets
  store (`ConnectionStrings:Content`, restricted login) or `ConnectionStrings__Content` in the
  environment; `ConnectionStrings__ContentAdmin` or Windows authentication for the one trigger test.
- Run the two suites one after another, never at once (shared `DigitalHubContent_Test`, rate limits).
- CI evidence (C12's step running, C17, C18, C19) exists only once the branch is pushed after
  gate 2 and the owner's confirmation.

Status: READY FOR TEST
