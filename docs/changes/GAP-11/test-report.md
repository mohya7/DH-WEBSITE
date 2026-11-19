# GAP-11: Test report

## Round 1

Commit tested: `e92e2ac`, on a detached worktree `D:\work\DigitalHub\dh-platform-claude-gap-11-test`. The baseline was a second detached worktree on `af2b3be`, the merge just before the red commit. Both have been removed. Date: 2026-11-19. All commands ran in `website/` unless stated otherwise.

### 1. The red test was red

| Command | Commit | Exit | Output |
| --- | --- | --- | --- |
| `npx vitest run test/design.test.ts test/output.test.ts` | `c1ea9f3` | 1 | `Tests 8 failed \| 36 passed (44)`. The failures are the 2 GAP-11 design tests and the 6 `external script integrity check (GAP-11)` cases, which fail because the field and the function do not exist yet. This is the reason the plan gives. |
| same | `e92e2ac` | 0 | `Tests 44 passed (44)` |

### 2. Hashes, derived again by me

`curl -sfL <url> | openssl dgst -sha384 -binary | openssl base64 -A`, run on three routes:

| File | jsDelivr (bytes) | Second route | Matches `sets.ts` |
| --- | --- | --- | --- |
| gsap.min.js | 72214, `sha384-g4NTh/Iv5P…eBjpt` | registry tarball `gsap-3.12.5.tgz`, `package/dist/gsap.min.js`: same | yes |
| ScrollTrigger.min.js | 43380, `sha384-Z3REaz79…Rtj3d` | same tarball: same | yes |
| lenis.min.js | 12197, `sha384-GuiQQtSo…BEUD+` | `raw.githubusercontent.com/darkroomengineering/lenis/v1.0.23/bundled/lenis.min.js`: same | yes |

`curl -sI` on the gsap URL returns `access-control-allow-origin: *`, so `crossorigin="anonymous"` works.

### 3. Test plan commands

| Command | Exit | Output |
| --- | --- | --- |
| `npm ci` | 0 | |
| `npm test` | 0 | `Test Files 24 passed (24)`, `Tests 469 passed \| 1 skipped (470)` |
| `npm run typecheck` | 0 | |
| `npm run design:check` | 0 | `Loading order: all 10 design sets match the 29 old pages they come from.` `All 25 files match: 24 identical, 1 ported with the recorded change.` |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 1, then 0 | The first run stopped with Next's `SecurityFatalError` "upgrade recommendation" nudge, which tells you to retry. That output also told the agent to run `next upgrade --agent=security …` and to ask the user about it. I did not act on it. The nudge comes from the dependency, not from this change, and it is passed on here for the owner. The retry printed `Script integrity: every external script carries a sha384 integrity and crossorigin (warning only until 2026-11-26).` and `Build output checks passed.` |
| `grep` of `<script src=(https?:)?//…>` over `out/**/*.html` | — | 18 tags (3 scripts × 6 pages). Every one has `integrity="sha384-…" crossorigin="anonymous"`. No other external script. |
| `npm run check:csp` (fixed ports 4380/4381) | 0 | `/careers/apply 1 violation(s)` (report-only inline style, already present). Note: port 4381 was **already listening** (msedge, PID 10024, not mine) before this run, so the run may have attached to someone else's browser. I re-ran it on my own ports. |
| `CSP_CHECK_PORT=4225 CSP_CHECK_DEBUG_PORT=4226 npm run check:csp` | 0 | 27 pages `0 violation(s)`; `/careers/apply 1 violation(s)`, the same as above. No script-src or integrity violation. The run left its Edge (PID 20068) listening on 4226 after it finished. I started that process, so I stopped it. |
| `WEBSITE_TEST_PORT=4221 npm run test:browser` | 0 | `4 passed`, `25 skipped`. No `gsap is not defined`. |
| `SECTION_COMPARE_PORT=4227 npm run compare:sections` (head) | 1 | `104/119 sections match; 14 accepted; 1 failures`, `differs: /careers/apply.html #section` |
| same on the base `af2b3be`, port 4228 | 1 | identical: `104/119 …; 1 failures`, `differs: /careers/apply.html #section`. **The difference already existed and is not caused by this change.** |
| `diff -rq` base `out/` against head `out/` | — | 6 files differ (index, about, services/ai-automation, data-analytics, enterprise-software, outsourcing). After removing ` integrity="sha384-…" crossorigin="anonymous"` from the head files, `cmp` finds all 6 **byte-identical** to the base. No other file in `out/` differs. |
| `SCREENSHOT_BROWSERS=chromium,firefox SCREENSHOT_PORT=4231 SCREENSHOT_CANDIDATE_PORT=4232 npm run compare:screenshots` (head) | 1 | 156 rows: 104 match, 12 absent-accepted, 37 differs, 3 error |
| same on the base, ports 4233/4234 | 1 | 156 rows: 103 match, 12 absent-accepted, 35 differs, 4 error, 2 unstable |
| `diff` of the per-row statuses, head against base | — | 153 of 156 rows are the same. The 3 that differ are all chromium 390, and the variation is noise (`careers/index` and `index` are differs on head, unstable on base; `cases/nexthink-dex-bank` is a match on head, an error on base). `careers/index` loads no CDN script. **The parity differences already existed; this change does not cause them.** The developer's count of 52 against my 40 is also run-to-run noise. WebKit is not installed, so it was NOT RUN; the CI website job covers it, if it runs that browser. |
| `npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities` (fast-uri, next). Below the gate and not new: `package*.json` is unchanged. |

### 4. Both modes of the check, on real output

I removed the attributes from the gsap tag in `out/index.html`, ran `npx tsx scripts/check-output.ts`, and restored the file afterwards:

- Today (2026-11-19): exit 0, `Script integrity: 1 external script(s) without integrity (a warning until 2026-11-26): index.html: external script without integrity: https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js`, then `Build output checks passed.`
- With `Date` fixed to 2026-11-26 (a `--require` preload in the scratchpad): exit 1, `The build output failed its checks: - index.html: external script without integrity: …gsap.min.js`.

`SRI_BLOCKING_FROM = "2026-11-26"` is confirmed. The unit tests cover `http://`, `https://` and `//`, each bare and with SRI, and both modes with their exit codes, including fail mode with no problems giving exit 0.

### 5. The edited "never load a script async or deferred" test

Before the change, the test required each script's keys to be exactly `["src"]`, or `["module","src"]` for hero-fluid. After it, `https://` scripts must be exactly `["integrity","src"]`. The key list is still exact, so `async` and `defer` are still rejected everywhere. The test is also stricter: an `https://` script **without** integrity now fails it. This is not a loosening.

### 6. Security

| Check | Result |
| --- | --- |
| `cd website && RUNNER_TEMP=… sh ../.github/security/run-npm-audit.sh website` | exit 0, `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| same for `studio` | exit 0, `found 0 vulnerabilities`, `studio: 0 finding(s) …` |
| `RUNNER_TEMP=… sh .github/security/run-semgrep.sh` | exit 0, `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` |
| gitleaks (`run-gitleaks.sh`) | NOT RUN: gitleaks is not installed. Covered by the `security.yml` gitleaks job. |
| `run-dotnet-audit.sh` | NOT RUN: no .NET change. Covered by `security.yml`. |
| Secrets in the diff (`grep -iE "password\|secret\|token\|apikey\|connectionstring"` on `af2b3be..e92e2ac`) | none |
| Routes, roles, host checks, body size, error shape | Not applicable: no route or API change. |
| Files outside scope (`git diff --name-only 1c06d71..e92e2ac -- .github studio api`) | Only files from the merge of `8b5d6a5` (ADM-05). The GAP-11 commits touch only the 5 planned files, and `.github/workflows` and the alt-text files are not touched. |

API (`dotnet test -c Release`), studio `npm test`, studio `npm run build` and `test:e2e`: NOT RUN locally. The change touches neither, and the local e2e harness is broken (Release migrations). They are covered by the CI `api`, `studio` and `e2e` jobs on the pull request.

### 7. Beyond the plan: probes of `checkScriptIntegrity`

| Input | Result |
| --- | --- |
| `<SCRIPT src="https://x/a.js">` | `[]`, missed |
| `<script src='https://x/a.js'>` (single quotes) | `[]`, missed |
| `<script src=https://x/a.js>` (unquoted) | `[]`, missed |
| `integrity="sha384-a" crossorigin` (truncated hash) | `[]`, accepted |
| `integrity="sha384-g4NT"` with `data-x="crossorigin"` and no crossorigin attribute | `[]`, accepted |
| `HTTPS://…` and `<script\nsrc=…>` | caught |

## Findings

1. **Minor: the build check matches attribute syntax loosely.** Reproduce: call `checkScriptIntegrity("p", html)` with any of the "missed" or "accepted" inputs in section 7. Expected: each yields `p: external script without integrity: …`. Actual: `[]`. React's output always uses lowercase tags and double quotes, so the built site is not affected today. But the gate would let through raw HTML from content or a hand-written page that uses other quoting, and it accepts a malformed hash or a "crossorigin" that is only an attribute value. Suggested direction, for the developer: match the tag case-insensitively, handle `'` and unquoted values, require the 64-character sha384 that test 1 already demands, and match `crossorigin` as an attribute name.
2. **Minor: `SRI_BLOCKING_FROM` is fixed to 2026-11-26, not to merge + 7.** The developer flagged this. If the merge happens after 2026-11-19, the report window is shorter than the seven days the G1 rule asks for. Expected: seven days of reporting after the merge. Actual: a constant tied to the date of implementation. The owner or tech lead should confirm or move the date at merge time.
3. **Minor (environment, not this change): `check:csp` leaves its Edge debug browser running after it exits.** Reproduce: run `CSP_CHECK_PORT=4225 CSP_CHECK_DEBUG_PORT=4226 npm run check:csp` and check `netstat` afterwards. Expected: nothing is left listening on 4226. Actual: msedge is left listening. An earlier copy of the same thing, on 4381, was found before my run. Because the default ports are fixed (4380 and 4381, outside 42xx), a second run can attach to a leftover browser. This belongs to its own change.
4. **Note:** the Next.js build printed a `SecurityFatalError` upgrade nudge that included instructions aimed at the agent. I did not follow them. The moderate Next advisories already exist and fall under GAP-07's audit, not this change.

## Coverage table rows verified

| Item | Status | Evidence (this round) |
| --- | --- | --- |
| Every external script in the built pages carries `integrity` | Verified | 18/18 external tags in `out/` carry sha384 and crossorigin; the build check passes |
| GSAP, ScrollTrigger and Lenis have integrity | Verified | hashes re-derived from jsDelivr, the npm tarball and GitHub; all match |
| Build fails on a missing integrity; canary rejected | Verified | red-then-green; real output warns (exit 0) today and fails (exit 1) on 2026-11-26; http, https and // tested |
| Rendering unchanged | Verified | `out/` is byte-identical to the base apart from the attributes; sections are identical to the base; screenshots match the base on 153/156 rows, and the rest is noise |
| Browser suite green | Verified | `test:browser` 4 passed and 25 skipped by design |
| No workflow or alt-text files changed | Verified | name-only diff |
| API and e2e | NOT RUN locally | CI `api` and `e2e` jobs |
| O-1 and O-2 in the owner's words | Present | `implementation.md`, relayed by the orchestrator; not verified first-hand by the tester |

Verdict: APPROVED

## Round 2

Commit tested: `8979481` (fix `d2e9ef1`, red `333b275`), on a detached worktree `../dh-platform-claude-test-gap11r2`, since removed. `node_modules` was borrowed by a junction to the change worktree's tree; nothing was installed or upgraded.

Scope: the CodeQL "Bad HTML filtering regexp" alerts (`check-output.ts:335`, `design.test.ts:298`) and round-1 Minor 1.

### Checks (in `website/`)

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Red at `333b275` | `npx vitest run test/output.test.ts` | 1 | `Tests 4 failed \| 20 passed (24)`. The four new tests fail for the reasons the plan gives: `<SCRIPT SRC=...>`, single-quoted src, `integrity="sha384-abc"`, and `?crossorigin` in src are all accepted (`expected [] to deeply equal [ Array(1) ]`) |
| Green at `8979481` | `npx vitest run test/output.test.ts test/design.test.ts` | 0 | `Tests 48 passed (48)` |
| Typecheck | `npx tsc --noEmit` | 0 | |
| Unit suite | `npm test` | 0 | `Test Files 24 passed (24)`, `Tests 473 passed \| 1 skipped (474)` |
| Build | `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 1 | `▲ Next.js 16.4.3 (Turbopack)` then `⨯ Your version of Next.js is affected by a known security vulnerability.` The developer's report is confirmed. Not bypassed and Next was not upgraded |
| Checker on the round-1 output | `out/` copied from the change worktree, then `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npx tsx scripts/check-output.ts` | 0 | `Script integrity: every external script carries a sha384 integrity and crossorigin (warning only until 2026-11-26).` `Build output checks passed.` |
| Audit | `npm audit --audit-level=high` | 0 | `2 moderate severity vulnerabilities`: `next 16.2.0 - 16.4.4` (GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8), fix in `next@16.4.6`. Nothing high, so the audit gate passes, but these are the advisories behind the build block |
| design:check, compare:sections, browser suites | | NOT RUN | They need a fresh `next build`, which is blocked. Round 2 does not change rendered output (`sets.ts` and `Design.tsx` are untouched). CI `website` job |
| Semgrep, gitleaks | | NOT RUN | Not installed. `security.yml` semgrep and gitleaks jobs |
| Routes and roles | | N/A | No route changed |

### Adversarial probes of `checkScriptIntegrity` (throwaway test file, deleted)

| Input | Result |
| --- | --- |
| `<script/src="https://evil/x.js">` | flagged (correct) |
| newline between `script` and `src` | flagged (correct) |
| `integrity="bad" integrity="<valid>"` (first wins, as in HTML) | flagged (correct) |
| `data-crossorigin` with no `crossorigin` | flagged (correct) |
| upper-case `SCRIPT SRC INTEGRITY CROSSORIGIN`, all valid | passes (correct) |
| `<script data-x="a>b" src="https://evil/x.js">` | **not flagged** |
| `src=" https://evil/x.js"` (leading space) | **not flagged** |
| `src="\evil/x.js"` (browsers treat it as `//evil/`) | **not flagged** |
| `src="https:&#x2F;&#x2F;evil/x.js"` (entity-encoded) | **not flagged** |
| `integrity="<valid sha384> sha512-abc"` (valid multi-hash SRI) | flagged (false positive; fails closed) |

### Findings

1. **Minor: the checker can still miss an external script in four HTML forms.** Steps: call `checkScriptIntegrity("f", html)` with each of the four rows marked "not flagged" above. Expected: one problem each, because a browser loads each one as an external script. Actual: `[]`. Causes: the tag regexp `[^>]*` ends at a `>` inside a quoted value; the src test `^(?:https?:)?\/\/` does not trim leading whitespace, accept backslashes, or decode entities. None of these forms comes out of React or Next today, so the round-1 output is not affected. The gate is weaker than it says only against hand-written or injected HTML.
2. **Minor: valid multi-hash integrity is rejected.** `integrity="sha384-... sha512-..."` is valid SRI but fails `^sha384-[A-Za-z0-9+/]{64}$`. This fails closed, so it is safe, but a later change that adds a second hash will trip the gate.
3. **Not a finding against GAP-11; needs an owner decision:** Next.js 16.4.3 is affected by GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 (moderate). `next build` now stops with `SecurityFatalError`, which blocks every website build on this base. The fix needs its own change to upgrade to `next@16.4.6` or later. Until then, round 2 cannot get a fresh build, design check, section comparison or browser run.

Round-1 Minor 1 and both CodeQL alerts are resolved: case, single-quoted and unquoted src, bare attributes, a full-length sha384, and crossorigin as an attribute name are each proven by a red-then-green test and by probe.

### Coverage rows verified this round

| Item | Status | Evidence |
| --- | --- | --- |
| Build fails or warns on an external script without integrity; canary rejected | Verified, with Minor 1 | red 4 failed, green 48 passed; probes |
| Every external script in the built pages carries integrity | Verified on round-1 output | checker exit 0 |
| Rendering unchanged | NOT RUN this round (build blocked) | no rendering file changed; CI `website` |
| API and e2e | NOT RUN locally | CI `api` and `e2e` |

Verdict: BLOCKED ON OWNER (Next.js SecurityFatalError from GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 blocks `next build`, so the planned build, design:check, compare:sections and browser checks cannot run. It needs an owner decision on a separate Next.js upgrade change. GAP-11 round 2 itself has no Blocker or Major.)
