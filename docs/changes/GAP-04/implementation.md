# GAP-04 implementation

Developer, round 1, 1 November 2026. Branch `change/GAP-04` (cut from
`origin/rebuild/dotnet-platform` at `6470fac`, no tracking), worktree
`/home/user/wt-GAP-04`. Plan: `plan.md` round 1; review: `plan-review.md` round 1,
`Verdict: APPROVED`; gate 1: `plan-approval.md`, `Verdict: APPROVED` with ten
conditions (answered in section 5). Nothing pushed; no pull request opened.

Governing documents read from the read-only copies under
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`
(`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md`, `docs/changes/README.md`,
`.claude/agents/developer.md`, `.github/pull_request_template.md`), because they are
not on the base branch.

Owner's words in force (Mohamed Elbadry, 2026-11-01, project thread): "Start waves 0
& 1 and update me with each gap done", then "continue working on wave 0 & 1".

## 1. Commits

| SHA | Subject | Content |
| --- | --- | --- |
| `87974b0` | GAP-04: Add failing tests for the browser-suite report check | `website/test/browser-suite-report.test.ts` only (red, section 3.1) |
| `68d1e64` | GAP-04: Run the website browser suite in CI, default and consent builds | the checker, expectation, canary, CI job, README paragraph, and one test-line fix (3.3) |
| this commit | GAP-04: Record the implementation | this file |

## 2. What changed, by plan Scope (plan section 4)

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | Job `website-browser` ("Website — browser tests, default and consent builds") appended after `screenshot-parity`; 81 lines added, 0 removed (`git diff 4eca26c..HEAD -- .github/workflows/ci.yml` has no `-` lines). Steps as plan 3.1: checkout, setup-node, `npm ci`, canary, Chromium, default build, tests, consent build (`rm -rf out` then build), tests, check, upload. Job env `BROWSER_TESTS_BLOCKING_FROM: "2026-11-12"`, `CONTENT_SOURCE: snapshot`, `PUBLIC_SITE_URL`, `PLAYWRIGHT_HTML_OPEN: never`; `defaults.run.working-directory: website`; `runs-on: ubuntu-24.04`; no `needs`, job `if` or `continue-on-error`; `if: always()` only on the upload. |
| `website/tools/browser-suite/check-report.mjs` | New checker (Node built-ins only), rules as plan 3.1. Collects every problem and every failure, prints them all, then decides the exit (condition 5). Appends a table to `$GITHUB_STEP_SUMMARY` when set. |
| `website/tools/browser-suite/expected.json` | New, exactly the plan's content (`minimumTests` 29). |
| `website/tools/browser-suite/run-canary.mjs` | New; resolves the checker, `expected.json` and `canary/` from `import.meta.url` (condition 6); runs the checker as a child process; removes `GITHUB_STEP_SUMMARY` from the child's env so the canary does not write into the job summary. |
| `website/tools/browser-suite/canary/default.json`, `consent-failed.json`, `consent-lost.json` | New canary reports (3.2). |
| `website/test/browser-suite-report.test.ts` | New, T1-T20 plus the condition-5 test (27 cases). |
| `website/README.md` | One paragraph under "Cookie consent and Tag Manager" naming the job, both builds, the checker, `expected.json`, `BROWSER_TESTS_BLOCKING_FROM` and the canary. |

Not touched (condition 10, checked): `git diff 6470fac..HEAD --stat -- website/browser-tests
website/playwright.config.ts website/tools/serve-built.mjs website/package.json
website/package-lock.json .github/security` prints nothing. No other job in `ci.yml` changed.

One deviation in form, not behaviour: the plan's step 10 writes the check command with
`${{ github.workspace }}` in a folded `run: >-`. It is one plain-scalar line with a
step env `REPORTS: ${{ github.workspace }}/reports/website-browser`:

```yaml
      - name: Check both runs
        env:
          REPORTS: ${{ github.workspace }}/reports/website-browser
        run: node tools/browser-suite/check-report.mjs tools/browser-suite/expected.json "default=${REPORTS}/default.json" "consent=${REPORTS}/consent.json"
```

Same command and paths. Reason: `workflow-yaml.mjs` drops the first line of a block
scalar inside a list item (3.4), so the folded form would hide
`node tools/browser-suite/check-report.mjs` from T20's parse.

## 3. Commands, exit codes and output

Environment: Node v22.23.4, npm 10.9.9, `npm ci` in `website/` (exit 0),
`PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/pw-browsers`,
ports 4204, 4205, 4206. `git rev-parse --is-shallow-repository` = `false` before and
after; no `git fetch` was run. Raw logs in
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap04-dev/`.

### 3.1 Red first (condition 9)

```
$ npx vitest run test/browser-suite-report.test.ts        # before any script existed
 Test Files  1 failed (1)
      Tests  27 failed (27)
exit 1
  + Error: Cannot find module '/home/user/wt-GAP-04/website/tools/browser-suite/check-report.mjs'
  T17/T19: ENOENT … tools/browser-suite
  T20: job website-browser in ci.yml: expected -1 to be greater than 35
$ npm run typecheck                                          # exit 0
```

Reported before fixing: the first red run was `26 failed | 1 passed`. T4 passed
because a missing script also exits 1. T4 was tightened before the red commit to
also require `failed: consent: …` and the `::error title=Browser tests (blocking since <today>)`
line; the run above (27 of 27 red) is the committed state `87974b0`.

### 3.2 Green, on head `68d1e64`

```
$ npx vitest run test/browser-suite-report.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)                                   exit 0

$ npm run typecheck                                           exit 0

$ npx vitest run
 Test Files  21 passed | 1 skipped (22)
      Tests  406 passed | 31 skipped (437)                    exit 0
$ npx vitest run --exclude test/browser-suite-report.test.ts  # base suite, for the count
      Tests  379 passed | 31 skipped (410)
```

The plan's "409" is 410 on this base (379 passed, 31 skipped); 410 + 27 = 437.

```
$ npm run design:check                                        exit 0
Loading order: all 10 design sets match the 29 old pages they come from.
All 25 files match: 24 identical, 1 ported with the recorded change.

$ node tools/browser-suite/run-canary.mjs                     exit 0
canary 1 rejected: a failed consent-build test after the blocking date
canary 2 rejected: a consent build that lost its banner, in report mode

$ node --test .github/security/gate.test.mjs                  # from the repo root, exit 0
# tests 62
# pass 62
# fail 0
```

### 3.3 One test line changed after the red commit

T20 first failed on green with
`expected 'actions/checkout@11d5960a326750d58380…' to match /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/`:
`workflow-yaml.mjs` keeps the trailing `# v4.4.0` comment in the `uses:` value. The
test now strips a trailing `\s+#.*$` (a YAML comment) before the same 40-hex match.
This does not loosen it: the ref must still be a 40-hex SHA. It is in `68d1e64` and
named in that commit's message.

### 3.4 T20 by parsing (condition 7)

`parseWorkflowYaml` cannot read the whole `ci.yml`. On the base it throws in the
`studio` job (`expected a key in a list item: fi`). The other jobs and the header
parse. So T20 cuts the file by text into the header (lines before `jobs:`) and the
`website-browser` block (from `  website-browser:` to end of file), and parses each.
The only text-based assertions are where the cut is: the job's key line exists after
`jobs:`, and no line after it starts at indent 0 or 2, so the job is last. The parsed
block must hold exactly one job, `website-browser`. Everything else is asserted on
parsed values: `name`, `runs-on`, no `needs`/`if`/`continue-on-error`,
`working-directory`, the date and its 2026-11-10…2026-11-23 bound, `CONTENT_SOURCE`,
the SHA on each `uses:`, `if:` only on the upload, a step env
`SNAPSHOT_SETTINGS_FIXTURE: consent`, the canary `run` before the check `run`, the
check's both labels, no inline interpreter, and no `paths`/`paths-ignore` under
`on.pull_request`.

**Parser defect found (not fixed here; out of scope, `.github/security/` untouched):**
`workflow-yaml.mjs` drops the first line of every block scalar inside a list item:

```
$ node probe3.mjs     # parseWorkflowYaml("steps:\n  - name: A\n    run: |\n      first\n      second\n  - run: |\n      one\n      two\n")
{"steps":[{"name":"A","run":"second"},{"run":"two"}]}
```

`parseSequence` advances `index` past the key line, then `blockScalar` advances it
once more. The security self-test uses this reader on `security.yml`, so a check
there that reads a `run: |` step's first line sees the second line. This should be its
own item (B-8). It is raised in the reply for the owner and the tech lead.

### 3.5 actionlint (GAP-08's pinned tools, checksum verified)

Installed with GAP-08's `/home/user/wt-GAP-08/.github/lint/install-actionlint.sh` into a
scratch dir, with the versions and sha256 from GAP-08's `workflow-lint.yml` (lines
42-48):

```
$ RUNNER_TEMP=…/gap04-dev/actionlint ACTIONLINT_VERSION=1.7.12 ACTIONLINT_SHA256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 \
  SHELLCHECK_VERSION=0.11.0 SHELLCHECK_SHA256=8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198 \
  sh /home/user/wt-GAP-08/.github/lint/install-actionlint.sh
…/gap04-dev/actionlint/actionlint_1.7.12_linux_amd64.tar.gz: OK
…/gap04-dev/actionlint/shellcheck-v0.11.0.linux.x86_64.tar.xz: OK
1.7.12
version: 0.11.0
install exit 0

$ env -u SHELLCHECK_OPTS …/actionlint -shellcheck=…/shellcheck .github/workflows/ci.yml     # head
(no output)  exit 0
$ (same on the base ci.yml from 4eca26c, copied to a scratch repo layout)
(no output)  exit 0
```

The same binaries reject GAP-08's canary (`.github/lint/canary/canary-workflow.yml`).
They print its six findings, including `24:9 shellcheck`, and exit 1. So shellcheck
was active.

### 3.6 Real reports through the checker (plan 5.2)

In the worktree, as plan 5.2 (`out/` removed afterwards; `git status` clean):

```
$ CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build              exit 0
Consent: no container id, so no consent file is in out/behaviors/.
$ WEBSITE_TEST_PORT=4204 PLAYWRIGHT_JSON_OUTPUT_NAME=…/reports/default.json npx playwright test --reporter=list,json
  1 failed  pages.spec.ts:7:1 › the skipped home intro …   25 skipped   3 passed (10.3s)     exit 1
$ rm -rf out && CONTENT_SOURCE=snapshot SNAPSHOT_SETTINGS_FIXTURE=consent PUBLIC_SITE_URL=… npm run build   exit 0
Consent: the banner script and stylesheet are in out/behaviors/.
$ WEBSITE_TEST_PORT=4205 PLAYWRIGHT_JSON_OUTPUT_NAME=…/reports/consent.json npx playwright test --reporter=list,json
  8 failed (7 × consent.spec.ts:140:3 cookie variants, pages.spec.ts:7:1)   1 skipped   20 passed (1.3m)   exit 1
  "gsap is not defined": 1 line in the default output, 8 in the consent output

$ BROWSER_TESTS_BLOCKING_FROM=2999-12-31 node tools/browser-suite/check-report.mjs tools/browser-suite/expected.json default=… consent=…
failed: default: pages.spec.ts › the skipped home intro moves the logo and its classes persist after load (…)
failed: consent: consent.spec.ts › a cookie with a value that does not decode is no choice: … (×7 variants)
failed: consent: pages.spec.ts › the skipped home intro moves the logo and its classes persist after load (…)
browser suite: 29 tests; default 3 passed, 25 skipped as expected, 1 failed; consent 20 passed, 1 skipped as expected, 8 failed; 9 failures
::warning title=Browser tests (report mode until 2999-12-31)::9 failure(s)
exit 0

$ BROWSER_TESTS_BLOCKING_FROM=2000-01-01 node tools/browser-suite/check-report.mjs …same…
…same nine failed: lines…
::error title=Browser tests (blocking since 2000-01-01)::9 failure(s)
exit 1
```

These are the same 9 CDN failures as plan 2.4 (`cdn.jsdelivr.net` answers 403 here).
The checker saw 29 distinct tests, with no structural problem.

The CI step's own shell form was also run once. That was step 7's script under
`bash -e` against a fresh default build, port 4206, with `--reporter=list,json,html`
and the `--output`/`PLAYWRIGHT_*` paths under a scratch "workspace". It printed
`Playwright exit 1`, the step exited 0, and it wrote `default.json`, `default-html/`
and `default-results/`.

### 3.7 Mutation check (plan 5.2)

`check-report.mjs` changed in place so that status `unexpected` counts as passed
(`const passed = status === "unexpected" || status === "expected" && …`):

```
$ node tools/browser-suite/run-canary.mjs                     exit 1
::error title=Browser-suite canary::canary 1 (a failed consent-build test after the blocking date) was not rejected: exit 0, expected 1 with "failed: consent: pages.spec.ts › the skipped home intro moves the logo and its classes persist after load"
browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures
canary 2 rejected: a consent build that lost its banner, in report mode
```

Restored from a byte copy (`cmp` equal), then `run-canary.mjs` exit 0 with both
canaries rejected. T19 covers the same thing on every Vitest run, with a checker
that always exits 0.

### 3.8 NOT RUN

- **A clean 29 of 29 browser run.** Reason: `cdn.jsdelivr.net` answers 403 through
  this container's proxy, so GSAP never loads (9 failures, 3.6). Covered by: the
  new CI job "Website — browser tests, default and consent builds" on this pull
  request. Its check step must print
  `browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures`.
- **Any CI run.** Nothing is pushed until the owner says so (condition 1). Run id and
  job id: open.
- **`.github/lint/run-actionlint.sh workflows`.** GAP-08 has not merged. The same
  pinned actionlint and shellcheck were run directly (3.5).
- **Studio and API suites.** Not touched by this change; covered by the `studio` and
  `api` CI jobs.

## 4. The canary reports, as built

Made by a scratch script
(`…/scratchpad/gap04-dev/reduce.mjs`, not committed) from the architect's real
Playwright 1.56.1 reports `…/scratchpad/gap04/pw-default.json` and `pw-consent.json`.
`config` was dropped. Per test, only `expectedStatus`, `projectName`, `status`,
annotation `type`/`description`, and per result `status`, `retry`, `duration` and
error `message` were kept, with ANSI colour removed. Absolute paths and stacks were
dropped (`grep -c "/tmp\|/home"` = 0 in each file). `stats` counts were recomputed
after the edits below. The edits:

- `default.json`: the real default run, with test 26 (`pages.spec.ts:7`) set to
  passed. Its only real local failure was the blocked CDN. The result is 4 passed,
  25 skipped.
- `consent-failed.json`: the real consent run. Test 26 keeps its real failure
  (`expect(received).toEqual(expected)` with `"gsap is not defined"`). The 7
  cookie-variant tests (real local failure: the blocked CDN, last assertion only)
  are set to passed, so test 26 is the one failure. The result is 27 expected,
  1 skipped, 1 unexpected.
- `consent-lost.json`: the same content as `default.json`, under the `consent`
  label: all 25 `consent.spec.ts` skipped and `pages.spec.ts:61` passed.

For the tester: plan 2.4 says test 26 passed in both builds with a mirrored CDN. The
mirrored-run JSON files saved in `…/scratchpad/gap04/` (`pw-default-mirror.json`,
`pw-consent-mirror.json`) show test 26 `unexpected` (failed). They may be from a later
attempt than the one the plan describes. So no canary result comes from them, and
test 26 has not been seen passing in any saved report. Only the CI run can settle it.

## 5. Gate-1 conditions

1. **Merge order and push.** Nothing pushed, no pull request opened. The pull request
   (when the owner says so) names the check "Website — browser tests, default and
   consent builds" for the owner to make required under GAP-03. GAP-04 does not
   merge before the owner confirms Wave 0's exit gate.
2. **Report date.** `BROWSER_TESTS_BLOCKING_FROM: "2026-11-12"`.
   **Assumption:** the merge date is unknown today (1 November 2026). The date
   assumes a merge no earlier than 2026-11-05. Wave 1 merges 3 to 16 November, and
   Wave 0's exit gate must be confirmed first. 2026-11-05 + 7 = 2026-11-12, which is
   ≤ 2026-11-23. **If the merge lands after 2026-11-05, the date must move to merge
   + 7 in this pull request before merge.** If the merge lands after 16 November,
   merge + 7 > 23 November: stop and go to the owner (plan 3.3). Tech lead gate 2
   checks it. T20 bounds the date to 2026-11-10…2026-11-23.
3. **GAP-01 interaction.** Not rebased onto `change/GAP-01` (`git log` shows
   `6470fac` as the only base). If GAP-01 merges first, this pull request's CI run is
   the 29-of-29 proof on `next` 16.4.3. If GAP-04 merges first, GAP-01's pull
   request must show this job's check line with `0 failures`. A failure there is
   GAP-01's defect even while this gate is in report mode (a warning, not a red
   check), so the tech lead reads the line, not the colour.
4. **Evidence is the line, not the colour.** During the report week a green job
   proves nothing. The Done-when evidence is the check step's
   `browser suite: 29 tests; … 0 failures` line with run id and job id, still open
   (3.8). If the first CI run shows a real defect, the change stays not done and
   does not merge with failures. The defect becomes its own item (B-8), raised to the
   owner if it blocks Wave 1. No test is skipped, loosened or retried.
5. **One pass.** `check-report.mjs` prints every failure and problem before deciding.
   Test "reports every problem in one pass: the canary-1 inputs against
   minimumTests 30 still name the failure" asserts exit 1, `fewer than 30`, and
   `failed: consent: pages.spec.ts › the skipped home intro …`. It passes.
6. **Canary paths.** `run-canary.mjs` uses
   `path.dirname(fileURLToPath(import.meta.url))`. T18 runs it with `cwd` at the
   repository root. T19 runs a copy in a temp dir with `cwd` at `website/`. Both
   behave as the copy's own files dictate.
7. **T20 by parsing.** Done; the text-based parts and the parser defect are in 3.4.
8. **Pull request template.** Mapped in section 7.
9. **Failing test first.** `87974b0`, red as in 3.1; mutation check in 3.7.
10. **Scope.** As section 2; no `git fetch` of any kind; ports 4204-4206 only, and
    every server was started by Playwright's `webServer` and stopped with it.

## 6. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| A job runs the website browser suite on every pull request | Refinement plan line 154; GAP-04 target | Done in code; CI run open | `ci.yml` job `website-browser`, no `needs`/`if`, existing `pull_request` triggers without `paths` (T20) |
| Both builds: default and consent (`SNAPSHOT_SETTINGS_FIXTURE=consent`) | GAP-04 target; finding 6 | Done | Steps "Default build", "Consent build" (`rm -rf out`, fixture env); T20; local run 3.6 |
| All 29 tests run, each in the build it targets; skipped or missing tests cannot pass | Refinement plan line 154; P-5 | Done | `check-report.mjs` + `expected.json`; T6-T11, T13-T17; local real reports: 29 tests, no problem (3.6) |
| 0 failures on the pull request's CI run | Refinement plan line 154 | Open (NOT RUN, 3.8) | Needs the CI check line with run id and job id. Locally 9 CDN failures (403) |
| Reports until `BROWSER_TESTS_BLOCKING_FROM` (≥ merge + 7, ≤ 2026-11-23), then blocks | Refinement plan line 154; standard section 3 | Done; date to confirm at merge | `"2026-11-12"` (assumption in 5.2); T2-T4, T14, T20; real reports: exit 0 with `::warning` / exit 1 with `::error` (3.6) |
| Committed canary the gate must reject, run on every pull request | GAP-21 | Done | `canary/`, `run-canary.mjs` as a blocking step before the tests; T18, T19; mutation check (3.7) |
| Added actions pinned by 40-character SHA | Wave 1-3 checklist; G-15 | Done | checkout `11d5960a…` v4.4.0, setup-node `49933ea5…` v4.4.0, upload-artifact `ea165f8d…` v4.6.2, rechecked with `git ls-remote` today; T20 |
| One gate in this pull request | B-8 | Done | Only the browser-suite gate; `git diff --stat` (section 2) |
| actionlint 0 findings on `ci.yml` | GAP-08 / G-13 | Done | 3.5: exit 0, no output, actionlint 1.7.12 + shellcheck 0.11.0, checksums `OK` |
| Security self-test passes (no inline interpreters) | `.github/security/gate.test.mjs` | Done | 62/62 pass (3.2); T20 also asserts no inline node |
| Website typecheck, Vitest, design check unchanged and green | G-2 | Done | typecheck 0; Vitest 406 passed, 31 skipped (437); design check 0 (3.2) |

## 7. Pull request template mapping (condition 8)

- **What and why:** GAP-04 (refinement plan line 68, Wave 1; test report 2026-10-27
  finding 6). Plan section 1.
- **Scope and boundaries:** section 2 here; out of scope as plan section 4.
- **Security impact:** none to routes, policies, data or secrets. No dependency added.
  Three actions added by SHA. Every Google tag request is answered inside the tests.
  Plan section 6.
- **Tests and evidence:** section 3 here. The CI run id and job id of the
  `browser suite: 29 tests; … 0 failures` line are open until the pull request runs.
- **Owner decisions:** the two quotes at the top (Mohamed Elbadry, 2026-11-01,
  project thread). No other decision taken or assumed. Making the check required is an
  owner action under GAP-03.
- **Definition of Done:** "PR checks are green on the final head (run IDs quoted)":
  open until the CI run, and green alone is not the proof (condition 4).
  "Independent code review": open (tester, step 5, and tech lead gate 2).
  "Reviewed by someone other than the author": open. Rollback: revert the pull
  request. Deployment note: nothing deploys; the integrator who merges into
  `rebuild/dotnet-platform` is to be named by the owner.
- **Review findings accepted:** none yet.
- **Governance:** `AGENTS.md` coverage table: not applicable, `AGENTS.md` is not on
  the base branch. `docs/deferred-items.md`: none. Documentation updated: the
  `website/README.md` paragraph (section 2).

## 8. Migrations

None.

Status: READY FOR TEST
