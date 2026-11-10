# Plan approval: dataprotection-first-run (gate 1)

Gate 1, held by the technical lead. Reviewed `plan.md` revision 2 and
`plan-review.md` rounds 1 and 2. The latest round ends `Verdict: APPROVED`, with
M-1, m-1 and m-2 resolved and one new Minor, m-3. This approval moves the change
to the developer. It is not the owner's confirmation that `AGENTS.md` requires,
and it is not an owner decision (P-7).

## Decision

Approved, with the conditions below.

## Reasons

- **It is the right change.** It closes FU-1 (F-1 in PR #46's `test-report.md`)
  at its cause. The test host stops using the profile's key ring and gets an
  in-memory ring with an explicit `NullXmlEncryptor`, so it never writes an
  unencrypted key and the framework has nothing to warn about. No
  `Assert.Empty(AtLeast(Warning))` is filtered or relaxed (P-6), and
  `AbortedRequestTests.cs` is untouched. The plan's spike (2.6) rules out the
  weaker variants with evidence: an ephemeral provider, a repository with no
  encryptor, and a per-run folder all still log the warning. The reviewer checked
  that nothing in `api/src` or `api/tests` uses Data Protection, so R-1 is low and
  the full suite in CI covers it.
- **Production is untouched.** Only `ApiFactory.cs` and a new test file change,
  in the test project, which nothing in `api/src` or `api/tools` references.
  `Program.cs` and `appsettings*.json` stay as they are, as the change context
  requires. No owner decision is needed. The owner's authority to proceed is
  "PUSH and continue" (Mohamed Elbadry, 9 November 2026, project thread).
- **Execution order.** This change has no refinement-plan id or severity, so the
  Wave and Blocker-before-Major rules do not rank it. It is a follow-up that
  depends on PR #46 and takes the next slot after #46 is merged. It must not go
  ahead of #46 (see the merge-order condition). It changes different files from
  every other open PR, so it does not hold up any planned item.
- **The merge-order condition is right, and I am making it binding.** The
  reviewer's round 1 runs and the plan's 2.6 show the cost of merging without
  #46. On a tree without #46, the fix makes the request-log race fail 3 of 3
  filtered runs, compared with 5 of 5 green on a warm base. That would very
  likely make the API job on `rebuild/dotnet-platform` flaky. With #46 stacked
  underneath, the reviewer got 8 of 8 green and the plan got 3 of 3. The plan
  already states the condition at the top and in section 9. I adopt it as
  written and add the mechanics below.

## Conflict check (run by me)

I listed the open PRs with
`gh api 'repos/{owner}/{repo}/pulls?state=open'`. They are #37, #40, #41, #42,
#43, #44 and #46. I fetched each head (`git fetch origin pull/<n>/head`) and
diffed it against its merge base with `origin/rebuild/dotnet-platform`
(`78ee598`):

| PR | Head | Touches `ApiFactory.cs` or `TestHostDataProtectionTests.cs` | Relevant |
|---|---|---|---|
| #37 pipeline agents | `cdc6a76` | No (`.claude/` only) | — |
| #40 GAP-12 Server header | `88fd777` | No | Changes `Program.cs` (`ConfigureKestrel(AddServerHeader = false)`, not Data Protection) and adds `ServerHeaderTests.KestrelFactory : ApiFactory`. That factory does not override `ConfigureWebHost`, so it inherits this fix. No conflict. It does add tests, so the CI total changes (condition 6). |
| #41 GAP-08 actionlint | `b31c6d1` | No (`.github/` only) | — |
| #42 GAP-06 migration script | `9d46168` | No (`ci.yml`, migrations, `api/tools`) | — |
| #43 GAP-04 browser suite | `71ea04e` | No (`ci.yml`, `website/`) | — |
| #44 GAP-07 dependency audit | `e8a8d9d` | No (`.github/security`, `security.yml`) | — |
| #46 aborted-request-log-race | `2dbea44` | No (`AbortedRequestTests.cs` only) | Base of this branch. `ApiFactory.cs` is byte-identical between `78ee598` and `2dbea44` (`git diff --stat` is empty). |

No open branch conflicts with this change. `api/tests` contains 13
`ApiFactory`-derived or `WebApplicationFactory<Program>` hosts. The only direct
`WebApplicationFactory<Program>` is `MissingPasswordFactory` (`AuthTests.cs:297`),
as the plan says.

## Conditions for the developer

1. **Scope.** Change only `api/tests/DigitalHub.Api.Tests/ApiFactory.cs` (the
   block, nested class, `using` lines and comment from 3.1 and 4) and the new
   `api/tests/DigitalHub.Api.Tests/TestHostDataProtectionTests.cs`, plus this
   folder's records. `AbortedRequestTests.cs`, `Program.cs`, `appsettings*.json`
   and `ci.yml` stay unchanged. If the plan cannot be followed, stop and send the
   change back to step 1.
2. **Red first (P-4, B-6).** Commit the 5.1 test on its own, before the
   `ApiFactory.cs` change. Record the red run on Linux with a fresh `HOME`: the
   command, exit 1, the `Collection:` line, the real line number, and the count
   of entries under `HOME`.
3. **Pass conditions on the real head.** Run 5.2 steps 1 to 5 on the actual
   commits, with a new empty `HOME` per run, the scratchpad SDK, Release, and the
   closed port. Any failure, at any line, is reported before anything is fixed.
   Delete every `HOME` folder and any `~/.aspnet` you create.
4. **Stack integrity.** The head that merges must contain PR #46's head as merged
   or approved. If #46 gets new commits before this change merges, restack with
   `git rebase --onto <new #46 head> 2dbea44` and re-run 5.2 steps 1 to 5.
5. **Merge order (blocking, for the integrator), and m-3.**
   - The PR's first line states that it must not merge before #46. While #46 is
     open, open this PR as a draft or not at all, because its GitHub diff includes
     #46's commits.
   - When #46 merges, update this branch before it is marked ready:
     - If #46 was squash-merged, run
       `git rebase --onto origin/rebuild/dotnet-platform 2dbea44`. A plain rebase
       is not acceptable here. The recent merges into `rebuild/dotnet-platform`
       (#38, #39, #45) were all squash merges, so this case is the likely one.
     - If #46 was merged with a merge commit, a plain rebase or a merge of
       `rebuild/dotnet-platform` is acceptable (B-3).
   - After either update, `git diff --name-only origin/rebuild/dotnet-platform...HEAD`
     must list only the two test files and `docs/changes/dataprotection-first-run/`.
     Then re-run 5.2 steps 1 to 5 on that head.
   - Push a rewritten change branch only with `--force-with-lease`, and never
     force-push a shared branch (B-5).
   - If #46 closes unmerged, the change stops and returns to step 1.
6. **CI on the head that merges (5.2 step 6, 5.4).**
   - The `ci.yml` API job must be green.
   - `grep -c "No XML encryptor"` on that job's log must return 0.
   - The test total must be the total from the latest green API job on the
     integration branch this head sits on, plus #46's rows if #46 is not yet in
     it, plus 1. The plan's figure of 478 holds only if nothing else that adds
     tests merges first. #40, for one, adds `ServerHeaderTests`. Give the
     arithmetic and the job id.
   - The Security workflow must be green. A Semgrep or CodeQL finding on
     `NullXmlEncryptor` goes back to the plan (R-3) and is never suppressed.
7. **Records.** `implementation.md` fills in the evidence column of the
   section 11 coverage table for each row. Items that only CI can prove are
   marked NOT RUN, with the job named.

## Reviewer's Minors

- **m-1, m-2:** resolved in revision 2. I checked both in the plan text (2.2's
  grep quotes, the 3.1 comment and R-4).
- **m-3 (rebase `--onto` if #46 is squash-merged):** accepted, and made binding
  as condition 5 rather than left as advice. The repo's own history shows
  squash merges are the norm, so this is the expected case.
- **Red line 22 versus 23:** accepted. The developer's red run records the real
  line (condition 2).
- **CI-only checks (478 total, warning count 0):** accepted as NOT RUN here and
  covered by the `ci.yml` API job (condition 6, with the corrected total rule).

## Risk

Acceptable. The fix applies only to test hosts and is removed by a revert. The
one real hazard, raising the race's exposure without #46, is removed because the
branch is stacked on #46, the merge order binds the integrator, and the pass
conditions accept no failure. R-4, a future host outside `ApiFactory`, is
mitigated by the comment and accepted as the reviewer agreed.

Verdict: APPROVED
