# ADM-04: plan

Change id: `ADM-04`. Branch: `change/ADM-04`, worktree `/home/user/dh-change-adm04`,
cut from `origin/rebuild/dotnet-platform` at `32f0414` (ADM-07 merged as #55). The base
is now `2bbd586` (ADM-10 merged as #56). The developer merges it in first (4.1).

Architect, round 2, 12 November 2026. Round 1 (`4ad921b`) came back CHANGES NEEDED
(`plan-review.md` Round 1 at `81a105c`: two Majors, nine Minors). Section 12 answers
each one. The owner has answered all three questions (section 9).

The main changes since round 1:

- A new test, T15, runs the two demotions at the same moment, and the actor is checked
  again inside the lock (F-1, F-6).
- T10 reads the application's own logs (F-2).
- The role change also rotates the security stamp, with a test for a refresh that
  races it (F-5).
- ADM-04b has a slot (F-3).
- The confirmation is a controlled `<Modal>` (F-4).

Line numbers are at `32f0414` unless stated. `AdminStore.cs` lines are unchanged by
ADM-10 up to line 242, and later lines shift by a few.

**One change: an admin can change a Studio user's role and reactivate a deactivated
user, from the API and from User Management.** The last-admin guard is kept. A role
change ends the user's sessions and invalidates their tokens. This closes ADM-04. On
delete, the owner chose (a), no delete (O-ADM04-1 = O-15), so there is no delete code
and no ADM-04c.

**Shared files.** This change edits **no file that ADM-05 or ADM-10 edits**. It does not
touch `AdminStore.cs` or `AdminControllers.cs`. The new routes live in a new controller
and a new store (3.1). The follow-ups that need `AdminStore.cs` or
`AdminControllers.cs` are ADM-04b. ADM-04b is planned and written only after ADM-05 has
merged, as the first change after it, inside G3-1 (4.2).

## 1. Item

- **Closes:** ADM-04 (Blocker). Quoted from
  `/mnt/attach/project-files/docs/quality/admin-audit-2026-10-28.md`, lines 105-116:
  > **ADM-04: users cannot have their role changed, be reactivated or be deleted, and
  > a deactivated email can never be used again.**
  > - `UsersController` (`AdminControllers.cs:74-100`) has list, create, deactivate
  >   and reset only.
  > - Re-creating a deactivated email returns `409 email_taken`.
  > - Promoting an editor, fixing a wrong role or bringing back a returning employee
  >   needs a new email address or direct database work.
  > - Fix:
  >   - Change role, keeping the last-admin guard.
  >   - Reactivate.
  >   - Decision O-15 on delete.
  >   - The matching UI.
- **Requirement:** the audit's requirement table, line 29: "FR-S-02 users | Partly |
  No role change, reactivation or delete (ADM-04)". `docs/business-analysis.md`
  line 303: "FR-S-02 | Administrators create, deactivate, and reset users and assign
  roles". `docs/phase-b-studio.md` line 43: "Users | — | Create, deactivate, reset
  password, assign role". 8.4 (line 254): "An admin cannot deactivate themselves or
  remove the last active admin." 10.11 (line 309): "Deactivating a user revokes
  their session immediately; the last admin cannot be removed".
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. The refinement plan's
  G3 table (`refinement-plan-2026-10-28.md` line 225) lists "ADM-04 role change and
  reactivation". The batch order (line 26) is "ADM-06, 03, 02, 07, 10, 05, 04, 12,
  01a". ADM-06, 03, 02, 07 and 10 have merged. ADM-05 has not (2.8).
- **"Done when":**
  - The G3-1 exit gate (line 225): "A clean website build from
    `DigitalHubContent_Studio` with no patched content; each blocker reproduced
    before its fix and passing after it".
  - The G3 track (line 17): "All six blockers fixed by 16 November".
  - The G3 rule (line 221): "Every fix carries a regression test that fails first."
  - The success measure (line 248): "Admin-function blockers open | 6 | 0 | 16 Nov".
  - The G3 checklist (`docs/changes/README.md`): "The regression test is committed and
    shown failing before the fix. The end-to-end suite gets a test for each Major."

### Required reading, and what is missing

| File | State |
| --- | --- |
| `CLAUDE.md`, `AGENTS.md` | Read. Identical (`diff AGENTS.md CLAUDE.md`, exit 0) |
| `docs/changes/README.md` | Read |
| `ENGINEERING_STANDARDS.md` | **Missing** in the worktree (`ls`: "No such file or directory"), on the base (the reviewer's `git ls-tree -r`) and in `/mnt/attach/project-files`. Not guessed. Rule ids (P-6, P-7, P-8, B-8) are used only as `docs/changes/README.md` and the ADM-05, ADM-07 and ADM-10 records use them |
| `docs/PROJECT_PROFILE.md` | **Missing.** Not guessed |
| `docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md` | Not in the worktree (`docs/quality` does not exist). Read from `/mnt/attach/project-files/docs/quality/` |
| `docs/adr/0001-split-public-forms-api.md` | Not needed (G3). `docs/adr/` is not in the worktree |
| `docs/deferred-items.md` | Not in the worktree. Not needed: nothing here becomes a D-NNN entry (F-9 is fixed in this change, 3.1) |
| `docs/changes/ADM-04/plan-review.md` (Round 1, `81a105c`) | Read. Every finding is answered in section 12 |
| ADM-05 `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md` (`/home/user/dh-change-adm05/docs/changes/ADM-05/`) | Read for format, for its file list and for its 4.1 step 6 hold on ADM-04 |
| ADM-07 `plan.md`, ADM-10 `delivery-approval.md` (from `origin/rebuild/dotnet-platform`) | Read for the red-first answers and the lock and gate pattern |
| `docs/phase-b-studio.md`, `docs/business-analysis.md` | Read for the rules quoted above |
| `/mnt/attach/project-files/uploads/hearth/179f322b-...` (chat export, 1 November) | Searched for O-15 in round 1 (section 9) |

## 2. Current state

### 2.1 The base, and what has merged since the cut

```
$ git log --oneline -3
81a105c ADM-04: Plan review round 1
4ad921b ADM-04: Plan round 1
32f0414 ADM-07: Flag redirects with no page and make redirect creates safe under load (#55)
$ git rev-parse origin/rebuild/dotnet-platform
2bbd586267e94e7c713ae5b905d8f4df66d75230
$ gh api "repos/<owner>/<repo>/pulls/56" --jq '{state,merged,merged_at,title}'
{"merged":true,"merged_at":"2026-11-12T11:58:12Z","state":"closed","title":"ADM-10: Keep the default share image when Settings is saved"}
$ git ls-remote origin refs/heads/change/ADM-05
294fb4d547bca8afe0f8ae749acbf64e9fa3e00e	refs/heads/change/ADM-05
$ git log --oneline -3 origin/change/ADM-05
294fb4d ADM-05: Test report round 1
e04e57a ADM-05: Implementation record
e8dc356 ADM-05: Exempt the 404 and 500 pages from the meta-description rule
```

- **ADM-10 has merged** (#56, `2bbd586`).
- **ADM-05 has not merged.** The coordinator gave its head as `e04e57a`. Since then the
  remote has moved one commit on, to `294fb4d`, which adds a test report and no source
  file.
- The open pull requests in round 1 were #57 (`change/ADM-05-red`, "do not merge") and
  #44 (`change/GAP-07`, `.github/` only).

### 2.2 The API has list, create, deactivate and reset only

`UsersController` (`AdminControllers.cs:73-101`, `[Authorize(Policy =
"studio-admin")]`, `[Route("api/v1/users")]`):

- `GET` → `AdminStore.ListUsersAsync` (313-334).
- `POST` → `CreateUserAsync` (336-381). It has `[RequestBodyLimit(AuthController.AuthBodyLimit)]`
  (4 KB) and `[RejectDuplicateJsonFields]`.
- `POST {id}/deactivate` → `DeactivateUserAsync` (383-414).
- `POST {id}/reset-password` → `ResetPasswordAsync` (416-440).

No route changes a role or reactivates a user. A role is set only at create
(`users.AddToRoleAsync(user, request.Role)`, 366).

### 2.3 A deactivated email can never be used again

`CreateUserAsync`, 348-350:

```csharp
var email = request.Email.Trim();
if (await users.FindByEmailAsync(email) is not null)
    return ContentOutcome.Fail(StatusCodes.Status409Conflict, "email_taken", "A user with that email already exists.");
```

`FindByEmailAsync` finds deactivated users too, and `Program.cs:63` sets
`options.User.RequireUniqueEmail = true`. Deactivation never frees the email, and
nothing undoes a deactivation.

### 2.4 What deactivation is

`DeactivateUserAsync` (383-414):

- It refuses the caller's own id with 400 `cannot_deactivate_self` (385-386).
- An unknown or already deactivated user gets 404 "That user does not exist." (388-390).
- **The last-admin guard** (392-399):
  ```csharp
  if (roles.Contains(Roles.Admin))
  {
      var admins = await users.GetUsersInRoleAsync(Roles.Admin);
      var activeAdmins = admins.Count(candidate => !IsDeactivated(candidate));
      if (activeAdmins <= 1)
          return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "last_admin", "The last active admin cannot be deactivated.");
  }
  ```
  The count runs outside the transaction and takes no lock. Two admins deactivating
  each other at the same moment can both pass it (read from the code, not run; the
  reviewer agrees).
- It sets `LockoutEnabled = true` and `LockoutEnd = DateTimeOffset.MaxValue`
  (402-403), revokes every live refresh token (`RevokeRefreshTokensAsync`, 460-468),
  and audits `deactivate_user` (410).
- `IsDeactivated` (850-851) is `LockoutEnabled && LockoutEnd > now`. The same check is
  written out again in `SessionCheck.cs:44-46`, in `TokenService.RefreshAsync`
  (100-103) and in login (`AuthController.cs:52`).
- A new user has `LockoutEnabled = false` (`Program.cs:64`,
  `Lockout.AllowedForNewUsers = false`).

### 2.5 Roles ride in the access token; sessions are checked on every request

- `TokenService.CreateAccessToken` (217-227) puts one `role` claim per role into the
  JWT. `Program.cs:228` sets `RoleClaimType = "role"`. The policies `studio` and
  `studio-admin` (`Program.cs:260-261`) and `StudioAccess` all read those claims.
- The access token lives `Auth:AccessTokenMinutes` = 10 minutes (`appsettings.json`).
- `SessionCheck.ValidateAsync` (`SessionCheck.cs:26-70`) runs on every request. It
  checks three things:
  - the user exists and is not locked out;
  - the token's `sst` claim matches the user's current security stamp (44-50);
  - the token's refresh-token family still has a live token.

  **It does not re-read roles.**
- `RefreshAsync` (63-117) reads three things, in this order:
  - the current refresh token;
  - the user, including `SecurityStamp` (95);
  - the roles (106).

  It then marks the current token revoked, adds a new live token in the same family,
  and saves. `RefreshTokens` has no concurrency token
  (`ContentDbContext.cs:57-63`: indexes and lengths only).
- `TokenService.RevokeUserAsync(userId, keepFamily, ct)` (159-169) is public. It
  revokes every live refresh token of the user except `keepFamily`, and saves.

**So a role change that only edits `AspNetUserRoles` leaves a demoted admin with admin
rights for up to 10 minutes.** Revoking the refresh tokens closes most of that: the
next request fails the live-family check. One window is left, found by the review
(F-5). Suppose a refresh reads the user and roles before the role change commits, and
saves its new token afterwards. Then the family is live again, and the refresh has
issued a new 10-minute access token with the old role and the old stamp. **Rotating
the security stamp as well closes that window.** The token carries the old stamp, and
`SessionCheck` compares it with the new one. The code supports this:
`UserManager.UpdateSecurityStampAsync`, which saves through the same scoped
`ContentDbContext`. T13 proves it (5.1).

### 2.6 The Studio screen

`studio/src/pages/UsersPage.tsx` (132 lines):

- The columns (87-106) are Email, Role (a `StatusChip`), and Status ("Active", "Must
  change password", "Inactive"). Active rows also get "Reset password" and
  "Deactivate" (98-104). **An inactive row has no action at all**, and no row's role
  can be changed.
- `create()` (44-55) shows `result.problem?.title` on failure. A deactivated email
  therefore shows "A user with that email already exists." and nothing more.
- The dialogs are controlled antd `<Modal>`s: create (108-118) and the
  temporary-password one (119-129).
- `git grep` finds no `Modal.confirm` or `useModal` in `studio/src` (the reviewer's
  check, F-4).
- `useAuth().user` is a `StudioUser` with `id`, `email` and `role`
  (`studio/src/auth/session.ts:3-8`), so the screen can tell which row is the
  signed-in admin's own.

### 2.7 Tests that cover users today

- `AdminApiTests.Users_enforce_roles_password_length_self_and_last_admin_and_revoke_sessions`
  (`AdminApiTests.cs:288-379`) covers a bad role, a short password, deactivating
  yourself, and refresh after a deactivate (401).
  - It tests the last-admin guard **at store level**, because through the API "the
    last active admin can only be asked to deactivate themselves" (comment at
    364-366).
  - It locks every other admin, then restores the primary admin with
    `EnsurePrimaryAdminActiveAsync` (598).
- `AdminApiTests.Temporary_password_does_not_appear_in_application_logs` (381-) builds a
  private Serilog `LoggerConfiguration` with a `CollectingSink` (410-418). **It never
  sees the API's own log events** (review F-2).
- Application logs are captured by registering a sink in the test host:
  `RateLimitLogTests.LoggingFactory` (`RateLimitLogTests.cs:85-97`,
  `services.AddSingleton<ILogEventSink>(Sink)`). `Program.cs:30-33` reads sinks from
  services (`ReadFrom.Services`). `appsettings.json` sets `MinimumLevel.Default`
  "Information", with overrides for `Microsoft.AspNetCore` and
  `Microsoft.EntityFrameworkCore` at "Warning". The request log is
  `UseSerilogRequestLogging` (`Program.cs:274`).
- `SessionCheckTests` (`SessionCheckTests.cs:34-75`): a deactivated or locked-out
  user's access token is refused on the next request.
- `DuplicateFieldTests` (`DuplicateFieldTests.cs:21-60`): two `email` keys, and a body
  over 4 KB.
- `RedirectConcurrencyTests` (`RedirectConcurrencyTests.cs:20-40`, 201-290):
  `GatedApiFactory` adds a `DbCommandInterceptor` that holds reader commands carrying
  a marker until two have arrived or a cap has passed. That is how ADM-07 proved its
  check runs inside its lock.
- `CareersTests.Authorization_matches_for_every_endpoint` (`CareersTests.cs:438-480`)
  walks **every** `api/v1` endpoint as admin, editor, HR, no role, deactivated and
  must-change.
  - `EditorBlocked` (528-533) expects 403 for editors on anything under
    `/api/v1/users`.
  - HR and no-role users get 403, deactivated users 401, and must-change users 403
    `password_change_required`.
  - New routes under `/api/v1/users` are picked up with no edit. The test calls them
    with no body and a dummy id, so it changes nothing.
- `studio/e2e/studio.spec.ts` 10.17 (110-130): an editor gets 403 from
  `GET /api/v1/users` and has no User Management link.
- No Studio unit test covers `UsersPage`.

### 2.8 Other branches and the files they touch

`AGENTS.md`: "Parallel work must change different files." ADM-05's plan, 4.1 step 6:
"ADM-04 does not start work on `AdminStore.cs` or `AdminControllers.cs` until ADM-05
has merged." Its approval makes that a condition for the coordinator
(`plan-approval.md` line 147).

`git diff --name-only $(git merge-base origin/change/ADM-05 origin/rebuild/dotnet-platform) origin/change/ADM-05`,
ignoring `docs/`, at `294fb4d`:

```
api/src/DigitalHub.Api/Content/AdminStore.cs
api/src/DigitalHub.Api/Content/ContentStore.cs
api/src/DigitalHub.Api/Content/PublishChecks.cs
api/src/DigitalHub.Api/Controllers/AdminControllers.cs
api/tests/DigitalHub.Api.Tests/ErrorPagePublishTests.cs
studio/e2e/error-pages.spec.ts
studio/src/pages/ErrorPagesPage.tsx
studio/test/errorPages.test.tsx
```

- ADM-10's files (merged) were `AdminStore.cs`, `SettingsShareImageTests.cs`,
  `settings.spec.ts`, `SettingsPage.tsx`, `settingsShareImage.test.tsx`,
  `website/src/seo/head.ts` and `website/test/seo.test.tsx`.
- `change/GAP-07` touches `.github/` only.
- The review checked every remote `change/*` head the same way. Only `change/GAP-12`
  touches `Program.cs`, and it is merged (`a866cf6`, #40) with the same `Program.cs`
  as the base. No head touches `UsersPage.tsx` or any file this change creates.

**None of those files is in this change's scope (section 4).**

### 2.9 Delete, and what refers to a user

- `AuditLogEntry.UserId` (`ContentEntities.cs:503`) has no foreign key. The app login
  cannot update or delete audit rows (`ci.yml:112`, `docs/security-deployment.md:18`).
- `ContactRequest.HandledById` has a foreign key to `AspNetUsers` with `NoAction`
  (`ContentModelBuilder.cs:186-189`).
- The owner chose no delete (O-ADM04-1, section 9), so none of this is changed.

### 2.10 What I could run here

- I ran `git status`, `git log`, `git show`, `git diff`, `git ls-remote`, `gh api`
  (REST), `ls` and `grep`, as quoted.
- **Not runnable:** no `dotnet` on `PATH`, no SQL Server, no `sqlcmd`, and no
  `node_modules` in `studio/`. I ran no suite, build or audit, and read no database.
  Claims marked "read from the code" are exactly that.

## 3. Design

### 3.1 API: two routes in a new controller and a new store

**Placement.** `UsersController` and `AdminStore` are in files ADM-05 edits. Two
controllers can share a route prefix under attribute routing, so the new routes go in
a new controller with the same prefix and policy, backed by a new store:

- `api/src/DigitalHub.Api/Controllers/UserAccessController.cs` (new):
  - `[ApiController]`, `[Authorize(Policy = "studio-admin")]`,
    `[Route("api/v1/users")]`, constructor `(UserAccessStore store)`.
  - `UserId()` and `Respond()` as in `UsersController` (`AdminResponse.From`).
  - Both actions carry `[RequestBodyLimit(AuthController.AuthBodyLimit)]` (4 KB). The
    role action also carries `[RejectDuplicateJsonFields]`.
  - On a 200 from reactivate, the action sets `Response.Headers.CacheControl =
    "no-store"` (F-9).
- `api/src/DigitalHub.Api/Content/UserAccessStore.cs` (new):
  `public sealed class UserAccessStore(ContentDbContext db, UserManager<ApplicationUser>
  users, TokenService tokens)`.
  - **Refresh tokens are revoked through `TokenService.RevokeUserAsync(id, null, ct)`**
    (F-8), not a copy. It saves through the same scoped `ContentDbContext`, so it runs
    inside the open transaction.
  - Its own private `Audit`, `Missing`, `Validation` and `IsDeactivated`, with the same
    bodies as `AdminStore`'s. These three are listed for ADM-04b.
- `api/src/DigitalHub.Api/Identity/TemporaryPassword.cs` (new, `internal static`):
  - It holds `AdminStore`'s temporary-password algorithm, copied as it is
    (`NewAcceptedTemporaryPasswordAsync` 446-457, `NewTemporaryPassword` 853-878).
  - 16 characters from the same four sets, one of each set required, drawn with
    `RandomNumberGenerator` and shuffled. Each draw is checked against every password
    validator, with at most 10 draws.
  - ADM-04b points `AdminStore` at it and deletes `AdminStore`'s copy.
- `Program.cs`: one line after line 76, `builder.Services.AddScoped<UserAccessStore>();`.

**The users lock.** Both writes take the same app lock, in the ADM-07 pattern
(`AdminStore.cs:197-214`). It is the first statement inside the transaction, before
any read of the target, the actor or the admins:
`sp_getapplock @Resource = N'digitalhub:admins', @LockMode = N'Exclusive', @LockOwner =
N'Transaction', @LockTimeout = 5000`. A result below 0 means roll back and answer 503
`users_busy` "Another change to the users is in progress. Try again." Every read
below is inside the lock, and T15 proves it (F-1).

**The actor is checked again inside the lock (F-6).** It is the
`EnsureActorAsync(actorId)` step below. It reloads the actor by id. If the actor is
gone, deactivated (`IsDeactivated`) or no longer in role `admin`, the answer is 403
`forbidden` "You do not have access to this resource." (the text of
`Program.cs`'s `OnForbidden`), and nothing is written. A request sent by an admin who
has been demoted or deactivated, and is still in flight, therefore cannot complete.
The token was valid when the request started; the database decides at the write.

**`PUT /api/v1/users/{id}/role`**, body `UserRoleChange { string Role }`.
`ChangeRoleAsync(id, request, actorId, ct)` runs these steps in order:

1. `Role` must be `admin`, `editor` or `hr` (`Roles.All`, ordinal). Otherwise: 400
   `validation_failed`, `errors.role` "Role must be admin, editor, or hr." (today's
   create text).
2. If `id == actorId`: 400 `cannot_change_own_role` "You cannot change your own role."
3. Begin a transaction and take the users lock. If it fails: 503 `users_busy`.
4. Load the target (`FindByIdAsync`) and its roles. No user, or no Studio role
   (`Roles.IsKnown`): 404 "That user does not exist."
5. A deactivated target: 400 `user_deactivated` "Reactivate this user before changing
   their role."
6. **The last-admin guard.** Applies when the target's roles include `admin` and the
   new role is not `admin`. Count the active admins other than the target
   (`GetUsersInRoleAsync(Roles.Admin)`, `!IsDeactivated`, `Id != id`). If there are
   none: 400 `last_admin` "The last active admin cannot lose the admin role."
   - It is deactivate's rule. `activeAdmins <= 1` with the target counted is the same
     as "no other active admin".
   - It is read from the database inside the lock.
   - It comes before step 7 on purpose. Through HTTP the guard can fire only when the
     actor is stale: the actor's token still says admin, but the database no longer
     does. With the actor counted, there is always another active admin. That is the
     case T3 builds. If step 7 came first, the guard could never be reached by a
     request, and so could never be tested (review F-6).
7. `EnsureActorAsync(actorId)`: 403 `forbidden` as above.
8. Same role as now: commit (no write) and answer 200 with the user. **No audit, and
   sessions untouched.**
9. Make the change:
   - `RemoveFromRolesAsync(user, <its Studio roles>)`, then `AddToRoleAsync(user, role)`.
   - Then `UpdateSecurityStampAsync(user)` (2.5, F-5).
   - Any failed `IdentityResult` rolls back. A `ConcurrencyFailure` code answers 409
     `concurrency_conflict` "Someone else changed this user. Reload and try again."
     Any other failure answers 400 `validation_failed` "The role could not be
     changed."
10. `tokens.RevokeUserAsync(id, null, ct)`.
    - The user's next request with any access token they hold is 401: the family is
      revoked, and the stamp no longer matches.
    - They sign in again with the new role.
    - This also applies to a promotion. One rule, and a promoted user's old token
      would otherwise lack the new rights for 10 minutes.
11. Audit `change_user_role`, entity `user`, the user's id, detail `"<old> -> <new>"`
    (for example `editor -> admin`). Save and commit.
12. Answer 200 `{ id, email, role, active: true, mustChangePassword }`, the shape of a
    list row.

**`POST /api/v1/users/{id}/reactivate`**, no body, capped at 4 KB (F-7).
`ReactivateAsync(id, actorId, ct)`:

1. Begin a transaction and take the users lock (503 `users_busy` on failure).
   `EnsureActorAsync(actorId)` (403).
2. Load the target. No user, or no Studio role: 404 "That user does not exist."
3. Not deactivated: 400 `already_active` "That user is already active."
4. Clear the lockout:
   - `LockoutEnd = null`.
   - `AccessFailedCount = 0`.
   - **`LockoutEnabled = users.Options.Lockout.AllowedForNewUsers`** (F-7). That is
     `false` today, the state of a newly created user (`Program.cs:64`). When ADM-11
     turns lockout on for new users, the value follows without any edit here.
5. **The password (O-ADM04-2 = (a), section 9):** draw a temporary password with
   `TemporaryPassword.NewAcceptedAsync(users, user)`, then:
   - `RemovePasswordAsync`, then `AddPasswordAsync(temporary)`;
   - `MustChangePassword = true`;
   - `UpdateSecurityStampAsync(user)`, called explicitly so the design does not depend
     on whether `AddPasswordAsync` rotates the stamp.
6. `UpdateAsync(user)`. **Failure paths (F-7)**, the same as the role change: any failed
   `IdentityResult` from steps 5 or 6 rolls back. A `ConcurrencyFailure` (for example,
   a role change or reset racing on the same user) answers 409 `concurrency_conflict`
   "Someone else changed this user. Reload and try again." Any other failure answers
   400 `validation_failed` "The user could not be reactivated." Nothing is half
   written: the user stays deactivated with the old password.
7. `tokens.RevokeUserAsync(id, null, ct)`. There should be no live token, since
   deactivation revoked them. **Old sessions are never revived.** A refresh token
   revoked at deactivation stays revoked, and using it revokes its family
   (`TokenService.cs:72-75`).
8. Audit `reactivate_user`, entity `user`, the user's id, detail = the user's role.
   **Never the password.** Save and commit.
9. Answer 200 `{ id, email, role, active: true, mustChangePassword: true,
   temporaryPassword }`, with `Cache-Control: no-store`.

The reactivated user keeps the role they had. A different role is a role change
afterwards, so it takes two audited steps.

**Create on a deactivated email is unchanged in the API.** It still answers 409
`email_taken` (`AdminStore.cs:348-350`, pinned by T12). The screen tells the admin
that the email belongs to a deactivated user and offers Reactivate (3.2), using the
list it already has.

### 3.2 Studio: role change and reactivation on User Management

`studio/src/pages/UsersPage.tsx`.

**The confirmation dialog (F-4)** is one more controlled antd `<Modal>`, like the
create and temporary-password modals already on the screen. It is not
`Modal.confirm` (the static API, outside the React tree and the theme) and not
`useModal`.

- State: `pending: { kind: "role"; row: UserRow; role: string } | { kind:
  "reactivate"; row: UserRow } | null`.
- `open={pending !== null}`. `onOk` runs the action, `onCancel` clears `pending`.
- The empty-body `afterEach` guard in the unit tests stays exactly as it is
  (ADM-06b-flake, P-6).

What the screen does:

- **Role column.** An active row that is not the signed-in admin's own
  (`row.id !== auth.user.id`) gets an antd `Select` (`aria-label` "Role for
  <email>"). The options are `editor`, `admin`, and `hr` labelled "HR", as in the
  create form at 112. The select is controlled by the row's stored role.
  - Choosing a different value sets `pending` to `{ kind: "role", ... }`. The modal's
    title is "Change role?", its text "<email> becomes <role>. They are signed out
    and sign in again with the new role.", and its OK button "Change role".
  - OK sends `PUT /api/v1/users/{id}/role` with `{ role }`.
  - On 200: `message.success("Role changed. <email> must sign in again.")`, then
    `load()`.
  - On failure: the problem's title in the error line, as today. The select still
    shows the stored role, because it never changed.
  - Cancel sends nothing.
  - The admin's own row and inactive rows keep the chip.
- **Inactive rows** get one action, "Reactivate".
  - It opens the modal with the title "Reactivate <email>?", the text "They get a
    temporary password and must change it at sign-in.", and OK "Reactivate".
  - OK sends `POST /api/v1/users/{id}/reactivate`.
  - On 200 the existing temporary-password modal opens with `temporaryPassword`
    (119-129), and the list is reloaded with `load()`.
- **Create on a deactivated email.** Applies when `POST /api/v1/users` answers 409
  with `problem.code === "email_taken"`, and `items` has an inactive row whose email
  equals the typed one (trimmed, case-insensitive).
  - The create modal then shows "That email belongs to a deactivated user." and a
    button "Reactivate instead".
  - The button closes the create modal and opens the Reactivate confirmation for that
    row.
  - Otherwise the title shows as today.
- Nothing else on the screen changes. Reset password and Deactivate stay as they are.

### 3.3 Sessions, tokens and audit, together

| Event | Refresh tokens | Security stamp | Access tokens in use | Audit |
| --- | --- | --- | --- | --- |
| Role change (any direction) | All revoked | Rotated | 401 on the next request, including one a racing refresh just issued (T2, T13) | `change_user_role`, `"<old> -> <new>"` |
| Same role | Untouched | Untouched | Untouched | None |
| Refused change (`last_admin`, `cannot_change_own_role`, `user_deactivated`, `forbidden`, 503, 409) | Untouched | Untouched | Untouched | None, as for a refused deactivate today |
| Reactivate | Any live one revoked; those revoked at deactivation stay revoked | Rotated | Old ones stay 401 (T5) | `reactivate_user`, the role; never the password (T10) |

### 3.4 Alternatives rejected

- **Add the routes to `UsersController` and `AdminStore`.** That is the natural home,
  but both files are ADM-05's (2.8). The new files keep ADM-04 off them entirely, and
  ADM-04b tidies up afterwards (4.2).
- **Let create reactivate a deactivated email.** A create would silently bring back a
  user with their old role and history. Reactivation must be its own, audited admin
  decision. This would also need `AdminStore.cs`.
- **A distinct 409 code for a deactivated email** (`email_deactivated`, with the id).
  It edits `CreateUserAsync` in `AdminStore.cs`, and the screen already has the
  list. Listed as optional in ADM-04b.
- **Rotate the stamp instead of revoking tokens.** Either one alone ends the sessions.
  Round 2 does **both** (F-5): revocation is the mechanism deactivate and reset
  already rely on, and the stamp closes the racing-refresh window (2.5, T13).
- **Re-read roles in `SessionCheck` on every request.** That would close the window on
  every path, but it adds a read to every request and changes `SessionCheck`, which is
  not this finding. The stamp does the same job for this path.
- **Check the actor before the last-admin guard.** The guard could then never be
  reached by a request, and so could not be tested (3.1 step 6).
- **Do not re-check the actor; state the window instead** (the review's other F-6
  option). A demoted admin's request already in flight could still promote someone to
  admin. That is not acceptable for the strongest action in the Studio.
- **`Modal.confirm` or `useModal`.** Rejected in 3.2 (F-4).
- **Copy the revoke helper.** `TokenService.RevokeUserAsync` already exists and is
  public (F-8).

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Controllers/UserAccessController.cs` | `PUT {id}/role`, `POST {id}/reactivate`, the 4 KB caps, `no-store` on reactivate (3.1) |
| `api/src/DigitalHub.Api/Content/UserAccessStore.cs` | `ChangeRoleAsync`, `ReactivateAsync`, `UserRoleChange`, the users lock, `EnsureActorAsync`, private helpers (3.1) |
| `api/src/DigitalHub.Api/Identity/TemporaryPassword.cs` | The temporary-password generator, copied (3.1) |
| `api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs` | T1 to T14 (5.1) |
| `api/tests/DigitalHub.Api.Tests/UserRoleConcurrencyTests.cs` | T15, with its own gated factory (5.1) |
| `api/tests/DigitalHub.Api.Tests/ReactivationLogTests.cs` | T10, with its own logging factory (5.1) |
| `studio/test/users.test.tsx` | S1 to S7 (5.1) |
| `studio/e2e/users.spec.ts` | E1 (5.1) |
| `docs/changes/ADM-04/implementation.md` | The developer's record |

### Files to change

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Program.cs` | One line: `builder.Services.AddScoped<UserAccessStore>();` after line 76 |
| `studio/src/pages/UsersPage.tsx` | 3.2 |

**Not changed, on purpose:** `AdminStore.cs`, `AdminControllers.cs`, `ContentStore.cs`,
`PublishChecks.cs` and `ErrorPagesPage.tsx` (ADM-05's), every ADM-10 file,
`TokenService.cs` and `SessionCheck.cs`. No existing test file changes:
`CareersTests`, `AdminApiTests`, `SessionCheckTests`, `DuplicateFieldTests` and
`RedirectConcurrencyTests` must pass as they are.

### 4.1 Order of work against ADM-05

1. **No ADM-04 commit touches a file that ADM-05 or ADM-10 touches** (2.8). The
   "written only after ADM-05 has merged" rule therefore holds back no ADM-04 commit.
   If the developer finds that a commit needs one of those files after all, the
   developer stops, and the change comes back here.
2. **Before commit 1**, the developer merges `origin/rebuild/dotnet-platform`
   (`2bbd586`, with ADM-10) into `change/ADM-04`. It is a merge commit, never a
   rebase.
   - Only `docs/changes/ADM-04/` differs on the branch, so no conflict is expected.
   - The developer quotes `git log --oneline -3 origin/rebuild/dotnet-platform` and
     `git merge-base --is-ancestor 2bbd586 HEAD` (exit 0) in `implementation.md`.
3. **Before each source commit (3 and 4)**, the developer re-runs
   `git diff --name-only $(git merge-base <head> origin/rebuild/dotnet-platform) <head>`
   for every open `change/*` head, and compares the result with this change's files.
   The developer quotes the result. Any overlap: stop and report.
4. **If ADM-05 merges while ADM-04 is open**, the developer merges the new base in
   (merge, never rebase) and re-runs every suite in 5.3 before going on. ADM-05
   changes only error-page members in `AdminStore.cs` and `AdminControllers.cs`.
   `UserAccessStore` reads none of them.
5. The integrator merges ADM-05 and ADM-04 in whichever order they pass gate 2. They
   share no file.

### 4.2 ADM-04b: scheduled right after ADM-05 merges, inside G3-1 (F-3)

**When.** ADM-04b is planned as soon as ADM-05 has merged into
`origin/rebuild/dotnet-platform`. It is the next slot-2 change after ADM-04 and ADM-05,
and the coordinator puts it ahead of ADM-12 and ADM-01a. Its target is to merge by
16 November, the G3-1 date. Its branch is cut from, or merges, a base that contains
ADM-05, because it edits `AdminStore.cs` and `AdminControllers.cs`. It goes through
the full pipeline, red tests first.

**What:**

1. `DeactivateUserAsync` takes the `digitalhub:admins` lock and re-checks the actor
   (the 3.1 `EnsureActorAsync`) before its last-admin count. After that, a deactivate
   and a demotion, or two deactivates, cannot both pass. Its tests are a gated
   interleaving like T15, for both pairs.
2. `ResetPasswordAsync` takes the same lock and actor check, and its answer gets
   `Cache-Control: no-store`, as reactivate's does here.
3. `AdminStore` uses `TemporaryPassword` and one shared `IsDeactivated`. Its own copies
   and `UserAccessStore`'s private `IsDeactivated` are removed, and
   `RevokeRefreshTokensAsync` gives way to `TokenService.RevokeUserAsync`.
4. Optional, if the reviewer or owner wants it: create on a deactivated email answers
   409 `email_deactivated` with the user's id.
5. Optional: `UsersController`'s four actions move into `UserAccessController`.

**The exposure until ADM-04b merges.** A demotion racing a deactivate, or two
deactivates, can still leave no active admin. Recovery would then need database work
with the elevated account. The ADM-04 pull request body says so in a "Known exposure
until ADM-04b" line.

### Out of scope (left alone on purpose)

- **Delete.** The owner chose (a), no delete (O-ADM04-1). There is no code and no
  ADM-04c.
- **Per-account lockout and an admin unlock** (ADM-11, G3-2). Deactivation and a
  temporary lockout share the `LockoutEnd` column. This is handed to ADM-11 (Risks).
- **Showing emails instead of ids in the audit screen** (ADM-15).
- **`Cache-Control: no-store` on reset-password.** It is in `AdminControllers.cs`, so
  it goes to ADM-04b item 2, which has the slot in 4.2. The new reactivate route has it
  from the start (F-9).
- **The reviewers' test users in `DigitalHubContent_Studio`.** Deactivating them is a
  Studio action for the owner, not code.
- **`AdminStore.cs`, `AdminControllers.cs`:** ADM-04b.
- **No migration** (section 7).

## 5. Test plan

### 5.1 Failing tests, written first

**API, `api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs`**,
`[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`. Shared rules:

- HTTP only, so the file compiles against the base API with no reference to
  `UserAccessStore`.
- Users sign in through `AuthSession.LoginAsync`.
- Each test creates its own users with stamped emails
  (`"adm04-<name>-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test"`).
- **Clean-up (F-10).** Users cannot be deleted. In `finally`, every user a test made an
  admin, or reactivated, is deactivated again through `UserManager`
  (`LockoutEnabled = true`, `LockoutEnd = DateTimeOffset.MaxValue`, `UpdateAsync`), so
  no extra active admin is left behind.
- A test that changes another admin's lockout saves and restores it in `finally`, and
  ends by running the `EnsurePrimaryAdminActiveAsync` logic (copied as a private
  helper, `AdminApiTests.cs:598-`).
- Audit rows stay, because the app login cannot delete them (`ListPagingTests.cs:176`).
  A test finds its own row by entity id and a time after the test started.

| Id | Name | Asserts | Red at base because |
| --- | --- | --- | --- |
| T1 | `An_admin_changes_an_editors_role_and_it_is_audited` | Create editor E. `PUT /api/v1/users/{E}/role` `{ role: "admin" }`: 200, body `role` "admin", `active` true. `GET /api/v1/users`: E's row `role` "admin". One audit row with entity id E, `Action` "change_user_role", `EntityType` "user", `Detail` "editor -> admin", `UserId` the acting admin. `finally`: E deactivated (F-10) | 404: no route |
| T2 | `A_role_change_ends_the_users_sessions` | Editor E signs in (session S). Note E's `SecurityStamp`. Admin changes E to `hr`. S's access token: 401 on `GET /api/v1/auth/me` and on `GET /api/v1/pages`. S's refresh: 401. E's `SecurityStamp` has changed. A new sign-in: 200, and `GET /api/v1/auth/me` gives `role` "hr" | 404 at the change step |
| T3 | `The_last_active_admin_keeps_the_admin_role` | Create admins X and Y; Y signs in. Through `UserManager`, remove Y's admin role, so Y is an editor in the database while Y's token still says admin (2.5). Lock every other admin except X, saving each one's lockout first. Y sends `PUT /api/v1/users/{X}/role` `{ role: "editor" }`: 400 `last_admin`. X is still an admin. `finally`: restore every lockout, deactivate X and Y, restore the primary admin | 404: no route. It reaches the guard through HTTP, which the deactivate test could not (2.7, 3.1 step 6) |
| T4 | `Reactivation_brings_a_user_back_with_a_new_temporary_password` | Create HR user H with password P, then deactivate H. `POST /api/v1/users/{H}/reactivate`: 200, `active` true, `role` "hr", `mustChangePassword` true, `temporaryPassword` of length 16, header `Cache-Control` contains `no-store`. `GET /api/v1/users`: H is active. In the database, H has `LockoutEnabled` false, `LockoutEnd` null and `AccessFailedCount` 0. Sign-in with P: 401. Sign-in with the temporary password: 200, `mustChangePassword` true. One audit row `reactivate_user` for H, `Detail` "hr". `finally`: H deactivated | 404: no route |
| T5 | `Reactivation_does_not_revive_old_sessions` | Editor E signs in (session S), is deactivated, then reactivated. S's access token: 401. S's refresh: 401 | 404 at the reactivate step |
| T6 | `Reactivating_an_active_or_unknown_user_is_refused` | Active E: 400 `already_active`. A new guid: 404. A user with no Studio role (made through `UserManager`): 404. A deactivated user with a 5,000-byte body: 413, and the user is still deactivated. Nothing else changes | 404 where 400 or 413 is expected |
| T7 | `A_role_change_checks_its_input` | `{ role: "viewer" }`: 400 `validation_failed`, `errors.role`. Body `{"role":"editor","Role":"admin"}`: 400 `duplicate_field`, role unchanged. A body over 4 KB: 413. A new guid: 404. A deactivated user: 400 `user_deactivated`. E to its own role `editor`: 200, no new audit row, and E's existing session still answers 200 on `GET /api/v1/auth/me` | 404 where 400 or 413 is expected |
| T8 | `An_admin_cannot_change_their_own_role` | The primary admin `PUT`s its own id with `{ role: "editor" }`: 400 `cannot_change_own_role`. It is still an admin | 404 |
| T9 | `A_role_change_waits_for_the_users_lock_and_then_refuses_as_busy` | The test opens its own connection (`ApiFactory`'s test connection string), begins a transaction, and takes `sp_getapplock @Resource = N'digitalhub:admins', @LockMode = N'Exclusive', @LockOwner = N'Transaction'`. Admin changes editor E to `admin`: 503 `users_busy` after at least 4.5 s. E is still an editor. `finally`: roll back the test's transaction. The resource name and the 5 s timeout are constants in the test, with a comment tying them to `UserAccessStore` (as `RedirectConcurrencyTests.cs:25-35`) | 404, at once |
| T11 | `Editors_and_HR_cannot_change_roles_or_reactivate` | An editor and an HR user each get 403 on `PUT /api/v1/users/{id}/role` and on `POST /api/v1/users/{id}/reactivate`. The target is unchanged | 404 by routing (the reviewer agrees). It guards the policy |
| T12 | `Creating_a_deactivated_email_is_still_email_taken` | Create E, deactivate E, then `POST /api/v1/users` with E's email in upper case: 409 `email_taken`. Nothing is created | **Green at base.** It pins the API contract the screen relies on |
| T13 | `A_refresh_that_races_a_role_change_cannot_keep_the_old_role` (F-5) | Editor E signs in (session S). Read S's family id from the access token's `sid` claim (`JwtSecurityTokenHandler`, as `SessionCheckTests` does). Admin changes E to `hr`. Then, through `ContentDbContext`, add one live `RefreshToken` row in that family (`UserId` E, random `TokenHash` and `CsrfTokenHash`, `ExpiresAt` +1 day, `CreatedAt` and `SessionStartedAt` now). That row stands for the write of a refresh that read the user before the change and saved after it. S's access token, which carries the old stamp just as the racing refresh's new token would: 401 on `GET /api/v1/pages`. `finally`: the row is revoked | 404 at the change step. **It is also red after a fix that only revokes tokens**: the family is live again, so without the stamp rotation S answers 200 |
| T14 | `A_demoted_or_deactivated_admin_cannot_finish_a_users_change` (F-6) | Create admin Y, editor E and a deactivated editor D; Y signs in. Through `UserManager`, remove Y's admin role (Y's token still says admin). Other admins, including the primary admin, stay active. Y sends `PUT /api/v1/users/{E}/role` `{ role: "admin" }`: 403 `forbidden`, and E is still an editor. Y sends `POST /api/v1/users/{D}/reactivate`: 403 `forbidden`, and D is still deactivated. Repeat with Y deactivated in place of demoted: both 401 (`SessionCheck`). `finally`: Y deactivated | 404 |

**T10, `api/tests/DigitalHub.Api.Tests/ReactivationLogTests.cs`** (F-2),
`[Collection("SqlServer")]`, with its own `IClassFixture<LoggingFactory>`. The factory
derives from `ApiFactory` and follows `RateLimitLogTests.LoggingFactory`
(`RateLimitLogTests.cs:85-97`):

- `builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink))`,
  so the sink receives **the application's own events**, including the request log
  (`Program.cs:274`).
- `builder.UseSetting("Serilog:MinimumLevel:Default", "Verbose")`, plus `"Verbose"` for
  the overrides `Serilog:MinimumLevel:Override:Microsoft.AspNetCore` and
  `Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore`, so every level reaches
  the sink.
- The sink is a thread-safe list of `LogEvent`s.

| Id | Name | Asserts | Red at base because |
| --- | --- | --- | --- |
| T10 | `A_reactivation_password_appears_in_no_application_log_event_and_no_audit_row` | Create and deactivate editor E. Clear the sink. Reactivate E through HTTP: 200, and take `temporaryPassword`. Then, for every captured event: the rendered message, every property's `ToString()` and the exception's `ToString()` do not contain the password. The sink has at least one event from this request (the request log line for `POST /api/v1/users/{E}/reactivate`), so the test cannot pass on an empty sink. The audit row for E has a `Detail` that does not contain it either. `finally`: E deactivated | The reactivation returns 404, so the first assertion (200) fails. That is the status, not a missing sink: the request-log assertion would pass at base |

**T15, `api/tests/DigitalHub.Api.Tests/UserRoleConcurrencyTests.cs`** (F-1),
`[Collection("SqlServer")]`, with its own `IClassFixture<GatedUsersFactory>`. The
factory follows `RedirectConcurrencyTests.GatedApiFactory` (201-211). It adds a
`DbCommandInterceptor`, `UserReadGate`, modelled on `RedirectReadGate` (225-290):

- While armed with a set of user ids, it holds every reader command that has a
  parameter equal to one of them.
- It releases what it holds when two commands have arrived, or when the cap has
  passed, and then disarms, so nothing later is held. It counts `Matched`.
- The cap is 2 s. The users lock timeout is 5 s. Both are constants in the test with
  the coupling comment from `RedirectConcurrencyTests.cs:25-35`, and the test asserts
  `2 * cap <= lock timeout`.

| Id | Name | Asserts | Red at base because |
| --- | --- | --- | --- |
| T15 | `Two_admins_demoting_each_other_at_once_leave_one_admin` | Ensure the primary admin is active. Create admins A and B, and sign both in. Arm the gate with {A, B}. Send, at once, A's `PUT /api/v1/users/{B}/role` `{ role: "editor" }` and B's `PUT /api/v1/users/{A}/role` `{ role: "editor" }`. Then: exactly one answer is 200 and the other is 403 `forbidden`; exactly one of A and B is still an admin in the database; `Gate.Matched` is 1. `finally`: disarm, deactivate A and B | 404 for both, so "exactly one 200" fails |

Why T15 fails if any read moves before `sp_getapplock`:

- **At green:** the request that takes the lock first reads the target or the actor by
  id, and the gate holds that read. The other request waits in `sp_getapplock`, which
  is not a reader command and carries neither id. So only one command arrives, and
  the gate releases at the cap. The first request commits. The second then gets the
  lock, re-reads its actor, which has just lost the admin role, and answers 403.
  `Matched` is 1.
- **If the target or actor reads (or the admin count) ran before the lock:** both
  requests' first reads would reach the gate, so two commands match and both are
  released together. Both requests would see two active admins and a valid actor. Both
  would demote, leaving neither A nor B an admin, and `Matched` would be 2. The test
  fails on all three assertions.

T15 is what proves the coverage row "Concurrent role changes cannot both pass the
guard". T9 proves only the 503 path.

**Studio, `studio/test/users.test.tsx`** (vitest, jsdom). The harness:

- Copied from `studio/test/redirects.test.tsx`: the `matchMedia` and `ResizeObserver`
  stubs, the hoisted `api.handler` and `request` mock, and the `message` spies.
- Copied from `studio/test/listPaging.test.tsx:69-70`: `useAuth` mocked, here as
  `{ user: { id: "u-1", role: "admin", email: "me@x.test" }, ready: true }`.
- The file-level `afterEach` that asserts `document.body.innerHTML` is empty
  (ADM-06b-flake), **copied unchanged** (F-4).

The list is: `u-1` me@x.test (admin, active), `u-2` ed@x.test (editor, active), `u-3`
old@x.test (hr, inactive). Every path the handler does not expect throws.

| Id | Name | Asserts | Red because |
| --- | --- | --- | --- |
| S1 | `changes a user's role after confirming` | Choose "admin" in "Role for ed@x.test": the "Change role?" dialog shows. Click "Change role": one `PUT /api/v1/users/u-2/role` with body `{"role":"admin"}`, then a second `GET /api/v1/users`. The success spy gets "Role changed. ed@x.test must sign in again." | No select |
| S2 | `a cancelled role change sends nothing` | Choose "hr", then Cancel: no `PUT`, and the select still shows "editor" | No select |
| S3 | `your own row and inactive rows have no role select` | No combobox named "Role for me@x.test" or "Role for old@x.test"; both rows show the chip | **Green at base** (no selects at all). Guard |
| S4 | `shows why a role change was refused` | The `PUT` answers 400 `{ code: "last_admin", title: "The last active admin cannot lose the admin role." }`: that title shows, the list is not reloaded, and the select shows "editor" | No select |
| S5 | `reactivates an inactive user and shows the temporary password` | "Reactivate" on old@x.test, then confirm: one `POST /api/v1/users/u-3/reactivate`. The answer has `temporaryPassword: "Tmp-Pass-1234!ab"`, and the "Temporary password" dialog shows it. Then a second `GET` | No Reactivate button |
| S6 | `offers to reactivate when a new user's email is deactivated` | Create user with " OLD@x.test " answers 409 `{ code: "email_taken", title: "A user with that email already exists." }`. The modal shows "That email belongs to a deactivated user." and "Reactivate instead". Clicking it and confirming sends `POST /api/v1/users/u-3/reactivate` | No such text |
| S7 | `a taken active email shows the API's message` | Create with "ed@x.test" answers 409 `email_taken`: "A user with that email already exists." shows, and there is no "Reactivate instead" | **Green at base.** Guard for S6's condition |

Each S test closes its dialogs before it ends, so the empty-body guard holds with the
controlled `<Modal>`s, as it does for the create modal in other screens' tests.

**End-to-end, `studio/e2e/users.spec.ts`** (E1). ADM-04 is a Blocker, not a Major, but
the G3-1 gate asks that each blocker be "reproduced before its fix and passing after
it". The spec follows `redirects.spec.ts`: API set-up with `adminHeaders`, then a
`finally` clean-up. `workers: 1` (`playwright.config.ts:10`).

E1, `ADM-04 users: change a role, deactivate, reactivate`:

1. **Set-up through the API** as admin: create editor `e2e-adm04-<stamp>@digitalhub.test`
   with a known password, and sign it in through `POST /api/v1/auth/login`, keeping
   its access token. This is not the seeded editor, which other specs use.
2. `signIn(page, "admin")` and open "User Management". In that row, choose "admin" in
   "Role for <email>" and click "Change role". **At base it fails here**: there is no
   select. Afterwards the row's role shows "admin".
3. Through the API: the kept access token gets 401 on `GET /api/v1/auth/me`, and
   `GET /api/v1/users` shows the row as admin.
4. Click "Deactivate" on the row (an existing button). The status reads "Inactive".
5. "Create user" with the same email and any role and password. The modal shows "That
   email belongs to a deactivated user." Click "Reactivate instead" and confirm. The
   "Temporary password" dialog shows a value; read it.
6. Through the API: sign in with the temporary password: 200, `mustChangePassword`
   true. The original password: 401.
7. **`finally`:** deactivate the user through the API, so no extra active admin is left
   for later specs. The end-to-end database is dropped before every run
   (`start-api.ts`).

### 5.2 Commit order

CI job `studio` runs "Unit tests" (`ci.yml:237`) before "End-to-end suite"
(`ci.yml:271`). A red unit test in the same commit would hide E1's red, so:

0. **Merge** `origin/rebuild/dotnet-platform` (`2bbd586`) into `change/ADM-04` (4.1
   step 2). Not a rebase.
1. `ADM-04: Test role change and reactivation in the API and end-to-end`. T1 to T15 and
   E1, in test files only, touching no shared file.
2. `ADM-04: Test role change and reactivation on the users screen`. S1 to S7.
3. `ADM-04: Change roles and reactivate users in the API`. Adds
   `UserAccessController.cs`, `UserAccessStore.cs`, `TemporaryPassword.cs`, and
   `Program.cs`. Makes T1 to T11, T13, T14 and T15 green.
4. `ADM-04: Change roles and reactivate from the users screen`. Changes
   `UsersPage.tsx`. Makes S1, S2, S4 to S6 and E1 green.
5. `ADM-04: Implementation record`.

O-ADM04-2 is answered (a), so the tests are written for (a) only and nothing waits on
it. Each fix commit can be reverted on its own. Commit 3 before 4 is safe: the routes
exist with nothing calling them.

### 5.3 Local evidence

.NET in Release only. Never `DigitalHubContent`. Ports 42xx.

**After commit 1 (red):**

```bash
cd api && dotnet build DigitalHub.slnx -c Release
cd studio && npm ci && npx tsc -b
```

- Expected: 0 errors, since HTTP-only tests compile against the base. No more build
  warnings than the base's 13 (ADM-07 2.6).
- T1 to T15 and E1 need SQL Server. Without it they fail at the connection, which is
  not the red. Record them as NOT RUN locally, covered by CI jobs `api` and `studio`
  (5.4).

**After commit 2 (red):**

```bash
cd studio && npx vitest run test/users.test.tsx
```

Expected: S1, S2, S4, S5 and S6 fail at the assertions in 5.1, quoted as run. S3 and
S7 pass.

**After the fix commits (green), every suite:**

```bash
# API (job api; SQL Server, DigitalHubContent_Test only)
cd api && dotnet build DigitalHub.slnx -c Release
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~UserRoleAndReactivationTests|FullyQualifiedName~UserRoleConcurrencyTests|FullyQualifiedName~ReactivationLogTests|FullyQualifiedName~AdminApiTests|FullyQualifiedName~SessionCheckTests|FullyQualifiedName~SessionRevocationTests|FullyQualifiedName~SessionLimitTests|FullyQualifiedName~CareersTests|FullyQualifiedName~DuplicateFieldTests|FullyQualifiedName~RequestBodyLimitTests|FullyQualifiedName~PasswordChangeGateTests|FullyQualifiedName~CommonPasswordTests|FullyQualifiedName~RedirectConcurrencyTests|FullyQualifiedName~RateLimitLogTests"

# Studio (job studio)
cd studio && npm ci
cd studio && npx tsc -b
cd studio && npm test
cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build
cd studio && npx playwright test                                  # DigitalHubContent_E2e, reset by the harness; DH_E2E_API_PORT / DH_E2E_STUDIO_PORT in 42xx
cd studio && npx playwright test e2e/users.spec.ts e2e/studio.spec.ts e2e/verification.spec.ts e2e/appearance.spec.ts

# Website (job website): no file changes, run to show nothing moved
cd website && npm ci
cd website && npm run typecheck
cd website && npx vitest run
cd website && npm run design:check
cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build
```

- `CareersTests.Authorization_matches_for_every_endpoint` must pass unchanged, with the
  two new routes in it (2.7).
- `RedirectConcurrencyTests` and `RateLimitLogTests` are in the filter because T15 and
  T10 reuse their patterns, and both must stay green.
- T15 runs three times in a row (`--filter FullyQualifiedName~UserRoleConcurrencyTests`,
  three runs), each quoted, to show it is not flaky.
- Any test that passed at the base and fails now is a regression. It is reported before
  anything is fixed.

**Not runnable on this machine:** no `dotnet`, no SQL Server, no `node_modules`. The
developer quotes each command as run, with its exit code and output (P-8). Anything that
cannot run is NOT RUN, with the reason and the CI job that covers it.

### 5.4 CI evidence on the pull request

- **Red at commit 1** (O-ADM04-3 is "Yes, red tests first"):
  - Job `api`: T1 to T11 and T13 to T15 fail, each at its assertion, quoted. T12 and
    every existing test pass.
  - Job `studio`: unit tests pass (S1 to S7 are not in commit 1). In the end-to-end
    suite, E1 fails at step 2. Every other spec passes.
  - Job `website`: green (no change).
  - Wait until `api`, `website` and `studio` have finished before pushing again
    (`cancel-in-progress: true`, `ci.yml:25`).
- **Red at commit 2:** job `studio`, "Unit tests": S1, S2, S4, S5 and S6. The local red
  is enough.
- **Green on the final head, in every workflow:** the `ci.yml` jobs `api` (quote the
  TRX total), `website`, `studio` (unit and end-to-end), `section-compare`,
  `screenshot-parity` and `website-browser`, plus `security.yml`, `codeql.yml` and
  `workflow-lint.yml`.

### 5.5 Track checklist (G3, `docs/changes/README.md`)

| Rule | How this change meets it |
| --- | --- |
| "The finding, its evidence and its fix come from `docs/quality/admin-audit-2026-10-28.md`" | Section 1 quotes it. Change role with the guard: 3.1. Reactivate: 3.1. O-15: decided (a), no delete (section 9). The matching UI: 3.2 |
| "The regression test is committed and shown failing before the fix" | Commits 1 and 2 hold tests only. S1, S2, S4 to S6 are red locally. T1 to T11, T13 to T15 and E1 are red in CI at commit 1, pushed first under O-ADM04-3 "Yes, red tests first" |
| "The end-to-end suite gets a test for each Major" | ADM-04 is a Blocker. E1 is added anyway, for the G3-1 "reproduced before its fix" gate |
| "A Minor that is not fixed becomes a D-NNN entry" | Not a Minor. Nothing in the finding is left unfixed: delete is decided "no" by the owner |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | T1, T4 and E1 reproduce "cannot have their role changed, be reactivated". T12 with S6 and E1 step 5 reproduce the "deactivated email" part. All pass after the fix |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` with no patched content" | Not affected: this change touches no content or website code. A batch gate, not this change alone |

## 6. Security impact

- **Routes and policies.** There are two new routes, both under
  `[Authorize(Policy = "studio-admin")]` (admin only; `Program.cs:261`), like every
  other `/api/v1/users` route.
  - The fallback policy (`Program.cs:250-253`) and `PasswordChangeGate` apply as for
    any endpoint, so a must-change admin gets 403 `password_change_required`.
  - Proven by T11 and by `CareersTests.Authorization_matches_for_every_endpoint`,
    unchanged.
  - No route is removed or re-policied.
- **Privilege changes.** A role change is the strongest action in the Studio.
  - It is admin-only.
  - It refuses the actor's own id.
  - It refuses to leave no active admin (`last_admin`).
  - **Inside one exclusive lock, before anything is written**, it reads from the
    database: the target's state, the active-admin count and the actor's own right
    (active and still `admin`).
  - The actor's token only lets the request in; the database decides at the write.
  - So an admin who has been demoted or deactivated cannot finish a request that is
    already in flight (T14), and two admins demoting each other cannot both succeed
    (T15).
  - The guard is reachable through HTTP only with such a stale actor, which is what
    T3 builds (3.1 step 6, F-6).
- **Sessions and tokens:**
  - **A role change revokes the user's refresh tokens and rotates their security
    stamp.** Every access token they hold is refused on its next request (T2),
    including one a racing refresh issued with the old role (T13, F-5). They sign in
    again with the new role. Without this, a demoted admin would keep admin rights
    for up to 10 minutes (2.5).
  - A reactivated user's old sessions stay dead (T5). Their password is new, and must
    be changed at sign-in, so a password known before they left does not work again
    (T4).
  - A deactivated user still cannot use any route (unchanged; `SessionCheckTests`).
- **Audit:**
  - `change_user_role` (with `old -> new`) and `reactivate_user` (with the role),
    each with the acting admin's id.
  - A refused attempt is not audited, as for a refused deactivate today. A no-op role
    change is not audited.
  - The temporary password is in no application log event at any level, and in no
    audit row (T10, against the application's own sink).
- **Input (F-7).** Both routes cap the body at 4 KB (T6, T7). Reactivate reads no body;
  the cap stops a large body being buffered for nothing. The role body refuses
  duplicate keys (T7), and the role must be one of three fixed strings.
- **Data:**
  - It writes only `AspNetUserRoles`, `AspNetUsers`, `RefreshTokens` and `audit_log`.
    The `AspNetUsers` columns are the lockout fields, the password hash, the security
    stamp, `MustChangePassword` and `AccessFailedCount`.
  - The app login has these through `db_datawriter`. `sp_getapplock` needs only
    `public` (ADM-07, `AdminStore.cs:197-200`). No grant changes.
  - A failed step rolls the whole transaction back (3.1, F-7).
- **Temporary password.** It is generated with `RandomNumberGenerator`, by the same
  algorithm as reset. It is returned once, in an answer with `Cache-Control: no-store`
  (T4, F-9). Reset's own answer gets `no-store` in ADM-04b (4.2).
- **Logins, secrets, dependencies, configuration, rate limits:** none. No package is
  added, and no lockfile changes.

## 7. Migrations

None. `AspNetUserRoles`, the `AspNetUsers` columns (`LockoutEnabled`, `LockoutEnd`,
`AccessFailedCount`, `SecurityStamp`, `MustChangePassword`) and
`RefreshTokens.RevokedAt` already exist. Create, deactivate, reset and password changes
already write them today.

## 8. Rollback

Revert the pull request. No schema change.

Data written while the change was live stays valid under the old code:

- A changed role is an ordinary `AspNetUserRoles` row, which the old code reads.
- A reactivated user is an ordinary active user: `LockoutEnabled` false, `LockoutEnd`
  null, `MustChangePassword` true. The old code already handles that state, because
  reset sets it.
- A rotated security stamp is ordinary Identity data.
- After a revert, roles can no longer be changed and users can no longer be reactivated
  from the Studio. Nothing needs clearing.

## 9. Owner decisions

All three were answered by the owner on cards, 12 November 2026, 12:09 UTC, as relayed
by the coordinator. I have not seen the cards myself; the words and their source come
from the coordinator's message. Each answer is read narrowly: it covers ADM-04 only.

- **O-ADM04-1 (this is O-15). Status: ANSWERED, (a).**
  - **Asked:** "Should Studio users ever be deleted? (a) No: deactivation is the end
    state, and an email can be brought back with Reactivate. (b) Yes, but only a user
    who never signed in and has done nothing. (c) No true delete, but an admin can
    anonymise a deactivated user."
  - **The owner's answer:** "No, deactivate is enough" (Mohamed Elbadry, 12 November
    2026, 12:09 UTC, card tap, relayed by the coordinator).
  - **Effect:** no delete code and no ADM-04c. The finding's "Decision O-15 on delete"
    row is closed by the decision. FR-S-02 can move to "Works" when this change is
    delivered. The refinement plan's open-decision count (line 268) loses O-15.
- **O-ADM04-2. Status: ANSWERED, (a).**
  - **Asked:** "When an admin reactivates a user, should (a) the user get a new
    temporary password that they must change at sign-in, shown once to the admin as
    after a reset, (b) the old password work again, or (c) the user have no password
    until the admin presses Reset password?"
  - **The owner's answer:** "New temporary password" (Mohamed Elbadry, 12 November
    2026, 12:09 UTC, card tap, relayed by the coordinator).
  - **Effect:** 3.1 Reactivate step 5. `TemporaryPassword.cs` is created. T4, T10, S5
    and E1 steps 5 and 6 are written for (a) only.
- **O-ADM04-3. Status: ANSWERED, Yes.**
  - **Asked:** "For ADM-04, may the developer push the test-only commit first, so CI
    shows the database and end-to-end tests failing before the fix, as with ADM-02,
    ADM-07, ADM-10 and ADM-05?"
  - **The owner's answer:** "Yes, red tests first" (Mohamed Elbadry, 12 November 2026,
    12:09 UTC, card tap, relayed by the coordinator).
  - **What it allows:** the developer pushes commit 1 (tests only) to `change/ADM-04`
    and opens the pull request before the fix commits, so CI's `api`, `website` and
    `studio` jobs show the red (5.4). Commit 2 is pushed only after commit 1's run has
    finished those jobs.

**Behaviour changes, for the owner to see.** They go in the pull request body. They
are the audit's fix, so they are not asked as separate decisions. Say so before gate 1
if any is not wanted.

- **B1:** An admin can change any other active user's role between admin, editor and
  HR, from User Management, after a confirmation.
- **B2:** A role change signs the user out everywhere. They sign in again with the new
  role.
- **B3:** An admin cannot change their own role (another admin does it), just as they
  cannot deactivate themselves today.
- **B4:** A deactivated user's role cannot be changed until they are reactivated.
- **B5:** The last active admin cannot be made editor or HR (`last_admin`).
- **B6:** A deactivated user can be reactivated. They keep their role, get a new
  temporary password shown once to the admin, and must change it at sign-in.
- **B7:** Creating a user with a deactivated user's email still fails. The screen now
  offers "Reactivate instead".
- **B8:** Two new audit actions: `change_user_role` and `reactivate_user`.
- **B9:** A role change or reactivation can answer "Another change to the users is in
  progress. Try again." (503, after 5 s at most) if another admin's change holds the
  lock.
- **B10:** A request from an admin who was demoted or deactivated while it was in
  flight is refused (403), even though it started with a valid token.
- **Known exposure until ADM-04b:** a demotion racing a deactivate, or two
  deactivates, can still leave no active admin (4.2).

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The role change does not end the user's sessions | A demoted admin keeps admin rights for up to 10 minutes | T2 (old access token 401 on two routes, refresh 401, stamp changed), E1 step 3 |
| A refresh racing the role change re-opens the family with the old role | A demoted admin gets a fresh 10-minute admin token | T13: red without the stamp rotation, green with it (F-5). That racing refresh also leaves a live refresh token in the family. Its next refresh issues a token with the new stamp and the **new** role, so the user keeps a session at the right role. Accepted: the role is correct |
| A read (target, actor or admin count) runs before `sp_getapplock` | Two demotions both pass; no active admin is left | T15 (one 200 and one 403, one admin left, `Matched` 1), run three times (F-1) |
| The actor is not re-checked inside the lock | A demoted admin's in-flight request promotes someone | T14 and T15 (F-6) |
| The guard counts from the token, not the database, or counts the target | The last admin is demoted, or a valid demotion is refused | T3 (token says admin, database says editor), T1 (two active admins: allowed) |
| A deactivate racing a demotion (deactivate takes no lock until ADM-04b) | No active admin; recovery needs database work | Not caught here. It is the same exposure two deactivates already have today. ADM-04b is scheduled right after ADM-05, inside G3-1 (4.2), and the PR body lists it (F-3) |
| T9's or T15's constants drift from the store's | A test passes against a lock nobody takes, or turns flaky | Constants with coupling comments, as `RedirectConcurrencyTests.cs:25-35`. T9 asserts the wait is at least 4.5 s; T15 asserts `2 * cap <= timeout` |
| Reactivation revives a session from before deactivation | A device used before the person left gets back in | T5 |
| The temporary password leaks into logs or audit | A secret in the log store | T10, against the application's own sink at Verbose, with a non-empty-sink assertion (F-2) |
| A reactivation fails half way | A user active with no password, or with the old one | One transaction, rolled back on any failed `IdentityResult` (3.1 step 6, F-7). T6 shows refused paths leave the user deactivated |
| The temporary password is cached by a proxy or browser | A credential stored on disk | `Cache-Control: no-store` on reactivate (T4, F-9). Reset is still without it until ADM-04b |
| T3, T14 or T15 leave admins locked or extra admins active | Later tests fail on sign-in, or must lock leftovers | `finally` restores every lockout changed, deactivates every admin made, and restores the primary admin. Collection `SqlServer` is serial (F-10) |
| The new controller collides with `UsersController`'s routes | Ambiguous-route 500s | The templates differ. `CareersTests.Authorization_matches_for_every_endpoint` calls every route as admin |
| The duplicate-key guard or the 4 KB cap is left off | A body with two `role` keys applies the last one, or a large body is buffered | T7, T6 |
| A must-change admin can change roles | The gate is bypassed | `CareersTests` "must-change" expects 403 `password_change_required` on every route not marked allowed. The new actions carry no `AllowedBeforePasswordChange` |
| Another branch starts touching `Program.cs` or `UsersPage.tsx` | Breaks "Parallel work must change different files" | 4.1 step 3: the check before each source commit, quoted |
| ADM-11 makes temporary lockouts use `LockoutEnd` | A temporarily locked user shows as "Inactive", and "Reactivate" clears a lockout | Out of scope. Handed to ADM-11: it must tell a deactivation from a lockout (for example, `LockoutEnd == DateTimeOffset.MaxValue`) in `IsDeactivated`, `ListUsersAsync` and `UserAccessStore`. Reactivate already follows `AllowedForNewUsers` (3.1) |
| Copies of `IsDeactivated` and the password generator until ADM-04b | A later fix lands in one copy only | ADM-04b removes them (4.2). The revoke helper is not copied (F-8). `implementation.md` lists each copy with its source lines |

### What I could not verify

- **Nothing was run.** There is no `dotnet`, SQL Server or `node_modules` here. These
  are read from the code only:
  - the 10-minute window after a demotion and the racing-refresh window (2.5);
  - the deactivate race (2.4);
  - T15's claim that `sp_getapplock` is not seen as a reader command by the
    interceptor (as in ADM-07's gate, where it held).
- **Identity details, read from memory of ASP.NET Core Identity, not run:**
  - that `RemoveFromRolesAsync`, `AddToRoleAsync` and `UpdateSecurityStampAsync` save
    through `UpdateAsync` inside the open transaction (as `CreateUserAsync` relies
    on);
  - that a stale `ConcurrencyStamp` gives an `IdentityResult` with code
    `ConcurrencyFailure`.

  The developer confirms both at commit 3. T2's stamp assertion and T13 would fail if
  the stamp step did not commit.
- **The owner's answers** are as relayed by the coordinator. I have not seen the cards.
- **`DigitalHubContent_Studio`:** not read.
- **Missing files:** `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` are
  missing. Any stricter rule they hold was not applied.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| An admin can change another user's role (API) | ADM-04 Fix 1; FR-S-02 "assign roles"; `phase-b-studio.md` line 43 | Planned | |
| The last-admin guard holds for role changes, from the database | ADM-04 Fix 1 "keeping the last-admin guard"; `phase-b-studio.md` 8.4, 10.11 | Planned (T3) | |
| Concurrent role changes cannot both pass the guard | Found here (2.4); review F-1 | Planned (T15) | |
| A demoted or deactivated actor cannot finish an in-flight change | Review F-6 | Planned (T14, T15) | |
| A role change ends the user's sessions, including one re-opened by a racing refresh | Found here (2.5); review F-5; brief: "sessions and tokens of a ... demoted user" | Planned (T2, T13) | |
| An admin cannot change their own role | Found here; mirrors `cannot_deactivate_self` (B3) | Planned (T8) | |
| A deactivated user can be reactivated with a new temporary password (API) | ADM-04 Fix 2; O-ADM04-2 (a) | Planned (T4) | |
| Reactivation restores the new-user lockout state and fails cleanly | Review F-7 | Planned (T4, T6) | |
| Reactivation does not revive old sessions | Brief: "sessions and tokens of a deactivated ... user" | Planned (T5) | |
| A deactivated email can be used again, by reactivation | ADM-04 title and bullet 2 | Planned (T12, S6, E1) | |
| Role changes and reactivations are audited; the temporary password is in no application log or audit row | Brief: "audit entries"; FR-S-15; review F-2 | Planned (T1, T4, T10) | |
| The reactivation answer is not cached | Review F-9 | Planned (T4) | |
| Editors, HR, deactivated and must-change users cannot reach the new routes | Brief: "admin-only"; `phase-b-studio.md` 10.2 | Planned (T11, `CareersTests`) | |
| User Management: role change with confirmation | ADM-04 Fix 4 | Planned (S1, S2, S4) | |
| User Management: Reactivate on inactive rows | ADM-04 Fix 4 | Planned (S5) | |
| User Management: a deactivated email offers Reactivate | ADM-04 Fix 4; bullet 2 | Planned (S6, S7) | |
| Decision O-15 on delete | ADM-04 Fix 3 | Decided: O-ADM04-1 (a), "No, deactivate is enough", no code | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan line 221; O-ADM04-3 "Yes, red tests first" | Planned | |
| An end-to-end test of role change, deactivate and reactivate | G3-1 exit gate, "reproduced before its fix and passing after it" | Planned (E1) | |
| FR-S-02 moves from "Partly" to "Works" | Audit requirement table, line 29 | Planned | |
| No ADM-04 commit touches a file ADM-05 or ADM-10 touches; the base is merged, never rebased | `AGENTS.md` "Parallel work must change different files"; ADM-05 `plan.md` 4.1 step 6 | Planned | |
| Deactivate and reset take the same lock and actor check; reset answers `no-store`; duplicated helpers removed | Found here; review F-3, F-9 | Moved: ADM-04b, right after ADM-05 merges, inside G3-1 (4.2) | |

## 12. Revision log

- **Round 1** (12 November 2026, `4ad921b`): first version.
- **Round 2** (12 November 2026): answers `plan-review.md` Round 1 (`81a105c`, CHANGES
  NEEDED, two Majors and nine Minors), point by point. It also records the owner's
  answers and the coordinator's directions.
  1. **F-1, Major (no test proves the count is read inside the lock).** Agreed.
     - The new T15 (`UserRoleConcurrencyTests.cs`) interleaves A demoting B with B
       demoting A, using a `UserReadGate` modelled on ADM-07's `RedirectReadGate`.
     - It asserts one 200, one 403, one admin left, and `Gate.Matched` 1.
     - 5.1 explains why it fails if any read moves before `sp_getapplock`.
     - The lock is now stated as the first statement in the transaction (3.1). The
       risk row and the coverage row now name T15, and T9 is described as covering
       the 503 path only.
     - The second request's expected answer is 403, not 400 `last_admin`, because of
       the F-6 choice below. The reviewer allowed T3's expectation to change with that
       choice, and the test still fails if the reads move out of the lock.
  2. **F-2, Major (T10 does not see the application's logs).** Agreed.
     - T10 moves to its own `ReactivationLogTests.cs` with a `LoggingFactory` that
       registers an `ILogEventSink` in the test host (`RateLimitLogTests.cs:85-97`), at
       Verbose for every source.
     - It runs a real reactivation and checks every event's rendered text, its
       properties and its exception, plus the audit `Detail`.
     - It asserts the sink caught this request's request-log event, so it cannot pass
       on an empty sink.
     - It is red at base on the reactivation's status.
     - 2.7 now says what the old `AdminApiTests` harness does and does not see.
  3. **F-3, Minor (ADM-04b has no date).** As the coordinator directed, ADM-04b is
     scheduled as the first change after ADM-05 merges, inside G3-1, ahead of ADM-12
     and ADM-01a, with a target merge by 16 November (4.2).
     - Its scope now includes the lock and actor check on deactivate and reset, and a
       gated test for each pair.
     - The pull request body carries a "Known exposure until ADM-04b" line (section 9,
       risk row).
  4. **F-4, Minor (`Modal.confirm`).** Replaced by one more controlled `<Modal>`, the
     pattern the screen already uses (3.2). 5.1 states that the empty-body `afterEach`
     is copied unchanged.
  5. **F-5, Minor (a racing refresh keeps the old role).** The code supports rotating
     the stamp, so the role change rotates it **in addition to** revoking:
     - `UpdateSecurityStampAsync`, in the same transaction (3.1 step 9), as the
       coordinator preferred.
     - 2.5 explains the window. The new T13 rebuilds the racing refresh's write and is
       red against a revoke-only fix.
     - Reactivate also rotates the stamp explicitly.
     - 3.4 no longer rejects the stamp. It says both are used.
     - The remaining effect is that the racing refresh leaves a session at the *new*
       role. It is recorded and accepted in Risks.
  6. **F-6, Minor (the actor is not re-checked).** I took the first option. Both writes
     re-load the actor inside the lock, and refuse with 403 if it is gone, deactivated
     or no longer admin (3.1 `EnsureActorAsync`).
     - The guard runs before the actor check, so it stays reachable through HTTP with
       a stale actor, and T3 is unchanged.
     - The new T14 covers the stale actor with other admins present (403 on both
       routes).
     - Section 6 now says exactly what is read from the database, and that the guard
       is reachable only with a stale actor.
     - B10 is added.
  7. **F-7, Minor (reactivate failure paths and lockout state).**
     - Every failed `IdentityResult` rolls back, with 409 `concurrency_conflict` or
       400, as for the role change (3.1 Reactivate step 6).
     - `LockoutEnabled` is set to `users.Options.Lockout.AllowedForNewUsers` (`false`
       today, the state of a new user), and `AccessFailedCount` to 0. T4 asserts both.
     - The route is capped at 4 KB, and T6 asserts 413.
     - Section 6 "Input" says so.
  8. **F-8, Minor (copied revoke helper).** `UserAccessStore` now injects `TokenService`
     and calls `RevokeUserAsync(id, null, ct)`. No copy. ADM-04b's list shrinks to
     match.
  9. **F-9, Minor (`no-store` only noted).** Fixed for the new route in this change:
     the controller sets `Cache-Control: no-store` on reactivate's 200, and T4 asserts
     it. Reset's answer is in `AdminControllers.cs`, so it is tracked as ADM-04b
     item 2, with ADM-04b's slot (4.2). No D-NNN is needed: nothing is left untracked.
  10. **F-10, Minor (tests leave active admins).** Every test that makes or reactivates
      a user deactivates it in `finally`. T1, T3, T4, T10, T14 and T15 say so (5.1).
  11. **F-11, Minor (stale facts).**
      - `RoleClaimType` is at `Program.cs:228`, and the fallback policy at 250-253.
      - `change/ADM-05` is now given as `294fb4d`. The coordinator gave `e04e57a`, and
        the remote has since moved one commit on, adding a test report and no source
        file. 2.8 quotes ADM-05's file list from the new head: still no overlap.
      - The base is `2bbd586`.
  - **Owner answers** (section 9), as relayed by the coordinator: O-ADM04-1 (O-15)
    "No, deactivate is enough", which is (a), so there is no ADM-04c; O-ADM04-2 "New
    temporary password", which is (a); O-ADM04-3 "Yes, red tests first". The (b) and
    (c) branches are removed from 3.1, 5.1 and 5.2. `TemporaryPassword.cs` is now
    always created. The delete coverage row is "Decided". FR-S-02 "Works" no longer
    waits on an answer.

Plan state: round 2, ready for plan review. All three owner questions are answered. No
commit waits on ADM-05, because this change touches none of its files. ADM-04b is
scheduled as the first change after ADM-05 merges, inside G3-1.
