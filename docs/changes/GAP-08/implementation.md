# GAP-08: add actionlint (implementation)

Role: developer (step 4). Branch `change/GAP-08`, worktree
`/home/user/wt-GAP-08`, base `6470fac` (`origin/rebuild/dotnet-platform`, which
had not moved when checked on 2026-11-01 after `git fetch`). Date 2026-11-01.
`plan-approval.md` ends `Verdict: APPROVED`; this is round 1 (no test report or
delivery approval yet). Governing documents read from the read-only copies
outside the repository: `docs/changes/README.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md`, the PR template.

## Commits

| SHA | Subject |
| --- | --- |
| `c6183b3` | GAP-08: Add failing self-test and canary for the actionlint gate (red) |
| `69f0b86` | GAP-08: Lint every workflow with actionlint (the gate) |
| this commit | GAP-08: Implementation record |

## What changed, by file (plan section 4, Scope)

| File | Plan scope row | What it holds |
| --- | --- | --- |
| `.github/workflows/workflow-lint.yml` | New workflow | Header comment (what it checks, report week, pins and their sources, why separate, why no `paths`/`if:`); triggers `pull_request`, `push` to `rebuild/dotnet-platform`, `workflow_dispatch`; `permissions: contents: read`; `concurrency` `workflow-lint-${{ github.ref }}`; env with the two versions, two sha256 values (each with its source) and `ACTIONLINT_BLOCKING_FROM: "2026-11-11"`; one job `actionlint (every workflow)` on `ubuntu-24.04` with the five steps of plan section 3, checkout pinned `11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`, `persist-credentials: false`. No `continue-on-error`, no `if:`, no inline node or python. I added `timeout-minutes: 10` to the job (a bound, not a loosening). |
| `.github/lint/install-actionlint.sh` | Installer | `#!/bin/sh`, `set -eu`; downloads both release assets into `$RUNNER_TEMP` with `curl -sSfL`, `sha256sum --check --strict` each, extracts only `actionlint` and `shellcheck`, prints both versions. |
| `.github/lint/run-actionlint.sh` | The gate | Modes `workflows` and `canary`, every rule in plan section 3. |
| `.github/lint/self-test.sh` | Self-test | The 17 cases of plan section 5, plus condition 1 of the approval in case 17. |
| `.github/lint/canary/canary-workflow.yml` | Canary fixture | The plan's fixture, with a longer header (approval condition 2). |
| `.github/lint/canary.expected` | Expected findings | Six `line:col:kind` lines. |
| `docs/changes/GAP-08/implementation.md` | Records | This file. |

Nothing else changed: `ci.yml`, `security.yml`, `codeql.yml`,
`.github/security/*`, `dependabot.yml` and `.gitattributes` are untouched (step 8).

### One difference from the plan's literal text, and why

The plan's `canary.expected` lists `11:3`, `12:14`, `17:11`, `18:24`, `19:24`,
`20:9`. Approval condition 2 requires the canary's header comment to explain
the deliberate `@v4` and the GAP-09 scoping; that header is four lines longer
than the plan's two, so every finding moves down four lines. The committed
`canary.expected` is therefore `15:3:job-needs`, `16:14:runner-label`,
`21:11:action`, `22:24:expression`, `23:24:expression`, `24:9:shellcheck`:
the same six kinds and columns, taken from the real actionlint 1.7.12 with
shellcheck 0.11.0 output quoted under step 3. The design is unchanged.

## Approval conditions

| # | Condition | How it is met |
| --- | --- | --- |
| 1 | Case 17 also asserts no `if:` and no `paths:`/`paths-ignore:` | `check_workflow` in `self-test.sh` fails on any `if:` key (job or step, including `- if:`), any `paths:` or `paths-ignore:` key, any `continue-on-error`, any `uses:` not `owner/repo@<40 hex>`, and a blocking date that is not a real `YYYY-MM-DD` or is after `2026-11-23`. Mutation run below: each of the eight mutations makes case 17 fail. |
| 2 | Canary header explains `@v4`; PR description repeats it | Canary lines 3 to 6: "The `actions/checkout@v4` tag below is deliberate: actionlint knows an action's inputs by tag, so mistake 3 needs a tag, not a SHA. Any "every uses: is pinned by a 40-character SHA" check (GAP-09) must be scoped to .github/workflows/ and must not read this file." The draft PR description below repeats it. I do not open the pull request (never push); the integrator uses the draft. |
| 3 | Blocking date at least seven days after the actual merge, no later than 2026-11-23; BLOCKED ON OWNER if the merge slips past 16 November | See "Blocking date" below. |
| 4 | Self-test committed red before `run-actionlint.sh`, red run quoted | `c6183b3` contains only `self-test.sh`, the canary and `canary.expected`; red run under step 0. |
| 5 | Every test-plan step quoted | Steps 0 to 8 below. |
| 6 | Diff limited to `.github/workflows/workflow-lint.yml`, `.github/lint/**`, `docs/changes/GAP-08/**`; rebase if the base moves | Step 8. The base had not moved (`origin/rebuild/dotnet-platform` = `6470fac` after `git fetch`), so no rebase. |

### Blocking date

**Assumption: the pull request merges no earlier than 2026-11-04** (Wave 1's
merge window opens 3 November; Wave 0 goes first; one merge a day; nothing
merges without the owner's OK). The merge date is not known today.
`ACTIONLINT_BLOCKING_FROM` is therefore set to **`2026-11-11`**, merge date
plus seven days for a 4 November merge, as plan section 3 says.

For gate 2, the owner and the integrator:

- If the merge happens after 2026-11-04, move `ACTIONLINT_BLOCKING_FROM` in
  this pull request, before merge, to the merge date plus seven days. Case 17
  of the self-test will still pass for any real date up to `2026-11-23`.
- If the merge slips past 2026-11-16, merge plus seven days is after
  `2026-11-23` and both bounds cannot hold: stop, and the change is BLOCKED ON
  OWNER (schedule exception under P-7). Neither bound is to be dropped.

## Commands run, with exit codes

Local runs use `TMPDIR` set to the session scratchpad, so `mktemp -d` lands
there. Tools: actionlint and shellcheck installed by the gate's own installer
(step 1), bash 5, GNU coreutils, Node 22.

### Step 0, self-test: red, then green

Red, at `c6183b3` (before `run-actionlint.sh` and `workflow-lint.yml` existed):

```
$ bash .github/lint/self-test.sh                                       exit=1
FAIL 1 no findings: exit 127, expected 0; output: bash: /tmp/tmp.YSqqjFigJz/1/repo/.github/lint/run-actionlint.sh: No such file or directory
FAIL 2 finding in report mode: exit 127, expected 0; output: bash: .../2/repo/.github/lint/run-actionlint.sh: No such file or directory
...                (every case 1 to 16 fails the same way: exit 127, script missing)
FAIL 16 arguments, canary mode: gate exit 127; output: bash: .../28/repo/.github/lint/run-actionlint.sh: No such file or directory
FAIL 17 workflow-lint.yml shape: /home/user/wt-GAP-08/.github/workflows/workflow-lint.yml is missing

actionlint gate self-test: 30 failed
```

(30 checks: case 8 runs four bad dates, case 9 two, case 10 four, cases 12 to
16 two each.)

Green, at `69f0b86`:

```
$ bash .github/lint/self-test.sh                                       exit=0
ok   1 no findings
ok   2 finding in report mode
ok   2 finding printed
ok   3 finding on the blocking date
ok   4 finding after the blocking date
ok   5 exit 2 in report mode
ok   6 exit 3 in report mode
ok   7 blocking date unset
ok   8 blocking date '2026-13-45'
ok   8 blocking date '11/11/2026'
ok   8 blocking date '2026-02-30'
ok   8 blocking date ''
ok   9 shellcheck missing
ok   9 shellcheck not executable
ok   10 .github/actionlint.yaml present, workflows mode
ok   10 .github/actionlint.yaml present, canary mode
ok   10 .github/actionlint.yml present, workflows mode
ok   10 .github/actionlint.yml present, canary mode
ok   11 canary matches
ok   12 canary without the shellcheck finding
ok   12 canary with an extra finding
ok   13 canary exit 0
ok   13 canary exit 3
ok   14 canary after the blocking date
ok   14 canary with the date unset
ok   15 no mode
ok   15 unknown mode
ok   16 arguments, workflows mode
ok   16 arguments, canary mode
ok   17 workflow-lint.yml shape

actionlint gate self-test: all cases passed
```

Case 17 mutation check (each mutation applied with `sed` to a scratch copy of
`.github/lint` and `.github/workflows`, never the worktree), self-test output
line for case 17:

```
date-after   ("2026-11-24")   FAIL 17 ...: ACTIONLINT_BLOCKING_FROM 2026-11-24 is after 2026-11-23
date-invalid ("2026-11-31")   FAIL 17 ...: ACTIONLINT_BLOCKING_FROM '2026-11-31' is not a real YYYY-MM-DD date
job if:                       FAIL 17 ...: 57:    if: false
step - if:                    FAIL 17 ...: 65:      - if: always()
paths: under push             FAIL 17 ...: 32:    paths: [".github/**"]
paths-ignore: under PR        FAIL 17 ...: 30:    paths-ignore: ["docs/**"]
checkout@v4 (tag)             FAIL 17 ...:       - uses: actions/checkout@v4
continue-on-error: true       FAIL 17 ...: 57:    continue-on-error: true
```

### Step 1, install exactly as CI does

```
$ export RUNNER_TEMP="$(mktemp -d)" ACTIONLINT_VERSION=1.7.12 \
    ACTIONLINT_SHA256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 \
    SHELLCHECK_VERSION=0.11.0 \
    SHELLCHECK_SHA256=8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198
$ bash .github/lint/install-actionlint.sh                               exit=0
.../tmp.OhLPnLNhO2/actionlint_1.7.12_linux_amd64.tar.gz: OK
.../tmp.OhLPnLNhO2/shellcheck-v0.11.0.linux.x86_64.tar.xz: OK
1.7.12
installed by downloading from release page
built with go1.26.1 compiler for linux/amd64
ShellCheck - shell script analysis tool
version: 0.11.0
$ ls $RUNNER_TEMP
actionlint  actionlint_1.7.12_linux_amd64.tar.gz  shellcheck  shellcheck-v0.11.0.linux.x86_64.tar.xz
```

The installer prints both versions itself, so the plan's separate
`-version`/`--version` calls are in this output.

### Step 2, a wrong checksum fails the install

```
$ ACTIONLINT_SHA256=000…000 RUNNER_TEMP="$(mktemp -d)" bash .github/lint/install-actionlint.sh   exit=1
.../actionlint_1.7.12_linux_amd64.tar.gz: FAILED
sha256sum: WARNING: 1 computed checksum did NOT match
$ SHELLCHECK_SHA256=000…000 RUNNER_TEMP="$(mktemp -d)" bash .github/lint/install-actionlint.sh   exit=1
.../actionlint_1.7.12_linux_amd64.tar.gz: OK
.../shellcheck-v0.11.0.linux.x86_64.tar.xz: FAILED
sha256sum: WARNING: 1 computed checksum did NOT match
```

### Step 3, canary with the real tools

```
$ bash .github/lint/run-actionlint.sh canary                            exit=0
.github/lint/canary/canary-workflow.yml:15:3:job-needs:job "canary" needs job "no-such-job" which does not exist in this workflow
.github/lint/canary/canary-workflow.yml:16:14:runner-label:label "ubuntu-latst" is unknown. available labels are ...
.github/lint/canary/canary-workflow.yml:21:11:action:input "not-an-input" is not defined in action "actions/checkout@v4". ...
.github/lint/canary/canary-workflow.yml:22:24:expression:"github.event.pull_request.title" is potentially untrusted. ...
.github/lint/canary/canary-workflow.yml:23:24:expression:property "missing" is not defined in object type {}
.github/lint/canary/canary-workflow.yml:24:9:shellcheck:shellcheck reported issue in this script: SC2086:info:1:6: Double quote to prevent globbing and word splitting
actionlint canary: all 6 expected findings reported
```

Extra check, real actionlint with a shellcheck stub that prints nothing:
`actionlint exited 3 on the canary; expected 1 (findings)`, exit 1. (With
shellcheck absent the gate refuses before running, case 9.)

### Step 4, the gate on every workflow

```
$ ACTIONLINT_BLOCKING_FROM=2026-11-11 bash .github/lint/run-actionlint.sh workflows   exit=0
actionlint: 0 findings in .github/workflows
$ ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   exit=0
actionlint: 0 findings in .github/workflows
$ "$RUNNER_TEMP/actionlint" -verbose -no-color -shellcheck="$RUNNER_TEMP/shellcheck" -pyflakes=
verbose: Collected 4 YAML files
verbose: Linting .github/workflows/codeql.yml / ci.yml / security.yml / workflow-lint.yml
verbose: Found 0 errors in 4 files
```

0 findings across all four workflows, the new one included.

### Step 5, it fires on a real workflow (scratch copy only)

A scratch copy of the tree (`git archive HEAD` plus the working `.github`,
in the session scratchpad, `git init`) with
`- run: echo "${{ github.event.pull_request.title }}"` inserted at `ci.yml`
line 72:

```
$ ACTIONLINT_BLOCKING_FROM=2099-01-01 bash .github/lint/run-actionlint.sh workflows   exit=0
.github/workflows/ci.yml:72:24:expression:"github.event.pull_request.title" is potentially untrusted. ...
::warning title=actionlint (report mode until 2099-01-01)::1 finding(s) in .github/workflows
$ ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   exit=1
.github/workflows/ci.yml:72:24:expression:"github.event.pull_request.title" is potentially untrusted. ...
::error title=actionlint::1 finding(s) in .github/workflows (blocking since 2026-11-01)
$ git diff --quiet origin/rebuild/dotnet-platform -- .github/workflows/ci.yml   exit=0   (worktree ci.yml unchanged)
```

### Step 6, the gate's own scripts: failed first, then fixed

First run, before the gate commit, **failed**:

```
$ "$RUNNER_TEMP/shellcheck" .github/lint/*.sh                           exit=1
In .github/lint/run-actionlint.sh line 3:
# shellcheck in $RUNNER_TEMP; this script runs them.
^-- SC1073 (error): Couldn't parse this shellcheck directive.
In .github/lint/self-test.sh line 132 and line 178:
... blocking_from=unset
    ^-- SC2209 (warning): Use var=$(command) to assign output (or quote to assign string).
```

Fixes: the comment reworded so it no longer starts with `# shellcheck`;
`blocking_from="unset"` quoted. Second run:

```
$ "$RUNNER_TEMP/shellcheck" .github/lint/*.sh                           exit=1
In .github/lint/run-actionlint.sh line 63:
format='{{range $err := .}}...'
       ^-- SC2016 (info): Expressions don't expand in single quotes, use double quotes for that.
```

That line is actionlint's Go template; `$err` must reach actionlint
unexpanded, so the single quotes are correct. A `# shellcheck disable=SC2016`
on that one line, with the reason in the comment above it. Third run:

```
$ "$RUNNER_TEMP/shellcheck" .github/lint/*.sh                           exit=0
(no output)
```

All three fixes are in `69f0b86`. After them, steps 0, 3 and 4 were re-run:
self-test "all cases passed" exit 0; canary "all 6 expected findings
reported" exit 0; workflows "0 findings" exit 0 with both dates.

### Step 7, the security gate still passes

```
$ node --test .github/security/gate.test.mjs                            exit=0
# tests 62
# pass 62
# fail 0
```

### Step 8, nothing else changed

Run after the implementation record commit; output is the final head's.

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD
 .github/lint/canary.expected            |   6 +
 .github/lint/canary/canary-workflow.yml |  24 ++
 .github/lint/install-actionlint.sh      |  22 ++
 .github/lint/run-actionlint.sh          | 115 ++++++++
 .github/lint/self-test.sh               | 243 +++++++++++++++
 .github/workflows/workflow-lint.yml     |  72 +++++
 docs/changes/GAP-08/implementation.md   |  (this file)
 docs/changes/GAP-08/plan-approval.md    |  92 ++++++
 docs/changes/GAP-08/plan-review.md      | 104 +++++++
 docs/changes/GAP-08/plan.md             | 503 ++++++++++++++++++++++++++++++++
```

Only `.github/workflows/workflow-lint.yml`, `.github/lint/**` and
`docs/changes/GAP-08/**`.

### NOT RUN

| Check | Reason | Covered by |
| --- | --- | --- |
| The job on a real `ubuntu-24.04` runner | Only CI has one; nothing is pushed | "Workflow lint / actionlint (every workflow)" on the pull request |
| API (.NET Release), website and Studio Vitest, Playwright, builds, section comparison | No file they build or test changed (plan section 5) | CI workflow jobs `api`, `website`, `studio`, `section-compare`, `screenshot-parity` on the pull request |
| CodeQL | No code it analyses changed | `codeql.yml` on the pull request |

No migrations (plan section 7).

## Track checklist (G1, Waves 1 to 3)

| Rule | Status |
| --- | --- |
| One gate per pull request (B-8) | Met: one gate, actionlint; step 8 |
| Reports for seven days via `*_BLOCKING_FROM`, then blocks | Met: `ACTIONLINT_BLOCKING_FROM: "2026-11-11"` (merge assumed 2026-11-04); cases 2 to 4, 17 |
| Committed canary fixture it must reject (GAP-21) | Met: step 3, cases 11 to 14 |
| Actions pinned by 40-character SHA | Met: checkout `11d5960a…7262 # v4.4.0`; case 17 |
| SQL Server image by digest; Node and .NET exact | Not used by this job |
| Tools pinned exactly (G-15) | Met: actionlint 1.7.12, shellcheck 0.11.0, sha256-checked (steps 1, 2); runner `ubuntu-24.04` |
| Baselines only shrink | Met: 0 findings, no baseline file, no ignore list, config file refused (case 10) |

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| actionlint runs on every workflow in `.github/workflows/` | GAP-08 register row; G-13 | Done | Step 4 verbose: "Collected 4 YAML files", all four named; case 16 (no file arguments in workflows mode) |
| 0 findings across all workflows | Wave 1 table, "Done when" | Done | Step 4: "actionlint: 0 findings in .github/workflows", exit 0 |
| actionlint and shellcheck pinned exactly and sha256-verified | Standard section 3; G-15 | Done | Step 1 (two `: OK`), step 2 (wrong sum, exit 1 for each tool) |
| Reports until `ACTIONLINT_BLOCKING_FROM`, then blocks; date at least seven days after merge, no later than 23 November | Standard section 3; track checklist; refinement plan Wave 1 | Done, date to re-check at merge | Cases 2 to 4, 17; step 5 (warning before, error on/after); date 2026-11-11 under the 2026-11-04 merge assumption |
| A gate that cannot run fails (exit 2 or 3, missing shellcheck, bad date, config file) | Standard section 3 | Done | Cases 5 to 10, 13; step 3 extra check |
| Committed canary fixture rejected in every run | Track checklist; GAP-21 | Done | Step 3; workflow step "Canary"; cases 11 to 14 |
| The new workflow's action pinned by 40-character SHA | Track checklist | Done | Case 17 and its `checkout@v4` mutation |
| One gate in this pull request; `ci.yml`, `security.yml`, `.github/security/` unchanged | B-8; PR #38 and GAP-09 overlap | Done | Step 8 |
| Security gate self-test still 62 of 62 | P-6 | Done | Step 7 |
| Self-test committed red before the gate script | Test-first (pipeline) | Done | `c6183b3` then `69f0b86`; step 0 red run |

## Draft pull request description (for the integrator; not opened)

> ## What and why
>
> GAP-08 (G-13, Workflow lint): actionlint 1.7.12 with shellcheck 0.11.0 on
> every workflow in `.github/workflows/`, target 0 findings. New workflow
> "Workflow lint", job "actionlint (every workflow)". Reports until
> `ACTIONLINT_BLOCKING_FROM` (2026-11-11 if this merges on 4 November; move it
> to merge date plus seven days, never after 2026-11-23), then blocks.
>
> **For GAP-09:** `.github/lint/canary/canary-workflow.yml` uses
> `actions/checkout@v4` on purpose: actionlint checks an action's inputs by
> tag, so the canary needs a tag. Any "every `uses:` is pinned by a
> 40-character SHA" check must be scoped to `.github/workflows/` and must not
> read `.github/lint/`.
>
> ## Scope and boundaries
>
> New: `.github/workflows/workflow-lint.yml`, `.github/lint/**`,
> `docs/changes/GAP-08/**`. Not touched: `ci.yml`, `security.yml`,
> `codeql.yml`, `.github/security/`, `dependabot.yml`.
>
> ## Security impact
>
> Two CI-only binaries, sha256-checked; checkout pinned by SHA,
> `persist-credentials: false`, `contents: read`; no secrets. Adds
> script-injection detection on every workflow.
>
> ## Tests and evidence
>
> See `docs/changes/GAP-08/implementation.md` and `test-report.md`; the
> pull request's own "Workflow lint" and "Security" runs.
>
> ## Owner decisions
>
> "Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry,
> 2026-11-01, project thread). No exception taken. Making the check required
> is a settings step under GAP-03 / O-9.

Round 1 ended `Status: READY FOR TEST` at `70f7044`.

## Round 2 (rework after gate 2, `Verdict: CHANGES NEEDED`)

Inputs: `test-report.md` round 1 (three Minors) and `delivery-approval.md`
round 1, which requires Minor 2 and Minor 1 to be fixed and leaves Minor 3
optional. Both files are in the worktree, uncommitted. The coordinator told
me to leave them uncommitted because the orchestrator commits the records at
the end. That overrides item 4 of the delivery approval's round 2 list, so
`test-report.md` is **not** committed by me. Base re-checked after
`git fetch`: `origin/rebuild/dotnet-platform` is still `6470fac`, so no rebase.

### Commits

| SHA | Subject |
| --- | --- |
| `e18a093` | GAP-08: Add failing self-test cases for gate 2's round 1 findings (red) |
| `46ea9c6` | GAP-08: Refuse SHELLCHECK_OPTS and late blocking dates in the gate (fix) |
| this commit | GAP-08: Record round 2 rework |

### Findings and answers

**Minor 2: `SHELLCHECK_OPTS` narrows shellcheck silently. Fixed.**
`run-actionlint.sh` refuses `SHELLCHECK_OPTS` whenever it is set
(`${SHELLCHECK_OPTS+set}`, so an empty value is refused too). This happens
before the mode-specific logic, so it applies in both modes and in report
mode. The `::error` names the variable and shows its value. It is a refusal,
not an unset, as the tech lead asked. Self-test case 18 covers `-e SC2046` and
`''` in `workflows` and `canary` modes (four checks). Case 17 also fails if
`SHELLCHECK_OPTS` appears anywhere in `workflow-lint.yml`, comments included.
`run_gate` in the self-test now removes `SHELLCHECK_OPTS` from every other
case's environment, so the outer shell cannot affect them.

**Minor 1: case 17 was line-based. Fixed for all five mutations, plus one
run-time cap.**
- **Run time (the tech lead's suggestion):** `run-actionlint.sh` refuses an
  `ACTIONLINT_BLOCKING_FROM` after `2026-11-23` (`latest_blocking_from`). Any
  override, whether a step `env`, a flow mapping or a write to the runner's
  env file, can therefore no longer extend report mode past Wave 1's last
  blocking day. `2026-11-23` itself is accepted. This is self-test case 19.
- **Case 17 changes:**
  - It strips full-line and trailing comments before matching keys.
  - It matches `continue-on-error`, `if`, `paths` and `paths-ignore` as keys
    unquoted, single- or double-quoted, at the start of a line (with or
    without `- `) or after `{` or `,`, which covers flow mappings.
  - It requires the token `ACTIONLINT_BLOCKING_FROM` exactly once outside
    comments, which is the env entry. A second mention anywhere, such as a step
    `env` or an `echo ... >> $GITHUB_ENV`, fails.
  - It reads the date from the key line in any quoting.
  - It extracts every `uses` value (block, flow or quoted key) and requires
    `owner/repo@<40 hex>`.
  - It fails on `SHELLCHECK_OPTS` anywhere in the workflow.
  - It fails on any `GITHUB_ENV` or `GITHUB_PATH` text in `workflow-lint.yml`
    or in any `.github/lint/*.sh`. The self-test spells these names split
    (`"GITHUB_""ENV"`), so it can scan itself.

**Minor 3: exit 1 with empty output had no message. Fixed (optional).** The
count is now `grep -c . || true`. When it is 0 the gate fails with
`::error ... actionlint exited 1 (findings) but printed none`. This is case 20,
run both before and after the blocking date.

### Red run (at `e18a093`, the new self-test against the round 1 gate)

```
$ bash .github/lint/self-test.sh                                       exit=1
FAIL 18 SHELLCHECK_OPTS='-e SC2046', workflows mode: exit 0, expected 1; output: actionlint: 0 findings in .github/workflows
FAIL 18 SHELLCHECK_OPTS='-e SC2046', canary mode: exit 0, expected 1; output: ... actionlint canary: all 6 expected findings reported
FAIL 18 SHELLCHECK_OPTS='', workflows mode: exit 0, expected 1; output: actionlint: 0 findings in .github/workflows
FAIL 18 SHELLCHECK_OPTS='', canary mode: exit 0, expected 1; output: ... actionlint canary: all 6 expected findings reported
FAIL 19 blocking date 2026-11-24: exit 0, expected 1; output: ... ::warning title=actionlint (report mode until 2026-11-24)::1 finding(s) in .github/workflows
FAIL 19 blocking date 2099-01-01, no findings: exit 0, expected 1; output: actionlint: 0 findings in .github/workflows
FAIL 20 exit 1 with no output, today 2026-11-05: output lacks '::error'; output:
FAIL 20 exit 1 with no output, today 2026-12-01: output lacks '::error'; output:

actionlint gate self-test: 8 failed           (31 ok, case 17 among them)
```

On the committed workflow, the hardened case 17 passes (it is red only on
mutations, below).

### Step 0, self-test green (at `46ea9c6`)

```
$ bash .github/lint/self-test.sh                                       exit=0
... (cases 1 to 16 as in round 1)
ok   18 SHELLCHECK_OPTS='-e SC2046', workflows mode
ok   18 SHELLCHECK_OPTS='-e SC2046', canary mode
ok   18 SHELLCHECK_OPTS='', workflows mode
ok   18 SHELLCHECK_OPTS='', canary mode
ok   19 blocking date 2026-11-24
ok   19 blocking date 2099-01-01, no findings
ok   19 blocking date 2026-11-23
ok   20 exit 1 with no output, today 2026-11-05
ok   20 exit 1 with no output, today 2026-12-01
ok   17 workflow-lint.yml shape

actionlint gate self-test: all cases passed       (39 ok, 0 FAIL)
```

### Mutation run (at `46ea9c6`)

The script is `/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap08-mut.sh`
(session scratchpad, not committed). Each mutation is applied with `sed` to a
fresh scratch copy of `.github/lint` and `.github/workflows`, then the
self-test runs. The script also checks that each mutation really changed the
file. In every row the self-test exits 1 with exactly one FAIL line, case 17:

```
== date-after          FAIL 17: ACTIONLINT_BLOCKING_FROM 2026-11-24 is after 2026-11-23
== date-invalid        FAIL 17: ACTIONLINT_BLOCKING_FROM '2026-11-31' is not a real YYYY-MM-DD date
== job-if              FAIL 17: 57:    if: false
== step-if             FAIL 17: 65:      - if: always()
== paths               FAIL 17: 32:    paths: [".github/**"]
== paths-ignore        FAIL 17: 30:    paths-ignore: ["docs/**"]
== tag                 FAIL 17: actions/checkout@v4
== coe                 FAIL 17: 57:    continue-on-error: true
-- tester round 1 mutations --
== T1 flow-mapping step env { ACTIONLINT_BLOCKING_FROM: "2099-01-01" }
                       FAIL 17: ACTIONLINT_BLOCKING_FROM appears 2 times outside comments, expected once (its env entry)
== T2 "continue-on-error": true            FAIL 17: 57:    "continue-on-error": true
== T3 "if": false                          FAIL 17: 57:    "if": false
== T4 install step ... >> "$GITHUB_ENV" (date)
                       FAIL 17: ACTIONLINT_BLOCKING_FROM appears 2 times outside comments, expected once (its env entry)
== T4b installer appends ... >> "$GITHUB_ENV"   FAIL 17: 23:echo "ACTIONLINT_BLOCKING_FROM=2099-01-01" >> "$GITHUB_ENV"
== T4c installer appends ... >> "$GITHUB_PATH"  FAIL 17: 23:echo "$RUNNER_TEMP" >> "$GITHUB_PATH"
== T5 top env SHELLCHECK_OPTS: "-e SC2046"      FAIL 17: 42:  SHELLCHECK_OPTS: "-e SC2046"
-- extra forms --
== 'ACTIONLINT_BLOCKING_FROM': "2099-01-01"     FAIL 17: ACTIONLINT_BLOCKING_FROM 2099-01-01 is after 2026-11-23
== "uses": actions/checkout@v4                  FAIL 17: actions/checkout@v4
== defaults: { run: { shell: bash }, "if": x }  FAIL 17: 57:    defaults: { run: { shell: bash }, "if": x }
== install step ... echo "X=1" >> "$GITHUB_ENV" FAIL 17: 63:        run: ... echo "X=1" >> "$GITHUB_ENV"
```

T1, T4 and T5 also fail at run time, independently of case 17. The real-tool
runs below show it: a date after 2026-11-23 is refused, and `SHELLCHECK_OPTS`
is refused.

### The tester's Minor 2 reproduction, re-run with the real tools

Scratch copy of the tree with `- run: rm $(ls)` at `ci.yml` line 72;
actionlint 1.7.12 and shellcheck 0.11.0 from the gate's installer:

```
$ ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows                      exit=1
.github/workflows/ci.yml:72:9:shellcheck:shellcheck reported issue in this script: SC2046:warning:1:4: Quote this to prevent word ...
::error title=actionlint::1 finding(s) in .github/workflows (blocking since 2026-11-01)
$ SHELLCHECK_OPTS='-e SC2046' ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   exit=1
::error title=actionlint::SHELLCHECK_OPTS is set ('-e SC2046'). It can exclude shellcheck checks; this gate does not accept it.
$ SHELLCHECK_OPTS='-e SC2046' ACTIONLINT_BLOCKING_FROM=2026-11-20 bash .github/lint/run-actionlint.sh workflows   exit=1   (report mode)
::error title=actionlint::SHELLCHECK_OPTS is set ('-e SC2046'). ...
$ SHELLCHECK_OPTS='-e SC2046' bash .github/lint/run-actionlint.sh canary                                  exit=1
::error title=actionlint::SHELLCHECK_OPTS is set ('-e SC2046'). ...
$ SHELLCHECK_OPTS= bash .github/lint/run-actionlint.sh canary                                             exit=1
::error title=actionlint::SHELLCHECK_OPTS is set (''). ...
$ ACTIONLINT_BLOCKING_FROM=2099-01-01 bash .github/lint/run-actionlint.sh workflows                       exit=1
::error title=actionlint::ACTIONLINT_BLOCKING_FROM 2099-01-01 is after 2026-11-23, Wave 1's last blocking day
$ ACTIONLINT_BLOCKING_FROM=2026-11-23 bash .github/lint/run-actionlint.sh workflows                       exit=0
.github/workflows/ci.yml:72:9:shellcheck:... SC2046 ...
::warning title=actionlint (report mode until 2026-11-23)::1 finding(s) in .github/workflows
```

Minor 3 reproduction (stub `actionlint` that only does `exit 1`, report mode):

```
$ RUNNER_TEMP=<stub dir> ACTIONLINT_BLOCKING_FROM=2026-11-20 bash .github/lint/run-actionlint.sh workflows   exit=1

::error title=actionlint::actionlint exited 1 (findings) but printed none, so the result cannot be trusted
```

(The blank line above is the empty output being printed. It is harmless.)

### Steps 3, 4, 6, 7, 8 re-run (at `46ea9c6`)

```
$ bash .github/lint/run-actionlint.sh canary                                        exit=0
actionlint canary: all 6 expected findings reported
$ ACTIONLINT_BLOCKING_FROM=2026-11-11 bash .github/lint/run-actionlint.sh workflows   exit=0
actionlint: 0 findings in .github/workflows
$ ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   exit=0
actionlint: 0 findings in .github/workflows
$ node --test .github/security/gate.test.mjs                                        exit=0
# tests 62
# pass 62
# fail 0
```

Step 6 **failed first** in this round as well:

```
$ "$RUNNER_TEMP/shellcheck" .github/lint/*.sh                                        exit=1
In .github/lint/run-actionlint.sh line 54:
# shellcheck reads extra options from this variable, so it can exclude checks
^-- SC1073 (error): Couldn't parse this shellcheck directive.
```

This is the same mistake as round 1: a comment that starts with
`# shellcheck` is read as a directive. I reworded it to "The shellcheck
binary reads extra options from SHELLCHECK_OPTS ...". The fix is in
`46ea9c6`. Re-run:

```
$ "$RUNNER_TEMP/shellcheck" .github/lint/*.sh                                        exit=0
$ bash .github/lint/self-test.sh                                                    exit=0   (all cases passed)
```

Step 8, after this record's commit:

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD
 .github/lint/canary.expected            |   6 +
 .github/lint/canary/canary-workflow.yml |  24 ++
 .github/lint/install-actionlint.sh      |  22 ++
 .github/lint/run-actionlint.sh          | 137 +++++++++
 .github/lint/self-test.sh               | 288 ++++++++++++++++++
 .github/workflows/workflow-lint.yml     |  72 +++++
 docs/changes/GAP-08/implementation.md   | (this file)
 docs/changes/GAP-08/plan-approval.md    |  92 ++++++
 docs/changes/GAP-08/plan-review.md      | 104 +++++++
 docs/changes/GAP-08/plan.md             | 503 ++++++++++++++++++++++++++++++++
```

`workflow-lint.yml`, `install-actionlint.sh`, the canary and
`canary.expected` are unchanged in this round. The only files that change are
`run-actionlint.sh`, `self-test.sh` and this record.

### Notes for the tester

- The workflow header and the draft PR text must not contain the string
  `SHELLCHECK_OPTS` or the env-file names in `workflow-lint.yml`, because case
  17 reads every byte of the workflow for them. The draft PR description in
  `delivery-approval.md` already lists "`SHELLCHECK_OPTS` set" among the
  refusals. That is now true.
- The run-time cap `2026-11-23` is a constant in `run-actionlint.sh`. If the
  owner grants a schedule exception (P-7, merge after 16 November), the
  constant, case 19 and case 17's bound move together in that change.
- Same NOT RUN rows as round 1 (real runner; .NET, website, Studio,
  Playwright, CodeQL).

Status: READY FOR TEST
