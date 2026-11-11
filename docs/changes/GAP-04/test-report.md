# GAP-04 test report

## Round 1

Tester, 1 November 2026. Commit tested: `3ecd251` (branch `change/GAP-04`; red
commit `87974b0`). Detached checkout `/home/user/wt-GAP-04-test` (removed at the
end). Mutation runs used a scratch `git archive 3ecd251` copy, never the
checkout. Raw logs:
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap04-test/`.

Environment: Node v22.23.4, `npm ci` in `website/` (exit 0),
`PLAYWRIGHT_BROWSERS_PATH=…/scratchpad/pw-browsers`, ports 4210-4230. No
`git fetch` of any kind; `git rev-parse --is-shallow-repository` = `false`.
Read: `docs/changes/README.md`, `ENVIRONMENT.md`, `.claude/agents/tester.md` (ref
copies), `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`.

### 1. Red test was red

```
$ git checkout --detach 87974b0; ls website/tools/browser-suite   → No such file or directory
$ npx vitest run test/browser-suite-report.test.ts                 exit 1
 Test Files  1 failed (1)
      Tests  27 failed (27)
  Error: Cannot find module '…/website/tools/browser-suite/check-report.mjs'   (×21)
  Error: Cannot find module '…/tools/browser-suite/run-canary.mjs'
  Error: ENOENT … tools/browser-suite / expected.json                          (T17)
  AssertionError: job website-browser in ci.yml: expected -1 to be greater than 35   (T20)
```

Fails for the reason the plan gives (scripts and job absent). The only later test
edit (`git diff 87974b0 3ecd251 -- website/test/…`) strips a trailing `# vX` YAML
comment from `uses:` before the same 40-hex match. That does not loosen it
(mutation M6 below still fails T20).

### 2. Planned checks on head `3ecd251`

| Command (in `website/` unless noted) | Exit | Output |
| --- | --- | --- |
| `npx vitest run test/browser-suite-report.test.ts` | 0 | `Tests 27 passed (27)` |
| `npm run typecheck` | 0 | |
| `npx vitest run` | 0 | `Test Files 21 passed \| 1 skipped (22)`, `Tests 406 passed \| 31 skipped (437)` |
| `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `node tools/browser-suite/run-canary.mjs` | 0 | `canary 1 rejected: …`, `canary 2 rejected: …` |
| `node --test .github/security/gate.test.mjs` (repo root) | 0 | `# tests 62`, `# pass 62`, `# fail 0` |
| actionlint 1.7.12 + shellcheck 0.11.0 on `.github/workflows/ci.yml` (installed with `/home/user/wt-GAP-08/.github/lint/install-actionlint.sh`, sha256 `8aca8db9…` and `8c3be12b…` match `workflow-lint.yml`) | 0 | no output. The same binaries on GAP-08's `canary-workflow.yml`: exit 1, 6 findings, so shellcheck was active |
| `git ls-remote` for `actions/checkout` v4.4.0, `setup-node` v4.4.0, `upload-artifact` v4.6.2 | 0 | `11d5960a…`, `49933ea5…`, `ea165f8d…`: they match the job's pins |

Real reports through the checker (plan 5.2):

```
$ CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build                     exit 0
$ WEBSITE_TEST_PORT=4210 PLAYWRIGHT_JSON_OUTPUT_NAME=…/reports/default.json npx playwright test --reporter=list,json
  1 failed (pages.spec.ts:7:1) / 25 skipped / 3 passed                                               exit 1
$ rm -rf out && … SNAPSHOT_SETTINGS_FIXTURE=consent … npm run build                                   exit 0
  Consent: the banner script and stylesheet are in out/behaviors/.
$ WEBSITE_TEST_PORT=4211 … npx playwright test --reporter=list,json
  8 failed (7 × consent.spec.ts:140:3, pages.spec.ts:7:1) / 1 skipped / 20 passed                    exit 1
  "gsap is not defined": 1 (default) + 8 (consent)
$ BROWSER_TESTS_BLOCKING_FROM=2999-12-31 node tools/browser-suite/check-report.mjs … default=… consent=…   exit 0
browser suite: 29 tests; default 3 passed, 25 skipped as expected, 1 failed; consent 20 passed, 1 skipped as expected, 8 failed; 9 failures
::warning title=Browser tests (report mode until 2999-12-31)::9 failure(s)
$ BROWSER_TESTS_BLOCKING_FROM=2000-01-01 …same…                                                       exit 1
::error title=Browser tests (blocking since 2000-01-01)::9 failure(s)
```

The same 9 CDN failures as plan 2.4 and implementation 3.6 (`cdn.jsdelivr.net`
answers 403 here).

### 3. Test 26 and a full 29 of 29, CDN mirrored (beyond the plan)

Test 26 had not been seen passing. The architect's saved `pw-*-mirror.json` shows
it failing at `.brand-logo` count 0, under a harness that reached the site as
`dh.localhost`. I used a different harness, scratch only, with no test or config
file changed:

- an HTTPS mirror on 4212 of the same files (GSAP 3.12.5 and ScrollTrigger from
  the npm tarball, Lenis 1.0.23);
- a CONNECT proxy on 4215 that tunnels only `cdn.jsdelivr.net:443` to the mirror,
  forwards `127.0.0.1` and refuses everything else;
- a scratch config that differs from `playwright.config.ts` only in
  `proxy: { server: 'http://127.0.0.1:4215' }` and `ignoreHTTPSErrors: true`. The
  site stays at `http://127.0.0.1:<port>`.

```
consent build (WEBSITE_TEST_PORT=4213):   ✓ 26 pages.spec.ts:7:1 …   1 skipped, 28 passed     exit 0
default build:                             ✓ 26 ✓ 27 ✓ 28 ✓ 29      25 skipped, 4 passed     exit 0
$ BROWSER_TESTS_BLOCKING_FROM=2000-01-01 node tools/browser-suite/check-report.mjs … default-mirror.json consent-mirror.json   exit 0
browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures
```

So test 26 and the seven cookie-variant tests pass once GSAP loads, and the
checker prints the exact Done-when line. Limits: the tabler-icons stylesheet was
not mirrored (404, which raises no page error). This is local evidence, not the CI
proof: the CI run's line with its run id and job id is still required (condition 4).

### 4. Canary reports

- **Shape.** Each canary is a strict subset of a real Playwright 1.56.1 report
  (`suites`, `errors`, `stats`; per test `annotations, expectedStatus,
  projectName, results, status`; per result `duration, retry, status`, plus
  `error` on the failed one). Compared with my real mirrored reports from the same
  commit: all 29 ids are identical, and `status`, `expectedStatus` and result
  statuses are identical except for the intended edit. `consent-failed`: test 26
  `unexpected`/`failed`. `consent-lost`: the real default statuses. `stats`
  matches a recount in all three (4/25/0/0, 27/1/1/0, 4/25/0/0). The checker reads
  only fields the canaries keep.
- **Canary 1 fails for the intended reason only.** At `2000-01-01`: exit 1, one
  `failed: consent: pages.spec.ts › the skipped home intro …` line, **no
  `problem:` line**. At `2999-12-31`, the same inputs give exit 0 with
  `::warning`. So canary 1 fails only because the blocking date has passed.
- **Canary 2** (report mode): exit 1 with 25 `unexpected skip: consent:
  consent.spec.ts › …` and 1 `expected to skip but ran: consent: pages.spec.ts ›
  nothing from Tag Manager …`. It is rejected for the lost banner.
- **Checker mutations** (scratch copy; each restored, `cmp` equal):

  | Mutation | Canary | `browser-suite-report.test.ts` |
  | --- | --- | --- |
  | failures never block | exit 1 (caught) | 4 failed |
  | unexpected skip counted as an expected skip | exit 1 (caught) | 4 failed |
  | "expected to skip but ran" ignored | exit 0 | 1 failed (T8) |
  | `minimumTests` ignored | exit 0 | 2 failed |
  | top-level `errors` ignored | exit 0 | 1 failed (T12) |
  | different ids between reports ignored | exit 0 | 1 failed (T11) |

  Every mutation is caught by the canary, the unit tests, or both. The canary
  covers the two loosenings the plan assigns it.

### 5. Can the job go green when it should not? (real Playwright runs, scratch copy)

The checker is run in report mode (`2999-12-31`), the most permissive mode.

| Case | Playwright exit | Checker |
| --- | --- | --- |
| `test.only` on one `pages.spec.ts` test | **0** | exit 1: `default: 1 tests listed, fewer than 29`, ids differ, `expected to skip but not in the report: default: consent.spec.ts` |
| `test.fixme` on one `pages.spec.ts` test | 1 | exit 1: `unexpected skip: default: pages.spec.ts › the fallback logo …` |
| `consent.spec.ts` renamed `cookie-consent.spec.ts` | 1 | exit 1: 25 × `unexpected skip: default: cookie-consent.spec.ts › …` |
| consent build without its banner | n/a | canary 2 above (real statuses) |
| syntax error in a spec | 1 | exit 1: `Playwright reported 1 error(s) outside any test: SyntaxError …`, `0 tests listed` |
| web server cannot start (port taken) | 1 | exit 1: `… is already used …`, `0 tests listed` |
| Playwright killed mid-run (SIGTERM) | **143** | the step's `-gt 1` rule fails the step at once; no report written, and the checker says `consent report … does not exist` (exit 1) |
| fewer than 29 distinct tests | n/a | T10, and the `.only` case above |

In every case the job goes red, during the report week too.

### 6. T20 and the YAML reader defect

**The defect is real and broader than `implementation.md` 3.4 says.** I probed
`.github/security/workflow-yaml.mjs` directly
(`…/gap04-test/yamlprobe.mjs`):

```
steps:\n  - run: |\n      first\n      second          → {"steps":[{"run":"second"}]}
job:\n  run: |\n    first\n    second                  → {"job":{"run":"second"}}      (a mapping, not a list item)
run: |\n  first\n  second                              → {"run":"second"}              (top level)
steps:\n  - name: A\n    run: >-\n      node x.mjs\n      arg   → run "arg"
steps:\n  - run: |\n      echo hi\n    env:\n      A: b         → {"steps":[{"run":"env:\n  A: b"}]}   (env key lost)
```

`parseMapping`, `parseSequence` and their key loop all move `index` past the key
line before `assignKey`, and `blockScalar` adds 1 again. So every block scalar
loses its first line. When the block has a single line, the scalar's indent is
taken from the next line, and the step's **next key is swallowed** into the
string.

T20 mutations (scratch copy of `ci.yml`, `vitest -t T20`):

| Mutation | T20 |
| --- | --- |
| job-level `continue-on-error: true` | fails (caught) |
| `continue-on-error: true` after the multi-line "Consent build" `run: \|` | fails (caught) |
| canary step as a one-line `run: \|` followed by `continue-on-error: true` | fails (the canary `run` is lost) |
| **"Install Playwright's Chromium" as a one-line `run: \|` followed by `continue-on-error: true`** | **passes** |
| **"Default build" as a one-line `run: \|` followed by `continue-on-error: true`** | **passes** |
| **check step `… "consent=${REPORTS}/consent.json" \|\| true`** | **passes** |
| `paths:` under `pull_request` | fails (caught) |
| `pull_request.types` without `synchronize` | passes (not asserted) |
| date `2026-11-09` / `2026-11-24` | fails / fails (caught) |
| upload `@v4` instead of the SHA | fails (caught) |
| Playwright step ignores exit codes > 1 | passes (not asserted; checker still fails on a missing or errored report) |

Judgement: T20 proves SHA pins, no `paths` filter, the date bounds and no job-level
`continue-on-error`. It does **not** fully prove "no `continue-on-error`" on
steps: one YAML form hides it. The gate itself stays safe in those two cases. If
the build or Chromium install fails, Playwright reports errors or writes no
report, and the checker fails closed. The developer's text workaround for the
check line (a plain scalar) is correct, and is needed because of this defect.

### 7. Blocking date

`BROWSER_TESTS_BLOCKING_FROM: "2026-11-12"`; T20 bounds `2026-11-10…2026-11-23`.
2026-11-12 is at least merge + 7 only for a merge **on or before** 2026-11-05.
`implementation.md` 5.2 says the date "assumes a merge no earlier than
2026-11-05", which is inverted, although its next sentence ("If the merge lands
after 2026-11-05, the date must move") is right. Today is 2026-11-01. The Wave 0
exit gate is not met: the website npm-audit gate reports 3 new findings, see 8. So
a merge by 5 November is unlikely, and the date will probably have to move before
merge. Tech lead gate 2 must check it. The checker compares UTC dates, and
`date <= today` blocks, so the blocking day itself blocks (T4).

### 8. Security

| Check | Exit | Result |
| --- | --- | --- |
| `npm audit --audit-level=high` in `website/` | 1 | `8 vulnerabilities (3 moderate, 4 high, 1 critical)` |
| `npm audit --audit-level=high` in `studio/` | 1 | `5 vulnerabilities (2 moderate, 3 high)` |
| `RUNNER_TEMP=… sh ../.github/security/run-npm-audit.sh website` | 1 | `website: 6 finding(s) at the gate's level; 3 known, 3 new` (`next` GHSA-p3m5-59mp-jv5r high, GHSA-673q-mjm6-r5xr critical, …) |
| `… run-npm-audit.sh studio` | 0 | `0 finding(s) at the gate's level` |

These advisories come from the base, not from this change. `git diff 6470fac
3ecd251` touches no `package.json`, lockfile or `.github/security/` file, so the
gate's inputs are byte-identical to the base. They are GAP-01's (Wave 0). The
Security workflow on this pull request will be red for them until GAP-01 merges.
That matches gate-1 condition 1: GAP-04 does not merge before the owner confirms
the Wave 0 exit gate.

- **Semgrep, gitleaks:** NOT RUN, not installed here. Covered by `security.yml`
  jobs "Semgrep (ERROR fails, WARNING reported)", "Secret scan (gitleaks, this
  pull request's commits)" and "Secret scan (gitleaks, full history)".
- **dotnet audit:** NOT RUN, no .NET change. Covered by "NuGet vulnerable
  packages (api) — High and Critical".
- **Routes, role matrix, host checks:** not applicable; no route is new or changed.
- **Workflow:** no `pull_request_target`; workflow-level `permissions: contents:
  read`; `${{ }}` in `run` only expands `github.workspace`, which no attacker
  controls; no inline interpreters (gate self-test 62/62); no secret read. Every
  Google tag request is answered inside the tests.
- **Secrets:** none in the diff (`git diff 6470fac 3ecd251 | grep -iE
  "secret|token|password|api.?key|PRIVATE"` shows only prose lines). The canaries
  hold no absolute paths.

### 9. Other checks

- `npm run compare:sections` (`SECTION_COMPARE_OLD=/home/user/old-site`, port
  4230, default build): exit 1, `104/119 sections match; 14 accepted; 1 failures`
  (`differs: /careers/apply.html #section`). This is not from this change: `git
  diff --stat 6470fac 3ecd251 -- website` lists only the new tool, test and README
  files, so the build input is the base's. Covered by the `section-compare` CI job
  (`continue-on-error`, GAP-05).
- Studio and API suites: NOT RUN, not touched; covered by the `studio` and `api`
  CI jobs.
- A CI run of the new job: NOT RUN, nothing is pushed (condition 1). Covered by the
  job "Website — browser tests, default and consent builds" on the pull request.
  Its check line must read `… 0 failures` with run id and job id.

### 10. Findings

No Blocker or Major.

1. **Minor — T20 cannot see a step key after a one-line `run: |` block, so it does
   not fully prove "no `continue-on-error`".**
   - Steps: in `ci.yml`, change "Install Playwright's Chromium" (or "Default
     build") to `run: |` with its one command on the next line, add
     `continue-on-error: true` below it, then run `npx vitest run
     test/browser-suite-report.test.ts -t T20`.
   - Expected: T20 fails.
   - Actual: T20 passes. `workflow-yaml.mjs` swallows the key into the `run`
     string (section 6). Also, `implementation.md` 3.4 says the defect is limited
     to list items. It hits every block scalar, and a one-line block loses the
     next key.
   - The gate stays fail-closed, so this is Minor. Suggested: add one text
     assertion that no line of the job block matches `^\s*continue-on-error:`, and
     correct 3.4. Fixing the reader stays its own item (B-8).
2. **Minor — T20 accepts a neutralised check step.**
   - Steps: append ` || true` to the "Check both runs" `run`.
   - Expected: T20 fails (it is the same as `continue-on-error` for this gate).
   - Actual: T20 passes; actionlint and the canary also pass.
   - Suggested: assert the check `run` is exactly the expected command, as is done
     for the canary.
3. **Minor — T20 does not assert the `pull_request` trigger types.**
   - Steps: remove `synchronize` from `types`.
   - Expected: T20 fails ("on every pull request").
   - Actual: T20 passes.
4. **Minor (record) — blocking-date assumption is worded backwards.**
   - Where: `implementation.md` 5.2, "assumes a merge no earlier than 2026-11-05".
   - Expected: "no later than 2026-11-05".
   - Actual: the inverted wording. Given the open Wave 0 exit gate, the date will
     likely need to move before merge (section 7).
5. **Minor — T20 requires `website-browser` to be the last job in `ci.yml`.**
   - Steps: append any job after it.
   - Expected: T20 still checks this job.
   - Actual: any later pull request that appends a job (GAP-05, GAP-09 and others
     touch `ci.yml`) fails T20. That pull request will then have to change T20's
     cut, which is brittle coupling. Acceptable while the reader cannot parse the
     whole file; record it for whoever fixes the reader.

### 11. Coverage table rows verified

| Item | Verified | Evidence |
| --- | --- | --- |
| A job runs the website browser suite on every pull request | Yes, in code (CI run open) | `ci.yml` job without `needs`/`if`/`continue-on-error`; T20; trigger types not asserted (finding 3) |
| Both builds: default and consent | Yes | sections 2, 3; consent build log line; T20 fixture env |
| All 29 run, each in its build; skipped or missing cannot pass | Yes | section 5 (real `.only`, `fixme`, rename, crash, server failure); canary 2; T6-T11 |
| 0 failures on the pull request's CI run | Open | NOT RUN in CI. Locally 9 CDN failures, and 29/29 with `0 failures` under a mirrored CDN (section 3) |
| Reports until `BROWSER_TESTS_BLOCKING_FROM`, then blocks | Yes; date to confirm at gate 2 | section 2 (exit 0 `::warning` / exit 1 `::error`); canary 1 at both dates; section 7 |
| Committed canary rejected, on every pull request | Yes | sections 2, 4 (shape, reason, mutations) |
| Added actions pinned by 40-character SHA | Yes | `git ls-remote` match; T20 mutation M6 |
| One gate in this pull request | Yes | diff touches only the new job, tool, test and README |
| actionlint 0 findings | Yes | section 2 |
| Security self-test passes | Yes | 62/62 |
| Typecheck, Vitest, design check green | Yes | section 2 |

Round 1 result: APPROVED. Gate 2 (`delivery-approval.md` round 1) then sent the change back; see Round 2.

## Round 2

Tester, 1 November 2026. Commit tested: `668273d` (red `2c7872d`, fix `888a404`;
`implementation.md` section 9). This answers gate 2 (`delivery-approval.md` round 1,
`Verdict: CHANGES NEEDED`). Fresh detached checkout `/home/user/wt-GAP-04-test`
(removed at the end). `npm ci` in `website/` exit 0. Mutation runs used scratch
copies only (`git archive 668273d`, or a copy of `tools/browser-suite/`). No
`git fetch`; `git rev-parse --is-shallow-repository` = `false`. Raw logs:
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap04-test/r2/`.

Round-2 scope (`git diff --stat 3ecd251 668273d`): `check-report.mjs` (+13/-1),
`run-canary.mjs`, the test file, a README sentence and `implementation.md`. Nothing
under `.github/` changed, and neither did `browser-tests/`, `playwright.config.ts`,
`package.json` or the lockfiles.

### R2.1 Red commit `2c7872d`

```
$ git checkout --detach 2c7872d; npx vitest run test/browser-suite-report.test.ts      exit 1
      Tests  7 failed | 31 passed (38)
  × a blocking date of 2026-11-24, after the cap, is refused even with good reports
  × a blocking date of 2099-01-01, after the cap, is refused even with good reports
  × a blocking date of 2999-12-31, after the cap, is refused even with good reports
      AssertionError: browser suite: 29 tests; … 0 failures            (old checker accepts the date)
  × a blocking date after the cap is refused with a failed test too, and does not turn into report mode
  × the checker reads no setting but the blocking date and the job summary
      AssertionError: expected '/**\n * Checks the two Playwright JSO…' to contain 'const latestBlockingDate = "2026-11-2…'
  × fails when a canary is also refused for its blocking date
  × fails when canary 1 has any problem besides the failed test
      AssertionError: canary 1 rejected: …                             (old runner ignores the reason)
```

These are the 7 failures and reasons in implementation 9.2: no cap, and a canary
runner that does not check the reason. The 31 that pass there are the old cases.
The reworked report-mode cases use the clock stub and `2026-11-23`. Report mode did
not change, so they pass on the old checker, as stated.

### R2.2 Test plan on head `668273d`

| Command (in `website/` unless noted) | Exit | Output |
| --- | --- | --- |
| `npx vitest run test/browser-suite-report.test.ts` | 0 | `Tests 38 passed (38)` |
| `npm run typecheck` | 0 | |
| `npx vitest run` | 0 | `Test Files 21 passed \| 1 skipped (22)`, `Tests 417 passed \| 31 skipped (448)` |
| `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `node tools/browser-suite/run-canary.mjs` | 0 | `canary 1 rejected: a failed consent-build test after the blocking date`, `canary 2 rejected: a consent build that lost its banner` |
| `node --test .github/security/gate.test.mjs` (repo root) | 0 | `# tests 62`, `# pass 62`, `# fail 0` |
| actionlint 1.7.12 + shellcheck 0.11.0 (round-1 install, checksums verified) on `ci.yml` | 0 | no output |

npm audit: NOT RE-RUN, because round 2 changes no dependency, lockfile or
`.github/security/` file. The round-1 results stand: the website gate has 3 new
`next` findings (base, GAP-01), and Studio has 0. The browser runs are not re-run
either. `ci.yml`, the specs and the build are unchanged, so round-1 sections 2, 3
and 5 stand, and I reused their real reports below.

### R2.3 The 2026-11-23 cap against overrides

The real round-1 reports (9 CDN failures) were run through the head checker with
the real clock (today 2026-11-01):

| `BROWSER_TESTS_BLOCKING_FROM` as the check step sees it | Exit | Output |
| --- | --- | --- |
| `2026-11-12` (job env, unchanged) | 0 | `::warning title=Browser tests (report mode until 2026-11-12)::9 failure(s)` |
| `2026-11-23` (the cap itself) | 0 | `::warning … (report mode until 2026-11-23)` |
| `2026-11-24`, `2026-12-01`, `2099-01-01` (a step `env` override) | 1 | `problem: BROWSER_TESTS_BLOCKING_FROM is <v>, after 2026-11-23, the latest blocking date allowed` + `::error title=Browser tests blocking date::…` + `::error title=Browser tests::1 problem(s)…` |
| `$GITHUB_ENV`, emulated: an earlier step runs `echo "BROWSER_TESTS_BLOCKING_FROM=2099-01-01" >> "$GITHUB_ENV"`, the file is loaded over job env `2026-11-12` | 1 | `seen: 2099-01-01`, same `problem:` and `::error` lines |
| `$GITHUB_ENV` heredoc form (`NAME<<EOF … EOF`) giving `2099-01-01` | 1 | same |
| ` 2099-01-01`, `2099-01-01 `, `20990101`, `+2099-01-01` | 1 | `problem: … is not a date in YYYY-MM-DD form` |
| `TZ=Pacific/Kiritimati` (local date already 2 Nov) with date `2026-11-02` | 0 | `::warning … report mode until 2026-11-02`: the checker uses UTC, as intended |

The cap holds whatever wins on the runner, step `env` or `$GITHUB_ENV`. Any value
the checker reads after 2026-11-23 fails it, in every mode. I did not observe
runner precedence on GitHub (NOT RUN, nothing pushed). It does not matter: the
refusal is on the value read. Residual, documented in implementation 9.4: an
override to a date on or before 2026-11-23 is accepted, which is within the plan's
bound.

Mutations (scratch copies; originals `cmp` equal):

| Mutation | Canary | Unit tests |
| --- | --- | --- |
| cap removed (`if (value > latestBlockingDate)` → `if (false)`) | exit 0 (not caught) | 4 failed (the three past-cap dates, and failed-test-past-cap) |
| cap tightened so every date is refused | exit 1 (caught) | n/a |
| canary 2 date moved to `2099-01-01` | exit 1 (caught by the `forbidden` rule) | n/a |

Removing the cap is caught only by the unit tests, which run in the `website` job
on every pull request. Implementation 9.5 says the same. A third canary (good
reports with a date past the cap) would catch it in this job too. It is optional,
see R2.6 finding 6.

### R2.4 Clock stub and `node --import`: can they leak into the real job?

- The stub exists only as a string inside `browser-suite-report.test.ts`
  (`clockStub()`). It is written to `os.tmpdir()/dh-website-browser-suite-…/`
  (`test/helpers.ts` `mkdtempSync`) and removed after each run. `git ls-files |
  grep -i stub` is empty.
- It is loaded only as an argument of the test's own `spawnSync(process.execPath,
  ["--import", stub, checker, …])`. It is not set in `NODE_OPTIONS`, and not in
  `process.env` of the Vitest process.
- No workflow, tool, `package.json` or Playwright config uses `NODE_OPTIONS` or
  `--import`. `grep -rn "NODE_OPTIONS\|--import" .github website/tools
  website/package.json website/playwright.config.ts` is empty.
- `ci.yml` runs `node tools/browser-suite/run-canary.mjs` and `node
  tools/browser-suite/check-report.mjs …` with no flag. `run-canary.mjs` spawns the
  checker with `process.execPath` and no `--import`.
- The checker reads only `BROWSER_TESTS_BLOCKING_FROM` and `GITHUB_STEP_SUMMARY`
  (asserted by a test; checked with grep). It has no date argument or variable.
- So the real job always runs on the real clock. I confirmed the stub's effect is
  only through `--import`. With date `2026-11-23` and the 9 real failures: real
  clock gives `::warning`, exit 0; `--import` stub at 2026-12-01 gives `::error
  (blocking since 2026-11-23)`, exit 1.
- **Exposure (not a leak, Minor 7):** Node honours `NODE_OPTIONS`. A step that
  wrote `NODE_OPTIONS=--import=<stub>` to `$GITHUB_ENV` would fake "today" for the
  check step. Shown: `NODE_OPTIONS="--import=…/stub-2026-11-01.mjs"` with date
  `2026-11-23` prints `::warning … report mode until 2026-11-23` on any day. The
  approach does not create this; it is the same class as editing the checker in
  the same pull request. No current check would see it (T20, actionlint, the
  canary).

### R2.5 Canaries fail only for their intended reasons

Committed canaries through the head checker, with "today" stubbed at 2026-11-01
and at 2026-12-01 (after the cap):

| Canary | Today | Exit | Lines |
| --- | --- | --- | --- |
| 1: `default` + `consent-failed`, date `2000-01-01` | both | 1 | one `failed: consent: pages.spec.ts › the skipped home intro …`, `::error (blocking since 2000-01-01)::1 failure(s)`; **no `problem:` line** |
| 2: `default` + `consent-lost`, date `2026-11-23` | both | 1 | 25 × `problem: unexpected skip: consent: consent.spec.ts › …`, 1 × `problem: expected to skip but ran: consent: pages.spec.ts › nothing from Tag Manager …`; **no `BROWSER_TESTS_BLOCKING_FROM` problem** |
| `run-canary.mjs` with `NODE_OPTIONS=--import=<stub>` | both | 0 | both rejected |

So both canaries keep failing for their own reason after 23 November.
`run-canary.mjs` now requires that: canary 1 with no `problem:` line, and canary 2
with no `problem: BROWSER_TESTS_BLOCKING_FROM` line. The three stand-in-checker
tests prove the rule passes and fails as stated (green on head, 2 red on
`2c7872d`). Canary 2's `forbidden` rule allows other problems. That is intended:
the lost banner also produces "expected to skip but ran".

### R2.6 Findings

No Blocker or Major. The round-1 findings are answered or accepted:

- Minor 1: implementation 3.4 is corrected. The text assertion was not added and
  is accepted at gate 2 as a follow-up.
- Minor 4: implementation 5.2 is corrected ("on or before 2026-11-05").
- Minors 2, 3 and 5: accepted follow-ups at gate 2, unchanged.

New in round 2:

6. **Minor — removing the cap is not caught by the canary.**
   - Steps: in `check-report.mjs`, replace `if (value > latestBlockingDate)` with
     `if (false)`, then run `node tools/browser-suite/run-canary.mjs`.
   - Expected: the in-job canary rejects it.
   - Actual: exit 0. Only the unit tests in the `website` job fail (4 failed).
     That job is a pull-request check, so the loosening is still caught, but
     outside this job. Optional: a third canary with good reports and a date
     after the cap.
7. **Minor (record) — the checker's clock can be faked through `NODE_OPTIONS`.**
   - Steps: `NODE_OPTIONS="--import=<a Date stub>"`, for example written to
     `$GITHUB_ENV` by an earlier step.
   - Expected: the blocking date is judged against the real date.
   - Actual: report mode continues past 2026-11-23.
   - This is not caused by the test's stub, which never leaves the test (R2.4). It
     is the same class as editing the checker, and is for code review. A possible
     hardening is out of this change's scope: run the check step with
     `NODE_OPTIONS` cleared.

Still open (unchanged): the CI run id and job id of the `browser suite: 29 tests;
… 0 failures` line (NOT RUN, nothing pushed). The date at merge: merge + 7, never
after 2026-11-23, checked at gate 2. The website npm-audit findings are the
base's (GAP-01, Wave 0 exit gate).

### R2.7 Coverage rows verified this round

| Item | Verified | Evidence |
| --- | --- | --- |
| A blocking date after 2026-11-23 cannot keep the gate in report mode (step `env`, `$GITHUB_ENV`) | Yes | R2.3 |
| Cap committed red first (B-6) | Yes | R2.1 |
| Report-mode tests and canary 2 off `2999-12-31`, each failing for its own reason, testable after the cap, no override in the checker | Yes | R2.4, R2.5 |
| Clock stub confined to the tests | Yes | R2.4 |
| Typecheck, Vitest (448), design check, canary, security self-test, actionlint | Yes | R2.2 |

Verdict: APPROVED
