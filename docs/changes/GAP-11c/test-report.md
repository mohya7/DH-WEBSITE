# GAP-11c test report

## Round 1

Commit tested: `a9653c4` (change/GAP-11c), on detached worktree `D:\work\DigitalHub\dh-platform-claude-gap-11c-test` (removed afterwards). Base `74d62e9` built in a second detached worktree (removed). All commands in `website/`.

### Checks

| Check | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| Install | `npm ci` | 0 | |
| Red: corrected tests (6466c63 content, at head) vs base check | `git show 74d62e9:website/scripts/check-output.ts > scripts/check-output.ts; npx vitest run test/output.test.ts -t "GAP-11"` | 1 | `× sees a src after a quoted '>'`, `× trims whitespace`, `× treats a backslash like a slash`, `× decodes character references`, `× accepts an integrity list`; `Tests 5 failed \| 11 passed \| 14 skipped (30)`. Test 6, guards, and the 10 existing GAP-11 tests pass. Failures are for the plan's reasons. |
| Green | `npx vitest run` (= `npm test`) | 0 | `Test Files 24 passed (24)`, `Tests 479 passed \| 1 skipped (480)` |
| Typecheck | `npm run typecheck` | 0 | |
| Build | `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` | 0 | "Script integrity: every external script carries a sha384 integrity and crossorigin (warning only until 2026-11-26)." "Build output checks passed." No warnings. |
| Base build | same at `74d62e9` | 0 | |
| Output identical | `diff -r <base>/website/out <head>/website/out` | 0 | no differences |
| CSP | `CSP_CHECK_PORT=4231 CSP_CHECK_DEBUG_PORT=4232 npm run check:csp` | 0 | report-only violations as before (e.g. inline style on /careers/apply) |
| Audit (O-1) | `npm audit --audit-level=high` | 0 | no high/critical (fast-uri moderate, out of scope) |
| Pin | `npm ls parse5` | 0 | `jsdom@30.1.2 -> parse5@8.0.1 deduped`, `parse5@8.0.1` |
| Gate date | `git diff 74d62e9 -- scripts/check-output.ts \| grep -E "^[+-].*SRI_BLOCKING"` | 1 | no changed line; stays 2026-11-26 |
| Semgrep | `semgrep scan --metrics=off --quiet --config p/javascript --config p/typescript --config p/owasp-top-ten --config p/secrets scripts/check-output.ts test/output.test.ts` | 0 | no findings. Run directly on the changed files; `run-semgrep.sh` needs `RUNNER_TEMP` (CI `security.yml` semgrep job runs the full scan). |
| Secrets in diff | `git diff 74d62e9 \| grep -iE "password\|secret\|token\|apikey"` | | only prose/test names, no secret |
| gitleaks | NOT RUN | | not installed; covered by the `security.yml` gitleaks job |
| e2e, design:check, compare:sections, browser suites | NOT RUN | | local e2e harness broken (brief); CI `website` job |
| studio/api suites | NOT RUN | | not touched by the change; CI |

Routes, roles, host checks, body limits, error shape: not applicable (build-time check only, no route change).

### Security probes against `checkScriptIntegrity` (head)

Backslashes built with `String.fromCharCode(92)` to avoid shell escaping.

| Input | Result | Expected |
| --- | --- | --- |
| `src="HTTPS://evil/x.js"` | flagged | flagged |
| `src="http:evil/x.js"` (cross-scheme, no slashes) | flagged | flagged |
| `src="https:evil/x.js"` (same-scheme relative) | skipped | skipped (browser resolves same-origin) |
| `src="ht<TAB>tps://evil/x.js"` | flagged | flagged (URL parser strips tab) |
| `<template><script src=https://evil>` | flagged | flagged |
| script in comment / `<noscript>` | skipped | skipped (not executed) |
| unquoted src, `<script/src=...>` | flagged | flagged |
| script after `</html>` | flagged | flagged |
| `src="\u00a0https://evil/x.js"` (NBSP) | skipped | skipped (browser treats as relative path) |
| `\\\evil`, `/\evil`, `\/evil`, `\\evil` | flagged | flagged |
| `\evil` | skipped | skipped |
| integrity padded with spaces | accepted | accepted |
| integrity 65 chars, `SHA384-` upper, `...?opt` suffix | flagged | flagged (fail closed) |
| `src="https://own.invalid/x.js"` | skipped | acceptable (`.invalid` is reserved, cannot resolve) |
| `<svg><script href="https://evil/x.js">` | skipped | see Minor 1 |
| 5000 nested `<div>` then an external script | throws `RangeError: Maximum call stack size exceeded` | see Minor 2 |

### Findings

1. **Minor: SVG `<script href>` is not checked.** Steps: `checkScriptIntegrity("a.html", '<svg><script href="https://evil/x.js"></script></svg>')`. Expected: flagged (browsers load inline-SVG script `href`, and SRI does not apply to it, so it should be reported). Actual: `[]`. The base regexp missed it too, so this is not a regression; consider a follow-up.
2. **Minor: deep nesting crashes the check.** Steps: `"<div>".repeat(5000) + '<script src="https://evil/x.js"></script>'`. Expected: one problem reported. Actual: the recursive `walk` in `scriptElements` throws `Maximum call stack size exceeded` (also at 20000; 200000 did not finish parse5 in 300 s). It fails closed (the build check crashes) and our output never nests like this, so Minor; an iterative walk would fix the crash.

No Blocker or Major.

### Coverage rows verified

| Item | Status | Evidence |
| --- | --- | --- |
| `>` inside another attribute's quoted value is flagged | Verified | test 1 red at base, green at head |
| src with leading whitespace is flagged | Verified | test 2 red/green; tab probe |
| `\\evil/x.js` flagged; single `\` same-origin | Verified | test 3 red/green; backslash probes |
| entity-encoded src flagged | Verified | test 4 red/green |
| multi-hash accepted with one full sha384 | Verified | test 5 red/green; malformed-token probes still flagged |
| five new tests failing first | Verified | red run above |
| empty / whitespace src skipped | Verified | test 6 green before and after |
| existing GAP-11 tests unchanged and green | Verified | 11 passed at base incl. 10 existing; 479 passed at head |
| test, typecheck, build, check:csp | Verified | table above |
| `npm audit --audit-level=high` | Verified | exit 0 |
| `out/` identical to base | Verified | `diff -r` exit 0 |
| `SRI_BLOCKING_FROM` 2026-11-26 | Verified | grep |
| parse5 pinned, deduped | Verified | `npm ls parse5` |

Verdict: APPROVED
