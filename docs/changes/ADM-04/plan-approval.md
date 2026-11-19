# ADM-04: plan approval (gate 1)

Technical lead, gate 1, 12 November 2026. Plan approved: `docs/changes/ADM-04/plan.md`
round 3 at `59e1269`, reviewed in `plan-review.md` Round 3 at `922e617`
(`Verdict: APPROVED`, Minors R3-1 and R3-2). Branch `change/ADM-04`, head `922e617`,
cut at `32f0414`. `origin/rebuild/dotnet-platform` is `2bbd586` (ADM-10 merged as #56).

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires, and it is not an owner decision (P-7).

## Decision

Approved, with the conditions below. The plan is the right change for ADM-04 at this
point, it conflicts with no open branch, and every owner decision it needs is
answered and quoted.

## What I checked myself

Read: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, the plan (all 1,344 lines),
all three review rounds, the finding (`admin-audit-2026-10-28.md` lines 105-116), and
the refinement plan's execution order (lines 15-33) and G3 table (lines 219-226).
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md` and
`.github/pull_request_template.md` do not exist in the worktree (`ls`: "No such file
or directory"). Rules held only there were not applied; see the open items.

Commands run (read-only):

- `git rev-parse origin/rebuild/dotnet-platform origin/change/ADM-05` after
  `git fetch`: `2bbd586...` and `741d70c...`. ADM-05 is not merged, as the coordinator
  says.
- `git diff --name-only 32f0414 HEAD`: only `docs/changes/ADM-04/plan.md` and
  `plan-review.md`. No code has been written yet.
- `git diff --name-only 32f0414 origin/rebuild/dotnet-platform`: ADM-10's files only
  (`AdminStore.cs`, `SettingsPage.tsx`, settings and seo tests, `head.ts`, ADM-10 docs).
  None is in this plan's scope, so the planned merge of `2bbd586` (4.1 step 2) should
  not conflict.
- For every `origin/change/*` head, `git diff --name-only $(git merge-base <head>
  origin/rebuild/dotnet-platform) <head>` filtered on this plan's files (`Program.cs`,
  `UsersPage`, `UserAccess*`, `TemporaryPassword`, `UserRole*`, `ReactivationLog*`,
  `users.(test|spec)`): only `origin/change/GAP-12: Program.cs`. GAP-12 is merged
  (`gh api .../pulls/40`: `merged: true`, `a866cf6`), and
  `git diff --stat origin/change/GAP-12 origin/rebuild/dotnet-platform -- Program.cs`
  is empty. **No open branch touches a file in this plan's scope.**
- ADM-05's file list (plan 2.8) is `AdminStore.cs`, `ContentStore.cs`,
  `PublishChecks.cs`, `AdminControllers.cs`, error-page tests and `ErrorPagesPage.tsx`.
  This plan does not touch them. ADM-05's approval condition 7 ("ADM-04 does not start
  on `AdminStore.cs` or `AdminControllers.cs`" until ADM-05 merges) is met by design.
- Code claims spot-checked at `2bbd586`: `Program.cs:76` is
  `AddScoped<AdminStore>()`, so the one new line goes after it;
  `TokenService.RevokeUserAsync(string, Guid?, CancellationToken)` is public at
  `api/src/DigitalHub.Api/Auth/TokenService.cs:159` and reads only `RefreshTokens`
  (so it cannot trip the `[AspNetUserRoles]` gate); the ADM-07 lock pattern is at
  `AdminStore.cs:199-214`; `NewTemporaryPassword` and `IsDeactivated` are at
  `AdminStore.cs:858-861` (shifted by ADM-10, as the plan warns). No file the plan
  creates exists yet.
- I traced T3, T15 (green and broken) and T16 against 3.1's step order and agree with
  the reviewer: the guard is reached through HTTP only with a stale actor, T15 tells a
  lock-first store from a read-first store, and T16 reaches the deactivated-actor
  branch on the role route.

## Why this is the right change, now

- **Order.** G3-1 is slot 2, 3 to 16 November, batch order "ADM-06, 03, 02, 07, 10, 05,
  04, 12, 01a" (refinement plan line 26). ADM-06, 03, 02, 07 and 10 are merged. ADM-05
  is ahead of ADM-04 in that list but not merged. Because the two share no file, I
  accept ADM-04 being built in parallel, and either merging first, subject to the
  slot-2 limit (condition C11). ADM-04 is a Blocker, so no Major is ahead of it. Wave 0
  and the ISO-4/ISO-5 order do not apply (G3).
- **Scope.** It closes all four "Fix" rows of the finding: role change with the
  last-admin guard, reactivate, the O-15 decision (no delete), and the UI. It keeps to
  new files plus one line in `Program.cs` and `UsersPage.tsx`.
- **Risk.** The role change is the strongest action in the Studio. The plan takes an
  exclusive app lock first, re-reads the actor fresh inside it, revokes refresh tokens
  and rotates the stamp, and proves each with a red-first test (T2, T3, T13 to T16). No
  migration, no package, no grant. Rollback is a revert.
- **Residual exposure accepted for this change.** A deactivate racing a demotion (or
  two deactivates, which exists today) can still leave no active admin until ADM-04b
  locks `DeactivateUserAsync`. Fixing it needs `AdminStore.cs`, which ADM-05 holds. The
  exposure is narrow, already present on the deactivate path, recoverable with the
  elevated account, and stated for the owner in the PR body. I accept it on condition
  C10.

## Owner decisions

All three answered by card tap, Mohamed Elbadry, 12 November 2026, 12:09 UTC, in the
project thread, as relayed and confirmed by the coordinator in the gate 1 prompt. I
have not seen the cards myself.

- O-ADM04-1 (O-15): "No, deactivate is enough". No delete code, no ADM-04c.
- O-ADM04-2: "New temporary password". Reactivate issues a temporary password with
  `MustChangePassword`.
- O-ADM04-3: "Yes, red tests first". The tests-only commit is pushed first so CI shows
  the red.

Nothing is blocking on the owner. B1 to B10 and the "Known exposure until ADM-04b"
line are behaviour the owner sees in the PR body and confirms at the end of the
pipeline.

## Reviewer Minors accepted

- **R3-1** (T15 is deterministic only if both requests reach the gate within the 2 s
  cap). Accepted, with condition C5.
- **R3-2** (the reactivate route's deactivated-actor branch, and the admin count's
  place inside the lock, are review-only). Accepted, with condition C6. The argument
  that the count's place cannot change any outcome while the actor check sits inside
  the lock is sound.
- Every Round 1 and Round 2 finding is closed (Round 2 and Round 3 tables).

## Conditions for the developer

- **C1. Follow round 3 at `59e1269`.** If a step cannot be followed, including any
  need to touch `AdminStore.cs`, `AdminControllers.cs`, `ContentStore.cs`,
  `PublishChecks.cs`, `ErrorPagesPage.tsx`, `TokenService.cs`, `SessionCheck.cs` or an
  existing test file, stop and send the change back to step 1. Do not adapt the plan.
- **C2. Merge, never rebase.** Commit 0 merges `origin/rebuild/dotnet-platform`
  (`2bbd586`) into `change/ADM-04`. Quote `git log --oneline -3
  origin/rebuild/dotnet-platform` and `git merge-base --is-ancestor 2bbd586 HEAD`
  (exit 0) in `implementation.md`. If ADM-05 merges while ADM-04 is open, merge again
  and re-run every 5.3 suite.
- **C3. Overlap check before commits 3 and 4**, quoted (4.1 step 3), over every
  `origin/change/*` head. Any overlap: stop and report.
- **C4. Red first, on the exact SHA of commit 1.** GitHub Actions is blocked by a
  billing problem on the owner's account, so a push will not produce a run now.
  - Push commit 1 (tests only: T1 to T16 and E1) as planned and open the pull request.
    Do not amend or force-push commit 1 afterwards.
  - Do not push commit 2 or later until a CI run on commit 1's SHA has finished `api`,
    `website` and `studio` (`cancel-in-progress: true`). Commits 2 to 5 may be made and
    tested locally meanwhile.
  - If Actions is still blocked when the code is ready, the developer either (a) waits,
    or (b) produces the red locally on commit 1's SHA against SQL Server and
    `DigitalHubContent_Test` / `DigitalHubContent_E2e` (reset first), in Release, quoting
    the command, exit code and each failing assertion. Neither may be reported as CI
    evidence. Anything not run is NOT RUN with the reason.
  - Gate 2 will not approve without red evidence at commit 1 for T1 to T11, T13 to T16
    and E1 (each failing at the planned step), and S1, S2, S4 to S6 at commit 2, with T12,
    S3 and S7 green.
- **C5. (R3-1)** T15 and T16 log, next to each matched `CommandText`, the time each
  request was sent and the time each match arrived, through `ITestOutputHelper`. The
  three consecutive runs required by 5.3 are quoted with those lines. A run in which
  the two T15 requests did not both reach the store within the cap counts as not
  evidence, not as a pass.
- **C6. (R3-2)** `implementation.md` gives the `UserAccessStore.cs` line numbers for:
  the `sp_getapplock` call as the first statement in each transaction; the target
  load, the admin count and `EnsureActorAsync` after it; `EnsureActorAsync` reading
  with `AsNoTracking` and a fresh roles query; and the reactivate route calling
  `EnsureActorAsync` after the lock. The tester confirms them by reading.
- **C7.** At commit 3, confirm and quote (test output, not memory) that Identity's
  `GetRolesAsync` SQL names `[AspNetUserRoles]` with the user id as a parameter, the
  warm-up shows `Matched` 0, and a stale `ConcurrencyStamp` yields
  `ConcurrencyFailure`. If any of these is false, stop and report (C1).
- **C8.** `implementation.md` lists each copied helper (`IsDeactivated`, `Audit`,
  `Missing`, `Validation`, the temporary-password generator) with its source lines in
  `AdminStore.cs` at the merged base, for ADM-04b to remove.
- **C9.** Release builds and tests only; ports 42xx; never `DigitalHubContent`; no
  secret printed or committed; never stop a process you did not start. Build warnings
  no more than the base's.
- **C10.** The pull request body carries B1 to B10, the "Known exposure until ADM-04b"
  line, and the three owner answers quoted exactly as in this file, marked "as relayed
  by the coordinator".

## Conditions for the coordinator and integrator

- **C11.** Slot 2 carries at most one pull request a day. ADM-10 merged today
  (12 November, 11:58 UTC), so ADM-04 does not merge today. ADM-04 and ADM-05 merge in
  whichever order passes gate 2, one at a time, with the suites re-run after each.
- **C12.** ADM-04b is planned as soon as ADM-05 merges, ahead of ADM-12 and ADM-01a.
  Note for the owner: ADM-04, ADM-05, ADM-04b, ADM-12 and ADM-01a are five pull requests
  for 13 to 16 November against a one-a-day slot, so the 16 November G3-1 date is at
  risk. That is a scheduling call for the owner, not a gate 1 blocker.

## Open items (not blocking gate 1)

- `ENGINEERING_STANDARDS.md` (B-4 commit subjects and trailers, B-6) and
  `.github/pull_request_template.md` are missing from the worktree. Gate 2 will check
  commits and the PR body against the precedent of the ADM-05, ADM-07 and ADM-10
  records unless the files are supplied.
- CI on any head, red or green, waits on the owner fixing the Actions billing problem.
  The final-head green in every workflow (5.4) stays open until then.
- The owner's card answers were not seen first-hand by the architect, the reviewer or
  me.

Verdict: APPROVED
