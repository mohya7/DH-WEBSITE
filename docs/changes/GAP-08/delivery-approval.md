# GAP-08: add actionlint (delivery approval, gate 2)

Role: tech-lead, gate 2. Branch `change/GAP-08`, worktree
`/home/user/wt-GAP-08`, head `70f7044`, base `origin/rebuild/dotnet-platform`
= `6470fac` (re-checked after `git fetch` on 2026-11-01; it has not moved).
Date 2026-11-01. Governing documents read from the read-only copies outside
the repository (`docs/changes/README.md`, `.claude/agents/tech-lead.md`,
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md`,
`.github/pull_request_template.md`), since they are not on the base. Read in
full: `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`,
`test-report.md` (round 1, `Verdict: APPROVED`, three Minors, uncommitted in
the worktree).

This decision is a role in the pipeline. It is not the owner's confirmation
that `AGENTS.md` requires, and it is not an owner decision.

## Round 1

### Decision

Changes needed. The implementation matches the approved plan, the evidence is
real, and everything I re-ran is green. It goes back to the developer for two
of the tester's three Minors, because both let the gate be loosened without
its own checks noticing, which P-6 ("Never weaken a gate, guard or test to make
something pass") and the plan's own rule ("A config file can ignore findings
... which would loosen the gate") do not allow. Neither needs a plan change:
both make an existing rule of plan section 3 or case 17 do what it already
says. So the change goes to the developer, then the tester again, not to the
architect.

### Tester's Minors: decision on each

**Minor 2, `SHELLCHECK_OPTS` narrows shellcheck silently. Must be fixed.**
Reproduced (scratch copy of `.github` at `70f7044`, real actionlint 1.7.12 and
shellcheck 0.11.0, `- run: rm $(ls)` added to `ci.yml`):

```
$ ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows      exit=1
.github/workflows/ci.yml:137:9:shellcheck:shellcheck reported issue in this script: SC2046:warning:...
::error title=actionlint::1 finding(s) in .github/workflows (blocking since 2026-11-01)
$ SHELLCHECK_OPTS='-e SC2046' ACTIONLINT_BLOCKING_FROM=2026-11-01 bash .github/lint/run-actionlint.sh workflows   exit=0
actionlint: 0 findings in .github/workflows
$ SHELLCHECK_OPTS='-e SC2046' bash .github/lint/run-actionlint.sh canary                 exit=0
actionlint canary: all 6 expected findings reported
```

This is the same hole as an actionlint config file, which the gate already
refuses for exactly this reason: it removes a whole class of findings, the
gate still prints "0 findings", and the canary does not notice (it proves only
SC2086). A one-line `env:` entry, or a write to `$GITHUB_ENV` in an earlier
step, would do it, and nothing in the self-test flags either. A gate must not
be loosenable silently, so this is not accepted as a follow-up.

Required: `run-actionlint.sh` fails, in both modes and in report mode too,
with an `::error` naming the variable, when `SHELLCHECK_OPTS` is set (refuse,
not unset: a refusal is visible in the log, an unset hides that someone tried).
A new self-test case proves it (set, non-empty; and set to an empty string,
which must also be refused or shown harmless with evidence), and the tester's
reproduction above is re-run and quoted.

**Minor 1, case 17 is line-based. Must be fixed for the five mutations the
tester found.** Reproduced one of them myself: adding
`env: { ACTIONLINT_BLOCKING_FROM: "2099-01-01" }` to the lint step leaves
`ok   17 workflow-lint.yml shape` and self-test exit 0, while the gate would
report forever. Case 17 is the guard that gate 1 condition 1 asked for, and
the date override and the `$GITHUB_ENV` write defeat the report-week rule
(standard section 3) and the 23 November bound with an edit a reviewer could
read as harmless. A full YAML parser is not required. Required outcome: each of
the tester's five mutations (flow-mapping step `env` override of
`ACTIONLINT_BLOCKING_FROM`; quoted `"continue-on-error"`; quoted `"if"`; any
write to `$GITHUB_ENV` or `$GITHUB_PATH` in `workflow-lint.yml` or
`.github/lint/*.sh`; `SHELLCHECK_OPTS` anywhere in `workflow-lint.yml`) makes
the self-test or the gate fail, shown by a mutation run quoted like the
existing one in `implementation.md`, with the original eight mutations re-run
too. Suggested, not mandated: have `run-actionlint.sh` itself refuse an
`ACTIONLINT_BLOCKING_FROM` after `2026-11-23`, which closes every date-override
route at run time whatever YAML form it takes; and make case 17 strip comments
and match the keys quoted or unquoted.

**Minor 3, actionlint exit 1 with empty output fails without a message.
Accepted as a recorded follow-up.** Reproduced (stub `actionlint` that only
exits 1, report mode): exit 1, blank output. It fails closed, so the gate
cannot pass silently; the gap is diagnosis only, and P-6 is not engaged. The
developer may fix it in this round (`grep -c . || true`, and an `::error` when
the count is 0) with a self-test case; if not fixed, it goes in the pull
request's "Review findings accepted" as written in the draft below.

### What I verified myself

Commands run in `/home/user/wt-GAP-08` (head `70f7044`) or a scratch copy of
its `.github` under the session scratchpad; `TMPDIR` in the scratchpad.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Install, pinned and checked | `bash .github/lint/install-actionlint.sh` (env as plan step 1) | 0 | `actionlint_1.7.12_linux_amd64.tar.gz: OK`, `shellcheck-v0.11.0.linux.x86_64.tar.xz: OK`, `1.7.12`, `version: 0.11.0` |
| Self-test | `bash .github/lint/self-test.sh` | 0 | `ok   17 workflow-lint.yml shape`, "actionlint gate self-test: all cases passed" |
| Canary | `bash .github/lint/run-actionlint.sh canary` | 0 | "actionlint canary: all 6 expected findings reported" |
| Every workflow | `ACTIONLINT_BLOCKING_FROM=2026-11-11 bash .github/lint/run-actionlint.sh workflows` | 0 | "actionlint: 0 findings in .github/workflows" |
| Scope | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` filtered against `.github/lint/`, `.github/workflows/workflow-lint.yml`, `docs/changes/GAP-08/` | grep 1 (nothing outside) | only the planned files |
| Test first | `git show --stat c6183b3` | 0 | only `self-test.sh`, the canary and `canary.expected`; gate in `69f0b86` after it |
| Minors 1 to 3 | as quoted above | | each reproduced |

Read and checked against the plan: `run-actionlint.sh` (every rule of plan
section 3 is there: exit 0/1/other, shellcheck present and executable, config
file refused, date validated with `date -u`, `-pyflakes=`, no `-ignore`, canary
`line:col:kind` diff), `install-actionlint.sh` (as `install-gitleaks.sh`,
`sha256sum --check --strict`, no fallback), `workflow-lint.yml` (triggers,
`contents: read`, `persist-credentials: false`, checkout
`11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`, `ubuntu-24.04`, five
steps, no `if:`/`paths`/`continue-on-error`, `ACTIONLINT_BLOCKING_FROM:
"2026-11-11"`). The only additions beyond the plan are `timeout-minutes: 10`
(a bound, not a loosening) and the four-line canary header that gate 1
condition 2 asked for; the developer records both.

Gate 1 conditions: 1 met in the form written but bypassable (Minor 1, above);
2 met (canary lines 3 to 6, and the draft PR text); 3 met as an assumption
recorded for the owner and integrator (merge no earlier than 2026-11-04, date
2026-11-11; stop and BLOCKED ON OWNER if the merge slips past 2026-11-16);
4 met (`c6183b3`, red run quoted by developer and tester); 5 met (steps 0 to 8
quoted, NOT RUN rows with their CI jobs); 6 met (scope above, base unmoved).

Tester's evidence is real: commands, exit codes and output lines, plus
independent pin checks (`git ls-remote` for checkout, release `checksums.txt`
for actionlint, the PyPI wheel for shellcheck). Every coverage-table row has
evidence. My re-runs agree with theirs.

Commits (B-4): every commit carries the `GAP-08:` prefix, a body that says
why, and the attribution trailers. `GAP-08: Plan` and `GAP-08: Implementation
record` are noun phrases rather than imperative; they follow the pipeline's
record-commit pattern and I do not ask for history to be rewritten, but the
fix commit's subject must be imperative.

### What the developer does in round 2

1. Fix Minor 2 and Minor 1 as required above; Minor 3 optional in this round.
2. Each new behaviour gets a self-test case, committed with or before the fix
   and shown failing first on the current gate (quote the red run).
3. Re-run and quote plan steps 0, 3, 4, 6, 7 and 8, and the mutation runs.
4. Commit `test-report.md` (round 1) with the change; it is uncommitted now.
5. Append a round 2 section to `implementation.md`; do not rewrite round 1.

Then the tester runs round 2, and this gate is held again.

### Open items (for delivery, whatever round passes)

- **CI on the final head**: NOT RUN here, nothing is pushed. "Workflow lint /
  actionlint (every workflow)" and "Security / Security gate self-test" must
  be green on the pull request, run ids quoted.
- **Security npm audit for the website will be red** on this pull request
  until Wave 0 (GAP-01 to GAP-03) lands: base dependencies, 3 new findings
  including critical `GHSA-673q-mjm6-r5xr` (tester, section 4). Not caused by
  this change; Wave 0 merges first anyway.
- **Blocking date at merge**: the integrator re-checks
  `ACTIONLINT_BLOCKING_FROM` is the merge date plus at least seven days and no
  later than 2026-11-23 (UTC midnight, 02:00 Cairo). Past 2026-11-16: stop,
  BLOCKED ON OWNER.
- **Required status check**: an owner settings step under GAP-03 / O-9.
- **Upper-case `.YML` workflows are not collected** by actionlint 1.7.12
  (tester, section 5, not raised). Follow-up note for GAP-21.
- **Owner's confirmation** under `AGENTS.md` before anything is pushed or
  merged.

### Definition of Done (as the draft below states it after round 2)

Can be ticked once round 2 passes: requirement met (0 findings, every
workflow); standards; no prohibited constructs; no routes touched; tests and
regression tests (self-test and canary); rollback (revert); governance
"documentation updated" (the records). Open: PR checks green on the final
head; independent code review on the pull request; review by someone other
than the author; deployment note (integrator, suites re-run after merge);
`AGENTS.md` coverage table (GAP-13 owns the stale status) and
`docs/deferred-items.md` (only if Minor 3 or another item becomes an
exception; a follow-up is not an exception).

### Draft pull request description

Superseded by the round 2 draft below.

Round 1 result: changes needed (sent back to the developer).

## Round 2

Head `8727495` (`e18a093` red self-test cases, `46ea9c6` the fix, `8727495`
the record). Base still `6470fac`. Read again: `implementation.md` round 2 and
`test-report.md` round 2 (head `8727495`, `Verdict: APPROVED`, new Minor 4).

### Decision

Approved for the owner. Round 1's required fixes are in and I verified them
myself. Minor 4 is accepted as a recorded follow-up, for the reasons below.

### Round 1 findings, verified myself

Real actionlint 1.7.12 and shellcheck 0.11.0; scratch copies under the session
scratchpad, removed afterwards.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| New cases red first | `bash .github/lint/self-test.sh` on `e18a093` (gate from round 1) | 1 | `FAIL 18` (4, `SHELLCHECK_OPTS` set and empty, both modes), `FAIL 19` (2026-11-24; 2099-01-01), `FAIL 20` (2); "8 failed" |
| Self-test at head | `bash .github/lint/self-test.sh` | 0 | `ok` 17, 18 (4), 19 (3), 20 (2); "all cases passed" |
| Minor 2 (my round 1 repro) | planted `rm $(ls)`, `SHELLCHECK_OPTS='-e SC2046' ACTIONLINT_BLOCKING_FROM=2026-11-01 … workflows` | 1 | `::error title=actionlint::SHELLCHECK_OPTS is set ('-e SC2046'). …` (round 1: exit 0, "0 findings") |
| Run-time cap | same copy, `ACTIONLINT_BLOCKING_FROM=2099-01-01 … workflows` | 1 | `::error … 2099-01-01 is after 2026-11-23, Wave 1's last blocking day` |
| Minor 1 (my round 1 repro) | step `env: { ACTIONLINT_BLOCKING_FROM: "2099-01-01" }`, self-test | 1 | `FAIL 17 … ACTIONLINT_BLOCKING_FROM appears 2 times outside comments, expected once` (round 1: `ok 17`) |
| Minor 3 | cases 20 | 0 | `::error … exited 1 (findings) but printed none`; fixed, so no longer a follow-up |
| Canary | `bash .github/lint/run-actionlint.sh canary` | 0 | "all 6 expected findings reported" |
| Every workflow | `ACTIONLINT_BLOCKING_FROM=2026-11-11 … workflows` | 0 | "actionlint: 0 findings in .github/workflows" |
| Gate scripts | `shellcheck .github/lint/*.sh` | 0 | no output |
| Security gate | `node --test .github/security/gate.test.mjs` | 0 | `# tests 62`, `# pass 62`, `# fail 0` |
| Scope | `git diff --name-only origin/rebuild/dotnet-platform...HEAD`, filtered | grep 1 | nothing outside `.github/lint/`, `workflow-lint.yml`, `docs/changes/GAP-08/` |

The round 2 diff (`git diff 70f7044..8727495 -- .github/`) touches only
`run-actionlint.sh` and `self-test.sh`: refuse `SHELLCHECK_OPTS` (set at all),
cap the blocking date at 2026-11-23, fail with a message on exit 1 with no
output, and widen case 17 (comments stripped, quoted and flow-style keys,
`ACTIONLINT_BLOCKING_FROM` exactly once, no `SHELLCHECK_OPTS`, no env- or
path-file writes in the workflow or `.github/lint/*.sh`). No existing case was
weakened. The workflow, installer, canary and `canary.expected` are unchanged.
All of it makes an existing plan rule do what it says; no plan change.

Commits (B-4): the three new subjects carry `GAP-08:`, bodies say why,
trailers present; the fix commit's subject is imperative, as asked.

### Minor 4: accepted as a follow-up, not fixed now

The tester's N1 to N8 (escaped or complex YAML keys, a `#` inside a flow
mapping, `|| true` on the lint step, removing the step, and a fake `date`
reached through `PATH` that defeats the cap) all pass case 17.

Judged against P-6 ("Never weaken a gate, guard or test to make something
pass"). The question is whether a loosening can happen silently, without a
reviewer seeing it. Every one of N1 to N8 needs an edit to
`workflow-lint.yml` itself, in the diff of a reviewed pull request. N5 and N6
are as plain as a loosening can be, and N7 is deliberate obfuscation. They sit
behind the same trust boundary as the gate. A pull request that can edit the
workflow can also edit `run-actionlint.sh` or `self-test.sh`. The tester says
so too: case 17 is defence in depth, not a boundary. The suggested golden copy
does not move that boundary either. The same pull request would update the
golden copy, as it can for `security.yml` today. That golden copy holds only
because reviewers and, later, branch protection and code owners (GAP-03, O-9)
make the edit visible. What round 1 sent back was different in kind:
`SHELLCHECK_OPTS` and a date set from outside the gate's own checks. Those
could narrow the gate while it still printed a clean result, and a reviewer
would not see them as gate edits. Both are now refused at run time.

So no silent loosening remains that P-6 forbids. Hardening case 17 further is
worth doing, but as its own change, not a second return that stops the
pipeline. Follow-up, recorded for GAP-21 (canary and self-protection for every
gate), where whether every gate gets golden copies is already the open
question:

- A byte-for-byte golden copy of `workflow-lint.yml` checked by the self-test,
  replacing case 17's text scan (covers N1 to N6 and every other spelling).
- `PATH` reset, or absolute paths for `date`, `diff`, `cut` and `grep`, at the
  top of `run-actionlint.sh` (covers N7 and N8 and the cap bypass).
- Upper-case `.YML` workflows not collected by actionlint 1.7.12 (round 1 note).

Reviewers of any pull request that touches `workflow-lint.yml` or
`.github/lint/` treat it as a gate change, read it whole, and expect a
recorded decision for any loosening.

### Open items

- **Commit the records.** `test-report.md` (rounds 1 and 2) and this file are
  still uncommitted. Round 1 asked the developer to commit `test-report.md`,
  and that was not done. The integrator commits both on `change/GAP-08` before
  the pull request is opened, so it carries its own evidence.
- **CI on the final head**: NOT RUN here, nothing is pushed. "Workflow lint /
  actionlint (every workflow)", "Security / Security gate self-test" and CI
  must be green, run ids quoted in the description.
- **Website npm audit red** in Security until Wave 0 lands (base
  dependencies; tester round 1, section 4). Wave 0 merges first.
- **Blocking date at merge.** The integrator sets `ACTIONLINT_BLOCKING_FROM`
  to the merge date plus seven days, no later than 2026-11-23 (UTC midnight,
  02:00 Cairo time). A merge after 2026-11-16 is BLOCKED ON OWNER. If the
  owner grants a schedule exception, the cap constant in `run-actionlint.sh`
  moves with it in the same change.
- **Required status check**: the owner's settings step under GAP-03 / O-9.
- **Minor 4 follow-up** for GAP-21, above.
- **The owner's confirmation** under `AGENTS.md` before anything is pushed or
  merged. This approval is not it.

### Definition of Done

Can be ticked now: requirement met; standards; no prohibited constructs; no
routes; tests and regression tests; rollback; documentation. Open: PR checks
green on the final head; independent code review on the pull request; review
by someone other than the author; deployment note (integrator, after Wave 0,
suites re-run after merge); `AGENTS.md` coverage table (GAP-13 owns the stale
status); `docs/deferred-items.md` not needed, because no exception is taken
and Minor 4 is a follow-up, not an exception.

### Draft pull request description (final head `8727495` plus the committed records; not opened)

```markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6Yc7G3x1zMCKZMuJSV3oKJ2)_

## What and why

GAP-08 (standard rule G-13, Workflow lint; refinement plan Wave 1, "0 findings
across all workflows"). Until now only `security.yml` was checked, by golden
copies. This adds a "Workflow lint" workflow whose job "actionlint (every
workflow)" runs actionlint 1.7.12 with shellcheck 0.11.0 on every file in
`.github/workflows/`, this one included. Today: 0 findings in 4 workflows.

New gate, so it reports first (standard section 3). Findings warn before
`ACTIONLINT_BLOCKING_FROM` (UTC) and fail from that date. It is set to
2026-11-11, for a merge on 4 November. If this merges later, move it in this
pull request, before merge, to the merge date plus seven days. The gate itself
refuses any date after 2026-11-23, Wave 1's last blocking day. If the merge
slips past 16 November, stop: that is a schedule exception for the owner (P-7).

The job runs, in order:
1. The checksum-verified install.
2. The gate's self-test.
3. The canary: a committed workflow with six known mistakes that must all be
   reported, including one shellcheck finding, so a silently dropped
   shellcheck fails.
4. The lint.

A gate that cannot run fails at once. That covers:
- actionlint exiting 2 or 3, or exiting 1 with nothing printed
- shellcheck missing
- a bad blocking date, or one after 2026-11-23
- an actionlint config file
- `SHELLCHECK_OPTS` set

**For GAP-09:** `.github/lint/canary/canary-workflow.yml` uses
`actions/checkout@v4` on purpose: actionlint checks an action's inputs by tag,
so the canary needs a tag. Any "every `uses:` is pinned by a 40-character SHA"
check must be scoped to `.github/workflows/` and must not read `.github/lint/`.

## Scope and boundaries

New: `.github/workflows/workflow-lint.yml`; `.github/lint/` (installer, gate,
self-test, canary, `canary.expected`); `docs/changes/GAP-08/`.
Not touched: `ci.yml` (PR #38, GAP-06, GAP-09 edit it), `security.yml` and
`.github/security/` (golden copies), `codeql.yml`, `dependabot.yml`.
Out of scope: SHA pins in the other workflows (GAP-09), golden copies and
canaries for other gates (GAP-21), making the check required (GAP-03 / O-9),
the stale status in `AGENTS.md` (GAP-13).

## Security impact

No routes, policies, data or secrets are affected. Two CI-only binaries come
from GitHub releases, each checked by sha256 before use:
- actionlint: hash from the release's `checksums.txt`
- shellcheck: hash of the release tarball; the binary is identical to the one
  in the PyPI shellcheck-py 0.11.0.1 wheel

`actions/checkout` is pinned by SHA (`11d5960a…7262`, v4.4.0), with
`persist-credentials: false` and `permissions: contents: read`. The trigger is
`pull_request`, not `pull_request_target`.

The gate adds script-injection detection (untrusted `github.event.*` values
used in `run:`) on every workflow. The canary contains an injection pattern on
purpose. It lives outside `.github/workflows/`, so it never runs.

## Tests and evidence

Full record: `docs/changes/GAP-08/implementation.md` (rounds 1 and 2),
`test-report.md` (rounds 1 and 2, both approved), `delivery-approval.md`.

- `bash .github/lint/self-test.sh`:
  - red at `c6183b3` (30 failed, gate missing)
  - new cases red at `e18a093` (8 failed)
  - green at head (all cases passed, exit 0)
- `bash .github/lint/install-actionlint.sh`: exit 0, both `: OK`. A wrong,
  empty or unset checksum for either tool: exit 1.
- `bash .github/lint/run-actionlint.sh canary`: exit 0, "all 6 expected
  findings reported".
- `run-actionlint.sh workflows`: exit 0, "0 findings". With an injection
  planted in a scratch copy: `::warning` and exit 0 before the date, `::error`
  and exit 1 on or after it. Exit 1 with `SHELLCHECK_OPTS` set, and with a
  date after 2026-11-23.
- `shellcheck .github/lint/*.sh`: exit 0.
- `node --test .github/security/gate.test.mjs`: 62 pass, 0 fail.
- CI on this head: Workflow lint run <id>, Security run <id>, CI run <id>.
- NOT RUN locally, because no file they build or test changed: .NET, website,
  Studio, Playwright, section comparison, CodeQL. `ci.yml` and `codeql.yml`
  run them on this pull request.
- Expected red, not caused by this change: Security / npm audit (website).
  These are base dependencies, cleared by Wave 0.

## Owner decisions

"Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry,
2026-11-01, project thread), and "continue working on wave 0 & 1" (same day,
project thread). No exception and no behaviour change is taken. Making the
check a required status check is the owner's settings step under GAP-03 / O-9.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded (integrator merges into `rebuild/dotnet-platform` after Wave 0, re-checks `ACTIONLINT_BLOCKING_FROM`, and re-runs the suites after the merge)

## Review findings accepted

- **Tester round 2, Minor 4.** Self-test case 17 is a text scan. Some YAML
  spellings get past it: escaped or complex keys, a `#` inside a flow mapping,
  `|| true` on the lint step, removing the step. So does a fake `date` put on
  `PATH` by an edit to `workflow-lint.yml`, which gets past the run-time cap.
  - Why accepted: each needs a visible edit to this workflow in a reviewed
    pull request, the same boundary as editing the gate script.
  - Follow-up for GAP-21: a golden copy of `workflow-lint.yml`, and a `PATH`
    reset or absolute tool paths in `run-actionlint.sh`.
- **Tester note.** actionlint 1.7.12 does not collect an upper-case `.YML`
  workflow. Recorded for GAP-21.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (GAP-13 owns the stale status)
- [ ] `docs/deferred-items.md` updated for any exception (none taken)
- [x] Documentation updated (`docs/changes/GAP-08/`, workflow header comment)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
