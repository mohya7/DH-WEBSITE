# ADM-12d delivery approval

Technical lead, gate 2, round 1. 2026-11-19. Branch `change/ADM-12d`, head `7206872`,
base `8027e87`. Reviewed `plan.md` (revision round 2), `plan-review.md` (Round 2
`Verdict: APPROVED`), `plan-approval.md` (`Verdict: APPROVED`, 12 conditions),
`implementation.md` (`Status: READY FOR TEST`) and `test-report.md` (Round 1,
`Verdict: APPROVED`, one Minor; written in the worktree, not committed).

Owner's request, exactly: "ADM-12d Test the card-image alt check at publish".

## Decision

Changes needed. Tester Finding 1 goes back to the developer. It is not deferred as a
follow-up.

The rest of the delivery is sound and matches the approved plan (below). The one gap is
this: no test shows that a decorative card image with alt text can be published. The
tester's probe mutant M4 (`if (fieldAsset.Decorative || EffectiveAlt(over, fieldAsset.Alt) is null)`)
refuses every decorative card image, and the full suite passes against it (595 of 595).

Why it goes back now rather than to a named follow-up:

1. **It is inside the request and the approved scope.** The owner asked to test the
   card-image alt check at publish. The fix is about a dozen lines in the same fact, the
   same file and the same helpers, with no product change. A separate change would run a
   whole pipeline to add those lines. That costs more than doing it now, and the gap would
   stay open until then.
2. **The plan's own rule requires it.** Plan section 3.1 says of Fact A: "Steps 4-5
   matter as much as step 3. Without them, a check that always refused would pass the
   test." Fact B stops at step 3, so on the decorative branch "a check that always
   refused" does pass. Fact B does not yet meet the plan's stated intent.
3. **The rule it pins is settled, not new.** `EffectiveAlt`/`First`
   (`PublishChecks.cs:324-333`) and `AltText.Effective` (`AltText.cs:9-22`) ignore
   `Decorative`. ADM-12c condition 2 settled "`AltText.Effective`, not `IsPublishable`".
   So "a decorative asset with an override publishes" is current, decided behaviour.
   Pinning it needs no owner decision.
4. **Failing closed is still a defect.** The tester rated it Minor because M4 blocks
   publishing and ships no card without alt. I agree with the severity. But an
   over-refusal would stop editors publishing any team member, partner, case study, blog
   post or news item whose card image is marked decorative. That is a real regression,
   in the exact check this change exists to test, and it is cheap to catch now.

## Conditions for the developer (round 2)

1. **Extend Fact B with Fact A's steps 4-5.** After the refused publish and the `draft`
   check: `PUT /api/v1/team-members/{id}` with the create version, `slug`, `title`, and
   `fields = { imageId, imageAltOverride = <text> }`. Assert 200, and assert
   `content.fields.imageId` equals the seeded `mediaId` and
   `content.fields.imageAltOverride` equals the text sent, with
   `Text(body, "content", "fields", ...)`. Then publish with the new version and assert
   200 and `state` `published`. The `finally` block and its item-before-asset order stay
   as they are.
2. **Name.** Rename Fact B to
   `Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`,
   so its name says what it now proves. The plan's step 3 filter
   (`FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image`)
   still matches it.
3. **Mutants, with the same build-then-test rule as plan 3.2 and condition 3 of
   `plan-approval.md`.** One at a time: apply the exact edit, `git diff -- api/src`
   shows one line, `dotnet build DigitalHub.slnx -c Release` exits 0 with `0 Error(s)`,
   then the step 3 filter with `--no-build`, then `git restore`. The expected results
   change as follows:

   | Mutant | Expected failure after round 2 |
   | --- | --- |
   | M1 (line 100 to `{ }`) | A and B fail at their first publish: expected `BadRequest`, actual `OK` |
   | M2 (`EffectiveAlt(null, ...)`) | A and B both fail at their second publish: expected `OK`, actual `BadRequest` |
   | M3 (`!fieldAsset.Decorative && ...`) | B fails at its first publish: expected `BadRequest`, actual `OK`. A passes |
   | M4 (line 99 to `            if (fieldAsset.Decorative \|\| EffectiveAlt(over, fieldAsset.Alt) is null)`) | B fails at its second publish: expected `OK`, actual `BadRequest`. A passes |

   Record each diff, build line, exit code and first failing assertion in
   `implementation.md`. A cleanup failure from `finally` is not evidence. A mutant that
   does not fail as expected stops the work and is reported; the test is not changed to
   fit it. After the last mutant, `git diff --exit-code -- api/src` exits 0, the Release
   build exits 0, and the two facts pass.
4. **Suites.** The class (`FullyQualifiedName~ContentPublishTests`) and the full API suite
   in Release, exit 0, against `DigitalHubContent_Test` only. The total stays 595: no fact
   is added. Record the build warning count (13 at the base).
5. **Scope stays the same.** Only `ContentPublishTests.cs` (Fact B only; no helper is
   changed, added or removed) and `docs/changes/ADM-12d/*`. No product file.
6. **Records.** Add a "Round 2" section to `implementation.md` that answers this
   approval. Add a coverage row "A decorative card image with an override publishes
   (mutant M4)", with its evidence. Commit the tester's `test-report.md` as written. It
   is part of the change's record and it is not committed yet.
7. **Commits (B-4).** New commits on top of `7206872`. Do not amend or rebase
   `01bd0b2`. Each subject is imperative and starts with `ADM-12d:`, for example
   "ADM-12d: Prove an override lets a decorative card image publish". The body says why
   (tester Finding 1, mutant M4). Each commit carries the attribution trailer.

The tester then runs Round 2 on the new head. At a minimum, the tester repeats M4 and
M1 on a detached checkout and runs the full suite.

## What I verified myself

| Check | Command or source | Result |
| --- | --- | --- |
| Diff matches the plan, nothing outside scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 5 files, 1178 insertions, 0 deletions: `ContentPublishTests.cs` (+110) and `docs/changes/ADM-12d/{plan,plan-review,plan-approval,implementation}.md`. No product file |
| The test diff | `git diff 8027e87 HEAD -- api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` | Two facts inserted after `Publish_blocks_a_section_when_its_rich_text_image_has_no_alt_text`. No helper touched. The exact key set `["image"]` and message are asserted. Fact A reads `content.fields.imageId`/`imageAltOverride` (condition 1). `finally` removes the item and then the asset (condition 6). Fact B ends after the refused publish, which is the gap in Finding 1 |
| The rule Fact B would pin | `api/src/DigitalHub.Api/Data/AltText.cs`; `PublishChecks.cs:94-101` | `Effective` ignores `Decorative`; `IsPublishable` exempts it. The card check uses `EffectiveAlt`, so a decorative asset with an override publishes today |
| Base drift | `git fetch`; `git log 8027e87..origin/rebuild/dotnet-platform` | The base moved to `1c0d7f4` (#72 GAP-NEXT-UPGRADE, #75 GAP-11 records). They changed `website/package*.json` and `docs/changes/GAP-*` only, with no overlap. `git merge-tree --write-tree origin/rebuild/dotnet-platform HEAD`: exit 0, no conflict. No rebase needed for a squash merge. CI on the pull request tests the merge with the new base |
| No red commit, by design | `git log 8027e87..HEAD` | `548f941` plan, `01bd0b2` facts, `7206872` records. No fix commit exists, because there is nothing to fix (coverage only). The plan's local mutants stand in for B-6's red-first rule, as gate 1 accepted. Not a security fix |
| Commits (B-4) | `git log --format='%h %s%n%b' 8027e87..HEAD` | Subjects are imperative with an `ADM-12d:` prefix. `01bd0b2` and `7206872` have bodies that say why. All three carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `548f941` ("ADM-12d: Plan") has the trailer only; acceptable for a records commit |
| Build | `dotnet build DigitalHub.slnx -c Release` in `api/` | exit 0, `13 Warning(s)`, `0 Error(s)`: the base count |
| Fastest suite covering the change | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentPublishTests"` | exit 0, `Passed! - Failed: 0, Passed: 34, Skipped: 0, Total: 34, Duration: 9 s`. Against `DigitalHubContent_Test` |
| Tester's evidence is real | `test-report.md` | Commands, exit codes and output for scope, build, M1 repeated on a detached checkout of `7206872` (lines 777 and 842, matching the developer's), class (34), full suite (595), leftover-row queries (0), audits and Semgrep. gitleaks and e2e are marked NOT RUN or pending with the covering CI jobs. M4 is recorded with its build and suite results |
| Coverage table | `implementation.md` section 7; `test-report.md` | Every row has evidence, except the two marked Open (CI, Security, Workflow lint; Studio, website, e2e). Those are pending on CI. The importer row is Moved to ADM-12e, recorded in `plan-approval.md`. Missing: a row for Finding 1 (condition 6) |

I did not run the mutants myself. This role may not change product files, even locally.
M1 has independent evidence from two roles. M2, M3 and M4 rest on one role's record each.

## Definition of Done (`.github/pull_request_template.md`)

| Box | Can it be ticked truthfully now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | **No, open.** The `image` key is tested, but the decorative-with-override path is not (Finding 1). This closes in round 2 |
| Code follows the engineering standards | Yes. Test code only, in the file's existing style and helpers |
| No new prohibited constructs in touched code | Yes. No untyped values beyond the file's existing `JsonDocument` reads, and no data access outside the test's existing `ContentDbContext` seeding pattern |
| Every new or changed route has a guard and record scope | Yes, trivially. No route changes |
| Tests exist for the behaviour changed; changed-line coverage; security regression test | **Open until round 2** (Finding 1). No product line changes, so changed-line coverage does not apply. No security fix |
| PR checks green on the final head (run IDs quoted) | **Open.** The branch is not pushed. CI, Security (with gitleaks) and Workflow lint run ids are needed on the final head |
| Independent code review run, findings fixed or accepted | **Open.** Finding 1 is not yet fixed. The plan review and the test report are done |
| Reviewed by someone other than the author, approver's review recorded | Yes for this round: plan-reviewer, tester and this gate are separate agents. The final record is the round 2 gate |
| Rollback understood | Yes. Revert the pull request (tests and records only) |
| Deployment note | Yes. Nothing deploys before Phase D. The owner pushes on confirmation and squash-merges into `rebuild/dotnet-platform`. CI, Security and Workflow lint re-run after the merge |
| Governance: `AGENTS.md` coverage table or phase document | Not needed: no phase item changes state. The change records are under `docs/changes/ADM-12d/` |
| Governance: `docs/deferred-items.md` | Not needed: no exception. ADM-12e is a named follow-up |
| Governance: documentation | Yes, the change records. `test-report.md` must be committed (condition 6) |

## Draft pull request description (for after round 2)

This is drafted now so the owner can see the shape of the pull request. It assumes
round 2 lands as the conditions above say, and the round 2 gate updates it with the
final head, the counts and the CI run ids.

---

Title: ADM-12d: Test the card-image alt check at publish

## What and why

Follow-up ADM-12d, recorded in `docs/changes/ADM-12c/plan-approval.md` ("Follow-ups
recorded"), under audit finding ADM-12 (`docs/quality/admin-audit-2026-10-28.md:202-208`,
"ships cards with no alt text"), batch G3-1 (Blockers).

`PublishChecks` refuses to publish an item whose card image (`fields.imageId`) has no
alt of its own and no `imageAltOverride`, under the error key `image`. No test covered
it. This pull request adds two `ContentPublishTests` facts on a team member. A team
member has no other publish rule, so `image` can be asserted as the only error, with its
exact message:

- `Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override`: a blank-alt
  asset is refused and the item stays a draft. An override clears the error, the draft
  keeps its image, and it publishes.
- `Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`:
  marking the asset decorative does not exempt it. With an override, it publishes.

This is coverage for an existing check, not a fix. Both facts pass against unchanged
product code. Instead of a red commit, local mutants of the check (never committed)
show that the facts catch it being broken.

## Scope and boundaries

- In scope: `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` (two facts, no
  helper changed), and `docs/changes/ADM-12d/*`.
- Out of scope: every product file (`PublishChecks.cs`, `AltText.cs`, `ContentStore.cs`,
  `ContentDocuments.cs`), the importer (`ContentBundle.cs`, now follow-up ADM-12e), the
  whitespace-only override, the Studio, the website, workflows, migrations and lockfiles.

## Security impact

None. One test file changes. No route, policy, role, record scope, secret, dependency,
lockfile or workflow changes. The tests use the existing editor account against
`DigitalHubContent_Test`.

## Tests and evidence

From `api/`, Release, against `DigitalHubContent_Test`:

- `dotnet build DigitalHub.slnx -c Release --no-incremental`: exit 0, `13 Warning(s)`,
  `0 Error(s)`, the same as the base.
- The two facts: exit 0, `Passed: 2`, against unchanged product code.
- Local mutants of `PublishChecks.cs:99-100`. Each built with `0 Error(s)`, failed at
  its expected step, and was restored (`git diff --exit-code -- api/src` exit 0):
  - M1, the error is never added: both facts fail.
  - M2, the override is ignored: both facts fail at the second publish.
  - M3, decorative assets are exempt: the decorative fact fails.
  - M4, every decorative asset is refused: the decorative fact fails at the second
    publish.
  - The tester repeated M1 and M4 on a detached checkout: [round 2 results].
- `--filter "FullyQualifiedName~ContentPublishTests"`: exit 0, `Passed: 34`.
- Full API suite: exit 0, `Passed: 595, Failed: 0` (the base's 593 plus 2).
- Security, local: npm audit and the gate for website and Studio, the NuGet audit, and
  Semgrep 1.180.0 found 0 new findings. gitleaks: NOT RUN locally (not installed),
  covered by `security.yml` `gitleaks-pr` and `gitleaks-history`.
- Website and Studio suites: NOT RUN, because no file there changes. Covered by the CI
  Website and Studio jobs.
- End-to-end: NOT RUN locally, because the local harness is broken. Covered by the CI job
  "Studio — typecheck, build, end-to-end".
- CI: [run id]. Security: [run id]. Workflow lint: [run id]. All on the final head.

## Owner decisions

The owner's request, exactly: "ADM-12d Test the card-image alt check at publish", given
2026-11-19 to this pipeline run. No other owner decision was needed. The mutation method
comes from the pipeline brief and P-4, B-6 and the G3 rule, not from the owner.

## Definition of Done

- [ ] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changes)
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into `rebuild/dotnet-platform`; CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- Plan review Round 2, Minor 1 (the `content.fields` JSON path): settled by gate 1,
  condition 1, and implemented.
- Tester Round 1, Finding 1 (mutant M4 survived): fixed in round 2, not accepted.

## Follow-ups (not in this pull request)

- **ADM-12e: "Check the target's alt uses when an import blanks an asset's alt".**
  The importer checks a bundle's own settings row (ADM-12c), but not target rows the
  bundle leaves in place. Text in `docs/changes/ADM-12d/plan-approval.md`, "Follow-ups
  recorded". It needs an owner request before it runs.
- Correction to `docs/changes/ADM-12c/plan-approval.md:50`: the settings row exists only
  after the first settings save, so not every export carries it.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (not needed: no phase item changes; records in `docs/changes/ADM-12d/`)
- [x] `docs/deferred-items.md` updated for any exception (none)
- [x] Documentation updated (`docs/changes/ADM-12d/*`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Open items

1. Round 2 from the developer (conditions 1-7), then tester Round 2, then gate 2 round 2.
2. CI, Security (with gitleaks) and Workflow lint on the final head, with run ids quoted.
   This happens only after the owner confirms the push.
3. `test-report.md` committed (condition 6).

This approval is not the owner's confirmation that `AGENTS.md` requires, and it does not
count as an owner decision.

Round 1 result: changes needed. The draft pull request description above is replaced
by the final one in Round 2.

## Round 2

Technical lead, gate 2, round 2. 2026-11-19. Head `9234fbc`. Reviewed the new commits
`491b00c` and `9234fbc`, `implementation.md` "Round 2", and `test-report.md` "Round 2"
(`Verdict: APPROVED`, no findings).

### Decision

Approved. Round 1 Finding 1 is closed. The change goes to the owner, who decides
whether to push and open the pull request.

### Round 1 conditions

| Condition | Met? | Evidence I read or ran |
| --- | --- | --- |
| 1. Extend Fact B with the override PUT and a second publish | Yes | `git diff 7206872 HEAD -- api/`: Fact B now PUTs `imageId` and `imageAltOverride` and asserts 200. It asserts `content.fields.imageId` and `content.fields.imageAltOverride` with `Text(body, "content", "fields", ...)`. It then publishes and asserts 200 and `published`. `finally` is unchanged. Fact A is unchanged |
| 2. Rename Fact B | Yes | `Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`. `--list-tests` on my Release build lists 2 `card_image` cases, so the step 3 filter still matches both |
| 3. M1-M4, build-then-test | Yes, from two roles' records | Developer: all four built with `0 Error(s)` and each failed as the round 1 table expects (M4: Fact B, line 865, `Expected: OK`, `Actual: BadRequest`). The tester repeated M4 and M1 on a fresh detached checkout of `9234fbc` with the same results. Each restore was proved with `git diff --exit-code -- api/src`. I checked with `sed -n` that line 842 is the first publish's `BadRequest` assertion and line 865 the second publish's `OK` assertion |
| 4. Suites | Yes | Developer: class 34 of 34, full suite 595 of 595. Tester: class 34 of 34. The tester's first full run failed 10 tests in other classes (deadlocks, 401s) while ISO-2's test host was on the same database. That run is rightly excluded. The re-run with only the tester's host on the database passed 595 of 595, and the sampler log shows it. I accept the re-run as the evidence: none of the failures were in `ContentPublishTests`, and the diff changes no shared state |
| 5. Scope | Yes | `git diff --stat 7206872 HEAD`: `ContentPublishTests.cs` (+19 -1) and `implementation.md`. `git diff --exit-code 8027e87 HEAD -- api/src` exits 0 |
| 6. Records, `test-report.md` committed | Moved | Coverage row added. The coordinator commits `test-report.md` and this file after this verdict, as the coordinator's round 2 message says. I accept that change. It stays an open item until the commit exists |
| 7. Commits (B-4) | Yes | `491b00c` "ADM-12d: Prove an override lets a decorative card image publish" and `9234fbc` "ADM-12d: Record round 2 of the implementation". Both subjects are imperative, both bodies say why, and both have the trailer. `01bd0b2` and `7206872` are unchanged ancestors |

### What I ran myself this round

- `dotnet build DigitalHub.slnx -c Release --no-incremental` in `api/` at `9234fbc`:
  exit 0, `13 Warning(s)`, `0 Error(s)`, the base count.
- `dotnet test ... -c Release --no-build --list-tests | grep -c card_image`: `2`.
- `git diff --exit-code 8027e87 HEAD -- api/src`: exit 0. No product file or mutant is
  committed.
- `git merge-tree --write-tree origin/rebuild/dotnet-platform HEAD`: exit 0, no conflict.
  Note for the coordinator: `origin/rebuild/dotnet-platform` is now `74d62e9`, not
  `1c0d7f4`. #74 (GAP-09-status) changed `ENGINEERING_STANDARDS.md` and its own
  records after `1c0d7f4`. Nothing merged since `8027e87` touches
  `ContentPublishTests.cs`, `PublishChecks.cs` or `AltText.cs`. Merge `74d62e9`, the
  current base, before the push.
- I did **not** re-run any test against `DigitalHubContent_Test` this round. The
  coordinator said another worktree is using it. My round 1 class run (34 of 34 at
  `7206872`) covered Fact A and the first half of Fact B. The round 2 test evidence
  is the developer's and the tester's, and both have commands, exit codes and output.
- I did not run mutants. This role may not change product files.

### Open Definition of Done items

1. **PR checks green on the final head.** CI, Security (with gitleaks) and Workflow lint
   have not run, because the branch is not pushed. These include the Website, Studio and
   "Studio — typecheck, build, end-to-end" jobs, which cover the NOT RUN suites. The run
   ids go into the description before the merge. The final head will be the
   coordinator's records commit plus the merge of `74d62e9`, not `9234fbc`.
2. **`test-report.md` and `delivery-approval.md` committed** by the coordinator.
3. **The full suite after the base merge.** `74d62e9` changes no code, so this is a
   CI check, not a new local run.

All other boxes can be ticked truthfully. See the description below.

### Final pull request description

---

Title: ADM-12d: Test the card-image alt check at publish

## What and why

Follow-up ADM-12d, recorded in `docs/changes/ADM-12c/plan-approval.md` ("Follow-ups
recorded"), under audit finding ADM-12 (`docs/quality/admin-audit-2026-10-28.md:202-208`,
"ships cards with no alt text"), batch G3-1 (Blockers).

`PublishChecks` refuses to publish an item whose card image (`fields.imageId`) has no
alt of its own and no `imageAltOverride`, under the error key `image`
(`PublishChecks.cs:94-101`). No test covered it. This pull request adds two
`ContentPublishTests` facts on a team member. A team member has no other publish rule,
so `image` can be asserted as the only error, with its exact message
"Add alt text for the image.":

- `Publish_blocks_a_card_image_without_alt_text_until_it_has_an_override`: a blank-alt
  asset is refused and the item stays a draft. An override clears the error, the draft
  keeps its image and override, and it publishes.
- `Publish_blocks_a_decorative_card_image_without_alt_text_until_it_has_an_override`:
  marking the asset decorative does not exempt it from the check. With an override, it
  publishes. This pins the rule ADM-12c settled (`AltText.Effective`, not
  `IsPublishable`) in both directions.

This is coverage for an existing check, not a fix. Both facts pass against unchanged
product code. Instead of a red commit, four local mutants of the check (never
committed) show that the facts catch it being broken.

## Scope and boundaries

- In scope: `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` (two new facts; no
  helper changed, added or removed), and `docs/changes/ADM-12d/*`.
- Out of scope, deliberately: every product file (`PublishChecks.cs`, `AltText.cs`,
  `ContentStore.cs`, `ContentDocuments.cs`), the importer (`ContentBundle.cs`, now
  follow-up ADM-12e), the whitespace-only override, the Studio, the website, workflows,
  migrations and lockfiles.

## Security impact

None. One test file changes. No route, policy, role, record scope, secret, dependency,
lockfile or workflow changes. The tests use the existing editor account against
`DigitalHubContent_Test`.

## Tests and evidence

From `api/`, Release, against `DigitalHubContent_Test`:

- `dotnet build DigitalHub.slnx -c Release --no-incremental`: exit 0, `13 Warning(s)`,
  `0 Error(s)`, the same warning lines as the base.
- The two facts (`--filter "FullyQualifiedName~ContentPublishTests.Publish_blocks_a_card_image|FullyQualifiedName~ContentPublishTests.Publish_blocks_a_decorative_card_image"`):
  exit 0, `Passed: 2`, against unchanged product code.
- Local mutants of `PublishChecks.cs:99-100`. Each built with exit 0 and `0 Error(s)`,
  failed at its expected assertion, and was restored (`git diff --exit-code -- api/src`
  exit 0). None was committed.
  - M1, the error is never added: both facts fail at the first publish (lines 777 and
    842, `Expected: BadRequest`, `Actual: OK`).
  - M2, the override is ignored: both facts fail at the second publish (lines 800 and
    865, `Expected: OK`, `Actual: BadRequest`).
  - M3, decorative assets are exempt: the decorative fact fails at the first publish
    (line 842).
  - M4, every decorative asset is refused: the decorative fact fails at the second
    publish (line 865). M4 survived round 1 and is why that fact gained its override
    half.
  - The tester repeated M1 and M4 on a detached checkout of `9234fbc`, with the same
    results.
- `--filter "FullyQualifiedName~ContentPublishTests"`: exit 0, `Passed: 34`.
- Full API suite: exit 0, `Passed: 595, Failed: 0` (the base's 593 plus 2), by the
  developer and by the tester. One tester run that overlapped another agent's suite on
  the same database is not used as evidence.
- Security, local: npm audit and the audit gate for website and Studio, the NuGet audit
  and Semgrep 1.180.0 found 0 new findings. gitleaks: NOT RUN locally (not installed),
  covered by `security.yml` `gitleaks-pr` and `gitleaks-history`.
- Website and Studio suites: NOT RUN, because no file there changes. Covered by the CI
  Website and Studio jobs.
- End-to-end: NOT RUN locally, because the local harness is broken. Covered by the CI job
  "Studio — typecheck, build, end-to-end".
- CI: [run id]. Security: [run id]. Workflow lint: [run id]. All on the final head
  [sha].

## Owner decisions

The owner's request, exactly: "ADM-12d Test the card-image alt check at publish", given
2026-11-19 to this pipeline run. No other owner decision was needed. The mutation method
comes from the pipeline brief and from P-4, B-6 and the G3 rule, not from the owner.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changes)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (no product line changes; not a security fix; mutants M1-M4 show the tests catch the check breaking)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (plan review, tester and tech-lead gates are separate agents; records in `docs/changes/ADM-12d/`)
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into `rebuild/dotnet-platform`; CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- Plan review Round 2, Minor 1 (the `content.fields` JSON path): settled by gate 1,
  condition 1, and implemented.
- Tester Round 1, Finding 1 (mutant M4 survived): fixed in `491b00c`, not accepted.
- Gate 2 round 1, condition 6 (commit `test-report.md`): moved from the developer to
  the coordinator, who commits the records.

## Follow-ups (not in this pull request)

- **ADM-12e: "Check the target's alt uses when an import blanks an asset's alt".**
  The importer checks a bundle's own settings row (ADM-12c), but not target rows the
  bundle leaves in place. Text in `docs/changes/ADM-12d/plan-approval.md`, "Follow-ups
  recorded". It needs an owner request before it runs.
- Correction to `docs/changes/ADM-12c/plan-approval.md:50`: the settings row exists only
  after the first settings save, so not every export carries it.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (not needed: no phase item changes; records in `docs/changes/ADM-12d/`)
- [x] `docs/deferred-items.md` updated for any exception (none)
- [x] Documentation updated (`docs/changes/ADM-12d/*`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

### For the owner

- The pipeline stops here. Push `change/ADM-12d` and open the pull request only on
  your confirmation. You squash-merge it. No agent merges.
- Process note from the tester: during this run, the ISO-2 agent's test host wrote to
  `DigitalHubContent_Test` at the same time as the tester (about 16:37-16:47). That
  breaks the single-writer rule. It does not affect this change's evidence, but
  results from other agents on that database in that window should be treated as
  suspect.

This approval is not the owner's confirmation that `AGENTS.md` requires, and it does not
count as an owner decision.

Verdict: APPROVED
