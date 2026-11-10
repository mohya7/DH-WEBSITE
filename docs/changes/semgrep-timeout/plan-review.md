# Plan review: semgrep-timeout

## Round 1

Plan reviewer, 10 November 2026. Reviewed `docs/changes/semgrep-timeout/plan.md`
(architect, round 1) on `change/semgrep-timeout` at `40ce802` (cut from
`origin/rebuild/dotnet-platform` at `cc99e20`). Read first, from this worktree:
`.claude/agents/plan-reviewer.md`, `docs/changes/README.md` and `AGENTS.md`;
`ENGINEERING_STANDARDS.md` from
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/ENGINEERING_STANDARDS.md`.
`docs/PROJECT_PROFILE.md` and `docs/quality/refinement-plan-2026-10-28.md` are
not on the base, as the plan says; this change closes no refinement-plan item.
ADR 0001 and the admin audit do not apply (not G2 or G3). Shape follows
`docs/changes/semgrep-error-detail/plan-review.md` on the base. No earlier round
exists.

**The base has moved.** `git fetch origin rebuild/dotnet-platform change/GAP-07
change/GAP-12` → `cc99e20..a866cf6 rebuild/dotnet-platform`. `a866cf6` is
"GAP-12: Remove the Server header from API responses (#40)". `git diff --stat
cc99e20 origin/rebuild/dotnet-platform` lists only `api/src/DigitalHub.Api/Program.cs`,
`api/tests/.../ServerHeaderTests.cs` (122 lines), `docs/changes/GAP-12/*` and
`docs/security-deployment.md`: nothing under `.github/`. `git merge-tree
--write-tree HEAD origin/rebuild/dotnet-platform` → `40b9d06…`, exit 0. So the
move does not touch the design; it only affects the diff commands in §5 (finding 4)
and adds one small file to the `api` root.

To test the design rather than read it, I built §3's self-test changes in a
throwaway copy of the tree (`git archive HEAD` into
`/tmp/claude-0/-home-user/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sim`),
first red (self-test edits only), then green (both scripts and `knownFlags`).
Nothing in the worktree was changed by that. Findings 2 and 6 quote it.

### Findings

**1. Major — §1 Done when 4, §5 step 9, §10 risk row 1, §11 coverage rows 6 to 8:
the plan relies on a scratch-branch CI run that this change may not do, and on a
criterion it cannot deliver.**
Pushing a scratch branch to the remote is not allowed for this change. Step 9
offers that as its first route ("the tester pushes the merge-tree result from
step 7 to a scratch branch `test/semgrep-timeout-gap07`"), and the fallback is
only "if pushing a scratch branch is not allowed". §10's first risk row then
leans on it ("Test plan step 9 runs GAP-07's file three times in CI"), and
coverage row 8 ("Semgrep job green on GAP-07's 2,149-line file, three runs") can
only get evidence from it. Done when 4 ("PR #44 … passes …") depends on #44
merging the base, which is GAP-07's work (§4 says so). Under `AGENTS.md` a section
is done only when every coverage row has evidence, and "moved items name their
destination". As written, rows 6 to 8 can never be filled at delivery.

What would satisfy me:
- Step 9 is written NOT RUN, with the reason ("pushing a scratch branch is not
  allowed for this change") and the covering CI job: #44's "Semgrep (ERROR fails,
  WARNING reported)" job after #44 merges the base. The scratch-branch route is
  removed, not kept as an option.
- Done when 4 and coverage row 8 read "Moved to PR #44 (GAP-07), after it merges
  the base", naming who re-runs that job and how its results are recorded (for
  example in GAP-07's test report). The "three runs" belong there.
- §10 risk row 1 is re-pointed: on this change it is caught by step 8 (this PR's
  own Semgrep job, which scans the base's 1,749-line file that already failed
  on run 42496209770 and on #41's job 130198029247), and step 7's local self-test
  on the merge tree; the 2,149-line file in CI is #44's job.
- Row 6 (merge with GAP-07 clean, its self-test passes) stays on this change: it
  is runnable here (step 7).

**2. Minor — §3 point 4 and §5 "Failing test first": the new test is green
before the fix, so it proves nothing on its own.**
The test asserts that, for each of the four mutations, the problems list holds a
`run-semgrep.sh timeout flags are` line. Before the scripts change, the script
has no `--timeout`, so every mutation's `replace` is a no-op and the unmutated
script already yields `run-semgrep.sh timeout flags are (none); expected
--timeout 30`. On the red prototype:

```
not ok 55 - the semgrep job and scan script match their golden copies
not ok 69 - workflow-shape mutations are rejected
  error: 'drop-timeout did not change anything'
ok 70 - the scan's timeout is pinned by its own check, not only the golden copy
# tests 74
# pass 72
# fail 2
```

(A first red run also failed "the line-ending attributes match their golden
copy" only because my archive left out `.gitattributes`; with it added, that
test passes.) The plan's two expected red failures are right; the third test
it adds is not red, and it would stay green if the check fired for the wrong
reason.

What would satisfy me: the new test first asserts that the unmutated files give
no `timeout flags are` problem, and that each mutation changes the script
(`assert.notEqual(mutated.script, script, name)`), so it is red today and §5
lists it among the expected red failures.

**3. Minor — §3 point 4, §4 and §5 step 7: where the new test goes decides
whether the merge with GAP-07 is clean.**
GAP-07 appends its tests at the end of `gate.test.mjs`
(`git diff 78ee598 origin/change/GAP-07 -- .github/security/gate.test.mjs`, last
hunk `@@ -1747,3 +1843,307 @@`). GAP-01, the other open branch that edits the
file, touches only lines 21 to 552 (hunks `@@ -21,11`, `@@ -210,24`, `@@ -299,7`,
`@@ -488,7`, `@@ -506,7`, `@@ -518,7`). A test appended at the end of the file
would conflict with GAP-07. The plan's "`git merge-tree --write-tree HEAD
e8a8d9d` exits 0 today" is true (I get `f157b89…`, exit 0) but only because the
plan commit changes no code, so it says nothing about the merge after the
developer's commit.

What would satisfy me: §3 names the place, directly after "workflow-shape
mutations are rejected" (`gate.test.mjs:1609-1621`), and §5 step 7 is run on the
developer's code commit against `origin/change/GAP-07` and quoted.

**4. Minor — §5 steps 3 and 4: the diff base is `cc99e20`, which is no longer
the base.**
After the branch takes `a866cf6`, `git diff --stat cc99e20` lists GAP-12's nine
files, and the "only the three files in §4" check fails for a reason unrelated
to the change.

What would satisfy me: both commands diff against the merge base
(`git diff --stat origin/rebuild/dotnet-platform...HEAD`), and step 8 records
which base commit the PR's CI ran on.

**5. Minor — §3 "Worst-case cost": a skip is not reported as Timeout errors for
the skipped rules.**
On Semgrep 1.180.0, with five slow local rules on GAP-07's `gate.test.mjs`
(`-j 1 --timeout 1`):

```
--timeout-threshold 3 → exit 0, errors: Timeout/warn deep-1, deep-2, deep-3
--timeout-threshold 0 → exit 0, errors: Timeout/warn deep-1 … deep-5
--timeout-threshold 1 → exit 0, errors: Timeout/warn deep-1
```

The rules skipped after the threshold leave no `errors` entry. The gate still
fails, because the threshold's own timeouts are reported (`node
.github/security/gate.mjs semgrep …/deep-1-1.json` → `semgrep report field type
is not a partial parse (error 1 of 1; level warn; type Timeout; path target.mjs;
rule deep-1)`, exit 1). So the conclusion holds, but the sentence is wrong. Also
note that Semgrep exits 0 with Timeout errors, so `run-semgrep.sh`'s
`-gt 1` check never fires on a timeout: the gate is the only thing that fails it.

What would satisfy me: the sentence says the threshold's timeouts are reported
and fail the gate, the remaining rules on that file are skipped without an
entry, and Semgrep exits 0, so the gate's rejection is what fails the job.

**6. Minor — §3 "Add one comment line": the comment must not contain
`--timeout` either.**
The mutations use `String.replace`, which changes the first match. The comment
sits above `set +e`, before the scan. If it contained `--timeout 30`,
`timeout-unlimited` and `timeout-equals-spelling` would edit the comment, not
the flag. The golden check would still fail, but the new test from §3 point 4
would not see its own message.

What would satisfy me: §3 adds `--timeout` to the list of strings the comment
must not contain.

**7. Minor — §4 "Change, all in one commit": the red state is not committed.**
§5 quotes the red run in `implementation.md`, but nothing in history can
reproduce it. P-4 is enforced by a "red-test commit before its fix (B-6)", and
the semgrep-error-detail plan was changed for this in its round 2.

What would satisfy me: the self-test edits (the check, four mutations, count 30,
the new test) are committed alone first, with the red run quoted, and the
scripts plus `knownFlags` follow in a second commit.

### Checked and found sound

- **Baseline.** `/opt/node22/bin/node --test .github/security/gate.test.mjs` →
  `# tests 73`, `# pass 73`, `# fail 0`, exit 0. This matches §2.
- **The design works.** On the prototype, after the scripts and `knownFlags`
  change: `# tests 74`, `# pass 74`, `# fail 0`, and the log shows
  `shape drop-timeout: old new, new caught`, and the same for
  `timeout-unlimited`, `timeout-equals-spelling` and `add-timeout-threshold`.
  `diff run-semgrep.sh run-semgrep.expected.sh` was empty on the base (exit 0).
- **`knownFlags` is required.** `gate.test.mjs:1253-1260` is an exact-match set,
  and every other line that is not `--config` or `--exclude` is read as a root;
  the plan is right that the line must be added in the same commit.
- **Mutation count.** `shapeMutations` has 26 entries and line 1612 asserts 26;
  `add-max-target-bytes` already exists. 26 + 4 = 30.
- **Flag behaviour, Semgrep 1.180.0**
  (`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sgvenv/bin/semgrep --version`
  → `1.180.0`), on GAP-07's `gate.test.mjs` with a local rule:
  - `--timeout 30` → exit 0, 1422 results, 0 errors.
  - `--timeout 0` → exit 0, 1422 results, 0 errors (help: "If set to 0 will
    not have time limit").
  - `--timeout 0.001` and `--timeout 30.0` → exit 2, `'… is not a valid
    integer.'`. Integers only, as the plan says, despite the help's `DOUBLE`.
  - `--timeout=30` → exit 0, so the `timeout-equals-spelling` mutation is a
    real alternative spelling.
  - `--timeout-threshold` semantics as in finding 5.
  - The help's ENVIRONMENT section lists only `SEMGREP_BASELINE_COMMIT`,
    `SEMGREP_ENABLE_VERSION_CHECK`, `SEMGREP_FORCE_COLOR`, `SEMGREP_RULES` and
    `SEMGREP_SEND_METRICS`: no environment form for `--timeout`.
- **Merge with GAP-07.** `git merge-base HEAD origin/change/GAP-07` → `78ee598`;
  `git merge-tree --write-tree HEAD origin/change/GAP-07` → `f157b89…`, exit 0.
  GAP-07's diff names none of `knownFlags`, `shapeMutations`,
  `semgrepShapeProblems` or `run-semgrep`, and does not touch `run-semgrep*.sh`.
  GAP-04, GAP-06, GAP-08 and GAP-12 change nothing under `.github/security`.
- **The failure is the base's, not only #44's.** `git diff --stat 78ee598 cc99e20
  -- .github/security` prints nothing, so the same file both failed (run
  42496209770) and passed (run 42920334740) on the base.
- **Gate strength (P-6).** `gate.mjs` does not change; a Timeout still fails at
  any level (`gate.test.mjs:837-852` loops over Timeout and four other types),
  and a real Semgrep Timeout report fed to the gate exits 1 (finding 5). The
  packs, excludes, roots and version pin are unchanged, and the new check
  tightens the shape test.
- **Workflow.** `security.yml` and its golden copies name no scan argument; the
  header comment ("Timeout … fail the job") stays true, so no golden YAML
  changes. `timeout-minutes` as a follow-up is right under B-8.
- **Owner decision.** The quote matches the card option chosen on 10 November
  2026 ("Raise Semgrep's time limit: …"), with "yes" as the owner's words. 30 is
  the card's own example; no further owner decision is needed.
- **Alternatives.** `--timeout 0`, a larger value, re-runs, treating Timeout as a
  parse warning, and splitting or excluding the file are real alternatives, and
  their rejection holds.
- **Scope, security, migrations, rollback.** One value of one existing gate, in
  three files plus the record; no routes, secrets, dependencies or migrations;
  rollback is a revert.

Verdict: CHANGES NEEDED
