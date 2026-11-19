# GAP-11c implementation

Branch `change/GAP-11c`, base `74d62e9`, plan `3b6e97f`. Approval: `plan-approval.md`, `Verdict: APPROVED`.

## What changed (plan section 4)

- `website/scripts/check-output.ts`: `scriptAttributes` and the `<script` regexp are replaced by `scriptElements` (parse5 `parse`, walking `childNodes` and `<template>` `content`; first duplicate attribute kept) and `isExternalSrc` (`new URL(src, "https://own.invalid/")`; external when http(s) and not the sentinel origin; unparsable fails closed). Integrity is split on ASCII whitespace and passes when one token is a full sha384. `crossorigin` is still an attribute-name check. Header comment says "as a browser parses it". Signature and message format unchanged; `SRI_BLOCKING_FROM` and `integrityOutcome` untouched.
- `website/test/output.test.ts`: new block `external script integrity check, parsed (GAP-11c)`, tests 1 to 6 of plan section 5. It defines its own `full`/`bad`/`good` with the same signatures as the round-2 block (reviewer's Minor, accepted at gate 1); the existing GAP-11 blocks are byte-for-byte unchanged (`git diff 74d62e9 -- website/test/output.test.ts` shows only additions).
- `website/package.json`, `website/package-lock.json`: `npm install --save-dev --save-exact parse5@8.0.1`. Lockfile diff is one line, the root `devDependencies` entry `"parse5": "8.0.1"`.

## Commits

- `a5e41f8` red tests (B-6).
- `6466c63` test correction: the first red commit lost one level of escaping in test 3 (a shell heredoc), so it asserted a single backslash as external and the guard had no backslash. Corrected to the plan's `\\` / `\` JavaScript source. Tests only; re-run red against the base check (below).
- `7ef1851` fix.
- This record.

## Red (base `check-output.ts` from `74d62e9` with the corrected tests)

`npx vitest run test/output.test.ts -t "GAP-11"`:
```
× sees a src after a quoted '>' in another attribute
× trims whitespace around src as the browser does
× treats a backslash like a slash, as the browser does
× decodes character references in src
× accepts an integrity list when one token is a full sha384
Tests  5 failed | 11 passed | 14 skipped (30)
```
Test 6 and every guard passed; the 10 existing GAP-11 tests passed. (At `a5e41f8` the same five failed: `Tests 5 failed | 1 passed | 24 skipped`.)

## Commands (in `website/`)

| Command | Exit | Output |
| --- | --- | --- |
| `npm ci` | 0 | |
| `npm install --save-dev --save-exact parse5@8.0.1` | 0 | |
| `npm ls parse5` | 0 | `jsdom@30.1.2 -> parse5@8.0.1 deduped`, `parse5@8.0.1` |
| `npx vitest run test/output.test.ts` (after fix) | 0 | `Tests 30 passed (30)` |
| `npx vitest run` (= `npm test`) | 0 | `Test Files 24 passed (24)`, `Tests 479 passed / 1 skipped (480)` |
| `npm run typecheck` | 0 | `tsc --noEmit` clean |
| `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build` (branch) | 0 | "Script integrity: every external script carries a sha384 integrity and crossorigin (warning only until 2026-11-26)." "Build output checks passed." No warnings. |
| same build at `74d62e9` (detached worktree `../dh-platform-gap-11c-base`) | 0 | same lines |
| `diff -r <base>/website/out website/out` | 0 | no differences |
| `CSP_CHECK_PORT=4225 CSP_CHECK_DEBUG_PORT=4226 npm run check:csp` | 0 | report-only violations listed as before (e.g. inline style on /careers/apply), no failure |
| `npm audit --audit-level=high` | 0 | only the pre-existing fast-uri moderate (O-1: out of scope) |
| `git diff 74d62e9 -- website/scripts/check-output.ts \| grep SRI_BLOCKING_FROM` | 0 | context lines only (no `+`/`-`): constant unchanged at 2026-11-26 |

Typecheck was the earlier run on the fix (same code). NOT RUN locally: e2e, design:check, compare:sections, browser suites. The local e2e harness is broken (brief); covered by the CI `website` job.

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `>` inside another attribute's quoted value is flagged | test-report r2 Minor 1; brief (1) | Done | test 1 red at base, green at `7ef1851` |
| src with leading whitespace is flagged | test-report r2 Minor 1; brief (2) | Done | test 2 (space and `\n\t`, exact message kept) red/green |
| `\evil/x.js` flagged; single `\` same-origin | test-report r2 Minor 1; brief (3) | Done | test 3 red/green; single-backslash guard green both |
| entity-encoded src is flagged | test-report r2 Minor 1; brief (4) | Done | test 4 red/green, message shows decoded src |
| multi-hash integrity accepted with one full sha384 | test-report r2 Minor 2 | Done | test 5 red/green; sha256+sha512 guard green both |
| five new tests failing first | brief; G1 | Done | `a5e41f8`, `6466c63`; red output above |
| empty or whitespace-only src skipped | plan-review r1 Minor 2 | Done | test 6 green before and after |
| existing GAP-11 tests unchanged and green | GAP-11 | Done | diff additions only; 30/30 |
| test, typecheck, build, check:csp pass | brief | Done | table above |
| `npm audit --audit-level=high` passes | brief; O-1 | Done | exit 0 |
| `out/` identical to base | brief | Done | `diff -r` exit 0 |
| `SRI_BLOCKING_FROM` stays 2026-11-26 | brief | Done | grep shows no changed line |
| parse5 pinned exactly, lockfile by npm | G1; B-7 | Done | one-line lockfile diff; `npm ls` deduped |

Status: READY FOR TEST
