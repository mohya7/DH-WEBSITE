# ADM-10: delivery approval (gate 2)

Technical lead, gate 2, 12 November 2026.

- **Pull request:** #56, `change/ADM-10` into `rebuild/dotnet-platform`. From
  `gh api …/pulls/56`: `head=760daea draft=true base=32f0414 labels=["screenshots"]`.
- **Code head:** `daa3de9` (last source commit). `73dc514` is the first head with every
  code commit; everything after it changes only `docs/changes/ADM-10/`
  (`git diff --stat 73dc514 HEAD`: `implementation.md`, `test-report.md`).
- **Records head:** `760daea` (test report). Base `32f0414`
  (`git merge-base HEAD origin/rebuild/dotnet-platform`). Worktree clean.
- **Records read:** `plan.md` round 2 (`1059d39`), `plan-review.md` round 2 (APPROVED),
  `plan-approval.md` (`b2889cd`, APPROVED, seven conditions), `implementation.md`
  (`d3e54bb`, READY FOR TEST), `test-report.md` Round 1 (`760daea`, APPROVED, three
  Minors, two observations). `docs/changes/README.md`, `CLAUDE.md` / `AGENTS.md`, the
  refinement plan (`/mnt/project-files/docs/quality/`, slot rule at line 21).
  `ENGINEERING_STANDARDS.md` and `.github/pull_request_template.md` are not in the tree.

This approval is a pipeline role. It is not the owner's merge confirmation and it
answers no owner question.

## Decision

**Approved, with the open items below.** The diff is the approved plan, under owner
answers O-ADM10-1 "Yes" and O-ADM10-2 (a). The tests-only commits came first and CI
went red on them before any fix was pushed. Every CI job is green on `8b9feff`, which
has the same code as the head. The three tester Minors are accepted and moved to a
named follow-up; none of them weakens the evidence for the fix.

## Owner answers

As the coordinator relayed them, both on their cards, 11 November 2026, 14:07 UTC:

- **O-ADM10-1:** "Yes, red tests first".
- **O-ADM10-2:** "Yes, add it and use it" (option (a)).

`plan.md` section 9 still says PENDING for both. That is expected (the developer does
not edit the plan); `implementation.md` and the pull request body carry the quotes.
The red run started at 14:12 UTC, after the answers.

## What I verified myself

### Scope, commits, red first

| Check | Command | Result |
| --- | --- | --- |
| Heads | `git rev-parse HEAD origin/change/ADM-10 origin/rebuild/dotnet-platform` | `760daea`, `760daea`, `32f0414` |
| Scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 12 files: `AdminStore.cs`, `SettingsPage.tsx`, `head.ts`; `SettingsShareImageTests.cs`, `settingsShareImage.test.tsx`, `settings.spec.ts`, `seo.test.tsx`; five records. Exactly plan section 4 plus the records. No `MediaPicker.tsx`, `ItemEditorPage.tsx`, `FormWalker.tsx`, `rich-text.spec.ts`, workflow, lockfile, `package.json`, `*.csproj` or migration (condition 2) |
| Source diff against the plan | `git diff 32f0414 HEAD -- api/src studio/src website/src`, read in full | Matches 3.1 to 3.3. `AdminStore.cs`: the exists check before the version check, guarded by `DefaultShareImageIdSent`; the two conditional copies; `LimitText(..., "defaultShareImageAltOverride", ..., 300)`; backing fields, and `internal bool …Sent { get; private set; }` (condition 3). Nothing else. `SettingsPage.tsx`: the two type fields, `ShareImageField` as a registered `Form.Item`, the alt `Input maxLength={300}`, `MediaPicker` a sibling of the `<Form>` with `form.setFieldValue`. `head.ts`: `fallback` only when the item has no `shareImageId` |
| Red commits hold tests only (B-6) | `git log --oneline 32f0414..HEAD`; `git diff --stat` per commit | `b1521f5` (T1 to T5, E1, W1/W2) and `bf29cb2` (S1 to S4) come before `54bd132`, `884bca6`, `daa3de9`. Each fix commit touches one source file |
| Push order (condition from O-ADM10-1) | `gh api "…/actions/runs?branch=change/ADM-10"` | Only `b1521f5` ran first (run 43036287741, 4 attempts). The next push, `73dc514`, ran at 12 Nov 07:11 UTC, after attempt 4's `studio` job ended at 07:09 (log timestamp). No run on any SHA in between |
| B-4 | `git log --format='%h %s%n%(trailers:only,unfold)' 32f0414..HEAD` | All 15 branch commits: subject `ADM-10:` plus an imperative or a record name; each ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line |

### CI, from the saved job logs and the GitHub API

| Evidence | Source | Result |
| --- | --- | --- |
| `api` red at `b1521f5` (merge `a211c54`) | `adm10-red-api.log`, `adm10-red-api-attempt2.log` | Both: `[FAIL]` for exactly the five `SettingsShareImageTests` (T1 to T5), `Total tests: 545`, `Passed: 540`. T2's red is its alt-only half, which is the bug; the tester's reading holds and the test is stronger than the plan predicted, not weaker |
| `studio` red at `b1521f5`, attempt 4 (job 131027779373) | `adm10-red-studio-attempt4.log` | `✘ 11 e2e/settings.spec.ts:73:1 … (1.5m)`, `Test timeout of 90000ms exceeded.`, `apiRequestContext.get: Target page, context or browser has been closed` at `settings.spec.ts:135:35`, `1 failed`, `31 passed (6.0m)`. The API log has E1's setup and the Settings page loads at 07:05:18 and then no request until the next spec's login at 07:06:49: no picker query, no PUT. With `expect` at 15 s and no `actionTimeout`, only an action waits 90 s, and the first action is the "Choose image" click. So E1 stopped where the plan said, by elimination (Minor 1) |
| `studio` attempts 1 to 3 | `adm10-red-studio*.log` | apt/DNS failures before any end-to-end test; recorded, nothing hidden |
| Green at `73dc514` (merge `a63fb4e`), run 43173375547 | `adm10-green-api.log`, `adm10-green-studio.log` | `api`: `Total tests: 545`, `Passed: 545`. `studio`: `✓ 11 e2e/settings.spec.ts:73:1 … (12.3s)`, `32 passed (4.7m)`. E1's cleanup ran: the restore `PUT /api/v1/settings` 200 and both `DELETE /api/v1/media/{id}` 204 at 07:15:27-28 |
| Code-equivalent head `8b9feff`, run 43174717473 | `gh api …/runs/43174717473/jobs` | `head_sha 8b9feff`. Website 131036177485, Studio 131036177622, website-browser 131036177672, API 131036177727, Screenshot parity 131036544539, Section comparison 131036544632: all `success` (condition 4: both were skipped at commit 1, green here) |
| Records head `760daea` | `gh api "…/runs?head_sha=760daea…"` | Security 43185533244 and Workflow lint 43185533172 success, CodeQL skipped; **CI 43185533188 in progress** (open item 1). The run on `d3e54bb` (43184443685) was cancelled by the `760daea` push, as superseded |

The screenshot parity job's "Compare screenshots" step does not fail the workflow while
the register has no approved entries (`ci.yml:358-359`). Its success is not parity
evidence. What counts here is that the Chromium regression tests passed, and that the
snapshot has both settings fields `null`, so `head.ts` cannot change the snapshot output.

### Re-run here (fastest suites covering the change)

No `dotnet` and no SQL Server here, so the API and Playwright evidence is the CI above.

| Command | At | Exit | Output |
| --- | --- | --- | --- |
| `cd studio && npx vitest run test/settingsShareImage.test.tsx` | `760daea` | 0 | `Tests  4 passed (4)` |
| `cd studio && npm test` | `760daea` | 0 | `Test Files  13 passed (13)`, `Tests  98 passed (98)` |
| `cd studio && npx tsc -b` | `760daea` | 0 | none |
| `cd website && npx vitest run test/seo.test.tsx` | `760daea` | 0 | `Tests  12 passed (12)` |
| `npx vitest run test/seo.test.tsx`, in a `git archive` copy of `website/` and `packages/` at `b1521f5` (scratchpad, node_modules linked) | `b1521f5` | 1 | `× uses the settings alt with the default share image`, `Expected: "Digital Hub logo"`, `Received: "National e-services portal for a government ministry"`, `Tests  1 failed \| 11 passed (12)` |
| `npx vitest run test/settingsShareImage.test.tsx`, in a `git archive` copy of `studio/` at `bf29cb2` | `bf29cb2` | 1 | All four `×`, `Tests  4 failed (4)` |

The scratch copies were removed afterwards. No database, port or process was touched.

### The tester's evidence

Real: every row has a command, exit code and output, or NOT RUN with the reason and the
CI job that covers it. Where I re-ran or read the same thing, it matches: scope, red
commit contents, W1 and S1 to S4 reds, 98 Studio unit tests, the CI totals, E1's red
and its cleanup lines. Every row of the coverage table in `implementation.md` and in
the test report has evidence.

## Gate 1 conditions

| # | Condition | Met? | Evidence |
| --- | --- | --- | --- |
| 1 | Base contains `origin/rebuild/dotnet-platform` | Yes | Merge base `32f0414` = current `origin/rebuild/dotnet-platform` (re-fetched today) |
| 2 | Scope: section 4 files only | Yes | Diff stat above |
| 3 | Flags `internal`, private setters, no public flag or `[JsonIgnore]` | Yes | Diff read; `ContentBundleTests` passed in job `api` 131031721416 |
| 4 | `section-compare` / `screenshot-parity` skipped at commit 1, green on the final head | Yes, on the code-equivalent head | Recorded as skipped at `b1521f5`; green in run 43174717473 on `8b9feff`. The records head still needs its run to finish (open item 1) |
| 5 | Stop rules (antd `null`, setter flag under real binding) | Yes, not triggered | S3 asserts `"defaultShareImageId" in body` and `null` (`settingsShareImage.test.tsx:185-186`); T1, T2 pass through the HTTP binding in CI |
| 6 | Release, `_Test` / `_E2e`, every 5.3 command recorded | Yes | `implementation.md` and the test report list each command run or NOT RUN with the covering job. The 5.3 filter was not run separately; every class in it is in the 545/545 full run |
| 7 | PR body lists B1 to B4 and marks G-1, G-2 as found here; unbounded settings columns go to the coordinator | Drafted below. **Open:** the coordinator's separate item for the other unbounded settings columns (`PostalCode` and others) is not yet recorded as filed (open item 5) |

## The tester's findings

All three Minors are **accepted, not fixed before delivery**. They move together to
one follow-up change, **`adm10-e1-hardening`**, for the coordinator to schedule in
slot 2 (G3-2). The name avoids `ADM-10b`, which the plan reserved for option (b) of
O-ADM10-2 and which is now unused. None is an audit Minor, so G3's D-NNN rule does not
apply. If the owner wants any of them fixed before the merge, the change goes back to
the developer.

- **Minor 1, E1's red cannot name its locator.** Accepted. The red is proven by
  elimination from the API log (above), and the green proves the fixed behaviour. The
  red-proven test is byte-identical at the head; changing it now would need a new red
  for no gain in evidence. Follow-up: `await expect(button).toBeVisible()` before the
  click in `pickImage`, or a per-action timeout.
- **Minor 2, E1's `finally` cannot run after a timeout, and the restore and DELETE
  responses are unchecked.** Accepted. The effect is limited to one run on
  `DigitalHubContent_E2e`, which the harness resets before every run; it never reaches
  `_Test`, `_Studio` or `DigitalHubContent`. On the green run the restore PUT answered
  200 and both DELETEs 204 (log above). Fixing Minor 1 removes the likely trigger.
  Follow-up: assert the restore and DELETE responses, and keep the cleanup within the
  test's time budget.
- **Minor 3, `ShareImageField` shows "no longer in the library" for any failed read,
  an uncaught fetch throw leaves only the buttons, and the state has no unit test.**
  Accepted. Wording only: the form still sends the stored id, and the API refuses it
  with 400 if the row is truly gone (T3). Follow-up: "no longer in the library" only
  for 404, a neutral message for other failures, a caught throw, and a unit test for
  each.
- **Observation O-1, `PUT /api/v1/settings` has no body limit or duplicate-field
  check.** Pre-existing at `32f0414`, not this change. It joins condition 7's item for
  the other unbounded settings columns (open item 5).
- **Observation O-2, S1 to S4 go red one step earlier than the plan's table.** Accepted:
  the same missing control, and the body assertions pass at the head.

## Definition of Done

`.github/pull_request_template.md` does not exist on `rebuild/dotnet-platform` or on
this branch (`git ls-files | grep -i pull_request`: no match; `git show
origin/rebuild/dotnet-platform:.github/pull_request_template.md`: "does not exist"). I
use the boxes that the ADM-02 and ADM-07 gate 2 records quote.

| Box | Can it be ticked now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes. Audit ADM-10 and FR-S-17; CI 43173375547 and 43174717473 |
| Code follows the engineering standards | Yes, by reading the diff; `ENGINEERING_STANDARDS.md` is absent from the tree, as every role records. No new warning (13 at base and head, as the tester read from the `api` log) |
| No new prohibited constructs in touched code | Yes. Data access stays in `AdminStore`; no raw SQL; no new CSS |
| Every new or changed route has a guard and record scope | Yes, trivially: no route or policy changed |
| Tests exist for the changed behaviour; security fixes have a regression test | Yes. T1 to T5, S1 to S4, W1/W2, E1, red then green. Changed-line coverage is not gated yet (GAP-18) |
| PR checks green on the final head (run ids quoted) | Yes for code-equivalent `8b9feff` (43174717473). **Open** for records head `760daea` (CI 43185533188 in progress) and for the commit that adds this file |
| Independent code review run; findings fixed or accepted | Yes. Plan review rounds 1 and 2, test report Round 1; Minors accepted above |
| Reviewed by someone other than the author | Yes for the pipeline roles. **Open:** the owner's review at merge |
| Rollback understood | Yes. Revert the pull request; no schema or data change. After a revert, a Studio save clears the share image again |
| Deployment note | **Open:** the slot 2 integrator is not named. Nothing deploys before Phase D |
| Governance: coverage table updated | Yes, in `implementation.md` |
| Governance: `docs/deferred-items.md` | Not needed: the audit item is fixed in full |
| Governance: documentation updated | Yes, `docs/changes/ADM-10/` |

## Behaviour changes the owner must accept at merge

- **B1:** `PUT /api/v1/settings` leaves the default share image and its alt unchanged
  when the body leaves them out. An explicit `null` still clears. The other settings
  fields still replace on every save. Any client relying on "omit to clear" must now
  send `null`.
- **B2:** an id that is not in the media library gets `400` naming
  `defaultShareImageId`, "Choose an image from the media library." (was a 500). Found
  here (G-1), not in the audit.
- **B3:** a default share image alt over 300 characters gets `400` (was a 500), and the
  bundle import's settings check refuses it too. Found here (G-2), not in the audit.
- **B4:** Site settings has a "Default share image" control (choose, change, clear) and
  a "Default share image alt text" field. Editors see both, disabled.
- **B5 (from O-ADM10-2 (a)):** on pages that fall back to the default share image, the
  website's `og:image:alt` becomes the settings alt once an admin sets it. A page's own
  alt still wins, and a page with its own image never takes the settings alt. Today's
  content has the alt empty, so nothing changes until someone sets it.

## Open items

1. **CI on the final head.** CI 43185533188 on `760daea` must finish green, and so must
   CI on the docs-only commit that adds this file. Do not cancel a run in progress.
2. **The owner's merge confirmation,** with B1 to B5. Slot 2 takes at most one pull
   request a day (refinement plan line 21). The last slot 2 merge was #55 on 11
   November; no slot 2 merge is recorded yet for 12 November.
3. **Name the slot 2 integrator,** who merges and re-runs the suites after the merge.
4. **Schedule `adm10-e1-hardening`** (Minors 1 to 3).
5. **Condition 7 / O-1:** the coordinator records a separate item for the other
   unbounded settings columns and the settings PUT's body limit.
6. **`.github/pull_request_template.md` is missing;** the coordinator confirms where it
   lives or that it is not yet written.
7. The tester's detached checkout `/home/user/dh-test-adm10` is still present; its owner
   removes it.

## Draft pull request description

```markdown
## What and why

ADM-10 (G3-1; the audit lists it as Major): saving Site settings cleared the default
share image (`docs/quality/admin-audit-2026-10-28.md`, line 179; FR-S-17). The form
never sent `defaultShareImageId`, the API copied the missing value as null, and there
was no field to set it. This fixes both sides, as the audit offers:

- The API keeps the stored share image and its alt when a save leaves them out. An
  explicit `null` still clears.
- Site settings gets a "Default share image" control (choose, change, clear, using the
  existing media picker) and an alt text field.
- The website uses that alt on pages that fall back to the default share image
  (owner answer O-ADM10-2 (a)).

Found here, not in the audit, on the same save path:
- **G-1:** an unknown media id was a 500 (foreign key). It is now a 400.
- **G-2:** an alt over 300 characters was a 500 (column overflow). It is now a 400.

## Scope and boundaries

- API: `AdminStore.cs` only (`SiteSettingsUpdate` setter flags, `internal`; the
  conditional copy; the media-exists check; the 300 limit).
- Studio: `SettingsPage.tsx`.
- Website: `src/seo/head.ts`.
- Tests: `SettingsShareImageTests.cs`, `studio/test/settingsShareImage.test.tsx`,
  `studio/e2e/settings.spec.ts`, `website/test/seo.test.tsx`.
- No migration, lockfile, package, `*.csproj` or workflow change; no route or policy
  change. `MediaPicker.tsx` and `ItemEditorPage.tsx` are reused unchanged.
- Out of scope: length limits on the other settings text columns and a body limit on
  the settings PUT (a separate item for the coordinator); the delete-between-check-and-save
  race (accepted at gate 1).

## Security impact

- **Routes and authorisation:** unchanged. `PUT /api/v1/settings` is `studio-admin`,
  `GET` is `studio`. The editor-403 tests on the PUT pass.
- **Input:** unknown media ids and over-long alt text are refused with the existing
  validation body, which names only the field. No more 500s on this path.
- **Output:** the alt reaches `og:image:alt` through Next's metadata, which escapes it.
- **Dependencies:** none changed. Security workflow green (43173375733).

## Tests and evidence

- **Red first.** The tests-only commit `b1521f5` was pushed alone. CI run 43036287741:
  - `api` 130575850302 and 130586030225: `Total tests: 545, Passed: 540`, the five
    failures exactly T1 to T5 (T3 and T4: `Expected: BadRequest, Actual:
    InternalServerError`).
  - `website` 130575850555: W1 only (`Expected "Digital Hub logo"`).
  - `studio` attempt 4, 131027779373: unit tests green; end-to-end `1 failed, 31 passed`,
    E1 by test timeout at the "Choose image" click (attempts 1 to 3 lost to an apt DNS
    outage before any test ran).
  - `section-compare` and `screenshot-parity` skipped (they need `website`).
  - S1 to S4 (`bf29cb2`) red locally: `Tests  4 failed (4)`.
- **Green on `73dc514`,** run 43173375547: `api` `545/545`; `studio` unit `98/98`,
  end-to-end `32 passed`, E1 in 12.3 s; `website`, `website-browser`, `section-compare`
  green.
- **Code-equivalent head `8b9feff`,** run 43174717473: every job green, including
  `screenshot-parity` 131036544539 (the Chromium regression tests pass; the comparison
  step does not yet gate, so it is not parity evidence) and `section-compare`
  131036544632.
- **Final head:** <run id, to fill>.
- **Records:** `docs/changes/ADM-10/` (plan, two reviews, two gates, implementation,
  test report).

## Owner decisions

- O-ADM10-1: "Yes, red tests first" (card, 11 November 2026, 14:07 UTC).
- O-ADM10-2: "Yes, add it and use it" (card, 11 November 2026, 14:07 UTC), option (a).
- **Behaviour changes for the owner to confirm at merge:**
  - **B1:** a settings save that leaves out the share image fields keeps them; `null`
    clears. Other settings fields still replace.
  - **B2:** an id not in the media library gets 400 `defaultShareImageId` (was 500).
    Found here (G-1).
  - **B3:** an alt over 300 characters gets 400 (was 500); the bundle import refuses it
    too. Found here (G-2).
  - **B4:** Site settings has the share image control and the alt field; editors see
    them disabled.
  - **B5:** pages that fall back to the default share image use the settings alt for
    `og:image:alt` once an admin sets it. Today it is empty, so no output changes yet.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (CI runs 43173375547, 43174717473)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; every security fix has a regression test (changed-line coverage is not gated yet, GAP-18)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (owner review at merge)
- [x] Rollback is understood (revert; no schema or data change)
- [ ] Deployment note: integrator <name> merges into rebuild/dotnet-platform and re-runs the suites after the merge

## Review findings accepted

Moved to follow-up `adm10-e1-hardening`:
- E1's red names no locator (shown by elimination from the API log).
- E1's cleanup cannot run after a test timeout, and its restore and DELETE responses
  are unchecked (effect limited to one run on the reset `DigitalHubContent_E2e`).
- The share image field shows "no longer in the library" for any failed read, and has
  no unit test for that state (wording only; the API still refuses a missing id).

## Governance

- [x] Coverage table updated (`docs/changes/ADM-10/implementation.md`)
- [x] `docs/deferred-items.md`: not needed, the audit item is fixed in full
- [x] Documentation updated

## Open items

- CI green on the final head.
- The owner's merge confirmation (slot 2, one pull request a day).
- The slot 2 integrator to be named.
- `adm10-e1-hardening` to be scheduled; the unbounded settings columns item to be filed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
