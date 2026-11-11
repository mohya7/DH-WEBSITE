# Delivery approval: GAP-06 (gate 2)

Tech lead, gate 2, 1 November 2026. Branch `change/GAP-06`, head `57c7f78`
("GAP-06: Record rework round 1"), base `origin/rebuild/dotnet-platform` at
`6470fac3668aeeacabe4a47c39807d239ac33a09` (also the merge base; the base has not
moved since gate 1). Read: `plan.md` round 2, `plan-review.md` (rounds 1 and 2,
`Verdict: APPROVED`), `plan-approval.md` (gate 1, eight conditions),
`implementation.md` (including rework round 1, "Status: READY FOR TEST") and
`test-report.md` (round 1 CHANGES NEEDED; round 2 `Verdict: APPROVED`, one Minor
R2-1). Governing files were read from the session's read-only reference copies:
`.claude/agents/tech-lead.md`, `docs/changes/README.md`, `ENVIRONMENT.md`,
`AGENTS.md` (line 42), `ENGINEERING_STANDARDS.md` (B-4, B-6, B-8, O-8) and
`.github/pull_request_template.md`.

This approval is a pipeline role. It is **not** the owner's confirmation of the
migration change that `AGENTS.md` requires ("Show every migration before applying
it. No exceptions, however small."), and it is not an owner decision. That
confirmation is the next step (section 4).

## 1. Decision

Approved for the owner's stop. The implementation matches the approved plan, the
red-first order is in the history, the tester's evidence is real and I reproduced the
key result myself. Nothing is pushed or merged until the owner confirms the migration
edit (section 4) and allows the push.

## 2. What I verified myself

| Check | Command (as run) | Exit | Result |
|---|---|---|---|
| Shared repository not shallow | `git rev-parse --is-shallow-repository`, before and after every run | — | `false` each time. I ran no `git fetch`. |
| Base unchanged | `git merge-base HEAD origin/rebuild/dotnet-platform`; `git rev-parse origin/rebuild/dotnet-platform` | 0 | Both `6470fac3668aeeacabe4a47c39807d239ac33a09`. |
| Diff stays in scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 0 | `.github/workflows/ci.yml` (+8), `20260922142757_NavigationLinkRefs.cs`, `20261019104504_AddRefreshTokenSessionStart.cs`, `api/tools/migration-checks/canary-add-column-then-sql.sql` (new), `api/tools/migration-checks/run.sh` (new, index mode `100755`), and `docs/changes/GAP-06/{plan,plan-review,plan-approval,implementation}.md`. Exactly plan section 4. No `*.Designer.cs`, no model snapshot. |
| Diff matches the plan | `git diff origin/rebuild/dotnet-platform...HEAD -- .github api/src api/tools/migration-checks/canary-add-column-then-sql.sql`, read in full | 0 | `ci.yml`: one step after "Apply migrations to the fresh database", with `MIGRATION_CHECKS_BLOCKING_FROM: "2026-11-12"` and `BASE_REF` through `env:`; no `uses:`, `image:`, `runs-on` or version line changed. Migrations: in `Up` only, the SQL moved verbatim into `private const string ConvertLinksSql` / `SessionStartSql` and called as `migrationBuilder.Sql("EXEC(N'" + … .Replace("'", "''") + "');")`, as in plan section 7. `Down` unchanged. Canary: the plan's two-batch fixture, verbatim. |
| Red test before the fix (B-6) | `git log --format='%h %s' 6470fac..HEAD` | 0 | `0f6fd6f` "Add failing migration checks with canary to CI" comes before `8b41c00` "Run the raw SQL of two migrations through EXEC"; `b92d325` (diff and generated SQL shown) comes before any after-fix run. The tester re-ran `0f6fd6f`: exit 1, `Msg 207 … 'link_kind'`, history 6 of 15. |
| Commit subjects and trailers (B-4) | the same `git log`, with bodies | 0 | All 7 subjects are imperative and prefixed `GAP-06:`; each body says why; each carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd`. |
| Build | `dotnet tool restore`; `dotnet build DigitalHub.slnx -c Release` (from `api/`) | 0 | "Restore was successful."; `13 Warning(s)`, `0 Error(s)` (the baseline's 13). |
| No model change | `dotnet tool run dotnet-ef -- migrations has-pending-model-changes --no-build --configuration Release --project src/DigitalHub.Api/DigitalHub.Api.csproj` | 0 | "No changes have been made to the model since the last migration." |
| **The gate, blocking** (fastest suite covering the change) | `SA_PASSWORD=<ci value> MIGRATION_CHECK_DB_PREFIX=GAP06L_ MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01 GITHUB_STEP_SUMMARY=<scratch> tools/migration-checks/run.sh dh-mssql` | **0** | See below. |
| The gate, committed date | the same with `MIGRATION_CHECKS_BLOCKING_FROM=2026-11-12` | 0 | `blocking from 2026-11-12 (today 2026-11-01: report mode)`; `== Result: 0 failure(s); blocking from 2026-11-12; report mode.` |
| Blocking-date ceiling | `MIGRATION_CHECKS_BLOCKING_FROM=2026-11-24 … run.sh dh-mssql` | 1 | `::error::Migration checks cannot run: MIGRATION_CHECKS_BLOCKING_FROM 2026-11-24 is after 2026-11-23, Wave 1's last blocking day` |
| Password never printed | `grep -c CiOnlySa2026Passw0rd` over my run log and step summary | — | `0` and `0`. |
| Clean-up | `SELECT COUNT(*) FROM sys.databases WHERE name LIKE 'GAP06L%'`; `docker exec dh-mssql ls -A /tmp \| grep -c GAP06L` | — | `0` and `0`. No `GAP06%` catalog existed before my runs. `git status --short` shows only the uncommitted `test-report.md` (and this file). |

My blocking run:

```
Migration checks: catalog prefix GAP06L_, base rebuild/dotnet-platform, blocking from 2000-01-01 (today 2026-11-01: blocking mode).
N=15, latest=20261020113912_AddApplicationCounts, previous=20261019104504_AddRefreshTokenSessionStart
base (rebuild/dotnet-platform) newest migration: 20261020113912_AddApplicationCounts
PASS  2. Canary rejected: exit 1, Msg 207 Invalid column name 'new_col'
PASS  3. Script run 1, empty catalog: exit 0, history 15 of 15
PASS  3. Script run 2, empty catalog: exit 0, history 15 of 15
PASS  4a. Previous schema, script: from 20261019104504_AddRefreshTokenSessionStart: exit 0, history 15 of 15
SKIP  4b. Base schema, script: base = head (20261020113912_AddApplicationCounts), covered by step 3
PASS  5. database update latest, 20261019104504_AddRefreshTokenSessionStart, latest: each exit 0, history 15 of 15
PASS  6. Same schema: 3 catalogs (GAP06L_Script GAP06L_Previous GAP06L_Ef), 468 lines each, identical
== Result: 0 failure(s); blocking from 2000-01-01; blocking mode.
exit=0
```

**The tester's evidence is real.** Both rounds quote commands, exit codes and output,
and my run reproduces round 2's R5 line for line. The tester also covered what I did
not re-run: data equivalence and the 50002 guard from migration 6 on both routes; the
integration suite (475 passed, 0 failed); the unescaped `EXEC` bodies equal the old
SQL (whitespace only); shellcheck 0.11.0 → 0 findings and actionlint on `ci.yml` → 0;
mutants (no `-b` → canary not rejected, exit 1 even in report mode; schema drift
caught; password redacted); an older base (`phase-c/section-5`) exercising step 4b;
the CI shallow-fetch path in an isolated clone.

**Coverage table.** Every row of `implementation.md` section 7 and of the test
report's two coverage tables has evidence, except the two that cannot have it here
and are open below: CI on the PR (not pushed) and the Studio-copy test (owner-run).

**Gate-1 conditions.** 1 (never shallow): met, `false` throughout, `run.sh` fetches
only when the clone is shallow. 2 (show before applying, in order): met. 3
(throwaway catalogs): met. 4 (schema query in full): met, `implementation.md`
section 6. 5 (real, validated date): met, `2026-11-12`, refused if malformed or
after 2026-11-23. 6 (merge order): open, below. 7 (`ci.yml` rebase): no rebase was
needed; re-check at rebase. 8 (secrets): met.

## 3. Open items (not done, and who closes them)

1. **Owner confirmation of the migration edit** (section 4). Required before push.
2. **Studio-copy test** (plan 5.5, coverage row "Test on a copy of
   `DigitalHubContent_Studio`"): **NOT RUN, pending owner.** There is no copy of
   `DigitalHubContent_Studio` on this server. The owner runs plan 5.5 on the
   Windows machine, with the query in `implementation.md` section 6 as `$schema`.
   Expected: both script runs `exit=0`; if the copy is at 15 of 15, both
   `Compare-Object` calls print nothing. The owner's output, quoted, closes the row.
3. **CI on the final head** (plan 5.3 #9): **NOT RUN**, nothing is pushed. Covered by
   CI job `api`, step "Migration checks — idempotent script twice, previous schema".
   Until 2026-11-12 failures in steps 3 to 6 only warn, so the reviewer of the PR must
   read the step log for `== Result: 0 failure(s)` and the canary `PASS`, not only
   the green tick. The other jobs must be no worse than base.
4. **Commit the records.** `test-report.md` and this file are uncommitted in the
   worktree; they must be committed on `change/GAP-06` before push, so the PR carries
   its own evidence.
5. **Blocking date at merge.** `2026-11-12` assumes a merge on 5 November. GAP-06
   queues behind Wave 0 (GAP-01 to GAP-03), so the merge may be later. At the last
   rebase the integrator sets `MIGRATION_CHECKS_BLOCKING_FROM` in `ci.yml` to the
   merge day plus 7; if that is after 2026-11-23 (a merge after 16 November),
   `LATEST_BLOCKING_FROM` in `run.sh` moves in the same reviewed merge.
6. **Merge order and rebase** (gate-1 conditions 6 and 7): slot 1 of Wave 1, behind
   Wave 0, unless the owner says otherwise in quotable words. After any rebase over
   PR #38, GAP-04, GAP-08 or GAP-09, re-check the step position, its
   `working-directory: api`, that the checkout can still `git fetch`, and actionlint
   if GAP-08 is on the base.
7. **Human review** (Definition of Done): the PR still needs the owner's (or another
   person's) review.
8. **O-8** ("How Phase D applies migrations") stays open; this change does not answer
   it. If the owner picks the script route, the runbook must use `sqlcmd -I -b`.

## 4. What the owner is asked to confirm

At the stop after this gate, before anything is pushed, the owner is asked to confirm
**exactly this**, under `AGENTS.md` line 42:

> The edit of two migrations that are already applied to existing catalogs:
> `20260922142757_NavigationLinkRefs` and `20261019104504_AddRefreshTokenSessionStart`.
> In each `Up`, the raw SQL that uses a column added earlier in the same migration is
> moved, unchanged, into a `private const string` and run as
> `EXEC(N'<the same SQL with each ' doubled>')`. Nothing else in the migrations
> changes: not the migration ids, not `Down`, not the `AddColumn`/`AlterColumn`/
> `AddCheckConstraint` calls, not the `.Designer.cs` files, and not the model
> snapshot. The change is shown in plan section 7 and, as generated SQL, in
> `implementation.md` section 4 (4.1 diff, 4.2 move proof, 4.3 generated SQL old
> against new).

What the confirmation covers, and what it does not:

- **Effect on catalogs that already ran them** (`DigitalHubContent`,
  `DigitalHubContent_Studio`, any deployed copy): none. EF skips any migration whose id
  is in `__EFMigrationsHistory`, through `database update` and through the script's
  `IF NOT EXISTS`. Run 2 of the script in step 3 exercises exactly that path. The
  owner-run Studio-copy test (open item 2) is the proof on real data, and stays open
  after the confirmation.
- **Effect on catalogs that have not run them:** the same schema (468 of 468 lines) and
  the same data (navigation rows, `SessionStartedAt`) as the current `database update`
  route; the 50002 guard still fires and rolls the migration back.
- **Where the edited migrations were applied so far:** only to scratch catalogs
  (`GAP06_`, `GAP06R_`, `GAP06T_`, `GAP06L_` on the shared `dh-mssql`, all dropped)
  and to `DigitalHubContent_Test` for the integration suite (already at 15 of 15, so
  nothing ran on it). Never to `DigitalHubContent` or `DigitalHubContent_Studio`.
- **Rollback:** revert the PR. No catalog needs any action.
- **Not covered by this confirmation:** O-8, and permission to push or merge (asked
  separately).

The owner's answer is to be quoted exactly, with the date and where it was given, in
the PR's "Owner decisions" section.

## 5. Review findings accepted

- **Test report round 2, Minor R2-1** (an interrupt during `CREATE DATABASE` leaves
  that one, empty catalog behind). Accepted. It only happens locally on a shared
  server, it fails safe (the next run with that prefix stops with "already exists …
  drop it by hand"), nothing that belongs to someone else is touched, and CI runs in
  a fresh container per job. Fixing it now would mean another loop for a local
  convenience. It is listed in the PR as an accepted finding.
- **Plan known limit:** migrations 4, 8 and 15 stay unwrapped; a later migration that
  breaks one of them is caught by step 3's second run.
- **Tester observation:** the schema listing covers tables only (no views, triggers,
  procedures or sequences); no migration creates any today.

## 6. Draft pull request description

```markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6Yc7G3x1zMCKZMuJSV3oKJ2)_

## What and why

GAP-06 (refinement plan, Wave 1; rule G-4; test-report finding 4). The idempotent
migration script stopped at migration 7 of 15: SQL Server compiles each migration's
batch before it runs, so the raw SQL in `NavigationLinkRefs` and
`AddRefreshTokenSessionStart`, which uses columns added earlier in the same migration,
fails with `Msg 207`. Without `sqlcmd -b` it even exits 0 while skipping both. CI only
migrated from empty with `dotnet ef database update`.

This PR:
- runs the raw SQL of those two migrations through `EXEC(N'…')`, so it compiles when it
  runs (SQL text unchanged, moved into a `const`);
- adds one CI gate, `api/tools/migration-checks/run.sh`, with a committed canary: the
  idempotent script twice on an empty catalog, the script from N-1 and from the base
  branch's schema, `database update` latest → N-1 → latest, and an identical-schema
  comparison.

Metric "Migrations the idempotent script can apply": 6 of 15 → 15 of 15.

## Scope and boundaries

In scope: `.github/workflows/ci.yml` (one step added in job `api`, after "Apply
migrations to the fresh database"), `api/tools/migration-checks/run.sh` (new),
`api/tools/migration-checks/canary-add-column-then-sql.sql` (new), `Up` of
`20260922142757_NavigationLinkRefs.cs` and `20261019104504_AddRefreshTokenSessionStart.cs`,
and `docs/changes/GAP-06/*`.

Out of scope: migrations 4, 8 and 15; every `Down`; every `.Designer.cs` and the model
snapshot (unchanged, `has-pending-model-changes` → no changes); how Phase D applies
migrations (O-8, open); pinning the SQL Server image, actions, Node and .NET (GAP-09,
GAP-10, PR #38); the Studio end-to-end harness's own migration.

## Security impact

No route, policy, login or application code changes. Migrations run as the elevated
account, as before. The gate uses the existing workflow-only `SA_PASSWORD`, passes it
to `sqlcmd` through an inherited environment variable, redacts it from all output and
has no `set -x`. It refuses a catalog prefix starting with `DigitalHubContent`, never
drops a catalog it did not create, and runs only in the job's throwaway container.
No dependency added. Workflow permissions unchanged (`contents: read`).

## Tests and evidence

Full records: `docs/changes/GAP-06/implementation.md` and `test-report.md` (rounds 1
and 2); gate 2: `delivery-approval.md`.

- Red first: `0f6fd6f` (check only) → `run.sh` blocking, exit 1, `Msg 207 … Invalid
  column name 'link_kind'`, history 6 of 15. Fix in `8b41c00`.
- Head, blocking (`MIGRATION_CHECKS_BLOCKING_FROM=2000-01-01`), exit 0: canary rejected
  (exit 1, `Msg 207 … 'new_col'`); script run 1 and 2, 15 of 15; 4a from N-1, 15 of 15;
  4b skipped (base = head); `database update` latest → N-1 → latest, 15 of 15; schemas
  identical, 468 lines each. Re-run independently at gate 2 with the same result.
- 4b from an older base (`phase-c/section-5`): exit 0, 4 catalogs identical.
- Data equivalence from migration 6 (script vs `database update`): identical. The
  50002 guard fires and rolls back on both routes (history 6, `link_kind` absent).
- `dotnet build DigitalHub.slnx -c Release`: 0 errors, 13 warnings (baseline 13).
- `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build`: 475 passed, 0 failed.
- `shellcheck` 0.11.0 on `run.sh`: 0 findings; `actionlint` on `ci.yml`: 0 findings.
- Mutants: no `-b` → "canary was not rejected", exit 1 even in report mode; schema drift
  caught; bad dates, prefixes and `BASE_REF` refused; password in 0 logs.
- CI on this PR: <run id, to be filled>. Before 2026-11-12 the new step only warns on
  failure: check its log for `== Result: 0 failure(s)`.
- Studio-copy test (plan 5.5): **NOT RUN, pending owner** (no copy on the CI or agent
  server). <owner's output, to be quoted>
- Semgrep and gitleaks: NOT RUN locally (not installed); covered by `security.yml`.

## Owner decisions

- Migration edit (`AGENTS.md`: "Show every migration before applying it. No
  exceptions, however small."): <owner's words, date and place, to be quoted>
- Wave authority: "Start waves 0 & 1 and update me with each gap done", then
  "continue working on wave 0 & 1" (Mohamed Elbadry, 1 November 2026, project thread).
- O-8 stays open; this PR does not answer it.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such) — CI part pending this PR's run
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope — no route changed
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test — the gate is the test; red first in `0f6fd6f`
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below — plan review, tester rounds 1–2, tech-lead gate 2
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed — owner review pending
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback) — revert; no catalog needs action
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded — integrator to be named; suites re-run after the merge into `rebuild/dotnet-platform`

## Review findings accepted

- Tester R2-1 (Minor): an interrupt during `CREATE DATABASE` leaves that one empty
  scratch catalog behind. Local only; the next run stops with a clear "already exists
  … drop it by hand"; CI uses a fresh container per job.
- Migrations 4, 8 and 15 are not wrapped; a later migration that breaks one is caught by
  the script's second run.
- The schema comparison covers tables, columns, indexes, checks, foreign keys and
  defaults only; no migration creates views, triggers, procedures or sequences today.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated — G-4 row to be updated when the gate blocks
- [x] `docs/deferred-items.md` updated for any exception — no exception
- [x] Documentation updated — `docs/changes/GAP-06/*`

Merge note: `MIGRATION_CHECKS_BLOCKING_FROM` is `2026-11-12` (merge 5 November + 7).
If the merge is later, set it to merge day + 7 in the same merge; after 16 November
also move `LATEST_BLOCKING_FROM` in `run.sh`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
