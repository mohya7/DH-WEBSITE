# Plan: semgrep-timeout — give each Semgrep rule 30 seconds per file

Architect, round 2, 10 November 2026 (round 1 the same day). Round 2 answers
`plan-review.md` Round 1 (commit `8ece505`); see §12. Change branch
`change/semgrep-timeout`, cut from `origin/rebuild/dotnet-platform` at `cc99e20`.
The base has since moved to `f5dd209` (GAP-12 `a866cf6`, then GAP-08 `f5dd209`);
see §2, "The base has moved".

Files read: `.claude/agents/architect.md`, `docs/changes/README.md` and
`AGENTS.md` from this worktree. `ENGINEERING_STANDARDS.md` is not on the base
branch; it was read from
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/ENGINEERING_STANDARDS.md`
and is cited by rule id. `docs/PROJECT_PROFILE.md` and
`docs/quality/refinement-plan-2026-10-28.md` are not on the base branch and were
not read; nothing in this plan depends on them. ADR 0001 and the admin audit do
not apply (not G2 or G3). The plan's shape follows
`docs/changes/semgrep-error-detail/plan.md` and `docs/changes/ci-runner-pin/plan.md`.
Round 2 is a revision: `plan-review.md` Round 1 was read and each of its seven
findings is answered in §12. No plan-approval or implementation file exists.

## 1. Item

- **What it closes.** A CI defect, not a refinement-plan item. The Semgrep job
  runs with Semgrep's default per-rule, per-file time limit (5 seconds). One rule
  on `.github/security/gate.test.mjs`, the longest scanned file, sometimes needs
  longer. The gate then rejects the `Timeout` error, correctly, and the job fails.
- **Owner's words.** "yes" (Mohamed Elbadry, 10 November 2026, project
  timeline). This answered the card "Fix #44's Semgrep timeout on the long
  security test file how?" by choosing option 1: "Raise Semgrep's time limit: A
  small change gives Semgrep more time per file (e.g. 30s instead of 5s). Nothing
  is skipped; the scan may run a little longer." Splitting the file and excluding
  it were the other options, and were not chosen.
- **Track.** **G1, Waves 1 to 3 (gates and API)**, because it changes the input
  of an existing gate (G-10, Static security analysis). It adds no gate and
  closes no GAP id.
- **Done when** (from the owner-approved card, since the refinement plan has no
  entry for this):
  1. `run-semgrep.sh` runs Semgrep with `--timeout 30`, and nothing else in the
     scan changes: same packs, excludes, roots, version and gate.
  2. A `Timeout` error still fails the gate (P-6).
  3. The gate self-test pins the value, so it cannot be changed or dropped
     without a failing test that names it.
  4. This pull request's own "Semgrep (ERROR fails, WARNING reported)" job is
     green on the base's `gate.test.mjs`, the same file that timed out on base
     run 42496209770 and on #41's job 130198029247. The merge of this branch's
     code commit with `origin/change/GAP-07` is clean, and the self-test passes
     on the merged tree.
  5. **Moved to PR #44 (GAP-07), after it merges the base:** #44's
     "Semgrep (ERROR fails, WARNING reported)" job is green on the 2,149-line
     file. This change cannot run that job (§5 step 9). Who and how: GAP-07's
     tester re-runs #44's Semgrep job three times after #44 merges the base,
     and records the three job ids and results in
     `docs/changes/GAP-07/test-report.md`.

## 2. Current state

**The failure.** PR #44, branch `origin/change/GAP-07`, head `e8a8d9d`, Security
job "Semgrep (ERROR fails, WARNING reported)", job 128779169900:

```
semgrep report field type is not a partial parse (error 1 of 36; level warn; type Timeout; path .github/security/gate.test.mjs; rule javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path)
```

The message format comes from `gate.mjs:401` (`describeSemgrepError`, added by
semgrep-error-detail). The rejection itself is `gate.mjs:422`:
`if (!isPartialParse(error.type)) reject(...)`.

**It is not only #44** (evidence relayed by the coordinator, 10 November 2026):

- PR #40 failed once the same way earlier and passed on re-run.
- PR #41 (GAP-08), which does not touch `.github/security`, failed on `0c646ea`,
  job 130198029247, with the same `type Timeout; path
  .github/security/gate.test.mjs; rule
  javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path`.
- The base branch's own push run for `78ee598` (run 42496209770) failed. The
  latest base push run, `cc99e20` (run 42920334740), passed.
- `git diff --stat 78ee598 HEAD -- .github/security` prints nothing: the base's
  `gate.test.mjs` has not changed between the failing and the passing base run.
  So the same 1,749-line file both passes and times out depending on the runner.
  The base itself sits on the 5-second edge, and every open pull request can
  fail on it.

**File sizes** (`wc -l`, `wc -c`):

| File | Lines | Bytes |
| --- | --- | --- |
| `gate.test.mjs` at `cc99e20` (base) | 1,749 | 82,820 |
| `gate.test.mjs` at `e8a8d9d` (GAP-07) | 2,149 | 103,041 |

The largest scanned file on the base is
`api/tools/DigitalHub.ContentImport/ContentWriter.cs`, 82,931 bytes (a `find`
over the scan roots minus the excludes, sorted by `wc -c`).

**The scan.** `.github/security/run-semgrep.sh` (identical to
`run-semgrep.expected.sh`) runs one `semgrep scan` with `--metrics=off`,
`--disable-version-check`, `--quiet`, `--json`, `--output
"$RUNNER_TEMP/semgrep.json"`, five `--config` packs, ten `--exclude`s and 22
roots. It passes no `--timeout`, `--timeout-threshold`, `--max-target-bytes`,
`--jobs` or `--max-memory`, so all take Semgrep's defaults. It exits on a
Semgrep code above 1 and then runs `node .github/security/gate.mjs semgrep`.

**Semgrep 1.180.0's flags**
(`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sgvenv/bin/semgrep --version`
→ `1.180.0`; `semgrep scan --help`, exit 0):

```
--timeout=DOUBLE (absent=5.)
    Maximum time to spend running a rule on a single file in seconds.
    If set to 0 will not have time limit. Defaults to 5.0 s.
--timeout-threshold=INT (absent=3)
    Maximum number of rules that can time out on a file before the
    file is skipped. If set to 0 will not have limit. Defaults to 3.
--max-target-bytes=VALUE (absent=1000000)
    Maximum size for a file to be scanned by Semgrep, e.g '1.5MB'. Any
    input program larger than this will be ignored. ...
-j VALUE, --jobs=VALUE (absent=3)
--interfile-timeout=INT (absent=0)   (interfile analysis only; not used here)
```

The help says DOUBLE, but the CLI front end accepts integers only. Run here on a
copy of GAP-07's file with a local rule (`--config rule.yml`, no network):
`--timeout 30` → exit 0, 959 results, 0 errors; `--timeout 0.001` →
`Error: Invalid value for '--timeout': '0.001' is not a valid integer.`, exit 2.
So the value must be a whole number. `--timeout` has no environment-variable
form (the help lists none, unlike `--config`/`SEMGREP_RULES`).

**Local timing of the failing rule: NOT RUN.** Fetching
`r/javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path`
from semgrep.dev fails here: `ProxyError ... semgrep.dev ... Tunnel connection
failed: 403 Forbidden`. The rule's real time on the CI runner is measured only by
the CI job (see §5).

**Where the scan's arguments are pinned.**

1. `run-semgrep.expected.sh` must equal `run-semgrep.sh` line for line
   (`gate.test.mjs` `semgrepShapeProblems` → `goldenDifference("run-semgrep.sh", …)`).
2. `semgrepShapeProblems` (`gate.test.mjs:1197-1268`) splits the scan into
   `--config` lines, `--exclude` lines, an exact-match `knownFlags` set
   (`gate.test.mjs:1253-1260`) and everything else, which it treats as **roots**
   and compares with `requiredRoots`. A new `--timeout 30 \` line that is not in
   `knownFlags` would be read as a root and fail with `roots are …`. So
   `knownFlags` must change in the same commit.
3. `shapeMutations` (`gate.test.mjs:1463`, the "workflow-shape mutations are rejected"
   test) asserts `shapeMutations.length === 26`. It already has an
   `add-max-target-bytes` mutation.
4. `security.yml`, `security.expected.yml` and `semgrep-job.expected.yml` do not
   name any scan argument; the job calls `bash .github/security/run-semgrep.sh`.
   `grep -n "timeout" .github/workflows/security.yml` finds nothing: the job has
   no `timeout-minutes`, so GitHub's default of 360 minutes bounds it.
   `diff .github/workflows/security.yml .github/security/security.expected.yml`
   → identical.
5. `gate.test.mjs:837-852` already proves a `Timeout` (and four other error
   types) at level `warn` fails the gate.

**Baseline self-test**, run here: `/opt/node22/bin/node --test
.github/security/gate.test.mjs` → `# tests 73`, `# pass 73`, `# fail 0`, exit 0.

**Merge with GAP-07.** `git merge-base HEAD e8a8d9d` → `78ee598`. GAP-07 changes
`gate.mjs`, `gate.test.mjs` (+428 lines), `run-npm-audit*.sh`, `security.yml` and
`security.expected.yml`. Its `gate.test.mjs` diff touches none of `knownFlags`,
`semgrepShapeProblems` or `shapeMutations.length` (`git diff 78ee598 e8a8d9d --
.github/security/gate.test.mjs | grep -E
"knownFlags|shapeMutations.length|semgrepShapeProblems|--output|run-semgrep"`
prints nothing), and it does not touch `run-semgrep*.sh`.
`git merge-tree --write-tree HEAD e8a8d9d` exits 0 today, but that only
shows the plan commit merges: it changes no code. What matters is the merge
after the developer's code commit (§5 step 7). GAP-07 appends its new tests at
the end of `gate.test.mjs` (last hunk `@@ -1747,3 +1843,307 @@`, per the
review), so a test this change appended at the end would conflict. §3 therefore
fixes where the new test goes.

**The base has moved.** `git fetch origin rebuild/dotnet-platform` →
`origin/rebuild/dotnet-platform` is `f5dd209` ("GAP-08: Lint every workflow with
actionlint (#41)"), after `a866cf6` (GAP-12, #40). `git diff --stat cc99e20
origin/rebuild/dotnet-platform -- .github` lists only `.github/lint/*` and
`.github/workflows/workflow-lint.yml`: nothing under `.github/security`, and no
change to `security.yml`. actionlint's shellcheck reads inline `run:` blocks, not
`run-semgrep.sh`, and this change edits no workflow. `git merge-tree --write-tree
HEAD origin/rebuild/dotnet-platform` → exit 0. The self-test on a `git archive
f5dd209` copy → `# tests 73`, `# pass 73`, `# fail 0`. So the design stands;
only the diff commands in §5 change to use the merge base. `inlineInterpreterProblems`
now also reads `workflow-lint.yml`, and passes on `f5dd209`.

## 3. Design

Add one line to the scan, in both `run-semgrep.sh` and `run-semgrep.expected.sh`,
directly after the `--output` line:

```
  --output "$RUNNER_TEMP/semgrep.json" \
  --timeout 30 \
  --config p/javascript \
```

Add one comment line above `set +e` in both files, saying why: the limit is per
rule per file, a Timeout still fails the gate, and the value is pinned by
`gate.test.mjs`. For example: `# Each rule gets 30 seconds per file; a Timeout
still fails the gate. gate.test.mjs pins the value.` The comment must not
contain the text `semgrep scan`, `-o `, `|| true` or `SEMGREP_ROOTS`, because
`semgrepShapeProblems` counts or forbids those strings anywhere in the script.
It must not contain `--timeout` either: the mutations use `String.replace`,
which changes the first match, and the comment sits before the scan, so a
`--timeout 30` in the comment would be mutated in place of the flag.

**Why 30.**

- It is the owner's example on the card, and six times the default.
- The base's 1,749-line file already sits at about 5 seconds on some runners and
  under it on others (§2). GAP-07's file is 23% longer in lines and 24% larger in
  bytes. Even if the rule's time grew with the square of the file size, 1.24² ≈
  1.54, so about 8 seconds. 30 seconds leaves more than three times that margin
  for slower runners and for the test file to keep growing, without hiding a rule
  that has really stalled.
- A larger value buys little more margin and lets a stuck rule hold a worker
  longer. `0` (no limit) is rejected: a pathological rule could then run until
  GitHub's 360-minute job limit, and the job would not report which rule hung.

**Worst-case cost.** A Timeout costs at most 30 seconds per rule-file pair, and
`--timeout-threshold` (default 3) skips a file after three rules time out on it,
so one file costs at most about 90 seconds of extra time before it is skipped,
across 3 parallel workers (`--jobs` default 3). The three timeouts that reach the
threshold are each reported as an `errors` entry with `type Timeout`, level
`warn`. The rules Semgrep then skips on that file leave no entry. Semgrep exits
0 in this case, so `run-semgrep.sh`'s `-gt 1` exit check does not fire: the
gate's rejection of the reported `Timeout` entries is what fails the job (the
review ran this on 1.180.0 with five slow local rules and `--timeout 1`; see
`plan-review.md` finding 5). A normal run, where no rule reaches 5 seconds, takes
the same time as today.

**`--timeout-threshold`: leave at the default (3).** It decides how many
timeouts on one file Semgrep reports before it skips the rest of the rules on
that file. At least one timeout is always reported (any threshold from 1 up, and
0 reports all), and the gate rejects any `Timeout` entry, so the threshold never
turns a timeout into a pass. The skipped rules are unreported, but the file has
already failed the gate. Setting it to `0` would only make a bad file cost more
time. Not passing it keeps the change to one value.

**`--max-target-bytes`: leave at the default (1,000,000).** The largest scanned
file is 82,931 bytes, and GAP-07's `gate.test.mjs` is 103,041, both about a tenth
of the limit. Raising it would change nothing today; lowering it would skip
files. The existing `add-max-target-bytes` mutation keeps it out.

**How the gate stays as strong (P-6).** `gate.mjs` does not change. A `Timeout`
at any level still fails (`gate.mjs:422`, `gate.test.mjs:837-852`). The packs,
excludes, roots, version pin, `--quiet`/`--json`/`--output` and the exit-code
check do not change. The only effect is that a rule must now take more than 30
seconds, not 5, before Semgrep gives up and the gate fails. No file is excluded
and no rule is skipped.

**How the self-test pins the value.**

1. Add `"--timeout 30 \\"` to `knownFlags`, so the line is a known flag and not a
   root.
2. Add an explicit check in `semgrepShapeProblems`, after `scanLines` is built:
   the trimmed scan lines that start with `--timeout` must be exactly
   `["--timeout 30 \\"]`, or it pushes
   `run-semgrep.sh timeout flags are <found, space-joined, or (none)>; expected --timeout 30`.
   This one rule catches a dropped `--timeout`, another value (`--timeout 0`,
   `--timeout 5`), the `--timeout=30` spelling, a second `--timeout`, and any
   `--timeout-threshold`. Without it, editing the script and its golden copy
   together would fail only as a misleading `roots are …`, or, for a removed
   line, not at all.
3. Add four entries to `shapeMutations` (marked `null`, "new"), raising the count
   assertion from 26 to 30:
   - `drop-timeout`: removes `  --timeout 30 \\\n`.
   - `timeout-unlimited`: `--timeout 30` → `--timeout 0`.
   - `timeout-equals-spelling`: `--timeout 30` → `--timeout=30`.
   - `add-timeout-threshold`: inserts `  --timeout-threshold 0 \\\n` after the
     `--timeout 30` line.
4. Add one test, "the scan's timeout is pinned by its own check, not only the
   golden copy", placed directly after "workflow-shape mutations are rejected"
   (`gate.test.mjs:1609-1621` on the base), never at the end of the file, where
   GAP-07 appends its tests. The test:
   - asserts that the unmodified `security.yml` and `run-semgrep.sh` give no
     problem starting with `run-semgrep.sh timeout flags are`;
   - for each of the four mutations, asserts `assert.notEqual(mutated.script,
     script, name)`, so a mutation that finds nothing to change fails the test;
   - asserts that each mutation's problems list contains a string starting with
     `run-semgrep.sh timeout flags are`.
   This makes the test red before the scripts change (the unmodified script
   gives `timeout flags are (none)`, and the mutations change nothing), and it
   proves the check works on its own, since the golden comparison already fails
   for any one-sided edit.

**Alternatives rejected.**

- *Split `gate.test.mjs`, or exclude it from the scan.* Rejected by the owner
  (the other two options on the card). Excluding it would also leave a scanned
  root unscanned.
- *`--timeout 0` (no limit).* Rejected above: a stalled rule would run to the
  360-minute job limit.
- *Add `timeout-minutes` to the Semgrep job.* It would bound the job, but it
  changes `security.yml`, `security.expected.yml` and
  `semgrep-job.expected.yml`, a second topic (B-8). Listed as a follow-up.
- *Treat `Timeout` at level `warn` as a parse warning.* Weakens the gate (P-6).
- *Re-run failed jobs until green.* Hides a real limit, and the base itself
  fails.
- *A larger value such as 60 or 120.* No evidence that 30 is short, and a larger
  value only lengthens a real stall. Revisit with the job's timing if a Timeout
  ever recurs at 30 (follow-up).

## 4. Scope

**Change, in two commits (B-6, red-test commit before its fix):**

| Commit | File | Change |
| --- | --- | --- |
| 1, red: `semgrep-timeout: Pin the scan timeout in the self-test (red)` | `.github/security/gate.test.mjs` | `semgrepShapeProblems` gains the timeout check; `shapeMutations` gains four entries and the count becomes 30; one new test as in §3 point 4, after "workflow-shape mutations are rejected". `knownFlags` is **not** changed yet. |
| 2, green: `semgrep-timeout: Give each Semgrep rule 30 seconds per file` | `.github/security/run-semgrep.sh` | Add `  --timeout 30 \` after the `--output` line; add the one-line comment above `set +e`. |
| 2 | `.github/security/run-semgrep.expected.sh` | The same two edits, byte for byte. |
| 2 | `.github/security/gate.test.mjs` | `knownFlags` gains `"--timeout 30 \\"`. |
| 2 | `docs/changes/semgrep-timeout/implementation.md` | Developer's record, quoting the red run of commit 1 and the green run of commit 2. |

Commit 1 alone leaves the self-test red. That is intended and is recorded; the
pull request is only opened with both commits.

**Out of scope, deliberately left alone:**

- `gate.mjs`: the Timeout rejection stays exactly as it is.
- `security.yml`, `security.expected.yml`, `semgrep-job.expected.yml`: no
  argument lives there, and a `timeout-minutes` is a separate change.
- `--timeout-threshold`, `--max-target-bytes`, `--jobs`, `--max-memory`: stay at
  their defaults, for the reasons in §3.
- `.semgrepignore`, `known-findings.json`, `fail-on-rules.json`: unchanged.
- PR #44's own branch: this change lands on the base; #44 picks it up by merging
  the base, which is GAP-07's work, not this change's.

## 5. Test plan

**Failing test first, committed alone (commit 1, §4).** Before touching the
scripts, the developer adds the timeout check, the four mutations, the count 30
and the new test (after "workflow-shape mutations are rejected") to
`gate.test.mjs`, leaves `knownFlags` as it is, runs:

```
/opt/node22/bin/node --test .github/security/gate.test.mjs
```

and commits that state alone. Expected red, three tests, quoted in
`implementation.md` with the commit hash:

- "the semgrep job and scan script match their golden copies" fails with
  `run-semgrep.sh timeout flags are (none); expected --timeout 30`;
- "workflow-shape mutations are rejected" fails with `drop-timeout did not
  change anything` (the line is not there yet to remove);
- "the scan's timeout is pinned by its own check, not only the golden copy"
  fails on its first assertion, because the unmodified script already gives
  `timeout flags are (none)`.

Expected totals: `# tests 74`, `# pass 71`, `# fail 3`. Any other failing test
means the red commit is wrong and is fixed before going on. Then, in commit 2,
the developer edits both scripts and adds `knownFlags`, and the same command
must give `# tests 74`, `# pass 74`, `# fail 0`.

**Afterwards, run and quote:**

1. `/opt/node22/bin/node --test .github/security/gate.test.mjs` → all pass, and
   the log shows `shape drop-timeout: old new, new caught`, and the same for the
   other three new mutations.
2. `diff .github/security/run-semgrep.sh .github/security/run-semgrep.expected.sh`
   → no output, exit 0.
3. `git diff origin/rebuild/dotnet-platform...HEAD -- .github/security/run-semgrep.sh`
   (three dots: against the merge base, so later base commits such as
   `a866cf6` and `f5dd209` do not show) → exactly the two added lines (the flag
   and the comment), nothing removed.
4. `git diff --stat origin/rebuild/dotnet-platform...HEAD` → only the three files
   in §4 plus `docs/changes/semgrep-timeout/`.
5. The flag parses on the pinned Semgrep: with the local
   `/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sgvenv/bin/semgrep`,
   `semgrep scan --metrics=off --disable-version-check --quiet --json --timeout 30 --config <local rule.yml> --output <tmp>.json <copy of gate.test.mjs>`
   → exit 0 or 1, and the report's `errors` is `[]`. (The registry packs are not
   reachable from the container; see §2.)
6. A Timeout still fails: feed `gate.mjs semgrep` a report whose only error is
   `{ "type": "Timeout", "level": "warn", "path": ".github/security/gate.test.mjs", "rule_id": "javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path" }`
   → exit 1 and the same `type is not a partial parse (… type Timeout …)` line.
   (Also covered by `gate.test.mjs:837-852`.)

**Proof on this change, and what moves to #44** (tester):

7. On the developer's code commit (commit 2, not the plan commit):
   `git merge-tree --write-tree HEAD origin/change/GAP-07` → exit 0, no
   conflicts; quote the tree id. Extract that tree into a scratch directory
   (`git archive <tree> | tar -x -C <scratch>`) and run
   `/opt/node22/bin/node --test .github/security/gate.test.mjs` there: `# fail
   0`, and `git show <tree>:.github/security/run-semgrep.sh` contains
   `--timeout 30`. Also quote `git merge-tree --write-tree HEAD
   origin/rebuild/dotnet-platform` → exit 0, with the base commit id.
8. CI on this pull request: Security job "Semgrep (ERROR fails, WARNING
   reported)" green, with no `type Timeout` line in the log, and "Gate
   self-test" green. Record the base commit the PR's CI merged with (the
   `pull_request` merge ref's parent), the job id, and the Scan step's duration
   next to the last green base run (42920334740), to show a normal run did not
   slow down. This job scans the base's 1,749-line `gate.test.mjs`, the file that
   timed out on base run 42496209770 and on #41's job 130198029247.
9. CI with GAP-07's 2,149-line file: **NOT RUN on this change.** Reason:
   pushing a scratch branch is not allowed for this change, and #44's branch
   belongs to GAP-07. Covered by: #44's "Semgrep (ERROR fails, WARNING
   reported)" job after #44 merges the base. Moved to PR #44 (Done when 5): GAP-07's
   tester re-runs that job three times, because the old failure was
   intermittent, and records the three job ids and results in
   `docs/changes/GAP-07/test-report.md`.

**Track checklist, G1 Waves 1 to 3:**

- One gate per pull request (B-8): one value of one existing gate; no new gate.
- A new gate reports for seven days: not applicable, no new gate.
- Canary fixture the gate must reject (GAP-21): the existing Timeout fixtures
  (`gate.test.mjs:837-852`) stay and must still pass; the four new mutations are
  canaries for the scan's shape.
- Actions pinned by SHA, image by digest, Node and .NET exact: unchanged here
  (GAP-09 is separate); Semgrep stays `==1.180.0`.
- Baselines only shrink: `known-findings.json` unchanged.

## 6. Security impact

- Routes, policies, data, logins, secrets: none; the change is CI only.
- Dependencies: none added; Semgrep stays 1.180.0.
- The gate: the same files and the same rules are scanned, and a Timeout still
  fails. The change makes a false failure on a slow runner less likely; it does
  not let a timed-out file pass. The only new exposure is time: a stalled rule
  can now cost up to 30 seconds per file instead of 5, bounded as in §3.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. The scripts and the self-test return to the 5-second
default together, and the intermittent Timeout returns with them.

## 9. Owner decisions needed

None. The owner chose option 1 (§1). The value 30 is the card's own example; if
the reviewer wants another value, that is a question for the owner (would be
O-n), not a choice for this plan.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| 30 seconds is still too short on a slow runner. | On this change: step 8, this PR's own Semgrep job, on the base's 1,749-line file that already timed out twice (run 42496209770, job 130198029247), and step 7's self-test on the merged tree. The 2,149-line file in CI is #44's job, three runs (Done when 5). If a Timeout recurs, the gate still fails loudly, naming the rule and file (semgrep-error-detail), and the follow-up below applies. |
| A rule genuinely hangs and the scan takes much longer. | Bounded at 30 s per rule-file pair and three per file (§3); the job's duration is quoted in step 8. |
| The comment line trips a shape check (`semgrep scan`, `-o `, `|| true`), or holds `--timeout` and draws the mutations away from the flag. | The self-test in step 1 and the new test's per-mutation message check; §3 lists the forbidden strings, `--timeout` among them. |
| The new test is green for the wrong reason. | It is red in commit 1 (three failures expected, §5), and it asserts the unmodified files give no timeout problem and every mutation changes the script. |
| The flag is read as a root because `knownFlags` was not updated. | The golden test fails with `roots are …` (step 1). |
| Someone later edits the value in both copies. | The new timeout check fails with its own message (§3 point 2, new test). |
| `--timeout` given a decimal fails at Semgrep start. | The value is an integer; step 5 runs it on 1.180.0. |
| Merge conflict with GAP-07 in `gate.test.mjs`. | The new test goes after "workflow-shape mutations are rejected", not at the end where GAP-07 appends; step 7 runs `git merge-tree` on the code commit. |
| The base moves again before merge. | Steps 3 and 4 diff against the merge base; step 7 re-runs `git merge-tree` against the current base; step 8 records the base commit CI used. |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `run-semgrep.sh` passes `--timeout 30`, nothing else in the scan changes | Owner, 10 Nov 2026, option 1; Done when 1 | Planned | |
| `run-semgrep.expected.sh` matches it byte for byte | `semgrepShapeProblems` golden check | Planned | |
| A Timeout still fails the gate | P-6; Done when 2 | Planned | |
| The self-test pins the value with its own check and four new mutations | Done when 3 | Planned | |
| The failing tests were committed red alone before the scripts changed (3 of 74 fail) | B-6, P-4; `docs/changes/README.md`, P-8 | Planned | |
| Merge of the code commit with GAP-07 is clean and the self-test passes on the merged tree | Done when 4; step 7 | Planned | |
| Semgrep job green in CI on this PR, base commit recorded, without slowing a normal run | Done when 4; G-10; step 8 | Planned | |
| Semgrep job green on GAP-07's 2,149-line file, three runs | Done when 5 | Moved to PR #44 (GAP-07), after it merges the base: GAP-07's tester, in `docs/changes/GAP-07/test-report.md` | NOT RUN here: no scratch-branch push allowed (§5 step 9) |

## 12. Revision log

**Round 1:** first version.

**Round 2**, answering `plan-review.md` Round 1 (`8ece505`):

1. **Major, scratch-branch CI.** Step 9 is now NOT RUN, with the reason (no
   scratch-branch push allowed) and the covering job (#44's Semgrep job after #44
   merges the base); the scratch-branch route is removed. The old Done when 4 is
   split: Done when 4 is this PR's own job plus the merge-tree check (runnable
   here), and Done when 5 and coverage row 8 are "Moved to PR #44", naming
   GAP-07's tester, three re-runs, and `docs/changes/GAP-07/test-report.md`.
   §10 risk row 1 now points to step 8 (the base's 1,749-line file, which timed
   out on run 42496209770 and job 130198029247) and step 7. Coverage row 6
   stays here.
2. **Minor, new test green before the fix.** §3 point 4 now has the test assert
   that the unmodified files give no `timeout flags are` problem and that each
   mutation changes the script (`assert.notEqual`). §5 lists it as the third
   expected red failure (`# pass 71`, `# fail 3`).
3. **Minor, test placement.** §3 point 4 and §4 place the new test directly after
   "workflow-shape mutations are rejected" (`gate.test.mjs:1609-1621`), not at
   the end where GAP-07 appends. §5 step 7 runs `git merge-tree` on the code
   commit against `origin/change/GAP-07` and quotes it; §2 says why the
   plan-commit merge proves nothing.
4. **Minor, diff base.** §5 steps 3 and 4 diff against the merge base
   (`origin/rebuild/dotnet-platform...HEAD`). Step 8 records the base commit CI
   used. §2 records the base's move to `a866cf6` and then `f5dd209` (GAP-08),
   with evidence that neither touches `.github/security` and the self-test is
   73 of 73 on `f5dd209`.
5. **Minor, timeout-threshold wording.** §3 now says the threshold's timeouts are
   reported and fail the gate, the remaining rules on that file are skipped
   without an entry, and Semgrep exits 0, so the gate's rejection, not
   `run-semgrep.sh`'s exit check, fails the job.
6. **Minor, comment text.** §3 adds `--timeout` to the strings the comment must
   not contain, with the reason (`String.replace` hits the first match), and
   gives an example comment.
7. **Minor, red state not committed.** §4 splits the work into commit 1 (the
   self-test edits alone, red) and commit 2 (both scripts, `knownFlags`,
   `implementation.md`). §5 quotes the red run with commit 1's hash.

## Follow-ups (not in this change)

- Add `timeout-minutes` to the Semgrep job in `security.yml` and both golden
  copies, so the job has a bound below GitHub's 360-minute default. Its own
  change (B-8).
- If a Timeout recurs at 30 seconds, measure the rule's real time with a one-off
  `--time` CI run, if and where the owner allows one, before choosing a new
  value, and ask the owner.
- `gate.test.mjs` keeps growing with each gate; splitting it by gate would make
  each file cheaper to scan. The owner did not choose this for the fix; it may
  still be worth doing for readability later, as its own change.
