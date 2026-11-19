# ADM-12c test report

Owner's request: "ADM-12c Refuse a decorative, blank-alt asset as the default share image without an override".

## Round 1

- Commit tested: `67ecaa5` (head of `change/ADM-12c`). Red commit `de1324c`, fix commit `29e84ec`. `git diff --stat 29e84ec 67ecaa5` changes only `docs/changes/ADM-12c/implementation.md`.
- Where: a detached worktree, `git -C D:\work\DigitalHub\dh-platform worktree add --detach D:\work\DigitalHub\dh-platform-claude-adm-12c-test 67ecaa5`, removed at the end (`git worktree remove --force`, then the dangling `studio/node_modules/@digitalhub/theme` link and `worktree prune`).
- Records read: `docs/changes/README.md`, `plan.md` (round 2), `plan-review.md` (Rounds 1-2), `plan-approval.md` (conditions 1-11), `implementation.md`.
- Databases: integration tests on `DigitalHubContent_Test` only. `DigitalHubContent_Studio` read with SELECT only and `sqlcmd -K ReadOnly` (condition 8). `DigitalHubContent` was not opened. `DH-WEBSITE-main` was not opened. No ports used: no server was started.
- Scope: `git diff --stat dad04a4 67ecaa5` lists exactly the six planned files plus `implementation.md` (541 insertions, 6 deletions). No PR #70 file, `PublishChecks.cs`, `ContentWriter.cs`, `AltText.cs`, `website/` or `.github/` file is touched (condition 6).

### 1. The red test was red

At `de1324c` (tests only; `git diff --stat dad04a4 de1324c` lists only the three test files), from `api/`:

| Command | Exit | Output |
| --- | --- | --- |
| `dotnet tool restore` | 0 | |
| `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Error(s)` |
| `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~SettingsShareImageTests\|FullyQualifiedName~ContentBundleTests"` | 1 | `Failed! - Failed: 6, Passed: 40, Skipped: 0, Total: 46` |

The six failures, each for the reason the plan gives:

```
Failed SettingsShareImageTests.A_decorative_image_with_blank_alt_and_no_override_is_refused_and_changes_nothing   Expected: BadRequest  Actual: OK
Failed SettingsShareImageTests.Clearing_the_stored_override_of_a_blank_alt_image_is_refused                       Expected: BadRequest  Actual: OK
Failed SettingsShareImageTests.A_non_decorative_image_with_blank_alt_is_refused_too                               Expected: BadRequest  Actual: OK
Failed SettingsShareImageTests.A_save_without_share_fields_over_a_stored_bad_pair_is_refused                      Expected: BadRequest  Actual: OK
Failed SettingsShareImageTests.A_whitespace_override_does_not_count_as_alt                                        Expected: BadRequest  Actual: OK
Failed ContentBundleTests.A_default_share_image_without_alt_text_of_its_own_is_not_imported                        Expected: False  Actual: True
```

Guards 6-8 and 10 passed. From `studio/` after `npm ci` (exit 0, `found 0 vulnerabilities`):

| Command | Exit | Output |
| --- | --- | --- |
| `npx vitest run test/settingsShareImage.test.tsx` | 1 | `× a refused save shows the field error under the default share image alt text`; `TestingLibraryElementError: Unable to find an element with the text: This image has no alt text of its own. Add alt text for the default share image.`; `Tests 1 failed \| 4 passed (5)` |

That matches the plan and condition 1: 6 API failures and 1 Studio failure. At the head all of them pass (section 2).

### 2. The test plan, at `67ecaa5`

| Where | Command | Exit | Output |
| --- | --- | --- | --- |
| `api/` | `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |
| `api/` | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` (full suite, `DigitalHubContent_Test`) | 0 | `Passed! - Failed: 0, Passed: 586, Skipped: 0, Total: 586` |
| `studio/` | `npm ci` | 0 | `found 0 vulnerabilities` |
| `studio/` | `npx tsc -b` | 0 | no output |
| `studio/` | `npm test` | 0 | `Test Files 15 passed (15)`, `Tests 117 passed (117)` |
| `studio/` | `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built in 931ms`; `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| `studio/` | `npm run test:e2e` / `npx playwright test` | NOT RUN | The local e2e harness is broken (caller's brief). Pending on CI: the CI job "Studio — typecheck, build, end-to-end", step "End-to-end suite" (`.github/workflows/ci.yml`), where `studio/e2e/settings.spec.ts` must stay green. Not a failure. |
| `website/` | `npm ci` | 0 | |
| `website/` | `npm test` | 0 | `Test Files 24 passed (24)`, `Tests 461 passed \| 1 skipped (462)` |
| `website/` | `npm run typecheck` | 0 | |
| `website/` | `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` (the env the CI "Snapshot build" step sets) | 0 | `Build output checks passed.` A first run without those two variables exited 1 (`No content source is configured` / `PUBLIC_SITE_URL is not set`), which is the build refusing a missing setting, not a defect. |
| `website/` | `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `website/` | `npm run compare:sections` | NOT RUN | It reads the old site from the local `DH-WEBSITE-main` checkout, which this brief says not to touch, and no `website/` file changed. CI covers the built site in the Website job ("Upload the built site for the section comparison"). |

### 3. Track checklist (G3)

- [x] The finding, its evidence and its fix come from the audit (ADM-12, `admin-audit-2026-10-28.md:202-208`), its gate-2 follow-up (ADM-12 test-report Minor 1) and the plan review. Plan sections 1-2.
- [x] The regression tests are committed in `de1324c`, before the fix in `29e84ec`, and I saw them fail (section 1).
- [x] End-to-end test for each Major: not applicable, this is a Minor. The existing settings e2e is pending on CI.
- [x] Every Minor left unfixed has a named follow-up: ADM-12d (card-image publish test; empty-`settings` bundle case), in `plan-approval.md`. The new Minor below goes back to the developer.

### 4. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, Studio, full tree | `npm audit --audit-level=high` in `studio/` | 0 | `found 0 vulnerabilities` |
| npm audit, website, full tree | `npm audit --audit-level=high` in `website/` | 0 | `2 moderate severity vulnerabilities`, none High or Critical |
| npm audit gate, website | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| npm audit gate, Studio | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| NuGet audit | `RUNNER_TEMP=<scratch> sh ../.github/security/run-dotnet-audit.sh` in `api/` | 0 | `DigitalHub.Api`, `DigitalHub.Api.Tests`, `DigitalHub.ContentImport`: no vulnerable packages; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` from the root | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known `csharp-sqli` in `AuditRollbackTests.cs:78`). It also says `Known but no longer found (remove from known-findings.json): ...unsafe-path-combine:api/tools/DigitalHub.ContentImport/Catalog.cs:84`. `Catalog.cs` is not in this change, so that stale entry predates it; noted for the owner of `known-findings.json`, not a finding here. |
| gitleaks | NOT RUN | | gitleaks is not installed on this machine. Covered by the `security.yml` jobs `gitleaks-pr` ("Secret scan (gitleaks, this pull request's commits)") and `gitleaks-history`. |
| Secrets in the diff | `git diff dad04a4 67ecaa5 \| grep -inE "^\+.*(password\|secret\|apikey\|api_key\|token\|connectionstring\|BEGIN .*PRIVATE\|Server=\|Pwd=)"` | 0 | Two hits, both `cancellationToken`. No secret in the diff, the logs or the output. |

Route `PUT /api/v1/settings` (behaviour changed: one more 400 field error; route, controller and policy unchanged):

- **Role matrix.** The controller is `[Authorize(Policy = "studio")]` with `[Authorize(Policy = "studio-admin")]` on `Put` (`AdminControllers.cs:53-64`, unchanged). In the full suite at `67ecaa5`, all green: the endpoint-wide matrix in `CareersTests` (anonymous 401; editor blocked on `PUT /api/v1/settings`, `EditorBlocked` at `CareersTests.cs:544`), `AdminApiTests.cs:227` and `CookieSettingsTests.cs:94` (editor PUT is 403). The Studio test "an editor sees the share image but cannot change it" passes. "Wrong record" does not apply: settings is a singleton.
- **Host checks.** No route was added or moved, and this change touches no host or routing code. Not re-tested beyond the full suite.
- **Error shape.** A refusal goes through `Validation(errors)` and `AdminResponse.From`, which returns `ValidationProblemDetails` with `type: https://tools.ietf.org/html/rfc7807`, `code: validation_failed`, `application/problem+json` (`AdminControllers.cs:166-190`). The message is the fixed sentence "This image has no alt text of its own. Add alt text for the default share image." It carries no ids, paths or stack. The importer problem line carries the settings row id and the field name, which is the tool's existing format for an operator.
- **Unknown fields and body size.** This change does not touch them. By code reading, `PUT /api/v1/settings` has no `RequestBodyLimit` and no `UnmappedMemberHandling` setting, so the existing behaviour (unknown members ignored, Kestrel's default cap) stays as it was before this change. Not a finding against ADM-12c.
- **Login or permission change.** None.
- **Import tool.** One more blocking problem. Its access and `--force` rules are unchanged. The forced run in test 9 asserts `Conflicts` is not empty, so it does go through the force branch and is still refused.

### 5. Beyond the plan

Code reading of `AdminStore.UpdateSettingsAsync` (lines 248-259), `ContentBundle.CheckAsync` (458-467) and `SettingsPage.tsx`, plus database checks:

- **Escape route from the every-save lock.** While a bad pair is stored, a body with `defaultShareImageId: null` is accepted, because the computed id is null and the check is skipped. The Studio's Clear button sends that. So an admin can always unlock the form by clearing the image or adding an override. Sound.
- **Unknown image id.** If a sent id is not in the library, `asset` is null and only the existing "Choose an image from the media library." error is returned. There is no duplicate or contradictory error. Sound.
- **Version order.** Validation runs before the version check, so a stale save over a bad pair gets 400 (the field error), not 409. After the fix the next save gets 409 as before. This is the existing order for every settings validation error. Not a finding.
- **Override over 300 characters.** `LimitText` and the new check both add to `defaultShareImageAltOverride`. A long override is not blank, so only the length error shows. Sound.
- **Studio: conflict and non-field errors.** A 409 has no `errors`, so `showFieldErrors` returns early. `clearFieldErrors` has already run and the title shows. Keys with no `Form.Item` are filtered through `form.getFieldsValue()`, as test 11 proves for `version`.
- **Check-then-save race.** It is accepted in plan section 10 and closed in the other order by ADM-12 (PR #70, not merged). Until PR #70 merges, the library can still blank the alt of the asset the settings row uses. That is ADM-12's half and is out of scope here.
- **Leftovers in `DigitalHubContent_Test` after the full suite.** `site_settings`: 1 row, `default_share_image_id` NULL. Blank-alt media: 3 rows (`diagram.webp` twice, `empty-alt.webp`), all `created_at 2026-10-18`, so they are older than this change and not from its facts. ADM-12c's facts clean up after themselves.

**Condition 8, `DigitalHubContent_Studio`, read-only.** `sqlcmd -S localhost -E -C -d DigitalHubContent_Studio -K ReadOnly`, SELECT only:

```
settings_rows: 1
default_share_image_id  override_state  asset_alt  decorative
NULL                    NULL            n/a        NULL
blank_alt_media: 0
```

The Studio database's settings row has **no** default share image, and no media row has blank alt. So the every-save refusal does not apply there today, and no stored bad pair exists to repair.

### Findings

**1. Minor: the Studio help text under the alt field still says empty is allowed.**

- Steps: open Settings in the Studio. Choose a library image with no alt text of its own (decorative, blank alt). Leave "Default share image alt text" empty. Read the help text, then click Save.
- Expected: the help text tells the editor that an image with no alt text of its own needs alt text here, which is what the save now enforces.
- Actual: the help text is unchanged: "The alt text for the default share image, on pages that use it. Empty uses the page title." (`studio/src/pages/SettingsPage.tsx:170`). The save is then refused with "This image has no alt text of its own. Add alt text for the default share image." The hint contradicts the new rule for exactly the case this change refuses. The refusal itself is correct and shown at the field, so this is a wording gap, not a broken behaviour. For the developer, routed through the tech lead. The plan did not list `extra` copy, so the tech lead may also accept it as a follow-up.

No Blocker and no Major.

### Coverage table rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| A blank-alt image with no override is refused by the settings save, and nothing changes | Verified | `A_decorative_image_with_blank_alt_and_no_override_is_refused_and_changes_nothing`: red at `de1324c` (`Expected: BadRequest Actual: OK`), green in 586/586 at `67ecaa5` |
| A whitespace override counts as blank | Verified | `A_whitespace_override_does_not_count_as_alt`: red, then green |
| A non-decorative blank-alt asset is refused too | Verified | `A_non_decorative_image_with_blank_alt_is_refused_too`: red, then green |
| A partial body uses stored values | Verified | `Clearing_the_stored_override_of_a_blank_alt_image_is_refused` red, then green; guard `Choosing_a_blank_alt_image_keeps_the_stored_override` green |
| A save with no share fields over a stored bad pair is refused | Verified | `A_save_without_share_fields_over_a_stored_bad_pair_is_refused`: red, then green. It asserts `Assert.Equal(1, updated)` first (condition 5) |
| An override, or alt in the library, is accepted | Verified | Guards `A_blank_alt_image_with_an_override_is_accepted`, `A_decorative_image_with_library_alt_is_accepted` green at both commits |
| The importer refuses the bad pair, `--force` included, and imports one with an override | Verified | `A_default_share_image_without_alt_text_of_its_own_is_not_imported`: red (`Expected: False Actual: True`), then green; the forced run asserts `Conflicts` not empty (condition 4); guard `A_default_share_image_with_an_override_imports` green |
| The Studio shows the refusal at the alt field, keeps the title, skips unmatched keys, clears on success | Verified | `a refused save shows the field error under the default share image alt text`: red (`Unable to find an element ...`), then green in 117/117 |
| Page share images: reverse order closed at publish | Verified (existing) | `ContentPublishTests` in the full suite, 586/586 |
| Page card images: publish check without a test | Moved | ADM-12d (`plan-approval.md`, "Follow-ups recorded") |
| Independent of ADM-12; no PR #70 file touched | Verified | `git diff --stat dad04a4 67ecaa5`: six planned files plus `implementation.md` |
| Failing tests first; CI's commands green | Verified locally; e2e and CI pending | Sections 1 and 2. Playwright e2e, CI, Security (gitleaks) and Workflow lint run ids are pending on CI for gate 2 |
| Condition 8: Studio database state | Verified | No default share image stored; 0 blank-alt media (section 5) |

Verdict: APPROVED

## Round 2

- Commit tested: `55486bd` ("ADM-12c: Say when the default share image alt text is required"), on a fresh detached worktree, `git -C D:\work\DigitalHub\dh-platform worktree add --detach D:\work\DigitalHub\dh-platform-claude-adm-12c-test 55486bd`. It was removed (`git worktree remove --force`, the dangling `@digitalhub/theme` link deleted) and pruned afterwards.
- Bounds: what `delivery-approval.md` asks of the tester in Round 2 ("What round 2 must show"). The API suites were not run, because no API file changed and `DigitalHubContent_Test` is in use by another agent. The Round 1 API evidence stands. No database was opened in this round.

### Diff since Round 1

`git diff --stat 67ecaa5 55486bd` (exit 0):

```
 docs/changes/ADM-12c/implementation.md | 41 ++++++++++++++++++++++++++++++++++
 studio/src/pages/SettingsPage.tsx      |  2 +-
 2 files changed, 42 insertions(+), 1 deletion(-)
```

The `SettingsPage.tsx` change is the one `extra` string on the "Default share image alt text" item (line 170):

- Before: "The alt text for the default share image, on pages that use it. Empty uses the page title."
- After: "The alt text for the default share image, on pages that use it. Required when the image has no alt text in the media library; otherwise empty uses the page title."

No other line, file or test changed. `grep -rn "Empty uses the page title\|Required when the image" studio/src studio/test studio/e2e` finds only line 170, so no test or e2e spec asserts the old text.

### Wording check

- The new text does not claim that the library alt is used on the site. It says the library alt decides whether the field is *required*, and that an empty field otherwise falls back to the page title.
- That matches the code. The rule is `AdminStore.DefaultShareImageAltError` (`AltText.Effective(override, asset) is null`), so the override is required exactly when the asset has no library alt. On the website, `website/src/seo/head.ts:89-93` sets `imageAlt: own || fallback || documentTitle(item)`, and its comment says a library alt is used "only when this page supplies its own alt". So an empty override does use the page title, and the library alt is never used for the share image.
- Round 1 Minor 1 is resolved: the hint now names the case the save refuses.

### Studio commands, at `55486bd`

| Where | Command | Exit | Output |
| --- | --- | --- | --- |
| `studio/` | `npm ci` | 0 | `found 0 vulnerabilities` |
| `studio/` | `npx tsc -b` | 0 | no output |
| `studio/` | `npm test` | 0 | `Test Files 15 passed (15)`, `Tests 117 passed (117)` |
| `studio/` | `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built in 944ms`; `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| `studio/` | `npx playwright test` | NOT RUN | The local e2e harness is broken. Pending on CI: the job "Studio — typecheck, build, end-to-end", step "End-to-end suite". Not a failure. |
| `api/` | API build and integration suites | NOT RUN | No API file changed since `67ecaa5`, and `DigitalHubContent_Test` is in use by another agent. The Round 1 runs (586/586 at `67ecaa5`) stand. CI's job "API — Release build, migrations, integration tests" covers the head. |

Security: the Round 1 checks stand. This round adds no dependency (`npm ci` reports 0 vulnerabilities), no route and no secret. The diff is one UI string and a record.

### Findings

None. Round 1 Minor 1 is fixed.

### Coverage table rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| Test report Round 1, Minor 1: the alt field's help text | Verified fixed | `SettingsPage.tsx:170`, one-line diff above. The wording matches `DefaultShareImageAltError` and `website/src/seo/head.ts:89-93` |
| The diff stays within the Round 2 bounds | Verified | `git diff --stat 67ecaa5 55486bd`: `SettingsPage.tsx` (1 line) and `implementation.md` only |
| The Studio stays green | Verified | `tsc -b` 0, `npm test` 117/117, build 0 |
| All earlier rows | Stand from Round 1 | No API, test or importer file changed since `67ecaa5` |

Verdict: APPROVED
