# Test report: semgrep-timeout

## Round 1

Tester and security reviewer, round 1, 11 November 2026. **Commit tested:
`1236536`** (branch `change/semgrep-timeout`, `implementation.md`
`Status: READY FOR TEST`; code head `40b3c3c`, red-test commit `5139bdb`), in a
detached worktree `/home/user/wt-check-sto`. Merge base for every diff:
`cc99e20`. Node v22.23.4 (`/opt/node22/bin/node`), git 2.43.0,
`git rev-parse --is-shallow-repository` → `false`. The tester did not build this
change. Nothing was pushed.

Each commit's suite ran in its own `git archive <sha> | tar -x` copy under
`/tmp/claude-0/-home-user/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sto/`
(below `<scratch>`). Mutations were applied only to scratch copies and never
committed; `git status --short` in the worktree was empty before this report was
written.

Read first, from this checkout: `.claude/agents/tester.md`,
`docs/changes/README.md`, `AGENTS.md`, then `plan.md` (round 2),
`plan-review.md` (round 1 `CHANGES NEEDED`, round 2 `APPROVED`),
`plan-approval.md` (nine conditions) and `implementation.md`. Shape from
`docs/changes/semgrep-error-detail/test-report.md` on the base. Track: G1, Waves
1 to 3; one value of one existing gate's input (G-10), the gate unchanged (P-6).

### 1. Red was red, green on the head

```
$ node --test .github/security/gate.test.mjs        # each in its own archive copy
cc99e20 (merge base)  exit 0   # tests 73  # pass 73  # fail 0
5139bdb (red)         exit 1   # tests 74  # pass 71  # fail 3
40b3c3c (green)       exit 0   # tests 74  # pass 74  # fail 0
1236536 (head)        exit 0   # tests 74  # pass 74  # fail 0
```

At `5139bdb` exactly tests 55, 69 and 70 fail, and nothing else:

```
not ok 55 - the semgrep job and scan script match their golden copies
    0: 'run-semgrep.sh timeout flags are (none); expected --timeout 30'
not ok 69 - workflow-shape mutations are rejected
  error: 'drop-timeout did not change anything'
not ok 70 - the scan's timeout is pinned by its own check, not only the golden copy
  error: |-
    run-semgrep.sh timeout flags are (none); expected --timeout 30
```

These are the reasons plan §5 gives. On the head the log has
`# shape drop-timeout: old new, new caught`, and the same line for
`timeout-unlimited`, `timeout-equals-spelling` and `add-timeout-threshold`.

### 2. Diff scope and conditions

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD
 .github/security/gate.test.mjs                 |  40 +-
 .github/security/run-semgrep.expected.sh       |   2 +
 .github/security/run-semgrep.sh                |   2 +
 docs/changes/semgrep-timeout/implementation.md | 255 ++++++++++++
 docs/changes/semgrep-timeout/plan-approval.md  | 196 ++++++++++
 docs/changes/semgrep-timeout/plan-review.md    | 335 ++++++++++++++++
 docs/changes/semgrep-timeout/plan.md           | 515 +++++++++++++++++++++++++
 7 files changed, 1344 insertions(+), 1 deletion(-)
$ diff .github/security/run-semgrep.sh .github/security/run-semgrep.expected.sh
(no output) exit 0
$ git diff cc99e20 HEAD --quiet -- .github/security/gate.mjs ; echo $?
0
```

- `5139bdb` touches only `gate.test.mjs` (+38/−1); `knownFlags` is unchanged
  there. `40b3c3c` touches `gate.test.mjs` (+1, the `knownFlags` entry) and
  both scripts (+2 each). `1236536` touches only `implementation.md`.
- Each script gains exactly `  --timeout 30 \` directly after the `--output`
  line and one comment line above `set +e`; nothing removed (`cat -A` shows no
  trailing space or CR). The comment contains none of `semgrep scan`, `-o `,
  `|| true`, `SEMGREP_ROOTS` or `--timeout` (grep count 0).
- The only line removed from `gate.test.mjs` is the count `26` → `30`. The new
  test sits directly after "workflow-shape mutations are rejected", not at the
  end of the file.
- Not touched: `gate.mjs`, every workflow, `security.expected.yml`,
  `semgrep-job.expected.yml`, `.semgrepignore`, `known-findings.json`,
  `fail-on-rules.json`. No `--timeout-threshold`, `--max-target-bytes`, `--jobs`
  or `--max-memory` in the scan.
- Commits: subjects prefixed `semgrep-timeout:`, imperative; bodies say why
  (base run 42496209770 and #41, #42 and #44); both trailers on every commit.
- Not pushed: `git ls-remote origin refs/heads/change/semgrep-timeout` → empty;
  `git branch -r --contains 5139bdb` and `… 40b3c3c` → empty.

### 3. P-6: own mutations of the scan scripts

Script `<scratch>/scripts/mutate.mjs`: for each mutation, a fresh copy of the
head's archive, the edit applied to `run-semgrep.sh` and
`run-semgrep.expected.sh` together ("both", the case only the new check can
catch) and then to `run-semgrep.sh` alone ("script"), then
`node --test .github/security/gate.test.mjs`. Every copy was deleted after its
run. Results:

| # | Mutation | Both: exit, failing tests | Script only: exit, failing tests | Message |
|---|---|---|---|---|
| M1 | Drop the flag | 1; 55, 69, 70 | 1; 55, 69, 70 | `timeout flags are (none)` |
| M2 | `--timeout 0` | 1; 55, 69, 70 | 1; 55, 69, 70 | `timeout flags are --timeout 0 \` |
| M3 | `--timeout 3000` | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout 3000 \` |
| M4 | `--timeout 5` (the default) | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout 5 \` |
| M5 | `--timeout=30` | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout=30 \` |
| M6 | `--timeout 30.0` | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout 30.0 \` |
| M7 | Duplicate `--timeout 30` | 1; 55, 70 | 1; 55, 69, 70 | `… --timeout 30 \ --timeout 30 \` |
| M8 | Keep the flag, add `--timeout 0` later | 1; 55, 70 | 1; 55, 70 | `… --timeout 30 \ --timeout 0 \` |
| M9 | Add `--timeout-threshold 0` | 1; 55, 70 | 1; 55, 70 | `… --timeout 30 \ --timeout-threshold 0 \` |
| M10 | Add `--max-target-bytes 1000000` | 1; 55 | 1; 55 | `roots are …` |
| M11 | Add `--interfile-timeout 0` | 1; 55 | 1; 55 | `roots are …` |
| M12 | Add `--jobs 1` | 1; 55 | 1; 55 | `roots are …` |
| M13 | Add `--max-memory 100` | 1; 55 | 1; 55 | `roots are …` |
| M14 | Move the flag into the comment | 1; 55, 69, 70 | 1; 55, 69, 70 | `timeout flags are (none)` |
| M15 | Keep the flag, put `--timeout 30` in the comment | 1; 70 | 1; 55, 70 | test 70: `timeout-unlimited` mutates the comment, not the flag |
| M16 | Flag split over two lines | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout \` |
| M17 | `--timeout  30` (two spaces) | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout  30 \` |
| M18 | Flag moved after the last root | 1; 55, 69, 70 | 1; 55, 69, 70 | `… --timeout 30` |
| M19 | Flag moved before `--metrics=off` | 1; 69 | 1; 55, 69 | see note B |
| M20 | Drop the flag, add `export SEMGREP_TIMEOUT=0` | 1; 55, 69, 70 | 1; 55, 69, 70 | `timeout flags are (none)` |

All 40 runs exit 1. Every change of the value, spelling or count of `--timeout`
(M1 to M9, M14, M16 to M18, M20) is caught by the new check with its own
message, in both copies at once, not only by the golden copy. The neighbouring
limits (M10 to M13) are caught as unknown roots, as on the base. M15 shows the
plan's comment risk is guarded: a `--timeout` in the comment fails test 70.

Note B (not a finding): M19 is a harmless reorder Semgrep would accept; it fails
only because the existing `roots-before-other-args` mutation no longer finds its
text. It weakens nothing.

### 4. The flag on Semgrep 1.180.0, and a Timeout still fails

Local Semgrep
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sgvenv/bin/semgrep`,
on a copy of the head's `gate.test.mjs`, local rules only (registry packs are not
reachable from this container):

```
$ semgrep --version
1.180.0
$ semgrep scan --metrics=off --disable-version-check --quiet --json --timeout 30 --config rule.yml --output out30.json target/gate.test.mjs
exit 0          # rule.yml: pattern console.log(...), WARNING
results 2, errors []
$ semgrep scan … --timeout 30.5 …
Error: Invalid value for '--timeout': '30.5' is not a valid integer.
```

A real Timeout, produced locally with a deliberately slow rule (`slow.yml`: a
`pattern-inside` of three `...`-separated calls with a two-call `pattern`):

```
$ semgrep scan … --timeout 1 --config slow.yml --output slow.json target/gate.test.mjs
real 0m2.5s  exit 0
errors [{"type":"Timeout","level":"warn","path":"target/gate.test.mjs","rule_id":"local-slow"}]
$ semgrep scan … --timeout 30 --config slow.yml --output slow30.json target/gate.test.mjs
real 0m31.7s  exit 0
errors [{"type":"Timeout","level":"warn","rule_id":"local-slow"}]
```

So at 30 seconds a stalled rule is cut off at about 30 seconds, still reported
as `Timeout`, and Semgrep still exits 0 (the `-gt 1` check in `run-semgrep.sh`
does not fire, as plan §3 says). The gate then fails it, from the head's
checkout:

```
$ node .github/security/gate.mjs semgrep <scratch>/sg/slow.json
…/slow.json: semgrep report field type is not a partial parse (error 1 of 1; level warn; type Timeout; path target/gate.test.mjs; rule local-slow)
exit 1
$ node .github/security/gate.mjs semgrep <scratch>/sg/synth.json   # the CI error: Timeout, warn, .github/security/gate.test.mjs, rule …express-cookie-session-no-path
…/synth.json: semgrep report field type is not a partial parse (error 1 of 1; level warn; type Timeout; path .github/security/gate.test.mjs; rule javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path)
exit 1
$ node .github/security/gate.mjs semgrep <scratch>/sg/out30.json   # the clean report
semgrep: 0 finding(s) at the gate's level; 0 known, 0 new. …
exit 0
```

`gate.test.mjs:837-852` (Timeout and four other types at level `warn`) is in the
74 green tests.

### 5. Merges against the live heads

```
$ git fetch origin rebuild/dotnet-platform change/GAP-07      # no --depth
exit 0
$ git rev-parse HEAD origin/rebuild/dotnet-platform origin/change/GAP-07
1236536fc0558722ec719f530db52196857d9e1f
f171f7ad4ac947a9f4a7e93aa1f719f1dbe06240
e8a8d9dcd837e348e8d8036b63dd3244eac9d80d
```

Neither head has moved since the developer's check.

| Merge (`git merge-tree --write-tree`) | Tree | Exit | Self-test on `git archive` of the tree | Merged `run-semgrep.sh` |
|---|---|---|---|---|
| `1236536` + base `f171f7a` | `9a16eb03d0d3fce32e1b3bf8ed3dde8e8d873f04` | 0 | exit 0, `# tests 74`, `# pass 74`, `# fail 0` | line 24 `  --timeout 30 \`; golden identical |
| `1236536` + GAP-07 `e8a8d9d` | `09cc00e34776a373c79cd8a40cd05819e6fba49b` | 0 | exit 0, `# tests 86`, `# pass 86`, `# fail 0` | line 24; golden identical |
| (`1236536` merged with base) + GAP-07 | `32075231acc7fb6571b74291bef343bec43fedf5` | 0 | exit 0, `# tests 86`, `# pass 86`, `# fail 0` | line 24; golden identical |
| `40b3c3c` + base | `815d76fa72554cdc2649712bd76a33403a02de8f` | 0 | (the developer's tree, reproduced) | |
| `40b3c3c` + GAP-07 | `df5be4b99838129d171de051d73ee5be09047128` | 0 | (the developer's tree, reproduced) | |

The third row is the tree #44 gets after the base takes this change. Building it
needed one unreferenced `git commit-tree` object for the first merge; no ref was
created or moved.

### 6. Security

| Check | Command | Exit | Result |
|---|---|---|---|
| gitleaks on this change | `RUNNER_TEMP=<scratch>/rt sh .github/security/run-gitleaks.sh pr-diff <scratch>/rt/pr.json "cc99e20..1236536"` (gitleaks 8.30.1, copied from the scratchpad `sed/gl/` folder) | 0 | `no leaks found`; `pr-diff: 0 finding(s) at the gate's level; 0 known, 0 new.` Same with the CI-style range `origin/rebuild/dotnet-platform..1236536` (8 commits). |
| gitleaks positive control | Same script in a throwaway repo in the scratchpad: one commit adding a JavaScript file with a freshly generated, random, GitHub-token-shaped string (built at run time, never written to this repository, never printed; the repo was deleted afterwards) | 1 | `::error title=New finding (pr-diff)::github-pat in leak.js:1`; `pr-diff: 1 finding(s) at the gate's level; 0 known, 1 new.`; report `Secret` field `REDACTED` |
| Secret patterns in the diff | `git diff cc99e20 HEAD \| grep -cE 'ghp_\|github_pat_\|AKIA\|xox[bp]-\|-----BEGIN\|password\s*='` | 1 | count 0 |
| Semgrep with the registry packs | NOT RUN | | semgrep.dev unreachable here; covered by `security.yml` job "Semgrep (ERROR fails, WARNING reported)" on the pull request |
| npm / .NET audit | NOT RUN | | No package, lockfile or project changed; covered by the `security.yml` audit jobs |
| Routes, roles, host checks, RFC 7807 | Not applicable | | No route changed |

The change's own risk is time, not exposure: a stalled rule now costs up to
about 30 seconds per rule-file pair (measured 31.7 s above) instead of 5, and is
still reported and rejected.

### 7. The CI evidence for #41 and #42

Checked through the GitHub API (read only):

```
$ gh api repos/mohya7/DH-WEBSITE/actions/jobs/130203984103 --jq …
4d45a1fd7a3f6c50d3c6750ff50ad8f98590257e failure Semgrep (ERROR fails, WARNING reported) run 42923444182 attempt 1
$ gh api repos/mohya7/DH-WEBSITE/actions/jobs/130203984103/logs | grep "not a partial parse"
…semgrep report field type is not a partial parse (error 1 of 35; level warn; type Timeout; path .github/security/gate.test.mjs; rule javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path)
$ gh api repos/mohya7/DH-WEBSITE/actions/runs/42923444182/jobs?filter=all --jq …   # Semgrep job, each attempt
130203984103 failure attempt 1
130204601188 success attempt 2
$ gh api repos/mohya7/DH-WEBSITE/actions/jobs/130198029247 --jq …
0c646ea2af0047818de509bd13550f99418c1447 failure Semgrep (ERROR fails, WARNING reported) run 42921690418
  (log: the same Timeout line, error 1 of 35)
```

So #42 (GAP-06) failed the same way on `4d45a1f` and passed on one re-run, and
#41 failed on `0c646ea`. The commit bodies, which name #41, #42 and #44, are
right. `implementation.md` says the developer has no separate evidence for #42;
that is now out of date (finding 1).

### 8. Not run

| Check | Reason | Covered by |
|---|---|---|
| §5 step 8: this PR's "Semgrep (ERROR fails, WARNING reported)" and "Gate self-test" jobs | Not pushed; Actions cannot run here | PR CI. Gate 2 must see the Semgrep job green with no `type Timeout` line, the self-test at 74, and the base commit, job id and Scan step duration recorded next to base run 42920334740. A Timeout at 30 s on this PR is a finding that goes back to the owner, not a re-run (plan-approval notes). |
| §5 step 9: Semgrep on GAP-07's 2,149-line file, three runs | No push allowed for this change | Moved to PR #44 (GAP-07), after it merges the base: GAP-07's tester, in `docs/changes/GAP-07/test-report.md` (condition 8) |
| Registry packs locally | semgrep.dev unreachable | PR CI |
| `dotnet test`, website and Studio suites | No file they use changed | PR CI |

### Findings

1. **Minor (record accuracy, no code change).** `implementation.md`, "Deviations
   and notes", says "the developer has no separate evidence for #42 and quotes
   the condition's wording as given". There is evidence: PR #42 failed Semgrep
   on `4d45a1f`, job 130203984103 (run 42923444182, attempt 1), with
   `type Timeout; path .github/security/gate.test.mjs; rule
   javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path`,
   and passed on attempt 2 (job 130204601188); #41 failed the same way on
   `0c646ea`, job 130198029247 (§7).
   Steps: read `implementation.md` lines 234 to 237, then run the `gh api`
   commands in §7.
   Expected: the record cites #42's job and the re-run that passed.
   Actual: the record says there is no evidence for #42.
   The developer corrects the sentence in `implementation.md` (and may add #42 to
   the evidence list it repeats from plan §2). The commit bodies already name #42
   and are correct, so no commit needs rewriting.

No Blocker or Major.

### Coverage

| Item | Source | Status | Evidence |
|---|---|---|---|
| Base suite green | Plan §2 | Verified | `cc99e20`: 73 / 73, exit 0 (§1) |
| Red at `5139bdb` fails exactly 55, 69, 70, for the planned reasons | Condition 3; B-6, P-4 | Verified | 74 tests, 71 pass, 3 fail (§1) |
| Green and head 74 / 74 with four `shape … new caught` lines | Condition 4 | Verified | `40b3c3c`, `1236536`: exit 0 (§1) |
| Scope: three files plus `docs/changes/semgrep-timeout/` | Conditions 1, 7 | Verified | Three-dot `git diff --stat`; `gate.mjs` unchanged (§2) |
| Flag spelling, place, identical in both scripts; comment free of the forbidden strings | Condition 2 | Verified | Diff, `diff` exit 0, grep count 0 (§2) |
| `run-semgrep.sh` passes `--timeout 30`, nothing else in the scan changes | Done when 1 | Verified | §2 diff: two lines added, none removed |
| The self-test pins the value with its own check | Done when 3; P-6 | Verified | 20 own mutations, both copies and script only: 40 of 40 caught; every `--timeout` edit by the new message (§3) |
| `--timeout 30` accepted by Semgrep 1.180.0 | Plan §5 step 5 | Verified | exit 0, `errors []`; decimals refused (§4) |
| A Timeout still fails the gate | Done when 2; P-6 | Verified | Real local Timeout at `--timeout 1` and at `--timeout 30` (31.7 s); `gate.mjs` exit 1 on it and on the CI-shaped report (§4) |
| Clean merge with base and GAP-07, merged self-tests green | Done when 4; condition 6 | Verified | `9a16eb0` 74 / 74; `09cc00e` 86 / 86; `3207523` 86 / 86; developer's trees reproduced (§5) |
| Done when 5 handed over to #44 | Condition 8 | Verified in the record | `implementation.md` coverage row 8; the PR description is the orchestrator's, not yet written |
| Commits: subjects, bodies, trailers, not pushed | Conditions 4, 9; B-4 | Verified | §2; #42 claim in the bodies confirmed (§7) |
| No secret in the diff | tester.md, security | Verified | gitleaks pr-diff 0 findings, with a positive control caught; pattern grep 0 (§6) |
| Record accurate on the #42 evidence | P-8 | Finding 1 | §7 |
| This PR's Semgrep and self-test jobs in CI | Done when 4; step 8 | NOT RUN | Not pushed; PR CI (§8) |
| Semgrep green on GAP-07's file, three runs | Done when 5 | Moved to PR #44 (GAP-07): GAP-07's tester, `docs/changes/GAP-07/test-report.md` | NOT RUN here (§8) |

Verdict: APPROVED
