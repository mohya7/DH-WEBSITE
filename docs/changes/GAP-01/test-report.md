# Test report: GAP-01

## Round 1

Tester, round 1, 1 November 2026. **Commit tested: `d772f03`** (branch
`change/GAP-01`, `implementation.md` round 2, `Status: READY FOR TEST`), in a
detached worktree `/home/user/wt-GAP-01-test`. Base for every comparison:
`6470fac` (= `origin/rebuild/dotnet-platform`, merge-base of the branch), in a
second detached worktree `/home/user/wt-GAP-01-base`. Both worktrees are real
git checkouts, so the `design.test.ts` source test runs in both. Node 22.23.4 /
npm 10.9.9 unless stated. `git rev-parse --is-shallow-repository` → `false`
before and after; no `git fetch` of any kind was run. Scratch evidence:
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap01-test/`
(below `<scratch>`).

Read first: `docs/changes/README.md`, `ENVIRONMENT.md`, `.claude/agents/tester.md`
(read-only copy of `origin/claude/cool-heisenberg-mh6zx9`), and `plan.md`
(round 3), `plan-review.md`, `plan-approval.md`, `implementation.md` (rounds 1
and 2) in this folder.

### 1. Red tests were red

**Gate red step (`2a4f836`).** `git archive 2a4f836` of `.github`, the website
`package.json` and lockfile (no `node_modules`; `npm audit` reads the lockfile):

```
website$ RUNNER_TEMP=<scratch>/rt bash ../.github/security/run-npm-audit.sh website      exit 1
::error title=New finding (website)::high next GHSA-cjq9-62q9-8jv4: ...
::error title=New finding (website)::critical next GHSA-2464-fhr4-w9xw: ...
::error title=New finding (website)::high next GHSA-p3m5-59mp-jv5r: ...
::error title=New finding (website)::critical next GHSA-673q-mjm6-r5xr: ...
::error title=New finding (website)::high sharp GHSA-wq5f-xc86-pv6w: ...
::error title=New finding (website)::high source-map-js GHSA-68fv-2mgg-jv7q: ...
website: 6 finding(s) at the gate's level; 0 known, 6 new.
```

For comparison, the same command on `6470fac` and on `3e620e1` (commit 1):
exit 1, "6 finding(s) at the gate's level; 3 known, 3 new." Head: see 3.
Red for the reason the plan gives; green on the head.

**Strip red step (`6ad1366`).** Worktree switched to `6ad1366` (lockfile
identical to head), then back to `d772f03`:

```
website$ npx vitest run test/strip-runtime.test.ts          (6ad1366)  exit 1
     × removes each part of the runtime, and nothing else
     × does not remove what it does not recognise, so the output check can catch it
     × removes Next 16.4.3's inline Turbopack bootstrap
     × the trace check catches the Turbopack bootstrap if it is left in
     × strips a Next 16.4.3 page with no problem, and names a page that keeps a Turbopack trace
AssertionError: expected { 'runtime script tags': 4, …(4) } to deeply equal { 'runtime script tags': 4, …(5) }
AssertionError: expected [] to deeply equal [ 'the Turbopack runtime' ]
AssertionError: expected [] to deeply equal [ 'the Turbopack runtime', …(1) ]
AssertionError: expected undefined to be 1 // Object.is equality
      Tests  5 failed | 4 passed (9)
website$ npx vitest run test/strip-runtime.test.ts          (d772f03)  Tests  9 passed (9)
```

Each failure is on the new removal key or the new traces, as the plan says.
`git diff --stat 6ad1366 d772f03` touches only `website/src/build/strip-runtime.ts`
(+8) and `implementation.md`, so the fix did not edit the tests.

### 2. Security

| Check | Command | Exit | Result |
|---|---|---|---|
| Website full tree | `npm audit --audit-level=high` | 0 | `{"moderate":1,"high":0,"critical":0,"total":1}` (`fast-uri`, moderate, out of scope) |
| Website production | `npm audit --omit=dev --audit-level=high` | 0 | |
| Website gate | `RUNNER_TEMP=<scratch>/rt bash ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` No "Known but no longer found". |
| Studio full tree | `npm audit --audit-level=high` | 0 | `found 0 vulnerabilities`, total 0 |
| Studio production | `npm audit --omit=dev --audit-level=high` | 0 | |
| Studio gate | `... run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Base, for reference | `npm audit --audit-level=high` on `6470fac` | 1 / 1 | website high 4, critical 1, moderate 3; studio high 3, moderate 2 |
| .NET | `cd api && RUNNER_TEMP=<scratch>/dn sh ../.github/security/run-dotnet-audit.sh` | 0 | 3 projects "no vulnerable packages"; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| gitleaks install | `GITLEAKS_VERSION=8.30.1 GITLEAKS_SHA256=551f6fc8…f2470eb RUNNER_TEMP=<scratch>/gl bash .github/security/install-gitleaks.sh` (values from `security.yml`) | 0 | `gitleaks_8.30.1_linux_x64.tar.gz: OK` |
| gitleaks, this change | `RUNNER_TEMP=<scratch>/gl bash .github/security/run-gitleaks.sh pr-diff <scratch>/gl/gitleaks-pr.json "6470fac..d772f03"` | 0 | `10 commits scanned … no leaks found`; `pr-diff: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| gitleaks, history | `... run-gitleaks.sh full-history <scratch>/gl/gitleaks-history.json "--all"` | 0 | `full-history: 2 finding(s) at the gate's level; 2 known, 0 new.` (the two existing known entries) |
| Semgrep | NOT RUN | | not installed here; covered by `security.yml` `semgrep` |

**Gate self-test and P-6.** `node --test .github/security/gate.test.mjs`:
head `d772f03` exit 0, `# tests 63 # pass 63 # fail 0`; base `6470fac`
62/62; `3e620e1` and `2a4f836` 63/63 (full `git archive` exports; a first run
without `.semgrepignore`/`.gitattributes` in the export failed 2 golden-copy
tests for that reason only).

Diff review of `gate.test.mjs`: the npm known-list tests and the npm mutation
fixture now run a byte-identical copy of `gate.mjs` + `fail-on-rules.json`
from a temp folder with a fixture allow-list (three synthetic ids); the new
test "the fixture gate is the real gate" asserts byte identity; "a new High /
Critical advisory fails" gained `3 known, 1 new`; dotnet, gitleaks and semgrep
still use the real gate and allow-list. No test or assertion removed.
`gate.mjs`, `run-*.sh`, every `*.expected*` and `.github/workflows` are
unchanged (`git diff --stat 6470fac d772f03 -- …` empty;
`diff run-npm-audit.sh run-npm-audit.expected.sh` exit 0).

Mutation check that the self-test still catches a weakened gate (scratch copies
of `.github` at `d772f03`, one `sed` on `gate.mjs` each, nothing in the repo
changed):

| Mutation of `gate.mjs` | Self-test result |
|---|---|
| any non-empty known list hides every finding (`fresh = knownIds.size ? [] : …`) | fail 5, incl. "a new High advisory fails", "a new Critical advisory fails" |
| known findings are not counted (`old = []`) | fail 4, incl. "a known-only npm report passes" |
| npm allow-list ignored (`new Set()` for `known.npm[label]`) | fail 4, incl. "npm mutations of every consumed field" |

So with the real website allow-list now empty, the npm known/new behaviour is
still proven. The gate is not weakened.

**No secret** in the diff (gitleaks pr-diff), and none in the Studio e2e log
(`grep -c "Passw0rd\|signing-key"` → 0).

### 3. Dependencies and lockfiles (B-7)

- `package.json`: website `next` 16.3.6 → 16.4.3, `vitest` 5.0.2 → 5.0.5;
  Studio `vite` 8.3.0 → 8.3.5, `vitest` 5.0.2 → 5.0.5. Exact pins kept. No
  `overrides` in either `package.json` (`grep -c overrides` → 0 / 0).
- Installed after `npm ci`: website `next` 16.4.3, `@next/env` 16.4.3,
  `sharp` 0.35.5, `source-map-js` 1.2.2, `undici` 8.12.3, `vite` 8.3.5,
  `vitest`/`@vitest/mocker` 5.0.5; Studio `source-map-js` 1.2.2, `undici`
  8.12.3, `vite` 8.3.5, `vitest`/`@vitest/mocker` 5.0.5. `npm ls --all` exit 0
  in both.
- Lockfile entries changed (`6470fac` → `d772f03`, script over `packages`):
  website 74 version changes, 0 added, 0 removed, 1 metadata-only
  (`playwright/node_modules/fsevents` gains `"dev": true`); Studio 29 version
  changes, 0 added, 0 removed. Every one is in plan 3.1 steps 3/4 (`next`,
  `@next/*`, `sharp`, `@img/*`, `source-map-js`, `undici`, `vite`, `rolldown`,
  `@rolldown/*`, `@oxc-project/types`, `vite/node_modules/postcss` /
  Studio `postcss` 8.5.32, `vitest`, `@vitest/*`, `obug` 3.0.0,
  `why-is-node-running` 3.2.1, `chai`, `magic-string`, `std-env`, `tinybench`,
  `nanoid`, `@types/estree`). Every `resolved` is `registry.npmjs.org`; every
  entry has `integrity` except the local `../packages/theme` link (as on base).
- Regenerated by npm: website `npm install --package-lock-only` (npm 10.9.9)
  on a scratch copy → lockfile byte-identical (`cmp`). Studio with npm 11.19.1
  (`/opt/node24`), lock-only: the only difference is 6 added bundled entries
  under `@tailwindcss/oxide-wasm32-wasi/node_modules/`, and the **base**
  lockfile gets exactly the same 6 additions from the same command, so this is
  npm's lock-only behaviour, not a hand edit. (The plan expected these six
  entries in the committed Studio lockfile; they are absent there, as on base.
  Not a defect.)
- Studio `npm ci` with npm 11.19.1 exit 0, then npm 10.9.9 exit 0; no
  change to tracked files (`git status --short studio` empty). Website `npm ci`
  exit 0. No `--force` anywhere in the commits or records.

### 4. Website checks (`d772f03`)

```
website$ npm run typecheck                                   exit 0
website$ npm test                                            exit 0   Test Files 21 passed (21); Tests 412 passed | 1 skipped (413)
  (base 6470fac: Test Files 21 passed; Tests 409 passed | 1 skipped (410); +3 = the new strip tests)
website$ npm run design:check                                exit 0   All 25 files match: 24 identical, 1 ported with the recorded change.
website$ CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build   exit 0
  Removed Next's client runtime from 29 pages:
     203  runtime script tags
      29  Turbopack bootstrap script
      29  runtime preload link
      58  payload scripts
      29  empty metadata outlet
      29  empty boundary markers
     140  .txt payload files deleted
      10  runtime scripts deleted from _next/
  Static HTML: no page contains Next's client runtime; …
  Build output checks passed.
```

Base build counts: identical minus the "Turbopack bootstrap script" line.

**Built output identical to base.** Base built twice, branch once, same
environment:

```
$ diff -r <scratch>/out-base-1 <scratch>/out-base-2          exit 0   (noise floor empty)
$ diff -r <scratch>/out-base-1 <scratch>/out-branch          exit 0   (no output; 168 files)
$ grep -rl -E "TURBOPACK|static/chunks/|__next_f|/_next/" <scratch>/out-branch          exit 1 (no file)
$ grep -rliE "self\.__next|webpackChunk|__NEXT_DATA__|next/dist|_N_E|data-nscript|turbopack" <scratch>/out-branch   no file
$ find <scratch>/out-branch -name _next                      nothing; only robots.txt and llms.txt as .txt
```

No Next client runtime trace remains. After the consent build and the restore
build (section 5), `diff -r out <scratch>/out-branch` exit 0 on the branch and
`diff -r out <scratch>/out-base-1` exit 0 on the base.

**Section comparison** (Chromium 153 for 141, old site `/home/user/old-site`
on `feature/interviewer-portal`, read only):

```
base   SECTION_COMPARE_NEW=<scratch>/out-base-1 SECTION_COMPARE_PORT=4251 npm run compare:sections   exit 1
branch SECTION_COMPARE_NEW=<scratch>/out-branch SECTION_COMPARE_PORT=4252 npm run compare:sections   exit 1
  104/119 sections match; 14 accepted; 1 failures (including chrome).
  Chrome: 42 match; 36 accepted out of 78.
  Section 5 formerly missing sections: 9 match, 6 accepted (16/16 found).
  differs: /careers/apply.html #section
$ diff <scratch>/section-base/report.md <scratch>/section-branch/report.md     exit 0
```

Only the known careers apply difference (GAP-05/O-11), on both. No new
difference.

### 5. Website browser suite, 29/29 with a scratch CDN mirror

The pages load GSAP, ScrollTrigger and Lenis from `cdn.jsdelivr.net`, which
this container's egress proxy refuses (`CONNECT … 403`). To evidence "0
failed" without changing any test or config, I used the GAP-04 tester's
scratch-only technique:

- HTTPS mirror on 127.0.0.1:4261 serving `gsap@3.12.5/dist/gsap.min.js`,
  `ScrollTrigger.min.js` and `@studio-freight/lenis@1.0.23/bundled/lenis.min.js`.
  I checked each file byte for byte (`cmp`) against `npm pack gsap@3.12.5
  @studio-freight/lenis@1.0.23` → identical.
- A local proxy on 127.0.0.1:4262 that tunnels **only** `cdn.jsdelivr.net:443`
  to the mirror and refuses every other host (log: 498 `CONNECT
  cdn.jsdelivr.net`, refused `fonts.googleapis.com` ×96).
- A scratch Playwright config per tree (`<scratch>/mirror/pw-{base,test}.config.ts`)
  equal to `website/playwright.config.ts` plus `proxy` and
  `ignoreHTTPSErrors`, with `testDir` the tree's own `browser-tests` and the
  same `node tools/serve-built.mjs` webServer. No file in either tree changed.
  Tabler icons CSS is not mirrored (404); no test depends on it.

Default build, then `SNAPSHOT_SETTINGS_FIXTURE=consent` build, then the
default build restored; ports 4253 (base) and 4254 (branch):

| Run | Exit | Passed | Failed | Skipped |
|---|---|---|---|---|
| base, default, plain | 1 | 3 | 1 | 25 |
| branch, default, plain | 1 | 3 | 1 | 25 |
| base, consent, plain | 1 | 20 | 8 | 1 |
| branch, consent, plain | 1 | 20 | 8 | 1 |
| base, default, mirror | 0 | 4 | 0 | 25 |
| branch, default, mirror | 0 | 4 | 0 | 25 |
| base, consent, mirror | 0 | 28 | 0 | 1 |
| branch, consent, mirror | 0 | 28 | 0 | 1 |

With the mirror, all 29 distinct tests pass on the branch across the two
builds (union of passed titles = 29, failed = 0), and the same on base.
Per-test outcome lists (title + outcome, sorted) are identical base vs branch
in all four run kinds (`diff` exit 0). Without the mirror, all 9 failures on
both are `expect(errors).toEqual([])` receiving `"gsap is not defined"`.

### 6. Screenshot checks, Chromium only

```
website$ npx vitest run test/screenshot-parity-browser.test.ts --reporter=default --reporter=json --outputFile.json=<scratch>/screenshot-browser.json
                                                             exit 0   Tests 30 passed | 1 skipped (31)
website$ node tools/check-browser-test-report.mjs <scratch>/screenshot-browser.json 30
  chromium regressions: passed 30, placeholder 1, problems 0          exit 0
```

`npm run compare:screenshots` (Chromium, `SCREENSHOT_BROWSERS=chromium`), base
from the base tree with `SCREENSHOT_NEW_ROOT=<scratch>/out-base-1` (ports
4255/4256) and branch from the branch tree with
`SCREENSHOT_NEW_ROOT=<scratch>/out-branch` (ports 4257/4258), run side by
side in the background. Both completed all 78 rows and wrote
`<scratch>/screenshots-base/report.html` and
`<scratch>/screenshots-branch/report.html` (exit codes were not captured
because the runs were detached; both printed `Report: …` as their last line).

| | match | differs | absent (accepted) | unstable | error | rows |
|---|---|---|---|---|---|---|
| base | 32 | 34 | 6 | 4 | 2 | 78 |
| branch | 32 | 34 | 6 | 4 | 2 | 78 |

Hand review, row by row (`viewport page outcome`, the two lists side by
side): 74 of 78 rows have the same outcome. The 4 that move all have an
"unstable" capture on one side:

| Row | Base | Branch | Judgement |
|---|---|---|---|
| 1440 /about-us.html | unstable (44175; 13 problems) | differs (44175; 12 problems) | same as base: same pixel count, unstable capture |
| 1440 /blogs/index.html | unstable (84; 1 problem) | match | same as base: unstable capture |
| 1440 /cases/index.html | match | unstable (3; 1 problem) | same as base: unstable capture |
| 390 /careers/index.html | differs (size; 1 problem) | unstable (size; 2 problems) | same as base: unstable capture |

The two error rows are the same on both (768 `/services/enterprise-software.html`,
768 `/services/outsourcing.html`). None is new: the served files are
byte-identical to base (section 4) and the old site is the same checkout, so a
row can only move by capture instability (the comparison tool launches its own
browser, which gets no CDN mirror, so GSAP/Lenis/Tabler loads fail as for the
developer). Firefox and WebKit: NOT RUN (section 9).

### 7. Studio (`d772f03`, base `6470fac` for counts)

```
studio$ npm ci                                               exit 0
studio$ npx tsc -b                                           exit 0   (base exit 0)
studio$ npm test                                             exit 0   Tests 32 passed (32)   (base 32/32)
studio$ VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build    exit 0   (base exit 0)
  Preview design: /website-design/d1ebe4132f8cfa8e/ matches website/design/ byte for byte.
```

**End-to-end.** Before the run (18:23 UTC):

```
$ sqlcmd -S localhost -U sa -P … -C -Q "SELECT COUNT(*) AS e2e_sessions FROM sys.dm_exec_sessions WHERE database_id = DB_ID('DigitalHubContent_E2e')"
e2e_sessions 0
login dh_content_app: exists (not created)
```

`sqlcmd` is the scratch wrapper (first on `PATH`). With the `ci.yml` `studio`
environment (connection strings naming `DigitalHubContent`, which the harness
rewrites to `DigitalHubContent_E2e`), `Auth__SigningKey` from `ci.yml`,
`DH_E2E_API_PORT=4263`, `DH_E2E_STUDIO_PORT=4264`:

```
studio$ npx playwright test --reporter=list                  exit 0
  ✓  26 e2e/verification.spec.ts:410:1 › P2.12 Every sidebar screen loads with no console error, as admin and as editor
  26 passed (6.3m)
```

Runs on `vite` 8.3.5 (the webServer is `npx vite`). The plan says 22; the
suite has 26 tests (as the developer recorded). Only `DigitalHubContent_E2e`
was touched, by the harness.

### 8. Beyond the plan

- **Strip edge cases** (`npx tsx` probe against `src/build/strip-runtime.ts`):
  two bootstraps in one page → 2 removed, content between kept; a bootstrap
  followed by a user inline script → only the bootstrap removed, the user
  script kept; `_R_` with an extra `nonce` attribute or `self["TURBOPACK"]` →
  not removed, and `runtimeTracesIn` reports "the Turbopack runtime" (and "a
  Next chunk path"), so the build would fail closed; a bare
  `static/chunks/` URL → reported; empty page → nothing. A hypothetical
  lower-case `__turbopack_*` global with no chunk path is not detected; Next
  16.4.3 emits no such inline code (built output grep above), so this is a
  note, not a finding.
- **Scope**: `git diff --name-only 6470fac d772f03` is exactly the 12 files the
  plan lists (gate test, allow-list, two `package.json`, two lockfiles,
  `strip-runtime.ts`, its test, four pipeline records). `website/scripts`,
  `website/design`, `packages`, `.github/workflows`, `gate.mjs`, `run-*.sh`
  and golden copies: no change.
- **Test-environment note (not caused by this change)**: `npm run
  compare:sections` always writes `website/artifacts/section-comparison.json`
  in the working tree (`run.mjs:84`), whatever `SECTION_COMPARE_OUT` says, and
  `test/no-hiring-system.test.ts` then fails on that file ("contains
  /api/careers"). I hit this on the base tree when I re-ran `npm test` after
  the section comparison; the branch's `npm test` above ran before it. I moved
  the file to `<scratch>/moved-artifacts/` and re-ran the base `npm test`: exit 0,
  409 passed, 1 skipped. Same on base and branch; outside GAP-01.

### 9. NOT RUN

| Check | Reason | Covered by |
|---|---|---|
| Semgrep | Not installed in this container | `security.yml` `semgrep` |
| API build and integration tests | No change under `api/` | `ci.yml` `api` |
| Screenshot comparison in Firefox and WebKit | Not installed; `playwright install` is not allowed | `ci.yml` `screenshot-parity` (label `screenshots`) |
| CI on the pull request (5.4) | Nothing pushed; `studio`, `section-compare`, `screenshot-parity` wait on PR #38 | `ci.yml`, `security.yml`, `codeql.yml` on the final head after the rebase |
| Route / role / host / body-size checks | No route, policy or API change | n/a |

### 10. Findings

None at Blocker, Major or Minor.

Open items that are not findings against this commit (from the plan and
`plan-approval.md` condition 2): rebase on `rebuild/dotnet-platform` after
PR #38 merges, then redo the zero `diff -r`, the trace grep and the section and
screenshot comparisons against the new base, and get CI green on the final
head. The plan's e2e count (22) is stale; the suite is 26 on base and branch.

### 11. Coverage table rows verified

| Item | Status | Evidence (this report) |
|---|---|---|
| Full-tree audit 0 High/Critical, website | Verified | 2 |
| Full-tree audit 0 High/Critical, Studio | Verified | 2 |
| Production audit 0; `run-npm-audit.sh` "0 known, 0 new", both apps | Verified | 2 |
| Website entries removed from `known-findings.json` | Verified | 2 (diff) |
| Red test before the dependency fix | Verified | 1 (`2a4f836`, "0 known, 6 new", exit 1) |
| Gate self-test, no assertion weakened | Verified | 2 (63/63; three gate mutations caught) |
| D-NNN for remaining advisories | N/A | no High/Critical remains |
| Website tests green | Verified | 4 (412 passed, 1 skipped; typecheck 0) |
| Studio unit tests green | Verified | 7 (32/32) |
| Studio end-to-end | Verified | 7 (26/26) |
| Website browser suite: 0 failed, counts equal to base | Verified | 5 (29/29 with the scratch mirror; outcomes equal to base) |
| Design check green | Verified | 4 |
| Website and Studio builds green | Verified | 4, 7 |
| Built site unchanged; no Turbopack/Next runtime trace | Verified | 4 (`diff -r` exit 0, empty floor, greps empty) |
| Red test for the Turbopack bootstrap before the fix | Verified | 1 (`6ad1366` 5 failed; head 9/9) |
| Locked design and protected files untouched | Verified | 8 |
| Section comparison: no difference beyond base | Verified | 4 (reports identical) |
| Screenshot regression tests pass; report reviewed by hand | Verified (Chromium) | 6 |
| Lockfile changes expected or traced; regenerated by npm | Verified | 3 |
| `npm ci` with npm 10 and 11 for the Studio | Verified | 3 |
| Golden copies and gate unchanged; no overrides, no `--force` | Verified | 2, 3 |
| No secret in diff or logs | Verified | 2 |
| Rebase after PR #38 and CI green on final head | Open | not testable here |

Verdict: APPROVED
