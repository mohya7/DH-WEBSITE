# ADM-02: test report

Tester: Claude Code (tester role), 11 November 2026. Plan `plan.md` round 2
(`46d9bbc`); review `plan-review.md` round 2 (`c8ff97a`, APPROVED); gate 1
`plan-approval.md` (`432bdf1`, `Verdict: APPROVED`, conditions 1 to 11);
`implementation.md` (`a34947a`, `Status: READY FOR TEST`).

## Round 1

- **Commit tested:** `a34947aa431a1b6a1cfccbc2f8da623c4774c3f0` (ADM-02: Record the
  implementation). Red commit checked: `7c93e52`. Base `77296ba`.
- **Where:** the detached worktree `/home/user/dh-test-adm02`. I checked out `7c93e52`
  in it for the red run, then went back to `a34947a` for everything else. The
  developer's worktree `/home/user/dh-change-adm02` and branch `change/ADM-02` were
  not touched. Nothing was committed, pushed or amended. No source, test, lockfile or
  workflow was edited. `git status --short` is empty at the end. The only file written
  in the worktree is this one. Probes and logs are in the scratchpad,
  `/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm02-test/`.
- **Databases and ports:** no SQL Server is reachable here. Every .NET test run used
  `ConnectionStrings__Content="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`.
  `ApiFactory.ToTestCatalog` rewrites the catalog to `DigitalHubContent_Test`
  (`ApiFactory.cs:134-150`), and nothing listens on 4299 (`ss -ltn | grep 4299`, exit 1).
  No database was reached, started, reset or written. No port was opened. A fresh
  `HOME` was used for each `dotnet test`. All builds and tests ran in Release.

### 1. Commit order and scope

```
$ git show --stat --format='%h %s' 7c93e52 | grep -E "api/src|api/tools"; echo $?
1
```

`7c93e52` holds only `ci.yml`, the four new or changed test files, the website harness
(`check-content.ts` twice, the test) and `package.json`. `14c244e` holds
`RedirectPaths.cs`, `AdminStore.cs`, `ContentStore.cs` and K1. `244444c` holds the format
files, `ContentBundle.cs` and the one-line F1 tie
(`Assert.Equal(WebsiteUuidRegex, SchemaFormats.WebsiteUuidSource)`). Between `7c93e52`
and `a34947a`, `git diff --stat -- api/tests website .github` shows only
`RedirectAddressRuleTests.cs` (+52) and `SchemaFormatTests.cs` (+1). No red test was
weakened after the red commit. Every commit has an `ADM-02:` subject, a body and the
trailer. `git diff --quiet 77296ba HEAD -- website/package-lock.json studio` exits 0, and no
`*.csproj` changed. Scope is the 17 files of plan section 4 plus the four records
(condition 5).

### 2. The red test was red (`7c93e52`)

| Command | Exit | Relevant output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release` (in `api/`) | 0 | `13 Warning(s)`, `0 Error(s)` |
| W2 **before** `npm ci` (no `website/node_modules`): `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~DigitalHub.Api.Tests.ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"` | 1 | `Failed DigitalHub.Api.Tests.ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file`, `Run npm ci in website/ first.`, `Failed: 1, Passed: 0, Skipped: 0`. It fails, it does not skip (condition 8) |
| `npm ci` in `website/` | 0 | `1 moderate severity vulnerability` (see 6). Lockfile unchanged |
| F1 and W2: `dotnet test ... --filter "FullyQualifiedName~DigitalHub.Api.Tests.SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case\|FullyQualifiedName~DigitalHub.Api.Tests.ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"` | 1 | `Failed: 1, Passed: 1, Total: 2`. W2 passes. F1 fails at (c), as below |
| `npx vitest run test/check-content.test.ts --reporter=verbose` | 0 | C1 to C5 pass: `passes the committed snapshot`, `refuses two redirects that differ by a trailing slash`, `refuses a section reference id that is not a uuid`, `stops on an upper-case media id`, `drops an upper-case reference without a problem line` |
| `npm run typecheck` | 0 | `tsc --noEmit`, no output |

F1's failure at `7c93e52`, as run. (a) and (b) come before it in the method and passed:

```
Failed DigitalHub.Api.Tests.SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case [2 s]
Error Message:
 upper-case valid "01234567-89AB-CDEF-0123-456789ABCDEF": website accepts, API accepts, expected the API to refuse
not-a-uuid "not-a-uuid": website refuses, API accepts, expected the API to refuse
not-a-uuid: the website refuses it and the API does not
empty "": website refuses, API accepts, expected the API to refuse
32 digits "0123456789abcdef0123456789abcdef": website refuses, API accepts, expected the API to refuse
braces "{01234567-89ab-cdef-0123-456789abcdef}": website refuses, API accepts, expected the API to refuse
leading space " 01234567-89ab-cdef-0123-456789abcdef": website refuses, API accepts, expected the API to refuse
trailing newline "01234567-89ab-cdef-0123-456789abcdef\n": website refuses, API accepts, expected the API to refuse
full-width digit "０1234567-89ab-cdef-0123-456789abcdef": website refuses, API accepts, expected the API to refuse
(each "website refuses" case also has its "(d)" line)
```

This is the reason the plan gives (5.1, F1 red: "`not-a-uuid` gets no error"). The 20
database red cases (R1 to R7, F2, F4, F5a, W1) need SQL Server: **NOT RUN**, CI job `api`.
Their CI red waits on O-ADM02-1 (condition 4).

### 3. Green at the head (`a34947a`)

| Command | Exit | Relevant output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. All 13 are CS8601 or CS8604 in `tools/DigitalHub.ContentImport/ContentWriter.cs`. None in an ADM-02 file |
| F1, K1, W2, L5 and `RedirectPathRuleTests`: `dotnet test ... --filter "...SchemaFormatTests.The_api_checks_uuid...\|...ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file\|FullyQualifiedName~RedirectAddressRuleTests\|FullyQualifiedName~RedirectPathRuleTests" --logger "console;verbosity=normal"` | 1 (expected: no SQL Server) | `Passed ... RedirectAddressRuleTests.The_api_address_is_the_website_builds_address`, `Passed ... SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case`, `Passed ... RedirectPathRuleTests.The_api_rule_is_the_website_builds_rule`, `Passed ... ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file`. The 7 `RedirectPathRuleTests` failures are its existing database cases (login fails with no SQL Server) |
| W1 and W2 with `website/node_modules` moved aside (then restored): `--filter "FullyQualifiedName~ApiAcceptedContentTests"` | 1 | W2: `Failed`, `Run npm ci in website/ first.`; `Skipped: 0`. W1 fails earlier, at the admin login (`Expected: OK, Actual: InternalServerError`, no SQL Server), so its own `node_modules` message can only show in CI. It calls the same `WebsiteCheck.RunAsync`, whose `Assert.True(File.Exists(tsx), "Run npm ci in website/ first.")` (`ApiAcceptedContentTests.cs:172`) cannot skip |
| Full API suite, no database: `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=.../adm02-test/head.trx"` | 1 (expected) | `Failed: 344, Passed: 176, Skipped: 0, Total: 520` |
| Passed names against `scratchpad/adm02/base-passed.txt` (173 lines at `77296ba`; XML entities unescaped, compared as multisets) | 0 | `176` vs `173`. Lost: none. New: `ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file`, `RedirectAddressRuleTests.The_api_address_is_the_website_builds_address`, `SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case` |
| Failures in the full run by cause | | 192 SQL connection; the rest are login or seed steps that fail with no database (`Unauthorized`, `InternalServerError`). All 36 failing tests in the ADM-02 files and `ContentBundleTests` fail at the connection or the admin login, not at an ADM-02 assertion |
| `npm run typecheck` (website) | 0 | no output |
| `npm test` (website, `vitest run`) | 0 | `Test Files 22 passed \| 1 skipped (23)`, `Tests 425 passed \| 31 skipped (456)` |
| `npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` (as CI job `website`) | 0 | `web.config: 0 redirect(s) ...`, `Build output checks passed.` (My first try left out `PUBLIC_SITE_URL`, which CI sets, and the build refused as designed: `PUBLIC_SITE_URL is not set`.) |
| `npm ci`, `npm test`, `VITE_PUBLIC_SITE_URL=https://www.digitalhub.com.eg npm run build` (studio; no Studio file changed) | 0, 0, 0 | `Tests 60 passed (60)`; `Preview design: ... matches website/design/ byte for byte.` |

**NOT RUN:**

| Check | Why | CI job |
| --- | --- | --- |
| R1 to R7, F2, F3, F4, F5a, F5b, W1 | No SQL Server. Each fails at the connection or the admin login, which shows neither red nor green | `api` ("Integration tests (Release)", SQL Server 2022 service, with the new Node steps) |
| `npm run compare:sections` | Needs a `feature/interviewer-portal` checkout as the old site, and Playwright browsers (`~/.cache/ms-playwright` is missing). No page, style or component changed | `section-compare` |
| Website browser suites, Studio `npm run test:e2e` | Need browsers. The e2e suite also needs a database | `website-browser`, `studio` (watch 10.21, `studio.spec.ts:163`) |
| Semgrep, gitleaks | Not installed (`which semgrep gitleaks`: none) | `security.yml` jobs `semgrep`, `gitleaks-pr`, `gitleaks-history` |

### 4. Checks the developer asked for

1. **The global `FormatRegistry` is unchanged.** I wrote my own probe
   (`adm02-test/probe-root/app/Program.cs`). It references the built
   `DigitalHub.Api.dll` and `JsonSchema.Net.dll` 8.0.5 from `bin/Release`. Output:
   ```
   global uuid before: PredicateFormat
   Asserting registry is Global: False
   two Asserting() share registry: False
   global uuid after construction: PredicateFormat; same instance: True
   plain options registry is Global: True
   global uuid on 01234567-89AB-CDEF-0123-456789ABCDEF: valid=True
   global uuid at end: PredicateFormat; same instance: True
   ```
   After `SectionSchemaSet`, `CollectionSchemaSet` and `Asserting()` are built and used,
   the global `uuid` is the library's own instance and still accepts upper case. Each
   `Asserting()` gets a fresh registry.
2. **Ended vacancies are strict at import.** `ContentBundle.cs:389-390`:
   `var built = record.Status is ContentStatus.Published or ContentStatus.Ended;` and
   `CheckDocumentAsync(table.Collection!, id, draft, publishing: built, cancellationToken)`.
   Working copies pass `publishing: false` (`:414`). That matches
   `BuildContentStore.cs:176`
   (`item.Status == ContentStatus.Published || item.Status == ContentStatus.Ended`).
   It follows condition 1, not plan 3.2's last bullet. In practice it changes nothing
   today: `packages/collections/*.json` holds no `"format"` (`grep -c` gives 0 for
   every file), and vacancies have no sections. F1 (b) pins that.
3. **W2 fails, not skips, without `node_modules`.** At `7c93e52` and at `a34947a`:
   `Failed`, `Run npm ci in website/ first.`, `Skipped: 0` (section 2 and section 3).
4. **Settings guard in `checkContent`.** `npm run -s check:content -- {}` exits 1 and
   prints the six `The content has no "..."` lines, `settings` included, with no
   `TypeError`. Other inputs: `settings: 5` passes, the same as the build
   (`write-web-config.ts` calls `tagManagerId(content.settings)` the same way);
   `redirects: null` gives `The content has no "redirects".`, exit 1;
   `redirects: "x"` gives a rethrown non-`WebConfigError`, exit 1.
5. **The CLI's exit codes.** No file: `Name the content file: npm run check:content -- <file>`,
   exit 2. Committed snapshot: the pass line, exit 0. Every bad file exits 1 and prints
   no pass line: a missing file (`ENOENT` stack), `{not json`, a zero-byte file, `null`
   and `[]`.

### 5. Gate 1 conditions verified in the code

- **Condition 1:** quoted in 4.2.
- **Condition 2:**
  `public Task<...> CheckDocumentAsync(string collection, Guid id, DraftDocument draft, bool publishing, CancellationToken cancellationToken)`
  and
  `private async Task<...> CheckAsync(string collection, Guid id, DraftDocument draft, bool publishing, CancellationToken cancellationToken, bool requireMedia = true)`.
  `publishing` has no default. All eight call sites name it: publish `true` (`ContentStore.cs:311`),
  unpublish, restore, create and save `false`, and the bundle `built` or `false`.
- **Condition 5:** section 1.
- **Condition 7:** the whole `ci.yml` diff is the two steps below, in job `api`, before
  "Integration tests (Release)". There is no `if:` and no `continue-on-error`:
  ```
  +      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
  +        with:
  +          node-version: ${{ env.NODE_VERSION }}
  +          cache: npm
  +          cache-dependency-path: website/package-lock.json
  +      - run: npm ci
  +        working-directory: website
  ```
  `git ls-remote https://github.com/actions/setup-node 'refs/tags/v4.4.0*'` gives
  `49933ea5288caeca8642d1e84afbd3f7d6820020 refs/tags/v4.4.0`, so the pin is the real
  tag and the same pin `website-browser` already uses (`ci.yml:439`). The `run` step
  has no `uses:` to pin. `NODE_VERSION: "22"` is set at workflow level (`ci.yml:30`).

### 6. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, website, full tree | `npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (`fast-uri 3.0.0 - 3.1.8`). Below high, and the lockfile is unchanged from the base |
| npm audit, studio, full tree | `npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| CI gate, npm | `RUNNER_TEMP=... sh ../.github/security/run-npm-audit.sh website` (and `studio`) | 0, 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` and the same for studio |
| CI gate, NuGet | `RUNNER_TEMP=... sh ../.github/security/run-dotnet-audit.sh` (in `api/`) | 0 | No vulnerable packages in `DigitalHub.Api`, `DigitalHub.Api.Tests` or `DigitalHub.ContentImport`; `dotnet: 0 finding(s) at the gate's level` |
| actionlint, installed independently with the repo's checksum-verified installer | `RUNNER_TEMP=<mine> sh .github/lint/install-actionlint.sh` (versions and sha256 from `workflow-lint.yml`), then `ACTIONLINT_BLOCKING_FROM=2026-11-18 bash .github/lint/run-actionlint.sh workflows` | 0 | `actionlint: 0 findings in .github/workflows` |
| actionlint canary | `bash .github/lint/run-actionlint.sh canary` | 0 | `actionlint canary: all 6 expected findings reported` |
| actionlint on `ci.yml` alone | `actionlint -shellcheck <mine>/shellcheck .github/workflows/ci.yml` | 0 | no output |
| Secrets in the diff | `git diff 77296ba HEAD -- . ':!docs' \| grep -E "^\+" \| grep -iE "password\|secret\|token\|apikey\|BEGIN .*PRIVATE\|connectionstring\|Bearer "` | | Only matches are `cancellationToken`. W1 sends the existing `ApiFactory.BuildTokenValue` by reference. No secret appeared in any log or output here |
| Routes | | | No route, policy, host rule or request model changed (`git diff` touches no controller, `Program.cs` or auth file). So there is no new role matrix, host, unknown-field or body-size case. The new refusals reuse existing outcomes: `409 redirect_exists`, `400 redirect_loop`, `400 redirect_live_path`, `400 publish_blocked` and `Validation(...)`, all RFC 7807 with `code`. The new message text is the library's, for example `/items/0/reference/id format: Value is not a match for the format 'uuid'.` (from the probe), with no stack or internals. The HTTP bodies themselves are database tests: NOT RUN, CI `api` (F2 and F4 assert `format 'uuid'` in the body) |
| Regex risk | probe | | `SchemaFormats.Uuid` is anchored with fixed repeats. A 100 000-character id is refused in 0 ms |
| Child process | code reading | | `WebsiteCheck.RunAsync` uses `ArgumentList` (no shell), fixed arguments, a temp path the test generated, and a 2-minute timeout that kills the process tree |

### 7. Beyond the plan

DB-free probes (`adm02-test/probe-root/`):

- **The F1 cases and more, strict against draft.** Strict refused all 16 bad forms and
  draft refused none. The forms: the F1 set, plus a single upper-case final digit
  (`...abcdeF`), parentheses, a trailing space, a trailing `\r\n`, a trailing NUL, a
  misplaced hyphen, `g` as a digit and 100 000 characters. The valid lower-case form
  passes both. `image.mediaId` and `related_items` behave the same way.
- **`CollectionSchemaSet`.** No collection schema has a `format`, so strict and draft are
  the same there. Collection `imageId` and `shareImageId` are `Guid?` columns
  (`ContentEntities.cs`, `ContentRecord.cs:43`), so build content always emits them in
  lower-case `"D"` form. No upper-case gap there.
- **Concurrency of the shared options.** 2 000 `Parallel.For` evaluations mixed
  `Validate` and `ValidateDraft` on one `SectionSchemaSet`, with 0 wrong verdicts.
- **A format other than `uuid` under `Asserting()`.** `email` falls back to the global
  registry, and an unknown `madeup` format evaluates as valid. That is as documented in
  `SchemaFormats.cs`. F1 (b) fails if a schema starts to use any format other than `uuid`.
- **`RedirectPaths.Key` and `Spellings` against `web-config.ts`.** I ran 313 paths: 13 fixed
  ones (`/`, `//`, `/x//`, `///`, `/X/`, non-ASCII) and 300 random ones. Each was put
  through `RedirectPaths.Key` and the JavaScript `p.replace(/\/+$/, "") || "/"`. There
  were 0 mismatches. For every path `RedirectPaths.Problem` accepts (209), `Spellings`
  is `[key, key + "/"]` (or `["/"]`) and contains the path itself.
- **The website side of the edge cases.** I ran `check:content` on the snapshot with
  redirects added:
  - `/` gives the pass line. The API refuses it as a live path.
  - `/x//` gives `A redirect's from path cannot be written into web.config`. The API
    refuses it too, by the character rule.
  - `/X` with `/x/` gives the pass line, because the build is case-sensitive
    (`ignoreCase="false"`, `web-config.ts:151`). The API is stricter, through collation
    (plan 2.2).
  - `/a → /a/` gives the pass line, because the build does not detect it. The API now
    refuses it (`Key(from) == Key(to)`).

By code reading (the database cases are NOT RUN):

- `/X/` against an existing `/x`: `Spellings("/X/")` is `["/X", "/X/"]`, and SQL `IN`
  under the case-insensitive collation finds `/x`, so the result is 409. That is stricter
  than the build.
- A trailing-slash `toPath` at a live page (`/m-old → /blogs/<live>/`) is accepted and
  stored as typed. The clean-URL rule `^(.+?)/?$` serves it. Target checks are ADM-07
  part 3.
- A rename back to an address whose slash redirect exists: the slug check (`Spellings`)
  refuses the publish with "That address is the source of a redirect." The base did the
  same for the exact spelling. This is B4.
- `ReferenceConverter --convert-references` now calls the strict `Validate` over every
  stored section, drafts included, so a draft's `id: ""` counts as a schema failure in
  its report. Plan section 4 accepts this ("the right answer for a stored-content
  check"). It is recorded here so nobody is surprised; it is not a finding.

## Findings

Most severe first. There is no Blocker and no Major.

### F-1 (Minor): two concurrent creates of `/x` and `/x/` can both succeed

- **Where:** `AdminStore.CreateRedirectAsync`. It reads with
  `AnyAsync(redirect => spellings.Contains(redirect.FromPath))`, then inserts with
  `SaveChangesAsync`. There is no transaction and no constraint on the address key.
  `IX_redirects_from_path` covers the exact stored text only, so `/x` and `/x/` do not
  collide there. Plan 3.6 rules out storing the key on purpose.
- **Steps (needs SQL Server, CI `api`):** log in as two admins. Send
  `POST /api/v1/redirects {fromPath:"/m-x", toPath:"/"}` and
  `{fromPath:"/m-x/", toPath:"/"}` at the same time, repeating until the two requests
  overlap.
- **Expected:** one 201 and one `409 redirect_exists`.
- **Actual (by reading):** both can return 201. Then every website build stops with
  `Two redirects start at /m-x/.`, which is the ADM-02 defect. `CheckRedirectAsync` would
  report the pair on the next bundle import, but nothing flags it in normal use.
- **Note:** not a regression. Before ADM-02 the pair was accepted with no race at all.
  The window is narrow and needs two people working at once. Suggest a D-NNN entry with
  an expiry, or a serializable transaction or `sp_getapplock` around the check and
  insert, in ADM-07, which changes the same function next.

### F-2 (Minor): a redirect can take over an ended vacancy's page

- **Where:** `AdminStore.OccupiesLivePathAsync` (`AdminStore.cs:643-647`) counts only
  vacancies with `Status == Published`. But the build emits ended vacancies too
  (`BuildContentStore.cs:176`, `Published || Ended`). The website renders them at
  `/careers/<slug>` with "This position is no longer open" (`VacancyPage.tsx:7-17`).
  Redirect rules run before the clean-URL rule.
- **Steps (needs SQL Server):** publish a vacancy `m-v`, then end it. Then
  `POST /api/v1/redirects {fromPath:"/careers/m-v", toPath:"/careers"}`.
- **Expected:** decide which is right. Either `400 redirect_live_path`, as for every other
  built page, or accept it on purpose, because redirecting a closed role may be what staff
  want.
- **Actual (by reading):** 201, and the ended vacancy's page answers 301.
- **Note:** this was already true at the base and is outside ADM-02's diff. It comes up
  here because condition 1 established that ended rows are built. Route it to ADM-07
  (live-path and target integrity) or to a D-NNN entry. It does not block this change.

## Coverage table rows verified

| Item | Status | Evidence (this report) |
| --- | --- | --- |
| `/x/` and `/x` are no longer both accepted | Verified in the code and by the website side (C2, W2). Database proof NOT RUN (CI `api`, R1) | 3, 7; F-1 is the remaining race |
| Redirect paths compared by the build's key in every redirect check | Verified in the code: create, live path, chain, import check, slug check, rename. Database proof NOT RUN (CI `api`, R1 to R7) | Diff review; Key and Spellings probe (0 mismatches in 313) |
| API key locked to `web-config.ts` (K1) | Verified | 3: K1 passed |
| A non-UUID section reference id is not published | Verified at the schema level (F1 green, probe). Publish path NOT RUN (CI `api`, F2, W1) | 3, 7 |
| Lower-case `uuid` asserted at publish; global registry untouched | Verified | 2 (F1 red), 3 (F1 green), 4.1 |
| Bundle import strict on published and ended rows only | Verified in the code. F5a and F5b NOT RUN (CI `api`) | 4.2, 5 |
| API format rule locked to `validate.ts` | Verified | F1 (a), (b) and the `WebsiteUuidSource` tie pass |
| A test feeds API-accepted content to the website's checks | Verified for the harness (C1 to C5, W2, the CLI cases). W1 NOT RUN (CI `api`) | 2, 3, 4.3 to 4.5 |
| `/blogs/<live-slug>/` refused; `/a → /a/` refused | Verified in the code. R2, R4 and R7 NOT RUN (CI `api`) | 7 |
| Regression tests committed and shown failing before the fix | F1 red shown locally at `7c93e52`, with no `api/src` or `api/tools` change. The 20 database reds wait on O-ADM02-1 (CI) | 1, 2 |
| No regression in the DB-free baseline (173) | Verified: 176 = 173 + F1, K1, W2; none lost | 3 |
| Moved rows (ADM-01a, ADM-07, ADM-02b) | Destinations named in `implementation.md`. Not tested here | |

## Track checklist (G3)

| Item | Result |
| --- | --- |
| Finding, evidence and fix from the audit | Yes (plan section 1, 2.2, 2.3) |
| Regression test committed and shown failing before the fix | Partly. F1 red shown locally. The 20 database reds need CI on `7c93e52`, which waits on O-ADM02-1 (gate 2's item, not this report's) |
| End-to-end test for each Major | Not applicable. ADM-02 is a Blocker. ADM-07's end-to-end test is moved to ADM-07 |
| A Minor that is not fixed becomes a D-NNN entry | F-1 and F-2 above need a D-NNN entry or a home in ADM-07 |

Every planned check that can run in this container passed. The database tests, the
browser suites, `compare:sections`, Semgrep and gitleaks are NOT RUN, and each names
the CI job that covers it. There is no Blocker and no Major.

Verdict: APPROVED
