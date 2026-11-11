# ADM-06b-flake: plan review

## Round 1

Reviewer: plan-reviewer, 11 November 2026. Plan reviewed: `docs/changes/ADM-06b-flake/plan.md`
at `f003e7c` on `change/ADM-06b-flake` (base `77296ba`). No earlier rounds.

All experiments ran in a copy of `studio/` in the reviewer's scratchpad
(`node_modules` and `packages/` linked to the worktree's). The worktree was not
edited: `git status --short` is empty, and `git diff --stat 77296ba HEAD` shows
only `docs/changes/ADM-06b-flake/plan.md`.

### Findings

No Blockers. No Majors.

**1. Minor: section 5.5 and section 10 should name a second latent flake in the same two tests (a timeout margin), and say it is out of scope.**
- *What is wrong:* the two Mark handled tests run close to vitest's default 5 s
  timeout when the machine is loaded. This is unrelated to the toast, and the fix
  neither causes nor cures it. The plan does not mention it, so a later CI failure
  of that kind could be blamed on this change, or this change could be blamed on it.
- *Evidence:* 12 parallel runs of the base file on 4 cores: 12 of 12 exit 1, each
  `Error: Test timed out in 5000ms.` in "marking an enquiry handled reloads the
  same page" (10 runs) and/or "after a failed page load, Mark handled reloads the
  page shown" (10 runs). None had `window is not defined`. The same load with the
  planned fix: 12 of 12 exit 1 for the same timeouts (12 and 8 runs). At 6 parallel
  runs (3 base, 3 fixed) all passed, `Tests 21 passed (21)`. In CI job
  `130455431268` these tests took 1888 ms and 2259 ms.
- *What would satisfy me:* one row in section 10 that records this as an
  observation, not fixed here (B-8: changing timeouts is its own topic), so that
  gate 2 and later readers can tell a timeout apart from this defect.

**2. Minor: section 2.5's conclusion overstates what the probe proves.**
- *What is wrong:* "So the toast's root is the only React root still updating
  when the file ends" is stronger than the probe shows. The probe deletes `window`
  inside an animation frame. So it catches every update that an animation frame
  drives. It would not catch an update driven by a `setTimeout` or by a promise
  that settles later.
- *Evidence:* the probe body in 2.5. Section 10's fourth risk row already states
  the limit correctly.
- *What would satisfy me:* reword it to "the only React root still updating on an
  animation frame". Together with the empty body after the fix and the pending
  fetch analysis in 2.4, that claim is enough.

**3. Minor: factual slips in sections 2.4, 3.2 and 10.**
- "eight screens (2.4 grep) and `AppShell`" (3.2) and "eight screens" (10). The
  grep finds static `message` in six pages (`SettingsPage`, `NavigationPage`,
  `UsersPage`, `ErrorPagesPage`, `RedirectsPage`, `ContactInboxPage`) plus
  `AppShell`, which is seven files.
- "later on the CI runner (18.76 s against 9 s locally)" (2.4) compares the CI
  run of all ten files with one local file. The comparable CI figure is
  `✓ test/listPaging.test.tsx (21 tests) 11999ms` in the same log. The argument
  still holds: in CI the toast was raised at about 10:06:16.37 and the file ended
  at 10:06:17.14, so the 3 s toast still had about 2 s to run.
- *What would satisfy me:* correct the numbers.

**4. Minor: section 5.4 can ask CI for a positive signal, not only "no error".**
- *What is wrong:* the plan rightly says a single green CI run proves nothing. But
  there is one thing the CI log can prove every time. On the base, the studio job
  log contains `stderr | test/listPaging.test.tsx > … Mark handled reloads the
  page shown` followed by `Warning: [antd: message] Static function can not consume
  context…` (1 match in job `130455431268`). That warning only appears when the
  real static toast renders. With the fix it must be gone. Locally, with
  `--silent=false`, the base gives 1 match and the fixed file gives 0.
- *What would satisfy me:* add to 5.4 that the PR's studio job log has 0 matches
  for `antd: message`. See also the gate 2 recommendation below.

**5. Minor (observation only, no change asked): the test file is not type-checked.**
`tsconfig.node.json` includes only `test/**/*.ts`, and vitest does not type-check,
so `importOriginal<typeof import("antd")>()` is never checked by a compiler. The
plan says this in 5.3. This was already true for the whole file, and fixing it is
out of scope.

### What I checked and found sound

- **Cause (rerun of the probe).** Base file plus the 2.5 probe, 3 runs: 3 of 3
  exit 1, `Tests 21 passed (21)`, `Errors 1 error`,
  `ReferenceError: window is not defined` at
  `performWorkOnRootViaSchedulerTask … react-dom-client.development.js:20644:7`,
  `Immediate.performWorkUntilDeadline … scheduler.development.js:45:48`,
  `process.processImmediate node:internal/timers:484:21`. This is the CI stack,
  frame for frame. `PROBE body after cleanup:` prints the `ant-message` holder.
  Planned fix plus the probe, 3 runs: 3 of 3 exit 0, `Tests 21 passed (21)`, and
  the probe prints an empty body. Also confirmed:
  - `useNoticeTimer.js` drives the countdown with a `raf(step)` loop that calls
    `onEventUpdate` on every frame;
  - `ContactInboxPage.tsx:100` is the only static `message` call that this file
    reaches (`RedirectsPage`'s call is in `create()`; `remove()` has none);
  - CI ran the file in 11999 ms with the two Mark handled tests at 1888 and
    2259 ms, which fits a toast still counting down when the file ends;
  - vitest names no "last test", which fits an error thrown after the file's
    last test.
- **The red is a fair red for this defect.** I applied commit 1 alone: exit 1,
  `Tests 18 failed | 3 passed (21)`, each failure
  `AssertionError: expected '<div class="ant-message ant-message-l…' to be ''`.
  The first failure is "marking an enquiry handled reloads the same page", and the
  3 tests before it pass. The guard fails on the exact node the probe finds in
  the body, which is the toast's own root. It is not some other symptom. Later
  failures cascade from the same leftover node, which is expected: the leaked root
  really does outlive every later test. The probe is the red of the symptom
  itself. Keeping the probe out of the commits is the right call, for the reason
  3.2 gives.
- **Green.** Guard plus mock plus the two spy assertions: exit 0,
  `Tests 21 passed (21)`, no `Errors` line.
- **The mock does not weaken what the tests prove.** `handle()` calls
  `message.success` and then `await load(applied, current)`. The return value is
  unused, so a spy that returns `undefined` does not change the reload path. The
  ADM-06b assertions on the page reloaded (`"2"` and `"1"`) are unchanged and
  still pass. Drawer, Table, Pagination and Modal stay real (only `message.success`
  is replaced). antd's own components import `message` by relative path, not
  through `"antd"`, so they are unaffected. `mockClear()` in `beforeEach` keeps the
  second Mark handled test from passing on the first test's call. The new
  `toHaveBeenCalledWith("Marked handled.")` assertions add coverage that did not
  exist before. If the mock were not wired to the screen's import, both the spy
  assertions and the guard would fail.
- **Other test files.** Only three files use jsdom: `listPaging.test.tsx`,
  `case-study-theme.test.tsx` and `previewUrls.test.tsx`. `previewUrls` renders
  nothing with React. `case-study-theme` renders `FormWalker` with a native
  `select`, no static `message`, and no animation. It never calls `cleanup()`, but
  nothing in it updates on a timer. `areas` and `previewCounters` run in node and
  use `renderToStaticMarkup`. So no other file has this leak, and leaving them out
  is correct (B-8). A shared setup-file guard is a separate topic, as 3.2 says.
- **Scope.** Only `studio/test/listPaging.test.tsx` and
  `docs/changes/ADM-06b-flake/` change. `studio/src/`, `RichTextEditor.tsx`,
  `api/`, `website/src/iis/`, `vitest.config.ts`, `package.json` and the lockfile
  are untouched. The lockfile check (B-7) is planned.
- **P-4 and B-6.** The red guard is committed before the fix, is named, fails
  deterministically today (checked above), and is not pushed alone. That is
  acceptable, because the red is proven locally and quoted.
- **P-6.** Nothing is skipped, retried, filtered or given a longer timeout. No
  `onUnhandledError` or `dangerouslyIgnoreUnhandledErrors` is used. The change
  removes the cause from the harness rather than hiding the error, and it adds a
  guard. That makes the file stricter: any future leak outside the root fails at
  once.
- **Alternatives (3.2)** are real ones. I agree that `message.destroy()` leaves
  the holder root in the body, and that `App.useApp()` is a product change across
  seven files.
- **Commands (5.3)** match the CI studio job (`npm ci`, `npx tsc -b`, `npm test`,
  `npm run build`). No .NET is involved, so the Release rule does not apply.
  End-to-end is correctly marked NOT RUN, and CI covers it.
- **Security, migrations, owner decisions.** None needed. No route, secret,
  dependency or database is touched. No D-NNN is needed.
- **Rollback and risks** are specific and correct, except for the gap in
  finding 1.
- **Fit.** The refinement plan and the audit have no text for this item (grep for
  `flak|unhandled` returns nothing). The task's criteria are copied exactly into
  1 and 11. This belongs to the refinement plan's "Wave 1: make CI honest".

### Is 40 green local runs plus the probe enough evidence?

Yes, for the fix, because the evidence that matters is deterministic. The
40-run loops are equal before and after (40 of 40 both times), so they prove
nothing about this defect. The plan says so itself (5.3). They are fine as a
stability check, but they should not be counted as evidence of the fix.

What is enough: the guard is red at commit 1 and green at commit 2, the probe is
red on the base and green after the fix, and both were reproduced independently
here. CI history shows why a CI count could not prove the fix either. Since
`77296ba`, the flake appeared once (job `130455431268`). The other studio
failures in the recent runs (`130356739362`, `130312770458`, `130234325372`) are
end-to-end failures with no `window is not defined`. At a rate that low, no
practical number of CI reruns would tell a fixed suite from an unfixed one.

### What gate 2 should ask for from CI

1. The PR's studio job ("Studio — typecheck, build, end-to-end") passes. Its log
   quotes `✓ test/listPaging.test.tsx (21 tests)`, `Tests 60 passed (60)`, and no
   `Unhandled Errors` block or `Errors` line.
2. The same log has 0 matches for `antd: message`. The base log has 1. This is the
   only CI-visible signal that the real static toast no longer renders in this
   file (finding 4).
3. The PR's history shows the red commit before the green one (B-6), with the
   local red summary `Tests 18 failed | 3 passed (21)` quoted in
   `implementation.md`. The tester reruns the probe, red on the base and green at
   the head, in a scratchpad copy.
4. The other workflows stay green. A rerun of PR #44's studio job after the merge
   is welcome but not required. A timeout in a Mark handled test is not this defect
   (finding 1).

Verdict: APPROVED
