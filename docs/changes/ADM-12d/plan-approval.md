# ADM-12d plan approval

Technical lead, gate 1. 2026-11-19. Branch `change/ADM-12d`, base `8027e87`
("ADM-12c: Refuse a default share image without alt text of its own (#73)").
Reviewed `plan.md` (revision round 2) and `plan-review.md` (Round 1 CHANGES NEEDED,
Round 2 `Verdict: APPROVED`, one new Minor).

Owner's request, exactly, as given to this pipeline run: "ADM-12d Test the
card-image alt check at publish".

Read for this gate: `docs/changes/README.md`, `AGENTS.md` (and `CLAUDE.md`),
`ENGINEERING_STANDARDS.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/changes/ADM-12c/plan-approval.md`, and every file in `docs/changes/ADM-12d/`
(`plan.md`, `plan-review.md`).

## Decision

Approved. The change moves to the developer.

## Reasons

1. **Right change.** It is the follow-up recorded word for word in
   `docs/changes/ADM-12c/plan-approval.md:54` ("Follow-ups recorded"), and the owner's
   request above starts it, as that record requires. It closes both parts of the
   follow-up: a `ContentPublishTests` fact for the `image` error key, and the importer
   question assessed and decided (plan section 3.4).
2. **Right point in the order.** It belongs to G3-1 (Blockers, slot 2), as the last
   follow-up of ADM-12, a Blocker (`refinement-plan-2026-10-28.md:225`). It comes before
   any G3-2 Major. It is not a Wave 0 or Wave 1 item, and it does not touch the ISO-4 or
   ISO-5 order. Queue today: open PR #74 (`change/GAP-09-status`) and draft #60
   (`diag/redirects-e2e`, do not merge), from `gh pr list --state open`. ADM-12d would be
   the second real pull request, under the three-PR pause in `refinement-plan:269`.
3. **No conflict with another branch.** Verified myself. `git diff --name-only 8027e87 <b>
   -- api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs
   api/src/DigitalHub.Api/Content/PublishChecks.cs` is empty for `change/ADM-04`,
   `change/ISO-2`, `change/ADM-05`, `change/GAP-NEXT-UPGRADE` and `change/GAP-09-status`.
   A three-dot diff over every `origin/change/*` branch lists `PublishChecks.cs` only for
   `origin/change/ADM-05`, which is squash-merged (#59), and the two-dot content diff is
   empty. No users or error-pages files are in scope (plan section 4).
4. **The design is sound, checked against the code.** At `8027e87`, `PublishChecks.cs`
   line 99 is `if (EffectiveAlt(over, fieldAsset.Alt) is null)` and line 100 is the
   unbraced `Add(errors, "image", "Add alt text for the image.");`, as section 3.2's
   mutant table says. `EffectiveAlt`/`First` (lines 324-333) ignore `Decorative`, so
   Fact B pins a real rule. `MediaAsset.Decorative` is a `bool`
   (`ContentEntities.cs:280`), so M3 compiles. No `*.csproj`, `*.props` or `*.targets`
   under `api/` sets `TreatWarningsAsErrors` or `WarningsAsErrors` (grep empty), so M1
   and M2 build. Asserting `image` as the only error key, together with M1 turning both
   facts from 400 to 200, rules out the test passing because some other error blocks
   publish.
5. **The mutation method is acceptable evidence for coverage work.** P-4, B-6 and the G3
   rule ("shown failing before the fix") assume a fix. There is none here: the check
   exists, and a red commit would mean committing broken product code, which P-6 forbids.
   Local mutants, each with a build that must exit 0 before its run, recorded and never
   committed, plus the tester repeating M1 on the detached checkout, meet the intent of
   those rules. This is not an exception to any rule, so it needs no D-NNN entry and no
   owner decision. The plan credits the method to the coordinator's brief and the rules,
   not to the owner, which is correct.
6. **Risk is acceptable.** Two tests and records, no product file, no route, policy,
   dependency, lockfile, workflow or migration. Rollback is a revert. The one realistic
   risk, a mutant committed by mistake, is caught by `git diff --exit-code -- api/src`
   and the step 7 file list, and the tester checks the diff.
7. **Owner decisions.** None is needed for this change (plan section 9). ADM-12e is a
   behaviour change in the importer, so it is kept out of scope and left for its own
   owner request (P-7, B-8). It is recorded below and not assumed.

## Conditions for the developer

1. **JSON path (reviewer Round 2, Minor 1).** Fact A, step 4 reads the PUT response at
   `content.fields.imageId` and `content.fields.imageAltOverride`, with the existing
   `Text(body, "content", "fields", ...)` helper. The item response nests the draft under
   `content` (`ContentStore.cs:1172`, `Body` at 1286).
2. **First run is not red.** Record the first run of Facts A and B as "passes against
   unchanged product code; coverage for existing behaviour". Never describe it as a red
   test.
3. **Mutants exactly as section 3.2.** M1, M2 and M3, one at a time, each the exact
   one-line replacement in the table. For each: `git diff -- api/src` shows the one line;
   `dotnet build DigitalHub.slnx -c Release` exits 0 with `0 Error(s)`, recorded; only
   then step 3's `--no-build` filter, recording the non-zero exit code and each failing
   fact's first failing assertion, matched to the "Expected failure" column; then
   `git restore`. A failed build stops the run and is never recorded as a survived mutant.
   A cleanup failure from `finally` is reported and is not evidence. A mutant that does
   not fail as expected stops the work and is reported; the test is not changed to fit.
4. **Restore proved.** After the last mutant, `git diff --exit-code -- api/src` exits 0,
   the Release build exits 0, and the two facts pass again, before steps 5 and 6. Each
   mutant's diff goes into `implementation.md` as text. No mutant is ever staged.
5. **Scope.** `git diff --name-only 8027e87..HEAD` lists only
   `api/tests/DigitalHub.Api.Tests/ContentPublishTests.cs` and `docs/changes/ADM-12d/*`.
   No helper in `ContentPublishTests.cs` is changed or removed. No users or error-pages
   file, no Studio, website, workflow, migration or lockfile.
6. **Cleanup order.** In `finally`: `RemoveItemAsync("team-members", id)` first, then
   `RemoveMediaAsync(mediaId)` (the FK is `DeleteBehavior.NoAction`).
7. **Databases.** Release only. Integration tests against `DigitalHubContent_Test` only.
   Nothing writes to `DigitalHubContent` or `DigitalHubContent_Studio`. Check with the
   coordinator that no other agent is writing the test database before each run.
8. **Build warnings.** Record the base build's warning count and show the change adds
   none (plan section 5, step 2).
9. **Suites.** Run `npm ci` in `website/` before the full API suite, as CI does. The full
   suite total is the base total plus 2, with no failures. Studio and website suites are
   NOT RUN (no file there changes), with the CI jobs named. `npx playwright test` is NOT
   RUN locally because the local e2e harness is broken; the CI job "Studio — typecheck,
   build, end-to-end" is the evidence. CI, Security (with gitleaks) and Workflow lint on
   the final head stay open at gate 2 until they are green and their run ids are quoted.
10. **Commits (B-4).** Each subject is imperative and starts with `ADM-12d:`. The body says
    why (coverage for an existing check, no product change). Each commit carries the
    attribution trailer.
11. **Coverage table.** The importer row's evidence reads "Moved to follow-up ADM-12e,
    recorded in `docs/changes/ADM-12d/plan-approval.md`, Follow-ups recorded". Every other
    row has command, exit code and output.
12. **Tester.** The tester repeats M1 on the detached checkout of the developer's commit,
    with the same build-then-test steps, and confirms from the diff that no mutant is
    committed.

## Reviewer Minors accepted

- Round 1, Minors 2, 3 and 4: closed in plan round 2, confirmed by the reviewer.
- Round 2, Minor 1 (`content.fields.imageId` path): accepted without a plan revision. A
  wrong path makes `GetProperty` throw on the first run, so it cannot pass silently.
  Condition 1 settles it.

## Follow-ups recorded

- **ADM-12e: "Check the target's alt uses when an import blanks an asset's alt".** The
  importer checks a bundle's own settings row (ADM-12c) but not a target row the bundle
  leaves in place. A bundle with an empty `settings` table, which an export from a
  database whose settings were never saved also has (`AdminStore.cs:233` and `:273`,
  "The first save is what creates the row."), can blank the alt of the asset the target's
  default share image relies on. The same holds for target pages and cards. Decide the
  scope (settings only, every use, or leave it) and add a failing `ContentBundleTests`
  fact first. Source: `docs/changes/ADM-12d/plan.md` section 3.4; ADM-12c plan-review
  Round 2, Minor 4. ADM-12e is not in this change. It needs an owner request before it
  runs.

  Recorded as the architect proposed, with one edit: the line reference is corrected
  from `AdminStore.cs:274-278` to the lines that hold the text at `8027e87` (233 and
  273).
- **Correction to an earlier record.** `docs/changes/ADM-12c/plan-approval.md:50` says
  "every export carries the singleton settings row". That is not quite true: the row only
  exists after the first settings save (`AdminStore.cs:273`). The ADM-12c record stays
  as written; this note is the correction, and ADM-12e starts from it.

## For the owner, not blocking

- At gate 2, the PR description lists ADM-12e under its own heading, so the owner sees
  it before the merge.
- This approval moves the change to the developer. It is not the owner's confirmation
  that `AGENTS.md` requires, and it does not count as an owner decision.

Verdict: APPROVED
