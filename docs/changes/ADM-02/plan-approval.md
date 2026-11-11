# ADM-02: plan approval (gate 1)

Technical lead, gate 1, 11 November 2026. Plan: `docs/changes/ADM-02/plan.md`,
round 2 (`46d9bbc`). Review: `docs/changes/ADM-02/plan-review.md`, Round 2
(`c8ff97a`), `Verdict: APPROVED` with two Minors. Worktree
`/home/user/dh-change-adm02`, branch `change/ADM-02`, base `77296ba`, which is
still the tip of `origin/rebuild/dotnet-platform` (`git merge-base --is-ancestor`
exit 0 after `git fetch`). Nothing is committed with this file, and it is the only
file written.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7).

## Decision

Approved, with the conditions below. O-ADM02-1 is still PENDING. It controls
when anything is pushed and whether gate 2 can approve. It does not hold up
development, local red and green, testing, or gate 2's local checks. O-ADM02-2 is
PENDING and blocks only the G3-1 exit gate (see "Owner decisions").

## What I read

- `docs/changes/README.md`, `AGENTS.md` and `CLAUDE.md` (worktree copies), and
  `.claude/agents/` (architect, plan-reviewer, tech-lead, developer, tester).
- `ENGINEERING_STANDARDS.md`, `docs/deferred-items.md` and
  `.github/pull_request_template.md` from `origin/claude/cool-heisenberg-mh6zx9`
  (none is on the base). P-4 to P-7 at lines 25-28, B-4 to B-8 at 38-42, G-13 and
  G-15 at 66-68.
- `/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md` (execution
  order at lines 19-32, GAP-09 at 73 and 159, G3-1 at 225) and
  `admin-audit-2026-10-28.md` (FR-S-11 at 37, ADM-02 at 77, ADM-07 at 149-155).
- `plan.md` round 2 in full, and `plan-review.md` rounds 1 and 2 in full.

## What I checked myself

| Check | Command or source | Result |
| --- | --- | --- |
| Open pull requests and their files | `gh api 'repos/{owner}/{repo}/pulls?state=open'`, then `.../pulls/<n>/files` | Two open. #52 (ADM-03): `studio/e2e/rich-text.spec.ts`, `studio/src/content/RichTextEditor.tsx`, `studio/test/richText.test.tsx`, `studio/test/support/pasteFilter.ts`, `docs/changes/ADM-03/*`. #44 (GAP-07): `.github/security/*` (5 files), `.github/workflows/security.yml`, `docs/changes/GAP-07/*`. None is in the plan's section 4 |
| `change/ADM-06b-flake` | `git diff --name-only origin/rebuild/dotnet-platform...origin/change/ADM-06b-flake` | Only `docs/changes/ADM-06b-flake/{plan,plan-review,plan-approval}.md` so far; its planned file is `studio/test/listPaging.test.tsx`. No overlap |
| Every other remote branch against the 17 files in section 4 | loop over `git branch -r`, `git diff --name-only origin/rebuild/dotnet-platform...<b>` | Hits only on branches already merged by squash: GAP-01 (#39), GAP-04 (#43), GAP-06 (#42), ci-runner-pin (#38), ci/github-actions (#13), phase-c/api-security-fixes (#31), phase-c/session-password-hardening-v2 (#35), phase-d/content-bundle (#30) and older phase-c branches. `gh api .../pulls?state=closed` shows each as `merged=true`. No live conflict |
| The cited comparisons | `sed -n 135,141p AdminStore.cs`; `sed -n 739,743p ContentStore.cs`; `grep -n` in `web-config.ts` | `from == to` (137), `redirect.FromPath == from` (140), `redirect.FromPath == path` (741); the build's key `row.fromPath.replace(/\/+$/, "") \|\| "/"` (148) and `fromPath.slice(1).replace(/\/+$/, "")` (128). As the plan says |
| Formats not asserted today | `grep -n EvaluationOptions SectionSchemaSet.cs CollectionSchemaSet.cs` | Both `new EvaluationOptions { OutputFormat = OutputFormat.List }` (34, 36) |
| Only caller of `CheckDocumentAsync` | `grep -rn CheckDocumentAsync api/` | `ContentBundle.cs:387` and `:410`. `CheckAsync` is `private`, with `bool requireMedia = true` last (`ContentStore.cs:682`) |
| Review Minor 1 (ended vacancies) | `sed -n 170,190p BuildContentStore.cs` | Confirmed: `vacancies` builds `Published \|\| Ended` (175-177) with `status: "ended"` |
| CI workflow | `sed -n 1,128p .github/workflows/ci.yml`; `grep -n uses: ci.yml` | `permissions: contents: read`. Job `api` uses `@v4` tags. The newest job, `website-browser`, already pins `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`. No golden copy of `ci.yml` exists (`security.expected.yml` covers `security.yml` only). `workflow-lint.yml` runs actionlint on every workflow, `ACTIONLINT_BLOCKING_FROM: "2026-11-18"` |
| Website install | `website/package.json` scripts; `package-lock.json:3253` | No `postinstall` or `prepare` script, so `npm ci` in `api` downloads no browsers. The `tsx` bin is `dist/cli.mjs`, as W1 expects |
| Local evidence inputs | `ls` | `dn.sh` and `adm02/base-passed.txt` (173 lines, includes `The_api_rule_is_the_website_builds_rule`) exist in the scratchpads the plan names. Both are under `/tmp` and can disappear |

I ran no test suite. Gate 1 approves a plan. The suites run at step 4 and step 5,
and I re-run the fastest of them at gate 2.

## Why it is the right change at the right time

- **Execution order.** The refinement plan puts G3-1 in slot 2, 3 to 16 November,
  in the order "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a" (line 26). ADM-06 merged
  (#49, #51). ADM-03 is open as #52. ADM-02 is next. It is a Blocker, so it goes
  before any Major. Wave 0 before Wave 1 and ISO-4 after ISO-5 do not apply to a G3
  item. Slot 1 work (#44) is a different slot, so this change does not overtake it.
- **Merge order in slot 2.** #52 merges before ADM-02. There is no file overlap, so
  this is order only: slot 2 takes at most one pull request a day (line 21).
- **Fit to the audit.** It closes ADM-02's first three fix lines: "Normalise paths
  in every redirect check", "Enforce the same formats in the API", "Add a test that
  feeds API-accepted content to the website's checks". The fourth line moves to
  ADM-01a, as the audit itself says ("(ADM-01a)").
- **ADM-07 split.** Parts 1 and 2 are the same comparison in the same functions,
  and the audit calls them "Same root cause as ADM-02". Taking them here keeps one
  address rule used everywhere. Part 3 (target check, Studio warning, build report,
  `ToPath` comparisons, the end-to-end test for the Major) is a separate feature
  with its own design choices. I accept the split. The ADM-07 change must be cut
  from `origin/rebuild/dotnet-platform` after ADM-02 merges, because it changes
  `AdminStore.cs` and `ContentStore.cs` too.
- **Lower case only (B7).** Stricter than the website's format, but the website's
  exact-string lookups are what fail, so a format-only match would leave ADM-02's
  defect class open. The Studio and the importer never write upper case. I accept
  it.
- **Strict on published rows only.** Settled design: "Save is not publish." The
  Studio sends `id: ""` and `mediaId: ""` in normal flows, with no Clear (ADM-09).
  Refusing at publish keeps the work saved. I accept it.
- **ADM-02b.** I accept the boundary for the reviewer's reasons (Round 2, "Is
  leaving rich-text ids out a sound boundary?"). It needs a coordinator slot, or it
  becomes a loose end. It touches `RichText.cs` only, so it does not collide with
  ADM-02.
- **Risk.** No migration, no stored data rewritten, no route or policy change.
  Every new rule only refuses more, so a revert leaves valid data. The real risk is
  B4: a live page with a legacy slash redirect can no longer be saved until the
  redirect goes. It is listed for the owner, and O-ADM02-2 (b) finds those pages.
  The risk is acceptable.

## The CI workflow change

The change adds Node and `npm ci` to job `api` so that W1 and W2 can run the
website's checks. It is a test dependency inside an existing job, not a new gate:
a failing W1 fails `api` at once, as any test does, and W2 is the committed canary
that proves the runner can fail. So no report week and no `*_BLOCKING_FROM` date
apply. What it needs beyond the plan:

1. **Pin the new action.** The plan writes `actions/setup-node@v4` "like the rest
   of `ci.yml`". GAP-09 (Wave 1, "Every `uses:` names a 40-character SHA") is
   already planned, and the file already pins this action in `website-browser`.
   A new tag reference adds to the debt GAP-09 must clear. Use the pin already in
   the file (condition 7). Same action, same major version, no new dependency.
2. **actionlint.** `workflow-lint.yml` checks the changed `ci.yml`, and it blocks
   from 18 November. The changed file must have 0 findings.
3. **No golden copy** to update. `ci.yml` has none.
4. **Supply chain.** `npm ci` from the committed `website/package-lock.json` runs in
   a job with `permissions: contents: read` and only CI-only SQL Server passwords.
   Job `website` already runs the same install. I accept it.
5. **Coordination.** When GAP-09 lands, one of the two pull requests rebases on the
   other's `ci.yml`. That is a rebase, not a design conflict.

## Reviewer's Minors

Both are accepted as conditions, not left open:

- **Round 2 Minor 1 (ended vacancies are built).** Condition 1.
- **Round 2 Minor 2 (`publishing` must have no default).** Condition 2.

The round 1 Minors (3 to 7) are closed in round 2, and I checked the reviewer's
table against the plan's revision log.

## Developer conditions

1. **Ended rows are strict.** In `ContentBundle.CheckAsync`, collection rows pass
   `publishing: record.Status is ContentStatus.Published or ContentStatus.Ended`.
   This is what `BuildContentStore.cs:175-177` reads, and it fails closed (P-5).
   Working copies stay `publishing: false`. Plan 3.2's last bullet about `Ended` is
   wrong. Do not edit the plan. Record in `implementation.md` that the code follows
   this condition and not that bullet. No new test is needed: vacancies have no
   sections, and F1 (b) pins the collection schemas to have no `format`. Say so in
   `implementation.md`.
2. **`publishing` has no default.** It is a required `bool` on both
   `ContentStore.CheckDocumentAsync` and the private `ContentStore.CheckAsync`. Put
   it before `CancellationToken`, and keep `requireMedia = true` as the only
   optional parameter. Every call site names it, `publishing: true` or
   `publishing: false`. Quote the final signatures in `implementation.md`.
3. **Commit order exactly as 5.2.** Commit 1 is tests and harness only, with no
   change under `api/src/` or `api/tools/`. K1 lands in commit 2. Commit 3 adds the
   one `SchemaFormats.WebsiteUuidSource` assertion to F1. Subjects start with
   `ADM-02:` and are imperative. Each body says why and ends with the attribution
   trailer (B-4). Stage exact paths (B-5). No force-push, and no bare `git push`.
4. **Pushes while O-ADM02-1 is unanswered.** Build commit 1 and keep it local.
   Record its local red (5.3) in `implementation.md`. Then build commits 2 and 3
   locally. While the question stays unanswered, push nothing after `c8ff97a` and
   open no pull request. This covers the finished branch too: opening the pull
   request at the fixed head makes the CI red for the 20 database cases impossible
   to show on it. That is the "No" answer, and an agent may not choose it for the
   owner. The tester works from the local SHAs, so testing does not wait.
   - On **"Yes"**: push commit 1 alone with
     `git push origin <commit-1-sha>:refs/heads/change/ADM-02`, open the pull
     request, and let CI finish. Record the run id and the failing test names. Then
     push commits 2 and 3 with `git push origin change/ADM-02`.
   - On **"No"**: push the finished branch and open the pull request. The plan's
     "No" branch applies (5.5, section 9): the 20-case red is NOT RUN, and gate 2
     returns BLOCKED ON OWNER until a D-NNN entry carries the owner's words.
5. **Scope.** Exactly the files in section 4, plus
   `docs/changes/ADM-02/implementation.md`. No Studio file, no migration, no
   lockfile change, and no other change to `package.json` than the
   `check:content` script. Show `git diff --stat origin/rebuild/dotnet-platform...HEAD`
   in `implementation.md`.
6. **Stop on surprise.** If W1 prints a "this run's line" other than the three in
   5.1, or the asserting options behave differently from the 2.3 probes, stop with
   `Status: BACK TO ARCHITECT`. Do not widen the scope.
7. **CI step.** In job `api`, before "Integration tests (Release)", add
   `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0` with
   `node-version: ${{ env.NODE_VERSION }}`, `cache: npm`,
   `cache-dependency-path: website/package-lock.json`. Then add `run: npm ci` with
   `working-directory: website`. No `if:` and no `continue-on-error`. Nothing else
   in `ci.yml` changes. If actionlint is installed, run `.github/lint/run-actionlint.sh`
   and quote the result. Otherwise write NOT RUN and name `workflow-lint.yml`.
8. **No skip.** W1 and W2 fail with "Run npm ci in website/ first." when
   `website/node_modules` is missing. They never skip (P-5, P-6).
9. **Databases and ports.** Local runs use the unreachable `127.0.0.1,4299` string
   from 5.3. Database tests are NOT RUN locally, and CI `api` covers them. Never
   point at `DigitalHubContent` or `DigitalHubContent_Studio`. Each database test
   uses the run marker and deletes what it creates in `finally`.
10. **Baseline.** If `adm02/base-passed.txt` is gone, regenerate it at `77296ba`
    with the same command before comparing, and say so. Then quote the diff of
    passed names: the 173, plus F1, K1 and W2, and no name lost.
11. **Pull request body.** List B1 to B7 under "Owner decisions", along with
    O-ADM02-1 and O-ADM02-2 and their status, the ADM-07 split, and the ADM-02b
    proposal, so the owner sees each before confirming the merge. B4 (a live page
    with a slash redirect cannot be saved) must be stated plainly.

## What the tester must do

1. Use a detached worktree at the head from `implementation.md`. Before running
   `npm ci` in it, run W2 and confirm it fails with "Run npm ci in website/ first."
   (condition 8). Then run `npm ci` in `website/`.
2. **Red.** At commit 1: F1 fails at (c), and `not-a-uuid` gets no API error. W2
   and C1 to C5 pass, and typecheck passes. Confirm that commit 1 has no change
   under `api/src/` or `api/tools/` (`git show --stat`).
3. **Green.** At the head: the 5.3 commands, and the full DB-free API suite in
   Release diffed against the 173-name baseline. Then `npx vitest run` and
   `npm run typecheck` in `website/`. Then `dotnet build DigitalHub.slnx -c Release`,
   with 0 errors and no more than 13 warnings.
4. **NOT RUN, with the CI job.** R1 to R7, F2 to F5 and W1 go to `api`. The website
   build, `design:check` and `compare:sections` go to `website` and
   `section-compare`. Run them where the container allows.
5. **Security.** `npm audit --audit-level=high` in `website/` (the scripts
   change). No new route. The new refusals keep RFC 7807 with `code`, and no
   internals or stack text appear in the body. Check the diff for secrets. Check
   that the `ci.yml` diff is the two steps of condition 7 only, SHA-pinned.
6. **Conditions 1, 2, 5 and 7.** Verify each in the code or diff, and quote it.
7. **Beyond the plan.** Try at least these. A redirect from `/` and from `/x//`
   (still refused by the character rule). `/X/` against an existing `/x`
   (collation). A trailing-slash `toPath` that points at a live page. The `uuid`
   edge cases in F1, run against `CollectionSchemaSet` as well. An ended vacancy
   in a bundle. A rename back to an address whose slash redirect exists. Each
   failure is a finding.

## What gate 2 will require

- `implementation.md` ending `Status: READY FOR TEST`, and `test-report.md` whose
  latest round ends `Verdict: APPROVED`.
- `git log origin/rebuild/dotnet-platform..HEAD` shows commit 1 (tests only) before
  commits 2 and 3, with B-4 subjects and trailers. The diff contains only the
  files in condition 5.
- I re-run F1, K1, W2 and C1 to C5 myself, and the DB-free baseline diff.
- **CI red on commit 1**, if the owner answers "Yes": the run id, and exactly the
  21 failing cases of 5.4 (20 database cases and F1), each with its assertion.
  W1's output must show the three lines in 5.1. If the answer is "No", or there is
  still no answer, gate 2 is `BLOCKED ON OWNER` until a D-NNN entry carries the
  owner's words.
- **CI green on the final head**, with run ids: `api` (with the TRX total),
  `website`, `studio`, `section-compare`, `website-browser`, `workflow-lint.yml`
  and `security.yml`. If CI has not run by then, it is listed as an open
  Definition of Done item.
- Every coverage-table row has evidence. Moved rows name their destination:
  ADM-01a, ADM-07 and ADM-02b.
- Conditions 1 to 11 are answered one by one in `implementation.md`.
- O-ADM02-2 is **not** required for gate 2. It stays an open item in the pull
  request body.

## Owner decisions

| Id | Question | Status | Blocks |
| --- | --- | --- | --- |
| O-ADM02-1 | May commit 1 (tests and harness only) be pushed and the pull request opened before the fix, so CI shows the reds? | PENDING. Asked by card on 11 November 2026, no answer yet. The ADM-06b answer, "Yes, red test first like #49" (Mohamed Elbadry, 11 November 2026, project thread), covers ADM-06b only and is not applied here | The push (condition 4) and gate 2. Not gate 1, development or testing |
| O-ADM02-2 | List the rows in `DigitalHubContent_Studio` that the new rules refuse, fix them through the Studio, and count those fixes as "no patched content"? | PENDING. Not yet asked. Only the owner's database can answer it, and no agent here can reach it | Only the G3-1 exit gate ("A clean website build from `DigitalHubContent_Studio` with no patched content"), together with ADM-05. Not gate 1 and not gate 2 |
| B1 to B7 | Behaviour changes that are the audit's fix | Shown to the owner in the plan (section 9) and, by condition 11, in the pull request body | No owner words have been quoted that reject any of them. The owner's merge confirmation is where they are accepted. This approval does not accept them for the owner. If the owner rejects one, the change goes back to the architect |

I recommend the coordinator ask O-ADM02-2 now, not after the merge. Queries (a)
and (b) are read-only. Run before the merge, they tell the owner whether B4 will
lock any live page in `DigitalHubContent_Studio`, and that is what the owner should
know before confirming the merge.

## Open items for the coordinator

- Schedule ADM-02b, or it becomes a loose end.
- Cut ADM-07 only after ADM-02 merges, because the two share `AdminStore.cs` and
  `ContentStore.cs`.
- Merge #52 before ADM-02 in slot 2.
- The batch ends on 16 November. The CI red waits on O-ADM02-1, so a late answer
  moves ADM-02's merge and every G3-1 item after it.

Verdict: APPROVED
