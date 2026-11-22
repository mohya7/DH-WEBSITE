# ISO-3 test report

- Role: tester (step 5). I did not build this change.
- Track: G2, isolation (ADR 0001, point 3).

## Round 1

- **Commit tested:** `6ffff507dfe00a61f583dd0e7ca50e15e698fb68` (`6ffff50 ISO-3: Implementation record`),
  on base `0488d89`. The base has since moved to `1a2fe2e` (GAP-11c, #78, website files only, no
  migration). That commit shares no path with ISO-3, so it was not merged in for this round.
- **Red commit:** `d174aee`.
- **Where:** a detached worktree `D:\work\DigitalHub\dh-platform-claude-iso-3-test`, made with
  `git -C D:\work\DigitalHub\dh-platform worktree add --detach ... 6ffff507...` and removed at the end
  with `git worktree remove`. The developer's worktree was used only to write this file.
- **Databases:** `DigitalHubContent_Test` only, for the test runs and the probes. `DigitalHubContent`
  got read-only catalog queries (`sys.database_principals`, `sys.database_permissions`) and nothing
  else. I changed no grant, role, login, user or schema, and I did not repeat controls C-W or C-N.
- **Build and run:** Release only. dotnet-ef ran through
  `~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll`. No push, no migration.
- **Secrets:** I never printed the `ConnectionStrings:PublicForms` value. My probe script read it from
  the user-secrets file, forced the catalog to `DigitalHubContent_Test`, refused any login other than
  `dh_public_forms`, and printed only error numbers, messages and row counts.
- **Evidence files** (session scratchpad,
  `C:\Users\alimo\AppData\Local\Temp\claude\5edc2c132a17319a\843d8246-50fc-43f1-840c-04c1bf9c3785\scratchpad\`):
  `red.log`, `c1.log`, `c2.log`, `c3.log`, `iso3-test-public.trx`, `iso3-test-admin.trx`,
  `t-up.sql`, `t-down.sql`, `semgrep.log`, `probe.out`, `probe2.out`.

### L0 before every run

L0 ran before each test run and each probe run, every time with the same result:

- `testhost`/`vstest` processes: 0, by `Get-CimInstance Win32_Process` filtered on the process name,
  or on `dotnet.exe` with testhost or vstest in its command line. The plan's one-line filter also
  matches the shell that runs it: it printed 4, and all 4 were my own query's `bash`/`powershell`.
- Other sessions on `DigitalHubContent_Test`:
  `sqlcmd -S localhost -E -C -d master -Q "... sys.dm_exec_sessions WHERE database_id = DB_ID(N'DigitalHubContent_Test') AND session_id <> @@SPID"`
  printed `0`.

### 1. Database state, read-only, before any run

Run elevated (Integrated Security) with `sqlcmd`, SELECT only.

| Check | Result |
|---|---|
| `sys.database_permissions` in `_Test` for grantee `dh_public_forms` or `dh_public_forms_role`, every class | `DATABASE GRANT CONNECT` (user); `OBJECT_OR_COLUMN GRANT` INSERT, SELECT, UPDATE `application_counts`; INSERT `contact_requests`; SELECT `site_settings`; SELECT `vacancies` (role), all with `minor_id 0`. **Exactly the six, plus the user's CONNECT** |
| Grants to `public` or `guest` on user objects in `_Test` | none |
| Roles of `dh_public_forms` | `dh_public_forms_role` only. Members of `dh_public_forms_role`: `dh_public_forms` only |
| Principals | `dh_public_forms_role` is a DATABASE_ROLE owned by `dbo`. `dh_public_forms` is a SQL_USER with default schema `dbo`, authentication INSTANCE |
| Schemas or objects owned by the user or role | none |
| Views, procedures, functions or synonyms in `_Test` (the ownership-chaining surface) | none |
| `_Test` settings | `is_trustworthy_on = 0`, `is_db_chaining_on = 0`, containment NONE |
| `__EFMigrationsHistory` | `20261119155407_AddPublicFormsRole`, `10.0.12` |
| Server login `dh_public_forms` | SQL_LOGIN, enabled, `is_policy_checked = 1`, default database `DigitalHubContent_Test` |
| Server role memberships of the login | none |
| `sys.server_permissions` of the login | `CONNECT SQL` only |
| Every online database: guest CONNECT, a `dh_public_forms` user, a `dh_public_forms_role` | `DigitalHubContent`: 0 / 0 / 0. `_Test`: 0 / 1 / 1. `_E2e`, `_Studio`, `_Parity`, `_CursorStudio`, `DigitalHubHiring`, `model`: 0 / 0 / 0. `master`, `msdb`, `tempdb`: guest 1, the SQL Server default |

**`DigitalHubContent` has no `dh_public_forms` user and no `dh_public_forms_role`.** Nothing was
written to it.

### 2. The red test was red (commit `d174aee`)

`git checkout --detach d174aee` in the test worktree, then `dotnet build DigitalHub.slnx -c Release`
(`api/`): exit 0, 0 errors, 13 warnings. L0: 0 / 0. Then:

```
dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"
```

Exit 1, `Failed!  - Failed: 29, Passed: 2, Skipped: 0, Total: 31`. **This is the plan's R1 (5.2),
and each test fails for the reason the plan gives:**

| Test | Result | First assertion line |
|---|---|---|
| T-1 | Fail | `Assert.Equal() Failure: Strings differ`, at position 3: `dh_content_app` against `dh_public_forms` |
| T-2, all 10 | Fail | for example `SELECT on AspNetUsers: expected error 229, got no error (the statement ran).` |
| T-3, all 15 | Fail | for example `INSERT on vacancies: expected error 229, got error 515` / `UPDATE on vacancies: expected error 229, got no error` |
| T-4 | Fail | `100 table operations were not denied:` (the first line: `__EFMigrationsHistory SELECT ... got no error`) |
| T-5 | Fail | `Assert.Equal() Failure: Collections differ` |
| T-6, T-7 | Pass | |
| T-8 | Fail | `Assert.Throws() Failure: No exception was thrown` |

Afterwards, read-only: no `iso3_probe%` principals, `OBJECT_ID('dbo.iso3_probe')` NULL,
`COL_LENGTH('dbo.vacancies','iso3_probe')` NULL.

### 3. The test plan at the head (`6ffff50`)

`git checkout --detach 6ffff507...`, `git status --short` empty; then
`dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors. `npm ci` in `website/` ran first: exit 0.

| Id | Command (repo root unless noted; L0 0 / 0 before each) | Exit | Output |
|---|---|---|---|
| C1 | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests" --logger "console;verbosity=detailed"` | 0 | `Total tests: 31`, `Passed: 31`. T-6 output: `ALTER TABLE dbo.vacancies ADD: error 1088`, `TRUNCATE TABLE dbo.contact_requests: error 1088` |
| C2 | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=<scratchpad>/iso3-test-public.trx"` | 0 | `Passed!  - Failed: 0, Passed: 102, Skipped: 0, Total: 102` |
| C3 | `dotnet test api/tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=<scratchpad>/iso3-test-admin.trx"` | 0 | `Passed!  - Failed: 0, Passed: 596, Skipped: 0, Total: 596` |

The suites ran one after the other, never together.

**C3 against the base.** I downloaded the `api-test-report` artifact of the base CI run 44554202307
(`headSha 0488d892…`, conclusion `success`) with `gh run download`. Its `api-tests.trx` holds 596
names. Sorted (`LC_ALL=C`), they `diff` empty against this run's 596: **the admin names are
identical.** The base's `public-api-tests.trx` holds 71 names, and all 71 are in this run. The 31
extra names are all `PublicFormsPermissionTests`. `AuditLogPermissionTests` passes, unchanged.
(The developer's hash `82c26110…` could not be reproduced: the hashing method is not recorded, and
my sha256 of the sorted list depends on the line endings. The direct diff replaces it.)

**No secret in the logs.** In `red.log`, `c1.log`, `c2.log` and `c3.log`, the count of
`password=` is 0.

### 4. The migration

| Check | Command / method | Result |
|---|---|---|
| Up script | `dotnet <dotnet-ef.dll> migrations script 20261020113912_AddApplicationCounts 20261119155407_AddPublicFormsRole --idempotent --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj -o <scratchpad>/t-up.sql` (`api/`) | Exit 0. sha256 `3dca1411780c…`, the same as the developer's `iso3-up.sql`. The text is plan 7.3's Up, with `<id>` = `20261119155407_AddPublicFormsRole` |
| Down script | the same command with the two ids swapped, `-o t-down.sql` | Exit 0. sha256 `efa55d9f9000…`, the same as the developer's. The text is plan 7.3's Down |
| Model | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;..." dotnet <dotnet-ef.dll> migrations has-pending-model-changes --project ... --configuration Release --no-build` | Exit 0, `No changes have been made to the model since the last migration.` |
| Snapshot | `git diff --quiet 0488d89 HEAD -- .../ContentDbContextModelSnapshot.cs` | Unchanged |
| Designer | The body of `BuildTargetModel` in `20261119155407_AddPublicFormsRole.Designer.cs`, `diff`ed against the body of `BuildModel` in the snapshot (CR removed) | 0 differences, 2245 lines. `[Migration("20261119155407_AddPublicFormsRole")]` |

**My judgement:**

- **Up.** `CREATE ROLE ... AUTHORIZATION [dbo]` and four `GRANT` lines: the owner's grants exactly.
  Nothing at schema or database level and no `DENY`, which is right because there is no fixed-role
  membership to override. The `EXEC(N'...')` wrapper follows the repository's convention, so the
  idempotent script compiles the statements only when they run. The history guard makes a second
  run a no-op. With no `IF NOT EXISTS`, a role of that name that already exists stops the migration
  instead of being adopted (P-5). EF runs it in a transaction, and every statement in it is
  transactional.
- **Down.** It copies the members into a table variable, runs `ALTER ROLE ... DROP MEMBER` with
  `QUOTENAME(@member)` for each, then `DROP ROLE`. The member names come from the catalog and are
  `sysname` (128 characters at most), so `QUOTENAME` never returns NULL and quotes `]` correctly. The
  loop always ends. If a member cannot be dropped, `DROP ROLE` fails and the transaction rolls back.
  It leaves the user, with CONNECT and nothing else; that is harmless, and section 8 and
  `docs/security-deployment.md` both say so. The `''` doubling in the generated script is correct.
- **No member, no effect.** On a catalog with no member (`MigrationCheck_*`, `_E2e`, `_Studio`, the
  parity catalog) the role is inert.
- **Not run here:** Down and Up against a real catalog (a database change outside my authority).
  CI's blocking "Migration checks" step 5 runs them, on scratch catalogs. See finding m-2.

### 5. The Semgrep fix (`dd9a1f3`)

I read the diff `d174aee..dd9a1f3` of `PublicFormsPermissionTests.cs` and ran the gate:

`RUNNER_TEMP=<scratchpad>/sg sh .github/security/run-semgrep.sh`, Semgrep `1.180.0`: exit 0,
`semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` The known one is
`AuditRollbackTests.cs:78`, on the base. No ISO-3 file appears in the log.
`git diff 0488d89 HEAD -- .github/security .semgrepignore` is empty, so the gate was not weakened.

**My judgement: this is not an injection path.**

- **Literal command text.** Every `CommandText` in the file is a literal. The only values that vary
  are `SqlParameter`s: `@operation` (`nvarchar(32)`), and `@table`, `@column`, `@probe` and `@user`
  (`nvarchar(128)`).
- **Fixed statement forms.** `RunRolledBackAsync` builds its statement with a fixed `CASE` over
  seven forms. An unknown operation gives NULL, and `THROW 50000` fails the test. The table and
  column names enter only through `QUOTENAME(...)`, which brackets them and doubles any `]`, so a
  name can never end the identifier. A NULL table or column gives a NULL `@sql`, which also throws.
- **The caller's own permissions.** `EXEC (@sql)` runs with the permissions of whoever opened the
  connection. There is no `EXECUTE AS`, no module and no ownership chain, because dynamic SQL breaks
  chains and the catalog has no views or procedures anyway. So a probe on the host's connection is
  checked exactly as the same statement typed directly would be. My own probes confirm this: the
  same 229 errors, typed directly (section 7).
- **No user input.** The values are compile-time constants (the `InlineData` table names, `"id"`,
  the operation names), the catalog's own `sys.tables`/`sys.columns` names read on the elevated
  connection, a `Guid`-derived probe name, and `USER_NAME()` from the host connection. Nothing comes
  from an HTTP request, a file or the environment.
- **Probe user and impersonation.** `ProbeUserAsync` and `ElevatedRowCountAsync` use the same
  pattern on the elevated connection. `EXECUTE AS USER = @user` takes a variable, which is valid
  T-SQL and not concatenated. T-5 uses an unpooled connection, so an interrupted `REVERT` cannot
  leak impersonation into the pool.
- **The red test still means the same.** The statement forms are the plan's 5.1 forms unchanged.
  The wide-login re-check of `dd9a1f3` is the developer's (29 failed, 2 passed). I could not repeat
  it without editing source, since `PublicFormsTestConnectionString` refuses any login other than
  `dh_public_forms`. The C-W control, run by the orchestrator on `dd9a1f3`, also shows it failing.

### 6. `ci.yml` and the CI-only password literal

- **What changed.** In the `api` job only: top-level `FORMS_LOGIN`/`FORMS_PASSWORD`; job env
  `ConnectionStrings__PublicForms`; a second `CREATE LOGIN ... CHECK_POLICY = OFF` in the renamed
  step "Create the test database and the restricted logins"; and a new step, "Add the public forms
  login to its role, and nothing else". The new step runs `CREATE USER` and
  `ALTER ROLE [dh_public_forms_role] ADD MEMBER` in `DigitalHubContent_Test`, after "Apply
  migrations", "Migration checks" and the existing grant step, and before both test steps. The order
  is right: the role exists by then. There is no `uses:`, so nothing new to pin. `studio` and the
  other jobs are untouched.
- **Throwaway only.** The literal `CiOnlyForms2026Passw0rd` is in `ci.yml` only (`:40`, `:74`) and in
  the plan records. It reaches only the service container `mssql` of the `api` job, which is
  discarded after the job. The header (lines 7-9) already says every credential in the file is
  workflow-only.
- **Gitleaks.** It has the same shape as `CiOnlyApp2026Passw0rd` and `CiOnlySa2026Passw0rd`, which
  have been in `ci.yml` through earlier passing `gitleaks-pr` and `gitleaks-history` runs. The
  repository has no gitleaks config or allowlist (`.gitleaks.toml` is absent), so the default rules
  apply to all three alike.
- **No other password in the diff.** `git log -p 0488d89..HEAD | grep -iE "password *[=:]" | grep -v CiOnly`
  shows only placeholders (`$APP_PASSWORD`, `$FORMS_PASSWORD`, `<from the secret store>`, the plan's
  `$password` template) and prose.
- **Secrets store.** `git ls-files | grep -i secrets` is empty. The user-secrets store has 6 keys,
  and `ConnectionStrings:PublicForms` is present (key names counted; no value printed).
- **Other logs.** The four `job-*.log` files in the scratchpad come from an earlier session: 0
  password strings that are not `CiOnly`, masked or placeholders.

### 7. Probing as `dh_public_forms` (beyond the plan)

There were two probe sets: `probes.txt`, 89 probes, and `probes2.txt`, 19. Each probe ran on a new
unpooled connection as `dh_public_forms`, in `DigitalHubContent_Test`, as
`BEGIN TRAN; <probe>` followed by `IF @@TRANCOUNT > 0 ROLLBACK`. The command was
`powershell.exe -NoProfile -File <scratchpad>\probe.ps1 <scratchpad>\probes.txt` (exit 0), and the
same with `probe2.ps1` and `probes2.txt`. The results, in short:

| Area | Probes | Result |
|---|---|---|
| Identity | `SUSER_SNAME()`, `USER_NAME()`, `ORIGINAL_LOGIN()`, `DB_NAME()`; `fn_my_permissions` at server and database | `dh_public_forms` x3, `DigitalHubContent_Test`. Server: `CONNECT SQL VIEW ANY DATABASE`. Database: `CONNECT` plus the two `VIEW ANY COLUMN ... KEY DEFINITION` defaults |
| Impersonation | `EXECUTE AS USER` dbo / `dh_content_app` / guest; `EXECUTE AS LOGIN` sa / `dh_content_app`; `SETUSER 'dbo'`; `sp_setapprole` | 15517, 15517, 15517; 15406, 15406; 15157. No application roles exist (`type = 'A'`: 0) |
| Reading `contact_requests` by any route | `SELECT COUNT(*)`; `EXISTS` subquery; `INSERT ... OUTPUT inserted.id`; `OUTPUT ... INTO @t`; `INSERT ... SELECT FROM contact_requests`; `MERGE` with it as source; `UPDATE ... JOIN`; `DBCC SHOW_STATISTICS` on the PK and on the `email` statistic; `sys.dm_db_stats_histogram`; `sys.dm_db_stats_properties`; `sys.dm_db_partition_stats` | **All 229**, except: the histogram and properties return **0 rows**, and partition stats give 262. The inbox cannot be read, and its statistics cannot be read either |
| Users, sessions, audit, content | `SELECT` on `AspNetUsers` (two- and three-part names), `RefreshTokens`, `audit_log`, `working_copies` | 229 |
| Writes outside the grants | `UPDATE vacancies`/`site_settings`/`contact_requests`; `DELETE contact_requests`/`application_counts`/`__EFMigrationsHistory`; `INSERT audit_log` | 229 |
| Objects (DDL) | `CREATE TABLE`/`TYPE`/`VIEW`/`PROCEDURE`/`FUNCTION`/`SYNONYM` | 262 |
| | `CREATE SCHEMA`/`USER`/`ROLE`/`LOGIN` | 15247 |
| | DML and DDL triggers | 2104 |
| | `ALTER TABLE ADD`, `NOCHECK CONSTRAINT ALL`, `TRUNCATE`, `CREATE INDEX`/`STATISTICS` | 1088 |
| Privilege | `ALTER ROLE db_datareader`/`dh_public_forms_role ADD MEMBER`; `sp_addrolemember db_owner`; `ALTER AUTHORIZATION ON ROLE::dh_public_forms_role`; `ALTER SERVER ROLE sysadmin`; `GRANT INSERT ... TO public` | 15151 |
| | `GRANT SELECT ON AspNetUsers TO dh_public_forms` (to itself) | Raised no error, **but had no effect**: in the same transaction the next `SELECT` on `AspNetUsers` gave 229 |
| | `ALTER USER dh_public_forms WITH DEFAULT_SCHEMA = sys` | Ran (SQL Server lets a user change its own default schema). It was rolled back; afterwards `default_schema_name` is still `dbo`. With no right to create objects in any schema, a changed default schema gives no hijack |
| xp_ procedures | `xp_cmdshell`, `xp_logininfo` | 229 |
| | `xp_regread` | 22001 (Access denied) |
| | `sp_configure` change | 15247 |
| | `sp_readerrorlog` | 27219 |
| | `xp_dirtree` (local path), `xp_fileexist`, `xp_instance_regread`, `xp_msver` | **Ran**: the SQL Server defaults granted to `public` (finding m-3) |
| OPENROWSET and bulk | `OPENROWSET(BULK ...)`, `BULK INSERT` | 4834 |
| | ad hoc `OPENROWSET`/`OPENDATASOURCE` | 15281 (component off) |
| | linked servers | only the local one |
| Server metadata | `sys.dm_exec_requests` with `sql_text` | 371 |
| | `sys.dm_exec_query_stats` | 300 |
| | `sys.dm_exec_sessions` | its own session only |
| | `sys.sql_logins` | 2 rows: itself and `sa`, default visibility |
| | `sys.databases` | all 11 names (`VIEW ANY DATABASE`, default; m-3) |
| | `sys.configurations` | readable (default) |
| Catalog metadata | `sys.objects` (user tables) | only its 4 tables |
| | `sys.sql_modules` | 0 |
| | `sys.database_principals` | 16, the fixed roles and its own |
| Other databases | `USE` or three-part names into `DigitalHubContent`, `_Studio`, `_E2e`, `_Parity`, `_CursorStudio`, `DigitalHubHiring` | 916 for each |
| | `msdb.dbo.sysjobs` | 229 |
| | `msdb.dbo.backupset`, `backupmediafamily` | readable as guest (default; m-3) |
| | `master` user objects | count readable (0) |
| | temp table in `tempdb` | allowed for every login |
| Error oracles | `INSERT` with a chosen PK | a duplicate-key error would reveal whether a contact id exists |
| | `INSERT` with a chosen `handled_by_id` | 547 (FK) reveals whether an `AspNetUsers` id exists |
| | | Both need a random GUID to be guessed (A-4). Observation, not a finding |

Afterwards, elevated and read-only: the grants are still exactly the six plus CONNECT; the only role
of `dh_public_forms` is `dh_public_forms_role`; 0 `iso3_*` principals or objects; `vacancies` has no
`iso3_probe` column; 0 probe rows in `contact_requests`; 0 server roles for the login; 0 other
sessions.

### 8. Security checks from the tester's list

| Check | Command | Exit | Result |
|---|---|---|---|
| npm audit, website | `npm audit --audit-level=high` (`website/`) | 0 | `1 moderate severity vulnerability`, below the threshold |
| npm audit, Studio | `npm audit --audit-level=high` (`studio/`) | 0 | `found 0 vulnerabilities` |
| npm gate script, website | `RUNNER_TEMP=<scratchpad>/rt bash ../.github/security/run-npm-audit.sh website` (`website/`) | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| npm gate script, Studio | the same with `studio` (`studio/`) | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| dotnet gate script | `RUNNER_TEMP=<scratchpad>/rt bash ../.github/security/run-dotnet-audit.sh` (`api/`) | 0 | `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` (Run from the repository root first, it exits 1 with `Could not find ... DigitalHub.slnx`; CI runs it from `api/`, and so did my second run) |
| Semgrep | section 5 | 0 | 0 new |
| gitleaks | NOT RUN | | gitleaks is not installed. Covered by `security.yml` jobs `gitleaks-pr` and `gitleaks-history` on the PR head |
| actionlint | NOT RUN | | Not installed. Covered by `workflow-lint.yml` |
| Routes: role matrix, host checks, unknown fields, body size, error shape | N/A | | No route is new or changed (`git diff --stat 0488d89..HEAD` touches no controller, `Program.cs` or appsettings). `PublicRouteTests` and the ISO-2 route tests passed in C2 |
| A permission change has a test of what it cannot do | Yes | | T-2, T-3, T-4, T-6, T-8; red at `d174aee` (section 2); plus the probes in section 7 |
| No secret in the diff, logs or output | Yes | | Sections 3 and 6 |

### 9. Commands NOT RUN, and why

| Command | Reason | Covered by |
|---|---|---|
| `npm test`, `npm run typecheck`, `npm run build`, `npm run design:check`, `npm run compare:sections` (`website/`) | No file under `website/` changes (`git diff --stat 0488d89..HEAD`), and the plan names none | CI `website` and `compare-sections` jobs |
| `npm test`, `npm run build`, `npm run test:e2e` (`studio/`) | No file under `studio/` changes. Local end-to-end fails at "Release migrations" (plan 2.8), and it would write `DigitalHubContent_E2e`, which this task does not allow | CI `studio` job, which applies every migration, this one included, to its throwaway `DigitalHubContent_E2e` |
| Down then Up on a database, and the migration-checks script | Database writes, outside my authority | CI `api` job, "Migration checks" (blocking), steps 3-6 |
| Controls C-W and C-N | Owner-approved once and recorded by the orchestrator. Repeating them changes grants, which is outside my authority. I do not ask for them to be repeated: the developer's record matches the plan's expected sets (14 failed for C-W; T-5, T-7 and 5 `PublicContactTests` for C-N), and both undo steps were verified | `implementation.md` section 6 |
| The CI run on the PR head | Not pushed | CI, Security, CodeQL, Workflow lint, after the owner confirms the push |

### 10. The deviations

| Deviation (`implementation.md` 8) | Judgement |
|---|---|
| T-5 impersonates the host's own `USER_NAME()` rather than the literal `dh_public_forms` | **Accepted.** It keeps the planned red reason (seen at `d174aee`: `dh_content_app` holds everything), and T-1 pins the name to `dh_public_forms` at the head. Limiting the object set to `parent_object_id = 0` is correct: constraints and triggers are not separately grantable |
| Probe statements built on the server (`dd9a1f3`) | **Accepted.** Section 5: same statement forms, the caller's permissions, no input from outside the test. It was a fix for a gate failure, reported before it was fixed, and the gate was not weakened |
| The `FormsDatabase` class comment moved to commit 3 | **Accepted.** A comment only; condition 2 kept commit 1 to `DeleteContactAsync` |
| `secrets.json` written directly instead of piped to `dotnet user-secrets set` | **Accepted.** The cause (PowerShell 5.1 adds a BOM on the pipe) and both failed attempts were reported, and the owner allowed the reset in his own words ("Yes, reset it"). The store has the flat-key format that `user-secrets` writes; 6 keys; the tests connect through it as `dh_public_forms` (T-1). No password appears in any record, log or diff |
| H-1 wording follows 5.3, not section 9 | **Accepted** (m-6 at gate 1) |
| Not listed: the local login uses `CHECK_POLICY = ON` and `DEFAULT_DATABASE = [DigitalHubContent_Test]`, while CI uses `OFF` | **As planned** (7.2 and 4.2). I verified the local login has `is_policy_checked = 1` |

### 11. Track checklist, G2

| Item | Result |
|---|---|
| Follow `docs/adr/0001-split-public-forms-api.md` | Point 3: exactly the six permissions, in a migration that was shown first (H-1, the owner's words "Seen, apply it"). Section 1 verifies it read-only; T-5 and the probes confirm it. Point 4: T-8 and the probes show `contact_requests` cannot be read back. The other points are untouched |
| ISO-1 changes no behaviour (all integration and end-to-end tests pass) | Not ISO-1, but kept: C3 596 of 596 with names identical to the base; C2 includes the base's 71. End-to-end NOT RUN locally (CI `studio`) |
| The public API answers only its two form routes; a test proves every other path is 404 | Unchanged; `PublicRouteTests` green in C2 |
| `dh_public_forms` is proven unable to read users, roles, sessions or audit, or to change content | **Met for the catalog as it is**: red then green (sections 2 and 3), the exact grant set (section 1), and the probes (section 7). The test's power to catch some kinds of future widening is limited; see finding m-1 |
| ISO-4 merges only after ISO-5 | Not affected |

### Findings

There is no Blocker and no Major. Four Minors, most severe first.

**m-1 (Minor): the permission test does not inspect impersonation, column-level or server-level grants, and `docs/security-deployment.md` claims more than it proves.**

- **Steps (code reading; not run, because it needs a grant change outside my authority):**
  - T-5 measures `fn_my_permissions` only on objects (`OBJECT`, with `subentity_name = N''`), on
    schema `dbo`, and on the database.
  - T-1 checks the server only for `sysadmin`, and the database for six fixed roles plus the
    catalog's role list.
  - No test tries `EXECUTE AS`.
- **Expected:** any of these grants, made by an administrator by mistake, would make
  `PublicFormsPermissionTests` fail:
  - `GRANT IMPERSONATE ON USER::dh_content_app TO dh_public_forms` (a `DATABASE_PRINCIPAL` securable)
  - `GRANT IMPERSONATE ON LOGIN::sa`, or membership of `securityadmin`/`##MS_*##` (server level)
  - `GRANT SELECT ON SCHEMA::<other schema>`
  - a column-level `GRANT SELECT (PasswordHash) ON dbo.AspNetUsers`
- **Actual:**
  - The first three are outside every scope the tests measure. With an IMPERSONATE grant, all 31
    tests stay green, yet `EXECUTE AS USER = 'dh_content_app'` would read users and the inbox.
  - The column-level grant is removed by T-5's `subentity_name = N''` filter. Whether T-2's and
    T-4's `SELECT TOP (1) 1` probes catch a column-only grant is unverified.
  - `docs/security-deployment.md` says the test "fails on a catalog where the login holds more or
    less than the four grants, or is in any other role". That holds for object grants and database
    roles, not for these classes or for server roles.
- **Today's state is clean.** I checked read-only: there are no such grants (section 1).
- **Suggested direction, for the developer and architect:** an elevated, exact assertion that
  - `sys.database_permissions` for the user and the role is exactly `{CONNECT}` plus the six, all
    with `minor_id = 0`;
  - `sys.server_permissions` for the login is exactly `{CONNECT SQL}`;
  - `sys.server_role_members` for the login is empty.

  This is beyond plan 5.1's text, so it needs the architect, or a D-NNN entry recorded by the owner.

**m-2 (Minor): Down's member-removal loop is never exercised.**

- **Steps:**
  - CI "Migration checks" runs Down then Up on `MigrationCheck_*` scratch catalogs, which have no
    member, because the membership step runs later and only in `DigitalHubContent_Test`.
  - No local Down was run.
- **Expected:** the path that removes a real member (`ALTER ROLE ... DROP MEMBER [dh_public_forms]`,
  then `DROP ROLE`) runs at least once before Phase D relies on it for rollback.
- **Actual:** it runs nowhere. By code reading it is correct (section 4).
- **Suggested:** have the migration check add a member before step 5, or record a Phase D rehearsal
  in `docs/security-deployment.md`.

**m-3 (Minor, destination Phase D, not ISO-3 code): the login reaches the server's default `public` and `guest` surface.**

- **Steps:** section 7.
- **What `dh_public_forms` can do:**
  - list all 11 database names (`VIEW ANY DATABASE`);
  - connect as guest to `master`, `msdb` and `tempdb`;
  - read `msdb.dbo.backupset` and `backupmediafamily` (backup history and paths);
  - read `sys.configurations`;
  - execute `xp_dirtree`, `xp_fileexist`, `xp_instance_regread` and `xp_msver`.
- **Why it matters:** `xp_dirtree` and `xp_fileexist` with a UNC path are a known way to make the
  SQL Server service account authenticate to a host the attacker controls. I did not test a UNC
  path, which would mean reaching an outside host.
- **Expected:** in production, a forms login limited to its four tables has none of this.
- **Actual:** these are SQL Server defaults on this local server, not something ISO-3 added.
- **Suggested:** add server hardening for the production instance to the Phase D notes in
  `docs/security-deployment.md`: revoke `public` EXECUTE on those xp_ procedures, decide on
  `VIEW ANY DATABASE`, and review guest in `msdb`.

**m-4 (Minor, docs): `docs/security-deployment.md` says CI "runs the same lines", but CI's `CREATE LOGIN` uses `CHECK_POLICY = OFF`, and the documented line has `ON`.**

- **Expected:** the sentence says CI differs in its password policy, as well as using a
  workflow-only password.
- **Actual:** "the same lines".

**Observations (no action asked of the developer; for the owner, with F-ISO3-1):**

- The table-level `INSERT` on `contact_requests` lets a flaw in the public code insert rows with any
  `status`, `created_at` and `handled_by_id`, so an attacker could forge rows that look handled.
- The table-level `UPDATE` on `application_counts` lets it set any count.
- Both follow from the owner's grants as worded. Column-level `INSERT`/`UPDATE` would narrow them,
  like F-ISO3-1's column-level `SELECT`.
- The PK and FK error oracles in section 7 reveal only whether a guessed GUID exists.

### Coverage table rows verified

| Item | Source | Status | Evidence (this round) |
|---|---|---|---|
| `dh_public_forms` has INSERT on `contact_requests` | Owner's request; ADR 0001 point 3 | Verified | Section 1 grants; C1 T-5/T-7; probes `write.*` |
| SELECT, INSERT, UPDATE on `application_counts` | Same | Verified | Section 1; T-7 (d) green; `write.counts_arbitrary` ran; DELETE 229 |
| SELECT on `vacancies` and `site_settings` | Same | Verified | Section 1; T-7 (b), (c); their UPDATE gives 229 |
| Nothing else: exactly those six | ADR 0001; G2 | Verified for today's catalog | Section 1, every class including server; T-4/T-5 green. Test coverage of future widening: m-1 |
| Grants are a migration, shown first; elevated; never at startup | Owner; `AGENTS.md` | Verified | Scripts equal the H-1 hashes (section 4); history row; no `Program.cs` change |
| Never `DigitalHubContent` | `AGENTS.md`; caller | Verified | Section 1: no user, no role there; the login gets 916 there |
| Cannot read users, roles, sessions or audit | Refinement plan line 214 | Verified | Red then green T-2; probes `read.*` |
| ... or change content | Same | Verified | Red then green T-3/T-4/T-6; probes `write.*`, `ddl.*`, `priv.*` |
| The granted operations succeed | Caller | Verified | T-7; C2 102 of 102 |
| The contact path needs no SELECT | Caller; ISO-2 plan 3.3 | Verified | T-8; C2 contact tests; probes `read.contact_*` |
| The public suite runs as `dh_public_forms`; fixtures keep `dh_content_app` | ISO-2 hand-off 5 | Verified | T-1 green; `PublicApiFactory` diff; `FormsDatabase` unchanged except `DeleteContactAsync` |
| Password only in user-secrets, never printed or committed; CI workflow-only | `AGENTS.md`; S-6 | Verified | Section 6 |
| Test shown failing first, for the right reason | P-4, B-6 | Verified | Section 2: 29 failed, 2 passed, with the planned reasons |
| Admin suite and ISO-2's 71 tests unchanged | README | Verified locally | C3 names identical to base CI run 44554202307; C2 includes all 71. CI on the PR head is pending |
| Docs: deployment notes, README, S-8 | S-8 | Verified, with m-1 and m-4 | `ba948b1` diff read |

Round 1 result (superseded by Round 2 below): APPROVED. Gate 2 then returned the change for docs only (`delivery-approval.md`, D-1 to D-3).

## Round 2

- **Commit tested:** `550868878f40da8a6a16444020c078ef699acfdc` (`5508688 ISO-3: Record test round 1,
  gate 2 return 1 and the developer's answer`). It adds two commits on `6ffff50`: `14c6221`
  (`docs/security-deployment.md` only) and `5508688` (the records).
- **Where:** a new detached worktree, `D:\work\DigitalHub\dh-platform-claude-iso-3-test`, made with
  `git -C D:\work\DigitalHub\dh-platform worktree add --detach ... 5508688...` and removed at the end.
- **Databases:** no database change. The only queries were read-only checks, plus the test run.

### R2-1. Scope

| Check | Command | Result |
|---|---|---|
| Files changed | `git diff --stat 6ffff50..5508688` | `docs/changes/ISO-3/delivery-approval.md` (+277), `docs/changes/ISO-3/implementation.md` (+17), `docs/changes/ISO-3/test-report.md` (+402), `docs/security-deployment.md` (+26 −5). Nothing else |
| No code, test, migration or workflow change | `git diff --quiet 6ffff50 HEAD -- api .github studio website packages` | Exit 0: none |
| Round 1 report committed unchanged (D-3) | `diff` of the committed `test-report.md` against my Round 1 working copy, with CR removed | Identical. `cmp` differs only by CRLF line endings from checkout |
| `implementation.md` | Read the diff | Adds only section 12, the Round 2 answer table and the developer's evidence |

### R2-2. Are the two corrected statements true?

`PublicFormsPermissionTests.cs` is unchanged since Round 1 (R2-1). I checked each statement in the
new "What `PublicFormsPermissionTests` checks" and "What it does not check" lists against it.

| Statement in `docs/security-deployment.md` | In the test | True? |
|---|---|---|
| Object grants on every user object, any schema, with constraints and triggers excluded, must be exactly the six | T-5 (a). `sys.objects WHERE is_ms_shipped = 0 AND parent_object_id = 0`, every schema; `fn_my_permissions(..., 'OBJECT')` with `subentity_name = N''`; `Assert.Equal(Granted, host.Objects)` | Yes |
| Schema `dbo` and database permissions are no more than a fresh user holds | T-5 (b). `fn_my_permissions(N'dbo', 'SCHEMA')` and `(NULL, 'DATABASE')` must equal those of an `iso3_probe_*` user created `WITHOUT LOGIN` | Yes. The test checks equality, which implies "no more" |
| Not `sysadmin`, not in the six named fixed roles, only role `dh_public_forms_role` | T-1. `IS_SRVROLEMEMBER('sysadmin')`, then `IS_ROLEMEMBER` for `db_owner`, `db_datareader`, `db_datawriter`, `db_ddladmin`, `db_securityadmin`, `db_accessadmin`; then an elevated `sys.database_role_members` list that must equal `[dh_public_forms_role]` | Yes |
| SELECT, INSERT, UPDATE and DELETE on every `dbo` table outside the six pairs fail with 229 | T-4. Every `sys.tables` row in schema `dbo`, including `__EFMigrationsHistory`, against the `Granted` set | Yes |
| CREATE TABLE, ALTER TABLE and TRUNCATE are refused | T-6. `CREATE TABLE` must give 262. ALTER TABLE (on `vacancies` only) and TRUNCATE (on `contact_requests` only) must give any SQL error | Yes. One table each is probed (see m-5) |
| Not checked: IMPERSONATE on a user or login; server roles other than `sysadmin`; server-level permissions; schemas other than `dbo`; column-level grants, with the table-wide probes unverified for them | No test tries `EXECUTE AS`. T-1 checks only `sysadmin` at server level. T-5 measures only the OBJECT, `dbo` SCHEMA and DATABASE scopes, and drops rows whose `subentity_name` is not empty | Yes. This is Round 1 m-1, stated accurately, with F-ISO3-2 named |
| CI runs the same statements, with a workflow-only password and `CHECK_POLICY = OFF` on `CREATE LOGIN` | `ci.yml:97`: `CREATE LOGIN [$FORMS_LOGIN] WITH PASSWORD = N'$FORMS_PASSWORD', CHECK_POLICY = OFF;`. `ci.yml` (new step): `CREATE USER [$FORMS_LOGIN] FOR LOGIN [$FORMS_LOGIN]; ALTER ROLE [dh_public_forms_role] ADD MEMBER [$FORMS_LOGIN];`. These are the documented three statements, with no `DEFAULT_DATABASE` on either side | Yes. Round 1 m-4 is resolved |

Round 1 **m-1** (the docs part) and **m-4** are resolved. The test itself is still as limited as
before; gate 2 carries the widening as F-ISO3-2. m-2 and m-3 were accepted by gate 2 as F-ISO3-3
and F-ISO3-4.

### R2-3. No secret in the diff

`git diff 6ffff50..5508688 | grep -iE "password *[=:]|Pf1!" | grep -v CiOnly` returns only three
quotations:

- the owner's words "Yes, reset it";
- the `ci.yml` line quoted with its `$FORMS_PASSWORD` placeholder;
- my Round 1 sentence "`password=` is 0".

There is no password value.

### R2-4. Permission tests

| Step | Command | Exit | Output |
|---|---|---|---|
| Install | `npm ci` (`website/`) | 0 | |
| Build | `dotnet build DigitalHub.slnx -c Release` (`api/`) | 0 | 0 errors, 13 warnings (the existing ones) |
| L0 | process check (`l0.ps1`) and `sys.dm_exec_sessions` on `DigitalHubContent_Test` | | `testhost/vstest: 0`, `other sessions: 0` |
| C1 | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"` | 0 | `Passed!  - Failed: 0, Passed: 31, Skipped: 0, Total: 31`. 0 `password=` in the log |
| After the run, read-only | `sys.database_permissions` for the user and the role; `iso3_%` principals | | 7 rows (CONNECT plus the six); 0 probe principals |

The other suites were not re-run. No code, test or migration changed since Round 1, where they
passed: public 102 of 102, admin 596 of 596.

### Findings, Round 2

There is no Blocker and no Major.

**m-5 (Minor, docs; for F-ISO3-2): the "does not check" list is true but not complete.**

- **What is missing:** besides the classes the note lists, T-5 also does not measure:
  - ALTER, CONTROL or TAKE OWNERSHIP on database principals. For example,
    `GRANT CONTROL ON USER::dh_content_app` implies impersonation but is not literally an
    "IMPERSONATE grant".
  - Grants on non-object securables: types, XML schema collections, assemblies, certificates,
    keys.
- **A wording point:** "CREATE TABLE, ALTER TABLE and TRUNCATE are refused" is checked on one table
  each (`vacancies`, `contact_requests`), not on every table.
- **Steps:** read T-5's three scopes and T-6 in `PublicFormsPermissionTests.cs`.
- **Expected:** the list names every grant class that would leave the test green, or says the list
  is not exhaustive.
- **Actual:** it names five classes and reads as complete.
- **Suggested:** carry this into F-ISO3-2. That change's exact elevated `sys.database_permissions`
  assertion would cover all classes. No change is asked for in ISO-3.

### Coverage table rows verified, Round 2

| Item | Source | Status | Evidence |
|---|---|---|---|
| D-1: the note says what the test does and does not catch | `delivery-approval.md` D-1; test-report m-1 | Verified (one non-blocking omission, m-5) | R2-2 |
| D-1: the CI difference (`CHECK_POLICY = OFF`) is stated | D-1; m-4 | Verified | R2-2, `ci.yml:97` |
| D-2: no other change | D-2 | Verified | R2-1 |
| D-3: Round 1 report committed unchanged | D-3 | Verified | R2-1 |
| `PublicFormsPermissionTests` still 31 of 31 | Caller | Verified | R2-4 |
| No secret in the diff | S-6 | Verified | R2-3 |

Round 2 result (superseded by Round 3 below): APPROVED. Gate 2 Round 2 then asked for D-4 and D-5, docs wording only.

## Round 3

- **Commit tested:** `0ead226ec7702989813aa55caeb90d7ae179b707` (`0ead226`, the records). It sits
  on `764578a ISO-3: Say the permission test's blind spots are examples, not a full list`, which
  sits on `5508688`.
- **Where:** a new detached worktree, `D:\work\DigitalHub\dh-platform-claude-iso-3-test`, removed
  at the end.
- **Databases:** no database change. The only queries were read-only checks, plus the test run.

### R3-1. Scope and secrets

| Check | Command | Result |
|---|---|---|
| Files changed | `git diff --stat 5508688..0ead226` | `docs/changes/ISO-3/delivery-approval.md` (+99), `implementation.md` (+25), `test-report.md` (+95), `docs/security-deployment.md` (+16 −8). Nothing else |
| No code, test, migration or workflow change | `git diff --quiet 5508688 HEAD -- api .github studio website packages` | Exit 0: none |
| Round 2 report committed unchanged | `diff` against my working copy, with CR removed | Identical |
| No secret | `git diff 5508688..0ead226 \| grep -iE "password *[=:]\|Pf1!" \| grep -v CiOnly` | Only quotations from my own reports (the `ci.yml:97` line with its `$FORMS_PASSWORD` placeholder, "`password=` is 0", and a test command line). No value |

### R3-2. Every sentence of "Database: the public forms login" against the test and `ci.yml`

`PublicFormsPermissionTests.cs` and `ci.yml` are unchanged since Round 1.

| Sentence (in short) | Evidence | Verdict |
|---|---|---|
| The migration creates `dh_public_forms_role` with exactly the four grants; the login and its membership are outside migrations; the three elevated statements | `20261119155407_AddPublicFormsRole.cs` `CreateRoleSql`; Round 1, section 4 | True |
| Never add the login to another role; its only role is `dh_public_forms_role` | A rule. T-1 enforces the only-role part | True |
| "It proves these checks, and only these" | Matches the five bullets below | True |
| Object grants on every user object, in any schema, are exactly the six. **Objects that have a parent object, such as constraints and triggers, are not measured** | T-5: `sys.objects WHERE o.is_ms_shipped = 0 AND o.parent_object_id = 0` (line 456), every schema; `Assert.Equal(Granted, host.Objects)` | True. The tightened line is accurate |
| Schema `dbo` and database permissions **are the same as those of a fresh user created without a login** | T-5 (b): `Assert.Equal(empty.Schema, host.Schema)` and `Assert.Equal(empty.Database, host.Database)`. The probe is made with `CREATE USER ... WITHOUT LOGIN` (line 374) | True. The tightened line is accurate, and "the same" matches the equality assertion |
| Not `sysadmin`; not in the six named fixed roles; only role `dh_public_forms_role` | T-1 | True |
| SELECT, INSERT, UPDATE and DELETE on every `dbo` table, outside the six pairs, fail with error 229 | T-4 | True |
| **Schema changes probed:** CREATE TABLE refused with error 262; ALTER TABLE on one table, `vacancies`; TRUNCATE on one table, `contact_requests` | T-6: `create == DatabasePermissionDenied` (262). `"ALTER TABLE"` → `ALTER TABLE dbo.vacancies ADD iso3_probe`; `"TRUNCATE TABLE"` → `TRUNCATE TABLE dbo.contact_requests`; both must give a `SqlException` (1088 seen) | True. "One table each" and "262" are both stated (D-5 / m-5) |
| **Lead-in:** "The test proves only the checks above ... many mistaken grants would leave the test green. These are examples, not a complete list" | | True. The list is presented as examples, not complete (D-4) |
| Examples: IMPERSONATE on a user or login; **ALTER, CONTROL or TAKE OWNERSHIP on a user or role, with CONTROL on `dh_content_app` reaching impersonation**; **grants on non-object securables (types, XML schema collections, assemblies, certificates, keys)**; server roles other than `sysadmin`; server-level permissions; schemas other than `dbo`; column-level grants, with the table-wide probes unverified | T-5 measures only the OBJECT (with `subentity_name = N''`), `dbo` SCHEMA and DATABASE scopes; T-1 checks only `sysadmin` at server level; no test tries `EXECUTE AS` | True. The m-5 examples are present. CONTROL on a user does imply IMPERSONATE |
| F-ISO3-2 widens the test; its exact assertion would replace the examples | `delivery-approval.md` follow-up table | True. A plan statement, not a claim about the test |
| CI runs the same statements, differing by a workflow-only password and `CHECK_POLICY = OFF` on `CREATE LOGIN`; locally the login lives in `DigitalHubContent_Test` only, read from `ConnectionStrings:PublicForms` | `ci.yml:97`; the new membership step; Round 1, section 1 (the user exists only in `_Test`) | True |
| Re-applying after `Down`: Down removes the members and drops the role; "the user `dh_public_forms` stays, **with no permissions**, which is harmless"; a later `Up` re-creates the role with no member, so the forms fail until `ADD MEMBER` is run again | Down SQL (Round 1, section 4). The user's database-level `CONNECT` comes from `CREATE USER`, not from the role (Round 1, section 1: `DATABASE GRANT CONNECT` on the user) | **Not quite true: the user keeps CONNECT** (m-6). The rest is true |
| The admin API's copies of the two routes still run on `dh_content_app` until ISO-4 | ISO-2 / ISO-4 scope | True |

D-4 (the list presented as examples) and D-5 (the m-5 examples, one table each, 262) are met. Both
tightened lines are accurate. Round 2's m-5 is resolved.

### R3-3. Permission tests

| Step | Command | Exit | Output |
|---|---|---|---|
| Install | `npm ci` (`website/`) | 0 | |
| Build | `dotnet build DigitalHub.slnx -c Release` (`api/`) | 0 | 0 errors |
| L0 | process check and `sys.dm_exec_sessions` on `DigitalHubContent_Test` | | `testhost/vstest: 0`, `other sessions: 0` |
| C1 | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"` | 0 | `Passed!  - Failed: 0, Passed: 31, Skipped: 0, Total: 31`. 0 `password=` in the log |
| After the run, read-only | grants for the user and the role; `iso3_%` principals | | 7 (CONNECT plus the six); 0 |

### Findings, Round 3

There is no Blocker and no Major.

**m-6 (Minor, docs): the rollback bullet says the user stays "with no permissions", but it keeps CONNECT.**

- **Where:** `docs/security-deployment.md`, the bullet "Re-applying the migration after its
  `Down`".
- **Steps:**
  1. The Down SQL drops only the role and its grants.
  2. The user's database-level `GRANT CONNECT` comes from `CREATE USER`. Round 1, section 1 shows it
     on the user, not on the role.
- **Expected:** for example, "stays, with only CONNECT: it can log in to the catalog but read or
  write nothing, which is harmless".
- **Actual:** "with no permissions".
- **Note:** this sentence has been the same since `ba948b1`. I missed it in Round 1, when I checked
  only its intent, which is correct. It overstates nothing about the test, and the harm is nil.
  It can be fixed in a later docs change; I raise it as non-blocking.

Verdict: APPROVED
