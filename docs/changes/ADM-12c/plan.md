# ADM-12c plan: Refuse a decorative, blank-alt asset as the default share image without an override

Revision: round 2 (answers `plan-review.md` Round 1; see section 12).

## 1. Item

- Owner's request (this pipeline run): "ADM-12c Refuse a decorative, blank-alt asset as the default share image without an override".
- Origin: ADM-12 gate 2 (PR #70, open, not merged). `git show origin/change/ADM-12:docs/changes/ADM-12/test-report.md`, Minor 1: "the site settings default share image can be pointed at a decorative, blank-alt asset ... Follow-up: **ADM-12c** ... The architect should also check whether new share or card image assignments in page saves have the same reverse-order gap." `delivery-approval.md` (same branch), "Review findings accepted": "Default share image can be set to an already-decorative, blank-alt asset (`AdminStore.cs`, outside the scope) ... Follow-up: ADM-12c."
- Parent audit item: ADM-12, `docs/quality/admin-audit-2026-10-28.md:202-208`: "the alt-text rule can be bypassed in the media library ... Fix: refuse it while any use has no per-use alt, or run the publish alt check over every use."
- Track: **G3, batch G3-1** (`docs/quality/refinement-plan-2026-10-28.md:225`, "ADM-12 alt text in the library"). G3-1 "Done when": "A clean website build from `DigitalHubContent_Studio` with no patched content; each blocker reproduced before its fix and passing after it".
- Done when (this change):
  - No write path stores a default share image that has no alt text of its own together with a blank alt override. Both write paths are covered: the settings save (`PUT /api/v1/settings`) refuses it with a field error and changes nothing, and the content import refuses the bundle and changes nothing.
  - The Studio settings screen shows the refusal at the alt field.

## 2. Current state

Site settings have **two write paths**, and neither applies the alt rule.

1. **Settings save.** `api/src/DigitalHub.Api/Content/AdminStore.cs:236-249`, `UpdateSettingsAsync`. The only share-image check is that the image exists (lines 244-247, "An id that is not in the library would fail the foreign key as a 500 (ADM-10, G-1)"). Nothing reads `MediaAsset.Alt` or `Decorative`.
   - Keep-on-omit is at lines 287-291: a body that leaves out `defaultShareImageId` or `defaultShareImageAltOverride` keeps the stored value (`DefaultShareImageIdSent` and `DefaultShareImageAltOverrideSent` on `SiteSettingsUpdate`, lines 1048-1089). So each stored value after the save is "sent ? request : stored", field by field.
2. **Content import.** `api/tools/DigitalHub.ContentImport/ContentBundle.cs:454-458` checks each imported settings row with `AdminStore.CheckSettings(SettingsRequest(settings))`. `CheckSettings` (`AdminStore.cs:825`) is `ValidateSettings(request)`, which is synchronous and has no database access. `ContentWriter.cs:1503` then writes `DefaultShareImageId` and `DefaultShareImageAltOverride` as they are in the bundle.
   - The same check keeps media rows with no alt as a warning only, decorative or not (`ContentBundle.cs:434-439`, "keeps rows that predate it (the old site's images without alt text)").
   - This is how `DigitalHubContent_Studio` gets its content, so this path matters to G3-1's "Done when".
   - Problems block the import, and `--force` never bypasses them (comment at line 440). `ContentBundleTests.cs` covers the tool and builds edited bundles with `Edit(...)` (line 862).

Media data:
- `api/src/DigitalHub.Api/Data/ContentEntities.cs:277-280`: `MediaAsset.Alt` is a string where "" is allowed, and `Decorative` is a bool.
- The Studio's upload and edit (`MediaLibrary.cs:59,119`, `AltError`) require alt unless the asset is decorative. Stored data is wider than that. The importer keeps assets that are **not** decorative and have blank alt (above), and tests write `MediaAsset` directly. So a blank `Alt` can be on any asset, decorative or not.
- `api/src/DigitalHub.Api/Data/AltText.cs:9-22`: `AltText.Effective(altOverride, asset)` returns the trimmed override, otherwise the trimmed asset alt, otherwise null. It ignores `Decorative`. `PublishChecks.cs:91` applies the same rule to page share images.

Pages (the question raised at ADM-12 gate 2):
- Page and item share and card images are drafts, and `PublishChecks.cs:91-101` refuses a publish whose share image (`shareImage`) or `fields.imageId` (`image`) has no effective alt, whatever `Decorative` says.
- Evidence for share images: `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs:133` (`Assert.True(errors.TryGetProperty("shareImage", out _))`).
- Card images: `grep -rn "imageAltOverride\|\"image\", out" api/tests` finds no test of the `image` key at `PublishChecks.cs:93-100`. The check exists but has no test. This change does not add one; it is follow-up **ADM-12d** (section 4).

ADM-12 and the website:
- ADM-12 (`origin/change/ADM-12`, `MediaUsage.cs:137`) counts a settings row with this `DefaultShareImageId` and a blank or whitespace override as a use without its own alt. That refuses the forward order (the library edit). This change closes the reverse order on both settings write paths with the same rule.
- `website/src/seo/head.ts:85-93` uses `own || fallback || documentTitle(item)` for `imageAlt`, so no empty `og:image:alt` ships today. This is a consistency fix, not a shipped defect.

Studio:
- `studio/src/pages/SettingsPage.tsx:110-114`, the failure branch of `save`, shows only `result.problem?.title` ("One or more fields are invalid.").
- It ignores `problem.errors` (`studio/src/api/http.ts:6`, `errors?: Record<string, string[]>`).
- The alt field `defaultShareImageAltOverride` is at line 145, with the hint "Empty uses the page title."

Existing tests:
- `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs` has 5 facts from ADM-10.
  - `SeedMediaAsync(name)` (line 167) always seeds `Alt = "ADM-10 " + name`, never decorative.
  - `CleanUpAsync(Guid media)` (lines 190-198) clears the share fields on the settings row and deletes one media row.
- `studio/test/settingsShareImage.test.tsx` has 4 tests.
- `studio/e2e/settings.spec.ts:73` is the ADM-10 end-to-end test, and it uses images that have alt.

## 3. Design

### One shared rule

Add one public static method in `AdminStore`, beside `CheckSettings` (line 825):

```csharp
/// ADM-12c: the default share image needs alt text of its own (library alt or override).
public static string? DefaultShareImageAltError(string? altOverride, MediaAsset? asset) =>
    asset is not null && AltText.Effective(altOverride, asset) is null
        ? "This image has no alt text of its own. Add alt text for the default share image."
        : null;
```

- The rule is `AltText.Effective(...) is null`, the publish rule for page share images. It ignores `Decorative`, so it refuses a blank-alt asset whether or not it is decorative (finding 2). A decorative asset that has library alt is accepted.
- A missing asset returns null here, because each caller already reports a missing image in its own way: the settings save at lines 244-247, and the importer through its foreign-key and file checks.

### Settings save (`UpdateSettingsAsync`)

After the existence check and before `if (errors.Count > 0)`:

1. Work out the values the save would store:
   - `shareId = request.DefaultShareImageIdSent ? request.DefaultShareImageId : settings?.DefaultShareImageId`
   - `altOverride = request.DefaultShareImageAltOverrideSent ? request.DefaultShareImageAltOverride : settings?.DefaultShareImageAltOverride`
2. If `shareId` is set, load the asset (`AsNoTracking`) and call `DefaultShareImageAltError`.
3. If it returns a message, add it as a field error on `defaultShareImageAltOverride`. The response is the existing 400 `validation_failed` (`Validation(errors)`), so nothing is written and the version does not change.

The check runs on **every** save, including one that sends no share field. So while the stored pair is bad, every settings save is refused until the alt is added, and the message names the field to fix.

### Content import (`ContentBundle.CheckAsync`, settings loop at 454-458)

- For each settings row with a `DefaultShareImageId`, find the asset first among the bundle's `media` rows (already deserialised in the loop at 431-452), and otherwise in `db.Media` (`AsNoTracking`, for an asset already on the target and not in the bundle).
- Call `AdminStore.DefaultShareImageAltError(settings.DefaultShareImageAltOverride, asset)`. If it returns a message, report it with the existing `Report(problems, "settings", settings.Id, ...)` under field `defaultShareImageAltOverride`.
- This is a problem, not a warning, so nothing is imported and `--force` does not bypass it, like the other safety checks.
- An import writes the whole row, so there is no keep-on-omit here: the row's values are the stored values.

### Studio (`SettingsPage.tsx` `save`)

- When a save fails and `result.problem?.errors` is present, call `form.setFields` for each key that is a field name on this form, so the message shows under that field (here "Default share image alt text").
- Keys with no `Form.Item` on the form, for example `version` (`AdminStore.cs:242-243`), are skipped (finding 4). The title paragraph still shows for every failed save, so a refusal never looks like nothing happened.
- A successful save clears the field errors set by the previous failure.

### Rejected alternatives

- **Refuse only a save that changes the share id or the override** (finding 3). Creating a bad pair through the Studio would still be impossible, and existing bad data would not lock the whole form. Rejected for two reasons:
  - A bad pair that is already stored (from an import before this change, or from before ADM-12) would stay live indefinitely, with no signal to anyone, and every build would ship it.
  - The fix is one field on the same form, and the refusal says which.
  - Refusing on every save follows the same idea as ADM-12's Minor 2 (refuse edits until the alt is added). That was accepted by the tech lead at ADM-12 gate 2, on PR #70, which is not merged. It is not an owner decision, and the owner may choose the "only when it changes" form at the PR.
- **409 `alt_in_use`, as in ADM-12.** That code means "this library edit would leave uses without alt" and carries a `usages` list. Here one field of the request is invalid, so the settings form's existing 400 field error is the right shape.
- **Error on `defaultShareImageId`.** The image is a valid choice. What is missing is the alt, and the user fixes it in the alt field.
- **Accept the save because the website falls back to the page title.** That contradicts ADM-12, which treats a blank override on this use as missing alt.
- **A warning in the importer, not a problem.** A warning would let the import write the bad pair, which is the gap the review found (finding 1).
- **Leave the importer out with a follow-up.** It is the path that fills `DigitalHubContent_Studio`, so leaving it out would leave G3-1's clean build exposed. The shared method makes it a few lines.
- **Change `PublishChecks` or `MediaUsage`.** Not needed: pages are covered at publish, and `MediaUsage.cs` is in PR #70.

### Dependency on ADM-12

**None; either can merge first.** This change reads `db.Media` directly. It touches none of PR #70's five files (`MediaUsage.cs`, `MediaLibrary.cs`, `MediaLibraryPage.tsx`, `MediaLibraryTests.cs`, `studio/test/mediaLibrary.test.tsx`). `ContentBundle.cs` only calls `MediaLibrary.MetadataError`, which PR #70 does not change. Each change closes one order of the same gap, and both are needed for the rule to hold in both orders. Whichever merges second rebases with no file overlap.

## 4. Scope

Files to change:
- `api/src/DigitalHub.Api/Content/AdminStore.cs`:
  - Add `DefaultShareImageAltError` beside `CheckSettings`.
  - Add the check in `UpdateSettingsAsync`, about 10 lines plus a comment citing ADM-12c.
  - Nothing else in the file changes.
- `api/tools/DigitalHub.ContentImport/ContentBundle.cs`: the settings loop in `CheckAsync` (454-458) calls the shared method, looking the asset up in the bundle and then on the target. Nothing else changes.
- `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs`:
  - Add the new facts (section 5).
  - `SeedMediaAsync` gains optional `alt` and `decorative` parameters. The defaults match today, so the existing facts do not change.
  - `CleanUpAsync` becomes `CleanUpAsync(params Guid[] media)` and deletes every id it is given, so tests that seed two assets clean up both in `finally` (finding 8). Existing callers pass one id and are unchanged.
- `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`: two new facts (section 5). No change to the helpers.
- `studio/src/pages/SettingsPage.tsx`: field errors from `problem.errors` through `form.setFields`, with unmatched keys skipped.
- `studio/test/settingsShareImage.test.tsx`: one new test.
- `docs/changes/ADM-12c/*`: the records.

Out of scope (left alone):
- PR #70's five files, `PublishChecks.cs`, `ContentWriter.cs` (the write stays as it is, because the check runs before it), `website/` (the title fallback stays), and the users and error-pages files (ADM-04, ADM-05).
- **ADM-12d (follow-up, named here): "Test the card-image alt check at publish".** Add a `ContentPublishTests` fact for the `image` error key from `PublishChecks.cs:93-100`. The check exists but has no test (section 2). Routed by this plan for the tech lead to record. It is not an owner decision.
- ADM-14's generic-message work on other screens. The settings screen gains field errors for every field it names; no other screen changes.
- Repairing existing bad data. The refusals tell the editor what to fix.
- A new end-to-end test. This is a Minor, and the G3 checklist requires an end-to-end test for each Major. The existing ADM-10 test in `studio/e2e/settings.spec.ts` must stay green in CI.
- Migrations and schema: none.

## 5. Test plan

The tests are written and committed first ("ADM-12c: Add failing tests for the default share image alt rule") and shown failing, then the fix is written.

API, `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs`. Every fact cleans up every asset it seeded with `CleanUpAsync(...)` in `finally`.

1. `A_decorative_image_with_blank_alt_and_no_override_is_refused_and_changes_nothing`:
   - Seed a decorative asset with `Alt = ""`.
   - PUT `{ version, defaultShareImageId = m, defaultShareImageAltOverride = null }`: 400, and `errors` has `defaultShareImageAltOverride`.
   - Reading back shows the version and share id unchanged.
   - **Red before the fix (200).**
2. `A_whitespace_override_does_not_count_as_alt`: the same, with override `"   "`: 400. **Red.**
3. `Clearing_the_stored_override_of_a_blank_alt_image_is_refused`:
   - Store a decorative blank-alt image with override "Logo" (200).
   - PUT only `{ version, defaultShareImageAltOverride = null }`: 400.
   - The stored override is still "Logo" and the version is unchanged.
   - **Red.**
4. `A_non_decorative_image_with_blank_alt_is_refused_too` (finding 2): seed `Decorative = false`, `Alt = ""` (possible only through direct writes and the importer), with no override: 400 on `defaultShareImageAltOverride`. **Red.**
5. `A_save_without_share_fields_over_a_stored_bad_pair_is_refused` (finding 3):
   - Write the bad pair directly with `ExecuteUpdateAsync` on `SiteSettings` (blank-alt asset, override null), as `CleanUpAsync` writes the row.
   - PUT `{ version, email = "changed@example.com" }`: 400 on `defaultShareImageAltOverride`.
   - Read back: email, version and share fields unchanged.
   - **Red.**
6. `A_blank_alt_image_with_an_override_is_accepted`: override "Digital Hub logo": 200. Guard, green before and after.
7. `Choosing_a_blank_alt_image_keeps_the_stored_override`:
   - Store image A with override "Logo".
   - PUT only `{ version, defaultShareImageId = blankAlt }`: 200, because the stored override stays.
   - Seeds two assets; `finally` cleans up both.
   - Guard.
8. `A_decorative_image_with_library_alt_is_accepted`: `Decorative = true`, `Alt = "Logo"`, no override: 200. Guard.

Import, `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`. Both use `InTransactionAsync`, `SeedAsync`, `ExportAsync`, `Edit`, `EmptyAsync` and `ImportAsync`, as `A_bundle_with_one_invalid_document_changes_nothing` (line 129) does.

9. `A_default_share_image_without_alt_text_of_its_own_is_not_imported`:
   - Edit the exported bundle:
     - `tables.media[0].alt = ""` and `decorative = true`.
     - `tables.settings[0].defaultShareImageId = MediaId`, with `defaultShareImageAltOverride` absent or null.
   - Import: `Ok` is false, and `Problems` contains one that starts with `"settings 80000000-0000-0000-0000-000000000001: defaultShareImageAltOverride"`.
   - `SiteSettings` and `Media` counts are 0, and the target folder is empty.
   - Repeat with `decorative = false` (the old site's case): refused the same way.
   - Repeat with `force: true`: refused the same way.
   - **Red before the fix (`Ok` true).**
10. `A_default_share_image_with_an_override_imports`: the same bundle with `defaultShareImageAltOverride = "Digital Hub logo"`. `Ok` is true, and the settings row has that id and override. Guard.

Studio, `studio/test/settingsShareImage.test.tsx`:

11. `a refused save shows the field error under the default share image alt text`:
    - The PUT mock answers 400 with this body: `{ code: "validation_failed", title: "One or more fields are invalid.", errors: { defaultShareImageAltOverride: ["This image has no alt text of its own. Add alt text for the default share image."], version: ["Version is required."] } }`.
    - After Save, the alt message is visible inside the alt field's form item.
    - The title paragraph "One or more fields are invalid." is still shown (finding 4).
    - Nothing breaks on the unmatched `version` key.
    - A following save that the mock answers 200 clears the alt message.
    - **Red before the fix**, because only the title is shown.

Red run (quote the exit code and counts). From `api/`:
- `dotnet build DigitalHub.slnx -c Release`
- `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests|FullyQualifiedName~ContentBundleTests"`. Expected: 6 failed (tests 1-5 `Expected: BadRequest Actual: OK`, and test 9), with tests 6-8 and 10 passing.

From `studio/`:
- `npx vitest run test/settingsShareImage.test.tsx`. Expected: 1 failed (test 11).

After the fix, the commands CI runs (`.github/workflows/ci.yml`; finding 6):
- API job (`working-directory: api`):
  - `dotnet tool restore`
  - `dotnet build DigitalHub.slnx -c Release`
  - `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`, the full integration suite on `DigitalHubContent_Test`. Quote the totals against the base count.
- Studio job (`working-directory: studio`, ci.yml 232-276): `npm ci`, `npx tsc -b`, `npm test`, `npm run build`, then Playwright.
  - `studio/package.json` has no lint or format script, so none is run.
- End-to-end (`npx playwright test`): the local harness is broken, so NOT RUN locally. The CI Studio job covers it, and `studio/e2e/settings.spec.ts` must stay green. Quote the run id.
- The website job is unaffected, because no `website/` file changes. It runs in CI.
- CI, Security (including gitleaks) and Workflow lint green on the PR head, with run ids quoted.

G3 checklist (`docs/changes/README.md`):
- [ ] The finding, its evidence and its fix come from the audit (ADM-12), its gate-2 follow-up, and this review (all quoted in sections 1 and 2).
- [ ] Regression tests committed and shown failing before the fix (tests 1-5, 9 and 11).
- [ ] End-to-end test for each Major: not applicable, this is a Minor. The existing settings e2e stays green.
- [ ] Every Minor left unfixed has a D-NNN entry or a named follow-up: ADM-12d (card-image test) is named in section 4.

## 6. Security impact

- Routes and policies: `PUT /api/v1/settings` keeps the same admin policy. It gains one more 400 field error in the existing RFC 7807 `validation_failed` shape, with no internals.
- Import tool: it gains one more blocking problem. Its access, its database login and its `--force` rules are unchanged.
- Data: one read-only lookup of a media row by id on each path. No new writes; validation only gets stricter.
- Logins, secrets, dependencies: none, and no new packages.
- Content integrity: closes both paths to a default share image with no alt text of its own.

## 7. Migrations

None. No schema or data change.

## 8. Rollback

Revert the pull request. There is no schema or data to undo.

## 9. Owner decisions needed

None. The scope is the owner's request as worded, applied to both write paths. Two choices are recorded for the owner to overrule at the PR if they wish, and neither needs an answer before building:
- Refusing every settings save while a bad pair is stored (section 3, first rejected alternative). This follows the tech lead's acceptance of ADM-12 Minor 2 on PR #70, not an owner decision.
- The importer refusing such a bundle even with `--force`.

## 10. Risks

- **Existing bad data blocks unrelated settings saves.** Intended (section 3). Test 5 proves it and proves that the message names the field to fix. The G3-1 build from the Studio database shows whether such data exists.
- **A real bundle is refused.** If the old site's settings point at an image with no alt and no override, the import of real content stops. The problem line names the row and the field, and the fix is an override in the source before export. Tests 9 and 10 cover both outcomes.
- **Wrong stored-value logic for partial bodies.** Tests 3, 5 and 7 cover both directions, and the existing `A_save_without_the_share_image_fields_keeps_them` stays green.
- **Refusing images that do have alt.** Test 8 (decorative with library alt) and test 6 (override).
- **The importer looks the asset up in the wrong place.** Test 9 uses an asset that exists only in the bundle, because the target is emptied first. A target-only asset uses the same method through `db.Media`. No extra test, because the lookup is a single `AsNoTracking` read.
- **Stale or unmatched Studio field errors.** Test 11 checks the title, the unmatched key and the clear on success.
- **Leftover rows between facts.** `CleanUpAsync(params Guid[])` runs in every `finally`, and the class runs serially in the `SqlServer` collection.
- **Merge order with PR #70.** No shared files. The second to merge reruns CI on its rebased head.
- **Check-then-save race** (the asset is edited between the read and the save). This is the same race ADM-12 accepted. Once the settings row is saved, ADM-12's library check sees that use.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A blank-alt image with no override is refused by the settings save, and nothing changes | Owner request; ADM-12 test-report Minor 1 | Planned | |
| A whitespace override counts as blank | ADM-12 rule (`MediaUsage.cs:137`, `.Trim() == ""`) | Planned | |
| A non-decorative blank-alt asset is refused too | plan-review Round 1, finding 2 | Planned | |
| A partial body uses stored values (clearing the override is refused, keeping it is accepted) | ADM-10 keep-on-omit (`AdminStore.cs:287-291`) | Planned | |
| A save with no share fields over a stored bad pair is refused | plan-review Round 1, finding 3 | Planned | |
| An override, or alt in the library, is accepted | `AltText.Effective` | Planned | |
| The importer refuses a bundle with the bad pair, `--force` included, and imports one with an override | plan-review Round 1, finding 1 (Major) | Planned | |
| The Studio shows the refusal at the alt field, keeps the title, skips unmatched keys | Caller's brief; plan-review Round 1, finding 4 | Planned | |
| Page share images: reverse order closed at publish | ADM-12 delivery-approval | Planned | `ContentPublishTests.cs:133` (existing; to be re-run) |
| Page card images: publish check exists without a test | ADM-12 delivery-approval; plan-review Round 1, finding 5 | Planned | Moved to follow-up ADM-12d |
| Independent of ADM-12's merge order; no PR #70 file touched | Caller's brief | Planned | |
| Failing tests committed first; CI's exact commands and all suites green | G3 checklist; plan-review Round 1, finding 6 | Planned | |

## 12. Revision log

- **Round 0** (first plan, 2026-11-19): no review yet.
- **Round 2** (2026-11-19), answering `plan-review.md` Round 1 (CHANGES NEEDED, 1 Major, 7 Minors):
  1. **Major, importer.** Taken in scope, option (a).
     - New shared `AdminStore.DefaultShareImageAltError`, used by `UpdateSettingsAsync` and by the `ContentBundle.CheckAsync` settings loop. The asset is looked up in the bundle, then on the target, and a failure is reported as a blocking problem.
     - Failing `ContentBundleTests` fact 9, with guard 10.
     - Section 2 now lists two write paths and no longer says "Settings are the only gap". Sections 1, 3, 4, 5, 6, 10 and 11 are updated to match.
  2. **Minor, blank alt is not only decorative.** Section 2 is corrected: stored data can hold non-decorative blank alt (importer, direct writes). The "same answer under `AltError`" rationale is removed, and the rule is stated as ignoring `Decorative`. Guard test 4 added; it is red, because today such a save returns 200.
  3. **Minor, every-save behaviour.**
     - Test 5 added: a bad pair written directly, then PUT `{ version, email }`, gives 400 and nothing changes.
     - "Refuse only when the pair changes" is listed under rejected alternatives, with the reasons.
     - The precedent is restated accurately: tech-lead acceptance at ADM-12 gate 2, PR #70 not merged, not an owner decision. Section 10's claim now points at test 5.
  4. **Minor, unmatched error keys.** Section 3: keys with no form field (for example `version`) are skipped, and the title paragraph always shows. Test 11 asserts the title, sends an unmatched `version` key, and checks the clear on success.
  5. **Minor, page evidence.** Share images: `ContentPublishTests.cs:133` is named in sections 2 and 11. Card images: there is no existing test, the gap is stated plainly, and follow-up ADM-12d is named in section 4. No test is added here.
  6. **Minor, commands.** Section 5 now lists exactly what `.github/workflows/ci.yml` runs for the API and Studio jobs. Lint and format are dropped, because `studio/package.json` has neither.
  7. **Minor, line references.** Corrected: keep-on-omit `AdminStore.cs:287-291`, `SiteSettingsUpdate` 1048-1089, `SettingsPage.tsx` failure branch 110-114, `http.ts:6`.
  8. **Minor, cleanup.** `CleanUpAsync(params Guid[] media)` deletes every seeded id. Tests 5 and 7 clean up all their assets in `finally`, and the existing callers are unchanged.
