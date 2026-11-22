# ISO-3: The `dh_public_forms` login, limited to the forms' four tables

- Change id: ISO-3. Branch: `change/ISO-3`, cut from `origin/rebuild/dotnet-platform`
  at `0a55da469b2582978e8460f6403de9cdf76053f8` (ISO-2 merged, #76). Worktree:
  `D:\work\DigitalHub\dh-platform-claude-iso-3`. All work happens there, never in
  `dh-platform` or `DH-WEBSITE-main`.
- Author: architect. Round 1 written. Revised in round 2 after plan review round 1
  (`docs/changes/ISO-3/plan-review.md`, Round 1, `Verdict: CHANGES NEEDED`); section 12
  answers M-1 and m-1 to m-5.
- Sources read, all present: `docs/changes/README.md`, `AGENTS.md` and `CLAUDE.md`,
  `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
  `docs/quality/refinement-plan-2026-10-28.md` (GAP-38 at line 114, Track G2 at lines
  210-217, success measure at line 247), `docs/adr/0001-split-public-forms-api.md`,
  `docs/security-deployment.md`, and all six ISO-2 records in `docs/changes/ISO-2/`
  (`plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`,
  `test-report.md`, `delivery-approval.md`). `docs/changes/ISO-3/` held no records
  before this plan, so this is not a revision.

## 1. Item

- **Closes:** ISO-3 of Track **G2, isolation** (ADR 0001, point 3). Together with ISO-2
  it closes **part of GAP-38**: the public forms get their own login. GAP-38's target
  ("The public forms run in their own API with their own login `dh_public_forms`,
  limited to four tables") is met in the repository and its tests. It is met in service
  only when the public API is deployed (Phase D) and the admin API's copies of the two
  routes, which still use `dh_content_app`, are removed (ISO-4).
- **Owner's request, as given (19 November 2026):** "ISO-3 dh_public_forms login: INSERT
  on contact_requests; SELECT, INSERT, UPDATE on application_counts; SELECT on vacancies
  and site_settings. Refinement plan Track G2, ISO-3, closes part of GAP-38; ADR 0001
  (accepted 19 November 2026, owner's words: "accepted"). Migration shown first. Done
  when a permission test, like AuditLogPermissionTests, proves it cannot read users,
  roles, sessions or audit, or change content."
- **Owner's go-ahead (19 November 2026, reply to "Should I start ISO-3 through
  /change?"):** "Yes, start ISO-3".
- **"Done when"**, quoted from `docs/quality/refinement-plan-2026-10-28.md`, line 214:
  > A permission test, like `AuditLogPermissionTests`, proves it cannot read users, roles, sessions or audit, or change content
- **The item's "By" column**, same line: "Agent; migration shown first".
- **ADR 0001, point 3**, quoted:
  > **Its own database login, `dh_public_forms`**, granted only:
  > - INSERT on `contact_requests`
  > - SELECT, INSERT, UPDATE on `application_counts` (the daily count MERGE)
  > - SELECT on `vacancies` (open-vacancy check) and `site_settings` (mail
  >   recipients)
  >
  > Nothing on users, roles, sessions, refresh tokens, audit, media, working
  > copies or content. The grants are a migration, shown before it is applied.
- **G2 checklist line** (`docs/changes/README.md`): "The `dh_public_forms` login is
  proven unable to read users, roles, sessions or audit, or to change content."
- **ISO-2 hand-off item 5** (`docs/changes/ISO-2/implementation.md`, section 10):
  "The one setting ISO-3 changes: `ConnectionStrings:PublicForms` in `PublicApiFactory`
  ... to the `dh_public_forms` login. The fixtures in `FormsDatabase` keep the
  restricted test login."

**Boundaries kept:**

| Item | Where it goes |
|---|---|
| The admin API drops `/api/v1/public/*` (its copies still run on `dh_content_app`) | ISO-4 (merged after ISO-5) |
| The website's `web.config` proxy, and the website form tests against the public API (their harness will need the `dh_public_forms` user in `DigitalHubContent_E2e`) | ISO-5, through the hand-off (section 4.4) |
| The production login, its password in the server's secret store, the second IIS site | Phase D (ADR 0001, Consequences) |
| The public API's own `AllowedHosts`, `ForwardedHeaders:KnownProxies` | ISO-5 / ISO-6 (ISO-2 hand-off items 1 and 2; untouched) |

## 2. Current state

### 2.1 The base

```
$ git log --oneline -3                      (in the worktree)
0a55da4 ISO-2: Add DigitalHub.PublicApi, serving only the contact and apply forms (#76)
74d62e9 GAP-09-status: Record G-15 and G-3 status after GAP-09 (#74)
1c0d7f4 GAP-11: Gate 2 round 2 approval (#75)
$ git status
On branch change/ISO-3
nothing to commit, working tree clean
$ gh run list --branch rebuild/dotnet-platform --workflow CI --limit 3
44554202307  push  0488d89…  (in progress at the time of writing)
44548957589  push  0a55da4…  success
44545832662  push  74d62e9…  success
```

After `git fetch origin`, the base has moved by one commit:
`0488d89 ADM-12d: Test the card-image alt check at publish (#77)`, which changes only
`api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` and `docs/changes/ADM-12d/*`.
No ISO-3 file is touched (see 2.9).

### 2.2 How logins and grants are created today: not in migrations

No migration contains a `GRANT`, `DENY`, `CREATE ROLE` or `CREATE USER`:

```
$ grep -n -i "GRANT\|DENY\|CREATE ROLE\|CREATE USER" api/src/DigitalHub.Api/Data/Migrations/*.cs | grep -v Designer
(no output)
```

`dh_content_app` is created and granted by environment scripts run with the elevated
account, in four places that carry the same lines:

- `.github/workflows/ci.yml`, job `api`: step "Create the test database and the
  restricted login" (lines 85-90) runs
  `CREATE LOGIN [$APP_LOGIN] WITH PASSWORD = N'$APP_PASSWORD', CHECK_POLICY = OFF;`.
  After the migrations, step "Grant the restricted login read and write, and nothing
  else" (lines 107-115) runs `CREATE USER`, `ALTER ROLE db_datareader ADD MEMBER`,
  `ALTER ROLE db_datawriter ADD MEMBER` and `DENY UPDATE, DELETE ON dbo.audit_log`.
  The values are workflow-only (lines 34-37: `APP_LOGIN: dh_content_app`,
  `APP_PASSWORD: CiOnlyApp2026Passw0rd`), and the header (lines 7-9) says "Every
  credential in this file is a workflow-only value for a throwaway SQL Server container
  ... None is a real secret".
- `studio/e2e/start-api.ts:56-75` (the Studio end-to-end harness, `DigitalHubContent_E2e`).
- `api/tools/parity-snapshot.mjs:164-170` (the parity tool's throwaway catalog).
- `docs/security-deployment.md:7-31`, "Database: the application login", for every
  other catalog, run by hand with the elevated account.

So **ISO-3 is the first migration that holds permissions.** The ADR says "The grants are
a migration", and the owner's request says "Migration shown first". A login with a
password is a server object and its password is a secret, so it cannot be in a
migration (`AGENTS.md`, Secrets). Section 3.1 splits the two.

### 2.3 `AuditLogPermissionTests`, the model the owner names

`api/tests/DigitalHub.Api.Tests/AuditLogPermissionTests.cs` (62 lines),
`[Collection("SqlServer")]`, one `[Fact]`:
`The_application_login_can_add_and_read_audit_rows_but_not_change_or_delete_them`.
It goes through the host's own `ContentDbContext` (so it runs as the host's login),
adds and reads an audit row, then asserts that `ExecuteUpdateAsync` and
`ExecuteDeleteAsync` throw `SqlException` with `Number == 229` (`PermissionDenied`). It
cleans up with `ApiFactory.ElevatedTestConnectionString()`. Its doc comment says the
grants "come from the setup that creates the login ... so this test fails on a catalog
where that DENY was not applied". ISO-3's test follows the same pattern: the host's own
context and connection, error 229, elevated clean-up.

### 2.4 What the public API does with the database, operation by operation

The port is `api/src/DigitalHub.Forms/IFormsData.cs` (four members). The public API's
implementation is `api/src/DigitalHub.PublicApi/Data/PublicFormsData.cs`, over
`PublicFormsDbContext` (`Data/PublicFormsDbContext.cs`, four entities). Every data
access in the forms library goes through that port:

```
$ grep -n "data\.\|IFormsData\|DbContext\|Database" api/src/DigitalHub.Forms/*.cs   (data lines only)
ApplicationCountSql.cs:13:  public static async Task IncrementAsync(DatabaseFacade database, ...)
ApplicationIntake.cs:59:    var vacancy = await data.FindVacancyAsync(parsed, cancellationToken);
ApplicationIntake.cs:142:   await data.IncrementApplicationCountAsync(vacancyId, ...);
ApplicationIntake.cs:214:   var settings = await data.MailboxesAsync(cancellationToken);
PublicContactStore.cs:69:   await data.AddContactRequestAsync(
```

| Form | Member | SQL it sends | Permission it needs | Granted by the request |
|---|---|---|---|---|
| Contact | `AddContactRequestAsync` (`PublicFormsData.cs:12-27`) | `INSERT INTO contact_requests (...) VALUES (...)` from `SaveChangesAsync` | INSERT on `contact_requests` | Yes |
| Apply | `FindVacancyAsync` (`:29-39`) | `SELECT TOP(1) id, title, status FROM vacancies WHERE id = @p` | SELECT on `vacancies` | Yes |
| Apply | `MailboxesAsync` (`:41-45`) | `SELECT TOP(1) careers_email, email FROM site_settings ORDER BY id` | SELECT on `site_settings` | Yes |
| Apply | `IncrementApplicationCountAsync` → `ApplicationCountSql.IncrementAsync` (`ApplicationCountSql.cs:22-34`) | `MERGE application_counts WITH (HOLDLOCK) AS target USING (...) ON ... WHEN MATCHED THEN UPDATE SET [count] = target.[count] + 1 WHEN NOT MATCHED THEN INSERT (...)`, in a Serializable transaction | SELECT (the ON clause and `target.[count]`), INSERT, UPDATE on `application_counts`. No DELETE: there is no `WHEN NOT MATCHED BY SOURCE` | Yes |

**The contact path needs no SELECT.** I checked this rather than relying on ISO-2's
statement:

- `PublicFormsDbContext` maps every `ContactRequest` property with no store-generated
  value: `id` is `ValueGeneratedNever()` (`PublicFormsDbContext.cs:27`), and ISO-2's
  `PublicApiIsolationTests.The_forms_context_maps_only_the_four_tables` asserts that
  every `ContactRequest` property is `ValueGenerated.Never`.
- The table has no store default and no computed column:
  `grep -n "defaultValueSql\|computedColumnSql" api/src/DigitalHub.Api/Data/Migrations/*.cs`
  prints nothing, and `20260921223203_InitialPlatform.cs:277-301` creates
  `contact_requests` with plain columns, a check constraint on `status`, and a foreign
  key `handled_by_id` → `AspNetUsers`.
- With nothing to read back, EF Core sends a plain `INSERT` with no `OUTPUT` and no
  `SELECT`. The two unmapped nullable columns (`handled_by_id`, `handled_at`) are left
  NULL, so the foreign key to `AspNetUsers` is not checked. Checking a foreign key
  needs no permission on the referenced table anyway.
- The same is true of `application_counts.vacancy_id` → `vacancies`: an INSERT that
  is checked against a foreign key does not need SELECT on the parent.

**The four grants match the needs exactly.** There is no operation the forms need that
the request does not grant, and the request grants nothing the forms do not use. There
is **no mismatch to flag**. The developer's stop rule in 5.3 still applies: if any test
shows the host needs more, the developer stops and reports it, and never widens a
grant.

**A missing grant on the count would be hidden from the HTTP response.**
`ApplicationIntake.cs:140-148` (the `try` at 140, the `catch` at 144) catches any `SqlException` from the count
(`ApplicationCountSql.CountFailed`), logs "application count was not recorded" and
still answers 201. A missing SELECT, INSERT or UPDATE on `application_counts` would not
show in the response. Two things catch it: the existing apply tests, which assert the
stored count (for example `PublicApplyTests.cs:58`,
`Assert.Equal(1, await FormsDatabase.CountAsync(vacancy))`), and T-7 below, which
calls the count directly through the host's port, twice, so it covers both the insert
branch and the update branch.

### 2.5 The tables, from the model snapshot

```
$ grep -o 'ToTable("[a-zA-Z_]*"' api/src/DigitalHub.Api/Data/Migrations/ContentDbContextModelSnapshot.cs | sort -u
AspNetRoleClaims AspNetRoles AspNetUserClaims AspNetUserLogins AspNetUserRoles AspNetUserTokens
AspNetUsers RefreshTokens application_counts audit_log blog_posts case_studies contact_requests
media navigation_items news_items pages partners redirects revisions sections services
site_settings team_members vacancies working_copies
```

That is 26 tables, plus `__EFMigrationsHistory`. The request's categories map to them
as follows:

- Users and roles: the seven `AspNet*` tables.
- Sessions: `RefreshTokens`.
- Audit: `audit_log`.
- Content: `blog_posts`, `case_studies`, `media`, `navigation_items`, `news_items`,
  `pages`, `partners`, `redirects`, `revisions`, `sections`, `services`,
  `site_settings`, `team_members`, `vacancies` and `working_copies`.

`site_settings` columns (snapshot) are the website's public settings: contact details,
social links, cookie-banner text and share defaults. None is a secret, so the
table-level SELECT the owner asked for exposes nothing beyond what the website already
publishes. `vacancies` includes draft vacancies; see Risks, R-6.

### 2.6 The public API's test suite still connects with `dh_content_app`

`api/tests/DigitalHub.PublicApi.Tests/PublicApiFactory.cs`:

- line 19: `private readonly string _connectionString = TestConnectionString();`
- line 24-25: `// ISO-3 changes this one setting to the dh_public_forms login.`
  `builder.UseSetting("ConnectionStrings:PublicForms", _connectionString);`
- lines 100-118: `TestConnectionString()` reads `ConnectionStrings:Content` (the admin's
  user-secrets store, id `41335d15-4f42-410a-bf90-41068117e45a`, in the test csproj;
  or `ConnectionStrings__Content` in CI), rewrites it to `DigitalHubContent_Test`, and
  refuses Windows authentication or a missing `User ID`.

Every factory in the suite derives from `PublicApiFactory` (`RecordingApplyFactory`,
`ApplyLimitedFactory`, `SilentSmtpFactory`, `PublicContactFactory`,
`PublicContactNoProxyFactory`, `KestrelFactory`, and the private `LoggingFactory`,
`RecordingFactory`, `SettingFactory` and `DevelopmentFactory`), so the one line 19
decides the host's login for all of them. `FormsDatabase.cs:14` uses
`TestConnectionString()` for the fixtures. Its comment (lines 5-9) says they "never go
through the host's context, so they keep working in ISO-3, when the host's own login
can no longer read contact_requests". The fixtures stay on `dh_content_app`.

CI's `api` job sets `ConnectionStrings__Content` and `ConnectionStrings__ContentAdmin`
(lines 62-68), and runs the public suite in step "Public API integration tests
(Release)" (lines 134-141). There is no `PublicForms` variable today.

### 2.7 The migration gate this migration must pass

`api/tools/migration-checks/run.sh` (job `api`, step "Migration checks", lines 99-105,
`MIGRATION_CHECKS_BLOCKING_FROM: "2026-11-18"`, so it **blocks now**). On scratch
catalogs `MigrationCheck_*` in CI's container it:

1. generates the idempotent script;
2. runs the canary;
3. runs the script twice on an empty catalog;
4. runs it on the N-1 schema and on the base's newest;
5. runs `database update` to latest, **down to N-1** (that is, this migration's `Down`),
   and to latest again;
6. compares the schema.

Step 6 compares columns, indexes, checks, foreign keys and defaults, not principals, so
it does not see roles. The permission test covers those. The convention for
`migrationBuilder.Sql` in this repository is `EXEC(N'...')`, so the idempotent script
compiles each statement only when it runs (`20261019104504_AddRefreshTokenSessionStart.cs:14-32`,
GAP-06).

### 2.8 Local constraints, carried from ISO-1 and ISO-2 and from the caller

- Release only. Windows Application Control blocks Debug test builds.
- `dotnet tool run dotnet-ef` does not resolve on this machine. The working route is the
  restored dll:
  `dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll ...`
  (`docs/changes/ISO-1/implementation.md:180-190`). CI uses `dotnet tool run dotnet-ef`.
- Run `npm ci` in `website/` before `dotnet test`, as CI's `api` job does (line 123).
- The local end-to-end harness fails at "Release migrations"
  (`docs/changes/ISO-2/implementation.md`, coverage row "Every base end-to-end test",
  C19). End-to-end evidence comes from CI's `studio` job.
- **One agent at a time on `DigitalHubContent_Test`.** Today another session's run
  overlapped with a run here and caused false failures. Before every local database
  step and every test run, the developer runs both checks in 5.3, L0: no `testhost` or
  `vstest` process anywhere on the machine, and no other session on
  `DigitalHubContent_Test`.
- The admin and public suites share `DigitalHubContent_Test`. They are run one after the
  other, never at once.

### 2.9 Parallel work

```
$ gh pr list --state open
#60  diag/redirects-e2e  (draft) "diag: find where the ADM-07 redirects end-to-end test stops (do not merge)"
$ gh pr view 60 --json files     →  studio/e2e/redirects.spec.ts
$ gh pr view 77 --json files     →  api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs, docs/changes/ADM-12d/*  (merged since: 0488d89)
```

No path is shared with section 4. #77 changes the admin suite's test count (+2). The
developer takes the admin baseline from the base the branch is on at the time of the
run (5.3, C3).

## 3. Design

### 3.1 The grants in a migration on a role; the login and its membership in the environment

**Migration (shown in section 7):** `AddPublicFormsRole` in the admin API's migration
chain (`api/src/DigitalHub.Api/Data/Migrations/`). It creates a database role
`dh_public_forms_role`, owned by `dbo`, and grants it exactly:

- INSERT on `dbo.contact_requests`
- SELECT, INSERT, UPDATE on `dbo.application_counts`
- SELECT on `dbo.vacancies`
- SELECT on `dbo.site_settings`

No `DENY` is needed: a principal with no grant has no permission, and the role is in no
fixed role. `CREATE ROLE` has no `IF NOT EXISTS`. A role with that name that already
exists is a surprise, and could carry grants nobody reviewed, so the migration fails
(P-5) rather than adopting it. `Down` removes every member of the role and drops it,
which drops its grants. It leaves the users alone, because the environment owns them.

**Environment step (shown in 7.2, never committed with a password):** run with the
elevated account, in the same places and the same way `dh_content_app` is set up
today (2.2):

1. `CREATE LOGIN [dh_public_forms]` with a password. The login is server-level, and
   its password is a secret.
2. In each catalog the public API uses: `CREATE USER [dh_public_forms] FOR LOGIN
   [dh_public_forms]` and `ALTER ROLE [dh_public_forms_role] ADD MEMBER
   [dh_public_forms]`.
3. Nothing else: never `db_datareader`, `db_datawriter` or any other role.

The login's effective permissions are then exactly the owner's four grants, and the
permission test (5.1) checks the effective set, not the role's text.

The login has a user **only** in the catalogs where step 2 is run. In this change that
is `DigitalHubContent_Test` (locally) and CI's throwaway `DigitalHubContent_Test`. It
cannot even connect to `DigitalHubContent` (Msg 4060), which is one more barrier
against the rule "never write to DigitalHubContent".

**Rejected alternatives:**

| Alternative | Why rejected |
|---|---|
| Grant directly to a user `dh_public_forms` created in the migration (`CREATE USER ... FOR LOGIN`) | The migration would fail on every catalog where the login does not exist yet: CI's migration-checks scratch catalogs, the end-to-end and parity catalogs, `DigitalHubContent_Studio`. Creating the login in the migration would put a password in the repository |
| Create the user only `IF SUSER_ID(N'dh_public_forms') IS NOT NULL` | The same migration would give different results on different catalogs, depending on the server. The migration checks could not prove it, and a catalog migrated before the login exists would silently have no user |
| `CREATE USER [dh_public_forms] WITHOUT LOGIN` in the migration, mapped to the login later | Re-mapping a contained user without a login to a server login is not a supported, simple step. It is more moving parts than a role and buys nothing |
| Keep the grants in CI and environment scripts, as for `dh_content_app` | The ADR and the owner both say the grants are a migration, shown first. A role in a migration also gives every catalog the same, reviewed grant text |
| Column-level grants (for example `SELECT (id, title, status) ON vacancies`) | Narrower than the owner's words ("SELECT on vacancies and site_settings"). The plan neither widens nor narrows the owner's grants on its own. It is recorded as possible follow-up F-ISO3-1 in Risks (R-6), not decided here |
| `DENY` on every other table as well | Grants only add; with no fixed-role membership there is nothing to deny. A DENY list would need a new line for every new table, and could be forgotten. The test instead sweeps every table on every run (T-4), so a new table is covered automatically |

### 3.2 The public suite switches to `dh_public_forms` (in scope)

This follows ISO-2's hand-off item 5. `PublicApiFactory` gets
`PublicFormsTestConnectionString()`:

- It reads `ConnectionStrings:PublicForms` from the same test configuration
  (`TestConfiguration()`: the admin user-secrets store, then the environment).
- If the setting is missing or blank, it throws
  `InvalidOperationException("ConnectionStrings:PublicForms is not configured (the dh_public_forms login).")`.
  There is no fallback to `ConnectionStrings:Content`, which would quietly run the
  suite on the wide login (P-5).
- It rewrites the value with `ToTestCatalog`, so only `DigitalHubContent_Test` is
  reachable.
- It refuses Windows authentication, a missing `User ID`, and any `User ID` other than
  `dh_public_forms` (`SqlConnectionStringBuilder.UserID`, ordinal ignore-case).

Line 19 becomes `_connectionString = PublicFormsTestConnectionString();`. That is the
one setting. `TestConnectionString()` stays as it is, for `FormsDatabase`, which keeps
the restricted `dh_content_app` login for fixtures and read-backs.
`ElevatedTestConnectionString()` is unchanged.

**Where the secret lives:**

- **Locally:** the key `ConnectionStrings:PublicForms` in the user-secrets store the test
  project already reads (`41335d15-4f42-410a-bf90-41068117e45a`). Its value names
  `Database=DigitalHubContent`, like the `Content` value, and the factory rewrites it
  to `_Test`. Only the login's own password is in it. It is set from standard input,
  so it is not on a command line or in the shell history, and it is never printed
  (7.2). The store is the admin API's, so the admin process also sees one key it never
  reads. This is local and test-only. In Phase D the public API gets its own secret
  store on the server (ADR 0001, Consequences).
- **CI:** a workflow-only value, exactly like `APP_PASSWORD`. These are top-level env
  `FORMS_LOGIN: dh_public_forms` and `FORMS_PASSWORD: CiOnlyForms2026Passw0rd`, and
  job env `ConnectionStrings__PublicForms` in the `api` job. The container is thrown
  away after the job, and the file header already says none of these values is a real
  secret. No repository secret is added.

This follows the established pattern, and `AGENTS.md` ("dotnet user-secrets only. Never
printed, never committed") covers the local secret, so **no owner decision is needed**.
The local login creation is shown to the owner with the migration (hold point H-1).

### 3.3 The permission test

The new file is `api/tests/DigitalHub.PublicApi.Tests/PublicFormsPermissionTests.cs`.
It has `[Collection("PublicFormsSql")]` and `IClassFixture<PublicApiFactory>`.

Like `AuditLogPermissionTests`, it runs **as the host's login**. It takes the
connection from the host: `factory.Services` → scope → `PublicFormsDbContext` →
`Database.GetConnectionString()`. It then opens raw `SqlConnection`s with it, or uses
the context and `IFormsData` themselves. So it tests whatever login the public API
really runs on. Setup, inspection and clean-up use
`PublicApiFactory.ElevatedTestConnectionString()`. Every denial assertion is
`SqlException.Number == 229`, or the stated number. Every write probe runs inside a
transaction that is always rolled back, with `WHERE 1 = 0` on UPDATE and DELETE, so
even a wrongly granted login changes no row. The tests are listed in 5.1.

The test file is committed first and run red **against the ISO-2 state** (host on
`dh_content_app`). The wide login fails the denial tests for the right reason: the
reads and writes succeed. Then come the migration and the switch.

### 3.4 Order of commits

| # | Commit | Expected test result |
|---|---|---|
| 1 | `ISO-3: Test that the public forms login cannot read users or change content` adds `PublicFormsPermissionTests.cs` and `FormsDatabase.DeleteContactAsync`. No product or factory change | Red set R1 (5.2): T-1, T-2 (10 rows), T-3 (15 rows), T-4, T-5, T-8 fail; T-6 and T-7 pass. 29 of 31 cases fail, 2 pass |
| 2 | `ISO-3: Add the dh_public_forms_role migration` adds the migration and its Designer file. Snapshot unchanged | Unchanged from R1 (the host is still on `dh_content_app`). **Hold H-1 before applying it anywhere** |
| 3 | `ISO-3: Run the public forms API's tests as dh_public_forms` changes `PublicApiFactory` and `ci.yml` | All green, after the local environment step (7.2) |
| 4 | `ISO-3: Record the dh_public_forms login in the deployment notes` changes `docs/security-deployment.md`, `api/README.md` and `ENGINEERING_STANDARDS.md` S-8 "Enforced by" | No test change |
| 5 | `ISO-3: Implementation record` adds `docs/changes/ISO-3/implementation.md` | — |

Every commit builds in Release (B-6).

## 4. Scope

### 4.1 Create

| File | What |
|---|---|
| `api/src/DigitalHub.Api/Data/Migrations/<timestamp>_AddPublicFormsRole.cs` | The migration in 7.1, verbatim apart from the generated class layout |
| `api/src/DigitalHub.Api/Data/Migrations/<timestamp>_AddPublicFormsRole.Designer.cs` | Generated by `migrations add`. Its target model must equal the current snapshot |
| `api/tests/DigitalHub.PublicApi.Tests/PublicFormsPermissionTests.cs` | T-1 to T-8 (5.1) |
| `docs/changes/ISO-3/implementation.md` | The developer's record. It includes the generated scripts (7.3), the hold-point quote (H-1), the red and green runs, the controls and a "Hand-off" section (4.4) |

`<timestamp>` is whatever `migrations add` generates. It must sort after
`20261020113912` (the newest migration on the base).

### 4.2 Change

| File | Change |
|---|---|
| `api/tests/DigitalHub.PublicApi.Tests/PublicApiFactory.cs` | Add `PublicFormsTestConnectionString()` (3.2). Line 19 uses it. Update the class and line-24 comments. No other change |
| `api/tests/DigitalHub.PublicApi.Tests/FormsDatabase.cs` | Add `DeleteContactAsync(Guid id)`: a parameterised `DELETE FROM contact_requests WHERE id = @id` on the fixture login, for T-7's clean-up. Update the comment at lines 5-9 to say the host now runs as `dh_public_forms` |
| `.github/workflows/ci.yml`, job `api` only | (a) Top-level `env`: `FORMS_LOGIN: dh_public_forms`, `FORMS_PASSWORD: CiOnlyForms2026Passw0rd`. (b) Job `env`: `ConnectionStrings__PublicForms: Server=localhost,1433;Database=DigitalHubContent;User ID=dh_public_forms;Password=CiOnlyForms2026Passw0rd;Encrypt=True;TrustServerCertificate=True`, and the comment at lines 63-66 updated. (c) Step "Create the test database and the restricted login" is renamed "... the restricted logins" and also runs `CREATE LOGIN [$FORMS_LOGIN] WITH PASSWORD = N'$FORMS_PASSWORD', CHECK_POLICY = OFF;`. (d) After the existing grant step, a new step "Add the public forms login to its role, and nothing else" runs, in `DigitalHubContent_Test`, `CREATE USER [$FORMS_LOGIN] FOR LOGIN [$FORMS_LOGIN]; ALTER ROLE [dh_public_forms_role] ADD MEMBER [$FORMS_LOGIN];`. No new action, so nothing new to pin. The `studio` and other jobs are untouched |
| `docs/security-deployment.md` | A new section, "Database: the public forms login", after "Database: the application login". It holds the elevated SQL of 7.2 (with no password), says it is never added to `db_datareader` or `db_datawriter`, that the role comes from the migration, that `PublicFormsPermissionTests` fails on a catalog where the login has more, and that re-applying the migration after its `Down` needs the membership line run again (the orphaned user is harmless; section 8) |
| `api/README.md` | Line 5: the public API's `ConnectionStrings:PublicForms` uses `dh_public_forms`, member of `dh_public_forms_role` only. Its tests read `ConnectionStrings:PublicForms` from the same user-secrets store |
| `ENGINEERING_STANDARDS.md` | Row S-8, "Enforced by" only: add "; the public forms login holds only its four grants (`PublicFormsPermissionTests`, ADR 0001)". The rule text and Status stay as they are |

### 4.3 Must not change (checked by C11)

- `api/src/**` other than the two new migration files. In particular
  `ContentDbContextModelSnapshot.cs`, `PublicFormsDbContext.cs`, `PublicFormsData.cs`,
  `ApplicationCountSql.cs`, `Program.cs` of both APIs and `appsettings*.json`.
- `api/tests/DigitalHub.Api.Tests/**`, including `AuditLogPermissionTests.cs`.
- Every existing test in `api/tests/DigitalHub.PublicApi.Tests/` other than the two
  files in 4.2.
- `studio/**`, `website/**`, `packages/**`, `api/tools/**`, every other workflow, and
  `.github/security/**`.
- The `dh_content_app` grant lines everywhere.

### 4.4 Out of scope, and where each item goes

| Item | Destination |
|---|---|
| Admin API copies of the two routes, still on `dh_content_app` | ISO-4 |
| The website's form tests against the public API. Their harness must create the `dh_public_forms` user and membership in `DigitalHubContent_E2e` the way 7.2 does | ISO-5, through the `implementation.md` hand-off |
| The production login, its secret-store entry, and adding its user and membership in the production catalog after the migration | Phase D, through `docs/security-deployment.md` (4.2) |
| Adding the role's member in `DigitalHubContent_Studio` (manual review) | Not needed until the public API is run against it. The migration reaches it whenever the owner next migrates that catalog; the role is harmless with no member |
| Column-level narrowing of the SELECT grants (F-ISO3-1) | A possible follow-up for the owner (R-6); not proposed as a decision |
| `AllowedHosts`, `KnownProxies` of the public API | ISO-5 / ISO-6 (ISO-2 hand-off 1 and 2) |

## 5. Test plan

### 5.1 Tests written first (commit 1), and what each asserts

All are in `api/tests/DigitalHub.PublicApi.Tests/PublicFormsPermissionTests.cs`. "As the
host's login" means a connection built from the host context's
`Database.GetConnectionString()`.

| Id | Name | Asserts |
|---|---|---|
| T-1 | `The_host_runs_as_dh_public_forms_in_no_fixed_role` | As the host's login: `SUSER_SNAME()` and `USER_NAME()` are `dh_public_forms`. `IS_SRVROLEMEMBER('sysadmin')` is 0. `IS_ROLEMEMBER` is 0 for `db_owner`, `db_datareader`, `db_datawriter`, `db_ddladmin`, `db_securityadmin` and `db_accessadmin`, and 1 for `dh_public_forms_role`. Elevated: in `sys.database_role_members`, the user's only role is `dh_public_forms_role` |
| T-2 | `It_cannot_read_users_roles_sessions_or_audit` (Theory, 10 rows: `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetRoleClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `RefreshTokens`, `audit_log`, `contact_requests`) | As the host's login, `SELECT TOP (1) 1 FROM dbo.[<table>]` throws `SqlException` with `Number == 229` |
| T-3 | `It_cannot_change_content` (Theory, 15 rows: `blog_posts`, `case_studies`, `media`, `navigation_items`, `news_items`, `pages`, `partners`, `redirects`, `revisions`, `sections`, `services`, `site_settings`, `team_members`, `vacancies`, `working_copies`) | As the host's login, each in a rolled-back transaction, each throws `SqlException` 229: `INSERT INTO dbo.[t] DEFAULT VALUES`, `UPDATE dbo.[t] SET [id] = [id] WHERE 1 = 0`, `DELETE FROM dbo.[t] WHERE 1 = 0`. Elevated: each table's row count is the same before and after |
| T-4 | `Every_table_operation_outside_the_four_grants_is_denied` | Elevated: list every table in `sys.tables` (schema `dbo`, including `__EFMigrationsHistory`). For each table, also read its **probe column**: the column with the lowest `column_id` where `sys.columns.is_identity = 0`, `is_computed = 0`, and the type (`TYPE_NAME(system_type_id)`) is not `timestamp`/`rowversion`. SQL Server rejects `SET` on those three kinds while it compiles the statement (for example Msg 8102 on the identity `Id` of `AspNetRoleClaims` and `AspNetUserClaims`, snapshot lines 1840-1846 and 1865-1871), before it checks permissions. **If a table has no such column, the test fails and names the table.** It never skips the table, and it never uses another statement form. Today every table has one: for example `AspNetRoleClaims` → `RoleId`, `AspNetUserClaims` → `UserId`, `__EFMigrationsHistory` → `MigrationId`, and `id` or `Id` everywhere else. Assert at least the 26 tables of 2.5 are present. As the host's login, for every (table, SELECT/INSERT/UPDATE/DELETE) pair **except** the six granted (`contact_requests` INSERT; `application_counts` SELECT, INSERT, UPDATE; `vacancies` SELECT; `site_settings` SELECT), run the statement and assert it throws 229. Every statement runs in a rolled-back transaction: `SELECT TOP (1) 1 FROM dbo.[t]`, `INSERT INTO dbo.[t] DEFAULT VALUES`, `UPDATE dbo.[t] SET [<probe>] = [<probe>] WHERE 1 = 0`, `DELETE FROM dbo.[t] WHERE 1 = 0`. `DEFAULT VALUES` on a table with an identity column is valid T-SQL. Missing NOT NULL values are a run-time error (515), raised after the permission check. The test collects every failure, with the table, the operation and the error number, and reports them all in one message. This sweep covers any table added later |
| T-5 | `Its_permissions_are_exactly_the_four_grants` | Elevated, in one batch: capture the names of all non-shipped objects in a table variable; `EXECUTE AS USER = N'dh_public_forms'`; `fn_my_permissions(<object>, N'OBJECT')` for each (where `subentity_name = N''`), then `fn_my_permissions(N'dbo', N'SCHEMA')` and `fn_my_permissions(NULL, N'DATABASE')`; `REVERT`. (a) The object set equals exactly `{application_counts:INSERT, application_counts:SELECT, application_counts:UPDATE, contact_requests:INSERT, site_settings:SELECT, vacancies:SELECT}`. (b) The schema and database sets equal those of a probe user `iso3_probe_<8 hex>`, created `WITHOUT LOGIN` by the test for this comparison, measured the same way and dropped in `finally`. So the login holds nothing at database or schema level that any new user does not hold. (c) The probe's object set is empty, so nothing is granted to `public` |
| T-6 | `It_cannot_change_the_schema` | As the host's login: `CREATE TABLE dbo.iso3_probe (id int)` throws `SqlException` 262. `ALTER TABLE dbo.vacancies ADD iso3_probe int NULL` throws a `SqlException`, and elevated `COL_LENGTH('dbo.vacancies', 'iso3_probe')` is NULL afterwards. `TRUNCATE TABLE dbo.contact_requests` throws a `SqlException`, and the elevated row count is unchanged. The numbers of the last two are recorded from the run, not presumed |
| T-7 | `The_granted_operations_succeed_through_the_host` | A fixture open vacancy (`FormsDatabase.InsertVacancyAsync("published")`) and `EnsureCareersAddressAsync()`. Then through the host's own `IFormsData` (scope → `IFormsData`, which is `PublicFormsData` on the restricted login): (a) `AddContactRequestAsync` with a new id and a unique email completes, and `FormsDatabase.ContactByEmailAsync` finds exactly that row; (b) `FindVacancyAsync(open)` returns it with `Published == true`; (c) `MailboxesAsync` returns `CareersEmail == FormsDatabase.CareersAddress`; (d) `IncrementApplicationCountAsync(open, today)` twice, after which `FormsDatabase.CountAsync(open) == 2`. That is the MERGE's insert branch, then its update branch, so SELECT, INSERT and UPDATE are all used. `finally`: `DeleteContactAsync`, `DeleteVacancyAsync` (the cascade removes the count rows) |
| T-8 | `The_host_context_cannot_read_back_contact_requests` | `db.ContactRequests.AsNoTracking().AnyAsync()` on the host's `PublicFormsDbContext` throws `SqlException` 229. The INSERT-only grant holds through EF too. This is ADR point 4 ("the login refuses it") seen from the host's code |

That is 31 test cases (1 + 10 + 15 + 1 + 1 + 1 + 1 + 1). The public suite goes from
71 to 102.

### 5.2 Red-test evidence (local Release run)

At commit 1, before the migration and before the switch, run L0, then:

```
dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"
```

The expected red set R1, with the host still on `dh_content_app`:

| Test | Expected at commit 1 | Why |
|---|---|---|
| T-1 | Fail | The login name is `dh_content_app`, a member of `db_datareader` and `db_datawriter` |
| T-2, 10 rows | Fail | The SELECTs succeed: no exception |
| T-3, 15 rows | Fail | UPDATE and DELETE succeed. INSERT `DEFAULT VALUES` fails with a NOT NULL error (515), not 229. The transaction is rolled back, so no row changes |
| T-4 | Fail | Almost every pair succeeds |
| T-5 | Fail | `dh_content_app` holds SELECT, INSERT, UPDATE and DELETE on every table through its roles. The probe comparison may also fail, because `dh_content_app` is in fixed roles |
| T-6 | **Pass** | `dh_content_app` cannot change the schema either. A guard, not the subject of ISO-3 |
| T-7 | **Pass** | A wide login can do the four operations |
| T-8 | Fail | `dh_content_app` can read `contact_requests` |

Then **29 cases fail and 2 pass**: T-1 (1), T-2 (10), T-3 (15), T-4 (1), T-5 (1) and
T-8 (1) fail, and T-6 (1) and T-7 (1) pass, out of 31. If the set differs (for example, T-7 fails), the
developer stops and reports before the next commit. A test is never adjusted to reach
the planned set (P-6). The run is quoted in `implementation.md`: command, exit code, the
`Failed!/Passed!` summary and each failing name with its first assertion line.

After commit 3 and the environment step, the same command gives 31 of 31, exit 0.

**Controls** (after green, run by hand on `DigitalHubContent_Test` with the elevated
account, each undone at once, both recorded):

- **C-W (widening is caught).** `ALTER ROLE db_datareader ADD MEMBER [dh_public_forms];`
  Run the filter: T-1, T-2, T-4, T-5 and T-8 fail. Then
  `ALTER ROLE db_datareader DROP MEMBER [dh_public_forms];` and run again: 31 of 31.
- **C-N (narrowing is caught).** `REVOKE INSERT ON dbo.contact_requests FROM [dh_public_forms_role];`
  T-5 and T-7 fail. `PublicContactTests` also fails, on its 201 assertion:
  `AddContactRequestAsync` throws, nothing in `PublicContactStore.cs:69-72` catches it,
  and the route answers 500. Then
  `GRANT INSERT ON dbo.contact_requests TO [dh_public_forms_role];` and run again:
  31 of 31. T-5 confirms the grant set is back to exactly the migration's.

### 5.3 Steps and checks, by exact command

Run from the worktree root unless `api/` is said. `<server>` is the `Server` value of
the existing `ConnectionStrings:Content`. The developer reads it without printing the
password, for example with `SqlConnectionStringBuilder` in PowerShell, printing only
`DataSource`.

**L0, before every database step and every test run (the caller's lesson):**

```powershell
(Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'testhost|vstest' -or $_.CommandLine -match 'testhost|vstest' }).Count
```
must print `0`, and
```
sqlcmd -S <server> -E -C -d master -h -1 -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE database_id = DB_ID(N'DigitalHubContent_Test') AND session_id <> @@SPID"
```
must print `0`. If either is not 0, wait and re-check. Never stop a process you did
not start, and never start a run while either is non-zero. The result of both checks
goes in `implementation.md` before each run.

**Build and tools:**

| Id | Command (cwd) | Expect |
|---|---|---|
| L1 | `npm ci` (`website/`) | exit 0 |
| L2 | `dotnet build DigitalHub.slnx -c Release` (`api/`) | exit 0, 0 errors |
| L3 | `dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations add AddPublicFormsRole --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --output-dir Data/Migrations` (`api/`), then replace the empty `Up`/`Down` with 7.1 | Two new files. `git diff --stat` shows `ContentDbContextModelSnapshot.cs` **unchanged** |
| C6 | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;Encrypt=True;TrustServerCertificate=True" dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build` (`api/`), after L2 | `No changes have been made to the model since the last migration.`, exit 0 |
| L4 | `dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations script 20261020113912_AddApplicationCounts <id>_AddPublicFormsRole --idempotent --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj -o <scratchpad>/iso3-up.sql` and the same with the two ids swapped, `-o <scratchpad>/iso3-down.sql` | Each equals 7.3 except for the real migration id. The full text of both goes in `implementation.md`. **Any other difference: stop, back to the architect** |

**Hold point H-1.** Nothing is applied to any database, and no local login is created,
until the owner has seen **the migration that will be applied**, as the owner's own
request says ("Migration shown first"). The owner is shown three things, in full:

1. The committed file `api/src/DigitalHub.Api/Data/Migrations/<id>_AddPublicFormsRole.cs`
   at commit 2, with its commit hash.
2. The generated L4 scripts: `iso3-up.sql` and `iso3-down.sql` as `migrations script
   --idempotent` wrote them, not the plan's expected text. The diff against 7.3 is shown
   beside them; it must be only `<id>`.
3. The environment step 7.2, the CI lines and the local script (with no password).

The developer records in `implementation.md` the commit hash and each of the three
items, and the owner's words quoted against them with date and place. Without the
words, the developer stops and reports `BLOCKED ON OWNER` on H-1. If anything shown
changes after the owner's words, it is shown again. No agent's approval counts as the
owner's (README, P-7).

**Apply (only after H-1, only to `DigitalHubContent_Test`, elevated account):**

| Id | Command | Expect |
|---|---|---|
| L5 | L0, then `dotnet …/dotnet-ef.dll migrations list --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj --connection "Server=<server>;Database=DigitalHubContent_Test;Integrated Security=true;Encrypt=True;TrustServerCertificate=True"` (`api/`) | Only `<id>_AddPublicFormsRole` is `(Pending)`. Anything else pending: stop and report |
| L6 | `dotnet …/dotnet-ef.dll database update --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj --connection "Server=<server>;Database=DigitalHubContent_Test;Integrated Security=true;Encrypt=True;TrustServerCertificate=True"` | `Done.`, exit 0. The developer checks the catalog name in the command before running it. It is never `DigitalHubContent`, `DigitalHubContent_Studio` or `DigitalHubContent_E2e` |
| L7 | The environment step 7.2, locally | It prints nothing secret. `sqlcmd ... -E -d DigitalHubContent_Test -Q "SELECT r.name FROM sys.database_role_members rm JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id WHERE m.name = N'dh_public_forms'"` prints only `dh_public_forms_role` |

**Tests (Release, one suite at a time, L0 before each):**

| Id | Command (repo root) | Expect |
|---|---|---|
| C1 | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"` | Commit 1: R1 (5.2). After commit 3 and L7: 31 of 31 |
| C2 | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=iso3-public.trx"` | 102 of 102, exit 0. **The 71 ISO-2 tests pass now that the host is `dh_public_forms`.** That is the functional proof that the four grants are enough. If any fails because the host lacks a permission, **stop and report the mismatch. Never widen a grant** |
| C3 | `dotnet test api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=iso3-admin.trx"` | Every test passes. The count equals the base's (the CI `api-test-report` artifact of the base commit the branch sits on; `0a55da4` is run 44548957589; after a rebase onto `0488d89`, its run). The sorted `testName` list's sha256 equals the base's, as in ISO-1/ISO-2 C3/C4. `AuditLogPermissionTests` passes unchanged |
| C4 | Controls C-W and C-N (5.2) | As stated |

**Static and scope checks:**

| Id | Command | Expect |
|---|---|---|
| C11 | `git diff --stat origin/rebuild/dotnet-platform...HEAD` and `git diff --name-only ... -- api/src api/tests/DigitalHub.Api.Tests studio website packages api/tools .github/security` | Only section 4 files. The second list holds only the two migration files |
| C12 | `git grep -n "CiOnlyForms2026Passw0rd"` | Only in `.github/workflows/ci.yml`. No real password anywhere: `git log -p origin/rebuild/dotnet-platform..HEAD` is checked by eye and by gitleaks (C17) for any `Password=` that is not a `CiOnly…` value |
| C14 | `actionlint .github/workflows/ci.yml` if installed locally; otherwise NOT RUN, and CI's `workflow-lint.yml` covers it | exit 0 |
| C16 | Semgrep as ISO-2 ran it (1.180.0) on the changed files, or NOT RUN with CI's Security workflow named | 0 new findings |
| C17 | CI Security workflow, job `gitleaks-pr` | Pass |

**CI evidence, on the PR head (after the owner confirms the push):**

| Job / step | Expect |
|---|---|
| `api`: "Create the test database and the restricted logins", "Apply migrations", **"Migration checks"** (blocking): steps 3 (script twice), 4a/4b (from N-1 and from the base), 5 (down to N-1 and up again, which runs `Down` then `Up`), 6 | All pass |
| `api`: the new membership step | exit 0 |
| `api`: "Integration tests (Release)" | `api-tests.trx` `failed="0"`, the base's total |
| `api`: "Public API integration tests (Release)" | `public-api-tests.trx` `failed="0"`, `total="102"` |
| `studio` (end-to-end, which applies every migration to `DigitalHubContent_E2e`) | Passes, the base's count. Local end-to-end is NOT RUN: the harness fails at "Release migrations" (2.8) |
| `website`, Security, CodeQL, Workflow lint | Pass |

### 5.4 Track checklist (G2, from `docs/changes/README.md`)

| Checklist item | How this change meets it |
|---|---|
| Follow `docs/adr/0001-split-public-forms-api.md` | Point 3: the four grants, nothing else, as a migration shown first (3.1, 7, H-1). Point 4 is untouched, and T-8 shows the login refusing what the context does not map. Points 1, 2, 5 and 6 are unchanged |
| ISO-1 changes no behaviour: all integration and end-to-end tests pass | Not ISO-1, but kept: C3 (admin suite unchanged, same names), C2 (the 71 ISO-2 public tests unchanged), CI `studio` |
| The public API answers only the two form routes, and a test proves every other path returns 404 | Unchanged. `PublicRouteTests` stays in C2 |
| The `dh_public_forms` login is proven unable to read users, roles, sessions or audit, or to change content | T-2 (users, roles, sessions, audit and the inbox), T-3 and T-4 (no change to any content or other table), T-6 (no schema change), T-5 (exact effective set), T-1 (no fixed role). Controls C-W and C-N show the tests can fail |
| ISO-4 merges only after ISO-5 | Not affected |

## 6. Security impact

- **Routes:** none changed. The public API keeps its two routes (`PublicRouteTests`).
- **Policies:** none changed.
- **Data:** the public forms process loses access to everything except the four tables,
  and to every operation but the six granted (in tests now; in service at Phase D).
  This is the purpose of the change: a flaw in the public code can no longer read
  users, sessions, audit, the contact inbox or content, or change any of it.
- **Logins:** one new SQL login, `dh_public_forms`. It has a user only in
  `DigitalHubContent_Test` (locally and in CI) and a single role. One new database role,
  `dh_public_forms_role`, in every catalog that runs the migration. It is harmless with
  no member. `dh_content_app` is unchanged. The admin API's copies of the two routes
  still run on it until ISO-4 (R-4).
- **Secrets:** the local password is generated at random, set once, never printed or
  committed, and stored only in user-secrets (7.2). The CI value is workflow-only, like
  the existing ones. The production password is Phase D's, in the server's secret
  store. gitleaks (C17) and C12 check the diff.
- **Dependencies:** none added. `Microsoft.Data.SqlClient` is already used by the test
  project (`FormsDatabase.cs`).
- **Workflows:** `ci.yml` job `api` gains one env pair, one connection string, one
  `CREATE LOGIN` line and one step. There is no new action, so no pin is needed.
  actionlint covers it.

## 7. Migrations

One migration, `<timestamp>_AddPublicFormsRole`, in the admin API's chain. **Where it
is applied by this change:**

- Locally: `DigitalHubContent_Test` only, with the elevated (Windows) account, after
  hold point H-1 (5.3, L5-L6).
- CI: the throwaway container's `DigitalHubContent_Test` ("Apply migrations"), the
  migration-checks scratch catalogs `MigrationCheck_*`, and the `studio` job's
  `DigitalHubContent_E2e`, all with `sa` in containers that are discarded.
- **Never `DigitalHubContent`.** Also not `DigitalHubContent_Studio` or a local
  `DigitalHubContent_E2e`. Applying it to those later is the owner's step, outside this
  change.

The application never migrates at startup. Neither `Program.cs` changes.

### 7.1 The migration, C#

`api/src/DigitalHub.Api/Data/Migrations/<timestamp>_AddPublicFormsRole.cs`:

```csharp
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <summary>
    /// ISO-3 (ADR 0001, point 3): the role behind the dh_public_forms login, with
    /// exactly the public forms' grants. The login, its user and its membership are
    /// created by the elevated account outside migrations, because the login's
    /// password is a secret (docs/security-deployment.md).
    /// </summary>
    public partial class AddPublicFormsRole : Migration
    {
        // EXEC: the idempotent script compiles each statement only when it runs.
        // No IF NOT EXISTS: a role of this name that already exists may carry
        // grants nobody reviewed, so the migration fails instead (P-5).
        private const string CreateRoleSql = @"
CREATE ROLE [dh_public_forms_role] AUTHORIZATION [dbo];
GRANT INSERT ON [dbo].[contact_requests] TO [dh_public_forms_role];
GRANT SELECT, INSERT, UPDATE ON [dbo].[application_counts] TO [dh_public_forms_role];
GRANT SELECT ON [dbo].[vacancies] TO [dh_public_forms_role];
GRANT SELECT ON [dbo].[site_settings] TO [dh_public_forms_role];";

        // A role with members cannot be dropped, so its members (the environment's
        // users) are removed from it first. The users themselves are left alone.
        private const string DropRoleSql = @"
DECLARE @members TABLE (name sysname NOT NULL);
INSERT INTO @members (name)
SELECT m.name
FROM sys.database_role_members AS rm
JOIN sys.database_principals AS r ON r.principal_id = rm.role_principal_id
JOIN sys.database_principals AS m ON m.principal_id = rm.member_principal_id
WHERE r.name = N'dh_public_forms_role';
DECLARE @member sysname, @sql nvarchar(400);
WHILE EXISTS (SELECT 1 FROM @members)
BEGIN
    SELECT TOP (1) @member = name FROM @members ORDER BY name;
    DELETE FROM @members WHERE name = @member;
    SET @sql = N'ALTER ROLE [dh_public_forms_role] DROP MEMBER ' + QUOTENAME(@member) + N';';
    EXEC (@sql);
END;
DROP ROLE [dh_public_forms_role];";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("EXEC(N'" + CreateRoleSql.Replace("'", "''") + "');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("EXEC(N'" + DropRoleSql.Replace("'", "''") + "');");
        }
    }
}
```

Notes:

- `EXEC (@sql)` uses a variable because `EXEC (...)` accepts only literals and
  variables, not a function call such as `QUOTENAME`.
- The loop works on a snapshot table variable, so it always ends, even if one
  `DROP MEMBER` fails. Then `DROP ROLE` fails with "the role has members", and EF rolls
  the migration back.
- `.Designer.cs` is generated by `migrations add`. Its `BuildTargetModel` is the current
  snapshot, which stays unchanged (C6, L3).

### 7.2 The environment step (not a migration; shown with it for H-1)

**CI** (in `ci.yml`, 4.2):

```sql
-- master, in "Create the test database and the restricted logins"
CREATE LOGIN [dh_public_forms] WITH PASSWORD = N'$FORMS_PASSWORD', CHECK_POLICY = OFF;
-- DigitalHubContent_Test, after the migrations, in the new step
CREATE USER [dh_public_forms] FOR LOGIN [dh_public_forms];
ALTER ROLE [dh_public_forms_role] ADD MEMBER [dh_public_forms];
```

**Locally**, once, after L6. This is a script in the session scratchpad, not committed.
It prints nothing secret. It runs in **Windows PowerShell 5.1** (`powershell.exe
-NoProfile -File <scratchpad>\iso3-login.ps1`), not PowerShell 7 and not Git Bash.
`System.Data.SqlClient` is part of .NET Framework there. First the developer checks
`$PSVersionTable.PSVersion.Major` is `5` and that
`[System.Data.SqlClient.SqlConnection]` resolves. **If the type does not load, or the
shell is not 5.1, the developer stops and reports.** The password is never passed in a
`sqlcmd` argument (`-Q`, `-v` or otherwise), an environment variable or any other
command line, and no other client is used without the plan being revised.

```powershell
$server = '<server>'          # the Server value of ConnectionStrings:Content
$bytes = [byte[]]::new(24)    # 24 bytes: 32 base64 characters, no '=' and no ';'
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = 'Pf1!' + [Convert]::ToBase64String($bytes)
$cn = [System.Data.SqlClient.SqlConnection]::new("Server=$server;Database=master;Integrated Security=true;Encrypt=True;TrustServerCertificate=True")
$cn.Open()
$cmd = $cn.CreateCommand()
# The password is a parameter, never in the command text or a log.
$cmd.CommandText = "IF SUSER_ID(N'dh_public_forms') IS NOT NULL THROW 50000, N'dh_public_forms already exists', 1;
DECLARE @sql nvarchar(max) = N'CREATE LOGIN [dh_public_forms] WITH PASSWORD = ' + QUOTENAME(@pw, '''') + N', DEFAULT_DATABASE = [DigitalHubContent_Test], CHECK_POLICY = ON;';
EXEC (@sql);"
$null = $cmd.Parameters.AddWithValue('@pw', $password)
$null = $cmd.ExecuteNonQuery()
$cmd.Parameters.Clear()
$cmd.CommandText = "USE [DigitalHubContent_Test];
CREATE USER [dh_public_forms] FOR LOGIN [dh_public_forms];
ALTER ROLE [dh_public_forms_role] ADD MEMBER [dh_public_forms];"
$null = $cmd.ExecuteNonQuery()
$cn.Close()
# Into user-secrets from standard input: not on a command line, not printed.
@{ 'ConnectionStrings:PublicForms' = "Server=$server;Database=DigitalHubContent;User ID=dh_public_forms;Password=$password;Encrypt=True;TrustServerCertificate=True" } |
  ConvertTo-Json -Compress | dotnet user-secrets set --id 41335d15-4f42-410a-bf90-41068117e45a
Remove-Variable password, bytes
# Proof without the value:
(dotnet user-secrets list --id 41335d15-4f42-410a-bf90-41068117e45a | Select-String -SimpleMatch 'ConnectionStrings:PublicForms' -Quiet)
```

The last line must print `True`. If `dh_public_forms` already exists on the server,
the script stops at the `THROW`. The developer then stops and reports: an unknown
login with an unknown password is not reused or reset without the owner. The developer
never pipes `user-secrets list` to the terminal unfiltered.

**For other catalogs** (Phase D, `DigitalHubContent_Studio` when needed), the same three
statements go in `docs/security-deployment.md`, with the password from the server's
secret store.

### 7.3 The idempotent SQL, as `migrations script --idempotent` is expected to generate it

`<id>` is the generated `<timestamp>_AddPublicFormsRole`. EF indents each line of a
`Sql` body by four spaces (GAP-06 implementation, 4.3). `ProductVersion` is `10.0.12`,
as in the existing Designer files. L4 must reproduce this text exactly, apart from
`<id>`.

**Up** (`migrations script 20261020113912_AddApplicationCounts <id> --idempotent`):

```sql
BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'<id>'
)
BEGIN
    EXEC(N'
    CREATE ROLE [dh_public_forms_role] AUTHORIZATION [dbo];
    GRANT INSERT ON [dbo].[contact_requests] TO [dh_public_forms_role];
    GRANT SELECT, INSERT, UPDATE ON [dbo].[application_counts] TO [dh_public_forms_role];
    GRANT SELECT ON [dbo].[vacancies] TO [dh_public_forms_role];
    GRANT SELECT ON [dbo].[site_settings] TO [dh_public_forms_role];');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'<id>'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'<id>', N'10.0.12');
END;

COMMIT;
GO
```

**Down** (`migrations script <id> 20261020113912_AddApplicationCounts --idempotent`):

```sql
BEGIN TRANSACTION;
IF EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'<id>'
)
BEGIN
    EXEC(N'
    DECLARE @members TABLE (name sysname NOT NULL);
    INSERT INTO @members (name)
    SELECT m.name
    FROM sys.database_role_members AS rm
    JOIN sys.database_principals AS r ON r.principal_id = rm.role_principal_id
    JOIN sys.database_principals AS m ON m.principal_id = rm.member_principal_id
    WHERE r.name = N''dh_public_forms_role'';
    DECLARE @member sysname, @sql nvarchar(400);
    WHILE EXISTS (SELECT 1 FROM @members)
    BEGIN
        SELECT TOP (1) @member = name FROM @members ORDER BY name;
        DELETE FROM @members WHERE name = @member;
        SET @sql = N''ALTER ROLE [dh_public_forms_role] DROP MEMBER '' + QUOTENAME(@member) + N'';'';
        EXEC (@sql);
    END;
    DROP ROLE [dh_public_forms_role];');
END;

IF EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'<id>'
)
BEGIN
    DELETE FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'<id>';
END;

COMMIT;
GO
```

The full idempotent script (all migrations) changes only by these appended blocks. L4
also generates the full script on the base and on the branch, and diffs them. The only
difference allowed is the new migration's blocks at the end.

## 8. Rollback

- **Code:** revert the pull request.
- **Schema, in any catalog that applied the migration:** with the elevated account,
  `dotnet-ef database update 20261020113912_AddApplicationCounts` (or the Down script
  of 7.3). That removes the role's members and drops the role and its grants.
  Locally that is `DigitalHubContent_Test` only.
- **Re-applying after a `Down`:** the user `dh_public_forms` stays in the catalog with
  no permissions. This is harmless: it can connect but reads and writes nothing. A
  later `Up` re-creates the role with **no member**, so on that catalog every form
  fails until the elevated account runs the membership line again:
  `ALTER ROLE [dh_public_forms_role] ADD MEMBER [dh_public_forms];`
  CI and the migration-checks scratch catalogs are not affected (no member, or a fresh
  container). The same note goes into the new `docs/security-deployment.md` section
  (4.2), for Phase D rollbacks and re-deploys.
- **Environment:** optional. As ADR 0001's rollback says, "the `dh_public_forms` login
  can stay, since nothing else uses it". To remove it fully:
  - in `DigitalHubContent_Test`, `DROP USER [dh_public_forms];`
  - on the server, `DROP LOGIN [dh_public_forms];`
  - `dotnet user-secrets remove ConnectionStrings:PublicForms --id 41335d15-4f42-410a-bf90-41068117e45a`.
- **CI:** nothing to undo. The container is discarded after every job.
- No data is changed by the migration or its rollback.

## 9. Owner decisions needed

None. The grants are the owner's own words. The password handling follows `AGENTS.md`
and the existing CI pattern (3.2).

**Hold point H-1, not a decision:** the owner's request requires the migration to be
shown first. The developer applies nothing, and creates no local login, until the
owner's words that they have seen 7.1-7.3 are quoted with date and place (5.3). A
tech-lead approval does not count.

F-ISO3-1 (column-level SELECT, R-6) is a possible follow-up the owner may choose to
schedule. It is not asked here, and nothing waits on it.

## 10. Risks

| Id | Risk | How the plan catches it |
|---|---|---|
| R-1 | The four grants are not enough for some path. For example, EF sends a read-back on the contact insert, or the MERGE needs more | 2.4 analysis; T-7 runs every operation through the host's own `IFormsData`; T-8; C2 runs all 71 ISO-2 tests on `dh_public_forms`. The stop rule: report, never widen |
| R-2 | A missing count grant is hidden, because the intake swallows `SqlException` and answers 201 | T-7 (d) calls the count directly and asserts 2. `PublicApplyTests` asserts stored counts. Control C-N shows the grant tests can fail |
| R-3 | The tests pass on the wrong login, for example a fallback to `dh_content_app` or a misconfigured secret | `PublicFormsTestConnectionString` has no fallback and requires `User ID=dh_public_forms`; T-1 asserts `SUSER_SNAME()`; control C-W |
| R-4 | GAP-38 looks closed while the admin API still serves the two routes on `dh_content_app` | Stated in section 1 and 6, and in the `implementation.md` hand-off. ISO-4 removes them |
| R-5 | The migration breaks a migration route: the idempotent script, Down/Up, or a catalog where the role already exists | 7.3 checked by L4; CI "Migration checks" steps 3-5 (blocking), including Down then Up; `studio` job; a pre-existing role fails loudly by design |
| R-6 | Table-level SELECT on `vacancies` lets a flaw in the public code read draft and ended vacancies. `site_settings` holds nothing secret (2.5) | Accepted as the owner's grant. Recorded as possible follow-up F-ISO3-1 (column-level SELECT on `id, title, status` and `id, email, careers_email`), not decided here |
| R-7 | A concurrent run on `DigitalHubContent_Test` by another worktree gives false failures (it happened today), or a control's temporary grant leaks into another run | L0 before every step and run; controls are undone at once and re-verified by a green run |
| R-8 | The password leaks: printed, in history, or committed | 7.2 parameterised `CREATE LOGIN`, user-secrets from stdin, filtered `list`; C12; gitleaks (C17) |
| R-9 | The idempotent script's form differs from 7.3 (EF version, line endings) | L4 diffs it; any difference beyond `<id>` goes back to the architect before H-1 |
| R-10 | T-5's `fn_my_permissions` under `EXECUTE AS USER` behaves differently than expected, for example on database-level defaults | (b) compares against a fresh probe user rather than a hard-coded list; (a) is exact and shown failing at R1; the controls show it moving both ways |

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| `dh_public_forms` has INSERT on `contact_requests` | Owner's request; refinement plan line 214; ADR 0001 point 3 | Planned | |
| `dh_public_forms` has SELECT, INSERT, UPDATE on `application_counts` | Same | Planned | |
| `dh_public_forms` has SELECT on `vacancies` and `site_settings` | Same | Planned | |
| Nothing else: its effective permissions are exactly those six | ADR 0001 point 3 ("granted only"); G2 checklist | Planned | |
| The grants are a migration, shown before it is applied; applied with the elevated account; never at startup | Owner's request ("Migration shown first"); ADR 0001 point 3; `AGENTS.md` Schema | Planned | |
| Applied only to `DigitalHubContent_Test` (locally) and CI's throwaway catalogs; never `DigitalHubContent` | `AGENTS.md` Databases; caller | Planned | |
| A permission test, like `AuditLogPermissionTests`, proves it cannot read users, roles, sessions or audit | Refinement plan line 214 ("Done when"); G2 checklist | Planned | |
| ... or change content | Same | Planned | |
| The granted operations succeed | Caller's requirement | Planned | |
| The contact path needs no SELECT; apply's needs match the four grants exactly | Caller's requirement; ISO-2 plan 3.3 | Planned | |
| The public API test suite runs as `dh_public_forms`; the fixtures keep `dh_content_app` | ISO-2 hand-off item 5; caller | Planned | |
| The password: user-secrets only locally, never printed or committed; CI workflow-only value | `AGENTS.md` Secrets; S-6; caller | Planned | |
| The test is shown failing first, for the right reason (R1), and the controls show it can fail both ways | P-4, B-6; README G3/G2 practice | Planned | |
| Admin suite and ISO-2's 71 public tests pass unchanged; migration checks and `studio` pass in CI | README "Never weaken a gate"; G2 checklist | Planned | |
| `docs/security-deployment.md`, `api/README.md` and S-8 "Enforced by" record the login | S-8; ADR 0001 Consequences | Planned | |
| No overlap with open PRs (#60; #77, merged since) | `AGENTS.md` ("Parallel changes must change different files") | Planned | |
| GAP-38, part (own login; the admin copies stay until ISO-4, deployment in Phase D) | Refinement plan line 114 | Planned | |
| Hand-off for ISO-5 (the end-to-end harness's user and membership) and Phase D | 4.4 | Planned | |

## 12. Revision log

| Round | Point raised | Answer |
|---|---|---|
| 1 | — | First version. No `plan-review.md`, `plan-approval.md` or `implementation.md` existed for ISO-3 |
| 2 | M-1 (Major): T-4's UPDATE probe used each table's first column, which is the identity `Id` on `AspNetRoleClaims` and `AspNetUserClaims`; Msg 8102 at compile time, not 229 | T-4 (5.1) now names its probe column: the lowest `column_id` with `is_identity = 0`, `is_computed = 0` and a type other than `timestamp`/`rowversion`. If a table has none, the test fails and names the table, so nothing is skipped and no other form is used. I checked the source: `InitialPlatform.cs:171-176` and `:192-197` give `RoleId` and `UserId`, and no migration has a rowversion or computed column. The four statement forms are written out, and why `DEFAULT VALUES` reaches the permission check is explained. Recount: T-4 is still one `[Fact]`, so the totals do not change (31 new cases, public suite 71 to 102). T-3 is unchanged: `[id]` is a `uniqueidentifier` with no identity on all 15 content tables |
| 2 | m-1: the red-set arithmetic | 5.2 now says "29 cases fail and 2 pass", with the count for each test. 3.4, commit 1, says "29 of 31 cases fail, 2 pass" |
| 2 | m-2: C-N's `PublicContactTests` failure point | 5.2, C-N: it fails on its 201 assertion, because the uncaught insert error (`PublicContactStore.cs:69-72`) gives a 500 |
| 2 | m-3: re-applying after `Down` | Section 8 has a new bullet: the user stays and is harmless with no permissions; a later `Up` re-creates the role with no member, so the elevated `ALTER ROLE [dh_public_forms_role] ADD MEMBER [dh_public_forms];` must be run again; CI and scratch catalogs are not affected. The same note goes into the new `docs/security-deployment.md` section (4.2) |
| 2 | m-4: the shell for the local script | 7.2 names Windows PowerShell 5.1 (`powershell.exe -NoProfile -File`), checks the version and that `System.Data.SqlClient.SqlConnection` resolves, and stops and reports if either fails. The password never goes in a `sqlcmd` argument, environment variable or any other command line, and no other client is used without a plan revision |
| 2 | m-5: what H-1 shows the owner | H-1 (5.3) lists the three things shown in full: the committed `<id>_AddPublicFormsRole.cs` with its commit hash; the real L4 `iso3-up.sql` and `iso3-down.sql`, with the diff against 7.3; and the environment step 7.2. The owner's words are recorded against them, and anything changed afterwards is shown again |

Status: Ready for plan review, round 2. No owner decision is open. Hold point H-1 (the
owner sees the committed migration file and its generated Up and Down scripts) comes
before the developer applies anything or creates the local login.
