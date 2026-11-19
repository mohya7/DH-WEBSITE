# ADM-12d test report: Test the card-image alt check at publish

Tester, step 5. Owner's request, exactly: "ADM-12d Test the card-image alt check at
publish".

Read before testing: `docs/changes/README.md`, `AGENTS.md` (and `CLAUDE.md`),
`ENGINEERING_STANDARDS.md`, and every file in `docs/changes/ADM-12d/` (`plan.md`
revision round 2, `plan-review.md` Rounds 1-2, `plan-approval.md` with 12 conditions,
`implementation.md`, `Status: READY FOR TEST`).

## Round 1

- **Commit tested:** `7206872` ("ADM-12d: Record the implementation"), head of
  `change/ADM-12d`. Base `8027e87`.
- **Where:** detached worktree `D:\work\DigitalHub\dh-platform-claude-adm-12d-test`,
  created with `git -C D:\work\DigitalHub\dh-platform worktree add --detach
  D:\work\DigitalHub\dh-platform-claude-adm-12d-test 7206872`, removed and pruned after
  the run. Nothing was committed there. The only file written in the developer's
  worktree is this report (not committed).
- **Databases:** integration tests ran against `DigitalHubContent_Test` only
  (`ApiFactory.cs:131` refuses any other catalog). The coordinator's brief states this
  agent is the only one on it. The only direct database access was read-only `SELECT`
  queries on `DigitalHubContent_Test` to check for leftover rows. Nothing wrote to
  `DigitalHubContent` or `DigitalHubContent_Studio`. `DH-WEBSITE-main` was not touched.
  No port was opened.

### 1. Scope (conditions 5 and 12)

| Command | Exit | Output |
| --- | --- | --- |
| `git diff --name-only 8027e87 HEAD` | 0 | `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs`, `docs/changes/ADM-12d/implementation.md`, `plan-approval.md`, `plan-review.md`, `plan.md` |
| `git diff --stat 8027e87 HEAD` | 0 | `ContentPublishTests.cs \| 110 +++++` (additions only), records 1068 lines; `5 files changed, 1178 insertions(+)` |
| `git diff --exit-code 8027e87 HEAD -- api/src` | 0 | No output: no product file, so no mutant, is committed |
| `git log --format=%h 8027e87..HEAD -- api/src \| wc -l` | 0 | `0` |

The diff of `ContentPublishTests.cs` is two new facts inserted after
`Publish_blocks_a_section_when_its_rich_text_image_has_no_alt_text`. No helper is
changed, added or removed. Fact A reads `content.fields.imageId` and
`content.fields.imageAltOverride` from the PUT response (condition 1). The `finally`
block removes the item first and then the asset (condition 6). Commit subjects start
with `ADM-12d:`, the bodies say why, and both carry the attribution trailer
(condition 10).

### 2. The red test was red

NOT APPLICABLE by design: this is coverage for existing behaviour, with no fix and no
red commit (plan 3.2 and 3.3, condition 2). I confirmed the facts are new:
`git show 8027e87:api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs | grep -c card_image`
gives `0`. Mutant M1 below stands in for the red run.

### 3. Build and the new facts (from `api/`)

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| 1 | `dotnet tool restore` | 0 | `Restore was successful.` |
| 2 | `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. The same count the developer gives for the base. Warning lines in a test project: `grep -c "Tests.*warning"` = `0` |
| 3 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests.Publish_blocks_a_card_image\|FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image"` | 0 | `Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2`. Passes on unchanged product code |

### 4. Mutant M1, repeated (condition 12)

Applied in the detached worktree as the exact one-line replacement in plan 3.2. The
file there has CRLF endings and kept them. My first attempt with `sed -i` did not
match the CR, so it made no substitution and only rewrote the line endings. I undid it
with `git restore` (`git diff --exit-code -- api/src` exit 0) before applying M1
properly. That attempt was never built or tested.

`git diff -- api/src`:

```diff
@@ -97,7 +97,7 @@ public static class PublishChecks
             if (draft.Fields.TryGetValue("imageAltOverride", out var alt) && alt.ValueKind == JsonValueKind.String)
                 over = alt.GetString();
             if (EffectiveAlt(over, fieldAsset.Alt) is null)
-                Add(errors, "image", "Add alt text for the image.");
+                { }
         }
```

`git diff --stat -- api/src`: `1 file changed, 1 insertion(+), 1 deletion(-)`.

| Step | Command | Exit | Output |
| --- | --- | --- | --- |
| Build | `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Warning(s)` (incremental), `0 Error(s)` |
| Test | step 3's filter, `--no-build` | 1 | `Failed!  - Failed: 2, Passed: 0, Skipped: 0, Total: 2` |
| Fact A | | | `Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override [FAIL]`: `Assert.Equal() Failure: Values differ`, `Expected: BadRequest`, `Actual: OK`, at `ContentPublishTests.cs:line 777` (`Assert.Equal(HttpStatusCode.BadRequest, blocked.Status);`, step 3); second frame line 808 (`await RemoveMediaAsync(mediaId);`, the end of `finally`) |
| Fact B | | | `Publish_blocks_a_decorative_card_image_without_alt_text [FAIL]`: same message, at `ContentPublishTests.cs:line 842` (step 3); second frame line 855 (end of `finally`) |
| Restore | `git restore api/src/DigitalHub.Api/Content/PublishChecks.cs`; `git diff --exit-code -- api/src` | 0 | No output; `git status --short` empty |
| Rebuild | `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Error(s)` |
| Re-run | step 3's filter, `--no-build` | 0 | `Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2` |

This matches the plan's expected failure: A and B fail at step 3, expected
`BadRequest`, actual `OK`. Both failures are the first assertion at the expected step,
not a cleanup failure, so the evidence rule in plan 3.1 step 6 holds. It agrees with
`implementation.md` section 4 (same lines, 777 and 842). I did not repeat M2 or M3.
The developer's record is the only evidence for them.

### 5. Class and full API suite

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| 5 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests"` | 0 | `Passed!  - Failed: 0, Passed: 34, Skipped: 0, Total: 34` |
| 6a | `website/`: `npm ci` | 0 | Installed; one `npm warn allow-scripts` for `esbuild@0.28.2` (postinstall), not from this change; `git status --short` empty afterwards |
| 6 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` | 0 | `Passed!  - Failed: 0, Passed: 595, Skipped: 0, Total: 595, Duration: 1 m 53 s`; `[FAIL]` count `0`. 595 = the base's 593 (developer's row 6b) plus 2 |

`api/DigitalHub.slnx` has one test project, `DigitalHub.Api.Tests`, which is also the
only one `ci.yml:128` runs.

Leftover rows after every run, including the M1 run where both items were published
(read-only, `sqlcmd -S . -E -C -d DigitalHubContent_Test`):
`SELECT COUNT(*) FROM working_copies WHERE document LIKE '%Card image%' OR document LIKE '%Decorative card image%'` gives `0`;
`SELECT COUNT(*) FROM team_members WHERE title IN ('Card image','Decorative card image')` gives `0`;
`team_members` rows whose `image_id` points at a missing media row: `0`. The `finally`
cleanup works.

### 6. Website, Studio and end-to-end suites

- `npm test`, `npm run typecheck`, `npm run build`, `npm run design:check`,
  `npm run compare:sections` in `website/`; `npm test`, `npm run build` in `studio/`:
  NOT RUN, because no website or Studio file changes (scope, section 1). Covered by
  the CI Website and Studio jobs.
- `npm run test:e2e` in `studio/`: **pending on CI**, not a failure. The local e2e
  harness is broken. Covered by the CI job "Studio — typecheck, build, end-to-end".
- CI, Security and Workflow lint on the final head: pending. The branch is not
  pushed. Their run ids are quoted at gate 2 (condition 9).

### 7. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, website, full tree | `npm audit --audit-level=high` in `website/` | 0 | `2 moderate severity vulnerabilities`; none at High or Critical. Not from this change (no lockfile change) |
| npm audit, Studio, full tree | `npm audit --audit-level=high` in `studio/` | 0 | `found 0 vulnerabilities` |
| Gate, website | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Gate, Studio | `sh ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| NuGet | `sh ../.github/security/run-dotnet-audit.sh` in `api/` | 0 | All four projects `has no vulnerable packages`; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep 1.180.0 (the CI version) | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` The known one is `csharp-sqli` at `AuditRollbackTests.cs:78`, listed in `known-findings.json`. No result in `ContentPublishTests.cs` |
| gitleaks | NOT RUN | | Not installed locally. Covered by the `security.yml` jobs `gitleaks-pr` ("Secret scan (gitleaks, this pull request's commits)") and `gitleaks-history` |
| Secrets in the diff | `git diff 8027e87 HEAD \| grep -iE "^\+.*(password\|secret\|token\|apikey\|connectionstring\|pwd=)"` | 0 | Two record lines that only use the word "secret" in prose ("No route, policy, secret, ..."). No value. No secret appeared in any log or output of this run |
| Routes, roles, host checks, unknown fields, body size, error shape | NOT APPLICABLE | | No route, controller, policy, role, login or permission changes (`git diff --exit-code 8027e87 HEAD -- api/src` exit 0). The facts use the existing editor account |

### 8. Track checklist (G3)

- [x] Finding, evidence and fix from `admin-audit-2026-10-28.md`: ADM-12, "ships cards
  with no alt text". The facts test the card half of the publish alt check.
- [x] Regression test committed and shown failing: no fix exists. The tests are
  committed (`01bd0b2`), and M1, repeated here, fails both at the expected step.
- [x] An end-to-end test for each Major: not applicable (ADM-12 is a Blocker, and no
  behaviour changes). CI e2e is pending.
- [x] A Minor not fixed becomes a D-NNN entry: the importer case is follow-up ADM-12e
  (`plan-approval.md`, "Follow-ups recorded"). Finding 1 below is the developer's to
  answer, not an exception.

### 9. Beyond the plan

- **Probe mutant M4: a decorative card image is always refused, even with alt.** In
  the detached worktree only, I replaced line 99 with
  `            if (fieldAsset.Decorative || EffectiveAlt(over, fieldAsset.Alt) is null)`.
  `dotnet build DigitalHub.slnx -c Release`: exit 0, `0 Error(s)`. The **full suite**
  with `--no-build`: exit 0, `Passed: 595, Failed: 0`. **M4 survives.** Restored with
  `git restore`; `git diff --exit-code -- api/src` exit 0; rebuilt (exit 0,
  `0 Error(s)`), and the two facts passed again (exit 0, `Passed: 2`). This is
  Finding 1.
- **Asset's own alt ignored (`EffectiveAlt(over, null)`), by reading the code only.**
  This is already caught outside this change:
  `MediaLibraryTests.Marking_a_used_image_decorative_with_no_alt_is_refused_while_a_use_relies_on_it`
  publishes a blog post whose card image has the asset alt "Harbour card"
  (`MediaLibraryTests.cs:343`, `Assert.True(published.Status == HttpStatusCode.OK, ...)`).
  Not run as a mutant.
- **Whitespace-only override (`"   "`).** `First` trims it, so it counts as no
  override. The plan puts this out of scope (section 4). Not a finding.
- **Version reuse.** Fact A sends the PUT with the create version after a refused
  publish. That passes, so a refused publish does not bump the version. This is
  consistent with `PublishAsync`.
- **Concurrency, paging, body size, unknown fields:** not applicable. No route or
  contract changes.

### Findings

1. **Minor: no test pins that a decorative card image with alt text can be
   published; probe mutant M4 survives the full suite.**
   - Steps: in a scratch checkout of `7206872`, change `PublishChecks.cs:99` to
     `if (fieldAsset.Decorative || EffectiveAlt(over, fieldAsset.Alt) is null)`. Run
     `dotnet build DigitalHub.slnx -c Release` (exit 0), then
     `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`.
   - Expected: at least one test fails, because a decorative asset that has an
     override (or alt of its own) is publishable today (`EffectiveAlt` ignores
     `Decorative`, plan section 2).
   - Actual: exit 0, `Passed: 595, Failed: 0`. Fact A uses a non-decorative asset, and
     Fact B never reaches a successful publish. So the pair pins "decorative with no
     alt is refused", but nothing stops a change that over-refuses every decorative
     card image.
   - Why it is only Minor: the regression it misses blocks publishing (it fails
     closed). It does not ship cards without alt, which is the ADM-12 bug this change
     covers. The plan did not require it, and the plan's three mutants all behave as
     recorded. A possible answer: extend Fact B with Fact A's steps 4-5, an override
     and then a publish with 200. Whether to add it, or to defer it with a named
     follow-up, is for the developer and the tech lead.

No Blocker or Major.

### Coverage table rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| A `ContentPublishTests` fact for the `image` error key | Verified | Section 3 row 3: exit 0, `Passed: 2`. Diff shows the exact key set `["image"]` and message asserted |
| The override clears the `image` error | Verified (pass); M2 not repeated | Fact A passes; PUT asserts `content.fields.imageId` and `imageAltOverride` (diff lines 795-796) |
| A decorative asset with no alt and no override is still refused | Verified (pass); M3 not repeated | Fact B passes (section 3 row 3); it fails under M1 at line 842 |
| The tests catch a broken check | Verified for M1 | Section 4: build exit 0 with `0 Error(s)`; test exit 1, both facts fail at step 3 (`Expected: BadRequest`, `Actual: OK`); restored and green again. No mutant committed (section 1) |
| The tests pass against today's code | Verified | Section 3 row 3 |
| Importer case moved to ADM-12e | Verified | `plan-approval.md`, "Follow-ups recorded" holds the ADM-12e text |
| Full API suite green in Release | Verified | Section 5 row 6: exit 0, `Passed: 595, Failed: 0` |
| No build warning added | Verified | Section 3 row 2: `13 Warning(s)`, none in a test project |
| CI, Security (gitleaks), Workflow lint; Studio, website, e2e | Pending on CI | Section 6; gitleaks NOT RUN locally (section 7) |

Every planned check that can run locally passes. There is one Minor finding (Finding
1), and no Blocker or Major.

Round 1 result: approved with one Minor. Gate 2 sent Finding 1 back to the developer (see Round 2).

## Round 2

- **Commit tested:** `9234fbc` ("ADM-12d: Record round 2 of the implementation"),
  head of `change/ADM-12d`. It answers Round 1 Finding 1 with `491b00c` ("ADM-12d:
  Prove an override lets a decorative card image publish").
- **Where:** a fresh detached worktree,
  `git -C D:\work\DigitalHub\dh-platform worktree add --detach D:\work\DigitalHub\dh-platform-claude-adm-12d-test 9234fbc`.
  I removed it with `git worktree remove` and ran `git worktree prune`. `ls` confirms
  no folder is left. Nothing was committed there.
- **Databases:** `DigitalHubContent_Test` only, plus read-only `SELECT`s for leftovers
  and session checks. Nothing touched `DigitalHubContent`, `DigitalHubContent_Studio`
  or `DH-WEBSITE-main`. No port was opened.

### R2-1. Scope since round 1

| Command | Exit | Output |
| --- | --- | --- |
| `git diff --stat 7206872 HEAD` | 0 | `ContentPublishTests.cs \| 20 +++-`, `implementation.md \| 102 +++`; `2 files changed, 121 insertions(+), 1 deletion(-)` |
| `git diff 7206872 HEAD -- api/` | 0 | Only Fact B. It is renamed to `Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`, and after the `draft` check it gets a PUT with `imageId` and `imageAltOverride = "Abstract pattern behind the team member"`. The PUT asserts 200, `content.fields.imageId` equal to the seeded id and `content.fields.imageAltOverride` equal to the text sent. A second publish follows, asserting 200 (line 865) and `state` `published`. `finally` is unchanged. No helper changed, and Fact A is unchanged |
| `git diff --name-only 8027e87 HEAD` | 0 | `ContentPublishTests.cs` and `docs/changes/ADM-12d/{implementation,plan,plan-approval,plan-review}.md` |
| `git diff --exit-code 8027e87 HEAD -- api/src` | 0 | No output: no product file or mutant is committed |

Both new commits have `ADM-12d:` subjects, bodies that say why, and the attribution
trailer. `01bd0b2` and `7206872` are unchanged ancestors.

### R2-2. Build and the facts on unchanged product code (from `api/`)

| Command | Exit | Output |
| --- | --- | --- |
| `dotnet tool restore` | 0 | `Restore was successful.` |
| `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)` (the base count) |
| Step 3 filter (`--filter "FullyQualifiedName~ContentPublishTests.Publish_blocks_a_card_image\|FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image"`, `--no-build`, `-v n`) | 0 | `Passed ...Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`, `Passed ...Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override`. The filter still matches both facts |

Line check (`sed -n`): 777 and 842 are `Assert.Equal(HttpStatusCode.BadRequest, blocked.Status);`,
865 is `Assert.Equal(HttpStatusCode.OK, published.Status);`, and 808 and 873 are the last
line of each `finally` (`await RemoveMediaAsync(mediaId);`).

### R2-3. Mutant M4, repeated

Applied with the editor's exact-string replacement, not `sed`. `file` reports
`ASCII text, with CRLF line terminators` before and after, so the line endings were
kept.

```diff
@@ -96,7 +96,7 @@ public static class PublishChecks
-            if (EffectiveAlt(over, fieldAsset.Alt) is null)
+            if (fieldAsset.Decorative || EffectiveAlt(over, fieldAsset.Alt) is null)
```

`git diff --stat -- api/src`: `1 file changed, 1 insertion(+), 1 deletion(-)`.

| Step | Command | Exit | Output |
| --- | --- | --- | --- |
| Build | `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Warning(s)` (incremental), `0 Error(s)` |
| Test | step 3 filter, `--no-build`, `-v n` | 1 | `Total tests: 2`, `Passed: 1`, `Failed: 1` |
| Fact B | | | `Failed ...Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`: `Expected: OK`, `Actual: BadRequest`, at `ContentPublishTests.cs:line 865` (second publish); second frame line 873 (end of `finally`), so not a cleanup failure |
| Fact A | | | `Passed ...Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override` |
| Restore | `git restore api/src/DigitalHub.Api/Content/PublishChecks.cs`; `git diff --exit-code -- api/src` | 0 | No output; `git status --short` empty |
| Rebuild | `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Error(s)` |
| Re-run | step 3 filter, `--no-build` | 0 | `Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2` |

As expected, M4 fails only Fact B, at line 865. **Round 1 Finding 1 is closed.**

### R2-4. Mutant M1, repeated

The same method, and CRLF kept (`file` before and after).

```diff
@@ -97,7 +97,7 @@ public static class PublishChecks
-                Add(errors, "image", "Add alt text for the image.");
+                { }
```

`git diff --stat -- api/src`: `1 file changed, 1 insertion(+), 1 deletion(-)`.

| Step | Command | Exit | Output |
| --- | --- | --- | --- |
| Build | `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Warning(s)` (incremental), `0 Error(s)` |
| Test | step 3 filter, `--no-build` | 1 | `Failed!  - Failed: 2, Passed: 0, Skipped: 0, Total: 2` |
| Fact A | | | `[FAIL]`: `Expected: BadRequest`, `Actual: OK`, at `ContentPublishTests.cs:line 777`; second frame 808 |
| Fact B | | | `[FAIL]`: `Expected: BadRequest`, `Actual: OK`, at `ContentPublishTests.cs:line 842`; second frame 873 |
| Restore | `git restore ...PublishChecks.cs`; `git diff --exit-code -- api/src` | 0 | No output; `git status --short` empty |
| Rebuild | `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)` |
| Re-run | step 3 filter, `--no-build` | 0 | `Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2` |

As expected, M1 fails both facts at their first publish. Both failures match the
developer's R2-mutants table. I did not repeat M2 or M3.

### R2-5. Class and full API suite

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| a | `website/`: `npm ci` | 0 | Installed; `git status --short` empty afterwards |
| b | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests"` | 0 | `Passed!  - Failed: 0, Passed: 34, Skipped: 0, Total: 34` |
| c | Full suite, first attempt: `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build` | 1 | `Failed!  - Failed: 10, Passed: 585, Skipped: 0, Total: 595`. **Not evidence; another agent was on the test database at the same time (below)** |
| d | Full suite, re-run once the database was idle, with a test-host sampler running alongside | 0 | `Passed!  - Failed: 0, Passed: 595, Skipped: 0, Total: 595, Duration: 2 m 4 s`; `[FAIL]` count 0. The sampler logged 22 samples, every one `D:\work\DigitalHub\dh-platform-claude-adm-12d-test\...\testhost.exe` (mine only) |

**Attempt c: what happened.** The 10 failures were in `SessionCheckTests`,
`ListPagingTests`, `CaseStudyThemeTests` and `CareersTests`. None is in
`ContentPublishTests`. They showed `SqlException: Transaction (Process ID 90) was
deadlocked on lock resources with another process`, `Expected: Created`,
`Actual: InternalServerError`, `Expected: 3`, `Actual: 4` (audit paging) and
`Expected: OK`, `Actual: Unauthorized`. Right after the run, `sys.dm_exec_sessions`
showed EF Core sessions on `DigitalHubContent_Test` from another test host that was
still active. `Get-Process testhost` gave
`Path: D:\work\DigitalHub\dh-platform-claude-iso-2\api\tests\DigitalHub.Api.Tests\bin\Release\net10.0\testhost.exe`,
`StartTime 4:43:15 PM`. Its test DLL was built at 16:38:38, during my run. So the
ISO-2 agent ran the suite on the same database at the same time, although the brief
said I was the only agent on it. I did not stop that process. I polled until no test
host was running and no session on `DigitalHubContent_Test` had made a request in the
last 60 seconds (idle at 16:47:27), then re-ran (attempt d). **For the coordinator:**
the single-writer rule for `DigitalHubContent_Test` was broken for this run. This
change's code did not cause it, but any other agent's results from about
16:37-16:47 on that database should be treated as suspect.

Leftovers after the runs (read-only): working copies titled "Card image" or
"Decorative card image": `0`; such `team_members`: `0`; `team_members` with an
`image_id` pointing at a missing media row: `0`.

### R2-6. Security (on `9234fbc`, `RUNNER_TEMP` set to a scratch folder)

| Check | Exit | Output |
| --- | --- | --- |
| `npm audit --audit-level=high` in `website/` | 0 | No High or Critical (the 2 moderates from round 1) |
| `npm audit --audit-level=high` in `studio/` | 0 | `found 0 vulnerabilities` |
| `run-npm-audit.sh website` / `studio` | 0 / 0 | `0 finding(s) at the gate's level; 0 known, 0 new.` for each |
| `run-dotnet-audit.sh` in `api/` | 0 | `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `run-semgrep.sh` (1.180.0) | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (`AuditRollbackTests.cs:78`, listed) |
| gitleaks | NOT RUN | Not installed locally. Covered by the `security.yml` jobs `gitleaks-pr` and `gitleaks-history` |
| Secrets in `git diff 7206872 HEAD` | 0 | `grep -ciE "^\+.*(password\|token\|apikey\|connectionstring\|pwd=)"` gives `0` |
| Routes, roles, host checks, unknown fields, body size, error shape | NOT APPLICABLE | No product file changes (R2-1) |

### R2-7. Not run locally

- Website suites (`npm test`, `npm run typecheck`, `npm run build`,
  `npm run design:check`, `npm run compare:sections`) and Studio `npm test` and
  `npm run build`: NOT RUN, because no website or Studio file changes. Covered by the
  CI Website and Studio jobs.
- `npm run test:e2e`: **pending on CI**, not a failure. The local harness is broken.
  Covered by "Studio — typecheck, build, end-to-end".
- CI, Security and Workflow lint on the final head: pending until the push, and
  quoted by run id at gate 2.

### R2-8. Track checklist (G3)

Unchanged from Round 1, all four items hold. The regression evidence is now M1 and M4,
both repeated here. Fact B also pins the override path for decorative assets.

### Findings, round 2

None. Round 1 Finding 1 (Minor, M4 survived) is closed by R2-3.

Process note, not a finding against this change: the concurrent use of
`DigitalHubContent_Test` by the ISO-2 agent (R2-5, attempt c) is reported to the
coordinator.

### Coverage table rows verified, round 2

| Item | Status | Evidence |
| --- | --- | --- |
| A decorative card image with an override publishes (M4) | Verified | R2-1 diff; R2-2 pass; R2-3: M4 fails only Fact B, at line 865 |
| A decorative asset with no alt and no override is still refused | Verified | Fact B passes (R2-2) and fails under M1 at line 842 (R2-4) |
| A `ContentPublishTests` fact for the `image` error key | Verified | R2-2; M1 fails both facts (R2-4) |
| The override clears the `image` error (Fact A) | Verified (pass) | R2-2; Fact A is unchanged since round 1 |
| The tests catch a broken check | Verified for M1 and M4 | R2-3, R2-4: builds exit 0 with `0 Error(s)`, the expected failures, restores proved with `git diff --exit-code -- api/src` exit 0, and no mutant committed (R2-1) |
| Full API suite green in Release | Verified | R2-5 d: exit 0, 595 of 595, with only my test host on the database |
| No build warning added | Verified | R2-4 rebuild: `13 Warning(s)`, the base count |
| CI, Security (gitleaks), Workflow lint; website, Studio, e2e | Pending on CI | R2-7 |

Every planned check that can run locally passes, and there is no finding.

Verdict: APPROVED
