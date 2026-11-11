# ADM-06b-flake: test report

## Round 1

Tester, 11 November 2026. Commit tested: `4f8be59` (pushed head of
`change/ADM-06b-flake`, PR #53; `git rev-parse origin/change/ADM-06b-flake` gives
`4f8be59b2d081e4b0fe8325f3c239a8d73812a3f`). Base `77296ba`. Red commit
`238cb83`, fix `5f351d8`, records `4f8be59`.

Read: `docs/changes/ADM-06b-flake/plan.md`, `plan-review.md`, `plan-approval.md`
(tester tasks 1 to 7) and `implementation.md`.

Where: a detached worktree of my own,
`git -C /home/user/DH-WEBSITE worktree add --detach /home/user/dh-test-adm06b-flake 4f8be59`,
removed at the end. Node v22.23.4. Scratch copies and logs in
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/test-adm06b-flake/`.
The developer's worktree was not touched except to write this file. No
database, no port and no long-running process were used.

### 1. Setup and lockfile (B-7)

```
$ cd /home/user/dh-test-adm06b-flake/studio && npm ci
exit 0
found 0 vulnerabilities
$ git diff --exit-code -- studio/package.json studio/package-lock.json
exit 0            (no output)
$ git status --short
(empty, also after the build)
```

### 2. The red test was red (tester task 3)

```
$ git checkout --detach 238cb83 && npx vitest run test/listPaging.test.tsx
exit 1
⎯⎯⎯⎯⎯⎯ Failed Tests 18 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/listPaging.test.tsx > contact inbox paging > marking an enquiry handled reloads the same page
 ... (18 FAIL lines)
 Test Files  1 failed (1)
      Tests  18 failed | 3 passed (21)
AssertionError: expected '<div class="ant-message ant-message-l…' to be '' // Object.is equality   (4 distinct errors, all this one)
```

The 18 failures are every test from "marking an enquiry handled reloads the same
page" onwards; the three tests before it pass. No failure has another cause. This
is the reason the plan gives (5.1).

### 3. Green at the head (tester tasks 3 and 4)

```
$ git checkout --detach 4f8be59 && npx vitest run test/listPaging.test.tsx
exit 0
 Test Files  1 passed (1)
      Tests  21 passed (21)
(no Errors or Unhandled line)

$ npx vitest run test/listPaging.test.tsx --silent=false ; grep -c "antd: message"
exit 0
0                (base: 1, see section 4)

$ npm test
exit 0
 Test Files  10 passed (10)
      Tests  60 passed (60)
(no Errors or Unhandled line)

$ npx tsc -b
exit 0           (no output)

$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
exit 0
✓ built in 801ms
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
```

`git diff --stat 5f351d8 4f8be59` lists only `implementation.md`, so the test file
at the head is the one at the fix commit.

Stability check (not evidence of the fix, as the plan says): 10 sequential runs at
the head, `for i in $(seq 1 10); do npx vitest run test/listPaging.test.tsx …; done`:
`10 0` (10 of 10 exit 0), 10 logs with `Tests  21 passed (21)`, 0 with
`window is not defined`.

### 4. Probe of plan 2.5, red on the base and green at the head (tester task 2, G4)

I wrote the probe from plan 2.5 myself (`…/test-adm06b-flake/probe.txt`), not from
the developer's file. Two copies made with
`git archive <sha> studio packages | tar -x` into `…/test-adm06b-flake/probe-base`
(`77296ba`) and `…/probe-head` (`4f8be59`), `studio/node_modules` linked to my
worktree's. In each copy, `afterAll` was added to the vitest import on line 10 and
the probe was appended. Three runs each:

```
$ npx vitest run test/listPaging.test.tsx --silent=false
base run 1 exit 1
base run 2 exit 1
base run 3 exit 1
PROBE body after cleanup: <div class="ant-message ant-message-list ant-message-top css-dev-only-do-not-override-oc1rc0 css-var-root ant-message-css-var" style="--notification-top: 8px;"><div class="an…
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
ReferenceError: window is not defined
 ❯ performWorkOnRootViaSchedulerTask …/studio/node_modules/react-dom/cjs/react-dom-client.development.js:20644:7
 ❯ Immediate.performWorkUntilDeadline …/studio/node_modules/scheduler/cjs/scheduler.development.js:45:48
 ❯ process.processImmediate node:internal/timers:484:21
 Test Files  1 passed (1)
      Tests  21 passed (21)
     Errors  1 error

head run 1 exit 0
head run 2 exit 0
head run 3 exit 0
PROBE body after cleanup: 
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

Counts per log: `window is not defined` 1/1/1 on the base, 0/0/0 at the head;
`antd: message` 1/1/1 on the base, 0/0/0 at the head. The base stack is the CI
stack of job `130455431268`, frame for frame.

### 5. The spy assertions are not vacuous (tester task 5)

Three variants of the head, each a fresh `git archive 4f8be59` copy
(`…/test-adm06b-flake/nv-v1`, `nv-v2`, `nv-v3`), one edit each, checked with
`diff -r -q` against the worktree (only the named file differs):

| Variant | Edit | Command | Result |
| --- | --- | --- | --- |
| v1 | delete `message.success("Marked handled.");` from `src/pages/ContactInboxPage.tsx` | `npx vitest run test/listPaging.test.tsx` | exit 1, `Tests 2 failed \| 19 passed (21)`: exactly the two Mark handled tests, lines 258 and 579, `AssertionError: expected "vi.fn()" to be called with arguments: [ 'Marked handled.' ]`, `Number of calls: 0` |
| v2 | remove the `vi.mock("antd", …)` block (spy not wired; the real static toast renders) | same | exit 1, `Tests 18 failed \| 3 passed (21)`: both spy assertions fail (`Number of calls: 0`) and the guard fails (`expected '<div class="ant-message ant-message-l…' to be ''`) |
| v3 | change the screen's text to `message.success("Handled.")` | same | exit 1, `Tests 2 failed \| 19 passed (21)`: the two spy assertions, `Number of calls: 1`, wrong argument |

So the spy is the screen's `message.success` (v2), the assertions need the call
(v1) and its exact text (v3). `studio/vitest.config.ts` has no `clearMocks` or
`restoreMocks`, so the `toast.success.mockClear()` in `beforeEach` is what keeps
the second Mark handled test from passing on the first test's call.

### 6. Scope, commit order, P-6 (tester task 6)

```
$ git diff --name-only 77296ba...4f8be59
docs/changes/ADM-06b-flake/implementation.md
docs/changes/ADM-06b-flake/plan-approval.md
docs/changes/ADM-06b-flake/plan-review.md
docs/changes/ADM-06b-flake/plan.md
studio/test/listPaging.test.tsx

$ git diff --numstat 77296ba 4f8be59 -- studio/
17	0	studio/test/listPaging.test.tsx

$ git diff 77296ba 4f8be59 -- studio | grep '^-' | grep -v '^---'
(nothing; exit 1)
```

- Only lines are added; no existing assertion, test, timeout or config is changed
  or removed. `studio/src/`, `vitest.config.ts`, `support/pagedApi.ts`,
  `package.json` and the lockfile are untouched.
- `grep -n "dangerouslyIgnore\|onUnhandledError\|retry\|\.skip\|\.only\|\.todo\|timeout" studio/test/listPaging.test.tsx`
  finds nothing. `vitest.config.ts` is unchanged from the base.
- Commit order, oldest first: `238cb83` (guard, +2), `5f351d8` (mock, mockClear,
  two spy assertions, +15), `4f8be59` (records). Each has the `ADM-06b-flake:`
  prefix, an imperative subject, a body that says why, and the attribution trailer
  (`git log --format='%h %s%n%b' 77296ba..HEAD`). The diff matches plan 3.1 to
  the line.

### 7. Security

| Check | Command | Result |
| --- | --- | --- |
| npm audit, studio, full tree | `npm audit --audit-level=high` in `studio/` | exit 0, `found 0 vulnerabilities` |
| npm audit gate, studio | `RUNNER_TEMP=… sh ../.github/security/run-npm-audit.sh studio` | exit 0, `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| npm audit, website | NOT RUN locally: nothing under `website/` changed. CI `Security` job `130474397610` "npm audit (website) — High and Critical": success |
| `run-dotnet-audit.sh` | NOT RUN locally: nothing under `api/` changed, no .NET SDK needed. CI job `130474397743` "NuGet vulnerable packages (api)": success |
| Semgrep, gitleaks | NOT RUN locally: `which semgrep gitleaks` finds neither. CI `security.yml` jobs `130474397798` "Semgrep", `130474397632` "Secret scan (gitleaks, this pull request's commits)" and `130474397650` "(full history)": all success |
| Secrets in the diff | `git diff 77296ba 4f8be59 \| grep -iE "password\|secret\|token\|apikey\|connectionstring\|BEGIN .*KEY"` | only prose lines in the plan ("No route, secret, …"); no secret |
| Routes, roles, hosts, body size, error shape | n/a | no route, policy, login or permission change; only a unit test file |

### 8. CI on `4f8be59` (G1, G2, G5)

Run `43006211708` ("CI", `pull_request`): `completed`, `success`.

Studio job **`130474217053`** "Studio — typecheck, build, end-to-end",
`head_sha 4f8be59b2d081e4b0fe8325f3c239a8d73812a3f`, conclusion **success**. Every
step success: npm ci, Typecheck, Unit tests, Build, End-to-end suite. From
`gh run view --job 130474217053 -R mohya7/DH-WEBSITE --log` (colour codes removed):

```
Unit tests  ✓ test/listPaging.test.tsx (21 tests) 8367ms
Unit tests  Test Files  10 passed (10)
Unit tests       Tests  60 passed (60)
End-to-end suite   28 passed (3.1m)
```

`grep -c` on that log: `Unhandled Errors` **0**, `antd: message` **0**,
`window is not defined` 0, an `Errors  N` summary line 0. The same greps on the
failing base job `130455431268` give `antd: message` 1 and `Unhandled Errors` 1.

Other jobs in the run: `130474216590` API success, `130474217085` Website
typecheck/tests/design/snapshot success, `130474217012` Website browser tests
success, `130474678933` Section comparison success, `130474680946` Screenshot
parity skipped (optional, label-gated). Other workflows on the head: Workflow lint
`43006211605` success, Security `43006211621` success (7 of 7 jobs), CodeQL
`43006211641` skipped.

### 9. Track checklist (G3, applied as in plan 5.5)

| Item | Verified |
| --- | --- |
| The finding, its evidence and its fix | Probe rerun red on the base with the CI stack, green at the head (4) |
| Regression test committed and failing before the fix | `238cb83` red 18 failed / 3 passed for the plan's reason (2), green at head (3) |
| An e2e test per Major | n/a: no product behaviour change; CI e2e 28 passed (8) |
| An unfixed Minor becomes a D-NNN | n/a: nothing in scope left unfixed; review Minor 1 recorded in `implementation.md` 5.1 |

### 10. Beyond the plan

- Wrong toast text (v3) and a missing call (v1) are both caught, and the spy is
  reached through the screen's real `antd` import (v2).
- `mockClear()` is load-bearing (no `clearMocks` in the config), and present.
- Only `message.success` is replaced: `{ ...actual.message, success: … }` keeps
  every other static method real, so a later `message.error` in this file would
  render a real toast and trip the guard, as plan section 10 says.
- No concurrency, paging-limit, size or route edge applies: no product code and
  no route changed.
- I did not repeat the reviewer's parallel-load timeout runs; that is review
  Minor 1, recorded as an observation and not this defect.

### Findings

None. No Blocker, no Major, no Minor.

### Coverage table rows verified (plan section 11)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The cause is named, with evidence | Task | Verified | Probe on `77296ba` 3 of 3 exit 1, CI stack frame for frame, `ant-message` holder left in the body (4) |
| The fix is the smallest one, in `studio/test/` only | Task | Verified | +17/-0 in `studio/test/listPaging.test.tsx` only; only `message.success` mocked (6) |
| No assertion weakened, no test skipped, no retry, no unhandled error silenced | Task; P-6 | Verified | No removed lines; no forbidden option in file or config (6); spy assertions shown non-vacuous (5) |
| The regression guard is committed and shown failing before the fix | Task; P-4; B-6; G3 | Verified | `238cb83` before `5f351d8`; `Tests 18 failed \| 3 passed (21)` (2) |
| The probe gives the CI `ReferenceError` on the base and is green after the fix | Task | Verified | 3 of 3 exit 1 on base, 3 of 3 exit 0 with empty body at head (4) |
| Repeated runs counted before and after | Task | Verified (stability only) | 10 of 10 exit 0 at head, 0 `window is not defined` (3); developer's 40 of 40 not repeated |
| `npm test` passes, 60 of 60, with no `Errors` line | CI "Unit tests" | Verified | Local exit 0 `Tests 60 passed (60)` (3); CI job `130474217053` same, 0 `Unhandled Errors` (8) |
| `tsc -b` and `npm run build` pass | CI `studio` | Verified | Both exit 0 locally (3); CI Typecheck and Build success (8) |
| CI `studio` green on the pull request, e2e included | CI | Verified | Job `130474217053` success, e2e `28 passed (3.1m)`, 0 `antd: message` (8) |
| `package.json` and `package-lock.json` unchanged | B-7 | Verified | `git diff --exit-code` exit 0 (1) |
| No file outside `studio/test/listPaging.test.tsx` and `docs/changes/ADM-06b-flake/` changed | Task | Verified | `git diff --name-only 77296ba...4f8be59` (6) |

Verdict: APPROVED
