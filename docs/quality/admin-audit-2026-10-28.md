# Studio admin-function audit

28 October 2026. Goal 3 of the plan: the Studio functions staff need to run the
website. Three reviewers worked the running system against FR-S-01 to FR-S-22
(`docs/business-analysis.md`), each on a different area. I checked the main claims
against the code and, where cheap, by re-running them.

## How it was run

- **API:** `rebuild/dotnet-platform`, Release, Production, on 127.0.0.1:4210.
- **Database:** `DigitalHubContent_Studio`, with the real content imported. 12
  uploads are gitignored and did not import, so the five home hero logos have no
  image.
- **Studio:** Vite on 127.0.0.1:4211.
- **Website:** built with `CONTENT_SOURCE=api`.
- **Accounts:** one admin, one editor and one HR user per reviewer. Lockout tests
  came from separate loopback addresses.
- Evidence (scripts, logs, screenshots) is in the session scratchpad and is not
  committed. Every item below cites the file and line.
- **Not product defects:** the missing hero logos come from the environment. Zero
  vacancies is by design (business analysis §372: the six old vacancies were test
  data).

## Requirement status

| Requirement | Status | Main gap |
|---|---|---|
| FR-S-01 sign-in, lockout, session | Partly | No per-account lockout (ADM-11) |
| FR-S-02 users | Partly | No role change, reactivation or delete (ADM-04) |
| FR-S-03 create, edit, delete, order | Works | Reorder raises every item's version (ADM-08) |
| FR-S-04/05 sections | Partly | Unfinished or cleared fields block the save (ADM-09) |
| FR-S-06 rich text | Partly | Images deleted, typing lost (ADM-03) |
| FR-S-07 media | Partly | No replace; limited to the newest 48 or 24 (ADM-06, ADM-16) |
| FR-S-08 alt text | Partly | Can be bypassed in the library (ADM-12) |
| FR-S-09 SEO counters | Works | |
| FR-S-10 automatic redirects | Works | |
| FR-S-11 manual redirects | Partly | Can break the build, take over a page, or loop (ADM-02, ADM-07) |
| FR-S-12 preview | Partly | No preview for blog posts, vacancies, news or team (ADM-18) |
| FR-S-13 edit conflicts | Partly | No way to keep your work (ADM-08) |
| FR-S-14 revisions, discard | Works | Discard has no confirmation (ADM-14) |
| FR-S-15 audit log | Partly | Paging and filters broken (ADM-06, ADM-15) |
| FR-S-16 navigation | Partly | No remove or reorder (ADM-13) |
| FR-S-17 settings | Partly | Save clears the share image (ADM-10) |
| FR-S-18 contact inbox | Works, with gaps | Only the newest 50 reachable (ADM-06) |
| FR-S-19 publish checks | Works | |
| FR-S-21 404 and 500 pages | Partly | Cannot be published from their screen (ADM-05) |
| FR-S-22 live or awaiting build | Missing | ADM-01 |
| Publish to the live site | Missing | ADM-01 |
| Role boundaries | Works in the API; partly in the UI | HR can open other screens by URL (ADM-19) |

## Findings, most severe first

Blocker: staff cannot run the website without a developer, or they lose work or
data. Major: a function works but is unsafe or so awkward that staff will work
around it. Minor: friction.

### Blockers

**ADM-01: published content never reaches the website, and the Studio says it is
fine.**
- No build or deploy is ever started:
  - `BuildContentController` is GET only.
  - CI builds from the snapshot.
  - Someone holding the build token has to run `npm run build` and copy `out/` by
    hand.
- There is no live or awaiting-build state (FR-S-22, process 9.1 steps 5 to 8).
- The sidebar's "Website connected" badge is fixed markup.
- Code: `api/src/DigitalHub.Api/Controllers/BuildContentController.cs`,
  `studio/src/shell/AppShell.tsx:162-168`, `studio/src/pages/OverviewPage.tsx`.
- Fix, split in two:
  - **ADM-01a, now:** record build runs, each with its content cutoff and result.
    Show "Live" or "Awaiting build" per item and the last build on the Overview,
    and replace the badge with that real state.
  - **ADM-01b, with Phase D:** a build-and-deploy pipeline that publishing or a
    "Publish website" action starts (decision O-14).

**ADM-02: content the API accepts can stop every website build, and nobody in the
Studio is told.**
- Redirects `/x/` and `/x` are both accepted (201). The build then fails with
  "Two redirects start at /x/".
  - The API compares exact strings (`AdminStore.cs:139`).
  - The build ignores a trailing slash (`website/src/iis/web-config.ts:148`).
- A section reference id that is not a UUID was accepted and published. The build
  rejects it (`format: "uuid"`), because the API does not enforce schema formats
  the build enforces.
- Fix:
  - Normalise paths in every redirect check.
  - Enforce the same formats in the API.
  - Add a test that feeds API-accepted content to the website's checks.
  - Report a failed build in the Studio (ADM-01a).

**ADM-03: images in rich text are deleted, and typing after them is lost.**
- `RichTextEditor.tsx:117-121` sends the whole document to `/rich-text/paste` on
  every keystroke once it contains an image node with a `src` key. Every image
  node has `src: null`.
- The server filter (`RichText.cs:98-103`) then drops library images too, and the
  result is set back into the editor while the person types.
- Inserting a library image removes it at once. Typing after an existing image
  kept two characters of " Edited.".
- Fix:
  - Filter only real paste events, in `handlePaste`.
  - Keep image nodes with a valid `mediaId`.
  - Never replace the document from `onUpdate`.

**ADM-04: users cannot have their role changed, be reactivated or be deleted, and
a deactivated email can never be used again.**
- `UsersController` (`AdminControllers.cs:74-100`) has list, create, deactivate
  and reset only.
- Re-creating a deactivated email returns `409 email_taken`.
- Promoting an editor, fixing a wrong role or bringing back a returning employee
  needs a new email address or direct database work.
- Fix:
  - Change role, keeping the last-admin guard.
  - Reactivate.
  - Decision O-15 on delete.
  - The matching UI.

**ADM-05: the 404 and 500 pages cannot be published from their screen, and the
website build needs them published.**
- `ErrorPagesPage.tsx` has Save only.
- `website/src/content/prepare.ts:44-47` fails an API build until both pages are
  published, and both are drafts today.
- Publishing through Pages is blocked by the meta-description rule on these noindex
  pages.
- The screen writes straight onto the page record (`AdminStore.cs:549-598`). On a
  published page, a Save would go live at the next build without Publish. This is
  from reading the code, not run.
- Fix:
  - Route saves through the draft and publish flow.
  - Add Publish and state to the screen.
  - Decision O-16 on the meta-description rule for noindex pages.

**ADM-06: paging is broken on every list endpoint.**
- `[FromQuery] PageQuery page` makes `page=` a binding prefix, so `?page=2&pageSize=5`
  returns page 1 of 20. I re-ran it: page 1, pageSize 20, total 240.
- Affected: audit, contact requests, redirects, media and every collection.
- Only the newest 50 enquiries and audit entries can be reached. The media library
  shows the newest 48 of 56, the picker the newest 24.
- The preview loader (`studio/src/preview/previewData.ts:56-61`) would repeat items
  past 20.
- Ranked a blocker because enquiries past the 50th become unreachable.
- Fix:
  - Rename the parameter, or bind with `Name = ""`.
  - Add paging controls to the audit, inbox and media screens.
  - Add a page-2 test per endpoint.

### Major

**ADM-07: a manual redirect can take over a live page or loop.**
- `/blogs/<live-slug>/` is accepted and emitted ahead of the clean-URL rule, so the
  live page returns 301.
- `/a → /a/` is accepted: its pattern matches its own target.
- A target that does not exist is accepted and built (Phase C 10.7 "every redirect
  resolves" is not enforced).
- Same root cause as ADM-02. Fix it with path normalisation, plus a target check
  that warns in the Studio and reports in the build.

**ADM-08: a version conflict cannot be resolved without losing work.**
- After a 409, Keep editing gets a 409 again on every save, and Reload discards the
  edits (`ItemEditorPage.tsx:170-173`, 444-455).
- Reordering raises the version of every item in the collection, which makes
  conflicts routine.
- Fix:
  - Reload and re-apply the local changes.
  - Keep an unsaved draft locally.
  - Reorder without raising item versions.

**ADM-09: unfinished sections block saving the whole item, and optional fields
cannot be cleared.**
- A new, empty section fails the save with raw schema text (`SectionSchemaSet.cs:131-157`).
- Clearing an optional nested object (hero Back) fails with `/back required`.
- A chosen optional image has no Clear (`FormWalker.tsx:90-97`, 172-188).
- Fix:
  - Enforce required fields at publish, not on save, or give sections defaults
    when they are added.
  - Readable messages.
  - Remove and Clear controls.

**ADM-10: saving Settings clears the default share image.**
- The form does not send `defaultShareImageId`, and the API copies the null over
  the stored value (`AdminStore.cs:242`).
- There is no field to set it.
- Fix:
  - A media picker and alt override on the form.
  - Treat a missing field as unchanged, or carry it through the save.

**ADM-11: no per-account lockout.**
- `Program.cs:60` has `Lockout.AllowedForNewUsers = false`.
- `AuthController.cs:46` never records a failure on the account. The 8-an-hour
  limit is per address and email, so guessing from several addresses is not
  limited.
- Successful sign-ins use up the same budget.
- A 429 has no `Retry-After`, and no admin can clear it.
- Security as well as admin. It is the "lockout" that O-13's fallback relies on.
- Fix:
  - Identity lockout with `AccessFailedAsync`.
  - Count failures only.
  - `Retry-After`.
  - An admin unlock.
  - A regression test.

**ADM-12: the alt-text rule can be bypassed in the media library, and library
edits go live without publishing.**
- `MediaLibrary.cs:114-131` lets an image used by published items be saved as
  decorative with no alt (200). The next build passes and ships cards with no alt
  text.
- Fix: refuse it while any use has no per-use alt, or run the publish alt check
  over every use.

**ADM-13: navigation items cannot be removed or reordered.**
- Phase B §8.1 requires reordering. A half-made child link cannot be deleted, only
  abandoned by a reload.
- Saves carry no version, so the last write wins.
- Targets show as ids (`NavigationPage.tsx:83-126`, `AdminStore.cs:1050`).
- Fix:
  - Remove and move controls.
  - A version check.
  - Field errors.
  - Target titles.

**ADM-14: destructive actions run on one click, and many failures show no
reason.**
- No confirmation on:
  - delete
  - discard draft (drafts are not in revision history)
  - deactivate
  - reset password
  - end vacancy
  - delete redirect (`ItemEditorPage.tsx:280-284`, `UsersPage.tsx`, `RedirectsPage.tsx:83`)
- Generic messages:
  - weak password on create user or change password
  - an invalid redirect or settings field ("One or more fields are invalid.")
  - an upload over 5 MB
  - a save after the item was deleted (nothing shown)
- Every 409 reads as "Someone else changed this item".
- Fix: confirmation modals that name the item, field errors mapped to fields, and
  the problem title shown for any failure.

**ADM-15: the audit log filters give wrong results.**
- "Today to today" sends `to` as midnight at the start of the day and returns 0.
- The action filter needs exact internal codes (`deactivate_user`).
- Users and entities show as ids (`AuditPage.tsx:45-83`).
- Fix: end of day for `to`, dropdowns for action and entity, and user emails.

**ADM-16: images are hard to find, recognise and replace.**
- The library and picker show the newest 48 and 24 (ADM-06).
- A chosen image appears as an id with no thumbnail (`FormWalker.tsx:194-199`).
- "Used in" lists ids.
- There is no Replace: swapping a logo used in five places means re-picking and
  republishing each.
- Fix: paging, thumbnails, item titles with links, and a Replace action that keeps
  the media id.

**ADM-17: the blog FAQ is a raw JSON text box.**
- Text that is not JSON saves (200), and the website then drops the FAQ silently
  (`packages/collections/blog-posts.json:17`, `website/src/components/BlogArticle.tsx:45`).
- Fix: a structured question-and-answer list, as in the FAQ section.

### Minor

**ADM-18:** no preview for blog posts, vacancies, news or team
(`ItemEditorPage.tsx:282`, `route.sections` only).

**ADM-19: the HR view is rough.**
- HR lands on an Overview it has no menu entry for, which shows misleading zeros.
- Other screens open by URL with live buttons above "no access".
- HR cannot undo End.
- Admins cannot see application counts.

**ADM-20: ids and raw keys where names belong.**
- References, publish findings (`metaDescription`, zero-based indexes) and
  reference warnings.
- The finding jump ignores nested paths (`ItemEditorPage.tsx:234`).

**ADM-21: inbox details.**
- The count lags.
- The tiles count only the loaded page.
- The situation shows as a code.
- The handled time is raw ISO and shows no handler.
- Handled cannot be undone, and spam cannot be deleted.

**ADM-22: rich-text gaps.**
- Only a 2×2 table, with no row or column controls.
- No unlink or edit-link.
- No per-use alt in rich text.
- `/rich-text/paste` accepts only TipTap JSON.
- An `h1` is dropped together with its text.

**ADM-23: editor frictions.**
- Entries inside a section cannot be reordered.
- The Add section dropdown keeps its last value.
- Revisions show only "Version N".
- Add creates a persisted "Untitled" draft.
- Renaming back to a previous slug is blocked by its own redirect.
- A duplicate upload drops the typed alt text.

**ADM-24: account follow-ups.**
- Admin-created users are not made to change the password the admin chose
  (`AdminStore.cs:316`). This joins GAP-29.
- Users with no role are hidden from the list and get a confusing message after
  signing in. That second part is from reading the code.

**ADM-25: a `featured` field exists although the settled design says "No featured
flag".**
- It is in seven collection schemas (`packages/collections/*.json`), and the
  website does not read it.
- Decision O-17.

## Order of the fixes

Blockers first, starting with the ones that are a few lines each, then the
Majors, then the Minors. The dates are in the plan.

| Batch | Items | Why this order |
|---|---|---|
| G3-1, 3 to 16 November | ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a | Data that cannot be reached, lost work, builds that silently fail, and the build status staff need before anything else is published |
| G3-2, 17 November to 11 December | ADM-11, 08, 09, 14, 13, 15, 16, 17 | Unsafe or awkward functions. ADM-11 first, because it is also a security fix |
| G3-3, 14 to 18 December | ADM-18 to 25 | Friction |
| Phase D | ADM-01b | Needs a deploy target |
