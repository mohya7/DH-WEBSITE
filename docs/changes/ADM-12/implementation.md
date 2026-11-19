# ADM-12 implementation

Round 1. Plan `plan.md` round 1 (commit `72dbcc4`), approved in `plan-approval.md` (`Verdict: APPROVED`). Branch `change/ADM-12`, not pushed.

Owner's request: "ADM-12 make alt text impossible to bypass in the media library"

## Commits

| SHA | Subject |
| --- | --- |
| `b9f317e` | ADM-12: Add failing tests for decorative-with-no-alt on a used image (tests only) |
| `2327a47` | ADM-12: Refuse blanking alt text an image's uses rely on (the fix) |
| (this record) | ADM-12: Record the implementation |

## What changed, by Scope item

- `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs` (red commit). Plan tests 1-5:
  - `Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it`
  - `Each_kind_of_use_without_its_own_alt_blocks_the_edit`
  - `Uses_with_their_own_alt_or_marked_decorative_do_not_block_the_edit`
  - `An_unused_image_can_be_marked_decorative_with_no_alt`
  - `A_refused_edit_writes_no_audit_entry`

  The file also gets the helpers `PageWithHeroAsync`, `SetSectionImageAsync`, `BlogAsync`, `ClearUsesAsync`, `Usages`, `Heading` and `AltEditor`. Test 2 tries all five kinds (page share image, site settings default share image, section, blog body, working copy `fields.imageId`) and then reports every kind that was not refused, so a run names them all. The new tests upload as a dedicated editor, `media-alt-editor@digitalhub.test`, because the upload limit is 20 per user per hour (`Program.cs:141-146`). On the first red run they shared `media-editor` and pushed the existing `Upload_requires_alt_text_unless_the_image_is_decorative` to 429. I reported that and fixed it in the test before the red commit; no limit or gate was changed.
- `studio/test/mediaLibrary.test.tsx` (new, red commit). Plan test 6.
- `api/src/DigitalHub.Api/Content/MediaUsage.cs`. Adds `FindPlacesWithoutOwnAltAsync`, built from the same sources as `FindPlacesAsync`:
  - share images and `ImageId`, filtered to a blank override;
  - site settings `DefaultShareImageId` with a blank `DefaultShareImageAltOverride`;
  - blog bodies, sections and working copies, parsed and walked with the publish check's `WalkMedia` rule (a `mediaId` match that is not `decorative: true` and has no non-blank `alt`);
  - in working-copy documents, also `shareImageId` + `shareImageAltOverride` and `fields.imageId` + `fields.imageAltOverride`.

  The blog-body walk is defence in depth: the save validation already refuses a body image with no alt (condition 3).
- `api/src/DigitalHub.Api/Content/MediaLibrary.cs`. When the edit would leave `decorative && blank alt`, `UpdateAsync` calls the new method; if it finds places, it returns `MediaOutcome.AltInUse(places)`, which is 409, code `alt_in_use`, the title "Add alt text: this image is used without alt text of its own.", and `usages`. Nothing is saved and no audit row is written. `AltInUse` sits beside `InUse`.
- `studio/src/pages/MediaLibraryPage.tsx`. When `save()` is refused with `alt_in_use`, it shows the title followed by the places, joined with "; ", as `remove()` does.

The change touches no other source file (condition 5). `PublishChecks.cs`, `website/`, users files and error-pages files are untouched. There is no migration.

## Commands run

All from `D:\work\DigitalHub\dh-platform-claude-adm-12`. The API tests ran against `DigitalHubContent_Test` through the test factory. I checked that no other test host was running first.

**Red run** (test commit `b9f317e`, unfixed code):

- `cd studio && npx vitest run test/mediaLibrary.test.tsx`: exit 1. `getAllByText(/blog-posts 1111…/)` found nothing. The title renders and the places do not: "Tests 1 failed (1)".
  - The first attempt failed on a test-setup selector (`getByLabelText("Alt text")` is not wired to the input). I fixed that to `getByDisplayValue` before this run and recorded it here.
- `cd api && dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors, 13 warnings (the same count as the base).
- `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests`: exit 1. "Failed: 3, Passed: 16, Total: 19":
  - `Marking_a_used_image_decorative...`: `Expected: Conflict  Actual: OK`
  - `A_refused_edit_writes_no_audit_entry`: `Expected: Conflict  Actual: OK`
  - `Each_kind_of_use...`: `page share: 200; site settings: 200; section: 200; blog body: 200; working copy: 200`

This red evidence was seen locally. The API integration harness runs locally against `DigitalHubContent_Test`; only the e2e harness is broken. No CI run was needed for the red evidence, and nothing was pushed.

**Green run** (fix commit `2327a47`):

- `dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors, 13 warnings.
- `dotnet test ... --filter FullyQualifiedName~MediaLibraryTests`: exit 0, "Passed: 19, Total: 19".
- `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build` (full suite):
  - First run: exit 1, "Failed: 2, Passed: 560". Both failures were `ApiAcceptedContentTests` with "Run npm ci in website/ first.", an environment gap in a fresh worktree that my change did not cause.
  - Ran `npm ci` in `website/`. The lockfile was untouched.
  - Rerun: exit 0, "Passed: 562, Total: 562".
- `cd studio && npm test`: exit 0, "Test Files 15 passed, Tests 110 passed". Condition 2: `studio/package.json` has no `typecheck` or `lint` script, so `npm test` and `npm run build` stand in for them; the build runs `tsc -b`.
- `cd studio && npm run build`:
  - First run: exit 1, "VITE_PUBLIC_SITE_URL is not set" (environment).
  - Rerun with `VITE_PUBLIC_SITE_URL=https://website.ci.invalid`, the value `ci.yml:244` uses: exit 0, "built", and the preview design check matches.

**NOT RUN:**

- Playwright e2e: the local e2e harness is broken. Covered by CI on the pull request (condition 6); gate 2 holds it open.
- The manual reproduction in `DigitalHubContent_Studio` and the G3-1 clean website build from `DigitalHubContent_Studio`: I was told not to write shared databases other than `DigitalHubContent_Test`, and neither runs without a Studio and API stack on 42xx against that database. Left for the tester or owner review.
- CI (API, Website, Studio jobs, Security, Workflow lint): the branch is not pushed. It runs when the owner confirms the push.

## Migrations

None.

## Accepted risk (condition 4)

Check-then-save race: a use with no alt of its own can be saved between the usage check and the library save, so the asset ends up decorative with blank alt while that use relies on it. This is accepted. That use still fails the publish check at its own publish, so it cannot reach the site through a new publish. An item that is already published and re-saved concurrently could still render with empty alt until its next publish; this needs two editors acting within milliseconds.

## Owner decision O-1 (relayed)

The orchestrator session (`local_23423d93-6e78-4e5d-8d70-f7daa2f37ea4`) relayed this. On 19 November 2026, in the orchestrator's Claude Code session, the owner was asked: "Take the recommended defaults for all three questions?" For ADM-12 O-1 ("Should media library edits wait for a publish step (ADM-12b, with a schema change), or is live-on-save acceptable for library metadata?"), the recommended default was "Live-on-save: library details change as soon as they're saved, with no schema change". The owner answered: "Yes, defaults". Live-on-save is therefore accepted for library metadata, and no ADM-12b is needed. This does not change the plan.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Used image cannot be saved decorative with no alt (refused, nothing saved) | Audit ADM-12, lines 204-206 | Done | Test 1: red 200 at `b9f317e`, green 409 + alt unchanged at `2327a47`. Test 5: no audit row. |
| Refusal applies while any use has no per-use alt, every use kind | Audit ADM-12, lines 207-208 | Done | Test 2: all 5 kinds 200 at `b9f317e`, all 409 with place at `2327a47`. Card image in test 1. |
| Uses with own alt or per-use decorative do not block | Design, section 3 | Done | Tests 3 and 4 pass before and after. |
| Studio shows the places that need alt | Design, section 3 | Done | `studio/test/mediaLibrary.test.tsx`: red at `b9f317e`, green in `npm test` (110/110). |
| Regression test committed and shown failing before the fix | README G3 checklist; refinement plan line 225 | Done | `b9f317e` holds the tests only; the red output is under Commands run. |
| Clean website build from DigitalHubContent_Studio, no patched content | Refinement plan line 225 | Open: NOT RUN | Needs a Studio-database build (tester or owner); no shared database written by this agent. |
| API and e2e tests on CI, final head | plan-approval condition 6 | Open | Runs on the pull request after the owner confirms the push. |
| "Library edits go live without publishing" | Audit ADM-12 title, line 203 | Closed by owner decision O-1 (live-on-save accepted) | Relayed decision quoted above. No ADM-12b. |

Status: READY FOR TEST

## Round 2

Sent back by the owner via the coordinator, as a delivery finding on PR #70. The finding: CI CodeQL alert 4, `js/incomplete-sanitization` (high), at `studio/test/mediaLibrary.test.tsx:89`. `new RegExp(title.replace(/[.:]/g, "\$&"))` does not escape backslashes. Line 90 built `new RegExp(place)` from data the same way.

**Merge.** `git merge origin/rebuild/dotnet-platform` at 1f8de7a gave merge commit `97da2a6`. It merged cleanly (ADM-04, ADR 0001 and GAP-11, #69 `71b7541`; ISO-1, #71 `522b175`), with no rebase and no conflicts.

**Answer to the finding.** Both assertions now match plain text, `screen.getByText(title, { exact: false })` and `screen.getAllByText(place, { exact: false })`, so no regex is built from data. `grep -c RegExp studio/test/mediaLibrary.test.tsx` returns 0. No other file changed.

**Commands, on the merged tree with the fix:**
- `cd studio && npm ci`: exit 0. The lockfile is unchanged; this only restores node_modules after the merge.
- `npm test`: exit 0, "Test Files 16 passed, Tests 117 passed". The counts grew with the merged ADM-04 tests.
- `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build`: exit 0, "built".
- `cd api && dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors, 13 warnings.
- `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests`, run five times:
  - first, before the test edit applied (it was refused because the file had not been read): exit 0, 19 of 19;
  - second, after the edit: exit 1, "Failed: 1, Passed: 18". I did not capture which test failed or why;
  - third, fourth and fifth, after the edit: exit 0, 19 of 19 each.

  The round-2 change touches only the Studio test file, which the .NET tests do not use, so the one failure came from the API test run itself. It is not reproduced and its cause is unknown. Candidate causes are shared state in DigitalHubContent_Test (another worktree's run) or timing in the rate limiter. The tester should run MediaLibraryTests repeatedly and report any failure with its message.
- NOT RUN: Playwright e2e (broken local harness; CI) and CodeQL (CI only; it runs on the pull request after the push).

Status: READY FOR TEST
