# GAP-34 test report

Tester, step 5. Change branch `change/GAP-34`. Plan round 2
(`git hash-object` `595ff1994b4ca1b0828a87cfe2266aaec6e6b348`, as gate 1
recorded), `plan-review.md` Round 2 and `plan-approval.md` (conditions T-1 to
T-4, A-1 to A-3) read, with `implementation.md` (ends `Status: READY FOR TEST`).
The tester did not build this change.

## Round 1

**Commit tested:** `435fc52` (`GAP-34: Implementation record`). Code commit
`7e4a7b7`, plan commit `a65fcae`, base `2bbd586`
(`origin/rebuild/dotnet-platform`, re-fetched: still
`2bbd586267e94e7c713ae5b905d8f4df66d75230`).

**Checkout (T-1).** Run from the developer's working copy:

```
$ git worktree add --detach D:\work\DigitalHub\dh-platform-claude-gap34-test 435fc52
Preparing worktree (detached HEAD 435fc52)
HEAD is now at 435fc52 GAP-34: Implementation record
exit 0
$ git status --short          (empty)
$ git hash-object docs/changes/GAP-34/plan.md
595ff1994b4ca1b0828a87cfe2266aaec6e6b348
```

All commands below ran from the root of that worktree in Git Bash. Nothing was
edited or committed there. The worktree was removed at the end.

### Red step, on the base (T-2)

Read from the base with `git grep <rev>` (`B=origin/rebuild/dotnet-platform`).

```
$ git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" $B -- AGENTS.md CLAUDE.md .claude docs/changes/README.md
origin/rebuild/dotnet-platform:.claude/commands/change.md:65:`.github/pull_request_template.md`. Merging stays with the integrator named for
origin/rebuild/dotnet-platform:AGENTS.md:22: ... AGENTS.md:24, :25, :30, :31, :33, :35
origin/rebuild/dotnet-platform:CLAUDE.md:22: ... CLAUDE.md:24, :25, :30, :31, :33, :35
exit 0
$ ... | wc -l
15
$ git grep -n "or merge until" $B -- .claude AGENTS.md CLAUDE.md docs/changes/README.md
origin/rebuild/dotnet-platform:.claude/commands/change.md:54:After step 8, stop. Do not push, open a pull request or merge until the owner
exit 0
$ git grep -n -i -E "codex|cursor" $B -- website/README.md
origin/rebuild/dotnet-platform:website/README.md:247:| `SCREENSHOT_PORT`, `SCREENSHOT_CANDIDATE_PORT` | ... Use your own range (Codex 41xx, Claude Code 42xx, Cursor 43xx). |
exit 0
```

Red as the plan states: 15 matches, `change.md:54`, `website/README.md:247`.

### Checks 1 to 8 on the head (T-2)

**Check 1, old model gone.** PASS.

```
$ git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md
exit 1   (no output)
$ git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md
exit 1   (no output)
$ git grep -n -i -E "codex|cursor" -- website/README.md
exit 1   (no output)
```

**Check 2, new model present.** PASS.

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

**Check 3, the section is exactly the approved text.** PASS.

```
$ diff --strip-trailing-cr \
    <(awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' docs/changes/GAP-34/plan.md) \
    <(sed -n '/^## Agents$/,/^## Schema$/p' AGENTS.md | head -n -2)
exit 0   (no output)
$ awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' docs/changes/GAP-34/plan.md | wc -l
34
$ grep -c '^```markdown' docs/changes/GAP-34/plan.md
1
```

Extra, beyond the plan: the same `diff` against `CLAUDE.md` exits 0, and the
same comparison on the index copies (`git show HEAD:docs/changes/GAP-34/plan.md`
against `git show HEAD:AGENTS.md`, plain `diff` with no `--strip-trailing-cr`)
also exits 0. So `--strip-trailing-cr` hides nothing in what is committed.

**Negative tests of check 3 (T-2).** Each mutates a scratch copy of
`AGENTS.md` in the session scratchpad, then runs the check 3 `diff` against it.
Every one exits 1, so check 3 catches a lost or altered rule.

| Mutation | Result |
| --- | --- |
| N1: delete the kept rule "- Parallel changes must change different files." (1 line removed) | `21d20 < - Parallel changes must change different files.`, exit 1 |
| N2: delete "- Only one agent at a time may reset or write a local database." | exit 1 |
| N3: "Agents use ports 42xx" changed to "41xx" | `22c22`, exit 1 |
| N4: an extra line inserted just before "## Schema" | `34a35`, exit 1 |
| N5: a trailing space added to a kept rule | `21c21`, exit 1 |
| N6: delete the continuation line "  feature/interviewer-portal." of the DH-WEBSITE-main rule | `25d24 <   feature/interviewer-portal.`, exit 1 |

**Check 4, identical copies.** PASS.

```
$ cmp AGENTS.md CLAUDE.md
exit 0
$ cmp <(git show HEAD:AGENTS.md) <(git show HEAD:CLAUDE.md)
exit 0
```

**Check 5, only the Agents section changed.** PASS.

```
$ diff <(git show origin/rebuild/dotnet-platform:AGENTS.md | sed -n '1,20p') <(git show HEAD:AGENTS.md | sed -n '1,20p')
exit 0   (no output)
$ diff <(git show origin/rebuild/dotnet-platform:AGENTS.md | sed -n '/^## Schema/,$p') <(git show HEAD:AGENTS.md | sed -n '/^## Schema/,$p')
exit 0   (no output)
```

**Check 6, scope diff, and T-4.** PASS.

```
$ git diff --name-only origin/rebuild/dotnet-platform...HEAD
.claude/commands/change.md
AGENTS.md
CLAUDE.md
docs/changes/GAP-34/implementation.md
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

T-4: the list is exactly the five files in check 6, plus four files under
`docs/changes/GAP-34/`, which is in the allowed set. There are no extra files. The
three small files match the expected numstat exactly. For the two copies,
30 - 15 = 15, as the plan expects. `git show --stat 7e4a7b7` touches exactly
the five files. `435fc52` touches only `docs/changes/GAP-34/implementation.md`.
`7e4a7b7` ends with the `Co-Authored-By` trailer (C-4). No `package*.json`,
`*.csproj` or `.github/` file is in the diff (`git diff --name-only ... --
'*package*.json' '*.csproj' '.github/' | wc -l` gives `0`).

**Check 7, every path the new text names exists.** PASS.

```
$ ls .claude/commands/change.md docs/changes/README.md .claude/agents/architect.md .claude/agents/plan-reviewer.md .claude/agents/tech-lead.md .claude/agents/developer.md .claude/agents/tester.md
(all seven listed)
exit 0
```

**Check 8, no conflict with #63, after a fresh fetch.** PASS.

```
$ git fetch origin claude/cool-heisenberg-mh6zx9
 * branch            claude/cool-heisenberg-mh6zx9 -> FETCH_HEAD
exit 0
$ git rev-parse origin/claude/cool-heisenberg-mh6zx9
d1cb4c916b7acfa90f8b7b15ca98db09c7222e6d
$ gh pr view 63 --repo mohya7/DH-WEBSITE --json state,headRefOid
{"headRefOid":"d1cb4c916b7acfa90f8b7b15ca98db09c7222e6d","state":"OPEN"}
$ git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD
3813d0254bc364c316999d64aa6be235137e5101
exit 0   (no CONFLICT line)
$ T=$(git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD | head -1)
$ git show "$T:AGENTS.md" | sed -n 7p
docs/phase-b-studio.md, ENGINEERING_STANDARDS.md, docs/PROJECT_PROFILE.md.
exit 0
$ cmp <(git show "$T:AGENTS.md") <(git show "$T:CLAUDE.md")
exit 0
$ git show "$T:AGENTS.md" | grep -c "squash-merges"
2
exit 0
$ git merge-base --is-ancestor origin/claude/cool-heisenberg-mh6zx9 origin/rebuild/dotnet-platform
exit 1   (#63 not merged, so C-9 does not apply)
```

#63's head SHA is `d1cb4c916b7acfa90f8b7b15ca98db09c7222e6d`. The tree differs
from the developer's `76440e9…` only because `435fc52` adds
`implementation.md`. #62 is still open at `6a57b14`.

**Line endings (C-5).** PASS.

```
$ git ls-files --eol AGENTS.md CLAUDE.md
i/lf    w/crlf  attr/                 	AGENTS.md
i/lf    w/crlf  attr/                 	CLAUDE.md
exit 0
```

### Check 9 and check 10 (T-3)

- **Check 9, every CI workflow on the PR head: NOT RUN.** The branch is not
  pushed and no PR exists. The push waits for the owner's confirmation (C-6).
  It is covered after the push by CI (`api`, `website`, `website-browser`,
  `studio`, `section-compare`; `screenshot-parity` skipped without its label),
  Security (all jobs), Workflow lint (`actionlint`) and CodeQL, per A-1 to A-3.
  It stays open at gate 2. The Studio job may fail on
  `e2e/redirects.spec.ts:37` while #62 is not on the base. That is the known
  ADM-07 race, which the plan states in advance.
- **Check 10, local suites: NOT RUN.** These are `dotnet test -c Release` in
  `api/`, `npm test`, `npm run typecheck`, `npm run build`,
  `npm run design:check` and `npm run compare:sections` in `website/`, and
  `npm test`, `npm run build` and `npm run test:e2e` in `studio/`. The diff
  touches no code, test, workflow, lockfile or config file (check 6), so these
  suites have nothing new to run. The check 9 jobs cover them: CI `api`,
  `website`, `website-browser`, `section-compare` and `studio`.

### Track checklist, G1 Waves 1 to 3

- One gate per pull request (B-8): one topic, and no gate added. PASS (check 6).
- Seven-day `*_BLOCKING_FROM` and canary fixture (GAP-21): N/A, no gate.
- Actions pinned by SHA, SQL Server image by digest, Node and .NET exact: N/A,
  no workflow touched (check 6, `.github/` count 0).
- Baselines only shrink: no baseline file touched (check 6).

### Security

- **No secret in the diff.** `git diff origin/rebuild/dotnet-platform...HEAD |
  grep -n -i -E "password|secret|token|apikey|api_key|connectionstring|BEGIN
  .*PRIVATE|ghp_|github_pat_|AKIA|sk-[A-Za-z0-9]{20}|Server=|Pwd="` gives 4
  lines (494, 923, 1013, 1633). All four are prose such as "no code, test,
  workflow, route, secret, dependency". None is a credential. This report prints
  no secret.
- **`npm audit --audit-level=high`, full tree.** `website/`: exit 0, "2
  moderate severity vulnerabilities", none high. `studio/`: exit 0, "found 0
  vulnerabilities". The lockfiles are unchanged from the base, so these results
  belong to the base, not to this change.
- **`run-npm-audit.sh` and `run-dotnet-audit.sh`: NOT RUN.** No dependency
  changed, and the scripts need the CI `RUNNER_TEMP` layout. Security
  `npm-audit` and `dotnet-vulnerable` cover them.
- **Semgrep: NOT RUN.** It is installed, but `run-semgrep.sh` scans only code
  roots (`api`, `website/src`, `studio/src`, ... `.github/security`). None of
  the changed files is in those roots, so the scan says nothing about this
  change. Security job `semgrep` covers it.
- **Gitleaks: NOT RUN.** It is not installed (`which gitleaks`: none). Security
  jobs `gitleaks-pr` and `gitleaks-history` cover it.
- **Role matrix, host checks, unknown fields, body size, RFC 7807 error shape:
  N/A.** No route, policy, login or permission changed. The diff has no
  `api/`, `website/src` or `studio/src` file.
- **Process control (noted, not a finding).** "No agent merges" is a written
  rule only. `rebuild/dotnet-platform` is unprotected (plan section 6), and
  GAP-03 is the control. The integrator's post-merge re-run duty is removed by
  the owner's request. The plan states the push workflows as a fact only. I
  verified that `ci.yml`, `security.yml` and `workflow-lint.yml` have `push:
  branches: [rebuild/dotnet-platform]` and that `codeql.yml` has no push
  trigger, which matches the new bullet. Who watches those runs is GAP-34 O-1.

### Beyond the plan

I read the new Agents section as a new agent would, beside
`docs/changes/README.md`, `.claude/commands/change.md` and
`.claude/agents/*.md`.

- **The sources hold.** I checked every row of the plan's section 3 source
  table against the files on the head:
  - `tester.md:7`, `:19-20` and `:28`; `tech-lead.md:3`;
  - README "Never commit to `rebuild/dotnet-platform`", now line 72 (base 70);
  - README "Claude Code uses ports 42xx", now line 79 (base 77);
  - `change.md` steps 2, 3, 6 and 7, and lines 54-55 and 63;
  - the push triggers of the three workflows.

  Each says what the table claims. No sentence adds behaviour without a source.
- **No kept rule is lost.** These old lines survive in pipeline terms: 27-28
  (detached checkout), 29 (parallel files), 30 first half (no self-check), 32
  (findings go back, and the checker does not fix them), 35-36 (42xx; never stop
  another's process), 37 (one agent per database) and 38-39 (DH-WEBSITE-main).
  Check 3 and negative tests N1 to N6 prove them line for line. Only these went,
  as the plan's old-rule table records: the three named agents, the per-agent
  worktrees, the rotation, the integrator, 41xx/43xx, and "used only for
  merging".
- **The `change.md` edits and the README line agree with each other and with
  `AGENTS.md`.** `change.md:54-55` says do not push or open a PR until the owner
  confirms, then "Never merge". `change.md:65-66` says the owner squash-merges
  it into `rebuild/dotnet-platform` and never merge it yourself. `README:19-20`
  says that when the owner confirms, `/change` pushes and opens the PR, and the
  owner squash-merges with no agent merging. All three say the same as the
  `AGENTS.md` bullets "After gate 2 the pipeline stops for the owner ..." and
  "The owner squash-merges ... No agent merges." None of `.claude/agents/*.md`
  says an agent merges.
- **Ambiguities.** Findings 1 and 2 below. Two more, both older than this
  change and outside its scope, are noted at the end.

### Findings

No Blocker. No Major.

**1. Minor. The new role table's "Step" column does not say which step
numbering it uses, and it disagrees with `change.md`, which the section's first
bullet points to.**
- Steps to reproduce: read `AGENTS.md:51-54` (Tester row "5"; Approver row "3
  and 6"). Then read `.claude/commands/change.md:41` ("6. **tester** writes
  `test-report.md`") and `:44` ("7. **tech-lead**, gate 2").
- Expected: one unambiguous step reference. The new text says the step is the
  pipeline step, and `AGENTS.md:22` sends the reader to `change.md` first.
- Actual: the table uses the numbering in `docs/changes/README.md:7-14` and the
  `.claude/agents/*.md` descriptions (tester "Step 5", developer "Step 4"). In
  `change.md`, step 5 is the developer, step 6 is the tester and step 7 is gate
  2. A new agent can read "Tester | 5" as the developer's step. The two
  numberings existed before this change. This change adds a third place that
  uses one of them without naming it.
- Suggested direction, for the architect: label the column "Step
  (`docs/changes/README.md`)", or use role names and gates only. This changes
  the approved block, so it is a plan change, or it goes to GAP-34b. It does not
  block.

**2. Minor (already recorded by gate 1, observation 3, and moved to GAP-34b).
The new section now states outright what `AGENTS.md:19` forbids.**
- Steps to reproduce: read `AGENTS.md:19` ("One agent per worktree, and never
  two agents on the same branch"). Then read `AGENTS.md:22-24` (six agents "one
  agent per role") and `:32` ("Each change has its own branch, change/<id>, in
  its own worktree").
- Expected: the two rules can both be followed.
- Actual: the architect, plan-reviewer, tech-lead and developer all work on
  `change/<id>` in one worktree, which line 19 forbids as written. The tension
  is older than this change, and C-2 forbids touching line 19. The new text
  makes it explicit in the same file. It stays on GAP-34b's list, so this is
  not a new action for this change.

**Observations outside this change's scope (not findings, for GAP-34b):**
- `docs/changes/README.md:53-56` says "A third rejection stops the pipeline".
  `change.md:32-33` and `:42-43` say "After the second rejection/failure,
  stop". This is older than this change, and the change does not touch those
  lines.
- `AGENTS.md:14` and `:17` ("Stop after each section ... Never start the next
  section without confirmation") use the phase-section language. A new agent
  may wonder whether `/change` must stop between steps. The new bullet "The
  agents do everything up to the merge" settles this in practice. The status and
  "How we work" lines belong to GAP-13.

### Coverage rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Codex/Claude Code/Cursor rotation removed from `AGENTS.md` | Owner's request; quotes 1 and 2 | Verified | Red step: 7 `AGENTS.md` matches on `2bbd586`; check 1 grep exit 1 on `435fc52` |
| The same removed from `CLAUDE.md`; the two files identical | Owner's request; README:62 | Verified | Red step: 7 `CLAUDE.md` matches; check 1 exit 1; check 4 both `cmp` exit 0 |
| Working model recorded: `/change` agents do everything up to the merge | Owner's request; quote 2 | Verified | Check 3 exit 0 (on the working copy and on the index) |
| The owner squash-merges; no agent merges (including `change.md:54-55`) | Owner's request | Verified | Check 1 "or merge until" exit 1; check 2 counts 2/2/1/1, "Never merge" 1 |
| Rules that still apply are kept, exactly as approved | `AGENTS.md` 27-39 at `2bbd586`; plan section 3 | Verified | Check 3 exit 0, 34 lines; negative tests N1-N6 all exit 1; check 5 both exit 0 |
| `change.md` and the README no longer contradict `AGENTS.md` on merging | `change.md:54-55`, `65-66` | Verified | Check 1 exit 1; check 6 numstat `4 4` and `2 0`; wording compared under "Beyond the plan" |
| `website/README.md:247` names only the agents' 42xx range | Plan review round 1, finding 9 | Verified | Red step 4 matched `:247`; check 1 third grep exit 1; numstat `1 1` |
| Each of the standard's roles named against an agent and a stage in `AGENTS.md` | GAP-34 register row | Verified (Partly met for line 162 as a whole); see Minor 1 on step numbering | Check 3 (the table is part of the block) |
| No conflict with #63; the copies stay identical after both merge | Orchestrator brief | Verified | Check 8 at #63 head `d1cb4c9`: merge-tree exit 0, no CONFLICT, line 7 is #63's, `cmp` exit 0, count 2 |
| Line endings stay LF in the index | C-5 | Verified | `git ls-files --eol`: `i/lf` for both |
| Changed-file list matches check 6 exactly | T-4 | Verified | Check 6 name list; no file outside the allowed set |
| Moved items (GAP-34b; GAP-13 and standard O-9) | Plan section 4 | Verified not in this diff | Check 5 (lines 1-20 unchanged); check 6 list; `:151` unchanged |
| Every CI workflow green on the PR head | README track checklist; PR template DoD | NOT RUN | Waits for the owner's push (T-3, A-1 to A-3) |

**Cleanup.** `git worktree remove D:\work\DigitalHub\dh-platform-claude-gap34-test`
was run from the developer's working copy after this report was written. The
scratch copies (`neg1.md` to `neg6.md`) are in the session scratchpad, outside
the repository.

Verdict: APPROVED
