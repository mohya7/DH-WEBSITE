# GAP-12: delivery approval (gate 2)

Technical lead, 2026-11-01, gate 2 on branch `change/GAP-12` at `b01fee4`
(worktree `/home/user/wt-GAP-12`), base `origin/rebuild/dotnet-platform` at
`6470fac`. Read: the role definition, `docs/changes/README.md`,
`ENVIRONMENT.md` and `.github/pull_request_template.md` from the read-only
reference copies (they are not on the base branch), and every file in
`docs/changes/GAP-12/`: `plan.md`, `plan-review.md`, `plan-approval.md`,
`implementation.md` and `test-report.md`. This approval is a pipeline role,
not the owner's confirmation, and it is not an owner decision (P-7).

## Decision

Approved. The change may go to the owner. It must not be pushed, opened as a
pull request or merged without the owner's OK, and it merges after GAP-01
(Wave 0); see Open items.

## Prerequisites

- `implementation.md` exists, ends "Status: READY FOR TEST".
- `test-report.md` Round 1 ends `Verdict: APPROVED`, with no Blocker, Major or
  Minor.

## What I verified myself

**Diff against the plan.** `git merge-base origin/rebuild/dotnet-platform HEAD`
is `6470fac`, the plan's base. `git diff --stat origin/rebuild/dotnet-platform...HEAD`:

```
 api/src/DigitalHub.Api/Program.cs                  |   4 +
 .../DigitalHub.Api.Tests/ServerHeaderTests.cs      | 122 ++++++++
 docs/changes/GAP-12/implementation.md              | 240 +++++++++++++++
 docs/changes/GAP-12/plan-approval.md               |  84 ++++++
 docs/changes/GAP-12/plan-review.md                 |  91 ++++++
 docs/changes/GAP-12/plan.md                        | 335 +++++++++++++++++++++
 docs/security-deployment.md                        |  12 +
 7 files changed, 888 insertions(+)
```

Exactly the plan's scope table (section 4), nothing else: no `ApiFactory`,
`SecurityHeadersMiddleware`, other test, `.github`, package or lockfile change.
`Program.cs` gains the one statement and the two-line comment from plan
section 3, right after `WebApplication.CreateBuilder(args)`. The docs section
"API: response headers" sits before "Studio: headers and routing", as planned.

**Gate 1 conditions, checked in the code.**

| Condition | Result |
| --- | --- |
| 1. Test committed alone before the fix; red run quoted | `a37d618` touches only `ServerHeaderTests.cs` (122 lines); `ff00c76` holds the fix. Red run in `implementation.md` and reproduced in `test-report.md` section 1: guard passed, 4 cases failed on lines 49, 62, 86 with "Unexpected Server header: Kestrel" / `"Server: Kestrel"` |
| 2. `UseKestrel` callback only listens on loopback port 0 | `KestrelFactory` constructor: `UseKestrel(options => options.Listen(IPAddress.Loopback, 0));` and nothing else; `AddServerHeader` is not set in the test |
| 3. `StartServer()` in the constructor | Test class constructor calls `_factory.StartServer()` then `CreateClient()` |
| 4. Raw-socket failure quoted; 10-second timeout kept | `CancellationTokenSource(TimeSpan.FromSeconds(10))`; red failure is the `DoesNotContain` on the head lines in 20 to 22 ms, not a timeout |
| 5. Live check lists exact environment, `_Test` database, test-only values | `implementation.md` lists it (`env -i`, `Database=DigitalHubContent_Test`, `ApiFactory`'s test-only `Auth__*`), port 4288, process stopped |
| 6. Full suite in Release | 480/480, exit 0, in both `implementation.md` and `test-report.md` (475 existing cases + 5 new; 297 + 4 methods) |
| 7. Scope | Verified by the diff above |
| 8. Not pushed, no pull request | `git ls-remote --heads origin change/GAP-12` returns nothing; no PR |

**Failing test first (B-6).** `git log --format='%h %s' 6470fac..HEAD`:

```
b01fee4 GAP-12: Record implementation
ff00c76 GAP-12: Turn off Kestrel's Server header
a37d618 GAP-12: Add failing test for the Server header
f531f0c GAP-12: Plan
```

The test commit precedes the fix commit.

**Re-run (fastest suite covering the change).** With the `api` job's
`ConnectionStrings__Content` and `ConnectionStrings__ContentAdmin` values from
`ci.yml` (workflow-only credentials; `ApiFactory` rewrites them to
`DigitalHubContent_Test`), against the shared SQL Server, on `b01fee4`.
Nothing created or dropped.

```
cd api
dotnet build DigitalHub.slnx -c Release
  exit 0, "0 Error(s)"
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"
exit 0
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_success [4 s]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.The_host_under_test_is_Kestrel_on_a_loopback_socket [3 ms]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request [26 ms]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_problem_response(path: "/api/v1/gap-12-no-such-route") [62 ms]
  Passed DigitalHub.Api.Tests.ServerHeaderTests.No_server_header_on_a_problem_response(path: "/api/v1/users") [15 ms]
Test Run Successful.
Total tests: 5
     Passed: 5
```

I did not re-run the full suite (480/480 twice, by the developer and the
tester, each with exit code and summary) or the red run (shown twice, on the
same commit `a37d618`); their evidence is commands, exit codes and output, not
claims.

**Tester's evidence.** Real: red and green runs on separate checkouts of
`a37d618` and `b01fee4`, full suite, gitleaks pr-diff (0 new) and full history
(2 known, 0 new), `dotnet` package audit (0), and a live run beyond the plan
showing no `Server` line on 200, 401, 400, 413, 414, 429, 431 and 505, even
with `Kestrel__AddServerHeader=true` in the environment. Semgrep is NOT RUN
with the reason (`semgrep.dev` blocked by the sandbox proxy) and the covering
job named.

**Coverage table.** Every row has evidence in `test-report.md`, except the CI
run of the `api` job, which is "Partly" (`ci.yml` untouched, verified; run
NOT RUN because the branch is not pushed). Carried as an open item.

**Commits (B-4).** Each subject is `GAP-12: <imperative>`, under 72
characters, with a body giving the reason and the trailers
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
`Claude-Session: https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd`.

## Open items

1. **Records not yet committed.** `test-report.md` is untracked and this file
   is new. Both must be committed on `change/GAP-12` (one records commit, B-4
   subject and trailers) before the branch is pushed, so the pull request
   carries its own evidence.
2. **Owner's OK to push and open the pull request.** Gate 1 condition 8 still
   holds; this approval does not give it.
3. **Merge after GAP-01.** The website `npm-audit` job in
   `.github/workflows/security.yml` fails on the base `6470fac` (website gate:
   "6 finding(s) at the gate's level; 3 known, 3 new", critical/high `next`
   advisories, `test-report.md` section 4). GAP-12 touches no npm file, so that
   job will be red on its pull request until GAP-01 (Wave 0) merges. GAP-12
   merges after GAP-01, and its pull request is rebased on the base once GAP-01
   is in, so the checks can go green on the final head. This also keeps
   Wave 0 before Wave 1.
4. **CI on the final head.** The `api` job run id (new tests in "Integration
   tests (Release)"), the `semgrep` job (not runnable here) and every other
   required check must be green on the final head, run ids quoted in the pull
   request.
5. **Independent review and human review.** Not yet recorded; required by the
   Definition of Done before merge.
6. **Phase D.** IIS's own `Server` header is out of scope and recorded in
   `docs/security-deployment.md` for the dev team.

## Definition of Done

| Box | Can it be ticked now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes. "Done when: An integration test asserts no `Server` header on API responses" is met. The IIS header is named as a Phase D deployment check |
| Code follows the engineering standards | Yes. One statement in `Program.cs`; test file 122 lines, typed, no prohibited pattern |
| No new prohibited constructs | Yes |
| Every new or changed route has a guard | Yes, vacuously: no route added or changed |
| Tests exist; security fix has a regression test | Yes. `ServerHeaderTests`, shown red before the fix. Changed-line coverage: the one changed statement runs in every test host; the coverage gate's own number comes from CI (open item 4) |
| PR checks green on the final head | **No, open** (items 3 and 4) |
| Independent code review run | **No, open** (item 5) |
| Reviewed by someone other than the author | **No, open** (item 5) |
| Rollback understood | Yes. Revert the pull request; no schema, data or configuration |
| Deployment note | Yes, in text: nothing deploys until Phase D; the integrator merges into `rebuild/dotnet-platform` after GAP-01 and re-runs the suites after the merge |
| Governance: deferred items | Yes, none needed (no exception) |
| Governance: documentation | Yes, `docs/security-deployment.md` |
| Governance: `AGENTS.md` coverage table or phase document | **Open**: the governing documents are not on the base branch; update the coverage table when they land |

## Draft pull request description

```markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6Yc7G3x1zMCKZMuJSV3oKJ2)_

## What and why

GAP-12 (refinement plan, Wave 1), from finding 9 of the 27 October test report:
every API response carried `Server: Kestrel`. Kestrel writes that header itself,
after any middleware and also on its own 400s, so it is turned off in Kestrel's
options (`AddServerHeader = false` in `Program.cs`) rather than stripped in a
middleware, which does not work.

## Scope and boundaries

In scope: `api/src/DigitalHub.Api/Program.cs` (one statement), a new test class
`api/tests/DigitalHub.Api.Tests/ServerHeaderTests.cs`, a new section "API:
response headers" in `docs/security-deployment.md`, and the pipeline records in
`docs/changes/GAP-12/`.

Out of scope: IIS's own `Server` header (Phase D deployment setting, written
down in `docs/security-deployment.md`); `ApiFactory`, `SecurityHeadersMiddleware`
and the other tests; `.github/workflows/ci.yml`; packages and lockfiles; the
website and the Studio.

## Security impact

Removes a server-software banner (information disclosure, Low). No route,
policy, data, secret, dependency or migration change. Under IIS the banner is
IIS's until Phase D removes it.

## Tests and evidence

All in Release, against `DigitalHubContent_Test`, with the `api` job's
connection variables. Full records: `docs/changes/GAP-12/implementation.md`,
`test-report.md`, `delivery-approval.md`.

- Red run on `a37d618` (test alone): exit 1, 1 passed (Kestrel guard), 4 failed
  on the `Server` assertion ("Unexpected Server header: Kestrel"; raw socket
  head `"Server: Kestrel"`).
- Green run on the head: `ServerHeaderTests` exit 0, 5/5 passed (developer,
  tester and tech lead).
- Full API suite: exit 0, 480/480 passed (475 existing cases + 5 new).
- Live run (tester): no `Server` line on 200, 401, 400, 413, 414, 429, 431, 505,
  even with `Kestrel__AddServerHeader=true` set.
- gitleaks pr-diff: 0 new. `dotnet` package audit: 0.
- Semgrep: NOT RUN locally (`semgrep.dev` blocked by the sandbox proxy); covered
  by the `semgrep` job in `security.yml`.
- Website/Studio suites: NOT RUN (no file there changed); covered by the
  `website` and `studio` jobs in `ci.yml`.
- CI run ids on the final head: <to add>.

The website `npm-audit` job in `security.yml` fails on the base until GAP-01
(Wave 0) merges; this pull request merges after GAP-01.

## Owner decisions

None needed for the change itself. The owner's instruction for this work:
"Start waves 0 & 1 and update me with each gap done" and "continue working on
wave 0 & 1" (Mohamed Elbadry, 2026-11-01, project thread).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [x] Deployment note: who pushes, and that the deploy will be watched to the end and recorded

Nothing deploys until Phase D. The integrator merges into
`rebuild/dotnet-platform` after GAP-01 and re-runs the suites after the merge.

## Review findings accepted

Plan review Minors 1 to 3, all addressed as gate 1 conditions 5, 3 and 4. Test
report: no findings.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated
- [x] `docs/deferred-items.md` updated for any exception (none needed)
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
