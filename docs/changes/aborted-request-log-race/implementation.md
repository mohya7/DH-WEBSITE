# Implementation: aborted-request-log-race

Developer, round 1, 8 November 2026. Branch `change/aborted-request-log-race`
(no tracking, not pushed), worktree `/home/user/dh-change-log-race`, base
`78ee598`. Plan: `plan.md` round 1; gate 1: `plan-approval.md`,
`Verdict: APPROVED` with conditions C-1 to C-7, all answered below.

Read first: `docs/changes/README.md` and `.claude/agents/developer.md` (PR #37
branch, in `/home/user/DH-WEBSITE`), `AGENTS.md`, `ENGINEERING_STANDARDS.md`
(via `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md`;
P-4, P-6, P-8, B-4, B-5, B-6, B-8), `plan.md`, `plan-review.md`,
`plan-approval.md`.

## Result in one paragraph

Two commits, in the order C-4 requires. The red commit adds a request-log
delay to `CollectingSink` and one 300 ms row per theory, without any wait. The
fix commit adds `CollectingSink.WaitForAsync` and calls it in both theories
before the unchanged assertions. Only `AbortedRequestTests.cs` changes. The
seven `Assert.` lines are byte-identical to `78ee598` and in the same order
in both commits. **Nothing was built or run.** There is no `dotnet` and no SQL
Server in this container, so the red failure, the green pass and the full
suite are all NOT RUN. Only the CI job "API — Release build, migrations,
integration tests" can prove them. The C# was checked by reading only.

## Commits

| SHA | Subject | Plan step |
|---|---|---|
| `f3065c1` | aborted-request-log-race: Add failing rows for a request-log line written late | 5.1 red (P-4, B-6 by analogy, C-4) |
| `2f09df7` | aborted-request-log-race: Wait for the request-log line before reading the sink | Design steps 1 to 3 (fix) |
| (this file) | aborted-request-log-race: Record the implementation | — |

## What changed, file by file

All changes are in `api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs`,
which is the only code file in Scope (plan section 4).

| Change | Commit | Scope item |
|---|---|---|
| Both theories: second parameter `int requestLogDelayMs`. The existing rows `("/api/v1/auth/login", 0)` and `("/api/v1/public/contact", 0)`, plus a new row `("/api/v1/auth/login", 300)` with a one-line comment. Each test now builds `new LoggingFactory(requestLogDelayMs)` | `f3065c1` | "Both theories: a second parameter…" |
| `LoggingFactory(int requestLogDelayMs = 0)` primary constructor. `Sink` is built as `new(requestLogDelayMs)` | `f3065c1` | "`LoggingFactory`: a constructor parameter for that delay (default zero)" |
| `CollectingSink(int requestLogDelayMs = 0)`. In `Emit`, when `requestLogDelayMs > 0` **and** `logEvent.MessageTemplate.Text.StartsWith("HTTP {RequestMethod} ", StringComparison.Ordinal)`, it calls `Thread.Sleep(requestLogDelayMs)` before rendering and enqueueing. The sleep is synchronous, on the emitting thread, with no `Task.Run`, queue or async hand-off (C-1) | `f3065c1` | "`CollectingSink`: … an optional request-log delay" |
| `CollectingSink.WaitForAsync(Func<string, bool> match, TimeSpan timeout)`. It uses a `Stopwatch` and loops while no queued line matches and the elapsed time is under the timeout, with `await Task.Delay(10 ms)` between checks. It does not throw or assert. Adds `using System.Diagnostics;` | `2f09df7` | Design step 1 |
| 499 theory: `await factory.Sink.WaitForAsync(line => line.Contains($"\"{path}\" responded ", StringComparison.Ordinal), TimeSpan.FromSeconds(5));` after the `ThrowsAnyAsync`, before the first sink assertion | `2f09df7` | Design step 2 |
| 400 theory: the same call after `Assert.Equal(400, …)`, before `Assert.Empty` | `2f09df7` | Design step 2 |

The wait predicate matches the request-log line **with any status**, using
the same quoted-path rendering as the existing assertions. A wrong status
therefore still ends the wait, and the unchanged `responded 499` /
`responded 400` assertion still fails with the real line in the collection.

Not changed, as the plan says: `RateLimitLogTests.cs`, `AdminApiTests.cs`,
`Program.cs`, `ExceptionShieldMiddleware.cs`, Serilog configuration and
`.github/workflows/ci.yml`. The three private `CollectingSink` copies are not
merged.

## Assertions unchanged (P-6, C-4)

The `Assert.` lines in the file at the base, at the red commit and at the fix
commit:

```
$ diff <(git show 78ee598:api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs | grep "Assert\.") \
       <(git show f3065c1:api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs | grep "Assert\.")
f3065c1 assert-diff exit=0
$ (same against 2f09df7)
2f09df7 assert-diff exit=0
$ git diff 78ee598 -- api | grep '^[-+]' | grep "Assert\."
(no output, exit 1)
```

The file has seven `Assert.` lines, all unchanged and in the same order. At
the fix commit they are at lines 32, 45 to 47, 68 and 72 to 73. The only
line inserted between two assertions is the `WaitForAsync` call at line 71,
between `Assert.Equal` (68) and `Assert.Empty` (72). It does not move or
reorder either one.

## Conditions from gate 1

- **C-1. Met.** The delay is a synchronous `Thread.Sleep` inside `Emit`
  (`AbortedRequestTests.cs:172` at `2f09df7`). It applies only when
  `requestLogDelayMs > 0` and the template starts with the exact prefix
  `"HTTP {RequestMethod} "`, held in the constant `RequestLogTemplatePrefix`
  and matched with `StringComparison.Ordinal`. That is the start of the
  production template in `Program.cs:272`,
  `"HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms"`.
  There is no `Task.Run`, no queueing and no async hand-off. The four existing
  rows pass `0`.
- **C-2. Met.** Job `126362926149` log
  (`gh api repos/mohya7/DH-WEBSITE/actions/jobs/126362926149/logs`, 3,677 lines,
  read from the session scratchpad copy `job126362926149.log`). The excerpt is
  lines **3071–3100**:
  - 3071: `Application started. Press Ctrl+C to shut down.`
  - 3074: `50a75a15… Bad request from the client: 400` (the shield line)
  - 3075: `50a75a15… HTTP POST /api/v1/auth/login responded 400 in 1.6595 ms` (the request-log line)
  - 3079: the first `Collection: ["Application started…", …]`, without the 3075 line
  - 3098–3100: `Total tests: 475`, `Passed: 474`, `Failed: 1`

  I re-read these with `sed -n '3071p;3074p;3075p;3079p;3098,3100p'`, and they
  match.
- **C-3. Met. Corrected `RateLimitLogTests` reasoning (F-1).** Plan 2.3 says
  a late request-log line "holds only method, path, status and time". That is
  wrong. `RateLimitLogTests.CollectingSink.Emit` (`RateLimitLogTests.cs:103–110`)
  appends every property after the rendered message
  (`writer.Write($" {property.Key}={property.Value}")`). A late request-log
  line would therefore also carry `RequestMethod`, `RequestPath`,
  `StatusCode`, `Elapsed`, and the enriched properties such as
  `CorrelationId` (`Enrich.FromLogContext()`, `Program.cs:30`). None of
  these can contain the email marker or the `wrong-` password, so the
  `DoesNotContain` checks (`:38`, `:39`, `:63`) are not affected by a late
  line. The positive checks (`Assert.Single`, `:33`, `:59`) count only Warning
  events whose text contains "Rate limit". `RateLimitLog.Refused` writes
  those in `OnRejected` (`Program.cs:117–120`), before `ProblemResults.WriteAsync`
  starts the response. The file stays unchanged.

  **Note (F-1, not fixed here, B-8):** the `DoesNotContain` checks in
  `RateLimitLogTests` read the sink right after the response. They race in
  the false-pass direction: an event written after the read would not be
  checked. This change does not fix that. If it is worth tracking, the
  orchestrator raises it with the owner as a follow-up.
- **C-4. Met.** Two commits, red (`f3065c1`) then fix (`2f09df7`). The red
  commit has the delay plumbing and the two 300 ms rows, with no
  `WaitForAsync`. `git show f3065c1 | grep -c WaitForAsync` prints `0`. No
  assertion line is changed, removed or reordered in either commit (above).
  The subjects carry the change id. The bodies say why. Both end with the
  attribution trailer.
- **C-5. Recorded.** Full suite expectation: **base count + 2**. That is
  477 only on `78ee598` (475 + 2). If a pull request that adds tests (for
  example #40 GAP-12, `ServerHeaderTests.cs`) merges first, the expected total
  increases by that pull request's count. Gate 2 quotes the count against the
  actual merge base.
- **C-6. Met.** Every build and test command is NOT RUN (below), with the
  reason and the CI job. One green CI run does not show that the flake is
  gone. The 300 ms rows are the evidence that a late line is now handled.
- **C-7. Open, for whoever runs the red commit.** If `f3065c1` is ever run
  and its two 300 ms rows **pass**, then `SendAsync` does not hand back
  before the request-log line is written. In that case the cause is elsewhere,
  and the change goes back to the architect (plan R-4). That has not been
  checked, because the red commit was not run here.

## Commands run

| Command | Exit | Relevant output |
|---|---|---|
| `which dotnet` | 1 | (nothing) |
| `ls ~/.dotnet` | 2 | `ls: cannot access '/root/.dotnet': No such file or directory` |
| `which sqlcmd` | 1 | (nothing). No SQL Server tooling. |
| Assertion-line diffs (above) | 0 / 0 / 1 | No differences. `grep` finds no changed `Assert.` line. |
| `git show f3065c1 \| grep -c WaitForAsync` | 1 | `0`: the red commit has no wait |
| `sed -n '3071p;3074p;3075p;3079p;3098,3100p' job126362926149.log` | 0 | The lines quoted under C-2 |
| `git diff --stat 78ee598 HEAD -- api` | 0 | `AbortedRequestTests.cs` only |

## Commands NOT RUN

There is no .NET SDK in this Linux container (above). There is also no SQL
Server, which the `[Collection("SqlServer")]` tests need through `ApiFactory`
against `DigitalHubContent_Test`. From `api/`, in Release only:

| Command | Status | What it would show | CI proof |
|---|---|---|---|
| `dotnet build DigitalHub.slnx -c Release` (at `f3065c1` and at `2f09df7`) | **NOT RUN**, no dotnet | That both commits compile. Checked by reading only (below). | "API — Release build, migrations, integration tests", build step (fix commit only, unless O-1 is answered yes) |
| `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~AbortedRequestTests"` at `f3065c1` (red) | **NOT RUN**, no dotnet and no SQL Server | Expected 4 of 6 pass. Fails: `…disconnects_mid_body…(path: "/api/v1/auth/login", requestLogDelayMs: 300)` at the `responded 499` assertion (line 42 at `f3065c1`), and `…chunked_body…(path: "/api/v1/auth/login", requestLogDelayMs: 300)` at the `responded 400` assertion (line 65 at `f3065c1`), each with "Filter not matched in collection". C-7 applies if they pass. | None by default. CI runs this commit only if O-1 is answered yes. Otherwise the owner runs it in Release on their machine. |
| The same filter at `2f09df7` (green) | **NOT RUN**, same reason | Expected 6 of 6 pass | "API — Release build, migrations, integration tests", step "Integration tests (Release)" |
| `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` at `2f09df7` | **NOT RUN**, same reason | Expected base count + 2 (477 on `78ee598`), all passing | Same CI job and step |

On the red commit, the 499 row could also fail one line earlier, at the
"Client closed the request" assertion, if that line also lands late. Either
way the row is red without the wait.

### Checked by reading (in place of a build)

- **Language and APIs.** Primary constructors on the two private nested
  classes are C# 12 and fine on net10.0. In `LoggingFactory` the parameter is
  used only in the `Sink` initializer, and in `CollectingSink` only inside
  `Emit`. Neither is also copied to a field, so no CS9124 warning. `Sink` is
  built with target-typed `new(requestLogDelayMs)`. `ApiFactory` has no
  explicit constructor, so the implicit base call holds.
  `LogEvent.MessageTemplate.Text` is the raw template string, which Serilog's
  `RequestLoggingMiddleware` parses from `options.MessageTemplate`.
  `Thread.Sleep(int)` comes from `System.Threading`, and `Task`, `Func` and
  `TimeSpan` come from implicit usings (`ImplicitUsings` is enabled in the
  csproj). `Stopwatch` needs the added `using System.Diagnostics;`.
  `ConcurrentQueue.Any` comes from LINQ, which the existing `AtLeast`/`All`
  already use.
- **Theory data.** `[InlineData(string, int)]` matches `(string path, int
  requestLogDelayMs)` in all six rows. xUnit 2.9.3 (csproj) gives the two
  `/api/v1/auth/login` rows of each theory distinct display names through the
  second argument. The project does not enable `TreatWarningsAsErrors`.
- **Wait semantics.** The loop reads `_events`, a `ConcurrentQueue`, which is
  safe while the server thread writes to it. It ends as soon as a line
  matches, so a passing run pays nothing beyond one 10 ms poll at most. It
  returns after 5 s at worst, and then the unchanged assertion fails with the
  full collection.

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Cause confirmed: request-log line written after the snapshot | Job `126362926149` log, lines 3071–3100 | Done | Lines 3074, 3075, 3079 and 3098–3100 re-read and quoted under C-2. The 3075 line is missing from the 3079 collection. |
| Every existing assertion in `AbortedRequestTests` unchanged | P-6; owner request | Done | `Assert.` line diff against `78ee598`: exit 0 at `f3065c1` and at `2f09df7`. Seven lines, same text, same order. |
| Red: delayed request-log rows fail without the wait | P-4; plan 5.1 | Committed (`f3065c1`); run **NOT RUN** | No dotnet or SQL Server here. CI runs it only if O-1 is answered yes. C-7 applies to whoever runs it. |
| Green: all six `AbortedRequestTests` rows pass with the wait | Plan 5.2 | Committed (`2f09df7`); run **NOT RUN** | CI "API — Release build, migrations, integration tests", step "Integration tests (Release)" |
| Full API suite green in Release (base count + 2; 477 on `78ee598`) | CI "API — Release build, migrations, integration tests"; C-5 | **NOT RUN** | Same CI job, on the pull request's merge base |
| `RateLimitLogTests`, `AdminApiTests` checked and left alone | Plan 2.3; F-1 / C-3 | Done | Corrected reasoning under C-3. `git diff --stat 78ee598 HEAD -- api` lists only `AbortedRequestTests.cs`. |

## For the tester

- Diff the `Assert.` lines against `78ee598` (command above). Then check that
  `f3065c1` has no `WaitForAsync`.
- O-1 is unanswered. At gate 2 the pull request description should say "red
  step NOT RUN; O-1 unanswered" (plan-approval O-1).
- Follow-up candidate from F-1: the false-pass race in `RateLimitLogTests`
  `DoesNotContain` checks is not fixed here (B-8).

Status: READY FOR TEST
