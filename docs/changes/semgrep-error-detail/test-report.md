# Test report: semgrep-error-detail

## Round 1

Tester and security reviewer, round 1, 8 November 2026. **Commit tested:
`8677d40`** (branch `change/semgrep-error-detail`, `implementation.md`
`Status: READY FOR TEST`; code head `a937510`, red-test commit `331b19b`), in a
detached worktree `/home/user/wt-check-sed`. Base for every comparison: `5c38406`
(`origin/rebuild/dotnet-platform`, the branch's merge base). Node v22.23.4, git
2.43.0. `git rev-parse --is-shallow-repository` → `false`; no `git fetch` of any
kind was run. Nothing was pushed. The tester did not build this change.

Each commit's suite ran in its own `git archive <sha> | tar -x` copy under
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/sed/`
(below `<scratch>`), so no checkout was edited. Mutations were applied only to a
scratch copy; `git status --short` in the worktree was empty after every step.

Read first: `.claude/agents/tester.md`, `docs/changes/README.md`, `AGENTS.md` and
`ENGINEERING_STANDARDS.md` (reference copy in the scratchpad `ref/` folder), then
`plan.md` (round 2), `plan-review.md`, `plan-approval.md` (nine conditions) and
`implementation.md` in this folder. Track: not a refinement item; the gate's
behaviour on every report must be unchanged (P-6).

### 1. Red tests were red, green on the head

```
$ node --test .github/security/gate.test.mjs        # each in its own archive copy
5c38406 (base)   exit 0   # tests 63  # pass 63  # fail 0
331b19b (red)    exit 1   # tests 73  # pass 63  # fail 10
a937510 (fix)    exit 0   # tests 73  # pass 73  # fail 0
8677d40 (head)   exit 0   # tests 73  # pass 73  # fail 0
```

At `331b19b` the ten failures are exactly N1 to N10, and nothing else:

```
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

Every failure is on the detail assertion (`operator: '=='` from `assert.ok(...includes(detail))`
for N1 to N8 and N10, `operator: 'match'` for N9's `\(error 3 of 3\)$`), at
`gate.test.mjs` 922, 932, 941, 947, 1008, 1014, 1024 and inside the `forEach` at
964/967 (N5), 981/984 (N6) and 1028 (N10). The exit-code, file-name, canary and
no-`::` assertions in `semgrepErrorRun` had already passed, so the red is for the
reason the plan gives (base message, no detail). The tightened mutation test
passes at `331b19b` against the base gate.

### 2. Diff scope (conditions 1, 2, 9)

```
$ git diff --name-only 5c38406 8677d40
.github/security/gate.mjs
.github/security/gate.test.mjs
docs/changes/semgrep-error-detail/implementation.md
docs/changes/semgrep-error-detail/plan-approval.md
docs/changes/semgrep-error-detail/plan-review.md
docs/changes/semgrep-error-detail/plan.md
```

- `331b19b` touches only `gate.test.mjs` (+157/−2); `a937510` only `gate.mjs`
  (+35/−6); `8677d40` only `implementation.md`. Red committed alone before the fix.
- The only lines removed from `gate.test.mjs` are the two `\b${spec.field}\b`
  assertions (base lines 549 and 561, confirmed with `git show 5c38406:… | sed -n '549p;561p'`),
  each replaced by the same assertion on `withoutDetail(...)`. No other existing
  assertion changed: 62 tests unchanged, 1 tightened.
- `gate.mjs`: header lines after old line 23; three patterns, `shown` and
  `describeSemgrepError` directly above `isPartialParse`, none exported; the
  errors loop is a plain indexed `for` (grep for `.map(`/`.forEach(`/`.some(` etc.
  in the loop: no match, exit 1); the detail is inside each `reject(...)` template,
  evaluated only when the check has failed. `rule_id` appears only in the header,
  the comment and `describeSemgrepError`, not in `consumedFields`. The accepted
  line is byte-identical: base line 433 = head line 462
  (`for (const parsePath of found.parseWarnings) console.log(\`semgrep parse warning: ${parsePath}\`);`).
- No workflow, no `*.expected.*` golden copy, no `redact-report.mjs`, no
  `run-semgrep.sh`, no `known-findings.json` change.
- Commits: subjects prefixed `semgrep-error-detail:`, imperative, bodies say why
  (#44's line names no error), both trailers present.
  `git branch -r --contains 331b19b` → empty (not pushed).

### 3. P-6: no rejection weakened (own mutations)

Each mutation was applied to a scratch copy of the head's `gate.mjs` and the full
suite was run (`node --test .github/security/gate.test.mjs`). Script:
`<scratch>/scripts/mutate.mjs`. Never committed.

| # | Mutation | Suite | Caught by (first tests) |
|---|---|---|---|
| M1 | Delete the type check | exit 1, fail 16 | mutations of every consumed field; Timeout / Out of memory / Stack overflow at warn fail |
| M2 | Delete the level check (any level) | exit 1, fail 7 | mutations; a semgrep scan error fails…; N4; N5 |
| M3 | Swap order: type, path, level | exit 1, fail 6 | a semgrep scan error fails…; N4; N5; N6 |
| M4 | Swap order: path before level | exit 1, fail 2 | a semgrep scan error fails…; N4 |
| M5 | Delete the path check | exit 1, fail 3 | mutations; N6; N8 |
| M6 | Delete the not-an-object check | exit 1, fail 2 | mutations; N9 |
| M7 | Fold the type check into the level check (§3.3) | exit 1, fail 16 | mutations (`semgrep ["errors",0,"type"] null did not name the field`), … |
| M8 | `isPartialParse` accepts any `type[1]` | exit 1, fail 3 | mutations; a malformed semgrep PartialParsing type fails; N10 |
| M9 | `isPartialParse` accepts any tag | exit 1, fail 3 | mutations; N2; N5 |
| M10 | Level check accepts `"warn"` or `"warning"` | **exit 0, fail 0** | **survives** (finding 1) |
| M11 | `reject` exits 0 | exit 1, fail 41 | every rejection test |
| M12 | Detail prints `error.message` | exit 1, fail 18 | a semgrep scan error … does not print the error body; N tests (canary) |
| M13 | Detail prints `type[1]` and skips the tag pattern | exit 1, fail 4 | N2; N5; N7; N10 |
| M14 | `shown()` returns any string | exit 1, fail 2 | N5; N6 |
| M15 | Tag pattern without `$` | exit 1, fail 1 | N5 |
| M16 | Path pattern `[\s\S]{1,240}` | exit 1, fail 1 | N6 |
| M17 | Rule pattern with `m` flag | exit 1, fail 1 | N6 |
| M18 | Path length 250 | exit 1, fail 1 | N6 |
| M19 | Detail built eagerly before the checks | exit 1, fail 2 | mutations; every field the gate reads is listed… |
| M20 | Position off by one | exit 1, fail 6 | N1; N3; N4; N7 |
| M21 | No `(malformed)` marker | exit 1, fail 1 | N10 |
| M22 | No `\` → `/` in the detail | exit 1, fail 4 | N1; N2; N6; N10 |
| M23 | Level slot accepts any string | exit 1, fail 1 | N5 |
| M24 | Type check skipped when `rule_id` is set | exit 1, fail 2 | N1; N6 |

23 of 24 mutations are caught. M10 also survives on the base `5c38406` (same
replacement there: exit 0, fail 0), as does accepting `"info"`; the narrower
mutation "reject only `level === "error"`" is caught on both (base: fail 1,
mutations; head: fail 3, adds N5 and N7). So the gap predates this change and
the change does not widen it.

### 4. Security: hostile fixtures through the CLI

The workflow calls the gate from the repository root as
`node .github/security/gate.mjs semgrep "$RUNNER_TEMP/semgrep.json"`
(`run-semgrep.sh` line 62). The same form was used, from `/home/user/wt-check-sed`
at `8677d40`. Script: `<scratch>/scripts/hostile.mjs`; fixtures in `<scratch>/fx/`.

A GitHub-token-shaped canary (`ghp_` prefix, value not reproduced here so the secret scan stays clean) in `message`, `spans`,
`details`, `extra.secret`, an extra key named by the canary, `type[1]` and the
locations of a valid PartialParsing type, on every fixture. Hostile strings (18):
`\n`, `\r`, `\r\n`, U+2028, U+2029, U+0085, NUL, TAB, VT, FF, each followed by
`::error::INJ`; bare `::error::INJ`; `%0A::error::INJ`; `a%0D%0A::warning::INJ`;
ANSI `ESC[2K\r::error::INJ`; OSC 8 hyperlink; `x::add-mask::INJ`; 100 000
characters. Each placed in the type string, the type tag (`[v, [canary]]`), the
level, the path and the rule_id. Non-strings (14): `0`, `1.5`, `-1`, `true`,
`false`, `null`, `{}`, `{a: canary}`, `[]`, `[canary]`, `["Timeout"]`,
`[[canary]]`, `""`, `" "`, in each slot, as `type[1]` (with a third element) and
as a second `errors` entry. Plus: 5001 errors with the last one bad; all four
slots hostile at once; a `__proto__` key carrying `type`; a raw lone surrogate
`\ud800::error::INJ` in the type.

Checks on each run: exit code 1; stdout empty; stderr exactly one line (split on
`\n`, `\r`, U+2028, U+2029, U+0085); it starts with `<file>: semgrep report field `;
no line starts with `::`; no `INJ`; no canary; no control or non-ASCII character;
under 1200 characters.

```
178 fixtures, 1 with problems
o-type-9: canary leaked
  ".../fx/o-type-9.json: semgrep report field type is not a partial parse (error 1 of 1; level warn; type <canary>; path api/x.cs; rule (none))\n"
```

`o-type-9` is `type: [canary]`: the canary is in `type[0]`, the tag slot, which
the plan prints by design when it matches the tag pattern. It is not `type[1]`,
`message`, `spans` or an extra field; no canary in those places reached the output
in any of the 178 runs. See note A. Samples:

```
type-str-0  (type "a\n::error::INJ")   ...: semgrep report field type is not a partial parse (error 1 of 1; level warn; type (unrecognised); path api/x.cs; rule (none))
type-tag-3  (type ["a ::error::INJ",[canary]])  ... type (unrecognised); path api/x.cs; rule (none))
level-9     (level "\u001b[2K\r::error::INJ")         ...: semgrep report field level is not a parse warning (error 1 of 1; level (unrecognised); type PartialParsing; path api/x.cs; rule (none))
path-rej-13 (path of 100 000 chars)                  ... type Timeout; path (unrecognised); rule (none))
rule-2      (rule_id "a\r\n::error::INJ")             ... path api/x.cs; rule (unrecognised))
o-type1-0   (type ["PartialParsing", 0, canary])     ... type PartialParsing (malformed); path api/x.cs; rule (none))
o-error-6   (second error {})                        ...: semgrep report field level is not a parse warning (error 2 of 2; level (none); type (none); path (none); rule (none))
many        (5001 errors, last Timeout)              ... (error 5001 of 5001; level warn; type Timeout; path api/x.cs; rule (none))
all         (four hostile slots)                     ... (error 1 of 1; level (unrecognised); type (unrecognised); path (unrecognised); rule (unrecognised))
proto       ({"__proto__":{"type":"Timeout"},...})   ... type (none); path api/x.cs; rule (none))
raw-surrogate                                        ... type (unrecognised); path api/x.cs; rule (none))
```

Every rejection exits 1. No output line begins with `::`.

**F3 is unchanged, not worsened.** The tech lead's reproduction on both commits:

```
$ node .github/security/gate.mjs semgrep <scratch>/fx/f3.json   # {level:"warn", path:"a\n::error::x", type:["PartialParsing",[]]}
semgrep parse warning: a
::error::x
semgrep: 0 finding(s) at the gate's level; 0 known, 0 new. Known but no longer found …
5c38406 exit 0
8677d40 exit 0   (identical output)
```

It stays a recorded security defect for its own change (implementation.md F3),
as condition 6 requires.

**Other security checks.**

| Check | Command | Exit | Result |
|---|---|---|---|
| gitleaks on this change | `RUNNER_TEMP=<scratch>/gl bash .github/security/run-gitleaks.sh pr-diff <scratch>/gl/pr.json "5c38406..8677d40"` (gitleaks 8.30.1, tarball sha256 `551f6fc8…f2470eb` = `security.yml` `GITLEAKS_SHA256`) | 0 | `no leaks found`; `pr-diff: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Secret patterns in the diff | `git diff 5c38406 8677d40 \| grep -nE 'ghp_\|AKIA\|xox[bp]-\|-----BEGIN\|password\s*='` | 1 | no match; the test canary is `CANARY-NOT-A-SECRET` |
| Semgrep | NOT RUN | | `semgrep` not installed and registry packs not reachable here; covered by `security.yml` job `semgrep` (C2) |
| npm / .NET audit | NOT RUN | | no package, lockfile or project changed; covered by `security.yml` audit jobs |
| Routes, roles, host checks, RFC 7807 | Not applicable | | no route changed |

### 5. Merge with PR #44

```
$ git rev-parse origin/change/GAP-07
4e1e4febae7ddf8598ad7b3504b40a68f491b189
$ git merge-tree --write-tree HEAD origin/change/GAP-07       # HEAD = 8677d40
454e763cf394ffb2874d5cfc2fdcbcd15cbeea28
exit 0
$ git merge-tree --write-tree a937510 origin/change/GAP-07
ec4fc0a08c611a65b622d82d6c4157a129c791d8                      # the developer's tree, reproduced
$ git archive 454e763 | tar -x -C <scratch>/merged && cd <scratch>/merged
$ node --test .github/security/gate.test.mjs
# tests 85
# pass 85
# fail 0
exit 0
```

#44's head is still `4e1e4fe`. Clean merge; the merged tree's self-test is green.
The tree differs from the developer's `ec4fc0a` only because the head now
includes `implementation.md`.

### 6. Not run

| Check | Reason | Covered by |
|---|---|---|
| C1 "Security gate self-test" in CI | Not pushed; Actions cannot run here | PR CI; must report 73 tests |
| C2 Semgrep job | Semgrep not installed here | PR CI `semgrep` |
| `dotnet test`, website and studio suites | No file they use changed | PR CI |

### Findings

1. **Minor (pre-existing, not introduced by this change).** The self-test does not
   pin the accepted level to exactly `"warn"`.
   Steps: in a scratch copy of `gate.mjs` (base `5c38406` or head `8677d40`),
   replace `error.level !== "warn"` with `!["warn","warning"].includes(error.level)`
   (or `"info"`), then run `node --test .github/security/gate.test.mjs`.
   Expected: at least one failing test, because a report with level `"warning"` and
   a valid PartialParsing type would then be accepted instead of failing.
   Actual: `# fail 0`, exit 0 on both commits. No test has a non-`warn` string
   level together with a valid PartialParsing type except N10's `"error"`, which
   only kills the narrower mutation. This change does not widen the gap, and
   fixing it is a test-only change outside this change's scope (B-8);
   recommended as a follow-up for the developer to record (for example, F4: a test
   that `level: "warning"` and `level: "info"` with a valid PartialParsing type
   fail).

No Blocker or Major.

Note A (by design, not a finding): the tag (`type[0]`), path and rule_id slots
print any value that matches their pattern, including a secret-shaped string such
as `ghp_…` (fixture `o-type-9`). The plan and the `gate.mjs` header state this:
these values come from Semgrep's own error tag, the rule pack's id and the
repository file path, not from scanned content, and the patterns exclude every
character that could form a workflow command. The never-printed fields
(`message`, `spans`, `type[1]`, unknown fields) did not leak in any run.

### Coverage

| Item | Source | Status | Evidence |
|---|---|---|---|
| Base suite green | Plan §2 | Verified | `5c38406`: 63 / 63, exit 0 (§1) |
| Red at `331b19b` fails exactly N1–N10, on the detail assertion | Condition 2; P-4, B-6 | Verified | 73 tests, 63 pass, 10 fail, tests 45–54 only (§1) |
| Head green, 73 tests | Condition 4 | Verified | `a937510` and `8677d40`: 73 / 73, exit 0 (§1) |
| 62 unchanged, 1 tightened, line numbers 549 and 561 | Conditions 3, 4 | Verified | Only the two `\b<field>\b` lines removed and replaced with `withoutDetail(...)` (§2) |
| Scope: only `gate.mjs`, `gate.test.mjs`, docs | Condition 1 | Verified | `git diff --name-only` (§2) |
| Helpers placed, indexed loop, detail only on reject, `rule_id` not consumed, line 433 untouched | Condition 1 | Verified | §2; M19 shows an eager detail would be caught |
| Mutation guard still separates the checks (§3.3) | Condition 5; P-6 | Verified | M7: fail 16, `semgrep ["errors",0,"type"] null did not name the field` (§3) |
| No rejection weakened | P-6 | Verified, with finding 1 | 23 of 24 own mutations caught; M10 survives on base and head alike (§3) |
| CLI output for rejected errors: exit 1, one line, no `::`, no canary in hidden fields | Condition 5; plan §3.1 | Verified | 178 hostile fixtures, all exit 1, no `::` line, no injected text, no control or non-ASCII (§4) |
| Secret canary in message, spans, `type[1]`, extra fields never printed | `gate.mjs` header; plan §3.1 | Verified | §4; note A for `type[0]` |
| F3 recorded as security defect, unchanged | Condition 6 | Verified | Reproduced, identical on base and head, exit 0 (§4); implementation.md F3 |
| O-1 open, "type, path and rule printed; keeping the report moved to F2, pending O-1" | Condition 7 | Verified | implementation.md, opening and Owner decision open |
| Clean merge with #44 `4e1e4fe`, merged suite green | Condition 8 | Verified | `merge-tree` exit 0, tree `454e763`; 85 / 85 (§5) |
| Commit subjects, bodies, trailers, not pushed | Condition 9; B-4 | Verified | §2 |
| No secret in the diff | tester.md, security | Verified | gitleaks pr-diff 0 findings; pattern grep no match (§4) |
| Semgrep over the change | tester.md, security | NOT RUN | Not installed; `security.yml` job `semgrep` (C2) |
| CI self-test count | Plan-approval notes for tester | NOT RUN | Not pushed; C1 must report 73 |

Verdict: APPROVED
