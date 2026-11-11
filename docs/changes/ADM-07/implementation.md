# ADM-07: implementation

Developer, 11 November 2026. Plan `docs/changes/ADM-07/plan.md` round 2 (`1145b3f`),
review round 2 (`cd2091c`, `Verdict: APPROVED`), gate 1 `plan-approval.md` (`309b18a`,
`Verdict: APPROVED`, eight conditions). Branch `change/ADM-07` in
`/home/user/dh-change-adm07`, base `origin/rebuild/dotnet-platform` at `6262f48`.

Nothing is pushed by me. The coordinator pushes commit 1 alone first (O-ADM07-1, "Yes,
red tests first"), then the rest after commit 1's CI jobs `api`, `website` and `studio`
have finished (condition 3). No pull request is opened by me.

## Before starting

- Read `CLAUDE.md` (= `AGENTS.md`), `docs/changes/README.md`, the plan, `plan-review.md`
  (both rounds) and `plan-approval.md`. `plan-approval.md` ends `Verdict: APPROVED`.
- `ENGINEERING_STANDARDS.md` and `docs/PROJECT_PROFILE.md` do not exist in the worktree,
  as the plan and both gates record. Rule ids are used as `docs/changes/README.md` uses
  them.
- No SQL Server is reachable in this container (plan 2.6). Nothing touched any
  database. `DigitalHubContent` was never written.

## Commits

| # | SHA | Subject | Kind |
| --- | --- | --- | --- |
| 1 | `6c842ae` | ADM-07: Test that redirects land on a page and never share an address | Red tests only (B-6) |
| 2 | `1a82b34` | ADM-07: Test the Studio's redirect warning | Red tests only |
| 3 | `4787b11` | ADM-07: Compare redirect targets by address on delete and rename | Fix |
| 4 | `147ac92` | ADM-07: Tell staff when a redirect points at no page | Fix |
| 5 | `4e2baf5` | ADM-07: Report redirects with no page in the build | Fix (+ K2) |
| 6 | `a1f2185` | ADM-07: Make a redirect's checks and insert one unit | Fix |
| 7 | `5c70cb1` | ADM-07: Treat an ended vacancy's page as live for redirects | Fix |
| 8 | (this file) | ADM-07: Record the implementation | Record |

Every commit was staged by exact path (B-5), has the `ADM-07:` prefix, an imperative
subject, a body that says why, and the two trailers. Commit 1 holds only
`RedirectTargetTests.cs`, `RedirectConcurrencyTests.cs`,
`website/test/redirect-targets.test.ts` and `studio/e2e/redirects.spec.ts`: nothing
under `api/src`, `studio/src`, `website/src` or `website/scripts`.

## What changed, by Scope (plan section 4)

### Files created

| File | Commit | What |
| --- | --- | --- |
| `api/tests/DigitalHub.Api.Tests/RedirectTargetTests.cs` | 1 | T1 to T6 and T9 (database). Also `Adm07Run`, the ADM-07 test-run helper (see "Deviations", 2) |
| `api/tests/DigitalHub.Api.Tests/RedirectConcurrencyTests.cs` | 1 | T7, T8, T10 (database), with `GatedApiFactory : ApiFactory` and the `RedirectReadGate` command interceptor |
| `website/test/redirect-targets.test.ts` | 1 | W1 to W4 |
| `studio/e2e/redirects.spec.ts` | 1 | E1 |
| `studio/test/redirects.test.tsx` | 2 | S1 to S3 |
| `api/src/DigitalHub.Api/Content/RedirectTargets.cs` | 4 | `StaticPaths`, `ErrorPageKeys` (condition 1), `LivePathsAsync`, `Resolves` |
| `api/tests/DigitalHub.Api.Tests/RedirectTargetRuleTests.cs` | 5 | K2 (DB-free) (see "Deviations", 3) |

### Files changed

| File | Commit | What |
| --- | --- | --- |
| `api/src/DigitalHub.Api/Content/ContentStore.cs` | 3 | `DeleteAsync`: redirects whose `ToPath` is any spelling of the deleted item's path are removed. `RetargetAsync`: `oldSpellings.Contains(redirect.ToPath)` in the query and the chain filter; the comment now says targets are compared by address. Nothing else |
| `api/src/DigitalHub.Api/Content/BuildContentStore.cs` | 4 | `ErrorSlugs` from `private` to `internal`. No behaviour change |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | 4 | `ListRedirectsAsync`: one `LivePathsAsync` per request, `targetLive` on each row. `CreateRedirectAsync`: `targetLive` on the 201 body, computed on the stored (collapsed) `ToPath` |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | 6 | `CreateRedirectAsync`: `BeginTransactionAsync` (read committed) after the input and self checks, then `sp_getapplock @Resource = N'digitalhub:redirects', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 5000` through an output parameter; `@result < 0` returns `503 redirect_busy` "Another redirect is being saved. Try again."; `CommitAsync` after `SaveChangesAsync`. Early returns dispose the transaction (rollback, lock released). `targetLive` is computed after the commit, so the lock is not held for it |
| `api/src/DigitalHub.Api/Content/AdminStore.cs` | 7 | `OccupiesLivePathAsync`: vacancy predicate `Published || Ended`, as `BuildContentStore.cs:176` |
| `studio/src/pages/RedirectsPage.tsx` | 4 | `RedirectRow.targetLive?: boolean`; the To column shows the path and, when `targetLive === false`, a "No page" marker (warning colour `var(--dh-warning)` on text and an inline SVG icon only, `title` as the plan words it); after a create with `targetLive: false`, `message.warning("Redirect created, but no published page answers at <toPath>. Visitors who follow it see the 404 page.")` instead of "Redirect created.". A row without the field shows no marker |
| `website/scripts/check-output.ts` | 5 | Exported `redirectTargetReport(outDir, redirects)`: key `toPath.replace(/\/+$/, "") \|\| "/"`, file `htmlFileFor(key)`, looked up in the walked file list (a `Set`, never `fs.existsSync`); `404.html` and `500.html` never count. `main()` prints `Redirect targets: all <n> resolve to a page.` or `Redirect targets: <k> of <n> point at no page (reported, not a failure):` and the lines. Nothing is added to `report.problems`. Header comment gains one bullet |

No `*.csproj`, lockfile, `package.json`, workflow, `ApiFactory.cs` or `Adm02Run` change
(condition 5), and no migration (plan section 7):

```
$ git diff --name-only 309b18a..HEAD -- '*.csproj' '*package*.json' '.github/*' api/tests/DigitalHub.Api.Tests/ApiFactory.cs api/tests/DigitalHub.Api.Tests/ApiAcceptedContentTests.cs | wc -l
0
$ sha256sum -c lock-before.txt      # taken before npm ci, checked after every build
website/package-lock.json: OK
studio/package-lock.json: OK
```

## Deviations from the plan

1. **`RedirectTargets.ErrorPageKeys` (authorised by gate 1, condition 1).**
   `DigitalHub.Api` grants no internals to the test project, so K2 cannot read
   `BuildContentStore.ErrorSlugs` (kept `internal`, as planned). `RedirectTargets`
   exposes `public static IReadOnlyCollection<string> ErrorPageKeys => BuildContentStore.ErrorSlugs.Keys;`,
   a read-only view of the one list. K2 asserts it is exactly `404` and `500`, against
   `check-output.ts`'s `errorFiles`. No `InternalsVisibleTo`, no `*.csproj` change.
2. **`Adm07Run` instead of `Adm02Run`.** The plan allows reusing `Adm02Run`, but its
   marker is fixed to `adm02-` and it cannot be changed (condition 5), while condition 4
   requires the `adm07-` marker on everything a test creates. So `RedirectTargetTests.cs`
   (a file the plan creates) holds `Adm07Run`, a smaller counterpart: `adm07-` marker,
   admin login, the same create, publish, end and delete helpers, and a `finally`
   cleanup that deletes the marker's redirects through the API, unpublishes and deletes
   its items, and sweeps any redirect row whose `FromPath` or `ToPath` contains the
   marker. `Adm02Run.Code` is reused read-only. This is within the plan's file list and
   adds no scope.
3. **K2 lands in commit 5, not commit 4.** The plan lists `RedirectTargetRuleTests.cs`
   in commit 4, but K2 also asserts that `check-output.ts` contains
   `export function redirectTargetReport`, which commit 5 adds. In commit 4 K2 would
   be red, and commit 4 claims to make it green. I moved the file to commit 5, the first
   commit at which everything K2 asserts exists. K2's content is as planned. It is still
   a drift guard landing with the fix, not a red-first test, as the plan says of it.
4. **The holder in T10 takes its lock with `@LockTimeout = 0`.** The plan names no
   timeout for the holder. It must get the lock at once or the test is meaningless, and
   its result is asserted `>= 0` before the POST (condition 2).

Nothing else differs from the plan.

## How the tests are built (plan 5.1)

- **Marker.** Every database test starts an `Adm07Run`; `Marker` is
  `"adm07-" + Guid.NewGuid().ToString("N")[..8]`. E1's stamp is
  `adm07-<base36 time><4 random>`, its page slug `e2e-<stamp>`.
- **T7's gate, confirmed from EF's own SQL.** EF Core 10.0.12 sends
  `spellings.Contains(redirect.FromPath)` as one scalar parameter per element. Seen with
  `ToQueryString()` from a scratch program against `ContentDbContext` (no connection
  needed; scratchpad `adm07/efshape`):
  ```
  DECLARE @spellings1 nvarchar(300) = N'/adm07-abcd1234';
  DECLARE @spellings2 nvarchar(300) = N'/adm07-abcd1234/';
  SELECT [r].[id], ... FROM [redirects] AS [r]
  WHERE [r].[from_path] IN (@spellings1, @spellings2)
  ```
  So the gate holds a reader command whose text contains `FROM [redirects]` and one of
  whose string parameter values **contains** the marker (a JSON-array parameter would
  match too). It holds matched commands until two have arrived or for at most 2 s, then
  releases them and disarms. T7 fails (does not skip) when the gate matched nothing.
  The test has a warm-up (one create and one delete through the same factory) before
  arming, and a comment next to `GateCap` (2 s) and `LockTimeoutMilliseconds` (5000)
  saying the two must change together; it asserts `GateCap * 2 <= 5000`. The API's
  comment on the lock says the same from its side.
- **T7 and T8 exceptions.** A create that throws in the test host is reported as a
  5xx with the exception's text, so a `DbUpdateException` shows in the message instead
  of being lost.
- **T8** warms up first, runs five rounds of 8 POSTs alternating `/m-rN` and `/m-rN/`,
  and writes `Round N: slowest request <ms> ms; statuses …` to the test output.
- **T10** (condition 2): holder `new SqlConnection(ApiFactory.ElevatedTestConnectionString())`,
  `BeginTransactionAsync`, `EXEC @result = sp_getapplock @Resource = @resource (N'digitalhub:redirects'), @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 0`,
  `Assert.True(result >= 0)` before the POST; POST `/m-busy → /` must be `503`
  `redirect_busy`, the list for `<m>-busy` total 0; rollback and dispose in `finally`;
  then the same POST must be 201. It writes the refused create's duration to the output.
- **T9** inserts its import row through `ContentDbContext` and removes it in `finally`
  (condition 4); it asserts the exact `fromPath` message "A redirect source cannot
  equal the path of a live page.".
- **S1 to S3** mock `message.success` and `message.warning` with hoisted spies, clear
  them in `beforeEach`, and `afterEach` runs `cleanup()` and asserts
  `document.body.innerHTML === ""`, as `listPaging.test.tsx` does.

## Commands run, with exit codes

Set-up: `. /tmp/claude-0/-home-user-DH-WEBSITE/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/dn.sh`
(it exists, condition 6), Node 22.23.4.
`CS="Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1;TrustServerCertificate=True"`:
nothing listens there, so no database is reached. A fresh `HOME` for each `dotnet test`.

### Install

| Command | Exit | Output |
| --- | --- | --- |
| `cd website && npm ci` | 0 | lockfile unchanged (`sha256sum -c`: OK) |
| `cd studio && npm ci` | 0 | lockfile unchanged (`sha256sum -c`: OK) |

### Base (`309b18a`, before any change)

| Command | Exit | Output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release` | 0 | `13 Warning(s)`, `0 Error(s)` |

### Red, after commit 1 (`6c842ae`)

| Command | Exit | Output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release` | 0 | `0 Error(s)` (the new test files compile against the base API) |
| `cd website && npx vitest run test/redirect-targets.test.ts` | 1 | `× reports a redirect whose target has no page`, `× a trailing slash, the home page and the fixed pages resolve`, `× error pages, html spellings, upper case and media do not count`, `× no redirects, no lines`; each `AssertionError: check-output.ts exports redirectTargetReport: expected 'undefined' to be 'function'`; `Tests  4 failed (4)` |
| `cd website && npm run typecheck` | 0 | `tsc --noEmit`, no output |
| `cd studio && npx tsc -b` | 0 | (E1's spec is not in `tsconfig.node.json`'s `include`, as no spec but `e2e/env.ts` is) |
| `cd studio && npx tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --types node e2e/redirects.spec.ts` (and the same for `e2e/paging.spec.ts` as a control) | 0, 0 | E1's spec typechecks the way the existing specs do |

T1 to T10 and E1 need SQL Server: **NOT RUN** here (see below).

### Red, after commit 2 (`1a82b34`)

| Command | Exit | Output |
| --- | --- | --- |
| `cd studio && npx vitest run test/redirects.test.tsx` | 1 | `× warns when a created redirect points at no page`: `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times` (the `message.warning` spy); `× marks rows whose target has no page`: `TestingLibraryElementError: Unable to find an element with the text: No page.`; S3 passed; `Tests  2 failed \| 1 passed (3)` |
| `cd studio && npx tsc -b` | 0 | |

### Green, at `5c70cb1` (all fix commits)

| Command | Exit | Output |
| --- | --- | --- |
| `dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`: the base's 13, all in `tools/DigitalHub.ContentImport/ContentWriter.cs` (CS8601/CS8604); none new |
| `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "FullyQualifiedName~RedirectTargetRuleTests\|FullyQualifiedName~RedirectAddressRuleTests\|FullyQualifiedName~RedirectPathRuleTests"` (run after commit 5) | 1 | `Failed: 7, Passed: 3, Total: 10`. Passed: K2 `RedirectTargetRuleTests.The_api_counts_the_website_builds_fixed_pages`, K1, and `RedirectPathRuleTests`' DB-free case. The 7 failures are `RedirectPathRuleTests`' database cases at the login, as at the base |
| `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;LogFileName=<scratch>/adm07/adm07-after.trx"` | 1 | `Failed!  - Failed:   363, Passed:   177, Skipped:     0, Total:   540`. All failures are database tests failing at the connection |
| Passed names diffed against `scratchpad/adm07/base-passed.txt` (175 at `6262f48`) | — | **Lost: none.** New: `ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file` (W2, now that `website/node_modules` exists) and `RedirectTargetRuleTests.The_api_counts_the_website_builds_fixed_pages` (K2). 175 + 2 = 177, as condition 6 expects. Total 540 = the base's 520 + 20 new cases (T1 1, T2 2, T3 6, T4 1, T5 1, T6 1, T9 2, T7 3, T8 1, T10 1, K2 1) |
| `cd website && npm run typecheck` | 0 | |
| `cd website && npm test` | 0 | `Test Files  23 passed \| 1 skipped (24)`, `Tests  429 passed \| 31 skipped (460)`. The skips are environment skips already in the tree (`screenshot-parity-browser.test.ts`: no Chromium; `design.test.ts`: no DH-WEBSITE-main source) |
| `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `web.config: 0 redirect(s), report-only content security policy, custom 404 and 500.` then `Redirect targets: all 0 resolve to a page.` then `Build output checks passed.` |
| `cd studio && npx tsc -b` | 0 | |
| `cd studio && npm test` | 0 | `Test Files  12 passed (12)`, `Tests  94 passed (94)` (includes `redirects.test.tsx` 3 of 3 and `listPaging.test.tsx` unchanged) |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built`, `Preview design: … matches website/design/ byte for byte.` |
| `git status --short` | 0 | empty after every build |

### NOT RUN, and the CI job that covers each

| What | Why not | Covered by |
| --- | --- | --- |
| T1 to T6, T9 (`RedirectTargetTests`) | No SQL Server in this container | CI `ci.yml` job `api` (as `dh_content_app`, `DigitalHubContent_Test`) |
| T7, T8, T10 (`RedirectConcurrencyTests`) | No SQL Server | CI job `api`. T10's holder uses `ConnectionStrings__ContentAdmin`, which job `api` sets |
| All other database tests (guards in plan 5.1: `AdminApiTests.Redirect_refuses_loops_collapses_chains_and_blocks_live_paths`, `RedirectAddressTests`, `ContentPublishTests`, `ListPagingTests`, `CareersTests`, `ContentBundleTests`, …) | No SQL Server | CI job `api` |
| E1 and the rest of the end-to-end suite (`paging.spec.ts` included) | No SQL Server, so no `DigitalHubContent_E2e` | CI job `studio`, "End-to-end suite" |
| `section-compare`, `website-browser`, `security.yml`, `workflow-lint.yml` | CI-only jobs; no workflow changed | CI on the pull request |
| **CI red at commit 1, and CI green on the head** (condition 3; plan 5.4) | I do not push (the coordinator does) | The coordinator quotes the run ids, job ids and each failing assertion. Expected at commit 1: job `api` red on T1, T2 (2), T3 (6), T4, T5, T6, T7 (3), T9 (2), T10, T8 probably; T7's messages must show two 201s, or a 201 and a 500; T10's must show 201 where 503 was expected; job `website` "Tests" red on W1 to W4 only; job `studio` unit tests green, E1 red at step 3 only. If T7 is not red, stop and report it (condition 3) |

## Migrations

None. No entity, column, index or constraint changed; no row is rewritten (plan
section 7). Nothing was applied to any database.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `/blogs/<live-slug>/` refused (bullet 1) | Audit ADM-07 | Closed by ADM-02 (#54); end-to-end proof added | E1 step 1 (`studio/e2e/redirects.spec.ts`, commit `6c842ae`). Runs in CI job `studio` (NOT RUN here) |
| `/a → /a/` refused (bullet 2) | Audit ADM-07 | Closed by ADM-02 (#54); end-to-end proof added | E1 step 2. CI job `studio` |
| Path normalisation | Audit ADM-07, Fix | Closed by ADM-02 (#54) | Unchanged; K1 passes locally (filtered run above) |
| A target with no page is detected by the API, by the build's own rule | Audit ADM-07, bullet 3 | Done | `RedirectTargets.cs` and `AdminStore.cs` (`147ac92`). T1 to T4 (CI job `api`) |
| The Studio warns: on create, and per row in the list | Audit ADM-07, Fix ("warns in the Studio") | Done | `RedirectsPage.tsx` (`147ac92`). S1, S2 red at `1a82b34`, green at `5c70cb1` (3 of 3, local); E1 step 3 (CI job `studio`) |
| The build reports redirects with no page | Audit ADM-07, Fix ("reports in the build") | Done | `check-output.ts` (`4e2baf5`). W1 to W4 red at `6c842ae`, green at `5c70cb1` (local); snapshot build prints `Redirect targets: all 0 resolve to a page.` |
| Phase C 10.7 "Every redirect in the table resolves to a page returning 200"; BA 530 | Phase C; business analysis | Partly: reported, not enforced (B3). The IIS-level check is moved to Phase D | Build log line above; nothing added to `report.problems` |
| API and website agree on the fixed and error pages (drift guard) | Plan 3.1 | Done | K2 passes locally after `4e2baf5` (filtered run and full run) |
| `ToPath` compared by address in `DeleteAsync` | ADM-02 plan 2.2 and 4 | Done | `ContentStore.cs` (`4787b11`). T5 (CI job `api`) |
| `ToPath` compared by address in `RetargetAsync` | ADM-02 plan 2.2 and 4 | Done | `ContentStore.cs` (`4787b11`). T6 (CI job `api`) |
| End-to-end test for the Major | G3 checklist; ADM-02 plan 3.4 | Done (written; CI to run) | E1 in `6c842ae`. CI job `studio` |
| F-1: check and insert are one unit; concurrent creates of one address give exactly one 201 | ADM-02 test report F-1; delivery approval | Done | `AdminStore.cs` (`a1f2185`). T7 (deterministic), T8 (gate-2 wording) in CI job `api`; T8's per-round slowest time is in its test output |
| F-1: a create that cannot get the lock in time is `503 redirect_busy`, with no row (B5) | Review round 1 finding 1 | Done | `AdminStore.cs` (`a1f2185`). T10 in CI job `api`; its duration (about 5 s) is in its test output |
| F-2: a redirect from an ended vacancy's address is refused, at create and at import | ADM-02 test report F-2; O-ADM07-2 "Yes, refuse it" | Done | `AdminStore.cs` (`5c70cb1`). T9 (2 cases) in CI job `api` |
| Regression tests committed and shown failing before the fix | G3 checklist; O-ADM07-1 | Done locally for W1 to W4 and S1, S2; CI red pending the coordinator's push | Commits `6c842ae` and `1a82b34` precede every fix; local red quoted above. CI red at commit 1: NOT RUN by me (coordinator) |
| No regression in the DB-free baseline (175 at `6262f48`, 177 expected after `npm ci` and K2) | P-8; condition 6 | Done | 177 passed, no name lost (diff above) |
| Warning at unpublish | Plan 3.5 | Out of scope: ADM-14, ADM-20 | List marker covers it (T4) |
| Readable refusal messages in the Redirects modal | Plan 2.2 | Out of scope: ADM-14 | Unchanged |
| A rename racing a manual create into a loop | Plan 3.3 | Out of scope, in plan risks (10) | `RetargetAsync` takes no lock, as planned |

## For the tester

- **Commit 1's CI must show the planned red** (condition 3). In particular T7's
  messages read `Expected exactly one 201: 201 … | 201 …` (mixed spellings) or
  `A create failed on the server: 201 … | 500 …` (same spelling). If T7 is green at
  commit 1, the gate did not hold both duplicate checks: the CI log line
  `The gate saw no duplicate check` would say so; otherwise it is a timing question and
  must be reported, not tuned.
- **T8 at green**: quote each `Round N: slowest request … ms` line from the `api` log. A
  `redirect_busy` in T8 at green is a failure.
- **T10 at green**: quote `The refused create took … ms` (about 5000).
- **`paging.spec.ts`** creates 51 redirects one after another, each now taking the lock;
  compare its duration before and after (plan 5.4). Its rows point at `/`; they show
  "No page" only if no home page is published in `DigitalHubContent_E2e`, which the spec
  does not assert on.
- **Behaviour changes B1 to B6**, the "delete the ended vacancy first" route (the plan's
  reading, not the owner's words), B3 flagged for the owner, and the "Partly" row for
  Phase C 10.7 / BA 530 go in the pull request body (condition 7).
- **Slot 2 cadence** (condition 8): not before 12 November; the owner's merge
  confirmation is still required.

Status: READY FOR TEST
