# ADM-07: plan approval (gate 1)

Technical lead, gate 1, 11 November 2026. Plan `docs/changes/ADM-07/plan.md` round 2
(`1145b3f`), review `plan-review.md` round 2 (`cd2091c`, `Verdict: APPROVED`, no
Blocker or Major, one new Minor: finding 7). Branch `change/ADM-07` at `cd2091c`,
pushed (`git rev-parse HEAD origin/change/ADM-07`: both `cd2091c9…`). Base
`origin/rebuild/dotnet-platform` at `6262f48` (ADM-02, #54).

## What I read

- `CLAUDE.md` / `AGENTS.md`, `docs/changes/README.md`.
- The plan in full and both review rounds.
- The audit, `/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`. ADM-07 is at
  lines 149-156, and the plan quotes it word for word.
- The refinement plan, Track G3 and the execution order.
- `docs/changes/ADM-02/delivery-approval.md`, "F-1 and F-2: where they go".
- `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` do not exist in the
  worktree (`ls`, exit 2), as the plan and the review record. Rule ids are used as
  `docs/changes/README.md` uses them.

## What I checked myself

| Check | Command or source | Result |
| --- | --- | --- |
| Review passed | `plan-review.md`, last round | Round 2 ends `Verdict: APPROVED` |
| Branch state | `git diff --name-only origin/rebuild/dotnet-platform...origin/change/ADM-07` | Only `docs/changes/ADM-07/plan.md` and `plan-review.md`. No code yet |
| Commit format (B-4) | `git log --format='%h %s%n%b' origin/rebuild/dotnet-platform..HEAD` | 4 commits, each `ADM-07:` with an imperative subject and both trailers |
| Open pull requests | `gh api repos/…/pulls?state=open` | Only #44, `change/GAP-07` (slot 1) |
| File overlap with #44 | `git diff --name-only origin/rebuild/dotnet-platform...origin/change/GAP-07` | `.github/security/*`, `security.yml` and its own records. **No overlap** with any file in plan section 4 |
| Other branches touching the planned files | Every remote branch ahead of the base, `git diff --name-only base...branch` limited to the section 4 files | `change/ADM-02` (squash-merged as #54), `change/ADM-06b` (merged as #51; its `RedirectsPage.tsx` equals the base), and stale October `phase-c/*`, `phase-d/content-bundle` and `ci/github-actions` branches with no open PR. No open conflict |
| Execution order | Refinement plan, step 2 and Track G3 | ADM-07 is in G3-1 ("ADM-02 and ADM-07 redirect and schema checks") and comes after ADM-06, 03 and 02, which are merged (`git log`: #49, #51, #52, #53, #54). Slot 2, Blocker batch, due 16 November. It is the right next change |
| Plan anchors | `sed` on `ContentStore.cs` 248-252 and 1062-1075, and `AdminStore.cs` 604 and 640-648 | They match 2.3 and 2.5. `redirect.ToPath == path`, `"Targets are compared as stored"`, and the vacancy query `Status == published` only |
| Build rule for vacancies | `BuildContentStore.cs:176` | `Published \|\| Ended`, as 3.4 says |
| Reviewer's Minor 7 | `ApiFactory.cs:161`, `188`, and uses at `CareersTests.cs:247`, `AuditRollbackTests.cs:75`, `AuditLogPermissionTests.cs:54` | Confirmed. `TestConnectionString()` is `private`. `ElevatedTestConnectionString()` is `internal`, passes through `ToTestCatalog`, and is already used with `new SqlConnection` |
| **K2's access to `ErrorSlugs`** (new, not in the review) | `grep -rn InternalsVisibleTo` over `api/` sources and project files; `BuildContentStore.cs:38` | **Defect.** Only `DigitalHub.ContentImport.csproj` grants internals to `DigitalHub.Api.Tests`. `DigitalHub.Api` grants none. Plan 3.1 and 4 make `ErrorSlugs` `internal`, and K2 asserts on `BuildContentStore.ErrorSlugs`. That does not compile from the test project. Condition 1 fixes it without a project-file change |
| Owner decisions | Plan section 9, and the coordinator's relay to me | O-ADM07-1 "Yes, red tests first" and O-ADM07-2 "Yes, refuse it" (the owner, 11 November 2026, project thread, card taps). These match the words relayed to me. I have not seen the thread myself |

Nothing database-backed was run. No SQL Server is reachable here. The plan sends
T1 to T10 and E1 to CI jobs `api` and `studio`.

## Decision

**Approved, with the conditions below.** Reasons:

- **Right change, right time.** It closes what remains of ADM-07, which is a Major
  that sits in the G3-1 Blocker batch. That is the scope ADM-02 handed over in its
  `plan.md` 3.4 and section 4. It also takes F-1 and F-2, which ADM-02's gate 2
  routed here. F-2 was asked as an owner question, not assumed, as that gate
  required.
- **The fix is the audit's own.** The audit asks for "a target check that warns in
  the Studio and reports in the build". The plan warns and reports. It does not
  refuse, and it does not fail the build.
  - Accepting a target with no page (201) is backed by Phase B 4.5 and 8.3, where
    chains collapse.
  - So the existing `AdminApiTests` 201s stay unchanged, and nothing is weakened
    (P-6).
- **Red first is real.**
  - Commit 1 holds tests only.
  - The Studio unit tests come in commit 2, so they cannot hide E1's red in CI.
  - T7 is a deterministic red for F-1, and T10 covers the busy branch.
  - O-ADM07-1 allows the tests-only push.
- **Low risk.** There is no migration, lockfile, package, workflow or `*.csproj`
  change. No route or policy changes. One input is newly refused (B6), as the owner
  decided. Fix commits 3 to 7 can each be reverted on their own.
- **No conflict.** The only open PR (#44, slot 1) shares no file with this change.
- **Owner decisions.**
  - Both questions are answered and quoted with date and place, and each is read
    narrowly.
  - B1 to B6 are behaviour changes. The owner sees them at merge, as with ADM-02's
    B1 to B7. None blocks the plan.
  - B3 (report, do not fail) is the audit's own wording, and it is flagged for the
    owner to overturn.
  - No owner decision is open.

## Conditions for the developer

1. **K2 must reach the error slugs through a public member (new finding, gate 1).**
   - `DigitalHub.Api` grants no internals to the test project. Do **not** add
     `InternalsVisibleTo`, and do not edit any `*.csproj`. Both are out of scope.
   - Route: keep `BuildContentStore.ErrorSlugs` `internal`, as planned.
     `RedirectTargets` (public, new file) exposes a public read-only view of it,
     for example `public static IReadOnlyCollection<string> ErrorPageKeys` built
     from `BuildContentStore.ErrorSlugs.Keys`.
   - K2 asserts that this view is exactly `404` and `500`, against `check-output.ts`'s
     `errorFiles`.
   - Record it in `implementation.md` as a deviation authorised by this approval.
   - If neither this route nor making `ErrorSlugs` itself a public read-only member
     works, stop and send the change back to step 1. Do not drop the assertion.
2. **Reviewer's Minor 7 (T10's holder connection).**
   - Use `ApiFactory.ElevatedTestConnectionString()`, as `CareersTests.cs:247` does.
     It resolves to `DigitalHubContent_Test`, and an application lock is held per
     database, so it blocks the API's `dh_content_app` session.
   - Do not use `ContentDbContext.Database.GetConnectionString()`. Once a connection
     has been opened, its password may be stripped, so it is not a reliable source.
   - Do not change `ApiFactory.cs`.
   - Assert the holder's `sp_getapplock` result is `>= 0` before the POST.
   - Roll back and close the holder in `finally`.
3. **Red first, as O-ADM07-1 allows.**
   - Push commit 1 alone and open the pull request as a draft.
   - Do not push again until jobs `api`, `website` and `studio` of that run have
     finished. Then push commit 2, then the fix commits.
   - Quote run ids, job ids and each failing assertion in `implementation.md`.
   - T7 must be red for the planned reason: two 201s, or a 201 and a 500. T10 must
     be red with 201 where 503 was expected.
   - If T7 is not red, stop and report it. Do not tune the gate after seeing a
     result without recording that you did.
   - T8 is reported as it ran, at red and at green. A `redirect_busy` in T8 at green
     is a failure.
4. **Test data.**
   - Use the `adm07-` marker on everything a test creates.
   - T9's redirect row, inserted directly through `ContentDbContext`, is deleted in
     `finally`, and so is everything else each test creates.
   - Databases: `DigitalHubContent_Test` and `DigitalHubContent_E2e` only. Never
     `DigitalHubContent`. .NET tests in Release.
5. **Scope is section 4 exactly**, plus the public member in condition 1. No change
   to `Adm02Run`, `ApiFactory.cs`, workflows, lockfiles or `package.json`, and no
   migration. Any other deviation stops the work and goes back to step 1.
6. **Local evidence (5.3).**
   - Diff the DB-free baseline against
     `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm07/base-passed.txt`.
     Expect 177 after `npm ci`; any name lost is a regression, reported first.
   - The .NET setup script exists at the path 5.3 gives
     (`/tmp/claude-0/-home-user-DH-WEBSITE/…/scratchpad/dn.sh`).
   - Quote every command as run, with its exit code.
7. **Pull request body.** It carries:
   - B1 to B6;
   - the "delete the ended vacancy first" route, marked as the plan's reading and
     not the owner's words;
   - B3 flagged for the owner (the build reports, it does not fail);
   - the coverage row for Phase C 10.7 / BA 530 as "Partly", with the IIS-level
     check moved to Phase D.
8. **Slot 2 cadence.** The refinement plan allows one slot 2 pull request a day, and
   #54 merged on 11 November. This change goes to the owner for merge no earlier
   than 12 November. The owner's merge confirmation is still required. This
   approval is not that confirmation.

## Reviewer's Minors accepted

- **Round 1, Minors 2 to 6:** resolved in round 2, as the review records. Nothing
  is left over.
- **Round 2, Minor 7 (T10's connection string helper):** accepted, and handled by
  condition 2. It needs no plan round.
- **My finding (K2 and `internal`)** is handled by condition 1, for the same reason:
  it is one member, inside a file the plan already creates.
- **Accepted as left alone** (plan section 10, out of scope):
  - the rename and manual-create loop race;
  - `/error-404` and `/error-500` counted live by `OccupiesLivePathAsync`;
  - no warning at unpublish (ADM-14 and ADM-20);
  - readable messages in the Redirects modal (ADM-14).

  Each is named with its destination or reason. None is a G3 Minor needing a D-NNN
  entry.

Verdict: APPROVED
