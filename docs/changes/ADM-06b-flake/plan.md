# ADM-06b-flake: plan

Change id: `ADM-06b-flake`. Branch: `change/ADM-06b-flake`, worktree
`/home/user/dh-change-adm06b-flake`, cut from `origin/rebuild/dotnet-platform`
at `77296ba` (the ADM-06b squash, PR #51). Architect, round 1, 11 November 2026.
`docs/changes/ADM-06b-flake/` had no files before this plan, so there is nothing
to answer yet (section 12).

**Outcome of the investigation.** The flake is real and its cause is found. The
inbox screen calls antd's *static* `message.success("Marked handled.")`. That
toast is drawn by a second React root that antd creates on its own, outside the
root `render()` makes, so `cleanup()` never unmounts it. For 3 seconds it redraws
on every animation frame. When vitest tears jsdom down (deleting `window`)
between one of those frames and the React task the frame scheduled, React's
first line, `schedulerEvent = window.event`, throws. The fix is in
`studio/test/listPaging.test.tsx` only.

## 1. Item

- **Closes:** the CI failure reported on PR #44 (`change/GAP-07`, "GAP-07: Audit
  the full dependency tree and expire allow-list entries"): CI job
  `130455431268` (run `43000550486`), step "Unit tests", exit 1 with
  `Tests 60 passed (60)` and `Errors 1 error`. It is a defect in a test added by
  ADM-06b (PR #51, `docs/changes/ADM-06b/`).
- **Track:** none of the four track checklists in `docs/changes/README.md` fits
  exactly. It is a follow-up to ADM-06b (G3, batch G3-1), so the G3 checklist is
  applied where it makes sense (5.5). Rules that apply: P-4 (failing test first),
  B-6 (red committed before the fix), P-6 (never weaken a test or silence an
  error), P-8 (evidence), B-8 (one topic).
- **Owner's request:** I have no owner's words for this change. The task came
  from the orchestrating agent, which relayed a report from another workstream.
  Nothing in this plan is an owner decision, and none is needed (section 9).
- **Done when:** the refinement plan and the audit have no text for this item
  (`grep -n -i "flak\|unhandled" /mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`
  returns nothing). The criterion below comes from the task:
  - the real cause is named, with evidence;
  - the fix is the smallest one, in `studio/test/` if at all possible, and does
    not weaken an assertion, skip a test, add retries or silence unhandled
    errors (P-6);
  - a deterministic red is shown before the fix and green after it, or, if none
    is possible, repeated runs are counted before and after.

### Required reading

| Document | Where read | Present |
| --- | --- | --- |
| `docs/changes/README.md` | worktree | Yes |
| `AGENTS.md` (and `CLAUDE.md`, its copy) | worktree | Yes |
| `ENGINEERING_STANDARDS.md` | not on the base; read with `git show origin/claude/cool-heisenberg-mh6zx9:ENGINEERING_STANDARDS.md` | Yes, not on the base |
| `docs/PROJECT_PROFILE.md` | not on the base; same branch, `git show` | Yes, not on the base |
| `docs/quality/refinement-plan-2026-10-28.md` | not on the base; `/mnt/project-files/docs/quality/` | Yes, not on the base |
| `docs/quality/admin-audit-2026-10-28.md` | `/mnt/project-files/docs/quality/` | Yes; no entry for this item |
| `docs/adr/0001-split-public-forms-api.md` | not needed (G2 only); `docs/adr/` does not exist on the base | n/a |
| `docs/changes/ADM-06b/plan.md` | worktree (format followed) | Yes |

## 2. Current state

### 2.1 The report, verified

| Claim | Check | Result |
| --- | --- | --- |
| PR #44's head merges `77296ba` | `git merge-base --is-ancestor 77296ba c178cb3 && echo contains` | `contains 77296ba` |
| It touches nothing in `studio/` | `git diff 77296ba c178cb3 -- studio/ \| wc -l` | `0` |
| The job and its step | `gh api repos/mohya7/DH-WEBSITE/actions/jobs/130455431268` | `"name":"Studio — typecheck, build, end-to-end","conclusion":"failure","head_sha":"c178cb3e…","run_id":43000550486` |
| The base push passed | `gh api "repos/mohya7/DH-WEBSITE/actions/runs?branch=rebuild/dotnet-platform&per_page=5"` | `{"conclusion":"success","event":"push","head_sha":"77296ba8…","id":42937585027,"name":"CI"}` |

The CI log was fetched with `gh run view --job 130455431268 -R mohya7/DH-WEBSITE --log`
(it worked through the proxy). The relevant lines, timestamps and colour codes
removed:

```
 Unhandled Errors
Vitest caught 1 unhandled error during the test run.
 Uncaught Exception
ReferenceError: window is not defined
 ❯ performWorkOnRootViaSchedulerTask node_modules/react-dom/cjs/react-dom-client.development.js:20644:7
 ❯ Immediate.performWorkUntilDeadline node_modules/scheduler/cjs/scheduler.development.js:45:48
 ❯ process.processImmediate node:internal/timers:484:21
 Test Files  10 passed (10)
      Tests  60 passed (60)
This error originated in "test/listPaging.test.tsx" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
     Errors  1 error
   Duration  18.76s (tests 71%, import 14%, environment 12%, transform 4%)
##[error]Process completed with exit code 1.
```

So the report is accurate. One detail matters: vitest does **not** print "The last
test to run before this error was …". So no test was running: the error came
after the file's last test, during or after the environment teardown.

### 2.2 Where the error is thrown

`studio/node_modules/react-dom/cjs/react-dom-client.development.js` (react-dom
19.3.0, from `npm ci`), lines 20642-20644:

```js
function performWorkOnRootViaSchedulerTask(root, didTimeout) {
  nestedUpdateScheduled = currentUpdateIsNested = !1;
  schedulerEvent = window.event;
```

The first statement of every React task the scheduler runs reads `window`. Any
React update that reaches the scheduler and runs after `window` is gone throws,
whatever the update was. The scheduler runs these tasks with Node's
`setImmediate` (the frame `Immediate.performWorkUntilDeadline`). That timer
belongs to Node, so jsdom's teardown does not clear it.

### 2.3 What vitest's jsdom teardown does

`studio/node_modules/vitest/dist/chunks/index.CK-t0WMg.js` (vitest 5.0.5), lines
1387-1393:

```js
return { teardown(global) {
    clearAddEventListenerPatch();
    clearWindowErrors();
    dom.window.close();
    delete global.jsdom;
    keys.forEach((key) => delete global[key]);
```

`keys` includes `window` (`skipKeys.forEach((k) => keys.add(k))`, line 1132).
`dom.window.close()` stops jsdom's own timers and animation frames
(`stopAllTimers`, `jsdom/lib/jsdom/browser/Window.js` 645-655), but not a Node
`setImmediate` that is already queued.

### 2.4 Which React root is still updating at the end of the file

`studio/test/listPaging.test.tsx` (21 tests; `// @vitest-environment jsdom` on
line 1) cleans up with `afterEach(() => { cleanup(); })` (lines 153-155).
`cleanup()` unmounts only the roots that `render()` made.

Of the five screens, only `ContactInboxPage` uses antd's static `message`:

```
$ grep -rn "message\.\(success\|error\|info\|warning\|open\|loading\)\|notification\.\|Modal\.confirm" studio/src
studio/src/pages/ContactInboxPage.tsx:100:    message.success("Marked handled.");
studio/src/pages/RedirectsPage.tsx:85:    message.success("Redirect created.");
(+ AppShell, SettingsPage, NavigationPage, UsersPage, ErrorPagesPage, none rendered by this file)
```

`RedirectsPage.tsx:85` is in `create()`, which no test in this file calls.
`ContactInboxPage.tsx:100` runs in `handle()` (Mark handled). Two tests click
Mark handled:

- "marking an enquiry handled reloads the same page" (lines 231-243);
- "after a failed page load, Mark handled reloads the page shown" (lines 548-563),
  the fourth-from-last test.

antd's static message renders into a React root of its own, attached to
`document.body`. vitest prints antd's own warning about it during the second of
those tests:

```
stderr | … > after a failed page load, Mark handled reloads the page shown
Warning: [antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.
```

The toast lasts 3 seconds (`antd/lib/message/useMessage.js:27`,
`DEFAULT_DURATION = 3`). Its timer
(`@rc-component/notification/lib/hooks/useNoticeTimer.js:51-66`) is a
`requestAnimationFrame` loop that calls `setPercent` on every frame until the
time is up. Every frame is a React update on the toast's root, so it is a React
task queued with `setImmediate`. `@rc-component/util/lib/raf.js:9-11` picks
`window.requestAnimationFrame`, which vitest's jsdom provides at 60 Hz
(`pretendToBeVisual = true`, `index.CK-t0WMg.js:1361`).

Local timings (`--reporter=verbose`): the last Mark handled test takes 1854 ms.
The three tests after it take 133 + 281 + 133 = 547 ms. So the toast is still
counting down, frame by frame, when the file ends: locally about 0.5 s into its
3 s, and later on the CI runner (18.76 s against 9 s locally). The body still
holds it after the last `cleanup()` (probe below):

```
PROBE body after cleanup: <div class="ant-message ant-message-list ant-message-top css-dev-only-do-not-override-oc1rc0 …
```

**The race.** Each animation frame runs as a Node timer. The frame queues a
microtask, then React's scheduler queues a `setImmediate`. If the message that
makes vitest run the teardown is handled in the same turn of the event loop
(poll phase, before the check phase runs immediates), `window` is deleted first.
Then React's task runs and throws. Most runs miss that window, which is why the
base push passed and why 40 local runs passed (2.6).

Nothing else was found to be at fault:

- **Pending fetches.** The fake `request` is a resolved promise, and every test
  awaits the text its last load shows. The last test ("media library jumps …")
  makes one page-2 call, which `afterEmptyPage` turns into `"fail"` at once
  (`paging.ts:44-48`: `lastPage(120, 48) = 3`, not below 2). With the toast
  removed, the probe finds no other root updating (2.5).
- **Product code setting state after unmount.** The screens' `setState` calls
  after `await request(...)` would be no-ops on an unmounted root in React 19.
  They do not reach the scheduler, so they cannot raise this error. None was
  found that outlives a test.
- **antd's button wave.** The probe with the toast replaced is green. The wave
  needs a visible target (`offsetParent`), which jsdom never gives, so it does
  not start.

### 2.5 Deterministic reproduction (scratchpad copy only)

All experiments ran in a copy of `studio/` in the session scratchpad, with
`node_modules` linked to the worktree's. The worktree's source and tests were
not edited (`git status --short` is empty).

**Probe.** Appended to a copy of `listPaging.test.tsx`, with `afterAll` added to
the vitest import. It does exactly what vitest's teardown does (`delete
window`), but inside an animation frame, so it always lands between a toast
frame and the React task that frame queued:

```ts
afterAll(async () => {
  console.log("PROBE body after cleanup:", document.body.innerHTML.slice(0, 300));
  const win = Object.getOwnPropertyDescriptor(globalThis, "window")!;
  await new Promise<void>((resolve) => requestAnimationFrame(() => { delete (globalThis as { window?: unknown }).window; resolve(); }));
  await new Promise((resolve) => setImmediate(resolve));
  Object.defineProperty(globalThis, "window", win);
});
```

| Variant | Runs | Result |
| --- | --- | --- |
| A minimal file: `message.success(...)`, wait 200 ms, then the probe body | 3 | 3 of 3 exit 1. `ReferenceError: window is not defined` at `performWorkOnRootViaSchedulerTask … react-dom-client.development.js:20644:7`, `Immediate.performWorkUntilDeadline … scheduler.development.js:45:48`, `process.processImmediate node:internal/timers:484:21`. This is the CI stack, frame for frame |
| The same minimal file, ending normally (no probe), with or without a final `requestAnimationFrame` | 10 + 5 | 15 of 15 exit 0 (the race is rarely hit) |
| `listPaging.test.tsx` as on the base, plus the probe | 3 | 3 of 3: `Tests 21 passed (21)`, `Errors 1 error`, `ReferenceError: window is not defined` |
| The planned fix (3.1), plus the probe | 3 | 3 of 3 exit 0, `Tests 21 passed (21)`, no error; the probe prints an empty body |

So the toast's root is the only React root still updating when the file ends,
and it is enough to produce the CI error.

### 2.6 Repeated runs of the file as it is

40 sequential runs of the unmodified file in the worktree
(`npx vitest run test/listPaging.test.tsx`, Node v22.23.4, `npm ci` from the
lockfile): **40 of 40 exit 0, and no log contains `window is not defined`** (`grep -c "exit 0"` gives `40`; `grep -l "window is not defined" base-run-*.log | wc -l` gives `0`). Local runs take about 9.5 s; the CI step took 18.76 s
for all ten files. **No natural red was seen locally**, which is why the
deterministic red in 5.1 does not depend on the race.

`npm test` on the base: `Test Files 10 passed (10)`, `Tests 60 passed (60)`,
matching the CI count.

## 3. Design

### 3.1 Approach

Test-only, in `studio/test/listPaging.test.tsx`:

1. **Guard (the regression test).** In the existing `afterEach`, after
   `cleanup()`, assert that nothing rendered outside `render()`'s own root is
   left in the document:

   ```ts
   afterEach(() => {
     cleanup();
     // Nothing rendered outside render()'s own root may outlive a test.
     expect(document.body.innerHTML).toBe("");
   });
   ```

   A toast, portal or holder that outlives `cleanup()` means a React root that
   can still update after jsdom is gone. This makes that deterministic: on the
   base it fails every test from the first Mark handled onwards (5.1).

2. **Fix.** Replace antd's static `message.success` with a spy for this file,
   keeping the rest of antd real:

   ```ts
   /*
    * antd's static message renders into a React root of its own, outside the one
    * render() makes, so cleanup() cannot unmount it. It redraws on every animation
    * frame for 3 seconds, and a redraw that lands as the file ends runs after
    * jsdom is gone ("window is not defined"). The toast is replaced by a spy.
    */
   const toast = vi.hoisted(() => ({ success: vi.fn() }));
   vi.mock("antd", async (importOriginal) => {
     const actual = await importOriginal<typeof import("antd")>();
     return { ...actual, message: { ...actual.message, success: toast.success } };
   });
   ```

   Placed after the existing `vi.mock("../src/api/http", …)` block. Then
   `toast.success.mockClear()` in `beforeEach`, and in both Mark handled tests
   (lines 242 and 562) one more assertion after the existing ones:
   `expect(toast.success).toHaveBeenCalledWith("Marked handled.");`. The tests
   checked nothing about the toast before. Now they check that the screen asks
   for it, so coverage goes up, not down.

Verified in the scratchpad copy: `Tests 21 passed (21)`, exit 0, and the probe is
green (2.5).

### 3.2 Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Use antd's `App.useApp()` message in `ContactInboxPage` (product change), so the toast lives in the screen's root and `cleanup()` unmounts it | It is what antd's warning recommends, but it is a product change across eight screens (2.4 grep) and `AppShell`. It needs an `<App>` wrapper in `main.tsx` and touches screens other workstreams may need. The defect is in the test's harness, and the task prefers a test fix. Recorded as an observation (section 10) |
| `message.destroy()` in `afterEach` | It removes the notices, but the toast's root stays mounted in `document.body`. The leave motion still uses animation frames. The guard would still fail, so the leak is only made smaller, not removed |
| Wait 3 s or more at the end of the Mark handled tests | Slower, and still timing-based: the toast's leave motion follows its countdown |
| `vi.useFakeTimers()` | Does not cover jsdom's `requestAnimationFrame` interval or React's `setImmediate` cleanly. It would change how every `waitFor` in the file behaves |
| `dangerouslyIgnoreUnhandledErrors`, `onUnhandledError` filtering, retries, `--isolate=false`, or skipping the Mark handled tests | Forbidden by P-6: they hide the error or weaken the suite |
| Mock the whole of `antd` | Pagination, Table and Drawer must stay real; the tests exist to check them |
| A global `vitest.setup.ts` with the guard for every file | Wider than the defect (B-8). Other jsdom files (`case-study-theme.test.tsx`, `previewUrls.test.tsx`) do not render the screens with toasts. Left as an observation |
| Commit the probe as a test | It deletes `window` from the global object. A committed test that edits the environment's globals is fragile, and if it ever fails half-way it breaks the rest of the file. The probe stays a scratchpad reproduction, given in full in 2.5 so the developer and tester can run it |

## 4. Scope

### Files to change

- `studio/test/listPaging.test.tsx`:
  - commit 1: the `afterEach` guard (3.1, 1);
  - commit 2: the `antd` partial mock with its comment, `toast.success.mockClear()`
    in `beforeEach`, and the two `toHaveBeenCalledWith("Marked handled.")`
    assertions (3.1, 2).
- `docs/changes/ADM-06b-flake/*`: the pipeline records.

### Files to create

None, apart from the pipeline records.

### Out of scope (left alone on purpose)

- All of `studio/src/`: no product change. In particular
  `studio/src/content/RichTextEditor.tsx` and its tests (PR #52 is open).
- `api/` (redirect and schema code) and `website/src/iis/`, which ADM-02 needs.
- `studio/test/support/pagedApi.ts` and `studio/vitest.config.ts`: correct as
  they are.
- The static `message` in other screens (2.4 grep), and moving the Studio to
  `App.useApp()` (section 10).
- The other test files: none of them renders a screen that shows a toast.
- No existing assertion, test or timeout is changed or removed.

## 5. Test plan

### 5.1 Failing test, written first (P-4, B-6)

- **Name:** the `afterEach` guard in `studio/test/listPaging.test.tsx`, "Nothing
  rendered outside render()'s own root may outlive a test".
- **Asserts:** after `cleanup()`, `document.body.innerHTML` is `""`.
- **Red, deterministic:** with commit 1 only, the scratchpad run gave exit 1 and
  18 failed, 3 passed. Every test from "marking an enquiry handled reloads the
  same page" onwards failed, all with:

  ```
  AssertionError: expected '<div class="ant-message ant-message-l…' to be '' // Object.is equality
  ```

  The three tests before the first Mark handled pass, which shows the guard does
  not fail on screens that leave nothing behind.
- **Red of the symptom itself:** the probe of 2.5 on the base gives the CI
  `ReferenceError` 3 times out of 3. The developer runs it in a scratchpad copy,
  never in the worktree, and quotes it.

### 5.2 Commit order

1. `ADM-06b-flake: Fail a paging test when a toast outlives cleanup`, with only
   the guard. Red (5.1). Do not push it alone: a failing unit test stops the
   `studio` job, and the red is already deterministic locally.
2. `ADM-06b-flake: Replace the static toast with a spy in the paging tests`.
   Green.

### 5.3 Local evidence, in this container

Setup, then confirm the lockfile is untouched (B-7):

```bash
cd /home/user/dh-change-adm06b-flake/studio
npm ci
git -C /home/user/dh-change-adm06b-flake diff --exit-code -- studio/package.json studio/package-lock.json
```

After commit 1 (red):

```bash
npx vitest run test/listPaging.test.tsx
```

Expected: exit 1, `Tests 18 failed | 3 passed (21)`, each failure the
`ant-message` assertion above. Quote the summary and one assertion message.

Probe, red and green, in a scratchpad copy of `studio/` (copy with
`tar --exclude=./node_modules`, then link `node_modules`). Take the file at the
base (red) and at commit 2 (green), append the probe of 2.5, and add `afterAll`
to the vitest import:

```bash
npx vitest run test/listPaging.test.tsx --silent=false
```

Expected: base exit 1 with the CI stack; commit 2 exit 0 and
`PROBE body after cleanup:` followed by nothing.

After commit 2 (green):

```bash
npx vitest run test/listPaging.test.tsx
for i in $(seq 1 40); do npx vitest run test/listPaging.test.tsx > /dev/null 2>&1; echo $?; done | sort | uniq -c
npm test
npx tsc -b
VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
git -C /home/user/dh-change-adm06b-flake status --short
```

Expected:

- `Tests 21 passed (21)`, exit 0.
- 40 of 40 exit 0, and no log line with `window is not defined`. Count it and
  quote it beside the base count of 2.6. In the scratchpad copy this gave
  **40 of 40 exit 0, each `Tests 21 passed (21)`, no `window is not defined`**. The loops are equal (40 of 40 before and after), so they are not evidence of the fix: the race was never hit locally. They show only that the fix is stable. The evidence is the deterministic guard and probe.
- `npm test`: `Test Files 10 passed (10)`, `Tests 60 passed (60)`, and no
  `Errors` line.
- `tsc -b` exit 0. `listPaging.test.tsx` is not in a tsconfig `include` (only
  `test/**/*.ts` is, `tsconfig.node.json:17`), so this only shows nothing else
  broke.
- `npm run build` exit 0.
- `git status --short`: only `studio/test/listPaging.test.tsx` and
  `docs/changes/ADM-06b-flake/`.

**End-to-end locally: NOT RUN.** There is no SQL Server in this container. CI job
`studio` runs it, and it is unaffected: no product or e2e file changes.

### 5.4 CI evidence on the pull request

- The `studio` job ("Studio — typecheck, build, end-to-end"): the "Unit tests"
  step passes with `Tests 60 passed (60)` and no "Unhandled Errors" block. Quote
  those lines from the run log. Then type check, build and the e2e suite pass.
- **A single green CI run does not prove the fix**, since the base push was green
  too. The proof is the deterministic red and green of the guard and the probe
  (5.3). CI green shows only that nothing else broke.
- `api`, `website`, the website browser tests, `section-compare`, `security.yml`
  and `workflow-lint.yml`: unchanged, and must stay green.
- After merge, PR #44 can re-run its `studio` job. A pass there is useful but not
  required evidence, for the same reason.

### 5.5 Track checklist (G3, applied as a follow-up of ADM-06b)

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix | No audit entry exists. The finding is the CI report on PR #44, verified in 2.1, with the cause in 2.2-2.5 |
| The regression test is committed and shown failing before the fix | Commit 1 (the guard) is red deterministically (5.1), then green at commit 2 |
| The end-to-end suite gets a test for each Major | Not a finding with a severity. No product behaviour changes, so there is no e2e test to add |
| A Minor that is not fixed becomes a D-NNN entry | Nothing is left unfixed in this change. The `App.useApp()` move is an observation, not a finding (section 10) |

## 6. Security impact

None. Only a unit test file changes. No route, policy, data, login, secret,
configuration or workflow is touched. No dependency is added: `vi.mock` and
`vi.fn` are vitest's, and `antd` 6.6.5 is already locked. `package.json` and
`package-lock.json` are checked unchanged (5.3). The product's toast is
unchanged.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. Only the test file changes. A revert brings the flake
back (a rare exit 1 in "Unit tests" with all tests passing) and removes the
guard.

## 9. Owner decisions needed

None. This changes no behaviour and asks for no exception. The fix stays inside
the test, as the task asked.

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The guard fails on a later antd change that leaves a harmless node in `document.body` | A red test that is not a leak | The guard's message shows the leftover HTML, so the cause is visible. It is a real signal anyway: anything left in the body after `cleanup()` was rendered outside the test's root |
| The partial `antd` mock is not applied to the screen's import | The toast stays real; the flake remains | The two `toHaveBeenCalledWith("Marked handled.")` assertions fail if the spy is not the screen's `message.success`. The guard fails if the real toast renders. Both were green in the scratchpad |
| Spreading the `antd` namespace drops an export the screens use | Import errors in the screens | All 21 tests render the five real screens; a missing export fails them |
| Another source of late React updates exists that the guard cannot see (a root whose container is inside the test's container) | The flake could persist | The probe (5.3) checks for any root updating on an animation frame at the end of the file: green after the fix. The 40-run loop counts before and after |
| A future test in this file calls `RedirectsPage`'s create, or another static `message` method | The same leak comes back | The guard fails at once on that test. The spy covers only `success`, so `message.error` would also trip the guard |
| **Observation, out of scope:** the Studio uses antd's static `message` on eight screens (2.4), and antd warns it cannot use the theme context | The toasts ignore the navy theme tokens in the browser, and any future screen test has the same harness hazard | Not fixed here (B-8). A possible later change moves the Studio to `App.useApp()`. Raising it as an item is the owner's or orchestrator's call |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The cause is named, with evidence | Task | Planned | |
| The fix is the smallest one, in `studio/test/` only | Task | Planned | |
| No assertion weakened, no test skipped, no retry, no unhandled error silenced | Task; P-6 | Planned | |
| The regression guard is committed and shown failing before the fix | Task; P-4; B-6; G3 checklist | Planned | |
| The probe gives the CI `ReferenceError` on the base and is green after the fix | Task | Planned | |
| Repeated runs counted before (2.6) and after (5.3) | Task | Planned | |
| `npm test` passes, 60 of 60, with no `Errors` line | CI "Unit tests" step | Planned | |
| `tsc -b` and `npm run build` pass | CI `studio` job | Planned | |
| CI `studio` green on the pull request, e2e included | CI | Planned | |
| `package.json` and `package-lock.json` unchanged | B-7 | Planned | |
| No file outside `studio/test/listPaging.test.tsx` and `docs/changes/ADM-06b-flake/` changed (not `RichTextEditor.tsx`, not `api/`, not `website/src/iis/`) | Task | Planned | |

## 12. Revision log

- **Round 1** (this plan): there were no review, approval or implementation files
  to answer.
