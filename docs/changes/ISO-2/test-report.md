# ISO-2 test report

## Round 1

- Tester: Claude Code (tester role). I did not build this change.
- Commit tested: `d3b6282aa03e220a6104b9488703b1ad69162fa7` (head of `change/ISO-2`), on base
  `8027e87` (`origin/rebuild/dotnet-platform`). Red commits checked: `7049d28`, `19db9b5`, `30a9018`.
- Where: a detached worktree, `git -C D:\work\DigitalHub\dh-platform worktree add --detach
  D:\work\DigitalHub\dh-platform-claude-iso-2-test d3b6282...`, checked out at each red commit in
  turn and then at the head. It was removed at the end (`git worktree remove --force`, then a
  dangling `studio/node_modules/@digitalhub/theme` junction was deleted without following it;
  `git worktree list` no longer shows it). The developer's worktree was not touched, apart from
  this file. Nothing was committed or pushed.
- Tools: `dotnet` 10.0.401, Release only; Node 24.19.0; Semgrep 1.180.0. gitleaks and actionlint
  are not installed (`command -v` finds neither).
- Databases: only `DigitalHubContent_Test`. The admin and public suites ran one after the other,
  never at the same time. Before each database run,
  `(Get-Process testhost,vstest* | Measure-Object).Count` printed `0`. The only other `dotnet`
  processes were idle MSBuild nodes (`/nodemode:1`), which I left alone. No migration was applied.
  `DigitalHubContent` was never used.
- Ports: 4210, 4211 and 4212 (the public API, for probing), 4221 (section comparison) and 4222
  (website browser tests). I stopped only the three public-API processes I started (PIDs 23516,
  29488 and 24124).
- Secrets: user-secrets were read only into an environment variable for the probe host. The
  connection string was rewritten to `Database=DigitalHubContent_Test`, and only that catalog name
  was printed. No value was printed. Key names only:
  `dotnet user-secrets list --id <admin id> | grep -c '^Auth:SigningKey '` printed `1`, and
  `grep -c '^ConnectionStrings:Content '` printed `1`. So T-I2 ran on a machine whose store does
  hold a signing key.

### 1. The red tests were red, then green

| Commit | Command (from `api/`) | Exit | Result |
|---|---|---|---|
| `7049d28` (1, red) | `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |
| `7049d28` | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~FormsLibraryTests"` | 1 | `[FAIL] FormsLibraryTests.The_guard_rejects_the_authentication_and_identity_assemblies`, `Assert.Contains() Failure: Item not found in collection`, `Not found: "Microsoft.AspNetCore.Identity"`; `Failed: 1, Passed: 2, Total: 3`. This is the planned reason: the old exact-name list misses the F1 assemblies |
| `19db9b5` (4, red) | build, then `dotnet test tests/DigitalHub.PublicApi.Tests/... -c Release --no-build --logger "trx;LogFileName=c4.trx"` | 0, 1 | `Failed: 37, Passed: 34, Total: 71`. The plan's `grep -o 'testName=... outcome=...'` listing, test by test and row by row, equals the 3.9 column-4 table and `implementation.md` section 4: all 13 apply tests, 7 contact tests plus the empty-proxy test, 3 body-limit rows, the rate-limit log test, 4 aborted rows, T-I3, T-I5, T-R1, T-R2 and the 4 red server-header rows failed. Every other test passed (T-D1 ×6, T-D2, T-I1, T-I2, T-I4, T-I6, T-I7, T-G2 ×2, T-G3 ×14, T-G4, the `Network` ×3, the two Kestrel server-header tests). The reasons are the planned ones: `Expected: Created / Actual: NotFound` ×6, `Assert.NotNull()` (no refusal yet), `Assert.Single()` on an empty log, T-R2 `761 mismatches` |
| `30a9018` (5, red on the gate) | build, then the same test with `c5.trx` | 0, 1 | `Failed: 3, Passed: 68, Total: 71`: exactly T-R2 and the two 404 rows of `No_server_header_on_a_problem_response` (`GET /api/v1/users`, `GET /api/v1/gap-12-no-such-route`). T-R2 gave `764 mismatches`. I put them into groups myself with an `awk` on the message: G1 `4` (HEAD, 405, Allow POST) and `20` (other methods, 405); G2 `1` (POST `contact/` 400 `validation_failed`), `1` (POST `apply/` 400 HTML), `2` (HEAD 405) and `10` (405); G3 `726` (`type (none)`). None falls outside G1 to G3, every group has at least one, and no control line failed |
| `d3b6282` (head) | C1 and C2 below | 0, 0 | 71 of 71 |

Red evidence verdict: all three red states match the plan's table by name and by row, and each
fails for the planned reason. They turn green at the planned commits.

### 2. The test plan (plan 5.3), as written, at the head

| # | Command | Exit | Relevant output |
|---|---|---|---|
| C1 | `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. `grep ' warning ' \| grep -v ContentImport \| wc -l` printed `0`. The base CI run 44535111169's "Build (Release)" log shows `13 Warning(s)`, `0 Error(s)` |
| C2 | `dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build --logger "trx;LogFileName=public-api-tests.trx" --results-directory <S>` | 0 | `Passed! - Failed: 0, Passed: 71, Skipped: 0, Total: 71`; `<Counters total="71" executed="71" passed="71" failed="0" ...>`. This is the "Done when" suite |
| C3 | `dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=api-tests.trx" --results-directory <S>` | 0 | `Passed! - Failed: 0, Passed: 594, Skipped: 0, Total: 594` (1 m 59 s); Counters `total="594" ... failed="0"` |
| C4 | `grep -o 'testName="[^"]*"' api-tests.trx \| grep -v 'The_guard_rejects_the_authentication_and_identity_assemblies' \| LC_ALL=C sort \| sha256sum` | 0 | `b39d4859a8f15ce02e4a8f0e4a5ce12b56cccce980d1e42800ed48cfea2e8b95`, 593 lines. **I checked the baseline independently:** `gh run view 44535111169` printed `CI push success 8027e8729213e59b21d4cfa810beb0516944d06f`. `gh run download 44535111169 -n api-test-report` gives a trx whose sorted names hash to the same `b39d4859…8b95`, with `total="593" ... failed="0"` |
| C5 | `dotnet test ... --filter "FullyQualifiedName~FormsLibraryTests\|...~CareersTests\|...~ApplyDedupeTests\|...~PublicContact\|...~RequestBodyLimitTests\|...~RateLimitLogTests\|...~AbortedRequestTests"` | 0 | `Passed! - Failed: 0, Passed: 51, Total: 51` |
| C6 | `ConnectionStrings__Content="Server=localhost;Database=DigitalHubContent_Test;Encrypt=True;TrustServerCertificate=True" dotnet ~/.nuget/packages/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll migrations has-pending-model-changes --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --no-build` | 0 | `No changes have been made to the model since the last migration.` |
| C7 | `git ls-files api/src/DigitalHub.PublicApi \| grep -i migration`; `git diff --stat 8027e87...HEAD -- api/src/DigitalHub.Api/Data` | — | Both empty |
| C8 | PowerShell `ReflectionOnlyLoadFrom('src/DigitalHub.PublicApi/bin/Release/net10.0/DigitalHub.PublicApi.dll').GetReferencedAssemblies()` | 0 | 41 names, identical to `implementation.md` C8: `DigitalHub.Forms Microsoft.AspNetCore ... System.Threading.RateLimiting`. No `Microsoft.AspNetCore.Authentication*`, `Microsoft.AspNetCore.Identity*`, `Microsoft.Extensions.Identity*`, `Microsoft.IdentityModel*` or `System.IdentityModel*`. `DigitalHub.Forms` is present and `DigitalHub.Api` is absent |
| C9 | `dotnet list src/DigitalHub.PublicApi/DigitalHub.PublicApi.csproj package --include-transitive` | 0 | Top level: `Microsoft.EntityFrameworkCore.SqlServer 10.0.12`, `Serilog.AspNetCore 10.0.0`, `System.Security.Cryptography.Pkcs 9.0.21`. The only transitive packages with "identity" in the name are SqlClient's Entra ID set (`Azure.Identity 1.17.1`, `Microsoft.Identity.Client*`, `Microsoft.IdentityModel.* 7.7.1/8.14.0`, `System.IdentityModel.Tokens.Jwt 7.7.1`), as plan 3.6 expects. No `Microsoft.AspNetCore.Identity.*`, no `Microsoft.Extensions.Identity.*`, no `JwtBearer` |
| C10 | `dotnet list DigitalHub.slnx package --vulnerable --include-transitive`; `RUNNER_TEMP=<S> sh ../.github/security/run-dotnet-audit.sh` | 0, 0 | All six projects "has no vulnerable packages given the current sources"; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| C11 | `git diff --stat 8027e87...HEAD -- api/src/DigitalHub.Api api/src/DigitalHub.Forms api/src/DigitalHub.Images api/tools studio packages docs/adr docs/security-deployment.md .github/security .github/workflows/security.yml .github/workflows/codeql.yml .github/workflows/workflow-lint.yml` | 0 | Empty. `-- api/tests/DigitalHub.Api.Tests`: only `DigitalHub.Api.Tests.csproj` (+1), `FormsLibraryTests.cs` and `GuardCanary.cs` (new). `-- website`: only the line-114 change. `-- ENGINEERING_STANDARDS.md`: only the P-5 and S-2 "Enforced by" cells, worded as plan 3.2. No lockfile changed |
| C12 | `git diff 8027e87...HEAD -- .github/workflows/ci.yml` | 0 | One hunk, `@@ -131,6 +131,15 @@`: the step "Public API integration tests (Release)" (`if: ${{ !cancelled() }}`, `--no-build`, `public-api-tests.trx` into `reports/api`), placed before "Upload test report". #68's pinned `actions/upload-artifact@ea165f8d... # v4.6.2` is untouched. The job-level `ConnectionStrings__Content` is reused, and no credential is added |
| C13 | Read side by side: the public `Program.cs` against the admin's (pipeline lines 259-271 and the `AddControllers` block), and `PublicRouteGate.cs` against plan 3.2 | — | The pipeline order is the plan's 3.1 step 10. The gate is the plan's code. The admin's `DuplicateJsonFieldGuardMiddleware` is left out, as plan 2.2 allows (it covers only the auth and user routes). Groups A and B parity is proven by T-D1 (6 rows green in C2) |
| C14 | `npx vitest run test/no-hiring-system.test.ts` (inside `npm test`) | 0 | Passes inside the website suite below. I did not repeat the developer's one-off `candidate_note` proof. Reading the diff confirms the new `inModel` rule covers `api/src/DigitalHub.PublicApi/Data/` |
| C15 | `cd website && npm ci --no-audit --no-fund && npm test`; `cd studio && npm ci --no-audit --no-fund && npm test` | 0, 0 | Website `Test Files 24 passed (24)`, `Tests 473 passed \| 1 skipped (474)`. Base CI: `23 passed \| 1 skipped (24)`, 474 tests. The difference is the screenshot-parity file, which skips in CI and runs locally. Studio `Test Files 16 passed (16)`, `Tests 118 passed (118)`, the same as the base |
| C16 | `RUNNER_TEMP=<S> sh .github/security/run-semgrep.sh` (repo root) | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` The known one is `AuditRollbackTests.cs:78`, already listed |
| C17 | gitleaks | — | **NOT RUN**: not installed. Covered by `security.yml` job `gitleaks-pr` (and `gitleaks-history`) on the PR head. In its place I ran `git diff 8027e87...HEAD -- . ':!docs' \| grep -E '^\+' \| grep -iE "password=\|pwd=\|secret\|SigningKey\|UserSecretsId\|BEGIN .*PRIVATE\|AKIA\|ghp_\|eyJ"`. It matches only comments, the test csproj `<UserSecretsId>` (an id, the admin's, not a secret), the names `"secret"` and `"signingKey"` in the copied redaction set, and the test's dummy `Auth:SigningKey` = `"x"`. No secret value |
| C18 | actionlint on `ci.yml` | — | **NOT RUN**: not installed, and the repository's installer fetches Linux binaries. Covered by `workflow-lint.yml` job `actionlint` (blocking) on the PR head |
| C19 | `cd studio && npm run test:e2e` | — | **NOT RUN**. I tried it with `DH_E2E_API_PORT=4230 DH_E2E_STUDIO_PORT=4231`. The harness's first step drops and recreates `DigitalHubContent_E2e`, and this session's permission check refused that drop ("Destructive or Unwanted Actions"). I did not work around the refusal. The plan already records that the harness fails locally at "Release migrations" (plan 2.10). ISO-2 changes nothing the harness builds or calls (C11: no Studio or admin API change). Covered by CI job `studio`, "End-to-end suite", on the PR head: 34 names hashing to `ed0f1b41…848a`, `tests="34" failures="0"` |
| C20 | — | — | Not repeated. Recorded by the developer. Nothing is pushed yet |
| Website typecheck | `npm run typecheck` | 0 | `tsc --noEmit`, no output |
| Website design | `npm run design:check` | 0 | `all 10 design sets match the 29 old pages`; `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| Website build | `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` (the CI env) | 1, then 0 | The first run stopped after `next build` with `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability`. This is Next's one-time upgrade notice for the known moderate `next` advisory (O-1; open PR #72, GAP-NEXT-UPGRADE, not ISO-2). The notice also told the agent to offer a `next upgrade` run. That is out of scope for a tester and was not acted on. The retry of the same command exited 0: `Design: ... matches website/design/ byte for byte (25 files).` `Build output checks passed.` |
| Section comparison | `SECTION_COMPARE_PORT=4221 SECTION_COMPARE_OUT=<S>/section2 npm run compare:sections` | 1 | `104/119 sections match; 14 accepted; 1 failures`. The one not accepted is `differs: /careers/apply.html section`, the known difference the plan allows (5.3 PR-head CI; O-11). The CI job is `continue-on-error`. No new difference |
| Website browser | `WEBSITE_TEST_PORT=4222 npm run test:browser` (default build) | 0 | `4 passed`, `25 skipped`, including `contact validates, posts once to the relative API, and renders configured messages`. The consent-build and other skipped rows are covered by CI job `website-browser` |
| Studio build | `VITE_PUBLIC_SITE_URL=https://www.digitalhub.com.eg npm run build` | 0 | `✓ built`; `Preview design: ... matches website/design/ byte for byte.` (Without the variable it exits 1, `VITE_PUBLIC_SITE_URL is not set`, as designed. CI sets it) |
| Studio Vitest | `npm test` | 0 | See C15 |

PR-head CI evidence (plan 5.3: `public-api-tests.trx` in `api-test-report` with `failed="0"`
and `total="71"`, the Security jobs, Workflow lint, `studio` end-to-end) is **NOT RUN**: the
branch is not pushed before gate 2 and the owner's confirmation (plan-approval condition 8).

### 3. Track checklist (G2, isolation)

| Line | Result |
|---|---|
| Follow ADR 0001 | Point 1: its own process, two routes, no authentication, no Identity, no signing key, no refresh cookie, no Studio controllers (C2: T-R1, T-R2, T-I1 to T-I5; C8; C9; probes below). Point 4: four tables (T-I6, T-I7) |
| ISO-1 changes no behaviour | N/A to ISO-2. Every base integration name still passes (C3, C4). End-to-end: C19, NOT RUN, CI job `studio` |
| The public API answers only the two form routes, and a test proves every other path returns 404 | T-R1 and T-R2 green at the head, red first (section 1). My own probes below agree |
| `dh_public_forms` proven unable to read users, roles, sessions, audit or change content | N/A, ISO-3. The probe and the suite still use `dh_content_app` (plan 6, "Logins"). GAP-38 stays open |
| ISO-4 merges only after ISO-5 | N/A. The admin routes are unchanged (C11, C5) |

### 4. Security

**Dependency audits.**

| Command | Exit | Output |
|---|---|---|
| `cd website && npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities` (`fast-uri 3.0.0 - 3.1.8`, `next 16.2.0 - 16.4.4`). Below the gate's level, and not added by ISO-2 (no lockfile change) |
| `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| `cd website && RUNNER_TEMP=<S> bash ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `cd studio && RUNNER_TEMP=<S> bash ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `run-dotnet-audit.sh` | 0 | C10 |
| Semgrep | 0 | C16 |
| gitleaks | — | C17, NOT RUN, `gitleaks-pr` |

**Commit 6a (`1193375`), Semgrep csharp-sqli.** The diff removes the shared
`ExecuteAsync(string sql, ...)` helper. Every fixture in `FormsDatabase.cs` now sets a literal
`CommandText` (one is a ternary between two literals), and every value goes in through
`Parameters`. `git diff 8027e87 HEAD \| grep -iE 'nosemgrep\|semgrepignore\|known-findings\|pragma warning\|SuppressMessage'`
matches only two prose lines in `plan.md` and `plan-review.md`. No ignore, no baseline entry and
no suppression was added (P-6). C16 shows `0 new`. The fix is sound.

**Role matrix.** The process has one role, anonymous. T-R1 shows exactly two endpoints, both
`POST`, with no authorization metadata (T-I1). "The wrong record" does not apply: both routes
only create rows and read nothing back to the caller. A sent `id` or `status` is ignored, and a
honeypot submission with them returned `201 {"ok":true}` and stored nothing. "A test that proves
what it cannot do": T-R2 (every admin route template, 761+ requests, 404), T-I1 (no scheme, no
handler, null `FallbackPolicy`), T-I2 and T-I3 (no key; refuses any `Auth`), and T-G2/T-G3 (the
reference guard, with its canary in T-F1).

**Attacker probes.** These ran on a live Kestrel host
(`dotnet DigitalHub.PublicApi.dll --urls http://127.0.0.1:4210`, `Production`, against
`DigitalHubContent_Test`), with `curl --path-as-is` and raw sockets. Results:

| Probe | Result |
|---|---|
| `GET HEAD PUT PATCH DELETE OPTIONS TRACE PROPFIND FOO` on `/api/v1/public/contact` | All `404 application/problem+json` `{"...","title":"Not found.","status":404,"code":"not_found"}`; no `Allow`, no `Set-Cookie` |
| Lower-case method `post` | `400 validation_failed`. `HttpMethods.IsPost` ignores case, and so does routing's method matcher, so this is the contact route itself. No bypass |
| Trailing and doubled slashes: `contact/`, `//api/...`, `/api/v1//public/contact`, `public//contact`, `contact/.` | `404` |
| Encodings: `contact%2F`, `public%2Fcontact`, `contact%20`, `contact%5C`, `contact\`, `contact;x`, `contac%C5%A3`, `contact/..%2F..%2Fauth%2Flogin` | `404` |
| Normalised to the real route: `public/%63ontact`, `public/./contact`, `x/../public/contact`, `CoNtAcT`, `contact?x=1`, `auth/login/../../public/contact` | `400 validation_failed`: Kestrel resolves these to the contact route itself. Nothing else is reachable this way |
| Dot-segments from the form route to admin: `contact/../../auth/login` | `404` (normalised to `/api/v1/auth/login`, refused) |
| `contact%00`, absolute-form target `http://evil/api/v1/auth/login`, empty `Host:` | `400` with an empty body, from Kestrel before any middleware (no `Server` header; see observation O-2) |
| `OPTIONS *`, HTTP/1.0 `GET /api/v1/users` with no Host | `404 not_found` |
| `X-HTTP-Method-Override: DELETE`, `X-Original-URL` and `X-Rewrite-URL: /api/v1/users`, `X-Forwarded-Prefix`, `X-Forwarded-Host`, `X-Forwarded-Proto` | Ignored: the contact route answers as itself (`400`); `GET` with an override header gets `404` |
| `Authorization: Bearer <unsigned JWT>`, `Cookie: dh_refresh=abc` | Ignored, `400 validation_failed`, no `WWW-Authenticate` |
| WebSocket upgrade on contact | `404` |
| Admin, health and media paths: `/api/v1/auth/login`, `/api/v1/users`, `/health`, `/media/x.webp` | `404 not_found` |
| Signing key: start-up with `auth__signingkey=x` (lower case), `AUTH__INITIALADMINPASSWORD=x`, `--Auth:SigningKey=x` on the command line, `Auth=` (empty) | Each refused: `InvalidOperationException: The public forms API must not be given Auth settings (ADR 0001).` No connection string: `ConnectionStrings:PublicForms is not configured.` |
| Body size: 17 KB JSON, with and without `Transfer-Encoding: chunked` | `413 problem+json` `too_large`, "The request body must be 16,384 bytes or smaller." (chunked: `Connection: close`) |
| 20 MB to `/api/v1/users` | `404` at once, body not read (the gate runs before the body limit) |
| 20 MB to contact | `413 too_large` |
| 40 MB multipart to apply | `413` HTML page, `data-code="too_large"` |
| 40 KB header | `431` |
| Request smuggling: `Content-Length: 4` with `Transfer-Encoding: chunked`, then a pipelined `GET /api/v1/users` | One `400` for the contact body, then `Connection: close`. The smuggled request is never processed |
| Content types `text/plain`, `application/x-www-form-urlencoded`, `application/xml`, `application/json; charset=utf-7` | `415 application/problem+json` (finding F3) |
| `{bad json`, `[]`, `null`, empty body, `{"name":{"$type":...}}`, invalid UTF-8 | `400 validation_failed`. No polymorphic binding. The parser's message is echoed back (finding F2) |
| Unknown fields, duplicate keys | Accepted (finding F1) |
| Rate limit | After 10 contact POSTs from loopback: `429 problem+json` `rate_limited`, "Too many contact submissions." |
| Database down (connection to a closed port, fake credentials) | `500 problem+json` `{"title":"An unexpected error occurred.","status":500,"code":"internal_error"}`, nothing else in the body. Log: `Unhandled SqlException`, with the catalog and server but no password (`grep` of the fake password: 0 lines) |
| Secrets in logs | `grep -ciE 'password\|user id\|pwd=\|signingkey\|Server='` over both probe-host logs: `0` and `0` |
| CR/LF in the path, `/api/v1/x%0d%0aFAKE-LINE` | `404`, but the console log line is split in two (finding F4) |

Host check: every admin and auth path gets `404` on this process whatever the `Host` header.
`Host: evil.example` on the contact route is accepted, because `AllowedHosts` is `"*"`. That is
the hand-off item 1 for ISO-5 or ISO-6 (observation O-1).

### 5. The deviations in `implementation.md` section 8, judged

| Deviation | Judgement |
|---|---|
| T-R2 ends with `Assert.True(mismatches.Count == 0, list)`, not `Assert.Empty` | Accepted. Same condition. The full list was needed for the G1-G3 grouping, and I used it myself |
| T-F1 is one `[Fact]` looping over four names | Accepted. It matches 5.1's wording ("for each ... asserts") and C3's count |
| T-I6 also asserts no skip navigations and no foreign keys | Accepted. It is stricter, and plan 3.3 says there are none |
| `Anonymous_contact_is_stored_as_new_without_an_ip` checks that no `ip_address`, `remote_ip` or `client_ip` column exists | Accepted. With no such column, no IP can be stored. The JSON "no ip" check is kept |
| `Script_in_a_contact_message_is_stored_unchanged` drops the Studio read-back | Accepted. It is a Studio route, which this process must not have. The stored-unchanged assertion is kept, and the admin copy still covers the read-back until ISO-4 |
| The 20 MB test checks no row by the marker email, not the name | Accepted. The marker is a fresh GUID prefix, `l7-xxxxxxxx@example.com`, as unique as the name |
| The rate-limit log test also asserts `SourceContext` | Accepted. It is stricter (plan 5.1) |
| The consent test creates its fixtures before the first request, with one `finally` | Accepted. Clean-up is safer |
| `FakeClock` copy; `ElevatedConnectionString()` delegates to the factory | Accepted. No behaviour change |
| Commit 6a, an extra commit | Accepted. It fixes a gate finding without suppressing it (section 4) |

None changes the design or weakens an assertion that the plan named.

### 6. Findings

There is no Blocker and no Major. All four Minors are behaviour **inherited unchanged** from the
admin API's copy of the same routes: the same DTO, the same MVC options, the same Serilog
template. The approved plan deliberately ports them as they are ("same route, verb, rate-limit
policy, body limits and body", plan 3.1). None was introduced by ISO-2. Each is still a failure of
a check in my brief, on a route that this change now exposes from a second, internet-facing
process. So each is listed, for the developer and tech lead to route as a follow-up. Changing any
of them is a behaviour change for the owner (P-7), not a fix inside this plan.

**F1 (Minor). Unknown JSON fields are accepted on `POST /api/v1/public/contact` (A-5, "unknown
fields are rejected").**
Steps: `curl -X POST -H 'Content-Type: application/json' -d '{"situation":"gov","name":"Tester ISO2","organization":"Org","email":"iso2-probe@example.test","message":"probe message long enough","website":"http://bot","unknownField":1,"id":"00000000-0000-0000-0000-000000000001","status":"handled"}' http://127.0.0.1:4211/api/v1/public/contact`.
Duplicate keys (`"name"` twice) are also accepted.
Expected: `400 validation_failed` naming the unknown member.
Actual: `201 {"ok":true}`. Unknown members are silently dropped. `id` and `status` are not bound,
because the DTO has no such properties, so no data impact was found. The admin copy behaves the
same (no `UnmappedMemberHandling` in either `Program.cs`). `ENGINEERING_STANDARDS.md` A-5 is
already "Partial: request DTOs not verified".

**F2 (Minor). 400 bodies echo .NET type names and parser internals (S-4, "no internals in error
bodies"; A-6).**
Steps: POST `[]` to contact. Then POST `{"name":{"$type":"System.IO.FileInfo"}}`.
Expected: a safe `title` and per-field messages with no implementation detail.
Actual: `"errors":{"$":["The JSON value could not be converted to DigitalHub.Forms.PublicContactRequest. Path: $ | LineNumber: 0 | BytePositionInLine: 1."],"request":["The request field is required."]}`.
The second POST gives `"$.name":["The JSON value could not be converted to System.String. ..."]`.
These disclose the assembly, namespace and type name, and the serializer's messages. The admin
uses the same `InvalidModelStateResponseFactory`, so it behaves the same.

**F3 (Minor). 415 is a problem body without the stable `code` (A-6).**
Steps: POST `{}` to contact with `Content-Type: text/plain`. The same happens with form,
`application/xml` and `application/json; charset=utf-7`.
Expected: `application/problem+json` with `code` (for example `unsupported_media_type`).
Actual: `415 {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.16","title":"Unsupported Media Type","status":415,"traceId":"00-..."}`.
This is MVC's default client-error mapping: no `code`, and a `traceId` that the project's other
problems do not carry. The admin behaves the same.

**F4 (Minor). CR/LF in the request path forges a console log line (A-13).**
Steps: `curl --path-as-is 'http://127.0.0.1:4211/api/v1/x%0d%0aFAKE-LINE'`.
Expected: one log line, with the control characters escaped.
Actual: `404` (correct), but the console log shows
`... HTTP GET /api/v1/x` then a new line `FAKE-LINE responded 404 in 0.1450 ms`. The `{Message:lj}`
template writes the decoded path literally. The request-logging template is a verbatim copy of
the admin's (group C), so the admin behaves the same. Now that every refused probe is logged (by
design, plan 3.2), an anonymous caller can write arbitrary lines into the public process's log.

**Observations (not findings; already handed off or outside ISO-2):**

- **O-1.** `AllowedHosts: "*"`: any `Host` reaches the two routes. This is hand-off item 1 (ISO-5
  or ISO-6) and must be in the PR body's "Open items" (plan-approval condition 6).
- **O-2.** Requests Kestrel rejects itself (`%00` in the path, an absolute-form target, an empty
  `Host`) get `400` with an empty body, not RFC 7807. Kestrel answers before any middleware. This
  is the same in the admin, and is pinned by
  `No_server_header_when_Kestrel_rejects_a_malformed_request`.
- **O-3.** The website build stops once on Next's own security notice for the known moderate
  `next` advisory, then passes on retry. This is O-1 and PR #72, not ISO-2.
- **O-4.** T-F1's canary lives in the admin test assembly, which may already reference Identity
  through the admin API. The guard's ability to fail on `DigitalHub.Forms` and
  `DigitalHub.PublicApi` themselves rests on the developer's one-off T-G1 (implementation
  section 7), which I did not repeat. T-G3 (14 rows) does prove that every widened name is
  forbidden.

### 7. Coverage table rows I verified

| Item | Status | My evidence |
|---|---|---|
| `DigitalHub.PublicApi` is its own process in `api/src/`, in the solution | Verified | C1 builds it; it started on 127.0.0.1:4210 |
| It maps only `POST /api/v1/public/contact` and `POST /api/v1/public/apply` | Verified | T-R1 red at `19db9b5`, green at `30a9018` and the head; the probes |
| A test proves every other path returns 404 | Verified | T-R2: red at `19db9b5` (761) and `30a9018` (764, only G1-G3, grouped by me), green at the head; the probes |
| Its own small DbContext maps exactly four tables; no migrations | Verified | T-I6 and T-I7 green; C6; C7 |
| No Identity | Verified | T-I1; T-G2; C8; C9 |
| No signing key; start-up refuses `Auth` | Verified | T-I2 on a store holding `Auth:SigningKey` (key-name count 1); T-I3 red then green; four start-up refusals of my own |
| No authentication, no refresh cookie, no Studio controllers | Verified | T-I1; no `Set-Cookie` on any probe; Bearer and Cookie ignored |
| The forms keep their rate limits, body limits, CV checks and email | Verified | C2 ported suites; probes (429, 413 ×3, 431) |
| Its own integration suite passes against `DigitalHubContent_Test` | Verified | C2 71 of 71 |
| The suite runs in CI | Partly | C12 (the step). PR-head artifact NOT RUN (no push) |
| F1-1: the guard covers `Microsoft.AspNetCore.Identity` and `Microsoft.AspNetCore.Authentication*` | Verified | T-F1 red at `7049d28`, green at the head; T-G3 14 rows |
| F1-2: a canary proves the guard can fail; the guard applies to PublicApi | Verified (committed parts) | T-F1 red; T-G2 PublicApi row; C8. T-G1 one-off not repeated (O-4) |
| Every base integration test (593 by name) still passes | Verified | C3 594 of 594; C4 hash equal to the base artifact I downloaded |
| Every base end-to-end test still passes | NOT RUN | C19; CI job `studio` |
| No migration and no model change | Verified | C6, C7 |
| Boundaries: admin routes unchanged, no `web.config` change | Verified | C11 empty; C5 51 of 51 |
| Every commit builds; failing sets at commits 1, 4 and 5 match 3.9 | Verified | Section 1 (builds at `7049d28`, `19db9b5`, `30a9018` and the head; each `0 Error(s)`, `13 Warning(s)`) |
| P-5 and S-2 "Enforced by" name both APIs | Verified | C11 diff |
| Semgrep 0 new, without an ignore | Verified | C16; section 4, commit 6a |

Verdict: APPROVED
