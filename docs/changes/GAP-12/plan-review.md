# GAP-12: plan review

## Round 1

Plan-reviewer, 2026-11-01, reviewing `docs/changes/GAP-12/plan.md` round 1 on
branch `change/GAP-12` at `6470fac`. Governing documents read from the
read-only reference copies supplied with the task (they are not on the base
branch, as the plan says).

### Findings

No Blockers. No Majors.

1. **Minor, section 5 (live check).** The optional live check runs
   `DigitalHub.Api.dll` "with the test configuration pointed at
   `DigitalHubContent_Test`" but does not say how. `Program.cs` throws without
   `ConnectionStrings:Content` and needs `Auth:SigningKey` and the other `Auth:*`
   values that `ApiFactory` supplies through `UseSetting`. As written the
   developer has to invent the configuration, and could point it at
   `DigitalHubContent` by copying the CI variables above it (those name
   `DigitalHubContent`; only the test factory rewrites them to `_Test`).
   *Satisfied by:* the developer either lists the exact environment variables
   (with `Database=DigitalHubContent_Test` and test-only `Auth__*` values, no
   real secrets) in `implementation.md`, or records the check as NOT RUN with the
   reason. The integration test is the acceptance evidence either way.

2. **Minor, section 4 (test class shape).** The plan says "the test class calls
   `StartServer()`" without saying where. `StartServer()` must run before the
   guard reads `IServerAddressesFeature` and before the raw `TcpClient` test
   reads the bound address, and xUnit gives no test order. *Satisfied by:*
   calling `StartServer()` in the test class constructor (or the fixture's), so
   every test, including the guard, sees a started Kestrel host whatever order
   they run in.

3. **Minor, section 5 (raw-socket test).** The table says the guard "Pass
   (guard)" before the fix, which is right, but the red run must also show the
   raw-socket test failing on the `Server:` assertion and not on a timeout.
   The risk table already calls for a 10-second read timeout; the
   implementation should quote that test's failure message in the red run so a
   timeout cannot be mistaken for the expected red.

### Checked and found sound

- **Fit.** Register row (refinement plan line 76) and the Wave 1 "Done when"
  (line 161, "An integration test asserts no `Server` header on API responses")
  are quoted word for word. Finding 9's text matches test report line 31.
- **Current state.** `grep -rn "UseKestrel\|ConfigureKestrel\|AddServerHeader" api`
  returns nothing (exit 1). `Program.cs` line 24 is
  `var builder = WebApplication.CreateBuilder(args);`. `ApiFactory` derives from
  `WebApplicationFactory<Program>` and uses TestServer, so a conventional test
  could not see the header; the plan's reasoning for a Kestrel-hosted test holds.
- **API surface used by the test.** `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 is
  referenced in the test csproj (line 15), and the 10.0.12 package's XML docs
  list `UseKestrel()`, `UseKestrel(Int32)`,
  `UseKestrel(Action<KestrelServerOptions>)` and `StartServer()`. No new package.
- **Routes chosen for the test.** `/health` is mapped `.AllowAnonymous()`
  (Program.cs 303 to 323); `api/v1/users` exists (`AdminControllers.cs` line 75);
  the fallback policy requires an authenticated user (line 246) and the JWT
  `OnChallenge` handler writes a 401 problem response (line 230), so both 401
  rows are reachable anonymously.
- **Database.** `ApiFactory` rewrites the CI connection strings to
  `DigitalHubContent_Test` (ci.yml line 57 comment; `ToTestCatalog`), so the
  commands' `Database=DigitalHubContent` values match CI and the tests never
  touch `DigitalHubContent`.
- **Test count.** `grep -ho "\[Fact\]\|\[Theory\]" api/tests/DigitalHub.Api.Tests/*.cs | wc -l`
  gives 297, as the plan says. `[CollectionDefinition("SqlServer", DisableParallelization = true)]`
  exists in `ApiFactory.cs`.
- **Architecture.** The fix sits where the header is written (Kestrel options),
  which is the only place that also covers Kestrel's own 400s; the rejected
  alternatives (middleware strip, appsettings, TestServer assertion, separate
  process, changing `ApiFactory`) are real and correctly reasoned. No layering
  change (A-11, S-1, A-12 not engaged).
- **Scope (B-8).** One topic, three files plus the records. `docs/security-deployment.md`
  exists and has no API headers section, so the new section is additive.
  The other open changes (GAP-06, GAP-08, GAP-11) have no edits on their
  worktrees yet and their register rows do not touch `Program.cs`, `ApiFactory`
  or `docs/security-deployment.md`. `ci.yml` is left alone.
- **Testability (P-4, B-6, S-3).** Red test committed before the fix, named
  precisely, and shown to go red without the option by the plan's scratch probe.
  The guard against a vacuous TestServer pass is a good addition. No route is
  involved, so S-3's role-matrix clause does not apply. Commands run in Release.
- **Quality gates (P-6).** No gate, guard, baseline or test is weakened; no new
  gate, so no `*_BLOCKING_FROM` date or canary is required.
- **Security.** No route, policy, secret, dependency or migration changes. Test
  listens on loopback, port 0, so no clash with 42xx or other agents.
- **Owner decisions.** None needed: the item and its "Done when" are in the
  approved plan; IIS's own header is deferred to Phase D by finding 9 itself.
  The owner's quote and date are given exactly.
- **Rollback and risks** are specific to this change and each has a check.

Verdict: APPROVED
