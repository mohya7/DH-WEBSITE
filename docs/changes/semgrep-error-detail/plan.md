# Plan: semgrep-error-detail — say which Semgrep error the gate rejected

Architect, round 2, 8 November 2026 (round 1 the same day). Round 2 answers
`plan-review.md` Round 1 (commit `99dd28b`); see §12. Change branch `change/semgrep-error-detail`,
cut from `origin/rebuild/dotnet-platform` at `5c38406`.

Files read: `docs/changes/README.md`, `.claude/agents/architect.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md` and
`docs/quality/refinement-plan-2026-10-28.md`. None of these is on the base branch
yet. They were read from the reference copy at
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`,
as the change context directs, and are cited by those relative paths. The plan's
shape follows `docs/changes/ci-runner-pin/plan.md` on the base branch. ADR 0001
and the admin audit do not apply, because this is not a G2 or G3 change. No
plan-review, plan-approval or implementation file exists yet, so this is not a
revision in round 1. Round 2 is a revision: `plan-review.md` Round 1 was read
and every finding is answered in §12.

## 1. Item

- **What it closes.** This is a CI diagnosability defect, not a refinement-plan
  item. The Semgrep gate rejects a non-PartialParsing error correctly, but its
  message does not say which error it rejected. As a result, nobody can see why
  PR #44 (GAP-07) fails.
- **Owner's words.** "go on" (Mohamed Elbadry, 8 November 2026, project
  timeline). This answered a card that recommended: "A new one-topic change
  makes the gate print the rejected error's type and path and keep the report,
  so #44's cause becomes visible."
- **Track.** **G1, Waves 1 to 3 (gates and API)**, because it changes an
  existing gate (G-10, `ENGINEERING_STANDARDS.md` line 63). It adds no gate and
  closes no GAP id.
- **Done when** (from the owner-approved card, since the refinement plan has no
  entry for this):
  1. When the gate rejects an entry of `report.errors` (not an object, level,
     path missing, or type), its message names the entry's position. For every
     case except "not an object" it also names the entry's level, type tag, path
     and rule, when it has one. It never names the error's `message`, its
     `spans` or any other free text.
  2. Every report that fails today still fails, with the same exit code (1), and
     the existing message text is kept as a prefix (P-6). The self-test's
     mutation guard is still able to tell which check rejected a field (§3.3).
  3. A hostile value never reaches the log. That covers a newline, `::`, an
     overlong value and a value that is not a string. Each one is shown as a
     fixed placeholder.
- **Non-goal: "keep the report".** The owner's card also said "keep the
  report". This change does not do that. It is moved to follow-up change F2
  (Design §3.4), and O-1 asks the owner whether F2 is still wanted. O-1 goes to
  the owner with this pull request. Until O-1 is answered, the delivery and the
  pull request must not describe the card as fully delivered. They say "type,
  path and rule printed; keeping the report moved to F2, pending O-1".

## 2. Current state

**The failure, from the job logs** (PR #44, head `4e1e4fe`, CI run
41792199775). `gh api repos/mohya7/DH-WEBSITE/actions/jobs/126448055869/logs`:

```
2026-11-04T07:26:25.5041575Z ##[group]Run bash .github/security/run-semgrep.sh
2026-11-04T07:27:03.2655871Z /home/runner/work/_temp/semgrep.json: semgrep report field type is not a partial parse
2026-11-04T07:27:03.2712515Z ##[error]Process completed with exit code 1.
2026-11-04T07:27:03.2878200Z Post job cleanup.
```

Job 126448585709 shows the same two lines, at log lines 535 to 536. Both jobs ran
on `Image: ubuntu-26.04` (log line 17). Neither log has a `semgrep parse warning`
line (`grep -c` gives `0`). That fits the code below: the gate stops at the first
rejected error, before it prints any parse warning. The coordinator reported
that PR #40 failed once the same way and passed when re-run. That report was
not re-checked here.

`gh api repos/mohya7/DH-WEBSITE/pulls/44 --jq '.head.sha,.head.ref,.state'` gives
`4e1e4febae7ddf8598ad7b3504b40a68f491b189`, `change/GAP-07`, `open`.

**The gate.** `.github/security/gate.mjs`:

- Lines 117 to 120: `reject(message)` writes `${file}: ${message}` to stderr and
  calls `process.exit(1)`.
- Lines 376 to 381: `isPartialParse(type)` accepts only the array
  `["PartialParsing", <array>]`.
- Lines 383 to 395: `validateSemgrep` loops over `report.errors`, in this order:

  ```js
  if (!isRecord(error)) reject("semgrep report field error is not an object");
  if (error.level !== "warn") reject("semgrep report field level is not a parse warning");
  if (!nonEmpty(error.path)) reject("semgrep report field path is missing");
  if (!isPartialParse(error.type)) reject("semgrep report field type is not a partial parse");
  parseWarnings.push(error.path.replaceAll("\\", "/"));
  ```

  The PR #44 message therefore means that the first non-PartialParsing error had
  `level === "warn"` and a non-empty string path, and that its `type` was not
  the PartialParsing array. The message says nothing about which error it was,
  so its type, path and rule are all unknown.
- Lines 14 to 23 (header) document this rule. They say the error's message and
  spans are not read.
- Line 433: an accepted parse warning prints `semgrep parse warning: ${parsePath}`.
  The path gets backslash-to-slash conversion only.

**Where the gate runs.** `.github/security/run-semgrep.sh` ends with
`node .github/security/gate.mjs semgrep "$RUNNER_TEMP/semgrep.json"`. This line is
inside the "Scan" step (`security.yml` lines 175 to 176). When the gate fails, the
Scan step fails, so the next two steps never run: "Redact matched source before
upload" (lines 178 to 179) and "Upload the redacted report" (lines 181 to 186).
They have no `if:`. Even when they do run,
`.github/security/redact-report.mjs` line 18 replaces every error with
`{ type: "redacted" }`. So the artifact could not show the cause either.

**What has been tried.** The coordinator ran Semgrep 1.180.0 locally with the
public semgrep-rules JS, TS, C# and secrets rules over the same roots. It
produced only PartialParsing warnings. The registry packs (`p/...`) cannot be
fetched from this environment. So the cause cannot be reproduced here, and has
to be printed by CI.

**Semgrep's error types.** A Semgrep error's `type` is either a plain string,
such as `"Timeout"` or `"Out of memory"` (the existing tests use these, with
spaces), or a tagged array such as `["PartialParsing", locations]`. Its first
element is the tag. An error can also carry `rule_id`.

**The paths that must print.** Every file under the scanned roots matches
`[A-Za-z0-9._/@+-]`, with one exception:
`git ls-files api website/src website/scripts website/behaviors website/test website/tools studio packages .github/security | grep -v '^[A-Za-z0-9._/@+-]*$'`
gives exactly `website/src/app/[[...path]]/page.tsx`. Across all tracked files,
the only characters outside `[A-Za-z0-9._/-]` are 2 × `[` and 2 × `]`. The
longest tracked path is 107 characters.

**The self-test.** `.github/security/gate.test.mjs`, run by CI in the "Security
gate self-test" job (`security.yml` line 75:
`node --test .github/security/gate.test.mjs`, on `NODE_VERSION: "22"`). The tests
this change has to keep green:

- Line 39 copies `gate.mjs` byte for byte into a fixture folder, and line 237
  ("the fixture gate is the real gate") compares the two. No golden copy of
  `gate.mjs` or `gate.test.mjs` exists. The golden files are
  `gitattributes.expected`, `install-gitleaks.expected.sh`,
  `redact-report.expected.mjs`, `run-dotnet-audit.expected.sh`,
  `run-gitleaks.expected.sh`, `run-npm-audit.expected.sh`,
  `run-semgrep.expected.sh`, `security.expected.yml`, `semgrep-job.expected.yml`
  and `semgrepignore.expected`. None of them mirrors a file this plan changes,
  so no `*.expected.*` file is affected.
- Lines 798 to 805: a `Timeout` error at `level: "error"` must exit 1, match
  `/field level is not a parse warning/`, name the file and never contain the
  canary.
- Lines 826 to 880: the types `Timeout`, `Out of memory`, `Stack overflow`,
  `Fatal error`, `Rule parse error`, `NotARealSemgrepError`, a missing type,
  and the malformed PartialParsing shapes must each exit 1, match
  `/field type is not a partial parse/` and never contain the canary.
- Lines 517 to 565: the mutation tests check that each rejection names the file
  and matches `\b<field>\b`.
- Lines 1565 to 1592: "every field the gate reads is listed, and every listed
  field is read". This test runs `validateSemgrep` on a *clean* fixture through a
  read-tracking proxy. A new read on the accept path, such as `rule_id`, would
  fail it as "read a field that is not listed".
- Baseline, run here: `node --test .github/security/gate.test.mjs` (Node
  v22.23.4) gives `# tests 63`, `# pass 63`, `# fail 0`, exit 0.

**Open PR #44 also edits these files.** `git diff --stat 5c38406 4e1e4fe -- .github/`
shows `gate.mjs` (+152) and `gate.test.mjs` (+428). Its `gate.mjs` hunks are
at `@@ -1,6`, `@@ -26,8`, `@@ -268,6` (new allow-list functions after `finish`)
and `@@ -418,11` (in `main()`). Its `gate.test.mjs` hunks are at `@@ -21,35`,
`@@ -235,8` and `@@ -1592,3` (it appends at the end of the file). Neither
touches `validateSemgrep`, `isPartialParse` or the Semgrep error tests at lines
798 to 880.

## 3. Design

### 3.1 What is printed

All four rejections in `validateSemgrep`'s errors loop keep their existing
message unchanged, and a parenthesised detail is appended to it:

```
<file>: semgrep report field type is not a partial parse (error 2 of 3; level warn; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)
<file>: semgrep report field type is not a partial parse (error 1 of 1; level warn; type PartialParsing (malformed); path api/src/Example.cs; rule (none))
<file>: semgrep report field level is not a parse warning (error 1 of 1; level error; type Timeout; path (none); rule (none))
<file>: semgrep report field path is missing (error 1 of 1; level warn; type Timeout; path (none); rule (none))
<file>: semgrep report field error is not an object (error 3 of 3)
```

For "error is not an object" the detail is the position only, because the entry
is not a record and none of its fields is read. The other three rejections get
the full detail. The rejections in the `results` loop are unchanged.

The full detail has five slots, in this order:

| Slot | Value | Shown when | Otherwise |
| --- | --- | --- | --- |
| index | `error <i> of <n>`: the 1-based position in `report.errors` and its length | always (two integers the gate computes) | — |
| level | `level` | a string matching the tag pattern below | `(none)` if absent; `(unrecognised)` otherwise |
| type | the tag: `type` itself if it is a string, `type[0]` if `type` is a non-empty array. When the tag is exactly `PartialParsing` but `isPartialParse(type)` is false, the fixed text ` (malformed)` follows it | the tag is a string matching `^[A-Za-z][A-Za-z0-9 _-]{0,63}$` | `(none)` if `type` is absent (`undefined`); `(unrecognised)` for anything else, including `[]`, a non-string tag, `null`, an object or a number |
| path | `path` with `\` replaced by `/`, as the gate already does at lines 394 and 407 | the result is a string matching `^[A-Za-z0-9._@+\[\]/-]{1,240}$` | `(none)` if absent; `(unrecognised)` otherwise, including `""` |
| rule | `rule_id` | a string matching `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$` | `(none)` if absent; `(unrecognised)` otherwise |

` (malformed)` is fixed text the gate writes, never part of a value. It is there
so that a line such as "type is not a partial parse … type PartialParsing" is not
read as a gate bug: it shows that the report carried the PartialParsing tag in a
shape the gate does not accept (the string `"PartialParsing"`, `["PartialParsing"]`
or `["PartialParsing", "locations"]`). A valid PartialParsing type that is
rejected for its level prints `type PartialParsing` with no marker.

**Why these patterns.**

- None of them allows `:`, `;`, `(`, `)`, a quote, a control character, a newline
  or anything outside ASCII. So a value cannot start a GitHub workflow command
  (`::error::`, `::add-mask::`, `::stop-commands::`, which need `::` and a new
  line), cannot forge the `; ` separators or the closing `)`, and cannot hide
  behind a homoglyph or a zero-width character.
- JavaScript's `$` without the `m` flag matches only at the end of the input, so
  a trailing `\n` fails the pattern.
- The length is enforced by the pattern itself: 64 characters for the tag, 240
  for the path, 200 for the rule. An overlong value becomes `(unrecognised)`.
  It is not truncated, so no part of an unknown value is ever printed.
- The type pattern allows spaces because Semgrep's own string types have them
  (`Out of memory`, `Fatal error`). The level slot uses the same pattern,
  because Semgrep's levels are short words (`warn`, `error`, `info`).
- The path pattern allows `[` and `]` because `website/src/app/[[...path]]/page.tsx`
  is in a scanned root. The 240-character limit is well above the repository's
  longest path (107) plus the runner's checkout prefix.
- The rule pattern fits Semgrep's dotted rule ids.

**What is never read or printed:** `message`, `spans`, `details`, `type[1]` (the
locations) and any other field. The detail reads only `level`, `type`, `path`
and `rule_id`, and only after the gate has already decided to reject.

### 3.2 Where the code goes (kept local for the PR #44 merge)

- **New helpers** go directly above `function isPartialParse` (current line 376):
  three pattern constants, a small `shown(value, pattern)` that returns the value
  or the placeholder, and `describeSemgrepError(error, index, count)` that builds
  the ` (error …)` suffix. None of them is exported. Exporting would add a
  surface the self-test would need to cover. They are tested through the CLI,
  as every other rejection is.
- **`validateSemgrep`.** The `for … of` over `report.errors` becomes a plain
  indexed loop: `for (let index = 0; index < report.errors.length; index += 1)`
  with `const error = report.errors[index]`. No array method is used (not
  `entries`, `forEach`, `keys` or `map`). The read-tracking proxy records a
  method name as a read field (`semgrep read a field that is not listed:
  ["errors","entries"]`), while it ignores `length` (`gate.test.mjs` line 1538).
  The `error is not an object` rejection appends `` ` (error ${index + 1} of ${count})` ``.
  The level, path-missing and type rejections append
  `describeSemgrepError(error, index, report.errors.length)`. No other line in
  `validateSemgrep` changes, and the `results` loop is not touched.
- **The detail is built only inside the rejecting branch.** This keeps the
  read-tracking test (lines 1565 to 1592) green: a clean report never reads
  `rule_id`. It also explains why `rule_id` is **not** added to
  `consumedFields`. It does not affect any decision. Listing it would make the
  mutation tests expect a wrong-typed `rule_id` to fail the gate, which would be
  a behaviour change. The header comment says this.
- **Header comment.** Lines 14 to 23 get two or three more lines, after line 23
  ("are not read."): a rejected error is described by its position, its level,
  the tag of its type, its path and its `rule_id`, each only when it matches a strict
  pattern and otherwise as `(none)` or `(unrecognised)`. `rule_id` is read only
  for that description and is not a consumed field. PR #44's nearest header hunk
  starts at line 26, so the two edits do not overlap.
- **The mutation guard is tightened** (§3.3). A small function
  `withoutDetail(out)` is added in `gate.test.mjs` directly above
  `const mutationCounts = {}` (line 510). It cuts each output line at the first
  ` (error ` and keeps what comes before it. The two `\b<field>\b` assertions in
  "mutations of every consumed field" (lines 548 and 559) match against
  `withoutDetail(result.out)` and `withoutDetail(removedResult.out)`. The
  "names the file" assertions keep using the full output. PR #44's test hunks are
  at lines 21, 235 and 1592, so this does not touch them.
- **New tests** go in `gate.test.mjs` directly after "a malformed semgrep
  PartialParsing type fails" (current line 880), before `const requiredRoots`.
  They do not go at the end of the file, where PR #44 appends.

### 3.3 Exit codes and existing messages (P-6)

`reject` is unchanged, so it still exits with code 1. The order of the checks is
unchanged, so every report that is rejected today is still rejected, by the same
check. Each existing message is still the start of the line, so
`/field type is not a partial parse/`, `/field level is not a parse warning/`,
`/field path is missing/`, `/field error is not an object/` and the file name all
still match.

**The mutation guard must keep its power.** The detail contains the words
`error`, `level`, `type` and `path`, and so can a printed value (`Fatal error`).
Four of the Semgrep consumed fields have those names (`gate.mjs` lines 99 to
104). If the guard's `\b<field>\b` were matched against the whole line, it would
pass even when a field was rejected by the wrong check. The reviewer showed this
on a prototype, by folding the type check into the level check. So the two
`\b<field>\b` assertions match only the message before ` (error ` (§3.2,
`withoutDetail`). That is a tightening. For the other tools, and for every line
without a detail, `withoutDetail` returns the line unchanged.

Matching `field <name>` instead was rejected, because the gitleaks rejection
`gitleaks report entry is not an object` has no `field` (the reviewer tried it).
Renaming the slot labels was rejected too, because a printed value can still
contain the word.

The developer proves the guard still works with a regression check. This is
local and never committed. The check:

1. With the change in place, edit `gate.mjs` so the level check also rejects a
   bad type (`if (error.level !== "warn" || !isPartialParse(error.type)) reject(…level…)`),
   and delete the type line.
2. Run `node --test --test-name-pattern='semgrep mutations' .github/security/gate.test.mjs`.
   It must report `# fail 1`.
3. Restore `gate.mjs` (`git checkout -- .github/security/gate.mjs` onto the
   committed change).

The output of step 2 is quoted in `implementation.md`.

### 3.4 "Keep the report": not in this change (split as F2, O-1)

The owner's card said "print the rejected error's type and path **and keep the
report**". This plan delivers the first part and splits the second into
follow-up F2. Reasons:

1. **The gate output alone answers the question.** The question is "what did
   Semgrep hit?". The answer is the error's kind (type tag), its location (path)
   and, for a rule problem, the rule (rule id). The detail prints all three. The
   only other content of a Semgrep error is `message` and `spans`. Those must
   not be published in either the log or an artifact, because they can contain
   matched source or a secret (header, lines 17 to 23).
2. **A kept report would show nothing today.** `redact-report.mjs` line 18 turns
   every error into `{ type: "redacted" }`. Keeping the report would need
   changes to three things:
   - `redact-report.mjs` and its golden `redact-report.expected.mjs`, to keep
     `type`, `path` and `rule_id`, which repeats this plan's sanitising rules in
     a second file;
   - `security.yml`, to give the redact and upload steps an `if:` that runs
     after the Scan step fails;
   - the golden copies `security.expected.yml` and `semgrep-job.expected.yml`.

   That is a second topic: a change to the security workflow's golden structure
   and to artifact retention when a step fails (B-8). It is the same reason
   `ci-runner-pin` left the `security.yml` golden copies alone.
3. **It would add exposure.** An artifact uploaded on failure stays downloadable
   for the retention period by anyone with read access. A log line limited to
   four strictly-checked tokens publishes less.
4. **It would collide with PR #44.** PR #44 also edits `security.yml` and
   `security.expected.yml`. A second edit to the same golden files would make
   the merge harder.

If the detail turns out not to be enough to fix #44's cause, F2 keeps a report
that contains only the same four sanitised fields. O-1 asks the owner to
confirm the split.

### 3.5 Alternatives rejected

- **An allow-list of known Semgrep error types** (print the tag only if it is
  `Timeout`, `Out of memory`, and so on). The cause on #44 is by definition a
  type the gate does not expect. An allow-list would print `(unrecognised)` for
  exactly the case we need to see. The pattern gives the same injection safety
  without that.
- **Truncating an overlong value instead of replacing it.** That prints part of
  a value the gate has not recognised, and it makes the hostile tests depend on
  where the cut falls. A placeholder is simpler and safer.
- **Leaving `path is missing` and `error is not an object` without detail**
  (round 1). A `warn` error with no path is the same kind of defect as #44. Its
  type and rule identify it, and the absent path prints safely as `(none)`.
  The position of a non-object entry is two integers the gate computes, so it is
  safe to print.
- **Reporting every rejected error, not just the first.** This would mean
  rewriting `reject` (which exits at once) and the order of the checks for one
  tool. That widens the diff into code that PR #44 also changes, in `main()`.
  `error i of n` already shows whether there are more errors.
- **Emitting a `::error title=…::` annotation for the rejection.** That is a new
  output channel and changes the text of every gate rejection. It is not needed
  to see the cause, because the log line is visible in the job.
- **Sanitising the accepted `semgrep parse warning: <path>` line (line 433)
  too.** That line also prints an unchecked path. But it is the accept path,
  its output is a different behaviour, and it is outside the owner's request.
  It is listed as follow-up F3.
- **Exporting `describeSemgrepError` and unit-testing it directly.** It would
  add an export with no other user. The CLI tests prove what CI actually
  prints, and that includes the `reject` prefix.

## 4. Scope

**Change:**

| File | Change |
| --- | --- |
| `.github/security/gate.mjs` | Add three pattern constants, `shown()` and `describeSemgrepError()` directly above `isPartialParse` (line 376). In `validateSemgrep` (lines 388 to 395), make the errors loop a plain indexed loop, append the position to the `error is not an object` rejection, and append the full detail to the level, path-missing and type rejections. Add 2 to 3 header comment lines after line 23. Nothing else. |
| `.github/security/gate.test.mjs` | Add `withoutDetail()` above line 510, and make the two `\b<field>\b` assertions at lines 548 and 559 match `withoutDetail(...)` (a tightening, §3.3). Add the tests in §5 after line 880. Optionally, add `assert.match(..., /\(error 1 of 1; level warn; type Timeout; /)` to the existing tests at lines 798 to 880. No existing assertion is removed or loosened. |
| `docs/changes/semgrep-error-detail/*` | The pipeline records. |

**Out of scope, left alone on purpose:**

- `.github/workflows/security.yml`, `security.expected.yml`,
  `semgrep-job.expected.yml`, `run-semgrep.sh`, `run-semgrep.expected.sh`,
  `redact-report.mjs` and `redact-report.expected.mjs` (see §3.4, F2).
- The accepted parse-warning line, `gate.mjs` line 433 (F3).
- Rejections for npm, dotnet and gitleaks, and every Semgrep rejection in the
  `results` loop.
- `consumedFields`. It does not change (see §3.2).
- Whatever is causing #44's error. Fixing it is not part of this change. It
  becomes visible here and is fixed in its own change.
- `known-findings.json`, `fail-on-rules.json` and `.semgrepignore`.

**Follow-ups (not planned here):**

- **F1.** After this change merges, PR #44's branch takes it in (by merge or
  rebase, the GAP-07 builder's step), and its Semgrep job is re-run. The new
  detail line is quoted there. That is the proof the owner's goal ("so #44's
  cause becomes visible") was met. The cause is then fixed in its own change.
- **F2.** "Keep the report": only if O-1 says so, or if F1's detail is not
  enough.
- **F3.** Apply the same safe-path check to `semgrep parse warning: <path>`.

## 5. Test plan

**Failing tests first, committed alone (P-4, B-6).** The developer adds the
tests below and the `withoutDetail` tightening (§3.2) to `gate.test.mjs` without
changing `gate.mjs`, runs the suite, and commits that alone as
`semgrep-error-detail: Red tests`. The failing output is quoted in
`implementation.md`. In that run every new test fails, and each failure names
the assertion in the "Fails today on" column. This holds because each new test
asserts detail text the current gate never prints. The 63 existing tests stay
green, and that includes the tightened mutation test, because with no detail
`withoutDetail` returns the output unchanged. Only then does the developer change
`gate.mjs`, run the suite again, and commit it as a second commit. Nothing is
pushed between the two commits, so the pull request's CI runs on the green head.
 Each test uses `semgrepReport(...)`
(line 756) and `run(...)`. Each puts `canary` into `message`, into `spans` and,
where the type is an array, into `type[1]`. Each asserts `result.code === 1`,
that the canary is absent, and that no output line starts with `::`
(`result.out.split("\n").some((line) => line.startsWith("::"))` is `false`).

| # | Test name | Input | Asserts | Fails today on |
| --- | --- | --- | --- | --- |
| N1 | `a rejected semgrep error names its type, path and rule` | one error: `level: "warn"`, `type: "Timeout"`, `path: "website\\src\\app\\[[...path]]\\page.tsx"`, `rule_id: "javascript.lang.security.audit.example"` | matches `/field type is not a partial parse/`; contains `(error 1 of 1; level warn; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)` | the `includes` of the detail |
| N2 | `a rejected tagged semgrep error names only its tag` | `type: ["PatternParseError", [canary]]`, path `api\\src\\Example.cs`, no `rule_id` | contains `type PatternParseError; path api/src/Example.cs; rule (none))`; no canary (proves `type[1]` is not printed) | the `includes` of the detail |
| N3 | `a rejected semgrep error gives its position` | errors: `[valid PartialParsing, Timeout warn]` | contains `(error 2 of 2; level warn; type Timeout;` | the `includes` of the position |
| N4 | `a semgrep level rejection names the error and its level` | `level: "error"`, `type: "Timeout"`, no path | matches `/field level is not a parse warning/`; contains `(error 1 of 1; level error; type Timeout; path (none); rule (none))`; names the file | the `includes` of the detail |
| N5 | `hostile semgrep error types and levels are shown as unrecognised` | for each `type` in `"Timeout\n::error::injected"`, `"::error::injected"`, `"T".repeat(65)`, `"Out;of(memory)"`, `"Tïmeout"`, `42`, `null`, `{}`, `[]`, `[42, []]`, `["::error::injected", []]` (warn level, safe path). For each `level` in `"error\n::error::injected"`, `"::error::injected"`, `"e".repeat(65)`, `42`, `null`, `{}` (through the level rejection) | each: the right message; contains `type (unrecognised);` or `level (unrecognised);`; does not contain `injected` | the `includes` of the placeholder |
| N6 | `hostile semgrep error paths and rules are shown as unrecognised` | paths through the type rejection (a path must be a non-empty string to reach it): `"a\n::error::injected"`, `"a::error::injected"`, `"a".repeat(241)`, `"a;b"`, `"a(b)"`, `"a b"`. Paths through the path-missing rejection: `""`, `42`, `{}`, `null`. Rules: the same strings, plus `"r".repeat(201)`, `42`, `{}`, `null` | each: contains `path (unrecognised)` or `rule (unrecognised)` in the matching slot; does not contain `injected` | the `includes` of the placeholder |
| N7 | `a rejected semgrep error at the length limits is shown` | level 64 chars, tag 64 chars, path 240 chars, rule 200 chars, each valid | each value is printed in full (the boundary of N5 and N6) | the `includes` of each value |
| N8 | `a semgrep error with no path names its type and rule` | `level: "warn"`, `type: "Timeout"`, `rule_id: "csharp.example.rule"`, no `path` | matches `/field path is missing/`; contains `(error 1 of 1; level warn; type Timeout; path (none); rule csharp.example.rule)`; names the file | the `includes` of the detail |
| N9 | `a semgrep error that is not an object gives its position only` | errors: `[valid PartialParsing, valid PartialParsing, "x"]` | matches `/field error is not an object/`; contains `error is not an object (error 3 of 3)` and is followed by the end of the line | the `includes` of the position |
| N10 | `a malformed PartialParsing type is marked as malformed` | for each `type` in `"PartialParsing"`, `["PartialParsing"]`, `["PartialParsing", "locations"]`, path `api\\src\\Example.cs` | matches `/field type is not a partial parse/`; contains exactly `(error 1 of 1; level warn; type PartialParsing (malformed); path api/src/Example.cs; rule (none))`. One more case: a valid PartialParsing type at `level: "error"` contains `type PartialParsing; path` with no marker | the `includes` of the detail |

Expected count after the change: 63 + 10 = 73 tests. The developer reports the
exact number.

**Commands afterwards, quoted as run (P-8):**

- `node --test .github/security/gate.test.mjs`: all pass. The 63 existing tests
  must be unchanged and green, including "the fixture gate is the real gate",
  "semgrep mutations of every consumed field" and "every field the gate reads
  is listed, and every listed field is read".
- The mutation-guard regression check in §3.3: with the type check folded into
  the level check, `node --test --test-name-pattern='semgrep mutations' .github/security/gate.test.mjs`
  reports `# fail 1`. Restored afterwards, and never committed.
- `git log --oneline origin/rebuild/dotnet-platform..HEAD`: the red-test commit
  comes before the `gate.mjs` commit. `git show --stat` on the red commit lists
  only `gate.test.mjs`, and on the second commit lists `gate.mjs`.
- `node .github/security/gate.mjs semgrep <fixture>` on one N1 fixture and one
  N5 fixture: quote stderr and `echo $?` (`1`), so the actual line is on record.
- `git diff --stat origin/rebuild/dotnet-platform -- .github/`: lists only
  `gate.mjs` and `gate.test.mjs`.
- `git diff origin/rebuild/dotnet-platform -- .github/security/gate.mjs`: the
  hunks are limited to the header comment after line 23 and to lines 370 to 395.
- `git diff origin/rebuild/dotnet-platform -- .github/security/gate.test.mjs`: the
  hunks are limited to `withoutDetail` above line 510, lines 548 and 559, and the
  new tests after line 880.
- Merge check against PR #44, read-only: `git merge-tree --write-tree HEAD 4e1e4fe`
  (or `git merge-tree $(git merge-base HEAD 4e1e4fe) HEAD 4e1e4fe` on older Git)
  reports no conflict in `gate.mjs` or `gate.test.mjs`. If it does conflict, the
  developer reports it before doing anything else.

**On this pull request's CI (CI):**

- C1 "Security gate self-test": success, with the same test count as locally.
- C2 "Semgrep (ERROR fails, WARNING reported)": success is expected, since this
  branch does not contain #44's code. If it fails, the log line now carries the
  detail. The tester quotes it and reports it as a finding, not caused by this
  change unless the detail says otherwise. Semgrep also scans `.github/security`,
  so a new Semgrep finding on the new code would show here.
- C3 The CI workflow's jobs are unaffected. The tester quotes their conclusions.

**Track checklist, G1, Waves 1 to 3:**

- One gate per pull request (B-8): yes. One existing gate's rejection message
  changes, and no decision changes.
- A new gate reports for seven days, then blocks: not applicable, because there
  is no new gate.
- Every gate has a canary fixture (GAP-21): the Semgrep gate's existing canary
  tests stay. N1 to N10 add canary and hostile-value fixtures for the new output,
  and the mutation guard is tightened so it keeps telling the checks apart.
- Actions by SHA, image by digest, Node and .NET exact: not touched (GAP-09).
- Baselines only shrink: no baseline or allow-list is touched.

## 6. Security impact

- **Routes, policies, data, logins, secrets and dependencies:** none. This is a
  CI script only, and no package is added.
- **Information disclosure.** The CI log gains up to four tokens per rejection, plus the position.
  The level and the type tag are Semgrep enum-like names. The path is a file path, which the
  gate already prints for findings and parse warnings. The rule id is already
  printed for findings. The error's `message`, its `spans` and `type[1]` are
  never read, and the tests prove it with the canary. A value that does not
  match its strict pattern is replaced, never printed in part.
- **Log injection.** The patterns exclude `:`, newlines, control characters and
  non-ASCII, so no workflow command can be formed. N5 and N6 prove this,
  including the "no line starts with `::`" check.
- **Gate strength (P-6):** unchanged. The same checks run in the same order with
  the same exit code. No field is accepted that was rejected before.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. The gate goes back to the message without the detail.
No data or workflow state is involved.

## 9. Owner decisions needed

- **O-1.** "This change prints the rejected error's type, path and rule, and
  does not change the uploaded report. Do you still want the report kept when
  the Semgrep job fails (follow-up F2, which changes `security.yml`,
  `redact-report.mjs` and their golden copies), or is the printed detail
  enough?" O-1 goes to the owner with this pull request. This does not block
  this change, but until O-1 is answered the delivery and the pull request
  must not describe the card as fully delivered (§1, non-goal). The owner's "go on" covers printing
  the detail, and this plan defers the "keep the report" part to F2 rather than
  dropping it. If the owner says F2 is wanted, it becomes its own change. No
  answer is assumed here.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| A real Semgrep tag, path or rule is stricter than the patterns allow, and shows as `(unrecognised)` on #44 | The path pattern was checked against every tracked file in the scanned roots (§2). The type pattern allows Semgrep's spaced names (N1, existing types). N7 tests the boundaries. Even `(unrecognised)` plus `error i of n` narrows the search. F1 shows the real line |
| An existing assertion stops matching | The full 63-test suite is run; the message is only appended to |
| The detail's words (`error`, `level`, `type`, `path`) make the mutation guard pass when the wrong check rejects | `withoutDetail` in the guard (§3.3), and the regression check reporting `# fail 1` |
| The loop uses an array method and the read-tracking test fails on `["errors","entries"]` | §3.2 names the plain indexed loop only; the read-tracking test is in the commands |
| The read-tracking test fails because `rule_id` is read on the clean path | The detail is built only in the reject branch (§3.2); that test is named in the commands |
| A hostile value injects a workflow command or leaks matched source | N5 and N6 (placeholder, no `injected`, no line starting `::`), canary in `message`, `spans` and `type[1]` |
| A malformed PartialParsing line is read as a gate bug | The ` (malformed)` marker, asserted exactly by N10 |
| A merge conflict with PR #44 | The edit is limited to the header after line 23, lines 370 to 395 of `gate.mjs`, and tests after line 880; the `git merge-tree` check against `4e1e4fe` |
| Someone reads this as the fix for #44 | Scope and F1 say the cause is only made visible here |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A rejected Semgrep error prints its position, level, type tag, path (slashes) and rule | Owner, 8 Nov 2026 ("go on" on the card: "print the rejected error's type and path") | Planned | |
| The level and path-missing rejections carry the same detail; the not-an-object rejection carries the position | Change context; review round 1, findings 3 and 5; §3.1 | Planned | |
| A malformed PartialParsing type prints `type PartialParsing (malformed)` | Review round 1, finding 4; §3.1 | Planned | |
| The mutation guard matches `\b<field>\b` only before the detail, and the regression check fails it | P-6; review round 1, finding 1; §3.3 | Planned | |
| The red tests are committed alone before the `gate.mjs` commit | P-4, B-6; review round 1, finding 7; §5 | Planned | |
| `message`, `spans` and `type[1]` are never printed (canary) | Change context; `gate.mjs` header lines 17 to 23 | Planned | |
| Newline, `::`, overlong and non-string values show as `(unrecognised)`; absent ones show as `(none)` | Change context; this plan §3.1 | Planned | |
| Every report that fails today still fails with exit 1, and the existing messages still match | P-6 (`ENGINEERING_STANDARDS.md` line 27) | Planned | |
| The existing 63 self-tests pass (the mutation guard tightened only), and the 10 new tests pass | This plan §5 | Planned | |
| No `*.expected.*` golden file and no workflow changes | This plan §4 | Planned | |
| The diff merges cleanly with PR #44 head `4e1e4fe` | Change context; this plan §5 | Planned | |
| Keep the report when the Semgrep job fails | Owner's card, 8 Nov 2026 ("and keep the report") | Moved to F2, pending O-1 | §3.4; §4 F2; §9 O-1 |

## 12. Revision log

- Round 1 (8 November 2026): first version. There are no review points yet.
- Round 2 (8 November 2026), answering `plan-review.md` Round 1 (`99dd28b`):
  - **Finding 1 (Major, mutation guard).** Accepted. The two `\b<field>\b`
    assertions (lines 548 and 559) now match `withoutDetail(out)`, which cuts
    each line at the first ` (error `. This is a tightening, listed in §4. The
    alternatives `field <name>` and renamed labels are rejected for the
    reviewer's reasons (§3.3). The developer shows the reviewer's regression
    failing the suite (`# fail 1`) after the change. §1 Done-when 2, §3.2,
    §3.3, §5 commands, §10 and §11 are updated.
  - **Finding 2 (Minor, `entries()`).** Accepted. §3.2 names only the plain
    indexed loop and says why: no array method, since the proxy records it as
    a read field, while `length` is ignored at line 1538.
  - **Finding 3 (Minor, path-missing and not-an-object).** Accepted. The
    path-missing rejection in the errors loop gets the full detail, with
    `path (none)` or `(unrecognised)`; test N8. The not-an-object rejection gets
    the position only; test N9. The `results` loop is unchanged. The round 1
    reason is withdrawn (§3.5).
  - **Finding 4 (Minor, malformed PartialParsing).** Accepted, with a marker.
    When the tag is exactly `PartialParsing` but the shape is rejected, the fixed
    text ` (malformed)` follows it. N10 asserts the exact line for all three
    existing malformed shapes, plus the unmarked valid PartialParsing case at
    the wrong level.
  - **Finding 5 (Minor, level slot).** Accepted. There is a `level` slot after
    the position, under the tag pattern, with `(none)` and `(unrecognised)`. N4
    shows `level error`, N5 adds hostile levels, and N7 a 64-character level.
    Finding 1's fix covers the extra word.
  - **Finding 6 (Minor, the record of the split).** Accepted. Done-when 4 is now
    the non-goal in §1. The coverage row reads "Moved to F2, pending O-1" and
    names its destination. §1 and O-1 say that O-1 goes to the owner with the
    pull request, and that the delivery must not describe the card as fully
    delivered until O-1 is answered.
  - **Finding 7 (Minor, red commit).** Accepted. The red tests and the guard
    tightening are committed alone first as `semgrep-error-detail: Red tests`,
    with the failing output quoted in `implementation.md`, and then the
    `gate.mjs` commit. Each test names the assertion that fails today (§5,
    "Fails today on" column). Nothing is pushed between the two commits.
