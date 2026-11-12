# ADM-07c: plan

Change id: `ADM-07c`. Branch: `change/ADM-07c`, worktree `/home/user/dh-change-adm07c`,
cut from `origin/rebuild/dotnet-platform` at `2bbd586` ("ADM-10: Keep the default
share image when Settings is saved (#56)"). Architect, round 2, 12 November 2026.
Round 2 answers `plan-review.md` Round 1 (CHANGES NEEDED); see section 12.

**Outcome of the investigation.** The cause given in the task is confirmed. In
`studio/e2e/redirects.spec.ts`, `addRedirect` decides whether to open the "Add
redirect" dialog from a one-off `isVisible()` snapshot. After step 3's successful
create, `RedirectsPage.create()` calls `setOpen(false)` and antd's Modal starts its
close animation. Step 4 calls `addRedirect` while that animation runs, so the
snapshot says "visible", the button is not clicked, and the test fills and clicks
"Create" in a dialog that is closing. No POST is sent and `waitForResponse` times
out. The fix is in the test only: `addRedirect` waits for the dialog to settle
(hidden after a create, still open after a refusal) before it returns.

## 1. Item

- **Closes:** the `studio` CI job failure on the base branch, in "ADM-07 redirects:
  a live page and a loop are refused, a target with no page is flagged"
  (`studio/e2e/redirects.spec.ts:37`). It is a defect in a test added by ADM-07
  (PR #55, `32f0414`, `docs/changes/ADM-07/`). It makes PR #58 (ADM-04) and PR #59
  (ADM-05) red.
- **Track:** none of the four track checklists fits exactly. It is a follow-up to
  ADM-07 (G3), so the G3 checklist is applied where it makes sense (5.6), as
  ADM-06b-flake did for ADM-06b. Rules that apply: P-4 (failing test first), P-6
  (never weaken a test), P-8 (evidence), B-8 (one topic).
- **Owner's request**, as relayed by the orchestrating agent on 12 November 2026 (I
  have it only through that relay, not first-hand): "ADM-07c: fix the ADM-07
  redirects end-to-end test race (studio/e2e/redirects.spec.ts addRedirect reuses
  the Add redirect dialog while its close animation is still running, so step 4
  fills and clicks a closing dialog and no POST is sent; diagnosis from PR #60 run
  43252389805 job 131301418962)". Background, same relay: "ADM-05: publish the 404
  and 500 pages (#59) / ADM-04: change role and reactivate users (#58) / fix these".
- **Done when:** the refinement plan and the audit are not on this branch, but
  read-only copies are at `/mnt/project-files/docs/quality/`. The refinement plan's
  G3-1 row (`refinement-plan-2026-10-28.md:225`), which lists "ADM-02 and ADM-07
  redirect and schema checks", gives as its "Done when": "A clean website build
  from `DigitalHubContent_Studio` with no patched content; each blocker reproduced
  before its fix and passing after it". The audit classes ADM-07 as a **Major**
  (`admin-audit-2026-10-28.md:147-149`: "### Major" / "**ADM-07: a manual redirect
  can take over a live page or loop.**"). So the G3 rule "the end-to-end suite
  gets a test for each Major" covers the very test this change repairs. Neither
  document has text for a test race (a grep for `flak` and `race` finds nothing
  relevant). The first half of the G3-1 sentence (a clean website build from
  `DigitalHubContent_Studio`) is about the batch, not this change, which touches
  no content and no website code. The criteria for this change come from the
  task and agree with the second half:
  - the cause is named with evidence;
  - the fix is test-only, in `studio/e2e/redirects.spec.ts`; no product change;
  - no assertion weakened, no skip, no retry, no raised timeout as the fix (P-6);
  - the `studio` job's end-to-end suite is green, with this test passing.

### Required reading

| Document | Where read | Present |
| --- | --- | --- |
| `docs/changes/README.md` | worktree | Yes |
| `AGENTS.md` (and `CLAUDE.md`, its copy) | worktree | Yes |
| `ENGINEERING_STANDARDS.md` | worktree root | **Missing** on this base. Not read; nothing in this plan relies on it |
| `docs/PROJECT_PROFILE.md` | worktree | **Missing** on this base. Not read |
| `docs/quality/refinement-plan-2026-10-28.md` | not on the base (`ls docs/quality`: `No such file or directory`); read at `/mnt/project-files/docs/quality/` (round 2) | Yes, not on the base; G3-1 row quoted above |
| `docs/quality/admin-audit-2026-10-28.md` | `/mnt/project-files/docs/quality/` (round 2) | Yes; ADM-07 is a Major (`:147-149`). This change does not alter that finding's fix |
| `docs/adr/0001-split-public-forms-api.md` | not needed (G2 only); `docs/adr/` does not exist | n/a |
| `docs/changes/ADM-06b-flake/` (all six files) | worktree | Yes; its handling of red-first for a test defect is followed (5.1) |

The rule names used here (P-4, P-6, P-8, B-6, B-7, B-8) are those cited in
`docs/changes/README.md` and in the ADM-06b-flake records. I have not read their
full text, because the standards file is missing.

## 2. Current state

### 2.1 The test and the helper

`studio/e2e/redirects.spec.ts` at `2bbd586`:

```ts
20 async function addRedirect(page: Page, fromPath: string, toPath: string) {
21   const dialog = page.getByRole("dialog", { name: "Add redirect" });
22   if (!(await dialog.isVisible())) {
23     await page.getByRole("button", { name: "Add redirect", exact: true }).click();
24     await expect(dialog).toBeVisible();
25   }
26   await dialog.getByPlaceholder("/old-path").fill(fromPath);
27   await dialog.getByPlaceholder("/new-path").fill(toPath);
28   const answered = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/redirects") && entry.request().method() === "POST");
29   await dialog.getByRole("button", { name: "Create", exact: true }).click();
30   return await answered;
31 }
```

It is called four times: step 1 (`:59`, expects 400), step 2 (`:63`, 400), step 3
(`:67`, 201), step 4 (`:79`, 201). The reuse branch at `:22` is there on purpose:
after a 400 the dialog stays open, so steps 2 and 3 type into the dialog already on
screen. `Locator.isVisible()` does not wait; it reports the state at that instant.

### 2.2 The page

`studio/src/pages/RedirectsPage.tsx`:

- `:93-110` `create()`: on a failed POST it calls `setError(...)` and returns, so the
  dialog stays open (`:95-97`). On success it calls `setOpen(false)` (`:99`), clears
  both fields (`:100-101`), shows `message.warning` or `message.success`
  (`:104-108`) and reloads the list.
- `:155` `<Modal title="Add redirect" open={open} ... onOk={() => void create()} okText="Create">`,
  with no `destroyOnHidden`, so after closing the dialog stays in the DOM, hidden.
- antd is `6.6.5` and `@playwright/test` is `1.56.1` (`studio/package.json:29,35`).

Why the click sends nothing, from the antd source as the plan reviewer read it in
an `npm ci` copy (`plan-review.md` Round 1, finding 4; `studio/node_modules` is
empty in this worktree, so I cite it, not re-read it):

- `antd@6.6.5` `es/modal/style/index.js:30-31` sets `pointerEvents: 'none'` on
  `.ant-modal.ant-zoom-leave .ant-modal-container`, so "Create" cannot receive a
  click while the dialog closes.
- After the leave motion, `@rc-component/dialog` `es/Dialog/index.js:137` sets
  `display: 'none'` on the wrapper. The `dialog` role is on the panel inside it
  (`Content/Panel.js:113`).
- The leave lasts `motionDurationSlow`, 0.3 s
  (`theme/themes/shared/genCommonMapToken.js:13`).

So during those 0.3 s Playwright counts the dialog as visible (`isVisible()` is
true), and its click waits for a hit target, then for a visible element, until the
test timeout. The same `display: 'none'` is what makes `toBeHidden()` on
`getByRole("dialog", { name: "Add redirect" })` resolve once the motion ends. The
developer may cite these lines in `implementation.md`.

### 2.3 The CI evidence

Base push run for `2bbd586`, CI run `43213692554` (attempt 2), studio job
`131290456896`, `gh api repos/{owner}/{repo}/actions/jobs/131290456896`:

```
{"conclusion":"failure","head_sha":"2bbd586267e94e7c713ae5b905d8f4df66d75230","name":"Studio — typecheck, build, end-to-end","steps":["End-to-end suite"]}
```

`gh run view --job 131290456896 --log`, timestamps and colour codes removed:

```
✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged (1.5m)
Test timeout of 90000ms exceeded.
Error: page.waitForResponse: Test timeout of 90000ms exceeded.
  > 28 |   const answered = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/redirects") && entry.request().method() === "POST");
    at addRedirect (.../studio/e2e/redirects.spec.ts:28:25)
    at .../studio/e2e/redirects.spec.ts:79:13
Error: apiRequestContext.get: Target page, context or browser has been closed
1 failed
31 passed (4.5m)
```

`:79` is step 4. Unit tests in the same job: `Test Files 13 passed (13)`,
`Tests 98 passed (98)`.

Every studio job that ran this test from 15:34 on 12 November failed on it
(`gh api ".../actions/workflows/ci.yml/runs?per_page=15"`, then each run's studio
job log and `started_at`). Attempt 1 of the base run at 11:58 did not run it: its
studio job `131167446103` has `"conclusion":"failure","runner_name":"","steps":0`,
from `11:58:15Z` to `11:58:17Z`, so it never started. The six red jobs started
between `15:34:50Z` and `15:51:56Z`:

| Run | Branch | Studio job | Failed tests |
| --- | --- | --- | --- |
| 43213617726 (attempt 3) | change/ADM-05-red | 131290462489 | error-pages.spec.ts (ADM-05's intended red) and redirects.spec.ts |
| 43213692554 (attempt 2) | rebuild/dotnet-platform (push, `2bbd586`) | 131290456896 | redirects.spec.ts |
| 43249521862 | change/ADM-04 (`bf634e2`) | 131291176641 | redirects.spec.ts and users.spec.ts |
| 43249537203 | change/ADM-05 (`741d70c`) | 131291246385 | redirects.spec.ts |
| 43251155171 | change/ADM-04 (`75ec041`) | 131296987372 | redirects.spec.ts |
| 43252389805 | diag/redirects-e2e (`94f1a52`, PR #60) | 131301418962 | redirects.spec.ts |

That is six of six. The last green run of this test was `43186234140`
(change/ADM-10, `04d0e80`, 08:50 on 12 November; studio job `131074108492` shows
`✓ 8 e2e/redirects.spec.ts:37:1 … (6.0s)` and `32 passed (3.2m)`, per the plan
reviewer), and ADM-07's own runs (`43024832263`, `43027870300`) were green on
11 November. Something changed between 08:50 and 15:34. The task says it is the
move to faster runners when the repository went public; I have not verified that
cause, only the timing, which fits it (no studio job ran in between). The `users.spec.ts`
failure on `bf634e2` is ADM-04's own and is not this change's.

### 2.4 The diagnostic run (PR #60, not to be merged)

`diag/redirects-e2e` at `94f1a52` changes only `studio/e2e/redirects.spec.ts`
(`git diff 2bbd586 94f1a52 --stat`: `1 file changed, 7 insertions(+), 2 deletions(-)`):
a `console.log` after the two fills, a request logger, and 15 s timeouts on the
two `waitForResponse` calls. From
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/diag60-studio.log`:

```
15:54:16.8116 [diag] addRedirect /e2e-adm07-mwdqaa30ckzh/ -> /: dialog visible true
15:54:17.2071 HTTP POST /api/v1/redirects responded 400
15:54:17.3052 [diag] addRedirect /adm07-mwdqaa30ckzh-a -> /adm07-mwdqaa30ckzh-a/: dialog visible true
15:54:17.3460 HTTP POST /api/v1/redirects responded 400
15:54:17.4560 [diag] addRedirect /adm07-mwdqaa30ckzh-old -> /adm07-mwdqaa30ckzh-nowhere: dialog visible true
15:54:17.5083 HTTP POST /api/v1/redirects responded 201
15:54:17.6715 [diag] step 3 created; searching
15:54:17.7323 [diag] request GET http://127.0.0.1:5174/api/v1/redirects?search=adm07-mwdqaa30ckzh&page=1&pageSize=50
15:54:17.7369 [diag] search answered
15:54:17.7540 [diag] step 3 row checked
15:54:17.8167 [diag] addRedirect /adm07-mwdqaa30ckzh-ok -> /e2e-adm07-mwdqaa30ckzh/: dialog visible true
✘   8 e2e/redirects.spec.ts:38:1 › ADM-07 redirects: ... (18.2s)
TimeoutError: page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"
    at addRedirect (.../studio/e2e/redirects.spec.ts:29:25)
    at .../studio/e2e/redirects.spec.ts:84:13
```

Read with care: the `[diag]` line is printed **after** the two fills, not at the
`:22` check, so it does not by itself show which branch was taken. It does show
that the dialog was still visible about 310 ms after step 3's 201 (17.5083 to
17.8167), which fits antd's close animation still running. If the `:22` check had seen
the dialog hidden, the helper would have clicked "Add redirect", opened a fresh
dialog and sent a POST. No POST to `/api/v1/redirects` follows 17.8167 in the log,
and the request logger, which saw the search GET, saw no POST. So the reuse branch
was taken with a closing dialog. Nothing else stands between step 3 and step 4:
the search and the row check do not touch the dialog.

### 2.5 Other specs

`grep -n -E "isVisible\(|isHidden\(|toBeHidden|getByRole\(\"dialog\"|ant-modal" studio/e2e/*.ts`:

```
studio/e2e/redirects.spec.ts:21:  const dialog = page.getByRole("dialog", { name: "Add redirect" });
studio/e2e/redirects.spec.ts:22:  if (!(await dialog.isVisible())) {
studio/e2e/rich-text.spec.ts:183:  const picker = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
studio/e2e/rich-text.spec.ts:185:  await expect(picker).toBeHidden();
studio/e2e/settings.spec.ts:47:  const dialog = page.getByRole("dialog", { name: "Choose an image" });
studio/e2e/settings.spec.ts:55:  await expect(dialog).toBeHidden();
studio/e2e/studio.spec.ts:67:    await expect(pageB.getByRole("dialog", { name: "Someone else changed this item." })).toBeVisible();
studio/e2e/studio.spec.ts:79:  const uploadModal = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
studio/e2e/studio.spec.ts:94:  await page.locator(".ant-modal").filter({ hasText: "Choose an image" }).getByRole("button", { name: imageAlt }).click();
studio/e2e/verification.spec.ts:317:  const upload = page.locator(".ant-modal").filter({ hasText: "Choose an image" });
studio/e2e/verification.spec.ts:329:  await page.locator(".ant-modal").filter({ hasText: "Choose an image" }).getByRole("button", { name: alt }).click();
studio/e2e/verification.spec.ts:538:  const modal = page.locator(".ant-modal").filter({ hasText: "Change password" });
```

Only `redirects.spec.ts:22` uses an `isVisible()` snapshot to decide whether to
reuse a dialog. The others open the modal with a click, wait with `toBeVisible()`,
and act on it once (for example `verification.spec.ts:535-544`, `studio.spec.ts:78-84`).
`settings.spec.ts:55` and `rich-text.spec.ts:185` already wait with
`expect(...).toBeHidden()` on an antd 6 Modal, which shows the chosen wait works
with this antd version. They are out of scope (4.2).

### 2.6 What can run in this container

`which sqlcmd docker dotnet node npx`: only `/usr/bin/docker`, `/opt/node22/bin/node`
and `/opt/node22/bin/npx`. There is no `dotnet` and no SQL Server, and
`studio/node_modules` is empty (`npm ls antd` gives `(empty)`). The end-to-end
suite starts the API (`studio/e2e/start-api.ts`) against `DigitalHubContent_E2e`,
so it **cannot run here**. CI only runs on `pull_request` and on pushes to
`rebuild/dotnet-platform` (`.github/workflows/ci.yml:13-18`), so CI evidence comes
from this change's own pull request.

## 3. Design

### 3.1 Chosen: `addRedirect` returns only when the dialog has settled

After the POST answers, `addRedirect` waits for the state that `create()` leads
to, then returns:

```ts
async function addRedirect(page: Page, fromPath: string, toPath: string) {
  const dialog = page.getByRole("dialog", { name: "Add redirect" });
  if (!(await dialog.isVisible())) {
    await page.getByRole("button", { name: "Add redirect", exact: true }).click();
    await expect(dialog).toBeVisible();
  }
  await dialog.getByPlaceholder("/old-path").fill(fromPath);
  await dialog.getByPlaceholder("/new-path").fill(toPath);
  const answered = page.waitForResponse((entry) => entry.url().endsWith("/api/v1/redirects") && entry.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  const response = await answered;
  // create() closes the dialog after a create and keeps it open after a refusal.
  // Wait for that to finish, so the next call never types into a dialog that is
  // still fading out (ADM-07c).
  if (response.ok()) await expect(dialog).toBeHidden();
  else await expect(dialog).toBeVisible();
  return response;
}
```

Why this is deterministic:

- The `:22` check now only ever runs when the dialog is in a settled state. Before
  the first call it has never been opened (hidden). After a call it is hidden
  (success, waited for) or open (refusal, nothing closes it). Nothing outside
  `addRedirect` opens or closes it.
- `toBeHidden()` cannot pass too early. When the response event reaches the test,
  React has not yet run `setOpen(false)`, so the dialog is still visible, and the
  assertion waits (up to `expect.timeout`, 15 s, `studio/playwright.config.ts`)
  until the animation ends and the dialog is hidden.
- After a refusal, `toBeVisible()` passes at once and stays true: `create()`
  returns at `:97` without touching `open`.

It adds two checks of product behaviour (the dialog closes after a create, and
stays open after a refusal). Nothing is weakened, skipped, retried or given a
longer timeout. The callers at `:59`, `:63`, `:67` and `:79` stay as they are.

### 3.2 Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| `await expect(dialog).toBeHidden()` only after step 3, in the test body | Fixes today's sequence, but leaves the helper unsafe for any later caller. The helper owns the dialog, so it should leave it settled |
| A parameter on `addRedirect` saying "open" or "reuse", set by each caller | Also deterministic, but moves knowledge of the page's dialog rules into four call sites and changes them all. Settling inside the helper gives the same guarantee with a smaller diff. The `:22` check stays, but after 3.1 it only reads a settled state |
| Always close and reopen the dialog for each call | Changes what steps 2 and 3 test (typing into the dialog still open after a refusal is the real user flow) and needs a cancel click that is not part of the scenario |
| Raise the timeout, add `retries`, or `waitForTimeout(500)` | Forbidden by the task and by P-6. A sleep also only hides the race |
| Product change, for example `destroyOnHidden` on the Modal, or disabling the animation | The product is correct. The defect is the test's. Out of scope by the task |
| Reload the page between steps | Adds network and timing, and is slower; it does not remove the cause |

## 4. Scope

### 4.1 Files to change

| File | Change |
| --- | --- |
| `studio/e2e/redirects.spec.ts` | `addRedirect` (`:20-31`): keep the response in a variable, wait for the dialog to settle (3.1), then return it. Add a sentence to the header comment (`:7-8`) that each create waits for the dialog to close or stay open, so steps never type into a closing dialog |
| `docs/changes/ADM-07c/*` | This plan, and the later pipeline records |

Nothing else. No product file, unit test, config, lockfile or workflow changes.

### 4.2 Out of scope

- The other e2e specs in 2.5. None reuses a dialog from a visibility snapshot.
- The `finally` cleanup's `Target page, context or browser has been closed`
  error after the test timeout (2.3). It is a result of the timeout, and the e2e
  database is reset before every run. With the fix the test does not time out.
- `studio/src/pages/RedirectsPage.tsx` and the antd Modal's animation.
- `studio/playwright.config.ts` (`timeout: 90_000`, `expect: { timeout: 15_000 }`).
- `diag/redirects-e2e` (PR #60). It is not merged. Closing it is for whoever owns it.
- The `users.spec.ts` failure on PR #58's earlier commit `bf634e2`, which is ADM-04's.
- The "Security" and "Workflow lint" runs for `2bbd586` (`43213692568`,
  `43213692582`, both `failure`). Their jobs (`131167444984`, `131167445147`)
  show no steps and no runner name (`"runner_name":"","steps":[]`), so they never
  started. That is not this test. I note it for the orchestrator; it is not planned here.

## 5. Test plan

### 5.1 Red first (P-4)

**No new tests-only red commit is needed.** The failing test already exists and is
committed on the base: `2bbd586` is red in CI on exactly this test, at step 4, six
studio jobs out of six from 15:34 on 12 November (2.3), including the base push job
`131290456896`. A red commit on this branch would be identical to the base for this
file, and its CI run would only repeat that evidence. This follows ADM-06b-flake's
gate-1 reasoning (`docs/changes/ADM-06b-flake/plan-approval.md`, "Should the red
commit be pushed alone first?"): B-6's red-commit rule is for security fixes, this
is not one, and P-4 is met when the red is shown before the green. There, a guard
had to be added to get a deterministic red. Here the red is the existing test on CI,
so no new test is added.

The red evidence to quote in `implementation.md` and `test-report.md`: job
`131290456896` (base) with the lines in 2.3, and the table in 2.3.

**Optional, deterministic red (tech lead's call, not an owner decision).** The CI
red depends on runner speed. If the reviewer wants a red that does not, the
developer can open a throwaway draft pull request from a branch such as
`diag/ADM-07c-probe` (never merged) that, at the top of the test, after
`signIn`, slows antd's close animation with
`await page.addStyleTag({ content: '[class*="-zoom-leave"],[class*="-fade-leave"]{animation-duration:3s !important}' })`.
Expected: with the base `addRedirect`, step 4 times out at `waitForResponse`
(red); with the 3.1 `addRedirect`, the test passes (green), because `toBeHidden()`
waits about 3 s, well under 15 s. If the probe's red does not show the step 4
signature, the developer reports it and does not change the fix. The probe never
goes into `change/ADM-07c`. I do not make this required: it costs two CI runs, its
selectors depend on antd's class names, and the base red is already six of six.

### 5.2 Commits

One commit on `change/ADM-07c`, with the `docs/changes/ADM-07c/` records:
`ADM-07c: Wait for the Add redirect dialog to settle between creates`.

### 5.3 Local checks, in this container

```bash
cd /home/user/dh-change-adm07c/studio
npm ci
git -C /home/user/dh-change-adm07c diff --exit-code -- studio/package.json studio/package-lock.json
npx tsc -b
npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node e2e/redirects.spec.ts
# Placeholder, not a secret: it names the e2e catalog and holds no credential.
# It stops e2e/env.ts from calling `dotnet user-secrets` (no dotnet here).
ConnectionStrings__Content='Server=127.0.0.1;Database=DigitalHubContent_E2e;Integrated Security=True' npx playwright test --list e2e/redirects.spec.ts
npm test
VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
git -C /home/user/dh-change-adm07c status --short
```

Expected:

- `npm ci` exit 0 and the lockfile diff empty (B-7).
- `tsc -b` exit 0. The e2e specs are not in any tsconfig `include`
  (`tsconfig.node.json:17` has only `e2e/env.ts`), so this only shows nothing else
  broke.
- The ad hoc `tsc` type-checks the spec on its own: exit 0. `--ignoreConfig` is
  required because TypeScript `7.0.2` (`studio/package.json:45`) refuses a file
  list while a `tsconfig.json` is present (`error TS5112`). The plan reviewer
  showed it really checks the file: a deliberate `response.nope` gave
  `error TS2339: Property 'nope' does not exist on type 'Response'.`
- `playwright test --list`: exit 0 and `Total: 1 test in 1 file`, the ADM-07 test
  matched by its name ("ADM-07 redirects: a live page and a loop are refused, a
  target with no page is flagged"), not by line: the helper's new lines move it
  from `:37` to about `:41`. Without the placeholder, `playwright.config.ts:4`
  calls `e2eEnv()`, which calls `readConnectionString()` (`e2e/env.ts:102-110`),
  which runs `dotnet user-secrets list` and fails with `spawnSync dotnet ENOENT`.
  The placeholder names `DigitalHubContent_E2e` (which `assertSafeCatalog` in
  `e2e/env.ts:48-52` accepts), holds no password, and nothing connects to it:
  `--list` runs neither `globalSetup` nor the web servers. It is never written to
  any file.
- `npm test`: `Test Files 13 passed (13)`, `Tests 98 passed (98)` (the base count
  in job `131290456896`).
- Build exit 0.
- `git status --short`: only `studio/e2e/redirects.spec.ts` and `docs/changes/ADM-07c/`.

**End-to-end locally: NOT RUN.** There is no `dotnet` and no SQL Server in this
container (2.6), and the suite needs the API on `DigitalHubContent_E2e`. Covered by
CI job "Studio — typecheck, build, end-to-end", step "End-to-end suite". If a
machine with SQL Server is available, the local repeat would be, with Claude Code's
ports and the e2e database reset first:

```bash
cd studio
DH_E2E_API_PORT=4299 DH_E2E_STUDIO_PORT=4274 npx playwright test e2e/redirects.spec.ts --repeat-each=20
```

expected `20 passed`. It is optional and must use `DigitalHubContent_E2e` only.

### 5.4 CI evidence on the pull request

- Studio job "Studio — typecheck, build, end-to-end": "End-to-end suite" passes,
  with a `✓` line for `e2e/redirects.spec.ts:<line>:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged`
  and a summary of `32 passed` with no `failed` line. The base has 32 tests
  (job `131290456896`: `1 failed`, `31 passed`). The test is matched by its name;
  its line moves from `:37` to about `:41` with the new helper lines. If the branch
  is rebased onto a base with more tests (ADM-05 adds one), the count is that
  base's count, stated with the reason. Quote both lines and the job id.
- Run the studio job three times in a row on the same commit (two re-runs), and
  quote each result. Before the fix this test failed six runs out of six (2.3), so
  three greens out of three is a real change, not luck. The project already used
  "three consecutive runs" for Phase B's e2e verification (`CLAUDE.md`).
- `api`, `website`, website browser tests, `section-compare`: unchanged and must
  stay green. `security.yml` and `workflow-lint.yml`: must pass on the pull
  request; if they fail to start as on the base push (4.2), report it as NOT RUN
  with the job ids and do not fix it here.
- After merge, PR #58 and PR #59 can rebase or re-run. Their redirects test should
  then pass. That is useful but not required evidence for this change.

### 5.5 Suites, by exact command

| Suite | Command | Where |
| --- | --- | --- |
| Studio type check | `npx tsc -b` (in `studio/`) | local and CI |
| Studio unit tests | `npm test` (in `studio/`) | local and CI |
| Studio build | `VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | local and CI |
| Studio e2e | `npx playwright test --reporter=list,html,junit` | CI only (`ci.yml:271-276`) |
| API integration tests | as in the `api` job, Release | CI only; unchanged |
| Website suites | as in the `website` jobs | CI only; unchanged |

### 5.6 Track checklist (G3, applied as a follow-up of ADM-07)

| Item | How it is met |
| --- | --- |
| The finding, its evidence and its fix come from the audit | The audit (read at `/mnt/project-files/docs/quality/`) has ADM-07 as a Major; its fix is unchanged. This change repairs ADM-07's e2e test, a defect not in the audit. Evidence in 2.3-2.4 |
| The regression test is committed and shown failing before the fix | The test is committed on the base and is red in CI six of six (2.3); green after the fix is shown three times (5.4) |
| The end-to-end suite gets a test for each Major | ADM-07 is a Major, and this test is its e2e test. It is kept whole (every assertion stays), gains two dialog checks, and is made reliable |
| A Minor that is not fixed becomes a D-NNN entry | Nothing is left unfixed. The out-of-scope items in 4.2 are not findings of this change |

## 6. Security impact

None. Only an end-to-end test file changes. No route, policy, login, data, secret
or dependency changes. The test still uses only `DigitalHubContent_E2e` through the
existing harness, and its cleanup in `finally` is unchanged.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. The test goes back to its racy form; no data or schema is
involved.

## 9. Owner decisions needed

None. The fix is test-only, changes no behaviour and weakens nothing. Whether to
run the optional probe of 5.1 is a choice for the plan reviewer and tech lead, not
an owner decision.

## 10. Risks

| Risk | Effect | How it is caught |
| --- | --- | --- |
| The cause is not the closing dialog, or not only it | Step 4 still fails after the fix | CI on the pull request (5.4). The new `toBeHidden()` would then fail with a clear message at step 3, or step 4 would fail as before; either way the developer reports it and the plan goes back to step 1 |
| antd keeps the closed Modal visible to Playwright (for example `visibility` only) | `toBeHidden()` times out after step 3 | Same CI run. `settings.spec.ts:55` already passes with `toBeHidden()` on an antd 6 Modal, so this is unlikely |
| The refusal branch's `toBeVisible()` turns out wrong because the page closes the dialog on a 400 | Step 1 fails | That would be a product change in `create()`. The test would rightly catch it; today `create()` returns at `:97` without closing |
| The same race exists in another spec | Another flaky e2e test later | 2.5 shows no other spec reuses a dialog from a visibility snapshot |
| Green CI is luck on a slow runner | The fix is not proven | Three consecutive greens against six of six reds (5.4), and the optional deterministic probe (5.1) |
| The developer edits more than the helper | Scope creep | `git status --short` in 5.3 and the diff review |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| The cause is named with evidence | Task | Planned | |
| `addRedirect` waits for the dialog to settle after each create (hidden after success, visible after refusal) | Task; 3.1 | Planned | |
| Only `studio/e2e/redirects.spec.ts` and `docs/changes/ADM-07c/` change; no product change | Task; 4.1 | Planned | |
| No assertion weakened, no skip, no retry, no raised timeout | Task; P-6 | Planned | |
| Red shown before green: base job `131290456896` and the six-of-six table | Task; P-4; G3-1 "each blocker reproduced before its fix and passing after it"; 5.1 | Planned | |
| Studio e2e suite green on the pull request, three consecutive runs, with this test passing | Task; 5.4 | Planned | |
| Studio type check, unit tests and build pass; lockfile unchanged | 5.3; B-7 | Planned | |
| The edited spec type-checks on its own (`tsc --ignoreConfig`) and loads (`playwright test --list` with the placeholder), both exit 0 | 5.3; review round 1, finding 1 | Planned | |
| `implementation.md` quotes the G3-1 "Done when" and notes ADM-07 is a Major | Review round 1, finding 3 | Planned | |
| Other specs checked for the same pattern; none in scope | Task; 2.5 | Planned | |
| Local e2e NOT RUN, with reason and the covering CI job | P-8; 5.3 | Planned | |

## 12. Revision log

Round 1, 12 November 2026: first version. No `plan-review.md`, `plan-approval.md`
or `implementation.md` existed in `docs/changes/ADM-07c/`, so there are no points
to answer.

Round 2, 12 November 2026, answering `plan-review.md` Round 1 (CHANGES NEEDED):

| # | Point | Answer |
| --- | --- | --- |
| 1 | Major: the ad hoc `tsc` and `playwright test --list` in 5.3 exit 1 as written (`TS5112`; `spawnSync dotnet ENOENT`), and the fallback fails too | Accepted. 5.3 now adds `--ignoreConfig` to `tsc` and runs `--list` with a placeholder `ConnectionStrings__Content` that names `DigitalHubContent_E2e`, holds no credential and is labelled as a placeholder. Both expect exit 0; `--list` expects `Total: 1 test in 1 file`. The "rely on --list" fallback is removed. Added to the coverage table |
| 2 | Minor: the red window is 08:50 to 15:34, not 11:58 (attempt 1's studio job `131167446103` never started); the suite has 32 tests, not 33; match the test by name, not line | Accepted. 2.3 and 5.1 now give the window 08:50 to 15:34 and the start times of the six red jobs, which I re-read with `gh api .../jobs/<id>` (`15:34:50Z` to `15:51:56Z`; `131167446103`: `runner_name ""`, `steps 0`, `11:58:15Z` to `11:58:17Z`). 5.4 now expects `32 passed` and matches the test by name, noting it moves to about `:41`. 5.3's `--list` check also matches by name |
| 3 | Minor: quote the G3-1 "Done when" from `/mnt/project-files/docs/quality/` and note ADM-07 is a Major | Accepted. Section 1 now quotes `refinement-plan-2026-10-28.md:225` and `admin-audit-2026-10-28.md:147-149`, Required reading shows both as read, and the 5.6 checklist rows say so. The coverage table asks `implementation.md` to quote them too |
| 4 | Minor, no change asked: the cause of the lost click can be stated as fact from the antd source | Taken. 2.2 now states it, citing the reviewer's file and line references (I could not re-read them: `studio/node_modules` is empty here) |

