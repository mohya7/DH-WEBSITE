# ADM-12d implementation: Test the card-image alt check at publish

Developer, step 4. 2026-11-19. Branch `change/ADM-12d`, base `8027e87`, plan at
`548f941` (`plan.md` revision round 2, `plan-approval.md` `Verdict: APPROVED`, 12
conditions).

Owner's request, exactly: "ADM-12d Test the card-image alt check at publish".

Read before starting: `docs/changes/README.md`, `AGENTS.md`, `CLAUDE.md`,
`ENGINEERING_STANDARDS.md`, and every file in `docs/changes/ADM-12d/` (`plan.md`,
`plan-review.md`, `plan-approval.md`). This is the first implementation round; there
is no `test-report.md` or `delivery-approval.md` yet.

## 1. What changed, mapped to the plan's Scope

| File | Plan Scope row | Change |
| --- | --- | --- |
| `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` | Add Facts A and B next to `Publish_blocks_a_section_when_its_rich_text_image_has_no_alt_text` | Two facts added directly after that fact (+110 lines). No helper changed, added or removed: they use `Editor`, `Slug`, `BareImage`, `SendAsync`, `ReadPage`, `Code`, `Text`, `RemoveItemAsync`, `RemoveMediaAsync`. |
| `docs/changes/ADM-12d/implementation.md` | The records | This file. |

No product file changed. `PublishChecks.cs` was changed locally for mutants M1-M3
only, and restored after each (section 4).

### Fact A: `Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override`

1. Seeds `BareImage(mediaId)` (`Alt = ""`, `Decorative = false`) through a
   `ContentDbContext` scope.
2. `POST /api/v1/team-members` with `{ slug, title = "Card image", fields = { imageId } }`; asserts 201.
3. Publishes: asserts 400, `code` `publish_blocked`, the `errors` keys are exactly
   `["image"]`, `errors.image` is exactly `["Add alt text for the image."]`, and
   `GET` shows `status` `draft`.
4. `PUT /api/v1/team-members/{id}` with `imageId` and
   `imageAltOverride = "Portrait of the team member"`; asserts 200, and reads
   `content.fields.imageId` (equal to `mediaId`) and `content.fields.imageAltOverride`
   (equal to the text sent) from the PUT response with `Text(body, "content", "fields", ...)`
   (condition 1).
5. Publishes with the new version: asserts 200 and `state` `published`.
6. `finally`: `RemoveItemAsync("team-members", id)` (only if the item was created),
   then `RemoveMediaAsync(mediaId)` (condition 6).

### Fact B: `Publish_blocks_a_decorative_card_image_without_alt_text`

Steps 1-3 and 6 of Fact A, with the seeded asset's `Decorative` set to `true` on the
object `BareImage` returns, before `Add`. Publish is still refused with `image` as the
only error key and its exact message, and the item stays a draft.

## 2. Commits

| SHA | Subject | Note |
| --- | --- | --- |
| `01bd0b2` | ADM-12d: Test the card-image alt check at publish | The two facts. Committed after their first run, which **passes against unchanged product code; coverage for existing behaviour** (condition 2). It is not a red-test commit: there is no fix, so there is nothing to make it red without committing broken product code (plan 3.2, 3.3). |
| (this commit) | ADM-12d: Record the implementation | This file. |

No fix commit exists, by design. No mutant was staged or committed (section 4).

## 3. Commands run

All from `api/` unless noted, Release only, integration tests against
`DigitalHubContent_Test` only (`ApiFactory` rewrites the catalog to it). The
coordinator's brief states this agent is the only one on that database. Nothing wrote
to `DigitalHubContent` or `DigitalHubContent_Studio`. Nothing touched `DH-WEBSITE-main`.
No port was opened.

| # | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| 1 | `dotnet tool restore` | 0 | `Restore was successful.` |
| 2a | Base warning count: test file put back to its `8027e87` text, then `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)` |
| 2b | With the two facts: `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. The sorted, de-duplicated warning lines of 2a and 2b are identical (`diff` exit 0); none is in a test project. The change adds no warning (condition 8). |
| 3 | First run: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests.Publish_blocks_a_card_image\|FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image"` | 0 | `Passed! - Failed: 0, Passed: 2, Skipped: 0, Total: 2`. Passes against unchanged product code; coverage for existing behaviour. |
| 4 | Mutants M1, M2, M3 | see section 4 | |
| 4r | After M3: `git restore api/src/DigitalHub.Api/Content/PublishChecks.cs`, then `git diff --exit-code -- api/src` | 0 | No output. `git status --short` empty. |
| 4b | `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)` |
| 4t | Step 3's command again | 0 | `Passed! - Failed: 0, Passed: 2, Skipped: 0, Total: 2` |
| 5 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests"` | 0 | `Passed! - Failed: 0, Passed: 34, Skipped: 0, Total: 34` |
| 6a | `website/`: `npm ci` | 0 | Installed. One `npm warn allow-scripts` line for `esbuild@0.28.2` (postinstall), unchanged by this change. `git status --short` empty afterwards: the lockfile was not changed. |
| 6 | Full suite: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` | 0 | `Passed! - Failed: 0, Passed: 595, Skipped: 0, Total: 595, Duration: 2 m 9 s`; `[FAIL]` count 0 |
| 6b | Base total: `--list-tests` on this build (595 cases); then the test file put back to its `8027e87` text, Release build (exit 0), `--list-tests` again (593 cases); then `git restore` of the test file (`git diff --exit-code` exit 0) and a Release rebuild of the change (exit 0, `0 Error(s)`) | 0 | The base has 593 cases, the change 595. The `diff` of the two sorted lists is exactly the two new facts. So the full suite is the base total plus 2 (condition 9). The ADM-12c records quote 586; that number was not used, because the base here was counted directly at `8027e87`. |
| 7 | Scope, before this record's commit: `git diff --name-only 8027e87 HEAD` | 0 | `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs`, `docs/changes/ADM-12d/plan-approval.md`, `docs/changes/ADM-12d/plan-review.md`, `docs/changes/ADM-12d/plan.md`. After this commit, the list adds `docs/changes/ADM-12d/implementation.md` only (condition 5). |

Not run locally:

- Studio and website suites (`npx tsc -b`, `npm test`, `npm run build`,
  `npm run typecheck`, `npm run design:check`): NOT RUN, because no Studio or website
  file changes. Covered by the CI Studio and Website jobs.
- End-to-end (`npx playwright test`): NOT RUN, because the local e2e harness is broken.
  Covered by the CI job "Studio — typecheck, build, end-to-end".
- CI, Security (with gitleaks) and Workflow lint on the final head: NOT RUN here; the
  branch is not pushed (the owner confirms the push after gate 2). Their run ids are
  quoted at gate 2 (condition 9).

## 4. Mutants (plan 3.2; conditions 3 and 4)

Each mutant was applied alone, as the exact one-line replacement in the plan's table,
to `api/src/DigitalHub.Api/Content/PublishChecks.cs` at `8027e87`. The file has LF
line endings; the edit kept them. Each run: `git diff -- api/src` (one line), build,
then step 3's filter with `--no-build`, then `git restore`. Before each new mutant,
`git diff --exit-code -- api/src` exited 0.

For each failing fact, the stack trace has two frames: the assertion line, then the
last line of the `finally` block (lines 808 and 855), which is where the async method
rethrows after `finally` has run. That second frame shows the cleanup ran without
throwing; no failure is a cleanup failure (the `RemoveItemAsync` `NoContent`
assertion), so every failure below is valid mutant evidence (plan 3.1, step 6).

### M1: the error is never added

```diff
@@ -97,7 +97,7 @@ public static class PublishChecks
             if (draft.Fields.TryGetValue("imageAltOverride", out var alt) && alt.ValueKind == JsonValueKind.String)
                 over = alt.GetString();
             if (EffectiveAlt(over, fieldAsset.Alt) is null)
-                Add(errors, "image", "Add alt text for the image.");
+                { }
         }
```

- Build: `dotnet build DigitalHub.slnx -c Release`: exit 0, `13 Warning(s)`, `0 Error(s)`.
- Test: step 3's command: exit 1, `Failed! - Failed: 2, Passed: 0, Skipped: 0, Total: 2`.
- Fact A: `Assert.Equal() Failure: Values differ`, `Expected: BadRequest`,
  `Actual: OK`, at `ContentPublishTests.cs:line 777`
  (`Assert.Equal(HttpStatusCode.BadRequest, blocked.Status);`, step 3).
- Fact B: the same message at `ContentPublishTests.cs:line 842` (step 3).
- Matches the expected failure: A and B fail at step 3, expected `BadRequest`, actual `OK`.
- `git restore`; `git diff --exit-code -- api/src`: exit 0.

### M2: the override is ignored

```diff
@@ -96,7 +96,7 @@ public static class PublishChecks
             string? over = null;
             if (draft.Fields.TryGetValue("imageAltOverride", out var alt) && alt.ValueKind == JsonValueKind.String)
                 over = alt.GetString();
-            if (EffectiveAlt(over, fieldAsset.Alt) is null)
+            if (EffectiveAlt(null, fieldAsset.Alt) is null)
                 Add(errors, "image", "Add alt text for the image.");
         }
```

- Build: `dotnet build DigitalHub.slnx -c Release`: exit 0, `0 Warning(s)`, `0 Error(s)`
  (incremental: only the changed project recompiled, so the warnings of the unchanged
  projects are not re-reported).
- Test: exit 1, `Failed! - Failed: 1, Passed: 1, Skipped: 0, Total: 2`.
- Fact A: `Assert.Equal() Failure: Values differ`, `Expected: OK`,
  `Actual: BadRequest`, at `ContentPublishTests.cs:line 800`
  (`Assert.Equal(HttpStatusCode.OK, published.Status);`, step 5). Fact B passed.
- Matches the expected failure: A fails at step 5, expected `OK`, actual `BadRequest`; B passes.
- `git restore`; `git diff --exit-code -- api/src`: exit 0.

### M3: decorative assets are exempt

```diff
@@ -96,7 +96,7 @@ public static class PublishChecks
             string? over = null;
             if (draft.Fields.TryGetValue("imageAltOverride", out var alt) && alt.ValueKind == JsonValueKind.String)
                 over = alt.GetString();
-            if (EffectiveAlt(over, fieldAsset.Alt) is null)
+            if (!fieldAsset.Decorative && EffectiveAlt(over, fieldAsset.Alt) is null)
                 Add(errors, "image", "Add alt text for the image.");
         }
```

- Build: `dotnet build DigitalHub.slnx -c Release`: exit 0, `0 Warning(s)` (incremental, as M2), `0 Error(s)`.
- Test: exit 1, `Failed! - Failed: 1, Passed: 1, Skipped: 0, Total: 2`.
- Fact B: `Assert.Equal() Failure: Values differ`, `Expected: BadRequest`,
  `Actual: OK`, at `ContentPublishTests.cs:line 842` (step 3). Fact A passed.
- Under M3, Fact B's publish succeeded, so its item was published; the `finally`
  cleanup unpublished and removed it, then removed the asset, without error.
- Matches the expected failure: B fails at step 3, expected `BadRequest`, actual `OK`; A passes.
- `git restore`; `git diff --exit-code -- api/src`: exit 0 (row 4r), then the
  restored build and the green re-run (rows 4b, 4t).

No mutant survived, and none needed the test changed.

## 5. Migrations

None.

## 6. Track checklist (G3)

- [x] The finding, its evidence and its fix come from `admin-audit-2026-10-28.md`:
  ADM-12 ("ships cards with no alt text"). This change tests the card half of the
  publish alt check.
- [x] The regression test is committed and shown failing before the fix: there is no
  fix. The tests are committed (`01bd0b2`), and M1-M3 show them failing against a
  broken check (section 4). The tester repeats M1 (condition 12).
- [x] An end-to-end test for each Major: not applicable (ADM-12 is a Blocker, and this
  change adds no behaviour). CI e2e must stay green; checked at gate 2.
- [x] A Minor not fixed becomes a D-NNN entry: not applicable. The importer case is the
  named follow-up ADM-12e.

## 7. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A `ContentPublishTests` fact for the `image` error key (`PublishChecks.cs:93-100`) | `ADM-12c/plan-approval.md`, "Follow-ups recorded" | Done | Facts A and B in `ContentPublishTests.cs` (`01bd0b2`) assert `errors` keys exactly `["image"]` and message exactly `["Add alt text for the image."]`; section 3, row 3: exit 0, `Passed: 2, Total: 2` |
| The override clears the `image` error | `PublishChecks.cs:96-99`; plan Fact A | Done | Fact A steps 4-5: PUT 200 with `content.fields.imageId` equal to the seeded id and `content.fields.imageAltOverride` equal to the text sent, then publish 200 `published`; M2 makes it fail at step 5 (`Expected: OK`, `Actual: BadRequest`, line 800) |
| A decorative asset with no alt and no override is still refused | ADM-12 audit text; `ADM-12c/plan-approval.md` condition 2; plan Fact B | Done | Fact B passes on unchanged code (row 3); M3 makes it fail at step 3 (`Expected: BadRequest`, `Actual: OK`, line 842) |
| The tests catch a broken check (M1-M3: each builds with `0 Error(s)` and fails as expected; none committed) | P-4, B-6, G3 checklist, met through mutation because there is no fix; method from the coordinator's brief | Done | Section 4: M1, M2, M3 builds exit 0 with `0 Error(s)`; test runs exit 1 with the expected assertion at the expected step; `git diff --exit-code -- api/src` exit 0 after each restore; scope list (row 7) holds no product file |
| The tests pass against today's code (coverage, not a fix) | Coordinator's brief; plan section 1 | Done | Row 3: first run exit 0, `Passed: 2`, against unchanged product code; recorded as coverage for existing behaviour, not red |
| The importer case with an empty `settings` table assessed and decided | `ADM-12c/plan-approval.md`; plan-review Round 2, Minor 4 | Moved | Moved to follow-up ADM-12e, recorded in `docs/changes/ADM-12d/plan-approval.md`, Follow-ups recorded |
| Full API suite green in Release | `docs/changes/README.md`; `ENGINEERING_STANDARDS.md` G-2 | Done | Row 6: exit 0, `Passed: 595, Failed: 0, Total: 595`; row 6b: base 593 plus the 2 new facts |
| No build warning added | `plan-approval.md` condition 8 | Done | Rows 2a, 2b, 4b: 13 warnings at the base and with the change, identical lines |
| CI, Security (with gitleaks), Workflow lint green on the final head | `docs/changes/README.md`; `ENGINEERING_STANDARDS.md` G-2 | Open | NOT RUN: the branch is not pushed. Quoted by run id at gate 2 |
| Studio, website and end-to-end suites | Plan section 5, "Not run locally" | Open | NOT RUN locally (no Studio or website file changes; local e2e harness broken). CI Studio, Website, and "Studio — typecheck, build, end-to-end" jobs at gate 2 |

## 8. For the tester

- Repeat M1 on the detached checkout of this branch's head, with the same steps:
  apply the exact replacement, `git diff -- api/src`, `dotnet build DigitalHub.slnx -c Release`
  (must exit 0 with `0 Error(s)`), then the step 3 filter with `--no-build`, then
  `git restore` and `git diff --exit-code -- api/src`.
- After an incremental mutant build the summary shows `0 Warning(s)`, because only
  `DigitalHub.Api` and its dependants recompile. Use `--no-incremental` to see the full
  13.
- `npm ci` in `website/` is needed before the full API suite.

Status: READY FOR TEST
