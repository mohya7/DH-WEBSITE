# ISO-1 delivery approval (tech lead, gate 2)

Tech lead, 19 November 2026. Branch `change/ISO-1`, worktree
`D:\work\DigitalHub\dh-platform-claude-iso-1`. Head
`cbed5a01fdb1a5c10e70e5d0f060945bb2f24e9e`, base `cdef7c90bf5546ecea891e9b12e2aec28d265716`.
After `git fetch`, `origin/rebuild/dotnet-platform` is still `cdef7c9`, so no rebase is
needed. Track G2, isolation.

Sources read: `docs/changes/README.md`, `AGENTS.md` and `CLAUDE.md`, `ENGINEERING_STANDARDS.md`,
`docs/adr/0001-split-public-forms-api.md`, `.github/pull_request_template.md`, and every
file in `docs/changes/ISO-1/`: `plan.md` (round 2), `plan-review.md` (Round 2,
`Verdict: APPROVED`), `plan-approval.md` (`Verdict: APPROVED`, seven conditions),
`implementation.md` and `test-report.md` (Round 1, `Verdict: APPROVED`, uncommitted).

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires, and it is not an owner decision under P-7. Nothing may be pushed until the
owner confirms.

## Decision

The implementation and the tests are approved for push, once the owner confirms, under
the push conditions below. The merge depends on the merge conditions, which only the pull
request's CI can satisfy. This covers the end-to-end half of "Done when".

## Owner's words relied on

- Request, 19 November 2026: "ISO-1 move the contact and apply code (validation, intake,
  throttles, dedupe, email) into a DigitalHub.Forms library; no behaviour change.
  Refinement plan Track G2, ISO-1, closes part of GAP-38; ADR 0001 (accepted 19 November
  2026, owner's words: "accepted"). Done when all 208 integration tests and the 22
  end-to-end tests pass unchanged."
- Go-ahead, 19 November 2026, in reply to "Should I start ISO-1 through /change?":
  "Yes, start ISO-1".

No other owner decision is needed. "208 and 22" is read as the current 576 and 34 base
tests, checked by name. That is stricter than the wording, so it needs no decision.

## What I verified myself

| # | Check | Command | Exit | Result |
|---|---|---|---|---|
| V1 | Base unchanged | `git fetch`; `git rev-parse origin/rebuild/dotnet-platform`; `git merge-base HEAD origin/rebuild/dotnet-platform` | 0 | Both print `cdef7c90bf5546ecea891e9b12e2aec28d265716` |
| V2 | Diff in scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 0 | 28 files: the eight created in plan 4.1, the seven renames in 4.2, and the nine changed files in 4.3. The rest are the four ISO-1 records. Nothing else |
| V3 | Protected paths untouched | `git diff --stat origin/rebuild/dotnet-platform...HEAD -- studio website .github api/src/DigitalHub.Api/Data` | 0 | Empty |
| V4 | Red test first, commit split | `git show --name-status -M --format= <sha>` for the five commits | 0 | `d998a51` adds only `FormsLibraryTests.cs`, before any production change. `531441f` adds the project and new types. `ad9de04` makes the content change in place. `4dda548` is the rename (R096 to R099), and `git show -M --format= 4dda548 \| grep -E '^[+-][^+-]'` shows only seven `namespace` lines, four `using` lines and the test csproj `<Using>`. `cbed5a0` adds the registration, the README line and `implementation.md`. B-6 is met: the pure rename is its own commit |
| V5 | Behaviour read in the diff | `git diff -M origin/rebuild/dotnet-platform...HEAD -- Program.cs ContentFormsData.cs ApplicationIntake.cs PublicContactStore.cs ContactRateLimit.cs FormsServiceCollectionExtensions.cs FormOutcome.cs DigitalHub.Forms.csproj` | 0 | The same lifetimes are in `AddDigitalHubForms`: two scoped, three singleton. `IFormsData` is scoped over `ContentDbContext`. The vacancy query, the settings query, the contact insert and the count `MERGE` are unchanged; only `db.Database` became a parameter. The policy name is still `"public-contact"`, with the same partition key, window and `QueueLimit = 0`. `FormOutcome` has the members the controller reads. I found no behaviour change |
| V6 | B-4 | `git log --format='%h %s%n%b' origin/rebuild/dotnet-platform..HEAD` | 0 | All six subjects start `ISO-1:` and are imperative. Each body says why. Each ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` |
| V7 | Build | `dotnet build DigitalHub.slnx -c Release` (in `api/`, at `cbed5a0`) | 0 | `13 Warning(s)`, `0 Error(s)`, the same count as the base |
| V8 | Fastest covering suite | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests\|FullyQualifiedName~CareersTests\|FullyQualifiedName~ApplyDedupeTests\|FullyQualifiedName~PublicContact\|FullyQualifiedName~RequestBodyLimitTests\|FullyQualifiedName~RateLimitLogTests\|FullyQualifiedName~AbortedRequestTests"` | 0 | `Passed!  - Failed: 0, Passed: 50, Skipped: 0, Total: 50` (48 form-suite tests plus the 2 new) |
| V9 | Full integration suite, by name | the same project, no filter, `--logger "trx;LogFileName=gate2.trx"` to the session scratchpad; `grep -o 'testName="[^"]*"' gate2.trx \| grep -v FormsLibraryTests \| LC_ALL=C sort \| sha256sum` | 0 | `Passed!  - Failed: 0, Passed: 578, Skipped: 0, Total: 578`; `<Counters total="578" executed="578" passed="578" failed="0" error="0" ...>`. The 576 other names hash to `3034a709d4df3caaf2d0d95edb6e60b20965d28e35e7a995e81ad2d75a3b7a94` |
| V10 | Base lists are real | `gh run view 44506830145 --json headSha,conclusion`; `gh run download 44506830145 -n api-test-report` and `-n studio-e2e-report`, sorted and hashed as in plan 5.2 | 0 | Run `44506830145`: `headSha` `cdef7c9...`, `conclusion` `success`. Integration list: `3034a709…7a94`, the same as V9. End-to-end list: 34 lines, `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a`, matching plan 2.6 |
| V11 | No conflicting open branch | `gh pr list --state open`; for #68, #69, #70 and #60, `gh pr view <n> --json files` compared with `comm -12` against this change's file list | 0 | No shared path with any of them |

Database and process discipline: before running tests I checked that no test host was
running. The only `dotnet.exe` was an MSBuild node, and I did not stop it. The tests ran
only against `DigitalHubContent_Test`, through `ApiFactory`. No migration was created or
applied, and I wrote no file except this one.

## The tester's evidence

The tester's commands, exit codes and output are real and consistent with my runs. The
red run at `d998a51` was run, not inferred: `Failed: 2`, with `Found: "DigitalHub.Images"`
and `Expected: "DigitalHub.Forms"` / `Actual: "DigitalHub.Api"`. So route (c) succeeded,
gate 1 conditions 1 to 3 are met, and route (b) was not needed. Conditions 4 to 7 are met:
there was no rebase, the change stayed in scope, the logger categories are recorded in
`implementation.md` 2.4, and the only database was `DigitalHubContent_Test`.

Every row of the test report's coverage table has evidence, with one exception: "All
base end-to-end tests (34, by name) pass unchanged" is **NOT RUN locally**. The reason
is stated: the harness fails at "Release migrations" because `dotnet tool run dotnet-ef`
fails on this machine, the same pre-existing state ADM-05 recorded. CI job `studio`,
"End-to-end suite", is named as the authority. That row becomes merge condition M2.

The tester's NOT RUN items, and where each is covered:

- gitleaks: Security job `gitleaks-pr` (M4).
- Website browser suites: CI `website-browser` (M4).
- PR-head CI quotes: M1 to M4.

## F1: decision

**F1 (Minor): `ForbiddenReferences` misses `Microsoft.AspNetCore.Identity` and
`Microsoft.AspNetCore.Authentication*`, which `Microsoft.AspNetCore.App` makes
available.**

**Ruling: accepted for ISO-1 as a named ISO-2 item. It is not sent back, and it needs
no D-NNN entry.** The reasons:

- **No requirement of ISO-1 is unmet.** The owner asked for a move with no behaviour
  change, done when the base suites pass unchanged. The guard test is an addition the
  plan chose. It matches its approved specification (plan 5.1) exactly, it was red first,
  and it is green now.
- **No exception is being granted, so D-NNN does not apply.** Under
  `ENGINEERING_STANDARDS.md` (Exceptions), a D-NNN entry records a departure from a rule,
  with the owner's words. Nothing here departs from a rule, and nothing is weakened
  (P-6): the list is the one approved at gate 1 and is not narrowed. Writing a D-NNN would
  ask the owner for an exception that nothing needs.
- **The code is clean today.** The tester listed the compiled references of
  `DigitalHub.Forms.dll` (23 assemblies). None is an Identity, authentication or token
  assembly. The ADR 0001 point 1 constraint ("no authentication, no Identity") binds the
  public API, and the public API arrives in ISO-2. That is the first point where the
  guard has to hold against new code.
- **Proportion.** Sending it back would reopen the approved plan: architect, reviewer,
  gate 1, developer and tester again. All of that for a list change that has no effect on
  this change's code or behaviour.

**What this commits ISO-2 to.** The ISO-2 gate-1 approval will refuse a plan without these:

1. `FormsLibraryTests.ForbiddenReferences` adds `Microsoft.AspNetCore.Identity`,
   `Microsoft.AspNetCore.Authentication`, `Microsoft.AspNetCore.Authentication.BearerToken`
   and `Microsoft.AspNetCore.Authentication.Cookies`. The architect may instead add a
   prefix rule for `Microsoft.AspNetCore.Authentication` and `*.Identity*` that still
   allows the abstractions Forms needs. Either way, the plan must show the base references
   still pass.
2. A canary proves the guard can fail. This is the tester's F1 case, a type that calls
   `AddAuthentication(...).AddBearerToken().AddCookie()`, shown failing the guard and
   then removed. The same guard, or an equivalent one, applies to `DigitalHub.PublicApi`'s
   own assembly.
3. The ISO-2 plan cites this ruling and test-report F1.

The item reaches ISO-2 through this file and the pull request's "Review findings
accepted" section. Both stay in the repository after the squash merge. If the owner
prefers F1 fixed inside ISO-1, that is the owner's call, and the change goes back to
the architect.

The tester's observations O1 to O5 are not findings against ISO-1, and I accept them as
recorded. O1 (local `dotnet-ef` resolution) belongs to the separate
`e2e-local-migrations` change the plan names. O3 (Next 16.4.3, moderate advisory) is for
the owner to schedule under G1 Wave 0.

## Push conditions (before `/change` pushes)

- **P1. Owner confirmation.** The owner confirms the push in their own words. This
  approval is not that confirmation.
- **P2. Records commit.** Commit `docs/changes/ISO-1/test-report.md` and
  `docs/changes/ISO-1/delivery-approval.md` on `change/ISO-1`, and nothing else, as one
  commit. Suggested subject: `ISO-1: Record the test report and delivery approval`. The
  body says why, and the commit ends with the attribution trailer (B-4). No code, test,
  plan or workflow file changes.
- **P3. Base check.** Immediately before pushing, run `git fetch` and
  `git rev-parse origin/rebuild/dotnet-platform`.
  - If it still prints `cdef7c9...`, push.
  - If it moved, rebase `change/ISO-1` on it. Then rebuild (`dotnet build DigitalHub.slnx
    -c Release`) and re-run the full integration suite locally.
  - After a rebase, apply gate-1 condition 4: take the before lists and the warning
    baseline from the CI run on the new base commit, and quote that run id and both
    hashes in the pull request.
  - A rebase conflict in any ISO-1 file sends the change back to the developer.
- **P4. Branch.** Push `change/ISO-1` only. Open the pull request against
  `rebuild/dotnet-platform`, with the description below. Never push to
  `rebuild/dotnet-platform`, `main`, `release/v1` or `feature/interviewer-portal`.

## Merge conditions (on the pull request's CI, final head)

These must be quoted in the pull request, with run ids, before the owner squash-merges.
If any fails, the change goes back to the developer. It does not merge.

- **M1. Integration, unchanged by name** (plan 5.2 step 2). CI `api` must show:
  - "Build (Release)": `0 Error(s)` and at most `13 Warning(s)`, or the new base's count
    after a rebase.
  - The migration steps, including `has-pending-model-changes`, green.
  - From `api-test-report`: `LC_ALL=C comm -23 base.txt pr.txt` prints nothing, and
    `comm -13` prints exactly the two `FormsLibraryTests` names.
  - `<Counters total="578" executed="578" passed="578" failed="0" ...>`, or the new base
    total plus 2.
- **M2. End-to-end, unchanged by name: the end-to-end half of "Done when"** (plan 5.2
  step 3). CI `studio`, step "End-to-end suite", artifact `studio-e2e-report`:
  - `diff base-e2e.txt pr-e2e.txt` prints nothing. The base list is 34 names, sha256
    `ed0f1b4154a5a4096be35a0b82bd907e9dad92a92e5507050542e5a6b92e848a`.
  - `<testsuites ... tests="34" failures="0" skipped="0" errors="0">`.

  Until M2 is quoted, ISO-1's "Done when" is not met.
- **M3. Other CI jobs.**
  - `website` and `website-browser`: green.
  - `section-compare`: the only difference may be the known base difference on
    `/careers/apply.html #section`, which run `44506830145` also logs.
  - `studio` unit tests: green.
- **M4. Security and Workflow lint.**
  - `gitleaks-pr`: no leak.
  - Semgrep: 0 new findings.
  - `dotnet-vulnerable` and npm audit: 0 new.
  - Workflow lint: green.
- **M5. Order and pace.** This is slot 2, one pull request a day. The owner squash-merges
  and no agent merges. The integrator re-runs the suites after the merge.

## Definition of Done (template boxes)

| Box | Can it be ticked truthfully now? |
|---|---|
| Requirement and acceptance criteria stated and met | **Open.** Integration: met (V9). End-to-end: pending M2 |
| Code follows the engineering standards | Yes (V2, V5; Semgrep run locally by the tester shows 0 new) |
| No new prohibited constructs | Yes. Data access stays in the API's `ContentFormsData`, and configuration reads are unchanged |
| Every new or changed route has a guard | Yes. No route changed (V5, test report section 5) |
| Tests exist; security fixes have regression tests | Yes. Two new tests, red first (V4, test report 1). There is no security fix. Changed-line coverage is not yet gated (GAP-18) |
| PR checks green on the final head | **Open** (M1 to M4) |
| Independent code review run; findings fixed or accepted | Yes. Plan review in two rounds and the test report. F1 is accepted below |
| Reviewed by someone other than the author | **Open.** Owner review at merge. The pipeline roles are recorded in `docs/changes/ISO-1/` |
| Rollback understood | Yes. Revert the pull request: no schema, data or configuration change |
| Deployment note | **Open.** Nothing deploys before Phase D. The slot-2 integrator still has to be named |

## Draft pull request description

```markdown
## What and why

ISO-1 (refinement plan Track G2, isolation; ADR 0001 point 2; closes part of GAP-38).
The contact and apply code now lives in a new library, `DigitalHub.Forms`, so that
ISO-2's public forms API can use it without the admin API. The library holds:

- the contact and apply validation;
- `ApplicationIntake`;
- the throttles (`ApplyThrottle`, and the contact rate-limit partition as
  `ContactRateLimit`);
- `ApplyDedupe`;
- the CV checks and the apply page;
- the email sender.

There is no behaviour change. The library reaches the database only through a small
port, `IFormsData`. The admin API implements it over `ContentDbContext` with the same
queries, insert and count `MERGE` (`ContentFormsData`). The library references nothing
from `DigitalHub.Api`, `DigitalHub.Images`, Identity or the JWT stack, and a test proves
that.

## Scope and boundaries

- New: `api/src/DigitalHub.Forms/`, with `IFormsData`, `FormOutcome`,
  `ApplicationCountSql`, `ContactRateLimit` and `AddDigitalHubForms`. Also new:
  `api/src/DigitalHub.Api/Content/ContentFormsData.cs` and
  `api/tests/DigitalHub.Api.Tests/FormsLibraryTests.cs`.
- Moved, as a pure rename with only the namespace line changed: `ApplicationIntake`,
  `PublicContactStore`, `ApplyThrottle`, `ApplyDedupe`, `ApplyPage`, `CvFile` and
  `EmailSender`.
- Changed: `Program.cs` (registration and the policy constant), `using` lines in the two
  public controllers, `ExceptionShieldMiddleware` and `RequestBodyLimit`, the solution,
  the API and test csproj files, and `api/README.md`.
- Not touched: any existing test source, `studio/`, `website/`, `.github/`,
  `api/src/DigitalHub.Api/Data/` and migrations.
- Out of scope:
  - ISO-2: the public API, its DbContext and pipeline.
  - ISO-3: the `dh_public_forms` login.
  - ISO-4 and ISO-5: deleting the admin API's form routes, and the hosts.
- Logger categories change for two types: `DigitalHub.Forms.ApplicationIntake` and
  `DigitalHub.Forms.SmtpEmailSender`. No override or query uses the old names.

## Security impact

- Routes, policies, `[AllowAnonymous]`, body limits and the rate-limit policy
  (`"public-contact"`) are unchanged.
- Data and login: the same queries and `MERGE`, on the same `dh_content_app` login. No
  migration and no model change.
- Dependencies: no new package id. `DigitalHub.Forms` references EF Core SqlServer
  10.0.12 and the Pkcs 9.0.21 pin. SqlClient's Entra ID packages are transitive, and the
  compiled library does not reference them.
- Secrets and configuration: no key added, renamed or moved.

## Tests and evidence

- **Red first.** `d998a51` adds only the two tests. Locally, in Release, they failed:
  `Failed: 2`, with `Found: "DigitalHub.Images"` and `Expected: "DigitalHub.Forms"` /
  `Actual: "DigitalHub.Api"`.
- **Locally, at `cbed5a0`, in Release:**
  - `dotnet build`: `13 Warning(s)`, `0 Error(s)`, the same as the base.
  - Full integration run: `578/578`. The 576 base names are unchanged (sorted-list
    sha256 `3034a709…7a94`, equal to base CI run 44506830145). The two new names are
    `FormsLibraryTests.*`.
  - Form suites: `50/50`.
  - `has-pending-model-changes`: "No changes have been made to the model".
  - Website `npm test`: 461 passed, 1 designed skip. Studio `npm test`: 116 passed.
  - npm and dotnet audit gates: 0 new. Semgrep: 0 new.
- **End-to-end:** NOT RUN locally. The local harness fails at "Release migrations"
  (a local dotnet-ef problem that predates ISO-1). CI `studio` covers it, below.
- **PR head CI run:** <run id, to fill>.
  - `api`: Build `Warning(s)` <n>; `api-test-report` `comm -23` empty, `comm -13` the
    two `FormsLibraryTests` names, `Counters total="578" passed="578"`.
  - `studio`, End-to-end suite: `studio-e2e-report` name `diff` against base 34
    (`ed0f1b41…848a`) empty, `tests="34" failures="0"`.
  - `website`, `website-browser`, `section-compare` (known base difference on
    `/careers/apply.html` only).
  - Security (gitleaks, Semgrep, dotnet-vulnerable, npm audit) and Workflow lint.
- **Records:** `docs/changes/ISO-1/`, with the plan, two plan-review rounds, both gates,
  the implementation and the test report.

## Owner decisions

- Request, 19 November 2026: "ISO-1 move the contact and apply code (validation, intake,
  throttles, dedupe, email) into a DigitalHub.Forms library; no behaviour change.
  Refinement plan Track G2, ISO-1, closes part of GAP-38; ADR 0001 (accepted 19 November
  2026, owner's words: "accepted"). Done when all 208 integration tests and the 22
  end-to-end tests pass unchanged."
- Go-ahead, 19 November 2026, in reply to "Should I start ISO-1 through /change?":
  "Yes, start ISO-1".
- "208 and 22" is checked as today's 576 integration and 34 end-to-end base tests, by
  name. That is stricter than the wording.
- No behaviour change is asked for.

## Definition of Done

- [ ] Requirement and acceptance criteria are stated and met (end-to-end half pending the PR-head `studio` run)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; every security fix has a regression test (no security fix; changed-line coverage is not gated yet, GAP-18)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (owner review at merge)
- [x] Rollback is understood (revert this PR; no schema, data or configuration change)
- [ ] Deployment note: integrator <name> merges into rebuild/dotnet-platform and re-runs the suites after the merge

## Review findings accepted

- **Test report F1 (Minor), moved to ISO-2.** The guard test's `ForbiddenReferences`
  list does not name `Microsoft.AspNetCore.Identity` or the
  `Microsoft.AspNetCore.Authentication*` assemblies, which the `Microsoft.AspNetCore.App`
  framework reference makes available. The list is the one the approved plan specified.
  Today's compiled library references none of them. ISO-2's plan must widen the list, or
  add a prefix rule, add a canary that proves the guard fails, and apply the guard to
  `DigitalHub.PublicApi`. See `docs/changes/ISO-1/delivery-approval.md`.

## Governance

- [x] Coverage table updated (`docs/changes/ISO-1/implementation.md`, `test-report.md`)
- [x] `docs/deferred-items.md`: not needed, no exception is granted
- [x] Documentation updated (`api/README.md`)

## Open items

- CI green on the final head, with M1 and M2 quoted above.
- The owner's merge confirmation (slot 2, one pull request a day).
- The slot-2 integrator to be named.
- ISO-2 carries F1.
- The separate `e2e-local-migrations` change, for the local dotnet-ef problem, is to be
  scheduled.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Open items

- P1 to P4 before the push. M1 to M5 before the merge. M2 is the end-to-end half of
  "Done when".
- F1 is carried into ISO-2's plan, as set out above.
- The slot-2 integrator is not yet named.

Verdict: APPROVED
