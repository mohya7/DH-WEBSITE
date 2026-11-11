# ADM-10: implementation

Developer, 11 November 2026. Branch `change/ADM-10`, worktree `/home/user/dh-change-adm10`.
Plan: `plan.md` round 2 (`1059d39`), gate 1 `plan-approval.md` at `b2889cd`, which ends
`Verdict: APPROVED` with conditions. This is a partial round. It holds only the parts
that are the same under either answer to O-ADM10-2, as the coordinator directed.

**Owner answers: both still PENDING.**

- **O-ADM10-1** (push the tests-only commit alone first): not answered. Nothing is pushed
  to `origin` and no pull request is open. Every commit below is local only.
- **O-ADM10-2** (website alt, (a) or (b)): not answered. `website/src/seo/head.ts`,
  `website/test/seo.test.tsx` (W1, W2), the alt assertions in S1 and S2, the S4 alt input
  check and the alt `Form.Item` are **not built**. The section "Pending on O-ADM10-2"
  below lists each one and where it goes.

## Base (condition 1)

`git fetch origin`, then `git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD`
gave exit 0 ("CONTAINS"). `origin/rebuild/dotnet-platform` is `32f0414`, the plan's base.
The base has not moved, so no merge was needed.

## Commits (local, not pushed)

| # | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 | `8e4d87f` | ADM-10: Add failing API and end-to-end tests for the default share image | `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs` (T1 to T5), `studio/e2e/settings.spec.ts` (E1) |
| 2 | `7528184` | ADM-10: Add failing Studio tests for the share image control | `studio/test/settingsShareImage.test.tsx` (S1 to S4, without the alt assertions) |
| 3 | `ecf3dfa` | ADM-10: Keep the default share image when a settings save leaves it out | `api/src/DigitalHub.Api/Content/AdminStore.cs` |
| 4 | `99615cb` | ADM-10: Add a default share image control to Site settings | `studio/src/pages/SettingsPage.tsx` |
| 6 | this commit | ADM-10: Implementation record (partial) | `docs/changes/ADM-10/implementation.md` |

Commit 5 (`head.ts`) exists only if O-ADM10-2 is (a). Nothing is pushed yet, so once
O-ADM10-2 is answered the local commits can be rebuilt. W1 and W2 then join commit 1,
and the S1/S2 alt assertions join commit 2, so every test still comes before its fix.

## What changed, by the plan's Scope (section 4)

- **`AdminStore.cs`** (3.1). This is all of 3.1, which holds under (a) and (b).
  - `SiteSettingsUpdate`: `DefaultShareImageId` and `DefaultShareImageAltOverride` have
    backing fields, and their setters set `DefaultShareImageIdSent` and
    `DefaultShareImageAltOverrideSent`. Both flags are `internal bool { get; private set; }`
    (condition 3). There is no public flag and no `[JsonIgnore]`.
  - `UpdateSettingsAsync`: each field is copied only when its flag is set. When the id
    was sent, is not null and no `db.Media` row has it, the save adds
    `defaultShareImageId: "Choose an image from the media library."`. This sits next to the
    version error, before the version check, as 3.1 says.
  - `ValidateSettings`: `LimitText(errors, "defaultShareImageAltOverride", ..., 300)`.
  - Nothing else in the file changed.
- **`SettingsPage.tsx`** (3.2, the parts that hold either way).
  - The type has `defaultShareImageId` and `defaultShareImageAltOverride`.
  - A local `ShareImageField` shows the chosen image: a thumbnail and its path, read from
    `GET /api/v1/media/{id}` when the value changes, with stale replies dropped.
    - If the image is not found, it shows "The chosen image is no longer in the library."
    - If nothing is chosen, it shows "No image chosen. Pages without their own share
      image have none."
    - It has "Choose image" (or "Change image"), which opens the picker, and "Clear",
      which sets the value to `null`.
  - It is registered as `<Form.Item label="Default share image" name="defaultShareImageId">`
    after "Default meta description".
  - `<MediaPicker>` is a sibling of the `<Form>`. Its `onSelect` calls
    `form.setFieldValue("defaultShareImageId", choice.id)` and closes the picker.
  - It uses antd `Space` and `Button`, with no new CSS.
- **`head.ts`, `seo.test.tsx`**: not touched (pending on O-ADM10-2).
- **New tests**: `SettingsShareImageTests.cs`, `settingsShareImage.test.tsx`, `settings.spec.ts`.
- Not changed (condition 2): `MediaPicker.tsx`, `ItemEditorPage.tsx`, `FormWalker.tsx`,
  `rich-text.spec.ts`, every workflow, lockfile and migration. `npm ci` ran in `studio/`
  and `website/` and changed no tracked file (`git status --short` was empty afterwards).

### Notes on the tests as written

- **T1 to T5.** Each test seeds its own `MediaAsset` row, with a random hash, through
  `ContentDbContext`. Its `finally` nulls both settings fields with `ExecuteUpdateAsync`
  and deletes that row with `ExecuteDeleteAsync` (plan 5.1, "Cleanup").
- **E1** draws its two 16 by 16 PNGs on a browser canvas, as the plan says.
  - The colours are `rgb(220, 30, 40)` and `rgb(20, 60, 210)`, and the top-left pixel
    comes from the run stamp.
  - It asserts `duplicate: false` on both uploads and that their ids differ. It records
    an id only after that assertion, and deletes only the ids it recorded.
  - It uses `getByLabel("Email", { exact: true })`.
  - It restores every key it read, at the current version, in `finally`.
  - It clicks "Choose image" when the stored id is null, and "Change image" otherwise.
    So it does not rely on what the E2e seed holds.
- **S1 to S4** keep `listPaging.test.tsx`'s `afterEach` verbatim. Their handler answers
  `GET /api/v1/settings`, `GET /api/v1/media/m-001`, `GET /api/v1/media/m-002`,
  `GET /api/v1/media?...` and `PUT /api/v1/settings`, and throws on anything else.
  S2 asserts that `GET /api/v1/media/m-002` was requested.

### Finding for the tester: T2 is red at the base too (the plan's prediction was wrong)

Plan 5.1 lists T2 as "Green (guard)", and 5.2 says job `api` at commit 1 fails on
"T1, T3, T4 and T5". T2 includes the plan's own second assertion: "Sending only the alt
changes only the alt". At the base, a body with only `defaultShareImageAltOverride`
copies null over the id (2.1), so `Assert.Equal(media, ShareImageId(afterAlt))` fails.
I wrote T2 as the plan specifies and did not weaken it. So **the expected CI red at
commit 1 in job `api` is T1, T2, T3, T4 and T5**: T2 fails on its alt-only half, and its
explicit-null half passes. Only the prediction is wrong. The design and the scope are
not affected, so this is not a reason to go back to the architect. The coordinator
should know it before reading the CI run.

## Commands run

Environment: Node `v22.23.4`, npm from `/opt/node22/bin`. `which dotnet` finds nothing.
I tried to download the official .NET install script
(`curl -sSL https://dot.net/v1/dotnet-install.sh`): exit 56, "CONNECT tunnel failed,
response 403". The proxy refused `builds.dotnet.microsoft.com`. No SQL Server is
reachable. `npm ci` worked in `studio/` and `website/` (from the lockfiles, no change
to them).

### At commit 1 (`8e4d87f`), tests only

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npx tsc -b` | 0 | none |
| `cd studio && npm test` | 0 | `Test Files 12 passed (12)`, `Tests 94 passed (94)`: unit tests are green at commit 1, as 5.2 needs |
| `cd studio && npx tsc --ignoreConfig --noEmit --strict --target ES2023 --lib ES2023,DOM --module ESNext --moduleResolution bundler --skipLibCheck --types node e2e/settings.spec.ts e2e/redirects.spec.ts` | 0 | Ad hoc type check of E1, which is outside `tsconfig.node.json`'s `include`. This is not a CI step |
| `cd api && dotnet build DigitalHub.slnx -c Release` | NOT RUN | No `dotnet`, and it cannot be installed (proxy 403). CI job `api` covers it |
| T1 to T5 red | NOT RUN | Needs `dotnet` and SQL Server (`DigitalHubContent_Test`). CI job `api` at commit 1, once O-ADM10-1 is answered "Yes". Expected red: T1, T2 (alt-only half, see above), T3 (500), T4 (500 on 301 characters), T5 |
| E1 red (`npx playwright test e2e/settings.spec.ts`) | NOT RUN | Needs the API (`dotnet`) and `DigitalHubContent_E2e`. CI job `studio` at commit 1. Expected red: the "Choose image" button is not found |
| W1 red | NOT BUILT | Pending on O-ADM10-2 (a) |

### At commit 2 (`7528184`), tests only

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npx vitest run test/settingsShareImage.test.tsx` | 1 | `× a save sends the stored default share image and its alt back`, `× choosing an image in the picker saves its id`, `× Clear saves an explicit null`, `× an editor sees the share image but cannot change it`. Each fails with `TestingLibraryElementError: Unable to find an element with the text: /media/001.png`, because the form has no share image control. `Tests 4 failed (4)` |
| `cd studio && npx tsc -b` | 0 | none |

All four fail at the first step that needs the control. The plan says S1 is red because
"the body has neither key". That is still the cause, but the test stops one step earlier,
on the missing image, before it reaches the body.

### At commit 4 (`99615cb`), the fixed head of code

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npx vitest run test/settingsShareImage.test.tsx` | 0 | `Tests 4 passed (4)` |
| `cd studio && npx tsc -b` | 0 | none |
| `cd studio && npm test` | 0 | `Test Files 13 passed (13)`, `Tests 98 passed (98)` |
| `cd studio && npm run build` | 1 | `Error: VITE_PUBLIC_SITE_URL is not set.` I ran it without the variable that CI sets (`ci.yml`, step "Build", `VITE_PUBLIC_SITE_URL: https://website.ci.invalid`). This was my mistake, not a code failure |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 983ms`, `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| `cd website && npm ci` | 0 | lockfile unchanged |
| `cd website && npm run typecheck` | 0 | none |
| `cd website && npx vitest run` | 0 | `Test Files 23 passed \| 1 skipped (24)`, `Tests 429 passed \| 31 skipped (460)`. The skips are in files this change does not touch |
| `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `Build output checks passed.` |
| `cd api && dotnet build DigitalHub.slnx -c Release` | NOT RUN | No `dotnet`. CI job `api`. **The `AdminStore.cs` change and `SettingsShareImageTests.cs` have not been compiled.** |
| `cd api && dotnet test ... -c Release --no-build` (full, and the 5.3 filter with `ContentBundleTests`) | NOT RUN | No `dotnet`, no SQL Server. CI job `api` |
| `cd studio && npx playwright test` and `npx playwright test e2e/settings.spec.ts e2e/appearance.spec.ts` | NOT RUN | Needs the API (`dotnet`) and `DigitalHubContent_E2e`. CI job `studio` |

No database was touched by me: no `DigitalHubContent`, `_Test` or `_E2e`.

## Migrations

None, as the plan says (section 7). No migration was created or applied.

## Pending on O-ADM10-2

Only if the answer is (a):

1. **Commit 1:** W1 and W2 in `website/test/seo.test.tsx`, in `describe("page head")`
   (plan 5.1). Run W1 red locally.
2. **Commit 2:** in `settingsShareImage.test.tsx`:
   - S1: `expect(body.defaultShareImageAltOverride).toBe("Digital Hub logo")`.
   - S2: the alt is unchanged after "Change image".
   - S4: the alt input is disabled.
   These are additions only. The handler already returns the alt.
3. **Commit 4:** `<Form.Item label="Default share image alt text" name="defaultShareImageAltOverride">`
   with `<Input maxLength={300} />` and its `extra` text, after the share image item.
   Choosing an image does not copy the library alt into it.
4. **Commit 5:** `head.ts` `shareImage()` as in 3.3.
5. Then I rebuild the local history in the 5.2 order and rerun the Studio and website
   suites.

If (b): none of these. `head.ts` and `seo.test.tsx` stay untouched. I report the website
alt to the coordinator as ADM-10b. The current commits already match (b), apart from the
commit subjects and bodies that mention O-ADM10-2.

## Pending on O-ADM10-1

- **"Yes":** push commit 1 alone (`git push origin <sha-of-commit-1>:refs/heads/change/ADM-10`
  after the rebuild, never a bare push). Wait until jobs `api`, `website` and `studio` have
  finished on it. Record the run and job ids and each failing assertion here. Per
  condition 4, also record `section-compare` and `screenshot-parity` as skipped if
  `website` is red. Then push the rest.
- **"No":** push the full branch. Delivery stays BLOCKED ON OWNER on the 5.4 row until the
  owner accepts in words that the database reds were not shown.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A save without the share image fields keeps the stored image | ADM-10, "Treat a missing field as unchanged" | Built, not run | `ecf3dfa` (3.1). T1, T5 written in `8e4d87f`. NOT RUN (no `dotnet` or SQL Server). CI job `api` |
| The Studio form carries the image through every save | ADM-10, "or carry it through the save" | Done (unit) | S1 red at `7528184` (exit 1), green at `99615cb` (exit 0). E1 NOT RUN, CI job `studio` |
| A media picker on the Settings form (choose, change, clear) | ADM-10, "There is no field to set it" / "A media picker" | Done (unit) | S2, S3 red at `7528184`, green at `99615cb`. E1 NOT RUN |
| An alt override on the form | ADM-10, "alt override on the form" | Pending O-ADM10-2 | Not built. The API keeps and limits the stored alt either way (`ecf3dfa`) |
| The website uses the settings alt with the default image | Found here (2.3) | Pending O-ADM10-2 | Not built. ADM-10b if (b) |
| An unknown media id is refused with 400, not 500 | Found here (G-1) | Built, not run | `ecf3dfa`. T3 NOT RUN, CI job `api` |
| An alt over 300 characters is refused with 400, not 500 | Found here (G-2) | Built, not run | `ecf3dfa`. T4 NOT RUN, CI job `api` |
| The saved image reaches the build content | FR-S-17; G3-1 exit gate | Built, not run | T5 NOT RUN, CI job `api` |
| Regression tests committed and shown failing before the fix | G3 checklist | Partly | Tests-only commits `8e4d87f`, `7528184` come before the fixes. S1 to S4 red locally. The T and E1 reds wait on O-ADM10-1 (push) |
| End-to-end test for this Major | G3 checklist | Written, not run | E1 in `8e4d87f`. NOT RUN, CI job `studio` |
| Editors can see but not change the share image | Settled design (roles) | Done (unit) | S4 red at `7528184`, green at `99615cb` |
| FR-S-17 settings moves from "Partly" to "Works" | Audit, line 43 | Not yet | Needs the CI runs and the O-ADM10-2 part |

Status: NOT READY: waiting on O-ADM10-2 (alt parts not built) and O-ADM10-1 (nothing pushed)
