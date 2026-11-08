# Plan: semgrep-error-detail — say which Semgrep error the gate rejected

Architect, round 1, 8 November 2026. Change branch `change/semgrep-error-detail`,
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
revision.

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
  1. When the gate rejects a Semgrep error, its message names that error's type,
     its path and its rule, if it has one. It never names the error's `message`,
     its `spans` or any other free text.
  2. Every report that fails today still fails, with the same exit code (1), and
     the existing message text is kept as a prefix (P-6).
  3. A hostile value never reaches the log. That covers a newline, `::`, an
     overlong value and a value that is not a string. Each one is shown as a
     fixed placeholder.
  4. "Keep the report" is covered in Design §3.4. This change does not keep the
     report. It is split out as follow-up change F2, and the owner is asked to
     confirm under O-1.

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

When `validateSemgrep` rejects an error for its level or its type, the existing
message is kept unchanged and a parenthesised detail is appended to it:

```
<file>: semgrep report field type is not a partial parse (error 2 of 3; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)
<file>: semgrep report field level is not a parse warning (error 1 of 1; type Timeout; path (none); rule (none))
```

The detail has four slots:

| Slot | Value | Shown when | Otherwise |
| --- | --- | --- | --- |
| index | `error <i> of <n>`: the 1-based position in `report.errors` and its length | always (two integers the gate computes) | — |
| type | the tag: `type` itself if it is a string, `type[0]` if `type` is a non-empty array | the tag is a string matching `^[A-Za-z][A-Za-z0-9 _-]{0,63}$` | `(none)` if `type` is absent (`undefined`); `(unrecognised)` for anything else, including `[]`, a non-string tag, `null`, an object or a number |
| path | `path` with `\` replaced by `/`, as the gate already does at lines 394 and 407 | the result is a string matching `^[A-Za-z0-9._@+\[\]/-]{1,240}$` | `(none)` if absent; `(unrecognised)` otherwise |
| rule | `rule_id` | a string matching `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$` | `(none)` if absent; `(unrecognised)` otherwise |

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
  (`Out of memory`, `Fatal error`).
- The path pattern allows `[` and `]` because `website/src/app/[[...path]]/page.tsx`
  is in a scanned root. The 240-character limit is well above the repository's
  longest path (107) plus the runner's checkout prefix.
- The rule pattern fits Semgrep's dotted rule ids.

**What is never read or printed:** `message`, `spans`, `details`, `type[1]` (the
locations) and any other field. The detail reads only `type`, `path` and
`rule_id`, and only after the gate has already decided to reject.

### 3.2 Where the code goes (kept local for the PR #44 merge)

- **New helpers** go directly above `function isPartialParse` (current line 376):
  three pattern constants, a small `shown(value, pattern)` that returns the value
  or the placeholder, and `describeSemgrepError(error, index, count)` that builds
  the ` (error …)` suffix. None of them is exported. Exporting would add a
  surface the self-test would need to cover. They are tested through the CLI,
  as every other rejection is.
- **`validateSemgrep`.** The `for … of` over `report.errors` becomes an indexed
  loop, or `entries()`, so the index is known. The two `reject(...)` calls for
  level and type append `describeSemgrepError(error, index, report.errors.length)`.
  No other line in `validateSemgrep` changes.
- **The detail is built only inside the rejecting branch.** This keeps the
  read-tracking test (lines 1565 to 1592) green: a clean report never reads
  `rule_id`. It also explains why `rule_id` is **not** added to
  `consumedFields`. It does not affect any decision. Listing it would make the
  mutation tests expect a wrong-typed `rule_id` to fail the gate, which would be
  a behaviour change. The header comment says this.
- **Header comment.** Lines 14 to 23 get two or three more lines, after line 23
  ("are not read."): a rejected error is described by its position, the tag of
  its type, its path and its `rule_id`, each only when it matches a strict
  pattern and otherwise as `(none)` or `(unrecognised)`. `rule_id` is read only
  for that description and is not a consumed field. PR #44's nearest header hunk
  starts at line 26, so the two edits do not overlap.
- **New tests** go in `gate.test.mjs` directly after "a malformed semgrep
  PartialParsing type fails" (current line 880), before `const requiredRoots`.
  They do not go at the end of the file, where PR #44 appends.

### 3.3 Exit codes and existing messages (P-6)

`reject` is unchanged, so it still exits with code 1. The order of the checks is
unchanged, so every report that is rejected today is still rejected, by the same
check. Each existing message is still the start of the line, so
`/field type is not a partial parse/`, `/field level is not a parse warning/`,
the file name and `\b<field>\b` all still match. The `path is missing` and
`error is not an object` rejections get no detail. In the first case there is no
safe path to show. In the second there is no record to read. Both are unchanged.

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
   three strictly-checked tokens publishes less.
4. **It would collide with PR #44.** PR #44 also edits `security.yml` and
   `security.expected.yml`. A second edit to the same golden files would make
   the merge harder.

If the detail turns out not to be enough to fix #44's cause, F2 keeps a report
that contains only the same three sanitised fields. O-1 asks the owner to
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
| `.github/security/gate.mjs` | Add three pattern constants, `shown()` and `describeSemgrepError()` directly above `isPartialParse` (line 376). In `validateSemgrep` (lines 388 to 395), make the errors loop indexed and append the detail to the two `reject` calls for level and type. Add 2 to 3 header comment lines after line 23. Nothing else. |
| `.github/security/gate.test.mjs` | Add the tests in §5, after line 880. Optionally, add `assert.match(..., /\(error 1 of 1; type Timeout; /)` to the existing tests at lines 798 to 880. No existing assertion is removed or loosened. |
| `docs/changes/semgrep-error-detail/*` | The pipeline records. |

**Out of scope, left alone on purpose:**

- `.github/workflows/security.yml`, `security.expected.yml`,
  `semgrep-job.expected.yml`, `run-semgrep.sh`, `run-semgrep.expected.sh`,
  `redact-report.mjs` and `redact-report.expected.mjs` (see §3.4, F2).
- The accepted parse-warning line, `gate.mjs` line 433 (F3).
- Rejections for npm, dotnet and gitleaks, and the other Semgrep rejections
  (`error is not an object`, `path is missing`, every `results` check).
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

**Failing tests first.** The developer adds these tests before changing
`gate.mjs` and runs them. The detail assertions must fail ("does not match" or
"includes"), while every existing test still passes. Then the developer makes
the `gate.mjs` change and runs them again. Each test uses `semgrepReport(...)`
(line 756) and `run(...)`. Each puts `canary` into `message`, into `spans` and,
where the type is an array, into `type[1]`. Each asserts `result.code === 1`,
that the canary is absent, and that no output line starts with `::`
(`result.out.split("\n").some((line) => line.startsWith("::"))` is `false`).

| # | Test name | Input | Asserts |
| --- | --- | --- | --- |
| N1 | `a rejected semgrep error names its type, path and rule` | one error: `level: "warn"`, `type: "Timeout"`, `path: "website\\src\\app\\[[...path]]\\page.tsx"`, `rule_id: "javascript.lang.security.audit.example"` | matches `/field type is not a partial parse/`; contains `(error 1 of 1; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)` |
| N2 | `a rejected tagged semgrep error names only its tag` | `type: ["PatternParseError", [canary]]`, path `api\\src\\Example.cs`, no `rule_id` | contains `type PatternParseError; path api/src/Example.cs; rule (none))`; no canary (proves `type[1]` is not printed) |
| N3 | `a rejected semgrep error gives its position` | errors: `[valid PartialParsing, Timeout warn]` | contains `(error 2 of 2; type Timeout;` |
| N4 | `a semgrep level rejection names the error too` | `level: "error"`, `type: "Timeout"`, no path | matches `/field level is not a parse warning/`; contains `(error 1 of 1; type Timeout; path (none); rule (none))`; names the file |
| N5 | `hostile semgrep error types are shown as unrecognised` | for each `type` in `"Timeout\n::error::injected"`, `"::error::injected"`, `"T".repeat(65)`, `"Out;of(memory)"`, `"Tïmeout"`, `42`, `null`, `{}`, `[]`, `[42, []]`, `["::error::injected", []]` (warn level, safe path) | each: `/field type is not a partial parse/`, contains `type (unrecognised);`, does not contain `injected` |
| N6 | `hostile semgrep error paths and rules are shown as unrecognised` | paths through the type rejection (a path must be a non-empty string to reach it): `"a\n::error::injected"`, `"a::error::injected"`, `"a".repeat(241)`, `"a;b"`, `"a(b)"`, `"a b"`. Paths through the level rejection (`level: "error"`, where the path is not checked yet): `42`, `{}`, `null`. Rules: the same strings, plus `"r".repeat(201)`, `42`, `{}`, `null` | each: contains `path (unrecognised)` or `rule (unrecognised)` in the matching slot; does not contain `injected` |
| N7 | `a rejected semgrep error at the length limits is shown` | tag 64 chars, path 240 chars, rule 200 chars, each valid | each value is printed in full (the boundary of N5 and N6) |

Expected count after the change: 63 + 7 = 70 tests. The developer reports the
exact number.

**Commands afterwards, quoted as run (P-8):**

- `node --test .github/security/gate.test.mjs`: all pass. The 63 existing tests
  must be unchanged and green, including "the fixture gate is the real gate",
  "semgrep mutations of every consumed field" and "every field the gate reads
  is listed, and every listed field is read".
- `node .github/security/gate.mjs semgrep <fixture>` on one N1 fixture and one
  N5 fixture: quote stderr and `echo $?` (`1`), so the actual line is on record.
- `git diff --stat origin/rebuild/dotnet-platform -- .github/`: lists only
  `gate.mjs` and `gate.test.mjs`.
- `git diff origin/rebuild/dotnet-platform -- .github/security/gate.mjs`: the
  hunks are limited to the header comment after line 23 and to lines 370 to 395.
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
  tests stay. N1 to N6 add canary and hostile-value fixtures for the new output.
- Actions by SHA, image by digest, Node and .NET exact: not touched (GAP-09).
- Baselines only shrink: no baseline or allow-list is touched.

## 6. Security impact

- **Routes, policies, data, logins, secrets and dependencies:** none. This is a
  CI script only, and no package is added.
- **Information disclosure.** The CI log gains up to three tokens per rejection.
  The type tag is a Semgrep enum-like name. The path is a file path, which the
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
  enough?" This does not block this change. The owner's "go on" covers printing
  the detail, and this plan defers the "keep the report" part to F2 rather than
  dropping it. If the owner says F2 is wanted, it becomes its own change. No
  answer is assumed here.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| A real Semgrep tag, path or rule is stricter than the patterns allow, and shows as `(unrecognised)` on #44 | The path pattern was checked against every tracked file in the scanned roots (§2). The type pattern allows Semgrep's spaced names (N1, existing types). N7 tests the boundaries. Even `(unrecognised)` plus `error i of n` narrows the search. F1 shows the real line |
| An existing assertion stops matching | The full 63-test suite is run unchanged; the message is only appended to |
| The read-tracking test fails because `rule_id` is read on the clean path | The detail is built only in the reject branch (§3.2); that test is named in the commands |
| A hostile value injects a workflow command or leaks matched source | N5 and N6 (placeholder, no `injected`, no line starting `::`), canary in `message`, `spans` and `type[1]` |
| A merge conflict with PR #44 | The edit is limited to the header after line 23, lines 370 to 395 of `gate.mjs`, and tests after line 880; the `git merge-tree` check against `4e1e4fe` |
| Someone reads this as the fix for #44 | Scope and F1 say the cause is only made visible here |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A rejected Semgrep error prints its position, type tag, path (slashes) and rule | Owner, 8 Nov 2026 ("go on" on the card: "print the rejected error's type and path") | Planned | |
| The level rejection carries the same detail | Change context; this plan §3.1 | Planned | |
| `message`, `spans` and `type[1]` are never printed (canary) | Change context; `gate.mjs` header lines 17 to 23 | Planned | |
| Newline, `::`, overlong and non-string values show as `(unrecognised)`; absent ones show as `(none)` | Change context; this plan §3.1 | Planned | |
| Every report that fails today still fails with exit 1, and the existing messages still match | P-6 (`ENGINEERING_STANDARDS.md` line 27) | Planned | |
| The existing 63 self-tests pass unchanged, and the new tests pass | This plan §5 | Planned | |
| No `*.expected.*` golden file and no workflow changes | This plan §4 | Planned | |
| The diff merges cleanly with PR #44 head `4e1e4fe` | Change context; this plan §5 | Planned | |
| "Keep the report" is split to F2 and put to the owner as O-1 | Owner's card; this plan §3.4 | Planned | |

## 12. Revision log

- Round 1 (8 November 2026): first version. There are no review points yet.
