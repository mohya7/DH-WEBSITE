# GAP-34 plan review

## Round 1

Reviewed `docs/changes/GAP-34/plan.md` (round 1, untracked) on `change/GAP-34`
at `2bbd586`. Documents that are not on the base yet were read from
`origin/claude/cool-heisenberg-mh6zx9` (PR #63, head `d1cb4c9`).

### Findings

**1. Major. Section 3, the new Agents section: "Findings go back to the
developer. The reviewers and the tester do not fix them."**
- What is wrong: plan-review and gate 1 findings do not go to the developer.
  They go to the architect.
- Evidence: `.claude/commands/change.md:32-36` says "CHANGES NEEDED: back to
  step 1" for the plan-reviewer and for gate 1. `docs/changes/README.md:51-52`
  says "A plan sent back goes to the architect". The "What each old rule
  becomes" table cites the README's "Never does" column, but that column says
  nothing about where findings go.
- Why it matters: this change exists to make the four files agree. The text the
  developer must copy "exactly" would create a new contradiction.
- Expected: reword the bullet so it is true for every step, for example
  "Findings go back to the role that wrote the work: plan findings to the
  architect, delivery findings to the developer. The reviewers, the tech lead and
  the tester do not fix them." Cite `change.md` steps 2 to 7 as the source.

**2. Major. Section 3, "`.claude/commands/change.md`": "Line 55 stays".**
- What is wrong: the kept sentence is at lines 54-55: "Do not push, open a pull
  request or merge until the owner confirms, as `AGENTS.md` requires."
  - "or merge until the owner confirms" implies that an agent may merge after
    the owner confirms.
  - That contradicts the new "No agent merges" in `AGENTS.md`, and the new line
    65 in the same file.
- Evidence: the plan says the sentence stays "because the new AGENTS.md text
  still carries that rule". It does not. The new text says no agent merges at
  all. The `git grep` in checks 1 and 2 does not search for this wording, so it
  would not catch the conflict.
- Expected:
  - Change lines 54-55 to drop "or merge". For example: "Do not push or open a
    pull request until the owner confirms, as `AGENTS.md` requires. Never merge."
  - Add a check that proves it, for example `git grep -n "or merge until" --
    .claude AGENTS.md CLAUDE.md docs/changes/README.md` exits 1.
  - Correct the line reference to 54-55.

**3. Major. Section 5, the test plan: no check proves the replacement text or
the kept rules.**
- What is wrong: no check covers the coverage row "Rules that still apply are
  kept". The plan says the developer uses the section 3 text "exactly", but no
  check proves it.
  - Check 1 proves the old words are gone.
  - Check 2 proves only "squash-merges" and the Planner row.
  - Check 4 proves only that lines outside the section did not change.
  - A developer could drop "Only one agent at a time may reset or write a local
    database" or "Never stop a process you did not start", and all nine checks
    would still pass.
- Evidence: section 5, checks 1 to 9, and the coverage table row "Rules that
  still apply are kept ...".
- Expected: add a check that compares the section with the approved text. For
  example, the plan's block saved under `docs/changes/GAP-34/` and compared:
  `diff <(sed -n '/^## Agents/,/^## Schema/p' AGENTS.md | sed '$d') docs/changes/GAP-34/agents-section.md`,
  exit 0. Alternatively, run one `grep -c` per kept rule with the expected count
  of 1.

**4. Major. Section 2 ("Nobody acted on those red runs"), section 4 ("I did not
check whether it covers the ADM-07 end-to-end failure"), section 6 and O-1: the
red runs on `2bbd586` are described wrongly.**
- What is wrong: the plan presents the red runs as unhandled, and O-1 asks the
  owner a question built on that premise. Under P-8 this is a claim against
  evidence that is easy to find.
- Evidence:
  - **The Studio red has a fix.** In run 43213692554, the Studio job is the
    only failure; API, Website, browser tests and section comparison pass.
    PR #62 (`change/ADM-07c`, opened 12 November 16:15Z) says it fixes this
    exact test: "ADM-07 redirects: a live page and a loop are refused ...".
    Its `delivery-approval.md` ends `Verdict: APPROVED`. Its head `6a57b14` has
    every check green, including "Studio — typecheck, build, end-to-end".
  - **Security and Workflow lint did not run their suites.** In runs
    43213692568 and 43213692582, "Security gate self-test" and "actionlint
    (every workflow)" failed with `steps=0` between 11:58:15Z and 11:58:17Z. The
    other Security jobs were skipped. These are job-start failures, not test
    results, so they say nothing about the code. PR #63's green checks show
    that the runners work now.
- Expected:
  - State that the Studio failure is the ADM-07 redirects race and that PR #62,
    approved at gate 2 and green, fixes it.
  - Describe the two zero-step runs as job-start failures that need a re-run,
    not as failed suites.
  - Drop "Nobody acted" from section 2 and section 6.
  - Reword O-1 without the false premise: who watches the push runs after a
    merge, and who re-runs or reports them. O-1 can stay non-blocking.
  - In check 8, expect the Studio job to stay red on any head that does not
    contain #62's fix. Say so in advance, so that this red is not taken for a
    regression from this change.

**5. Minor. Section 3, the new bullet "pushes the change branch and opens the
pull request only when the owner confirms": no source is given.**
- This is not a new behaviour. It is the existing rule in `change.md:54-55`
  ("Stop for the owner") and `docs/changes/README.md:16-18`.
- `change.md` already says the rule is one "`AGENTS.md` requires", but on the
  base `AGENTS.md` carries it only implicitly, at line 14 ("Stop after each
  section, report, and wait for confirmation"). Writing it into `AGENTS.md`
  closes that dangling reference, which is good.
- It is not in the owner's quotes, though. Quote 2 says "Agents did everything
  up to the merge" and does not mention a stop before the push.
- The risk table claims "every new sentence traces to the owner's quotes or to
  an existing rule (section 3 table)", but the section 3 table maps old rules
  only. It gives no source for any new bullet.
- Expected: give each new bullet a source, as a column or a short list:
  - the owner's quote, for the `/change` bullet and the squash-merge bullet;
  - `change.md:54-55` and `README:16-18`, for the confirmation stop;
  - `tester.md:19-20`, for the detached checkout;
  - `README:77` and `tester.md:28`, for the ports.
- The Approver row ("the owner approves the change by merging it") is also an
  interpretation. The owner's words are "the owner squash-merges". Either
  quote the owner, or cite the confirmation stop as the approval.

**6. Minor. Section 3, the new bullet "dh-platform stays on
rebuild/dotnet-platform; nothing is built or committed there".**
- "Nothing is built" is a new restriction.
  - Under the old rule, the integrator re-ran the suites after each merge, and
    did so in the merge folder, dh-platform.
  - "Nothing committed" is backed by `README:70`. "Nothing built" has no
    source.
  - Expected: either trace "built" to a source or drop it.
- The bullet "Each change has its own branch, change/<id>, in its own worktree"
  matches practice (`dh-platform-claude-adm07c`, `dh-platform-claude-gap34`).
  But `change.md` setup step 3 runs `git switch -c` in the orchestrator's
  current folder and never creates a worktree. So the claim that the four files
  will "say the same thing" is not fully true.
  - Expected: name this gap and send it to GAP-34b, or say why it does not
    matter.

**7. Minor. Section 5, the red check: the expected output is wrong.**
- The plan expects "exit 0 and the seven lines listed in section 2". I ran it on
  `2bbd586`. It exits 0 with 15 matches:
  - `AGENTS.md` lines 22, 24, 25, 30, 31, 33 and 35;
  - the same seven lines in `CLAUDE.md`;
  - `.claude/commands/change.md:65`.
- Expected: state 15 matches and list them.

**8. Minor. Section 2, "What actually happened": the PR evidence is wrong.**
- "#37 (10 November)": #37 was opened on 1 November and merged on 10 November
  at 23:05Z.
- The list of merged PRs leaves out #38, #39, #45, #46 and #48. They came from
  `change/` branches and were merged between 4 and 9 November, under the same
  account, before #37 merged. So "every PR from #37 ... to #56" does not
  describe a single period in time.
- The conclusion does not change, and the missing PRs make it stronger.
- Expected: correct the dates and the PR list.

**9. Minor. Section 4, out of scope: `website/README.md:151` and `:247`.**
- `:247` tells readers "Use your own range (Codex 41xx, Claude Code 42xx,
  Cursor 43xx)". After this change, it contradicts `AGENTS.md`.
- The plan defers it to GAP-34b. Its stated reason for GAP-34b is that the
  files exist only on #63, but `website/README.md` is on the base, so that
  reason does not apply.
- Expected: either include `:247` here (a one-line change, still the same
  topic), or give the actual reason for the deferral.

**10. Minor. Sections 4 and 10: the standard on #63 is not addressed.**
- `ENGINEERING_STANDARDS.md:12` says: "A rule changes only through an ADR in
  `docs/adr/`."
  - Expected: say why this change needs no ADR. Possible reasons: the owner's
    direct P-7 instruction, and the fact that `docs/adr/` does not exist until
    GAP-13.
  - If an ADR is wanted, name it in GAP-34b or GAP-13.
- The risks table also misses the case where #63 merges before GAP-34b. Then
  several texts would cite an `AGENTS.md` rule that is gone:
  - P-1, "Integrator (`AGENTS.md`)";
  - section 8, box 10;
  - O-3;
  - PR template lines 38-39 ("name the integrator who merges ... confirm the
    suites are re-run after the merge").
- In that case `README:62` ("the stricter rule applies") would bring the
  integrator duty back by reference.
- Expected: add a risk row for this, with GAP-34b or O-2 as the mitigation.

**11. Minor. Section 5, the commands are not all exact.**
- Check 7 uses a `<tree>` placeholder. Expected: `T=$(git merge-tree
  --write-tree origin/claude/cool-heisenberg-mh6zx9 HEAD | head -1)`, then
  `$T`.
- Check 5 says "only a few lines each". Expected: the line counts.

**12. Minor. Section 11, the coverage table: two rows are missing.**
- The part of the line 162 "Done when" that is moved to GAP-13: CODEOWNERS and
  "a new pull request requests the owner's review automatically (O-9)".
- The `website/README.md` port lines (finding 9).

**13. Minor. Section 3: "CI runs again on rebuild/dotnet-platform after each
merge".**
- `ci.yml`, `security.yml` and `workflow-lint.yml` run on push to
  `rebuild/dotnet-platform`.
- `codeql.yml` does not (pull_request, schedule and workflow_dispatch only).
- Expected: name the three workflows, or say "CI, Security and Workflow lint".

### Checked and found sound

- **Fit.**
  - The register row (line 79) and the line 162 "Done when" are quoted word for
    word from #63.
  - The owner's request and the three quotes are reproduced exactly.
  - Treating the role mapping as met in `AGENTS.md`, and the plan as a whole as
    Partly met, is honest.
  - The note about the register's "section 15" citation is correct: the
    standard on #63 has sections 1 to 10, and rollout step 2 is at line 177.
- **Owner's words.**
  - Removing the rotation, the three named agents, the per-agent worktrees and
    the integrator follows quotes 1 and 2 and the request.
  - "The owner squash-merges" and "No agent merges" follow the request.
  - The plan writes no post-merge duty and asks it as O-1 instead, which is
    correct under P-7.
- **Kept rules.** These are all still true and still needed:
  - no agent checks its own work, without the rotation;
  - the detached checkout;
  - parallel changes change different files;
  - never stop another agent's process;
  - one agent at a time on a local database;
  - no session in DH-WEBSITE-main.
- **Ports.** Dropping 41xx and 43xx is right.
  - 42xx matches `tester.md:28` and `README:77`.
  - The fixed ports in tests and CI are not agent ranges, and this change does
    not affect them: `CareersTests.cs:286` (4318), and `ci.yml` 4390, 4392 and
    4393.
- **Scope (B-8).**
  - The change has one topic.
  - Including `change.md:65-66` and the README paragraph is needed, so that the
    files every role reads do not contradict each other.
  - The status line at lines 9-11 is correctly left to GAP-13.
  - The #63 documents are correctly left to GAP-34b; they cannot be edited here
    without an add/add conflict.
  - Not cutting from #63 respects B-2.
- **Overlap with #63.**
  - `git diff origin/rebuild/dotnet-platform...origin/claude/cool-heisenberg-mh6zx9`
    changes only line 7 of `AGENTS.md` and `CLAUDE.md`, and touches neither
    `.claude/` nor `docs/changes/README.md`.
  - The hunks are separated by 13 unchanged lines, so either merge order works.
  - Check 3 (`cmp`) and check 7 (`merge-tree` and `cmp` on the merged tree)
    keep the two files byte-identical.
- **Current state.**
  - `cmp AGENTS.md CLAUDE.md` exits 0.
  - The Agents section is lines 21-39, with "## Schema" at line 41.
  - `change.md:65-66` holds the integrator sentence.
  - `tester.md:20` uses `git worktree add --detach ../dh-platform-claude-test`.
  - `git worktree list` matches the four old worktrees and the dates given.
  - The branch is unprotected and the base commits are single-parent squash
    merges.
  - PR #56's body still names "integrator Claude Code (this thread)" (lines
    99 and 119).
- **Owner questions.**
  - O-2 is not blocking: the default, a follow-up after #63, does not change
    this change's files.
  - O-1 can stay non-blocking once its premise is fixed (finding 4). The plan
    writes only the fact that the push workflows run, and does not invent a
    duty.
- **Gates and security.** No gate, guard, baseline, test, workflow, route,
  secret, dependency or migration is touched. The note that "No agent merges"
  is only a written rule, with GAP-03 as the control, is accurate.
- **Rollback.** Reverting the pull request is enough. Nothing else depends on
  the text.

Verdict: CHANGES NEEDED

## Round 2

Reviewed `docs/changes/GAP-34/plan.md` round 2 (untracked) on `change/GAP-34`
at `2bbd586`. I checked each Round 1 answer against the plan body, not against
the revision log. I re-ran the plan's commands, and ran checks 3, 6 and 8 on a
head I built in my scratch folder from the approved block.

### Round 1 findings, checked against the plan body

| Round 1 finding | Where the plan answers it | Result |
| --- | --- | --- |
| 1 Major, findings routing | Section 3 block, the "Findings go back to the role that wrote the work" bullet; source table row | Closed. It agrees with `change.md:32-46` and README:51-56. `tech-lead.md:3` says "never edits the plan, code or tests", as cited |
| 2 Major, `change.md:54-55` | Section 3 old/new block for lines 54-55; check 1 adds the "or merge until" grep; check 2 counts "Never merge" | Closed. The red grep exits 0 with `.claude/commands/change.md:54` on the base, as expected |
| 3 Major, no proof of the text | Check 3 (`awk` extraction compared with `diff --strip-trailing-cr`) | Closed. See the reruns below, including a negative test |
| 4 Major, red base runs | Section 2 "After a merge", section 4, section 6, O-1, check 9 | Closed. "Nobody acted" is gone. PR #62 is described correctly. Zero-step runs are called job-start failures. Check 9 states the expected ADM-07 red in advance |
| 5 Minor, sources | Section 3 source table | Closed. I checked every row (see below) |
| 6 Minor, "built" and the worktree | Section 3 bullet; source table; section 2; alternatives; GAP-34b list | Closed |
| 7 Minor, red output | Section 2 and the red step | Closed. It gives 15 matches |
| 8 Minor, PR evidence | Section 2, "What actually happened" | Closed. It matches `gh pr list` (merge dates for #37 to #56) |
| 9 Minor, `website/README.md` | Section 3 `:247` old/new; scope table; check 1; check 6 | Closed. `:151` stays out for a valid reason: it names a port value for a past task, and contains no agent name |
| 10 Minor, ADR rule and #63 ordering | "Why no ADR"; O-2; GAP-34b list; risk row 3 | Closed (see note A) |
| 11 Minor, inexact commands | Check 8 `T=$(...)`; check 6 `--numstat` | Closed |
| 12 Minor, coverage rows | Section 11, the GAP-34b and GAP-13/O-9 rows and the `:247` row | Closed |
| 13 Minor, "CI runs" | Block bullet; section 2 notes that `codeql.yml` has no push trigger | Closed |

### Reruns

| Command | Result |
| --- | --- |
| The red `git grep` on `2bbd586` | Exit 0. `wc -l` gives `15`: `change.md:65`, plus lines 22, 24, 25, 30, 31, 33 and 35 in each copy |
| `git grep -n "or merge until" -- .claude AGENTS.md CLAUDE.md docs/changes/README.md` | Exit 0: `.claude/commands/change.md:54` |
| `git grep -n -i -E "codex\|cursor" -- website/README.md` | Exit 0: only `:247`. Line 151 ("...the Section 5 task's 41xx rule") does not match, so check 1 will not trip on the line kept out of scope |
| Check 3 `awk` extraction from `plan.md` | 34 lines. `plan.md` is LF, and it has exactly one `` ```markdown `` fence |
| `sed -n '/^## Agents$/,/^## Schema$/p' AGENTS.md` on the CRLF base copy (`i/lf w/crlf`) | 21 lines, or 19 after `head -n -2`. The `$`-anchored patterns match in Git Bash, so check 3 works on the CRLF working copy |
| Check 3 on the simulated head (base lines 1-20, then the block, then base lines 40 to the end, written as CRLF) | `diff` exits 0 |
| Check 3 negative test: the same head with "Only one agent at a time" removed | `diff` exits 1. The check catches a dropped kept rule |
| Check 1 grep on the simulated head | Exit 1 |
| Check 2 `grep -c "squash-merges"` on the simulated head | `2` |
| Check 6, `git diff --no-index --numstat` base against the simulated head | `30 15`. Added minus deleted is 15, as the plan explains |
| Check 8, the merge with #63 (`git merge-file` of the simulated head, base and #63's `AGENTS.md`) | Exit 0, with no conflict. Line 7 is #63's text, and `grep -c squash-merges` gives `2` |
| Cited lines | `tester.md:7` ("You test work someone else built"); `tester.md:19-20` and `:28`; `tech-lead.md:3`; README:11, :14, :16-18, :51-56, :70 and :77; `change.md:54-55` and `:63`; `AGENTS.md:14` and `:19`. Each one says what the source table claims |

### Source table

Every sentence and mapping row in the block has a real source:
- The `/change` and squash-merge bullets come from the owner's words (the request and quote 2). "Claude Code project thread" matches the `claude.ai/code/project` thread link in PR #56.
- The confirmation stop comes from `change.md:54-55` and `:63`, README:16-18 and `AGENTS.md:14`. It is an existing rule, not new behaviour.
- The push-run sentence is stated as a fact from the workflow triggers, with no duty attached.
- The kept rules trace to the old line numbers, and to `tester.md` and the README.
- The Approver row now uses the owner's words ("confirms the push and squash-merges").

### Remaining findings

**A. Minor. Section 3, "Why no ADR", second reason.**
- What is wrong: the claim "That rule governs the standard's own table. This
  change edits the working rules in `AGENTS.md`, which the standard (lines
  9-11) leaves to `AGENTS.md`" is an interpretation.
  - `ENGINEERING_STANDARDS.md:12` comes straight after the sentence about
    `AGENTS.md`'s working rules, so it can be read as covering them too.
  - The other two reasons are enough on their own: the rule is not on the base,
    and the owner gave a direct P-7 instruction.
  - O-2 already asks the owner whether they want an ADR.
- Expected (optional): call the second reason a reading of the text, not a
  fact. This does not block.

**B. Minor. Section 10, risk row 3, the mitigation "the PR body drafted at gate
2 ... names the owner as the one who merges".**
- What is wrong: no rule file says this. It works only because the tech lead
  reads the new `AGENTS.md` text. Once #63 merges, the PR template's lines
  38-39 ("name the integrator") would pull the other way, until GAP-34b lands.
- Expected (optional): say that the new `AGENTS.md` bullet is the control. Or
  add it to gate 2's Definition of Done note for this change's own PR. This
  does not block, because GAP-34b and O-2 cover the gap.

Neither finding blocks gate 1.

### Still sound

- **Scope:** five files plus the records, one topic (B-8). The status line is
  left to GAP-13. The #63 documents, `website/README.md:151` and worktree
  creation are left to GAP-34b.
- **Copies:** `AGENTS.md` and `CLAUDE.md` stay byte-identical (checks 4 and
  8).
- **Gates and security:** no gate, workflow, route, secret, dependency or
  migration is touched.
- **Owner questions:** O-1 and O-2 are truly non-blocking. The plan writes no
  post-merge duty, and the follow-up documents do not change this change's
  files.
- **Rollback:** reverting the pull request is enough.

Verdict: APPROVED
