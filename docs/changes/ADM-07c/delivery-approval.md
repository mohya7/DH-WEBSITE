# ADM-07c: delivery approval (gate 2)

Technical lead, gate 2, 18 November 2026. Branch `change/ADM-07c`, working copy
`D:\work\DigitalHub\dh-platform-claude-adm07c`. Local head `229fbf5` ("ADM-07c:
Implementation record", docs only, not pushed). Code head `ad11c89`, which is PR #62's
head on origin. Base `origin/rebuild/dotnet-platform` = `2bbd586267e9…`, unchanged after
`git fetch`. `test-report.md` Round 1 ends `Verdict: APPROVED`, with no Blockers, Majors
or Minors.

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires, and it is not an owner decision (P-7). The owner's request reached me through
the orchestrating agent, as given: "ADM-07c finish the redirects e2e race fix (resume:
plan, review and gate 1 are approved; developer step onward)".

## Decision

**Approved**, with conditions C1 to C5 on the push and merge. The code at `ad11c89`
meets G1 to G4 from gate 1. The open items are the CI run on the final, docs-only head,
the owner's review and merge confirmation, and naming the integrator.

## What I verified myself

All of these were run or read by me today. Logs were read per job with
`gh api --allow-escape-sequences repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs` (exit 0
for each, colour codes removed), never with `gh run view --job --log`.

### G4: diff, scope, commits

- `git log origin/rebuild/dotnet-platform..HEAD`: `3acb503 ADM-07c: Plan`,
  `ad11c89 ADM-07c: Wait for the Add redirect dialog to settle between creates`,
  `229fbf5 ADM-07c: Implementation record`.
- `git diff --stat origin/rebuild/dotnet-platform...HEAD`: four files under
  `docs/changes/ADM-07c/` and `studio/e2e/redirects.spec.ts | 12 +-`. Nothing else.
- `git diff origin/rebuild/dotnet-platform...HEAD -- studio/`: two hunks. One is the header
  sentence ("Each create waits for the dialog to close (after a create) or stay open
  (after a refusal), so a step never types into a dialog that is still closing."). The
  other is in `addRedirect`: `return await answered;` becomes `const response = await answered;`,
  a three-line comment, `if (response.ok()) await expect(dialog).toBeHidden();`,
  `else await expect(dialog).toBeVisible();` and `return response;`. That is plan 3.1
  word for word. The four call sites and every assertion are untouched. There is no
  sleep, retry, skip, `test.slow` and no timeout change (P-6).
- `git diff --stat ad11c89 HEAD -- studio/ .github/`: empty. `229fbf5` is docs only.
- `git diff 6007790 ad11c89 -- studio/e2e/redirects.spec.ts`: the only difference is the
  removed style-tag line. The probe green tested the head's helper exactly.
- Red first (P-4). There is no red commit on the branch, as plan 5.1 and gate 1
  accepted: this is not a security fix (B-6), and the failing test is already
  committed on the base. The red evidence is below.
- B-4. Each commit has an imperative subject with the `ADM-07c:` prefix and a body that
  says why. `ad11c89`'s body names the closing dialog at step 4 and base job
  `131290456896`. Each commit carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  `3acb503` and `ad11c89` also carry a `Claude-Session:` trailer. B-4 does not forbid
  it. Both commits are already pushed, so I do not ask for a history rewrite.
- Overlap. `git diff --name-only origin/rebuild/dotnet-platform...origin/<branch>` finds
  no file under `redirects`, `playwright.config` or `docs/changes/ADM-07c` on
  `change/ADM-04` (#58), `change/ADM-05` (#59), `change/GAP-07` (#44) or
  `claude/cool-heisenberg-mh6zx9` (#63).

### Local re-run (the fastest suites that cover the change)

These ran in `D:\work\DigitalHub\dh-platform-claude-adm07c\studio` at `229fbf5`, in Git
Bash, using the developer's existing `node_modules`:

| Command | Exit | Output |
| --- | --- | --- |
| `npx tsc -b` | 0 | none |
| `npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node e2e/redirects.spec.ts` | 0 | none |
| `ConnectionStrings__Content='Server=127.0.0.1;Database=DigitalHubContent_E2e;Integrated Security=True' npx playwright test --list e2e/redirects.spec.ts` (placeholder, no credential, nothing connects) | 0 | `redirects.spec.ts:60:1 › ADM-07 redirects: a live page and a loop are refused, a target with no page is flagged`, `Total: 1 test in 1 file` |
| `npm test` | 0 | `Test Files  13 passed (13)`, `Tests  98 passed (98)` |
| `git status --short` afterwards | 0 | `?? docs/changes/ADM-07c/test-report.md` only |

I did not run the end-to-end suite locally. CI covers it (below), and the local harness
is not usable on this machine right now (observation 3).

### G1: probe red and green

| Job | `gh api …/jobs/<id>` | Lines from the job's own log |
| --- | --- | --- |
| `131316608615` (probe red) | `failure`, head `329ed23`, run `43256666736` attempt 1, `2026-11-12T16:15:29Z`, runner `GitHub Actions 1000001926` | `✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: … (1.5m)`; `at addRedirect (…/studio/e2e/redirects.spec.ts:28:25)`; `at …/studio/e2e/redirects.spec.ts:80:13`; `1 failed`; `31 passed (4.4m)` |
| `134987431954` (probe green) | `success`, head `6007790`, run `44356930911` attempt 1, `2026-11-18T17:17:09Z` | `Tests  98 passed (98)`; `✓   8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects: … (7.0s)`; `32 passed (2.7m)`; 0 `failed` lines, 0 `flaky` or `retry #` |

`git show 329ed23:studio/e2e/redirects.spec.ts`, lines 79 and 80, are the step 4
comment and `expect((await addRedirect(page, \`/${stamp}-ok\`, \`/${slug}/\`)).status()).toBe(201);`.
So the red is step 4, the signature gate 1 asked for.

### Base red (P-4)

Job `131290456896`: `failure`, head `2bbd586`, run `43213692554` attempt 2,
`2026-11-12T15:34:50Z`. The log has `✘   8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects: … (1.5m)`,
`at addRedirect (…:28:25)`, `at …:79:13`, `1 failed` and `31 passed (4.5m)`.

### G2: three consecutive green studio jobs (on the code head `ad11c89`)

| Attempt | Job | Metadata | Log lines |
| --- | --- | --- | --- |
| 1 | `131316690198` | `success`, `ad11c89`, run `43256690742` att 1, `2026-11-12T16:15:37Z`, runner `…1934` | `✓ … redirects.spec.ts:45:1 › ADM-07 redirects: … (5.0s)`, `32 passed (3.2m)` |
| 2 | `135129219803` | `success`, `ad11c89`, att 2, `2026-11-18T21:00:30Z`, runner `…1982` | `✓ … :45:1 … (3.6s)`, `32 passed (2.3m)` |
| 3 | `135131787383` | `success`, `ad11c89`, att 3, `2026-11-18T21:04:38Z`, runner `…1983` | `✓ … :45:1 … (5.1s)`, `32 passed (3.5m)` |

Each log has `Tests  98 passed (98)` and 0 lines matching `Z +[0-9]+ failed`. The three
logs are different files: 4888, 4858 and 4924 lines, with different first timestamps
and different durations. `32 passed` is the base's count. Attempt 1 ran at 16:15 on
12 November, inside the window in which the unfixed test failed six of six. That makes
it the strongest of the three.

### G3: the other checks on PR #62 (head `ad11c89`)

`gh pr view 62 --json statusCheckRollup`: every check is `SUCCESS` except
"Screenshot parity (optional, label "screenshots")", which is `SKIPPED` because it is
optional and needs the label. I read these attempt-1 jobs myself with
`gh api …/jobs/<id>`. Each is `success` on `ad11c89`, with a named runner and steps
above 0:

- API `131316690292` (19 steps);
- Website `131316690159` (14);
- Website browser tests `131316689824` (15);
- Section comparison `131317114510` (13);
- actionlint `131316689562` (8);
- Security gate self-test `131316691435` (7).

The Security npm audit, NuGet, gitleaks and Semgrep jobs, and both CodeQL jobs, show
`SUCCESS` in the rollup.

### Coverage table

Every row of the plan's section 11, plus the probe row and the G3 row, has evidence in
`test-report.md`. I re-checked the rows that rest on CI (red, probe, three greens, other
checks) and the scope and type-check rows, as above. The only rows not proven on the
final head are the CI rows, and the final head does not exist yet (C2).

## Decisions asked of gate 2

### 1. The final head: one full green run, not three studio runs

Pushing `229fbf5` and the records commit makes a new head. Under B-3 ("a new head needs
green CI again") and Definition of Done box 6, that head needs green CI. None of the
workflows has a paths filter (`ci.yml:13-18`, `workflow-lint.yml:28-30`; `codeql.yml`
runs on every pull request), so the push re-runs every check by itself.

**I do not require three more studio runs on a docs-only head.** G2's three runs exist
to show the fixed test passes repeatably, and that is a property of the code. Outside
`docs/changes/ADM-07c/`, the final head's tree will be byte for byte `ad11c89`'s. The
three runs on `ad11c89`, together with the probe green, already prove it. The one
studio run that the push triggers will be a fourth green on the same code. This
narrows how G2 reads "final head" to the code head, because the docs commit changes
nothing the test reads. It does not weaken the evidence.

That holds only while the tree outside the records is unchanged. A rebase onto a base
with code changes needs the three runs again (C4).

### 2. The probe: close it now

I have read the probe's evidence myself (G1 above), and it is quoted in
`test-report.md` and here, with job ids and commit SHAs. The developer may close draft
PR #61 now, with a comment pointing to PR #62, and delete `diag/ADM-07c-probe` from
origin. The job logs stay under runs `43256666736` and `44356930911` for the
repository's log retention, whether or not the branch exists. Do not touch PR #60 or
`diag/redirects-e2e`. They belong to whoever opened them.

### 3. The tester's observations

| Observation | Action needed? | By whom |
| --- | --- | --- |
| The local `DigitalHubContent_E2e` was left empty after an optional local run failed at "Release migrations" | **No action for this change.** The e2e database is reset before every run (`AGENTS.md`), so an empty catalog harms nothing. Only the e2e catalog was touched. **Separate item for the orchestrator:** the local e2e harness cannot start the API on this machine ("E2E Release migrations failed; the API was not started"), while `dotnet build -c Release` succeeds. That will block anyone's local e2e run here. It needs its own diagnosis by one agent holding the local database. It is not part of ADM-07c, and it is not a reason to hold this change, because CI is the evidence gate 1 required | Orchestrator, to log and assign |
| Local `playwright --list` line numbers are off (`:60` against `:45`) on this Windows checkout | **No action.** CI reports `:45:1`, and gate 1 matches the test by name. `git ls-files --eol` shows `i/lf w/crlf` for the specs, so the committed files are LF. The tester's CRLF explanation is plausible but not proven, and it does not matter here. Anyone who later quotes local line numbers should take them from `grep -n`, not from `--list` | Nobody |
| The probe red cannot be told apart from the base race by its signature alone | **No action.** The probe red ran at 16:15 on 12 November, when the base was red on these runners anyway, so the red job alone does not show that the slowdown caused it. The probe's value is in the pair. With a 1.5 s close, the base helper must meet a closing dialog at step 4, whatever the runner speed (a 0.3 s close already loses the click). The probe green shows that the fixed helper survives a close five times longer than the real one. Its 7.0 s against 3.6 to 5.1 s shows the style tag took effect. A fresh probe-red re-run would only add something if the base were green on today's runners, and nothing shows that. I do not ask for it | Nobody |

### 4. Merge queue (recommendation, not a decision)

The integrator and the owner decide this. My recommendation, as at gate 1:

1. **#62 (ADM-07c) first in slot 2.** #58 (ADM-04) and #59 (ADM-05) cannot go green
   without it, because both are red on this test. After the merge, the integrator
   re-runs the suites on `rebuild/dotnet-platform`. #58 and #59 then rebase or merge
   the new base in (B-3), and get fresh CI.
2. **Then #58 and #59**, one per day in slot 2, Blockers in the order the owner has set.
3. **#44 (GAP-07)** is slot 1 and independent: no shared files. It is not delayed by this.
4. **#63 (standards, docs only)** shares no file with #62 (it touches only
   `.github/pull_request_template.md`, `AGENTS.md`, `CLAUDE.md`,
   `ENGINEERING_STANDARDS.md` and `docs/`). The order between them does not matter for
   correctness. Merging #62 before #63 saves one rebase cycle. If #63 merges first,
   C4 applies, and one green run on the rebased head is enough.

The queue meant to merge is now #44, #58, #59, #62 and #63, five pull requests. That
passes the "if the queue passes three pull requests, slot 2 pauses for a day" threshold
(`refinement-plan-2026-10-28.md:269`). Whether the pause applies, and how #63 counts
against the slots, is for the integrator and the owner.

## Conditions on the push and merge

- **C1.** Push only commits that change files under `docs/changes/ADM-07c/`: `229fbf5`,
  and one records commit for `test-report.md` and this file (B-4 subject with the
  `ADM-07c:` prefix, body saying why, the attribution trailer). Stage exact paths
  (B-5). Before the push, `git diff --exit-code ad11c89 HEAD -- . ':!docs/changes/ADM-07c'`
  must exit 0. Push with an explicit refspec (`git push origin change/ADM-07c`), never a
  bare `git push` (B-2), and only after the owner confirms, as `implementation.md` says.
- **C2.** After the push, every check on PR #62 must finish green on the final head:
  CI, which includes the Studio job with the `✓` line for "ADM-07 redirects: a live
  page and a loop are refused, a target with no page is flagged", `32 passed` and no
  `failed` line, plus Security, Workflow lint and CodeQL. Screenshot parity may stay
  skipped. Quote the run ids and the studio job's lines in the pull request, reading
  the job's own log through the jobs API. Do not cancel a run in progress. A red on
  the final head is reported before anything is fixed, and goes back to the developer.
- **C3.** No additional studio re-runs are required on the docs-only head (decision 1).
- **C4.** If the branch is rebased or the base is merged in before the merge:
  - if the new base changes anything under `studio/`, `api/` (the e2e harness starts
    the API), `.github/workflows/ci.yml` or the root build files, G2 applies again:
    three consecutive green studio jobs on that head, each quoted as in G2;
  - if the new base changes only docs, the PR template or `.github/security` (that is,
    #63 or #44), C2's single full green run is enough.

  If the expected count changes from 32, state the new count and the reason.
- **C5.** The developer closes PR #61 and deletes `diag/ADM-07c-probe` (decision 2).
  This is not a precondition of the push.

## Definition of Done

`.github/pull_request_template.md` is not on the base. I read it from
`origin/claude/cool-heisenberg-mh6zx9` (PR #63).

| Box | Can it be ticked truthfully now? |
| --- | --- |
| 1. Requirement and acceptance criteria stated and met | **Yes.** Plan section 1 criteria: cause named (plan 2.2 to 2.4, probe red); test-only fix; nothing weakened; studio e2e green three times (`131316690198`, `135129219803`, `135131787383`). No criterion needs a deploy |
| 2. Code follows the engineering standards | **Yes.** I read the diff in full. It is one helper and one comment line, and it type-checks strict (`tsc --ignoreConfig`, exit 0) |
| 3. No new prohibited constructs in touched code | **Yes.** No untyped values (`response` is a Playwright `Response`), no data access, config reads or network calls added. It is a test helper |
| 4. Every new or changed route has a guard and record scope | **Yes, trivially.** No route changed |
| 5. Tests exist for the behaviour changed; coverage gate; security regression test | **Yes.** Only the test changed, and it is proven red before (base `131290456896`, probe `131316608615`) and green after. It is not a security fix. Changed-line coverage is not gated yet (GAP-18) |
| 6. PR checks green on the final head (run ids quoted) | **Open.** Green on code head `ad11c89` (run `43256690742`, Security `43256691064`, Workflow lint `43256690822`, CodeQL `43256690956`). The final docs-only head is not pushed yet (C1, C2) |
| 7. Independent code review run; findings fixed or accepted | **Yes.** Plan review rounds 1 and 2, `test-report.md` Round 1 (no findings), and this gate. The one remaining reviewer Minor (R2-1) was accepted at gate 1 and answered in `implementation.md` |
| 8. Reviewed by someone other than the author | **Partly.** The architect, reviewer, tester and tech lead are separate pipeline roles, and their records are on the branch. **Open:** the owner's review at merge. Also for the owner and integrator: every role here is a Claude Code subagent, while `AGENTS.md`'s rotation has Cursor check Claude Code's work. Earlier changes (for example ADM-07) were delivered on the pipeline roles alone. I record it rather than decide it |
| 9. Rollback understood | **Yes.** Revert the pull request. The test goes back to its racy form. No schema, data or product change |
| 10. Deployment note | **Open.** The slot 2 integrator is not named. That integrator merges into `rebuild/dotnet-platform` and re-runs the suites after the merge. Nothing deploys before Phase D |
| Governance: coverage table updated | **Yes.** `implementation.md` and `test-report.md`, every row with evidence |
| Governance: `docs/deferred-items.md` for any exception | **Not needed.** No exception and no unfixed Minor |
| Governance: documentation updated | **Yes.** `docs/changes/ADM-07c/`. No product documentation changes |

## Open items

1. Push the records (C1), after the owner confirms, then get green CI on the final head
   (C2).
2. The owner's review and merge confirmation (DoD box 8).
3. Name the slot 2 integrator (DoD box 10). The integrator decides on the queue pause
   with the owner (decision 4).
4. Close PR #61 and delete `diag/ADM-07c-probe` (C5, developer).
5. For the orchestrator, not this change:
   - the local e2e harness fails at "Release migrations" on this machine, and
     `DigitalHubContent_E2e` is empty;
   - the reviewer-rotation question in DoD box 8;
   - PR #60 and `diag/redirects-e2e` still belong to whoever opened them.

## Draft pull request description (PR #62)

```markdown
## What and why

ADM-07c. The ADM-07 end-to-end test "ADM-07 redirects: a live page and a loop are
refused, a target with no page is flagged" (`studio/e2e/redirects.spec.ts`) has failed
on every studio job since 15:34 on 12 November, six of six, including the base push job
131290456896. That makes #58 (ADM-04) and #59 (ADM-05) red.

Cause: `addRedirect` decided whether to reuse the "Add redirect" dialog from a one-off
`isVisible()` snapshot. After step 3's successful create, the page closes the dialog and
antd runs a 0.3 s close animation. While it runs, the dialog still counts as visible,
but its "Create" button takes no clicks (`pointer-events: none` on the leaving modal).
Step 4 filled and clicked that closing dialog, no POST was sent, and `waitForResponse`
timed out at step 4.

Fix: `addRedirect` now waits for the state the page leads to before it returns. The
dialog must be hidden after a create, and still open after a refusal. Test-only.

## Scope and boundaries

- In scope: `studio/e2e/redirects.spec.ts` (`addRedirect` and one header sentence), and
  the change records in `docs/changes/ADM-07c/`.
- Not touched: `studio/src/` (the product is correct), `playwright.config.ts`, other
  specs, `package.json` and the lockfile, workflows.
- Out of scope: PR #60 (`diag/redirects-e2e`); ADM-04's own `users.spec.ts` failure on
  an earlier #58 commit.

## Security impact

None. One end-to-end helper changes. No route, policy, login, data, secret or
dependency changes. The test still uses only `DigitalHubContent_E2e`.

## Tests and evidence

- Red before the fix (P-4; no red commit, as this is not a security fix and the
  failing test is already on the base):
  - base job 131290456896 has `✘ e2e/redirects.spec.ts:37:1 › ADM-07 redirects: … (1.5m)`,
    `at addRedirect (…:28:25)` from `…:79:13` (step 4), `1 failed`, `31 passed`;
  - deterministic probe (draft PR #61, closed after review), with antd's close slowed to
    1.5 s. Red job 131316608615 on 329ed23 (base helper) has the same signature at step 4
    (`:80:13` with the style-tag line), `1 failed`. Green job 134987431954 on 6007790 (this
    PR's helper; `git diff 6007790 ad11c89` differs only by the style tag) has
    `✓ … :45:1 … (7.0s)` and `32 passed (2.7m)`.
- Green after the fix, three consecutive studio jobs on ad11c89 (run 43256690742,
  attempts 1 to 3): 131316690198, 135129219803 and 135131787383. Each has
  `✓ e2e/redirects.spec.ts:45:1 › ADM-07 redirects: …`, `32 passed`, no `failed` line, and
  `Tests 98 passed (98)`. Logs were read per job via the jobs API.
- Other checks on ad11c89, all success:
  - API 131316690292, Website 131316690159, Website browser tests 131316689824, Section
    comparison 131317114510;
  - Security run 43256691064 (self-test, npm audit ×2, NuGet, gitleaks ×2, Semgrep);
  - Workflow lint 131316689562, CodeQL run 43256690956.

  Screenshot parity was skipped (optional, label).
- Final head <sha> (docs only on top of ad11c89): CI <run id>, studio job <job id>
  `✓ … ADM-07 redirects …`, `32 passed`; Security <run id>; Workflow lint <run id>;
  CodeQL <run id>. <fill in after the push>
- Local, at 229fbf5 (tester; gate 2 re-ran the type checks, `--list` and `npm test`): `npm ci` exit 0 with lockfile diff empty;
  `npx tsc -b` exit 0; `tsc --ignoreConfig … e2e/redirects.spec.ts` exit 0;
  `playwright test --list` (placeholder connection string, no credential) exit 0,
  `Total: 1 test in 1 file`; `npm test` exit 0, `98 passed (98)`; build exit 0.
- Local end-to-end: NOT RUN. The local harness fails at "Release migrations" on this
  machine (tracked separately). Covered by the CI job "Studio — typecheck, build,
  end-to-end".

## Owner decisions

None needed: no behaviour change, exception or deferred item. Owner's request, as
relayed by the orchestrating agent on 18 November 2026: "ADM-07c finish the redirects
e2e race fix (resume: plan, review and gate 1 are approved; developer step onward)".

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (red 131290456896 and 131316608615; green 131316690198, 135129219803, 135131787383, 134987431954)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test (test-only change, shown red then green; not a security fix; changed-line coverage not gated yet, GAP-18)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (owner review at merge)
- [x] Rollback is understood (normally: revert this PR; no schema or data change)
- [ ] Deployment note: integrator <name> merges into rebuild/dotnet-platform and re-runs the suites after the merge; nothing deploys before Phase D

## Review findings accepted

- Plan review round 2, Minor R2-1: the plan cites `e2e/env.ts:48-52` for
  `assertSafeCatalog`, which is the call site. The function is at `:92-98`. The claim is
  right, and `implementation.md` uses the correct lines. Accepted at gate 1.
- No tester findings.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (coverage table in `docs/changes/ADM-07c/implementation.md` and `test-report.md`)
- [x] `docs/deferred-items.md` updated for any exception (not needed, no exception)
- [x] Documentation updated (`docs/changes/ADM-07c/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
