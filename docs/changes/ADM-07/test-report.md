# ADM-07: test report

Tester (Claude Code), 11 November 2026. Plan `plan.md` round 2 (`1145b3f`), review
round 2 (`cd2091c`), gate 1 `plan-approval.md` (`309b18a`, eight conditions),
`implementation.md` (`429c9d0`, READY FOR TEST, four deviations).

## Round 1

- **Commit tested:** `429c9d01d3fc5280578cc68641a497c89f83260a` (`429c9d0`, "ADM-07: Record
  the implementation"), detached checkout `/home/user/dh-test-adm07`. Base `6262f48`.
  Red commits `6c842ae` and `1a82b34` were checked out in the same detached checkout,
  and the checkout was returned to `429c9d0` before the head runs. The developer's
  working copy `/home/user/dh-change-adm07` was not touched.
- **Environment:** Linux container, .NET SDK 10.0.114 (scratchpad `dn.sh`), Node
  22.23.4. No SQL Server can be reached here. No database was opened or written,
  `DigitalHubContent` included. The DB-free runs use
  `Server=127.0.0.1,4299;Database=DigitalHubContent;User ID=x;Password=y;Connect Timeout=1`.
  `ApiFactory.ToTestCatalog` rewrites that to `DigitalHubContent_Test`, and nothing
  listens on 4299 (a port in the 42xx range). .NET runs in Release, each with a fresh
  `HOME`. No process was started on any other port, and no process was stopped.
- **Read first:** `CLAUDE.md` (= `AGENTS.md`), `docs/changes/README.md` (G3),
  `plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`.
  `ENGINEERING_STANDARDS.md` does not exist in the worktree, as both gates record.

### 1. Red before green, and the commit structure

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Commit 1 holds tests only | `git show --stat 6c842ae` | 0 | 4 files: `RedirectConcurrencyTests.cs`, `RedirectTargetTests.cs`, `studio/e2e/redirects.spec.ts`, `website/test/redirect-targets.test.ts`. Nothing under `api/src`, `studio/src`, `website/src` or `website/scripts` |
| Commit 2 holds tests only | `git show --stat 1a82b34` | 0 | `studio/test/redirects.test.tsx` only |
| Red precedes every fix | `git log --oneline 309b18a..429c9d0` | 0 | `6c842ae`, `1a82b34`, then fixes `4787b11`, `147ac92`, `4e2baf5`, `a1f2185`, `5c70cb1`, then the record `429c9d0` |
| No red test weakened later | `git diff --stat 6c842ae 429c9d0 -- <the 4 commit-1 test files>`; `git diff --stat 1a82b34 429c9d0 -- studio/test/redirects.test.tsx` | 0 | Empty: the red tests are byte-identical at the head |
| Commit format (B-4) | `git log --format='%h %s%n%(trailers:only)' 309b18a..429c9d0` | 0 | 8 commits, each `ADM-07:` with an imperative subject and both trailers |
| Build at red | `dotnet build DigitalHub.slnx -c Release` at `6c842ae` | 0 | `13 Warning(s)`, `0 Error(s)`: the new tests compile against the base API |
| W1 to W4 red | `cd website && npx vitest run test/redirect-targets.test.ts` at `6c842ae` | 1 | `× reports a redirect whose target has no page`, `× a trailing slash, the home page and the fixed pages resolve`, `× error pages, html spellings, upper case and media do not count`, `× no redirects, no lines`; each `AssertionError: check-output.ts exports redirectTargetReport: expected 'undefined' to be 'function'`; `Tests  4 failed (4)`. This is the reason the plan gives (5.1) |
| Typecheck at red | `cd website && npm run typecheck` at `6c842ae` | 0 | Passes, as planned: the red is an assertion, not a compile error |
| S1, S2 red, S3 guard | `cd studio && npx vitest run test/redirects.test.tsx` at `1a82b34` | 1 | `× warns when a created redirect points at no page`: `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times`; `× marks rows whose target has no page`: `TestingLibraryElementError: Unable to find an element with the text: No page.`; `Tests  2 failed \| 1 passed (3)`. As planned |
| `tsc -b` at red | `cd studio && npx tsc -b` at `1a82b34` | 0 | |
| W1 to W4 green | `npx vitest run test/redirect-targets.test.ts` at `429c9d0` | 0 | `Tests  4 passed (4)` |
| S1 to S3 green | `cd studio && npm test` at `429c9d0` | 0 | `redirects.test.tsx` 3 of 3 (see section 2) |
| T1 to T10, E1 red at commit 1 | CI on PR #55 at `6c842ae` | — | **NOT RUN here** (no SQL Server). Covered by CI job `api` (T1 to T10) and job `studio`, "End-to-end suite" (E1). The coordinator holds those results. Gate 2 must quote T7's two-201 or 201-and-500 messages, T10's 201-for-503, and E1 failing at step 3 |

### 2. The test plan, as written (5.3 and 5.4)

| Command | Exit | Relevant output |
| --- | --- | --- |
| `cd website && npm ci`; `cd studio && npm ci` | 0, 0 | Lockfiles unchanged: `sha256sum -c` on a hash taken before `npm ci` gives `website/package-lock.json: OK`, `studio/package-lock.json: OK`, after every build |
| `cd api && dotnet build DigitalHub.slnx -c Release --no-incremental` | 0 | `13 Warning(s)`, `0 Error(s)`. All 13 are the base's, in `ContentWriter.cs`. No new warning (`grep warning … \| grep -v ContentWriter`: empty) |
| `HOME=<fresh> ConnectionStrings__Content="$CS" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --logger "trx;…"` | 1 | `Failed!  - Failed: 363, Passed: 177, Skipped: 0, Total: 540`. Every failure is a database test failing at the connection or the login (`SocketException`, then 401s and value mismatches downstream of a failed login) |
| Passed names diffed against `scratchpad/adm07/base-passed.txt` (175 at `6262f48`) | — | **Lost: none.** New: `ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file` (W2, now that `node_modules` exists) and `RedirectTargetRuleTests.The_api_counts_the_website_builds_fixed_pages` (K2). 177, as condition 6 expects |
| Note on my first run | — | My first full run used the red-commit binaries (I had rebuilt at `6c842ae` and passed `--no-build`), which gave `Passed: 176, Total: 539`: K2 is absent at red. After rebuilding at `429c9d0` the run above is correct. Recorded so the counts are not mistaken |
| `cd website && npm run typecheck` | 0 | No output |
| `cd website && npm test` | 0 | `Test Files  23 passed \| 1 skipped (24)`, `Tests  429 passed \| 31 skipped (460)`. The skips are the tree's existing environment skips |
| `cd website && npm run design:check` | 0 | `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `cd website && CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `web.config: 0 redirect(s), report-only content security policy, custom 404 and 500.`, then `Redirect targets: all 0 resolve to a page.`, then `Build output checks passed.` |
| `cd website && npm run compare:sections` | 1 | **NOT RUN** in effect: `fatal: cannot change to 'D:\work\DigitalHub\New Website\DH-WEBSITE-main'` (no reference source, and no Chromium here). Covered by CI job `section-compare` |
| `cd studio && npx tsc -b` | 0 | |
| `cd studio && npm test` | 0 | `Test Files  12 passed (12)`, `Tests  94 passed (94)` |
| `cd studio && VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build` | 0 | `✓ built`, `Preview design: … matches website/design/ byte for byte.` |
| `cd studio && npm run test:e2e` (E1, `paging.spec.ts`, the rest) | — | **NOT RUN**: no SQL Server, so there is no `DigitalHubContent_E2e`. Covered by CI job `studio`, "End-to-end suite" |
| Browser suites (`website-browser`, `screenshot-parity`) | — | **NOT RUN**: CI-only, and no Chromium here. Covered by CI jobs `website-browser` and `screenshot-parity` (label) |
| `git status --short` after everything | 0 | Empty |

### 3. Track checklist (G3, `docs/changes/README.md`)

| Item | Verified |
| --- | --- |
| The finding, its evidence and its fix come from the audit | Yes. Plan section 1 quotes ADM-07. The fix warns in the Studio and reports in the build, and the build does not fail (B3). The code matches: nothing is pushed to `report.problems` |
| The regression test is committed and shown failing before the fix | Yes for W1 to W4, S1 and S2 (seen red here, section 1). T1 to T10 and E1: CI at `6c842ae`, NOT RUN here |
| An end-to-end test for each Major | E1 is in `6c842ae` and covers all three bullets. I read it (section 5). It runs in CI job `studio` |
| A Minor not fixed becomes a D-NNN entry | F-1 and F-2 are both fixed. No D-NNN entry is needed |

### 4. Security

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| npm audit, website (full tree) | `cd website && npm audit --audit-level=high` | 0 | `1 moderate severity vulnerability` (`fast-uri` 3.0.0 to 3.1.8, GHSA-w74x-v6f9-j3xg and others). It is below the gate's level, and the lockfile is unchanged by this change, so it comes from the base |
| npm audit, studio (full tree) | `cd studio && npm audit --audit-level=high` | 0 | `found 0 vulnerabilities` |
| Gate script, npm | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` and `… studio` | 0, 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` `studio: 0 finding(s) …` |
| Gate script, .NET | `cd api && RUNNER_TEMP=<scratch> sh ../.github/security/run-dotnet-audit.sh` | 0 | All three projects: `no vulnerable packages`. `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep | `run-semgrep.sh` | — | **NOT RUN**: semgrep is not installed. Covered by `security.yml` job `semgrep` |
| gitleaks | `run-gitleaks.sh` | — | **NOT RUN**: gitleaks is not installed. Covered by `security.yml` jobs `gitleaks-pr` and `gitleaks-history` |
| actionlint | — | — | **NOT RUN**: not installed. No workflow changed (`git diff --stat 6262f48 429c9d0 -- .github` is empty). Covered by `workflow-lint.yml` job `actionlint` |
| Secret scan of the diff | `git diff 6262f48 429c9d0 \| grep '^+' \| grep -iE 'password\|secret\|token\|api[_-]?key\|User ID=\|BEGIN .*PRIVATE\|AKIA…\|ghp_…'` | 0 | Only the dummy `User ID=x;Password=y` local string in `plan.md` and `implementation.md` (it points at an unused port, and the tests rewrite it to `_Test`), references to `ApiFactory.AdminPassword` and `e2ePassword` (existing constants), and `CancellationToken`. No secret |
| Lockfiles, `package.json`, `*.csproj`, workflows, `ApiFactory.cs` | `git diff --stat 6262f48 429c9d0 -- '*package*.json' '*.csproj' .github api/tests/DigitalHub.Api.Tests/ApiFactory.cs` | 0 | Empty |

**The `sp_getapplock` SQL (`AdminStore.RedirectLockSql`):**

- **No injection.** The text is a `const`:
  `EXEC @result = sp_getapplock @Resource = N'digitalhub:redirects', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 5000;`.
  No request value reaches it. The only parameter is a typed `int` output
  (`SqlParameter("@result", SqlDbType.Int) { Direction = Output }`), passed to
  `ExecuteSqlRawAsync`.
- **It runs inside the transaction.** `BeginTransactionAsync` opens the connection
  and sets `CurrentTransaction`, so EF enlists the raw command and
  `@LockOwner = N'Transaction'` is valid. `Program.cs:60` is a plain `UseSqlServer`
  with no `EnableRetryOnFailure`, so a user transaction does not throw under an
  execution strategy.
- **Every return path is safe. I checked each one:**
  - The validation errors and the self-loop return before the transaction, so no
    lock is taken.
  - When `@result < 0`, or `Value` is not an `int`, the method returns
    `503 redirect_busy` and holds no lock. The `await using` disposes the transaction.
  - `409 redirect_exists`, `400 redirect_live_path` and `400 redirect_loop` return
    inside the `await using` scope. Dispose rolls back, and the rollback releases the
    transaction-owned lock.
  - An exception (a failed `SaveChangesAsync`, a cancellation while waiting in
    `sp_getapplock`) also disposes, which rolls back. If the connection is dead, the
    session ends and the lock goes with it. A pooled connection is reset before reuse.
  - On success, `CommitAsync` releases the lock. `LivePathsAsync` runs after the
    commit, so the lock is not held for those six queries. Disposing a committed
    transaction is a no-op.
- **The error shape.** The 503 goes through `AdminResponse.From` →
  `ProblemResults.Create(503, "redirect_busy", "Another redirect is being saved. Try again.")`.
  That is RFC 7807 with `code` and no internals. The Studio shows the title
  (`result.problem?.title`).
- **Routes and roles are unchanged.** `RedirectsController` keeps
  `[Authorize(Policy = "studio")]`, and no route, policy, host rule, request type or
  body limit changed. `targetLive` adds one boolean per row. The list still exposes
  the same columns, read with `AsNoTracking`, and `CreatedById` is not exposed.
  The role matrix, host checks, unknown-field and body-size checks for
  `/api/v1/redirects` are existing database tests. **NOT RUN** here; CI job `api`.
- **No login or permission change.** `sp_getapplock` needs only `public`. CI job
  `api` runs as the restricted `dh_content_app`, so T7, T8 and T10 prove it under
  that login (NOT RUN here).
- **T10's holder connection** is `ApiFactory.ElevatedTestConnectionString()`. Both of
  its branches go through `ToTestCatalog`, which refuses a string that does not name
  `DigitalHubContent` and rewrites it to `DigitalHubContent_Test` (`ApiFactory.cs:134-166`).
  In CI, `ConnectionStrings__ContentAdmin` (sa, `Database=DigitalHubContent`) is
  rewritten to `_Test`. The holder is rolled back and disposed in `finally`.

### 5. The developer's questions, and beyond the plan

**T7's interceptor design: verified.**

- **The SQL, seen myself.** I wrote a scratch probe
  (`scratchpad/tst07/probe`, a project reference to the head's `DigitalHub.Api`).
  It runs the exact duplicate check,
  `db.Redirects.AsNoTracking().AnyAsync(r => spellings.Contains(r.FromPath))` with
  `RedirectPaths.Spellings(...)`, through a connection interceptor that suppresses
  the open, and captures `ReaderExecutingAsync`. The developer's `ToQueryString`
  probe used `Where`, not `AnyAsync`, so I did not rely on it. EF Core 10.0.12
  sends:
  ```
  SELECT CASE WHEN EXISTS ( SELECT 1 FROM [redirects] AS [r]
    WHERE [r].[from_path] IN (@spellings1, @spellings2)) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END
    @spellings1 = /adm07-abcd1234 (String)
    @spellings2 = /adm07-abcd1234/ (String)
    matches gate: True
  ```
  The same holds for `/adm07-abcd1234/` as input. A three-element list gives
  `IN (@three1, @three2, @three3)`. I saw no JSON-array parameter and no padding.
  The values are `string`, so `Matches` (`parameter.Value is string value && value.Contains(marker)`)
  is true. The command goes through `ReaderExecutingAsync`: EF runs `Any` as a reader.
- **Only the duplicate check matches during a create.** `OccupiesLivePathAsync`
  reads the content tables, not `[redirects]`. `ResolveDestinationAsync` reads
  `[redirects]`, but with the spellings of the target `/`, which carry no marker.
  `sp_getapplock` is a non-query and has no `FROM [redirects]`.
- **Red, by reasoning.** At red, both duplicate checks are held. The second sets
  `_held = 2`, which releases both. With mixed spellings both requests insert
  (two 201s). With the same spelling, the unique index gives a 500. This is the
  planned red.
- **Green, by reasoning.** The first request holds the lock and its check is held
  until the 2 s cap. The second waits in `sp_getapplock`, about 2 s plus the first
  request's remaining work, which is under 5 s. Then it sees the row and gets 409.
  `Matched` is 1, and the test requires `>= 1`.
- **No leak into other tests.** The warm-up runs before `Arm`, and `Disarm` is in
  `finally`. `RowsAtAsync` and the cleanup also match the pattern, but they run after
  `Disarm`.

**T8 and T10 log lines: Minor finding 2.** Both use `ITestOutputHelper`. CI runs
`--logger "console;verbosity=normal"` (`ci.yml:127-128`), and at that verbosity a
passing test's output does not print to the job log. I proved this with a scratch
xUnit project on the same packages (xunit 2.9.3, runner 3.1.4, Test.Sdk 17.14.1), run
with the same two loggers. A passing test's `Round 1: slowest request 123 ms…` line
is absent from the console (`grep -c`: 0) and present in the TRX (1). So at green the
`Round N: slowest request … ms` lines and `The refused create took … ms` appear only
in the `api-test-report` artifact (`api-tests.trx`), not the `api` log, as
`implementation.md` "For the tester" and plan 5.4 assume. When either test fails, the
output does print. The lines themselves are well formed. T8 prints one per round, with
all eight statuses, so a `redirect_busy` would show as a 503 in the list.

**The lock's effect on `paging.spec.ts`: low, by analysis (NOT RUN).**

- The spec's 51 creates run one after another (`await redirect(...)` in a loop), and
  `playwright.config.ts` has `workers: 1` and `fullyParallel: false`. So the lock is
  never contended, and no create waits.
- Each create now adds a `BEGIN TRAN`, one uncontended `sp_getapplock`, a `COMMIT`,
  and six slug-only `LivePathsAsync` queries after the commit. The list adds six
  queries per request.
- On localhost that is a few milliseconds per create, so about a second over 51
  creates, against a 90 s test timeout and 15 s steps.
- The rows point at `/` and show "No page" only if `DigitalHubContent_E2e` has no
  published home page. The spec does not assert on the marker.
- Gate 2 should quote the spec's duration before and after from CI job `studio`
  (plan 5.4).

**The four deviations against gate 1:**

| # | Deviation | Against | Verdict |
| --- | --- | --- | --- |
| 1 | `RedirectTargets.ErrorPageKeys => BuildContentStore.ErrorSlugs.Keys` (public `IReadOnlyCollection<string>`), `ErrorSlugs` stays `internal` | Condition 1 (authorised by name) | Conforms. No `InternalsVisibleTo`, no `*.csproj` change. K2 asserts exactly `404` and `500` against `errorFiles`, and passes locally |
| 2 | `Adm07Run` in `RedirectTargetTests.cs` instead of reusing `Adm02Run` | Condition 4 (the `adm07-` marker), condition 5 (no `Adm02Run` change) | Conforms. The plan allows reuse but does not require it, and the helper sits in a file section 4 creates. `Adm02Run` is unchanged, with only `Adm02Run.Code` used read-only. The cleanup deletes through the API, then sweeps marker rows in `_Test` |
| 3 | K2 lands in commit 5, not commit 4 | Plan 5.2. Not named by gate 1. Condition 5 says "any other deviation" goes back to step 1 | Harmless and necessary: K2 asserts `export function redirectTargetReport`, which does not exist until commit 5. No file, scope or assertion changes. It is a commit-order deviation, not a scope one, so it is not a finding. **The technical lead should ratify it at gate 2** |
| 4 | T10's holder uses `@LockTimeout = 0` | Condition 2 (result asserted `>= 0` before the POST) | Conforms. The plan names no timeout. A holder that cannot get the lock at once fails the test rather than delaying it. The result is asserted, and rollback and dispose are in `finally` |

**Scope is plan section 4 exactly, plus the public member.** The diff touches 7 new
files and 5 changed files, all listed in section 4, and
`docs/changes/ADM-07/*.md`. In `AdminStore.cs` it changes only
`ListRedirectsAsync`, `CreateRedirectAsync`, a new private `TakeRedirectLockAsync`
and its `RedirectLockSql`, and the vacancy predicate in `OccupiesLivePathAsync`.
`ContentStore.cs` changes only in `DeleteAsync` and `RetargetAsync`, and
`BuildContentStore.cs` only in `private` → `internal`. The one public member beyond
the plan is `ErrorPageKeys`. Nothing else is public and new.

**Beyond the plan:**

- **The build report against the real snapshot output.** I wrote a probe
  (`scratchpad/tst07/probe-report.ts`) that calls `redirectTargetReport` on the
  built `website/out/` (28 HTML files).
  - These resolve: `/`, `/about`, `/about/`, `/blogs`, `/blogs/`, `/careers/apply`,
    `/privacy-careers`, `/news`, `/services/ai-automation/`.
  - These are reported: `/About`, `/404`, `/500`, `/media/x.webp`, `/missing`,
    `/behaviors` (a folder).
  - With a missing `outDir`, every target is reported, and nothing throws.
  - All of this is as planned, except `/index`: see Minor 1.
- **The API and the build agree on the listing pages.** `blogs`, `careers`,
  `cases`, `news` and `partners` are page records in the snapshot content, so
  `ContentPaths.PublicPath("pages", slug)` puts `/blogs` and the rest in
  `LivePathsAsync`, and the build writes `blogs.html` and the rest.
- **Studio.** `--dh-warning` is defined (`packages/theme/tokens.css:17`,
  `#f59a23`). The warning text is a React text node, so it cannot inject HTML. The
  icon is `aria-hidden`, and "No page" is visible text.
- **Concurrent creates (409)** are T7 and T8, and CI runs them. A rename racing a
  manual create into a loop is out of scope (plan 10), as accepted at gate 1.

### Findings, most severe first

No Blocker. No Major.

**Minor 1: the API and the build disagree on `/index`.**

- Steps:
  1. At `429c9d0`, build the snapshot site.
  2. Run `npx tsx scratchpad/tst07/probe-report.ts out` in `website/`.
  3. Read `RedirectTargets.LivePathsAsync`.
- Expected: one rule (plan 3.1: "The rule is the API's, applied to what the build
  actually wrote"). A redirect to `/index` gets the same answer from the Studio and
  from the build log.
- Actual:
  - The build says `/index` resolves: `htmlFileFor("/index")` is `index.html`, which
    is in the walked list.
  - The API's live set has `/` for the home page and never `/index`, so the Studio
    marks the row "No page".
  - IIS also serves `/index` with 200 through the "Clean URLs" rewrite (`{R:1}.html`
    is a file).
- Impact: low. Nobody links `/index`, and the API errs toward warning, as the plan
  accepts for `/About`. But K2 is meant to guard that the two rules agree, and this
  case is not covered.
- Fix options for the developer: exclude `index.html` for any key but `/` in
  `redirectTargetReport`, or record `/index` beside `/About` in plan 3.5 as a
  deliberate warning.

**Minor 2: T8's and T10's timing lines are not in the CI `api` log when they pass.**

- Steps:
  1. Run a passing xUnit test that writes through `ITestOutputHelper`, with
     `--logger "trx;…" --logger "console;verbosity=normal"`, as `ci.yml:125-128`
     does. My scratch project for this is `scratchpad/tst07/outprobe`.
  2. `grep` the console output and the TRX for the line.
- Expected: `implementation.md` "For the tester" and plan 5.4 say to quote each
  `Round N: slowest request … ms` line and `The refused create took … ms` "from the
  green `api` log".
- Actual: the console has 0 lines and the TRX has 1. At green the lines are only in
  the `api-test-report` artifact.
- Fix: gate 2's evidence should come from `api-tests.trx` in that artifact, and the
  record should say so. No product or test change is needed. Raising the console
  verbosity would be a workflow change, which is out of scope.

Recorded for gate 2 (not findings):

- **Deviation 3 needs the lead's ratification** under condition 5's wording.
- **The CI evidence is outstanding.** Commit 1's red (T7's messages, T10's 201, E1
  at step 3, W1 to W4 only in `website`) and the head's green on every workflow are
  not seen by me. They are the coordinator's, and this approval assumes they show
  what plan 5.4 lists.
- **The website's moderate `fast-uri` advisory** is from the base, below the gate's
  level, and no lockfile changed.

### Coverage rows verified

| Item | Source | Status | Evidence (this round) |
| --- | --- | --- | --- |
| A target with no page is detected by the API, by the build's own rule | Audit ADM-07, bullet 3 | Verified by reading; DB tests NOT RUN | `RedirectTargets.cs` and `AdminStore.cs` read. T1 to T4: CI job `api`. One divergence (`/index`, Minor 1) |
| The Studio warns, on create and per row | Audit ADM-07, Fix | Verified | S1 and S2 red at `1a82b34`, green at `429c9d0` (3 of 3). E1: CI job `studio` |
| The build reports redirects with no page | Audit ADM-07, Fix | Verified | W1 to W4 red at `6c842ae`, green at `429c9d0`. Snapshot build: `Redirect targets: all 0 resolve to a page.` Real-output probe as above |
| Phase C 10.7 / BA 530 "Partly" (reported, not enforced) | Phase C; BA | Verified | No `report.problems` push in `check-output.ts`. `Build output checks passed.` |
| Drift guard, API and website (K2) | Plan 3.1; condition 1 | Verified | K2 passes in the full DB-free run. Its error-page keys come through the public `ErrorPageKeys` |
| `ToPath` by address in `DeleteAsync` and `RetargetAsync` | ADM-02 plan 2.2, 4 | Verified by reading; T5 and T6 NOT RUN | `ContentStore.cs` diff. CI job `api` |
| F-1: check and insert are one unit, 503 `redirect_busy` | ADM-02 F-1; review finding 1 | Verified by reading and the SQL review; T7, T8 and T10 NOT RUN | The `sp_getapplock` review above. T7's gate matches the real `AnyAsync` SQL (probe). CI job `api` |
| F-2: an ended vacancy's address is refused | O-ADM07-2 | Verified by reading; T9 NOT RUN | `OccupiesLivePathAsync`'s predicate is `Published \|\| Ended`, as `BuildContentStore`. CI job `api` |
| Red committed before the fix | G3; O-ADM07-1 | Verified locally for W and S; CI for T and E | Section 1 |
| No regression in the DB-free baseline | P-8; condition 6 | Verified | 177 passed, none lost against `base-passed.txt` |
| No lockfile, `package.json`, `*.csproj`, workflow, `ApiFactory.cs`, `Adm02Run` or migration change | Condition 5; plan 7 | Verified | `git diff --stat` empty for those paths. `sha256sum -c` OK |

Verdict: APPROVED
