# ADM-07c: plan review

## Round 1

Reviewer: plan-reviewer, 12 November 2026. Plan reviewed:
`docs/changes/ADM-07c/plan.md` (untracked, round 1) on `change/ADM-07c`, base
`2bbd586`. `origin/rebuild/dotnet-platform` is still at `2bbd586` after
`git fetch`. There are no earlier rounds.

I ran every experiment in a copy of the tree in my scratchpad
(`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/rv07c`,
made with `git archive HEAD`, then `npm ci` in `studio/`, which gave
`added 245 packages`). I did not edit the worktree: `git status --short` shows only
`?? docs/changes/ADM-07c/`.

### Findings

No Blockers. One Major.

**1. Major: section 5.3. Both local checks on the edited spec fail as written, and the fallback the plan gives also fails.**
- *What is wrong:* the plan expects exit 0 from the ad hoc `tsc` on the spec and
  from `playwright test --list`. If `tsc` fails, the developer is told to "rely on
  `playwright test --list` and CI". Both commands exit 1 in this container, on
  the base and with the 3.1 fix alike. The developer would hit two failing planned
  checks and have no local proof that the edited spec compiles or loads. Under the
  pipeline rules, a plan the developer cannot follow goes back to step 1.
- *Evidence, from the scratchpad copy:*
  - `npx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node e2e/redirects.spec.ts`
    gives exit 1 with
    `error TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline. Use '--ignoreConfig' to skip this error.`
    The cause is TypeScript `7.0.2`, from `studio/package.json:45`. The same
    command with `--ignoreConfig` added gives exit 0 on the 3.1 helper. It really
    does type-check the file: I added a deliberate `response.nope` and got
    `error TS2339: Property 'nope' does not exist on type 'Response'.`
  - `npx playwright test --list e2e/redirects.spec.ts` gives exit 1 with
    `Error: spawnSync dotnet ENOENT`. `playwright.config.ts:4` calls `e2eEnv()`
    when the module loads. `e2eEnv()` calls `readConnectionString()`
    (`e2e/env.ts:102-110`), which runs `dotnet user-secrets list` unless
    `ConnectionStrings__Content` is set, and section 2.6 itself says there is no
    `dotnet` here. With a placeholder value that names the e2e catalog and holds
    no password,
    `ConnectionStrings__Content='Server=127.0.0.1;Database=DigitalHubContent_E2e;Integrated Security=True' npx playwright test --list e2e/redirects.spec.ts`
    gives exit 0 and `Total: 1 test in 1 file`. Nothing connects to a database:
    `--list` runs neither `globalSetup` nor the web servers.
- *What would satisfy me:* in 5.3, add `--ignoreConfig` to the ad hoc `tsc`
  command, and run `--list` with a placeholder `ConnectionStrings__Content` like
  the one above. It must name `DigitalHubContent_E2e` and hold no credential. The
  plan should say it is a placeholder, so it is not mistaken for a secret. Both
  commands should expect exit 0.

**2. Minor: sections 2.3 and 5.4. The timing window and the expected test count are wrong.**
- *Timing:* the plan says "every CI run that included this test since 11:58
  failed" and "something changed between 08:50 and 11:58". At 11:58 no studio job
  ran. Attempt 1 of run `43213692554` has studio job `131167446103`, with
  `failure`, no `runner_name`, and a start and finish at
  `11:58:15Z` to `11:58:17Z`. All six red studio jobs in the 2.3 table started
  between `15:34:50Z` and `15:52Z`, which includes the base re-run, job
  `131290456896`. So the window is 08:50 to 15:34. This fits the plan's
  faster-runner explanation better than the plan's own wording does. The finding
  is still six of six.
- *Count:* 5.4 expects "`33 passed` (or the current count)". On this base the
  suite has 32 tests (`Total: 32 tests in 9 files` from `--list` in the scratchpad
  copy; job `131290456896` gave `1 failed`, `31 passed`). So the expected line is
  `32 passed`. The ADM-05 branch has 33 tests, but they are not on this base.
- *Line number:* 5.4 quotes `e2e/redirects.spec.ts:37:1`. The 3.1 helper and the
  header sentence add lines above the test, so the test moves to about `:41`
  (in my copy, with the helper lines but no comment lines, it is at `:40:1`).
- *What would satisfy me:* correct these in the change records, as was done for
  ADM-06b-flake. Gate 2 should match the test by name, not by line.

**3. Minor: section 1, Required reading. The refinement plan and the audit were available, so the G3-1 "Done when" text can be quoted.**
- *What is wrong:* the plan says neither document is on the branch, so there is
  no "Done when" text to quote. Read-only copies exist at
  `/mnt/project-files/docs/quality/`. The refinement plan's G3-1 row, which lists
  ADM-07, gives the "Done when" as "each blocker reproduced before its fix and
  passing after it". The audit classes ADM-07 as a **Major**
  (`admin-audit-2026-10-28.md:149`), so the G3 rule "the end-to-end suite gets a
  test for each Major" covers this very test. Neither document has text for a
  test-race item: a grep for `flak` and `race` finds nothing relevant.
- *Why it is only Minor:* the plan's criteria agree with that text. The test is
  red on the base and is to be green three times after the fix. Section 5.6's
  third row keeps the Major's e2e test whole.
- *What would satisfy me:* in `implementation.md`, quote the G3-1 "Done when"
  sentence and note that ADM-07 is a Major in the audit. The plan's own criteria
  can stay.

**4. Minor (strengthens the plan, no change asked): section 2.2. The "likely reason" the click sends nothing can be stated as fact.**
`antd@6.6.5` `es/modal/style/index.js:30-31` sets `pointerEvents: 'none'` on
`.ant-modal.ant-zoom-leave .ant-modal-container`, so the "Create" button cannot
receive the click while the dialog closes. After the leave motion,
`@rc-component/dialog` `es/Dialog/index.js:137` sets `display: 'none'` on the
wrapper. Playwright's click therefore waits for a hit target and then for a
visible element, until the test timeout. The leave lasts `motionDurationSlow`,
which is 0.3 s (`theme/themes/shared/genCommonMapToken.js:13`, `motionUnit` 0.1).
That fits "visible true" about 310 ms after step 3's 201 in the diagnostic log.
The same `display: 'none'` is why `toBeHidden()` on
`getByRole("dialog", { name: "Add redirect" })` resolves once the motion ends.
The role is on the panel (`Content/Panel.js:113`), inside that wrapper. The
developer may cite these lines in `implementation.md`.

### What I checked and found sound

- **Cause.** The helper at `studio/e2e/redirects.spec.ts:20-31` matches 2.1. The
  `isVisible()` snapshot at `:22` is the only branch that decides whether to
  reuse the dialog. `RedirectsPage.tsx:93-110` closes the dialog only after a
  successful POST and returns at `:97` on a failure. The Modal at `:155` has no
  `destroyOnHidden`, and a grep of `studio/src` finds `destroyOnHidden` only on
  `PreviewDrawer`. In the diagnostic log (`diag60-studio.log`), lines 1889 to 1901
  show three POSTs (400, 400, 201) and then no POST to `/api/v1/redirects` after
  `15:54:17.8167`. The failure is
  `TimeoutError: page.waitForResponse: Timeout 15000ms exceeded`, from
  `addRedirect`, called from step 4. The plan's caution about what the `[diag]`
  line does and does not prove is accurate.
- **CI history, rechecked with `gh`.** I read all six red studio jobs (`131290456896`,
  `131290462489`, `131291176641`, `131291246385`, `131296987372` and the PR #60 log).
  Each has `✘ … redirects.spec.ts:37:1 … (1.5m)`, or `:38` in the diagnostic run. The
  base job's stack is `redirects.spec.ts:28:25` from `:79:13`, as 2.3 quotes. The
  last green, `43186234140` (job `131074108492`), contains `32f0414` and shows
  `✓ 8 e2e/redirects.spec.ts:37:1 … (6.0s)`, `32 passed (3.2m)`. An earlier red on
  change/ADM-10, `43036287741`, failed on `settings.spec.ts`, and redirects passed
  there. So it does not contradict the six of six.
- **The fix is deterministic and weakens nothing.** After 3.1, the `:22` check only
  sees settled states. `toBeHidden()` cannot pass before `setOpen(false)` and the
  0.3 s motion have run. It waits under the existing 15 s `expect.timeout`
  (`playwright.config.ts:12`), which is not raised. `toBeVisible()` after a refusal
  is a true extra check. No skip, retry, sleep or timeout change (P-6). The four
  call sites and every assertion stay. I applied the 3.1 helper in the scratchpad
  copy. `tsc --ignoreConfig …` exits 0, `npx tsc -b` exits 0, `npm test` gives
  `Test Files 13 passed (13)` and `Tests 98 passed (98)`, and
  `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` exits 0.
- **Rejected alternatives (3.2)** are real ones, and the reasons are right. A product
  change (`destroyOnHidden`) is correctly excluded: the product behaves correctly.
- **Scope (B-8).** One file, `studio/e2e/redirects.spec.ts`, plus the change records.
  Open PRs are #60, #59, #58, #57 and #44. Among the remote branches, only
  `change/ADM-07` and `change/ADM-06b` (both already merged) and `diag/redirects-e2e`
  (PR #60, not to be merged) touch this spec or `RedirectsPage.tsx`. ADM-04 and
  ADM-05 do not, so no parallel change owns these files. 2.5's grep is right: no
  other spec reuses a dialog from a visibility snapshot.
- **Red first (P-4).** The failing test is already committed on the base, and it is
  red in CI six of six on exactly this step. This follows the ADM-06b-flake gate-1
  reasoning: B-6's red-commit rule is for security fixes, and this is not one. I
  accept that no new red commit is needed. Three consecutive greens on the same
  runner class that gave six of six reds is meaningful evidence. The optional probe
  (5.1) is technically plausible. The selector `[class*="-zoom-leave"]` matches
  antd's `ant-zoom-leave` motion class, and `@rc-component/dialog` sets no motion
  deadline that would cut a slowed animation short. Keeping it optional is
  reasonable. It is the tech lead's call, not the owner's.
- **CI commands (5.5)** match `ci.yml:269-276`
  (`npx playwright test --reporter=list,html,junit`). No .NET is involved, so the
  Release rule does not apply. Local e2e is correctly NOT RUN, with the reason and
  the covering CI job. The optional local repeat uses 42xx ports and
  `DigitalHubContent_E2e` only.
- **Quality gates.** No gate, guard, baseline or config changes, and no new gate,
  so no report week or canary is needed.
- **Security, migrations, databases.** No route, policy, secret, dependency or
  schema change. Only `DigitalHubContent_E2e` is used. The lockfile check (B-7) is
  planned.
- **Owner decisions.** None are needed, and no D-NNN is needed. The plan says
  plainly that it has the owner's request only through the orchestrator's relay.
- **Rollback and risks (8, 10)** are specific. The `toBeHidden()` risk is ruled out
  by the antd source in finding 4. 4.2 correctly treats the Security and actionlint
  jobs for `2bbd586` (`131167444984`, `131167445147`) as out of scope: both show
  `failure`, no runner and 0 steps.

Round 1 verdict, superseded by Round 2: CHANGES NEEDED.

## Round 2

Reviewer: plan-reviewer, 12 November 2026. Plan reviewed: `docs/changes/ADM-07c/plan.md`,
round 2 (untracked), base `2bbd586`. I diffed round 2 against my saved copy of
round 1. The changes are in sections 1, 2.2, 2.3, 5.1, 5.3, 5.4, 5.6, 11 and 12.
Design 3.1, scope 4, security 6, rollback 8 and risks 10 are unchanged. The
worktree is untouched by me apart from this file (`git status --short`:
`?? docs/changes/ADM-07c/`).

### Round 1 findings

| # | Round 1 finding | Round 2 answer | Checked |
| --- | --- | --- | --- |
| 1 | Major: the 5.3 one-off `tsc` and `--list` exit 1 | 5.3 adds `--ignoreConfig` and a placeholder `ConnectionStrings__Content`, labelled as a placeholder. Both expect exit 0. The broken fallback is removed. There is a new coverage row | **Closed.** I re-ran the exact round-2 commands in my scratchpad copy, with the 3.1 helper applied. `npx tsc --noEmit --ignoreConfig --strict … e2e/redirects.spec.ts` gave exit 0. `ConnectionStrings__Content='Server=127.0.0.1;Database=DigitalHubContent_E2e;Integrated Security=True' npx playwright test --list e2e/redirects.spec.ts` gave exit 0 and `Total: 1 test in 1 file`. The placeholder holds no credential, and it passes `assertSafeCatalog` (`e2e/env.ts:92-98`) |
| 2 | Minor: the timing window, the count and the line number | 2.3 and 5.1 give 08:50 to 15:34, with job start times. 5.4 expects `32 passed`, matches the test by name, and explains what changes if the base changes | **Closed.** `131167446103` has `failure`, no runner and 0 steps. `131301418962` started at `15:51:56Z`, as stated |
| 3 | Minor: quote the G3-1 "Done when" and note that ADM-07 is a Major | Section 1 quotes the text, and 5.6 and 11 are updated | **Closed.** `refinement-plan-2026-10-28.md:225` and `admin-audit-2026-10-28.md:147-149` match the quotes word for word. Saying that the first half of G3-1 (the clean Studio build) concerns the batch, not this change, is reasonable |
| 4 | Observation: antd source | 2.2 now states the cause as fact and cites my line references, saying it did not re-read them | **Closed.** The citations match what I read in round 1 |

### New findings

No Blockers. No Majors.

**1. Minor (no change asked): section 5.3 cites `e2e/env.ts:48-52` for `assertSafeCatalog`.**
Those lines are where it is called. The function itself is at `e2e/env.ts:92-98`.
The claim is correct either way. The developer can use the right line in
`implementation.md`.

### What I re-checked and found sound

- Fit, design, scope (one spec file), the red-first reasoning (P-4), P-6, the
  security and database rules, owner decisions (none needed) and rollback are all
  as in Round 1. None of the round-2 edits weakens them.
- Every coverage-table row now names the check that proves it, including the two
  new rows for findings 1 and 3.

Verdict: APPROVED
