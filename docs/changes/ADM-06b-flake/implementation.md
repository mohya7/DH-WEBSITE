# ADM-06b-flake: implementation

Developer, 11 November 2026. Plan: `docs/changes/ADM-06b-flake/plan.md` at
`f003e7c`. Review: `plan-review.md` round 1 at `79edc2f`, `Verdict: APPROVED`.
Gate 1: `plan-approval.md` at `fe052f8`, `Verdict: APPROVED`, developer
conditions 1 to 7. Worktree `/home/user/dh-change-adm06b-flake`, branch
`change/ADM-06b-flake`, base `77296ba` (`git merge-base HEAD origin/rebuild/dotnet-platform`
gives `77296ba83599c45ee35eebd9747011bbd38f1d52`). Node v22.23.4. `npm ci` had
already been run in `studio/` before this round. I pushed nothing; the
orchestrator pushes.

This is round 1. There is no `test-report.md` or `delivery-approval.md` yet, so
there are no findings to answer.

## 1. Commits

| Order | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 (red) | `238cb83` | `ADM-06b-flake: Fail a paging test when a toast outlives cleanup` | `studio/test/listPaging.test.tsx` (+2) |
| 2 (green) | `5f351d8` | `ADM-06b-flake: Replace the static toast with a spy in the paging tests` | `studio/test/listPaging.test.tsx` (+15) |
| 3 (records) | this commit | `ADM-06b-flake: Record the implementation and its evidence` | `docs/changes/ADM-06b-flake/implementation.md` |

The red commit comes before the green one (`git log --oneline origin/rebuild/dotnet-platform..HEAD`,
newest first: `5f351d8`, `238cb83`, then the three plan records). Neither is
squashed or reordered. Each commit has the `ADM-06b-flake:` prefix, an
imperative subject, a body that says why, and the attribution trailer (B-4).
Each was staged with `git add -- studio/test/listPaging.test.tsx` or the exact
record path (B-5).

## 2. What changed, mapped to the plan's Scope (section 4)

`studio/test/listPaging.test.tsx` only.

- **Commit 1, plan 3.1 (1), the guard.** In the existing `afterEach`, after
  `cleanup()`:

  ```ts
  // Nothing rendered outside render()'s own root may outlive a test.
  expect(document.body.innerHTML).toBe("");
  ```

- **Commit 2, plan 3.1 (2), the fix.**
  - After the existing `vi.mock("../src/api/http", …)` block: the plan's comment,
    `const toast = vi.hoisted(() => ({ success: vi.fn() }))`, and
    `vi.mock("antd", async (importOriginal) => …)` returning
    `{ ...actual, message: { ...actual.message, success: toast.success } }`. Only
    `message.success` is replaced. The rest of antd is real.
  - `toast.success.mockClear();` in the existing `beforeEach`.
  - `expect(toast.success).toHaveBeenCalledWith("Marked handled.");` after the
    existing assertions in "marking an enquiry handled reloads the same page"
    and in "after a failed page load, Mark handled reloads the page shown".

No existing assertion, test, timeout or config was changed or removed. Not used:
`onUnhandledError`, `dangerouslyIgnoreUnhandledErrors`, retries, skips,
`--isolate=false`. Not touched: `studio/src/`, `studio/vitest.config.ts`,
`studio/test/support/pagedApi.ts`, `studio/package.json`,
`studio/package-lock.json` (condition 1).

## 3. Commands and evidence (plan 5.3, condition 4)

All commands ran in `/home/user/dh-change-adm06b-flake/studio` unless a
scratchpad copy is named. Logs are in
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dev-adm06b-flake/`.

### 3.1 Red, at `238cb83` (guard only)

```
$ npx vitest run test/listPaging.test.tsx
exit 1
⎯⎯⎯⎯⎯⎯ Failed Tests 18 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/listPaging.test.tsx > contact inbox paging > marking an enquiry handled reloads the same page
 Test Files  1 failed (1)
      Tests  18 failed | 3 passed (21)
AssertionError: expected '<div class="ant-message ant-message-l…' to be '' // Object.is equality
```

The first failure is "marking an enquiry handled reloads the same page", the
first Mark handled test. The three tests before it pass. Vitest groups the 18
failures into 4 distinct errors (`[1/18]` to `[4/18]`), and all 4 are the
`ant-message` assertion above (`grep -c AssertionError red.log` gives 4,
`grep -c "AssertionError: expected '<div class=\"ant-message ant-message-l"`
gives 4). No failure has another cause.

### 3.2 Green, at `5f351d8`

```
$ npx vitest run test/listPaging.test.tsx
exit 0
 Test Files  1 passed (1)
      Tests  21 passed (21)

$ npx vitest run test/listPaging.test.tsx --silent=false
exit 0
$ grep -c "antd: message" green-verbose.log
0
```

There is no `Errors` line in either log. The base gives 1 `antd: message`
match with `--silent=false` (3.4, `probe-base-*.log`).

```
$ npm test
exit 0
 Test Files  10 passed (10)
      Tests  60 passed (60)
```

`grep -E "Errors|Unhandled" npmtest.log` finds nothing.

```
$ npx tsc -b
exit 0            (no output)

$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
exit 0
✓ built in 939ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
```

`tsc -b` does not check `listPaging.test.tsx` (only `test/**/*.ts` is in a
tsconfig `include`), so it shows only that nothing else broke (review Minor 5,
observation only).

### 3.3 Lockfile and scope (B-7, condition 5)

```
$ git diff --exit-code -- studio/package.json studio/package-lock.json
exit 0            (no output)

$ git status --short           (after commit 2's edits, before staging)
 M studio/test/listPaging.test.tsx

$ git diff --name-only origin/rebuild/dotnet-platform...HEAD     (at 5f351d8)
docs/changes/ADM-06b-flake/plan-approval.md
docs/changes/ADM-06b-flake/plan-review.md
docs/changes/ADM-06b-flake/plan.md
studio/test/listPaging.test.tsx
```

After commit 3 the same command also lists
`docs/changes/ADM-06b-flake/implementation.md`, and nothing else.

### 3.4 Probe of plan 2.5, red on the base and green at commit 2

Two scratchpad copies, made with `git archive 77296ba studio packages` and
`git archive 5f351d8 studio packages` into
`…/dev-adm06b-flake/probe-base/` and `…/dev-adm06b-flake/probe-fix/`, with
`studio/node_modules` linked to the worktree's. The worktree was not edited.
In each copy, `afterAll` was added to the vitest import and the probe of 2.5 was
appended verbatim (`…/dev-adm06b-flake/probe.ts`). Each copy was run 3 times:

```
$ npx vitest run test/listPaging.test.tsx --silent=false      (probe-base, 77296ba)
base run 1 exit 1
base run 2 exit 1
base run 3 exit 1
PROBE body after cleanup: <div class="ant-message ant-message-list ant-message-top css-dev-only-do-not-override-oc1rc0 css-var-root ant-message-css-var" style="--notification-top: 8px;"><div class="ant-message-list-conte…
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
ReferenceError: window is not defined
 ❯ performWorkOnRootViaSchedulerTask …/studio/node_modules/react-dom/cjs/react-dom-client.development.js:20644:7
 ❯ Immediate.performWorkUntilDeadline …/studio/node_modules/scheduler/cjs/scheduler.development.js:45:48
 ❯ process.processImmediate node:internal/timers:484:21
 Test Files  1 passed (1)
      Tests  21 passed (21)
     Errors  1 error

$ npx vitest run test/listPaging.test.tsx --silent=false      (probe-fix, 5f351d8)
fix run 1 exit 0
fix run 2 exit 0
fix run 3 exit 0
PROBE body after cleanup: 
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

`grep -c "window is not defined"`: 1 in each of the 3 base logs, 0 in each of the
3 fix logs. `grep -c "antd: message"`: 1 in each base log, 0 in each fix log.
The base stack is the CI stack of job `130455431268`, frame for frame.

### 3.5 Stability check, 40 runs at `5f351d8`

This is a **stability check, not evidence of the fix**. The base loop (plan 2.6)
was also 40 of 40, because the race is not hit locally. The evidence is 3.1,
3.2 and 3.4.

```
$ for i in $(seq 1 40); do npx vitest run test/listPaging.test.tsx > loop/run-$i.log 2>&1; echo $?; done | sort | uniq -c
     40 0
$ grep -l "Tests  21 passed (21)" loop/run-*.log | wc -l
40
$ grep -l "window is not defined" loop/run-*.log | wc -l
0
```

40 of 40 exit 0, each `Tests 21 passed (21)`, no `window is not defined`. Base
(plan 2.6): 40 of 40 exit 0, no `window is not defined`. The counts are equal.

### 3.6 Not run

- **End-to-end (Playwright): NOT RUN.** There is no SQL Server in this container.
  CI job `studio` ("Studio — typecheck, build, end-to-end") runs it. No product or
  e2e file changed.
- **.NET: NOT RUN.** Nothing under `api/` changed. CI job `api` covers it.
- **CI evidence (gate 2, G1 and G2): NOT RUN yet.** It needs the pull request's
  `studio` job.

## 4. Migrations

None.

## 5. Corrections and observations required by gate 1

### 5.1 Reviewer's Minor 1, recorded as an observation (condition 2), not fixed here

Both Mark handled tests ("marking an enquiry handled reloads the same page" and
"after a failed page load, Mark handled reloads the page shown") run close to
vitest's default 5 s test timeout when the machine is loaded. The reviewer's 12
parallel runs on 4 cores timed out (`Error: Test timed out in 5000ms.`) on the
base and on the fix alike. A `Test timed out in 5000ms` in those tests is **not
this defect** and is not fixed here: changing a timeout is its own topic (B-8).

### 5.2 Reviewer's Minors 2 and 3, corrections to the plan's text (condition 3)

The plan stays as approved. Read these corrections in place of the plan's words:

- **Plan 2.5, last paragraph** ("the toast's root is the only React root still
  updating when the file ends"). Correct wording: the probe proves that the
  toast's root is the only React root still updating **on an animation frame**
  when the file ends. The probe deletes `window` inside an animation frame, so it
  would not catch an update driven by a `setTimeout` or by a promise that settles
  later. Together with the empty body after the fix (3.4) and the pending-fetch
  analysis in plan 2.4, that is enough.
- **Plan 3.2 and section 10** ("eight screens"). Correct count: antd's static
  `message` is used in **seven files**: six pages (`SettingsPage`,
  `NavigationPage`, `UsersPage`, `ErrorPagesPage`, `RedirectsPage`,
  `ContactInboxPage`) plus `AppShell`.
- **Plan 2.4** ("18.76 s against 9 s locally"). That compared the CI run of all
  ten files with one local file. The comparable CI figure is
  `test/listPaging.test.tsx (21 tests) 11999ms` from the same log of job
  `130455431268`. The argument still holds: in CI the toast was raised at about
  10:06:16.37 and the file ended at 10:06:17.14, so the 3 s toast still had about
  2 s to run.

### 5.3 Minors 4 and 5

Minor 4 is a gate 2 requirement (G2). Locally it already holds: 0 matches for
`antd: message` at `5f351d8` (3.2), 1 on the base (3.4). Minor 5 is an
observation only, out of scope.

## 6. Track checklist (plan 5.5, G3 applied as a follow-up)

| Item | Done |
| --- | --- |
| The finding, its evidence and its fix | Cause in plan 2.2 to 2.5; probe reproduced here (3.4); fix `5f351d8` |
| The regression test committed and shown failing before the fix | Guard `238cb83`, red `Tests 18 failed \| 3 passed (21)` (3.1), green at `5f351d8` (3.2) |
| An e2e test for each Major | Not applicable: no finding with a severity, no product behaviour changes |
| An unfixed Minor becomes a D-NNN entry | Nothing in scope is left unfixed. Review Minor 1 is an observation (5.1) |

## 7. Coverage table (plan section 11)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The cause is named, with evidence | Task | Done | Plan 2.2 to 2.5; probe rerun here: base 3 of 3 exit 1 with the CI `ReferenceError` stack and the `ant-message` holder in the body (3.4) |
| The fix is the smallest one, in `studio/test/` only | Task | Done | `5f351d8`: +15 lines in `studio/test/listPaging.test.tsx`, only `message.success` mocked (2, 3.3) |
| No assertion weakened, no test skipped, no retry, no unhandled error silenced | Task; P-6 | Done | Diff `77296ba..5f351d8` adds lines only (+17, -0); none of the forbidden options used (2) |
| The regression guard is committed and shown failing before the fix | Task; P-4; B-6; G3 checklist | Done | `238cb83` before `5f351d8`; `Tests 18 failed \| 3 passed (21)`, `AssertionError: expected '<div class="ant-message ant-message-l…' to be ''` (3.1) |
| The probe gives the CI `ReferenceError` on the base and is green after the fix | Task | Done | 3 of 3 exit 1 on `77296ba`, 3 of 3 exit 0 with an empty `PROBE body after cleanup:` on `5f351d8` (3.4) |
| Repeated runs counted before (2.6) and after (5.3) | Task | Done (stability only) | Before: 40 of 40 (plan 2.6). After: 40 of 40 exit 0, each `Tests 21 passed (21)`, 0 with `window is not defined` (3.5). Not evidence of the fix |
| `npm test` passes, 60 of 60, with no `Errors` line | CI "Unit tests" step | Done locally; CI NOT RUN yet | `Test Files 10 passed (10)`, `Tests 60 passed (60)`, exit 0, no `Errors` line (3.2). CI: job `studio` on the pull request |
| `tsc -b` and `npm run build` pass | CI `studio` job | Done locally | Both exit 0 (3.2). CI: job `studio` |
| CI `studio` green on the pull request, e2e included | CI | NOT RUN | Needs the pull request; job "Studio — typecheck, build, end-to-end". E2e not runnable here (3.6) |
| `package.json` and `package-lock.json` unchanged | B-7 | Done | `git diff --exit-code -- studio/package.json studio/package-lock.json` exit 0 (3.3) |
| No file outside `studio/test/listPaging.test.tsx` and `docs/changes/ADM-06b-flake/` changed (not `RichTextEditor.tsx`, not `api/`, not `website/src/iis/`) | Task | Done | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` (3.3) |

## 8. For the tester

- The red is at `238cb83`, the green at `5f351d8`. The probe copies and logs are
  in `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dev-adm06b-flake/`,
  but gate 1 asks you to rerun the probe yourself.
- I did not do the tester's non-vacuity check (removing `message.success` from
  the screen in a copy). That is your step 5.
- Under load, a `Test timed out in 5000ms` in a Mark handled test is Minor 1
  (5.1), not this defect.

Status: READY FOR TEST
