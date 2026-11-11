# Plan review: GAP-06

## Round 1

Reviewer: plan-reviewer, 1 November 2026. Reviewed `docs/changes/GAP-06/plan.md`
(round 1) on `change/GAP-06` at `6470fac`. Governing files were read from the
session's read-only reference copies (`docs/changes/README.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/quality/test-report-2026-10-27.md`, `ENVIRONMENT.md`). ADR 0001 and the
admin audit do not apply (G1 track).

All checks below ran on a scratch copy of `api/` (`git archive HEAD api` into the
session scratchpad, so the worktree's `bin/`/`obj/` were not touched) and on the
shared `dh-mssql` container, in catalogs prefixed `GAP06R_` only. All seven were
dropped afterwards: `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06R%'`
returned `0`, and the copied `.sql` files were removed from the container.
`git status --short` in the worktree shows only `?? docs/changes/`.

### Findings

**1. Major: section 3.2 step 2 (canary fixture) will not be rejected, so the gate
fails every run.**
The plan describes the canary as one batch: `BEGIN TRANSACTION`, `CREATE TABLE`,
`ALTER TABLE … ADD`, `UPDATE` of the new column. When the table itself is created in
the same batch, SQL Server defers name resolution for the whole `UPDATE` (the table
does not exist at compile time), recompiles it at run time after the column exists,
and the batch succeeds. Msg 207 only happens when the table already exists from an
earlier batch, which is the real shape of migration 7 (`navigation_items` comes from
migration 1).

```
canaryA.sql (plan's shape): BEGIN TRANSACTION; CREATE TABLE canary_t (id int NOT NULL);
  ALTER TABLE canary_t ADD new_col int NULL; UPDATE canary_t SET new_col = 1; COMMIT; GO
$ sqlcmd -S localhost -U sa -C -I -b -d GAP06R_CanA -i canaryA.sql
(0 rows affected)
canaryA exit=0

canaryB.sql: CREATE TABLE canary_t (id int NOT NULL); GO
  BEGIN TRANSACTION; ALTER TABLE canary_t ADD new_col int NULL; UPDATE canary_t SET new_col = 1; COMMIT; GO
$ sqlcmd -S localhost -U sa -C -I -b -d GAP06R_CanB -i canaryB.sql
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 3
Invalid column name 'new_col'.
canaryB exit=1
```

Because step 2 "always fails the job" when the canary is not rejected, the planned
fixture would turn the `api` job red on every run, and the developer cannot change
the fixture's shape without going beyond the plan. To satisfy: specify the fixture
with the table created in its own batch before `GO` (as in `canaryB`), state the
expected `Msg 207 … Invalid column name` and exit 1, and have `run.sh` check the
Msg 207 text as well as the non-zero exit, so a canary that fails for an unrelated
reason (login, `docker cp`, `QUOTED_IDENTIFIER`) is not counted as "rejected".

**2. Minor: section 3.2 step 1, `migrations list --json` without `--no-connect`
cannot be parsed.**
Without `--no-connect`, `dotnet-ef` tries the default connection and writes its
warning to stdout ahead of the JSON:

```
$ dotnet tool run dotnet-ef -- migrations list --json --no-build --configuration Release --project … 2>/dev/null | jq length
jq: parse error: Invalid numeric literal at line 1, column 3      (jq exit=5)
$ … migrations list --json --no-connect --no-build … 2>/dev/null | jq -r '.[-2].id'
20261019104504_AddRefreshTokenSessionStart
```

It would also open a connection to whatever the default `ConnectionStrings:Content`
names: in CI, `DigitalHubContent` on the job's container; on the owner's machine,
the real `DigitalHubContent` (a read, but needless). To satisfy: add
`--no-connect` (and `--prefix-output` if the parser needs it) to the exact command.

**3. Minor: section 3.2 "Report mode" and 5.4, the blocking date rule.**
Standard section 3 says a new gate reports "for seven days from its merge". The
plan sets the date to "the PR's opening date + 7" and then says to move it so there
are seven days after merge. Opening + 7 gives fewer than seven report days whenever
the merge is later than the opening day, so the first rule is wrong and the second
is the real one. To satisfy: state the rule once as "merge date + 7", set by the
developer at the latest rebase before merge, with tech-lead gate 2 (or the
integrator) checking it against the actual merge day.

**4. Minor: section 10 and 11, the `DigitalHubContent_Studio` test from the risk
row.**
The refinement plan's mitigation for "Editing applied migrations" includes "test it
on a copy of `DigitalHubContent_Studio`". The plan records it as NOT RUN because no
copy is on this server. The reasoning that it is unreachable is sound (verified
below), but the owner's machine has the catalog, so the item can still be closed. To
satisfy: give the exact owner-run steps (copy `DigitalHubContent_Studio` to a scratch
name, record `__EFMigrationsHistory` and the schema listing, apply the new
idempotent script with `sqlcmd -I -b`, expect exit 0, history and schema unchanged,
drop the copy) and keep the row "NOT RUN, pending owner" in the coverage table,
rather than closing it on reasoning alone.

**5. Minor: section 5.2 step 3, "Stop and wait for confirmation per `AGENTS.md`".**
The plan does not say who confirms. A tech-lead approval is not the owner's
confirmation (`docs/changes/README.md`). To satisfy: name who gives the
confirmation and where it is recorded (for example, the plan's section 7 plus the
generated SQL in `implementation.md`, relayed to the owner by the coordinator), so the
developer knows whether to stop or go on with scratch catalogs only.

**6. Minor: section 3.2 step 4, "previous schema" = N-1.**
`PREV` is the second-to-last migration id. For a later pull request that adds two
migrations, N-1 is not the base branch's schema, and the upgrade from the schema
actually deployed is not tested. To satisfy: either take `PREV` as the newest
migration id on the merge base (`origin/rebuild/dotnet-platform`), or state that N-1
is the definition and record the limitation.

### Checked and found sound

- **Fit.** The plan item, Done-when, register row and risk row are quoted word for
  word and match `refinement-plan-2026-10-28.md` lines 70, 156 and 264. The metric
  6 of 15 → 15 of 15 matches line 241. The owner's words are quoted correctly.
- **Reproduction (2.3 A).** Generated script: `migrations script --idempotent` exit 0,
  1769 lines, 16 `GO`. Applied with `sqlcmd -I -b` to empty `GAP06R_Idem` twice:
  both `exit=1`, `Msg 207 … Line 61/62/63 Invalid column name 'link_kind' /
  'target_type' / 'target_id'`, history `6` both times. Matches the plan and finding 4.
- **The fix (3.1, 7).** Applied the planned C# change (const + `EXEC(N'…' + Replace)`)
  to both migrations in the scratch copy: build 0 errors, 0 warnings;
  `has-pending-model-changes` "No changes have been made to the model since the last
  migration." exit 0; the generated script differs only in the `EXEC(N'…')` wrapper
  and doubled quotes. Fixed script on empty `GAP06R_Fix`, `-I -b`: run 1 `exit=0`,
  history 15; run 2 `exit=0`, history 15.
- **Previous schema.** `GAP06R_Prev` at `20261019104504_AddRefreshTokenSessionStart`
  via `database update`, then the fixed script: exit 0. `GAP06R_Ef`: `database
  update` latest → PREV → latest, each exit 0. Columns, check constraints and indexes
  with filters from `GAP06R_Prev`, `GAP06R_Ef` and `GAP06R_Fix`: 429 lines each,
  identical.
- **Guard still fires through `EXEC`.** `GAP06R_Guard` at migration 6 with one
  `/services/missing` row, fixed script with `-I -b`: `Msg 50002 … Navigation link
  conversion left a row with no valid shape.`, exit 1, history 6,
  `COL_LENGTH('navigation_items','link_kind')` NULL.
- **Catalogs that already ran the migrations (risk row).** EF keys migrations only by
  `MigrationId` in `__EFMigrationsHistory`; there is no checksum. The original
  (unfixed) script applied to the fully migrated `GAP06R_Fix` exits 0 with every
  batch skipped, so a catalog that has the history rows never re-runs `Up` on either
  route, and the edit cannot reach `DigitalHubContent` or `DigitalHubContent_Studio`.
  Run 2 of the script in CI exercises that path.
- **Only migrations 7 and 14 have the pattern** (table in 2.1 checked against the
  source; the full script without `-b` in the plan's 2.3 B is consistent with run 1/2
  above).
- **`ci.yml` footprint and PR #38.** The plan adds one step after line 90 in the
  `api` job and changes no existing line. `git diff HEAD origin/change/ci-runner-pin
  -- .github/workflows/ci.yml` touches only the comment block before `jobs:` and the
  five `runs-on:` lines (39, 120, 175, 269, 334); no overlap with lines 85–91. None of
  the other local change branches (GAP-01, 08, 11, 12) touch `ci.yml`. The step uses
  the job's existing `working-directory: api`, `SA_PASSWORD` and
  `job.services.mssql.id`, as the neighbouring steps do.
- **Wave 1–3 checklist.** One gate (B-8); `MIGRATION_CHECKS_BLOCKING_FROM` report
  week present (date rule in finding 3); a committed canary (shape in finding 1);
  the existing blocking `database update` step is unchanged; no new `uses:`,
  `image:`, `node-version` or `dotnet-version` line, and pinning is correctly left to
  GAP-09/GAP-10 and PR #38; no baseline file needed.
- **Testability.** Red-first is planned (5.1, forced blocking, expecting the
  2.3 A output) before the migration commit, plus a report-mode run and a local
  canary self-test without `-b`. Every Done-when item has a check in 5.3. .NET
  commands run in Release.
- **Security and safety.** No routes, logins or dependencies; `sa` stays the
  workflow-only value, no `set -x`; the prefix refusal of `DigitalHubContent*`,
  `trap` drop and scratch-only catalogs are specified.
- **Rejected alternatives** are real (split migrations would change ids; shared
  helper would change historic SQL later; wrapping all five adds risk for no gain).
- **Owner decisions.** O-8 is correctly left open and not prejudged; no exception
  is claimed.
- **Rollback** is specific: revert; history ids, snapshot and designers unchanged.

Round 1 verdict: CHANGES NEEDED (one Major, five Minors).

## Round 2

Reviewer: plan-reviewer, 1 November 2026. Reviewed `plan.md` round 2 against the
round 1 findings, using its revision log (section 12) and the changed sections 3.2,
5.2, 5.3, 5.4, 5.5, 10 and 11. The scratch catalog was `GAP06R_Canary`. It was
created and dropped twice, and afterwards
`SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06R%'` returned `0`.

### Round 1 findings, rechecked

1. **Major, canary: resolved.** Section 3.2 step 2 now gives the fixture as two
   batches (`CREATE TABLE … GO`, then `BEGIN TRANSACTION; ALTER … ADD; UPDATE;
   COMMIT; GO`). "Rejected" now needs a non-zero exit **and** `Msg 207` with
   `Invalid column name 'new_col'`. Any other failure counts as "cannot run". I
   applied the exact fixture text from the plan to an empty `GAP06R_Canary`:

   ```
   == -I -b
   Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 4
   Invalid column name 'new_col'.
   exit=1
   == -I
   Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 4
   Invalid column name 'new_col'.
   exit=0
   ```

   This matches the plan. The fixture is rejected for the right reason, and without
   `-b` it exits 0, so the self-test in 5.1 does catch a runner that loses `-b`.
2. **Minor, `--no-connect`: resolved.** The exact command now has `--no-connect
   … 2>/dev/null`, and a parse failure counts as "cannot run". In round 1 I
   verified that this form parses, and that `.[-2].id` is
   `20261019104504_AddRefreshTokenSessionStart`.
3. **Minor, blocking date: resolved.** The rule is stated once: merge date plus 7,
   set at the last rebase, checked at gate 2, and moved by the integrator if the
   merge slips. The `ci.yml` snippet and 5.4 agree with it, and so does standard
   section 3 ("seven days from its merge").
4. **Minor, Studio copy: resolved.** Section 5.5 gives owner-run steps that write
   only to `GAP06_StudioCopy`: a `COPY_ONLY` backup, a restore under a new name,
   history and schema before and after, the script twice with `-I -b`, a compare,
   and a drop. The expected results are stated. 5.3 #11 and the coverage row say
   "NOT RUN, pending owner". `$schema` is a placeholder for the 2.3 D query that
   `implementation.md` will hold. That is acceptable, as long as
   `implementation.md` gives the query in full.
5. **Minor, who confirms: resolved.** 5.2 step 3 limits the developer to throwaway
   catalogs, after showing the diff and the generated SQL in `implementation.md`. It
   puts the owner's confirmation at the existing stop after step 6, relayed by the
   coordinator, and says that a tech-lead approval is not that confirmation. Real
   catalogs are only ever migrated by the owner. This meets `AGENTS.md` ("Show every
   migration before applying it") and `docs/changes/README.md`.
6. **Minor, N-1 versus base: resolved.** Step 4(b) adds BASE (the newest migration
   on `${{ github.base_ref || 'rebuild/dotnet-platform' }}`), with a skip logged when
   BASE equals the head, and a failure when BASE is missing from the head's list.
   Step 6 includes `…Base` when it runs. I checked the extraction:
   `git ls-tree --name-only FETCH_HEAD api/src/DigitalHub.Api/Data/Migrations/ |
   grep -v -e Designer -e Snapshot | tail -1` →
   `…/20261020113912_AddApplicationCounts.cs`, as the plan says. On a `push` to
   `rebuild/dotnet-platform`, `base_ref` is empty, the fallback is the head itself,
   and BASE equals latest, so the run is skipped and logged. That is correct.

### New findings

**1. Minor: section 3.2 step 1, `git fetch --depth=1` makes a full local clone
shallow.** In CI, `actions/checkout@v4` already makes a depth-1 clone, so this is
harmless there. Locally, though, the plan has the developer run `run.sh` (5.1 and
5.3 #1) in a worktree of a full clone. There, `git fetch --no-tags --depth=1 origin
rebuild/dotnet-platform` writes `.git/shallow`. That file is shared by every
worktree (`/home/user/DH-WEBSITE/.git`) and cuts their history off at the fetched
commit. I hit this while checking the plan's own command. Afterwards
`git rev-parse --is-shallow-repository` printed `true`, and `.git/shallow` held
`6470fac…`. I restored the repository by moving that one file aside: all objects
were still present, `rev-parse --is-shallow-repository` now prints `false`,
`git rev-list --count origin/rebuild/dotnet-platform` gives `87`, and
`git fsck --connectivity-only` is clean. The moved file is kept in the session
scratchpad as `shallow.bak`. To satisfy: in `run.sh`, pass `--depth=1` only when
`git rev-parse --is-shallow-repository` prints `true`, or read
`origin/$BASE_REF` when it already exists locally. The developer should quote
`git rev-parse --is-shallow-repository` → `false` after the local runs in 5.1 and
5.3 #1. This is a Minor, which the tech lead can make a condition at gate 1. It
does not block the plan.

### Checked and found sound (round 2)

- The `ci.yml` change is still one added step after line 90, now with two `env`
  entries (`MIGRATION_CHECKS_BLOCKING_FROM`, `BASE_REF`). It does not overlap
  PR #38's `runs-on` and header lines. No `uses:`, `image:` or version line is
  added.
- The Wave 1–3 checklist (5.4) is met: one gate, a seven-day report week from
  merge, a committed canary that is verified to be rejected and that guards `-b`,
  pinning correctly left to GAP-09/GAP-10, and no baseline.
- Risks (section 10) now cover a canary rejected for the wrong reason and the
  upgrade path for a pull request with several migrations. Rollback is unchanged and
  still correct.
- Nothing from round 1's sound list has regressed: the migration design (3.1, 7),
  the test plan, security, and owner decisions (O-8 still open, no exception
  claimed) are unchanged apart from the answers above.

Verdict: APPROVED
