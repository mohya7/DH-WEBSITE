# GAP-34 implementation

Developer, step 4. Worktree `D:\work\DigitalHub\dh-platform-claude-gap34`,
branch `change/GAP-34`, cut from `origin/rebuild/dotnet-platform` at `2bbd586`
(re-fetched after the commit: still
`2bbd586267e94e7c713ae5b905d8f4df66d75230`).

## Before starting

- Read `docs/changes/README.md`, `AGENTS.md`, `.claude/commands/change.md`,
  and everything in `docs/changes/GAP-34/`: `plan.md` round 2,
  `plan-review.md` (Round 2 ends `Verdict: APPROVED`) and `plan-approval.md`
  (ends `Verdict: APPROVED`, conditions C-1 to C-10, T-1 to T-4, A-1 to A-3).
- `ENGINEERING_STANDARDS.md` is not on the base (it arrives with open PR #63).
  I read it with
  `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md`, at
  #63's head `d1cb4c916b7acfa90f8b7b15ca98db09c7222e6d`.
- `plan.md` is the approved version: `git hash-object
  docs/changes/GAP-34/plan.md` gives `595ff1994b4ca1b0828a87cfe2266aaec6e6b348`,
  as `plan-approval.md` records (C-3). I did not edit `plan.md`,
  `plan-review.md` or `plan-approval.md`.
- #63 has not merged into the base: `git merge-base --is-ancestor
  origin/claude/cool-heisenberg-mh6zx9 origin/rebuild/dotnet-platform` exits 1.
  So C-9 does not apply now.

## Commits

| SHA | Subject | Content |
| --- | --- | --- |
| `7e4a7b7` | `GAP-34: Record the /change working model in place of the agent rotation` | The five files in Scope, one commit (C-4). Body quotes the owner's request and says why; ends with the `Co-Authored-By` trailer. Paths staged exactly: `git add -- AGENTS.md CLAUDE.md .claude/commands/change.md docs/changes/README.md website/README.md` |
| (next) | `GAP-34: Implementation record` | This file only |

No separate red-test commit: this is a docs-only change and not a security fix,
so B-6 does not apply (C-4). The red evidence is the pre-edit grep below (C-1).

## What changed, by Scope row

| Plan Scope row | File | Change |
| --- | --- | --- |
| `AGENTS.md` | `AGENTS.md` | Lines 21 to 39 ("## Agents") replaced by the 34-line block from plan section 3. Lines 1 to 20 and from blank line 40 / "## Schema" onward are unchanged. I built the file from the index copy (`git show HEAD:AGENTS.md`) as lines 1-20, the block extracted with the plan's own `awk` command, then lines 40 to the end, and wrote it back with CRLF to match the working copy. Git stores it LF |
| `CLAUDE.md` | `CLAUDE.md` | A byte copy of the new `AGENTS.md` (`cp`, then `cmp` exit 0) |
| `.claude/commands/change.md` | `.claude/commands/change.md` | Lines 54-55 now read "After step 8, stop. Do not push or open a pull request until the owner / confirms, as `AGENTS.md` requires. Never merge. Report:". Lines 65-66 now read "`.github/pull_request_template.md`. The owner squash-merges it into / `rebuild/dotnet-platform`; never merge it yourself (`AGENTS.md`)." Two lines for two in each place |
| `docs/changes/README.md` | `docs/changes/README.md` | Two lines added after line 18, in the same paragraph: "When the owner confirms, `/change` pushes the branch and opens the pull / request; the owner squash-merges it, and no agent merges." |
| `website/README.md` | `website/README.md` | Line 247 now ends "Use the agents' range, 42xx (`AGENTS.md`). \|" |
| `docs/changes/GAP-34/*.md` | `implementation.md` | This record |

Not touched, as C-2 requires: `AGENTS.md`/`CLAUDE.md` line 7, lines 9-11 and
line 19; every `.claude/agents/*.md` file; `website/README.md:151`. Checks 5 and
6 prove it.

## Red step (C-1), on the base, before any edit

Run from the worktree root in Git Bash, with `git status --short` empty.

```
$ git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md
.claude/commands/change.md:65:`.github/pull_request_template.md`. Merging stays with the integrator named for
AGENTS.md:22:- Three agents: Codex, Claude Code, and Cursor's agent. Any of them builds, checks,
AGENTS.md:24:- Each works in its own worktree beside dh-platform: dh-platform-codex,
AGENTS.md:25:  dh-platform-claude, dh-platform-cursor. dh-platform stays on
AGENTS.md:30:- No agent checks its own work. Rotation: Claude Code checks Codex, Cursor checks
AGENTS.md:31:  Claude Code, Codex checks Cursor.
AGENTS.md:33:- One integrator per section, named in the prompt, merges checked branches into
AGENTS.md:35:- Ports: Codex 41xx, Claude Code 42xx, Cursor 43xx. Never stop a process you did not
CLAUDE.md:22:- Three agents: Codex, Claude Code, and Cursor's agent. Any of them builds, checks,
CLAUDE.md:24:- Each works in its own worktree beside dh-platform: dh-platform-codex,
CLAUDE.md:25:  dh-platform-claude, dh-platform-cursor. dh-platform stays on
CLAUDE.md:30:- No agent checks its own work. Rotation: Claude Code checks Codex, Cursor checks
CLAUDE.md:31:  Claude Code, Codex checks Cursor.
CLAUDE.md:33:- One integrator per section, named in the prompt, merges checked branches into
CLAUDE.md:35:- Ports: Codex 41xx, Claude Code 42xx, Cursor 43xx. Never stop a process you did not
exit 0

$ git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md | wc -l
15
exit 0

$ git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md
.claude/commands/change.md:54:After step 8, stop. Do not push, open a pull request or merge until the owner
exit 0

$ git grep -n -i -E "codex|cursor" -- website/README.md
website/README.md:247:| `SCREENSHOT_PORT`, `SCREENSHOT_CANDIDATE_PORT` | Any two different ports from 1024 to 65535. Use your own range (Codex 41xx, Claude Code 42xx, Cursor 43xx). |
exit 0
```

All four match the plan's expected results: 15 matches, `change.md:54`, and
`website/README.md:247`.

## Checks on the head (C-5), after commit `7e4a7b7`

All run from the worktree root in Git Bash. No check failed.

**Check 1, old model gone.** All three exit 1 with no output.

```
$ git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md
exit 1
$ git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md
exit 1
$ git grep -n -i -E "codex|cursor" -- website/README.md
exit 1
```

**Check 2, new model present.**

```
$ grep -c "squash-merges" AGENTS.md CLAUDE.md .claude/commands/change.md docs/changes/README.md
AGENTS.md:2
CLAUDE.md:2
.claude/commands/change.md:1
docs/changes/README.md:1
exit 0
$ grep -c "Never merge" .claude/commands/change.md
1
exit 0
```

**Check 3, the section is exactly the approved text.** Exit 0, no output.

```
$ diff --strip-trailing-cr \
    <(awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' docs/changes/GAP-34/plan.md) \
    <(sed -n '/^## Agents$/,/^## Schema$/p' AGENTS.md | head -n -2)
exit 0
$ awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' docs/changes/GAP-34/plan.md | wc -l
34
```

**Check 4, identical copies.** Both exit 0.

```
$ cmp AGENTS.md CLAUDE.md
exit 0
$ cmp <(git show HEAD:AGENTS.md) <(git show HEAD:CLAUDE.md)
exit 0
```

**Check 5, only the Agents section changed.** Both exit 0 with no output.

```
$ diff <(git show origin/rebuild/dotnet-platform:AGENTS.md | sed -n '1,20p') <(git show HEAD:AGENTS.md | sed -n '1,20p')
exit 0
$ diff <(git show origin/rebuild/dotnet-platform:AGENTS.md | sed -n '/^## Schema/,$p') <(git show HEAD:AGENTS.md | sed -n '/^## Schema/,$p')
exit 0
```

**Check 6, scope diff.**

```
$ git diff --name-only origin/rebuild/dotnet-platform...HEAD
.claude/commands/change.md
AGENTS.md
CLAUDE.md
docs/changes/GAP-34/plan-approval.md
docs/changes/GAP-34/plan-review.md
docs/changes/GAP-34/plan.md
docs/changes/README.md
website/README.md
exit 0
$ git diff --numstat origin/rebuild/dotnet-platform...HEAD -- .claude docs/changes/README.md website/README.md
4	4	.claude/commands/change.md
2	0	docs/changes/README.md
1	1	website/README.md
exit 0
$ git diff --numstat origin/rebuild/dotnet-platform...HEAD -- AGENTS.md CLAUDE.md
30	15	AGENTS.md
30	15	CLAUDE.md
exit 0
```

The file list is exactly the plan's list (this file joins
`docs/changes/GAP-34/` with the next commit). The three small files match the
expected numstat exactly. For `AGENTS.md` and `CLAUDE.md`, added minus deleted
is 30 - 15 = 15, as expected (git paired four unchanged lines).

**Check 7, every path the new text names exists.**

```
$ ls .claude/commands/change.md docs/changes/README.md .claude/agents/architect.md .claude/agents/plan-reviewer.md .claude/agents/tech-lead.md .claude/agents/developer.md .claude/agents/tester.md
.claude/agents/architect.md
.claude/agents/developer.md
.claude/agents/plan-reviewer.md
.claude/agents/tech-lead.md
.claude/agents/tester.md
.claude/commands/change.md
docs/changes/README.md
exit 0
```

**Check 8, no conflict with #63.** #63's head is
`d1cb4c916b7acfa90f8b7b15ca98db09c7222e6d` after the fetch.

```
$ git fetch origin claude/cool-heisenberg-mh6zx9
 * branch            claude/cool-heisenberg-mh6zx9 -> FETCH_HEAD
exit 0
$ git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD
76440e9be989d4d71d2ae68177a7ed02f9b791c1
exit 0                      (no CONFLICT line)
$ T=$(git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD | head -1)
$ git show "$T:AGENTS.md" | sed -n 7p
docs/phase-b-studio.md, ENGINEERING_STANDARDS.md, docs/PROJECT_PROFILE.md.
exit 0
$ cmp <(git show "$T:AGENTS.md") <(git show "$T:CLAUDE.md")
exit 0
$ git show "$T:AGENTS.md" | grep -c "squash-merges"
2
exit 0
```

**Line endings (C-5).**

```
$ git ls-files --eol AGENTS.md CLAUDE.md
i/lf    w/crlf  attr/                 	AGENTS.md
i/lf    w/crlf  attr/                 	CLAUDE.md
exit 0
```

Both are `i/lf` in the index, as before the change.

**Check 9, every CI workflow on the PR head.** NOT RUN. The branch is not
pushed and no PR is open (C-6); the push waits for the owner. Covered by CI
(`api`, `website`, `website-browser`, `studio`, `section-compare`;
`screenshot-parity` skipped without its label), Security (all jobs), Workflow
lint (`actionlint`) and CodeQL on the PR head, after the owner confirms the
push (A-1 to A-3). As the plan says in advance, the Studio job may fail on
`e2e/redirects.spec.ts:37` "ADM-07 redirects: ..." if #62 is not on the base;
that is the known ADM-07 race, not this change.

**Check 10, local suites** (`dotnet test -c Release`, website and Studio
`npm test`, builds, end-to-end). NOT RUN: no code, test or workflow file
changes (check 6). The check 9 CI jobs cover them.

**Track checklist, G1 Waves 1 to 3.** One topic, no gate added (B-8). No
`*_BLOCKING_FROM` date or canary fixture: N/A, no gate. No workflow, action pin,
image or baseline file touched (check 6).

## Migrations

None. The change is docs only.

## Records conditions

- **C-7.** In this record and later ones, the plan's questions are "GAP-34 O-1"
  (who watches the push runs after a merge, and who re-runs or reports a red
  one) and "GAP-34 O-2" (GAP-34b after #63, or fold into #63; and the ADR
  question). The standard's are "standard O-3" (merge method) and "standard
  O-9" (automatic owner review request). This change decides none of them.
- **C-8.** This change has no ADR for two reasons: `ENGINEERING_STANDARDS.md`,
  with its line 12, is not on the base while #63 is open; and the change is the
  owner's direct instruction (P-7, the request quoted above). This record makes
  no claim about which rules line 12 governs. If #63 merges first, C-9 applies.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Codex/Claude Code/Cursor rotation removed from `AGENTS.md` | Owner's request; quotes 1 and 2 | Done | Red step: 7 `AGENTS.md` matches on the base; check 1 first grep exits 1 on `7e4a7b7` |
| The same removed from `CLAUDE.md`; the two files identical | Owner's request; README:60 | Done | Red step: 7 `CLAUDE.md` matches; check 1 exits 1; check 4 both `cmp` exit 0 |
| Working model recorded: `/change` agents do everything up to the merge | Owner's request; quote 2 | Done | Check 3 exit 0 (the block's first two bullets are in `AGENTS.md` exactly) |
| The owner squash-merges; no agent merges (including `change.md:54-55`) | Owner's request | Done | Check 1 "or merge until" exits 1; check 2 `squash-merges` counts 2/2/1/1 and "Never merge" 1 |
| Rules that still apply are kept, exactly as approved | `AGENTS.md` lines 27 to 39 at `2bbd586`; plan section 3 | Done | Check 3 exit 0, 34 lines line for line; check 5 both diffs exit 0 |
| `change.md` and the README no longer contradict `AGENTS.md` on merging | `change.md:54-55`, `65-66` | Done | Check 1 exits 1 (no "integrator", no "or merge until"); check 6 numstat `4 4` and `2 0` |
| `website/README.md:247` names only the agents' 42xx range | Plan review round 1, finding 9 | Done | Red step 4 matched `:247`; check 1 third grep exits 1; check 6 numstat `1 1` |
| Each of the standard's roles named against an agent and a stage in `AGENTS.md` | GAP-34 register row | Done (Partly met for the line 162 item as a whole) | Check 3 exit 0 (the role table is part of the block) |
| No conflict with #63; the copies stay identical after both merge | Orchestrator brief | Done | Check 8: `merge-tree` exit 0, no CONFLICT; line 7 is #63's text; `cmp` exit 0; `squash-merges` 2 |
| Line endings stay LF in the index | C-5 | Done | `git ls-files --eol`: `i/lf` for both |
| The #63 documents, `website/README.md:151`, worktree creation in `change.md`, the ADR question, the `AGENTS.md:19` tension | Refinement plan line 162; plan section 2; gate 1 observation 3 | Moved to GAP-34b | Not in this change: check 6 file list; `:151` unchanged (check 6 numstat `1 1`) |
| ADRs, CODEOWNERS, build log, current status line, automatic owner review request | Refinement plan line 162; GAP-13 | Moved to GAP-13 and standard O-9 | Lines 9-11 unchanged (check 5) |
| Every CI workflow green on the pull request head | README track checklist; PR template DoD | NOT RUN | Waits for the owner's push confirmation (C-6, check 9) |

## Notes for the tester

- The worktree's files are CRLF in the working copy and LF in the index
  (`core.autocrlf=true`). Check 3 needs `--strip-trailing-cr` on a working copy;
  on a fresh detached checkout the same holds.
- `git diff --name-only` on the head will also list this file
  (`docs/changes/GAP-34/implementation.md`), which is inside the expected
  `docs/changes/GAP-34/` set (T-4).
- Nothing pushed, no PR, no merge (C-6).

Status: READY FOR TEST
