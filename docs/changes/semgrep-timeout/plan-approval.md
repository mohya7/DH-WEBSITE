# Plan approval: semgrep-timeout (gate 1)

Technical lead, 10 November 2026. Gate 1, the plan. Reviewed `plan.md`
(architect, round 2, `12e8399`) and `plan-review.md` (round 1 `CHANGES NEEDED`,
round 2 `Verdict: APPROVED`, `b176d09`) on `change/semgrep-timeout`, cut from
`origin/rebuild/dotnet-platform` at `cc99e20`.

Read first, from this worktree: `.claude/agents/tech-lead.md`,
`docs/changes/README.md` and `AGENTS.md`. `ENGINEERING_STANDARDS.md` from
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/ENGINEERING_STANDARDS.md`.
Shape from `docs/changes/semgrep-error-detail/plan-approval.md` on the base.
`docs/PROJECT_PROFILE.md` and the refinement plan are not on the base; this
change closes no refinement item.

This approval moves the change to the developer. It is not the owner's
confirmation that `AGENTS.md` requires, and it is not an owner decision.

## Decision

Approved, with the conditions below. It is the right change and it is one topic:
one value of one existing gate's input (G-10), with the gate itself untouched.
It should go ahead now, because the timeout is the base's own defect and fails
open pull requests at random. The reviewer's round 1 Major and six Minors are all
resolved in round 2, and round 2 raised nothing new. I re-checked the design
against the base as it is now (`9c2a32b`), which the plan has not seen.

## Reasons

**The right change, and the owner chose it.** The owner's words are quoted with
date and place: "yes" (Mohamed Elbadry, 10 November 2026, project timeline),
choosing "Raise Semgrep's time limit: A small change gives Semgrep more time per
file (e.g. 30s instead of 5s). Nothing is skipped; the scan may run a little
longer." The plan does exactly that, with the card's own value. No other owner
decision is needed (§9); a different value would be one.

**The gate stays as strong (P-6).** I checked it myself on the base:

- `gate.mjs:422` is `if (!isPartialParse(error.type)) reject(...)`, and
  `gate.test.mjs:837` loops over `"Timeout", "Out of memory", "Stack overflow",
  "Fatal error", "Rule parse error"`. Neither file's rejection logic changes.
- A report with one `Timeout` error at level `warn` on `gate.test.mjs`, rule
  `javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path`,
  fed to `node .github/security/gate.mjs semgrep <file>` on the merged prototype
  tree below → `semgrep report field type is not a partial parse (error 1 of 1;
  level warn; type Timeout; path .github/security/gate.test.mjs; rule …)`,
  exit 1.
- `grep -n timeout .github/workflows/security.yml` → nothing; `security.yml` and
  `security.expected.yml` are unchanged against the base. The scan script carries
  every argument, so no workflow or golden YAML changes.

**The design works on the current base.** I did not rely on the reviewer's
prototype. I built §3 and §4 from the plan's text in
`/tmp/claude-0/-home-user/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/g1`
(`git archive HEAD`, then two loose commits with a temporary `GIT_INDEX_FILE`;
the worktree and its index were not touched):

- Red (self-test edits only, `knownFlags` unchanged), `/opt/node22/bin/node
  --test .github/security/gate.test.mjs`:

  ```
  not ok 55 - the semgrep job and scan script match their golden copies
  not ok 69 - workflow-shape mutations are rejected
    error: 'drop-timeout did not change anything'
  not ok 70 - the scan's timeout is pinned by its own check, not only the golden copy
  # tests 74
  # pass 71
  # fail 3
  ```

  Exactly §5's expected red.
- Green (both scripts, the §3 example comment above `set +e`, `knownFlags`):
  `# shape drop-timeout: old new, new caught` and the same for
  `timeout-unlimited`, `timeout-equals-spelling` and `add-timeout-threshold`;
  `# tests 74`, `# pass 74`, `# fail 0`. `diff run-semgrep.sh
  run-semgrep.expected.sh` → no output. `git diff --stat HEAD <green>` → only
  `gate.test.mjs` (24 lines, 1 removed), `run-semgrep.sh` and
  `run-semgrep.expected.sh` (2 lines each).

**The base has moved, and it still merges.** `git fetch origin
rebuild/dotnet-platform change/GAP-07` → `f5dd209..9c2a32b`. The base now holds
#40 (GAP-12, `a866cf6`), #41 (GAP-08, `f5dd209`) and #42 (GAP-06, `9c2a32b`).
`git diff --stat f5dd209 origin/rebuild/dotnet-platform -- .github` → only
`.github/workflows/ci.yml` (8 insertions); nothing under `.github/security`.
GAP-06 also adds `api/tools/migration-checks/run.sh` (460 lines), inside the
`api` root, so Semgrep scans one more file; it is far smaller than
`gate.test.mjs` and changes nothing in this design. Merges, all exit 0:

| Merge | Tree | Self-test on `git archive` of the tree |
| --- | --- | --- |
| plan head `b176d09` with base `9c2a32b` | `3c10447` | `# tests 73`, `# pass 73`, `# fail 0` |
| plan head with `origin/change/GAP-07` (`e8a8d9d`) | `0fa951a` | not run (no code yet) |
| prototype green with base `9c2a32b` | `8dff9b2` | `# tests 74`, `# pass 74`, `# fail 0`; one `--timeout 30` line |
| prototype green with GAP-07 `e8a8d9d` | `62452aa` | `# tests 86`, `# pass 86`, `# fail 0`; one `--timeout 30` line |
| (green merged with base) with GAP-07 | `da60e1c` | `# tests 86`, `# pass 86`, `# fail 0` |

The base alone (`9c2a32b`) gives `# tests 73`, `# pass 73`, `# fail 0`, so
GAP-06's `ci.yml` change passes `inlineInterpreterProblems`. The last row is the
tree #44 will have after it merges the base with this change in it.

**Conflicts with open branches.** `gh api
'repos/mohya7/DH-WEBSITE/pulls?state=open'` lists only #44 (GAP-07, `e8a8d9d`)
and #43 (GAP-04, `7d90d5c`). From each change branch's merge base:

| Branch | Touches `.github/security` | Merge with prototype green |
| --- | --- | --- |
| `change/GAP-07` (#44) | `gate.mjs`, `gate.test.mjs` (appends at the end), `run-npm-audit*.sh`, `security.expected.yml`; not `run-semgrep*.sh` | exit 0 (above) |
| `change/GAP-04` (#43, fetched to `7d90d5c`) | no; only `.github/workflows/ci.yml` | exit 0 |
| `change/GAP-01` (already merged as #39) | `gate.test.mjs`, lines 21 to 552 | exit 0 |

The new test's place (directly after "workflow-shape mutations are rejected",
`gate.test.mjs:1609-1621`, unchanged on `9c2a32b`) keeps it clear of GAP-07's
appends. Parallel work changes different hunks.

**Order.** This is a CI defect, not a refinement item, and adds no gate. It
should take the next merge slot ahead of #44: #44's Semgrep job cannot be relied
on until this is in the base, and #43 and every later pull request scan the same
file. It depends on nothing open.

**Risk.** Low and bounded. A stalled rule now costs up to 30 seconds per file
instead of 5, at most three per file before Semgrep skips it, and those
timeouts still fail the gate. The residual risk is that 30 seconds is still too
short on a slow runner for GAP-07's 2,149-line file; that proof is correctly
moved to #44 (Done when 5), and if it recurs the gate fails loudly with the rule
and file named. I accept it.

## Reviewer Minors

Round 1's six Minors (findings 2 to 7) are resolved in the round 2 text, and my
prototype confirms findings 2, 3 and 6 behave as the plan now says. Round 2 has
no Minors. There is nothing left to accept as open.

Two small points of my own, neither a design change:

- §2 describes the base as `f5dd209`. It is now `9c2a32b` (GAP-06). The plan is
  not edited; the developer records the base used (condition 6).
- Done when 5 lives in another change's record. The reviewer asked that it be
  passed to GAP-07's pipeline; I make that a condition so it is not lost
  (condition 8).

## Conditions for the developer

1. **Scope.** Change only `.github/security/run-semgrep.sh`,
   `.github/security/run-semgrep.expected.sh` and `.github/security/gate.test.mjs`,
   plus `docs/changes/semgrep-timeout/implementation.md`, exactly as §3 and §4
   describe. No change to `gate.mjs`, any workflow, any golden YAML,
   `--timeout-threshold`, `--max-target-bytes`, `--jobs` or `--max-memory`.
2. **The value and its spelling.** The scan line is `  --timeout 30 \`, directly
   after the `--output` line, identical in both scripts. The one comment line
   above `set +e` contains none of `semgrep scan`, `-o `, `|| true`,
   `SEMGREP_ROOTS` or `--timeout`.
3. **Red commit first (P-4, B-6).** Commit 1 is `gate.test.mjs` alone (the
   timeout check, four mutations, count 30, the new test after "workflow-shape
   mutations are rejected"; `knownFlags` unchanged), subject `semgrep-timeout:
   Pin the scan timeout in the self-test (red)`. Its run is quoted in
   `implementation.md` with the commit hash, and must be `# tests 74`,
   `# pass 71`, `# fail 3`, failing exactly tests 55, 69 (`drop-timeout did not
   change anything`) and 70. Any other failure is reported before going on.
4. **Green commit.** Commit 2, subject `semgrep-timeout: Give each Semgrep rule
   30 seconds per file`, adds both script lines and `knownFlags`; the self-test
   is `# tests 74`, `# pass 74`, `# fail 0`, with the four `shape …: old new,
   new caught` lines quoted. Do not push between the commits.
5. **Run and quote §5 steps 1 to 6** as run: command, exit code and output lines,
   including the local Semgrep 1.180.0 parse of `--timeout 30` (step 5) and the
   gate's exit 1 on a Timeout report (step 6). Anything not run is written
   NOT RUN with the reason and the covering CI job.
6. **Merge checks on the code commit, against the live heads.** Quote `git
   merge-tree --write-tree HEAD origin/rebuild/dotnet-platform` and `git
   merge-tree --write-tree HEAD origin/change/GAP-07` after a fresh `git fetch`
   (never with `--depth`), naming both head commits. Run the self-test on a
   `git archive` of each merged tree (expected `# fail 0`; 74 tests with the base
   at `9c2a32b`, 86 with GAP-07 at `e8a8d9d`). If either head has moved, say so
   and check the new one. A conflict in any file is reported before anything else.
7. **Diffs against the merge base.** §5 steps 3 and 4 use
   `origin/rebuild/dotnet-platform...HEAD` (three dots), and step 4 lists only
   the three files in condition 1 plus `docs/changes/semgrep-timeout/`.
8. **Done when 5 is handed over, not dropped.** `implementation.md` keeps
   coverage row 8 as "Moved to PR #44 (GAP-07), after it merges the base", and
   the pull request description repeats it: GAP-07's tester re-runs #44's
   "Semgrep (ERROR fails, WARNING reported)" job three times and records the job
   ids in `docs/changes/GAP-07/test-report.md`. This change does not edit
   GAP-07's files. The coordinator passes this to GAP-07's pipeline.
9. **Commits (B-4).** Subjects prefixed `semgrep-timeout:`, imperative, a body
   that says why (the 5-second default times out on `gate.test.mjs` on the base
   and on #41, #42 and #44), and the attribution trailers. Do not push or open
   the pull request; the orchestrator does that.

## Notes for the tester and gate 2

- §5 step 8: this pull request's Semgrep job must be green with no `type Timeout`
  line, and "Gate self-test" green with the developer's count. Record the base
  commit the CI merge ref used, the job id and the Scan step's duration next to
  base run 42920334740.
- If the Semgrep job times out at 30 seconds on this pull request, that is a
  finding, not a re-run: the value goes back to the owner.

Verdict: APPROVED
