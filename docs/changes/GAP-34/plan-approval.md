# GAP-34 plan approval (gate 1)

Tech lead, gate 1. Plan: `docs/changes/GAP-34/plan.md` round 2 (untracked,
`git hash-object` `595ff1994b4ca1b0828a87cfe2266aaec6e6b348`). Review:
`plan-review.md`, Round 2 ends `Verdict: APPROVED`
(`git hash-object` `24ef69d0143c2f97fe0f3f50896c3692e13deed8`). Branch
`change/GAP-34` at `2bbd586`, which equals `origin/rebuild/dotnet-platform`
(`git rev-parse`, both `2bbd586267e94e7c713ae5b905d8f4df66d75230`). Documents
not on the base were read from `origin/claude/cool-heisenberg-mh6zx9` (PR #63,
head `d1cb4c916b7acfa90f8b7b15ca98db09c7222e6d`).

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides nothing for the owner (P-7).

## Decision

Approved, with the conditions below. The change is the one the owner asked
for. It is small, it covers one topic, and every sentence it writes traces to the
owner's words or to a rule already in force. The only overlap with an open
branch merges cleanly in either order. No owner question blocks it now. One
question becomes blocking if PR #63 merges first (condition C-9).

## What I verified myself

| Claim in the plan or review | Command I ran | Result |
| --- | --- | --- |
| `AGENTS.md` and `CLAUDE.md` identical; Agents section is lines 21-39, "## Schema" at 41 | `cmp AGENTS.md CLAUDE.md`; `cat -n AGENTS.md` | exit 0; lines as stated |
| Red grep on the base: 15 matches | `git grep -n -i -E "codex\|cursor\|rotation\|integrator\|41xx\|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md` and `\| wc -l` | exit 0; `15`: `change.md:65`, plus 22, 24, 25, 30, 31, 33, 35 in each copy |
| "or merge until" on the base | `git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md` | exit 0, `.claude/commands/change.md:54` |
| `website/README.md` agent names | `git grep -n -i -E "codex\|cursor" -- website/README.md` | exit 0, only `:247` |
| Cited lines in `change.md` (32, 35, 54-55, 63-66) and `docs/changes/README.md` (7-18) | `cat -n` | Each says what the plan's source table claims |
| #63 touches only line 7 of `AGENTS.md` and `CLAUDE.md` | `git diff origin/rebuild/dotnet-platform...origin/claude/cool-heisenberg-mh6zx9 --stat` and `-- AGENTS.md CLAUDE.md` | 11 files; in the two copies, one hunk, line 7 only; no `.claude/`, `docs/changes/README.md` or `website/README.md` |
| Check 3 works and the block is the only `markdown` fence | `awk` extraction from `plan.md`; `grep -c '^```markdown$'` | 34 lines; `1` |
| Check 3 on a simulated head (base 1-20, block, base 40-end) | `diff --strip-trailing-cr <block> <(sed -n '/^## Agents$/,/^## Schema$/p' head \| head -n -2)` | exit 0 |
| Check 3 still extracts if `plan.md` is checked out CRLF (it is LF in the index; `core.autocrlf=true`) | the same `awk` on a CRLF copy | 34 lines |
| Merge with #63 | `git merge-file -p head base pr63` | exit 0, no conflict; line 7 is #63's text; `grep -c squash-merges` gives `2`; the red grep on the merged file exits 1 |
| No other open PR touches the five files | `gh pr view <n> --json files` for #44, #57, #58, #59, #60, #62, #63; merge-base diff of every remote branch | Only #63 (`AGENTS.md`, `CLAUDE.md`). Other remote branches that touch these files belong to merged or closed PRs (#15, #36, #37, #43) |
| Push runs on `2bbd586` | `gh run list --branch rebuild/dotnet-platform`; `gh run view <id> --json jobs` | CI 43213692554: only "Studio — typecheck, build, end-to-end" failed (19 steps). Security 43213692568 "Security gate self-test" and Workflow lint 43213692582 "actionlint" failed with `steps=0` at 11:58:15Z; the other Security jobs were skipped. The previous push runs on `32f0414` are all green |
| #62 fixes the Studio red and is green | `gh pr checks 62` | Every check passes at `6a57b14`, including the Studio end-to-end; screenshot parity skipped |
| Runners work today | `gh pr checks 63` | All pass |

## Reasons

- **Right change.** It removes the rotation, the three named agents, the
  per-agent worktrees and the integrator. It records "the /change agents do
  everything up to the merge, and the owner squash-merges", as the owner asked.
  It keeps every rule that still applies, and check 3 proves them line for line.
  Its edits to `change.md`, `docs/changes/README.md` and `website/README.md:247`
  are needed. Without them, the files every role reads would contradict the new
  `AGENTS.md`. They stay on one topic (B-8).
- **Right point in the order.** GAP-34 is G1, Wave 1, slot 1. The other Wave 1
  items already merged (#40 to #43), so it is not ahead of its wave. ISO-4/ISO-5
  and the G3 Blocker/Major order do not apply. It shares no file with the slot 2
  PRs (#62, #58, #59) or with #44, so it can run in parallel with them.
- **Risk is low.** It changes docs only: no code, test, workflow, route, secret,
  dependency or migration. Rollback is a revert.
- **Honest scope.** The register test ("each role named against an agent and a
  stage in `AGENTS.md`") is met. The line 162 item is marked Partly met. The
  rest goes to GAP-34b and GAP-13/O-9, each with a coverage row.

## The reviewer's Minors

- **Minor A (the second "Why no ADR" reason is an interpretation).** Accepted,
  with condition C-8. The plan is not edited. Later records must not repeat that
  reason as a fact, and the first reason holds only while #63 is unmerged (see
  C-9).
- **Minor B (no rule file makes the gate 2 PR body name the owner as the one
  who merges).** Accepted, with condition C-10. The new `AGENTS.md` bullet is
  the control. Gate 2 will hold the PR body to it.

## My own observations (not blocking, accepted)

1. **Clashing O-numbers.** The plan's O-1 (who watches the push runs) and O-2
   (GAP-34b or fold into #63, plus the ADR) use the same labels as the
   standard's O-1 (`next` advisories) and O-2 (default branch). The plan uses the
   standard's O-3 and O-9 in the same section. The fix is condition C-7.
2. **"Claude Code project thread"** in the block, where the owner said "a Claude
   project thread". The reviewer checked it against PR #56's
   `claude.ai/code/project` link, and `/change` is a Claude Code command, so it
   is accurate. I accept it. Changing it would need another plan round for one
   word.
3. **`AGENTS.md:19` ("never two agents on the same branch")** sits in tension
   with the pipeline: architect, reviewer, tech lead and developer take turns in
   one worktree on `change/<id>`. The tension is older than this change, and the
   change does not touch line 19 ("How we work"). I add it to GAP-34b's list.
   This change neither creates nor widens it.

## Owner questions

None blocks gate 1. Each is non-blocking because the change writes nothing that
the owner's words do not cover:

- **GAP-34 O-1 (who watches the push runs after a merge).** The change writes
  only a fact, that CI, Security and Workflow lint run on push. It writes no
  duty. The removed integrator duty is covered by the owner's request ("the
  owner squash-merges") and quote 2 ("Agents did everything up to the merge").
  The orchestrator asks the question at the stop.
- **GAP-34 O-2 (GAP-34b after #63, or fold into #63).** Either answer leaves this
  change's files the same.
- **The ADR question.** This does not block while #63 is unmerged.
  `ENGINEERING_STANDARDS.md:12` ("A rule changes only through an ADR") is not on
  the base, and the owner directly ordered this rule change. If #63 merges
  first, line 12 is in force on the base, and `docs/changes/README.md:62` ("the
  stricter rule applies") brings it in. The owner's request does not say whether
  an ADR is needed. In that case the answer must be the owner's words, under
  C-9.
- **Standard O-3 (merge method)** is not decided here, as the plan says.

## Execution order against the open PRs

The owner merges, so the order is the owner's choice. My recommendation:

1. **#62 (ADM-07c, gate 2 approved, all checks green) first.** It removes the
   Studio end-to-end red that the base push run shows. If it lands before this
   PR is pushed, bring the base in (B-3) so that the head carries the fix.
2. **GAP-34 and #63 in either order.** They meet only at line 7, 13 lines from
   the Agents hunk, and merge cleanly (verified above). Merging GAP-34 first
   avoids C-9. If #63 goes first, see C-9.
3. **GAP-34b after both**, as the plan says.
4. **#44, #58, #59: no shared files.** Their order relative to GAP-34 does not
   matter.

**The red push runs on `2bbd586`** do not come from this change, and they do
not block it. The Studio red is the ADM-07 race that #62 fixes. The two
zero-step failures never started a job. They matter only for check 9: the
Studio job may fail on the PR head if #62 is not on the base. The plan states
that case in advance.

## Conditions

### Developer

- **C-1.** Run the plan's red step (section 5, four commands) on the base
  before you edit anything. Quote each command, its exit code and its output in
  `implementation.md`. The expected results are 15 matches,
  `change.md:54`, and `website/README.md:247`.
- **C-2.** Copy the section 3 block into `AGENTS.md` lines 21-39 exactly. Make
  `CLAUDE.md` a byte-identical copy, and edit `change.md` lines 54-55 and 65-66,
  `docs/changes/README.md` after line 18, and `website/README.md:247` exactly as
  section 3 gives them. No other edits. In particular, do not touch line 7, lines
  9-11, line 19, any `.claude/agents/*.md` file or `website/README.md:151`.
- **C-3.** Do not edit `plan.md`, `plan-review.md` or this file.
  `docs/changes/GAP-34/plan.md` must stay byte-identical to the approved version
  (`git hash-object` `595ff1994b4ca1b0828a87cfe2266aaec6e6b348`), because check
  3 reads its block. If the plan cannot be followed, stop and return the change
  to the architect.
- **C-4.** Use one commit for the five files, subject
  `GAP-34: Record the /change working model in place of the agent rotation` (or
  another imperative summary with the `GAP-34:` prefix). The body says why and
  quotes the owner's request. End it with the trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (B-4). Stage exact
  paths (B-5). B-6 does not apply: this is not a security fix, and the red
  evidence is the pre-edit grep from C-1.
- **C-5.** After you commit, run checks 1 to 8 and quote each in
  `implementation.md`. Also run `git ls-files --eol AGENTS.md CLAUDE.md`, which
  must show `i/lf` for both, so the copies stay LF in the index.
- **C-6.** Do not push, open a PR or merge.

### Records (developer, tester, gate 2, the orchestrator's report)

- **C-7.** Call the plan's questions "GAP-34 O-1" and "GAP-34 O-2". Call the
  standard's "standard O-3" and "standard O-9".
- **C-8.** Give the ADR reasons as "not on the base while #63 is open" and "the
  owner's direct instruction". Never state as a fact that line 12 governs only
  the standard's table.
- **C-9.** If #63 has merged into `rebuild/dotnet-platform` before this PR is
  opened, the change must do three things. First, bring the base in (B-3).
  Second, re-run checks 1 to 8. Third, before the owner merges, get the owner's
  own words on whether this change needs an ADR under `ENGINEERING_STANDARDS.md:12`.
  Quote those words in the PR body. Without them, gate 2 is `BLOCKED ON OWNER`.
- **C-10.** The gate 2 PR description fills the Deployment note box as follows:
  "The owner squash-merges into rebuild/dotnet-platform; no agent merges
  (`AGENTS.md`, this change)". It does not name an integrator, and it does not
  claim that anyone re-runs the suites after the merge. If the template's
  comment (lines 38-39) is on the base by then, the box stays unticked, with the
  reason: GAP-34b and GAP-34 O-1.

### Tester

- **T-1.** Test on a detached checkout of the developer's commit, in a new
  folder of your own, for example
  `git worktree add --detach ../dh-platform-claude-gap34-test <sha>`. Remove it
  when you are done. Never use or remove an existing worktree.
- **T-2.** Before the push, run these yourself on that checkout, each with the
  command, exit code and output:
  - the red step on `origin/rebuild/dotnet-platform`, read with `git show` or
    `git grep <rev>`;
  - checks 1 to 8 on the head;
  - the `git ls-files --eol` check from C-5;
  - a negative test of check 3: delete one kept rule from a scratch copy of
    `AGENTS.md`, and `diff` must exit 1;
  - a fresh `git fetch` before check 8, recording #63's head SHA.
- **T-3.** Write "NOT RUN" for check 9 (every CI workflow on the PR head) and
  check 10 (local suites), with the reason and the CI jobs that cover them. No
  code, test or workflow changes, and the push waits for the owner. Check 9
  stays open at gate 2.
- **T-4.** Check `git diff --name-only origin/rebuild/dotnet-platform...HEAD`
  against the exact list in check 6. Any extra file fails the report.

### After the owner confirms the push (CI, the orchestrator reports)

- **A-1.** Quote the run ids for CI (api, website, website-browser, studio,
  section-compare; screenshot parity skipped), Security (all jobs), Workflow
  lint (actionlint) and CodeQL on the PR head.
- **A-2.** If the Studio job fails on `e2e/redirects.spec.ts:37` and #62 is not
  on the base, report it as the known ADM-07 race, with the run id and the test
  name. Do not fix it here. Do not re-run it until it passes without saying so.
  "PR checks are green on the final head" stays unticked until the head is
  green, either after #62 is brought in or after a re-run that is reported.
- **A-3.** If a job fails with zero steps, it never started. Re-run it once and
  say so. Report any other failure as found.

## Definition of Done boxes expected to stay open at gate 2

- "PR checks are green on the final head" stays open until the push.
- The Deployment note box stays open under C-10, if the template's comment is on
  the base.
- "Reviewed by someone other than the author" is ticked only as the
  pipeline's independent review and tech-lead records. The owner's merge is the
  owner's own act.

Verdict: APPROVED
