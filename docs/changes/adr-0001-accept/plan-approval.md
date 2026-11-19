# adr-0001-accept: Plan approval (gate 1)

Tech lead, gate 1. Reviewed `plan.md` (round 2) and `plan-review.md` (Round 2,
`Verdict: APPROVED`, Minors R2-1 and R2-2) in
`D:\work\DigitalHub\dh-platform-claude-adr0001`, branch `change/adr-0001-accept`
at `b8b1fb1`, on 19 November 2026. Read first: `docs/changes/README.md`,
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `docs/quality/refinement-plan-2026-10-28.md`
(execution order, Track G2, risks), `docs/adr/0001-split-public-forms-api.md`,
`.github/pull_request_template.md`, `docs/business-analysis.md` 15.1.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires and it is not an owner decision (P-7).

## Decision

Approved, with the conditions below.

## What I verified myself

| Point | Command or source | Result |
| --- | --- | --- |
| Reviewer gate | `plan-review.md`, last line of Round 2 | `Verdict: APPROVED` |
| Base | `git ls-remote origin refs/heads/rebuild/dotnet-platform` | `8b5d6a566b055cea8872f85013912b7ca3cb7ecd` |
| Base move does not touch scope | `git diff --stat b8b1fb1 origin/rebuild/dotnet-platform -- docs/adr ENGINEERING_STANDARDS.md docs/changes/adr-0001-accept` | exit 0, no output |
| Status line on the base | `docs/adr/0001-split-public-forms-api.md` lines 3 and 4 | `- Status: Proposed. The direction is decided (owner decision below); the` / `  details here are for review before any code is written.` |
| O-12 row | `grep -n "(proposed)" ENGINEERING_STANDARDS.md` | `159:| O-12 | How to isolate the Studio from the website on t...`; `wc -l` prints `187` |
| O-13 is open and in section 9 | `grep -n "^## " ENGINEERING_STANDARDS.md`; line 160 | `142:## 9. Open owner decisions`; line 160 is the O-13 row with a recommendation only |
| Line endings | `git ls-files --eol` on both files | `i/lf w/crlf` for each |
| Open PRs | `gh pr list --repo mohya7/DH-WEBSITE --state open --json number --jq '.[].number'` | `66 65 60 58` |
| No open PR touches scope | `gh pr diff <n> --name-only \| grep -E '^(docs/adr\|ENGINEERING_STANDARDS.md\|docs/changes/adr-0001)'` for 58, 60, 65, 66 | no match for any |
| No in-flight branch touches scope | In `dh-platform`, `git diff --name-only $(git merge-base origin/rebuild/dotnet-platform <b>) <b> -- docs/adr ENGINEERING_STANDARDS.md docs/changes/adr-0001-accept` for `change/GAP-09` (`f89662a`), `change/GAP-11` (`c1ea9f3`), `change/ADM-12` (`b9f317e`), `change/ADM-04` (`aa6ada9`) | no output for any |
| No uncommitted work in another worktree touches scope | `git status --porcelain -- docs/adr ENGINEERING_STANDARDS.md docs/changes/adr-0001-accept` in every worktree from `git worktree list` | only this worktree, `?? docs/changes/adr-0001-accept/` |
| 15.1 is the row the plan hands off | `docs/business-analysis.md:453` | `| Contact form | Moves to the Content API |` under `### 15.1 Made` (line 432) |

## Reasons

- **Right change.** The refinement plan's execution order, step 1, slot 2, is
  "Owner decisions in one round, ADR 0001 reviewed and accepted", and step 3 (G2,
  ISO-1 to ISO-5) needs "ADR accepted and CI honest first". This change records
  only the acceptance. It does not claim "Owner decisions in one round".
- **Right point in the order.** It is a step 1 item, overdue by date, and every
  G2 item waits on it. It is not a Blocker or a Major, so "Blockers before
  Majors" does not order it; it adds no code, so it does not compete with the
  open G3-1 Blockers (ADM-04 in #58, ADM-12, ADM-01a) for files. ISO-4 after
  ISO-5 is untouched. Slot 2 takes at most one merge a day and #58 is also slot 2;
  the merge order is the owner's to set, and the PR body says it is slot 2.
- **No conflict.** Verified above: no open PR, in-flight branch or other worktree
  touches `docs/adr/`, `ENGINEERING_STANDARDS.md` or this folder.
- **Owner decision is quoted.** "accepted", 19 November 2026, in a Claude Code
  session, replying to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can start".
  The text in 3.1 quotes it byte for byte. No other owner decision is needed: O-13
  gates ISO-6 only, and the plan records it as open in a note that is marked as
  not the owner's words.
- **Risk is low.** Two status lines in two documents, no code, no migration, no
  gate touched (P-6). Rollback is a revert.

## Reviewer's Minors

- **R2-1 (`$BASE` does not survive between Bash calls). Accepted, as condition C2.**
  No plan round is needed; 5.0 already requires the SHA to be recorded.
- **R2-2 (hand-off of `docs/business-analysis.md` 15.1 to ISO-2 is findable only
  in this plan). Accepted, as condition C5.** It is recorded in
  `implementation.md` and in the PR body. Neither is a file outside the plan's
  scope.
- **Round 1 note (P-1 "no branch protection recorded" and refinement plan O-9 are
  stale, now that protection is on and the repository is public).** Accepted as
  out of scope. It belongs with GAP and O-9 records work.

## Conditions for the developer

- **C1. Rebase first (5.0).** `git fetch origin rebuild/dotnet-platform`, then an
  ordinary `git rebase origin/rebuild/dotnet-platform` of `change/adr-0001-accept`.
  Record `BASE` in `implementation.md` as a full 40-character SHA
  (`8b5d6a566b055cea8872f85013912b7ca3cb7ecd` if the base has not moved).
- **C2 (R2-1). Every check that uses the base names it in the same call.** Either
  write the recorded SHA into the command, or derive it in the same Bash call:
  `BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD) && echo "$BASE" && git diff ... "$BASE" ...`.
  Quote the command exactly as run, with the SHA it printed. A check run with an
  empty `$BASE` is not evidence and must be re-run.
- **C3. Red before green.** Run R1 to R4 on `BASE` before editing and quote each
  with its exit code. This is a docs change, not a security fix, so B-6's red
  commit does not apply; the red greps are its failing check.
- **C4. Exact edits only.** The eight lines in 3.1, replacing ADR lines 3 and 4,
  and `(proposed)` to `(accepted 19 November 2026)` on `ENGINEERING_STANDARDS.md`
  line 159. Nothing else in either file, and no other file except this folder's
  records. Do not convert line endings.
- **C5 (R2-2). Record the hand-off.** `implementation.md` carries a "Moved items"
  line: "`docs/business-analysis.md` 15.1 ('Contact form | Moves to the Content
  API') moves to ISO-2, whose plan lists it in scope." Gate 2 puts the same line
  in the PR body.
- **C6. Commit (B-4, B-5).** Stage exact paths only: the two files and the
  `docs/changes/adr-0001-accept/` records that exist. Subject
  `ADR 0001: Record the owner's acceptance`. The body says why and quotes the
  owner's words, date and place, and ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push.

## Conditions for the tester

- **T1.** Work on a detached checkout of the developer's commit, not on the
  change branch. Derive or write `BASE` as in C2, and confirm it equals the SHA in
  `implementation.md`.
- **T2.** Re-run independently, and quote command, exit code and output: R1 to R4
  (last column), and checks 1 to 8. For check 6, the expected list at test time is
  the eight paths less any record not yet written (`test-report.md`,
  `delivery-approval.md`); the full list is re-checked before the push.
- **T3.** Read the ADR diff by eye against 3.1: the owner's words byte for byte,
  straight quotes, the pipe kept, and the O-13 note marked as not the owner's
  words.
- **T4.** Write check 11 as NOT RUN: the branch is not pushed until the owner
  confirms after gate 2. Name the jobs that cover it (the 13 required contexts,
  CodeQL). Write the .NET, website and Studio suites as NOT RUN with the plan's
  reasons and their CI jobs.

## Which checks run when

| When | Checks | Who |
| --- | --- | --- |
| Before editing | 5.0 rebase; R1 to R4 on `BASE` | Developer |
| After the commit, before gate 2 | R1 to R4; checks 1 to 8 | Developer, then the tester independently |
| Just before the push, after the owner confirms | Check 9 (open-PR overlap, against the full check 6 list) and check 10 (`ls-remote` equals `BASE`). If the base moved: repeat 5.0, then checks 1 to 9 on the new head | `/change` at push time |
| In CI, after the push | Check 11: the 13 required contexts each `pass`, re-read from the protection API; `CodeQL`, `CodeQL (csharp)`, `CodeQL (javascript-typescript)` pass; screenshot parity recorded as skipping. Quoted with run ids and the head SHA | Recorded on the PR before the owner merges; Definition of Done box 6 stays open until then |

Verdict: APPROVED
