# ADM-10: test report

Tester (Claude Code), 12 November 2026. Plan `plan.md` round 2 (`1059d39`), review
`plan-review.md` round 2, gate 1 `plan-approval.md` (`b2889cd`, seven conditions),
`implementation.md` (`d3e54bb`, READY FOR TEST, four notes for the tester).

## Round 1

- **Commit tested:** `d3e54bb` ("ADM-10: Record screenshot parity at the head; ready for
  test"), detached checkout `/home/user/dh-test-adm10`. Base `32f0414`. Red commits
  `b1521f5` and `bf29cb2` were checked out in that same detached checkout, and it was
  returned to `d3e54bb` before the head runs. The developer's working copy was not
  touched apart from this file.
- **Environment:** Linux container, Node `v22.23.4`. There is no `dotnet` (the proxy
  blocks the SDK download) and no SQL Server. No database was opened or written,
  `DigitalHubContent` included. No process was started on any port, and none was
  stopped. The .NET and Playwright evidence below is read from CI logs the coordinator
  saved (run ids given in each row). I did not download them again.
- **Read first:** `CLAUDE.md` (the same as `AGENTS.md`), `docs/changes/README.md` (G3),
  `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`.
  `ENGINEERING_STANDARDS.md` is not in the worktree, as every gate records.

### 1. Scope of the diff (condition 2)

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Files changed | `git diff --stat 32f0414 d3e54bb` | 0 | 11 files. Source: `AdminStore.cs`, `SettingsPage.tsx`, `head.ts`. Tests: `SettingsShareImageTests.cs`, `settings.spec.ts`, `settingsShareImage.test.tsx`, `seo.test.tsx`. Records: 4 files under `docs/changes/ADM-10/`. This is exactly plan section 4 |
| Out-of-scope files untouched | `git diff --name-only 32f0414 d3e54bb -- studio/src/content studio/src/pages/ItemEditorPage.tsx studio/e2e/rich-text.spec.ts website/src/seo/jsonld.ts '*package*.json' '*.lock' '*.csproj' .github api/src/DigitalHub.Api/Data/Migrations` | 0 | Empty. `MediaPicker.tsx`, `ItemEditorPage.tsx`, `FormWalker.tsx`, `rich-text.spec.ts`, workflows, lockfiles, migrations: unchanged |
| `AdminStore.cs` changes only the three planned places | `git diff 32f0414 d3e54bb -- api/src` | 0 | The exists check before the version check, the two conditional copies, `LimitText(..., "defaultShareImageAltOverride", ..., 300)`, and the DTO's backing fields. Nothing else |
| One commit per planned step | `git diff --stat <c>~1 <c>` for `54bd132`, `884bca6`, `daa3de9` | 0 | `AdminStore.cs` only; `SettingsPage.tsx` only; `head.ts` only |
| Red tests not changed after their red commit | `git diff --stat b1521f5 d3e54bb -- api/tests studio/e2e website/test`; `git diff --stat bf29cb2 d3e54bb -- studio/test` | 0 | Both empty: the tests are byte-identical at the head |
| Commit format | `git log --format='%h %s \| %(trailers:only,unfold)' 32f0414..d3e54bb` | 0 | Every commit is `ADM-10:` with an imperative subject and both trailers |

### 2. API behaviour (by reading; T1 to T5 from CI)

| Behaviour | Code at `d3e54bb` | CI evidence |
| --- | --- | --- |
| A missing field keeps the stored value | `UpdateSettingsAsync` copies each field only `if (request.DefaultShareImageIdSent)` / `...AltOverrideSent`. The setter sets the flag, and System.Text.Json calls a setter only for a key in the body | T1 and T5 passed, job `api` 131031721416 (run 43173375547, merge `a63fb4e` of `73dc514`) |
| An explicit null clears; the two fields are independent | The setter runs for `null` too, so the flag is set and `null` is copied | T2 passed at the head |
| An unknown media id is 400, and nothing changes | `db.Media.AnyAsync(...)` false adds `defaultShareImageId: "Choose an image from the media library."` before the version check, through the existing `Validation(errors)` | T3 passed at the head. At `b1521f5` it was `Expected: BadRequest, Actual: InternalServerError` |
| An alt over 300 characters is 400 | `LimitText(errors, "defaultShareImageAltOverride", ..., 300)` in `ValidateSettings` | T4 passed at the head. At `b1521f5` it was `Expected: BadRequest, Actual: InternalServerError` |
| The flags are invisible to the bundle import's reflection (condition 3) | `internal bool ...Sent { get; private set; }`, no public flag, no `[JsonIgnore]`. `ContentImport/ContentBundle.cs:514` uses `typeof(SiteSettingsUpdate).GetProperties()`, which returns public instance properties only. `SensitiveDestructuringPolicy.cs:24` also reflects with `GetProperties()`: public only. The `InternalsVisibleTo` in `DigitalHub.ContentImport.csproj` points at the tests, not at the API's internals | `ContentBundleTests` 31 passed, 0 failed, in job `api` 131031721416 |
| The bundle import still works | `SettingsRequest` calls the public setters through reflection, so both flags become true. It only feeds `CheckSettings` (validation), so the new 300 limit applies to the import too. The column is `nvarchar(300)`, so no valid bundle is refused | Same job. `SettingsVersionTests` 4, `CookieSettingsTests` 3, `Section5Tests` 22 and `AdminApiTests` 12 all passed |
| Build in Release | | `dotnet build DigitalHub.slnx -c Release`: `Build succeeded`, `13 Warning(s)`, `0 Error(s)`. 13 at the base too. No warning names a changed file |

### 3. Studio control and alt field

By reading `SettingsPage.tsx` at `d3e54bb`:

- `<Form.Item name="defaultShareImageId">` wraps `ShareImageField`, so antd's `onFinish`
  includes the id, or `null` after "Clear". `<MediaPicker>` is a sibling of the `<Form>`,
  and `onSelect` calls `form.setFieldValue`. The alt is a `Form.Item` with
  `<Input maxLength={300} />`. Choosing an image does not copy the library alt into it.
- The stale-reply guard (`current = false` on cleanup) is present.
- Editors: the whole `<Form>` is `disabled={!canEdit}`. S4 proves that both buttons and
  the alt input are disabled and that there is no Save button.

| Command (in `studio/`, at `d3e54bb`) | Exit | Output |
| --- | --- | --- |
| `npm ci` | 0 | No tracked file changed (`git status --short` is empty) |
| `npx tsc -b` | 0 | none |
| `npm test` | 0 | `Test Files  13 passed (13)`, `Tests  98 passed (98)` |
| `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 1.26s`, `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| `npx playwright test` | NOT RUN | No SQL Server or `dotnet` here. CI job `studio` 131031721438 (run 43173375547): `32 passed (4.7m)`, including `✓ 11 e2e/settings.spec.ts:73:1 › ADM-10 settings ... (12.3s)`. The API log shows the four UI saves, the restore PUT, and both `DELETE /api/v1/media/{id}` answered 204. The later 409s on media deletes come from `studio.spec.ts:101` and `verification.spec.ts:312`, which expect them |
| `npx playwright test e2e/settings.spec.ts e2e/appearance.spec.ts` | NOT RUN | Same reason. Both specs are inside the full CI run above: `appearance.spec.ts:29` passed |

### 4. Website: the settings alt applies only on fallback

`head.ts` at `d3e54bb`: `fallback = item.shareImageId ? undefined :
settings.defaultShareImageAltOverride?.trim()`, then `own || fallback || documentTitle(item)`.
A page with its own image never takes the settings alt. A whitespace-only settings alt
trims to `""` and falls through to the title. W1 and W2 cover the three cases.
`website/fixtures/snapshot/content.json` has both settings fields `null`, so the snapshot
output cannot change.

| Command (in `website/`, at `d3e54bb`) | Exit | Output |
| --- | --- | --- |
| `npm ci` | 0 | No tracked file changed |
| `npm run typecheck` | 0 | none |
| `npx vitest run` | 0 | `Test Files  23 passed \| 1 skipped (24)`, `Tests  431 passed \| 31 skipped (462)` |
| `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `Redirect targets: all 0 resolve to a page.`, `Build output checks passed.` |
| `npm run compare:sections` | NOT RUN | Needs the old site's build. CI job `section-compare` 131036544632 (run 43174717473 on `8b9feff`): Success |
| Screenshot parity | NOT RUN | CI job `screenshot-parity` 131036544539 (same run): Success. See note 4 in section 7 |

### 5. Red before green

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Commit 1 holds tests only | `git diff --stat 32f0414 b1521f5 -- . ':!docs'` | 0 | `SettingsShareImageTests.cs`, `settings.spec.ts`, `seo.test.tsx` only |
| Commit 2 holds tests only | `git diff --stat b1521f5 bf29cb2` | 0 | `studio/test/settingsShareImage.test.tsx` only |
| W1 red, W2 guard green | `cd website && npx vitest run test/seo.test.tsx` at `b1521f5` | 1 | `× uses the settings alt with the default share image`, `Expected: "Digital Hub logo"`, `Received: "National e-services portal for a government ministry"`, `Tests  1 failed \| 11 passed (12)`. This is the plan's reason |
| Studio unit tests green at commit 1, so E1 is reached in CI | `cd studio && npm test` at `b1521f5` | 0 | `Test Files  12 passed (12)`, `Tests  94 passed (94)` |
| S1 to S4 red | `cd studio && npx vitest run test/settingsShareImage.test.tsx` at `bf29cb2` | 1 | `Tests  4 failed (4)`. Each fails with `Unable to find an element with the text: /media/001.png`: the missing control, one step earlier than the plan's "body has neither key" (see section 7) |
| T1 to T5 red | CI log, job `api` 130575850302 and 130586030225 (run 43036287741, merge `a211c54` of `b1521f5` into `32f0414`) | 1 | `Total tests: 545, Passed: 540, Failed: 5`. T1 line 47, T5 line 151: `Expected: <id>, Actual: null`. T3 line 100 and T4 line 125: `Expected: BadRequest, Actual: InternalServerError`. T2 line 79 (`Assert.Equal(media, ShareImageId(afterAlt))`): `Expected: <id>, Actual: null` |
| E1 red | CI log, job `studio` 131027779373 (attempt 4, same run, same merge commit) | 1 | Unit tests 12/12 files green. `1 failed, 31 passed (6.0m)`. `✘ 11 e2e/settings.spec.ts:73:1 ... (1.5m)`, `Test timeout of 90000ms exceeded.`, then `apiRequestContext.get: Target page, context or browser has been closed` at `settings.spec.ts:135:35` |
| E1 attempts 1 to 3 | CI logs of the three earlier attempts | 1 | apt/DNS infrastructure failures before any end-to-end test ran, as `implementation.md` records. Nothing hidden |
| All green at the head | CI run 43173375547 (`73dc514`) and 43174717473 (`8b9feff`) | 0 | Every job green. `d3e54bb` differs from `8b9feff` only in `implementation.md` (`git diff --stat 8b9feff d3e54bb`) |

### 6. Security

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| npm audit, Studio, full tree | `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| npm audit, website, full tree | `cd website && npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (`fast-uri`, GHSA-w74x-v6f9-j3xg and three more). It is below the gate's level, comes from the base, and no lockfile changed |
| Gate script, Studio | `RUNNER_TEMP=<scratchpad> sh ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Gate script, website | `RUNNER_TEMP=<scratchpad> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `run-dotnet-audit.sh` | NOT RUN | No `dotnet`, and no package changed. CI `security.yml` job `dotnet-vulnerable` (workflow Security, run 43173375733: Success as relayed in `implementation.md`; per-job log not seen by me) |
| Semgrep | NOT RUN | `semgrep` is not installed. `security.yml` job `semgrep` (workflow Security, run 43173375733: Success as relayed in `implementation.md`; per-job log not seen by me) |
| gitleaks | NOT RUN | `gitleaks` is not installed. `security.yml` job `gitleaks-pr` (workflow Security, run 43173375733: Success as relayed in `implementation.md`; per-job log not seen by me). A manual scan of the diff found only references to the existing `ApiFactory.AdminPassword`, `ApiFactory.BuildTokenValue` and `e2ePassword` constants. No literal secret. The CI logs show connection strings with the password masked as `***` |
| Authorization unchanged | `git diff 32f0414 d3e54bb -- api/src/DigitalHub.Api/Controllers` | 0 | Empty. `PUT /api/v1/settings` is still `studio-admin`, and `GET` is `studio`. The existing editor-403 tests on the PUT (`AdminApiTests.cs:227`, `CookieSettingsTests.cs:94`, the `CareersTests` role matrix `EditorBlocked`) passed in job `api`. The authorization filter runs before model binding and before the exists check, so an editor cannot use the 400 to probe media ids |
| Input validation | by reading | | An unknown id is 400, the alt is limited to 300, and a malformed GUID is the existing model-binding 400. The 400 names only the field |
| Error shape | by reading | | Both new errors use the existing `Validation(errors)` path, the same body as every other settings field. T3 and T4 assert the field name in the body. No internals: the 500 from the foreign key and the column overflow is gone |
| Host checks, body size, unknown fields | by reading | | No route was added. The settings PUT is unchanged in these respects: unknown fields are ignored (as before; E1's restore relies on this), there is no `[RequestBodyLimit]` or `[RejectDuplicateJsonFields]` on it, and that is also unchanged. With duplicate keys, the last one wins and the flag is set, which is harmless. This is outside this change's scope (see observation O-1) |
| No `DigitalHubContent` writes in tests | by reading, and the CI logs | | T1 to T5 use `ApiFactory`, whose `ToTestCatalog` rewrites the catalog to `DigitalHubContent_Test` and refuses any other name. The CI log shows `CREATE DATABASE [DigitalHubContent_Test]`. E1 uses the harness, which runs on `DigitalHubContent_E2e` (`studio.spec.ts:132` "end-to-end uses DigitalHubContent_E2e" passed). Neither new test names a database |

### 7. The developer's notes, judged

1. **T2 red at the base. Agreed: this is not a defect.** The red is at line 79, the
   alt-only half. The explicit-null half (lines 67 to 71) ran first and passed at the
   base, so T2's guard part is shown green there. At the base, a body with only the alt
   copies `null` over the id, which is the bug itself. The plan's "Green (guard)"
   prediction was wrong, and the test is stronger, not weaker. The record is honest and
   complete. No finding.
2. **E1 red only by timeout, with no locator named. The evidence is acceptable, and it
   becomes certain by elimination.** It is weaker than planned. In the API log of job
   131027779373, E1 makes its setup GET, two `POST /api/v1/media` answered 201, a UI
   sign-in, and two `GET /api/v1/settings` (the Settings page loaded). After that there
   is no request for 87 seconds: no `GET /api/v1/media?...` from the picker, and no PUT.
   `playwright.config.ts` sets `expect: { timeout: 15_000 }` and no `actionTimeout`. A
   failed heading check would therefore have failed at 15 s, naming the heading. Only an
   action waits for the full 90 s. The first action after the heading check is
   `pickImage`'s click on "Choose image". So E1 stopped at the planned locator. But the
   test was built so that its red cannot say so itself: see Minor 1.
3. **E1's `finally` cannot run after a timeout. Confirmed, and it is a finding (Minor 2).**
   The log shows that the first cleanup call threw, so the settings were not restored
   and the two images were not deleted. At this red run the effect was small: the base
   UI never changed the settings, and the other 31 specs passed. But the same failure
   mode at a later red, for example a timeout after step 1 has saved image `-a`, would
   leave the shared settings row pointing at E1's image for the rest of that run. Later
   specs that delete or count media usages (`studio.spec.ts:101`,
   `verification.spec.ts:312`) would then see an extra use. The database is reset
   before each run, so it does not carry across runs.
4. **A passing screenshot comparison is not approved parity. Agreed.** `ci.yml:358-359`
   and `continue-on-error: true` on "Compare screenshots" mean that its success proves
   nothing about parity. What does count is that the "Chromium regression tests" step,
   which can fail the job, passed. This change cannot alter the website's output, for
   two reasons:
   - `head.ts` only changes `imageAlt` when the settings alt is set;
   - the snapshot has it `null`, and the design check and the snapshot build are green.

   So no parity question arises from ADM-10. This is not a finding against ADM-10. The
   unapproved register is a project-level gap, and it should not be cited as parity
   evidence in the delivery record.

### Findings

No Blocker. No Major.

**Minor 1. E1's red cannot name the step it stopped at.**
- Steps: check out `b1521f5` and run `npx playwright test e2e/settings.spec.ts` against
  the harness (CI job `studio` 131027779373 did this).
- Expected (plan 5.2): "fails on E1 only, at the 'Choose image' locator", with the
  locator visible in the failure.
- Actual: `Test timeout of 90000ms exceeded.` and the cleanup error. No locator is
  named. The cause is shown only by elimination (section 7, note 2), because
  `page.getByRole("button", { name: button, exact: true }).click()` in `pickImage` has
  no timeout of its own and the config sets no `actionTimeout`.
- Suggested direction, for the developer: an `await expect(button).toBeVisible()`
  before the click, or a per-action timeout. Either would turn the red into a named
  15-second assertion and leave the cleanup time to run.

**Minor 2. E1's cleanup does not run after a test timeout.**
- Steps: any E1 run that reaches the 90-second test timeout (job 131027779373).
- Expected (plan 5.1, "finally"): the settings are restored and E1's images are deleted
  on every exit.
- Actual: `apiRequestContext.get: Target page, context or browser has been closed` at
  `settings.spec.ts:135`. Nothing after it runs. The restore PUT's and the DELETEs'
  responses are also never checked, so a failed restore would pass silently on a green
  run too.
- Impact: only within one run on `DigitalHubContent_E2e`, which the harness resets.
  Fixing Minor 1 removes the most likely trigger.

**Minor 3. The "image no longer in the library" state is untested, and any failed
read shows it.**
- Steps: read `ShareImageField`. For an id whose `GET /api/v1/media/{id}` answers 404,
  401 or 500, `result.ok` is false and the field shows "The chosen image is no longer in
  the library." If `fetch` itself throws, the async effect rejects with nothing caught,
  and only the buttons show.
- Expected (plan 3.2): the message when the image "is not found".
- Actual: the same message for any non-OK status, and no unit test covers this state
  (S1 to S4 always answer 200).
- Impact: wording only. A save still sends the stored id, and the API refuses it with
  400 if the row is truly gone.

**Observation O-1 (pre-existing, not this change).** `PUT /api/v1/settings` has no
`[RequestBodyLimit]` and no `[RejectDuplicateJsonFields]`, so Kestrel's 30 MB default
applies, and unknown fields are ignored. This is the same at `32f0414`. It belongs with
the "other unbounded settings columns" item that condition 7 sends to the coordinator.

**Observation O-2.** S1 to S4 go red at `renderLoaded()` (the missing thumbnail text),
before their body assertions. That is the same missing control. The body assertions
are reached and pass at the head. Accepted, as the developer recorded.

### Track checklist (G3)

| Rule | Verified |
| --- | --- |
| Finding, evidence and fix from the audit | Yes. `plan.md` section 1 quotes ADM-10 (audit line 179). G-1 and G-2 are marked as found here |
| Regression test committed and shown failing before the fix | Yes. Tests-only commits `b1521f5` and `bf29cb2` come before every fix. W1 and S1 to S4 were red locally by me. T1 to T5 and E1 were red in CI run 43036287741 (E1 by timeout, see Minor 1) |
| End-to-end test for each Major | Yes. E1, green at the head (job 131031721438) |
| An unfixed Minor becomes a D-NNN entry | Not applicable: the audit item is fixed in full. Minors 1 to 3 above are this change's test findings, for the developer |

### Coverage rows verified

| Item | Source | Status | Evidence (this round) |
| --- | --- | --- | --- |
| A save without the share image fields keeps the stored image | ADM-10 | Verified (code read; DB tests from CI) | Section 2. T1 and T5 red in 130575850302, green in 131031721416 |
| The Studio form carries the image through every save | ADM-10 | Verified | S1 red at `bf29cb2`, green at `d3e54bb` (98/98). E1 green in 131031721438 |
| A media picker on the Settings form (choose, change, clear) | ADM-10 | Verified | S2 and S3 locally; E1 steps 1, 3 and 4 in CI |
| An alt override on the form | ADM-10; O-ADM10-2 (a) | Verified | S1, S2 and S4 alt assertions; `maxLength={300}` read |
| The website uses the settings alt with the default image, and only then | Plan 2.3, 3.3 | Verified | W1 red at `b1521f5` and green at the head; W2 green at both; `head.ts` read |
| Unknown media id is 400, not 500 | G-1 | Verified (CI) | T3: 500 at red, passes at the head |
| Alt over 300 characters is 400, not 500 | G-2 | Verified (CI) | T4: 500 at red, passes at the head |
| The saved image reaches the build content | FR-S-17 | Verified (CI) | T5 |
| Editors see but cannot change the share image | Settled design (roles) | Verified | S4 locally; existing editor-403 tests on the PUT in job `api` |
| Internal flags invisible to the bundle reflection | Condition 3; plan 2.5 | Verified | Code read; `ContentBundleTests` 31/31 in job `api` |
| No out-of-scope file, lockfile, workflow or migration change | Condition 2; plan 7 | Verified | Section 1 |
| Design check, snapshot build, section comparison | Plan 5.3 | Verified (local) and CI | Section 4 |

Verdict: APPROVED
