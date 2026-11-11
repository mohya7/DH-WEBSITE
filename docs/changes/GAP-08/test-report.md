# GAP-08: add actionlint (test report)

Role: tester (step 5). Track G1, Wave 1. Date 2026-11-01.

## Round 1

**Commit tested:** `70f7044` (head of `change/GAP-08`), on a detached worktree
`/home/user/wt-GAP-08-test` (removed after the run). Red commit `c6183b3`.
Base `origin/rebuild/dotnet-platform` = `6470fac` (re-checked after
`git fetch`; it has not moved). `TMPDIR` set to the session scratchpad.
Governing documents read from the read-only copies outside the repository
(`docs/changes/README.md`, `.claude/agents/tester.md`, `ENVIRONMENT.md`), plus
`plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`.

### 1. The red test was red

```
$ git checkout --detach c6183b3; ls .github/lint .github/workflows
.github/lint: canary  canary.expected  self-test.sh
.github/workflows: ci.yml  codeql.yml  security.yml
$ bash .github/lint/self-test.sh                                  exit=1
FAIL 1 no findings: exit 127, expected 0; output: bash: .../1/repo/.github/lint/run-actionlint.sh: No such file or directory
...
FAIL 17 workflow-lint.yml shape: /home/user/wt-GAP-08-test/.github/workflows/workflow-lint.yml is missing
actionlint gate self-test: 30 failed
```

All 30 failures are the missing gate script (exit 127) or missing workflow
(case 17), the reason the plan gives. Between red and head the self-test
changed only by quoting `blocking_from="unset"` twice (SC2209 fix); no case
was weakened (`git diff c6183b3 70f7044 -- .github/lint/self-test.sh`).
`canary.expected` and the canary fixture are unchanged since red.

### 2. The test plan, as written (head `70f7044`)

| Step | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| 0 | `bash .github/lint/self-test.sh` | 0 | 30 `ok` lines; "actionlint gate self-test: all cases passed" |
| 1 | `bash .github/lint/install-actionlint.sh` (env exactly as plan step 1) | 0 | `actionlint_1.7.12_linux_amd64.tar.gz: OK`, `shellcheck-v0.11.0.linux.x86_64.tar.xz: OK`, `1.7.12`, `version: 0.11.0` |
| 2 | same, `ACTIONLINT_SHA256=000…0` | 1 | `actionlint_…tar.gz: FAILED` / `1 computed checksum did NOT match` |
| 2+ | same, `SHELLCHECK_SHA256=000…0` | 1 | actionlint `OK`, shellcheck `FAILED` |
| 2+ | `ACTIONLINT_SHA256=` (empty) | 1 | `sha256sum: 'standard input': no properly formatted checksum lines found` |
| 2+ | `SHELLCHECK_SHA256` unset | 1 | `line 17: SHELLCHECK_SHA256: unbound variable` |
| 3 | `bash .github/lint/run-actionlint.sh canary` | 0 | six findings at 15:3 job-needs, 16:14 runner-label, 21:11 action, 22:24 expression, 23:24 expression, 24:9 shellcheck SC2086; "all 6 expected findings reported" |
| 4 | `ACTIONLINT_BLOCKING_FROM=2026-11-11 … workflows` | 0 | `actionlint: 0 findings in .github/workflows` |
| 4 | `ACTIONLINT_BLOCKING_FROM=2026-11-01 … workflows` | 0 | same |
| 4 | `actionlint -verbose -no-color -shellcheck=… -pyflakes=` | 0 | `Collected 4 YAML files` (workflow-lint, ci, codeql, security); `Found 0 errors in 4 files` |
| 5 | scratch copy, `- run: echo "${{ github.event.pull_request.title }}"` inserted at `ci.yml:72`, `BLOCKING_FROM=2099-01-01` | 0 | `ci.yml:72:24:expression:… potentially untrusted`; `::warning title=actionlint (report mode until 2099-01-01)::1 finding(s)` |
| 5 | same, `BLOCKING_FROM=2026-11-01` | 1 | `::error title=actionlint::1 finding(s) in .github/workflows (blocking since 2026-11-01)` |
| 5 | `git diff --quiet origin/rebuild/dotnet-platform -- .github/workflows/ci.yml` | 0 | worktree `ci.yml` untouched |
| 6 | `"$RUNNER_TEMP/shellcheck" .github/lint/*.sh` | 0 | no output |
| 7 | `node --test .github/security/gate.test.mjs` | 0 | `# tests 62`, `# pass 62`, `# fail 0` |
| 8 | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 0 | only `.github/lint/**` (5 files), `.github/workflows/workflow-lint.yml`, `docs/changes/GAP-08/**` (4 files) |

Pin checks done independently of the developer:

```
$ git ls-remote https://github.com/actions/checkout 'refs/tags/v4.4.0*' refs/tags/v4
11d5960a326750d5838078e36cf38b85af677262  refs/tags/v4
11d5960a326750d5838078e36cf38b85af677262  refs/tags/v4.4.0          (matches the workflow's pin)
$ curl -sSfL -O …/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt; grep linux_amd64
8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8  actionlint_1.7.12_linux_amd64.tar.gz   (matches ACTIONLINT_SHA256)
$ PyPI shellcheck-py 0.11.0.1 manylinux x86_64 wheel, sha256 from the PyPI JSON API
sc.whl: OK
$ sha256sum w/shellcheck_py-0.11.0.1.data/scripts/shellcheck $RUNNER_TEMP/shellcheck
4da528dd…d5a55b  (wheel)
4da528dd…d5a55b  (binary extracted by install-actionlint.sh from the pinned tarball)
```

Also: PR #38's `ci.yml` (`b472fe5`) put in a scratch copy lints clean
(`exit=0`, "0 findings"), so merge order with #38 is safe.

NOT RUN (by design, as the plan states; no file they build or test changed):

| Check | Reason | Covered by |
| --- | --- | --- |
| The job on a real `ubuntu-24.04` runner | Only CI has one; nothing is pushed | "Workflow lint / actionlint (every workflow)" on the PR |
| `dotnet test -c Release`, website and Studio `npm test`/typecheck/build/design:check/compare:sections, Playwright | No application file changed (`git diff --stat`, step 8) | `ci.yml` jobs `api`, `website`, `studio`, `section-compare`, `screenshot-parity` |
| `run-dotnet-audit.sh` | No NuGet change | `security.yml` job for .NET audit |
| Semgrep, gitleaks | Not installed in this container (`which semgrep gitleaks`: nothing) | `security.yml` jobs running `run-semgrep.sh`, `run-gitleaks.sh` |

### 3. Track checklist (G1, Waves 1 to 3)

| Rule | Result | Evidence |
| --- | --- | --- |
| One gate per pull request (B-8) | Met | Step 8; no other workflow or `.github/security/*` file touched |
| Reports seven days via `*_BLOCKING_FROM`, then blocks | Met | `ACTIONLINT_BLOCKING_FROM: "2026-11-11"`; step 5 warns before, fails on/after; self-test 2 to 4 |
| Committed canary it must reject | Met | Step 3; canary fails when shellcheck is a no-op (exit 3 or SC2086 missing, below) |
| Actions pinned by 40-character SHA | Met | `actions/checkout@11d5960a…7262`, verified as v4.4.0 by `git ls-remote` |
| SQL Server by digest; Node and .NET exact | N/A | Not used by this job |
| Tools pinned exactly (G-15) | Met | actionlint 1.7.12 and shellcheck 0.11.0, sha256 verified and cross-checked above; `runs-on: ubuntu-24.04` |
| Baselines only shrink | Met | 0 findings; no baseline, no `-ignore`, config file refused |

### 4. Security

**`npm audit`** (no lockfile changed by this PR: `git diff --quiet origin/rebuild/dotnet-platform -- website/package-lock.json studio/package-lock.json` exit 0):

```
$ (cd website && npm audit --audit-level=high)        exit=1   {moderate: 3, high: 4, critical: 1}
$ (cd studio && npm audit --audit-level=high)         exit=1   {moderate: 2, high: 3, critical: 0}
$ (cd website && bash ../.github/security/run-npm-audit.sh website)   exit=1
::error title=New finding (website)::critical next GHSA-673q-mjm6-r5xr: Next.js: Unauthenticated Remote Code Execution in `use cache` functions …
website: 6 finding(s) at the gate's level; 3 known, 3 new.
$ (cd studio && bash ../.github/security/run-npm-audit.sh studio)     exit=0
studio: 0 finding(s) at the gate's level; 0 known, 0 new.
```

These are the base branch's dependencies, identical with and without this
change; they belong to Wave 0 (GAP-01 to GAP-03), not GAP-08. They are not a
finding against this change, but the PR's `security.yml` npm audit job for the
website will be red until Wave 0 lands, whatever this PR does.

**The workflow itself:**

- Trigger is `pull_request`, not `pull_request_target`; no secrets used;
  `permissions: contents: read` at workflow level; `persist-credentials: false`.
- No `${{ }}` expression inside any `run:`. The two expressions in the file
  are in the step `name:` (`env.*_VERSION`) and the `concurrency` group
  (`github.ref`), neither reaches a shell.
- actionlint lints `workflow-lint.yml` itself (step 4 verbose) with 0 findings.
- Gate output lines start with the file path, never `::`, so a finding message
  cannot be read by the runner as a workflow command.
- No secret in the diff, logs or output (only public sha256 values).

**Checksum bypass attempts:** wrong, empty and unset checksums for either tool
all fail the install (table above). The only way to change what is accepted is
editing the env values in `workflow-lint.yml`, a reviewed change. No fallback
download path exists.

### 5. Beyond the plan: trying to make the gate pass silently

Each run on a scratch copy (`git archive HEAD .github` + `git init`) with the
real actionlint 1.7.12 / shellcheck 0.11.0 unless "stub" is said.

| Attempt | Result |
| --- | --- |
| `.github/workflows/` empty | actionlint `no YAML file was found`, exit 3; gate `::error … exited 3`, exit 1 |
| `.github/workflows/` absent; no `.git` | actionlint `no project was found`, exit 3; gate exit 1 |
| Config at `actionlint.yaml`, `.actionlint.yaml`, `.actionlint.yml`, `.github/.actionlint.yaml`, `.github/workflows/actionlint.yaml` (ignore `.*`) | none is read by actionlint 1.7.12; the planted finding still fails the gate (exit 1) |
| Config at `.github/actionlint.yaml` | read by actionlint (direct run exit 0, finding hidden); gate refuses it, exit 1 |
| `.shellcheckrc` with `disable=SC2046` or `disable=all` at repo root, `.github/`, `.github/workflows/` | ignored; SC2046 still reported, gate exit 1; canary still exit 0 |
| shellcheck replaced by `/bin/true` (real actionlint) | workflows: actionlint exit 3 `could not parse JSON output from shellcheck`, gate exit 1; canary exit 1 |
| shellcheck replaced by a script printing `[]` | workflows: `0 findings`, exit 0 (passes), **but** canary exits 1 (`-24:9:shellcheck` missing). Same job, canary runs first, so the job fails |
| actionlint killed by SIGSEGV (stub) in report mode | `::error … exited 139`, exit 1 |
| actionlint missing, or a directory | `::error … is not an executable file`, exit 1 |
| `RUNNER_TEMP` unset | `RUNNER_TEMP is not set`, exit 1 |
| actionlint exit 1 with empty output (stub), report mode | exit 1 with no annotation (see Minor 3) |
| actionlint exit 0 while printing a line (stub) | `0 findings`, exit 0. Correct: exit 0 is actionlint's "no errors" |
| `.yaml` workflow with a finding | linted, exit 1 |
| Workflow in a subfolder | linted too (GitHub does not run it; harmless extra) |
| Workflow named `X.YML` (upper case) | **not** collected by actionlint 1.7.12. Whether GitHub runs an upper-case `.YML` file was not verified here; noted, not raised |
| YAML syntax error in `ci.yml` | `syntax-check` finding: exit 1 when blocking, `::warning` exit 0 in report mode (as designed) |
| Inline `# shellcheck disable=SC2046` inside a `run:` | honoured, 0 findings. Standard shellcheck behaviour, visible in the diff; noted |

**Dates and timezone** (stub actionlint printing one finding, exit 1, today 2026-11-01 UTC):

| `ACTIONLINT_BLOCKING_FROM` | Result |
| --- | --- |
| `2026-02-29`, `2026-00-10`, `2026-11-00`, `2026-11-1`, `+2026-11-11`, `" 2026-11-11"`, `"2026-11-11 "`, full-width digits, `$'2026-11-11\n'`, `$'2026-11-11\n2099-01-01'`, `$'2099-01-01\n2026-11-11'` | rejected, `::error … must be a real date`, exit 1 |
| `2028-02-29` | accepted (real leap day), report mode |
| `0000-01-01` | accepted, blocking (stricter, harmless) |
| `9999-12-31` | accepted at run time, report mode forever; the committed value is bounded to `<= 2026-11-23` only by self-test case 17 (see Minor 1) |
| `TZ=Pacific/Kiritimati` (local date 2026-11-02, UTC 2026-11-01), date = UTC today | blocking (`::error`), exit 1: the gate uses UTC (`date -u`), not local time |
| `LC_ALL=C.UTF-8` and `en_US.UTF-8` | same comparisons as C locale |

**The developer's SC2016 disable** (`run-actionlint.sh:64`): justified. The
string is actionlint's Go template; `$err` must reach actionlint literally
(double quotes under `set -u` fail with `err: unbound variable`). It is the
only `shellcheck disable` in `.github/lint/`. Removing it gives exactly one
SC2016 at line 64; a second single-quoted `$HOME` added on the next line is
still reported, so the directive covers that one command only.

**Blocking-date assumption is recorded for the owner.** `implementation.md`,
"Blocking date", states it in bold: "the pull request merges no earlier than
2026-11-04", hence `2026-11-11`; if the merge is later, move the date to merge
+ 7 days before merging; if the merge slips past 2026-11-16, stop and the
change is BLOCKED ON OWNER. The draft PR description repeats it. 2026-11-11 =
2026-11-04 + 7 days and is before 2026-11-23. Worth adding for the owner: the
date is UTC midnight (02:00 Cairo time on 11 November), and nothing automated
re-checks it at merge; the integrator must.

### Findings

No Blocker. No Major.

**Minor 1. Self-test case 17 is a line regex, so several loosenings of
`workflow-lint.yml` pass it.** Each needs a visible edit to the workflow in a
reviewed PR, which is why this is Minor; but case 17 exists to catch exactly
these.
Steps: in a scratch copy, apply one mutation to `workflow-lint.yml`, run
`bash .github/lint/self-test.sh`.

| Mutation | Expected | Actual |
| --- | --- | --- |
| Lint step gets `env: { ACTIONLINT_BLOCKING_FROM: "2099-01-01" }` (flow mapping) | case 17 fails | `ok 17`, exit 0 (gate would report until 2099) |
| Job gets `"continue-on-error": true` (quoted key) | case 17 fails | `ok 17`, exit 0 |
| Job gets `"if": false` (quoted key) | case 17 fails | `ok 17`, exit 0 (actionlint does flag it, exit 1) |
| Install step appends `echo "ACTIONLINT_BLOCKING_FROM=2099-01-01" >> "$GITHUB_ENV"` | case 17 fails | `ok 17`, exit 0 |
| Top `env:` gets `SHELLCHECK_OPTS: "-e SC2046"` | case 17 fails | `ok 17`, exit 0 |

**Minor 2. `SHELLCHECK_OPTS` silently narrows shellcheck in workflows mode.**
The gate refuses an actionlint config file but not this environment variable,
which shellcheck reads.
Steps: plant `- run: rm $(ls)` in a workflow; `SHELLCHECK_OPTS='-e SC2046'
ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows`.
Expected: the SC2046 finding, exit 1 (or the gate refuses the variable).
Actual: `actionlint: 0 findings in .github/workflows`, exit 0. Without the
variable: SC2046 reported, exit 1. The canary catches only `-e SC2086`
(exit 1), because SC2086 is the one code it proves.

**Minor 3. actionlint exit 1 with empty output fails without an annotation.**
Steps: stub `actionlint` that does `exit 1` only; `ACTIONLINT_BLOCKING_FROM=2099-01-01
RUNNER_TEMP=<stub dir> bash .github/lint/run-actionlint.sh workflows`.
Expected: exit 1 with an `::error` naming the cause (fail closed, explained).
Actual: exit 1 with only a blank line: `grep -c .` returns 1 on empty input and
`set -e` ends the script before any message. Fails closed, so no silent pass;
the gap is diagnosis only.

### Coverage table rows verified

| Item | Status | Evidence (this report) |
| --- | --- | --- |
| actionlint runs on every workflow in `.github/workflows/` | Verified | Step 4 verbose, 4 files; `.yaml` attempt |
| 0 findings across all workflows | Verified | Step 4, exit 0 |
| actionlint and shellcheck pinned exactly and sha256-verified | Verified | Steps 1, 2 and pin cross-checks |
| Reports until `ACTIONLINT_BLOCKING_FROM`, then blocks; date >= merge + 7, <= 2026-11-23 | Verified, date to re-check at merge | Step 5; date table; 2026-11-11 under the recorded 2026-11-04 assumption |
| A gate that cannot run fails (exit 2/3, missing shellcheck, bad date, config file) | Verified | Self-test 5 to 10; section 5 attempts |
| Committed canary rejected in every run | Verified | Step 3; no-op shellcheck attempts |
| New workflow's action pinned by 40-character SHA | Verified | `git ls-remote` |
| One gate in this PR; `ci.yml`, `security.yml`, `.github/security/` unchanged | Verified | Step 8 |
| Security gate self-test still 62 of 62 | Verified | Step 7 |
| Self-test committed red before the gate script | Verified | Section 1 |

Round 1 result: APPROVED (tested `70f7044`; superseded by round 2 below).

## Round 2

**Commit tested:** `8727495` (head of `change/GAP-08`), fresh detached
worktree `/home/user/wt-GAP-08-test` (removed after the run). Red commit for
this round: `e18a093`. Base still `6470fac`. Inputs read: `implementation.md`
"Round 2", `delivery-approval.md` round 1 (`Verdict: CHANGES NEEDED`: tester
Minors 1 and 2 required, Minor 3 optional).

Between round 1 and this head only `run-actionlint.sh`, `self-test.sh` and
`implementation.md` changed. `workflow-lint.yml`, `install-actionlint.sh`, the
canary and `canary.expected` are byte-identical to `70f7044`
(`git diff --quiet 70f7044 8727495 -- …` exit 0). From `e18a093` to the head,
`self-test.sh` is unchanged: only the gate script changed.

### 1. The red test was red

```
$ git checkout --detach e18a093; bash .github/lint/self-test.sh        exit=1
FAIL 18 SHELLCHECK_OPTS='-e SC2046', workflows mode: exit 0, expected 1; output: actionlint: 0 findings in .github/workflows
FAIL 18 SHELLCHECK_OPTS='-e SC2046', canary mode: exit 0, expected 1; output: …canary-workflow.yml:15:3:job-needs…
FAIL 18 SHELLCHECK_OPTS='', workflows mode: exit 0, expected 1
FAIL 18 SHELLCHECK_OPTS='', canary mode: exit 0, expected 1
FAIL 19 blocking date 2026-11-24: exit 0, expected 1; output: …ci.yml:10:5:expression…
FAIL 19 blocking date 2099-01-01, no findings: exit 0, expected 1; output: actionlint: 0 findings in .github/workflows
FAIL 20 exit 1 with no output, today 2026-11-05: output lacks '::error'; output:
FAIL 20 exit 1 with no output, today 2026-12-01: output lacks '::error'; output:
actionlint gate self-test: 8 failed                                    (31 ok)
```

All 8 failures are the three missing gate behaviours, as stated. The new
case 17 passes on the committed workflow at red, as stated.

### 2. The test plan, re-run at `8727495`

| Step | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| 0 | `bash .github/lint/self-test.sh` | 0 | 39 `ok`, 0 `FAIL`, "all cases passed" |
| 1 | `bash .github/lint/install-actionlint.sh` (plan env) | 0 | both `: OK`; `1.7.12`; `version: 0.11.0` |
| 2 | wrong `ACTIONLINT_SHA256` / wrong `SHELLCHECK_SHA256` / empty `ACTIONLINT_SHA256` | 1 / 1 / 1 | `FAILED` for the tool concerned; empty: no properly formatted lines |
| 3 | `bash .github/lint/run-actionlint.sh canary` | 0 | "all 6 expected findings reported" |
| 4 | `… workflows` with `2026-11-11` and `2026-11-01` | 0, 0 | "0 findings"; verbose: `Collected 4 YAML files`, `Found 0 errors in 4 files` |
| 5 | scratch copy, injection at `ci.yml:72`; `BLOCKING_FROM=2026-11-20` / `2026-11-01` | 0 / 1 | `::warning … report mode until 2026-11-20` / `::error … blocking since 2026-11-01` |
| 6 | `"$RUNNER_TEMP/shellcheck" .github/lint/*.sh` | 0 | no output |
| 7 | `node --test .github/security/gate.test.mjs` | 0 | `# tests 62`, `# pass 62`, `# fail 0` |
| 8 | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 0 | only `.github/lint/**` (5), `workflow-lint.yml`, `docs/changes/GAP-08/**` (4) |

NOT RUN: same rows and reasons as round 1 (real runner; .NET, website,
Studio, Playwright, section comparison, CodeQL; Semgrep and gitleaks not
installed). No dependency changed, so the round-1 `npm audit` result stands
(website base advisories, Wave 0).

### 3. Round-1 findings re-checked

| Round-1 finding | Result at `8727495` |
| --- | --- |
| Minor 2 (`SHELLCHECK_OPTS`) | **Fixed.** Real tools, canary mode, with `-e SC2046`, `''`, `' '` and `--norc`: each `::error … SHELLCHECK_OPTS is set (…)`, exit 1. Workflows mode with the planted SC2046 issue and `-e SC2046`: refused, exit 1 |
| Minor 3 (exit 1, no output) | **Fixed.** Stub `exit 1`, `BLOCKING_FROM` 2026-11-20 and 2026-11-01: `::error … actionlint exited 1 (findings) but printed none`, exit 1 both |
| Minor 1 (case 17 line regex), the five round-1 mutations | **Fixed for those five.** The developer's mutation run shows each now fails case 17. The date-related ones (flow `env`, `$GITHUB_ENV` date) also fail at run time through the cap, below. New spellings still pass: see Minor 4 |

**The 2026-11-23 cap at run time** (real tools, scratch copy):
- `2026-11-23`: accepted (0 findings, exit 0; with a finding: `::warning`, exit 0).
- `2026-11-24` and `9999-12-31`: `::error … is after 2026-11-23, Wave 1's last blocking day`, exit 1.
- `2026-02-29` and `$'2026-11-11\n'`: still rejected as not real dates, exit 1.
- `0000-01-01`: accepted, and blocking (stricter).

**Round-1 bypasses re-tried at the head:** results are unchanged, with no
silent pass:
- An empty or absent workflows folder, or no `.git`: exit 3, gate exit 1.
- `.github/actionlint.yaml` and `.github/actionlint.yml`: refused. `actionlint.yaml` and `.actionlint.yaml` at the root are not read by actionlint, so the finding still fails the gate.
- `.shellcheckrc` with `disable=all`: ignored. The finding still fails, and the canary still passes.
- shellcheck replaced by `/bin/true`: exit 3 in both modes.
- shellcheck replaced by a script printing `[]`: the workflows step alone passes, but the canary fails (`-24:9:shellcheck` missing).
- A YAML syntax error in report mode: `::warning`, exit 0, as designed.

### 4. New attempts around the stricter case 17

Each run applies one change to `workflow-lint.yml` in a fresh scratch copy,
then runs `bash .github/lint/self-test.sh` and real actionlint on the changed
file. actionlint is the proof that GitHub-compatible YAML parsing reads the
key as intended. A misspelt key gives `unexpected key "continue-on-errorx"`,
so a clean result means the key decoded to the real one.

| # | Mutation | Self-test | actionlint on the mutated file |
| --- | --- | --- | --- |
| N1 | Lint step as a flow mapping `- { name: "Lint #1", run: …workflows, continue-on-error: true }`. The comment stripper `s/[[:space:]]#.*$//` treats ` #1"…` as a comment and drops the key | `ok 17`, exit 0 | exit 0 (valid) |
| N2 | Job key `"continue-on\x2Derror": true` (YAML double-quoted escape for `-`) | `ok 17`, exit 0 | exit 0 (decoded to `continue-on-error`) |
| N3 | Job complex key `? continue-on-error` / `: true` | `ok 17`, exit 0 | exit 0 |
| N4 | Step key `"\x69f": false` (escaped `if`) | `ok 17`, exit 0 | exit 1, `constant expression "false" in condition … [if-cond]`, so it decoded to `if` |
| N5 | Lint step `run: … workflows \|\| true` | `ok 17`, exit 0 | exit 0 |
| N6 | Lint step removed entirely | `ok 17`, exit 0 | exit 0 |
| N7 | Install step writes a fake `date` dir to the runner path file through bash indirection (`v=GITHUB_; v="${v}PATH"; echo … >> "${!v}"`) | `ok 17`, exit 0 | exit 0 |
| N8 | Workflow `env: PATH: .github/lint/bin:/usr/local/bin:/usr/bin:/bin` | `ok 17`, exit 0 | exit 0 |

N7 and N8 get past the 2026-11-23 cap at run time. The gate reads today
from whatever `date` is first on `PATH`. I checked this with a fake `date`
first on `PATH` that answers `-u +%F` with `2000-01-01`, using a planted
finding:

```
$ PATH=<fake>:$PATH ACTIONLINT_BLOCKING_FROM=2026-11-11 bash .github/lint/run-actionlint.sh workflows   exit=0
::warning title=actionlint (report mode until 2026-11-11)::1 finding(s) in .github/workflows
$ PATH=<fake>:$PATH ACTIONLINT_BLOCKING_FROM=2026-11-23 bash .github/lint/run-actionlint.sh workflows   exit=0
::warning title=actionlint (report mode until 2026-11-23)::1 finding(s) in .github/workflows
```

Under these conditions the gate stays in report mode forever. `diff`, `cut`
and `grep` are found through `PATH` the same way, so a fake `diff` could also
make the canary pass.

### Findings (round 2)

No Blocker. No Major. Round-1 Minors 2 and 3 are fixed. Round-1 Minor 1 is
fixed for the mutations listed, and is replaced by:

**Minor 4. Case 17 can still be bypassed by other spellings and by edits it
does not look at.** Each item needs a visible edit to `workflow-lint.yml` in a
reviewed PR. The same PR could also edit `run-actionlint.sh` or `self-test.sh`
directly, so case 17 is defence in depth, not a boundary. That is why this is
Minor.
Steps: section 4, N1 to N8.
Expected: case 17 fails, and the gate keeps blocking after its date.
Actual: `ok 17`, self-test exit 0. Under N7 or N8 the gate also stays in
report mode past 2026-11-23.
Suggested direction (the developer's call): replace the text scan with a
byte-for-byte golden copy of `workflow-lint.yml` checked by the self-test, as
`security.yml` has. That one check covers N1 to N8 and every other spelling.
Optionally, call `date`, `diff`, `cut` and `grep` by absolute path, or reset
`PATH` at the top of `run-actionlint.sh`.

### Coverage rows verified this round

| Item | Status | Evidence |
| --- | --- | --- |
| actionlint on every workflow, 0 findings | Verified | Step 4 |
| Tools pinned and sha256-verified | Verified | Steps 1, 2 (workflow and installer unchanged since round 1) |
| Report until `ACTIONLINT_BLOCKING_FROM`, then block; date no later than 2026-11-23 | Verified (run-time cap added), except under a `PATH` override (Minor 4) | Step 5; cap tests; section 4 |
| A gate that cannot run fails (now including `SHELLCHECK_OPTS` and exit 1 with no output) | Verified | Section 3 |
| Committed canary rejected in every run | Verified | Step 3; no-op shellcheck attempts |
| One gate; `ci.yml`, `security.yml`, `.github/security/` unchanged | Verified | Step 8 |
| Security self-test 62 of 62 | Verified | Step 7 |
| New self-test cases committed red before the fix | Verified | Section 1 |

The blocking-date record for the owner is unchanged from round 1. The date is
`2026-11-11` (UTC), set on the assumption that the PR merges on 2026-11-04.
It moves to merge + 7 days if the merge is later; a merge after 2026-11-16 is
BLOCKED ON OWNER. The run-time cap of 2026-11-23 now enforces the outer bound
in the gate itself. If the owner grants a schedule exception, the cap must
move with it, as `implementation.md` notes.

Verdict: APPROVED
