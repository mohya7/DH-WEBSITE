# ADM-05: delivery approval (gate 2)

Technical lead, gate 2, 19 November 2026.

- **Pull request:** #59, `change/ADM-05` into `rebuild/dotnet-platform`, draft
  (`gh pr view 59`: `headRefOid 36b19228…`, `isDraft true`).
- **Head:** `36b1922`, the merge of base `793c43e` (#62 ADM-07c, #64 GAP-34, #63
  standards) into the developer's `741d70c`. `git rev-parse HEAD origin/change/ADM-05`:
  both `36b19228…`. Base `origin/rebuild/dotnet-platform` = `793c43e` after `git fetch`;
  `git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD`: exit 0.
- **Working copy:** `D:\work\DigitalHub\dh-platform-claude-adm-05`. Uncommitted:
  `test-report.md` (Round 2) and this file.
- **Records read:** `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
  `.claude/commands/change.md`, `.github/pull_request_template.md`,
  `docs/quality/refinement-plan-2026-10-28.md` (lines 21, 26, 96, 225),
  `docs/changes/ADM-05/plan.md` (round 2), `plan-review.md` (Round 2, APPROVED),
  `plan-approval.md` (APPROVED, ten conditions), `implementation.md` (rework round 1,
  READY FOR TEST), `test-report.md` (Round 2, APPROVED). For format and GAP-34b:
  `docs/changes/ADM-10/delivery-approval.md`, `docs/changes/GAP-34/delivery-approval.md`.

This approval is a pipeline role. It is not the owner's confirmation under `AGENTS.md`,
it answers no owner question, and it does not accept B1 to B9 for the owner.

## The owner's request and decisions

**The request, as `plan.md` section 1 quotes it** (audit
`docs/quality/admin-audit-2026-10-28.md`, lines 118-131):

> **ADM-05: the 404 and 500 pages cannot be published from their screen, and the
> website build needs them published.** ... Fix: Route saves through the draft and
> publish flow. Add Publish and state to the screen. Decision O-16 on the
> meta-description rule for noindex pages.

**The owner's words,** as the coordinator relayed them (`implementation.md` section 1;
nobody in the pipeline saw the cards directly):

| Question | Owner's words | Date and where |
| --- | --- | --- |
| O-ADM05-1 (O-16) | "Yes, only 404 and 500" (option (a)) | 12 November 2026, 11:56 UTC, card tap |
| O-ADM05-2 | "Yes, red tests first" | 12 November 2026, 11:56 UTC, card tap |
| Resume after the CI billing block | "continue" | 19 November 2026, owner's instruction to the pipeline |
| O-ADM05-3 | PENDING, not yet asked | (see Open items) |

`plan.md` section 9 still says PENDING for O-ADM05-1 and O-ADM05-2. That is expected (the
developer does not edit the plan); `implementation.md` and the PR body carry the quotes.
The red run on PR #57 was created at 11:57:42 UTC, after the answers.

## Decision

**Approved, with the open items below.** The diff is the approved plan under O-ADM05-1
(a). The tests-only commits come before every fix, and CI shows exactly the planned red
set on the tests-only commit and every job green on the head. The base merge touches no
ADM-05 file. The tester's one new Minor is accepted with a named follow-up (reasons
below); it is not a reason to spend a return.

**The tester's rewording of Round 1's closing line is accepted.** `git diff` of
`test-report.md` shows one deleted line (`Verdict: BLOCKED ON OWNER`) replaced by
`Round 1 result: BLOCKED ON OWNER (...)`, and Round 2 appended. That keeps exactly one
verdict line at the end of the file (`docs/changes/README.md`, "Verdict lines"), loses
no content, and follows the precedent in `ADM-03`, `ADM-06b`, `GAP-04`, `GAP-06` and
`GAP-08` test reports and this change's own `plan-review.md:241`.

## What I verified myself

### Scope, commits, red first

| Check | Command | Result |
| --- | --- | --- |
| Scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 13 files: `AdminStore.cs` (-107), `ContentStore.cs` (+124), `PublishChecks.cs`, `AdminControllers.cs`, `ErrorPagePublishTests.cs`, `studio/e2e/error-pages.spec.ts`, `ErrorPagesPage.tsx`, `studio/test/errorPages.test.tsx`, five ADM-05 records. Exactly plan section 4 plus records |
| Nothing out of scope | `git diff --name-only origin/rebuild/dotnet-platform...HEAD -- '*package-lock.json' '*.csproj' .github/ website/ '**/Migrations/**'` | empty: no lockfile, package, workflow, `website/` or migration (condition 2) |
| Contract test untouched | `git diff --quiet origin/rebuild/dotnet-platform...HEAD -- api/tests/DigitalHub.Api.Tests/AdminApiTests.cs` | exit 0 |
| Source diff read in full | `git diff ...HEAD -- ContentStore.cs PublishChecks.cs AdminControllers.cs` | `ContentStore`: only new members (`ListErrorPagesAsync`, `SaveErrorPageAsync`, `EmptyDoc`, `ErrorPageIdAsync`, `ErrorPageMissing`, `PresentErrorPage`); `MutateAsync` and every existing method unchanged. `PublishChecks`: `IsErrorPage` = `collection == "pages" && BuildContentStore.ErrorSlugs.ContainsValue(slug)`, keyed on slug, not `noIndex` (condition 4). Controller: store type and one method name; route and `[Authorize(Policy = "studio")]` unchanged |
| Red commits before fixes (B-6, P-4) | `git log --graph --oneline`; `git show --name-only` per commit | `63c15dc` (T1-T11, E1) and `d35fdd8` (S1-S7) before `71edc31`, `a3a94d7`, `e8dc356`. Rework: `2670e8c` before `f067d95`, `3a69005` before `1d9778b`; `14f4b48` (T13) is a guard after the fix, as declared. Every test commit touches test files only |
| ADM-10 merged before commit 3 (condition 1) | `git merge-base --is-ancestor 2bbd586 HEAD` | exit 0; `0b3ef34` is a merge, then `71edc31` |
| B-4 trailers | `git log --no-merges --format='%h\|%(trailers:key=Co-Authored-By,…)\|%(trailers:key=Claude-Session,…)' 32f0414..741d70c` | every ADM-05 commit has `ADM-05:` and both trailers. The coordinator's merge `36b1922` has no `ADM-05:` prefix, no body and no trailer (observation; the squash replaces it) |

### Base merge `36b1922` touches none of ADM-05's files

| Check | Command | Result |
| --- | --- | --- |
| Parents | `git show --format='%H %P' 36b1922` | `741d70c` and `793c43e` |
| Files the merge brings in | `git diff --name-only 741d70c 36b1922` | 27 files |
| Overlap with ADM-05's files | `comm -12` of that list and `git diff --name-only 2bbd586 741d70c` | empty |
| ADM-05's files unchanged | `git diff --quiet 741d70c 36b1922 -- <ADM-05's files>` | exit 0 |
| Base's files are the base | `git diff --quiet 793c43e 36b1922 -- <the 27 files>` | exit 0 |

### CI, from job logs I downloaded (`gh api --allow-escape-sequences …/jobs/<id>/logs`)

**Red, CI `43213617726` on `63c15dc` (PR #57; tests merge ref `087f93b`, attempt 3):**

- Job `api` `131290463138`: `13 Warning(s)`, `0 Error(s)`; `Total tests: 551`,
  `Passed: 543`, `Failed: 8`. The eight `Failed` lines are exactly T1
  (`A_save_on_a_published_error_page_does_not_reach_the_build`), T2
  (`The_list_shows_the_draft_and_its_state`), T3 (`An_editor_publishes_a_saved_error_page_draft`),
  T4 (`A_published_error_page_goes_live_only_at_publish`), T5
  (`An_error_page_save_refuses_an_image_not_in_the_library`), T6
  (`An_error_page_save_keeps_the_section_s_other_fields`), T7
  (`An_error_page_save_is_audited_as_a_page_save`) and T9
  (`A_save_on_a_draft_error_page_stays_out_of_the_build`). Guards T8, T10 and T11 have
  `Passed` lines. This is plan 5.4's red set.
- Job `studio` `131290462489`: unit `Test Files 12 passed (12)`; end-to-end
  `✘ 4 e2e/error-pages.spec.ts:37:1 › ADM-05 error pages …` with `Error: publish
  error-404 at set-up: {… "errors":{"metaDescription":[…` (step 1, as planned under
  (a)), plus `✘ 9 e2e/redirects.spec.ts:37:1 › ADM-07 redirects …` (the ADM-07 flake
  fixed by #62); `2 failed`, `30 passed`.
- Job `website` `131290463027`: success.

**Green, on `36b1922`:** CI `44413974942`, Security `44413974926`, Workflow lint
`44413974837`, CodeQL `44413974795`, all `pull_request`, all `success`.

- Job `api` `135189246143`: `13 Warning(s)`, `0 Error(s)`; `Test Run Successful.`,
  `Total tests: 557`, `Passed: 557`, zero `Failed DigitalHub` lines. `Passed` lines for
  T1-T11, T13 and `AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them`.
- Job `studio` `135189245689`: unit `Test Files 14 passed (14)`, `Tests 109 passed
  (109)`, `test/errorPages.test.tsx (11 tests)`; end-to-end `✓ 4 e2e/error-pages.spec.ts:37:1
  › ADM-05 error pages: save is a draft, publish puts it live (3.9s)`, `✓ 9
  e2e/redirects.spec.ts`, `33 passed (3.6m)`.
- `website` `135189246321`, `website-browser` `135189246067`, `section-compare`
  `135189895334`: success; `screenshot-parity` skipped (no label).
- Security jobs: gate self-test, NuGet, gitleaks (history and PR), Semgrep, npm audit
  (studio, website): all success. Workflow lint: `actionlint (every workflow)` success.
  CodeQL `csharp` and `javascript-typescript`: success.

**A run the test report does not mention.** `gh api "…/actions/runs?branch=change/ADM-05"`
also lists CI `43249537203` on `741d70c` (12 November, failure). Its `api` job
`131291245875` passed 557 of 557, and its `studio` job `131291246385` had `✓ 4
e2e/error-pages.spec.ts` and one failure, `✘ 9 e2e/redirects.spec.ts:37:1` (the ADM-07
flake, before #62 was on the base). It is not the final head and it changes nothing
here, but it is a red run on this branch, so it belongs in the evidence. The tester
should add it to the report when the records are committed (Open item 6).

### Re-run here (the fastest suite that covers the change)

`git archive 36b1922 studio website packages` into my scratch folder (nothing written in
the working copy), then from `studio/`:

| Command | Exit | Output |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | 0 | `added 245 packages in 12s` |
| `npx tsc -b` | 0 | no output |
| `npx vitest run test/errorPages.test.tsx --reporter=verbose` | 0 | all 11 `✓` (S1-S7, S9-S12), `Tests 11 passed (11)` |
| `npm test` | 0 | `Test Files 14 passed (14)`, `Tests 109 passed (109)` |

The API and end-to-end suites were not re-run here: no local database work is allowed
this round. CI jobs `api` and `studio` above cover them.

### The tester's evidence

Every CI number in Round 2 that I checked against the logs is right: 551/543/8 and the
eight names; 557/557; 109 tests; E1 `✘` then `✓`; 33 passed; job and run ids. The
merge-isolation table matches my own commands. The finding's cause (`ErrorPagesPage.tsx:68`
keeps only cards that are dirty when the reload answers; `:103` clears dirty on a
successful Save) is in the code as described. The one gap is the unmentioned run on
`741d70c` above.

## Gate 1 conditions

| # | Condition | State |
| --- | --- | --- |
| 1 | Base, ADM-10 merged (merge, not rebase), ancestry quoted, suites re-run after the merge | Met, with one gap accepted: after `0b3ef34` only the Studio suite was re-run locally (same 7 reds). The API and E2E reds were taken in CI on the pre-merge commit, the merged ADM-10 diff touches no ADM-05 member, and the final head is green |
| 2 | Scope | Met (scope table) |
| 3 | O-ADM05-2: commit 1 alone first, wait for `api`, `website`, `studio` | Met in substance, deviated in order. Commit 1 alone ran on PR #57. But `d35fdd8` and later the fixes were pushed to `change/ADM-05` before the red run, and the `741d70c` run started 15:35:58Z while the red `api` and `studio` jobs ran until 15:37:32Z and 15:40:04Z. The wait was there to stop `cancel-in-progress` cutting the red run; the two runs were on different PRs, and the red run finished every job. No evidence was lost. Recorded, not a finding |
| 4 | O-ADM05-1 before commit 5; (a) keyed on `pages` and the two slugs; T8 `noIndex: true` | Met; T13 now pins the `pages` half |
| 5 | Sent-flag pattern, only under (c) | Not applicable |
| 6 | Tests, helper restores, no audit deletes, no elevated connection, Release, test catalogs only | Met by reading and by CI (`api` Release, `DigitalHubContent_Test`; `studio` fresh `DigitalHubContent_E2e`) |
| 7 | ADM-04 held off `AdminStore.cs` and `AdminControllers.cs` | Met: `gh api …/pulls/58/files` lists `UserAccessStore.cs`, `UserAccessController.cs`, `TemporaryPassword.cs`, `Program.cs`, tests, `UsersPage.tsx` and records; neither file, and no ADM-05 file |
| 8 | Commit subjects and trailers | Met |
| 9 | PR body: B1-B9, the O-ADM05-1 answer, the rollback step, the slug-rename finding | In the draft below |
| 10 | No approval while O-ADM05-1 or O-ADM05-2 is open or T3, T4, E1 not green on the final head | Both answered; T3, T4 and E1 green on `36b1922`. Re-check on the records commit (Open item 1) |

## Decisions on the tester's findings and observations

### The new Minor (reload undoes another card's Save on screen): accepted, with a follow-up

Not sent back. Reasons:

1. **No harm beyond a misleading message.** The server keeps the first Save as a draft,
   and the version check refuses the stale second Save (409). That is P-5 working: the
   screen is wrong, the data is not. Nothing goes live and nothing is lost.
2. **It needs out-of-order answers in a narrow window.** The 404 Save must be sent and
   answered while the 500 card's post-Publish `GET` is in flight, and the `GET` must
   have read the list before the Save committed. Recovery is a reload of the screen.
3. **The return budget.** `change.md` stops the pipeline after the second failure, and
   GAP-34's gate 2 settled that the stricter count applies. Round 1's rework already
   went back to the developer. Spending what may be the last return on a cosmetic
   race, with G3-1 already past 16 November and ADM-04 (#58) queued behind ADM-05 in
   slot 2, is the wrong trade.
4. **The fix is small and contained to one file,** so it is a good separate change.

**Follow-up: `adm05-reload-order`** (one `studio/` change, on `ErrorPagesPage.tsx` and
`errorPages.test.tsx` only, after ADM-05 merges):

- `load()` keeps the card's current item when its `version` is higher than the loaded
  one (or ignores a reload answer older than the card's last successful Save), with a
  red-first unit test built from probe P8.
- Also take P9 (text typed during an in-flight Save is replaced by the answer): base
  behaviour, but the same lines.

This is a tester finding on new code, not an audit Minor, so the G3 "D-NNN" rule does not
apply. It is listed under "Review findings accepted" in the PR body, so the owner sees it
before the merge. If the owner wants it fixed in ADM-05, the change goes back to the
developer, and that is the owner's call.

### Observations

| Observation | Blocks gate 2? | Where it goes |
| --- | --- | --- |
| `next 16.2.0 - 16.4.4` moderate advisories (GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8) in `website/`; one local build stopped once with Next.js `SecurityFatalError` and passed on re-run | No. Below the gate's level (CI `npm audit (website)` success); ADM-05 changes no lockfile and no `website/` file; CI `website` builds cleanly | Track G1 (O-1's upgrade target, 16.4.3, is now inside the affected range). The coordinator raises it as its own change; the `SecurityFatalError` stop is worth a look there, since it could fail a website build |
| GAP-25: unknown fields ignored, no per-route body cap on `PUT /api/v1/error-pages/{type}` | No. Older than this change and shared by every content route | GAP-25, Wave 3, as tracked |
| P9: text typed during a Save is replaced by the saved answer | No. Base behaviour (the base screen also replaces the card on success) | Folded into `adm05-reload-order` |
| O-ADM05-3: the owner publishes both pages in `DigitalHubContent_Studio` through the screen | No. Gate 1 placed it on the G3-1 exit gate only | **Must be asked now,** with the merge confirmation. Until it is answered and done (with O-ADM02-2), the G3-1 exit gate cannot be met |
| `section-compare`: `differs: /careers/apply.html #section` | No. Same lines on the base run at `793c43e`; no `website/` change | O-11 |
| The red run's `redirects.spec.ts` failure | No. ADM-07 flake fixed by #62; passes at the head | None |

### PR #57 (`change/ADM-05-red`, "do not merge")

**Yes, it can be closed now, without merging.** Its only job was the red run, and that
run is complete and quoted here by run and job id. The commit `63c15dc` stays reachable
in `change/ADM-05`. Closing it does not delete the runs. Two cautions:

- Keep the branch `change/ADM-05-red` until ADM-05 is squash-merged. Delete it afterwards
  with `change/ADM-05`.
- Actions logs expire under the repository's retention setting (90 days by default), so
  the quoted lines in `test-report.md` and here are the lasting record.

An agent may close it only with the owner's go-ahead or the coordinator's instruction.
Closing is not merging, but it is a change on the remote.

## Definition of Done (`.github/pull_request_template.md`), state at this gate

| Box | Can it be ticked truthfully now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | **Yes.** Audit ADM-05 Fix 1-3 and FR-S-21: T1, T4, E1 (draft flow); S1-S7, E1 (state and Publish); T3, T8, T13 (O-16 (a)); red then green. **Named as not provable here:** the G3-1 exit-gate build from `DigitalHubContent_Studio` needs the owner's publish there (O-ADM05-3) and O-ADM02-2 |
| Code follows the engineering standards | **Yes,** by reading. 13 build warnings at red and head, all in `ContentImport`. Lint and format gates (G-5, G-7) do not exist yet |
| No new prohibited constructs | **Yes.** Data access stays in `ContentStore` (A-11); the screen calls the API through `request` from `studio/src/api/http.ts` (A-12); no raw SQL, no new config reads |
| Every new or changed route has a guard and record scope | **Yes.** No route or policy added or changed. `PUT /api/v1/error-pages/{type}` keeps `studio`; publish keeps `[StudioAccess]`. T11 (HR 403 on all three) passed at red and head |
| Tests exist; changed-line coverage meets the gate; security fixes have a regression test | **Yes,** with the note that no coverage gate exists yet (G-8, step 4d). Every behaviour has a red-first test; T5 covers the library check |
| PR checks green on the final head (run ids quoted) | **Open.** Green on `36b1922` (CI `44413974942`, Security `44413974926`, Workflow lint `44413974837`, CodeQL `44413974795`). The records commit makes a new head, which needs green CI (B-3) |
| Independent code review run; findings fixed or accepted | **Yes.** Plan review rounds 1-2; test report rounds 1-2; round 1's three Minors fixed; round 2's Minor accepted below |
| Reviewed by someone other than the author | **Yes for the pipeline roles** (tester never built the change; gate 2 re-ran the Studio suite and read the CI logs). **Open:** the owner's review at merge |
| Rollback understood | **Yes.** Revert the PR; no schema change. Before or right after the revert, clear any "changed" error page through Pages (plan section 8) |
| Deployment note | **Yes, in GAP-34's terms** (the template's "integrator" wording is stale, GAP-34b): the owner squash-merges; no agent merges; nothing deploys before Phase D; CI, Security and Workflow lint run again on `rebuild/dotnet-platform` after the merge, and `/change` records those run ids. **Open after merge:** the post-merge runs |
| Governance: coverage table | **Yes,** `implementation.md` section 12 |
| Governance: `docs/deferred-items.md` | **Not needed.** No exception to a rule; the audit item is fixed in full |
| Governance: documentation | **Yes,** `docs/changes/ADM-05/` |

## Open items

1. **CI on the records head.** Commit `test-report.md` and this file (`ADM-05: Test report
   and approvals`, `change.md` step 8). That head needs CI, Security and Workflow lint
   green before the owner merges. Do not cancel a run in progress.
2. **The owner's confirmation,** including B1-B9 (the PR body lists them; B5 and B9 go
   beyond the audit's fix text, so a refusal sends the change back to step 1) and the
   accepted Minor. PR #59 stays draft until then.
3. **Slot 2 pacing.** ADM-07c (#62, G3) merged on 19 November at 00:19 +02:00. Slot 2
   takes at most one pull request a day (refinement plan line 21), so ADM-05 merges on
   20 November or later, unless the owner says otherwise. ADM-04 (#58) follows it.
4. **Ask O-ADM05-3 now.** It blocks only the G3-1 exit gate.
5. **Close PR #57** once the owner or coordinator agrees; keep its branch until ADM-05
   merges.
6. **Tester:** add CI `43249537203` on `741d70c` to `test-report.md` Round 2 as an
   observation when the records are committed. This is a missing fact, not a change to
   the verdict.
7. **Schedule `adm05-reload-order`** (P8 and P9).
8. **Raise the `next` advisories** as a G1 item.
9. **Coordinator:** add the slug-rename finding to the admin audit (plan section 4).
10. **Squash commit message:** `ADM-05: Publish the 404 and 500 pages from their screen
    (#59)`, a body that says why, and the attribution trailer (B-4). The merge commit
    `36b1922` has no body or trailer; the squash replaces it.

## Draft pull request description

```markdown
## What and why

ADM-05 (G3-1 Blocker; audit `docs/quality/admin-audit-2026-10-28.md` lines 118-131,
FR-S-21): the 404 and 500 pages could not be published from their screen, and an API
website build refuses to run until both are published (`website/src/content/prepare.ts:44-48`).
The screen also wrote straight onto the page record, so a Save on a published error page
went live at the next build without Publish, against "Save is not publish".

- Saves now go through the page draft flow (`ContentStore.MutateAsync`): a published page
  gets a working copy and changes on the website only at Publish.
- The Error pages screen shows each page's state, has Publish (the existing
  `POST /api/v1/pages/{id}/publish`), and lists what blocks a save or a publish.
- O-16 (a): the 404 and 500 pages need no meta description. Every other page keeps the
  rule.

Also closes the ADM-03 handover (library check on the error-page save) and the ADM-02
handover (error-page saves are no longer a separate write path).

## Scope and boundaries

In scope: `ContentStore.cs` (new members only), `AdminStore.cs` (error-page members
removed), `AdminControllers.cs` (`ErrorPagesController` takes `ContentStore`),
`PublishChecks.cs` (`IsErrorPage`), `studio/src/pages/ErrorPagesPage.tsx`; tests
`ErrorPagePublishTests.cs`, `studio/test/errorPages.test.tsx`,
`studio/e2e/error-pages.spec.ts`; records in `docs/changes/ADM-05/`.

Not touched: `website/` (the `prepare.ts` guard stays), `ItemEditorPage.tsx`,
`RichTextEditor.tsx`, `StatusChip.tsx`, `ContentImport`, any existing `ContentStore`
method, any workflow, lockfile, package or migration. `AdminApiTests` is unchanged and
passes.

Not added: Unpublish, Discard draft, revisions or preview on this screen.

## Security impact

- Routes and policies: none added or changed. `GET`/`PUT /api/v1/error-pages` keep
  `studio` (admin, editor); publish keeps `[StudioAccess]`. T11: HR gets 403 on all three.
- Data: stricter. A save no longer reaches the website without Publish. The save now
  refuses a media id that is not in the library (T5), and runs the page checks.
- Meta-description exemption: the two fixed slugs in collection `pages` only (T8, T13).
  Images, alt text, links and references are still checked.
- Logins, secrets, dependencies, configuration: none.

## Tests and evidence

Red first (tests-only commit `63c15dc`, PR #57), CI `43213617726`:
- `api` job `131290463138`: `Total tests: 551`, `Passed: 543`, `Failed: 8`: exactly T1-T7
  and T9, each at its planned assertion. Guards T8, T10, T11 passed.
- `studio` job `131290462489`: E1 failed at "publish error-404 at set-up" (400
  `metaDescription`). The other failure, `redirects.spec.ts`, is the ADM-07 flake fixed
  by #62.
- S1-S7 red locally at `d35fdd8`. S9-S12 red before their fixes (`2670e8c`, `3a69005`).

Green on `36b1922`: CI `44413974942`, Security `44413974926`, Workflow lint
`44413974837`, CodeQL `44413974795`.
- `api` `135189246143`: `13 Warning(s)`, `0 Error(s)`; `Total tests: 557`, `Passed: 557`.
- `studio` `135189245689`: unit `109 passed (109)`; end-to-end `33 passed`, E1 `✓`.
- `website`, `website-browser`, `section-compare` success. `section-compare` reports the
  base's known `/careers/apply.html` difference. `screenshot-parity` skipped (no label).

Records head `<sha>`: CI `<id>`, Security `<id>`, Workflow lint `<id>` (fill in).

Local (tester and gate 2): Studio `tsc -b` 0; `npm test` `109 passed`; Studio build design
check byte for byte; website typecheck, design check, snapshot build 0; npm, dotnet and
Semgrep gate scripts `0 new`.

NOT RUN locally: the API and end-to-end suites (no local database work this round). CI
`api` and `studio` cover them. Gitleaks: CI `security.yml` covers it.

## Owner decisions

- O-ADM05-1 (O-16): "Yes, only 404 and 500" (option (a)), 12 November 2026, 11:56 UTC,
  card, as relayed by the coordinator.
- O-ADM05-2: "Yes, red tests first", 12 November 2026, 11:56 UTC, card, as relayed.
- "continue", 19 November 2026: resume after the CI billing block.
- O-ADM05-3 (the owner publishes both pages in `DigitalHubContent_Studio` through the
  screen, counted as Studio use for the G3-1 exit gate): PENDING.

Behaviour changes, for the owner to accept or refuse at merge:
- B1: Save on a published 404 or 500 page saves a draft; the website keeps the published
  text until Publish.
- B2: `GET /api/v1/error-pages` shows the draft text and adds `status`, `state`,
  `hasWorkingCopy`, `publishedAt`, `notice`.
- B3: the save refuses an image not in the media library (400, `media`).
- B4: the save runs the page save's checks: `rich_text` schema, title of at most 300
  characters, and the redirect-source check on `/error-404` and `/error-500`.
- B5: the audit entry is `update_error_page` on entity type `page` with the page id. It
  was `error_page` with `404`/`500`.
- B6: the text section's `eyebrow` and `blocks` survive a save. They were wiped.
- B7: the screen has a status chip and Publish, and lists what blocks a save or publish.
  One Save or Publish at a time per card. A conflict names the page.
- B8: O-16 (a), no meta description needed for the two error pages only.
- B9: API refusal titles become the page save's: 409 "This item was changed by someone
  else.", 404 "That item does not exist.", 400 "One or more fields are invalid." with
  page-save field keys. The screen keeps its own 409 text.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such): the G3-1 exit-gate build from `DigitalHubContent_Studio` waits on O-ADM05-3 and O-ADM02-2
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed; T11)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (no coverage gate yet, G-8)
- [ ] PR checks are green on the final head (run IDs quoted): green on `36b1922`; records head pending
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed: pipeline review recorded; the owner's review at merge pending
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: the owner squash-merges into `rebuild/dotnet-platform`; no agent merges; nothing deploys before Phase D; CI, Security and Workflow lint run again on the base after the merge and their run ids are recorded

## Review findings accepted

- Test report Round 2, Minor 1: a reload started by one card's Publish can undo another
  card's successful Save on screen (`ErrorPagesPage.tsx:68`, `:103`). The next Save then
  shows a false "Someone else changed this page.". The server is right: the first Save is
  stored, and the version check refuses the stale one. It needs out-of-order answers in a
  narrow window, and a reload recovers. Follow-up: `adm05-reload-order` (with P9, text
  typed during a Save).
- Not ADM-05's: `next` moderate advisories (track G1); GAP-25 unknown fields and body cap
  (Wave 3).

Rollback for a stale working copy: before the revert, or right after it and before
anyone saves on the Error pages screen, open Pages. For `error-404` and `error-500`, if
the chip reads "changed", publish it or choose "Discard draft". Then check that neither
reads "changed" (plan section 8).

New finding for the audit (not fixed here): an error page's slug can be renamed through
Pages, after which the screen and the build lose the page.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (`docs/changes/ADM-05/implementation.md` section 12)
- [x] `docs/deferred-items.md` updated for any exception (none needed)
- [x] Documentation updated (`docs/changes/ADM-05/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
