# ADM-12c plan approval (gate 1)

Plan: `docs/changes/ADM-12c/plan.md`, revision round 2. Review: `plan-review.md`, Round 2, `Verdict: APPROVED` with four Minors. Branch `change/ADM-12c`, base `cdef7c9`, which is the current head of `origin/rebuild/dotnet-platform` (`git merge-base HEAD origin/rebuild/dotnet-platform` gives `cdef7c90bf55...`).

Owner's request, as given to this pipeline run: "ADM-12c Refuse a decorative, blank-alt asset as the default share image without an override".

## Decision

Approved for the developer, with the conditions below.

## Reasons

- **Right change.** It closes the reverse order of the ADM-12 gap: ADM-12 (PR #70) refuses blanking an asset's alt while the settings row relies on it (`origin/change/ADM-12`, `MediaUsage.cs`, the `SiteSettings` query with `DefaultShareImageAltOverride == null || ...Trim() == ""`). This change refuses pointing the settings row at an asset that already has no alt. The origin is quoted from the ADM-12 test report (Minor 1) and delivery approval on `origin/change/ADM-12`. I read the code the plan relies on at `cdef7c9`:
  - `AdminStore.cs:236-249`: `UpdateSettingsAsync` only checks that the share image exists.
  - `AdminStore.cs:287-291`: keep-on-omit for both share fields, so "sent ? request : stored" is the right value to check.
  - `AdminStore.cs:825`: `CheckSettings` is `ValidateSettings`, with no database access.
  - `ContentBundle.cs:217-232`: tables are imported and saved before `CheckAsync` runs, and any problem leads to `UndoAsync` (lines 244-248), so an import problem changes nothing.
  - `ContentBundle.cs:454-458`: the settings loop that gets the new check.
  - `AltText.cs:9-22`: `Effective` ignores `Decorative`, and `PublishChecks.cs:91-101` applies the same rule to page share and card images.
- **Scope beyond the literal wording.** The request names decorative assets and the plan also refuses non-decorative blank-alt assets and covers the importer. I accept both. They apply the request's rule ("no alt of its own and no override"), not a new one. Without them the refusal could be bypassed by the importer, which fills `DigitalHubContent_Studio`, the database G3-1's exit gate builds from.
- **Order.** ADM-12 is in batch G3-1, Blockers (`refinement-plan-2026-10-28.md:225`), and this change completes it, so it runs before the G3-2 Majors. It depends on neither Wave 0 nor Wave 1, and not on ISO-4 or ISO-5.
- **Branch conflicts.** `gh pr list --state open` shows #70 (`change/ADM-12`), #69 (`change/GAP-11`), #68 (`change/GAP-09`) and #60 (`diag/redirects-e2e`, do not merge). Their files, from `git diff --stat origin/rebuild/dotnet-platform...<branch>`:
  - #70: `MediaLibrary.cs`, `MediaUsage.cs`, `MediaLibraryTests.cs`, `MediaLibraryPage.tsx`, `studio/test/mediaLibrary.test.tsx` and its records.
  - #69: `website/` files only.
  - #68: `.github/` files only.
  - #60: `studio/e2e/redirects.spec.ts` only.
  - None of them touches `AdminStore.cs`, `ContentBundle.cs`, `SettingsShareImageTests.cs`, `ContentBundleTests.cs`, `SettingsPage.tsx` or `settingsShareImage.test.tsx`. Older `origin/change/*` branches that touch these files (ADM-02, ADM-05, ADM-07, ADM-10) are already squash-merged. The plan touches no users or error-pages files (ADM-04, ADM-05), and either this change or PR #70 can merge first.
- **Risk.** There is no migration, no schema change and no route or policy change. Validation only gets stricter, and reverting the PR rolls it back. The known risk is that a stored bad pair blocks every settings save until the alt is added. That is a deliberate choice, and it is tested (test 5) and listed for the owner.
- **Owner decisions.** None is needed before building. The plan's section 9 lists two choices the owner may overrule at the PR: refusing every settings save while a bad pair is stored, and the importer refusing even with `--force`. Neither is an owner decision yet, and this approval does not make either one.

## Conditions for the developer

1. **Failing tests first (B-6, G3 checklist).** Commit tests 1-5, 9 and 11 together with guards 6-8 and 10, with no product change, as "ADM-12c: Add failing tests for the default share image alt rule". Run them and record the red run in `implementation.md`: the command, the exit code and the counts. The expected result is 6 API failures (tests 1-5 at `Expected: BadRequest Actual: OK`, and test 9 at `Ok` true) and 1 Studio failure. The fix goes in a later commit. Do not claim a failure you did not see.
2. **Use `AltText.Effective`, not `AltText.IsPublishable`.** `IsPublishable` (`AltText.cs:24-38`) treats a decorative asset as publishable, which is exactly the case this change refuses. The rule is `AltText.Effective(altOverride, asset) is null`, as in plan section 3.
3. **Reviewer Minor 1 (importer lookup).** Either keep the bundle-first lookup with `db.Media` as the fallback, or read only `db.Media`. The tables are saved before `CheckAsync`, so `db.Media` already holds the bundle's state. `implementation.md` says which you chose and why the answer is right.
4. **Reviewer Minor 2 (forced repeat).** Run the `force: true` repeat of test 9 against a conflicting target row, as `A_media_path_outside_media_is_refused_with_and_without_force` does (`ContentBundleTests.cs:419-435`). If that is not practical, `implementation.md` says plainly that the forced repeat runs on an empty target and proves only that the result is the same.
5. **Reviewer Minor 3 (test 5 setup).** Test 5 first makes sure the settings row exists, for example with an ordinary PUT, then writes the bad pair with `ExecuteUpdateAsync`. It asserts that exactly one row was updated before it asserts the 400.
6. **Scope.** Change only the six files in plan section 4, plus `docs/changes/ADM-12c/*`. Do not touch PR #70's five files, `PublishChecks.cs`, `ContentWriter.cs`, `AltText.cs`, `website/`, or any users or error-pages file. In `AdminStore.cs`, add only the new method and the check in `UpdateSettingsAsync`.
7. **Studio field errors.** Map only the keys that match a `Form.Item` name on the settings form, and keep the title paragraph for every failed save. Clear the errors on a successful save. Do not change other screens (ADM-14).
8. **Databases.** Integration tests run against `DigitalHubContent_Test` only, in Release. Never write to `DigitalHubContent` or `DigitalHubContent_Studio`. For the owner's information, the tester may read `DigitalHubContent_Studio` (read-only, no writes) to say whether its settings row is stored with a bad pair today, which would mean the every-save refusal applies at once.
9. **End-to-end evidence.** The local e2e harness is broken. Mark `npx playwright test` NOT RUN locally, with that reason, and name the CI Studio job as the evidence. CI, Security (including gitleaks) and Workflow lint on the final head stay open at gate 2 until they are green and their run ids are quoted.
10. **Commits (B-4).** Each subject is imperative and starts with `ADM-12c:`. The body says why, and each commit carries the attribution trailer.
11. **PR description.** At gate 2, list the two section 9 choices under their own heading so the owner sees them before the merge.

## Reviewer Minors accepted

- Minor 1 (importer lookup order): accepted, with condition 3.
- Minor 2 (the forced repeat does not exercise a force branch): accepted, with condition 4.
- Minor 3 (test 5 needs a settings row): accepted, with condition 5.
- Minor 4 (a hand-made bundle with an empty `settings` table over a target settings row is not checked): accepted and left. It is not in the owner's request, and every export carries the singleton settings row. It is recorded under ADM-12d below as an item to assess.

## Follow-ups recorded

- **ADM-12d: "Test the card-image alt check at publish".** Add a `ContentPublishTests` fact for the `image` error key at `PublishChecks.cs:93-100`. The check exists but has no test (plan section 2; plan-review Round 1, finding 5). Also to assess under ADM-12d: whether the importer should check the target's settings row when a bundle carries media but an empty `settings` table (plan-review Round 2, Minor 4). ADM-12d is not in this change. It needs an owner request before it runs.

## Merge queue note

Open PRs today are #68, #69 and #70, plus the do-not-merge #60. ADM-12c would be the fourth real PR in the queue. The refinement plan (line 269) says slot 2 pauses for a day when the queue passes three pull requests. When to push and open this PR is the owner's call after gate 2. This note does not block the build.

This approval moves the change to the developer. It is not the owner's confirmation, and it does not count as an owner decision.

Verdict: APPROVED
