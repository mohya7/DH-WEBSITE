# ADM-12e implementation

Developer, step 4. Branch `change/ADM-12e`, worktree
`D:\work\DigitalHub\dh-platform-claude-adm-12e`. Plan `90de0c0`, `plan-approval.md`
`Verdict: APPROVED`. Owner decision O-1: "A: refuse both" (plan section 9).

## Round 1 block (19 November 2026)

- **Block.** The first red run (`dotnet test ... --filter "FullyQualifiedName~ContentBundleTests"`,
  Release, against `DigitalHubContent_Test`) exited 1 with `Failed: 28, Passed: 11, Total: 39`.
  Every failure, the existing facts included, stopped in `ExportAsync` with: "The database is at
  migration 20261119155407_AddPublicFormsRole, but this tool is built for
  20261020113912_AddApplicationCounts." The six new cases failed there too, not on their own
  assertions, so it was not a valid red run. Nothing was committed and the database was not touched.
- **Cause.** `DigitalHubContent_Test` had ISO-3's migration (`change/ISO-3`, `8e162f8`) applied
  while ISO-3 was unmerged. The branch, cut from `0488d89`, did not have it.
- **Owner's decision:** "ADM-12e waits" (relayed by the orchestrator session, 19 November 2026).
  No rollback of the test database.
- **Resolution.** ISO-3 was squash-merged as `266b124` (#79). The coordinator merged
  `origin/rebuild/dotnet-platform` into `change/ADM-12e` as `235779e`, a merge and not a rebase.
  That merge did not touch `ContentBundleTests.cs`. The branch then carried
  `20261119155407_AddPublicFormsRole`, which matches the test database. Work resumed at
  plan-approval condition 2.

Because of that merge, the scope check (plan command 6) runs against the merge base, `235779e`
(or `266b124`, the base it brought in). `0488d89..HEAD` now also lists the base's own changes
from #78 and #79.

## Commits

| SHA | Subject |
| --- | --- |
| `21f1b6c` | ADM-12e: Test that an import may not blank alt text a target use relies on (the five facts only, red) |
| `cd51f80` | ADM-12e: Refuse an import that blanks alt text a target use relies on (fix and doc) |

`git log --oneline --first-parent 0488d89..HEAD`: `cd51f80`, `21f1b6c`, `235779e` (merge),
`90de0c0` (plan). The red commit comes before the fix.

## What changed, by plan Scope

- `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs` (commit `21f1b6c`). The facts go after
  `A_default_share_image_with_an_override_imports`. No existing fact or helper is changed. Two
  additions support the facts: a `BlanksAlt` constant holding the plan's problem prefix, and a new
  private helper, `BlankingBundle(exported, decorative)`. The helper builds the plan's "blanking
  bundle" with the existing `Edit`: `media[0].alt = ""`, `decorative` as given, and every other
  table set to an empty `JsonArray`.
  - F1 `An_import_that_blanks_an_alt_a_target_card_relies_on_is_refused(bool decorative)`, with
    `true` and `false`. Media folder `_source`.
  - F2 `An_import_with_no_settings_row_that_blanks_the_default_share_image_alt_is_refused`.
    Media folder `_source`.
  - F3 `An_import_that_blanks_an_alt_a_target_page_section_relies_on_is_refused`. Media folder
    `_source`.
  - G1 `An_import_that_blanks_an_alt_no_target_use_relies_on_still_imports`. Media folder `_source`.
  - G2 `A_first_import_of_an_image_without_alt_text_still_imports_with_a_note`. Media folder
    `_target`, after `EmptyAsync`.
  - Condition 3: F1, F2 and F3 each run `Assert.Single` for the one problem that starts with the
    prefix. They then `Assert.Contains` `$"case-studies {CaseId:D} image"` (F1),
    `"site-settings 80000000-0000-0000-0000-000000000001 default share image"` (F2) and
    `$"pages {PageId:D} section {SectionId:D}"` (F3) on that problem.
- `api/tools/DigitalHub.ContentImport/ContentBundle.cs` (commit `cd51f80`), as in plan section 3.2:
  - `TargetAssetsWithAltAsync`, a new private method. The blank test is C#
    `string.IsNullOrWhiteSpace`, not SQL.
  - The read `var withAlt = await TargetAssetsWithAltAsync(...)`, inside the `try`, before the
    table loop.
  - A new `HashSet<Guid> withAlt` parameter on `CheckAsync`, passed by its one caller.
  - The ADM-12e block in the media loop, after the existing note. It calls
    `MediaUsage.FindPlacesWithoutOwnAltAsync` and adds to `problems`, never to `warnings`.
  - The comment above the note now points to the ADM-12e block. The note itself is unchanged.
- `docs/content-bundle.md` (commit `cd51f80`). Condition 5 left the "What the import refuses"
  bullet as the developer's choice; it was added. The final text:
  - New bullet in "What the import refuses":
    > **Removing alt text the target relies on:** an import that removes the alt text of an image
    > the target already has, while any place uses the image without alt text of its own. See the
    > next paragraph.
  - The paragraph that replaces "listed as notes" (lines 186-187 before):
    > Images without alt text are **listed as notes**, not refused, because the Studio only checks
    > alt text when an image is uploaded or edited. One exception: an import that removes the alt
    > text of an image the target already has is an edit of that image. It is refused, whether or
    > not the bundle marks the image decorative, while any place uses the image without alt text
    > of its own: a page, card or share image, a section, an article body, a draft, or the settings
    > row's default share image. The Studio refuses the same edit. `--force` does not override
    > this.

## Commands

All of them ran from `api/` unless stated, in Release. Before each test run I checked for
`testhost.exe` processes: there were none every time (count `0`).

1. **Red, round 1** (block above): exit 1, `Failed: 28, Passed: 11, Total: 39`, every failure at
   the migration guard. Not valid evidence.
2. `dotnet build DigitalHub.slnx -c Release`, after the merge, with the facts: exit 0, `0 Error(s)`.
3. **Red** (plan command 2, before commit `21f1b6c`),
   `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentBundleTests"`:
   exit 1.
   ```
   Failed ...An_import_that_blanks_an_alt_a_target_card_relies_on_is_refused(decorative: False)
   Failed ...An_import_that_blanks_an_alt_a_target_card_relies_on_is_refused(decorative: True)
   Failed ...An_import_with_no_settings_row_that_blanks_the_default_share_image_alt_is_refused
   Failed ...An_import_that_blanks_an_alt_a_target_page_section_relies_on_is_refused
   Failed!  - Failed:     4, Passed:    35, Skipped:     0, Total:    39
   ```
   Each failure is `Assert.False() Failure / Expected: False / Actual: True`:
   - F1, both cases: `ContentBundleTests.cs:line 536`, `Assert.False(dry.Ok)`. This is the forced
     dry run. The first assert, the unforced conflict, passes as before.
   - F2: line 564, `Assert.False(forced.Ok)`.
   - F3: line 586, `Assert.False(forced.Ok)`.

   G1 and G2 pass. They are among the 35 passed, and a filtered run of the two guards passed too.
   The coordinator's message said "the six new cases must fail". The plan and condition 2 expect
   four to fail (F1 twice, F2, F3) and the two guards to pass, and that is what happened.
4. `dotnet build DigitalHub.slnx -c Release --no-incremental` on the fix: exit 0, `13 Warning(s)`,
   `0 Error(s)`. The base, `235779e`, in a scratch detached worktree (since removed), with the same
   command: `13 Warning(s)`, `0 Error(s)`. No new warning.
5. **Green**, the ContentBundleTests filter again: exit 0,
   `Passed!  - Failed: 0, Passed: 39, Skipped: 0, Total: 39`.
6. `dotnet test ... --filter "FullyQualifiedName~MediaLibraryTests"`: exit 0,
   `Passed!  - Failed: 0, Passed: 19, Total: 19`.
7. `npm ci` in `website/`: exit 0. The only warnings are npm's `allow-scripts` notices.
8. **Full API suite**, `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`:
   exit 0, `Passed!  - Failed: 0, Passed: 602, Skipped: 0, Total: 602`.
   - **Count explained.** The plan expected 601, from ADM-12d's 595 plus 6. I counted the base
     directly: `dotnet test ... --list-tests` on a Release build of `235779e` lists 596 cases, and
     the same command on HEAD lists 602. So the base is 596, which matches ISO-3's records
     ("Passed: 596" at `0488d89`, and CI run 44554202307 "Total tests: 596"). This change adds 6:
     the F1 theory counts as two. 596 + 6 = 602. The plan's 595 was one short.
9. **Public API suite**, `dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build`:
   exit 0, `Passed!  - Failed: 0, Passed: 102, Skipped: 0, Total: 102`.
10. **Scope**, `git diff --name-only 235779e HEAD`:
    - `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`
    - `api/tools/DigitalHub.ContentImport/ContentBundle.cs`
    - `docs/content-bundle.md`

    `git diff --name-only 266b124 HEAD` lists the same three files plus `docs/changes/ADM-12e/*`.
    This file is added in the records commit.

NOT RUN locally, with the CI job that covers each:

- Studio end-to-end: the local harness is broken. Covered by CI job `studio` ("Studio — typecheck,
  build, end-to-end"). No Studio file changed.
- Website typecheck, tests, design check, snapshot build and section comparison: no website file
  changed. Covered by CI jobs `website` and `section-compare`.
- Security (gitleaks, Semgrep, dependency audits) and Workflow lint: CI on the PR head. Nothing is
  pushed yet, so there are no run ids.
- Mutants M1 to M6: the tester runs them (condition 12).

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Scope chosen, with reasons | `ADM-12d/plan-approval.md:122-131` | Done | Plan section 3.1; implemented as written (option A) |
| Owner's answer to O-1 recorded verbatim, with the date | P-7; plan section 9 | Done | Plan section 9, "A: refuse both", 19 November 2026; commit bodies quote it |
| Failing `ContentBundleTests` fact committed first: card use (F1) | `ADM-12d/plan-approval.md:128-129`; README G3 rule | Done | `21f1b6c` before `cd51f80`. Command 3: F1 (true and false) fails at line 536 on `Assert.False(dry.Ok)` |
| Target settings row checked when the bundle's `settings` table is empty (F2) | ADM-12e text | Done | Command 3: red at line 564. Command 5: green. Asserts the `site-settings ... default share image` place |
| Target page uses checked (F3) | ADM-12e text | Done | Command 3: red at line 586. Command 5: green. Asserts the `pages {PageId} section {SectionId}` place |
| The note for the old site's images kept (G1, G2) | `ContentBundle.cs` note; `docs/content-bundle.md` | Done | G1 and G2 pass in commands 3 and 5; both assert the `Alt text is required...` note |
| `--force` does not bypass the refusal | ADM-12c precedent | Done | F1, F2 and F3 assert `!Ok` with `force: true`; the refusal goes to `problems` |
| Mutants M1 to M6 fail as stated | Plan section 5 | Open (tester) | Condition 12: the tester's step |
| `docs/content-bundle.md` updated | Plan section 3.2; condition 5 | Done | `cd51f80`; final text quoted above |
| Full API suite and Public API suite green in Release | Plan section 5, commands 4 and 5 | Done | 602 of 602 (base 596 + 6, count explained); public 102 of 102 |
| CI, Security and Workflow lint green on the PR head | README | Open (CI) | Not pushed; jobs `api`, `studio`, `website`, `section-compare`, Security, Workflow lint |
| ADM-12 (Blocker) closed for the importer path | `admin-audit-2026-10-28.md:202-208` | Done locally | F1 to F3 red, then green; CI and mutants still open |

## For the tester

- Check out `cd51f80`, or the records commit after it, detached.
- The branch has a merge, `235779e`. Diff against `235779e`, not `0488d89`.
- The full suite is 602, not 601 (see command 8).
- In F1 the forced dry run (line 536) is the first assert to fail on the base code. The unforced
  run still fails on its conflict, as before.

Status: READY FOR TEST
