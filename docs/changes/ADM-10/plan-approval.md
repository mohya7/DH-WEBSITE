# ADM-10: plan approval (gate 1)

Technical lead, gate 1, 11 November 2026. Plan: `docs/changes/ADM-10/plan.md` at
`1059d39` (round 2). Review: `plan-review.md`, Round 2 at `6a652a5`, `Verdict: APPROVED`.
Branch `change/ADM-10`, head `6a652a5`, merge base with `origin/rebuild/dotnet-platform`
`32f0414` (`git merge-base HEAD origin/rebuild/dotnet-platform`). `git diff 32f0414 HEAD --stat`
shows only `docs/changes/ADM-10/plan.md` and `plan-review.md`.

This approval is a pipeline role. It is not the owner's confirmation under `AGENTS.md`
and it answers neither O-ADM10-1 nor O-ADM10-2.

Read: `CLAUDE.md` / `AGENTS.md`, `docs/changes/README.md`, the plan, both review rounds,
the refinement plan and audit from `/mnt/project-files/docs/quality/` (G3-1 row at
line 225, two merge slots at line 21, ADM-10 at audit line 179). `ENGINEERING_STANDARDS.md`
and `docs/PROJECT_PROFILE.md` are not in the worktree, as the plan and the reviewer say.
Nothing was built or tested here: no `dotnet`, SQL Server or `node_modules`.

## Decision

The plan may go to the developer, under the conditions below.

## What I checked myself

| Claim | Evidence (read at `32f0414`, unchanged at `6a652a5`) | Holds |
| --- | --- | --- |
| A save copies a missing id as null | `AdminStore.cs:284-285` assign both fields unconditionally; `SiteSettingsUpdate` (1147-1179) is a plain DTO with `Guid? DefaultShareImageId` | Yes |
| Unknown id is a 500 today | Only `DbUpdateConcurrencyException` is caught (299); FK `HasForeignKey(DefaultShareImageId).OnDelete(NoAction)` (`Data/ContentModelBuilder.cs:136-139`); `app.UseExceptionHandler()` (`Program.cs:273`) with `UnhandledExceptionHandler`. No other catch of `DbUpdateException` on this path | Yes, by reading; T3 shows it in CI |
| Alt over 300 is a 500 today | `ValidateSettings` (796-826) has no limit for it; `LimitText` (1097-1101) trims and compares, matching what `TrimOrNull` stores | Yes, by reading; T4 shows it in CI |
| `MediaLibrary` dedups on hash | `MediaLibrary.cs:82-84`: an existing `ContentHash` returns `Present(existing, duplicate: true)` and stores nothing | Yes; E1's two self-made images and the `duplicate: false` assertion are needed |
| Reflection in the import sees only public properties | `ContentBundle.cs:511-517`: `typeof(SiteSettingsUpdate).GetProperties()` (public instance only), then `typeof(SiteSettings).GetProperty(name)!`. `internal` flags with private setters are not returned. The only `new SiteSettingsUpdate` in `api/` is this one (grep) | Yes |
| STJ binding | `AddJsonOptions` adds one converter only (`Program.cs:182-185`); no source-generated context | Yes |
| CI order in job `studio` | `ci.yml`: "Typecheck" 234, "Unit tests" 237, "Build" 240, "End-to-end suite" 271. With S1 to S4 out of commit 1, E1 is reached | Yes |
| `tsc -b` at commit 1 | `studio/tsconfig.node.json:17` includes only `e2e/env.ts` from `e2e/` | Yes |
| Snapshot unchanged by 3.3 | `website/fixtures/snapshot/content.json`: `"defaultShareImageId":null`, `"defaultShareImageAltOverride":null` | Yes |
| `head.ts` ignores the settings alt | `head.ts:85-92`, `imageAlt: own \|\| documentTitle(item)` | Yes |
| Editors | `SettingsPage.tsx:37` `canEdit = role === "admin"`, `<Form ... disabled={!canEdit}>` at 75 | Yes |
| `uniquePngBytes()` exists | `studio/e2e/rich-text.spec.ts:32` | Yes |

## Order and conflicts

- **Execution order.** G3-1 runs in slot 2 (3 to 16 November) in the order "ADM-06, 03,
  02, 07, 10, ...". ADM-07 merged as `32f0414` (#55); ADM-10 is next. G3 is not under
  the Wave 0 or ISO-4/ISO-5 constraints. The refinement plan lists ADM-10 under G3-1
  "Blockers"; the audit lists it as Major, and the plan meets both (E1 for the Major).
- **Open pull requests.** `gh api "repos/mohya7/DH-WEBSITE/pulls?state=open"` (run by me)
  returns only `44 change/GAP-07`, which is slot 1 and shares no file with this plan.
- **Other branches.** Of the remote branches, those whose diff against `32f0414` touches
  `AdminStore.cs`, `SettingsPage.tsx`, `head.ts` or `seo.test.tsx` are `change/ADM-02`
  and `change/ADM-07` (merged as #52 and #55) and `phase-c/*` / `phase-d/content-bundle`
  branches last committed 12 to 20 October with no open pull request. None is in flight.

## Owner decisions, and what the developer may do before each is answered

Both are PENDING on owner cards. Neither is assumed.

**O-ADM10-1 (push the tests-only commit alone first).**
- Before it is answered, the developer may write and commit every commit in 5.2 locally,
  in the planned order, and run and record the local reds (W1 at commit 1 if (a);
  S1 to S4 at commit 2) and the local greens.
- The developer must push nothing to `origin`, not commit 1 and not the fixed head, and
  must open no pull request, until the owner's words are quoted.
- If "Yes": push commit 1 alone; push the rest only after jobs `api`, `website` and
  `studio` have finished on commit 1, with run and job ids and each failing assertion
  recorded in `implementation.md`.
- If "No": the developer may push the full branch, but delivery is BLOCKED ON OWNER on
  the 5.4 row until the owner accepts in words that the database reds are not shown.

**O-ADM10-2 (website alt).**
- Before it is answered, the developer may build the parts that do not depend on it:
  T1 to T5, E1 (which does not touch the alt), S1 to S4 without the alt assertions, all
  of 3.1 (both flags, the exists check, the 300 limit, which hold under (a) and (b)), and
  the share image picker in 3.2.
- Only if the answer is (a): W1 and W2 in `website/test/seo.test.tsx` (commit 1), the alt
  assertions in S1 and S2 (commit 2), the alt `Form.Item` in `SettingsPage.tsx`
  (commit 4), and `head.ts` (commit 5).
- If (b): none of those; `head.ts` and `seo.test.tsx` are not touched; the website alt
  becomes ADM-10b, which the developer reports to the coordinator rather than filing.
- Because nothing is pushed yet, the developer may rebuild the unpushed local commits
  once O-ADM10-2 is answered, so that the final history still has tests-only commits
  before every fix. The pushed history must match 5.2.

## Conditions for the developer

1. **Base.** Before the first commit, `git fetch` and confirm `change/ADM-10` contains
   `origin/rebuild/dotnet-platform`. If the base has moved, merge it first and re-check
   that `UpdateSettingsAsync`, `ValidateSettings` and `SiteSettingsUpdate` are unchanged;
   if they changed, stop and report.
2. **Scope.** Only the files in section 4. Do not change `MediaPicker.tsx`,
   `ItemEditorPage.tsx`, `FormWalker.tsx`, `rich-text.spec.ts`, any workflow, lockfile
   or migration. If a migration seems needed, stop: the plan says there is none.
3. **The flags.** `DefaultShareImageIdSent` and `DefaultShareImageAltOverrideSent` are
   `internal` with private setters, exactly as in 3.1. No public flag, no `[JsonIgnore]`
   public property.
4. **CI record at commit 1, if O-ADM10-1 is "Yes" and O-ADM10-2 is (a).** Jobs
   `section-compare` and `screenshot-parity` have `needs: website` (`ci.yml:291, 356`),
   so they are skipped when job `website` is red on W1. Record them as skipped, not as
   passed, and show them green on the final head.
5. **Stop rules from the plan's risk table.** If antd omits a `null` field from
   `onFinish` (S3), or the setter flag does not behave as stated under the real binding
   (T1, T2), stop and report; do not work around it outside the plan.
6. **Running.** .NET in Release; integration tests on `DigitalHubContent_Test`; e2e on
   `DigitalHubContent_E2e`, reset by the harness, ports 42xx; never `DigitalHubContent`.
   Every command in 5.3 is recorded as run with its exit code, or NOT RUN with the reason
   and the CI job that covers it (P-8).
7. **Pull request body** lists B1 to B4, and marks G-1 and G-2 as found here, not from
   the audit. The other unbounded settings columns (for example `PostalCode`) go to the
   coordinator as a separate item, not into this change.

## Reviewer's Minors accepted

- Round 2, Minor 1 (E1 image generation). Accepted. The developer may draw the PNGs on a
  canvas as planned, or copy `uniquePngBytes()` from `studio/e2e/rich-text.spec.ts:32`
  **into** `settings.spec.ts`. It must not be moved or shared, because that would change
  `rich-text.spec.ts`, which is out of scope. Either way, both uploads must assert
  `duplicate: false` and different ids.

## Risks accepted

- An image deleted between the exists check and `SaveChangesAsync` still ends in a 500.
  One `SaveChangesAsync`, so nothing is half saved; two admins within milliseconds;
  the delete is otherwise refused while the settings row uses the image
  (`MediaUsage.cs:45`). Accepted as the plan argues.
- The exists check runs before the version check, so a stale save with an unknown id gets
  400 rather than 409. Either answer refuses the save and changes nothing; accepted.

Verdict: APPROVED
