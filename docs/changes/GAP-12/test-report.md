# GAP-12: test report

## Round 1

Tester, 2026-11-01. Commit tested: **`b01fee4`** ("GAP-12: Record implementation"),
on a detached worktree `/home/user/wt-GAP-12-test` (removed afterwards). Red
commit: `a37d618`. Base: `6470fac`. Governing documents read from the read-only
copies supplied with the task (they are not on the base branch).

Environment for every `dotnet test` below, exactly as the `api` job in
`.github/workflows/ci.yml` (lines 60 and 61) sets it, with workflow-only
credentials:

```
ConnectionStrings__Content=Server=localhost,1433;Database=DigitalHubContent;User ID=dh_content_app;Password=CiOnlyApp2026Passw0rd;Encrypt=True;TrustServerCertificate=True
ConnectionStrings__ContentAdmin=Server=localhost,1433;Database=DigitalHubContent;User ID=sa;Password=CiOnlySa2026Passw0rd;Encrypt=True;TrustServerCertificate=True
```

`ApiFactory` rewrites both to `DigitalHubContent_Test`. Before the runs,
`sys.databases` listed `master`, `tempdb`, `model`, `msdb`, `GAP06R_Idem` and
`DigitalHubContent_Test`, and no other user session was connected. Nothing was
created or dropped by the tester; `DigitalHubContent` was not touched.

### 1. The red test was red (`a37d618`)

```
git checkout --detach a37d618
cd api && dotnet tool restore            -> exit 0, "Restore was successful."
dotnet build DigitalHub.slnx -c Release  -> exit 0, "0 Error(s)"
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"
exit 1
  Passed ...ServerHeaderTests.The_host_under_test_is_Kestrel_on_a_loopback_socket [8 ms]
  Failed ...ServerHeaderTests.No_server_header_on_a_success [3 s]
   Unexpected Server header: Kestrel
     at ...No_server_header_on_a_success() in .../ServerHeaderTests.cs:line 49
  Failed ...ServerHeaderTests.No_server_header_when_Kestrel_rejects_a_malformed_request [22 ms]
Collection: ["HTTP/1.1 400 Bad Request", "Content-Length: 0", "Connection: close", "Date: Sun, 01 Nov 2026 15:41:46 GMT", "Server: Kestrel"]
     at ...No_server_header_when_Kestrel_rejects_a_malformed_request() in .../ServerHeaderTests.cs:line 86
  Failed ...No_server_header_on_a_problem_response(path: "/api/v1/gap-12-no-such-route") [39 ms]
   Unexpected Server header: Kestrel   (line 62)
  Failed ...No_server_header_on_a_problem_response(path: "/api/v1/users") [13 ms]
   Unexpected Server header: Kestrel   (line 62)
Total tests: 5
     Passed: 1
     Failed: 4
```

All four failures are on the `Server` assertion (lines 49, 62, 86), after the
status-code assertions passed; none is a connection, database, status or
timeout failure. The guard passed. This is the reason the plan gives.

### 2. Green on the head (`b01fee4`)

```
git checkout --detach b01fee4
dotnet build DigitalHub.slnx -c Release  -> exit 0, "13 Warning(s)", "0 Error(s)" (same count as the developer; none in ServerHeaderTests.cs)
dotnet test ... --filter "FullyQualifiedName~DigitalHub.Api.Tests.ServerHeaderTests" --logger "console;verbosity=normal"
exit 0
  Passed ...No_server_header_on_a_success [4 s]
  Passed ...The_host_under_test_is_Kestrel_on_a_loopback_socket [27 ms]
  Passed ...No_server_header_when_Kestrel_rejects_a_malformed_request [42 ms]
  Passed ...No_server_header_on_a_problem_response(path: "/api/v1/gap-12-no-such-route") [344 ms]
  Passed ...No_server_header_on_a_problem_response(path: "/api/v1/users") [29 ms]
Test Run Successful.
Total tests: 5
     Passed: 5
```

### 3. Full API suite (Release)

```
dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build \
  --logger "trx;LogFileName=api-tests.trx" --logger "console;verbosity=normal" --results-directory <scratchpad>
exit 0
Test Run Successful.
Total tests: 480
     Passed: 480
 Total time: 2.4500 Minutes
```

0 failed lines in the log. 480 = 475 existing cases + 5 new, matching the
developer's count.

### 4. Security

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| gitleaks, this change's commits | `RUNNER_TEMP=<scratch> GITLEAKS_VERSION=8.30.1 GITLEAKS_SHA256=551f6fc8...f2470eb sh .github/security/install-gitleaks.sh` then `sh .github/security/run-gitleaks.sh pr-diff <report> "6470fac..b01fee4"` | 0 / 0 | "gitleaks_8.30.1_linux_x64.tar.gz: OK"; "4 commits scanned", "no leaks found", "pr-diff: 0 finding(s) at the gate's level; 0 known, 0 new." |
| gitleaks, full history | `sh .github/security/run-gitleaks.sh full-history <report> "--all"` | 0 | "302 commits scanned", "leaks found: 2", "full-history: 2 finding(s) at the gate's level; 2 known, 0 new." (both already in `known-findings.json`: `Catalog.cs:9`, `ApiFactory.cs:17`) |
| Semgrep | `pip install "semgrep==1.180.0"` (venv, installed: `semgrep --version` 1.180.0), then `sh .github/security/run-semgrep.sh` | 2 | **NOT RUN**: "semgrep exited 2". The rule packs (`p/csharp` etc.) are fetched from `semgrep.dev`, which this sandbox's egress proxy refuses: `ProxyError(... 'Tunnel connection failed: 403 Forbidden')`, `curl https://semgrep.dev/c/p/csharp` -> "CONNECT tunnel failed, response 403". Covered by the `semgrep` job ("Semgrep (ERROR fails, WARNING reported)") in `.github/workflows/security.yml`. |
| .NET packages | `cd api && sh ../.github/security/run-dotnet-audit.sh` | 0 | "has no vulnerable packages" for `DigitalHub.Api`, `DigitalHub.Api.Tests`, `DigitalHub.ContentImport`; "dotnet: 0 finding(s) at the gate's level; 0 known, 0 new." |
| npm, Studio (gate) | `cd studio && sh ../.github/security/run-npm-audit.sh studio` | 0 | "found 0 vulnerabilities"; "studio: 0 finding(s) at the gate's level; 0 known, 0 new." |
| npm, Studio (full tree) | `cd studio && npm audit --audit-level=high` | 1 | "5 vulnerabilities (2 moderate, 3 high)" (development dependencies; pre-existing, see note) |
| npm, website (gate) | `cd website && sh ../.github/security/run-npm-audit.sh website` | 1 | "website: 6 finding(s) at the gate's level; 3 known, 3 new." New: critical `next` GHSA-2464-fhr4-w9xw, high `next` GHSA-p3m5-59mp-jv5r, critical `next` GHSA-673q-mjm6-r5xr (pre-existing, see note) |
| npm, website (full tree) | `cd website && npm audit --audit-level=high` | 1 | "8 vulnerabilities (3 moderate, 4 high, 1 critical)" (pre-existing, see note) |
| No secret in the diff | `git diff 6470fac b01fee4` scanned for `Password=`, `SigningKey`, key headers, tokens | - | Only the workflow-only CI values already public in `ci.yml` (`CiOnlyApp2026Passw0rd`, `CiOnlySa2026Passw0rd`) and `ApiFactory`'s test-only values, quoted in `implementation.md`. No real secret. gitleaks pr-diff agrees (0). |
| No secret in logs | Live-run log `grep -ciE "password=|signingkey|CiOnly"` | - | 0 matches |
| Scope | `git diff --name-only 6470fac b01fee4 -- website studio packages .github '*.csproj' '*lock.json'` | - | Empty: no workflow, package, lockfile or front-end change. `AddServerHeader` appears only in `Program.cs:28` (set to `false`) and a comment in the test. |

**Note on the npm results.** This change touches no `website/`, `studio/`,
package or lockfile (row "Scope" above), so every npm advisory is the same on
the base `6470fac` and is not a GAP-12 finding. They belong to Wave 0
(GAP-01 to GAP-03, track G1 Wave 0 checklist). Consequence for this change: the
`npm-audit` (website) job in `.github/workflows/security.yml` will fail on a
GAP-12 pull request until the Wave 0 fix is merged first, which matches
approval condition 8 ("Wave 0 first").

**Routes.** No route, policy or role is added or changed, so the role matrix,
host checks, unknown-field, body-size and error-shape checks for new routes do
not apply. The 401 responses the tests hit are `application/problem+json`
(asserted by the test). No login or permission change.

### 5. Beyond the plan

Live run of the head's Release build, a process I started and stopped
(`kill <its PID>`, confirmed stopped), on `127.0.0.1:4277`, with `env -i` and
the developer's test-only environment (`ASPNETCORE_ENVIRONMENT=Testing`,
`Database=DigitalHubContent_Test`, `dh_content_app`, test `Auth__*` values,
scratch `Media__Root`), **plus `Kestrel__AddServerHeader=true`** to check the
plan's claim that configuration cannot turn the banner back on.

```
curl -sS -D - -o /dev/null <url> | grep -iE "^HTTP|^server"
== GET /health                           HTTP/1.1 200 OK
== GET /api/v1/users                     HTTP/1.1 401 Unauthorized
== GET /api/v1/nope                      HTTP/1.1 401 Unauthorized
== GET /media/does-not-exist.png         HTTP/1.1 401 Unauthorized
== OPTIONS preflight (foreign Origin)    HTTP/1.1 401 Unauthorized
== HTTP/1.0 GET /health                  HTTP/1.1 200 OK
== HEAD /health                          HTTP/1.1 200 OK
== POST /api/v1/auth/login, body "{bad"  HTTP/1.1 400 Bad Request
== 40 KB request header                  HTTP/1.1 431 Request Header Fields Too Large
== 20 KB query string                    HTTP/1.1 414 URI Too Long
== 40 MB body to /api/v1/auth/login      HTTP/1.1 413 Payload Too Large
== 25 wrong logins                       8 x HTTP/1.1 401 Unauthorized, 17 x HTTP/1.1 429 Too Many Requests

raw socket (python3 -I, 10 s timeout):
b'GET / HTTP/9.9 ...'                     -> HTTP/1.1 505 HTTP Version Not Supported | Server lines: []
b'GARBAGE\r\n\r\n'                        -> HTTP/1.1 400 Bad Request | Server lines: []
b'GET / HTTP/1.1\r\n\r\n' (no Host)       -> HTTP/1.1 400 Bad Request | Server lines: []
b'... Transfer-Encoding + Content-Length' -> HTTP/1.1 401 Unauthorized | Server lines: []
```

No `Server` line on any of them (the grep printed only status lines), including
every response Kestrel writes itself (400, 413, 414, 431, 505), the rate
limiter's 429, and with `Kestrel__AddServerHeader=true` in the environment:
the code setting wins over configuration, as the plan intends.

### Findings

None. No Blocker, Major or Minor.

Informational (not caused by this change, no action for GAP-12): the
pre-existing website npm advisories above make the `security.yml` website
`npm-audit` job red on any pull request until Wave 0 (GAP-01) lands.

### Not run

- **Semgrep:** NOT RUN, `semgrep.dev` blocked by the sandbox proxy (above);
  covered by the `semgrep` job in `.github/workflows/security.yml`.
- **CI `api` job run id:** NOT RUN; the branch is not pushed (approval
  condition 8). The new tests run unchanged in its "Integration tests (Release)"
  step.
- **Website and Studio (`npm test`, `typecheck`, `build`, `design:check`,
  `compare:sections`, Studio `build` and `test:e2e`):** NOT RUN; the plan's test
  plan lists none of them and the change touches neither app (empty diff under
  `website/`, `studio/`, `packages/`). Covered by the `website` and `studio`
  jobs in `.github/workflows/ci.yml`.

### Track checklist (G1, Waves 1 to 3)

| Check | Verified |
| --- | --- |
| One gate per pull request (B-8) | Yes: one fix (`Program.cs`, 1 statement), one test file, one docs section. |
| New gate `*_BLOCKING_FROM` / canary (GAP-21) | No gate added. The canary is the red run (section 1), reproduced here; the guard test passed in red and green. |
| Actions by SHA, SQL image by digest, Node/.NET exact | Not touched: `.github` diff empty. |
| Baselines only shrink | No baseline touched; `known-findings.json` unchanged. |

### Coverage table rows verified

| Item | Status | Tester evidence |
| --- | --- | --- |
| Kestrel sends no `Server` header (`AddServerHeader = false` in `Program.cs`) | Verified | Green 5/5; live run: no `Server` on 200, 401, 400, 413, 414, 429, 431, 505, even with `Kestrel__AddServerHeader=true` |
| An integration test asserts no `Server` header (200, 401 problem, unknown path, Kestrel's own 400) | Verified | `ServerHeaderTests.cs`, 5 cases, read and run |
| The test fails before the fix, on the `Server` assertion | Verified | Section 1: 4 failed on lines 49/62/86, guard passed |
| The test runs on real Kestrel, not TestServer (guard) | Verified | Guard passed on both commits; raw-socket case reaches the port |
| Full API integration suite passes in Release, no regressions | Verified | 480/480, exit 0 |
| IIS `Server` header recorded as a Phase D deployment setting | Verified | `docs/security-deployment.md`, "API: response headers" |
| `ci.yml` untouched; the `api` job runs the new test green | Partly | `ci.yml` untouched (verified); CI run NOT RUN (not pushed) |

Verdict: APPROVED
