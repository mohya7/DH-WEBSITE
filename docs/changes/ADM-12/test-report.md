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
