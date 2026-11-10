# Plan: aborted-request-log-race — read the request log only after it is written

Architect, round 1, 8 November 2026. Change branch `change/aborted-request-log-race`,
cut from `origin/rebuild/dotnet-platform` at `78ee598` (no tracking).

**Where the governing documents were read.** `docs/changes/README.md` and
`.claude/agents/architect.md` are on the PR #37 branch only and were read from
`/home/user/DH-WEBSITE`. `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md`
were read with `git show origin/claude/cool-heisenberg-mh6zx9:<path>`. The
refinement plan was read at `/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`;
it has no item for this test (`grep -i "flak\|AbortedRequest"` finds nothing).
`AGENTS.md` is in the worktree. ADR 0001 and the admin audit do not apply.

## 1. Item

- **Closes:** no refinement-plan or audit id. The owner's request, verbatim:
  "fix it" (Mohamed Elbadry, 8 November 2026, project thread), about the failure
  of API job `126362926149` (run `41765541793`, head `1aac1ef`) on PR #37.
- **Track:** none of the four track checklists fits (it is not a security
  advisory, a gate, isolation or an admin finding). The rules that apply are
  P-4 (a failing test before the fix), P-6 (never weaken a test), P-8 (evidence)
  and B-8 (one fix per pull request).
- **Done when** (no quoted text exists; derived from the owner's request and
  P-6, for the reviewer to confirm): every assertion in `AbortedRequestTests`
  stays as it is; the request-log assertions no longer depend on which thread
  finishes first; and a test proves the assertions still pass when the
  request-log line is written late.

## 2. Current state

### 2.1 The failure, from the job log

`gh api repos/mohya7/DH-WEBSITE/actions/jobs/126362926149/logs` (3,677 lines,
saved in the scratchpad). Lines 3069–3088, timestamps trimmed:

```
03:14:56.8627334  Application started. Press Ctrl+C to shut down.
03:14:56.8647592  50a75a15… Bad request from the client: 400
03:14:56.8661045  50a75a15… HTTP POST /api/v1/auth/login responded 400 in 1.6595 ms
03:14:56.8679173  Application is shutting down...
[xUnit.net 00:01:21.73] …A_chunked_body_that_ends_early_is_a_400_not_a_server_error(path: "/api/v1/auth/login") [FAIL]
      Assert.Contains() Failure: Filter not matched in collection
      Collection: ["Application started. Press Ctrl+C to shut down.", "Hosting environment: \"Testing\"",
                   "Content root path: \"/home/runner/work/DH-WEBSITE/"···, "Bad request from the client: 400"]
      …AbortedRequestTests.cs(61,0)
Total tests: 475   Passed: 474   Failed: 1
```

The request-log line **was** written, by the same request (correlation id
`50a75a15…`), but the sink snapshot the assertion took did not hold it. In this
run the gap between the shield's line and the request-log line is 1.35 ms; for
the passing contact request just before it (`39bf4fca…`) it is 0.11 ms. The
"shutting down" line is the `using var factory` disposal after the assertion
threw. `git diff --stat 78ee598 1aac1ef -- api` is empty: PR #37 changed no API
code, so this is timing, not a regression. The hypothesis in the change context
is confirmed by the log.

### 2.2 Why the line can land after `SendAsync` returns

- `api/src/DigitalHub.Api/Program.cs:270–274`: `app.UseSerilogRequestLogging(...)`
  wraps `ExceptionShieldMiddleware` (`Program.cs:274`). Serilog's
  `RequestLoggingMiddleware` writes its "HTTP {RequestMethod} {RequestPath}
  responded {StatusCode}" line only **after** `await _next(context)` returns, so
  after the shield has finished.
- `api/src/DigitalHub.Api/Infrastructure/ExceptionShieldMiddleware.cs:43–65`:
  for the 400 case the shield logs "Bad request from the client", sets the
  status and calls `ProblemResults.WriteAsync`, which is `response.WriteAsync(json)`
  (`ProblemResults.cs:24–34`). That write starts the response.
- `Microsoft.AspNetCore.TestHost` (via `Microsoft.AspNetCore.Mvc.Testing` 10.0.12,
  `tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj:15`): `TestServer.SendAsync(Action<HttpContext>)`
  completes its task when the response starts (the first body write or flush
  hands the context back, in `HttpContextBuilder`), not when the middleware
  pipeline has unwound. Its continuation runs asynchronously, on another
  thread. The TestHost source is not vendored in this repository and there is
  no NuGet cache in the container, so this point is cited from the ASP.NET Core
  source (`src/Hosting/TestHost/src/HttpContextBuilder.cs`), not from a local
  file; the job log in 2.1 is the local evidence that it happens.
- So after the shield's write, two threads race: the test thread resumes and
  reads `factory.Sink.All()` (`AbortedRequestTests.cs:60–61`), while the server
  thread returns from the shield into Serilog's middleware and emits the
  request-log line. Serilog sinks are synchronous on the emitting thread, so
  the line reaches `CollectingSink` only when the server thread gets there.
- The 499 case (`AbortedRequestTests.cs:25–41`) has the same shape and an
  earlier hand-back: `DisconnectingBody` calls `context.Abort()` (`:123`), which
  fails the client's `SendAsync` immediately. The shield's "Client closed the
  request" line (`ExceptionShieldMiddleware.cs:34`) **and** the request-log
  "responded 499" line are both written after that, so the assertions at
  `:39` and `:40` both race. It passed in this run (log lines 3062–3063).
- The negative assertions `Assert.Empty(factory.Sink.AtLeast(Warning))`
  (`:38` and `:60`) race too, in the harmless-looking direction: a warning
  written late would be missed and the test would pass falsely.

### 2.3 The other `CollectingSink` users

`grep -rln CollectingSink api` finds three private copies:

| File | How it is used | Races? |
| --- | --- | --- |
| `AbortedRequestTests.cs:144–158` | Registered as an `ILogEventSink` service; read right after `SendAsync` | Yes (2.2) |
| `RateLimitLogTests.cs:99–118` | Same registration. Asserts on the rate-limit Warning | No for the positive assertions: `RateLimitLog.Refused` is called in `OnRejected` (`Program.cs:117–120`) **before** `ProblemResults.WriteAsync` starts the response. A late request-log line holds only method, path, status and time, never the email or message, so the `DoesNotContain(marker, ...)` checks are not affected by it. |
| `AdminApiTests.cs:410–418, 799–817` | A standalone `LoggerConfiguration().WriteTo.Sink(sink)` logger, written to synchronously in the test; no server involved | No |

So the race is confined to `AbortedRequestTests.cs`.

### 2.4 Tools in this container

`which dotnet` prints nothing; `~/.dotnet` does not exist. There is no SQL
Server. The API tests cannot be built or run here.

## 3. Design

Keep every assertion. Change only **when** the sink is read: before the
assertions, wait (bounded) until the request-log line for this request is in
the sink, then run the existing assertions unchanged.

1. Add to `AbortedRequestTests.CollectingSink` one method:
   `Task WaitForAsync(Func<string, bool> match, TimeSpan timeout)`. It polls
   `All()` every 10 ms until a line matches or the timeout passes, then returns
   (it does not throw; the assertions that follow report the failure with the
   full collection, as today).
2. In both tests, right after `SendAsync` (and the status assertion), call
   `await factory.Sink.WaitForAsync(line => line.Contains($"\"{path}\" responded ", StringComparison.Ordinal), TimeSpan.FromSeconds(5))`.
   It waits for the request-log line **with any status**, not the expected one,
   so a wrong status (a 500) still arrives and still fails the unchanged
   `responded 400` / `responded 499` assertion with the real line visible.
3. Then run the existing assertions in their current order and text: `:38–40`
   and `:59–61`. Because the request-log line is the last thing the pipeline
   writes for the request, and the shield's line and any warning are written
   earlier on the same thread, waiting for it also closes the race on the
   "Client closed" line (`:39`) and on the `Assert.Empty` warning checks
   (`:38`, `:60`), which become stricter, not weaker.

**Rejected alternatives**

- *A fixed `Task.Delay` before the assertions*: still a race, only rarer, and
  slows every run by the full delay.
- *A sink that signals (a `TaskCompletionSource` completed from `Emit`)*:
  correct, but more code (registration, locking, a predicate per waiter) for
  the same result as a 10 ms bounded poll in a test-only class.
- *A shared helper or a shared `CollectingSink` for all three files*: only one
  file races (2.3); merging the three copies is a refactor, not this fix (B-8).
- *Disposing the factory before asserting*: relies on host shutdown waiting for
  an in-flight TestServer request, which TestHost does not promise, and reads
  the sink after disposal.
- *Retrying the test or marking it skipped/flaky*: weakens it (P-6).
- *Moving the request log or the response write in production code*: a
  behaviour change for a test-timing problem; not needed.

## 4. Scope

Change:

- `api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs` only:
  - `CollectingSink`: add `WaitForAsync` (step 1), and an optional
    request-log delay used by the regression rows below: when set, `Emit` sleeps
    for that time before enqueueing an event whose `MessageTemplate.Text`
    starts with `"HTTP "`. It runs on the server thread, as the real late write
    does.
  - `LoggingFactory`: a constructor parameter for that delay (default zero).
  - Both theories: a second parameter `int requestLogDelayMs`; the existing
    rows get `0`; one new row each, `("/api/v1/auth/login", 300)`.
  - Both theories: the `WaitForAsync` call (step 2). No assertion is changed,
    removed or reordered.
- `docs/changes/aborted-request-log-race/*` (records).

Out of scope, deliberately left alone:

- `RateLimitLogTests.cs` and `AdminApiTests.cs` (2.3: no race).
- Merging the three private `CollectingSink` classes.
- `Program.cs`, `ExceptionShieldMiddleware.cs`, Serilog configuration.
- `.github/workflows/ci.yml`.

## 5. Test plan

### 5.1 Failing first, and what can honestly be shown

**The original race cannot be reproduced on demand.** It depends on thread
scheduling on a busy CI runner; it failed once in job `126362926149` and passed
on the re-run, on PR #38 and on the base. No local or CI run can be made to hit
it deterministically without changing the timing.

What can be made deterministic is a forced late write. Commit 1 (red) adds the
delay plumbing and the two `requestLogDelayMs: 300` rows **without**
`WaitForAsync`:

- `A_client_that_disconnects_mid_body_is_not_a_server_error(path: "/api/v1/auth/login", requestLogDelayMs: 300)`
  — expected to fail at the `responded 499` assertion with "Filter not matched".
- `A_chunked_body_that_ends_early_is_a_400_not_a_server_error(path: "/api/v1/auth/login", requestLogDelayMs: 300)`
  — expected to fail at the `responded 400` assertion with "Filter not matched".

The 300 ms sleep happens on the server thread after the client has its
answer, so the test thread reads the sink first unless the thread pool stalls
for more than 300 ms; in practice that is a reliable red, though strictly it is
scheduling-dependent too. Commit 2 adds `WaitForAsync` and the two calls; all
six rows must then pass.

**NOT RUN locally, for both commits:** there is no `dotnet` and no SQL Server in
this container (2.4). The red commit can only be shown failing by a CI run of
that commit (see O-1); the green commit is proven by the pull request's CI job
**"API — Release build, migrations, integration tests"** (`ci.yml`, step
"Integration tests (Release)"). A single green CI run does not prove the flake
is gone; the delayed rows are the evidence that a late line is now handled.

### 5.2 Commands (on a machine with .NET 10 and SQL Server, Release only)

From `api/`:

```
dotnet build DigitalHub.slnx -c Release
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~AbortedRequestTests"
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build
```

Expected: after commit 1, 2 of 6 `AbortedRequestTests` rows fail as described;
after commit 2, 6 of 6 pass and the full suite is 477 of 477 (475 today plus
two rows). Against `DigitalHubContent_Test` only.

In this container the developer records each as NOT RUN with the reason, and
quotes the CI job's result once the orchestrator's pull request runs.

### 5.3 Track checklist

No track checklist applies (section 1). General checks from
`docs/changes/README.md`: no assertion weakened (P-6, the reviewer diffs the
assertion lines); one fix in one file (B-8); evidence or NOT RUN for every
check (P-8); tests in Release.

## 6. Security impact

None. Test code only: no route, policy, data, login, secret or dependency
changes. The production request-logging and shield behaviour is untouched.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request.

## 9. Owner decisions needed

- **O-1:** "Do you want the red commit (the two delayed rows, without the
  fix) pushed and run in CI on its own before the fix commit is pushed, so the
  failing-first step is shown by CI rather than recorded as NOT RUN?" The
  orchestrator does not push without this. The plan does not depend on the
  answer: without it, the red step is recorded NOT RUN with the reason.

## 10. Risks

- **R-1: the 300 ms rows are slow or flaky themselves.** They add about 0.6 s.
  With the wait (5 s bound, 10 ms poll) they pass whenever the line arrives
  within 5 s; the bound is 16 times the delay.
- **R-2: the wait hides a missing line.** It does not throw and does not pass
  anything: after at most 5 s the unchanged `Assert.Contains` runs and fails
  with the collection, as today. A wrong status is still caught (design step 2).
- **R-3: the delay hook leaks into the other rows.** Default zero; the existing
  rows pass `0`, and the reviewer checks the sink only sleeps for
  `"HTTP "`-template events when the delay is above zero.
- **R-4: the TestHost behaviour in 2.2 is cited, not read locally.** If
  `SendAsync` waited for the pipeline, the red rows would pass in commit 1;
  that outcome would show the cause is elsewhere and the developer stops and
  sends the change back (README "Loops").

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Cause confirmed: request-log line written after the snapshot | Job `126362926149` log, lines 3069–3088 | Planned | |
| Every existing assertion in `AbortedRequestTests` unchanged | P-6; owner request | Planned | |
| Red: delayed request-log rows fail without the wait | P-4; section 5.1 | Planned | |
| Green: all six `AbortedRequestTests` rows pass with the wait | Section 5.2 | Planned | |
| Full API suite green in Release | CI "API — Release build, migrations, integration tests" | Planned | |
| `RateLimitLogTests`, `AdminApiTests` checked and left alone | Section 2.3 | Planned | |

## 12. Revision log

- Round 1 (8 November 2026): first version; no review yet.
