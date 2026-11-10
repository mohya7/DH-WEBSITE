# Plan review: aborted-request-log-race

## Round 1

Plan-reviewer, 8 November 2026. Reviewed `plan.md` round 1 on
`change/aborted-request-log-race` (worktree at `78ee598`). Read:
`docs/changes/README.md` and `.claude/agents/plan-reviewer.md` (PR #37 branch, in
`/home/user/DH-WEBSITE`), `ENGINEERING_STANDARDS.md` via
`git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md` (P-4, P-6,
P-8, B-8, S-3 checked), `AGENTS.md`/`CLAUDE.md`, and the refinement plan at
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`
(`grep -ic "flak\|AbortedRequest"` prints `0`; no item covers this test). ADR 0001
and the admin audit do not apply. No earlier rounds.

### Findings

No Blockers. No Majors.

**F-1. Minor. Section 2.3, `RateLimitLogTests` row: the reasoning is wrong, but the conclusion holds.**
The plan says a late request-log line "holds only method, path, status and time".
That sink does not render only the message. `RateLimitLogTests.cs:103–109` appends
every property (`writer.Write($" {property.Key}={property.Value}")`), so a late
line would also carry `Elapsed`, `CorrelationId` (pushed through
`Enrich.FromLogContext()`, `Program.cs:30`) and any other enriched property. None
of these holds the email marker or the `wrong-` password, so the
`DoesNotContain(marker, ...)` / `DoesNotContain("wrong-", ...)` checks (`:38–39`,
`:63`) are still not affected. Those checks race in the false-pass direction, like
`AbortedRequestTests :38/:60`. The positive checks
(`Assert.Single(factory.Sink.Warnings())`, `:33`, `:59`) only count events whose
text contains "Rate limit", and `RateLimitLog.Refused` is called in `OnRejected`
(`Program.cs:117–120`) before `ProblemResults.WriteAsync` starts the response.
*To satisfy:* correct the sentence to say the late line holds the request-log
properties (method, path, status, elapsed, correlation id), none of which can
contain the marker. Leaving the file out of scope is right.

**F-2. Minor. Section 4, delay hook: the condition is looser than it needs to be.**
"`MessageTemplate.Text` starts with `"HTTP "`" relies on no other template
starting that way. Today that is true: the production template is
`"HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms"`
(`Program.cs:272`), and the hosting "Request starting HTTP/1.1" line starts
differently. A stricter condition costs nothing. *To satisfy:* match the exact
prefix `"HTTP {RequestMethod} "`, or require both `RequestPath` and `StatusCode`
properties. State that the delay is a synchronous `Thread.Sleep` inside `Emit`, so
it runs on the emitting server thread. It must not be an async hand-off, which
would let the line through. Make R-3's check say it applies only when the delay is
above zero.

**F-3. Minor. Section 2.1: the log line citation is off by a few lines.**
In the downloaded job log (`gh api repos/mohya7/DH-WEBSITE/actions/jobs/126362926149/logs`,
3,677 lines, matching the plan), the quoted excerpt runs from about line 3071
("Application started") to line 3100 ("Failed: 1"). The shield line is at 3074,
the first failure "Collection:" at 3079, and the totals at 3098–3100. The plan says
3069–3088. *To satisfy:* fix the line numbers, because the coverage table cites them
as evidence.

### Checked and found sound

- **Failure and cause (2.1).** I fetched the job log myself. Correlation id
  `50a75a15…` logs "Bad request from the client: 400" at `.8647592` and
  "HTTP POST /api/v1/auth/login responded 400 in 1.6595 ms" at `.8661045`. The
  failure's collection holds the first line but not the second. The totals are
  475 / 474 / 1. The passing contact row (`39bf4fca…`) has a 0.11 ms gap.
  `git diff --stat 78ee598 1aac1ef -- api` is empty, so PR #37 changed no API code.
- **Mechanism (2.2).** `Program.cs:270–274` puts `UseSerilogRequestLogging`
  outside `ExceptionShieldMiddleware`. The shield's 400 path logs, then
  `ProblemResults.WriteAsync`, which is `response.WriteAsync` (`ProblemResults.cs:24–34`).
  The 499 path logs "Client closed" after `DisconnectingBody` has called
  `context.Abort()` (`AbortedRequestTests.cs:123`, `ExceptionShieldMiddleware.cs:29–37`).
  Serilog is configured with `ReadFrom.Services` and has no async wrapper
  (`Program.cs:26–32`), so the collecting sink is written synchronously on the
  server thread. I cannot read the TestHost source locally either. The plan labels
  that point as cited, and R-4 gives a real stop condition if commit 1 does not go
  red.
- **"Any status" keeps every assertion's strength (design step 2–3).** The
  request-log line is the last event the inner pipeline writes for the request.
  The shield's lines and any warning from inside are written earlier on the same
  thread. Waiting for `"\"{path}\" responded "` therefore cannot pass anything
  that fails today:
  - A wrong status still produces a request-log line, and the unchanged
    `responded 400` / `responded 499` check fails on it.
  - If an exception escapes the shield, Serilog writes that line at Error level,
    so `Assert.Empty(AtLeast(Warning))` also fails.
  - The only later writer is `UseExceptionHandler` (outer), and only on that same
    failure path.
  - The two `Assert.Empty` warning checks and the "Client closed" check (`:38–39`,
    `:60`) become stricter, because today they can read the sink before late
    events arrive.
  - The predicate uses the same quoted-path rendering as the existing assertions.
- **The wait cannot hide a failure (R-2).** `WaitForAsync` does not throw and does
  not assert. On timeout the unchanged `Assert.Contains` runs on the full
  collection, so the failure message stays as useful as today.
- **The 5 s bound and polling are safe under xUnit parallelism.** The class is in
  `[Collection("SqlServer")]`, and `ApiFactory.cs:9` declares it
  `DisableParallelization = true`, so these rows run alone. Each test builds its
  own `LoggingFactory` with its own `CollectingSink` singleton, so no other test
  writes to it. The sink is a `ConcurrentQueue`, safe to read while it is written.
  Polling uses `Task.Delay(10)` and holds no thread. The 5 s bound only costs time
  on a failing run. On a passing run the wait ends as soon as the line lands.
  5 s is about 16 times the forced delay and far above the 1.35 ms gap seen in CI.
- **The forced-delay rows are a sound, permanent test.** They are not weakened
  and not slow. They add two rows of about 0.3 s each, about 0.6 s in a 475-test
  suite. The sleep runs in `Emit` on the server thread, where the real late write
  happens. It does not run on the test thread, which would only slow the test. It
  turns the race into an almost certain red without the wait (300 ms against a
  sub-millisecond hand-back), and the plan honestly calls this scheduling-
  dependent. The rows stay in the suite and fail if anyone later removes the wait.
  This is the right regression guard for a race that cannot be replayed on demand.
  The existing four rows keep a zero delay, so they still exercise the natural
  timing.
- **Scope of racy readers in `api/tests`.**
  `grep -rln "LogEvent\|ILogger<\|LoggerProvider\|Sink" api/tests` finds only
  `AbortedRequestTests.cs`, `AdminApiTests.cs` and `RateLimitLogTests.cs`;
  `api/tests` has one project. `AdminApiTests.cs:410–418` logs synchronously to a
  standalone `LoggerConfiguration` on the test thread, with no server, so there is
  no race. `RateLimitLogTests` is safe (F-1). The plan scopes the fix to one test
  file and its records (B-8), and that is correct.
- **Rejected alternatives** are real: a fixed `Task.Delay`, a signalling sink, a
  shared sink refactor, asserting after disposal, retry/skip, and a production
  change. The reasons given are correct. Rejecting retry/skip and the production
  change follows P-6 and B-8.
- **Testability (P-4, P-8).** The red commit is named precisely, with two rows and
  the expected assertion and message, and it would fail today. The green
  expectation is exact: 6 of 6 rows, and 477 in the full suite (4 rows plus 2;
  475 plus 2). The commands use Release. "No dotnet, no SQL Server" is true here:
  `which dotnet` prints nothing. Each command is marked NOT RUN, with the CI job
  "API — Release build, migrations, integration tests" named as the proof.
- **Owner decisions.** O-1, whether to push the red commit for CI, is asked and not
  assumed. The plan does not depend on the answer, so it does not block.
- **Security, migrations, rollback.** These are test-only changes: no routes,
  policies, secrets, dependencies or migrations, and no database other than
  `DigitalHubContent_Test`. Rollback is a revert, which is enough for test-only
  code.
- **Done when.** No quoted text exists, and the derived criteria follow the
  owner's "fix it" and P-6: every assertion unchanged, no ordering dependence, and
  a late-line proof. Each criterion maps to a row of the coverage table.

Verdict: APPROVED
