# Implementation: dataprotection-first-run

Implements `plan.md` revision 2 as approved in `plan-approval.md`
(`Verdict: APPROVED`). Branch `change/dataprotection-first-run`, stacked on
PR #46: base `2dbea44` (`origin/change/aborted-request-log-race`, unchanged at
the time of these runs), plan commit `7f82b9e` on top. Not pushed.

## Commits

| Step | Commit | Subject |
|---|---|---|
| Red (P-4, B-6) | `a5d2104` | dataprotection-first-run: Add failing test for the test host's first-key warning |
| Fix | `d76ef67` | dataprotection-first-run: Give each test host an in-memory key ring with a null encryptor |
| Record | this file's commit | dataprotection-first-run: Record the implementation |

## What changed, mapped to the plan's Scope (section 4)

| File | Change | Plan |
|---|---|---|
| `api/tests/DigitalHub.Api.Tests/TestHostDataProtectionTests.cs` (new, red commit) | `[Collection("SqlServer")]` class with one fact, `The_test_host_makes_a_data_protection_key_without_a_warning`. A private `SinkFactory : ApiFactory` adds a collecting `ILogEventSink` after `base.ConfigureWebHost`. The test resolves `IKeyManager` (starting the host), calls `CreateNewKey(now, now.AddDays(90))`, asserts `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))` with no filter, then round-trips `"round trip"` through a protector from `IDataProtectionProvider`. | 4, 5.1 steps 1-4 |
| `api/tests/DigitalHub.Api.Tests/ApiFactory.cs` (fix commit) | Four `using` lines (`System.Xml.Linq`, `…DataProtection.KeyManagement`, `…Repositories`, `…XmlEncryption`); in the existing `ConfigureTestServices` block, `services.Configure<KeyManagementOptions>` setting `XmlRepository = new InMemoryKeyRing()` and `XmlEncryptor = new NullXmlEncryptor()`, with the comment from 3.1 verbatim; the private nested `InMemoryKeyRing : IXmlRepository` from 3.1. 37 lines added, none removed. | 3.1, 4 |
| `docs/changes/dataprotection-first-run/implementation.md` | This record. | 4 |

Not changed, checked with `git diff --quiet 2dbea44 HEAD -- api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs api/src`
(exit 0): `AbortedRequestTests.cs`, `Program.cs`, `appsettings*.json`, and all of
`api/src`. `ci.yml` is not touched (`git diff --name-only 2dbea44..HEAD` lists
only the two test files and this folder). No package added. No migration.

## Environment for every run

Linux container, scratchpad SDK 10.0.114 (`. <scratchpad>/dn.sh`), Release,
`ConnectionStrings__Content="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`
(closed port), and a new empty `HOME` folder in the scratchpad for every run,
deleted after the run. Logs are in the scratchpad as `dpdev-*.log`.
"WRN" below counts lines matching ` (WRN|ERR|FTL)\]` in the console log; the
pattern was checked against the red log, where it finds 2. "home" is the count
of every file and folder under `HOME` after the run.

Test command (filter varies):

```
HOME=<new empty dir> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
  --filter "<filter>" --logger "console;verbosity=normal"
```

## Red run, on `a5d2104` (5.1, condition 2)

Build: `dotnet build tests/DigitalHub.Api.Tests -c Release`: exit 0,
`13 Warning(s) 0 Error(s)`, none in `ApiFactory.cs` or
`TestHostDataProtectionTests.cs` (all in other projects, as at base).

Filter `FullyQualifiedName~TestHostDataProtectionTests`, fresh `HOME`: **exit 1**.

```
Collection: ["Warning: No XML encryptor configured. Key {0a7d26c"···, "Warning: No XML encryptor configured. Key {6a4468a"···]
   at DigitalHub.Api.Tests.TestHostDataProtectionTests.The_test_host_makes_a_data_protection_key_without_a_warning() in /home/user/dh-change-dp/api/tests/DigitalHub.Api.Tests/TestHostDataProtectionTests.cs:line 30
Total tests: 1
     Failed: 1
```

The real line is 30 (the `Assert.Empty`; the plan expected 22 or 23 because the
committed file carries a doc comment). Entries under `HOME`: **4**
(`.aspnet`, `.aspnet/DataProtection-Keys`, and two `key-*.xml`). 4 lines
contain `No XML encryptor`.

Same `HOME` again, keys on disk (warm): **exit 1**,
`Collection: ["Warning: No XML encryptor configured. Key {0f921aa"···]`, line 30,
`Failed: 1`. So the red does not depend on the profile. The `HOME` folder was
then deleted.

## Pass conditions, on `d76ef67` (5.2 steps 1-5, condition 3)

No failure occurred in any run, so nothing was fixed after the fix commit.

| Step | Filter | Exit | Result | `No XML encryptor` | WRN | home |
|---|---|---|---|---|---|---|
| 1 | `FullyQualifiedName~TestHostDataProtectionTests` | 0 | `Total tests: 1, Passed: 1` | 0 | 0 | 0 |
| 2, run 1 | `FullyQualifiedName~AbortedRequestTests` | 0 | `Total tests: 6, Passed: 6` | 0 | 0 | 0 |
| 2, run 2 | same | 0 | `Total tests: 6, Passed: 6` | 0 | 0 | 0 |
| 2, run 3 | same | 0 | `Total tests: 6, Passed: 6` | 0 | 0 | 0 |
| 3, run 1 | `FullyQualifiedName~TestHostDataProtectionTests\|FullyQualifiedName~AbortedRequestTests` | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| 3, run 2 | same | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| 3, run 3 | same | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| 4 | `FullyQualifiedName~AuthTests.Missing_admin_password_refuses_to_start\|FullyQualifiedName~RateLimitLogTests.The_network_drops_the_host_part` | 0 | `Total tests: 4, Passed: 4` | 0 | 0 | 0 |

Step 5, `dotnet build DigitalHub.slnx -c Release` (in `api/`): **exit 0**,
`13 Warning(s) 0 Error(s)`. `grep -cE 'ApiFactory.cs|TestHostDataProtectionTests.cs'`
on the build log: **0**.

Clean-up: every `HOME` folder was deleted after its run; `ls` of the scratchpad
shows no `dpdev-home-*` left, and `/root/.aspnet` does not exist
(`ls: cannot access '/root/.aspnet': No such file or directory`).

## NOT RUN here (5.4)

- **Full integration suite** (needs SQL Server): NOT RUN; covered by the `ci.yml`
  job "API — Release build, migrations, integration tests" on the head that
  merges. Required by condition 6: green; `grep -c "No XML encryptor"` on its
  log = 0; total = latest green API job total on the integration branch, plus
  PR #46's rows if not yet merged, plus 1 (478 only if nothing else adding tests,
  such as #40's `ServerHeaderTests`, merges first). The arithmetic and job id are
  for the tester / integrator once CI has run.
- **5.2 step 6, CI green on the head:** NOT RUN; the branch is not pushed (the
  prompt forbids it). Covered by the same job.
- **Security workflow** (Semgrep, CodeQL): NOT RUN; covered by `security.yml`
  on the PR. A finding on `NullXmlEncryptor` goes back to the plan (R-3).
- **Studio end-to-end:** NOT RUN; unaffected (does not use `ApiFactory`),
  `ci.yml` Studio job.
- **Windows Release run:** NOT RUN; the owner's own run.
- **5.3 (fix without PR #46):** information only, not required; not run.

## Migrations

None.

## Coverage table (plan section 11)

| Item | Source | Status | Evidence |
|---|---|---|---|
| A test host makes a Data Protection key without a Warning, on any profile | F-1 / FU-1; 5.1 | Done (local) | `d76ef67`: step 1 exit 0, `Passed: 1`, 0 `No XML encryptor`; red showed the warning on both a fresh and a warm profile, so the test forces a key regardless of profile. |
| `TestHostDataProtectionTests` shown red at base before the fix | P-4, B-6; 5.1 | Done | `a5d2104` committed alone before `d76ef67`; exit 1, `TestHostDataProtectionTests.cs:line 30`, `Collection: ["Warning: No XML encryptor configured. Key {0a7d26c"···, …]`, 4 entries under `HOME`; warm rerun also exit 1. |
| AbortedRequestTests: all rows pass on a fresh Linux profile ("Done when"), on this branch's head | F-1 *Expected*; 5.2 steps 2-3 | Done (local) | Step 2: 3 of 3 exit 0, `Passed: 6`; step 3: 3 of 3 exit 0, `Passed: 7`; each fresh `HOME`, 0 warnings. |
| Merged only after PR #46; CI green on the head that merges | M-1; top, 9, 5.2 step 6 | Stacked; CI NOT RUN | `git merge-base --is-ancestor 2dbea44 HEAD` true; `origin/change/aborted-request-log-race` = `2dbea44`. CI: NOT RUN (not pushed), `ci.yml` API job; merge order is for the integrator (condition 5). |
| No warning assertion weakened; `AbortedRequestTests.cs` unchanged | P-6, FU-1; 4 | Done | `git diff --quiet 2dbea44 HEAD -- …/AbortedRequestTests.cs` exit 0; the new test's `Assert.Empty(AtLeast(Warning))` has no filter. |
| Test hosts write nothing to the user profile's key ring | 3.1; 5.2 | Done (local) | Every run on `d76ef67`: 0 entries under `HOME` (red: 4). |
| Data Protection still works in the test host (protect / unprotect) | 5.1 step 4 | Done (local) | Step 1 passes, and the test's last assertion is the `"round trip"` `Protect`/`Unprotect`. |
| Full integration suite green in CI (478 tests), warning absent from the API job log | G-2; 5.4 | NOT RUN | Needs SQL Server; `ci.yml` API job; total rule per condition 6. |
| Production Data Protection and configuration unchanged | Change context; 6 | Done | `git diff --quiet 2dbea44 HEAD -- api/src` exit 0; `git diff --name-only 2dbea44..HEAD` lists only the two test files and this folder. |

## Notes for the tester

- `git diff --name-only origin/rebuild/dotnet-platform...HEAD` today also lists
  PR #46's files (`AbortedRequestTests.cs` and `docs/changes/aborted-request-log-race/`),
  because #46 is not merged; condition 5's two-files check applies after the
  restack.
- The red line is 30, not 22/23 as the plan estimated (doc comment above the class).

Status: READY FOR TEST
