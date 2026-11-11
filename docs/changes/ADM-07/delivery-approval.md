# ADM-07: delivery approval (gate 2)

Technical lead, gate 2, 11 November 2026.

- **Pull request:** #55, `change/ADM-07` into `rebuild/dotnet-platform`. Its state, from
  `gh api …/pulls/55`: `draft=true state=open head=81468c5`.
- **Code head:** `429c9d0`.
- **Records head:** `81468c5`, which adds the test report.
- **Base:** `6262f48`.
- **Records read:**
  - `plan.md` round 2 (`1145b3f`);
  - `plan-review.md` round 2 (APPROVED);
  - `plan-approval.md` (`309b18a`, APPROVED with eight conditions);
  - `implementation.md` (`429c9d0`, READY FOR TEST, four deviations);
  - `test-report.md` Round 1 (`81468c5`, APPROVED, no Blocker or Major, two Minors).

## Decision

**Approved.** The diff is the approved plan, plus the one public member that gate 1
authorised. I checked the following myself, against the GitHub API and job logs I
fetched, not against summaries:

- The tests were committed first, and CI went red on them for the planned reasons.
- Every workflow is green on the code head.

The change now goes to the owner, with the open items below. This approval is not
the owner's merge confirmation.

## What I verified myself

### Scope, commits and conditions

| Check | Command | Result |
| --- | --- | --- |
| Branch and heads | `git rev-parse HEAD origin/change/ADM-07 origin/rebuild/dotnet-platform` | `81468c5`, `81468c5`, `6262f48`. The worktree is clean |
| Scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 17 files, listed after this table. Nothing else: no `*.csproj`, lockfile, `package.json`, workflow, `ApiFactory.cs`, `Adm02Run` or migration |
| Diff against the plan | `git diff origin/rebuild/dotnet-platform...HEAD -- api/src studio/src website/scripts`, read in full | Matches the plan. Details after this table |
| Red commits hold tests only (B-6) | `git show --stat 6c842ae`; `git show --stat 1a82b34` | Commit 1 has 4 test files and nothing under `api/src`, `studio/src`, `website/src` or `website/scripts`. Commit 2 is `studio/test/redirects.test.tsx` only. Both come before every fix (`git log`) |
| B-4 | `git log --format='%h %s'` and `%(trailers:only)` for each of the 9 commits from `6c842ae` to `81468c5` | Each subject is `ADM-07:` plus an imperative. Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line |

**The 17 files in the diff:**

- the 7 files plan section 4 creates;
- the 5 files it changes;
- the 5 records in `docs/changes/ADM-07/`.

**How the diff matches the plan:**

- **3.2, `ContentStore`.** `DeleteAsync` and `RetargetAsync` compare `ToPath` through
  `RedirectPaths.Spellings`. Nothing else in the file changed.
- **3.1, the target check.**
  - `RedirectTargets` has the build's statuses: Published, plus Ended for vacancies.
    It leaves out the error slugs.
  - `targetLive` is on the list rows and on the 201 body. On the 201 it is computed
    after the commit.
  - The Studio marker and warning use the wording 3.1 gives.
  - `redirectTargetReport` looks files up in the walked `Set`. `fs.existsSync` is used
    only for the folder itself, and nothing is added to `report.problems`.
- **3.3, the lock.**
  - The transaction starts after the input and self checks.
  - `sp_getapplock` is a `const` string with a typed `int` output parameter.
    `@result < 0` gives `503 redirect_busy`, and `CommitAsync` follows
    `SaveChangesAsync`.
- **3.4, ended vacancies.** The predicate is `Published || Ended`.
- **Condition 1.** `ErrorSlugs` is `internal`, and the public view is
  `RedirectTargets.ErrorPageKeys`.

### CI red on the tests-only commit (`6c842ae`, run 43022439824)

I fetched the job logs myself (`gh api …/actions/jobs/<id>/logs`). The coordinator's
copy of the `api` log is missing its first lines (784 KB, against 945 KB for mine), so
it names only 18 failures. Mine names all 19.

| Job | Result in the log |
| --- | --- |
| `api` 130528683245 | `Total tests: 539`, `Passed: 520`, `Failed: 19`. 19 names are listed after this table. Each fails for the reason the plan gives |
| `website` 130528683736 | `Tests  4 failed \| 425 passed \| 31 skipped (460)`. The 4 are W1 to W4, in `redirect-targets.test.ts`, and nothing else |
| `studio` 130528683592 | Unit tests `91 passed (91)`, since S1 to S3 are not in commit 1. End-to-end: `1 failed`, `30 passed`. The failure is `redirects.spec.ts:37` at `:71:8` `toBeVisible`, which is E1's step 3 warning toast. Steps 1 and 2, before line 71, passed. This is the planned red |

**Why the 19 `api` tests failed:**

- **T1, T2 (both cases), T3 (6) and T4:** "The redirect has no targetLive: {…}".
- **T5:** "The redirect to /<m>-p/ survived the delete".
- **T6:** "/…-in should point at /…-q: ["/…-in -> /…-p/", "/…-p -> /…-q"]".
- **T9 (2):** "Created {…}".
- **T7 (`""`, `""`):** "A create failed on the server: 201 … | 500 … internal_error".
- **T7, both mixed-spelling cases:** "Expected exactly one 201: 201 … | 201 …".
- **T8:** two 201s and several 500s per round.
- **T10:** "Expected 503 while the lock is held: 201 {…}".

The 539 cases are the base's 520 plus the 19 in commit 1. All 520 base tests passed.

Commit 2's red (S1, S2) is local only, because it was pushed with the fixes. Plan 5.4
calls the local red "evidence enough on its own". The developer and the tester both
quote it: `Tests  2 failed | 1 passed (3)`, failing for the planned reasons.

### CI green on the code head (`429c9d0`)

| Workflow and job | Result |
| --- | --- |
| CI 43023252697: `api` 130531438897 | `Total tests: 540`, `Passed: 540`. That is the base's 520 plus 20 new cases. All 20 are named `Passed` in the log. T10 took `[5 s]`, which is the lock timeout. Each T7 case took `[2 s]`, which is the gate cap |
| `studio` 130531438484 | `Tests  94 passed (94)`. End-to-end `31 passed (3.5m)`, including `redirects.spec.ts:37` E1 at `(4.9s)` |
| `website` 130531439091 | `Tests  429 passed \| 31 skipped (460)`. The log shows `Redirect targets: all 0 resolve to a page.` and `Build output checks passed.` |
| `website-browser` 130531438812, `section-compare` 130531795615 | success |
| Screenshot parity 130531799059 | skipped. It is optional and runs only with the `screenshots` label |
| Security 43023252495, Workflow lint 43023252546 | success |
| CodeQL 43023252491 | skipped |

**`paging.spec.ts` before and after (plan 5.4).** The test that creates 51 redirects
took `(6.6s)` at red, without the lock, and `(6.0s)` at green. The lock adds no cost
anyone can see.

### Re-run here (fastest suites covering the change, at `81468c5`)

| Command | Exit | Output |
| --- | --- | --- |
| `cd website && npx vitest run test/redirect-targets.test.ts` | 0 | `Tests  4 passed (4)` |
| `cd studio && npx vitest run test/redirects.test.tsx` | 0 | `Tests  3 passed (3)` |
| `cd api && dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)`, the base's count |
| `HOME=<fresh> ConnectionStrings__Content="Server=127.0.0.1,4299;…" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~RedirectTargetRuleTests\|FullyQualifiedName~RedirectAddressRuleTests"` | 0 | `Passed!  - Failed: 0, Passed: 2, Total: 2` (K2, K1) |
| `git status --short` | 0 | empty |

No database was reachable or touched. The database tests are proven by the CI runs
above.

### The tester's evidence

- It is real. Each check is quoted with its command, exit code and output.
- Everything not run is marked NOT RUN, with its reason and the CI job that covers it.
- Where I re-ran or read the same checks, my results match: red commit contents,
  W and S results, the build's 13 warnings, K2, and the CI totals.
- I did not repeat the 177-name DB-free baseline diff. The developer and the tester
  quote it the same way: `Passed: 177, Total: 540`, with no name lost.

## Deviations

| # | Deviation | Decision |
| --- | --- | --- |
| 1 | `RedirectTargets.ErrorPageKeys`, a public read-only view of `BuildContentStore.ErrorSlugs` | Authorised by gate 1, condition 1. It conforms: no `InternalsVisibleTo` and no `*.csproj` change |
| 2 | `Adm07Run` instead of `Adm02Run` | Accepted. The plan allowed reuse but did not require it. Conditions 4 (the `adm07-` marker) and 5 (`Adm02Run` unchanged) need a separate helper. It sits in a file the plan creates |
| 3 | K2 lands in commit 5, not 4 | **Ratified.** K2 asserts `export function redirectTargetReport`, which commit 5 adds, so in commit 4 it would be red against that commit's claim. The file and the assertions are as planned, and K2 is a drift guard, not a red-first test. It is a change of commit order only, not of scope, so condition 5's "back to step 1" does not apply |
| 4 | T10's holder uses `@LockTimeout = 0` | Accepted. The plan set no timeout. A holder that cannot take the lock at once fails the test instead of delaying it, and its result is asserted `>= 0` (condition 2) |

## Gate 1 conditions

| # | Met? | Evidence |
| --- | --- | --- |
| 1 K2 through a public member | Yes | Deviation 1. K2 passes, as re-run here |
| 2 T10 holder on `ElevatedTestConnectionString()` | Yes | `implementation.md` and the test report. T10 red at red, `[5 s]` green in CI |
| 3 Red first | Yes | Commit 1 was pushed alone. The `api`, `website` and `studio` jobs finished red before the next push (runs above). T7 was red for the planned reason |
| 4 Test data | Yes | `adm07-` marker; the T9 row is removed in `finally`; only `_Test` and `_E2e` are used |
| 5 Scope | Yes | Diff stat above |
| 6 Local evidence | Yes | 177 passed, none lost (developer and tester) |
| 7 PR body content | Drafted below |
| 8 Slot 2 cadence | **Open** | Not for merge before 12 November |

## The tester's Minors

- **Minor 1: `/index`.**
  - The Studio says "No page", but the build and IIS serve `index.html`.
  - **Accepted, not fixed here.**
  - Both sides only report, and nothing fails. Nobody links to `/index`. The API errs
    toward a warning, which plan 3.5 already accepts for `/About`.
  - It is not an audit Minor, so G3's D-NNN rule does not apply.
  - **Destination:** a follow-up change, `ADM-07b`, which the coordinator schedules in
    slot 2 G3-2. The tester's one-line fix would make `redirectTargetReport` ignore
    `index.html` for any key other than `/`, with a W-test. That would make the build
    agree with the API.
  - If the owner wants it fixed before the merge, it goes back to the developer.
- **Minor 2: T8's and T10's timing lines are only in the TRX.**
  - **Handled with console evidence, which is enough.** I could not download artifact
    13855559198 either: the egress proxy refuses the artifact host.
  - The green log shows `Passed … Many_creates_of_one_address_at_once_give_one_redirect [265 ms]`.
    All five rounds of 8 requests ran in 265 ms in total, so every round's slowest
    request took under 265 ms, far from the 5 s lock timeout.
  - A pass means exactly one 201 and seven `409 redirect_exists` per round, so no
    `redirect_busy` happened.
  - T10 shows `[5 s]`.
  - Whoever can download `api-tests.trx` (open item 3) may paste the per-round lines
    into the pull request. It is not required for this gate.

## Definition of Done

`.github/pull_request_template.md` **does not exist** on `rebuild/dotnet-platform`
(`git ls-tree -r --name-only origin/rebuild/dotnet-platform | grep -i pull_request`: no
match). I used the boxes ADM-02's gate 2 quoted from it. The coordinator should
confirm the template's location (open item 6).

| Box | Can it be ticked now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes. Audit ADM-07, bullet 3 and its fix; F-1; F-2. CI 43023252697 |
| Code follows the engineering standards | Yes. Diff read in full; no new warnings. `ENGINEERING_STANDARDS.md` is absent from the tree, as every role records |
| No new prohibited constructs in touched code | Yes. Data access stays in `AdminStore`, `ContentStore` and `RedirectTargets`. The SQL is a constant with a typed parameter |
| Every new or changed route has a guard and, with a record id, a record scope | Yes, trivially: no route changed (`[Authorize(Policy = "studio")]` kept) |
| Tests exist for the changed behaviour; every security fix has a regression test | Yes. Red in 43022439824, green in 43023252697. Changed-line coverage is not gated yet (GAP-18) |
| PR checks green on the final head (run ids quoted) | Yes for code head `429c9d0`. **Open** for records head `81468c5` (CI 43024188607 in progress; Security 43024188651 and Workflow lint 43024188745 success), and for the docs-only commit that will add this file |
| Independent code review run; findings fixed or accepted | Yes. Plan review rounds 1 and 2, test report Round 1. Minors 1 and 2 are accepted above |
| Reviewed by someone other than the author | Yes for the pipeline roles. **Open:** the owner's review at merge |
| Rollback understood | Yes. Revert the pull request. Commits 3 to 7 revert separately. No schema or data change |
| Deployment note | **Open:** the slot 2 integrator is not named. Nothing deploys before Phase D |
| Governance: coverage table updated | Yes, in `implementation.md`, with a destination for every item moved out |
| Governance: `docs/deferred-items.md` for any exception | Not needed. F-1 and F-2 are fixed, and no exception is taken |
| Governance: documentation updated | Yes. Records in `docs/changes/ADM-07/`; no product document changes |

## Open items

1. **CI on the final head.** Run 43024188607 on `81468c5` must finish green, and so
   must CI on the commit that adds this file. Wait for the runs to finish, and do not
   cancel a run that is in progress.
2. **The owner's merge confirmation.** Not before 12 November (one slot 2 pull
   request a day; #54 merged on 11 November). The owner sees B1 to B6 in the body,
   with B3 flagged.
3. **Optional:** paste T8's and T10's timing lines from artifact 13855559198
   (`api-tests.trx`) into the pull request.
4. **Name the slot 2 integrator.** The integrator merges into
   `rebuild/dotnet-platform` and re-runs the suites after the merge.
5. **Schedule `ADM-07b`** (Minor 1, `/index`).
6. **Locate `.github/pull_request_template.md`,** or record that it is missing.
7. The tester's detached worktree `/home/user/dh-test-adm07` is still present. Its
   owner removes it.

## Draft pull request description

```markdown
## What and why

ADM-07 (Major, G3-1): a manual redirect could take over a live page, loop, or point
at an address with no page (`docs/quality/admin-audit-2026-10-28.md`). ADM-02 (#54)
closed the first two. This closes the third, with the audit's fix: "a target check
that warns in the Studio and reports in the build". It also fixes the two Minors that
ADM-02's gate 2 sent here, F-1 (concurrent creates) and F-2 (ended vacancies).

- The API says, on create and on every list row, whether a published page answers at
  a redirect's target (`targetLive`). It uses the build's own rule: the items the
  build writes, ended vacancies included, plus `/privacy-careers`. The error pages,
  `.html` spellings, other letter cases and media do not count.
- The Studio's Redirects screen marks such rows "No page". After such a create it
  shows a warning instead of "Redirect created.".
- The website build prints a "Redirect targets" report. It does not fail.
- Deleting or renaming an item now finds redirects to its address written with a
  trailing slash.
- Redirect creates hold one application lock (`sp_getapplock`, transaction-owned,
  5 s), so their checks and insert are one unit.
- A redirect from an ended vacancy's page is refused, at create and at import.

## Scope and boundaries

- API: `RedirectTargets.cs` (new), `AdminStore.cs`, `ContentStore.cs`, and
  `BuildContentStore.cs` (`ErrorSlugs` made `internal`).
- Studio: `RedirectsPage.tsx`.
- Website: `scripts/check-output.ts`.
- Tests: `RedirectTargetTests.cs`, `RedirectConcurrencyTests.cs`,
  `RedirectTargetRuleTests.cs`, `website/test/redirect-targets.test.ts`,
  `studio/test/redirects.test.tsx`, `studio/e2e/redirects.spec.ts`.
- There is no migration, lockfile, package, `*.csproj` or workflow change, and no
  route or policy change.
- Out of scope:
  - readable refusal messages in the modal (ADM-14);
  - a warning at unpublish (ADM-14, ADM-20);
  - the rename and manual-create loop race (plan section 10);
  - the IIS-level proof that every redirect answers 200 (Phase D).
- Phase C 10.7 and BA 530 ("every redirect resolves"): **partly** met. The build
  reports a target with no page and does not fail on it (B3). The IIS-level check
  moves to Phase D.

## Security impact

- **Routes and authorisation:** no route, policy or host rule changed.
- **Data exposed:** `targetLive` adds one boolean per row, for Studio users only.
- **The lock's SQL:** a constant with a typed output parameter, so no input reaches
  it. It needs only `public`. CI proves it under the restricted `dh_content_app`
  login.
- **Availability:** a create that waits more than 5 s for the lock gets
  `503 redirect_busy`. The lock is released when the transaction commits, rolls back,
  or the connection closes.
- **Dependencies:** none changed.
- **Security workflow:** green (43023252495).

## Tests and evidence

- **Red first.** The tests-only commit `6c842ae` was pushed alone. CI run 43022439824:
  - `api` 130528683245: `Total tests: 539, Passed: 520, Failed: 19`. All 19 new cases
    fail for the planned reason. T7 shows "A create failed on the server: 201 … | 500 …"
    for the same spelling, and "Expected exactly one 201: 201 … | 201 …" for mixed
    spellings. T10 shows "Expected 503 while the lock is held: 201 …".
  - `website` 130528683736: W1 to W4 only.
  - `studio` 130528683592: unit tests 91 of 91. End-to-end: 1 failed (E1, at its step 3
    warning, `redirects.spec.ts:71`) and 30 passed.
  - S1 and S2 (`1a82b34`) were red locally: `2 failed | 1 passed (3)`.
- **Green on `429c9d0`:**
  - CI run 43023252697: `api` 130531438897 `Total tests: 540, Passed: 540` (T10 5 s);
    `studio` 130531438484 (unit 94 of 94, end-to-end 31 passed, E1 included); `website`
    130531439091 ("Redirect targets: all 0 resolve to a page."); `website-browser`
    130531438812; `section-compare` 130531795615.
  - Security 43023252495 and Workflow lint 43023252546 green.
  - `paging.spec.ts`'s 51-redirect test took 6.6 s before and 6.0 s after.
- **Final head:** <run id, to fill>.
- **Records:** `docs/changes/ADM-07/` (plan, two reviews, two gates, implementation,
  test report).

## Owner decisions

- O-ADM07-1, "Yes, red tests first" (11 November 2026, project thread).
- O-ADM07-2, "Yes, refuse it" (11 November 2026, project thread): a redirect from an
  ended vacancy's page is refused. To send a closed role's address elsewhere, staff
  delete the ended vacancy first, then add the redirect. That route is the plan's
  reading of the design, not the owner's words.
- **Behaviour changes for the owner to confirm at merge:**
  - **B1:** a redirect to an address with no published page is still created (201),
    and the response and the list say `targetLive: false`.
  - **B2:** the Studio marks such rows "No page", and warns after such a create. Rows
    become marked after an unpublish or a delete too.
  - **B3:** the website build reports redirects with no page, and **does not fail**.
    Say so if the build should stop instead. One unpublish would then stop every
    build until the redirect is removed.
  - **B4:** delete and rename now also handle redirects to the item's address written
    with a trailing slash.
  - **B5:** redirect creates run one at a time. Two at once for one address give one
    201 and one `409 redirect_exists`. A create that waits more than 5 s gets
    `503 redirect_busy`, "Another redirect is being saved. Try again.".
  - **B6:** a redirect from an ended vacancy's address, with or without a trailing
    slash, is refused (`400 redirect_live_path`), and so is such a row in a bundle
    import.
- The owner's read-only check of `DigitalHubContent_Studio` found 0 redirects, so no
  existing rows need fixing.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (CI run 43023252697)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; every security fix has a regression test (changed-line coverage is not gated yet, GAP-18)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (owner review at merge)
- [x] Rollback is understood (revert; commits 3 to 7 revert separately; no schema or data change)
- [ ] Deployment note: integrator <name> merges into rebuild/dotnet-platform and re-runs the suites after the merge

## Review findings accepted

- **Tester Minor 1:**
  - The Studio marks a redirect to `/index` "No page", while the build counts
    `index.html`. Both sides only report, so nothing fails.
  - Moved to follow-up `ADM-07b`.
- **Tester Minor 2:**
  - T8's per-round timings are only in the TRX artifact.
  - The console shows T8 passing in 265 ms for all five rounds, and T10 in 5 s.
- **Gate 2 ratified K2 landing in commit 5 instead of 4.** It is a change of commit
  order only.

## Governance

- [x] Coverage table updated (`docs/changes/ADM-07/implementation.md`)
- [x] `docs/deferred-items.md`: not needed, no exception taken
- [x] Documentation updated

## Open items

- CI green on the final head.
- The owner's merge confirmation, not before 12 November (slot 2 cadence).
- The slot 2 integrator to be named.
- `ADM-07b` (`/index`) to be scheduled.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
