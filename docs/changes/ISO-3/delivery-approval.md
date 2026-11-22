# ISO-3 delivery approval (gate 2)

- Role: technical lead, gate 2. This is a pipeline role. It is not the owner's
  confirmation that `AGENTS.md` requires, and it is not an owner decision (P-7).
- Date: 22 November 2026 (review started 19 November 2026).
- Change: ISO-3, Track G2 (isolation), ADR 0001 point 3, part of GAP-38.
- Branch `change/ISO-3`, worktree `D:\work\DigitalHub\dh-platform-claude-iso-3`, head
  `6ffff507dfe00a61f583dd0e7ca50e15e698fb68`, merge base `0488d89`.
- Records read: `plan.md` (round 2), `plan-review.md` (Round 2, `Verdict: APPROVED`),
  `plan-approval.md` (`Verdict: APPROVED`), `implementation.md` (`Status: READY FOR TEST`),
  `test-report.md` (Round 1, uncommitted, `Verdict: APPROVED`, Minors m-1 to m-4 and the
  observations on table-wide INSERT/UPDATE). Also `docs/changes/README.md`, `AGENTS.md`,
  `ENGINEERING_STANDARDS.md` (B-4, B-6, P-6 to P-8, S-8), `.github/pull_request_template.md`.

## Decision

**Changes needed, for documentation only.** The code, the migration, the tests and the
evidence are sound and I would approve them as they stand. Two sentences in
`docs/security-deployment.md` are untrue as written (test-report m-1, documentation part,
and m-4). A security deployment note that claims more than the test proves would be merged
into the base as a false statement (P-8), and the fix is small and inside the developer's
approved scope (plan 4.2 names that file). So the change goes back to the developer for
one documentation commit, then to the tester for a short Round 2, then to gate 2 again.

The test does **not** need to be widened before merge (decision on m-1 below). Nothing in
this file asks for an owner decision.

## What I verified myself

| Check | Command / method | Result |
|---|---|---|
| Base, re-fetched 22 Nov 2026 | `git fetch origin`; `git rev-parse origin/rebuild/dotnet-platform`; `git log 1a2fe2e..origin/rebuild/dotnet-platform` | Base is still `1a2fe2e` (GAP-11c, #78). **It has not moved since the tester's round.** No new commit |
| Base overlap and migrations | `git diff --name-only 0488d89 origin/rebuild/dotnet-platform` | Only `website/package.json`, `website/package-lock.json`, `website/scripts/check-output.ts`, `website/test/output.test.ts`, `docs/changes/GAP-11c/*`. **No ISO-3 path, no migration.** Newest base migration is still `20261020113912_AddApplicationCounts`, so `20261119155407_AddPublicFormsRole` still sorts last |
| Open work | `gh pr list --state open`; every unmerged remote branch's diff filtered on ISO-3's paths | Only #60 (draft, `studio/e2e/redirects.spec.ts`). The unmerged remote branches that touch `ci.yml`, `Migrations/`, `security-deployment.md` or the public tests are old branches already squash-merged (as gate 1 found); none carries a migration newer than the base. No `change/ISO-3` or `change/ADM-12e` on the remote |
| Scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 13 files: the plan's section 4 files (migration + Designer, `PublicFormsPermissionTests.cs`, `FormsDatabase.cs`, `PublicApiFactory.cs`, `ci.yml`, `docs/security-deployment.md`, `api/README.md`, `ENGINEERING_STANDARDS.md`) and four ISO-3 records. Nothing else |
| Diff against plan | read the non-generated diffs | Migration equals plan 7.1 verbatim. `ci.yml`: only job `api`, items (a)-(d) of plan 4.2, no `uses:`. `PublicApiFactory`: `PublicFormsTestConnectionString()` with no fallback, refuses Windows auth and any login but `dh_public_forms`; line 19 uses it. `FormsDatabase`: `DeleteContactAsync` (parameterised) and the comment. S-8 "Enforced by" only. README line 5 only |
| Red test first (B-6) | `git log --format=... 0488d89..HEAD` | `d174aee` (test) precedes `8e162f8` (migration) and `65cc420` (switch). Red run at `d174aee`, 29 fail / 2 pass, is recorded by the developer and reproduced independently by the tester |
| Commit subjects and trailers (B-4) | same | All seven: `ISO-3:` prefix, imperative, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Six have a body saying why; `83c0958 ISO-3: Plan` has no body (records-only commit; accepted, the squash-merge commit takes the PR description) |
| L0 before each run | `Get-CimInstance Win32_Process` (testhost/vstest) and `sys.dm_exec_sessions` on `DigitalHubContent_Test` | `0` and `0` before each run |
| Build | `dotnet build tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release` (`api/`) | exit 0, `0 Warning(s)`, `0 Error(s)` |
| Fastest covering suite | `dotnet test api/tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~PublicFormsPermissionTests"` | exit 0, `Passed!  - Failed: 0, Passed: 31, Skipped: 0, Total: 31` |
| Full public suite | same project, no filter | exit 0, `Passed!  - Failed: 0, Passed: 102, Skipped: 0, Total: 102, Duration: 2 m 21 s` |
| Admin suite | NOT RUN by me | Run by the developer and the tester (596 of 596; tester diffed the sorted names against base CI run 44554202307: identical). Covered again by CI `api` on the PR head |
| Tester's evidence | read `test-report.md` Round 1 | Real commands, exit codes and output lines throughout; scripts hashed against the H-1 hashes (`3dca1411…`, `efa55d9f…`); every NOT RUN names its reason and the CI job that covers it |
| Coverage table | `implementation.md` section 11 and `test-report.md` rows | Every row has evidence. The one Partial row (CI migration checks and `studio`) is open item O-1 below |
| Owner words | `implementation.md` sections 4-6 | Quoted verbatim with date and place: "Seen, apply it" (H-1), "you run it" (L6/L7), "Yes, reset it" (password reset), "Yes, run them" (C-W, C-N). Also, as relayed to me: "ADM-12e waits" |

## Decisions on the tester's Minors

**m-1 (test cannot see IMPERSONATE, non-sysadmin server roles, other schemas, column-level
grants; the deployment note overstates).**

- **A documentation correction is enough for this merge; the test is not widened now.**
  Reasons:
  - The owner's "Done when" is met: the test, like `AuditLogPermissionTests`, proves the
    login cannot read users, roles, sessions or audit, or change content, on the catalog as
    it is, red then green, with controls C-W and C-N failing as planned. The tester verified
    read-only that none of the unseen grant classes exists today.
  - m-1 is about catching a *future* mistaken grant of a kind an administrator would have to
    make by hand. `AuditLogPermissionTests`, the owner's model, does not check those classes
    either.
  - Widening the assertions goes beyond plan 5.1. It would need the architect (P-6/P-8
    loop), not a quiet developer change. I do not ask for that before merge.
- **But the false sentence must be fixed before push (condition D-1).**
- **Follow-up F-ISO3-2** (named below) carries the widening. It is not an exception to any
  rule, so no D-NNN entry is created by me; if the owner prefers to record one, only the
  owner can (P-7).

**m-2 (Down's member-removal loop never exercised).** Accepted for this merge. The code is
correct by reading (tester, section 4), CI runs Down/Up on empty scratch catalogs, and the
path matters only for a Phase D rollback. Follow-up **F-ISO3-3**.

**m-3 (default `public`/`guest` surface: `VIEW ANY DATABASE`, guest in master/msdb/tempdb,
`msdb` backup history, `xp_dirtree`/`xp_fileexist`/`xp_instance_regread`/`xp_msver`).**
Accepted as not ISO-3's: SQL Server defaults, not added by this change. Follow-up
**F-ISO3-4**, destination Phase D.

**m-4 (doc says CI "runs the same lines", but CI uses `CHECK_POLICY = OFF`).** In scope for
the developer; condition D-1.

**Observations for the owner (table-wide INSERT on `contact_requests`, UPDATE on
`application_counts`).** Recorded with F-ISO3-1 for the owner; they follow from the owner's
grants as worded, and no agent narrows them.

## Conditions for the developer (round 2)

- **D-1.** One commit, `ISO-3: Say what the public forms permission test does and does not
  catch` (or similar, `ISO-3:` prefix, body says why, attribution trailer), changing only
  `docs/security-deployment.md`, section "Database: the public forms login":
  - the bullet "fails on a catalog where the login holds more or less than the four grants,
    or is in any other role" says exactly what is checked: object-level grants on every
    `dbo` object, schema `dbo` and database-level permissions compared with a fresh user,
    fixed database roles and the catalog's role list, and `sysadmin`; and says what it does
    not check: IMPERSONATE grants, server roles other than `sysadmin`, server permissions,
    other schemas, column-level grants (follow-up F-ISO3-2);
  - the CI bullet says CI runs the same statements with a workflow-only password and
    `CHECK_POLICY = OFF`.
- **D-2.** No other file changes, except a short round-2 note in `implementation.md` (may be
  the same commit or a records commit). No code, test, migration or workflow change.
- **D-3.** Commit the tester's `test-report.md` (Round 1) unchanged, in a records commit.
- **Then the tester, Round 2:** confirm by `git diff 6ffff50..<new head> --stat` that only
  those files changed, that both sentences are now true against `PublicFormsPermissionTests.cs`
  and `ci.yml`, and that `PublicFormsPermissionTests` still passes (31) on the new head.
  End with a verdict line.
- **Then gate 2, Round 2.** If only D-1 to D-3 changed, I expect to approve on that evidence.

## Push conditions (after gate 2 approves, and only when the owner confirms the push)

1. The head pushed is the one gate 2 approved, with `test-report.md` and
   `delivery-approval.md` committed (records commit, B-4 subject and trailer).
2. Re-fetch `origin/rebuild/dotnet-platform` just before the push. If it moved: if it adds a
   migration, or touches any ISO-3 path (section "Scope" above), stop and report; the
   migration timestamp order, L4 and the admin-names baseline must be re-checked, which is
   a new round. If it moved without overlap, merge or rebase per the pipeline's usual
   practice and record the new base in the PR.
3. `git grep -n CiOnlyForms2026Passw0rd` shows only `ci.yml` and the plan records; no
   `secrets.json` or user-secrets value in the tree.
4. No force-push to `rebuild/dotnet-platform`; push `change/ISO-3` only.

## Merge conditions (on the PR-head CI; the owner squash-merges)

All on the final PR head, run IDs quoted in the PR:

1. `api`, "Public API integration tests (Release)": `public-api-tests.trx` `total="102"`,
   `failed="0"`, including the 31 `PublicFormsPermissionTests`, **run as `dh_public_forms`**
   (the new membership step "Add the public forms login to its role, and nothing else"
   exits 0, and T-1 passes, which asserts `SUSER_SNAME()` is `dh_public_forms`).
2. `api`, "Integration tests (Release)": `failed="0"`, and the sorted admin test names equal
   the base CI run's `api-test-report` names (596 on `0488d89`/`1a2fe2e`; if the base moved,
   that base's run).
3. `studio` end-to-end: 34 of 34 passed (the job applies every migration, this one included,
   to its throwaway `DigitalHubContent_E2e`).
4. Warnings: no new build warnings against the base (the public test project builds with 0).
5. `api`, "Migration checks" (blocking since 2026-11-18): green, including the idempotent
   script twice, from N-1 and from the base, and step 5 down to N-1 (this migration's
   `Down`) and up again.
6. Security: `gitleaks-pr` (and `gitleaks-history`) pass; Semgrep 0 new.
7. Workflow lint: `actionlint` passes on `ci.yml`.
8. `website`, CodeQL and the remaining required checks green.
9. Merge slot 2 (G2/G3): not on the same day as another slot-2 merge.

**Merge note.** `DigitalHubContent_Test` is held at the ISO-3 migration until ISO-3 merges
(owner, 19 Nov 2026: "ADM-12e waits"). After the owner merges ISO-3, **the ADM-12 session
must be told**, so ADM-12e can merge the new base (which now carries
`20261119155407_AddPublicFormsRole`) and re-run its suites. Until then ADM-12e does not use
`DigitalHubContent_Test`.

## Open items

- **O-1.** CI on the final PR head (merge conditions 1-8): not yet run; nothing pushed.
- **O-2.** Conditions D-1 to D-3 and tester Round 2.
- **O-3.** End-to-end not run locally (harness fails at "Release migrations", plan 2.8);
  CI `studio` covers it.
- **O-4.** gitleaks and actionlint not run locally (not installed); CI covers them.

## Follow-ups (not in ISO-3; each for the owner to schedule or decline)

| Id | What | Source | Suggested destination |
|---|---|---|---|
| F-ISO3-1 | Column-level grants: SELECT `vacancies (id, title, status)` and `site_settings (id, email, careers_email)`; and, per the tester's observations, column-level INSERT on `contact_requests` and UPDATE on `application_counts (count)` | Plan R-6; test-report observations | Owner decision; a new change if scheduled |
| F-ISO3-2 | Widen `PublicFormsPermissionTests`: exact elevated assertion of `sys.database_permissions` (CONNECT plus the six, `minor_id = 0`), `sys.server_permissions` (CONNECT SQL only), no `sys.server_role_members`, no IMPERSONATE; then revert the D-1 "does not check" list | test-report m-1 | New change through `/change` (architect), before Phase D |
| F-ISO3-3 | Exercise `Down` with a real member: add a member before migration-checks step 5, or a recorded Phase D rehearsal | test-report m-2 | Migration-checks change, or Phase D |
| F-ISO3-4 | Production instance hardening: revoke `public` EXECUTE on `xp_dirtree`, `xp_fileexist`, `xp_instance_regread`, `xp_msver`; decide `VIEW ANY DATABASE`; review guest in `msdb` | test-report m-3 | Phase D, `docs/security-deployment.md` |
| — | ISO-5: `dh_public_forms` user and membership in `DigitalHubContent_E2e`; ISO-4: remove the admin copies on `dh_content_app` | `implementation.md` section 10 | ISO-5, ISO-4 (ISO-4 after ISO-5) |

## Draft pull request description

> Title: `ISO-3: Give the public forms API its own dh_public_forms login, limited to four tables`

```markdown
## What and why

ISO-3 of Track G2 (ADR 0001, point 3; closes part of GAP-38). The public forms API gets
its own SQL login, `dh_public_forms`, whose only permissions are the owner's four grants:
INSERT on `contact_requests`; SELECT, INSERT, UPDATE on `application_counts`; SELECT on
`vacancies` and `site_settings`. A flaw in the public forms code can then no longer read
users, roles, sessions, audit or the contact inbox, or change content.

- Migration `20261119155407_AddPublicFormsRole` creates `dh_public_forms_role` with exactly
  those grants. The login, its user and its membership are an elevated environment step,
  because the password is a secret (`docs/security-deployment.md`).
- The public API's test suite now runs as `dh_public_forms`; its fixtures keep `dh_content_app`.
- `PublicFormsPermissionTests` (31 cases) proves what the login cannot do.

## Scope and boundaries

In scope: the migration and its Designer; `PublicFormsPermissionTests.cs`;
`PublicApiFactory.cs` (`PublicFormsTestConnectionString`, no fallback); `FormsDatabase.cs`
(`DeleteContactAsync`); `ci.yml` job `api` (second login, membership step);
`docs/security-deployment.md`, `api/README.md`, S-8 "Enforced by"; `docs/changes/ISO-3/*`.

Out of scope: the admin API's copies of the two routes, still on `dh_content_app` (ISO-4);
the website form tests against the public API and the `_E2e` membership (ISO-5); the
production login and secret store (Phase D). No change to `api/src/**` beyond the two
migration files, to the admin tests, `studio/`, `website/`, `packages/`, `api/tools/` or
`.github/security/`. The model snapshot is unchanged.

## Security impact

- Data: the public forms process is limited to six operations on four tables (in tests and
  CI now; in service at Phase D).
- Logins: new SQL login `dh_public_forms` (user only in `DigitalHubContent_Test`, locally
  and in CI); new role `dh_public_forms_role`, inert where it has no member.
  `DigitalHubContent` has neither.
- Secrets: local password random, never printed, only in user-secrets. CI value
  `CiOnlyForms2026Passw0rd` is workflow-only, for a discarded container.
- Routes, policies, dependencies: none changed. Workflows: `ci.yml` job `api` only, no new action.

## Tests and evidence

- Red first: `d174aee`, `PublicFormsPermissionTests` on `dh_content_app`: exit 1,
  `Failed: 29, Passed: 2, Total: 31`, each for the planned reason (developer and tester).
- Green, local Release, head `<final head>`:
  - `dotnet test ...PublicApi.Tests -c Release --filter PublicFormsPermissionTests`: 31 of 31, exit 0
  - full public suite: `Passed: 102, Total: 102`, exit 0
  - admin suite: `Passed: 596, Total: 596`, exit 0; sorted names identical to base CI run 44554202307
- Controls (owner: "Yes, run them"): C-W (`db_datareader` added) 14 failed as planned;
  C-N (contact INSERT revoked) T-5, T-7 and 5 `PublicContactTests` failed as planned; both undone, 31 of 31 after.
- Migration: idempotent Up/Down scripts equal the ones shown at H-1 (sha256 `3dca1411…`,
  `efa55d9f…`); `has-pending-model-changes`: no changes; Designer target model equals the snapshot.
- Semgrep 1.180.0: `1 known, 0 new` (after `dd9a1f3`, which made every `CommandText` literal).
- npm and dotnet audit gate scripts: 0 at the gate's level.
- NOT RUN locally: end-to-end (harness fails at "Release migrations"; CI `studio`),
  gitleaks (CI `gitleaks-pr`), actionlint (CI Workflow lint), Down/Up on a database (CI "Migration checks").
- CI on the PR head: CI run `<id>`, Security run `<id>`, Workflow lint run `<id>`, CodeQL run `<id>`:
  public 102 / admin names equal base / studio 34 / Migration checks incl. Down/Up / gitleaks / actionlint.

## Owner decisions

All 19 November 2026, in the Claude Code session:
- Request: "ISO-3 dh_public_forms login: INSERT on contact_requests; SELECT, INSERT, UPDATE
  on application_counts; SELECT on vacancies and site_settings. Refinement plan Track G2,
  ISO-3, closes part of GAP-38; ADR 0001 (accepted 19 November 2026, owner's words:
  "accepted"). Migration shown first. Done when a permission test, like
  AuditLogPermissionTests, proves it cannot read users, roles, sessions or audit, or change content."
- Go-ahead, replying to "Should I start ISO-3 through /change?": "Yes, start ISO-3"
- H-1, after seeing the committed migration and the generated Up/Down scripts: "Seen, apply it"
- On who runs the two database steps: "you run it"
- On resetting the login password: "Yes, reset it"
- On the two controls: "Yes, run them"
- On ADM-12e and `DigitalHubContent_Test`: "ADM-12e waits"

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (in service only at Phase D, and only fully after ISO-4)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; every security fix has a regression test (red at `d174aee`)
- [ ] PR checks are green on the final head (run IDs quoted) — open until CI finishes
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author (plan-reviewer, tester, tech lead; AI governance followed)
- [x] Rollback is understood: revert this PR; schema: `database update 20261020113912_AddApplicationCounts` removes members and drops the role; the orphan user is harmless; re-`Up` needs the membership line again
- [x] Deployment note: nothing deploys until Phase D; the owner squash-merges into rebuild/dotnet-platform and CI, Security and Workflow lint re-run there

## Review findings accepted

- Test-report m-1 (test cannot see IMPERSONATE, server roles beyond sysadmin, other schemas,
  column grants): the deployment note now says so; widening is follow-up F-ISO3-2.
- m-2 (Down's member removal not exercised): follow-up F-ISO3-3.
- m-3 (SQL Server default public/guest surface): Phase D hardening, F-ISO3-4.
- m-4: fixed in the deployment note.
- Plan-review m-6 (H-1 wording): followed the stricter 5.3 text.
- Table-wide SELECT/INSERT/UPDATE as the owner worded them: F-ISO3-1, for the owner.

## Governance

- [x] Coverage table updated (`docs/changes/ISO-3/implementation.md` section 11)
- [x] `docs/deferred-items.md`: no exception taken, nothing to add
- [x] Documentation updated (`docs/security-deployment.md`, `api/README.md`, S-8)

After merge: tell the ADM-12 session, so ADM-12e can merge this base and re-run.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: CHANGES NEEDED
