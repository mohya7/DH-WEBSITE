# Test report: dataprotection-first-run

## Round 1

- **Commit tested:** head `6060a6f` (fix `d76ef67`, records only after it).
  Red-test commit `a5d2104`. Change judged by `git diff 2dbea44..6060a6f`
  (`2dbea44` is PR #46's head, this branch's base).
- **Where:** detached worktrees `/home/user/dp-test-red` (`a5d2104`) and
  `/home/user/dp-test-head` (`6060a6f`), removed afterwards
  (`git worktree list` shows neither). Probes ran in a scratch `git archive`
  copy of `6060a6f`, deleted afterwards. Nothing committed, nothing pushed.
- **Environment:** Linux container, scratchpad SDK 10.0.114 (`. <scratchpad>/dn.sh`),
  Release, no SQL Server. Every run: a new empty `HOME` folder in the scratchpad
  and
  `ConnectionStrings__Content="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`
  (closed port). `ApiFactory.ToTestCatalog` rewrites the catalog to
  `DigitalHubContent_Test` (a first try with `Database=DigitalHubContent_Test`
  was refused by `ToTestCatalog`, "must name DigitalHubContent", as designed),
  and the port is closed, so no database was reached.
- **Command** (filter varies), from `api/`:

  ```
  HOME=<new empty dir> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build \
    --filter "<filter>" --logger "console;verbosity=normal"
  ```

  "noXml" = lines matching `No XML encryptor`; "WRN" = lines matching
  ` (WRN|ERR|FTL)\]`; "home" = entries under `HOME` after the run. Logs:
  `<scratchpad>/tst-*.log`.

### 1. Builds

| Tree | Command | Exit | Output |
|---|---|---|---|
| `a5d2104` | `dotnet build tests/DigitalHub.Api.Tests -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |
| `6060a6f` | `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)`; all are CS8601/CS8604 in `ContentWriter.cs` (as at base). `grep -cE 'ApiFactory.cs\|TestHostDataProtectionTests.cs'` on the log: **0** |

### 2. The red test was red, for the planned reason (`a5d2104`)

| Run | Filter | Exit | Result | noXml | WRN | home |
|---|---|---|---|---|---|---|
| Fresh `HOME` | `FullyQualifiedName~TestHostDataProtectionTests` | **1** | `Total tests: 1, Failed: 1` | 4 | 2 | 4 |
| Same `HOME` again (keys on disk) | same | **1** | `Total tests: 1, Failed: 1` | 3 | 1 | 5 |
| Fresh `HOME` (F-1 itself, no fix) | `FullyQualifiedName~AbortedRequestTests` | **1** | `Total tests: 6, Passed: 5, Failed: 1` | 3 | 1 | 3 |

Fresh run:

```
Assert.Empty() Failure: Collection was not empty
Collection: ["Warning: No XML encryptor configured. Key {8e8f14c"···, "Warning: No XML encryptor configured. Key {78fb491"···]
   at DigitalHub.Api.Tests.TestHostDataProtectionTests.The_test_host_makes_a_data_protection_key_without_a_warning() in …/TestHostDataProtectionTests.cs:line 30
HOME: .aspnet, .aspnet/DataProtection-Keys, key-78fb491b-….xml, key-8e8f14c7-….xml
```

Warm run: `Collection: ["Warning: No XML encryptor configured. Key {f87289b"···]`, line 30.
F-1 run: `Collection: ["Warning: No XML encryptor configured. Key {fa4f17d"···]`,
`AbortedRequestTests.cs:line 45`. The red is the planned assertion (line 30, as
`implementation.md` says), for the planned reason, on fresh and warm profiles.

### 3. Green at head, repeated (`6060a6f`), each run a fresh `HOME`

| Step | Filter | Exit | Result | noXml | WRN | home |
|---|---|---|---|---|---|---|
| 5.2/1 | `FullyQualifiedName~TestHostDataProtectionTests` | 0 | `Total tests: 1, Passed: 1` | 0 | 0 | 0 |
| 5.2/2 run 1 | `FullyQualifiedName~AbortedRequestTests` | 0 | `Total tests: 6, Passed: 6` | 0 | 0 | 0 |
| 5.2/2 run 2 | same | 0 | `Total tests: 6, Passed: 6` | 0 | 0 | 0 |
| 5.2/2 run 3 | same | 0 | `Total tests: 6, Passed: 6` | 0 | 0 | 0 |
| 5.2/3 run 1 | `…TestHostDataProtectionTests\|…AbortedRequestTests` | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| 5.2/3 run 2 | same | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| 5.2/3 run 3 | same | 0 | `Total tests: 7, Passed: 7` | 0 | 0 | 0 |
| RateLimitLogTests run 1 | `FullyQualifiedName~RateLimitLogTests` | 0 | `Total tests: 5, Passed: 5` | 0 | 74 | 0 |
| run 2 | same | 0 | `Total tests: 5, Passed: 5` | 0 | 74 | 0 |
| run 3 | same | 0 | `Total tests: 5, Passed: 5` | 0 | 74 | 0 |
| All three, run 1 | `…TestHostDataProtectionTests\|…AbortedRequestTests\|…RateLimitLogTests` | 0 | `Total tests: 12, Passed: 12` | 0 | 74 | 0 |
| All three, run 2 | same | 0 | `Total tests: 12, Passed: 12` | 0 | 74 | 0 |
| All three, run 3 | same | 0 | `Total tests: 12, Passed: 12` | 0 | 74 | 0 |
| 5.2/4 | `FullyQualifiedName~AuthTests.Missing_admin_password_refuses_to_start\|FullyQualifiedName~RateLimitLogTests.The_network_drops_the_host_part` | 0 | `Total tests: 4, Passed: 4` | 0 | 0 | 0 |

The 74 WRN/ERR lines in the RateLimitLogTests runs: 2 are the expected
`Rate limit …` warnings the tests assert on; the other 72 are `ERR` lines from
the closed port (`An error occurred using the connection to database
'DigitalHubContent_Test' on server '127.0.0.1,4299'`, `Unhandled SqlException`),
i.e. this environment, not the change. None is `No XML encryptor`.

### 4. The whole runnable set (no SQL Server)

`--filter "FullyQualifiedName~DigitalHub"` (the whole project), fresh `HOME`:

| Tree | Exit | Result | noXml | home |
|---|---|---|---|---|
| `a5d2104` (red) | 1 | `Total tests: 478, Passed: 162, Failed: 316` | 4 | 4 |
| `6060a6f` run 1 | 1 | `Total tests: 478, Passed: 163, Failed: 315` | 0 | 0 |
| `6060a6f` run 2 | 1 | `Total tests: 478, Passed: 163, Failed: 315` | 0 | 0 |

Failures are the database being absent: 185 `Microsoft.Data.SqlClient.SqlException
: A network-related or instance-specific error…`, and the rest follow from it
(sign-in cannot read users, so 401s and `Assert.Equal` on status codes). The
sets of passing test names were compared with `comm`: passed at red only:
**none**; passed at head only: **`TestHostDataProtectionTests.The_test_host_makes_a_data_protection_key_without_a_warning`**;
head run 1 vs run 2: identical. So at head no runnable test is lost, and the
total (478) is the plan's expected 477 + 1.

- **Full integration suite with SQL Server: NOT RUN** (no SQL Server here).
  Covered by `ci.yml` job "API — Release build, migrations, integration tests"
  on the head that merges; condition 6 of `plan-approval.md` (green, total per
  its arithmetic, `grep -c "No XML encryptor"` = 0 in the job log).
- **Windows Release run: NOT RUN**, the owner's machine.
- **npm suites** (`website/`: `npm test`, `typecheck`, `build`, `design:check`,
  `compare:sections`; `studio/`: `npm test`, `build`, `test:e2e`) and
  `npm audit --audit-level=high` / `run-npm-audit.sh`: **NOT RUN**, out of
  scope, no `website/` or `studio/` file changed (`git diff --name-only
  2dbea44..6060a6f` lists only the two test files and this folder). Covered by
  `ci.yml`'s website and Studio jobs and `security.yml` job `npm-audit`.

### 5. Track checklist (G1, Waves 1 to 3, as plan 5.5 applies it)

| Item | Result |
|---|---|
| One fix per PR (B-8) | Yes: `ApiFactory.cs` + new test file only. |
| Red test committed before the fix (P-4, B-6) | Yes: `a5d2104` alone (`git show --stat`: 1 file, the test), then `d76ef67` (`ApiFactory.cs` only). Red shown in section 2. |
| New gate / `*_BLOCKING_FROM` / canary / baselines | N/A: no gate, no baseline file touched. |
| Actions pinned, SQL image digest, Node/.NET exact | N/A: no workflow changed. |
| No assertion weakened (P-6) | `git diff --quiet 2dbea44 6060a6f -- api/src api/tools .github api/tests/DigitalHub.Api.Tests/AbortedRequestTests.cs api/tests/DigitalHub.Api.Tests/RateLimitLogTests.cs`: exit 0. New test's `Assert.Empty(AtLeast(Warning))` has no filter. |

### 6. Security

- **Test-only confinement.** `git grep -n -i "dataprotection\|XmlEncryptor\|IXmlRepository\|KeyManagementOptions\|InMemoryKeyRing" -- api/src api/tools`:
  no output, exit 1. `git grep -n "NullXmlEncryptor\|InMemoryKeyRing"` in code
  finds only `api/tests/DigitalHub.Api.Tests/ApiFactory.cs:75,76,84` (the rest
  are these records). The quiet diff in section 5 shows `api/src`,
  `api/tools` and `.github` unchanged. `InMemoryKeyRing` is `private sealed`,
  nested in the test-only `ApiFactory`.
- **Probe P1** (scratch copy): in a host built from `ApiFactory`,
  `IOptions<KeyManagementOptions>` resolves to
  `repo=DigitalHub.Api.Tests.ApiFactory+InMemoryKeyRing enc=Microsoft.AspNetCore.DataProtection.XmlEncryption.NullXmlEncryptor`,
  `keys=2 elements=2` after `CreateNewKey`, no warning. Exit 0, home 0.
- **Secrets.** `git diff 2dbea44..6060a6f -- api | grep -E "^\+" | grep -inE "password|secret|token|key\s*=|connectionstring|BEGIN .*PRIVATE"`:
  no output, exit 1. Test logs contain only the dummy closed-port connection
  string (`User ID=x;Password=y`).
- **`.github/security/run-dotnet-audit.sh`** (from `api/`, fresh `HOME`,
  `RUNNER_TEMP` in the scratchpad, Node 22): exit 0;
  `The given project 'DigitalHub.Api' / 'DigitalHub.Api.Tests' / 'DigitalHub.ContentImport' has no vulnerable packages`;
  `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` No package added.
- **Semgrep: NOT RUN** (`which semgrep`: not installed). Covered by
  `security.yml` job `semgrep` ("Semgrep (ERROR fails, WARNING reported)");
  R-3 (`NullXmlEncryptor` in test code) is decided there. CodeQL (C#):
  `codeql.yml`, NOT RUN.
- **gitleaks: NOT RUN** (`which gitleaks`: not installed). Covered by
  `security.yml` jobs `gitleaks-pr` and `gitleaks-history`.
- Routes, roles, host checks, body limits, error shape: N/A, no route or
  production code changed. Not a login or permission change.

### 7. Beyond the plan

| Probe (scratch copy of `6060a6f`, fresh `HOME`) | Exit | Result |
|---|---|---|
| P2: six `ApiFactory` hosts started in parallel, each making 20 keys concurrently (`Parallel.For`) on its ring, then protecting a payload | 0 | No exception; each host `keys=21`; 0 warnings on any host; home 0. Host 1 cannot unprotect host 0's payload: `CryptographicException: The key {e3544a33-…} was not found in the key ring`, so rings are per host as designed (R-1: anything relying on keys across hosts would fail loudly; plan 2.2 shows the API has no such consumer). |
| P3: an `ApiFactory` subclass that overrides `ConfigureWebHost` **without** calling `base` (settings copied by hand) | 0 (probe asserts the warning appears) | `warnings=2 first=Warning: No XML encryptor configured. Key {9693c77c-…} … profileKeys=2`; home 4 (`.aspnet/DataProtection-Keys` with 2 keys). Confirms R-4: the guard is a convention. |
| Every current host override calls `base` | — | `grep` of each `override void ConfigureWebHost` vs `base.ConfigureWebHost` in `api/tests`: equal counts in all 9 files except `AuthTests.cs` (1 override, 0 base), which is `MissingPasswordFactory : WebApplicationFactory<Program>` (`AuthTests.cs:297`), the documented exception that fails before Data Protection runs; `Missing_admin_password_refuses_to_start` passes at head (section 3, 5.2/4) with home 0. |

Observation (not a finding): P3 shows R-4 is real but only for a host written
against the documented rule. The plan accepted it (m-2) and the `ApiFactory`
comment states the rule. No current host breaks it.

### 8. Clean-up

Every `tst-home-*` folder deleted (`ls` of the glob: no such file);
`/root/.aspnet` and `<scratchpad>/dotnet-home/.aspnet` do not exist. Both test
worktrees removed and pruned; the probe copy deleted. Two older key folders
`<scratchpad>/home-base/.aspnet` and `<scratchpad>/home-fix/.aspnet`, dated
2026-11-08 16:02 UTC, predate this round and were not made by me; left as found.
`git status --short` in `/home/user/dh-change-dp` was empty before this file.

### Findings

None. No Blocker, Major or Minor.

### Coverage table rows verified

| Item | Source | Status | Evidence |
|---|---|---|---|
| A test host makes a Data Protection key without a Warning, on any profile | F-1 / FU-1; 5.1 | Verified (local) | Section 3, 5.2/1: exit 0, 0 noXml; red on fresh and warm profile (section 2); P1, P2. |
| `TestHostDataProtectionTests` shown red at base before the fix | P-4, B-6; 5.1 | Verified | `a5d2104`: exit 1, `TestHostDataProtectionTests.cs:line 30`, `Collection: ["Warning: No XML encryptor configured. …`, home 4; warm exit 1. |
| AbortedRequestTests: all rows pass on a fresh Linux profile, on this head | F-1 *Expected*; 5.2/2-3 | Verified (local) | 3 of 3 `Passed: 6`, 3 of 3 `Passed: 7`, 3 of 3 `Passed: 12` with RateLimitLogTests; red tree shows F-1 (5/6, line 45). |
| Merged only after PR #46; CI green on the head that merges | M-1; 5.2/6 | NOT RUN | Not pushed; `ci.yml` API job; for the integrator. `2dbea44` is an ancestor of `6060a6f` (diff base used throughout). |
| No warning assertion weakened; `AbortedRequestTests.cs` unchanged | P-6, FU-1 | Verified | Quiet diff exit 0 (section 5). |
| Test hosts write nothing to the user profile's key ring | 3.1; 5.2 | Verified (local) | home 0 in every head run, including the full project run (red: 4). |
| Data Protection still works in the test host | 5.1 step 4 | Verified (local) | New test passes (round trip); P2 protects in six parallel hosts. |
| Full integration suite green in CI (478), warning absent from job log | G-2; 5.4 | NOT RUN (SQL) | Local: 478 discovered, head passes a strict superset of red's runnable tests, 0 noXml. CI: `ci.yml` API job. |
| Production Data Protection and configuration unchanged | Change context; 6 | Verified | `git grep` of `api/src api/tools`: no match; quiet diff exit 0. |

Verdict: APPROVED
