# ADM-04: plan review

## Round 1

Reviewer: plan-reviewer (senior quality engineer and software architect), 12 November
2026. Plan reviewed: `docs/changes/ADM-04/plan.md` at `4ad921b` on `change/ADM-04`
(base `32f0414`). `origin/rebuild/dotnet-platform` is `2bbd586` (ADM-10 merged as #56).
All code claims were checked with `git show 32f0414:<path>` and `git grep 32f0414`.
Nothing was built or run. There is no `dotnet`, SQL Server or `node_modules` here, so
this review reads the code and does not run it.

Required reading: `docs/changes/README.md`, `AGENTS.md` (the same as `CLAUDE.md`), and
`/mnt/attach/project-files/docs/quality/refinement-plan-2026-10-28.md` and
`admin-audit-2026-10-28.md` (lines 105-116 for the finding). I also read the ADM-05,
ADM-07 and ADM-10 approval records for precedent. `ENGINEERING_STANDARDS.md` and
`docs/PROJECT_PROFILE.md` do not exist in the worktree, on `origin/rebuild/dotnet-platform`
(`git ls-tree -r`) or under `/mnt/attach/project-files`. Rules that only those two files
hold could not be checked. ADR 0001 does not apply (this is G3).

### Findings

**F-1. Major. Sections 3.1 step 3, 5.1 T9, and 10 (row "Concurrent demotions"). No
test proves that the last-admin count is read inside the lock.**
- What is wrong: the plan's main concurrency claim is that two demotions at once
  cannot both pass the guard, because "the user and its roles" are loaded and counted
  "inside the lock". T9 holds `digitalhub:admins` from outside and expects 503
  `users_busy` with the target unchanged. That only shows the lock is taken somewhere
  before the write. If an implementation loaded the user, counted the admins, and only
  then called `sp_getapplock`, T9 would still pass, and two demotions could both pass
  the count. The risk table says "T9 proves the role change waits for the lock", and
  the coverage row "Concurrent role changes cannot both pass the guard" has nothing
  else behind it.
- Evidence:
  - In the design, the guard is reachable through HTTP only with a stale actor: an
    admin whose demotion has committed while their request is in flight. T3 simulates
    exactly that state.
  - So the real case is two admins demoting each other at the same moment, and no
    planned test runs that interleaving.
  - The repository already has the pattern. `RedirectConcurrencyTests.GatedApiFactory`
    (`RedirectConcurrencyTests.cs:20-40` at the base) holds one request at a gate while
    the other runs.
- What would satisfy me: a red-first test that interleaves the two last active
  admins, A demoting B and B demoting A, through a gate placed after the guard read.
  Exactly one request returns 200 and the other 400 `last_admin`, and one active admin
  remains. The test must fail if the read moves outside the lock. Alternatively, T9
  can be rewritten so that it fails when the user load or the admin count happens
  before `sp_getapplock`. Either way, the risk table and the coverage row should name
  the test that actually proves the claim.

**F-2. Major. Section 5.1 T10 and section 6 "Audit". The log test does not look at the
application's logs.**
- What is wrong: T10 is meant to prove that the reactivation password is never
  logged. It is specified as the "Same harness as
  `AdminApiTests.Temporary_password_does_not_appear_in_application_logs` (Serilog
  `CollectingSink`)". That harness (`AdminApiTests.cs:410-418` at the base) builds a
  private `LoggerConfiguration`, logs a synthetic object into it, and checks that
  `SensitiveDestructuringPolicy` redacts the value. It never sees anything the API
  logs while it handles a request. A T10 built that way could not fail if
  `ReactivateAsync`, the request log (`UseSerilogRequestLogging`, `Program.cs:274`) or
  an exception path logged the password. The plan's own wording ("no log event's
  rendered text or property contains the `temporaryPassword`") needs a sink inside the
  application, so the plan contradicts itself.
- Evidence: the repository already captures application logs, through
  `ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink))` in
  `RateLimitLogTests.LoggingFactory` (`RateLimitLogTests.cs:85-97`). The same pattern
  is in `AbortedRequestTests` and `TestHostDataProtectionTests`.
- What would satisfy me: T10 runs a real reactivation against a factory with an
  application-level `ILogEventSink`, at every level and including request-log events.
  It asserts that the returned `temporaryPassword` appears in no rendered message and
  no property, and that the audit `Detail` does not contain it either. It should be
  red at the base on the reactivation status, not on a missing sink. Option (b) needs
  no such test, and the plan already says so.

**F-3. Minor. Sections 4.2 (ADM-04b) and 10. The new demote-versus-deactivate race is
deferred with no date.**
- What is wrong: `DeactivateUserAsync` (`AdminStore.cs:383-414`) counts admins with
  no lock, and outside its own transaction. Once this change lands, "A demotes B"
  running alongside "B deactivates A" can leave no active admin, and recovery needs
  database work with the elevated account. Two deactivates can already do this today.
  This change adds a second path. The plan states the race honestly. ADM-04b, however,
  has no date and no owner, and it is not in the G3-1 batch.
- What would satisfy me: give ADM-04b a target date. Because ADM-05's head `e04e57a`
  is pushed, that should be the first change after ADM-05 merges and inside G3-1.
  The PR body should list the residual race as a known exposure until then.

**F-4. Minor. Section 3.2. `Modal.confirm` clashes with the Studio's test guard and
theme.**
- What is wrong: `Modal.confirm` is antd's static API. It mounts its own root in
  `document.body`, outside the tree that `render()` and `cleanup()` own, and it does
  not read the app's `ConfigProvider`, so it ignores the navy theme. `git grep` finds
  no `Modal.confirm` or `useModal` anywhere in `studio/src` at the base, so this would
  be a new pattern. The `afterEach` the plan copies from `redirects.test.tsx:109-113`
  asserts `document.body.innerHTML === ""` (ADM-06b-flake). A static confirm that
  closes with an animation can leave nodes behind. Then S1, S2, S5 and S6 would fail
  at green, or invite someone to loosen that guard, which P-6 forbids.
- What would satisfy me: name an in-tree dialog, either `Modal.useModal()` with its
  `contextHolder` rendered in `UsersPage` or a controlled `<Modal>` like the create
  and temporary-password modals. State that the empty-body guard stays unchanged.

**F-5. Minor. Sections 3.1 step 9 and 3.4 ("Change the security stamp instead"). A
refresh running during a demotion can issue an access token with the old role.**
- What is wrong: `RefreshAsync` (`TokenService.cs:63-117`) reads the current token,
  then the roles (line 106), then writes a new live token in the same family.
  Suppose a refresh reads its token and roles before the demotion commits and saves
  after it. The demoted admin then gets a fresh 10-minute admin token with a live
  family, unless `RefreshTokens` has a concurrency token. I did not confirm one exists.
  Rotating the security stamp as well would make such a token fail `SessionCheck`'s
  stamp comparison (`SessionCheck.cs:44-50`). The plan rejects the stamp as "instead
  of" revocation, but doing both is a real option that the plan does not consider.
- What would satisfy me: either also call `UpdateSecurityStampAsync` in the role
  change, inside the same transaction, or record this window as a residual risk in
  section 10 with the reason it is accepted.

**F-6. Minor. Sections 3.1 and 6. The actor is not re-checked inside the lock.**
- What is wrong: the target's state is read from the database inside the lock, but
  the actor's admin right comes only from the token, which was checked when the
  request started. With three admins, if A demotes B while B's request to demote C is
  in flight, B's change to C completes after B has lost the role. The last-admin
  invariant still holds. But section 6's "checked from the database ... not from the
  caller's token" overstates what the design does.
- What would satisfy me: either re-read the actor's roles and lockout inside the lock
  and refuse with 403 (then T3's expectation changes to match), or state the window
  in section 6 and section 10. Either way, say that the guard is reachable through
  HTTP only with a stale actor, which is what T3 simulates.

**F-7. Minor. Section 3.1, Reactivate. Failure paths and lockout state are not
specified.**
- No outcome is defined for a failed `UpdateAsync`. A concurrent role change or reset
  on the same user gives Identity's `ConcurrencyFailure`. A failed
  `RemovePasswordAsync` or `AddPasswordAsync` under (a) also has no outcome. Step 8 of
  the role change defines rollback and 409 or 400; Reactivate should match.
- `LockoutEnabled` is left `true`. A newly created user has `false`
  (`Program.cs:64`, `Lockout.AllowedForNewUsers = false`). A reactivated user is
  therefore not in the state they were in before deactivation. That matters to
  ADM-11, which will turn on lockout counting. Either reset it to `false` or state
  why not.
- The route reads no body and carries no `RequestBodyLimit`. Deactivate and reset are
  the same, so this is consistent. Say so explicitly in section 6 "Input", or cap it
  at 4 KB as `RequestBodyLimitTests` does for the auth routes that read no body.

**F-8. Minor. Section 3.1, Placement. One copied security helper already has a public
equivalent.**
- `TokenService.RevokeUserAsync(userId, keepFamily: null, ct)` (`TokenService.cs:159-169`)
  is public. It revokes every live refresh token of the user and saves through the
  same scoped `ContentDbContext`, so it would run inside the open transaction. Using
  it removes one of the copies listed for ADM-04b. Fewer copies of security code
  means fewer places where a later fix can be missed. Use it, or say why the copy is
  preferred.

**F-9. Minor. Section 4, "Out of scope", `Cache-Control: no-store`. The gap is only
"noted".**
- Under (a) the new route returns a credential, and the gap would be copied into it
  rather than inherited. Noting it for the security track is fine as a scope choice,
  but give it a tracked id (a D-NNN with an expiry, or a named GAP or ADM item) so it
  does not get lost.

**F-10. Minor. Section 5.1, T1 and T3. The tests leave active admins behind.**
- T1 promotes an editor with a known password to an active admin and leaves it in
  `DigitalHubContent_Test` for good. Every later last-admin test then has to lock it.
  `AdminApiTests` does lock all other admins, so nothing breaks today. Still,
  deactivate the promoted user in `finally`, as E1 does.

**F-11. Minor. Sections 2.1, 2.5 and 2.8. Some facts and line numbers are stale.**
- `change/ADM-05` on the remote is now `e04e57a`, not `d35fdd8`.
- `RoleClaimType` is at `Program.cs:228`, not 226. The fallback policy is at 250-253.
- None of these changes the design. Section 4.1 step 3 re-checks the branches before
  each source commit anyway.

### Checked and sound

- **Fit.**
  - The plan quotes the finding (audit lines 105-116) correctly.
  - These quotes match their sources word for word: the G3-1 "Done when" (refinement
    plan line 225), line 17, line 221, line 248, the requirement row (audit line 29),
    FR-S-02 (`business-analysis.md:303`), and `phase-b-studio.md` lines 43, 254
    and 309.
  - Delete is kept open as O-15 rather than closed quietly. The coverage table marks
    FR-S-02 "Works" as waiting on it.
- **Code claims at `32f0414`.** All of these match the code:
  - `UsersController` is at `AdminControllers.cs:73-101`, with list, create,
    deactivate and reset only.
  - The create path: `email_taken` at `AdminStore.cs:348-350`, `RequireUniqueEmail`
    at `Program.cs:63`, and `Roles.All` and `Roles.IsKnown`.
  - The deactivate guard, its lack of a lock, and its revoke-then-audit order
    (383-414).
  - The temporary-password generator (446-457, 853-878). `IsDeactivated` (850-851).
  - `SessionCheck` refuses on a missing live refresh family and does not re-read
    roles. `RefreshAsync` and `/auth/me` read roles from the database. Access tokens
    last 10 minutes.
  - The ADM-07 lock pattern (`AdminStore.cs:197-214`).
  - The policies: `studio-admin` is `RequireRole(admin)`, and the fallback requires
    a Studio role.
  - The middleware order: body limit and duplicate guard before authorization, and
    `PasswordChangeGate` after it.
  - `RejectDuplicateJsonFields` compares keys case-insensitively, so T7's
    `role`/`Role` body is a real duplicate.
- **Revocation does end a demoted user's access.** Revoking every live refresh token
  makes `SessionCheck`'s live-family check fail on the next request, which is the
  same mechanism deactivate and reset use. Reactivation cannot revive old sessions:
  revoked tokens stay revoked, and reusing one revokes its family
  (`TokenService.cs:72-75`).
- **Admin-only routes.** Both routes are under `[Authorize(Policy = "studio-admin")]`
  on `api/v1/users`.
  - `CareersTests.Authorization_matches_for_every_endpoint` enumerates
    `EndpointDataSource`, so it picks up the new routes with no edit. Its
    `EditorBlocked` rule for `/api/v1/users` covers editors, HR, users with no role,
    deactivated users and must-change users.
  - It calls both routes with no body and a dummy id, so it changes no state.
  - The plan adds no `AllowedBeforePasswordChange`.
- **The self-change refusal** matches `cannot_deactivate_self` and phase B 8.4.
- **Owner-facing behaviour.** The refusal of changes on deactivated users and the
  no-op on the same role (no audit, sessions kept) are listed as B1-B9 for the PR
  body. That matches the ADM-05, ADM-07 and ADM-10 precedent.
- **Audit entries.** `change_user_role` records `old -> new` and `reactivate_user`
  records the role, each with the acting admin. Refused attempts are not audited,
  the same as deactivate today. The password is never in `Detail`.
- **Red-first order.**
  - Commit 1 holds the API and end-to-end tests, commit 2 the unit tests, commits 3
    and 4 the fixes.
  - The jobs are independent (`ci.yml` has no `needs:` on `api` or `studio`). "Unit
    tests" (line 237) runs before "End-to-end suite" (line 271), so keeping S1-S7 out
    of commit 1 is right.
  - At the base, T1-T10 fail with 404. No route or `{collection}` template matches
    `users/{id}/role` or `users/{id}/reactivate`. For T11 I would expect 404 at the
    base, because the fallback policy lets editors and HR through to routing, so T11
    is red there too. The plan's hedge is acceptable.
  - T12, S3 and S7 are named as guard tests that are green at the base.
- **File overlap with open branches.** For every head under `origin/change/*`, I ran
  `git diff --name-only $(git merge-base <head> origin/rebuild/dotnet-platform) <head>`.
  - ADM-05 at `e04e57a` touches `AdminStore.cs`, `ContentStore.cs`, `PublishChecks.cs`,
    `AdminControllers.cs`, `ErrorPagesPage.tsx` and its own tests. This plan touches
    none of them.
  - Only `change/GAP-12` touches `Program.cs`. It is merged as `a866cf6` (#40), and
    its `Program.cs` is the same as the base's.
  - No head touches `UsersPage.tsx` or any of the new files.
  - ADM-05's condition, that ADM-04 not touch `AdminStore.cs` or `AdminControllers.cs`
    until ADM-05 merges, is met.
  - Merging the base in, rather than rebasing, and re-checking before each source
    commit are both specified.
- **Scope and layering.**
  - One topic.
  - A thin controller over a store that follows the existing `AdminStore` pattern.
  - The Studio uses the existing `request`/`jsonInit` client.
  - No migration is needed: all the columns exist. No package, lockfile or grant
    changes. `sp_getapplock` needs only `public`.
  - The rejected alternatives are real ones: create-reactivates,
    `email_deactivated`, stamp instead of revocation (but see F-5), re-reading roles
    in `SessionCheck`, and delete now.
- **Databases and commands.**
  - `DigitalHubContent_Test` and `DigitalHubContent_E2e` only. Release throughout.
    Ports in the 42xx range.
  - `DigitalHub.slnx`, the test project, the named test classes, `npm test`,
    `typecheck`, `design:check` and `workers: 1` all exist as quoted.
- **Rollback** is real: revert, with no schema change. The data left behind stays
  valid under the old code.
- **Owner decisions.**
  - O-ADM04-1 (O-15), O-ADM04-2 and O-ADM04-3 are PENDING and none is assumed. I
    searched the chat export and found no owner answer to O-15. Line 2115 is the
    assistant's question, not an answer.
  - Gate 1 can go ahead with them open, as it did for ADM-05 and ADM-10. O-ADM04-2
    holds back commit 3 and the push of commits 1-2 if the answer is not (a).
    O-ADM04-3 holds back any push and the CI red. O-ADM04-1 holds back only the
    finding's delete row and FR-S-02 "Works".
  - The rule that a "No" on O-ADM04-3 makes delivery BLOCKED ON OWNER is correct
    under P-7.

Round 1 outcome: CHANGES NEEDED (two Majors, F-1 and F-2).

## Round 2

Reviewer: plan-reviewer, 12 November 2026. Plan reviewed: `docs/changes/ADM-04/plan.md`
at `80e734b` (round 2), against Round 1 above (`81a105c`). As in Round 1, I checked the
code claims at `32f0414` with `git show` and `git grep`, and ran nothing.
`origin/rebuild/dotnet-platform` is still `2bbd586`.

### Round 1 findings

| Finding | Round 2 answer | Status |
| --- | --- | --- |
| F-1 Major, no test proves the count is inside the lock | T15 with `UserReadGate`; the lock is the first statement in the transaction | **Not closed.** T15's gate as specified fails at green and does not tell the two designs apart (R2-1) |
| F-2 Major, T10 does not see application logs | `ReactivationLogTests` with an `ILogEventSink` in the test host, at Verbose, with an assertion that the sink is not empty | Closed. `Program.cs:30-33` reads sinks from services (`ReadFrom.Services`), so the sink receives the API's own events, including the request log |
| F-3 ADM-04b undated | Scheduled first after ADM-05, inside G3-1, target 16 November; PR body carries "Known exposure until ADM-04b"; scope adds lock and actor check on deactivate and reset | Closed |
| F-4 `Modal.confirm` | One more controlled `<Modal>`; the empty-body guard is copied unchanged | Closed. `redirects.test.tsx` already passes that guard with controlled modals |
| F-5 Racing refresh | `UpdateSecurityStampAsync` as well as revocation; T13 | Closed. `RefreshAsync` reads the user and stamp (95) before it issues a token, and `SessionCheck` compares `sst` (44-50). `RefreshToken` has `UserId`, `TokenHash`, `CsrfTokenHash`, `FamilyId`, `ExpiresAt`, `CreatedAt`, `SessionStartedAt`, and `ContentDbContext.cs:55-63` defines no concurrency token on it. So T13's inserted row reproduces the race's write, and it is red against a fix that only revokes. The remaining window, a session at the *new* role, is stated and accepted in Risks |
| F-6 Actor not re-checked | `EnsureActorAsync` inside the lock on both writes; T14; B10 | Closed. Putting the guard before the actor check, so that T3 still reaches `last_admin` through HTTP, is reasoned and harmless. A stale actor learns only that the target is the last admin |
| F-7 Reactivate failure paths and lockout | Rollback with 409 or 400; `LockoutEnabled = users.Options.Lockout.AllowedForNewUsers`; `AccessFailedCount` 0; 4 KB cap; T4 and T6 assert them | Closed |
| F-8 Copied revoke helper | `TokenService.RevokeUserAsync(id, null, ct)` is injected and used | Closed |
| F-9 `no-store` only noted | Set on reactivate's 200 (T4); reset's answer moves to ADM-04b item 2 | Closed |
| F-10 Leftover admins | `finally` deactivates every admin a test made and every user it reactivated | Closed |
| F-11 Stale facts | Fixed. ADM-05 given as `294fb4d` | Closed. ADM-05 has moved again since (R2-3) |

### Findings

**R2-1. Major. Section 5.1 T15. The gate matches `SessionCheck`'s reads, so it releases
before the store's reads and the test fails at green.**
- What is wrong: `UserReadGate` holds "every reader command that has a parameter equal
  to one of" A's or B's ids. That condition has no table filter. ADM-07's gate has one:
  it matches only `FROM [redirects]` (`RedirectConcurrencyTests.cs:285-287`). Before
  either request reaches the controller, JWT validation runs `SessionCheck.ValidateAsync`
  on each one. That method issues two reader commands parameterised by the actor's own
  id:
  - `db.Users ... Where(candidate => candidate.Id == userId) ... SingleOrDefaultAsync`
    (`SessionCheck.cs:40-43`);
  - `db.RefreshTokens.AnyAsync(token => ... token.UserId == userId ...)` (55-57).

  A's request carries A's id and B's carries B's, and both ids are in the armed set. So
  the first two commands to match are the two `SessionCheck` reads. On the second
  match the gate releases and disarms (the same logic as `RedirectReadGate`), before
  either request reaches `sp_getapplock`.
- What follows:
  - **At green**, nothing is held inside the lock. The requests still serialise on the
    app lock, so the outcome is correct (one 200 and one 403), but `Gate.Matched` is 2
    or more. The planned assertion `Matched` 1 fails on a correct implementation.
  - **With the reads moved before the lock** (the regression T15 exists to catch), the
    gate is already disarmed, so nothing widens the race window. The test then depends
    on timing and does not reliably fail.
  - The "Why T15 fails" argument in 5.1 therefore does not hold. Its own claim that only
    one command matches at green is wrong.
- What would satisfy me:
  - Limit the gate's match to a command that only the store issues after the lock. One
    choice is a read of `[AspNetUserRoles]` with A's or B's id as a parameter (the
    target's `GetRolesAsync`, 3.1 step 4). `SessionCheck`, `PasswordChangeGate` and
    the JWT handler never read that table.
  - State in 5.1 that the developer confirms, at commit 1 or commit 3, that no command
    issued during authentication matches. For example, log the matched `CommandText` in
    the test output, as ADM-07 did with `ToQueryString`.
  - Re-derive the green and broken traces for the new filter. They should still give
    `Matched` 1 at green, and two held reads with both demotions passing when the reads
    run before the lock.

**R2-2. Minor. Sections 3.1 and 5.1 T14. No test reaches the deactivated-actor branch
of `EnsureActorAsync`.**
- T14's "deactivated" variant gets 401 from `SessionCheck` before the store runs, so it
  tests `SessionCheck`, not the actor check.
- The demoted branch is tested by T14 and T15, and the deactivated branch is one
  condition in the same method.
- Acceptable as it stands. Either reach that branch with the corrected T15 gate (B
  deactivated while its request is held), or note in 5.1 that the branch is covered by
  review only.

**R2-3. Minor. Section 2.1. The ADM-05 head has moved again.**
- `git ls-remote` now gives `change/ADM-05` at `741d70c`, not `294fb4d`.
- `git diff --name-only e04e57a origin/change/ADM-05` lists `ErrorPagePublishTests.cs`,
  `ErrorPagesPage.tsx`, `errorPages.test.tsx` and ADM-05 docs.
- I re-ran the overlap check over every `origin/change/*` head:
  - no head touches `UsersPage.tsx`, `UserAccess*`, `TemporaryPassword.cs`,
    `UserRole*`, `ReactivationLog*` or `users.(test|spec)`;
  - only `change/GAP-12` touches `Program.cs`, and it is merged.
- No plan change is needed. Step 3 of 4.1 re-checks before each source commit.

### Checked and sound in Round 2

- **The lock and the actor check.** The order in 3.1 is right: lock first, then target,
  guard, actor, write. Rotating the stamp and revoking happen in the same transaction.
  `sp_getapplock` goes through `ExecuteSqlRawAsync`, which is a non-query command, so
  a reader gate never sees it.
- **Reactivate.**
  - The lock and actor check come first.
  - `users.Options.Lockout.AllowedForNewUsers` restores a new user's lockout state.
  - Every `IdentityResult` is checked, and the user stays deactivated on any failure.
  - `no-store` is set on the 200.
  - The temporary password is never in `Detail`.
- **T10.**
  - It logs at Verbose for `Default` and both overrides.
  - Its non-empty-sink assertion rests on the request log, which
    `UseSerilogRequestLogging` (`Program.cs:274`) writes at Information.
  - It is red at the base on the reactivation status, and it cannot pass vacuously.
- **T13.** It reads the family id from the `sid` claim
  (`TokenService.SessionClaim = "sid"`, line 48), as `SessionCheckTests.cs:125-127`
  does. The hr user's old access token carries `editor`, so `GET /api/v1/pages`
  answers 200 under a fix that only revokes. That makes the test discriminating.
- **CareersTests.** The matrix still covers both routes. As admin, reactivate with the
  dummy id takes the lock, passes the actor check and answers 404, so it changes
  nothing.
- **Owner answers.**
  - The words are quoted, with the owner's name, the date and time (12 November 2026,
    12:09 UTC) and the medium (card tap, relayed by the coordinator).
  - Each answer is read narrowly, and the plan says the cards were not seen first-hand.
    That matches the ADM-07 and ADM-10 approvals.
  - The (b) and (c) branches are removed throughout. The delete row is "Decided", with
    no code.
  - I could not see the cards, and the tech lead should confirm the relay at gate 1.
- **Unchanged since Round 1 and still sound:**
  - scope;
  - layering, and the "not changed" list (now with `TokenService.cs` and
    `SessionCheck.cs`);
  - no migration;
  - rollback;
  - Release-only commands with the new test classes in the filter, and T15 run three
    times;
  - the commit order and the CI red plan under O-ADM04-3;
  - the G3 checklist rows.

Verdict: CHANGES NEEDED
