# ISO-3 plan review

## Round 1

Reviewed: `docs/changes/ISO-3/plan.md`, round 1, in the worktree
`D:\work\DigitalHub\dh-platform-claude-iso-3` on `change/ISO-3` at `0a55da4` (the base
has since moved to `0488d89`, ADM-12d, admin tests only). Read first: `docs/changes/README.md`,
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`,
`docs/security-deployment.md`, and the ISO-2 delivery approval. No earlier round exists.

### Findings, most severe first

**M-1 (Major). Section 5.1, T-4: the UPDATE probe hits an identity column on two tables and
will not give 229 on the green run.**

- What is wrong: T-4 builds `UPDATE dbo.[t] SET [<first column>] = [<first column>] WHERE 1 = 0`
  for every table, using "its first column" from `sys.tables`/`sys.columns`. On
  `AspNetRoleClaims` and `AspNetUserClaims` the first column is `Id`, an `int` identity
  column. SQL Server rejects `SET Id = Id` on an identity column with Msg 8102 ("Cannot
  update identity column") while it compiles the statement, before it checks permissions
  at execution. So once the host runs as `dh_public_forms`, those two pairs give 8102, not
  229, and T-4 fails. The planned green result (C1 "31 of 31", C2 "102 of 102") cannot be
  reached. The developer then either stops (one wasted loop) or is tempted to change the
  test after the fact, which P-6 forbids.
- Evidence: `api/src/DigitalHub.Api/Data/Migrations/ContentDbContextModelSnapshot.cs:1840-1846`
  and `:1865-1871` (`UseIdentityColumn(b.Property<int>("Id"))` for
  `IdentityRoleClaim<string>` and `IdentityUserClaim<string>`);
  `20260921223203_InitialPlatform.cs:175` and `:196` (`.Annotation("SqlServer:Identity", "1, 1")`).
  These are the only identity columns in the model. T-3 is not affected: it updates `[id]`
  on the 15 content tables, all `uniqueidentifier` without identity.
- What would satisfy me: T-4 states a probe form that cannot fail for a reason other than
  permission. For example, pick the first column with `is_identity = 0`, `is_computed = 0`
  and a type other than `rowversion` (and say what happens if a table has none), and keep
  the 229 assertion. Alternatively, accept that two named pairs use a different form and
  say which. The plan's text, not the developer, should make this choice.

**m-1 (Minor). Section 5.2, red set R1: the counts contradict the table.**

- The table marks T-1, T-2 (10 rows), T-3 (15 rows), T-4, T-5 and T-8 as failing, and T-6
  and T-7 as passing. That is 1 + 10 + 15 + 1 + 1 + 1 = **29 failing and 2 passing**, not
  "27 cases fail and 4 pass". Section 3.4 has the same set and does not state the total.
  The developer's stop rule compares the run with R1, so the plan must give one number.
- What would satisfy me: "29 fail, 2 pass", or a corrected table if 27/4 was meant.

**m-2 (Minor). Section 5.2, control C-N: the expected failure of `PublicContactTests` is
stated wrongly.**

- With INSERT revoked, `PublicFormsData.AddContactRequestAsync` throws and nothing in
  `PublicContactStore.cs` (lines 69-72) catches it, so the route answers 500. The test
  fails on its status assertion before it gets to the stored row.
- What would satisfy me: "fails" without naming the line, or "fails on its 201 assertion".
  The control is sound otherwise.

**m-3 (Minor). Section 8 (Rollback) and 7.1 `Down`: what re-applying after a rollback
needs is not said.**

- `Down` removes every member and drops the role. The `dh_public_forms` user stays in the
  catalog with no permissions. A later `Up` re-creates the role with **no** member, so
  every form fails on that catalog until the environment's `ALTER ROLE ... ADD MEMBER` is
  run again. Migration checks are unaffected, because their scratch catalogs have no
  member. A real catalog would be affected after a rollback and re-deploy (Phase D).
- What would satisfy me: one line in section 8, also carried into the
  `docs/security-deployment.md` section in 4.2, saying that re-applying the migration after
  `Down` needs the membership line run again, and that the orphaned user is harmless.

**m-4 (Minor). Section 7.2, the local script: the SqlClient type depends on the shell.**

- The script uses `[System.Data.SqlClient.SqlConnection]`. It is present in Windows
  PowerShell 5.1 (.NET Framework). Whether it loads in PowerShell 7 depends on the
  version. The plan does not say which shell runs the script, or what to do if the type
  does not load. The obvious fallback, `sqlcmd -Q` with the password in the text, would
  put the password on a command line, which R-8 is meant to prevent.
- What would satisfy me: name the shell (for example `powershell.exe`, 5.1), and add to
  the stop rule: if the type does not load, stop and report. Never put the password in a
  `sqlcmd` argument.

**m-5 (Minor). Section 5.3, H-1: say what the owner is shown.**

- H-1 says the owner sees "the migration (7.1, 7.3) and the environment step (7.2)". L4
  runs before H-1, so the developer can show the generated migration file and the real
  `migrations script --idempotent` output (Up and Down), not only the plan's expected
  text. The owner's request is "Migration shown first", which means the migration that
  will be applied.
- What would satisfy me: H-1 names the committed `<id>_AddPublicFormsRole.cs`, the L4
  Up and Down scripts, and 7.2, as shown to the owner, with the owner's quote recorded
  against them.

### Checked and found sound

- **Fit.** The "Done when" is quoted word for word from refinement plan line 214, and the
  "By" column ("Agent; migration shown first") from the same line. The four grants match
  ADR 0001 point 3 and the owner's request exactly. Calling it "part of GAP-38" is
  accurate: the admin copies stay on `dh_content_app` until ISO-4, and deployment is
  Phase D (R-4).
- **The grants equal the needs (point 3).** I read `PublicFormsData.cs`,
  `PublicContactStore.cs`, `ApplicationIntake.cs` and `ApplicationCountSql.cs`. Contact
  needs only INSERT. Every `ContactRequest` property is `ValueGeneratedNever`
  (`PublicFormsDbContext.cs:27`), and ISO-2's isolation test asserts it, so there is no
  `OUTPUT` and no read-back. Apply reads `vacancies` (`id, title, status`) and
  `site_settings` (`careers_email, email`). The MERGE needs SELECT, INSERT and UPDATE, and
  there is no `NOT MATCHED BY SOURCE`, so it needs no DELETE. The public `Program.cs` has
  no health check and no other database use (line 98). Foreign-key checks need no grant
  on the parent table. T-7 calls the count twice, which covers both MERGE branches and
  the swallowed-exception risk (R-2).
- **Migration design (point 1).** A role in the migration, with the login, user and
  membership in the environment, respects `AGENTS.md` (Schema: shown first, elevated
  account; Secrets: no password committed) and ADR 0001 ("The grants are a migration").
  The rejected alternatives are real: a user in the migration breaks every catalog without
  the login; a conditional user gives a different result per server; `WITHOUT LOGIN`
  remapping; grants in scripts; column-level grants (narrower than the owner's words);
  DENY lists.
  Every route that applies migrations uses the elevated account, so `CREATE ROLE` has the
  permission it needs: `ci.yml:92-97` (sa), `migration-checks/run.sh` (sa, scratch
  catalogs), `studio/e2e/start-api.ts:49` (elevated), `parity-snapshot.mjs:159`
  (elevated). The end-to-end and parity harnesses drop and re-create their catalogs, so a
  `CREATE ROLE` with no `IF NOT EXISTS` never meets an existing role there. No test or
  tool uses `EnsureCreated` or reverts migrations on `DigitalHubContent_Test`.
  `Up`/`Down` follow the `EXEC(N'...')` convention. The quotes are doubled correctly in
  7.3. `Down` is a real reverse and ends, because the loop runs over a snapshot. CI step
  ordering works: migrations, then migration checks, then the existing grant step, then
  the new membership step, all before the tests. The newest base migration is
  `20261020113912_AddApplicationCounts`, as stated.
- **CI password (point 2).** `CiOnlyForms2026Passw0rd` follows the existing pattern
  (`SA_PASSWORD`, `APP_PASSWORD`, and the `Password=` in `ConnectionStrings__Content`). It
  is covered by the file header (`ci.yml:7-9`) and exists only in the job's discarded
  container. The login is created only there and in local `DigitalHubContent_Test`, so the
  value cannot reach any real catalog. gitleaks has no custom config. The
  `gitleaks-history` job is green on the base (Security runs 44554202167 and 44548957597,
  success) with identical-shaped literals of similar entropy (4.06 against 4.01 for
  `CiOnlyApp2026Passw0rd`). No `known-findings.json` entry is needed, and C17 confirms it
  on the PR. The local password is random, set through a parameter, sent to user-secrets
  through standard input and never printed.
- **Permission tests (point 4).** Users and roles: the seven `AspNet*` tables in T-2.
  Sessions: `RefreshTokens`. Audit: `audit_log`. The inbox: `contact_requests`, by SELECT
  in T-2 and through EF in T-8. Changing content: T-3 covers all 15 content tables,
  `media` and `working_copies` included as the ADR lists them. T-4 sweeps every table and
  every operation. T-5 checks the exact effective set at object, schema and database
  level, against a probe user. T-6 checks DDL. T-1 checks fixed roles and the login name,
  so the suite cannot pass on the wrong login (R-3), and the factory has no fallback. I
  confirmed the table list: 26 tables in the snapshot, the same as section 2.5. All
  database tests share the `PublicFormsSql` collection with `DisableParallelization`, so
  T-3's row-count checks are stable. Controls C-W and C-N show the tests failing both ways
  after green, on top of the red run. Apart from M-1 and m-1, every expected red result is
  right: `dh_content_app` has `db_datareader` and `db_datawriter`, and is denied only
  UPDATE and DELETE on `audit_log`.
- **Hold point H-1 (point 5).** Nothing is applied and no login is created until the
  owner's own words are quoted with date and place. A tech-lead approval is excluded, and
  without the words the result is BLOCKED ON OWNER. CI applies the migration only after
  the owner confirms the push.
- **Scope (B-8).** One topic. Every file to change exists:
  `PublicApiFactory.cs:19,24-25`, `FormsDatabase.cs:5-9,14`, `ci.yml`, `docs/security-deployment.md`,
  `api/README.md` line 5, S-8 at `ENGINEERING_STANDARDS.md:86`. The test project's
  user-secrets id matches (`41335d15-...`). Every public factory derives from
  `PublicApiFactory`. There is no overlap with #60 (`studio/e2e/redirects.spec.ts`) or #77.
- **Gates (P-6).** No gate, baseline or existing test is weakened.
  `AuditLogPermissionTests` and the admin suite are untouched (C3, same names hash). There
  is no new action to pin, and no new gate. Migration checks block now, and this change
  passes through them.
- **Commands.** Every `dotnet test` and `build` is Release. The dotnet-ef dll route
  matches the local constraint. L0 enforces one session on `DigitalHubContent_Test`.
  `DigitalHubContent`, `_Studio` and local `_E2e` are excluded by name in L6 and in
  section 7.
- **Owner decisions.** None is needed: the grants are the owner's own words. F-ISO3-1
  (column-level SELECT, R-6) is recorded correctly as a possible follow-up, not as a
  decision taken.

Round 1 result: CHANGES NEEDED (M-1). The verdict line was moved to the end of the file
in Round 2, so the file ends with exactly one verdict line.

## Round 2

Reviewed: `docs/changes/ISO-3/plan.md`, revised for round 2 (header, section 12 rows
for round 2). Checked against the code in the same worktree.

### Round 1 findings

| Finding | Resolved | Evidence |
|---|---|---|
| M-1, T-4 probe column | Yes | T-4 (5.1) now uses, for each table, the column with the lowest `column_id` that has `is_identity = 0` and `is_computed = 0` and is not `timestamp` or `rowversion`. It fails and names the table when there is none: no skip, no other form. I checked that every probe column reaches the permission check. The only identity columns in the chain are `InitialPlatform.cs:175` and `:196`. No migration has a rowversion or computed column (grep over every non-Designer migration). In `InitialPlatform.cs:171-197` the next columns are `RoleId` and `UserId`, both `nvarchar(450)`, and `SET RoleId = RoleId WHERE 1 = 0` compiles. Foreign keys are checked at run time, after permissions. `__EFMigrationsHistory` gives `MigrationId`, and every other table gives a plain `id`/`Id` that is not an identity. `INSERT ... DEFAULT VALUES` compiles on every table; the 515 error is raised at run time, after the 229 check. `SELECT TOP (1) 1` and `DELETE ... WHERE 1 = 0` do not depend on any column. On the green run, every non-granted pair therefore reaches the permission check and gives 229. T-3 is unchanged and correct (`[id]`, `uniqueidentifier`, on all 15 content tables). The totals stay at 31 new cases and 71 to 102. |
| m-1, red-set count | Yes | 5.2 now says "29 cases fail and 2 pass", with the count per test. 3.4, commit 1, says the same. |
| m-2, C-N failure point | Yes | 5.2, C-N: fails on the 201 assertion, because the uncaught insert error gives a 500 (`PublicContactStore.cs:69-72`). |
| m-3, re-applying after `Down` | Yes | Section 8 has a new bullet: the orphaned user is harmless; after `Up` the membership line must be run again; CI and scratch catalogs are not affected. The same note goes into the `docs/security-deployment.md` section (4.2). |
| m-4, shell | Yes | 7.2 names Windows PowerShell 5.1 (`powershell.exe -NoProfile -File`). It checks `PSVersion.Major` and that `System.Data.SqlClient.SqlConnection` resolves. If either fails, the developer stops and reports. The password never goes in a `sqlcmd` argument, an environment variable or any other command line. |
| m-5, H-1 contents | Yes | The sequence in 5.3 is right. Commit 2 commits the migration. L4 generates the real idempotent Up and Down scripts. H-1 then shows the owner three things in full: the committed `<id>_AddPublicFormsRole.cs` with its commit hash; `iso3-up.sql` and `iso3-down.sql` as generated, with the diff against 7.3; and the environment step 7.2. The owner's words are recorded against them, and anything that changes afterwards is shown again. Only then come L5 and L6 (apply) and L7 (the login). Nothing is applied and no login is created before it, and an agent's approval does not count. |

### New in the revision

**m-6 (Minor, non-blocking). Section 9, H-1 note: shorter than 5.3.** Section 9 still
says the owner has seen "7.1-7.3". Section 5.3 now says the committed file and the
generated scripts. Section 5.3 is the stricter text, so it governs (README: the stricter
rule applies). The developer should follow 5.3, and the two can be aligned in
`implementation.md` without another plan round.

Nothing else in the revision weakens a test, gate or boundary. The added T-4 text only
narrows how the probe column is chosen, and it keeps the fail-closed rule (P-5): a table
with no usable column fails the test instead of being skipped. Scope, the migration text
(7.1, 7.3), the CI lines, the grants and the commands are unchanged from round 1, which I
found sound there.

Verdict: APPROVED
