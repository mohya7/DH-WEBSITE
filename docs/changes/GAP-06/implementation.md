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
| (this file) | GAP-06: Implementation record | 5.2, 5.3 |

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

@@RESULTS@@
