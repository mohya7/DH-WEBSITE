# GAP-04 plan review

## Round 1

Reviewer: plan-reviewer, 1 November 2026. Plan reviewed: `docs/changes/GAP-04/plan.md`,
round 1, on `change/GAP-04` (base `6470fac`, plan untracked). Governing documents read
from the read-only copies under
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`
(`docs/changes/README.md`, `ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/test-report-2026-10-27.md`,
`.github/pull_request_template.md`).

Owner's words in force (Mohamed Elbadry, 2026-11-01, project thread): "Start waves 0 & 1
and update me with each gap done", then "continue working on wave 0 & 1". No other owner
decision applies; none is needed by this plan.

### Findings, most severe first

No Blocker. No Major.

**1. Minor — section 2.5 (GAP-01 row) and section 10: the overlap with GAP-01 is behavioural, not "none".**
GAP-01 (`change/GAP-01`, 9 commits on `6470fac`) moves `next` 16.3.6 → 16.4.3 and changes
`website/src/build/strip-runtime.ts` (Turbopack bootstrap strip). That changes the exact
built pages this job serves and tests; GAP-01's own records never run `browser-tests/`
(`git show change/GAP-01:docs/changes/GAP-01/implementation.md` mentions Playwright only for
a lockfile flag). No rebase is needed or wanted (B-8; GAP-01 is unmerged, and a
`pull_request` run tests the merge ref, so whichever lands second is checked against the
other). What would satisfy me: 2.5 and the risk table say (a) GAP-04 is not rebased onto
GAP-01; (b) if GAP-01 merges first, this PR's CI run is the 29-of-29 proof on next 16.4.3;
(c) if GAP-04 merges first, GAP-01's PR must show this job's check line with 0 failures, and
a failure there is GAP-01's defect even while this gate is in report mode (a warning, not a
red check), so the tech lead reads the line, not the colour.

**2. Minor — header and Definition of Done: the pull request template exists and is not covered.**
The plan says the template "was not among them and was not read". It is at
`ref/.github/pull_request_template.md`. The plan should map its sections, in particular:
"Tests and evidence" (the CI run id and job id of the 29-of-29 line), "Owner decisions"
(the two quotes above), the DoD boxes "PR checks are green on the final head" and
"Independent code review", and the Governance boxes "`AGENTS.md` coverage table or phase
document updated" (`AGENTS.md` is not on the base branch: say whether the box is answered
"not applicable, file not on base" or how), "`docs/deferred-items.md`" (none) and
"Documentation updated" (the `website/README.md` paragraph).

**3. Minor — section 5.2 "CI evidence": a green check is not the proof during the report week.**
With `BROWSER_TESTS_BLOCKING_FROM` in the future, the check step exits 0 with failures (3.1).
The plan does require the exact summary line, which is right; it should also say in so many
words that the job's green status on this PR proves nothing by itself, and that the developer
and tester quote the `0 failures` line plus the run and job ids. It should also say what
happens if the first CI run shows a real defect (risk row 1): the change stays not done and
is not merged with failures; the defect is a separate item (B-8), raised to the owner if it
blocks Wave 1. Today the plan says only "the change is not done until it does".

**4. Minor — section 3.4: canary output can break when `minimumTests` rises.**
Canary 1 requires exit 1 *and* the `failed: consent: …` line. The canary reports are frozen
at 29 tests. When a 30th test is added and `minimumTests` becomes 30, the structural
"fewer than 30" rule fires; if the checker stops at structural problems before listing
failures, canary 1 goes red for the wrong reason. State that the checker reports every
problem in one pass (structural and test failures), or that raising `minimumTests` regenerates
the canaries in the same PR; add a test for whichever is chosen.

**5. Minor — sections 3.4 and 5.1 T19: say how `run-canary.mjs` finds the checker.**
T19 copies `tools/browser-suite/` to a temp dir and swaps `check-report.mjs`. That only
works if `run-canary.mjs` resolves `check-report.mjs`, `expected.json` and `canary/` relative to
its own file (`import.meta.url`), not the working directory. Name it in 3.4.

**6. Minor — section 5.1 T20: scope the job by parsing, not by text.**
"Its block has no `continue-on-error`" by text search is fragile (comment lines, the next
job's indentation). `.github/security/workflow-yaml.mjs` already exports
`parseWorkflowYaml`; use it (or say why not) to read `jobs.website-browser`, its `runs-on`,
`env`, steps and `uses:`.

**7. Minor — section 2.5, PR #38 row: wording.** PR #38 adds the comment "Every job runs on
ubuntu-24.04, not ubuntu-latest" above `jobs:`. The new job's `ubuntu-24.04` keeps that
comment true whichever merges first, as the plan says; confirmed. Note also that the new job
is appended after `screenshot-parity`, whose last hunk in PR #38 is its `runs-on` line, so a
rebase conflict is unlikely. No change needed beyond keeping the job last.

### Checked and found sound

- **Fit.** GAP-04 register row (refinement plan line 68) and Done-when (line 154, "A job runs
  all 29 tests on every pull request with 0 failures, and blocks after its report week")
  quoted word for word. Track G1 Waves 1-3 named; checklist mapped in 5.3.
- **Test counts.** `browser-tests/pages.spec.ts` 4 tests (lines 7, 20, 42, 61; skip at 62);
  `consent.spec.ts` 25 (file-level skip line 11). Parsed the architect's real reports
  `…/scratchpad/gap04/pw-default.json` and `pw-consent.json` (Playwright `config.version`
  1.56.1): each lists 29 distinct `(file, title)` ids; default stats
  `expected 3, skipped 25, unexpected 1`; consent `expected 20, skipped 1, unexpected 8`;
  the one consent-build skip is `pages.spec.ts` "nothing from Tag Manager loads when the
  container id is empty"; every failure is `pages.spec.ts:7` or the 7 cookie-variant tests,
  matching 2.4 and the 27 October report (finding 6, rows 47-48; finding 8 CDN).
- **29 of 29 only from CI.** Acceptable under P-8: the local gap is the blocked
  `cdn.jsdelivr.net` (403), stated as NOT RUN with reason and covering job; 22 of 29 seen
  passing, tests 6-12 fail only on the final no-page-errors assertion, test 26 seen passing
  with a mirrored CDN. The plan correctly makes the PR's CI line the Done-when evidence.
- **Checker robustness.** Exact expectation per build (skipped files and tests listed),
  both reports must list the same ids, ≥ `minimumTests`, unexpected skip and missing expected
  skip both fail, top-level `errors`, missing/empty/invalid report, bad date and bad arguments
  all fail in report mode too (P-5); `flaky` and any non-passed result count as failures
  (no retries, P-6). Playwright exit > 1 stops the job; exit 1 is left to the checker; a
  crash leaves no JSON, which the checker fails. This closes the "exit 0 with 25 skipped" and
  `.only` holes. T1-T20 cover each rule.
- **Report week.** `BROWSER_TESTS_BLOCKING_FROM` ≥ merge + 7 and ≤ 2026-11-23, stop and go to
  the owner if both cannot hold; matches standards section 3 and refinement plan line 134.
  No `continue-on-error`; new gate, so a report week is correct.
- **Canary (GAP-21).** Two committed fixtures the gate must reject, run in a blocking step on
  every PR, plus T19 and a mutation check.
- **Pins.** `git ls-remote` today: `actions/checkout` `refs/tags/v4.4.0` =
  `11d5960a326750d5838078e36cf38b85af677262` (same as GAP-08's `workflow-lint.yml` line 58);
  `actions/setup-node` `v4.4.0` = `49933ea5288caeca8642d1e84afbd3f7d6820020`;
  `actions/upload-artifact` `v4.6.2` = `ea165f8d65b6e75b540449e92b4886f43607fa02`.
  Playwright 1.56.1 exact in `website/package-lock.json` (lines 1363, 2872).
- **CI facts.** `ci.yml` (394 lines): triggers `pull_request` types `opened, synchronize,
  reopened, labeled`, push to `rebuild/dotnet-platform`, no `paths`; `permissions: contents:
  read`; `NODE_VERSION: "22"`; no job runs `browser-tests/`; Studio installs Chromium at line
  248. `ci.yml` has no golden copy in `.github/security/`; the inline-interpreter rule is at
  `gate.test.mjs:1081-1092`, and the plan avoids `node -e`.
- **Scope.** One gate (B-8); specs, `playwright.config.ts`, `serve-built.mjs`, lockfiles,
  existing jobs untouched. Vitest `include: ["test/**/*.test.ts", …]` picks up the new test;
  `tsconfig.json` has `allowJs: false`, so the `.mjs` tools are not typechecked (as today).
  GAP-06 (api job), GAP-08 (actionlint; `.github/lint/run-actionlint.sh` exists on that
  branch), GAP-11 (SRI; this job would catch a bad hash), GAP-05, GAP-09 correctly separated.
- **Consent build.** `src/content/config.ts:60-73` and `fixtures/settings/consent.json`
  (`GTM-TEST1234`) as stated; `rm -rf out` between builds is right.
- **Security.** No routes, data, secrets or dependencies; Google tag requests answered in-test.
- **Owner.** No decision assumed; the required-check setting is correctly an owner action
  under GAP-03.
- **Rollback.** Revert; nothing depends on the job.

NOT RUN by this reviewer: the Vitest suite count ("409") and actionlint on a job that does not
exist yet; both are the developer's checks in 5.2.

Verdict: APPROVED
