# GAP-11: Implementation

Branch `change/GAP-11`, worktree `D:\work\DigitalHub\dh-platform-claude-gap-11`. Not pushed.

## Commits

| SHA | Subject |
| --- | --- |
| `af2b3be` | Merge remote-tracking branch 'origin/rebuild/dotnet-platform' into change/GAP-11 (merge, not rebase; it brings in 8b5d6a5) |
| `c1ea9f3` | GAP-11: Add failing tests for integrity on third-party scripts (red, B-6) |
| `0cec01e` | GAP-11: Give the CDN motion scripts integrity hashes and check for them (fix) |

## What changed, mapped to plan section 4

- `website/src/design/sets.ts`: adds `integrity?: string` to `ScriptItem`, plus `GSAP_INTEGRITY`, `SCROLL_TRIGGER_INTEGRITY` and `LENIS_INTEGRITY` beside the URLs. The three `motion` entries carry them. The header comment explains the hashes.
- `website/src/design/Design.tsx`: `DesignScripts` uses `ScriptItem`, which widens the local cast. It renders `integrity` and, only when that is set, `crossOrigin="anonymous"`. Order, position, and the absence of async and defer are unchanged.
- `website/scripts/check-output.ts`:
  - `SRI_BLOCKING_FROM = "2026-11-26"` (condition 1).
  - `checkScriptIntegrity(file, html)`. Every `<script src>` whose src is `http://`, `https://` or protocol-relative `//` (condition 3) must have `integrity="sha384-…"` and `crossorigin`. Otherwise it reports `<file>: external script without integrity: <src>`.
  - `integrityOutcome(problems, today, blockingFrom)`. Before the date, problems are warnings and the exit code is 0. On and after it, they are failures and the exit code is 1.
  - `main()` runs the check over every page in `out/`, prints the warnings, adds failures to the build problems (which exit 1), and prints the mode. The header comment lists the check.
- `website/scripts/design-sources.ts`: **not changed**. `design:check --sets` compares src and order only, and it passed unchanged (see below).
- Tests:
  - `website/test/design.test.ts`: tests 1 and 2. The existing test "never load a script async or deferred" pinned each script's keys to `["src"]`. The fix commit now allows exactly `["integrity", "src"]` for `https://` scripts, and nothing else. Its intent (no async or defer key) is unchanged. I am flagging this because it touches an existing test.
  - `website/test/output.test.ts` (condition 2): test 3 cases for https, http and `//`, each bare and with SRI. Further cases cover integrity without crossorigin, a non-sha384 integrity, and the site's own scripts left alone. The warn and fail modes are tested with their exit codes, including fail mode with no problems giving exit 0.

### SRI_BLOCKING_FROM choice

The plan sets it seven days after the merge. The merge date is not known, so I set it to seven days after today (2026-11-19 + 7 = 2026-11-26). If the merge comes later, the architect or owner may want this moved. It is a single constant.

## Hash derivation (condition 4)

| File | Plan (CDN fetch) | Second route | Result |
| --- | --- | --- | --- |
| gsap.min.js | `sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt` | `npm pack gsap@3.12.5` into the scratchpad, not installed, `package/dist/gsap.min.js` | same |
| ScrollTrigger.min.js | `sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d` | same tarball, `package/dist/ScrollTrigger.min.js` | same |
| lenis.min.js | `sha384-GuiQQtSonx5JfFrW04viv7KCVyTAZZKHCXVtcve0DYt8fUPKLdigmPuBh9XBEUD+` | second CDN fetch, and GitHub tag `v1.0.23` `bundled/lenis.min.js` | same |

Note for the tester: the GitHub repo is now `darkroomengineering/lenis`. The path `raw.githubusercontent.com/studio-freight/lenis/v1.0.23/...` returns 404. My first attempt piped that empty body into openssl and got the empty-input hash (`OLBgp1Gs…`). That was a failed fetch, not a mismatch. `https://raw.githubusercontent.com/darkroomengineering/lenis/v1.0.23/bundled/lenis.min.js` (HTTP 200, 12197 bytes) matches the CDN. The CDN URL in `sets.ts` still resolves under `studio-freight` and is unchanged. jsDelivr sends `access-control-allow-origin: *`.

## Commands (run in `website/`)

| Command | Exit | Key output |
| --- | --- | --- |
| `npm ci` | 0 | done; no dependency change |
| `npx vitest run test/design.test.ts test/output.test.ts` (red, before the fix) | 1 | `Tests 8 failed \| 36 passed (44)`: `.toMatch() expects to receive a string, but got undefined`, `checkScriptIntegrity is not a function`, gsap tag lacks `integrity=` |
| same, after the fix | 0 | `Tests 44 passed (44)`. In between, a failure I reported before fixing it: the existing "never load a script async or deferred" test failed on the new `integrity` key. The fix is described above. |
| `npm test` | 0 | `Test Files 24 passed (24)`, `Tests 469 passed \| 1 skipped (470)` (the skip already existed) |
| `npx tsc --noEmit` | 0 | |
| `npm run design:check` | 0 | `Loading order: all 10 design sets match the 29 old pages they come from.` `All 25 files match` |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | `Build output checks passed.` (the first two attempts exited 1 only because these two env vars were unset) |
| `npx tsx scripts/check-output.ts` (re-run after wiring the check into `main()`) | 0 | `Script integrity: every external script carries a sha384 integrity and crossorigin (warning only until 2026-11-26).` `Build output checks passed.` |
| Same, with `integrity` stripped from gsap in `out/index.html` (restored afterwards) | 0 | `Script integrity: 1 external script(s) without integrity (a warning until 2026-11-26): index.html: external script without integrity: https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js`. Warn mode shown on the real output. Fail mode is covered by test 3. |
| `npm run check:csp` | 0 | report-only inline-style lines, already present; no script or integrity violation. The script uses its own fixed ports, 4380 and 4381 (outside 42xx). |
| `WEBSITE_TEST_PORT=4211 npm run test:browser` | 0 | `4 passed`, `25 skipped` (consent and container-gated specs, which skip by design in a build with no container id) |
| `SECTION_COMPARE_PORT=4212 npm run compare:sections` | 1 | `104/119 sections match; 14 accepted; 1 failures`. The one is `differs: /careers/apply.html #section`, the apply form's markup (`class=apply-form`, `action=/api/v1/public/apply` against the reference's `careers-apply-form`, `/api/careers/applications`). That page loads no CDN script, and this change does not touch the form. It was already there. Not fixed: out of scope. |
| `SCREENSHOT_PORT=4213 SCREENSHOT_CANDIDATE_PORT=4214 npm run compare:screenshots` | 1 | WebKit is not installed (`Executable doesn't exist … webkit-2215`). I did not download it. |
| Same with `SCREENSHOT_BROWSERS=chromium,firefox` | 1 | 156 captures, 52 not matching |
| Baseline: the same comparison on a copy of `out/` with only ` integrity="…" crossorigin="anonymous"` removed (ports 4216 and 4217) | 1 | 156 captures, **52 not matching, the same count**. 148 of 156 rows have the same status. The 8 that differ go both ways: `chromium 768 /services/ai-automation` differs only with SRI, and `/services/enterprise-software` differs only without, each about 7,500 pixels. Others are `unstable` or `error` in both runs. This is run-to-run noise, not the change. |
| `npm audit --audit-level=high` | 0 | no high findings; no dependencies changed |
| By hand: built `out/` served on 4215, opened in Playwright Chromium (`/`, `/about`, `/services/ai-automation`) | 0 | `gsap: object, ScrollTrigger: function, Lenis: function` on all three. Integrity or `gsap is not defined` console lines: `[]` |
| API and e2e tests | NOT RUN | API not touched; the local e2e harness is broken (it fails at the Release migrations). Covered by the CI `api` and `e2e` jobs on the pull request. |

I did not review the screenshot report by eye. I compared it in numbers against the baseline above. The 52 differences already existed and appear in both runs, and the plan's expected result of "no differences" does not hold on this base either way. The report is at `website/tools/screenshot-parity/output/report.html`.

## Migrations

None.

## Owner decisions (P-7)

Relayed by the top orchestrator session (local_23423d93), not typed in this session. On 19 November 2026, in the orchestrator's Claude Code session, the owner was asked "Take the recommended defaults for all three questions?". The defaults were:
- O-1: "Scripts only now; the stylesheet goes to a follow-up, GAP-11b"
- O-2: "Warn for 7 days, then block, as the standard's rule for new gates says"

The owner answered: "Yes, defaults".

These match what is implemented: scripts only, and `SRI_BLOCKING_FROM` seven days out.

## G1 checklist

- One gate in this pull request: the integrity check. It reports first and blocks from `SRI_BLOCKING_FROM`.
- Canary committed: test 3 in `test/output.test.ts`.
- Pins: no change to actions, images, Node or .NET.
- Baselines: none added.
- `.github/workflows/*` and the alt-text files: not touched (`git diff --stat 1c06d71..HEAD` lists only the merge's files and the five GAP-11 files).

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Every external script in the built pages carries `integrity` | Refinement plan line 160 | Done | `check-output.ts` run on `out/`: "every external script carries a sha384 integrity and crossorigin"; built tags shown with `integrity` and `crossorigin="anonymous"` |
| GSAP, ScrollTrigger and Lenis from cdn.jsdelivr.net have integrity | Owner's request 2026-11-19 | Done | `sets.ts` constants; hashes derived twice (table above); tests 1 and 2 pass |
| Build fails on an external script without integrity; canary rejected | G1 checklist; GAP-21; conditions 1 and 3 | Done (warn until 2026-11-26, then fail) | test 3 in `output.test.ts` (https, http and `//`; warn exit 0, fail exit 1); warn mode shown on real output |
| Rendering unchanged: section comparison and screenshot parity | CLAUDE.md settled design | Done, with differences that already existed | sections: only `/careers/apply` form markup, which this change does not touch; screenshots: 52 of 156 differ with and without SRI, the same set apart from noise; WebKit not run |
| Browser suite green, so the scripts run | Test plan | Done | `test:browser` 4 passed and 25 skipped by design; manual probe shows gsap, ScrollTrigger and Lenis defined with no integrity errors |
| No workflow or alt-text files changed | Task constraint | Done | the diff lists only the five GAP-11 files |
| API and e2e: CI jobs green (local harness broken) | Task constraint | NOT RUN locally | CI `api` and `e2e` jobs on the pull request |
| O-1 and O-2 answered in the owner's words | P-7 | Done | Owner decisions section, quoted with provenance |

Status: READY FOR TEST
