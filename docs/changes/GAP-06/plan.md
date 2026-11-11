# Plan: GAP-06: idempotent migration script, and migration checks in CI

Architect, round 2, 1 November 2026 (round 1 the same day; the review is answered in
section 12). Change branch `change/GAP-06`, cut from
`origin/rebuild/dotnet-platform` at `6470fac` ("Careers intake: apply by email,
HR counts, end a vacancy (#33)"), with no upstream tracking.

**Files read, and where they came from.** The following governing files are not on
the base branch. I read copies of them from the session's reference folder (owner's
working tree): `.claude/agents/architect.md`, `docs/changes/README.md`, the updated
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`,
`docs/quality/admin-audit-2026-10-28.md`, `docs/deferred-items.md`,
`docs/quality/baseline-2026-10-27.md` and `docs/quality/test-report-2026-10-27.md`
(finding 4 is in the test report). `.github/pull_request_template.md` is not on the
base either. The base branch's own `AGENTS.md`/`CLAUDE.md` (lines 42–43) state the
same migration rule as the updated copy: "Show every migration before applying it.
No exceptions, however small." and "Apply with the elevated account. The
application never migrates at startup." ADR 0001 and the admin audit do not apply
here, because this change is G1, not G2 or G3. No `plan-review.md`, `plan-approval.md`
or `implementation.md` exists yet, so this is not a revision.

## 1. Item

- **Closes:** GAP-06 (Database; rule G-4; test-report finding 4). It also moves the
  refinement-plan metric "Migrations the idempotent script can apply" from 6 of 15
  to 15 of 15.
- **Track:** G1, Wave 1 (gates and API).
- **Plan item, quoted** (refinement plan, Wave 1 table): "Fix every migration the
  idempotent script cannot apply (`NavigationLinkRefs`, and
  `AddRefreshTokenSessionStart`, which has the same add-column-then-SQL pattern) by
  wrapping the raw SQL in `EXEC`; add migration checks to CI".
- **Done when, quoted:** "CI applies the idempotent script twice to an empty catalog
  and upgrades from the previous schema, both exit 0. Each migration change is shown
  before it is applied, as `AGENTS.md` requires."
- **Register row, quoted** (refinement plan, line 70): "CI migrates from empty only;
  the idempotent script fails at migration 7 of 15, and migration 14 has the same
  pattern | CI applies from empty, from the previous schema, and the script twice".
- **Risk row, quoted** (refinement plan, Risks): "Editing applied migrations |
  Catalogs that already ran `NavigationLinkRefs` or `AddRefreshTokenSessionStart`
  could drift | `EXEC` wrapping changes how the SQL is compiled, not what it does;
  show each change first, as `AGENTS.md` requires, and test it on a copy of
  `DigitalHubContent_Studio`".
- **Owner's instruction for the wave:** "Start waves 0 & 1 and update me with each
  gap done", then "continue working on wave 0 & 1" (Mohamed Elbadry, 1 November
  2026, project thread).

## 2. Current state

### 2.1 The migrations

There are 15 migrations in `api/src/DigitalHub.Api/Data/Migrations/`, with EF Core
10.0.12 (`DigitalHub.Api.csproj` lines 22–32; `api/dotnet-tools.json` pins
`dotnet-ef` 10.0.12). Five of them call `migrationBuilder.Sql`:

```
$ grep -n "migrationBuilder.Sql\|Sql(" *.cs | grep -v Designer
20260922083651_ReshapeWorkingCopies.cs:14:            migrationBuilder.Sql("DELETE FROM working_copies;");
20260922142757_NavigationLinkRefs.cs:51:            migrationBuilder.Sql(
20260922142757_NavigationLinkRefs.cs:144:            migrationBuilder.Sql(
20261011101053_BlogEditorialCalendarDates.cs:20:            migrationBuilder.Sql("""
20261019104504_AddRefreshTokenSessionStart.cs:24:            migrationBuilder.Sql(@"
20261020113912_AddApplicationCounts.cs:50:            migrationBuilder.Sql("""
20261020113912_AddApplicationCounts.cs:60:            migrationBuilder.Sql("""
```

For each `Up`, here is what the raw SQL references and whether that object exists
when SQL Server compiles the migration's batch:

| # | Migration | Raw SQL in `Up` references | Added earlier in the same migration? | Pattern? |
|---|---|---|---|---|
| 4 | `ReshapeWorkingCopies` | `working_copies` (table only, no columns) | No | No |
| 7 | `NavigationLinkRefs` | `navigation_items.link_kind`, `target_type`, `target_id` | **Yes**, by the `AddColumn` calls on lines 30–49 | **Yes** |
| 8 | `BlogEditorialCalendarDates` | `blog_posts.version`, `working_copies.blog_post_id`, `revisions.entity_type` | No. The guard runs before the drop and add | No |
| 14 | `AddRefreshTokenSessionStart` | `RefreshTokens.SessionStartedAt` | **Yes**, by the `AddColumn` on line 14 | **Yes** |
| 15 | `AddApplicationCounts` | `AspNetRoles`, `AspNetUserRoles` (columns from migration 1) | No | No |

So two migrations have the pattern, the two the plan names. A run of the full script
(2.3, without `-b`) confirms that no other migration fails.

### 2.2 Why the script fails

EF Core 10 writes one batch per migration: `BEGIN TRANSACTION;`, every operation
inside its own `IF NOT EXISTS (… [__EFMigrationsHistory] …) BEGIN … END;`, then
`COMMIT; GO`. The generated script has 16 `GO` lines: one after the history-table
create, then one for each of the 15 migrations. SQL Server compiles the whole batch
before it runs any of it. Deferred name resolution covers missing *tables*, but not
missing *columns* of a table that already exists. In migration 7, `navigation_items`
exists while `link_kind` does not yet, so the batch fails to compile (Msg 207) and
none of it runs. EF already wraps its own generated statements in `EXEC(N'…')` where
this matters: 21 places in the script, for example line 1458
`EXEC(N'ALTER TABLE [navigation_items] ADD CONSTRAINT [ck_navigation_items_link_shape] …`.
It does not wrap user `migrationBuilder.Sql`. `dotnet ef database update` is not
affected, because it sends each operation as its own command.

### 2.3 Reproduction (evidence gathering on `GAP06_`-prefixed scratch catalogs)

This was run on the shared container `dh-mssql` (SQL Server 2022). I created and
dropped only scratch databases whose names start with `GAP06_`. I did not touch
`DigitalHubContent`, `DigitalHubContent_Test` or `DigitalHubContent_E2e`. At the end,
`SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06%'` returned `0`. No
source file was changed: the build output went to the ignored `bin/` and `obj/`
folders, and `git status --short` is empty.

Generate the script:

```
$ cd api && dotnet build src/DigitalHub.Api/DigitalHub.Api.csproj -c Release   →  0 Error(s)
$ dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release \
    --project src/DigitalHub.Api/DigitalHub.Api.csproj -o <scratch>/idempotent.sql   →  exit 0
  1769 lines, 16 GO separators
```

**A. Stop on first error (`sqlcmd -I -b`), empty catalog `GAP06_IdemB`, twice. This
confirms "6 of 15".**

```
== run 1 (-I -b)
exit=1
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 61
Invalid column name 'link_kind'.
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 62
Invalid column name 'target_type'.
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 63
Invalid column name 'target_id'.
SELECT COUNT(*) FROM __EFMigrationsHistory  →  6
== run 2 (-I -b)
exit=1    (same three Msg 207 lines)
SELECT COUNT(*) FROM __EFMigrationsHistory  →  6
```

**B. Without `-b` (sqlcmd's default), empty catalog `GAP06_Idem`, twice. This finds
every failing migration, and it shows that the exit code alone hides them.**

```
== run 1 (-I, no -b)
exit=0
Msg 207 … Line 61  Invalid column name 'link_kind'.
Msg 207 … Line 62  Invalid column name 'target_type'.
Msg 207 … Line 63  Invalid column name 'target_id'.
Msg 207 … Line 18  Invalid column name 'SessionStartedAt'.
__EFMigrationsHistory: 13 rows. Every migration except 20260922142757_NavigationLinkRefs
and 20261019104504_AddRefreshTokenSessionStart.
== run 2: exit=0, the same four errors, the same 13 rows.
```

Two findings follow, and the design depends on both:

1. Only migrations 7 and 14 fail. The other 13 apply, so no third migration has the
   defect today.
2. **Without `-b`, `sqlcmd` exits 0** while it skips two migrations and goes on to
   apply 8–13 and 15 on top of a schema that is missing them. An exit-0 check is
   only meaningful with `-b`, and the check should also count the history rows.

**C. Without `-I`, the script cannot run at all.** On a first attempt with plain
`sqlcmd -i`, `QUOTED_IDENTIFIER` is OFF (sqlcmd's default), and migration 1 already
fails:
`Msg 1934 … CREATE INDEX failed because the following SET options have incorrect
settings: 'QUOTED_IDENTIFIER'` (the filtered `RoleNameIndex`), and errors cascade
from there. Whoever runs the script must pass `-I`.

**D. The fix, proven on a copy of the generated script.** In a scratch copy of the
script only, I wrapped the two `Sql` bodies in `EXEC(N'…')` and doubled their single
quotes. This is what the planned C# change generates. A Python script did the text
edit; the repository was not changed. Results:

```
Empty catalog GAP06_IdemFix, sqlcmd -I -b, run 1: exit=0, history 15
                                          run 2: exit=0, history 15
```

Schema equivalence: a catalog built by `dotnet ef database update` (`GAP06_Ef`)
compared with `GAP06_IdemFix`. The comparison listed every column (type, length,
nullability), every index with its filter, every check constraint with its
definition, every foreign key and every default:

```
468 lines each → diff: IDENTICAL
```

Upgrade from an older schema, with data. Two catalogs were brought to migration 6
(`20260922135931_AddMustChangePassword`) with `dotnet ef database update <id>`. Both
were seeded with the same rows: one `site_settings` row; pages `home` and `about`;
service `web`; seven navigation rows (group, `/`, `/about`, `/services/web`,
`mailto:` and `tel:` matching the settings, and LinkedIn matching the settings);
and three refresh tokens in two families. Then `GAP06_PrevEf` was taken to latest
with `dotnet ef database update`, and `GAP06_PrevScript` with the patched script
twice:

```
patched script run 1 exit=0
patched script run 2 exit=0
Group|NULL|group|NULL|NULL
Home|NULL|internal|page|11111111-0000-0000-0000-000000000001
About|NULL|internal|page|11111111-0000-0000-0000-000000000002
Web|NULL|internal|service|22222222-0000-0000-0000-000000000001
a|2026-10-01T10:00:00
b|2026-10-01T10:00:00
c|2026-10-03T10:00:00
15
DATA IDENTICAL
```

The three settings duplicates were deleted, the internal links were converted, and
`SessionStartedAt` holds each family's earliest `CreatedAt`. The results are the same
on both routes.

The guard still fires through `EXEC`. A catalog at migration 6 with one unresolvable
navigation row (`/services/missing`) was given the patched script with `-I -b`:

```
exit=1
Msg 50002, Level 16, State 1, … Navigation link conversion left a row with no valid shape.
history 6; navigation_items.link_kind present: 0; @@TRANCOUNT 0
```

The migration rolled back as a whole, as it does today under `database update`.

### 2.4 CI today

`.github/workflows/ci.yml`, job `api` ("API — Release build, migrations, integration
tests"):

- line 42: service `mcr.microsoft.com/mssql/server:2022-latest` (pinning it is
  GAP-09/GAP-10, not this change);
- line 85: "Apply migrations to the fresh database (dotnet-ef, administrator login)",
  which runs `dotnet tool run dotnet-ef -- database update` against
  `DigitalHubContent_Test`;
- nothing applies the idempotent script, and nothing upgrades from a previous
  schema. `ENGINEERING_STANDARDS.md` G-4 says the same: "`ci.yml` applies from
  empty | Partial: previous schema not tested".

The Studio job's end-to-end harness also migrates `DigitalHubContent_E2e` with
`database update`. That stays as it is.

**Overlapping changes to `ci.yml`.** Open PR #38 (`origin/change/ci-runner-pin`)
changes each `runs-on: ubuntu-latest` to `ubuntu-24.04` and adds a comment header.
GAP-09 (pins) and GAP-04 (browser tests) will change `ci.yml` later. This change
only *adds* one step to the `api` job, and touches no `runs-on`, `uses:` or `image:`
line, so it should rebase cleanly on any of them.

## 3. Design

### 3.1 The migration fix

In the `Up` of each of the two migrations, run the existing SQL through `EXEC(N'…')`,
so that SQL Server compiles it only when it runs, which is after the `ADD COLUMN`.
The SQL text itself does not change.

To avoid quote-doubling mistakes in hand-edited SQL, each migration keeps its SQL
verbatim in a `private const string` and escapes it in one expression:

```csharp
migrationBuilder.Sql("EXEC(N'" + ConvertLinksSql.Replace("'", "''") + "');");
```

The full text of both changes is in section 7.

Why this is safe for catalogs that already ran these migrations (the risk row):

- EF identifies a migration by its id in `__EFMigrationsHistory`, not by a checksum.
  A catalog that has the row never runs `Up` again, whether through `database update`
  or the script, because the script's `IF NOT EXISTS` skips it. The edit cannot
  reach `DigitalHubContent`, `DigitalHubContent_Studio` or anything else already
  migrated.
- `Sql` operations are not part of the model, so `ContentDbContextModelSnapshot.cs`
  and the two `.Designer.cs` files do not change. `dotnet ef migrations
  has-pending-model-changes` proves this (test plan).
- For a catalog that has *not* run them, the result is the same. Section 2.3 D shows
  the same schema (468/468 lines) and the same data (navigation rows, session
  starts) as the current `database update` route, and the 50002 guard still fires
  and rolls back.

Only `Up` changes. Each `Down` `Sql` call runs before the matching `DropColumn`, on
columns that exist when it compiles, so revert scripts are not affected. They are
also not part of the check.

### 3.2 The CI check (one gate)

Add a script, `api/tools/migration-checks/run.sh`, with a canary fixture beside it,
and one step in the `api` job that calls the script. The script uses the job's SQL
Server service container (passed as its first argument) and its own scratch
catalogs, named `${MIGRATION_CHECK_DB_PREFIX:-MigrationCheck_}…`. It refuses any
prefix that starts with `DigitalHubContent` (case-insensitive), and it drops its
catalogs on exit (`trap`). The steps:

1. **Generate** the idempotent script from the Release build: `dotnet tool run
   dotnet-ef -- migrations script --idempotent --no-build --configuration Release
   --project src/DigitalHub.Api/DigitalHub.Api.csproj -o "$tmp/idempotent.sql"`.
   Get the ordered migration ids with `--no-connect`, so that no database is opened
   and nothing but JSON reaches stdout:
   `dotnet tool run dotnet-ef -- migrations list --json --no-connect --no-build
   --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj
   2>/dev/null`, parsed with `jq` (on the runner image). N is the count, and PREV is
   `.[-2].id`. Checked on this branch: the command prints
   `20261019104504_AddRefreshTokenSessionStart` for `.[-2].id` and `15` for
   `length`. If the parse fails or N is 0, the gate cannot run, and it fails at once.
   BASE is the newest migration id on the base branch: the step runs
   `git fetch --no-tags --depth=1 origin "${BASE_REF}"`, where `BASE_REF` is
   `${{ github.base_ref || 'rebuild/dotnet-platform' }}`. It then takes the last
   non-`Designer`, non-`Snapshot` file name from
   `git ls-tree --name-only FETCH_HEAD api/src/DigitalHub.Api/Data/Migrations/`,
   minus `.cs`. That id must appear in the head's list; if it does not, the gate
   fails (a migration was removed or renamed). On this branch, BASE equals the
   latest id (`20261020113912_AddApplicationCounts`), because GAP-06 adds no
   migration.
2. **Canary.** Apply `canary-add-column-then-sql.sql` with the same `apply_script`
   function the real checks use (`docker cp`, then `sqlcmd -S localhost -U sa -C -I
   -b -i`), on an empty `…Canary` catalog. It has two batches, the same shape as
   migration 7, where the table already exists before the migration's batch:

   ```sql
   -- Canary: a table that exists before the batch, a column added and used in the same batch.
   CREATE TABLE canary_t (id int NOT NULL);
   GO

   BEGIN TRANSACTION;
   ALTER TABLE canary_t ADD new_col int NULL;
   UPDATE canary_t SET new_col = 1;
   COMMIT;
   GO
   ```

   The canary counts as rejected only when **both** of these hold: the exit code is
   non-zero, **and** the output contains `Msg 207` and `Invalid column name
   'new_col'`. A failure for any other reason (login, `docker cp`, a SET option) is
   "gate cannot run", not "rejected". If the canary is not rejected, the runner has
   lost `-b` or the check has stopped seeing the defect, so the gate is broken. This
   step always fails the job ("a gate that cannot run fails"; GAP-21 canary rule).
   Verified on `GAP06_Canary` (created and dropped again; section 12, round 2):

   ```
   == flags: -I -b
   Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 4
   Invalid column name 'new_col'.
   exit=1
   == flags: -I
   Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 4
   Invalid column name 'new_col'.
   exit=0
   ```

   The second run is the self-test: without `-b` the exit code is 0, so a runner
   that loses `-b` is caught.
3. **Script twice on an empty catalog** (`…Script`). Both runs must exit 0, and the
   history must hold N rows after each run.
4. **Previous schema, script route.** There are two starting points:
   - **(a) N-1** (`…Previous`): run `database update $PREV`, then apply the script.
     It must exit 0, with N history rows. This always tests at least one migration.
   - **(b) The base branch's schema** (`…Base`): run `database update $BASE`, then
     apply the script. It must exit 0, with N history rows. This is the upgrade from
     the schema actually deployed when a pull request adds two or more migrations.
     When BASE is the latest id (no new migration, as in this PR), (b) is the same
     as run 2 of step 3; the script logs "base = head, covered by step 3" and skips
     it.
5. **Previous schema, `database update` route** (`…Ef`). Run `database update`
   (latest), then `database update $PREV` (down one), then `database update` again.
   Every step must exit 0. This is the D5 check from the 27 October test report,
   now in CI.
6. **Same schema.** The schema listing from 2.3 D (columns, indexes with filters,
   check constraints, foreign keys, defaults), taken from `…Script`, `…Previous`,
   `…Base` (when run) and `…Ef`, must be identical.

**Report mode.** This is a new gate, so it follows standard section 3 ("reports
for seven days from its merge") and the G1 Wave 1–3 checklist. It reads
`MIGRATION_CHECKS_BLOCKING_FROM` (a literal `YYYY-MM-DD` set in the step's `env`).
Before that date, a failure in steps 3–6 writes `::warning::` lines and a table to
`$GITHUB_STEP_SUMMARY`, and exits 0. From that date it exits 1. A failure to *run*
(step 1, the fetch, creating a catalog, `docker cp`) and a canary that is not
rejected (step 2) fail the job at once. The existing "Apply migrations to the fresh
database" step is unchanged and keeps blocking.

**The date rule, stated once:** `MIGRATION_CHECKS_BLOCKING_FROM` is the merge date
plus 7 days. The developer sets it at the last rebase before merge, to the expected
merge day plus 7. Tech-lead gate 2 checks it. If the actual merge day is later, the
integrator moves the date in the same merge so that the gate still gets its seven
report days.

The new step in `ci.yml`, placed directly after "Apply migrations to the fresh
database" (after line 90):

```yaml
      - name: Migration checks — idempotent script twice, previous schema
        # New gate (ENGINEERING_STANDARDS.md section 3): reports until
        # MIGRATION_CHECKS_BLOCKING_FROM, then blocks. The canary always blocks.
        env:
          MIGRATION_CHECKS_BLOCKING_FROM: "<merge date + 7 days, YYYY-MM-DD>"
          BASE_REF: ${{ github.base_ref || 'rebuild/dotnet-platform' }}
        run: tools/migration-checks/run.sh "${{ job.services.mssql.id }}"
```

The date rule is above: merge date plus 7. The script reads `SA_PASSWORD` from the job
env (already set on line 32), never echoes it, and runs without `set -x`.

### 3.3 Alternatives rejected

- **Leave the migrations alone, and decide that Phase D applies migrations with
  `database update` or a bundle.** That is owner decision O-8, still open. The plan
  item fixes the script "regardless", and the standard's O-8 row says that "the
  idempotent-script fix keeps the reviewed-script route open". Not chosen, because
  it would prejudge O-8.
- **Split each migration into two (add columns; then convert).** That changes
  migration ids, so catalogs that already ran the original would see two new pending
  migrations, re-add the columns and fail. It is far riskier than wrapping.
- **Hand-double the quotes inside the raw string literal.** The navigation SQL has
  about 60 single quotes, and one missed doubling breaks the migration in a way only
  the script route shows. The `const` + `Replace` form keeps the reviewed SQL
  byte-for-byte as it is today. Rejected.
- **A shared `MigrationBuilder` extension (`SqlDeferred`).** A later edit to a shared
  helper would silently change the SQL of already-applied historic migrations.
  Migrations should stay self-contained. Rejected.
- **Wrap every `migrationBuilder.Sql` (all five migrations).** Migrations 4, 8 and 15
  compile and apply today (2.3 B). Editing applied migrations that are not broken
  adds risk for no gain, and the CI check (step 3, second run) catches it if a later
  migration ever breaks one of them, for example by dropping `blog_posts.version`,
  which migration 8's guard reads. Rejected for this change; the risk is noted in
  section 10.
- **An xUnit test in `DigitalHub.Api.Tests` that generates and runs the script.**
  The integration tests are fixed to `DigitalHubContent_Test` and the restricted
  login (`AGENTS.md`, `docs/changes/README.md`). This check needs `sa`, its own
  catalogs and `sqlcmd` batch semantics (`GO`, `-b`, `-I`), which `SqlCommand` does
  not reproduce. Rejected in favour of the CI script.
- **A separate CI job with its own SQL Server container.** That adds a second
  container start (about a minute) and copies the service block that GAP-09 is about
  to pin. Reusing the `api` job's container keeps the `ci.yml` diff to one step.
  Rejected.
- **A committed `.sql` copy of the idempotent script.** It would drift from the
  migrations. The script is generated from the build on every run. Rejected.

## 4. Scope

**Change:**

| File | Change |
|---|---|
| `api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs` | `Up` only: move the conversion SQL (lines 51–129) verbatim into `private const string ConvertLinksSql`, and call `migrationBuilder.Sql("EXEC(N'" + ConvertLinksSql.Replace("'", "''") + "');")`, with a 3-line comment saying why. `Down`, the `AddColumn`/`AlterColumn`/`AddCheckConstraint` calls and the class summary are unchanged. |
| `api/src/DigitalHub.Api/Data/Migrations/20261019104504_AddRefreshTokenSessionStart.cs` | `Up` only: the same pattern, with `private const string SessionStartSql`. The existing comment stays, and one line is added on `EXEC`. |
| `api/tools/migration-checks/run.sh` (new) | The check in 3.2. Bash, `set -euo pipefail`, executable bit set (`git update-index --chmod=+x`). |
| `api/tools/migration-checks/canary-add-column-then-sql.sql` (new) | The canary fixture in 3.2 step 2. |
| `.github/workflows/ci.yml` | One new step in the `api` job after "Apply migrations to the fresh database" (3.2). No other line changes. |
| `docs/changes/GAP-06/*` | The pipeline records. |

**Out of scope (left alone on purpose):**

- Migrations 4, 8 and 15, and every `Down` (3.1, 3.3).
- `ContentDbContextModelSnapshot.cs` and every `.Designer.cs`: must not change.
- How Phase D applies migrations (O-8), and any change to
  `docs/security-deployment.md`. Findings 2.3 B and C (`-b` and `-I` are needed)
  are recorded here for whoever writes the Phase D runbook, if O-8 picks the script.
- Pinning the SQL Server image, actions, Node and .NET (GAP-09, GAP-10), and PR #38's
  runner pin.
- The Studio end-to-end harness's own migration (unchanged; still `database update`).
- `/health` reporting the schema version (GAP-28, Wave 3).
- Running the test against a copy of `DigitalHubContent_Studio` in this pipeline.
  There is no copy on this server (`sys.databases` lists only `master`, `model`,
  `msdb`, `tempdb` and the scratch catalogs). The owner runs it, using the exact
  steps in 5.5; until then it is NOT RUN, pending owner.

## 5. Test plan

All .NET commands run in Release, from `api/`. Locally they run against the shared
`dh-mssql` container, on scratch catalogs prefixed `GAP06_` only. The developer
never runs them against `DigitalHubContent`.

### 5.1 Failing first: the new check, before the migration fix

Commit 1 adds `run.sh`, the canary and the `ci.yml` step, with the migrations
untouched. Run it forced to blocking:

```
cd api
dotnet tool restore
dotnet build DigitalHub.slnx -c Release
SA_PASSWORD=CiOnlySa2026Passw0rd MIGRATION_CHECK_DB_PREFIX=GAP06_ \
  MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
```

Expected: `exit=1`. The canary is rejected (exit 1 with `Msg 207 … Invalid column
name 'new_col'`, so step 2 passes). Step 3 fails on run 1 with
`Msg 207 … Invalid column name 'link_kind'` and history 6 of 15 (the 2.3 A
output). Steps 4–6 fail or are reported as not reached. Quote this output in
`implementation.md`.

Then run it in report mode (`MIGRATION_CHECKS_BLOCKING_FROM=2099-01-01`): expect
`exit=0` with the same failures printed as warnings. This proves that report mode
reports and does not hide.

Canary self-test (local, not committed): temporarily remove `-b` from
`apply_script` and run again. The canary then exits 0 (as shown in 3.2 step 2), so
expect `exit=1` with "canary was not rejected", even in report mode. Restore `-b`, and show `git diff` is clean for `run.sh`. Quote both.

### 5.2 Show the migrations before applying (`AGENTS.md`)

Commit 2 edits the two migrations. **Before** applying anything to any catalog:

1. Post the `git diff` of both `.cs` files in `implementation.md`.
2. Generate and post the SQL they now produce:
   ```
   dotnet build DigitalHub.slnx -c Release
   dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release \
     --project src/DigitalHub.Api/DigitalHub.Api.csproj \
     20260922135931_AddMustChangePassword 20260922142757_NavigationLinkRefs
   dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release \
     --project src/DigitalHub.Api/DigitalHub.Api.csproj \
     20261018132426_AddSiteSettingsVersion 20261019104504_AddRefreshTokenSessionStart
   ```
   Check that each output's `EXEC(N'…')` body equals today's SQL with quotes doubled
   and nothing else.
3. **Who confirms, and what the developer may apply.** In this pipeline the
   developer applies the edited migrations **only** to throwaway catalogs: the
   `GAP06_`-prefixed scratch catalogs on `dh-mssql`; the CI-only `MigrationCheck_*`
   and `DigitalHubContent_Test` catalogs in the job's throwaway container; and
   `DigitalHubContent_Test` locally only under 5.3 #7. All of these use `sa` (the
   elevated account). Showing the diff and the generated SQL in `implementation.md`
   before those runs is the "show before applying" step for scratch catalogs. The
   developer does not wait for anyone before using them.
   The developer **never** applies them to `DigitalHubContent`,
   `DigitalHubContent_Studio` or any other catalog that holds real content.
   The **owner's** confirmation of the migration change is the pipeline's existing
   stop after step 6, before the branch is pushed for merge. There the coordinator
   relays section 7 of this plan and the generated SQL from `implementation.md` to
   the owner. A tech-lead approval is not that confirmation. Applying to the owner's
   real catalogs happens only on the owner's machine, by the owner (5.5 is the
   Studio-copy test).

### 5.3 After the fix

| # | Check | Command | Expect |
|---|---|---|---|
| 1 | The new check, blocking | `SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 tools/migration-checks/run.sh dh-mssql` | exit 0; canary rejected; script twice: exit 0, 15/15 each; previous schema (script and `database update`): exit 0, 15/15; schemas identical |
| 2 | No model change | `dotnet tool run dotnet-ef -- migrations has-pending-model-changes --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj` | exit 0, "No changes have been made to the model" |
| 3 | Only planned files | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` | exactly the files in section 4; no `*.Designer.cs`, no snapshot |
| 4 | Data equivalence, from migration 6 with data | repeat 2.3 D on `GAP06_PrevEf` / `GAP06_PrevScript` (seed script in `implementation.md`), script route with `sqlcmd -I -b` | both exit 0; navigation rows and `SessionStartedAt` identical; 15 history rows |
| 5 | Guard still fires | 2.3 D guard case: migration 6, one `/services/missing` row; apply the script with `-I -b`, **and** separately `dotnet ef database update` | both fail with 50002; history 6; `link_kind` absent |
| 6 | Build | `dotnet build DigitalHub.slnx -c Release` | 0 errors; warning count not above the 13 in the 27 Oct baseline |
| 7 | Integration tests | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` | 0 failures. Locally only if `DigitalHubContent_Test` on `dh-mssql` is not in use by another agent (ask the coordinator); otherwise NOT RUN locally, covered by CI job `api` |
| 8 | Script lint | `bash -n tools/migration-checks/run.sh`; `shellcheck tools/migration-checks/run.sh` if installed | exit 0 / 0 findings (NOT RUN, with reason, if shellcheck is absent; actionlint arrives with GAP-08) |
| 9 | CI on the PR | jobs `api`, `website`, `studio`, `section-compare` | `api` green, and the migration-check step log shows the canary rejected, then 15/15 twice, previous-schema exit 0, schemas identical, and "blocking from <date>"; the other jobs no worse than base |
| 10 | Clean-up | `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06%'` | 0 |
| 11 | Studio-copy test (refinement-plan risk row) | 5.5, run by the owner | NOT RUN, pending owner, in `implementation.md` and `test-report.md`, with the reason: no copy of `DigitalHubContent_Studio` exists on this server |

### 5.5 Owner-run: a copy of `DigitalHubContent_Studio` (NOT RUN here, pending owner)

The refinement plan's risk row asks for this test. Only the owner's machine has the
catalog: Windows, folder `D:\work\DigitalHub\dh-platform`, local SQL Server,
Windows authentication. These steps read `DigitalHubContent_Studio` once (a
`COPY_ONLY` backup, which changes no data and does not affect the backup chain).
Every write goes to a scratch copy, `GAP06_StudioCopy`, which is dropped at the end.
Run them in PowerShell, on the PR branch.

```powershell
cd D:\work\DigitalHub\dh-platform\api
dotnet tool restore
dotnet build DigitalHub.slnx -c Release
dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release `
  --project src/DigitalHub.Api/DigitalHub.Api.csproj -o "$env:TEMP\gap06-idempotent.sql"

# 1. Copy the catalog under a scratch name (the backup goes to the server's default backup folder).
sqlcmd -S localhost -E -C -b -Q "BACKUP DATABASE [DigitalHubContent_Studio] TO DISK = N'gap06-studio.bak' WITH COPY_ONLY, INIT"
sqlcmd -S localhost -E -C -b -Q "RESTORE FILELISTONLY FROM DISK = N'gap06-studio.bak'"
#    Use the two LogicalName values printed above for <data> and <log>:
sqlcmd -S localhost -E -C -b -Q "DECLARE @d nvarchar(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400)), @l nvarchar(400) = CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400)); DECLARE @s nvarchar(max) = N'RESTORE DATABASE [GAP06_StudioCopy] FROM DISK = N''gap06-studio.bak'' WITH MOVE N''<data>'' TO N''' + @d + N'GAP06_StudioCopy.mdf'', MOVE N''<log>'' TO N''' + @l + N'GAP06_StudioCopy_log.ldf'''; EXEC (@s)"

# 2. Record the history and the schema before.
$hist   = "SET NOCOUNT ON; SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId"
$schema = "<the schema-listing query from plan section 2.3 D, as in implementation.md>"
sqlcmd -S localhost -E -C -b -h -1 -W -d GAP06_StudioCopy -Q $hist   -o "$env:TEMP\gap06-hist-before.txt"
sqlcmd -S localhost -E -C -b -h -1 -W -d GAP06_StudioCopy -Q $schema -o "$env:TEMP\gap06-schema-before.txt"

# 3. Apply the new idempotent script twice. -I and -b are both required (plan 2.3 B, C).
sqlcmd -S localhost -E -C -I -b -d GAP06_StudioCopy -i "$env:TEMP\gap06-idempotent.sql"; "exit=$LASTEXITCODE"
sqlcmd -S localhost -E -C -I -b -d GAP06_StudioCopy -i "$env:TEMP\gap06-idempotent.sql"; "exit=$LASTEXITCODE"

# 4. Record after, and compare.
sqlcmd -S localhost -E -C -b -h -1 -W -d GAP06_StudioCopy -Q $hist   -o "$env:TEMP\gap06-hist-after.txt"
sqlcmd -S localhost -E -C -b -h -1 -W -d GAP06_StudioCopy -Q $schema -o "$env:TEMP\gap06-schema-after.txt"
Compare-Object (Get-Content "$env:TEMP\gap06-hist-before.txt")   (Get-Content "$env:TEMP\gap06-hist-after.txt")
Compare-Object (Get-Content "$env:TEMP\gap06-schema-before.txt") (Get-Content "$env:TEMP\gap06-schema-after.txt")

# 5. Clean up.
sqlcmd -S localhost -E -C -b -Q "ALTER DATABASE [GAP06_StudioCopy] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [GAP06_StudioCopy]"
#    Then delete gap06-studio.bak from the server's default backup folder.
```

**Expected results:**
- Both script runs print `exit=0`.
- If the "before" history lists all 15 migrations, both `Compare-Object` calls print
  nothing: no migration re-ran, and the schema is unchanged. This is the "already
  applied" path the risk row is about.
- If the copy was behind (fewer than 15), the "after" history lists all 15, and the
  schema-after listing equals the CI `…Script` listing from the PR's run.

The owner's output, quoted, closes the coverage row. Until then it stays "NOT RUN,
pending owner".

### 5.4 Track checklist: G1, Waves 1 to 3 (gates and API)

| Checklist item | How this change meets it |
|---|---|
| One gate per pull request (B-8) | One gate (migration checks). The two migration fixes are what make it pass, and the plan item bundles them. |
| A new gate reports for seven days through a `*_BLOCKING_FROM` date, then blocks; a gate that replaces existing protection blocks at once | `MIGRATION_CHECKS_BLOCKING_FROM` = merge date + 7, set at the last rebase and checked at tech-lead gate 2 (3.2). The existing `database update` step is unchanged and still blocks. |
| Every gate has a committed canary fixture it must reject (GAP-21) | `canary-add-column-then-sql.sql` (two batches; the table exists before the failing batch), run on every CI run and blocking at once. "Rejected" means a non-zero exit **and** `Msg 207 … 'new_col'`. Verified on `GAP06_Canary`: exit 1 with `-b`, exit 0 without it (3.2 step 2), so it guards `-b`. |
| Actions pinned by SHA, SQL Server image by digest, Node and .NET exact | Not met on the base and not in scope (GAP-09, GAP-10, PR #38). This change adds no `uses:`, `image:`, `node-version` or `dotnet-version` line. |
| Baselines only shrink | No baseline file. The metric moves from 6/15 to 15/15. |

## 6. Security impact

- **Routes, policies, logins:** none. No application code changes. The migrations
  run as the elevated account, as they do today.
- **Data:** the SQL that converts navigation rows and sets session starts is
  unchanged in effect. Section 2.3 D shows the same schema and the same rows, and the
  50002 guard still fires. Catalogs that already ran the migrations are unaffected
  (3.1).
- **Secrets:** the script uses the existing workflow-only `SA_PASSWORD` (`ci.yml`
  line 32, a throwaway container value, not a secret). It must not print it: no
  `set -x`, and it is passed to `sqlcmd` as `-P "$SA_PASSWORD"` inside `docker exec`.
  Locally, the developer passes the `dh-mssql` value on the command line, as
  `ci.yml` already does.
- **Database safety:** the script refuses any prefix that starts with
  `DigitalHubContent`, so it cannot create or drop the real, test or end-to-end
  catalogs, and it drops only the catalogs it created.
- **Dependencies:** none added. It uses `dotnet-ef` (already in
  `api/dotnet-tools.json`), `sqlcmd` (already in the service image), `docker`, and
  `grep`/`sed` (or `jq`, which is on the runner image) to read the `--json` list.
- **Workflow permissions:** unchanged (`contents: read`).

## 7. Migrations

There is no new migration. Two existing migrations change in `Up` only. Each
`Down`, the model snapshot and the designers are unchanged. The developer shows these
again, with the generated SQL, before applying them (5.2).

**`20260922142757_NavigationLinkRefs.cs`, the `Up` after the change.** The
`AlterColumn`/`AddColumn` calls before the SQL and the `AddCheckConstraint` after it
stay exactly as they are on lines 20–49 and 131–134:

```csharp
        // The idempotent script compiles each migration as one batch, before the
        // AddColumn calls above have run, so a direct reference to link_kind,
        // target_type or target_id fails (Msg 207). EXEC compiles it when it runs.
        private const string ConvertLinksSql =
            """
            <lines 53–128 of today's file, byte for byte: DELETE n … THROW 50002, 'Navigation link conversion left a row with no valid shape.', 1;>
            """;

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AlterColumn url, AddColumn link_kind / target_id / target_type: unchanged
            migrationBuilder.Sql("EXEC(N'" + ConvertLinksSql.Replace("'", "''") + "');");
            // AddCheckConstraint ck_navigation_items_link_shape: unchanged
        }
```

The text inside the `const` must be today's text, unchanged. `implementation.md`
proves this with `git diff --word-diff`, which should show only the move and the new
call. The generated script then contains
`EXEC(N'DELETE n … THROW 50002, ''Navigation link conversion left a row with no valid shape.'', 1;');`,
which is the form proven in 2.3 D.

**`20261019104504_AddRefreshTokenSessionStart.cs`, the `Up` after the change:**

```csharp
        // Existing families start at their earliest token, the first sign-in we
        // have a record of. Without this every existing session would count as
        // started in year 1 and end at once.
        // EXEC: the idempotent script compiles this before SessionStartedAt exists.
        private const string SessionStartSql = @"
UPDATE token
SET SessionStartedAt = family.StartedAt
FROM RefreshTokens AS token
JOIN (SELECT FamilyId, MIN(CreatedAt) AS StartedAt FROM RefreshTokens GROUP BY FamilyId) AS family
    ON family.FamilyId = token.FamilyId;";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(   // unchanged
                name: "SessionStartedAt",
                table: "RefreshTokens",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.Sql("EXEC(N'" + SessionStartSql.Replace("'", "''") + "');");
        }
```

This SQL has no single quotes, so `Replace` is a no-op today. It stays so that a
future edit cannot break it.

**Where they are applied.** Only to `GAP06_` scratch catalogs locally, and to the
CI-only `MigrationCheck_*` and `DigitalHubContent_Test` catalogs in the throwaway CI
container. Never to `DigitalHubContent`. Catalogs that already have these history
rows never run them again.

## 8. Rollback

Revert the pull request. That removes the CI step and the script, and restores the
two migration files. No catalog needs any action: the history ids are unchanged; a
catalog migrated with the `EXEC` form has the same schema and data as one migrated
with the original form (2.3 D); and the model snapshot never changed. After a revert,
the idempotent script is broken again (6 of 15), and nothing else changes.

## 9. Owner decisions needed

None for this change.

- **O-8** ("How Phase D applies migrations") stays open, and this change does not
  answer it. The refinement plan and the O-8 row both say this fix "keeps the
  reviewed-script route open" whichever way O-8 goes. If the owner later picks the
  script route, the runbook needs `sqlcmd -I -b` (2.3 B, C); that belongs to Wave 4.
- The `MIGRATION_CHECKS_BLOCKING_FROM` date follows the standard's seven-day rule,
  not an owner choice.

## 10. Risks

| Risk | How it is caught |
|---|---|
| A quote is mangled or SQL is lost when the text moves into the `const` | 5.2 shows the generated `EXEC` body before anything is applied; 5.3 #4 compares data with the `database update` route; 5.3 #5 shows the guard still fires; `git diff --word-diff` shows only the move. |
| The edit changes the model snapshot or a designer, so EF sees a pending model change | 5.3 #2 `has-pending-model-changes` exit 0; 5.3 #3 file list. |
| Catalogs that already ran the migrations drift (refinement-plan risk row) | Not reachable: the history row stops any rerun (3.1). Run 2 of the script in CI exercises exactly the "already applied" path (all 15 batches compile and are skipped). The test on a copy of `DigitalHubContent_Studio` is owner-run (5.5) and stays NOT RUN, pending owner, until the owner's output is quoted. |
| The canary is not rejected for the intended reason (for example, a login failure is counted as "rejected") | "Rejected" requires a non-zero exit and the `Msg 207 … 'new_col'` text (3.2 step 2). |
| A pull request that adds two or more migrations is never tested from the deployed schema | Step 4(b) upgrades from the base branch's newest migration (BASE), not only from N-1. |
| `sqlcmd` without `-b` reports success on failure (2.3 B) and so hides a regression | `-b` is in the single `apply_script` function; the canary rejects any runner without it (5.1 self-test); the check also counts the history rows. |
| A later migration drops a column that an older raw-SQL migration reads (for example `blog_posts.version` in migration 8), breaking every rerun of the script | Step 3's second run fails, in report mode for seven days and then blocking. The fix then is to wrap that older migration in the same way. |
| The CI step slows the `api` job | Five scratch catalogs on the existing container; the extra `database update` and script runs took seconds locally. The developer quotes the step's duration from the PR run. |
| Merge conflict with PR #38, GAP-09 or GAP-04 in `ci.yml` | One added step, with no edit to existing lines. Whichever merges second rebases; the conflict, if any, is textual and local to the `api` job. |
| Report mode lets a real failure merge in the first seven days | The step summary and `::warning::` make it visible; tester and tech-lead gate 2 check that the PR's own run reports 0 failures. |
| The scratch catalogs on the shared `dh-mssql` collide with other agents | The prefix is `GAP06_` locally; the refusal of `DigitalHubContent*`; the `trap` drop; 5.3 #10. |

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| CI applies the idempotent script twice to an empty catalog, both exit 0 | Refinement plan, GAP-06 "Done when" | Planned | |
| CI upgrades from the previous schema, exit 0 (script route and `database update` route) | Refinement plan, GAP-06 "Done when"; G-4 | Planned | |
| Each migration change is shown before it is applied | Refinement plan, GAP-06 "Done when"; `AGENTS.md` | Planned | |
| `NavigationLinkRefs` applies through the idempotent script | Refinement plan, plan item; finding 4 | Planned | |
| `AddRefreshTokenSessionStart` applies through the idempotent script | Refinement plan, plan item; finding 4 | Planned | |
| Every migration with the pattern is found and fixed (15 of 15 apply) | Refinement plan, metrics table; architect brief | Planned | |
| The edits do not change what the SQL does (schema and data the same as `database update`; the guard still fires) | Refinement plan, risk "Editing applied migrations" | Planned | |
| Test on a copy of `DigitalHubContent_Studio` (owner-run, steps in 5.5) | Refinement plan, risk "Editing applied migrations" | Planned: NOT RUN, pending owner (no copy on this server) | |
| CI upgrades from the base branch's schema when a PR adds migrations (step 4b) | Plan review round 1, finding 6 | Planned | |
| No model or snapshot change | Section 3.1 | Planned | |
| The gate reports until `MIGRATION_CHECKS_BLOCKING_FROM`, then blocks | `ENGINEERING_STANDARDS.md` section 3; G1 checklist | Planned | |
| The canary fixture is rejected on every run and guards `-b` | G1 checklist; GAP-21 | Planned | |
| Scratch catalogs only; none left behind | `docs/changes/README.md`; architect brief | Planned | |

## 12. Revision log

Round 1, 1 November 2026: first version. There are no earlier reviews to answer.

Round 2, 1 November 2026, answering `plan-review.md` round 1 (verdict CHANGES
NEEDED):

1. **Major: the canary would not be rejected.** Accepted. The reviewer is right that
   a table created in the same batch defers name resolution for the whole `UPDATE`.
   The fixture is now two batches: `CREATE TABLE` and `GO`, then `BEGIN
   TRANSACTION`, `ALTER TABLE … ADD`, `UPDATE`, `COMMIT` and `GO`. That is the shape
   of migration 7. Its full text is in 3.2 step 2. "Rejected" now requires a
   non-zero exit **and** `Msg 207` with `Invalid column name 'new_col'`; any other
   failure counts as "gate cannot run". I verified it on the scratch catalog
   `GAP06_Canary` (created and dropped twice; afterwards `SELECT COUNT(*) FROM
   sys.databases WHERE name LIKE 'GAP06%'` returned `0`). With `-I -b`: `Msg 207 …
   Line 4 Invalid column name 'new_col'.` and `exit=1`. With `-I` only: the same
   message and `exit=0`. So the fixture also proves the `-b` self-test in 5.1.
2. **Minor: `--no-connect`.** Accepted. The exact command in 3.2 step 1 now has
   `--json --no-connect … 2>/dev/null`, parsed with `jq`. Verified on this branch:
   `.[-2].id` gives `20261019104504_AddRefreshTokenSessionStart`, and `length` gives
   `15`. A parse failure fails the gate as "cannot run".
3. **Minor: the blocking date.** Accepted. The rule is now stated once (3.2, and in
   5.4): merge date plus 7, set by the developer at the last rebase before merge,
   checked at tech-lead gate 2, and moved by the integrator in the same merge if the
   merge day slips. The "opening date + 7" wording is removed from the `ci.yml`
   snippet and the checklist.
4. **Minor: the Studio-copy test.** Accepted. New section 5.5 gives the exact
   owner-run PowerShell steps for the owner's Windows machine
   (`D:\work\DigitalHub\dh-platform`, local SQL Server, Windows authentication).
   They take a `COPY_ONLY` backup, restore it as `GAP06_StudioCopy`, record the
   history and schema, apply the new script twice with `sqlcmd -I -b`, compare,
   then drop the copy. The expected results are stated. The coverage row and 5.3
   #11 now say "NOT RUN, pending owner", instead of closing the item on reasoning.
5. **Minor: who confirms.** Accepted, and stated plainly in 5.2 step 3. The
   developer applies the edited migrations only to scratch and test catalogs
   (`GAP06_*` on `dh-mssql`, plus `MigrationCheck_*` and `DigitalHubContent_Test` in
   the throwaway CI container), after showing the diff and the generated SQL in
   `implementation.md`, and does not wait for anyone first. The developer never
   applies them to `DigitalHubContent`, `DigitalHubContent_Studio` or any other real
   catalog. The owner's confirmation is the pipeline's existing stop before push,
   where the coordinator relays section 7 and the generated SQL. A tech-lead
   approval is not that confirmation. Real catalogs are migrated only by the owner,
   on the owner's machine.
6. **Minor: N-1 versus the base schema.** Accepted, with both kept. Step 4(a) still
   tests from N-1, because it always exercises at least one migration. The new
   step 4(b) upgrades from BASE, the newest migration on the base branch: it runs
   `git fetch --depth=1 origin $BASE_REF` and then `git ls-tree` on the migrations
   folder, with `BASE_REF` from `github.base_ref`. When BASE equals the latest id,
   as in this PR, step 4(b) is logged as covered by step 3 and skipped. A BASE id
   missing from the head's list fails the gate. Step 6 includes `…Base` in the
   schema comparison when it runs.
