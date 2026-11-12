# ADM-05: implementation

Developer, 12 November 2026. Plan: `plan.md` round 2 (`0857268`). Gate 1:
`plan-approval.md` (`004244b`), `Verdict: APPROVED` with ten conditions. Branch
`change/ADM-05`, worktree `/home/user/dh-change-adm05`.

Two sessions. The first wrote the test-only commits 1 and 2 on `32f0414` and stopped,
because ADM-10 had not merged (plan 4.1 step 5). The second, after the owner's answers
and the ADM-10 merge, wrote commits 3, 4 and 5 under O-ADM05-1 (a), and this record
(commit 6).

## 1. Owner decisions (P-7)

The coordinator relayed both answers to this session. They are the owner's card taps of
12 November 2026, 11:56 UTC:

| Question | Owner's words | Effect |
| --- | --- | --- |
| O-ADM05-1 (O-16): the meta-description rule for the error pages | "Yes, only 404 and 500" (option (a)) | Commit 5 exempts the two error pages only. T8 keeps `noIndex: true`. T12 and S8 are not written (they were for (c) only) |
| O-ADM05-2: push the test-only commit first, for the CI red | "Yes, red tests first" | Commit 1 alone is on `change/ADM-05-red` (`63c15dc`), draft PR #57, pushed by the coordinator. CI has not run yet (section 6) |
| O-ADM05-3: the owner publishes both pages in `DigitalHubContent_Studio` after merge | PENDING, not yet asked | Only the G3-1 exit-gate build. Not gate 2 |

I quote these answers as the coordinator relayed them. I did not see the cards myself.

**Push history, as the coordinator reported it.** Commits 1 and 2 were pushed together
to `change/ADM-05` (`d35fdd8`) by mistake. Commit 1 alone was then pushed to
`change/ADM-05-red` for the red run:

```
$ git ls-remote origin 'refs/heads/change/ADM-05*'
d35fdd8ba05f84ee1583fe3f0527d94d93ac569c	refs/heads/change/ADM-05
63c15dc7711fcf0a3a2756d21e8b8f5f818c4599	refs/heads/change/ADM-05-red
```

This session pushed nothing (condition 3, and the coordinator's instruction).

## 2. Base and ADM-10 (condition 1, plan 4.1)

First session, before commit 1:

```
$ git rev-parse origin/rebuild/dotnet-platform
32f0414ef3bf1139bc5022d88e33e27075f125b4
$ git merge-base --is-ancestor 32f0414 HEAD; echo $?
0
$ git rev-parse --short origin/change/ADM-10
04d0e80
```

Second session, after the coordinator merged `origin/rebuild/dotnet-platform`, with ADM-10
squashed as `2bbd586` (#56), into `change/ADM-05` as merge commit `0b3ef34`. This was a
merge, not a rebase (4.1 step 3):

```
$ git log --oneline -3 origin/rebuild/dotnet-platform
2bbd586 ADM-10: Keep the default share image when Settings is saved (#56)
32f0414 ADM-07: Flag redirects with no page and make redirect creates safe under load (#55)
6262f48 ADM-02: Keep API-accepted content passing the website's checks (#54)
$ git merge-base --is-ancestor 2bbd586 HEAD; echo $?
0
$ git log --oneline --graph -4
*   0b3ef34 ADM-05: Merge rebuild/dotnet-platform with ADM-10
|\
| * 2bbd586 ADM-10: Keep the default share image when Settings is saved (#56)
* | d35fdd8 ADM-05: Test the error pages screen's state and Publish
* | 63c15dc ADM-05: Test that error-page saves are drafts and the screen can publish
$ git diff --name-only 32f0414 2bbd586 | grep -E "AdminControllers|ContentStore|PublishChecks|ErrorPagesPage"
(no output, exit 1)
```

- ADM-10's merged change touches `AdminStore.cs` only among this plan's five source
  files, as at `04d0e80`. Nothing from ADM-10 was copied by hand.
- The members to remove were found by name in the merged `AdminStore.cs`: `ErrorTypes` at
  18, `ListErrorPagesAsync` at 580, `UpdateErrorPageAsync` at 598, `PresentErrorPage` at
  1030 and `EmptyDoc` at 1111.

**Suites re-run after the merge, before commit 3.**

| Command (from `studio/`) | Exit | Output |
| --- | --- | --- |
| `npx tsc -b` | 0 | no output |
| `npm test` | 1 | `Test Files 1 failed \| 13 passed (14)`, `Tests 7 failed \| 98 passed (105)`. The 7 failures are S1 to S7, the same reds as in the first session. The 4 new passing tests are ADM-10's `settingsShareImage.test.tsx` |

The API and end-to-end suites could not be re-run here (section 5). So only the Studio
reds are shown to be unchanged by the merge.

## 3. Commits

| # | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 | `63c15dc` | `ADM-05: Test that error-page saves are drafts and the screen can publish` | `api/tests/DigitalHub.Api.Tests/ErrorPagePublishTests.cs` (new), `studio/e2e/error-pages.spec.ts` (new) |
| 2 | `d35fdd8` | `ADM-05: Test the error pages screen's state and Publish` | `studio/test/errorPages.test.tsx` (new) |
| merge | `0b3ef34` | `ADM-05: Merge rebuild/dotnet-platform with ADM-10` (by the coordinator) | ADM-10's files |
| 3 | `71edc31` | `ADM-05: Save the error pages through the draft flow` | `ContentStore.cs`, `AdminControllers.cs`, `AdminStore.cs` |
| 4 | `a3a94d7` | `ADM-05: Publish the error pages from their screen` | `studio/src/pages/ErrorPagesPage.tsx` |
| 5 | `e8dc356` | `ADM-05: Exempt the 404 and 500 pages from the meta-description rule` | `api/src/DigitalHub.Api/Content/PublishChecks.cs` |
| 6 | this commit | `ADM-05: Implementation record` | `docs/changes/ADM-05/implementation.md` |

- Every commit was staged by exact path and carries the two attribution trailers.
- There is no commit 5a: the answer is (a).
- No lockfile, package, workflow, migration or `website/` file is changed.

## 4. What changed, by file (plan section 4)

### `api/tests/DigitalHub.Api.Tests/ErrorPagePublishTests.cs` (commit 1, new)

T1 to T11 as in 5.1. Sessions, `CreateUserAsync` and `SendAsync` follow
`ContentPublishTests`, and the build is read with the build token.

The helper `ErrorPagesAsync(status, eyebrow)`:

- **Saves what it finds.** Every `error-*` page, with its sections and working copies,
  is saved and then removed.
- **Seeds both pages** with:
  - the given status, `NoIndex = true` and no meta description;
  - one `rich_text` section `{ heading, body: "Body A" }`;
  - an `eyebrow` on the 404, for T6.
- **Puts things back in `finally`.** It removes the seeded pages (their sections and
  working copies cascade) and their `revisions` rows, then re-adds what it saved, with
  the same ids.
- It never touches `audit_log` and never uses the elevated connection (condition 6).

T7 finds its row by the fresh page id and `At` after the test's start, less one second
for the column's rounding. T8 uses `noIndex: true`, as condition 4 sets for (a). T12 is
not written.

### `studio/e2e/error-pages.spec.ts` (commit 1, new)

E1, steps 1 to 6 of 5.1.

- **Set-up.** Both pages are created through the API, given a `rich_text` section by
  `POST /api/v1/pages/{id}/sections`, and published.
  - Before commit 5, the publish step is where E1 is red.
  - 5.1 names `PUT /api/v1/pages/{id}/save` for the section. The sections route adds the
    one section without resending every SEO field, and reaches the same state. This is
    a choice inside the test, not a scope change.
- **On the screen**, as editor:
  - the chip reads "published";
  - a typed body is saved: the message says "saved as a draft" and the chip reads
    "changed";
  - the API shows the live body unchanged;
  - Publish turns the chip back to "published", and the API shows the live body changed
    and no working copy.
- **`finally`** unpublishes and deletes both pages.

### `studio/test/errorPages.test.tsx` (commit 2, new)

S1 to S7. The harness is from `redirects.test.tsx`, including the empty-body check after
each test. S8 is not written.

### `api/src/DigitalHub.Api/Content/ContentStore.cs` (commit 3)

All additions are new members. No existing method changes, `MutateAsync` included.

- **`ListErrorPagesAsync`** (public, 3.1). For each `BuildContentStore.ErrorSlugs`
  entry, it finds the page id by slug (`AsNoTracking`), loads it with `LoadAsync`, and
  presents it. A missing page is skipped, and nothing is created.
- **`SaveErrorPageAsync`** (public, 3.1 steps 1 to 5):
  - It keeps today's input checks, keys and messages (`type`, `version`, `title`, and
    `RichText.Validate` under `body`), then "That error page does not exist." for a
    missing page.
  - It calls the existing `MutateAsync("pages", id, version, userId,
    "update_error_page", ...)`. The change sets `draft.Title` and picks the section by
    today's rule, in `SortOrder` order: the first `rich_text`, else the first section,
    else a new `rich_text` at `SortOrder = 0`.
  - A `rich_text` section keeps its other fields: it is parsed as a `JsonObject`, and
    only `heading` and `body` are set. A section of another type becomes `rich_text`
    with `{ heading, body }` only.
  - A failed outcome is returned as it is. On success the page is loaded again and
    presented.
- **`PresentErrorPage`** (private, 3.2). It answers `type`, `id`, `title`, `body` and
  `version` from the draft (`DocumentOf`: the working copy when there is one), plus
  `status`, `state` (`StateOf`), `hasWorkingCopy`, `publishedAt` and `notice`, as
  `Present` computes them. The body is read as today's code reads it: a string or an
  object, else the empty document.
- **Moved or new private helpers.** `EmptyDoc` (same text, moved), `ErrorPageIdAsync`,
  `ErrorPageMissing`. `using System.Text.Json.Nodes` is added.

### `api/src/DigitalHub.Api/Controllers/AdminControllers.cs` (commit 3)

`ErrorPagesController` takes `ContentStore`, and `PUT` calls `SaveErrorPageAsync`. Routes,
`[Authorize(Policy = "studio")]`, `ErrorPageUpdate` and `AdminResponse.From` are
unchanged.

### `api/src/DigitalHub.Api/Content/AdminStore.cs` (commit 3)

Removed: `ErrorTypes`, `ListErrorPagesAsync`, `UpdateErrorPageAsync`, `PresentErrorPage`
and `EmptyDoc`. The diff is 107 lines removed and none added. `ErrorPageUpdate` is kept
unchanged. Outside `AdminStore.cs`, the only callers of the removed methods were the
controller's two lines (`grep -rn` over `api/`).

### `studio/src/pages/ErrorPagesPage.tsx` (commit 4, 3.5)

- **The card.** The `ErrorPage` type gains `status`, `state`, `hasWorkingCopy`,
  `publishedAt` and `notice`. Each card shows `<StatusChip state={page.state} />` beside
  its title, outside the heading, and a published page with no draft shows the API's
  notice.
- **Dirty flag.** `patch` sets a per-card flag. A successful save clears it.
- **Save** keeps its request. The message is "`404 page saved.`" for a draft, and
  "`404 page saved as a draft. Publish to put it on the website.`" when the answer's
  `status` is "published".
- **A refused save:**
  - 400 with `errors`: listed on the card, which stays dirty, and nothing is reloaded;
  - 409: "Someone else changed this page.";
  - anything else: today's title line.
- **Publish** sends `POST /api/v1/pages/${id}/publish` with `{ version }`. It is disabled
  while the card is dirty, with the line "Save before publishing, so the check runs on
  what is on screen."
  - 200: any `warnings` are listed, the list is reloaded, and the message is
    "`404 page published. Changes appear on the website at the next build.`"
  - 409: today's text.
  - 400: `problem.title` and each `key: messages` from `errors` and `warnings`, listed on
    the card with no jump links.
- **The reload keeps unsaved edits.** A card that is dirty keeps its edits when another
  card's Publish reloads the list. This is a detail not written in 3.5: without it,
  publishing one page would silently discard unsaved edits on the other.
- **Not added:** Unpublish, Discard draft, revisions, preview (3.5).
- The `RichTextEditor` still takes `value` only from the API or from its own `onChange`,
  so ADM-03's invariant holds.

### `api/src/DigitalHub.Api/Content/PublishChecks.cs` (commit 5, 3.4 (a))

`AddAsync` skips `AddDescription` only when `collection == "pages"` and the slug is one
of the two `BuildContentStore.ErrorSlugs` values (new private `IsErrorPage`). This is
keyed on the slugs and not on `noIndex`, as condition 4 requires. Images, links and
references are still checked.

## 5. Commands run

Machine: Linux, Node `v22.23.4`. There is no `dotnet` and no SQL Server, and the proxy
refuses the .NET download host:

```
$ curl https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json
curl: (56) CONNECT tunnel failed, response 403
```

### Studio (`studio/`)

| When | Command | Exit | Output |
| --- | --- | --- | --- |
| session 1 | `npm ci --no-audit --no-fund` | 0 | `added 245 packages in 8s` |
| after commit 2 | `npx tsc -b` | 0 | no output |
| after commit 2 | `npx vitest run test/errorPages.test.tsx` | 1 | 7 failed of 7 (section 7) |
| after commit 2 | `npm test` | 1 | `Tests 7 failed \| 94 passed (101)` (S1 to S7 only) |
| after merge `0b3ef34` | `npx tsc -b` / `npm test` | 0 / 1 | as in section 2: the same 7 reds, `98 passed` |
| after commit 4 | `npx tsc -b` | 0 | no output |
| after commit 4 | `npx vitest run test/errorPages.test.tsx --reporter=verbose` | 0 | all seven `✓`, `Tests 7 passed (7)` |
| after commit 4 | `npm test` | 0 | `Test Files 14 passed (14)`, `Tests 105 passed (105)` |
| after commit 4 | `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 1.66s`; `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` Vite also printed its "Some chunks are larger than 500 kB" notice; I did not compare it with the base |
| session 1 | `npx tsc -p <scratch config>` over the new spec and the new unit test | 1 | no error in either file; the only error is `src/content/model.ts(87,55) TS2339 'env'`, because the scratch config has no `vite/client` types |
| session 1 | `npx playwright test --list e2e/error-pages.spec.ts` (ports 4201/4202) | 1 | `Error: spawnSync dotnet ENOENT` at `e2e/env.ts:108`: the config reads the E2E connection string through `dotnet user-secrets` |

Commits 3 and 5 change no Studio file, so the Studio results after commit 4 also hold at
`e8dc356`.

### Website (`website/`), at `e8dc356`, with no `website/` change

| Command | Exit | Output |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | 0 | `added 114 packages in 21s` |
| `npm run typecheck` | 0 | `tsc --noEmit`, no error |
| `npx vitest run` | 0 | `Test Files 23 passed \| 1 skipped (24)`, `Tests 431 passed \| 31 skipped (462)` |
| `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `web.config: 0 redirect(s), report-only content security policy, custom 404 and 500.` ... `Build output checks passed.` |

I did not compare the skipped counts with the base.

### NOT RUN

| Check | Reason | Covered by |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release` (compile, warning ceiling 13) | No `dotnet`; installer host refused | CI job `api` |
| `dotnet test ... -c Release` (full suite, and the 5.3 filter run over `ErrorPagePublishTests`, `AdminApiTests`, `BuildContentTests`, `ContentPublishTests`, `RedirectTargetRuleTests`, `MediaLibraryTests`, `ContentBundleTests`) | No `dotnet`, no SQL Server (`DigitalHubContent_Test`) | CI job `api` |
| T1 to T11 red at commit 1, green at the head | Same | CI job `api` on `change/ADM-05-red` (red) and on the final head (green) |
| `npx playwright test` and `npx playwright test e2e/error-pages.spec.ts e2e/verification.spec.ts` | No `dotnet` or SQL Server (`DigitalHubContent_E2e`) | CI job `studio`, "End-to-end suite" |
| `section-compare`, `website-browser`, `security.yml`, `workflow-lint.yml` | CI workflows | CI, on the final head |

No database was read or written in either session, and `DigitalHubContent` was never
named.

**The C# in commits 1, 3 and 5 has not been compiled.** I read it against the types it
uses:

- `ContentOutcome`, `Loaded`, `DraftSection.Fields` (`JsonElement`), `JsonNode.Parse`
  and `ToJsonString(JsonSerializerOptions)`;
- `BuildContentStore.ErrorSlugs` (`internal`, same assembly);
- `RichText.Validate(string?)`;
- `Revision.EntityId` (`Guid`) and `AuditLogEntry.EntityId` (`string`).

CI job `api` is the first compile.

## 6. CI evidence (condition 3, plan 5.4)

GitHub Actions is blocked by a billing problem on the owner's account, as the
coordinator reported, so no workflow has run on PR #57 or on `change/ADM-05`. These rows
are **pending**, and the coordinator will record them:

| Run | Expected | State |
| --- | --- | --- |
| `change/ADM-05-red` at `63c15dc`, job `api` | T1, T2, T3, T4, T5, T6, T7 and T9 fail, each at its assertion. T8, T10, T11 and every existing test pass | PENDING (Actions blocked) |
| same, job `studio` | Unit tests pass. E1 fails at step 1, "publish error-404 at set-up". Every other spec passes | PENDING |
| same, job `website` | green | PENDING |
| final head: `ci.yml` jobs `api` (TRX total), `website`, `studio` (unit and end-to-end), `section-compare`, `website-browser`; `security.yml`; `workflow-lint.yml` | all green; T3, T4 and E1 green (condition 10) | PENDING |

## 7. Red and green evidence (local)

**S1 to S7, red at `d35fdd8`:**

```
$ npx vitest run test/errorPages.test.tsx; echo exit=$?
     × shows each page's state
     × publishes with the page's version and reloads
     × will not publish unsaved edits
     × lists what blocks a publish
     × says a save on a published page is a draft
     × a stale publish says someone else changed the page
     × lists what blocks a save
S1: Unable to find an element with the text: draft, which matches selector '.status-chip'.
S2, S3, S4, S6: Unable to find an accessible element with the role "button" and name "Publish"
S5: expected "vi.fn()" to be called with arguments:
-   "404 page saved as a draft. Publish to put it on the website.",
+   "404 page saved.",
S7: Unable to find an element with the text: One or more fields are invalid..
      Tests  7 failed (7)
exit=1
```

**S1 to S7, green at `a3a94d7`:**

```
$ npx vitest run test/errorPages.test.tsx --reporter=verbose; echo exit=$?
 ✓ ... > shows each page's state
 ✓ ... > publishes with the page's version and reloads
 ✓ ... > will not publish unsaved edits
 ✓ ... > lists what blocks a publish
 ✓ ... > says a save on a published page is a draft
 ✓ ... > a stale publish says someone else changed the page
 ✓ ... > lists what blocks a save
      Tests  7 passed (7)
exit=0
```

T1 to T11 and E1: NOT RUN locally (section 5). CI is pending (section 6).

## 8. Conditions of gate 1

| # | Condition | State |
| --- | --- | --- |
| 1 | Base, ADM-10 merged (merge, not rebase), ancestry quoted, suites re-run after the merge | Met for what can run here (section 2). The API and E2E re-runs after the merge are NOT RUN, so CI job `api` and `studio` cover them |
| 2 | Scope: only the section 4 files; no existing `ContentStore` method changed; no migration; `AdminApiTests` contract test unchanged | Met: `git diff --stat 0b3ef34 e8dc356` lists only the five source files of section 4 (`AdminStore.cs`, `ContentStore.cs`, `PublishChecks.cs`, `AdminControllers.cs`, `ErrorPagesPage.tsx`); the three new test files are in commits 1 and 2 |
| 3 | O-ADM05-2: nothing pushed until the answer is quoted; then commit 1 alone first | Answer quoted (section 1). The coordinator pushed. This session pushed nothing. CI red pending (section 6) |
| 4 | O-ADM05-1: commit 5 only after the answer; (a) keyed on `pages` and the two slugs; T8 `noIndex: true` | Met |
| 5 | Sent-flag pattern, only under (c) | Not applicable: the answer is (a) |
| 6 | Tests as in 5.1; helper restores; no audit deletes; no elevated connection; Release; only the test catalogs; ports 42xx | Met in the code. Release runs NOT RUN here (section 5) |
| 7 | ADM-04 held off `AdminStore.cs` and `AdminControllers.cs` until ADM-05 merges | For the coordinator |
| 8 | Commit subjects per 5.2, one topic each, trailers | Met. Commit 5's subject names the answer |
| 9 | PR body: B1 to B9, the O-ADM05-1 answer, the rollback step, the slug-rename finding | For whoever opens the PR. A draft is in section 10 |
| 10 | Gate 2 waits on CI for T3, T4 and E1 on the final head | Pending (section 6) |

## 9. Points for the tester

1. **Nothing in C# is compiled or run yet.** If CI job `api` fails to compile, the cause
   is in commits 1, 3 or 5.
2. **T8** is written for (a), with `noIndex: true`, which matches the owner's answer.
3. **E1's set-up** uses `POST /pages/{id}/sections`, not `PUT /pages/{id}/save`
   (section 4).
4. **Escaping in stored fields.** In commit 3 the saved section fields are re-serialised
   with `JsonNode.ToJsonString(ContentJson.Options)`. The default encoder escapes
   characters such as `"` inside the body string as `"`. The value is the same
   once parsed, but the raw stored JSON differs from what a Pages save stores.
5. **The screen's reload keeps the other card's unsaved edits** (section 4). This goes
   slightly beyond the text of 3.5. S tests do not cover it.

## 10. Draft for the pull request body (condition 9)

- **Behaviour changes, for the owner** (plan section 9):
  - B1: Save on a published 404 or 500 page is a draft, live only at Publish.
  - B2: `GET /api/v1/error-pages` shows the draft, with `status`, `state`,
    `hasWorkingCopy`, `publishedAt` and `notice`.
  - B3: the save refuses an image not in the library (400, `media`).
  - B4: the save runs the page save's checks: the `rich_text` schema, a title of at most
    300 characters, and the redirect-source check on `/error-404` and `/error-500`.
  - B5: the audit entry is `update_error_page` on `page` with the page id. It was
    `error_page` with `404` or `500` and the title.
  - B6: the text section's `eyebrow` and `blocks` are kept.
  - B7: the screen has a status chip and Publish, and lists what blocks a publish or a
    save.
  - B8: O-ADM05-1 (a), the meta-description rule skipped for the two error pages only.
  - B9: the refusal titles become the page save's: 409 "This item was changed by someone
    else.", 404 "That item does not exist.", 400 "One or more fields are invalid." with
    page-save field keys.
- **O-ADM05-1:** "Yes, only 404 and 500" (owner, card, 12 November 2026 11:56 UTC, as
  relayed by the coordinator).
- **Rollback:** revert the PR. Before the revert, or right after it and before anyone
  saves on the Error pages screen, open Pages and, for `error-404` and `error-500` if
  the chip reads "changed", publish it or "Discard draft". Then check that neither reads
  "changed" (plan section 8).
- **New finding for the audit:** an error page's slug can be renamed through Pages,
  after which the screen and the build lose the page. It is not fixed here.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Saves on the error pages go through the draft flow: a published page changes only at Publish | ADM-05, Fix 1; bullet 4; `phase-b-studio.md` 3.4 | Done (CI pending) | `71edc31`; T1, T4, E1 (`63c15dc`); CI pending (section 6) |
| The screen shows each page's state | ADM-05, Fix 2 | Done | `a3a94d7`; S1 red to green (section 7); T2 CI pending |
| The screen can publish each page | ADM-05, Fix 2; bullet 1 | Done | `a3a94d7`; S2, S3, S6 red to green; E1 CI pending |
| The screen lists what blocks a publish | Plan 3.5 | Done | `a3a94d7`; S4 red to green |
| The meta-description rule, as the owner decides | ADM-05, Fix 3; O-ADM05-1 = (a) | Done (CI pending) | `e8dc356`; T3, T4, E1 (red at base), T8 guard; CI pending |
| Publishing through Pages is no longer blocked for these pages | ADM-05, bullet 3 | Done (CI pending) | `e8dc356` applies to every publish of these pages; T3 and T4 use the page publish route |
| The error-page save refuses an image not in the library | ADM-03 `implementation.md` section 11 | Done (CI pending) | `71edc31` (`MutateAsync` → `CheckAsync`, `requireMedia` default true); T5 |
| Error-page saves are no longer a separate write path | ADM-02 `plan.md` line 675 | Done | `71edc31`: `AdminStore.UpdateErrorPageAsync` removed; the save is `MutateAsync` |
| A save keeps the text section's other fields | Plan 2.3 | Done (CI pending) | `71edc31`; T6 |
| `GET` and `PUT` never create an error page; HR cannot reach them | `AdminApiTests`; roles | Done (CI pending) | `AdminApiTests` unchanged; T11; routes and policy unchanged (`71edc31`) |
| Regression tests committed and shown failing before the fix | G3 checklist | Partly: S1 to S7 shown red locally. T1 to T7, T9 and E1 red waits on CI | `63c15dc` on `change/ADM-05-red`, PR #57; section 6 PENDING |
| An end-to-end test of save-as-draft and publish on the screen | G3-1 exit gate | Written (CI pending) | `63c15dc`; section 6 |
| An API build gets past `prepare.ts:44-48` once both pages are published | ADM-05, bullet 2 | Possible after merge; the `DigitalHubContent_Studio` run waits on O-ADM05-3 and O-ADM02-2 | `e8dc356` with `a3a94d7`; not run |
| G3-1 exit gate: a clean build from `DigitalHubContent_Studio` | Refinement plan line 225 | Batch gate, not this change alone | Not run |
| FR-S-21 moves from "Partly" to "Works" | Audit line 46 | Done in code (CI pending) | Commits 3 to 5 |
| A refused save lists its fields on the screen | Review round 1, finding 4 | Done | `a3a94d7`; S7 red to green |
| The meta description field (only under (c)) | O-ADM05-1 (c) | Moved: not needed, the answer is (a) | Section 1 |
| Shared-file order: ADM-10 merged into `change/ADM-05` before commit 3 | `AGENTS.md`; review round 1, finding 1 | Done | Section 2: `0b3ef34`, `merge-base --is-ancestor 2bbd586 HEAD` exit 0 |

Status: READY FOR TEST
