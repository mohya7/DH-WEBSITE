# ISO-3 implementation

- Role: developer. Branch `change/ISO-3`, worktree `D:\work\DigitalHub\dh-platform-claude-iso-3`.
- Base: `0488d89` (`origin/rebuild/dotnet-platform`; re-fetched before commit 2, unchanged, no
  new migration). Records commit `83c0958 ISO-3: Plan`.
- Gate 1: `plan-approval.md` ends `Verdict: APPROVED`. Release only throughout. Nothing pushed.
  Never `DigitalHubContent`: every database step named `DigitalHubContent_Test`.

## 1. What changed, by plan Scope (section 4)

| File | Scope | Commit |
|---|---|---|
| `api/tests/DigitalHub.PublicApi.Tests/PublicFormsPermissionTests.cs` (new) | 4.1, T-1 to T-8 (31 cases) | `d174aee`, `dd9a1f3` |
| `api/tests/DigitalHub.PublicApi.Tests/FormsDatabase.cs` | 4.2: `DeleteContactAsync`; class comment | `d174aee`; `65cc420` |
| `api/src/DigitalHub.Api/Data/Migrations/20261119155407_AddPublicFormsRole.cs` (new) | 4.1, plan 7.1 verbatim | `8e162f8` |
| `api/src/DigitalHub.Api/Data/Migrations/20261119155407_AddPublicFormsRole.Designer.cs` (new) | 4.1, generated | `8e162f8` |
| `api/tests/DigitalHub.PublicApi.Tests/PublicApiFactory.cs` | 4.2: `PublicFormsTestConnectionString()`, line 19 uses it, class and line-24 comments | `65cc420` |
| `.github/workflows/ci.yml` (job `api` only) | 4.2 (a) `FORMS_LOGIN`/`FORMS_PASSWORD`; (b) `ConnectionStrings__PublicForms` and the env comment; (c) step renamed "... the restricted logins" with the second `CREATE LOGIN`; (d) new step "Add the public forms login to its role, and nothing else" | `65cc420` |
| `docs/security-deployment.md` | 4.2: new section "Database: the public forms login" | `ba948b1` |
| `api/README.md` | 4.2: line 5 | `ba948b1` |
| `ENGINEERING_STANDARDS.md` | 4.2: S-8 "Enforced by" only | `ba948b1` |
| `docs/changes/ISO-3/implementation.md` | 4.1, this file | commit 5 |

## 2. Commits

| # | SHA | Subject |
|---|---|---|
| records | `83c0958` | ISO-3: Plan |
| 1 (red) | `d174aee` | ISO-3: Test that the public forms login cannot read users or change content |
| 2 | `8e162f8` (`8e162f894eab4c3b7dfc9771dfd1a807bd2703f0`) | ISO-3: Add the dh_public_forms_role migration |
| 3 | `65cc420` | ISO-3: Run the public forms API's tests as dh_public_forms |
| 4 | `ba948b1` | ISO-3: Record the dh_public_forms login in the deployment notes |
| 3a (fix) | `dd9a1f3` | ISO-3: Give the permission test's commands a literal SQL text (C16 finding, section 7) |
| 5 | the commit that adds this file (head) | ISO-3: Implementation record |

## 3. Before H-1

**L0** (session start, and 19 Nov 2026 17:52 +02:00): testhost/vstest processes `0`; other
sessions on `DigitalHubContent_Test` `0`. Server `localhost` (from `ConnectionStrings:Content`
via `SqlConnectionStringBuilder`, only `DataSource` printed).

**L1** `npm ci` (website/): exit 0.

**L2** `dotnet build DigitalHub.slnx -c Release` (api/): exit 0, 0 errors (13 existing warnings;
the public test project alone, `--no-incremental`: 0 warnings). Again with the migration: exit 0.

**R1 / C1 at commit 1** `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"`:
exit 1, `Total tests: 31, Passed: 2, Failed: 29`, as plan 5.2 expects.

| Test | Result | First assertion line |
|---|---|---|
| T-1 | Fail | `Expected: "dh_public_forms"` / `Actual: "dh_content_app"` |
| T-2 x10 | Fail (10) | e.g. `SELECT on AspNetUserClaims: expected error 229, got no error (the statement ran).` |
| T-3 x15 | Fail (15) | e.g. `INSERT on blog_posts: expected error 229, got error 515` / `UPDATE ... got no error` / `DELETE ... got no error` |
| T-4 | Fail | `100 table operations were not denied:` (102 pairs; the 2 denied are `audit_log` UPDATE and DELETE, the existing DENY). No Msg 8102: the probe column works on `AspNetRoleClaims`/`AspNetUserClaims` |
| T-5 | Fail | `Collections differ` ... `Actual: ["AspNetRoleClaims:DELETE", "AspNetRoleClaims:INSERT", ...]` |
| T-6 | Pass | |
| T-7 | Pass | |
| T-8 | Fail | `Assert.Throws() Failure: No exception was thrown` |

After the run, elevated and read-only: `iso3_probe_%` principals `0`; `dh_public_forms` user,
role and server login `0`; `OBJECT_ID('dbo.iso3_probe')` and `COL_LENGTH('dbo.vacancies','iso3_probe')` NULL.

**L3** `dotnet <dotnet-ef.dll> migrations add AddPublicFormsRole --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --output-dir Data/Migrations`:
exit 0, two new files; `ContentDbContextModelSnapshot.cs` unchanged. Up/Down replaced with 7.1
verbatim. The Designer's `BuildTargetModel` body equals the snapshot's `BuildModel` body
(2246 lines, 0 differences).

**C6** `migrations has-pending-model-changes ... --no-build`: `No changes have been made to the model since the last migration.`, exit 0.

**L4** `migrations script 20261020113912_AddApplicationCounts 20261119155407_AddPublicFormsRole --idempotent --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj -o <scratchpad>/iso3-up.sql`,
and the reverse to `iso3-down.sql`: both exit 0 (sha256 `3dca1411…d1b6b`, `efa55d9f…b1288`).
SQL text equals 7.3 with `<id>` = `20261119155407_AddPublicFormsRole`. File format: UTF-8 BOM,
CRLF on every line, one empty line after the final `GO` (with BOM and CR removed, `diff` shows
only that line: `25a26` up, `36a37` down). Full idempotent script, branch (`0 → latest`) against
base (`0 → 20261020113912_AddApplicationCounts`): 1769 vs 1795 lines, `1769a1770,1795`, 26 lines
appended and none removed; the appended block equals `iso3-up.sql`.

7.2 shell pre-check (read-only): `powershell.exe -NoProfile` major version `5`;
`[System.Data.SqlClient.SqlConnection]` resolves.

## 4. Hold point H-1

Shown to the owner (5.3, which governs over section 9, m-6): commit
`8e162f894eab4c3b7dfc9771dfd1a807bd2703f0` with the full Up and Down SQL of
`20261119155407_AddPublicFormsRole.cs`; `iso3-up.sql` (sha256 3dca1411…d1b6b) and
`iso3-down.sql` (sha256 efa55d9f…b1288) with their content; environment step 7.2 for CI and
locally, with no password; and the file-format note (UTF-8 BOM, CRLF, one trailing empty line
after the final `GO`, the only differences from 7.3 apart from the id).

Owner's words, 19 November 2026, in the Claude Code session, relayed verbatim by the
orchestrator, replying to "Have you seen the migration and SQL, and may they be applied to
`DigitalHubContent_Test`, or do you want something changed?": **"Seen, apply it"**

The owner did not rule on the format note separately and approved after seeing it. Nothing
shown has changed since.

## 5. After H-1: apply and environment

**L0** (18:14 +02:00): testhost/vstest `0`; other sessions on `DigitalHubContent_Test` `0`;
server login `dh_public_forms` `0`.

**L5** `migrations list --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj --connection "Server=localhost;Database=DigitalHubContent_Test;Integrated Security=true;Encrypt=True;TrustServerCertificate=True"`:
exit 0; only `20261119155407_AddPublicFormsRole (Pending)`.

**L6, first attempt (developer):** the same `database update` command was refused by this
session's permission system (auto-mode classifier, "Destructive or Unwanted Actions") before it
ran. Read-only check: no role, no history row. Not worked around; reported.

Owner, 19 November 2026, in the Claude Code session, replying to "Will you run the two ISO-3
database steps yourself?": **"you run it"**. The orchestrator then ran L6 and L7, and reported:

- **L0 before the steps:** 0 testhost/vstest, 0 other sessions on `DigitalHubContent_Test`, no
  `dh_public_forms` login.
- **L6** (the developer's exact command, `DigitalHubContent_Test`, Integrated Security):
  `Applying migration '20261119155407_AddPublicFormsRole'. Done.`, exit 0.
- **L7, attempt 1** (plan 7.2 script `iso3-login.ps1`, PowerShell 5.1): the SQL part succeeded
  (login, user in `_Test`, role membership). `dotnet user-secrets set` then failed on stdin:
  `Could not parse the JSON file. '0xEF' is an invalid start of a value`. Windows PowerShell 5.1
  adds a UTF-8 BOM when piping to a native program. The password had already been discarded, so
  the login was left with an unknown password. Nothing was printed. Reported to the owner before
  any fix.
- **Owner**, replying to "May I reset the dh_public_forms password with the fixed script?":
  **"Yes, reset it"**.
- **Reset attempt 1** (`iso3-login-reset.ps1`: `ALTER LOGIN` with the password as a parameter,
  `$OutputEncoding` set to UTF-8 without BOM, piped to `user-secrets set`): the same stdin
  parse failure.
- **Reset attempt 2** (`iso3-login-reset2.ps1`), succeeded: `ALTER LOGIN [dh_public_forms] WITH
  PASSWORD` with the password as a parameter; then the key `ConnectionStrings:PublicForms`
  written straight into the user-secrets store
  `%APPDATA%\Microsoft\UserSecrets\41335d15-4f42-410a-bf90-41068117e45a\secrets.json` (flat
  string keys only) with `ConvertFrom-Json`/`ConvertTo-Json`, keeping the other five keys
  (checked unchanged) and restoring the original bytes on any error. The password never went
  through a pipe, a command line or the screen. The filtered `user-secrets list` check printed
  `True`.
- **Verification as the new login on `DigitalHubContent_Test`:** `SUSER_SNAME()` and
  `USER_NAME()` = `dh_public_forms`; `HAS_PERMS_BY_NAME`: vacancies SELECT=1, contact_requests
  SELECT=0, contact_requests INSERT=1, AspNetUsers SELECT=0; login=1 user=1 role=1 member=1
  history=1.

Developer's check afterwards (elevated, read-only): the only role of `dh_public_forms` is
`dh_public_forms_role`; `iso3_probe_%` principals `0`.

## 6. Green runs (L0 before each: 0 processes, 0 other sessions)

| Id | Command | Result |
|---|---|---|
| C1 (18:25, before `dd9a1f3`) | filter `PublicFormsPermissionTests` | exit 0, `Total tests: 31, Passed: 31`. T-6 output: `ALTER TABLE dbo.vacancies ADD: error 1088`, `TRUNCATE TABLE dbo.contact_requests: error 1088` |
| C2 (before `dd9a1f3`) | full public suite, trx `iso3-public.trx` | exit 0, `Passed! - Failed: 0, Passed: 102, Skipped: 0, Total: 102`. The 71 ISO-2 tests pass on `dh_public_forms`: the four grants are enough |
| C3 | admin suite, trx `iso3-admin.trx` | exit 0, `Passed! - Failed: 0, Passed: 596, Total: 596`. Base CI run 44554202307 (`0488d89`), "Integration tests (Release)": `Total tests: 596`; public `Total tests: 71`. The sorted name list (596) hashes to `82c26110ac6da59226d8b5eb1f537865022f24b6ec258abfd98c60a5b6bd2080` here and in the base run's log. `AuditLogPermissionTests` passes, unchanged |
| C1 (18:34, at `dd9a1f3`) | filter `PublicFormsPermissionTests` | exit 0, 31 of 31; T-6 numbers `1088` and `1088` again |
| R1 re-check of `dd9a1f3` | line 19 of `PublicApiFactory.cs` temporarily set back to `TestConnectionString()` (not committed; restored with `git checkout --`, `git diff --quiet` exit 0 afterwards, rebuilt) | exit 1, `Failed: 29, Passed: 2, Total: 31`, T-4 `100 table operations were not denied`: the rewritten test still fails on the wide login, for the same reasons |
| C2 (at `dd9a1f3`) | full public suite, trx `iso3-public2.trx` | exit 0, `Passed! - Failed: 0, Passed: 102, Total: 102` |

**C4, controls C-W and C-N.** Both change a grant, so the developer stopped before them and
reported. Owner, 19 November 2026, in the Claude Code session, replying to "May the two
controls briefly change permissions on `DigitalHubContent_Test`, or should they be left to the
tester?": **"Yes, run them"**. The orchestrator ran them and reported the results below.

- **Build and check:** they ran against the `dd9a1f3` Release build, with L0 first: 0
  testhost/vstest and 0 other sessions.
- **Script:** `<scratchpad>\iso3-controls.ps1`, run in Windows PowerShell 5.1, elevated with
  Integrated Security, on `DigitalHubContent_Test`. Each change is undone in a `finally`
  block, and the grants are listed again after each undo.

False starts:

- **Run 1:** the grant-listing query failed with a collation conflict
  (`Latin1_General_CI_AS_KS_WS` vs `SQL_Latin1_General_CP1_CI_AS`). It was the script's first
  statement, so nothing had changed yet. Fixed with `COLLATE DATABASE_DEFAULT`.
- **Run 2:** C-W was applied, and the first failure printed was
  `It_cannot_read_users_roles_sessions_or_audit(table: "AspNetUserClaims") [FAIL]`. PowerShell
  5.1 then turned dotnet's stderr into a terminating error, which ended the script. The
  `finally` undid C-W, and the grants were confirmed back. C-N did not run. Fixed by running
  dotnet through `cmd /c` with `ErrorActionPreference` set to `Continue`.

Run 3, complete:

| Step | Result | Against plan 5.2 |
|---|---|---|
| Before | Grants: `application_counts` INSERT/SELECT/UPDATE, `contact_requests` INSERT, `site_settings` SELECT, `vacancies` SELECT; roleMemberships=1 | — |
| C-W: `ALTER ROLE [db_datareader] ADD MEMBER [dh_public_forms]`, then `PublicFormsPermissionTests` | Exit 1, Failed 14, Passed 17, Total 31. Failed: the 10 T-2 cases (AspNetUserClaims, AspNetUserLogins, AspNetUserTokens, RefreshTokens, AspNetRoles, AspNetRoleClaims, audit_log, AspNetUsers, AspNetUserRoles, contact_requests); T-5 `Its_permissions_are_exactly_the_four_grants`; T-1 `The_host_runs_as_dh_public_forms_in_no_fixed_role`; T-8 `The_host_context_cannot_read_back_contact_requests`; T-4 `Every_table_operation_outside_the_four_grants_is_denied` | **As expected.** The plan names T-1, T-2, T-4, T-5 and T-8, which is 1+10+1+1+1 = 14. T-3, T-6 and T-7 pass, which is right: `db_datareader` adds reads only, so writes and DDL stay denied and the granted operations still work |
| Undo: `ALTER ROLE [db_datareader] DROP MEMBER [dh_public_forms]` | Grants identical to before; roleMemberships=1 | — |
| C-N: `REVOKE INSERT ON [dbo].[contact_requests] FROM [dh_public_forms_role]`, then `PublicContactTests` plus `PublicFormsPermissionTests` | Exit 1, Failed 7, Passed 31, Total 38. Failed: T-5, T-7 `The_granted_operations_succeed_through_the_host`, and 5 `PublicContactTests` (`Known_proxy_rate_limits_each_forwarded_visitor_separately`, `Script_in_a_contact_message_is_stored_unchanged`, `Rate_limit_is_ten_per_hour_per_visitor_address`, `Forged_forwarded_for_from_a_non_proxy_is_ignored`, `Anonymous_contact_is_stored_as_new_without_an_ip`) | **As expected.** The plan names T-5, T-7 and `PublicContactTests`. The 2 contact cases that passed are the ones that store nothing (`Honeypot_returns_success_and_stores_nothing`, `Validation_rejects_missing_and_oversized_fields`, judged by name in `PublicContactTests.cs`). The report did not include the assertion lines, so the plan's "fails on its 201 assertion" is consistent with this result but not confirmed line by line |
| Undo: `GRANT INSERT ON [dbo].[contact_requests] TO [dh_public_forms_role]` | Grants identical to before; roleMemberships=1 | — |
| After both | `PublicFormsPermissionTests`: exit 0, 31 of 31 | As expected |

**Final checks by the developer** (L0 at 18:43 +02:00: 0 processes, 0 other sessions):

- **Full public suite** at `dd9a1f3`, trx `iso3-public3.trx`: exit 0,
  `Passed! - Failed: 0, Passed: 102, Skipped: 0, Total: 102`.
- **Grant state, elevated and read-only:** the role holds exactly `INSERT application_counts`,
  `INSERT contact_requests`, `SELECT application_counts`, `SELECT site_settings`,
  `SELECT vacancies` and `UPDATE application_counts`. The only role of `dh_public_forms` is
  `dh_public_forms_role`.

## 7. Static and scope checks

| Id | Result |
|---|---|
| C11 | `git diff --stat origin/rebuild/dotnet-platform...HEAD`: the section 4 files and the three plan records, nothing else. `git diff --name-only ... -- api/src api/tests/DigitalHub.Api.Tests studio website packages api/tools .github/security`: only the two migration files |
| C12 | `git grep -n "CiOnlyForms2026Passw0rd"`: `ci.yml:40` and `ci.yml:74`, plus the plan records quoting the planned value (`plan.md:372`, `:432`, `:593`, `plan-review.md:124`). `git log -p origin/rebuild/dotnet-platform..HEAD` lines with `Password=` that are not `CiOnly…`: only the plan's 7.2 template `Password=$password` and a review sentence. No real password |
| C14 | NOT RUN: `actionlint` is not installed. Covered by `workflow-lint.yml` on the PR head. The new step has the shape of the existing grant step and adds no `uses:` |
| C16 | Semgrep 1.180.0, `RUNNER_TEMP=<scratchpad>/sg sh .github/security/run-semgrep.sh`. **First run (at `ba948b1`): exit 1**, `semgrep: 4 finding(s) at the gate's level; 1 known, 3 new`, `csharp.lang.security.sqli.csharp-sqli` at `PublicFormsPermissionTests.cs:380, 388, 404` (the helpers set `CommandText` from an interpolated string). Reported here before the fix. Fixed in `dd9a1f3` (section 8). **Second run: exit 0**, `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new` |
| C17 | NOT RUN locally: gitleaks is not installed. Covered by the Security workflow's `gitleaks-pr` job |

## 8. Deviations from the plan's text (intent kept)

- **T-5 measures the host's own user.** 5.1 writes `EXECUTE AS USER = N'dh_public_forms'`; 5.2
  says T-5 fails at R1 because `dh_content_app` holds everything. The test reads `USER_NAME()`
  over the host's connection and impersonates that user: `dh_content_app` at R1 (the planned
  reason, seen), `dh_public_forms` now (T-1 asserts the name). The object set is every
  non-shipped object with no parent (`sys.objects.parent_object_id = 0`); constraints and
  triggers are not securables.
- **The probe statements are built on the server** (`dd9a1f3`, C16). The command text is a
  literal: a fixed `CASE` builds each statement, with the table and column names passed as
  parameters and quoted by `QUOTENAME`, and runs it with `EXEC`, which keeps the caller's
  permissions. The statement forms of 5.1 are unchanged; an unknown operation throws 50000, which
  fails the test. Re-checked both ways (section 6). Precedent: ISO-2's commit 6a.
- **The `FormsDatabase` class comment** moved from commit 1 to commit 3: condition 2 limits
  commit 1 to `DeleteContactAsync`, and the new wording is true only after the switch.
- **The 7.2 secret-store write** (orchestrator, section 5): the user-secret was written straight
  into `secrets.json` instead of piped to `dotnet user-secrets set`, because PowerShell 5.1's
  pipe adds a BOM that the tool rejects. The intent of 7.2 holds: the password was generated at
  random, passed to SQL only as a parameter, never printed, on a command line, in an environment
  variable or committed; only the filtered list check was shown. `docs/security-deployment.md`
  carries no password.
- **H-1 wording** (m-6): section 4 follows 5.3's three items, not section 9's shorter "7.1-7.3".

## 9. What is left

- **CI on the PR head** (after the owner confirms the push): the migration checks
  (Down then Up), the membership step, the 596 admin tests and the 102 public tests, `studio`,
  Security (gitleaks, Semgrep), CodeQL and Workflow lint. Local end-to-end is NOT RUN: the
  harness fails at "Release migrations" (plan 2.8); CI's `studio` job covers it.

## 10. Hand-off (4.4)

- **ISO-5:** the website's form tests against the public API need, in `DigitalHubContent_E2e`,
  the user `dh_public_forms` and its membership in `dh_public_forms_role`, created by the elevated
  account the way the CI step does. They also need a login on the e2e server and a
  `ConnectionStrings:PublicForms` setting for the public API process.
- **ISO-4:** the admin API's copies of the two routes still run on `dh_content_app`. GAP-38 is
  closed only in part until they are removed.
- **Phase D:** the production login, its password in the server's secret store, and the user
  and membership in the production catalog after the migration
  (`docs/security-deployment.md`, "Database: the public forms login").
- **F-ISO3-1** (for the owner, not decided): column-level SELECT on `vacancies (id, title,
  status)` and `site_settings (id, email, careers_email)`.

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| `dh_public_forms` has INSERT on `contact_requests` | Owner's request; refinement plan line 214; ADR 0001 point 3 | Done | Migration 7.1 (`8e162f8`); T-5 exact set and T-7 (a), green (section 6) |
| SELECT, INSERT, UPDATE on `application_counts` | Same | Done | Same; T-7 (d) count 2 |
| SELECT on `vacancies` and `site_settings` | Same | Done | Same; T-7 (b), (c) |
| Nothing else: exactly those six | ADR 0001 point 3; G2 checklist | Done | T-5 (a)-(c), T-4 sweep and T-1, green; C-W and C-N (section 6); final grant listing |
| Grants are a migration, shown before applied; elevated account; never at startup | Owner's request; ADR 0001; `AGENTS.md` | Done | H-1 (section 4); L6 with Integrated Security; no `Program.cs` change (C11) |
| Applied only to `DigitalHubContent_Test` locally; never `DigitalHubContent` | `AGENTS.md`; caller | Done | L5/L6 connection strings (section 5) |
| Cannot read users, roles, sessions or audit | Refinement plan line 214; G2 | Done | T-2 (10 tables) 229, green; red at R1 |
| ... or change content | Same | Done | T-3 (15), T-4, T-6, green; red at R1 |
| The granted operations succeed | Caller | Done | T-7 green; C2 102 of 102 |
| Contact path needs no SELECT; apply's needs match the grants | Caller; ISO-2 plan 3.3 | Done | T-8 (229 on read) with T-7 (a) insert succeeding; C2 |
| Public suite runs as `dh_public_forms`; fixtures keep `dh_content_app` | ISO-2 hand-off 5 | Done | `65cc420`; T-1 green |
| Password: user-secrets only, never printed or committed; CI workflow-only | `AGENTS.md`; S-6 | Done | Section 5 (no output of the value); C12 |
| Test shown failing first, for the right reason; controls both ways | P-4, B-6 | Done | R1 29/2 at `d174aee`; re-check at `dd9a1f3`; C-W 14 failed, C-N 7 failed, both as planned and both undone (section 6) |
| Admin suite and ISO-2's 71 public tests unchanged; CI migration checks and `studio` | README | Partial | C3 596, names hash equal to base; C2. CI: on the PR head, not yet pushed |
| Deployment notes, README, S-8 | S-8; ADR 0001 | Done | `ba948b1` |
| No overlap with open PRs | `AGENTS.md` | Done | C11; plan 2.9 and gate 1 |
| GAP-38, part | Refinement plan line 114 | Done (part) | Sections 1 and 10 |
| Hand-off for ISO-5 and Phase D | 4.4 | Done | Section 10 |

## 12. Round 2 (gate 2 return 1: `delivery-approval.md`, `Verdict: CHANGES NEEDED`, docs only)

| Finding | Answer |
|---|---|
| D-1 / test-report m-1 (the note claimed the test catches any extra grant or role) | `14c6221` changes only `docs/security-deployment.md`. It lists what `PublicFormsPermissionTests` checks: object-level grants on every user object, which must be exactly the six; schema `dbo` and database permissions compared with a fresh user; `sysadmin`, the six named fixed roles and the only-role check; the 229 sweep; no DDL. It also lists what the test does not check: IMPERSONATE, server roles other than `sysadmin`, server-level permissions, other schemas, column-level grants. Widening is follow-up F-ISO3-2 |
| D-1 / test-report m-4 (CI "runs the same lines") | Same commit. CI runs the same statements with a workflow-only password and `CHECK_POLICY = OFF` (`ci.yml`: `CREATE LOGIN [$FORMS_LOGIN] WITH PASSWORD = N'$FORMS_PASSWORD', CHECK_POLICY = OFF;`) |
| D-2 (no other change) | This note only. No code, test, migration or workflow change |
| D-3 (records) | `test-report.md` (Round 1) and `delivery-approval.md` committed unchanged, with this note, in the records commit |
| m-2, m-3 | Accepted by gate 2 as follow-ups F-ISO3-3 and F-ISO3-4; nothing to do here |

Evidence at `14c6221` (22 Nov 2026 10:26 +02:00):
- **L0:** 0 testhost/vstest processes and 0 other sessions on `DigitalHubContent_Test`.
- **Build:** `dotnet build api/tests/DigitalHub.PublicApi.Tests/... -c Release` exit 0, 0 warnings.
- **Permission tests:** `dotnet test ... --filter "FullyQualifiedName~PublicFormsPermissionTests"` exit 0,
  `Passed! - Failed: 0, Passed: 31, Skipped: 0, Total: 31`.
- **Database:** no database changes in this round.

Status: READY FOR TEST
