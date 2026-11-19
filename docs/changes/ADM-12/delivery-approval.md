# ADM-12 delivery approval (gate 2)

## Round 1

Head reviewed: `b38080c` on `change/ADM-12`, not pushed. `test-report.md` round 1 (uncommitted in the worktree), `Verdict: APPROVED`, two Minors. Plan `plan.md` round 1, approved in `plan-approval.md`.

### Decision

Approved for the owner. The change does what was asked, stays within the approved scope, has a red-first commit, and I re-ran the evidence myself. The items still open are listed below. They are things only a push and CI can close, plus one owner-review check.

### What I verified myself

- **Scope.** `git diff --stat origin/rebuild/dotnet-platform...HEAD` shows only the five files from plan section 4 (`MediaLibrary.cs`, `MediaUsage.cs`, `MediaLibraryTests.cs`, `MediaLibraryPage.tsx`, `studio/test/mediaLibrary.test.tsx`) plus the change records. `PublishChecks.cs`, `website/`, users files and error-pages files are untouched. There is no migration. Conditions 3 and 5 are met.
- **Failing test first.** `git log` shows `b9f317e` (tests only), then `2327a47` (fix), then `b38080c` (record). The tester independently reproduced the red run at `b9f317e`: 3 failures with `Expected: Conflict Actual: OK`, and the Vitest test failing. Condition 1 is met.
- **Re-run at the head, in Release, against `DigitalHubContent_Test`:**
  - `dotnet build DigitalHub.slnx -c Release`: build succeeded.
  - `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests`: `Passed: 19, Total: 19`.
  - `cd studio && npx vitest run test/mediaLibrary.test.tsx`: exit 0, `Tests 1 passed (1)`.
- **The tester's evidence is real.** Every row gives a command, an exit code and the output lines, and every check not run is marked NOT RUN with the job that covers it. The full suite result (562/562) and Studio results (110/110, build) agree with `implementation.md`.
- **Coverage table.** Every Done row has evidence. Two rows are open: the CI run and the Studio-database clean build. One row is closed by owner decision O-1.
- **Commits (B-4).** All four subjects are imperative, `ADM-12:`-prefixed, and under 72 characters, and each has the `Co-Authored-By` trailer. The fix and test commits explain why in their bodies.
- **Conditions 2 and 4.** The script substitution and the check-then-save race are both recorded in `implementation.md`.

### Tester's Minors

- **Minor 1 (the site settings default share image can be pointed at a decorative, blank-alt asset): named follow-up, not fixed now.** The fix belongs in `AdminStore.cs` site settings validation. That file is outside the approved scope (condition 5), and widening the scope at gate 2 would skip plan review. The site never ships empty share-image alt (`website/src/seo/head.ts:92` falls back to the title), so it is a consistency gap rather than a shipped defect. Follow-up: **ADM-12c, "Refuse a decorative, blank-alt asset as the default share image without an override"**, run through `/change`. The architect should also check whether new share or card image assignments in page saves have the same reverse-order gap. The PR lists it under accepted findings. This is my routing, not an owner decision; the owner may promote it.
- **Minor 2 (existing data is not repaired): accepted.** Refusing edits on already-bad assets until alt is added is the intended behaviour. The G3-1 clean build from `DigitalHubContent_Studio` (open item 2) is the check that shows whether any such data exists.

### Open Definition of Done items

1. **PR checks green on the final head.** CI (API, Website, Studio including e2e), Security (including gitleaks, not run locally) and Workflow lint have not run, because the branch is not pushed. Run IDs to be quoted. Condition 6.
2. **G3-1 clean website build from `DigitalHubContent_Studio`, and the manual reproduction.** NOT RUN by the developer or tester. Owner review, before the merge.
3. **Owner confirmation to push and open the PR, and the owner's squash-merge.** The suites re-run on `rebuild/dotnet-platform` after the merge.
4. **`test-report.md` is uncommitted.** It must be committed with this record (as `ADM-12: Record the test report and delivery approval`) before the push.
5. **Governance.** The `AGENTS.md` coverage and phase docs are not updated in this change. They are left unticked, and `docs/deferred-items.md` has no entry because no exception is taken.

---

## Draft pull request description

Title: `ADM-12: Refuse blanking alt text an image's uses rely on`

## What and why

The owner asked: "ADM-12 make alt text impossible to bypass in the media library"

Audit finding ADM-12 (G3-1, Blocker): `PUT /api/v1/media/{id}` accepted `{ "alt": "", "decorative": true }` for an image that published and draft content used without alt of its own. The next build then shipped those uses with empty alt, bypassing the publish check. The edit is now refused with 409 `alt_in_use`, listing every place that relies on the asset's alt. The rule is the publish check's alt rule, applied to every use: page share and card images with no override, the site settings default share image with no override, section and blog-body `mediaId` objects that are neither decorative nor carry alt, and working copies. The Studio media library shows those places when a save is refused.

## Scope and boundaries

- In scope: `api/src/DigitalHub.Api/Content/MediaUsage.cs` (`FindPlacesWithoutOwnAltAsync`), `api/src/DigitalHub.Api/Content/MediaLibrary.cs` (`MediaOutcome.AltInUse`), `studio/src/pages/MediaLibraryPage.tsx`, and the tests in `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs` and `studio/test/mediaLibrary.test.tsx`.
- Not touched: `PublishChecks.cs` (reused, not edited), `website/`, `AdminStore.cs`, and the users and error-pages files. No migration and no schema change.
- Out of scope: the reverse order (pointing the default share image at an asset that is already decorative with blank alt). Follow-up ADM-12c.

## Security impact

There is no new route, and the policy, binding and host checks on `PUT /api/v1/media/{id}` are unchanged. The route gains one 409 outcome in RFC 7807 shape (`code`, `title`, `usages`), with no internals. `usages` holds only collection and id place strings, which the same roles already see on delete. There are no new dependencies and no secrets. Security fix with a regression test committed first (`b9f317e`).

## Tests and evidence

- Red at `b9f317e` (tests only): `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter FullyQualifiedName~MediaLibraryTests`, exit 1, `Failed: 3, Passed: 16, Total: 19` (`Expected: Conflict Actual: OK`; all five use kinds returned 200). `npx vitest run test/mediaLibrary.test.tsx`, exit 1, `Tests 1 failed (1)`.
- Green at `b38080c`:
  - `dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors, 13 warnings (the same as the base).
  - The MediaLibraryTests filter: exit 0, `Passed: 19, Total: 19` (re-run by the tech lead).
  - Full API suite: exit 0, `Passed: 562, Total: 562`.
  - `cd studio && npm test`: exit 0, `Tests 110 passed`.
  - `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build`: exit 0. It runs `tsc -b`; there is no `typecheck` or `lint` script.
- Security: npm and dotnet audits give 0 new findings at the gate's level. Semgrep gives 1 known and 0 new.
- NOT RUN:
  - Playwright e2e: the local harness is broken. Covered by the CI Studio e2e job.
  - gitleaks: not installed locally. Covered by the `security.yml` gitleaks jobs.
  - Website suites: `website/` is untouched. Covered by the CI Website job.
  - G3-1 clean build from `DigitalHubContent_Studio`: owner review.
- CI run IDs: _to be added on the final head._

## Owner decisions

O-1, as recorded in `implementation.md`: On 19 November 2026, in the orchestrator's Claude Code session, the owner was asked: "Take the recommended defaults for all three questions?" For ADM-12 O-1 ("Should media library edits wait for a publish step (ADM-12b, with a schema change), or is live-on-save acceptable for library metadata?"), the recommended default was "Live-on-save: library details change as soon as they're saved, with no schema change". The owner answered: "Yes, defaults".

Live-on-save is accepted for library metadata, and no ADM-12b is needed.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no new route; the existing guard is unchanged)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (coverage gate confirmed by CI)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: the owner squash-merges into rebuild/dotnet-platform; CI, Security and Workflow lint re-run after the merge. Nothing deploys before Phase D.

## Review findings accepted

- Default share image can be set to an already-decorative, blank-alt asset (`AdminStore.cs`, outside the scope). Its impact is limited because `og:image:alt` falls back to the title. Follow-up: ADM-12c.
- Existing bad data is not repaired. Edits to such an asset are refused until alt is added, which is intended. The Studio-database clean build checks for this.
- Check-then-save race between the usage check and the save: accepted. The publish check still catches that use at its own publish.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated
- [ ] `docs/deferred-items.md` updated for any exception (none taken)
- [x] Documentation updated (`docs/changes/ADM-12/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

This approval moves the change to the owner. It is not the owner's confirmation to push or merge, and it stands in for no owner decision.

Verdict: APPROVED
