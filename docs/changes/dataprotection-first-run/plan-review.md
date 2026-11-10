# Plan review: dataprotection-first-run

## Round 1

Reviewed `plan.md` revision 1 against base `78ee598`. Every run below was made in
a scratch export (`git archive 78ee598`, and `git archive origin/change/aborted-request-log-race`
at `2dbea44` for PR #46), never in this worktree. SDK 10.0.114, Release,
`ConnectionStrings__Content` pointed at the closed port `127.0.0.1,4299`, `HOME`
set to a new empty scratchpad folder per run. Every `.aspnet` folder those runs
created was deleted afterwards; `/root/.aspnet` does not exist.

### Findings

**M-1 (Major). Section 2.6, 5.2 step 2, 5.3, 10 (R-2), 9: the PR #46 dependency
is advice, not a precondition, and the fix makes the race it depends on much more
likely to fire.**

*What is wrong.* The plan says the fix "does not cause" the request-log race and
that the integrator "should" merge PR #46 first or rebase. It also lets 5.2 step 2
pass on this branch with failures at `AbortedRequestTests.cs:39`, `40` or `61`,
and proves F-1's "Done when" ("All rows pass") only on a scratch merge that is
never the head being merged. That is not sound, because the fix changes how often
the race fires, not just whether it is visible:

| Tree, filter, `HOME` | Runs | Result |
|---|---|---|
| Base, `AbortedRequestTests`, profile already holding a key | 5 | 5 of 5 exit 0, 4/4 passed |
| Base + fix, `AbortedRequestTests`, fresh each time | 3 | 1 of 3 exit 1 (`AbortedRequestTests.cs:line 40`), 0 `WRN` |
| Base + fix, `TestHostDataProtectionTests\|AbortedRequestTests`, fresh each time | 3 | 3 of 3 exit 1, `Failed: 1, Passed: 4`, all at `AbortedRequestTests.cs:line 39`, 0 `WRN` |
| PR #46 head + fix, same filter, fresh each time | 5 | 5 of 5 exit 0, `Passed: 7, Total: 7`, 0 `WRN`, 0 files or folders under `HOME` |

The plan's own spike shows the same (`Failed: 1`, `2`, `1` of 5 on base). Today
the race failed 1 of 27 CI API jobs (2.5). After this change it fails most runs
of the filtered set here. If this PR merged before #46,
`rebuild/dotnet-platform` would very likely get a flaky or red API job. The
PR's own CI on a head without #46 could also go red, and B-3 says a head needs
green CI. Accepting known `:39/:40/:61` failures as "reported, not fixed" on the
head that merges is close to weakening the test (P-6), even though no assertion
changes.

*What would satisfy me.*
1. State the dependency as a hard precondition: either stack this branch on
   PR #46's head, or require #46 merged into `rebuild/dotnet-platform` and this
   branch rebased onto it (B-3) before this PR is opened for merge. Name it in
   section 9 or in a "Merge order" line as a blocking condition for the
   integrator, not a "should".
2. Make 5.3's evidence (three fresh-`HOME` runs, `Passed: 7`, 0 warnings, 0
   profile entries) required on the actual head to be merged, and CI green on
   that head. Keep the base-only 5.2 step 2 runs as information, not as a pass
   condition.
3. Correct 2.6 and R-2. They should say that the fix raises the race's exposure
   compared with a warm-profile base (cite the warm-base runs). They should not
   say only that the race might be "mistaken for this change failing".

**m-1 (Minor). Section 2.2: the quoted grep does not return what the plan says.**
`grep -rn "Protect\|TokenProvider\|IDataProtection\|GeneratePasswordResetToken\|Antiforgery" api/src api/tests`
returns nothing at `78ee598`. It does not find `AdminStore.ResetPasswordAsync`
(which is `api/src/DigitalHub.Api/Content/AdminStore.cs:382`, found only by
searching `RemovePasswordAsync`). The conclusion stands, but the evidence line
should quote what the command actually prints (P-8).

**m-2 (Minor). Section 2.3 / R-4: the guard depends on a convention.**
The red test covers one subclass. A future `WebApplicationFactory<Program>` that
does not derive from `ApiFactory` (like `MissingPasswordFactory`) would get the
profile ring again. The comment and R-4 are an acceptable mitigation. No change
is required, but the comment should say "every host must derive from `ApiFactory`
and call `base.ConfigureWebHost`".

### Checked and sound

- **Repro of F-1 at base.** Fresh `HOME`, `--filter "FullyQualifiedName~AbortedRequestTests"`:
  exit 1, `Total tests: 4, Passed: 3, Failed: 1`, failing row
  `A_client_that_disconnects_mid_body_is_not_a_server_error(path: "/api/v1/public/contact")`,
  `Collection: ["Warning: No XML encryptor configured. Key {b5c1560"···]`, the
  only `WRN` line in the log, and one `key-*.xml` written under
  `$HOME/.aspnet/DataProtection-Keys`. Second run on the same `HOME`: exit 0, 4/4.
- **Nothing needs persisted keys.** Data Protection arrives only through
  `AddAuthentication` (`Program.cs:210`). No `AddDataProtection`, `AddCookie`,
  `AddAntiforgery`, `AddDefaultTokenProviders`, session, TempData or Razor in
  `api/src`. Authentication is JWT bearer with a symmetric key from configuration.
  Refresh and CSRF tokens are `RandomNumberGenerator` secrets
  (`TokenService.cs:280`) stored as SHA-256 hashes in the database
  (`TokenService.cs:170-172`), not protected payloads. Password reset uses
  `RemovePasswordAsync`/`AddPasswordAsync`, not a token. `api/tests` has no
  Data Protection consumer either. R-1 is real but low, and CI covers it.
- **Applies to every test host.** All test hosts are `ApiFactory` or its
  subclasses calling `base.ConfigureWebHost`, except `MissingPasswordFactory`
  (`AuthTests.cs:297`), which fails before start-up. `KeyManagementOptionsSetup`
  is registered by `Program.cs`'s `AddAuthentication`, before
  `ConfigureTestServices`, so the test's `Configure` runs after it and wins. In
  my run, 0 files and 0 folders were created under `HOME` with the fix.
- **Cannot reach production.** `ApiFactory.cs` is in `DigitalHub.Api.Tests`,
  which nothing in `api/src` or `api/tools` references (only the test project
  references the API). `Program.cs` and `appsettings*.json` are untouched. The
  Studio end-to-end job uses the real process, not `ApiFactory`.
- **Red test fails at base on Linux and is not order-dependent.** I wrote the
  test as 5.1 describes (sink factory, `IKeyManager.CreateNewKey`, unfiltered
  `Assert.Empty(AtLeast(Warning))`, protect/unprotect round trip). At base:
  fresh `HOME` exit 1 with two warnings (`Key {cf153e3"···`, `Key {a0fe1b3"···`).
  `HOME` already holding keys: exit 1 with one warning (`Key {ef1cd1b"···`).
  Run together with `AbortedRequestTests`: still red. Because it makes its own
  key in the asserting host, it does not rely on profile state or order. After
  the fix, together with AbortedRequestTests on PR #46's head, it passed 5 of 5.
  On Windows it is green at base (DPAPI); the plan says so, and CI on Linux is
  the red evidence.
- **The chosen variant is the minimum that works.** The plan's spike rejects
  ephemeral provider, repository-only and per-run folder, and the reasons are
  consistent with how `XmlKeyManager` decides to warn (no encryptor). The
  fix with `NullXmlEncryptor` gives 0 `WRN` lines. Build: 0 warnings in the
  test project, base and fixed.
- **No assertion weakened (P-6).** `AbortedRequestTests.cs` is untouched; PR #46's
  `ApiFactory.cs` is identical to base, so the two changes touch different files
  and merge cleanly. `RateLimitLogTests` and `AdminApiTests` warning checks are
  unaffected, as 2.4 says.
- **Scope (B-8)**, one topic, two test files. Track G1 checklist items marked N/A
  correctly. No migration, no package, no secret, no workflow change.
- **Commands.** All Release. `DigitalHub.slnx` and both 5.2 step 4 test names
  exist (`AuthTests.cs:253`, `RateLimitLogTests.cs:70`). Rollback is a revert.
- **Owner decisions.** None needed. Production Data Protection stays out of
  bounds, as the change context requires, and the spike shows the test setup is
  enough.
Round 1 verdict: CHANGES NEEDED (M-1, m-1, m-2).

## Round 2

I reviewed `plan.md` revision 2. The branch `change/dataprotection-first-run` now
points at `2dbea44`, PR #46's head (`git merge-base --is-ancestor 2dbea44 HEAD`
succeeds). I checked every answer again myself. My runs used a scratch export of
`2dbea44` with the test from round 1 and the planned `ApiFactory.cs` change
copied in. Every run used SDK 10.0.114 in Release, the closed port
`127.0.0.1,4299`, and a new empty `HOME`, unless marked warm. "Profile" counts
every entry under `HOME`. I deleted every `HOME` folder afterwards: no `.aspnet`
is left in the scratchpad, and `/root/.aspnet` does not exist.

### Round 1 findings

- **M-1: resolved.**
  - The top of the plan and section 9 now make the merge order a blocking
    condition. The branch is stacked on #46. If #46 merges first, this branch
    is rebased and CI is re-run (B-3). If #46 closes unmerged, the change
    returns to step 1.
  - In 5.2, every check is now a pass condition on the head that merges.
    None of them accepts a failure at any line, and CI must be green before
    the PR is opened for merge (step 6).
  - The base-only exposure check is now 5.3, labelled information only.
  - 2.6 and R-2 now say the fix raises the race's exposure, and cite the
    warm-base comparison.
- **m-1: resolved.** 2.2 now quotes the grep as printing nothing (exit 1). It
  adds a second grep that finds `AdminStore.cs:382,385`, which matches what I
  get at `78ee598`.
- **m-2: resolved.** The 3.1 comment now says every test host must derive from
  `ApiFactory` and call `base.ConfigureWebHost`. R-4 says the same.

### My runs on the stacked head `2dbea44`

| Step | Filter | Result |
|---|---|---|
| Red, fresh `HOME` (PR #46's `ApiFactory.cs` + new test) | `TestHostDataProtectionTests` | `Total tests: 1, Failed: 1`, `TestHostDataProtectionTests.cs:line 22` (the `Assert.Empty`), "No XML encryptor" warnings, profile 4 |
| Red, same `HOME` again (keys present) | same | `Failed: 1`, same line, warning still present, profile 5 |
| No fix, fresh `HOME` | `AbortedRequestTests` | `Total tests: 6, Passed: 5, Failed: 1`, `AbortedRequestTests.cs:line 45`, which is PR #46's `Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning))`. F-1 reproduces on this head. |
| Fix, fresh `HOME`, 3 runs | `AbortedRequestTests` | 3 of 3 `Passed: 6, Total: 6`, 0 warnings, profile 0 |
| Fix, fresh `HOME`, 3 runs | `TestHostDataProtectionTests\|AbortedRequestTests` | 3 of 3 `Passed: 7, Total: 7`, 0 warnings, profile 0. These 3 runs, plus 5 of 5 in round 1, make 8 of 8. |
| Fix, fresh `HOME` | `AuthTests.Missing_admin_password_refuses_to_start\|RateLimitLogTests.The_network_drops_the_host_part` | `Passed: 4, Total: 4` |
| Fix build, test project | — | exit 0, no compiler warning in `ApiFactory.cs` or `TestHostDataProtectionTests.cs` |

My numbers match the plan's table in 2.7. The plan gives the red failure at
`line 23`; I got `line 22` because my test is formatted differently. The
developer's own red run records the real line.

### Minor, non-blocking

- **m-3 (Minor, 9 / top).** While #46 is open, this PR's diff on GitHub includes
  #46's commits. If #46 is squash-merged, a plain rebase can replay those
  commits. The plan already says to rebase before merge. Using
  `git rebase --onto origin/rebuild/dotnet-platform 2dbea44` makes it exact. No
  plan change is required.
- The CI total of 478 (477 + 1, from job `129072328525`) is NOT RUN here; it is
  covered by the `ci.yml` API job on this head. So is the `grep -c "No XML encryptor"`
  = 0 check.

### Still sound from round 1

These were checked in round 1 and nothing in revision 2 changes them:
- Nothing in the API or the tests consumes Data Protection: JWT bearer only, and
  refresh and CSRF tokens are random secrets stored as SHA-256 hashes.
- The fix sits in `ApiFactory` and reaches every live test host.
- It cannot reach production: only the test project references this code, and
  `Program.cs` and appsettings are untouched.
- `AbortedRequestTests.cs` is unchanged, and no assertion is weakened (P-6).
- Scope is one topic (B-8). There is no migration, package or workflow change,
  and no owner decision is needed.

Verdict: APPROVED
