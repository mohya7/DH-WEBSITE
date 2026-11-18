# ADM-05: plan review

## Round 1

Reviewer: plan-reviewer (senior quality engineer and software architect), 12 November
2026. Reviewed `docs/changes/ADM-05/plan.md` at `76bf41f` on `change/ADM-05`. Every
claim was checked against the code at `32f0414` (`git diff 32f0414 76bf41f --stat`:
the plan is the only file changed).

Read: `CLAUDE.md` / `AGENTS.md`, `docs/changes/README.md`, the audit
(`/mnt/attach/project-files/docs/quality/admin-audit-2026-10-28.md`, ADM-05 at lines
118-131, FR-S-21 at line 46), the refinement plan (same folder; G3 row line 17, G3
rule line 221, G3-1 row line 225, success measure line 250, open decisions line
268), `docs/changes/ADM-03/implementation.md` section 11, `docs/changes/ADM-02/plan.md`
lines 64-66, 650-676 and 880, `docs/phase-b-studio.md` 3.4, line 124, 4.7, line 156
and 8.7, and the ADM-07 and ADM-10 plan approvals for precedent.
`ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` do not exist in the worktree
or in `/mnt/attach/project-files` (checked with `find /`), as the plan says. There is
no earlier round of this review.

Nothing was built or run: no `dotnet`, SQL Server or `node_modules` here. All checks
below are by reading the code with `git`, `grep` and `sed`.

### Findings, most severe first

**1. Major. Section 2.9 and Risks ("Conflict with ADM-10 or ADM-04"): the plan edits
files that another in-flight change edits, and argues it is fine because the lines
differ.**
- What is wrong: `AGENTS.md` says "Parallel work must change different files." The
  rule is about files, not hunks. The plan's own evidence shows the overlap:
  - `change/ADM-10` (`04d0e80`, gate 2 approved, not merged) changes
    `api/src/DigitalHub.Api/Content/AdminStore.cs` (`git diff 32f0414 04d0e80 --
    AdminStore.cs`: hunks `@@ -242`, `@@ -281`, `@@ -823`, `@@ -1165`). This plan
    removes four members from the same file.
  - ADM-04 is next in the batch and, by the audit's own text (lines 105-116), changes
    `UsersController` in `AdminControllers.cs` and its store in `AdminStore.cs`. This
    plan changes `ErrorPagesController` in `AdminControllers.cs` and `AdminStore.cs`.
  - Section 2.9 says "the two diffs do not touch the same lines" and 2.9's last
    bullet says "If ADM-10 merges first", which allows ADM-05 to merge before or
    alongside ADM-10. That is parallel work on one file.
- What would satisfy me: the plan states a sequence that keeps to the rule, for
  example: the developer writes the `AdminStore.cs` and `AdminControllers.cs` commit
  only on a base that already contains ADM-10's merge (or the change waits at that
  commit until it does), and ADM-04 does not start on those two files until ADM-05
  has merged (or the reverse order, named). If the tech lead prefers not to wait,
  the alternative is to leave `AdminStore.cs` untouched in this change (dead code
  removed by a named follow-up), so only `AdminControllers.cs` is shared, and then
  sequence that file with ADM-04. Either way the risk row must stop relying on
  "different lines".

**2. Minor. Section 5.1, the set-up and clean-up helper: "It also deletes ... audit
rows it can identify by entity id" cannot be done with the application login.**
- Evidence: `AuditLogPermissionTests.cs:44-48` asserts that a delete on
  `audit_log` through `ContentDbContext` throws `PermissionDenied`.
  `ListPagingTests.cs:176`: "The audit rows stay: the app login cannot delete from
  audit_log." `ContentApiTests.cs:597-603` deletes an audit row only through
  `ApiFactory.ElevatedTestConnectionString()`.
- Effect: a `finally` written as the plan reads, through the test's
  `ContentDbContext`, throws in every T test and hides the real assertion. This would
  surface only in CI (no SQL Server here), costing a red round.
- What would satisfy me: the helper either leaves audit rows (as `ListPagingTests`
  does) or deletes them through `ElevatedTestConnectionString()` (as
  `ContentApiTests` does), stated in the plan.

**3. Minor. Section 3.1, step 5: "The answer is the error-page shape (3.2), built from
the saved draft", with "No change to any existing method" (Scope).**
- Evidence: `MutateAsync` (`ContentStore.cs:612-662`) returns
  `ContentOutcome.Ok(Present(collection, loaded, draft))`, the Pages shape, and
  `loaded` (record status, `Copy`, `PublishedAt`, new `Version`) never leaves the
  method. The new answer needs `status`, `state`, `hasWorkingCopy`, `publishedAt`
  and `version`, which the closure over `draft` does not give.
- What would satisfy me: the plan names the mechanism, for example "after an `Ok`
  outcome, `LoadAsync("pages", id)` again and present from that", or, if a parameter
  is added to `MutateAsync`, it drops "No change to any existing method" and says so.

**4. Minor. Section 3.5 and B3/B4: the Save path gains new refusals but the screen
still shows only `problem.title`.**
- Evidence: `ErrorPagesPage.tsx:39-41` shows `result.problem?.title` on a failed save.
  After this change a save can be refused for a media id not in the library (T5), a
  redirect source, a title over 300 characters, or a draft-schema error. Each answers
  `validation_failed` with the title "One or more fields are invalid."
  (`ContentStore.cs:1238-1243`), so the user is not told which.
- What would satisfy me: either the same plain list of `problem.errors` used for
  Publish is shown for a failed Save, with a Studio test (an S7 on a 400 save), or
  the plan records this as left for ADM-14 (messages), by name.

**5. Minor. Section 9, B-list: two behaviour changes of the save are not listed.**
- The 409 title changes from "Someone else changed this page."
  (`AdminStore.cs:610`) to "This item was changed by someone else."
  (`ContentStore.cs:1218-1219`, `Conflict()`), and a missing page found between the
  slug lookup and `LoadAsync` answers "That item does not exist." The Studio uses its
  own 409 text, so the screen does not change, but the API answer does.
- A new text section is created with `SortOrder = 10` (3.1, step 3) where today it is
  `0` (`AdminStore.cs:617`).
- What would satisfy me: both added to B1-B8, or the plan says the 409 and 404
  titles are kept as today.

**6. Minor. Section 8, Rollback: the stale working-copy case is not handled.**
- After a revert, a published error page may hold a working copy written by this
  change. The old screen's Save then writes the record directly, and a later Publish
  through Pages copies the older working copy over it (`PublishAsync`,
  `ContentStore.cs:325-330`). The text the screen saved is lost.
- What would satisfy me: the rollback says to publish or discard any working copy on
  `error-404` and `error-500` (through Pages) before or right after the revert.

**7. Minor. Section 5.1, option (c): no test is named for the new field.**
- If the owner chooses (c), commit 5 adds `MetaDescription` to `ErrorPageUpdate`,
  the save and the screen, but S1-S6 and T1-T11 test none of it (only T3 and E1
  send it). Under (c) the screen's field, its round trip and the 500-character limit
  have no test.
- What would satisfy me: a conditional "(c) only" API test (save stores it, 501
  characters gives 400 on `metaDescription`) and a Studio test (the field is sent on
  Save).

**8. Minor. Section 2.8: "Each puts the error pages back as it found them" is not
true.**
- `AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them`
  (`AdminApiTests.cs:540-588`) deletes every `error-*` page and leaves its own seeded
  drafts behind, with new ids. `ContentPublishTests.ErrorPageAsync` keeps an existing
  page as it is. Only `BuildContentTests.PublishedErrorPageAsync` restores the status.
- The planned helper copes with any starting state, so no test is wrong. The
  sentence should be corrected so the Risks row "Other tests leave error pages in a
  different state" rests on the helper, not on the other classes.

**9. Minor. Small inconsistencies.**
- 5.5, second row: "T1 to T9 and E1 are red in CI at commit 1". T8 is green at the
  base (5.1 and 5.4 say so). It should read "T1 to T7, T9 and E1".
- 5.1, T2: "After T1's save". xUnit tests do not share state. T2 must do its own
  save; say so.
- 1, "Done when": the G3 track row is at refinement-plan line 17, not 15. The quoted
  words are correct.
- 3.1: `EmptyDoc` (`AdminStore.cs:1103`) is used only by the error-page code. The plan
  does not say whether it moves to `ContentStore` and is removed from `AdminStore`.

### Owner questions and gate 1

- **O-ADM05-1 (O-16).** I confirmed there is no answer: the chat export's only O-16
  line is the assistant's question (line 2116), the only later user message is
  "export all the chat here in md file" (2026-11-01 13:47 UTC), and the refinement
  plan (line 268) lists O-16 as open. `phase-b-studio.md` line 156 ("required only for
  an item with its own page") supports (a), but the audit names it as an owner
  decision, so asking is right. The plan does not assume an answer.
- **O-ADM05-2.** Correctly asked again. The ADM-07 and ADM-10 answers were given for
  those changes.
- **O-ADM05-3.** Correctly limited to the G3-1 batch exit gate, not to this change's
  gates.
- **Can gate 1 proceed with all three open? Yes, with conditions**, as ADM-10's gate 1
  did with O-ADM10-1 and O-ADM10-2 open (`docs/changes/ADM-10/plan-approval.md`
  lines 56-62). The plan already states them:
  - commits 1 to 4 may be written locally;
  - nothing is pushed and no pull request is opened until O-ADM05-2 is answered in
    the owner's words;
  - commit 5 is not written until O-ADM05-1 is answered;
  - gate 2 cannot approve while O-ADM05-1 or O-ADM05-2 is open, because T3, T4 and E1
    stay red without commit 5, and the CI red cannot be shown without the push.
  The plan is therefore not BLOCKED ON OWNER at gate 1. Delivery is.

### Checked and found sound

- **Fit with the audit.** All five bullets and the three fixes of ADM-05 (audit lines
  118-131) are quoted word for word and mapped: bullet 1 and Fix 2 to 3.5; bullet 2
  to O-ADM05-3 and the coverage table; bullet 3 and Fix 3 to 3.4 and O-ADM05-1;
  bullet 4 and Fix 1 to 3.1 and T1. The "Done when" quotes (G3-1 exit gate, "All six
  blockers fixed by 16 November", "Every fix carries a regression test that fails
  first", the success measure, the G3 checklist) match the refinement plan and
  `docs/changes/README.md` word for word.
- **Current state.** Every cited location checked at `32f0414`:
  `ErrorPagesPage.tsx` (Save only, no status, line 68 editor host, line 70 button);
  `ErrorPagesController` (`AdminControllers.cs:148-165`, `studio` policy); `AdminStore`
  `ErrorTypes` (18), `ListErrorPagesAsync` (573), `UpdateErrorPageAsync` (591-641,
  tracked load, direct write, no status check, `Fields` replaced, audit
  `error_page`/type), `PresentErrorPage` (1022), `ErrorPageUpdate` (1190);
  `BuildContentStore` (`ErrorSlugs` internal at 38, error pages at 75-80, `Status ==
  Published` at 174-177); `MutateAsync` working-copy branch (640-647); the library
  check (`ContentStore.cs:765`); `PublishChecks.cs:28-29` and 53-57;
  `ContentPaths.PublicPath("pages", "error-404")` falls to `"/" + slug`;
  `prepare.ts:44-48`; the importer creates both pages as drafts with `NoIndex = true`
  (`ContentWriter.cs:300-322`). The 2.4 go-live-on-save reading is correct.
- **Callers of the removed members.** `grep` finds only the controller and
  `AdminStore` itself. `ErrorPageUpdate` stays where it is.
- **Inherited obligations.** ADM-03 section 11 (library check on the error-page save)
  is closed by routing the save through `CheckAsync`, which T5 proves. ADM-02 line
  675 ("Error-page saves ... ADM-05. They hold rich text only.") is closed because the
  save stops being a separate write path: it gets the draft-schema check at save and
  the format-asserting schema check at publish (`CheckAsync(publishing: true)`).
- **Imported content will publish under (a).** The imported 404 body references
  pages `home`, `about`, `partners`, `cases`, `blogs`, `careers` and `contact` by id
  (`ContentWriter.cs:330-372`). All seven are imported page owners
  (`"page.<slug>"` in `api/tools`). An unpublished target is a warning, not an error
  (`PublishChecks.cs:250-251`). `CheckAsync(publishing: false)` does not check
  references, so the existing contract test's seeded body (with a random `homeId`)
  still saves.
- **Architecture.** The error-page save reuses `MutateAsync` instead of a second copy
  of the draft flow, and Publish reuses the existing route and checks. The rejected
  alternatives are real (raw Pages save loses fields as ADM-10 did; a parallel
  write path drifts as ADM-03 showed; a new publish route duplicates policy). It keeps
  "Save is not publish" and `phase-b-studio.md` 3.4 and 4.7. `ErrorSlugs` is used from
  the same assembly, so no `InternalsVisibleTo` is needed (the ADM-07 gate-1
  condition).
- **Red-first design.** Each red claim was traced:
  - T1: today the PUT writes the published record, so the build shows "Body B".
  - T2, T9: `state` does not exist in today's answer.
  - T3, T4, E1 (a)/(b): publish is refused on `metaDescription` today.
  - T5: the body passes `RichText.Validate` (an image with a lower-case `mediaId`
    and alt text, `RichText.cs:594-617`), so today it saves with 200; after the fix
    it reaches the library check, so it does not stay red for the wrong reason.
  - T6: `Fields` is replaced with `{ heading, body }` today. `eyebrow` is allowed by
    `rich_text.json`.
  - T7: the entity type changes to `Kinds["pages"].EntityType`, which is "page".
  - S1 to S6: the screen has no chip and no Publish.
  - T8, T10 and T11 are honest guards, marked green at the base.
  The commit split follows `ci.yml` (Unit tests at 237 before End-to-end at 271,
  `cancel-in-progress: true` at 25), so E1's red is not hidden.
- **Test harness.** `redirects.test.tsx` has the `vi.stubEnv`, hoisted mocks and the
  `document.body.innerHTML` guard (line 112). `Problem` in `studio/src/api/http.ts`
  carries `errors` and `warnings`. The editor does not emit `onChange` on load
  (`setContent(next, { emitUpdate: false })`, `RichTextEditor.tsx:249`), so the dirty
  flag is not set by a reload. Playwright runs `workers: 1`, `fullyParallel: false`.
  The E2E database is dropped and recreated (`start-api.ts`) and no seeder creates
  error pages, so E1 must create them, and its `finally` restores the empty list P2.12
  expects. `WorkingCopy` cascades on page delete (`ContentModelBuilder.cs:248`).
- **Commands.** .NET is Release throughout, `DigitalHubContent_Test` for integration
  and `DigitalHubContent_E2e` for end-to-end, ports 42xx, and `DigitalHubContent` is
  never named for a write. Anything not runnable is NOT RUN with its CI job.
- **Quality gates.** No gate, guard, baseline or test is weakened. The existing
  contract test is kept unchanged, and `prepare.ts:44-48` stays as the guard. The
  build-warning ceiling (13) is restated. No new gate, so no `*_BLOCKING_FROM` date or
  canary is needed.
- **Security.** No route is added or re-policied. `error-pages` keeps `studio`
  (admin, editor; `Program.cs:260`). Publish uses `[StudioAccess]` (admin, editor;
  HR only for vacancy reads and End, `StudioAccess.cs`), and editors could already
  publish these pages through Pages. T11 pins HR's 403. The save becomes stricter
  (library, schema, 300-character title by `ContentFields.Validate`,
  `ContentDocuments.cs:180`). No secrets, packages, lockfiles or migrations
  (`WorkingCopy.PageId` and `Revisions` already exist).
- **Scope.** One topic. The new files are new on purpose. `website/`, the importer,
  `ItemEditorPage.tsx`, `RichTextEditor.tsx` and `StatusChip.tsx` are left alone. The
  slug-rename hole is found and proposed as a new audit finding, not fixed here.
- **Risks** are specific and each names the test that catches it.

Round 1 result: CHANGES NEEDED (finding 1, Major). The file's single verdict line is at the end of the latest round.

## Round 2

Reviewer: plan-reviewer, 12 November 2026. Reviewed `docs/changes/ADM-05/plan.md` at
`0857268` (`git diff 76bf41f 0857268 -- docs/changes/ADM-05/plan.md`, and the
revision log in section 12) against the nine Round 1 findings, then looked for
anything new that the revision introduced. Nothing was built or run here. Every
check below was made by reading the code with `git`, `grep` and `sed`.

### Round 1 findings

| # | Severity | Closed? | Evidence |
| --- | --- | --- | --- |
| 1 | Major | Yes | 2.9 now states the rule as "about files, not lines" and drops the "If ADM-10 merges first" alternative. New 4.1 sets the order: ADM-10 merges first; only the test-only commits 1 and 2 come before that, and they are pushed only if O-ADM05-2 is "Yes"; then `origin/rebuild/dotnet-platform` with ADM-10 is merged in, proven with `git merge-base --is-ancestor` in `implementation.md`; then commit 3 (and commit 5, which touches `AdminStore.cs` only under (c)). If ADM-10 is late, the developer stops (step 5). ADM-04 is held on the two files until ADM-05 merges (step 6). Merging, not rebasing, is established practice: `change/ADM-02` (`1836fdd`) and `change/ADM-06` (`abe177b`) each carry a merge commit. Commits 1 and 2 touch neither shared file. The risk rows are replaced, and there is a new coverage row |
| 2 | Minor | Yes | 5.1: the `finally` no longer deletes audit rows; it cites `ListPagingTests.cs:176` and `AuditLogPermissionTests.cs`. T7 now finds exactly one row by entity id (a page id the helper seeds fresh for each test) and a time after the test started, so leftover rows cannot match it. `At` is set in the same process as the test (`ContentStore.Audit`, `DateTime.UtcNow`) |
| 3 | Minor | Yes | 3.1 step 5: on a success, `SaveErrorPageAsync` calls `LoadAsync("pages", id)` again and builds the answer from that; a failure outcome is returned as it is. `MutateAsync` is unchanged, so "No change to any existing method" holds. The window where a page is deleted between the commit and the reload is named and is narrow; `DeleteAsync` refuses a published page (`ContentStore.cs:244-245`, checked) |
| 4 | Minor | Yes | 3.5: a 400 on Save fills the same per-card list as a blocked publish. New S7 is red today, because only the title line shows. Mapping each key to its field is left to ADM-14 by name |
| 5 | Minor | Yes | B9 lists the 409 title, the 404 title and the 400 field keys. The new section's `SortOrder` is back to 0 (`AdminStore.cs:617-623`) |
| 6 | Minor | Yes | Section 8 now has the stale working-copy step: publish or discard any `error-404` or `error-500` whose chip reads "changed", through Pages, before the revert or right after it and before anyone saves on the screen. It is a Studio action, not a database edit |
| 7 | Minor | Yes, with a note (new finding 1) | T12 and S8 are added, both "(c) only", with commit 5a if (c) comes late. T12's message "is longer than 500 characters." matches `ContentFields.Limit` (`ContentDocuments.cs:551-555`), under the key `metaDescription` |
| 8 | Minor | Yes | 2.8 is corrected and matches the code: `AdminApiTests.cs:540-588`, `ContentPublishTests.ErrorPageAsync` and `BuildContentTests.PublishedErrorPageAsync` |
| 9 | Minor | Yes | 5.5 and section 9 now say "T1 to T7, T9 and E1"; T2 does its own set-up and save; the G3 row is cited at line 17; `EmptyDoc` moves to `ContentStore` and is removed from `AdminStore` (3.1, Scope) |

### New findings

**1. Minor. 3.4 (c) and T12: "A body without the key leaves the stored value as it
is", but the plan does not say how.**
- `ErrorPageUpdate` binds with System.Text.Json. A plain `string? MetaDescription`
  cannot tell a missing key from `null`, so the T12 assertion "a `PUT` with no
  `metaDescription` key leaves the stored value" would fail if the property is
  written the obvious way.
- The pattern already exists. ADM-10 (`04d0e80`, `AdminStore.cs`, `SiteSettingsUpdate`)
  uses a private backing field with an `internal bool ...Sent` flag that the setter
  sets. After the merge in 4.1 step 3, it is in the same file.
- This matters only if O-ADM05-1 is (c), and T12 would catch the mistake. It does
  not block gate 1.
- What would satisfy me: the plan, or the gate-1 conditions, name ADM-10's sent-flag
  pattern for `ErrorPageUpdate.MetaDescription`, and say what an explicit `null`
  does (clears the value, as with ADM-10).

### Checked again and still sound

- No new file is listed outside the Round 1 set, apart from T12 and S8 inside the
  existing new test files. No route, policy, migration, package or workflow is
  changed.
- The owner questions are unchanged: O-ADM05-1 (O-16), O-ADM05-2 and O-ADM05-3 are
  PENDING, and nothing is assumed. The order in 4.1 comes from the coordinator and
  integrator, not from the owner, and the plan does not present it as an owner
  decision.
- **Gate 1 can proceed with O-ADM05-1 to 3 open,** on the Round 1 conditions:
  - commits 1 and 2 may be written locally, and pushed only after O-ADM05-2 is
    answered "Yes" in the owner's words;
  - commit 3 waits for ADM-10's merge (4.1);
  - commit 5 waits for O-ADM05-1;
  - gate 2 cannot approve while O-ADM05-1 or O-ADM05-2 is open.
  O-ADM05-3 holds up only the G3-1 batch exit gate.
- The red-first design is unchanged except for S7 (red today: no list) and T12/S8
  (red today under (c): no field). The commit split still keeps E1's red visible in
  CI.

Verdict: APPROVED
