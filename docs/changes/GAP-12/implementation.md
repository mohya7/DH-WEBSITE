# GAP-12: implementation

Developer, round 1, 2026-11-01. Branch `change/GAP-12` (worktree
`/home/user/wt-GAP-12`), from the plan commit `f531f0c`. `plan-approval.md` ends
`Verdict: APPROVED`. Not pushed; no pull request (approval condition 8).

## What changed

| File | Plan scope row | Change |
| --- | --- | --- |
| `api/tests/DigitalHub.Api.Tests/ServerHeaderTests.cs` | New test class | `[Collection("SqlServer")] public sealed class ServerHeaderTests : IClassFixture<ServerHeaderTests.KestrelFactory>`. Nested `KestrelFactory : ApiFactory` whose constructor only calls `UseKestrel(options => options.Listen(IPAddress.Loopback, 0))`; it never touches `AddServerHeader` (condition 2). The test class constructor calls `StartServer()` then `CreateClient()` (condition 3). Five cases: the Kestrel guard, `/health` 200, the `[Theory]` with `/api/v1/users` and `/api/v1/gap-12-no-such-route` (anonymous 401, `application/problem+json`), and the raw `TcpClient` malformed request (Kestrel's own 400), read with a 10-second `CancellationTokenSource` up to the blank line ending the response head (condition 4). |
| `api/src/DigitalHub.Api/Program.cs` | One statement after line 24 | `builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);` with the two-line comment from plan section 3. |
| `docs/security-deployment.md` | New section "API: response headers" | The API sends no `Server` header (GAP-12, `ServerHeaderTests`); Phase D removes IIS's own `Server` header for the API site (for example `<requestFiltering removeServerHeader="true" />`) and checks it with the black-box probes. Placed before "Studio: headers and routing". |
| `docs/changes/GAP-12/implementation.md` | Pipeline records | This file. |

Not touched (condition 7): `ApiFactory`, `SecurityHeadersMiddleware`, every
other test, `.github/workflows/ci.yml`, packages and lockfiles.

## Commits

| SHA | Subject |
| --- | --- |
| `a37d618` | GAP-12: Add failing test for the Server header (test file alone, B-6) |
| `ff00c76` | GAP-12: Turn off Kestrel's Server header (`Program.cs`, `docs/security-deployment.md`) |
| this commit | GAP-12: Record implementation |

## Test database setup

`DigitalHubContent_Test` and the `dh_content_app` login did not exist on the
shared SQL Server (`sys.databases` listed only system databases and `GAP06_*`
scratch databases; no `dh_content_app` principal; no user sessions). Created
the way the `api` job in `ci.yml` does, with only the job's steps, guarded with
`IF ... IS NULL` so a concurrent agent's copy is never replaced. Nothing was
dropped, and `DigitalHubContent` was not created or touched (the CI job does not
create it either; the connection strings name it and `ApiFactory.ToTestCatalog`
rewrites them to `DigitalHubContent_Test`).

```
sqlcmd -S localhost -U sa -C -b -Q "
IF DB_ID('DigitalHubContent_Test') IS NULL CREATE DATABASE [DigitalHubContent_Test];
IF SUSER_ID('dh_content_app') IS NULL CREATE LOGIN [dh_content_app] WITH PASSWORD = N'<ci.yml APP_PASSWORD>', CHECK_POLICY = OFF;"
exit 0  (DigitalHubContent_Test, create_date 2026-11-01 15:34:40.130)

dotnet tool run dotnet-ef -- database update --no-build --configuration Release \
  --project src/DigitalHub.Api/DigitalHub.Api.csproj \
  --connection "Server=localhost,1433;Database=DigitalHubContent_Test;User ID=sa;...;Encrypt=True;TrustServerCertificate=True"
...
Applying migration '20261020113912_AddApplicationCounts'.
Done.
exit 0

sqlcmd ... -d DigitalHubContent_Test -Q "
IF USER_ID('dh_content_app') IS NULL CREATE USER [dh_content_app] FOR LOGIN [dh_content_app];
ALTER ROLE db_datareader ADD MEMBER [dh_content_app];
ALTER ROLE db_datawriter ADD MEMBER [dh_content_app];
DENY UPDATE, DELETE ON dbo.audit_log TO [dh_content_app];"
exit 0
```

These are the existing migrations on the base branch, applied with the
elevated account to `DigitalHubContent_Test` only. This change adds no
migration.

## Commands run

Environment for every `dotnet test` below, as the `ci.yml` `api` job sets it
(workflow-only credentials):

```
ConnectionStrings__Content=Server=localhost,1433;Database=DigitalHubContent;User ID=dh_content_app;Password=CiOnlyApp2026Passw0rd;Encrypt=True;TrustServerCertificate=True
ConnectionStrings__ContentAdmin=Server=localhost,1433;Database=DigitalHubContent;User ID=sa;Password=CiOnlySa2026Passw0rd;Encrypt=True;TrustServerCertificate=True
```

1. `dotnet tool restore` (in `api/`): exit 0, "Restore was successful."
2. `dotnet build DigitalHub.slnx -c Release` with the test file and the
   unchanged `Program.cs`: exit 0, "13 Warning(s) 0 Error(s)". None of the
   warnings is in `ServerHeaderTests.cs` (they are existing ones, for example
   `ContentWriter.cs(689,43): warning CS8604` in the importer).

### Red run (test committed at `a37d618`, fix not yet applied)

```
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"
exit 1

  Passed DigitalHub.Api.Tests.ServerHeaderTests.The_host_under_test_is_Kestrel_on_a_loopback_socket [7 ms]
  Failed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_success [4 s]
  Error Message:
   Unexpected Server header: Kestrel
     at DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_success() in .../ServerHeaderTests.cs:line 49
  Failed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request [20 ms]
  Error Message:
   Assert.DoesNotContain() Failure: Filter matched in collection
Collection: ["HTTP/1.1 400 Bad Request", "Content-Length: 0", "Connection: close", "Date: Sun, 01 Nov 2026 15:35:15 GMT", "Server: Kestrel"]
     at DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request() in .../ServerHeaderTests.cs:line 86
  Failed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_problem_response(path: "/api/v1/gap-12-no-such-route") [63 ms]
  Error Message:
   Unexpected Server header: Kestrel
     at ...No_server_header_on_a_problem_response(String path) in .../ServerHeaderTests.cs:line 62
  Failed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_problem_response(path: "/api/v1/users") [16 ms]
  Error Message:
   Unexpected Server header: Kestrel
     at ...No_server_header_on_a_problem_response(String path) in .../ServerHeaderTests.cs:line 62
Test Run Failed.
Total tests: 5
     Passed: 1
     Failed: 4
```

Every failure is on the `Server` assertion (lines 49, 62 and 86), after the
status-code assertions passed: the 200, both 401 problem responses and the
`HTTP/1.1 400 Bad Request` status line were all received. The raw-socket test
failed in 20 ms on `"Server: Kestrel"` in the response head, not on its
10-second timeout (condition 4). The guard passed (condition 1).

### Green run (after `ff00c76`, rebuilt first)

```
dotnet build DigitalHub.slnx -c Release
exit 0, "13 Warning(s) 0 Error(s)"

dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"
exit 0
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_success [5 s]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.The_host_under_test_is_Kestrel_on_a_loopback_socket [4 ms]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request [17 ms]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_problem_response(path: "/api/v1/gap-12-no-such-route") [50 ms]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_problem_response(path: "/api/v1/users") [23 ms]
Test Run Successful.
Total tests: 5
     Passed: 5
```

### Full API suite (Release, condition 6)

```
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --logger "trx;LogFileName=api-tests.trx" --logger "console;verbosity=normal" --results-directory <scratch>
exit 0
Test Run Successful.
Total tests: 480
     Passed: 480
 Total time: 2.1155 Minutes
```

Counts: `grep -ho "\[Fact\]\|\[Theory\]" api/tests/DigitalHub.Api.Tests/*.cs | wc -l`
gives 301 methods, the plan's 297 plus the 4 new ones.
`dotnet test ... --list-tests` lists 480 cases (theories expanded), which is the
475 existing cases plus the 5 new ones. 0 failed, 0 skipped.

### Live check (optional, condition 5)

Run against the built `DigitalHub.Api.dll` on `127.0.0.1:4288`, a process I
started with `nohup` and stopped with `kill <its PID>` afterwards. Exact
environment (`env -i`, so nothing else leaked in); all values are test-only,
the same ones `ApiFactory` uses, and no real secret:

```
ASPNETCORE_ENVIRONMENT=Testing
ASPNETCORE_URLS=http://127.0.0.1:4288
ConnectionStrings__Content=Server=localhost,1433;Database=DigitalHubContent_Test;User ID=dh_content_app;Password=CiOnlyApp2026Passw0rd;Encrypt=True;TrustServerCertificate=True
Auth__SigningKey=test-signing-key-do-not-use-outside-tests-0123456789
Auth__Issuer=digitalhub
Auth__Audience=digitalhub-api
Auth__InitialAdminEmail=admin@digitalhub.test
Auth__InitialAdminPassword=Test-Only-Passw0rd!
Database__EnsureCreated=false
Media__Root=<scratchpad>/gap12-media
Build__Token=test-only-build-token-0123456789abcdef
```

```
== curl -sI http://127.0.0.1:4288/health
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 01 Nov 2026 15:39:04 GMT
Cache-Control: no-store, no-cache
Expires: Thu, 01 Jan 1970 00:00:00 GMT
Pragma: no-cache
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
X-Correlation-ID: 06f618be3d924dfe90ae0dd41b9e1e31

== curl -sI http://127.0.0.1:4288/api/v1/users
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json
Date: Sun, 01 Nov 2026 15:39:04 GMT
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
X-Correlation-ID: 97f0269d438a49fcbbd7ccfdf4bb0d44

== raw socket: GET / HTTP/1.1, Host: localhost, "Bad Header"
HTTP/1.1 400 Bad Request
Content-Length: 0
Connection: close
Date: Sun, 01 Nov 2026 15:39:04 GMT
```

No `Server:` line on any of the three. Log tail: "HTTP HEAD /health responded
200", "HTTP HEAD /api/v1/users responded 401", "Application is shutting down...".

### Not run

- **CI `api` job:** NOT RUN here; the change is not pushed (condition 8). The
  new tests run in its existing "Integration tests (Release)" step unchanged.
  Its run id goes in the test report once the owner allows a push.
- **Website / Studio builds, Vitest, Playwright:** NOT RUN; the plan's test
  plan does not list them and the change touches neither (static builds, not
  API responses). Covered by the `website` and `studio` CI jobs.

## Migrations

None in this change.

## Track checklist (G1, Waves 1 to 3)

| Check | Result |
| --- | --- |
| One gate per pull request (B-8) | One fix and its test; one topic. |
| New gate `*_BLOCKING_FROM` / canary (GAP-21) | No gate added. The test's canary is the red run above; the Kestrel guard stops a vacuous TestServer pass. |
| Actions by SHA, SQL image by digest, Node/.NET exact | Not touched (`ci.yml` unchanged). |
| Baselines only shrink | No baseline file touched. |

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Kestrel sends no `Server` header (`AddServerHeader = false` in `Program.cs`) | GAP-12; finding 9 | Done | `ff00c76`; green run 5/5; live check shows no `Server:` on 200, 401 and Kestrel's 400 |
| An integration test asserts no `Server` header on API responses (200, 401 problem, unknown path, Kestrel's own 400) | Refinement plan, Wave 1, "Done when" | Done | `ServerHeaderTests.cs` (`a37d618`), 5 cases |
| The test fails before the fix, on the `Server` assertion | P-4, B-6; `docs/changes/README.md` | Done | Red run: 4 failed on lines 49/62/86 with "Unexpected Server header: Kestrel" and the `"Server: Kestrel"` head line; guard passed |
| The test runs on real Kestrel, not TestServer (guard) | Plan section 3 | Done | `The_host_under_test_is_Kestrel_on_a_loopback_socket` passed in red and green runs |
| Full API integration suite passes in Release with no regressions | G-2; `AGENTS.md` | Done | 480/480 passed, exit 0 (475 existing cases + 5 new) |
| IIS `Server` header recorded as a Phase D deployment setting | Finding 9 | Done | `docs/security-deployment.md`, "API: response headers" (`ff00c76`) |
| `ci.yml` untouched; the `api` job runs the new test green | Task constraint; G-2 | Partly: `ci.yml` untouched (`git diff f531f0c -- .github` empty); CI run NOT RUN (not pushed) | Tester / CI run id after an owner-approved push |

Status: READY FOR TEST
