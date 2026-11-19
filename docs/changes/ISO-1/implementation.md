# ISO-1: implementation

Developer, 19 November 2026. Plan: `docs/changes/ISO-1/plan.md` (round 2, committed in
`dc7b6cd`). Gate 1: `plan-approval.md`, `Verdict: APPROVED` with seven conditions.
Branch `change/ISO-1`, worktree `D:\work\DigitalHub\dh-platform-claude-iso-1`, base
`cdef7c90bf5546ecea891e9b12e2aec28d265716`. After `git fetch`,
`git rev-parse origin/rebuild/dotnet-platform` still prints
`cdef7c90bf5546ecea891e9b12e2aec28d265716`, so there is no rebase and condition 4 has
nothing to re-baseline.

Nothing was pushed. The pipeline stops for the owner before any push.

## 1. Commits

They follow plan 3.5, in five commits, red test first. Content changes and renames
never share a commit (B-6). Each commit carries the attribution trailer (B-4).

| # | SHA | Subject | Builds | New tests |
|---|---|---|---|---|
| 1 | `d998a51` | ISO-1: Add the forms-library tests (red) | yes | 2 failed (red, run locally, 2.1) |
| 2 | `531441f` | ISO-1: Add the DigitalHub.Forms project and its new types | yes, 13 warnings, 0 errors | still 2 failed |
| 3 | `ad9de04` | ISO-1: Put contact and apply intake behind IFormsData | yes, 13 warnings, 0 errors | still 2 failed; the 48 form-suite tests passed |
| 4 | `4dda548` | ISO-1: Move the contact and apply code to DigitalHub.Forms (rename) | yes, 13 warnings, 0 errors | 2 passed |
| 5 | the commit that adds this file | ISO-1: Register the forms services in one place, and name the library | yes, 13 warnings, 0 errors | 2 passed; 578 of 578 |

The red-test commit is `d998a51`. The fix commits are `531441f`, `ad9de04`,
`4dda548` and commit 5. Every check in section 3 ran on commit 5's code in the
working tree. This file was the only thing not yet committed.

## 2. What changed, file by file (plan section 4)

### 2.1 Create (plan 4.1)

| File | Commit | What |
|---|---|---|
| `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs` | 1 | The two tests in plan 5.1, `namespace DigitalHub.Api.Tests`, `using DigitalHub.Api.Content;`, no fixture, no database |
| `api/src/DigitalHub.Forms/DigitalHub.Forms.csproj` | 2 | `Microsoft.NET.Sdk`, `net10.0`, `ImplicitUsings`, `Nullable`, `CETCompat`; `FrameworkReference Microsoft.AspNetCore.App`; `<Using>` for `Microsoft.AspNetCore.Http`, `Microsoft.Extensions.Configuration`, `Microsoft.Extensions.DependencyInjection`, `Microsoft.Extensions.Logging`; `Microsoft.EntityFrameworkCore.SqlServer` 10.0.12 and the `System.Security.Cryptography.Pkcs` 9.0.21 pin with the API's comment. No reference to `DigitalHub.Api` or `DigitalHub.Images` (plan 3.1) |
| `api/src/DigitalHub.Forms/IFormsData.cs` | 2 | `IFormsData` and the records `ContactSubmission`, `FormsVacancy`, `FormsMailboxes`, with the signatures in plan 3.3 |
| `api/src/DigitalHub.Forms/FormOutcome.cs` | 2 | `FormOutcome` with `Body`, `Status`, `Code`, `Title`, `Errors`, `Ok` and `Fail`, as in plan 3.3 |
| `api/src/DigitalHub.Forms/ApplicationCountSql.cs` | 2 | `IncrementAsync(DatabaseFacade, ...)` and `CountFailed`, copied from `ApplicationIntake` lines 224-256. The only differences are `db.Database` becoming the `database` parameter, and `private` becoming `public static` (C7) |
| `api/src/DigitalHub.Forms/ContactRateLimit.cs` | 2 | `PolicyName = "public-contact"` and `Partition(httpContext, permitLimit, windowHours)`. The body is the old `Program.cs:152-161` lambda: key `"contact\n" + ip`, fixed window, `QueueLimit = 0` |
| `api/src/DigitalHub.Api/Content/ContentFormsData.cs` | 3 | `ContentFormsData(ContentDbContext db) : IFormsData`. It runs the same queries as before: `db.ContactRequests.Add` plus `SaveChangesAsync`; `db.Vacancies.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, ...)` (the full entity, no projection), mapped to `FormsVacancy(Id, Title, Status == Published)`; `db.SiteSettings.AsNoTracking().OrderBy(item => item.Id).FirstOrDefaultAsync(...)`, mapped to `FormsMailboxes(CareersEmail, Email)`; and `ApplicationCountSql.IncrementAsync(db.Database, ...)` |
| `api/src/DigitalHub.Forms/FormsServiceCollectionExtensions.cs` | 5 | `AddDigitalHubForms()`. It registers, with the base `Program.cs:78-82` lifetimes: `PublicContactStore` scoped, `ApplicationIntake` scoped, `ApplyThrottle` singleton, `ApplyDedupe` singleton, and `IEmailSender` to `SmtpEmailSender` singleton |
| `docs/changes/ISO-1/implementation.md` | 5 | This record |

### 2.2 Move (plan 4.2), commit 4, pure rename

`git mv` from `api/src/DigitalHub.Api/Content/` to `api/src/DigitalHub.Forms/`:
`ApplyDedupe.cs`, `ApplyThrottle.cs`, `ApplyPage.cs`, `CvFile.cs`, `EmailSender.cs`,
`ApplicationIntake.cs` and `PublicContactStore.cs`. In each file, the only change is
`namespace DigitalHub.Api.Content;` becoming `namespace DigitalHub.Forms;`
(C7 quotes the diff).

### 2.3 Change (plan 4.3)

| File | Commit | Change |
|---|---|---|
| `api/DigitalHub.slnx` | 2 | `src/DigitalHub.Forms/DigitalHub.Forms.csproj` under `/src/` |
| `api/src/DigitalHub.Api/DigitalHub.Api.csproj` | 2 | `ProjectReference` to Forms |
| `api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` | 2, 4 | `ProjectReference` to Forms (commit 2); `<Using Include="DigitalHub.Forms" />` (commit 4) |
| `api/src/DigitalHub.Api/Content/ApplicationIntake.cs` (moved in 4) | 3, 5 | Commit 3: the constructor takes `IFormsData data`. The vacancy lookup becomes `data.FindVacancyAsync` with `!vacancy.Published`, the mailbox read becomes `data.MailboxesAsync`, and the count becomes `data.IncrementApplicationCountAsync` with the filter `ApplicationCountSql.CountFailed`. The private `IncrementAsync` and `CountFailed` are deleted. The `using`s for `DigitalHub.Api.Data`, SqlClient and EF go, and `using DigitalHub.Forms;` comes in. Commit 5: the now-redundant `using DigitalHub.Forms;` is removed |
| `api/src/DigitalHub.Api/Content/PublicContactStore.cs` (moved in 4) | 3, 5 | Commit 3: the constructor takes `IFormsData data`, `ContentOutcome` becomes `FormOutcome`, and the insert becomes `data.AddContactRequestAsync(new ContactSubmission(Guid.NewGuid(), name, organization, role, email, situation, message, "new", DateTime.UtcNow), ...)`. `using DigitalHub.Api.Data;` and `using Microsoft.EntityFrameworkCore;` go, because they are now unused and `DigitalHub.Api.Data` would not resolve once the file is in Forms. `using DigitalHub.Forms;` comes in. Commit 5: that `using` is removed again |
| `api/src/DigitalHub.Api/Program.cs` | 3, 5 | Commit 3: `using DigitalHub.Forms;`; `AddScoped<IFormsData, ContentFormsData>()` after the email registration; the `OnRejected` switch arm is `ContactRateLimit.PolicyName =>`; the policy is `options.AddPolicy(ContactRateLimit.PolicyName, httpContext => ContactRateLimit.Partition(httpContext, contactPermitLimit, contactWindowHours));`. `using DigitalHub.Api.Content;` stays. The `Contact:PermitLimit` and `Contact:WindowHours` reads stay where they were. Commit 5: the five registrations become `builder.Services.AddDigitalHubForms();`, with the `IFormsData` registration next to it |
| `api/src/DigitalHub.Api/Controllers/PublicContactController.cs` | 3, 4 | Commit 3: `using DigitalHub.Forms;` and `[EnableRateLimiting(ContactRateLimit.PolicyName)]`. Commit 4: `using DigitalHub.Api.Content;` is removed. The route, `BodyLimit` and body are unchanged |
| `api/src/DigitalHub.Api/Controllers/PublicApplyController.cs` | 4 | `using DigitalHub.Api.Content;` becomes `using DigitalHub.Forms;`. The route string is unchanged |
| `api/src/DigitalHub.Api/Infrastructure/ExceptionShieldMiddleware.cs` | 4 | `using DigitalHub.Api.Content;` becomes `using DigitalHub.Forms;` |
| `api/src/DigitalHub.Api/Infrastructure/RequestBodyLimit.cs` | 4 | `using DigitalHub.Api.Content;` becomes `using DigitalHub.Forms;` |
| `api/README.md` | 5 | Line 3 names `src/DigitalHub.Forms`, the contact and apply code that the API and the tests reference (ADR 0001) |

Nothing else changed. No existing test `.cs` file changed. Nothing under `studio/`,
`website/`, `.github/` or `api/src/DigitalHub.Api/Data/` changed (C6, 5.2 step 1).
The Web SDK fallback (plan 10.1) was **not** used: its trigger never happened, because
`DigitalHub.Forms.dll` built and loaded locally under Application Control (2.1, C3).

### 2.4 Logger categories (condition 6, plan 3.4 point 6)

The two logging types moved, so `ILogger<T>` now names them as:

- `DigitalHub.Forms.ApplicationIntake` (was `DigitalHub.Api.Content.ApplicationIntake`)
- `DigitalHub.Forms.SmtpEmailSender` (was `DigitalHub.Api.Content.SmtpEmailSender`)

The message text, the levels and the points where they log are unchanged. ISO-2 and
Phase D should use these names in any level override or log query.

## 3. Evidence

All .NET commands ran in Release from `D:\work\DigitalHub\dh-platform-claude-iso-1\api`,
with `dotnet --version` 10.0.401. The tests connect through `ApiFactory`, which rewrites
the configured connection to `DigitalHubContent_Test` and requires the restricted
login. No other test host was running (`tasklist` showed no `testhost` or `vstest`).
No migration was created or applied. Nothing wrote to `DigitalHubContent` (condition 7).
No port was opened: the integration tests use the in-memory TestServer, apart from the
loopback Kestrel tests that pick their own ports.

### 3.1 Red at commit 1: route (c) ran (conditions 1 to 3)

Run at `d998a51`, with only `FormsLibraryTests.cs` added on the base:

```
$ dotnet build DigitalHub.slnx -c Release
    13 Warning(s)
    0 Error(s)
EXIT=0
$ dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"
  Failed DigitalHub.Api.Tests.FormsLibraryTests.The_forms_library_references_no_admin_api_identity_or_token_code [118 ms]
  Error Message:
   Assert.DoesNotContain() Failure: Item found in collection
Collection: [···, "System.Net.Mail", "Microsoft.AspNetCore.Hosting.Abstractions", "DigitalHub.Images", "System.Security.Claims", "Microsoft.IdentityModel.Tokens", ···]
Found:      "DigitalHub.Images"
  Failed DigitalHub.Api.Tests.FormsLibraryTests.Contact_and_apply_code_lives_in_the_forms_library [1 ms]
  Error Message:
   Assert.Equal() Failure: Strings differ
Expected: "DigitalHub.Forms"
Actual:   "DigitalHub.Api"
Failed!  - Failed:     2, Passed:     0, Skipped:     0, Total:     2, Duration: 143 ms - DigitalHub.Api.Tests.dll (net10.0)
EXIT=1
```

Both tests fail for the reasons plan 5.1 gives. Test 1 fails because the assembly is
`DigitalHub.Api`. Test 2 fails on the first forbidden reference it finds,
`DigitalHub.Images`, and the collection also shows `Microsoft.IdentityModel.Tokens`.
This matches the static reading, so condition 3 does not trigger, and route (b) was
not needed.

The same filter, run again:

- After commit 2 (`531441f`): `Failed: 2, Passed: 0`, exit 1.
- At commit 3 (`ad9de04`), together with the form suites: `Failed: 2, Passed: 48, Total: 50`, exit 1. Only the two `FormsLibraryTests` failed.
- After commit 4 (`4dda548`): `Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2`, exit 0.

### 3.2 Checks after the change (plan 5.3)

| # | Command | Result |
|---|---|---|
| C1 | `dotnet build DigitalHub.slnx -c Release` | **Pass.** Base (`d998a51`, the base plus a test file): `13 Warning(s)`, `0 Error(s)`, exit 0. Commit 5 code: `13 Warning(s)`, `0 Error(s)`, exit 0. All 13 are CS8601 and CS8604 in `api/tools/DigitalHub.ContentImport/ContentWriter.cs`, the same as CI run `44506830145`. `grep warning` with ContentImport filtered out finds none, so there are none in `DigitalHub.Forms`. The PR head's `api` job "Build (Release)" line is **NOT RUN** (nothing pushed); the tester quotes it from the PR head run |
| C2 | `dotnet test ... --no-build --filter "FullyQualifiedName~FormsLibraryTests"` | **Pass.** `Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2, Duration: 19 ms`, exit 0 |
| C3 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=..." --results-directory <scratch>` | **Pass on the second run.** I report the first run's failure before the fix, below. Second run: `Passed!  - Failed: 0, Passed: 578, Skipped: 0, Total: 578, Duration: 1 m 27 s`, exit 0; trx `<Counters total="578" executed="578" passed="578" failed="0" error="0" ...>` |
| C4 | `dotnet test ... --filter "FullyQualifiedName~CareersTests\|FullyQualifiedName~ApplyDedupeTests\|FullyQualifiedName~PublicContact\|FullyQualifiedName~RequestBodyLimitTests\|FullyQualifiedName~RateLimitLogTests\|FullyQualifiedName~AbortedRequestTests"` | **Pass.** `Passed!  - Failed: 0, Passed: 48, Skipped: 0, Total: 48, Duration: 16 s`, exit 0 |
| C5 | `has-pending-model-changes` with the C5 connection string, `--configuration Release --no-build` | **Pass.** `No changes have been made to the model since the last migration.`, exit 0. See the note below on how the tool was started |
| C6 | `git diff --stat cdef7c9..HEAD -- api/src/DigitalHub.Api/Data` | **Pass.** Empty, exit 0 |
| C7 | `git show -M --format= 4dda548` | **Pass.** The seven files show as `rename from api/src/DigitalHub.Api/Content/<f>.cs` / `rename to api/src/DigitalHub.Forms/<f>.cs`, with similarity 96-99%. Each file's only changed lines are `-namespace DigitalHub.Api.Content;` / `+namespace DigitalHub.Forms;`. The consumers change only their `using` lines: `PublicApplyController.cs`, `ExceptionShieldMiddleware.cs` and `RequestBodyLimit.cs` go from `-using DigitalHub.Api.Content;` to `+using DigitalHub.Forms;`, and `PublicContactController.cs` drops `-using DigitalHub.Api.Content;`. The test csproj adds `+    <Using Include="DigitalHub.Forms" />`. Count code: I extracted the lines that `ad9de04` deletes from `IncrementAsync` to `CountFailed`, and the same span of `531441f:api/src/DigitalHub.Forms/ApplicationCountSql.cs`, then ran `diff` on them. The only differences are the two signatures (`private async Task IncrementAsync(Guid? vacancyId, ...)` vs `public static async Task IncrementAsync(DatabaseFacade database, Guid? vacancyId, ...)`; `private static bool CountFailed` vs `public static bool CountFailed`) and `db.Database.` vs `database.` on the two lines that use it. The MERGE text, the parameters, the retry and the filter are identical |
| C8 | `grep -rn "DigitalHub\.Api\|DbSet<" api/src/DigitalHub.Forms --include=*.cs --include=*.csproj`; `git ls-files api/src/DigitalHub.Forms`; `grep -rn '"public-contact"' api/src` | **Pass.** First: no output, exit 1. The same grep over the whole folder, `bin/` and `obj/` included, also matches nothing. Second, at commit 5: `ApplicationCountSql.cs`, `ApplicationIntake.cs`, `ApplyDedupe.cs`, `ApplyPage.cs`, `ApplyThrottle.cs`, `ContactRateLimit.cs`, `CvFile.cs`, `DigitalHub.Forms.csproj`, `EmailSender.cs`, `FormOutcome.cs`, `FormsServiceCollectionExtensions.cs`, `IFormsData.cs`, `PublicContactStore.cs`, which is twelve `.cs` files and the csproj. Third: exactly one match, `api/src/DigitalHub.Forms/ContactRateLimit.cs:8:    public const string PolicyName = "public-contact";` |
| C9 | `dotnet list DigitalHub.slnx package --vulnerable --include-transitive` | **Pass.** "has no vulnerable packages given the current sources" for `DigitalHub.Api`, `DigitalHub.Forms`, `DigitalHub.Api.Tests` and `DigitalHub.ContentImport`, exit 0 |
| C10 | `dotnet list src/DigitalHub.Forms/DigitalHub.Forms.csproj package --include-transitive` | **Pass, with a note.** Top level: `Microsoft.EntityFrameworkCore.SqlServer 10.0.12 10.0.12` and `System.Security.Cryptography.Pkcs 9.0.21 9.0.21`. No ASP.NET Core Identity package (`Microsoft.AspNetCore.Identity.*`, `Microsoft.Extensions.Identity.*`) and no `Microsoft.AspNetCore.Authentication.JwtBearer`. The note follows the table |
| C11 | `cd ../website && npx vitest run test/no-hiring-system.test.ts` | **Pass.** `Test Files  1 passed (1)`, `Tests  2 passed (2)`, exit 0 |
| C12 | `cd ../website && npm test` | **Pass.** `Test Files  24 passed (24)`, `Tests  461 passed \| 1 skipped (462)`, exit 0. The known `screenshot-parity-browser` port clash did not recur. The output was filtered to failing lines and the totals, so I cannot name the one skipped test. ISO-1 changes no `website/` file, so that skip is not from this change. CI job `website` is the authority on the PR head |
| C13 | `cd ../studio && npx playwright test` | **NOT RUN.** Not attempted locally. The plan expects it to fail at the harness's "Release migrations" stage (plan 2.7, `studio/e2e/start-api.ts:46-53`, ADM-05 test report). A run would also mean resetting `DigitalHubContent_E2e` with the elevated account. Covered by CI job `studio`, step "End-to-end suite", on the PR head, and by plan 5.2 step 3 (34 names, `diff` empty) |
| C14 | `gh pr view 68/69/70 --json files --jq '.files[].path'`, compared with `comm -12` against this change's file list | **Pass.** No shared path for #68, #69 or #70. Open PRs after `git fetch`: #70 `change/ADM-12`, #69 `change/GAP-11`, #68 `change/GAP-09`, #60 `diag/redirects-e2e` |

**C3, the first run's failure, reported before the fix.** The first full run, on the
same code, gave
`Failed!  - Failed: 2, Passed: 576, Skipped: 0, Total: 578`, exit 1. The failing tests
were `ApiAcceptedContentTests.Content_the_api_accepted_passes_the_website_checks` and
`ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file`, both with
`Error Message: Run npm ci in website/ first.` (`ApiAcceptedContentTests.cs:172`).
These tests shell out to the website's checks. This fresh worktree had no
`website/node_modules`, and CI runs `npm ci` before the `api` job's tests. The fix was
`cd website && npm ci --no-audit --no-fund` (`added 106 packages`, exit 0, lockfile
unchanged, `git status` clean under `website/`). No code or test was changed. Then the
whole suite was run again, unchanged, and gave 578 of 578.

**C3, names compared with the base list (plan 5.2 step 2, local part).** From the
second run's trx:

```
$ grep -c 'testName=' iso1-run2.trx
578
$ grep -o 'testName="DigitalHub.Api.Tests.FormsLibraryTests[^"]*"' iso1.trx
testName="DigitalHub.Api.Tests.FormsLibraryTests.The_forms_library_references_no_admin_api_identity_or_token_code"
testName="DigitalHub.Api.Tests.FormsLibraryTests.Contact_and_apply_code_lives_in_the_forms_library"
$ grep -o 'testName="[^"]*"' iso1-run2.trx | grep -v FormsLibraryTests | LC_ALL=C sort | sha256sum
3034a709d4df3caaf2d0d95edb6e60b20965d28e35e7a995e81ad2d75a3b7a94 *-
```

That hash is the base list's sha256 from CI run `44506830145` (plan 2.6). So the 576
other results carry exactly the base names, with the same duplicates, and all 576
passed. The two extra results are the two `FormsLibraryTests`.

**C5, how the tool was started.** `dotnet tool restore` printed
`Tool 'dotnet-ef' (version '10.0.12') was restored` and `Restore was successful`, and
`dotnet tool list` shows `dotnet-ef 10.0.12` from `api/.config/dotnet-tools.json`. Even
so, `dotnet tool run dotnet-ef -- ...` and `dotnet dotnet-ef --version` both printed
`Run "dotnet tool restore" to make the "dotnet-ef" command available.`, exit 1. This
looks like a local tool-resolution problem on this machine. `api/` holds two manifests,
`.config/dotnet-tools.json` and `dotnet-tools.json`, with the same content; I did not
change either. So I ran the restored package's own entry point, the same version
10.0.12:
`dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build`.
It printed `No changes have been made to the model since the last migration.`, exit 0.
CI runs it the planned way: the `api` job's "Restore tools (dotnet-ef)" step, then
`dotnet tool run dotnet-ef`.

**C10, the note.** Through `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.Data.SqlClient`
6.1.6 brings in, transitively, `Azure.Identity`, `Microsoft.Identity.Client*`,
`Microsoft.IdentityModel.*` (with `.Tokens`) and `System.IdentityModel.Tokens.Jwt`
7.7.1. They are there for SqlClient's Entra ID sign-in. `dotnet nuget why` shows the
chain: `Microsoft.EntityFrameworkCore.SqlServer (v10.0.12)` to
`Microsoft.Data.SqlClient (v6.1.6)` to `System.IdentityModel.Tokens.Jwt (v7.7.1)` (also
via `Microsoft.IdentityModel.Protocols.OpenIdConnect`), and to `Azure.Identity (v1.17.1)`.
They are not ASP.NET Core Identity or JwtBearer. The API already has the same SqlClient
tree on the base. The Forms code does not use them, so the compiled
`DigitalHub.Forms.dll` does not reference them: the
`The_forms_library_references_no_admin_api_identity_or_token_code` test passes, and
its forbidden list includes `Microsoft.IdentityModel.Tokens` and
`System.IdentityModel.Tokens.Jwt`. This follows from plan 3.4 point 4 (Forms references
EF Core SqlServer for the count MERGE), which the plan and gate 1 accepted. I raise it
so the tester and the tech lead can weigh C10's wording, "no Identity or JwtBearer
package", against the package tree. I did not change the design.

### 3.3 "Unchanged", plan 5.2

| Step | Result |
|---|---|
| 1. `git diff --stat cdef7c9..HEAD -- api/tests studio website` | **Pass.** It lists only `api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` (2 lines added) and `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs` (new). `git diff cdef7c9..HEAD -- api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` shows only `+    <Using Include="DigitalHub.Forms" />` and `+    <ProjectReference Include="..\..\src\DigitalHub.Forms\DigitalHub.Forms.csproj" />` |
| 2. Integration names against the PR head's `api-test-report` | **NOT RUN against CI.** Nothing is pushed, so there is no PR head run. The local trx shows the same result (3.2, C3: base hash `3034a709…7a94` plus the two new names, 578 passed). The authority is CI job `api` on the PR head (artifact `api-test-report`); the tester runs the plan's `comm -23` / `comm -13` / `Counters` commands on it |
| 3. End-to-end names against the PR head's `studio-e2e-report` | **NOT RUN.** There is no local end-to-end run (C13) and no PR head run. Covered by CI job `studio`, step "End-to-end suite" (artifact `studio-e2e-report`, `reports/studio/e2e-junit.xml`), with the plan's `diff`, which must be empty, and `tests="34" failures="0"` |

The CI on the PR (CI `api`, `website`, `studio`, `section-compare`, `website-browser`;
Security gitleaks, Semgrep, `dotnet-vulnerable`, npm audit; Workflow lint) is **NOT RUN**,
because nothing is pushed until the owner confirms. It is pending on the PR head run.

### 3.4 Track checklist (G2, plan 5.4)

| Line | Status |
|---|---|
| Follow ADR 0001 | Done. Point 2: the library is `DigitalHub.Forms`; it holds the contact and apply validation, `ApplicationIntake`, the throttles, the dedupe and the email sender; the API and the tests reference it |
| ISO-1 changes no behaviour: all base integration and end-to-end tests pass unchanged | Integration: 576 base names, all passing locally (C3). End-to-end: pending CI `studio` (C13, 5.2 step 3) |
| Public API answers only the two form routes | N/A until ISO-2 |
| `dh_public_forms` login | N/A until ISO-3 |
| ISO-4 after ISO-5 | N/A |

## 4. Migrations

None. No entity, `ContentDbContext`, model builder or migration file changed (C5, C6).
Nothing was applied to any database.

## 5. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| Contact validation (`PublicContactStore`, `PublicContactRequest`) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Done | Commit 4 rename (C7); `Contact_and_apply_code_lives_in_the_forms_library` passes (C2, C3) |
| Apply validation and `ApplicationIntake` are in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Done | Commit 3 (port), commit 4 (rename), C7; the same test passes |
| Throttles (`ApplyThrottle` and the contact rate-limit partition `ContactRateLimit`) are in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Done | `ApplyThrottle`: `FormsLibraryTests` (C2). `ContactRateLimit`: C8 `git ls-files` lists `ContactRateLimit.cs`, and the `"public-contact"` grep matches only `ContactRateLimit.cs:8`; `RateLimitLogTests` passes (C4) |
| Dedupe (`ApplyDedupe`) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Done | `FormsLibraryTests` (C2); `ApplyDedupeTests` passes (C4) |
| Email sender (`IEmailSender`, `SmtpEmailSender`, `EmailMessage`, `EmailAttachment`, `EmailDeliveryException`) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Done | `FormsLibraryTests` (C2); CareersTests pass (C4) |
| CV checks and the apply page (`CvFile`, `ApplyPage`) are in `DigitalHub.Forms` | ADR 0001 points 1 and 2 | Done | `FormsLibraryTests` (C2); `RequestBodyLimitTests` and `AbortedRequestTests` pass (C4) |
| The library references no admin API, Identity or JWT code | ADR 0001 points 1 and 2 | Done | `The_forms_library_references_no_admin_api_identity_or_token_code` red at `d998a51` (3.1) and green from `4dda548` (C2); C8 grep empty; C10 (with the transitive SqlClient note) |
| The tests reference the library | ADR 0001 point 2 | Done | Test csproj `ProjectReference` (commit 2) and `<Using Include="DigitalHub.Forms" />` (commit 4); 5.2 step 1 |
| All base integration tests (576, by name) pass unchanged | Refinement plan line 212 ("208"); README G2 checklist | Done locally; CI pending | C3: 578 of 578 passed; the 576 non-new names hash to the base `3034a709…7a94`. The CI `api` trx on the PR head is pending (NOT RUN, nothing pushed) |
| All base end-to-end tests (34, by name) pass unchanged | Refinement plan line 212 ("22"); README G2 checklist | Pending CI (NOT RUN locally) | C13 NOT RUN, with the reason. CI job `studio`, "End-to-end suite", on the PR head; plan 5.2 step 3 |
| No existing test source file is edited | Owner's request "no behaviour change"; caller's instruction | Done | 5.2 step 1 (3.3) |
| No migration and no model change | `AGENTS.md` Schema; plan section 7 | Done | C5 exit 0, "No changes have been made to the model"; C6 empty |
| No route, login or host change | Refinement plan ISO-2 to ISO-5 are separate | Done | The controllers keep their routes, `[AllowAnonymous]`, limits and policy name (C7 diff: `using` lines only, plus `ContactRateLimit.PolicyName` with the same value); C11 passes (`PublicApplyController.cs` route still found); no configuration key changed |
| GAP-38, part (code moved; own API and login still to come) | Refinement plan line 114 | Done for ISO-1; GAP-38 stays open | This change; ISO-2 and ISO-3 remain |

## 6. Rework rounds

None. This is the first implementation round.

## 7. For the tester

- Red evidence came from route (c): a local run at `d998a51` (3.1). You can repeat it
  on a detached checkout of `d998a51` with the same two commands.
- `ApiAcceptedContentTests` needs `npm ci` in `website/` before `dotnet test`, or it
  fails with "Run npm ci in website/ first." That is how the first local run failed
  (3.2, C3).
- `dotnet tool run dotnet-ef` failed to resolve locally after a successful restore
  (3.2, C5). The direct-dll route above works.
- C10's transitive identity-named packages come from SqlClient (3.2, C10 note).

Status: READY FOR TEST
