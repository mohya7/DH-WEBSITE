# Implementation: GAP-06

Developer, 1 November 2026. Branch `change/GAP-06` (worktree `/home/user/wt-GAP-06`),
cut from `origin/rebuild/dotnet-platform` at `6470fac`. Plan: `plan.md` round 2;
gate 1: `plan-approval.md`, `Verdict: APPROVED`, with eight conditions (answered in
section 8). Governing files were read from the session's read-only reference copies
(`.claude/agents/developer.md`, `docs/changes/README.md`, `ENVIRONMENT.md`).

## 1. Commits

| SHA | Subject | Plan step |
|---|---|---|
| `0f6fd6f` | GAP-06: Add failing migration checks with canary to CI | 5.1, red first (B-6) |
| `8b41c00` | GAP-06: Run the raw SQL of two migrations through EXEC | 3.1, section 7 |
| `b92d325` | GAP-06: Show the migration change before applying it | 5.2 (this file, first part) |
| `a77ae2e` | GAP-06: Fix the schema listing in the migration checks | fix found by 5.3 #1 (section 5.1) |
| (the commit that completes this file; see `git log`) | GAP-06: Record the implementation results | 5.3 (this file, completed) |

## 2. What changed, file by file (plan section 4)

| File | Change |
|---|---|
| `api/tools/migration-checks/run.sh` (new, mode 100755) | The check of plan 3.2, steps 1 to 6, with report mode, canary, and `trap` clean-up. |
| `api/tools/migration-checks/canary-add-column-then-sql.sql` (new) | The plan's two-batch canary fixture, verbatim. |
| `.github/workflows/ci.yml` | One step added directly after "Apply migrations to the fresh database" in the `api` job. No other line changed. |
| `api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs` | `Up` only: the conversion SQL moved verbatim into `private const string ConvertLinksSql`; called as `migrationBuilder.Sql("EXEC(N'" + ConvertLinksSql.Replace("'", "''") + "');")`, with a 3-line comment. |
| `api/src/DigitalHub.Api/Data/Migrations/20261019104504_AddRefreshTokenSessionStart.cs` | `Up` only: the same, with `private const string SessionStartSql`; the existing comment moved with the SQL, plus one line on `EXEC`. |
| `docs/changes/GAP-06/implementation.md` | This record. |

### 2.1 Notes on `run.sh` against the plan

- **Blocking date (condition 5).** `MIGRATION_CHECKS_BLOCKING_FROM` must match
  `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` and survive `date -u -d` unchanged (so
  `2026-02-30` is refused). A missing or malformed value is "cannot run", exit 1.
- **The committed date is `2026-11-12`.** ASSUMPTION for gate 2 and the integrator:
  the merge date is not known (it needs the owner's OK, condition 6). The date assumes
  the merge is **no earlier than 5 November 2026**, plus 7 days. If the merge happens
  later than 5 November, the integrator must move `MIGRATION_CHECKS_BLOCKING_FROM` in
  `.github/workflows/ci.yml` to the actual merge day plus 7, in the same merge, so the
  gate still gets its seven report days (plan 3.2, "the date rule").
- **Base branch (condition 1).** `run.sh` fetches with `--depth=1` only when
  `git rev-parse --is-shallow-repository` prints `true` (CI's checkout). Otherwise it
  reads `refs/remotes/origin/$BASE_REF`, and if that is missing it fails as "cannot
  run". It never fetches in a full clone. `BASE_REF` is checked against
  `^[A-Za-z0-9][A-Za-z0-9._/-]*$` and is passed through `env:` in `ci.yml`, not inlined.
- **Password (condition 8).** No `set -x`. `sqlcmd` gets the password through
  `docker exec -e SQLCMDPASSWORD` (inherited from the environment, so it is not on
  any command line), which is a stricter form of the plan's `-P "$SA_PASSWORD"`. The
  `dotnet-ef` connection string carries it as the existing `ci.yml` step does; every
  captured output is passed through `redact`, which replaces the password with `***`
  before printing. `grep -c` for the sa password over every local log: `0` in each.
- **Files in the container.** The plan's `docker cp` is kept. The files go into a
  per-run directory `/tmp/<prefix>migration-checks-<pid>` (created by the container's
  own user, so the `trap` can remove it) and are made mode 0644 first, because
  `docker cp` writes them as root and `sqlcmd` runs as the `mssql` user.
- **"Cannot run" versus "failed".** Failing to run (bad input, `dotnet-ef` script or
  list, `jq` parse, fewer than 2 migrations, the base fetch, BASE missing from the
  head's list, creating a catalog, `docker cp`, listing a schema) exits 1 at once.
  The canary not rejected (exit 0) exits 1 at once with "the canary was not
  rejected"; a canary failure without `Msg 207 … 'new_col'` is "cannot run". Only
  failures of steps 3 to 6 follow report mode.
- **Schema listing.** Default-constraint *names* are left out of the listing (SQL
  Server generates them, so they differ between catalogs); their definitions are
  compared. The full query is in section 6 (condition 4).

## 3. Red first (plan 5.1), commit `0f6fd6f`, migrations untouched

Build first: `cd api && dotnet tool restore` → "Restore was successful." exit 0;
`dotnet build DigitalHub.slnx -c Release` → `13 Warning(s)`, `0 Error(s)`, exit 0.

### 3.1 Forced blocking

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 \
    tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
Migration checks: catalog prefix GAP06_, base rebuild/dotnet-platform, blocking from 2000-01-01 (today 2026-11-01: blocking mode).
== 1. Generate the idempotent script and read the migration ids
N=15, latest=20261020113912_AddApplicationCounts, previous=20261019104504_AddRefreshTokenSessionStart
base (rebuild/dotnet-platform) newest migration: 20261020113912_AddApplicationCounts
== 2. Canary: add a column and use it in one batch
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
== 3. Idempotent script twice on an empty catalog
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 61
Invalid column name 'link_kind'.
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 62
Invalid column name 'target_type'.
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 63
Invalid column name 'target_id'.
::error::Migration check failed: 3. Script run 1, empty catalog: exit 1, history 6 of 15
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 61
Invalid column name 'link_kind'.
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 62
Invalid column name 'target_type'.
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 63
Invalid column name 'target_id'.
::error::Migration check failed: 3. Script run 2, empty catalog: exit 1, history 6 of 15
== 4a. Previous schema (20261019104504_AddRefreshTokenSessionStart), then the script
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
== 4b. Base schema
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
== 5. dotnet-ef database update: latest, down to 20261019104504_AddRefreshTokenSessionStart, latest
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
== 6. Same schema
::error::Migration check failed: 6. Same schema: not reached: only 2 of 3 catalogs were migrated
== Result: 3 failure(s); blocking from 2000-01-01; blocking mode.
::error::Migration checks: 3 failure(s).
exit=1
$ git rev-parse --is-shallow-repository
false
```

As expected: the canary is rejected; step 3 fails on both runs with the plan 2.3 A
output (`Msg 207 … 'link_kind'`, history 6 of 15); step 6 is "not reached". Step 4a
passes on the unfixed code because going from N-1 to N applies only migration 15,
which has no pattern; step 3 is the one that finds the defect. 4b is skipped
because BASE = head (`20261020113912_AddApplicationCounts`; GAP-06 adds no migration).

### 3.2 Report mode

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2099-01-01 \
    tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
Migration checks: catalog prefix GAP06_, base rebuild/dotnet-platform, blocking from 2099-01-01 (today 2026-11-01: report mode).
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
::warning::Migration check failed (report mode until 2099-01-01): 3. Script run 1, empty catalog: exit 1, history 6 of 15
::warning::Migration check failed (report mode until 2099-01-01): 3. Script run 2, empty catalog: exit 1, history 6 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
::warning::Migration check failed (report mode until 2099-01-01): 6. Same schema: not reached: only 2 of 3 catalogs were migrated
== Result: 3 failure(s); blocking from 2099-01-01; report mode.
::warning::Migration checks: 3 failure(s), reported only until 2099-01-01.
exit=0
$ git rev-parse --is-shallow-repository
false
```

Report mode reports the same three failures as `::warning::` lines and exits 0.

### 3.3 Canary self-test (local, not committed)

`-b` removed from `apply_script` only:

```
-  apply_out="$(docker exec -e SQLCMDPASSWORD "$container" "$SQLCMD" -S localhost -U sa -C -I -b \
+  apply_out="$(docker exec -e SQLCMDPASSWORD "$container" "$SQLCMD" -S localhost -U sa -C -I \
```

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2099-01-01 \
    tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
Migration checks: catalog prefix GAP06_, base rebuild/dotnet-platform, blocking from 2099-01-01 (today 2026-11-01: report mode).
== 1. Generate the idempotent script and read the migration ids
N=15, latest=20261020113912_AddApplicationCounts, previous=20261019104504_AddRefreshTokenSessionStart
base (rebuild/dotnet-platform) newest migration: 20261020113912_AddApplicationCounts
== 2. Canary: add a column and use it in one batch
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 4
Invalid column name 'new_col'.
::error::Migration checks are broken: the canary was not rejected (exit 0). sqlcmd has lost -b, or the check no longer sees the defect.
exit=1
$ git rev-parse --is-shallow-repository
false
```

Even in report mode, a runner without `-b` fails the job. Restored from the saved
copy: `cmp` equal ("restored"), and `git status --short` showed no change to `run.sh`
before commit `0f6fd6f`.

### 3.4 Input refusals

```
MIGRATION_CHECKS_BLOCKING_FROM=""                                  → ::error::Migration checks cannot run: MIGRATION_CHECKS_BLOCKING_FROM must be a real date, YYYY-MM-DD (got '')
MIGRATION_CHECKS_BLOCKING_FROM="<merge date + 7 days, YYYY-MM-DD>"  → … (got '<merge date + 7 days, YYYY-MM-DD>')
MIGRATION_CHECKS_BLOCKING_FROM=2026-02-30                          → … (got '2026-02-30'), exit=1
MIGRATION_CHECK_DB_PREFIX=digitalhubcontent_x                      → ::error::Migration checks cannot run: MIGRATION_CHECK_DB_PREFIX may not start with DigitalHubContent (got 'digitalhubcontent_x'), exit=1
SA_PASSWORD unset                                                  → ::error::Migration checks cannot run: SA_PASSWORD is not set, exit=1
```

After these runs: `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06%'` → `0`,
and no `GAP06` file is left in the container's `/tmp`.

## 4. The migration change, shown before it was applied (plan 5.2, `AGENTS.md`)

This section was written, and commit `8b41c00` made, before the edited migrations
were applied to any catalog. The first catalog they touched was a `GAP06_` scratch
catalog in section 5.

### 4.1 `git diff 0f6fd6f 8b41c00 -- api/src`

```diff
diff --git a/api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs b/api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs
index 277fb87..6e85843 100644
--- a/api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs
+++ b/api/src/DigitalHub.Api/Data/Migrations/20260922142757_NavigationLinkRefs.cs
@@ -14,6 +14,89 @@ namespace DigitalHub.Api.Data.Migrations
     /// </summary>
     public partial class NavigationLinkRefs : Migration
     {
+        // The idempotent script compiles each migration as one batch, before the
+        // AddColumn calls in Up have run, so a direct reference to link_kind,
+        // target_type or target_id fails (Msg 207). EXEC compiles it when it runs.
+        private const string ConvertLinksSql =
+            """
+            DELETE n
+            FROM navigation_items n
+            CROSS JOIN site_settings s
+            WHERE n.url = 'mailto:' + s.email
+               OR n.url = s.linked_in
+               OR n.url = s.facebook
+               OR n.url = s.instagram
+               OR n.url = s.tik_tok
+               OR (
+                    n.url LIKE 'tel:%'
+                    AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(s.phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')
+                        = REPLACE(n.url, 'tel:', '')
+                  );
+
+            UPDATE n SET
+              link_kind = 'internal',
+              target_type = 'service',
+              target_id = s.id,
+              url = NULL
+            FROM navigation_items n
+            INNER JOIN services s ON n.url = '/services/' + s.slug;
+
+            UPDATE n SET
+              link_kind = 'internal',
+              target_type = 'partner',
+              target_id = p.id,
+              url = NULL
+            FROM navigation_items n
+            INNER JOIN partners p ON n.url = '/partners/' + p.slug;
+
+            UPDATE n SET
+              link_kind = 'internal',
+              target_type = 'case_study',
+              target_id = c.id,
+              url = NULL
+            FROM navigation_items n
+            INNER JOIN case_studies c ON n.url = '/cases/' + c.slug;
+
+            UPDATE n SET
+              link_kind = 'internal',
+              target_type = 'blog_post',
+              target_id = b.id,
+              url = NULL
+            FROM navigation_items n
+            INNER JOIN blog_posts b ON n.url = '/blogs/' + b.slug;
+
+            UPDATE n SET
+              link_kind = 'internal',
+              target_type = 'page',
+              target_id = pg.id,
+              url = NULL
+            FROM navigation_items n
+            INNER JOIN pages pg ON
+              (n.url = '/' AND pg.slug = 'home')
+              OR (n.url = '/about' AND pg.slug = 'about')
+              OR (n.url = '/contact' AND pg.slug = 'contact')
+              OR (n.url = '/news' AND pg.slug = 'news')
+              OR (n.url = '/partners' AND pg.slug = 'partners')
+              OR (n.url = '/cases' AND pg.slug = 'cases')
+              OR (n.url = '/blogs' AND pg.slug = 'blogs')
+              OR (n.url = '/careers' AND pg.slug = 'careers')
+              OR (n.url = '/careers/apply' AND pg.slug = 'apply');
+
+            UPDATE navigation_items
+            SET url = NULL, target_type = NULL, target_id = NULL
+            WHERE link_kind = 'group' AND (url IS NULL OR LTRIM(RTRIM(url)) = '');
+
+            IF EXISTS (
+              SELECT 1 FROM navigation_items
+              WHERE NOT (
+                (link_kind = 'group' AND target_type IS NULL AND target_id IS NULL AND url IS NULL)
+                OR (link_kind = 'external' AND target_type IS NULL AND target_id IS NULL AND url IS NOT NULL AND url <> '')
+                OR (link_kind = 'internal' AND target_type IS NOT NULL AND target_id IS NOT NULL AND url IS NULL)
+              )
+            )
+              THROW 50002, 'Navigation link conversion left a row with no valid shape.', 1;
+            """;
+
         /// <inheritdoc />
         protected override void Up(MigrationBuilder migrationBuilder)
         {
@@ -48,85 +131,7 @@ namespace DigitalHub.Api.Data.Migrations
                 maxLength: 32,
                 nullable: true);
 
-            migrationBuilder.Sql(
-                """
-                DELETE n
-                FROM navigation_items n
-                CROSS JOIN site_settings s
-                WHERE n.url = 'mailto:' + s.email
-                   OR n.url = s.linked_in
-                   OR n.url = s.facebook
-                   OR n.url = s.instagram
-                   OR n.url = s.tik_tok
-                   OR (
-                        n.url LIKE 'tel:%'
-                        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(s.phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')
-                            = REPLACE(n.url, 'tel:', '')
-                      );
-
-                UPDATE n SET
-                  link_kind = 'internal',
-                  target_type = 'service',
-                  target_id = s.id,
-                  url = NULL
-                FROM navigation_items n
-                INNER JOIN services s ON n.url = '/services/' + s.slug;
-
-                UPDATE n SET
-                  link_kind = 'internal',
-                  target_type = 'partner',
-                  target_id = p.id,
-                  url = NULL
-                FROM navigation_items n
-                INNER JOIN partners p ON n.url = '/partners/' + p.slug;
-
-                UPDATE n SET
-                  link_kind = 'internal',
-                  target_type = 'case_study',
-                  target_id = c.id,
-                  url = NULL
-                FROM navigation_items n
-                INNER JOIN case_studies c ON n.url = '/cases/' + c.slug;
-
-                UPDATE n SET
-                  link_kind = 'internal',
-                  target_type = 'blog_post',
-                  target_id = b.id,
-                  url = NULL
-                FROM navigation_items n
-                INNER JOIN blog_posts b ON n.url = '/blogs/' + b.slug;
-
-                UPDATE n SET
-                  link_kind = 'internal',
-                  target_type = 'page',
-                  target_id = pg.id,
-                  url = NULL
-                FROM navigation_items n
-                INNER JOIN pages pg ON
-                  (n.url = '/' AND pg.slug = 'home')
-                  OR (n.url = '/about' AND pg.slug = 'about')
-                  OR (n.url = '/contact' AND pg.slug = 'contact')
-                  OR (n.url = '/news' AND pg.slug = 'news')
-                  OR (n.url = '/partners' AND pg.slug = 'partners')
-                  OR (n.url = '/cases' AND pg.slug = 'cases')
-                  OR (n.url = '/blogs' AND pg.slug = 'blogs')
-                  OR (n.url = '/careers' AND pg.slug = 'careers')
-                  OR (n.url = '/careers/apply' AND pg.slug = 'apply');
-
-                UPDATE navigation_items
-                SET url = NULL, target_type = NULL, target_id = NULL
-                WHERE link_kind = 'group' AND (url IS NULL OR LTRIM(RTRIM(url)) = '');
-
-                IF EXISTS (
-                  SELECT 1 FROM navigation_items
-                  WHERE NOT (
-                    (link_kind = 'group' AND target_type IS NULL AND target_id IS NULL AND url IS NULL)
-                    OR (link_kind = 'external' AND target_type IS NULL AND target_id IS NULL AND url IS NOT NULL AND url <> '')
-                    OR (link_kind = 'internal' AND target_type IS NOT NULL AND target_id IS NOT NULL AND url IS NULL)
-                  )
-                )
-                  THROW 50002, 'Navigation link conversion left a row with no valid shape.', 1;
-                """);
+            migrationBuilder.Sql("EXEC(N'" + ConvertLinksSql.Replace("'", "''") + "');");
 
             migrationBuilder.AddCheckConstraint(
                 name: "ck_navigation_items_link_shape",
diff --git a/api/src/DigitalHub.Api/Data/Migrations/20261019104504_AddRefreshTokenSessionStart.cs b/api/src/DigitalHub.Api/Data/Migrations/20261019104504_AddRefreshTokenSessionStart.cs
index 9b08c74..e450ed1 100644
--- a/api/src/DigitalHub.Api/Data/Migrations/20261019104504_AddRefreshTokenSessionStart.cs
+++ b/api/src/DigitalHub.Api/Data/Migrations/20261019104504_AddRefreshTokenSessionStart.cs
@@ -8,6 +8,17 @@ namespace DigitalHub.Api.Data.Migrations
     /// <inheritdoc />
     public partial class AddRefreshTokenSessionStart : Migration
     {
+        // Existing families start at their earliest token, the first sign-in we
+        // have a record of. Without this every existing session would count as
+        // started in year 1 and end at once.
+        // EXEC: the idempotent script compiles this before SessionStartedAt exists.
+        private const string SessionStartSql = @"
+UPDATE token
+SET SessionStartedAt = family.StartedAt
+FROM RefreshTokens AS token
+JOIN (SELECT FamilyId, MIN(CreatedAt) AS StartedAt FROM RefreshTokens GROUP BY FamilyId) AS family
+    ON family.FamilyId = token.FamilyId;";
+
         /// <inheritdoc />
         protected override void Up(MigrationBuilder migrationBuilder)
         {
@@ -18,15 +29,7 @@ namespace DigitalHub.Api.Data.Migrations
                 nullable: false,
                 defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
 
-            // Existing families start at their earliest token, the first sign-in we
-            // have a record of. Without this every existing session would count as
-            // started in year 1 and end at once.
-            migrationBuilder.Sql(@"
-UPDATE token
-SET SessionStartedAt = family.StartedAt
-FROM RefreshTokens AS token
-JOIN (SELECT FamilyId, MIN(CreatedAt) AS StartedAt FROM RefreshTokens GROUP BY FamilyId) AS family
-    ON family.FamilyId = token.FamilyId;");
+            migrationBuilder.Sql("EXEC(N'" + SessionStartSql.Replace("'", "''") + "');");
         }
 
         /// <inheritdoc />
```

### 4.2 The diff only moves the SQL (the `--word-diff` proof)

`git diff --word-diff` shows the whole moved block as removed and added, because the
indentation changes. The same proof is done line by line: the trimmed removed lines
and the trimmed added lines of `git diff -U0` were compared as multisets. Every SQL
line appears on both sides; what differs is only:

```
20260922142757_NavigationLinkRefs.cs
  only removed: ['migrationBuilder.Sql(', '""");']
  only added: ['// The idempotent script compiles each migration as one batch, before the',
               '// AddColumn calls in Up have run, so a direct reference to link_kind,',
               '// target_type or target_id fails (Msg 207). EXEC compiles it when it runs.',
               'private const string ConvertLinksSql =', '', '""";',
               'migrationBuilder.Sql("EXEC(N\'" + ConvertLinksSql.Replace("\'", "\'\'") + "\');");']
20261019104504_AddRefreshTokenSessionStart.cs
  only removed: ['migrationBuilder.Sql(@"', 'ON family.FamilyId = token.FamilyId;");']
  only added: ['// EXEC: the idempotent script compiles this before SessionStartedAt exists.',
               'private const string SessionStartSql = @"', 'ON family.FamilyId = token.FamilyId;";', '',
               'migrationBuilder.Sql("EXEC(N\'" + SessionStartSql.Replace("\'", "\'\'") + "\');");']
```

The raw literal's closing `"""` sits at the same indentation as its content (12
spaces), so the C# string value is the same text as before.

### 4.3 The generated SQL, old against new

Built and scripted at `0f6fd6f` (migrations as on the base) and at `8b41c00`:

```
$ dotnet build DigitalHub.slnx -c Release                       → 13 Warning(s), 0 Error(s), exit 0
$ dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release \
    --project src/DigitalHub.Api/DigitalHub.Api.csproj \
    20260922135931_AddMustChangePassword 20260922142757_NavigationLinkRefs          → exit 0 (144 lines)
$ dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release \
    --project src/DigitalHub.Api/DigitalHub.Api.csproj \
    20261018132426_AddSiteSettingsVersion 20261019104504_AddRefreshTokenSessionStart  → exit 0 (34 lines)
$ … migrations script --idempotent … (full, old and new)                         → exit 0, exit 0
```

A Python check split each script into its `IF NOT EXISTS … BEGIN <body> END;` blocks
and compared old and new. Every changed body must be `EXEC(N'<old body>');` with the
old body's single quotes doubled, and no undoubled quote inside:

```
m7 blocks 7 changed 1 -> each changed body == EXEC(N'<old body, quotes doubled>')
m14 blocks 3 changed 1 -> each changed body == EXEC(N'<old body, quotes doubled>')
full blocks 146 changed 2 -> each changed body == EXEC(N'<old body, quotes doubled>')
```

So in the full script exactly two blocks change, the two planned, and nothing else.

**Migration 7, `20260922142757_NavigationLinkRefs`, the generated `EXEC`:**

```sql
    EXEC(N'DELETE n
    FROM navigation_items n
    CROSS JOIN site_settings s
    WHERE n.url = ''mailto:'' + s.email
       OR n.url = s.linked_in
       OR n.url = s.facebook
       OR n.url = s.instagram
       OR n.url = s.tik_tok
       OR (
            n.url LIKE ''tel:%''
            AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(s.phone, ''''), '' '', ''''), ''-'', ''''), ''('', ''''), '')'', ''''), ''.'', '''')
                = REPLACE(n.url, ''tel:'', '''')
          );

    UPDATE n SET
      link_kind = ''internal'',
      target_type = ''service'',
      target_id = s.id,
      url = NULL
    FROM navigation_items n
    INNER JOIN services s ON n.url = ''/services/'' + s.slug;

    UPDATE n SET
      link_kind = ''internal'',
      target_type = ''partner'',
      target_id = p.id,
      url = NULL
    FROM navigation_items n
    INNER JOIN partners p ON n.url = ''/partners/'' + p.slug;

    UPDATE n SET
      link_kind = ''internal'',
      target_type = ''case_study'',
      target_id = c.id,
      url = NULL
    FROM navigation_items n
    INNER JOIN case_studies c ON n.url = ''/cases/'' + c.slug;

    UPDATE n SET
      link_kind = ''internal'',
      target_type = ''blog_post'',
      target_id = b.id,
      url = NULL
    FROM navigation_items n
    INNER JOIN blog_posts b ON n.url = ''/blogs/'' + b.slug;

    UPDATE n SET
      link_kind = ''internal'',
      target_type = ''page'',
      target_id = pg.id,
      url = NULL
    FROM navigation_items n
    INNER JOIN pages pg ON
      (n.url = ''/'' AND pg.slug = ''home'')
      OR (n.url = ''/about'' AND pg.slug = ''about'')
      OR (n.url = ''/contact'' AND pg.slug = ''contact'')
      OR (n.url = ''/news'' AND pg.slug = ''news'')
      OR (n.url = ''/partners'' AND pg.slug = ''partners'')
      OR (n.url = ''/cases'' AND pg.slug = ''cases'')
      OR (n.url = ''/blogs'' AND pg.slug = ''blogs'')
      OR (n.url = ''/careers'' AND pg.slug = ''careers'')
      OR (n.url = ''/careers/apply'' AND pg.slug = ''apply'');

    UPDATE navigation_items
    SET url = NULL, target_type = NULL, target_id = NULL
    WHERE link_kind = ''group'' AND (url IS NULL OR LTRIM(RTRIM(url)) = '''');

    IF EXISTS (
      SELECT 1 FROM navigation_items
      WHERE NOT (
        (link_kind = ''group'' AND target_type IS NULL AND target_id IS NULL AND url IS NULL)
        OR (link_kind = ''external'' AND target_type IS NULL AND target_id IS NULL AND url IS NOT NULL AND url <> '''')
        OR (link_kind = ''internal'' AND target_type IS NOT NULL AND target_id IS NOT NULL AND url IS NULL)
      )
    )
      THROW 50002, ''Navigation link conversion left a row with no valid shape.'', 1;');
```

**Migration 14, `20261019104504_AddRefreshTokenSessionStart`, the whole generated
script for the migration:**

```sql
BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019104504_AddRefreshTokenSessionStart'
)
BEGIN
    ALTER TABLE [RefreshTokens] ADD [SessionStartedAt] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019104504_AddRefreshTokenSessionStart'
)
BEGIN
    EXEC(N'
    UPDATE token
    SET SessionStartedAt = family.StartedAt
    FROM RefreshTokens AS token
    JOIN (SELECT FamilyId, MIN(CreatedAt) AS StartedAt FROM RefreshTokens GROUP BY FamilyId) AS family
        ON family.FamilyId = token.FamilyId;');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019104504_AddRefreshTokenSessionStart'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261019104504_AddRefreshTokenSessionStart', N'10.0.12');
END;

COMMIT;
GO
```

(EF indents each line of a `Sql` body by four spaces in the script, as it did before
the change. Inside the `EXEC` string that is leading whitespace only.)

### 4.4 Where these were applied

Only to `GAP06_`-prefixed scratch catalogs on `dh-mssql` with `sa` (section 5),
and DigitalHubContent_Test as described in 5.3 #7. Never to `DigitalHubContent` or
`DigitalHubContent_Studio`. The owner's confirmation of this change is still due at
the stop after gate 2, before push (plan 5.2 step 3; approval "Open for the owner").

## 5. After the fix (plan 5.3)

### 5.1 First run after the fix: a failure in `run.sh` (reported before it was fixed)

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 \
    tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
== 6. Same schema
::error::Migration checks cannot run: could not list the schema of GAP06_Script
exit=1
$ git rev-parse --is-shallow-repository
false
```

Steps 2 to 5 passed; step 6 could not run. Cause, found by running the listing query
by hand: `Sqlcmd: The -h and the -y 0 options are mutually exclusive.` On `msdb` the
query also raised `Msg 451 … Cannot resolve collation conflict between
"Latin1_General_CI_AS_KS_WS" and "SQL_Latin1_General_CP1_CI_AS" in add operator`.
Fix, commit `a77ae2e`: list with `-h -1 -y 8000`, trim trailing spaces, and give each
line an explicit `COLLATE DATABASE_DEFAULT`. The query text by hand on `msdb`: exit 0,
1823 lines. No check was loosened; the gate stopped as "cannot run", as designed.

### 5.2 Results

| # | Check | Result |
|---|---|---|
| 1 | The new check, blocking | **Pass.** Exit 0; 50 s locally. Output below (5.3). |
| 1b | Step 4(b) on a real older base (extra) | **Pass.** `BASE_REF=ci/github-actions` (newest migration there: `20260922142757_NavigationLinkRefs`): 4b exit 0, history 15 of 15; four catalogs identical (5.4). |
| 2 | No model change | **Pass.** `dotnet tool run dotnet-ef -- migrations has-pending-model-changes --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj` → "No changes have been made to the model since the last migration." exit 0. |
| 3 | Only planned files | **Pass.** `git diff --name-only origin/rebuild/dotnet-platform...HEAD` → `.github/workflows/ci.yml`, the two migration `.cs` files, `api/tools/migration-checks/canary-add-column-then-sql.sql`, `api/tools/migration-checks/run.sh`, and `docs/changes/GAP-06/{implementation,plan-approval,plan-review,plan}.md`. No `*.Designer.cs`, no snapshot. |
| 4 | Data equivalence from migration 6, with data | **Pass.** Output in 5.5. |
| 5 | Guard still fires | **Pass**, both routes. Output in 5.5. |
| 6 | Build | **Pass.** `dotnet build DigitalHub.slnx -c Release` → `13 Warning(s)`, `0 Error(s)`, exit 0. That is the 27 October baseline's 13, not above it. |
| 7 | Integration tests | **Pass.** Run on `DigitalHubContent_Test` after the coordinator's confirmation (condition 3). Immediately before: `16:13:03 other sessions on DigitalHubContent_Test: 0` (`sys.dm_exec_sessions` by `database_id`). The catalog was already at 15 of 15 migrations (`20261020113912_AddApplicationCounts`), so nothing was migrated on it; it was not dropped or recreated. `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` with the `ci.yml` connection strings → `Passed!  - Failed:     0, Passed:   475, Skipped:     0, Total:   475, Duration: 2 m 8 s`, exit 0. |
| 8 | Script lint | `bash -n api/tools/migration-checks/run.sh` → exit 0. `shellcheck`: **NOT RUN**. It is not installed on this container, and running a downloaded copy was refused by this session's permission policy. Covered later by actionlint with shellcheck in GAP-08 (approval condition 7), and by the tester if they have it. |
| 9 | CI on the PR | **NOT RUN.** Nothing is pushed without the owner's OK (approval condition 6). CI job `api` covers it when the PR opens; the step log should show the canary rejected, 15/15 twice, previous schema exit 0, schemas identical, "blocking from 2026-11-12". |
| 10 | Clean-up | **Pass.** `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06%'` → `0`, after every local run and at the end. No `GAP06` file left in the container's `/tmp`. |
| 11 | Studio-copy test | **NOT RUN, pending owner.** There is no copy of `DigitalHubContent_Studio` on this server; the owner runs plan 5.5, with the query in section 6 below as `$schema`. |

Shallow state: `git rev-parse --is-shallow-repository` printed `false` before and
after every local run of 5.1 and 5.3 #1 (quoted with each run). At the start of this
round it printed `true`, because another agent's `--depth=1` fetch of
`feature/interviewer-portal` had made the shared repository shallow (15:54:02 UTC). I
stopped and reported it, as condition 1 requires. The coordinator ran `git fetch
--unshallow origin` and I resumed only after it printed `false`. `run.sh` itself never
fetched locally.

### 5.3 Check #1, after the fix (blocking), commit `a77ae2e`

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 \
    tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
Migration checks: catalog prefix GAP06_, base rebuild/dotnet-platform, blocking from 2000-01-01 (today 2026-11-01: blocking mode).
== 1. Generate the idempotent script and read the migration ids
N=15, latest=20261020113912_AddApplicationCounts, previous=20261019104504_AddRefreshTokenSessionStart
base (rebuild/dotnet-platform) newest migration: 20261020113912_AddApplicationCounts
== 2. Canary: add a column and use it in one batch
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
== 3. Idempotent script twice on an empty catalog
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
== 4a. Previous schema (20261019104504_AddRefreshTokenSessionStart), then the script
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
== 4b. Base schema
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
== 5. dotnet-ef database update: latest, down to 20261019104504_AddRefreshTokenSessionStart, latest
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
== 6. Same schema
PASS  6. Same schema: 3 catalogs (GAP06_Script GAP06_Previous GAP06_Ef), 468 lines each, identical
== Result: 0 failure(s); blocking from 2000-01-01; blocking mode.
exit=0
$ git rev-parse --is-shallow-repository
false
```

The 468 lines match the plan's 2.3 D count.

### 5.4 Step 4(b) on an older base (extra; this PR's base equals head)

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 \
    BASE_REF=ci/github-actions tools/migration-checks/run.sh dh-mssql; echo "exit=$?"
base (ci/github-actions) newest migration: 20260922142757_NavigationLinkRefs
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
PASS  4b. Base schema, script: from 20260922142757_NavigationLinkRefs: exit 0, history 15 of 15
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
PASS  6. Same schema: 4 catalogs (GAP06_Script GAP06_Previous GAP06_Base GAP06_Ef), 468 lines each, identical
== Result: 0 failure(s); blocking from 2000-01-01; blocking mode.
exit=0
$ git rev-parse --is-shallow-repository
false
```

And the two "cannot run" paths for the base, each exit 1 before any catalog is made:

```
BASE_REF=feature/interviewer-portal → ::error::Migration checks cannot run: no migration found on feature/interviewer-portal
BASE_REF=no/such-branch             → ::error::Migration checks cannot run: origin/no/such-branch is not available locally (this script does not fetch in a full clone)
```

### 5.5 Checks #4 and #5: data and guard, from migration 6

Catalogs `GAP06_PrevEf`, `GAP06_PrevScript`, `GAP06_Guard` and `GAP06_GuardEf` were
each created and brought to `20260922135931_AddMustChangePassword` with `dotnet-ef
database update` (each exit 0). The idempotent script is the full script from
`8b41c00` (section 4.3), copied in with `docker cp` and applied with `sqlcmd -S
localhost -U sa -C -I -b -d <db> -i <file>`.

(First attempt, reported: piping the script through stdin, `-i /dev/stdin`, failed
with `Msg 102 … Incorrect syntax near '﻿'`. That is the script's UTF-8 BOM, which
`sqlcmd` skips in a file but not on stdin. It was my harness, not the migrations, and
`run.sh` uses `docker cp`. The catalogs were dropped and the run was repeated with
`docker cp`.)

Seed script, applied to `GAP06_PrevEf` and `GAP06_PrevScript` (each exit 0):

```sql
SET NOCOUNT ON;
INSERT site_settings (id, phone, email, linked_in) VALUES (NEWID(), N'+20 (12) 345-678', N'hi@x.example', N'https://linkedin.example/x');
INSERT pages (id, slug, title, status, sort_order, created_at, updated_at, version, no_index) VALUES
 ('11111111-0000-0000-0000-000000000001', N'home', N'Home', N'published', 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0),
 ('11111111-0000-0000-0000-000000000002', N'about', N'About', N'published', 1, SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0);
INSERT services (id, summary, icon, visual, featured, slug, title, status, sort_order, created_at, updated_at, version, no_index) VALUES
 ('22222222-0000-0000-0000-000000000001', N's', N'i', N'v', 0, N'web', N'Web', N'published', 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 1, 0);
INSERT navigation_items (id, menu, parent_id, label, url, sort_order) VALUES
 ('33333333-0000-0000-0000-000000000001', N'header', NULL, N'Group', N'', 0),
 ('33333333-0000-0000-0000-000000000002', N'header', NULL, N'Home', N'/', 1),
 ('33333333-0000-0000-0000-000000000003', N'header', NULL, N'About', N'/about', 2),
 ('33333333-0000-0000-0000-000000000004', N'header', NULL, N'Web', N'/services/web', 3),
 ('33333333-0000-0000-0000-000000000005', N'footer', NULL, N'Mail', N'mailto:hi@x.example', 4),
 ('33333333-0000-0000-0000-000000000006', N'footer', NULL, N'Phone', N'tel:+2012345678', 5),
 ('33333333-0000-0000-0000-000000000007', N'footer', NULL, N'LinkedIn', N'https://linkedin.example/x', 6);
INSERT AspNetUsers (Id, EmailConfirmed, PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount, MustChangePassword) VALUES (N'u1', 0, 0, 0, 0, 0, 0);
INSERT RefreshTokens (Id, UserId, TokenHash, CsrfTokenHash, FamilyId, ExpiresAt, CreatedAt) VALUES
 (NEWID(), N'u1', N'a', N'a', '44444444-0000-0000-0000-000000000001', '2027-01-01', '2026-10-01T10:00:00'),
 (NEWID(), N'u1', N'b', N'b', '44444444-0000-0000-0000-000000000001', '2027-01-01', '2026-10-05T10:00:00'),
 (NEWID(), N'u1', N'c', N'c', '44444444-0000-0000-0000-000000000002', '2027-01-01', '2026-10-03T10:00:00');
```

Guard seed, on `GAP06_Guard` and `GAP06_GuardEf`: one row, `INSERT navigation_items
(id, menu, parent_id, label, url, sort_order) VALUES (NEWID(), N'header', NULL,
N'Missing', N'/services/missing', 0);`

Data query:

```sql
SELECT label + '|' + ISNULL(url,'NULL') + '|' + link_kind + '|' + ISNULL(target_type,'NULL') + '|' + ISNULL(CAST(target_id AS varchar(36)),'NULL') FROM navigation_items ORDER BY sort_order;
SELECT TokenHash + '|' + CONVERT(varchar(19), SessionStartedAt, 126) FROM RefreshTokens ORDER BY TokenHash;
SELECT 'site_settings ' + CAST(COUNT(*) AS varchar) FROM site_settings;
SELECT 'history ' + CAST(COUNT(*) AS varchar) FROM __EFMigrationsHistory;
```

Results:

```
ef GAP06_PrevEf latest exit=0
script (sqlcmd -I -b) GAP06_PrevScript exit=0
script (sqlcmd -I -b) GAP06_PrevScript exit=0
Group|NULL|group|NULL|NULL
Home|NULL|internal|page|11111111-0000-0000-0000-000000000001
About|NULL|internal|page|11111111-0000-0000-0000-000000000002
Web|NULL|internal|service|22222222-0000-0000-0000-000000000001
a|2026-10-01T10:00:00
b|2026-10-01T10:00:00
c|2026-10-03T10:00:00
site_settings 1
history 15
diff GAP06_PrevEf GAP06_PrevScript → DATA IDENTICAL

script (sqlcmd -I -b) GAP06_Guard exit=1
Msg 50002, Level 16, State 1, Server 42701ab3ab3a, Line 76
Navigation link conversion left a row with no valid shape.
history 6
link_kind NULL
trancount 0

ef GAP06_GuardEf latest exit=1
Microsoft.Data.SqlClient.SqlException (0x80131904): Navigation link conversion left a row with no valid shape.
Error Number:50002,State:1,Class:16
history 6
link_kind NULL
```

The mail, phone and LinkedIn rows were deleted, the internal links were converted,
and `SessionStartedAt` holds each family's earliest `CreatedAt`. This is the same on
both routes. The guard still rolls the whole migration back on both routes. After
this, all four catalogs were dropped and the `GAP06` count was `0`.

## 6. The schema-listing query, in full (approval condition 4)

This is the query `run.sh` uses in step 6, as committed in `a77ae2e`. For plan 5.5 the
owner can paste it as `$schema` (one line or as is). Prefix it with `SET NOCOUNT ON;`,
run it with `sqlcmd -h -1 -y 8000` (not `-W`: its default width cuts lines at 256
characters, and the `ck_navigation_items_link_shape` line is longer), and trim trailing
spaces before comparing, as `run.sh` does. In PowerShell 5.5, add `-y 8000` to the
`$schema` call in place of `-W`; `Compare-Object` of the before and after files then
compares like with like.

```sql
SELECT line FROM (
  SELECT 'COL|' COLLATE DATABASE_DEFAULT + t.name + '|' + c.name + '|' + ty.name
       + '|' + CAST(c.max_length AS varchar(10)) + '|' + CAST(c.precision AS varchar(10)) + '|' + CAST(c.scale AS varchar(10))
       + '|' + CASE c.is_nullable WHEN 1 THEN 'NULL' ELSE 'NOT NULL' END
       + '|' + CASE c.is_identity WHEN 1 THEN 'IDENTITY' ELSE '' END
       + '|' + ISNULL(c.collation_name, '') AS line
  FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  UNION ALL
  SELECT 'IDX|' COLLATE DATABASE_DEFAULT + t.name + '|' + i.name + '|' + i.type_desc
       + '|' + CASE i.is_unique WHEN 1 THEN 'UNIQUE' ELSE '' END
       + '|' + CASE i.is_primary_key WHEN 1 THEN 'PK' ELSE '' END
       + '|' + ISNULL((SELECT STRING_AGG(c.name + CASE ic.is_descending_key WHEN 1 THEN ' DESC' ELSE '' END
                                     + CASE ic.is_included_column WHEN 1 THEN ' INCLUDE' ELSE '' END, ',')
                              WITHIN GROUP (ORDER BY ic.is_included_column, ic.key_ordinal, c.name)
                       FROM sys.index_columns ic
                       JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                       WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id), '')
       + '|' + ISNULL(i.filter_definition, '')
  FROM sys.indexes i
  JOIN sys.tables t ON t.object_id = i.object_id
  WHERE i.type > 0
  UNION ALL
  SELECT 'CHK|' COLLATE DATABASE_DEFAULT + t.name + '|' + cc.name + '|' + REPLACE(REPLACE(cc.definition, CHAR(13), ' '), CHAR(10), ' ')
  FROM sys.check_constraints cc
  JOIN sys.tables t ON t.object_id = cc.parent_object_id
  UNION ALL
  SELECT 'FK|' COLLATE DATABASE_DEFAULT + t.name + '|' + fk.name + '|' + rt.name
       + '|' + fk.delete_referential_action_desc + '|' + fk.update_referential_action_desc
       + '|' + ISNULL((SELECT STRING_AGG(pc.name + '->' + rc.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id)
                       FROM sys.foreign_key_columns fkc
                       JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
                       JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
                       WHERE fkc.constraint_object_id = fk.object_id), '')
  FROM sys.foreign_keys fk
  JOIN sys.tables t ON t.object_id = fk.parent_object_id
  JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
  UNION ALL
  SELECT 'DEF|' COLLATE DATABASE_DEFAULT + t.name + '|' + c.name + '|' + dc.definition
  FROM sys.default_constraints dc
  JOIN sys.tables t ON t.object_id = dc.parent_object_id
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
) AS schema_lines
ORDER BY line;
```

## 7. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| CI applies the idempotent script twice to an empty catalog, both exit 0 | Refinement plan, GAP-06 "Done when" | Done locally; CI pending | 5.3: step 3 runs 1 and 2, exit 0, history 15 of 15. CI: 5.3 #9 NOT RUN, no push without the owner's OK. |
| CI upgrades from the previous schema, exit 0 (script route and `database update` route) | Refinement plan, GAP-06 "Done when"; G-4 | Done locally; CI pending | 5.3: 4a exit 0, 15 of 15; 5: latest → N-1 → latest, each exit 0. |
| Each migration change is shown before it is applied | Refinement plan, GAP-06 "Done when"; `AGENTS.md` | Done for scratch catalogs; owner confirmation pending | Section 4, committed in `b92d325` before any catalog run of `8b41c00`. The owner's confirmation is due at the stop after gate 2 (plan 5.2 step 3). |
| `NavigationLinkRefs` applies through the idempotent script | Plan item; finding 4 | Done | 3.1 red (`Msg 207 'link_kind'`, 6 of 15) → 5.3 green (15 of 15). |
| `AddRefreshTokenSessionStart` applies through the idempotent script | Plan item; finding 4 | Done | 15 of 15 in 5.3; `SessionStartedAt` data in 5.5. |
| Every migration with the pattern is found and fixed (15 of 15 apply) | Refinement plan metrics | Done | 4.3: only two blocks change in the full script; 5.3: 15 of 15, twice. |
| The edits do not change what the SQL does | Risk "Editing applied migrations" | Done | 4.2 and 4.3 (body equals the old SQL with quotes doubled); 5.3 step 6 (468 lines identical); 5.5 (data identical, guard fires and rolls back on both routes). |
| Test on a copy of `DigitalHubContent_Studio` | Risk "Editing applied migrations" | NOT RUN, pending owner | There is no copy on this server; plan 5.5 is owner-run, with the query in section 6. |
| CI upgrades from the base branch's schema when a PR adds migrations (step 4b) | Plan review round 1, finding 6 | Done locally | 5.4: `BASE_REF=ci/github-actions`, 4b exit 0, 4 catalogs identical. This PR logs "base = head, covered by step 3". |
| No model or snapshot change | Plan 3.1 | Done | 5.2 #2 and #3. |
| The gate reports until `MIGRATION_CHECKS_BLOCKING_FROM`, then blocks | `ENGINEERING_STANDARDS.md` section 3; G1 checklist | Done | 3.1 (blocking: exit 1), 3.2 (report: exit 0 with `::warning::`), 3.4 (bad date refused). Committed date `2026-11-12`, an assumption (section 2.1). |
| The canary fixture is rejected on every run and guards `-b` | G1 checklist; GAP-21 | Done | Every run: "PASS 2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'"; 3.3: without `-b`, exit 1 "the canary was not rejected", even in report mode. |
| Scratch catalogs only; none left behind | `docs/changes/README.md` | Done | Only `GAP06_*` catalogs were created; `DigitalHubContent_Test` was used for tests only, not migrated or dropped; count `0` at the end (5.2 #10). |

## 8. Approval conditions

1. **Shallow repository.** Met. `run.sh` never fetches in a full clone (section 2.1).
   `false` is quoted before and after each local run. The one time it printed `true`
   (before any run), I stopped and reported it (5.2).
2. **Show before applying, in order.** Met. `0f6fd6f` holds the check alone, with red
   output (section 3), and comes before `8b41c00`. `b92d325` records the diff, the
   move proof and the generated SQL, before any catalog run of the edited migrations
   (section 4).
3. **Throwaway catalogs only.** Met. Only `GAP06_*` catalogs were created. The
   coordinator confirmed that `DigitalHubContent_Test` could be used for the suite;
   there were 0 other sessions immediately before, and it was not dropped, recreated
   or migrated. Count `0` at the end.
4. **Schema-listing query in full.** Met, section 6.
5. **Blocking date.** Met. `MIGRATION_CHECKS_BLOCKING_FROM: "2026-11-12"`, a literal
   date, validated by `run.sh` (3.4). **Assumption for gate 2 and the integrator:** the
   merge is no earlier than 5 November 2026. If it is later, move the date to the merge
   day plus 7 in the same merge.
6. **Merge order.** Nothing pushed. When the owner allows a merge, this PR queues in
   Wave 1 slot 1, behind Wave 0 (GAP-01 to GAP-03).
7. **`ci.yml` rebase.** No rebase was needed (base `6470fac` is unchanged). The step
   sits directly after "Apply migrations to the fresh database" and inherits
   `working-directory: api`. The `api` job's checkout keeps its default credentials,
   so `git fetch` reaches `origin`. GAP-08's actionlint is not on the base yet.
8. **Secrets.** Met. No `set -x`. The password goes to `sqlcmd` through an inherited
   environment variable, and captured output is passed through `redact`. No local log
   contains the password, and the step summary prints only check names and counts.

## 9. For the tester

- `run.sh` expects to be run from `api/` after `dotnet tool restore` and a Release
  build. Locally: `SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=<yours>_
  MIGRATION_CHECKS_BLOCKING_FROM=<date> tools/migration-checks/run.sh dh-mssql`. Use
  your own prefix (for example `GAP06T_`); the catalogs are dropped on exit.
- Locally the repository must be a full clone (`--is-shallow-repository` = `false`).
  Then the base is read from `origin/rebuild/dotnet-platform`, and there is no fetch.
- Step 4a passes even on the unfixed migrations (N-1 → N applies only migration 15).
  Step 3 is the one that catches the defect.
- To feed a script to `sqlcmd` by hand, use `docker cp` and `-i <file>`, not stdin:
  the generated script starts with a UTF-8 BOM, which fails on stdin (5.5).

## 10. Rework round 1 (answering `test-report.md` round 1, `Verdict: CHANGES NEEDED`)

Developer, 1 November 2026. Fix commit `d8e2748` ("GAP-06: Answer test report round 1
in the migration checks"); only `api/tools/migration-checks/run.sh` changed.
`test-report.md` is left uncommitted, as instructed. The coordinator asked for
findings 1, 3 and 4, and finding 2 if small; all four are answered. Each failing check
was run and quoted before the fix. There is no committed self-test for `run.sh`:
plan section 4 does not list one, so adding it would grow the scope. The checks below
are command-level and can be re-run as written.

`git rev-parse --is-shallow-repository` → `false` before and after every `run.sh` run
in this round. Catalogs: `GAP06_*` only; at the end `SELECT COUNT(*) FROM sys.databases
WHERE name LIKE 'GAP06%'` → `0`, and the container's `/tmp` is empty.

**shellcheck install.** GAP-08's checksum-verifying installer, into a scratch folder,
with the pins from GAP-08's `workflow-lint.yml`:

```
$ RUNNER_TEMP=<scratch>/gap06-lint ACTIONLINT_VERSION=1.7.12 ACTIONLINT_SHA256=8aca8db9…a3d8 \
    SHELLCHECK_VERSION=0.11.0 SHELLCHECK_SHA256=8c3be12b…7198 sh /home/user/wt-GAP-08/.github/lint/install-actionlint.sh
…/actionlint_1.7.12_linux_amd64.tar.gz: OK
…/shellcheck-v0.11.0.linux.x86_64.tar.xz: OK
1.7.12
ShellCheck - shell script analysis tool
version: 0.11.0
exit=0
```

### Finding 1 (shellcheck, 3 findings): fixed

Red, at `f77c4b0`: `shellcheck tools/migration-checks/run.sh` → exit 1:

```
In tools/migration-checks/run.sh line 32:  SC2155 (warning): Declare and assign separately to avoid masking return values.
In tools/migration-checks/run.sh line 111: SC2329 (info): This function is never invoked. Check usage (or ignored if invoked indirectly).
In tools/migration-checks/run.sh line 191: SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.
```

Fixes:

- **SC2155:** `SCRIPT_DIR="$(cd … && pwd)"`, then `readonly SCRIPT_DIR` on its own line.
  A failing `cd` now stops the script under `set -e`.
- **SC2015:** `if [[ ! "$n" =~ ^[0-9]+$ ]] || (( n < 2 )); then cannot_run …; fi`.
- **SC2329:** this is a false positive, shown with a 5-line script:
  `cleanup() { echo bye; }` / `trap cleanup EXIT` / `echo hi` / `exit 0` → shellcheck
  0.11.0 reports SC2329 on `cleanup`. The same script without the final `exit 0`, and
  the first 433 lines of `run.sh` (everything except its final `exit 0`), report
  nothing. So the trap handler is reported only because the script ends with an
  explicit `exit`. I kept the explicit `exit 0`, because an implicit exit status
  would break silently if a line were added later. The directive covers only the
  `cleanup` function and gives the reason:
  `# shellcheck disable=SC2329 # Run by \`trap cleanup EXIT\` below. ShellCheck 0.11.0 reports a`
  `# trap handler as never invoked when the script ends with an explicit \`exit\`.`

Green, at `d8e2748`: `shellcheck tools/migration-checks/run.sh` → exit 0, no output.
`bash -n` → exit 0. Also, `actionlint -shellcheck=<scratch>/shellcheck
.github/workflows/ci.yml` → exit 0.

### Finding 2 (`docker exec` failure hides the cause): fixed

Red, at `f77c4b0`, with a mutant in the scratch folder (the source was not edited):
`SQLCMD="/opt/mssql-tools/bin/sqlcmd"` → exit 1:

```
== 2. Canary: add a column and use it in one batch
::error::Migration checks cannot run: could not create catalog GAP06_Canary
::warning::Could not drop scratch catalog GAP06_Canary
```

Fix: when the output has no `Msg …` or `Sqlcmd: Error` line, `errors_of` prints its last
10 lines (still through `redact`). The misleading "Could not drop" warning is gone too,
because a catalog is added to the drop list only after `CREATE DATABASE` succeeds
(finding 4). Green, the same mutant made from `d8e2748` → exit 1:

```
== 2. Canary: add a column and use it in one batch
OCI runtime exec failed: exec failed: unable to start container process: exec: "/opt/mssql-tools/bin/sqlcmd": stat /opt/mssql-tools/bin/sqlcmd: no such file or directory
::error::Migration checks cannot run: could not create catalog GAP06_Canary
```

### Finding 3 (any future blocking date accepted): fixed

Red, at `f77c4b0`: `MIGRATION_CHECKS_BLOCKING_FROM=9999-12-31` → accepted, "blocking from
9999-12-31 (today 2026-11-01: report mode)". The tester's full run exited 0. I stopped
mine with `timeout 20` once the date had been accepted, and afterwards no `GAP06`
catalog, container file or process was left.

Fix: `readonly LATEST_BLOCKING_FROM="2026-11-23"` (Wave 1's last blocking day, the same
ceiling as GAP-08's `run-actionlint.sh`). A later date is "cannot run", exit 1. Green, at
`d8e2748`:

```
MIGRATION_CHECKS_BLOCKING_FROM=2026-11-24 → exit=1: ::error::Migration checks cannot run: MIGRATION_CHECKS_BLOCKING_FROM 2026-11-24 is after 2026-11-23, Wave 1's last blocking day
MIGRATION_CHECKS_BLOCKING_FROM=9999-12-31 → exit=1: ::error::Migration checks cannot run: MIGRATION_CHECKS_BLOCKING_FROM 9999-12-31 is after 2026-11-23, Wave 1's last blocking day
MIGRATION_CHECKS_BLOCKING_FROM=2026-11-23 → exit=0, "blocking from 2026-11-23 (today 2026-11-01: report mode)", 0 failure(s)
```

The committed `2026-11-12` is within the ceiling. **For the integrator:** if the merge
slips past 16 November, merge day plus 7 is after 2026-11-23. Then the integrator must
move both `MIGRATION_CHECKS_BLOCKING_FROM` in `ci.yml` and `LATEST_BLOCKING_FROM` in
`run.sh`, in the same reviewed merge. That is the point of the ceiling: the report week
cannot be stretched by the `ci.yml` value alone.

### Finding 4 (`create_catalog` silently drops an existing catalog): fixed

Red, at `f77c4b0`: I created `GAP06_Canary` by hand with a table `someone_elses_work`
(1 row), then ran `MIGRATION_CHECKS_BLOCKING_FROM=2026-11-12 run.sh dh-mssql` → exit 0,
every check PASS, with no message, and afterwards `GAP06_Canary exists: no (dropped by
run.sh)`.

Fix: `create_catalog` runs only `CREATE DATABASE [$db]`. On `Msg 1801` it is "cannot
run", with the reason. A catalog joins the drop-on-exit list only after this run has
created it, so the `trap` never drops a catalog it did not make. Two runs that race on
one name: the second `CREATE DATABASE` fails with 1801, so that run stops. Green, the
same set-up at `d8e2748` → exit 1:

```
Msg 1801, Level 16, State 3, Server 42701ab3ab3a, Line 1
Database 'GAP06_Canary' already exists. Choose a different database name.
::error::Migration checks cannot run: catalog GAP06_Canary already exists. Another run may be using the prefix GAP06_, or a killed run left it: drop it by hand, or set another MIGRATION_CHECK_DB_PREFIX
after: GAP06_Canary rows = 1
```

The pre-existing catalog and its row survived. I then dropped it by hand (it was my
`GAP06_` scratch catalog). In CI each job has a fresh container, so this never fires
there.

### Regression run after the rework, at `d8e2748`

```
$ git rev-parse --is-shallow-repository
false
$ SA_PASSWORD=… MIGRATION_CHECK_DB_PREFIX=GAP06_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 tools/migration-checks/run.sh dh-mssql
Migration checks: catalog prefix GAP06_, base rebuild/dotnet-platform, blocking from 2000-01-01 (today 2026-11-01: blocking mode).
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
PASS  6. Same schema: 3 catalogs (GAP06_Script GAP06_Previous GAP06_Ef), 468 lines each, identical
== Result: 0 failure(s); blocking from 2000-01-01; blocking mode.
exit=0
$ git rev-parse --is-shallow-repository
false
```

The password appears in no log of this round (`grep -l` → none). No migration, `ci.yml`
or other file changed in this round, so 5.3 #2 to #7 are unaffected: no build input
changed, and `run.sh` is not part of the build or the tests.

### Coverage changes

- 5.3 #8 (script lint): now **Pass**, `shellcheck` 0.11.0 → 0 findings (it was NOT RUN
  in round 0).
- The row "The gate reports until `MIGRATION_CHECKS_BLOCKING_FROM`, then blocks" now also
  covers the ceiling: a date after 2026-11-23 is refused.
- The row "Scratch catalogs only; none left behind" now also covers this: a run never
  drops a catalog it did not create.

Status: READY FOR TEST
