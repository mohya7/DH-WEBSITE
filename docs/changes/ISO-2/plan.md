# ISO-2: A public forms API with only the contact and apply routes

- Change id: ISO-2. Branch: `change/ISO-2`, cut from `origin/rebuild/dotnet-platform`
  at `522b17549736851f9f8848b1bdaadd14229b6557` (ISO-1 merged, #71). Worktree:
  `D:\work\DigitalHub\dh-platform-claude-iso-2`. All work happens there, never in
  `dh-platform` or `DH-WEBSITE-main`.
- Author: architect. Round 1 written. Revised in round 2 after plan review round 1
  (`docs/changes/ISO-2/plan-review.md`, Round 1, `Verdict: CHANGES NEEDED`); section 12
  answers R1-1 to R1-8.
- Sources read, all present: `docs/changes/README.md`, `AGENTS.md` and `CLAUDE.md`,
  `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
  `docs/quality/refinement-plan-2026-10-28.md` (Track G2, lines 206-217),
  `docs/adr/0001-split-public-forms-api.md`, and every ISO-1 record in
  `docs/changes/ISO-1/` (`plan.md`, `plan-review.md`, `plan-approval.md`,
  `implementation.md`, `test-report.md`, `delivery-approval.md`). In round 2, also
  `docs/changes/ISO-2/plan-review.md`. There is still no `plan-approval.md` or
  `implementation.md` for ISO-2.

## 1. Item

- **Closes:** ISO-2 of Track **G2, isolation** (ADR 0001, points 1 and 4). It closes
  **part of GAP-38**. GAP-38 stays open until ISO-3 adds the `dh_public_forms` login.
- **Carries:** finding F1 from ISO-1. The ruling is in
  `docs/changes/ISO-1/delivery-approval.md`, "F1: decision", and the finding in
  `docs/changes/ISO-1/test-report.md`, section 7, F1. Section 3.6 below answers the
  three points that ruling says ISO-2's gate 1 will require.
- **Owner's request, as given (19 November 2026):** "ISO-2 new DigitalHub.PublicApi
  with only POST /api/v1/public/contact and /apply, its own small DbContext over four
  tables, no Identity, no signing key. Refinement plan Track G2, ISO-2, closes part of
  GAP-38; ADR 0001 (accepted 19 November 2026, owner's words: "accepted"). Done when its
  own integration suite passes against DigitalHubContent_Test and a test proves every
  other path returns 404. Also carries ISO-1 gate 2's F1 hand-off: widen the
  forms-library guard's forbidden list to cover Microsoft.AspNetCore.Identity and
  Microsoft.AspNetCore.Authentication*, add a canary proving the guard can fail, and
  apply the guard to DigitalHub.PublicApi."
- **Owner's go-ahead (19 November 2026):** "start iso 2".
- **"Done when"**, quoted from `docs/quality/refinement-plan-2026-10-28.md`, line 213:
  > Its own integration suite passes against `DigitalHubContent_Test`; a test proves every other path returns 404
- **ADR 0001, point 1**, quoted:
  > **New project `DigitalHub.PublicApi`** in `api/src/`, its own process and IIS site,
  > reached only through the website's domain at `/api/v1/public/`. It holds exactly two
  > routes, `POST /api/v1/public/contact` and `POST /api/v1/public/apply`, with their
  > rate limits, body limits, CV checks and email sending. It has no authentication, no
  > Identity, no JWT signing key, no refresh cookie and no Studio controllers. Its
  > fallback policy denies everything else.
- **ADR 0001, point 4**, quoted:
  > **A small DbContext for the public API** that maps only those four tables, so its
  > code cannot reach anything else even before the login refuses it.
- **The four tables** (ADR 0001, point 3): `contact_requests`, `application_counts`,
  `vacancies`, `site_settings`.

**Boundaries kept** (refinement plan lines 214-216, and the request):

| Item | Where it goes |
|---|---|
| The `dh_public_forms` login and its grants (a migration) | ISO-3 |
| The admin API drops `/api/v1/public/*`; `AllowedHosts` set to the Studio host | ISO-4 (merged after ISO-5) |
| The website's `web.config` proxies `/api/v1/public/*` to the public API | ISO-5 |
| Allow-list and exposure test | ISO-6, Phase D |

## 2. Current state

### 2.1 The base

```
$ git rev-parse origin/rebuild/dotnet-platform      (after git fetch)
522b17549736851f9f8848b1bdaadd14229b6557
$ git log --oneline -3
522b175 ISO-1: Move the contact and apply code into a DigitalHub.Forms library (#71)
71b7541 GAP-11: Give third-party scripts an integrity hash (#69)
cdef7c9 ADR 0001: Record the owner's acceptance (#67)
```

`dotnet --version` prints `10.0.401`. It is the only SDK installed
(`dotnet --list-sdks`: `10.0.401 [C:\Program Files\dotnet\sdk]`).

### 2.2 Where the forms are served today

There is one process, `DigitalHub.Api`, and it serves both forms.

- `api/src/DigitalHub.Api/Controllers/PublicContactController.cs:9-23`. It has
  `[ApiController]`, `[AllowAnonymous]` and `[Route("api/v1/public/contact")]`.
  `[HttpPost]` carries `[EnableRateLimiting(ContactRateLimit.PolicyName)]` and
  `[RequestBodyLimit(BodyLimit)]`, where `BodyLimit = 16 * 1024`. It calls
  `PublicContactStore.SubmitAsync`. The result is a `ValidationProblemDetails` with
  `code`, or `ProblemResults.Create`.
- `api/src/DigitalHub.Api/Controllers/PublicApplyController.cs:9-22`. It has
  `[Route("api/v1/public/apply")]` and `[HttpPost]`. The limits are
  `[RequestBodyLimit(CvFile.BodyLimit)]`, `[RequestFormLimits(MultipartBodyLengthLimit = CvFile.BodyLimit)]`
  and `[RequestSizeLimit(CvFile.BodyLimit)]`. It calls `ApplicationIntake.SubmitAsync(Request, ip, ct)`.
- `api/src/DigitalHub.Api/Program.cs`. These are the pieces the public API needs, or
  must not have:
  - Lines 45-59: start-up refuses a missing `Auth:SigningKey`,
    `Auth:InitialAdminPassword` or `Auth:InitialAdminEmail`.
  - Lines 61-70: `ContentDbContext` and `AddIdentityCore`.
  - Lines 79-80: `AddDigitalHubForms()` and `AddScoped<IFormsData, ContentFormsData>()`.
  - Lines 85-108: forwarded headers are trusted only for configured `KnownProxies`.
  - Lines 117-164: the rate limiter. `OnRejected` calls `RateLimitLog.Refused`, then
    writes a 429 problem whose title is `"Too many contact submissions."` for
    `ContactRateLimit.PolicyName`.
  - Lines 166-203: `UnhandledExceptionHandler`, `AddProblemDetails` and
    `AddControllers`. The `InvalidModelStateResponseFactory` answers apply with the
    HTML page and everything else with a `validation_failed` problem.
  - Lines 205-253: JWT bearer authentication, and a fallback policy that requires an
    authenticated user with a role.
  - Lines 260-273: the pipeline, in this order: forwarded headers, `CorrelationIdMiddleware`,
    `SecurityHeadersMiddleware`, `UseExceptionHandler`, Serilog request logging,
    `ExceptionShieldMiddleware`, `RequestBodyLimitMiddleware`,
    `DuplicateJsonFieldGuardMiddleware`, `UseAuthentication`, `UseRateLimiter`.
  - Lines 298-319: `/health`.
- `api/src/DigitalHub.Api/appsettings.json`: `"AllowedHosts": "*"`. It also holds the
  `Contact`, `Apply`, `Email`, `ForwardedHeaders` and `Security` sections.

The infrastructure the two form routes depend on is all in
`api/src/DigitalHub.Api/Infrastructure/`, in the namespace `DigitalHub.Api.Infrastructure`:

| File | Lines | Used by the forms because |
|---|---|---|
| `ProblemResults.cs` | 36 | Every problem body |
| `CorrelationIdMiddleware.cs` | 48 | `X-Correlation-ID` (A-6, A-13) |
| `SecurityHeadersMiddleware.cs` | 30 | `nosniff`, `Referrer-Policy`, `X-Frame-Options`, optional HSTS |
| `UnhandledExceptionHandler.cs` | 28 | A safe 500 body |
| `ExceptionShieldMiddleware.cs` | 90 | 499 for aborted requests; Kestrel's 400 and 413; the apply HTML page (`ApplyPage.IsApply`) |
| `RequestBodyLimit.cs` | 100 | `RequestBodyLimitAttribute`, and the middleware that enforces it before the body is read |
| `RateLimitLog.cs` | 44 | The Warning when a request is refused, with category `"DigitalHub.Api.RateLimit"` (line 145) |
| `SensitiveDestructuringPolicy.cs` | 64 | Serilog redaction |

`DuplicateJsonFieldGuard.cs` and `UtcDateTimeJsonConverter.cs` are not used by the
forms. `grep -rn RejectDuplicateJsonFields api/src` finds only the auth and user
actions (`AuthController.cs:24,74`, `AdminControllers.cs:85`, `UserAccessController.cs:22`).
The contact response is `{ ok = true }`, with no dates.

### 2.3 The seams ISO-1 built for reuse

- `api/src/DigitalHub.Forms/IFormsData.cs`. Its four members are the four tables:
  `AddContactRequestAsync(ContactSubmission)`, `FindVacancyAsync(Guid)` returning
  `FormsVacancy(Id, Title, Published)`, `MailboxesAsync()` returning
  `FormsMailboxes(CareersEmail, Email)`, and
  `IncrementApplicationCountAsync(Guid?, DateOnly)`. The doc comment says: "ISO-2's
  public API over its own."
- `api/src/DigitalHub.Forms/FormsServiceCollectionExtensions.cs`, `AddDigitalHubForms()`.
  It registers `PublicContactStore` and `ApplicationIntake` as scoped, and
  `ApplyThrottle`, `ApplyDedupe` and `IEmailSender` → `SmtpEmailSender` as singletons.
  The host must add `IFormsData` and a `TimeProvider`.
- `api/src/DigitalHub.Forms/ApplicationCountSql.cs`, `IncrementAsync(DatabaseFacade, ...)`.
  This is the count `MERGE` with `HOLDLOCK`, a serializable transaction and one retry.
  Its comment says the admin API and ISO-2's public API run the same code.
- `api/src/DigitalHub.Forms/ContactRateLimit.cs`. It holds `PolicyName = "public-contact"`
  and `Partition(httpContext, permitLimit, windowHours)`.
- `api/src/DigitalHub.Api/Content/ContentFormsData.cs`. This is the admin side of the
  port, and the reference behaviour:
  - The vacancy is read with `AsNoTracking().FirstOrDefaultAsync(item => item.Id == id)`,
    and `Published` is `Status == ContentStatus.Published`.
  - The settings row is read with `OrderBy(item => item.Id).FirstOrDefaultAsync()`.
  - The contact request is written with `Add` plus `SaveChangesAsync`.
  - The count runs through `ApplicationCountSql.IncrementAsync(db.Database, ...)`.
- Configuration keys the library reads: `Apply:WindowHours`, `Apply:IpPermitLimit`,
  `Apply:EmailPermitLimit` (`ApplyThrottle.cs:16-18`), and `Email:Host`, `Email:From`,
  `Email:Port`, `Email:User`, `Email:Password`, `Email:TimeoutSeconds`
  (`EmailSender.cs:20-59`). The host reads `Contact:PermitLimit` and `Contact:WindowHours`.

### 2.4 The four tables as the admin model maps them

From `api/src/DigitalHub.Api/Data/ContentModelBuilder.cs` and `ContentEntities.cs`:

- **`contact_requests`** (lines 178-191). Columns: `id`, `name` (200), `organization`
  (200), `role` (160, null), `email` (320), `situation` (40), `message`, `status` (16;
  check `status IN ('new', 'handled')`), `handled_by_id` (450, null, foreign key to
  users), `handled_at` (null), `created_at`. The key is `Id`, generated by the client.
- **`vacancies`** (`ConfigureRecord<Vacancy>`, lines 213-235). `status` is stored as a
  lower-case string. The conversion is
  `status.ToString().ToLowerInvariant()` / `Enum.Parse<ContentStatus>(value, ignoreCase: true)`,
  with check `status IN ('draft', 'published', 'ended')`. The snapshot
  (`Migrations/ContentDbContextModelSnapshot.cs`) shows these NOT NULL columns:
  `about_role`, `department`, `employment_type`, `featured`, `interview_stages`,
  `key_responsibilities`, `location`, `nice_to_have`, `no_index`, `required_skills`,
  `role_offers`, `slug`, `sort_order`, `status`, `summary`, `title`, `created_at`,
  `updated_at` and `version`. A test fixture that inserts a vacancy must supply all of
  them.
- **`site_settings`** (lines 131-140). Columns used: `id`, `email`, `careers_email`.
  `version` is a concurrency token.
- **`application_counts`** (lines 193-210). Columns: `id`, `vacancy_id` (null, cascade),
  `applied_on` (`date`), `count`. Two filtered unique indexes.

### 2.5 Tests that cover the forms today (all in `DigitalHub.Api.Tests`)

| File | Form tests | Setup it uses that the public suite cannot |
|---|---|---|
| `CareersTests.cs` (835 lines) | 13 apply tests, lines 41-387, from `An_application_emails_the_cv_and_counts_once` to `Concurrent_applications_each_count`. `RecordingApplyFactory`, `ApplyLimitedFactory`, `SilentSmtpFactory` (fixed port **4318**, line 287 and line 765) and `ClockedApplyFactory` are at lines 710-779 | Vacancies are created and published through the admin API (`/api/v1/vacancies`, lines 608-620). Settings and counts go through `ContentDbContext` (lines 587-630). The trigger test uses `ApiFactory.ElevatedTestConnectionString()` (line 246) |
| `PublicContactTests.cs` (291 lines) | 7 contact tests, plus `PublicContactEmptyProxyTests`. `New_count_returns_only_new_enquiries_for_studio` (line 133) is a Studio route | It reads rows through `ContentDbContext` (lines 37-40) |
| `RequestBodyLimitTests.cs` | `The_reviews_20_MB_contact_body_is_refused_and_nothing_is_stored` (theory ×2, line 86) and `A_full_contact_form_under_16_KB_is_accepted` (line 107) | — |
| `RateLimitLogTests.cs` | `A_refused_contact_submission_logs_a_warning_without_the_message` (line 43) and `The_network_drops_the_host_part` (theory ×3, line 70) | — |
| `AbortedRequestTests.cs` | The `"/api/v1/public/contact", 0` rows of both theories (lines 25 and 52) | — |
| `ServerHeaderTests.cs` | Kestrel on `IPAddress.Loopback, 0` (line 119), no `Server` header | — |

`ApiFactory` (`api/tests/DigitalHub.Api.Tests/ApiFactory.cs`) is
`WebApplicationFactory<Program>` (line 16). The things the public suite needs from it:

- It reads configuration from the API's user-secrets id and from environment variables
  (lines 123-127).
- It rewrites the catalog to `DigitalHubContent_Test` and refuses anything else
  (lines 134-150).
- It refuses a connection that is not the restricted SQL login (lines 188-206).
- The user-secrets id is the C# literal `SecretsId` (line 21). Gitleaks flags that
  literal: `.github/security/known-findings.json` lists it as a known
  `generic-api-key` false positive with the fingerprint
  `...:api/tests/DigitalHub.Api.Tests/ApiFactory.cs:generic-api-key:17`.
  `<UserSecretsId>` in `DigitalHub.Api.csproj` is not on that list.

### 2.6 The forms-library guard (F1)

`api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs:28-38` holds the exact-match list
`DigitalHub.Api`, `DigitalHub.Images`, `Microsoft.AspNetCore.Authentication.JwtBearer`,
`Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `Microsoft.Extensions.Identity.Core`,
`Microsoft.Extensions.Identity.Stores`, `Microsoft.IdentityModel.Tokens` and
`System.IdentityModel.Tokens.Jwt`. Lines 47-57 assert that none of these is in
`typeof(ApplicationIntake).Assembly.GetReferencedAssemblies()`.

The F1 reproduction (test report, section 6) added one type that calls
`services.AddAuthentication(IdentityConstants.BearerScheme).AddBearerToken().AddCookie()`.
The dll then referenced `Microsoft.AspNetCore.Identity`,
`Microsoft.AspNetCore.Authentication`, `...Authentication.BearerToken` and
`...Authentication.Cookies`. None of them is on the list, so the guard stays green.

**The compiled references of `DigitalHub.Forms.dll` today.** I read them from the
ISO-1 Release build. `git diff --stat 9e43767 522b175 -- api/src/DigitalHub.Forms` is
empty, so that build matches the base. The command was
`powershell -File refs.ps1 ...\DigitalHub.Forms.dll`, with
`[Reflection.Assembly]::ReflectionOnlyLoadFrom($args[0]).GetReferencedAssemblies()`:

```
Microsoft.AspNetCore.Http.Abstractions        Microsoft.Extensions.Primitives
Microsoft.AspNetCore.Http.Features            System.Collections
Microsoft.AspNetCore.Http.Results             System.Collections.Concurrent
Microsoft.Data.SqlClient                      System.Data.Common
Microsoft.EntityFrameworkCore                 System.Linq
Microsoft.EntityFrameworkCore.Relational      System.Memory
Microsoft.Extensions.Configuration.Abstractions  System.Net.Mail
Microsoft.Extensions.Configuration.Binder     System.Net.Primitives
Microsoft.Extensions.DependencyInjection.Abstractions  System.Runtime
Microsoft.Extensions.Logging.Abstractions     System.Security.Cryptography
                                              System.Text.RegularExpressions
                                              System.Threading
                                              System.Threading.RateLimiting
```

That is 23 names. None starts with `Microsoft.AspNetCore.Authentication`,
`Microsoft.AspNetCore.Identity`, `Microsoft.Extensions.Identity` or
`Microsoft.IdentityModel`, and none is `DigitalHub.Api`, `DigitalHub.Images` or
`System.IdentityModel.Tokens.Jwt`. So the widened rule in section 3.6 passes on the
base references.

### 2.7 A website test that scans every file under `api/`

`website/test/no-hiring-system.test.ts`:

- Line 35: `roots = ['website', 'studio', 'api', '.github/workflows/ci.yml']`.
- Lines 39-60: `dbSetAllow` holds the only entity names that may follow `DbSet<`.
  These include `Vacancy`, `SiteSettings`, `ContactRequest` and `ApplicationCount`.
- Lines 18-26: needles such as `class Candidate` and `cv_blob`.

So any new `DbSet<X>` under `api/` with an `X` outside that set fails this test. The
public API's entity classes must use the allowed names (section 3.3).

**What it does not cover.** The column- and table-name rule (`names()` and `hiringName`,
lines 116-129) runs only where `inModel(normalized)` is true. Lines 113-115 define that
as `api/src/DigitalHub.Api/Data/*.cs`. So a new model under
`api/src/DigitalHub.PublicApi/Data/` would get only the needle and `DbSet<` checks.
ISO-2 extends `inModel` to that folder (3.3, commit 3). That makes the guard stricter,
never weaker.

### 2.8 CI

`.github/workflows/ci.yml`, job `api` (lines 41-137). Its steps:

1. Build: `dotnet build DigitalHub.slnx -c Release` (line 80). Any project in the
   `.slnx` is built.
2. Migrations: create `DigitalHubContent_Test`, apply the migrations with `sa`, run the
   migration checks, then grant `dh_content_app` `db_datareader`, `db_datawriter` and
   `DENY UPDATE, DELETE ON dbo.audit_log` (lines 104-112).
3. `npm ci` in `website/` (line 120).
4. The tests, by explicit project path (lines 123-129):
   `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=api-tests.trx" ... --results-directory ${{ github.workspace }}/reports/api`
5. `Upload test report` (lines 131-137): `if: always()`, `actions/upload-artifact@v4`,
   name `api-test-report`, path `reports/api`.

The job env sets `ConnectionStrings__Content` (restricted login `dh_content_app`) and
`ConnectionStrings__ContentAdmin` (`sa`), both naming `DigitalHubContent`
(lines 64-65). It sets no `Auth__*` variable.

A second test project would therefore be built in CI, but **not run**, unless `ci.yml`
gains a step.

These cover the new projects through the `.slnx` with no change:

- `security.yml`, `dotnet-vulnerable`: `dotnet list DigitalHub.slnx package --vulnerable --include-transitive`
  (`.github/security/run-dotnet-audit.sh:5-6`).
- `codeql.yml`: `dotnet build api/DigitalHub.slnx -c Release` (line 60).
- Semgrep scans the tree.
- `workflow-lint.yml`: actionlint 1.7.12 on every workflow. It has been blocking since
  `ACTIONLINT_BLOCKING_FROM: "2026-11-18"`.

The studio end-to-end harness builds only the admin project:
`studio/e2e/start-api.ts:45`, `dotnet build env.apiProject`.

**Base CI run** `44526032412`: workflow CI, `headSha` `522b175`, conclusion `success`.
I downloaded its artifacts to the session scratchpad (`gh run download 44526032412 -n api-test-report`
and `-n studio-e2e-report`):

| List | Command | Lines | sha256 |
|---|---|---|---|
| Integration names | `grep -o 'testName="[^"]*"' api-tests.trx \| LC_ALL=C sort` | 578 | `060c40c8e07175cf27b54e8d97beec42c23e5233015197f1e52478557c6d497c` |
| End-to-end names | `grep -o '<testcase name="[^"]*"' reports/studio/e2e-junit.xml \| LC_ALL=C sort` | 34 | `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a` |

The run's figures:

- `api-tests.trx`: `<Counters total="578" executed="578" passed="578" failed="0" error="0" ...>`.
- `e2e-junit.xml`: `<testsuites ... tests="34" failures="0" skipped="0" errors="0" ...>`.
- "Build (Release)": `13 Warning(s)`, `0 Error(s)`.

The artifact layouts: `api-test-report` unpacks to `api-tests.trx` at its root, and
`studio-e2e-report` unpacks to `reports/studio/e2e-junit.xml`.

### 2.9 Parallel work (open PRs, after `git fetch`)

`gh pr list --state open` shows #70, #68 and #60 (draft, do not merge). #69 is
**MERGED** (it is `71b7541` on the base).

| PR | Files (`gh pr view <n> --json files`) | Overlap with ISO-2 |
|---|---|---|
| #68 GAP-09, `change/GAP-09`, OPEN | `.github/security/security.expected.yml`, `.github/security/semgrep-job.expected.yml`, **`.github/workflows/ci.yml`**, `.github/workflows/codeql.yml`, `.github/workflows/security.yml`, `docs/changes/GAP-09/*` | **Yes, `ci.yml`.** #68 pins every action by SHA, in the `api` job too. It changes `actions/setup-dotnet` to `@67a3573c... # v4.3.1` with `dotnet-version: "10.0.404"`, and `Upload test report` to `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2` (#68's diff hunk `@@ -130,7 +133,7 @@`). ISO-2 adds one step next to that hunk. See 3.8 |
| #69 GAP-11, MERGED | `website/scripts/check-output.ts`, `website/src/design/*`, `website/test/*`, `docs/changes/GAP-11/*` | None (already on the base) |
| #70 ADM-12, `change/ADM-12`, OPEN | `api/src/DigitalHub.Api/Content/MediaLibrary.cs`, `MediaUsage.cs`, `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs`, `studio/src/pages/MediaLibraryPage.tsx`, `studio/test/mediaLibrary.test.tsx`, `docs/changes/ADM-12/*` | No shared file. If #70 merges first, the base integration names change (re-baseline, 5.3 step 2) |
| #72 GAP-NEXT-UPGRADE, `change/GAP-NEXT-UPGRADE`, OPEN (seen in round 2) | `website/package.json`, `website/package-lock.json`, `docs/changes/GAP-NEXT-UPGRADE/*` | No shared file. If #72 merges first, the website figures (C15) and the `website`, `website-browser` and `section-compare` comparisons move (re-baseline, 5.3 "If the base moves") |
| #60 diag | not relevant | None |

Round 2 re-check, after `git fetch`:

- `origin/rebuild/dotnet-platform` is still `522b175`.
- `gh pr list --state open` lists #72, #70, #68 and #60.
- None of #68, #70 or #72 touches `ENGINEERING_STANDARDS.md` or
  `website/test/no-hiring-system.test.ts`. Besides `ci.yml`, these are the only files
  outside `api/` that ISO-2 now changes.

### 2.10 Local constraints carried from ISO-1

- **Release runs work locally.** ISO-1's red run and full runs used `dotnet` 10.0.401
  in Release (implementation 3.1, 3.2 C3). `DigitalHub.Forms.dll`, a new binary, loaded
  under Application Control.
- **Run `npm ci` in `website/` first.** `ApiAcceptedContentTests` fails with "Run npm
  ci in website/ first." when `website/node_modules` is missing (ISO-1 implementation,
  C3 first run).
- **`dotnet tool run dotnet-ef` fails locally** after a successful restore. The working
  route is `dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll ...`
  (ISO-1 implementation, C5). For the same reason the local end-to-end harness fails at
  "Release migrations" (`studio/e2e/start-api.ts:46-53`). CI job `studio` is the
  authority for end-to-end.
- **gitleaks is not installed locally** (ISO-1 test report, section 5). CI job
  `gitleaks-pr` is the authority.

## 3. Design

### 3.1 The new process

There are two new projects, both added to `api/DigitalHub.slnx`:

- `api/src/DigitalHub.PublicApi/`, with `Microsoft.NET.Sdk.Web` and `net10.0`.
- `api/tests/DigitalHub.PublicApi.Tests/`, the public API's own integration suite.

`DigitalHub.PublicApi.csproj`:

- Nullable and implicit usings, like `DigitalHub.Api.csproj`.
- **No `UserSecretsId`**. In Development, `WebApplication.CreateBuilder` loads user
  secrets for the application assembly's id. If the public API were given the admin
  API's id, it would load `Auth:SigningKey`. With no id, nothing is loaded. No local run
  outside the tests needs one in ISO-2.
- `ProjectReference` to `DigitalHub.Forms` only. Never to `DigitalHub.Api` or
  `DigitalHub.Images`.
- `PackageReference`s, all versions already used in the repository:
  - `Microsoft.EntityFrameworkCore.SqlServer` 10.0.12
  - `Serilog.AspNetCore` 10.0.0
  - `System.Security.Cryptography.Pkcs` 9.0.21, with the API's comment. This is the
    GHSA-846f-f764-76mx pin, the same as `DigitalHub.Api.csproj`.
- No Identity package, no `JwtBearer`, no health-checks package, and no
  `Microsoft.EntityFrameworkCore.Design` or `Tools`.

`Program.cs` (top-level statements, ending `public partial class Program;` for
`WebApplicationFactory`):

1. `builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false)`
   (GAP-12 parity).
2. Serilog, configured as in the admin API (`Program.cs:31-37`):
   `ReadFrom.Configuration`, `ReadFrom.Services` (the tests register sinks),
   `Enrich.FromLogContext`, `Destructure.With<SensitiveDestructuringPolicy>()` and the
   same console template.
3. **Fail closed at start-up (P-5):**
   - `ConnectionStrings:PublicForms` missing or blank throws
     `InvalidOperationException("ConnectionStrings:PublicForms is not configured.")`.
   - **Any key under `Auth`** throws
     `InvalidOperationException("The public forms API must not be given Auth settings (ADR 0001).")`.
     The `Auth` section holds the admin's signing key and initial admin credentials, so
     this makes "no signing key" structural. A copied admin configuration fails loudly
     instead of putting the key into the public process. The key name is
     `PublicForms`, not `Content`, so in Phase D the public site's connection string
     cannot be confused with the admin's. ISO-3 points it at `dh_public_forms`.
4. `AddDbContext<PublicFormsDbContext>(o => o.UseSqlServer(connection))` (3.3).
   Then `AddSingleton(TimeProvider.System)`, `AddDigitalHubForms()` and
   `AddScoped<IFormsData, PublicFormsData>()`.
5. Forwarded headers: the same rule as the admin API, `Program.cs:85-108`, copied
   unchanged. Only configured `ForwardedHeaders:KnownProxies` are trusted. With none,
   the middleware is not applied.
6. `AddRateLimiter`: only `ContactRateLimit.PolicyName`, from `Contact:PermitLimit`
   (default 10) and `Contact:WindowHours` (default 1). `OnRejected` is the admin's
   handler with only the contact title left: `RateLimitLog.Refused`, then a 429 problem,
   `rate_limited`, titled `"Too many contact submissions."`.
7. `AddExceptionHandler<UnhandledExceptionHandler>()`, `AddProblemDetails()`.
8. `AddControllers()`, with `ConfigureApiBehaviorOptions` and the admin's
   `InvalidModelStateResponseFactory` copied unchanged (`Program.cs:177-203`). There is
   no `ApiV1RouteConvention`, because both routes are written out in full.
9. **No** `AddAuthentication`, no authorization policy or `FallbackPolicy`, no
   `AddIdentityCore`, JWT, cookies, health checks, static files, `/media` or CORS.
   `AddControllers()` itself still registers MVC's authentication *core* services
   (`IAuthenticationService`, `IAuthenticationSchemeProvider` with no scheme) and the
   authorization services, the same as in any MVC app. That is not "no
   `AddAuthorization`": there are services, but no scheme and no policy.
10. **The pipeline as it will run.** Steps marked *implicit* are added by `WebApplication`
    itself, not by `Program.cs`. They come first, ahead of the user middleware, as the
    reviewer pointed out (R1-3):
    - *implicit* host filtering (`AllowedHosts: "*"`, a pass-through)
    - *implicit* `UseRouting`
    - *implicit* `UseAuthentication`. It is added because `IAuthenticationSchemeProvider`
      is registered, and is a pass-through with no scheme.
    - *implicit* `UseAuthorization`. It is added because the authorization services are
      registered. It is a pass-through: `FallbackPolicy` is null and no endpoint carries
      `IAuthorizeData`.
    - `UseForwardedHeaders` (only with proxies)
    - `CorrelationIdMiddleware`
    - `SecurityHeadersMiddleware`
    - `UseExceptionHandler`
    - `UseSerilogRequestLogging` (same template)
    - `ExceptionShieldMiddleware`
    - **`PublicRouteGate`** (3.2)
    - `RequestBodyLimitMiddleware`
    - `UseRateLimiter`
    - `MapControllers` (the endpoints run at the end)

    `Program.cs` does not call `UseRouting` explicitly. The admin API does not either,
    and `RequestBodyLimitMiddleware` needs the endpoint selected before it runs, which
    the implicit routing step does. T-I1 proves the three implicit auth steps are
    pass-throughs: no scheme, no handler, a null `FallbackPolicy`, and no endpoint with
    `IAuthorizeData` (5.1).

`appsettings.json` has the same `Serilog`, `Contact`, `Apply`, `Email` (blank
credentials), `ForwardedHeaders` (`KnownProxies: []`) and `Security`
(`HstsEnabled: false`) sections as the admin's, and `"AllowedHosts": "*"`. There is no
`Auth` section and no connection string. Nothing is deployed before Phase D.

**Controllers:** `Controllers/PublicContactController.cs` and
`Controllers/PublicApplyController.cs`, in the namespace
`DigitalHub.PublicApi.Controllers`. Each has the same route, verb, rate-limit policy,
body limits and body as the admin's (2.2). They do **not** have `[AllowAnonymous]`,
because there is no authorization to opt out of. The admin copies stay until ISO-4
deletes them.

### 3.2 The fallback: `PublicRouteGate`

ADR 0001 point 1: "Its fallback policy denies everything else."

There is no authentication scheme, so an authorization fallback policy cannot deny
here: a failed policy with no scheme throws on challenge. The deny-by-default is
therefore a gate:

```csharp
// api/src/DigitalHub.PublicApi/Infrastructure/PublicRouteGate.cs
public sealed class PublicRouteGate(RequestDelegate next)
{
    public static readonly PathString Contact = "/api/v1/public/contact";
    public static readonly PathString Apply = "/api/v1/public/apply";

    public Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        if (HttpMethods.IsPost(context.Request.Method)
            && (path.Equals(Contact, StringComparison.OrdinalIgnoreCase) || path.Equals(Apply, StringComparison.OrdinalIgnoreCase)))
            return next(context);

        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return ProblemResults.WriteAsync(context.Response, StatusCodes.Status404NotFound, "not_found", "Not found.", context.RequestAborted);
    }
}
```

The rules this sets:

- **Only POST on the two exact paths passes.** The match ignores case, like routing.
  The website posts to exactly `/api/v1/public/apply`
  (`website/src/components/ApplyForm.tsx:14`).
- **Everything else gets the same 404:**
  - any other method on those paths (routing alone would answer 405 with an `Allow`
    header);
  - a trailing slash (routing alone would match it);
  - any other path, including the admin routes and `/health`.

  The 404 is `application/problem+json` with `code: "not_found"` (A-6, A-7). The body is
  not read.
- **The gate sits after request logging**, so a refused probe is still one log line
  (A-13). It also sits after `ExceptionShieldMiddleware`, so an aborted request is
  still a 499.
- **The gate sits before `RequestBodyLimitMiddleware` and the rate limiter**, so a
  refused request costs nothing.

**Defence in depth.** The gate and the endpoint list are proven separately (5.1, T-R1
and T-R2):

- If someone adds a controller, the gate still refuses it.
- If someone loosens the gate, the endpoint-inventory test still fails on any endpoint
  beyond the two.

**Alternatives rejected (R1-5):**

- **A `FallbackPolicy` that always fails, with a custom
  `IAuthorizationMiddlewareResultHandler` that writes the 404 problem.**
  - It works only by running the authorization stack in a process the ADR says has
    none.
  - Each allowed route would have to opt out with `[AllowAnonymous]`.
  - The deny decision would be split across a policy, a result handler and per-endpoint
    metadata.
  - The gate is one file, with the method and the two paths written out, and T-R2 tests
    it.
- **`MapFallback` returning 404.**
  - It catches only paths that match no endpoint. A wrong method on a form path selects
    routing's 405 endpoint, not the fallback, so a second handler would be needed for
    405.
  - A trailing slash would still match the form routes.
  - That is two mechanisms where the gate is one.

**The standards' "Enforced by" text.** `ENGINEERING_STANDARDS.md` names only the admin
API's fallback policy, for P-5 ("API fallback policy requires an authenticated user")
and S-2 ("`Program.cs` fallback policy; role matrix in `CareersTests`"). With a second
API that text would be incomplete. Commit 7 updates **only the "Enforced by" cells** of
P-5 and S-2, so they name both APIs:

| Row | "Enforced by" now | "Enforced by" after ISO-2 |
|---|---|---|
| P-5 | Security gate (`gate.mjs` fails on unknown or malformed input); API fallback policy requires an authenticated user | Security gate (`gate.mjs` fails on unknown or malformed input); admin API fallback policy requires an authenticated user; the public forms API answers only its two routes (`PublicRouteGate`, `PublicRouteTests`, ADR 0001) |
| S-2 | `Program.cs` fallback policy; role matrix in `CareersTests` | Admin API: `Program.cs` fallback policy; role matrix in `CareersTests`. Public forms API, which has no authentication by ADR 0001: `PublicRouteGate` denies every route but its two; `PublicRouteTests` |

The rule text, the ids and the statuses do not change. Only an ADR changes a rule
(`ENGINEERING_STANDARDS.md`, introduction), and ADR 0001 is the accepted decision that
the public API has no authentication.

**No `/health`.** ADR 0001 says "exactly two routes". A health endpoint for Phase D
would need an ADR change and the owner's word. It is not planned here (section 10).

### 3.3 The small DbContext

`api/src/DigitalHub.PublicApi/Data/PublicFormsDbContext.cs` maps exactly the four
tables. The entity classes live in `Data/FormsEntities.cs`, in the namespace
`DigitalHub.PublicApi.Data`. Their names are the ones `no-hiring-system.test.ts`
allows (2.7): `ContactRequest`, `Vacancy`, `SiteSettings` and `ApplicationCount`. They
do not clash with the admin's, because the public projects never reference
`DigitalHub.Api`.

| Entity | Table | Mapped columns | Used for |
|---|---|---|---|
| `ContactRequest` | `contact_requests` | `id` (`ValueGeneratedNever`), `name`, `organization`, `role`, `email`, `situation`, `message`, `status`, `created_at` | Insert only |
| `Vacancy` | `vacancies` | `id`, `title`, `status` (string) | Read, no tracking |
| `SiteSettings` | `site_settings` | `id`, `email`, `careers_email` | Read, no tracking |
| `ApplicationCount` | `application_counts` | `id`, `vacancy_id`, `applied_on` (`date`), `count` | Mapped (ADR point 4). The count itself is the shared `MERGE` on `Database` |

The mapping rules:

- Column names are given explicitly with `HasColumnName`. There is no snake-case helper
  to copy.
- There are no navigations and no foreign keys. In particular, nothing maps
  `handled_by_id` to users.
- No column is store-generated. So `SaveChanges` on a new `ContactRequest` sends a plain
  `INSERT` with no `OUTPUT` or read-back. That matters for ISO-3, whose login gets
  INSERT but not SELECT on `contact_requests`.
- The unmapped nullable columns (`handled_by_id`, `handled_at`) take their defaults,
  NULL, exactly as the admin's insert leaves them (`ContentFormsData.cs:15-28` sets
  neither).

`Data/PublicFormsData.cs`, `PublicFormsData(PublicFormsDbContext db) : IFormsData`:

| Member | Implementation |
|---|---|
| `AddContactRequestAsync` | `db.ContactRequests.Add(new ContactRequest { ... all nine ... })`, then `SaveChangesAsync` |
| `FindVacancyAsync` | `db.Vacancies.AsNoTracking().Where(v => v.Id == id).Select(v => new { v.Id, v.Title, v.Status }).FirstOrDefaultAsync()` → `FormsVacancy(Id, Title, string.Equals(Status, "published", StringComparison.OrdinalIgnoreCase))`. The ignore-case comparison matches the admin's `Enum.Parse(..., ignoreCase: true)` |
| `MailboxesAsync` | `db.SiteSettings.AsNoTracking().OrderBy(s => s.Id).Select(s => new FormsMailboxes(s.CareersEmail, s.Email)).FirstOrDefaultAsync()` |
| `IncrementApplicationCountAsync` | `ApplicationCountSql.IncrementAsync(db.Database, vacancyId, day, ct)` |

**The hiring-store scan reaches the new model (R1-4).** Commit 3 changes one line of
`website/test/no-hiring-system.test.ts`, line 114, from:

```ts
  return normalized.startsWith('api/src/DigitalHub.Api/Data/') && normalized.endsWith('.cs');
```

to:

```ts
  return (normalized.startsWith('api/src/DigitalHub.Api/Data/') || normalized.startsWith('api/src/DigitalHub.PublicApi/Data/')) && normalized.endsWith('.cs');
```

This is the only `website/` change. It strengthens the guard (P-6): the table and
column names in `HasColumnName(...)` and `ToTable(...)` are `contact_requests`,
`vacancies`, `site_settings`, `application_counts`, `careers_email`, `applied_on` and
the other columns in the table above. None matches
`^(cv_|applicant|resume|candidate|interview)`, so the test stays green (C14).

The context has **no migrations** and is never used for one. There is no `Migrations`
folder, no design-time factory, and no `EnsureCreated` or `Migrate`. The schema is
still owned by `ContentDbContext`'s migrations, which CI applies before the tests
(2.8). A test proves the assembly contains no `Migration` or `ModelSnapshot` type
(T-I7).

### 3.4 Infrastructure: copied, not shared

The public API gets its own copies, in `api/src/DigitalHub.PublicApi/Infrastructure/`
and the namespace `DigitalHub.PublicApi.Infrastructure`, of:

- `ProblemResults`
- `CorrelationIdMiddleware`
- `SecurityHeadersMiddleware`
- `UnhandledExceptionHandler`
- `ExceptionShieldMiddleware`
- `RequestBodyLimit` (the attribute and the middleware)
- `RateLimitLog`
- `SensitiveDestructuringPolicy`

Each copy is verbatim except for:

- the `namespace` line;
- `RateLimitLog.Category`, which becomes `"DigitalHub.PublicApi.RateLimit"`.

The logger categories of the other copied types follow their new namespace (for
example `DigitalHub.PublicApi.Infrastructure.ExceptionShieldMiddleware`).
`implementation.md` lists them.

The reasons for copying:

- **ISO-2 adds a process and does not change the admin API** (the boundary in
  section 1). Moving these types into a shared library would rename namespaces in the
  admin API and its tests. That is a second ISO-1-sized move, with its own
  no-behaviour-change proof.
- **Each process owns its pipeline.** That is the point of the split. But only **two**
  of the eight copies are meant to diverge (R1-2):
  - `ExceptionShieldMiddleware` and `RequestBodyLimit` lose their `ApplyPage` branches
    in the admin API at ISO-4, and the public copies keep them.
  - The other **six must not drift**: `ProblemResults`, `CorrelationIdMiddleware`,
    `SecurityHeadersMiddleware`, `UnhandledExceptionHandler`, `RateLimitLog` and
    `SensitiveDestructuringPolicy`. Three of them are security controls: the log
    redaction list, the security headers and the safe 500 body. A fix to the admin copy
    must not miss the public one, which is the process that faces the internet.
  - A committed parity test makes that a control, not a promise (3.4.2).

Two alternatives were rejected:

- **(a) A shared `DigitalHub.Web` library**, for the first reason above.
- **(b) Linking the admin's source files** (`<Compile Include="..\DigitalHub.Api\..." Link>`).
  It would compile `DigitalHub.Api.Infrastructure` types into the public assembly, and
  any admin edit would change the public process without a public review.

#### 3.4.1 The duplication, measured (R1-2)

Round 1 said "about 440 lines". That counted only the eight infrastructure files, and
undercounted those. I measured round 2 with `wc -l` on whole files and `sed -n 'a,bp' | wc -l`
on line ranges at `522b175`:

- Copies of whole files: their exact size.
- Program blocks: the admin line range copied.
- Ported tests: the admin range they are ported from.

The ported tests are rewritten in places (fixtures through `FormsDatabase` instead of
the admin API), so their figure is the size of the original, not a byte-identical copy.
`implementation.md` records the measured size of each new file, so the tester can
compare.

| Group | What | Admin source, lines | Lines | After ISO-4 |
|---|---|---|---|---|
| A. Product, must stay identical | `ProblemResults` 36, `CorrelationIdMiddleware` 49, `SecurityHeadersMiddleware` 32, `UnhandledExceptionHandler` 29, `RateLimitLog` 45, `SensitiveDestructuringPolicy` 69 | `api/src/DigitalHub.Api/Infrastructure/*.cs` | 260 | **Permanent** duplicate. Parity test T-D1 |
| B. Product, diverge by design | `ExceptionShieldMiddleware` 90, `RequestBodyLimit` 112 | same folder | 202 | Permanent copies that differ from ISO-4 on. Checked identical once, at ISO-2 (C13) |
| C. Product, `Program.cs` blocks that stay in both | Kestrel `AddServerHeader` (1), Serilog set-up (7, lines 31-37), forwarded headers (24, lines 85-108), `AddControllers` and the `InvalidModelStateResponseFactory` (35, lines 169-203) | `api/src/DigitalHub.Api/Program.cs` | 67 | **Permanent** duplicate. No parity test (it is not a file); named follow-up F-1 |
| D. Product, gone from the admin at ISO-4 | Both controllers (47 + 23), the contact parts of the rate limiter (the rate limiter is lines 117-164, 48 lines; the contact policy and title are about half) | controllers; `Program.cs` | ~94 | **Temporary**: ISO-4 deletes the admin side |
| E. Tests, stay in both | `ApiFactory` configuration and catalog helpers (`TestConfiguration`, `ToTestCatalog`, `ElevatedTestConnectionString`, `TestConnectionString`, lines 118-206, 89); `AbortedRequestTests.cs` (197; the admin keeps it for login); `ServerHeaderTests.cs` (122; the admin keeps it); the `RateLimitLog.Network` theory with its factory and sink (`RateLimitLogTests.cs:66-118`, 53) | `api/tests/DigitalHub.Api.Tests/` | 461 | **Permanent** duplicate. Named follow-up F-1 |
| F. Tests, gone from the admin at ISO-4 | `CareersTests.cs` apply tests (lines 40-397, 358), their helpers (lines 585-603, 624-630, 651-708: 84), factories (lines 710-779, 70), test contents (lines 805-835, 31); `PublicContactTests.cs` without the Studio test (291 − 16 = 275); `RequestBodyLimitTests.cs` contact tests and helper (lines 83-126, 44); the contact rate-limit-log test (lines 42-65, 24) | same | ~886 | **Temporary**: ISO-4 deletes the admin originals with the admin form routes |
| | **Total** | | **~1,970** | Permanent: A + B + C + E ≈ **990**. Temporary: D + F ≈ **980** |

"~" marks a figure that comes from a line range and will move by a few lines when the
code is copied. The rest are whole-file counts.

**Against G-9's threshold.** GAP-20 sets "at most 3% duplication in changed code" at
step 4e. Measured that way, this change is far over the threshold:

- Nearly all the new product code in groups A to D is copied.
- After ISO-4 the permanent part is about 990 lines.

G-9 is a Gap today, so no gate is broken. But this plan does not lean on that, and it
does not ask step 4e to take the copy into its baseline quietly. Instead:

- Group A is under a committed parity test from this change (3.4.2).
- Groups C and E are named follow-up F-1, with a destination (3.4.3).
- Groups D and F disappear at ISO-4, which deletes the admin side. ISO-4's plan must
  say so, and ISO-2's `implementation.md` hands it on (4.4).
- Group B is the intended divergence (3.4).

Why the copy still stands, as the reviewer accepted:

- Copying the pipeline is "its own process" (ADR 0001 point 1).
- Linking source (b) was rejected for good reason.
- A shared library now would change the admin API in a change whose boundary is "adds
  the new process and its tests".

#### 3.4.2 The parity test for the six files that must not drift

`api/tests/DigitalHub.PublicApi.Tests/InfrastructureParityTests.cs`, **T-D1**
`The_shared_infrastructure_matches_the_admin_copy`, is a theory with one row per group-A
file: `ProblemResults.cs`, `CorrelationIdMiddleware.cs`, `SecurityHeadersMiddleware.cs`,
`UnhandledExceptionHandler.cs`, `RateLimitLog.cs` and `SensitiveDestructuringPolicy.cs`.

For each row it reads `api/src/DigitalHub.Api/Infrastructure/<file>` and
`api/src/DigitalHub.PublicApi/Infrastructure/<file>` as **text**. It finds the repository
root by walking up from `AppContext.BaseDirectory` to the folder that holds
`api/DigitalHub.slnx`, and fails if none is found (fail closed, P-5). It references no
admin assembly, so the public suite still cannot see `DigitalHub.Api`'s types.

`Normalize(text)` makes three changes:

- It turns CRLF into LF.
- It replaces the one `namespace ...;` line with `namespace <ns>;`.
- In `RateLimitLog.cs` only, it replaces the one line matching
  `public const string Category = "[^"]*";` with a placeholder.

The test asserts that the normalized texts are equal. On a difference, it reports the
first differing line number and both lines.

How it is proven able to fail:

- **T-D2** `The_parity_check_reports_a_difference` runs `Normalize` and the comparison
  on two in-memory texts. Texts differing only in the namespace line and the
  `Category` line compare equal. Texts differing in one other line, for example a new
  name in a redaction set, are reported with that line number.
- **Once, by hand, in `implementation.md`:** add one character to a comment in the
  public `SecurityHeadersMiddleware.cs`, run T-D1 (it fails and names the line), revert,
  and show `git status` clean.

What it does in practice: from ISO-2 on, a pull request that changes one of the six
admin files without the public copy (or the other way round) fails CI's `api` job. Its
author must change both, or record a decision. That is the control the reviewer asked
for. ISO-4 does not touch these six files. If ISO-4 or a later change ever means one of
the six to diverge, that change takes the row out of T-D1 and says why. Taking a row out
is a scope decision for that change's review, not something done silently.

Group B is deliberately not in T-D1, because ISO-4 changes the admin copies. C13
checks group B identical once, at ISO-2.

#### 3.4.3 Named follow-up F-1: consolidate the permanent copies after ISO-4

What T-D1 cannot cover:

- **Group C**, the `Program.cs` blocks. The forwarded-headers rule among them is a
  security control: only configured `KnownProxies` are trusted.
- **Group E**, the test helpers. `ToTestCatalog` and `TestConnectionString` among them
  are the guard that keeps tests off `DigitalHubContent`.

Until F-1, these are held by:

- verbatim copies, checked at ISO-2 (C13, which now covers groups B, C and E);
- the ported behavioural tests, which run the same assertions on both processes until
  ISO-4: `Known_proxy_rate_limits_each_forwarded_visitor_separately`,
  `Forged_forwarded_for_from_a_non_proxy_is_ignored`,
  `Empty_proxy_list_still_rate_limits_one_sender_when_the_forged_address_changes`,
  and the factory's catalog refusal in every run.

**F-1, proposed change `iso-shared-hosting`.** It runs after ISO-4, once the two
pipelines' final shape is known. It moves group A, the group C blocks (as small
extension methods) and the group E helpers into one place, without breaking isolation:

- the product parts into a library both APIs reference, holding no authentication,
  Identity or admin code, and under `ReferenceGuard`;
- the test helpers into a linked `api/tests/Shared/` file, like `ReferenceGuard`.

It then removes T-D1's need, or keeps T-D1 for anything left copied.

- **Destination.** The ISO-2 `implementation.md` "Hand-off" section, and the PR body's
  "Open items". The tech lead carries it to the owner for scheduling. It is a proposal,
  not a decision: no owner words are claimed for it.
- **Until then.** Step 4e (GAP-20) must not baseline groups A, C or E silently. Its plan
  cites F-1.

### 3.5 The integration suite: a separate test project

`api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj` has the same
shape as `DigitalHub.Api.Tests.csproj`:

- `Microsoft.NET.Sdk.Web`, `OutputType Library`, `CETCompat` and `IsPackable false`,
  with the same comment about Application Control.
- The same packages and versions: `coverlet.collector` 6.0.4,
  `Microsoft.AspNetCore.Mvc.Testing` 10.0.12, `Microsoft.NET.Test.Sdk` 17.14.1,
  `xunit` 2.9.3, `xunit.runner.visualstudio` 3.1.4.
- `ProjectReference` to `DigitalHub.PublicApi` and `DigitalHub.Forms` **only**.
- `<Compile Include="..\Shared\ReferenceGuard.cs" Link="Shared\ReferenceGuard.cs" />` (3.6).
- `<UserSecretsId>41335d15-4f42-410a-bf90-41068117e45a</UserSecretsId>`, the admin
  API's store, so local runs find the same `ConnectionStrings:Content`. It is read with
  `AddUserSecrets(typeof(PublicApiFactory).Assembly)`. The id is not written as a C#
  literal, so no new gitleaks `generic-api-key` finding appears (2.5). It is a test
  assembly attribute. It never reaches the public host's configuration, because the
  host loads user secrets only for the PublicApi assembly, which has no id.

Why a separate project, not the existing one:

- **"Its own integration suite"** is the owner's and the ADR's wording. A separate
  assembly that cannot see `DigitalHub.Api` makes it true: nothing in this suite can set
  up data or assert through the admin's types.
- **The existing project cannot host both factories cleanly.** Both web projects
  compile a global `Program`, and `ApiFactory` is `WebApplicationFactory<Program>`. An
  aliased reference, as for the importer, would also copy a second `appsettings.json`
  and `.deps.json` into the admin test output.

The rejected alternative: tests in `DigitalHub.Api.Tests` with an aliased reference.
That needs no workflow change, but it mixes the admin's assemblies into the public
suite's process, and it carries the output-collision risk above.

`PublicApiFactory : WebApplicationFactory<Program>` (`PublicApiFactory.cs`):

- `UseEnvironment("Testing")`.
- `UseSetting("ConnectionStrings:PublicForms", <test connection>)`. The test connection
  is `ConnectionStrings:Content` from user-secrets or the environment, rewritten to
  `DigitalHubContent_Test`. It refuses any other catalog, and refuses Windows
  authentication or a missing `User ID`. These are copies of `ApiFactory.ToTestCatalog`
  and `TestConnectionString` (`ApiFactory.cs:134-150`, `188-206`). In ISO-2 this is the
  restricted `dh_content_app` login. ISO-3 changes this one setting to `dh_public_forms`.
- `Apply:IpPermitLimit` and `Apply:EmailPermitLimit` are set to 1000, as in `ApiFactory`.
- No `Auth` setting.
- `[CollectionDefinition("PublicFormsSql", DisableParallelization = true)]`.

`FormsDatabase.cs` holds the test fixtures, in ADO.NET (`Microsoft.Data.SqlClient`,
which is transitive through EF Core). They always use parameters. They connect with
the same restricted test login, **never through the host's context**, so the
assertions keep working in ISO-3 when the host's login can no longer read
`contact_requests`. The fixtures:

- `InsertVacancyAsync(status)` inserts a vacancy with every NOT NULL column in 2.4,
  and returns its id. Its slug is `public-api-<32 hex>`, a new GUID each time, so the
  unique `slug` index is never hit. `DeleteVacancyAsync(id)` removes it, and the cascade removes its
  `application_counts` rows.
- `CountAsync(vacancyId)` reads today's count.
- `ContactByEmailAsync(email)` and `ContactCountAsync()`.
- `SetMailboxAsync(careers, email)` updates the first `site_settings` row. If there is
  none, it inserts one, as `CareersTests.SetMailboxAsync` does (lines 587-601). Every
  test that changes it puts back `careers@digitalhub.test`, null, as
  `EnsureCareersAddressAsync` does (line 585).
- `ElevatedConnectionString()` is a copy of `ApiFactory.ElevatedTestConnectionString`
  (lines 161-186). It is used only to create and drop the count-failure trigger (T-P13).

### 3.6 F1: the guard, widened, with a canary, applied to the public API

This answers the three points of `docs/changes/ISO-1/delivery-approval.md`, "F1:
decision", "What this commits ISO-2 to", and test-report F1.

**Point 1, the widened rule.** I chose the prefix-rule option the ruling allows, in
one shared file, `api/tests/Shared/ReferenceGuard.cs`. Both test projects compile it as
a linked file, so the two guards cannot drift.

```csharp
namespace DigitalHub.Tests.Shared;

internal static class ReferenceGuard
{
    /// <summary>Forbidden by exact name.</summary>
    public static readonly string[] Exact = ["DigitalHub.Api", "DigitalHub.Images", "System.IdentityModel.Tokens.Jwt"];

    /// <summary>Forbidden with every assembly below them: the family name itself, or the name plus ".".</summary>
    public static readonly string[] Families =
    [
        "Microsoft.AspNetCore.Authentication",   // .JwtBearer, .BearerToken, .Cookies, .OAuth, ... and the root assembly
        "Microsoft.AspNetCore.Identity",         // the root assembly and .EntityFrameworkCore
        "Microsoft.Extensions.Identity",         // .Core, .Stores
        "Microsoft.IdentityModel",               // .Tokens, .JsonWebTokens, .Protocols...
    ];

    public static bool IsForbidden(string name) =>
        Exact.Contains(name, StringComparer.OrdinalIgnoreCase)
        || Families.Any(family => name.Equals(family, StringComparison.OrdinalIgnoreCase)
                               || name.StartsWith(family + ".", StringComparison.OrdinalIgnoreCase));

    public static IReadOnlyList<string> Violations(Assembly assembly) =>
        assembly.GetReferencedAssemblies().Select(reference => reference.Name ?? "")
            .Where(IsForbidden).OrderBy(name => name, StringComparer.Ordinal).ToList();
}
```

- **Every name on the old list is covered.** `DigitalHub.Api`, `DigitalHub.Images` and
  `System.IdentityModel.Tokens.Jwt` are exact names. `...Authentication.JwtBearer`,
  `...Identity.EntityFrameworkCore`, `Microsoft.Extensions.Identity.Core` and
  `.Stores`, and `Microsoft.IdentityModel.Tokens` fall under their families. So nothing
  is narrowed (P-6).
- **The four F1 names are covered:** `Microsoft.AspNetCore.Identity`,
  `Microsoft.AspNetCore.Authentication`, `...Authentication.BearerToken` and
  `...Authentication.Cookies`.
- **The base references still pass.** None of the 23 names in 2.6 is forbidden. Forms
  needs no `Authentication*` or `Identity*` abstraction, so the rule does not have to
  allow one.
- `FormsLibraryTests` uses it: `ForbiddenReferences` is removed, and the existing test
  `The_forms_library_references_no_admin_api_identity_or_token_code` keeps its **name**
  and becomes `Assert.Empty(ReferenceGuard.Violations(typeof(ApplicationIntake).Assembly))`.
  The name stays, so the base name list stays the same.

**Point 2, a canary that proves the guard can fail.** It comes in three parts:

- **(a) A committed canary on a real compiled assembly.**
  `api/tests/DigitalHub.Api.Tests/GuardCanary.cs` contains
  `internal static class GuardCanary { public static void Register(IServiceCollection services) => services.AddAuthentication(IdentityConstants.BearerScheme).AddBearerToken().AddCookie(); }`.
  This is exactly the tester's F1 case. It is never called, but compiling it makes the
  admin test assembly reference the four F1 assemblies. The new test
  `FormsLibraryTests.The_guard_rejects_the_authentication_and_identity_assemblies`
  asserts that `ReferenceGuard.Violations(typeof(GuardCanary).Assembly)` contains all
  four. It is written first against the **old** exact list and fails (5.1, T-F1), which
  reproduces F1. It goes green when the rule is widened. It lives in the admin test
  project, which already references Identity through `DigitalHub.Api`, so the canary
  pulls nothing into product code or into the public suite.
- **(b) A committed name canary in the public suite.**
  `PublicApiReferenceTests.The_guard_reports_every_forbidden_name` is a theory over all
  twelve old and new names, plus two family descendants not seen yet
  (`Microsoft.AspNetCore.Authentication.OAuth`, `Microsoft.IdentityModel.JsonWebTokens`).
  Each must be `IsForbidden`, so the public guard proves it can fail inside its own
  suite. A positive control,
  `The_guard_reads_the_real_references_of_the_public_api`, proves the collector is not
  empty: the PublicApi assembly's references contain `DigitalHub.Forms` and
  `Microsoft.EntityFrameworkCore`.
- **(c) The ruling's literal demonstration, "shown failing the guard and then
  removed".** This is done once by the developer and recorded in `implementation.md`.
  It is never committed. The developer adds the `GuardCanary` body to a scratch file in
  `api/src/DigitalHub.Forms/`, builds, and runs the Forms guard, which must fail and
  name the four. The file is removed, and `git status` is shown clean. Then the same is
  done in `api/src/DigitalHub.PublicApi/` with the public guard (T-G1).

**Point 2b, the guard applied to `DigitalHub.PublicApi`.**
`PublicApiReferenceTests.The_public_api_and_forms_reference_no_admin_identity_or_token_code`
is a theory over `typeof(PublicFormsDbContext).Assembly` and
`typeof(ApplicationIntake).Assembly`, asserting `Assert.Empty(ReferenceGuard.Violations(...))`.

**The rule covers the whole family.** The `Microsoft.AspNetCore.Authentication` family
also forbids `.Abstractions` and `.Core`, which matches the owner's
"`Microsoft.AspNetCore.Authentication*`". The plan expects the PublicApi assembly to
reference none of them:

- Its code names no authentication type.
- `AddControllers` reaches MVC's authentication core inside the MVC assembly. It is not
  named in our IL, so it is not a compiled reference of ours.

The expectation is checked, not assumed. From commit 3 on, the developer quotes the
PublicApi dll's references (C8), and T-G2 runs from commit 4 on.

**Stop condition (R1-6).** If T-G2, or C8, shows any forbidden name on the PublicApi
assembly at any commit, the developer stops, and the change goes back to the architect.
That includes `Authentication.Abstractions` or `.Core`. The rule is never narrowed to
let it pass (P-6), and no exception is taken without the owner's words (P-7).

**Point 3**, the citation, is section 1 and this section.

What the reference guard cannot see, and what covers it:

- **What is registered at run time, not compiled.** T-I1 checks the host's services
  (5.1).
- **Transitive packages.** `Microsoft.Data.SqlClient` 6.1.6 brings `Azure.Identity`,
  `Microsoft.IdentityModel.*` and `System.IdentityModel.Tokens.Jwt` 7.7.1 for Entra ID
  sign-in (ISO-1 test report, C10 judgement). They are not ASP.NET Core Identity or
  JwtBearer, and ADR 0001 does not forbid them. Any project with EF Core SqlServer has
  them. The guard reads compiled references, which do not include them.
  `dotnet list ... package --include-transitive` must show no `Microsoft.AspNetCore.Identity.*`,
  `Microsoft.Extensions.Identity.*` or `Microsoft.AspNetCore.Authentication.JwtBearer`
  (C9).

### 3.7 "No authentication, no Identity, no signing key, no refresh cookie, no Studio controllers"

| ADR words | How it is made true | Proven by |
|---|---|---|
| No authentication | No `AddAuthentication`. MVC's `AddControllers` registers authentication *core* services with **no scheme**, and there is no handler | T-I1: `IAuthenticationSchemeProvider` is absent, or `GetAllSchemesAsync()` is empty. No registered service or implementation is an `IAuthenticationHandler`, or comes from `Microsoft.AspNetCore.Authentication.JwtBearer`, `.BearerToken` or `.Cookies` |
| No Identity | No Identity package and no `AddIdentityCore` | T-I1: no service type from `Microsoft.AspNetCore.Identity*` or `Microsoft.Extensions.Identity*`. Also the reference guard (3.6) and C9 |
| No JWT signing key | No `Auth` configuration. Start-up refuses one | T-I2: the host's `IConfiguration.GetSection("Auth").Exists()` is false. T-I3: start-up with `Auth:SigningKey` set throws |
| No refresh cookie | No cookie is written anywhere | T-P1 and T-P2 (contact and apply success): no `Set-Cookie` header. T-R2: none on any 404 |
| No Studio controllers | Only the two controllers | T-R1: the endpoint inventory is exactly two |
| Fallback denies everything else | `PublicRouteGate` | T-R2 |

### 3.8 Getting the suite into CI

**A workflow change is needed.** `ci.yml` runs only the admin test project, by path
(2.8). ISO-2 adds **one `run` step** to job `api`, between "Integration tests
(Release)" and "Upload test report":

```yaml
      - name: Public API integration tests (Release)
        if: ${{ !cancelled() }}
        run: >-
          dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj
          -c Release --no-build
          --logger "trx;LogFileName=public-api-tests.trx"
          --logger "console;verbosity=normal"
          --results-directory ${{ github.workspace }}/reports/api
```

The choices in that step:

- **No new `uses:` line.** The result goes into `reports/api`, so the existing
  `Upload test report` step (`if: always()`) carries it in the same `api-test-report`
  artifact, as `public-api-tests.trx` next to `api-tests.trx`. Nothing new needs a SHA
  pin (GAP-09), and #68's pinned `upload-artifact` line is untouched.
  - The admin trx keeps its file name, so the name comparisons on `api-tests.trx`
    (5.3) are unaffected.
- **`if: ${{ !cancelled() }}`** runs the public suite even when the admin suite fails,
  so both results are reported.
- **The same job, after the same migration and grant steps.** The public suite runs
  against the same freshly migrated `DigitalHubContent_Test`, with the same
  `ConnectionStrings__Content` and `__ContentAdmin`, and after the admin suite has
  finished. The two suites never run at once.
- **actionlint (G-13, blocking)** checks the new step on the PR head, in the Workflow
  lint job. The step's shell text has the same shape as the existing test step.
- **No golden copy covers `ci.yml`** (`.github/security/*.expected.yml` cover
  `security.yml` and the Semgrep job only).

**Order with PR #68.** #68 also changes `ci.yml` (2.9). `AGENTS.md` says "Parallel
changes must change different files". So:

- The `ci.yml` commit (commit 7, section 3.9) is made only once #68 is **merged or
  closed**, and only after `change/ISO-2` is rebased on the new
  `origin/rebuild/dotnet-platform`.
- Commits 1 to 6 touch no `.github/` file, so they can be built and tested while #68 is
  open.
- If #68 is still open when commit 6 is done, the developer stops, records it in
  `implementation.md`, and the pipeline waits. The plan does not route around it.
- After a rebase onto #68, the `api` job uses `dotnet-version: "10.0.404"`, while the
  local SDK is 10.0.401. The new step does not depend on the SDK patch.

### 3.9 Order of commits

Red tests come before what makes them green (P-4). Each commit has the `ISO-2:`
subject, a body that says why, and the attribution trailer (B-4).

**Every commit builds** (R1-1): `dotnet build DigitalHub.slnx -c Release` gives
`0 Error(s)`, and no new warning beyond the 13 in ContentImport, at each of commits 1
to 7. Two rules make that true:

- **Commit 3 brings all eight copied infrastructure files.** So the Serilog step's
  `SensitiveDestructuringPolicy` exists when `Program.cs` first names it, and the
  ported tests' `RateLimitLog.Network` and `using DigitalHub.PublicApi.Infrastructure;`
  compile at commit 4.
- **The commit-4 tests name only types that exist at commit 3:** `Program`,
  `PublicFormsDbContext` and the `Data` entities, the eight `Infrastructure` copies, and
  the `DigitalHub.Forms` types. They never name the controllers or `PublicRouteGate`.
  They reach the routes over HTTP and the endpoints through `EndpointDataSource`.

| # | Subject | Files | Builds |
|---|---|---|---|
| 1 | ISO-2: Add a canary the forms-library guard misses (red) | `api/tests/DigitalHub.Api.Tests/GuardCanary.cs`; `FormsLibraryTests.cs` (adds T-F1, using the **existing** `ForbiddenReferences`) | yes |
| 2 | ISO-2: Widen the forms-library guard to authentication and Identity | `api/tests/Shared/ReferenceGuard.cs`; `DigitalHub.Api.Tests.csproj` (linked `Compile`); `FormsLibraryTests.cs` (array removed, both tests on `ReferenceGuard`) | yes |
| 3 | ISO-2: Add the DigitalHub.PublicApi project, its forms context and its infrastructure copies | Files below | yes |
| 4 | ISO-2: Add the public API's integration suite (red) | `api/tests/DigitalHub.PublicApi.Tests/` (every test file in 4.1); `api/DigitalHub.slnx` | yes |
| 5 | ISO-2: Serve the contact and apply forms from the public API | `Controllers/PublicContactController.cs`, `Controllers/PublicApplyController.cs`; the full `Program.cs` of 3.1 except the gate | yes |
| 6 | ISO-2: Answer 404 to everything but the two form routes | `Infrastructure/PublicRouteGate.cs`; `Program.cs` (`UseMiddleware<PublicRouteGate>()` at its place in 3.1 step 10) | yes |
| 7 | ISO-2: Run the public API suite in CI, and record the second API in the readme and standards | `.github/workflows/ci.yml` (3.8, only after #68 is merged or closed and the branch is rebased); `api/README.md`; `ENGINEERING_STANDARDS.md` (the P-5 and S-2 "Enforced by" cells only, 3.2); `docs/changes/ISO-2/implementation.md` | yes |

Commit 3's files:

- `api/src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj` and `appsettings.json`.
- `Data/*`.
- All eight `Infrastructure/*` copies (3.4), but **not** `PublicRouteGate.cs`.
- A `Program.cs` holding only:
  - step 1 (Kestrel);
  - step 2 (Serilog);
  - the `ConnectionStrings:PublicForms` check of step 3, but **not** the `Auth`
    refusal;
  - step 4;
  - then `var app = builder.Build(); app.Run();` and `public partial class Program;`.

  There are no controllers, no `AddControllers`, no rate limiter and no middleware.
- `api/DigitalHub.slnx` (the PublicApi entry).
- `website/test/no-hiring-system.test.ts` line 114 (3.3).

**The expected test state, test by test.** "Red" means the test must fail, and "green"
means it must pass. A theory is listed by its rows.

| Test | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| T-F1 `The_guard_rejects_the_authentication_and_identity_assemblies` | **red** | green | green | green | green | green |
| `FormsLibraryTests`, the two existing tests | green | green | green | green | green | green |
| Base admin suite (578 names) | green | green | green | green | green | green |
| T-R1 `Only_the_two_form_routes_are_mapped` | — | — | — | **red** (0 endpoints) | green | green |
| T-R2 `Every_other_path_and_method_returns_404` | — | — | — | **red** (positive controls get 404; 404 bodies are empty) | **red**, mismatches only in the groups G1-G3 below | green |
| T-I1 no authentication scheme or Identity | — | — | — | green (nothing registered yet) | green (MVC's core services, no scheme, null `FallbackPolicy`) | green |
| T-I2 no signing key | — | — | — | green | green | green |
| T-I3 refuses `Auth` settings | — | — | — | **red** (the refusal comes in 5) | green | green |
| T-I4 refuses a missing connection string | — | — | — | green (the check is in 3) | green | green |
| T-I5 starts under the Development host checks (asserts `POST /api/v1/public/contact {}` → 400) | — | — | — | **red** (404: no controllers) | green | green |
| T-I6 four tables; T-I7 no migrations | — | — | — | green | green | green |
| T-G2 (×2), T-G3 (×14), T-G4 | — | — | — | green | green | green |
| T-D1 (×6) parity; T-D2 control | — | — | — | green (copies verbatim since 3) | green | green |
| `PublicContactTests`, all 7, and `PublicContactEmptyProxyTests` | — | — | — | **red** (404) | green | green |
| `PublicApplyTests`, all 13 | — | — | — | **red** (404) | green | green |
| `PublicBodyLimitTests`, 20 MB (×2) and under 16 KB | — | — | — | **red** (404, not 413 or 201) | green | green |
| `PublicRateLimitLogTests.A_refused_contact_submission_logs_a_warning_without_the_message` | — | — | — | **red** (no limiter, no warning) | green | green |
| `PublicRateLimitLogTests.The_network_drops_the_host_part` (×3) | — | — | — | green (pure, on the commit-3 copy) | green | green |
| `PublicAbortedRequestTests`, both theories, rows `/api/v1/public/contact` with delays 0 and 300 | — | — | — | **red** (no body read, no request-log line, 404) | green | green |
| `PublicServerHeaderTests.The_host_under_test_is_Kestrel_on_a_loopback_socket` | — | — | — | green | green | green |
| `PublicServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request` | — | — | — | green (Kestrel answers before any middleware; the header is off since 3) | green | green |
| `PublicServerHeaderTests.No_server_header_on_a_success` (`POST` contact, expects 201) | — | — | — | **red** (404) | green | green |
| `PublicServerHeaderTests.No_server_header_on_a_problem_response`, row `GET /api/v1/users` → 404 `problem+json` | — | — | — | **red** (empty 404) | **red** (empty 404: no gate yet) | green |
| same, row `GET /api/v1/gap-12-no-such-route` → 404 `problem+json` | — | — | — | **red** | **red** | green |
| same, row `POST /api/v1/public/contact {}` → 400 `problem+json` | — | — | — | **red** (404) | green | green |

The T-R2 mismatch groups at commit 5:

- **G1.** The two exact form paths, in their own case and upper-cased, with every method
  except POST: 405, not 404.
- **G2.** `/api/v1/public/contact/` and `/api/v1/public/apply/`: POST is matched by
  routing (400), and the other methods are 405.
- **G3.** Every other path: 404 with the right status, but an empty body, not
  `problem+json`, for non-HEAD requests.

The positive controls pass at commit 5.

**Stop conditions (R1-1, R1-6).** In each case the change goes back to the architect,
and no test is adjusted to make it red or green (P-6):

- **At commits 1, 4 and 5**, the developer runs the commands in 5.2. He compares the
  failing set with the table above **by test name, and by row for theories**. If a test
  listed red passes, or a test listed green fails, stop. At commit 5, the same applies if
  T-R2 shows any mismatch outside G1-G3, or none.
- **At commits 2, 3, 6 and 7**, everything listed green must pass. A failure is reported
  first (`AGENTS.md`: "Report failures before fixing them"). If it is an implementation
  slip inside the plan, the developer fixes it and records the failure and the fix in
  `implementation.md`. If it shows that the plan is wrong, stop.
- **At any commit**, if `ReferenceGuard` or C8 shows a forbidden name on the PublicApi
  assembly (3.6), stop.
- **At any commit**, if a build fails, stop.
- If Application Control blocks the new assemblies locally, stop and report the quoted
  error. Do not push to get CI evidence without the owner's confirmation.

## 4. Scope

### 4.1 Create

| File | What |
|---|---|
| `api/src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj` | 3.1 |
| `api/src/DigitalHub.PublicApi/Program.cs` | 3.1, built over commits 3 and 5, with the gate added in 6 (3.9) |
| `api/src/DigitalHub.PublicApi/appsettings.json` | 3.1 |
| `api/src/DigitalHub.PublicApi/Controllers/PublicContactController.cs`, `PublicApplyController.cs` | 3.1 |
| `api/src/DigitalHub.PublicApi/Data/PublicFormsDbContext.cs`, `FormsEntities.cs`, `PublicFormsData.cs` | 3.3 |
| `api/src/DigitalHub.PublicApi/Infrastructure/ProblemResults.cs`, `CorrelationIdMiddleware.cs`, `SecurityHeadersMiddleware.cs`, `UnhandledExceptionHandler.cs`, `ExceptionShieldMiddleware.cs`, `RequestBodyLimit.cs`, `RateLimitLog.cs`, `SensitiveDestructuringPolicy.cs` | 3.4, verbatim apart from the namespace and `RateLimitLog.Category` |
| `api/src/DigitalHub.PublicApi/Infrastructure/PublicRouteGate.cs` | 3.2 |
| `api/tests/Shared/ReferenceGuard.cs` | 3.6 |
| `api/tests/DigitalHub.Api.Tests/GuardCanary.cs` | 3.6 (a) |
| `api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj` | 3.5 |
| `api/tests/DigitalHub.PublicApi.Tests/PublicApiFactory.cs`, `FormsDatabase.cs` | 3.5. The factory subclasses are in the test files that use them |
| `api/tests/DigitalHub.PublicApi.Tests/PublicRouteTests.cs` | T-R1, T-R2 |
| `api/tests/DigitalHub.PublicApi.Tests/PublicApiIsolationTests.cs` | T-I1 to T-I7 |
| `api/tests/DigitalHub.PublicApi.Tests/PublicApiReferenceTests.cs` | T-G2 to T-G4 |
| `api/tests/DigitalHub.PublicApi.Tests/InfrastructureParityTests.cs` | T-D1, T-D2 (3.4.2) |
| `api/tests/DigitalHub.PublicApi.Tests/PublicContactTests.cs`, `PublicApplyTests.cs`, `PublicBodyLimitTests.cs`, `PublicRateLimitLogTests.cs`, `PublicAbortedRequestTests.cs`, `PublicServerHeaderTests.cs` | The ported form suites (T-P, 5.1) |
| `docs/changes/ISO-2/implementation.md` | The developer's record. Besides the evidence, it must have a **"Hand-off"** section listing (R1-7, R1-2):<br>1. The public API's own `AllowedHosts`, for ISO-5 or ISO-6.<br>2. `ForwardedHeaders:KnownProxies` for the IIS proxy, for ISO-5.<br>3. The groups D and F that ISO-4 deletes, and ISO-4's forwarded-headers test on the admin API.<br>4. F-1 `iso-shared-hosting`.<br>5. The one setting ISO-3 changes (`ConnectionStrings:PublicForms` in `PublicApiFactory`).<br>6. Step 4e must cite F-1.<br>It also holds the measured size of each new file (3.4.1) and the logger categories of the copied types (3.4) |

### 4.2 Change

| File | Change |
|---|---|
| `api/DigitalHub.slnx` | `src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj` under `/src/`, and `tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj` under `/tests/` |
| `api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` | One line: `<Compile Include="..\Shared\ReferenceGuard.cs" Link="Shared\ReferenceGuard.cs" />` |
| `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs` | T-F1 added. `ForbiddenReferences` replaced by `ReferenceGuard`. Both existing test names unchanged |
| `.github/workflows/ci.yml` | The one step in 3.8, after #68 |
| `website/test/no-hiring-system.test.ts` | Line 114, `inModel` also covers `api/src/DigitalHub.PublicApi/Data/` (3.3, R1-4). Nothing else |
| `ENGINEERING_STANDARDS.md` | The "Enforced by" cells of P-5 and S-2 only, as quoted in 3.2 (R1-5). No rule text, id or status |
| `api/README.md` | Line 3 names `src/DigitalHub.PublicApi`, the public forms API (ADR 0001), reached only at `/api/v1/public/contact` and `/apply`, with connection key `ConnectionStrings:PublicForms` and no `Auth` settings. The tests line adds `dotnet test api/tests/DigitalHub.PublicApi.Tests -c Release` |

### 4.3 Must not change (checked by C11)

- Everything under `api/src/DigitalHub.Api/` (including `Data/` and the migrations).
- Everything under `api/src/DigitalHub.Forms/` and `api/src/DigitalHub.Images/`.
- `api/tools/`.
- Every existing test source except `FormsLibraryTests.cs` and the test csproj.
- `studio/` and `packages/`.
- `website/`, except the one line of `website/test/no-hiring-system.test.ts` in 4.2.
- `ENGINEERING_STANDARDS.md`, except the two cells in 4.2.
- `.github/` other than `ci.yml`.
- `docs/adr/` and `docs/security-deployment.md`.
- The lockfiles.

### 4.4 Out of scope, and where each item goes

| Item | Goes to |
|---|---|
| The `dh_public_forms` login, its grants (a migration) and its permission test; the public factory's connection switched to it | ISO-3 |
| Removing `PublicContactController`, `PublicApplyController` and their admin tests from the admin API; `AllowedHosts` for the Studio host | ISO-4 |
| `web.config` proxy rule; website form browser tests against the public API; the public API's `ForwardedHeaders:KnownProxies` for the IIS proxy | ISO-5 |
| The public API's own `AllowedHosts` (the website host in Production). ISO-4 names only the admin API, and the refinement plan assigns this to no item. It is recorded where ISO-5 and ISO-6 will see it (R1-7): in the "Hand-off" section of ISO-2's `implementation.md` and in the PR body's "Open items", both required by this plan. The plan asks gate 2 to carry it into the ISO-5 request. It is not decided here | ISO-5 / ISO-6 |
| A health endpoint for Phase D monitoring (it needs an ADR change; see section 10) | Phase D, if the owner asks |
| `docs/security-deployment.md` line 140-141 ("Phase D must route `/api/v1/public/*` to this API") | ISO-5, which changes the routing |
| Consolidating the permanent copies (groups A, C and E of 3.4.1) | Follow-up F-1, the proposed change `iso-shared-hosting`, after ISO-4 (3.4.3). Group A is under T-D1 from this change |
| Deleting the temporary duplicates (groups D and F of 3.4.1). ISO-4's plan must also keep a forwarded-headers test on the admin API if the admin keeps its forwarded-headers block, because the admin's `PublicContactTests` that cover it today go with the form routes | ISO-4, through the hand-off |
| The local `dotnet-ef` problem | The separate `e2e-local-migrations` change (ISO-1 test report, O1) |

## 5. Test plan

### 5.1 Tests written first, and what each asserts

**In `DigitalHub.Api.Tests` (commits 1 and 2):**

- **T-F1** `FormsLibraryTests.The_guard_rejects_the_authentication_and_identity_assemblies`.
  For each of `Microsoft.AspNetCore.Identity`, `Microsoft.AspNetCore.Authentication`,
  `Microsoft.AspNetCore.Authentication.BearerToken` and
  `Microsoft.AspNetCore.Authentication.Cookies`, it asserts that the name is in the
  guard's violations for `typeof(GuardCanary).Assembly`.
  - At commit 1 the violations are computed with the old `ForbiddenReferences.Contains`,
    so the test **must fail**, with `Assert.Contains() Failure` naming one of the four.
  - From commit 2 it uses `ReferenceGuard.Violations` and passes.
- The existing `The_forms_library_references_no_admin_api_identity_or_token_code` moves
  to `ReferenceGuard` and must stay green.
  `Contact_and_apply_code_lives_in_the_forms_library` is unchanged.

**In `DigitalHub.PublicApi.Tests` (commit 4):**

- **T-R1** `PublicRouteTests.Only_the_two_form_routes_are_mapped`. From
  `factory.Services.GetRequiredService<EndpointDataSource>().Endpoints`: exactly two
  endpoints, both `RouteEndpoint`. Their `RoutePattern.RawText` values are
  `api/v1/public/contact` and `api/v1/public/apply`, and each has `HttpMethodMetadata`
  of exactly `["POST"]`.
  - Red at commit 4: no controllers, so the count is 0.
- **T-R2** `PublicRouteTests.Every_other_path_and_method_returns_404`. This is the
  owner's "a test proves every other path returns 404". It sends each of `GET`, `HEAD`,
  `POST` (body `{}`, JSON), `PUT`, `PATCH`, `DELETE` and `OPTIONS` to every path below.
  It collects every mismatch and ends with `Assert.Empty(mismatches)`. A match is:
  status 404; for non-HEAD requests, content type `application/problem+json` and
  `code` `not_found`; no `Allow` header; no `Set-Cookie`.
  - The paths:
    - **Outside the API:** `/`, `/index.html`, `/health`, `/healthz`, `/metrics`,
      `/swagger`, `/swagger/index.html`, `/openapi/v1.json`, `/favicon.ico`,
      `/web.config`, `/media/x.webp`.
    - **Near the form routes:** `/api`, `/api/v1`, `/api/v1/public`,
      `/api/v1/public/`, `/api/v1/public/contact/`, `/api/v1/public/apply/`,
      `/api/v1/public/contact/1`, `/api/v1/public/apply/extra`,
      `/api/v1/public/contacts`, `/api/v1/public/applyx`,
      `/api/v1/public/contact.json`, `/api/v2/public/contact`.
    - **One concrete path for every admin route template** (from `[Route]` and
      `[Http*]` in `api/src/DigitalHub.Api/Controllers/*.cs`; `{guid}` is a fixed
      GUID):
      - auth: `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`,
        `/api/v1/auth/me`, `/api/v1/auth/change-password`
      - build: `/api/v1/build/content`
      - content (one per collection): `/api/v1/pages`, `/api/v1/services`,
        `/api/v1/partners`, `/api/v1/case-studies`, `/api/v1/blog-posts`,
        `/api/v1/vacancies`, `/api/v1/team-members`, `/api/v1/news-items`
      - content actions: `/api/v1/pages/order`, and on `/api/v1/pages/{guid}`: itself,
        `/save`, `/publish`, `/unpublish`, `/discard`, `/end`, `/sections`,
        `/sections/reorder`, `/sections/{guid}`, `/sections/{guid}/visibility`,
        `/revisions`, `/revisions/{guid}`, `/revisions/{guid}/restore`
      - media: `/api/v1/media`, `/api/v1/media/{guid}`
      - users: `/api/v1/users`, `/api/v1/users/x/role`, `/api/v1/users/x/reactivate`,
        `/api/v1/users/x/deactivate`, `/api/v1/users/x/reset-password`
      - settings and site structure: `/api/v1/settings`, `/api/v1/settings/x`,
        `/api/v1/navigation`, `/api/v1/redirects`, `/api/v1/redirects/{guid}`,
        `/api/v1/error-pages`, `/api/v1/error-pages/404`
      - audit: `/api/v1/audit`
      - contact requests: `/api/v1/contact-requests`, `/api/v1/contact-requests/new-count`,
        `/api/v1/contact-requests/{guid}`, `/api/v1/contact-requests/{guid}/handled`
      - the rest: `/api/v1/applications`, `/api/v1/schemas`, `/api/v1/rich-text/paste`
    - **Generated paths:** 50 paths of 1-5 lower-case segments from
      `new Random(20261119)`. Any that equals a form path is skipped.
  - Also, for the two form paths themselves, every method except POST, both in their
    own case and upper-cased.
  - **Positive controls in the same test.** These must **not** be 404:
    - `POST /api/v1/public/contact` with `{}` gives 400 `validation_failed`;
    - `POST /API/V1/PUBLIC/CONTACT` with `{}` gives 400;
    - `POST /api/v1/public/apply` with no form gives 400, the HTML page.
  - Red at commit 4: the positive controls are 404, and the 404s have empty bodies.
    Red at commit 5 on exactly the three groups in 3.9.
- **T-I1** `PublicApiIsolationTests.The_public_api_registers_no_authentication_scheme_or_identity`.
  A factory subclass records the final `IServiceCollection` in `ConfigureTestServices`.
  The test asserts:
  - `IAuthenticationSchemeProvider` is not registered, or `GetAllSchemesAsync()` is
    empty;
  - no descriptor's service or implementation type implements `IAuthenticationHandler`;
  - no descriptor's service or implementation type has a full name starting
    `Microsoft.AspNetCore.Identity`, `Microsoft.Extensions.Identity`,
    `Microsoft.AspNetCore.Authentication.JwtBearer`,
    `Microsoft.AspNetCore.Authentication.BearerToken` or
    `Microsoft.AspNetCore.Authentication.Cookies`;
  - the implicit `UseAuthorization` is a pass-through (3.1 step 10, R1-3):
    - if `IOptions<AuthorizationOptions>` is registered, its `FallbackPolicy` is null;
    - no endpoint in `EndpointDataSource` carries `IAuthorizeData` or
      `IAuthorizationRequirementData` metadata.

  The test tolerates MVC's authentication and authorization *core* services. It does not
  ban `Microsoft.AspNetCore.Authentication.*` service types as a whole, because
  `AddControllers` registers `IAuthenticationService` and `IAuthenticationSchemeProvider`
  in every MVC app.

  Its failing proof is that the same assertions, run over a `ServiceCollection` given
  `AddAuthentication().AddBearerToken()` inside the test, fail. That is part of the
  same test as a control: the test first asserts the control collection **is**
  rejected, then that the host's is not.
- **T-I2** `The_public_api_holds_no_signing_key`. The host's `IConfiguration` has no
  `Auth` section and `Auth:SigningKey` is null. This holds even though the test
  machine's user-secrets store contains one.
- **T-I3** `The_public_api_refuses_to_start_with_auth_settings`. A factory with
  `UseSetting("Auth:SigningKey", "x")` throws on `CreateClient()`. The exception chain
  holds the message from 3.1, step 3.
  - Red at commit 4, because the refusal arrives in commit 5.
- **T-I4** `The_public_api_refuses_to_start_without_its_connection_string`. A factory
  with `ConnectionStrings:PublicForms` set to `""` throws with
  `"ConnectionStrings:PublicForms is not configured."`.
- **T-I5** `The_public_api_starts_under_the_development_host_checks`. A factory with
  `UseEnvironment("Development")` (scope validation and `ValidateOnBuild`) starts, and
  `POST /api/v1/public/contact` `{}` returns 400. This proves there is no captive
  dependency. It also proves that no user-secrets store loads into the host in
  Development: if one did, T-I3's refusal would stop the host.
- **T-I6** `The_forms_context_maps_only_the_four_tables`. The set of
  `GetTableName()` values over `PublicFormsDbContext.Model.GetEntityTypes()` is exactly
  `{contact_requests, vacancies, site_settings, application_counts}`. No entity type has
  a navigation, and no property of `ContactRequest` has `ValueGenerated` other than
  `Never`.
- **T-I7** `The_public_api_has_no_migrations`. No type in the PublicApi assembly
  derives from `Microsoft.EntityFrameworkCore.Migrations.Migration` or `ModelSnapshot`.
- **T-G2** `PublicApiReferenceTests.The_public_api_and_forms_reference_no_admin_identity_or_token_code`
  (theory: PublicApi, Forms). `ReferenceGuard.Violations` is empty.
- **T-G3** `The_guard_reports_every_forbidden_name` (theory, 14 rows, 3.6 (b)). Each
  name is `IsForbidden`.
- **T-G4** `The_guard_reads_the_real_references_of_the_public_api`. The PublicApi
  references include `DigitalHub.Forms` and `Microsoft.EntityFrameworkCore`.
- **T-G1** (not a committed test): the transient demonstration in 3.6 (c), recorded with
  its command, exit code and output.
- **T-D1** `InfrastructureParityTests.The_shared_infrastructure_matches_the_admin_copy`
  (theory, 6 rows), and **T-D2** `The_parity_check_reports_a_difference` (its control),
  as specified in 3.4.2. They pass from commit 4. They are shown able to fail by T-D2,
  and once by hand (3.4.2), recorded in `implementation.md`.
- **T-P, the ported form suites.** Same names, same inputs and the same assertions as
  the admin tests in 2.5, with these changes:
  - the host is `PublicApiFactory`;
  - data is set up and read through `FormsDatabase`, not the admin API or
    `ContentDbContext`;
  - the silent-SMTP listener uses port `0` and passes the port it was given into
    `Email:Port`, instead of the fixed 4318;
  - the contact and apply success tests also assert no `Set-Cookie`.

  The suites:
  - `PublicContactTests`, 7 tests:
    - T-P1 `Anonymous_contact_is_stored_as_new_without_an_ip` (with no `Set-Cookie`)
    - `Honeypot_returns_success_and_stores_nothing`
    - `Validation_rejects_missing_and_oversized_fields`
    - `Rate_limit_is_ten_per_hour_per_visitor_address`
    - `Known_proxy_rate_limits_each_forwarded_visitor_separately`
    - `Forged_forwarded_for_from_a_non_proxy_is_ignored`
    - `Script_in_a_contact_message_is_stored_unchanged`

    Plus `PublicContactEmptyProxyTests.Empty_proxy_list_still_rate_limits_one_sender_when_the_forged_address_changes`.
    `New_count_returns_only_new_enquiries_for_studio` is not ported, because it is a
    Studio route.
  - `PublicApplyTests`, the 13 apply tests of `CareersTests` lines 41-387. T-P2 is
    `An_application_emails_the_cv_and_counts_once` (with no `Set-Cookie`). T-P13 is
    `A_failed_count_still_answers_with_the_page_and_does_not_resend` (elevated trigger).
    Vacancies come from `FormsDatabase.InsertVacancyAsync` with status `published`,
    `draft` or `ended`, and are deleted in `finally`.
  - `PublicBodyLimitTests`: `The_reviews_20_MB_contact_body_is_refused_and_nothing_is_stored`
    (×2) and `A_full_contact_form_under_16_KB_is_accepted`.
  - `PublicRateLimitLogTests`: `A_refused_contact_submission_logs_a_warning_without_the_message`.
    It checks the category `DigitalHub.PublicApi.RateLimit`. Also
    `The_network_drops_the_host_part` (×3), on the copied `RateLimitLog`.
  - `PublicAbortedRequestTests`: `A_client_that_disconnects_mid_body_is_not_a_server_error`
    and `A_chunked_body_that_ends_early_is_a_400_not_a_server_error`, for
    `/api/v1/public/contact` with delays 0 and 300.
  - `PublicServerHeaderTests`, on Kestrel at `IPAddress.Loopback, 0`:
    - `The_host_under_test_is_Kestrel_on_a_loopback_socket`
    - `No_server_header_on_a_success`: a valid `POST /api/v1/public/contact` returns
      201. The admin's version uses `/health`, which the public API does not have.
    - `No_server_header_on_a_problem_response`, a theory `(method, path, status)` with
      three rows: `GET /api/v1/users` → 404, `GET /api/v1/gap-12-no-such-route` → 404,
      and `POST /api/v1/public/contact {}` → 400. Each row asserts the status, the
      content type `application/problem+json`, and no `Server` header. The first two
      rows depend on the gate's problem body, so they are red until commit 6 (R1-1).
    - `No_server_header_when_Kestrel_rejects_a_malformed_request`, unchanged.

  The red and green state of every test at each commit is the table in 3.9.
  `implementation.md` quotes the failing set by name at commits 1, 4 and 5, and compares
  it with that table.

### 5.2 Red-test evidence: local Release run

The red runs use the same route as ISO-1 (route (c)): a local Release run with
`dotnet` 10.0.401, from `api/`, in the worktree, at the named commit. Before any
database run, check that no `testhost` or `vstest` process is running. Do not stop one
you did not start.

```
# commit 1
dotnet build DigitalHub.slnx -c Release
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"
#   expect exit 1: T-F1 failed, the other two passed

# commit 3 (build only; any error stops)
dotnet build DigitalHub.slnx -c Release

# commit 4
dotnet build DigitalHub.slnx -c Release
dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=c4.trx" --results-directory <S>
#   expect exit 1; failed set == the commit-4 "red" cells of the 3.9 table, by name and row
grep -o 'testName="[^"]*" [^>]*outcome="[A-Za-z]*"' <S>/c4.trx | sed -E 's/.*testName="([^"]*)".*outcome="([A-Za-z]*)"/\2 \1/' | LC_ALL=C sort

# commit 5
dotnet build DigitalHub.slnx -c Release
dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=c5.trx" --results-directory <S>
#   expect exit 1; failed set == T-R2 plus the two gate rows of No_server_header_on_a_problem_response;
#   T-R2's message lists mismatches only in G1-G3
```

The `grep`/`sed` line prints each result as `Outcome Name` (the `UnitTestResult`
attributes in the trx). Its output is quoted in `implementation.md` next to the 3.9
column, and any difference triggers the stop condition.

No CI job runs these intermediate commits: `ci.yml` triggers on `pull_request` and on
pushes to `rebuild/dotnet-platform` only. So the local runs are the red evidence. If
they cannot run, the stop condition in 3.9 applies.

### 5.3 Checks after the change (exact commands)

Run from `D:\work\DigitalHub\dh-platform-claude-iso-2\api` unless stated, in Release
only, against `DigitalHubContent_Test` only. The prerequisite is
`cd ../website && npm ci --no-audit --no-fund` (2.10). `<S>` is the session
scratchpad.

| # | Command | Expected |
|---|---|---|
| C1 | `dotnet build DigitalHub.slnx -c Release` | `0 Error(s)` and `13 Warning(s)`, all in `api/tools/DigitalHub.ContentImport` (base run `44526032412`). `grep warning` with ContentImport filtered out finds none |
| C2 | `dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=public-api-tests.trx" --results-directory <S>` | `Failed: 0`, exit 0. **This is the "Done when" suite.** `grep -o '<Counters [^>]*>'` shows `failed="0"`. The total is listed in `implementation.md` |
| C3 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=api-tests.trx" --results-directory <S>` | `Failed: 0, Passed: 579, Total: 579` (base 578 plus T-F1), exit 0 |
| C4 | `grep -o 'testName="[^"]*"' <S>/api-tests.trx \| grep -v 'The_guard_rejects_the_authentication_and_identity_assemblies' \| LC_ALL=C sort \| sha256sum` | `060c40c8e07175cf27b54e8d97beec42c23e5233015197f1e52478557c6d497c`, the base list from 2.8, so every base name passes unchanged |
| C5 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests\|FullyQualifiedName~CareersTests\|FullyQualifiedName~ApplyDedupeTests\|FullyQualifiedName~PublicContact\|FullyQualifiedName~RequestBodyLimitTests\|FullyQualifiedName~RateLimitLogTests\|FullyQualifiedName~AbortedRequestTests"` | `Failed: 0`. The admin's own form routes are untouched (ISO-4 removes them) |
| C6 | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;Encrypt=True;TrustServerCertificate=True" dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build` | `No changes have been made to the model since the last migration.`, exit 0. This is the dll route from 2.10. CI runs `dotnet tool run dotnet-ef` |
| C7 | `git ls-files api/src/DigitalHub.PublicApi \| grep -i migration`; `git diff --stat origin/rebuild/dotnet-platform...HEAD -- api/src/DigitalHub.Api/Data` | Both empty (no migration) |
| C8 | Reflection listing of `src/DigitalHub.PublicApi/bin/Release/net10.0/DigitalHub.PublicApi.dll` with the PowerShell `ReflectionOnlyLoadFrom(...).GetReferencedAssemblies()` from 2.6 | The list is quoted in full. No name is forbidden by `ReferenceGuard`. `DigitalHub.Forms` is present, and `DigitalHub.Api` is absent |
| C9 | `dotnet list src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj package --include-transitive` | Top level: EF Core SqlServer 10.0.12, Serilog.AspNetCore 10.0.0, Pkcs 9.0.21. No `Microsoft.AspNetCore.Identity.*`, `Microsoft.Extensions.Identity.*` or `Microsoft.AspNetCore.Authentication.JwtBearer`. SqlClient's Entra ID packages are expected, as in 3.6 |
| C10 | `dotnet list DigitalHub.slnx package --vulnerable --include-transitive`; then `RUNNER_TEMP=<S> sh ../.github/security/run-dotnet-audit.sh` | Each of the six projects "has no vulnerable packages"; `0 new` |
| C11 | `git diff --stat origin/rebuild/dotnet-platform...HEAD -- api/src/DigitalHub.Api api/src/DigitalHub.Forms api/src/DigitalHub.Images api/tools studio packages docs/adr docs/security-deployment.md .github/security .github/workflows/security.yml .github/workflows/codeql.yml .github/workflows/workflow-lint.yml` | Empty. Also: `git diff --stat ... -- api/tests/DigitalHub.Api.Tests` lists only `DigitalHub.Api.Tests.csproj` (+1 line), `FormsLibraryTests.cs` and `GuardCanary.cs` (new). `git diff ... -- website` is exactly the line-114 change of 3.3. `git diff ... -- ENGINEERING_STANDARDS.md` is exactly the two "Enforced by" cells of 3.2 |
| C12 | `git diff origin/rebuild/dotnet-platform...HEAD -- .github/workflows/ci.yml` | Exactly the step in 3.8, and nothing else |
| C13 | **Group A and B files** (3.4.1): for each of the eight, `diff <(sed 1,/^namespace/d api/src/DigitalHub.Api/Infrastructure/<f>.cs) <(sed 1,/^namespace/d api/src/DigitalHub.PublicApi/Infrastructure/<f>.cs)`. **Group C**: the PublicApi `Program.cs` blocks compared by eye with `Program.cs:29`, `31-37`, `85-108` and `169-203`. **Group E**: the factory helpers compared with `ApiFactory.cs:118-206` | Group A and B: no difference, except `RateLimitLog.Category`. The `using` lines above `namespace` may differ only by `DigitalHub.PublicApi.*` against `DigitalHub.Api.*`, and are quoted. Groups C and E: every difference is quoted and explained, for example the removed `media-upload` and `build-content` policies |
| C14 | `cd ../website && npx vitest run test/no-hiring-system.test.ts` | `2 passed`. With the line-114 change it applies the needle and `DbSet<` checks to all of `api/`, and the table- and column-name rule to both `Data/` folders (2.7, 3.3). As a one-off proof that the rule now reaches the folder, recorded in `implementation.md`: add `HasColumnName("cv_blob_test")` to a scratch copy of the public `Data` file in the worktree, run the test (fails, naming the file), remove it, and show `git status` clean |
| C15 | `cd ../website && npm test`; `cd ../studio && npm test` | Green. The website changes only the line-114 test helper, and the studio changes nothing. The website figures are compared with the base CI run's `website` job, not with ISO-1's numbers, because GAP-11 (and #72, if it merges first) moved them |
| C16 | `RUNNER_TEMP=<S> sh .github/security/run-semgrep.sh` (from the repo root, Semgrep 1.180.0) | `0 new` |
| C17 | gitleaks | **NOT RUN locally** (not installed, 2.10). Security job `gitleaks-pr` on the PR head. In its place: `git diff origin/rebuild/dotnet-platform...HEAD \| grep -E '^\+' \| grep -iE "password=\|pwd=\|secret\|SigningKey\|41335d15"`. It may match only the csproj `<UserSecretsId>`, `Email:Password` as an empty JSON value, and prose in the records |
| C18 | actionlint on `ci.yml` | **NOT RUN locally** unless `bash .github/lint/install-actionlint.sh` and `bash .github/lint/run-actionlint.sh workflows` work on this machine. If not: the Workflow lint job on the PR head (blocking) |
| C19 | `cd ../studio && npm run test:e2e` | **NOT RUN locally**: the harness fails at "Release migrations" (2.10), and ISO-2 changes nothing it builds. CI job `studio`, "End-to-end suite", on the PR head: `diff` of the 34 names against `ed0f1b41…848a` is empty, and `tests="34" failures="0"` |
| C20 | `gh pr list --state open`; `gh pr view <n> --json files --jq '.files[].path'` for each | No shared path except `ci.yml` with #68, which must be merged or closed before commit 7 (3.8) |

**PR-head CI, quoted before the merge:**

- CI `api`:
  - "Build (Release)": `0 Error(s)`, at most `13 Warning(s)`, or the new base's count
    after a rebase.
  - From `api-test-report`:
    - `api-tests.trx`, compared by name with the base list as in ISO-1 plan 5.2 step 2:
      `comm -23` is empty, `comm -13` is exactly the T-F1 name, and the Counters are
      `total="579" ... failed="0"`.
    - `public-api-tests.trx` is present, with `failed="0"` and the same total as C2.
- CI `studio`: the end-to-end names are unchanged (C19).
- CI `website`, `website-browser` and `section-compare`: the only difference may be
  the known `/careers/apply.html #section`.
- Security: gitleaks, Semgrep, `dotnet-vulnerable` and npm audit show 0 new.
- Workflow lint: green.

**If the base moves** before the tester's run (for example #68, #70 or #72 merging),
every baseline comes from the CI run on the new base commit:

- the integration and end-to-end name lists and their hashes;
- the warning count;
- the website figures: the `website` job's Vitest totals, `website-browser`, and the
  `section-compare` result (R1-8).

That run id and the values are quoted, as in ISO-1 gate 1, condition 4.

### 5.4 Track checklist (G2, from `docs/changes/README.md`)

| Line | How ISO-2 meets it |
|---|---|
| Follow `docs/adr/0001-split-public-forms-api.md` | Point 1: 3.1, 3.2, 3.7. Point 4: 3.3. Point 2 (the shared library) is reused, not changed. Points 3, 5 and 6 are ISO-3, ISO-4 and ISO-5 |
| ISO-1 changes no behaviour | N/A to ISO-2. Still, every base integration name passes unchanged (C3, C4), and the end-to-end names are unchanged (C19) |
| "The public API answers only the two form routes, and a test proves every other path returns 404" | T-R1 (inventory) and T-R2 (the sweep), red first (5.2) |
| The `dh_public_forms` login is proven unable to read users, roles, sessions or audit, or to change content | N/A, ISO-3. ISO-2 prepares for it: the fixtures do not read through the host's context, the contact insert does no read-back (3.3), and the connection key is separate (3.1) |
| ISO-4 merges only after ISO-5 | N/A. ISO-2 does not touch the admin API's routes |

## 6. Security impact

- **Routes.** A new process with two anonymous POST routes, the same two the admin API
  already serves, with the same limits. Every other request gets 404 (T-R2). The admin
  API's routes, policies, `[AllowAnonymous]` and role matrix are unchanged
  (`CareersTests.Authorization_matches_for_every_endpoint` is in C3). Nothing is
  deployed: there is no IIS site and no `web.config` change before ISO-5 and Phase D.
- **Policies.** The public API has no authentication and no authorization policies, by
  ADR 0001's design. S-2 ("the fallback requires an authenticated user") is the admin
  API's rule, and the accepted ADR's "fallback policy denies everything else" is its
  form here: `PublicRouteGate`, deny by default (P-5). A-2's "fails on any anonymous
  route not on the public allow-list" is met for this process by T-R1.
- **Data.** The same four tables, through a context that maps nothing else (T-I6). The
  queries match the admin's (3.3).
- **Logins.** None added. In tests the host uses the restricted `dh_content_app`
  against `DigitalHubContent_Test`, as the admin suite does, so **in ISO-2 the public
  API's login is still as wide as the admin's**. That is what ISO-3 fixes, and why
  GAP-38 stays open. The factory refuses Windows authentication and any catalog other
  than `DigitalHubContent_Test`.
- **Secrets.**
  - No new secret.
  - The public API has no `UserSecretsId`, and refuses any `Auth` setting (T-I2, T-I3,
    T-I5).
  - The test project reads the admin's user-secrets store for `ConnectionStrings:Content`
    only, through its csproj id, not a C# literal, so there is no new gitleaks finding
    (C17).
  - The CI step adds no credential. It reuses the job's workflow-only values.
- **Dependencies.** No new package id or version (3.1, 3.5). The new projects are
  covered by `dotnet-vulnerable` and CodeQL through the `.slnx` (C10, 2.8).
- **Workflows.** One `run` step, with no new action, so there is nothing to pin. It is
  linted by actionlint (C18), and ordered after #68 (3.8).

## 7. Migrations

None. `PublicFormsDbContext` maps existing tables and has no migrations (T-I7, C7).
`ContentDbContext` is untouched, and has-pending-model-changes is clean (C6). If a
migration ever seems needed, the developer stops: it is shown first and applied only
with the elevated account (`AGENTS.md`, Schema). The `dh_public_forms` grants are
ISO-3's migration.

## 8. Rollback

Revert the pull request. It deletes the two new projects, the shared guard file, the
canary and the CI step, and restores `FormsLibraryTests.cs`. There is no schema, data
or deployed configuration. The test rows the suite wrote to `DigitalHubContent_Test`
(contact requests and counts) are the same kind the admin suite already leaves there.

## 9. Owner decisions needed

None. The owner's words cover:

- the request (section 1), quoted 19 November 2026;
- "start iso 2", 19 November 2026;
- ADR 0001, "accepted", 19 November 2026.

These design choices are inside the ADR, are stricter than its wording, and change no
existing behaviour:

- non-POST methods on the form paths get 404, not 405;
- a trailing slash gets 404;
- start-up refuses `Auth` settings.

The `ci.yml` order with #68 (3.8) is a rule from `AGENTS.md`, not a decision. If #68
stalls, the pipeline waits, and the stop is reported to the owner then.

## 10. Risks

| Risk | Effect | Caught by |
|---|---|---|
| Routing or MVC adds an endpoint we did not write (for example a future package mapping one) | A route beyond the two | T-R1 fails on any extra endpoint, and T-R2 proves the gate refuses it anyway |
| The gate is too strict for a real client (for example IIS adding a trailing slash, or a virtual directory setting `PathBase`) | The forms return 404 behind the proxy | Out of reach until ISO-5. The website posts the exact path (`ApplyForm.tsx:14`). ISO-5's browser form tests run through the proxy before ISO-4 removes the admin routes (refinement plan line 270) |
| The public context drifts from the schema when an admin migration changes a mapped table | Inserts or reads fail at run time | The public suite runs in CI against the freshly migrated `DigitalHubContent_Test` (3.8), and T-P1, T-P2 and the vacancy tests touch every mapped table |
| `no-hiring-system.test.ts` rejects a new `DbSet<...>` name, or a hiring-like column name in the new model | Website CI fails | The entity names come from its allow-list (3.3). The column-name rule now reaches the public `Data/` folder (line 114), with the one-off proof in C14 |
| **"Must not drift" (group A, six files)**: a later fix to one copy misses the other, for example a new name in the redaction set or a new security header | The internet-facing process misses a security fix | T-D1, committed: any difference outside the namespace and `RateLimitLog.Category` fails CI's `api` job (3.4.2). T-D2 and a one-off edit prove it can fail |
| **"Diverge by design" (group B, two files)**: ISO-4 removes the `ApplyPage` branches from the admin copies only | None intended. The risk is an unintended difference before ISO-4 | C13 checks group B identical at ISO-2. From ISO-4 the difference is expected, and ISO-4's review owns it |
| **Permanent copies without a file-level check (groups C and E)**: the forwarded-headers rule and the test catalog guard drift | A proxy-trust or test-database guard differs between the suites | C13 at ISO-2. Until ISO-4, the ported behavioural tests on both processes. Then follow-up F-1, `iso-shared-hosting`, recorded in the hand-off and the PR body (3.4.3). ISO-4 must keep an admin forwarded-headers test if it keeps that block (4.4) |
| The measured duplication (~1,970 lines; ~990 permanent; 3.4.1) meets G-9 at step 4e | G-9 reports far over 3% | G-9 is a Gap today, so no rule is broken, and no exception (D-NNN) is claimed. The figure is measured here, group A is under T-D1, groups D and F go at ISO-4, and step 4e must cite F-1 rather than baseline groups A, C and E silently |
| MVC's `AddControllers` registers authentication and authorization core, and `WebApplication` adds the implicit `UseAuthentication` and `UseAuthorization` (3.1 step 10) | A false failure of T-I1, or an unseen gate | T-I1 checks schemes, handlers, a null `FallbackPolicy` and no endpoint authorization metadata, not the core services. If it still fails, stop and go back to the architect; the test is not loosened |
| The PublicApi assembly references an `Authentication.*` abstraction | T-G2 fails | Stop condition (3.6, 3.9). The guard is not narrowed |
| A Data Protection key-ring warning on Linux CI (FU-1) | Log-asserting tests fail | The public API uses nothing that creates keys (no authentication, cookies or antiforgery). If the warning appears, something does, and that is a finding |
| The two suites run at once against the same database (locally) | Rate-limit and count assertions interfere | CI runs them one after another in one job. Locally, one suite at a time, one agent at a time (`AGENTS.md`) |
| Shared `site_settings` state between suites | A later admin test sees changed mailboxes | The public tests restore `careers@digitalhub.test`, null, as the admin tests do (3.5) |
| Application Control blocks the new assemblies locally | No local red evidence | Stop condition (3.9). ISO-1's new assembly loaded, and the test project copies the admin test project's Web SDK shape |
| The `ci.yml` overlap with #68 | Parallel edits to one file | Commit 7 waits for #68 (3.8, C20) |
| No health endpoint for Phase D monitoring | Monitoring needs another way to probe | Out of scope. The ADR allows exactly two routes, so adding one needs an ADR change and the owner's word |
| `if: ${{ !cancelled() }}` runs the public suite after a failed build | A second, redundant failure | Accepted: both suites report, and the first failure is still the build |

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| `DigitalHub.PublicApi` exists as its own process in `api/src/`, in the solution | Refinement plan line 213; ADR 0001 point 1 | Planned | |
| It maps only `POST /api/v1/public/contact` and `POST /api/v1/public/apply` | Refinement plan line 213; ADR 0001 point 1 | Planned | |
| A test proves every other path returns 404 | Refinement plan line 213 ("Done when"); README G2 checklist | Planned | |
| Its own small DbContext maps exactly the four tables | Refinement plan line 213; ADR 0001 points 3-4 | Planned | |
| No Identity | Refinement plan line 213; ADR 0001 point 1 | Planned | |
| No signing key (none configured; start-up refuses `Auth` settings) | Refinement plan line 213; ADR 0001 point 1 | Planned | |
| No authentication, no refresh cookie, no Studio controllers | ADR 0001 point 1 | Planned | |
| The forms keep their rate limits, body limits, CV checks and email sending | ADR 0001 point 1 | Planned | |
| Its own integration suite passes against `DigitalHubContent_Test` | Refinement plan line 213 ("Done when"); ADR 0001 Consequences | Planned | |
| The suite runs in CI (job `api`, artifact `api-test-report`, `public-api-tests.trx`) | Caller's instruction; G-2 | Planned | |
| F1-1: the forms-library guard covers `Microsoft.AspNetCore.Identity` and `Microsoft.AspNetCore.Authentication*`, and the base references still pass | ISO-1 `delivery-approval.md` "F1: decision" item 1; owner's request | Planned | |
| F1-2: a canary proves the guard can fail (committed, and shown once on Forms and PublicApi) | ISO-1 `delivery-approval.md` item 2; owner's request | Planned | |
| F1-2: the guard applies to `DigitalHub.PublicApi`'s own assembly | ISO-1 `delivery-approval.md` item 2; owner's request | Planned | |
| F1-3: the plan cites the ruling and test-report F1 | ISO-1 `delivery-approval.md` item 3 | Planned | |
| Every base integration test (578, by name) still passes | README "Never weaken a gate, guard or test"; caller's boundaries | Planned | |
| Every base end-to-end test (34, by name) still passes | README G2 checklist; caller's boundaries | Planned | |
| No migration and no model change | `AGENTS.md` Schema; caller ("No migration expected") | Planned | |
| Boundaries: no `dh_public_forms` (ISO-3); admin keeps `/api/v1/public/*` and `AllowedHosts` (ISO-4); no `web.config` change (ISO-5) | Refinement plan lines 214-216; caller | Planned | |
| GAP-38, part (own API; own login still to come) | Refinement plan line 114 | Planned | |
| Every commit builds, and the failing set at commits 1, 4 and 5 equals the 3.9 table | P-4, B-6; plan review R1-1 | Planned | |
| Duplication measured, split permanent/temporary; the six "must not drift" files under T-D1; F-1 recorded in the hand-off and the PR body | Plan review R1-2; G-9 | Planned | |
| The hiring-store column rule reaches `api/src/DigitalHub.PublicApi/Data/` | Plan review R1-4 | Planned | |
| P-5 and S-2 "Enforced by" name both APIs | Plan review R1-5 | Planned | |
| The public API's `AllowedHosts` and the other ISO-3/4/5 items are in the `implementation.md` hand-off and the PR body's "Open items" | Plan review R1-7 | Planned | |

## 12. Revision log

| Round | Point raised | Answer |
|---|---|---|
| 1 | First round. No `plan-review.md`, `plan-approval.md` or `implementation.md` existed | — |
| 2 | R1-1 (Major): commit 3 did not compile (Serilog names `SensitiveDestructuringPolicy` before it existed), and neither did commit 4 (`RateLimitLog.Network`, `using ...Infrastructure`). T-I5 was wrongly listed green at commit 4. The server-header test's state at commit 5 was unclear. There was no stop rule at commit 4 | 3.9 rewritten. Commit 3 now brings all eight infrastructure copies. Commit-4 tests name only types that exist at commit 3. Every commit builds. A test-by-test, row-by-row table gives the state at commits 1-6: T-I5 is red at commit 4; `The_network_drops_the_host_part` compiles and is green at commit 4; `No_server_header_on_a_problem_response` is specified as three rows, two of which stay red until the gate in commit 6. The commit-5 mismatch groups G1-G3 are defined. Stop conditions now cover commits 1, 4 and 5 by name and row, failures at green commits, any build failure, and forbidden references. 5.2 adds the trx command that prints the outcome per test, for comparison with the table. 5.1 points to the table |
| 2 | R1-2 (Major): the duplication was undercounted, and there was no control for the copies meant to stay identical | 3.4.1 measures the whole change from `wc -l` and line ranges at `522b175`: about 1,970 lines in groups A-F, about 990 permanent and about 980 removed by ISO-4, with the 8 file counts corrected (462, `RequestBodyLimit` 112). 3.4 now separates "diverge by design" (2 files) from "must not drift" (6 files). 3.4.2 adds the committed parity test T-D1 over the six, with its control T-D2 and a one-off failing edit. 3.4.3 names follow-up F-1, `iso-shared-hosting`, for groups A, C and E after ISO-4, with its destination (the hand-off, the PR body, the tech lead to the owner), and says step 4e must cite it. C13 now covers groups B, C and E. Section 10 rows are corrected, and 4.4 updated |
| 2 | R1-3 (Minor): the implicit `UseRouting`, `UseAuthentication` and `UseAuthorization` were missing from the pipeline order | 3.1 steps 9-10 state MVC's core services and the implicit middleware, in the order they run. T-I1 now also asserts a null `FallbackPolicy` and no endpoint authorization metadata, so the implicit steps are proven pass-throughs. `UseRouting` stays implicit, as in the admin API, and the reason is given |
| 2 | R1-4 (Minor): `inModel` does not cover the new `Data/` folder | 2.7 states the gap. 3.3 and 4.2 extend line 114 of `no-hiring-system.test.ts` to `api/src/DigitalHub.PublicApi/Data/` in commit 3, a strengthening. 4.3 and C11 allow only that line under `website/`. C14 adds a one-off proof that the rule fires on the folder. #72 does not touch this file (2.9) |
| 2 | R1-5 (Minor): the alternatives to the gate were not weighed, and P-5 and S-2 named only the admin fallback | 3.2 rejects an always-failing `FallbackPolicy` with a custom `IAuthorizationMiddlewareResultHandler`, and `MapFallback` with method-mismatch handling, with reasons. Commit 7 updates only the "Enforced by" cells of P-5 and S-2, quoted before and after, with no rule text changed (4.2, C11) |
| 2 | R1-6 (Minor): no rule for when the PublicApi assembly references an `Authentication.*` abstraction | 3.6 adds the stop condition: any forbidden name on the PublicApi assembly in T-G2 or C8, `.Abstractions` and `.Core` included, sends the change back to the architect. The guard is not narrowed. Repeated in 3.9 and section 10 |
| 2 | R1-7 (Minor): the public API's `AllowedHosts` was left unowned | 4.4, and the `implementation.md` row of 4.1, require a "Hand-off" section listing it, with the other ISO-3, ISO-4 and ISO-5 items and F-1, and require it in the PR body's "Open items". Gate 2 is asked to carry it into the ISO-5 request. It is not decided here |
| 2 | R1-8 (Minor): the parallel-work list was stale | 2.9 adds #72 GAP-NEXT-UPGRADE (website `package.json` and the lockfile; no shared file). The round-2 re-check shows the base still at `522b175`. 5.3 "If the base moves" now covers the website figures, and C15 compares with the base CI run rather than ISO-1's numbers |
| 2 | Reviewer's side note: the vacancy fixture must respect the unique `slug` index | 3.5: each fixture slug is `public-api-<32 hex>` from a new GUID |

Status: Revised after plan review round 1; ready for plan review, round 2.
