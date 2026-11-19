# ISO-1 plan review

## Round 1

Reviewer: plan-reviewer, 19 November 2026. Plan reviewed:
`docs/changes/ISO-1/plan.md`, round 1 (untracked in the worktree on `change/ISO-1`,
base `cdef7c90bf5546ecea891e9b12e2aec28d265716`). Sources read: `docs/changes/README.md`,
`AGENTS.md`, `CLAUDE.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`.
There was no earlier review.

### Findings

#### F1. Major: section 5.1, how the red evidence is produced

**What is wrong.** The plan's route for showing the two new tests red at commit 1
cannot produce that evidence. It says that if Application Control stops the local
run, "the developer then pushes nothing, and the red evidence is the same command
on commit 1 in the tester's detached checkout, or CI on the pull request's first
push".

- The tester uses the same machine, so the same block applies.
- CI runs only on `pull_request` (opened, synchronize, reopened, labeled) and on
  pushes to `rebuild/dotnet-platform` (`.github/workflows/ci.yml` lines 13-18). The
  pull request opens only after gate 2, when the owner confirms, and it contains
  every commit. CI then tests the head, never commit 1 alone.
- Section 9 says "Owner decisions needed: None", so nothing would let a red-only
  branch be pushed early.

**Evidence.** The `ci.yml` header (lines 3-5) says: "The local machine can no longer
run .NET builds (Windows Application Control blocks freshly built binaries), so
.NET verification runs here." `docs/PROJECT_PROFILE.md` (Local constraints) says
the same. Recent changes could not run `dotnet test` locally:

- `docs/changes/ADM-04/test-report.md:28` records "NOT RUN | ... No dotnet".
- `docs/changes/ADM-05/test-report.md:38` and `:92` record the same.

ADM-04 got its red evidence from a separate run on the red commit, through a diag
branch and a draft PR (`test-report.md:289-295`, and `:662`, draft PR #66). It
had the owner's words for red-first ("Yes, red tests first", O-ADM04-3). For
ISO-1, then, the no-local-dotnet path is the normal path, not a rare fallback,
and the plan names a source of evidence that does not exist. That falls short of
P-4, S-3 and P-8 ("NOT RUN with the reason and the CI job that covers it").

**What would satisfy me.** Section 5.1 names a route that really yields the red
result, and section 9 lists any owner decision that route needs. Any one of these
would do:

- (a) A CI run on commit 1, through a red-only branch and a draft PR as ADM-04
  did. Since that is a push before gate 2, list it in section 9 as an owner
  question with exact wording, and mark it BLOCKED until answered.
- (b) State plainly that the red result is NOT RUN. Record a static reading of
  why each test fails at commit 1, as ADM-04 section 1 did:
  - `DigitalHub.Api` is the assembly name today.
  - The `DigitalHub.Api` metadata references `DigitalHub.Images`, JwtBearer and
    Identity.

  Name which later CI run shows the two tests green. Tech-lead gate 1 then
  decides whether that is enough.
- (c) A local Release run, if it works, quoted with its exit code.

#### F2. Minor: section 3.5, order of commits (B-6) and what commit 2 holds

1. Commit 4 does `git mv` of `ApplicationIntake.cs` and `PublicContactStore.cs`
   and also changes what is inside them (port, `FormOutcome`, `ApplicationCountSql`
   split). B-6 says "A pure rename is its own commit." Mixing the move with the
   edit makes it harder to review the "byte-identical validation" and "verbatim
   `MERGE`" claims (C7).

   The files can be split. First switch both classes to `IFormsData` and
   `ApplicationCountSql` while they are still in `DigitalHub.Api` (the port types
   already exist in Forms after commit 2). Then move them with `git mv` and the
   namespace line only. That gives a content diff with no rename in it, and a
   rename with no content in it.

2. Commit 2 adds `FormsServiceCollectionExtensions.cs` "with the extension method,
   not yet called", and says the commit "Builds". The method cannot register
   `PublicContactStore`, `ApplicationIntake`, `ApplyThrottle`, `ApplyDedupe` or
   `SmtpEmailSender` at commit 2. Those types are still in `DigitalHub.Api`, which
   Forms must not reference. State that the body is empty at commit 2 and filled
   in the commit that moves the last of those types.

**What would satisfy me.** Section 3.5 is rewritten so that every commit builds and
every rename is a pure rename, or it says why B-6 cannot be met here.

#### F3. Minor: section 10, first risk row, the `Microsoft.NET.Sdk.Web` fallback

The fallback is acceptable in principle. The test project and the importer already
use the Web SDK because of Application Control, and with `OutputType Library` it
changes no runtime behaviour. As written, though, it is under-specified:

- **It has no trigger.** "If it is blocked anyway" needs quoted evidence that
  `DigitalHub.Forms.dll` itself is refused while `DigitalHub.Images.dll` loads.
  Given F1, the more likely outcome is that no local .NET run is possible at all.
  The fallback does not help with that, and the SDK must not be switched on a
  guess.
- **The switched project would add a build warning and fail C1.** Under the Web
  SDK, the explicit `<FrameworkReference Include="Microsoft.AspNetCore.App" />`
  from section 3.1 raises NETSDK1086, because the framework is implicitly
  referenced. That raises the warning count, which C1 forbids. The Web SDK's
  implicit usings also overlap the four `<Using>` items, and add
  `Microsoft.AspNetCore.Builder`, `Routing`, `Hosting` and
  `Microsoft.Extensions.Hosting`.

**What would satisfy me.** The plan writes out the exact fallback csproj: Web SDK,
`OutputType Library`, `CETCompat`, no `FrameworkReference`, and the `<Using>` items
kept or dropped, with a reason. It also names the quoted evidence that triggers
the switch, and says C1 to C10 are re-checked after it. The record in
`implementation.md` stays as planned.

#### F4. Minor: section 5.3, C1 has no route through CI

C1 asks for `dotnet build` on the base and on HEAD, with the two `Warning(s)` lines
compared. It has no NOT RUN path, although C3 and C13 do. See F1: a local build is
probably not possible.

**What would satisfy me.** C1 names its CI evidence:

- The base value is the `Warning(s)` line in the `api` job log of run
  `44506830145`. ADM-04 recorded `13 Warning(s)` at an earlier base; quote the
  figure for `cdef7c9`.
- The head value is the same line in the PR's `api` job.

#### F5. Minor: section 5.2, the "unchanged" commands as written

- **Wrong artifact path.** The `studio-e2e-report` artifact unpacks to
  `reports/studio/e2e-junit.xml`, not `e2e-junit.xml`. I downloaded the artifact
  from run `44506830145` to check. The `api-test-report` artifact does unpack to
  `api-tests.trx` at its root.
- **Missing command.** Step 3 compares against `base-e2e.txt` but does not show
  the command that creates it. The command is in 2.6 only.
- **Locale not fixed.** The sha256 values depend on how `sort` orders the lines.
  Use `LC_ALL=C sort`. I reproduced both hashes in Git Bash, but a tester with
  another locale could get a different hash and wrongly report a difference.

**What would satisfy me.** The section 5.2 commands use the real artifact paths,
include the base e2e list command, and fix the locale.

#### F6. Minor: section 10, second risk row, "The Development host validates scopes"

The integration tests run in the `Testing` environment (`ApiFactory.cs:45`,
`AuthTests.cs:301`), and no test turns on `ValidateScopes` or `ValidateOnBuild`.
So scope validation does not catch a lifetime slip in `AddDigitalHubForms`. Only
the form suites would, and only at request time. The risk is still covered by
CareersTests, PublicContactTests and e2e 10.19, so this is a wording fix.

**What would satisfy me.** The row names the real safety nets.

#### F7. Minor: section 11, the coverage table and section 4.3, stale usings

- **No check for `ContactRateLimit`.** The coverage row for throttles includes
  `ContactRateLimit`, but no test or check proves where it lives. It cannot be in
  the red test, because it does not exist at the base. Add it to C8, for example
  `git ls-files api/src/DigitalHub.Forms` lists `ContactRateLimit.cs`, or to the
  green half of `FormsLibraryTests`.
- **Stale usings not decided.** Section 4.3 says "`using DigitalHub.Forms;` only"
  for `PublicApplyController.cs`, `ExceptionShieldMiddleware.cs` and
  `RequestBodyLimit.cs`. After the move, their `using DigitalHub.Api.Content;`
  may import nothing. Say whether it stays (harmless) or goes, so the developer
  does not have to choose.

### The architect's flagged points

1. **Log `SourceContext` (`DigitalHub.Api.Content.*` to `DigitalHub.Forms.*`).** I
   rule that this is part of the move the owner accepted, not a behaviour change
   under P-7, so the change is not BLOCKED ON OWNER. Evidence I checked:
   - The owner asked for the code to be moved "into a DigitalHub.Forms library",
     and ADR 0001 point 2 names that library. A type's logger category follows
     its full name. Keeping the old names would need loggers created by name, so
     the new library would carry the admin API's namespace in its log output.
     That works against the boundary ISO-2 has to check.
   - `appsettings.json` has no `WriteTo` and no `DigitalHub.*` override.
     `Program.cs:36` prints `[{Timestamp:O} {Level:u3}] {CorrelationId}
     {Message:lj}` with no `SourceContext`.
   - A grep of `api/tests` and `api/src` for `SourceContext` and
     `"DigitalHub.Api.Content.` finds nothing. The only fixed category,
     `RateLimitLog.Category = "DigitalHub.Api.RateLimit"`, does not move.
   - The exception logs print `GetType().Name`, not `FullName`
     (`ExceptionShieldMiddleware.cs:79`, `UnhandledExceptionHandler.cs:19`), so
     `EmailDeliveryException` would log the same if it were ever logged.
   - Nothing is deployed before Phase D.

   The HTTP behaviour, the messages and the levels are unchanged. The plan already
   records the change in sections 3.4(6), 6 and 9. `implementation.md` should
   repeat it so ISO-2 and Phase D know the new category.

2. **Web SDK fallback.** Acceptable in principle, with the conditions in F3.

3. **"208 and 22" read as 576 and 34.** Verified, and correct.
   - Run `44506830145` is CI on `cdef7c90bf…`, conclusion `success`.
   - Its trx shows `<Counters total="576" executed="576" passed="576" failed="0" …>`.
     The sorted `testName` list has 576 lines, 560 distinct, sha256
     `3034a709d4df3caaf2d0d95edb6e60b20965d28e35e7a995e81ad2d75a3b7a94`.
   - Its e2e junit shows `tests="34" failures="0" skipped="0" errors="0"`. The
     sorted list has 34 lines, sha256
     `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a`.

   Both hashes match the plan. The 208 and 22 tests are a subset of these, so the
   reading is stricter than the literal text and needs no owner decision. The
   "Done when" text is quoted word for word from line 212.

   The three-part proof of "unchanged" is sound once F5 is fixed:
   - No test source file changes.
   - `comm -23` on the multiset of names is empty, and `comm -13` shows only the
     two new tests.
   - The totals are 578 and 34, all passing.

   No test name carries a moved namespace: a grep of the base list for
   `Api.Content` and `Forms` returns 0. No test scans `typeof(Program).Assembly`
   for types, so moving types out of the assembly cannot quietly shrink what a
   convention test covers. The only assembly filter is
   `PageQueryBindingTests.cs:38`, on controllers, and the controllers stay.
   Playwright has no retries configured (`studio/playwright.config.ts`), so a
   pass in the junit file is a first-attempt pass.

### Checked and found sound

- **Fit.** The plan closes ISO-1 and part of GAP-38, and says that GAP-38 stays open
  for ISO-2 and ISO-3. ADR 0001 point 2 is quoted exactly. The ADR status
  ("accepted", 19 November 2026) and the owner's go-ahead are quoted as given.
- **Current state, verified in the code:**
  - The seven files and their line counts (261, 125, 44, 73, 85, 77, 24).
  - `ApplicationIntake`'s dependencies: `db.Vacancies` and `ContentStatus` at
    62-66, `db.SiteSettings` at 217, `MERGE` at 224-253, `CountFailed` at 255-256.
  - `PublicContactStore`: the `ContactRequests` insert at 71-83, and its use of
    `ContentOutcome`.
  - `ContentOutcome` is in `ContentStore.cs`. Its `Warnings` member is never read
    by `PublicContactController`, so `FormOutcome` without it changes nothing.
  - `Program.cs`: registrations at 78-82, the policy title at 129, the policy at
    152-161, `ApplyPage` at 191-197.
  - Uses in the controllers and middleware.
  - The only test file that uses the moved names is `CareersTests.cs`
    (16 matches).
  - None of the new type names exists anywhere in `api/`, so the global
    `<Using Include="DigitalHub.Forms" />` cannot make a name ambiguous.
- **Architecture:**
  - The controllers, middleware, entities and `ContentDbContext` stay in
    `DigitalHub.Api`. The reasons are real: `PageQueryBindingTests.cs:38`,
    `no-hiring-system.test.ts:158`, and the model snapshot's CLR names.
  - The `IFormsData` adapter runs the same full-entity `AsNoTracking` queries,
    with the same `OrderBy(Id)`, on the same scoped `ContentDbContext`. The
    `Serializable` transaction and the `MERGE` keep their connection and scope.
  - The rejected alternatives are real choices with stated costs.
  - S-1 is untouched. The A-11 layering stays recognisable, because the store
    keeps the rules and the adapter holds the EF calls.
  - The library has no Identity, JWT or `DigitalHub.Api` reference, as the ADR
    requires, and a test checks it.
- **Scope and B-8.** One topic. Every file to create is new on purpose, and every
  file to change exists. I re-ran `gh pr view --json files` for #68, #69, #70 and
  #60, and compared the local `change/GAP-07`, `GAP-34`, `ADM-07c` and
  `adr-0001-accept` branches against the base. None touches `api/src`,
  `api/tests`, `api/DigitalHub.slnx` or `api/README.md`. #68 edits `ci.yml` and
  `security.yml`, but both build and audit through `DigitalHub.slnx`
  (`ci.yml:80`, `run-dotnet-audit.sh`), so the new project is picked up with no
  change to the workflows.
- **Website guard.** `no-hiring-system.test.ts` has no path exemption for the moved
  files. Its needles and its `DbSet` allow-list are unaffected, because Forms
  declares no `DbSet`. Its `inModel` rule watches only `api/src/DigitalHub.Api/Data/`.
- **Gates.** None is weakened. Semgrep scans the whole of `api`
  (`run-semgrep.sh`), so the new folder is covered. No `known-findings.json`
  entry names a moved file. The `MERGE` stays a constant raw string with
  `SqlParameter`s. No new gate, so no `*_BLOCKING_FROM` date or canary is needed.
- **Security.** No route, policy, body limit, host or rate-limit change. The policy
  name stays `"public-contact"` as a `const`, so `RateLimitLogTests:60` and the
  `OnRejected` switch keep working. No configuration key moves. No secrets. The
  new project pins exact versions: EF Core SqlServer 10.0.12, and the Pkcs 9.0.21
  pin against GHSA-846f-f764-76mx through SqlClient 6.1.6. No new package id. No
  migration, with C5 and C6 to prove it. The databases named are
  `DigitalHubContent_Test` and `DigitalHubContent_E2e`, never `DigitalHubContent`.
- **Testability.** The two red tests are named exactly. They compile at the base
  through `using DigitalHub.Api.Content;`, and they fail there for the reasons
  stated. My one concern is how the red result is evidenced (F1).
- **Build path.** The Studio e2e harness builds `DigitalHub.Api.csproj`
  (`studio/e2e/start-api.ts:45`), so it picks up Forms through the project
  reference.
- **Owner decisions.** No owner decision is assumed for the scope. The
  `SourceContext` question was put to the reviewer openly, with the exact
  question ready if needed. See F1 for the decision that is missing.
- **Rollback and risks.** Reverting the pull request is a real rollback: no
  schema, data or configuration changes. The risks are specific, apart from F6.

Round 1 verdict (superseded by Round 2): CHANGES NEEDED.

## Round 2

Reviewer: plan-reviewer, 19 November 2026. Plan reviewed:
`docs/changes/ISO-1/plan.md`, revised after round 1 (797 lines; status "ready
for plan review, round 2"; revision log section 12, round 2). I checked the
plan's claims against the code at `cdef7c9` and against CI run `44506830145`.

### Round 1 findings

| Finding | Resolved? | Evidence |
|---|---|---|
| F1 (Major), red evidence route | **Yes** | Section 5.1 no longer claims evidence from the tester's checkout or from CI on the first push. It tries route (c), a local Release run on commit 1, first. If that cannot run, it uses route (b): NOT RUN, with a static reading the tester can check read-only. I checked every claim in that reading. `grep -n AssemblyName api/src/DigitalHub.Api/DigitalHub.Api.csproj` finds nothing, so the assembly is named `DigitalHub.Api`. `JwtSecurityTokenHandler` is at `Auth/TokenService.cs:238`. `AddJwtBearer` is at `Program.cs:216`. `IdentityUser` is at `Data/ApplicationUser.cs:5`. `AddIdentityCore` is at `Program.cs:61`. `DigitalHub.Images` is used in `Content/MediaLibrary.cs` and `Controllers/MediaController.cs`. The green evidence is the PR head's `api` trx. Route (a) is not taken. Section 9 says why and gives the exact owner question in case gate 1 finds (b) not enough. This is what I asked for in round 1 |
| F2, commit order and B-6 | **Yes** | Section 3.5 now keeps content changes and renames in separate commits. Commit 2 adds the project and the types that depend on nothing in `DigitalHub.Api`. Commit 3 is the in-place change in `DigitalHub.Api/Content`. Commit 4 is a pure rename: seven files, namespace line only, plus the consumers' usings. Commit 5 fills in `AddDigitalHubForms`. Each commit builds as described. Commit 3 removes the `DigitalHub.Api.Data`, SqlClient and EF usings (section 3.2), so the files can compile in Forms at commit 4. C7 now reviews commit 4, and the commit 2 and 3 pair, separately |
| F3, Web SDK fallback | **Yes** | Section 10.1 sets the trigger: a quoted Application Control load failure naming `DigitalHub.Forms.dll`, while `DigitalHub.Images.dll` and `DigitalHub.Api.dll` load in the same run. There is no switch when no local .NET runs at all. The fallback csproj is written out in full, with no `FrameworkReference` (so no NETSDK1086) and the `<Using>` items dropped, with a sound reason: the Web SDK's implicit usings are the set the moved files compile under today. `CETCompat` and both pinned packages are kept. C1 to C10 are re-run after a switch |
| F4, C1 route through CI | **Yes** | I checked the base value in the log of job `135500545250` in run `44506830145`, step "Build (Release)": `13 Warning(s)`, `0 Error(s)`. Every `warning CS` line is CS8601 or CS8604 in `api/tools/DigitalHub.ContentImport`, as the plan says. The head value, a NOT RUN path, and "none in `DigitalHub.Forms`" are all specified. C2 also has a NOT RUN path |
| F5, the "unchanged" commands | **Yes** | Section 5.2 now downloads both artifacts and uses `reports/studio/e2e-junit.xml`, which matches the layout I downloaded in round 1. It builds both base lists explicitly, and uses `LC_ALL=C sort` and `LC_ALL=C comm`. The expected counts and hashes are unchanged: 576 / `3034a709…7a94` and 34 / `ed0f1b41…848a` |
| F6, scope-validation claim | **Yes** | The risk row now says the tests run in `Testing` (`ApiFactory.cs:45`) with no scope validation. It names the test suites that actually resolve each registration, and the lifetime review against base `Program.cs:78-82` |
| F7, `ContactRateLimit` check and stale usings | **Yes** | C8 adds `git ls-files api/src/DigitalHub.Forms`, which must list twelve `.cs` files and the csproj: seven moved plus five new, which is correct. It also adds `grep -rn '"public-contact"' api/src`. Today that grep matches three places (`PublicContactController.cs:21`, `Program.cs:129`, `Program.cs:152`), and the plan moves all three to `ContactRateLimit.PolicyName`, so after the change only the const can match. The coverage row cites C8. Section 4.3 now decides each using. I checked that `PublicApplyController.cs`, `PublicContactController.cs`, `ExceptionShieldMiddleware.cs` and `RequestBodyLimit.cs` use no `DigitalHub.Api.Content` type except the moved ones. In any case C1 would catch a mistake there as a build error |

The `SourceContext` ruling is carried into section 9 accurately, and section 3.5
now requires `implementation.md` to name `DigitalHub.Forms.ApplicationIntake`
and `DigitalHub.Forms.SmtpEmailSender`.

### New issues from the revision

None that is Blocker, Major or Minor. I looked for these in particular:

- **Commit 3 temporarily makes `DigitalHub.Api.Content` types depend on Forms.**
  This is the right direction: API depends on Forms, never Forms on API, so it
  is not a cycle. `ContentFormsData` is registered at commit 3, before anything
  that needs it is resolved.
- **The redundant `using DigitalHub.Forms;` in the moved files during commit 4.**
  CS8019 is a hidden diagnostic, so C1 is unaffected. The using is removed in
  commit 5.
- **The C8 grep on a built tree.** A compiled string is stored as UTF-16 with no
  surrounding quotes, so the ASCII pattern `"public-contact"` cannot match a
  file in `bin/` or `obj/`.
- **A Web SDK library referenced by the Web SDK API.** The fallback keeps
  `OutputType Library`, and the API already references other library projects
  the same way, so there is no new failure mode. Static web assets are empty,
  because Forms has no `wwwroot`.
- **The owner question in section 9.** It is worded exactly and is held back
  for the tech lead. No owner answer is assumed.

### Checked and still sound

Everything listed under "Checked and found sound" in round 1 still holds:

- Fit, with the "Done when" text quoted word for word from line 212.
- The reading of "208 and 22" as 576 and 34.
- Architecture against ADR 0001 point 2, S-1 and A-11.
- Scope: one topic, and no overlap with #68, #69, #70, #60 or the local change
  branches.
- Gates: none weakened, and Semgrep covers `api`.
- Security: no route, policy, host, login, secret or migration change, and the
  same pinned packages.
- Rollback: revert the pull request.

Verdict: APPROVED
