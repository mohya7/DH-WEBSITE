# ADM-04: plan

Change id: `ADM-04`. Branch: `change/ADM-04`, worktree `/home/user/dh-change-adm04`,
cut from `origin/rebuild/dotnet-platform` at `32f0414` (ADM-07 merged as #55).
Architect, round 1, 12 November 2026. Every line number below is at `32f0414`
unless it says otherwise.

**One change: an admin can change a Studio user's role and reactivate a deactivated
user, from the API and from User Management, with the last-admin guard kept and the
user's sessions ended on a role change.** It closes ADM-04 apart from delete, which
waits on the owner (O-15, asked here as O-ADM04-1). If the owner wants delete, it is
its own change, ADM-04c (section 4, "Split").

**Shared files.** This change is placed so that it edits **no file that ADM-05 or
ADM-10 edits**. It does not touch `AdminStore.cs` or `AdminControllers.cs`. The new
routes live in a new controller and a new store (3.1). The two small follow-ups that
would need `AdminStore.cs` are split out as ADM-04b, written only after ADM-05 has
merged (4.2).

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
  password, assign role"; 8.4 (line 254): "An admin cannot deactivate themselves or
  remove the last active admin."; 10.11 (line 309): "Deactivating a user revokes
  their session immediately; the last admin cannot be removed".
- **Track:** G3, batch G3-1 (Blockers), slot 2, 3 to 16 November. The refinement plan's
  G3 table (`refinement-plan-2026-10-28.md` line 225) lists "ADM-04 role change and
  reactivation". The batch order (line 26) is "ADM-06, 03, 02, 07, 10, 05, 04, 12,
  01a". ADM-06, 03, 02, 07 and 10 have merged (2.8). ADM-05 has not.
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
| `ENGINEERING_STANDARDS.md` | **Missing** in the worktree (`ls`: "No such file or directory") and not in `/mnt/attach/project-files`. Not guessed. Rule ids (P-6, P-7, P-8, B-8) are used only as `docs/changes/README.md` and the ADM-05, ADM-07 and ADM-10 records use them |
| `docs/PROJECT_PROFILE.md` | **Missing.** Not guessed |
| `docs/quality/refinement-plan-2026-10-28.md`, `docs/quality/admin-audit-2026-10-28.md` | Not in the worktree (`docs/quality` does not exist). Read from `/mnt/attach/project-files/docs/quality/` |
| `docs/adr/0001-split-public-forms-api.md` | Not needed (G3). `docs/adr/` is not in the worktree |
| `docs/deferred-items.md` | Not in the worktree. Not needed: nothing here becomes a D-NNN entry |
| ADM-05 `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md` (`/home/user/dh-change-adm05/docs/changes/ADM-05/`) | Read for format, for its file list and for its 4.1 step 6 hold on ADM-04 |
| ADM-07 `plan.md`, ADM-10 `delivery-approval.md` (from `origin/rebuild/dotnet-platform`) | Read for the red-first answers and the lock pattern |
| `docs/phase-b-studio.md`, `docs/business-analysis.md` | Read for the rules quoted above |
| `/mnt/attach/project-files/uploads/hearth/179f322b-...` (chat export, 1 November) | Searched for O-15 (section 9) |

There is no `plan-review.md`, `plan-approval.md` or `implementation.md` in
`docs/changes/ADM-04/`: this is round 1.

## 2. Current state

### 2.1 The base, and what has merged since the cut

```
$ git status -sb
## change/ADM-04...origin/rebuild/dotnet-platform [behind 1]
$ git rev-parse HEAD origin/rebuild/dotnet-platform
32f0414ef3bf1139bc5022d88e33e27075f125b4
2bbd586267e94e7c713ae5b905d8f4df66d75230
$ git ls-remote origin refs/heads/rebuild/dotnet-platform refs/heads/change/ADM-05 refs/heads/change/ADM-10
d35fdd8ba05f84ee1583fe3f0527d94d93ac569c	refs/heads/change/ADM-05
04d0e808141d9fb8fc9e98f4c3940dfbabd07323	refs/heads/change/ADM-10
2bbd586267e94e7c713ae5b905d8f4df66d75230	refs/heads/rebuild/dotnet-platform
$ gh api "repos/<owner>/<repo>/pulls/56" --jq '{state,merged,merged_at,title}'
{"merged":true,"merged_at":"2026-11-12T11:58:12Z","state":"closed","title":"ADM-10: Keep the default share image when Settings is saved"}
$ gh api "repos/<owner>/<repo>/pulls?state=open" --jq '.[] | {number,title,head: .head.ref}'
{"head":"change/ADM-05-red","number":57,"title":"ADM-05 red evidence: tests-only commit 1 (do not merge)"}
{"head":"change/GAP-07","number":44,"title":"GAP-07: Audit the full dependency tree and expire allow-list entries"}
```

**ADM-10 has merged** (#56, `2bbd586`, 11:58 UTC today). The brief I was given says it
has not; the remote says it has. I plan on the remote's state and flag the
difference (section 10, "What I could not verify"). ADM-05 has **not** merged. Its
local branch has merged the base with ADM-10 (`0b3ef34 ADM-05: Merge
rebuild/dotnet-platform with ADM-10`, not yet pushed: the remote head is `d35fdd8`).

### 2.2 The API has list, create, deactivate and reset only

`UsersController` (`AdminControllers.cs:73-101`, `[Authorize(Policy =
"studio-admin")]`, `[Route("api/v1/users")]`):

- `GET` → `AdminStore.ListUsersAsync` (313-334).
- `POST` → `CreateUserAsync` (336-381), with `[RequestBodyLimit(AuthController.AuthBodyLimit)]`
  (4 KB) and `[RejectDuplicateJsonFields]`.
- `POST {id}/deactivate` → `DeactivateUserAsync` (383-414).
- `POST {id}/reset-password` → `ResetPasswordAsync` (416-440).

There is no route that changes a role or reactivates a user. A role is set only at
create (`users.AddToRoleAsync(user, request.Role)`, 366).

### 2.3 A deactivated email can never be used again

`CreateUserAsync`, 348-350:

```csharp
var email = request.Email.Trim();
if (await users.FindByEmailAsync(email) is not null)
    return ContentOutcome.Fail(StatusCodes.Status409Conflict, "email_taken", "A user with that email already exists.");
```

`FindByEmailAsync` finds deactivated users too, and `Program.cs:63` sets
`options.User.RequireUniqueEmail = true`. Deactivation (below) never frees the email,
and nothing clears a deactivation. So the email is lost for good.

### 2.4 What deactivation is

`DeactivateUserAsync` (383-414):

- Refuses the caller's own id: 400 `cannot_deactivate_self` (385-386).
- 404 "That user does not exist." for an unknown or already deactivated user (388-390).
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
  The count and the write are not serialised: two admins deactivating each other at
  the same moment can both pass it (read from the code, not run).
- Sets `LockoutEnabled = true`, `LockoutEnd = DateTimeOffset.MaxValue` (402-403),
  revokes every live refresh token (`RevokeRefreshTokensAsync`, 460-468), audits
  `deactivate_user` (410).
- `IsDeactivated` (850-851) is `LockoutEnabled && LockoutEnd > now`. The same test is
  written out again in `SessionCheck.cs:44-46`, `TokenService.cs` (`RefreshAsync`) and
  `AuthController.cs:52` (login).

### 2.5 Roles ride in the access token; sessions are checked on every request

- `TokenService.CreateAccessToken` (217-227) puts one `role` claim per role into the
  JWT. `Program.cs:226` maps `RoleClaimType = "role"`. The policies `studio` and
  `studio-admin` (`Program.cs:260-261`) and `StudioAccess` read those claims.
- The access token lives `Auth:AccessTokenMinutes` = 10 minutes (`appsettings.json`).
- `SessionCheck.ValidateAsync` (`SessionCheck.cs:26-70`) runs on every request. It
  checks that the user exists and is not locked out, that the security stamp matches,
  and that the token's refresh-token family is still live. **It does not re-read
  roles.**
- `RefreshAsync` reads roles from the database (`TokenService.cs`, `roleNames` from
  `db.UserRoles`) and `GET /api/v1/auth/me` reads them too (`AuthController.cs:259-266`).

**So a role change that only edits `AspNetUserRoles` would leave a demoted admin with
admin rights for up to 10 minutes**, until the access token expires (read from the
code, not run). Revoking the user's refresh tokens closes that: the next request fails
`SessionCheck`'s live-family check, as deactivation and reset already rely on
(`AdminStore.cs:408`, 434; `SessionCheckTests.cs:34-48`).

### 2.6 The Studio screen

`studio/src/pages/UsersPage.tsx` (132 lines):

- Columns (87-106): Email, Role (a `StatusChip`), Status ("Active", "Must change
  password", "Inactive"), and for active rows only, "Reset password" and "Deactivate"
  (98-104). **An inactive row has no action at all.** The role cannot be changed.
- `create()` (44-55) shows `result.problem?.title` on failure, so a deactivated email
  shows "A user with that email already exists." and nothing more.
- The temporary-password modal (119-129) is shown once, after a reset.
- `useAuth().user` is a `StudioUser` with `id`, `email`, `role` (`studio/src/auth/session.ts:3-8`),
  so the screen can tell the signed-in admin's own row.

### 2.7 Tests that cover users today

- `AdminApiTests.Users_enforce_roles_password_length_self_and_last_admin_and_revoke_sessions`
  (`AdminApiTests.cs:288-379`): bad role, short password, self-deactivate, refresh
  after deactivate is 401, and the last-admin guard **at store level**, because
  through the API "the last active admin can only be asked to deactivate themselves"
  (comment at 364-366). It locks every other admin and restores the primary admin with
  `EnsurePrimaryAdminActiveAsync` (598).
- `AdminApiTests.Temporary_password_does_not_appear_in_application_logs` (381-): a
  Serilog `CollectingSink` (799).
- `SessionCheckTests` (`SessionCheckTests.cs:34-75`): a deactivated or locked-out user's
  access token is refused on the next request.
- `DuplicateFieldTests` (`DuplicateFieldTests.cs:21-60`): two `email` keys, a body over
  4 KB.
- `CareersTests.Authorization_matches_for_every_endpoint` (`CareersTests.cs:438-480`)
  walks **every** `api/v1` endpoint as admin, editor, HR, no role, deactivated and
  must-change. `EditorBlocked` (528-533) expects 403 for editors on anything under
  `/api/v1/users`; HR and no-role get 403; deactivated 401; must-change 403
  `password_change_required`. New routes under `/api/v1/users` are picked up by this
  test with no edit.
- `studio/e2e/studio.spec.ts` 10.17 (110-130): an editor gets 403 from
  `GET /api/v1/users` and has no User Management link. No unit test or end-to-end spec
  covers role change or reactivation, because neither exists.
- There is no Studio unit test for `UsersPage`.

### 2.8 Other branches and the files they touch

`AGENTS.md`: "Parallel work must change different files." ADM-05's plan, 4.1 step 6:
"ADM-04 does not start work on `AdminStore.cs` or `AdminControllers.cs` until ADM-05
has merged." Its approval makes that a condition for the coordinator
(`plan-approval.md` line 147).

For each remote `change/*` head I ran `git diff --name-only $(git merge-base <head>
origin/rebuild/dotnet-platform) <head>`, ignoring `docs/`:

- `change/ADM-05` (remote `d35fdd8`): `ErrorPagePublishTests.cs`,
  `studio/e2e/error-pages.spec.ts`, `studio/test/errorPages.test.tsx`. Its plan adds
  `ContentStore.cs`, `AdminControllers.cs`, `AdminStore.cs`, `PublishChecks.cs` and
  `ErrorPagesPage.tsx` (ADM-05 `plan.md` section 4).
- `change/ADM-10`: merged as #56. Its files were `AdminStore.cs`,
  `SettingsShareImageTests.cs`, `settings.spec.ts`, `SettingsPage.tsx`,
  `settingsShareImage.test.tsx`, `website/src/seo/head.ts`, `website/test/seo.test.tsx`.
- `change/GAP-07` (open, #44): `.github/security/*` and `.github/workflows/security.yml`
  only.
- Every other head is merged into the base (`git log --oneline origin/rebuild/dotnet-platform`
  shows #38 to #56).

**None of those files is in this change's scope (section 4).** `Program.cs` is touched
by no open branch (`change/GAP-12` merged as #40, `a866cf6`). `UsersPage.tsx` was last
changed by `6470fac` (#33).

### 2.9 Delete, and what refers to a user

- `AuditLogEntry.UserId` (`ContentEntities.cs:503`) has no foreign key. The audit
  screen shows the raw id (`AuditPage.tsx:112`). The app login cannot update or delete
  audit rows (`DENY UPDATE, DELETE ON dbo.audit_log`, `ci.yml:112`,
  `docs/security-deployment.md:18`).
- `ContactRequest.HandledById` has a foreign key to `AspNetUsers` with `NoAction`
  (`ContentModelBuilder.cs:186-189`): deleting a user who handled an enquiry would fail
  at the database.
- `CreatedById` and `PublishedById` (`ContentEntities.cs:307`, 495) hold user ids with
  no foreign key.
- The chat export (line 2111) notes the reviewers' test users are still in
  `DigitalHubContent_Studio` "because the Studio has no way to delete users".

### 2.10 What I could run here

- `git status`, `git log`, `git show`, `git diff`, `git ls-remote`, `gh api` (REST),
  `ls`, `grep`: as quoted.
- **Not runnable:** no `dotnet` on `PATH`, no SQL Server, no `sqlcmd`, no
  `node_modules` in `studio/` (`ls`: "No such file or directory"). I ran no suite, no
  build and no audit, and read no database. Claims marked "read from the code, not
  run" are exactly that.

## 3. Design

### 3.1 API: two routes in a new controller and a new store

**Placement.** `UsersController` and `AdminStore` are in files ADM-05 edits. ASP.NET
Core attribute routing lets two controllers share a route prefix, so the new routes go
in a new controller with the same prefix and policy, backed by a new store:

- `api/src/DigitalHub.Api/Controllers/UserAccessController.cs` (new):
  `[ApiController]`, `[Authorize(Policy = "studio-admin")]`,
  `[Route("api/v1/users")]`, constructor `(UserAccessStore store)`. `UserId()` and
  `Respond()` as in `UsersController` (`AdminResponse.From`).
- `api/src/DigitalHub.Api/Content/UserAccessStore.cs` (new): `public sealed class
  UserAccessStore(ContentDbContext db, UserManager<ApplicationUser> users)`. Own
  private `Audit`, `Missing`, `Validation`, `IsDeactivated` and
  `RevokeRefreshTokensAsync`, with the same bodies as in `AdminStore`. The copies are
  listed for ADM-04b (4.2).
- `Program.cs`: one line after line 76, `builder.Services.AddScoped<UserAccessStore>();`.

**`PUT /api/v1/users/{id}/role`**, body `UserRoleChange { string Role }`, with
`[RequestBodyLimit(AuthController.AuthBodyLimit)]` and `[RejectDuplicateJsonFields]`
(two `role` keys would otherwise apply the last one, as the create comment says,
`AdminControllers.cs:84-85`). `UserAccessStore.ChangeRoleAsync(id, request, actorId,
ct)`:

1. `Role` must be `admin`, `editor` or `hr` (`Roles.All`, ordinal): else 400
   `validation_failed`, `errors.role` "Role must be admin, editor, or hr." (today's
   create text).
2. `id == actorId`: 400 `cannot_change_own_role` "You cannot change your own role."
   (as `cannot_deactivate_self`). It stops an admin demoting themselves by mistake;
   another admin does it (B3).
3. Begin a transaction. Take the app lock `digitalhub:admins` (`sp_getapplock`,
   Exclusive, owner Transaction, `@LockTimeout = 5000`), the ADM-07 pattern
   (`AdminStore.cs:197-214`). Below 0: roll back, 503 `users_busy` "Another change to
   the users is in progress. Try again." Every role change takes it.
4. Load the user (`FindByIdAsync`) and its roles inside the lock. No user, or no
   Studio role (`Roles.IsKnown`): 404 "That user does not exist." (as reset and
   deactivate; `ListUsersAsync` skips such users too).
5. Deactivated: 400 `user_deactivated` "Reactivate this user before changing their
   role." (B4).
6. Same role as now: 200 with the user, **no write, no audit, sessions untouched**.
7. **The last-admin guard.** If the user's current roles include `admin` and the new
   role is not `admin`: count active admins other than this user
   (`GetUsersInRoleAsync(Roles.Admin)`, `!IsDeactivated`, `Id != id`). Zero: 400
   `last_admin` "The last active admin cannot lose the admin role." It is the
   deactivate guard's rule (`activeAdmins <= 1` with the user counted is "no other
   active admin"), read from the database inside the lock, so the token's claims play
   no part (T3).
8. `RemoveFromRolesAsync(user, <its Studio roles>)`, then `AddToRoleAsync(user, role)`.
   A failed `IdentityResult` rolls back: a `ConcurrencyFailure` code gives 409
   `concurrency_conflict` "Someone else changed this user. Reload and try again.";
   anything else 400 `validation_failed` "The role could not be changed.".
9. Revoke every live refresh token of the user (2.5). The user's next request with any
   existing access token is 401, and they sign in again with the new role. This is
   done on promotion too: one rule, and a promoted user's old token would otherwise
   lack the new rights for 10 minutes.
10. Audit `change_user_role`, entity `user`, id, detail `"<old> -> <new>"` (for
    example `editor -> admin`). Save, commit.
11. 200 `{ id, email, role, active: true, mustChangePassword }`, the list row's shape.

**`POST /api/v1/users/{id}/reactivate`**, no body. `ReactivateAsync(id, actorId, ct)`:

1. Begin a transaction. Load the user. No user or no Studio role: 404 "That user does
   not exist.".
2. Not deactivated: 400 `already_active` "That user is already active.".
3. `LockoutEnd = null`, `AccessFailedCount = 0`. `LockoutEnabled` is left as
   deactivation set it (`true`); with `LockoutEnd` null the user is not locked
   (`IsDeactivated`, `SessionCheck`, login and refresh all test `LockoutEnd > now`).
4. **The password, by O-ADM04-2:**
   - **(a), recommended:** a new temporary password, as reset does:
     `RemovePasswordAsync`, `AddPasswordAsync(temporary)`, `MustChangePassword =
     true`. Identity changes the security stamp with the password. The answer carries
     `temporaryPassword`, shown once, as after a reset.
   - **(b):** the old password stays. `MustChangePassword` is left as it was.
   - **(c):** the password is removed and `MustChangePassword = true`; the admin then
     presses Reset password (the row is active again) to get a temporary one.
5. `UpdateAsync`. Revoke any live refresh token (there should be none: deactivation
   revoked them; this keeps a session from before deactivation dead even if one was
   missed). **Old sessions are never revived**: a refresh token revoked at
   deactivation stays revoked, and using it revokes its family (`RefreshAsync`).
6. Audit `reactivate_user`, entity `user`, id, detail = the user's role. Save, commit.
7. 200 `{ id, email, role, active: true, mustChangePassword }`, plus
   `temporaryPassword` under (a).

The reactivated user keeps the role they had. A different role is a role change
afterwards (two audited steps).

**Temporary password under (a).** `AdminStore`'s generator
(`NewAcceptedTemporaryPasswordAsync`, 446-457, and `NewTemporaryPassword`, 853-878)
is private, and `AdminStore.cs` is off limits until ADM-05 merges. So
`api/src/DigitalHub.Api/Identity/TemporaryPassword.cs` (new, `internal static`) holds
the same algorithm, copied as it is: 16 characters from the same four sets, one of
each required, `RandomNumberGenerator`, shuffled, checked against every password
validator, at most 10 draws. ADM-04b points `AdminStore` at it and deletes its copy
(4.2). Under (b) the file is not created.

**Create on a deactivated email is unchanged in the API**: still 409 `email_taken`
(`AdminStore.cs:348-350`, T12 pins it). The screen tells the admin the email belongs
to a deactivated user and offers Reactivate (3.2), from the list it already has.

### 3.2 Studio: role change and reactivation on User Management

`studio/src/pages/UsersPage.tsx`:

- **Role column.** For an active row that is not the signed-in admin's own
  (`row.id !== auth.user.id`): an antd `Select` (`aria-label` "Role for <email>",
  options `editor`, `admin`, `hr` labelled "HR", as the create form at 112). Choosing a
  different value opens `Modal.confirm`: title "Change role?", content "<email> becomes
  <role>. They are signed out and sign in again with the new role.", OK "Change role".
  OK sends `PUT /api/v1/users/{id}/role` with `{ role }`. On 200: `message.success("Role
  changed. <email> must sign in again.")` and `load()`. On failure: the problem's title
  in the error line (as today), and the select shows the stored role again. Cancel
  sends nothing. The own row and inactive rows keep the chip.
- **Inactive rows** get one action, "Reactivate". It opens `Modal.confirm`: title
  "Reactivate <email>?", content by O-ADM04-2 ((a): "They get a temporary password
  and must change it at sign-in."), OK "Reactivate". OK sends `POST
  /api/v1/users/{id}/reactivate`. On 200: under (a) the temporary-password modal opens
  with `temporaryPassword` (the existing modal, 119-129); under (b) or (c)
  `message.success("User reactivated.")`. Then `load()`.
- **Create on a deactivated email.** When `POST /api/v1/users` answers 409 with
  `problem.code === "email_taken"` and `items` has an inactive row whose email equals
  the typed one (trimmed, case-insensitive), the create modal shows "That email
  belongs to a deactivated user." and a button "Reactivate instead", which closes the
  create modal and runs the Reactivate flow for that row. Otherwise the title shows as
  today.
- Nothing else on the screen changes: Reset password and Deactivate stay as they are.

The confirmations are kept to these two security-relevant actions. Confirmations
across the Studio are ADM-14's (G3-2).

### 3.3 Sessions, tokens and audit, together

| Event | Refresh tokens | Access tokens in use | Audit |
| --- | --- | --- | --- |
| Role change (any direction) | All revoked (3.1 step 9) | 401 on the next request (`SessionCheck`, live family) | `change_user_role`, `"<old> -> <new>"` |
| Same role | Untouched | Untouched | None |
| Refused change (`last_admin`, `cannot_change_own_role`, `user_deactivated`, 503) | Untouched | Untouched | None, as for a refused deactivate today |
| Reactivate | Any live one revoked; those revoked at deactivation stay revoked | Old ones stay 401 (their families are revoked) | `reactivate_user`, role |
| Reactivate (a) | As above | As above | As above; the temporary password is never logged or audited (T10) |

### 3.4 Alternatives rejected

- **Add the routes to `UsersController` and `AdminStore`.** The natural home, but both
  files are ADM-05's (2.8), so the work could not start until ADM-05 merges. The new
  files keep ADM-04 off them entirely; ADM-04b tidies up after (4.2).
- **Let create reactivate a deactivated email.** A create would silently bring back a
  user with their old role and history. Refused: reactivation must be its own,
  audited, admin decision. It would also need `AdminStore.cs`.
- **A distinct 409 code for a deactivated email** (`email_deactivated` with the id).
  Cleaner for clients, but it edits `CreateUserAsync` in `AdminStore.cs`. The screen
  already has the list. Listed for ADM-04b as optional.
- **Change the security stamp instead of revoking tokens on a role change.** It would
  end the sessions too (`SessionCheck` compares the stamp), but revocation is the
  mechanism deactivate and reset already use and test. One mechanism.
- **Re-read roles in `SessionCheck` on every request.** Closes the 10-minute window
  for every path, but adds a third read to every request and changes `SessionCheck`,
  which is not this finding. Revocation on role change is enough.
- **Leave the race in the guard.** Two admins demoting each other at once could both
  pass the count. The lock costs one call per role change. Deactivate's own race is
  older and in `AdminStore.cs`: ADM-04b.
- **Delete now.** Waits on O-15 (section 9). The data points (2.9) make a real delete
  a change of its own whatever the answer.

## 4. Scope

### Files to create

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Controllers/UserAccessController.cs` | `PUT {id}/role`, `POST {id}/reactivate` (3.1) |
| `api/src/DigitalHub.Api/Content/UserAccessStore.cs` | `ChangeRoleAsync`, `ReactivateAsync`, `UserRoleChange`, the lock, private helpers (3.1) |
| `api/src/DigitalHub.Api/Identity/TemporaryPassword.cs` | The temporary-password generator, copied (3.1). **Only if O-ADM04-2 is (a)** |
| `api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs` | T1 to T12 (5.1) |
| `studio/test/users.test.tsx` | S1 to S7 (5.1) |
| `studio/e2e/users.spec.ts` | E1 (5.1) |
| `docs/changes/ADM-04/implementation.md` | The developer's record |

### Files to change

| File | What changes |
| --- | --- |
| `api/src/DigitalHub.Api/Program.cs` | One line: `builder.Services.AddScoped<UserAccessStore>();` after line 76 |
| `studio/src/pages/UsersPage.tsx` | 3.2 |

**Not changed, on purpose:** `AdminStore.cs`, `AdminControllers.cs`, `ContentStore.cs`,
`PublishChecks.cs`, `ErrorPagesPage.tsx` (ADM-05's), and every ADM-10 file. No
existing test file is changed: `CareersTests`, `AdminApiTests`, `SessionCheckTests` and
`DuplicateFieldTests` must pass as they are.

### 4.1 Order of work against ADM-05 and ADM-10

1. **No ADM-04 commit touches a file ADM-05 or ADM-10 touches** (2.8 and the list
   above). So the "written only after ADM-05 has merged" rule from the brief and from
   ADM-05 `plan.md` 4.1 step 6 does not hold any ADM-04 commit back. If the developer
   finds that a commit needs one of those files after all, the developer stops and the
   change comes back here (`docs/changes/README.md`, "the developer never changes the
   plan").
2. **Before commit 1**, the developer merges `origin/rebuild/dotnet-platform` (now
   `2bbd586`, with ADM-10) into `change/ADM-04`. A merge commit, never a rebase. Only
   `docs/changes/ADM-04/` differs on the branch, so no conflict is expected. The
   developer quotes `git log --oneline -3 origin/rebuild/dotnet-platform` and `git
   merge-base --is-ancestor 2bbd586 HEAD` (exit 0) in `implementation.md`.
3. **Before each source commit (3 and 4)** the developer re-runs, for every open
   `change/*` head, `git diff --name-only $(git merge-base <head>
   origin/rebuild/dotnet-platform) <head>`, plus ADM-05's planned list, against this
   change's files, and quotes the result. Any overlap: stop and report.
4. **If ADM-05 merges while ADM-04 is open**, the developer merges the new base in
   (merge, never rebase) and re-runs every suite in 5.3 before going on. ADM-05 changes
   `AdminStore.cs` and `AdminControllers.cs` only in error-page members, which this
   change does not read; `UserAccessStore` copies nothing from them.
5. The integrator merges ADM-05 and ADM-04 in whichever order they pass gate 2. They
   share no file, so neither waits on the other.

### 4.2 Split: what comes after

- **ADM-04b** (its own change, planned and written **only after ADM-05 has merged and
  the base is merged into its branch**, because it edits `AdminStore.cs` and
  `AdminControllers.cs`):
  1. `DeactivateUserAsync` takes the `digitalhub:admins` lock before its last-admin
     count, so a deactivate and a demotion (or two deactivates) at once cannot leave
     no active admin. This race exists today for two deactivates (2.4); ADM-04 adds
     the role-change path, which already takes the lock.
  2. `AdminStore` uses `TemporaryPassword` (if (a)) and one shared `IsDeactivated`;
     its own copies and `UserAccessStore`'s are removed.
  3. Optional, if the reviewer or owner wants it: create on a deactivated email answers
     409 `email_deactivated` with the user's id.
  4. Optional: move `UsersController`'s four actions into `UserAccessController`.
- **ADM-04c** (only if O-ADM04-1 is (b) or (c)): delete or anonymise users, with the
  data handling in 2.9. Its own plan, its own migration if any.

### Out of scope (left alone on purpose)

- **Delete** (O-ADM04-1, ADM-04c).
- **Per-account lockout and an admin unlock** (ADM-11, G3-2). Deactivation and a
  temporary lockout use the same `LockoutEnd` column. Once ADM-11 sets lockouts, a
  temporarily locked user would show as "Inactive" and "Reactivate" would clear the
  lockout. Recorded for ADM-11 to settle (Risks).
- **Showing emails instead of ids in the audit screen** (ADM-15).
- **`Cache-Control: no-store`** on answers that carry a temporary password. The reset
  answer lacks it today too (`grep -rn "no-store" api/src`: no match). Not this
  finding; noted for the security track.
- **The reviewers' test users in `DigitalHubContent_Studio`.** Deactivating them is a
  Studio action for the owner, not code.
- **`AdminStore.cs`, `AdminControllers.cs`**: ADM-04b.
- **No migration** (section 7).

## 5. Test plan

### 5.1 Failing tests, written first

**API, `api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs`**,
`[Collection("SqlServer")]`, `IClassFixture<ApiFactory>`. Sign-in through
`AuthSession.LoginAsync`; HTTP only, so the file compiles against the base API (no
reference to `UserAccessStore`). Each test creates its own users with stamped emails
(`"adm04-<name>-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test"`), as
`AdminApiTests` does. Users cannot be deleted, so they stay in `DigitalHubContent_Test`,
as every existing user test leaves them. Audit rows stay (the app login cannot delete
them; `ListPagingTests.cs:176`); a test finds its own row by entity id and a time after
its start. A test that changes another admin's lockout saves and restores it in
`finally`, and calls the `EnsurePrimaryAdminActiveAsync` logic (copied as a private
helper, `AdminApiTests.cs:598-`).

| Id | Name | Asserts | Red at base because |
| --- | --- | --- | --- |
| T1 | `An_admin_changes_an_editors_role_and_it_is_audited` | Create editor E. `PUT /api/v1/users/{E}/role` `{ role: "admin" }`: 200, body `role` "admin", `active` true. `GET /api/v1/users`: E's row `role` "admin". One audit row, entity id E, `Action` "change_user_role", `EntityType` "user", `Detail` "editor -> admin", `UserId` the acting admin | 404: no route |
| T2 | `A_role_change_ends_the_users_sessions` | Editor E signs in (session S). Admin changes E to `hr`. S's access token: `GET /api/v1/auth/me` 401 and `GET /api/v1/pages` 401. S's refresh: 401. A new sign-in: 200, `GET /api/v1/auth/me` `role` "hr" | 404 at the change step |
| T3 | `The_last_active_admin_keeps_the_admin_role` | Create admins X and Y; Y signs in. Then, through `UserManager` in a scope: remove Y's admin role (Y becomes editor in the database; Y's token still says admin, and `SessionCheck` does not re-read roles, 2.5) and lock every other admin except X (saving each one's `LockoutEnabled`/`LockoutEnd`). Y sends `PUT /api/v1/users/{X}/role` `{ role: "editor" }`: 400 `last_admin`. X is still admin. `finally`: restore every admin's lockout and the primary admin | 404: no route. It reaches the guard through HTTP, which the deactivate test could not (2.7) |
| T4 | `Reactivation_brings_a_user_back_with_their_role` | Create HR user H with password P; deactivate H. `POST /api/v1/users/{H}/reactivate`: 200, `active` true, `role` "hr". `GET /api/v1/users`: H active. Audit row `reactivate_user`, entity H, `Detail` "hr". **(a):** body has `temporaryPassword` (length 16); sign-in with P is 401; with it is 200 and `mustChangePassword` true. **(b):** no `temporaryPassword`; sign-in with P is 200. **(c):** sign-in with P is 401; H's row `mustChangePassword` true | 404: no route |
| T5 | `Reactivation_does_not_revive_old_sessions` | Editor E signs in (session S), is deactivated, then reactivated. S's access token: 401. S's refresh: 401 | 404 at the reactivate step |
| T6 | `Reactivating_an_active_or_unknown_user_is_refused` | Active E: 400 `already_active`. A new guid: 404. A user with no Studio role (made through `UserManager`): 404. Nothing changes | 404 for the first (no route) |
| T7 | `A_role_change_checks_its_input` | `{ role: "viewer" }`: 400 `validation_failed`, `errors.role`. Body `{"role":"editor","Role":"admin"}`: 400 `duplicate_field`, role unchanged. Body over 4 KB: 413. A new guid: 404. A deactivated user: 400 `user_deactivated`. E to its own role `editor`: 200, no new audit row, and E's existing session still answers 200 on `GET /api/v1/auth/me` | No route: 404 where 400 or 413 is expected |
| T8 | `An_admin_cannot_change_their_own_role` | The primary admin `PUT`s its own id with `{ role: "editor" }`: 400 `cannot_change_own_role`. Still admin | 404 |
| T9 | `A_role_change_waits_for_the_users_lock_and_then_refuses_as_busy` | The test opens its own connection (`ApiFactory`'s test connection string), begins a transaction, and takes `sp_getapplock @Resource = N'digitalhub:admins', @LockMode = N'Exclusive', @LockOwner = N'Transaction'`. Admin changes editor E to `admin`: 503 `users_busy` after at least 4.5 s. E is still editor. `finally`: roll back the test's transaction. The resource name and the 5 s timeout are constants in the test with a comment tying them to `UserAccessStore` (as `RedirectConcurrencyTests.cs:25-35`) | 404, at once |
| T10 | `A_reactivation_password_does_not_appear_in_application_logs` (**(a) only**) | Same harness as `AdminApiTests.Temporary_password_does_not_appear_in_application_logs` (Serilog `CollectingSink`). After a reactivation, no log event's rendered text or property contains the `temporaryPassword`, and the audit row's `Detail` does not either | 404 |
| T11 | `Editors_and_HR_cannot_change_roles_or_reactivate` | An editor and an HR user each get 403 on `PUT /api/v1/users/{id}/role` and `POST /api/v1/users/{id}/reactivate`. The target is unchanged | **Green at base** only if a missing route answers 403 for them; it answers 404 by routing, so red at base on the 403 assertion. Guards the policy either way |
| T12 | `Creating_a_deactivated_email_is_still_email_taken` | Create E, deactivate, `POST /api/v1/users` with E's email in upper case: 409 `email_taken`. Nothing is created | **Green at base.** Pins the API contract the screen relies on (3.1, 3.2) |

T11's base answer is not certain from reading (the fallback policy runs on a matched
endpoint only). The developer records what it is at commit 1. Either way it is green
after the fix.

**Studio, `studio/test/users.test.tsx`** (vitest, jsdom). The harness is copied from
`studio/test/redirects.test.tsx` (the `matchMedia` and `ResizeObserver` stubs, the
hoisted `api.handler` and `request` mock, `message` spies) and
`studio/test/listPaging.test.tsx:69-70` (`useAuth` mocked, here `{ user: { id: "u-1",
role: "admin", email: "me@x.test" }, ready: true }`), with the file-level `afterEach`
that asserts `document.body.innerHTML` is empty (ADM-06b-flake). The list is
`u-1` me (admin, active), `u-2` ed@x.test (editor, active), `u-3` old@x.test (hr,
inactive). Every path the handler does not expect throws.

| Id | Name | Asserts | Red because |
| --- | --- | --- | --- |
| S1 | `changes a user's role after confirming` | Choose "admin" in "Role for ed@x.test": the dialog "Change role?" shows. Confirm: one `PUT /api/v1/users/u-2/role` with body `{"role":"admin"}`, then a second `GET /api/v1/users`. The success spy gets "Role changed. ed@x.test must sign in again." | No select |
| S2 | `a cancelled role change sends nothing` | Choose "hr", then Cancel: no `PUT`; the select shows "editor" | No select |
| S3 | `your own row and inactive rows have no role select` | No combobox named "Role for me@x.test" or "Role for old@x.test"; both show the chip | **Green at base** (no selects at all). Guard |
| S4 | `shows why a role change was refused` | `PUT` answers 400 `{ code: "last_admin", title: "The last active admin cannot lose the admin role." }`: that title shows; no reload; the select shows "editor" | No select |
| S5 | `reactivates an inactive user` | "Reactivate" on old@x.test, confirm: one `POST /api/v1/users/u-3/reactivate`. **(a):** the answer has `temporaryPassword: "Tmp-Pass-1234!ab"`; the "Temporary password" dialog shows it. **(b)/(c):** the success spy gets "User reactivated." Then a second `GET` | No Reactivate button |
| S6 | `offers to reactivate when a new user's email is deactivated` | Create user with " OLD@x.test " answers 409 `{ code: "email_taken", title: "A user with that email already exists." }`: the modal shows "That email belongs to a deactivated user." and "Reactivate instead"; clicking it and confirming sends `POST /api/v1/users/u-3/reactivate` | No such text |
| S7 | `a taken active email shows the API's message` | Create with "ed@x.test" answers 409 `email_taken`: "A user with that email already exists." shows and there is no "Reactivate instead" | **Green at base.** Guard for S6's condition |

**End-to-end, `studio/e2e/users.spec.ts`** (E1). ADM-04 is a Blocker, not a Major,
but the G3-1 gate asks that each blocker be "reproduced before its fix and passing
after it", and User Management is where staff do it. It follows `redirects.spec.ts`:
API set-up with `adminHeaders`, `finally` clean-up. `workers: 1`
(`playwright.config.ts:10`).

E1, `ADM-04 users: change a role, deactivate, reactivate`:

1. **Set-up through the API** as admin: create editor `e2e-adm04-<stamp>@digitalhub.test`
   with a known password, and sign it in through `POST /api/v1/auth/login` (keep its
   access token). Not the seeded editor, which other specs use.
2. `signIn(page, "admin")`, open "User Management". In the row for that email, choose
   "admin" in "Role for <email>" and confirm. **At base it fails here**: no select. The
   row's role shows "admin".
3. Through the API: the kept access token gets 401 on `GET /api/v1/auth/me`;
   `GET /api/v1/users` shows the row as admin.
4. Click "Deactivate" on the row (existing). The status reads "Inactive".
5. "Create user" with the same email and any role and password: the modal shows "That
   email belongs to a deactivated user."; click "Reactivate instead", confirm.
   **(a):** the "Temporary password" dialog shows a value; read it. **(b)/(c):** the
   success message.
6. Through the API: sign in as that email with the temporary password **(a)**
   (`mustChangePassword` true) or the original **(b)**: 200. **(c):** the original is
   401.
7. **`finally`:** deactivate the user through the API, so no extra active admin is
   left for later specs. The end-to-end database is dropped before every run
   (`start-api.ts`).

### 5.2 Commit order

CI job `studio` runs "Unit tests" (`ci.yml:237`) before "End-to-end suite"
(`ci.yml:271`), so a red unit test in the same commit would hide E1's red (ADM-07,
ADM-10). So:

0. **Merge** `origin/rebuild/dotnet-platform` (`2bbd586`) into `change/ADM-04` (4.1
   step 2). Not a rebase.
1. `ADM-04: Test role change and reactivation in the API and end-to-end`: T1 to T12
   and E1. Test files only. Touches no shared file.
2. `ADM-04: Test role change and reactivation on the users screen`: S1 to S7.
3. `ADM-04: Change roles and reactivate users in the API`: `UserAccessController.cs`,
   `UserAccessStore.cs`, `Program.cs`, and `TemporaryPassword.cs` under (a). Makes
   T1 to T11 green.
4. `ADM-04: Change roles and reactivate from the users screen`: `UsersPage.tsx`.
   Makes S1, S2, S4 to S6 and E1 green.
5. `ADM-04: Implementation record`.

T4, T10, S5 and E1 steps 5 and 6 depend on O-ADM04-2. If it is unanswered when
commits 1 and 2 are written, they are written for the recommended (a), marked so in a
comment, and **not pushed**; if the answer is (b) or (c), they are changed before the
push. Commit 3 is not written until O-ADM04-2 is answered.

Each fix commit can be reverted on its own. Commit 3 before 4 is safe: the API routes
exist with nothing calling them.

### 5.3 Local evidence

.NET in Release only. Never `DigitalHubContent`. Ports 42xx.

**After commit 1 (red):**

```bash
cd api && dotnet build DigitalHub.slnx -c Release
cd studio && npm ci && npx tsc -b
```

- Expected: 0 errors (HTTP-only tests compile against the base). Build warnings no more
  than the base's 13 (ADM-07 2.6).
- T1 to T12 and E1 need SQL Server. Without it they fail at the connection, which is
  not the red. Record them NOT RUN locally, covered by CI jobs `api` and `studio`
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
cd api && dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~UserRoleAndReactivationTests|FullyQualifiedName~AdminApiTests|FullyQualifiedName~SessionCheckTests|FullyQualifiedName~SessionRevocationTests|FullyQualifiedName~SessionLimitTests|FullyQualifiedName~CareersTests|FullyQualifiedName~DuplicateFieldTests|FullyQualifiedName~PasswordChangeGateTests|FullyQualifiedName~CommonPasswordTests|FullyQualifiedName~RedirectConcurrencyTests"

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

- `CareersTests.Authorization_matches_for_every_endpoint` must pass unchanged with the
  two new routes in it (2.7). It is the route-and-role check for every role, including
  deactivated (401) and must-change (403 `password_change_required`).
- `RedirectConcurrencyTests` is in the filter because T9 also holds an app lock; the
  two resource names differ, and both must stay green.
- Any test that passed at the base and fails now is a regression. It is reported before
  anything is fixed.

**Not runnable on this machine:** no `dotnet`, no SQL Server, no `node_modules`. The
developer quotes each command as run, with exit code and output (P-8). Anything that
cannot run is NOT RUN, with the reason and the CI job that covers it.

### 5.4 CI evidence on the pull request

- **Red at commit 1** (needs O-ADM04-3 "Yes"):
  - Job `api`: T1 to T10 fail, each at its assertion, quoted (T10 under (a) only). T11
    as recorded (5.1). T12 and every existing test pass.
  - Job `studio`: unit tests pass (S1 to S7 are not in commit 1). In the end-to-end
    suite E1 fails at step 2. Every other spec passes.
  - Job `website`: green (no change).
  - Wait until `api`, `website` and `studio` have finished before pushing again
    (`cancel-in-progress: true`, `ci.yml:25`).
- **Red at commit 2:** job `studio`, "Unit tests": S1, S2, S4, S5, S6. The local red is
  enough.
- **Green, on the final head, every workflow:** `ci.yml` jobs `api` (quote the TRX
  total), `website`, `studio` (unit and end-to-end), `section-compare`,
  `screenshot-parity`, `website-browser`; `security.yml`; `codeql.yml`;
  `workflow-lint.yml`.

### 5.5 Track checklist (G3, `docs/changes/README.md`)

| Rule | How this change meets it |
| --- | --- |
| "The finding, its evidence and its fix come from `docs/quality/admin-audit-2026-10-28.md`" | Section 1 quotes it. Change role with the guard: 3.1. Reactivate: 3.1. O-15: O-ADM04-1. The matching UI: 3.2 |
| "The regression test is committed and shown failing before the fix" | Commits 1 and 2 hold tests only. S1, S2, S4 to S6 are red locally; T1 to T10 and E1 red in CI at commit 1 if O-ADM04-3 is "Yes". If "No", the database reds cannot be shown, the row is not met, and delivery is BLOCKED ON OWNER until the owner accepts that in words (P-7) |
| "The end-to-end suite gets a test for each Major" | ADM-04 is a Blocker. E1 is added anyway, for the G3-1 "reproduced before its fix" gate |
| "A Minor that is not fixed becomes a D-NNN entry" | Not a Minor. Delete is not left unfixed silently: it is an owner decision (O-ADM04-1), and a "yes" makes ADM-04c |
| G3-1 exit gate: "each blocker reproduced before its fix and passing after it" | T1, T4 and E1 reproduce "cannot have their role changed, be reactivated"; T12 with S6 and E1 step 5 the "deactivated email" part. All pass after the fix |
| G3-1 exit gate: "A clean website build from `DigitalHubContent_Studio` with no patched content" | Not affected: this change touches no content or website code. A batch gate, not this change alone |

## 6. Security impact

- **Routes and policies:** two new routes, both `[Authorize(Policy = "studio-admin")]`
  (admin only; `Program.cs:261`), the same as every other `/api/v1/users` route. The
  fallback policy (`Program.cs:248-252`) and `PasswordChangeGate` apply as to any
  endpoint: a must-change admin gets 403 `password_change_required`. Proven by T11 and
  by `CareersTests.Authorization_matches_for_every_endpoint`, unchanged. No route is
  removed or re-policied.
- **Privilege changes:** a role change is the strongest action in the Studio. It is
  admin-only; it refuses the actor's own id (`cannot_change_own_role`); it refuses to
  leave no active admin (`last_admin`), checked from the database inside an exclusive
  lock, not from the caller's token (T3, T9).
- **Sessions and tokens:**
  - A demoted (or promoted) user's refresh tokens are revoked, so every access token
    they hold is refused on its next request and they sign in again with the new
    role. Without this a demoted admin keeps admin rights for up to 10 minutes (2.5).
    T2 proves it.
  - A reactivated user's old sessions stay dead (T5). Under (a) the password is new and
    must be changed at sign-in, so a password known before the user left does not work
    again (T4).
  - A deactivated user still cannot use any route (unchanged; `SessionCheckTests`).
- **Audit:** `change_user_role` (with `old -> new`) and `reactivate_user` (with the
  role), each with the acting admin's id. A refused attempt is not audited, as for a
  refused deactivate today. A no-op role change is not audited. The temporary password
  is never logged or audited (T10).
- **Input:** the role body is capped at 4 KB and refuses duplicate keys, as create is
  (T7). The role must be one of three fixed strings.
- **Data:** writes only `AspNetUserRoles`, `AspNetUsers` (lockout, password hash,
  security stamp, `MustChangePassword`, `AccessFailedCount`), `RefreshTokens` and
  `audit_log`. The app login has these through `db_datawriter`; `sp_getapplock` needs
  only `public` (ADM-07, `AdminStore.cs:197-200`). No grant changes.
- **Temporary password (a):** generated with `RandomNumberGenerator`, the same
  algorithm as reset, returned once in the answer body. The answer has no
  `Cache-Control: no-store`, the same as reset today (out of scope, section 4).
- **Logins, secrets, dependencies, configuration, rate limits:** none. No package is
  added. No lockfile changes.

## 7. Migrations

None. `AspNetUserRoles`, `AspNetUsers.LockoutEnd`, `AccessFailedCount`,
`MustChangePassword` and `RefreshTokens.RevokedAt` already exist and are written today
by create, deactivate and reset.

## 8. Rollback

Revert the pull request. No schema change.

Data written while it was live stays valid under the old code:

- A changed role is an ordinary `AspNetUserRoles` row. The old code reads it.
- A reactivated user is an ordinary active user (`LockoutEnd` null). Under (a) with
  `MustChangePassword` true, which the old code already handles (reset sets it).
- After a revert, roles can no longer be changed and users no longer reactivated from
  the Studio. Nothing needs clearing.

## 9. Owner decisions needed

**Checked first: no record of an owner answer to O-15 was found.**

- `grep -rn "O-15"` over this worktree, `/home/user/dh-change-adm05`,
  `/home/user/dh-change-adm10`, `/home/user/dh-change-adm07` and
  `/mnt/attach/project-files` finds only the audit's "Decision O-15 on delete." (line
  115) and, in the chat export of 1 November, line 2115, the assistant's list
  "Decisions I need from you": "**O-15: should users ever be deleted?** I recommend
  no, because the audit log refers to them; add "change role" and "reactivate"
  instead."
- The only user message after it in the export (13:47 UTC, 1 November) is "export all
  the chat here in md file". The refinement plan (line 268) lists O-15 among "Sixteen
  owner decisions are open".
- So O-15 is asked again here, as O-ADM04-1. No answer is assumed.

- **O-ADM04-1 (this is O-15). Status: PENDING.** "Should Studio users ever be deleted?
  (a) No: deactivation is the end state, and an email can be brought back with
  Reactivate. (b) Yes, but only a user who never signed in and has done nothing (no
  audit entries, no handled enquiries, no content they created or published).
  (c) No true delete, but an admin can anonymise a deactivated user: the email is
  replaced so it can be used for a new account, and the audit entries keep the id."
  - **Recommendation: (a).** It is the question as first asked (chat export, line
    2115). The audit log, enquiries and content keep user ids (2.9), and the app login
    cannot change audit rows, so a deleted user would leave ids nobody can trace, and
    a user who handled an enquiry cannot be deleted at all without schema work.
    Reactivate (this change) solves the "email can never be used again" half of the
    finding. (b) or (c) is a change of its own, ADM-04c.
  - **Blocks:** nothing in this change's commits. It blocks closing the finding's
    "Decision O-15 on delete" row, so gate 2 records it as the one open row, and the
    FR-S-02 status.
- **O-ADM04-2. Status: PENDING.** "When an admin reactivates a user, should (a) the
  user get a new temporary password that they must change at sign-in, shown once to
  the admin as after a reset, (b) the old password work again, or (c) the user have no
  password until the admin presses Reset password?"
  - **Recommendation: (a).** A returning employee's old password may have been reused
    or shared since they left; a fresh one closes that. It is one step for the admin
    and matches how a reset already works. (b) is the fewest steps but brings back a
    password nobody has checked. (c) is safe but takes two actions.
  - **Blocks:** commit 3 (`ReactivateAsync`, and whether `TemporaryPassword.cs`
    exists), and the push of commits 1 and 2 if they were written for (a) and the
    answer differs (5.2).
- **O-ADM04-3. Status: PENDING.** "For ADM-04, may the developer push the test-only
  commit first, so CI shows the database and end-to-end tests failing before the fix,
  as with ADM-02, ADM-07, ADM-10 and ADM-05?"
  - **Recommendation: Yes.** T1 to T10 and E1 need SQL Server, which only CI jobs `api`
    and `studio` have here. Without the push, their red cannot be shown and the G3
    rule is not met.
  - The owner's earlier yeses covered those changes only ("Yes, red tests first",
    11 November 2026, ADM-07 `plan.md` section 9; ADM-10 `delivery-approval.md`
    line 34, O-ADM10-1). This one asks again.
  - **Until it is answered:** build commits 1 and 2, record the local reds, and push
    nothing.

**Behaviour changes, for the owner to see.** They go in the pull request body. They
are the audit's fix, so they are not asked as separate decisions. Say so before gate 1
if any is not wanted.

- **B1:** An admin can change any other active user's role between admin, editor and
  HR, from User Management, after a confirmation.
- **B2:** A role change signs the user out everywhere; they sign in again with the new
  role.
- **B3:** An admin cannot change their own role (another admin does it), as they cannot
  deactivate themselves today.
- **B4:** A deactivated user's role cannot be changed until they are reactivated.
- **B5:** The last active admin cannot be made editor or HR (`last_admin`).
- **B6:** A deactivated user can be reactivated, keeping their role; under (a) with a
  new temporary password.
- **B7:** Creating a user with a deactivated user's email still fails, and the screen
  now offers "Reactivate instead".
- **B8:** Two new audit actions: `change_user_role` and `reactivate_user`.
- **B9:** If the user list is being changed by another admin at the same moment, a role
  change can answer "Another change to the users is in progress. Try again." (503,
  after 5 s at most).

## 10. Risks

| Risk | Effect | Caught by |
| --- | --- | --- |
| The role change does not end the user's sessions | A demoted admin keeps admin rights for up to 10 minutes | T2 (old access token 401 on two routes, refresh 401), E1 step 3 |
| The guard counts from the token, not the database, or counts the target | The last admin is demoted, or a valid demotion is refused | T3 (token says admin, database says editor), T1 (two active admins: allowed) |
| Concurrent demotions of the last two admins both pass | No active admin left; only database work can fix it | T9 proves the role change waits for the lock. Deactivate does not take it until ADM-04b (4.2), so a deactivate racing a demotion can still pass both: the same exposure two deactivates have today. Stated, not hidden |
| T9's resource name or timeout drifts from the store's | T9 passes against a lock nobody takes, or turns flaky | The test's constants carry a comment naming `UserAccessStore` and the 5 s, as `RedirectConcurrencyTests.cs:25-35` does; T9 asserts the wait is at least 4.5 s |
| Reactivation revives a session from before deactivation | A device the person used before leaving gets back in | T5 |
| The temporary password leaks into logs or audit | A secret in the log store | T10 (a) |
| T3 leaves admins locked or the primary admin demoted | Later tests fail on sign-in | `finally` restores every lockout it changed and the primary admin; the class is in collection `SqlServer` (serial). `AdminApiTests.AdminAsync` already re-activates the primary admin before use |
| The new controller collides with `UsersController`'s routes | Ambiguous-route 500s | The templates differ (`{id}/role`, `{id}/reactivate` against `{id}/deactivate`, `{id}/reset-password`); `CareersTests.Authorization_matches_for_every_endpoint` calls every route as admin |
| `RejectDuplicateJsonFields` or the 4 KB cap is left off the role route | A body with two `role` keys applies the last | T7 |
| A must-change admin can change roles | The gate is bypassed | `CareersTests` "must-change" expects 403 `password_change_required` on every non-allowed route; no `AllowedBeforePasswordChange` on the new actions |
| ADM-05 or another branch starts touching `Program.cs` or `UsersPage.tsx` | Breaks "Parallel work must change different files" | 4.1 step 3: the check before each source commit, quoted |
| ADM-11 makes temporary lockouts use `LockoutEnd` | A temporarily locked user shows as "Inactive", and "Reactivate" clears a lockout | Out of scope here. Handed to ADM-11: it must tell a deactivation from a lockout (for example `LockoutEnd == DateTimeOffset.MaxValue`) in `IsDeactivated`, `ListUsersAsync`, and `UserAccessStore` |
| Two copies of `IsDeactivated`, the revoke helper and (a) the password generator until ADM-04b | A later fix lands in one copy only | ADM-04b removes them; `implementation.md` lists each copy with its source lines |
| O-ADM04-2 unanswered by 16 November | ADM-04 misses the batch date | Commits 1 and 2 do not wait. Commit 3 does. The coordinator asks it now |

### What I could not verify

- **ADM-10's state.** The brief says #56 is not merged; `gh api .../pulls/56` says
  `"merged":true,"merged_at":"2026-11-12T11:58:12Z"`, and the remote base is `2bbd586`.
  The plan follows the remote. If the coordinator knows otherwise, 4.1 step 2 changes
  only in which commit is merged.
- **Nothing was run.** No `dotnet`, SQL Server or `node_modules` here. The
  10-minute window after a demotion (2.5), the deactivate race (2.4) and T11's base
  answer are read from the code.
- **Identity details** read from memory of ASP.NET Core Identity, not run: that
  `RemoveFromRolesAsync`/`AddToRoleAsync` save through `UpdateAsync` inside the open
  transaction (as `CreateUserAsync` relies on), and that `AddPasswordAsync` changes the
  security stamp. The design does not depend on the stamp: sessions end by revocation.
- **`DigitalHubContent_Studio`**: not read. Which reviewer users are still active there
  is the chat export's claim only.
- `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` are missing; any rule they
  hold that is stricter than what is quoted here was not applied.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| An admin can change another user's role (API) | ADM-04 Fix 1; FR-S-02 "assign roles"; `phase-b-studio.md` line 43 | Planned | |
| The last-admin guard holds for role changes, from the database | ADM-04 Fix 1 "keeping the last-admin guard"; `phase-b-studio.md` 8.4, 10.11 | Planned | |
| Concurrent role changes cannot both pass the guard | Found here (2.4, 3.1 step 3) | Planned | |
| A role change ends the user's sessions | Found here (2.5); brief: "sessions and tokens of a ... demoted user" | Planned | |
| An admin cannot change their own role | Found here; mirrors `cannot_deactivate_self` (B3) | Planned | |
| A deactivated user can be reactivated (API) | ADM-04 Fix 2 | Planned (password per O-ADM04-2) | |
| Reactivation does not revive old sessions | Brief: "sessions and tokens of a deactivated ... user" | Planned | |
| A deactivated email can be used again, by reactivation | ADM-04 title and bullet 2 | Planned | |
| Role changes and reactivations are audited; the temporary password is not logged | Brief: "audit entries"; FR-S-15 | Planned | |
| Editors, HR, deactivated and must-change users cannot reach the new routes | Brief: "admin-only"; `phase-b-studio.md` 10.2 | Planned | |
| User Management: role change with confirmation | ADM-04 Fix 4 | Planned | |
| User Management: Reactivate on inactive rows | ADM-04 Fix 4 | Planned | |
| User Management: a deactivated email offers Reactivate | ADM-04 Fix 4; bullet 2 | Planned | |
| Decision O-15 on delete | ADM-04 Fix 3 | Planned (waits on O-ADM04-1; a "yes" makes ADM-04c) | |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan line 221 | Planned (CI red waits on O-ADM04-3) | |
| An end-to-end test of role change, deactivate and reactivate | G3-1 exit gate, "reproduced before its fix and passing after it" | Planned | |
| FR-S-02 moves from "Partly" to "Works" | Audit requirement table, line 29 | Planned (waits on O-ADM04-1) | |
| No ADM-04 commit touches a file ADM-05 or ADM-10 touches; base merged, never rebased | `AGENTS.md` "Parallel work must change different files"; ADM-05 `plan.md` 4.1 step 6; the brief | Planned | |
| Deactivate takes the same lock; duplicated helpers removed | Found here; moved to ADM-04b (after ADM-05 merges) | Moved: ADM-04b | |
| Delete or anonymise, if the owner wants it | O-ADM04-1 (b) or (c) | Moved: ADM-04c (only on that answer) | |

## 12. Revision log

- **Round 1** (12 November 2026): first version. No review yet.

Plan state: round 1, ready for plan review. Gate 1 can proceed with the owner
questions open. Commit 3 waits on O-ADM04-2, any push waits on O-ADM04-3, and closing
the finding's delete row waits on O-ADM04-1 (O-15). No commit waits on ADM-05: this
change touches none of its files.
