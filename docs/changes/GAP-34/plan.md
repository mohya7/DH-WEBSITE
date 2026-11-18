# GAP-34: Record the /change working model in place of the three-agent rotation

Architect's plan, **round 2**. Branch `change/GAP-34`, cut from
`origin/rebuild/dotnet-platform` at `2bbd586`. `plan-review.md` Round 1
returned round 1 of this plan with 4 Majors and 9 Minors. Section 12 answers
every finding.

**Some source files are not on the base yet.** `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/quality/admin-audit-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`,
`docs/deferred-items.md` and `.github/pull_request_template.md` arrive with
open PR #63 (`origin/claude/cool-heisenberg-mh6zx9`, head `d1cb4c9`). I read
them with `git show origin/claude/cool-heisenberg-mh6zx9:<path>`. Every quote
from them below comes from that branch, not from the base. The ADR and the
admin audit do not apply to this change (it is not G2 or G3).

## 1. Item

- **Closes:** part of GAP-34. The rest goes to GAP-34b and GAP-13; see
  section 4 and "Partly met" below.
- **Track:** G1, Wave 1 ("make CI honest", 3 to 16 November). The register
  classes it as "Process".
- **Register row** (refinement plan line 79, on #63):
  > | GAP-34 | Process | Rollout step 2 (standard, section 15) | The standard's roles (planner, architect, approver, testers) are not mapped onto the `AGENTS.md` builder and checker rotation | Each role named against an agent and a stage in `AGENTS.md` | Low | Low | Wave 1 |
- **Done when** (Wave 1 table, line 162, shared with GAP-13):
  > Records: `docs/adr/` with the first five ADRs, CODEOWNERS, a build log, a current status in `AGENTS.md` and `CLAUDE.md`, and the standard's roles mapped onto the `AGENTS.md` rotation | GAP-13, GAP-34 | Agent | The files exist and a new pull request requests the owner's review automatically (O-9)
- **Owner's request** (P-7), exactly as given to `/change`:
  > "GAP-34 remove the old Codex/Claude Code/Cursor rotation from AGENTS.md and CLAUDE.md and record the working model: the /change agents do everything up to the merge, and the owner squash-merges"
- **Owner's words**, quoted exactly as the orchestrator passed them on. They
  were given in a Claude Code session on 18 November 2026:
  1. "no no you mixed to instructions look before 12 nov how we was working"
  2. "we dont use this any more we Agents did everything up to the merge. Each change ran through /change in a Claude project thread: architect → plan-reviewer → tech-lead gate 1 → developer → tester → tech-lead gate 2. The PRs show “Requested by Mohamed Elbadry · project thread”." This replied to the orchestrator's statement: "The “Codex / Claude Code / Cursor rotation” in AGENTS.md is the older October setup. It wasn't used after the pipeline arrived."
  3. "Yes, run ／change"

**How GAP-34's target is met.** The owner has changed the target. The register
says to map the roles "onto the `AGENTS.md` builder and checker rotation", but
the owner says that rotation is no longer used (quote 2). This change therefore
maps each of the standard's four roles to a `/change` agent and a pipeline step,
in `AGENTS.md`. That meets the register's own test, "Each role named against an
agent and a stage in `AGENTS.md`". The line 162 item as a whole is only
**Partly met**:

- `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`, the PR template and
  the refinement plan still describe the rotation and an integrator. Those files
  exist only on #63, so this branch cannot edit them without an add/add
  conflict. They go to GAP-34b (section 4).
- These parts belong to GAP-13 and O-9:
  - the ADRs;
  - CODEOWNERS;
  - the build log;
  - the current status;
  - "a new pull request requests the owner's review automatically (O-9)".

A note on the register: it cites "standard, section 15". The project's
`ENGINEERING_STANDARDS.md` (on #63) has only sections 1 to 10. The matching
item is section 10, Rollout, step 2 (line 177): "Map the standard's roles onto
the `AGENTS.md` rotation". Section 15 is probably a section of the external
AI-Assisted Delivery Standard, which is not in the repository. I could not check
how that standard defines its roles. The mapping in section 3 uses only the role
names in the register row.

## 2. Current state

**`AGENTS.md` and `CLAUDE.md` are identical** (`cmp AGENTS.md CLAUDE.md`, exit
0). Both are stored LF in the index and checked out CRLF: `git ls-files --eol
AGENTS.md` gives `i/lf w/crlf`, and `core.autocrlf=true`. The "## Agents"
section is lines 21 to 39 of both. Line 40 is blank and "## Schema" is at line
41:

```
22 - Three agents: Codex, Claude Code, and Cursor's agent. Any of them builds, checks,
24 - Each works in its own worktree beside dh-platform: dh-platform-codex,
25   dh-platform-claude, dh-platform-cursor. dh-platform stays on
26   rebuild/dotnet-platform and is used only for merging.
27 - A builder owns its branch. A checker works on a detached checkout of the commit it
29 - Parallel work must change different files.
30 - No agent checks its own work. Rotation: Claude Code checks Codex, Cursor checks
31   Claude Code, Codex checks Cursor.
32 - Findings go back to the builder. The checker does not fix them.
33 - One integrator per section, named in the prompt, merges checked branches into
34   rebuild/dotnet-platform one at a time, re-running the suites after each.
35 - Ports: Codex 41xx, Claude Code 42xx, Cursor 43xx. Never stop a process you did not
37 - Only one agent at a time may reset or write a local database.
38 - No agent ever opens a session in DH-WEBSITE-main. It is read-only, on
```

History (`git log -- AGENTS.md CLAUDE.md .claude docs/changes/README.md`):
- `2976cfa`, 2026-10-04: "docs: three agents in separate worktrees, with
  checking rotation".
- `cc99e20`, 2026-11-11: "Add five-role change pipeline agents and /change
  command (#37)". The rotation text was not changed when the pipeline arrived.

**I re-ran the red check on the base in round 2.** It exits 0 with 15
matches: `.claude/commands/change.md:65`, plus lines 22, 24, 25, 30, 31, 33 and
35 in each of `AGENTS.md` and `CLAUDE.md`:

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
CLAUDE.md:22: ... CLAUDE.md:35:   (the same seven lines)
exit 0
$ git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md | wc -l
15
```

**Other places the old model is written:**

- `.claude/commands/change.md:54-55`: "After step 8, stop. Do not push, open a
  pull request or merge until the owner confirms, as `AGENTS.md` requires."
  - "or merge until the owner confirms" implies that an agent may merge once
    the owner confirms.
  - The grep above does not catch it.
- `.claude/commands/change.md:65-66`: "Merging stays with the integrator named
  for the section."
- `website/README.md:247`: "Use your own range (Codex 41xx, Claude Code 42xx,
  Cursor 43xx)." This file is on the base, so it can be changed here.
- `website/README.md:151`: "use 4197 for the Section 5 task's 41xx rule". This
  recommends a specific port value for a past task (Phase C Section 5).
- Historical briefs:
  - `docs/phase-a-foundation.md:3` and `docs/phase-b-studio.md:3`: "Build brief
    for Cursor".
  - `docs/phase-c-website.md:360`: a `reports/codex.md` path.

None of the five `.claude/agents/*.md` files names Codex, Cursor, a rotation or
an integrator. These lines already agree with the model recorded below:
- `tester.md:19-20`: "Test on a detached checkout of that commit, so the
  developer can keep working: `git worktree add --detach
  ../dh-platform-claude-test <sha>`".
- `tester.md:28`: "Use ports 42xx".
- `docs/changes/README.md:77`: "Claude Code uses ports 42xx".

**Where findings go today**, in `.claude/commands/change.md`:
- Steps 2 and 3 (lines 32 and 35): when the plan-reviewer or gate 1 says
  CHANGES NEEDED, the change goes "back to step 1", the architect.
- Steps 6 and 7: when the tester or gate 2 says CHANGES NEEDED, the change goes
  "back to step 5", the developer.
- Step 5: the developer's "BACK TO ARCHITECT" returns the change to step 1.

`docs/changes/README.md:51-56` says the same.

**Text on #63 that still describes the rotation and the integrator**:

- `ENGINEERING_STANDARDS.md:9-11`: "the builder and checker rotation".
- `ENGINEERING_STANDARDS.md:12`: "A rule changes only through an ADR in
  `docs/adr/`." See "Why no ADR" in section 3.
- `ENGINEERING_STANDARDS.md`, P-1: "Integrator (`AGENTS.md`)".
- `ENGINEERING_STANDARDS.md`, section 8: "box 10 records who merges".
- `ENGINEERING_STANDARDS.md`, O-3: "since the integrator re-runs the suites".
- `ENGINEERING_STANDARDS.md`, section 10 step 2.
- `docs/PROJECT_PROFILE.md:14`: "merged by the integrator".
- `.github/pull_request_template.md:38-39`: "name the integrator who merges into
  rebuild/dotnet-platform and confirm the suites are re-run after the merge".
- Refinement plan lines 21, 134, 162 and 269. Line 269 reads "three agents
  rotate as builder and checker".

**What actually happened.** `gh pr list --state merged` and `gh pr view <n>
--json author,mergedBy,mergedAt,reviews,headRefName` show two periods:

- PRs #13 to #35, merged 11 to 20 October, were authored and merged by
  `mohya7`.
- Every merged PR since then, #37 to #56, was authored and merged by
  `Mohamed-Elbadry-DH`, with no review recorded from anyone:
  - #38 (`change/ci-runner-pin`) and #39 (`change/GAP-01`), merged 4 November;
  - #45 (`change/semgrep-error-detail`), merged 8 November;
  - #46 (`change/aborted-request-log-race`) and #48
    (`change/rate-limit-log-race`), merged 9 November;
  - #47, merged 9 November;
  - #37 (the pipeline itself), opened 1 November, merged 10 November 23:05Z;
  - #40, #41, #42 and #43, merged 10 November;
  - #49 to #55, merged 11 November; #56, merged 12 November.

So `/change` branches were being merged from 4 November, before #37 itself
merged.

Every base commit has one parent and a `(#NN)` subject. They are squash merges:

```
2bbd586 32f0414 | ADM-10: ... (#56)
32f0414 6262f48 | ADM-07: ... (#55)
6262f48 b9c5f6f | ADM-02: ... (#54)
b9c5f6f 6e58af2 | ADM-03: ... (#52)
```

The body of PR #56 starts `_Requested by **Mohamed Elbadry** · [project
thread](...)_`. Its Definition of Done still names an integrator:
- line 99: "Deployment note: integrator Claude Code (this thread) merges into
  rebuild/dotnet-platform and re-runs the suites after the merge";
- line 119: "Integrator: Claude Code (this thread)".

So the pipeline was still copying the old integrator wording into PR bodies,
even though GitHub records the owner's account as the merger.

**Local worktrees** (`git worktree list`):
- `dh-platform-codex`, at `17df8bf`, dated 2026-10-16, detached.
- `dh-platform-cursor`, on `phase-e/design-refresh`, dated 2026-10-20.
- `dh-platform-cursor-screenshot`, at `f084f33`, dated 2026-10-13.
- `dh-platform-claude`, on `phase-e/studio-partner-editor`, dated 2026-10-20.

All four still exist, and none has a commit after 20 October. Change worktrees
are named `dh-platform-claude-<id>`, for example `dh-platform-claude-gap34` and
`dh-platform-claude-adm07c`. `change.md` setup step 3 creates the branch
(`git switch -c change/<id> --no-track ...`) in the folder the orchestrator is
in; it does not create a worktree.

**After a merge.**
- `ci.yml`, `security.yml` and `workflow-lint.yml` run on `push: branches:
  [rebuild/dotnet-platform]`.
- `codeql.yml` does not; it runs on `pull_request`, `schedule` and
  `workflow_dispatch` only.
- `gh api repos/mohya7/DH-WEBSITE/branches/rebuild%2Fdotnet-platform` returns
  `{"protected":false}`.

The push runs for the current base head `2bbd586` (12 November) are red, for two
different reasons. Neither is caused by the code in `2bbd586`.

**CI, run 43213692554: one flaky Studio end-to-end test, which has an approved
fix.**
- The Studio job is the only failure. API, Website, browser tests and section
  comparison pass.
- The failing test is `✘ 8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a
  live page and a loop are refused, a target with no page is flagged (1.5m)`.
  The run ends `1 failed`, `31 passed`.
- PR #62 fixes that test. It is `change/ADM-07c`, "ADM-07c: Wait for the Add
  redirect dialog to settle between creates", opened 12 November 16:15Z and
  still open.
  - Its body names the test: "The ADM-07 end-to-end test "ADM-07 redirects: a
    live page and a loop are refused, a target with no page is flagged"
    (`studio/e2e/redirects.spec.ts`) has failed".
  - Its `docs/changes/ADM-07c/delivery-approval.md` ends `Verdict: APPROVED`.
  - `gh pr checks 62` at head `6a57b14` shows every check passing, including
    "Studio — typecheck, build, end-to-end". Only "Screenshot parity (optional,
    label "screenshots")" is skipped.

**Security, run 43213692568, and Workflow lint, run 43213692582: jobs that
failed to start.**
- `gh run view <id> --json jobs` gives "Security gate self-test | failure |
  steps=0" and "actionlint (every workflow) | failure | steps=0", both between
  11:58:15Z and 11:58:17Z.
- The other Security jobs are skipped, also with steps=0.
- No suite ran, so these runs say nothing about the code. They need a re-run.
- `gh pr checks 63` and `gh pr checks 62` are green today, so the runners work.

**Overlap with #63.**
- `git diff origin/rebuild/dotnet-platform...origin/claude/cool-heisenberg-mh6zx9 -- AGENTS.md CLAUDE.md`
  changes only line 7, in both files:
  `docs/phase-b-studio.md, ENGINEERING_STANDARDS.md, docs/PROJECT_PROFILE.md.`
- #63 does not touch `.claude/`, `docs/changes/README.md` or
  `website/README.md`.
- `git merge-tree --write-tree origin/rebuild/dotnet-platform origin/claude/cool-heisenberg-mh6zx9`
  exits 0 (git 2.55.0).

## 3. Design

**Approach.** Rewrite only the "## Agents" section of `AGENTS.md`: lines 21 to
39, up to the blank line before "## Schema". Copy the result to `CLAUDE.md`
byte for byte. Then change these, so that every file a `/change` role reads
says the same thing:
- the two sentences in `.claude/commands/change.md` that say who merges;
- one paragraph in `docs/changes/README.md`;
- the one table row in `website/README.md` that names the agents' port ranges.

**The new section.** The developer uses this text exactly. It is 34 lines and
replaces lines 21 to 39 of both files; blank line 40 and "## Schema" stay.
This must remain the only `markdown`-tagged fenced block in this plan, because
check 3 extracts it from here.

```markdown
## Agents
- Every change runs through `/change` (`.claude/commands/change.md`) in a Claude
  Code project thread, one agent per role: architect, plan-reviewer, tech-lead
  gate 1, developer, tester, tech-lead gate 2. `docs/changes/README.md` describes
  the roles, their records and their verdicts.
- The agents do everything up to the merge. After gate 2 the pipeline stops for
  the owner, and pushes the change branch and opens the pull request only when
  the owner confirms.
- The owner squash-merges the pull request into rebuild/dotnet-platform. No agent
  merges. CI, Security and Workflow lint run again on rebuild/dotnet-platform
  after each merge.
- Each change has its own branch, change/<id>, in its own worktree beside
  dh-platform. dh-platform stays on rebuild/dotnet-platform; nothing is committed
  there.
- No agent checks its own work: the tester never built the change it tests. The
  tester works on a detached checkout of the developer's commit, so the developer
  can keep working.
- Findings go back to the role that wrote the work: plan findings to the
  architect, delivery findings to the developer. The reviewers, the tech lead and
  the tester do not fix them.
- Parallel changes must change different files.
- Agents use ports 42xx. Never stop a process you did not start.
- Only one agent at a time may reset or write a local database.
- No agent ever opens a session in DH-WEBSITE-main. It is read-only, on
  feature/interviewer-portal.

The standard's roles, by agent and pipeline step:

| Standard's role | Agent | Step |
| --- | --- | --- |
| Planner | `architect` | 1: `plan.md` |
| Architect | `architect` designs; `plan-reviewer` reviews the design | 1 and 2 |
| Approver | `tech-lead` approves between roles; the owner confirms the push and squash-merges | 3 and 6; the push and the merge |
| Tester | `tester`, on the developer's commit | 5 |
```

**The source of every sentence in the new section.** Nothing in it is new
behaviour. Each line is either the owner's words or a rule already in force.

| New text | Source |
| --- | --- |
| "Every change runs through `/change` ... in a Claude Code project thread, one agent per role: ..." | Owner, quote 2: "Each change ran through /change in a Claude project thread: architect → plan-reviewer → tech-lead gate 1 → developer → tester → tech-lead gate 2" |
| "The agents do everything up to the merge." | Owner's request and quote 2 |
| "After gate 2 the pipeline stops for the owner, and pushes ... only when the owner confirms." | `change.md:54-55` and `:63` ("When the owner confirms, push ..."); `docs/changes/README.md:16-18`; `AGENTS.md:14` ("Stop after each section, report, and wait for confirmation"). Writing it into `AGENTS.md` gives `change.md:55`'s "as `AGENTS.md` requires" an explicit rule to point at |
| "The owner squash-merges ... No agent merges." | Owner's request: "the owner squash-merges" |
| "CI, Security and Workflow lint run again ... after each merge." | A fact: the `push` triggers of `ci.yml`, `security.yml` and `workflow-lint.yml` (section 2). It states no duty |
| "Each change has its own branch, change/<id>, in its own worktree beside dh-platform." | The branch: `change.md` setup step 3. The worktree: old line 24 ("Each works in its own worktree beside dh-platform") and `AGENTS.md:19` ("One agent per worktree"). Practice: `dh-platform-claude-gap34`, `dh-platform-claude-adm07c` |
| "dh-platform stays on rebuild/dotnet-platform; nothing is committed there." | Old lines 25-26 ("dh-platform stays on rebuild/dotnet-platform"); `docs/changes/README.md:70` ("Never commit to `rebuild/dotnet-platform`") |
| "No agent checks its own work: the tester never built the change it tests." | Old line 30, first sentence; `tester.md:7` ("You test work someone else built") |
| "The tester works on a detached checkout ... so the developer can keep working." | Old lines 27-28; `tester.md:19-20` |
| "Findings go back to the role that wrote the work: ..." | Old line 32; `change.md` steps 2, 3, 6 and 7; `docs/changes/README.md:51-56` |
| "The reviewers, the tech lead and the tester do not fix them." | Old line 32 ("The checker does not fix them"); README's "Never does" column (plan-reviewer: "Rewrite the plan"; tester: "Fix anything"); `tech-lead.md:3` ("never edits the plan, code or tests") |
| "Parallel changes must change different files." | Old line 29 |
| "Agents use ports 42xx. Never stop a process you did not start." | Old lines 35-36 (Claude Code's range); `docs/changes/README.md:77`; `tester.md:28` |
| "Only one agent at a time ..." and "No agent ever opens a session in DH-WEBSITE-main ..." | Old lines 37 and 38-39, unchanged |
| Planner, Architect and Tester rows | The role names in the register row; the agents' duties in `.claude/agents/architect.md`, `plan-reviewer.md` and `tester.md`; the steps in `docs/changes/README.md:7-14` |
| Approver row | `tech-lead`'s gates (README:11 and :14). The owner: `change.md:54-55` and `:63` (confirming the push), and the owner's request ("the owner squash-merges"). Both are named because README:16-18 says a tech-lead approval is never the owner's confirmation |

**What each old rule becomes:**

| Old rule (line) | Outcome |
| --- | --- |
| Three agents; any of them builds, checks and tests (22) | Replaced by the `/change` bullet (owner, quote 2) |
| Worktrees `dh-platform-codex`, `-claude` and `-cursor`; dh-platform "used only for merging" (24 to 26) | Replaced by one branch and one worktree per change. dh-platform stays on the integration branch, and nothing is committed there. "Used for merging" goes, because the owner merges on GitHub |
| A builder owns its branch; a checker works on a detached checkout (27, 28) | Kept, in pipeline terms (developer, tester) |
| Parallel work changes different files (29) | Kept |
| No agent checks its own work, plus the rotation (30, 31) | First half kept. Rotation removed (owner, quotes 1 and 2) |
| Findings go back to the builder; the checker does not fix them (32) | Kept, and made true for every step: plan findings to the architect, delivery findings to the developer |
| One integrator merges and re-runs the suites (33, 34) | Removed (owner's request). The push runs are stated as a fact; who acts on them is O-1 |
| Ports 41xx, 42xx, 43xx (35, 36) | 42xx kept for all agents. 41xx and 43xx dropped, because no Codex or Cursor agent is left |
| One agent at a time on a local database (37) | Kept |
| No session in DH-WEBSITE-main (38, 39) | Kept unchanged |

**`.claude/commands/change.md`, lines 54-55.** Old:

```
After step 8, stop. Do not push, open a pull request or merge until the owner
confirms, as `AGENTS.md` requires. Report:
```

New (two lines for two):

```
After step 8, stop. Do not push or open a pull request until the owner
confirms, as `AGENTS.md` requires. Never merge. Report:
```

**`.claude/commands/change.md`, lines 65-66.** Old:

```
`.github/pull_request_template.md`. Merging stays with the integrator named for
the section.
```

New (two lines for two):

```
`.github/pull_request_template.md`. The owner squash-merges it into
`rebuild/dotnet-platform`; never merge it yourself (`AGENTS.md`).
```

**`docs/changes/README.md`.** Two new lines after line 18 ("and it never
counts as an owner decision under P-7."), in the same paragraph:

```
When the owner confirms, `/change` pushes the branch and opens the pull
request; the owner squash-merges it, and no agent merges.
```

**`website/README.md:247`.** Old:

```
| `SCREENSHOT_PORT`, `SCREENSHOT_CANDIDATE_PORT` | Any two different ports from 1024 to 65535. Use your own range (Codex 41xx, Claude Code 42xx, Cursor 43xx). |
```

New:

```
| `SCREENSHOT_PORT`, `SCREENSHOT_CANDIDATE_PORT` | Any two different ports from 1024 to 65535. Use the agents' range, 42xx (`AGENTS.md`). |
```

**Why no ADR.** `ENGINEERING_STANDARDS.md:12` (on #63) says "A rule changes
only through an ADR in `docs/adr/`". This change does not need one:
- The standard is not on the base yet, so its rule is not in force on the
  branch this change merges into.
- That rule governs the standard's own table. This change edits the working
  rules in `AGENTS.md`, which the standard (lines 9-11) leaves to `AGENTS.md`.
- The change is the owner's direct instruction (P-7: the request and quote 2).

If the owner wants an ADR for the working model, it is named in GAP-34b (O-2).

**Alternatives rejected:**

- **Edit only `AGENTS.md` and `CLAUDE.md`, as the request literally names.**
  Two lines of `change.md` would then contradict the new "No agent merges":
  lines 54-55 ("or merge until the owner confirms") and line 65 (the
  integrator). The orchestrator reads both files at setup step 2, so they would
  conflict on every run.
- **Also edit the #63 documents here.** They do not exist on the base, so
  creating them here would be an add/add conflict with #63. They are also a
  second set of records, where corrections are appended (standard, section 7).
  They go to GAP-34b.
- **Make this branch depend on #63.** It would tie a docs fix to a 1,296-line
  pull request and break B-2 (cut from `rebuild/dotnet-platform`). The two
  changes touch separate hunks, so merge order does not matter.
- **Keep the per-agent port table.** 41xx and 43xx belong to agents the owner
  says are no longer used.
- **Remove "No agent checks its own work" with the rotation.** The pipeline
  depends on it. Only the rotation goes.
- **Write a post-merge duty**, for example "the next `/change` run stops if the
  last push run is red". That is new behaviour without the owner's words, so it
  is asked as O-1.
- **Change `website/README.md:151` too.** It recommends port 4197 for a past
  task. Changing it means choosing a new port value, which is not this topic and
  not an agent rule. It goes to GAP-34b.
- **Make `change.md` setup create a worktree.** That is new behaviour for the
  orchestrator. The setup step says nothing about the folder, so it does not
  contradict the new text. The question goes to GAP-34b.
- **Edit `tester.md`.** Its worktree name and its port range already match.

## 4. Scope

**Files changed:**

| File | Change |
| --- | --- |
| `AGENTS.md` | Lines 21 to 39 ("## Agents") replaced by the 34-line section in 3. Every other line is byte-identical to the base, including line 7 (#63's line) and lines 9 to 11 (the status line, GAP-13). |
| `CLAUDE.md` | Same change. `cmp` against `AGENTS.md` exits 0. |
| `.claude/commands/change.md` | Lines 54-55 and 65-66, as in section 3. |
| `docs/changes/README.md` | Two lines added after line 18, as in section 3. |
| `website/README.md` | Line 247, as in section 3. |
| `docs/changes/GAP-34/*.md` | The pipeline records. |

**Out of scope, with where each item goes:**

- **GAP-34b, straight after #63 merges.** It brings the #63 documents into line
  with the working model:
  - `ENGINEERING_STANDARDS.md`: lines 9 to 11, P-1 "Enforced by", section 8
    box 10, O-3's recommendation text, and section 10 step 2.
  - `docs/PROJECT_PROFILE.md:14`.
  - `.github/pull_request_template.md:38-39`.
  - A dated correction appended to the refinement plan for lines 21, 134, 162
    and 269, and for the register's "section 15" citation.
  - `website/README.md:151` (the 41xx port for a past task).
  - Whether `change.md` setup should create the change's worktree.
  - An ADR for the working model, if the owner wants one.
  - Recording O-3 (merge method) as decided, if the owner confirms that their
    words here decide it.

  The owner may instead choose to fold these into #63 before it merges (O-2).
- **GAP-13 and O-9:**
  - the stale status line in `AGENTS.md` and `CLAUDE.md`, lines 9 to 11
    ("Phase C, the public website, is next");
  - the ADRs;
  - CODEOWNERS;
  - the build log;
  - the automatic review request.
- **`tester.md` and the other `.claude/agents/*.md` files.** Already in line.
- **`docs/phase-a-foundation.md`, `docs/phase-b-studio.md` and
  `docs/phase-c-website.md`.** Historical briefs; not rewritten.
- **Earlier `docs/changes/<id>/` records and PR bodies that name an
  integrator.** Records; never rewritten.
- **The worktrees `dh-platform-codex`, `dh-platform-cursor`,
  `dh-platform-cursor-screenshot` and `dh-platform-claude`.** The owner's
  housekeeping. No agent touches another worktree.
- **The red push runs on `2bbd586`.** PR #62 (ADM-07c) fixes the Studio
  failure. The two zero-step runs need a re-run. Neither is part of this change.
- **Branch protection on `rebuild/dotnet-platform`.** GAP-03.

## 5. Test plan

This is a docs-only change, so the "failing test" is a check that fails on the
base and passes on the head. B-6 (red test committed first) covers security
fixes; this is not one, so no separate red commit is needed. The developer runs
the red check on the base before editing and records it in `implementation.md`.

**Red first, on the base (before editing).**

```bash
git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md
git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md | wc -l
git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md
git grep -n -i -E "codex|cursor" -- website/README.md
```

Expected:
1. Exit 0 and 15 matches: `.claude/commands/change.md:65`, plus lines 22, 24,
   25, 30, 31, 33 and 35 of each of `AGENTS.md` and `CLAUDE.md` (section 2).
2. `15`.
3. Exit 0 with `.claude/commands/change.md:54`.
4. Exit 0 with `website/README.md:247`.

**Checks on the head.** Each check is quoted with its command, exit code and
output. All run from the worktree root in Git Bash, after the changes are
committed.

1. **Old model gone.** All three exit 1 with no output:
   ```bash
   git grep -n -i -E "codex|cursor|rotation|integrator|41xx|43xx" -- AGENTS.md CLAUDE.md .claude docs/changes/README.md
   git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md
   git grep -n -i -E "codex|cursor" -- website/README.md
   ```
2. **New model present.**
   - `grep -c "squash-merges" AGENTS.md CLAUDE.md .claude/commands/change.md docs/changes/README.md`
     gives `AGENTS.md:2` and `CLAUDE.md:2` (the bullet and the Approver row),
     `.claude/commands/change.md:1` and `docs/changes/README.md:1`.
   - `grep -c "Never merge" .claude/commands/change.md` gives `1`.
3. **The section is exactly the approved text.** This proves every kept rule
   and every new line. Exit 0, no output:
   ```bash
   diff --strip-trailing-cr \
     <(awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' docs/changes/GAP-34/plan.md) \
     <(sed -n '/^## Agents$/,/^## Schema$/p' AGENTS.md | head -n -2)
   ```
   `head -n -2` drops the blank line and "## Schema". `--strip-trailing-cr`
   is needed because the working copy is CRLF. As a sanity check,
   `awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f' docs/changes/GAP-34/plan.md | wc -l`
   gives `34`.
4. **Identical copies.** Both exit 0:
   ```bash
   cmp AGENTS.md CLAUDE.md
   cmp <(git show HEAD:AGENTS.md) <(git show HEAD:CLAUDE.md)
   ```
5. **Only the Agents section changed.** Both exit 0 with no output:
   ```bash
   diff <(git show origin/rebuild/dotnet-platform:AGENTS.md | sed -n '1,20p') <(git show HEAD:AGENTS.md | sed -n '1,20p')
   diff <(git show origin/rebuild/dotnet-platform:AGENTS.md | sed -n '/^## Schema/,$p') <(git show HEAD:AGENTS.md | sed -n '/^## Schema/,$p')
   ```
6. **Scope diff.**
   - `git diff --name-only origin/rebuild/dotnet-platform...HEAD` lists exactly
     `.claude/commands/change.md`, `AGENTS.md`, `CLAUDE.md`,
     `docs/changes/README.md`, `website/README.md` and files under
     `docs/changes/GAP-34/`.
   - `git diff --numstat origin/rebuild/dotnet-platform...HEAD -- .claude docs/changes/README.md website/README.md`
     gives exactly:
     ```
     4  4  .claude/commands/change.md
     2  0  docs/changes/README.md
     1  1  website/README.md
     ```
   - For `AGENTS.md` and `CLAUDE.md`, `--numstat` added minus deleted is `15`
     for each: 34 new lines for 19 old. Git may pair unchanged lines, such as
     the last two DH-WEBSITE-main lines, which lowers both numbers by the same
     amount. Check 3 is the exact proof.
7. **Every path the new text names exists.** Exit 0:
   `ls .claude/commands/change.md docs/changes/README.md .claude/agents/architect.md .claude/agents/plan-reviewer.md .claude/agents/tech-lead.md .claude/agents/developer.md .claude/agents/tester.md`.
8. **No conflict with #63.** Each command exits 0, and there is no `CONFLICT`
   line:
   ```bash
   git fetch origin claude/cool-heisenberg-mh6zx9
   T=$(git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD | head -1)
   git show "$T:AGENTS.md" | sed -n 7p
   cmp <(git show "$T:AGENTS.md") <(git show "$T:CLAUDE.md")
   git show "$T:AGENTS.md" | grep -c "squash-merges"
   ```
   Line 7 must read `docs/phase-b-studio.md, ENGINEERING_STANDARDS.md,
   docs/PROJECT_PROFILE.md.`, and the last command gives `2`.
9. **Every CI workflow on the pull request head**, after the owner confirms the
   push, with run ids quoted:
   - CI: `api`, `website`, `studio`, `section-compare` and `website-browser`.
     `screenshot-parity` is skipped without its label.
   - Security: all jobs.
   - Workflow lint: `actionlint`.
   - CodeQL.

   Until the push, these are NOT RUN and stay open at gate 2.
   - **Expected red, stated in advance.** The Studio job may fail on
     `e2e/redirects.spec.ts:37` "ADM-07 redirects: ...", as it did on
     `2bbd586`, if the head does not contain PR #62's fix. That happens if #62
     has not merged into `rebuild/dotnet-platform` and been brought in under
     B-3. This failure is the known ADM-07 race, not a regression from this
     change, which touches no Studio file. Report it with its run id and the
     test name; do not fix it here.
   - A job that fails with zero steps is a job-start failure. Report it and
     re-run it once, saying so.
   - Report any other failure as found.
10. **Local suites** (`dotnet test -c Release`, website and Studio `npm test`,
    builds, end-to-end) are NOT RUN, because no code, test or workflow changes.
    The CI jobs in check 9 cover them.

**Track checklist, G1 Waves 1 to 3** (`docs/changes/README.md`):

- One gate per pull request (B-8): one topic, the working model. No gate is
  added.
- A new gate reports for seven days, then blocks: N/A, there is no gate.
- Canary fixture (GAP-21): N/A, there is no gate.
- Actions pinned by SHA, the SQL Server image by digest, Node and .NET exact:
  N/A. No workflow is touched, and check 6 proves it.
- Baselines only shrink: no baseline file is touched (check 6).

## 6. Security impact

There are no changes to routes, policies, data, logins, secrets, dependencies or
workflows. The change is to process controls:

- **The integrator's duty to re-run the suites after each merge goes away**, on
  the owner's request. CI, Security and Workflow lint still run on each push to
  `rebuild/dotnet-platform`. No rule says who watches those runs, or who re-runs
  or reports a red one; O-1 asks the owner.
- **"No agent merges" is a written rule only.** `rebuild/dotnet-platform` is
  not protected (`"protected":false`). The pipeline's PRs are authored and
  merged under the owner's account `Mohamed-Elbadry-DH`, so GitHub cannot tell
  an agent merge from the owner's. The old integrator rule had the same
  weakness, so this change does not make it worse. GAP-03 (branch protection) is
  the control.

## 7. Migrations

None. The change is docs only.

## 8. Rollback

Revert the pull request. Nothing else depends on the text.

## 9. Owner decisions needed

- **O-1** (not blocking): the plan writes only the fact that the push workflows
  run, and adds no duty. The question: "Now that you squash-merge and no
  integrator re-runs the suites, who watches the CI, Security and Workflow lint
  runs on `rebuild/dotnet-platform` after each merge, and who re-runs or reports
  a red one: you, or the next `/change` run, which would check the last push
  runs at its setup and report any that are red?"
  - If the owner answers before gate 1, the rule is added to the Agents section
    and to `change.md` setup, quoting their words, and check 3's block changes
    with it.
  - Otherwise it goes on GAP-34b's list.
- **O-2** (not blocking): "The standard, the project profile, the PR template
  and the refinement plan on PR #63 still describe the integrator and the
  rotation. Should they be corrected in a follow-up GAP-34b straight after #63
  merges (recommended), or folded into #63 before it merges? And do you want an
  ADR for the working model?"
- **O-3** (merge method, `ENGINEERING_STANDARDS.md` section 9 on #63) is not
  decided here. The owner's words "the owner squash-merges" are passed to
  GAP-34b to record, if the owner confirms that they settle O-3.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| `AGENTS.md` and `CLAUDE.md` drift apart | Check 4 (`cmp`) and check 8 on the merged tree |
| The change conflicts with #63 on line 7, or #63's merge breaks the copies | The hunks are 13 lines apart. Check 8 runs `merge-tree` and `cmp` on the merged tree. Either merge order works. If #63 merges first, B-3 requires bringing it in and re-running checks 1 to 8 |
| #63 merges before GAP-34b. Its texts then cite an `AGENTS.md` integrator rule that is gone: P-1, section 8 box 10, O-3, and PR template lines 38-39. README:62 ("the stricter rule applies") could bring the integrator duty back by reference | GAP-34b is planned straight after #63 merges, and O-2 lets the owner fold it into #63 instead. Until then, the PR body drafted at gate 2 for each change names the owner as the one who merges (owner's request), not an integrator |
| A rule that still applies is dropped, or the copied text differs from the approved text | Check 3 compares the section with the approved block line for line. The source table and the old-rule table in section 3 let the reviewer check each line |
| Old-model wording is left in a file the roles read | Check 1 (three greps, including "or merge until") and check 2 |
| The new text promises a behaviour the owner has not given | Section 3's source table traces every sentence to the owner's words or to an existing rule. The one open behaviour, the post-merge duty, is O-1 and is not written |
| CI is red for reasons outside this change (the ADM-07 race, a job-start failure) | Check 9 states in advance what is expected and how each case is reported. Nothing is fixed here |
| Scope creeps into the #63 files, the GAP-13 status line or `website/README.md:151` | Checks 5 and 6: the exact file list, the line counts, and lines 1 to 20 unchanged |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Codex/Claude Code/Cursor rotation removed from `AGENTS.md` | Owner's request; quotes 1 and 2 | Planned | |
| The same removed from `CLAUDE.md`; the two files identical | Owner's request; README:60 ("`CLAUDE.md`, its copy") | Planned | |
| Working model recorded: `/change` agents do everything up to the merge | Owner's request; quote 2 | Planned | |
| The owner squash-merges; no agent merges (including `change.md:54-55`) | Owner's request | Planned | |
| Rules that still apply are kept, exactly as approved: own work not self-checked, detached checkout, findings to the role that wrote the work, parallel files, 42xx, no stopping others' processes, one agent per local database, DH-WEBSITE-main | `AGENTS.md` lines 27 to 39 at `2bbd586`; section 3 source table | Planned | |
| `change.md` and the README no longer contradict `AGENTS.md` on merging | Orchestrator brief; `change.md:54-55` and `65-66` | Planned | |
| `website/README.md:247` names only the agents' 42xx range | Plan review round 1, finding 9 | Planned | |
| Each of the standard's roles named against an agent and a stage in `AGENTS.md` | GAP-34 register row (refinement plan line 79, on #63) | Planned (Partly met for the line 162 item as a whole) | |
| No conflict with #63; the copies stay identical after both merge | Orchestrator brief | Planned | |
| The #63 documents, `website/README.md:151`, worktree creation in `change.md`, the ADR question | Refinement plan line 162; section 2 | Moved to GAP-34b | |
| ADRs, CODEOWNERS, build log, current status line, automatic owner review request | Refinement plan line 162 "Done when"; line 77 (GAP-13) | Moved to GAP-13 and O-9 | |
| Every CI workflow green on the pull request head, with the ADM-07 and zero-step cases reported as stated | README track checklist; PR template DoD | Planned | |

## 12. Revision log

### Round 1

First version.

### Round 2 (answers `plan-review.md` Round 1)

1. **Major 1, "Findings go back to the developer".** Accepted. The bullet now
   reads "Findings go back to the role that wrote the work: plan findings to the
   architect, delivery findings to the developer. The reviewers, the tech lead
   and the tester do not fix them." Its sources are cited in the section 3
   source table: `change.md` steps 2, 3, 6 and 7, README:51-56 and
   `tech-lead.md:3`.
2. **Major 2, `change.md:54-55`, "or merge until the owner confirms".**
   Accepted.
   - Lines 54-55 now read "Do not push or open a pull request until the owner
     confirms, as `AGENTS.md` requires. Never merge."
   - The line reference is corrected to 54-55.
   - Check 1 adds `git grep -n "or merge until" ...`, expected exit 1. The red
     step shows that it exits 0 on the base.
   - Check 2 counts "Never merge".
3. **Major 3, no check proves the replacement text.** Accepted.
   - New check 3 extracts the approved block from this plan with `awk` and
     `diff`s it against the Agents section of `AGENTS.md`, expected exit 0.
     Check 4 then extends the proof to `CLAUDE.md`.
   - I chose the plan itself as the reference, rather than a separate
     `agents-section.md`, so that there is only one copy of the approved text.
     The plan notes that the block must stay its only `markdown`-tagged fence.
4. **Major 4, the red runs on `2bbd586`.** Accepted, and verified with `gh`.
   - Run 43213692554's only failure is the Studio job, on
     `e2e/redirects.spec.ts:37` "ADM-07 redirects: ...". PR #62
     (`change/ADM-07c`, head `6a57b14`) names that test. Its
     `delivery-approval.md` ends `Verdict: APPROVED`, and `gh pr checks 62`
     shows every check passing.
   - Runs 43213692568 and 43213692582 failed with `steps=0` between 11:58:15Z
     and 11:58:17Z. These are job-start failures that need a re-run.
   - "Nobody acted" is removed from sections 2 and 6. O-1 is reworded without
     that premise ("who watches ... and who re-runs or reports").
   - Check 9 states in advance that the Studio job may be red on a head without
     #62's fix, and how zero-step jobs are handled.
5. **Minor 5, no source for the new bullets.** Accepted. Section 3 has a new
   table giving the source of every sentence, covering each bullet and each
   mapping row. The Approver row now uses the owner's words ("the owner confirms
   the push and squash-merges") instead of "approves the change by merging it".
6. **Minor 6, "nothing is built" and the worktree claim.** Accepted.
   - "built" is dropped. The bullet now reads "nothing is committed there", with
     README:70 as its source.
   - The worktree bullet's sources are old line 24, `AGENTS.md:19` and practice.
   - Section 2 records that `change.md` setup step 3 does not create a
     worktree. Section 3 explains that this is silence, not a contradiction, and
     sends the question to GAP-34b.
7. **Minor 7, the red check's expected output.** Accepted. I re-ran it on
   `2bbd586`. It exits 0 with 15 matches (`wc -l` gives `15`):
   `change.md:65`, plus lines 22, 24, 25, 30, 31, 33 and 35 in each copy. The
   result is quoted in section 2 and in the test plan.
8. **Minor 8, the PR evidence.** Accepted.
   - #37 is now "opened 1 November, merged 10 November 23:05Z".
   - #38, #39, #45, #46 and #48 are now listed, with their `change/` branches
     and merge dates. All were authored and merged by `Mohamed-Elbadry-DH`,
     with no reviews.
   - The two periods are now described by merge date.
9. **Minor 9, `website/README.md`.** Accepted for `:247`. It is now in scope
   (one line, same topic, on the base), with a grep in check 1. `:151` stays out,
   for the actual reason: it recommends a port value (4197) for a past task, and
   changing it means picking a new port, which is not this topic. It is listed
   under GAP-34b.
10. **Minor 10, the standard's ADR rule and the risk that #63 merges first.**
    Accepted.
    - Section 3 has a new "Why no ADR" paragraph: the rule is not on the base;
      it governs the standard, not `AGENTS.md`; and the change is the owner's
      direct instruction.
    - The ADR question is added to O-2 and to GAP-34b.
    - A new risk row covers #63 merging before GAP-34b, with GAP-34b and O-2 as
      the mitigation.
11. **Minor 11, inexact commands.** Accepted.
    - Check 8 uses
      `T=$(git merge-tree --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD | head -1)`
      and `$T`.
    - Check 6 gives the exact expected `--numstat` lines for the three small
      files.
    - For `AGENTS.md` and `CLAUDE.md`, check 6 gives the exact difference
      between added and deleted lines (15). It explains why the two raw numbers
      can be lower; check 3 is the exact proof.
12. **Minor 12, missing coverage rows.** Accepted. Rows are added for:
    - the line 162 items moved to GAP-13 and O-9, including CODEOWNERS and the
      automatic review request;
    - the items moved to GAP-34b;
    - `website/README.md:247`.
13. **Minor 13, "CI runs again".** Accepted. The bullet now names "CI, Security
    and Workflow lint", and section 2 notes that `codeql.yml` has no push
    trigger.
