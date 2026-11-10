# Test report: aborted-request-log-race

## Round 1

Tester, 8 November 2026. Read: `docs/changes/README.md` and
`.claude/agents/tester.md` (PR #37 branch, in `/home/user/DH-WEBSITE`),
`AGENTS.md`, `ENGINEERING_STANDARDS.md` (plan branch), and every file in this
folder: `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`.

**Commits tested**

| Role | SHA | Detached worktree (removed after) |
|---|---|---|
| Base | `78ee598` | `/home/user/dh-log-race-base` |
| Red | `f3065c1` | `/home/user/dh-log-race-red` |
| Fix | `2f09df7` (code) | — |
| Head | `ee358432e8c7074818559390747cbc5c14fe057a` | `/home/user/dh-log-race-fix` |

`git diff 2f09df7 ee35843 --stat` lists only `implementation.md`. The code at
the head is the code at `2f09df7`.

### How a compile and run were possible here

- **SDK.** `dot.net/v1/dotnet-install.sh` and `builds.dotnet.microsoft.com` are
  blocked by the proxy (`curl: (56) CONNECT tunnel failed, response 403`).
  `archive.ubuntu.com` is reachable, so I downloaded Ubuntu 24.04's
  `noble-updates/main` `dotnet10` packages (`dotnet-sdk-10.0_10.0.114`, runtime
  and ASP.NET Core runtime `10.0.14`, host, hostfxr, targeting and apphost
  packs). I unpacked them with `dpkg-deb -x` into the session scratchpad, so
  nothing was installed system-wide. `dotnet --info`: SDK `10.0.114`,
  `Microsoft.NETCore.App 10.0.14`, `Microsoft.AspNetCore.App 10.0.14`. The
  repository has no `global.json`, and the csproj targets `net10.0`, so this
  SDK matches. NuGet restore went to `api.nuget.org`, which is reachable.
- **Database.** There is no SQL Server, and I did not install one. These tests
  never reach the database: the requests fail in the body reader, before any
  endpoint runs. `IdentitySeeder.StartAsync` returns when
  `CanConnectAsync` is false. I set `ConnectionStrings__Content` in the
  process environment only, to
  `Server=tcp:127.0.0.1,4299;Database=DigitalHubContent;…;Connect Timeout=2`.
  Nothing listens on that port, so no database, test or real, can be read or
  written. `ApiFactory.ToTestCatalog` rewrites it to `DigitalHubContent_Test`
  anyway.
- Every test command ran in Release. I started no long-running process. The
  CPU-load loops in check 6 were started and stopped by me.

### Checks

**1. Build, Release, both commits.** From `api/`:

```
dotnet build tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-incremental
```

| Commit | Exit | Output |
|---|---|---|
| `2f09df7` (head) | 0 | `Build succeeded.` `13 Warning(s)` `0 Error(s)` |
| `f3065c1` (red) | 0 | `Build succeeded.` `13 Warning(s)` `0 Error(s)` |
| `78ee598` (base) | 0 | Built for check 7 |

All 13 warnings are CS8601/CS8604 in
`tools/DigitalHub.ContentImport/ContentWriter.cs`, the same at both commits.
`grep -c AbortedRequestTests` on each build log prints `0`, so the changed
file builds with no warning.

**2. Red commit `f3065c1` fails for the reason the plan gives (P-4, R-4/C-7).**

```
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~AbortedRequestTests" --logger "console;verbosity=normal"
```

Three runs: the first in a fresh profile, then two more.

| Run | Exit | Result |
|---|---|---|
| 1 | 1 | 3 passed, 3 failed. The two 300 ms rows, plus `…disconnects…(login, 0)` at line 40, `Assert.Empty()`, `["Warning: No XML encryptor configured. Key {912308f"···]`. That one is environmental and pre-existing (finding F-1, check 7). |
| 2 | 1 | **4 passed, 2 failed** |
| 3 | 1 | **4 passed, 2 failed** |

The failing rows in runs 2 and 3 are exactly the two the plan names:

```
Failed …A_client_that_disconnects_mid_body_is_not_a_server_error(path: "/api/v1/auth/login", requestLogDelayMs: 300) [108 ms]
   …AbortedRequestTests.cs:line 42
   Assert.Contains() Failure: Filter not matched in collection
   Collection: [ "Application started…", "Hosting environment: \"Testing\"", "Content root path: …", "Client closed the request before it finished"]
Failed …A_chunked_body_that_ends_early_is_a_400_not_a_server_error(path: "/api/v1/auth/login", requestLogDelayMs: 300) [37 ms]
   …AbortedRequestTests.cs:line 65
   Assert.Contains() Failure: Filter not matched in collection
   Collection: [ …, "Bad request from the client: 400"]
```

At `f3065c1`, line 42 is the `responded 499` assertion and line 65 is the
`responded 400` assertion, as `implementation.md` predicted. The second
collection has the same shape as the CI failure in job `126362926149`: the
shield's line is present and the request-log line is not. **R-4 does not
trigger.** `TestServer.SendAsync` hands back before the request-log line is
written, so the cause is confirmed by execution and not only by citation.

**3. Fix `2f09df7` (head) passes.** Same command, three runs:

| Run | Exit | Result |
|---|---|---|
| 1 | 0 | `Total tests: 6` `Passed: 6` |
| 2 | 0 | `Total tests: 6` `Passed: 6` |
| 3 | 0 | `Total tests: 6` `Passed: 6` |

The 300 ms rows take 331–436 ms, and the zero rows for the same path take
27–36 ms (the 400 theory). So the delay really is applied, and the wait
really waits for it.

**4. The seven `Assert.` lines are byte-identical to `78ee598` (P-6, C-4).**

```
diff <(git show 78ee598:$F | grep "Assert\.") <(git show <c>:$F | grep "Assert\.")
  f3065c1 exit=0   2f09df7 exit=0   ee35843 exit=0
cmp <(git show 78ee598:$F | grep "Assert\." | od -c) <(git show 2f09df7:$F | grep "Assert\." | od -c)   → exit 0, BYTES_IDENTICAL
git show 78ee598:$F | grep -c "Assert\."   → 7
git show f3065c1 | grep -c WaitForAsync    → 0
```

At `2f09df7` they are at lines 32, 45–47, 68 and 72–73, in their original
order. The only new line between two assertions is the `WaitForAsync` at line
71, between `Assert.Equal` (68) and `Assert.Empty` (72).

**5. Mutation checks (beyond the plan).** These ran in a throwaway copy of the
head's `api/` in the scratchpad. The worktree was not edited.

| Mutation | Expected | Actual |
|---|---|---|
| M1: 499 theory, delay row `300` → `6000` (past the 5 s bound) | Wait gives up at about 5 s. The unchanged assertion fails with the full collection, with no hang and no hidden failure. | `Failed …(login, requestLogDelayMs: 6000) [5 s]` at line 47 (`responded 499`), `Filter not matched`, with the collection shown. The next row then ran normally. |
| M2: 400 theory, expected `responded 400` → `responded 401` | Wait ends on the request-log line with any status, then the assertion fails fast with the real line visible. | All three rows failed at line 73 in 28 ms, 148 ms and 337 ms, which is not 5 s. Collection shows `"HTTP \"POST\" \"/api/v1/auth/login\" responded 400"···`. |

So the wait cannot pass anything that fails today, and it reports a missing
line within its bound (R-2).

**6. Stress (beyond the plan).** I ran the head's filter five times with 8 busy
loops on 4 cores. All five runs exited 0, with `Passed: 6, Failed: 0`
(6–7 s each). The loops were then stopped.

**7. Fresh-profile run at base and head (beyond the plan, F-1).** Each was run
with `HOME` set to a new empty folder:

| Commit | Exit | Result |
|---|---|---|
| `78ee598` | 1 | `Failed: 1, Passed: 3, Total: 4`. The first row to run failed on `Assert.Empty`: `["Warning: No XML encryptor configured. Key {601aa77"···]` |
| head | 1 | `Failed: 1, Passed: 5, Total: 6`. The same warning on the first row |

This is pre-existing and not caused by this change.

**8. Code review by reading.**

- **Sink thread safety.** `_events` is a `ConcurrentQueue`. `Enqueue` runs on
  server threads. `Any`/`Where`/`Select` on the test thread enumerate a
  moment-in-time snapshot, which is safe while it is being written.
  `requestLogDelayMs` is a captured primary-constructor parameter that nothing
  writes after construction. The sleep runs **before** rendering and
  enqueueing, so a delayed event is not visible early. Each test builds its own
  `LoggingFactory` and sink. The class is in `[Collection("SqlServer")]`, which
  has `DisableParallelization = true` (`ApiFactory.cs`). `Thread.Sleep` blocks
  a server thread-pool thread, not the test's thread, and `WaitForAsync` uses
  `await Task.Delay`, so it holds no thread. No deadlock was seen in checks
  3, 5 and 6.
- **The 5 s bound.** `Stopwatch.StartNew()` and `clock.Elapsed < timeout` are
  checked before each 10 ms delay. The worst case is about 5 s plus one poll.
  It never throws. Confirmed at 5 s by M1.
- **Template match (C-1).** `RequestLogTemplatePrefix = "HTTP {RequestMethod} "`
  is matched with `StringComparison.Ordinal` against
  `logEvent.MessageTemplate.Text`, only when `requestLogDelayMs > 0`. This is
  the start of `Program.cs:272`,
  `"HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms"`.
  There is a synchronous `Thread.Sleep` in `Emit`, with no `Task.Run`, queue or
  async hand-off. Execution confirms the match: the red rows go red, the green
  rows take about 300 ms longer, and the zero rows are not delayed.
- **Wait placement.** In the 499 theory the wait comes after `ThrowsAnyAsync`
  and before all three sink assertions. In the 400 theory it comes after
  `Assert.Equal` and before both sink assertions. Both predicates use the same
  `$"\"{path}\" responded "` rendering as the assertions. The rendered line is
  `HTTP "POST" "/api/v1/auth/login" responded 400 …`, as seen in M2.
- **Scope (B-8).** `git diff --name-only 78ee598 ee35843` lists
  `AbortedRequestTests.cs` and four files in this folder. `git diff --check`
  exits 0. All four commits carry the change id in the subject and the
  attribution trailer.

**9. Security.** This is a test-only change, with no route, policy, login,
dependency, migration or secret.

| Check | Command | Exit | Result |
|---|---|---|---|
| NuGet vulnerable packages | `sh ../.github/security/run-dotnet-audit.sh` in `api/` (RUNNER_TEMP in scratchpad) | 0 | `no vulnerable packages` for all three projects. `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| npm audit, website | `npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (below High). Unchanged by this change. |
| npm audit, studio | `npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| Secrets in the diff | `git diff 78ee598 ee35843 \| grep -inE "password=\|secret\|apikey\|token\|BEGIN .*KEY"` | — | Only prose in the plan records ("no … secret … changes"). No values. The dummy connection string was in the environment only and is in no file. |
| Semgrep | — | NOT RUN | `semgrep` is not installed. Covered by `security.yml` job "Semgrep (ERROR fails, WARNING reported)". |
| gitleaks | — | NOT RUN | `gitleaks` is not installed. Covered by "Secret scan (gitleaks, this pull request's commits)". |
| Role matrix, host checks, unknown fields, body cap, RFC 7807 | — | Not applicable | No new or changed route |

**10. Not run.**

| Command | Reason | CI proof |
|---|---|---|
| `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` (full suite; expected base count + 2, so 477 on `78ee598`, C-5) | Most tests need SQL Server (`DigitalHubContent_Test`), which is not in this container and was not installed (change context) | "API — Release build, migrations, integration tests", step "Integration tests (Release)" |
| `website/` and `studio/` suites (`npm test`, typecheck, build, design check, section comparison, e2e) | This change touches no file in `website/` or `studio/` | "Website — typecheck, tests, design check, snapshot build"; "Studio — typecheck, build, end-to-end"; "Section comparison against feature/interviewer-portal" |

### Findings

No Blocker. No Major.

**F-1. Minor, pre-existing, not caused by this change, out of scope (B-8).
`AbortedRequestTests` fails its first row in a fresh profile on Linux.**

- *Steps.* At `78ee598` or at the head, on Linux, set `HOME` to an empty
  folder. Then run
  `dotnet test … -c Release --no-build --filter "FullyQualifiedName~AbortedRequestTests"`.
- *Expected.* All rows pass.
- *Actual.* The first row that runs fails `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))`
  with `Warning: No XML encryptor configured. Key {…} may be persisted to storage in unencrypted form.`
  ASP.NET Core Data Protection logs this once, when it creates the first key
  in `~/.aspnet/DataProtection-Keys`. Later runs pass. Evidence: check 7, and
  run 1 in check 2.
- *Why it matters.* The test depends on another test, or an earlier run,
  having created the key. In the full CI suite another host normally creates
  the key first, which is presumably why CI has not shown it. On the owner's
  Windows machine DPAPI encrypts the key, so this warning should not appear
  there. It would appear if the owner runs the filter alone on a fresh Linux
  runner, for example to answer O-1 in CI with only this filter.
- *Not fixed here,* as this change is limited to the log race. A follow-up
  could have the test host persist its keys to a temp folder, or configure
  them, so the warning cannot reach the sink. The orchestrator can raise it
  with the owner.

**Note, already recorded by the developer and not a finding against this
change.** The false-pass race in the `DoesNotContain` checks of
`RateLimitLogTests` (implementation.md C-3) is unchanged, as planned.

### Coverage table rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Cause confirmed: request-log line written after the snapshot | Job `126362926149` log; plan 2.1 | Verified, by execution | Check 2: the red 300 ms rows fail with the shield's line present and the request-log line missing. This reproduces the CI collection shape. R-4 not triggered. |
| Every existing assertion in `AbortedRequestTests` unchanged | P-6; C-4 | Verified | Check 4: `diff` exit 0 at `f3065c1`, `2f09df7` and `ee35843`. Byte-for-byte `cmp` exit 0. 7 lines, same order. |
| Red: delayed request-log rows fail without the wait | P-4; plan 5.1 | Verified | Check 2: `f3065c1`, runs 2 and 3, 4 passed and 2 failed at lines 42 and 65, `Filter not matched in collection`. |
| Green: all six `AbortedRequestTests` rows pass with the wait | Plan 5.2 | Verified | Check 3: 6/6 in three runs. Check 6: 6/6 in five runs under CPU load. |
| Both commits compile in Release | Plan 5.2 | Verified | Check 1: exit 0, 0 errors, no warning in the changed file. |
| Full API suite green in Release (base count + 2) | CI API job; C-5 | NOT RUN | Needs SQL Server. CI "API — Release build, migrations, integration tests". |
| `RateLimitLogTests`, `AdminApiTests` left alone | Plan 2.3; C-3 | Verified | `git diff --name-only 78ee598 ee35843`: only `AbortedRequestTests.cs` under `api/`. |

Verdict: APPROVED
