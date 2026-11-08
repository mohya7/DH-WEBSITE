# Plan review: semgrep-error-detail

## Round 1

Plan reviewer, 8 November 2026. Reviewed `docs/changes/semgrep-error-detail/plan.md`
(architect, round 1) on `change/semgrep-error-detail` at `1afba82` (base
`origin/rebuild/dotnet-platform` at `5c38406`). Read first, from the reference
copy at
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`:
`.claude/agents/plan-reviewer.md`, `docs/changes/README.md`, `AGENTS.md` and
`ENGINEERING_STANDARDS.md`. Shape follows
`docs/changes/ci-runner-pin/plan-review.md` on the base. ADR 0001 and the admin
audit do not apply (not G2 or G3). No earlier review round exists.

To test the design rather than read it, I built the plan's §3.1 and §3.2 in a
throwaway copy of the tree (`git archive HEAD` into
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/proto-sed`,
an indexed loop, the three patterns exactly as written, `shown()` and
`describeSemgrepError()` above `isPartialParse`). Nothing in the worktree was
changed by that. Findings 1 to 5 quote it.

### Findings

**1. Major — §3.3 (P-6) and §5: the detail makes the "semgrep mutations of every
consumed field" guard unable to tell which check rejected `type`, `path` and
`error`.**
The plan says that after the change "the file name and `\b<field>\b` all still
match". They do, but for the wrong reason. The mutation test
(`gate.test.mjs` lines 548 and 559) proves each consumed field is validated by
asserting `new RegExp(`\\b${spec.field}\\b`)` on the output. Three semgrep
consumed fields are named `error`, `path` and `type` (`gate.mjs` lines 99 to
104), and the detail text `(error i of n; type …; path …; rule …)` contains all
three words on every level or type rejection, whatever field was mutated. The
printed values can add more (a real tag is `Fatal error`). So the guard now
passes when a field is rejected by the wrong check.

Evidence, on the prototype: I added a deliberate regression that moves the type
check into the level check (`if (error.level !== "warn" || !isPartialParse(error.type)) reject(…level…)`
and deleted the type line).

```
== proto + regression:   node --test --test-name-pattern='semgrep mutations' …
# pass 1
# fail 0
== base + regression (same edit, no detail):
not ok 1 - semgrep mutations of every consumed field
# pass 0
# fail 1
```

The explicit type tests at lines 826 to 880 would still catch this particular
regression, but the generic guard, which exists so that every consumed field is
covered without a hand-written test, has lost its power for those three fields.
That is a weakened guard (P-6), and the plan states the opposite ("No existing
assertion is removed or loosened").

What would satisfy me: the plan keeps the mutation guard as discriminating as it
is today. For example, the two `\b<field>\b` assertions match only the message
before the ` (error ` detail (strip it first), and §4 lists that edit to
`gate.test.mjs` as a tightening. Renaming the slot labels is not enough on its
own, because the printed values can contain the same words. A tightening to
`field <name>` does not work either: I tried it, and the gitleaks mutations fail
(`gitleaks report entry is not an object` has no `field`). The plan also asks the
developer to show the regression above failing the suite after the change.

**2. Minor — §3.2: the `entries()` option breaks the read-tracking test.**
§3.2 says the loop "becomes an indexed loop, or `entries()`". With `entries()`,
the proxy in `watchReads` records the string property `entries` on the errors
array:

```
not ok 1 - every field the gate reads is listed, and every listed field is read
    semgrep read a field that is not listed: ["errors","entries"]
```

An indexed `for (let index = 0; index < report.errors.length; index += 1)` passes,
because `watchReads` ignores `length` on arrays (line 1538). The suite would catch
the wrong choice, but the plan should not offer it.

What would satisfy me: §3.2 names the indexed loop only, and says why (no other
array method, such as `entries`, `forEach` or `keys`).

**3. Minor — §3.3: the `path is missing` rejection keeps the undiagnosable
message.**
§3.3 gives `path is missing` no detail because "there is no safe path to show".
The slot design already deals with that: an absent path prints `(none)` and an
unsafe one `(unrecognised)`, and the plan itself prints `path (none)` on the level
rejection (example 2 in §3.1, test N4). A `warn` error without a path is the same
kind of defect as #44: the type and rule would identify it, but the line names
neither. The same applies, in a smaller way, to `error is not an object`, where
the position `error i of n` is safe to print.

What would satisfy me: either the `path is missing` rejection (from
`validateSemgrep`'s errors loop only, not the results loop) also gets the detail,
with a test, or the plan gives a reason that holds.

**4. Minor — §3.1: a malformed PartialParsing type prints as `type
PartialParsing`.**
On the prototype, `type: ["PartialParsing", "x"]` and `type: "PartialParsing"`
each print
`semgrep report field type is not a partial parse (error 1 of 1; type PartialParsing; path a.cs; rule (none))`.
The line seems to contradict itself, and a reader may suspect a gate bug instead
of a malformed report.

What would satisfy me: the plan either marks this case (for example
`type PartialParsing (malformed)` when the tag is `PartialParsing`), or states
that only the tag is printed. In either case one test asserts the exact output
for an existing malformed shape, so the behaviour is deliberate.

**5. Minor — §3.1: the level rejection does not say what the level was.**
For `level is not a parse warning`, the detail shows type, path and rule but not
the level. An `error`-level Timeout and an `info`-level message cannot be told
apart from the line. The level is a short enum and is as safe to print as the
tag, under the same pattern.

What would satisfy me: add a `level` slot under the tag pattern, with `(none)` and
`(unrecognised)` like the others. Or record why it is left out. (If it is added,
finding 1's fix covers the extra word.)

**6. Minor — §1 Done when 4, §11 coverage table row 9: the split part of the
owner's card is recorded as "Planned".**
I judge the split acceptable. Each reason in §3.4 holds on the code:

- `redact-report.mjs` line 18 maps every error to `{ type: "redacted" }`.
- The redact and upload steps (`security.yml` lines 178 to 186) have no `if:`.
- PR #44 edits `security.yml` and `security.expected.yml` (verified below).
- Keeping the report would change the golden workflow structure, which is a
  second topic (B-8).
- The printed detail alone meets the stated goal, "so #44's cause becomes
  visible".

The plan defers F2 and does not drop it, and O-1 asks the owner without assuming
an answer. But the record has to show the move. `AGENTS.md`'s rule is "Moved items
name their destination". Row 9 says "Planned" for something this change will not
do, and Done-when item 4 is not an acceptance criterion.

What would satisfy me:

- Row 9's status reads "Moved to F2, pending O-1".
- Done-when 4 is reworded as a non-goal.
- The plan says O-1 goes to the owner with the pull request, and that the
  delivery must not describe the card as fully delivered until O-1 is answered.

**7. Minor — §5 "Failing tests first": the red run is not committed.**
§5 has the developer add the tests, run them red and then change `gate.mjs`. P-4
and B-6 ask for the red test to be committed before the fix. A run that is not
committed leaves no trace in the pull request for the tester.

What would satisfy me: the red tests are committed alone first (for example
`semgrep-error-detail: Red tests`), with the failing output quoted in
`implementation.md`, and then the `gate.mjs` commit. Each of N1 to N7 must name
the assertion that fails today. This holds now, because every test asserts
detail text that the current gate never prints, but the plan should say it.

### Checked and found sound

- **Baseline.** `node --test .github/security/gate.test.mjs` (Node v22.23.4): `# tests 63`, `# pass 63`, `# fail 0`, exit 0. This matches §2.
- **Line references.**
  - `gate.mjs`: `reject` is at 117 to 120, `isPartialParse` at 376 to 381, `validateSemgrep` at 383, the four error checks at 389 to 393, `replaceAll` at 394 and 407, and the parse-warning print at 433.
  - The header rule is at lines 14 to 23.
  - `gate.test.mjs`: the fixture copy is at line 39, "the fixture gate is the real gate" at 237, the Semgrep error tests at 798 to 880, `requiredRoots` at 883, and the read-tracking test at 1565 to 1592.
  - `security.yml`: the self-test is at line 75, `NODE_VERSION: "22"` at line 58, and Scan, redact and upload at lines 175 to 186.
- **Golden files.** Every `.github/security/*.expected.*` file was checked. They mention `gate.mjs` only as an invocation line: `run-*.expected.sh`, and `security.expected.yml` lines 8, 23 and 75. None mirrors `gate.mjs` or `gate.test.mjs`, so no golden file changes. That is right.
- **Gate strength (P-6) on the decision.** On the prototype, every rejection keeps exit 1, the check order is unchanged, and the full suite stays 63 of 63. The read-tracking test also stays green with the indexed loop, because `rule_id` is read only inside the reject branch. Keeping `rule_id` out of `consumedFields` is right: listing it would make a wrong-typed `rule_id` fail the gate, which would be a behaviour change. The decision is not weakened in any case I could construct. Finding 1 is about the self-test's power, not the gate's.
- **Injection and leakage.**
  - None of the three patterns admits `:`, `%`, `#`, `;`, `(`, `)`, a quote, a control character, a newline, U+2028 or non-ASCII. JavaScript's `$` without `m` does not match before a trailing `\n`.
  - On the prototype, `"Timeout\n::error::injected"`, `"a\n::warning::x"`, `"r\n::add-mask::x"`, `"Time out"`, `null` and `42` all print `(unrecognised)`. A canary in `message` never appears.
  - The line always starts with the report file path, so it cannot start a workflow command, and the legacy `##[` form is impossible without `#`.
  - The bounded character-class patterns are linear, so there is no ReDoS.
  - Replacing a value whole, not truncating it, means no part of an unknown value is printed.
  - `message`, `spans` and `type[1]` are never read. The canary in `type[1]` (N2) proves it.
- **Paths that must print.**
  - The `git ls-files api website/src … .github/security | grep -v '^[A-Za-z0-9._/@+-]*$'` command gives exactly `website/src/app/[[...path]]/page.tsx`.
  - The same check on PR #44's tree (`git ls-tree -r --name-only 4e1e4fe`) gives the same single path.
  - Across all tracked files, the only characters outside `[A-Za-z0-9._/-]` are 2 × `[` and 2 × `]`, and the longest path is 107.
  - An absolute runner path (`/home/runner/work/DH-WEBSITE/DH-WEBSITE/website/src/x.ts`) also matches the path pattern.
  - The rule pattern's leading `[A-Za-z0-9]` would refuse a local-config rule id that starts with `.`, but only registry packs are used (`run-semgrep.sh`), so this is noted, not a finding.
- **Length caps.** 64, 240 and 200 are consistent with the patterns (`{0,63}` after one leading character, `{1,240}`, and `{0,199}` after one). N7 tests the boundaries and N5 and N6 test one over.
- **PR #44 clash.**
  - `git diff --stat 5c38406 4e1e4fe -- .github/` matches §2: `gate.mjs` +152 and `gate.test.mjs` +428, plus `run-npm-audit*.sh`, `security.yml` and `security.expected.yml`.
  - The hunk headers match: `@@ -1,6`, `@@ -26,8`, `@@ -268,6` and `@@ -418,11` in `gate.mjs`, and `@@ -21,35`, `@@ -235,8` and `@@ -1592,3` in `gate.test.mjs`.
  - `git merge-tree --write-tree HEAD 4e1e4fe` exits 0 on the plan commit.
  - With the prototype `gate.mjs` committed through a temporary index (a dangling commit, not a branch), `git merge-tree --write-tree --name-only <proto> 4e1e4fe` also exits 0, with no conflicted file (tree `cd55d56`).
  - New tests after line 880 are far from #44's test hunks.
- **Alternatives.** These are real alternatives, and their rejection holds:
  - an allow-list of types (it would hide exactly the unknown case);
  - truncation;
  - reporting every error;
  - a `::error` annotation;
  - sanitising line 433 now (F3, outside the request);
  - exporting the helper.
- **Scope (B-8).** One gate's rejection text, in two files, plus the records. The workflow, the redactor, the goldens, `consumedFields`, the allow-lists and #44's cause are all left alone. This is one topic.
- **Security impact, migrations and rollback.** There are no routes, secrets, dependencies or migrations. Rollback is a revert. The risk table is specific, and each row names its check.

Verdict: CHANGES NEEDED

## Round 2

Plan reviewer, 8 November 2026. Reviewed `docs/changes/semgrep-error-detail/plan.md`
(architect, round 2) at `6e038e3`, against the Round 1 findings above
(`99dd28b`) and the §12 revision log. As in Round 1, I built the round 2 design
in a throwaway copy of the base tree
(`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/proto2`):
first the `withoutDetail` tightening alone (the red state), then the `gate.mjs`
change, with five slots, the ` (malformed)` marker, the plain indexed loop, and
detail on the not-an-object, level, path-missing and type rejections. Nothing in
the worktree was changed.

### Round 1 findings, as answered

**1. Major (mutation guard): resolved.** §3.2 and §3.3 add `withoutDetail(out)`,
which cuts each line at the first ` (error `, and match the two `\b<field>\b`
assertions against it. §4 lists this as a tightening, and §5 makes the
regression check a required command. A value cannot contain `(`, so the first
` (error ` on a rejection line is always the gate's own text.

- Red state, with the tightened guard and the base `gate.mjs`:
  `node --test .github/security/gate.test.mjs` gives `# tests 63`, `# pass 63`,
  `# fail 0`. The tightening does not break the base.
- Green state, with the round 2 `gate.mjs`: `# tests 63`, `# pass 63`, `# fail 0`.
- My Round 1 regression on the green state (type check folded into the level
  check):

  ```
  not ok 1 - semgrep mutations of every consumed field
      semgrep ["errors",0,"type"] null did not name the field
  # pass 0
  # fail 1
  ```

  The guard tells the checks apart again, as it did before the change.

**2. Minor (`entries()`): resolved.** §3.2 names only
`for (let index = 0; index < report.errors.length; index += 1)` and gives the
reason. With that loop, the read-tracking test passes on the prototype (part of
the 63 above).

**3. Minor (path-missing and not-an-object): resolved.** On the prototype:

- A missing path prints `field path is missing (error 1 of 1; level warn; type
  Timeout; path (none); rule csharp.example.rule)` (N8).
- `path: ""` prints `path (unrecognised)`. `nonEmpty` (`gate.mjs` line 250)
  rejects `""`, and the path pattern's `{1,240}` refuses it, so the N6 case
  holds.
- A non-object entry prints `field error is not an object (error 3 of 3)` and
  nothing after it (N9).

**4. Minor (malformed PartialParsing): resolved.** All three existing malformed
shapes print `type PartialParsing (malformed)`. A valid PartialParsing type at
`level: "error"` prints `type PartialParsing; path …` with no marker, exactly as
N10 asserts.

**5. Minor (level slot): resolved.**

- `level: "error"` prints `level error` (N4).
- `"error\n::error::injected"`, `null` and `{}` print `level (unrecognised)`.
- A 64-character level prints in full (N7).
- The word `level` in the detail is covered by `withoutDetail`.

**6. Minor (record of the split): resolved.**

- §1 now states "keep the report" as a non-goal.
- Coverage row 12 reads "Moved to F2, pending O-1" and names §3.4, F2 and O-1.
- §1 and §9 say O-1 goes to the owner with the pull request, and that until O-1
  is answered the card must not be described as fully delivered.

**7. Minor (red commit): resolved.**

- §5 commits the red tests and the guard tightening alone, as
  `semgrep-error-detail: Red tests`, before the `gate.mjs` commit. The failing
  output is quoted, and `git log` and `git show --stat` check the order.
- A "Fails today on" column names the failing assertion for each of N1 to N10.
  Each one asserts detail text the base gate never prints, so each fails today.

### New findings

**8. Minor — §3.2, §4 and §5: two line numbers are wrong, and one sentence
contradicts the tightening.**

- The two `\b<field>\b` assertions are at lines **549 and 561**, not 548 and 559
  (`grep -n 'spec.field}\\\\b' .github/security/gate.test.mjs`). The wrong
  numbers were mine in Round 1, finding 1, and the plan copied them.
- §5's first command still says "The 63 existing tests must be unchanged and
  green". The mutation test is changed by design (§4, and §11 row 9 says
  "tightened only").

Neither affects the design. What would satisfy me: the architect corrects these
at the next touch of the plan, or the developer's `implementation.md` records
them. This does not block.

**9. Minor — §3.5 and F3: the accepted parse-warning line is a demonstrated
workflow-command injection, not just "an unchecked path".**

On the base gate, and unchanged by this plan, a valid PartialParsing warning
whose `path` is `"a\n::error::x"` exits 0 and prints:

```
semgrep parse warning: a
::error::x
```

The injected text is the second line, and it starts with `::`. A file name with
a newline can be committed to git. So whoever can open a pull request can make
the Semgrep job emit a workflow command. The harm is limited, because
`set-env` and `add-path` are disabled, but `::error`, `::warning` and
`::add-mask::` annotations can be forged.

This change does not make it worse, and keeping it out is right for B-8. But
F3's entry understates it.

What would satisfy me: F3 is recorded as a log-injection defect with this
reproduction, so it is scheduled as a security change rather than as a
cosmetic one. This does not block.

### Checked that nothing else moved

- **Injection and leakage under round 2.**
  - On the prototype, hostile levels, types, paths and rules all print
    `(unrecognised)`: newline plus `::`, `null`, `{}`, 65, 241 and 201
    characters.
  - No rejection line has a second line, and the canary never appears.
  - The ` (malformed)` marker is fixed text, so it cannot be forged. A value
    cannot contain `(` or `)`.
  - The level slot reuses the tag pattern, which is bounded and linear.
- **Gate strength (P-6).** Every case above exits 1, by the same check as
  before. The not-an-object rejection reads nothing from the entry.
  `consumedFields` is unchanged. Gate decisions are unchanged.
- **PR #44 clash.**
  - `git merge-tree --write-tree HEAD 4e1e4fe` on `6e038e3` exits 0.
  - With both prototype files committed through a temporary index (a dangling
    commit, +28/−5 in `gate.mjs` and +9/−2 in `gate.test.mjs`),
    `git merge-tree --write-tree --name-only <proto> 4e1e4fe` exits 0 with no
    conflicted file (tree `d66b91f`).
- **Scope (B-8).** It is still two files plus the records. No golden file,
  workflow, allow-list or `results`-loop rejection is touched. The test count
  of 73 (63 + N1 to N10) is consistent.

Verdict: APPROVED
