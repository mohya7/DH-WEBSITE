# ADM-12c delivery approval (tech lead, gate 2)

## Round 1

Tech lead, 19 November 2026. Branch `change/ADM-12c`, worktree
`D:\work\DigitalHub\dh-platform-claude-adm-12c`, head
`67ecaa50c9b595e16ea956a52084cd4350f7f902`, merge base
`cdef7c90bf5546ecea891e9b12e2aec28d265716`. Track G3, batch G3-1.

Owner's request, as given to this pipeline run: "ADM-12c Refuse a decorative, blank-alt
asset as the default share image without an override".

Sources read: `docs/changes/README.md`, `CLAUDE.md` (the `AGENTS.md` copy),
`ENGINEERING_STANDARDS.md`, `.github/pull_request_template.md`, and every file in
`docs/changes/ADM-12c/`: `plan.md` (round 2), `plan-review.md` (Round 2,
`Verdict: APPROVED`), `plan-approval.md` (`Verdict: APPROVED`, conditions 1-11),
`implementation.md` and `test-report.md` (Round 1, `Verdict: APPROVED`, one Minor,
uncommitted).

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires, and it is not an owner decision under P-7. Nothing is pushed until the owner
confirms.

### Decision

**Changes needed: the tester's Minor 1 goes back to the developer.** Everything else in
the delivery is verified and would be approved as it stands. Round 2 is limited to the one
help text below, then the tester re-runs the Studio checks, then gate 2 again.

### Tester's Minor 1: ruling

The help text under "Default share image alt text" (`studio/src/pages/SettingsPage.tsx:170`)
says "Empty uses the page title." The save now refuses an empty override when the image has
no alt text in the library. So the hint is wrong in exactly the case this change refuses.

**Ruling: sent back to the developer, not made a follow-up.** The reasons:

- **It is part of this change's own result.** The plan's "Done when" includes "The Studio
  settings screen shows the refusal at the alt field". A hint on that field which says the
  refused input is fine works against that. It is a defect this change created, not an
  older gap found along the way.
- **The fix fits inside the approved plan.** `SettingsPage.tsx` is one of the six planned
  files, and the plan's Studio section is about this field. Changing one `extra` string
  needs no new design, so nothing goes back to the architect. ISO-1 F1 was accepted as a
  follow-up because fixing it would have reopened the plan. That is not the case here.
- **A follow-up costs more than the fix.** Under the G3 checklist (`docs/changes/README.md`),
  a Minor left unfixed becomes a D-NNN entry with an expiry. The fix is one line. Round 2
  needs no database: no API file changes, so `DigitalHubContent_Test`, which another agent
  is using now, is not needed.

**What round 2 must do (developer):**

1. Change only the `extra` text of the `defaultShareImageAltOverride` `Form.Item` at
   `SettingsPage.tsx:170`. No other line or file changes, except `implementation.md`.
2. The new text must tell the editor that an image with no alt text in the media library
   needs alt text here. It must not say the library alt is used on the website, because it
   is not: `website/src/seo/head.ts:90-93` uses the page's override, then this field, then
   the page title. "Empty uses the page title" is still true for an image that has library
   alt, so it may stay as the second case. A possible wording, which the developer may
   improve: "The alt text for the default share image, on pages that use it. Required when
   the image has no alt text in the media library; otherwise empty uses the page title."
3. One commit, subject starting `ADM-12c:`, imperative, a body that says why (test-report
   Round 1 Minor 1, this ruling), and the attribution trailer (B-4). Add a short round-2
   note to `implementation.md`.
4. No new test is required for a copy change. If the developer adds one assertion of the
   new text in `studio/test/settingsShareImage.test.tsx`, that is in scope.

**What round 2 must show (tester, Round 2 in `test-report.md`):** `git diff --stat 67ecaa5
<new head>` lists only `SettingsPage.tsx` (one line) and `implementation.md`. Then, from
`studio/`: `npx tsc -b`, `npm test`, and `VITE_PUBLIC_SITE_URL=https://website.ci.invalid
npm run build`, each with its exit code. The API suites do not need to run again, because
no API file changes. The Round 1 evidence stands for them.

### What I verified myself

| # | Check | Command | Exit | Result |
| --- | --- | --- | --- | --- |
| V1 | Base | `git fetch`; `git merge-base HEAD origin/rebuild/dotnet-platform`; `git log --oneline origin/rebuild/dotnet-platform -3` | 0 | Merge base `cdef7c9`. The base has moved: `71b7541` GAP-11 (#69) and `522b175` ISO-1 (#71) merged since the branch was cut (see "Base has moved") |
| V2 | Merge with the new base | `git merge-tree --write-tree HEAD origin/rebuild/dotnet-platform` | 0 | Clean, tree `4f7ac6c4...`. `git diff --name-only cdef7c9 origin/rebuild/dotnet-platform` shares no path with this change |
| V3 | Diff in scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 0 | 10 files: the six planned files (`AdminStore.cs` +22, `ContentBundle.cs` +10, `SettingsShareImageTests.cs`, `ContentBundleTests.cs`, `SettingsPage.tsx`, `settingsShareImage.test.tsx`) and four ADM-12c records. No PR #70 file, `PublishChecks.cs`, `ContentWriter.cs`, `AltText.cs`, `website/` or `.github/` file |
| V4 | Diff matches the plan | `git diff cdef7c9 HEAD -- api/src api/tools studio/src` | 0 | `DefaultShareImageAltError` uses `AltText.Effective`, not `IsPublishable` (condition 2). `UpdateSettingsAsync` checks "sent ? request : stored" for both fields, before `Validation(errors)` and before any write. The importer reads only `db.Media` (condition 3; the reason is in `implementation.md` and the code comment) and reports a problem, not a warning. The Studio filters keys through `form.getFieldsValue()`, keeps the title, and clears on the next save (condition 7) |
| V5 | Red tests first (B-6) | `git show --stat de1324c`; `git show --stat 29e84ec` | 0 | `de1324c` changes only the three test files. The fix `29e84ec` comes after it and changes only the three product files |
| V6 | Gate-1 conditions 4 and 5 in the tests | `grep -n "Assert.Equal(1, updated)\|NotEmpty(forced.Conflicts)"` in the two test files | 0 | `SettingsShareImageTests.cs:285` `Assert.Equal(1, updated)`; `ContentBundleTests.cs:460-462`, a forced import over the seeded target with `Assert.NotEmpty(forced.Conflicts)` |
| V7 | B-4 | `git log --format='%H%n%s%n%b' dad04a4..HEAD`; `git log -1 --format='%s%n%b' dad04a4` | 0 | All four subjects start `ADM-12c:` and are imperative. Each ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The three code and records commits have a body that says why. The plan commit `dad04a4` has only the trailer: accepted, because it adds only `plan.md` and the squash merge makes the PR title the subject |
| V8 | API build | `dotnet build DigitalHub.slnx -c Release` in `api/`, at `67ecaa5` | 0 | `13 Warning(s)`, `0 Error(s)`, the same count as the tester's and the developer's red and green builds |
| V9 | Studio typecheck | `npx tsc -b` in `studio/` | 0 | No output |
| V10 | Fastest covering suite, Studio | `npx vitest run` in `studio/` | 0 | `Test Files 15 passed (15)`, `Tests 117 passed (117)` |
| V11 | Open branches | `gh pr list --state open`; `git diff --name-only origin/rebuild/dotnet-platform...<branch>` for every `origin/change/*`, filtered to this change's six files | 0 | Open: #70 (`change/ADM-12`), #68 (`change/GAP-09`), #60 (`diag/redirects-e2e`). None touches the six files. The branches that do (ADM-02, ADM-05, ADM-07, ADM-10) are already squash-merged, as gate 1 found |
| V12 | Help text (Minor 1) | `sed -n 170p studio/src/pages/SettingsPage.tsx`; `sed -n 85-93p website/src/seo/head.ts` | 0 | The hint reads "... Empty uses the page title." The website's `imageAlt` is `own \|\| fallback \|\| documentTitle(item)`, so the library alt is never used for a share image |

**Not run by me:** the API integration suites (`SettingsShareImageTests`,
`ContentBundleTests`, the full 586). The caller said another agent is using
`DigitalHubContent_Test` now, and I did not open it. I rely on the tester's Round 1 runs
for them, which I checked against the code. No database was opened, no server or port was
used, no process was stopped, and I wrote no file except this one.

### The tester's evidence

It is real and agrees with my runs. Each check has a command, an exit code and the output
lines. The red run at `de1324c` shows 6 API failures, each for the reason the plan gives
(five `Expected: BadRequest Actual: OK`, one `Expected: False Actual: True`), and 1 Studio
failure (`Unable to find an element with the text: ...`). The head shows 586/586 API and
117/117 Studio. The tester also read `DigitalHubContent_Studio` read-only (condition 8): no
default share image is stored, and no media row has blank alt. So the every-save refusal
does not lock anyone out there today.

Every row of the test report's coverage table has evidence. "Page card images" is Moved, to
ADM-12d. "CI's commands green" is verified locally, with Playwright and CI run ids open
(below).

NOT RUN items and where each is covered:

- `npx playwright test`: the local harness is broken. CI job "Studio — typecheck, build,
  end-to-end", step "End-to-end suite"; `studio/e2e/settings.spec.ts` must stay green.
- gitleaks: not installed here. `security.yml` jobs `gitleaks-pr` and `gitleaks-history`.
- `npm run compare:sections`: it reads `DH-WEBSITE-main`, and no `website/` file changed.
  The CI Website job.

Tester's notes I accept as recorded, not as findings against ADM-12c:

- The stale Semgrep known-findings entry for `Catalog.cs:84` is older than this change. It
  is for whoever owns `known-findings.json`.
- Until PR #70 merges, the media library can still blank the alt of the asset the settings
  row uses. That is ADM-12's half of the gap.

One observation of my own, for the owner, not a finding: the rule accepts an empty override
when the image has library alt (`AltText.Effective`), but the website never shows library alt
for a share image (V12). It shows the page title instead. So "alt text of its own" means "the
save is allowed", not "this text is what ships". This is ADM-10's design and ADM-12 uses the
same rule. Changing it would be a behaviour change for the owner to request.

### Base has moved

`origin/rebuild/dotnet-platform` is now `522b175`, not `cdef7c9`. The caller will merge it
into `change/ADM-12c` before the push. The merge is clean (V2), and no merged file overlaps
this change. ISO-1 changed `api/src/DigitalHub.Api` (`Program.cs`, the csproj, the forms
code) and the solution file, so the API must be rebuilt after the merge.

Conditions after the merge, before the push:

- **M1.** `dotnet build DigitalHub.slnx -c Release` in `api/`, exit 0, and the warning count
  quoted (13 at `67ecaa5`; ISO-1's base was also 13).
- **M2.** When `DigitalHubContent_Test` is free, run
  `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests|FullyQualifiedName~ContentBundleTests"`.
  If the database is still busy, write it NOT RUN with that reason. CI's API job on the PR
  head is then the evidence.
- **M3.** From `studio/`: `npm test`, exit 0.
- **M4.** A merge conflict, or any red result, goes back to the developer. Nothing is fixed
  silently.

### Push conditions

- **P1. Owner confirmation.** The owner confirms the push in their own words. This approval
  is not that confirmation.
- **P2. Records commit.** Commit `test-report.md` and `delivery-approval.md` only. Suggested
  subject: `ADM-12c: Record the test report and delivery approval`. A body that says why, and
  the attribution trailer (B-4).
- **P3. Branch.** Push `change/ADM-12c` only. Open the PR against `rebuild/dotnet-platform`
  with the description below. No agent merges.

### Definition of Done: open items

Checked against `.github/pull_request_template.md`. Boxes that can be ticked truthfully after
round 2:

- Requirement and acceptance criteria stated and met: yes, once Minor 1 is fixed. Until then
  the alt field's hint contradicts the rule.
- Code follows the engineering standards: yes (V4).
- No new prohibited constructs: yes. Data access stays in `AdminStore` (Content layer) and in
  the import tool, which already reads `db`. No untyped values and no config or network reads.
- Every new or changed route has a guard: yes. No route is added. `PUT /api/v1/settings` keeps
  `studio-admin` (role matrix in the full suite, test report section 4). Settings is a
  singleton, so there is no record id.
- Tests exist; every security fix has a regression test: yes. Red first at `de1324c`.
  **Changed-line coverage: cannot be ticked as written.** G-8 is "Gap: step 4d"
  (`ENGINEERING_STANDARDS.md:61`), so there is no coverage gate to meet. The PR says so.
- Independent code review: yes. Plan review, tester, and this gate. No finding is left
  unaddressed after round 2.
- Reviewed by someone other than the author: yes, the approver's review is recorded here and
  the AI governance rules were followed.
- Rollback: yes. Revert the PR. There is no schema or data change.

Open, and cannot be ticked until they are true:

1. **Round 2 for Minor 1**: developer fix, tester Round 2, gate 2 Round 2.
2. **PR checks green on the final head, run ids quoted**: CI (including the Playwright
   "End-to-end suite"), Security (including `gitleaks-pr`) and Workflow lint. The final head
   is the head after the merge from `rebuild/dotnet-platform`.
3. **Post-merge local checks M1-M3** on the merged head.
4. **Deployment note**: nothing deploys until Phase D. The owner squash-merges, and CI,
   Security and Workflow lint run again on `rebuild/dotnet-platform` after the merge.
5. **Owner confirmation of the push (P1)**, and the owner's view on the two choices below.
6. **Governance, `AGENTS.md` coverage table**: ADM-12c is a follow-up of ADM-12. Whether its
   row is added here or with ADM-12 (PR #70) is the owner's call at the PR. `docs/deferred-items.md`
   needs no entry: nothing is deferred as an exception, because ADM-12d is a named follow-up
   that has its own owner request still to come.

### Draft pull request description

Superseded by the Round 2 draft below. Kept as the Round 1 record.

````markdown
## What and why

ADM-12c, a follow-up from ADM-12's gate 2 (PR #70, test-report Minor 1). Owner's request:
"ADM-12c Refuse a decorative, blank-alt asset as the default share image without an override".

ADM-12 refuses blanking an image's alt text while its uses rely on it. This closes the reverse
order: pointing the site's default share image at an image that has no alt text of its own
(blank library alt, decorative or not) and leaving the override blank. Both write paths for
site settings now refuse it:

- **Settings save** (`PUT /api/v1/settings`): 400 `validation_failed`, with a field error on
  `defaultShareImageAltOverride`: "This image has no alt text of its own. Add alt text for the
  default share image." Nothing is written. The check uses the values the save would store
  (the body's value when sent, the stored value when left out).
- **Content import** (`DigitalHub.ContentImport`): a blocking problem on the settings row, so
  nothing is imported.
- **Studio**: a refused settings save shows its field errors under the fields they name, and
  keeps the title. The alt field's help text now says when alt text is required.

The rule is `AltText.Effective`, the publish rule for page share images, in one shared method,
`AdminStore.DefaultShareImageAltError`. Page share images were already covered at publish
(`ContentPublishTests`).

## Scope and boundaries

In scope: `AdminStore.cs` (the new method and the check in `UpdateSettingsAsync`),
`ContentBundle.cs` (the settings loop in `CheckAsync`), `SettingsPage.tsx`, and their tests
(`SettingsShareImageTests.cs`, `ContentBundleTests.cs`, `settingsShareImage.test.tsx`).

Out of scope: PR #70's files (`MediaUsage.cs`, `MediaLibrary.cs`, `MediaLibraryPage.tsx` and
their tests), `PublishChecks.cs`, `ContentWriter.cs`, `AltText.cs`, `website/`, and other Studio
screens (ADM-14). No migration. No repair of stored data. The Studio database
(`DigitalHubContent_Studio`) has no default share image and no blank-alt media today (read-only
check).

This PR and #70 share no file, and either can merge first.

## Security impact

- `PUT /api/v1/settings`: same route, same `studio-admin` policy. One more 400 field error in
  the existing RFC 7807 shape, with no ids, paths or stack.
- Import tool: one more blocking problem. Access, login and `--force` rules unchanged.
- Data: one read-only media lookup on each path. Validation only gets stricter.
- Secrets, logins, dependencies: none.

## Tests and evidence

Red first: `de1324c` (tests only), then the fix `29e84ec`.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Red run, API (`de1324c`) | `dotnet test ... -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests\|FullyQualifiedName~ContentBundleTests"` | 1 | `Failed: 6, Passed: 40, Total: 46`: five `Expected: BadRequest Actual: OK`, one `Expected: False Actual: True` |
| Red run, Studio (`de1324c`) | `npx vitest run test/settingsShareImage.test.tsx` | 1 | `Tests 1 failed \| 4 passed (5)` |
| API build | `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |
| Full integration suite (`67ecaa5`) | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` | 0 | `Passed: 586, Total: 586` (base 576, plus 10) |
| Studio | `npx tsc -b`; `npm test`; `npm run build` | 0 | `Tests <n> passed (<n>)` (117 at `67ecaa5`); build matches `website/design/` |
| Website | `npm test`; `npm run typecheck`; snapshot build; `npm run design:check` | 0 | `461 passed \| 1 skipped`; `Build output checks passed.`; `All 25 files match` |
| Audits | `npm audit --audit-level=high` (Studio, website); npm, NuGet and Semgrep gates | 0 | 0 new findings |
| After merging `rebuild/dotnet-platform` | build; filtered API suites; Studio `npm test` | <exit> | <output> |
| End-to-end | `npx playwright test` | NOT RUN locally | The local harness is broken. CI "Studio — typecheck, build, end-to-end", run <id> |
| gitleaks | | NOT RUN locally | Not installed. Security `gitleaks-pr`, run <id> |
| CI / Security / Workflow lint on the final head | | | Run ids <id>, <id>, <id> |

Records: `docs/changes/ADM-12c/` (plan, plan review, gate 1, implementation, test report,
gate 2).

## Owner decisions

Request, 19 November 2026, given to the `/change` pipeline: "ADM-12c Refuse a decorative,
blank-alt asset as the default share image without an override".

No other owner decision has been given. The two choices below are open for the owner.

## Choices for the owner

These were made in the plan and approved by the tech lead. They are not owner decisions. The
owner may overrule either one here, before the merge.

1. **Every settings save is refused while a bad pair is stored.** If the settings row already
   points at an image with no alt text of its own and has a blank override (for example from an
   import before this change), every settings save is refused, even one that only changes the
   email. It stays refused until the override is filled in or the image is cleared. The error
   names the field to fix. The alternative is to refuse only a save that changes the share image
   or the override. That would leave an existing bad pair live with no signal to anyone.
   `DigitalHubContent_Studio` has no such pair today.
2. **The importer refuses such a bundle even with `--force`.** It is a blocking problem, like
   the tool's other safety checks, so `--force` does not bypass it. The fix is an override in the
   source before export.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test. Tests exist and were red first; there is no changed-line coverage gate yet (G-8, "Gap: step 4d"), so that part cannot be ticked
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: nothing deploys until Phase D. The owner squash-merges into `rebuild/dotnet-platform`, and CI, Security and Workflow lint run again there after the merge

## Review findings accepted

- Plan review Round 2, Minor 4: a hand-made bundle with an empty `settings` table, over a target
  settings row, is not checked. Every export carries the settings row. To assess under ADM-12d.
- Card-image alt check at publish (`PublishChecks.cs:93-100`) has no test: follow-up **ADM-12d**,
  "Test the card-image alt check at publish". It needs an owner request before it runs.
- Test report Round 1, Minor 1 (the alt field's help text): fixed in round 2.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (the owner's call: with this PR or with ADM-12, #70)
- [x] `docs/deferred-items.md` updated for any exception (none needed)
- [x] Documentation updated (`docs/changes/ADM-12c/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
````

Round 1 verdict: CHANGES NEEDED.

## Round 2

Tech lead, 19 November 2026. Head `55486bdd7bb60b726dddfdd1b02eb540c96c9fa1`
("ADM-12c: Say when the default share image alt text is required"). Read:
`implementation.md` Round 2 and `test-report.md` Round 2 (`Verdict: APPROVED`, no findings,
uncommitted).

### Decision

**Approved: the implementation and the tests can go to the owner.** Round 1 Minor 1 is fixed
within the bounds set in Round 1. Once the owner confirms, the records commit (P2), the merge
of the base and conditions M1-M4 come next, then the push (P3). This approval is not the
owner's confirmation of the push.

### What I verified myself

| # | Check | Command | Exit | Result |
| --- | --- | --- | --- | --- |
| R1 | Diff since Round 1 | `git diff --stat 67ecaa5 HEAD`; `git diff 67ecaa5 HEAD -- studio` | 0 | `implementation.md` (+41) and `SettingsPage.tsx` (one line, the `extra` string at line 170) only. No API, test, importer or other Studio file changed |
| R2 | Wording | Read the new line against `website/src/seo/head.ts:90-93` and `AdminStore.DefaultShareImageAltError` | n/a | "Required when the image has no alt text in the media library; otherwise empty uses the page title." The override is required exactly when `AltText.Effective` finds no library alt. Otherwise an empty override falls back to the page title on the site. The text does not claim that the library alt ships. It meets Round 1 requirement 2 |
| R3 | B-4 | `git log -1 --format='%H%n%s%n%b' HEAD` | 0 | The subject starts `ADM-12c:` and is imperative. The body says why and cites test-report Round 1 Minor 1 and the Round 1 ruling. It ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` |
| R4 | Studio typecheck | `npx tsc -b` in `studio/`, at `55486bd` | 0 | No output |
| R5 | Studio suite | `npx vitest run` in `studio/` | 0 | `Test Files 15 passed (15)`, `Tests 117 passed (117)` |
| R6 | Base, again | `git fetch`; `git rev-parse origin/rebuild/dotnet-platform`; `git merge-tree --write-tree HEAD origin/rebuild/dotnet-platform` | 0 | The base is `522b17549736...` (ISO-1, #71), unchanged since Round 1. The merge is clean, tree `27cfa5ff...` |
| R7 | Records untracked | `git status --short` | 0 | Only `test-report.md` and `delivery-approval.md` are untracked. Nothing is staged |

Not run by me: the API build and the integration suites. No API file changed after `67ecaa5`,
where I built the API (Round 1, V8). `DigitalHubContent_Test` is still in use by another
agent. The Round 1 API evidence stands. I opened no database, started no server and wrote no
file except this one.

### The tester's evidence

Round 2 is real and agrees with my runs. The tester quotes the diff, a grep showing that no
test or spec asserts the old text, `npm ci` exit 0, `tsc -b` exit 0, `npm test` 117/117 and the
Studio build exit 0. Playwright and the API suites are marked NOT RUN, with the reasons and the
CI jobs named. Every Round 2 coverage row has evidence. The earlier rows stand from Round 1,
because none of their files changed.

### Conditions carried from Round 1

Unchanged, and now on head `55486bd`:

- **P1.** The owner confirms the push in their own words before anything is pushed.
- **P2.** The records commit holds `test-report.md` and `delivery-approval.md` only. Suggested
  subject: `ADM-12c: Record the test report and delivery approval`, with a body and the trailer.
- **M1-M4**, after merging `origin/rebuild/dotnet-platform`:
  - M1: the Release build, with the warning count quoted.
  - M2: the filtered `SettingsShareImageTests|ContentBundleTests` run once
    `DigitalHubContent_Test` is free. Otherwise NOT RUN, with the CI API job as the evidence.
  - M3: Studio `npm test`.
  - M4: any conflict or red result goes back to the developer.
- **P3.** Push `change/ADM-12c` only, and open the PR against `rebuild/dotnet-platform`. No agent
  merges.

### Definition of Done: open items

Round 2 is done, so the requirement box can now be ticked. Still open:

1. PR checks green on the final head (the head after the base merge), with run ids: CI
   (including the Playwright "End-to-end suite"), Security (including `gitleaks-pr`) and
   Workflow lint.
2. M1-M3 on the merged head.
3. The owner's confirmation of the push (P1), and the owner's view on the two choices.
4. Deployment note: nothing deploys until Phase D. The owner squash-merges, and the suites run
   again on `rebuild/dotnet-platform` after the merge.
5. The changed-line coverage part of the tests box cannot be ticked. There is no coverage gate
   yet (G-8, "Gap: step 4d").
6. The `AGENTS.md` coverage row goes in with this PR or with ADM-12 (#70). That is the owner's
   call.

### Draft pull request description (Round 2)

Replace the `<...>` placeholders after the base merge and CI.

````markdown
## What and why

ADM-12c, a follow-up from ADM-12's gate 2 (PR #70, test-report Minor 1). Owner's request:
"ADM-12c Refuse a decorative, blank-alt asset as the default share image without an override".

ADM-12 refuses blanking an image's alt text while its uses rely on it. This change closes the
reverse order: pointing the site's default share image at an image that has no alt text of its
own (blank library alt, decorative or not) and leaving the override blank. Both write paths for
site settings now refuse it:

- **Settings save** (`PUT /api/v1/settings`): 400 `validation_failed`, with a field error on
  `defaultShareImageAltOverride`: "This image has no alt text of its own. Add alt text for the
  default share image." Nothing is written. The check uses the values the save would store
  (the body's value when sent, the stored value when left out).
- **Content import** (`DigitalHub.ContentImport`): a blocking problem on the settings row, so
  nothing is imported.
- **Studio**: a refused settings save shows its field errors under the fields they name, and
  keeps the title. The alt field's help text now reads: "The alt text for the default share
  image, on pages that use it. Required when the image has no alt text in the media library;
  otherwise empty uses the page title."

The rule is `AltText.Effective`, the publish rule for page share images, in one shared method,
`AdminStore.DefaultShareImageAltError`. Page share images were already covered at publish
(`ContentPublishTests`).

## Scope and boundaries

In scope: `AdminStore.cs` (the new method and the check in `UpdateSettingsAsync`),
`ContentBundle.cs` (the settings loop in `CheckAsync`), `SettingsPage.tsx`, and their tests
(`SettingsShareImageTests.cs`, `ContentBundleTests.cs`, `settingsShareImage.test.tsx`).

Out of scope: PR #70's files (`MediaUsage.cs`, `MediaLibrary.cs`, `MediaLibraryPage.tsx` and
their tests), `PublishChecks.cs`, `ContentWriter.cs`, `AltText.cs`, `website/`, and other Studio
screens (ADM-14). No migration. No repair of stored data. The Studio database
(`DigitalHubContent_Studio`) has no default share image and no blank-alt media today
(read-only check).

This PR and #70 share no file, and either can merge first. `rebuild/dotnet-platform`
(`522b175`, GAP-11 #69 and ISO-1 #71) is merged into this branch at <merge sha>.

## Security impact

- `PUT /api/v1/settings`: same route, same `studio-admin` policy. One more 400 field error in
  the existing RFC 7807 shape, with no ids, paths or stack.
- Import tool: one more blocking problem. Access, login and `--force` rules unchanged.
- Data: one read-only media lookup on each path. Validation only gets stricter.
- Secrets, logins, dependencies: none.

## Tests and evidence

Red tests first: `de1324c` (tests only), then the fix `29e84ec`. The help-text fix is `55486bd`.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Red run, API (`de1324c`) | `dotnet test ... -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests\|FullyQualifiedName~ContentBundleTests"` | 1 | `Failed: 6, Passed: 40, Total: 46`: five `Expected: BadRequest Actual: OK`, one `Expected: False Actual: True` |
| Red run, Studio (`de1324c`) | `npx vitest run test/settingsShareImage.test.tsx` | 1 | `Tests 1 failed \| 4 passed (5)` |
| API build (`67ecaa5`) | `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |
| Full integration suite (`67ecaa5`; no API file changed after it) | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` | 0 | `Passed: 586, Total: 586` (base 576, plus 10) |
| Studio (`55486bd`) | `npx tsc -b`; `npm test`; `npm run build` | 0 | `Tests 117 passed (117)`; the build matches `website/design/` byte for byte |
| Website (`67ecaa5`) | `npm test`; `npm run typecheck`; snapshot build; `npm run design:check` | 0 | `461 passed \| 1 skipped`; `Build output checks passed.`; `All 25 files match` |
| Audits | `npm audit --audit-level=high` (Studio, website); npm, NuGet and Semgrep gates | 0 | 0 new findings |
| After merging `rebuild/dotnet-platform` | build; filtered API suites; Studio `npm test` | <exit> | <output, or NOT RUN with the reason> |
| End-to-end | `npx playwright test` | NOT RUN locally | The local harness is broken. CI "Studio — typecheck, build, end-to-end", run <id> |
| gitleaks | | NOT RUN locally | Not installed. Security `gitleaks-pr`, run <id> |
| CI / Security / Workflow lint on the final head | | | Run ids <id>, <id>, <id> |

Records: `docs/changes/ADM-12c/` (plan, plan review, gate 1, implementation, test report
Rounds 1-2, gate 2 Rounds 1-2).

## Owner decisions

Request, 19 November 2026, given to the `/change` pipeline: "ADM-12c Refuse a decorative,
blank-alt asset as the default share image without an override".

The owner has given no other decision. The two choices below are open for the owner.

## Choices for the owner

The plan made these two choices and the tech lead approved them. They are not owner decisions.
The owner may overrule either one here, before the merge.

1. **Every settings save is refused while a bad pair is stored.** If the settings row already
   points at an image with no alt text of its own and has a blank override (for example from an
   import before this change), every settings save is refused, even one that only changes the
   email. Saves stay refused until the override is filled in or the image is cleared. The error
   names the field to fix. The alternative is to refuse only a save that changes the share image
   or the override, but that would leave an existing bad pair live with no signal to anyone.
   `DigitalHubContent_Studio` has no such pair today.
2. **The importer refuses such a bundle even with `--force`.** It is a blocking problem, like
   the tool's other safety checks, so `--force` does not bypass it. To import such content, add
   an override in the source before export.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test. Tests exist and were red first. There is no changed-line coverage gate yet (G-8, "Gap: step 4d"), so that part cannot be ticked
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: nothing deploys until Phase D. The owner squash-merges into `rebuild/dotnet-platform`, and CI, Security and Workflow lint run again there after the merge

## Review findings accepted

- Plan review Round 2, Minor 4: a hand-made bundle with an empty `settings` table, over a target
  settings row, is not checked. Every export carries the settings row. To assess under ADM-12d.
- The card-image alt check at publish (`PublishChecks.cs:93-100`) has no test. Follow-up
  **ADM-12d**, "Test the card-image alt check at publish", needs an owner request before it runs.
- Test report Round 1, Minor 1 (the alt field's help text): fixed in `55486bd`.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (the owner's call: with this PR or with ADM-12, #70)
- [x] `docs/deferred-items.md` updated for any exception (none needed)
- [x] Documentation updated (`docs/changes/ADM-12c/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
````

Verdict: APPROVED
