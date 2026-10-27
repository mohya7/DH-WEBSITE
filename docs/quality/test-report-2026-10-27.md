# Test report — 27 October 2026

Every suite in the repository, run by level against commit `8ac2b74`
(`6470fac` on `rebuild/dotnet-platform` plus documentation only). Run in a
Linux container with SQL Server 2022 (16.0.4305.5) in Docker, .NET SDK
10.0.403, Node 22.22.0, and Chromium. Each level mirrors its CI job; extra
checks are marked **added**. Standard: `ENGINEERING_STANDARDS.md`.

## Summary

| Level | Result | Tests | Findings |
|---|---|---|---|
| Front End | Pass, with 1 design difference | Website 409 unit, 30 screenshot regression, 21 browser; Studio 32 unit, 26 end-to-end | Careers apply section differs from the locked design; browser suite not in CI |
| Back End | **Pass** | 475 / 475 integration tests | 13 nullable warnings |
| Database | Pass, with 1 failure | 10 checks | Idempotent migration script fails at migration 7 of 15 |
| API | **Pass** | 23 live HTTP probes: 20 pass as written, 2 pass after correcting my expectations, 1 low finding | `Server: Kestrel` header |
| Security | **Fail** | 6 gates, local and in GitHub Actions | 2 Critical and 1 High advisory in the website's `next` |

## Findings, most severe first

| # | Severity | Level | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| 1 | Critical | Security | `next` 16.3.6 in the website has GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr (unauthenticated remote code execution, Critical) and GHSA-p3m5-59mp-jv5r (denial of service, High). The npm audit gate fails. | Local gate exit 1; GitHub run 40564146727, job 122400994328 failed | Upgrade to `next@16.4.3` in its own pull request |
| 2 | High | Security | The weekly security and CodeQL schedules have never run: GitHub runs schedules only from the default branch, `main`, which has no workflows. | 0 runs with `event=schedule` | Make `rebuild/dotnet-platform` the default branch (owner decision O-2) |
| 3 | Medium | Database | The idempotent migration script (`dotnet ef migrations script --idempotent`) stops at `20260922142757_NavigationLinkRefs` with Msg 207 "Invalid column name 'link_kind'" (also `target_id`, `target_type`). The raw SQL is compiled in the same batch as the `ADD COLUMN`. A second apply fails the same way. `dotnet ef database update` is not affected. | D6 below | Wrap that migration's `migrationBuilder.Sql(...)` in `EXEC(N'...')`, or decide Phase D applies migrations with `database update` or a bundle, not the script |
| 4 | Medium | Front End | `/careers/apply.html` `#section` differs from `feature/interviewer-portal` (new form markup and an inline `<style>` block from change #33) and is not in `accepted-differences.json`. CI does not fail on it because the comparison step is `continue-on-error`. | Section comparison: 104 / 119 match, 14 accepted, 1 failure | Restore the design, or record the difference as accepted |
| 5 | Medium | Front End | The website's Playwright suite (`browser-tests/`, 29 tests) is not in `ci.yml`. 25 of them need a build with `SNAPSHOT_SETTINGS_FIXTURE=consent`. | `ci.yml` has no `test:browser` step | Add a CI step that builds with the fixture and runs the suite |
| 6 | Low | Front End | GSAP and ScrollTrigger load from `cdn.jsdelivr.net` without `integrity` (SRI) and with no fallback. When the CDN is unreachable the home page throws `gsap is not defined`. | 8 browser tests fail here only because this sandbox blocks the CDN (403) | Add SRI hashes, or serve the files from the site |
| 7 | Low | API | Responses carry `Server: Kestrel`. | Probe A2 | `options.AddServerHeader = false` on Kestrel; check the IIS header in Phase D |
| 8 | Low | Back End | 13 nullable-reference warnings (CS8601 ×9, CS8604 ×4) in the Release build; warnings are not counted by any gate. | `build.log` | Gate step 4b in `ENGINEERING_STANDARDS.md` |
| 9 | Info | API | The initial admin from `Auth:InitialAdminPassword` is not asked to change the password at first sign-in. Not a stated requirement; admin resets do set it (`AdminStore.cs:389`). | Probe A10 | Optional hardening |

## Front End level

### Website

| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npm run typecheck` | 0 | No errors |
| Unit tests | `npx vitest run` | 0 | 21 files; 409 passed, 1 skipped (a placeholder) |
| Design check | `npm run design:check` | 0 | All 25 files match `feature/interviewer-portal`: 24 identical, 1 ported with the recorded change |
| Snapshot build | `CONTENT_SOURCE=snapshot npm run build` | 0 | 28 pages; build output checks passed |
| Screenshot regression tests (Chromium) | `vitest run test/screenshot-parity-browser.test.ts` + `check-browser-test-report.mjs … 30` | 0 | 30 passed, 1 placeholder, 0 problems |
| Section comparison | `npm run compare:sections` | 1 | 104 / 119 sections match, 14 accepted, **1 differs** (finding 4). Chrome: 42 match, 36 accepted of 78. Formerly missing sections: 16 / 16 found |
| Browser tests, default build (**added**: not in CI) | `npx playwright test` | 1 | 3 passed, 1 failed (`gsap is not defined`, CDN blocked here), 25 skipped (need the consent build) |
| Browser tests, consent build (**added**) | build with `SNAPSHOT_SETTINGS_FIXTURE=consent`; `playwright test browser-tests/consent.spec.ts` | 1 | 18 passed; 7 failed, all on the final "no page errors" check (`gsap is not defined`); every consent assertion before it passed |

### Studio

| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npx tsc -b` | 0 | No errors |
| Unit tests | `npx vitest run` | 0 | 8 files; 32 passed |
| Build and preview design check | `npm run build` | 0 | Built; preview design matches `website/design/` byte for byte |
| End-to-end (Playwright, real API and SQL Server) | `npx playwright test` | 0 | **26 passed** in 2.8 min |

## Back End level

Mirrors the CI `api` job: Release build, a fresh `DigitalHubContent_Test`,
migrations with the administrator login, the restricted login granted read and
write with `DENY UPDATE, DELETE ON dbo.audit_log`, then the tests as that login.

| Check | Exit | Result |
|---|---|---|
| `dotnet build DigitalHub.slnx -c Release` | 0 | 0 errors, 13 warnings (finding 8) |
| Migrations from empty | 0 | 15 applied |
| `dotnet test` (Release) | 0 | **475 passed, 0 failed, 0 skipped**, 1 min 22 s |
| Coverage (**added**, coverlet) | — | Application code (`DigitalHub.Api` without generated migrations): about 88% of lines. By folder: Auth 96.8%, Controllers 95.7%, Identity 94.8%, Data 92.1%, Content 86.6%, Infrastructure 81.8%. `DigitalHub.Images` 74.8%; the import tool 18.5%. |

Largest test classes: ContentEndpointCoverageTests 76, SectionLinkTests 50,
ContentPublishTests 32, RichTextTests 29, ContentBundleTests 29,
CollectionLinkTests 27, CommonPasswordTests 23, Section5Tests 22,
CareersTests 16 (includes the role matrix over every `api/v1` route).

## Database level (**added**)

Run on catalogs of its own (`DigitalHubContent_DbCheck`, `_DbScript`), dropped afterwards.

| # | Check | Result |
|---|---|---|
| D1 | Model matches the migrations (`has-pending-model-changes`) | Pass: no changes since the last migration |
| D2 | Migrate a fresh catalog from empty | Pass: 15 applied |
| D3 | Roll back every migration (`database update 0`) | Pass: 0 user tables left |
| D4 | Re-apply every migration after the rollback | Pass |
| D5 | Upgrade from the previous schema (down one, up again) | Pass |
| D6 | Idempotent script applied twice to an empty catalog (`sqlcmd -i`) | **Fail**: Msg 207 at migration 7 of 15, both times (finding 3) |
| D7 | Grant the application login what production gets | Pass |
| D8 | Least privilege as `dh_content_app` | Pass: not sysadmin, db_owner or ddladmin. `audit_log`: SELECT and INSERT allowed; UPDATE and DELETE denied. `CREATE TABLE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER` on `audit_log` all refused |
| D9 | Schema integrity | Pass: 27 tables, all with a primary key; 35 foreign keys, none untrusted, disabled or without an index; 13 check constraints, none untrusted; 23 unique indexes; 0 triggers; compatibility level 160 |

The integration tests that check the database directly also passed:
AuditLogPermissionTests, AuditRollbackTests, SettingsVersionTests (concurrency),
ContentBundleTests.

## API level (**added**)

The API ran in Release with `ASPNETCORE_ENVIRONMENT=Production` on a fresh
catalog, as the restricted login. Probes are plain HTTP requests
(`api-probes.mjs`).

| # | Probe | Result |
|---|---|---|
| A1 | `/health` answers and checks the database | Pass: 200, Healthy |
| A2 | `nosniff`; no server or framework banner | **Low**: `Server: Kestrel` (finding 7); `nosniff` set; no `X-Powered-By` |
| A3 | Correlation id echoed when safe, replaced when not, generated when absent | Pass |
| A4 | All 85 protected routes refuse an anonymous caller with 401 `problem+json` | Pass: 85 / 85 |
| A5 | Unknown routes, `/swagger`, `/openapi/v1.json`, examples, `/.env`, `/appsettings.json` not served | Pass: 401 to anonymous callers (fallback policy) |
| A6a–e | Public contact: empty body 400 with per-field errors; 3 MB body 413; `text/plain` 415; malformed JSON 400 problem; GET refused | Pass (GET answers 401 from the fallback policy, not 405; expectation corrected) |
| A7 | Wrong password and unknown email get the same answer | Pass |
| A8 | `alg=none` and malformed bearer tokens refused | Pass |
| A9 | Refresh cookie `HttpOnly; Secure; SameSite=Strict`, path `/api/v1/auth` | Pass |
| A10 | Initial password must be changed first | Not a requirement (finding 9); change-password itself returns 204 |
| A11 | Admin lists pages (`items, page, pageSize, total`) and users | Pass |
| A12 | Admin cannot read application counts (HR only) | Pass: 403 |
| A13 | Unknown record and unknown collection | Pass: 404 `not_found` |
| A14 | Empty write: 400 `validation_failed` with field errors; unknown field rejected | Pass |
| A15 | Refresh without the CSRF header | Pass: 403 `csrf_failed`; with it 200 |
| A16 | CORS grant to another origin | Pass: none |
| A17 | No stack traces, SQL or file paths in 119 responses | Pass |
| A18 | Sign-in rate limit (`Auth:LoginPermitLimit` = 8) | Pass: 429 at attempt 9 |

## Security level

| Gate | Local | GitHub Actions run 40564146727 (this branch) |
|---|---|---|
| Security gate self-test | Pass: 62 / 62 | success |
| npm audit, website | **Fail**: 3 new (2 Critical, 1 High), 3 known | **failure** |
| npm audit, Studio | Pass: 0 findings | success |
| NuGet vulnerable packages | Pass: 0 in all three projects | success |
| gitleaks 8.30.1, full history (280 commits) | Pass: 2 known, 0 new | success |
| Semgrep 1.180.0 | NOT RUN locally: the rule registry (`semgrep.dev`) is blocked in this container | **success** |
| CodeQL | NOT RUN: skipped for a private repository | — |

## NOT RUN

| Item | Reason | Covered by |
|---|---|---|
| Semgrep locally | Rule registry blocked | GitHub run 40564146727 (success) |
| CodeQL | Private repository without Code Security | Nothing |
| Screenshot parity in Firefox and WebKit | Only Chromium is available here | CI job "Screenshot parity" (label `screenshots`) |
| Exposure test, black-box tests through the proxy, dynamic scan | Need the Phase D deployment | Nothing yet |

## Environment notes

- Chromium is build 1243; the repository's Playwright 1.56.1 expects build 1194,
  which could not be downloaded here. Tests ran on 1243 through a private
  `PLAYWRIGHT_BROWSERS_PATH`.
- `cdn.jsdelivr.net`, `semgrep.dev` and the .NET download host are blocked by
  this container's network policy. The .NET SDK came from the official
  `mcr.microsoft.com/dotnet/sdk:10.0` image.
- The Studio harness called `sqlcmd` through a wrapper that runs mssql-tools18
  inside the SQL Server container.
