# rate-limit-log-race: plan approval (gate 1)

Technical lead, 9 November 2026. Plan: `plan.md` round 2. Review:
`plan-review.md` Round 2, `Verdict: APPROVED`, with no Blocker or Major and one
open Minor (R2-1). Worktree `/home/user/dh-change-rl-race`, branch
`change/rate-limit-log-race` at `78ee598`.

This approval is a pipeline role. It is not the owner's confirmation under
`AGENTS.md`, and it is not an owner decision under P-7.

## Decision

**I accept the conclusion: the false pass that FU-2 describes is not real, and
no code change is right.** The race exists. The events that can land after the
negative checks read `CollectingSink` are the last request's request-log line,
the host shutdown line and, in theory, diagnostics for an exception after the
response has started, which these tests do not reach. None of them records the
email, the `wrong-` password prefix or the contact marker. The one source that
can carry request data, EF Core's `error` text, is written while the action
awaits the database, before the response. So a leak there would be a true
failure, not a missed one.

I agree with the rejected alternatives in plan section 3. Waiting for the
terminal line would add a polling helper with no honest failing-first step
(P-4), because no delay under the current code can make lines 38, 39 or 63 pass
wrongly.

## What I verified myself

1. **The code matches the plan.** In the worktree at `78ee598`:
   - `RateLimitLogTests.cs` has the negative checks at lines 37, 38, 39 and 63,
     and the `Assert.Single` checks at 33 and 59. `CollectingSink.Emit` renders
     the message, then every property as ` key=value`. It does not render
     `LogEvent.Exception`.
   - `Program.cs` runs, in order: `UseForwardedHeaders` (when trusted),
     `CorrelationIdMiddleware`, `SecurityHeadersMiddleware`,
     `UseExceptionHandler`, `UseSerilogRequestLogging`, then
     `ExceptionShieldMiddleware`. The console sink and the service sinks hang
     off the same Serilog logger (`ReadFrom.Services`).
   - `grep -rn "EnrichDiagnosticContext\|IDiagnosticContext\|EnableSensitiveDataLogging\|LogTo(" api/src`
     printed nothing.
   - `grep -rn "OnCompleted\|Task.Run\|BackgroundService\|IHostedService\|Channel<\|ThreadPool\|ContinueWith" api/src`
     printed only `api/src/DigitalHub.Api/Identity/IdentitySeeder.cs:7`, which
     runs at start.
2. **The tests run here, through the 500 path.** In a scratchpad `git archive`
   copy of `78ee598`'s `api/`, with SDK 10.0.114 (`dn.sh`):
   ```
   dotnet build tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release
     → exit 0, 0 Error(s)
   HOME=$S/home-tl-rlr (fresh, `ls -a` showed only . and ..) \
   ConnectionStrings__Content='Server=tcp:127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=x;Encrypt=False;Connect Timeout=2' \
   dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
     --filter "FullyQualifiedName~RateLimitLogTests" --logger "console;verbosity=normal"
     → exit 0, Total tests: 5, Passed: 5
   grep -oE "responded [0-9]+" | sort | uniq -c  →  2 responded 429, 18 responded 500
   ```
   The full log is `$S/tl-rlr-run1.log`. The run created
   `$S/home-tl-rlr/.aspnet`, which I deleted. `ls -a` afterwards showed only
   `.` and `..`. Nothing connected to a database, and nothing was written to
   `DigitalHubContent`, because the port was closed.
3. **Only the shutdown line arrives after the read.** I compared the BEFORE and
   AFTER sections of the reviewer's probe dumps (`$S/rlr-dump.login`,
   `$S/rlr-dump.contact`) with `diff`. Each differs by exactly one line:
   `> Application is shutting down... SourceContext="Microsoft.Hosting.Lifetime"`.
4. **No other open branch overlaps.** For each `origin/change/*` branch and
   `origin/claude/cool-heisenberg-mh6zx9`, `git diff --name-only 78ee598...<branch>`
   matched nothing under `RateLimitLog` or `docs/changes/rate-limit-log-race`.
   `origin/change/aborted-request-log-race` (PR #46) edits only
   `AbortedRequestTests.cs` and its own records. This change touches neither.
5. **`git status --short`** in the worktree shows only
   `?? docs/changes/rate-limit-log-race/`. Nothing in `api/` changed.

## The reviewer's Minor

**R2-1, accepted as an erratum here, not folded into `plan.md`.** My run
confirms it. In `$S/tl-rlr-run1.log`, the Data Protection warning
`No XML encryptor configured. Key {…}` is line 10, at 09:23:01.7935. That is
before `Application started` on line 11, at 09:23:01.8369, and before the first
request line, line 65. So the record should read:

> Data Protection `XmlKeyManager` warning: written **at host start, the first
> time a fresh profile creates a key**, before any request. Late? No.

This correction is the record of what is true. Plan section 2.2 says
otherwise, and this correction overrides it. The "Late? No" answer and the
conclusion do not change, because an event written before the first request is
already in the sink when it is read. I am not sending the plan back for one
row. Editing an approved plan after approval would also leave no step to
re-review it.

## Execution order and risk

- The change is not in a wave of the refinement plan. It is a follow-up of
  `aborted-request-log-race`. It changes no code, gate or test, so it cannot
  break the ordering rules. It does not come before a Blocker or Major and
  does not run ahead of one.
- The risk is that the analysis misses a log source. That risk is low and
  stated in plan section 10. The code reading, two local runs (the reviewer's
  and mine), and a property-level probe all agree. The happy path (401 and 201)
  is NOT RUN in this container, because there is no SQL Server. CI job `API` on
  the pull request covers it. `.github/workflows/ci.yml` has no `paths` filter,
  so a docs-only pull request still runs that job.
- Owner decisions: none needed. The owner's request, "PUSH and continue"
  (Mohamed Elbadry, 9 November 2026, project thread), covers working on the
  follow-ups. The owner can still ask for the hardening in plan section 3. That
  would be a new change.

## Outcome: how this change closes

The developer and the tester have nothing to build or test, so pipeline steps
4 to 6 do not run. **The change closes with a docs-only pull request.** It
should not close without one. FU-2 was raised in a committed record
(`aborted-request-log-race/delivery-approval.md`), so it should be closed by a
committed record. The pipeline README also says the records are committed on
the change branch, so the pull request carries its evidence.

Conditions:

1. The orchestrator commits exactly three files on `change/rate-limit-log-race`:
   `docs/changes/rate-limit-log-race/plan.md`, `plan-review.md` and
   `plan-approval.md`. Nothing else, and nothing under `api/`. Use one commit
   with a B-4 subject, for example
   `rate-limit-log-race: Record why the N9 negative checks cannot pass falsely`.
2. Open the pull request against `rebuild/dotnet-platform` only after the owner
   approves the push. The description must say:
   - It is docs only.
   - FU-2 is closed with no code change, with a link to this file.
   - The 401 and 201 path is proven by CI job `API` on this pull request.
   - The Definition of Done boxes that do not apply (failing test first,
     migrations, screenshots) are marked not applicable, with the reason.
3. CI must be green on the pull request's final head before merge, with job
   `API` included. If `RateLimitLogTests` fails there, the change reopens at
   step 1.
4. Merging is the owner's decision. This approval does not stand in for it.

Verdict: APPROVED
