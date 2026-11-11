# Plan approval (gate 1): aborted-request-log-race

Tech lead, 8 November 2026. Holding gate 1 on `plan.md` round 1, reviewed in
`plan-review.md` round 1 (`Verdict: APPROVED`, no Blockers, no Majors, three
Minors). Worktree `/home/user/dh-change-log-race`, branch
`change/aborted-request-log-race`, at `78ee598` (= `origin/rebuild/dotnet-platform`,
fetched today).

Read: `docs/changes/README.md` and `.claude/agents/tech-lead.md` (PR #37 branch,
in `/home/user/DH-WEBSITE`), `AGENTS.md`, `ENGINEERING_STANDARDS.md` (via
`git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md`; P-4,
P-6, P-8, B-6, B-8), the refinement plan (two merge slots, line 21), `plan.md`,
`plan-review.md`, and `AbortedRequestTests.cs:1–60` on the branch.

## Decision

Approved, with the conditions below. This is the right change: the owner asked
for it ("fix it", Mohamed Elbadry, 8 November 2026, project thread), it is
test-only, it keeps every assertion (P-6), and it removes a timing dependency
that already failed the API job on an unrelated docs-only pull request (#37).

## What I checked myself

**The failure and its cause.** I read the job log
(`job126362926149.log` in the session scratchpad, 3,677 lines, from
`gh api repos/mohya7/DH-WEBSITE/actions/jobs/126362926149/logs`):

```
3071  … Application started. Press Ctrl+C to shut down.
3074  … 50a75a15… Bad request from the client: 400
3075  … 50a75a15… HTTP POST /api/v1/auth/login responded 400 in 1.6595 ms
3079  … Collection: [ …, "Bad request from the client: 400"]
3098  Total tests: 475
3100       Failed: 1
```

The request-log line was written by the failing request but was not in the
snapshot the assertion read. This confirms the cause and the reviewer's F-3 line
numbers (3071–3100, not 3069–3088).

**Execution order.** The refinement plan has no item for this. It is a
CI-reliability fix to one test file, not a G1/G2/G3 item, so the Wave and ISO
ordering rules do not apply. It changes no file any open pull request changes
(below), so it can take either merge slot without displacing a planned item.
It should merge early, because every open pull request runs the API job that can
hit this race.

**Conflicts with open branches.** Open pull requests, from
`gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open'`: #37, #40, #41, #42, #43,
#44. #45 is already merged; it is the base commit `78ee598`. I fetched every
`refs/pull/37..45/head` and diffed each against its merge base with
`origin/rebuild/dotnet-platform`:

| PR | Branch | Touches `AbortedRequestTests.cs`? | Touches request logging (`UseSerilogRequestLogging`, shield, Serilog config)? | Other API files |
| --- | --- | --- | --- | --- |
| #37 | claude/project-thread-fmllvw | No | No | None |
| #40 GAP-12 | change/GAP-12 | No | No. `Program.cs:26` adds `ConfigureKestrel(AddServerHeader = false)`, above `UseSerilog`; it does not touch lines 270–274 | New `ServerHeaderTests.cs` (own factory, no sink) |
| #41 GAP-08 | change/GAP-08 | No | No | None |
| #42 GAP-06 | change/GAP-06 | No | No | Two migration files, `api/tools/migration-checks/*`, `ci.yml` |
| #43 GAP-04 | change/GAP-04 | No | No | `ci.yml` only |
| #44 GAP-07 | change/GAP-07 | No | No | None |

`git diff <merge-base> pr/<n> | grep -c "AbortedRequest\|CollectingSink\|UseSerilogRequestLogging"`
prints `0` for every one of #37–#45. Across all remote branches, the only ones
that change `AbortedRequestTests.cs`, `ExceptionShieldMiddleware.cs` or
`Program.cs` besides GAP-12 are `phase-c/session-password-hardening-v2`,
`phase-c/careers-intake`, `phase-c/api-security-fixes` and
`fix/forwarded-headers-empty`. These are heads of pull requests already merged by
squash, such as #35, which created `AbortedRequestTests.cs` as `3926080`. None of
them is open. There is no conflict.

One consequence: the plan's "477 of 477" is relative to `78ee598`. If #40 or
another test-adding pull request merges first, the expected total moves by that
pull request's count (condition C-5).

**Risk.** Low. The changes are confined to test code, and production code,
routes, data, secrets and migrations do not change. The wait cannot pass
anything that fails today. It waits for the request-log line with any status,
does not throw, and then the unchanged assertions run. The reviewer's analysis
(plan-review "Checked and found sound") holds: the class is in the
non-parallel `SqlServer` collection, and each test has its own sink. The main
residual risk is R-4: the TestHost hand-back is cited, not read. That risk
depends on O-1 (below).

## The reviewer's Minors

- **F-2 (delay hook condition). Must be folded in, as condition C-1.** The
  delay hook is the regression guard that makes a late line deterministic. A
  loose match could delay the wrong event or none, and the red row would then
  prove nothing. An asynchronous hand-off would also let the line through early
  and turn the guard into a no-op.
- **F-3 (log line numbers). Must be folded in, as condition C-2.** The coverage
  table cites these lines as evidence (P-8). I confirmed the correct numbers
  above.
- **F-1 (`RateLimitLogTests` reasoning). Accepted, but the corrected reasoning
  must be recorded (condition C-3).** The conclusion is right, and the file stays
  out of scope. The developer does not edit the plan, so the corrected sentence
  goes in `implementation.md`. That file must also note that the
  `DoesNotContain` checks in `RateLimitLogTests` race in the false-pass
  direction. It is not fixed here (B-8). If it is worth tracking, the
  orchestrator raises it with the owner as a follow-up. It is not a condition
  of this change.

## Conditions the developer must meet

- **C-1 (F-2).** The delay in `CollectingSink.Emit` is a synchronous
  `Thread.Sleep` on the emitting thread. It applies only when the configured
  delay is above zero, and only to events whose `MessageTemplate.Text` starts
  with the exact prefix `"HTTP {RequestMethod} "`, or that carry both
  `RequestPath` and `StatusCode` properties. There is no `Task.Run`, no
  queueing, and no async hand-off. The existing four rows pass `0`.
- **C-2 (F-3).** `implementation.md` cites the job log as lines 3071–3100: the
  shield line at 3074, the request-log line at 3075, the first `Collection:` at
  3079, and the totals at 3098–3100.
- **C-3 (F-1).** `implementation.md` records the corrected `RateLimitLogTests`
  reasoning. The sink appends every property, so a late line would also carry
  `Elapsed`, `CorrelationId` and the other enriched properties, and none of them
  can contain the marker. The file stays unchanged.
- **C-4 (P-4, B-6 by analogy).** Two commits, in this order. The red commit adds
  the delay plumbing and the two `requestLogDelayMs: 300` rows without
  `WaitForAsync`. The fix commit adds `WaitForAsync` and the two calls. No
  existing assertion line is changed, removed or reordered in either commit. The
  tester diffs the assertion lines against `78ee598`. Commit subjects and
  trailers follow B-4.
- **C-5.** The full-suite expectation is stated as "base count + 2", and gate 2
  quotes it against the base the pull request actually merges onto. It is 477
  only on `78ee598`.
- **C-6.** Every build and test command is recorded as NOT RUN in this container
  (no `dotnet`, no SQL Server), with the reason, and names the CI job
  "API — Release build, migrations, integration tests" as the proof. One green CI
  run is not evidence that the flake is gone; the delayed rows are.
- **C-7 (R-4 stop condition).** If the red commit is ever run and the delayed
  rows pass without the wait, the developer stops and sends the change back to
  the architect, as the plan says.

## O-1: push the red commit alone so CI shows it failing

**It does not block this gate.** The plan does not depend on the answer. Without
it, the red step is recorded as NOT RUN with the reason, and the red commit
still exists in history before the fix (C-4). The owner's "fix it" asks for
the fix. **It does not answer O-1 and must not be read as consent** to push a
commit that is meant to fail. Pushing it is the orchestrator's decision, and
only on the owner's words (P-7). I am not deciding it for the owner.

The cost of the default must still be visible. Without a red run, nothing
executes the R-4 check that the delayed rows really fail without the wait. A
green CI run cannot show it, because the delayed rows pass with the wait whether
or not the hand-back is early. The job log is independent evidence that the race
is real, so I accept that gap for a test-only change. At gate 2 it is an open
item in the pull request description: "red step NOT RUN; O-1 unanswered". The
owner can close it in either of two ways. One is to answer O-1 yes before the
fix commit is pushed. The other is to run the red commit's
`--filter "FullyQualifiedName~AbortedRequestTests"` in Release on their own
machine.

Verdict: APPROVED
