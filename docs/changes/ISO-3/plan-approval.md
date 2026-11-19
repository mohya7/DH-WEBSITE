# ISO-3 plan approval (gate 1)

- Role: technical lead, gate 1. This approval is a pipeline role. It is not the
  owner's confirmation that `AGENTS.md` requires, and it is not an owner decision
  (P-7). In particular it does **not** satisfy hold point H-1.
- Date: 19 November 2026.
- Plan: `docs/changes/ISO-3/plan.md`, round 2 (962 lines, uncommitted in the worktree
  `D:\work\DigitalHub\dh-platform-claude-iso-3`, branch `change/ISO-3` at `0a55da4`).
- Review: `docs/changes/ISO-3/plan-review.md`. Its latest round, Round 2, ends
  `Verdict: APPROVED`, with one non-blocking Minor, m-6. Round 1's M-1 and m-1 to m-5
  are resolved, and I checked each against the plan text (T-4 probe column in 5.1;
  "29 cases fail and 2 pass" in 5.2 and 3.4; C-N on the 201 assertion; section 8
  re-apply bullet; 7.2 shell check; H-1's three items in 5.3).
- Read first: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
  `docs/quality/refinement-plan-2026-10-28.md` (Track G2, GAP-38, the two merge slots),
  `docs/adr/0001-split-public-forms-api.md` (status line), and both ISO-3 records.

## Decision

Approved, with the conditions below. The plan is the right change, at the right point
in the order. It matches the owner's request word for word, and it holds the owner's
"Migration shown first" as an explicit stop before anything is applied.

## Reasons

**Right change.** The four grants in 3.1 and 7.1 are the owner's request exactly:
INSERT on `contact_requests`; SELECT, INSERT, UPDATE on `application_counts`; SELECT on
`vacancies` and `site_settings`. Nothing is added and nothing is narrowed. The "Done
when" text is quoted from refinement plan line 214 and matches the owner's request. The
2.4 table maps each forms operation to the grant it needs, and I agree with its analysis:
no read-back on the contact insert, and no DELETE for the MERGE. ADR 0001 is accepted
(`docs/adr/0001-split-public-forms-api.md` line 3: "Status: Accepted. Owner's words:
"accepted" (19 November 2026 ..."). The plan claims only "part of GAP-38" and names
ISO-4 and Phase D as the rest (R-4), which is accurate.

**Right point in the order.** Track G2 runs ISO-1, ISO-2, ISO-3, then ISO-5 before ISO-4.
`git log origin/rebuild/dotnet-platform` shows `522b175 ISO-1 (#71)` and
`0a55da4 ISO-2 (#76)` merged, so ISO-3 is next. The ISO-4 after ISO-5 rule is not
touched. Wave 0's ordering and the G3 "Blockers before Majors" rule do not apply to a G2
item. ISO-3 takes merge slot 2 (G2 and G3, at most one a day). `#77` (ADM-12d, G3) went
through that slot today, so ISO-3 is not merged on the same day as another slot-2
change. In practice the owner's H-1 step and gate 2 come first anyway.

**No conflict with open work.** `gh pr list --state open` shows only `#78` (GAP-11c:
`website/*` and `docs/changes/GAP-11c/*`) and `#60` (draft, do not merge:
`studio/e2e/redirects.spec.ts`). Neither shares a path with section 4. I also listed
every remote branch not merged into `origin/rebuild/dotnet-platform` that touches
`ci.yml`, `docs/security-deployment.md`, `ENGINEERING_STANDARDS.md`, `api/README.md`,
`api/tests/DigitalHub.PublicApi.Tests/` or `Migrations/`. Every one of them
(`ADM-02`, `GAP-04`, `GAP-06`, `GAP-09`, `GAP-09-status`, `GAP-12`, `ISO-1`, `ISO-2`,
`adr-0001-accept`, `ci-runner-pin`) was squash-merged already: for example
`ci-runner-pin` is #38, `GAP-12` is #40 and `adr-0001-accept` is #67, all MERGED. The
newest migration on the base is still `20261020113912_AddApplicationCounts`. The only
commit on the base since the branch point is `0488d89` (ADM-12d), and it changes only
`ContentPublishTests.cs` and `docs/changes/ADM-12d/*`.

**Plan facts I re-checked.** `PublicApiFactory.cs:19` is the one connection line and
`:24` carries the "ISO-3 changes this one setting" comment. `ci.yml` has
`APP_LOGIN`/`APP_PASSWORD` as workflow-only values (lines 34-37), and its steps run in
the order the plan relies on: create the login, apply migrations, migration checks,
grant step, then the two test steps. The only identity columns in the snapshot are the
two `Id` columns at lines 1846 and 1871, which is M-1's premise and its fix.

**Risk is acceptable.** No route, policy or existing test changes. `AuditLogPermissionTests`
and the admin suite are untouched (C3 by names hash). The migration's only effect on a
catalog with no member is a harmless role. Its failure mode on a pre-existing role is
loud by design (P-5). The blocking migration checks run its `Down` and `Up` in CI. The
password handling follows `AGENTS.md` Secrets and the existing CI pattern. The tests
fail closed: no fallback login, an exact effective-permission set, a sweep of every
table that covers future tables, and controls C-W and C-N that show the tests failing
in both directions.

**Owner decisions.** None is needed for the design. The grants are the owner's own words,
quoted with date and place in section 1, with the go-ahead "Yes, start ISO-3". One owner
step is required: hold point H-1. It is not a decision, but no agent can stand in for
it (condition 2).

## Conditions on the developer

1. **Base first.** Before commit 1, bring `change/ISO-3` up to the current
   `origin/rebuild/dotnet-platform` (`0488d89` today). The branch has no commits yet, so
   this is a fast-forward, with no merge commit and no tracking (B-2). That way the
   commit hash shown at H-1 is the one that goes forward. If the base gains a migration
   before commit 2, stop and report. The timestamp ordering in 4.1 and the L4 range would
   change.

2. **Hold point H-1 is a hard stop.**
   - **Before H-1, these commits are allowed, in this order and no others:**
     - (optional, first) a records commit adding `docs/changes/ISO-3/plan.md`,
       `plan-review.md` and `plan-approval.md` unchanged;
     - plan commit 1, `ISO-3: Test that the public forms login cannot read users or
       change content` (`PublicFormsPermissionTests.cs` and
       `FormsDatabase.DeleteContactAsync` only), with the red run R1 at that commit;
     - plan commit 2, `ISO-3: Add the dh_public_forms_role migration` (the migration and
       its Designer file only, with the snapshot unchanged).
   - **Also allowed before H-1, with no commits:** L0, L1, L2, L3, C6 and L4 (the scripts
     go to the session scratchpad), and the R1 red run on `DigitalHubContent_Test` with
     L0 first. T-5 creates and drops its `iso3_probe_*` user as a test fixture, which is
     allowed. After the run, the developer checks, elevated and read-only, that no
     `iso3_probe_%` principal remains, and records the result.
   - **Then STOP and report `AT H-1`.** The report gives the commit 2 hash; the paths of
     `api/src/DigitalHub.Api/Data/Migrations/<id>_AddPublicFormsRole.cs` and its
     `.Designer.cs`; the absolute paths of the scratchpad `iso3-up.sql` and `iso3-down.sql`
     as L4 wrote them, each with its diff against 7.3 (only `<id>` may differ); and the
     environment step 7.2, meaning the CI lines and the local script, with no password.
     This is the set in 5.3, which governs over section 9 (m-6). The developer applies
     nothing to any database (no L5, L6 or `database update` anywhere) and creates no
     login, user or role membership. The developer does not edit `ci.yml` or
     `PublicApiFactory.cs`. Then the developer waits.
   - **H-1 is passed only by the owner's own words**, relayed by the orchestrator. They
     are quoted verbatim in `implementation.md`, with the date and place, against the
     commit hash and the files shown. This approval, the reviewer's, or any agent's
     paraphrase does not count. If the words are absent or unclear, the result is
     `BLOCKED ON OWNER` on H-1.
   - **Only after H-1:** L5, L6 and L7 (apply to `DigitalHubContent_Test` only, with the
     elevated account; create the local login through the 7.2 script); plan commit 3,
     `ISO-3: Run the public forms API's tests as dh_public_forms` (`PublicApiFactory.cs`,
     `ci.yml`); commit 4, `ISO-3: Record the dh_public_forms login in the deployment
     notes`; commit 5, `ISO-3: Implementation record`; and C1 to C4 green, C11 to C17.
   - **If the owner asks for a change** to anything shown, it goes in a new commit, never
     an amend or a rebase of commit 2. Everything shown is then generated and shown
     again, and the developer stops at H-1 a second time. If the change goes beyond
     the plan's text in 7.1 to 7.3, it goes back to the architect.

3. **Stop rules stand as written.** If R1 differs from "29 fail, 2 pass", or L4 differs
   from 7.3 beyond `<id>`, or any ISO-2 test fails on `dh_public_forms` for want of a
   permission, or `dh_public_forms` already exists on the local server, or the 7.2 shell
   checks fail, the developer stops and reports. The developer never widens a grant,
   never reuses or resets an unknown login, and never adjusts a test to reach the
   planned result (P-6).

4. **Databases.** Apply to `DigitalHubContent_Test` only. Check the catalog name in every
   `--connection` before running it. L0 runs before every database step and every test
   run, and its two results are recorded. Never `DigitalHubContent`, `_Studio` or a local
   `_E2e`. The admin and public suites run one after the other, never at once.

5. **Secrets.** The local password is never printed, logged, put on a command line or in
   an environment variable, or committed. `user-secrets list` is never shown unfiltered.
   C12 and the gitleaks job (C17) are reported.

6. **Records.** `implementation.md` aligns the H-1 wording with 5.3 (m-6). It carries the
   F-ISO3-1 note and the ISO-5 and Phase D hand-off (4.4). Commit subjects carry the
   `ISO-3:` prefix and an attribution trailer (B-4). No Debug build or test (Release only).

## Reviewer's Minors accepted

- **m-6** (section 9 says the owner sees "7.1-7.3", which is shorter than 5.3's list).
  Accepted without another plan round. Section 5.3 is the stricter text, and it governs.
  Condition 2 restates 5.3's list as what the developer must show at H-1, and condition
  6 has `implementation.md` record the alignment.

## For the owner: follow-up F-ISO3-1, noted and not decided

The owner's grant is table-level SELECT on `vacancies` and `site_settings`, and this plan
implements exactly that. Plan R-6 records the consequence. A flaw in the public forms
code could read **every** vacancy row, draft and ended vacancies included, through this
login. `site_settings` holds only what the website already publishes. A possible
follow-up, **F-ISO3-1**, would narrow the two grants to column-level SELECT:
`vacancies (id, title, status)` and `site_settings (id, email, careers_email)`. Those
are the only columns the forms read. Draft rows would still be readable by id, and only
a view or a row filter would close that. This is the owner's call, to schedule or to
decline. Nothing in ISO-3 waits on it, and no agent will narrow the grants without the
owner's words.

Verdict: APPROVED
