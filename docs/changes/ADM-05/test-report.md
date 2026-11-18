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

Round 1 result: BLOCKED ON OWNER (CI could not run: GitHub Actions billing; no Blocker, no Major, three Minors).

## Round 2

Tester (Claude Code), 19 November 2026. The owner's instruction today was "continue",
which resumes the pipeline after the CI billing block. Developer record:
`implementation.md` section 11 (rework round 1), `Status: READY FOR TEST`.

**Commit tested:** `36b192280033c29c497354a0dee5725e12e36f4b`, the merge of base
`793c43e` (#62 ADM-07c, #64 GAP-34, #63 standards) into the developer's head `741d70c`.
Detached worktree: `git worktree add --detach D:\work\DigitalHub\dh-platform-claude-adm-05-test 36b1922`,
removed at the end. `git ls-remote origin 'refs/heads/change/ADM-05*'` gives
`36b19228… refs/heads/change/ADM-05` and `63c15dc7… refs/heads/change/ADM-05-red`, and
`gh pr view 59` gives `headRefOid 36b19228…`, so the tested commit is PR #59's head.

**The owner's request, as `plan.md` section 1 quotes it** (audit lines 118-131):
"ADM-05: the 404 and 500 pages cannot be published from their screen, and the website
build needs them published. ... Fix: Route saves through the draft and publish flow. Add
Publish and state to the screen. Decision O-16 on the meta-description rule for noindex
pages." O-16 is answered (a), "Yes, only 404 and 500" (owner, card, 12 November 2026, as
relayed; `implementation.md` section 1).

Read this round: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md` and
`ENGINEERING_STANDARDS.md` as they now stand on the base, `plan.md` sections 1, 5 and 6,
`implementation.md` sections 6, 9, 11 and 12, and round 1 above.

**Machine:** Windows 11, Git Bash, Node `v24.19.0` (CI uses 22), .NET SDK `10.0.401`,
Semgrep installed, gitleaks not installed. Per the coordinator's instruction no local
database was reset, read or written: the local end-to-end harness fails at "Release
migrations" and `DigitalHubContent_E2e` is empty. Local API and end-to-end suites are
NOT RUN; the CI jobs that cover them are quoted below. Logs were read with
`gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`.

### 1. The red tests were red (gate 1 condition 10, the G3 rule)

A CI run exists on the red commit. `gh run list --commit 63c15dc…` gives CI
`43213617726` (failure), Security `43213617752` (success), Workflow lint `43213617687`
(success) and CodeQL `43213617607` (skipped), all `pull_request` on PR #57
(`change/ADM-05-red`, draft, head `63c15dc`), run on 12 November 2026 at 15:34 UTC.

**Job `api`, `131290463138`, at `63c15dc`:** build `13 Warning(s)`, `0 Error(s)`, so the
first compile of the test file passed against the base API. Test step:

```
Test Run Failed.
Total tests: 551
     Passed: 543
     Failed: 8
```

| Test | Plan 5.4 expects | Result at `63c15dc` | Failing assertion, as logged |
| --- | --- | --- | --- |
| T1 `A_save_on_a_published_error_page_does_not_reach_the_build` | red | Failed | `Assert.Contains() Failure: Sub-string not found` ... `Not found: "Body A"` (line 55): the save reached the build |
| T2 `The_list_shows_the_draft_and_its_state` | red | Failed | `KeyNotFoundException` at `JsonElement.GetProperty` (line 84): no `state` |
| T3 `An_editor_publishes_a_saved_error_page_draft` | red | Failed | `"title":"Publishing is blocked until every check passes." ... "errors":{"metaDescription":["Add a meta description. ..."]},"code":"publish_blocked"` (line 109) |
| T4 `A_published_error_page_goes_live_only_at_publish` | red | Failed | `Not found: "Body A"` (line 139): the build had "Body B" before Publish |
| T5 `An_error_page_save_refuses_an_image_not_in_the_library` | red | Failed | the 200 body `{"type":"404",...,"mediaId":"44aa352b-…","alt":"Diagram"...,"version":2}` (line 168): no library check |
| T6 `An_error_page_save_keeps_the_section_s_other_fields` | red | Failed | `eyebrow was dropped: {"heading":"Still not found","body":...}` (line 196) |
| T7 `An_error_page_save_is_audited_as_a_page_save` | red | Failed | `Assert.Single() Failure: The collection was empty` (line 224): no audit row with the page id |
| T8 `An_ordinary_page_still_needs_a_meta_description` | green (guard) | Passed [93 ms] | |
| T9 `A_save_on_a_draft_error_page_stays_out_of_the_build` | red | Failed | `KeyNotFoundException` at `GetProperty` (line 266): no `state` |
| T10 `A_stale_version_is_a_conflict` | green (guard) | Passed [31 ms] | |
| T11 `HR_cannot_read_save_or_publish_error_pages` | green (guard) | Passed [121 ms] | |
| Every existing test | green | 543 passed = 540 existing + T8, T10, T11 | `grep "Failed DigitalHub"` lists only the eight above |

Each red is at the assertion plan 5.1 names, for the reason it gives. T13 is not in
`63c15dc`; it is a guard written after the fix (section 2).

**Job `studio`, `131290462489`, at `63c15dc`:** unit tests `Test Files 12 passed (12)`,
`Tests 94 passed (94)` (the S tests are not in commit 1). End-to-end:

```
✘   4 e2e/error-pages.spec.ts:37:1 › ADM-05 error pages: save is a draft, publish puts it live (361ms)
    Error: publish error-404 at set-up: {"type":"https://tools.ietf.org/html/rfc7807","title":"Publishing is blocked until every check passes.","status":400,"errors":{"metaDescription":["Add a meta description. It falls back t…
    > 60 |       expect(published.ok(), `publish error-${type} at set-up: ${await published.text()}`).toBeTruthy();
  2 failed
  30 passed (3.9m)
```

E1 fails at step 1, at the set-up publish, as plan 5.4 expects under (a). The second
failure is `e2e/redirects.spec.ts:37:1 › ADM-07 redirects ...` (`Test timeout of 90000ms
exceeded`, then `Target page, context or browser has been closed` in its `finally`).
That spec is not ADM-05's: it is the ADM-07 flake that ADM-07c (#62) fixed on the base,
and it passes at the head (section 3). So plan 5.4's "every other spec passes" is not
literally met on the red run. I record it as an observation, not a finding, because no
ADM-05 file touches that spec or its screen.

**Job `website` at `63c15dc`:** success (`Website — typecheck, tests, design check,
snapshot build`, `131290463027`).

**Rework reds (S9 to S12), checked by me.** In a scratch copy of `studio/` with the head
tests and `node_modules` linked, I replaced `studio/src/pages/ErrorPagesPage.tsx` with its
`294fb4d` (pre-rework) version and ran `npx vitest run test/errorPages.test.tsx`: exit 1,
`Tests 4 failed | 7 passed (11)`:

```
× sends one save while a save is in flight
× sends one publish while a publish is in flight
× a new publish clears the card's old problems, and a conflict names the page
× a new save clears the card's old problems, and a conflict names the page
AssertionError: expected false to be true // Object.is equality            (twice)
AssertionError: expected '404 pagedraftPublishing is blocked un…' to contain '404 page: Someone else changed this p…'
AssertionError: expected '500 pagedraftOne or more fields are i…' to contain '500 page: Someone else changed this p…'
```

This matches `implementation.md` section 11. Nothing was written in either worktree.

### 2. The rework: round 1 findings and the developer's answers

| # | Round 1 finding | Answer | Checked |
| --- | --- | --- | --- |
| 1 | Minor: no in-flight guard; a double-click sends two requests and shows a false conflict | `f067d95`: `begin`/`end` with a `busyRef` refuse a second request before React redraws; both buttons of the card are disabled while in flight; the other card stays usable. Tests S9, S10 (`2670e8c`) | Read the code (`ErrorPagesPage.tsx:36-54`, 75-82, 110-117, 172-173). S9 and S10 red at `294fb4d` (section 1), green at the head locally and in CI. **Closed** |
| 2 | Minor: old findings stay on a card after a later 409; the 409 does not name the page | `1d9778b`: `begin` clears the card's problems and conflict; a 409 sets a per-card flag, shown on that card as "`<type> page:` Someone else changed this page." Tests S11, S12 (`3a69005`) | Read the code (lines 31-32, 46-47, 91-92, 122-123, 160-162). S11 and S12 red, then green. S6 passes unchanged. **Closed** |
| 3 | Minor (test gap): no test pins the `collection == "pages"` half of `PublishChecks.IsErrorPage` | `14f4b48`: T13 `An_item_in_another_collection_with_an_error_page_slug_still_needs_a_meta_description` creates a service with slug `error-404`, publishes it as editor and asserts 400 `publish_blocked` with `errors.metaDescription`. It removes any such service before and after | CI job `api` at the head: `Passed DigitalHub.Api.Tests.ErrorPagePublishTests.An_item_in_another_collection_with_an_error_page_slug_still_needs_a_meta_description [79 ms]`. Mutation check (remove `collection == "pages" &&` and watch T13 fail): NOT RUN, because it needs SQL Server. By reading: without the clause, `IsErrorPage("services", "error-404")` is true, `AddDescription` is skipped (`PublishChecks.cs:32`), no `metaDescription` key is produced, and T13's `TryGetProperty("metaDescription")` assertion fails. CI job `api` covers the pass. **Closed** |

The rework touched only `ErrorPagesPage.tsx`, `errorPages.test.tsx`,
`ErrorPagePublishTests.cs` and `implementation.md` (`git diff --stat 294fb4d 741d70c`:
4 files, 247 insertions, 7 deletions). No route, policy, lockfile, workflow or
migration.

### 3. Every check round 1 marked PENDING, from CI on `36b1922`

Runs on `36b1922`, all `pull_request` and `completed`: CI `44413974942` success,
Security `44413974926` success, Workflow lint `44413974837` success, CodeQL
`44413974795` success.

**Job `api` (`135189246143`), `API — Release build, migrations, integration tests`:**

- `dotnet build DigitalHub.slnx -c Release`: `13 Warning(s)`, `0 Error(s)`. Every
  warning is in `api/tools/DigitalHub.ContentImport/ContentWriter.cs`
  (`grep "warning CS" | grep -v ContentImport`: nothing). The ceiling of 13 holds, and
  ADM-05's C# adds no warning.
- `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build ...`:

```
Test Run Successful.
Total tests: 557
     Passed: 557
```

  557 = 551 at the red commit + 5 from ADM-10's `SettingsShareImageTests.cs` (merged in
  `0b3ef34`) + T13. The log has no `Failed` or `[FAIL]` line.

| Test | Result at `36b1922` |
| --- | --- |
| T1 `A_save_on_a_published_error_page_does_not_reach_the_build` | Passed [259 ms] |
| T2 `The_list_shows_the_draft_and_its_state` | Passed [26 ms] |
| T3 `An_editor_publishes_a_saved_error_page_draft` | Passed [33 ms] |
| T4 `A_published_error_page_goes_live_only_at_publish` | Passed [55 ms] |
| T5 `An_error_page_save_refuses_an_image_not_in_the_library` | Passed [15 ms] |
| T6 `An_error_page_save_keeps_the_section_s_other_fields` | Passed [18 ms] |
| T7 `An_error_page_save_is_audited_as_a_page_save` | Passed [28 ms] |
| T8 `An_ordinary_page_still_needs_a_meta_description` | Passed [86 ms] |
| T9 `A_save_on_a_draft_error_page_stays_out_of_the_build` | Passed [20 ms] |
| T10 `A_stale_version_is_a_conflict` | Passed [18 ms] |
| T11 `HR_cannot_read_save_or_publish_error_pages` | Passed [128 ms] |
| T13 `An_item_in_another_collection_with_an_error_page_slug_still_needs_a_meta_description` | Passed [79 ms] |
| `AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them` (contract, unchanged) | Passed [97 ms] |

The plan's filter run (`ErrorPagePublishTests|AdminApiTests|BuildContentTests|ContentPublishTests|RedirectTargetRuleTests|MediaLibraryTests|ContentBundleTests`)
is a subset of the full run, which passed 557 of 557, so it is covered.

**Job `studio` (`135189245689`), `Studio — typecheck, build, end-to-end`:** `npm ci`,
`npx tsc -b`, then `npm test`: `Test Files 14 passed (14)`, `Tests 109 passed (109)`, with
all 11 tests of `test/errorPages.test.tsx` passing: S1 `shows each page's state`, S2
`publishes with the page's version and reloads`, S3 `will not publish unsaved edits`, S4
`lists what blocks a publish`, S5 `says a save on a published page is a draft`, S6 `a
stale publish says someone else changed the page`, S7 `lists what blocks a save`, S9
`sends one save while a save is in flight`, S10 `sends one publish while a publish is in
flight`, S11 `a new publish clears the card's old problems, and a conflict names the
page`, S12 `a new save clears the card's old problems, and a conflict names the page`.
`npm run build`: `Preview design: /website-design/d1ebe4132f8cfa8e/ matches
website/design/ byte for byte.` End-to-end (`npx playwright test --reporter=list,html,junit`,
on the job's fresh `DigitalHubContent_E2e`):

```
✓   4 e2e/error-pages.spec.ts:37:1 › ADM-05 error pages: save is a draft, publish puts it live (3.9s)
✓   9 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (5.0s)
✓  22 … ✓ 33 e2e/verification.spec.ts P2.1 … P2.12 (P2.12 "Every sidebar screen loads with no console error, as admin and as editor")
  33 passed (3.6m)
```

E1 is green, and `verification.spec.ts`, the second spec plan 5.3 names, passes in full.
33 = the red run's 32 specs + ADM-10's `settings.spec.ts`.

**Job `website` (`135189246321`):** `npm run typecheck` passes; `npx vitest run`: `Test
Files 23 passed | 1 skipped (24)`, `Tests 431 passed | 31 skipped (462)`; `npm run
design:check`: `All 25 files match: 24 identical, 1 ported with the recorded change.`;
`npm run build`: `web.config: 0 redirect(s), report-only content security policy, custom
404 and 500.`, `Build output checks passed.`

**Job `website-browser` (`135189246067`):** `browser suite: 29 tests; default 4 passed,
25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures`.

**Job `section-compare` (`135189895334`):** the job succeeds. Its step has
`continue-on-error: true` (`ci.yml:326`) and printed `104/119 sections match; 14
accepted; 1 failures (including chrome).` and `differs: /careers/apply.html #section`.
The base's own run (CI `44412456796`, job `135184517067`, at `793c43e`) prints the same two
lines, and `git diff --quiet 793c43e 36b1922 -- website` exits 0. This is the known open
section difference on the base, not ADM-05's.

**`screenshot-parity`:** skipped (optional, label "screenshots"), as on every PR without
the label.

**`workflow-lint.yml` (`135189245042`):** success. The self-test prints `ok 1 no findings`
... `ok 7 blocking date unset`.

**`security.yml`:** see section 6.

### 4. Plan 5.3 commands, run locally on `36b1922`

| Command | Exit | Output |
| --- | --- | --- |
| `cd api && dotnet build DigitalHub.slnx -c Release` | 0 | `Build succeeded.`, `13 Warning(s)`, `0 Error(s)` |
| `cd api && dotnet test ... -c Release --no-build` (full and filter) | NOT RUN | The coordinator's instruction: no local database work this round. CI job `api` covers it, 557 of 557 (section 3) |
| `cd studio && npm ci --no-audit --no-fund` | 0 | `added 245 packages in 7s` |
| `cd studio && npx tsc -b` | 0 | no output |
| `cd studio && npm test` | 0 | `Test Files 14 passed (14)`, `Tests 109 passed (109)` |
| `cd studio && npx vitest run test/errorPages.test.tsx --reporter=verbose` | 0 | all 11 pass (S1 to S7, S9 to S12), `Tests 11 passed (11)` |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 701ms`; `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| `cd studio && npx playwright test` and `npx playwright test e2e/error-pages.spec.ts e2e/verification.spec.ts` | NOT RUN | The local harness fails at "Release migrations", and no database writes are allowed this round. CI job `studio`, "End-to-end suite", covers it: 33 passed (section 3) |
| `cd website && npm ci --no-audit --no-fund` | 0 | installed (npm printed only its `allow-scripts` notice) |
| `cd website && npm run typecheck` | 0 | `tsc --noEmit`, no error |
| `cd website && npm test` | 1 | `Test Files 1 failed \| 23 passed (24)`, `Tests 22 failed \| 439 passed \| 1 skipped (462)`. All 22 are in `test/screenshot-parity-browser.test.ts` ("the register guard in Chromium (local only)"), with `Error: listen EADDRINUSE: address already in use 127.0.0.1:4284`. That port is held by a process I did not start, and I left it alone. The file is local-only and skipped in CI (its header: "The website CI job installs no browser, so there they are skipped"), and ADM-05 changes no `website/` file. Environment, not a finding. CI job `website`: 431 passed, 31 skipped |
| `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 1, then 0 | First run: the pages were generated, then Next.js 16.4.3 stopped with `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.` and printed an upgrade prompt addressed to coding agents. I did not run the upgrade it names: it is out of scope and would change a lockfile. A second run of the same command: exit 0, `25 pages, plus error pages: 404.html, 500.html`, `web.config: 0 redirect(s), report-only content security policy, custom 404 and 500.`, `Build output checks passed.` The advisory behind the prompt is moderate (section 6). CI job `website` builds cleanly |
| `cd website && npm run compare:sections` | NOT RUN locally | Needs a `feature/interviewer-portal` checkout, and agents may not open DH-WEBSITE-main. CI job `section-compare` covers it (section 3) |

### 5. Base merge

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Files the merge changes on ADM-05's side | `git diff --name-only 741d70c 36b1922` | 0 | 27 files: `.claude/commands/change.md`, `.github/pull_request_template.md`, `AGENTS.md`, `CLAUDE.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`, `docs/adr/0001-…`, `docs/changes/ADM-07c/*`, `docs/changes/GAP-34/*`, `docs/changes/README.md`, `docs/deferred-items.md`, `docs/quality/*` (4), `studio/e2e/redirects.spec.ts`, `website/README.md` |
| Any of those outside the base's own changes | `comm -23` of the above against `git diff --name-only 2bbd586 793c43e` | 0 | empty |
| Overlap with ADM-05's files (`git diff --name-only 2bbd586 741d70c`: the five source files, the three test files, `docs/changes/ADM-05/*`) | `comm -12` | 0 | empty |
| ADM-05's files unchanged by the merge | `git diff --quiet 741d70c 36b1922 -- <ADM-05's 13 files>` | 0 | no difference |
| The base's files are exactly the base | `git diff --quiet 793c43e 36b1922 -- <the base's 27 files>` | 0 | no difference |

The merge is mechanical: it brings in the base's files as they are, and changes nothing
in ADM-05's.

### 6. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, website, full tree | `cd website && npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities`: `fast-uri 3.0.0 - 3.1.8` (as in round 1) and, new since round 1, `next 16.2.0 - 16.4.4` (GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8, both moderate). Below the high level. ADM-05 changes no lockfile (`git diff --name-only 32f0414 36b1922 -- '*package-lock.json' '*.csproj' .github/workflows`: empty) |
| npm audit, studio, full tree | `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| Gate script, website | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Gate script, studio | the same, `studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `run-dotnet-audit.sh` | `cd api && RUNNER_TEMP=<scratch> sh ../.github/security/run-dotnet-audit.sh` | 0 | no vulnerable packages for `DigitalHub.Api`, `DigitalHub.Api.Tests` and `DigitalHub.ContentImport`; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` (repository root) | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (`csharp-sqli` in `AuditRollbackTests.cs:78`, already listed). The parse warnings on `ContentStore.cs` and `AdminControllers.cs` are on the base too: the base job has 37 parse warnings and the head job 38, the new one being `studio/test/errorPages.test.tsx` |
| Gitleaks | NOT RUN locally | Not installed. CI `security.yml` covers it: `gitleaks-pr` (`135189462674`): `18 commits scanned.`, `no leaks found`, `pr-diff: 0 finding(s) … 0 new.`; `gitleaks-history` (`135189462670`): `565 commits scanned.`, `full-history: 2 finding(s) at the gate's level; 2 known, 0 new.` |
| CI `security.yml` on `36b1922` | job logs | all success | `npm-audit` website and studio `0 new`; `dotnet-vulnerable` `0 new`; `semgrep` `1 known, 0 new`; gate self-test `ok 71 - known semgrep findings stay listed…`; CodeQL `csharp` and `javascript-typescript` success |
| Secrets in the diff | `git diff 32f0414 d35fdd8; git diff 0b3ef34 741d70c`, added lines grepped for `password\|secret\|token\|apikey\|connectionstring\|BEGIN .*KEY\|Bearer\|Passw0rd` | 0 | Only references to fixture names (`ApiFactory.AdminPassword`, `ApiFactory.BuildTokenValue`, `X-Build-Token`, `e2ePassword`, the `Bearer` header built from a login). No literal secret. My output prints no secret. The CI logs show only the workflow's own `CiOnly…` service passwords, which are older than this change |

**Role matrix.** No route, policy or role is added or changed. `AdminControllers.cs`
changes only the store type and one method name, and `Program.cs` and `Infrastructure/`
are unchanged (`git diff --quiet 2bbd586 36b1922 -- …Program.cs …Infrastructure`: exit 0).

| Route | Anonymous | Admin | Editor | HR | Wrong record | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/v1/error-pages` | 401 (`[Authorize(Policy = "studio")]`) | 200 | 200 | 403 | n/a | T11 passed (HR 403); T2, T3 (editor); the `AdminApiTests` contract test passed |
| `PUT /api/v1/error-pages/{type}` | 401 | 200 | 200 | 403, record unchanged | `type` not `404`/`500`: 400; missing page: 404 "That error page does not exist."; stale version: 409 `concurrency_conflict` | T11 and T10 passed; T1 to T7 and T9 passed |
| `POST /api/v1/pages/{id}/publish` (existing, now used by the screen) | 401 | 200 | 200 | 403 (`[StudioAccess]`: HR only reads and ends vacancies) | another page: the same reach editors already have in Pages | T11, T3 and E1 passed |

- **HR cannot reach the routes:** T11 passes at the red commit and at the head. This is
  the "cannot do" test. The E2E test `10.17 an editor does not see admin screens and
  admin APIs return 403` also passes.
- **Host checks:** the API has no host-based routing (`AllowedHosts: "*"`, no
  `RequireHost`), and the website is a static build served separately. Not applicable to
  this change; host isolation belongs to track G2 (ISO-1 to ISO-6).
- **Unknown fields and body size:** unchanged from round 1. `ErrorPageUpdate` binds with
  the default options, so an unknown field is ignored, not rejected, and the route has no
  `[RequestBodyLimit]`. This is the same for every content route before and after ADM-05.
  It is tracked as GAP-25 (refinement plan line 96, Wave 3) and as A-5 "Partial: request
  DTOs not verified" in `ENGINEERING_STANDARDS.md` line 96. An observation, not a finding
  of ADM-05.
- **Error shape:** every refusal goes through `AdminResponse.From`. The CI red log shows
  the shape as sent: `{"type":"https://tools.ietf.org/html/rfc7807","title":"Publishing
  is blocked until every check passes.","status":400,"errors":{...},"code":"publish_blocked"}`.
  No stack trace or internal text.
- **Login or permission change:** none.

### 7. Beyond the plan

Probes against the head screen with the committed harness, in a scratch copy of
`studio/` (`C:\Users\alimo\AppData\Local\Temp\claude\5edc2c132a17319a\2a2d75d3-ccb5-4b21-a94a-203b08c33af4\scratchpad\studio-probe\test\probe.test.tsx`,
with `node_modules` linked by a junction that was removed afterwards; nothing was written
in either worktree). `npx vitest run test/probe.test.tsx --reporter=verbose --silent=false`,
exit 0:

| Probe | Output | Result |
| --- | --- | --- |
| P8: Publish the 500 card; its reload is read before the 404 Save commits and answered after it | `P8 chip after save: changed; after stale reload: published; title: Page not found`; then `P8 second PUT body: {"version":3,"title":"Again",…}` | The reload puts back the 404 card's state and version from before a Save that succeeded. Finding 1 |
| P9: type in the title while a Save is in flight | `P9 title after save: First; publish disabled: false` | The text typed during the request is replaced by the saved answer. The base screen does the same (`32f0414` also calls `setItems(... saved ...)` on success), so this is not a regression of ADM-05. Observation |
| P10: a 500 on Save, then a successful Publish of the other card | `P10 error line still shown: false; 404 title kept: X` | The reload clears the screen's error line and keeps the 404 card's unsaved edit. Correct |

S9 to S12 now cover round 1's probes P1, P2 and P4; P3, P5, P6 and P7 were already
correct.

### 8. Findings

No Blocker. No Major. One Minor, for the developer.

1. **Minor: a reload started by one card's Publish can undo another card's Save on
   screen.**
   - Steps: on the Error pages screen, with both pages published, click Publish on the
     500 card. While its reload (`GET /api/v1/error-pages`) is in flight, edit the 404
     title and click Save. The 404 Save is answered first (200, version 4, "changed").
     Then the reload answers with the list it read before the Save committed (version 3,
     "published"). Probe P8 reproduces this with held answers.
   - Expected: the 404 card keeps the saved answer (chip "changed", the new title,
     version 4), because it is newer than the reload.
   - Actual: the 404 card shows chip "published", the old title "Page not found" and
     version 3. Its next Save sends `"version":3`, which the API refuses with 409, so the
     card then says "404 page: Someone else changed this page." when nobody did. Nothing
     is lost on the server: the first Save is stored as a draft, and the version check
     stops the stale Save.
   - Cause: `load()` (`ErrorPagesPage.tsx:68`) keeps only the cards that are dirty when
     the answer arrives, and a successful Save clears dirty (line 103), so an older answer
     replaces a newer one. It needs two requests to overlap in a narrow window, which is
     why it is Minor. The reload after Publish is new in ADM-05, so this is in scope.

Observations, not findings of this change:

- The red run's `e2e/redirects.spec.ts` failure is the ADM-07 flake that ADM-07c (#62)
  fixed. It passes at the head.
- `section-compare` reports `differs: /careers/apply.html #section` on the base and the
  head alike.
- `next 16.2.0 - 16.4.4` now has two moderate advisories in `website/`. They are below
  the gate's level and ADM-05 changes no lockfile. For the security track, not this
  change.
- Unknown fields are ignored and there is no per-route body cap on
  `PUT /api/v1/error-pages/{type}`: older than this change, shared with every content
  route, tracked as GAP-25.
- P9 (text typed during an in-flight Save is replaced): base behaviour.
- O-ADM05-3 (the owner publishes both pages in `DigitalHubContent_Studio`) has still not
  been asked. It is for the G3-1 exit gate, not gate 2 (`plan-approval.md` line 88).

### 9. Track checklist (G3)

| Rule | State | Evidence |
| --- | --- | --- |
| Finding, evidence and fix come from the audit | Met | Plan section 1 quotes audit lines 118-131; fixes `71edc31`, `a3a94d7`, `e8dc356` |
| Regression test committed and shown failing before the fix | **Met** | T1 to T7 and T9 red in CI at `63c15dc` (job `api` `131290463138`: 8 failed, each at its assertion); E1 red at step 1 (job `studio` `131290462489`); S1 to S7 red (round 1); S9 to S12 red (section 1). All green at `36b1922` |
| End-to-end test for each Major | Met (ADM-05 is a Blocker; E1 was added for the G3-1 gate) | E1 red at `63c15dc`, green at `36b1922` |
| A Minor not fixed becomes a D-NNN entry | Not applicable | No audit Minor is left. Finding 1 above is mine, for the developer |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | Met for ADM-05 | T1 (go-live on save), T3 and E1 (blocked publish), T5 (ADM-03 handover): red at `63c15dc`, green at `36b1922` |
| G3-1 exit gate: a clean build from `DigitalHubContent_Studio` | Not met by this change alone | Waits on O-ADM05-3 and O-ADM02-2 (plan 5.5) |

### 10. Coverage rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| Saves on the error pages go through the draft flow: a published page changes only at Publish | Verified | T1 and T4 red at `63c15dc`, green at `36b1922`; E1 green |
| The screen shows each page's state | Verified | S1 (red in round 1, green in CI); T2 red, then green |
| The screen can publish each page | Verified | S2, S3, S6 green in CI; E1 red, then green |
| The screen lists what blocks a publish | Verified | S4 green in CI |
| The meta-description rule, as the owner decides ((a)) | Verified | T3 red, then green; T8 green at both; T13 green at the head (round 1 finding 3) |
| Publishing through Pages is no longer blocked for these pages | Verified | T3 and T4 use the page publish route; green |
| The error-page save refuses an image not in the library | Verified | T5 red, then green |
| Error-page saves are no longer a separate write path | Verified | Round 1 reading; T7 red, then green (audit `update_error_page` on `page`) |
| A save keeps the text section's other fields | Verified | T6 red ("eyebrow was dropped"), then green |
| `GET` and `PUT` never create an error page; HR cannot reach them | Verified | `AdminApiTests.Error_pages_are_editable_and_get_does_not_create_them` passed; T11 passed at red and head |
| Regression tests committed and shown failing before the fix | Verified | Section 1 |
| An end-to-end test of save-as-draft and publish on the screen | Verified | E1: `✘` at `63c15dc` with "publish error-404 at set-up", `✓` at `36b1922` |
| A refused save lists its fields on the screen | Verified | S7 green in CI |
| Test report round 1, Minors 1 to 3 | Verified closed | Section 2 |
| The base merge changes nothing in ADM-05's files | Verified | Section 5 |
| No website change; website suites unchanged | Verified | CI job `website`; local typecheck, design check and build |
| CI on the final head: `api`, `website`, `studio` (unit and E2E), `section-compare`, `website-browser`, `security.yml`, `workflow-lint.yml` | Verified | Sections 3 and 6 |
| G3-1 exit gate: a clean build from `DigitalHubContent_Studio` | Not verified (batch gate) | Waits on O-ADM05-3 and O-ADM02-2 |

Every planned check now passes, in CI or here, and the red evidence that the G3 rule and
gate 1 condition 10 ask for is in CI on PR #57. The three round 1 Minors are closed.
There is no Blocker or Major; the one new Minor goes back to the developer.

### 11. Observation added after gate 2 (condition 6): CI run `43249537203` on `741d70c`

CI run `43249537203` (`pull_request`, 12 November 2026, 15:35 UTC) ran on `741d70c`, the
developer's head before the base merge, and concluded `failure`. I read the job logs with
`gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`:

- **Job `api` (`131291245875`), success:** build `13 Warning(s)`, `0 Error(s)`; tests:

```
Passed DigitalHub.Api.Tests.ErrorPagePublishTests.An_item_in_another_collection_with_an_error_page_slug_still_needs_a_meta_description [97 ms]
Test Run Successful.
Total tests: 557
     Passed: 557
```

- **Job `studio` (`131291246385`), failure:** unit tests `Test Files 14 passed (14)`,
  `Tests 109 passed (109)`. End-to-end:

```
✓   4 e2e/error-pages.spec.ts:37:1 › ADM-05 error pages: save is a draft, publish puts it live (3.7s)
✘   9 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (1.5m)
    Test timeout of 90000ms exceeded.
  1 failed
    e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged
  32 passed (4.7m)
```

- Jobs `website`, `website-browser` and `section-compare`: success; `screenshot-parity`
  skipped.

The only failure is the ADM-07 redirects flake, in a spec ADM-05 does not touch. `741d70c`
did not yet have ADM-07c (#62) from the base; at `36b1922`, which has it, the same spec
passes (`✓   9 e2e/redirects.spec.ts:45:1`, section 3). E1 and all 557 API tests pass on
`741d70c` as on `36b1922`. An observation, not a finding of ADM-05.

Verdict: APPROVED
