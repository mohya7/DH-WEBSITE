# ADM-10: plan review

## Round 1

Reviewer: plan-reviewer, 11 November 2026. Reviewed `docs/changes/ADM-10/plan.md` at
`3436530` (parent `32f0414`, ADM-07 merged as #55). Read: `CLAUDE.md`/`AGENTS.md`,
`docs/changes/README.md`, the audit (`/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`,
ADM-10 at line 179, FR-S-17 at line 43, "### Major" at 147), the refinement plan
(G3 table line 225, "fails first" line 221), ADM-07's records, and the code the plan
cites. `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` are not in the
worktree (confirmed with `ls`), as the plan says.

**Not run here:** no `dotnet`, no SQL Server, no `node_modules`. Every finding below is
from reading the code and git, not from running a suite.

### Findings

**1. Major. Section 5.1, E1 setup: the two uploads of `pixel.png` are one asset.**
- The plan uploads `e2e/fixtures/pixel.png` twice, with alt `adm10-<stamp>-a` and
  `-b`, then picks `-a`, changes to `-b`, and deletes "both uploads".
- `MediaLibrary.cs:82-84`: an upload whose processed hash matches an existing row
  returns that row (`Present(existing, duplicate: true)`) and stores nothing. The hash
  is SHA-256 of the encoded WebP (`DigitalHub.Images/ImagePipeline.cs:101`), so the
  same file always gives the same hash. The second upload returns the first asset with
  alt `-a`; there is no `-b` to search for or pick, and "Change image to `-b`" cannot
  be done. If any earlier spec has already uploaded `pixel.png` (`studio.spec.ts:7, 81`
  does, after `settings.spec.ts` alphabetically today, but order is not a contract),
  even `-a` would not exist and `finally` would try to delete another spec's image.
- Would satisfy me: E1 uses two images with different pixels (two committed fixtures,
  or bytes generated in the test), asserts each upload's response is not
  `duplicate`, and deletes only the ids it created.

**2. Major. Section 5.2 and risk row 6: "E1's red cannot be shown in CI" is not so.**
- `ci.yml`, job `studio`: "Unit tests" (`npm test`, line 237) runs before
  "End-to-end suite" (line 271), so a red S1 to S4 stops the job before E1. That is
  true only because the plan puts S1 to S4 in the same commit as E1.
- ADM-07 solved exactly this without touching the job: E1 and the API tests in
  commit 1, the Studio unit tests in commit 2 (`docs/changes/ADM-07/implementation.md`
  lines 50, 167-191, 212: "job `studio` unit tests green, E1 red at step 3 only").
- The plan's choice leaves the e2e test for this Major with its red "NOT RUN" or
  "shown by reading the code", which does not meet "The regression test is committed
  and shown failing before the fix". The plan is right not to reorder or loosen the CI
  job (P-6); no job change is needed.
- Would satisfy me: commit 1 = T1 to T5, E1, and W1/W2 if (a); commit 2 = S1 to S4
  (red locally); then the fixes. The expected CI red at commit 1 is stated per job
  (`api`: T1, T3, T4, T5 red; `website`: W1 red only; `studio`: unit tests green, E1
  red at "Choose image"). Risk row 6 and 5.4 row 2 updated to match.

**3. Minor. Section 5.1, Studio test conventions: the empty-body `afterEach` is not named.**
- The plan lists the `listPaging.test.tsx` mocks and the `message.success` spy, but not
  the file-level `afterEach(() => { cleanup(); expect(document.body.innerHTML).toBe(""); })`
  (`listPaging.test.tsx:166-170`, `redirects.test.tsx:109-113`) that ADM-06b-flake
  added so nothing (toasts, the picker's Modal portal) outlives a test.
- Would satisfy me: `settingsShareImage.test.tsx` keeps that `afterEach` verbatim, and
  the plan says so. S2 also needs a mock for `GET /api/v1/media/m-002` (the field reads
  the chosen image when the value changes, 3.2), or the handler throws.

**4. Minor. Section 5.1, API tests leave the singleton settings row pointing at a seeded image.**
- T1 to T5 share `site_settings` with `CookieSettingsTests`, `Section5Tests`,
  `SettingsVersionTests` and `AdminApiTests` in collection `SqlServer`. After 3.1, the
  two tests that `payload.Remove("defaultShareImageId")` (`CookieSettingsTests.cs:104`,
  `Section5Tests.cs:228`) keep whatever id T1 left, and that media row then cannot be
  deleted (`MediaUsage.cs:45`).
- Would satisfy me: each T test ends by saving `defaultShareImageId: null` (in a
  `finally` or the fixture's dispose), or the plan says why the leftover is harmless.

**5. Minor. Section 3.2: where the `MediaPicker` is rendered.**
- If the picker sits inside `ShareImageField` (inside the settings `Form`), its own
  `<Form>` (`MediaPicker.tsx:153`) and the outer form's disabled and form contexts
  reach it through React context even though the Modal is portalled. It works, but
  the item editor renders it outside its fields (`ItemEditorPage.tsx:396`).
- Would satisfy me: the plan says the picker is rendered as a sibling of the `Form`,
  or states that nesting was considered and S2 covers it.

**6. Minor. Factual slips.**
- Header: "Cut from `6262f48` ... The coordinator will merge `32f0414`". The branch's
  plan commit `3436530` already has parent `32f0414`; 2.7's precondition is met.
- 3.3: "`snapshot/content.json`" is `website/fixtures/snapshot/content.json` (both
  fields `null` there, confirmed).
- E1: "Change 'Email' only". `getByLabel("Email")` also matches "Careers email"
  (substring); the step should use `exact: true`.
- Risk table: a media delete between the new exists check and `SaveChangesAsync`
  still ends in the FK `DbUpdateException` (500). Rare and admin-only; worth one row.

### Checked and found sound

- **Fit.** The plan quotes ADM-10's finding and fix, FR-S-17, the G3-1 exit gate and
  "Every fix carries a regression test that fails first" word for word against the
  audit and refinement plan. ADM-10 is under "### Major" (line 147 to 258), so E1 is
  required; the plan has it.
- **Current state.** `AdminStore.cs:284-285` copies both fields unconditionally;
  `SiteSettingsUpdate` (1147-1179) is a plain DTO; `ValidateSettings` (796-826) has no
  share image checks; only `DbUpdateConcurrencyException` is caught (299);
  `SettingsPage.tsx` has no `Form.Item` for either field, so `onFinish` omits them;
  `head.ts:85-92` ignores `defaultShareImageAltOverride`; the column is `nvarchar(300)`
  (snapshot 1369-1372); FK `NoAction` (`ContentModelBuilder.cs:135-138`). All confirmed.
- **Missing versus null.** System.Text.Json calls a setter only for present keys, and
  with `null` for an explicit `null`; the controller binds `[FromBody] SiteSettingsUpdate`
  (`AdminControllers.cs:65`) with default STJ options plus one converter
  (`Program.cs:182-185`), no source-generated context. Internal flags with private
  setters are invisible to STJ, MVC validation and `Type.GetProperties()`. This is the
  smallest change that also protects old Studio tabs; the rejected alternatives (PATCH
  for all 25 fields, `JsonElement` binding, public/`[JsonIgnore]` flags, a separate
  route) are real and correctly argued.
- **Import path.** `ContentBundle.cs:511-517` builds the request by setting every public
  property, which sets both flags true; it is used only for `CheckSettings` (line 457),
  and the import writes rows itself. Nothing changes for it except the new 300 limit,
  which no stored row can exceed. `ContentBundleTests` is in the 5.3 filter.
- **The two extra 400s.** The exists check needs the database, so it belongs in
  `UpdateSettingsAsync`, not the static `ValidateSettings`; `LimitText` trims as the
  column stores trimmed text. Both are on the same save path the fix opens up, are
  flagged as not from the audit, and are disclosed as B2 and B3.
- **Studio control.** Reuses `MediaPicker` and the item editor's "Choose/Change image",
  "Clear" pattern and classes; no new CSS; editors get the form-level `disabled`.
  `GET /api/v1/media/{id}` exists (`MediaController.cs:20`, `studio` policy) and
  returns `{ image, usages }`. `appearance.spec.ts:49-51` only checks existing labels.
- **Website (O-ADM10-2).** The 3.3 fallback applies only to pages without their own
  image; the snapshot has both fields `null`, so design check and section comparison
  are unchanged. Correctly left to the owner with a defined (b) path.
- **Security.** No route or policy change (`PUT` `studio-admin`, `GET` `studio`); no
  secrets; no packages.
- **Scope and gates.** One topic; files exist or are new on purpose; nothing in
  #55's settled hunks is touched; no migration, lockfile or workflow change; no gate,
  baseline or test weakened. Commands run .NET in Release and use
  `DigitalHubContent_Test` / `DigitalHubContent_E2e`.
- **Owner decisions.** O-ADM10-1 (push red first) and O-ADM10-2 (website alt) are OPEN
  with fallbacks, not assumed; "merge now" is used only as the relay that #55 merged,
  not as an owner decision for ADM-10.
- **Rollback.** Revert only; no schema or data change. Accurate.

Not checked: that #44 is the only other open pull request (no `gh` call made).

Verdict: CHANGES NEEDED
