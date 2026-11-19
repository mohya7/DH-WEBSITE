# ADM-12e plan approval

Technical lead, gate 1. 2026-11-19. Branch `change/ADM-12e`, base `0488d89`
("ADM-12d: Test the card-image alt check at publish (#77)"), which is
`origin/rebuild/dotnet-platform` after `git fetch` today. Reviewed `plan.md` (Round 1,
with the owner update for O-1) and `plan-review.md` (Round 1, `Verdict: APPROVED`, no
Blocker, no Major, three Minors).

Owner's request, exactly, as given to this pipeline run: "ADM-12e". It starts the
follow-up recorded in `docs/changes/ADM-12d/plan-approval.md` ("Follow-ups recorded"),
which says ADM-12e "needs an owner request before it runs".

Read for this gate: `docs/changes/README.md`, `AGENTS.md` (and `CLAUDE.md`),
`ENGINEERING_STANDARDS.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/changes/ADM-12d/plan-approval.md`, and every file in `docs/changes/ADM-12e/`
(`plan.md`, `plan-review.md`).

## Decision

Approved. The change moves to the developer.

## Reasons

1. **Right change.** It is the ADM-12e follow-up. The plan quotes it word for word, and I
   checked the quote against `ADM-12d/plan-approval.md`. It answers the follow-up's
   "Decide the scope" with every target use, when the import blanks an alt the target
   had. It has a fact for each of the three use kinds the follow-up names: the card (F1),
   the settings row with an empty `settings` table (F2) and the page section (F3). It
   closes the importer path of the ADM-12 Blocker, using the function that already holds
   the rule (`MediaUsage.FindPlacesWithoutOwnAltAsync`) rather than a second copy.
2. **Right point in the order.** This is G3-1 (Blockers, slot 2), the last open part of
   ADM-12. It comes before any G3-2 Major. It is not in Wave 0 or Wave 1 and does not
   touch the ISO-4/ISO-5 order. The queue today, from `gh pr list --state open`, is #78
   (`change/GAP-11c`, website only) and draft #60 (`diag/redirects-e2e`, do not merge).
   ADM-12e would be the second real pull request, under the three-PR pause in
   `refinement-plan-2026-10-28.md:269`.
3. **No conflict with another branch. I checked this myself.** I ran
   `git diff --name-only 0488d89...<b>` over `ContentBundle.cs`, `ContentBundleTests.cs`
   and `docs/content-bundle.md`, first for every remote `change/`, `diag/`, `phase-*/`,
   `fix/`, `ci/` and `claude/` branch, then for every local branch. The remote branches
   that touch these files are `origin/change/ADM-02` and `origin/change/ADM-12c`, and both
   are squash-merged (#54, #73). The local branches are `change/ADM-12c` (merged as #73)
   and `phase-d/content-bundle`, an old Phase D branch with no open pull request. Neither
   open PR touches these files. The local `change/ISO-3` (a migration) does not touch
   them either. No users or error-pages file is in scope.
4. **The design holds against the code at `0488d89`.** I read it myself:
   - The media loop only adds a warning (`ContentBundle.cs:431-439`).
   - The ADM-12c check loops over the bundle's `settings` rows only (`:454-468`).
   - `CheckAsync` runs after every table's `SaveChangesAsync` (`:218-232`). So reading the
     target's alt before the table loop, and the places after it, is the right order.
     Mutant M5 pins that order.
   - A refusal goes through `UndoAsync` before any file is written (`:244-250`), so the
     rollback claims in F1 and F2 hold.
   - `SeedAsync` (`ContentBundleTests.cs:826-866`) gives `MediaId` only two uses: the
     case study card (no override) and its working copy. The section is rich text, and the
     settings row has no share image. So G1, with an override and no working copies,
     really has no use left, and M6 is killed.
   - G2 imports into an emptied target, where no asset has alt, so M1 is killed.
5. **Owner decision is in place.** O-1 is a real behaviour change: the plan quotes
   `docs/content-bundle.md:186-187`, and I confirmed the text there. It is quoted in plan
   section 9 with the owner's exact words, "A: refuse both", the date (19 November 2026)
   and where they were given. The design, the F1 `(false)` case and mutant M3 implement A.
   No other owner decision is needed.
6. **Risk is acceptable.** The import only gets stricter, inside its existing
   transaction. There is no route, policy, schema, dependency, lockfile or workflow
   change. Rollback is a revert. Each risk in plan section 10 names the fact or mutant
   that catches it.

## Conditions for the developer

1. **Scope.** `git diff --name-only 0488d89..HEAD` lists only
   `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`,
   `api/tools/DigitalHub.ContentImport/ContentBundle.cs`, `docs/content-bundle.md` and
   `docs/changes/ADM-12e/*`. Do not change or remove any existing helper or fact. Do not
   touch any users or error-pages file, nor `MediaUsage.cs`, `MediaLibrary.cs`,
   `AdminStore.cs`, `PublishChecks.cs`, `ContentStore.cs`, the Studio, the website,
   workflows, migrations or lockfiles.
2. **Failing tests first (P-4, B-6, G3 rule).** Commit 1 holds the five facts only, with
   the subject from plan section 5. Before you commit it, run command 2 and quote it in
   `implementation.md`: the command, a non-zero exit code, F1 `(true)`, F1 `(false)`, F2
   and F3 failing on `Assert.False(... .Ok)`, and G1 and G2 passing. If any of them does
   not fail as stated, stop and report it. Do not change the test to fit. Commit 2 holds
   the fix and the doc. `git log --oneline 0488d89..HEAD` must show the red commit before
   the fix.
3. **Reviewer Minor 3: keep the place-string assertions.** F2 must assert `Contains` of
   `"site-settings 80000000-0000-0000-0000-000000000001 default share image"`. F3 must
   assert `Contains` of `$"pages {PageId:D} section {SectionId:D}"`. F1 must assert
   `Contains` of `$"case-studies {CaseId:D} image"`. Each is checked on the one problem
   with the plan's prefix. Do not reduce any of them to a bare `Assert.False(result.Ok)`.
   The seeded card already makes F2 and F3 fail on today's code, so these strings are
   what proves the settings and section uses are read.
4. **Reviewer Minor 2: the media folder for each fact.** `implementation.md` names the
   folder each fact imports into (`_source` or `_target`). Use `_source` for F1, F2, F3
   and G1, as the ADM-12c forced case does (`ContentBundleTests.cs:460`). G2 imports into
   `_target`, as the plan says. If you choose differently, give the reason.
5. **Reviewer Minor 1: the doc wording.** The new paragraph in `docs/content-bundle.md`
   must cover every use the check reads. Either name share images and article bodies
   along with pages, cards, sections, drafts and the settings row, or say "any place that
   uses the image without alt text of its own". It must keep "`--force` does not
   override this". Adding a bullet to "What the import refuses" that points to this
   paragraph is your choice. Change only `docs/content-bundle.md`. Record the final text
   in `implementation.md`.
6. **The code as in plan section 3.2.** The blank test is in C#
   (`string.IsNullOrWhiteSpace`), not SQL. The refusal goes into `problems`, never
   `warnings`. The existing note stays unchanged. The comment at `:435-436` is updated.
   Build warnings are not higher than on the base: quote both counts.
7. **Databases.** Release builds only. Integration tests run against
   `DigitalHubContent_Test` only, and nothing writes to `DigitalHubContent` or
   `DigitalHubContent_Studio`. The coordinator reports that no other agent is on
   `DigitalHubContent_Test` now. Only one agent at a time may use it, so confirm with the
   coordinator before each run that this is still true.
8. **Suites.** Run plan section 5, commands 1 to 6, as written. Run `npm ci` in
   `website/` before the full API suite, as CI does. The full API suite must show 601
   passed (595 + 6) and 0 failed. If the count differs, explain it. The Public API suite
   must show 0 failed.
9. **End-to-end.** The local e2e harness is broken, so `npx playwright test` is NOT RUN
   locally. The CI job `studio` ("Studio — typecheck, build, end-to-end") is the evidence,
   and its run id on the final head is quoted at gate 2. The website suites,
   `section-compare`, Security (with gitleaks) and Workflow lint are also NOT RUN locally,
   and their CI jobs are named. They stay open items until they are green on the PR head.
10. **Commits (B-4).** Each subject is in the imperative and starts with `ADM-12e:`. Each
    body says why: the importer path of ADM-12, and owner decision O-1 "A: refuse both".
    Each commit carries the attribution trailer.
11. **Coverage table.** Every row in plan section 11 gets a command, an exit code and
    output, or the CI job that will provide it. The "Mutants M1 to M6" row is filled in
    by the tester.
12. **Tester.** The tester, on a detached checkout of the developer's commit, applies M1
    to M6 one at a time. For each mutant: a Release build exiting 0, then the five facts,
    then restore. The tester records which facts fail against the "Must fail" column,
    proves the restore with `git diff --exit-code -- api/tools`, and confirms from the
    diff that no mutant is committed. A build failure is never recorded as a killed
    mutant.

## Reviewer Minors accepted

All three Round 1 Minors are accepted without a plan revision. Each is settled by a
condition above:

- Minor 1 (the doc does not name every use): condition 5.
- Minor 2 (the media folder is not stated): condition 4.
- Minor 3 (F2 and F3 depend on the place strings): condition 3.

None of them changes the design, the scope or the owner decision.

## Follow-ups recorded

None new. Plan section 4 puts running `PublishChecks` at import for the bundle's own
published rows out of scope, "for the owner's information only". I agree it is not
needed to close ADM-12e. The owner may raise it as its own request.

## For the owner, not blocking

- With this change merged, ADM-12 (Blocker) has no open follow-up left. At gate 2, the PR
  description says that ADM-12e changes documented import behaviour under O-1 ("A: refuse
  both", 19 November 2026), so the owner sees the behaviour change before the merge.
- This approval moves the change to the developer. It is not the owner's confirmation
  that `AGENTS.md` requires, and it does not count as an owner decision.

Verdict: APPROVED
