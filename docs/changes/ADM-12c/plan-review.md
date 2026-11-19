# ADM-12c plan review

## Round 1

Reviewed `docs/changes/ADM-12c/plan.md` (Round 0, 2026-11-19) on `change/ADM-12c`, base `cdef7c9`, against the code at that base and the ADM-12 records on `origin/change/ADM-12`.

### Findings

**1. Major — Sections 2, 3 and 4: the content import tool writes the same bad pair, and the plan does not mention it.**

- What is wrong: section 2 says "Settings are the only gap", and that `UpdateSettingsAsync` is the only place that checks the share image. There is a second write path for site settings. The design puts the new check inside `UpdateSettingsAsync`, so that path does not get it.
- Evidence: `api/tools/DigitalHub.ContentImport/ContentBundle.cs:454-458` checks each imported settings row with `AdminStore.CheckSettings(SettingsRequest(settings))`. `AdminStore.cs:825` defines `CheckSettings` as `ValidateSettings(request)`, which is synchronous and has no database access. `ContentWriter.cs:1503` then writes `DefaultShareImageId` and `DefaultShareImageAltOverride`. The same tool keeps media rows with no alt as a warning only, including assets that are not decorative (`ContentBundle.cs:434-439`, "keeps rows that predate it (the old site's images without alt text)"). So a bundle can set a blank-alt default share image with no override. This path is how `DigitalHubContent_Studio` gets content, and G3-1's "Done when" is "A clean website build from `DigitalHubContent_Studio`". `ContentBundleTests.cs` already covers this tool.
- What would satisfy me: the plan either (a) gives the importer the same rule, for example with a check both callers share that `ContentBundle` reports as a problem, plus a failing `ContentBundleTests` fact, or (b) puts the importer out of scope by name, with the reason and a follow-up id or D-NNN. Either way, section 2 must stop saying settings saves are the only gap.

**2. Minor — Section 2: "only a decorative asset can have a blank `Alt`" is not true for stored data.**

- Evidence: the importer accepts media that is not decorative and has no alt (finding 1). The test seeds write `MediaAsset` directly. The design does not depend on this claim, because it uses `AltText.Effective` and ignores `Decorative`, which is correct. The rationale "Under `AltError` the two give the same answer" is therefore only true for rows written through the Studio.
- What would satisfy me: correct the sentence, and add a guard test that a non-decorative asset with blank `Alt` and no override is refused as well.

**3. Minor — Sections 3, 5 and 10: the "every save is refused" behaviour has no test, and its alternative is not listed.**

- What is wrong: section 3 deliberately refuses every settings save, including ones that touch no share field, while the stored pair is bad. Section 10 says "Test 1 proves the message names the field to fix", but test 1 starts from a clean row and sends the share fields. No test sends a body without the share fields over a stored bad pair. Test 3 is close to this but sends the override. There is also a real alternative that is not under "Rejected alternatives": refuse only a save that changes the share id or the override, so creating a bad pair is still impossible but existing bad data does not lock the whole form. The precedent cited is ADM-12's Minor 2. That was accepted by the tech lead at gate 2 of a PR that is still open, not by the owner.
- What would satisfy me: add a fact that writes a bad pair directly, then PUTs `{ version, email }` and expects 400 on `defaultShareImageAltOverride` with nothing changed. List the "only when the pair changes" alternative with its reason for rejection. Describe the precedent accurately (tech-lead acceptance, PR #70 not merged).

**4. Minor — Section 3, Studio: what happens to error keys that do not match a field.**

- Evidence: `ValidateSettings` and `UpdateSettingsAsync` can return `version` (`AdminStore.cs:242-243`), which has no `Form.Item`. The plan maps every `problem.errors` key through `form.setFields`.
- What would satisfy me: one line on unmatched keys, for example that they are skipped and the title paragraph still shows. Test 7 should also check that the title paragraph is still shown.

**5. Minor — Section 5 and section 11: the reverse-order claim for page share and card images has no named evidence.**

- Evidence: `ContentPublishTests.cs:133` does cover the share image (`shareImage`). I found no test of the `fields.imageId` card-image alt check (`PublishChecks.cs:93-100`, the `"image"` error key). The coverage row "Reverse order checked for page share and card images" has nothing planned in its Evidence column.
- What would satisfy me: name `ContentPublishTests.cs:133` as the evidence for share images. For card images, either name an existing test or state the gap plainly and give it a follow-up. This change does not need to add the test.

**6. Minor — Section 5: the "lint, format" commands do not exist.**

- Evidence: `studio/package.json` has no lint or format script. The CI Studio job runs `npx tsc -b`, `npm test`, `npm run build` and Playwright (`.github/workflows/ci.yml:232-276`). The API job runs `dotnet build DigitalHub.slnx -c Release`.
- What would satisfy me: list the exact commands CI runs, and drop the ones that do not exist.

**7. Minor — Section 2: stale line references.**

- Evidence: keep-on-omit is at `AdminStore.cs:287-291`, not 281-285. `SiteSettingsUpdate` is at 1048-1089, not about 1069-1082. The failure branch of `SettingsPage.tsx` `save` is at 110-114.
- What would satisfy me: correct the references so the developer and the tester land on the right lines.

**8. Minor — Section 5, tests 5 and 6: cleanup for two assets.**

- Evidence: `CleanUpAsync(Guid media)` (`SettingsShareImageTests.cs:190-198`) deletes one media row. Test 5 seeds two. The class comment requires every seeded row to be deleted in `finally`, because `MediaUsage` counts the settings row.
- What would satisfy me: say that the helper takes several ids, or that each id is cleaned up.

### Checked and found sound

- **Fit**: the owner's request is quoted exactly. The ADM-12 audit text (`admin-audit-2026-10-28.md:202-208`) and the G3-1 row and "Done when" (`refinement-plan-2026-10-28.md:225`) are quoted word for word. The ADM-12 test-report Minor 1 and its ADM-12c follow-up are on `origin/change/ADM-12` as cited.
- **Current state**: `UpdateSettingsAsync` checks only that the image exists (`AdminStore.cs:244-247`). `AltText.Effective` behaves as described. The `PublishChecks.cs:91` share-image rule ignores `Decorative`. `website/src/seo/head.ts` falls back to the title. `Problem.errors` exists (`studio/src/api/http.ts:6`). `SettingsPage` shows only the title. `SeedMediaAsync` always seeds alt.
- **Design**: computing "sent ? request : stored" per field matches the keep-on-omit code. Reusing `AltText.Effective` keeps one rule. A 400 `validation_failed` field error on `defaultShareImageAltOverride` is the right shape, and rejecting 409 `alt_in_use` is a real alternative. No layering concern: the check stays in `AdminStore` (Content layer) and reads `db.Media`.
- **Scope and parallel work**: PR #70 changes `MediaUsage.cs`, `MediaLibrary.cs`, `MediaLibraryPage.tsx`, `MediaLibraryTests.cs` and `studio/test/mediaLibrary.test.tsx` (`git diff --stat cdef7c9...origin/change/ADM-12`). This plan touches none of them, and no users or error-pages files. All four listed files exist. One topic.
- **Testability**: tests 1-3 and 7 would fail today (the PUT returns 200, and the Studio ignores `errors`). Tests 4-6 are real guards. The red-run expectation follows from them. The commands run in Release. Tests run serially (`[Collection("SqlServer")]`), so the shared settings row is safe if cleanup holds. The Studio sends every form field on save (`onFinish` values), so the partial-body cases are API-only, as planned.
- **Gates**: nothing is weakened. No new gate. E2e is marked NOT RUN locally with CI as evidence, and `studio/e2e/settings.spec.ts` uses images that have alt, so it should stay green.
- **Security**: same route and admin policy, no record-scope change, no new dependency, no secrets, no migration, and database names are right.
- **Rollback**: reverting the PR is enough, because there is no schema or data change.

Round 1 verdict: CHANGES NEEDED.

## Round 2

Reviewed `plan.md` revision round 2 (2026-11-19). I checked each answer in section 12 against the code at `cdef7c9`. All of the Round 1 findings are resolved. The Minors below do not block the plan; they are for the developer and the tester.

### Findings

**1. Minor — Section 3, content import: looking in the bundle first does no harm, but it is not needed. Say why the lookup is correct.**

- Evidence: `ContentBundle.cs:217-232` imports every table and calls `SaveChangesAsync` inside the import transaction, and only then calls `CheckAsync`. The media table (line 64) comes before settings (line 78). So when the settings loop runs, `db.Media` already holds the bundle's assets as the bundle states them, including a `--force` overwrite of a target asset. A single `db.Media` read would therefore be correct in every case.
- Why it matters: with both lookups, the bundle row has to win over the target row, and the plan does say bundle first. Reading only `db.Media` is simpler, and it gives the same answer.
- What would satisfy me: the developer either keeps the bundle-first order or reads only `db.Media`. `implementation.md` should say which, and why the answer is right.

**2. Minor — Section 5, test 9: the `force: true` repeat does not exercise a force branch.**

- Evidence: test 9 empties the target first, so the import has no conflicts and `options.Force` changes nothing (`ContentBundle.cs:227`). The claim "`--force` does not bypass it" holds by construction, because `CheckAsync` runs whether or not `--force` is set. The repeat proves only that the result is the same.
- What would satisfy me: the developer runs the forced repeat against an existing row, as `A_media_path_outside_media_is_refused_with_and_without_force` does (lines 419-435). That means the bundle's settings or media row differs from a newer target row. Or `implementation.md` says plainly that the forced repeat runs on an empty target.

**3. Minor — Section 5, test 5: the direct write needs a settings row.**

- Evidence: `ExecuteUpdateAsync` on `SiteSettings` updates zero rows when no row exists. The class does not guarantee a row, because facts run in no fixed order.
- Why it matters: this cannot make the test pass when it should fail. After the fix it would fail instead, which makes it flaky.
- What would satisfy me: test 5 first makes sure the row exists, for example with an ordinary PUT, then writes the bad pair, and asserts that the update touched one row.

**4. Minor (note, no change asked) — the import has a forward order of its own.**

- Evidence: a bundle can change a media row's alt to blank while the settings row stays on that asset. The loop at 454-458 checks the bundle's settings row against the asset in its imported state (finding 1), so this case is caught whenever the bundle carries a settings row, which every export does (`singleton: true`, line 78).
- Gap: only a hand-made bundle with an empty `settings` table, over a target settings row, would get past the check.
- Note for the tech lead: the tech lead may add this to ADM-12d or leave it. It is not in the owner's request.

### Round 1 findings, checked

- **Finding 1 (Major, importer): resolved.**
  - The shared `AdminStore.DefaultShareImageAltError` sits beside `CheckSettings` and is used by both paths.
  - The importer reports it through `Report(problems, "settings", id, ...)` (line 478). That gives the `"settings 80000000-0000-0000-0000-000000000001: defaultShareImageAltOverride: ..."` prefix test 9 expects. The settings id matches the seed at `ContentBundleTests.cs:795`, and `MediaId` matches line 31.
  - Problems cause `UndoAsync`, so the rows are rolled back and no file is written (lines 244-248). "Changes nothing" therefore holds.
  - Rejecting "warning only" and "leave the importer out" are real alternatives.
  - `ContentBundle.cs` is not in PR #70. It only calls `MediaLibrary.MetadataError`, which PR #70 does not change.
- **Finding 2: resolved.** Section 2 is corrected. The rule ignores `Decorative`, and test 4 covers a non-decorative asset with blank alt.
- **Finding 3: resolved.**
  - Test 5 covers the every-save refusal (subject to Minor 3).
  - "Refuse only when the pair changes" is listed and rejected with reasons.
  - The precedent is now described accurately, and section 9 leaves both choices to the owner at the PR without assuming an answer.
- **Finding 4: resolved.** Unmatched keys are skipped and the title always shows. Test 11 sends `version`, and checks the title and the clear on success.
- **Finding 5: resolved.** `ContentPublishTests.cs:133` is named for share images. The card-image gap is stated, and **ADM-12d** ("Test the card-image alt check at publish", a `ContentPublishTests` fact for the `image` key at `PublishChecks.cs:93-100`) is named in section 4, with the coverage row marked "Moved to follow-up ADM-12d". That meets the moved-item rule. The tech lead records it.
- **Finding 6: resolved.**
  - The commands match `.github/workflows/ci.yml`: the API job in `api/` runs `dotnet tool restore` and `dotnet build DigitalHub.slnx -c Release`, and the Studio job runs `npm ci`, `npx tsc -b`, `npm test`, `npm run build` and Playwright.
  - The test project path exists, and everything runs in Release.
  - The red-run expectation of 6 failed (tests 1-5 and 9) and 1 Studio failure follows from today's code, where each of those cases returns 200 or `Ok`.
- **Finding 7: resolved.** The line references match the code: `AdminStore.cs:287-291`, `1048-1089`, `SettingsPage.tsx:110-114`, `http.ts:6`.
- **Finding 8: resolved.** `CleanUpAsync(params Guid[] media)` cleans up every seeded asset, and existing callers are unchanged.

### Still sound from Round 1

- Scope stays one topic. There is no overlap with PR #70's files, and no users, error-pages, `PublishChecks.cs`, `ContentWriter.cs` or `website/` files are touched.
- No migration, no new route or policy, no dependency and no secret. Database names are right (`DigitalHubContent_Test` for integration; e2e in CI only, marked NOT RUN locally).
- No gate, guard or baseline is weakened.
- Rollback is real.
- No owner decision is assumed. Section 9 lists the two choices the owner may overrule at the PR, and neither blocks the build.

Verdict: APPROVED
