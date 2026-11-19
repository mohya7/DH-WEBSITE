# adr-0001-accept: Plan review

## Round 1

Reviewed `docs/changes/adr-0001-accept/plan.md` (round 1, untracked) in
`D:\work\DigitalHub\dh-platform-claude-adr0001` on `change/adr-0001-accept` at
`b8b1fb1`. Remote base at review time: `8b5d6a5` (ADM-05, #59). Read first:
`docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/adr/0001-split-public-forms-api.md`, `docs/business-analysis.md` section 15.
No earlier review rounds exist.

### Findings

**1. Major. Section 5.2, checks 4, 5, 6 and 8, and check 10. The checks are tied
to `b8b1fb1`, and the base has already moved, so check 6 fails once the plan's
own rebase is done.**

- Evidence. `git ls-remote origin refs/heads/rebuild/dotnet-platform` prints
  `8b5d6a566b055cea8872f85013912b7ca3cb7ecd`. `git log --oneline
  b8b1fb1..origin/rebuild/dotnet-platform` prints one commit, `8b5d6a5 ADM-05:
  Publish the 404 and 500 pages from their screen (#59)`, and
  `git diff --name-only b8b1fb1 origin/rebuild/dotnet-platform` lists 14 files
  (`AdminStore.cs`, `ContentStore.cs`, `PublishChecks.cs`, `AdminControllers.cs`,
  `ErrorPagePublishTests.cs`, six `docs/changes/ADM-05/*.md`, and three Studio
  files). Check 10 says to rebase and re-run checks 1 to 9. After that rebase,
  `git diff --name-only b8b1fb1...HEAD` (check 6) also lists those 14 ADM-05 files,
  so the exact eight-line list cannot match. `git diff --check b8b1fb1...HEAD`
  (check 8) would cover ADM-05's diff instead of only this change. Checks 4 and 5
  are limited to a path, so they still give the right answer, but they compare
  against a commit that is no longer the base. Section 2 also says `b8b1fb1` is
  "still the remote head", which is no longer true.
- What would satisfy me. Name the base as a value found at run time: the merge
  base after the rebase (`git merge-base origin/rebuild/dotnet-platform HEAD`,
  recorded as a SHA, today `8b5d6a5`), or `origin/rebuild/dotnet-platform...HEAD`.
  Use it in checks 4, 5, 6 and 8, and update section 2's base statement.

**2. Major. Section 5.2, check 11 (CI). The CodeQL expectation is out of date, and
the plan does not state the required checks that branch protection now enforces.**

- Evidence. `gh api repos/mohya7/DH-WEBSITE --jq '{visibility, private}'` prints
  `{"private":false,"visibility":"public"}`. The repository is no longer private.
  `.github/workflows/codeql.yml:32` runs `analyze` when
  `github.event.repository.private == false || vars.CODEQL_ENABLED == 'true'`, and
  run `44424309387` (#58, 18 November) shows `CodeQL (csharp)` success and
  `CodeQL (javascript-typescript)` success. The plan expects `analyze` to show
  `skipping` "on this private repository (as on #56)" and tells the tester to
  "Record it as skipped". A tester who follows that would record evidence that is
  false. Separately,
  `gh api repos/mohya7/DH-WEBSITE/branches/rebuild/dotnet-platform/protection`
  now requires 13 status-check contexts, `allow_force_pushes: false`, and
  `strict: false`. The default branch is `rebuild/dotnet-platform`. The 13
  contexts do match the plan's job list for CI, Security and Workflow lint, all of
  which run on every pull request with no paths filter (`ci.yml`,
  `security.yml:47`, `workflow-lint.yml:23`), so a docs-only PR will report all 13.
  The plan never says this, though, and it names jobs only by their ids.
- What would satisfy me. Rewrite check 11 so that it:
  - expects both CodeQL jobs to run and pass, with their run id;
  - lists the 13 required contexts by their exact check names, as returned by the
    protection API, each `pass`;
  - says `screenshot-parity` is not required and may be skipped.

  The rebase in check 10 must stay an ordinary rebase on the change branch.
  Nothing here force-pushes a protected branch.

**3. Minor. Section 3.1, the O-13 sentence. It reads as part of the owner's
acceptance.**

- Evidence. The Status bullet runs straight from the owner's quote into "O-13
  (point 5) is not decided by this and stays open for ISO-6." The owner said only
  "accepted". The sentence is accurate on the base, and it is the fail-closed
  reading (P-5). The register shows O-13 as a recommendation only
  (`ENGINEERING_STANDARDS.md:160`), refinement plan line 268 lists it as open, and
  line 217 says "owner decides O-13" for ISO-6. But nothing in the sentence marks
  it as the recorder's note rather than a condition the owner set.
- What would satisfy me. Mark it as a note that is not the owner's words, and
  give its source, for example "Note (recorded with this change, not the owner's
  words): O-13 ... stays open; see `ENGINEERING_STANDARDS.md` section 9, O-13."
  Checks R2 and 2 still hold.

**4. Minor. Section 3, rejected alternatives, `docs/business-analysis.md` 15.1.
The deferred item has two possible destinations.**

- Evidence. `ENGINEERING_STANDARDS.md` section 7 says decisions live in
  "`docs/adr/` (Gap: step 1b); until then `docs/business-analysis.md` section 15".
  Section 15.1 still says "Contact form | Moves to the Content API", which an
  accepted ADR 0001 now contradicts. Leaving it out is right (B-8), and the row did
  go stale with O-12. But the plan sends it to "ISO-2 ... or GAP-13's records
  work", and `AGENTS.md` says moved items name their destination.
- What would satisfy me. Name one destination (ISO-2 is the natural one), and say
  in one sentence why section 7's "until then section 15" clause does not require
  15.1 to change here: the ADR in `docs/adr/` is itself the decision record.

**5. Minor. Section 2, evidence details that are inaccurate or stale.**

- The `vacancies` mapping is `ContentModelBuilder.cs:30`
  (`ConfigureRecord<Vacancy>(builder, "vacancies")`), not only "the `vacancies`
  table in `InitialPlatform`".
- The open-PR list includes #57 and #59, which are no longer open. Today
  `gh pr list --state open` lists #58, #60, #65 and #66, and none of them touches
  `docs/adr/`, `ENGINEERING_STANDARDS.md` or `docs/changes/adr-0001-accept/`.
  Check 9 re-runs this anyway.
- What would satisfy me. Correct the first point; the second is covered by
  check 9.

### Checked and found sound

- **Base move.** `8b5d6a5` touches neither `docs/adr/` nor
  `ENGINEERING_STANDARDS.md` nor this folder: `git diff --stat b8b1fb1
  origin/rebuild/dotnet-platform -- docs/adr ENGINEERING_STANDARDS.md
  docs/changes/adr-0001-accept` prints nothing and exits 0.
- **Owner's words (P-7).** The quoted word, the date, the place and the question
  match the owner's request byte for byte, including the pipe and the straight
  quotes. The format follows the existing O-12 record ("b" (28 October 2026, in
  this session, reply to "...")).
- **The kept Proposed text (standard section 7).** The original sentence stays
  word for word, quoted, with its date, and that date is supported by the ADR's
  own `Date: 28 October 2026` (line 5). The new status goes above the original
  rather than after it. That is the usual ADR layout, and the rule's point, "the
  original stays", is kept.
- **The `ENGINEERING_STANDARDS.md:159` edit is a status note, not a rule change.**
  The row is in section 9, "Open owner decisions", not in a rule table, so line 12
  ("A rule changes only through an ADR") does not apply. The change it records is
  itself an ADR's acceptance. Keeping the row on one line holds the file at 187
  lines (`wc -l` prints `187` today), so the `ENGINEERING_STANDARDS.md:12`
  citations in `docs/changes/GAP-34/*` stay valid. That is correct.
- **Scope (B-8).** Leaving out the refinement plan (a reviewed snapshot whose line
  numbers are cited, with line 25 as a schedule cell that also holds "Owner
  decisions in one round") and the README G2 checklist (which states no status)
  is right. Nothing a parallel change owns is touched.
- **"accepted" needs no further owner answer.** I read all 91 lines of the ADR.
  Points 1 to 6, Consequences, Rejected and Rollback contain no open alternative.
  The only dependent decision is O-13 (lines 54 and 66), which gates ISO-6 in
  Phase D only (refinement plan lines 30 and 217), outside "so G2 (ISO-1 to ISO-5)
  can start". Not BLOCKED ON OWNER.
- **The ADR matches the code.** I spot-checked each cited line at `b8b1fb1`:
  - `PublicContactController.cs:11` is `[Route("api/v1/public/contact")]`.
  - `PublicApplyController.cs:11` is `[Route("api/v1/public/apply")]`.
  - `appsettings.json:43` is `"AllowedHosts": "*"`.
  - `PublicContactStore.cs:71` is `db.ContactRequests.Add(...)`.
  - `ApplicationIntake.cs:62` is `db.Vacancies`, `:217` is `db.SiteSettings`, and
    `:236` is `MERGE application_counts WITH (HOLDLOCK)`.
  - `ContentModelBuilder.cs` lines 133, 180 and 195 map `site_settings`,
    `contact_requests` and `application_counts`.
  - Grepping all four public files for `db.`, `Database.` and SQL finds no other
    table access. The dedupe and throttles are in memory (`ApplyDedupe`).
  - A route grep finds exactly two `api/v1/public/` routes.
  - `docs/security-deployment.md:16-18` shows the `dh_content_app` grants as
    quoted.
  - `AuditLogPermissionTests.cs` exists, and `api/src` holds only
    `DigitalHub.Api` and `DigitalHub.Images`.
- **The red greps on the base.** R1 printed `3:- Status: Proposed...`, exit 0. R3
  printed `159:| O-12 ...`, exit 0. R2 and R4 each exit 1. `grep -rn "Accepted"
  docs/adr/` exits 1. Against the 3.1 text, R1 and R3 turn to exit 1, R2 and R4
  match line 3 and line 159, the fixed strings in checks 2 and 3 each fall on a
  single wrapped line, and the hunk is `@@ -3,2 +3,5 @@`.
- **Line endings.** `git ls-files --eol` shows `i/lf w/crlf` for both files, as the
  plan says.
- **Security, migrations and gates.** No route, policy, login, secret, dependency
  or migration changes. No gate, guard or baseline is touched (P-6).
- **Rollback and risks.** Reverting the PR is real and complete. The risks are
  specific, and each names its check.

Noted, not a finding for this change: `ENGINEERING_STANDARDS.md` P-1's status,
"no branch protection recorded", and refinement plan line 266 (O-9) are now stale,
because branch protection is on and the repository is public. That belongs with
GAP and O-9 records work, not here.

Verdict: CHANGES NEEDED

## Round 2

Reviewed the revised `plan.md` (round 2, untracked) in the same worktree, still
at `b8b1fb1`. The remote base is still `8b5d6a5`
(`git ls-remote origin refs/heads/rebuild/dotnet-platform` prints
`8b5d6a566b055cea8872f85013912b7ca3cb7ecd`). I checked each answer against the
plan body, not only against the revision log.

### Round 1 findings, checked in the body

| # | Round 1 finding | Where the body answers it | Result |
| --- | --- | --- | --- |
| 1 | Major: checks tied to `b8b1fb1` | Header lines 7 to 22. New 5.0 (fetch, ordinary rebase of `change/adr-0001-accept`, `BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD)`, recorded as a full SHA). Checks 4, 5, 6 and 8 use `"$BASE"`. Check 10 repeats 5.0 if the base moves. New risk row. | Closed. `git diff --quiet b8b1fb1 8b5d6a5 -- docs/adr ENGINEERING_STANDARDS.md` exits 0, so the red results taken on `b8b1fb1` also hold on `8b5d6a5`. After the rebase, `"$BASE"...HEAD` covers only this change. |
| 2 | Major: CodeQL expectation and required checks | Check 11 lists 13 contexts, says CodeQL is expected to run, and says screenshot parity is not required and is recorded as skipped. The tester re-reads the protection list at test time. | Closed. Details below. |
| 3 | Minor: O-13 sentence read as the owner's | 3.1. The Status bullet holds only the owner's words. The O-13 note is its own bullet, says "recorded with the acceptance and not the owner's words", and cites `ENGINEERING_STANDARDS.md` section 9, O-13. Check 3 greps that wording. The hunk is `@@ -3,2 +3,8 @@`, in check 4 and the risk row. | Closed. The 3.1 block counts 3 + 3 + 2 = 8 lines, which matches `+3,8`. |
| 4 | Minor: 15.1 had two destinations | Rejected alternatives name ISO-2 only and explain why section 7's "until then" clause does not apply. New coverage row. | Closed. See Minor finding R2-2 for a follow-through point. |
| 5 | Minor: `vacancies` citation; stale PR list | Section 2 cites `ContentModelBuilder.cs:30`, and the PR list is now #58, #60, #65, #66. | Closed. `gh pr list --state open` prints 66, 65, 60, 58 today. |

### Re-run, as asked

- **Red greps on the base (`b8b1fb1`; neither file differs on `8b5d6a5`).**
  - R1: `3:- Status: Proposed. The direction is decided (owner decision below); the`, exit 0.
  - R2: exit 1.
  - R3: `159:| O-12 | How to isolate the Studio from the we...`, exit 0.
  - R4: exit 1.
- **The grep strings will match the 3.1 text.** Each fixed string in R2 and in
  checks 2 and 3 (including the new note string) falls on a single line of the
  3.1 block. Each will therefore match exactly once after the change, and R1 will
  stop matching, because "Status: Proposed" no longer occurs.
- **The required checks, read by me.**
  `gh api repos/mohya7/DH-WEBSITE/branches/rebuild/dotnet-platform/protection --jq '.required_status_checks.contexts[], .required_status_checks.strict'`
  prints these 13 contexts, then `false`:
  1. `API — Release build, migrations, integration tests`
  2. `Website — typecheck, tests, design check, snapshot build`
  3. `Website — browser tests, default and consent builds`
  4. `Studio — typecheck, build, end-to-end`
  5. `Section comparison against feature/interviewer-portal`
  6. `Security gate self-test`
  7. `npm audit (website) — High and Critical`
  8. `npm audit (studio) — High and Critical`
  9. `NuGet vulnerable packages (api) — High and Critical`
  10. `Secret scan (gitleaks, this pull request's commits)`
  11. `Secret scan (gitleaks, full history)`
  12. `Semgrep (ERROR fails, WARNING reported)`
  13. `actionlint (every workflow)`

  These are identical, character for character and in the same order, to items 1
  to 13 of check 11. The job-id mapping is right too: the names match each job's
  `name:` in `ci.yml`, `security.yml` and `workflow-lint.yml`.
- **CodeQL and screenshot parity.** `gh pr checks 58` shows `CodeQL pass`,
  `CodeQL (csharp) pass` and `CodeQL (javascript-typescript) pass` (run
  `44424309387`), and `Screenshot parity (optional, label "screenshots")
  skipping`. That is what check 11 expects. `codeql.yml:32` is quoted correctly,
  and visibility prints `private=false visibility=public`.
- **The workflow line citations.** `ci.yml` 13 to 18 is the `on:` block, with
  `pull_request` and no paths filter. `security.yml:46` is the `pull_request:`
  trigger, with no filter. `workflow-lint.yml:23` is the "No paths filter and no
  if:" comment.

### Findings

**R2-1. Minor. Section 5.0 and checks 4, 5, 6, 8 and 10: `$BASE` is a shell
variable, but agent Bash calls do not keep shell state.**

- Evidence. 5.0 sets `BASE=$(...)` once, and later checks use `"$BASE"`. Each Bash
  call by the developer or the tester starts a fresh shell, so `"$BASE"` will be
  empty in a later call. `git diff -U0 "" -- ...` then fails, or compares against
  the wrong thing.
- What would satisfy me. This does not block, because 5.0 already requires the
  full SHA to be recorded. The developer and the tester should either put the
  recorded SHA in each command, or re-derive `BASE` in the same call as the check.
  The tech lead can note this at gate 1. No plan round is needed.

**R2-2. Minor. Section 3, the 15.1 destination: the hand-off to ISO-2 is recorded
only in this change's plan.**

- Evidence. The body says ISO-2's plan "must list 15.1 in its scope". But nothing
  an ISO-2 architect is told to read will carry it: the refinement plan,
  `docs/deferred-items.md` and the README G2 checklist are all out of scope, and
  "What this unblocks next" mentions only ISO-1.
- What would satisfy me. One line in "What this unblocks next", or in the PR body,
  naming ISO-2 and `docs/business-analysis.md` 15.1. That would make the hand-off
  findable. This does not block.

### Still sound from Round 1

- The owner's words are quoted exactly, and the Proposed text is kept with its
  date.
- The `ENGINEERING_STANDARDS.md:159` edit is a status note in section 9, not a
  rule change under line 12, and the file stays at 187 lines.
- Leaving the refinement plan, the README checklist and `business-analysis.md`
  out of scope is right (B-8).
- "accepted" needs no further owner answer: O-13 gates only ISO-6.
- The ADR's facts match the code at the cited lines.
- Nothing touches security, migrations, gates or baselines.
- Rollback and the risks are specific. The new risk rows (stale base, stale CI
  assumptions) name their checks.
- No open PR overlaps this change's files.

Verdict: APPROVED
