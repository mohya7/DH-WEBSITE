# Test report: GAP-06

Tester (senior tester and security engineer), pipeline step 5.

## Round 1

- **Commit tested:** `f77c4b0` ("GAP-06: Record the implementation results"), branch
  `change/GAP-06`, on a detached checkout at `/home/user/wt-GAP-06-test`
  (`git -C /home/user/wt-GAP-06 worktree add --detach /home/user/wt-GAP-06-test f77c4b0`),
  removed at the end (`git worktree remove`, exit 0). Red commit `0f6fd6f`, fix `8b41c00`.
  Base `6470fac` (= `origin/rebuild/dotnet-platform`, and the merge base).
- **Read first:** `docs/changes/README.md`, `ENVIRONMENT.md` and `.claude/agents/tester.md`
  (session reference copies), `plan.md` round 2, `plan-review.md`, `plan-approval.md`
  (8 conditions), `implementation.md` ("Status: READY FOR TEST").
- **Track:** G1, Waves 1 to 3 (gates and API).
- **Shared repository:** `git rev-parse --is-shallow-repository` → `false` at the start
  (16:17 UTC), before and after every `run.sh` run, and `false` after the worktree was
  removed. I never ran `git fetch` in the shared repository. The CI fetch path was tested
  only in an isolated scratch clone with its own `.git` (check 9).
- **Databases:** only `GAP06T_`-prefixed scratch catalogs on `dh-mssql`, all dropped:
  `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06T%'` → `0` at the end;
  `sys.databases` lists only `DigitalHubContent_Test`, `master`, `model`, `msdb`, `tempdb`.
  The container's `/tmp` is empty (`docker exec dh-mssql ls -A /tmp` → nothing).
  `DigitalHubContent_Test` was used only for the integration tests (check 8), not migrated,
  dropped or recreated. `DigitalHubContent` was never touched.

All `run.sh` runs: from `api/`, `SA_PASSWORD=<ci value> MIGRATION_CHECK_DB_PREFIX=GAP06T_`,
container `dh-mssql`. Logs are in the tester's scratch folder.

### 1. The red test was red (`0f6fd6f`), and green at the head

`git checkout --detach 0f6fd6f`; `dotnet tool restore` → "Restore was successful.";
`dotnet build DigitalHub.slnx -c Release` → `13 Warning(s)`, `0 Error(s)`.

`MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 tools/migration-checks/run.sh dh-mssql` → **exit 1**:

```
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
Msg 207, Level 16, State 1, Server 42701ab3ab3a, Line 61
Invalid column name 'link_kind'.
...
::error::Migration check failed: 3. Script run 1, empty catalog: exit 1, history 6 of 15
::error::Migration check failed: 3. Script run 2, empty catalog: exit 1, history 6 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
::error::Migration check failed: 6. Same schema: not reached: only 2 of 3 catalogs were migrated
== Result: 3 failure(s); blocking from 2000-01-01; blocking mode.
```

It fails for the reason the plan gives (plan 2.3 A: `Msg 207 … 'link_kind'`, 6 of 15).
The step summary file showed the same table (3 **FAIL** rows). Report mode
(`…BLOCKING_FROM=2099-01-01`) → **exit 0** with the same three failures as `::warning::`
lines: report mode reports and does not hide.

**Developer note "step 4a passes on unfixed code" — judged acceptable.** N-1 already has
`link_kind`, so migration 7's batch compiles there. The gate as a whole still catches the
defect: step 3 fails both runs, and step 6 fails as "not reached", so the run exits 1 in
blocking mode.

Head `f77c4b0` (rebuilt: `13 Warning(s)`, `0 Error(s)`), `…BLOCKING_FROM=2000-01-01` →
**exit 0**, 46 s:

```
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
PASS  6. Same schema: 3 catalogs (GAP06T_Script GAP06T_Previous GAP06T_Ef), 468 lines each, identical
== Result: 0 failure(s); blocking from 2000-01-01; blocking mode.
```

With the committed date (`MIGRATION_CHECKS_BLOCKING_FROM=2026-11-12`): "report mode",
`0 failure(s)`, exit 0.

### 2. Test plan 5.3

| # | Command (as run) | Exit | Result |
|---|---|---|---|
| 1 | `run.sh dh-mssql` with `…BLOCKING_FROM=2000-01-01` | 0 | **Pass.** Output above. |
| 1b | Extra: same, with `BASE_REF=phase-c/section-5` (newest migration there `20261011101107_AddSiteSettingsCareersEmail`, so 4b applies 8 to 15, including migration 14). The developer used a different base. | 0 | **Pass.** `PASS 4b. Base schema, script: from 20261011101107_AddSiteSettingsCareersEmail: exit 0, history 15 of 15`; `PASS 6. Same schema: 4 catalogs (GAP06T_Script GAP06T_Previous GAP06T_Base GAP06T_Ef), 468 lines each, identical`. |
| 2 | `dotnet tool run dotnet-ef -- migrations has-pending-model-changes --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj` | 0 | **Pass.** "No changes have been made to the model since the last migration." |
| 3 | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` | 0 | **Pass.** `ci.yml`, the two migration `.cs` files, `canary-add-column-then-sql.sql`, `run.sh`, and `docs/changes/GAP-06/{implementation,plan-approval,plan-review,plan}.md`. No `*.Designer.cs` and no snapshot. `run.sh` is mode `100755` in the index. |
| 4 | Data equivalence from migration 6, using the developer's seed and data query (taken from `implementation.md` 5.5). Four catalogs `GAP06T_PrevEf/PrevScript/Guard/GuardEf` were brought to `20260922135931_AddMustChangePassword` with `dotnet-ef database update` (each exit 0) and seeded (exit 0). `PrevEf` was then taken to latest with `database update`, and `PrevScript` got the head's idempotent script twice with `sqlcmd -C -I -b -i` after `docker cp`. | 0 / 0 / 0 | **Pass.** `script run 1 … exit=0`, `run 2 … exit=0`; `DATA IDENTICAL` (`diff` of the data query output). Rows: `Group\|NULL\|group\|…`, `Home\|NULL\|internal\|page\|1111…0001`, `About\|…\|page\|1111…0002`, `Web\|…\|service\|2222…0001`; tokens `a\|2026-10-01T10:00:00`, `b\|2026-10-01T10:00:00`, `c\|2026-10-03T10:00:00`; `history 15`. |
| 5 | Guard: one `/services/missing` row, then the script (`-I -b`), and separately `dotnet-ef database update` | 1 / 1 | **Pass.** Script: `Msg 50002 … Navigation link conversion left a row with no valid shape.`, `exit=1`. EF: `SqlException … Error Number:50002`, `exit=1`. Both catalogs: `history 6`, `link_kind absent`. |
| 6 | `dotnet build DigitalHub.slnx -c Release` | 0 | **Pass.** `13 Warning(s)`, `0 Error(s)`, which is not above the baseline of 13. |
| 7 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`, with the `ci.yml` connection strings | 0 | **Pass.** Immediately before (16:37:51 UTC), `sys.dm_exec_sessions` other sessions on `DigitalHubContent_Test` → `0`, and no `dotnet test` process was running; the catalog was at 15/15 (`20261020113912_AddApplicationCounts`). Result: `Passed!  - Failed: 0, Passed: 475, Skipped: 0, Total: 475, Duration: 1 m 58 s`. |
| 8 | `bash -n api/tools/migration-checks/run.sh`; `shellcheck api/tools/migration-checks/run.sh` (pinned 0.11.0, see below) | 0 / **1** | **Fail.** `bash -n` exit 0. shellcheck exit 1 with **3 findings**, where the plan expects 0. See finding 1. |
| 9 | CI on the PR | — | **NOT RUN.** Nothing is pushed without the owner's OK. Covered by CI job `api`, step "Migration checks — idempotent script twice, previous schema". At gate 2 the PR run must show 0 failures, because before 2026-11-12 failures only warn. |
| 10 | `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06T%'` | 0 | **Pass.** `0`. |
| 11 | Studio-copy test (plan 5.5) | — | **NOT RUN, pending owner.** There is no copy of `DigitalHubContent_Studio` on this server; the owner runs plan 5.5. |

**shellcheck install (check 8).** I used GAP-08's checksum-verifying installer into a
scratch folder: `RUNNER_TEMP=<scratch>/gap06t-lint ACTIONLINT_VERSION=1.7.12
ACTIONLINT_SHA256=8aca8db9…a3d8 SHELLCHECK_VERSION=0.11.0
SHELLCHECK_SHA256=8c3be12b…7198 sh /home/user/wt-GAP-08/.github/lint/install-actionlint.sh`
(the values come from GAP-08's `workflow-lint.yml`) → exit 0:

```
…/actionlint_1.7.12_linux_amd64.tar.gz: OK
…/shellcheck-v0.11.0.linux.x86_64.tar.xz: OK
ShellCheck - shell script analysis tool
version: 0.11.0
```

Also `actionlint -shellcheck=<scratch>/shellcheck .github/workflows/ci.yml` → exit 0, no
findings, so the new `ci.yml` step passes GAP-08's gate (approval condition 7). GAP-08
lints workflows only, not `run.sh`.

**Generated SQL (extra check of plan 5.2).** I generated the full idempotent script at
`0f6fd6f` (old) and at `f77c4b0` (new). I unescaped every `EXEC(N'…')` body (`''` → `'`)
in both and compared them. Differences: migration 7 and migration 14 only (16 → 18 `EXEC`
regions). The only remaining difference is one whitespace-only line (the empty first line
of the `SessionStartSql` verbatim string is now indented by four spaces). So the SQL text
is unchanged.

### 3. Track checklist (G1, Waves 1 to 3)

| Item | Verified |
|---|---|
| One gate per PR (B-8) | Yes. One new step in the `api` job; the two migration edits are what the gate needs to pass. |
| New gate reports for seven days via `*_BLOCKING_FROM`, then blocks | Yes. `MIGRATION_CHECKS_BLOCKING_FROM: "2026-11-12"`. Blocking date → exit 1 on red; report date → exit 0 with `::warning::`. The date is validated, but any future date is accepted (finding 3). The existing "Apply migrations…" step is unchanged and still blocks. |
| Committed canary it must reject (GAP-21) | Yes. Rejected on every run (exit 1, `Msg 207 … 'new_col'`). A mutant without `-b` exits 1 even in report mode (check 4). |
| Actions by SHA, SQL image by digest, Node/.NET exact | Not met on the base and out of scope (GAP-09/GAP-10/PR #38). The diff adds no `uses:`, `image:` or version line (verified). |
| Baselines only shrink | No baseline file. The metric goes from 6/15 to 15/15 (checks 1 and 2). |

### 4. Security and trying to make the gate pass silently

Mutants were copies of `run.sh` and the canary in the tester's scratch folder. The
checked-out source was never edited (`git status --short` in the test worktree: empty).

| Attempt | Exit | Result |
|---|---|---|
| `-b` removed from `apply_script`, report mode | 1 | `::error::Migration checks are broken: the canary was not rejected (exit 0).` Caught. |
| `-I` removed from `apply_script` | 1 blocking / 0 report | The canary is still rejected. Step 3 fails both runs with `Msg 1934` (history 0 of 15), 4a fails (14 of 15), and 6 is not reached. Loud, not silent: `::error::` when blocking, `::warning::` in report mode. The canary does not guard `-I`; step 3 does. |
| sqlcmd missing (`SQLCMD=/opt/mssql-tools/bin/sqlcmd`) | 1 | `cannot run: could not create catalog GAP06T_Canary`. Fails safe, but the cause is not printed (finding 2). |
| Container does not exist | 1 | `cannot run: cannot create /tmp/GAP06T_migration-checks-<pid> in container nosuch-container`. |
| `docker cp` fails (shim) | 1 | `cannot run: docker cp of idempotent.sql failed`. |
| History count off by one (`n=n+1`) | 1 blocking / 0 report | Steps 3, 4a and 5 fail with "history 15 of 16"; 6 is not reached. |
| Schema drift: a default constraint dropped in `…Ef` before step 6 | 1 | `-DEF\|AspNetUsers\|MustChangePassword\|(CONVERT([bit],(0)))`; `6. Same schema: GAP06T_Ef differs from GAP06T_Script`. |
| EF failure (connection to port 1) | 0 report | 4a and 5 fail as `::warning::`; no password in the output. |
| Wrong `SA_PASSWORD` (with `$` and `"`) | 1 | `Login failed for user 'sa'` → `cannot run: could not create catalog`. The password appears in neither the log nor the step summary (`grep -c` → 0). |
| Dates `''`, `2026-11-1`, `20261112`, `' 2026-11-12'`, `'2026-11-12 '`, `2026-11-12\n`, `2026-13-01`, `2026-02-29`, `2026-11-12;rm`, `tomorrow`, `0000-00-00` | 1 each | `cannot run: MIGRATION_CHECKS_BLOCKING_FROM must be a real date`. `2028-02-29` (a leap day) is accepted. **`9999-12-31` is accepted (exit 0, report mode forever): finding 3.** |
| Prefix `DigitalHubContent`, `DigitalHubContent_`, `digitalhubcontent_test`, `DIGITALHUBCONTENT_E2E`, `DigitalHubContent_Test` | 1 each | `may not start with DigitalHubContent`. |
| Prefix `GAP06T_];DROP DATABASE x;--`, `GAP06T-`, `_GAP06T`, `1GAP`, `'GAP06T_ '` | 1 each | `must be letters, digits and _`. |
| `BASE_REF` `../x`, `-x`, `a b`, `main;rm -rf /`, `$(id)` | 1 each | `BASE_REF is not a branch name`. `origin/x` → `origin/origin/x is not available locally`. |
| No container argument; `SA_PASSWORD` empty; run from the repository root | 1 each | Usage / `SA_PASSWORD is not set` / `run it from the api/ folder`. |
| SIGINT and SIGTERM during step 5 | — | The `trap` ran: no `GAP06T` catalog and no container `/tmp` folder left. |
| CI fetch path (`--is-shallow-repository` = `true`), in an isolated scratch clone (`git clone --depth=1` from a scratch bare repository; never the shared `.git`), running `run.sh` lines 200–214 | 0 / 1 | `base (rebuild/dotnet-platform) newest migration: 20261020113912_AddApplicationCounts`; `BASE_REF=no/such` → `cannot_run: git fetch of no/such failed`. The shared repository stayed `false`. |

**Password.** `grep -l 'CiOnlySa2026Passw0rd'` over all 23 logs and step-summary files of
this round → 0 files. `redact` was tested on its own with the passwords
`CiOnlySa2026Passw0rd`, `a*b?[c]`, `x/y\z` and `$(id)`: every one becomes `***`. There is no
`set -x`. The password does appear in the `dotnet-ef --connection` argument (visible to
`ps` on the runner), as in the existing `ci.yml` step; this is not new.

**Audits.** `run-dotnet-audit.sh` (from `api/`) → `dotnet: 0 finding(s) at the gate's level`,
exit 0. `npm audit --audit-level=high` (full tree): website exit 1, "8 vulnerabilities (3
moderate, 4 high, 1 critical)"; studio exit 1, "5 vulnerabilities (2 moderate, 3 high)".
`run-npm-audit.sh website` exit 1 ("3 known, 3 new"); `run-npm-audit.sh studio` exit 0.
These already exist on the base: `git diff --quiet 6470fac f77c4b0 -- website studio` →
unchanged. They belong to Wave 0 (GAP-01 to GAP-03), not to this change. Semgrep and
gitleaks: **NOT RUN**, not installed; covered by the `security.yml` jobs (semgrep, gitleaks).
No secret in the diff: the only credential is the existing workflow-only `SA_PASSWORD`.
Routes, roles and logins: none changed.

### 5. The developer's notes

- **`SQLCMDPASSWORD` instead of `-P`:** accepted. It is stricter (the password is not on
  the `docker exec` command line). It worked in every run, and condition 8 is met.
- **`docker cp` into a per-run folder:** accepted. Files are chmod 0644 and the folder is
  removed on exit and on signals (verified). The folder name is predictable, but it is
  inside the throwaway container.
- **Default-constraint names left out of the schema comparison:** accepted. EF creates
  unnamed defaults, so SQL Server generates different names per catalog. The `DEF`
  definitions are still compared, and the drift mutant proves that a missing default is
  caught.
- **Step 4a passes on unfixed code:** accepted. The gate as a whole fails (section 1).
- **UTF-8 BOM in the generated script:** confirmed (`ef bb bf`). The canary has no BOM.
  `run.sh` and the owner's plan 5.5 both use `-i <file>`, which handles it. Only stdin
  fails, so this does not affect the gate.

### Findings (most severe first)

1. **Minor, but planned check 5.3 #8 fails: shellcheck reports 3 findings on `run.sh`; the plan expects 0.**
   Steps: install shellcheck 0.11.0 with the checksum (above), then
   `shellcheck api/tools/migration-checks/run.sh`. Expected: exit 0, 0 findings.
   Actual: exit 1:
   - line 32: `readonly SCRIPT_DIR="$(cd … && pwd)"`, **SC2155 (warning)**, declare and
     assign separately to avoid masking return values;
   - line 111: `cleanup() {`, SC2329 (info), "never invoked" (a false positive: it is
     the `trap`);
   - line 191: `[[ … ]] && (( n >= 2 )) || cannot_run …`, SC2015 (info).

   None of them changes behaviour today. If the `cd` fails, `SCRIPT_DIR` is empty and the
   "canary fixture is missing" check fails the run. Still, the plan's expected result is
   0 findings, and the developer marked the check NOT RUN only because shellcheck was
   absent. The fix belongs to the developer: for example, assign `SCRIPT_DIR` and then
   mark it `readonly`, and use an `if` for line 191; for SC2329, restructure, or add a
   justified directive the reviewer accepts.
2. **Minor: when `docker exec` itself fails, "cannot run" hides the cause.** Steps: run
   with the sqlcmd path wrong (mutant `no_sqlcmd`). Expected: the log shows why (for
   example the OCI "no such file or directory" message). Actual: only
   `::error::Migration checks cannot run: could not create catalog GAP06T_Canary` and a
   misleading `::warning::Could not drop scratch catalog GAP06T_Canary`, because
   `errors_of` keeps only `Msg …` and `Sqlcmd: Error` lines. It fails safe; only the
   diagnosis is lost.
3. **Minor: any future `MIGRATION_CHECKS_BLOCKING_FROM` is accepted, so the gate can stay
   in report mode forever.** Steps: `MIGRATION_CHECKS_BLOCKING_FROM=9999-12-31 run.sh
   dh-mssql`. Expected: refused as "cannot run" beyond a ceiling (GAP-08's lint gate
   refuses "a missing or malformed blocking date or one after 2026-11-23"). Actual:
   exit 0, report mode. Today only the gate 2 and integrator review of the date prevent
   this (plan 3.2).
4. **Minor: `create_catalog` silently drops an existing catalog with the same name.**
   Steps: read `run.sh` line 125 (`IF DB_ID(N'$db') IS NOT NULL … DROP DATABASE`). On
   the shared `dh-mssql`, two runs with the same prefix (the default is
   `MigrationCheck_`) drop each other's catalogs mid-run, and the `trap` of each drops
   the other's. Expected: refuse ("catalog already exists") or warn. Actual: dropped
   without a message. This happens only locally; CI has its own container, and
   `DigitalHubContent*` is refused.

Observations (not findings): the schema listing covers tables only (no views, triggers,
procedures, sequences, computed-column definitions or schema names), and no migration
creates any of these today. Before 2026-11-12 every failure of steps 3 to 6 only warns,
so gate 2 must read the PR run's log for "0 failure(s)".

### Coverage rows verified

| Item | Status | Evidence |
|---|---|---|
| Idempotent script twice on an empty catalog, both exit 0 | Verified locally; CI NOT RUN (not pushed) | Section 1, head run: step 3 runs 1 and 2, 15 of 15. |
| Upgrade from the previous schema, script and `database update` routes | Verified locally | 4a and step 5 exit 0, 15 of 15. |
| Each migration change shown before it is applied | Verified as recorded | `b92d325` (diff, generated SQL) comes after `8b41c00` and before `a77ae2e`; independent SQL comparison in section 2. The owner's confirmation is still due after gate 2. |
| `NavigationLinkRefs` applies through the script | Verified | Red: `Msg 207 'link_kind'`, 6 of 15 → green: 15 of 15. |
| `AddRefreshTokenSessionStart` applies through the script | Verified | 15 of 15; `SessionStartedAt` data identical (check 4); 4b from migration 13 → 15 of 15. |
| 15 of 15 apply | Verified | Section 1. |
| The edits do not change what the SQL does | Verified | Unescaped `EXEC` bodies equal the old SQL (whitespace only); 468 schema lines identical; data identical; the 50002 guard rolls back on both routes. |
| Studio-copy test | NOT RUN, pending owner | No copy on this server. |
| Step 4b from the base branch's schema | Verified | `BASE_REF=phase-c/section-5`: 4b exit 0, 4 catalogs identical. CI shallow fetch path checked in an isolated clone. |
| No model or snapshot change | Verified | Checks 2 and 3. |
| Reports until `…BLOCKING_FROM`, then blocks | Verified (finding 3) | Red: blocking exit 1 / report exit 0. |
| Canary rejected on every run and guards `-b` | Verified | Every run; `no_b` mutant → exit 1 in report mode. |
| Scratch catalogs only; none left behind | Verified | `GAP06T%` count `0`; container `/tmp` empty; also after SIGINT/SIGTERM. |

Round 1 result: CHANGES NEEDED (planned check 5.3 #8 failed; findings 1 to 4).

## Round 2

- **Commit tested:** `57c7f78` ("GAP-06: Record rework round 1"), fix `d8e2748`. Fresh
  detached checkout: `git -C /home/user/wt-GAP-06 worktree add --detach
  /home/user/wt-GAP-06-test 57c7f78`, removed at the end (`git worktree remove`, exit 0).
- **What changed since round 1:** `git diff --name-only f77c4b0 57c7f78` →
  `api/tools/migration-checks/run.sh` and `docs/changes/GAP-06/implementation.md` only.
  `run.sh` is still mode `100755`. No migration, no `ci.yml` and no build input changed.
- **Build:** `dotnet tool restore` → "Restore was successful."; `dotnet build
  DigitalHub.slnx -c Release` → `13 Warning(s)`, `0 Error(s)`.
- **Shared repository:** `git rev-parse --is-shallow-repository` → `false` before and
  after every run and after the worktree was removed. No `git fetch` was run.
- **Databases:** `GAP06T_` catalogs only. At the end, `SELECT COUNT(*) FROM sys.databases
  WHERE name LIKE 'GAP06T%'` → `0`; `sys.databases` lists `DigitalHubContent_Test`,
  `master`, `model`, `msdb`, `tempdb`; the container's `/tmp` is empty.
  `DigitalHubContent_Test` was not used in this round (see R7).

### R1. shellcheck (round 1 finding 1)

The same pinned binary as round 1. GAP-08's installer verified the archive's checksum
(`shellcheck-v0.11.0.linux.x86_64.tar.xz: OK`); its sha256 starts `8c3be12b05d5c177`, and
`--version` prints `version: 0.11.0`.

| Command | Exit | Output |
|---|---|---|
| `shellcheck api/tools/migration-checks/run.sh` | 0 | none: **0 findings** |
| `bash -n api/tools/migration-checks/run.sh` | 0 | none |
| `actionlint -shellcheck=<scratch>/shellcheck .github/workflows/ci.yml` | 0 | none |
| `env \| grep -c SHELLCHECK_OPTS` | — | `0` (nothing was excluded from outside) |

**The SC2329 directive is judged acceptable.**

- It is the only `shellcheck disable` in the file (`grep -c` → 1), placed on the
  `cleanup` function alone, with its reason given.
- The false positive reproduces: `cleanup() { echo bye; }` / `trap cleanup EXIT` /
  `echo hi` / `exit 0` → shellcheck exit 1 (SC2329). The same script without `exit 0`
  → exit 0.
- With the directive removed (scratch copy), the only finding is SC2329 on `cleanup`
  (exit 1), so the directive hides nothing else.
- `cleanup` really runs, as the trap: the SIGINT tests in R6 show catalogs dropped.

SC2155 and SC2015 are fixed in code, not suppressed: `SCRIPT_DIR=…` then
`readonly SCRIPT_DIR`, and an `if` for the migration-count check.

### R2. The cause is printed when `docker exec` fails (round 1 finding 2)

Mutant (a scratch copy of the head's `run.sh` with `SQLCMD="/opt/mssql-tools/bin/sqlcmd"`),
`…BLOCKING_FROM=2026-11-12` → **exit 1**:

```
== 2. Canary: add a column and use it in one batch
OCI runtime exec failed: exec failed: unable to start container process: exec: "/opt/mssql-tools/bin/sqlcmd": stat /opt/mssql-tools/bin/sqlcmd: no such file or directory
::error::Migration checks cannot run: could not create catalog GAP06T_Canary
```

The cause is shown, and the misleading "Could not drop" warning is gone. The fallback
still goes through `redact`.

### R3. Blocking-date cap 2026-11-23 (round 1 finding 3)

| `MIGRATION_CHECKS_BLOCKING_FROM` | Exit | Output |
|---|---|---|
| `2026-11-24` | 1 | `::error::Migration checks cannot run: MIGRATION_CHECKS_BLOCKING_FROM 2026-11-24 is after 2026-11-23, Wave 1's last blocking day` |
| `2026-12-01` | 1 | the same message, for 2026-12-01 |
| `2027-01-01` | 1 | the same message, for 2027-01-01 |
| `9999-12-31` | 1 | the same message, for 9999-12-31 |
| `2026-11-12` (committed) | 0 | `blocking from 2026-11-12 (today 2026-11-01: report mode)`, `0 failure(s)` |

The comparison is a string comparison, which is safe because it runs only after the
`YYYY-MM-DD` and real-date checks. After 2026-11-23 the cap does not start failing
CI: any accepted date is then in the past, so the gate simply blocks.

The cap is a hard-coded date in `run.sh`. If the merge slips past 16 November, the
integrator must move both `MIGRATION_CHECKS_BLOCKING_FROM` in `ci.yml` and
`LATEST_BLOCKING_FROM` in `run.sh` (implementation.md section 10 says so). Gate 2 should
check both.

### R4. Existing catalogs are never dropped (round 1 finding 4)

For each test, the catalog was created by hand first, with a table `someone_elses_work`
holding 1 row:

| Pre-existing catalog | Exit | Output | After |
|---|---|---|---|
| `GAP06T_Canary` | 1 | `Msg 1801 … Database 'GAP06T_Canary' already exists.` → `::error::Migration checks cannot run: catalog GAP06T_Canary already exists. Another run may be using the prefix GAP06T_, or a killed run left it: drop it by hand, or set another MIGRATION_CHECK_DB_PREFIX` | only `GAP06T_Canary` left; its row count is `1` |
| `GAP06T_Ef` (hit mid-run, at step 5) | 1 | steps 2 to 4a ran (`PASS 4a …`), then `Msg 1801 … 'GAP06T_Ef' already exists` and the same "cannot run" | only `GAP06T_Ef` left, row count `1`. The run's own Canary, Script and Previous catalogs were dropped. |

**A race between two runs with the same prefix.** Run A was started
(`…BLOCKING_FROM=2000-01-01`). Once A reached step 3, run B started with the same
prefix. Result: B exit 1, `catalog GAP06T_Canary already exists …`. A exit 0, every
check PASS, `6. Same schema … 468 lines each, identical`. B did not disturb A, and
nothing was left afterwards (`GAP06T%` count `0`).

### R5. Regression: the full gate in blocking mode

`MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 GITHUB_STEP_SUMMARY=<scratch> run.sh dh-mssql`
→ **exit 0**:

```
Migration checks: catalog prefix GAP06T_, base rebuild/dotnet-platform, blocking from 2000-01-01 (today 2026-11-01: blocking mode).
N=15, latest=20261020113912_AddApplicationCounts, previous=20261019104504_AddRefreshTokenSessionStart
base (rebuild/dotnet-platform) newest migration: 20261020113912_AddApplicationCounts
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
PASS  6. Same schema: 3 catalogs (GAP06T_Script GAP06T_Previous GAP06T_Ef), 468 lines each, identical
== Result: 0 failure(s); blocking from 2000-01-01; blocking mode.
```

- **Older base:** with `BASE_REF=phase-c/section-5` → exit 0;
  `PASS 4b. Base schema, script: from 20261011101107_AddSiteSettingsCareersEmail: exit 0,
  history 15 of 15`; `PASS 6. Same schema: 4 catalogs …, 468 lines each, identical`.
- **The new `run.sh` still catches the defect.** I copied the head's `run.sh` and canary
  to a scratch folder, checked out `0f6fd6f` in the test worktree (unfixed migrations)
  and built it (`0 Error(s)`), then ran the copy with `…BLOCKING_FROM=2000-01-01` →
  **exit 1**: `3. Script run 1 … exit 1, history 6 of 15`, the same for run 2, and
  `6. Same schema: not reached`, giving `Migration checks: 3 failure(s).` The worktree
  was then put back on `57c7f78` and rebuilt (`13 Warning(s)`, `0 Error(s)`).
- **The canary still guards `-b`:** a mutant without `-b` → exit 1, `::error::Migration
  checks are broken: the canary was not rejected (exit 0).`
- **Password:** `grep -l CiOnlySa2026Passw0rd` over the 12 logs and summaries of this
  round → 0 files.

### R6. Interrupt during clean-up (beyond the plan)

SIGINT to `run.sh` (exit 130) while it was creating a catalog:

| Interrupted just after | Left behind |
|---|---|
| `== 3` | `GAP06T_Script` (0 tables) |
| `== 4a` | `GAP06T_Previous` (0 tables) |

Every catalog created before the interrupted one was dropped by the `trap`. Each
leftover was dropped by hand; the count is `0`. This is finding R2-1 below.

### R7. Checks not re-run in this round

- 5.3 #2 to #7 (model check, file list, data, guard, build, integration tests): not
  re-run. No migration, application, test or `ci.yml` file changed since `f77c4b0`
  (`git diff --name-only f77c4b0 57c7f78`, quoted above), and round 1 passed them. The
  Release build at `57c7f78` was re-run: `13 Warning(s)`, `0 Error(s)`.
  `DigitalHubContent_Test` was therefore not used.
- 5.3 #9 CI on the PR: **NOT RUN**, not pushed; covered by CI job `api`.
- 5.3 #11 Studio copy: **NOT RUN, pending owner.**
- Semgrep and gitleaks: **NOT RUN**, not installed; covered by the `security.yml` jobs.
  The npm and dotnet audits do not change, because no lockfile or package changed.

### Round 1 findings, rechecked

| Round 1 finding | Status |
|---|---|
| 1. shellcheck 3 findings (planned check 5.3 #8) | **Fixed.** 0 findings; the SC2329 directive is justified and narrow (R1). |
| 2. Cause hidden when `docker exec` fails | **Fixed** (R2). |
| 3. Any future blocking date accepted | **Fixed.** Capped at 2026-11-23 (R3). |
| 4. Existing catalog silently dropped | **Fixed.** Refused with Msg 1801 and the reason; other runs' catalogs survive (R4). |

### Findings (round 2)

1. **Minor (R2-1): an interrupt during `CREATE DATABASE` leaves that one catalog behind.**
   The rework now adds a catalog to `created_catalogs` only after `CREATE DATABASE`
   returns. A SIGINT or SIGTERM (Ctrl-C locally, or a cancelled run) that arrives while
   `sql master "CREATE DATABASE …"` is running therefore leaves the new, empty catalog
   behind.
   - Steps: `MIGRATION_CHECK_DB_PREFIX=GAP06T_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01
     run.sh dh-mssql`, and send SIGINT as soon as `== 4a` is printed.
   - Expected: no `GAP06T_` catalog left.
   - Actual: `GAP06T_Previous` is left (0 tables). It reproduced twice, also with
     `GAP06T_Script` after `== 3`.
   - Effect: the next local run with that prefix stops with the clear "already exists …
     drop it by hand" message. It fails safe, and nothing that belongs to someone else is
     lost. CI is not affected (fresh container per job).
   - Possible fix, for the developer: add the name before `CREATE DATABASE` and remove
     it again when the create fails with Msg 1801.

No Blocker or Major. Every planned check that was run passes; the ones not run are
listed in R7 with their reason and covering job.

### Coverage rows verified in round 2

| Item | Status | Evidence |
|---|---|---|
| Script lint, 5.3 #8 | Verified: Pass | R1, 0 findings. |
| The gate reports until `…BLOCKING_FROM`, then blocks; the report week cannot be stretched | Verified | R3, plus the committed date in report mode. |
| The canary is rejected on every run and guards `-b` | Verified | R5. |
| Idempotent script twice, previous schema, base schema, same schema | Verified (regression) | R5. |
| Scratch catalogs only; a run never drops a catalog it did not create | Verified, with finding R2-1 (leak on interrupt) | R4, R6; `GAP06T%` count `0` at the end. |
| Studio-copy test | NOT RUN, pending owner | No copy on this server. |

Verdict: APPROVED
