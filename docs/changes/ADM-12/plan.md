# ADM-12: make alt text impossible to bypass in the media library

## 1. Item

- **Closes:** ADM-12 (FR-S-08 alt text), `docs/quality/admin-audit-2026-10-28.md`, the
  alt-text half of the finding only (see Design, "Scope decision").
- **Track:** G3, batch G3-1 (blockers), `docs/quality/refinement-plan-2026-10-28.md` line 225.
- **Owner's request:** "ADM-12 make alt text impossible to bypass in the media library"
- **Done when (audit, lines 202-208):**
  > `MediaLibrary.cs:114-131` lets an image used by published items be saved as
  > decorative with no alt (200). The next build passes and ships cards with no alt
  > text.
  > Fix: refuse it while any use has no per-use alt, or run the publish alt check
  > over every use.
- **Done when (G3-1 batch, refinement plan line 225):** "A clean website build from
  `DigitalHubContent_Studio` with no patched content; each blocker reproduced before
  its fix and passing after it".
- **G3 checklist (`docs/changes/README.md`, lines 108-111):** the regression test is
  committed and shown failing before the fix.

## 2. Current state

Worktree `D:\work\DigitalHub\dh-platform-claude-adm-12`, branch `change/ADM-12`, cut
from `origin/rebuild/dotnet-platform` (head `8b5d6a5 ADM-05: Publish the 404 and 500
pages from their screen (#59)`). `docs/changes/ADM-12/` did not exist; this is round 1,
no review records to answer.

Files read: `docs/changes/README.md`, the audit, the refinement plan. (`AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md` exist on the base; nothing in
them changes this design beyond the rules restated here.)

**The bypass.** `api/src/DigitalHub.Api/Content/MediaLibrary.cs`, `UpdateAsync`
(lines 114-132), behind `PUT /api/v1/media/{id}` (`MediaController.cs:36-38`):

```csharp
var altError = AltError(alt, decorative);          // line 119
...
asset.Alt = decorative ? alt?.Trim() ?? "" : alt!.Trim();   // line 126
asset.Decorative = decorative;
```

`AltError` (lines 180-187) only refuses a blank alt when `decorative` is false. It
never looks at where the image is used. So `{ "alt": "", "decorative": true }`
returns 200 for an image that published items rely on.

**Why that ships empty alt.** The publish check holds per-use alt to account at
publish time only (`PublishChecks.cs`, `AddImagesAsync`, lines 66-103):
- share image: `EffectiveAlt(draft.ShareImageAltOverride, shareAsset.Alt) is null` -> error (line 91);
- card image (`fields.imageId`): `EffectiveAlt(imageAltOverride, asset.Alt) is null` -> error (lines 94-101);
- `mediaId` objects in sections and rich text: error unless the use has `decorative: true`
  or its own `alt` (`WalkMedia`, lines 185-200).

None of this re-runs when the library edit changes `asset.Alt`. The build then reads
the asset as stored (`BuildContentStore.cs:274-275`, `alt = asset.Alt, decorative =
asset.Decorative`) and the website's `altFor` (`website/src/content/media.ts:40-45`)
returns `""` for an asset marked decorative when the use has no alt of its own. That
is the card with no alt text the audit describes.

**Uses.** `MediaUsage.FindPlacesAsync` (`MediaUsage.cs:27-96`) already finds every
place: share images on eight collections, `ImageId` on five, the site settings default
share image, blog bodies, sections, and working copies. It returns place strings only,
not whether each place has its own alt.

**Other write paths to `MediaAsset.Alt/Decorative`:** none. `grep -rn
"MetadataError\|\.Decorative =" api/src` outside `MediaLibrary.cs` returns nothing;
an upload of duplicate bytes returns the existing asset unchanged (lines 82-84).

**Studio.** `studio/src/pages/MediaLibraryPage.tsx` `save()` (lines 102-111) shows only
`problem.title` on failure; `remove()` (lines 113-124) already lists
`problem.usages` from a 409. No Studio unit test covers the media page
(`studio/test/` has no media test).

**Existing tests.** `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs`:
`List_search_and_edit_for_an_editor_and_an_admin` (line 221) proves blank alt with
`decorative = false` gives 400; `Delete_lists_every_place_and_an_editor_cannot_delete`
(line 257) shows how to seed a page share image, a section `mediaId` and a blog body
image. Nothing covers decorative-with-no-alt on a used image.

## 3. Design

**Rule.** A library edit that leaves the asset with no usable default alt (the result
would be `Decorative = true` and blank `Alt`) is refused while any use of the image
relies on the asset's alt. A use relies on it when, at that place:
- share image (`ShareImageId`) and its `ShareImageAltOverride` is blank;
- card image (`ImageId`) and its `ImageAltOverride` is blank;
- site settings `DefaultShareImageId` and `DefaultShareImageAltOverride` is blank;
- a JSON `mediaId` object (sections, blog body, working-copy documents) that is not
  `decorative: true` and has no non-blank `alt`.

This mirrors exactly what the publish check would flag, so "refuse while any use has no
per-use alt" and "run the publish alt check over every use" give the same answer. Every
use is counted, published or draft, records and working copies: a draft that relies on
the asset's alt would fail publish anyway, so refusing is never a false block, and it
leaves no state in which a later publish or build ships empty alt.

**Response.** `409 Conflict`, code `alt_in_use`, title "Add alt text: this image is
used without alt text of its own.", `usages` = the places that rely on the asset alt
(same place-string format as delete). Nothing is saved, no audit row is written. A
plain alt change (non-blank alt, either decorative value) is unaffected, as is marking
decorative an image whose every use has its own alt or is per-use decorative.

**Code shape.**
- `MediaUsage.FindPlacesWithoutOwnAltAsync(db, mediaId, ct)`: same queries as
  `FindPlacesAsync`, filtered by the override columns, and for the JSON sources a walk
  that matches `mediaId == id` and checks that object's `alt`/`decorative` (the
  `WalkMedia` rule). Working-copy documents also check `shareImageId` +
  `shareImageAltOverride` and `fields.imageId` + `fields.imageAltOverride`.
- `MediaLibrary.UpdateAsync`: after the existing field checks, if the edit would leave
  `decorative && blank alt`, call it; non-empty -> `MediaOutcome.AltInUse(places)`.
- `MediaOutcome.AltInUse` beside `InUse` (`MediaLibrary.cs:300`).
- Studio `save()`: on `alt_in_use`, show the title and list the places, as `remove()`
  does.

**Alternatives rejected.**
- *Re-run the full `PublishChecks.AddAsync` for every using item:* runs link,
  reference and description checks unrelated to alt, so an unrelated broken link in a
  published page would block an image edit. Rejected; only the alt part is reused.
- *Count only published uses:* leaves drafts that will ship empty alt the moment they
  are published if the publish check is ever loosened, and needs a published/draft
  distinction `FindPlacesAsync` does not make. Rejected for "impossible to bypass".
- *Fail the website build on empty alt:* catches it too late (staff learn at build
  time, not at save) and is outside the media/alt scope of this change. Not done here.
- *Forbid decorative+blank entirely on the asset:* breaks legitimate decorative images
  used only with per-use decorative flags. Rejected.

**Scope decision: "library edits go live without publishing".** The finding's title
also says library edits go live without publishing. That is the designed model, not a
defect in the code: `AltText.cs` lines 3-6 state alt lives on the asset and a use may
override it, and the build reads the asset as stored. Changing it means versioning
media metadata through draft and publish, which is a schema change and a product
decision (Save is not publish applies to content; whether it applies to library
metadata is not settled). With this change, the harmful case (an edit that removes alt
the site relies on) can no longer reach the site; a non-blank alt change still goes
live at the next build. This half is **out of scope** and goes to owner decision O-1
below; if the owner wants it, it becomes ADM-12b.

## 4. Scope

Change:
- `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs`: the new tests (section 5),
  committed first.
- `api/src/DigitalHub.Api/Content/MediaUsage.cs`: add `FindPlacesWithoutOwnAltAsync`
  and its JSON walk.
- `api/src/DigitalHub.Api/Content/MediaLibrary.cs`: the check in `UpdateAsync`;
  `MediaOutcome.AltInUse`.
- `studio/src/pages/MediaLibraryPage.tsx`: `save()` lists `problem.usages` on failure.
- `studio/test/mediaLibrary.test.tsx` (new): the Studio message test.

Out of scope (left alone on purpose):
- Versioning library metadata through publish (O-1, possible ADM-12b).
- `PublishChecks.cs` (unchanged; its rule is mirrored, not edited).
- Website build alt checks, `website/` in general.
- ADM-16 (other media findings, G3-2); users and error-pages files (ADM-04, ADM-05).
- No migration, no new column.

## 5. Test plan

**Failing first (G3 rule).** The developer commits the tests alone, runs them against
the unfixed code, and records the failing output in `implementation.md` before the fix
commit. Locally Release build only; the local e2e/migration harness is broken, so CI's
"API — Release build, migrations, integration tests" job is the evidence for the API
tests.

In `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs`:
1. `Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it`
   - Upload with alt; create a blog post with `fields.imageId = id`, no
     `imageAltOverride`, and publish it (200).
   - `PUT /api/v1/media/{id}` `{ alt: "", decorative: true }` -> asserts 409, code
     `alt_in_use`, `usages` contains `"blog-posts <id> image"`.
   - `GET /api/v1/media/{id}` still returns the original alt and `decorative: false`.
   - Fails today: returns 200 (the audit's reproduction).
2. `Each_kind_of_use_without_its_own_alt_blocks_the_edit` (theory or one test per
   source): page share image with no override; site settings default share image with
   no override; a section `image` `{ mediaId, decorative: false }` without alt; a blog
   body image node without alt; a working copy with `fields.imageId`. Each asserts 409
   and the matching place string. Fails today (200).
3. `Uses_with_their_own_alt_or_marked_decorative_do_not_block_the_edit`: share image with
   `shareImageAltOverride`, section image `{ alt: "Hero" }`, section image
   `{ decorative: true }` -> the same PUT returns 200. Passes before and after (guards
   against over-blocking).
4. `An_unused_image_can_be_marked_decorative_with_no_alt`: 200. Passes before and after.
5. `A_refused_edit_writes_no_audit_entry`: after test 1's refusal, no `media`/`update`
   audit row for the id.

In `studio/test/mediaLibrary.test.tsx` (vitest, mocked `request`):
6. `save shows the places that need alt text when the API refuses with alt_in_use`:
   asserts the title and each place string render. Fails today (only the title shows).

**Afterwards, exact commands:**
- `dotnet build DigitalHub.slnx -c Release` (in `api/`)
- `dotnet test api/tests/DigitalHub.Api.Tests -c Release --filter FullyQualifiedName~MediaLibraryTests`
  against `DigitalHubContent_Test` only, then the full `dotnet test ... -c Release`
  suite (CI is authoritative given the local harness).
- `cd studio && npm run typecheck && npm test && npm run build`
- `cd studio && npm run lint` if present on the base.
- CI on the pull request: CI (API, Website, Studio jobs), Security, Workflow lint all green.
- Manual, `DigitalHubContent_Studio` (one agent writing it at a time), Studio on a 42xx
  port: reproduce the audit steps before the fix (200) and after (409 with places).
- G3-1 batch: a website build from `DigitalHubContent_Studio` after the change, with no
  patched content, shows no image with empty alt that is not decorative per use.

G3 checklist: regression test committed and shown failing before the fix (tests 1, 2,
6); end-to-end test per Major does not apply (Blocker), none added because the local
e2e harness is broken and the integration test covers the route; not a Minor, so no
D-NNN.

## 6. Security impact

- Route: `PUT /api/v1/media/{id}` gets a new refusal; its policy (editor and admin)
  is unchanged. No new route.
- Data: read-only queries over content tables already read by `FindPlacesAsync`;
  `usages` reveals place strings (collection + id) the same roles already see from
  `GET /api/v1/media/{id}` and from delete. No new exposure.
- Logins, secrets, dependencies: none. No package added.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. No schema or data change.

## 9. Owner decisions needed

- **O-1 (ADM-12 second half):** "The audit's ADM-12 title also says media library edits
  go live without publishing. Today alt text and captions are stored on the image and
  every page uses the new value at the next build. After this change, an edit that
  would remove alt text the site depends on is refused. Do you also want library edits
  to wait for a publish step (a separate change, ADM-12b, with a schema change), or is
  live-on-save for library metadata acceptable?" Recommendation: accept live-on-save;
  this change removes the harmful case. This change does not wait on O-1.

## 10. Risks

- *Over-blocking:* a per-use alt in a shape the walk misses makes a valid edit 409.
  Test 3 covers override columns, section alt and per-use decorative.
- *Under-blocking:* a use source missed (for example working-copy `imageId`). Test 2
  covers each source `FindPlacesAsync` lists; the new method is built from the same
  list so a future source added to one is visible beside the other.
- *Performance:* same query count as delete's `FindPlacesAsync`, run only when the
  edit would blank the alt.
- *String matching:* sections/bodies are prefiltered with `Contains(id)` as today, then
  parsed; a malformed JSON field is skipped by the existing `TryParse` pattern, which
  could miss a use. Accepted: publish validation keeps those fields well-formed.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Used image cannot be saved decorative with no alt (refused, nothing saved) | Audit ADM-12, lines 204-206 | Planned | |
| Refusal applies while any use has no per-use alt, every use kind | Audit ADM-12, lines 207-208 | Planned | |
| Uses with own alt or per-use decorative do not block | Design, section 3 | Planned | |
| Studio shows the places that need alt | Design, section 3 | Planned | |
| Regression test committed and shown failing before the fix | README G3 checklist; refinement plan line 225 | Planned | |
| Clean website build from DigitalHubContent_Studio, no patched content | Refinement plan line 225 | Planned | |
| "Library edits go live without publishing" | Audit ADM-12 title, line 203 | Moved: O-1, possible ADM-12b | |

## 12. Revision log

- **Round 1 (2026-11-19):** first plan. No review records existed.
