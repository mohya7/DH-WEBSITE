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

Round 1 ended at `7206872` with READY FOR TEST. Gate 2 sent it back (Round 2, below).

## Round 2 (2026-11-19): answering `delivery-approval.md` round 1

Gate 2, round 1 returned `Verdict: CHANGES NEEDED` and sent back tester Finding 1
(`test-report.md`, Round 1): **probe mutant M4, which refuses every decorative card
image, survived the full suite (595 of 595)**, because Fact B stopped at the refused
publish. This round answers only that finding.

### Answers to the conditions

| Condition | Answer |
| --- | --- |
| 1. Extend Fact B with Fact A's steps 4-5 | Done. After the refused publish and the `draft` check, Fact B now PUTs `/api/v1/team-members/{id}` with the create version, `slug`, `title` and `fields = { imageId, imageAltOverride = "Abstract pattern behind the team member" }`. It asserts 200, and asserts `content.fields.imageId` equals the seeded `mediaId` and `content.fields.imageAltOverride` equals the text sent, with `Text(body, "content", "fields", ...)`. Then it publishes with the new version and asserts 200 (line 865) and `state` `published`. The `finally` block and its item-before-asset order are unchanged. |
| 2. Name | Renamed to `Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`. The step 3 filter still matches it (R2-2). |
| 3. Mutants M1-M4 | Done, one at a time, with the same build-then-test rule (R2-mutants). Each build exited 0 with `0 Error(s)`. Each mutant matched the updated expected-failure table. `git diff --exit-code -- api/src` exited 0 after each restore. M4 now fails Fact B at its second publish. |
| 4. Suites | Class: exit 0, 34 of 34. Full suite: exit 0, 595 of 595 (unchanged: no fact added). Warnings: 13, the same lines as the base. |
| 5. Scope | Only Fact B in `ContentPublishTests.cs` changes (19 lines added, name changed), plus this record. No helper changed, added or removed. No product file (R2-7). |
| 6. Records | This section and the new coverage row below. **I did not commit `test-report.md`.** The coordinator's round 2 instruction says to leave `test-report.md` and `delivery-approval.md` uncommitted, because the coordinator commits the records. That instruction came after condition 6, so I followed it. The tech lead should know that the coordinator now carries the last sentence of condition 6. |
| 7. Commits | New commits on top of `7206872`. `01bd0b2` and `7206872` are not amended or rebased. |

### Commits

| SHA | Subject |
| --- | --- |
| `491b00c` | ADM-12d: Prove an override lets a decorative card image publish |
| (this commit) | ADM-12d: Record round 2 of the implementation |

`491b00c` was committed after the green run on unchanged product code (R2-2) and
before the mutants.

### Commands (from `api/`, Release, `DigitalHubContent_Test` only)

| # | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| R2-1 | `dotnet build DigitalHub.slnx -c Release --no-incremental` (Fact B extended, product unchanged) | 0 | `13 Warning(s)`, `0 Error(s)` |
| R2-2 | Step 3 filter: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests.Publish_blocks_a_card_image\|FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image"` | 0 | `Passed ...Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`, `Passed ...Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override`. Passes against unchanged product code; coverage for existing behaviour |
| R2-3 | M1-M4 | see below | |
| R2-4 | After M4: `git diff --exit-code -- api/src` | 0 | No output |
| R2-5 | `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. The sorted warning lines are the same as round 1's base build (`diff` exit 0) |
| R2-6a | Step 3 filter again | 0 | `Passed! - Failed: 0, Passed: 2, Skipped: 0, Total: 2` |
| R2-6b | `--filter "FullyQualifiedName~ContentPublishTests"` | 0 | `Passed! - Failed: 0, Passed: 34, Skipped: 0, Total: 34` |
| R2-6c | Full suite, no filter | 0 | `Passed! - Failed: 0, Passed: 595, Skipped: 0, Total: 595, Duration: 1 m 48 s`; `[FAIL]` count 0. `website/node_modules` is the round 1 `npm ci` install (row 6a). `website/package-lock.json` has not changed on this branch since, so I did not reinstall |
| R2-7 | `git diff --name-only 8027e87..HEAD`, before this record's commit | 0 | `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` and `docs/changes/ADM-12d/{implementation,plan,plan-approval,plan-review}.md`. `git diff --exit-code 8027e87..HEAD -- api/src`: exit 0 |

**One procedural slip, reported.** When I wrote the mutant runner script
(`mutants.sh` in my scratchpad), I started it once by mistake with its output
discarded, before the green run in R2-2. That run applied the same four mutants and
restored `PublishChecks.cs` after each one. Afterwards, `git diff --exit-code -- api/src`
exited 0 and `git status` showed only the intended test edit. I do not use that run as
evidence. Every result below comes from the second run, which was recorded and came
after commit `491b00c`. The facts clean up in `finally`, and the later full suite
(R2-6c) passed 595 of 595.

### R2-mutants

Same procedure as round 1, run by script for each mutant:

1. Check that `api/src` is clean.
2. Apply the exact one-line replacement. The old text must occur exactly once.
3. Print the changed lines of `git diff -- api/src`.
4. Run `dotnet build DigitalHub.slnx -c Release`. The script stops if the exit code is
   not 0 or `0 Error(s)` is missing.
5. Run the step 3 filter with `--no-build`.
6. Run `git restore`, then `git diff --exit-code -- api/src`.

Fact B's lines are now 842 (the first publish, `Assert.Equal(HttpStatusCode.BadRequest, blocked.Status);`)
and 865 (the second publish, `Assert.Equal(HttpStatusCode.OK, published.Status);`).
Fact A's are still 777 and 800. Each failure has a second stack frame, at line 808 for A
and 873 for B. That is the last line of `finally`, where the async method rethrows after
cleanup has run. No failure is a cleanup failure.

| Mutant | Diff (`-` / `+`) | Build | Test exit, totals | First failing assertion | Expected (gate 2 table) | Restore |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | `-                Add(errors, "image", "Add alt text for the image.");` / `+                { }` | exit 0, `13 Warning(s)`, `0 Error(s)` | 1, `Failed: 2, Passed: 0` | A: line 777, `Expected: BadRequest`, `Actual: OK`. B: line 842, `Expected: BadRequest`, `Actual: OK` | A and B fail at their first publish | `git diff --exit-code` 0 |
| M2 | `-            if (EffectiveAlt(over, fieldAsset.Alt) is null)` / `+            if (EffectiveAlt(null, fieldAsset.Alt) is null)` | exit 0, `0 Warning(s)` (incremental), `0 Error(s)` | 1, `Failed: 2, Passed: 0` | A: line 800, `Expected: OK`, `Actual: BadRequest`. B: line 865, `Expected: OK`, `Actual: BadRequest` | A and B fail at their second publish | `git diff --exit-code` 0 |
| M3 | `-            if (EffectiveAlt(over, fieldAsset.Alt) is null)` / `+            if (!fieldAsset.Decorative && EffectiveAlt(over, fieldAsset.Alt) is null)` | exit 0, `0 Warning(s)` (incremental), `0 Error(s)` | 1, `Failed: 1, Passed: 1` | B: line 842, `Expected: BadRequest`, `Actual: OK`. A passed | B fails at its first publish; A passes | `git diff --exit-code` 0 |
| M4 | `-            if (EffectiveAlt(over, fieldAsset.Alt) is null)` / `+            if (fieldAsset.Decorative \|\| EffectiveAlt(over, fieldAsset.Alt) is null)` | exit 0, `0 Warning(s)` (incremental), `0 Error(s)` | 1, `Failed: 1, Passed: 1` | B: line 865, `Expected: OK`, `Actual: BadRequest`. A passed | B fails at its second publish; A passes | `git diff --exit-code` 0 |

Every mutant matched the table, and M4 no longer survives. No test was changed to fit
a mutant. No mutant was staged or committed.

### Coverage table, round 2

The round 1 table (section 7) still applies, with these changes:

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A decorative card image with an override publishes (mutant M4) | `test-report.md` Round 1, Finding 1; `delivery-approval.md` round 1, conditions 1-3 | Done | `491b00c`: Fact B's PUT (200, `content.fields.imageId` = seeded id, `content.fields.imageAltOverride` = text sent) and second publish (200, `published`). Passes on unchanged code (R2-2, R2-6a). M4 fails it at line 865, `Expected: OK`, `Actual: BadRequest` (R2-mutants) |
| A decorative asset with no alt and no override is still refused | As round 1 | Done | Fact B's first publish. M3 fails it at line 842 (R2-mutants) |
| The tests catch a broken check (M1-M4) | As round 1, plus Finding 1 | Done | R2-mutants: four builds exit 0 with `0 Error(s)`, four expected failures, and `git diff --exit-code -- api/src` exit 0 after each and at the end (R2-4) |
| Full API suite green in Release | As round 1 | Done | R2-6c: exit 0, 595 of 595, the base's 593 plus 2 |
| No build warning added | `plan-approval.md` condition 8 | Done | R2-1, R2-5: 13 warnings, the same lines as the base |
| `test-report.md` committed | `delivery-approval.md` condition 6 | Moved | To the coordinator, who commits the records (coordinator's round 2 instruction) |
| CI, Security (with gitleaks) and Workflow lint; Studio, website and e2e suites | As round 1 | Open | NOT RUN: the branch is not pushed. Run ids are quoted at gate 2 |

### For the tester, round 2

- Repeat M4 and M1 with the build-then-test steps. Expected: M4 fails only Fact B, at
  line 865. M1 fails both facts, at lines 777 and 842.
- The incremental mutant builds show `0 Warning(s)`. Use `--no-incremental` to see all 13.

Status: READY FOR TEST
