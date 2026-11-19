# ISO-1: Move the contact and apply code into a DigitalHub.Forms library

- Change id: ISO-1. Branch: `change/ISO-1`, cut from `origin/rebuild/dotnet-platform`
  at `cdef7c90bf5546ecea891e9b12e2aec28d265716`. Worktree:
  `D:\work\DigitalHub\dh-platform-claude-iso-1` (all work happens there).
- Author: architect. Round 1 written; revised in round 2 after plan review round 1.
- Sources read: `docs/changes/README.md`, `AGENTS.md` (and `CLAUDE.md`),
  `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
  `docs/quality/refinement-plan-2026-10-28.md` (Track G2),
  `docs/adr/0001-split-public-forms-api.md`. All exist. No `plan-review.md`,
  `plan-approval.md` or `implementation.md` exists for ISO-1 yet, so this is
  the first round.

## 1. Item

- Closes: **ISO-1** of Track **G2, isolation** (ADR 0001, point 2). It closes
  **part of GAP-38**. GAP-38 stays open until ISO-2 and ISO-3 are done.
- Owner's request, as given on 19 November 2026: "ISO-1 move the contact and
  apply code (validation, intake, throttles, dedupe, email) into a
  DigitalHub.Forms library; no behaviour change." The owner's go-ahead was
  "Yes, start ISO-1" (19 November 2026, in reply to "Should I start ISO-1
  through /change?"). ADR 0001 status: accepted. Owner's words: "accepted"
  (19 November 2026).
- "Done when", quoted from `docs/quality/refinement-plan-2026-10-28.md`, line 212:
  > All 208 integration tests and the 22 end-to-end tests pass unchanged
- ADR 0001, point 2, quoted:
  > **Shared code moves to a library**, `DigitalHub.Forms`: the contact and
  > apply validation, `ApplicationIntake`, the throttles, dedupe and the email
  > sender. Both the public API and the tests reference it; the admin API does
  > not need it.

**The counts in "Done when" are out of date.** The suites have grown since
Phase B. On the base commit, CI run `44506830145` (CI on `cdef7c9`,
conclusion `success`) reports:

```
API — Release build, migrations, integration tests  Integration tests (Release)  Total tests: 576
API — Release build, migrations, integration tests  Integration tests (Release)       Passed: 576
Studio — typecheck, build, end-to-end  End-to-end suite  34 passed (2.6m)
```

The trx counters for that run are
`<Counters total="576" executed="576" passed="576" failed="0" ...>`. The Studio
end-to-end junit is `<testsuites ... tests="34" failures="0" skipped="0" errors="0" ...>`.

This plan reads "Done when" the strict way: **every** integration test and
**every** end-to-end test on the base passes, under the same name and the same
number of times. That means 576 and 34, which include the original 208 and 22.
The README says the stricter rule applies when two sources disagree, so this
reading needs no owner decision. Section 5 says how it is proven.

## 2. Current state

### 2.1 Where the code lives today

Everything is in one project, `api/src/DigitalHub.Api`, under the namespace
`DigitalHub.Api.Content`:

| File | Lines | What it holds | What it depends on in DigitalHub.Api |
|---|---|---|---|
| `Content/ApplicationIntake.cs` | 261 | Apply form parsing and validation, CV read, throttle, careers mailbox, dedupe, email, count MERGE with retry | `ContentDbContext` (ctor, line 13), `db.Vacancies` + `ContentStatus` (lines 62-66), `db.SiteSettings` (lines 215-222), `db.Database` raw `MERGE application_counts` (lines 224-253) |
| `Content/PublicContactStore.cs` | 125 | Contact validation, `PublicContactRequest` DTO, insert | `ContentDbContext` (ctor, line 8), `db.ContactRequests` + `ContactRequest` (lines 71-83), `ContentOutcome` (lines 26-85) |
| `Content/ApplyThrottle.cs` | 44 | Per-IP and per-email apply budgets | none (uses `IConfiguration` through Web SDK implicit usings) |
| `Content/ApplyDedupe.cs` | 73 | Two-minute dedupe of application hashes | none |
| `Content/CvFile.cs` | 85 | CV header checks, size limits, safe file name | none |
| `Content/EmailSender.cs` | 77 | `IEmailSender`, `SmtpEmailSender`, `EmailMessage`, `EmailAttachment`, `EmailDeliveryException` | none (implicit usings) |
| `Content/ApplyPage.cs` | 24 | The HTML page every apply answer uses | none (implicit usings) |
| `Program.cs` | 152-161 | The `"public-contact"` rate-limit policy (fixed window per IP, `Contact:PermitLimit`, `Contact:WindowHours`) | none |

`ContentOutcome` is in `Content/ContentStore.cs:1517` and has 156 uses across
the API, so it stays where it is.

Other API code that uses these types:

- `Controllers/PublicApplyController.cs` (lines 12, 15-17): `ApplicationIntake`, `CvFile.BodyLimit`.
- `Controllers/PublicContactController.cs` (lines 12, 23): `PublicContactStore`, `PublicContactRequest`; line 21 `[EnableRateLimiting("public-contact")]`; line 18 `BodyLimit = 16 * 1024`.
- `Infrastructure/ExceptionShieldMiddleware.cs` (lines 45-53): `ApplyPage`, `ApplicationIntake.CvRejected` and `.Rejected`.
- `Infrastructure/RequestBodyLimit.cs` (lines 61-62): `ApplyPage`, `ApplicationIntake.CvRejected`.
- `Program.cs`: lines 78-82 (DI registrations), 126-131 (the `"public-contact"` title in `OnRejected`), 152-161 (the policy), 191-197 (`ApplyPage` and `ApplicationIntake.Rejected` in `InvalidModelStateResponseFactory`).

Nothing else in the API uses `IEmailSender`. The only uses are in `Program.cs`
and `ApplicationIntake`. This matches the ADR's note that the admin API will
not need the library once ISO-4 lands.

### 2.2 Projects and solution

`api/DigitalHub.slnx` lists `src/DigitalHub.Api`, `tests/DigitalHub.Api.Tests`
and `tools/DigitalHub.ContentImport`. `src/DigitalHub.Images` is not in the
solution file. It is built as a project reference, using `Microsoft.NET.Sdk`
with `CETCompat`. That project shows a class library loads under this
machine's Application Control. The comments in the test project and the
importer say a class-library *test* assembly and a console-SDK assembly are
blocked, which is why those two use the Web SDK.

`DigitalHub.Api.csproj` pins `System.Security.Cryptography.Pkcs` 9.0.21,
because SqlClient 6.1.6 pulls in 9.0.11 (GHSA-846f-f764-76mx). Current tree:

```
$ dotnet list src/DigitalHub.Api/DigitalHub.Api.csproj package --include-transitive
   > Microsoft.EntityFrameworkCore.SqlServer      10.0.12     10.0.12
   > System.Security.Cryptography.Pkcs            9.0.21      9.0.21
   > Microsoft.Data.SqlClient                     6.1.6
   > Microsoft.EntityFrameworkCore.Relational     10.0.12
$ dotnet list DigitalHub.slnx package --vulnerable --include-transitive
The given project `DigitalHub.Api` has no vulnerable packages given the current sources.
The given project `DigitalHub.Api.Tests` has no vulnerable packages given the current sources.
The given project `DigitalHub.ContentImport` has no vulnerable packages given the current sources.
```

### 2.3 Tests that touch the forms

- `CareersTests.cs` (16 results) uses `CvFile`, `ApplyDedupe`, `IEmailSender`,
  `EmailMessage` and `EmailDeliveryException` through `using DigitalHub.Api.Content;`
  (line 8). Its factories (`RecordingApplyFactory` and others, lines 710-780)
  replace `IEmailSender` and `TimeProvider` and set `Apply:*` and `Email:*`.
  `ApplyDedupeTests` (line 783 on) builds `new ApplyDedupe(clock)` directly.
- `PublicContactTests.cs` (8), `PublicContactEmptyProxyTests` (1),
  `RequestBodyLimitTests.cs` (11), `RateLimitLogTests.cs` (5; line 60 asserts
  `"public-contact"` is in the log line), `AbortedRequestTests.cs` (6),
  `BuildContentTests.cs`: these use the routes over HTTP and none of the moved
  type names. A grep of `api/tests` for the moved names finds them only in
  `CareersTests.cs`.
- `PageQueryBindingTests.cs:38` filters actions by
  `ControllerTypeInfo.Assembly == typeof(PageQuery).Assembly`. The controllers
  therefore stay in `DigitalHub.Api`.
- Studio end-to-end: `studio/e2e/studio.spec.ts:138` ("10.19 a script in a
  contact message is stored and shown as text") and `studio/e2e/paging.spec.ts`
  POST to `/api/v1/public/contact` on the real API.
- Website: `website/test/no-hiring-system.test.ts` scans `api/` for `DbSet<T>`
  types outside an allow-list (lines 40-60, 142-146). It also reads
  `api/src/DigitalHub.Api/Controllers/PublicApplyController.cs` (line 158) and
  expects `api/v1/public/apply` in it. So the controller must stay at that path,
  and `DigitalHub.Forms` must declare no `DbSet`.

### 2.4 Logging configuration

`appsettings.json` sets `Serilog:MinimumLevel:Default = Information`, with
overrides only for `Microsoft.AspNetCore` and `Microsoft.EntityFrameworkCore`.
There is no override for `DigitalHub.*`. The console template in `Program.cs:36`
does not print `SourceContext`. No test asserts on `SourceContext`: a grep of
`api/tests` for `SourceContext` and for `DigitalHub.Api.Content.` returns nothing.

### 2.5 Security baselines that name paths

`.github/security/known-findings.json` lists Semgrep findings by `path:line`,
for `ImageFiles.cs`, `Catalog.cs` and `AuditRollbackTests.cs`. None of them is
in a file this change moves.

### 2.6 Base test inventory (the "before" lists)

From the base CI run `44506830145`, artifacts `api-test-report` and
`studio-e2e-report`:

| List | Lines | sha256 of the sorted list |
|---|---|---|
| `grep -o 'testName="[^"]*"' api-tests.trx \| sort` | 576 | `3034a709d4df3caaf2d0d95edb6e60b20965d28e35e7a995e81ad2d75a3b7a94` |
| `grep -o '<testcase name="[^"]*"' e2e-junit.xml \| sort` | 34 | `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a` |

The trx holds 560 distinct names for 576 results. Long theory arguments are
cut off with `···`. That is why the comparison keeps duplicates (`sort`, not
`sort -u`).

### 2.7 Local end-to-end harness

`studio/e2e/start-api.ts:46` names the stage `"Release migrations"` and throws
`"Could not apply migrations to DigitalHubContent_E2e."` (line 53). The ADM-05
test report (`docs/changes/ADM-05/test-report.md:481`) records it as failing
locally, with CI job `studio`, "End-to-end suite", as the evidence. ISO-1 takes
the same route (section 5.4).

### 2.8 Parallel work

| PR or branch | Files | Overlap with ISO-1 |
|---|---|---|
| #68 GAP-09 (`change/GAP-09`) | `.github/security/security.expected.yml`, `.github/security/semgrep-job.expected.yml`, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/security.yml`, `docs/changes/GAP-09/*` | None. ISO-1 changes no workflow and no `.github/` file |
| #69 GAP-11 (`change/GAP-11`) | `website/scripts/check-output.ts`, `website/src/design/Design.tsx`, `website/src/design/sets.ts`, `website/test/design.test.ts`, `website/test/output.test.ts`, `docs/changes/GAP-11/*` | None. ISO-1 changes no `website/` file |
| #70 ADM-12 (`change/ADM-12`) | `api/src/DigitalHub.Api/Content/MediaLibrary.cs`, `api/src/DigitalHub.Api/Content/MediaUsage.cs`, `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs`, `studio/src/pages/MediaLibraryPage.tsx`, `studio/test/mediaLibrary.test.tsx`, `docs/changes/ADM-12/*` | None. Different files in the same folder; git handles that |
| #60 diag (do not merge) | not relevant | none |
| `change/ADM-07c` (no PR) | `studio/e2e/redirects.spec.ts`, `docs/changes/ADM-07c/*` | None |
| `change/GAP-34` (no PR) | `.claude/commands/change.md`, `AGENTS.md`, `CLAUDE.md`, `docs/changes/README.md`, `website/README.md`, `docs/changes/GAP-34/*` | None |

Before review, the developer re-runs
`gh pr view <n> --json files --jq '.files[].path'` for each open PR. Any new
overlap goes back to the architect.

## 3. Design

### 3.1 The library

There is a new project, `api/src/DigitalHub.Forms/DigitalHub.Forms.csproj`:

- `Sdk="Microsoft.NET.Sdk"`, `net10.0`, `Nullable` and `ImplicitUsings` enabled,
  and `CETCompat` true. This is the same shape as `DigitalHub.Images`.
- `<FrameworkReference Include="Microsoft.AspNetCore.App" />`. The code uses
  `HttpRequest`, `IFormCollection`, `IResult`, `Results`, `StatusCodes`,
  `IConfiguration`, `ILogger<T>`, `IServiceCollection` and
  `System.Threading.RateLimiting`.
- `<Using>` items for the namespaces the Web SDK imports implicitly:
  `Microsoft.AspNetCore.Http`, `Microsoft.Extensions.Configuration`,
  `Microsoft.Extensions.DependencyInjection` and `Microsoft.Extensions.Logging`.
  With these, the moved files need no change other than their `namespace` line.
  This keeps `git diff -M` showing them as renames.
- `PackageReference` `Microsoft.EntityFrameworkCore.SqlServer` 10.0.12, the
  same version the API uses. It is needed for the count `MERGE` (see 3.3). The
  library also gets `System.Security.Cryptography.Pkcs` 9.0.21, the same pin
  with the same comment as `DigitalHub.Api.csproj`. Without it,
  `dotnet list DigitalHub.slnx package --vulnerable` would report 9.0.11 for
  the new project. No new package id enters the repository.
- No reference to `DigitalHub.Api` or `DigitalHub.Images`, and no Identity, JWT
  or authentication package. This follows the ADR: "no Identity, no JWT signing
  key". It is tested (5.1).
- Namespace: `DigitalHub.Forms`. Type names stay the same.

`DigitalHub.Api.csproj` and `DigitalHub.Api.Tests.csproj` get a
`ProjectReference` to it. The ADR says "Both the public API and the tests
reference it". The admin API needs the reference only until ISO-4 removes its
`/public/` routes. The project is added to `DigitalHub.slnx` under `/src/`.
`dotnet build DigitalHub.slnx` (CI `api` job) and
`dotnet list DigitalHub.slnx package --vulnerable` (Security `dotnet-vulnerable`
job) then build and audit it directly, not only as a transitive reference.

### 3.2 What moves, and how

**Pure renames.** `git mv`, then the `namespace DigitalHub.Api.Content;` line
becomes `namespace DigitalHub.Forms;`. No other change.

| From `api/src/DigitalHub.Api/Content/` | To `api/src/DigitalHub.Forms/` |
|---|---|
| `ApplyDedupe.cs` | `ApplyDedupe.cs` |
| `ApplyThrottle.cs` | `ApplyThrottle.cs` |
| `ApplyPage.cs` | `ApplyPage.cs` |
| `CvFile.cs` | `CvFile.cs` |
| `EmailSender.cs` | `EmailSender.cs` |

**Moves with a change** (the change in commit 3, in place; the move in commit 4, as a pure rename; see 3.5). These two depend on `ContentDbContext` and on entity
types that must stay in the API (see 3.4).

| From | To | Change |
|---|---|---|
| `Content/ApplicationIntake.cs` | `DigitalHub.Forms/ApplicationIntake.cs` | The constructor takes `IFormsData data` in place of `ContentDbContext db`. The vacancy lookup (lines 62-66) becomes `var vacancy = await data.FindVacancyAsync(parsed, cancellationToken); if (vacancy is null \|\| !vacancy.Published) return Problem(...closed...)`; the rest of the block is unchanged. In `CareersAddressAsync`, `db.SiteSettings...FirstOrDefaultAsync` becomes `await data.MailboxesAsync(cancellationToken)`; the trim and fallback lines stay as they are. `IncrementAsync` and `CountFailed` move to `ApplicationCountSql` (3.3); the call site becomes `data.IncrementApplicationCountAsync(...)`, and the filter becomes `when (ApplicationCountSql.CountFailed(exception))`. The `using`s for `DigitalHub.Api.Data`, SqlClient and EF go. Validation, order of checks, status codes, codes, messages, hashing, the dedupe gate and the log lines are byte-identical. |
| `Content/PublicContactStore.cs` (and `PublicContactRequest`) | `DigitalHub.Forms/PublicContactStore.cs` | The constructor takes `IFormsData data`. `ContentOutcome` becomes `FormOutcome` (3.3). The `db.ContactRequests.Add(new ContactRequest{...}); await db.SaveChangesAsync(...)` call becomes `await data.AddContactRequestAsync(new ContactSubmission(Guid.NewGuid(), name, organization, role, email, situation, message, "new", DateTime.UtcNow), cancellationToken)`. Validation and messages are byte-identical. |

**Moved out of `Program.cs`.** In Forms, `ContactRateLimit.cs` holds
`public const string PolicyName = "public-contact";` and
`public static RateLimitPartition<string> Partition(HttpContext httpContext, int permitLimit, int windowHours)`.
The body is the lambda from `Program.cs:152-161`, unchanged: partition key
`"contact\n" + ip`, fixed window, `QueueLimit = 0`. The configuration reads
(`Contact:PermitLimit`, `Contact:WindowHours`, `Program.cs:115-116`) stay in
`Program.cs`. They run at the same point, with the same defaults.

### 3.3 New types in DigitalHub.Forms

The signatures below are part of the plan:

```csharp
// IFormsData.cs — the four tables the forms touch (ADR 0001 point 3), behind one port.
public interface IFormsData
{
    Task AddContactRequestAsync(ContactSubmission submission, CancellationToken cancellationToken);
    Task<FormsVacancy?> FindVacancyAsync(Guid id, CancellationToken cancellationToken);
    Task<FormsMailboxes?> MailboxesAsync(CancellationToken cancellationToken);
    Task IncrementApplicationCountAsync(Guid? vacancyId, DateOnly day, CancellationToken cancellationToken);
}

public sealed record ContactSubmission(Guid Id, string Name, string Organization, string? Role,
    string Email, string Situation, string Message, string Status, DateTime CreatedAt);
public sealed record FormsVacancy(Guid Id, string Title, bool Published);
public sealed record FormsMailboxes(string? CareersEmail, string? Email);

// FormOutcome.cs — the contact store's result; same members the controller reads today.
public sealed class FormOutcome
{
    public object? Body { get; init; }
    public int Status { get; init; }
    public string? Code { get; init; }
    public string? Title { get; init; }
    public IDictionary<string, string[]>? Errors { get; init; }
    public static FormOutcome Ok(object body, int status = StatusCodes.Status200OK);
    public static FormOutcome Fail(int status, string code, string title, IDictionary<string, string[]>? errors = null);
}

// ApplicationCountSql.cs — today's IncrementAsync (lines 224-253) and CountFailed (255-256), verbatim,
// with db.Database replaced by the parameter. The MERGE text stays a constant raw literal.
public static class ApplicationCountSql
{
    public static Task IncrementAsync(DatabaseFacade database, Guid? vacancyId, DateOnly day, CancellationToken cancellationToken);
    public static bool CountFailed(Exception exception);
}

// FormsServiceCollectionExtensions.cs — the five registrations from Program.cs:78-82, same lifetimes.
public static IServiceCollection AddDigitalHubForms(this IServiceCollection services)
// PublicContactStore scoped, ApplicationIntake scoped, ApplyThrottle singleton,
// ApplyDedupe singleton, IEmailSender -> SmtpEmailSender singleton.
```

In the API, a new file `api/src/DigitalHub.Api/Content/ContentFormsData.cs`
holds `public sealed class ContentFormsData(ContentDbContext db) : IFormsData`.
It runs the same EF queries as today:

- `AddContactRequestAsync` maps to `ContactRequest`, then `db.ContactRequests.Add` and `db.SaveChangesAsync`.
- `FindVacancyAsync` runs `db.Vacancies.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, ...)`. This is the same full-entity query as today, not a projection. It returns `new FormsVacancy(v.Id, v.Title, v.Status == ContentStatus.Published)` or `null`.
- `MailboxesAsync` runs `db.SiteSettings.AsNoTracking().OrderBy(item => item.Id).FirstOrDefaultAsync(...)` and returns `new FormsMailboxes(s.CareersEmail, s.Email)` or `null`.
- `IncrementApplicationCountAsync` runs `ApplicationCountSql.IncrementAsync(db.Database, ...)`.

`Program.cs` replaces lines 78-82 with `builder.Services.AddDigitalHubForms();`
and `builder.Services.AddScoped<IFormsData, ContentFormsData>();`, in the same
place. `TimeProvider` stays registered at line 70. The `"public-contact"`
literals at lines 129 and 152 become `ContactRateLimit.PolicyName`, and the
policy body becomes `ContactRateLimit.Partition(httpContext, contactPermitLimit, contactWindowHours)`.
`PublicContactController` uses `[EnableRateLimiting(ContactRateLimit.PolicyName)]`.
Its body already uses `var outcome`, so no other line changes.

The scoped `ContentFormsData` gets the same scoped `ContentDbContext` that
`ApplicationIntake` used to get directly. The `Serializable` transaction and
the `MERGE` therefore run on the same connection and in the same scope as today.

### 3.4 Alternatives rejected

1. **Move the entity classes (`ContactRequest`, `Vacancy`, `SiteSettings`,
   `ApplicationCount`, `ContentStatus`) or `ContentDbContext` into the library.**
   Rejected. The model snapshot names entity types by their CLR name
   (`DigitalHub.Api.Data.*`), so a namespace move is a model change. It risks a
   migration, and it touches `Data/`, which `no-hiring-system.test.ts` and the
   migration checks watch. ISO-2 builds the public API's own small DbContext
   over the four tables (ADR point 4). That is the right place for data types
   that belong to the forms.
2. **Keep the namespace `DigitalHub.Api.Content` in the new assembly**, so no
   test needs a `using`. Rejected. The namespace would lie about the boundary,
   and ISO-2's `DigitalHub.PublicApi` would import `DigitalHub.Api.*`. That
   makes "the public API uses nothing from the admin API" impossible to check
   with a grep.
3. **Add `using DigitalHub.Forms;` to `CareersTests.cs`.** Rejected in favour of
   one `<Using Include="DigitalHub.Forms" />` in the test `.csproj`. This keeps
   every existing test `.cs` file byte-identical, which is the plainest proof of
   "unchanged". The test project already uses this mechanism for `Xunit`. No
   moved type name collides with a type in a namespace the tests import (grep
   of `api/src api/tests api/tools` for the new type names: no match). Types in
   `DigitalHub.Api.Tests` win over imported ones in any case.
4. **Keep the count `MERGE` in the API's adapter, so Forms needs no EF.**
   Rejected. ISO-2 would then have to write the `MERGE`, its retry and the
   `CountFailed` classification a second time. Those decide the
   "201 even when the count fails" behaviour. One copy in Forms, taking a
   `DatabaseFacade`, serves both contexts. The cost is the EF Core SqlServer
   reference and the Pkcs pin in Forms. Both are existing packages at existing
   versions.
5. **Move the controllers, `RequestBodyLimit`, `ExceptionShieldMiddleware` and
   `ProblemResults` too.** Rejected for ISO-1. The controllers must stay in
   `DigitalHub.Api` (`PageQueryBindingTests.cs:38`, `no-hiring-system.test.ts:158`).
   The middleware is shared by every admin route. ISO-2 decides what the public
   API's own pipeline holds.
6. **Keep the logger category names** (`DigitalHub.Api.Content.ApplicationIntake`
   and `DigitalHub.Api.Content.SmtpEmailSender`) by creating the loggers by name.
   Rejected. The types move, so `ILogger<T>` names them in `DigitalHub.Forms`,
   as the accepted ADR implies. Message text, level and the points where they
   are logged are unchanged. No level override names `DigitalHub.*`, the console
   template does not print `SourceContext`, nothing is deployed (Phase D), and
   no test or tool reads it (2.4). The change is recorded here and in Risks, so
   the reviewer can weigh it.

### 3.5 Order of commits

This follows B-6 (a pure rename is its own commit) and P-4 (failing test first).
The rule is that content changes and renames never share a commit. Every
commit builds.

1. **`ISO-1: Add the forms-library tests (red)`.** Adds only
   `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs`. It compiles on the
   base through the existing `using DigitalHub.Api.Content;` in the file. Both
   tests fail (5.1).
2. **`ISO-1: Add the DigitalHub.Forms project and its new types`.**
   - The csproj (3.1), the `DigitalHub.slnx` entry, and the `ProjectReference`
     in `DigitalHub.Api.csproj` and `DigitalHub.Api.Tests.csproj`.
   - The new types that need nothing from `DigitalHub.Api`: `IFormsData.cs`
     (the port and its three records), `FormOutcome.cs`, `ApplicationCountSql.cs`
     and `ContactRateLimit.cs`.
   - `ApplicationCountSql` is a copy of today's `IncrementAsync` and
     `CountFailed`. The originals stay in `ApplicationIntake` until commit 3,
     so nothing calls the copy yet.
   - `FormsServiceCollectionExtensions.cs` is **not** added here, because the
     types it registers are still in `DigitalHub.Api`, which Forms must not
     reference.
   - The namespace `DigitalHub.Forms` exists from this commit on.
   - Builds. The red tests stay red.
3. **`ISO-1: Put contact and apply intake behind IFormsData`.** This is a
   content change with no rename. The files stay in
   `api/src/DigitalHub.Api/Content/` under `namespace DigitalHub.Api.Content`.
   - `ApplicationIntake.cs` and `PublicContactStore.cs` get the changes in 3.2:
     the port, `FormOutcome`, and the call to `ApplicationCountSql`.
     `ApplicationIntake`'s own `IncrementAsync` and `CountFailed` are deleted, so
     the diff shows them leaving. Reviewers compare those deleted lines with
     `ApplicationCountSql.cs` from commit 2.
   - Each of the two files gets `using DigitalHub.Forms;`.
   - Adds `api/src/DigitalHub.Api/Content/ContentFormsData.cs`.
   - In `Program.cs`: add `using DigitalHub.Forms;`, add
     `builder.Services.AddScoped<IFormsData, ContentFormsData>();` after line 82,
     and change the `"public-contact"` literals and the policy body to use
     `ContactRateLimit` (3.3).
   - In `PublicContactController.cs`: add `using DigitalHub.Forms;` and
     `[EnableRateLimiting(ContactRateLimit.PolicyName)]`.
   - Builds. Everything is green except the two red tests.
4. **`ISO-1: Move the contact and apply code to DigitalHub.Forms (rename)`.**
   This is a pure rename.
   - `git mv` of all seven files in 3.2 (the five helpers, `ApplicationIntake.cs`
     and `PublicContactStore.cs`). In each moved file, the only change is
     `namespace DigitalHub.Api.Content;` becoming `namespace DigitalHub.Forms;`.
   - The consumers change their imports, as 4.3 says: `using DigitalHub.Api.Content;`
     becomes `using DigitalHub.Forms;` in `PublicApplyController.cs`,
     `ExceptionShieldMiddleware.cs` and `RequestBodyLimit.cs`. In
     `PublicContactController.cs`, the now-empty `using DigitalHub.Api.Content;`
     is removed.
   - `<Using Include="DigitalHub.Forms" />` goes into the test csproj, because
     `CareersTests.cs` needs it from this commit on.
   - The `using DigitalHub.Forms;` that commit 3 put in `ApplicationIntake.cs`
     and `PublicContactStore.cs` is now redundant. It stays until commit 5, so
     that the moved files change by the namespace line only. A redundant using
     is not a compiler warning (CS8019 is hidden), so C1 is unaffected.
   - Builds. All green: both new tests pass from here on.
5. **`ISO-1: Register the forms services in one place, and name the library`.**
   - Adds `api/src/DigitalHub.Forms/FormsServiceCollectionExtensions.cs` with
     `AddDigitalHubForms` (3.3), filled in now that every type it registers is
     in Forms.
   - `Program.cs` lines 78-82 become `builder.Services.AddDigitalHubForms();`.
     The `IFormsData` registration from commit 3 stays next to it.
   - Removes the redundant `using DigitalHub.Forms;` from the two moved files.
   - Adds the line to `api/README.md` and writes
     `docs/changes/ISO-1/implementation.md`.

Each commit has the attribution trailer (B-4). `implementation.md` repeats the
logger category change (3.4, point 6), giving the new categories
`DigitalHub.Forms.ApplicationIntake` and `DigitalHub.Forms.SmtpEmailSender`, so
that ISO-2 and Phase D know them. This was the reviewer's request in round 1.

## 4. Scope

### 4.1 Create

| File | What |
|---|---|
| `api/src/DigitalHub.Forms/DigitalHub.Forms.csproj` | Library project (3.1) |
| `api/src/DigitalHub.Forms/IFormsData.cs` | Port and its three records (3.3) |
| `api/src/DigitalHub.Forms/FormOutcome.cs` | Contact outcome (3.3) |
| `api/src/DigitalHub.Forms/ApplicationCountSql.cs` | `MERGE` and retry, `CountFailed`, moved verbatim from `ApplicationIntake` (3.3) |
| `api/src/DigitalHub.Forms/ContactRateLimit.cs` | Policy name and partition, moved from `Program.cs` (3.2) |
| `api/src/DigitalHub.Forms/FormsServiceCollectionExtensions.cs` | `AddDigitalHubForms` (3.3) |
| `api/src/DigitalHub.Api/Content/ContentFormsData.cs` | `IFormsData` over `ContentDbContext` (3.3) |
| `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs` | The two new tests (5.1) |
| `docs/changes/ISO-1/implementation.md` | Developer's record |

### 4.2 Move (git mv)

The seven files in 3.2, from `api/src/DigitalHub.Api/Content/` to `api/src/DigitalHub.Forms/`.

### 4.3 Change

| File | What changes |
|---|---|
| `api/DigitalHub.slnx` | Add `src/DigitalHub.Forms/DigitalHub.Forms.csproj` under `/src/` |
| `api/src/DigitalHub.Api/DigitalHub.Api.csproj` | `ProjectReference` to Forms |
| `api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj` | `ProjectReference` to Forms, and `<Using Include="DigitalHub.Forms" />` |
| `api/src/DigitalHub.Api/Program.cs` | `using DigitalHub.Forms;` is added. `using DigitalHub.Api.Content;` stays, because `ContentStore`, `MediaLibrary` and others still need it. Lines 78-82 become `AddDigitalHubForms()` plus the `IFormsData` registration. The `"public-contact"` literals and the policy body use `ContactRateLimit` |
| `api/src/DigitalHub.Api/Controllers/PublicApplyController.cs` | Line 1, `using DigitalHub.Api.Content;`, becomes `using DigitalHub.Forms;`. The file used that namespace only for `ApplicationIntake` and `CvFile`. The route string stays |
| `api/src/DigitalHub.Api/Controllers/PublicContactController.cs` | Commit 3 adds `using DigitalHub.Forms;` and `[EnableRateLimiting(ContactRateLimit.PolicyName)]`. Commit 4 removes line 1, `using DigitalHub.Api.Content;`, which by then imports nothing (it was there for `PublicContactStore` and `PublicContactRequest`) |
| `api/src/DigitalHub.Api/Infrastructure/ExceptionShieldMiddleware.cs` | Line 1, `using DigitalHub.Api.Content;`, becomes `using DigitalHub.Forms;`. The file used that namespace only for `ApplyPage` and `ApplicationIntake` |
| `api/src/DigitalHub.Api/Infrastructure/RequestBodyLimit.cs` | Line 1, `using DigitalHub.Api.Content;`, becomes `using DigitalHub.Forms;`. Same reason as the middleware |
| `api/README.md` | Line 3 names `src/DigitalHub.Forms` (contact and apply code, ADR 0001) next to `src/DigitalHub.Api` |

No existing test `.cs` file changes. No file under `studio/`, `website/`,
`.github/` or `api/src/DigitalHub.Api/Data/` changes.

### 4.4 Out of scope, and where each item goes

| Left alone | Why | Destination |
|---|---|---|
| `DigitalHub.PublicApi` project, its DbContext, its own controllers and pipeline | New process, not a move | ISO-2 |
| `dh_public_forms` login and grants (a migration) | New login | ISO-3 |
| Removing `/api/v1/public/*` from the admin API, `AllowedHosts`, and dropping the API's reference to Forms | Route change | ISO-4 |
| Website `web.config` proxy rule | Website change | ISO-5 |
| Allow-list, exposure test | Needs servers | ISO-6, Phase D |
| `PublicApplyController`, `PublicContactController` (beyond `using`s and the policy constant), the contact `BodyLimit` constant (`PublicContactController.cs:18`) | The controllers stay so `PageQueryBindingTests` and `no-hiring-system.test.ts` are unchanged | ISO-2 decides the public API's copy; ISO-4 deletes these |
| `RequestBodyLimit`, `ExceptionShieldMiddleware`, `ProblemResults`, `DuplicateJsonFieldGuard`, forwarded headers, `OnRejected` and `RateLimitLog` | Shared by every admin route | ISO-2 |
| `ContentOutcome`, entity classes, `ContentDbContext`, migrations | See 3.4 (1) | ISO-2 (own context) |
| The local end-to-end harness failing at "Release migrations" (`studio/e2e/start-api.ts:46-53`) | Not caused by ISO-1, and `studio/e2e/` must stay unchanged here | A separate change, proposed id `e2e-local-migrations`, for the owner to schedule |
| `docs/security-deployment.md` | Nothing about deployment changes until ISO-2 and ISO-3 | ISO-2 and ISO-3 |

This is one topic (B-8) and fits one pull request. No split is needed.

## 5. Test plan

All .NET commands run in Release (`AGENTS.md`, Environment). They run from
`D:\work\DigitalHub\dh-platform-claude-iso-1\api` unless stated. Local runs use
port 42xx only and the `DigitalHubContent_Test` database only.

### 5.1 Failing tests written first

The new file is `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs`, with
`namespace DigitalHub.Api.Tests` and `using DigitalHub.Api.Content;`. It has no
fixture and needs no database.

| Test | Asserts | On the base (red) | After ISO-1 |
|---|---|---|---|
| `FormsLibraryTests.Contact_and_apply_code_lives_in_the_forms_library` | For each of `ApplicationIntake`, `PublicContactStore`, `PublicContactRequest`, `ApplyThrottle`, `ApplyDedupe`, `CvFile`, `ApplyPage`, `IEmailSender`, `SmtpEmailSender`, `EmailMessage`, `EmailAttachment` and `EmailDeliveryException`: `Assert.Equal("DigitalHub.Forms", type.Assembly.GetName().Name)` | Fails: `DigitalHub.Api` | Passes |
| `FormsLibraryTests.The_forms_library_references_no_admin_api_identity_or_token_code` | `typeof(ApplicationIntake).Assembly.GetReferencedAssemblies()` names none of `DigitalHub.Api`, `DigitalHub.Images`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `Microsoft.Extensions.Identity.Core`, `Microsoft.Extensions.Identity.Stores`, `Microsoft.IdentityModel.Tokens` or `System.IdentityModel.Tokens.Jwt` | Fails: the API assembly references `DigitalHub.Images`, JwtBearer and Identity | Passes |

**How the red result is evidenced.** This uses routes (c) and (b) from the
round-1 review, in that order. Route (a), a red-only branch pushed for CI, is
not used.

On this machine, .NET verification normally cannot run locally. The `ci.yml`
header (lines 3-5) says so, `docs/PROJECT_PROFILE.md` (Local constraints) says
so, and ADM-04 and ADM-05 both recorded `dotnet test` as NOT RUN. CI runs only on
a pull request or on a push to `rebuild/dotnet-platform` (`ci.yml` lines 13-18).
The pull request opens only after gate 2 and is tested at its head, so no CI run
ever tests commit 1 alone. A red-only branch pushed before gate 2 would need the
owner's words, as ADM-04 had them, and ISO-1 does not have them.

1. **(c) A local Release run, tried first, on commit 1.** The developer quotes
   the command, its exit code and the output lines:
   ```
   cd D:\work\DigitalHub\dh-platform-claude-iso-1\api
   dotnet build DigitalHub.slnx -c Release
   dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"
   ```
   Expected: exit 1, `Failed: 2`. Each failure message names
   `DigitalHub.Api` (test 1), or the first forbidden reference found (test 2).
2. **(b) If (c) cannot run,** whether the build or the test host is blocked,
   the red result is written **NOT RUN**, with the quoted error as the reason.
   The developer records this static reading of why each test fails at commit 1.
   The tester checks it on the same commit with read-only commands:
   - **Test 1.** At commit 1, all twelve types are declared in
     `api/src/DigitalHub.Api/Content/*.cs`, which compiles into
     `DigitalHub.Api.csproj`. That csproj sets no `<AssemblyName>`
     (`grep -n AssemblyName api/src/DigitalHub.Api/DigitalHub.Api.csproj`:
     no match), so the assembly name is the project name, `DigitalHub.Api`, and
     `Assert.Equal("DigitalHub.Forms", ...)` fails on the first type.
   - **Test 2.** At commit 1, `typeof(ApplicationIntake).Assembly` is
     `DigitalHub.Api`. Its metadata references the assemblies its code uses:
     - `DigitalHub.Images`: `Content/MediaLibrary.cs` and
       `Controllers/MediaController.cs` use it.
     - `System.IdentityModel.Tokens.Jwt`: `JwtSecurityTokenHandler`,
       `Auth/TokenService.cs:238`.
     - `Microsoft.AspNetCore.Authentication.JwtBearer`: `AddJwtBearer`,
       `Program.cs:216`.
     - `Microsoft.Extensions.Identity.Stores` and `Microsoft.Extensions.Identity.Core`:
       `IdentityUser` (`Data/ApplicationUser.cs:5`) and `AddIdentityCore`
       (`Program.cs:61`).

     Every one of these is on the test's forbidden list, so `Assert.DoesNotContain`
     fails.
3. **Green evidence.** If (c) runs, the same command on commit 4 and on HEAD
   must exit 0 with `Passed: 2`. In every case, the PR head's CI `api` job is
   the authority: its `api-tests.trx` (artifact `api-test-report`) lists both
   `DigitalHub.Api.Tests.FormsLibraryTests.*` names with `outcome="Passed"`
   (5.2 step 2, `comm -13`). The tester quotes the run id.

Tech-lead gate 1 decides whether (b) is enough when (c) cannot run, as the
reviewer noted. Section 9 records that no owner question is raised for route (a).

### 5.2 "Unchanged", proven three ways

1. **No existing test source changed.**
   ```
   git diff --stat cdef7c90bf5546ecea891e9b12e2aec28d265716..HEAD -- api/tests studio website
   ```
   This must list exactly `api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj`
   and `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs` (new). Also:
   `git diff cdef7c9..HEAD -- api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj`
   shows only the added `ProjectReference` and `Using`.
Steps 2 and 3 run in Git Bash, from a scratch folder `<S>`. `<run>` is the PR
head's CI run id. Every `sort` is `LC_ALL=C sort`, so the order, and with it
the hashes, does not depend on the locale. I re-ran both base hashes with
`LC_ALL=C` and got the same values as section 2.6. The artifact layouts were
checked on run `44506830145`: `api-test-report` unpacks to `api-tests.trx` at
its root, and `studio-e2e-report` unpacks to `reports/studio/e2e-junit.xml`.

2. **Same integration test names, each passing.**
   ```
   gh run download 44506830145 -n api-test-report -D <S>/base
   gh run download <run>       -n api-test-report -D <S>/pr
   grep -o 'testName="[^"]*"' <S>/base/api-tests.trx | LC_ALL=C sort > <S>/base.txt
   wc -l < <S>/base.txt; sha256sum <S>/base.txt   # 576, 3034a709d4df3caaf2d0d95edb6e60b20965d28e35e7a995e81ad2d75a3b7a94
   grep -o 'testName="[^"]*"' <S>/pr/api-tests.trx   | LC_ALL=C sort > <S>/pr.txt
   LC_ALL=C comm -23 <S>/base.txt <S>/pr.txt     # must print nothing: no base test is missing
   LC_ALL=C comm -13 <S>/base.txt <S>/pr.txt     # must print exactly the 2 FormsLibraryTests names
   grep -o '<Counters [^>]*>' <S>/pr/api-tests.trx   # total="578" executed="578" passed="578" failed="0"
   ```
3. **Same end-to-end test names, each passing.**
   ```
   gh run download 44506830145 -n studio-e2e-report -D <S>/base-e2e
   gh run download <run>       -n studio-e2e-report -D <S>/pr-e2e
   grep -o '<testcase name="[^"]*"' <S>/base-e2e/reports/studio/e2e-junit.xml | LC_ALL=C sort > <S>/base-e2e.txt
   wc -l < <S>/base-e2e.txt; sha256sum <S>/base-e2e.txt   # 34, ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a
   grep -o '<testcase name="[^"]*"' <S>/pr-e2e/reports/studio/e2e-junit.xml   | LC_ALL=C sort > <S>/pr-e2e.txt
   diff <S>/base-e2e.txt <S>/pr-e2e.txt          # must print nothing
   grep -o '<testsuites[^>]*>' <S>/pr-e2e/reports/studio/e2e-junit.xml   # tests="34" failures="0" skipped="0" errors="0"
   ```

### 5.3 Checks after the change (exact commands)

| # | Command | Expected |
|---|---|---|
| C1 | `dotnet build DigitalHub.slnx -c Release` on the base, then on HEAD | exit 0 both times, and HEAD has no more warnings than the base. **Base value from CI:** run `44506830145`, job `135500545250` (API), step "Build (Release)": `13 Warning(s)`, `0 Error(s)`. All 13 are in `api/tools/DigitalHub.ContentImport/ContentWriter.cs` (CS8601 and CS8604); none is in a file this change touches. **Head value:** the same step in the PR head's `api` job; quote its `Warning(s)` line. It must be at most 13, with none in `api/src/DigitalHub.Forms/`. If the local build cannot run: NOT RUN with the quoted reason, and the two CI lines are the evidence |
| C2 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"` | exit 0, `Passed: 2`. If it cannot run locally: NOT RUN with the reason. CI `api` job trx is the evidence (5.1, step 3) |
| C3 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=iso1.trx" --results-directory <scratch>` (against `DigitalHubContent_Test`, which `ApiFactory` rewrites to; one agent on the database at a time) | exit 0, 578 passed. If Application Control or the database prevents it: NOT RUN with the reason, and CI job `api` is the evidence (5.2 step 2) |
| C4 | `dotnet test ... --filter "FullyQualifiedName~CareersTests\|FullyQualifiedName~ApplyDedupeTests\|FullyQualifiedName~PublicContact\|FullyQualifiedName~RequestBodyLimitTests\|FullyQualifiedName~RateLimitLogTests\|FullyQualifiedName~AbortedRequestTests"` | All pass. These are the suites that run the moved code |
| C5 | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;Encrypt=True;TrustServerCertificate=True" dotnet tool run dotnet-ef -- migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build` | exit 0, "No changes have been made to the model". The design-time factory opens no connection (`ContentDbContextFactory.cs`) |
| C6 | `git diff --stat cdef7c9..HEAD -- api/src/DigitalHub.Api/Data` | empty |
| C7 | `git show -M --stat <commit 4>` and `git show -M <commit 4> -- api/src/DigitalHub.Forms` | Commit 4 is the pure rename. Its seven moved files show as renames (`=>`), each differing only in its `namespace` line. The consumers' diffs are only the `using` lines listed in 4.3, plus the test csproj `Using`. Then `git show <commit 3> -- api/src/DigitalHub.Api/Content/ApplicationIntake.cs` and `git show <commit 2>:api/src/DigitalHub.Forms/ApplicationCountSql.cs`: the deleted `IncrementAsync` and `CountFailed` bodies match the new file, apart from `db.Database` becoming the `database` parameter |
| C8 | `grep -rn "DigitalHub\.Api\|DbSet<" api/src/DigitalHub.Forms`; `git ls-files api/src/DigitalHub.Forms`; `grep -rn '"public-contact"' api/src` | First: exit 1 (no match). Second: lists `ContactRateLimit.cs` together with the other eleven `.cs` files and the csproj. Third: exactly one match, `api/src/DigitalHub.Forms/ContactRateLimit.cs` (the `PolicyName` const), so the policy name is no longer a literal in `DigitalHub.Api` |
| C9 | `dotnet list DigitalHub.slnx package --vulnerable --include-transitive` | each of `DigitalHub.Api`, `DigitalHub.Forms`, `DigitalHub.Api.Tests` and `DigitalHub.ContentImport` "has no vulnerable packages" |
| C10 | `dotnet list src/DigitalHub.Forms/DigitalHub.Forms.csproj package --include-transitive` | `Microsoft.EntityFrameworkCore.SqlServer 10.0.12`, `System.Security.Cryptography.Pkcs 9.0.21`; no Identity or JwtBearer package |
| C11 | `cd ../website && npx vitest run test/no-hiring-system.test.ts` | 2 passed (it scans `api/`, including the new folder) |
| C12 | `cd ../website && npm test` | passes, except the known local-only `screenshot-parity-browser` port clash, if it recurs (ADM-05 report); CI job `website` is the evidence |
| C13 | `cd ../studio && npx playwright test` | Expected NOT RUN locally: the harness fails at "Release migrations" (2.7). CI job `studio`, "End-to-end suite", is the evidence (5.2 step 3) |
| C14 | `gh pr view 68/69/70 --json files` again | no overlap with this change's files |

CI on the pull request: `CI` (jobs `api`, `website`, `studio`, `section-compare`,
`website-browser`), `Security` (gitleaks, Semgrep, `dotnet-vulnerable`, npm
audit) and `Workflow lint`. All must be green. The tester quotes run ids.

### 5.4 Track checklist (G2, from `docs/changes/README.md`)

| Checklist line | ISO-1 |
|---|---|
| Follow `docs/adr/0001-split-public-forms-api.md` | Applies. Point 2 is implemented as written: the library name, its contents, and that the tests reference it |
| ISO-1 changes no behaviour: all 208 integration and 22 end-to-end tests pass unchanged | Applies. All 576 and all 34 base tests, by name (5.2) |
| The public API answers only the two form routes, and a test proves every other path returns 404 | N/A until ISO-2 (no public API in this change) |
| The `dh_public_forms` login is proven unable to read users, roles, sessions or audit, or to change content | N/A until ISO-3 (no login in this change) |
| ISO-4 merges only after ISO-5 | N/A, not ISO-4. ISO-1 merges first, as the refinement plan orders |

## 6. Security impact

- **Routes and policies:** none. `POST /api/v1/public/contact` and
  `POST /api/v1/public/apply` keep their controllers, route strings,
  `[AllowAnonymous]`, body and form limits, and the same rate-limit policy name
  and partition. The fallback policy and the role matrix in `CareersTests` are
  unchanged.
- **Data:** none. The adapter runs the same queries, the same insert and the
  same `MERGE` on the same login (`dh_content_app`). No table, column or grant
  changes.
- **Logins and secrets:** none. No configuration key is added, renamed or read
  in a different place. `Email:*`, `Apply:*` and `Contact:*` are read by the
  same code.
- **Dependencies:** no new package id. The new project references
  `Microsoft.EntityFrameworkCore.SqlServer` 10.0.12 and the
  `System.Security.Cryptography.Pkcs` 9.0.21 pin, both already in the tree. C9,
  C10 and the Security `dotnet-vulnerable` job confirm it.
- **Static analysis:** the moved code now lives under `api/src/DigitalHub.Forms/`.
  No `known-findings.json` entry names a moved file (2.5). The `MERGE` stays a
  constant raw string with `SqlParameter`s. The Semgrep job must report 0 new
  findings.
- **Isolation (positive):** after this change, the form code compiles without
  the admin API, Identity or the JWT stack. A test proves it (5.1). ISO-2
  depends on this.
- **Logs:** the same messages at the same levels. `SourceContext` for the two
  logging types becomes `DigitalHub.Forms.*` (3.4, point 6). No body or secret is
  logged, as before.

## 7. Migrations

None. No entity, `ContentDbContext`, model builder or migration file changes
(C5, C6). If the developer finds that a migration seems needed, the developer
stops and the change returns to step 1. It must not be applied.

## 8. Rollback

Revert the pull request. There is no schema, data or configuration change to
undo.

## 9. Owner decisions needed

None. Three notes follow. None of them is an answer filled in on the owner's
behalf.

- The "208 and 22" in "Done when" are read as "all current integration and
  end-to-end tests" (576 and 34). That is the stricter reading (section 1). The
  round-1 reviewer verified it.
- The logger category rename (3.4, point 6) is a consequence of the move the
  owner accepted in ADR 0001, not a behaviour change. The round-1 reviewer ruled
  the same way ("not a behaviour change under P-7, so the change is not BLOCKED
  ON OWNER"). `implementation.md` records the new categories (3.5).
- **Red evidence route (a) is not taken, so no owner question is raised.**
  Route (a) would push a red-only branch and open a draft PR before gate 2, as
  ADM-04 did under O-ADM04-3. That needs the owner's words, and ISO-1 has none.
  The plan uses routes (c) and (b) instead (5.1). If tech-lead gate 1 decides
  (b) is not enough, the verdict is BLOCKED ON OWNER, and the question to ask is:
  "ISO-1: may the developer push a red-only branch, `change/ISO-1-red` holding
  only commit 1 (`FormsLibraryTests.cs`), and open a draft pull request so CI
  shows the two new tests failing on that commit, before gate 2? The draft is
  closed unmerged afterwards."

## 10. Risks

| Risk | Effect | Caught by |
|---|---|---|
| Application Control blocks the freshly built `DigitalHub.Forms.dll` locally | Local tests cannot run | See 10.1. The more likely case is that no local .NET run is possible at all. The fallback does not apply to that case, and CI on Linux is the evidence (5.1, C1 to C3) |
| A lifetime or registration slip in `AddDigitalHubForms` or the `IFormsData` registration | 500s on the forms, at request time | The integration tests run in the `Testing` environment (`ApiFactory.cs:45`), and no test turns on `ValidateScopes` or `ValidateOnBuild`, so the container does not catch it at startup. Only requests through the forms do. The safety nets are CareersTests (16 results; every apply path resolves `ApplicationIntake`, `ApplyThrottle`, `ApplyDedupe`, `IEmailSender` and `IFormsData`), PublicContactTests and PublicContactEmptyProxyTests (resolve `PublicContactStore` and `IFormsData`), RateLimitLogTests (the contact policy), and e2e 10.19 and the paging spec (contact through the real host). Code review checks the lifetimes against `Program.cs:78-82` on the base |
| The adapter's query differs (a projection, a missing `OrderBy`, tracking) | A different mailbox or vacancy answer | Code review against 3.3, and the CareersTests closed-vacancy and mailbox tests |
| `PublicContactRequest` binds differently from another assembly (nullable metadata, JSON options) | Contact validation changes | `Nullable` enabled in Forms (3.1); PublicContactTests, DuplicateFieldTests, RequestBodyLimitTests |
| An implicit `using` is missing in the new non-Web project | Build error | C1 |
| A global `using DigitalHub.Forms` in tests makes a name ambiguous | Build error | C1. A grep found no collision (3.4, point 3) |
| The count `MERGE` moved with a change | Lost counts, or a 500 where there was a 201 | `ApplicationCountSql` is a verbatim move (C7 diff review), and the CareersTests count tests |
| SqlClient pulls the vulnerable Pkcs into the new project | Security job fails | The pin in 3.1, plus C9 and `dotnet-vulnerable` |
| A new Semgrep finding on the new path | Security job fails | Semgrep job. The code text is unchanged |
| `no-hiring-system.test.ts` sees a new `DbSet` or a moved controller | Website CI fails | No `DbSet` in Forms (C8), controllers stay; C11 |
| A test silently disappears (for example, a namespace no longer discovered) | "Unchanged" is false | 5.2 step 2: `comm -23` must be empty and the totals must be 578 |
| Conflict with #68, #69 or #70 | Rebase pain | 2.8 shows no shared file; C14 checks again |

### 10.1 The Web SDK fallback, exactly

**Trigger.** The developer switches the SDK only on quoted evidence that the
new assembly, and not the others, is refused. Both conditions must hold:

- A local Release test run fails to load `DigitalHub.Forms.dll` with an
  Application Control error naming that file, for example `FileLoadException`
  "Could not load file or assembly 'DigitalHub.Forms' ... An Application Control
  policy has blocked this file" (HRESULT 0x800711C7).
- In the same run, `DigitalHub.Images.dll` and `DigitalHub.Api.dll` load.

If no local .NET build or test can run at all, the SDK is **not** switched. The
switch cannot help in that case, and CI on Linux is the evidence. A guess is
never a trigger.

**The fallback project file, in full.** Only the SDK and `OutputType` change,
and the `FrameworkReference` and `<Using>` items go:

```xml
<!-- Web SDK: Application Control on this machine blocked a Microsoft.NET.Sdk library build of this assembly (see docs/changes/ISO-1/implementation.md). -->
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <OutputType>Library</OutputType>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <CETCompat>true</CETCompat>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.12" />
    <!-- SqlClient 6.1.6 pulls 9.0.11. GHSA-846f-f764-76mx is fixed in 9.0.21. -->
    <PackageReference Include="System.Security.Cryptography.Pkcs" Version="9.0.21" />
  </ItemGroup>

</Project>
```

- **No `FrameworkReference`.** The Web SDK references `Microsoft.AspNetCore.App`
  implicitly, and an explicit one raises NETSDK1086, which would add a warning
  and fail C1.
- **No `<Using>` items.** The Web SDK's implicit usings already include all four
  (`Microsoft.AspNetCore.Http`, `Microsoft.Extensions.Configuration`,
  `Microsoft.Extensions.DependencyInjection`, `Microsoft.Extensions.Logging`).
  It also adds `Microsoft.AspNetCore.Builder`, `.Hosting`, `.Routing`,
  `Microsoft.Extensions.Hosting` and `System.Net.Http.Json`. This is exactly
  the set the moved files compiled under in `DigitalHub.Api`, so no name in
  them can change meaning or become ambiguous. Keeping the items would only
  duplicate entries.

**After a switch,** the developer re-runs C1 to C10, quotes them in
`implementation.md` with the triggering error, and the record stays as planned.
Any of them that cannot run locally is NOT RUN, with the CI job named.

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| Contact validation (`PublicContactStore`, `PublicContactRequest`) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Planned | |
| Apply validation and `ApplicationIntake` are in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Planned | |
| Throttles (`ApplyThrottle`, and the contact rate-limit partition `ContactRateLimit`) are in `DigitalHub.Forms`. `ApplyThrottle` is checked by `FormsLibraryTests`; `ContactRateLimit` by C8, which runs `git ls-files` and the `"public-contact"` grep | Refinement plan line 212; ADR 0001 point 2 | Planned | |
| Dedupe (`ApplyDedupe`) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Planned | |
| Email sender (`IEmailSender`, `SmtpEmailSender` and their types) is in `DigitalHub.Forms` | Refinement plan line 212; ADR 0001 point 2 | Planned | |
| CV checks and the apply page (`CvFile`, `ApplyPage`) are in `DigitalHub.Forms` | ADR 0001 point 1 ("CV checks"), point 2 | Planned | |
| The library references no admin API, Identity or JWT code | ADR 0001 points 1 and 2 | Planned | |
| The tests reference the library | ADR 0001 point 2 | Planned | |
| All base integration tests (576, by name) pass unchanged | Refinement plan line 212 ("208"); README G2 checklist | Planned | |
| All base end-to-end tests (34, by name) pass unchanged | Refinement plan line 212 ("22"); README G2 checklist | Planned | |
| No existing test source file is edited | Owner's request "no behaviour change"; caller's instruction | Planned | |
| No migration and no model change | `AGENTS.md` Schema; this plan, section 7 | Planned | |
| No route, login or host change | Refinement plan ISO-2 to ISO-5 are separate | Planned | |
| GAP-38, part (code moved; own API and login still to come) | Refinement plan line 114 | Planned (partial, stays open for ISO-2 and ISO-3) | |

## 12. Revision log

| Round | Point raised | Answer |
|---|---|---|
| 1 | First version. No review yet | n/a |
| 2 | F1 (Major): the red evidence at commit 1 cannot come from the tester's checkout or CI | Rewrote 5.1. Route (c) first: a local Release run on commit 1, quoted. If that cannot run, route (b): NOT RUN, with a static reading of why each test fails that the tester can check (assembly name `DigitalHub.Api`, no `<AssemblyName>`; the metadata references `DigitalHub.Images`, `System.IdentityModel.Tokens.Jwt`, JwtBearer and Identity, each with the line that uses it). The green authority is the PR head's CI `api` trx. Route (a) is not taken, because there are no owner's words for a pre-gate push. Section 9 says so and gives the exact question in case gate 1 finds (b) not enough. The wrong claim ("the tester's detached checkout, or CI on the pull request's first push") is removed |
| 2 | F2: commit 4 mixed a move with an edit; commit 2's extension method could not build | Rewrote 3.5. Commit 2 adds only the project and the types that need nothing from the API (`IFormsData` and records, `FormOutcome`, `ApplicationCountSql`, `ContactRateLimit`), with no `FormsServiceCollectionExtensions`. Commit 3 is a content-only change in place in `DigitalHub.Api/Content` (port, adapter, `ContactRateLimit` use, deletion of the old `IncrementAsync` and `CountFailed`). Commit 4 is a pure rename of all seven files, namespace line only, plus the consumers' `using` lines. Commit 5 adds `AddDigitalHubForms`, filled in, and removes redundant usings. Every commit builds. C7 now reviews commit 4 and the commit 2/3 pair separately |
| 2 | F3: the Web SDK fallback had no trigger, and as written would raise NETSDK1086 | Added 10.1. The trigger is a quoted Application Control load failure naming `DigitalHub.Forms.dll` while `DigitalHub.Images.dll` and `DigitalHub.Api.dll` load in the same run, and there is no switch when no local .NET runs at all. The fallback csproj is written out in full: Web SDK, `OutputType Library`, `CETCompat`, no `FrameworkReference`, `<Using>` items dropped with the reason. C1 to C10 are re-checked after a switch |
| 2 | F4: C1 had no CI route | C1 now quotes the base value from run `44506830145`, job `135500545250`, "Build (Release)": `13 Warning(s)`, `0 Error(s)`, all in `api/tools/DigitalHub.ContentImport/ContentWriter.cs`. The head value is the same line in the PR head's `api` job, at most 13 and none in `DigitalHub.Forms`. NOT RUN path added. C2 also got a NOT RUN path |
| 2 | F5: wrong e2e artifact path, missing base e2e command, locale-dependent sort | 5.2 steps 2 and 3 now download both artifacts, use `reports/studio/e2e-junit.xml`, build the base lists explicitly, and use `LC_ALL=C sort` and `LC_ALL=C comm`. Both base hashes were re-run under `LC_ALL=C` and are unchanged (`3034a709…7a94`, `ed0f1b41…848a`) |
| 2 | F6: "The Development host validates scopes" was wrong | The risk row now says the tests run in `Testing` (`ApiFactory.cs:45`) with no scope validation, and names the real nets: CareersTests, PublicContactTests, PublicContactEmptyProxyTests, RateLimitLogTests, e2e 10.19 and the paging spec, and lifetime review against the base `Program.cs:78-82` |
| 2 | F7: no check for `ContactRateLimit`; stale usings undecided | C8 now runs `git ls-files api/src/DigitalHub.Forms` (lists `ContactRateLimit.cs`) and `grep -rn '"public-contact"' api/src`, which must match only `ContactRateLimit.cs`. The coverage row names those checks. 4.3 decides the usings: in `PublicApplyController.cs`, `ExceptionShieldMiddleware.cs` and `RequestBodyLimit.cs`, `using DigitalHub.Api.Content;` becomes `using DigitalHub.Forms;`. In `PublicContactController.cs`, it is removed in commit 4. In `Program.cs`, it stays, because other types still need it |
| 2 | Reviewer's ruling on `SourceContext`; request that `implementation.md` repeat it | Section 9 records the ruling. 3.5 requires `implementation.md` to name the new categories |

Status: Revised after plan review round 1; ready for plan review, round 2.
