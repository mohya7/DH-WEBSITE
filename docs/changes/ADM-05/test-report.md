# ADM-05: test report

Tester (Claude Code), 12 November 2026. Plan `plan.md` round 2, gate 1
`plan-approval.md` (`Verdict: APPROVED`, ten conditions), developer record
`implementation.md` (`Status: READY FOR TEST`).

## Round 1

**Commit tested:** `e04e57a` (`ADM-05: Implementation record`), on a detached
worktree made for this round: `git -C /home/user/DH-WEBSITE worktree add --detach
/home/user/dh-check-adm05 e04e57a`. `git ls-remote origin 'refs/heads/change/ADM-05*'`
gives `e04e57a8… refs/heads/change/ADM-05` and `63c15dc7… refs/heads/change/ADM-05-red`,
so the tested commit is the pushed head.

Read: `CLAUDE.md`/`AGENTS.md`, `docs/changes/README.md`, `plan.md`, `plan-review.md`,
`plan-approval.md`, `implementation.md`, and the audit finding
(`/mnt/attach/project-files/docs/quality/admin-audit-2026-10-28.md` lines 118-131, as
the plan quotes it). `ENGINEERING_STANDARDS.md` does not exist in the tree, as the plan
and gate 1 already record.

Owner answers, as the coordinator relayed them to me (I did not see the cards):
O-ADM05-1 "Yes, only 404 and 500" (option (a)) and O-ADM05-2 "Yes, red tests first",
both card taps on 12 November 2026.

**Environment limits.** This machine has no `dotnet`, no SQL Server, no Playwright
browsers, and no checkout of `feature/interviewer-portal` (`which dotnet sqlcmd semgrep
gitleaks`: none found). GitHub Actions is blocked by a billing problem on the owner's
account, so **no CI has run on this change**: not the red on `change/ADM-05-red` (PR #57),
not the green on `change/ADM-05`. Every item below that only CI can run is PENDING, not
passed. Nothing was read from or written to any database.

### 1. Red tests were red

| Tests | Command | Exit | Result |
| --- | --- | --- | --- |
| S1 to S7 (Studio) at the pre-fix screen | In the detached worktree at `e04e57a`, `studio/src/pages/ErrorPagesPage.tsx` replaced by its `d35fdd8` version (`git show d35fdd8:…`), then `npx vitest run test/errorPages.test.tsx`, then the head file put back (`git status --short`: empty) | 1 | `Tests 7 failed (7)`. S1 `Unable to find an element with the text: draft, which matches selector '.status-chip'`; S2, S3, S4, S6 `Unable to find an accessible element with the role "button" and name "Publish"`; S5 `-   "404 page saved as a draft. Publish to put it on the website."` / `+   "404 page saved."`; S7 `Unable to find an element with the text: One or more fields are invalid.`. Each fails at the assertion plan 5.1 names. `git diff --stat d35fdd8 a3a94d7 -- studio` shows the only Studio source change between them besides ADM-10's merged files is `ErrorPagesPage.tsx` |
| S1 to S7 at head | `npm test` (below) | 0 | all 7 pass |
| T1 to T11 red at `63c15dc`, green at head | `dotnet test` | NOT RUN | No `dotnet` or SQL Server. **PENDING**: CI job `api` on `change/ADM-05-red` (red) and on `change/ADM-05` (green). Actions blocked |
| E1 red at `63c15dc` (step 1, publish at set-up), green at head | `npx playwright test e2e/error-pages.spec.ts` | 1 (config load) | `Error: spawnSync dotnet ENOENT` (the config reads the E2E connection string through `dotnet user-secrets`). NOT RUN. **PENDING**: CI job `studio`, "End-to-end suite" |

**Static check of the API reds (reading `63c15dc` against the base code, not run).**
For each T test I traced the base behaviour (`AdminStore.UpdateErrorPageAsync` at the
base, `PublishChecks.cs:28-29` at the base) and the head behaviour (`ContentStore.SaveErrorPageAsync`
→ `MutateAsync`, `PublishChecks.IsErrorPage`):

| Test | At base it would | At head it would | Red set matches plan 5.4? |
| --- | --- | --- | --- |
| T1 | write the record: the build shows "Body B", `Assert.Contains("Body A")` fails | write a `WorkingCopy`; record and build keep "Body A" | yes |
| T2 | `GetProperty("state")` throws (no such field) | `changed`, `published`, `hasWorkingCopy` true | yes |
| T3 | publish 400 `publish_blocked`, `errors.metaDescription` | exemption applies, 200 | yes |
| T4 | build already "Body B" after the save | "Body A" until publish; one revision `EntityType "page"` | yes |
| T5 | 200 (base runs `RichText.Validate` only; the image node with `mediaId` and `alt` is valid) | 400 `validation_failed`, `errors.media` from `CheckAsync` (`ContentStore.cs:880-890`) | yes |
| T6 | `eyebrow` dropped (fields replaced) | kept (`JsonObject` copy of the section fields) | yes |
| T7 | audit row `error_page` / `404`, so no row with the page id: `Assert.Single` fails | one row, `Kinds["pages"].EntityType` = `page`, `EntityId` = page id | yes |
| T8 | green (guard) | green: a non-error slug still gets `AddDescription` | guard |
| T9 | `GetProperty("state")` throws | `draft`, build `errorPages.404` null | yes |
| T10 | green: 409 `concurrency_conflict` | green: `MutateAsync` `Conflict()` | guard |
| T11 | green: `studio` policy and `[StudioAccess]` refuse HR | unchanged | guard |

So the expected red set is T1 to T7 and T9, with T8, T10 and T11 green, which is what
plan 5.4 and `implementation.md` section 6 expect. This is reasoning, not evidence; the
G3 rule "shown failing before the fix" for the API and E2E reds stays PENDING.

**Will the C# compile?** Not compiled here. I checked every type and member the new code
and tests use exists with a compatible signature at `e04e57a`: `DraftDocument.Sections`
is `List<DraftSection>`, `DraftSection.Fields` is a settable `JsonElement`,
`BuildContentStore.ErrorSlugs` is `internal` in the same assembly and namespace,
`ContentOutcome.Code`, `Loaded`, `DocumentOf`, `StateOf`, `Parse`, `Validation` are in
`ContentStore`, `ErrorPageUpdate` is still in `AdminStore.cs` (same namespace), and
`grep -rn "EmptyDoc|ErrorTypes|PresentErrorPage|UpdateErrorPageAsync|ListErrorPagesAsync"`
outside tests finds only the new `ContentStore` members and the controller's two calls.
Test-side: `Section.Page`, `WorkingCopy.Page`, `Revision.EntityId` (`Guid`),
`AuthSession.LoginAsync`/`IsLiveAsync`/`Authorized`, `ApiFactory.BuildTokenValue`/`AdminEmail`/`AdminPassword`
all exist. **PENDING**: the first real compile is CI job `api` (warning ceiling 13).

### 2. Test plan commands (plan 5.3)

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npm ci --no-audit --no-fund` | 0 | `added 245 packages in 8s` |
| `cd studio && npx tsc -b` | 0 | no output |
| `cd studio && npm test` | 0 | `Test Files 14 passed (14)`, `Tests 105 passed (105)` |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 1.34s`; `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` (plus Vite's "Some chunks are larger than 500 kB" notice) |
| `cd studio && npx playwright test` and `npx playwright test e2e/error-pages.spec.ts e2e/verification.spec.ts` (ports 4201/4202) | 1 | `Error: spawnSync dotnet ENOENT`. NOT RUN: no `dotnet`, no SQL Server, no browsers. **PENDING**: CI job `studio` |
| `cd website && npm ci --no-audit --no-fund` | 0 | `added 114 packages in 10s` |
| `cd website && npm run typecheck` | 0 | `tsc --noEmit`, no error |
| `cd website && npm test` | 0 | `Test Files 23 passed \| 1 skipped (24)`, `Tests 431 passed \| 31 skipped (462)` |
| `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `web.config: 0 redirect(s), report-only content security policy, custom 404 and 500.` … `Build output checks passed.` |
| `cd website && npm run compare:sections` | NOT RUN | Needs a `feature/interviewer-portal` checkout and Chromium, neither here. No `website/` file changes in ADM-05. **PENDING**: CI job `section-compare` |
| `website` browser suite (`npm run test:browser`) | NOT RUN | No Playwright browsers. **PENDING**: CI job `website-browser` |
| `cd api && dotnet build DigitalHub.slnx -c Release`, `dotnet test … -c Release` (full, and the 5.3 filter run over `ErrorPagePublishTests`, `AdminApiTests`, `BuildContentTests`, `ContentPublishTests`, `RedirectTargetRuleTests`, `MediaLibraryTests`, `ContentBundleTests`) | NOT RUN | No `dotnet`, no SQL Server. **PENDING**: CI job `api` |
| `workflow-lint.yml`, `screenshot-parity` | NOT RUN | CI only. **PENDING** |

### 3. Track checklist (G3, `docs/changes/README.md`)

| Rule | State |
| --- | --- |
| Finding, evidence and fix come from the audit | Met. Plan section 1 quotes lines 118-131; the three fixes are in `71edc31` (draft flow), `a3a94d7` (state and Publish), `e8dc356` (O-16 answer (a)) |
| Regression test committed and shown failing before the fix | **Partly.** Committed before the fix: `63c15dc` (T1 to T11, E1) and `d35fdd8` (S1 to S7), both before `71edc31`. S1 to S7 shown red by me (section 1). T1 to T7, T9 and E1: **PENDING** (CI blocked) |
| End-to-end test for each Major | ADM-05 is a Blocker; E1 exists (`studio/e2e/error-pages.spec.ts`). Not run: **PENDING** |
| Unfixed Minor becomes a D-NNN entry | Not applicable to the audit finding. The Minors below are mine, for the developer |

### 4. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, full tree, website | `npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (`fast-uri 3.0.0 - 3.1.8`), below the high level. No lockfile change in ADM-05 (`git diff --quiet 32f0414 e04e57a -- website/package-lock.json studio/package-lock.json`: exit 0) |
| npm audit, full tree, studio | `npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| Gate script, website | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Gate script, studio | same, `studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `run-dotnet-audit.sh` | NOT RUN | No `dotnet`. No package change in ADM-05. **PENDING**: `security.yml` job `dotnet-vulnerable` |
| Semgrep | NOT RUN | Not installed. **PENDING**: `security.yml` job `semgrep` |
| Gitleaks | NOT RUN | Not installed. **PENDING**: `security.yml` jobs `gitleaks-pr`, `gitleaks-history` |
| Secrets in the diff | `git diff 32f0414 d35fdd8; git diff 0b3ef34 e04e57a` grepped for `password\|secret\|token\|apikey\|connectionstring\|BEGIN .*KEY\|Bearer` | 0 | Only references to the existing fixture constants (`ApiFactory.AdminPassword`, `ApiFactory.BuildTokenValue`, the `X-Build-Token` header name). No literal secret. No secret printed in any output here |
| Files outside scope | `git diff --name-only` over the ADM-05 commits | 0 | Only the five source files in plan section 4, the three new test files and the ADM-05 docs. No lockfile, workflow, migration or `website/` file. `git diff --quiet 2bbd586 0b3ef34` outside the three test files and docs: exit 0, so the merge brought in ADM-10 only |

**Route review (by reading; not run, since no API can start here).**

| Route | Anonymous | Admin | Editor | HR | Wrong record |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/error-pages` | 401 by the JWT challenge (`[Authorize(Policy = "studio")]`, `Program.cs` `OnChallenge`) | 200 | 200 | 403 (policy `studio` = admin, editor; `OnForbidden`). T11 pins it | n/a |
| `PUT /api/v1/error-pages/{type}` | 401, as above | 200 | 200 | 403. T11 pins it, and that the record is unchanged | `type` not `404`/`500`: 400 `type` "Type must be 404 or 500." (`ErrorSlugs.TryGetValue`, ordinal). Missing page: 404 "That error page does not exist." Stale version: 409 (T10) |
| `POST /api/v1/pages/{id}/publish` (existing, now used by the screen) | 401 (no `[Authorize]` on `ContentController`, so the fallback policy requires a signed-in user; `[StudioAccess]` then filters) | 200 | 200 | 403: `[StudioAccess]` allows HR only `List`/`Get`/`End` on `vacancies`. T11 pins it | Any page id an editor may already publish through Pages; no new reach |

- No route, policy or role was added or changed (`git diff` of `AdminControllers.cs`:
  the store type and one method name only).
- **Meta-description exemption:** `PublishChecks.IsErrorPage` is `collection == "pages"
  && BuildContentStore.ErrorSlugs.ContainsValue(slug)`: the two exact slugs, ordinal,
  pages only. It is keyed on the draft's slug, not `noIndex`, as condition 4 requires.
  Images, alt text, links and references still run. T8 pins an ordinary `noIndex` page.
  See finding 3 for the clause T8 does not pin.
- **Library check:** the save goes through `MutateAsync` → `CheckAsync(…, publishing:
  false)` with `requireMedia` defaulting to `true`; `MediaUsage.Walk` parses JSON held in
  the `body` string, so an image `mediaId` there is found. T5 pins it.
- **Audit:** one `update_error_page` row per successful save, `EntityType "page"`,
  `EntityId` the page id (B5). A refused save writes none, as for Pages. Publish audits
  `publish`. T7 pins the save row.
- **Stale working copy / concurrency:** `MutateAsync` checks the record version and
  `Version` is a concurrency token (`ContentModelBuilder.cs:229`), so two simultaneous
  saves end in one success and one 409 (`CommitAsync` maps `DbUpdateConcurrencyException`).
  An existing working copy on a published error page is reused (`loaded.Copy ?? NewCopy`),
  and the list and the save read it (`DocumentOf`). A draft record cannot hold a working
  copy (`MutateAsync` writes one only for a published record; `UnpublishAsync` removes
  it), so the screen cannot show a stale copy for the draft pages in
  `DigitalHubContent_Studio`. The rollback step for a stale copy (plan section 8) is in
  the PR-body draft (`implementation.md` section 10).
- **Error shape:** refusals go through `AdminResponse.From`: `ValidationProblemDetails`
  with `type` `https://tools.ietf.org/html/rfc7807`, `title`, `code`, `errors`, or
  `ProblemResults.Create`. No stack trace or internal text in any new message.
- **Unknown fields and body size (not changed by ADM-05).** `ErrorPageUpdate` binds with
  the default `System.Text.Json` options, so an unknown field (for example
  `metaDescription`) is ignored, not rejected, and the route has no
  `[RequestBodyLimit]`, so Kestrel's default applies. Both are the same as before this
  change and the same as every content route (`grep -rn UnmappedMember` finds nothing;
  `RequestBodyLimit` is on auth, users, contact and apply only). Not counted as findings
  of ADM-05; recorded for the owner's audit list.
- **Host checks:** the API has no host-based routing (no host filter in `Program.cs`); the
  website is a static build served separately. Not applicable to this change.
- **Permission change:** none. T11 is the "cannot do" test for HR on all three routes.

### 5. Beyond the plan

Probes run against the head screen with the committed test harness, in a scratch copy
of `studio/` (`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/studio-probe/test/probe.test.tsx`,
`node_modules` linked; nothing written in either worktree). Command
`npx vitest run test/probe.test.tsx --reporter=verbose --silent=false`, exit 0:

| Probe | Output | Result |
| --- | --- | --- |
| P1 double-click Publish | `P1 publish POSTs: 2 error shown: false` | Two requests with the same version; the second gets 409. The 409 text was then hidden by the first request's reload; the order decides what the user sees (finding 1) |
| P2 double-click Save | `P2 save PUTs: 2 error shown: true` | Two PUTs with the same version; the save succeeds and the screen still says "Someone else changed this page." (finding 1) |
| P3 Publish 500 while the 404 card has unsaved edits | `P3 404 title after reload: Lost 404 publish disabled: true` | Edits kept, Publish stays disabled. Matches `implementation.md` point 5 |
| P4 blocked publish, then a 409 on the same card | `P4 stale findings still shown: true` | The old "media: …" list stays beside the 409 text (finding 2) |
| P5 Publish 200 with warnings | `P5 warnings shown: true` | Listed |
| P6 Save 400 with no `errors`, then 500 | `P6 ok true` | Title line each time, no crash |
| P7 empty list | `P7 cards: 0` | No card, no crash (as before; the E2E database starts this way) |

API edge cases checked by reading: a `type` of `error-404` or `405` gives 400; a title
over 300 characters is now refused by `ContentFields.Validate` (B4) instead of failing
at the column; a body with an unknown media id gives 400 `media` (T5); a section that is
not `rich_text` becomes `rich_text` with `{ heading, body }` only; a page with no section
gets a new `rich_text` at `SortOrder 0`; the response after a save is re-read with
`LoadAsync`, so `version`, `state` and `hasWorkingCopy` are the committed values. The
section fields are rewritten with the default encoder, so `"` inside the body string is
stored as `"` (`implementation.md` point 4). Every reader parses the JSON
(`GetString`, the website build), and the only raw-text search over stored content,
`MediaUsage` `Contains(<guid>)`, looks for a GUID, which has no escaped characters. No
effect found.

### 6. Findings

No Blocker or Major found in the code. Three Minors, for the developer:

1. **Minor: Save and Publish have no in-flight guard, so a double-click reports a
   conflict that did not happen.**
   - Steps: on the Error pages screen, change the 404 title and double-click Save (probe
     P2). Or double-click Publish (P1).
   - Expected: one request, or a second click ignored while the first is in flight. No
     "Someone else changed this page." after the user's own successful save.
   - Actual: two `PUT /api/v1/error-pages/404` with the same `version`. The first returns
     200, the second 409, and the screen shows "Someone else changed this page." beside
     the success toast. Two `POST …/publish` for Publish. Nothing is lost on the server,
     because the version check refuses the second request. Other Studio screens have no
     guard either (`grep busy|saving|loading=` in `ItemEditorPage.tsx`, `RedirectsPage.tsx`,
     `SettingsPage.tsx`: none), so this follows the existing pattern. The Publish button
     is new here, though.
2. **Minor: a card keeps old publish findings after a later 409.**
   - Steps: Publish answers 400 with `errors.media`, then Publish again and get 409 (P4).
   - Expected: the card's list is cleared or replaced, and the conflict message names the
     card.
   - Actual: the "media: …" list stays on the 404 card, and "Someone else changed this
     page." shows at the top of the screen without saying which page.
3. **Minor (test gap): no test pins the `collection == "pages"` half of the exemption.**
   - Steps: remove `collection == "pages" &&` from `PublishChecks.IsErrorPage` and run
     `ErrorPagePublishTests`.
   - Expected: a test fails, because an item in another collection with slug
     `error-404` (for example a service at `/services/error-404`) has an address of its
     own and still needs a meta description.
   - Actual (by reading): T8 uses a page with a non-error slug, so it would stay green.
     The code is right today; only the guard is missing.

Observations, not findings of this change: unknown fields ignored and no per-route body
cap on `PUT /api/v1/error-pages/{type}` (section 4, pre-existing and shared with every
content route); `fast-uri` moderate advisory in `website/` (below the high level,
lockfile unchanged); the E1 `finally` does not assert its unpublish and delete, so a
failed clean-up would leave pages for later specs (P2.12 only checks console errors).

### 7. Coverage rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| Saves on the error pages go through the draft flow: a published page changes only at Publish | Verified by reading; tests PENDING | `ContentStore.SaveErrorPageAsync` → `MutateAsync` (`ContentStore.cs:641-686`, 764-772); T1, T4, E1 not run (CI) |
| The screen shows each page's state | Verified | S1 red at the `d35fdd8` screen, green at head (sections 1, 2) |
| The screen can publish each page | Verified (unit); E2E PENDING | S2, S3, S6 red then green; E1 not run |
| The screen lists what blocks a publish | Verified | S4 red then green; P4, P5 |
| The meta-description rule, as the owner decides ((a)) | Verified by reading; tests PENDING | `PublishChecks.cs` `IsErrorPage`, pages and the two slugs only; T3, T8 not run; finding 3 |
| Publishing through Pages is no longer blocked for these pages | Verified by reading | The exemption is in `PublishChecks.AddAsync`, which every page publish runs |
| The error-page save refuses an image not in the library | Verified by reading; T5 PENDING | `CheckAsync` media check, `requireMedia` true |
| Error-page saves are no longer a separate write path | Verified | `AdminStore` members removed; grep shows no other caller |
| A save keeps the text section's other fields | Verified by reading; T6 PENDING | `JsonObject` copy; `rich_text.json` allows `eyebrow`, `blocks` |
| `GET` and `PUT` never create an error page; HR cannot reach them | Verified by reading; tests PENDING | `ErrorPageIdAsync` lookup only; `AdminApiTests` unchanged (`git diff --name-only`); T11 |
| Regression tests committed and shown failing before the fix | **Partly**: Studio verified; API and E2E PENDING | Section 1 |
| An end-to-end test of save-as-draft and publish | Written; PENDING | `studio/e2e/error-pages.spec.ts` read; not run |
| A refused save lists its fields on the screen | Verified | S7 red then green; P6 |
| Shared-file order: ADM-10 merged before commit 3 | Verified | `git merge-base --is-ancestor 2bbd586 e04e57a`: exit 0; `0b3ef34` is a merge; `2bbd586..0b3ef34` outside the test files and docs is empty |
| No website change; website suites unchanged | Verified | typecheck, tests, design check, snapshot build all exit 0 |
| CI: `api`, `website`, `studio` (unit and E2E), `section-compare`, `website-browser`, `screenshot-parity`, `security.yml`, `workflow-lint.yml`, red on PR #57 | **PENDING** | GitHub Actions blocked by the owner's billing problem |

### 8. Verdict

Everything that can run here passes, and the review finds no Blocker or Major. The
change cannot be approved, because the planned checks that only CI can run have not run
at all: the first compile of the C#, T1 to T11 (red at `63c15dc` and green at `e04e57a`),
E1, and the `security.yml` jobs. Gate 1 condition 10 and the G3 rule "shown failing
before the fix" depend on them. They are blocked by GitHub Actions billing on the owner's
account, which only the owner can fix (or the owner can name another way to run CI).
Once CI runs, the next round checks the red on PR #57 and the green on the head, and
re-checks the three Minors if the developer takes them.

Verdict: BLOCKED ON OWNER
