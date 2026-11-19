# ADM-12d plan: Test the card-image alt check at publish

Architect, step 1. Revision round 2, 2026-11-19 (answers plan-review Round 1; see section 12). Branch `change/ADM-12d`, base `8027e87`
(the head of `origin/rebuild/dotnet-platform`, "ADM-12c: Refuse a default share
image without alt text of its own (#73)"). ADM-12 (#70) and ADM-12c (#73) are
both in that base.

Owner's request, exactly, as given to this pipeline run: "ADM-12d Test the
card-image alt check at publish".

All files the instructions name were read: `docs/changes/README.md`, `AGENTS.md`
(and `CLAUDE.md`), `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md`.
None is missing. This is a first plan: `docs/changes/ADM-12d/` held no
`plan-review.md`, `plan-approval.md` or `implementation.md`.

## 1. Item

- **Closes:** follow-up ADM-12d, recorded in `docs/changes/ADM-12c/plan-approval.md`,
  "Follow-ups recorded":
  > **ADM-12d: "Test the card-image alt check at publish".** Add a `ContentPublishTests`
  > fact for the `image` error key at `PublishChecks.cs:93-100`. The check exists but has
  > no test (plan section 2; plan-review Round 1, finding 5). Also to assess under ADM-12d:
  > whether the importer should check the target's settings row when a bundle carries
  > media but an empty `settings` table (plan-review Round 2, Minor 4). ADM-12d is not in
  > this change. It needs an owner request before it runs.

  The owner's request above is that request.
- **Track:** G3, batch G3-1 (Blockers), as the last follow-up of ADM-12.
- **Parent audit finding** (`admin-audit-2026-10-28.md:202-208`):
  > **ADM-12: the alt-text rule can be bypassed in the media library, and library
  > edits go live without publishing.**
  > - `MediaLibrary.cs:114-131` lets an image used by published items be saved as
  >   decorative with no alt (200). The next build passes and ships cards with no alt
  >   text.
  > - Fix: refuse it while any use has no per-use alt, or run the publish alt check
  >   over every use.
- **"Done when"** for the batch (`refinement-plan-2026-10-28.md:225`, G3-1 exit gate):
  > A clean website build from `DigitalHubContent_Studio` with no patched content; each
  > blocker reproduced before its fix and passing after it
- **"Done when" for this item**, from the follow-up text: a `ContentPublishTests`
  fact for the `image` error key at `PublishChecks.cs:93-100`; and the importer
  question assessed, with the decision recorded (section 3.4).

**This is coverage for existing behaviour, not a regression fix.** Reading the
code at `8027e87` (section 2), the new tests will pass against today's code
without any product change. There is no fix to show red-then-green. Section 5
says how the tests are shown to catch the bug instead: the check is broken
locally, the failure is recorded, and the broken code is never committed.

## 2. Current state

### The check

`api/src/DigitalHub.Api/Content/PublishChecks.cs` at `8027e87`:

- `AddAsync` (lines 19-38) runs `AddImagesAsync` for every collection (line 36).
- `AddImagesAsync` (lines 66-105) reads `fields.imageId` (line 75) and loads the
  asset (lines 84-89). Lines 94-101 are the card-image check:
  ```csharp
  if (imageId is Guid fieldId && assets.TryGetValue(fieldId, out var fieldAsset))
  {
      string? over = null;
      if (draft.Fields.TryGetValue("imageAltOverride", out var alt) && alt.ValueKind == JsonValueKind.String)
          over = alt.GetString();
      if (EffectiveAlt(over, fieldAsset.Alt) is null)
          Add(errors, "image", "Add alt text for the image.");
  }
  ```
- `EffectiveAlt` (line 324) is `First(usageAlt, assetAlt)` (lines 326-333): the
  trimmed override if it has text, else the trimmed asset alt, else null. It does
  not look at `MediaAsset.Decorative`, the same as the share-image rule at line 91
  and `AltText.Effective` (`api/src/DigitalHub.Api/Data/AltText.cs:9-22`).
- `ContentStore.PublishAsync` (`api/src/DigitalHub.Api/Content/ContentStore.cs:301-317`)
  runs `CheckAsync` and then `PublishChecks.AddAsync`, and returns
  `PublishBlocked(errors, warnings)` if any error is set.

`fields.imageId` and `fields.imageAltOverride` exist on five collections
(`ContentDocuments.cs:109-114`, validated at lines 204-259): partners,
case-studies, blog-posts, team-members, news-items. Save only checks their shape
(`OptionalGuid`, `OptionalShort(..., 300)`), not alt, so a draft can be saved
with a blank-alt card image and only publish refuses it.

### No test covers it

```
$ grep -rn "Add alt text for the image\|\"image\", out\|GetProperty(\"image\")" api/tests studio/src studio/test studio/e2e
api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs:351:            var stored = JsonDocument.Parse((await SendAsync(editor, HttpMethod.Get, "/api/v1/media/" + mediaId)).Body).RootElement.GetProperty("image");
```

The one hit is the media detail response's `image` member, not the publish error
key. `grep -rn "imageAltOverride\|imageId" api/tests/DigitalHub.Api.Tests/*.cs`
finds only `MediaLibraryTests.cs:338` and `:432`, which test ADM-12's library
refusal (`MediaUsage.cs:235`), not publish. So the `image` key has no test.

### What `ContentPublishTests` already has

`api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` (1283 lines,
`[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`):

- `Publish_reports_every_failure_at_once` (line 66) asserts `shareImage` (line 133),
  the share-image half of the alt rule.
- `Publish_blocks_a_blog_when_a_body_image_has_no_alt_text` (line 680) and
  `Publish_blocks_a_section_when_its_rich_text_image_has_no_alt_text` (line 715)
  cover the `WalkMedia` half (line 198).
- `Publish_does_not_require_a_description_for_a_team_member_or_a_news_item`
  (line 559) shows a team member with only a slug and title publishes with 200,
  so a team member has no other publish error to hide behind.
- Helpers to reuse: `BareImage(Guid)` (lines 1116-1127: `Alt = ""`,
  `Decorative = false`), `RemoveMediaAsync` (1129), `RemoveItemAsync` (1148, handles
  `team-members`), `Editor()`, `SendAsync`, `ReadPage`, `Code`, `Text`, `Slug()`.
- The update route is `PUT /api/v1/{collection}/{id}` (`Controllers/ContentController.cs:29`),
  used the same way at test line 1004; publish is `POST .../{id}/publish` (line 59).

### Parallel work

`gh pr list --state open` gives #74 (`change/GAP-09-status`: `ENGINEERING_STANDARDS.md`
and its records), #72 (`change/GAP-NEXT-UPGRADE`: `website/package.json`,
`website/package-lock.json` and its records), #60 (`diag/redirects-e2e`,
`studio/e2e/redirects.spec.ts`, do not merge). None touches `ContentPublishTests.cs`.
`git diff --name-only 8027e87...<branch> | grep -E "ContentPublishTests|PublishChecks|ContentBundle"`
is empty for `change/ADM-04` and `change/ISO-2`. For the local `change/ADM-05` it
lists `PublishChecks.cs`, but `git diff 8027e87 change/ADM-05 -- PublishChecks.cs`
is empty: ADM-05 is squash-merged (#59) and its content is in the base.

### The importer question (ADM-12c plan-review Round 2, Minor 4)

`api/tools/DigitalHub.ContentImport/ContentBundle.cs` at `8027e87`:

- Tables import in order, media first and settings last (lines 62-79), and each is
  saved before `CheckAsync` runs (lines 217-232). Any problem undoes the import
  (lines 244-248).
- The settings check (lines 454-468) loops over `bundle.Tables["settings"]` only.
  With an empty settings table it checks nothing, so a target settings row that
  points at an asset the bundle has just blanked is not re-checked.
- Media with no alt is a **warning**, not a problem, by design (lines 434-439: "keeps
  rows that predate it (the old site's images without alt text)").
- The importer never runs ADM-12's "alt in use" rule (`MediaUsage`) or the publish
  alt checks (`PublishChecks`): `grep -n "PublishChecks\|MediaUsage\|AltText" api/tools/DigitalHub.ContentImport/*.cs`
  finds only the doc comment at line 28. `CheckDocumentAsync`
  (`ContentStore.cs:807-808`, body at 815 onward) covers fields, schemas and rich
  text, not alt.
- Correction to the ADM-12c records, which say "every export carries the settings
  row" (`ADM-12c/plan-approval.md:50`): the settings row is created by the first
  settings save (`AdminStore.cs:274-278`, "The first save is what creates the
  row."). An export from a database whose settings were never saved has an empty
  `settings` table. So the case is not limited to hand-made bundles, although it
  still needs a target whose settings row relies on an asset that the bundle blanks.

## 3. Design

### 3.1 Two facts in `ContentPublishTests`

Both use a **team member**, because the check is the same for all five
collections and a team member has no other publish rule (no meta description,
no body, no sections; line 559 proves it publishes with only a slug and title).
So each fact can assert that `image` is the **only** error key. A test where
another error also fires could still pass with the `image` line deleted if it
only checked status and code.

**Fact A: `Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override`**

1. Seed `BareImage(mediaId)` (`Alt = ""`, `Decorative = false`) through a
   `ContentDbContext` scope, as line 697 does.
2. `POST /api/v1/team-members` with `{ slug, title = "Card image", fields = new { imageId = mediaId.ToString() } }`.
   Assert 201.
3. `POST .../{id}/publish` with the version. Assert:
   - 400, `Code(body) == "publish_blocked"`;
   - `errors` has exactly one property, named `image`, whose array is exactly
     `["Add alt text for the image."]`;
   - `GET /api/v1/team-members/{id}` still has `status` `"draft"`.
4. `PUT /api/v1/team-members/{id}` with `{ version, slug, title, fields = new { imageId, imageAltOverride = "Portrait of the team member" } }`.
   Assert 200. From the PUT response, assert that `fields.imageId` is still the
   seeded `mediaId` and `fields.imageAltOverride` is the text sent. Without this,
   step 5's 200 could come from a draft that has lost its image.
5. Publish again with the new version. Assert 200 and `state` `"published"`.
6. In `finally`: `RemoveItemAsync("team-members", id)` (it unpublishes first),
   then `RemoveMediaAsync(mediaId)`. The order is required, not a preference:
   `TeamMember.ImageId` has an FK to `Media` with `DeleteBehavior.NoAction`
   (`ContentModelBuilder.cs:78`, `:262`), so the asset cannot be removed while the
   item exists.

   Why `finally`, not inline cleanup as the facts at lines 680 and 715 do: under
   mutant M3, Fact B's step 3 publishes the item. Inline cleanup would then never
   run, and a published team member with a blank-alt image would stay in
   `DigitalHubContent_Test` for later runs. The cost is that a cleanup assertion
   that throws in `finally` would replace the original failure in xUnit's report.
   So the rule for evidence (section 3.2) is: the failure recorded for a mutant
   must be the expected assertion at the expected step, read from the test output.
   If xUnit reports a cleanup failure (`RemoveItemAsync`'s `NoContent` assertion)
   instead, that run is not mutant evidence. The developer stops and reports it.

Steps 4-5 matter as much as step 3. Without them, a check that always refused
would pass the test. They prove the override is read from `fields.imageAltOverride`.

**Fact B: `Publish_blocks_a_decorative_card_image_without_alt_text`**

Same as Fact A, steps 1-3 and 6, but the seeded asset has `Decorative = true`
(`BareImage(mediaId) with` is not available on a class, so set the property on
the returned object before `Add`). The `image` error still fires. This pins the
rule "no alt of its own and no override" that ADM-12c used for the share image
(`ADM-12c/plan-approval.md`, condition 2: `AltText.Effective`, not `IsPublishable`).
It catches a change that swaps in `AltText.IsPublishable`, which would let a
decorative card image ship with no alt, the exact ADM-12 bug ("ships cards with
no alt text").

### 3.2 Showing the tests catch the bug

Where the requirement comes from: P-4 and B-6, and the G3 checklist's "The
regression test is committed and shown failing before the fix". All three assume a
fix. Here there is none, because the check already exists. The coordinator's brief
for this run asked how the plan would show that the tests really catch the bug, and
suggested breaking the check locally. These **local mutation runs** are this plan's
way of meeting the intent of those rules. The owner did not choose this approach.
The owner's only words are the request quoted at the top.

The method: break the check, rebuild, run the two facts, record the failure, and
restore the file. The broken code is never staged or committed.

Each mutant is one exact line replacement in
`api/src/DigitalHub.Api/Content/PublishChecks.cs`, from the text at `8027e87`.
Each one compiles: the `if` at line 99 keeps a statement body, and no name goes
unused in a way the compiler refuses. The API projects do not treat warnings as
errors: there is no `TreatWarningsAsErrors` or `WarningsAsErrors` in any
`*.csproj` or `*.props` under `api/`, and there is no `Directory.Build.props` or
`.editorconfig`.

| Mutant | Line | Replace this (exact, with its indentation) | With this | Expected failure |
| --- | --- | --- | --- | --- |
| M1: the error is never added | 100 | `                Add(errors, "image", "Add alt text for the image.");` | `                { }` | A and B fail at step 3: `Assert.Equal() Failure`, expected `BadRequest`, actual `OK` |
| M2: the override is ignored | 99 | `            if (EffectiveAlt(over, fieldAsset.Alt) is null)` | `            if (EffectiveAlt(null, fieldAsset.Alt) is null)` | A fails at step 5: expected `OK`, actual `BadRequest`. B passes |
| M3: decorative assets are exempt | 99 | `            if (EffectiveAlt(over, fieldAsset.Alt) is null)` | `            if (!fieldAsset.Decorative && EffectiveAlt(over, fieldAsset.Alt) is null)` | B fails at step 3: expected `BadRequest`, actual `OK`. A passes |

M1 keeps the `if` and gives it an empty block. Deleting line 100 on its own would
leave `if (...)` followed by `}`, which does not compile (CS1525). M2 leaves `over`
assigned but unread. That is not a compiler diagnostic for a non-constant value, so
it builds.

For each mutant, alone (section 5, step 4):

1. Apply the one replacement. `git diff -- api/src` shows exactly that one line
   changed.
2. Rebuild: `dotnet build DigitalHub.slnx -c Release`. It **must exit 0 with
   `0 Error(s)`**. Record the exit code and that line. If the build fails, the run
   stops there: nothing is run with `--no-build` against an old build, and a build
   failure is never recorded as a mutant that survived.
3. Run the two facts with step 3's filter (`--no-build`, which is safe only after
   the successful build in 2). Record the exit code (non-zero expected) and the
   first failing assertion of each failing fact. Each must match the "Expected
   failure" column, and the rule in section 3.1, step 6 applies.
4. `git restore api/src/DigitalHub.Api/Content/PublishChecks.cs`.

After the last mutant, `git diff --exit-code -- api/src` must exit 0. Then rebuild
(exit 0, `0 Error(s)`) and run the two facts again: they pass. That proves the
restored build is the one the later suites test. The developer records each
mutant's diff as text in `implementation.md` (not as a file), with the build and
test commands, exit codes and the failing assertion lines. The tester repeats M1,
with the same build-then-test steps, on the detached checkout (step 5), so that the
evidence does not come only from the author (AGENTS.md: "No agent checks its own
work").

If a mutant does not fail as expected, the developer stops and reports it. That
would mean the test is weaker than planned. The test is not changed to fit the
mutant without going back to step 1.

### 3.3 Rejected alternatives

- **A `[Theory]` over all five collections.** The check is collection-agnostic
  (`fields.imageId`), and partners, case studies and blog posts need a meta
  description, and blog posts a body, before `image` is the only error. That is
  more setup for no extra branch of the code covered. One collection is enough.
- **Seeding the draft through the database instead of the API.** The API path is
  what an editor uses, and save accepts the blank-alt image (section 2). A direct
  write would not prove that.
- **Asserting only `errors.TryGetProperty("image", ...)`**, as line 133 does for
  `shareImage`. It would not catch a wrong message or a second error. The exact
  key set and message are asserted instead.
- **A Studio or end-to-end test.** The Studio shows publish errors generically and
  no Studio file changes. The G3 rule "an end-to-end test for each Major" does not
  apply: ADM-12 is a Blocker, and this change adds coverage, not behaviour.
- **Committing a red test first.** There is nothing to make it red without
  committing broken product code, which P-6 rules out. The mutation runs in 3.2
  meet the intent of P-4, B-6 and the G3 rule instead. That approach comes from
  this run's brief from the coordinator, not from the owner.
- **Running the mutant filter without `--no-build`.** This would also avoid testing
  a stale build. Rejected in favour of an explicit build that must exit 0 with
  `0 Error(s)`, because then the build result is recorded on its own and a
  compile failure cannot be mistaken for a test result.

### 3.4 Decision: the importer case is out of scope, as its own id ADM-12e

The question: should the importer check the target's settings row when a bundle
carries media but an empty `settings` table?

Decision: **not in this change.** It is recorded as a new follow-up, **ADM-12e**,
which needs its own owner request before it runs. Reasons:

1. **The owner asked for a test.** "Test the card-image alt check at publish" adds
   coverage and changes no behaviour. An importer check makes imports stricter.
   That is a behaviour change in another module, which only the owner orders (P-7),
   and a second topic in one pull request (B-8).
2. **It is a design question, not a one-line fix.** The gap is wider than the
   settings row. The importer keeps blank-alt media as a warning on purpose
   (`ContentBundle.cs:434-439`), and it never applies ADM-12's "alt in use" rule to
   any target row outside the bundle, pages and cards included (section 2). A bundle
   that blanks an asset's alt can leave a target page, card or settings row relying
   on it. Fixing only the settings row would make one use strict and leave the others
   open. ADM-12e has to decide among: (a) the settings row only; (b) every target use,
   by running `MediaUsage`'s check for each blanked asset; (c) leave it, as the old
   images are known to lack alt. Each changes what the content import accepts.
3. **The exposure is small, and it is not a build hole.** It needs a target settings
   row or use that relies on an asset, and a bundle from a source where that same
   asset (same id) has a blank alt. Every Studio edit that blanks a used asset's alt
   is already refused (ADM-12). The website build does not refuse it either, so the
   result would be a missing share-image alt, the ADM-10 situation, not a failed build.
4. **The ADM-12c premise needs correcting first.** "Every export carries the
   settings row" is not quite true (section 2: the row only exists after the first
   settings save). ADM-12e should start from that.

Proposed text for the follow-up, for the tech lead to record at gate 1 (this plan
may only change `docs/changes/ADM-12d/`):

> **ADM-12e: "Check the target's alt uses when an import blanks an asset's alt".**
> The importer checks a bundle's own settings row (ADM-12c) but not a target row the
> bundle leaves in place. A bundle with an empty `settings` table, which an export
> from a database whose settings were never saved also has (`AdminStore.cs:274-278`),
> can blank the alt of the asset the target's default share image relies on. The same
> holds for target pages and cards. Decide the scope (settings only, every use, or
> leave it) and add a failing `ContentBundleTests` fact first. Needs an owner request.

## 4. Scope

Change:

| File | Change |
| --- | --- |
| `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` | Add Facts A and B (section 3.1), next to `Publish_blocks_a_section_when_its_rich_text_image_has_no_alt_text` (line 715). Reuse the existing helpers. No helper is changed or removed. |
| `docs/changes/ADM-12d/*` | The records: this plan, then the review, approvals, `implementation.md` and `test-report.md`. |

Out of scope, deliberately:

- `PublishChecks.cs`, `AltText.cs`, `ContentStore.cs`, `ContentDocuments.cs`: no
  product change. Mutants M1-M3 touch `PublishChecks.cs` locally only.
- `api/tools/DigitalHub.ContentImport/ContentBundle.cs` and `ContentBundleTests.cs`:
  the importer case, now ADM-12e (section 3.4).
- The whitespace-only override (`"   "` counts as none, `First` at lines 326-333).
  It is shared with the share-image rule and is not part of the request.
- Users and error-pages files (ADM-04, ADM-05), the Studio, the website, workflows,
  migrations and lockfiles.

## 5. Test plan

### Tests written first

Facts A and B, in `ContentPublishTests.cs`, as in section 3.1. **Both are expected
to pass on the first run, on today's code.** The developer records that first run
as such ("passes against unchanged product code; coverage for existing behaviour"),
and must not describe it as red.

### Commands (from `api/`, Release only)

Release because Windows Application Control blocks Debug test builds. Integration
tests run against `DigitalHubContent_Test` only: `ApiFactory` rewrites the catalog
to it and refuses any other. Nothing writes to `DigitalHubContent` or
`DigitalHubContent_Studio`. Before the full suite, `npm ci` in `website/` (the CI API
job does this; `ADM-12c/implementation.md:119`). Only one agent may write the test
database at a time: check with the coordinator before running.

1. `dotnet tool restore`
2. `dotnet build DigitalHub.slnx -c Release`: exit 0, `0 Error(s)`, and no more
   warnings than the base build (record the base count).
3. New facts: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests.Publish_blocks_a_card_image|FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image"`: exit 0, 2 passed.
4. Mutants M1, M2 and M3 (section 3.2, exact edits in its table), one at a time:
   - apply the edit; `git diff -- api/src` shows the one changed line;
   - `dotnet build DigitalHub.slnx -c Release`: **must exit 0 with `0 Error(s)`**,
     recorded. If it does not, stop: step 3's `--no-build` run would test the old
     build;
   - step 3's command: record the non-zero exit code and each failing fact's first
     failing assertion, matched to the expected step;
   - `git restore api/src/DigitalHub.Api/Content/PublishChecks.cs`.

   Afterwards, `git diff --exit-code -- api/src` exits 0. Rebuild (exit 0,
   `0 Error(s)`) and run step 3's command again: exit 0, 2 passed.
5. The class: `dotnet test ... -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests"`: exit 0, no failures.
6. Full suite: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`: exit 0, the base total plus 2, no failures.
7. Scope: `git diff --name-only 8027e87..HEAD` lists only `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` and `docs/changes/ADM-12d/*`.

Not run locally:

- Studio and website suites (`npx tsc -b`, `npm test`, `npm run build`,
  `npm run typecheck`, `npm run design:check`): NOT RUN, because no Studio or
  website file changes. The CI Studio and Website jobs cover them.
- End-to-end (`npx playwright test`): NOT RUN, because the local e2e harness is
  broken. The CI job "Studio — typecheck, build, end-to-end" is the evidence.
- At gate 2, CI, Security (with gitleaks) and Workflow lint on the final head are
  quoted by run id.

### Track checklist (G3, from `docs/changes/README.md`)

- [ ] The finding, its evidence and its fix come from `admin-audit-2026-10-28.md`:
  ADM-12 ("ships cards with no alt text"; fix "run the publish alt check over every
  use"). This change tests the card half of that publish check.
- [ ] The regression test is committed and shown failing before the fix: there is no
  fix. The tests are committed, and mutants M1-M3 show them failing against a broken
  check (section 3.2). The tester repeats M1.
- [ ] The end-to-end suite gets a test for each Major: not applicable (ADM-12 is a
  Blocker, and this change adds no behaviour). CI e2e must stay green.
- [ ] A Minor that is not fixed becomes a D-NNN entry with an expiry: the importer
  case is not an exception but a named follow-up, ADM-12e (section 3.4), so it needs
  no D-NNN entry.

## 6. Security impact

None. One test file changes. No route, policy, role, record scope, login, secret,
dependency, lockfile or workflow changes. The tests use the existing editor
account through `ApiFactory`, against `DigitalHubContent_Test`. The mutants are
never committed: step 4's `git diff --exit-code -- api/src` and step 7's file list
check that.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. It adds two tests and records only.

## 9. Owner decisions needed

None for this change.

For the owner's information, not blocking: ADM-12e (section 3.4) runs only if the
owner requests it. This plan does not assume an answer.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| The tests pass for the wrong reason, for example another error blocks publish | Exactly one error key, `image`, and its exact message are asserted; mutant M1 must turn both facts from 400 to 200 |
| The check always refuses, and the test would not notice | Fact A's override half; mutant M2 |
| A later change swaps in `AltText.IsPublishable` and lets decorative card images through | Fact B; mutant M3 |
| A mutant is committed by mistake | `git diff --exit-code -- api/src` and the step 7 file list; the tester checks the diff |
| Leftover rows in `DigitalHubContent_Test` affect `MediaUsage` counts in other tests, especially the item M3 publishes | Cleanup in `finally`, item before asset (the FK is `NoAction`) |
| A cleanup failure in `finally` hides the real failure | Mutant evidence must be the expected assertion at the expected step (section 3.1, step 6). A cleanup failure is reported, never recorded as evidence |
| A mutant does not compile and the `--no-build` run tests the old build, so the mutant seems to survive | Each mutant is an exact edit that compiles (section 3.2). Its build must exit 0 with `0 Error(s)` before the test runs |
| A clash with another change | No open PR or active change branch touches `ContentPublishTests.cs` (section 2) |
| The PUT body drops `imageId` and the second publish passes with no image | Fact A, step 4 resends `imageId` and asserts, from the PUT response, that `fields.imageId` is still the seeded id; mutant M2 |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A `ContentPublishTests` fact for the `image` error key (`PublishChecks.cs:93-100`) | `ADM-12c/plan-approval.md`, "Follow-ups recorded" | Planned | |
| The override clears the `image` error | `PublishChecks.cs:96-99`; this plan, Fact A | Planned | |
| A decorative asset with no alt and no override is still refused | ADM-12 audit text; `ADM-12c/plan-approval.md` condition 2; Fact B | Planned | |
| The tests catch a broken check (mutants M1-M3: each builds with `0 Error(s)` and fails as expected; none committed) | P-4, B-6, G3 checklist ("shown failing before the fix"), met through mutation because there is no fix; method from the coordinator's brief for this run | Planned | |
| The tests pass against today's code (coverage, not a fix) | Coordinator's brief for this run; this plan, section 1 | Planned | |
| The importer case with an empty `settings` table assessed and decided | `ADM-12c/plan-approval.md`; plan-review Round 2, Minor 4 | Planned | Moved to follow-up ADM-12e (section 3.4) once the tech lead records it |
| Full API suite green in Release; CI, Security, Workflow lint green on the final head | `docs/changes/README.md`; `ENGINEERING_STANDARDS.md` G-2 | Planned | |

## 12. Revision log

- **Round 0 (2026-11-19).** First plan. No review yet.
- **Round 2 (2026-11-19), answering plan-review Round 1** (CHANGES NEEDED: 1 Major,
  3 Minors). The approach, the scope, the ADM-12e decision and the owner decisions
  (none) are unchanged.
  1. **Major: M1 does not compile, and the mutant runs did not require a build.**
     Accepted. Section 3.2 now gives each mutant as an exact one-line replacement,
     with the before and after text. M1 replaces line 100 with `{ }`, so the `if`
     keeps a body and the file compiles. Why deleting the line alone fails (CS1525)
     is stated. Section 3.2 also says why M2 still builds, and that `api/` has no
     warnings-as-errors setting. Section 3.2 and section 5, step 4 now require each
     mutant's `dotnet build DigitalHub.slnx -c Release` to exit 0 with `0 Error(s)`,
     recorded, before the `--no-build` filter runs. A failed build stops the run and
     is never recorded as a survived mutant. After restoring, the developer rebuilds
     and re-runs the two facts green. Running without `--no-build` is listed and
     rejected in 3.3, with the reason. The tester's M1 repeat follows the same steps.
  2. **Minor: the PUT keeps `imageId` only in the risk table.** Accepted. Fact A,
     step 4 now asserts from the PUT response that `fields.imageId` is the seeded id
     and `fields.imageAltOverride` is the text sent. The risk row points to step 4.
  3. **Minor: cleanup in `finally` can hide the real failure.** Accepted. Cleanup
     stays in `finally`, because under M3 Fact B publishes the item, and inline
     cleanup would leave a published blank-alt team member in
     `DigitalHubContent_Test`. Section 3.1, step 6 now sets the evidence rule: the
     recorded failure must be the expected assertion at the expected step, read from
     the test output. A cleanup failure is reported and is not evidence. The
     item-before-asset order is kept, and the FK (`ContentModelBuilder.cs:78`,
     `DeleteBehavior.NoAction`) is cited as the reason. A risk row is added.
  4. **Minor: the mutation approach was credited to the owner.** Accepted. Sections
     3.2, 3.3 and 11 now cite P-4, B-6 and the G3 rule, which assume a fix, and the
     coordinator's brief for this run as the source of the mutation method. The
     plan states that the owner did not choose it. The owner's only words remain the
     quoted request.
