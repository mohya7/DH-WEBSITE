# GAP-08: add actionlint (plan)

Role: architect (step 1). Branch `change/GAP-08`, cut from
`origin/rebuild/dotnet-platform` at `6470fac`. Date 2026-11-01.

**Governing documents are not on the base branch.** `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/deferred-items.md`, `docs/changes/README.md`, `docs/adr/` and
`.github/pull_request_template.md` are missing from `6470fac` (checked with
`test -e`, all MISSING). The base has `AGENTS.md` and `CLAUDE.md`, whose status
line still says "Phase C, the public website, is next". This plan was written
from read-only copies of those documents (the updated `AGENTS.md`, the
standard, the profile, the refinement plan, ADR 0001, the admin audit, the
deferred register, the PR template, the 27 October baseline and test report)
supplied outside the repository. Where this plan quotes them, it quotes those
copies. No content was guessed.

Owner's words that start this work, quoted exactly (Mohamed Elbadry,
2026-11-01, project thread): "Start waves 0 & 1 and update me with each gap
done". Nothing in that grants an exception or a behaviour change.

## 1. Item

| Field | Value |
| --- | --- |
| Closes | GAP-08 (rule G-13, Workflow lint) |
| Track | G1, Wave 1 ("make CI honest", 3 to 16 November; gates block by 23 November) |
| Register row (refinement plan) | "GAP-08 \| CI \| G-13 \| No workflow lint; only `security.yml` checked against golden copies \| actionlint on every workflow, 0 findings \| Medium \| Low \| Wave 1" |
| Wave 1 table, "Done when" | "Add actionlint \| GAP-08 \| Agent \| 0 findings across all workflows" |
| Standard, G-13 | "Workflow lint \| 0 findings \| Golden copies for `security.yml` \| Gap: actionlint on every workflow, step 3" |
| Standard, section 3 | "A new gate reports for seven days from its merge (a `*_BLOCKING_FROM` date in the workflow), then blocks, unless it replaces protection that already existed. Tools are pinned by exact version or checksum. Each gate has a test that proves it still fires." |

Not closed here: GAP-09 (pin every action by SHA, image by digest, Node and
.NET exact), GAP-21 (canary for every other gate), GAP-03 (branch protection).

## 2. Current state

**Workflows on the base** (`.github/workflows/`): `ci.yml` (14 847 bytes, five
jobs: `api`, `website`, `studio`, `section-compare`, `screenshot-parity`),
`security.yml` (six jobs), `codeql.yml` (one matrix job). No workflow lint of
any kind runs. No `.github/actionlint.yaml` or `.github/actionlint.yml` exists.

**Existing workflow protection (G-13 "enforced by").** Only `security.yml` is
protected, by golden copies checked in `.github/security/gate.test.mjs`, which
the `gate-self-test` job runs:

- `security.yml` must equal `.github/security/security.expected.yml` byte for
  byte (`goldenDifference`, line 903; `semgrepShapeProblems`, line 1008).
- Every `*.sh` under `.github/security/` must be listed in `pinnedScripts`
  (line 923) or `scriptExemptions` (line 929), else the self-test fails with
  "`<name>` is neither pinned nor exempt" (`shellPinProblems`, line 931).
- `inlineInterpreterProblems` (line 1081) reads **every** `*.yml` in
  `.github/workflows/` and fails on inline `node -e`, `--input-type=module` or
  `python -c`. A new workflow is therefore already inside that check.
- No test enumerates the workflow files or the jobs in `ci.yml`, so a new
  workflow file does not need a golden copy to keep the security self-test green.

Baseline of that self-test, run in the worktree:

```
$ node --test .github/security/gate.test.mjs
# tests 62
# pass 62
# fail 0
```

**Binary-install model.** `.github/security/install-gitleaks.sh` (pinned by
`install-gitleaks.expected.sh`) reads `GITLEAKS_VERSION` and `GITLEAKS_SHA256`
from the workflow `env`, downloads the release asset with `curl -sSfL` into
`$RUNNER_TEMP`, checks it with `sha256sum --check --strict`, and extracts only
the binary. The `env` comment cites "the release's checksums.txt". This plan
copies that model.

**actionlint obtained and verified locally.** Network: release assets on
github.com download (HTTP 200 via `release-assets.githubusercontent.com`);
`api.github.com` is refused (403) in this container. Latest release from the Go
module proxy:

```
$ curl -sS https://proxy.golang.org/github.com/rhysd/actionlint/@latest
{"Version":"v1.7.12","Time":"2026-03-30T17:47:17Z",...,"Hash":"914e7df21a07ef503a81201c76d2b11c789d3fca","Ref":"refs/tags/v1.7.12"}
```

```
$ curl -sSfL -O .../rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz
$ curl -sSfL -O .../rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt
$ grep linux_amd64 actionlint_1.7.12_checksums.txt
8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8  actionlint_1.7.12_linux_amd64.tar.gz
$ sha256sum --check --strict --ignore-missing actionlint_1.7.12_checksums.txt
actionlint_1.7.12_linux_amd64.tar.gz: OK            (exit 0)
$ ./actionlint -version
1.7.12
installed by downloading from release page
built with go1.26.1 compiler for linux/amd64
```

Cross-check through an independent channel: `go install
github.com/rhysd/actionlint/cmd/actionlint@v1.7.12` (module verified by
`sum.golang.org`) reports `v1.7.12 ... installed by building from source` and
gives identical findings on every input below.

**shellcheck matters, and silently disappears.** actionlint runs shellcheck on
every `run:` script only when it finds the binary. GitHub's runners ship their
own shellcheck, whose version moves with the image. Pointed at a missing
shellcheck, actionlint drops the check without an error (canary run with
`-shellcheck=/nonexistent/shellcheck`: exit 1, five findings, the SC2086 finding
absent). So the gate pins shellcheck too and the canary proves it ran.

shellcheck 0.11.0, verified two ways:

```
$ sha256sum shellcheck-v0.11.0.linux.x86_64.tar.xz        (GitHub release koalaman/shellcheck v0.11.0)
8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198
$ sha256sum shellcheck-v0.11.0/shellcheck <PyPI shellcheck-py 0.11.0.1 wheel>/shellcheck
4da528ddb3a4d1b7b24a59d4e16eb2f5fd960f4bd9a3708a15baddbdf1d5a55b  shellcheck-v0.11.0/shellcheck
4da528ddb3a4d1b7b24a59d4e16eb2f5fd960f4bd9a3708a15baddbdf1d5a55b  .../shellcheck_py-0.11.0.1.data/scripts/shellcheck
```

The wheel was itself checked against the sha256 PyPI publishes
(`1b274df8…beef05`, `sc.whl: OK`). koalaman publishes no checksum file, so the
tarball's sha256 above is the pin, and the identical binary from PyPI is its
independent confirmation.

**Current findings: 0.** Run in `/home/user/wt-GAP-08` (all three workflows):

```
$ actionlint -shellcheck=<shellcheck 0.11.0> -pyflakes=
(no output)                                               exit=0
$ actionlint -shellcheck= -pyflakes=                       (shellcheck off)
(no output)                                               exit=0
```

The Go-built binary gives the same `exit=0`. The `ci.yml` from PR #38
(`origin/change/ci-runner-pin`, `b472fe5`) also lints clean: `exit=0`.

**actionlint exit codes, as observed with 1.7.12:** 0 no findings; 1 findings
(a YAML parse error is also a finding, `[syntax-check]`, exit 1); 2 bad command
line (`-bogusflag`); 3 fatal error (a bad `-format` template). The `-format`
template accepts `\n` literally; `{{"\n"}}` does not parse.

**Overlapping work.**

- PR #38 (`origin/change/ci-runner-pin`) changes only `runs-on` in the five
  `ci.yml` jobs to `ubuntu-24.04`, because "ubuntu-latest moved to Ubuntu
  26.04, where Playwright 1.56.1 cannot install its browsers". Its plan
  (line 252) records "`actionlint` is not installed in this repository
  (GAP-08). NOT RUN."
- GAP-09 will pin every `uses:` by 40-character SHA and update the golden
  copies in `.github/security/`.

## 3. Design

A new, separate workflow, `.github/workflows/workflow-lint.yml`, with one job,
`actionlint (every workflow)`. Its scripts and canary live in a new folder,
`.github/lint/`. Nothing in `ci.yml`, `security.yml`, `codeql.yml` or
`.github/security/` changes.

Job steps, in order:

1. `actions/checkout`, pinned by SHA (`11d5960a326750d5838078e36cf38b85af677262`,
   tag v4.4.0, committed 2026-07-16, the newest v4 release, matching the `@v4`
   the other workflows use), `persist-credentials: false`.
2. `bash .github/lint/install-actionlint.sh`: downloads actionlint 1.7.12 and
   shellcheck 0.11.0 into `$RUNNER_TEMP`, each checked with
   `sha256sum --check --strict` against `ACTIONLINT_SHA256` and
   `SHELLCHECK_SHA256` from the workflow `env`, as `install-gitleaks.sh` does.
   A failed download or checksum fails the job.
3. `bash .github/lint/self-test.sh`: proves the gate's own logic with stub
   binaries (see Test plan). Always blocking.
4. `bash .github/lint/run-actionlint.sh canary`: runs the real actionlint and
   shellcheck on the committed fixture `.github/lint/canary/canary-workflow.yml`
   and requires the findings to equal `.github/lint/canary.expected` exactly.
   Always blocking: a gate that cannot fire is a gate that cannot run.
5. `bash .github/lint/run-actionlint.sh workflows`: runs actionlint with no file
   arguments, so it lints every `*.yml` and `*.yaml` in `.github/workflows/`,
   including `workflow-lint.yml` itself. Report mode until
   `ACTIONLINT_BLOCKING_FROM`, then blocking.

`run-actionlint.sh` rules (each one has a self-test case):

- Invokes exactly `"$RUNNER_TEMP/actionlint" -no-color -shellcheck="$RUNNER_TEMP/shellcheck" -pyflakes= -format '<template>'`.
  The template prints `file:line:col:kind:message` per finding, one per line,
  with a literal `\n`. `-pyflakes=` is explicit: no workflow uses
  `shell: python`, and pyflakes is not on the runner, so today it is skipped
  silently; making that visible is better than an implicit skip.
- Fails if `$RUNNER_TEMP/shellcheck` is not an executable file (actionlint
  would drop the check silently).
- Fails if `.github/actionlint.yaml` or `.github/actionlint.yml` exists. A
  config file can ignore findings by path or by message, which would loosen the
  gate without touching this workflow. Adding one later is its own reviewed
  change to this script.
- Never passes `-ignore`.
- actionlint exit 0: prints "actionlint: 0 findings in .github/workflows" and
  exits 0.
- Exit 1 (findings): prints the findings. If today (UTC, `date -u +%F`) is
  before `ACTIONLINT_BLOCKING_FROM`, prints
  `::warning title=actionlint (report mode until <date>)::<n> finding(s)` and
  exits 0; on or after that date prints `::error ...` and exits 1.
- Any other exit (2, 3, crash): fails at once, in report mode too.
- `ACTIONLINT_BLOCKING_FROM` missing, not `YYYY-MM-DD`, or not a real date
  (`date -u -d "$v" +%F` must give back `$v`): fails at once.
- `canary` mode: any exit other than 1 fails; output reduced to
  `line:col:kind` must equal `.github/lint/canary.expected`; date ignored.
- Any other mode argument, or none: fails with usage.

Workflow shape:

- Triggers: `pull_request` (all branches, as `security.yml`), `push` to
  `rebuild/dotnet-platform`, `workflow_dispatch`. No `paths:` filter: a check
  that is skipped on some pull requests can never be made required, and the job
  takes seconds.
- `permissions: contents: read`; `concurrency` group
  `workflow-lint-${{ github.ref }}`, as the other workflows.
- `runs-on: ubuntu-24.04`, the same pin and reason as PR #38 (`ubuntu-latest`
  is now 26.04). The job uses no runner tool except `curl`, `tar`, `xz`,
  `sha256sum`, `date` and `bash`.
- `env`: `ACTIONLINT_VERSION: "1.7.12"`, `ACTIONLINT_SHA256`,
  `SHELLCHECK_VERSION: "0.11.0"`, `SHELLCHECK_SHA256` (values in section 2),
  `ACTIONLINT_BLOCKING_FROM` (below). Each sha256 has a comment naming its
  source, as `security.yml` does for gitleaks.
- No `continue-on-error`, no `if:` on the job or any step, no inline node or
  python (the security self-test checks the last one on every workflow).

**Report week.** The standard says a new gate reports for seven days from its
merge. actionlint does not replace existing protection (the `security.yml`
golden copies stay), so it reports first. The developer sets
`ACTIONLINT_BLOCKING_FROM` to the planned merge date plus seven days
(`"2026-11-11"` if it merges on 4 November). If the pull request merges later,
the date is moved in the same pull request, before merge, so it is never less
than seven days after the merge, and never after `2026-11-23`, Wave 1's
blocking date. With 0 findings today, report mode changes nothing visible; it
exists so a regression in another open pull request during the week warns
before it fails.

**Canary fixture** `.github/lint/canary/canary-workflow.yml` (outside
`.github/workflows/`, so GitHub never runs it and the real lint never sees it).
Verified locally with both binaries:

```yaml
# Canary for the actionlint gate (GAP-08). Never copy this into .github/workflows.
# Each numbered mistake must be reported; .github/lint/canary.expected lists them.
name: actionlint canary

on: pull_request

permissions:
  contents: read

jobs:
  canary:
    runs-on: ubuntu-latst # 1 runner-label: misspelt runner
    needs: no-such-job # 2 job-needs: unknown job
    steps:
      - uses: actions/checkout@v4
        with:
          not-an-input: true # 3 action: unknown input
      - run: echo "${{ github.event.pull_request.title }}" # 4 expression: untrusted input in a script
      - run: echo "${{ matrix.missing }}" # 5 expression: undefined property
      - run: echo $UNQUOTED # 6 shellcheck SC2086: proves shellcheck ran
```

`.github/lint/canary.expected`, as actionlint 1.7.12 with shellcheck 0.11.0
reports it (both the release binary and the Go-built one):

```
11:3:job-needs
12:14:runner-label
17:11:action
18:24:expression
19:24:expression
20:9:shellcheck
```

Without shellcheck the last line is missing, so the canary fails; with a config
file or `-ignore` hiding any kind, a line is missing. The fixture's
`actions/checkout@v4` is deliberate: actionlint knows action inputs by tag, so
check 3 needs a tag. It is not a real workflow.

**Alternatives rejected.**

| Alternative | Why not |
| --- | --- |
| A job inside `ci.yml` | PR #38 edits every `ci.yml` job and GAP-09 will edit every `uses:` there; a new job would conflict with both. A separate workflow touches neither. |
| A job inside `security.yml` | `security.yml` must match `security.expected.yml` byte for byte, and every `run:` is on an allow-list in `gate.test.mjs`. Adding the job means changing the security gate's golden copies and test in the same pull request: two gates in one change (B-8). |
| Scripts under `.github/security/` | `shellPinProblems` fails on any new `*.sh` there unless `gate.test.mjs` lists it, which again edits the security gate. `.github/lint/` keeps the gates apart. |
| Golden `.expected` copies for the new workflow and scripts | That pattern guards `security.yml` specifically (G-13, P-6). The track checklist's guard for every new gate is the committed canary (GAP-21), which this change has; whether every gate also gets golden copies is GAP-21's decision across all gates, not this one's. |
| `rhysd/actionlint` Docker image or a marketplace action | Another floating input (tag) or a third-party action with repository access; the checksum-verified binary matches how gitleaks is installed. |
| `go install` in CI | Needs a pinned Go toolchain and a module download every run; the release binary plus sha256 is simpler. Used here only as an independent cross-check. |
| The runner's preinstalled shellcheck | Its version moves with the runner image (G-15). |
| Blocking at once, since findings are 0 | The standard reserves that for a gate that replaces existing protection. This one adds protection. |
| `-ignore` or a config file for future noise | Nothing to ignore today; an ignore list would be a baseline, which can only shrink, and is out of scope until a finding needs one. |

## 4. Scope

Create:

| File | Content |
| --- | --- |
| `.github/workflows/workflow-lint.yml` | The workflow in section 3: header comment (what it checks, report week, the pins and their sources, why it is separate from `ci.yml` and `security.yml`), one job, five steps |
| `.github/lint/install-actionlint.sh` | `#!/bin/sh`, `set -eu`; downloads and verifies actionlint and shellcheck into `$RUNNER_TEMP`; extracts only `actionlint` and `shellcheck` |
| `.github/lint/run-actionlint.sh` | The gate, rules in section 3; modes `workflows` and `canary` |
| `.github/lint/self-test.sh` | The gate's self-test (section 5) |
| `.github/lint/canary/canary-workflow.yml` | The canary fixture above |
| `.github/lint/canary.expected` | The six expected `line:col:kind` lines |
| `docs/changes/GAP-08/*.md` | This plan and the pipeline's records |

Change: nothing else. In particular `ci.yml`, `security.yml`, `codeql.yml`,
`.github/security/*`, `.github/dependabot.yml` and `.gitattributes` are not
touched. (Dependabot's existing `github-actions` entry covers the new
workflow's SHA pin with no edit.)

Out of scope, deliberately:

- Fixing findings in other workflows: there are none today.
- Pinning `ci.yml`, `security.yml` or `codeql.yml` actions by SHA, the SQL
  Server image by digest, or Node and .NET exactly: GAP-09 and GAP-10.
- `runs-on` in `ci.yml`: PR #38. `security.yml` and `codeql.yml` stay on
  `ubuntu-latest` here; GAP-09 or a follow-up of #38 owns that.
- Golden copies or canaries for other gates: GAP-21.
- Making the new check a required status check: an owner settings step under
  GAP-03 and O-9 (see section 10).
- Updating the stale status in `AGENTS.md` and `CLAUDE.md`: GAP-13.
- Linting the gate's own shell scripts with shellcheck as part of the gate.
  They are checked locally in the test plan; making that a gate is a separate
  one (B-8).

## 5. Test plan

**First failing test, written and committed before any gate code:**
`.github/lint/self-test.sh`, together with the fixture
`.github/lint/canary/canary-workflow.yml` and `.github/lint/canary.expected`.
Run before `run-actionlint.sh` exists, every case fails (the script is
missing); the developer quotes that red run in `implementation.md`.

The self-test makes a temporary directory per case, sets `RUNNER_TEMP` to it,
places a stub `actionlint` there (a script that prints given lines and exits
with a given code) and a stub `shellcheck`, and, for date cases, puts a stub
`date` first on `PATH` that answers `date -u +%F` with a fixed day and passes
every other call to the real `date`. It runs `run-actionlint.sh` from a
temporary copy of the repository layout where a case needs a config file. No
test-only switch is added to the gate. Cases (each asserts the exit code and
the key output line):

| # | Case | Expected |
| --- | --- | --- |
| 1 | stub exits 0 | exit 0, "0 findings" |
| 2 | stub exits 1 with one finding, today before `ACTIONLINT_BLOCKING_FROM` | exit 0, finding printed, `::warning` line |
| 3 | same, today equal to `ACTIONLINT_BLOCKING_FROM` | exit 1, `::error` line |
| 4 | same, today after it | exit 1 |
| 5 | stub exits 2, report mode | exit 1 |
| 6 | stub exits 3, report mode | exit 1 |
| 7 | `workflows` mode, `ACTIONLINT_BLOCKING_FROM` unset | exit 1 |
| 8 | `workflows` mode, `ACTIONLINT_BLOCKING_FROM=2026-13-45` and `=11/11/2026` | exit 1 each |
| 9 | `$RUNNER_TEMP/shellcheck` missing, report mode, stub exits 0 | exit 1 |
| 10 | `.github/actionlint.yaml` present; then `.github/actionlint.yml` | exit 1 each |
| 11 | canary mode, stub prints exactly the six expected lines, exits 1 | exit 0 |
| 12 | canary mode, stub prints five lines (shellcheck line missing) | exit 1 |
| 13 | canary mode, stub exits 0 | exit 1 |
| 14 | canary mode ignores the date: case 11 repeated with today after `ACTIONLINT_BLOCKING_FROM`, and with it unset | exit 0 both times |
| 15 | no mode, unknown mode | exit 1 |
| 16 | the stub received `-shellcheck=$RUNNER_TEMP/shellcheck` and `-pyflakes=` and no `-ignore` (stub records its arguments) | as stated |
| 17 | `workflow-lint.yml` sets `ACTIONLINT_BLOCKING_FROM` to a valid date no later than `2026-11-23`, has no `continue-on-error`, and every `uses:` is a 40-character SHA | as stated |

Then, in this order, each quoted with command, exit code and output in
`implementation.md`:

```sh
# 0. the self-test, red first, then green
bash .github/lint/self-test.sh

# 1. install exactly as CI does (network to github.com release assets works here)
export RUNNER_TEMP="$(mktemp -d)" ACTIONLINT_VERSION=1.7.12 \
  ACTIONLINT_SHA256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 \
  SHELLCHECK_VERSION=0.11.0 \
  SHELLCHECK_SHA256=8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198
bash .github/lint/install-actionlint.sh            # expect two ": OK" lines, exit 0
"$RUNNER_TEMP/actionlint" -version                  # 1.7.12
"$RUNNER_TEMP/shellcheck" --version                 # version: 0.11.0

# 2. a wrong checksum fails the install
ACTIONLINT_SHA256=0000000000000000000000000000000000000000000000000000000000000000 \
  RUNNER_TEMP="$(mktemp -d)" bash .github/lint/install-actionlint.sh   # expect non-zero

# 3. canary with the real tools
bash .github/lint/run-actionlint.sh canary          # exit 0

# 4. the gate on every workflow, report and blocking dates
ACTIONLINT_BLOCKING_FROM=2026-11-11 bash .github/lint/run-actionlint.sh workflows   # exit 0, 0 findings
ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   # exit 0, 0 findings

# 5. it fires on a real workflow: in a scratch copy of the worktree, add
#    `- run: echo "${{ github.event.pull_request.title }}"` to a ci.yml step, then
ACTIONLINT_BLOCKING_FROM=2099-01-01 bash .github/lint/run-actionlint.sh workflows   # exit 0, ::warning, 1 finding
ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   # exit 1, ::error
#    (scratch copy only; the worktree's ci.yml is never edited)

# 6. the gate's own scripts are clean
"$RUNNER_TEMP/shellcheck" .github/lint/*.sh         # exit 0

# 7. the security gate still passes with a new workflow beside it
node --test .github/security/gate.test.mjs          # 62 pass, 0 fail

# 8. nothing else changed
git diff --stat origin/rebuild/dotnet-platform...HEAD   # only .github/lint/**, the new workflow, docs/changes/GAP-08/**
```

API, website and Studio suites: NOT RUN by design, because no file they build or
test changes; the CI workflow runs them on the pull request regardless. The
pull request's own CI run is evidence too: "Workflow lint / actionlint (every
workflow)" green, with the canary step's output showing the six findings
matched, and "Security / Security gate self-test" green.

What can only run in CI: the job on a real `ubuntu-24.04` runner (local runs use
the same binaries on this container's Linux). Everything else above runs here.

**Track checklist (G1, Waves 1 to 3)**, for the developer and tester:

| Rule | How this change meets it |
| --- | --- |
| One gate per pull request (B-8) | One gate, actionlint; no other workflow or gate touched |
| New gate reports for seven days via `*_BLOCKING_FROM`, then blocks | `ACTIONLINT_BLOCKING_FROM` in the workflow env; cases 2 to 4 and 17 |
| Committed canary fixture it must reject (GAP-21) | `.github/lint/canary/canary-workflow.yml` and `canary.expected`, run in every job, always blocking |
| Actions pinned by 40-character SHA | `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`; case 17 |
| SQL Server image by digest | Not used by this job |
| Node and .NET exact | Not used by this job |
| Tools pinned exactly (G-15) | actionlint 1.7.12 and shellcheck 0.11.0, sha256-checked; runner `ubuntu-24.04` |
| Baselines only shrink | Baseline is 0 findings; no baseline file and no ignore list |

## 6. Security impact

- Routes, policies, data, logins: none; no application code changes.
- Secrets: none read. `permissions: contents: read`;
  `persist-credentials: false`, so the job has no token on disk after checkout.
- Dependencies: two new CI-only binaries downloaded from GitHub releases,
  each verified by sha256 before use: actionlint 1.7.12 (sha256 from the
  release's `checksums.txt`, findings cross-checked against a build from the
  `sum.golang.org`-verified module) and shellcheck 0.11.0 (sha256 of the
  release tarball, binary identical to the PyPI wheel's). One action,
  `actions/checkout`, pinned by commit SHA. No npm, NuGet or Go dependency is
  added to the repository.
- Benefit: actionlint's expression check flags untrusted `github.event.*`
  values used directly in `run:` scripts (script injection), on every workflow.
- The canary contains an injection pattern on purpose; it lives outside
  `.github/workflows/` and never runs.

## 7. Migrations

None. No schema or data change.

## 8. Rollback

Revert the pull request. Nothing else depends on the new workflow; if the check
has been made required by then, the owner removes it from the branch rule.

## 9. Owner decisions needed

None. The owner's words "Start waves 0 & 1 and update me with each gap done"
(2026-11-01, project thread) cover starting this Wave 1 item. The design takes
no exception and changes no behaviour.

For the owner's information, not a decision this plan waits on: for the gate to
stop a merge after `ACTIONLINT_BLOCKING_FROM`, the check
"actionlint (every workflow)" has to be added to the required status checks of
`rebuild/dotnet-platform`. That is a settings step under GAP-03, which waits on
O-9 (paid GitHub plan for branch protection on a private repository). Until
then the job turns red but does not block, as CI and Security do today.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| shellcheck missing or moved, and actionlint silently skips it | Gate fails if `$RUNNER_TEMP/shellcheck` is absent (case 9); canary needs the `shellcheck` line (case 12, real canary step) |
| Gate loosened by an `-ignore`, a config file, `continue-on-error` or a far-future date | Cases 10, 16, 17; the canary loses lines under an ignore |
| Download altered or swapped | `sha256sum --check --strict`; test-plan step 2 proves a wrong sum fails |
| GitHub release asset unreachable in CI | Install fails and the job fails (a gate that cannot run fails); no fallback to an unverified source |
| A future actionlint or shellcheck changes the canary's columns or kinds | Versions are pinned; a bump is its own pull request that updates `canary.expected` with the new output quoted |
| Dependabot bumps the checkout SHA | Normal Dependabot pull request; no golden copy to leave behind, so it is not stuck red |
| Merge order with PR #38 | No shared file. #38's `ci.yml` lints clean today (exit 0). Whichever lands second is linted by this gate |
| Merge order with GAP-09 | GAP-09 does not need to touch `workflow-lint.yml` (already SHA-pinned). GAP-09's "every `uses:` is a SHA" check must be scoped to `.github/workflows/`, because the canary deliberately uses `@v4`; GAP-09's architect is told in this plan |
| The report date is set wrong at merge | Case 17 bounds it to a valid date no later than 23 November; tester checks it is at least seven days after the merge date |
| The new workflow breaks the security self-test (inline interpreter scan) | Test-plan step 7 |
| Required-check gap (section 9) | Stated to the owner; outside this pull request |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| actionlint runs on every workflow in `.github/workflows/` | GAP-08 register row; G-13 | Planned | |
| 0 findings across all workflows | Wave 1 table, "Done when" | Planned | |
| actionlint and shellcheck pinned exactly and sha256-verified | Standard section 3; G-15 | Planned | |
| Reports until `ACTIONLINT_BLOCKING_FROM`, then blocks; the date is at least seven days after merge and no later than 23 November | Standard section 3; track checklist; refinement plan Wave 1 | Planned | |
| A gate that cannot run fails (exit 2 or 3, missing shellcheck, bad date, config file) | Standard section 3 | Planned | |
| Committed canary fixture rejected in every run | Track checklist; GAP-21 | Planned | |
| The new workflow's action pinned by 40-character SHA | Track checklist | Planned | |
| One gate in this pull request; `ci.yml`, `security.yml`, `.github/security/` unchanged | B-8; PR #38 and GAP-09 overlap | Planned | |
| Security gate self-test still 62 of 62 | P-6 | Planned | |
| Self-test committed red before the gate script | Test-first (pipeline) | Planned | |

## 12. Revision log

| Round | Point raised | Answer |
| --- | --- | --- |
| 1 | First version | — |
