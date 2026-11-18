# ADM-02: implementation

Developer, step 4, 11 November 2026. Plan: `docs/changes/ADM-02/plan.md` round 2
(`46d9bbc`). Review: `plan-review.md` Round 2 (`c8ff97a`), APPROVED. Gate 1:
`plan-approval.md` (`432bdf1`), ends `Verdict: APPROVED`. Worktree
`/home/user/dh-change-adm02`, branch `change/ADM-02`, base `77296ba`.

**Nothing is pushed** (condition 4). O-ADM02-1 is still PENDING, so the branch
stays local and no pull request is open. The tester works from the local SHAs
below.

## Commits

| # | SHA | Subject | What |
| --- | --- | --- | --- |
| 1 | `7c93e52` | ADM-02: Test that API-accepted content passes the website's checks | Tests and the website-check harness only. No change under `api/src/` or `api/tools/` |
| 2 | `14c244e` | ADM-02: Compare redirect addresses as the website build does | Redirect fix and K1 |
| 3 | `244444c` | ADM-02: Assert lower-case uuids on published rows, at publish and import | Format fix, `ContentBundle.cs`, and the F1 constant tie |
| 4 | this file | ADM-02: Record the implementation | `implementation.md` only |

Commit 1 holds no file under `api/src/` or `api/tools/`:

```
$ git show --stat --format=%h 7c93e52 | grep -E "api/src|api/tools"; echo $?
1
```

Every commit stages exact paths, has an `ADM-02:` imperative subject and a body
that says why, and ends with the attribution trailer.

## What changed, file by file (plan section 4)

### Commit 1: tests and harness

| File | Plan row | What |
| --- | --- | --- |
| `website/src/content/check-content.ts` (new) | Files to create | `checkContent(content)`: `validateContent(content)`, then `renderWebConfig(content.redirects ?? [], { tagManager })` as `scripts/write-web-config.ts` calls it. A `WebConfigError` becomes one more line, and any other error is rethrown. No new rule |
| `website/scripts/check-content.ts` (new) | Files to create | CLI: reads the file named on the command line, prints each problem and exits 1, or prints `The content passed the website's schema, media and redirect checks (not the route or output checks).` and exits 0. With no argument it prints the usage line and exits 2 |
| `website/package.json` | Files to change | `"check:content": "tsx scripts/check-content.ts"`. Nothing else. The lockfile is not touched |
| `website/test/check-content.test.ts` (new) | Files to create | C1 to C5 |
| `api/tests/DigitalHub.Api.Tests/RedirectAddressTests.cs` (new) | Files to create | R1 to R7 (database) |
| `api/tests/DigitalHub.Api.Tests/SchemaFormatTests.cs` (new) | Files to create | F1 (DB-free), F2 to F4 (database) |
| `api/tests/DigitalHub.Api.Tests/ApiAcceptedContentTests.cs` (new) | Files to create | W1 (database), W2 (DB-free canary). It also holds two `internal` helpers the ADM-02 tests share: `WebsiteCheck` (finds `website/`, fails with "Run npm ci in website/ first." if the `tsx` bin is missing, runs `node website/node_modules/tsx/dist/cli.mjs scripts/check-content.ts <file>` from `website/`) and `Adm02Run` (the run marker, the admin session, API helpers, and cleanup on dispose) |
| `api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs` | Files to change | F5a and F5b, plus one private helper `CaseCardsSection`. No existing test changes |
| `.github/workflows/ci.yml` | Files to change | Job `api`, before "Integration tests (Release)": `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0` (`node-version: ${{ env.NODE_VERSION }}`, `cache: npm`, `cache-dependency-path: website/package-lock.json`), then `run: npm ci` with `working-directory: website`. No `if:`, no `continue-on-error`, nothing else |

### Commit 2: redirects (plan 3.1)

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Content/RedirectPaths.cs` | `Key(path)`: trailing slashes removed, `"/"` if nothing is left (`web-config.ts`'s `row.fromPath.replace(/\/+$/, "") \|\| "/"`). `Spellings(path)`: `["/"]` for `"/"`, else `[key, key + "/"]`. The summary says the key is `web-config.ts`'s |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | `CreateRedirectAsync`: self-redirect is `Key(from) == Key(to)` (`redirect_loop`); duplicate is `spellings.Contains(r.FromPath)` (`409 redirect_exists`, SQL `IN`). `OccupiesLivePathAsync` compares each `PublicPath` with `Key(fromPath)`. `ResolveDestinationAsync`: `visited` holds keys, each hop is looked up by `Spellings(current)`, a loop is `Key(current) == Key(from)`. `CheckRedirectAsync` (import): the same, plus "Another redirect starts at the same address." on `fromPath` for a row with another `Id` whose `FromPath` is in `Spellings(from)`. Nothing else in the file |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | `CheckAsync`'s slug check uses `Spellings(path)`. `RetargetAsync`: the query uses `oldSpellings.Contains(FromPath)`, the loop filter is `Key(FromPath) != oldPath`, the self-check is `Key(FromPath) == Key(ToPath)`, and `own` is `Key(FromPath) == oldPath`. The `ToPath` comparisons are unchanged (ADM-07 part 3) |
| `api/tests/DigitalHub.Api.Tests/RedirectAddressRuleTests.cs` (new) | K1 |

### Commit 3: formats (plan 3.2)

| File | What |
| --- | --- |
| `api/src/DigitalHub.Api/Content/SchemaFormats.cs` (new) | `WebsiteUuidSource` = `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. `Uuid` = `\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z`, `CultureInvariant`. `Asserting()`: `OutputFormat.List`, `RequireFormatValidation = true`, `FormatRegistry = new FormatRegistry()` holding `new RegexFormat("uuid", Uuid)`. `Annotating()`: today's options |
| `api/src/DigitalHub.Api/Content/SectionSchemaSet.cs` | Holds both option sets. `Validate` asserts; the new `ValidateDraft` does not |
| `api/src/DigitalHub.Api/Content/CollectionSchemaSet.cs` | Same |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | `CheckAsync` and `CheckDocumentAsync` take `publishing` and choose `Validate` or `ValidateDraft`, for the collection fields and for each section. Publish passes `true`; save (two sites), restore and unpublish pass `false` |
| `api/tools/DigitalHub.ContentImport/ContentBundle.cs` | Collection rows: `publishing: built`, where `built = record.Status is ContentStatus.Published or ContentStatus.Ended`. Working copies: `publishing: false`. Nothing else |
| `api/tests/DigitalHub.Api.Tests/SchemaFormatTests.cs` | One assertion: `Assert.Equal(WebsiteUuidRegex, SchemaFormats.WebsiteUuidSource)` |

### Final signatures (condition 2)

```csharp
public Task<Dictionary<string, List<string>>> CheckDocumentAsync(string collection, Guid id, DraftDocument draft, bool publishing, CancellationToken cancellationToken) =>
    CheckAsync(collection, id, draft, publishing: publishing, cancellationToken);

private async Task<Dictionary<string, List<string>>> CheckAsync(string collection, Guid id, DraftDocument draft, bool publishing, CancellationToken cancellationToken, bool requireMedia = true)
```

Every call site names it:

```
$ grep -n "CheckAsync(\|CheckDocumentAsync(" api/src/DigitalHub.Api/Content/ContentStore.cs api/tools/DigitalHub.ContentImport/ContentBundle.cs
ContentStore.cs:311  ... CheckAsync(collection, id, draft, publishing: true, cancellationToken))            (publish)
ContentStore.cs:367  ... CheckAsync(collection, id, draft, publishing: false, cancellationToken);          (unpublish)
ContentStore.cs:450  ... CheckAsync(collection, id, draft, publishing: false, cancellationToken, requireMedia: false);  (restore)
ContentStore.cs:596  ... CheckAsync(collection, record.Id, draft, publishing: false, cancellationToken);   (create)
ContentStore.cs:634  ... CheckAsync(collection, id, draft, publishing: false, cancellationToken);          (save, sections)
ContentStore.cs:682  ... CheckAsync(collection, id, draft, publishing: publishing, cancellationToken);
ContentBundle.cs:390 ... CheckDocumentAsync(table.Collection!, id, draft, publishing: built, cancellationToken)
ContentBundle.cs:414 ... CheckDocumentAsync(collection, ownerId.Value, draft, publishing: false, cancellationToken)
```

### Scope (condition 5)

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD     (before this file was added)
 .github/workflows/ci.yml                           |    9 +
 api/src/DigitalHub.Api/Content/AdminStore.cs       |   29 +-
 .../DigitalHub.Api/Content/CollectionSchemaSet.cs  |   23 +-
 api/src/DigitalHub.Api/Content/ContentStore.cs     |   44 +-
 api/src/DigitalHub.Api/Content/RedirectPaths.cs    |   26 +
 api/src/DigitalHub.Api/Content/SchemaFormats.cs    |   49 +
 api/src/DigitalHub.Api/Content/SectionSchemaSet.cs |   23 +-
 .../ApiAcceptedContentTests.cs                     |  473 ++++++++
 .../DigitalHub.Api.Tests/ContentBundleTests.cs     |   55 +
 .../RedirectAddressRuleTests.cs                    |   52 +
 .../DigitalHub.Api.Tests/RedirectAddressTests.cs   |  182 +++
 .../DigitalHub.Api.Tests/SchemaFormatTests.cs      |  192 ++++
 .../DigitalHub.ContentImport/ContentBundle.cs      |    8 +-
 docs/changes/ADM-02/plan-approval.md               |  256 +++++
 docs/changes/ADM-02/plan-review.md                 |  397 +++++++
 docs/changes/ADM-02/plan.md                        | 1196 ++++++++++++++++++++
 website/package.json                               |    1 +
 website/scripts/check-content.ts                   |   29 +
 website/src/content/check-content.ts               |   31 +
 website/test/check-content.test.ts                 |   87 ++
 20 files changed, 3129 insertions(+), 33 deletions(-)
```

Exactly the 17 files of plan section 4, the three earlier pipeline records, and
now this file. No Studio file, no migration, no lockfile.

## Commands run, with results

Setup for every .NET run: `source .../scratchpad/dn.sh`, working directory
`api/`, `CS="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`.
Port 4299 has no listener, and `ApiFactory` rewrites the catalog to
`DigitalHubContent_Test`, so no database is reached. A fresh `HOME` under
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/adm02-dev/`
for each test run. Logs are in that folder.

### At commit 1 (red)

| Command | Exit | Relevant output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)`. All 13 are in existing code (`DigitalHub.ContentImport` CS8601/CS8604); none is in an ADM-02 file |
| W2 before `npm ci` (condition 8): `dotnet test ... --filter "...ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"` | 1 | `Failed ... The_website_check_fails_on_a_bad_file` with `Run npm ci in website/ first.` It fails; it does not skip |
| `npm ci` in `website/` (unchanged lockfile) | 0 | Installed; `git status` shows no lockfile change |
| F1 and W2: `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~DigitalHub.Api.Tests.SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case\|FullyQualifiedName~DigitalHub.Api.Tests.ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"` | 1 | `Failed: 1, Passed: 1, Total: 2`. W2 passes. F1 fails at (c), quoted below |
| `npx vitest run test/check-content.test.ts` | 0 | `Tests 5 passed (5)` (C1 to C5) |
| `npm run typecheck` | 1, then 0 | See "Failures reported before fixing" |
| `node -e` with the `validate.ts` expression on F1's nine cases | 0 | `true` for lower and upper case valid; `false` for `not-a-uuid`, `""`, 32 digits, braces, leading space, trailing `\n`, full-width digit. Same as F1's table |

F1's red, as run (`SchemaFormatTests.cs:84`):

```
Failed DigitalHub.Api.Tests.SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case [2 s]
Error Message:
 upper-case valid "01234567-89AB-CDEF-0123-456789ABCDEF": website accepts, API accepts, expected the API to refuse
not-a-uuid "not-a-uuid": website refuses, API accepts, expected the API to refuse
not-a-uuid: the website refuses it and the API does not
empty "": website refuses, API accepts, expected the API to refuse
empty: the website refuses it and the API does not
32 digits "0123456789abcdef0123456789abcdef": website refuses, API accepts, expected the API to refuse
32 digits: the website refuses it and the API does not
braces "{01234567-89ab-cdef-0123-456789abcdef}": website refuses, API accepts, expected the API to refuse
braces: the website refuses it and the API does not
leading space " 01234567-89ab-cdef-0123-456789abcdef": website refuses, API accepts, expected the API to refuse
leading space: the website refuses it and the API does not
trailing newline "01234567-89ab-cdef-0123-456789abcdef\n": website refuses, API accepts, expected the API to refuse
trailing newline: the website refuses it and the API does not
full-width digit "０1234567-89ab-cdef-0123-456789abcdef": website refuses, API accepts, expected the API to refuse
full-width digit: the website refuses it and the API does not
```

(a) and (b) passed: `validate.ts` has exactly one `addFormat`, the expected one,
and the schemas use only `"uuid"`.

### At commit 2

| Command | Exit | Relevant output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |
| `dotnet test ... --filter "FullyQualifiedName~RedirectAddressRuleTests\|FullyQualifiedName~RedirectPathRuleTests.The_api_rule_is_the_website_builds_rule\|FullyQualifiedName~ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file"` | 0 | `Passed: 3, Total: 3` (K1, the existing L5 drift test, W2) |

### At commit 3 (green)

| Command | Exit | Relevant output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. The same 13 as the base (2.4); none in an ADM-02 file |
| F1, W2, K1 (the 5.3 filter plus K1) | 0 | `Passed ... RedirectAddressRuleTests.The_api_address_is_the_website_builds_address`, `Passed ... SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case`, `Passed ... ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file` |
| Full suite, no database: `dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=.../adm02-dev/adm02-after.trx"` | 1 (expected: no SQL Server) | `Failed: 344, Passed: 176, Skipped: 0, Total: 520`. Base: `Failed: 321, Passed: 173, Total: 494`. 26 new cases (R 11, F1-F4 10, F5 2, W 2, K1 1); 23 of them need SQL Server |
| Passed names against `adm02/base-passed.txt` (173 names; the file stores XML entities, so both sides were unescaped before `comm`) | 0 | Lost: none. New: `ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file`, `RedirectAddressRuleTests.The_api_address_is_the_website_builds_address`, `SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case`. Exactly 173 + F1, K1, W2 (condition 10; the baseline file was present and was not regenerated) |
| `npm run typecheck` (website) | 0 | `tsc --noEmit`, no output |
| `npx vitest run` (website, whole suite) | 0 | `Test Files 22 passed \| 1 skipped (23)`, `Tests 425 passed \| 31 skipped (456)`. The skips are the existing conditional skips in `design.test.ts`, `check-browser-test-report.test.ts` and `screenshot-parity-browser.test.ts`, none in an ADM-02 file |
| `npm run -s check:content -- fixtures/snapshot/content.json` | 0 | The pass line |
| `npm run -s check:content` (no file) | 2 | `Name the content file: npm run check:content -- <file>` |
| actionlint, pinned as `workflow-lint.yml` pins it: `install-actionlint.sh` (actionlint 1.7.12, shellcheck 0.11.0, sha256 checked) into the scratchpad, then `RUNNER_TEMP=... ACTIONLINT_BLOCKING_FROM=2026-11-18 .github/lint/run-actionlint.sh workflows` | 0 | `actionlint: 0 findings in .github/workflows` |
| `.github/lint/run-actionlint.sh canary` | 0 | `actionlint canary: all 6 expected findings reported` |
| Scratchpad probe of the built `DigitalHub.Api.dll` (`adm02-dev/probe`) | 0 | `options registry is global: False`; `global uuid unchanged: True (PredicateFormat)`; strict refuses `not-a-uuid`, `""`, upper case, trailing `\n`, leading space, 32 digits and braces with `/items/0/reference/id format: Value is not a match for the format 'uuid'.`, accepts the lower-case form; `ValidateDraft` gives 0 errors for all of them. Same as plan 2.3 |

### Failures reported before fixing

1. **Website typecheck, at commit 1, before the commit.** `npm run typecheck`
   exited 1:
   ```
   test/check-content.test.ts(84,40): error TS2345: Argument of type '{ type: string; id: string; }' is not assignable to parameter of type 'Pick<Reference, "id" | "type">'.
   ```
   That was my new C5 test's cast. It now casts to `Pick<Reference, "type" | "id">`.
   Typecheck exits 0 and C1 to C5 still pass. Commit 1 holds the fixed file.
2. **The first `SchemaFormats.Asserting()` changed the global format registry.**
   It was found before commit 3, by the probe above. That version registered `uuid`
   into `options.FormatRegistry`. In JsonSchema.Net 8.0.5, a new
   `EvaluationOptions` hands out `FormatRegistry.Global` by default, so the probe
   printed `options registry is global: True` and the global `uuid` became the
   `RegexFormat`. That is the side effect plan 3.2 and 3.6 rule out. The fix
   follows the plan as written: the options get `FormatRegistry = new FormatRegistry()`
   (the library has a public constructor and setter). The probe now shows the
   global registry unchanged, as in plan 2.3. This was my coding error, not a gap
   in the plan, so condition 6 does not apply. The tester may want to check the
   global registry again (gate 1, "What the tester must do", item 7).

## NOT RUN, and what shows it

There is no SQL Server in this container. Each database test below was built
and ran against the unreachable server, and failed on the connection. That is
neither red nor green. It is NOT RUN, and CI job `api` (`.github/workflows/ci.yml`,
"Integration tests (Release)", SQL Server 2022 service) runs it.

| Test | Red expected at `7c93e52` (plan 5.1) | Green expected at `244444c` | Shown by |
| --- | --- | --- | --- |
| R1 (2 cases) | second POST 201, total 2 | 409 `redirect_exists`, total 1 | CI `api` |
| R2 (2) | 201 | 400 `redirect_loop` | CI `api` |
| R3 | loop 201; chain `toPath` `/m-p/` | 400 `redirect_loop`; `toPath` `/m-q` | CI `api` |
| R4 (3) | 201 | 400 `redirect_live_path` | CI `api` |
| R5 | publish 200 | 400 `publish_blocked`, "source of a redirect" | CI `api` |
| R6 | two rows at `/<m>` | one row, `ToPath` `/<m>-new` | CI `api` |
| R7 | no errors | `fromPath` and `toPath` errors | CI `api` |
| F2 (5) | publish 200 | 400 `publish_blocked`, `format 'uuid'` | CI `api` |
| F3 (2) | save 200 (guard) | save 200 | CI `api` |
| F4 (2) | publish 200 | 400 `publish_blocked`, `format 'uuid'` | CI `api` |
| F5a | `Ok` true | `Ok` false, `pages <PageId>: sections[0]` with `format 'uuid'`, 0 pages | CI `api` |
| F5b | `Ok` true (guard) | `Ok` true | CI `api` |
| W1 | exit 1 with the three lines of plan 5.1 | no line from this run | CI `api` (needs the new Node steps) |

- **The CI red at commit 1 (20 database cases plus F1) is not shown.** That waits
  on O-ADM02-1 (condition 4). While it is unanswered, nothing is pushed.
- **W1 cannot be run here**, so condition 6 ("a this-run line other than the
  three") can only be checked in CI. W1 prints every problem line with the prefix
  `website check:` in the test output, so the CI log shows it.
- **Website build, `design:check`, `compare:sections`, Playwright:** NOT RUN.
  ADM-02 changes no page, style or component, only a new module, a script and a
  test. CI jobs `website` (typecheck, tests, design check, snapshot build),
  `section-compare` and `website-browser` cover them.
- **Studio:** no Studio file changed. CI job `studio` (unit and end-to-end,
  including 10.21 at `studio.spec.ts:163`) covers it.
- **`npm audit`:** not run by me. That is the tester's step (gate 1, item 5). No
  dependency changed.
- **`security.yml`:** CI.

## Migrations

None. No entity, column, index or constraint changes, and no row is rewritten
(plan section 7). Nothing was applied to any database.

## Conditions from gate 1

1. **Ended rows are strict.** `ContentBundle.CheckAsync` passes
   `publishing: built` with `built = record.Status is ContentStatus.Published or ContentStatus.Ended`.
   This is what `BuildContentStore.cs:175-177` builds. The code follows this
   condition, **not** plan 3.2's last bullet ("`Ended` ... is checked as a
   draft"), which gate 1 found wrong. The plan is not edited. No new test, as the
   condition says: vacancies have no sections, and F1 (b) pins the collection
   schemas to have no `format` at all.
2. **`publishing` has no default.** It is a required `bool` before
   `CancellationToken` on both methods. `requireMedia = true` is the only optional
   parameter, and every call site names it (signatures and call sites above).
3. **Commit order as 5.2.** `7c93e52` holds tests and harness only (no
   `api/src/` or `api/tools/`). K1 is in `14c244e`. `244444c` adds the one
   `SchemaFormats.WebsiteUuidSource` assertion. Each commit has an `ADM-02:`
   subject, a body, and the trailer. Paths were staged by name. No force-push,
   and no push at all.
4. **Pushes.** None. No pull request. O-ADM02-1 is PENDING. On "Yes", push
   `7c93e52` alone with `git push origin 7c93e52:refs/heads/change/ADM-02`, open
   the pull request, record the CI run and its failing tests, then push the rest
   with `git push origin change/ADM-02`. On "No", push the branch and open the pull
   request, and the plan's "No" branch applies.
5. **Scope.** See "Scope" above.
6. **Stop on surprise.** The asserting options now behave as the 2.3 probes (see
   failure 2 above). W1's lines can only be seen in CI. If W1 shows a this-run
   line other than the three in 5.1, the change goes back to the architect.
7. **CI step.** As specified, SHA-pinned, with no `if:` or `continue-on-error`.
   actionlint reports 0 findings, and the canary passes.
8. **No skip.** W2 failed with "Run npm ci in website/ first." before `npm ci`.
   W1 uses the same runner.
9. **Databases and ports.** Only the unreachable `127.0.0.1,4299` string was used.
   No database was reached, and no port was opened. Each database test makes a
   marker (`adm02-` plus 8 hex digits) that every path, slug and title starts
   with. Each one cleans up when `Adm02Run` is disposed (`await using`, the
   tests' `finally`):
   - redirects found by `?search=<marker>`, deleted through `DELETE /api/v1/redirects/{id}`;
   - items unpublished and then deleted through the API, or set back to draft in
     the database if the unpublish is refused;
   - media deleted through `DELETE /api/v1/media/{id}`;
   - then a database sweep of redirects whose `FromPath` starts with `/<marker>`,
     for rows a test inserted directly (R6, R7).

   The cleanup is best effort and never throws, so it cannot hide the test's own
   failure. F5 runs in `InTransactionAsync`, which rolls back.
10. **Baseline.** The file was present (173 lines). The diff is above: no name
    lost, and F1, K1 and W2 added.
11. **Pull request body.** Not written yet: there is no pull request (condition 4).
    When it is opened, it must list under "Owner decisions":
    - B1 to B7, with B4 stated plainly: a live page with a slash redirect cannot be
      saved until the redirect is deleted;
    - O-ADM02-1 and O-ADM02-2, with their status;
    - the ADM-07 split;
    - the ADM-02b proposal.

## Notes for the tester

- **The `checkContent` settings guard.** It computes
  `tagManager = content.settings != null && tagManagerId(content.settings) !== null`.
  Without the null check, content with no `settings` would throw a `TypeError`
  before `validateContent`'s "The content has no "settings"." line could be
  reported. This is an argument guard, not a new rule.
- **The CLI's exit codes.** It exits 2 when no file is named. A file that is
  missing or not JSON throws, and `tsx` exits non-zero. Neither case can print the
  pass line.
- **F1 reports every case.** It collects all disagreements and then asserts that
  there are none, so the red names every case, `not-a-uuid` included, not just the
  first. Its website verdicts are a table checked against Node (above), not a
  .NET copy of the website's expression.
- **What W1's scoped file contains.** It keeps the whole media list, as returned.
  So a media-row problem from another test's upload would be printed, not
  asserted, because only lines that hold the marker or an id the test sent (the
  upper-case media id, the target id) count as this run's.
- **Bodies are searched as text.** The publish refusals are searched in the parsed
  JSON string values (`Adm02Run.Strings`), not in the raw body, so an escaped `'`
  (`'`) cannot hide `format 'uuid'`.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `/x/` and `/x` are no longer both accepted | Audit ADM-02, bullet 1 | Done; DB proof NOT RUN (CI `api`) | `AdminStore.CreateRedirectAsync` uses `Spellings` (`14c244e`). R1 in CI. C2 and W2 show that the website stops on the pair |
| Redirect paths are compared by the build's address key in every redirect check: create (duplicate, self), live path, loop and chain, import check, slug is a source (save and publish), rename | Audit ADM-02, Fix 1 | Done; DB proof NOT RUN (CI `api`) | `14c244e`: `AdminStore.cs` (four functions), `ContentStore.cs` (slug check, `RetargetAsync`). R1 to R7 in CI |
| The API key is locked to `web-config.ts`'s key (drift guard) | Audit ADM-02, bullet 1 | Done | K1 passes (`RedirectAddressRuleTests`, run above) |
| A non-UUID section reference id is not published | Audit ADM-02, bullet 2 | Done; DB proof NOT RUN (CI `api`) | F1 green: `not-a-uuid` refused by `Validate`. `PublishAsync` passes `publishing: true` (`244444c`). F2 and W1 in CI |
| The API asserts the build's `uuid` format, lower case only, at publish | Audit ADM-02, Fix 2; review round 1 finding 2 | Done; DB proof NOT RUN (CI `api`) | F1 red at `7c93e52`, green at `244444c`. Probe: global registry unchanged. F2 and F4 in CI |
| The bundle import is strict on published rows only; drafts and working copies still import | Audit ADM-02, Fix 2; review round 1 finding 1; gate 1 condition 1 | Done; DB proof NOT RUN (CI `api`) | `ContentBundle.cs`: Published or Ended strict, working copies `false` (`244444c`). F5a and F5b in CI |
| The API's format rule is locked to `validate.ts` (drift guard) | Audit ADM-02, Fix 2 | Done | F1 (a), (b) and the `WebsiteUuidSource` tie pass |
| A test feeds API-accepted content to the website's checks | Audit ADM-02, Fix 3 | Done; W1 NOT RUN (CI `api`) | `check-content.ts`, `scripts/check-content.ts`, `check:content`. C1 to C5 pass; W2 passes and fails closed without `node_modules`; `ci.yml` installs Node in `api` |
| Report a failed build in the Studio | Audit ADM-02, Fix 4 | Moved to ADM-01a | Plan 3.5 |
| `/blogs/<live-slug>/` (a trailing slash on a live address) is refused | Audit ADM-07, bullet 1 | Done; DB proof NOT RUN (CI `api`) | `OccupiesLivePathAsync` compares `Key(fromPath)`. R4 (pages, case studies, blog posts) in CI |
| `/a → /a/` is refused | Audit ADM-07, bullet 2 | Done; DB proof NOT RUN (CI `api`) | `Key(from) == Key(to)` in create and import. R2 and R7 in CI |
| A target that does not exist: Studio warning and build report (Phase C 10.7) | Audit ADM-07, bullet 3 | Moved to ADM-07 | Plan 3.4. `ToPath` comparisons left as stored |
| Redirect `ToPath` comparisons on delete and rename | Found in the plan (2.2) | Moved to ADM-07 | Unchanged in `ContentStore.DeleteAsync` and `RetargetAsync` |
| End-to-end test for the Major | G3 checklist, ADM-07 | Moved to ADM-07 | Plan 3.4 |
| Rich-text ids in the form the website looks up | Found in plan round 2 (2.3) | Moved to ADM-02b (proposed; the coordinator schedules it) | `RichText.cs` not touched |
| The old-site importer's schema check | Review round 1 finding 3 | Out of scope, with the reason (plan section 4) | `ContentWriter.cs`, `SectionPreview.cs` not touched |
| Existing rows that the new rules refuse are listed and fixed | Plan section 7; review round 1 finding 4 | Waits on O-ADM02-2 (PENDING) | Read-only queries (a), (b) and `check:content` (c) are in plan section 9. Nothing was run against `DigitalHubContent_Studio` |
| Regression tests committed and shown failing before the fix | G3 checklist; refinement plan Track G3 | Partly: local red shown for F1; CI red for 20 database cases waits on O-ADM02-1 | `7c93e52` before `14c244e` and `244444c`. F1 red quoted above |
| No regression in the DB-free baseline (173 names at `77296ba`) | P-8 | Done | 176 passed = 173 + F1, K1, W2; none lost |

Status: READY FOR TEST
