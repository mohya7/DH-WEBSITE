# Plan: dataprotection-first-run — keep Data Protection's first-key warning out of the test host

Change id: `dataprotection-first-run`. Branch: `change/dataprotection-first-run`,
**stacked on PR #46**: its base is `origin/change/aborted-request-log-race` at
`2dbea44` (PR #46's head), which sits on `origin/rebuild/dotnet-platform` at
`78ee598`. Revision 2.

**Merge order (blocking precondition, not advice).** This change must not merge
into `rebuild/dotnet-platform` before PR #46. Its pull request targets
`rebuild/dotnet-platform` and says so in its first line. If PR #46 merges first,
this branch is rebased onto the new `rebuild/dotnet-platform` (B-3) and its CI
re-run before merge; its diff then shrinks to this change alone. If PR #46 is
closed without merging, this change goes back to step 1 (it cannot merge alone,
see 2.6).

## 1. Item

- **Closes:** follow-up **FU-1** from `docs/changes/aborted-request-log-race/delivery-approval.md`
  (PR #46), which is tester finding **F-1** in that change's `test-report.md`.
- **Owner's words:** "PUSH and continue" (Mohamed Elbadry, 9 November 2026,
  project thread), given after he was told of FU-1 and FU-2.
- **Track:** no refinement-plan or audit id. `docs/quality/refinement-plan-2026-10-28.md`
  has no entry for Data Protection or for this test (searched for
  "dataprotection", "data protection", "AbortedRequest", "fresh profile": no
  hits). It is test-infrastructure work, so the nearest track checklist is
  **G1, Waves 1 to 3** (tests and API); section 5 applies the parts of it that
  fit.
- **"Done when"**, quoted from F-1 (there is no refinement-plan text to quote):
  > *Steps.* At `78ee598` or at the head, on Linux, set `HOME` to an empty
  > folder. Then run `dotnet test … -c Release --no-build --filter "FullyQualifiedName~AbortedRequestTests"`.
  > *Expected.* All rows pass.

  And, from FU-1, the fix must not weaken the warning assertions (P-6), and
  should not touch `AbortedRequestTests.cs`, which PR #46 is changing.

## 2. Current state

### 2.1 Reproduced here, at base `78ee598`, with a fresh `HOME`

The base tree was exported with `git archive 78ee598 api` into a scratch copy
(nothing in the worktree was built or changed), built with the scratchpad SDK
10.0.114 (ASP.NET Core shared framework 10.0.14), and run twice with the same
new, empty `HOME`:

```
HOME=<new empty dir> ConnectionStrings__Content="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True" \
  dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "FullyQualifiedName~AbortedRequestTests" --logger "console;verbosity=normal"
```

Run 1 (empty profile), exit 1:

```
[2026-11-09T09:13:38.0920282+00:00 WRN]  No XML encryptor configured. Key {d288cf26-26a0-48ff-bd24-0dc59c648175} may be persisted to storage in unencrypted form.
  Failed DigitalHub.Api.Tests.AbortedRequestTests.A_client_that_disconnects_mid_body_is_not_a_server_error(path: "/api/v1/public/contact") [2 s]
   Assert.Empty() Failure: Collection was not empty
Collection: ["Warning: No XML encryptor configured. Key {d288cf2"···]
Total tests: 4
     Passed: 3
     Failed: 1
profile: <HOME>/.aspnet/DataProtection-Keys/key-d288cf26-26a0-48ff-bd24-0dc59c648175.xml
```

That is the only line at Warning or above in the whole log (`grep "WRN\|ERR\|FTL"`
finds line 10 only). Run 2 (same `HOME`, key now on disk), exit 0:
`Total tests: 4, Passed: 4`, 0 `WRN` lines. The tester saw the same at base
(3/4) and at PR #46's head (5/6), `test-report.md` check 7.

The exact warning, as rendered by the sink and the console:

> `No XML encryptor configured. Key {<guid>} may be persisted to storage in unencrypted form.`

It is logged before `Application started`, so it comes from host start-up (the
Data Protection hosted service loads the key ring and, finding none, creates a
key), not from the request under test. CI log `129072328525`, lines 413-414:

```
[2026-11-09T09:09:41.8147891+00:00 WRN]  No XML encryptor configured. Key {124be4ee-…} may be persisted to storage in unencrypted form.
[2026-11-09T09:09:41.8582580+00:00 INF]  Application started. Press Ctrl+C to shut down.
```

### 2.2 How the API gets Data Protection

The API never configures Data Protection itself:
`grep -rn -i dataprotection api/src` (all `.cs`, `.json`, `.csproj`) finds
nothing. It arrives with `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)`
(`api/src/DigitalHub.Api/Program.cs:210`), which registers Data Protection with
its defaults. With the defaults on Linux the key ring is
`$HOME/.aspnet/DataProtection-Keys` (run 1 above shows the file it wrote) and
there is no XML encryptor, so every new key logs the warning. On Windows the
defaults use `%LOCALAPPDATA%\ASP.NET\DataProtection-Keys` with DPAPI, so the
owner's machine does not see the warning (F-1, "Why it matters").

Nothing in the API consumes Data Protection: authentication is JWT bearer only
and `AddIdentityCore` has no `AddDefaultTokenProviders`. Evidence, re-run on
round 2 (corrected from revision 1, which misquoted this, m-1):

```
$ grep -rn "Protect\|TokenProvider\|IDataProtection\|GeneratePasswordResetToken\|Antiforgery" api/src api/tests
(no output)
exit=1

$ grep -rn --include=*.cs "DataProtection\|IDataProtect\|AddDefaultTokenProviders\|AddAntiforgery\|AddCookie(\|RemovePasswordAsync\|AddPasswordAsync" api/src api/tests
api/src/DigitalHub.Api/Content/AdminStore.cs:382:        var removed = await users.RemovePasswordAsync(user);
api/src/DigitalHub.Api/Content/AdminStore.cs:385:        var added = await users.AddPasswordAsync(user, temporary);
```

So no Data Protection API, token provider, antiforgery or cookie scheme exists
in either tree. The only nearby code, `AdminStore.ResetPasswordAsync`, sets a
temporary password with `RemovePasswordAsync` and `AddPasswordAsync` and uses
no token. (The plan reviewer also found that refresh and CSRF tokens are
`RandomNumberGenerator` secrets stored as SHA-256 hashes, `TokenService.cs:170-172,280`.)

Serilog: `Program.cs:26-32` uses `ReadFrom.Services(services)`, so any
`ILogEventSink` in the container receives every event at or above the
configured level. `appsettings.json` overrides `Microsoft.AspNetCore` to
`Warning`, so the Data Protection warning passes.

### 2.3 How the test host is built

`api/tests/DigitalHub.Api.Tests/ApiFactory.cs`: `ApiFactory : WebApplicationFactory<Program>`;
`ConfigureWebHost` (lines 38-62) sets the Testing settings and has one
`ConfigureTestServices` block (lines 57-61) adding `NoteStore` and the
convention-probe controller. Data Protection is not touched.

Subclasses, all of which call `base.ConfigureWebHost(builder)`:
`ApiFactory.RateLimited` (ApiFactory.cs:68), `AbortedRequestTests.LoggingFactory`
(:133, adds the sink at :140), `RateLimitLogTests.LoggingFactory` (:85),
`RecordingApplyFactory`, `ApplyLimitedFactory`, `SilentSmtpFactory` and two
more in `CareersTests.cs` (:724-776), `CommonPasswordTests.CommonAdminFactory`
(:154), `LoginTimingTests.CountingFactory` (:78), `PublicContactFactory` (:214),
`PublicContactNoProxyFactory` (:283), `SessionLimitTests.ClockedFactory` and
`ShortFactory` (:42, :56). `MissingPasswordFactory` (`AuthTests.cs:297`) derives
from `WebApplicationFactory<Program>` directly; its host fails at start-up on the
missing password (`Program.cs:46-49`), before Data Protection runs.

### 2.4 Other tests that assert on warnings

- `AbortedRequestTests.cs:38` and `:60` at base, `:45` and `:72` on this
  branch's base `2dbea44` (PR #46 adds a `WaitForAsync` before each, at `:42`
  and `:71`): `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))`.
  The only assertions that the first-key warning can fail.
- `RateLimitLogTests.cs:113`: `Warnings()` keeps only Warning events whose text
  contains `"Rate limit"`, then `Assert.Single`. The Data Protection warning
  never matches, so this test is not affected either way.
- `AdminApiTests.cs:410-418`: its own `LoggerConfiguration` with a local sink,
  no host. Not affected.

No other test has an `ILogEventSink` or a `LogEventLevel` assertion
(`grep -rn "ILogEventSink\|LogEventLevel" api/tests`).

### 2.5 Why CI has not failed on it

CI runners do start with a fresh profile, and CI does log the warning: once in
every API job. AbortedRequestTests was added in `3926080` (20 October 2026).
Every CI API job since then was listed with
`gh api repos/{owner}/{repo}/actions/workflows/371934219/runs` (both pages, 124
runs) and `…/runs/<id>/jobs?filter=all` (all attempts), and each job log was
fetched with `gh api repos/{owner}/{repo}/actions/jobs/<id>/logs`:

| Measure | Result |
|---|---|
| API jobs since 2026-10-20 | 27: 26 success, 1 failure |
| Jobs whose log has the warning | 27 of 27, exactly once each |
| Line of the warning / first AbortedRequestTests line | 396-447 / 2920-3110 in every job |
| Jobs with `Collection: […No XML encryptor…]` in an assertion | 0 |
| The one failure, job `126362926149` | `AbortedRequestTests.cs(61,0)`, `responded 400` not found: the log race PR #46 fixes, not this warning |

So in CI the key is made by whichever host starts first, about 2 s into the run
(in job `129072328525` the next result is `SettingsVersionTests.The_first_save_names_version_0_and_anything_else_conflicts`),
a minute before AbortedRequestTests runs. CI passes because of test order. It
would fail if AbortedRequestTests' host were ever the first to start: a filtered
run, a change in xUnit's collection order, or a new test collection. The same
hidden dependency exists on a long-lived Linux profile when the key nears its
90-day expiry and a new one is made. Earlier failed API jobs (`110277447585`,
`110289970534`, `110291040875`, 1 October) predate the test and fail on other
tests.

### 2.6 Feasibility spike (scratch copy only, not the worktree)

To choose between options with evidence, candidate fixes were tried in scratch
copies of base and of PR #46's head (`2dbea44`), never in `/home/user/dh-change-dp`.
Every run used a new empty `HOME`; "profile" is the number of files written
under it.

| Variant in `ApiFactory.ConfigureTestServices` | New test (3.3) | Warnings | Profile |
|---|---|---|---|
| None (base) | Fails: `["Warning: No XML encryptor configured. Key {a8f199e"···, "Warning: …{e6e4d38"···]` | 2 | 2 |
| None, profile already has a key | Fails: `["Warning: No XML encryptor configured. Key {22b3013"···]` | 1 | — |
| `AddDataProtection().UseEphemeralDataProtectionProvider()` | Fails, same two warnings | 2 | 2 |
| `KeyManagementOptions.XmlRepository` = in-memory, no encryptor | Fails, same two warnings | 2 | 0 |
| `PersistKeysToFileSystem(<per-run temp dir>)` | Fails, same two warnings | 2 | 0 (writes the temp dir) |
| In-memory `XmlRepository` **and** `XmlEncryptor = new NullXmlEncryptor()` | Passes | 0 | 0 |

The last variant on PR #46's head, filter `TestHostDataProtectionTests|AbortedRequestTests`,
three runs, each with a fresh `HOME`: exit 0, `Passed: 7, Total: 7`, no warning,
profile 0. `AbortedRequestTests` alone, two more fresh-`HOME` runs: exit 0,
`Passed: 6`. Spike logs: the scratchpad's `dp-repro-1.log`, `dp-46fix1.log`
to `dp-46fix3.log`, `dp-46ab1.log`, `dp-46ab2.log`. The spike's key folders
were deleted afterwards.

**The fix raises the race's exposure without PR #46 (corrected in round 2,
M-1).** Revision 1 said only that this change "does not cause" the race and
that the race might be mistaken for this change failing. That understated it.
The warning was not the only thing in the way: it changes how often the PR #46
request-log race fires, not just whether it can be seen.

| Tree, filter, `HOME` | Runs | Result | Source |
|---|---|---|---|
| Base `78ee598`, `AbortedRequestTests`, profile already holding a key | 5 | 5 of 5 exit 0, 4/4 | plan-review round 1 |
| Base + fix, `AbortedRequestTests`, fresh | 3 | 1 of 3 exit 1 (`AbortedRequestTests.cs:line 40`), 0 warnings | plan-review round 1 |
| Base + fix, `TestHostDataProtectionTests\|AbortedRequestTests`, fresh | 3 | 3 of 3 exit 1 (`Failed: 1`, `2`, `1` of 5) at `:39` or `:40`, 0 warnings | this spike, and the reviewer's 3 of 3 at `:39` |
| CI today, warm profile after the first host | 27 jobs | 1 failure (job `126362926149`, `:61`) | 2.5 |

So on a tree without PR #46 the fix turns a race that failed 1 in 27 CI jobs
into one that fails most filtered runs here. No assertion changes, but merging
it there would very likely make the API job flaky or red on
`rebuild/dotnet-platform`. That is why stacking on PR #46 is a hard
precondition (top of this plan, and section 9), and why no pass condition in
section 5 accepts a failure at `:39`, `:40` or `:61`. With PR #46 the race is
gone (2.7).

### 2.7 Red and green on this branch's own base, `2dbea44` (round 2)

Re-run after the branch was stacked on PR #46. Scratch export
`git archive 2dbea44 api` (its `ApiFactory.cs` is byte-identical to base, so
PR #46 and this change touch different files), spike test file and spike
`ApiFactory.cs` copied in, scratchpad SDK, Release, closed port, fresh `HOME`
per run unless marked warm. "Profile" counts every file and folder under `HOME`.
All those `HOME` folders were deleted afterwards; `/root/.aspnet` does not exist.

| Step | Filter | Result |
|---|---|---|
| Red, fresh `HOME` | `TestHostDataProtectionTests` | exit 1, `TestHostDataProtectionTests.cs:line 23`, `Collection: ["Warning: No XML encryptor configured. Key {5688860"···, "Warning: No XML …`, 2 warnings, profile 4 |
| Red, same `HOME` again (keys present) | same | exit 1, `Collection: ["Warning: No XML encryptor configured. Key {f847d08"···]`, 1 warning |
| No fix, fresh `HOME` | `AbortedRequestTests` | exit 1, `AbortedRequestTests.cs:line 45` (PR #46's `Assert.Empty`), `Key {eed3f75"···`: F-1 on this head |
| No fix, warm `HOME`, 3 runs | `AbortedRequestTests` | 3 of 3 exit 0, `Passed: 6`, 0 warnings |
| Fix, fresh `HOME` | `TestHostDataProtectionTests` | exit 0, `Passed: 1`, 0 warnings, profile 0 |
| Fix, fresh `HOME`, 3 runs | `TestHostDataProtectionTests\|AbortedRequestTests` | 3 of 3 exit 0, `Passed: 7, Total: 7`, 0 warnings, profile 0 |
| Fix, fresh `HOME`, 3 runs | `AbortedRequestTests` | 3 of 3 exit 0, `Passed: 6, Total: 6`, 0 warnings, profile 0 |
| Fix, fresh `HOME` | `AuthTests.Missing_admin_password_refuses_to_start\|RateLimitLogTests.The_network_drops_the_host_part` | exit 0, `Passed: 4, Total: 4` |

Builds: red build (full) `13 Warning(s) 0 Error(s)`, all in other projects, as
at base; fix build (incremental, the test project only) `0 Warning(s) 0 Error(s)`.
Logs: the scratchpad's `dp-r2-*.log`.

## 3. Design

### 3.1 Approach

Give every test host its own in-memory key ring with an explicit null XML
encryptor, in `ApiFactory`'s existing `ConfigureTestServices` block:

```csharp
// The test host never uses the user profile's key ring: on Linux the default
// ring has no encryptor and logs a Warning whenever it makes a key, so the
// first host of a run on a fresh profile failed any test that asserts no
// warnings (FU-1). Keys live and die with the host; the API stores nothing
// protected, so nothing needs them afterwards.
// Every test host must derive from ApiFactory and call
// base.ConfigureWebHost, or it gets the profile's key ring again.
services.Configure<KeyManagementOptions>(options =>
{
    options.XmlRepository = new InMemoryKeyRing();
    options.XmlEncryptor = new NullXmlEncryptor();
});
```

with a small private nested class in `ApiFactory`:

```csharp
private sealed class InMemoryKeyRing : IXmlRepository
{
    private readonly List<XElement> _elements = [];

    public IReadOnlyCollection<XElement> GetAllElements()
    {
        lock (_elements)
            return _elements.Select(element => new XElement(element)).ToList();
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        lock (_elements)
            _elements.Add(new XElement(element));
    }
}
```

`KeyManagementOptions`, `IXmlRepository` and `NullXmlEncryptor` are public types
in `Microsoft.AspNetCore.DataProtection`, already in the shared framework the
Web SDK test project references. No package is added.

Why this is right:

- **It removes the cause, not the symptom.** The warning is a real statement
  about the default ring: a key written unencrypted to the profile. The test
  host no longer writes a key to the profile at all, so the statement is no
  longer true for it, and the framework correctly does not say it. Every
  `Assert.Empty(AtLeast(Warning))` stays exactly as strict: any other warning,
  including one from Data Protection itself, still fails the test.
- **Deterministic on every platform and profile.** Each host starts with an
  empty ring and makes its own key; no test depends on an earlier test or run.
  On Windows the test hosts also stop writing DPAPI keys to `%LOCALAPPDATA%`.
- **One place, every host.** All `ApiFactory` subclasses call the base
  `ConfigureWebHost` (2.3), so they all get it. `Program.cs` configures no Data
  Protection, so there is no ordering conflict with the application's
  registrations.
- **Production is untouched.** `Program.cs` and `appsettings.json` do not
  change, as the change context requires.

### 3.2 Alternatives rejected

| Option | Why rejected |
|---|---|
| Filter "No XML encryptor" (or the `Microsoft.AspNetCore.DataProtection` category) out of `AtLeast(Warning)` | Weakens the assertion (P-6): a real warning from that source would pass unseen. It also edits `AbortedRequestTests.cs`, which PR #46 owns. Not argued for. |
| `UseEphemeralDataProtectionProvider()` | Spike: still writes two keys to the profile and logs both warnings. It replaces `IDataProtectionProvider` but not the key manager the hosted service starts. |
| In-memory repository without an encryptor | Spike: no profile write, but both warnings remain. The warning is about the missing encryptor, not the location. |
| Per-run key directory (`PersistKeysToFileSystem`) | Spike: both warnings remain, and it leaves folders in the temp directory to clean up. Adding a certificate encryptor to it would need a test certificate: more parts for no gain. |
| Warm Data Protection before the sink is attached (a throwaway host, a module initialiser, or a collection fixture) | The warning comes from the host's own start-up, logged through the same `ReadFrom.Services` pipeline the sink joins, so it cannot be warmed inside the asserting host. Warming in another host just writes the profile key earlier: it keeps the hidden dependency on shared machine state and order, and still writes an unencrypted key to the profile. |
| Remove the `Microsoft.AspNetCore` Warning override in the Testing environment, or raise the level | Hides every ASP.NET Core warning from every test. Weakens the guard. |
| Configure production Data Protection (keys, encryptor) | Out of bounds per the change context unless the test setup cannot fix it; the spike shows it can. Production runs on IIS on Windows (`docs/PROJECT_PROFILE.md`), and the API protects nothing with Data Protection. |
| Mark AbortedRequestTests to run after another collection | Order dependence is the defect; this would only hide it. |

## 4. Scope

### Files to create or change

| File | Change |
|---|---|
| `api/tests/DigitalHub.Api.Tests/TestHostDataProtectionTests.cs` (new) | The failing-first test (5.1), with its own small sink factory, in `[Collection("SqlServer")]` like the other host tests. |
| `api/tests/DigitalHub.Api.Tests/ApiFactory.cs` | Add the `KeyManagementOptions` block to the existing `ConfigureTestServices` (lines 57-61), the `InMemoryKeyRing` nested class, the `using` lines (`System.Xml.Linq`, `Microsoft.AspNetCore.DataProtection.KeyManagement`, `…Repositories`, `…XmlEncryption`), and the comment in 3.1. |
| `docs/changes/dataprotection-first-run/*.md` | Pipeline records. |

### Out of scope (left alone on purpose)

- `AbortedRequestTests.cs`: unchanged (PR #46 owns it; the assertions stay as
  they are).
- `RateLimitLogTests.cs` and FU-2 (its `DoesNotContain` race): a separate follow-up.
- `Program.cs`, `appsettings*.json`, and the production Data Protection setup.
- The Studio end-to-end job, whose real API process (`dotnet run`, not
  `ApiFactory`) also logs this warning (`job-118617022817.log:770`). Nothing
  asserts on it.
- A shared sink helper for the three copies of `CollectingSink`: a refactor, not
  this fix (B-8).
- `.github/workflows/ci.yml`: no change. The job already runs the whole suite.

## 5. Test plan

All .NET commands run in Release. In this Linux container use the scratchpad
SDK (`. <scratchpad>/dn.sh`), point `ConnectionStrings__Content` at the closed
port `127.0.0.1,4299`, and set `HOME` to a new empty folder in the scratchpad
for every run. Delete those folders afterwards. Let `CS` be
`Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True`.

### 5.1 Failing test, written and committed first

`TestHostDataProtectionTests.The_test_host_makes_a_data_protection_key_without_a_warning`,
in the new file. It:

1. builds a host from a private `ApiFactory` subclass that adds a collecting
   `ILogEventSink` (the same shape as `AbortedRequestTests.LoggingFactory`);
2. resolves `IKeyManager` from `factory.Services` (which starts the host) and
   calls `CreateNewKey(now, now.AddDays(90))`, so a key is made inside the
   asserting host whatever the profile holds;
3. asserts `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))`, with no
   filter;
4. asserts Data Protection still works: a protector from `IDataProtectionProvider`
   round-trips `"round trip"` through `Protect` and `Unprotect`.

Expected red on Linux on this branch's base `2dbea44` (2.7; also at `78ee598`, 2.6): exit 1, `Assert.Empty() Failure`,
`Collection: ["Warning: No XML encryptor configured. Key {…"···, …]`, both with
an empty profile and with a profile that already holds a key. It does not depend
on order or on the profile, which is why it is the red test rather than the
fresh-profile AbortedRequestTests run. On Windows it passes at base (DPAPI); its
red evidence is Linux, here and in CI.

Red commit, then:

```
dotnet build tests/DigitalHub.Api.Tests -c Release
HOME=<new empty dir> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "FullyQualifiedName~TestHostDataProtectionTests" --logger "console;verbosity=normal"
```

Record exit code, the `Collection:` line and the number of files under `HOME`.

### 5.2 After the fix, on this branch's head (pass conditions)

Every run below is on the head of `change/dataprotection-first-run` as it will
be merged: stacked on PR #46 (`2dbea44`), or, if PR #46 has merged by then,
rebased onto `rebuild/dotnet-platform` that contains it. Never on a tree
without PR #46. All are pass conditions; none accepts a known failure.

1. Same command as 5.1, fresh `HOME`: exit 0, `Passed: 1`, 0 lines matching
   `No XML encryptor`, nothing under `HOME`.
2. F-1's own steps, three times, each with a fresh `HOME`:
   `--filter "FullyQualifiedName~AbortedRequestTests"`. Each: exit 0,
   `Passed: 6, Total: 6`, 0 `No XML encryptor`, nothing under `HOME`. Any
   failing row, at any line, fails this change and is reported before anything
   is fixed.
3. Both together, three times, each with a fresh `HOME`:
   `--filter "FullyQualifiedName~TestHostDataProtectionTests|FullyQualifiedName~AbortedRequestTests"`.
   Each: exit 0, `Passed: 7, Total: 7`, 0 warnings, nothing under `HOME`. This
   is F-1's "Done when" ("All rows pass").
4. Two nearby tests that run without SQL Server, fresh `HOME`:
   `--filter "FullyQualifiedName~AuthTests.Missing_admin_password_refuses_to_start|FullyQualifiedName~RateLimitLogTests.The_network_drops_the_host_part"`
   (`AuthTests.cs:253`, `RateLimitLogTests.cs:69-71`): exit 0, `Passed: 4`.
5. Build: `dotnet build DigitalHub.slnx -c Release`: exit 0, and no compiler
   warning whose path is `ApiFactory.cs` or `TestHostDataProtectionTests.cs`
   (`grep` the build log for both names: expected no match).
6. CI on this head is green (5.4). The PR is not opened for merge until it is.

All of 1 to 4 were already run on `2dbea44` in round 2 with the spike code and
passed (2.7); the developer repeats them on the real commits.

### 5.3 Information only: the same fix without PR #46

Not a pass condition, and not required. If the developer wants to show the
exposure in 2.6 again, run 5.2 step 3 on a scratch export of `78ee598` plus
the two files. Expected: failures at `AbortedRequestTests.cs:39` or `:40`, 0
warnings. This is the reason for the merge order, not something this PR
tolerates.

### 5.4 NOT RUN here, covered by CI

- Full integration suite (needs SQL Server): **NOT RUN** here; covered by the
  `ci.yml` job "API — Release build, migrations, integration tests", on this
  PR's head (stacked on PR #46). Required: all pass, total = PR #46's total
  (477 in job `129072328525`) + 1 = 478. **Extra CI check:** `grep -c "No XML encryptor"`
  in that job's log is 0 (it is 1 in all 27 jobs since 20 October, 2.5).
- Studio end-to-end (`ci.yml` Studio job): NOT RUN; unaffected (does not use
  `ApiFactory`).
- Semgrep and the rest of `security.yml`: NOT RUN here (Semgrep scans
  `api/tests` with `p/csharp`, `p/owasp-top-ten`); covered by the Security
  workflow's semgrep job. `NullXmlEncryptor` in test code is the one new
  construct a rule could notice; see R-3.
- Windows Release run on the owner's machine: NOT RUN; covered by the owner's
  own run. Expected green; test hosts stop writing to `%LOCALAPPDATA%\ASP.NET\DataProtection-Keys`.

### 5.5 Track checklist (G1, Waves 1 to 3, as it applies)

| Checklist item | Applies? |
|---|---|
| One gate per pull request (B-8) | One fix, two test files. Yes. |
| New gate reports for seven days via `*_BLOCKING_FROM` | No gate is added. N/A. |
| Gate canary fixture (GAP-21) | No gate. N/A. The red test is the proof the check fires. |
| Actions pinned by SHA, SQL image by digest, Node and .NET exactly | No workflow change. N/A. |
| Baselines only shrink | No baseline file touched. N/A. |
| Red test before the fix (P-4, B-6) | Yes: 5.1 committed before 4's `ApiFactory.cs` change. |

## 6. Security impact

None in production. Routes, policies, data, logins, secrets and dependencies
are unchanged; `Program.cs` and configuration are not touched. In tests, keys
are held unencrypted in memory for the life of one test host and never written
to disk, which is strictly less exposure than today (unencrypted XML files in
`~/.aspnet` on Linux runners and dev profiles). The API protects nothing with
Data Protection (2.2), so test behaviour does not change. No package is added.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. Nothing persists: the test key ring lives in memory.

## 9. Owner decisions needed

None. The fix stays in test setup, as the change context requires.

**Blocking condition for the integrator (not an owner decision):** merge PR #46
first. This branch is stacked on it; if PR #46 has merged, rebase this branch
onto `rebuild/dotnet-platform` and get green CI on the new head (B-3) before
merging. If PR #46 is closed unmerged, this change stops and returns to step 1.
The pull request's description states this in its first line.

## 10. Risks

| Id | Risk | How the test plan catches it |
|---|---|---|
| R-1 | A test somewhere relies on keys persisting across hosts (a cookie or token made by one host read by another). | 2.2 finds no Data Protection consumer. The full suite in CI (5.4) would fail such a test. |
| R-2 | Without PR #46, the fix raises the exposure of AbortedRequestTests' request-log race: a warm-profile base passed 5 of 5, base + fix failed 1 of 3 (AbortedRequestTests alone) and 3 of 3 (with the new test) at `:39`/`:40` (2.6). Merged on its own it would very likely make the API job flaky or red. | Removed by construction: the branch is stacked on PR #46 and the merge order is a blocking condition (top, section 9). 5.2 runs only on that head and accepts no failure; 2.7 shows 3 of 3 green there. CI on the head must be green (5.2 step 6). |
| R-3 | Semgrep or CodeQL flags `NullXmlEncryptor` in test code. | Security workflow on the PR (5.4). A finding goes back to the plan; it is not suppressed. |
| R-4 | A later host that does not derive from `ApiFactory` (as `MissingPasswordFactory` does not) or does not call `base.ConfigureWebHost` gets the profile ring again. | All current hosts do, or fail before start-up (2.3). The comment in `ApiFactory` says every test host must derive from it and call `base.ConfigureWebHost`. The red test covers `ApiFactory` only; accepted, as the reviewer agreed (m-2). |
| R-5 | A future framework version logs a different warning for an in-memory ring with a null encryptor. | The new test fails on any Warning, so an SDK bump would show it at once. |
| R-6 | `KeyManagementOptions` configured in `ConfigureTestServices` is overridden by a later registration. | Nothing in `Program.cs` configures it; the new test checks the outcome, not the setting. |

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| A test host makes a Data Protection key without a Warning, on any profile | F-1 / FU-1; 5.1 | Planned | |
| `TestHostDataProtectionTests` shown red at base before the fix | P-4, B-6; 5.1 | Planned | |
| AbortedRequestTests: all rows pass on a fresh Linux profile ("Done when"), on this branch's head | F-1 *Expected*; 5.2 steps 2-3 | Planned | |
| Merged only after PR #46; CI green on the head that merges | M-1; top, 9, 5.2 step 6 | Planned | |
| No warning assertion weakened; `AbortedRequestTests.cs` unchanged | P-6, FU-1; 4 | Planned | |
| Test hosts write nothing to the user profile's key ring | 3.1; 5.2 | Planned | |
| Data Protection still works in the test host (protect / unprotect) | 5.1 step 4 | Planned | |
| Full integration suite green in CI (478 tests), warning absent from the API job log | G-2; 5.4 | Planned | |
| Production Data Protection and configuration unchanged | Change context; 6 | Planned | |

## 12. Revision log

- **Round 1:** first version.
- **Round 2** (answers `plan-review.md` Round 1, verdict CHANGES NEEDED; and the
  orchestrator's decision to stack the branch on PR #46, reset to `2dbea44`):
  - **M-1.1 (dependency is advice, not a precondition).** Accepted. The branch
    is now stacked on PR #46. The merge order is a blocking condition at the
    top of the plan and in section 9: PR #46 merges first; if it has, this
    branch is rebased and CI re-run (B-3); if it is closed, this change returns
    to step 1. The PR description says so in its first line.
  - **M-1.2 (5.3 evidence on the head that merges).** Accepted. 5.2 now runs
    only on this branch's head, stacked on PR #46 or rebased onto a
    `rebuild/dotnet-platform` that contains it. Every step is a pass condition
    with no tolerated failure (the old "reported, not fixed" for `:39/:40/:61`
    is removed). The scratch merge of revision 1 is gone; the base-only runs
    are information only (5.3). CI green on that head is step 6. I re-ran red
    and green on `2dbea44` with the scratchpad SDK and fresh `HOME`s (2.7):
    red exit 1 with the warning (fresh and warm profile); green 3 of 3
    `Passed: 7` and 3 of 3 `Passed: 6`, 0 warnings, nothing under `HOME`.
  - **M-1.3 (2.6 and R-2 understate the effect).** Accepted. 2.6 now says the
    fix raises the race's exposure on a tree without PR #46, with the
    reviewer's warm-base runs (5 of 5 green) set against base + fix (1 of 3 and
    3 of 3 red) and CI's 1 in 27. R-2 is rewritten to match.
  - **m-1 (grep misquoted).** Accepted. I re-ran it: it prints nothing (exit 1).
    2.2 now quotes that, plus a second grep that does find
    `AdminStore.cs:382,385`, with its real output.
  - **m-2 (guard depends on a convention).** Accepted. The `ApiFactory` comment
    in 3.1 now says every test host must derive from `ApiFactory` and call
    `base.ConfigureWebHost`; R-4 names hosts outside `ApiFactory`.
