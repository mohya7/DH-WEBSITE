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

Round 1 verdict, superseded by Round 2: BLOCKED ON OWNER (GitHub Actions billing).

## Round 2

Tester, 19 November 2026. The owner's instruction today was "continue" (resume after the
CI billing block), as relayed by the orchestrator. The change, as `plan.md` round 3 states
it: "**One change: an admin can change a Studio user's role and reactivate a deactivated
user, from the API and from User Management.** The last-admin guard is kept. A role change
ends the user's sessions and invalidates their tokens. This closes ADM-04."

**Commit tested: `ca39aab85dff355d5765996984458ce5588d4d37`**, the head of `change/ADM-04`
and of PR #58 (`gh pr view 58 --json headRefOid,isDraft` -> `ca39aab...`, draft). It
merges the base `793c43e` (#62, #63, #64) into the developer's `75ec041`. Detached
worktree `D:\work\DigitalHub\dh-platform-claude-adm-04-test`
(`git worktree add --detach ... ca39aab`), removed afterwards. The rework was read from
`implementation.md` section 4a and commits `deff0ce`, `81b951b`, `4ee09eb` and `75ec041`.

**What ran where.** This machine has .NET 10.0.401 and SQL Server. The orchestrator
forbade any local database reset or write (the local e2e harness fails at "Release
migrations"), so every local API test and every local Playwright run is **NOT RUN**. The
evidence for them is CI, read with `gh api --allow-escape-sequences
repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs` and from the `api-test-report` TRX and
`studio-e2e-report` artifacts. The Studio and website suites, the audits and Semgrep ran
locally on `ca39aab`.

CI runs used (`gh api "repos/mohya7/DH-WEBSITE/actions/runs?head_sha=<sha>"`):

| Commit | Run | Workflow | Conclusion |
| --- | --- | --- | --- |
| `bf634e2` (commit 1, red) | `43249521862` | CI | failure (the red, expected) |
| `bf634e2` | `43249521507` / `43249521539` / `43249522272` | Security / CodeQL / Workflow lint | success |
| `75ec041` | `43251155171` | CI | failure (`studio`: `redirects.spec.ts` only, see 2.3) |
| `75ec041` | `43251155268` / `43251155252` / `43251155160` | Security / CodeQL / Workflow lint | success |
| `ca39aab` (head) | `44413964896` | CI | success |
| `ca39aab` | `44413964873` / `44413965147` / `44413964847` | Security / CodeQL / Workflow lint | success |
| `486588c`, `1806847`, `1b947f5`, `2b81b04`, `55e77ee`, `deff0ce`, `81b951b`, `4ee09eb` | none | | No run exists on any of these SHAs |

### 1. The rework (round 1 findings)

| Round 1 finding | Developer's answer | My check | Result |
| --- | --- | --- | --- |
| 1. Minor. `cannot_change_own_role` bypassed by another spelling of the actor's id | T17 `An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id` (`deff0ce`, test only) sends the actor's own id upper-cased and with a trailing `%20`. It expects 400 `cannot_change_own_role` and roles `["admin"]` unchanged. Fix `81b951b`: after `FindByIdAsync`, inside the lock, `string.Equals(user.Id, actorId, StringComparison.Ordinal)` -> `OwnRole()`. The early check on the id as typed stays | Read `git show 81b951b` (8 lines, `UserAccessStore.cs` only) and T17. The check compares the canonical loaded id, before any read that decides and before any write. The test commit comes before the fix commit (B-6). **Green:** T17 `Passed` in CI at `75ec041` (job `131296988376`) and at `ca39aab` (job `135189207254`, line 642: `Passed ...An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id [212 ms]`). **Red: never shown.** There is no run on `deff0ce` and no local run (Finding R2-1) | Fixed; red evidence missing |
| 2. Minor. Role column width 100 -> 130 not declared | Declared as `implementation.md` 3.1 item 10; no code change | `git diff 793c43e ca39aab -- studio/src/pages/UsersPage.tsx`: the only layout lines are `width: 130` on the Role column and `style={{ width: "100%" }}` on the select inside it. Nothing else visual changes | Accepted, closed |
| 3. Minor, pre-existing. Unknown JSON fields are ignored | Left as project-wide | Already tracked as GAP-25 at `refinement-plan-2026-10-28.md:96`: "A test proves every request body on the route list rejects unknown fields" (Wave 3). No D-NNN entry is needed | Moved: GAP-25 |
| `75ec041`: a secure suffix for E1 (CodeQL alert 1, `Math.random()`) | `crypto.randomUUID().slice(0, 8)` replaces `Math.random().toString(36).slice(2, 6)` in E1's stamp | `git show 75ec041`: one line in `studio/e2e/users.spec.ts`, a test file only. `grep Math.random` over the ADM-04 test files finds nothing. `gh api ".../code-scanning/alerts?per_page=50&state=open" --jq length` -> `0`. CodeQL (javascript-typescript) on `ca39aab`: success; its 4 annotations are all workflow notices. E1 passes with the change at `75ec041` and at `ca39aab` | Accepted. Not recorded in `implementation.md` (Finding R2-5) |

### 2. Every check round 1 left PENDING, from CI

#### 2.1 Red at commit 1, `bf634e2` (C4, O-ADM04-3)

Job `API — Release build, migrations, integration tests`, `131291177629`:

- Build: `Build succeeded.` `13 Warning(s)` `0 Error(s)` (log lines 283-299). The three
  new test files compile against the base, as the plan expected.
- TRX (`api-test-report` artifact `13957688523`): `total 561, passed 546, failed 15`.
  Console: `Test Run Failed.` `Total tests: 561` `Passed: 546` `Failed: 15`.
- The 15 failures are exactly T1 to T11 and T13 to T16. Each fails at its first status
  assertion or at the step the plan names:

| Id | Test | Failure message at `bf634e2` | As planned |
| --- | --- | --- | --- |
| T1 | `An_admin_changes_an_editors_role_and_it_is_audited` | `change editor to admin: 404` | Yes |
| T2 | `A_role_change_ends_the_users_sessions` | `change editor to hr: 404` | Yes |
| T3 | `The_last_active_admin_keeps_the_admin_role` | `demote the last active admin: 404` | Yes |
| T4 | `Reactivation_brings_a_user_back_with_a_new_temporary_password` | `reactivate: 404` | Yes |
| T5 | `Reactivation_does_not_revive_old_sessions` | `reactivate: 404` | Yes |
| T6 | `Reactivating_an_active_or_unknown_user_is_refused` | `reactivate an active user: 404` | Yes |
| T7 | `A_role_change_checks_its_input` | `role viewer: 404` | Yes |
| T8 | `An_admin_cannot_change_their_own_role` | `change own role: 404` | Yes |
| T9 | `A_role_change_waits_for_the_users_lock_and_then_refuses_as_busy` | `change a role while the lock is held: 404` | Yes |
| T10 | `A_reactivation_password_appears_in_no_application_log_event_and_no_audit_row` | `reactivate: 404` (the status, not an empty sink) | Yes |
| T11 | `Editors_and_HR_cannot_change_roles_or_reactivate` | `adm04-t11-editor-98b53974@digitalhub.test changes a role: 404` (404, not 403: there is no route yet, as round 1 read it) | Yes |
| T13 | `A_refresh_that_races_a_role_change_cannot_keep_the_old_role` | `change editor to hr: 404` | Yes |
| T14 | `A_demoted_or_deactivated_admin_cannot_finish_a_users_change` | `a demoted admin promotes: 404` | Yes |
| T15 | `Two_admins_demoting_each_other_at_once_leave_one_admin` | `Expected exactly one 200: 404 \| 404`; the TRX timeline ends `Matched 0` | Yes |
| T16 | `An_admin_deactivated_while_their_role_change_waits_cannot_finish_it` | `B's role change never reached X's roles read inside the users lock (Matched 0); the route, the store or the read is not where the plan puts it.` | Yes |
| T12 | `Creating_a_deactivated_email_is_still_email_taken` | `Passed [165 ms]` (log line 677) | Green, as planned |

- Every other test passed (546 = 545 base tests + T12), including
  `CareersTests.Authorization_matches_for_every_endpoint` (`Passed [1 s]`, line 4755).
- Job `Studio`, `131291176641`, at `bf634e2`: unit tests `Test Files 13 passed (13)`,
  `Tests 98 passed (98)` (S1 to S7 are not in commit 1). End-to-end:
  `✘ 21 e2e/users.spec.ts:34:1 › ADM-04 users: change a role, deactivate, reactivate (1.5m)`,
  `Test timeout of 90000ms exceeded.` The step it was blocked on comes from the
  `studio-e2e-report` artifact `13958594045`. The last action in `test.trace` is
  `Click locator('.ant-table-tbody tr.ant-table-row').filter({ has: getByRole('cell', { name: 'e2e-adm04-mwdpud9xv45m@digitalhub.test', exact: true }) }).getByRole('combobox', { name: 'Role for e2e-adm04-mwdpud9xv45m@digitalhub.test' })`.
  `error-context.md` shows the row as
  `row "e2e-adm04-mwdpud9xv45m@digitalhub.test editor Active Reset password Deactivate"`,
  with no combobox. **E1 is red at step 2, as planned.**
- At `bf634e2` one existing spec also failed:
  `✘ 8 e2e/redirects.spec.ts:37:1 › ADM-07 redirects ...` (a test timeout during its
  clean-up). That is the base's ADM-07 flake, which #62 (ADM-07c, now on the base) fixed.
  It passes at the head (2.3). ADM-04 did not cause it: commit 1 has no redirect file. The
  result line was `2 failed`, `31 passed (7.1m)`.
- Job `Website` at `bf634e2`: success. Section comparison: success.
- C4's ordering: the red run was created at 15:35:53 UTC. Its `api` job finished at
  15:38:42 and `studio` at 15:44:28. The next push (the run for `75ec041`) was created at
  15:45:01. Commit 1 was not amended (`bf634e2` is an ancestor of the head).

**C4 is met** for T1 to T11, T13 to T16 and E1 (each red at the planned step), with T12
green. Round 1 showed S1, S2 and S4 to S6 red and S3 and S7 green locally at `486588c`.
**T17's red is not shown** (Finding R2-1).

#### 2.2 Green at the head, `ca39aab` (job `api`, `135189207254`)

- `dotnet build DigitalHub.slnx -c Release`: `Build succeeded.` `13 Warning(s)`
  `0 Error(s)` (lines 264-280). All 13 are `CS8601`/`CS8604` in
  `api/tools/DigitalHub.ContentImport/ContentWriter.cs`; none is in an ADM-04 file.
  **C9: no more than the base's 13.** The same holds at `75ec041` (`13 Warning(s)`,
  `0 Error(s)`).
- The migrations step and the migration checks are green (this change has no migration).
- `dotnet test ... -c Release --no-build`: `Total tests: 562` `Passed: 562` (lines
  5515-5516). The TRX gives `total 562, executed 562, passed 562, failed 0`. 562 = 545 base
  tests + T1 to T17. No test that passed at the base fails.
- Every ADM-04 API test, by name, at `ca39aab`:

| Id | Test | Result |
| --- | --- | --- |
| T1 | `An_admin_changes_an_editors_role_and_it_is_audited` | Passed [183 ms] |
| T2 | `A_role_change_ends_the_users_sessions` | Passed [274 ms] |
| T3 | `The_last_active_admin_keeps_the_admin_role` | Passed [310 ms] |
| T4 | `Reactivation_brings_a_user_back_with_a_new_temporary_password` | Passed [342 ms] |
| T5 | `Reactivation_does_not_revive_old_sessions` | Passed [342 ms] |
| T6 | `Reactivating_an_active_or_unknown_user_is_refused` | Passed [276 ms] |
| T7 | `A_role_change_checks_its_input` | Passed [317 ms] |
| T8 | `An_admin_cannot_change_their_own_role` | Passed [66 ms] |
| T9 | `A_role_change_waits_for_the_users_lock_and_then_refuses_as_busy` | Passed [5 s] |
| T10 | `A_reactivation_password_appears_in_no_application_log_event_and_no_audit_row` | Passed [374 ms] |
| T11 | `Editors_and_HR_cannot_change_roles_or_reactivate` | Passed [461 ms] |
| T12 | `Creating_a_deactivated_email_is_still_email_taken` | Passed [205 ms] |
| T13 | `A_refresh_that_races_a_role_change_cannot_keep_the_old_role` | Passed [356 ms] |
| T14 | `A_demoted_or_deactivated_admin_cannot_finish_a_users_change` | Passed [381 ms] |
| T15 | `Two_admins_demoting_each_other_at_once_leave_one_admin` | Passed [5 s] |
| T16 | `An_admin_deactivated_while_their_role_change_waits_cannot_finish_it` | Passed [448 ms] |
| T17 | `An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id` | Passed [212 ms] |
| | `CareersTests.Authorization_matches_for_every_endpoint` (unchanged; it walks both new routes) | Passed [1 s] |

- The plan's filter run (5.3) and three `UserRoleConcurrencyTests` runs in a row:
  **NOT RUN** locally, because no database writes are allowed. The full CI run contains
  every class in the filter, and all of them passed.

#### 2.3 Studio and E1 at the head (job `studio`, `135189207708`)

- `npm ci` and `npx tsc -b`: green. `npm test`: `Test Files 14 passed (14)`,
  `Tests 105 passed (105)`.
- `npm run build`: `✓ built in 938ms`,
  `Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.`
- `npx playwright test`: `33 passed (3.4m)`, 0 failed. This includes
  `✓ 21 e2e/users.spec.ts:34:1 › ADM-04 users: change a role, deactivate, reactivate (6.1s)`,
  `✓ 8 e2e/redirects.spec.ts:45:1 › ADM-07 redirects ...`, and every `studio.spec.ts`,
  `verification.spec.ts` and `appearance.spec.ts` test (among them P2.11 "The editor has
  no User Management" and 10.17 "an editor does not see admin screens and admin APIs
  return 403").
- At `75ec041` (run `43251155171`): E1 shows `✓ ... (6.6s)`. The job failed only on
  `✘ 8 e2e/redirects.spec.ts:37:1` (the base flake: `1 failed`, `32 passed`), which #62
  fixed on the base. It is green at the head.

#### 2.4 C5: T15 and T16 timelines (R3-1)

These come from the TRX `StdOut` in artifacts `14478142634` (at `ca39aab`) and
`13959029612` (at `75ec041`). The API source is identical between the two commits
(`git diff --stat 75ec041 ca39aab -- api` is empty).

Run 1, `75ec041`, T15:
```
15:46:49.518 warm-up: 2 authenticated requests, Matched 0
15:46:49.521 sent: A demotes B
15:46:49.522 sent: B demotes A
15:46:49.540 users lock requested (sp_getapplock)
15:46:49.540 users lock requested (sp_getapplock)
15:46:49.551 matched [@userId=3ba058ac-...]: SELECT [a0].[Name] FROM [AspNetUserRoles] AS [a] INNER JOIN [AspNetRoles] AS [a0] ON [a].[RoleId] = [a0].[Id] WHERE [a].[UserId] = @userId
15:46:51.710 answered: A demotes B: 200
15:46:51.725 answered: B demotes A: 403
Matched 1; gate cap 2000 ms.
```
T16 in the same run: `warm-up ... Matched 0`; `users lock requested` at 52.187;
`matched [@userId=...]` at 52.188 (the same `[AspNetUserRoles]` SQL);
`B deactivated in the database while held` at 52.239;
`answered: B changes X to hr: 403`; `Matched 1`.

Run 2, `ca39aab`, T15:
```
22:43:10.866 warm-up: 2 authenticated requests, Matched 0
22:43:10.869 sent: A demotes B
22:43:10.870 sent: B demotes A
22:43:10.887 users lock requested (sp_getapplock)
22:43:10.887 users lock requested (sp_getapplock)
22:43:10.897 matched [@userId=e1ae1d70-...]: SELECT [a0].[Name] FROM [AspNetUserRoles] AS [a] INNER JOIN [AspNetRoles] AS [a0] ON [a].[RoleId] = [a0].[Id] WHERE [a].[UserId] = @userId
22:43:12.980 answered: A demotes B: 200
22:43:12.996 answered: B demotes A: 403
Matched 1; gate cap 2000 ms.
```
T16 in the same run: `users lock requested` at 13.416; `matched` at 13.417;
`B deactivated in the database while held` at 13.468;
`answered: B changes X to hr: 403`; `Matched 1`.

Both runs count as evidence under C5. In each, the two "users lock requested" lines fall
in the same millisecond, before the match is released (about 2.08 s later, at the cap),
and only the store's `[AspNetUserRoles]` read matched. **That is two runs, not the three
consecutive runs that C5 and 5.3 require** (Finding R2-2).

#### 2.5 C7 (Identity facts)

1. `GetRolesAsync` SQL names `[AspNetUserRoles]` with the user id as a parameter:
   **shown** (the `matched [@userId=...]` lines above). It is shown at `75ec041` and
   `ca39aab`, not at `1806847`, which has no run. The store's call to `GetRolesAsync` is
   the same at all three; `81b951b` only added the own-id check.
2. The warm-up shows `Matched 0`: **shown**
   (`warm-up: 2 authenticated requests, Matched 0`, in both tests and both runs).
3. A stale `ConcurrencyStamp` yields `ConcurrencyFailure`: **not shown anywhere**. There
   is no test output and no scratch run (Finding R2-3).

### 3. The plan's test plan (5.3, 5.4), run locally on `ca39aab`

| Suite | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| Studio install | `cd studio && npm ci` | 0 | `found 0 vulnerabilities` |
| Studio typecheck | `cd studio && npx tsc -b` | 0 | |
| Studio unit | `cd studio && npm test` | 0 | `Test Files 14 passed (14)`, `Tests 105 passed (105)` |
| S1 to S7, three runs | `cd studio && npx vitest run test/users.test.tsx`, three times | 0, 0, 0 | `Tests 7 passed (7)` each time |
| Studio build | `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built in 784ms`; `Preview design: ... matches website/design/ byte for byte.` |
| Studio end-to-end | `cd studio && npm run test:e2e` | NOT RUN | No local database reset or write is allowed, and the local harness is broken. Covered by CI job `studio`: `33 passed` (2.3) |
| Website install | `cd website && npm ci` | 0 | |
| Website typecheck | `cd website && npm run typecheck` | 0 | |
| Website unit | `cd website && npm test` | 1, then 0 | First run: `Tests 20 failed \| 441 passed \| 1 skipped (462)`. All 20 failures are in `test/screenshot-parity-browser.test.ts` ("the register guard in Chromium (local only)"), caused by `Error: listen EADDRINUSE: address already in use 127.0.0.1:4284`. Run alone, `npx vitest run test/screenshot-parity-browser.test.ts` exits 0 with `Tests 30 passed \| 1 skipped (31)`. Rerunning `npm test`: exit 0, `Test Files 24 passed (24)`, `Tests 461 passed \| 1 skipped (462)`. The failures were a transient port clash in a local-only suite, and this change has no website file. CI job `website`: `Test Files 23 passed \| 1 skipped (24)`, `Tests 431 passed \| 31 skipped (462)` |
| Design check | `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| Website build | `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 1, then 0 | The first run generated every page, then Next.js 16.4.3 stopped with `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.` and an upgrade prompt addressed to an agent. I did not act on the prompt; changing code is not the tester's job. Rerunning the same command: exit 0, `Redirect targets: all 0 resolve to a page.`, `Build output checks passed.` See section 5 for the new moderate Next.js advisories |
| Section comparison | `npm run compare:sections` | NOT RUN locally | It reads the read-only reference checkout, which I did not open from here. CI job `section-compare` at `ca39aab`: success, `104/119 sections match; 14 accepted; 1 failures (including chrome).`, `differs: /careers/apply.html #section`. The output is identical at `bf634e2`, so it is the base's state; this change has no website file |
| Website browser | `npm run test:browser` | NOT RUN locally | CI job `website-browser` at `ca39aab`: success, `browser suite: 29 tests; default 4 passed, 25 skipped as expected; consent 28 passed, 1 skipped as expected; 0 failures` |
| Screenshot parity | `compare:screenshots` | NOT RUN | CI job `screenshot-parity` is optional (label "screenshots") and was skipped on every run. No website file changes |
| API build, tests, filter, three concurrency runs | plan 5.3 | NOT RUN locally | No database writes allowed. Covered by CI job `api` (2.2, 2.4) |

### 4. Track checklist (G3)

| Rule | State |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Met. Change role with the guard (T1, T3, T15); reactivate (T4, T5); O-15 "No, deactivate is enough" (no delete code); the UI (S1 to S7, E1) |
| The regression test is committed and shown failing before the fix | Met for the audit item: T1 to T11, T13 to T16 and E1 are red in CI at `bf634e2` at the planned steps (2.1), and S1, S2 and S4 to S6 were red at `486588c` (round 1). Not met for T17, the rework's regression test (Finding R2-1) |
| The end-to-end suite gets a test for each Major | ADM-04 is a Blocker. E1 is red at `bf634e2` step 2 and green at `75ec041` and `ca39aab` |
| A Minor that is not fixed becomes a D-NNN entry | Round 1 finding 3 is already GAP-25 in the refinement plan. The round 2 Minors go back to the developer |

### 5. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, Studio, full tree | `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| npm audit, website, full tree | `cd website && npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities`: `fast-uri` (as in round 1) and, **new**, `next 16.2.0 - 16.4.4` (GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8, `'use cache'` cache leaks; the site is a static export). Both are below the high gate, and this change has no website file or lockfile. For the owner's list, not for this change |
| npm audit gate | `cd website && RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website`; the same for `studio` | 0 / 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| dotnet audit gate | `cd api && RUNNER_TEMP=<scratch> bash ../.github/security/run-dotnet-audit.sh` | 0 | `DigitalHub.Api`, `DigitalHub.Api.Tests`, `DigitalHub.ContentImport`: `has no vulnerable packages`; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` (semgrep 1.180.0) | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known `AuditRollbackTests.cs:78`). No result is in an ADM-04 file. `UserAccessController.cs` (primary constructor) and `users.test.tsx` (`>()`) are only partly parsed, as are 37 other files; CI job `135189420745` reports the same |
| gitleaks | `.github/security/run-gitleaks.sh` | NOT RUN | Not installed. CI `security.yml` covers it: `gitleaks-pr` (`135189420792`): `no leaks found`, `pr-diff: 0 finding(s) at the gate's level; 0 known, 0 new.` `gitleaks-history` (`135189420809`): `full-history: 2 finding(s) at the gate's level; 2 known, 0 new.` (both in files that predate this change) |
| CodeQL | CI `codeql.yml`, run `44413965147` | success | 0 open code-scanning alerts on the repository (`gh api .../code-scanning/alerts?state=open` -> `0`) |

Both new routes are under `[Authorize(Policy = "studio-admin")]` (read at `ca39aab`):

| Caller | `PUT /api/v1/users/{id}/role` | `POST /api/v1/users/{id}/reactivate` | Evidence |
| --- | --- | --- | --- |
| Anonymous | 401 by reading (no `AllowAnonymous`; `OnChallenge`) | 401 by reading | **No test** (Finding R2-6) |
| Editor, HR | 403 | 403 | T11 passed; `CareersTests.Authorization_matches_for_every_endpoint` passed |
| No role, must-change admin | 403 | 403 | `CareersTests...every_endpoint` passed |
| Deactivated | 401 | 401 | `CareersTests...every_endpoint`; T14 lines 540-541 |
| Admin demoted or deactivated in flight | 403 `forbidden` | 403 (for reactivate, by reading only: R3-2, accepted at gate 1) | T14, T15, T16 passed |
| Admin, own record | 400 `cannot_change_own_role`, whatever the spelling | 400 `already_active` | T8, T17 passed |
| Admin, unknown or role-less record | 404 | 404 | T6, T7 passed |
| Admin, deactivated record | 400 `user_deactivated` | 200 with `no-store` | T7, T4 passed |

- Host check: the website is a static export. My build's `website/out/web.config` has
  only the `{R:1}.html` rewrite and the CSP headers, with no `/api` proxy, and there is no
  `out/api`. So the website's host answers 404 for `/api/v1/users/...`. This change does
  not alter that.
- Unknown fields: ignored, project-wide (GAP-25). Only `role` binds.
- Body caps: 413 over 4 KB on both routes (T6 and T7 passed; the CI log shows
  `PUT .../role responded 413`). Duplicate keys: 400 `duplicate_field` (T7).
- Error shape: refusals go through `AdminResponse.From` (problem JSON with `code` and
  `errors.role`), and T7 parses `errors.role`. The response bodies visible in the logs
  show no internals.
- Proof of what the permission change cannot do: T8, T11, T14, T15, T16 and T17, plus T3
  for the last-admin guard.
- Secrets: I scanned `git diff 793c43e ca39aab -- api studio` for keys, connection
  strings, tokens and password literals. The only hits are the fake `"Tmp-Pass-1234!ab"`
  in the Studio unit test and T9 reading `ConnectionStrings:Content` from configuration
  (never printed). T10 passed: no temporary password appears in any log event or audit
  row. This report quotes no secret.

### 6. The base merge (`ca39aab`)

- Parents: `75ec041` and `793c43e` (`git log -1 --format=%P ca39aab`).
  `git merge-base --is-ancestor 793c43e ca39aab`: exit 0. It is a merge, not a rebase.
- `git diff --name-only 75ec041 ca39aab` (27 files) is exactly
  `git diff --name-only 2bbd586 793c43e` (27 files): `comm -23` is empty.
- No file that ADM-04 changed is among the base's 27: `comm -12` of
  `git diff --name-only 2bbd586 75ec041` and the base list is empty, and
  `git diff --stat 75ec041 ca39aab -- <every ADM-04 file>` is empty.
- At the head, the base's own files equal the base:
  `git diff --stat 793c43e ca39aab -- <the base's 27 files>` is empty.
- `git diff --name-only 793c43e ca39aab` lists only the plan's 10 code files and
  `docs/changes/ADM-04/*`. **The merge changes nothing in ADM-04's files.**

### 7. Beyond the plan

- Anonymous callers on the new routes: untested (Finding R2-6).
- The red at `deff0ce`: the claim that T17 is red ("expected: 200 for the upper-case
  spelling") is a reading, never a run (Finding R2-1). My own reading agrees (an ordinal
  compare of the typed id, and `FindByIdAsync` matching regardless of case), but a
  reading is not evidence.
- A role change racing a password reset (reset takes no lock) depends on C7 item 3
  (Finding R2-3). The write is inside the transaction either way, so if the mapping is
  wrong the effect is the answer code (409 or 400), not a half-written role.
- PR #58 is still the red-first draft (Finding R2-4).
- New moderate Next.js advisories, website only and below the gate: for the owner's
  list.

### Findings

Most severe first. There is no Blocker and no Major. Findings R2-1 to R2-3 are planned
evidence that does not exist yet, so the verdict cannot be APPROVED until it is supplied.

**R2-1. Minor (planned evidence missing). T17 has never been shown red.**
- Steps: `gh api "repos/mohya7/DH-WEBSITE/actions/runs?head_sha=$(git rev-parse deff0ce)"`
  -> no runs. `implementation.md` 4.1 and 4a mark it "PENDING CI ... read from the code,
  not run".
- Expected (P-4, S-3, B-6, the G3 checklist, and the tester's step 1): T17 failing at
  `deff0ce` for the planned reason (200 for the upper-case spelling, the admin demoted),
  quoted from a run.
- Actual: the commit order is right, and T17 is green at `75ec041` and `ca39aab`, but no
  run of `deff0ce` exists. What is missing: a CI run on `deff0ce` (job `api`), or a local
  Release run of `UserRoleAndReactivationTests` at `deff0ce` against
  `DigitalHubContent_Test`, with T17's failure message quoted. This is for the developer;
  I did not create a run.

**R2-2. Minor (gate-1 condition C5 not met). Only two of the three consecutive `UserRoleConcurrencyTests` runs exist.**
- Expected (C5, plan 5.3): three consecutive runs, each quoted with its timeline.
- Actual: two valid runs (CI at `75ec041` and `ca39aab`, section 2.4) and no third. A CI
  re-run of job `api` on the head, or three local filter runs, would supply it.

**R2-3. Minor (gate-1 condition C7 item 3 not met). "A stale `ConcurrencyStamp` yields `ConcurrencyFailure`" is unconfirmed.**
- Expected (C7): confirmed and quoted from output.
- Actual: there is no test, scratch run or output anywhere, and `implementation.md` 7.2
  still lists it as PENDING. `UserAccessStore.Failed` maps that code to 409
  `concurrency_conflict` on this unconfirmed assumption.

**R2-4. Minor (gate-1 condition C10). The PR #58 body is still the red-first placeholder.**
- Steps: `gh pr view 58 --json body,isDraft`.
- Expected (C10): B1 to B10, the "Known exposure until ADM-04b" line, and the three owner
  answers quoted exactly and marked "as relayed by the coordinator" (the text is ready in
  `implementation.md` section 9), under the template's headings.
- Actual: "**Status: draft, red-first.** The head is the tests-only commit `bf634e2` ...
  The full description ... replaces this text then." The head is now `ca39aab`. As it
  stands, the owner would merge without the behaviour changes in front of them.

**R2-5. Minor. `implementation.md` is out of date.**
- Expected: the record matches the branch (P-8).
- Actual: it has no row for `75ec041` (the secure suffix) or for the base merge
  `ca39aab`. The commit table and sections 4.1, 7.2, 10 and 11 still say "Nothing is
  pushed", say no C# has been compiled, and mark as PENDING evidence that CI now has
  (2.1 to 2.5 here).

**R2-6. Minor. No test proves that an anonymous caller is refused on the two new routes.**
- Steps: `grep -n -i "anonym" api/tests/DigitalHub.Api.Tests/UserRoleAndReactivationTests.cs`
  -> nothing. `CareersTests.Authorization_matches_for_every_endpoint` checks admin,
  editor, HR, no-role, deactivated and must-change sessions, but not anonymous.
- Expected (S-3: "a role-matrix entry when a route is involved"; the tester's step 4):
  401 problem JSON for `PUT .../role` and `POST .../reactivate` without a token,
  asserted by a test.
- Actual: 401 by reading only (class-level `[Authorize]`, no `AllowAnonymous`). As far as
  I can read it is not exploitable; what is missing is the evidence.

### Coverage rows verified this round

| Item | Status | Evidence |
| --- | --- | --- |
| An admin can change another user's role (API) | Verified | T1 red at `bf634e2` (404), green at `ca39aab` |
| The last-admin guard holds for role changes | Verified | T3 red, then green |
| Concurrent role changes cannot both pass the guard | Verified (2 of 3 runs) | T15 red, then green twice with valid timelines (2.4); the third run is missing (R2-2) |
| A demoted or deactivated actor cannot finish an in-flight change | Verified | T14, T15, T16 red, then green; reactivate's branch by reading (R3-2, accepted at gate 1) |
| A role change ends the user's sessions, including after a racing refresh | Verified | T2, T13 red, then green; E1 step 3 |
| An admin cannot change their own role | Verified (T17's red missing) | T8 red, then green; T17 green only (R2-1) |
| Reactivation with a new temporary password, `no-store` | Verified | T4 red, then green; E1 steps 5 and 6 |
| Reactivation does not revive old sessions | Verified | T5 red, then green |
| Reactivation refusals, 4 KB caps, duplicate keys | Verified | T6, T7 red, then green |
| The users lock answers busy after 5 s | Verified | T9 red, then green |
| The temporary password is in no log event or audit row | Verified | T10 red (404), then green |
| Editors, HR, no-role, deactivated and must-change users are refused | Verified | T11 and `CareersTests...every_endpoint` green |
| Anonymous callers are refused | By reading only | R2-6 |
| A deactivated email offers Reactivate | Verified | T12 green at both commits; S6 red then green (round 1); E1 step 5 |
| User Management: role change, Reactivate, chip rows | Verified | S1 to S7 (red in round 1; green three times now); E1 red at step 2, green at `75ec041` and `ca39aab` |
| Decision O-15, no delete | Verified | No delete code in `git diff 793c43e ca39aab` |
| Release build warnings no more than the base's 13 (C9) | Verified | 13 at `bf634e2`, `75ec041` and `ca39aab`, all in `ContentWriter.cs` |
| C7 items 1 and 2 | Verified | 2.5 |
| C7 item 3 | Not verified | R2-3 |
| Base merged, not rebased; the merge touches no ADM-04 file | Verified | Section 6 |
| Green on the final head in every workflow | Verified | CI `44413964896`, Security `44413964873`, CodeQL `44413965147`, Workflow lint `44413964847`; screenshot parity skipped (optional) |
| Pull request body (C10) | Not met | R2-4 |

### Verdict reasoning

By reading, the code does what the plan asks, and every test is green on the head in
every workflow. The round 1 findings are answered. The red at `bf634e2` that held up
round 1 is now shown for T1 to T11, T13 to T16 and E1, each at its planned step. I found
no Blocker and no Major. Planned evidence is still missing: T17's red (R2-1), C5's third
run (R2-2) and C7 item 3 (R2-3). The PR body that C10 requires is also missing (R2-4).
These go back to the developer, together with R2-5 and R2-6. Nothing here needs an owner
exception.

Verdict: CHANGES NEEDED
