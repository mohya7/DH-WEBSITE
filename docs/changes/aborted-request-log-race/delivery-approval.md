# Delivery approval (gate 2): aborted-request-log-race

Tech lead, 8 November 2026. Holding gate 2 on branch
`change/aborted-request-log-race` at `ee35843` (code at `2f09df7`), worktree
`/home/user/dh-change-log-race`, against `origin/rebuild/dotnet-platform` at
`78ee598` (fetched today; still the merge base).

Read: `docs/changes/README.md` and `.claude/agents/tech-lead.md` (PR #37
branch, in `/home/user/DH-WEBSITE`), `AGENTS.md`, `ENGINEERING_STANDARDS.md`
(plan branch; P-4, P-6, P-8, B-4, B-6, B-8, B-9), `plan.md`, `plan-review.md`,
`plan-approval.md`, `implementation.md` (`Status: READY FOR TEST`) and the
uncommitted `test-report.md` (round 1, `Verdict: APPROVED`, no Blocker, no
Major, one pre-existing Minor F-1). The PR template is
`.github/pull_request_template.md` on base.

## Decision

Approved. The diff is exactly the approved plan with conditions C-1 to C-7
met. Every assertion is unchanged. The red commit precedes the fix and I have
seen it fail, myself, for the reason the plan gives. The fix passes the
covering filter. Only the full API suite remains, and only the PR's CI job can
run it, because it needs SQL Server. That, and the other boxes listed under
"Open items", stay open for the owner and CI. This approval is not the owner's
confirmation.

## What I verified myself

**Diff against the plan.** `git diff --stat origin/rebuild/dotnet-platform...HEAD`
lists `api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs` (+49/−11 lines in
code) and four files in this folder. The uncommitted `test-report.md` and this
file come on top. I read the whole code diff:

- Both theories gain `int requestLogDelayMs`. The existing rows pass `0` and
  there is one new `("/api/v1/auth/login", 300)` row each (plan section 4).
- `LoggingFactory(int requestLogDelayMs = 0)` builds `Sink` with that delay.
- C-1: `CollectingSink.Emit` calls `Thread.Sleep(requestLogDelayMs)` only when
  `requestLogDelayMs > 0` and `MessageTemplate.Text.StartsWith("HTTP {RequestMethod} ", Ordinal)`,
  before rendering and enqueueing. It is synchronous, with no `Task.Run` or
  hand-off.
- `WaitForAsync` uses a `Stopwatch` and polls every 10 ms with `Task.Delay`
  until a line matches or 5 s passes. It never throws or asserts.
- Both theories call it with `"\"{path}\" responded "` (any status), before
  their sink assertions. That is after `ThrowsAnyAsync` in the 499 theory, and
  between `Assert.Equal(400, …)` and `Assert.Empty` in the 400 theory.
- Nothing else under `api/`, `.github/` or `website/`/`studio/` changes.
  `git diff --check 78ee598 HEAD` exits 0.

**Assertions unchanged (P-6, C-4).**
`diff <(git show 78ee598:$F | grep "Assert\.") <(git show <c>:$F | grep "Assert\.")`
exits 0 for `f3065c1` and `2f09df7`. `git show f3065c1 | grep -c WaitForAsync`
prints `0`.

**Commit order and B-4.** `git log origin/rebuild/dotnet-platform..HEAD`:
`bbb915a` Plan, `f3065c1` red ("Add failing rows for a request-log line
written late"), `2f09df7` fix ("Wait for the request-log line before reading
the sink"), `ee35843` "Record the implementation". Every subject is
imperative and prefixed with the change id. "Plan" is a records commit, which I
accept. Every body says why. All four end with the
`Co-Authored-By: Claude Opus 5.5` and `Claude-Session:` trailers.

**Re-run, red and fix (P-4, P-8).** I used the tester's SDK, unpacked in the
session scratchpad (`dotnet --version` gives `10.0.114`, from Ubuntu
`noble-updates` packages). I exported each commit with `git archive <sha> api .github`
into `scratchpad/tl/{fix,red}`, so the worktree was not touched.
`ConnectionStrings__Content` was set in the process environment only, to
`Server=tcp:127.0.0.1,4299;…;Connect Timeout=2`, a closed port. No database
was reached. `HOME` was a fresh scratchpad folder, so no
`/root/.aspnet/DataProtection-Keys` was created (`ls /root/.aspnet`: no such
directory, before and after). From `api/`:

```
dotnet build tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~AbortedRequestTests" --logger "console;verbosity=normal"
```

| Commit | Run | Exit | Result |
|---|---|---|---|
| `2f09df7` build | — | 0 | `0 Error(s)`, `13 Warning(s)` (none in the changed file) |
| `2f09df7` | 1 (fresh `HOME`) | 1 | 5 passed, 1 failed. `…disconnects…(login, 0)` hit `Assert.Empty` with `"Warning: No XML encryptor configured. Key {238d287"···`. This is the tester's F-1 and is pre-existing. |
| `2f09df7` | 2 | 0 | `Total tests: 6`, `Passed: 6`. The 300 ms rows took 408 ms and 334 ms, and the 0 rows took 32–216 ms. |
| `2f09df7` | 3 | 0 | `Total tests: 6`, `Passed: 6` |
| `f3065c1` build | — | 0 | `0 Error(s)` |
| `f3065c1` | 1 | 1 | 4 passed, 2 failed |
| `f3065c1` | 2 | 1 | 4 passed, 2 failed |

On both red runs the failures were exactly the two 300 ms rows. One is
`…disconnects…(path: "/api/v1/auth/login", requestLogDelayMs: 300)` at
`AbortedRequestTests.cs:line 42` (`responded 499`), with the collection
`[…, "Client closed the request before it finished"]`. The other is
`…chunked_body…(path: "/api/v1/auth/login", requestLogDelayMs: 300)` at
`line 65` (`responded 400`), with the collection
`[…, "Bad request from the client: 400"]`. Both report
`Assert.Contains() Failure: Filter not matched in collection`. The second has
the same shape as the CI failure in job `126362926149`. So R-4/C-7 does not
trigger. `TestServer.SendAsync` hands back before the request-log line is
written, and that is now shown by execution, not only by citation. The tester's
logs for the same runs (`test-red-{1,2,3}.log` and `test-fix-*.log` in the
scratchpad) agree. I also read the mutation (M1, M2) and stress results. I did
not re-run them, and they add margin, not proof the gate needs.

**Coverage table.** Every row in `test-report.md` has evidence, except "Full
API suite green in Release", which is NOT RUN. Its reason (SQL Server) is
stated and it names the CI job. I confirmed the rows for cause, assertions,
red, green and compile above.

**Conflicts.** The open pull requests are #37, #40, #41, #42, #43 and #44. I
checked each with
`gh api repos/mohya7/DH-WEBSITE/pulls/<n>/files`. Only #40 (GAP-12) touches API
code: `Program.cs:26` and a new `ServerHeaderTests.cs`. None touches
`AbortedRequestTests.cs` or request logging. The situation is unchanged since
gate 1.

**C-5, expected full-suite count.** The expected count is the base count plus 2.
That is 477 on `78ee598`. If #40 merges first it adds 5 cases
(`ServerHeaderTests.cs` on `change/GAP-12` has 3 `[Fact]` and one `[Theory]`
with 2 `[InlineData]`), and the expected count becomes 482.

## O-1 (red step) from gate 1

**Closed as an evidence gap. The question no longer needs an answer.** Gate 1
kept O-1 open because nothing would execute the R-4 check that the delayed rows
fail without the wait. That check has now been executed. The tester ran it three
times, with 4 passed and 2 failed on runs 2 and 3 (run 1 also hit F-1). I ran
it twice, with 4 passed and 2 failed both times, at the predicted lines with the
predicted message. Both runs used Release and the repository's pinned
`Microsoft.AspNetCore.Mvc.Testing` 10.0.12, so the same TestHost code runs here
as in CI (`ci.yml` installs `10.0.x`). The differences are the OS (Linux, not
the owner's Windows machine) and the SDK build (10.0.114 from Ubuntu). Neither
affects whether a 300 ms synchronous sleep on the server thread lands after
`SendAsync` returns.

So the PR description should not say "red step NOT RUN; O-1 unanswered". It
should quote the local red run. The orchestrator should **not** push the red
commit alone. Nobody asked the owner for that, and it is no longer needed. If
the owner still wants CI to show the red step, that remains their call (P-7).
Because of F-1, CI would then need a run that is not the filter alone on a
fresh runner.

## Open items

1. **CI on the final head.** Run "API — Release build, migrations, integration
   tests", step "Integration tests (Release)", on the PR head after the
   orchestrator commits `test-report.md` and this file. The expected result is
   base + 2, all passing (477 on `78ee598`, 482 if #40 merges first). Every other
   required check must also be green: website, Studio, section comparison and
   `security.yml` (Semgrep, gitleaks, audits). Semgrep and gitleaks were NOT RUN
   locally because the tools are not installed. One green run does not prove
   the flake is gone. The 300 ms rows are the proof (C-6).
2. **Owner review and confirmation.** This gate does not stand in for it.
3. **Integrator and post-merge re-run.** The owner or orchestrator names who
   merges into `rebuild/dotnet-platform`. The suites are re-run after the merge.
4. **Changed-line coverage gate.** This is test-only code. The box is ticked
   only if the CI coverage job, where one exists, reports on the final head.

## Follow-ups (not in this change, B-8; for the orchestrator to raise with the owner)

- **FU-1 (tester F-1).** `AbortedRequestTests` fails its first row in a fresh
  Linux profile with
  `Warning: No XML encryptor configured. Key {…} may be persisted to storage in unencrypted form`.
  ASP.NET Core Data Protection logs this once, when it creates its first key,
  and the theory's `Assert.Empty(AtLeast(Warning))` catches it. The test
  depends on an earlier host having made the key. It was reproduced at base by
  the tester and at the head by me (run 1 above). A likely fix is for
  `ApiFactory` or the test host to persist keys to a per-run temp folder, or to
  configure Data Protection so the warning cannot reach the sink. This needs its
  own plan.
- **FU-2 (gate 1 F-1, implementation C-3).** The `DoesNotContain` checks in
  `RateLimitLogTests` read the sink right after the response. They race in the
  false-pass direction. This change does not fix that.

## Draft pull request description

```markdown
## What and why

aborted-request-log-race. `AbortedRequestTests` read its collecting log sink as
soon as `TestServer.SendAsync` handed back. Serilog's request-logging
middleware writes its `HTTP … responded {StatusCode}` line on the server thread
after that, so the read raced the write. It failed API job 126362926149
(run 41765541793) on PR #37, a docs-only pull request, 474/475: the collection
held "Bad request from the client: 400" but not the request-log line, which the
job log shows was written 1.35 ms later (lines 3074–3079). The owner asked to
"fix it".

The tests now wait, for at most 5 s with a 10 ms poll, until this request's
request-log line (any status) is in the sink, and then run their unchanged
assertions. A test-only delay hook holds the request-log event back 300 ms on
the server thread. One new row per theory uses it as a permanent regression
guard for a late line.

## Scope and boundaries

In scope: `api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs` only, plus
the records in `docs/changes/aborted-request-log-race/`.

Out of scope and not touched: `RateLimitLogTests.cs` and `AdminApiTests.cs`
(checked; no failing race, plan 2.3 and implementation C-3), merging the
three private `CollectingSink` classes, `Program.cs`,
`ExceptionShieldMiddleware.cs`, Serilog configuration, and `ci.yml`.

## Security impact

None. This is test code only. No route, policy, data, secret, dependency or
migration changes. Production request logging and the exception shield are
unchanged.

## Tests and evidence

Commits: `f3065c1` red (delay hook and two 300 ms rows, no wait), then
`2f09df7` fix (`WaitForAsync` and two calls).

- Assertions unchanged (P-6):
  `diff <(git show 78ee598:$F | grep "Assert\.") <(git show <c>:$F | grep "Assert\.")`
  exits 0 at `f3065c1` and `2f09df7`. There are 7 lines, in the same order.
- Local runs on Linux, .NET SDK 10.0.114, Release, with
  `--filter "FullyQualifiedName~AbortedRequestTests"`. The database
  connection pointed at a closed port, so no database was touched.
  - Red `f3065c1`: exit 1, 4 passed and 2 failed. The tester got this twice
    and the tech lead twice. The failures are exactly the two 300 ms rows, at
    line 42 (`responded 499`) and line 65 (`responded 400`), each with
    "Filter not matched in collection". The collection holds the shield's line
    but not the request-log line, the same shape as the CI failure.
  - Fix `2f09df7`: exit 0, 6/6 passed. The tester got this 3 times, plus 5
    times under CPU load. The tech lead got it twice. The 300 ms rows take
    about 330–440 ms, and the 0 rows take about 30–270 ms.
  - Mutations (tester): with a 6000 ms delay, the wait gives up at 5 s and
    the unchanged assertion fails, showing the collection. With the expected
    status changed to 401, it fails within 28–337 ms, showing the real
    `responded 400` line.
- Build in Release, both commits: exit 0, 0 errors. No warning comes from the
  changed file.
- `dotnet` NuGet audit: 0 findings. `npm audit --audit-level=high`: website
  exit 0 (1 moderate), Studio exit 0.
- NOT RUN locally:
  - The full API suite needs SQL Server. It is covered by "API — Release
    build, migrations, integration tests", step "Integration tests (Release)".
    The expected count is base + 2 (477 on `78ee598`).
  - Semgrep and gitleaks are not installed. They are covered by the
    `security.yml` jobs.
  - Website and Studio suites: no files there changed. They are covered by
    their CI jobs.
- CI run ids on the final head: <to be filled in>.

## Owner decisions

- "fix it" (Mohamed Elbadry, 8 November 2026, project thread), about the
  failure of API job 126362926149 on PR #37.
- O-1 (push the red commit alone so CI shows it failing) was not asked. It is
  no longer needed, because the red step was executed locally (above).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such). The full-suite criterion is proven by CI on this head.
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope. No route changes.
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test. Tests exist (two regression rows), and this is not a security fix. Coverage is pending CI on the final head.
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below (plan review, tester code review, tech-lead gate 2)
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed. Awaiting the owner.
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded. Nothing deploys before Phase D. The integrator is to be named, and the suites are re-run after the merge.

## Review findings accepted

- Tester F-1 (pre-existing, Minor): the first `AbortedRequestTests` row fails
  in a fresh Linux profile on the Data Protection "No XML encryptor
  configured" warning. It is out of scope (B-8) and proposed as a follow-up.
- Gate 1 F-1 note: the false-pass race in the `DoesNotContain` checks of
  `RateLimitLogTests` is not fixed here (B-8). It is proposed as a follow-up.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated. Not applicable: this item is in no phase or refinement plan.
- [ ] `docs/deferred-items.md` updated for any exception. Not applicable: there is no exception.
- [x] Documentation updated (`docs/changes/aborted-request-log-race/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
