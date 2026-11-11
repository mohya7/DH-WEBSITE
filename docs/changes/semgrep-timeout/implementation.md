# Implementation: semgrep-timeout

Developer, 10 November 2026. Branch `change/semgrep-timeout` (cut from
`origin/rebuild/dotnet-platform` at `cc99e20`, not tracking it). Implements
`plan.md` round 2 (`12e8399`) under `plan-approval.md` (`9eb83c1`,
`Verdict: APPROVED`, gate 1, nine conditions). First round. No test report or
delivery approval exists, so there are no findings to answer.

Read first, from this worktree: `.claude/agents/developer.md`,
`docs/changes/README.md` and `AGENTS.md`; then `plan.md`, `plan-review.md` and
`plan-approval.md` in this folder, and
`docs/changes/semgrep-error-detail/implementation.md` for the shape.
`ENGINEERING_STANDARDS.md` is not in this worktree; the plan and approval cite it
by rule id from the reference copy, and nothing here depends on reading it again.

## What changed

| File | Change | Plan Scope row |
| --- | --- | --- |
| `.github/security/gate.test.mjs` | Commit 1: in `semgrepShapeProblems`, after `excludes`, a check that the trimmed scan lines starting with `--timeout` are exactly `["--timeout 30 \\"]`, else `run-semgrep.sh timeout flags are <found or (none)>; expected --timeout 30`. Four `shapeMutations` entries marked `null` (new), after `add-max-target-bytes`: `drop-timeout`, `timeout-unlimited`, `timeout-equals-spelling`, `add-timeout-threshold`; the count assertion goes from 26 to 30. One new test, "the scan's timeout is pinned by its own check, not only the golden copy", directly after "workflow-shape mutations are rejected". Commit 2: `knownFlags` gains `"--timeout 30 \\"`. +39/−1 in all. | Rows 1 and 4 (commit 1), row 4 (commit 2) |
| `.github/security/run-semgrep.sh` | `  --timeout 30 \` directly after the `--output` line; one comment line above `set +e`: `# Each rule gets 30 seconds per file; a Timeout still fails the gate. gate.test.mjs pins the value.` +2. | Row 2 |
| `.github/security/run-semgrep.expected.sh` | The same two lines, byte for byte. +2. | Row 3 |
| `docs/changes/semgrep-timeout/implementation.md` | This file. | Row 5 |

The comment line contains none of `semgrep scan`, `-o `, `|| true`,
`SEMGREP_ROOTS` or `--timeout` (condition 2).

Not touched (condition 1): `gate.mjs`, every workflow, `security.expected.yml`,
`semgrep-job.expected.yml`, `.semgrepignore`, `known-findings.json`,
`fail-on-rules.json`; no `--timeout-threshold`, `--max-target-bytes`, `--jobs` or
`--max-memory` in the scan.

## Commits

```
$ git log --oneline 9eb83c1..HEAD
(this record's commit) semgrep-timeout: Record the implementation
40b3c3c semgrep-timeout: Give each Semgrep rule 30 seconds per file
5139bdb semgrep-timeout: Pin the scan timeout in the self-test (red)
$ git show --stat --format= 5139bdb
 .github/security/gate.test.mjs | 39 ++++++++++++++++++++++++++++++++++++++-
 1 file changed, 38 insertions(+), 1 deletion(-)
$ git show --stat --format= 40b3c3c
 .github/security/gate.test.mjs           | 1 +
 .github/security/run-semgrep.expected.sh | 2 ++
 .github/security/run-semgrep.sh          | 2 ++
 3 files changed, 5 insertions(+)
```

- `5139bdb` red: `gate.test.mjs` only, `knownFlags` unchanged (condition 3).
- `40b3c3c` green: both scripts and `knownFlags` (condition 4).
- A third commit adds this record. The plan's §4 put `implementation.md` in
  commit 2; it is in its own commit so the record can quote commit 2's hash. See
  Deviations.

Nothing was pushed, between the commits or at all (conditions 4 and 9).

## Baseline (plan-approval head `9eb83c1`, before any edit)

```
$ /opt/node22/bin/node --version
v22.23.4
$ /opt/node22/bin/node --test .github/security/gate.test.mjs
# tests 73
# pass 73
# fail 0
exit 0
```

## Red run (at `5139bdb`)

```
$ /opt/node22/bin/node --test .github/security/gate.test.mjs
not ok 55 - the semgrep job and scan script match their golden copies
not ok 69 - workflow-shape mutations are rejected
not ok 70 - the scan's timeout is pinned by its own check, not only the golden copy
1..74
# tests 74
# pass 71
# fail 3
exit 1
```

The failure lines:

- Test 55: `assert.deepEqual(semgrepShapeProblems(workflow, script), [])` gets
  `0: 'run-semgrep.sh timeout flags are (none); expected --timeout 30'`.
- Test 69: `error: 'drop-timeout did not change anything'`.
- Test 70: its first assertion (the unmodified files must give no timeout
  problem) fails with the message `run-semgrep.sh timeout flags are (none);
  expected --timeout 30`.

Exactly the three tests and the totals condition 3 requires. No other test failed.

## Green run (at `40b3c3c`), §5 step 1

```
$ /opt/node22/bin/node --test .github/security/gate.test.mjs
# shape drop-timeout: old new, new caught
# shape timeout-unlimited: old new, new caught
# shape timeout-equals-spelling: old new, new caught
# shape add-timeout-threshold: old new, new caught
1..74
# tests 74
# pass 74
# fail 0
exit 0
```

## §5 steps 2 to 6

Step 2:

```
$ diff .github/security/run-semgrep.sh .github/security/run-semgrep.expected.sh
(no output)
exit 0
```

Step 3:

```
$ git diff origin/rebuild/dotnet-platform...HEAD -- .github/security/run-semgrep.sh
@@ -13,6 +13,7 @@ if [ -z "${RUNNER_TEMP:-}" ]; then
 fi
 export SEMGREP_SEND_METRICS=off
 
+# Each rule gets 30 seconds per file; a Timeout still fails the gate. gate.test.mjs pins the value.
 set +e
 semgrep scan \
@@ -20,6 +21,7 @@ semgrep scan \
   --json \
   --output "$RUNNER_TEMP/semgrep.json" \
+  --timeout 30 \
   --config p/javascript \
exit 0
```

Two lines added, nothing removed.

Step 4 (run at `40b3c3c`, before this file existed; this file's commit adds
`docs/changes/semgrep-timeout/implementation.md` to the list):

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD
 .github/security/gate.test.mjs                |  40 +-
 .github/security/run-semgrep.expected.sh      |   2 +
 .github/security/run-semgrep.sh               |   2 +
 docs/changes/semgrep-timeout/plan-approval.md | 196 ++++++++++
 docs/changes/semgrep-timeout/plan-review.md   | 335 +++++++++++++++++
 docs/changes/semgrep-timeout/plan.md          | 515 ++++++++++++++++++++++++++
 6 files changed, 1089 insertions(+), 1 deletion(-)
exit 0
```

Only the three files in condition 1 plus `docs/changes/semgrep-timeout/`.

Step 5, the flag on the pinned Semgrep, with a local rule (`console.log(...)`,
WARNING) on a copy of this branch's `gate.test.mjs` (the registry packs cannot be
fetched here, plan §2):

```
$ …/sgvenv/bin/semgrep --version
1.180.0
$ …/sgvenv/bin/semgrep scan --metrics=off --disable-version-check --quiet --json --timeout 30 --config …/step5/rule.yml --output …/step5/out.json …/step5/target/gate.test.mjs
exit 0
report: results 2, errors []
```

(`…/sgvenv` is
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sgvenv`;
`…/step5` is
`/tmp/claude-0/-home-user/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/step5`.
Scratch files, not committed.)

Step 6, a Timeout still fails. Report
`{"results":[],"errors":[{"type":"Timeout","level":"warn","path":".github/security/gate.test.mjs","rule_id":"javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path"}]}`:

```
$ /opt/node22/bin/node .github/security/gate.mjs semgrep …/timeout-report.json
…/timeout-report.json: semgrep report field type is not a partial parse (error 1 of 1; level warn; type Timeout; path .github/security/gate.test.mjs; rule javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path)
exit 1
```

`gate.test.mjs:837-852` (the Timeout and four other types) is among the 74 green.

## Merge checks on the code commit (§5 step 7, condition 6)

```
$ git fetch origin rebuild/dotnet-platform change/GAP-07
   9c2a32b..f171f7a  rebuild/dotnet-platform -> origin/rebuild/dotnet-platform
exit 0
$ git rev-parse HEAD origin/rebuild/dotnet-platform origin/change/GAP-07
40b3c3ccc6f3f02906a2bcaf4dbf49528ce8b2b9
f171f7ad4ac947a9f4a7e93aa1f719f1dbe06240
e8a8d9dcd837e348e8d8036b63dd3244eac9d80d
```

**The base has moved** since the approval: `9c2a32b` → `f171f7a` ("GAP-04: Run
the website browser suite in CI, default and consent builds (#43)").
`git diff --stat 9c2a32b origin/rebuild/dotnet-platform -- .github` →
`.github/workflows/ci.yml | 81 +++`, nothing under `.github/security`. GAP-07 is
unchanged at `e8a8d9d`. Checked against the new base head:

| Merge (git 2.43.0) | Tree | Exit | Self-test on `git archive` of the tree | `--timeout` in merged `run-semgrep.sh` |
| --- | --- | --- | --- | --- |
| `40b3c3c` with base `f171f7a` | `815d76fa72554cdc2649712bd76a33403a02de8f` | 0 | `# tests 74`, `# pass 74`, `# fail 0`, exit 0 | line 24, `  --timeout 30 \` |
| `40b3c3c` with GAP-07 `e8a8d9d` | `df5be4b99838129d171de051d73ee5be09047128` | 0 | `# tests 86`, `# pass 86`, `# fail 0`, exit 0 | line 24, `  --timeout 30 \` |

No conflict in any file. The base self-test count is 74, as expected: GAP-04's
`ci.yml` change passes `inlineInterpreterProblems`.

## Not run

| Check | Reason | Covered by |
| --- | --- | --- |
| §5 step 8: this PR's "Semgrep (ERROR fails, WARNING reported)" and "Gate self-test" jobs | GitHub Actions cannot run here; not pushed (condition 9) | PR CI; the tester records the base commit, job id and Scan duration next to run 42920334740 |
| §5 step 9: Semgrep job on GAP-07's 2,149-line file | No scratch-branch push allowed for this change | Moved to PR #44, see coverage row 8 |
| Registry packs (`p/...`) run locally | semgrep.dev is unreachable from this container (plan §2) | PR CI, step 8 |

## Migrations

None.

## Deviations and notes

- **`implementation.md` is a third commit**, not part of commit 2 as plan §4
  lists. The code in commit 2 is exactly §4's; only the record is separate, so it
  can quote commit 2's hash and the merge trees built on it. Allowed by the
  orchestrator's prompt.
- **The base moved** to `f171f7a` after the approval (above); the merge and the
  self-test were run against the new head as condition 6 requires. Nothing in the
  design changes.
- **Commit bodies** name #41, #42 and #44 as condition 9 words it. The plan's §2
  evidence names #40 (failed once, passed on re-run), #41 (job 130198029247), #44
  (job 128779169900) and base run 42496209770. #42 failed the same way too
  (evidence from the tester's round 1 review): job 130203984103 (run
  42923444182, attempt 1, on `4d45a1f`) failed with `type Timeout; path
  .github/security/gate.test.mjs`, and attempt 2 (job 130204601188) passed. The
  commit bodies' wording is therefore correct. An earlier version of this record
  said there was no separate evidence for #42; that was wrong.
- The new test finds each mutation by name in `shapeMutations` and fails with
  `<name> is missing from shapeMutations` if one is removed, in addition to
  §3's three assertions.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `run-semgrep.sh` passes `--timeout 30`, nothing else in the scan changes | Owner, 10 Nov 2026, option 1; Done when 1 | Done locally | `40b3c3c`; step 3 diff: two lines added, none removed |
| `run-semgrep.expected.sh` matches it byte for byte | `semgrepShapeProblems` golden check | Done | Step 2 `diff` no output, exit 0; test 55 green |
| A Timeout still fails the gate | P-6; Done when 2 | Done locally | Step 6 exit 1 with the Timeout line; `gate.mjs` untouched; `gate.test.mjs:837-852` green |
| The self-test pins the value with its own check and four new mutations | Done when 3 | Done locally | Green run: 74/74, four `shape …: old new, new caught` lines; new test 70 green |
| The failing tests were committed red alone before the scripts changed (3 of 74 fail) | B-6, P-4; condition 3 | Done | `5139bdb` (`gate.test.mjs` only): 74 tests, 71 pass, 3 fail, tests 55, 69, 70 |
| Merge of the code commit with GAP-07 is clean and the self-test passes on the merged tree | Done when 4; step 7; condition 6 | Done | `40b3c3c` + `e8a8d9d` → `df5be4b`, exit 0, 86/86; `40b3c3c` + base `f171f7a` → `815d76f`, exit 0, 74/74 |
| Semgrep job green in CI on this PR, base commit recorded, without slowing a normal run | Done when 4; G-10; step 8 | NOT RUN | Not pushed; PR CI, recorded by the tester |
| Semgrep job green on GAP-07's 2,149-line file, three runs | Done when 5; condition 8 | Moved to PR #44 (GAP-07), after it merges the base: GAP-07's tester re-runs #44's "Semgrep (ERROR fails, WARNING reported)" job three times and records the job ids in `docs/changes/GAP-07/test-report.md` | NOT RUN here: no scratch-branch push allowed (§5 step 9). The pull request description must repeat this hand-over |

Status: READY FOR TEST
