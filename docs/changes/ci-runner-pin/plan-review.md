# Plan review: ci-runner-pin

## Round 1

Plan reviewer, 1 November 2026. Reviewed `docs/changes/ci-runner-pin/plan.md`
(architect, round 1) on `change/ci-runner-pin` at `6470fac`. Read first:
`docs/changes/README.md` and `.claude/agents/plan-reviewer.md` (PR #37 branch),
`AGENTS.md`, `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md`
(`origin/claude/cool-heisenberg-mh6zx9`), and
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`. ADR 0001 and the
admin audit do not apply (not G2 or G3). No earlier review round exists.

### Findings

**1. Major — Section 5 (C3) and Section 11 (coverage row 3): the end-to-end count
is wrong.**
The plan's acceptance check C3 says the Studio "End-to-end suite" passes
"22 of 22", and the coverage table repeats "passes 22 of 22 end-to-end on 24.04".
The last green run on this same base commit passed 26, not 22.

Evidence: `gh api repos/mohya7/DH-WEBSITE/actions/jobs/118617022817/logs` (CI run
39419624362, push, `6470fac`, 20 October, `Image: ubuntu-24.04`), log line 3568:

```
2026-10-20T12:09:11.6488395Z   26 passed (2.6m)
```

The line before it is `✓  26 e2e/verification.spec.ts:410:1 › P2.12 …`. The
"22 of 22" figure comes from the older `CLAUDE.md` status line, not from the
suite as it stands at `6470fac`. As written, a correct run would not match the
acceptance criterion, and the tester would have to either report a mismatch or
read the criterion loosely. Neither is acceptable for a check that has to prove
the change (P-8).

What would satisfy me: C3 and coverage row 3 state the count from the base run
(26 passed, 0 failed, job 118617022817 cited as the reference), or state "the
same count as job 118617022817, which is 26, with 0 failed and 0 flaky", so the
tester compares two quoted numbers.

**2. Minor — Section 2 (last green run) and Section 6 (Security impact): the
quoted "Version" is the provisioner, not the image.**
The plan says the green Studio job "log shows `Image: ubuntu-24.04`, `Version:
20261015.610`", and Section 6 calls `20261015.610` "the last green one". In that
log, `Version: 20261015.610` (line 4) is under `##[group]Runner Image
Provisioner` / `Hosted Compute Agent`. The image version is the one under
`##[group]Runner Image`, line 18: `Version: 20261018.339.1`. The same mix-up does
not occur in the 26.04 quote, which correctly pairs `Image: ubuntu-26.04` with
`Version: 20261025.179.1`.

Related: Section 6 says moving to 24.04 "means a known image, not an unknown
one". The `ubuntu-24.04` label pins the OS release, not an image build; GitHub
still rolls the 24.04 image weekly. Risk row 4 already covers "the 24.04 image
has changed since 20 October", so the risk is handled, but the sentence in
Section 6 overstates what the pin fixes.

What would satisfy me: quote `20261018.339.1` as the image version, and reword
Section 6 to "a known OS release, the same one as the last green run", without
implying an exact image build is pinned.

### Checked and found sound

- **Cause of the failure.** Job 124875085547 (Studio) and job 124875337610
  (Section comparison) logs both show `Image: ubuntu-26.04`, `Version:
  20261025.179.1`, `Cannot install dependencies for ubuntu26.04-x64 with
  Playwright 1.56.1!` and `Error: ERROR: Playwright does not support chromium on
  ubuntu26.04-x64`. `gh api …/jobs/124875085547 --jq '.labels'` gives
  `["ubuntu-latest"]`. The failed step names (`Install Playwright's Chromium`,
  `Install the website tool and Chromium`) and the five job conclusions of run
  41315679927 match the plan's table.
- **Other jobs on 26.04.** API (124875085542) and Website (124875085219) logs both
  show `Image: ubuntu-26.04` and the jobs succeeded.
- **Base run was green on 24.04.** Run 39419624362 is a push of
  `6470fac3668aeeacabe4a47c39807d239ac33a09`, conclusion `success`; Studio,
  Website, API and Section comparison all `success`, Screenshot parity `skipped`.
  Section comparison 118617318962 log shows `Image: ubuntu-24.04`.
- **Playwright versions.** `studio/package.json:35` `"@playwright/test": "1.56.1"`;
  `website/package.json:33` `"^1.56.1"` and `:40` `"playwright": "1.56.1"`; both
  lockfiles resolve `node_modules/playwright` to `1.56.1`.
- **Every `runs-on` in `ci.yml`.** Lines 39, 120, 175, 269, 334, all
  `ubuntu-latest`; Playwright installs at lines 248, 302, 368; `needs: website` at
  270 and 335; `jobs:` at line 36. All as the plan says.
- **`security.yml`, `codeql.yml` and the golden copies.** `security.yml` lines 66,
  80, 102, 122, 137, 160 and `codeql.yml` line 33 are `ubuntu-latest`;
  `security.expected.yml` mirrors the same six lines and
  `semgrep-job.expected.yml:4` has `runs-on: ubuntu-latest`.
  `gate.test.mjs:1016` compares `security.yml` against `security.expected.yml`,
  and `:1014` reads `semgrep-job.expected.yml`. Leaving these out is the right
  call for one-topic scope (B-8), and the follow-up is recorded.
- **Gate self-test reach into `ci.yml`.** `inlineInterpreterProblems()`
  (`gate.test.mjs:1081-1091`) scans every `*.yml` in `.github/workflows/` only for
  inline `node -e`, `--input-type=module` and `python3 -c`. The plan's constraint on
  the comment wording is correct and sufficient. `workflow-yaml.mjs`'s header
  confirms it is the reader for the security workflow.
- **Baseline.** `/opt/node22/bin/node --test .github/security/gate.test.mjs`, exit
  0: `# tests 62`, `# pass 62`, `# fail 0`.
- **Security run on PR #37.** Run 41315679989: every job `success` except
  "npm audit (website) — High and Critical" (`failure`), unrelated to the runner;
  CodeQL run 41315679913 `skipped`.
- **GAP-09 quote.** The plan's "Done when" for GAP-09 matches refinement plan
  line 159 word for word, and the plan correctly says this change does not close
  it. GAP-09's register row (line 73) does not mention runners. Item is classed
  under G1, Waves 1 to 3, and the track checklist is answered item by item.
- **Owner decision.** The owner's words and the proposal are quoted with date and
  place, and "pin ci.yml to ubuntu-24.04" covers all five `ci.yml` jobs. No
  exception is taken, so no D-NNN is needed. Nothing is assumed.
- **Alternatives.** Upgrading Playwright, pinning only three jobs, overriding the
  host platform, `continue-on-error`, and a new self-test guard are real options,
  and they are rejected for sound reasons (B-7, screenshot parity, P-6, B-8).
- **Gates not weakened (P-6).** No gate, guard, baseline, golden copy or test is
  touched; the existing `continue-on-error` lines 305 and 377 are left to GAP-05.
- **Testability.** T1 to T5 are exact and would fail today (T1 gives `5` now, T2
  gives `0`). The local YAML parse commands are available here (`ruby` and
  `python3` with `yaml` both present). The things only CI can prove (C1 to C6) are
  named by job, with the log command.
- **Dependabot.** `.github/dependabot.yml` has npm (two), nuget and
  github-actions ecosystems only; nothing rewrites `runs-on`.
- **Security, migrations, rollback.** No route, policy, secret, package or
  migration changes. Rollback by revert is real and its effect is stated.

Round 1 outcome: changes needed (one Major, one Minor).

## Round 2

Plan reviewer, 1 November 2026. Reviewed `plan.md` architect round 2 against the
Round 1 findings. No new findings.

### Round 1 findings, as answered

**1. Major (end-to-end count): resolved.** C3 (Section 5) now requires "the same
count as the reference job 118617022817 … `26 passed`, with 0 failed and 0
flaky", with both summary lines quoted side by side, and says the "22 of 22" in
`CLAUDE.md` is not the criterion. Coverage row 3 reads "end-to-end reports 26
passed, 0 failed, 0 flaky on 24.04, the same as reference job 118617022817" and
cites line 3568. Section 2 quotes the base count. Checked again myself: line 3568
of that job's log reads `26 passed (2.6m)`, and `grep -cE "✘|flaky"` on the same
log gives `0`. The acceptance criterion now matches what a correct run produces.

**2. Minor (image version): resolved.** Section 2 now quotes `Image:
ubuntu-24.04` and `Version: 20261018.339.1` from the `##[group]Runner Image`
group (log lines 17 to 18), and names line 4's `20261015.610` as the `Runner
Image Provisioner` version. Section 6 now says "a known OS release, the same one
as the last green run", and that the label "pins the OS release, not an image
build", pointing to risk row 4. Both match the log.

### Checked that nothing else moved

- Scope (Section 4) is the same: only `.github/workflows/ci.yml` lines 39, 120,
  175, 269 and 334, plus the comment block above `jobs:`. `security.yml`,
  `codeql.yml` and the golden copies are still out of scope.
- Design, alternatives, owner decision, rollback and the other checks C1, C2,
  C4 to C6 and T1 to T5 are unchanged from Round 1, where I found them sound.
- The only revisions are the ones in the round 2 revision log (Section 12), and
  they match what the plan now says.

Verdict: APPROVED
