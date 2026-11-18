# ADM-07c: plan approval (gate 1)

Technical lead, gate 1, 12 November 2026. Plan: `docs/changes/ADM-07c/plan.md`,
round 2 (untracked). Review: `plan-review.md` round 2, `Verdict: APPROVED`, no
Blockers, no Majors, one Minor. Branch `change/ADM-07c`, worktree
`/home/user/dh-change-adm07c`, base `2bbd586`. After `git fetch`, `HEAD` and
`origin/rebuild/dotnet-platform` are both `2bbd586267e94e7c713ae5b905d8f4df66d75230`.
`git status --short` shows only `?? docs/changes/ADM-07c/`.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it is not an owner decision (P-7). The owner's request
reached me only through the orchestrating agent's relay, as it reached the
architect. The plan quotes that relay word for word and says it is a relay.

## Decision

Approved, with the conditions below. The decision on the optional probe is that it
is **required**, at 1.5 s instead of the plan's 3 s. The reason is under "The
slow-animation probe".

## Reasons

1. **Right change.** The base is red on this test. The ADM-04 (#58) and ADM-05 (#59)
   Blockers cannot go green until it is fixed. The defect is in ADM-07's own e2e
   test, and ADM-07 is a Major in G3-1 (`admin-audit-2026-10-28.md:147-149`;
   `refinement-plan-2026-10-28.md:225`). One topic, one file (B-8).
2. **Evidence I checked myself.**
   - `studio/e2e/redirects.spec.ts:20-31` at `2bbd586` matches plan 2.1. The
     `isVisible()` snapshot at `:22` is the only place that decides whether to reuse
     the dialog. Step 4 is at `:79`.
   - `studio/src/pages/RedirectsPage.tsx:93-110`: a failed POST calls `setError` and
     returns. A successful one calls `setOpen(false)`, then shows the toast. This
     matches plan 2.2.
   - `gh run view --job 131290456896 --log` (base push) shows
     `✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: … (1.5m)` and
     `at addRedirect (…/studio/e2e/redirects.spec.ts:28:25)`. Unit tests in the same
     job: `13 passed (13)`, `98 passed (98)`. This matches plan 2.3.
   - `studio/playwright.config.ts:11-12`: `timeout: 90_000`, `expect: { timeout: 15_000 }`.
     The plan changes neither.
   - The 3.1 design is deterministic. After a create it waits for the state that
     `create()` produces, and after a refusal it checks that the dialog stayed
     open. It adds two real assertions, and it uses no sleep, retry, skip or raised
     timeout (P-6). The reviewer type-checked the helper and ran the unit tests and
     build with it applied, in a scratchpad copy. I did not repeat that work: the
     probe and CI below are the evidence that matters, and neither can run here.
3. **No conflict with open work.** Open pull requests
   (`gh api "repos/{owner}/{repo}/pulls?state=open"`) are #60 `diag/redirects-e2e`
   (do not merge), #59 `change/ADM-05`, #58 `change/ADM-04`, #57 `change/ADM-05-red`
   (do not merge) and #44 `change/GAP-07`. I checked every remote branch with
   `git diff --name-only origin/rebuild/dotnet-platform...<branch>` for
   `redirects.spec.ts`, `RedirectsPage.tsx` and `playwright.config.ts`. Only these
   branches touch them:
   - `change/ADM-07` and `change/ADM-06b`, both already merged;
   - `diag/redirects-e2e` (PR #60, not to be merged);
   - `phase-c/studio-flaky-10-15`, which changes `studio/playwright.config.ts`,
     a file this plan does not touch.

   ADM-04 and ADM-05 do not touch the file.
4. **Execution order.** This belongs to G3-1 (Blockers, 3 to 16 November), slot 2.
   It comes ahead of #58 and #59 in that slot because they cannot be green without
   it. Blockers before Majors is kept: this is not a new Major fix that overtakes a
   Blocker. It is a test repair that unblocks two Blockers. #44 (GAP-07, G1 Wave 0)
   is in slot 1 and is not delayed. Wave 0 before Wave 1 and ISO-4 after ISO-5 do
   not apply.

   Queue: with this pull request there are four that are meant to merge (#44, #58,
   #59 and this one). That passes the plan's threshold ("if the queue passes three
   pull requests, slot 2 pauses for a day", `refinement-plan-2026-10-28.md:269`).
   This change shrinks the queue rather than growing it, because #58 and #59 cannot
   merge without it. Whether the pause applies is for the integrator and the owner,
   not for me. I list it as an open item, and it does not block the plan.
5. **Owner decisions.** None are needed. There is no behaviour change, exception or
   D-NNN. I agree with plan section 9.
6. **Risk** is low. Only one e2e helper changes. The worst case is that the cause is
   different, which the probe and CI would show at once, and the plan sends that
   back to step 1. Rollback is a revert.

## Red first

I accept plan 5.1. No tests-only red commit on `change/ADM-07c` is needed. The
reasoning is the same as at ADM-06b-flake gate 1: B-6's red-commit rule is for
security fixes, and this is not one. P-4 is met when the red is shown before the
green. Here the red is the committed base test, which failed in six of six studio
jobs (plan 2.3), one of them the base push job `131290456896`. The difference from
ADM-06b-flake: that red was deterministic and local. This one depends on runner
speed. The probe below covers that difference.

## The slow-animation probe: required, at 1.5 s

I make the probe in plan 5.1 **required**. These are my reasons:

- The six reds and the planned three greens both depend on how fast the runners
  are. The plan itself links the failures to a runner change it has not verified.
  If runner timing shifts again, the base would pass as well, and three greens
  would no longer show that the fix works. The probe gives a red and a green that
  do not depend on runner speed. That is the "reproduced before its fix and passing
  after it" that G3-1 asks for.
- It also tests risk row 2 directly, with a long close: `toBeHidden()` must
  resolve on a closing antd 6 Modal.
- It is cheap: one throwaway branch, one file, two CI runs.

**I am changing the duration from 3 s to 1.5 s.** The plan's 3 s would give a
false red in the fixed arm. The app does not configure antd's `message` (a grep of
`studio/src` for `message.config` and `duration` finds nothing), so toasts use the
default duration of 3 s. In `create()`, the toast appears in the same render as
`setOpen(false)`. With a 3 s close, the fixed helper returns about 3 s after the
201. Step 3 then asserts the warning toast is visible (`:68-71`), just as it
expires. At 1.5 s:

- the base helper still reaches step 4 while the dialog is closing (the gap in the
  diagnostic log was about 310 ms);
- the fixed helper returns with about 1.5 s of the toast left.

The same reasoning shows that the real fix (0.3 s) leaves step 3's toast check
2.7 s of margin.

## Reviewer's Minors

| # | Minor | Decision |
| --- | --- | --- |
| R2-1 | 5.3 cites `e2e/env.ts:48-52` for `assertSafeCatalog`; the function is at `:92-98` | **Accepted to leave in the plan.** The claim is right. The developer uses `:92-98` in `implementation.md` |

The round 1 Minors (2, 3, 4) are closed in plan round 2, and I checked the answers
against the plan text. The plan is not rewritten again.

## Conditions for the developer

1. Follow plan 3.1, 4.1 and 5.2 exactly. Change only `addRedirect` (`:20-31`) and
   the header comment (`:7-8`) in `studio/e2e/redirects.spec.ts`. Leave the four
   call sites and every existing assertion as they are. Do not touch `studio/src/`,
   `playwright.config.ts`, any other spec, `package.json`, the lockfile or any
   workflow. Use no `waitForTimeout`, retry, skip, `test.slow`, or timeout
   parameter or config change.
2. One code commit, `ADM-07c: Wait for the Add redirect dialog to settle between creates`,
   following B-4: an imperative subject, a body that says why (the closing dialog
   at step 4, the base job `131290456896`), and the attribution trailer. The
   pipeline records under `docs/changes/ADM-07c/` may go in that commit or in
   separate docs-only commits with the same prefix.
3. **Probe (required).** Make a throwaway branch `diag/ADM-07c-probe` from `2bbd586`
   and open a draft pull request titled `diag: ADM-07c slow-close probe (do not merge)`.
   It has two commits, and each changes only `studio/e2e/redirects.spec.ts`:
   1. *Probe red.* Leave the base helper as it is. After `await signIn(page);`,
      add
      `await page.addStyleTag({ content: '[class*="-zoom-leave"],[class*="-fade-leave"]{animation-duration:1.5s !important}' });`.
      Expected: the redirects test fails at step 4, with
      `page.waitForResponse: Test timeout of 90000ms exceeded` from `addRedirect`,
      called from the step 4 line.
   2. *Probe green.* The same style tag, plus the 3.1 helper, the same text as on
      `change/ADM-07c`. Expected: the redirects test passes.

   Quote both studio job ids and the `✘`/`✓` lines with the stack lines. If the red
   does not show the step 4 signature, or the green fails, report it and stop. Do
   not change the fix. A failing green sends the change back to step 1. The probe
   branch is never merged and never pushed into `change/ADM-07c`. Close the draft
   pull request and delete the branch after gate 2 has read the evidence. You own
   it, so closing it is yours to do. Do not touch PR #60.
4. Run every command in plan 5.3 and quote each one as run: the command, the exit
   code and the relevant lines (P-8). Include the placeholder `ConnectionStrings__Content`
   exactly as written and labelled as a placeholder. Never put a real connection
   string, password or user secret in a command, a log or a file. In
   `implementation.md`, quote the G3-1 "Done when" (`refinement-plan-2026-10-28.md:225`),
   note that ADM-07 is a Major (`admin-audit-2026-10-28.md:147-149`), and cite the
   antd source lines from plan 2.2 as the reviewer's reading.
5. Show that `git diff --exit-code -- studio/package.json studio/package-lock.json`
   exits 0 (B-7), and that `git diff --name-only origin/rebuild/dotnet-platform...HEAD`
   lists only `studio/e2e/redirects.spec.ts` and `docs/changes/ADM-07c/*`.
6. Rerun the studio job on the pull request's final head twice, for three runs in
   a row (plan 5.4), and quote each one.
7. If the plan cannot be followed as written, stop and send the change back to
   step 1. Do not improvise.

## What the tester must do

1. Work on a detached checkout of the developer's head.
2. Confirm the diff is the 3.1 helper and the header sentence only, and that
   nothing on P-6's forbidden list is used. Confirm the scope and commits from
   conditions 2 and 5 with `git log` and `git diff`.
3. Re-run plan 5.3 at the head (`npm ci`, the lockfile diff, `tsc -b`, the
   `--ignoreConfig` type check, `--list` with the placeholder showing
   `Total: 1 test in 1 file`, `npm test` with `98 passed (98)`, the build), and
   quote each result.
4. Read the probe's two studio job logs yourself (`gh run view --job <id> --log`)
   and quote the red signature at step 4 and the green `✓` line. Check that the
   probe green's helper matches the head's helper (`git diff` between the two
   files, ignoring the style-tag line).
5. Read the three studio jobs on the final head and quote, for each one, the `✓`
   line for the ADM-07 test (matched by name), the `passed` summary and the
   absence of a `failed` line.
6. Fill every row of the plan's coverage table (section 11) with evidence, plus a
   row for the probe. Mark CI rows NOT RUN until their job exists, and name the job.

## What gate 2 will require

- **G1.** The probe red and green (condition 3) are in `test-report.md`, with job
  ids and quoted lines.
- **G2.** Three consecutive green studio jobs on the final head. Each has the `✓`
  line for "ADM-07 redirects: a live page and a loop are refused, a target with no
  page is flagged" and `32 passed`, or the rebased base's count with the reason.
  None has a `failed` line.
- **G3.** `api`, `website`, the website browser tests, `section-compare`,
  `security.yml` and `workflow-lint.yml` are green on the final head. A job that
  never started (no runner, 0 steps) is reported as NOT RUN with its id, as plan
  5.4 says.
- **G4.** The diff matches plan 3.1 and 4.1 and conditions 1 to 7. `test-report.md`
  ends `Verdict: APPROVED` in its latest round. The Definition of Done boxes in
  `.github/pull_request_template.md` can each be ticked truthfully. The template
  is not on the base; it is on `origin/claude/cool-heisenberg-mh6zx9`.

## Open items (not blocking this plan)

- **Merge queue.** The integrator and the owner decide whether the slot 2 pause
  (four pull requests meant to merge) applies. My recommendation, which is not a
  decision: merge ADM-07c first in slot 2, then re-run #58 and #59.
- PR #60 and its branch `diag/redirects-e2e` belong to whoever opened them.
- The Security and Workflow lint runs for `2bbd586` never started (plan 4.2). They
  are for the orchestrator, not for this change.

Verdict: APPROVED
