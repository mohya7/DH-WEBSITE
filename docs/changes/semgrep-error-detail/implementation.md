# Implementation: semgrep-error-detail

Developer, 8 November 2026. Branch `change/semgrep-error-detail` (cut from
`origin/rebuild/dotnet-platform` at `5c38406`, not tracking it). Implements
`plan.md` round 2 (`6e038e3`) under `plan-approval.md` (`444d178`,
`Verdict: APPROVED`, gate 1, nine conditions). First round. No test report or
delivery approval exists, so there are no findings to answer.

Read first, from the reference copy at
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`
(none of these is on the base yet): `.claude/agents/developer.md`,
`docs/changes/README.md`, `AGENTS.md` and `ENGINEERING_STANDARDS.md`. Then
`plan.md`, `plan-review.md` and `plan-approval.md` in this folder, and
`docs/changes/ci-runner-pin/implementation.md` on the base for the shape.

What this change delivers, in the words condition 7 requires: **type, path and
rule printed; keeping the report moved to F2, pending O-1.** The owner's card is
not fully delivered until O-1 is answered.

## What changed

| File | Change | Plan Scope row |
| --- | --- | --- |
| `.github/security/gate.mjs` | Header: four comment lines after "are not read." (old line 23) say how a rejected error is described and that `rule_id` is read only for that and is not a consumed field. Directly above `isPartialParse`: three pattern constants (`semgrepTagPattern`, `semgrepPathPattern`, `semgrepRulePattern`), `shown(value, pattern)` and `describeSemgrepError(error, index, count)`; none exported. `validateSemgrep`: the errors loop is now `for (let index = 0; index < report.errors.length; index += 1)` with `const error = report.errors[index]` (no array method); the not-an-object rejection appends `` ` (error ${index + 1} of ${report.errors.length})` ``; the level, path-missing and type rejections append `describeSemgrepError(...)`, built inside the template literal of the `reject` call, so only after the check has failed. Nothing else: the `results` loop, line 433 (now 462), `consumedFields` and `reject` are untouched. +35/−6. | Row 1 |
| `.github/security/gate.test.mjs` | `withoutDetail(out)` directly above `const mutationCounts = {}` (line 510). The two `\b<field>\b` assertions in "mutations of every consumed field", at lines **549 and 561** (not 548 and 559, see corrections), now match `withoutDetail(result.out)` and `withoutDetail(removedResult.out)`. Tests N1 to N10, with two helpers (`semgrepErrorRun`, `semgrepError`) and a `detailParse` constant, directly after "a malformed semgrep PartialParsing type fails" and before `const requiredRoots`. No existing assertion removed or loosened. +157/−2. | Row 2 |
| `docs/changes/semgrep-error-detail/implementation.md` | This file. | Row 3 |

Not touched (condition 1): `security.yml`, every `*.expected.*` golden file,
`run-semgrep.sh`, `redact-report.mjs`, `known-findings.json`,
`fail-on-rules.json`, `.semgrepignore`, every `results`-loop rejection, and the
accepted `semgrep parse warning:` line.

The detail, as built:

```js
function describeSemgrepError(error, index, count) {
  let tag = "(none)";
  if (error.type !== undefined) {
    const raw = Array.isArray(error.type) ? error.type[0] : error.type;
    tag = typeof raw === "string" && semgrepTagPattern.test(raw) ? raw : "(unrecognised)";
    if (tag === "PartialParsing" && !isPartialParse(error.type)) tag += " (malformed)";
  }
  const errorPath = typeof error.path === "string" ? error.path.replaceAll("\\", "/") : error.path;
  return ` (error ${index + 1} of ${count}; level ${shown(error.level, semgrepTagPattern)}; type ${tag}; path ${shown(errorPath, semgrepPathPattern)}; rule ${shown(error.rule_id, semgrepRulePattern)})`;
}
```

The patterns are exactly §3.1's: tag and level `^[A-Za-z][A-Za-z0-9 _-]{0,63}$`,
path `^[A-Za-z0-9._@+\[\]/-]{1,240}$`, rule `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$`.
`[]` gives `type[0] === undefined`, which is not a string, so it prints
`(unrecognised)` as §3.1 requires. `type[1]` is never read for printing; only
`isPartialParse` looks at it (`Array.isArray`), as the gate's decision already does.

## Commits

```
$ git log --oneline origin/rebuild/dotnet-platform..HEAD
a937510 semgrep-error-detail: Name the rejected Semgrep error in the gate message
331b19b semgrep-error-detail: Red tests
444d178 semgrep-error-detail: Plan approval
0660484 semgrep-error-detail: Plan review round 2
6e038e3 semgrep-error-detail: Plan round 2
99dd28b semgrep-error-detail: Plan review round 1
1afba82 semgrep-error-detail: Plan
$ git show --stat --format=%h 331b19b | tail -2
 .github/security/gate.test.mjs | 159 ++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 157 insertions(+), 2 deletions(-)
$ git show --stat --format=%h a937510 | tail -2
 .github/security/gate.mjs | 41 +++++++++++++++++++++++++++++++++++------
 1 file changed, 35 insertions(+), 6 deletions(-)
```

- `331b19b` red tests and the `withoutDetail` tightening, `gate.test.mjs` only
  (condition 2).
- `a937510` the fix, `gate.mjs` only.
- The commit that adds this file (records only).

Nothing was pushed between them, or at all (condition 9).

## Baseline (base `5c38406` plus the plan commits, before any edit)

```
$ node --version
v22.23.4
$ node --test .github/security/gate.test.mjs
1..63
# tests 63
# pass 63
# fail 0
exit 0
```

## Red run (at `331b19b`, tests and tightening only, base `gate.mjs`)

```
$ node --test .github/security/gate.test.mjs
1..73
# tests 73
# pass 63
# fail 10
exit 1
not ok 45 - a rejected semgrep error names its type, path and rule
not ok 46 - a rejected tagged semgrep error names only its tag
not ok 47 - a rejected semgrep error gives its position
not ok 48 - a semgrep level rejection names the error and its level
not ok 49 - hostile semgrep error types and levels are shown as unrecognised
not ok 50 - hostile semgrep error paths and rules are shown as unrecognised
not ok 51 - a rejected semgrep error at the length limits is shown
not ok 52 - a semgrep error with no path names its type and rule
not ok 53 - a semgrep error that is not an object gives its position only
not ok 54 - a malformed PartialParsing type is marked as malformed
```

The 63 existing tests pass, including the tightened mutation test. Each new test
fails on the assertion its "Fails today on" column names, after the exit code,
file name, canary and no-`::` checks have passed. The failing line and the gate's
output for each:

| Test | Fails at | Gate output (the base message, no detail) |
| --- | --- | --- |
| N1 | `gate.test.mjs:922`, `assert.ok(includes(detail))`, `expected: true actual: false` | `…semgrep-detail-n1.json: semgrep report field type is not a partial parse` |
| N2 | `:932`, includes of `type PatternParseError; path …; rule (none))` | `…n2.json: semgrep report field type is not a partial parse` |
| N3 | `:941`, includes of `(error 2 of 2; level warn; type Timeout;` | `…n3.json: semgrep report field type is not a partial parse` |
| N4 | `:947`, includes of the detail | `…n4.json: semgrep report field level is not a parse warning` |
| N5 | `:967`, `type 0`, includes of `type (unrecognised);` | `…n5-type-0.json: semgrep report field type is not a partial parse` |
| N6 | `:984`, `path 0`, includes of `; path (unrecognised); rule (none))` | `…n6-path-0.json: semgrep report field type is not a partial parse` |
| N7 | `:1008`, includes of the four full-length values | `…n7.json: semgrep report field level is not a parse warning` |
| N8 | `:1014`, includes of the detail | `…n8.json: semgrep report field path is missing` |
| N9 | `assert.match(/error is not an object \(error 3 of 3\)$/m)`, `operator: 'match'` | `…n9.json: semgrep report field error is not an object` |
| N10 | includes of `type PartialParsing (malformed); …` | `…n10-0.json: semgrep report field type is not a partial parse` |

## Green run (at `a937510`)

```
$ node --test .github/security/gate.test.mjs
1..73
# tests 73
# suites 0
# pass 73
# fail 0
# cancelled 0
# skipped 0
# todo 0
exit 0
```

73 tests (condition 4): 62 existing tests unchanged, 1 existing test tightened
("semgrep mutations of every consumed field", via `withoutDetail`), and 10 new
(N1 to N10), all green. "the fixture gate is the real gate" and "every field the
gate reads is listed, and every listed field is read" pass among the 62, so the
indexed loop and the reject-only `rule_id` read do not trip the read-tracking
proxy.

## Mutation-guard regression check (§3.3, condition 5; local, never committed)

`gate.mjs` at `a937510`, edited so the level check also rejects a bad type and
the type line is deleted:

```
-    if (error.level !== "warn") reject(`semgrep report field level is not a parse warning${describeSemgrepError(error, index, report.errors.length)}`);
+    if (error.level !== "warn" || !isPartialParse(error.type)) reject(`semgrep report field level is not a parse warning${describeSemgrepError(error, index, report.errors.length)}`);
-    if (!isPartialParse(error.type)) reject(`semgrep report field type is not a partial parse${describeSemgrepError(error, index, report.errors.length)}`);
$ node --test --test-name-pattern='semgrep mutations' .github/security/gate.test.mjs
not ok 1 - semgrep mutations of every consumed field
    semgrep ["errors",0,"type"] null did not name the field
# tests 1
# pass 0
# fail 1
exit 1
$ git checkout -- .github/security/gate.mjs
$ git status --short
(no output)
```

The guard still tells the checks apart, although the detail now contains
`type …`.

## The printed line, through the CLI (condition 5)

N1-shaped fixture (canary in `message` and `spans`):

```
$ node .github/security/gate.mjs semgrep …/scratchpad/fx/n1.json; echo "exit $?"
…/scratchpad/fx/n1.json: semgrep report field type is not a partial parse (error 1 of 1; level warn; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)
exit 1
```

N5-shaped fixture (`type: ["::error::injected", [canary]]`,
`path: "a\n::error::injected"`, `rule_id: "Timeout\n::error::injected"`, canary in
`message` and `spans`):

```
$ node .github/security/gate.mjs semgrep …/scratchpad/fx/n5.json; echo "exit $?"
…/scratchpad/fx/n5.json: semgrep report field type is not a partial parse (error 1 of 1; level warn; type (unrecognised); path (unrecognised); rule (unrecognised))
exit 1
```

(`…` is `/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f`;
the fixtures are scratch files, not committed.) One line each, no canary, no
`injected`, no line starting with `::`.

## Scope checks

```
$ git diff --stat origin/rebuild/dotnet-platform -- .github/
 .github/security/gate.mjs      |  41 +++++++++--
 .github/security/gate.test.mjs | 159 ++++++++++++++++++++++++++++++++++++++++-
 2 files changed, 192 insertions(+), 8 deletions(-)
$ git diff origin/rebuild/dotnet-platform -- .github/security/gate.mjs | grep '^@@'
@@ -21,7 +21,10 @@
@@ -373,6 +376,31 @@ export function validateGitleaks(report) {
@@ -386,11 +414,12 @@ export function validateSemgrep(report) {
$ git diff origin/rebuild/dotnet-platform -- .github/security/gate.test.mjs | grep '^@@'
@@ -507,6 +507,17 @@ function sampleKey(specPath) {
@@ -546,7 +557,7 @@ for (const [tool, specs] of Object.entries(consumedFields)) {
@@ -558,7 +569,7 @@ for (const [tool, specs] of Object.entries(consumedFields)) {
@@ -880,6 +891,150 @@ test("a malformed semgrep PartialParsing type fails", () => {
```

`gate.mjs`: the header after line 23 and old lines 373 to 396 only.
`gate.test.mjs`: `withoutDetail` above line 510, lines 549 and 561, and the new
tests after line 880. No `*.expected.*` file and no workflow is in the diff.

## Merge check against PR #44 (condition 8)

```
$ git rev-parse origin/change/GAP-07
4e1e4febae7ddf8598ad7b3504b40a68f491b189
$ git --version
git version 2.43.0
$ git merge-tree --write-tree HEAD origin/change/GAP-07      # at a937510
ec4fc0a08c611a65b622d82d6c4157a129c791d8
exit 0
```

#44's head is still `4e1e4fe`. No conflict. As an extra check, the merged tree
`ec4fc0a` was extracted to a scratch folder (`git archive ec4fc0a | tar -x`) and
its self-test run there:

```
$ node --test .github/security/gate.test.mjs
# tests 85
# pass 85
# fail 0
exit 0
```

(73 from this change plus #44's own new tests.)

## Corrections to the plan's record (condition 3, review finding 8)

- The two `\b<field>\b` assertions are at `gate.test.mjs` lines **549 and 561**,
  not 548 and 559. The edit was applied to 549 and 561
  (`grep -n 'spec.field}\\\\b'` before the edit gave those two lines).
- The read-tracking proxy's `length` exclusion is at line **1541**, not 1538
  (`sed -n 1541p` on the base: `if (typeof prop !== "string" || (Array.isArray(value) && prop === "length")) return;`).
- §5 says "The 63 existing tests must be unchanged and green". In fact 62 are
  unchanged and one is tightened (see Green run).

## Deviations and notes

No deviation from the design. Choices the plan left open:

- **Canary in `type[1]`.** In N5, the array cases `[42, []]` and
  `["::error::injected", []]` from §5 are written `[42, [canary]]` and
  `["::error::injected", [canary]]`, following §5's rule that every array type
  carries the canary in `type[1]`. N10's three malformed shapes are kept exactly
  as §5 lists them (`["PartialParsing", "locations"]` has a string in `type[1]`,
  not the canary), because N10 asserts those exact existing shapes; the canary is
  still in `message` and `spans`.
- **N7** uses one level-rejection fixture carrying all four boundary values (level
  64, tag 64 as `type[0]`, path 240 as `a/` × 119 + `bc`, rule 200) and asserts the
  whole detail with all four printed in full.
- **N9** checks "followed by the end of the line" with
  `assert.match(result.out, /error is not an object \(error 3 of 3\)$/m)`.
- **The optional `/\(error 1 of 1; level warn; type Timeout; /` assertions** on
  the existing tests at lines 798 to 880 (§4, "Optionally") were not added; N1 to
  N10 cover the same output, and leaving the existing tests untouched keeps the
  "62 unchanged" statement true.
- **`shown()` and the tag.** The tag slot does not go through `shown()`, because a
  present non-string, non-array `type` (and `[]`) must print `(unrecognised)`, not
  `(none)`; only an absent `type` prints `(none)`. This is §3.1's table as written.

## Not run

| Check | Reason | Covered by |
| --- | --- | --- |
| C1 "Security gate self-test" in CI | GitHub Actions cannot run here; not pushed | PR CI; must report 73 tests, as locally |
| C2 "Semgrep (ERROR fails, WARNING reported)" | Same | PR CI; expected green. If it fails, the log line now carries the detail, and the tester quotes it |
| C3 CI workflow jobs | Same; this change touches no file they use | PR CI |
| Semgrep over the new code locally | The registry packs (`p/...`) cannot be fetched from this environment (plan §2) | PR CI, C2 |

## Migrations

None.

## Follow-ups

- **F1.** After this merges, PR #44's branch takes it in and re-runs its Semgrep
  job. The new detail line is quoted there. That is the proof the owner's goal
  ("so #44's cause becomes visible") was met. The cause is fixed in its own change.
- **F2.** Keeping the report when the Semgrep job fails. Moved here from the
  owner's card ("and keep the report"), **pending O-1**. Not delivered by this
  change.
- **F3. Security defect: workflow-command (log) injection in the accepted
  `semgrep parse warning: <path>` line** (`gate.mjs` line 433 on the base, line 462
  after this change). Reproduced by the tech lead on the base gate (condition 6):
  a report with one error
  `{ level: "warn", path: "a\n::error::x", type: ["PartialParsing", []] }` run
  through `node .github/security/gate.mjs semgrep <file>` prints

  ```
  semgrep parse warning: a
  ::error::x
  ```

  and exits 0. Anyone who can commit a file name containing a newline can make the
  Semgrep job emit a workflow command (`::error`, `::warning`, `::add-mask::`
  annotations can be forged; `set-env` and `add-path` are disabled). This change
  does not make it worse and does not fix it (B-8). It must be scheduled as its
  own security change, and the pull request description carries it.

## Owner decision open

- **O-1.** "This change prints the rejected error's type, path and rule, and does
  not change the uploaded report. Do you still want the report kept when the
  Semgrep job fails (follow-up F2, which changes `security.yml`,
  `redact-report.mjs` and their golden copies), or is the printed detail
  enough?" It goes to the owner with the pull request. Not answered; no answer is
  assumed.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A rejected Semgrep error prints its position, level, type tag, path (slashes) and rule | Owner, 8 Nov 2026 ("go on" on the card: "print the rejected error's type and path") | Done locally | N1, N2, N3 green; CLI N1 line above; `a937510` |
| The level and path-missing rejections carry the same detail; the not-an-object rejection carries the position | Change context; review round 1, findings 3 and 5; plan §3.1 | Done locally | N4, N8, N9 green |
| A malformed PartialParsing type prints `type PartialParsing (malformed)` | Review round 1, finding 4; plan §3.1 | Done locally | N10 green (three shapes, plus the unmarked valid type at level `error`) |
| The mutation guard matches `\b<field>\b` only before the detail, and the regression check fails it | P-6; review round 1, finding 1; plan §3.3 | Done locally | `withoutDetail` at lines 549 and 561 (`331b19b`); regression check `# fail 1`, `semgrep ["errors",0,"type"] null did not name the field`; restored, never committed |
| The red tests are committed alone before the `gate.mjs` commit | P-4, B-6; review round 1, finding 7; plan §5 | Done | `331b19b` (only `gate.test.mjs`) before `a937510` (only `gate.mjs`); red run 63 pass / 10 fail quoted |
| `message`, `spans` and `type[1]` are never printed (canary) | Change context; `gate.mjs` header | Done locally | Every N1 to N10 run asserts the canary is absent; N2 and N5 put it in `type[1]` |
| Newline, `::`, overlong and non-string values show as `(unrecognised)`; absent ones show as `(none)` | Change context; plan §3.1 | Done locally | N5, N6 (no `injected`, no line starting `::`), N7 boundaries, N4/N8 `(none)`; CLI N5 line above |
| Every report that fails today still fails with exit 1, and the existing messages still match | P-6 | Done locally | 62 unchanged existing tests green, including lines 798 to 880; every N test asserts exit 1 and the base message |
| The existing 63 self-tests pass (62 unchanged, 1 tightened), and the 10 new tests pass | Plan §5; condition 4 | Local done; CI NOT RUN | `node --test .github/security/gate.test.mjs`: 73 tests, 73 pass, 0 fail, exit 0. CI: C1 |
| No `*.expected.*` golden file and no workflow changes | Plan §4; condition 1 | Done | `git diff --stat … -- .github/` lists only `gate.mjs` and `gate.test.mjs` |
| The diff merges cleanly with PR #44 head `4e1e4fe` | Change context; plan §5; condition 8 | Done | `git merge-tree --write-tree HEAD origin/change/GAP-07` exit 0, tree `ec4fc0a`; merged tree self-test 85 of 85 |
| Keep the report when the Semgrep job fails | Owner's card, 8 Nov 2026 ("and keep the report") | Moved to F2, pending O-1 | Plan §3.4, §4 F2, §9 O-1; Follow-ups above |
| F3 parse-warning log injection recorded as a security defect | Plan-approval condition 6; review finding 9 | Recorded, not fixed | Follow-ups, F3, with the reproduction |

Status: READY FOR TEST
