# ADM-10: plan

Change id: `ADM-10`. Branch: `change/ADM-10`, worktree `/home/user/dh-change-adm10`.
Architect, round 2, 11 November 2026. Round 1 (`3436530`) came back CHANGES NEEDED
(`plan-review.md` Round 1 at `cf14094`: two Majors, four Minors). Section 12 answers
each one. The main changes: E1 uploads two different images it makes itself, and the
Studio unit tests move to their own commit, so E1's red shows in CI.

**Base: `32f0414`.** PR #55 (ADM-07) merged into `rebuild/dotnet-platform` as
`32f0414`, as the coordinator relayed. `change/ADM-10` already contains it: the
round 1 plan commit `3436530` has parent `32f0414` (`git log --oneline -4`:
`cf14094`, `3436530`, `32f0414`, `6262f48`). The precondition in 2.7 is met. Every
line number below is at `32f0414`.

**Files this plan's process requires that do not exist here:**

- `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md`: not in the worktree.
- `docs/quality/` is not in the worktree either. I read the audit and the refinement
  plan from `/mnt/project-files/docs/quality/`, as the coordinator directed.

I have not guessed what the missing files say. Where the pipeline cites rules from
them (P-4, P-6, P-7, P-8, B-8), I use the wording that `docs/changes/README.md` and
the earlier records (ADM-02, ADM-07) give.

## 1. Item

- **Closes:** ADM-10, "saving Settings clears the default share image."
  (`admin-audit-2026-10-28.md`, line 179). Finding and fix, quoted:
  - "The form does not send `defaultShareImageId`, and the API copies the null over
    the stored value (`AdminStore.cs:242`)."
  - "There is no field to set it."
  - "Fix: A media picker and alt override on the form. Treat a missing field as
    unchanged, or carry it through the save."
- **Requirement:** FR-S-17 in the audit's table: "FR-S-17 settings | Partly | Save
  clears the share image (ADM-10)" (line 43).
- **Track:** G3, batch G3-1, slot 2, 3 to 16 November. The refinement plan's G3 table
  lists "ADM-10 settings share image" in G3-1. The order is "ADM-06, 03, 02, 07, 10,
  05, 04, 12, 01a". ADM-06, 03, 02 and 07 have merged (`#49`, `#51`, `#52`, `#54`,
  `#55`).
- **Severity:** the audit lists ADM-10 under "### Major" (line 147 onwards), but the
  plan's G3-1 batch, "Blockers", includes it. I apply both rules: G3-1's exit gate,
  and the G3 checklist's "The end-to-end suite gets a test for each Major" (E1, 5.1).
- **"Done when":**
  - The G3-1 exit gate (refinement plan, Track G3): "A clean website build from
    `DigitalHubContent_Studio` with no patched content; each blocker reproduced
    before its fix and passing after it".
  - Track G3, in general: "Every fix carries a regression test that fails first."
  - The G3 checklist (`docs/changes/README.md`): "The regression test is committed and
    shown failing before the fix. The end-to-end suite gets a test for each Major."

## 2. Current state

### 2.1 The API copies whatever arrives, including a missing field

`api/src/DigitalHub.Api/Content/AdminStore.cs`, `UpdateSettingsAsync`, lines 238-307:

```
284        settings.DefaultShareImageId = request.DefaultShareImageId;
285        settings.DefaultShareImageAltOverride = TrimOrNull(request.DefaultShareImageAltOverride);
```

The audit cites line 242. That line number was taken before ADM-02 and ADM-07
moved the code. The same statement is line 244 at `6262f48` and line 284 at
`32f0414`.

`SiteSettingsUpdate` (lines 1147-1179) is a plain DTO. `DefaultShareImageId` is
`Guid?` (line 1168). The body binds with System.Text.Json, so a field that is
missing and a field sent as `null` both arrive as `null`. Every save replaces every
field. Existing tests say so: `CookieSettingsTests.cs:97`, "The current settings as a
full PUT body (a save replaces every field)".

### 2.2 The Studio never sends the field and has no control for it

`studio/src/pages/SettingsPage.tsx`:

- The `Settings` type, lines 7-33, has no `defaultShareImageId` and no
  `defaultShareImageAltOverride`.
- `load()` puts the whole GET body into the form (`form.setFieldsValue`, line 54).
- `save(values)` sends `{ ...values, version }` (line 59). antd's `onFinish` passes
  only the values of fields that have a `Form.Item`, and the two share image fields
  have none (lines 76-100). So every Save sends neither field.
- Grep at `32f0414`: `git grep -n -i "defaultShareImage" -- studio/src` finds nothing.

### 2.3 What happens next: the website loses its fallback image

- `website/src/seo/head.ts:85-92` and `website/src/seo/jsonld.ts:171` use
  `settings.defaultShareImageId` for any page that has no `shareImageId` of its
  own. One Studio save wipes `og:image` and the Article `image` on those pages.
- **`defaultShareImageAltOverride` is never read by the website.** `head.ts:90-91`:

  ```
  const own = item.shareImageAltOverride?.trim();
  return { image: asset.path, imageAlt: own || documentTitle(item) };
  ```

  The only other reference is the type, `website/src/content/build-content.ts:90`.
  An "alt override" input on the form would therefore change nothing on the website
  today. This needs O-ADM10-2 (section 9).

### 2.4 Other gaps on the same save path, found here (not in the audit)

Once the form can send an id, these two cases become reachable:

- **G-1, unknown media id: a 500.** `ValidateSettings` (lines 796-826) does not
  check the id. The foreign key is `site_settings.default_share_image_id →
  media_assets`, `OnDelete(NoAction)` (`ContentModelBuilder.cs:136-139`; model
  snapshot lines 2095-2098). `UpdateSettingsAsync` catches only
  `DbUpdateConcurrencyException` (line 299), so an unknown id fails as a
  `DbUpdateException`, which the exception handler (`Program.cs:273`) turns into a
  500. I read this from the code. I could not run it: no SQL Server is reachable
  here. T3 shows it in CI.
- **G-2, alt override longer than 300 characters: a 500.** The column is
  `nvarchar(300)` (model snapshot lines 1369-1372). `ValidateSettings` has no limit
  for it. Its sibling on items already has one (`ContentDocuments.cs:184`,
  `Limit(errors, "shareImageAltOverride", ..., 300)`). T4 shows the 500 in CI.

### 2.5 What else uses `SiteSettingsUpdate`

- `api/tools/DigitalHub.ContentImport/ContentBundle.cs:511-517` builds a
  `SiteSettingsUpdate` from a `SiteSettings` row by reflection:

  ```
  foreach (var property in typeof(SiteSettingsUpdate).GetProperties())
      property.SetValue(request, typeof(SiteSettings).GetProperty(property.Name)!.GetValue(settings));
  ```

  So any new **public** property on `SiteSettingsUpdate` that `SiteSettings` lacks
  would throw here and break the bundle import. This limits the design (3.1).
- Tests that send partial bodies: `SettingsVersionTests.cs` (`{ version, email }`,
  for example line 33), `AdminApiTests.cs:198-221`. Two tests drop the id on
  purpose: `CookieSettingsTests.cs:104` and `Section5Tests.cs:228`
  (`payload.Remove("defaultShareImageId")`). None of them asserts that a missing
  share image is cleared, so none of them changes meaning under 3.1.
- Media in use cannot be deleted: `MediaUsage.cs:45` counts the settings row. The
  build sends every media row (`BuildContentStore.cs:261-263`), and the website's
  `missingMediaIds` (`website/src/content/validate.ts:111-140`) checks
  `defaultShareImageId`. So an id that exists when it is saved stays valid for the
  build.

### 2.6 The parts of the Studio to reuse

- `studio/src/content/MediaPicker.tsx`: modal, search, paging, upload. Exports
  `MediaPicker` and `MediaChoice` (`{ id, path, alt }`).
- The item editor's share image control, `studio/src/pages/ItemEditorPage.tsx:381-388`
  and 396: "Choose image" or "Change image", "Clear", and an "Alt text" input, then
  `<MediaPicker ... onSelect={...}>`. The settings control follows this.
- `GET /api/v1/media/{id}` (`MediaController.cs:20-21`, `studio` policy) answers
  `{ image, usages }` (`MediaLibrary.cs:45-52`), so the form can show which image is
  chosen. No new route is needed.
- Studio test conventions, from `studio/test/listPaging.test.tsx`: `request` mocked
  with `vi.mock("../src/api/http")` (lines 45-56); the antd `message` replaced by a
  spy (lines 58-68); `useAuth` mocked (lines 70-72); `NoMotion` so the picker's Modal
  opens in jsdom (lines 81-88).

### 2.7 Overlap with PR #55 (ADM-07)

- `git diff 6262f48 32f0414 -- api/src/DigitalHub.Api/Content/AdminStore.cs` has hunks
  at `@@ -113`, `-138`, `-162`, `-170` (redirects) and `-640` (redirect targets). It
  does not touch `UpdateSettingsAsync`, `ValidateSettings` or `SiteSettingsUpdate`.
- #55 is merged (`32f0414`), so no open pull request overlaps any more. ADM-10 does
  change `AdminStore.cs`. **Development starts only on a branch that already
  contains `32f0414`.** `change/ADM-10` does (`git branch --contains 32f0414` lists
  it), so this is met. If the base moves again before development, the developer
  merges the new base first.
- The only other open pull request is #44 (GAP-07). I checked this twice, in
  round 1 and again in round 2, with
  `gh api "repos/mohya7/DH-WEBSITE/pulls?state=open"`, which returns only
  `44 change/GAP-07`. It changes only `.github/security/*`,
  `.github/workflows/security.yml` and `docs/changes/GAP-07/*`
  (`gh api repos/mohya7/DH-WEBSITE/pulls/44/files`). It shares no file with ADM-10.

### 2.8 What I could run here

Read-only git and `gh api` only. There is no `dotnet` on this machine (`which dotnet`
finds nothing), `studio/node_modules` is absent, and no SQL Server is reachable.
Nothing in section 5 was run by me.

## 3. Design

### 3.1 API: a missing share image field leaves the stored value alone

`SiteSettingsUpdate` records whether each of the two share image properties was in
the body. System.Text.Json calls a property's setter only when the property is in the
JSON, and it calls it with `null` for an explicit `null`. So:

```csharp
private Guid? _defaultShareImageId;
public Guid? DefaultShareImageId
{
    get => _defaultShareImageId;
    set { _defaultShareImageId = value; DefaultShareImageIdSent = true; }
}
/// <summary>False when the body had no defaultShareImageId: the save keeps the stored one (ADM-10).</summary>
internal bool DefaultShareImageIdSent { get; private set; }
```

The same applies to `DefaultShareImageAltOverride` (`DefaultShareImageAltOverrideSent`).
The flags are `internal`, for two reasons. `Type.GetProperties()` does not return
them, so the reflection in `ContentBundle.cs:514` (2.5) still sees only the public
properties. And System.Text.Json neither reads nor writes them.

In `UpdateSettingsAsync`, lines 284-285 become:

```csharp
if (request.DefaultShareImageIdSent)
    settings.DefaultShareImageId = request.DefaultShareImageId;
if (request.DefaultShareImageAltOverrideSent)
    settings.DefaultShareImageAltOverride = TrimOrNull(request.DefaultShareImageAltOverride);
```

The two fields are independent. A body may change the alt text alone. An explicit
`null` still clears.

**Validation, for G-1 and G-2 (2.4):**

- In `ValidateSettings`: `LimitText(errors, "defaultShareImageAltOverride",
  request.DefaultShareImageAltOverride, 300)`. This is a static check, so the bundle
  import's `CheckSettings` (line 888) gets it too. No bundle can hold a longer value,
  because the column is 300.
- In `UpdateSettingsAsync`, next to the other errors and before the version check:
  if the id was sent and is not null, and no `db.Media` row has that id, add
  `defaultShareImageId: "Choose an image from the media library."`. The answer is a
  400 with the usual validation body, and nothing changes. The check is not in
  `ValidateSettings`, because that is static and has no database (the import has its
  own media rows).

**Why both layers (the audit offers "or"):**

- If only the Studio carries the field, any client that omits it still wipes the
  image. That includes a Studio tab that was opened before the deploy and is still
  running the old script, which is exactly the bug. The API is where the data is
  lost, so the API is fixed.
- If only the API changes, there is still "no field to set it" (the audit's second
  point).

**Alternatives rejected:**

| Alternative | Why not |
| --- | --- |
| Studio only (carry the value through the save) | Old tabs and other clients still wipe it (above) |
| Missing means unchanged for every settings field (a real PATCH) | It changes the contract of the other 25 fields and of tests that depend on "a save replaces every field" (`CookieSettingsTests.cs:97`). The finding is about one field |
| Bind the body as `JsonElement` or `JsonObject` and check for keys | It duplicates the binding and the validation for one field. The setter flag is local to the DTO |
| A public `bool` flag, or `[JsonIgnore]` on a public property | `ContentBundle.cs:514` reflects over the public properties and would throw on a name that `SiteSettings` lacks |
| A separate `PUT /api/v1/settings/share-image` route | A new route and policy for one field. The form saves everything with one Save, like the old admin panel |
| Refuse an image whose library alt is empty or decorative | The website never uses the library alt for share images (`head.ts:89`, "Use it only when this page supplies its own alt"). A rule that has no effect on the site would be new behaviour. It is not part of the finding |

### 3.2 Studio: a share image control on the Settings form

In `SettingsPage.tsx`, after "Default meta description" (line 92), the form gets a
block called "Default share image", built the same way as the item editor's
(2.6):

- Two new fields in the `Settings` type: `defaultShareImageId?: string | null` and
  `defaultShareImageAltOverride?: string | null`.
- `<Form.Item name="defaultShareImageId">` wraps a small local control,
  `ShareImageField` (`value`, `onChange`). Because it is registered, `onFinish`
  includes it in the values, so every Save carries the id, or `null` once it is
  cleared. The control has:
  - the chosen image as a thumbnail with its file path, read once from
    `GET /api/v1/media/{id}` when the value changes. If the image is not found, it
    shows "The chosen image is no longer in the library." If nothing is chosen, it
    shows "No image chosen. Pages without their own share image have none.";
  - "Choose image" (or "Change image"), which calls an `onChoose` prop. That opens
    the existing `MediaPicker`;
  - "Clear", which sets the value to `null`.
- **Where the picker renders:** `<MediaPicker>` is a sibling of the settings `<Form>`,
  not inside it or inside `ShareImageField`. This is the item editor's layout too
  (`ItemEditorPage.tsx:396`, outside its fields). `SettingsPage` owns the `picker`
  state. `onSelect` calls `form.setFieldValue("defaultShareImageId", choice.id)` and
  closes the picker, and the registered `Form.Item` passes the new value to
  `ShareImageField`. So the picker's own `<Form>` (`MediaPicker.tsx:153`) is not
  nested in the settings form, and the settings form's disabled context does not
  reach it. That does not matter for editors, because they cannot open it: the
  button that opens it is inside the disabled form (S4). Nesting was considered and
  rejected for this reason.
- `<Form.Item label="Default share image alt text" name="defaultShareImageAltOverride">`
  holds an `Input` with `maxLength={300}`. Its `extra` text depends on O-ADM10-2
  (3.3). Unlike the item editor, choosing an image does **not** copy the library alt
  into this field: the website does not use the library alt for share images (3.1,
  last row).
- Editors: the `Form` is `disabled={!canEdit}` (line 75), and antd's disabled context
  also disables the `Button`s inside it. S4 checks this.
- The style is antd defaults inside the existing `surface-card`, plus the item
  editor's classes (`mb-1 text-sm`, `Space`), so it matches the navy look. No new
  CSS.

### 3.3 Website: use the settings alt with the default image (only if O-ADM10-2 is (a))

`head.ts`, `shareImage()`:

```ts
const own = item.shareImageAltOverride?.trim();
const fallback = item.shareImageId ? undefined : site.content.settings.defaultShareImageAltOverride?.trim();
return { image: asset.path, imageAlt: own || fallback || documentTitle(item) };
```

- The settings alt applies only when the page uses the default image. A page's own
  alt still wins. A page with its own image and no alt still gets its title.
- `website/fixtures/snapshot/content.json` has both settings fields `null` (checked with grep), so
  the snapshot build, the design check and the section comparison produce the same
  output.
- If O-ADM10-2 is (b), this part moves to ADM-10b. The form then has no alt input,
  so it shows nothing that does nothing, and 3.1 still keeps the stored alt.

## 4. Scope

**Change:**

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | `SiteSettingsUpdate`: two properties with setter flags and two `internal` flags (3.1). `UpdateSettingsAsync`: the conditional copy (lines 284-285) and the media-exists check. `ValidateSettings`: the 300 limit for the alt override. Nothing else in the file |
| `studio/src/pages/SettingsPage.tsx` | The two fields in the type, `ShareImageField`, the alt `Form.Item` (3.2) |
| `website/src/seo/head.ts` | Only if O-ADM10-2 is (a): `shareImage()` as in 3.3 |
| `website/test/seo.test.tsx` | Only if O-ADM10-2 is (a): W1 and W2 in `describe("page head")` |

**Create:**

| File | What |
| --- | --- |
| `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs` | T1 to T5, `[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`, the helper style of `SettingsVersionTests.cs` |
| `studio/test/settingsShareImage.test.tsx` | S1 to S4 |
| `studio/e2e/settings.spec.ts` | E1 |
| `docs/changes/ADM-10/implementation.md` | Developer's record |

**Out of scope, left alone on purpose:**

- `MediaPicker.tsx`, `ItemEditorPage.tsx` and `FormWalker.tsx` are reused, not
  changed.
- Length limits for the other settings text columns. For example, `PostalCode` is
  `nvarchar(20)` with no check in `ValidateSettings`, so it is the same 500 class as
  G-2. It is not this finding, and this plan proposes it to the coordinator as a
  separate item.
- The media-exists check in the bundle import (`ContentBundle.cs`), which already
  checks its own media rows.
- `jsonld.ts:171`. Article `image` carries no alt.
- No migration, no schema change, no CI workflow change, no package change.

## 5. Test plan

### 5.1 Tests written first (commits 1 and 2, tests only)

Commit 1 holds T1 to T5, E1, and W1 and W2 if (a). Commit 2 holds S1 to S4. 5.2
says why.

**Studio, `studio/test/settingsShareImage.test.tsx`** (vitest, jsdom). The mocks
follow `listPaging.test.tsx`: `request` mocked, `message.success` replaced by a
`vi.hoisted` spy (no real toasts), `useAuth` mocked from a hoisted `role` variable,
`NoMotion`, and `matchMedia` and `ResizeObserver` stubs. The file also keeps
`listPaging.test.tsx`'s file-level `afterEach` **verbatim**
(`listPaging.test.tsx:166-170`, the same in `redirects.test.tsx:109-113`), so that
nothing rendered outside `render()`'s root, such as a toast or the picker's Modal
portal, outlives a test:

```ts
afterEach(() => {
  cleanup();
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
});
```

The handler answers:

- `GET /api/v1/settings` with `{ version: 4, email: "a@digitalhub.test",
  defaultShareImageId: "m-001", defaultShareImageAltOverride: "Digital Hub logo", ... }`;
- `GET /api/v1/media/m-001` and `GET /api/v1/media/m-002` each with
  `{ image: { id, path, alt, ... }, usages: [] }`. **Both are mocked**, because the
  field reads the chosen image whenever its value changes (3.2), and S2 changes it
  to `m-002`;
- `GET /api/v1/media?...` with a page of two images, `m-001` "Image 001" and `m-002`
  "Image 002";
- `PUT /api/v1/settings` by recording the parsed body and answering 200 with it, at
  `version: 5`.

Any other path throws, as in `listPaging.test.tsx`, so an unplanned request fails
the test.

| Id | Name | Asserts | Red today because |
| --- | --- | --- | --- |
| S1 | `a save sends the stored default share image and its alt back` | After load, click "Save". The PUT body has `defaultShareImageId: "m-001"`, `defaultShareImageAltOverride: "Digital Hub logo"` and `version: 4`. The `message.success` spy is called with "Settings saved." | The body has neither key (2.2) |
| S2 | `choosing an image in the picker saves its id` | Click "Change image", then the tile for "Image 002" in the dialog. The dialog closes and `GET /api/v1/media/m-002` was requested. Save. The PUT body has `defaultShareImageId: "m-002"`, and the alt is unchanged | There is no "Change image" button |
| S3 | `Clear saves an explicit null` | Click "Clear", then Save. The body **has** the key `defaultShareImageId` with value `null` (`"defaultShareImageId" in body`), and "No image chosen" is shown | There is no "Clear" |
| S4 | `an editor sees the share image but cannot change it` | With `role = "editor"`: "Change image" and "Clear" are disabled, the alt input is disabled, and there is no Save button | The buttons do not exist |

If O-ADM10-2 is (b), S1 does not assert the alt key and S2 does not check the alt.

**API, `api/tests/DigitalHub.Api.Tests/SettingsShareImageTests.cs`** (xunit,
`DigitalHubContent_Test`, **CI job `api` only**). Each test seeds its own
`MediaAsset` row through the `ContentDbContext` (as `SetVersionAsync` does in
`SettingsVersionTests.cs:86-91`), then runs the version-based saves through the
HTTP API as the admin.

**Cleanup.** The settings row is shared by every test in collection `SqlServer`
(`CookieSettingsTests`, `Section5Tests`, `SettingsVersionTests`, `AdminApiTests`).
After 3.1, the two tests that drop the id from their body
(`CookieSettingsTests.cs:104`, `Section5Tests.cs:228`) would keep whatever id is
left, and `MediaUsage.cs:45` would then stop that media row from being deleted. So
every T test ends in a `finally` that:

1. sets `DefaultShareImageId` and `DefaultShareImageAltOverride` to `null` with
   `db.SiteSettings.ExecuteUpdateAsync(...)`, as `SetVersionAsync` writes the row;
2. deletes the media row it seeded.

The `finally` writes the database directly rather than through the API. That way
it does not depend on the code under test or on the current version, and it also
runs when an assertion has failed. The leftover row is then the same as before
the test, apart from `version` and the fields the test saved. The other tests
already handle those: they read the version first, and `ClearSettingsAsync` resets
the row where needed.

| Id | Name | Asserts | Today |
| --- | --- | --- | --- |
| T1 | `A_save_without_the_share_image_fields_keeps_them` | PUT `{ version, defaultShareImageId: M, defaultShareImageAltOverride: "Logo" }` gives 200. Then PUT `{ version, email: "x@digitalhub.test" }` gives 200. GET returns `defaultShareImageId == M`, alt `"Logo"`, and the new email | **Red**: both are null after the second save (2.1) |
| T2 | `An_explicit_null_clears_the_share_image_and_its_alt` | After T1's first save, PUT `{ version, defaultShareImageId: null, defaultShareImageAltOverride: null }` gives 200, and GET shows both null. Sending only the alt changes only the alt | Green (guard: clearing must keep working) |
| T3 | `An_unknown_media_id_is_refused_and_changes_nothing` | PUT with a new random `Guid` gives **400**, the body names `defaultShareImageId`, and the version and the stored id are unchanged | **Red**: 500 (G-1). Expected from the code; not run here |
| T4 | `An_alt_override_over_300_characters_is_refused` | 300 characters give 200. 301 give 400 naming `defaultShareImageAltOverride`, and the stored alt stays the 300-character one | **Red**: 500 (G-2). Expected from the code; not run here |
| T5 | `The_build_content_carries_the_saved_share_image` | After T1's two saves, `GET /api/v1/build/content` with `X-Build-Token` has `settings.defaultShareImageId == M` (the `BuildSettingsAsync` pattern from `CookieSettingsTests.cs:109-116`) | **Red**: null, for the same reason as T1 |

**Website, `website/test/seo.test.tsx`** (only if O-ADM10-2 is (a)). In
`describe("page head")`, a site built from `snapshotContent()` whose `settings` has
`defaultShareImageId` set to a media id from the snapshot and
`defaultShareImageAltOverride: "Digital Hub logo"`:

| Id | Name | Asserts | Today |
| --- | --- | --- | --- |
| W1 | `uses the settings alt with the default share image` | `/cases/national-portal` (no `shareImageId`, `seo.test.tsx:63`): `head.image` is that media's path and `head.imageAlt` is "Digital Hub logo" | **Red**: the alt is the title |
| W2 | `keeps a page's own alt, and the title for a page's own image` | A page with its own override keeps it. A page with its own image and no override gets `documentTitle`. With the settings alt `null`, the default image gets `documentTitle` | Green (guard) |

**End-to-end, `studio/e2e/settings.spec.ts`** (Playwright, `DigitalHubContent_E2e`,
reset by the harness, **CI job `studio`**; `workers: 1`):

- **E1** `ADM-10 settings: the default share image survives a save, and can be changed
  and cleared`.
  - **Two images of its own, with different pixels.** An upload whose processed
    hash matches an existing row returns that row with `duplicate: true` and stores
    nothing (`MediaLibrary.cs:82-84`; the hash is SHA-256 of the encoded WebP). So
    E1 does **not** use `e2e/fixtures/pixel.png`, which `studio.spec.ts:7, 81` also
    uploads.
    - E1 makes two 16 by 16 PNGs in the browser: `page.evaluate` draws a canvas
      filled with one colour and returns `toDataURL("image/png")`, which the test
      turns into a `Buffer`.
    - The colours are far apart, image `-a` a red and image `-b` a blue. Each also
      gets one corner pixel derived from the run stamp, so no other spec or earlier
      run has the same image.
    - No binary fixture is committed.
  - **Setup through the API**, as `redirects.spec.ts` does:
    - Sign in as admin, then read and keep the full current settings.
    - `POST /api/v1/media` (multipart: `file`, `alt` = `adm10-<stamp>-a` or `-b`,
      `decorative` = `false`) for each image.
    - **Assert both responses have `duplicate: false`** and different ids, and
      record only those two ids as "created by E1".
  - **In the UI:**
    - Sign in, open "Site settings", click "Choose image", search `adm10-<stamp>-a`,
      pick it, and Save. Reload: the thumbnail is shown.
    - Change only the email field, found with
      `getByLabel("Email", { exact: true })`, because "Careers email" also matches
      "Email" as a substring. Save and reload. `GET /api/v1/settings` still has
      `-a`'s id.
    - Click "Change image", pick `-b`, and Save. The GET shows `-b`'s id.
    - Click "Clear" and Save. The GET shows `null`.
  - **`finally`:**
    - Restore the kept settings with a full PUT, at the version read just before.
      Every key is sent, so the original share image comes back too, and E1's
      images are released.
    - Then `DELETE /api/v1/media/{id}`, **only for the ids E1 recorded as created**
      with `duplicate: false`. If an upload came back as a duplicate, the test has
      already failed at the assertion, and that id is not recorded, so another
      spec's image is never deleted.
  - **Red at commit 1:** there is no "Choose image" button on the screen.

### 5.2 Commits and the red

The split follows ADM-07 (`docs/changes/ADM-07/implementation.md`, the commit
table and "Red, after commit 1" and "Red, after commit 2"). In job `studio`, "Unit
tests" (`npm test`, `ci.yml:237`) runs before "End-to-end suite" (`ci.yml:271`). If
the Studio unit tests were red in the same commit as E1, the job would stop before
E1 ran. So they go in separate commits, and the CI job is not changed (P-6).

1. **Commit 1, tests only:** T1 to T5, E1, and W1 and W2 if (a). No source change.
   The Studio unit tests are not in it.
2. **Commit 2, tests only:** S1 to S4 (`studio/test/settingsShareImage.test.tsx`).
3. Commit 3: `AdminStore.cs` (3.1).
4. Commit 4: `SettingsPage.tsx` (3.2).
5. Commit 5, only if (a): `head.ts` (3.3).
6. Commit 6: `implementation.md`.

- **Local red:**
  - At commit 1: `cd website && npx vitest run test/seo.test.tsx`. W1 fails; W2
    and every existing case pass. `cd api && dotnet build DigitalHub.slnx -c Release`
    passes, because the new tests compile against the base API.
    `cd studio && npx tsc -b` passes: `e2e/` specs other than `env.ts` are outside
    `tsconfig.node.json`'s `include`, as ADM-07 recorded.
  - At commit 2: `cd studio && npx vitest run test/settingsShareImage.test.tsx`. S1
    to S4 fail.
- **CI red at commit 1**, for each job (needs O-ADM10-1 "Yes"):
  - Job `api`: T1, T3, T4 and T5 fail. T2 and every existing test pass.
  - Job `website`: "Tests" fails on W1 only (if (a)). If (b), the job is green.
  - Job `studio`: "Unit tests" are green, because S1 to S4 are not in commit 1.
    "End-to-end suite" fails on E1 only, at the "Choose image" locator. Every other
    spec passes.
- **Pushing:** if O-ADM10-1 is "Yes", commit 1 is pushed alone, and commit 2 only
  after commit 1's run has finished jobs `api`, `website` and `studio`. The
  coordinator quotes the run and job ids and each failing assertion. S1 to S4's red
  is shown locally at commit 2. It needs no database.
- **Green:** each later commit turns its own tests green. At the head, every suite
  in 5.3 passes.

### 5.3 Suites and checks after the fix, by exact command

Run from the repository root of the worktree. .NET in Release only.

```
# API (job api; needs SQL Server, DigitalHubContent_Test — never DigitalHubContent)
cd api && dotnet build DigitalHub.slnx -c Release
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests|FullyQualifiedName~SettingsVersionTests|FullyQualifiedName~CookieSettingsTests|FullyQualifiedName~Section5Tests|FullyQualifiedName~ContentBundleTests|FullyQualifiedName~AdminApiTests"

# Studio (job studio)
cd studio && npm ci
cd studio && npx tsc -b
cd studio && npm test
cd studio && npm run build
cd studio && npx playwright test                      # E2e database, reset by the harness; ports 42xx via DH_E2E_API_PORT / DH_E2E_STUDIO_PORT
cd studio && npx playwright test e2e/settings.spec.ts e2e/appearance.spec.ts

# Website (job website)
cd website && npm ci
cd website && npm run typecheck
cd website && npx vitest run
cd website && npm run design:check
cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build
```

The `ContentBundleTests` run in the filter guards against the reflection risk in 2.5.

**Not runnable on this machine:** no `dotnet`, no SQL Server, no `node_modules`. The
developer records each command as run, with exit code and output (P-8). Anything
that needs SQL Server and cannot run locally is NOT RUN with the reason, and CI jobs
`api` (T1 to T5) and `studio` (E1) cover it.

### 5.4 Track checklist (G3, `docs/changes/README.md`)

| Rule | How this change meets it |
| --- | --- |
| "The finding, its evidence and its fix come from `docs/quality/admin-audit-2026-10-28.md`" | Section 1 quotes it. G-1 and G-2 were found here and are fixed on the same code path. They are flagged as not from the audit |
| "The regression test is committed and shown failing before the fix" | Commits 1 and 2 hold only tests, before any fix. W1 is red locally at commit 1 and S1 to S4 at commit 2. If O-ADM10-1 is Yes, CI at commit 1 shows T1, T3, T4 and T5 red in job `api`, W1 red in job `website`, and E1 red in job `studio` while that job's unit tests are green (5.2). If O-ADM10-1 is No, the database reds cannot be shown, and the row is not met: delivery is BLOCKED ON OWNER until the owner accepts that in words (P-7) |
| "The end-to-end suite gets a test for each Major" | E1 (the audit lists ADM-10 under Major) |
| "A Minor that is not fixed becomes a D-NNN entry" | Not a Minor. Nothing is left unfixed, except the website alt part if O-ADM10-2 is (b), which then becomes ADM-10b, not a D-NNN entry |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` ... each blocker reproduced before its fix and passing after it" | Reproduced by S1, T1 and E1, which pass after. The clean Studio build is the batch's gate, not this change's alone |

## 6. Security impact

- **Routes and policies:** none added or changed. `PUT /api/v1/settings` is still
  `studio-admin`, and `GET` is `studio` (`AdminControllers.cs:53-66`). The form reads
  `GET /api/v1/media/{id}` and `GET /api/v1/media`, both `studio`, which editors
  already reach through the item editor.
- **Data:** the only new behaviour is that a missing field no longer clears data. An
  unknown id now gets a 400 instead of a 500. The 400 names only the field and does
  not say whether a given GUID exists anywhere else, so it reveals nothing beyond
  the library list that the same user can already read.
- **Input:** the alt text is limited to 300 characters. The website already renders
  it as an attribute value through Next's metadata (`head.ts:134`, `images: [{ url,
  alt }]`), which escapes it. No raw HTML.
- **Logins, secrets, dependencies:** none. No package is added.

## 7. Migrations

None. The columns and the foreign key already exist (2.4).

## 8. Rollback

Revert the pull request. No schema or data change. After a revert, a save from the
reverted Studio clears the share image again, as it does today.

## 9. Owner decisions needed

- **O-ADM10-1. Status: PENDING** (on a card with the owner, as the coordinator relayed; not answered). "For ADM-10, may the developer push the test-only
  commit first, so CI shows the database tests failing before the fix, as with ADM-02
  and ADM-07?"
  - **Recommendation:** Yes. T1, T3, T4 and T5 need SQL Server, which only CI job `api`
    has. Without the push, their red cannot be shown and the G3 rule is not met.
  - The owner said yes for ADM-02 and ADM-07. ADM-07's answer, "Yes, red tests first"
    (relayed by the coordinator, 11 November 2026), covered that change only. This
    one asks again.
  - **Until it is answered:** build commits 1 and 2 and run them locally, record the
    local reds, and push nothing. That includes the finished branch: opening the pull
    request at the fixed head would make the CI red impossible to show, and that is
    the "No" answer, which only the owner may choose.

- **O-ADM10-2. Status: PENDING** (on a card with the owner, as the coordinator relayed; not answered). "The website ignores the default share image's alt
  override today: pages that fall back to the default image use their own title as
  the image's alt text. Should ADM-10 (a) add the alt field to Settings and make the
  website use it for pages that fall back to the default image, or (b) leave the alt
  field out now and treat it as a follow-up, ADM-10b?"
  - **Recommendation:** (a). The audit asks for "a media picker and alt override on
    the form", and a field that does nothing would mislead staff.
  - What (a) changes: `og:image:alt` (`head.ts:134`) on pages without their own share
    image, but only after an admin sets the alt. The snapshot build is unchanged
    (3.3).
  - What (b) means: the form shows only the picker, and the stored alt is kept as it
    is (3.1).

- **Behaviour changes, for the owner to see.** They go in the pull request body.
  They are the fix itself, so they are not asked as separate decisions.
  - **B1:** `PUT /api/v1/settings` leaves the default share image and its alt
    unchanged when the body leaves them out. Sending `null` still clears them. The
    other 25 fields still replace.
  - **B2:** An id that is not in the media library gets 400 `defaultShareImageId`
    (it was a 500).
  - **B3:** An alt override over 300 characters gets 400 (it was a 500). The bundle
    import's settings check refuses it too.
  - **B4:** Settings has a "Default share image" control (choose, change, clear), and
    the alt field if O-ADM10-2 is (a).

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The setter flag fires when it should not (for example, a future `[FromBody]` default or initializer) | A missing field clears again | T1 and T5 through the real HTTP binding |
| The setter flag does not fire for an explicit `null` | Staff cannot clear the image | T2 and S3 (the key is present with `null`) |
| A new public property breaks the import's reflection (2.5) | The bundle import throws | Design: the flags are `internal`. `ContentBundleTests` run in 5.3 |
| antd drops a `Form.Item` value that is `null` from `onFinish` | Clear does not reach the API | S3 asserts the key is present. If antd omits it, the developer stops and reports, since the plan cannot be followed as written |
| E1 changes the singleton settings row for later e2e tests | Later tests see other settings | `finally` restores the full row. `workers: 1`. `appearance.spec.ts` (reads labels) runs in 5.3 |
| E1's red is hidden behind a red unit-test step in job `studio` | E1's red is never shown | The commit split (5.2): S1 to S4 come after commit 1, so commit 1's unit tests are green and E1 runs. No CI job change (P-6) |
| E1's two uploads come back as one asset, or match another spec's image | "Change image" to `-b` is impossible, or `finally` deletes another spec's image | E1 makes two images with different pixels and a stamp pixel, asserts `duplicate: false` on both, and deletes only the ids it recorded as created (5.1) |
| The image is deleted between the new exists check and `SaveChangesAsync` | The foreign key refuses the write: `DbUpdateException`, a 500. The transaction rolls back, so nothing is half saved | Accepted, not fixed. It needs two admins acting within milliseconds: one deleting the very image the other is saving. The delete itself is refused while the settings row uses the image (`MediaUsage.cs:45`), so this can only happen in that window. A retry gets the 400 from the exists check. Catching the foreign-key error would add a second code path that no test reaches reliably |
| A T test leaves the settings row pointing at its seeded image | Later tests that drop the id keep it, and the media row cannot be deleted | Each T test's `finally` nulls both fields and deletes its media row directly in the database (5.1) |
| Website alt change shifts output for the real site | `og:image:alt` differs from today on fallback pages | Only after an admin sets it. W1 and W2. The snapshot build and design check are unchanged |
| A base change after `32f0414` touches `AdminStore.cs` | Merge conflict | Development starts after the coordinator merges the new base. Only #44 is open, and it has no shared files (2.7) |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A save without the share image fields keeps the stored image | ADM-10, "Treat a missing field as unchanged" | Planned | |
| The Studio form carries the image through every save | ADM-10, "or carry it through the save" | Planned | |
| A media picker on the Settings form (choose, change, clear) | ADM-10, "There is no field to set it" / "A media picker" | Planned | |
| An alt override on the form | ADM-10, "alt override on the form" | Planned (waits on O-ADM10-2) | |
| The website uses the settings alt with the default image | Found here (2.3); needed for the alt field to do anything | Planned (only if O-ADM10-2 is (a); otherwise ADM-10b) | |
| An unknown media id is refused with 400, not 500 | Found here (G-1) | Planned | |
| An alt over 300 characters is refused with 400, not 500 | Found here (G-2) | Planned | |
| The saved image reaches the build content | FR-S-17; G3-1 exit gate | Planned | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Planned (the CI red waits on O-ADM10-1; split in 5.2) | |
| End-to-end test for this Major | G3 checklist | Planned | |
| Editors can see but not change the share image | Settled design (roles); `SettingsPage.tsx:73` | Planned | |
| FR-S-17 settings moves from "Partly" to "Works" | Audit requirement table, line 43 | Planned | |

## 12. Revision log

- **Round 1 (`3436530`).** First version. There was no earlier `plan-review.md`,
  `plan-approval.md` or `implementation.md` in `docs/changes/ADM-10/`. In the same
  round, the coordinator reported mid-task that #55 had merged as `32f0414`. The plan
  was moved onto that commit (header, 2.1, 2.7).

- **Round 2 (this plan).** It answers `plan-review.md` Round 1 (`cf14094`, CHANGES
  NEEDED), finding by finding:
  1. **Major, E1 uploads one asset twice.** Agreed: `MediaLibrary.cs:82-84` returns
     the existing row with `duplicate: true`. E1 now draws two 16 by 16 PNGs with
     different colours and a stamp pixel in the browser, and does not use
     `pixel.png`. It asserts `duplicate: false` and different ids for both uploads.
     It deletes only the ids it recorded as created (5.1, E1). There is a new risk
     row.
  2. **Major, E1's red "cannot be shown in CI".** Agreed, the claim was wrong. The
     commits are now split as ADM-07 split them: commit 1 has T1 to T5, E1, and W1
     and W2; commit 2 has S1 to S4; the fixes come after. 5.2 states the expected CI
     red at commit 1 for each job: `api` T1, T3, T4, T5; `website` W1 only; `studio`
     unit tests green and E1 red at "Choose image". The push order is stated too.
     The 5.4 checklist row, the risk row and the coverage row are updated. The CI
     job is not changed.
  3. **Minor, the empty-body `afterEach` and S2's media mock.** The `afterEach` from
     `listPaging.test.tsx:166-170` is quoted and is to be kept verbatim. The handler
     now answers `GET /api/v1/media/m-002`, S2 asserts that request, and any
     unplanned path throws (5.1).
  4. **Minor, API tests leave the share image set.** Each T test ends in a `finally`
     that nulls both fields with `ExecuteUpdateAsync` and deletes its seeded media
     row, directly in the database, so it runs after a failed assertion too (5.1,
     "Cleanup"). There is a new risk row.
  5. **Minor, where `MediaPicker` renders.** It is a sibling of the settings
     `<Form>`, as in `ItemEditorPage.tsx:396`. `onSelect` calls
     `form.setFieldValue`. Nesting was considered and rejected (3.2).
  6. **Minor, factual slips.**
     - Header: the branch already contains `32f0414`. `3436530`'s parent is
       `32f0414`, so the 2.7 precondition is met (header, 2.7).
     - 3.3: the path is now `website/fixtures/snapshot/content.json`.
     - E1: it uses `getByLabel("Email", { exact: true })`.
     - The delete-before-save race now has its own risk row. The 500 is accepted
       and the reason is given.
     - The reviewer's "not checked" point: the open pull request list was re-run,
       and #44 is still the only one (2.7).
  - **Owner questions:** O-ADM10-1 and O-ADM10-2 are on cards with the owner and
    unanswered, as the coordinator relayed. Both are marked PENDING. Nothing is
    assumed for either.
