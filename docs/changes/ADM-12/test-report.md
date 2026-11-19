# ADM-12 test report

Owner's request: "ADM-12 make alt text impossible to bypass in the media library"

## Round 1

Commit tested: `b38080c` (head, `change/ADM-12`). The red commit was `b9f317e` and the fix commit was `2327a47`. I tested on a detached worktree, `D:\work\DigitalHub\dh-platform-claude-adm-12-test`, and removed it when I finished. All builds ran in Release. The API tests used `DigitalHubContent_Test` only. Nothing else was writing it. I did not write `DigitalHubContent` and did not open DH-WEBSITE-main.

### 1. Red first

At `b9f317e` (tests only):
- `cd api && dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors.
- `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests`: exit 1, `Failed: 3, Passed: 16, Total: 19`.
  - `Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it`: `Expected: Conflict Actual: OK`
  - `A_refused_edit_writes_no_audit_entry`: `Expected: Conflict Actual: OK`
  - `Each_kind_of_use_without_its_own_alt_blocks_the_edit`: `page share: 200 ...; site settings: 200 ...; section: 200 ...; blog body: 200 ...; working copy: 200 ...`. Each body shows `"alt":"","decorative":true`, which is the bypass itself.
- `cd studio && npm ci && npx vitest run test/mediaLibrary.test.tsx`: exit 1. `Unable to find an element with the text: /blog-posts 11111111-...-111111111111 image/`, `Tests 1 failed (1)`.

Each test fails for the reason the plan gives: a 200 where a 409 is expected, and the title is shown without the places.

### 2. Test plan, at `b38080c`

| Command | Exit | Output |
| --- | --- | --- |
| `cd api && dotnet build DigitalHub.slnx -c Release` | 0 | 13 warnings, 0 errors (the same as the base) |
| `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests` | 0 | `Passed: 19, Total: 19` |
| `cd api && dotnet test -c Release` (full suite; `npm ci` in `website/` first) | 0 | `Passed: 562, Total: 562` |
| `cd studio && npm test` | 0 | `Test Files 15 passed`, `Tests 110 passed` |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built`, "Preview design ... matches website/design/ byte for byte." |
| `studio npm run typecheck` / `lint` | n/a | These scripts do not exist. `build` runs `tsc -b` (plan-approval condition 2). |
| `website` `npm test`, `typecheck`, `build`, `design:check`, `compare:sections` | NOT RUN | `website/` is untouched (scope condition 5). Covered by the CI Website job. |
| Studio `npm run test:e2e` | NOT RUN | The local Playwright harness is broken, so this is CI-pending, not a failure. Covered by the CI Studio e2e job (condition 6). |
| Manual reproduction and G3-1 clean website build from `DigitalHubContent_Studio` | NOT RUN | No Studio/API stack was started against the manual-review database in this step. Owner review or gate 2 (refinement plan line 225). |

### 3. Track checklist (G3)

- The regression test is committed alone (`b9f317e`) and shown failing before the fix (section 1): yes.
- End-to-end test per Major: not applicable (this is a Blocker). The e2e suite runs on CI.
- No migration.

### 4. Security

| Check | Exit | Output |
| --- | --- | --- |
| `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| `cd website && npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities`, below the gate |
| `RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `... run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `cd api && ... run-dotnet-audit.sh` | 0 | `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `... run-semgrep.sh` | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known `AuditRollbackTests.cs:78`) |
| gitleaks | NOT RUN | Not installed locally. Covered by the `security.yml` jobs `gitleaks-pr` and the full-history gitleaks job. |

- Route `PUT /api/v1/media/{id}`: the policy, the binding (`MediaEdit`) and the body handling are unchanged. The change only adds a 409 outcome, which goes through the existing `Respond`/ProblemResults path in RFC 7807 shape, with `code`, `title` and `usages`, and no internals. The role matrix is unchanged; existing tests cover editor and admin access, 404 on an unknown id, and editor 403 on delete. There is no new route, and the host checks are unchanged.
- `usages` exposes only collection and id place strings, which the same roles already see on delete.
- Secrets: I grepped the diff `8b5d6a5..b38080c` for password, secret, token and connection strings. The only hits are `cancellationToken`. No secret appears in the output.

### 5. Beyond the plan (code review of `MediaUsage.FindPlacesWithoutOwnAltAsync` against `PublishChecks`)

- Whitespace-only alt with `decorative: true` is caught by `IsNullOrWhiteSpace`. Null or omitted alt is caught too.
- The new rule matches the publish check. `EffectiveAlt(override, asset.Alt)` ignores `asset.Decorative`, and `WalkMedia` requires a per-use decorative flag or a non-blank alt. So a decorative asset with blank alt that is added to a new card or section use is still refused at publish. Reverse order (blank the asset first, then use it) is safe for published content.
- Revision restore writes a working copy or draft that is checked at publish, so it is not a bypass.
- Records hold the published state and working copies hold drafts. Both are scanned.
- Concurrent edit (check-then-save race): accepted risk, recorded in `implementation.md`. Not retested.

### Findings

1. **Minor: the site settings default share image can still be pointed at a decorative, blank-alt asset.**
   - Steps:
     1. Upload an image and leave it unused.
     2. `PUT /api/v1/media/{id}` `{ "alt": "", "decorative": true }` returns 200 (allowed, test 4).
     3. Save site settings with `defaultShareImageId = id` and no `defaultShareImageAltOverride`. `AdminStore.cs:245-247` checks only that the id exists.
   - Expected: the save is refused, as the reverse edit is now refused with `alt_in_use`, `site-settings ... default share image`.
   - Actual: 200, and the state the new rule forbids is reached in the other order.
   - Impact is limited: `website/src/seo/head.ts:92` falls back to the document title for `og:image:alt`, so the site never ships empty share-image alt. That is why this is Minor. It is an inconsistency with "impossible to bypass" rather than shipped empty alt.
2. **Minor (note): existing data is not repaired.** Assets already decorative with blank alt while a use relies on them (if any exist in `DigitalHubContent_Studio`) are unchanged, and caption-only edits on them now return 409 until alt is added. This is the intended effect, but the G3-1 clean build from `DigitalHubContent_Studio` is the only check that shows no such data exists, and it is NOT RUN.

No Blocker or Major.

### Coverage rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Used image cannot be saved decorative with no alt (refused, nothing saved) | Audit ADM-12, lines 204-206 | Verified | Test 1 and test 5: red 200 at `b9f317e`, green at `b38080c` |
| Refusal applies while any use has no per-use alt, every use kind | Audit ADM-12, lines 207-208 | Verified | Test 2: all 5 kinds 200 at red, 19/19 at head |
| Uses with own alt or per-use decorative do not block | Design, section 3 | Verified | Tests 3 and 4 pass at both commits |
| Studio shows the places that need alt | Design, section 3 | Verified | Vitest red at `b9f317e`, 110/110 at head |
| Regression test committed and shown failing before the fix | README G3 checklist | Verified | Section 1 |
| Clean website build from DigitalHubContent_Studio | Refinement plan line 225 | NOT RUN | Owner or gate 2 |
| API and e2e on CI, final head | plan-approval condition 6 | CI-pending | Not pushed |

Verdict: APPROVED

## Round 2

Commit tested: `b514d17` (head, `change/ADM-12`). It holds the CodeQL fix (`js/incomplete-sanitization`, `studio/test/mediaLibrary.test.tsx:89`, PR #70) on top of merge `97da2a6`, which merged `origin/rebuild/dotnet-platform` at `522b175`. The merge brings in ADM-04 `bf87bc3`, ADR 0001 `cdef7c9`, GAP-11 `71b7541` and ISO-1 `522b175`. `git merge-base --is-ancestor 522b175 97da2a6` succeeds.

I tested on a detached worktree, `D:\work\DigitalHub\dh-platform-claude-adm-12-test-r2`, and removed and pruned it when I finished. The requested path `D:\work\DigitalHub\dh-platform-claude-adm-12-test` was not a registered worktree. It still held a stub, `studio/node_modules/@digitalhub`, left over from round 1, so `worktree add` refused it. I left that stub in place and used the `-r2` path. All builds ran in Release. The API tests used `DigitalHubContent_Test` only. Before the runs, no `testhost.exe` was running and the only `dotnet.exe` processes were idle MSBuild nodes. I did not write `DigitalHubContent` and did not open DH-WEBSITE-main. No ports were opened.

### 1. The fix: no RegExp built from data

- `git show b514d17 -- studio/`: the two assertions changed from `new RegExp(title.replace(/[.:]/g, "\\$&"))` and `new RegExp(place)` to `screen.getByText(title, { exact: false })` and `screen.getAllByText(place, { exact: false })`.
- `grep -c RegExp studio/test/mediaLibrary.test.tsx`: `0`.
- The check still has teeth. The title (`"Add alt text: this image is used without alt text of its own."`) and both place strings (`"blog-posts 1111...1111 image"`, `"pages 2222...2222 share image"`) are unique. The mocked detail returns `usages: []`, and the page shows "This image is not used." before Save. So the places can only appear from the 409 `alt_in_use` body. A substring match on them is as strict as the old regexes, which had no anchors.
- Other `new RegExp` uses in Studio tests: `studio/test/webConfig.test.ts:63,70`. These lines have been on the base since #31 (`76d0f69`); this change did not touch them. They are out of scope and are not a new CodeQL surface.

### 2. Test plan, at `b514d17`

| Command | Exit | Output |
| --- | --- | --- |
| `cd website && npm ci` | 0 | Restored node_modules for the API suite's website-dependent tests. |
| `cd studio && npm ci` | 0 | Lockfile unchanged. |
| `cd studio && npm test` | 0 | `Test Files 16 passed (16)`, `Tests 117 passed (117)` |
| `cd studio && npx vitest run test/mediaLibrary.test.tsx` | 0 | `Tests 1 passed (1)` |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built in 1.04s`, "Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte." |
| `cd api && dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` (the same as round 1) |
| `cd api && dotnet test -c Release --no-build` (full suite, merged tree) | 0 | `Passed! - Failed: 0, Passed: 583, Skipped: 0, Total: 583, Duration: 1 m 50 s` |
| `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests`, 8 sequential runs | 0 each | Runs 1 to 8: `Failed: 0, Passed: 19, Total: 19` each (4 to 9 s) |
| `website` `npm test`, `typecheck`, `build`, `design:check`, `compare:sections` | NOT RUN | The ADM-12 diff against the base (`git diff 522b175 b514d17`) does not touch `website/`. The merge's website changes belong to the base. Covered by the CI Website job. |
| Studio `npm run test:e2e` | CI-pending | The local Playwright harness is broken. This is recorded as pending on CI, not as a failure. Covered by the CI Studio e2e job. |
| CodeQL | CI-pending | Runs only on the pull request after the push. It should confirm that alert 4 is closed. |

The merge does not touch ADM-12's files: `git diff --stat 1f8de7a 97da2a6` on `MediaLibrary.cs`, `MediaUsage.cs`, `MediaLibraryTests.cs`, `MediaLibraryPage.tsx` and `mediaLibrary.test.tsx` is empty. The ADM-12 diff against the base, `git diff --name-only 522b175 b514d17`, lists only the eleven ADM-12 files (the API, Studio and test files, plus `docs/changes/ADM-12/`).

### 3. Cause of the developer's 1-of-19 failure (beyond the plan)

I ran MediaLibraryTests in two processes at once, twice (A and B in parallel, on `DigitalHubContent_Test`):

- Round 1: A exit 1, B exit 0. Round 2: A exit 1, B exit 0. Each failing run showed `Failed: 1, Passed: 18, Total: 19`.
- The failing test both times: `MediaLibraryTests.Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it`.
  - Run A1: `Assert.Equal() Failure: Values differ / Expected: Created / Actual: OK` at `MediaLibraryTests.cs:line 328` (the upload).
  - Run A2: `Expected: Created / Actual: BadRequest` at `MediaLibraryTests.cs:line 340` (the blog-post create).

Mechanism: the test runs `RemoveAsync(bytes)` and then uploads fixed pixels (`Encode(Png, 19, 17, 141)`). The API deduplicates uploads by content hash. When two processes run at once, the second upload finds the first one's asset and returns 200, not 201. Or the other process's `finally` (`ClearUsesAsync`/`DeleteMediaAsync`) removes the asset before the blog post is created, which gives 400. Each sequential run passed (8 of 8). This matches the developer's hypothesis of a concurrent run from another worktree on the shared database. It is a test-isolation limit, not a product defect. CI runs one process per database. See finding 1.

### 4. Security

| Check | Exit | Output |
| --- | --- | --- |
| `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| `cd website && npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities` (`fast-uri` 3.0.0-3.1.8, `next` 16.2.0-16.4.4), below the gate |
| `cd website && RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `cd studio && RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `cd api && RUNNER_TEMP=<scratch> bash ../.github/security/run-dotnet-audit.sh` | 0 | `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `RUNNER_TEMP=<scratch> bash .github/security/run-semgrep.sh` | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known `AuditRollbackTests.cs:78`; also the known warning at `ContentImport/Catalog.cs:84`) |
| gitleaks | NOT RUN | Not installed locally. Covered by the `security.yml` jobs `gitleaks-pr` and the full-history gitleaks job. |

- Routes: round 2 adds no route and changes no route. The only code change is a Studio test assertion. The round 1 route review of `PUT /api/v1/media/{id}` (role matrix, RFC 7807 409 shape, no internals) still holds, because the merge does not touch `MediaLibrary.cs` or `MediaUsage.cs`.
- Secrets: I grepped the `git diff 522b175 b514d17` additions for password, secret, apikey, token, connection strings, `Server=` and private keys. There were no hits. No secret appears in any output.

### Findings

1. **Minor: MediaLibraryTests fails when two runs share `DigitalHubContent_Test` at the same time.**
   - Steps: in `api/`, start `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests` in two shells at once.
   - Expected: both runs pass, or the suite documents that it needs a database to itself.
   - Actual: one run fails `Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it`, with `Expected: Created, Actual: OK` (line 328) or `Actual: BadRequest` (line 340). It reproduced 2 of 2 times. The cause is fixed image bytes plus content-hash deduplication and a cross-process `RemoveAsync`/`finally` cleanup. This explains the developer's unexplained 1-of-19 failure. Sequential runs pass 8 of 8 and the full suite passes. CI is not affected.
2. **Minor (record): `implementation.md` round 2 lists the merge as "ADM-04, ADR 0001 and GAP-11" and omits ISO-1 (#71, `522b175`).** `97da2a6` contains `522b175`. The record should name all four.
3. Round 1 findings 1 (the site settings default share image can point at a decorative, blank-alt asset) and 2 (existing data is not repaired) are unchanged by round 2 and remain open as Minor.

No Blocker or Major.

### Coverage rows verified (round 2)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| CodeQL js/incomplete-sanitization at `mediaLibrary.test.tsx:89`: no RegExp from data | PR #70 alert 4 | Verified | `grep -c RegExp` = 0; diff in section 1 |
| The Studio test still proves the places are shown | Design, section 3 | Verified | Unique strings, `usages: []` pre-save; `npx vitest run test/mediaLibrary.test.tsx` 1 passed |
| Studio npm test and build on the merged tree | Test plan | Verified | 117/117; build exit 0 |
| Full API suite on the merged tree, Release | Test plan | Verified | 583/583 |
| MediaLibraryTests stable on at least 5 separate runs | Coordinator, round 2 | Verified | 8 of 8 sequential runs, 19/19 each; concurrent failure explained (finding 1) |
| Merge does not alter ADM-12 behaviour | Merge `97da2a6` | Verified | Empty diff on ADM-12 files `1f8de7a..97da2a6` |
| Security audits, semgrep | README checklist | Verified | Section 4; gitleaks NOT RUN (CI `gitleaks-pr`) |
| API and e2e and CodeQL on CI, final head | plan-approval condition 6 | CI-pending | Not pushed |

Verdict: APPROVED
