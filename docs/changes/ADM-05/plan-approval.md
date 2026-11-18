# ADM-05: plan approval (gate 1)

Technical lead, gate 1, 12 November 2026. Plan: `docs/changes/ADM-05/plan.md` at
`0857268` (round 2). Review: `plan-review.md`, Round 2 at `662a1e2`, `Verdict: APPROVED`,
with one new Minor. Branch `change/ADM-05`, head `662a1e2`, base
`origin/rebuild/dotnet-platform` `32f0414` (`git rev-parse origin/rebuild/dotnet-platform`
after `git fetch`). `git diff --stat 32f0414 HEAD` shows only `docs/changes/ADM-05/plan.md`
and `plan-review.md`.

This approval is a pipeline role. It is not the owner's confirmation under `AGENTS.md`,
and it does not answer O-ADM05-1 (O-16), O-ADM05-2 or O-ADM05-3.

Read: `CLAUDE.md` / `AGENTS.md`, `docs/changes/README.md`, the plan (all 12 sections),
both review rounds, and the refinement plan and audit from
`/mnt/attach/project-files/docs/quality/`: ADM-05 at audit lines 118-131, two merge slots
at refinement-plan line 21, G3-1 row at line 225, G3 rule at line 221. I also read
`docs/changes/ADM-10/plan-approval.md` on `origin/change/ADM-10` for precedent.
`ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` do not exist in the worktree or
in `/mnt/attach/project-files` (`find /` finds neither), as the plan and the reviewer
say. So the rule ids (P-6, P-7, P-8, B-4, B-6) are used here only as `docs/changes/README.md`
and the earlier ADM records use them. Nothing was built or tested here: there is no
`dotnet`, no SQL Server and no `node_modules`.

## Decision

The plan may go to the developer, under the conditions below. It is the right change:
ADM-05 is a G3-1 Blocker, the design reuses the existing draft flow (`MutateAsync`) and
the existing publish route instead of adding a second write path or a second publish
entry point, it keeps "Save is not publish" and `phase-b-studio.md` 3.4, and it weakens
no guard (`prepare.ts:44-48` stays). Gate 1 is not held on the owner questions. Delivery
(gate 2) is, as set out in "Owner decisions" below.

## What I checked myself

| Claim | Evidence (read at `32f0414`) | Holds |
| --- | --- | --- |
| The error-page save writes the record and ignores status | `AdminStore.cs:591-641`: version check and 409 "Someone else changed this page." (608-609), `page.Version += 1` (630), `section.Fields = JsonSerializer.Serialize(...)` (632), audit `("update_error_page", "error_page", type, ...)` (638). No `Status` or `WorkingCopies` reference in the method | Yes |
| The page save puts a published page's draft into a working copy | `ContentStore.cs:636-648`: `CheckAsync(..., publishing: false)`, then `if (loaded.Record.Status == ContentStatus.Published)` writes `copy.Document` | Yes |
| Publish asks the error pages for a meta description | `PublishChecks.cs:28-29`: `if (ContentPaths.PublicPath(collection, draft.Slug) is not null) AddDescription(draft, errors);` | Yes |
| The website build refuses unpublished error pages | `website/src/content/prepare.ts:44-48`, as quoted in the plan | Yes |
| `ErrorSlugs` usable from `ContentStore` | `BuildContentStore.cs:38`, `internal static readonly Dictionary<string, string> ErrorSlugs`, same assembly | Yes |
| The members to remove have no other caller | `grep -rn 'ErrorTypes\|PresentErrorPage\|UpdateErrorPageAsync\|ListErrorPagesAsync\|EmptyDoc' api --include=*.cs`, outside tests: only `AdminStore.cs` itself and `AdminControllers.cs:155,159` | Yes |
| The controller and the screen are as described | `AdminControllers.cs:148-165` (`[Authorize(Policy = "studio")]`, takes `AdminStore`); `ErrorPagesPage.tsx:70` is the only button, Save | Yes |
| ADM-10's sent-flag pattern exists for the reviewer's Minor | `git diff 32f0414 origin/change/ADM-10 -- AdminStore.cs`: `set { _defaultShareImageId = value; DefaultShareImageIdSent = true; }` and `internal bool DefaultShareImageIdSent { get; private set; }` in `SiteSettingsUpdate` | Yes |
| ADM-10 does not touch the error-page members | Same diff: hunks `@@ -242`, `@@ -281`, `@@ -823`, `@@ -1165` (settings save, settings validation, `SiteSettingsUpdate`). None in 573-641, 1022-1053, 1103 or `ErrorPageUpdate` | Yes |

## Order and conflicts

- **Execution order.** G3-1 runs in slot 2, 3 to 16 November, in the order "ADM-06, 03,
  02, 07, 10, 05, 04, 12, 01a" (refinement plan lines 26 and 225). ADM-06, 03, 02 and 07
  are in the base (`git log origin/rebuild/dotnet-platform`: #49, #52, #54, #55). ADM-10
  is next and ADM-05 follows it, which is the order the plan's 4.1 keeps. ADM-05 is a
  Blocker, so "Blockers before Majors" holds. The Wave 0 and ISO-4/ISO-5 constraints do
  not apply to G3.
- **Merge slots.** Slot 2 takes at most one pull request a day (line 21). ADM-10 holds it
  until it merges; ADM-05 cannot reach the integrator before then anyway, because commit
  3 waits on ADM-10's merge.
- **Open pull requests.** `gh api "repos/<owner>/<repo>/pulls?state=open"` (run by me)
  returns `56 change/ADM-10 04d0e80` and `44 change/GAP-07 c178cb3`. Their files, from
  `gh api repos/.../pulls/<n>/files`: #56 touches `AdminStore.cs`; #44 touches none of
  this plan's files. #44 is slot 1 (G1).
- **Remote branches.** For every `origin/*` branch I ran `git diff --name-only
  $(git merge-base <b> origin/rebuild/dotnet-platform) <b>` over this plan's eight files
  (five source, three new test files). Matches:
  - `change/ADM-10`: `AdminStore.cs`. In flight. Handled by 4.1.
  - `change/ADM-02`, `change/ADM-07`: already squash-merged as #54 and #55.
  - `phase-c/*` and `phase-d/content-bundle`: last commits 12 to 20 October, no open
    pull request. Not in flight.
  - `main`, `release/v1`, `feature/interviewer-portal*`: unrelated history (no merge
    base with `rebuild/dotnet-platform`), and never changed by this pipeline.
  - No branch touches `PublishChecks.cs`, `ErrorPagesPage.tsx` or the new test files on
    the rebuild line.
- **The shared-file rule.** "Parallel work must change different files" is kept by 4.1:
  only the test-only commits 1 and 2 (which touch neither `AdminStore.cs` nor
  `AdminControllers.cs`) come before ADM-10 merges; commit 3 is written only after a
  merge of a base containing ADM-10; ADM-04 is held off both files until ADM-05 merges.
  The ADM-04 hold is for the coordinator, and I make it a condition below.

## Owner decisions

All three are PENDING. None is quoted, and none is assumed. I checked the plan's
section 9 search: there is no owner answer to O-16 on record.

| Question | State | What it blocks |
| --- | --- | --- |
| O-ADM05-1 (O-16): the meta-description rule for the error pages, (a), (b) or (c) | Posted to the owner, unanswered | Commit 5 (and 5a under a late (c)), so delivery. Not gate 1, not commits 1 to 4 |
| O-ADM05-2: push the test-only commit first for the CI red | Posted to the owner, unanswered | Any push and any pull request; the "shown failing before the fix" row of the G3 checklist |
| O-ADM05-3: the owner publishes both pages in `DigitalHubContent_Studio` through the screen after merge, counted as Studio use | Not yet asked | Only the G3-1 batch exit gate. Not gate 1 or gate 2. It must be asked before the G3-1 exit-gate build |

The behaviour changes B1 to B9 (plan section 9) are not owner decisions in this approval.
B5 (audit entity type and id) and B9 (API refusal titles) go beyond the audit's fix text,
so they must be set out in the pull request body for the owner, and the owner's merge
confirmation is where they are accepted or refused. A refusal sends the change back to
step 1.

## Conditions for the developer

1. **Base and ADM-10.**
   - Before the first commit, `git fetch` and confirm `change/ADM-05` contains
     `origin/rebuild/dotnet-platform` at `32f0414`. If the base has moved for any reason
     other than ADM-10's merge, merge it and re-check that `UpdateErrorPageAsync`,
     `MutateAsync`, `PublishChecks.AddAsync` and `ErrorPagesPage.tsx` are as the plan
     describes; if not, stop and report.
   - Follow 4.1 exactly. Commits 1 and 2 may be written on `32f0414`. Commit 3 is not
     written until `origin/rebuild/dotnet-platform` contains the ADM-10 merge and that
     base has been merged (never rebased) into `change/ADM-05`. Quote `git log --oneline
     -3 origin/rebuild/dotnet-platform` and `git merge-base --is-ancestor <ADM-10 merge>
     HEAD` (exit 0) in `implementation.md`.
   - If ADM-10's head moves from `04d0e80` before it merges, re-run the file-overlap
     check against its new head and record it. If it now touches `AdminControllers.cs`,
     `ContentStore.cs`, `PublishChecks.cs` or `ErrorPagesPage.tsx`, stop and report.
   - Do not copy any of ADM-10's change into this branch.
   - After the merge and before commit 3, re-run the 5.3 suites and confirm the reds
     match commit 1's. Report any difference before going on.
2. **Scope.** Only the files in section 4. No change to `website/`, `ItemEditorPage.tsx`,
   `RichTextEditor.tsx`, `StatusChip.tsx`, `ContentImport`, any workflow, lockfile or
   package. No existing `ContentStore` method changes, `MutateAsync` included. No
   migration: if one seems needed, stop. `AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them`
   is not edited and must pass unchanged.
3. **O-ADM05-2 (push).** Until the owner's words are quoted in `implementation.md`, push
   nothing to `origin` and open no pull request. If "Yes": push commit 1 alone, wait for
   jobs `api`, `website` and `studio` to finish, record run and job ids and each failing
   assertion (T1 to T7, T9, and E1 at the step 5.4 names), then push the rest. If "No":
   the branch may be pushed whole, but gate 2 will be BLOCKED ON OWNER on the red-first
   row until the owner accepts in words that the database and end-to-end reds are not
   shown.
4. **O-ADM05-1 (commit 5).** Do not write commit 5 before the owner's answer is quoted.
   While commits are still unpushed, the developer may rebuild them once the answer
   arrives, so long as the history still has test-only commits before every fix and
   the pushed history matches 5.2. Under (a), the exemption is keyed on `collection ==
   "pages"` and the two `BuildContentStore.ErrorSlugs` values only; T8 uses a page with
   `noIndex: true`. Under (b), T8 uses `noIndex: false`. Under (c), see condition 5.
5. **The reviewer's Round 2 Minor, only if O-ADM05-1 is (c).**
   `ErrorPageUpdate.MetaDescription` uses ADM-10's sent-flag pattern: a private backing
   field, a setter that sets an `internal bool MetaDescriptionSent { get; private set; }`,
   and the save changes `draft.MetaDescription` only when it was sent. An explicit
   `null` or blank value clears it, as in ADM-10. T12 asserts both the missing-key case
   and the explicit-null case. If (c) arrives after commits 1 and 2, T12 and S8 go in
   their own test-only commit 5a and are shown red before commit 5.
6. **Tests.** T1 to T11, S1 to S7 and E1 as in 5.1, with T12 and S8 only under (c). The
   helper accepts any starting state and puts saved rows back in `finally`; it never
   deletes audit rows and never uses the elevated connection. E1's `finally` removes both
   pages so P2.12 sees an empty list. Release builds only; `DigitalHubContent_Test` and
   `DigitalHubContent_E2e` only, never `DigitalHubContent`; ports 42xx. Every command is
   quoted with its exit code and output; anything not run is NOT RUN with the CI job
   that covers it.
7. **ADM-04 hold (for the coordinator).** ADM-04 does not start on `AdminStore.cs` or
   `AdminControllers.cs` until ADM-05 merges, as 4.1 step 6 states.
8. **Commits.** Subjects as listed in 5.2 (`ADM-05: <imperative sentence>`), one topic
   each, with the attribution trailers the earlier ADM change commits carry. No commit
   to `rebuild/dotnet-platform`, `main`, `release/v1` or `feature/interviewer-portal`.
9. **Pull request body.** Lists B1 to B9, the O-ADM05-1 answer as quoted, the rollback
   step for a stale working copy (section 8), and the new finding about renaming an
   error page's slug through Pages, for the coordinator to add to the audit.
10. **Gate 2 will not approve** while O-ADM05-1 or O-ADM05-2 is unanswered, or while T3,
    T4 and E1 are not green on the final head in CI.

## Reviewer Minors I accept

- **Round 2, finding 1** (how a missing `metaDescription` key keeps the stored value
  under (c)). Accepted as left in the plan, because condition 5 names the mechanism and
  the explicit-null behaviour, and T12 would catch a mistake. It applies only under (c).
- **Round 1, findings 2 to 9.** All closed in round 2; I checked the plan text for each
  against the Round 2 table and agree.

## Risk

Acceptable. The change makes the save stricter and moves it onto the path every other
page uses. The main risk, two in-flight changes on `AdminStore.cs`, is handled by
ordering, not by line-level argument. The other residual risk is schedule: if ADM-10's
merge or O-ADM05-1 is late, ADM-05 misses 16 November. The plan stops cleanly at
commit 2 in that case, and nothing reaches the build by mistake, because Publish still
shows the meta-description problem until commit 5.

Verdict: APPROVED
