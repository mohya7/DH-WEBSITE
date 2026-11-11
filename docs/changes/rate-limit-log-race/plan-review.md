# rate-limit-log-race: plan review

## Round 1

Reviewer: plan-reviewer, 9 November 2026. Plan reviewed:
`docs/changes/rate-limit-log-race/plan.md`, round 1, on `change/rate-limit-log-race`
at `78ee598`, with no code change.

**Summary.** I tried to refute the conclusion and could not. The race exists, but
the only events that reach `CollectingSink` after the negative checks read it are
the last request's request-log line and the shutdown line, and neither one carries
request data. I confirmed this by reading the code and then by running the tests,
which the plan said could not be done. The plan's evidence still has two wrong
statements that a record meant to close FU-2 "on evidence" (P-8) cannot keep. One
is a check it presents as verified. The other is an incomplete list of log
sources. Neither changes the conclusion. Both need correcting in the text.

### Findings

**F-1. Major. Section 2.5 (and 5 "Suites", 11). The claim "They cannot pass
without SQL Server" is false. It is presented as checked ("the reason is not an
assumption").**

- *What is wrong.* The plan argues that database calls throw and the shield turns
  them into 500s, so the tests cannot pass. The first half is right. The
  conclusion does not follow from it. Neither test checks the status of the
  earlier responses. `LoginThrottle.TryAttempt` takes a permit before the
  database is reached (`LoginThrottle.cs`, `TryAttempt`). The `public-contact`
  limiter counts the permit whatever the endpoint returns. So the ninth login and
  the eleventh contact still get a 429 and a rate-limit warning. The change
  context said this "must be checked, not assumed". The plan reasoned about it
  and reached the wrong answer, then wrote NOT RUN for a run that was possible.
- *Evidence.* I built a copy of `78ee598`'s `api/` (from `git archive`) in the
  session scratchpad, so the worktree was not touched. I ran it in Release with
  `ConnectionStrings__Content=Server=tcp:127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=x;Encrypt=False;Connect Timeout=2`
  and `HOME` set to a fresh scratchpad folder:
  `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~RateLimitLogTests"`.
  It exited 0 with `Passed: 5` out of `Total tests: 5`, in about 3 s. Every
  non-429 response was a 500. The DataProtection key folder I created was
  deleted afterwards.
- *Why it matters beyond accuracy.* The plan rests its conclusion on reading the
  code plus one CI console log. A local run makes a direct check cheap. I added
  a probe to the scratch copy only (not the worktree). After the existing
  assertions it saved `Sink.All()`, disposed the factory, and saved `Sink.All()`
  again. The two snapshots differed by exactly one event in each test:
  `Application is shutting down... SourceContext="Microsoft.Hosting.Lifetime"`
  (login 37 → 38 events, contact 46 → 47). This is stronger evidence for 2.4
  than the console log, because it shows the properties the sink records and
  the console does not print.
- *What would satisfy me.* Correct 2.5 to say the tests do pass without SQL
  Server, through the 500 path. Record the run, or an equivalent run by the
  architect, as evidence in 2.3 and 5. Say plainly that the run covers the 500
  path and not the 401 and 201 path, which only CI job `API` covers. That last
  part stays NOT RUN.

**F-2. Major. Section 2.2, "Nothing else in the request path logs", and 10,
"Risks". The list of log sources is incomplete. Two of the missing sources do
record request-derived or exception text in properties that `CollectingSink`
keeps.**

The task was to list every log call that a request to these two routes can
reach. These are missing:

- *EF Core's own Error events.* `Microsoft.EntityFrameworkCore` is set to
  Warning, which still lets Error through. On a database failure EF writes
  `Microsoft.EntityFrameworkCore.Database.Connection`, `…Query` ("An exception
  occurred while iterating over the results of a query") and `…Update` ("An
  exception occurred in the database while saving changes"). The `…Update` and
  `…Query` events carry the whole exception's `ToString()` as a *property*
  (`error`), and `CollectingSink.Emit` writes every property. I saw the full
  `SqlException` text and stack in the sink in the probe run. This contradicts
  the plan's line "`CollectingSink` does not record the exception object
  either". That is true of `LogEvent.Exception`, but not of EF's property. With a
  real server, SQL Server messages such as 2628 (truncation, "Truncated value:
  '…'") and 2627 (duplicate key, "The duplicate key value is (…)") quote column
  values, so request data could reach the sink this way. These events are
  written inside `SaveChangesAsync` and `FindByEmailAsync`, before the response
  starts. So they do not race, and the conclusion stands. The list must still
  name them.
- *Data Protection.* `Microsoft.AspNetCore.DataProtection.KeyManagement.XmlKeyManager`
  writes `No XML encryptor configured. Key {…}` at Warning when a fresh profile
  makes its first key (this is FU-1). It reached this test's sink in the probe
  run. It holds a key id and no request data, and `Warnings()` filters on
  "Rate limit", so the `Assert.Single` checks are not affected. It is still a
  source the plan says does not exist.
- *Properties on the request-log line.* 2.2 says "The only other property is
  `CorrelationId`". The sink actually recorded `SourceContext` and `RequestId`
  as well (for example `RequestId="0HNPU88GT1PJD"`). The rate-limit warning
  also carries `ActionId`, `ActionName`, `RequestId` and `RequestPath` from the
  ASP.NET Core scopes. None of these comes from the body, so the conclusion is
  unchanged, but the sentence is wrong as written.

Section 10 says the CI event list is the cross-check against a missed source.
That list comes from the happy path only, at Information and above. It cannot
show exception-path sources, and the console template prints no properties. So
it cannot back up claims about property values.

- *What would satisfy me.* Add the three items above to 2.2. For each one, say
  when it is written relative to the response. EF and Data Protection are written
  before the response, or at host start, so they do not race. Fix the
  `CorrelationId` sentence. Narrow the claim in 10 to what the CI log can show,
  and point to the probe run (F-1) for the property-level check.

**F-3. Minor. Section 2.2, middleware order.** The plan says
`CorrelationIdMiddleware` comes first, then `UseSerilogRequestLogging`, then the
shield. `Program.cs:266–274` actually runs `UseForwardedHeaders` (only when proxies
are configured), `CorrelationIdMiddleware`, `SecurityHeadersMiddleware`,
`UseExceptionHandler`, `UseSerilogRequestLogging`, then `ExceptionShieldMiddleware`.
This matters a little. `UseExceptionHandler` sits *outside* the request logger. So
an exception that gets past the shield (only once the response has started) is
logged by `UnhandledExceptionHandler` and ASP.NET Core's diagnostics *after* the
request-log line, and it can land after `SendAsync` returns. Those events hold
the type name, or put the exception in `LogEvent.Exception`, which the sink does
not render. So nothing checkable is lost. A list of "late" lines should still
name them. *Satisfied by:* correct the order and add this case to the late-line
list.

**F-4. Minor. Section 2.3, provenance of the CI log.** The plan does not say which
commit `job126362926149.log` tested. The log shows it checked out
`refs/remotes/pull/37/merge` (`f1aba7364ee7d6b0cbd38c14e26fefb8fcdcb6c3`), not
`78ee598`. I confirmed that `git diff --stat f96d719 78ee598 -- api` is empty, and
that PR #37's branch (`origin/claude/cool-heisenberg-mh6zx9`) does not differ from
`78ee598` in `api/src`, `RateLimitLogTests.cs` or `ApiFactory.cs`. So the evidence
does apply. *Satisfied by:* one sentence giving the run's commit and why it is
equivalent for `api/`.

### Checked and sound

- **The checks the plan says I can repeat.**
  - Check 1 (`grep … Controllers/*.cs`) prints nothing.
  - Check 2 (`EnrichDiagnosticContext|IDiagnosticContext|EnableSensitiveDataLogging|LogTo(`)
    prints nothing.
  - Check 3 (`strings -el` on `serilog.aspnetcore/10.0.0`) prints exactly
    `Elapsed`, `RequestMethod`, `RequestPath` and `StatusCode`. The only message
    template in the DLL is the one the app overrides.
  - Check 4: CI log lines 908–943 match 2.3.
  - Check 5 (`git diff --stat 78ee598 HEAD -- api`) is empty.
- **When each event is written.**
  - The login warning is written in the action before the 429 result is returned
    (`AuthController.cs:32–35`). The contact warning is written in `OnRejected`
    before `ProblemResults.WriteAsync` (`Program.cs:117–131`). So lines 33, 37 and
    59 do not race.
  - Neither path has `Response.OnCompleted`, `Task.Run`, a `BackgroundService` or a
    channel. A grep for `OnCompleted|Task.Run|BackgroundService|IHostedService|Channel<|ThreadPool|ContinueWith`
    finds only `IdentitySeeder`, which runs at start.
  - `AuthController`, `PublicContactController` and `PublicContactStore` have no
    logger. Model binding and validation log only at Debug, under
    `Microsoft.AspNetCore`, which is held at Warning.
  - `CorrelationIdMiddleware` pushes only `CorrelationId`.
    `SensitiveDestructuringPolicy` only affects destructured objects. No app code
    calls it on these paths.
  - The shield's three log calls are all in `catch` blocks and carry no body data.
- **Which lines could be missed.** The claim that the last request's request-log
  line and the shutdown line are the only per-request or host lines that can
  land after the read holds. The exception-path addition in F-3 is harmless. The
  probe run showed only the shutdown line arriving after the read. In that run
  the last request-log line had already landed.
- **Parallelism and the static logger.** `SqlServer` is
  `DisableParallelization = true` (`ApiFactory.cs:9`), and the three classes
  outside it build no factory. So no other host writes into this factory's
  Serilog pipeline while the test runs. Request-log lines did reach the sink in
  the probe run.
- **The residual point in 2.4.** It is stated as a margin, not a happens-before
  guarantee, which is honest. It is correctly left out of scope.
- **Design and alternatives.** The plan rejects waiting for the terminal line,
  disposing first, and a meta-test. All three are real alternatives. The P-4
  argument holds: under the current code no delay can make 38, 39 or 63 wrongly
  pass, so there is no honest red step.
- **Scope, security, migrations, owner.** B-8 holds: one topic, no files beyond the
  record. `AbortedRequestTests.cs` (PR #46) is not touched. No route, policy,
  secret, dependency or migration is involved. No owner decision is needed.
- **"Done when".** The refinement plan has no text for this item. A grep for
  `rate|N9|race` matches only unrelated rows, for example "separated", "generated"
  and "migrate". The criterion taken from the task is quoted correctly.

**Round 1 verdict:** changes needed (superseded by Round 2 below).

## Round 2

Reviewer: plan-reviewer, 9 November 2026. Plan reviewed:
`plan.md` round 2, with the revision log in section 12. The plan still makes no
code change. I checked each answer myself rather than taking it from the text.

### Round 1 findings

- **F-1, closed.** The architect's re-run is real.
  - `$S/arch-rlr-run1.log` exists (09:19 UTC), and reports `Total tests: 5` and
    `Passed: 5`.
  - `grep -oE "responded [0-9]+" | sort | uniq -c` gives `2 responded 429` and
    `18 responded 500`. That is 8 login and 10 contact attempts, as claimed.
  - `grep -c "XmlKeyManager\|No XML encryptor"` gives `1`.
  - `$S/home-arch-rlr` now holds only `.` and `..`, so the `.aspnet` folder was
    deleted.
  - The run also matches my own Round 1 run.
  - Section 2.5 withdraws the wrong claim. Sections 2.5, 5 and 11 keep the 401
    and 201 path as NOT RUN, with CI job `API` named, as P-8 requires.
- **F-2, closed.** The EF `error` reasoning is right.
  - Both dumps carry ` error="Microsoft.Data.SqlClient.SqlException (0x80131904): …`
    as a property: 16 times in `rlr-dump.login` (from `…Query`) and 20 times in
    `rlr-dump.contact` (from `…Update`). The `…Database.Connection` events carry
    `database` and `server` instead.
  - The same text is also in the rendered message, because the EF template
    ends in `{newline}{error}`. The plan says "property". Both are true, and
    either way the sink keeps it. The conclusion does not depend on which.
  - The plan's argument holds. These events are written while the action awaits
    the database, before the shield or MVC writes the response. So they are in
    the sink at the read, and a marker in them would be a true failure, not a
    false pass.
  - The property lists in the 2.2 table match the dumps: request-log line,
    rate-limit warning, Data Protection.
  - Section 10 now limits the CI log to what it can show.
  - Leaving the question of whether EF's `error` property belongs in the logs
    out of scope is correct under B-8.
- **F-3, closed.**
  - `Program.cs:265–274` has exactly the order the plan gives.
  - The shield rethrows at `ExceptionShieldMiddleware.cs:74–76` when the
    response has started.
  - On `UnhandledExceptionHandler`, the architect's correction of my Round 1
    text is right. Once the response has started, ASP.NET Core's
    `ExceptionHandlerMiddleware` logs that the handler will not run and
    rethrows. It does not call `IExceptionHandler`. I withdraw that part of
    Round 1 F-3.
  - The late-line list in 2.2 and 2.4 now names the post-start exception case.
    It correctly says the sink does not record `LogEvent.Exception`.
- **F-4, closed.**
  - `sed -n 187p job126362926149.log` reads
    `HEAD is now at f1aba73 Merge 1aac1ef5f3a23044a465632a1f1ded1b695af38f into f96d719f1aa76b1d1198765f055a81e6bb56a5c0`.
  - `git diff --stat 78ee598 1aac1ef -- api` and
    `git diff --stat f96d719 78ee598 -- api` both print nothing.
  - `origin/claude/cool-heisenberg-mh6zx9` is at `d1cb4c9`, as stated.

### New finding

**R2-1. Minor. Section 2.2, the Data Protection row: when it is written.** The row
says the warning is written "during the first request that needs one … before the
response". The runs show it is written at host start, before any request:

- In `$S/arch-rlr-run1.log`, the warning is line 10 (09:19:00.5297). That is
  before `Application started` on line 11 (09:19:00.5767) and before the first
  request line, line 65.
- The warning has no `CorrelationId`. The console shows an empty field, and the
  dump has no `CorrelationId=` or `RequestId=` on it. `CorrelationIdMiddleware`
  pushes `CorrelationId` for every request, so this event was not written
  inside one.
- `$S/rlr-review-run1.log` shows the same order, lines 10 and 11.

The "Late? No" answer and the conclusion are unaffected: an event written before
the first request is in the sink at the read. *Satisfied by:* rewording the row
to "at host start, the first time a fresh profile creates a key". This can be
done in the next revision, or by the developer when the record is committed. It
does not block.

### Checked again and sound

- The conclusion in 2.4 follows from the 2.2 table. The only post-read events are
  the last request-log line, the shutdown line, and post-start exception
  diagnostics, which these tests do not reach. None of them records body data.
  The one source that can carry request data, EF's `error`, is written before
  the response.
- My probe shows the same: the snapshots before and after dispose differ only by
  the shutdown line, in both tests.
- Nothing has changed in the design, the rejected alternatives, the P-4 argument,
  the scope (`AbortedRequestTests.cs` untouched, FU-1 left to its own plan),
  security, migrations, rollback or owner decisions. All of these were sound in
  Round 1.
- `git status` in the worktree shows only the untracked records folder. Nothing in
  `api/` changed.

No Blocker. No Major.

Verdict: APPROVED
