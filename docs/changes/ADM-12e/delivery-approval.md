# ADM-12e delivery approval

## Round 1

Technical lead, gate 2, round 1. 2026-11-22. Branch `change/ADM-12e`, head `7a14b83`,
worktree `D:\work\DigitalHub\dh-platform-claude-adm-12e`. The base was merged in at
`235779e`, after ISO-3 (#79, `266b124`). Reviewed `plan.md` (Round 1 with the owner
update), `plan-review.md` (Round 1, `Verdict: APPROVED`, three Minors), `plan-approval.md`
(`Verdict: APPROVED`, 12 conditions), `implementation.md` (`Status: READY FOR TEST`) and
`test-report.md` (Round 1, `Verdict: APPROVED`, two Minors; written in the worktree, not
committed).

Owner's request, exactly, as given to this pipeline run: "ADM-12e". It runs the follow-up
recorded in `docs/changes/ADM-12d/plan-approval.md` ("Follow-ups recorded").

Read for this gate: `docs/changes/README.md`, `AGENTS.md` (and `CLAUDE.md`),
`ENGINEERING_STANDARDS.md` (B-4, B-6, B-8, G-8), `.github/pull_request_template.md`,
`docs/changes/ADM-12d/delivery-approval.md`, and every file in `docs/changes/ADM-12e/`.

### Decision

Changes needed, for one sentence. Tester Minor 2 goes back to the developer. Everything
else in the delivery matches the approved plan and is approved as it stands (below).

Tester Minor 2 is confirmed. I read the diff: the new bullet "Removing alt text the target
relies on" in "What the import refuses" (`docs/content-bundle.md`, new lines 180-182) ends
"See the next paragraph." The next item is the bullet "Newer edits on the target". The
paragraph it means comes after the list, "Images without alt text are **listed as
notes** ...". I send it back rather than accept it because:

1. **The text is this change's own, and it is wrong, not just unclear.** It sends an
   operator to the `--force` bullet, which says "`--force` overrides this". That is the
   opposite of the refusal the bullet describes, which `--force` does not override.
2. **The fix is inside the approved scope.** It is one sentence in `docs/content-bundle.md`,
   a file in plan section 4. It changes no code or test.
3. **The branch needs a new head anyway.** `origin/rebuild/dotnet-platform` moved to
   `aca11b0` (#80) after `235779e`, and `test-report.md` and this file still have to be
   committed. Fixing the sentence now costs no extra CI run.

The tester's other Minor and the tester's remark do not go back (see "Where each finding
goes").

### Where each finding goes

| Finding | Where it goes | Why |
| --- | --- | --- |
| Tester Minor 2: "See the next paragraph." points at the wrong item | **Back to the developer**, round 2 condition 1 | See above |
| Tester Minor 1: a one-off fail of `UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin` (503 `users_busy`) | **Recorded follow-up, not this change.** Proposed id **ADM-04-flake**, after the `ADM-06b-flake` precedent | The test is ADM-04's (`docs/changes/ADM-04/plan.md:762`, T15). No users file is in this diff, and this change does not touch the users lock. The fail shows the second request waited the lock's 5 s while the first took about 6.6 s. The test then passed alone and in a second full run (602 of 602). That points to the test's timing on a slow machine, or to the 5 s lock timeout, and not to this change. Changing the test or the timeout here would go outside the scope (B-8). The follow-up needs an owner request before it runs |
| Tester remark: two imports get round the rule (import 1 blanks an asset nothing uses, import 2 adds a card that relies on it) | **For the owner, in the pull request description. Not a finding, and not a follow-up I record** | Import 2 blanks nothing, so it gets the note, the same as a first import of the old site's images. The plan keeps that case on purpose (plan section 3.1, reason 3; G2 pins it). Closing it would mean checking alt on the bundle's own rows at import, which is "Running `PublishChecks` at import". Plan section 4 puts that out of scope "for the owner's information only", and gate 1 recorded no follow-up. I keep that position. The route is real, so the description says so, and the owner may raise it as its own request |
| Plan review Minors 1 to 3 | Closed | Settled by gate 1 conditions 5, 4 and 3; checked below |

### Conditions for the developer (round 2)

1. **Fix the pointer.** In `docs/content-bundle.md`, change "See the next paragraph." in the
   "Removing alt text the target relies on" bullet so that it names the paragraph after the
   list. For example: "See the paragraph after this list." Change nothing else in the file.
   Record the final sentence in an `implementation.md` "Round 2" section.
2. **Scope.** `git diff --stat 7a14b83 HEAD` lists only `docs/content-bundle.md` and
   `docs/changes/ADM-12e/*`, plus the files a base merge brings in. Quote
   `git diff --exit-code 7a14b83 HEAD -- api/` with exit 0, so the round 1 test evidence
   still holds for the code.
3. **The base.** Merge `origin/rebuild/dotnet-platform` (now `aca11b0`, #80) into the
   branch, as a merge, not a rebase, either in this round or by the coordinator before the
   push. I checked that it is clean: `git merge-tree --write-tree origin/rebuild/dotnet-platform HEAD`
   exits 0. `git diff --name-only 266b124 aca11b0` lists only `docs/changes/GAP-11c-deferred/*`
   and `docs/deferred-items.md`. No code changes, so the merge needs no new local test run.
4. **Commit (B-4).** One commit for the doc fix. The subject is in the imperative and starts
   with `ADM-12e:`. The body says why (gate 2, round 1). It carries the attribution trailer.
   The coordinator commits `test-report.md` and this file.
5. **Tester, round 2.** The tester checks the new sentence against the document. The tester
   also checks conditions 2 and 3 from the diff. No test re-run is needed for a
   documentation-only change with `api/` unchanged, but the tester may run one.

### What I verified myself

- **Scope.** `git diff --name-only origin/rebuild/dotnet-platform...HEAD`, after
  `git fetch`:
  `ContentBundleTests.cs`, `ContentBundle.cs`, `docs/content-bundle.md` and
  `docs/changes/ADM-12e/{plan,plan-review,plan-approval,implementation}.md`. These are only
  the plan section 4 files. None of `MediaUsage.cs`, `MediaLibrary.cs`, `AdminStore.cs`,
  `PublishChecks.cs`, `ContentStore.cs`, a users or error-pages file, the Studio, the
  website, a workflow, a migration or a lockfile is in it.
- **The code matches plan section 3.2.** I read `git diff 235779e HEAD -- api/tools`:
  - `TargetAssetsWithAltAsync` is read inside the `try`, before the table loop.
  - The blank test is C# `string.IsNullOrWhiteSpace`, not SQL.
  - `CheckAsync` gets the new `withAlt` parameter from its one caller.
  - The ADM-12e block calls `MediaUsage.FindPlacesWithoutOwnAltAsync` and adds to
    `problems`, never to `warnings`.
  - The existing note is unchanged. Only its comment was reworded, to point at the new
    block (condition 6).
- **The tests match plan section 5 and the conditions.**
  - `git diff --stat 235779e HEAD -- api/tests`: `ContentBundleTests.cs`, 129 insertions,
    0 deletions. So no existing fact or helper changed (condition 1).
  - F1, F2 and F3 each take `Assert.Single` of the problem with the prefix, then
    `Assert.Contains` of `case-studies {CaseId:D} image`,
    `site-settings 80000000-0000-0000-0000-000000000001 default share image` and
    `pages {PageId:D} section {SectionId:D}` (condition 3).
  - F1, F2, F3 and G1 import from `_source`, and G2 into `_target` (condition 4).
  - F1 and F2 assert that the target's rows are unchanged after the refusal.
- **Red before the fix (B-6, G3 rule).** `git log --first-parent --format='%h %s' 266b124..HEAD`:
  `90de0c0` plan, `235779e` merge, `21f1b6c` "ADM-12e: Test that an import may not blank alt
  text a target use relies on", `cd51f80` "ADM-12e: Refuse an import that blanks alt text a
  target use relies on", `7a14b83` records. The tests-only commit comes before the fix. The
  developer and the tester both ran the class at `21f1b6c`: exit 1, `Failed: 4, Passed: 35`.
  F1 (both cases) fails at line 536, F2 at 564 and F3 at 586, each on its own
  `Assert.False(... .Ok)`. No failure is at the migration guard. The developer's invalid
  first red run (the migration guard, before ISO-3 merged) is recorded and rightly not used.
- **Commits (B-4).** I read all three bodies with `git log --format=%B`. Each subject is
  imperative and starts with `ADM-12e:`. Each body says why. `21f1b6c` and `cd51f80` quote
  O-1 "A: refuse both". `7a14b83` quotes "ADM-12e waits". Each carries
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Build.** `dotnet build DigitalHub.slnx -c Release` in `api/` at `7a14b83`: exit 0,
  `13 Warning(s)`, `0 Error(s)`. That is the base count the developer measured at `235779e`.
- **Fastest suite covering the change.** First I checked
  `tasklist /FI "IMAGENAME eq testhost.exe"`: "No tasks are running", so no other testhost
  was using `DigitalHubContent_Test`. Then:
  `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentBundleTests|FullyQualifiedName~MediaLibraryTests"`:
  exit 0, `Passed!  - Failed: 0, Passed: 58, Skipped: 0, Total: 58`. That is the tester's
  figure (39 + 19). I did not run the full suite or the mutants. The full suite is the
  developer's and the tester's (602 of 602, Public API 102 of 102). The mutants are the
  tester's, and this role does not change product files.
- **The tester's evidence is real.** Each check has a command, an exit code and output
  lines:
  - Each mutant has its own build exit 0, a test exit of 1, the facts that failed, and a
    restore proved with `git diff --exit-code`. Six of six were killed, by exactly the facts
    in the plan's "Must fail" column.
  - The full-suite fail is quoted with its timeline and then re-run.
  - The Semgrep local Timeout is on an unchanged file. The changed-files scan exits 0 with
    0 results.
  - gitleaks is NOT RUN, with the CI jobs named.
- **The count.** 602, not the plan's 601. The developer listed 596 cases at `235779e` with
  `--list-tests`, which matches ISO-3's CI run 44554202307 ("Total tests: 596"). So the
  plan's base of 595 was one short, and the change adds 6. Accepted.
- **No conflict with an open branch.** I diffed every remote branch three-dot against
  `origin/rebuild/dotnet-platform` over the three scope files. Only three touch them:
  - `origin/change/ADM-02`, squash-merged as #54.
  - `origin/change/ADM-12c`, squash-merged as #73.
  - `origin/phase-d/content-bundle`, an old Phase D branch with no open pull request.

  `gh pr list --state open` shows only draft #60 (`diag/redirects-e2e`, do not merge).
- **The doc text.** It covers every use the check reads: pages, cards, share images,
  sections, article bodies, drafts and the settings row's default share image. It keeps
  "`--force` does not override this" (condition 5). The one wrong sentence is the bullet's
  pointer (round 2 condition 1).

### Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Scope chosen, with reasons | `ADM-12d/plan-approval.md:122-131` | Verified | Plan 3.1; code diff matches 3.2 (read above) |
| Owner's answer to O-1 recorded verbatim, with the date | P-7; plan section 9 | Verified | Plan section 9; commit bodies `21f1b6c`, `cd51f80` |
| Failing fact committed first: card use (F1) | README G3 rule; B-6 | Verified | `21f1b6c` before `cd51f80`; red at line 536 (developer and tester) |
| Target settings row with an empty `settings` table (F2) | ADM-12e text | Verified | Red at 564, green; place string asserted; tester M2, M4, M5 |
| Target page uses (F3) | ADM-12e text | Verified | Red at 586, green; place string asserted; tester M2, M4, M5 |
| The note for the old site's images kept (G1, G2) | `ContentBundle.cs` note | Verified | Green at `21f1b6c` and `7a14b83`; G2 kills M1, G1 kills M6 |
| `--force` does not bypass the refusal | ADM-12c precedent | Verified | F1 to F3 with `force: true`; M4 killed |
| Mutants M1 to M6 fail as stated | Plan section 5 | Verified | Test report section 4, six of six |
| `docs/content-bundle.md` updated | Plan 3.2; gate 1 condition 5 | **Open (round 2)** | Paragraph correct; the bullet's pointer is wrong (Minor 2) |
| Full API suite and Public API suite green in Release | Plan section 5 | Verified | 602 of 602, 102 of 102 (tester, run 2); my class run 58 of 58 |
| CI, Security and Workflow lint green on the PR head | README | Open (CI) | Not pushed |
| ADM-12 (Blocker) closed for the importer path | `admin-audit-2026-10-28.md:202-208` | Verified locally | The blanking path is closed. The two-import route stays open by the plan's design, and the owner is told |

### Definition of Done (`.github/pull_request_template.md`)

| Box | Can it be ticked now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | **Not yet.** The code criteria are met. The doc sentence is wrong until round 2 |
| Code follows the engineering standards | Yes |
| No new prohibited constructs | Yes. The new query is EF in the importer's existing data layer, parameterised, and follows the `ReadBackAsync` pattern |
| Every new or changed route has a guard | Yes. No route changes |
| Tests exist; changed-line coverage meets the gate; security fix has a regression test | **Not as written.** Tests exist and were red first, and six mutants are killed. There is no changed-line coverage gate yet (G-8, "Gap: step 4d"), so that part cannot be ticked. This follows the ADM-12c precedent |
| PR checks green on the final head (run ids) | **Open.** Not pushed |
| Independent code review run, findings fixed or accepted | **Not yet.** Minor 2 is pending in round 2. The rest is settled |
| Reviewed by someone other than the author | Yes: separate plan-reviewer, tester and tech-lead agents, with records in `docs/changes/ADM-12e/` |
| Rollback understood | Yes. Revert the PR. No schema or data change |
| Deployment note | Yes. Nothing deploys before Phase D. The owner squash-merges, and CI, Security and Workflow lint re-run after the merge |

Open items:
1. Round 2: the doc sentence (condition 1), then tester round 2.
2. `test-report.md` and `delivery-approval.md` are committed by the coordinator.
3. `aca11b0` is merged in before the push (condition 3).
4. CI, Security (with gitleaks) and Workflow lint run on the final head. Their run ids go
   into the description. These include the `studio` job ("Studio — typecheck, build,
   end-to-end"), `website`, `website-browser` and `section-compare`, which cover the suites
   NOT RUN locally.
5. The changed-line coverage part of the tests box stays unticked (no G-8 gate yet).

### Draft pull request description (for after round 2)

---

Title: ADM-12e: Refuse an import that blanks alt text a target use relies on

## What and why

This closes follow-up ADM-12e, "Check the target's alt uses when an import blanks an
asset's alt". It was recorded in `docs/changes/ADM-12d/plan-approval.md` ("Follow-ups
recorded"), under audit finding ADM-12 (Blocker, `docs/quality/admin-audit-2026-10-28.md:202-208`),
batch G3-1. It is the last open part of ADM-12.

The media library refuses an edit that removes an image's alt text while any use relies on
it (ADM-12, `MediaUsage.FindPlacesWithoutOwnAltAsync`). The content importer did not apply
that rule. A bundle could carry a copy of a target image with blank alt text and empty
other tables. An export from a database whose settings were never saved has an empty
`settings` table. Imported with `--force`, that bundle overwrote the alt text the target's
card, default share image and page sections relied on, and the import reported success.

Now, for each image the target already has with alt text, where the bundle's copy has
none, the import calls `FindPlacesWithoutOwnAltAsync` after every table is saved. It
refuses while any place uses the image without alt text of its own. The refusal is a
problem, not a note, so `--force` does not bypass it. Under owner decision O-1 it applies
whether or not the copy is marked decorative. New images, and images that already had no
alt text on the target (the old site's images), still import with a note, as before.

**This changes documented behaviour.** `docs/content-bundle.md` said images without alt
text are "listed as notes, not refused". It now records the exception, and "What the import
refuses" gains a bullet for it. The owner decided this under P-7 (O-1, below).

## Scope and boundaries

- In scope:
  - `api/tools/DigitalHub.ContentImport/ContentBundle.cs`: `TargetAssetsWithAltAsync`, the
    read before the table loop, a `CheckAsync` parameter, the check in the media loop, and
    a comment.
  - `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`: five facts, six cases. Only
    additions; no existing fact or helper changed.
  - `docs/content-bundle.md`.
  - `docs/changes/ADM-12e/*`.
- Out of scope, deliberately:
  - `MediaUsage.cs`, `MediaLibrary.cs`, `AdminStore.cs`, `PublishChecks.cs` and
    `ContentStore.cs`, which are used unchanged.
  - The ADM-12c settings check, which is unchanged.
  - The export side, the Studio, the website, workflows, migrations, lockfiles, and users
    and error-pages files.
- **Still open by design, for the owner's information.** The import does not run the
  publish checks on the bundle's own rows (plan section 4). So two imports can still reach
  the outcome. Import 1 blanks an image nothing uses, which is allowed. Import 2 adds a card
  that relies on that image with no override. Import 2 blanks nothing, so it imports with
  the note, as a first import of the old site's images does. Closing this means checking
  alt at import for the bundle's own rows, which would also refuse the old site's content.
  It needs its own request.

## Security impact

None to routes, policies, logins, secrets, dependencies or schema. `DigitalHub.ContentImport`
is an operator's command-line tool. The import only gets stricter, inside its existing
transaction. A refused import writes nothing. The new query is read-only and
parameterised, on the same connection. The new problem text carries ids, collection names
and the image's original file name, as the existing note does.

## Tests and evidence

From `api/`, Release, against `DigitalHubContent_Test`, with no other testhost on it:

- `dotnet build DigitalHub.slnx -c Release --no-incremental`: exit 0, `13 Warning(s)`,
  `0 Error(s)`. That is the same as the base at `235779e`.
- **Red first**, at `21f1b6c` (tests only),
  `dotnet test ... --filter "FullyQualifiedName~ContentBundleTests"`: exit 1,
  `Failed: 4, Passed: 35, Total: 39`. F1 (decorative and not) fails at line 536, F2 at 564
  and F3 at 586, each on `Assert.False(... .Ok)`. The guards G1 and G2 pass.
- **Green** at the fix: ContentBundleTests and MediaLibraryTests, exit 0,
  `Passed: 58, Total: 58`. Run by the developer, the tester and the tech lead.
- **Mutants** M1 to M6 (tester, never committed). Each built with exit 0 and was killed by
  exactly the facts the plan named. Each was restored with `git diff --exit-code` exit 0.
- **Full API suite**: exit 0, `Passed: 602, Failed: 0`. That is the base's 596 plus 6; the
  plan's 601 was one short. One tester run failed once in
  `UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin`
  (503 `users_busy`, a lock timing fail in ADM-04's test, with no users file in this diff).
  It passed alone and in the next full run. It is recorded as follow-up ADM-04-flake.
- **Public API suite**: exit 0, `Passed: 102, Failed: 0`.
- **Security, local:**
  - npm audit gates, website and Studio: 0 new.
  - NuGet audit gate: 0 new.
  - Semgrep on the changed files: 0 results.
  - The full Semgrep scan stopped locally on a Timeout in an unchanged file. Covered by CI
    "Semgrep (ERROR fails, WARNING reported)".
  - gitleaks: NOT RUN locally (not installed). Covered by `security.yml` `gitleaks-pr` and
    `gitleaks-history`.
- **Studio end-to-end**: NOT RUN locally, because the local harness is broken. Covered by
  the CI job "Studio — typecheck, build, end-to-end". No Studio file changes.
- **Website and Studio suites**: NOT RUN, because no file there changes. Covered by the CI
  jobs `website`, `website-browser`, `section-compare` and `studio`.
- CI: [run id]. Security: [run id]. Workflow lint: [run id]. All on the final head [sha].

## Owner decisions

- The owner's request, exactly: "ADM-12e" (typed as "run change adm12-e"), given to this
  pipeline run.
- **O-1 (ADM-12e scope)**: "A: refuse both". Given on 19 November 2026, in the orchestrator
  session for this pipeline run. The owner chose the button with that label in reply to
  "For ADM-12e O-1, which should the import do?", with the question and options A, B and C
  of plan section 9 shown. Recorded in `docs/changes/ADM-12e/plan.md` section 9.
- **The test database block**: "ADM-12e waits". Given on 19 November 2026, relayed by the
  orchestrator session, when `DigitalHubContent_Test` carried ISO-3's migration before ISO-3
  merged. The test database was not rolled back. Work resumed after #79 merged and the base
  was merged in at `235779e`. Recorded in `docs/changes/ADM-12e/implementation.md`, "Round 1
  block".

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changes)
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (tests exist, were committed red first, and kill six mutants; there is no changed-line coverage gate yet, G-8 "Gap: step 4d", so this box cannot be ticked as written)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (separate plan-reviewer, tester and tech-lead agents; records in `docs/changes/ADM-12e/`)
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into `rebuild/dotnet-platform`; CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- Plan review Minors 1 to 3 (the doc's list of uses, the media folder for each fact, and
  keeping the place-string assertions): settled by gate 1 conditions 5, 4 and 3, and
  implemented.
- Tester Minor 2 (the bullet's "See the next paragraph." pointed at the wrong item): fixed
  in round 2, not accepted.
- Tester Minor 1 (the one-off `UserRoleConcurrencyTests` fail): accepted for this pull
  request. It is outside this change, and it is recorded as follow-up ADM-04-flake.
- Tester remark (the two-import route): not a finding. It is the case plan section 4 keeps
  out of scope; see "Scope and boundaries".

## Follow-ups (not in this pull request)

- **ADM-04-flake**: "Make the two-admins demotion test robust to a slow users lock".
  `UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin` failed
  once when the second request's 5 s wait for the users lock ran out before the first
  request finished (about 6.6 s), giving 503 `users_busy` in place of the expected refusal.
  Decide whether the test or the lock timeout is at fault. Needs an owner request before
  it runs.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (not needed: no phase item changes; records in `docs/changes/ADM-12e/`)
- [x] `docs/deferred-items.md` updated for any exception (none: O-1 chose to fix, not defer)
- [x] Documentation updated (`docs/content-bundle.md`, `docs/changes/ADM-12e/*`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

### For the owner

- With round 2, ADM-12 (Blocker) has no open follow-up left. The remaining route is the
  two-import case above, which is the plan's deliberate scope, not an oversight.
- ADM-04-flake is proposed here and needs your request to run.
- This approval is not the owner's confirmation that `AGENTS.md` requires, and it does not
  count as an owner decision. The pipeline pushes and opens the pull request only on your
  confirmation, and you squash-merge it.

Round 1 result: changes needed (tester Minor 2). Superseded by Round 2 below, whose verdict
line is the one that counts for this file.

## Round 2

Technical lead, gate 2, round 2. 2026-11-22. Head `fcda229`. Reviewed the new commit
`fcda229`, `implementation.md` "Round 2" (`Status: READY FOR TEST`) and `test-report.md`
"Round 2" (`Verdict: APPROVED`, no findings; still uncommitted in the worktree).

### Decision

Approved. Round 1's one returned item (tester Minor 2) is closed. The change goes to the
owner, who decides whether to push and open the pull request.

### Round 1 conditions

| Condition | Met? | Evidence I read or ran |
| --- | --- | --- |
| 1. Fix the pointer | Yes | `git diff 7a14b83 HEAD -- docs/content-bundle.md`: one line, `See the next paragraph.` to `See the paragraph after this list.` I read lines 176-200: the bullet is followed by "Newer edits on the target", which ends the list, and the first paragraph after the list is "Images without alt text are **listed as notes** ... `--force` does not override this." The pointer now reaches it. `implementation.md` Round 2 records the final sentence |
| 2. Scope | Yes | `git diff --stat 7a14b83 HEAD`: `docs/changes/ADM-12e/implementation.md` (+24) and `docs/content-bundle.md` (+1 -1) only. `git diff --exit-code 7a14b83 HEAD -- api/`: exit 0. So the round 1 evidence (red at `21f1b6c`, M1 to M6 killed, 602 of 602, Public API 102 of 102, my own 58 of 58) still applies to the code |
| 3. The base | Moved to the coordinator | Not merged in this round. After `git fetch`, `origin/rebuild/dotnet-platform` is still `aca11b0`, and `git merge-tree --write-tree origin/rebuild/dotnet-platform HEAD` exits 0 (clean). `aca11b0` changes only `docs/changes/GAP-11c-deferred/*` and `docs/deferred-items.md`, so the merge needs no new local test run. The coordinator commits the records, then merges (not rebases) the current base before the push. If the base has moved past `aca11b0` by then and the new commits touch code, the API suites must run again before the push |
| 4. Commit (B-4) | Yes | `fcda229` "ADM-12e: Point the alt-text refusal bullet at the paragraph after the list". The subject is imperative and has the id. The body says why (gate 2 round 1, tester Minor 2). It carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` |
| 5. Tester, round 2 | Yes | `test-report.md` Round 2 checks the stat, the `api/` exit code, the one-line diff, the sentence against the document and the code, and the commit. Each check has a command and output. It is `Verdict: APPROVED` |

### What I ran myself this round

- `git log --oneline 7a14b83..HEAD`: only `fcda229`. `git log --format=%B` for its body.
- `git diff --stat 7a14b83 HEAD`, and `git diff --exit-code 7a14b83 HEAD -- api/` (exit 0).
- `git diff 7a14b83 HEAD -- docs/content-bundle.md`, and `sed -n 176,200p` of the file.
- `git fetch`, `git rev-parse --short origin/rebuild/dotnet-platform` (`aca11b0`), and
  `git merge-tree --write-tree origin/rebuild/dotnet-platform HEAD` (exit 0).
- No test run. `api/` is byte-for-byte the code I tested in round 1 (58 of 58 at `7a14b83`).

### Where each finding ended up

- Tester Minor 2 (the pointer): fixed in `fcda229`.
- Tester Minor 1 (the `UserRoleConcurrencyTests` fail): proposed follow-up ADM-04-flake. It
  needs an owner request.
- Tester remark (two imports): for the owner, in the description. It is out of scope under
  plan section 4. No follow-up is recorded.

### Open Definition of Done items

1. **PR checks green on the final head.** CI, Security (with gitleaks) and Workflow lint
   have not run, because the branch is not pushed. These include the `studio` job ("Studio
   — typecheck, build, end-to-end"), `website`, `website-browser` and `section-compare`,
   which cover the suites NOT RUN locally. The final head will be the coordinator's records
   commit plus the base merge, not `fcda229`. Its run ids go into the description before
   the merge.
2. **Records committed.** The coordinator commits `test-report.md` and `delivery-approval.md`.
3. **The base merge** of `aca11b0`, or the current base, by the coordinator.
4. **Changed-line coverage.** This part of the tests box cannot be ticked, because there is
   no G-8 gate yet ("Gap: step 4d"). The box stays unticked with that reason, as in ADM-12c.

All other boxes can be ticked truthfully. See the description below.

### Final pull request description

This description replaces the Round 1 draft.

---

Title: ADM-12e: Refuse an import that blanks alt text a target use relies on

## What and why

This closes follow-up ADM-12e, "Check the target's alt uses when an import blanks an
asset's alt". It was recorded in `docs/changes/ADM-12d/plan-approval.md` ("Follow-ups
recorded"), under audit finding ADM-12 (Blocker, `docs/quality/admin-audit-2026-10-28.md:202-208`),
batch G3-1. It is the last open part of ADM-12.

The media library refuses an edit that removes an image's alt text while any use relies on
it (ADM-12, `MediaUsage.FindPlacesWithoutOwnAltAsync`). The content importer did not apply
that rule. A bundle could carry a copy of a target image with blank alt text and empty
other tables. An export from a database whose settings were never saved has an empty
`settings` table. Imported with `--force`, that bundle overwrote the alt text the target's
card, default share image and page sections relied on, and the import reported success.

Now, for each image the target already has with alt text, where the bundle's copy has
none, the import calls `FindPlacesWithoutOwnAltAsync` after every table is saved. It
refuses while any place uses the image without alt text of its own. The refusal is a
problem, not a note, so `--force` does not bypass it. Under owner decision O-1 it applies
whether or not the copy is marked decorative. New images, and images that already had no
alt text on the target (the old site's images), still import with a note, as before.

**This changes documented behaviour.** `docs/content-bundle.md` said images without alt
text are "listed as notes, not refused". It now records the exception, and "What the import
refuses" gains a bullet that points to it. The owner decided this under P-7 (O-1, below).

## Scope and boundaries

- In scope:
  - `api/tools/DigitalHub.ContentImport/ContentBundle.cs`: `TargetAssetsWithAltAsync`, the
    read before the table loop, a `CheckAsync` parameter, the check in the media loop, and
    a comment.
  - `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs`: five facts, six cases. Only
    additions; no existing fact or helper changed.
  - `docs/content-bundle.md`.
  - `docs/changes/ADM-12e/*`.
- Out of scope, deliberately:
  - `MediaUsage.cs`, `MediaLibrary.cs`, `AdminStore.cs`, `PublishChecks.cs` and
    `ContentStore.cs`, which are used unchanged.
  - The ADM-12c settings check, which is unchanged.
  - The export side, the Studio, the website, workflows, migrations, lockfiles, and users
    and error-pages files.
- **Still open by design, for the owner's information.** The import does not run the
  publish checks on the bundle's own rows (plan section 4). So two imports can still reach
  the outcome. Import 1 blanks an image nothing uses, which is allowed. Import 2 adds a card
  that relies on that image with no override. Import 2 blanks nothing, so it imports with
  the note, as a first import of the old site's images does. Closing this means checking
  alt at import for the bundle's own rows, which would also refuse the old site's content.
  It needs its own request.

## Security impact

None to routes, policies, logins, secrets, dependencies or schema. `DigitalHub.ContentImport`
is an operator's command-line tool. The import only gets stricter, inside its existing
transaction. A refused import writes nothing. The new query is read-only and
parameterised, on the same connection. The new problem text carries ids, collection names
and the image's original file name, as the existing note does.

## Tests and evidence

From `api/`, Release, against `DigitalHubContent_Test`, with no other testhost on it:

- `dotnet build DigitalHub.slnx -c Release --no-incremental`: exit 0, `13 Warning(s)`,
  `0 Error(s)`. That is the same as the base at `235779e`.
- **Red first**, at `21f1b6c` (tests only),
  `dotnet test ... --filter "FullyQualifiedName~ContentBundleTests"`: exit 1,
  `Failed: 4, Passed: 35, Total: 39`. F1 (decorative and not) fails at line 536, F2 at 564
  and F3 at 586, each on `Assert.False(... .Ok)`. The guards G1 and G2 pass.
- **Green** at the fix: ContentBundleTests and MediaLibraryTests, exit 0,
  `Passed: 58, Total: 58`. Run by the developer, the tester and the tech lead.
- **Mutants** M1 to M6 (tester, never committed). Each built with exit 0 and was killed by
  exactly the facts the plan named. Each was restored with `git diff --exit-code` exit 0.
- **Full API suite**: exit 0, `Passed: 602, Failed: 0`. That is the base's 596 plus 6; the
  plan's 601 was one short. One tester run failed once in
  `UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin`
  (503 `users_busy`, a lock timing fail in ADM-04's test, with no users file in this diff).
  It passed alone and in the next full run. It is proposed as follow-up ADM-04-flake.
- **Public API suite**: exit 0, `Passed: 102, Failed: 0`.
- **Round 2** (`fcda229`) changes one line of `docs/content-bundle.md` and the records.
  `git diff --exit-code 7a14b83 fcda229 -- api/` exits 0, so the evidence above applies to
  the unchanged code.
- **Security, local:**
  - npm audit gates, website and Studio: 0 new.
  - NuGet audit gate: 0 new.
  - Semgrep on the changed files: 0 results.
  - The full Semgrep scan stopped locally on a Timeout in an unchanged file. Covered by CI
    "Semgrep (ERROR fails, WARNING reported)".
  - gitleaks: NOT RUN locally (not installed). Covered by `security.yml` `gitleaks-pr` and
    `gitleaks-history`.
- **Studio end-to-end**: NOT RUN locally, because the local harness is broken. Covered by
  the CI job "Studio — typecheck, build, end-to-end". No Studio file changes.
- **Website and Studio suites**: NOT RUN, because no file there changes. Covered by the CI
  jobs `website`, `website-browser`, `section-compare` and `studio`.
- CI: [run id]. Security: [run id]. Workflow lint: [run id]. All on the final head [sha].

## Owner decisions

- The owner's request, exactly: "ADM-12e" (typed as "run change adm12-e"), given to this
  pipeline run.
- **O-1 (ADM-12e scope)**: "A: refuse both". Given on 19 November 2026, in the orchestrator
  session for this pipeline run. The owner chose the button with that label in reply to
  "For ADM-12e O-1, which should the import do?", with the question and options A, B and C
  of plan section 9 shown. Recorded in `docs/changes/ADM-12e/plan.md` section 9.
- **The test database block**: "ADM-12e waits". Given on 19 November 2026, relayed by the
  orchestrator session, when `DigitalHubContent_Test` carried ISO-3's migration before ISO-3
  merged. The test database was not rolled back. Work resumed after #79 merged and the base
  was merged in at `235779e`. Recorded in `docs/changes/ADM-12e/implementation.md`, "Round 1
  block".

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changes)
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (tests exist, were committed red first, and kill six mutants; there is no changed-line coverage gate yet, G-8 "Gap: step 4d", so this box cannot be ticked as written)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (separate plan-reviewer, tester and tech-lead agents; records in `docs/changes/ADM-12e/`)
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: nothing deploys before Phase D. The owner squash-merges into `rebuild/dotnet-platform`; CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- Plan review Minors 1 to 3 (the doc's list of uses, the media folder for each fact, and
  keeping the place-string assertions): settled by gate 1 conditions 5, 4 and 3, and
  implemented.
- Tester Round 1 Minor 2 (the bullet's "See the next paragraph." pointed at the wrong
  item): fixed in `fcda229`, not accepted.
- Tester Round 1 Minor 1 (the one-off `UserRoleConcurrencyTests` fail): accepted for this
  pull request. It is outside this change, and it is proposed as follow-up ADM-04-flake.
- Tester remark (the two-import route): not a finding. It is the case plan section 4 keeps
  out of scope; see "Scope and boundaries".

## Follow-ups (not in this pull request)

- **ADM-04-flake**: "Make the two-admins demotion test robust to a slow users lock".
  `UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin` failed
  once when the second request's 5 s wait for the users lock ran out before the first
  request finished (about 6.6 s), giving 503 `users_busy` in place of the expected refusal.
  Decide whether the test or the lock timeout is at fault. Needs an owner request before
  it runs.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (not needed: no phase item changes; records in `docs/changes/ADM-12e/`)
- [x] `docs/deferred-items.md` updated for any exception (none: O-1 chose to fix, not defer)
- [x] Documentation updated (`docs/content-bundle.md`, `docs/changes/ADM-12e/*`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

### For the owner

- The pipeline stops here. Push `change/ADM-12e` and open the pull request only on your
  confirmation. You squash-merge it. No agent merges.
- With this change merged, ADM-12 (Blocker) has no open follow-up left. The remaining route
  is the two-import case above. It is the plan's deliberate scope, not an oversight, and
  closing it would need its own request.
- ADM-04-flake is proposed here and needs your request to run.

This approval is not the owner's confirmation that `AGENTS.md` requires, and it does not
count as an owner decision.

Verdict: APPROVED
