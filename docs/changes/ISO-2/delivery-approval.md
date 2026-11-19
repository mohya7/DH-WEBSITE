# ISO-2 delivery approval (gate 2)

Technical lead, gate 2. Change branch `change/ISO-2`, worktree
`D:\work\DigitalHub\dh-platform-claude-iso-2`, head
`d3b6282aa03e220a6104b9488703b1ad69162fa7`, rebased onto `8027e87` (ADM-12c, #73).
Records read: `plan.md` (round 2), `plan-review.md` (Round 2, `Verdict: APPROVED`),
`plan-approval.md` (`Verdict: APPROVED`, conditions 1 to 9), `implementation.md`
(`Status: READY FOR TEST`), `test-report.md` (Round 1, uncommitted, `Verdict: APPROVED`).
Also read: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
`docs/quality/refinement-plan-2026-10-28.md` (Track G2, GAP-38),
`.github/pull_request_template.md`.

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires before the push, and it is not an owner decision (P-7). No owner words are
claimed below other than the request and go-ahead already quoted in `plan.md` section 1.

## Decision

**Approved for the owner, with the push and merge conditions below.** The change does what
the owner asked and the "Done when" holds locally. Two things must happen before the push:
PR #74 must leave the queue, because it also changes `ENGINEERING_STANDARDS.md`, and then the
branch is rebased. The four Minor findings F1 to F4 are not fixed in this change. All four
come unchanged from the admin API's copy of the same routes. Each gets a named follow-up,
and F4 must be fixed before the public API takes traffic (ISO-5).

## What I verified myself (19 November 2026, read-only, Release)

| # | Check | Command | Exit | Result |
|---|---|---|---|---|
| V1 | Base and drift | `git fetch origin; git rev-parse origin/rebuild/dotnet-platform; git log --oneline 8027e87..origin/rebuild/dotnet-platform` | 0 | Base is now `1c0d7f4`. Two commits since `8027e87`: `3d4fb82` GAP-NEXT-UPGRADE (#72) and `1c0d7f4` GAP-11 records (#75) |
| V2 | Drift against ISO-2 files | `git diff --name-only 8027e87 origin/rebuild/dotnet-platform \| grep -Fxf - <ISO-2 file list>` | 1 | No shared path. The drift is `website/package.json`, `website/package-lock.json` and docs |
| V3 | Scope | `git diff --stat 8027e87...HEAD` | 0 | 43 files, all named in plan section 4: the two new projects, `api/tests/Shared/ReferenceGuard.cs`, `GuardCanary.cs`, `FormsLibraryTests.cs`, the admin test csproj (+1), `DigitalHub.slnx`, `api/README.md`, `ENGINEERING_STANDARDS.md` (the P-5 and S-2 "Enforced by" cells only, which I read), `website/test/no-hiring-system.test.ts` (line 114 only, which I read), `ci.yml` (one 9-line step with no `uses:`, which I read), and the ISO-2 records. Nothing under `api/src/DigitalHub.Api`, `Forms`, `Images`, `studio`, `docs/adr` or `.github/security` changed |
| V4 | Red before fix (B-6, P-4) | `git log --oneline 8027e87..HEAD`; `git show --name-only` per commit | 0 | Order: `2c99456` plan, `7049d28` canary (red), `917055b` guard widened, `325ff24` project, `19db9b5` suite (red), `30a9018` forms served, `0568cbb` 404 gate, `1193375` literal SQL, `d3b6282` CI step and docs. Both red commits come before their fixes. Only `d3b6282` touches `.github/` (plan-approval condition 3) |
| V5 | Commit subjects and trailers (B-4) | `git log --format='%h %s%n%b' 8027e87..HEAD` | 0 | All 9 subjects are imperative and prefixed `ISO-2:`. Every commit carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. I read the body of `0568cbb`: it says why (ADR 0001 point 1, no scheme, so a gate) |
| V6 | Build | `cd api; dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)`, the base's count |
| V7 | The "Done when" suite, re-run | `dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=tl-public.trx"` (with no `testhost`/`vstest` running before; count `0`) | 0 | `Passed! - Failed: 0, Passed: 71, Skipped: 0, Total: 71`. `<Counters total="71" executed="71" passed="71" failed="0" ...>`. The trx holds `PublicRouteTests.Only_the_two_form_routes_are_mapped` and `PublicRouteTests.Every_other_path_and_method_returns_404`, and all 71 outcomes are `Passed` |
| V8 | The F1 hand-off guard, re-run | `dotnet test tests/DigitalHub.Api.Tests/... -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"` | 0 | `Passed! - Failed: 0, Passed: 3, Total: 3` |
| V9 | Code read | `PublicRouteGate.cs`, `Program.cs`, `appsettings.json` | — | The gate allows only POST on the two exact paths (case-insensitive) and sends a 404 problem for everything else. It runs after request logging and the exception shield, and before the body limit and the rate limiter. `Auth` and a missing `PublicForms` connection string both stop start-up. There is no `AddAuthentication` and no Identity. `AllowedHosts` is `"*"` (O-1) |
| V10 | F4 is inherited | `grep -n 'Message:lj\|MessageTemplate' api/src/DigitalHub.Api/Program.cs api/src/DigitalHub.PublicApi/Program.cs` | 0 | The console template and the request-log template are the same in both APIs (admin lines 37 and 267, public lines 26 and 137). So the tester's F4 holds for both processes |
| V11 | Baselines on the current base | `gh run list --branch rebuild/dotnet-platform --workflow CI` gives `44542655976`, `push`, `success`, head `1c0d7f4`. `gh run download 44542655976 -n api-test-report` and `-n studio-e2e-report` | 0 | `api-tests.trx`: 593 names, sorted sha256 `b39d4859a8f15ce02e4a8f0e4a5ce12b56cccce980d1e42800ed48cfea2e8b95`, `total="593" ... failed="0"`. That is the same hash as base run 44535111169 (the tester checked that one). `e2e-junit.xml`: `tests="34" failures="0" skipped="0" errors="0"`, 34 `<testcase name=...>` hashing to `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a`. So the merge baselines stay the same after the rebase |
| V12 | Open PRs and file conflicts | `gh pr list --state open`; `gh pr view 74 --json files,state`; `gh pr diff 74` | 0 | Open: #74 (GAP-09-status, not a draft) and #60 (draft diag, `studio/e2e/redirects.spec.ts`). **#74 changes `ENGINEERING_STANDARDS.md`** (rows G-3 at line 56 and G-15 at line 68). ISO-2 changes rows P-5 (line 26) and S-2 (line 80) of the same file. The hunks do not overlap, so git would merge them. But `AGENTS.md` says "Parallel changes must change different files". See push condition P2 |

What I did not re-run, and why: the full admin suite (594), the website, the Studio, Semgrep
and the attacker probes. The tester ran each of them as quoted in `test-report.md` sections
2 to 4, with commands, exit codes and output. I checked their admin-name baseline against a
second base run myself (V11). gitleaks (C17), actionlint (C18) and the end-to-end suite
(C19) are NOT RUN locally by anyone. The CI jobs `gitleaks-pr`, `actionlint` and `studio`
cover them on the PR head (merge conditions M4 to M6).

### The tester's evidence is real

The tester worked on a detached checkout that has since been removed, and did not build the
change. Each red state is quoted by test name with its failure message: `7049d28` 1 failed
of 3, `19db9b5` 37 of 71, `30a9018` 3 of 71. The tester grouped the 764 mismatches into
G1 to G3 with their own `awk`. They downloaded base run 44535111169 and reproduced the admin
name hash. The NOT RUN items give a reason and the CI job that covers each. The attempted
end-to-end run (C19) was stopped by the session's permission check on dropping
`DigitalHubContent_E2e`, and was not worked around. That is the right call.

### Coverage table

Every row of `implementation.md` section 11 has evidence or a named NOT RUN, and the
tester's section 7 verifies them independently. Three rows are open by design and become
merge conditions: "The suite runs in CI" (M1), "Every base end-to-end test still passes"
(M3), and "`AllowedHosts` ... in the PR body's Open items" (done in the draft below).
O-4 (the T-F1 canary lives in the admin test assembly) is answered by the developer's
one-off T-G1 (`implementation.md` section 7), which failed on `DigitalHub.Forms` and on
`DigitalHub.PublicApi`, each with the four forbidden names, and then had its scratch
removed. The tester accepted it unrepeated, and I accept it. The committed T-G3 (14 rows)
and T-G2 (on the real assemblies) keep the guard honest after this change.

### Plan-approval conditions

All nine are met, as `implementation.md` section 9 records and the tester confirms. My
checks: condition 3 (V4: no `.github/` before commit 7; #68 `MERGED`, recorded), condition 4
(V4: order kept; baselines from run 44535111169), condition 6 (the draft below carries
`AllowedHosts` and F-1), and condition 8 (`git rev-parse --abbrev-ref @{u}` gives
`fatal: no upstream configured for branch 'change/ISO-2'`, and
`git ls-remote --heads origin change/ISO-2 | wc -l` gives `0`: nothing is pushed).

## Findings F1 to F4: decision

The tester found no Blocker and no Major. F1 to F4 are Minor. All four are the admin API's
behaviour today, on the same routes. The approved plan (3.1) told the developer to port it
unchanged: "same route, verb, rate-limit policy, body limits and body". The tester notes
that changing any of them is a behaviour change, and only the owner decides those (P-7). I
do not change them here, and I do not claim owner words for leaving them.

**Accepted for this pull request as inherited behaviour.** This is not an exception under
`ENGINEERING_STANDARDS.md` section 6, so no D-NNN entry is added. Each follow-up below is a
proposal for the owner to schedule. Any follow-up should fix both APIs in one change, so
the copies do not drift (the F-1 reason).

| Finding | Why it is acceptable in ISO-2 | Named follow-up (proposed, for the owner) |
|---|---|---|
| F1. Unknown and duplicate JSON fields are accepted on `/contact` (A-5) | No data impact: `id` and `status` do not bind, because the DTO has no such members. A-5 is already recorded as "Partial: request DTOs not verified". Refusing unknown fields changes the contract the website's form relies on, which is a behaviour change | Rollout step 6, "request-body unknown-field test" (A-5): `UnmappedMemberHandling.Disallow` on both APIs, a red test first, and the website form shown to still post |
| F2. 400 bodies echo .NET type and parser text (S-4, A-6) | It discloses type names only, with no data or secrets. The admin API answers the same way today | One "error bodies" change with F3 (A-6, alongside O-5): a fixed safe message per field. **That change must also correct `ENGINEERING_STANDARDS.md` S-4**, which says "Met" although F2 shows internals in error bodies. I am naming that record gap, not changing the status |
| F3. 415 has no `code` and carries `traceId` (A-6) | Shape only. The status is right and no internals are exposed. A-6 is already Partial | Same change as F2: a 415 problem with `code: "unsupported_media_type"` |
| F4. CR/LF in the path splits a console log line (A-13, CWE-117) | Weighed below | **Its own security fix, in both APIs, with a red test first (B-6), merged before ISO-5** |

**F4 weighed.** This is log forging. An anonymous caller can add a fake line to the operator's
console log. It cannot read data, run code or bypass the gate: the request still gets 404.
It is a real security defect, not a style point. It undermines A-13 ("one structured log
line per request"), and the public process logs every refused probe by design. I have
decided it does not block this pull request, for three reasons:

1. **ISO-2 ships nothing.** Nothing deploys until Phase D. The public API is reachable from
   the website's domain only once ISO-5 adds the proxy rule. Until then, no client outside
   CI and the local machine reaches it.
2. **It is not new.** The admin API has the identical template (V10) on the identical routes.
   That is the process that serves the forms today. Fixing only the copy would split the two
   processes' logging and leave the original open.
3. **A fix that changes log output is a change of its own.** It needs a red test first
   (B-6), and in two processes, it is one fix per pull request (B-8). It should not be
   folded into a change whose plan forbids it.

What F4 must not do is reach production in the new process. So I am carrying it as a
**precondition on ISO-5**. At ISO-5's gate 1, I will not approve the plan until one of two
things is true: the F4 fix has merged for both APIs (escape or strip control characters in
logged request values, with a red test that sends `%0d%0a` and asserts one line), or the
owner has recorded their own words accepting it. This document names the follow-up only.
The owner schedules it.

## Push conditions (before `/change` pushes)

- **P1. The owner's confirmation**, quoted exactly with its date, before any push. This
  approval is not that confirmation.
- **P2. PR #74 first.** `ENGINEERING_STANDARDS.md` is changed by both #74 and ISO-2
  (V12). The plan-approval handled #68 the same way: the push waits until
  `gh pr view 74 --json state` shows `MERGED` or `CLOSED`. If the owner instead wants
  ISO-2 to go first, that is the owner's call, given in their own words, and #74 then
  rebases.
- **P3. Rebase, then show nothing moved.** `git fetch origin`, then
  `git rebase origin/rebuild/dotnet-platform` on `change/ISO-2` (local only, so no shared
  history is rewritten). Keep the nine commits separate and in order. Quote the new SHAs.
  Run `git range-diff 8027e87..d3b6282 origin/rebuild/dotnet-platform..HEAD` and show
  every commit `=` or a context-only change. A conflict, or any content change to an
  ISO-2 commit, stops the pipeline and goes back to the developer.
- **P4. Re-run on the rebased head** (Release, `DigitalHubContent_Test` only, no other
  `testhost` running): the build (`13 Warning(s)`, `0 Error(s)`), the public suite (71 of
  71), the admin suite (594 of 594), and the C4 name hash, which must equal `b39d4859…8b95`.
  Quote all four in `implementation.md` or in the gate-2 records commit.
- **P5. Commit the records.** Stage exactly `docs/changes/ISO-2/test-report.md` and
  `docs/changes/ISO-2/delivery-approval.md` (B-5). Use a B-4 subject, for example
  `ISO-2: Record the test report and gate 2 approval`, with the attribution trailer.
- **P6. Push with an explicit refspec:** `git push -u origin change/ISO-2`. Never a bare
  `git push` (B-2). Open a pull request into `rebuild/dotnet-platform`, not a draft, with
  the body below. Fill in the SHAs and run ids when they exist.

## Merge conditions (PR-head CI on the final head; the owner squash-merges)

Each condition must be quoted with its run id in the pull request before the owner merges.
A new head needs all of them again (B-3).

- **M1. Public suite in CI.** Workflow CI, job `api`: the step "Public API integration
  tests (Release)" passes. The `api-test-report` artifact holds `public-api-tests.trx` with
  `total="71"` and `failed="0"`, and both `PublicRouteTests` names are `Passed`. This is the
  CI half of "Done when".
- **M2. Admin names unchanged.** The same artifact's `api-tests.trx` has `total="594"` and
  `failed="0"`. Its sorted `testName` list, minus
  `FormsLibraryTests.The_guard_rejects_the_authentication_and_identity_assemblies`, hashes
  to `b39d4859a8f15ce02e4a8f0e4a5ce12b56cccce980d1e42800ed48cfea2e8b95`. That is the hash
  of base run **44535111169** (`8027e87`), and of run 44542655976 (`1c0d7f4`), which I
  checked (V11). If the base moves again and a later base run changes the admin names,
  compare against that run and quote it.
- **M3. End-to-end.** Job `studio`, "End-to-end suite": `e2e-junit.xml` has
  `tests="34" failures="0" skipped="0" errors="0"`, and its 34 sorted `<testcase name>`
  hash to `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a`.
- **M4. Warnings.** Job `api`, "Build (Release)": `13 Warning(s)`, `0 Error(s)`, with every
  warning in `DigitalHub.ContentImport`, so none is new.
- **M5. Security workflow.** `gitleaks-pr` and `gitleaks-history` green (C17's CI half),
  Semgrep `0 new`, and the npm and dotnet audits green.
- **M6. Workflow lint.** The `actionlint` job is green on the changed `ci.yml` (C18's CI
  half).
- **M7. The rest of CI** is green: `website`, `website-browser`, Studio Vitest and build.
  The section comparison may show only the known `/careers/apply.html` difference (O-11;
  the job is `continue-on-error`).
- **M8. After the merge**, CI, Security and Workflow lint run again on
  `rebuild/dotnet-platform` and are green (`AGENTS.md`). Their run ids are recorded.

## Open items

- P1 to P6 before the push. M1 to M8 before and after the merge.
- The public API's `AllowedHosts` (`"*"` today, O-1, hand-off item 1) and
  `ForwardedHeaders:KnownProxies` (hand-off item 2): I am carrying both into the ISO-5
  request, as condition 6 of the plan-approval asked.
- F-1, the `iso-shared-hosting` change, is proposed for the owner to schedule after ISO-4.
  Step 4e (GAP-20) must cite it (hand-off items 4 and 6).
- F4 must be fixed before ISO-5 can pass gate 1, unless the owner accepts it in their own
  words. F1 to F3 are proposed follow-ups as in the table above, and S-4's "Met" status
  needs correcting.
- ISO-3 (`dh_public_forms`; GAP-38 stays open) and ISO-4 (hand-off items 3 and 7) are
  unchanged.

## Draft pull request description

```markdown
## What and why

ISO-2 of Track G2, isolation (ADR 0001, accepted 19 November 2026). This adds a new process,
`DigitalHub.PublicApi`. It serves only `POST /api/v1/public/contact` and
`POST /api/v1/public/apply`, through the shared `DigitalHub.Forms` library, with its own
`PublicFormsDbContext` over four tables (`contact_requests`, `vacancies`, `site_settings`,
`application_counts`). It has no authentication, no Identity, no signing key and no Studio
controllers. Every other path and method gets a 404 problem from `PublicRouteGate`. It closes
part of GAP-38; the restricted login is ISO-3.

It also carries ISO-1 gate 2's F1 hand-off. The forms-library guard (`ReferenceGuard`, now
shared by both test projects) forbids `Microsoft.AspNetCore.Identity*`,
`Microsoft.AspNetCore.Authentication*`, `Microsoft.Extensions.Identity*` and
`Microsoft.IdentityModel*`. A committed canary (`GuardCanary`, T-F1) proves the guard can
fail, and the guard runs on `DigitalHub.PublicApi` too.

## Scope and boundaries

In scope: `api/src/DigitalHub.PublicApi/`, `api/tests/DigitalHub.PublicApi.Tests/`,
`api/tests/Shared/ReferenceGuard.cs`, `GuardCanary.cs` and `FormsLibraryTests.cs`, one line of
the admin test csproj, `api/DigitalHub.slnx`, `api/README.md`, the "Enforced by" cells of P-5
and S-2 in `ENGINEERING_STANDARDS.md`, line 114 of `website/test/no-hiring-system.test.ts`,
and one test step in `.github/workflows/ci.yml`.

Out of scope, deliberately untouched: the admin API (`api/src/DigitalHub.Api`) still serves
its own copy of both routes until ISO-4, which merges after ISO-5. Also untouched:
`DigitalHub.Forms`, `DigitalHub.Images`, the Studio, `web.config` (ISO-5), the database
login (ISO-3), migrations (none), and `docs/adr`.

## Security impact

- New anonymous process, two POST routes. The deny-by-default is `PublicRouteGate`. ADR 0001
  says "its fallback policy denies everything else"; with no authentication scheme, an
  authorization fallback cannot deny, so the gate does. It runs before the body limit and
  the rate limiter, so a refused request costs nothing.
- Start-up refuses any `Auth` section and a missing `ConnectionStrings:PublicForms`.
- No authentication or Identity assembly is referenced (C8: 41 references), and the guard
  enforces that.
- Data: four tables through its own context. The login is still `dh_content_app` until
  ISO-3, so GAP-38 stays open.
- Not deployed and not reachable from the website's domain until ISO-5.
- Inherited Minors F1 to F4 are listed under "Review findings accepted".

## Tests and evidence

Local (Release, `DigitalHubContent_Test` only), on head `<final SHA>`:
- `dotnet build DigitalHub.slnx -c Release`: exit 0, `13 Warning(s)`, `0 Error(s)`.
- Public suite: exit 0, `Passed: 71, Total: 71`. It includes
  `PublicRouteTests.Only_the_two_form_routes_are_mapped` and
  `PublicRouteTests.Every_other_path_and_method_returns_404`.
- Admin suite: exit 0, `Passed: 594, Total: 594`. Names minus T-F1 hash to `b39d4859…8b95`,
  equal to base runs 44535111169 and 44542655976.
- Red first: `7049d28` (T-F1, 1 failed of 3), `19db9b5` (37 failed of 71), `30a9018`
  (3 failed of 71, the 404 gate only). Each was green at its planned fix.
- Semgrep `1 known, 0 new`; npm and dotnet audits `0 new`; website and Studio Vitest, build
  and design check green; section comparison shows only the known `/careers/apply.html`
  difference.
- Attacker probes on a live host: methods, encodings, dot-segments, override headers,
  smuggling, 20 MB and 40 MB bodies, and `Auth` start-up refusals. See `test-report.md`
  section 4.
- NOT RUN locally: gitleaks (not installed; `gitleaks-pr`), actionlint (Linux binary;
  `actionlint`), and the end-to-end suite (the harness drops `DigitalHubContent_E2e`;
  job `studio`).

PR-head CI (run ids to be filled in):
- CI `<run id>`: `public-api-tests.trx` `total="71" failed="0"`; `api-tests.trx`
  `total="594" failed="0"`, names hash `b39d4859…8b95`; end-to-end `tests="34" failures="0"`,
  names hash `ed0f1b41…848a`; build `13 Warning(s)`.
- Security `<run id>`: gitleaks, Semgrep, audits.
- Workflow lint `<run id>`: actionlint.

Records: `docs/changes/ISO-2/` (plan, plan review, both approvals, implementation, test
report).

## Owner decisions

- Request, 19 November 2026: "ISO-2 new DigitalHub.PublicApi with only POST
  /api/v1/public/contact and /apply, its own small DbContext over four tables, no Identity,
  no signing key. Refinement plan Track G2, ISO-2, closes part of GAP-38; ADR 0001 (accepted
  19 November 2026, owner's words: "accepted"). Done when its own integration suite passes
  against DigitalHubContent_Test and a test proves every other path returns 404. Also
  carries ISO-1 gate 2's F1 hand-off: widen the forms-library guard's forbidden list to
  cover Microsoft.AspNetCore.Identity and Microsoft.AspNetCore.Authentication*, add a canary
  proving the guard can fail, and apply the guard to DigitalHub.PublicApi."
- Go-ahead, 19 November 2026: "start iso 2".
- Push confirmation: `<owner's words, date>`.
- No other owner decision is claimed. F1 to F4 are left as inherited behaviour, not changed.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met. "Done when" holds locally, and
      its CI half is M1. `AllowedHosts` and the proxy are deploy-time concerns, named for
      ISO-5.
- [x] Code follows the engineering standards. The duplication is measured and owned by F-1.
- [x] No new prohibited constructs in touched code. Data access goes only through
      `PublicFormsDbContext`/`PublicFormsData`. The Semgrep SQL finding in the test fixtures
      was fixed (`1193375`), not suppressed.
- [x] Every new or changed route has a guard. The two routes are anonymous by ADR 0001,
      rate-limited and size-capped. Every other path is refused by `PublicRouteGate`. No
      route carries a record id.
- [x] Tests exist for the behaviour changed, and every security fix has a regression test
      (T-F1 red first). Changed-line coverage: no gate exists yet (G-8 Gap, step 4d).
- [ ] PR checks are green on the final head (run ids quoted). **Open** until CI runs on
      the final head.
- [x] Independent code review was run, and its findings are fixed or explicitly accepted
      below. Covered by plan review rounds 1 and 2, the tester's Round 1 and both
      tech-lead gates.
- [x] Reviewed by someone other than the author. The tester did not build the change, and
      the approver's review is recorded in `delivery-approval.md`.
- [x] Rollback is understood: revert this PR. There is no schema or data change, and
      nothing routes to the new process yet.
- [ ] Deployment note: nothing deploys until Phase D. The owner squash-merges into
      `rebuild/dotnet-platform`, and CI, Security and Workflow lint run again after the
      merge. **Open** until those post-merge run ids are recorded.

## Review findings accepted

All four are the admin API's current behaviour on the same routes, ported unchanged as the
plan required. Changing them is a behaviour change, so the owner schedules each follow-up.
- F1 (Minor): unknown and duplicate JSON fields are accepted on `/contact` (A-5). No field
  binds that should not. Follow-up: rollout step 6, unknown-field rejection on both APIs.
- F2 (Minor): 400 bodies echo .NET type and parser text (S-4, A-6). Follow-up: one
  "error bodies" change with F3, which also corrects S-4's "Met" status.
- F3 (Minor): 415 has no `code` and carries `traceId` (A-6). Follow-up: as F2.
- F4 (Minor, security): CR/LF in the path splits a console log line (A-13, CWE-117), in
  both APIs. It does not ship: nothing deploys, and the process is unreachable until ISO-5.
  Follow-up: its own red-first fix in both APIs, required before ISO-5 passes gate 1 unless
  the owner accepts it in their own words.
- Plan review Minors R2-1 and R2-2 were met (plan-approval conditions 1 and 2).

## Open items

- `AllowedHosts` is `"*"` in the public API's `appsettings.json`. The website host must be
  set in Production, in ISO-5 (or ISO-6), together with `ForwardedHeaders:KnownProxies` for
  the IIS proxy.
- F-1, `iso-shared-hosting`: move the copied hosting infrastructure (groups A, C and E)
  into one place after ISO-4, then retire or shrink the parity test T-D1. Proposed for the
  owner to schedule. Step 4e (GAP-20) must cite it.
- F1 to F4, as above. The F4 fix (both APIs) comes before ISO-5.
- ISO-3: the `dh_public_forms` login (`ConnectionStrings:PublicForms` in `PublicApiFactory`).
  GAP-38 stays open until then.
- ISO-4: delete the admin copies (groups D and F), keep a forwarded-headers test on the
  admin, and keep `docs/PROJECT_PROFILE.md` line 21 true (T-R1 becomes the only matrix
  entry for the two routes).

## Governance

- [x] Coverage table updated (`docs/changes/ISO-2/implementation.md` section 11,
      `test-report.md` section 7)
- [x] `docs/deferred-items.md`: not changed. No exception is granted; F1 to F4 are inherited
      behaviour with named follow-ups
- [x] Documentation updated (`api/README.md`; the P-5 and S-2 "Enforced by" cells)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
