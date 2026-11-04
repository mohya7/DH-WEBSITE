# Plan: ci-runner-pin — pin the CI runner image to Ubuntu 24.04

Architect, round 2, 1 November 2026 (round 1 the same day). Change branch `change/ci-runner-pin`, cut from
`origin/rebuild/dotnet-platform` at `6470fac`.

Files read: `docs/changes/README.md` and `.claude/agents/architect.md` (from the
PR #37 branch, as the change context directs; they are not on this branch yet),
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md` and
`docs/deferred-items.md` (from `origin/claude/cool-heisenberg-mh6zx9`), and
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`. ADR 0001 and the
admin audit do not apply (not G2 or G3). No plan-review, plan-approval or
implementation file exists yet, so this is not a revision.

## 1. Item

- **What it closes.** A CI breakage, not a refinement-plan item. GitHub moved
  `ubuntu-latest` to Ubuntu 26.04, and Playwright 1.56.1 refuses to install
  Chromium there, so the Studio end-to-end job and the section comparison fail
  on every pull request.
- **Owner's words.** "ok solve the issue" (Mohamed Elbadry, 1 November 2026,
  project thread). This answered the proposal: "GitHub has moved ubuntu-latest to
  Ubuntu 26.04, and Playwright 1.56.1 can't install Chromium there, so every PR's
  Studio end-to-end job will fail until it's fixed. The fix is to pin ci.yml to
  ubuntu-24.04. Shall I make that a separate small change through the new
  pipeline?"
- **Related item.** GAP-09 (rule G-15, "Tools and actions pinned exactly"), track
  **G1, Waves 1 to 3 (gates and API)**. This change pins one more input that
  floats today, the runner image. It does **not** close GAP-09. GAP-09's "Done
  when" is: "Every `uses:` names a 40-character SHA; the image reference carries
  `@sha256:`; `node-version` and `dotnet-version` are exact". This change leaves
  all of that as it is (see Scope, out of scope).
- **Done when** (taken from the owner's request, since the refinement plan has
  no entry for this):
  1. Every job in `.github/workflows/ci.yml` runs on `ubuntu-24.04`.
  2. On this pull request, "Studio — typecheck, build, end-to-end" and "Section
     comparison against feature/interviewer-portal" get past the Playwright
     install step and finish green, and their logs show `Image: ubuntu-24.04`.
  3. The API and Website jobs stay green, and the Security workflow's gate
     self-test still passes.

## 2. Current state

**The cause, from the failing job logs** (PR #37, head `675268a`, a docs-only
change, so the code is not the cause):

`gh api repos/mohya7/DH-WEBSITE/actions/jobs/124875085547/logs` (Studio):

```
2026-11-01T14:20:14.2299415Z Image: ubuntu-26.04
2026-11-01T14:20:14.2299979Z Version: 20261025.179.1
...
2026-11-01T14:21:13.6914011Z ##[group]Run npx playwright install --with-deps chromium
2026-11-01T14:21:14.2897170Z BEWARE: your OS is not officially supported by Playwright; installing dependencies for ubuntu26.04-x64 as a fallback.
2026-11-01T14:21:14.2898393Z Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.56.1!
2026-11-01T14:21:14.2990712Z Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64
2026-11-01T14:21:14.3197284Z ##[error]Process completed with exit code 1.
```

`gh api repos/mohya7/DH-WEBSITE/actions/jobs/124875337610/logs` (Section
comparison) shows the same lines: `Image: ubuntu-26.04`, `Cannot install
dependencies for ubuntu26.04-x64 with Playwright 1.56.1!`, `Error: ERROR:
Playwright does not support chromium on ubuntu26.04-x64`.

`gh api repos/mohya7/DH-WEBSITE/actions/jobs/124875085547 --jq '.labels'` gives
`["ubuntu-latest"]`. The job asked for `ubuntu-latest` and got 26.04.

The jobs in CI run 41315679927 (PR #37), with the step that failed:

```
124875085219  Website — typecheck, tests, design check, snapshot build   success
124875085542  API — Release build, migrations, integration tests         success
124875085547  Studio — typecheck, build, end-to-end                      failure  Install Playwright's Chromium
124875337610  Section comparison against feature/interviewer-portal      failure  Install the website tool and Chromium
124875338846  Screenshot parity (optional, label "screenshots")          skipped
```

The API, Website and Security gate self-test jobs also ran on `Image:
ubuntu-26.04`, and they passed.

**The last green run was on 24.04, at the base commit.** CI run 39419624362
(push, `6470fac`, 20 October, success). Its Studio job (118617022817) log shows,
under `##[group]Runner Image`, `Image: ubuntu-24.04` and `Version: 20261018.339.1`
(log lines 17 to 18; the `Version: 20261015.610` on line 4 belongs to the
`Runner Image Provisioner` group, not to the image). The same log's end-to-end
summary, line 3568, reads `26 passed (2.6m)`, and has no failed or flaky lines.
So the same code and lockfiles pass on 24.04. The only thing that changed is the
image.

**Playwright versions.** `studio/package.json:35` `"@playwright/test": "1.56.1"`.
`website/package.json:33` `"@playwright/test": "^1.56.1"` and `:40`
`"playwright": "1.56.1"`. Both lockfiles resolve `node_modules/playwright` to
`1.56.1`.

**`ci.yml`. Every `runs-on`** (`grep -n "runs-on" .github/workflows/ci.yml`):

| Line | Job id | Job name | Playwright install |
| --- | --- | --- | --- |
| 39 | `api` | API — Release build, migrations, integration tests | none |
| 120 | `website` | Website — typecheck, tests, design check, snapshot build | none |
| 175 | `studio` | Studio — typecheck, build, end-to-end | line 248 `npx playwright install --with-deps chromium` |
| 269 | `section-compare` | Section comparison against feature/interviewer-portal | line 302 `npx playwright install --with-deps chromium` |
| 334 | `screenshot-parity` | Screenshot parity (optional, label "screenshots") | line 368 `npx playwright install --with-deps chromium firefox webkit` |

All five say `runs-on: ubuntu-latest`. `grep -c "runs-on: ubuntu-latest"
.github/workflows/ci.yml` gives `5`. `grep -c "runs-on: ubuntu-24.04"
.github/workflows/ci.yml` gives `0` (exit 1). `screenshot-parity` was skipped on
PR #37 because the PR had no label. It runs the same install, so it would fail
the same way.

**`security.yml` and `codeql.yml`.** `security.yml` has `runs-on: ubuntu-latest`
at lines 66, 80, 102, 122, 137 and 160. `codeql.yml` has it at line 33. Neither
installs Playwright (`grep -n "playwright install" .github/workflows/*.yml` finds
only the three `ci.yml` lines above). Neither is broken by 26.04. In Security run
41315679989, every job passed on 26.04 except "npm audit (website) — High and
Critical", which failed at "Fail on a new High or Critical advisory". That is an
advisory finding, GAP-01 territory, and has nothing to do with the runner. CodeQL
run 41315679913 was skipped.

**Golden copies and the gate self-test.**
- `security.yml` has golden copies. `.github/security/security.expected.yml`
  must match it line for line. `gate.test.mjs` `semgrepShapeProblems` →
  `goldenDifference("security.yml", ".github/security/security.expected.yml", …)`
  fails with "update both files in the same commit". `semgrep-job.expected.yml`
  is the golden `jobs.semgrep`, compared as parsed YAML
  (`JSON.stringify(parsedJob) !== JSON.stringify(expectedJob)`), and it contains
  `runs-on: ubuntu-latest` at line 4. Changing any `runs-on` in `security.yml`
  would therefore mean changing both golden files in the same commit.
- `codeql.yml` has no golden copy, and the self-test does not read it except as
  described next.
- `ci.yml` has no golden copy. The self-test reads it in exactly one place,
  `inlineInterpreterProblems()` (`gate.test.mjs:1081-1091`). That function scans
  every `*.yml` in `.github/workflows/` for inline `node -e`,
  `--input-type=module` or `python -c`. A `runs-on` value does not touch any of
  them. `workflow-yaml.mjs` is the YAML reader the self-test uses for
  `security.yml` only (its header says "A YAML reader for the security
  workflow"), and it is never applied to `ci.yml`.
- Baseline, run here: `/opt/node22/bin/node --test .github/security/gate.test.mjs`
  → `# tests 62`, `# pass 62`, `# fail 0`.

**Dependabot.** `.github/dependabot.yml` covers `npm` (two), `nuget` and
`github-actions`. Dependabot updates `uses:` references. It does not change
`runs-on`, so a pin will not be undone automatically.

## 3. Design

Change `runs-on: ubuntu-latest` to `runs-on: ubuntu-24.04` on all five jobs in
`.github/workflows/ci.yml`. This is the image the last green run used (20
October, `Image: ubuntu-24.04`). Change nothing else.

Add a short comment above `jobs:` that says why: Playwright 1.56.1 cannot install
browsers on Ubuntu 26.04, so the image is pinned, and moving to a newer image
means upgrading Playwright and re-baselining the screenshots in the same change.
The comment must not contain `node -e`, `python -c` or `--input-type`, so that
`inlineInterpreterProblems()` stays at 0.

**Why all five `ci.yml` jobs and not only the three Playwright jobs.**
- G-15 says "Tools and actions pinned exactly", and the standard rates it
  "Partial" because inputs still float. `ubuntu-latest` is a floating input of the
  same kind as `@v4` or `2022-latest`: GitHub swaps the whole toolchain under
  every job without a commit. Pinning only the jobs that broke today would leave
  the API and Website jobs exposed to the same kind of move. For example, the API
  job's `dotnet-ef` and SQL Server service, and the Website job's design check,
  all depend on image contents. It would also leave a mixed workflow where two
  jobs of one pipeline run different operating systems.
- The `needs:` chain (`website` → `section-compare`, `screenshot-parity`) passes
  the built site (`website-out`) between jobs. Building on one OS and comparing
  screenshots on another adds a second source of difference to a comparison that
  is supposed to measure only the site.
- Moving every job to 24.04 reproduces exactly the setup that was green on 20
  October at this base commit, so the risk is as low as it can be.
- This advances GAP-09 in its spirit (inputs pinned) without claiming to close it.
  The GAP-09 row and its "Done when" do not mention runners, so this plan does not
  edit the refinement plan's register.

**Why not `security.yml` and `codeql.yml`.** They are not broken. The owner's
words name `ci.yml`. Changing `security.yml` also means changing
`security.expected.yml` and `semgrep-job.expected.yml` in the same commit. That
is a change to a security gate's golden copies and belongs in its own pull
request (B-8, one fix per pull request). Pinning them is listed as a follow-up
under GAP-09 (see Scope).

**Alternatives rejected.**
- *Upgrade Playwright to a release that supports Ubuntu 26.04.* This is the
  long-term fix, but it is a larger change of a different kind. It regenerates
  both lockfiles (B-7), changes browser builds, and would likely move pixels in
  the section and screenshot comparisons, which the locked design (screenshot
  parity) makes a reviewed event. I have not verified here which Playwright
  release supports 26.04, and the container has no network route to check one
  with confidence. Recorded as a follow-up.
- *Pin only the three Playwright jobs.* Rejected for the reasons above.
- *Install the missing browser dependencies by hand on 26.04, or override
  Playwright's host platform (for example `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE`).*
  This makes the suite run on an operating system its tooling does not support.
  A green result would then prove less than it claims, which is against the
  intent of P-6.
- *Use `continue-on-error` on the install step.* This weakens a gate (P-6).
  Rejected outright.
- *A self-test assertion that `ci.yml` never uses `ubuntu-latest`.* This would
  be a new guard in `gate.test.mjs`, a security-gate file, and would be a second
  topic. The general "no floating inputs" check belongs to GAP-08 (actionlint)
  and GAP-09. Not done here.

## 4. Scope

**Change:**

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | Lines 39, 120, 175, 269 and 334: `runs-on: ubuntu-latest` → `runs-on: ubuntu-24.04`. One comment block (3 to 5 lines) above `jobs:` gives the reason as in Design. No other line changes. |
| `docs/changes/ci-runner-pin/*` | The pipeline records (plan, reviews, implementation, test report, approvals). |

**Out of scope, left alone on purpose:**
- `.github/workflows/security.yml`, `.github/security/security.expected.yml`,
  `.github/security/semgrep-job.expected.yml`. Their `runs-on: ubuntu-latest`
  stays. Follow-up: pin them, with both golden copies updated in the same commit,
  under GAP-09.
- `.github/workflows/codeql.yml` `runs-on: ubuntu-latest` (line 33). Follow-up
  with the one above.
- Every `uses: …@v4`, `mcr.microsoft.com/mssql/server:2022-latest`,
  `NODE_VERSION: "22"`, `dotnet-version: "10.0.x"`. These belong to GAP-09 and
  GAP-10.
- Playwright version and lockfiles. Follow-up: upgrade to a release that
  supports Ubuntu 26.04, re-baseline the screenshots, then move the runners.
- The website npm-audit failure in Security run 41315679989. That is GAP-01.
- `continue-on-error` on the section comparison (line 305) and the screenshot
  comparison (line 377). That is GAP-05.
- `docs/deferred-items.md`. No exception is taken, so no D-NNN entry.

## 5. Test plan

GitHub Actions cannot run in this container, so the proof that it works comes
from this pull request's own CI run. The steps below that need CI are marked as
CI.

**Failing check first** (run before the edit, shown failing, then run after):

| # | Command | Before (expected, and observed here) | After |
| --- | --- | --- | --- |
| T1 | `grep -c "runs-on: ubuntu-latest" .github/workflows/ci.yml` | `5` | `0` (exit 1) |
| T2 | `grep -c "runs-on: ubuntu-24.04" .github/workflows/ci.yml` | `0` (exit 1) | `5` |
| T3 | `grep -n "runs-on" .github/workflows/ci.yml` | 5 lines, all `ubuntu-latest` | 5 lines (39, 120, 175, 269, 334 or ±comment offset), all `ubuntu-24.04` |
| T4 | `git diff --stat origin/rebuild/dotnet-platform -- .github/` | — | only `.github/workflows/ci.yml` |
| T5 | `git diff origin/rebuild/dotnet-platform -- .github/workflows/ci.yml` | — | only the five `runs-on` lines and the comment block |

**Local checks after the edit:**
- `/opt/node22/bin/node --test .github/security/gate.test.mjs` →
  `# pass 62`, `# fail 0` (baseline above: 62 of 62).
- The YAML must still parse: `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'`,
  or, if Ruby is missing, `python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/ci.yml"))'`.
  These are local shell commands, not workflow content. If neither is available,
  write NOT RUN, and the CI run itself is the parse check.
- `actionlint` is not installed in this repository (GAP-08). NOT RUN. Covered by
  CI's workflow parse.

**On the pull request's CI run (CI).** The tester reads each job's log with
`gh api repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`, and quotes `Image:` and
the job conclusion:
- C1 "API — Release build, migrations, integration tests": success, `Image: ubuntu-24.04`.
- C2 "Website — typecheck, tests, design check, snapshot build": success, `Image: ubuntu-24.04`.
- C3 "Studio — typecheck, build, end-to-end": the step "Install Playwright's
  Chromium" succeeds, then "End-to-end suite" reports the same count as the
  reference job 118617022817 (base commit `6470fac`, 20 October): `26 passed`,
  with 0 failed and 0 flaky. The tester quotes both summary lines side by side.
  `Image: ubuntu-24.04`. (The "22 of 22" in `CLAUDE.md` is an older status line
  and is not the criterion.)
- C4 "Section comparison against feature/interviewer-portal": the step "Install
  the website tool and Chromium" succeeds, then the job succeeds. `Image: ubuntu-24.04`.
  Its compare step is still `continue-on-error`, so the tester also quotes the
  compare result from the job summary and checks it matches the last green run on
  `6470fac`.
- C5 "Screenshot parity": skipped unless the PR is labelled `screenshots`.
  Labelling it is optional and is the owner's or tech lead's call. If it is not
  run, write NOT RUN (job not triggered without the label). The pin applies to it
  in the same way.
- C6 Security workflow: "Security gate self-test" succeeds. The website npm-audit
  failure, if it is still present, is reported as not caused by this change
  (GAP-01), with the advisory quoted.

**Track checklist, G1, Waves 1 to 3:**
- One gate per pull request (B-8): yes. This adds no gate, and only pins one input.
- A new gate reports for seven days, then blocks: not applicable, no new gate.
- Every gate has a canary fixture (GAP-21): not applicable, no new gate.
- Actions by 40-character SHA, the SQL Server image by digest, Node and .NET
  exact: not changed by this pull request, still open under GAP-09/GAP-10.
  Stated so the reviewer does not read this change as closing them.
- Baselines only shrink: no baseline is touched.

## 6. Security impact

None to the application. No route, policy, data, login, secret or package
changes. The CI attack surface does not change: same permissions
(`contents: read`), same actions, same credentials (all workflow-only). Moving to
24.04 means a known OS release, the same one as the last green run (that run
used image build `20261018.339.1`). The label pins the OS release, not an image
build: GitHub still rolls the 24.04 image, so an exact build is not pinned (Risk
row 4 covers this). No security gate file and no golden copy is touched, so the Security gate
self-test is unaffected.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. That puts the jobs back on `ubuntu-latest` (26.04), and
the Playwright jobs fail again.

## 9. Owner decisions needed

None. The owner approved the proposal to "pin ci.yml to ubuntu-24.04" with "ok
solve the issue" (1 November 2026, project thread). Pinning all five `ci.yml`
jobs falls within "pin ci.yml". Leaving `security.yml` and `codeql.yml` alone
keeps to it.

## 10. Risks

| Risk | How it is caught |
| --- | --- |
| A `runs-on` line is missed, or a different label is mistyped | T1, T2, T3, and C1 to C4 quoting `Image: ubuntu-24.04` per job |
| The comment trips the inline-interpreter check | The local `gate.test.mjs` run (62 of 62) and C6 |
| The YAML is broken by indentation | The local YAML parse, and CI refusing the workflow (no jobs start) |
| The 24.04 image has changed since 20 October and something else breaks | C1 to C4 on the PR run. A failure is reported before any fix, per `AGENTS.md` |
| `ubuntu-24.04` is later retired by GitHub, and the pin breaks again | Not caught by this change. The follow-up (upgrade Playwright, then move the image) is listed in Scope. GitHub's retirement date for 24.04 is not verified here |
| Someone reads this as closing GAP-09 | Item and track checklist say plainly that it does not |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| All five `ci.yml` jobs use `runs-on: ubuntu-24.04` | Owner, 1 Nov 2026 ("pin ci.yml to ubuntu-24.04") | Planned | |
| No other line of `.github/` changes, apart from the reason comment | This plan, Scope | Planned | |
| Studio job installs Chromium and end-to-end reports 26 passed, 0 failed, 0 flaky on 24.04, the same as reference job 118617022817 | Owner's request; job 124875085547 failure; job 118617022817 line 3568 | Planned | |
| Section comparison installs Chromium and finishes on 24.04 | Owner's request; job 124875337610 failure | Planned | |
| API and Website jobs stay green on 24.04 | This plan, Done when 3 | Planned | |
| Security gate self-test passes, 62 of 62 locally and green in CI | This plan, Done when 3; P-6 | Planned | |
| Screenshot parity on 24.04 (only if labelled) | This plan, C5 | Planned | |

## 12. Revision log

- Round 1 (1 November 2026): first version. No review points yet.
- Round 2 (1 November 2026), answering `plan-review.md` Round 1:
  - Finding 1 (Major, end-to-end count). Verified: job 118617022817 log line 3568
    reads `26 passed (2.6m)`, and `grep -cE "✘|flaky"` on that log gives 0.
    "22 of 22" came from the `CLAUDE.md` status line and was wrong for `6470fac`.
    C3 and coverage row 3 now state 26 passed, 0 failed, 0 flaky, with job
    118617022817 as the reference, and the tester quotes both summary lines.
    Section 2 quotes the base run's count.
  - Finding 2 (Minor, image version). Verified: in job 118617022817,
    `Version: 20261015.610` (line 4) is under `Runner Image Provisioner`; the image
    version is `Version: 20261018.339.1` (line 18, under `Runner Image`). Section 2
    now quotes `20261018.339.1` and names the provisioner line for what it is.
    Section 6 now says "a known OS release, the same one as the last green run",
    and states that the label does not pin an exact image build.
