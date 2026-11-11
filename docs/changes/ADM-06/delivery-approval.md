# ADM-06: delivery approval (gate 2)

Technical lead, gate 2, 10 November 2026. Change: ADM-06a, the API binding fix
and its tests (plan section 3.3). Branch `change/ADM-06`, worktree
`/home/user/dh-change-adm06`.

| Commit | Role |
| --- | --- |
| `39968ce` | Plan records |
| `c870b7e` | Red: tests only |
| `17894c7` | Fix |
| `8ab00e0` | Implementation record (head reviewed) |

- **Records relied on:**
  - `plan.md`, round 2;
  - `plan-review.md`, Round 2, `Verdict: APPROVED`;
  - `plan-approval.md`, `Verdict: APPROVED`;
  - `implementation.md`, `Status: READY FOR TEST`;
  - `test-report.md`, Round 1, `Verdict: APPROVED`. This file is uncommitted in the worktree.
- **What this approval is:** a pipeline role. It moves the change to the owner.
- **What it is not:**
  - It is not the owner's confirmation that `AGENTS.md` requires.
  - It is not an owner decision under P-7.
  - It does not answer O-ADM06-1.

## Decision

The implementation and the tests are approved. This covers ADM-06a only. ADM-06
stays open until ADM-06b, the Studio paging controls, has merged.

This approval does not clear the change to push or merge. Two things still wait
on the owner, under "Open items" below:

- the answer to O-ADM06-1, which decides how the pull request is opened and
  whether it is blocked;
- the owner's confirmation before anything is pushed (`.claude/commands/change.md`).

Gate 1 and the plan both state that gate 2 does not depend on the answer to
O-ADM06-1 (plan section 9, "What does not wait"; `plan-approval.md`, "Owner
decisions"). The verdict below follows that. The "No" branch stays as the plan
wrote it: if the owner answers "No", the delivery becomes BLOCKED ON OWNER. This
approval does not change that and does not waive it.

## What I verified myself

Before writing anything, I read:

- `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, and all five records in
  `docs/changes/ADM-06/`;
- `ENGINEERING_STANDARDS.md` and `.github/pull_request_template.md`, both through
  `git show origin/claude/cool-heisenberg-mh6zx9:<path>`, because neither is on the
  base;
- the refinement plan and the ADM-06 entry of the admin audit in
  `/mnt/project-files/docs/quality/`.

### 1. Diff against the approved plan (plan section 4)

`git diff --stat origin/rebuild/dotnet-platform...HEAD` (merge base `a866cf6`):

```
api/src/DigitalHub.Api/Conventions/PageQuery.cs       |   4 +
.../ConventionProbeController.cs                      |   6 +-
api/tests/DigitalHub.Api.Tests/ListPagingTests.cs     | 266 ++++
.../DigitalHub.Api.Tests/PageQueryBindingTests.cs     | 110 ++++
docs/changes/ADM-06/{implementation,plan-approval,plan-review,plan}.md
8 files changed, 1813 insertions(+), 3 deletions(-)
```

These are exactly the plan's section 4 files.

- `PageQuery.cs` gains these lines and nothing else:
  - `using Microsoft.AspNetCore.Mvc;`
  - a two-line comment naming ADM-06
  - `[ModelBinder(Name = "")]`

  `PageResult<T>` is unchanged.
- The probe changes only the parameter rename `query` to `page`, on lines 33, 36
  and 37.
- Nothing changed in `studio/`, `website/`, `packages/`, the controllers, the
  stores, `ConventionTests.cs`, migrations, workflows or package files.

I read `PageQueryBindingTests.cs` in full. Test 1 asserts the exact sorted set of
five actions, then the empty model name for each (gate 1, condition 4). I also
checked the following points in `ListPagingTests.cs` by grep:

- `[Collection("SqlServer")]`;
- five tests, each with `page=2&pageSize=2` and `total` 3;
- a `finally` cleanup in each of the five tests;
- test 7 takes `before = DateTime.UtcNow` and `after = DateTime.UtcNow` with no
  `AddSeconds` padding.

### 2. Red test committed before the fix (B-6, P-4, G3)

`git log a866cf6..HEAD`: `39968ce` → `c870b7e` (tests) → `17894c7` (fix) →
`8ab00e0` (records).

- `c870b7e` touches nothing in `api/src/`.
- `17894c7` touches only `PageQuery.cs`.
- The probe rename is in the red commit, not in a separate rename commit. That is
  correct: the rename changes how the probe binds, so B-6's "pure rename" rule
  does not apply. Gate 1, condition 2 said the same.

### 3. Re-run: the fastest covering suite, red then green

Setup:

- detached worktree `/home/user/adm06-gate2`;
- SDK 10.0.114 from `dn.sh`, Release;
- a fresh `HOME` under the scratchpad for each run, deleted afterwards;
- `ConnectionStrings__Content="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`.

Port 4299 has no listener. `ApiFactory.ToTestCatalog` rewrites the catalog to
`DigitalHubContent_Test`. No database was reached or written.

Filter for every run:
`FullyQualifiedName~DigitalHub.Api.Tests.PageQueryBindingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests.`

**At `c870b7e` (red):**

```
dotnet build tests/DigitalHub.Api.Tests -c Release      build exit=0   13 Warning(s)   0 Error(s)
dotnet test ... -c Release --no-build --filter <above>  test exit=1
  Failed PageQueryBindingTests.Every_paged_list_binds_page_and_page_size_from_the_query_root
  Failed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=0&pageSize=5", field: "Page")      Expected: BadRequest  Actual: OK
  Failed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=10001", field: "Page")             Expected: BadRequest  Actual: OK
  Failed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "page=2&pageSize=101", field: "PageSize") Expected: BadRequest  Actual: OK
  Passed PageQueryBindingTests.Out_of_range_page_or_page_size_is_rejected(query: "pageSize=0", field: "PageSize")
  Failed PageQueryBindingTests.Page_two_returns_the_second_slice_with_the_requested_size                                  Expected: 2  Actual: 1
  Failed ConventionTests.Notes_list_uses_the_page_envelope                                                                Expected: 2  Actual: 4
  (six other ConventionTests passed)
Total tests: 13   Passed: 7   Failed: 6
```

This is the plan 5.3 red exactly. Each failure is on an assertion, for the
planned reason. None is a build, connection or timeout failure.

**At `8ab00e0` (head):**

```
dotnet build DigitalHub.slnx -c Release                 build exit=0   13 Warning(s)   0 Error(s)
dotnet test ... -c Release --no-build --filter <above>  test exit=0
  Passed: all six PageQueryBindingTests cases and all seven ConventionTests
Total tests: 13   Passed: 13
```

The warning count is the same as the base: 13, all of them already in
`ContentWriter.cs`, as both the developer and the tester recorded.

**At the head merged with the current base:**

`origin/rebuild/dotnet-platform` has moved to `f171f7a`. That is newer than the
`f5dd209` named in `implementation.md` and the test report. It now includes:

- `f5dd209` GAP-08;
- `9c2a32b` GAP-06 (#42), which changes `ci.yml` and two migrations;
- `f171f7a` GAP-04 (#43), which changes `ci.yml` and `website/`.

None of them touches a file in this change. `git merge-tree --write-tree HEAD
origin/rebuild/dotnet-platform` reports a clean merge. I ran a trial merge,
without committing it, in the detached worktree:

```
git merge --no-ff --no-commit origin/rebuild/dotnet-platform   Automatic merge went well
dotnet build DigitalHub.slnx -c Release                       build exit=0   13 Warning(s)   0 Error(s)
dotnet test ... --filter <above>                              Passed!  - Failed: 0, Passed: 13, Skipped: 0, Total: 13   exit=0
```

I aborted the merge and removed the worktree (`git worktree list` shows only
`DH-WEBSITE` and `dh-change-adm06`). My three builds started six MSBuild nodes
(PIDs 17609, 17610, 17905, 17906, 18207 and 18208, started 23:44 to 23:45). I
stopped those six. `VBCSCompiler` PID 864 is not mine, and I left it running. I
opened no port.

I did not re-run the full suite without a database. The tester's multiset diff
(0 of 167 baseline passes lost) and the developer's `comm` diff agree, and my
covering run matches both.

### 4. The tester's evidence is real

Section by section, the test report gives:

- the command as run;
- the exit code;
- the assertion lines;
- the counts.

My red and green runs reproduce its sections 2 and 3 to the line. Its section 5
compares red and head on the real pipeline and shows the following:

- every 401 and 403 in the role matrix is identical before and after the fix;
- 400s use the A-6 problem+json shape, with no internals;
- no 500 occurred.

Its section 7 checks the three untestable assumptions of tests 4 to 8 against the
code. The harness sits outside the repository, and the report says what it
stubs (`OnTokenValidated`, and the store call). I accept that as stated. It is
supplementary, and nothing rests on it alone.

### 5. Coverage table

Every row in the test report's table has evidence or a named destination:

- three rows are "Moved to ADM-06b";
- the five page-2 rows are "NOT RUN", each naming CI job `api`;
- the "shown failing before the fix" row is "open for tests 4 to 8", waiting on
  O-ADM06-1.

No row is bare.

### 6. Commits (B-4)

All four subjects are imperative and prefixed `ADM-06:`. Each body says why. Each
ends with both attribution trailers:

- `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- `Claude-Session: https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65`

### 7. Other branches

- The open pull requests #44 (GAP-07) and #45 (semgrep-error-detail) change only
  `.github/security/*`, `security.yml` and their own records.
- No remote branch that shares history with `rebuild/dotnet-platform` touches this
  change's files.
- `main`, `release/v1` and `feature/interviewer-portal` share no merge base with
  it. Their grep "hits" were an artefact of diffing against the working tree,
  not real overlap.

## Open items

1. **O-ADM06-1: PENDING. Owner only.**
   - The question: may `c870b7e` be pushed and the pull request opened before the
     fix, so that CI job `api` shows `ListPagingTests` failing?
   - **If the answer is "Yes":**
     - Push `c870b7e` alone and open the pull request.
     - Record the failing `api` run id. It must fail exactly:
       - the five `ListPagingTests`;
       - the five failing `PageQueryBindingTests` cases;
       - `Notes_list_uses_the_page_envelope`;

       and nothing else.
     - Then push `17894c7` and the record commits.
     - Quote the owner's words, with the date and where they were given.
   - **If the answer is "No":**
     - Tests 4 to 8 have no red evidence, and the G3 rule is not met for them.
     - The delivery is **BLOCKED ON OWNER** until a `D-NNN` entry in
       `docs/deferred-items.md` records the owner's acceptance in words, with:
       - the rule waived;
       - the justification;
       - the owner's exact words and the date;
       - the follow-up owner;
       - an expiry.
     - `docs/deferred-items.md` is not on the base yet. It exists only on
       `origin/claude/cool-heisenberg-mh6zx9`. Creating it, or landing that
       branch, is part of that path.
   - Neither I nor any other role can decide this.
2. **The 400-instead-of-200 behaviour change, for the owner to see.**
   - Before: `page` below 1 or above 10,000, or `pageSize` outside 1 to 100,
     sent together with a `page` key, was silently replaced by the defaults and
     answered 200.
   - After: those requests return 400 `validation_failed` with `errors.Page` or
     `errors.PageSize`.
   - The `[Range]` limits were already declared in code, A-8 states them, and a
     `pageSize`-only request already returned 400.
   - No caller sends such values. The Studio sends `pageSize` 1, 8, 24, 48 or
     100, and only `previewData.ts` sends `page`, starting at 1 (test report,
     section 8).
   - Gate 1 accepted the change as restoring the declared limit. It is a visible
     API change all the same, so it goes in front of the owner in the pull
     request.
3. **The base has moved to `f171f7a`** (B-3). Bring the branch up to date with a
   merge of `rebuild/dotnet-platform`, not a rebase, so that `c870b7e` and
   `17894c7` stay separate and in order. The trial merge was clean and the
   covering suite passed. The final head then needs green CI again.
4. **CI green on the final head is not yet shown.** It must show:
   - `ci.yml`: `api`, `website`, `studio`, `section-compare`, `screenshot-parity`
     and `website-browser`;
   - `security.yml`.

   In particular, `ListPagingTests` (tests 4 to 8) have never run against a
   database. Their first run is CI `api`. Quote the run ids and the TRX count.
5. **Records still to commit.** `test-report.md` and this file are uncommitted.
   Stage them by exact path in one records commit (B-5) before the push. I have
   not committed anything.
6. **ADM-06 itself stays open** until ADM-06b merges (plan 3.3, target
   12 November). The G3-1 schedule gap noted at gate 1 is still the owner's to
   decide.

## Draft pull request description

Title: `ADM-06: Bind PageQuery from the query root (ADM-06a)`

```markdown
## What and why

ADM-06a, the first half of admin audit finding ADM-06 ("paging is broken on every
list endpoint", `docs/quality/admin-audit-2026-10-28.md`, Blocker, batch G3-1).

`[FromQuery] PageQuery page` made `page` a model-binding prefix. Any request that
sent `page=` therefore got page 1 of 20: `?page=2&pageSize=5` returned page 1,
size 20. In the same requests the `[Range]` limits on `Page` and `PageSize` were
skipped. The defect affected all five paged lists: audit, contact requests,
redirects, media, and every collection. Through the API, only the newest 50
enquiries and audit entries and the newest 48 media items could be reached. The
Studio preview loader repeated page 1 for collections larger than 20 items.

The fix is `[ModelBinder(Name = "")]` on the `PageQuery` type, which is the
audit's "bind with `Name = ""`". Every `PageQuery` parameter now binds `page` and
`pageSize` from the query root, with no controller change, and a new paged list
written the same way gets the fix automatically.

## Scope and boundaries

In scope:
- `api/src/DigitalHub.Api/Conventions/PageQuery.cs`: the attribute, the
  `using Microsoft.AspNetCore.Mvc;` it needs, and a comment.
- `api/tests/DigitalHub.Api.Tests/ConventionProbeController.cs`: the probe's
  parameter renamed `query` to `page`, so it has the production shape.
- `api/tests/DigitalHub.Api.Tests/PageQueryBindingTests.cs` (new): needs no
  database.
- `api/tests/DigitalHub.Api.Tests/ListPagingTests.cs` (new): one page-2 test per
  endpoint.
- `docs/changes/ADM-06/`: the pipeline records.

Out of scope, on purpose:
- Every file in `studio/`. The paging controls on the audit, inbox and media
  screens, a Studio test of the preview loader, and a Studio end-to-end test
  past page 1 are **ADM-06b**, the next slot-2 change. ADM-06 closes only when
  both have merged.
- The controllers and the stores. No signature, ordering or filter change.
  Tie-breakers on the newest-first lists are passed to ADM-15 and ADM-16.

B-8: this is one module and one fix. The Studio half is split out because it is
another module.

## Security impact

- Routes and policies: none changed. A red-versus-head matrix over six routes and
  six identities (anonymous, admin, editor, HR, no role, unknown role) shows
  every 401 and 403 unchanged. Only the bound values in the 200 rows differ.
- Input validation: stronger. Out-of-range `page` or `pageSize` now returns an
  RFC 7807 400 (`validation_failed`, `errors.Page` or `errors.PageSize`), with no
  internals and no 500 for any input tried.
- Data reachable: rows past the first page, which were always within each role's
  permission. No role gains access to anything new.
- Secrets, dependencies, migrations, configuration: none.
  `run-dotnet-audit.sh` reports 0 findings.

## Tests and evidence

All runs used Release, SDK 10.0.114, a fresh `HOME`, and a closed-port connection
string rewritten to `DigitalHubContent_Test`. No database was touched.

Red, at `c870b7e` (tests only):

    dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
      --filter "FullyQualifiedName~DigitalHub.Api.Tests.PageQueryBindingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests."
    exit 1   Total 13, Passed 7, Failed 6
      Every_paged_list_binds_page_and_page_size_from_the_query_root   all five actions: model name <null>
      Out_of_range_... page=0&pageSize=5 / page=10001 / page=2&pageSize=101   Expected: BadRequest  Actual: OK
      Page_two_returns_the_second_slice_with_the_requested_size      Expected: 2  Actual: 1
      ConventionTests.Notes_list_uses_the_page_envelope               Expected: 2  Actual: 4

Green, at `17894c7` and later:

- the same filter: exit 0, `Passed: 13`;
- `dotnet build DigitalHub.slnx -c Release`: exit 0, 0 errors, 13 warnings (all
  already present in `ContentWriter.cs`);
- full suite without a database: 0 of the 167 baseline passes lost, and the six
  new `PageQueryBindingTests` cases pass.

The commands above were run by the developer and the tester, and re-run by the
tech lead at gate 2. The tech lead also ran a trial merge with the current
`rebuild/dotnet-platform`: the merge was clean, the build succeeded, and 13 of
13 tests passed.

CI on this pull request:
- Red run (`api`, at `c870b7e` only): <run id, only if O-ADM06-1 is "Yes"; must
  fail exactly the five ListPagingTests, the five PageQueryBindingTests cases and
  Notes_list_uses_the_page_envelope>
- Green run on the final head: `ci.yml` <run id>, with `api` TRX count <n>;
  `security.yml` <run id>.

NOT RUN locally:
- `ListPagingTests` (tests 4 to 8) and the full integration suite: there is no
  SQL Server in the container. CI job `api` covers them.
- Studio, website, section comparison and screenshots: no file in `studio/`,
  `website/` or `packages/` changes. CI jobs `studio`, `website`,
  `section-compare`, `screenshot-parity` and `website-browser` cover them.
- Semgrep and gitleaks: not installed locally. `security.yml` covers them.

## Owner decisions

- Owner's request: "merge  and start next task" (Mohamed Elbadry, 10 November
  2026, project thread).
- **O-ADM06-1, whether to push the red tests first.** <Fill in exactly ONE of the
  two blocks below, with the owner's exact words, the date and where they were
  given. Delete the other block.>

  **If "Yes, push the red tests first":** this pull request was opened with
  `c870b7e` alone. CI run <id> shows job `api` failing exactly the tests listed
  above. `17894c7` was pushed afterwards, and the green run is <id>. The
  owner's words: "<quote>" (<name>, <date>, <where>).

  **If "No, push only when finished":** the red evidence for `ListPagingTests`
  is NOT RUN, and the G3 rule "shown failing before the fix" is not met for
  those five tests. **This pull request is BLOCKED ON OWNER and must not merge**
  until a `D-NNN` entry in `docs/deferred-items.md` records the owner's
  acceptance. The entry gives the rule waived (G3 and P-4), the justification
  (no local SQL Server; the binding red is shown by `PageQueryBindingTests` and
  the probe test), the owner's exact words and date, the follow-up owner and an
  expiry. Entry: <D-NNN>.

- **For the owner to see: a behaviour change.** Out-of-range `page` (below 1 or
  above 10,000) or `pageSize` (outside 1 to 100), sent together with a `page`
  key, used to be silently replaced by the defaults with a 200. It now returns
  **400** `validation_failed`. This restores the declared `[Range]` limits and
  A-8. A `pageSize`-only request already returned 400. No Studio, website or
  end-to-end caller sends such values. Gate 1 accepted it as a restored limit,
  and that acceptance is not an owner decision.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met. These are the audit's
  ADM-06 bullets 1, 2 and 4 and fix items 1 and 3. Bullet 3, fix item 2 and the
  Studio test move to ADM-06b. The page-2 behaviour of each endpoint is proven
  once CI `api` passes.
- [x] Code follows the engineering standards.
- [x] No new prohibited constructs in touched code.
- [x] Every new or changed route has a guard: no route is new or changed, and the
  policy matrix is unchanged.
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate;
  every security fix has a regression test. The tests exist and were red first
  locally. There is no changed-line coverage gate yet. The CI red for
  `ListPagingTests` depends on O-ADM06-1.
- [ ] PR checks are green on the final head (run IDs quoted). Open.
- [x] Independent code review was run, and its findings are fixed or accepted below.
  The reviews: plan review (2 rounds), the tester (Round 1, no findings) and
  gate 2.
- [x] Reviewed by someone other than the author, and the AI governance rules were
  followed.
- [x] Rollback is understood: revert this pull request. Nothing is stored, and
  there is no migration.
- [ ] Deployment note: <integrator> merges into `rebuild/dotnet-platform` and
  re-runs the suites after the merge. Nothing deploys before Phase D.

## Review findings accepted

- Tie-breaking on the newest-first lists (audit, media, contact) is not fixed
  here. It is passed to ADM-15 and ADM-16.
- Validation messages echo the raw query value, for example "The value 'abc,3' is
  not valid for Page.". This is ASP.NET Core's default message, JSON-encoded.
  It is a candidate for a later A-6 tidy-up.
- Lenient integer parsing (`page=0x10` binds 16, and the first repeated value
  wins) is framework behaviour. The `[Range]` limits still apply.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated. ADM-06 is not done
  until ADM-06b, so its rows stay open.
- [ ] `docs/deferred-items.md` updated for any exception. Required only if
  O-ADM06-1 is "No".
- [x] Documentation updated. The change records are in `docs/changes/ADM-06/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

Verdict: APPROVED
