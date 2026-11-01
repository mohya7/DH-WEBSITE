# GAP-04: run the website browser suite in CI (delivery approval, gate 2)

Role: tech-lead, gate 2. Branch `change/GAP-04`, worktree `/home/user/wt-GAP-04`,
head `3ecd251`, base `origin/rebuild/dotnet-platform` = `6470fac`. Date
2026-11-01. `git rev-parse --is-shallow-repository` = `false`; no `git fetch` run.

Governing documents read from the read-only copies under
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`
(`.claude/agents/tech-lead.md`, `docs/changes/README.md`, `ENVIRONMENT.md`,
`.github/pull_request_template.md`), since they are not on the base. Read in full:
`plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`,
`test-report.md` (round 1, `Verdict: APPROVED`, five Minors, untracked in the
worktree). For the P-6 judgement I also read GAP-08's gate 2
(`/home/user/wt-GAP-08/docs/changes/GAP-08/delivery-approval.md`, rounds 1 and 2).

Owner's words in force (Mohamed Elbadry, 2026-11-01, project thread): "Start waves
0 & 1 and update me with each gap done", then "continue working on wave 0 & 1".
This decision is a role in the pipeline. It is not the owner's confirmation that
`AGENTS.md` requires, and it is not an owner decision.

## Round 1

### Decision

Changes needed. The implementation matches the approved plan, stays in scope, the
failing tests came first, and the tester's evidence is real; everything I re-ran is
green. It goes back to the developer for one finding of my own, found while judging
the tester's Minors 1 and 2 against P-6: **the blocking date can be moved past
23 November by an environment setting that no check sees**, so the gate can stay in
report mode for ever while printing a warning and going green. This is the same
hole GAP-08's gate 2 sent back in its round 1 (a step `env` override of
`ACTIONLINT_BLOCKING_FROM` and writes to `$GITHUB_ENV`), and it gets the same
answer. It needs no plan change: plan 3.3 already says the date is "never after
`2026-11-23`"; the fix makes that rule hold at run time. So the change goes to the
developer, then to the tester again, not to the architect.

### Required: refuse a blocking date after 2026-11-23 at run time

Reproduced in a scratch copy of `3ecd251`
(`…/scratchpad/gap04-gate2/repo`, `node_modules` linked from the worktree). One
line added to the "Check both runs" step's `env`:

```
+          BROWSER_TESTS_BLOCKING_FROM: "2099-01-01"

$ npx vitest run test/browser-suite-report.test.ts -t T20            exit 0   Tests 1 passed | 26 skipped (27)
$ node tools/browser-suite/run-canary.mjs                             exit 0   canary 1 rejected …, canary 2 rejected …
$ actionlint 1.7.12 -shellcheck=shellcheck 0.11.0 .github/workflows/ci.yml   exit 0   (no output)
$ BROWSER_TESTS_BLOCKING_FROM=2099-01-01 node tools/browser-suite/check-report.mjs tools/browser-suite/expected.json \
    default=tools/browser-suite/canary/default.json consent=tools/browser-suite/canary/consent-failed.json
browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 27 passed, 1 skipped as expected, 1 failed; 1 failure
::warning title=Browser tests (report mode until 2099-01-01)::1 failure(s)
exit 0
```

Second route, also reproduced: `echo "BROWSER_TESTS_BLOCKING_FROM=2099-01-01" >> "$GITHUB_ENV"`
added to the "Default build" step leaves T20, the canary and actionlint at exit 0.
(I did not run it on a GitHub runner; it is listed because a `$GITHUB_ENV` write
can also come from any script the job runs, such as a build tool under `website/`,
with no edit to `ci.yml` at all.) The scratch `ci.yml` was restored and compared
equal to the worktree's after each mutation.

Why this is sent back and not a follow-up: T20 checks only the job-level `env`
value, and the canary sets its own dates, so a date set anywhere else is outside
every check the gate has. A reviewer reading a one-line `env:` entry on a step
would not see it as a gate edit, and the job keeps printing a clean-looking
result. That is a silent loosening under P-6 ("Never weaken a gate, guard or test
to make something pass"), and it defeats the report-week rule (standard section 3)
and the 23 November bound.

Required outcome:

1. `check-report.mjs` treats a `BROWSER_TESTS_BLOCKING_FROM` later than
   `2026-11-23` (Wave 1's last blocking day) as a **problem**: it fails in every
   mode, exit 1, with an `::error` that names the variable, its value and the cap.
   `2026-11-23` itself is accepted. If the owner later grants a schedule exception,
   the cap moves with it in the same change.
2. New cases in `website/test/browser-suite-report.test.ts`, committed and shown
   failing before the fix (B-6): `2026-11-24` and `2099-01-01` refused with the
   message; `2026-11-23` accepted.
3. Today's report-mode cases (T2, T6 to T15 and others) and canary 2 use
   `2999-12-31`, which the cap will refuse. Rework them so that each still fails,
   or passes, for its own reason only. Canary 2 must still be rejected for the lost
   banner with **no** date `problem:` line, and canary 1 for the failed test. Report
   mode must stay testable after 23 November. GAP-08 did this by stubbing the
   clock in its self-test (`stub_today`), not by a switch in the gate. Any stub
   lives in the tests only; `check-report.mjs` gets no argument or variable that
   changes its behaviour (plan 3.1, "No date override exists for tests").
4. Re-run and quote my two mutations above (step `env`, `$GITHUB_ENV`) with the
   check step, or the checker on the canary-1 inputs, now exiting 1. Re-run the
   tester's six checker mutations and the plan's mutation check.

### Tester's Minors: decision on each

Judged as GAP-08's gate 2 judged its Minors. A loosening that comes from outside
the gate's own checks, which a reviewer would not read as a gate edit, is sent
back (above). A loosening that needs a plain edit to the gate's own lines in
`ci.yml`, in a reviewed diff, sits behind the same trust boundary as the gate
itself, and is accepted as a recorded follow-up.

- **Minor 2, `|| true` on the check step passes T20, actionlint and the canary.
  Accepted as a follow-up.** It is an edit to the gate's own command line in
  `ci.yml`, as plain as GAP-08's N5 (`|| true` on the lint step), which GAP-08
  accepted as a follow-up. A pull request that can write it can also edit
  `check-report.mjs` or T20. The developer may close it this round at little cost
  (assert the check `run` equals the expected command exactly, as T20 already does
  for the canary), but it is not required.
- **Minor 1, T20 misses `continue-on-error` after a one-line `run: |`. Accepted as
  a follow-up.** It also needs a visible edit to the workflow, and the tester showed
  the gate stays fail-closed: on the canary and check steps the same form hides the
  step's `run` and T20 fails; on the Chromium install and build steps a failure
  leaves no report or a report with errors, which the checker fails. The
  developer **must** correct `implementation.md` 3.4 in round 2: the reader drops
  the first line of every block scalar (mappings, list items and top level), and a
  one-line block swallows the next key, as the tester's section 6 shows.
- **Minor 3, T20 does not assert `pull_request` types.** Accepted as a follow-up.
  Removing `synchronize` is a visible trigger edit to `ci.yml`.
- **Minor 4, blocking-date wording is backwards. Must be corrected in round 2.**
  `implementation.md` 5.2 says the date "assumes a merge no earlier than
  2026-11-05". `2026-11-12` is at least merge + 7 only for a merge **no later than**
  2026-11-05. The next sentence ("If the merge lands after 2026-11-05, the date must
  move") is right. Given the open Wave 0 exit gate (tester section 8: website
  npm-audit 3 new findings, GAP-01's), a merge by 5 November is unlikely, and the
  date will most likely move before merge (open item below).
- **Minor 5, T20 requires `website-browser` to be the last job.** Accepted as a
  follow-up for whoever fixes the reader; any later pull request that appends a job
  will see T20 fail loudly, not pass silently.

### New follow-up item: the YAML reader drops the first line of block scalars

Out of scope for GAP-04 (`.github/security/` is untouched, B-8). Recorded as its
own item for the owner's list:

- **Item:** `.github/security/workflow-yaml.mjs` (`parseWorkflowYaml`) drops the
  first line of every block scalar (`|`, `>-`), in mappings, list items and at top
  level; with a one-line block it takes the indent from the next line and swallows
  the next key into the string. It also cannot parse the whole `ci.yml` (throws in
  the `studio` job: "expected a key in a list item: fi").
- **Evidence:** tester section 6 (`…/gap04-test/yamlprobe.mjs`), e.g.
  `steps:\n  - run: |\n      first\n      second` → `{"steps":[{"run":"second"}]}`;
  `implementation.md` 3.4 (`parseSequence` and `blockScalar` both advance `index`).
- **Why it matters:** the security self-test (`gate.test.mjs`) reads `security.yml`
  through this reader, so any check of a `run: |` step's first line, or of a key
  after a one-line block, sees the wrong text. GAP-04's Minors 1 and 5 exist
  because of it.
- **Fix belongs to:** its own change, with failing tests first; when fixed, T20
  can parse the whole `ci.yml` (closing Minor 5) and assert step keys reliably
  (closing Minor 1). Candidate home: GAP-21 (self-protection for every gate),
  alongside GAP-08's follow-ups.

### What I verified myself

Commands run in `/home/user/wt-GAP-04` (head `3ecd251`) or the scratch copy above.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| New tests | `npx vitest run test/browser-suite-report.test.ts` (in `website/`) | 0 | `Tests 27 passed (27)` |
| Canary | `node tools/browser-suite/run-canary.mjs` | 0 | `canary 1 rejected: …`, `canary 2 rejected: …` |
| Typecheck | `npm run typecheck` | 0 | |
| Security self-test | `node --test .github/security/gate.test.mjs` (repo root) | 0 | `# tests 62`, `# pass 62`, `# fail 0` |
| Scope | `git diff --name-only 6470fac...HEAD`, filtered against the plan's section 4 files | grep 1 | nothing outside `ci.yml`, `website/tools/browser-suite/`, the new test, `website/README.md`, `docs/changes/GAP-04/` |
| Existing jobs untouched | `git diff 6470fac..HEAD -- .github/workflows/ci.yml \| grep -c '^-[^-]'` | | `0` (job appended only) |
| Test first (B-6) | `git show --stat 87974b0` | 0 | only `website/test/browser-suite-report.test.ts`; scripts and job in `68d1e64` after it |
| Date override (new) | as above | 0 / 0 / 0 | T20, canary and actionlint all pass the mutation |

Read against the plan: `check-report.mjs` (every rule of plan 3.1; every problem
and failure printed before the exit is decided, gate-1 condition 5; no date cap,
above), `run-canary.mjs` (resolves from `import.meta.url`, condition 6; sets its own
dates), the `website-browser` job (steps 1 to 11 as plan 3.1; the one form deviation
on the check step, a plain scalar with a `REPORTS` step env, is recorded with its
reason and is correct), `expected.json` (exactly the plan's), and T20 (parses the
job block, condition 7, with the text cut recorded).

Tester's evidence is real: commands, exit codes and output lines, a red run on
`87974b0`, real Playwright reports through the checker (9 CDN failures, the same as
the plan's base run), a 29-of-29 run with a mirrored CDN printing the exact Done-when
line, real-Playwright attack cases (`.only`, `fixme`, rename, syntax error, port
taken, SIGTERM), six checker mutations, `git ls-remote` pin checks and actionlint
with an active shellcheck. My re-runs agree with theirs. Every coverage-table row
has evidence, except "0 failures on the pull request's CI run", which is open and
correctly marked NOT RUN (nothing is pushed).

Commits (B-4): every subject carries `GAP-04:`, every body says why, and every
commit has the `Co-Authored-By` and `Claude-Session` trailers. `GAP-04: Plan` and
`GAP-04: Record the implementation` follow the pipeline's record-commit pattern.

Gate-1 conditions: 1 met (nothing pushed; check name stated); 2 met as an
assumption, wording wrong (Minor 4) and the date's 23 November bound not enforced at
run time (required fix); 3 met (not rebased onto GAP-01; both orders recorded);
4 met (the line, not the colour); 5 met (one-pass test passes); 6 met; 7 met with
the text cut recorded; 8 met (section 7 of `implementation.md`); 9 met (`87974b0`;
mutation check 3.7); 10 met.

### What round 2 must contain

- The required fix above, with its red-first commit, and the round-2 records.
- `implementation.md` round 2: Minor 4 wording corrected; 3.4 corrected for the
  reader defect's real scope (Minor 1); the mutation re-runs quoted.
- Commit `test-report.md` (round 1, then round 2) on `change/GAP-04` so the pull
  request carries its evidence.
- Optional this round: Minor 2's exact-command assertion and Minor 3's `types`
  assertion. If not done, they stay in "Review findings accepted" as written below.

### Open items (after round 2 passes)

- **CI on the final head:** NOT RUN, nothing pushed. The job "Website — browser
  tests, default and consent builds" must print
  `browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures`,
  quoted with run id and job id. Green alone proves nothing during the report week.
- **Blocking date at merge:** the integrator sets `BROWSER_TESTS_BLOCKING_FROM` to
  the merge date plus seven days, no later than `2026-11-23`, in this pull request
  before merge. A merge after 2026-11-16 is BLOCKED ON OWNER.
- **Website npm audit red** in Security until GAP-01 (Wave 0) lands; base
  dependencies, not this change. GAP-04 merges after the owner confirms Wave 0's exit
  gate.
- **GAP-01 order:** whichever lands second must show this job's `0 failures` line.
- **Required status check:** the owner's settings step under GAP-03.
- **Follow-ups:** Minors 1, 2, 3, 5 (if not closed in round 2) and the YAML reader
  item, above.
- **The owner's confirmation** under `AGENTS.md` before anything is pushed or merged.
  This approval is not it.

### Definition of Done (for the pull request after round 2)

Can be ticked once round 2 passes: requirement and acceptance criteria stated (the
CI line is the deploy-free proof still to come); standards; no prohibited
constructs; no routes; tests and regression tests; rollback; documentation
(`website/README.md`). Open: PR checks green on the final head with run ids;
independent code review on the pull request; review by someone other than the
author; deployment note (integrator named by the owner, after Wave 0, suites re-run
after merge). Governance: `AGENTS.md` coverage table not applicable (not on the
base branch); `docs/deferred-items.md` not needed (no exception; the Minors are
follow-ups).

### Draft pull request description

Round 1's draft is replaced by the one in round 2 below.

Round 1 decision: changes needed (sent back to the developer).

## Round 2

Head `668273d` (`2c7872d` red tests, `888a404` the fix, `668273d` the record). Base
still `6470fac`. Read again: `implementation.md` section 9 and the corrected 3.4
and 5.2, and `test-report.md` round 2 (head `668273d`, `Verdict: APPROVED`, new
Minors 6 and 7). `git rev-parse --is-shallow-repository` = `false`; no `git fetch`.

### Decision

Approved for the owner. Round 1's required fix is in, and I verified it myself.
Minors 6 and 7 are accepted as recorded follow-ups, for the reasons below. This
would have been the second return; it is not one.

### Round 1 findings, verified myself

Commands run in `/home/user/wt-GAP-04` (head `668273d`) or scratch exports under
`…/scratchpad/gap04-gate2/` (`git archive`, `node_modules` linked from the worktree).
Every edited file was restored and compared equal with `cmp`.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Red first (B-6) | `git show --stat 2c7872d`; in an export of `2c7872d`, `npx vitest run test/browser-suite-report.test.ts` | 1 | test file only; `Tests 7 failed \| 31 passed (38)`: the three past-cap dates, past-cap with a failure, "reads no setting but …", and the two canary-reason cases |
| New tests at head | `npx vitest run test/browser-suite-report.test.ts` | 0 | `Tests 38 passed (38)` |
| Canary at head | `node tools/browser-suite/run-canary.mjs` | 0 | `canary 1 rejected: …`, `canary 2 rejected: a consent build that lost its banner` |
| Typecheck | `npm run typecheck` | 0 | |
| Security self-test | `node --test .github/security/gate.test.mjs` | 0 | `# pass 62`, `# fail 0` |
| My step-env override | `BROWSER_TESTS_BLOCKING_FROM=2099-01-01`, the check step's command on the canary-1 inputs | 1 | `problem: BROWSER_TESTS_BLOCKING_FROM is 2099-01-01, after 2026-11-23, …`, `::error title=Browser tests blocking date::…`, `::error title=Browser tests::1 problem(s)…` (round 1: `::warning`, exit 0) |
| The cap date itself | same, `2026-11-23` | 0 | `::warning title=Browser tests (report mode until 2026-11-23)::1 failure(s)` |
| Cap removed (Minor 6) | `if (value > latestBlockingDate)` → `if (false)` | canary 0; tests 1 | `Tests 4 failed \| 34 passed (38)` |
| Clock via `NODE_OPTIONS` (Minor 7) | `NODE_OPTIONS=--import=<Date stub at 2026-12-01>`, date `2026-11-23`, canary-1 inputs | 1 | `::error … (blocking since 2026-11-23)`: the preload does change the checker's clock |
| No preload anywhere | `grep -rn "NODE_OPTIONS\|--import" .github website/tools website/package.json website/playwright.config.ts` | 1 | nothing |
| Round-2 scope | `git diff --name-only 3ecd251..HEAD` | 0 | `check-report.mjs`, `run-canary.mjs`, the test file, `website/README.md`, `implementation.md`; nothing under `.github/`, `browser-tests/`, config, `package.json` or lockfiles |

The `$GITHUB_ENV` route was emulated by the developer and the tester, not run on a
runner (NOT RUN, nothing pushed). It does not matter which value wins on the runner:
the checker refuses any value it reads after 2026-11-23.

Read: the `check-report.mjs` diff (+13/-1: the cap constant, a problem with its own
`::error`, comment naming the owner-exception rule); `run-canary.mjs` (canary 2 moved
to `2026-11-23`; each canary must fail for its own reason through a `forbidden`
pattern); the test file's 6 removed lines (the `2999-12-31` report-mode constant and
the real-clock T4, replaced by a clock stub preloaded with `--import` into the
test's own child process only). No assertion was weakened. The checker gained no
argument or variable, and a test asserts it reads only `BROWSER_TESTS_BLOCKING_FROM`
and `GITHUB_STEP_SUMMARY`. `implementation.md` 3.4 (reader defect's real scope) and
5.2 ("on or before 2026-11-05") are corrected as round 1 required. The optional
Minor 2 and 3 assertions were not added; they stay accepted follow-ups.

Commits (B-4): the three subjects carry `GAP-04:`, the fix subject is imperative,
bodies say why, trailers present.

### Tester's new Minors: decision on each

Judged as in round 1, and as GAP-08's gate 2 judged its N1 to N8.

- **Minor 6, removing the cap is not caught by this job's canary. Accepted as a
  follow-up.** Removing it is an edit to `check-report.mjs` itself, the gate's own
  file, in a reviewed diff. It is not silent: the `website` job's unit tests fail
  (4 failed, reproduced above), and that job is a check on every pull request. The
  canary was never meant to catch every edit to the checker. Plan 3.4 assigns it two
  loosenings (failures ignored, lost banner), and both are still caught. A third
  canary (good reports, a date past the cap) is a cheap hardening for GAP-21.
- **Minor 7, the checker's clock can be faked through `NODE_OPTIONS`. Accepted as a
  follow-up.** Reproduced: a preload module changes the date the checker sees. But
  the attack needs two deliberate pieces: a module that replaces `Date`, committed or
  written at run time, and `NODE_OPTIONS` pointing at it. A preload can run any code
  inside the checker, so this is the same as editing the checker, not a benign-looking
  setting. That is what separates it from round 1's date override, where a one-line
  value a reviewer would read as configuration moved the gate. It is the same kind as
  GAP-08's N7 (a fake `date` reached through `PATH` that defeated its cap), which
  GAP-08 accepted as a follow-up for GAP-21. The test's own stub does not leak
  (tester R2.4; my grep above). Follow-up: run the canary and check steps with
  `NODE_OPTIONS` cleared (`env -u NODE_OPTIONS node …`), recorded with GAP-08's
  `PATH`-reset item.

So no silent loosening of the kind P-6 forbids remains. The residual the developer
names (an override to a date on or before 2026-11-23) stays within the plan's bound.

### Follow-ups recorded (not exceptions; no `docs/deferred-items.md` entry)

- Tester Minors 1, 2, 3, 5 (round 1), as accepted in round 1.
- Tester Minor 6: a third canary with good reports and a date past the cap (GAP-21).
- Tester Minor 7: clear `NODE_OPTIONS` on the canary and check steps (GAP-21, with
  GAP-08's `PATH` reset).
- **New item, the YAML reader:** `.github/security/workflow-yaml.mjs` drops the first
  line of every block scalar and swallows the next key after a one-line block, and
  cannot parse the whole `ci.yml`. Its own change with failing tests first (GAP-21
  candidate). Fixing it lets T20 parse all of `ci.yml` (Minors 1 and 5).

### Open items

- **Commit the records.** `test-report.md` (rounds 1 and 2) and this file are
  uncommitted, as the coordinator instructed. The integrator commits both on
  `change/GAP-04` before the pull request is opened, so it carries its own evidence.
- **CI on the final head:** NOT RUN, nothing pushed. The job "Website — browser
  tests, default and consent builds" must print
  `browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures`,
  quoted with run id and job id. Green alone proves nothing during the report week.
  If it shows a real defect, the change is not done and does not merge with
  failures; the defect is its own item.
- **Blocking date at merge.** `BROWSER_TESTS_BLOCKING_FROM: "2026-11-12"` holds
  only for a merge on or before 2026-11-05, which is unlikely with Wave 0 open. The
  integrator moves it to merge + 7 days in this pull request before merge. The
  checker refuses anything after 2026-11-23, so a merge after 2026-11-16 is BLOCKED
  ON OWNER. If the owner grants a schedule exception, the cap constant in
  `check-report.mjs` moves with it in the same change.
- **Website npm audit red** in Security until GAP-01 (Wave 0) lands. These are the
  base's dependencies, not this change's. GAP-04 merges only after the owner
  confirms Wave 0's exit gate.
- **GAP-01 order:** whichever of GAP-01 and GAP-04 lands second must show this
  job's `0 failures` line.
- **Required status check:** the owner's settings step under GAP-03.
- **The owner's confirmation** under `AGENTS.md` before anything is pushed or merged.
  This approval is not it.

### Definition of Done

Can be ticked now: requirement and acceptance criteria stated (the CI line is the
remaining proof, named as such); standards; no prohibited constructs; no routes;
tests and regression tests (cap committed red first); rollback (revert);
documentation (`website/README.md`). Open: PR checks green on the final head with
run ids; independent code review on the pull request; review by someone other than
the author; deployment note (integrator named by the owner, after Wave 0, suites
re-run after the merge). Governance: `AGENTS.md` coverage table not applicable (not
on the base branch); `docs/deferred-items.md` not needed (no exception taken; the
Minors are follow-ups).

### Draft pull request description (head `668273d` plus the committed records; not opened)

```markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6Yc7G3x1zMCKZMuJSV3oKJ2)_

## What and why

GAP-04 (refinement plan, gap register line 68, Wave 1; test report 2026-10-27,
finding 6): the website's 29 Playwright browser tests ran in no CI job. Done when
(refinement plan line 154): "A job runs all 29 tests on every pull request with 0
failures, and blocks after its report week".

New job **"Website — browser tests, default and consent builds"** builds the
default snapshot and the consent build (`SNAPSHOT_SETTINGS_FIXTURE=consent`). It
runs the unchanged suite against each, and
`website/tools/browser-suite/check-report.mjs` reads both Playwright JSON reports
against `expected.json`. Playwright exits 0 when tests skip, so the checker decides,
not the exit code. A missing test, an unexpected skip or an unreadable report fails
at once. A failed test warns until `BROWSER_TESTS_BLOCKING_FROM` and fails from that
date. The checker refuses a date later than 2026-11-23, however it is set. A canary
of committed bad reports runs first, and each must be rejected for its own reason.

## Scope and boundaries

In scope: `.github/workflows/ci.yml` (one job appended, no other line changed),
`website/tools/browser-suite/` (checker, expectation, canary runner and reports),
`website/test/browser-suite-report.test.ts`, one paragraph in `website/README.md`,
`docs/changes/GAP-04/`.

Out of scope: `browser-tests/`, `playwright.config.ts` and `serve-built.mjs`;
dependencies and lockfiles (GAP-01); other jobs' `runs-on` (PR #38); tags and
`NODE_VERSION` (GAP-09); `continue-on-error` in section-compare and
screenshot-parity (GAP-05, O-11); GSAP/CDN integrity (GAP-11); `.github/security/`,
including the YAML reader defect listed below; branch protection (GAP-03).

## Security impact

No routes, policies, data or secrets. No dependency added. Three actions added,
pinned by SHA: checkout `11d5960a326750d5838078e36cf38b85af677262` (v4.4.0),
setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4.4.0) and upload-artifact
`ea165f8d65b6e75b540449e92b4886f43607fa02` (v4.6.2). Workflow
`permissions: contents: read`, no `pull_request_target`, no inline interpreters.
The consent tests answer every Google tag request inside the test. The Security
workflow will show the website npm-audit findings from the base until GAP-01 merges.

## Tests and evidence

- Red first: `87974b0` (27 of 27 failing, scripts absent); `2c7872d` (7 failing:
  the blocking-date cap and canary-reason cases).
- Green at `668273d`: `npx vitest run test/browser-suite-report.test.ts` 38 passed,
  exit 0; `npx vitest run` 417 passed, 31 skipped (448), exit 0;
  `npm run typecheck` 0; `npm run design:check` 0; `run-canary.mjs` 0, both
  canaries rejected; `node --test .github/security/gate.test.mjs` 62/62;
  actionlint 1.7.12 with shellcheck 0.11.0 on `ci.yml`, 0 findings.
- Real reports locally: 29 tests and 9 failures, all `gsap is not defined`,
  because `cdn.jsdelivr.net` is blocked in the dev container. With a mirrored
  CDN: `browser suite: 29 tests; … 0 failures`.
- Loosening checks:
  - Checker mutations are caught by the canary or the unit tests.
  - A blocking date of `2099-01-01` set from a step `env` or `$GITHUB_ENV` now fails
    the check step with exit 1.
  - Real Playwright runs with `.only`, `fixme`, a renamed spec, a syntax error, a
    taken port or a killed run all turn the job red, during the report week too.
- **CI (the proof):** run `<run id>`, job `<job id>`: `browser suite: 29 tests;
  default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as
  expected; 0 failures`.
- NOT RUN locally: the Studio and API suites (untouched; covered by the `studio`
  and `api` jobs), and Semgrep and gitleaks (covered by `security.yml`).

Full evidence: `docs/changes/GAP-04/implementation.md`, `test-report.md`,
`delivery-approval.md`.

## Owner decisions

Mohamed Elbadry, 2026-11-01, project thread: "Start waves 0 & 1 and update me with
each gap done", then "continue working on wave 0 & 1". No other decision is taken
or assumed. Owner action: make "Website — browser tests, default and consent
builds" a required check under GAP-03.

## Definition of Done

- [ ] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such): met in code; the 29-of-29 CI line above is still to come
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded

Nothing deploys until Phase D. The owner names the integrator who merges into
`rebuild/dotnet-platform`. The merge happens only after the owner confirms Wave 0's
exit gate. Before merge, `BROWSER_TESTS_BLOCKING_FROM` is set to merge + 7 days, no
later than 2026-11-23. The suites are re-run after the merge.

## Review findings accepted

These are follow-ups, not exceptions. Each one needs a deliberate edit to the
workflow, the checker or the runtime, in a reviewed diff:

- T20 does not see `continue-on-error` after a one-line `run: |` (YAML reader
  defect). The gate stays fail-closed.
- T20 does not catch `|| true` appended to the check step.
- T20 does not assert the `pull_request` trigger types.
- T20 needs `website-browser` to be the last job in `ci.yml`.
- Removing the date cap is caught by the `website` job's unit tests, not by this
  job's canary. A third canary is the follow-up.
- A `NODE_OPTIONS` preload can fake the checker's clock. This is the same class as
  editing the checker. The follow-up is to clear `NODE_OPTIONS` on the canary and
  check steps.
- New item: `.github/security/workflow-yaml.mjs` drops the first line of every block
  scalar and cannot parse the whole `ci.yml`. It is its own change (GAP-21
  candidate).

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (not applicable: `AGENTS.md` is not on the base branch)
- [x] `docs/deferred-items.md` updated for any exception (none taken)
- [x] Documentation updated (`website/README.md`, "Cookie consent and Tag Manager")

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
