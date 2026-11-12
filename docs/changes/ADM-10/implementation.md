# ADM-10: implementation

Developer, 11 November 2026. Branch `change/ADM-10`, worktree `/home/user/dh-change-adm10`.
Plan: `plan.md` round 2 (`1059d39`). Gate 1: `plan-approval.md` at `b2889cd`, which ends
`Verdict: APPROVED`, with conditions.

## Owner answers

Both answers were given on the owner's cards and relayed to me by the coordinator. These
are the owner's words as the coordinator quoted them:

- **O-ADM10-2, website alt: answered, option (a).** "Yes, add it and use it" (on its card,
  14:07 UTC, 11 November 2026). `plan.md` section 9 still says PENDING. I have not edited
  `plan.md`, because the developer does not change the plan. This file is the record of
  the answer. Everything marked "only if (a)" in the plan is now built.
- **O-ADM10-1, push the tests-only commit first: answered "Yes".** "Yes, red tests first"
  (on its card, 14:07 UTC, 11 November 2026).
  - The coordinator directed this sequence:
    1. Push commit 1 alone, by SHA.
    2. The coordinator opens the draft pull request and watches the CI run.
    3. I push the rest only after the coordinator says jobs `api`, `website` and `studio`
       have finished on commit 1.
  - The CI result at commit 1 is not recorded yet (section "CI at commit 1").

## Base (condition 1)

`git fetch origin`, then `git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD`:
exit 0. `origin/rebuild/dotnet-platform` is `32f0414`, the plan's base, so no merge was
needed.

## Commits

The first local history (`8e4d87f`, `7528184`, `ecf3dfa`, `99615cb`, `45436fa`) was built
before O-ADM10-2 was answered. It was never pushed. I rebuilt it from `b2889cd` so that the
(a) tests sit in the tests-only commits, before every fix (approval, "Owner decisions";
plan 5.2). The old tip is kept on the local branch `adm10-pre-rebuild` only.

| # | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 | `b1521f5` | ADM-10: Add failing API, website and end-to-end tests for the share image | `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs` (T1 to T5), `studio/e2e/settings.spec.ts` (E1), `website/test/seo.test.tsx` (W1, W2) |
| 2 | `bf29cb2` | ADM-10: Add failing Studio tests for the share image control | `studio/test/settingsShareImage.test.tsx` (S1 to S4) |
| 3 | `54bd132` | ADM-10: Keep the default share image when a settings save leaves it out | `api/src/DigitalHub.Api/Content/AdminStore.cs` |
| 4 | `884bca6` | ADM-10: Add a default share image control to Site settings | `studio/src/pages/SettingsPage.tsx` |
| 5 | `daa3de9` | ADM-10: Use the settings alt with the default share image on the website | `website/src/seo/head.ts` |
| 6 | `8694853` | ADM-10: Implementation record | `docs/changes/ADM-10/implementation.md` |
| 7 | `73dc514` | ADM-10: Record the red CI run at commit 1 | `docs/changes/ADM-10/implementation.md` |
| 8 | `8b9feff` | ADM-10: Record the green CI run at the head | `docs/changes/ADM-10/implementation.md` |
| 9 | this commit | ADM-10: Record screenshot parity at the head; ready for test | `docs/changes/ADM-10/implementation.md` |

**Pushed:**
- Commit 1 (`b1521f5`) went alone first, with `git push origin b1521f5:refs/heads/change/ADM-10`.
- After the coordinator reported that commit 1's run had finished (section "CI at commit 1"),
  the rest went by head SHA with `git push origin <head>:refs/heads/change/ADM-10`. This is
  not a bare push and not a force push; it is a fast-forward from `b1521f5`.
- Commit 7 (this update) records the CI result.

## What changed, by the plan's Scope (section 4)

- **`AdminStore.cs`** (3.1):
  - `SiteSettingsUpdate`: `DefaultShareImageId` and `DefaultShareImageAltOverride` have
    backing fields. Their setters set `DefaultShareImageIdSent` and
    `DefaultShareImageAltOverrideSent`. The flags are `internal bool { get; private set; }`
    (condition 3), with no public flag and no `[JsonIgnore]`.
  - `UpdateSettingsAsync` copies each field only when its flag is set.
  - When the id was sent, is not null and no `db.Media` row has it, the save adds
    `defaultShareImageId: "Choose an image from the media library."`. This check sits
    next to the version error, before the version check.
  - `ValidateSettings` adds `LimitText(errors, "defaultShareImageAltOverride", ..., 300)`.
  - Nothing else in the file changed.
- **`SettingsPage.tsx`** (3.2):
  - The type gains `defaultShareImageId` and `defaultShareImageAltOverride`.
  - A local `ShareImageField` shows the chosen image as a thumbnail and its path. It
    reads them from `GET /api/v1/media/{id}` when the value changes, and drops stale
    replies.
  - If the image is not found, it shows "The chosen image is no longer in the library."
    If nothing is chosen, it shows "No image chosen. Pages without their own share image
    have none."
  - It has "Choose image" (or "Change image") and "Clear", and is registered as
    `<Form.Item label="Default share image" name="defaultShareImageId">` after "Default meta
    description".
  - Next comes `<Form.Item label="Default share image alt text" name="defaultShareImageAltOverride">`
    with `<Input maxLength={300} />`. Its `extra` text: "The alt text for the default share
    image, on pages that use it. Empty uses the page title." Choosing an image does not
    copy the library alt into it.
  - `<MediaPicker>` is a sibling of the `<Form>`. Its `onSelect` calls
    `form.setFieldValue("defaultShareImageId", choice.id)`.
  - It uses antd `Space` and `Button`, with no new CSS.
- **`head.ts`** (3.3): `shareImage()` uses
  `own || fallback || documentTitle(item)`. `fallback` is the trimmed settings alt, and
  applies only when the item has no `shareImageId` of its own.
- **New tests:** `SettingsShareImageTests.cs`, `settingsShareImage.test.tsx`,
  `settings.spec.ts`, and W1 and W2 in `seo.test.tsx`.
- **Not changed (condition 2):** `MediaPicker.tsx`, `ItemEditorPage.tsx`, `FormWalker.tsx`,
  `rich-text.spec.ts`, and every workflow, lockfile and migration. `npm ci` in `studio/`
  and `website/` changed no tracked file.

### Notes on the tests as written

- **T1 to T5:**
  - Each test seeds its own `MediaAsset` row, with a random hash.
  - Its `finally` nulls both settings fields with `ExecuteUpdateAsync`, then deletes the
    row with `ExecuteDeleteAsync` (plan 5.1, "Cleanup").
- **E1:**
  - It draws two 16 by 16 PNGs on a browser canvas, `rgb(220, 30, 40)` and
    `rgb(20, 60, 210)`, and sets the top-left pixel from the run stamp.
  - It asserts `duplicate: false` on both uploads and that their ids differ. It records
    an id only after that assertion, and deletes only the ids it recorded.
  - It uses `getByLabel("Email", { exact: true })`, and restores every key it read, at
    the current version.
  - It clicks "Choose image" when the stored id is null and "Change image" otherwise.
- **W1 and W2** use a copy of `snapshotContent()`. Its settings get
  `defaultShareImageId = media[0].id` and alt "Digital Hub logo" (or `null` in W2's last
  case).
  - W1: `/cases/national-portal` has no `shareImageId` of its own. It gets that media's
    path, and the alt "Digital Hub logo".
  - W2: `/about` has its own image. With its own override it keeps that override.
    Without one it gets `documentTitle`. With the settings alt `null`, the fallback page
    gets `documentTitle`.
- **S1 to S4** keep `listPaging.test.tsx`'s `afterEach` verbatim.
  - The handler answers `GET /api/v1/settings`, `GET /api/v1/media/m-001`,
    `GET /api/v1/media/m-002`, `GET /api/v1/media?...` and `PUT /api/v1/settings`. It
    throws on anything else.
  - S1 asserts that the alt is sent back. S2 asserts that `m-002` was requested, and that
    the alt in the body and in the input is still "Digital Hub logo". S4 asserts that the
    alt input is disabled.

### Finding for the tester: T2 is red at the base too (the plan's prediction was wrong)

- Plan 5.1 lists T2 as "Green (guard)". 5.2 expects job `api` at commit 1 to fail on
  "T1, T3, T4 and T5".
- But T2 includes the plan's own second assertion, "Sending only the alt changes only the
  alt". At the base, a body with only `defaultShareImageAltOverride` copies null over the
  id (plan 2.1). So `Assert.Equal(media, ShareImageId(afterAlt))` fails. The explicit-null
  half passes.
- I did not weaken the test.
- **Expected CI red at commit 1, job `api`: T1, T2, T3, T4 and T5.** Only the prediction
  is wrong. Design and scope are unaffected, so this is not BACK TO ARCHITECT.

## Commands run

Environment: Node `v22.23.4`. `which dotnet` finds nothing. I tried to fetch the official
install script with `curl -sSL https://dot.net/v1/dotnet-install.sh`. It exited 56,
"CONNECT tunnel failed, response 403": the proxy refused `builds.dotnet.microsoft.com`.
No SQL Server is reachable. `npm ci` exited 0 in `studio/` and in `website/`, from the
lockfiles. I touched no database.

### At commit 1 (`b1521f5`), tests only

| Command | Exit | Output |
| --- | --- | --- |
| `cd website && npx vitest run test/seo.test.tsx` | 1 | `× uses the settings alt with the default share image`. `Expected: "Digital Hub logo"`, `Received: "National e-services portal for a government ministry"`. `Tests 1 failed \| 11 passed (12)`: W1 is red, and W2 and every existing case pass |
| `cd website && npm run typecheck` | 0 | none |
| `cd website && npx vitest run` | 1 | `Test Files 1 failed \| 22 passed \| 1 skipped (24)`, `Tests 1 failed \| 430 passed \| 31 skipped (462)`. The one failure is W1 |
| `cd studio && npx tsc -b` | 0 | none |
| `cd studio && npm test` | 0 | `Test Files 12 passed (12)`, `Tests 94 passed (94)`: unit tests are green at commit 1, as 5.2 needs |
| `cd studio && npx tsc --ignoreConfig --noEmit --strict --target ES2023 --lib ES2023,DOM --module ESNext --moduleResolution bundler --skipLibCheck --types node e2e/settings.spec.ts e2e/redirects.spec.ts` | 0 | An ad hoc check of E1, which is outside `tsconfig.node.json`'s `include`. Run on the first build of this spec; the file is byte-identical in `b1521f5`. Not a CI step |
| `cd api && dotnet build DigitalHub.slnx -c Release` | NOT RUN | No `dotnet`, and it cannot be installed. CI job `api` |
| T1 to T5 red | NOT RUN locally | Needs `dotnet` and `DigitalHubContent_Test`. **Shown red in CI**, job `api`, run 43036287741 (see "CI at commit 1") |
| E1 red | NOT RUN locally | Needs the API and `DigitalHubContent_E2e`. **Shown red in CI**, job `studio`, attempt 4 (131027779373), by test timeout. The locator is not named in the log |

### At commit 2 (`bf29cb2`), tests only

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npx vitest run test/settingsShareImage.test.tsx` | 1 | All four fail: `× a save sends the stored default share image and its alt back`, `× choosing an image in the picker saves its id`, `× Clear saves an explicit null`, `× an editor sees the share image but cannot change it`. Each gives `TestingLibraryElementError: Unable to find an element with the text: /media/001.png`. `Tests 4 failed (4)` |
| `cd studio && npx tsc -b` | 0 | none |

All four stop at the first step that needs the missing control. That is earlier than the
"body has neither key" cause in the plan's table, but it is the same missing control.

### At commit 4 (`884bca6`), the Studio fix

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npx tsc -b` | 0 | none |
| `cd studio && npx vitest run test/settingsShareImage.test.tsx` | 0 | `Tests 4 passed (4)` |
| `cd studio && npm test` | 0 | `Test Files 13 passed (13)`, `Tests 98 passed (98)` |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 1.40s`, `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |

In the first round, `npm run build` without `VITE_PUBLIC_SITE_URL` exited 1 with
"VITE_PUBLIC_SITE_URL is not set". That was my omission: CI sets
`https://website.ci.invalid` (`ci.yml`, step "Build"). It was not a code fault.

### At commit 5 (`daa3de9`), the website fix

| Command | Exit | Output |
| --- | --- | --- |
| `cd website && npm run typecheck` | 0 | none |
| `cd website && npx vitest run test/seo.test.tsx` | 0 | `Tests 12 passed (12)` |
| `cd website && npx vitest run` | 0 | `Test Files 23 passed \| 1 skipped (24)`, `Tests 431 passed \| 31 skipped (462)`. The skips are in files this change does not touch |
| `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `Build output checks passed.` |
| Section comparison and screenshot parity | NOT RUN locally | Both are green in CI at `8b9feff`: `section-compare` 131036544632 and `screenshot-parity` 131036544539 (comparison not yet approved parity, see "CI at `8b9feff`") |

### Not run locally, covered by CI at the head

- `dotnet build DigitalHub.slnx -c Release`, and `dotnet test` in full: there is no
  `dotnet` here. CI job `api` ran both at `73dc514`: 545 of 545 passed.
- The 5.3 filter (`SettingsShareImageTests`, `SettingsVersionTests`, `CookieSettingsTests`,
  `Section5Tests`, `ContentBundleTests`, `AdminApiTests`): it was not run as a separate
  filtered command. Every one of these classes is inside that full run.
- `npx playwright test`: needs SQL Server. CI job `studio` ran it at `73dc514`: 32 of 32
  passed, including E1 and `appearance.spec.ts`.

## CI at commit 1

Pushed alone: `b1521f5`. Run 43036287741 (workflow CI), on PR #56 (draft), attempts 1
to 4. The coordinator read the logs and relayed them; I have not seen them myself. Every
attempt is listed here, so no rerun hides a result.

| Job | Attempt / job id | Result |
| --- | --- | --- |
| `api` | 1 / 130575850302 | Red. "Total tests: 545, Passed: 540, Failed: 5". The five failures are exactly T1 to T5. See the table below |
| `api` | 2 / 130586030225 | Red, the same five: "Total tests: 545, Passed: 540, Failed: 5" |
| `website` | 1 / 130575850555 | Red, on W1 only: "expected 'National e-services portal for a government ministry' to be 'Digital Hub logo'" at `seo.test.tsx:81`. 430 passed, 31 skipped |
| `website` | 2 / 130586030140 | Red, the same (W1 only) |
| `website` | rerun / 131027779401 | Red, the same (W1 only) |
| `section-compare`, `screenshot-parity` | all attempts | **Skipped**, not passed, because `website` was red (`needs: website`, condition 4). They are still to be shown green on the final head |
| `studio` | 1 / 130575849881 | Infrastructure failure. Unit tests 94/94 passed. Then the sqlcmd/browser apt install failed with "Temporary failure resolving 'azure.archive.ubuntu.com'" (apt exit 100), before any end-to-end test ran |
| `studio` | 2 / 130586029703 | The same infrastructure failure; no e2e test ran |
| `studio` | 3 / 130628238370 | The same infrastructure failure; no e2e test ran |
| `studio` | 4 / 131027779373 (12 Nov 07:09 UTC) | Unit tests green. End-to-end "1 failed, 31 passed". The one failure is E1 (`settings.spec.ts:73`), see below |
| `website-browser` | 130575850546, 130586030315, 130628238493 | The same apt/DNS infrastructure failure, before any test ran |

**`api`, T1 to T5, as relayed:**

| Test | Failure |
| --- | --- |
| T1 `A_save_without_the_share_image_fields_keeps_them` | expected the id, got null |
| T2 `An_explicit_null_clears_the_share_image_and_its_alt` | expected the id, got null. This is the alt-only half, as predicted above |
| T3 `An_unknown_media_id_is_refused_and_changes_nothing` | expected BadRequest, got InternalServerError (G-1) |
| T4 `An_alt_override_over_300_characters_is_refused` | expected BadRequest, got InternalServerError (G-2) |
| T5 `The_build_content_carries_the_saved_share_image` | expected the id, got null |

These results also show that `SettingsShareImageTests.cs` compiles and runs against the
base API in job `api`. The fix in `AdminStore.cs` has not been compiled yet. That happens
on the full head.

**E1 is red by a test timeout. The run does not prove it stopped at "Choose image".**
- Failure: "Test timeout of 90000ms exceeded". Then, in the cleanup, "apiRequestContext.get:
  Target page, context or browser has been closed" at `settings.spec.ts:135`.
- The log does not name the locator that E1 was waiting on, and the trace artifact could
  not be downloaded. So I record it only as red by timeout.
- The expected cause is that there is no "Choose image" button at the base. That is
  likely, because `getByRole("button", { name: "Choose image", exact: true }).click()`
  waits until the test times out. But this run does not prove it.

**Note for the tester: E1's cleanup cannot run after a timeout.**
- The `finally` block in `settings.spec.ts` (from line 132) uses the `request` fixture.
- When the 90-second test timeout fires, Playwright has already closed the context. So
  the first cleanup call (`request.get`, line 135) throws.
- After a timeout, then:
  - the settings row is not restored;
  - the two uploaded images are not deleted.
- At this red run, the base Studio could not choose an image. So the settings row most
  likely still held its original share image, though only the API changes before the UI
  steps had happened.
- The two images stay in `DigitalHubContent_E2e` until the next reset, which happens
  before every run.
- At a green run the `finally` runs normally.
- The coordinator directed that the test is not changed now. I leave it to the tester to
  judge whether this is a finding.

## CI at the full head

Head `73dc514`, pushed by SHA as a fast-forward from `b1521f5`. The coordinator read the
logs and relayed them.

| Workflow / job | Run / job id | Result |
| --- | --- | --- |
| CI, `api` | 43173375547 / 131031721416 | Success. "Total tests: 545, Passed: 545". T1 to T5 pass. This is the first compile of the fixed `AdminStore.cs`, in Release (plan 5.3). The full suite includes every class in the 5.3 filter: `SettingsShareImageTests`, `SettingsVersionTests`, `CookieSettingsTests`, `Section5Tests`, `ContentBundleTests` and `AdminApiTests` |
| CI, `studio` | 43173375547 / 131031721438 | Success. Unit tests "98 passed (98)". End-to-end "32 passed (4.7m)", including E1 (`settings.spec.ts:73`, 12.3s) and `appearance.spec.ts` |
| CI, `website` | 43173375547 / 131031721120 | Success |
| CI, `website-browser` | 43173375547 / 131031721414 | Success |
| CI, `section-compare` | 43173375547 / 131032075939 | Success. It was skipped at commit 1; it is green here (condition 4) |
| CI, `screenshot-parity` | 43173375547 / 131032077663 | **Skipped**, not passed. The job runs only on a pull request labelled "screenshots" (`ci.yml:353-357`, "Optional and manual"), the same as for earlier changes |
| Security | 43173375733 | Success |
| Workflow lint | 43173375511 | Success |
| CodeQL | 43173375540 | Skipped |

**Condition 4.** `section-compare` is green at `73dc514`. `screenshot-parity` was skipped
there, because PR #56 had no "screenshots" label then. Both are green at `8b9feff`, below.

## CI at `8b9feff`, with the "screenshots" label

The coordinator added the "screenshots" label to PR #56. Run 43174682660 on `8b9feff` was
cancelled by the run that the label started. It is listed so that nothing is hidden.

| Workflow / job | Run / job id | Result |
| --- | --- | --- |
| CI (cancelled) | 43174682660 | Cancelled by the label-triggered run below |
| CI, `api` | 43174717473 / 131036177727 | Success |
| CI, `studio` | 43174717473 / 131036177622 | Success |
| CI, `website` | 43174717473 / 131036177485 | Success |
| CI, `website-browser` | 43174717473 / 131036177672 | Success |
| CI, `section-compare` | 43174717473 / 131036544632 | Success |
| CI, `screenshot-parity` | 43174717473 / 131036544539 | Success: the "Chromium regression tests" and "Compare screenshots" steps both succeeded |

**A passing comparison is not approved parity.** `ci.yml:358-359` says: "The comparison
does not fail the workflow while the screenshot register waits for its first approved
entries. The Chromium regression tests do fail the job." The Chromium regression tests
passed, and they can fail the job. A green "Compare screenshots" step does not show that
the screenshots match approved entries.

`8b9feff` differs from `73dc514` only in `implementation.md`. So this run covers the same
code as run 43173375547.

Condition 4 is met. `section-compare` and `screenshot-parity` were recorded as skipped at
commit 1, and both are green on the final head.

## Migrations

None (plan section 7).

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A save without the share image fields keeps the stored image | ADM-10, "Treat a missing field as unchanged" | Done | `54bd132`. T1 and T5 red at `b1521f5` (job 130575850302), green at `73dc514` (job 131031721416) |
| The Studio form carries the image through every save | ADM-10, "or carry it through the save" | Done | S1 red at `bf29cb2` (exit 1), green at `884bca6` (exit 0). E1 red at `b1521f5` (131027779373, timeout), green at `73dc514` (131031721438) |
| A media picker on the Settings form (choose, change, clear) | ADM-10, "A media picker" | Done | S2 and S3 red at `bf29cb2`, green at `884bca6`. E1 green at `73dc514` (131031721438) |
| An alt override on the form | ADM-10, "alt override on the form"; O-ADM10-2 (a) | Done (unit) | S1, S2, S4 alt checks red at `bf29cb2`, green at `884bca6` |
| The website uses the settings alt with the default image | Found here (2.3); O-ADM10-2 (a) | Done | W1 red at `b1521f5` (exit 1), green at `daa3de9` (exit 0). W2 green at both. Design check and snapshot build exit 0 |
| An unknown media id is refused with 400, not 500 | Found here (G-1) | Done | T3 was 500 at `b1521f5`, and passes at `73dc514` (131031721416) |
| An alt over 300 characters is refused with 400, not 500 | Found here (G-2) | Done | T4 was 500 at `b1521f5`, and passes at `73dc514` (131031721416) |
| The saved image reaches the build content | FR-S-17; G3-1 exit gate | Done | T5 red at `b1521f5`, green at `73dc514` |
| Regression tests committed and shown failing before the fix | G3 checklist | Done | Tests-only commits `b1521f5` and `bf29cb2` come before the fixes. W1 and S1 to S4 are red locally. CI run 43036287741 at `b1521f5`: T1 to T5 red (`api`, 130575850302 and 130586030225); W1 red (`website`, 130575850555); E1 red by timeout (`studio`, 131027779373) |
| End-to-end test for this Major | G3 checklist | Done | E1 red at `b1521f5` (131027779373, timeout), green at `73dc514` (131031721438, 12.3s) |
| Editors can see but not change the share image | Settled design (roles) | Done (unit) | S4 red at `bf29cb2`, green at `884bca6` |
| FR-S-17 settings moves from "Partly" to "Works" | Audit, line 43 | Done, pending the tester | Every row above is done. CI is green at `73dc514` (run 43173375547) and at `8b9feff` (run 43174717473, `screenshot-parity` included) |

For the tester:
- T2 was red at the base on its alt-only half. The plan had predicted it green.
- At commit 1, E1 was red only by a test timeout. The log does not name the locator.
- E1's `finally` block cannot run after a timeout.
- The screenshot comparison passing is not approved parity.

Status: READY FOR TEST
