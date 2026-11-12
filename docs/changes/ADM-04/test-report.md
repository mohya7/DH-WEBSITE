# ADM-04: test report

Tester, 12 November 2026. Plan `plan.md` round 3 (`59e1269`), gate 1 `plan-approval.md`
(`33b3efc`, C1 to C12), `implementation.md` (Status: READY FOR TEST). Audit finding:
`admin-audit-2026-10-28.md` lines 105-116. Owner answers as relayed by the coordinator
(card taps, 12 Nov 2026 12:09 UTC): "No, deactivate is enough" (O-ADM04-1), "New temporary
password" (O-ADM04-2), "Yes, red tests first" (O-ADM04-3). I have not seen the cards.

## Round 1

**Commit tested: `2b81b04`** (local head of `change/ADM-04`), on a detached worktree
`/home/user/dh-check-adm04` (`git worktree add --detach /home/user/dh-check-adm04 2b81b04`),
removed afterwards. Red-test commits: `bf634e2` (API and E1; the only commit on the remote,
`git ls-remote origin refs/heads/change/ADM-04` -> `bf634e2...`) and `486588c` (Studio).

**What this machine can run.** No `dotnet`, no SQL Server, no `semgrep`, no `gitleaks`
(`which dotnet semgrep gitleaks`: none found). GitHub Actions is blocked by billing. So no
C# has been compiled or run by me either. Every API test, E1 and every CI-only row below is
**PENDING**, with the CI job that covers it. The C# was reviewed by reading it against the
codebase's types and signatures (section 4).

### 1. Red first

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Studio red at commit 2 | `git checkout --detach 486588c; cd studio && npx vitest run test/users.test.tsx` | 1 | `Tests 5 failed \| 2 passed (7)`. S1, S2, S4: `Unable to find an accessible element with the role "combobox" and name "Role for ed@x.test"`. S5: `... role "button" and name "Reactivate"`. S6: `Unable to find an element with the text: That email belongs to a deactivated user.` S3, S7 pass. Each fails at the step the plan names (5.1) |
| Studio green at head | `git checkout --detach 2b81b04; npx vitest run test/users.test.tsx`, three runs | 0, 0, 0 | `Tests 7 passed (7)` each time |
| API red at `bf634e2` (T1 to T11, T13 to T16 red; T12 green) | `dotnet test ... -c Release` | NOT RUN | **PENDING**, CI job `api` on `bf634e2` (C4). No dotnet. By reading: neither route exists at the base, so each first status assertion meets 404 (T11: the fallback policy lets editor and HR through to routing, so 404, not 403); T15 fails at "Expected exactly one 200"; T16 fails at the `Matched` 1 wait with its named message; T10 fails at the 200 assertion, not on an empty sink. T12 passes at base (`CreateUserAsync` 409 `email_taken`, `AdminStore.cs`). I agree with the developer's reading |
| E1 red at `bf634e2`, step 2 | `npx playwright test e2e/users.spec.ts` | NOT RUN | **PENDING**, CI job `studio`, "End-to-end suite". By reading, step 2's `getByRole("combobox", { name: "Role for <email>" })` cannot be found at base |
| E1 spec type-checks | `cd studio && npx tsc --ignoreConfig --noEmit --strict --module esnext --moduleResolution bundler --target es2023 --skipLibCheck --allowImportingTsExtensions --types node e2e/users.spec.ts` | 0 | Helpers it imports exist (`e2e/env.ts`: `e2eAdminEmail`, `e2eApiOrigin`, `e2ePassword`; `e2e/helpers.ts`: `openArea`, `signIn`) |

Commit 1 holds only the four new test files (`git show --stat bf634e2`), commit 2 only
`studio/test/users.test.tsx`. No existing test file is changed (`git diff --stat 804e85f
2b81b04`). `git merge-base --is-ancestor 2bbd586 HEAD`: exit 0 (C2).

### 2. Test plan suites (plan 5.3)

| Suite | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| Studio install | `cd studio && npm ci` | 0 | `found 0 vulnerabilities` |
| Studio typecheck | `cd studio && npx tsc -b` | 0 | |
| Studio unit | `cd studio && npm test` | 0 | `Test Files 14 passed (14)`, `Tests 105 passed (105)` (base 98 + S1 to S7) |
| Studio build | `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `built in 1.36s`; `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.` Chunk-size warning is the base's |
| Studio end-to-end | `cd studio && npm run test:e2e` / `npx playwright test e2e/users.spec.ts e2e/studio.spec.ts e2e/verification.spec.ts e2e/appearance.spec.ts` | NOT RUN | `start-api.ts` needs dotnet and `DigitalHubContent_E2e`. **PENDING**, CI job `studio` |
| Website install | `cd website && npm ci` | 0 | |
| Website typecheck | `cd website && npm run typecheck` | 0 | |
| Website unit | `cd website && npm test` | 0 | `Test Files 23 passed \| 1 skipped (24)`, `Tests 431 passed \| 31 skipped (462)` (same as the developer's) |
| Design check | `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| Website build | `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `Redirect targets: all 0 resolve to a page.` `Build output checks passed.` |
| Section comparison | `cd website && npm run compare:sections` | 1 | `fatal: cannot change to 'D:\work\DigitalHub\New Website\DH-WEBSITE-main': No such file or directory`. The reference checkout does not exist on this machine: environment, not a result. No website file changes in this change. **PENDING**, CI job `section-compare` |
| Website browser, screenshot parity | `npm run test:browser`, `compare:screenshots` | NOT RUN | No website change. **PENDING**, CI jobs `website-browser`, `screenshot-parity` |
| API build and tests (incl. the plan's filter, three runs of `UserRoleConcurrencyTests`, C5 timelines, C7 items 1 to 3, warnings <= 13) | plan 5.3 `dotnet build/test ... -c Release` | NOT RUN | No dotnet, no SQL Server. **PENDING**, CI job `api` |

### 3. Track checklist (G3)

| Rule | State |
| --- | --- |
| Finding, evidence and fix from the audit | Verified by reading: change role with the last-admin guard (`UserAccessStore.ChangeRoleAsync`), reactivate (`ReactivateAsync`), O-15 decided "no delete" (no delete code anywhere in the diff), UI (`UsersPage.tsx`) |
| Regression test committed and shown failing before the fix | Studio: verified red at `486588c` (section 1). API and E1: **PENDING** CI at `bf634e2` |
| End-to-end test for each Major | ADM-04 is a Blocker; E1 exists and type-checks. Run **PENDING** CI |
| Minor not fixed becomes a D-NNN | Not applicable to the audit item. See findings for this round's Minors |

### 4. Security and code review (by reading; nothing compiled)

Line numbers are `UserAccessStore.cs` at `2b81b04`.

- **Compiles against the codebase (by reading).** Every type and member used exists with
  the signature used: `Roles.IsKnown(string)` and `Roles.Admin` (`Identity/Roles.cs`),
  `ContentOutcome.Ok/Fail/Code/Status` (`ContentStore.cs:1393-1411`), `AdminResponse.From`
  (`AdminControllers.cs:166`, internal, same assembly), `RequestBodyLimitAttribute(long)`,
  `RejectDuplicateJsonFieldsAttribute`, `AuthController.AuthBodyLimit` (public const 4096),
  `TokenService.RevokeUserAsync(string, Guid?, CancellationToken)` (public, scoped, same
  `ContentDbContext`), `ContentDbContext : IdentityDbContext<ApplicationUser>` (so
  `Users`, `UserRoles`, `Roles`), `ApplicationUser.MustChangePassword`, `AuditLogEntry`
  fields, `UserManager.Options`. The lock call is the ADM-07 code verbatim
  (`ExecuteSqlRawAsync(sql, [result], ct)`). Implicit usings cover `StatusCodes`. In the
  tests: `AuthSession` members, `TestPassphrase.New`, `ApiFactory.AdminEmail/AdminPassword`
  (and `ApiFactory` is a public non-sealed class with `protected override ConfigureWebHost`),
  `TokenService.SessionClaim`/`Hash`, `RefreshToken` fields, `LogEvent.RenderMessage()`,
  `Assert.Equal([...], list)` (used elsewhere, e.g. `RedirectAddressRuleTests.cs:28`), the
  interceptor overrides as in `RedirectConcurrencyTests`. No duplicate type names (nested
  `LoggingFactory` types are private or nested). No `TreatWarningsAsErrors`. I found no
  compile error, but only a compiler can say so: **PENDING** CI job `api`.
- **Admin-only.** `[Authorize(Policy = "studio-admin")]` on the controller; no
  `AllowAnonymous` or `AllowedBeforePasswordChange`, so `PasswordChangeGate` applies. Role
  matrix by reading: anonymous 401 (`OnChallenge`), editor/HR/no role 403 (`OnForbidden`),
  must-change admin 403 `password_change_required`, deactivated 401 (`SessionCheck`), admin
  through. `CareersTests.Authorization_matches_for_every_endpoint` walks both new routes
  unchanged: admin gets 404/415 (not 403), editor and must-change 403 (`EditorBlocked`
  covers `/api/v1/users`), HR and none 403, deactivated 401. T11 and T14 pin it. Run
  **PENDING**.
- **Lock ordering (C6), confirmed by reading.** `ChangeRoleAsync`: transaction 50, lock 51,
  503 on failure 52; target `FindByIdAsync` 55, `GetRolesAsync` 58, deactivated 63, admin
  count 70-71 (others than the target, active), `EnsureActorAsync` 77. Before the lock only
  the role check (41-43) and own-id check (46-47), which read nothing. `ReactivateAsync`:
  transaction 113, lock 114, `EnsureActorAsync` 116, target 120, roles 123. Every read that
  decides is inside the lock. Implementation section 8's numbers are right.
- **Actor re-check with fresh reads.** `EnsureActorAsync` (179-193): `db.Users.AsNoTracking()`
  by id and a new `UserRoles` join `Roles` query, both `AsNoTracking`; null, deactivated or
  non-admin gives 403 `forbidden` with `OnForbidden`'s text. Nothing earlier in the request
  tracks the actor (SessionCheck projects).
- **Self-change refusal.** Ordinal compare with the token's `sub` (46-47). Bypassable with a
  non-canonical id: Finding 1.
- **Sessions.** Role change: `RemoveFromRolesAsync`, `AddToRoleAsync`,
  `UpdateSecurityStampAsync`, `RevokeUserAsync(id, null)`, all in the transaction; every
  failed `IdentityResult` returns before commit and the `await using` rolls back.
  Reactivate: stamp rotated (145), `RevokeUserAsync` (155); tokens revoked at deactivation
  stay revoked. A racing refresh's token carries the old stamp, so `SessionCheck` refuses
  it (T13's design is right: it is also red for a revoke-only fix).
- **Temporary password.** A local, returned once in the body; audit detail is the role only
  (158); no logger, cache or Studio storage touches it (`studio/src/api/http.ts` has no
  `console`, storage or cache; `UsersPage` holds it in state only, as reset does).
  `SensitiveDestructuringPolicy` already names `temporaryPassword`. T10 proves it against
  the app's own sink at Verbose. Run **PENDING**.
- **no-store.** Set on the reactivate 200 before the result runs (`UserAccessController.cs:34-35`);
  nothing in the codebase rewrites `Cache-Control` (`grep -rn CacheControl`: this line only).
- **4 KB limits.** `RequestBodyLimitMiddleware` runs before authentication and the
  duplicate guard (`Program.cs` order), refuses `Content-Length > 4096` with 413 problem
  JSON, and caps a streamed body. The role body also refuses `role`/`Role` (400
  `duplicate_field`).
- **Audit.** `change_user_role` with `"<old> -> <new>"`, `reactivate_user` with the role,
  actor id from the token; none for refusals or a same-role no-op.
- **Error bodies.** All refusals go through `AdminResponse.From` / `ProblemResults`:
  `application/problem+json`, `type` RFC 7807, `title`, `status`, `code`; validation adds
  `errors.role`. No exception text or SQL reaches a body.
- **Host checks.** The website is a static export: `website/out/web.config` has no rule that
  proxies `/api`, and there is no `out/api`, so the website's host answers 404 for
  `/api/v1/users/...` (by reading the built config; IIS not run). The API has no host
  routing (`AllowedHosts: "*"`), unchanged.
- **Unknown fields.** Ignored, not rejected: Finding 3 (pre-existing, project-wide).
- **Data/migrations/grants.** No migration, no package, no lockfile, no grant.
- **Secrets.** `git diff 804e85f 2b81b04` scanned for connection strings, keys and password
  literals: only the faked `"Tmp-Pass-1234!ab"` in the Studio unit test. Nothing printed.

### 5. Security tools

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, Studio, full tree | `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| npm audit, website, full tree | `cd website && npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (`fast-uri 3.0.0 - 3.1.8`, GHSA-w74x-v6f9-j3xg and three more). Below the high gate; no website file or lockfile changes in this change |
| npm audit gate, both apps | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` / `studio` | 0 / 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| dotnet audit | `.github/security/run-dotnet-audit.sh` | NOT RUN | No dotnet. No package changed. **PENDING**, `security.yml` job `dotnet-vulnerable` |
| Semgrep | `.github/security/run-semgrep.sh` | NOT RUN | Not installed. **PENDING**, `security.yml` job `semgrep` (and `codeql.yml`) |
| gitleaks | `.github/security/run-gitleaks.sh` | NOT RUN | Not installed. **PENDING**, `security.yml` jobs `gitleaks-pr`, `gitleaks-history` |

### 6. The two UsersPage additions the developer flagged (implementation 3.1 item 1)

Verified the cause: `studio/node_modules/@rc-component/util/lib/hooks/useId.js:56-57`
returns `'test-id'` when `NODE_ENV === 'test'`. Judgement: **acceptable.**

- `id={`user-role-${row.id}`}` on the row selects adds an attribute only; nothing visible.
- `destroyOnHidden` on the create and confirmation modals (a documented antd 6 prop, already
  used in `PreviewDrawer.tsx`): the create form's values are React state, so reopening the
  modal shows the same values as before; the confirmation modal keeps its text while closing
  (`lastPending`). No visible or behavioural difference for a user.
- Neither weakens a test; no test was changed to pass.
- One undeclared screen change was found next to them: Finding 2.

### 7. Beyond the plan

By reading (no server to send requests to):

- **Non-canonical ids**: Finding 1.
- Empty body `PUT .../role` with no content type: 415 from MVC (problem JSON); `{}`: 400
  `validation_failed`, `errors.role` (`Role` defaults to `""`); `{"role":null}`: same.
  `{"role":"Admin"}`: 400 (`IsKnown` is ordinal).
- Same role on a multi-role user: treated as a change (count is not 1), consistent.
- Two reactivations of one user at once: serialised by the lock; the second gets 400
  `already_active`. Role change racing a reset (no lock on reset): `ConcurrencyStamp` gives
  `ConcurrencyFailure`, mapped to 409; C7 item 3 still needs a run (**PENDING**).
- Last-admin with a stale actor (T3) and the actor counted (normal case): the guard cannot
  leave zero active admins through these two routes; it uses canonical `user.Id`, so even
  Finding 1's self-target is refused when the actor is the last admin.
- Deactivate racing a demotion: still possible until ADM-04b (accepted at gate 1, C10).
- Observation, not a finding: `EnsureActorAsync` does not check the actor's own security
  stamp or live family, so an admin whose password is reset while a request waits on the
  lock can still finish it. Out of the plan's F-6 scope (demoted or deactivated).

### Findings

Most severe first. No Blocker, no Major.

**1. Minor. `cannot_change_own_role` can be bypassed with a non-canonical id.**
- Steps: admin A (with another active admin present) sends
  `PUT /api/v1/users/<A's id>%20/role` `{"role":"editor"}` (trailing space; or A's id in
  upper case under the database's case-insensitive collation).
- Expected: 400 `cannot_change_own_role` (B3, plan 3.1 step 2).
- Actual (by reading, not run): step 2 compares `id` and `actorId` ordinally
  (`UserAccessStore.cs:46`), so it passes; `FindByIdAsync` matches A's row because SQL
  Server's `=` ignores trailing spaces under any collation (the codebase says so itself,
  `ContentModelBuilder.cs:93-94`) and the column collation ignores case; the guard and
  `EnsureActorAsync` pass; A is demoted and A's own sessions are revoked. No privilege is
  gained and the last-admin guard still holds, hence Minor. `DeactivateUserAsync`'s
  `cannot_deactivate_self` has the same pattern (pre-existing, `AdminStore.cs`, ADM-04b's).
- Suggested direction for the developer (not a fix): compare the actor with the loaded
  `user.Id`, or refuse an id that is not the canonical form, with a red test first.

**2. Minor. An undeclared visual change on User Management.**
- The Role column width changes from 100 to 130 (`UsersPage.tsx`, `width: 130`). Plan 3.2:
  "Nothing else on the screen changes"; implementation 3.1 lists the screen choices but not
  this one.
- Expected: either no change, or the change stated for gate 2. Actual: unstated. It is
  needed to fit a select and is harmless; it needs a line in `implementation.md`, not code.

**3. Minor (pre-existing, project-wide, not introduced here). Unknown JSON fields are ignored.**
- `PUT /api/v1/users/{id}/role` `{"role":"editor","extra":1}` is accepted (by reading: no
  `UnmappedMemberHandling` anywhere in `api/src`). Every typed body in the API behaves the
  same. Only `role` is bound, so there is no mass assignment. Not for this change to fix;
  noted for the owner's list.

### Coverage rows verified this round

| Item | Status | Evidence |
| --- | --- | --- |
| User Management: role change with confirmation | Verified | S1, S2, S4 red at `486588c`, green at `2b81b04` (three runs) |
| User Management: Reactivate on inactive rows | Verified | S5 red at `486588c`, green at head |
| User Management: a deactivated email offers Reactivate | Verified | S6 red, S7 green at `486588c`; both green at head |
| Own row and inactive rows keep the chip | Verified | S3 green at both |
| Lock first, reads inside it, actor re-read fresh (C6) | Verified by reading | Section 4 line numbers |
| Role change revokes tokens and rotates the stamp; reactivation does not revive sessions | Verified by reading; tests PENDING | Section 4; T2, T5, T13 in CI job `api` |
| Temporary password in no log or audit row; `no-store` | Verified by reading; tests PENDING | Section 4; T4, T10 |
| Admin-only routes | Verified by reading; tests PENDING | T11, T14, `CareersTests` |
| 4 KB caps, duplicate keys | Verified by reading; tests PENDING | T6, T7 |
| Copied helpers listed for ADM-04b (C8) | Verified | `AdminStore.cs` 453, 467, 858, 861, 1064, 1079, 1082, 1089 match; `AdminStore.cs` unchanged from `2bbd586` |
| Decision O-15, no delete | Verified | No delete route or code in the diff |
| Base merged, not rebased; scope limited to the plan's files | Verified | `is-ancestor` exit 0; `git diff --stat 804e85f 2b81b04` |
| Website unchanged and green | Verified | Section 2 (compare:sections PENDING) |
| API tests T1 to T16, E1, red at `bf634e2` and green at head; C5 three runs; C7; Release warnings | **PENDING** | CI jobs `api`, `studio` (Actions blocked by billing) |
| Green in every workflow on the final head | **PENDING** | `ci.yml`, `security.yml`, `codeql.yml`, `workflow-lint.yml` |

### Verdict reasoning

The code, by reading, does what the plan and C1 to C12 ask, and I found no Blocker or Major.
I cannot approve it: the API suites, E1, the red at `bf634e2` (C4, O-ADM04-3), C5 and C7
have never run, and the C# has never been compiled. Nothing in this change can make them
run. They wait on the owner's GitHub Actions billing problem (or on a machine with .NET 10
and SQL Server for C4 option (b), which the coordinator would have to arrange). Findings 1
and 2 go back to the developer. They do not block on their own.

Verdict: BLOCKED ON OWNER
