# ADM-07c: test report

## Round 1

Tester, 18 November 2026. Commit tested: **`229fbf5`** ("ADM-07c: Implementation
record", docs only), whose code head is **`ad11c89`** ("ADM-07c: Wait for the Add
redirect dialog to settle between creates"). Base `origin/rebuild/dotnet-platform`
is `2bbd586267e94e7c713ae5b905d8f4df66d75230`, unchanged after `git fetch`.
`git ls-remote origin refs/heads/change/ADM-07c` gives `ad11c89726e6…`, so
`229fbf5` is not pushed. PR #62 is open, draft, head `ad11c89726e63c4be8138eab157d1a9ff728911f`.

Detached checkout: `git worktree add --detach D:/work/DigitalHub/dh-platform-claude-test 229fbf5`
(exit 0, `HEAD is now at 229fbf5`), run from the developer's working copy. Removed at
the end with `git worktree remove` (exit 0) and `git worktree prune`; a dangling
`node_modules/@digitalhub/theme` junction left behind was removed with `rmdir`, and the
folder no longer exists. I edited nothing in either checkout apart from this file.

### Reading

- `docs/changes/README.md`, `AGENTS.md`, and `plan.md`, `plan-review.md`,
  `plan-approval.md` and `implementation.md` in `docs/changes/ADM-07c/`.
- `ENGINEERING_STANDARDS.md` and `.github/pull_request_template.md` are **not on the
  base** (PR #63 brings them). I read them with
  `git show origin/claude/cool-heisenberg-mh6zx9:<path>` (P-4, P-6, P-8, B-4, B-6,
  B-7, B-8, section 7, section 8, and the ten Definition of Done boxes).
  `docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md` and
  `docs/quality/admin-audit-2026-10-28.md` are on the same branch and not on the base;
  I relied on the quotes that the plan reviewer and the tech lead checked word for word
  (`refinement-plan-2026-10-28.md:225`, `admin-audit-2026-10-28.md:147-149`) and did
  not re-read them.

### 1. Diff and scope (tester task 2; conditions 1, 2 and 5)

```
$ git log --format='%h %s' origin/rebuild/dotnet-platform..HEAD
229fbf5 ADM-07c: Implementation record
ad11c89 ADM-07c: Wait for the Add redirect dialog to settle between creates
3acb503 ADM-07c: Plan

$ git diff --name-only origin/rebuild/dotnet-platform...HEAD
docs/changes/ADM-07c/implementation.md
docs/changes/ADM-07c/plan-approval.md
docs/changes/ADM-07c/plan-review.md
docs/changes/ADM-07c/plan.md
studio/e2e/redirects.spec.ts
```

`git show --stat` gives `3acb503` and `229fbf5` as docs only, and `ad11c89` as
`studio/e2e/redirects.spec.ts | 12 ++++++++++--`. The code diff
(`git diff origin/rebuild/dotnet-platform...HEAD -- studio/`) has two hunks:

- the header comment (`:7-10`) gains "Each create waits for the dialog to close (after
  a create) or stay open (after a refusal), so a step never types into a dialog that
  is still closing.";
- `addRedirect` replaces `return await answered;` with
  `const response = await answered;`, a three-line comment,
  `if (response.ok()) await expect(dialog).toBeHidden();`,
  `else await expect(dialog).toBeVisible();` and `return response;`.

That is plan 3.1's text exactly. The four call sites and every assertion are unchanged
(no other hunk).

P-6 forbidden list, on the added lines only:
`git diff origin/rebuild/dotnet-platform...HEAD -- studio/ | grep -E '^\+' | grep -nE 'waitForTimeout|retr|skip|test\.slow|timeout|setTimeout|fixme|only\('`
gives no match (grep exit 1). Files that must not change:
`git diff --exit-code origin/rebuild/dotnet-platform...HEAD -- studio/src studio/playwright.config.ts studio/package.json studio/package-lock.json .github`
exit 0. `studio/playwright.config.ts` has no `retries` key (default 0), `timeout: 90_000`,
`expect: { timeout: 15_000 }`, as on the base.

Commit `ad11c89` (B-4): imperative subject with the `ADM-07c:` prefix; the body
explains the closing dialog at step 4 and names base job `131290456896`; it has the
trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### 2. Red before green (P-4)

No red commit on the branch, as plan 5.1 and gate 1 accept. I read the base red
myself: `gh api repos/mohya7/DH-WEBSITE/actions/jobs/131290456896` gives
`failure 2bbd586267e9… run 43213692554 attempt 2 started 2026-11-12T15:34:50Z`, and
its own log (`gh api --allow-escape-sequences …/actions/jobs/131290456896/logs`, colour
codes removed):

```
2026-11-12T15:38:53.2834358Z   ✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (1.5m)
2026-11-12T15:40:42.1091739Z         at addRedirect (/home/runner/work/DH-WEBSITE/DH-WEBSITE/studio/e2e/redirects.spec.ts:28:25)
2026-11-12T15:40:42.1092367Z         at /home/runner/work/DH-WEBSITE/DH-WEBSITE/studio/e2e/redirects.spec.ts:79:13
2026-11-12T15:40:42.1102020Z   1 failed
2026-11-12T15:40:42.1103057Z   31 passed (4.5m)
```

`:79` is step 4 on the base. The deterministic red is the probe (section 4).

### 3. Plan 5.3 on the detached checkout (tester task 3)

Run in `D:/work/DigitalHub/dh-platform-claude-test/studio` at `229fbf5`, Git Bash,
Node `v24.19.0`, npm `11.17.0`.

| # | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | `added 245 packages, and audited 247 packages in 8s`, `found 0 vulnerabilities` |
| 2 | `git -C D:/work/DigitalHub/dh-platform-claude-test diff --exit-code -- studio/package.json studio/package-lock.json` | 0 | no output (B-7) |
| 3 | `npx tsc -b` | 0 | no output |
| 4 | `npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node e2e/redirects.spec.ts` | 0 | no output |
| 4a | Negative control: the same command on a scratchpad copy of the spec with `response.nope;` added before `return response;` | 1 | `e2e/redirects.spec.ts(38,12): error TS2339: Property 'nope' does not exist on type 'Response'.` (so row 4 really type-checks the file) |
| 5 | `ConnectionStrings__Content='Server=127.0.0.1;Database=DigitalHubContent_E2e;Integrated Security=True' npx playwright test --list e2e/redirects.spec.ts` | 0 | `redirects.spec.ts:60:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged`, `Total: 1 test in 1 file` |
| 5a | The same placeholder with `npx playwright test --list` (whole suite) | 0 | `Total: 32 tests in 9 files` |
| 6 | `npm test` | 0 | `Test Files  13 passed (13)`, `Tests  98 passed (98)` |
| 7 | `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 696ms`, `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| 8 | `git -C D:/work/DigitalHub/dh-platform-claude-test status --short` | 0 | empty |

**Placeholder, not a secret.** The `ConnectionStrings__Content` value in rows 5 and 5a
is a placeholder. It names `DigitalHubContent_E2e`, holds no credential, and nothing
connects to it (`--list` runs neither `globalSetup` nor the web servers). It was not
written to any file.

The local `--list` reports `:60:1` while the test is declared at `:45` (`grep -n '^test('`).
The same offset appears for every spec on this checkout (`settings.spec.ts:94:1` for a
test declared at `:73`), and CI reports `:45:1`. It is a local, pre-existing effect of
the CRLF checkout (`core.autocrlf=true`; `file` reports `with CRLF line terminators`),
not of this change. The test is matched by name, as gate 1 asks.

### 4. The probe (tester task 4; gate G1)

Branch `diag/ADM-07c-probe` (remote head `600779004754…`), PR #61, open, draft, titled
"diag: ADM-07c slow-close probe (do not merge)". `git log 2bbd586..6007790`:
`329ed23` (probe red) and `6007790` (probe green).

- `git diff 2bbd586 329ed23 -- studio/e2e/redirects.spec.ts`: one added line after
  `await signIn(page);`,
  `await page.addStyleTag({ content: '[class*="-zoom-leave"],[class*="-fade-leave"]{animation-duration:1.5s !important}' });`.
  The helper is the base helper.
- `git diff 6007790 ad11c89 -- studio/e2e/redirects.spec.ts` (exit 0): one removed
  line, the same style tag, and nothing else. **The probe green's helper and header
  are byte for byte the head's.**

Logs read per job with `gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`
(exit 0), colour codes removed. Job metadata from `gh api …/actions/jobs/<id>`.

**Probe red, job `131316608615`**: `failure`, head `329ed236932133718be0194f0e53dba70f59f7ed`,
run `43256666736` attempt 1, started `2026-11-12T16:15:29Z`.

```
2026-11-12T16:16:14.8953129Z       Tests  98 passed (98)
2026-11-12T16:19:40.6328088Z   ✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (1.5m)
2026-11-12T16:21:06.1901138Z     Test timeout of 90000ms exceeded.
2026-11-12T16:21:06.1901842Z     Error: page.waitForResponse: Test timeout of 90000ms exceeded.
2026-11-12T16:21:06.1903417Z     > 28 |   const answered = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/redirects") && entry.request().method() === "POST");
2026-11-12T16:21:06.1906187Z         at addRedirect (/home/runner/work/DH-WEBSITE/DH-WEBSITE/studio/e2e/redirects.spec.ts:28:25)
2026-11-12T16:21:06.1906753Z         at /home/runner/work/DH-WEBSITE/DH-WEBSITE/studio/e2e/redirects.spec.ts:80:13
2026-11-12T16:21:06.1915484Z   1 failed
2026-11-12T16:21:06.1916656Z   31 passed (4.4m)
```

`:80` in `329ed23` is step 4 (the base's `:79` plus the style-tag line). This is the
step 4 signature gate 1 asks for.

**Probe green, job `134987431954`**: `success`, head `600779004754d0f56bdce0be8ae8a546f68c7198`,
run `44356930911` attempt 1, started `2026-11-18T17:17:09Z`.

```
2026-11-18T17:18:14.3243739Z  Test Files  13 passed (13)
2026-11-18T17:18:14.3244647Z       Tests  98 passed (98)
2026-11-18T17:24:15.2325841Z   ✓   8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (7.0s)
2026-11-18T17:25:40.6694369Z   32 passed (2.7m)
```

`grep -cE 'Z +[0-9]+ failed'` gives 0; `grep -ciE 'flaky|retry #'` gives 0.

### 5. Three studio jobs on `ad11c89` (tester task 5; gate G2)

CI run `43256690742`, three attempts. `gh run view --job <id> --log` returns the latest
attempt's log for every job in a multi-attempt run, so I did not use it. Each log below
is that job's own, from `gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`.
The three logs differ: different line counts (4888, 4858, 4924), different checksums
(`md5` prefixes `9ed7925c0163`, `03040b6eef32`, `4feb17b84862`), first lines at
`2026-11-12T16:15:37`, `2026-11-18T21:00:30` and `2026-11-18T21:04:38`, and different
test durations.

| Attempt | Job | `gh api …/jobs/<id>` | Runner |
| --- | --- | --- | --- |
| 1 | `131316690198` | `success`, head `ad11c89726e6…`, `2026-11-12T16:15:37Z` to `16:20:21Z` | `GitHub Actions 1000001934` |
| 2 | `135129219803` | `success`, head `ad11c89726e6…`, `2026-11-18T21:00:30Z` to `21:03:55Z` | `GitHub Actions 1000001982` |
| 3 | `135131787383` | `success`, head `ad11c89726e6…`, `2026-11-18T21:04:38Z` to `21:09:28Z` | `GitHub Actions 1000001983` |

```
== 131316690198 (attempt 1)
2026-11-12T16:16:28.5827105Z       Tests  98 passed (98)
2026-11-12T16:18:19.3376161Z   ✓   8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (5.0s)
2026-11-12T16:20:17.0301866Z   32 passed (3.2m)
== 135129219803 (attempt 2)
2026-11-18T21:01:12.6921839Z       Tests  98 passed (98)
2026-11-18T21:02:32.3640651Z   ✓   8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (3.6s)
2026-11-18T21:03:50.8252387Z   32 passed (2.3m)
== 135131787383 (attempt 3)
2026-11-18T21:05:25.4359581Z       Tests  98 passed (98)
2026-11-18T21:07:28.0729805Z   ✓   8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (5.1s)
2026-11-18T21:09:24.0871780Z   32 passed (3.5m)
```

For each of the three: `grep -cE 'Z +[0-9]+ failed'` gives 0, `grep -cE 'Z +[0-9]+ skipped'`
gives 0, `grep -ciE 'flaky|retry #'` gives 0, and the ADM-07 test name appears exactly
once. `32 passed` is the base's count (`Total: 32 tests in 9 files`, row 5a).

The probe green took 7.0 s against 3.6 to 5.1 s here, which fits the 1.5 s close
being applied to two creates.

### 6. Other checks on PR #62's head (tester task 5; gate G3)

`gh pr view 62 --json statusCheckRollup` and, per attempt,
`gh api repos/mohya7/DH-WEBSITE/actions/runs/43256690742/attempts/<n>/jobs`. The jobs
other than Studio ran once, in attempt 1. Attempts 2 and 3 carry them over with new ids
but the same start time, runner and result (for example `API` `135131892681` in attempt
3 shows `2026-11-12T16:15:37Z`, `GitHub Actions 1000001933`, the attempt 1 values).

| Check | Workflow | Job that ran (attempt 1) | Result |
| --- | --- | --- | --- |
| API — Release build, migrations, integration tests | CI `43256690742` | `131316690292` | success |
| Website — typecheck, tests, design check, snapshot build | CI | `131316690159` | success |
| Website — browser tests, default and consent builds | CI | `131316689824` | success |
| Section comparison against feature/interviewer-portal | CI | `131317114510` | success |
| Screenshot parity (optional, label "screenshots") | CI | `131317112456` | skipped (needs the label; optional) |
| Security gate self-test | Security `43256691064` | `131316691435` | success |
| npm audit (website) | Security | `131316904294` | success |
| npm audit (studio) | Security | `131316904167` | success |
| NuGet vulnerable packages (api) | Security | `131316904063` | success |
| Secret scan (gitleaks, this pull request's commits) | Security | `131316904752` | success |
| Secret scan (gitleaks, full history) | Security | `131316904441` | success |
| Semgrep | Security | `131316904022` | success |
| actionlint (every workflow) | Workflow lint `43256690822` | `131316689562` | success |
| CodeQL (javascript-typescript), CodeQL (csharp) | CodeQL `43256690956` | `131316690109`, `131316690784` | success |

Every job started (runner named, steps above 0). None is NOT RUN on `ad11c89`.

**On `229fbf5`:** no CI exists, because it is not pushed. Every CI row above is NOT RUN
on `229fbf5`; the jobs that will cover it are the same CI, Security and Workflow lint
jobs on PR #62 once the orchestrator pushes. `229fbf5` changes only
`docs/changes/ADM-07c/implementation.md` (`git show --stat`).

### 7. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, Studio, full tree | `npm audit --audit-level=high` in `studio/` | 0 | `found 0 vulnerabilities` |
| npm audit, website, full tree | `npm audit --audit-level=high` in `website/` | 0 | `2 moderate severity vulnerabilities` (`fast-uri 3.0.0 - 3.1.8`, `next 16.2.0 - 16.4.4`); none High or Critical. The website is untouched by this change |
| Repository npm gate, Studio | `RUNNER_TEMP=<scratchpad>/rt sh ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Repository npm gate, website | `RUNNER_TEMP=<scratchpad>/rt sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep 1.180.0 | `RUNNER_TEMP=<scratchpad>/rt sh .github/security/run-semgrep.sh` at the repo root | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known one is `api/tests/DigitalHub.Api.Tests/AuditRollbackTests.cs:78`). No line names `studio/e2e/redirects.spec.ts` |
| gitleaks | not installed (`which gitleaks`: not found) | NOT RUN | Covered by Security jobs `131316904752` (this PR's commits) and `131316904441` (full history), both success on `ad11c89`. For the unpushed `229fbf5`, NOT RUN until the push |
| `run-dotnet-audit.sh` | not run | NOT RUN | No .NET file or package changes. Covered by Security job `131316904063`, success |
| Secrets in the diff | `git diff origin/rebuild/dotnet-platform...HEAD \| grep -E '^\+' \| grep -inE 'password\|pwd=\|secret\|token\|apikey\|api_key\|User ID\|ghp_\|github_pat\|-----BEGIN\|AccountKey'` | 0 | Only prose ("not a secret", "user-secrets", `genCommonMapToken.js`) and the existing grep line `hasText: "Change password"`. The only connection string is the labelled placeholder with `Integrated Security=True` and no credential |

Routes, role matrix, host checks, unknown fields, body size and error shape: **not
applicable**. No route, policy, login, permission or API code changes; only an
end-to-end helper does. The test still uses only `DigitalHubContent_E2e` through the
existing harness.

### 8. Beyond the plan

- **Determinism of the new waits.** `toBeHidden()` cannot pass early: when the
  response reaches the test the dialog is still open (React has not run
  `setOpen(false)`), and antd puts `display: none` on the wrapper only after the leave
  motion. After a refusal, `toBeVisible()` holds because `create()` returns without
  touching `open`. An unexpected status (409, 5xx) goes to the `toBeVisible()` branch,
  returns at once, and the caller's `.status()` assertion fails with a clear message,
  so the change cannot hide a wrong status.
- **Toast timing.** The helper now returns about 0.3 s later after each create. The
  step 3 warning toast and the step 4 "Redirect created." toast use antd's default 3 s,
  so about 2.7 s of margin is left. The probe green, with a 1.5 s close, passed both
  toast assertions.
- **The probe's style tag survives navigation.** `openArea` (`studio/e2e/helpers.ts:4-6`)
  clicks a sidebar link (client-side routing), so the tag added after `signIn` stays in
  the document.
- **Other specs.** No other spec uses an `isVisible()` snapshot to decide whether to
  reuse a dialog; plan 2.5's grep stands. The only `isVisible(` in `studio/e2e` is
  `redirects.spec.ts:24`.
- **Local end-to-end (optional in plan 5.3): attempted, did not reach the tests.**
  With no other `dotnet` or e2e `node` process running and ports 4299 and 4274 free,
  `DH_E2E_API_PORT=4299 DH_E2E_STUDIO_PORT=4274 npx playwright test e2e/redirects.spec.ts --repeat-each=20 --reporter=list`
  exited 1 in 24 s with `[WebServer] E2E Release migrations failed; the API was not started.`
  `dotnet tool restore` (exit 0) and `dotnet build src/DigitalHub.Api/DigitalHub.Api.csproj -c Release`
  (exit 0, `Build succeeded`, `0 Warning(s)`) both work, so the failure is in the
  harness's migration step on this machine. I did not dig further: doing so needs the
  elevated connection from user-secrets, and the harness is not part of this change.
  The harness's own reset ran first, so **`DigitalHubContent_E2e` is now an empty
  database**; every e2e run resets it first anyway. No other database was touched.
  CI covers the suite (section 5).

### Findings

No Blockers. No Majors. No Minors.

Observations, no change asked:

1. The probe red cannot by itself be told apart from the runner race, because the base
   is red on these runners without the slowdown. It is still a valid deterministic red:
   with a 1.5 s close, step 4 always meets a closing dialog, whatever the runner speed.
   The probe green's longer run (7.0 s against 3.6 to 5.1 s) shows the slowdown was
   applied.
2. Local `playwright test --list` line numbers are off on this CRLF Windows checkout
   for every spec (section 3). Pre-existing, not this change.
3. The local e2e harness fails at "Release migrations" on this machine (section 8).
   Pre-existing and out of scope; reported for the orchestrator.
4. `229fbf5` is not pushed. Once it is, PR #62 gets a new head. Whether that docs-only
   head needs the three studio runs again is gate 2's call (implementation.md says so).

### Coverage table (plan section 11), verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The cause is named with evidence | Task | Verified | Plan 2.2-2.4; the probe red `131316608615` loses the POST at step 4 (`:28:25` from `:80:13`) when only the close is slowed |
| `addRedirect` waits for the dialog to settle after each create (hidden after success, visible after refusal) | Task; 3.1 | Verified | Section 1: the `ad11c89` diff is plan 3.1's text exactly |
| Only `studio/e2e/redirects.spec.ts` and `docs/changes/ADM-07c/` change; no product change | Task; 4.1 | Verified | Section 1: `git diff --name-only` lists four `docs/changes/ADM-07c/` files and the spec; `git diff --exit-code` on `studio/src`, config, package files and `.github` exit 0 |
| No assertion weakened, no skip, no retry, no raised timeout | Task; P-6 | Verified | Section 1: the forbidden-pattern grep finds nothing; no call site or assertion hunk; `playwright.config.ts` unchanged, no `retries` |
| Red shown before green: base job `131290456896` and the six-of-six table | Task; P-4; G3-1; 5.1 | Verified | Section 2: `131290456896` read myself (`✘ … :37:1 (1.5m)`, `:28:25` from `:79:13`, `1 failed`). The six-of-six table is the plan's; I re-read only the base job and the probe |
| Probe red and green at 1.5 s (gate 1, condition 3; G1) | plan-approval | Verified | Section 4: red `131316608615` on `329ed23`, green `134987431954` on `6007790` (`✓ … :45:1 … (7.0s)`, `32 passed (2.7m)`, 0 `failed`); `git diff 6007790 ad11c89` differs only by the style tag |
| Studio e2e suite green on the pull request, three consecutive runs, with this test passing (G2) | Task; 5.4 | Verified on `ad11c89`; NOT RUN on `229fbf5` (not pushed; job "Studio — typecheck, build, end-to-end" on PR #62 after the push) | Section 5: `131316690198`, `135129219803`, `135131787383`, each `success`, `✓ … :45:1`, `32 passed`, no `failed` line, logs proven distinct |
| Studio type check, unit tests and build pass; lockfile unchanged | 5.3; B-7 | Verified | Section 3 rows 1-3, 6 and 7, all exit 0; `98 passed (98)`; lockfile diff exit 0 |
| The edited spec type-checks on its own (`tsc --ignoreConfig`) and loads (`playwright test --list` with the placeholder), both exit 0 | 5.3; review round 1, finding 1 | Verified | Section 3 rows 4, 4a (negative control exit 1, `TS2339`) and 5 (`Total: 1 test in 1 file`) |
| `implementation.md` quotes the G3-1 "Done when" and notes ADM-07 is a Major | Review round 1, finding 3 | Verified | `implementation.md` "Reading" quotes `refinement-plan-2026-10-28.md:225` and `admin-audit-2026-10-28.md:147-149` |
| Other specs checked for the same pattern; none in scope | Task; 2.5 | Verified | Section 8: the only `isVisible(` in `studio/e2e` is `redirects.spec.ts:24`; no other spec changed |
| Local e2e NOT RUN, with reason and the covering CI job | P-8; 5.3 | Verified | `implementation.md` records it. My own optional attempt did not reach the tests (harness migration step, section 8); covered by the Studio CI job (section 5) |
| Other suites and workflows green on the head (G3) | 5.4; gate G3 | Verified on `ad11c89`; NOT RUN on `229fbf5` (same jobs after the push) | Section 6: API `131316690292`, website `131316690159`, website browser tests `131316689824`, section comparison `131317114510`, Security run `43256691064` (seven jobs), Workflow lint `131316689562`, all success |
| Security: audits, Semgrep, secrets | Tester instructions | Verified; gitleaks NOT RUN locally | Section 7: both audits exit 0 at High, both npm gates `0 new`, Semgrep `0 new`; gitleaks covered by `131316904752` and `131316904441` |

Verdict: APPROVED
