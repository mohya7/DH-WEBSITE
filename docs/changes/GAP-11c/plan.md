# GAP-11c plan: parse script tags with a real HTML parser in the integrity check

## 1. Item

- Closes: GAP-11 tester round-2 Minors 1 and 2 (`docs/changes/GAP-11/test-report.md`, "Findings" after the round-2 probe table), carried forward by `docs/changes/GAP-11/delivery-approval.md`, "Tester's round-2 Minors": "Follow-up: **GAP-11c**, harden `checkScriptIntegrity` with a real HTML tokenizer (or parse5) and src normalisation (trim, backslash, entity decode), and add the four probes as tests." and "Fold into GAP-11c (accept a space-separated list when one token is a full sha384)."
- Parent item: GAP-11, refinement plan row 75 and row 160: "Every external script in the built pages carries `integrity`".
- Track: G1, Wave 1 (gates). This change hardens an existing gate; it does not add one, so it keeps the existing `SRI_BLOCKING_FROM = "2026-11-26"` and adds no new date.
- Done when (owner's brief): the four probes and the multi-hash case have tests that fail first; `npm test`, build (`CONTENT_SOURCE=snapshot`, `PUBLIC_SITE_URL=https://digitalhub.com.eg`), `check:csp` and `npm audit` pass (owner, O-1: "CI level is enough", so this means `npm audit --audit-level=high`); `SRI_BLOCKING_FROM` stays 2026-11-26; no change to rendered output.

## 2. Current state

Worktree `D:\work\DigitalHub\dh-platform-claude-gap-11c`, branch `change/GAP-11c` at `74d62e9`.

- `website/scripts/check-output.ts:336-343` `scriptAttributes` reads attributes with a regexp; `:346-358` `checkScriptIntegrity` finds tags with `/<script\b([^>]*)>/gi`, treats a src as external when `/^(?:https?:)?\/\//i` matches, and requires `integrity` to match `/^sha384-[A-Za-z0-9+/]{64}$/` and a `crossorigin` attribute name. It is called from `main()` at `:486`, and its result goes through `integrityOutcome` (`:361`), warning until `SRI_BLOCKING_FROM` (`:330`).
- Test-report round-2 probe table, the misses this change closes:
  - `<script data-x="a>b" src="https://evil/x.js">`: **not flagged** (`[^>]*` stops at the quoted `>`)
  - `src=" https://evil/x.js"`: **not flagged** (no trim)
  - `src="\evil/x.js"`: **not flagged** (no backslash handling)
  - `src="https:&#x2F;&#x2F;evil/x.js"`: **not flagged** (no entity decoding)
  - `integrity="<valid sha384> sha512-abc"`: flagged (false positive, fails closed)
- Existing tests: `website/test/output.test.ts:166-205` ("external script integrity check (GAP-11)") and `:207-239` ("..., round 2 (GAP-11)"). They use `page()` (`:17`), and `bad`/`good` helpers. All of them must stay green unchanged.
- Parser availability: `jsdom` 30.1.2 is already a direct devDependency; it depends on `parse5` `^8.0.1` (`website/package-lock.json:2425`), resolved to `node_modules/parse5` 8.0.1 (`:2839-2842`). `node_modules` is not installed in this worktree (`npm ls parse5` printed `(empty)`).
- `npm audit` today (`website/`, from the lockfile):
  ```
  fast-uri  3.0.0 - 3.1.8
  Severity: moderate
  ...
  1 moderate severity vulnerability
  ```
  `npm audit --audit-level=high` reports no high or critical. CI runs that level (`.github/workflows/security.yml:84`, "npm audit (...) — High and Critical"). The fast-uri moderate predates this change and is out of scope; the owner answered O-1 that the CI level is enough.

## 3. Design

1. **Parse with parse5.** Add `parse5` as a direct devDependency, pinned exactly at `8.0.1`, the version jsdom already pulls in, so the lockfile only gains a root `devDependencies` entry and installs no new package. `checkScriptIntegrity` calls `parse(html)` and walks the tree, including `<template>` content, for every element with `tagName === "script"`. parse5 is the WHATWG tokenizer. It closes probe 1 (a quoted `>`) and probe 4 (it decodes character references in attribute values). It lower-cases names, and it keeps the first of two duplicate attributes, as browsers do. That keeps the round-2 tests "first wins" and "upper case" green.
2. **Classify src the way the browser does.** Resolve with `new URL(src, BASE)`, where `BASE = "https://own.invalid/"` is a sentinel origin no real site can have. WHATWG URL parsing strips leading and trailing C0 whitespace and tab/newline (probe 2). For special schemes it treats `\` as `/` (probe 3). A script is external when the resolved protocol is `http:` or `https:` and its origin is not the sentinel's. This keeps today's meaning: absolute http(s) and protocol-relative are external, root-relative and relative are not. A src that fails to parse counts as external, so the check fails closed. `data:` and `blob:` stay out of scope, unchanged from today.
   Empty or whitespace-only src (`src=""`, a bare `src`, `src="   "`, `src="\n\t"`) stays skipped, as today's `!src` skips it: `new URL("", BASE)` and the trimmed whitespace case both resolve to the sentinel itself, which is same-origin. Test 6 guards this.
   Note on probe 3: the browser resolves a single backslash, `\evil/x.js`, to the same-origin `/evil/x.js`, so it is **not** external. The tester's table states otherwise. The brief's `\\evil/x.js`, which is two backslashes in the HTML, resolves to `//evil/x.js` and is external. The tests assert both, so the behaviour matches the browser.
3. **Integrity tokens.** Split the value on ASCII whitespace and accept when at least one token matches `^sha384-[A-Za-z0-9+/]{64}$`. With `sha384-good sha512-junk` the browser picks the strongest algorithm, sha512, and refuses to load the script. That fails closed in the browser, so accepting it here is safe. `crossorigin` is still checked as an attribute name.
4. **Problem text.** It reports the src as the parser decoded it, unchanged (not trimmed or resolved), so the existing expected strings stay the same. For the entity case the message shows `https://evil/x.js`.

Alternatives rejected:
- **jsdom (`new JSDOM(html)`)**: already installed, but it builds a full DOM per page, which is slower in the build's per-page loop. parse5, its own tokenizer, gives the same parsing at less cost.
- **Patching the regexps** (a quote-aware tag regexp, a manual entity decoder): this is the approach that already failed twice (round 1, then the CodeQL "Bad HTML filtering regexp" alert and round 2). It is not a spec tokenizer.
- **`htmlparser2` / `node-html-parser`**: new packages in the tree, and less faithful to the WHATWG spec than parse5.

## 4. Scope

Change:
- `website/scripts/check-output.ts`: replace `scriptAttributes` and the tag regexp in `checkScriptIntegrity` with the parse5 walk, the URL classification and the integrity tokens. Update the header comment (`:34-38`) to say "as a browser parses it". The signature `checkScriptIntegrity(file, html): string[]` and the message format do not change.
- `website/test/output.test.ts`: add a `describe("external script integrity check, parsed (GAP-11c)")` block (section 5).
- `website/package.json`: add `"parse5": "8.0.1"` to `devDependencies`.
- `website/package-lock.json`: regenerated by `npm install --save-dev --save-exact parse5@8.0.1`, never hand-edited (B-7).

Out of scope: `SRI_BLOCKING_FROM` and `integrityOutcome`; `referencedUrls` (`:91`) and the other regexp checks in the file; the `?v=` import check; `check:csp`'s leftover Edge browser (round-1 Minor 3); the fast-uri moderate advisory; `data:`/`blob:` scripts; all rendered output, `src/`, design and Studio.

## 5. Test plan

Failing tests first, committed before the fix, in `website/test/output.test.ts`. They reuse `page()` and the `bad`/`good` pattern, with `full` set to the existing 64-character sha384:

1. `it("sees a src after a quoted '>' in another attribute")`: `bad('<script data-x="a>b" src="https://cdn.example/x.js"></script>')`. Red today.
2. `it("trims whitespace around src as the browser does")`: `bad('<script src=" https://cdn.example/x.js"></script>', " https://cdn.example/x.js")`, and the same with a leading `\n\t`: `bad('<script src="\n\thttps://cdn.example/x.js"></script>', "\n\thttps://cdn.example/x.js")`, written in the test source with the JavaScript escapes `\n` and `\t`, so both the tag and the expected value hold a real line feed (U+000A) and tab (U+0009). The exact expected message is `"a.html: external script without integrity: \n\thttps://cdn.example/x.js"` (JavaScript string), with the line feed and tab kept before `https`: not trimmed, not collapsed to a space, not escaped (Design 4; HTML preprocessing only rewrites CR and CRLF, so LF and tab survive parse5 unchanged). The developer must not normalise it. Red today.
3. `it("treats a backslash like a slash, as the browser does")`: `bad('<script src="\\\\cdn.example/x.js"></script>', "\\\\cdn.example/x.js")` (HTML `\\cdn.example/x.js`). Red today. A guard in the same test: `good('<script src="\\cdn.example/x.js"></script>')` (one backslash, same origin). It passes before and after.
4. `it("decodes character references in src")`: `bad('<script src="https:&#x2F;&#x2F;cdn.example/x.js"></script>')` and `src="&#104;ttps://cdn.example/x.js"`, both expecting the decoded `https://cdn.example/x.js`. Red today.
5. `it("accepts an integrity list when one token is a full sha384")`: ``good(`<script src="https://cdn.example/x.js" integrity="${full} sha512-abc" crossorigin="anonymous"></script>`)`` and the reverse order, red today. Guard: `bad(... integrity="sha256-abc sha512-abc" ...)`, which passes before and after.
6. `it("still skips an empty or whitespace-only src")`: `good('<script src=""></script>')`, `good('<script src></script>')`, `good('<script src="   "></script>')` and `good('<script src="\n\t"></script>')`. A guard (Design 2): it passes before and after, and stops a refactor from turning an empty src into an external or unparsable one.

The developer runs them and records the red output (tests 1 to 5 failed; test 6 and the guards passed) in `implementation.md` before the fix. After the fix every test in both existing GAP-11 blocks must pass unchanged.

Afterwards, in `website/`, each with its exact command:
- `npm ci`
- `npm test` (`vitest run`)
- `npm run typecheck`
- `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build`, which runs `check:output`. Expect the line "Script integrity: every external script carries a sha384 integrity and crossorigin (warning only until 2026-11-26)." Expect no new warnings.
- Rendered output identical to base: build `74d62e9` and this branch with the same env, then `diff -r` the two `out/` folders, excluding nothing. Expect no differences. The design hash is unchanged because `website/design/` is not touched.
- `CSP_CHECK_PORT=4225 CSP_CHECK_DEBUG_PORT=4226 npm run check:csp`
- `npm audit --audit-level=high`: must exit 0 (0 high or critical). This is the pass criterion per the owner's O-1 answer. Plain `npm audit` is not a gate; the pre-existing fast-uri moderate stays a known moderate finding, out of scope.
- `npm ls parse5` shows a single deduped 8.0.1.
- `git diff 74d62e9 -- website/scripts/check-output.ts | grep SRI_BLOCKING_FROM` shows no changed line with the constant.
- E2e, design:check, compare:sections and the browser suites run in the CI `website` job, because the local e2e harness is broken (brief).

G1, Waves 1 to 3 checklist:
- One gate per pull request: yes, the single existing SRI gate.
- `*_BLOCKING_FROM`: unchanged, because this hardens an existing gate.
- A canary fixture it must reject: the four probes are committed fixtures (tests 1 to 4). The existing canaries stay.
- Pins: `parse5` is pinned exactly. No actions, images or runtimes change.
- Baselines only shrink: no baseline file changes.

## 6. Security impact

- Routes, policies, data, logins, secrets: none. The change touches a build-time check only, and nothing it changes ships to the site.
- Dependencies: one new direct devDependency, `parse5@8.0.1`. It is already in the tree through jsdom, so the installed set does not change. It is dev-only and not bundled into `out/`.
- The effect is a stronger gate: four bypasses are closed. One false positive is removed (multi-hash), and that relaxation is safe for the reason given in Design 3.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. There is no schema or data change.

## 9. Owner decisions needed

None open.

- **O-1 (answered)**: Owner, in chat, 2026-11-19: "CI level is enough". As relayed by the coordinator, the same decision was confirmed in the orchestrator session on 2026-11-19, where the owner chose "CI level (Recommended)", described as "GAP-11c only needs --audit-level=high to pass; fast-uri stays a known moderate finding". So "`npm audit` pass" means `npm audit --audit-level=high`, the CI gate (`security.yml:84`), and the fast-uri moderate advisory is out of scope. The original question, kept for the record: the brief says "`npm audit` pass". Plain `npm audit` in `website/` exits non-zero today on one pre-existing **moderate** advisory (fast-uri 3.0.0 - 3.1.8, GHSA-w74x-v6f9-j3xg and three others), which this change does not touch. CI gates at `--audit-level=high`, which passes. Does "pass" mean `npm audit --audit-level=high` (the CI gate), or must this change also clear the fast-uri moderate? Clearing it would be a second topic (B-8), and I would plan it as its own change.

## 10. Risks

- **A different parse5 version is resolved**, which would duplicate the package or change the lockfile beyond one entry. Caught by `npm ls parse5` and the lockfile diff in review.
- **The URL-based classification changes what counts as external** for a src in our own output. Caught by the existing "leaves the site's own scripts alone" test, by the build's check:output line (no new warnings), and by the `out/` diff.
- **parse5 keeps the first duplicate attribute**, which matters for the existing "first wins" behaviour. Caught by the round-2 tests, which run unchanged.
- **Slower build**: parse5 runs over every page. That cost is small for this site; the build time can be compared with base in implementation.md.
- **parse5 8 is ESM-only**: it ships no CommonJS build, so it must load under the runners that import `check-output.ts`: tsx for `check:output` and vitest for `npm test`. Both load the scripts as ESM, so the likelihood is low. `npm test` and `npm run build` (which runs `check:output` through tsx) prove it; a module-format failure stops either one.
- **Probe 3 is misread**: Design 2 and test 3 settle the single and double backslash cases against browser behaviour.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `>` inside another attribute's quoted value is flagged | test-report round 2, Minor 1; brief (1) | Planned | |
| src with leading whitespace is flagged | test-report round 2, Minor 1; brief (2) | Planned | |
| backslash src (`\\evil/x.js`) is flagged; single `\` stays same-origin | test-report round 2, Minor 1; brief (3) | Planned | |
| entity-encoded src is flagged | test-report round 2, Minor 1; brief (4) | Planned | |
| multi-hash integrity accepted when one token is a full sha384 | test-report round 2, Minor 2; brief | Planned | |
| the five new tests shown failing first | brief; G1 checklist | Planned | |
| empty or whitespace-only src stays skipped (test 6) | plan-review round 1, Minor 2 | Planned | |
| existing GAP-11 tests pass unchanged | GAP-11 | Planned | |
| `npm test`, typecheck, build (snapshot, digitalhub.com.eg), check:csp pass | brief | Planned | |
| `npm audit --audit-level=high` passes | brief; owner, O-1 | Planned | |
| built `out/` identical to base | brief (design locked) | Planned | |
| `SRI_BLOCKING_FROM` stays 2026-11-26 | brief | Planned | |
| parse5 pinned exactly, lockfile regenerated by npm | G1 checklist; B-7 | Planned | |

## 12. Revision log

- Round 1 (this plan): first version. There was no earlier `plan-review.md`, `plan-approval.md` or `implementation.md` in `docs/changes/GAP-11c/`.
- Round 2, answering `plan-review.md` round 1:
  1. Major (owner), O-1: the owner answered in chat, "CI level is enough", also confirmed in the orchestrator session on 2026-11-19 ("CI level (Recommended)"). Recorded in sections 1, 2, 5, 9 and the coverage table: the criterion is `npm audit --audit-level=high` exiting 0; fast-uri stays a known moderate finding, out of scope.
  2. Minor, empty or whitespace-only src: Design 2 states it stays skipped and why; test 6 adds `good(...)` guards for `""`, a bare `src`, spaces and `\n\t`; coverage row added.
  3. Minor, `\n\t` message: test 2 writes the exact expected message, with a real line feed and tab kept before `https`, and tells the developer not to normalise it.
  4. Minor, parse5 ESM-only: added to Risks, with `npm test` and `npm run build` as the proof.
