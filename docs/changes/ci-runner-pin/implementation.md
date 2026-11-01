# Implementation: ci-runner-pin

Developer, 1 November 2026. Branch `change/ci-runner-pin` (cut from
`origin/rebuild/dotnet-platform` at `6470fac`, not tracking it). Implements
`plan.md` round 2 under `plan-approval.md` (`Verdict: APPROVED`, gate 1).
First round. No test report or delivery approval exists, so there are no
findings to answer.

Read first: `docs/changes/README.md` and `.claude/agents/developer.md` (PR #37
branch), `AGENTS.md`, and everything in `docs/changes/ci-runner-pin/`.

## What changed

| File | Change | Plan Scope row |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `runs-on: ubuntu-latest` → `runs-on: ubuntu-24.04` on all five jobs (`api`, `website`, `studio`, `section-compare`, `screenshot-parity`; old lines 39, 120, 175, 269, 334, now 43, 124, 179, 273, 338). One 4-line comment above `jobs:` gives the reason. Nothing else. | Row 1 |
| `docs/changes/ci-runner-pin/implementation.md` | This file. | Row 2 |

Not touched, as the plan and condition 1 require: `security.yml`, `codeql.yml`,
`.github/security/security.expected.yml`, `.github/security/semgrep-job.expected.yml`,
every `uses:`, the SQL Server image, `NODE_VERSION`, `dotnet-version`, every
`continue-on-error`, the Playwright version and the lockfiles.

The comment as committed:

```yaml
# Every job runs on ubuntu-24.04, not ubuntu-latest. ubuntu-latest moved to Ubuntu 26.04,
# where Playwright 1.56.1 cannot install its browsers, so the end-to-end and comparison jobs fail.
# Moving to a newer image means upgrading Playwright and re-baselining the screenshots in the
# same change.
jobs:
```

## Commits

- `d9aa3f4` ci-runner-pin: Pin every ci.yml job to ubuntu-24.04 (the fix; only
  `.github/workflows/ci.yml` staged).
- The commit that adds this file (records only).

There is no separate red-test commit. The plan names no new test file; its
"failing check first" is the grep checks T1 to T3, recorded below before the
edit (condition 2).

## Failing check first (before the edit, at `74d722a`)

```
$ grep -c "runs-on: ubuntu-latest" .github/workflows/ci.yml     # T1
5
exit 0
$ grep -c "runs-on: ubuntu-24.04" .github/workflows/ci.yml      # T2
0
exit 1
$ grep -n "runs-on" .github/workflows/ci.yml                    # T3
39:    runs-on: ubuntu-latest
120:    runs-on: ubuntu-latest
175:    runs-on: ubuntu-latest
269:    runs-on: ubuntu-latest
334:    runs-on: ubuntu-latest
exit 0
```

## After the edit

```
$ grep -c "runs-on: ubuntu-latest" .github/workflows/ci.yml     # T1
0
exit 1
$ grep -c "runs-on: ubuntu-24.04" .github/workflows/ci.yml      # T2
5
exit 0
$ grep -n "runs-on" .github/workflows/ci.yml                    # T3 (offset +4 by the comment)
43:    runs-on: ubuntu-24.04
124:    runs-on: ubuntu-24.04
179:    runs-on: ubuntu-24.04
273:    runs-on: ubuntu-24.04
338:    runs-on: ubuntu-24.04
exit 0
$ git diff --stat origin/rebuild/dotnet-platform -- .github/    # T4
 .github/workflows/ci.yml | 14 +++++++++-----
 1 file changed, 9 insertions(+), 5 deletions(-)
exit 0
```

T5, `git diff origin/rebuild/dotnet-platform -- .github/workflows/ci.yml`: five
hunks. The first adds the four comment lines above `jobs:` and changes the `api`
`runs-on`; the other four each change one `runs-on` line and nothing else
(`9 insertions(+), 5 deletions(-)`: 4 comment lines plus 5 replaced lines).

Comment check (condition 3):

```
$ sed -n 36,40p .github/workflows/ci.yml | grep -nE "node -e|python3? -c|--input-type"
(no output)
exit 1
```

Security gate self-test (condition 3):

```
$ /opt/node22/bin/node --test .github/security/gate.test.mjs
# tests 62
# pass 62
# fail 0
exit 0
```

Local YAML parse (condition 3), Ruby available:

```
$ ruby -ryaml -e 'd=YAML.load_file(".github/workflows/ci.yml"); puts d["jobs"].map{|k,v| "#{k}=#{v["runs-on"]}"}.join(" ")'
api=ubuntu-24.04 website=ubuntu-24.04 studio=ubuntu-24.04 section-compare=ubuntu-24.04 screenshot-parity=ubuntu-24.04
exit 0
```

Line endings: `file .github/workflows/ci.yml` gives `Unicode text, UTF-8 text`
(no CRLF), unchanged from the base.

## Not run

| Check | Reason | Covered by |
| --- | --- | --- |
| C1 API job on 24.04 | GitHub Actions cannot run in this container | PR CI, "API — Release build, migrations, integration tests" |
| C2 Website job on 24.04 | Same | PR CI, "Website — typecheck, tests, design check, snapshot build" |
| C3 Studio end-to-end, 26 passed, 0 failed, 0 flaky | Same; no SQL Server here | PR CI, "Studio — typecheck, build, end-to-end", against job 118617022817 |
| C4 Section comparison | Same | PR CI, "Section comparison against feature/interviewer-portal" |
| C5 Screenshot parity | Label-triggered and optional | PR CI only if labelled `screenshots` (owner's call) |
| C6 Security workflow in CI | Same | PR CI, "Security gate self-test" (passes locally, 62 of 62) |
| actionlint | Not installed in this repository (GAP-08) | CI's own workflow parse |

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| All five `ci.yml` jobs use `runs-on: ubuntu-24.04` | Owner, 1 Nov 2026 ("pin ci.yml to ubuntu-24.04") | Done locally | T1 `0`, T2 `5`, T3 five `ubuntu-24.04` lines; Ruby parse lists all five jobs as `ubuntu-24.04`; commit `d9aa3f4`. Image line per job: CI (C1 to C4) |
| No other line of `.github/` changes, apart from the reason comment | Plan, Scope | Done | T4 only `ci.yml`, 9+/5−; T5 five hunks, comment plus `runs-on` lines only |
| Studio job installs Chromium and end-to-end reports 26 passed, 0 failed, 0 flaky on 24.04 | Owner's request; jobs 124875085547, 118617022817 | NOT RUN (CI) | Tester reads the PR's Studio job log |
| Section comparison installs Chromium and finishes on 24.04 | Owner's request; job 124875337610 | NOT RUN (CI) | Tester reads the PR's section comparison job log |
| API and Website jobs stay green on 24.04 | Plan, Done when 3 | NOT RUN (CI) | Tester reads the PR's API and Website job logs |
| Security gate self-test passes, 62 of 62 locally and green in CI | Plan, Done when 3; P-6 | Local done; CI NOT RUN | `node --test .github/security/gate.test.mjs`: 62 pass, 0 fail, exit 0 |
| Screenshot parity on 24.04 (only if labelled) | Plan, C5 | NOT RUN | Optional, label-triggered; NOT RUN accepted at gate 2 per plan-approval.md |

Status: READY FOR TEST
