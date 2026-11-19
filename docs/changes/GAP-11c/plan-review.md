# GAP-11c plan review

## Round 1

Reviewed `plan.md` (round 1) at `74d62e9` against `website/scripts/check-output.ts`, `website/test/output.test.ts`, `website/package-lock.json`, `.github/workflows/security.yml` and refinement plan rows 75 and 160.

### Findings

1. **Major (owner) - Section 9, O-1; Section 1 "Done when"; coverage row "npm audit passes".** The brief's acceptance criterion "`npm audit` pass" cannot be met as written: the plan reports plain `npm audit` exits non-zero on a pre-existing moderate fast-uri advisory, while CI (`security.yml:84`, "High and Critical") gates at high. The plan correctly does not assume an answer and keeps fast-uri out of scope (B-8). Until the owner says which level "pass" means, the criterion has no defined test. Satisfied by: the owner's answer recorded in the plan (either `--audit-level=high`, or a separate change for fast-uri sequenced before this one). I did not re-run `npm audit` (network); the claim is taken as stated and should be re-shown by the developer.
2. **Minor - Section 3, Design 2.** Behaviour for an empty or whitespace-only `src` is not stated. Today `!src` skips it; `new URL("", BASE)` resolves to the sentinel (same origin), so it should stay skipped, but say so and add it as a `good(...)` guard so a future refactor cannot flip it.
3. **Minor - Section 5, test 2.** The expected message keeps the leading space (`" https://cdn.example/x.js"`), consistent with Design 4. Fine, but the `\n\t` variant's expected string should be written out in the test name or plan so the developer does not "normalise" it.
4. **Minor - Section 10.** No risk listed for parse5 8 being ESM-only under the runner used by `check:output` (tsx) and vitest. Low likelihood; note that `npm run build` proves it.

### Checked and sound

- Fit: closes GAP-11 round-2 Minors 1 and 2 and the brief's four probes plus multi-hash; parent "Done when" row 160 quoted exactly.
- Current state: `SRI_BLOCKING_FROM = "2026-11-26"` (`:330`), `scriptAttributes` (`:336-343`), `checkScriptIntegrity` with `/<script\b([^>]*)>/gi` and `/^(?:https?:)?\/\//i` (`:346-358`) match the code. Existing tests at `output.test.ts:166-239` and the `bad`/`good`/`full` helpers exist as described.
- Lockfile: jsdom requires `parse5 ^8.0.1` (`:2425`), resolved `node_modules/parse5` 8.0.1 (`:2839-2842`); exact pin `8.0.1` adds no new package.
- Testability: each of tests 1-5 is red against today's regexp (quoted `>` truncates; no trim; `\` fails the `//` test; entities not decoded; multi-token integrity fails the anchored regexp). Guards (single `\` same-origin, `sha256 sha512`) pass before and after. Red output recorded before the fix.
- Probe 3 analysis is correct: WHATWG URL treats `\` as `/` for special schemes, so a single `\` is path-absolute same-origin and `\` is protocol-relative.
- Multi-hash relaxation is safe: the browser uses the strongest algorithm present, so `sha384-good sha512-junk` fails closed in the browser.
- Gates: SRI date unchanged with a grep check; no baseline touched; probes become committed canaries; existing tests stay unchanged (P-6).
- Rendered output: `diff -r` of base and branch `out/` with identical env is a real proof of "no rendered-output change".
- Scope: one topic, four files, all existing; nothing in `src/`, design or Studio. Commands are exact; check:csp on ports 4225/4226 (42xx).
- Security: no routes, data or secrets; dev-only dependency not bundled. Rejected alternatives (jsdom, regexp patching, htmlparser2) are real.
- Rollback (revert) is adequate for a build-time check.

Verdict: BLOCKED ON OWNER (O-1: does "npm audit pass" mean `npm audit --audit-level=high`, or must the pre-existing fast-uri moderate be cleared first?)

## Round 2

Reviewed `plan.md` (round 2) at `74d62e9`, against the round-1 findings and `website/test/output.test.ts`.

### Findings

1. **Minor - Section 5, preamble.** The `bad`/`good`/`full` helpers are local to the round-2 GAP-11 `describe` block (`output.test.ts:208-211`), not module-level. The new GAP-11c block must define its own copies (same signatures: `bad(tag, src = "https://cdn.example/x.js")`, `good(tag)`), without moving or editing the existing ones, so the existing blocks stay unchanged. The plan's "reuse the pattern" wording allows this; the developer should note it in `implementation.md`.

### Round-1 findings resolved

- Major (owner) O-1: answered and recorded with the owner's quote and date ("CI level is enough"); the criterion is now `npm audit --audit-level=high` exiting 0, matching `security.yml:84`. fast-uri stays out of scope (B-8). No exception is claimed, so no D-NNN is needed.
- Minor 2: Design 2 now covers empty and whitespace-only src, and test 6 guards `""`, bare `src`, spaces and `\n\t`. This is correct: `new URL("", BASE)` and trimmed whitespace resolve to the sentinel.
- Minor 3: test 2 now writes out the exact expected message with a real LF and tab, and says it must not be normalised. This matches Design 4 and the parse5 preprocessing (only CR and CRLF are rewritten).
- Minor 4: the ESM-only risk is listed, and `npm test` and `npm run build` prove it.

### Checked and sound

- Everything listed as sound in round 1 still holds; the round-2 edits did not change the design, scope, files or gate dates.
- The `bad` helper's default and optional `src` argument support the plan's calls in tests 1 to 4.
- The coverage table has a row for each acceptance criterion, including the new test 6 and the audit level.

Verdict: APPROVED
