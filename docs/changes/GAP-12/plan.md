# GAP-12: Remove the Server header

Architect, round 1, 2026-11-01. Branch `change/GAP-12`, cut from
`origin/rebuild/dotnet-platform` at `6470fac` ("Careers intake: apply by email,
HR counts, end a vacancy (#33)"), not tracking it.

**The governing documents are not on the base branch.** `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/quality/baseline-2026-10-27.md`, `docs/quality/test-report-2026-10-27.md`,
`docs/quality/admin-audit-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`,
`docs/deferred-items.md`, `docs/changes/README.md`, the updated `AGENTS.md` and
`.github/pull_request_template.md` are missing from `6470fac`. This plan was
written from read-only copies of them supplied with the task, not from the
branch. Quotes below come from those copies. The base branch's own `AGENTS.md`
is older and has no change-pipeline section.

## 1. Item

- **Closes:** GAP-12 (refinement plan, gap register), from finding 9 of the
  27 October test report.
- **Track:** G1, Wave 1 ("make CI honest", 3 to 16 November).
- **Register row:** "GAP-12 | API | Finding 9 | `Server: Kestrel` on every
  response | No server header | Low | Low | Wave 1".
- **Done when** (refinement plan, Wave 1 table): "An integration test asserts no
  `Server` header on API responses".
- **Finding 9** (test report): "Responses carry `Server: Kestrel`. | Probe A2 |
  `options.AddServerHeader = false` on Kestrel; check the IIS header in Phase D".
- **Owner's instruction for this work:** "Start waves 0 & 1 and update me with
  each gap done" (Mohamed Elbadry, 2026-11-01, project thread). No other owner
  decision bears on this item.

## 2. Current state

**The API host.** `api/src/DigitalHub.Api/Program.cs` builds the host with
`WebApplication.CreateBuilder(args)` (line 24) and never configures the server:
there is no `ConfigureKestrel`, `UseKestrel` or `KestrelServerOptions` anywhere
in `api/` (`grep -rn "UseKestrel\|ConfigureKestrel\|AddServerHeader" api` finds
nothing). `appsettings.json` has no `Kestrel` section. So Kestrel runs with its
default `AddServerHeader = true`.

**Headers the API sets.** `Infrastructure/SecurityHeadersMiddleware.cs` adds
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and, when enabled,
HSTS, in `Response.OnStarting`. It does not touch `Server`, and it could not
(see the probe below). The `/media` static-files branch (Program.cs lines
286 to 297) sets its own `nosniff` and CSP.

**Other HTTP hosts in `api/`.** None. `tools/DigitalHub.ContentImport` uses the
Web SDK but its `Program.cs` is a console command (`export`, `import`,
`--convert-references`, `--dry-run`, `--apply`) and opens no listener;
`src/DigitalHub.Images` is a class library; `tools/parity-snapshot.mjs` is a
Node script. The Studio's `studio/public/web.config` already removes
`X-Powered-By` for the static Studio and leaves `/api` to the API application.

**Production hosting.** IIS with the ASP.NET Core Module
(`docs/business-analysis.md`, lines 192 and 522). Under IIS, IIS adds its own
`Server: Microsoft-IIS/10.0` regardless of Kestrel. The finding defers that to
Phase D ("check the IIS header in Phase D"). `docs/security-deployment.md` has
a section for the Studio's headers but none for the API's.

**Why the existing tests cannot see the header.** `api/tests/DigitalHub.Api.Tests/ApiFactory.cs`
derives from `WebApplicationFactory<Program>` and every test uses its in-memory
`TestServer`. TestServer never writes a `Server` header, so a test written the
usual way would pass before the fix and prove nothing. The test must run the
API on real Kestrel. `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 (already
referenced by the test project) has `WebApplicationFactory<T>.UseKestrel(...)`
and `StartServer()` for exactly this. From the package's XML docs:

```
M:Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory`1.UseKestrel(System.Action{...KestrelServerOptions})
  "Configures the factory to use Kestrel as the server."
  "This method should be called before the factory is initialized either via one of the
   CreateClient methods or via the StartServer method."
```

**Evidence, run on 2026-11-01 in a scratch app outside the repository**
(`dotnet new web`, .NET SDK 10.0.114, Release, ports 4291 and 4292). No
repository file, package or database was touched.

1. Kestrel's default, then `builder.WebHost.ConfigureKestrel(o => o.AddServerHeader = false)`.
   The second request in each pair is a malformed request
   (`GET / HTTP/1.1\r\nHost: x\r\nBad Header\r\n\r\n`), which Kestrel answers
   itself before any middleware runs:

   ```
   == NO_SERVER_HEADER=0 GET /
   HTTP/1.1 405 Method Not Allowed
   Server: Kestrel
   == malformed request (Kestrel's own 400)
   HTTP/1.1 400 Bad Request
   Server: Kestrel
   == NO_SERVER_HEADER=1 GET /
   HTTP/1.1 405 Method Not Allowed
   == malformed request (Kestrel's own 400)
   HTTP/1.1 400 Bad Request
   ```

2. Removing the header in middleware (`Response.OnStarting(() => Headers.Remove("Server"))`)
   does not work. Kestrel adds it after `OnStarting`:

   ```
   == middleware strip, GET /
   HTTP/1.1 200 OK
   Server: Kestrel
   == middleware strip, malformed
   HTTP/1.1 400 Bad Request
   Server: Kestrel
   ```

3. A `WebApplicationFactory` test with `UseKestrel(o => o.Listen(IPAddress.Loopback, 0))`,
   `StartServer()` and `CreateClient()` sees the real header. It is red without
   the option and green with it:

   ```
   addr=http://127.0.0.1:45675 base=http://127.0.0.1:45675/ server=KestrelServerImpl status=200 serverHeader=[Kestrel]
     Failed T.NoServer [460 ms]
   addr=http://127.0.0.1:45643 base=http://127.0.0.1:45643/ server=KestrelServerImpl status=200 serverHeader=[]
     Passed T.NoServer [496 ms]
   ```

   `CreateClient()` after `StartServer()` points at the Kestrel address, so the
   client really goes over a socket.

**Test count today:** 297 `[Fact]`/`[Theory]` methods in
`api/tests/DigitalHub.Api.Tests/*.cs` (`grep -c` summed), matching the baseline's
"297 integration test methods".

## 3. Design

**Approach.** Turn the header off where Kestrel writes it, in `Program.cs`,
straight after `WebApplication.CreateBuilder(args)`:

```csharp
// Finding 9 (GAP-12): no server banner. Kestrel writes Server itself, after
// any middleware, so it is turned off here and not removed in a middleware.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);
```

`ConfigureKestrel` only configures Kestrel's options; it does not choose the
server. Under IIS in-process hosting it has no effect and does no harm. IIS's
own header is out of scope (see Scope) and is written down for Phase D in
`docs/security-deployment.md`.

**Test.** A new test class runs the real API (`Program`, with all of
`ApiFactory`'s test settings and the `DigitalHubContent_Test` database) on
Kestrel, on `127.0.0.1` with a port the system picks, and asserts that no
`Server` header comes back on four kinds of response:

- a 200 from the anonymous `/health` endpoint (it checks the database);
- a 401 `application/problem+json` from a protected route, `GET /api/v1/users`,
  as an anonymous caller (the JWT `OnChallenge` handler in Program.cs);
- a 401 from an unknown path, `GET /api/v1/gap-12-no-such-route` (the fallback
  policy; test report probe A5 shows unknown paths answer 401);
- a 400 that Kestrel writes itself for a malformed request sent over a raw
  `TcpClient` (`GET / HTTP/1.1`, `Host`, and a header line with no colon). This
  case is what separates a server-level fix from a middleware one.

A guard in the same class asserts the host is really Kestrel on a loopback
socket: `IServer` is not `TestServer`, and `IServerAddressesFeature.Addresses`
holds one `http://127.0.0.1:<port>` address. Without the guard, a later change
to the factory could make the test pass vacuously on TestServer.

The test's `UseKestrel` callback only calls `Listen(IPAddress.Loopback, 0)`. It
must not set `AddServerHeader`, or the test would hide a missing fix. Port 0
lets the system pick a free port, so the test never collides with another
agent's 41xx/42xx/43xx process or with CI.

**Alternatives rejected.**

| Alternative | Why not |
| --- | --- |
| Remove `Server` in `SecurityHeadersMiddleware` (`OnStarting`) | Does not work: Kestrel writes the header after `OnStarting` (probe 2), and never runs middleware for its own 400s. |
| `"Kestrel": { "AddServerHeader": false }` in `appsettings.json` | Works through the default `Kestrel` configuration binding, but any environment variable or later configuration source can turn it back on, and it is less visible in review. A security default belongs in code (P-5, fail closed). |
| Assert on the existing `TestServer` client | TestServer never sends `Server`, so the test would pass before the fix (P-4 needs a test that fails first). |
| Start the API as a separate process in the test (`dotnet DigitalHub.Api.dll`) | Needs its own configuration plumbing, port handling and process clean-up; `WebApplicationFactory.UseKestrel` gives the same real socket with the existing `ApiFactory` settings. |
| Also remove the header in a middleware as "defence in depth" | It cannot work (above); dead code. |
| Change `ApiFactory` itself to use Kestrel | Would move all 297 tests from TestServer to sockets: a behaviour change for the whole suite, beyond this item (B-8). |

## 4. Scope

Files to create or change:

| File | Change |
| --- | --- |
| `api/tests/DigitalHub.Api.Tests/ServerHeaderTests.cs` | **New.** `[Collection("SqlServer")] public sealed class ServerHeaderTests : IClassFixture<ServerHeaderTests.KestrelFactory>`. Nested `public sealed class KestrelFactory : ApiFactory` whose constructor calls `UseKestrel(o => o.Listen(IPAddress.Loopback, 0))`; the test class calls `StartServer()` and uses `CreateClient()`. Tests listed in section 5. |
| `api/src/DigitalHub.Api/Program.cs` | One statement after line 24: `builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);` with the two-line comment from section 3. |
| `docs/security-deployment.md` | New short section "API: response headers": the API sends no `Server` header (GAP-12, `ServerHeaderTests`); under IIS the dev team removes IIS's own `Server` header for the API site in Phase D (for example `<requestFiltering removeServerHeader="true" />` in the API's `web.config`) and checks it with the Phase D black-box probes. |
| `docs/changes/GAP-12/*` | The pipeline records (`plan.md`, and later the review, approval, implementation and test files). |

Out of scope, deliberately left alone:

- **IIS's own `Server` header.** No IIS configuration exists in the repository
  for the API, and nothing is deployed until Phase D. The finding itself defers
  it ("check the IIS header in Phase D"). Recorded in `docs/security-deployment.md`
  as a deployment setting; proven in Phase D by the black-box HTTP suite (A-14).
- **Other banners** (`X-Powered-By`, `X-AspNet-Version`). Kestrel sends neither;
  probe A2 found "no `X-Powered-By`". Not part of this item.
- **`ApiFactory`, the other 297 tests, and `SecurityHeadersMiddleware`.** Unchanged.
- **`.github/workflows/ci.yml`.** Not touched (PR #38 and GAP-09 own it). The
  new test runs in the existing "Integration tests (Release)" step of the `api`
  job without any workflow change, because it is in the same test project and
  uses the same `ConnectionStrings__Content` variable.
- **The website and the Studio.** Static builds; not API responses.
- No new package: `UseKestrel`/`StartServer` are in the already referenced
  `Microsoft.AspNetCore.Mvc.Testing` 10.0.12.

One topic, one small pull request (B-8). No split needed.

## 5. Test plan

### Failing tests first (B-6, P-4)

The test file is committed on its own first, then run against the unchanged
`Program.cs`, and the red output is quoted in `implementation.md`. Then the fix
is committed.

File `api/tests/DigitalHub.Api.Tests/ServerHeaderTests.cs`:

| Test | Asserts | Before the fix | After |
| --- | --- | --- | --- |
| `The_host_under_test_is_Kestrel_on_a_loopback_socket` | `IServer` from `factory.Services` is not `Microsoft.AspNetCore.TestHost.TestServer`; `IServerAddressesFeature.Addresses` has exactly one entry and it starts with `http://127.0.0.1:` | Pass (guard) | Pass |
| `No_server_header_on_a_success` | `GET /health` answers 200 and `response.Headers.Server` is empty and `response.Headers.Contains("Server")` is false | **Fail**: `Server: Kestrel` | Pass |
| `No_server_header_on_a_problem_response` (`[Theory]`: `/api/v1/users`, `/api/v1/gap-12-no-such-route`) | Anonymous `GET` answers 401 with `application/problem+json`; no `Server` header | **Fail** (both rows) | Pass |
| `No_server_header_when_Kestrel_rejects_a_malformed_request` | Over a raw `TcpClient` to the bound address, the request `GET / HTTP/1.1\r\nHost: localhost\r\nBad Header\r\n\r\n` gets a status line `HTTP/1.1 400`, and no header line in the response head starts with `Server:` (case-insensitive) | **Fail** | Pass |

The red run must show the three failing tests failing on the `Server` assertion
(not on a connection, database or status-code error), and the guard passing.

### Commands (Release, as `AGENTS.md` requires)

Database: `DigitalHubContent_Test` only, through the restricted login, set the
way the `api` job in `.github/workflows/ci.yml` sets it (create the database and
`dh_content_app` login only if they do not exist; never drop a database this
change did not create; never write to `DigitalHubContent`):

```bash
cd api
export ConnectionStrings__Content='Server=localhost,1433;Database=DigitalHubContent;User ID=dh_content_app;Password=CiOnlyApp2026Passw0rd;Encrypt=True;TrustServerCertificate=True'
export ConnectionStrings__ContentAdmin='Server=localhost,1433;Database=DigitalHubContent;User ID=sa;Password=CiOnlySa2026Passw0rd;Encrypt=True;TrustServerCertificate=True'
dotnet tool restore
dotnet build DigitalHub.slnx -c Release

# Red (test committed, fix not yet):
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"

# Green (after the fix, rebuild first):
dotnet build DigitalHub.slnx -c Release
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"

# Full suite, no regressions (297 existing methods plus the new ones):
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --logger "trx;LogFileName=api-tests.trx" --logger "console;verbosity=normal"
```

Each is quoted with its exit code and the summary line (`Passed!`/`Failed!`,
counts). The full-suite count after the change must equal the count before plus
the new test cases, with 0 failed.

Live check of the real API (optional but recommended, port 42xx, process
started and stopped by the developer):
`curl -sI http://127.0.0.1:4288/health` against
`dotnet api/src/DigitalHub.Api/bin/Release/net10.0/DigitalHub.Api.dll` with
`ASPNETCORE_URLS=http://127.0.0.1:4288` and the test configuration pointed at
`DigitalHubContent_Test`; the output has no `Server:` line. If not run, write
NOT RUN with the reason; the integration test covers it.

CI: the `api` job ("API — Release build, migrations, integration tests") runs
the new tests unchanged. Its run id goes in the test report.

### Track checklist (G1, Waves 1 to 3)

| Check | Applies here? |
| --- | --- |
| One gate per pull request (B-8) | Yes: one fix and its test, one topic. |
| A new gate reports for seven days through a `*_BLOCKING_FROM` date, then blocks; a gate that replaces existing protection blocks at once | No new gate is added. The regression test runs in the existing blocking `api` job and blocks at once, which is right for a test, not a gate. |
| Every gate has a committed canary fixture it must reject (GAP-21) | No gate. The test's own canary is the red run before the fix, quoted in `implementation.md`; the Kestrel guard test stops it passing vacuously on TestServer. |
| Actions pinned by SHA, SQL Server image by digest, Node and .NET exact | Not touched by this change (`ci.yml` out of scope; GAP-09/GAP-10 own it). |
| Baselines only shrink | No baseline file is touched. Finding 9 is closed, not baselined. |

## 6. Security impact

- **Routes and policies:** none changed. The test only reads `/health`, one
  protected route and one unknown path as an anonymous caller.
- **Data:** none. The test reads `/health` (a database ping) and writes nothing
  of its own; the factory's existing `IdentitySeeder` behaves as for every other
  test class, against `DigitalHubContent_Test`.
- **Logins and secrets:** none. The test uses `ApiFactory`'s test-only values
  and the CI connection variables; nothing new is printed or committed.
- **Dependencies:** none added.
- **Effect:** removes a server-software banner (information disclosure, Low).
  Behind IIS the banner is IIS's until Phase D removes it; recorded in
  `docs/security-deployment.md`.
- **Network in tests:** the test listens on `127.0.0.1` only, on a system-chosen
  port, for the lifetime of the test class.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. No schema, data or configuration to restore.

## 9. Owner decisions needed

None. The item, its fix and its "Done when" are in the refinement plan the owner
approved; the IIS header is already deferred to Phase D by the finding itself.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| The test passes vacuously on TestServer (for example if a later factory change drops `UseKestrel`) | Guard test `The_host_under_test_is_Kestrel_on_a_loopback_socket`; the quoted red run. |
| The test's `UseKestrel` callback sets `AddServerHeader` and hides a missing fix | Plan forbids it; the red run proves the test sees the header without the fix; review of the test file. |
| A second `WebApplicationFactory` host on a real socket collides with the shared `ApiFactory` or another agent's port | Port 0 on loopback; `[Collection("SqlServer")]` keeps it serial with the other database tests. |
| The raw-socket test hangs if Kestrel keeps the connection open | Read with a timeout (for example `CancellationTokenSource(TimeSpan.FromSeconds(10))`) and stop at the blank line ending the response head; Kestrel closes the connection after a 400. |
| The extra host seeds or locks the test database differently | It is the same `ApiFactory` configuration other subclasses (`RateLimited`, `PublicContactFactory`, ...) already use; the full-suite run shows no regressions. |
| IIS still shows `Server: Microsoft-IIS/10.0` in production | Out of scope here; written as a Phase D deployment setting in `docs/security-deployment.md` and to be probed by the Phase D black-box suite (A-14). |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Kestrel sends no `Server` header (`AddServerHeader = false` in `Program.cs`) | GAP-12; finding 9 | Planned | |
| An integration test asserts no `Server` header on API responses (200, 401 problem, unknown path, Kestrel's own 400) | Refinement plan, Wave 1, "Done when" | Planned | |
| The test fails before the fix, on the `Server` assertion | P-4, B-6; `docs/changes/README.md` | Planned | |
| The test runs on real Kestrel, not TestServer (guard) | This plan, section 3 | Planned | |
| Full API integration suite passes in Release with no regressions | G-2; `AGENTS.md` | Planned | |
| IIS `Server` header recorded as a Phase D deployment setting | Finding 9 ("check the IIS header in Phase D") | Planned | |
| `ci.yml` untouched; the `api` job runs the new test green | Task constraint; G-2 | Planned | |

## 12. Revision log

- Round 1 (2026-11-01): first version. No review yet.
