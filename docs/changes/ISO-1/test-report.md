# ISO-1: test report

Tester (Claude Code), 19 November 2026. Track G2, isolation. Records read:
`docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, `ENGINEERING_STANDARDS.md`,
`docs/adr/0001-split-public-forms-api.md`, and every file in `docs/changes/ISO-1/`
(`plan.md` round 2, `plan-review.md`, `plan-approval.md` with its seven conditions,
`implementation.md`).

## Round 1

- Commit tested: `cbed5a01fdb1a5c10e70e5d0f060945bb2f24e9e` (head of `change/ISO-1`).
  Base `cdef7c90bf5546ecea891e9b12e2aec28d265716`. Red-test commit `d998a51`.
- Where: a detached worktree, `D:\work\DigitalHub\dh-platform-claude-iso-1-test`, made with
  `git -C D:\work\DigitalHub\dh-platform worktree add --detach ... cbed5a0...` and removed
  at the end. I edited no source, test, lockfile or workflow, and committed and pushed
  nothing. This file is the only one I wrote in the developer's worktree.
- Environment: `dotnet` 10.0.401, Release only. Integration tests ran against
  `DigitalHubContent_Test` through `ApiFactory` (it rewrites the catalog and refuses
  anything else, `ApiFactory.cs:130-146`). Before each database run I checked that no
  `testhost` was running. No migration was created or applied. Nothing touched
  `DigitalHubContent`. Ports: 4250, 4251 (e2e), 4280, 4281 (CSP check), 4284, 4285
  (screenshot-parity test) and 4290 (section compare). Port 4381 belonged to another
  process, so I moved the CSP check off it. I stopped no process I did not start.
- Scratch outputs (trx, logs, CI artifacts) are in the session scratchpad, not the repo.

### 1. The red test was red

| Step | Command | Exit | Output |
|---|---|---|---|
| Checkout | `git checkout --detach d998a51`; `git diff --stat cdef7c9..HEAD` | 0 | Only `FormsLibraryTests.cs` and the three plan records differ from the base |
| Build | `dotnet build DigitalHub.slnx -c Release` (in `api/`) | 0 | `13 Warning(s)`, `0 Error(s)` |
| Red run | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"` | 1 | `Failed ...The_forms_library_references_no_admin_api_identity_or_token_code` with `Found: "DigitalHub.Images"`; `Failed ...Contact_and_apply_code_lives_in_the_forms_library` with `Expected: "DigitalHub.Forms"` / `Actual: "DigitalHub.Api"`; `Failed!  - Failed: 2, Passed: 0, Skipped: 0, Total: 2` |
| Green run at head | same filter at `cbed5a0` (C2) | 0 | `Passed: 2` (inside the full run below, and in the C4 build) |

Both tests fail for the reasons plan 5.1 gives: test 1 because the assembly is
`DigitalHub.Api`, test 2 on the first forbidden reference, `DigitalHub.Images`. This
confirms the developer's route (c) run. Condition 3 (stop on contradiction) does not
trigger.

### 2. Test plan checks (plan 5.2 and 5.3) at the head

| # | Command (from `api/` unless stated) | Exit | Relevant output |
|---|---|---|---|
| C1 | `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)`. All 13 are CS8601 and CS8604 in `api\tools\DigitalHub.ContentImport\ContentWriter.cs`, none in `DigitalHub.Forms`. Same count as the base (CI run `44506830145`) and as `d998a51` above |
| prereq | `cd website && npm ci --no-audit --no-fund`; `cd studio && npm ci --no-audit --no-fund` | 0 | `ApiAcceptedContentTests` needs `website/node_modules`, as the developer noted. `git status` stayed clean |
| C3 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=iso1-head.trx" --results-directory <scratch>` | 0 | `Passed!  - Failed: 0, Passed: 578, Skipped: 0, Total: 578, Duration: 1 m 22 s`; trx `<Counters total="578" executed="578" passed="578" failed="0" error="0" ...>`; 578 `outcome="Passed"` |
| 5.2 step 2 (local trx in place of the PR-head trx) | `gh run download 44506830145 -n api-test-report`; `grep -o 'testName="[^"]*"' base/api-tests.trx \| LC_ALL=C sort > base.txt`; the same for `iso1-head.trx` > `pr.txt`; `LC_ALL=C comm -23 base.txt pr.txt`; `LC_ALL=C comm -13 base.txt pr.txt` | 0 | `base.txt`: 576 lines, sha256 `3034a709d4df3caaf2d0d95edb6e60b20965d28e35e7a995e81ad2d75a3b7a94` (equal to plan 2.6). `pr.txt`: 578 lines. `comm -23`: **empty** (no base test is missing). `comm -13`: exactly `...FormsLibraryTests.Contact_and_apply_code_lives_in_the_forms_library` and `...FormsLibraryTests.The_forms_library_references_no_admin_api_identity_or_token_code` |
| C4 | `dotnet test ... --no-build --filter "FullyQualifiedName~CareersTests\|FullyQualifiedName~ApplyDedupeTests\|FullyQualifiedName~PublicContact\|FullyQualifiedName~RequestBodyLimitTests\|FullyQualifiedName~RateLimitLogTests\|FullyQualifiedName~AbortedRequestTests"` | 0 | `Passed!  - Failed: 0, Passed: 48, Skipped: 0, Total: 48` |
| C5 (as planned) | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;Encrypt=True;TrustServerCertificate=True" dotnet tool run dotnet-ef -- migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build` | 1 | After `dotnet tool restore` printed `Restore was successful.`, it still printed `Run "dotnet tool restore" to make the "dotnet-ef" command available.` This reproduces the developer's note. It is a machine problem: `git diff --stat cdef7c9..HEAD -- .config dotnet-tools.json` is empty, so ISO-1 did not change the tool manifests |
| C5 (restored dll) | same arguments via `dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations has-pending-model-changes ...` | 0 | `No changes have been made to the model since the last migration.` The planned `dotnet tool run` form is CI job `api`, step "Restore tools (dotnet-ef)" plus the migration steps |
| C6 | `git diff --stat cdef7c9..HEAD -- api/src/DigitalHub.Api/Data` | 0 | empty |
| C7 | `git show -M --stat 4dda548`; `git show -M --format= 4dda548 \| grep -E '^(\+\|-)[^+-]'` | 0 | 12 files, `11 insertions(+), 11 deletions(-)`. The seven files show as `{DigitalHub.Api/Content => DigitalHub.Forms}/...`. The only changed lines are 7 × `-namespace DigitalHub.Api.Content;` / `+namespace DigitalHub.Forms;`, 3 × `-using DigitalHub.Api.Content;` / `+using DigitalHub.Forms;`, 1 × `-using DigitalHub.Api.Content;` (contact controller) and `+    <Using Include="DigitalHub.Forms" />`. Commit 4 is a pure rename (B-6). From the full diff, I compared `ApplicationCountSql.cs` with the `IncrementAsync` and `CountFailed` lines deleted from `ApplicationIntake.cs`. They differ only in the signatures and in `db.Database.` becoming `database.`; the MERGE text, the parameters, the retry and the filter are identical |
| C7, commit discipline | `git show --stat <sha>` for `d998a51`, `531441f`, `ad9de04`, `4dda548`, `cbed5a0` | 0 | Each has `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (B-4). File lists match plan 3.5: commit 1 has the test only; commit 2 the project and new types; commit 3 the content change in place; commit 4 the rename; commit 5 the registration, the README and `implementation.md` |
| C8 | `grep -rn "DigitalHub\.Api\|DbSet<" api/src/DigitalHub.Forms --include=*.cs --include=*.csproj`; `git ls-files api/src/DigitalHub.Forms`; `grep -rn '"public-contact"' api/src` | 1 / 0 / 0 | First: no match. Second: twelve `.cs` files (`ApplicationCountSql`, `ApplicationIntake`, `ApplyDedupe`, `ApplyPage`, `ApplyThrottle`, `ContactRateLimit`, `CvFile`, `EmailSender`, `FormOutcome`, `FormsServiceCollectionExtensions`, `IFormsData`, `PublicContactStore`) plus `DigitalHub.Forms.csproj`. Third: exactly `api/src/DigitalHub.Forms/ContactRateLimit.cs:8:    public const string PolicyName = "public-contact";` |
| C9 | `dotnet list DigitalHub.slnx package --vulnerable --include-transitive` | 0 | `DigitalHub.Api`, `DigitalHub.Forms`, `DigitalHub.Api.Tests` and `DigitalHub.ContentImport` each `has no vulnerable packages given the current sources.` |
| C10 | `dotnet list src/DigitalHub.Forms/DigitalHub.Forms.csproj package --include-transitive` | 0 | Top level: `Microsoft.EntityFrameworkCore.SqlServer 10.0.12`, `System.Security.Cryptography.Pkcs 9.0.21`. Transitive: `Azure.Identity 1.17.1`, `Microsoft.Identity.Client*`, `Microsoft.IdentityModel.*` 7.7.1 (including `.Tokens`), `System.IdentityModel.Tokens.Jwt 7.7.1`, all via `Microsoft.Data.SqlClient 6.1.6`. There is no `Microsoft.AspNetCore.Identity.*`, no `Microsoft.Extensions.Identity.*` package and no `Microsoft.AspNetCore.Authentication.JwtBearer`. See the C10 judgement below |
| C10, compiled references | `[Reflection.Assembly]::ReflectionOnlyLoadFrom('src/DigitalHub.Forms/bin/Release/net10.0/DigitalHub.Forms.dll').GetReferencedAssemblies()` | 0 | 23 references: `System.*`, `Microsoft.EntityFrameworkCore`(`.Relational`), `Microsoft.Data.SqlClient`, `Microsoft.AspNetCore.Http.*`, `Microsoft.Extensions.{Logging,Configuration,DependencyInjection}.Abstractions`, `Configuration.Binder`, `Primitives`. None is Identity, authentication or a JWT/IdentityModel assembly |
| C11 | `cd website && npx vitest run test/no-hiring-system.test.ts` | 0 | `Test Files  1 passed (1)`, `Tests  2 passed (2)` |
| 5.2 step 1 | `git diff --stat cdef7c9..HEAD -- api/tests studio website`; `git diff cdef7c9..HEAD -- api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` | 0 | Only `DigitalHub.Api.Tests.csproj` (+2) and `FormsLibraryTests.cs` (new). The csproj diff is exactly `+    <Using Include="DigitalHub.Forms" />` and `+    <ProjectReference Include="..\..\src\DigitalHub.Forms\DigitalHub.Forms.csproj" />`. No existing test source changed |
| 5.2 step 3 / C13 | `cd studio && DH_E2E_API_PORT=4250 DH_E2E_STUDIO_PORT=4251 npm run test:e2e` | 1 | `[WebServer] E2E Release migrations failed; the API was not started.` **NOT RUN** (harness failure before any test). It fails on the same local `dotnet tool run dotnet-ef` problem as C5 (`studio/e2e/start-api.ts:46-53`). This is the known local state recorded in plan 2.7 and the ADM-05 report. The harness's own reset ran first: it dropped and recreated `DigitalHubContent_E2e`, which is now empty (no migrations). The next harness run resets it again. Covered by CI job `studio`, step "End-to-end suite", on the PR head (artifact `studio-e2e-report`), with the plan's `diff` of the 34 names (base sha256 `ed0f1b41…848a`), which must be empty, and `tests="34" failures="0"` |
| CI on the PR head | `CI` (`api`, `website`, `studio`, `section-compare`, `website-browser`), `Security`, `Workflow lint` | — | **NOT RUN**: nothing is pushed until the owner confirms (README, after step 6). Gate 2 or the owner must quote the PR-head run before the merge: the `api` "Build (Release)" `Warning(s)` line (at most 13), the `api-test-report` `comm -23` (empty) and `comm -13` (the two new names), with `Counters total="578" passed="578"`, and the `studio-e2e-report` `diff` (empty), with `tests="34" failures="0"` |

### 3. Website and Studio suites (tester's required list)

| Command | Exit | Output |
|---|---|---|
| `cd website && CSP_CHECK_PORT=4280 CSP_CHECK_DEBUG_PORT=4281 SECTION_COMPARE_PORT=4290 npm test` | 0 | `Test Files  24 passed (24)`, `Tests  461 passed \| 1 skipped (462)`. The skip is the designed placeholder `it.skip("needs Playwright's Chromium...")` at `test/screenshot-parity-browser.test.ts:203` |
| `npm run typecheck` | 0 | `tsc --noEmit`, no errors |
| `npm run design:check` | 0 | `all 10 design sets match the 29 old pages they come from.` / `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `npm run build`, without CI's env | 1 | `No content source is configured. Set CONTENT_SOURCE=snapshot ...`, then `PUBLIC_SITE_URL is not set`. These were my invocation errors: CI sets both (`ci.yml:172-176`) |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` (1st) | 1 | 29/29 pages prerendered, then `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.` (Next 16.4.3). The message told the agent to retry, and to offer the user a `next upgrade`. I did not act on the upgrade offer, because it is outside a tester's remit |
| same command (retry, as the message says) | 0 | `Build output checks passed.`; `Design: out/design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte (25 files).` |
| `SECTION_COMPARE_PORT=4290 npm run compare:sections`, default old site, then with `SECTION_COMPARE_OLD=<fresh shallow clone of feature/interviewer-portal at eb05f06>` | 1, 1 | Both runs: `104/119 sections match; 14 accepted; 1 failures (including chrome).`, `differs: /careers/apply.html #section`. **Not from ISO-1**: `git diff --stat cdef7c9..HEAD -- website packages` is empty, and the base CI run `44506830145`, job `135500944418`, logs the same two lines. The CI step is `continue-on-error: true` (`ci.yml`, "Compare sections"). ADM-04, ADM-05, GAP-01, GAP-04 and ci-runner-pin recorded the same base state |
| `cd studio && npm test` | 0 | `Test Files  15 passed (15)`, `Tests  116 passed (116)` |
| `npm run build`, without CI's env | 1 | `VITE_PUBLIC_SITE_URL is not set` (CI sets it, `ci.yml:244`) |
| `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built`; `Preview design: ... matches website/design/ byte for byte.` |
| `npm run test:e2e` | 1 | NOT RUN, see C13 above |
| Website browser suites (`npm run test:browser`) | — | NOT RUN. The plan names none, and ISO-1 changes no website file. CI job `website-browser` covers them |

### 4. Track checklist (G2, `docs/changes/README.md`)

| Line | Result |
|---|---|
| Follow ADR 0001 | Pass for point 2: the library is `DigitalHub.Forms`. It holds the contact and apply validation, `ApplicationIntake`, the throttles (`ApplyThrottle`, `ContactRateLimit`), the dedupe and the email sender, plus `CvFile` and `ApplyPage`. The API and the tests reference it (C7, C8, `FormsLibraryTests`) |
| ISO-1 changes no behaviour: all 208 integration and 22 end-to-end tests pass unchanged | Integration: **pass locally**, read the strict way (all 576 base names, sha256-identical, plus the 2 new tests; 578/578, `comm -23` empty). End-to-end: **NOT RUN locally** (harness, C13); pending CI `studio` on the PR head |
| The public API answers only the two form routes; a test proves every other path returns 404 | N/A until ISO-2 (no public API in this change) |
| The `dh_public_forms` login is proven unable to read users, roles, sessions or audit, or to change content | N/A until ISO-3 (no login in this change) |
| ISO-4 merges only after ISO-5 | N/A |

### 5. Security

| Check | Command | Exit | Output |
|---|---|---|---|
| npm audit, website, full tree | `cd website && npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities` (`fast-uri` 3.0.0-3.1.8; `next` 16.2.0-16.4.4). None is high. ISO-1 changes no lockfile (`git diff --stat cdef7c9..HEAD -- '*package*.json' .github` is empty) |
| npm audit, studio, full tree | `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| npm gate script | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` / `... studio` | 0 / 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` / `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| dotnet gate script | `cd api && RUNNER_TEMP=<scratch> sh ../.github/security/run-dotnet-audit.sh` | 0 | All four projects `has no vulnerable packages`; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep 1.180.0 | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known `AuditRollbackTests.cs:78`). The scan covered all 13 files under `api/src/DigitalHub.Forms` and found nothing there. 41 `PartialParsing` warnings come from C# primary constructors across the codebase. Three of them are moved files (`ApplicationIntake.cs`, `EmailSender.cs`, `PublicContactStore.cs`), and one is the new `ContentFormsData.cs`. They are the same constructor style the files had at their old paths, and the gate passes |
| gitleaks | — | — | **NOT RUN**: gitleaks is not installed (`which gitleaks`: none). Covered by `security.yml` job `gitleaks-pr`. In its place: `git diff cdef7c9..HEAD \| grep -E '^\+' \| grep -iE "password\|secret\|apikey\|connectionstring\|PRIVATE KEY\|AKIA\|ghp_\|Server=\|User ID\|Pwd="` matched only prose in the ISO-1 records and the plan's C5 connection string, which holds no credentials. `grep -ciE "password=\|pwd="` over my test, e2e and build logs: 0 each |
| New or changed routes: role matrix, host, unknown fields, body cap, error shape | review of the diff | — | **No route is added or changed.** `PublicContactController` changes only its `using` and `[EnableRateLimiting(ContactRateLimit.PolicyName)]`, which has the same value, `"public-contact"`. `PublicApplyController` changes only its `using`. Routes, `[AllowAnonymous]`, `BodyLimit` (16 KB contact; the CV limit via `CvFile.BodyLimit`) and the error paths are unchanged. `FormOutcome` has the members of `ContentOutcome` that the controller reads (`Body`, `Status`, `Code`, `Title`, `Errors`); `Warnings` is unused there. Host checks: N/A until ISO-4 (no `appsettings` or `AllowedHosts` change). Unknown fields: `PublicContactRequest` is byte-identical to the base (`diff` of the class: identical). The JSON options set no `UnmappedMemberHandling`, so unknown fields on the contact body are ignored on the base and at the head alike. That is the open GAP-25 (Wave 3), not ISO-1. Body caps and the RFC 7807 shape are re-proven by `RequestBodyLimitTests`, `PublicContactTests`, `CareersTests` and `AbortedRequestTests` (C4, 48/48) |
| Login or permission change | — | — | None. The same `dh_content_app` login, the same `ContentDbContext` scope, and the same queries, insert and MERGE (`ContentFormsData.cs`) |
| Isolation of the library | C10 and the reflection listing above | 0 | The compiled `DigitalHub.Forms.dll` references nothing from Identity, authentication, JWT or the admin API. See finding F1 on how far the guard test reaches |

**C10 judgement (the developer's note).** C10 says "no Identity or JwtBearer package". I
read that as ASP.NET Core Identity (`Microsoft.AspNetCore.Identity.*`,
`Microsoft.Extensions.Identity.*`) and `Microsoft.AspNetCore.Authentication.JwtBearer`,
and none of them is in the tree. `Azure.Identity`, MSAL and `Microsoft.IdentityModel.*`
/ `System.IdentityModel.Tokens.Jwt` 7.7.1 are SqlClient 6.1.6's Entra ID sign-in
dependencies. Any project using EF Core SqlServer gets them, and that includes ISO-2's
public API, whose own DbContext (ADR point 4) needs SqlClient whether or not Forms
exists. ADR 0001 point 1 forbids "authentication, ... Identity, ... JWT signing key" in
the public API. It does not forbid SqlClient's driver dependencies, and Forms uses none
of them (the compiled references above). So C10 passes, and this is not a finding.
Phase D may want to state this explicitly when ISO-2 is reviewed.

### 6. Beyond the plan

- **Guard sensitivity (finding F1).** I copied `api/src/DigitalHub.Forms/*` to a scratch
  folder outside the repo and added one file that calls
  `services.AddAuthentication(IdentityConstants.BearerScheme).AddBearerToken().AddCookie()`.
  `dotnet build -c Release` gave `0 Warning(s)`, `0 Error(s)`. The built dll then
  references `Microsoft.AspNetCore.Identity`, `Microsoft.AspNetCore.Authentication`,
  `Microsoft.AspNetCore.Authentication.BearerToken` and
  `Microsoft.AspNetCore.Authentication.Cookies`, and none of these is on
  `FormsLibraryTests.ForbiddenReferences`. The scratch copy was deleted.
- **DI under the Development host.** The e2e API runs with `ASPNETCORE_ENVIRONMENT:
  "Development"` (`studio/e2e/env.ts:68`), which turns on scope validation, while the
  integration tests use `Testing`. Static check: the singletons `ApplyThrottle(IConfiguration)`,
  `ApplyDedupe(TimeProvider)` and `SmtpEmailSender(IConfiguration, ILogger<>)` take no
  scoped service. The scoped `IFormsData` is used only by the scoped `ApplicationIntake`
  and `PublicContactStore`. No captive dependency, so the Development host has nothing
  new to reject.
- **Stale references.** `git grep` for `DigitalHub.Api.Content.<moved type>` and
  `Content/<moved file>.cs` outside `docs/changes`: no match. No log override, script or
  test names the old logger categories. `implementation.md` 2.4 records the new
  categories (condition 6).
- **Concurrency, retry, empty and maximum input.** No logic changed. The count MERGE,
  its `Serializable` transaction and its single retry are verbatim (C7). The
  closed-vacancy, mailbox-fallback, dedupe, throttle, maximum-size and aborted-request
  paths pass in C4. The concurrent-edit (409) and paging edges do not apply: no editable
  record or list route is touched.

### 7. Findings

**F1, Minor: the "no identity or token code" guard does not cover the ASP.NET Core
Identity and authentication assemblies that the library's `FrameworkReference` makes
available.**

- Steps: on a scratch copy of `api/src/DigitalHub.Forms`, add a class that calls
  `AddAuthentication(IdentityConstants.BearerScheme).AddBearerToken().AddCookie()`. Build
  in Release and list `GetReferencedAssemblies()` (section 6).
- Expected: `The_forms_library_references_no_admin_api_identity_or_token_code` would
  fail. Its name and ADR 0001 point 1 ("no authentication, no Identity") say Forms may not
  carry sign-in or token code.
- Actual: the new references, `Microsoft.AspNetCore.Identity`,
  `Microsoft.AspNetCore.Authentication`, `...Authentication.BearerToken` and
  `...Authentication.Cookies`, are all absent from `ForbiddenReferences`
  (`FormsLibraryTests.cs:28-38`), so the test would still pass. All of them ship in
  `Microsoft.AspNetCore.App`, which `DigitalHub.Forms.csproj` references.
- Impact today: none. The ISO-1 code references none of them (section 5). The guard
  matters from ISO-2 on, when `DigitalHub.PublicApi` depends on it. The list is exactly
  the one in approved plan 5.1, so any change to it goes through the architect. It is
  recorded here, not fixed. If it is not fixed in ISO-1, it needs a D-NNN entry or an
  item in ISO-2's plan.

No Blocker and no Major.

Observations (not findings against ISO-1):

- O1. On this machine `dotnet tool run dotnet-ef` fails after a successful restore. This
  blocks the planned C5 form and the whole local e2e harness ("Release migrations"). It
  predates ISO-1 (manifests unchanged), and the plan's proposed separate change,
  `e2e-local-migrations`, is where it belongs.
- O2. `compare:sections` exits 1 on `/careers/apply.html #section` on the base and at
  the head alike. CI absorbs it with `continue-on-error`.
- O3. Next 16.4.3 in the website lockfile is covered by a moderate advisory
  (`next 16.2.0 - 16.4.4`). The first local build stops with `SecurityFatalError` and
  passes on the retry. This predates ISO-1 and is below the audit gate's level. It is for
  the owner to schedule, under the G1 Wave 0 rules.
- O4. The plan's 5.2 steps 2 and 3 ask the tester to quote the PR-head CI run, which
  cannot exist before gate 2, because the branch is pushed only after the owner
  confirms. I used the local trx for step 2 (an exact name match) and recorded step 3 as
  NOT RUN. The PR-head CI evidence listed in section 2 must be quoted before the
  merge.
- O5. `FormsLibraryTests.cs` still has `using DigitalHub.Api.Content;`, as plan 5.1
  requires. At the head it compiles only because `ContentFormsData` keeps that namespace
  alive. It is harmless.

### 8. Coverage table rows verified

| Item | Source | Status | Evidence |
|---|---|---|---|
| Contact validation (`PublicContactStore`, `PublicContactRequest`) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Verified | C7 rename; `Contact_and_apply_code_lives_in_the_forms_library` red at `d998a51`, green at head (578/578) |
| Apply validation and `ApplicationIntake` are in `DigitalHub.Forms` | same | Verified | C7 (commit 3 port, commit 4 rename, count code identical); same test; C4 48/48 |
| Throttles (`ApplyThrottle`, `ContactRateLimit`) are in `DigitalHub.Forms` | same | Verified | `FormsLibraryTests`; C8 `git ls-files` lists `ContactRateLimit.cs`, and `"public-contact"` occurs only at `ContactRateLimit.cs:8`; `RateLimitLogTests` in C4 |
| Dedupe (`ApplyDedupe`) is in `DigitalHub.Forms` | same | Verified | `FormsLibraryTests`; `ApplyDedupeTests` in C4 |
| Email sender types are in `DigitalHub.Forms` | same | Verified | `FormsLibraryTests`; `CareersTests` in C4 |
| `CvFile`, `ApplyPage` are in `DigitalHub.Forms` | ADR 0001 points 1-2 | Verified | `FormsLibraryTests`; `RequestBodyLimitTests` and `AbortedRequestTests` in C4 |
| The library references no admin API, Identity or JWT code | ADR 0001 points 1-2 | Verified for the current code, with F1 on the guard's reach | Guard test red at `d998a51`, green at head; compiled references listed in section 5; C8 grep empty; C10 judgement |
| The tests reference the library | ADR 0001 point 2 | Verified | Test csproj `ProjectReference` and `<Using>` (5.2 step 1) |
| All base integration tests (576, by name) pass unchanged | Refinement plan line 212; README G2 | Verified locally | 578/578; base sha256 `3034a709…7a94`; `comm -23` empty, `comm -13` the 2 new names. PR-head `api` trx still to be quoted (O4) |
| All base end-to-end tests (34, by name) pass unchanged | Refinement plan line 212; README G2 | **NOT RUN locally** | Harness fails at "Release migrations" (C13, O1). CI job `studio`, "End-to-end suite", on the PR head must show `diff` empty and `tests="34" failures="0"` |
| No existing test source file is edited | Owner's request; caller | Verified | 5.2 step 1 |
| No migration and no model change | `AGENTS.md` Schema; plan 7 | Verified | C5 (dll route) `No changes have been made to the model`; C6 empty |
| No route, login or host change | Refinement plan ISO-2 to ISO-5 | Verified | Section 5 route review; C7 consumer diffs are `using` lines only, plus a constant of the same value; C11 pass |
| GAP-38, part | Refinement plan line 114 | Verified as partial | ISO-1 done; GAP-38 stays open for ISO-2 and ISO-3 |

Every check that can run on this machine passes, apart from the pre-existing base state
in O2 and the build retry in O3. Running the plan's own expectations, I found no
Blocker and no Major. The end-to-end half of "Done when" (C13) and the PR-head CI
quotes (O4) cannot run before the push. The plan sets them as NOT RUN with CI job
`studio` and the PR-head run as the authority, and gate 1 accepted that. They must be
quoted from the PR-head run before the owner merges. F1 is Minor and goes back to the
developer and architect.

Verdict: APPROVED
