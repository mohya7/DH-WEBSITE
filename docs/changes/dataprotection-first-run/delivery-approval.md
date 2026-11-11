# Delivery approval: dataprotection-first-run (gate 2)

Gate 2, held by the technical lead. I reviewed `plan.md` revision 2,
`plan-review.md` rounds 1 and 2, `plan-approval.md`, `implementation.md`, and
`test-report.md` round 1, which ends `Verdict: APPROVED` with no findings. This
approval moves the change to the owner. It is not the owner's confirmation that
`AGENTS.md` requires, and it is not an owner decision (P-7).

## Decision

Approved, for opening as a **draft** pull request into `rebuild/dotnet-platform`.
It must not be marked ready, or merged, until the open items below are closed.
The most important is the restack after PR #46 merges (plan-approval condition 5).

## What I verified myself

The branch is stacked on PR #46, so I judged the change against `2dbea44`, PR
#46's head, rather than against `origin/rebuild/dotnet-platform`.

| Check | Command, as run | Result |
|---|---|---|
| Stack is intact | `git fetch origin`; `git rev-parse origin/change/aborted-request-log-race`; `git merge-base --is-ancestor 2dbea44 HEAD` | `2dbea44a151a…`, exit 0. `gh api repos/{owner}/{repo}/pulls/46`: `state: open, merged: false, head: 2dbea44…`. #46 has not moved since gate 1, so no restack is due yet (condition 4). |
| Diff matches the plan's scope | `git diff --stat 2dbea44..HEAD` | 6 files: `ApiFactory.cs` +37, `TestHostDataProtectionTests.cs` +56 (new), and four files under `docs/changes/dataprotection-first-run/`. No other path. |
| Code is what plan 3.1 specifies | `git diff 2dbea44..HEAD -- api` | Four `using` lines. In the existing `ConfigureTestServices`, `Configure<KeyManagementOptions>` sets `XmlRepository = new InMemoryKeyRing()` and `XmlEncryptor = new NullXmlEncryptor()`, under the 3.1 comment word for word, including the m-2 sentence. A `private sealed` nested `InMemoryKeyRing : IXmlRepository` holds the elements behind a lock and returns copies. The new test matches 5.1 steps 1 to 4. Its `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))` has no filter. |
| Out of bounds unchanged | `git diff --quiet 2dbea44 HEAD -- api/src api/tools .github api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs` | exit 0. `Program.cs`, `appsettings*.json`, `ci.yml` and PR #46's file are untouched. No package and no migration. |
| Red before the fix (P-4, B-6) | `git show --stat a5d2104 d76ef67` | `a5d2104` adds only `TestHostDataProtectionTests.cs` (1 file, +56). `d76ef67`, which comes after it, changes only `ApiFactory.cs` (+37). |
| Commit messages (B-4) | `git log --format='%h %s%n%b' 2dbea44..HEAD` | All four subjects are in the imperative and carry the `dataprotection-first-run:` prefix. Each body says why. Each ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the `Claude-Session:` trailer. |
| Conflicts with other open PRs | For each open PR, `gh api repos/{owner}/{repo}/pulls/<n>/files` checked for `ApiFactory.cs` or `TestHostDataProtection` | Open PRs: #46, #44, #43, #42, #41, #40, #37. None touches either file. The local FU-2 branch `change/rate-limit-log-race` (`6afb318`, no PR yet) changes only `docs/changes/rate-limit-log-race/` so far. |

### Re-run (Linux, scratchpad SDK 10.0.114, Release, closed port)

I used a detached worktree at `/home/user/dp-gate2`. For every run I set
`ConnectionStrings__Content="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`
and a new empty `HOME` in the scratchpad, and deleted that `HOME` after the run.
In the table, "noXml" counts lines matching `No XML encryptor`. "WRN" counts
lines matching ` (WRN|ERR|FTL)\]`. "home" counts the entries under `HOME`.
Logs: `<scratchpad>/tl2-*.log`.

| Tree | Command | Exit | Result | noXml | WRN | home |
|---|---|---|---|---|---|---|
| `6060a6f` | `dotnet build tests/DigitalHub.Api.Tests -c Release` | 0 | `13 Warning(s)`, `0 Error(s)`. `grep -cE 'ApiFactory.cs\|TestHostDataProtectionTests.cs'`: 0 | — | — | — |
| `6060a6f`, run 1 | `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~TestHostDataProtectionTests\|FullyQualifiedName~AbortedRequestTests"` | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| `6060a6f`, run 2 | same | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| `6060a6f`, run 3 | same | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| `a5d2104` (red) | build as above, then `--filter "FullyQualifiedName~TestHostDataProtectionTests"` | **1** | `Total tests: 1, Failed: 1`. `Collection: ["Warning: No XML encryptor configured. Key {189ff84"···, "Warning: No XML encryptor configured. Key {44f6fa9"···]` at `TestHostDataProtectionTests.cs:line 30` | — | — | 4 |

These match `implementation.md` and `test-report.md`: red at line 30 with the
planned warning, and green 3 of 3 with nothing written to the profile. Clean-up:
I removed the worktree (`git worktree remove --force /home/user/dp-gate2`, then
`git worktree prune`; `git worktree list` no longer shows it). No
`tl2-home-*` folder remains, and `/root/.aspnet` does not exist. In
`/home/user/dh-change-dp`, `git status --short` shows only the untracked
`test-report.md` and this file.

### Evidence I read and accept

- The tester's evidence is real. It gives the commands, exit codes and output
  lines, on detached worktrees of `a5d2104` and `6060a6f`.
- The tester ran the whole project without SQL Server: 478 tests discovered at
  the head. The set of passing tests at the head is the red tree's set plus the
  new test, and nothing else.
- Probes P1 to P3 confirm three things. The options resolve to `InMemoryKeyRing`
  and `NullXmlEncryptor`. Each host has its own ring, even with parallel hosts.
  R-4 depends on a convention, as the plan accepted.
- Every row of the coverage table in `implementation.md` and `test-report.md`
  has evidence. The two CI-only rows are marked NOT RUN, with the `ci.yml` API
  job named.

## Open items (Definition of Done boxes that cannot be ticked yet)

1. **Restack after PR #46 merges (plan-approval conditions 4 and 5, blocking).**
   PR #46 is still open at `2dbea44`.
   - If #46 is squash-merged (the likely case), run
     `git rebase --onto origin/rebuild/dotnet-platform 2dbea44`.
   - If #46 is merged with a merge commit, a plain rebase or a merge is
     acceptable.
   - After either, `git diff --name-only origin/rebuild/dotnet-platform...HEAD`
     must list only `ApiFactory.cs`, `TestHostDataProtectionTests.cs` and
     `docs/changes/dataprotection-first-run/`. Today it also lists PR #46's 7
     files. Then re-run 5.2 steps 1 to 5 on the new head.
   - Push with `--force-with-lease` only.
   - If #46 closes unmerged, this change returns to step 1.
2. **CI on the final head (box 6, plan-approval condition 6).**
   - The `ci.yml` job "API — Release build, migrations, integration tests" must
     be green.
   - `grep -c "No XML encryptor"` on that job's log must return 0.
   - The total must equal the latest green API job total on the integration
     branch, plus #46's rows if #46 is not yet in it, plus 1. Give the job id
     and the arithmetic.
   - The Security workflow must be green: Semgrep, gitleaks and CodeQL. A
     finding on `NullXmlEncryptor` goes back to the plan (R-3) and is never
     suppressed.
   - None of this was run here: the branch is not pushed.
3. **Integrator (box 10).** Not yet named. The owner or the orchestrator names
   who merges into `rebuild/dotnet-platform` and re-runs the suites after the
   merge (`AGENTS.md`).
4. **Owner's Windows Release run.** NOT RUN; it is the owner's own run. It is
   expected to be green, and test hosts stop writing to
   `%LOCALAPPDATA%\ASP.NET\DataProtection-Keys`.
5. **Commit `test-report.md` and this file** on the change branch. The
   orchestrator does this. Both are uncommitted now.

## Draft pull request description

Title: `dataprotection-first-run: Give each test host an in-memory Data Protection key ring`

```markdown
**Must merge after #46 (change/aborted-request-log-race). This PR is stacked on it: keep it as a draft until #46 merges and this branch is restacked, as described below.**

## What and why

This closes follow-up FU-1 from #46 (tester finding F-1 in `docs/changes/aborted-request-log-race/test-report.md`).

On Linux the default ASP.NET Data Protection key ring is `~/.aspnet/DataProtection-Keys`, and it has no XML encryptor. A test host that makes a key logs `No XML encryptor configured. Key {…} may be persisted to storage in unencrypted form.` at Warning. On a fresh profile, the first host of a run makes a key. If that host belongs to `AbortedRequestTests`, its `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))` fails. CI has passed only because of test order: the warning appears in all 27 API job logs since 20 October, but always from an earlier host.

The fix: every test host built from `ApiFactory` gets its own in-memory key ring with an explicit `NullXmlEncryptor` (`KeyManagementOptions` in the existing `ConfigureTestServices`). Keys live and die with each host, and nothing is written to the profile. With no unencrypted key written to disk, the framework has nothing to warn about. A spike (plan 2.6) showed that the weaker variants still warn: an ephemeral provider, an in-memory ring with no encryptor, and a per-run folder.

## Scope and boundaries

- In scope: `api/tests/DigitalHub.Api.Tests/ApiFactory.cs` (+37 lines), the new `api/tests/DigitalHub.Api.Tests/TestHostDataProtectionTests.cs` (red test), and `docs/changes/dataprotection-first-run/` (plan, reviews, approvals, implementation, test report).
- Deliberately not touched: `AbortedRequestTests.cs` (#46 owns it, and no assertion is changed), `Program.cs`, `appsettings*.json`, the production Data Protection setup, and `ci.yml`. No package and no migration.
- Out of scope: FU-2 (the `RateLimitLogTests` race), which is a separate change. A shared sink helper. The Studio end-to-end job, whose real API process also logs this warning but does not assert on it.
- Until #46 merges, GitHub's diff here also shows #46's commits. After the restack it is only the files above.

## Security impact

None in production. Routes, policies, data, logins, secrets and dependencies are unchanged, and `api/src`, `api/tools` and `.github` are byte-identical (`git diff --quiet 2dbea44 HEAD -- api/src api/tools .github`, exit 0). In tests, keys are held unencrypted in memory for the life of one host and never written to disk. That is less exposure than today, when unencrypted key XML is written to `~/.aspnet` on Linux runners. The API protects nothing with Data Protection: JWT bearer only, and refresh and CSRF tokens are random secrets stored as SHA-256 hashes (plan 2.2). `InMemoryKeyRing` is `private sealed` inside the test-only `ApiFactory`.

## Tests and evidence

Local runs were on Linux, with SDK 10.0.114, in Release. The connection string pointed at a closed port (`127.0.0.1,4299`), and each run had a new empty `HOME`. Full logs are in `implementation.md` and `test-report.md`.

- Red, commit `a5d2104`, before the fix:
  - Command: `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~TestHostDataProtectionTests"`.
  - Result: exit 1, `Failed: 1`, `Collection: ["Warning: No XML encryptor configured. Key {…"···, …]` at `TestHostDataProtectionTests.cs:line 30`. It fails on both a fresh profile and a warm one.
  - The same tree with `AbortedRequestTests` on a fresh profile: exit 1, 5 of 6 passed, failing at `AbortedRequestTests.cs:line 45` (F-1 reproduced).
- Green, head `6060a6f`:
  - `TestHostDataProtectionTests`: exit 0, 1 of 1 passed.
  - `AbortedRequestTests`: 3 of 3 runs exit 0, 6 of 6 passed in each.
  - Both together: exit 0, 7 of 7 passed, in 3 of 3 runs by the developer, 3 of 3 by the tester and 3 of 3 by the tech lead.
  - With `RateLimitLogTests` added: 3 of 3 runs exit 0, 12 of 12 passed.
  - `AuthTests.Missing_admin_password_refuses_to_start|RateLimitLogTests.The_network_drops_the_host_part`: exit 0, 4 of 4 passed.
  - Every run: 0 `No XML encryptor` lines, and 0 entries under `HOME`.
- Build: `dotnet build DigitalHub.slnx -c Release` exit 0, `13 Warning(s) 0 Error(s)`. All 13 were already present at base, and none is in a changed file.
- Whole project without SQL Server: 478 tests discovered. The tests passing at the head are exactly those passing at the red commit, plus the new test.
- `.github/security/run-dotnet-audit.sh`: exit 0, `0 finding(s) at the gate's level`.
- NOT RUN:
  - The full integration suite (needs SQL Server). Covered by the `ci.yml` job "API — Release build, migrations, integration tests". Required on the final head: green; `grep -c "No XML encryptor"` on the job log = 0; total = latest green API total on the integration branch, plus #46's rows if #46 is not in it, plus 1. Job id: _to be filled_.
  - Semgrep, gitleaks and CodeQL. Covered by `security.yml` and `codeql.yml`. Run ids: _to be filled_.
  - The Studio end-to-end test, which does not use `ApiFactory`. Covered by the `ci.yml` Studio job.
  - The Windows Release run, which is the owner's own run.

## Owner decisions

None needed: the fix stays in test setup, and production Data Protection is not changed. Authority to proceed: "PUSH and continue" (Mohamed Elbadry, 9 November 2026, project thread), given after he was told of FU-1 and FU-2.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met. F-1's "All rows pass" on a fresh Linux profile is met on the head, locally. The CI total is the CI item below.
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (test code only, with typed options and no data access)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (N/A: no route changed)
- [x] Tests exist for the behaviour changed. The red test `a5d2104` was committed before the fix `d76ef67`. No changed-line coverage gate is configured in the workflows.
- [ ] PR checks are green on the final head (run IDs quoted). Open until the restack after #46 and CI on that head.
- [x] Independent code review was run and its findings are fixed or explicitly accepted below. These were the plan review in two rounds, the tester's review with probes P1 to P3 (no findings), and the tech-lead gates 1 and 2.
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (`plan-review.md`, `test-report.md`, `plan-approval.md`, `delivery-approval.md`)
- [x] Rollback is understood: revert this PR. Nothing persists, because the test key ring lives in memory.
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded. Nothing deploys until Phase D. The integrator who merges into `rebuild/dotnet-platform`, after #46, and re-runs the suites after the merge is _to be named_.

## Review findings accepted

- m-3 (plan review round 2): if #46 is squash-merged, restack with `git rebase --onto origin/rebuild/dotnet-platform 2dbea44`. This is accepted and binding as condition 5.
- R-4: a future host that does not derive from `ApiFactory`, or does not call `base.ConfigureWebHost`, gets the profile's key ring again. This is accepted. The comment in `ApiFactory` states the rule, and probe P3 confirmed the risk is limited to such a host. All current hosts comply. `MissingPasswordFactory` fails before Data Protection runs.
- The red test fails at line 30, not at line 22 or 23 as the plan estimated, because of the doc comment above the class. Accepted.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (N/A: no phase section. This change's coverage table is in `docs/changes/dataprotection-first-run/implementation.md` and `test-report.md`.)
- [ ] `docs/deferred-items.md` updated for any exception (N/A: no exception)
- [x] Documentation updated (`docs/changes/dataprotection-first-run/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
