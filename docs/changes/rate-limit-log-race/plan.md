# rate-limit-log-race: plan

Change id: `rate-limit-log-race` (follow-up FU-2 of `aborted-request-log-race`).
Branch: `change/rate-limit-log-race`, cut from `origin/rebuild/dotnet-platform`
at `78ee598`. Architect, round 2, 9 November 2026. Round 1 came back CHANGES
NEEDED (`plan-review.md` Round 1). Every point is answered in section 12.

**Outcome of the investigation: the false pass is not real. This plan makes no
code change.** It records the finding so FU-2 can be closed on evidence.

## 1. Item

- **Closes:** FU-2 from `aborted-request-log-race/delivery-approval.md`:
  "The `DoesNotContain` checks in `RateLimitLogTests` read the sink right after
  the response. They race in the false-pass direction. This change does not fix
  that." First raised as gate-1 finding F-1, written up in that change's
  `implementation.md` C-3.
- **Owner's request:** "PUSH and continue" (Mohamed Elbadry, 9 November 2026,
  project thread), given after being told of the two follow-ups.
- **Track:** none of the four track checklists in `docs/changes/README.md` fits.
  This is not a security advisory, a gate, isolation work or an admin finding.
  The rules that apply are P-4 (a failing test before a fix), P-6 (never weaken a
  test), P-8 (evidence) and B-8 (one topic).
- **Done when:** the refinement plan has no text for this item. A grep for
  `rate|N9|race` matches only unrelated words. The criterion below comes from the
  task, and the reviewer confirmed it was quoted correctly: *either* show that no
  log line written after `SendAsync` returns can contain what a negative check
  looks for, and make no change; *or* make the negative checks wait for the
  request's terminal log line, with a failing-first step.

Required reading:

- `AGENTS.md`, in the worktree.
- `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md`, read with
  `git show origin/claude/cool-heisenberg-mh6zx9:<path>`.
- The refinement plan, at `/mnt/project-files/...`.
- `docs/changes/README.md`, from the PR #37 branch, read at
  `/home/user/DH-WEBSITE/docs/changes/README.md`.

All of them were present.

## 2. Current state

### 2.1 The negative checks and what each one is meant to exclude

`api/tests/DigitalHub.Api.Tests/RateLimitLogTests.cs` at `78ee598`:

| Line | Check | Reads | Meant to exclude |
| --- | --- | --- | --- |
| 33 | `Assert.Single(warnings)` | Warning events whose text has "Rate limit" | a second rate-limit warning (a count, so partly negative) |
| 37 | `DoesNotContain("203.0.113.20", line)` | the single warning line only | the full client address in the warning |
| 38 | `DoesNotContain(marker, Sink.All())`, ignoring case | every collected event | the login email, in any log line |
| 39 | `DoesNotContain("wrong-", Sink.All())` | every collected event | the login password, in any log line |
| 59 | `Assert.Single(Sink.Warnings())` | as line 33 | as line 33, for contact |
| 63 | `DoesNotContain(marker, Sink.All())` | every collected event | the contact name, email and message, in any log line |

`CollectingSink.Emit` (`:103–110`) records two things for each event: the
rendered message, then every property as ` key=value`. It does not record
`LogEvent.Exception`. A property value that carried request data would be seen,
not only the message text.

### 2.2 Every log source these requests can reach, and when each one writes

**Middleware order.** Round 1 had this wrong. `Program.cs:265–274` runs:

1. `UseForwardedHeaders`, only when proxies are configured. It is off in the
   tests.
2. `CorrelationIdMiddleware`.
3. `SecurityHeadersMiddleware`.
4. `UseExceptionHandler`.
5. `UseSerilogRequestLogging` (`:270–273`).
6. `ExceptionShieldMiddleware`, then the rest.

Serilog's request-logging middleware writes its line after `await _next` returns.
That can be after `TestServer.SendAsync` has handed the response back, as shown
in `aborted-request-log-race/plan.md` 2.2.

The table lists every source. "Late?" says whether the event can reach the sink
after the test's read.

| Source | Written | Late? | What it records that could matter |
| --- | --- | --- | --- |
| `DigitalHub.Api.RateLimit` warning (`RateLimitLog.Refused`) | Login: in the action, before the 429 result returns (`AuthController.cs:32–35`). Contact: in `OnRejected`, before `ProblemResults.WriteAsync` (`Program.cs:117–131`) | No | Properties `Limit`, `Method`, `Path`, `ClientNetwork` and `SourceContext`. ASP.NET Core scopes add `ActionId`, `ActionName`, `RequestId` and `RequestPath`; Serilog's log context adds `CorrelationId`. None comes from the body. |
| EF Core Error events (`Microsoft.EntityFrameworkCore.Database.Connection`, `…Query`, `…Update`) | Inside `FindByEmailAsync`, `AuditAsync` and `SaveChangesAsync`, while the action runs, before the response starts | No | `…Query` and `…Update` carry the whole exception's `ToString()` as the **property** `error`, which the sink records. With a real server, some SQL Server messages quote column values, for example 2628 ("Truncated value: '…'") and 2627 ("The duplicate key value is (…)"). So request data *can* reach the sink this way. `Microsoft.EntityFrameworkCore` is held at Warning (`appsettings.json:7`), and that still lets Error through. |
| Data Protection `XmlKeyManager` ("No XML encryptor configured. Key {…}") | Warning, the first time a fresh profile creates a key, during the first request that needs one (this is FU-1) | No, for this purpose: it is written during a request, before the response | Properties `KeyId`, `EventId` and `SourceContext`. No request data. `Warnings()` keeps only events with "Rate limit", so lines 33 and 59 do not count it. |
| Shield's `LogError("Unhandled {ExceptionType}")` (`ExceptionShieldMiddleware.cs:79`) | In the shield's `catch`, before it writes the 500 | No | The type name only. |
| Serilog request-log line | After the inner pipeline returns: possibly after `SendAsync` hands back | **Yes** | Properties `RequestMethod`, `RequestPath`, `StatusCode`, `Elapsed`, `SourceContext`, `CorrelationId` and `RequestId`. `CorrelationId` is a fresh GUID, because the test sends no header (`CorrelationIdMiddleware.cs:18`). `RequestId` is the connection-derived id, for example `0HNPU88GT1PJD`. `RequestPath` has no query string. None comes from the body. |
| An exception that escapes the shield after the response has started (`ExceptionShieldMiddleware.cs:73–76` rethrows) | The request-log line at Error, then the diagnostics in `UseExceptionHandler` (including the response-already-started warning), all outside the request logger | **Yes** | The exception is in `LogEvent.Exception`, which the sink does not record. Not reached in these tests: every response is written whole by `ProblemResults` or MVC. |
| Host lifetime (`Microsoft.Hosting.Lifetime`) | "Application started", "Hosting environment" and "Content root path" before the first request. "Application is shutting down" at `using var factory` disposal | Shutdown: **yes** | The content root path and the environment name. |

Nothing else in these paths logs:

- `grep -n "LogInformation\|LogWarning" api/src/DigitalHub.Api/Controllers/*.cs`
  prints nothing.
- `AuthController`, `PublicContactController` and `PublicContactStore` have no
  logger.
- The email goes to the audit table, through `AuditAsync` (`:49`, `:55`), not to
  a log.
- There is no `Task.Run`, `OnCompleted` or background work on these paths. The
  reviewer's grep for
  `OnCompleted|Task.Run|BackgroundService|IHostedService|Channel<|ThreadPool|ContinueWith`
  finds only `IdentitySeeder`, which runs at start.
- No diagnostic-context enricher and no sensitive-data logging are configured:
  `grep -rn "EnrichDiagnosticContext\|IDiagnosticContext\|EnableSensitiveDataLogging\|LogTo(" api/src`
  prints nothing.
- Serilog.AspNetCore 10.0.0 adds only the four template properties.
  `strings -el …/serilog.aspnetcore/10.0.0/lib/net10.0/Serilog.AspNetCore.dll | grep -E "^(Request|Status|Elapsed|Http|Query)" | sort -u`
  prints `Elapsed`, `RequestMethod`, `RequestPath` and `StatusCode`.

The EF row is the only source that can carry request data. Its events are
written while the action awaits the database, before the response, so they are
in the sink when the read happens. If one of them carried the marker, lines 38,
39 or 63 would fail. That would be a true failure, not a false pass.

### 2.3 Evidence: the CI log and a local run

**CI happy path (201 and 401).** The API job log `job126362926149.log` is from
run 41765541793 and is saved in the scratchpad.

Which commit it tested (round 1 did not say):

- Log line 187 reads
  `HEAD is now at f1aba73 Merge 1aac1ef5f3a23044a465632a1f1ded1b695af38f into f96d719f1aa76b1d1198765f055a81e6bb56a5c0`.
  So the job tested PR #37's merge ref, not `78ee598`.
- The run is equivalent for `api/`. Both of these diffs print nothing:
  - `git diff --stat f96d719 78ee598 -- api`
  - `git diff --stat 78ee598 1aac1ef -- api`
- The current PR #37 head is `d1cb4c9`.
  `git diff --stat 78ee598 origin/claude/cool-heisenberg-mh6zx9 -- api/src api/tests/DigitalHub.Api.Tests/RateLimitLogTests.cs api/tests/DigitalHub.Api.Tests/ApiFactory.cs`
  also prints nothing.

The console and `CollectingSink` hang off the same Serilog logger
(`Program.cs:26–32`). The console template prints the message only, not the
properties. Login test, lines 908–926, trimmed:

```
INF  Application started. / Hosting environment: Testing / Content root path: …
INF 950847d7… HTTP POST /api/v1/auth/login responded 401 in 83.1721 ms
… seven more "responded 401" lines, 74–135 ms apart …
WRN ce63000f… Rate limit login refused POST /api/v1/auth/login from 203.0.113.0/24
INF ce63000f… HTTP POST /api/v1/auth/login responded 429 in 1.0428 ms
INF  Application is shutting down...
```

The contact test, lines 927–943, has the same shape: ten "responded 201" lines
about 3 ms apart, then the warning, then "responded 429 in 0.2370 ms", then
shutdown. This log shows which events the happy path writes, at Information and
above. It cannot show the exception path or property values.

**Local run (500 path).** Round 1 said this could not run. It can. The command,
run by the architect, round 2:

```
# scratchpad copy of 78ee598's api/ (git archive), so the worktree is untouched
git -C /home/user/dh-change-rl-race archive 78ee598 api | tar -x -C $S/arch-rlr
cd $S/arch-rlr/api
dotnet build tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release        # exit 0, 0 Error(s)
HOME=$S/home-arch-rlr \
ConnectionStrings__Content='Server=tcp:127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=x;Encrypt=False;Connect Timeout=2' \
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~RateLimitLogTests" --logger "console;verbosity=normal"
```

Here `$S` is the session scratchpad, the SDK is 10.0.114 (`dn.sh`), and
`$S/home-arch-rlr` was a fresh empty folder. The full output is in
`$S/arch-rlr-run1.log`. Result:

```
exit 0
Passed …A_refused_contact_submission_logs_a_warning_without_the_message [3 s]
Passed …The_network_drops_the_host_part(×3)
Passed …A_refused_login_logs_a_warning_without_the_email_or_full_address [565 ms]
Total tests: 5   Passed: 5
grep -oE "responded [0-9]+" | sort | uniq -c  →  2 responded 429, 18 responded 500
grep -c "XmlKeyManager\|No XML encryptor"      →  1
```

It passes because neither test checks the earlier responses' status.

- `LoginThrottle.TryAttempt` takes a permit before the database is reached.
- The `public-contact` limiter counts a permit whatever the endpoint returns.
- So 8 login and 10 contact attempts reach the database and return 500. The
  ninth login and the eleventh contact still get a 429 and their warning.

The run created `$S/home-arch-rlr/.aspnet`, the Data Protection key folder.
I deleted it afterwards: `rm -rf $S/home-arch-rlr/.aspnet`, and
`ls -a` then showed only `.` and `..`.

**Reviewer's probe (property level).** I checked the reviewer's artefacts,
`$S/rlr-dump.login` and `$S/rlr-dump.contact`. The probe was added only to a
scratch copy. It saved `Sink.All()` after the assertions, disposed the factory,
and saved it again.

- The two login snapshots differ by one line:
  `> Application is shutting down... SourceContext="Microsoft.Hosting.Lifetime"`
  (`diff` of the BEFORE and AFTER sections).
- The last request-log line was already in the BEFORE snapshot, with exactly the
  properties listed in 2.2:
  `… responded 429 in 22.0483 ms RequestMethod="POST" RequestPath="/api/v1/auth/login" StatusCode=429 Elapsed=22.048306 SourceContext="Serilog.AspNetCore.RequestLoggingMiddleware" CorrelationId="2769d1…" RequestId="0HNPU88GT1PJD"`.
- The EF sources recorded:
  - Contact: 20 events each from `…Database.Connection` and `…Update`.
  - Login: 16 events each from `…Database.Connection` and `…Query`.
  - Their `error` property holds the `SqlException` text.
- The Data Protection warning appears in the contact dump, with `KeyId`.

### 2.4 Conclusion

Only three kinds of event can reach the sink after a negative check has read it:

- the last request's request-log line;
- the shutdown line;
- in theory, the diagnostics of an exception after the response has started,
  which these tests do not reach.

None of them can contain the email, the password prefix or the contact marker
under the current code. Their recorded fields are listed in 2.2: method, path,
status, elapsed time, GUID and connection ids, source context, the content root,
and an exception the sink does not record.

The one source that can carry request data is EF Core's `error` property, and
it is written before the response. It is therefore checked, not missed. **The
false pass that FU-2 describes is not real.** The race exists, but nothing
checkable is lost to it.

**A residual point, recorded and not acted on.** Suppose a future change puts
body data on the request-log line, for example an `EnrichDiagnosticContext` that
adds the email. Lines 38, 39 and 63 would still catch it:

- Every request in a test carries the same marker and the same `wrong-` prefix.
- In CI, the earlier requests' request-log lines are written 3–135 ms before the
  next response. The request-log tail is 0.1–1.35 ms (sibling plan 2.1).
- So only the last of 9 or 11 identical lines can be missed.

This is a strong margin, not a strict happens-before.

### 2.5 Whether RateLimitLogTests can run in this container

**They can, and they pass, through the 500 path** (2.3, local run). The round 1
statement that they "cannot pass without SQL Server" was wrong, and it was
presented as checked. It is withdrawn.

The local run covers the case where every non-429 response is a 500 and EF Core
writes its Error events. It does **not** cover the case where SQL Server answers,
which gives 401 for login and 201 for contact. That case is NOT RUN here, because
there is no SQL Server in this container. CI job `API` covers it on every pull
request, and the CI log in 2.3 shows it passing.

## 3. Design

**Chosen: no code change.** Record the finding and close FU-2 on it.

**Rejected alternatives:**

- **Wait for the last request's "responded 429" line before the negative
  checks** (the pattern from `aborted-request-log-race`). It would make the read
  wait for a line that cannot hold what the checks look for. It adds a polling
  helper and a timeout to a file with no observed failure. It would also have no
  honest failing-first step (P-4): under the current code no delay can make lines
  38, 39 or 63 pass when they should fail. A "red" test could only be built by
  injecting a leak into production code.
- **Dispose the factory before the checks.** It has the same objection, and it
  changes the test's structure for no checkable gain.
- **A meta-test that delays the request-log line and asserts that a leak on it
  is still caught.** It tests a hypothetical regression, not current behaviour,
  and needs a test hook in the logging pipeline. It is out of proportion for B-8.

## 4. Scope

- **Create:** `docs/changes/rate-limit-log-race/plan.md` (this file). Nothing
  else.
- **Change:** none. `RateLimitLogTests.cs` and all API code stay as they are.
- **Out of scope:**
  - `AbortedRequestTests.cs` (PR #46 owns it).
  - `AdminApiTests`' collecting sink (examined in the sibling plan 2.3).
  - The residual point in 2.4.
  - The Data Protection warning, which is FU-1 and needs its own plan.
  - Whether EF Core's `error` property should be kept out of the logs. That is a
    logging-hygiene question, not a test race, and is not raised here as a
    finding.

## 5. Test plan

- **Failing test first:** none, because no code changes. P-4 applies to a fix,
  and there is no fix.
- **Checks the reviewer can repeat** (read-only, or in a scratchpad copy):
  1. `grep -n "LogInformation\|LogWarning" api/src/DigitalHub.Api/Controllers/*.cs`
     should print nothing.
  2. `grep -rn "EnrichDiagnosticContext\|IDiagnosticContext\|EnableSensitiveDataLogging\|LogTo(" api/src`
     should print nothing.
  3. `strings -el <nuget>/serilog.aspnetcore/10.0.0/lib/net10.0/Serilog.AspNetCore.dll | grep -E "^(Request|Status|Elapsed|Http|Query)" | sort -u`
     should print exactly `Elapsed`, `RequestMethod`, `RequestPath` and
     `StatusCode`.
  4. `sed -n 905,945p job126362926149.log` (scratchpad) should show the event
     list in 2.3, and `sed -n 187p` should show the merge commit.
  5. `git diff --stat f96d719 78ee598 -- api` and
     `git diff --stat 78ee598 HEAD -- api` should both be empty.
  6. The local run in 2.3, in a scratchpad copy, with a fresh `HOME` and a
     closed-port connection string. Expect exit 0, `Passed: 5`, 2 × 429 and
     18 × 500. Delete the `.aspnet` folder it creates.
- **Suites:** nothing in `api/` changes, so no suite needs re-running. The
  happy-path run of `RateLimitLogTests`, and the rest of the API suite, are NOT
  RUN here (no SQL Server). CI job `API` covers them.
- **Track checklist:** none applies (section 1).

## 6. Security impact

None. No route, policy, data, login, secret or dependency changes. The finding
confirms that the N9 test still protects what it was written to protect: no
email, password or contact text in the logs. The EF `error` property (2.2) is
written before the response, so the test's checks would see it.

## 7. Migrations

None.

## 8. Rollback

Nothing to roll back. If this record is merged and later found wrong, revert the
pull request that adds it.

## 9. Owner decisions needed

None. The owner may still ask for the hardening in section 3. That would be a
new change.

## 10. Risks

- **The analysis misses a log source.** Round 1 named the CI console log as the
  cross-check. That log can show only happy-path events at Information and above,
  without properties. The cross-checks are now these:
  - The code reading in 2.2, with the reviewer's grep for deferred work.
  - The local run in 2.3, which exercises the exception path.
  - The reviewer's probe in 2.3, which records properties and shows that only
    the shutdown line arrives after the read.

  A source that writes only when SQL Server answers with an error other than
  "unreachable" is not exercised anywhere. It would be an EF Error event inside
  the action, so it would be before the response (2.2).
- **A source below Information** does not reach `CollectingSink`. The Serilog
  default minimum is Information (`appsettings.json:4`), and the Testing
  environment adds no override, because only `appsettings.json` exists.
- **A future change adds body data to a post-response line.** See 2.4. The
  earlier requests' identical lines catch it.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Find which lines each negative check is meant to exclude | Task; FU-2 | Planned | |
| Find when each line is written relative to the response, every source | Task; FU-2; review F-2, F-3 | Planned | |
| Decide whether a late line could contain what is checked for | Task; FU-2 | Planned | |
| Show by a run whether the tests pass without SQL Server, and which path that covers | Change context; review F-1 | Planned | |
| Give the commit the CI evidence ran on, and show it is equivalent | Review F-4 | Planned | |
| Not real, so no code change, and the finding recorded | Task | Planned | |
| `AbortedRequestTests.cs` untouched | Change context (PR #46) | Planned | |

## 12. Revision log

- **Round 1** (9 November 2026): first plan.
- **Round 2** (9 November 2026), answering `plan-review.md` Round 1. I checked
  each finding before changing the text.
  - **F-1 (Major), accepted.** I re-ran the tests myself on a scratchpad
    `git archive` copy of `78ee598`, in Release, with a fresh `HOME` and the
    closed-port connection string. They exit 0 with `Passed: 5`. The log has 18
    × "responded 500" and 2 × "responded 429" (`$S/arch-rlr-run1.log`). I
    deleted the `.aspnet` folder the run created.
    - Section 2.5 now says the tests pass through the 500 path. The round 1
      claim is withdrawn.
    - Sections 2.3 and 5 record the run.
    - Sections 2.5, 5 and 11 say the 401 and 201 path stays NOT RUN, with CI job
      `API` named.
  - **F-2 (Major), accepted.**
    - I confirmed the EF Core `error` property, the Data Protection warning, and
      the extra properties (`SourceContext`, `RequestId`, and on the warning
      `ActionId`, `ActionName` and `RequestPath`) in the reviewer's dumps:
      `grep -a -o 'SourceContext="Microsoft.EntityFrameworkCore[^"]*"' … | sort | uniq -c`,
      and the request-log line quoted in 2.3.
    - Section 2.2 is now a table of every source, with when each one writes and
      what it records.
    - The sentence "The only other property is `CorrelationId`" is replaced.
    - The claim that the sink records no exception text is narrowed to
      `LogEvent.Exception`, and the EF `error` property is called out as the one
      route for request data.
    - Section 10 now says what the CI log can and cannot show, and points to the
      local run and the probe for the property-level check.
  - **F-3 (Minor), accepted.** I confirmed the order at `Program.cs:265–274`, and
    that the shield rethrows when the response has started (`:73–76`). Section
    2.2 gives the correct order. The post-start exception case is added to the
    late-line list in 2.2 and 2.4.
    - I name the request-log line at Error and the `UseExceptionHandler`
      diagnostics as the late events. I did not name `UnhandledExceptionHandler`
      the way the review did. I believe ASP.NET Core does not call
      `IExceptionHandler` once the response has started. I have not run that
      case, and in either case nothing checkable is recorded.
  - **F-4 (Minor), accepted.** Section 2.3 now quotes log line 187 (merge
    `f1aba73` of `1aac1ef` into `f96d719`). It shows that
    `git diff --stat f96d719 78ee598 -- api` and
    `git diff --stat 78ee598 1aac1ef -- api` are both empty, and that the current
    PR #37 head does not differ in `api/src`, `RateLimitLogTests.cs` or
    `ApiFactory.cs`.
  - **The conclusion is unchanged:** no code change.
