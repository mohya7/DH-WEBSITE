# ADM-05: plan

Change id: `ADM-05`. Branch: `change/ADM-05`, worktree `/home/user/dh-change-adm05`,
cut from `origin/rebuild/dotnet-platform` at `32f0414` (ADM-07 merged as #55).
Architect, round 2, 12 November 2026. Round 1 (`76bf41f`) came back CHANGES NEEDED
(`plan-review.md` Round 1 at `676e068`: one Major, eight Minors). Section 12 answers
each one. The main change is the order of work: ADM-10 merges first, and this
change's `AdminStore.cs` and `AdminControllers.cs` commit is written only after
`change/ADM-05` has merged a base that contains ADM-10 (4.1). Every line number
below is at `32f0414`.

**One change: the 404 and 500 pages go through the same draft and publish flow as
every other page, and their screen can publish them.** It closes ADM-05. It also
takes the library check on the error-page save that ADM-03 handed over
(`docs/changes/ADM-03/implementation.md` section 11), and the error-page saves that
ADM-02 left to ADM-05 (`docs/changes/ADM-02/plan.md` section 4, line 675).

## 1. Item

- **Closes:** ADM-05 (Blocker). Quoted from
  `/mnt/attach/project-files/docs/quality/admin-audit-2026-10-28.md`, lines 118-131:
  > **ADM-05: the 404 and 500 pages cannot be published from their screen, and the
  > website build needs them published.**
  > - `ErrorPagesPage.tsx` has Save only.
  > - `website/src/content/prepare.ts:44-47` fails an API build until both pages are
  >   published, and both are drafts today.
  > - Publishing through Pages is blocked by the meta-description rule on these noindex
  >   pages.
  > - The screen writes straight onto the page record (`AdminStore.cs:549-598`). On a
  >   published page, a Save would go live at the next build without Publish. This is
  >   from reading the code, not run.
  > - Fix:
  >   - Route saves through the draft and publish flow.
  >   - Add Publish and state to the screen.
  >   - Decision O-16 on the meta-description rule for noindex pages.
- **Requirement:** FR-S-21 in the audit's table (line 46): "FR-S-21 404 and 500 pages |
  Partly | Cannot be published from their screen (ADM-05)". Business analysis line
  321: "FR-S-21 | Edit the content of the 404 and 500 pages".
- **Inherited, from ADM-03** (`docs/changes/ADM-03/implementation.md`, section 11,
  "For ADM-05"), quoted:
  > The error-page save, `AdminStore.UpdateErrorPageAsync` (`AdminStore.cs:549-599`),
  > does not check that a rich-text image's media id is in the library, as
  > `ContentStore.cs:752-753` does for pages and items. ADM-05 routes that save
  > through the draft and publish flow, so the check belongs there.
  At `32f0414` the method is at `AdminStore.cs:591-641` and the library check at
  `ContentStore.cs:765`.
- **Inherited, from ADM-02** (`docs/changes/ADM-02/plan.md`):
  - Line 675: "**Error-page saves** (`AdminStore.UpdateErrorPageAsync`, 549-598):
    ADM-05. They hold rich text only."
  - Line 66: "Error pages are ADM-05." (the success measure "Website builds from
    Studio content that need patching first").
  - Line 880 and ADM-07 `plan.md` line 702: the G3-1 exit gate "Not met by this
    change alone. It needs ... ADM-05 (error pages, `prepare.ts:44-47`)".
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. The refinement
  plan's G3 table (`refinement-plan-2026-10-28.md` line 225) lists "ADM-05 error
  pages". The batch order is "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a". ADM-06, 03,
  02 and 07 have merged. ADM-10 has passed gate 2 (`change/ADM-10` at `04d0e80`,
  `delivery-approval.md`: `Verdict: APPROVED`) and is not merged yet (2.9).
- **"Done when":**
  - The G3-1 exit gate (refinement plan, Track G3, line 225): "A clean website build
    from `DigitalHubContent_Studio` with no patched content; each blocker reproduced
    before its fix and passing after it".
  - The G3 track (line 17): "All six blockers fixed by 16 November".
  - The G3 rule (line 221): "Every fix carries a regression test that fails first."
  - The success measure (line 250): "Website builds from Studio content that need
    patching first | Every build (error pages, redirects, schema formats) | 0 |
    16 Nov".
  - The G3 checklist (`docs/changes/README.md`): "The regression test is committed and
    shown failing before the fix. The end-to-end suite gets a test for each Major."
- **Design this must keep:**
  - `CLAUDE.md`, Settled design: "Save is not publish."
  - `docs/phase-b-studio.md` 3.4 (line 113): "Editing a published item edits a draft
    copy; the live content does not change until the next publish."
  - `docs/phase-b-studio.md` line 124: "Every save of a working copy validates its
    sections against their schemas, the same as a live write."
  - `docs/phase-b-studio.md` line 156: "Meta description is required only for an item
    with its own page ... A media id that is not in the library blocks publish."
  - `docs/phase-b-studio.md` 8.7 (line 260): "Error pages: create editable 404 and 500
    pages."

### Required reading, and what is missing

| File | State |
| --- | --- |
| `CLAUDE.md`, `AGENTS.md` | Read. Identical (`diff AGENTS.md CLAUDE.md`, exit 0) |
| `docs/changes/README.md` | Read |
| `ENGINEERING_STANDARDS.md` | **Missing** in the worktree (`ls`: "No such file or directory") and not in `/mnt/attach/project-files`. Not guessed. Rule ids (P-6, P-7, P-8, B-6, B-8) are used only as `docs/changes/README.md` and the ADM-02, ADM-07 and ADM-10 records use them |
| `docs/PROJECT_PROFILE.md` | **Missing.** Not guessed |
| `docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md` | Not in the worktree (`docs/quality` does not exist). Read from `/mnt/attach/project-files/docs/quality/`, as the coordinator directed |
| `docs/adr/0001-split-public-forms-api.md` | Not needed (G3). `docs/adr/` is not in the worktree |
| `docs/deferred-items.md` | **Missing.** Not needed: nothing here becomes a D-NNN entry |
| `docs/changes/ADM-03/implementation.md` | Read: sections 3, 7, 11 |
| `docs/changes/ADM-02/plan.md`, `plan-approval.md` | Read: sections 1, 3.3, 4, 5.5, 9, coverage |
| `docs/changes/ADM-07/plan.md`, `/home/user/dh-change-adm10/docs/changes/ADM-10/plan.md` | Read for format and for the red-test push pattern |
| `docs/phase-b-studio.md`, `docs/business-analysis.md` | Read for the rules quoted above |
| `/mnt/attach/project-files/uploads/hearth/179f322b-...` (chat export, 1 November) | Read for O-16 only (section 9) |

There is no `plan-review.md`, `plan-approval.md` or `implementation.md` in
`docs/changes/ADM-05/`: this is round 1.

## 2. Current state

### 2.1 The base

```
$ git log --oneline -3
32f0414 ADM-07: Flag redirects with no page and make redirect creates safe under load (#55)
6262f48 ADM-02: Keep API-accepted content passing the website's checks (#54)
b9c5f6f ADM-03: Keep images and typed text in rich-text fields (#52)
$ git status
On branch change/ADM-05
Your branch is up to date with 'origin/rebuild/dotnet-platform'.
nothing to commit, working tree clean
$ git ls-remote origin refs/heads/rebuild/dotnet-platform
32f0414ef3bf1139bc5022d88e33e27075f125b4	refs/heads/rebuild/dotnet-platform
```

The audit's `AdminStore.cs:549-598` moved to 591-641 with ADM-02 and ADM-07
(`git log --oneline -- api/src/DigitalHub.Api/Content/AdminStore.cs`: `32f0414`,
`6262f48`, `6470fac`, ...).

### 2.2 The screen has Save only

`studio/src/pages/ErrorPagesPage.tsx` (80 lines):

- Type `ErrorPage` (7-13) is `type, id, title, body, version`. No status.
- `load()` (23-31) reads `GET /api/v1/error-pages`.
- `save()` (33-46) sends `PUT /api/v1/error-pages/{type}` with `version, title, body`
  and shows "`404 page saved.`".
- Line 70: `<Button type="primary" onClick={() => void save(page)}>Save</Button>`.
  There is no Publish button, no status chip and no list of publish problems.
- Line 68 hosts the `RichTextEditor` (`fieldPath={`error-${page.type}.body`}`). It is
  one of the two hosts ADM-03's invariant names: it passes a value from the API or
  from the editor's own `onChange`.

The Studio sidebar shows the screen to admins and editors
(`studio/src/shell/areas.ts:24`, and `areasForRole`, HR sees only Applications and
Vacancies).

### 2.3 The API writes onto the record, whatever its status

`ErrorPagesController` (`AdminControllers.cs:148-165`, `[Authorize(Policy =
"studio")]`, `[Route("api/v1/error-pages")]`): `GET` calls
`AdminStore.ListErrorPagesAsync` (573-589), `PUT {type}` calls
`AdminStore.UpdateErrorPageAsync` (591-641).

`UpdateErrorPageAsync`:

- Checks the type, the version and the title, and runs `RichText.Validate` on the
  body (593-602).
- Loads `db.Pages` by slug `error-<type>` with its sections, **tracked** (605).
- Picks the first `rich_text` section, or else the first section, or makes one
  (611-626).
- Writes straight onto the record and its section row (628-635):
  ```csharp
  page.Title = request.Title.Trim();
  page.UpdatedAt = DateTime.UtcNow;
  page.Version += 1;
  section.Type = SectionTypes.RichText;
  section.Fields = JsonSerializer.Serialize(new
  {
      heading = page.Title,
      body = request.Body ?? EmptyDoc,
  }, ContentJson.Options);
  ```
- Never looks at `page.Status` and never touches `db.WorkingCopies`.
- Replaces the whole section `Fields`, so an `eyebrow` or `blocks` value set on that
  section through Pages (both allowed by `packages/sections/rich_text.json`) is lost.
- Audits `("update_error_page", "error_page", type, page.Title)` (638).

`ListErrorPagesAsync` reads the record's sections only (578-585). It never reads a
working copy, and its answer (`PresentErrorPage`, 1022-1053) has no status.

### 2.4 Why a Save on a published page goes live (reading the code; not run)

- `BuildContentStore.LoadAsync` (`BuildContentStore.cs:172-177`) reads rows with
  `Status == Published`, from the record and its section rows: "Status on the record
  itself: a working copy is a draft and is not read here."
- `BuildAsync` (73-80) hands `error-404` and `error-500` to the build from those rows
  as `errorPages`.
- So a `PUT /api/v1/error-pages/404` on a published `error-404` changes what
  `GET /api/v1/build/content` returns at once. The next build ships it, with no
  Publish. That breaks `phase-b-studio.md` 3.4 and "Save is not publish".
- Compare `ContentStore.MutateAsync` (612-662), used by every Pages save: for a
  published record (640) it writes the draft into a `WorkingCopy` and leaves the
  record alone. For a draft record it writes the record.

No database is reachable here (no SQL Server, no `dotnet`), so this is not run. T1
(5.1) is the reproduction, and it runs in CI job `api`.

### 2.5 The website build refuses unpublished error pages

`website/src/content/prepare.ts:44-48`:

```ts
if (config.source === "api") {
  for (const code of ["404", "500"] as const) {
    if (!content.errorPages?.[code]?.publishedAt) problems.push(`Error page ${code} must be published before an API build. Publish error-${code} in the Studio.`);
  }
}
```

`BuildContentStore` puts `null` for an unpublished error page (line 78), so an API
build stops until both pages are published. The importer creates both as drafts
(`api/tools/DigitalHub.ContentImport/ContentWriter.cs:301-322`, `Status =
ContentStatus.Draft`, `NoIndex = true`). The audit says both are drafts in
`DigitalHubContent_Studio`. I cannot check that database from here (2.10).

### 2.6 Publishing through Pages is blocked by the meta-description rule

The error pages are ordinary page records, so they appear in the Pages list and open
in `ItemEditorPage`, which has Publish (`ItemEditorPage.tsx:184-197`, 278). Publish
runs `ContentStore.PublishAsync` (300-354), then `PublishChecks.AddAsync`:

```csharp
// PublishChecks.cs:28-29
if (ContentPaths.PublicPath(collection, draft.Slug) is not null)
    AddDescription(draft, errors);
```

`ContentPaths.PublicPath("pages", "error-404")` is `"/error-404"` (the `_ => "/" +
slug` arm, `ContentPaths.cs:13`). So publish needs a meta description
(`PublishChecks.cs:53-57`: "Add a meta description. It falls back to the summary when
the item has one."). The imported pages have none. But the build never serves
`/error-404`: it renders the pages at `/404` and `/500` (`BuildContentStore.cs:35-42`,
`website/src/app/not-found.tsx`, `website/src/app/500/page.tsx`), and
`PublishChecks.cs:113-114` already says "the site serves them at /404 and /500 rather
than at an address of their own". `phase-b-studio.md` line 156 requires the
description "only for an item with its own page".

The website does not need one. `documentDescription` (`website/src/seo/head.ts:34-37`)
returns `undefined` for an empty description, and nothing in
`website/src/content/validate.ts` or `website/scripts/check-output.ts` requires it
(`grep -i description` on both: no match in `validate.ts`; `check-output.ts` checks
the error pages' JSON-LD, not a description).

### 2.7 The error-page save has no library check (ADM-03, section 11)

`UpdateErrorPageAsync` runs `RichText.Validate` only. `ContentStore.CheckAsync`
(691-770) has the check pages and items get:

```csharp
// ContentStore.cs:757-765
var referenced = MediaUsage.ReferencedIds(JsonSerializer.Serialize(draft, ContentJson.Options));
...
    Add(errors, "media", mediaId + " is not in the library.");
```

`MediaUsage.Walk` parses JSON held in strings (`MediaUsage.cs:148-153`), so a
`mediaId` inside a section's `body` string is found. `MediaUsage.FindPlacesAsync`
already counts working copies (65-91), so a library delete is refused while a draft
uses the image.

### 2.8 Tests that touch the error pages today

- `AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them`
  (`AdminApiTests.cs:540-588`): removes every `error-*` page, checks `GET` does not
  create them, seeds two drafts (`SeedErrorPages`, 718-750), and `PUT`s 404. It
  asserts 200 and the new title and body.
- `BuildContentTests.An_error_page_is_not_a_reference_target` (175) and its helper
  `PublishedErrorPageAsync` (417-460): seeds or publishes `error-404` directly.
- `ContentPublishTests` (925-983, helper `ErrorPageAsync` 1062-1095).
- `RedirectTargetRuleTests.cs:27` (K2): `RedirectTargets.ErrorPageKeys` is `404`,
  `500`.
- All are `[Collection("SqlServer")]`, so they run one after another. They do **not**
  all put the error pages back as they found them (round 1, finding 8):
  - `AdminApiTests.Error_pages_are_editable...` deletes every `error-*` page and
    leaves its own seeded drafts behind, with new ids.
  - `ContentPublishTests.ErrorPageAsync` keeps an existing page as it is, and removes
    only a page it created.
  - Only `BuildContentTests.PublishedErrorPageAsync` restores the status it changed.
  So a new test cannot assume any starting state. The helper in 5.1 copes with any
  of them: none, drafts, or published pages.
- No Studio unit test covers `ErrorPagesPage`. No end-to-end spec opens it except
  `verification.spec.ts` P2.12 ("Every sidebar screen loads with no console error"),
  on an empty list: the end-to-end database is reset empty (`studio/e2e/start-api.ts`
  lines 20-53), so it has no error pages.

### 2.9 Other branches that touch the same files

- `change/ADM-10` (`04d0e80`, gate 2 approved, not merged; it waits only on the
  owner's merge confirmation, as the coordinator relayed) changes `AdminStore.cs`
  (`git diff 32f0414 04d0e80 -- api/src/DigitalHub.Api/Content/AdminStore.cs`: hunks
  `@@ -242`, `@@ -281`, `@@ -823`, `@@ -1165`). This change also edits
  `AdminStore.cs`.
- ADM-04 (users) is next in the batch. By the audit's text (lines 105-116) it changes
  `UsersController` in `AdminControllers.cs` (74-100) and its store in
  `AdminStore.cs`. This change edits `ErrorPagesController` in `AdminControllers.cs`
  and `AdminStore.cs`.
- `AGENTS.md`: "Parallel work must change different files." The rule is about files,
  not lines (round 1, finding 1). Two changes that edit `AdminStore.cs` or
  `AdminControllers.cs` therefore may not be in progress on those files at the same
  time. The order that keeps to the rule is in 4.1. It is the integrator's order, as
  the coordinator stated it.
- For each `change/*` head in `git ls-remote`, I ran `git diff --name-only
  $(git merge-base <head> 32f0414) <head>` over this change's five source files
  (`AdminStore.cs`, `AdminControllers.cs`, `ContentStore.cs`, `PublishChecks.cs`,
  `ErrorPagesPage.tsx`). The result:
  - `change/ADM-10`: `AdminStore.cs`.
  - `change/ADM-02` and `change/ADM-07`: `AdminStore.cs` and `ContentStore.cs`. Both
    are already in the base, as #54 (`6262f48`) and #55 (`32f0414`).
  - Every other head: none of the five files.
  So outside ADM-10, and ADM-04 once it starts, no in-flight change shares a file
  with this one.

### 2.10 What I could run here

- `git log`, `git show`, `git ls-remote`, `ls`, `grep`: as quoted.
- **Not runnable:** no `dotnet` on `PATH`, no SQL Server, no `node_modules` in
  `website/` or `studio/` (`ls`: "No such file or directory"). I did not run any
  suite, build or audit, and I did not read any database. The claim in 2.4 is from
  the code. The claim "both are drafts today" in `DigitalHubContent_Studio` is the
  audit's. I could not verify it.
- `gh pr list` is refused here (GraphQL 403), so I listed branches with
  `git ls-remote` instead.

## 3. Design

### 3.1 API: the error-page save becomes a page save

The two error-page methods move from `AdminStore` into `ContentStore`, where the
draft flow lives. They keep their route and request shape, so the Studio contract
stays the same, except that the answer gets new fields.

**`ContentStore.SaveErrorPageAsync(string type, ErrorPageUpdate request, string?
userId, CancellationToken)`** (new, public):

1. The same input checks as today, with the same keys and messages: type `404` or
   `500` ("Type must be 404 or 500."), `Version >= 1` ("Version is required."), title
   not blank ("Title is required."), and `RichText.Validate(request.Body)` under key
   `body`. They run first, so a bad body still answers on `body`, as today.
2. Find the page id by slug, through `BuildContentStore.ErrorSlugs` (`internal`, same
   assembly), with `AsNoTracking`. No page gives 404 "That error page does not
   exist.", as today. **`GET` and `PUT` never create a page**, as today.
3. Call the existing private `MutateAsync("pages", id, request.Version, userId,
   "update_error_page", change, ...)`. The `change` edits the draft document:
   - `draft.Title = request.Title.Trim()`.
   - The section is picked by today's rule, applied to `draft.Sections` in
     `SortOrder` order: the first `rich_text`, or else the first, or else a new
     `DraftSection { Id = Guid.NewGuid(), Type = "rich_text", Visible = true,
     SortOrder = 0 }`. `SortOrder = 0` is today's value (`AdminStore.cs:617-623`),
     kept (round 1, finding 5).
   - If the picked section is already `rich_text`, its fields are kept, and only
     `heading` (the title) and `body` (`request.Body ?? EmptyDoc`) are set.
     `EmptyDoc` (`AdminStore.cs:1103`) is used only by the error-page code
     (`grep -n EmptyDoc api/src/DigitalHub.Api/Content/*.cs`: lines 635, 1024-1042,
     1103 of `AdminStore.cs`). It moves to `ContentStore` as a private constant with
     the same text, and is removed from `AdminStore` (round 1, finding 9). An
     `eyebrow` or `blocks` value stays (found here, 2.3).
   - If it is another type, it becomes `rich_text` with `{ heading, body }` only, as
     today. That type's fields do not fit `rich_text.json`
     (`additionalProperties: false`), so they cannot be kept.
4. `MutateAsync` then does what every page save does:
   - It checks the version (409 `concurrency_conflict` when stale).
   - It runs `CheckAsync(..., publishing: false)`. That covers the draft schema
     check of the section, `RichText.Validate` on the section's rich text, the slug
     and redirect-source checks, and **the library check** (ADM-03's handover).
   - **A published page:** the draft goes into its `WorkingCopy`, and the record and
     its section rows stay as they are, so the build does not see the save.
   - **A draft page:** the record and its sections are written, as now. A draft is
     not in the build either way.
   - It raises the version, audits, and commits.
5. **The answer (round 1, finding 3).** `MutateAsync` returns the Pages shape
   (`Present(collection, loaded, draft)`), and its `loaded` does not leave the method.
   So `SaveErrorPageAsync` does not use that body:
   - If the outcome is not a success, it is returned as it is (400, 404 or 409).
   - On success, `SaveErrorPageAsync` calls `LoadAsync("pages", id)` again and builds
     the error-page shape (3.2) from it, with `DocumentOf` for the title and body.
     That gives the committed `status`, `state`, `hasWorkingCopy`, `publishedAt` and
     the new `version`.
   - `MutateAsync` and every other existing method stay unchanged. "No change to any
     existing method" (Scope) holds.
   - If the page is deleted between the commit and the reload, the answer is 404
     "That error page does not exist.". The save itself has already been committed,
     and the page it was saved to is gone. That needs an admin to delete the draft
     page through Pages in the same few milliseconds. A published page cannot be
     deleted (`DeleteAsync`, `ContentStore.cs:244-245`).

**Titles of the refusals (round 1, finding 5).** `MutateAsync`'s 409 title is "This
item was changed by someone else." (`Conflict()`, `ContentStore.cs:1218-1219`).
Today's is "Someone else changed this page." (`AdminStore.cs:610`). Its 404 is "That
item does not exist." when the page goes between the slug lookup and `LoadAsync`.
These titles are **not** remapped. The Studio shows its own text on 409
(`ErrorPagesPage.tsx:40`), so the screen does not change. The API answer does, and B9
lists it.

**`ContentStore.ListErrorPagesAsync(CancellationToken)`** (new, public): for each
type, find the page by slug and, if it exists, `LoadAsync("pages", id)` and
`DocumentOf` (the working copy when there is one, else the record). It answers
`{ items: [...] }` in the 3.2 shape. A missing page is skipped, as today.

**`ErrorPagesController`** takes `ContentStore` in place of `AdminStore`. The routes,
the `studio` policy and the `ErrorPageUpdate` body are unchanged.

**`AdminStore`** loses `ErrorTypes` (18), `ListErrorPagesAsync` (573-589),
`UpdateErrorPageAsync` (591-641), `PresentErrorPage` (1022-1053) and `EmptyDoc`
(1103), which have no other caller (`grep -rn "ErrorTypes\|PresentErrorPage\|UpdateErrorPageAsync\|ListErrorPagesAsync" api`).
`ErrorPageUpdate` (1190-1197) stays in `AdminStore.cs`, unchanged (2.9).

### 3.2 The answer of `GET` and `PUT /api/v1/error-pages`

Today's fields keep their names and meanings: `type`, `id`, `title`, `body`,
`version`. `title` and `body` now come from the draft: the working copy when there
is one. New fields, taken from `ContentStore.Present` (1022-1051) so they mean the
same thing as on Pages:

- `status`: `draft` or `published` (the record's).
- `state`: `draft`, `published` or `changed` (`StateOf`, published with a working
  copy).
- `hasWorkingCopy`.
- `publishedAt`.
- `notice`: "Published changes appear on the website at the next build." for a
  published page, else `null`.

The body is read with today's `PresentErrorPage` logic (string or object `body`, else
the empty document), moved with it.

### 3.3 Publish: the existing page route

The screen publishes with **`POST /api/v1/pages/{id}/publish`** and `{ version }`,
the route Pages uses (`ContentController.cs:59-61`, `[StudioAccess]`: admin and
editor). No new route. Publish then runs every check it runs for any page
(`PublishAsync` 300-354, `PublishChecks.AddAsync`): schema formats, images and alt
text, links and references, the library check. It copies the working copy onto the
record, writes a revision and audits `publish`. The response is the Pages shape. The
screen reloads its list afterwards, so it does not have to map that shape.

### 3.4 The meta-description rule for the error pages (O-ADM05-1, which is O-16)

The code here waits on the owner's answer.

- **(a) Recommended: the two error pages need no meta description.**
  `PublishChecks.AddAsync` (28-29) skips `AddDescription` when `collection ==
  "pages"` and the slug is one of `BuildContentStore.ErrorSlugs`' values. Every other
  page, `noIndex` or not, keeps the rule. This matches `phase-b-studio.md` line 156
  ("only for an item with its own page"). The error pages have no address of their
  own (2.6). The rest of `PublishChecks` (images, links, references) still applies.
- **(b) Every `noIndex` item needs no meta description.** The same line, with
  `!draft.NoIndex` added. It is wider. A page hidden from search engines can still
  be shared, and its share preview would have no description.
- **(c) No exemption.** The rule stays. The error-pages screen gets a "Meta
  description" field: `ErrorPageUpdate` gains `MetaDescription` (optional, at most
  500 characters, by `ContentFields.Validate`), the save sets
  `draft.MetaDescription`, and the answer carries `metaDescription`. A body without
  the key leaves the stored value as it is, so an older client cannot clear it (the
  ADM-10 defect). The Studio always sends it. Staff then type a description that no
  search engine shows. T12 and S8 test it.

Whatever the answer, it is one fix commit (5.2, commit 5, with test commit 5a before
it under a late (c)). Until the owner answers, the developer builds commits 1 to 4,
in the 4.1 order, and does not write commit 5. Without
commit 5 the screen's Publish shows the `metaDescription` error, so ADM-05 is not
done.

### 3.5 Studio: state, Publish and publish problems on the screen

`ErrorPagesPage.tsx`:

- The `ErrorPage` type gets `status`, `state`, `hasWorkingCopy`, `publishedAt`, and
  `metaDescription` only if (c).
- Each card shows `<StatusChip state={page.state} />` (`studio/src/ui/StatusChip.tsx`,
  as `ItemEditorPage.tsx:271` does) beside its title.
- A per-card `dirty` flag is set by `patch` and cleared by a successful save or load.
- **Save** keeps its request. Its message:
  - draft page: "`404 page saved.`" (unchanged);
  - published page: "`404 page saved as a draft. Publish to put it on the website.`"
- **Publish** (new, default button style, after Save):
  - It is disabled while the card is dirty, with the line "Save before publishing,
    so the check runs on what is on screen." (`ItemEditorPage.tsx:278`, 287).
  - It sends `POST /api/v1/pages/${page.id}/publish` with `{ version: page.version }`.
  - **200:** reload the list. Message "`404 page published. Changes appear on the
    website at the next build.`" If the answer has `warnings`, they are listed.
  - **409:** "Someone else changed this page." (today's wording).
  - **400 `publish_blocked`:** the card lists `problem.title` and each
    `key: messages` from `problem.errors` and `problem.warnings`, as `Findings` does
    (`ItemEditorPage.tsx:483-505`). It is a plain list, with no jump links, because
    this screen has no section form to jump to.
- **A refused Save (round 1, finding 4).** The save can now be refused for reasons
  the screen never saw before (B3, B4). They all come back as 400
  `validation_failed`, titled "One or more fields are invalid." (`ContentStore.cs`,
  `Validation`). So a 400 on Save fills the same per-card list as a blocked publish:
  `problem.title`, then each `key: messages` from `problem.errors`. The card stays
  dirty, and nothing is reloaded. A 409 keeps today's text. Any other failure keeps
  today's `problem.title` line. A successful Save or Publish clears the list. S7
  tests it. Mapping each key (for example `sections[0].body`) to its field on screen
  is left to ADM-14, by name. Its fix (audit line 236) is "field errors mapped to
  fields".
- A published page with no draft shows the notice from the API.
- **Not added:** Unpublish (it would break the next API build, `prepare.ts:46`),
  Discard draft (Pages has it, and ADM-14 is the finding about its missing
  confirmation), revisions, preview.
- The `RichTextEditor` still gets `value` from the API or from its own `onChange`,
  so ADM-03's invariant (`RichTextEditor.tsx`, the comment by `knownMediaIds`)
  holds.

### 3.6 Alternatives rejected

| Alternative | Why not |
| --- | --- |
| The screen uses `GET /api/v1/pages/{id}` and `PUT /api/v1/pages/{id}/save` directly, and the error-pages routes go | The Studio would have to send every section and every SEO field back unchanged. A field it forgot would be cleared, which is ADM-10's defect. The server-side change edits only the title and the body |
| Keep `AdminStore.UpdateErrorPageAsync`, and add a status check plus its own working-copy write | A second copy of `MutateAsync`. It would drift from the page save, as the missing library check (ADM-03) already has |
| Inject `ContentStore` into `AdminStore` | `AdminStore` would depend on `ContentStore` for two methods. The controller can take `ContentStore` itself |
| A new `POST /api/v1/error-pages/{type}/publish` | A new route and a second publish entry point. The page route already has the same roles (`StudioAccess` admin and editor, `studio` policy admin and editor) and the same checks |
| Make the `/error-404` path `null` in `ContentPaths.PublicPath` | It also changes slug checks, redirect checks and `RetargetAsync` for these pages. That is wider than the rule O-16 is about |
| Add Unpublish and Discard draft to the screen | Out of scope (3.5). Pages has both, and the audit's fix asks for Publish and state |
| A website change to accept unpublished error pages | `prepare.ts:44-48` is the guard that keeps a draft 404 off the live site. It stays (P-6) |

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `api/tests/DigitalHub.Api.Tests/ErrorPagePublishTests.cs` | T1 to T11, and T12 if O-ADM05-1 is (c) (5.1) |
| `studio/test/errorPages.test.tsx` | S1 to S7, and S8 if (c) (5.1) |
| `studio/e2e/error-pages.spec.ts` | E1 (5.1) |
| `docs/changes/ADM-05/implementation.md` | The developer's record |

### Files to change

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | New public `ListErrorPagesAsync`, `SaveErrorPageAsync`. New private `PresentErrorPage` and `EmptyDoc` (moved, 3.1, 3.2). Uses the existing `MutateAsync`, `LoadAsync`, `DocumentOf`, `StateOf`. No change to any existing method |
| `api/src/DigitalHub.Api/Controllers/AdminControllers.cs` | `ErrorPagesController` (148-165) takes `ContentStore`. Routes and policy unchanged |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | Remove `ErrorTypes`, `ListErrorPagesAsync`, `UpdateErrorPageAsync`, `PresentErrorPage`, `EmptyDoc`. `ErrorPageUpdate` unchanged (with `MetaDescription` added only if O-ADM05-1 is (c)) |
| `api/src/DigitalHub.Api/Content/PublishChecks.cs` | Lines 28-29 only, per O-ADM05-1 (a) or (b). Not changed if (c) |
| `studio/src/pages/ErrorPagesPage.tsx` | 3.5 |

### 4.1 Order of work on the shared files (round 1, finding 1)

`AdminStore.cs` and `AdminControllers.cs` are shared with ADM-10 and ADM-04 (2.9).
`AGENTS.md`: "Parallel work must change different files." The order is the
integrator's, as the coordinator stated it on 12 November 2026:

1. **ADM-10 merges first.** It waits only on the owner's merge confirmation.
2. **Commits 1 and 2 (tests only)** may be written, and pushed for the CI red if
   O-ADM05-2 is "Yes", on `change/ADM-05` at `32f0414` before that. Neither touches
   `AdminStore.cs` or `AdminControllers.cs`. T1 to T11 compile against the base API.
3. **Before commit 3**, the developer merges `origin/rebuild/dotnet-platform`, which
   must then contain ADM-10, into `change/ADM-05`. It is a merge commit, never a
   rebase, so the commits already pushed for the CI red keep their ids. The
   developer quotes `git log --oneline -3 origin/rebuild/dotnet-platform`, showing
   the ADM-10 merge, and `git merge-base --is-ancestor <that merge> HEAD` (exit 0)
   in `implementation.md`.
4. **Commit 3** (`ContentStore.cs`, `AdminControllers.cs`, `AdminStore.cs`) and
   **commit 5** (which touches `AdminStore.cs` only under (c)) are written only
   after step 3. Commits 4 and 6 follow, in the 5.2 order. ADM-10 adds 32 lines to
   `AdminStore.cs` and removes 4 (`git diff --stat 32f0414 04d0e80`), so this
   plan's `AdminStore.cs` line numbers will have moved. The developer finds the
   members by name.
5. If ADM-10 has not merged when commits 1 and 2 are done, the developer stops
   there, records it, and tells the coordinator. The developer does not write
   commit 3 on the old base, and does not copy ADM-10's change in.
6. **ADM-04 does not start work on `AdminStore.cs` or `AdminControllers.cs` until
   ADM-05 has merged.** That is for the coordinator to hold. It is stated here so
   ADM-04's plan can cite it.

After the merge in step 3, and before commit 3, the developer runs every suite in
5.3 again. The reds must be the same as at commit 1 (5.4), and nothing else may
fail. Any difference is recorded and reported before going on.

### Out of scope (left alone on purpose)

- **`website/`**: no file changes. `prepare.ts:44-48` stays as the guard.
- **Publishing the two pages in `DigitalHubContent_Studio`**: that is an action on
  the owner's database after the merge (O-ADM05-3), not code.
- **Renaming an error page's slug through Pages.** Nothing stops a Pages save from
  changing `error-404` to another slug, and then the screen and the build lose the
  page. Found here, not in the audit. Not fixed. I recommend it is added to the
  audit as a new finding (Risks).
- **Changing `noIndex` on an error page through Pages.** The website follows it
  (`head.ts:107`). Not in the audit. Left alone.
- **`ContentStore.CheckAsync`'s redirect-source check on `/error-404`.** It now
  applies to the error-page save as it does to Pages (B4). Not changed.
- **`ContentImport` (`ContentWriter.cs:294-322`)**: still imports both pages as
  drafts. Unchanged.
- **Discard confirmation (ADM-14), build status (ADM-01a), preview (ADM-18).**
- **`ItemEditorPage.tsx`, `RichTextEditor.tsx`, `StatusChip.tsx`**: not changed.
- **No migration** (section 7).

## 5. Test plan

### 5.1 Failing tests, written first

**API, `api/tests/DigitalHub.Api.Tests/ErrorPagePublishTests.cs`**,
`[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`, sign-in and `SendAsync`
helpers as in `ContentPublishTests.cs:11-60`.

- **Set-up and clean-up:** each test calls a helper `ErrorPagesAsync(status)`. It
  saves any existing `error-*` pages, sections and working copies, removes them, and
  seeds both pages as `AdminApiTests.SeedErrorPages` does (718-750), with the given
  status, `NoIndex = true`, no meta description, and a `rich_text` section `{
  heading, body: "Body A" }`. A `finally` puts the saved rows back. It also deletes
  what the test made: working copies, revisions and media rows. It runs after a
  failed assertion too. The helper accepts any starting state (2.8).
- **Audit rows stay (round 1, finding 2).** The application login cannot delete from
  `audit_log` (`AuditLogPermissionTests.cs:46-48`), so the `finally` does not try.
  This is what `ListPagingTests.cs:176` does: "The audit rows stay: the app login
  cannot delete from audit_log." The elevated account
  (`ApiFactory.ElevatedTestConnectionString()`, as `ContentApiTests.cs:597-603`) is
  not used. Leftover rows are harmless: T7 finds its own row by user, entity id and
  a time after the test started, not by "the newest row".
- **Build content:** read with the build token, as `BuildContentTests.ReadBuildAsync`
  (267-276).

| Id | Name | Asserts | Red at base because |
| --- | --- | --- | --- |
| T1 | `A_save_on_a_published_error_page_does_not_reach_the_build` | Both published with "Body A". `PUT /api/v1/error-pages/404` with "Body B" gives 200. `GET /api/v1/build/content`: `errorPages.404.sections[0].fields.body` contains "Body A", not "Body B". The `pages` row's section `Fields` still has "Body A". One `WorkingCopy` with `PageId` = the 404 id exists | The save writes the record, so the build shows "Body B" (2.4). This is the audit's "from reading the code, not run" claim, reproduced |
| T2 | `The_list_shows_the_draft_and_its_state` | Its own set-up (both published, "Body A") and its own save of "Body B" to 404, as in T1 (xUnit tests share no state). Then `GET /api/v1/error-pages`, item 404 has `body` with "Body B", `state` "changed", `status` "published", `hasWorkingCopy` true, `publishedAt` not null. Item 500 has `state` "published" | No `state` property (`GetProperty` throws) |
| T3 | `An_editor_publishes_a_saved_error_page_draft` | Draft pages. An **editor** saves "Body B", then `POST /api/v1/pages/{id}/publish` with the new version gives 200 and `state` "published". The build content `errorPages.404.publishedAt` is not null and its body has "Body B". `GET /api/v1/error-pages` shows `state` "published" and `hasWorkingCopy` false | 400 `publish_blocked`, `errors.metaDescription` (2.6). **(a) and (b).** If (c), the save also sends `metaDescription`, and the test asserts the same 200 |
| T4 | `A_published_error_page_goes_live_only_at_publish` | Published "Body A", save "Body B" (build still "Body A"), publish (200). Build now "Body B". No working copy left. One new `revisions` row for the page | Today the build already shows "Body B" after the save, and the publish is blocked |
| T5 | `An_error_page_save_refuses_an_image_not_in_the_library` | `PUT` with a body holding `{"type":"image","attrs":{"mediaId":"<new guid>","alt":"Diagram"}}`: 400 `validation_failed`, and `errors.media` contains "`<guid> is not in the library.`". The page is unchanged | 200: no library check (2.7, ADM-03 section 11) |
| T6 | `An_error_page_save_keeps_the_section_s_other_fields` | Seed the 404 section with `eyebrow: "Oops"`. After a save (draft page), the section's fields have `eyebrow` "Oops", the new `heading` and the new `body` | Fields are replaced with `{ heading, body }` (2.3) |
| T7 | `An_error_page_save_is_audited_as_a_page_save` | After a save, exactly one audit row with `EntityId` the page id and `At` after the test's start time exists, with `Action` "update_error_page" and `EntityType` "page" | Today `EntityType` "error_page", `EntityId` "404" (B5) |
| T8 | `An_ordinary_page_still_needs_a_meta_description` | A new page (`POST /api/v1/pages`, a stamped slug, no description; `noIndex: true` if (a), `noIndex: false` if (b)). Publish: 400, `errors.metaDescription`. Deleted in `finally` | Green at base. Guards the scope of the exemption. Kept in (c) |
| T9 | `A_save_on_a_draft_error_page_stays_out_of_the_build` | Draft pages: save gives 200, `state` "draft". Build content `errorPages.404` is `null` | Red only on the `state` assertion. Guards the draft path |
| T10 | `A_stale_version_is_a_conflict` | Save with `version + 3`: 409 `concurrency_conflict`. Nothing changes | Green at base. Guard |
| T11 | `HR_cannot_read_save_or_publish_error_pages` | An HR user gets 403 on `GET` and `PUT /api/v1/error-pages/404` and on `POST /api/v1/pages/{id}/publish` | Green at base. Guards the policies (section 6). The HR session helper follows the existing HR tests (`CareersTests.cs`) |
| T12 | `The_error_page_meta_description_is_saved_and_limited` (**only if O-ADM05-1 is (c)**) | Draft pages. `PUT /api/v1/error-pages/404` with `metaDescription: "Shown nowhere."` gives 200, and the answer and `GET /api/v1/error-pages` carry it. A `PUT` with 501 characters gives 400 `validation_failed`, with `errors.metaDescription` "is longer than 500 characters." (`ContentFields.Limit`, `ContentDocuments.cs:551-555`). A `PUT` with no `metaDescription` key leaves the stored value as it is (the ADM-10 lesson). The page is unchanged after the 400 | No `metaDescription` on `ErrorPageUpdate`: the value is ignored, so the first assertion fails |

`AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them` is **not
changed**. It must pass as it is, since it is the existing contract test.

**Studio, `studio/test/errorPages.test.tsx`** (vitest, jsdom). The harness is copied
from `studio/test/redirects.test.tsx:1-70`: `vi.stubEnv`, the `matchMedia` and
`ResizeObserver` stubs, the hoisted `api.handler` and `request` mock, hoisted
`message` spies, and `NoMotion`. It also keeps the file-level `afterEach` that
asserts `document.body.innerHTML` is empty (ADM-06b-flake). The `RichTextEditor` is
the real one. Every path the handler does not expect throws.

| Id | Name | Asserts | Red because |
| --- | --- | --- | --- |
| S1 | `shows each page's state` | List: 404 `state` "draft", 500 `state` "changed". The 404 card shows a chip "draft", the 500 card a chip "changed" | No chip |
| S2 | `publishes with the page's version and reloads` | Click Publish on 404: one `POST /api/v1/pages/p-404/publish` with body `{"version":3}`, then a second `GET /api/v1/error-pages`. The success spy is called with "404 page published. Changes appear on the website at the next build." | No Publish button |
| S3 | `will not publish unsaved edits` | Type in the 404 title: its Publish is disabled and the "Save before publishing" line shows. After a Save (200) Publish is enabled. The 500 card's Publish stays enabled throughout | No Publish button |
| S4 | `lists what blocks a publish` | Publish answers 400 `{ title: "Publishing is blocked until every check passes.", errors: { media: ["m-1 is not in the library."] } }`: the card shows the title and "media: m-1 is not in the library.". The list is not reloaded | No list |
| S5 | `says a save on a published page is a draft` | 404 `status` "published": Save (200) calls the spy with "404 page saved as a draft. Publish to put it on the website." | Today "404 page saved." |
| S6 | `a stale publish says someone else changed the page` | Publish answers 409: "Someone else changed this page." shows | No Publish button |
| S7 | `lists what blocks a save` | Save on 404 answers 400 `{ title: "One or more fields are invalid.", errors: { media: ["m-1 is not in the library."] } }`: the 404 card shows the title and "media: m-1 is not in the library.". No second `GET`. The card's Publish stays disabled (still dirty). A Save that then answers 200 clears the list | Today only the title line shows, and no list |
| S8 | `sends the meta description on save` (**only if O-ADM05-1 is (c)**) | The 404 card has a "Meta description" field showing the listed value. After typing "Shown nowhere.", Save sends one `PUT /api/v1/error-pages/404` whose body has `metaDescription: "Shown nowhere."` with `version`, `title` and `body` | No field |

**End-to-end, `studio/e2e/error-pages.spec.ts`** (E1). ADM-05 is a Blocker, not a
Major, but the G3-1 gate asks that each blocker be "reproduced before its fix and
passing after it", and the screen is what staff use. E1 follows
`studio/e2e/redirects.spec.ts`: API set-up with `adminHeaders`, a `finally` that
cleans up.

E1, `ADM-05 error pages: save is a draft, publish puts it live`:

1. **Set-up through the API.** The end-to-end database has no error pages (2.8), so
   E1 makes both:
   - `POST /api/v1/pages` with `{ slug: "error-404", title: "Page not found", noIndex:
     true }`, then `PUT /api/v1/pages/{id}/save` with one `rich_text` section `{
     heading, body: "E2E body A" }`. The same for `error-500`. If (c), also a
     `metaDescription`.
   - Publish both through `POST /api/v1/pages/{id}/publish`. **At base this step
     fails** (400 `metaDescription`) under (a) and (b). That is the red of bullet 3.
     It is asserted with a message naming the step.
2. Sign in as editor (`signIn(page, "editor")`), open "Error pages". The 404 card
   shows the chip "published". **At base it fails here under (c)**: no chip.
3. Change the 404 body to "E2E body B", click Save. The message says "saved as a
   draft", and the chip says "changed".
4. `GET /api/v1/pages/{id}` through the API: `live.sections[0].fields.body` has
   "E2E body A" and `content` has "E2E body B". The live page did not change.
5. Click Publish. The chip says "published". `GET /api/v1/pages/{id}`: `live` has "E2E
   body B" and `hasWorkingCopy` is false.
6. **`finally`:** unpublish and delete both pages through the API (`/unpublish`,
   then `DELETE` as admin). P2.12 and every later spec then see the empty list again.

### 5.2 Commit order

The split follows ADM-07 and ADM-10. CI job `studio` runs "Unit tests"
(`ci.yml:237`) before "End-to-end suite" (`ci.yml:271`). A red unit test in the
same commit would hide E1's red. So:

1. `ADM-05: Test that error-page saves are drafts and the screen can publish`:
   T1 to T11 and E1, plus T12 if O-ADM05-1 is already answered (c). No source
   change.
2. `ADM-05: Test the error pages screen's state and Publish`: S1 to S7, plus S8 if
   (c) is already the answer.
   - **(Merge, 4.1 step 3):** `origin/rebuild/dotnet-platform` with ADM-10, merged
     into `change/ADM-05`. Not a rebase.
3. `ADM-05: Save the error pages through the draft flow`: `ContentStore.cs`,
   `AdminControllers.cs`, `AdminStore.cs` (3.1, 3.2). Makes T1, T2, T5, T6, T7 and
   T9 green.
4. `ADM-05: Publish the error pages from their screen`: `ErrorPagesPage.tsx` (3.5).
   Makes S1 to S7 green.
5. `ADM-05: <the O-ADM05-1 answer>`: `PublishChecks.cs` for (a) or (b), or the meta
   description field for (c) (`AdminStore.cs` `ErrorPageUpdate`, `ContentStore.cs`,
   `ErrorPagesPage.tsx`). Makes T3, T4 and E1 green, and T12 and S8 under (c).
   **Not written until the owner answers.** If the answer is (c) and comes after
   commits 1 and 2, T12 and S8 go first in their own test-only commit, 5a. It is run
   red locally (S8) and in CI (T12, if O-ADM05-2 allows the push) before commit 5.
6. `ADM-05: Implementation record`.

Each fix commit can be reverted on its own. Commit 4 before 5 is safe: until 5 lands,
Publish shows the meta-description problem. That is the truth, and nothing is
published by mistake.

### 5.3 Local evidence

.NET in Release only. Never `DigitalHubContent`. Ports 42xx.

**After commit 1 (red):**

```bash
cd api && dotnet build DigitalHub.slnx -c Release
cd studio && npm ci && npx tsc -b
```

- Expected: the build has 0 errors (the tests compile against the base API). `tsc -b`
  passes. `e2e/` specs other than `env.ts` are outside `tsconfig.node.json`'s
  `include`, as ADM-07 recorded.
- T1 to T12 and E1 need SQL Server. Without it they fail at the connection, which is
  not the red. Record them as NOT RUN locally, covered by CI jobs `api` and `studio`
  (5.4).

**After commit 2 (red):**

```bash
cd studio && npx vitest run test/errorPages.test.tsx
```

Expected: S1 to S7 (and S8 under (c)) fail, each at the assertion in 5.1, quoted as
run.

**After the fix commits (green), every suite:**

```bash
# API (job api; SQL Server, DigitalHubContent_Test only)
cd api && dotnet build DigitalHub.slnx -c Release
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ErrorPagePublishTests|FullyQualifiedName~AdminApiTests|FullyQualifiedName~BuildContentTests|FullyQualifiedName~ContentPublishTests|FullyQualifiedName~RedirectTargetRuleTests|FullyQualifiedName~MediaLibraryTests|FullyQualifiedName~ContentBundleTests"

# Studio (job studio)
cd studio && npm ci
cd studio && npx tsc -b
cd studio && npm test
cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
cd studio && npx playwright test                                  # DigitalHubContent_E2e, reset by the harness; DH_E2E_API_PORT / DH_E2E_STUDIO_PORT in 42xx
cd studio && npx playwright test e2e/error-pages.spec.ts e2e/verification.spec.ts

# Website (job website): no file changes, run to show nothing moved
cd website && npm ci
cd website && npm run typecheck
cd website && npx vitest run
cd website && npm run design:check
cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build
```

- The build warnings are no more than the base's 13 (ADM-07 2.6).
- Any test that passed at the base and fails now is a regression. It is reported
  before anything is fixed. The filter run lists the classes that seed or read the
  error pages (2.8). `MediaLibraryTests` covers the working-copy usage path.

**Not runnable on this machine:** no `dotnet`, no SQL Server, no `node_modules`. The
developer quotes each command as run, with its exit code and output (P-8). Anything
that cannot run is NOT RUN, with the reason and the CI job that covers it.

### 5.4 CI evidence on the pull request

- **Red at commit 1** (needs O-ADM05-2 "Yes"):
  - Job `api`: T1, T2, T3, T4, T5, T6, T7 and T9 fail (and T12 under (c)). Quote each assertion. T8,
    T10, T11 and every existing test pass.
  - Job `studio`: unit tests pass (S1 to S8 are not in commit 1). In the end-to-end
    suite, E1 fails at step 1 under (a) or (b), or at step 2 under (c). Every other
    spec passes.
  - Job `website`: green (no change).
  - Wait until `api`, `website` and `studio` have finished before pushing again.
    `cancel-in-progress` cancelled part of ADM-02's red run (ADM-07 5.4).
- **Red at commit 2:** job `studio`, "Unit tests": S1 to S7 (and S8). The local red is enough.
- **Green, on the final head, every workflow:** `ci.yml` jobs `api` (quote the TRX
  total), `website`, `studio` (unit and end-to-end), `section-compare`,
  `website-browser`; `security.yml`; `workflow-lint.yml`.

### 5.5 Track checklist (G3, `docs/changes/README.md`)

| Rule | How this change meets it |
| --- | --- |
| "The finding, its evidence and its fix come from `docs/quality/admin-audit-2026-10-28.md`" | Section 1 quotes it. The three fixes are 3.1, 3.5 and 3.4 (O-16). T6 (section fields kept) was found here and is flagged so |
| "The regression test is committed and shown failing before the fix" | Commits 1 and 2 hold tests only. S1 to S7 are red locally. T1 to T7, T9 and E1 are red in CI at commit 1 (T8, T10 and T11 are guards, green at the base; T12 and S8 only under (c)), if O-ADM05-2 is "Yes". If it is "No", the database reds cannot be shown, the row is not met, and delivery is BLOCKED ON OWNER until the owner accepts that in words (P-7) |
| "The end-to-end suite gets a test for each Major" | ADM-05 is a Blocker. E1 is added anyway, for the G3-1 "reproduced before its fix" gate |
| "A Minor that is not fixed becomes a D-NNN entry" | Not a Minor. Nothing in the finding is left unfixed once O-ADM05-1 is answered |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | T1 reproduces the go-live-on-save claim. T3 and E1 reproduce the blocked publish. T5 reproduces ADM-03's handover. All pass after the fix |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` with no patched content" | Not met by the merge alone. Both pages must then be published there through the screen (O-ADM05-3), and ADM-02's O-ADM02-2 is still open. After that, `CONTENT_SOURCE=api npm run build` should get past `prepare.ts:44-48` |

## 6. Security impact

- **Routes and policies:** no route is added, removed or re-policied.
  - `GET` and `PUT /api/v1/error-pages[/{type}]` keep `[Authorize(Policy =
    "studio")]` (admin, editor; `Program.cs:260`).
  - Publish uses the existing `POST /api/v1/pages/{id}/publish` under
    `[StudioAccess]` (admin, editor; HR only for vacancy reads and End,
    `StudioAccess.cs:21-25`). Editors can already publish these pages through Pages.
    T11 pins HR's 403 on all three.
- **Data:** stricter than before. A save on a published page no longer reaches the
  website without Publish. The save now refuses a media id that is not in the library
  (T5), so a deleted or invented id cannot reach the build. The new answer fields
  (`status`, `state`, `hasWorkingCopy`, `publishedAt`, `notice`) are the ones the
  same roles already read on `GET /api/v1/pages/{id}`.
- **Input:** the body goes through `RichText.Validate`, the `rich_text` draft schema
  and the library check. The title is limited to 300 characters by
  `ContentFields.Validate`. Today this route has no length check on the title, so a
  title over the column's `[MaxLength(300)]` (`ContentRecord.cs`) would fail at the
  database. That is from reading the code, not run. If (c), the meta description is
  limited to 500.
- **Audit:** every save is still audited, now with the page id (B5). Publish is
  audited `publish`, as for any page.
- **Meta-description exemption (a):** affects two fixed slugs only. It removes a
  publish check that does not protect anything for pages with no address of their
  own. Images, alt text, links and references are still checked.
- **Logins, secrets, dependencies, configuration, rate limits:** none. No package is
  added. No lockfile changes.

## 7. Migrations

None. `WorkingCopy.PageId`, `Revisions` and the page columns already exist and are
used by every page save and publish (`ContentStore.cs:640-646`, 334-343).

## 8. Rollback

Revert the pull request. No schema change.

Data written while it was live stays valid under the old code:

- A working copy on a published error page is an ordinary page working copy. After a
  revert, Pages still shows it and can publish or discard it. The reverted error-page
  screen would not show it, and its Save would write the record again.
- **A stale working copy must be cleared (round 1, finding 6).** If one is left, the
  reverted screen's Save writes the record, and a later Publish through Pages copies
  the older working copy over it (`PublishAsync`, `ContentStore.cs:325-330`). The
  text the screen saved would be lost. So, in each database the change ran against
  (`DigitalHubContent_Studio` is the one that matters; the test and end-to-end
  catalogs are reset):
  1. Before the revert, or right after it and before anyone saves on the Error pages
     screen, open Pages, find `error-404` and `error-500`, and for each one whose
     chip reads "changed": publish it if the draft is wanted, or "Discard draft" if
     not.
  2. Then check that neither page reads "changed".
  This is a Studio action by the owner or with the owner's go-ahead, not a database
  edit. Only one agent at a time may write a local database (`AGENTS.md`).
- A page published through this change stays published. That is what the build
  needs.
- If (a) or (b) is reverted, the next publish of an error page needs a meta
  description again.

## 9. Owner decisions needed

**Checked first:** no record of an owner answer to O-16 was found.

- `grep -rn "O-16"` over the worktree, `/mnt/attach/project-files` and
  `/home/user/dh-change-adm10/docs` finds only two places. One is the audit's
  "Decision O-16 on the meta-description rule for noindex pages" (line 131). The
  other is the chat export of 1 November, line 2116, in the assistant's list
  "Decisions I need from you": "**O-16: should the 404 and 500 pages be exempt from
  the meta-description rule?** I recommend yes, since search engines never show
  them."
- The only user message after it in the export (13:47 UTC, 1 November) is "export
  all the chat here in md file". The refinement plan (line 268) lists O-16 among
  "Sixteen owner decisions are open".
- ADM-06's `plan-approval.md` line 60 says "ADM-06 waits on none of O-14 to O-17"
  and records no answer.
- So O-16 is asked again here, as O-ADM05-1. No answer is assumed.

- **O-ADM05-1 (this is O-16). Status: PENDING.** "The 404 and 500 pages cannot be
  published today because the publish check wants a meta description. These pages
  are never shown by search engines and have no address of their own. Should (a) the
  404 and 500 pages be exempt from the meta-description rule, (b) every page marked
  noindex be exempt, or (c) no page be exempt, with a Meta description field added to
  the Error pages screen?"
  - **Recommendation: (a).** It is the question as first asked (chat export, line
    2116). It matches `phase-b-studio.md` line 156, "required only for an item with
    its own page". It changes nothing for any other page. (b) is wider than the
    finding. (c) asks staff for text nobody sees.
  - **Blocks:** commit 5, so delivery of ADM-05. Not gate 1, and not commits 1 to 4.
- **O-ADM05-2. Status: PENDING.** "For ADM-05, may the developer push the test-only
  commit first, so CI shows the database and end-to-end tests failing before the fix,
  as with ADM-02, ADM-07 and ADM-10?"
  - **Recommendation: Yes.** T1 to T7, T9 and E1 need SQL Server, which only CI jobs
    `api` and `studio` have here. Without the push, their red cannot be shown and the
    G3 rule is not met.
  - The owner's earlier yeses covered those changes only ("Yes, red tests first",
    relayed 11 November 2026, ADM-07 `plan.md` section 9; ADM-10's O-ADM10-1). This
    one asks again.
  - **Until it is answered:** build commits 1 and 2, record the local reds, and push
    nothing.
- **O-ADM05-3. Status: PENDING. Not yet asked.** "After ADM-05 merges, will you
  publish the 404 and 500 pages in `DigitalHubContent_Studio` from the Error pages
  screen, and count that as normal Studio use rather than patched content for the
  G3-1 exit gate?"
  - **Recommendation: Yes, the owner does it through the Studio screen.** It is the
    flow this change adds, not a database edit. No agent here can reach that
    database, and only one agent at a time may write a local database (`AGENTS.md`).
  - **Blocks:** only the G3-1 exit-gate build, together with O-ADM02-2. Not gate 1 or
    gate 2.

**Behaviour changes, for the owner to see.** They go in the pull request body. They
are the audit's fix, so they are not asked as separate decisions. Say so before gate
1 if any is not wanted.

- **B1:** Save on a published 404 or 500 page saves a draft. The website keeps the
  published text until someone presses Publish.
- **B2:** `GET /api/v1/error-pages` shows the draft text when there is one, and adds
  `status`, `state`, `hasWorkingCopy`, `publishedAt` and `notice`.
- **B3:** The error-page save refuses an image that is not in the media library
  (400, `media`).
- **B4:** The error-page save runs the page save's checks: the `rich_text` draft
  schema, a title of at most 300 characters, and "That address is the source of a
  redirect." if a redirect from `/error-404` or `/error-500` exists.
- **B5:** The audit entry for an error-page save is `update_error_page` on entity
  type `page` with the page's id. It was entity type `error_page` with id `404` or
  `500`, plus the title.
- **B6:** An `eyebrow` or `blocks` value on the error page's text section is kept by
  a save. It was wiped.
- **B7:** The Error pages screen has a status chip and a Publish button, and lists
  what blocks a publish.
- **B8:** The O-ADM05-1 answer: (a) or (b) changes the publish rule; (c) adds a
  field.
- **B9 (round 1, finding 5):** The API's refusal titles on this route become the page
  save's titles:
  - 409: "This item was changed by someone else." (was "Someone else changed this
    page.");
  - a page removed between the lookup and the load: 404 "That item does not exist.";
  - a refused save: 400 "One or more fields are invalid." with the field keys of a
    page save (for example `sections[0].body`, `media`, `slug`, `title`).
  The screen keeps its own 409 text. It now lists the 400's fields (3.5, S7).
- A new text section is still created at `SortOrder = 0`, as today (3.1), so that is
  not a behaviour change.

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| A save on a published page still reaches the record (for example, the section picked from `loaded.Sections` and not from the draft) | Go-live on Save stays | T1 (record row and build content), T4, E1 step 4 |
| The list reads the record and not the working copy | Staff see the live text after saving a draft and think the save was lost | T2, S1, E1 step 3 |
| `CheckAsync` refuses the imported 404 body, for example on its page references | Staff cannot save the imported page | `CheckAsync(publishing: false)` does not check references (`PublishChecks` runs only at publish). `AdminApiTests.Error_pages_are_editable...` seeds the imported shape and must stay green unchanged. At publish, references to unpublished pages are warnings, not errors (`PublishChecks.cs:250-251`) |
| The exemption is wider than intended | Ordinary pages publish without a description | T8 (a page with `noIndex: true` under (a)) |
| Other tests leave error pages in a different state, or these tests do | Order-dependent failures in `AdminApiTests`, `BuildContentTests`, `ContentPublishTests` | The other classes do not all restore what they change (2.8), so the T tests do not rely on them. Each T test's helper accepts any starting state (none, drafts or published), seeds its own pages, and puts the saved rows back in `finally`. All are in collection `SqlServer` (serial). The filter run in 5.3 runs every class that touches the error pages |
| The `finally` tries to delete audit rows | `PermissionDenied` hides the real assertion in every T test | It does not: audit rows stay (5.1). T7 finds its row by entity id and time |
| E1 leaves published error pages in `DigitalHubContent_E2e` | Later specs see a non-empty Error pages list | `finally` unpublishes and deletes both. `workers: 1`. `verification.spec.ts` runs in 5.3 |
| E1's red at commit 1 hidden by a red unit-test step | No CI red for E1 | Commit split (5.2) |
| Two in-flight changes edit `AdminStore.cs` or `AdminControllers.cs` (ADM-10, ADM-04) | Breaks "Parallel work must change different files" (`AGENTS.md`); a merge conflict or a lost change | The order in 4.1: ADM-10 merges first; commit 3 is written only after `change/ADM-05` has merged a base containing ADM-10 (a merge, never a rebase), and `implementation.md` proves it with `git merge-base --is-ancestor`; ADM-04 does not start on those two files until ADM-05 merges. The suites are re-run after the merge |
| ADM-10's merge is late | Commit 3 cannot be written, and ADM-05 misses 16 November | 4.1 step 5: the developer stops after commits 1 and 2 and tells the coordinator. Nothing is copied from ADM-10 and nothing is written on the old base |
| Renaming `error-404` through Pages | The screen and the build lose the page | Out of scope (section 4). Recommended as a new audit finding. It exists today and is not made worse |
| A `RichTextEditor` host invariant is broken | ADM-03's paste guard could accept an id it should not | The screen still feeds `value` only from the API or `onChange` (3.5). S2 and S3 reload from the API. T5 adds the server check behind it |
| O-ADM05-1 unanswered by 16 November | ADM-05 misses the batch date | Commits 1 to 4 do not wait. Only commit 5 does. The coordinator asks it now |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Saves on the error pages go through the draft flow: a published page changes only at Publish | ADM-05, Fix 1; bullet 4; `phase-b-studio.md` 3.4 | Planned | |
| The screen shows each page's state | ADM-05, Fix 2 ("state") | Planned | |
| The screen can publish each page | ADM-05, Fix 2 ("Add Publish"); bullet 1 | Planned | |
| The screen lists what blocks a publish | Needed for Fix 2 to be usable (3.5) | Planned | |
| The meta-description rule, as the owner decides | ADM-05, Fix 3; O-16 = O-ADM05-1 | Planned (waits on O-ADM05-1) | |
| Publishing through Pages is no longer blocked for these pages | ADM-05, bullet 3 | Planned (waits on O-ADM05-1) | |
| The error-page save refuses an image not in the library | ADM-03 `implementation.md` section 11; `phase-b-studio.md` line 156 | Planned | |
| Error-page saves (`AdminStore.UpdateErrorPageAsync`) are no longer a separate write path | ADM-02 `plan.md` line 675 | Planned | |
| A save keeps the text section's other fields | Found here (2.3) | Planned | |
| `GET` and `PUT` never create an error page; HR cannot reach them | Existing contract (`AdminApiTests`); role boundaries | Planned | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan line 221 | Planned (CI red waits on O-ADM05-2) | |
| An end-to-end test of save-as-draft and publish on the screen | G3-1 exit gate, "reproduced before its fix and passing after it" | Planned | |
| An API build gets past `prepare.ts:44-48` once both pages are published | ADM-05, bullet 2; success measure line 250 | Planned (the `DigitalHubContent_Studio` run waits on O-ADM05-3 and O-ADM02-2) | |
| G3-1 exit gate: a clean build from `DigitalHubContent_Studio` with no patched content | Refinement plan line 225 | Planned (batch gate; not this change alone) | |
| FR-S-21 moves from "Partly" to "Works" | Audit requirement table, line 46 | Planned | |
| A refused save lists its fields on the screen | Found by review (round 1, finding 4); B3, B4 | Planned | |
| The meta description field saves, is limited to 500 and is kept when left out (only if (c)) | O-ADM05-1 (c); review round 1, finding 7 | Planned (only if O-ADM05-1 is (c)) | |
| Shared-file order: ADM-10 merged into `change/ADM-05` before commit 3; ADM-04 held on the two files until ADM-05 merges | `AGENTS.md` "Parallel work must change different files"; review round 1, finding 1 | Planned | |

## 12. Revision log

- **Round 1** (12 November 2026, `76bf41f`): first version.
- **Round 2** (12 November 2026): answers `plan-review.md` Round 1 (`676e068`,
  CHANGES NEEDED, one Major and eight Minors), point by point.
  1. **Major, shared files.** Agreed: `AGENTS.md`'s rule is about files, not lines.
     2.9 no longer argues "different lines", and the "If ADM-10 merges first"
     alternative is gone. New 4.1 states the integrator's order, as the coordinator
     gave it:
     - ADM-10 merges first.
     - Only the test commits 1 and 2 may be written, and pushed, before that.
     - Before commit 3, `change/ADM-05` merges `origin/rebuild/dotnet-platform`
       containing ADM-10. It is a merge, never a rebase, proven in
       `implementation.md` with `git merge-base --is-ancestor`. Commits 3 to 5 come
       after it, and the suites are re-run.
     - If ADM-10 is late, the developer stops and reports.
     - ADM-04 does not start on `AdminStore.cs` or `AdminControllers.cs` until ADM-05
       merges.
     2.9 now also lists, from `git ls-remote` and `git merge-base`, which `change/*`
       heads touch this change's five source files: only ADM-10 is in flight. 5.2
       shows the merge step, and the risk rows are replaced. The review's other
       option (leave `AdminStore.cs` untouched) is not taken, because the
       coordinator chose the order.
  2. **Minor, audit-row clean-up.** The `finally` no longer deletes audit rows. They
     stay, as `ListPagingTests.cs:176` does, because the app login cannot delete them
     (`AuditLogPermissionTests.cs:46-48`). T7 finds its row by entity id and time.
     There is a new risk row (5.1, Risks).
  3. **Minor, the save's answer.** 3.1 step 5 names the mechanism. On success,
     `SaveErrorPageAsync` reloads with `LoadAsync("pages", id)` and presents the 3.2
     shape from that. A failure outcome is returned as it is. `MutateAsync` is not
     changed, so "No change to any existing method" stays true.
  4. **Minor, refused saves show only the title.** A 400 on Save now fills the same
     per-card list as a blocked publish (3.5). New S7. Mapping the keys to fields is
     left to ADM-14 by name ("field errors mapped to fields", audit line 236).
  5. **Minor, unlisted behaviour changes.** The 409 and 404 titles are not remapped.
     B9 lists them, and the 400 field keys. The new section's `SortOrder` is now 0, as
     today, so that change is gone (3.1, B-list).
  6. **Minor, rollback and a stale working copy.** Section 8 now says to publish or
     discard any "changed" `error-404` or `error-500` through Pages, before the revert
     or right after it and before any save on the reverted screen.
  7. **Minor, no tests for (c).** New T12 (save stores it; 501 characters gives 400
     "is longer than 500 characters."; a missing key keeps the stored value) and S8
     (the field is sent on Save), both "(c) only". 3.4 (c) now says a missing key
     keeps the value. 5.2 says where they go if (c) comes late (commit 5a), with
     coverage rows.
  8. **Minor, 2.8's restore claim.** Corrected. Only `BuildContentTests` restores.
     `AdminApiTests` leaves new drafts, and `ContentPublishTests` keeps what it finds.
     The risk row now rests on the helper, which accepts any starting state.
  9. **Minor, inconsistencies.**
     - 5.5 and section 9 now say "T1 to T7, T9 and E1" are red, with T8, T10 and T11
       as guards.
     - T2 does its own set-up and save.
     - The G3 track row is cited at line 17.
     - `EmptyDoc` moves to `ContentStore` and is removed from `AdminStore` (3.1,
       Scope).
  - Also fixed: 3.4 said "commits 1 to 4 and 6 to 7". It now says commits 1 to 4, in
    the 4.1 order.
  - **Owner questions:** unchanged. O-ADM05-1 (O-16), O-ADM05-2 and O-ADM05-3 are
    PENDING. Nothing is assumed. The reviewer confirmed that no answer to O-16 is on
    record.

Plan state: round 2, ready for plan review. Gate 1 may proceed with the owner
questions open, under the conditions the review states. Delivery waits on O-ADM05-1
(O-16) for commit 5, on O-ADM05-2 for the CI red, and on ADM-10's merge for commit 3.
