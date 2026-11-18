# ADM-07c: implementation

Developer, 18 November 2026. Branch `change/ADM-07c`, worktree
`D:\work\DigitalHub\dh-platform-claude-adm07c`, base `2bbd586`
(`origin/rebuild/dotnet-platform`, unchanged after `git fetch`).
`plan-approval.md` ends with `Verdict: APPROVED`. This record follows its
seven developer conditions.

**The code head is `ad11c89`.** Any commit after it on this branch is docs only
(this file).

## Reading

- `docs/changes/README.md`, `AGENTS.md` (the same as `CLAUDE.md`), and `plan.md`,
  `plan-review.md` and `plan-approval.md` in `docs/changes/ADM-07c/`.
- `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
  `docs/quality/refinement-plan-2026-10-28.md`,
  `docs/quality/admin-audit-2026-10-28.md` and `.github/pull_request_template.md`
  are not on the base yet (PR #63 brings them). I read them with
  `git show origin/claude/cool-heisenberg-mh6zx9:<path>`.
- **G3-1 "Done when"** (`refinement-plan-2026-10-28.md:225`), quoted from the exit
  gate column: "A clean website build from `DigitalHubContent_Studio` with no
  patched content; each blocker reproduced before its fix and passing after it".
  This change meets the second half for ADM-07's own e2e test: it is red before the
  fix (base job `131290456896` and the probe red) and green after it (probe green
  and three studio jobs). The clean build from `DigitalHubContent_Studio` is a
  check on the whole batch, not on this change.
- **ADM-07 is a Major** in the audit: `admin-audit-2026-10-28.md:147-149` is
  `### Major` followed by "**ADM-07: a manual redirect can take over a live page or
  loop.**". The G3 rule "the end-to-end suite gets a test for each Major" covers
  this test. It keeps every assertion it had.

## What changed, mapped to plan 4.1

| File | Change | Commit |
| --- | --- | --- |
| `studio/e2e/redirects.spec.ts` | `addRedirect` keeps the POST response, then waits with `expect(dialog).toBeHidden()` after an `ok()` response or `expect(dialog).toBeVisible()` after a refusal, and returns the response. This is the plan 3.1 text exactly. The header comment gets one more sentence (plan 4.1). The four call sites and every assertion are unchanged | `ad11c89` |
| `docs/changes/ADM-07c/plan.md`, `plan-review.md`, `plan-approval.md` | Pipeline records | `3acb503` |
| `docs/changes/ADM-07c/implementation.md` | This record | the docs commit after `ad11c89` |

Condition 1 check: `git show ad11c89 --stat` gives
`studio/e2e/redirects.spec.ts | 12 ++++++++++--`, `1 file changed, 10 insertions(+), 2 deletions(-)`.
The diff contains no `waitForTimeout`, retry, skip, `test.slow`, timeout parameter
or config change. `studio/src/`, `playwright.config.ts`, other specs,
`package.json`, the lockfile and workflows are untouched (scope check below).

Condition 2: `ad11c89 ADM-07c: Wait for the Add redirect dialog to settle between creates`.
The body explains the closing dialog at step 4 and names base job `131290456896`.
It has the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Why the click is lost (the reviewer's reading of the antd source, plan 2.2)

From `plan-review.md` round 1, finding 4. I cite these lines and did not re-read them:

- `antd@6.6.5` `es/modal/style/index.js:30-31`: `pointerEvents: 'none'` on
  `.ant-modal.ant-zoom-leave .ant-modal-container`, so "Create" takes no click
  while the dialog closes.
- `@rc-component/dialog` `es/Dialog/index.js:137`: `display: 'none'` on the wrapper
  after the leave motion. The `dialog` role is on the panel inside it
  (`Content/Panel.js:113`), which is why `toBeHidden()` resolves once the motion ends.
- `theme/themes/shared/genCommonMapToken.js:13`: the leave lasts
  `motionDurationSlow`, 0.3 s.

## Red first (P-4)

Plan 5.1 and gate 1 accept that no red commit is needed on this branch, because
the failing test is already committed on the base. The red evidence:

- **Base job `131290456896`** (plan 2.3): `✘ 8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: … (1.5m)`,
  `at addRedirect (…/studio/e2e/redirects.spec.ts:28:25)` from `:79:13` (step 4),
  `1 failed`, `31 passed (4.5m)`. The plan's 2.3 table lists six red studio jobs out of six.
- **Probe red** (condition 3.1, below): deterministic, and independent of runner speed.

## Probe (condition 3, required at 1.5 s)

Branch `diag/ADM-07c-probe`, draft PR #61 "diag: ADM-07c slow-close probe (do not
merge)", from `2bbd586`. Each commit changes only `studio/e2e/redirects.spec.ts`.

### Probe red: `329ed23`, studio job `131316608615`

`329ed23` adds the style tag after `await signIn(page);`, with the base helper:
`await page.addStyleTag({ content: '[class*="-zoom-leave"],[class*="-fade-leave"]{animation-duration:1.5s !important}' });`

`gh run view --job 131316608615 --log` (exit 0), timestamps and colour codes removed:

```
✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (1.5m)
Test timeout of 90000ms exceeded.
Error: page.waitForResponse: Test timeout of 90000ms exceeded.
  > 28 |   const answered = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/redirects") && entry.request().method() === "POST");
    at addRedirect (/home/runner/work/DH-WEBSITE/DH-WEBSITE/studio/e2e/redirects.spec.ts:28:25)
    at /home/runner/work/DH-WEBSITE/DH-WEBSITE/studio/e2e/redirects.spec.ts:80:13
1 failed
31 passed (4.4m)
```

`:80` is step 4 in `329ed23`, one line lower than the base's `:79` because of the
style tag. `git show 329ed23:studio/e2e/redirects.spec.ts`, lines 79-80:

```
79     // 4. A redirect to the live page is created quietly, and its row is not marked.
80     expect((await addRedirect(page, `/${stamp}-ok`, `/${slug}/`)).status()).toBe(201);
```

This is the step 4 signature that condition 3 asks for.

### Probe green: `6007790`, studio job `134987431954`

I made `6007790 ADM-07c: Probe green, the fixed helper under the 1.5 s close` in a
temporary worktree (`D:\work\DigitalHub\dh-platform-claude-adm07c-probe`). I
applied `git diff 2bbd586 ad11c89 -- studio/e2e/redirects.spec.ts` onto `329ed23`.
After that, `git diff ad11c89 -- studio/e2e/redirects.spec.ts` showed only one
line, the style tag:

```
+    await page.addStyleTag({ content: '[class*="-zoom-leave"],[class*="-fade-leave"]{animation-duration:1.5s !important}' });
```

I pushed it with `git push origin diag/ADM-07c-probe`: `329ed23..6007790  diag/ADM-07c-probe -> diag/ADM-07c-probe`,
a fast-forward. Results:

- `gh api repos/mohya7/DH-WEBSITE/actions/jobs/134987431954` gives `success 600779004754d0f56bdce0be8ae8a546f68c7198`.
- `gh run view --job 134987431954 --log | grep`, with colour codes removed:

```
✓   8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (7.0s)
32 passed (2.7m)
```

There is no `N failed` line (a grep count gives 0). The unit tests in the same job
gave `Test Files 13 passed (13)`.

I removed the temporary worktree with `git worktree remove` and deleted the local
branch. The remote branch and PR #61 stay open for gate 2. Closing them afterwards
is mine to do (condition 3).

## Plan 5.3 local checks

These ran in `D:\work\DigitalHub\dh-platform-claude-adm07c\studio` at `ad11c89`, on
Windows, in Git Bash. Git Bash accepts the plan's POSIX syntax (`VAR=value cmd`),
so nothing was adapted except the path, `/d/work/DigitalHub/dh-platform-claude-adm07c`
in place of `/home/user/dh-change-adm07c`.

| # | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | `added 245 packages, and audited 247 packages in 9s`, `found 0 vulnerabilities` (run twice; the second run only captured the `added` line) |
| 2 | `git -C /d/work/DigitalHub/dh-platform-claude-adm07c diff --exit-code -- studio/package.json studio/package-lock.json` | 0 | no output (B-7) |
| 3 | `npx tsc -b` | 0 | no output |
| 4 | `npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node e2e/redirects.spec.ts` | 0 | no output |
| 5 | `ConnectionStrings__Content='Server=127.0.0.1;Database=DigitalHubContent_E2e;Integrated Security=True' npx playwright test --list e2e/redirects.spec.ts` | 0 | `redirects.spec.ts:60:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged`, `Total: 1 test in 1 file` |
| 6 | `npm test` | 0 | `Test Files  13 passed (13)`, `Tests  98 passed (98)` |
| 7 | `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 812ms`, `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` |
| 8 | `git -C /d/work/DigitalHub/dh-platform-claude-adm07c status --short` | 0 | empty (clean) |

Notes:

- **Placeholder, not a secret.** The `ConnectionStrings__Content` value in row 5
  is a placeholder. It names `DigitalHubContent_E2e`, holds no credential, and
  nothing connects to it, because `--list` runs neither `globalSetup` nor the web
  servers. It stops `readConnectionString()` (`e2e/env.ts:102-110`) from calling
  `dotnet user-secrets`. It passes `assertSafeCatalog`, which is at
  `e2e/env.ts:92-98` (review round 2, Minor R2-1; the plan's `:48-52` is the call
  site). It was not written to any file.
- **The local line number.** `--list` reports `:60:1`, but in the working tree the
  test is declared at `:45` (`grep -n '^test(' studio/e2e/redirects.spec.ts` gives
  `45:test("ADM-07 redirects: …`). CI reports `:45:1` (probe green and the studio
  jobs below). This checkout has `core.autocrlf=true`, and the file is CRLF here.
  I did not investigate further. The plan matches the test by name, and the name
  matches.
- **The 5.3 `git status --short`** expected the spec and `docs/changes/ADM-07c/` as
  uncommitted. They were already committed (`3acb503`, `ad11c89`), so it is empty.
  The scope check below covers the same point.

**End-to-end locally: NOT RUN.** Plan 5.3 makes it optional. Section 2.6 of the
plan assumed no `dotnet` and no SQL Server. On this machine, the e2e suite would
need a reset of `DigitalHubContent_E2e`, and only one agent at a time may reset a
local database. Gate 1 makes CI the evidence that counts. It is covered by the CI
job "Studio — typecheck, build, end-to-end", step "End-to-end suite", on PR #62
(three runs below) and on the probe (above).

## Condition 5: B-7 and scope

```
$ git diff --exit-code -- studio/package.json studio/package-lock.json
exit 0   (no output)

$ git diff --name-only origin/rebuild/dotnet-platform...HEAD
docs/changes/ADM-07c/plan-approval.md
docs/changes/ADM-07c/plan-review.md
docs/changes/ADM-07c/plan.md
studio/e2e/redirects.spec.ts
exit 0
```

This was run at `ad11c89`. With this file committed, the list also gains
`docs/changes/ADM-07c/implementation.md`.

## Condition 6: three studio jobs on PR #62 (head `ad11c89`)

CI run `43256690742` (`pull_request`, head `ad11c89726e63c4be8138eab157d1a9ff728911f`).
The other jobs in attempt 1 were all `success`: `api` `131316690292`, website
`131316690159`, website browser tests `131316689824` and section comparison
`131317114510`. Screenshot parity `131317112456` was `skipped`, because it is
optional and needs a label.

I reran the studio job twice, one run at a time, with
`gh run rerun 43256690742 --job <studio job id>`. Each command exited 0. After
each, I waited in a background loop on `gh run view 43256690742 --json status`
until the run completed.

| Attempt | Studio job | Conclusion (`gh api …/runs/43256690742/attempts/N/jobs`) | Started |
| --- | --- | --- | --- |
| 1 | `131316690198` | `success`, head `ad11c89726e6…` | 2026-11-12T16:15:37Z |
| 2 | `135129219803` | `success`, head `ad11c89726e6…` | 2026-11-18T21:00:30Z |
| 3 | `135131787383` | `success`, head `ad11c89726e6…` | 2026-11-18T21:04:38Z |

**A trap in the log command, reported before I worked around it.**
`gh run view --job <id> --log` returned the log of the run's *latest* attempt for
every job id. The three jobs showed identical lines with identical timestamps
(`2026-11-18T21:07:28.0729757Z … (5.1s)`). That output is not evidence for
attempts 1 and 2, and I do not use it. I read each job's own log with
`gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`
(exit 0 for each), with colour codes removed:

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

`grep -cE 'Z\s+[0-9]+ failed'` gives 0 for each of the three logs. The count is
`32 passed`, the base's count (plan 5.4). Each probe run has a single attempt. I
read both probe logs again the same way, and they match the quotes above (red:
`:28:25` from `:80:13`, `1 failed`, `31 passed (4.4m)`; green: `(7.0s)`,
`32 passed (2.7m)`, 0 `failed` lines).

## Coverage table (plan section 11)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The cause is named with evidence | Task | Done | Plan 2.2-2.4. The antd lines are above. The probe red shows the lost POST at step 4 when the close is slowed (`131316608615`, `:28:25` from `:80:13`) |
| `addRedirect` waits for the dialog to settle after each create (hidden after success, visible after refusal) | Task; 3.1 | Done | `ad11c89`, the 3.1 text exactly (diff in "What changed") |
| Only `studio/e2e/redirects.spec.ts` and `docs/changes/ADM-07c/` change; no product change | Task; 4.1 | Done | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` (condition 5) |
| No assertion weakened, no skip, no retry, no raised timeout | Task; P-6 | Done | `ad11c89` adds lines only inside `addRedirect` and the header. No call site, assertion or config changed. `playwright.config.ts` is not in the diff |
| Red shown before green: base job `131290456896` and the six-of-six table | Task; P-4; G3-1 | Done | Base job `131290456896` (plan 2.3), and probe red `131316608615` at step 4 |
| Probe red and green at 1.5 s (gate 1, condition 3) | plan-approval | Done | Red `131316608615` (`✘ … :37:1`, `:80:13`). Green `134987431954` (`✓ … :45:1 … (7.0s)`, `32 passed (2.7m)`) |
| Studio e2e suite green on the pull request, three consecutive runs, with this test passing | Task; 5.4 | Done | Run `43256690742` on `ad11c89`: studio jobs `131316690198`, `135129219803` and `135131787383`, each `success` with `✓ … redirects.spec.ts:45:1 › ADM-07 redirects: …` and `32 passed`, no `failed` line (condition 6) |
| Studio type check, unit tests and build pass; lockfile unchanged | 5.3; B-7 | Done | 5.3 rows 1-3, 6 and 7, all exit 0. `98 passed (98)`. Lockfile diff exit 0 |
| The edited spec type-checks on its own (`tsc --ignoreConfig`) and loads (`playwright test --list` with the placeholder), both exit 0 | 5.3; review round 1, finding 1 | Done | 5.3 rows 4 and 5. `Total: 1 test in 1 file` |
| `implementation.md` quotes the G3-1 "Done when" and notes ADM-07 is a Major | Review round 1, finding 3 | Done | "Reading", above |
| Other specs checked for the same pattern; none in scope | Task; 2.5 | Done | Plan 2.5 grep. No other spec changed |
| Local e2e NOT RUN, with reason and the covering CI job | P-8; 5.3 | Done | "End-to-end locally: NOT RUN", above |

## For the tester

- Compare the probe green file with the head file:
  `git diff ad11c89 6007790 -- studio/e2e/redirects.spec.ts` should show only the
  style-tag line.
- `gh pr checks 62` shows other workflows on PR #62 (CodeQL, the security gate,
  actionlint). Gate 2's G3 asks for `security.yml` and `workflow-lint.yml` on the
  final head. I did not touch them. Read their job ids on the final head.
- `change/ADM-07c` is not pushed with this docs commit. The orchestrator pushes
  after the owner confirms. A push creates a new head, so condition 6's three runs
  are on `ad11c89`. Gate 2 decides whether a docs-only head needs the runs again.

- To read a CI job's log, use
  `gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`,
  not `gh run view --job <id> --log`. For a run with several attempts, the second
  returns the latest attempt's log (see condition 6).

Status: READY FOR TEST
