# ADM-04: implementation

Developer, 12 November 2026. Plan: `docs/changes/ADM-04/plan.md` round 3 at `59e1269`,
gate 1 `plan-approval.md` at `33b3efc` (`Verdict: APPROVED`, conditions C1 to C12).
Branch `change/ADM-04`, worktree `/home/user/dh-change-adm04`. Nothing is pushed (C4: the
coordinator pushes).

**What this machine can and cannot run.** There is no `dotnet` and no SQL Server here, and
the proxy blocks the .NET download:

```
$ dotnet --version
/bin/bash: line 1: dotnet: command not found        (exit 127)
$ sqlcmd -?                                          (exit 127)
```

So **no C# in this change has been compiled or run.** Every API test (T1 to T17), E1 and
every CI row is PENDING below. Nothing here is CI evidence. The Studio unit tests, the
Studio build and the website checks did run, and are quoted as run.

## 1. Commits

| # | SHA | Subject | Files |
| --- | --- | --- | --- |
| 0 | `804e85f` | ADM-04: Merge rebuild/dotnet-platform (ADM-10) into change/ADM-04 | merge of `2bbd586` |
| 1 | `bf634e2` | ADM-04: Test role change and reactivation in the API and end-to-end | `UserRoleAndReactivationTests.cs`, `UserRoleConcurrencyTests.cs`, `ReactivationLogTests.cs`, `studio/e2e/users.spec.ts` |
| 2 | `486588c` | ADM-04: Test role change and reactivation on the users screen | `studio/test/users.test.tsx` |
| 3 | `1806847` | ADM-04: Change roles and reactivate users in the API | `UserAccessController.cs`, `UserAccessStore.cs`, `TemporaryPassword.cs`, `Program.cs` |
| 4 | `1b947f5` | ADM-04: Change roles and reactivate from the users screen | `studio/src/pages/UsersPage.tsx` |
| 6 | `deff0ce` | ADM-04: Test that another spelling of your own id cannot change your role | `UserRoleAndReactivationTests.cs` (T17, rework round 1) |
| 7 | `81b951b` | ADM-04: Refuse your own role change whatever spelling of the id is sent | `UserAccessStore.cs` (rework round 1) |
| 5 | `2b81b04` | ADM-04: Implementation record | `docs/changes/ADM-04/implementation.md` |

**Commit 1, the red-test commit, is `bf634e2`.** It holds T1 to T16 and E1 in test files
only. Commit 2 (`486588c`) holds S1 to S7. Test commits come before fix commits, in the
plan's order (5.2). Every commit stages exact paths, has the `ADM-04:` prefix, a body,
and the two trailer lines.

## 2. Commit 0: the merge (C2, plan 4.1 step 2)

A merge commit, never a rebase.

```
$ git log --oneline -3 origin/rebuild/dotnet-platform
2bbd586 ADM-10: Keep the default share image when Settings is saved (#56)
32f0414 ADM-07: Flag redirects with no page and make redirect creates safe under load (#55)
6262f48 ADM-02: Keep API-accepted content passing the website's checks (#54)
$ git merge --no-ff origin/rebuild/dotnet-platform -m "ADM-04: Merge rebuild/dotnet-platform (ADM-10) into change/ADM-04 ..."
Merge made by the 'ort' strategy.
 13 files changed, 2580 insertions(+), 6 deletions(-)        (no conflict)
$ git merge-base --is-ancestor 2bbd586 HEAD; echo "is-ancestor exit $?"
is-ancestor exit 0
```

ADM-05 has not merged (`origin/change/ADM-05` is `741d70c`; `origin/rebuild/dotnet-platform`
still `2bbd586` at the last fetch). If it merges while ADM-04 is open, the base is merged
in again and every 5.3 suite re-run (C2, 4.1 step 4).

## 3. What changed, file by file (plan section 4)

`git diff --name-only 2bbd586 HEAD` lists exactly the plan's files plus the ADM-04 docs:

```
api/src/DigitalHub.Api/Content/UserAccessStore.cs
api/src/DigitalHub.Api/Controllers/UserAccessController.cs
api/src/DigitalHub.Api/Identity/TemporaryPassword.cs
api/src/DigitalHub.Api/Program.cs
api/tests/DigitalHub.Api.Tests/ReactivationLogTests.cs
api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs
api/tests/DigitalHub.Api.Tests/UserRoleConcurrencyTests.cs
docs/changes/ADM-04/plan-approval.md
docs/changes/ADM-04/plan-review.md
docs/changes/ADM-04/plan.md
studio/e2e/users.spec.ts
studio/src/pages/UsersPage.tsx
studio/test/users.test.tsx
```

Not touched, as the plan and C1 require: `AdminStore.cs`, `AdminControllers.cs`,
`ContentStore.cs`, `PublishChecks.cs`, `ErrorPagesPage.tsx`, `TokenService.cs`,
`SessionCheck.cs`, and every existing test file.

| File | Plan | What |
| --- | --- | --- |
| `api/src/DigitalHub.Api/Controllers/UserAccessController.cs` (new) | 3.1 | `[ApiController]`, `[Authorize(Policy = "studio-admin")]`, `[Route("api/v1/users")]`. `PUT {id}/role` with `[RequestBodyLimit(AuthBodyLimit)]` and `[RejectDuplicateJsonFields]`. `POST {id}/reactivate` with `[RequestBodyLimit(AuthBodyLimit)]`, and `Cache-Control: no-store` on its 200 (F-9). `UserId()` and `Respond()` as in `UsersController` |
| `api/src/DigitalHub.Api/Content/UserAccessStore.cs` (new) | 3.1 | `ChangeRoleAsync` (steps 1 to 12), `ReactivateAsync` (steps 1 to 9), `UserRoleChange`, the users lock (`UsersLockSql`, `TakeUsersLockAsync`), `EnsureActorAsync`, and the private helpers copied from `AdminStore` (section 6). Refresh tokens are revoked through `TokenService.RevokeUserAsync(id, null, ct)` (F-8), not a copy |
| `api/src/DigitalHub.Api/Identity/TemporaryPassword.cs` (new) | 3.1 | `internal static`: `NewAcceptedAsync(users, user)` and `New()`, `AdminStore`'s algorithm copied as it is |
| `api/src/DigitalHub.Api/Program.cs` | 3.1 | One line after `AddScoped<AdminStore>()`: `builder.Services.AddScoped<UserAccessStore>();` |
| `studio/src/pages/UsersPage.tsx` | 3.2 | Role select on other active rows, "Reactivate" on inactive rows, one more controlled `<Modal>` for both confirmations, and "Reactivate instead" in the create modal on `email_taken` for an inactive row's email. See 3.1 below for two additions the tests needed |
| `api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs` (new) | 5.1 | T1 to T9, T11 to T14 |
| `api/tests/DigitalHub.Api.Tests/UserRoleConcurrencyTests.cs` (new) | 5.1 | T15, T16, `GatedUsersFactory`, `UserRolesReadGate` |
| `api/tests/DigitalHub.Api.Tests/ReactivationLogTests.cs` (new) | 5.1 | T10, `LoggingFactory` (sink in the test host, Verbose for `Default` and both overrides) |
| `studio/test/users.test.tsx` (new) | 5.1 | S1 to S7 |
| `studio/e2e/users.spec.ts` (new) | 5.1 | E1 |

### 3.1 Choices made inside the plan, for the tester to check

None of these changes the plan's design, scope or files. Each is stated so the tester can
judge it.

1. **UsersPage: row selects carry an `id`, and the create and confirmation modals have
   `destroyOnHidden`.** Found at the first green run (reported in 7.3 before the fix).
   Under `NODE_ENV=test`, `@rc-component/util`'s `useId` returns the fixed string
   `test-id` for every component (`node_modules/@rc-component/util/lib/hooks/useId.js`:
   "Test env always return mock id"). Every modal's `aria-labelledby` is then `test-id`,
   and the first element with that id in the page names it. With row selects in the
   table, or a hidden modal still in the page, the next dialog took the wrong name. In a
   browser the ids are unique, so users see no difference: the selects get stable ids,
   and a hidden create or confirmation modal leaves the page (the create form's values
   live in component state, so nothing is lost). The temporary-password modal is
   unchanged. No test was changed.
2. **The confirmation modal closes on OK, before the request.** On failure the problem's
   title shows in the page's error line, as for every other action on the screen (3.2
   "as today"). S4 asserts it. The select still shows the stored role, because it was
   never changed.
3. **The confirmation text uses the option label**: "ed@x.test becomes admin", and "...
   becomes HR" for `hr`, as the select shows it.
4. **"Reactivate instead"** also clears the typed email and password, as a successful
   create does.
5. **Audit detail** is `string.Join(", ", <Studio roles>) + " -> " + <new>`. For a user
   with one Studio role, the normal case, that is the plan's `"editor -> admin"` (T1).
6. **T9's holder connection** uses `ConnectionStrings:Content` from the test host's
   `IConfiguration`. That is the value `ApiFactory` sets from its private
   `TestConnectionString()` (the restricted login), so it is "ApiFactory's test
   connection string" without editing `ApiFactory.cs` (an existing test file, C1).
7. **T3 and T14 demote Y** with `RemoveFromRoleAsync(admin)` then `AddToRoleAsync(editor)`,
   so Y is an editor in the database while Y's token still says admin (plan T3 wording).
   T14 restores admin before the deactivated variant, so that variant is "deactivated in
   place of demoted".
8. **T6 and T7 send their over-4 KB bodies as `StringContent`**, so the request has a
   Content-Length and `RequestBodyLimitMiddleware` refuses it before the action. The
   reactivate action reads no body, so a streamed body without a length would never trip
   the limit.
9. **C5 logging.** `UserRolesReadGate` also notes, without holding anything, each
   `sp_getapplock ... digitalhub:admins` non-query command while it is armed. T15 and
   T16 then write one timeline to `ITestOutputHelper`: each request's send and answer
   time, each users-lock call, each matched read with its parameters and `CommandText`,
   then `Matched` and the cap. Times are UTC `HH:mm:ss.fff`.
10. **The Role column is 130 px wide, not 100** (`UsersPage.tsx`, `width: 130`), so a
    small select with "editor" and its arrow fits in the cell. It is the one visual
    change to the screen beyond 3.2's list; the chip rows sit in the same wider column.
    Not declared in round 0; recorded here for gate 2 (test report round 1, finding 2).

## 4. Red first

### 4.1 Commit 1 (`bf634e2`): T1 to T16 and E1

**PENDING (CI job `api`, job `studio` end-to-end).** These need .NET and SQL Server. No
local run is possible here (see the top of this file), and none is reported. Per C4, gate 2 needs, at
`bf634e2`: T1 to T11 and T13 to T16 failing at the planned step, T12 and every existing
test passing, and E1 failing at step 2 (no "Role for <email>" combobox). The expected
failure for each is in the plan's "Red at base because" column.

Read from the code (not run), to help the tester: at the base no route matches
`PUT /api/v1/users/{id}/role` or `POST /api/v1/users/{id}/reactivate`, so each answers
404 and the first status assertion of T1 to T11, T13 and T14 fails; T15 fails at
"Expected exactly one 200" (two 404s); T16 fails at the wait for `Matched` 1, with the
message "B's role change never reached X's roles read inside the users lock (Matched
0)...".

What `bf634e2` itself was checked for, locally:

```
$ cd studio && npx tsc --ignoreConfig --noEmit --strict --module esnext --moduleResolution bundler \
    --target es2023 --skipLibCheck --allowImportingTsExtensions --types node e2e/users.spec.ts
spec tsc exit 0
```

(`studio/tsconfig*.json` does not include `e2e/*.spec.ts`, so the spec was checked on its
own.) The three C# test files were not compiled (no `dotnet`). T17 was added in rework round 1 (`deff0ce`); its red is also PENDING CI.

### 4.2 Commit 2 (`486588c`): S1 to S7, run locally

```
$ cd studio && npx vitest run test/users.test.tsx          (exit 1)
     × changes a user's role after confirming
     × a cancelled role change sends nothing
     × shows why a role change was refused
     × reactivates an inactive user and shows the temporary password
     × offers to reactivate when a new user's email is deactivated
 FAIL  ... changes a user's role after confirming
TestingLibraryElementError: Unable to find an accessible element with the role "combobox" and name "Role for ed@x.test"
 FAIL  ... a cancelled role change sends nothing
TestingLibraryElementError: Unable to find an accessible element with the role "combobox" and name "Role for ed@x.test"
 FAIL  ... shows why a role change was refused
TestingLibraryElementError: Unable to find an accessible element with the role "combobox" and name "Role for ed@x.test"
 FAIL  ... reactivates an inactive user and shows the temporary password
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Reactivate"
 FAIL  ... offers to reactivate when a new user's email is deactivated
TestingLibraryElementError: Unable to find an element with the text: That email belongs to a deactivated user..
 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)

$ cd studio && npm test                                     (exit 1)
 Test Files  1 failed | 13 passed (14)
      Tests  5 failed | 100 passed (105)
```

S1, S2, S4, S5 and S6 fail at the planned step (no select, no Reactivate, no text). S3
and S7 pass. Every existing Studio test passes (the base had 13 files, 98 tests; see 7.1).

## 4a. Rework round 1 (`test-report.md` Round 1 at `55e77ee`)

The report's verdict was BLOCKED ON OWNER only because CI cannot run. Two Minors came back
to the developer; finding 3 is pre-existing and project-wide, and is not for this change.

| Finding | Answer | Commits | Evidence |
| --- | --- | --- | --- |
| 1. Minor. `cannot_change_own_role` bypassed by a non-canonical id (trailing `%20`, or another case) | Red test first: T17 `An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id` sends a dedicated admin's own id upper-cased and with a trailing `%20`, expecting 400 `cannot_change_own_role` and the role unchanged. Fix: after `FindByIdAsync`, inside the lock, the store compares the loaded `user.Id` with the actor (`UserAccessStore.cs:59-61`); the early check on the id as typed stays (46-47). Both answer through one `OwnRole()` (225-226). Reactivate has no own-id check to fix: an actor is active, so their own id answers `already_active`. Deactivate's `cannot_deactivate_self` has the same pattern in `AdminStore.cs`: left for ADM-04b (below) | `deff0ce` (test), `81b951b` (fix) | **PENDING** CI job `api`: T17 red at `deff0ce` (expected: 200 for the upper-case spelling, the admin demoted; read from the code, not run), green at `81b951b`. Not compiled here (no `dotnet`) |
| 2. Minor. Role column width 100 to 130 not declared | Recorded as 3.1 item 10. No code change | this record | Section 3.1 |
| 3. Minor, pre-existing. Unknown JSON fields are ignored | Not changed: project-wide, out of scope, for the owner's list as the tester says | none | n/a |

**For ADM-04b (plan 4.2), added by this round:** `AdminStore.DeactivateUserAsync` compares
the id as typed with the actor for `cannot_deactivate_self` (`AdminStore.cs`, the first
statement of `DeactivateUserAsync`), so another spelling of the actor's own id passes it.
ADM-04b should compare the loaded user's `Id`, with a red test like T17. The last-admin
guard still applies there, so the effect is self-deactivation, not lost access.

Studio, re-run at `81b951b` (no Studio file changed this round):

```
$ cd studio && npx tsc -b                                    exit 0
$ cd studio && npm test                                      exit 0
 Test Files  14 passed (14)
      Tests  105 passed (105)
$ cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build    exit 0
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
```

## 5. Migrations

None (plan section 7). No schema file, migration or database was touched. Nothing was
applied anywhere.

## 6. Copied helpers, for ADM-04b to remove (C8)

Source lines are in `api/src/DigitalHub.Api/Content/AdminStore.cs` at the merged base
`804e85f` (identical to `2bbd586`).

| Copy | Where the copy is | Source in `AdminStore.cs` at `804e85f` |
| --- | --- | --- |
| `IsDeactivated(ApplicationUser)` | `UserAccessStore.cs:236-237` | 858-859 |
| `Audit(...)` | `UserAccessStore.cs:240-253` | 1064-1077 |
| `Validation(string, string)` | `UserAccessStore.cs:256-257` | 1079-1080 |
| `Validation(Dictionary<string, List<string>>)` | `UserAccessStore.cs:260-265` | 1082-1087 |
| `Missing(string)` | `UserAccessStore.cs:268-269` | 1089-1090 |
| The temporary-password generator | `TemporaryPassword.NewAcceptedAsync` (`TemporaryPassword.cs:22-33`) and `TemporaryPassword.New()` (35-61) | `NewAcceptedTemporaryPasswordAsync` 448-464 (summary at 448-452) and `NewTemporaryPassword` 861-888 |

Not copied: the revoke helper. `UserAccessStore` calls `TokenService.RevokeUserAsync`
(F-8); `AdminStore.RevokeRefreshTokensAsync` (466-475) is ADM-04b's to replace.

## 7. Green

### 7.1 Baseline, at the merged base (`804e85f`), before any ADM-04 file

```
$ cd studio && npm ci                       exit 0   ("found 0 vulnerabilities")
$ cd studio && npx tsc -b                   exit 0
$ cd studio && npm test                     exit 0
 Test Files  13 passed (13)
      Tests  98 passed (98)
```

### 7.2 The API suites (job `api`)

**PENDING, not run locally (no `dotnet`, no SQL Server).** Covered by CI job `api` on the
final head. Commands, from plan 5.3:

```
cd api && dotnet build DigitalHub.slnx -c Release
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build
cd api && dotnet test ... --filter "FullyQualifiedName~UserRoleAndReactivationTests|...|FullyQualifiedName~RateLimitLogTests"
cd api && dotnet test ... --filter FullyQualifiedName~UserRoleConcurrencyTests     # three runs in a row
```

What must be quoted when they run:

- The Release build: 0 errors, and no more warnings than the base's 13 (C9). **This code
  has never been compiled**, so the build is the first thing to look at.
- The TRX total, and every test that passed at the base still passing. `CareersTests.Authorization_matches_for_every_endpoint`
  passes unchanged with the two new routes in it.
- **C5.** Three consecutive runs of `UserRoleConcurrencyTests`, each quoted with its
  timeline lines (section 3.1 item 9). In each T15 run, the two "users lock requested"
  lines must both fall within the 2 s cap of each other, and before the first match is
  released. A run where they do not is not evidence (R3-1), not a pass.
- **C7 (at commit 3, `1806847`; from test output, not memory).** If any of these is false,
  stop and report (C1):
  1. Identity's `GetRolesAsync` SQL names `[AspNetUserRoles]` and passes the user id as a
     parameter: the T15 and T16 "matched [...]" lines show the `CommandText` and the
     parameters (`@userId=<id>` or EF's name for it).
  2. The warm-up shows `Matched` 0: the line `warm-up: 2 authenticated requests, Matched 0`
     (T15) and `warm-up: 2 authenticated requests, Matched 0` (T16), and the warm-up
     assertion passing.
  3. A stale `ConcurrencyStamp` yields `ConcurrencyFailure`. No test in the plan exercises
     this path through HTTP, and this machine cannot run Identity. It needs a check run
     against Identity 10.0.12, for example a scratch run (not committed) that loads one
     user in two scopes, updates it in one, then calls `UpdateAsync` in the other and
     prints `result.Errors[0].Code`; the expected output is `ConcurrencyFailure`.
     `UserAccessStore.Failed` maps that code to 409 `concurrency_conflict`. **PENDING.**

### 7.3 Studio (job `studio`), run locally at `1b947f5`

**First run after the screen change, before the fix in 3.1 item 1** (reported before it
was fixed):

```
$ cd studio && npx vitest run test/users.test.tsx           (exit 1)
     × changes a user's role after confirming
     × a cancelled role change sends nothing
     × shows why a role change was refused
     × reactivates an inactive user and shows the temporary password
     × offers to reactivate when a new user's email is deactivated
     × a taken active email shows the API's message
TestingLibraryElementError: Unable to find role="dialog" and name "Change role?"            (S1, S2, S4)
TestingLibraryElementError: Unable to find role="dialog" and name "Reactivate old@x.test?"  (S5)
TestingLibraryElementError: Unable to find role="dialog" and name "Create user"             (S6, S7)
      Tests  6 failed | 1 passed (7)
```

S7 had passed at the base, so this was a regression caused by the change, not by S7. A
debug render (not committed) showed the open dialog as
`<div role="dialog" aria-labelledby="test-id" ...>`: the row selects, earlier in the
page, also had the id `test-id` (3.1 item 1). The fix is in the screen; no test changed.

**After the fix:**

```
$ cd studio && npx vitest run test/users.test.tsx           exit 0
      Tests  7 passed (7)
$ cd studio && npx tsc -b                                    exit 0
$ cd studio && npm test                                      exit 0
 Test Files  14 passed (14)
      Tests  105 passed (105)
$ cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build    exit 0
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 1.36s
Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
```

The chunk-size warning is the base's: the same build at commit 2 (`486588c`, in a
temporary detached worktree, removed afterwards) printed the same warning and `build exit 0`.

**End-to-end (Playwright): NOT RUN.** `start-api.ts` starts the .NET API against
`DigitalHubContent_E2e`; there is no `dotnet` or SQL Server here. Covered by CI job
`studio`, "End-to-end suite": E1 must fail at step 2 at `bf634e2` and pass at the final
head, with every other spec passing (plan 5.3 and 5.4).

### 7.4 Website (job `website`): no file changes, run to show nothing moved

```
$ cd website && npm ci                     exit 0
$ cd website && npm run typecheck          exit 0
$ cd website && npx vitest run             exit 0
 Test Files  23 passed | 1 skipped (24)
      Tests  431 passed | 31 skipped (462)
$ cd website && npm run design:check       exit 0
All 25 files match: 24 identical, 1 ported with the recorded change.
$ cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build    exit 0
Redirect targets: all 0 resolve to a page.
Build output checks passed.
```

### 7.5 Overlap checks before commits 3 and 4 (C3, plan 4.1 step 3)

Run after `git fetch origin`, over all 21 `origin/change/*` heads except ADM-04, filtering
`git diff --name-only $(git merge-base <head> origin/rebuild/dotnet-platform) <head>` on
`Program.cs|UsersPage|UserAccess|TemporaryPassword|UserRole|ReactivationLog|users\.(test|spec)`.

Before commit 3 (base `2bbd586`):

```
origin/change/ADM-02 1836fdd: none        origin/change/GAP-04 7d90d5c: none
origin/change/ADM-03 2983c99: none        origin/change/GAP-06 4d45a1f: none
origin/change/ADM-05 741d70c: none        origin/change/GAP-07 c178cb3: none
origin/change/ADM-05-red 63c15dc: none    origin/change/GAP-08 0c3de71: none
origin/change/ADM-06 abe177b: none        origin/change/GAP-12 13cc747: api/src/DigitalHub.Api/Program.cs
origin/change/ADM-06b 9a08268: none       origin/change/aborted-request-log-race 2dbea44: none
origin/change/ADM-06b-flake 2f83558: none origin/change/ci-runner-pin b472fe5: none
origin/change/ADM-07 23079c0: none        origin/change/dataprotection-first-run 7bfdbd4: none
origin/change/ADM-10 04d0e80: none        origin/change/rate-limit-log-race 6afb318: none
origin/change/GAP-01 a0e29a2: none        origin/change/semgrep-error-detail fc5f656: none
                                          origin/change/semgrep-timeout 608c4a5: none
$ git diff --stat origin/change/GAP-12 origin/rebuild/dotnet-platform -- api/src/DigitalHub.Api/Program.cs
(empty; exit 0)
```

GAP-12 is merged (#40, squash, so it is not an ancestor) and its `Program.cs` equals the
base's, as gate 1 found. Before commit 4: the same 21 heads, base still `2bbd586`, and the
only hit is again `origin/change/GAP-12 13cc747: api/src/DigitalHub.Api/Program.cs`. **No
open branch touches a file in this change's scope.**

### 7.6 Track checklist (G3, `docs/changes/README.md`)

| Rule | State |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Plan section 1; the fix rows map to 3.1 (role change with the guard, reactivate), O-15 decided (no delete), 3.2 (UI) |
| The regression test is committed and shown failing before the fix | Commits `bf634e2` and `486588c` hold tests only. S1, S2, S4 to S6 shown red locally (4.2). T1 to T11, T13 to T16 and E1: **PENDING** CI at `bf634e2` |
| The end-to-end suite gets a test for each Major | ADM-04 is a Blocker; E1 is added for the G3-1 gate. **PENDING** CI |
| A Minor not fixed becomes a D-NNN | Not applicable |

## 8. Where C6's reads are (for the tester to confirm by reading)

All in `api/src/DigitalHub.Api/Content/UserAccessStore.cs` at `81b951b` (renumbered after
the round 1 fix, which added the own-id check at 59-61 and `OwnRole()` at 225-226):

- **The lock is the first statement in each transaction.** `ChangeRoleAsync`: the
  transaction begins at line 50 and `TakeUsersLockAsync` is called at 51, before any read.
  `ReactivateAsync`: 117 and 118. `TakeUsersLockAsync` (204-209) runs `UsersLockSql`
  (33-34: `sp_getapplock @Resource = N'digitalhub:admins', @LockMode = N'Exclusive',
  @LockOwner = N'Transaction', @LockTimeout = 5000`) through `ExecuteSqlRawAsync` (207);
  below 0 answers 503 `users_busy` (52, 119).
- **After the lock, in `ChangeRoleAsync`:** the target load `FindByIdAsync` at 55, the
  own-id check on the loaded `user.Id` at 60 (round 1, finding 1), its roles
  `GetRolesAsync` at 62, the deactivated check at 67, the admin count
  `GetUsersInRoleAsync(Roles.Admin)` at 74 (counting active admins other than the target,
  75), then `EnsureActorAsync` at 81. Before the lock there are only the role check (41-43)
  and the own-id check on the id as typed (46-47), which read nothing.
- **`EnsureActorAsync` reads fresh** (183-197): the actor with
  `db.Users.AsNoTracking()` (188), and its roles with a new query on `db.UserRoles`
  joined to `db.Roles`, both `AsNoTracking()` (192-195). It never uses an entity the
  context already tracks.
- **The reactivate route calls `EnsureActorAsync` after the lock** (120, after 118), and
  before the target load (124) and its roles (127).
- The write order in `ChangeRoleAsync`: `RemoveFromRolesAsync` (92), `AddToRoleAsync` (95),
  `UpdateSecurityStampAsync` (98), `tokens.RevokeUserAsync` (103), audit and commit
  (106-108). In `ReactivateAsync`: lockout cleared (136-138), temporary password and
  `RemovePasswordAsync`/`AddPasswordAsync` (141-147), `MustChangePassword` (148),
  `UpdateSecurityStampAsync` (149), `UpdateAsync` (154), `RevokeUserAsync` (159), audit of
  the role only and commit (162-164).

R3-2 stands as accepted at gate 1: the admin count's place inside the lock, and the
reactivate route's deactivated-actor branch, are covered by this reading only.

## 9. Pull request body (C10)

The coordinator opens the pull request (C4). The body must carry the following, as the
plan and gate 1 require:

> **Behaviour changes, for the owner**
> - B1: An admin can change any other active user's role between admin, editor and HR,
>   from User Management, after a confirmation.
> - B2: A role change signs the user out everywhere. They sign in again with the new role.
> - B3: An admin cannot change their own role (another admin does it), just as they cannot
>   deactivate themselves today.
> - B4: A deactivated user's role cannot be changed until they are reactivated.
> - B5: The last active admin cannot be made editor or HR (`last_admin`).
> - B6: A deactivated user can be reactivated. They keep their role, get a new temporary
>   password shown once to the admin, and must change it at sign-in.
> - B7: Creating a user with a deactivated user's email still fails. The screen now offers
>   "Reactivate instead".
> - B8: Two new audit actions: `change_user_role` and `reactivate_user`.
> - B9: A role change or reactivation can answer "Another change to the users is in
>   progress. Try again." (503, after 5 s at most) if another admin's change holds the lock.
> - B10: A request from an admin who was demoted or deactivated while it was in flight is
>   refused (403), even though it started with a valid token.
>
> **Known exposure until ADM-04b:** a demotion racing a deactivate, or two deactivates, can
> still leave no active admin (plan 4.2).
>
> **Owner decisions**, by card tap, Mohamed Elbadry, 12 November 2026, 12:09 UTC, as
> relayed by the coordinator:
> - O-ADM04-1 (O-15): "No, deactivate is enough"
> - O-ADM04-2: "New temporary password"
> - O-ADM04-3: "Yes, red tests first"

## 10. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| An admin can change another user's role (API) | ADM-04 Fix 1; FR-S-02; `phase-b-studio.md` line 43 | Implemented; test PENDING CI | `UserAccessStore.ChangeRoleAsync` (`1806847`); T1 (`bf634e2`), CI job `api` |
| The last-admin guard holds for role changes, from the database | ADM-04 Fix 1; 8.4, 10.11 | Implemented; test PENDING CI | `UserAccessStore.cs:72-78`, inside the lock; T3, CI job `api` |
| Concurrent role changes cannot both pass the guard | 2.4; F-1 | Implemented; test PENDING CI (3 runs, C5) | Lock first (50-51); T15, CI job `api`. The count's place in the lock: by reading only (section 8, R3-2) |
| A demoted or deactivated actor cannot finish an in-flight change | F-6, R2-2 | Implemented; tests PENDING CI | `EnsureActorAsync` (183-197), called at 81 and 120; T14, T15, T16, CI job `api`. Reactivate's deactivated-actor branch: by reading only (section 8) |
| A role change ends the user's sessions, including one re-opened by a racing refresh | 2.5; F-5 | Implemented; tests PENDING CI | Stamp rotated (98), tokens revoked (103); T2, T13, CI job `api` |
| An admin cannot change their own role | B3 | Implemented; tests PENDING CI | `UserAccessStore.cs:46-47` (id as typed) and 60-61 (the loaded `user.Id`, round 1 finding 1); T8, T17 (`deff0ce`), CI job `api` |
| A deactivated user can be reactivated with a new temporary password (API) | ADM-04 Fix 2; O-ADM04-2 | Implemented; test PENDING CI | `ReactivateAsync`, `TemporaryPassword.cs`; T4, CI job `api` |
| Reactivation restores the new-user lockout state and fails cleanly | F-7 | Implemented; tests PENDING CI | 136-138; every `IdentityResult` checked (142-156) inside the transaction; T4, T6, CI job `api` |
| Reactivation does not revive old sessions | Brief | Implemented; test PENDING CI | `RevokeUserAsync` (159), stamp rotated (149); T5, CI job `api` |
| A deactivated email can be used again, by reactivation | ADM-04 title, bullet 2 | Implemented; S6 green locally; T12, E1 PENDING CI | S6 passes at `1b947f5` (7.3); T12, E1, CI jobs `api`, `studio` |
| Role changes and reactivations are audited; the temporary password is in no application log or audit row | Brief; FR-S-15; F-2 | Implemented; tests PENDING CI | Audit at 106 and 162 (role only); T1, T4, T10, CI job `api` |
| The reactivation answer is not cached | F-9 | Implemented; test PENDING CI | `UserAccessController.Reactivate` sets `no-store`; T4, CI job `api` |
| Editors, HR, deactivated and must-change users cannot reach the new routes | Brief; 10.2 | Implemented; tests PENDING CI | `[Authorize(Policy = "studio-admin")]`, no `AllowedBeforePasswordChange`; T11 and `CareersTests` unchanged, CI job `api` |
| User Management: role change with confirmation | ADM-04 Fix 4 | Done (unit); E1 PENDING CI | S1, S2, S4 red at `486588c`, green at `1b947f5` (4.2, 7.3) |
| User Management: Reactivate on inactive rows | ADM-04 Fix 4 | Done (unit); E1 PENDING CI | S5 red at `486588c`, green at `1b947f5` |
| User Management: a deactivated email offers Reactivate | ADM-04 Fix 4 | Done (unit); E1 PENDING CI | S6 red, S7 green at `486588c`; both green at `1b947f5` |
| Decision O-15 on delete | ADM-04 Fix 3 | Decided, no code | O-ADM04-1 "No, deactivate is enough" (as relayed) |
| Regression tests committed and shown failing before the fix | G3 checklist; O-ADM04-3 | Studio: done. API and E1: PENDING CI at `bf634e2` | 4.1, 4.2 |
| An end-to-end test of role change, deactivate and reactivate | G3-1 exit gate | Written; PENDING CI | `studio/e2e/users.spec.ts` (`bf634e2`), CI job `studio` |
| FR-S-02 moves from "Partly" to "Works" | Audit line 29 | PENDING (on delivery) | Follows the rows above passing in CI |
| No ADM-04 commit touches a file ADM-05 or ADM-10 touches; the base is merged, never rebased | `AGENTS.md`; ADM-05 4.1 step 6 | Done | Section 2 (merge, is-ancestor exit 0), section 3 (file list), 7.5 (overlap checks) |
| Release build warnings no more than the base's 13 | C9 | PENDING CI | Job `api` build log |
| Green on the final head in every workflow | 5.4 | PENDING (Actions blocked by billing) | `ci.yml` jobs `api`, `website`, `studio`, `section-compare`, `screenshot-parity`, `website-browser`; `security.yml`, `codeql.yml`, `workflow-lint.yml` |
| Deactivate and reset take the same lock and actor check; reset answers `no-store`; duplicated helpers removed | F-3, F-9 | Moved: ADM-04b (plan 4.2) | Copies listed in section 6 |

## 11. For the tester

- **Nothing in C# has been compiled.** The first CI `api` run will show any compile error
  in the three test files (at `bf634e2`) and the three source files (at `1806847`). A
  compile error in a test file at `bf634e2` is a failure of commit 1, not the red; it must
  be reported, and fixing it needs a new test commit (commit 1 is not amended, C4).
- Commit 1 must be pushed and its CI run finished (`api`, `website`, `studio`) before
  anything later is pushed (C4). Nothing has been pushed from here.
- C7 item 3 (a stale `ConcurrencyStamp` gives `ConcurrencyFailure`) has no test in the plan
  and cannot be checked here; section 7.2 says what to run and quote.
- Read section 3.1 item 1: two small additions to the screen that only the test
  environment needed. Judge whether they are acceptable under 3.2 "Nothing else on the
  screen changes"; the create modal's behaviour for a user is unchanged.

Status: READY FOR TEST
