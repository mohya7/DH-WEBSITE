# ADM-12c implementation

Plan: `docs/changes/ADM-12c/plan.md`, round 2. Gate 1: `plan-approval.md`, `Verdict: APPROVED`, with conditions 1-11.

Branch `change/ADM-12c`, worktree `D:\work\DigitalHub\dh-platform-claude-adm-12c`, base `dad04a4` (plan commit on `cdef7c9`, the head of `origin/rebuild/dotnet-platform`).

Owner's request: "ADM-12c Refuse a decorative, blank-alt asset as the default share image without an override".

## Commits

| SHA | Subject | Content |
| --- | --- | --- |
| `de1324c` | ADM-12c: Add failing tests for the default share image alt rule | The three test files only, with no product change (condition 1, B-6) |
| `29e84ec` | ADM-12c: Refuse a default share image without alt text of its own | `AdminStore.cs`, `ContentBundle.cs`, `SettingsPage.tsx` |
| (this file's commit) | ADM-12c: Record the implementation | `docs/changes/ADM-12c/implementation.md` |

`git diff --stat dad04a4 29e84ec` lists exactly the six planned files (370 insertions, 6 deletions):

```
 api/src/DigitalHub.Api/Content/AdminStore.cs       |  22 +++
 .../DigitalHub.Api.Tests/ContentBundleTests.cs     |  63 ++++++
 .../SettingsShareImageTests.cs                     | 220 ++++++++++++++++++++-
 .../DigitalHub.ContentImport/ContentBundle.cs      |  10 +
 studio/src/pages/SettingsPage.tsx                  |  27 ++-
 studio/test/settingsShareImage.test.tsx            |  34 +++-
```

No PR #70 file, `PublishChecks.cs`, `ContentWriter.cs`, `AltText.cs`, `website/` file, or users or error-pages file was touched (condition 6).

## What changed, by plan Scope

### `api/src/DigitalHub.Api/Content/AdminStore.cs`

- New `public static string? DefaultShareImageAltError(string? altOverride, MediaAsset? asset)` beside `CheckSettings` (line 844). It returns the message "This image has no alt text of its own. Add alt text for the default share image." when `asset is not null && AltText.Effective(altOverride, asset) is null`, and null otherwise. It uses `AltText.Effective`, not `IsPublishable` (condition 2), so `Decorative` is ignored.
- `UpdateSettingsAsync` (lines 248-259), after the ADM-10 existence check and before `if (errors.Count > 0)`:
  - works out the values the save would store: the id is `request.DefaultShareImageId` when sent, otherwise `settings?.DefaultShareImageId`; the override is handled the same way;
  - when the id is set, loads the asset with `AsNoTracking` and adds any message from `DefaultShareImageAltError` as a field error on `defaultShareImageAltOverride`;
  - the existing `Validation(errors)` then answers 400 `validation_failed`, before the version check and before anything is written.
- Nothing else in the file changed.

### `api/tools/DigitalHub.ContentImport/ContentBundle.cs`

- In `CheckAsync`'s settings loop (lines 458-467): for a row with a `DefaultShareImageId`, read the asset from `db.Media` (`AsNoTracking`) and report any `DefaultShareImageAltError` message through the existing `Report(problems, "settings", settings.Id, ...)` under `defaultShareImageAltOverride`. It is a problem, so the import is undone, and `--force` does not bypass it.

**Reviewer Minor 1 / condition 3: which lookup I kept, and why.** I read **only `db.Media`**, without the bundle-first lookup. `ImportAsync` (lines 217-225) imports every table in `Tables` order and calls `SaveChangesAsync` after each one, inside the import transaction. `CheckAsync` runs only after that (line 232). So when the settings loop runs, `db.Media` holds:
- each bundle asset as the bundle states it, whether it was created or updated, including a `--force` overwrite of a target row; and
- each target asset the bundle does not carry, unchanged.

That is the state the import would commit, which is exactly the state to check. A bundle-first lookup would give the same answer with more code. Test 9's forced run shows this: the target asset had alt "The team at work", the bundle blanked it, and the check saw the blank alt from `db.Media`.

### `studio/src/pages/SettingsPage.tsx`

- `showFieldErrors(errors)`: keeps only keys that are registered fields on this form (`Object.keys(form.getFieldsValue())`) and passes them to `form.setFields`. Any other key, for example `version`, is skipped.
- `clearFieldErrors()`: clears the fields the last refusal marked (held in a `useRef`). It runs at the start of every save result, so a successful save clears them.
- The failure branch still calls `setError(result.problem?.title ...)`, so the title paragraph shows for every failed save (condition 7). No other screen changed.

### `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs`

- 8 new facts, plan tests 1-8 (lines 165-363), and a helper `HasError(body, field)` that reads `errors.<field>`.
- `SeedMediaAsync(name, string? alt = null, bool decorative = false)`: the defaults seed what they seeded before, so the 5 ADM-10 facts are unchanged.
- `CleanUpAsync(params Guid[] media)` deletes every id it is given. Test 7 passes both of its assets in `finally`.
- **Reviewer Minor 3 / condition 5 (test 5):** the fact first runs an ordinary PUT (`{ version, email = "adm12c-before@..." }`, asserted 200), so the settings row exists. It then writes the bad pair with `ExecuteUpdateAsync`, and `Assert.Equal(1, updated)` runs before the PUT that expects 400.
- Test 4 sends `defaultShareImageAltOverride = null` explicitly. That is the plan's "with no override", and it is the same stored value as leaving the field out on a clean row.

### `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`

- `A_default_share_image_without_alt_text_of_its_own_is_not_imported` (plan test 9, line 442), and guard `A_default_share_image_with_an_override_imports` (plan test 10, line 482). No helper changed.
- **Reviewer Minor 2 / condition 4: the forced repeat runs against conflicting target rows.** It follows the pattern of `A_media_path_outside_media_is_refused_with_and_without_force`:
  - Over the seeded target (not emptied), `ImportAsync(db, _source, Bad(decorative: true), force: true)`. The bundle's media row (alt blanked) and settings row (share id set) differ from the target's, and neither has an edit time, so both are conflicts.
  - The fact asserts `Assert.NotEmpty(forced.Conflicts)`. That proves the run went through the `--force` branch: without `--force`, the conflict problem is added and `CheckAsync` never runs.
  - It is still refused with the `settings 80000000-0000-0000-0000-000000000001: defaultShareImageAltOverride` problem.
  - The target is unchanged afterwards: the media alt is still "The team at work", and the settings share id is still null.
  - After that, on an emptied target without `--force`: decorative, and then not decorative. Each is refused, `SiteSettings` and `Media` counts are 0, and the target folder is empty.
- So the forced repeat does **not** run on an empty target.

### `studio/test/settingsShareImage.test.tsx`

- Plan test 11, `a refused save shows the field error under the default share image alt text` (line 194). A `putReplies` queue lets a test choose the reply for its next PUT. With nothing queued, the existing tests get the same 200 as before.
- It asserts:
  - the alt message is inside the alt field's `.ant-form-item`;
  - the title "One or more fields are invalid." is shown;
  - "Version is required." (the unmatched key) is not shown anywhere and nothing throws;
  - after a second save answered 200, the alt message and the title are gone and the success toast fired.

## Red run (before the fix, at `de1324c`)

From `api/`:

```
dotnet tool restore
dotnet build DigitalHub.slnx -c Release
  13 Warning(s)
  0 Error(s)                                   exit 0
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests|FullyQualifiedName~ContentBundleTests"
  Failed SettingsShareImageTests.A_decorative_image_with_blank_alt_and_no_override_is_refused_and_changes_nothing   Expected: BadRequest  Actual: OK
  Failed SettingsShareImageTests.Clearing_the_stored_override_of_a_blank_alt_image_is_refused                       Expected: BadRequest  Actual: OK
  Failed SettingsShareImageTests.A_non_decorative_image_with_blank_alt_is_refused_too                               Expected: BadRequest  Actual: OK
  Failed SettingsShareImageTests.A_save_without_share_fields_over_a_stored_bad_pair_is_refused                      Expected: BadRequest  Actual: OK
  Failed SettingsShareImageTests.A_whitespace_override_does_not_count_as_alt                                        Expected: BadRequest  Actual: OK
  Failed ContentBundleTests.A_default_share_image_without_alt_text_of_its_own_is_not_imported                        Expected: False  Actual: True
  Failed!  - Failed: 6, Passed: 40, Skipped: 0, Total: 46                                                           exit 1
```

These are the six failures the plan expected: tests 1-5 at `Expected: BadRequest Actual: OK`, and test 9 at `Ok` true, on its forced run. Guards 6-8 and 10 passed. Test 5 got past `Assert.Equal(1, updated)` before failing at the 400.

From `studio/` (after `npm ci`, exit 0):

```
npx vitest run test/settingsShareImage.test.tsx
  × a refused save shows the field error under the default share image alt text
  TestingLibraryElementError: Unable to find an element with the text: This image has no alt text of its own. Add alt text for the default share image.
  Tests  1 failed | 4 passed (5)                                                                                    exit 1
```

That is the one expected Studio failure.

## Green run (after the fix, at `29e84ec`)

All runs are in Release, against `DigitalHubContent_Test` only (`ApiFactory` rewrites the catalog to it and refuses anything else). `npm ci` was run in `website/` before the full suite (exit 0).

| Command (as CI runs it) | Exit | Result |
| --- | --- | --- |
| `api/`: `dotnet tool restore` | 0 | |
| `api/`: `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Error(s)`, `13 Warning(s)`, the same count as the red build |
| `api/`: `dotnet test ... -c Release --no-build --filter "...SettingsShareImageTests|...ContentBundleTests"` | 0 | `Passed! - Failed: 0, Passed: 46, Total: 46` |
| `api/`: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` (full suite) | 0 | `Passed! - Failed: 0, Passed: 586, Skipped: 0, Total: 586` (the base is 576, plus the 10 new facts) |
| `studio/`: `npm ci` | 0 | `found 0 vulnerabilities` |
| `studio/`: `npx tsc -b` | 0 | no output |
| `studio/`: `npm test` | 0 | `Test Files 15 passed (15)`, `Tests 117 passed (117)` (the base is 116, plus 1) |
| `studio/`: `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built`, "Preview design: ... matches website/design/ byte for byte." |
| `studio/`: `npx playwright test` | NOT RUN | The local e2e harness is broken (caller's brief). Covered by the CI Studio job (`.github/workflows/ci.yml` 232-276), where `studio/e2e/settings.spec.ts` must stay green. Run id to be quoted at gate 2. |
| Website job | NOT RUN | No `website/` file changed. Covered by the CI website job. |
| CI, Security (gitleaks) and Workflow lint on the PR head | NOT RUN | The branch is not pushed (caller: "Don't push"). Run ids go in at gate 2 (condition 9). |

No lint or format script exists in `studio/package.json`, so none was run (plan section 5).

## Migrations

None. No schema or data change.

## G3 checklist

- [x] The finding, its evidence and its fix come from the audit (ADM-12), its gate-2 follow-up and the plan review (plan sections 1 and 2).
- [x] Regression tests committed and shown failing before the fix: `de1324c`, red run above (tests 1-5, 9, 11).
- [x] End-to-end test for each Major: not applicable, this is a Minor. The existing settings e2e must stay green in CI (NOT RUN locally, see above).
- [x] Every Minor left unfixed has a named follow-up: ADM-12d (card-image publish test, and the empty-`settings`-table bundle case), recorded in `plan-approval.md`.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A blank-alt image with no override is refused by the settings save, and nothing changes | Owner request; ADM-12 test-report Minor 1 | Done | `A_decorative_image_with_blank_alt_and_no_override_is_refused_and_changes_nothing`: red at `de1324c` (`Expected: BadRequest Actual: OK`), green at `29e84ec`. It asserts 400 on `defaultShareImageAltOverride`, and the version and share id unchanged |
| A whitespace override counts as blank | ADM-12 rule (`MediaUsage.cs:137`) | Done | `A_whitespace_override_does_not_count_as_alt`: red, then green |
| A non-decorative blank-alt asset is refused too | plan-review Round 1, finding 2 | Done | `A_non_decorative_image_with_blank_alt_is_refused_too`: red, then green |
| A partial body uses stored values (clearing the override is refused, keeping it is accepted) | ADM-10 keep-on-omit (`AdminStore.cs:287-291` at base) | Done | `Clearing_the_stored_override_of_a_blank_alt_image_is_refused` (red, then green; "Logo" kept, version unchanged); guard `Choosing_a_blank_alt_image_keeps_the_stored_override` (green before and after); existing `A_save_without_the_share_image_fields_keeps_them` green |
| A save with no share fields over a stored bad pair is refused | plan-review Round 1, finding 3; reviewer Round 2 Minor 3 | Done | `A_save_without_share_fields_over_a_stored_bad_pair_is_refused`: the row is made sure of by a PUT, `Assert.Equal(1, updated)`, then 400. Email, version and share fields unchanged. Red, then green |
| An override, or alt in the library, is accepted | `AltText.Effective` | Done | Guards `A_blank_alt_image_with_an_override_is_accepted` and `A_decorative_image_with_library_alt_is_accepted`, green before and after |
| The importer refuses a bundle with the bad pair, `--force` included, and imports one with an override | plan-review Round 1, finding 1 (Major); reviewer Round 2 Minors 1-2 | Done | `A_default_share_image_without_alt_text_of_its_own_is_not_imported`: red (`Expected: False Actual: True` on the forced run), then green. The forced run is over conflicting target rows (`Conflicts` not empty), and the decorative and non-decorative runs are on an empty target. Guard `A_default_share_image_with_an_override_imports` is green. The lookup is `db.Media` only, for the reason given above |
| The Studio shows the refusal at the alt field, keeps the title, skips unmatched keys, and clears on success | Caller's brief; plan-review Round 1, finding 4; condition 7 | Done | `a refused save shows the field error under the default share image alt text`: red (`Unable to find an element with the text ...`), then green. `npm test` shows 117/117 |
| Page share images: reverse order closed at publish | ADM-12 delivery-approval | Done (existing) | `ContentPublishTests.cs:133` ran in the full suite, 586/586 green at `29e84ec` |
| Page card images: publish check exists without a test | ADM-12 delivery-approval; plan-review Round 1, finding 5 | Moved | Moved to follow-up ADM-12d (`plan-approval.md`, "Follow-ups recorded") |
| Independent of ADM-12's merge order; no PR #70 file touched | Caller's brief; condition 6 | Done | `git diff --stat dad04a4 29e84ec` lists only the six planned files |
| Failing tests committed first; CI's exact commands and all suites green | G3 checklist; plan-review Round 1, finding 6 | Done locally; CI open | Red commit `de1324c` before fix `29e84ec`. The green table above covers the API build, the full suite (586/586), `tsc`, `npm test` (117/117) and the Studio build. Playwright and the CI, Security and Workflow lint run ids are NOT RUN locally, and stay open for gate 2 |

## Notes for the tester

- Condition 8: I did not read or write `DigitalHubContent_Studio` or `DigitalHubContent`. Whether the Studio database's settings row already holds a bad pair, so that the every-save refusal applies at once, is still open for the tester's read-only check.
- Test 5 writes the shared settings row directly. Each fact's `finally` clears both share fields and deletes its assets, as the ADM-10 facts do.
- The two owner choices in plan section 9 (refusing every save while a bad pair is stored; the importer refusing even with `--force`) are implemented as planned and must be listed in the PR description at gate 2 (condition 11).

Status: READY FOR TEST

## Round 2

This round answers `delivery-approval.md` Round 1 (`Verdict: CHANGES NEEDED`), which sent back test-report Round 1, Minor 1.

### Finding and answer

**Test report Minor 1: the alt field's help text contradicts the rule.**
- The finding: the help text (`SettingsPage.tsx:170`) said "Empty uses the page title.", but the save now refuses an empty override when the image has no alt text in the library.
- The answer: I changed only the `extra` string of the `defaultShareImageAltOverride` `Form.Item`, using the tech lead's suggested wording:
  - From: "The alt text for the default share image, on pages that use it. Empty uses the page title."
  - To: "The alt text for the default share image, on pages that use it. Required when the image has no alt text in the media library; otherwise empty uses the page title."
- The new text says that an image with no library alt needs alt text here.
- It does not claim that the library alt is used on the site. The website uses the page override, then this field, then the page title (`website/src/seo/head.ts:90-93`), so "otherwise empty uses the page title" stays true.
- No test was added. The ruling says a copy change needs none, and no existing test asserts the old text.

### Scope

- `git diff --stat 67ecaa5` lists `studio/src/pages/SettingsPage.tsx | 2 +-` (one line) and this file.
- No API file changed.
- `test-report.md` and `delivery-approval.md` are left untracked for the records commit (push condition P2). I did not stage them.

### Commands (Studio only, from `studio/`, after the edit)

| Command | Exit | Result |
| --- | --- | --- |
| `npx tsc -b` | 0 | no output |
| `npm test` | 0 | `Test Files 15 passed (15)`, `Tests 117 passed (117)` |
| `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built in 880ms`; "Preview design: ... matches website/design/ byte for byte." |

API suites: NOT RUN in this round. The coordinator said `DigitalHubContent_Test` is in use by another agent, and no API file changed. The Round 1 evidence (586/586 at `67ecaa5`) stands for them. Merge condition M2 and the CI API job on the PR head cover the merged head.

I did not merge the base and did not push, as the coordinator asked.

### Coverage table update

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The alt field's help text matches the rule | test-report Round 1 Minor 1; delivery-approval Round 1 ruling | Done | `SettingsPage.tsx:170` has the new `extra` text. `tsc`, `npm test` (117/117) and the Studio build pass, each exit 0 |

Status: READY FOR TEST
