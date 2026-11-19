# ISO-2 plan review

## Round 1

Reviewer: plan-reviewer. Plan reviewed: `docs/changes/ISO-2/plan.md`, round 1, in
the worktree `D:\work\DigitalHub\dh-platform-claude-iso-2` at base `522b175`
(`origin/rebuild/dotnet-platform`). Read first: `docs/changes/README.md`,
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`,
`docs/changes/ISO-1/delivery-approval.md` ("F1: decision") and
`docs/changes/ISO-1/test-report.md` (F1). No earlier review round exists.

### Findings

#### R1-1 (Major). Section 3.9 commits 3 and 4, and 5.1 "Red at commit 4": the commit order does not build, and the red/green prediction is wrong

**What is wrong.** The red-test evidence (P-4, B-6) depends on each commit building
and failing on assertions, as the plan states. As written, it does not:

1. **Commit 3 does not compile.** Commit 3 holds "a `Program.cs` holding only steps
   1-4 of 3.1". Step 2 is Serilog with `Destructure.With<SensitiveDestructuringPolicy>()`.
   The copied `SensitiveDestructuringPolicy` arrives with "`Infrastructure/*` except
   `PublicRouteGate.cs`" in commit 5. Commit 3's expected state, "Builds, `0 Error(s)`",
   cannot hold.
2. **Commit 4 does not compile either, so its red is a build failure, not a failing
   test.** The ported `The_network_drops_the_host_part` calls `RateLimitLog.Network(...)`
   (admin original: `api/tests/DigitalHub.Api.Tests/RateLimitLogTests.cs:71`), and the
   plan says it runs "on the copied `RateLimitLog`" (5.1). That copy arrives in commit 5.
   The ported aborted-request and rate-limit tests also carry
   `using ...Infrastructure;` (`AbortedRequestTests.cs:4`, `RateLimitLogTests.cs:5`). The
   plan nonetheless says commit 4 "Builds", and that `The_network_drops_the_host_part`
   "pass[es] already".
3. **T-I5 is listed "Green already" at commit 4, but it asserts
   `POST /api/v1/public/contact {}` returns 400** (5.1, T-I5). Commit 4 has no
   controllers, so that request is a 404. T-I5 is red at commit 4. The stop conditions
   cover only commits 1 and 5, so the plan gives the developer no rule for this mismatch.
4. **Commit 5 is unclear for `PublicServerHeaderTests.No_server_header_on_a_problem_response`.**
   That test covers `/api/v1/users` "(gate 404)", but the gate arrives in commit 6.
   Commit 5 says "All T-P ... tests pass". Whether this test passes at commit 5 depends
   on whether it asserts a problem body, and the plan does not say.

**Evidence.** Plan 3.1 step 2; 3.9 rows 3-5; 5.1 T-I5 and the T-P closing paragraph;
`api/src/DigitalHub.Api/Program.cs:31-37`; `RateLimitLogTests.cs:66-71`.

**What would satisfy me.** A commit sequence in which every commit builds. For
example: put `SensitiveDestructuringPolicy` (or all copied infrastructure) in commit 3,
or keep step 2 out of commit 3. Then correct the red and green lists for commits 4 and 5
test by test, with T-I5 among the reds, `The_network_drops_the_host_part` compiling, and
the server-header test's state stated at commit 5. Add a stop condition for commit 4 that
matches the ones for commits 1 and 5: a deviation from the stated red list sends the
change back.

#### R1-2 (Major). Section 3.4 and section 10 (duplication row, drift row): the duplication is undercounted, and the drift hazard for copies meant to stay identical has no control

**What is wrong.**

- **The count.** "About 440 duplicated lines" counts only the eight infrastructure
  files, and even those counts are off: `wc -l` gives 36, 49, 32, 29, 90, 112, 45 and 69,
  which is 462 (the plan's table has `RequestBodyLimit.cs` at 100, but it is 112). The
  change also duplicates:
  - the forwarded-headers block, the rate limiter, the `InvalidModelStateResponseFactory`
    and the Serilog set-up from `Program.cs`;
  - both controllers;
  - `ToTestCatalog`, `TestConnectionString` and `ElevatedTestConnectionString` from
    `ApiFactory.cs`;
  - the ported suites: 13 apply tests from `CareersTests.cs:41-387` plus four factories,
    and the contact, body-limit, rate-limit-log, aborted-request and server-header tests.

  The real figure is likely well over 1,000 lines. The ported tests are temporary, since
  ISO-4 deletes the admin originals (4.4), but the plan does not say so in 3.4 or
  section 10.
- **The drift claim.** "The copies diverge by design" holds for two of the eight files.
  `ExceptionShieldMiddleware` and `RequestBodyLimit` lose their `ApplyPage` branches in
  ISO-4. `ProblemResults`, `CorrelationIdMiddleware`, `SecurityHeadersMiddleware`,
  `UnhandledExceptionHandler`, `RateLimitLog` and `SensitiveDestructuringPolicy` are
  meant to stay identical permanently. Three of them are security controls: the log
  redaction list, the security headers, and the safe 500 body. A future fix to the
  admin copy (for example a new name in the `SensitiveDestructuringPolicy` redaction set)
  would silently miss the public process. That is the process that faces the internet.
  The risk table treats drift as "intended after ISO-4", and 4.4 says consolidation is
  "Not planned". C13 is a one-time check at delivery, not a control.
- **The baseline.** "Step 4e takes its baseline after this change" means G-9 (GAP-20,
  "At most 3% duplication in changed code") will take this copy as its baseline.
  Measured against its own threshold, this change would fail that gate by a wide margin.
  G-9 is a Gap today, so this is not a rule breach. But the plan uses that status to
  avoid weighing the copy, instead of measuring it. P-2's spirit is "existing debt is
  baselined and may only shrink", not "add debt just before the baseline".

On ADR 0001's intent: copying the *pipeline* is consistent with "its own process", and
the rejected alternative (b), linked source files, is correctly rejected. So the choice
to copy can stand. What is missing is the accounting and a control.

**What would satisfy me.**
- A measured duplication figure for the whole change, split into permanent and
  temporary (removed by ISO-4).
- For the files meant to stay identical, either a committed parity test that fails when
  the two copies differ (apart from the namespace and `RateLimitLog.Category`), or a
  named follow-up item, with a destination, that will consolidate them or put them under
  such a check.
- Section 10's drift row corrected to separate "diverge by design" (two files) from
  "must not drift" (six files).

#### R1-3 (Minor). Section 3.1 steps 9-10 and 3.7 "No authentication": the pipeline order shown is not the one that will run

`AddControllers()` registers authentication core (`IAuthenticationSchemeProvider`, no
schemes) and the authorization services. `WebApplication` then inserts `UseRouting`, and
because those services are present, `UseAuthentication` and `UseAuthorization`, at the
start of the pipeline, ahead of the user middleware. The plan's "No `AddAuthorization`
(policies)" is true only of policies, and the ordered list in step 10 omits the implicit
middleware. Nothing here is unsafe: there are no schemes and no fallback policy, so the
middleware is a pass-through.

**What would satisfy me.** Either state the implicit middleware and confirm that T-I1
tolerates it, or call `UseRouting()` explicitly where the plan wants it, so that the
order written is the order run.

#### R1-4 (Minor). Section 2.7, 3.3 and C14: `no-hiring-system.test.ts` does not apply its column-name rule to the new model

The `names()` and hiring-name check runs only where
`inModel(normalized)` is true, and that is `api/src/DigitalHub.Api/Data/*.cs`
(`website/test/no-hiring-system.test.ts:113-115`). The new
`api/src/DigitalHub.PublicApi/Data/` gets only the needle and `DbSet<` checks. C14's
"It scans the new `api/` files" overstates what is covered.

**What would satisfy me.** State the gap, and either extend `inModel` to the public
API's `Data/` folder or record it as a follow-up with a destination. Extending it would
make the guard stricter, not weaker, but it touches `website/`, which 4.3 freezes.

#### R1-5 (Minor). Section 3.2: the ADR says "fallback policy", and the plan does not list the real alternatives to a gate

The argument against a plain fallback policy (it challenges, and with no scheme it
throws) is correct. Two real alternatives are not weighed:

- a `FallbackPolicy` that always fails, with a custom `IAuthorizationMiddlewareResultHandler`
  that writes the 404 problem;
- `MapFallback`, plus a method-mismatch handler.

Separately, `ENGINEERING_STANDARDS.md` P-5 and S-2 name only the admin API's fallback
policy in their "Enforced by" column, while this change adds a second API with a
different deny-by-default mechanism.

**What would satisfy me.** One or two lines in 3.2 rejecting these alternatives. Also
either a note that P-5 and S-2's "Enforced by" text is updated (in this change or a named
one), or a statement of why it does not need to be.

#### R1-6 (Minor). Section 3.6 and the stop conditions: no rule for when the PublicApi assembly references an `Authentication.*` abstraction

The family `Microsoft.AspNetCore.Authentication` also forbids `.Abstractions` and
`.Core`. That is consistent with the owner's "`Microsoft.AspNetCore.Authentication*`".
The plan proves only the Forms references pass (2.6). For `DigitalHub.PublicApi.dll` the
answer arrives after the fact, in C8.

**What would satisfy me.** A stop condition: if T-G2 reports a forbidden reference on
the PublicApi assembly, the change goes back to the architect. The guard is not
narrowed (P-6).

#### R1-7 (Minor). Section 4.4: the public API's `AllowedHosts` is left unowned

The plan notes correctly that the refinement plan assigns no item to the public API's
own `AllowedHosts`. The note lives only in this plan's out-of-scope table ("ISO-5 /
ISO-6 ... decided there").

**What would satisfy me.** Record it where ISO-5 and ISO-6 will see it, for example
as a line in the ISO-2 `implementation.md` hand-off and in the PR body's follow-ups. Or
say explicitly that the tech lead carries it into the ISO-5 request. As it stands, it is
easy to lose.

#### R1-8 (Minor). Section 2.9: the list of parallel work is stale

`gh pr list --state open` now also shows **#72 GAP-NEXT-UPGRADE** (`website/package.json`,
`website/package-lock.json`, `docs/changes/GAP-NEXT-UPGRADE/*`). It shares no file with
ISO-2. But if it merges first, C15's website figure and the `website`,
`website-browser` and `section-compare` comparisons move.

**What would satisfy me.** Add #72 to 2.9, and extend "If the base moves" (5.3) to the
website figures as well as the API ones.

### Checked and found sound

- **Fit.** The "Done when" is quoted word for word from refinement plan line 213. ADR
  0001 points 1 and 4 are quoted exactly. "Closes part of GAP-38" matches line 114, and
  the boundaries table matches lines 214-216. The owner's request and "start iso 2" are
  quoted as given.
- **F1 hand-off.** The three commitments in `ISO-1/delivery-approval.md` ("What this
  commits ISO-2 to", items 1-3) are all answered:
  - The prefix rule is an option the ruling allows.
  - Every old exact name stays covered, so nothing is narrowed. I checked this against
    `FormsLibraryTests.cs:28-38`.
  - The canary is committed (`GuardCanary`), shown in a transient demonstration on both
    Forms and PublicApi, and the guard is applied to the PublicApi assembly (T-G2).
  - Leaving `Azure.Identity` out of the `*.Identity*` family is justified (SqlClient's
    Entra ID packages).
- **Architecture.** The public projects reference `DigitalHub.Forms` only; the
  `DigitalHub.Api` or `DigitalHub.Images` references are excluded and tested (C8, T-G2).
  The layering holds: the controllers call the Forms stores, and `PublicFormsData` is
  the port over the context (A-11).
  - **Copied infrastructure.** The eight files depend only on `DigitalHub.Forms`,
    Serilog and ASP.NET Core, so verbatim copies compile. I checked their `using` lines.
  - **Rejected alternative (b), linking source.** This is correctly rejected.
- **Small DbContext.** Four tables, no navigations, no `handled_by_id`, no migrations
  (T-I6, T-I7, C6, C7). The admin mappings and the NOT NULL vacancy columns match
  `ContentModelBuilder.cs` (`version` is an `int` concurrency token, so it can be
  inserted). The fixture must also respect the unique `slug` index; implied, not stated.
  The `IFormsData` and `AddDigitalHubForms()` claims match the code.
- **Attention point (2), `ci.yml` and #68.** I confirmed that #68 is open and changes
  `ci.yml`, including the `Upload test report` line in the `api` job. The plan honours
  `AGENTS.md` "Parallel changes must change different files" correctly:
  - commits 1-6 touch no `.github/` file;
  - commit 7 waits for #68 to be merged or closed, and for a rebase;
  - the developer stops rather than routing around it.

  The new step adds no `uses:`, so GAP-09 pinning is not affected. Its trx joins the
  existing `api-test-report` artifact, and `if: ${{ !cancelled() }}` is right.
- **Attention point (3), `dh_content_app`.** The plan says plainly, in 3.5 and in 6
  ("Logins"), that the public API runs on the restricted `dh_content_app` until ISO-3,
  and that GAP-38 stays open for that reason. It is not presented as a permission proof.
  The fixtures do not read through the host's context, so ISO-3 cannot be weakened by
  ISO-2's tests. This is not a weakening.
- **Attention point (4), the 404 problem bodies.** This matches A-6 and A-7:
  `application/problem+json` with `code: "not_found"`, which is the code every admin
  store uses for 404 (`ContentStore.cs:697,755,1340,1349`, `AdminStore.cs:985`,
  `MediaLibrary.cs:49`, `UserAccessStore.cs:269`). It is written through the existing
  `ProblemResults.WriteAsync` shape (`ProblemResults.cs:24-35`). Unmatched routes in the
  admin API return an empty 404 (it has no `UseStatusCodePages`), so the public API is
  the more consistent of the two. The gate's position is sound:
  - after request logging and the exception shield (one log line, 499 kept);
  - before body limits and the rate limiter;
  - ahead of the 405 and trailing-slash behaviour, which is stricter than routing and
    is justified.

  The website posts exact paths (`ApplyForm.tsx:14`, `website/behaviors/contact.js:30`).
- **Attention point (5), the red-evidence route.** Local Release runs with the ISO-1
  precedent; the stop condition forbids pushing for CI evidence without the owner; the
  intermediate commits are not run by CI (`ci.yml` triggers). This is sound in shape.
  The content of the red lists is R1-1.
- **Testability.**
  - T-R1 (endpoint inventory) and T-R2 (method by path sweep, the admin templates, the
    near-miss paths, 50 seeded random paths, and positive controls) prove "every other
    path returns 404" as far as a finite test can, with the gate as structural backing.
  - T-R2's admin path list matches the `[Route]` and `[Http*]` templates in
    `api/src/DigitalHub.Api/Controllers`.
  - The T-I tests cover "no Identity, no signing key, no authentication" with built-in
    controls.
  - The base CI run `44526032412` has head `522b175` and conclusion `success`. I
    re-derived the integration name hash, `060c40c8…6d497c`, over 578 names, with
    Counters `total="578" ... failed="0"`.
  - C3's 579 is the arithmetic of 578 plus T-F1.
- **Quality gates.** No gate, guard, baseline or test is weakened:
  - the old guard list is subsumed;
  - the existing test names are kept;
  - no `known-findings.json` entry is added;
  - the C17 grep catches a C# literal of the secrets id.
- **Security.**
  - The two anonymous routes have the same limits as today, and nothing else answers.
  - Start-up refuses any `Auth` key, and there is no `UserSecretsId` on the public API.
  - The test factory refuses other catalogs and Windows authentication.
  - No new package id or version; the Pkcs pin is carried over.
  - No migration. Database names are right: `DigitalHubContent_Test` only.
- **Owner decisions.** None needed. The 404-not-405 and `Auth`-refusal choices are
  stricter than the accepted ADR and change no existing behaviour.
- **Rollback and risks.** Rollback is a revert, with no schema or deployment involved.
  The risks are specific (proxy path, schema drift, shared `site_settings`, Application
  Control), apart from the drift row (R1-2).
- **Scope (B-8).** One topic, plus the F1 hand-off the owner asked for. The files to
  create are new on purpose. No file overlaps #70 or #72, and the only overlap with #68
  is sequenced.

Round 1 result: CHANGES NEEDED (two Majors, R1-1 and R1-2).

## Round 2

Reviewer: plan-reviewer. Plan reviewed: `docs/changes/ISO-2/plan.md`, round 2 (1,620
lines, revision log section 12). I re-checked against the code at
`origin/rebuild/dotnet-platform` `522b175`, re-fetched in this round, so the base has not
moved. Open PRs are #72, #70, #68 and #60, the same set the plan lists in 2.9.

### Round 1 findings

| Finding | Status | Evidence |
|---|---|---|
| R1-1 (Major), the commit order does not build and the red list is wrong | **Resolved** | Commit 3 now brings all eight infrastructure copies, so Serilog's `SensitiveDestructuringPolicy` exists when `Program.cs` first names it (3.9, "Commit 3's files"). Commit 4's tests name only types that exist at commit 3, so `RateLimitLog.Network` and `using DigitalHub.PublicApi.Infrastructure;` compile. The table in 3.9 gives the state per test, and per row for theories, at commits 1-6. In it T-I5 is red at commit 4 (correct: there are no controllers), `The_network_drops_the_host_part` is green at commit 4, and `No_server_header_on_a_problem_response` has three rows, the two gate rows staying red until commit 6. I walked each commit-4 and commit-5 row against the pipeline each commit actually has, and found no mismatch. The T-R2 groups G1-G3 cover every non-404 or empty-body case at commit 5. Stop conditions now cover commits 1, 4 and 5 by name and row, any build failure, and failures at the green commits. 5.2 adds a trx outcome listing, so the comparison is mechanical |
| R1-2 (Major), the duplication count and the drift control | **Resolved** | 3.4.1 measures about 1,970 lines in groups A-F: about 990 permanent and about 980 removed by ISO-4. The eight file sizes match my `wc -l` (462; `RequestBodyLimit.cs` 112). I spot-checked two ranges: the forwarded headers are `Program.cs:85-108`, 24 lines, and the `ApiFactory.cs:118-206` helpers are 89. 3.4 now separates "diverge by design" (two files) from "must not drift" (six). **T-D1** (`InfrastructureParityTests`) is a committed, fail-closed text comparison of the six group-A files. Its control, T-D2, and a one-off failing edit prove it can fail. Taking a row out is made an explicit, reviewed decision. The groups T-D1 cannot cover (C and E) are named follow-up **F-1 `iso-shared-hosting`**. Its destination is the hand-off, the PR body and the tech lead to the owner; it is marked a proposal, not a decision, and claims no owner words. Step 4e must cite it. C13 now covers groups B, C and E |
| R1-3 (Minor), the implicit middleware | **Resolved** | 3.1 step 10 lists, in the order they run: the implicit host filtering, `UseRouting`, `UseAuthentication` and `UseAuthorization`. T-I1 adds a null `FallbackPolicy` and no endpoint `IAuthorizeData`, so those implicit steps are proven to be pass-throughs |
| R1-4 (Minor), `inModel` does not cover the new model | **Resolved**, with R2-1 below | Commit 3 changes line 114 of `website/test/no-hiring-system.test.ts`, the `inModel` line, to cover both `Data/` folders. I confirmed lines 113-115 are `inModel` and that the change makes the guard stricter (P-6). C11 allows exactly that line. #72 does not touch the file |
| R1-5 (Minor), the gate's alternatives and the P-5/S-2 text | **Resolved** | 3.2 rejects an always-failing `FallbackPolicy` with a custom `IAuthorizationMiddlewareResultHandler`, and `MapFallback` plus 405 handling, with real reasons. The "before" text of both `ENGINEERING_STANDARDS.md` cells matches lines 26 and 80 exactly. Only the "Enforced by" cells change; the rule text, id and status do not. That is a records update, not a rule change. ADR 0001, accepted, is the decision that the public API has no authentication. No open PR touches the file |
| R1-6 (Minor), no stop rule for a forbidden PublicApi reference | **Resolved** | 3.6 and 3.9 add the stop: any forbidden name in T-G2 or C8, `.Abstractions` and `.Core` included, sends the change back to the architect. The guard is never narrowed, and there is no exception without the owner's words |
| R1-7 (Minor), `AllowedHosts` unowned | **Resolved** | The `implementation.md` row of 4.1 requires a "Hand-off" section that lists it, along with the other ISO-3, ISO-4 and ISO-5 items and F-1. 4.4 requires it in the PR body's "Open items", and gate 2 is asked to carry it into the ISO-5 request. Nothing is decided here |
| R1-8 (Minor), stale parallel-work list | **Resolved** | 2.9 lists #72, and I confirmed it has no shared file. 5.3 "If the base moves" now covers the website figures, and C15 compares with the base CI run |

### New findings (round 2)

#### R2-1 (Minor). C14's one-off proof would fail for the wrong reason

C14 proves that the extended `inModel` rule reaches the new folder by adding
`HasColumnName("cv_blob_test")` to a scratch copy. But `cv_blob` is also one of the
**needles** (`no-hiring-system.test.ts:24`), and those are checked on every file under
`api/` whatever `inModel` says. So the test would fail, naming the file, even without
the line-114 change. That proves nothing about the new rule.

**What would satisfy me.** At implementation, use a name that matches `hiringName`
(`^(cv_|applicant|resume|candidate|interview)`) but contains no needle, for example
`HasColumnName("candidate_note")`. Show it failing with the line-114 change and passing
without it. The developer can record this in `implementation.md` without a plan round,
because it changes only the scratch content, not the plan's design.

#### R2-2 (Minor). Section 6, "Policies": the profile's stricter role-matrix rule is not addressed

`docs/PROJECT_PROFILE.md` (Gate thresholds) says: "every `api/v1` route is in the role
matrix". In ISO-2 the two form routes stay in the admin's matrix
(`CareersTests.Authorization_matches_for_every_endpoint`, C3). The public API's copies
are covered by T-R1, an exact inventory of the two anonymous POST routes, which in
practice is that API's matrix. Once ISO-4 removes the admin copies, though, nothing names
the routes in a role matrix unless someone decides how.

**What would satisfy me.** One line in section 6, saying that T-R1 is the public API's
role matrix (two anonymous routes, nothing else), and an item in the `implementation.md`
hand-off asking ISO-4 to keep the profile line true. Not blocking: ISO-2 changes nothing
in the admin matrix.

### Checked in round 2 and found sound

- **No regression from the revision.** The design, the boundaries and the owner quotes
  are unchanged from round 1. The things checked and found sound in round 1 still hold:
  the `ci.yml` order after #68, `dh_content_app` stated as interim, the 404 problem
  bodies (`not_found`, A-6), and the local Release red route.
- **The new scope stays one topic (B-8).** The `website/` line and the two
  `ENGINEERING_STANDARDS.md` cells are direct answers to R1-4 and R1-5. Both are records
  or guard strengthenings that are bounded exactly by C11, and no open PR touches either
  file (#68, #70 and #72 checked). Under `AGENTS.md`, "Parallel changes must change
  different files" still holds.
- **T-D1 design.** It reads source as text and references no admin assembly, so the
  public suite still cannot see `DigitalHub.Api`'s types. It finds the repository root
  from `AppContext.BaseDirectory` and fails closed if there is none (P-5). Its CRLF
  normalization suits the Windows worktree. It runs in CI's `api` job through the
  commit-7 step, where the checkout includes `api/src/DigitalHub.Api/Infrastructure/`.
  It is green from commit 4, because the copies are verbatim from commit 3.
- **The commit-3 `Program.cs`** (Kestrel, Serilog, the connection check, the context, then
  `Build`/`Run`, with no `AddControllers`) gives T-I1 green at commit 4 as tabled. The
  copied infrastructure files compile on their own: their only dependencies are Serilog,
  ASP.NET Core and `DigitalHub.Forms`.
- **No gate, guard, baseline or test is weakened (P-6).** No D-NNN is needed. No owner
  decision is assumed: F-1 is explicitly a proposal for the owner to schedule.

Both Majors are resolved. The two new findings are Minor and can be handled in
implementation and the hand-off without another plan round.

Verdict: APPROVED
