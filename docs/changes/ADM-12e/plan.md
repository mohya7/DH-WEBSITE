# ADM-12e plan: check the target's alt uses when an import blanks an asset's alt

Architect, step 1. 2026-11-19. Branch `change/ADM-12e`, worktree
`D:\work\DigitalHub\dh-platform-claude-adm-12e`, cut from `origin/rebuild/dotnet-platform`
at `0488d89` ("ADM-12d: Test the card-image alt check at publish (#77)"). Revision round 1,
updated the same day with the owner's answer to O-1.

**Owner decision O-1 is answered: option A** (section 9, quoted there with the date). This
plan picks a scope and gives the reasons (section 3.1). Every scope that closes the gap
makes the content import refuse a bundle it accepts today. In one case, a bundle that
today only gets a note is refused. That note is documented behaviour
(`docs/content-bundle.md:186-187`; `ContentBundle.cs:435-436`), and under P-7 only the
owner can change it. The owner chose A, the scope this plan recommended, so the design in
section 3 stands as written. Section 3.4 records the answers the owner did not choose.

Owner's request, exactly, as given to this pipeline run: "ADM-12e" (the owner typed "run
change adm12-e").

Read for this plan: `docs/changes/README.md`, `AGENTS.md` and `CLAUDE.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, the ADM-12 finding in
`docs/quality/admin-audit-2026-10-28.md` (lines 202-208),
`docs/changes/ADM-12d/plan.md` (section 3.4), `docs/changes/ADM-12d/plan-approval.md`
("Follow-ups recorded"), `docs/changes/ADM-12d/delivery-approval.md`, and
`docs/changes/ADM-12c/plan-approval.md`. All of them exist. `docs/changes/ADM-12e/` did
not exist, so this is the first round: there are no review files to answer yet.

## 1. Item

- **Closes:** follow-up **ADM-12e**, recorded at gate 1 of ADM-12d
  (`docs/changes/ADM-12d/plan-approval.md:122-131`), and repeated at gate 2
  (`docs/changes/ADM-12d/delivery-approval.md:228-231`). It is the last open part of
  audit finding **ADM-12** (Blocker). The follow-up's text, quoted:

  > **ADM-12e: "Check the target's alt uses when an import blanks an asset's alt".** The
  > importer checks a bundle's own settings row (ADM-12c) but not a target row the bundle
  > leaves in place. A bundle with an empty `settings` table, which an export from a
  > database whose settings were never saved also has (`AdminStore.cs:233` and `:273`,
  > "The first save is what creates the row."), can blank the alt of the asset the
  > target's default share image relies on. The same holds for target pages and cards.
  > Decide the scope (settings only, every use, or leave it) and add a failing
  > `ContentBundleTests` fact first.

  It starts from the correction recorded at `docs/changes/ADM-12d/plan-approval.md:136-139`:
  the settings row exists only after the first settings save, so not every export carries it.
- **Track:** G3, batch G3-1 (Blockers), as the last follow-up of ADM-12.
- **Done when**, from the audit (`admin-audit-2026-10-28.md:202-208`):

  > **ADM-12: the alt-text rule can be bypassed in the media library, and library
  > edits go live without publishing.** [...] Fix: refuse it while any use has no per-use
  > alt, or run the publish alt check over every use.

  and the G3-1 exit gate (`refinement-plan-2026-10-28.md:225`): "each blocker reproduced
  before its fix and passing after it". The G3 track rule (`docs/changes/README.md`): "The
  regression test is committed and shown failing before the fix."

## 2. Current state

All at `0488d89`.

**The import's media check is a note, never a refusal.**
`api/tools/DigitalHub.ContentImport/ContentBundle.cs:431-439`:

```csharp
foreach (var row in bundle.Tables["media"])
{
    var asset = row!.Deserialize<MediaAsset>(Json)!;
    // A warning, not a refusal: the Studio applies this check when an image is uploaded or
    // edited, and keeps rows that predate it (the old site's images without alt text).
    var error = MediaLibrary.MetadataError(asset.Alt, asset.Decorative, asset.Caption);
    if (error is not null)
        warnings.Add($"media {asset.Id} ({asset.OriginalName}): {error}");
```

`MediaLibrary.MetadataError` (`MediaLibrary.cs:185-195`) only finds `!decorative` with a
blank alt. An asset marked decorative with a blank alt gets **no note at all**.
`docs/content-bundle.md:186-187` documents the note: "Images without alt text are
**listed as notes**, not refused, because the Studio only checks alt text when an image
is uploaded or edited."

**The ADM-12 rule exists in the Studio only.** `MediaLibrary.UpdateAsync`
(`MediaLibrary.cs:126-132`) refuses an edit that leaves no alt while any use relies on the
asset's alt, with `MediaUsage.FindPlacesWithoutOwnAltAsync` (`MediaUsage.cs:118-198`).
That function reads every source: share images and card images on all eight collections,
the settings row's default share image, blog bodies, section fields and working copies.
The ContentImport project never calls it: `grep -rn FindPlacesWithoutOwnAltAsync api/tools`
finds nothing. The only callers are in `api/src`. The Studio edit that is not decorative
is refused even earlier, by `AltError` (`MediaLibrary.cs:119-121`), whether the asset is
used or not.

**The only import alt check on uses is ADM-12c's, and it reads the bundle's settings row only.**
`ContentBundle.cs:454-468` loops over `bundle.Tables["settings"]`. If that table is empty,
there is nothing to loop over, and the target's settings row is never checked.
`AdminStore.cs:233` ("Reading never creates the row; the first save does.") and `:273`
("The first save is what creates the row.") show that an export from a database whose
settings were never saved has an empty `settings` table. A hand-edited bundle can have one
too.

**The import never runs the publish checks.** `ContentBundle.CheckAsync`
(`ContentBundle.cs:372-392`) calls `ContentStore.CheckDocumentAsync`
(`ContentStore.cs:807-892`). That runs schemas, slugs, redirects and media existence, but
not `PublishChecks.AddAsync`. Its only caller is `ContentStore.cs:316`, at publish. So no
row, in the bundle or on the target, has its card or share image alt checked at import.
The existing fact `A_default_share_image_with_an_override_imports`
(`ContentBundleTests.cs:481-502`) shows this today: it imports a decorative, blank-alt
asset used by the seeded published case study's card (`ImageId = MediaId`, no override,
`ContentBundleTests.cs:853`), and `result.Ok` is true.

**Blanking a target asset's alt needs `--force`, and `--force` lets it through.**
`MediaAsset` (`ContentEntities.cs:253-287`) has no `UpdatedAt` or `SavedAt` column. So when
a bundle's media row differs from the target's, `Table<T>.Older`
(`ContentBundle.cs:1128-1148`) reports a conflict at line 1147 ("differs on the target,
and has no edit time to show which is newer"). The import refuses without `--force`
(`ContentBundle.cs:227-228`). With `--force` it overwrites the row, and nothing in
`CheckAsync` looks at the target's uses.

**The gap, step by step** (read from the code; not run, because the architect does not
touch a database):

1. The target has asset `M` with alt "The team at work". A published case study uses it as
   its card image with no override, and its settings row uses it as the default share image.
2. The bundle carries `M` with `alt = ""` (decorative or not), and empty `case-studies`
   and `settings` tables.
3. With `--force`: the media row is overwritten, the media loop adds at most a note (or
   nothing, when decorative), the settings loop has no rows, and readback matches. The
   result is `Ok`.
4. The next website build ships the card and the share image with no alt text. This is
   the ADM-12 outcome, reached through the importer instead of the media library.

**Branches.** `gh pr list --state open` lists #78 (`change/GAP-11c`) and draft #60
(`diag/redirects-e2e`, do not merge). A three-dot diff from `0488d89` to every
`origin/change/*` and `origin/diag/*` branch, over the files in section 4, lists only
`change/ADM-02`, `change/ADM-12` and `change/ADM-12c`. All three are squash-merged (#54,
ADM-12, #73), and their two-dot diffs against the base are deletions only, so they are
behind the base. #78 touches only `website/` and its records; #60 touches only
`studio/e2e/redirects.spec.ts`. No users or error-pages files are in scope.

## 3. Design

### 3.1 Scope chosen, and why

**Recommended scope: every target use, when the import blanks an alt the target had.**

An import **blanks** an asset's alt when the target already has that asset (same id) with
an alt that is not blank, and the bundle's row for it has a blank alt, whether or not the
row is marked decorative. "Blank" means what `AltText.Effective` (`AltText.cs:9-22`) uses:
`string.IsNullOrWhiteSpace`. For each asset the import blanks, after every table has been
imported and saved, the importer calls `MediaUsage.FindPlacesWithoutOwnAltAsync`. If it
finds any place, the import is refused with one problem that names the places. It is a
problem, not a note, so `--force` does not bypass it, as with ADM-12c (`ContentBundle.cs:461`).

Why this scope:

1. **It is the follow-up's own words.** "Check the target's alt uses when an import blanks
   an asset's alt": target uses, and a blank where the target had alt.
2. **It is the ADM-12 rule, from the code that holds it.** It calls
   `FindPlacesWithoutOwnAltAsync`, the same function the media library uses. It covers
   pages, cards, the settings row, blog bodies, sections and working copies in one place,
   and it follows any source added there later. It adds no second copy of the rule.
3. **It keeps every case the note exists for.** The note's reason is "rows that predate
   it (the old site's images without alt text)". A new asset, and a target asset that
   already has no alt, are not blanked by the import, so they still import with a note,
   as today. That covers a first import into a fresh database, the bundle's main use
   (`ContentBundle.cs:20`). The only refusal is for an asset whose alt the target already
   had: the import would remove an editor's alt from content that relies on it.
4. **The places are read after the import.** So a use the bundle brings counts the same as
   one the target already had. Both are in the state the next build ships.

Rejected:

| Option | Why not |
| --- | --- |
| (a) The settings row only: also check the target's row when the bundle's `settings` table is empty | It closes one of the use kinds and leaves pages, cards and sections open, which the follow-up names ("The same holds for target pages and cards"). It would need a second copy of the rule beside ADM-12c, where `FindPlacesWithoutOwnAltAsync` already reads the settings row (`MediaUsage.cs:136-139`). |
| (b-all) Every use, for every blank-alt asset in the bundle, blanked or not | It refuses the old site's images on a first import, when their pages rely on them. That is exactly what the note keeps (`ContentBundle.cs:435-436`). It goes beyond "blanks" and needs its own owner decision. |
| (b-decorative) Only for assets the bundle marks decorative, mirroring `MediaLibrary.cs:127` literally | The gap stays open in the commoner case. A non-decorative blank-alt copy over a target alt gets a note and is applied, and the target's uses lose their alt. The Studio refuses that edit outright (`AltError`); the import would let it through. Offered to the owner as O-1 option B. |
| (c) Leave it | The ADM-12 Blocker stays open through the importer. Offered to the owner as O-1 option C. |
| (d) A note that lists the places, with no refusal | It changes no acceptance, so it would need no owner decision, but the import still ships the cards with no alt. A note is easy to miss in a long import report. Rejected as not closing the finding. |
| Run `PublishChecks` over every target row after import | It goes past this item. It also refuses the old site's content on a first import, and it is a much larger behaviour change. |
| Compare against the bundle's previous state instead of the target's | The bundle has no previous state. The target's row before the import is the only record of the alt that would be lost. |

### 3.2 Code

In `api/tools/DigitalHub.ContentImport/ContentBundle.cs`:

1. In `ImportAsync`, inside the `try` and before the `foreach (var table in Tables)` loop
   (line 218), read which of the bundle's media ids the target has with alt of their own:

   ```csharp
   // ADM-12e: read before any row is written, so it holds the target's alt, not the bundle's.
   var withAlt = await TargetAssetsWithAltAsync(db, bundle, cancellationToken);
   ```

   ```csharp
   /// <summary>The bundle's media ids that the target already has with alt text of their own.</summary>
   private static async Task<HashSet<Guid>> TargetAssetsWithAltAsync(ContentDbContext db, Bundle bundle, CancellationToken cancellationToken)
   {
       var ids = bundle.Tables["media"].Select(row => row!["id"]!.GetValue<Guid>()).ToList();
       var rows = await db.Media.AsNoTracking()
           .Where(asset => ids.Contains(asset.Id))
           .Select(asset => new { asset.Id, asset.Alt })
           .ToListAsync(cancellationToken);
       return rows.Where(row => !string.IsNullOrWhiteSpace(row.Alt)).Select(row => row.Id).ToHashSet();
   }
   ```

   The blank test runs in C#, not SQL, so it matches `AltText.Effective` for every kind of
   whitespace.
2. Pass `withAlt` to `CheckAsync` as a new parameter (line 232). `CheckAsync` is private;
   it has one caller.
3. In the media loop (after line 439, before the safety checks), add:

   ```csharp
   // ADM-12e: the media library's alt-in-use rule (ADM-12). An import that removes alt the
   // target's image had is an edit of it: refused while any use relies on that alt. The
   // places are read after every table is saved, so they include the bundle's own rows.
   // A problem, not a warning: --force never bypasses it. New assets, and target assets
   // that already had no alt, keep the warning above.
   if (string.IsNullOrWhiteSpace(asset.Alt) && withAlt.Contains(asset.Id))
   {
       var places = await MediaUsage.FindPlacesWithoutOwnAltAsync(db, asset.Id, cancellationToken);
       if (places.Count > 0)
           problems.Add($"media {asset.Id} ({asset.OriginalName}): alt: the bundle removes this image's alt text, and it is used without alt text of its own: {string.Join("; ", places)}.");
   }
   ```

   The note above it stays, unchanged. A non-decorative blanked asset reports both the
   note and the problem. That is accurate, and the import is refused either way.
4. Update the comment at lines 435-436 so it no longer says the media check is never a
   refusal: point to the ADM-12e block.

ADM-12c's settings check (`ContentBundle.cs:454-468`) stays as it is. When the bundle
carries a settings row that relies on a blanked asset, both checks report it. Each is
true, and the existing ADM-12c fact asserts with `Contains`/`StartsWith`
(`ContentBundleTests.cs:463`, `:472`), so a second problem does not break it.

In `docs/content-bundle.md`, replace lines 186-187 with:

> Images without alt text are **listed as notes**, not refused, because the Studio only
> checks alt text when an image is uploaded or edited. One exception: an import that
> removes the alt text of an image the target already has is an edit of that image. It is
> refused while a page, card, section, draft or the settings row uses the image without
> alt text of its own, as the Studio refuses the same edit. `--force` does not override
> this.

### 3.3 What stays the same

- The note for blank-alt media, in every case that is not a blank over a target alt.
- First imports into a fresh database: no asset there has alt, so nothing is blanked.
- `--force` still overrides conflicts and nothing else.
- No API route, no Studio or website code, no schema.

### 3.4 The O-1 answers not chosen

The owner chose A (section 9), so the design above applies unchanged. These were the
other answers. They are kept as a record only, and none of them is planned:

- **B (decorative only):** step 3's condition would have been
  `asset.Decorative && string.IsNullOrWhiteSpace(asset.Alt) && withAlt.Contains(asset.Id)`.
  Fact F1 would have run only its `decorative: true` case.
- **C (leave it):** no code change, and the gap recorded as a D-NNN entry in
  `docs/deferred-items.md`.

With A, a copy that is not marked decorative is refused too, so the F1 `(false)` case and
mutant M3 are required.

## 4. Scope

Change:

| File | Change |
| --- | --- |
| `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs` | Add facts F1, F2, F3, G1 and G2 (section 5), after `A_default_share_image_with_an_override_imports` (line 481). Reuse `SeedAsync`, `ExportAsync`, `Edit`, `EmptyAsync`, `ImportAsync` and `InTransactionAsync`. No helper is changed or removed. |
| `api/tools/DigitalHub.ContentImport/ContentBundle.cs` | Section 3.2: `TargetAssetsWithAltAsync`, the read before the table loop, the `CheckAsync` parameter, the check in the media loop, and the comment. |
| `docs/content-bundle.md` | Lines 186-187, as in section 3.2. |
| `docs/changes/ADM-12e/*` | The records. |

Out of scope, deliberately:

- `MediaUsage.cs`, `MediaLibrary.cs`, `AdminStore.cs`, `PublishChecks.cs`, `ContentStore.cs`:
  used as they are, unchanged.
- Running `PublishChecks` at import, for the bundle's own published rows (section 2). The
  import does not check card or share-image alt on any row today. Changing that refuses
  the old site's content and is a separate decision. For the owner's information only; it
  is not a follow-up this plan records.
- The ADM-12c settings check: unchanged (section 3.2).
- The bundle's export side, `BundleCommands.cs` (it already prints every problem,
  `BundleCommands.cs:185` prints the notes), the Studio, the website, workflows,
  migrations, and any users or error-pages file.

## 5. Test plan

All in `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`, inside
`InTransactionAsync` on `DigitalHubContent_Test`, so nothing is kept. "The blanking
bundle" below means `Edit(await ExportAsync(db, _source), root => { ... })` with
`media[0].alt = ""`, `media[0].decorative` as stated, and every other table set to an
empty `JsonArray`. Its media files are still in the bundle, and `Edit` recomputes the
checksums and counts. "The problem" means the one entry of `result.Problems` that starts
with `$"media {MediaId} (team.webp): alt: the bundle removes this image's alt text"`.

**Written first and committed red** (they fail at `0488d89`, because today the result is
`Ok`):

| Fact | Arrange | Asserts |
| --- | --- | --- |
| F1 `[Theory] [InlineData(true)] [InlineData(false)]` `An_import_that_blanks_an_alt_a_target_card_relies_on_is_refused(bool decorative)` | `SeedAsync`: the target's published case study uses `MediaId` as its card image with no override (`ContentBundleTests.cs:853`), and its working copy too. Bundle: the blanking bundle. | Without `--force`: not `Ok`, a `media` conflict (unchanged behaviour). With `--force` and `dryRun: true`: not `Ok`, and the problem is there. With `--force`: not `Ok`; `Conflicts` is not empty; exactly one problem starts with the prefix, and it contains `$"case-studies {CaseId:D} image"`; the target's media `Alt` is still "The team at work" (rolled back). |
| F2 `An_import_with_no_settings_row_that_blanks_the_default_share_image_alt_is_refused` | `SeedAsync`, then the target's settings row gets `DefaultShareImageId = MediaId` with no override, saved through the db context. Bundle: the blanking bundle, `decorative: true` (the case that gets no note today), so its `settings` table is empty. | With `--force`: not `Ok`; the problem contains `"site-settings 80000000-0000-0000-0000-000000000001 default share image"`; the target's settings `DefaultShareImageId` is still `MediaId`, and the media `Alt` is unchanged. |
| F3 `An_import_that_blanks_an_alt_a_target_page_section_relies_on_is_refused` | `SeedAsync`, then the target's page section becomes `case_cards` with `items: [{ title: "T", image: { mediaId: MediaId, alt: "", decorative: false } }]`, saved through the db context. Bundle: the blanking bundle, `decorative: true`. | With `--force`: not `Ok`; the problem contains `$"pages {PageId:D} section {SectionId:D}"`. |

**Guards, written in the same commit, green before and after** (they keep the note for
the cases it exists for, and catch an over-broad fix):

| Fact | Arrange | Asserts |
| --- | --- | --- |
| G1 `An_import_that_blanks_an_alt_no_target_use_relies_on_still_imports` | `SeedAsync`, then on the target: the case study gets `ImageAltOverride = "Case card"`, and the working copies are deleted. Bundle: the blanking bundle, `decorative: false`. | With `--force`: `Ok`; `Warnings` contains `$"media {MediaId} (team.webp): Alt text is required unless the image is decorative."`; the target's media `Alt` is now `""`. |
| G2 `A_first_import_of_an_image_without_alt_text_still_imports_with_a_note` | `SeedAsync`, export, then edit only `media[0].alt = ""` (`decorative: false`), keeping every table, so the bundle's published case study and working copy rely on it. `EmptyAsync`, then import into `_target`. | Without `--force`: `Ok`; `Warnings` contains the note above; `db.CaseStudies` holds the case study. |

Commit 1, subject `ADM-12e: Test that an import may not blank alt text a target use relies on`:
the five facts only. Before it is committed, the developer runs it and quotes the output:
F1 (both cases), F2 and F3 fail on `Assert.False(... .Ok)`, and G1 and G2 pass. Commit 2
is the fix and the doc. Then all five pass.

**Mutants** (the tester applies each one to the fix on a scratch copy, builds, runs the
five facts, and puts it back; no mutant is committed):

| Id | Mutation | Must fail |
| --- | --- | --- |
| M1 | Drop `&& withAlt.Contains(asset.Id)` | G2 |
| M2 | Delete the ADM-12e block | F1, F2, F3 |
| M3 | Add `asset.Decorative &&` to the condition | F1 `(false)` |
| M4 | `warnings.Add` in place of `problems.Add` | F1, F2, F3 |
| M5 | Move the `TargetAssetsWithAltAsync` call after the table loop | F1, F2, F3 |
| M6 | Drop `if (places.Count > 0)` | G1 |

**Commands**, from `api/`, in Release (Windows Application Control blocks Debug builds):

1. `dotnet build DigitalHub.slnx -c Release`: exit 0, `0 Error(s)`. The warning count is
   quoted, and it is not higher than on the base.
2. `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentBundleTests"`:
   red after commit 1, as stated above; all pass after commit 2.
3. `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~MediaLibraryTests"`:
   all pass (the ADM-12 rule this change reuses).
4. `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`:
   the full suite, 0 failed. ADM-12d recorded 595 passed; the new count is expected to be
   601 (595, plus six test cases: the F1 theory counts as two).
5. `dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build`:
   0 failed. It does not reference the importer; run because CI runs it.
6. `git diff --name-only 0488d89 HEAD`: only the files in section 4.

Only one agent at a time on `DigitalHubContent_Test`. Never `DigitalHubContent`.

NOT RUN locally, with the CI job that covers each:

- Studio end-to-end: the local harness is broken. Evidence is CI job `studio`, "Studio —
  typecheck, build, end-to-end". No Studio file changes.
- Website typecheck, tests, design check, snapshot build, and the section comparison: no
  website file changes. Evidence is CI jobs `website` and `section-compare`.
- Security (gitleaks, Semgrep, dependency audits) and Workflow lint: CI on the PR head.
  Their run ids are quoted at gate 2.

**Track checklist, G3:**

- [ ] The finding, its evidence and its fix come from `admin-audit-2026-10-28.md` (ADM-12,
  lines 202-208), via the recorded follow-up ADM-12e.
- [ ] The regression tests (F1 to F3) are committed and shown failing before the fix.
- [ ] End-to-end test for each Major: not applicable. ADM-12 is a Blocker, and the
  importer is a command-line tool with no Studio screen. The Studio's media-library
  refusal is already covered.
- [ ] A Minor not fixed becomes a D-NNN entry: not applicable. ADM-12 is a Blocker, and
  the owner chose to fix this path (O-1: A).

## 6. Security impact

- **Routes and policies:** none. The importer is the `DigitalHub.ContentImport` command,
  run by an operator against a database. No API route changes.
- **Data:** the import gets stricter. One more kind of bundle is refused, inside the
  existing transaction, so nothing is written. Refusals can only reduce what is written.
- **Logins, secrets:** none. The new query is read-only, on the same connection and in the
  same transaction.
- **Dependencies:** none. `MediaUsage` is already referenced through `DigitalHub.Api`
  (`using DigitalHub.Api.Content;`, `ContentBundle.cs:9`).
- **Output:** the problem lists ids, collection names and the asset's original file name,
  as the existing note does (`ContentBundle.cs:439`). No content or credentials.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. There is no schema or data change. An import refused under
this change wrote nothing.

## 9. Owner decisions needed

**O-1 (ADM-12e scope).** The exact question:

> When a content import overwrites an image the target already has, with alt text, by a
> copy of that image with no alt text, and a page, card, section, draft or the settings
> row on the target uses the image without alt text of its own, what should the import
> do?
>
> A. Refuse the import, whether or not the copy is marked decorative. This is the same as
> the Studio, which refuses both edits. Recommended. New images, and images that already
> had no alt text on the target (the old site's images), still import with a note, as
> today.
>
> B. Refuse only when the copy is marked decorative. This mirrors the media library's
> ADM-12 check exactly. A copy that is not marked decorative imports with a note, as
> today, and those uses lose their alt text.
>
> C. Leave it as today: a note for a copy that is not marked decorative, nothing for one
> that is. The gap is recorded as an exception with an expiry.

Why it is the owner's decision: A and B make the import refuse bundles it accepts today.
A also refuses, in the case above, a copy that today gets only the note that
`docs/content-bundle.md:186-187` promises ("listed as notes, not refused"). That is a
behaviour change, and only the owner decides it (P-7).

**Owner's answer, exactly:** "A: refuse both". Given on 19 November 2026, in the
orchestrator session for this pipeline run. The owner chose the button with that label
in reply to "For ADM-12e O-1, which should the import do?", with this section's question
and options A, B and C shown. The coordinator relayed the answer to the architect; this
plan has no other record of it.

So the plan goes ahead with option A, the design in section 3 as written:
- refuse the import whether or not the copy is marked decorative;
- keep the note for new images and for images that already had no alt on the target;
- update `docs/content-bundle.md:186-187` with the text in section 3.2, in the developer's
  fix commit.

No other owner decision is needed.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| The check refuses the old site's images on a first import | G2; mutant M1 |
| The check refuses a blanked asset that nothing relies on | G1; mutant M6 |
| The target's alt is read after the bundle overwrote it, so nothing is ever "blanked" | F1 to F3; mutant M5 |
| Only one of the use kinds is checked | F1 (card and working copy), F2 (settings with an empty table), F3 (page section). Each kind in `FindPlacesWithoutOwnAltAsync` is already covered by `MediaLibraryTests` (`MediaLibraryTests.cs:363-445`, `Each_kind_of_use_without_its_own_alt_blocks_the_edit`; the card image at lines 330-349) |
| `--force` bypasses the refusal | Every red fact runs with `--force`; mutant M4 |
| The refusal leaves partial writes or files behind | It is a problem inside the existing transaction, undone by `UndoAsync` before files are written (`ContentBundle.cs:244-250`); F1 and F2 assert the target's rows are unchanged |
| The extra problem breaks the ADM-12c facts | They assert with `Contains`/`StartsWith` (`ContentBundleTests.cs:463`, `:472`); their "new rows" cases run on an empty target, where nothing is blanked. Command 2 runs them |
| Whitespace-only alt is treated differently in SQL and in C# | The blank test runs in C# with `IsNullOrWhiteSpace`, as `AltText.Effective` does |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Scope chosen, with reasons | `ADM-12d/plan-approval.md:122-131` ("Decide the scope") | Planned | |
| Owner's answer to O-1 recorded verbatim, with the date | P-7; section 9 | Planned | |
| Failing `ContentBundleTests` fact committed first: card use (F1) | `ADM-12d/plan-approval.md:128-129`; README G3 rule | Planned | |
| Target settings row checked when the bundle's `settings` table is empty (F2) | ADM-12e text; ADM-12c plan-review Round 2, Minor 4 | Planned | |
| Target page uses checked (F3) | ADM-12e text ("The same holds for target pages and cards") | Planned | |
| The note for the old site's images kept (G1, G2) | `ContentBundle.cs:435-436`; `docs/content-bundle.md:186-187` | Planned | |
| `--force` does not bypass the refusal | ADM-12c precedent, `ContentBundle.cs:461` | Planned | |
| Mutants M1 to M6 fail as stated | Section 5 | Planned | |
| `docs/content-bundle.md` updated | Section 3.2 | Planned | |
| Full API suite and Public API suite green in Release | Section 5, commands 4 and 5 | Planned | |
| CI, Security and Workflow lint green on the PR head | README; ADM-12d precedent | Planned | |
| ADM-12 (Blocker) closed for the importer path | `admin-audit-2026-10-28.md:202-208`; `refinement-plan-2026-10-28.md:225` | Planned | |

## 12. Revision log

- **Round 1 (2026-11-19):** first plan. There are no review, approval or implementation
  files in `docs/changes/ADM-12e/` to answer.
- **Round 1, owner update (2026-11-19):** the owner answered O-1 with "A: refuse both".
  The answer is quoted in section 9 with its date and where it was given. The "BLOCKED ON
  OWNER" status at the top is removed. Section 3.4 now records options B and C as not
  chosen, and the G3 checklist's D-NNN line is no longer conditional. The design, scope,
  tests, mutants and the `docs/content-bundle.md:186-187` text are unchanged, because
  they were already written for A.
