# GAP-34 delivery approval (gate 2)

Tech lead, gate 2. Branch `change/GAP-34`, head `435fc52`
(`435fc52250533a34105db14b16ecd04c388b9df1`, "GAP-34: Implementation record").
Code commit `7e4a7b7`, plan commit `a65fcae`, base `2bbd586`
(`origin/rebuild/dotnet-platform`, re-fetched 19 November 2026: still
`2bbd586267e94e7c713ae5b905d8f4df66d75230`). Records read: `plan.md` round 2,
`plan-review.md` (Round 2 `Verdict: APPROVED`), `plan-approval.md` (gate 1,
`Verdict: APPROVED`, C-1 to C-10, T-1 to T-4, A-1 to A-3), `implementation.md`
(`Status: READY FOR TEST`), `test-report.md` (Round 1, `Verdict: APPROVED`, two
Minors; untracked). The standard and the PR template were read from PR #63
(`origin/claude/cool-heisenberg-mh6zx9`, head `d1cb4c9`), because they are not on
the base.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, it does not confirm the push, and it decides nothing for
the owner (P-7). The owner squash-merges; no agent merges.

## Decision

Approved for the stop before the owner. The diff is exactly the approved plan:
the Agents section of `AGENTS.md` and `CLAUDE.md` is the approved 34-line block
line for line, the copies are byte-identical, and the three other files carry
exactly the approved lines. Nothing outside the plan's scope changed. Every
coverage row has evidence, except the CI row, which can only be filled after the
push and stays open under the conditions below.

## What I verified myself

All from `D:\work\DigitalHub\dh-platform-claude-gap34` in Git Bash, on `435fc52`,
after `git fetch origin` (exit 0).

| Check | Command | Result |
| --- | --- | --- |
| Refs | `git rev-parse HEAD origin/rebuild/dotnet-platform origin/claude/cool-heisenberg-mh6zx9 origin/change/ADM-07c` | `435fc52…`, `2bbd586…`, `d1cb4c9…`, `6a57b14…` |
| Plan unchanged (C-3) | `git hash-object docs/changes/GAP-34/plan.md` | `595ff1994b4ca1b0828a87cfe2266aaec6e6b348`, as gate 1 recorded |
| Check 1, old model gone | the three `git grep` commands in plan section 5 | each exit 1, no output |
| Check 2, new model present | `grep -c "squash-merges" AGENTS.md CLAUDE.md .claude/commands/change.md docs/changes/README.md`; `grep -c "Never merge" .claude/commands/change.md` | `2`, `2`, `1`, `1`; `1` |
| Check 3, exact approved text | the plan's `diff --strip-trailing-cr <(awk …plan.md) <(sed … AGENTS.md \| head -n -2)` | exit 0, no output |
| Check 3 on the index, no CR stripping | `diff <(git show HEAD:docs/changes/GAP-34/plan.md \| awk …) <(git show HEAD:CLAUDE.md \| sed … \| head -n -2)` | exit 0 |
| Check 4, identical copies | `cmp AGENTS.md CLAUDE.md`; `cmp <(git show HEAD:AGENTS.md) <(git show HEAD:CLAUDE.md)` | both exit 0 |
| Check 5, only the Agents section changed | the plan's two `diff` commands (lines 1-20; "## Schema" to end) | both exit 0, no output |
| Check 6, scope | `git diff --name-only origin/rebuild/dotnet-platform...HEAD`; `--numstat` | the five files plus `docs/changes/GAP-34/{implementation,plan-approval,plan-review,plan}.md`; `4 4 change.md`, `2 0 docs/changes/README.md`, `1 1 website/README.md`, `30 15` for each copy (difference 15, as planned) |
| The small-file diffs | `git diff origin/rebuild/dotnet-platform...HEAD -- .claude docs/changes/README.md website/README.md` | Exactly the plan section 3 text: `change.md:54-55` and `:65-66`, two README lines after line 18, `website/README.md:247`. Line 151 untouched |
| Check 8, #63 after a fresh fetch | `git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD`; line 7, `cmp`, `grep -c squash-merges` on `$T` | exit 0, tree `3813d0254bc364c316999d64aa6be235137e5101`, no CONFLICT; line 7 is `docs/phase-b-studio.md, ENGINEERING_STANDARDS.md, docs/PROJECT_PROFILE.md.`; `cmp` exit 0; `2`. Same tree as the tester's |
| Line endings (C-5) | `git ls-files --eol AGENTS.md CLAUDE.md` | `i/lf w/crlf` for both |
| C-9 | `git merge-base --is-ancestor origin/claude/cool-heisenberg-mh6zx9 origin/rebuild/dotnet-platform`; `gh pr view 63 --json state,headRefOid,mergedAt` | exit 1; `OPEN`, `d1cb4c9…`, `mergedAt: null`. **#63 has not merged, so C-9 still does not apply** |
| #62 on the base? | `git merge-base --is-ancestor origin/change/ADM-07c origin/rebuild/dotnet-platform`; `gh pr view 62 …` | exit 1; `OPEN`, `6a57b14…`, not merged. The base still lacks the ADM-07c fix |
| No other open PR touches the five files | `gh pr view <n> --json files` for #44, #57, #58, #59, #60, #62, #63 | Only #63, on `AGENTS.md` and `CLAUDE.md` (line 7, merges cleanly above) |
| Push runs on the base | `gh run list --branch rebuild/dotnet-platform --limit 6` | On `2bbd586`: CI 43213692554, Security 43213692568, Workflow lint 43213692582 all `failure` (gate 1 traced them to the ADM-07 race and two zero-step job starts). On `32f0414` all three green |
| Commits (B-4, B-5) | `git log --format='%H%n%s%n%b' origin/rebuild/dotnet-platform..HEAD`; `git show --stat` | Three commits, each `GAP-34:` with an imperative summary, a why-body and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `7e4a7b7` touches exactly the five files; `435fc52` only `implementation.md`; `a65fcae` only the three plan records |
| Failing first (B-6) | `git log` order; `implementation.md` red step | Not a security fix, so no red-test commit is required (C-4). The red evidence is the pre-edit grep (15 matches, `change.md:54`, `website/README.md:247`), which I reproduced at gate 1 and the tester reproduced with `git grep <rev>` on the base |
| PR template on the base? | `git cat-file -e origin/rebuild/dotnet-platform:.github/pull_request_template.md` | exit 128: not on the base. Read from #63 |

The tester's evidence is real: commands, exit codes and output for the red
step, checks 1 to 8 (including six negative tests of check 3), the eol check
and T-4. Check 8's tree id matches the one I got. Checks 9 and 10 are NOT RUN,
with the reason and the CI jobs that cover them, as T-3 requires.

## The tester's Minors and the older inconsistencies

| Item | Decision | Reason |
| --- | --- | --- |
| Minor 1: the role table's "Step" column uses the `docs/changes/README.md` numbering (tester 5, gates 3 and 6), while `change.md` numbers the tester 6 and gate 2 as 7 | **Accept for now; route to GAP-34b** | The table matches the canonical pipeline table in `docs/changes/README.md:7-14` and the agents' own descriptions, which name these steps "Step N". `change.md` adds a commit step (4), and that is where the two numberings split. They split before this change. Fixing it means editing the approved block, which would take another plan round for a label, or editing `change.md`, which is outside this scope. GAP-34b: label the column "Step (`docs/changes/README.md`)" or align `change.md` |
| Minor 2: `AGENTS.md:19` ("never two agents on the same branch") against the pipeline, where four roles take turns on `change/<id>` | **Accept for now; already on GAP-34b** (gate 1, observation 3) | Older than this change; C-2 forbade touching line 19. It is a rule change, so GAP-34b must bring it to the owner. Until then, the roles run one at a time on the branch, never at the same time, and the tester uses its own detached worktree |
| `docs/changes/README.md:53-56` "A third rejection stops" against `change.md:32-33` and `:42-43` "After the second rejection/failure, stop" | **Route to GAP-34b** | Older than this change, and outside its lines. Until it is fixed, the stricter rule applies (README "Rules every role follows"): the pipeline stops after the second rejection, as `change.md` says |
| `AGENTS.md:14` and `:17`, "Stop after each section … never start the next section without confirmation" | **Route to GAP-34b, coordinated with GAP-13** (which owns the status and "How we work" lines) | The owner's quote 2 ("we Agents did everything up to the merge") settles how `/change` runs in practice: it stops for the owner only at the points `change.md` names. Rewording the line is a rule change and needs the owner's words, so it does not belong in this change |

None of these sends the change back. None was introduced by this change, and
none makes the new text wrong.

## Conditions on the push and on CI (A-1 to A-3, restated for the current base)

- **P-1. Commit the records first.** Before the push, the orchestrator commits
  `test-report.md` and this file as `GAP-34: Test report and approvals`. The
  body says why and ends with the `Co-Authored-By` trailer. Stage exact paths:
  `git add -- docs/changes/GAP-34/test-report.md docs/changes/GAP-34/delivery-approval.md`.
  That commit is the PR head. It may add only those two files: re-run
  `git diff --name-only origin/rebuild/dotnet-platform...HEAD` and quote it.
- **P-2. Push only on the owner's confirmation**, with
  `git push -u origin change/GAP-34`. Never a bare `git push`, never a merge.
- **P-3. Re-check the base just before the push.** Run `git fetch origin`, then
  `git merge-base --is-ancestor` for #63 and for #62's head.
  - **If #63 has merged, C-9 applies.** Bring the base in (B-3), re-run checks
    1 to 8, and get the owner's own words on whether this change needs an ADR
    under `ENGINEERING_STANDARDS.md:12`. Quote them in the PR body. Without
    them the change is BLOCKED ON OWNER, and this approval no longer covers the
    merge. Untick the Deployment note box under C-10, because the template's
    integrator comment would then be on the base.
  - **If #62 has merged** (or anything else has landed on the base), bring the
    base in with a merge (B-3), re-run checks 1 to 8, and quote them in the PR
    body. A new head needs green CI again.
- **P-4. What CI must show on the final PR head (A-1).** Quote the run ids for:
  - CI, with `api`, `website`, `website-browser`, `studio` and
    `section-compare` all green, and `screenshot-parity` skipped (no label);
  - Security, every job green;
  - Workflow lint, `actionlint` green;
  - CodeQL green.

  "PR checks are green on the final head" is ticked only when all of these are
  green on the same head SHA, quoted.
- **P-5. The known Studio race (A-2).** While the base lacks #62, the `studio`
  job may fail on `e2e/redirects.spec.ts:37` "ADM-07 redirects: a live page and
  a loop are refused, a target with no page is flagged". If it does, report it
  with the run id and the test name as the known ADM-07 race, not a regression.
  This change touches no Studio file. Do not fix it here. The box stays unticked
  until one of these happens:
  - (a) the owner merges #62, the base is brought in (P-3), and CI is green on
    the new head; or
  - (b) one re-run of the failed job passes, and the PR body quotes the failed
    run id, the re-run's id and the test name.

  No more than one re-run, and never a silent one. A second failure stays red
  and is reported to the owner, with (a) as the remedy.
- **P-6. Job-start failures (A-3).** A job that fails with zero steps never
  started. Re-run it once and say so, with both run ids. Report any other
  failure as found, on any job, and leave the box unticked. A docs-only change
  should cause none, so another failure goes back to the developer through
  `/change` with the run id, or to the owner if it is outside this change.
- **P-7.** The PR body is the draft below, filled with the run ids and the
  project thread link. It names the owner as the one who squash-merges and
  names no integrator (C-10).

## Definition of Done (template on #63), state at this gate

| Box | State | Why |
| --- | --- | --- |
| Requirement and acceptance criteria stated and met | Tick | The owner's request is met (checks 1 to 4). The register test "Each role named against an agent and a stage in `AGENTS.md`" is met (role table, check 3). The line 162 item is Partly met; the rest is named for GAP-34b and GAP-13/standard O-9 |
| Code follows the engineering standards | Tick (N/A) | No code changed (check 6) |
| No new prohibited constructs | Tick (N/A) | No code changed |
| Every new or changed route has a guard | Tick (N/A) | No route changed |
| Tests for the behaviour changed; coverage; security regression test | Tick | Docs-only. Checks 1 to 8 are the tests, with red-first evidence on the base and six negative tests of check 3. No code lines for the coverage gate to measure, and no security fix |
| **PR checks green on the final head (run IDs quoted)** | **OPEN** | Not pushed. P-4 to P-6 |
| Independent code review run; findings fixed or accepted | Tick | `plan-review.md` (2 rounds) and `test-report.md` Round 1. The two Minors are accepted below |
| Reviewed by someone other than the author, or the approver's review recorded | Tick | Pipeline records only: plan-reviewer, tester (who did not build the change), and gate 1 and gate 2. The owner's merge is the owner's own act, not ticked here |
| Rollback understood | Tick | Revert the PR. Nothing depends on the text |
| Deployment note | Tick, with the C-10 text | The template's integrator comment is not on the base (exit 128). **Becomes OPEN if #63 merges before the PR opens** (P-3) |
| Governance: `AGENTS.md` coverage table or phase document updated | Tick | `AGENTS.md` is the change itself; the coverage table is in `implementation.md` and `test-report.md` |
| Governance: `docs/deferred-items.md` updated for any exception | Tick (N/A) | No exception. The file is not on the base |
| Governance: documentation updated | Tick | The five files |

Also open (owner, non-blocking): GAP-34 O-1 (who watches the push runs on
`rebuild/dotnet-platform` after a merge), GAP-34 O-2 (GAP-34b after #63, or
fold it into #63; and the ADR question), and standard O-3 (merge method), which
is not decided here.

## Draft pull request description

Title: `GAP-34: Record the /change working model in place of the agent rotation`

Base: `rebuild/dotnet-platform`. Head: `change/GAP-34`.

```markdown
_Requested by **Mohamed Elbadry** · [project thread](<link to this project thread>)_

**Status: ready for the owner.** Gate 2 APPROVED (`docs/changes/GAP-34/delivery-approval.md`). CI on the final head: <fill in, see Tests and evidence>. The tech lead's approval is a pipeline role; the owner's confirmation and squash-merge are the owner's own.

## What and why

GAP-34 (G1, Wave 1, Process). `AGENTS.md` and `CLAUDE.md` still described the October setup: three named agents (Codex, Claude Code, Cursor) in per-agent worktrees, a checking rotation, an integrator who merges, and per-agent port ranges. The owner says that model is no longer used: every change runs through `/change`, the agents do everything up to the merge, and the owner squash-merges.

This PR replaces the "## Agents" section of both files with that working model. It maps the standard's four roles (planner, architect, approver, tester) to a `/change` agent and a pipeline step, which is the register's test for GAP-34. It keeps every rule that still applies: no agent checks its own work, the tester uses a detached checkout, findings go back to the role that wrote the work, parallel changes touch different files, ports 42xx, one agent per local database, and no session in DH-WEBSITE-main. It also brings `.claude/commands/change.md`, `docs/changes/README.md` and `website/README.md:247` into line, so no file a role reads says that an agent or an integrator merges.

## Scope and boundaries

In scope (commit `7e4a7b7`):
- `AGENTS.md` and `CLAUDE.md`: lines 21-39 replaced by the approved 34-line section. The copies are byte-identical. Lines 1-20 and everything from "## Schema" on are unchanged.
- `.claude/commands/change.md:54-55` and `:65-66`: "Do not push or open a pull request until the owner confirms … Never merge." and "The owner squash-merges it into `rebuild/dotnet-platform`; never merge it yourself."
- `docs/changes/README.md`: two lines after line 18.
- `website/README.md:247`: the port range is now 42xx only.
- `docs/changes/GAP-34/`: the pipeline records.

Out of scope:
- GAP-34b, after #63: the standard, the project profile, the PR template's integrator comment and the refinement plan on #63; `website/README.md:151`; worktree creation in `change.md`; the ADR question; `AGENTS.md:19` against the pipeline; the step numbering in the role table against `change.md`; README "third rejection" against `change.md` "second"; "Stop after each section" (with GAP-13).
- GAP-13 and standard O-9: the status line (lines 9-11), ADRs, CODEOWNERS, the build log, and the automatic review request.
- Historical briefs and earlier change records: not rewritten. Old worktrees: the owner's housekeeping.

## Security impact

None to routes, policies, data, logins, secrets, dependencies or workflows. Process controls:
- The integrator's post-merge re-run duty is removed, on the owner's request. CI, Security and Workflow lint still run on every push to `rebuild/dotnet-platform`. Who watches them is GAP-34 O-1.
- "No agent merges" is a written rule. `rebuild/dotnet-platform` is unprotected, so GitHub cannot enforce it. That was equally true of the old integrator rule. GAP-03 (branch protection) is the control.

## Tests and evidence

Docs-only. Full output is in `docs/changes/GAP-34/implementation.md`, `test-report.md` and `delivery-approval.md`.
- Red, on base `2bbd586`: `git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md` exit 0, 15 matches. `git grep -n "or merge until" …` exit 0, `change.md:54`. `git grep -n -i -E "codex|cursor" -- website/README.md` exit 0, `:247`.
- On the head: all three greps exit 1. `squash-merges` counts 2/2/1/1, and `Never merge` counts 1. The Agents section `diff`s exit 0 against the approved block in `plan.md`, both on the working copy and on the index. Six negative tests (a deleted, altered or added line) each exit 1. `cmp AGENTS.md CLAUDE.md` exit 0. Lines outside the section are unchanged (two `diff`s, exit 0). Scope is exactly the five files plus `docs/changes/GAP-34/`. `git ls-files --eol` gives `i/lf` for both copies.
- #63 (head `d1cb4c9`): `git merge-tree --write-tree` exit 0, with no conflict. On the merged tree, line 7 is #63's, the copies `cmp` equal, and `squash-merges` counts 2.
- Local suites: NOT RUN. No code, test, workflow, lockfile or config changed. Covered by CI `api`, `website`, `website-browser`, `section-compare` and `studio`.
- CI on the final head `<sha>`: CI `<run id>` (api, website, website-browser, studio, section-compare; screenshot-parity skipped), Security `<run id>`, Workflow lint `<run id>`, CodeQL `<run id>`.
  - If `studio` failed on `e2e/redirects.spec.ts:37` "ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged": the known ADM-07 race. The base lacks #62. Quote the failed run id and the one re-run's id, or say #62 was brought in.
  - If a job failed with zero steps: it never started. Quote both run ids.

## Owner decisions

The owner's request, exactly as given to `/change`: "GAP-34 remove the old Codex/Claude Code/Cursor rotation from AGENTS.md and CLAUDE.md and record the working model: the /change agents do everything up to the merge, and the owner squash-merges"

In a Claude Code session on 18 November 2026:
1. "no no you mixed to instructions look before 12 nov how we was working"
2. "we dont use this any more we Agents did everything up to the merge. Each change ran through /change in a Claude project thread: architect → plan-reviewer → tech-lead gate 1 → developer → tester → tech-lead gate 2. The PRs show “Requested by Mohamed Elbadry · project thread”."
3. "Yes, run ／change"

Not decided here, and open for the owner: GAP-34 O-1 (who watches the push runs after a merge), GAP-34 O-2 (GAP-34b after #63, or fold into #63; and whether an ADR is wanted), and standard O-3 (merge method).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (the register's GAP-34 test is met; the line 162 item is Partly met, with the rest named for GAP-34b and GAP-13)
- [x] Code follows the engineering standards (N/A: no code)
- [x] No new prohibited constructs in touched code (N/A: no code)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (N/A: no route)
- [x] Tests exist for the behaviour changed (docs checks 1 to 8, red first, plus negative tests); no code lines for the coverage gate; no security fix
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (plan-reviewer, tester and tech-lead records; the owner's merge is the owner's own act)
- [x] Rollback is understood (revert this PR)
- [x] Deployment note: the owner squash-merges into rebuild/dotnet-platform; no agent merges (`AGENTS.md`, this change). Nothing deploys until Phase D

## Review findings accepted

- Tester Minor 1: the role table's "Step" column uses the `docs/changes/README.md` numbering, while `change.md` numbers the tester 6 and gate 2 as 7. Accepted. GAP-34b will label the column or align `change.md`.
- Tester Minor 2: `AGENTS.md:19` ("never two agents on the same branch") against roles taking turns on `change/<id>`. Older than this change. Accepted, and on GAP-34b for the owner.
- Plan-review Minor A: the second "Why no ADR" reason is a reading of the standard, not a fact. Accepted. The reasons stated are "not on the base while #63 is open" and "the owner's direct instruction".
- Plan-review Minor B: no rule file makes the PR body name the owner as the one who merges. Accepted. The new `AGENTS.md` bullet is the control, and this body follows it.
- Older, outside this change, on GAP-34b: README "A third rejection stops" against `change.md` "After the second rejection, stop" (the stricter, `change.md`, applies meanwhile), and "Stop after each section" in "How we work" (with GAP-13).

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (`AGENTS.md` itself; coverage tables in the change records)
- [x] `docs/deferred-items.md` updated for any exception (N/A: no exception)
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
