# Plan review: GAP-01

## Round 1

Plan-reviewer, 1 November 2026. Reviewed `docs/changes/GAP-01/plan.md` (round 1)
on `change/GAP-01` at `6470fac` (equal to `origin/rebuild/dotnet-platform`,
checked with `git ls-remote`: `6470fac3668a…`). Governing documents read from the
read-only copy of `origin/claude/cool-heisenberg-mh6zx9`: `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/deferred-items.md`,
`docs/changes/README.md`, `.claude/agents/plan-reviewer.md`, and
`.github/pull_request_template.md` (which the architect did not have). ADR 0001
and the admin audit do not apply (G1, not G2 or G3).

Every command below was run by the reviewer in this container (Node 22.23.4,
npm 10.9.9). Nothing in the repository was changed except this file;
simulations ran on `git archive` exports under the session scratchpad.

### Findings

#### F-1. Major: section 2.8 and 5.3. The local checks for the section comparison, the website browser suite and the Studio end-to-end suite are wrongly called unrunnable, and the section-comparison command cannot pass as written

This matters because the section comparison is one of the "Done when" checks.
The plan also says (5.4) that the CI `section-compare` and `studio` jobs cannot
count until PR #38 merges, with the 3 November deadline two days away.

1. **Chromium can be launched here without changing the repository.**
   Playwright 1.56.1 (`playwright-core/browsers.json`: chromium and
   chromium-headless-shell revision `1194`) fails with the default path, as the
   plan says. Pointing `PLAYWRIGHT_BROWSERS_PATH` at a scratch folder that maps
   the 1194 names to the installed 1243 binaries fixes it. The repository
   scripts already honour that variable, since they call
   `chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })`
   (`website/tools/section-compare/run.mjs:56`, `website/playwright.config.ts:7`).
   The scripts take no `executablePath` option or variable. Evidence, from a
   scratch install of `playwright@1.56.1`:
   ```
   $ node t.mjs   # chromium.launch({}) then chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
   {} FAIL browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
   {"executablePath":"/opt/pw-browsers/chromium"} OK 153.0.8010.12 ok

   $ B=<scratch>/browsers
   $ mkdir -p $B/chromium_headless_shell-1194/chrome-linux $B/chromium-1194/chrome-linux
   $ ln -s /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell $B/chromium_headless_shell-1194/chrome-linux/headless_shell
   $ ln -s /opt/pw-browsers/chromium-1243/chrome-linux64/chrome $B/chromium-1194/chrome-linux/chrome
   $ PLAYWRIGHT_BROWSERS_PATH=$B node t2.mjs   # same launch call as run.mjs
   OK 153.0.8010.12 ok
   ```
   The browser is Chromium 153, not the pinned 141. The section comparison
   measures the old and new sites in the same browser, so a local run is valid
   evidence of "no new difference". CI stays the record of the pinned browser.
   Firefox and WebKit are not installed, so a local screenshot comparison can
   only be `SCREENSHOT_BROWSERS=chromium`.
2. **The 5.3 section-comparison command fails before it launches a browser.**
   `SECTION_COMPARE_OLD=<export of origin/feature/interviewer-portal>` will
   not work. `run.mjs:39-40` runs `git -C <old> branch --show-current` and
   throws "Comparison source must stay on feature/interviewer-portal." unless
   the old root is a git checkout of a branch with exactly that name. A
   `git archive` export is not a checkout. CI meets the check through
   `actions/checkout` with `ref: feature/interviewer-portal` (`ci.yml`
   section-compare job). The old root has to be a separate read-only clone,
   for example `git clone --branch feature/interviewer-portal --single-branch
   --depth 1 <origin> <scratch>/old-site`, not a commit to that branch or a
   change to it.
3. **SQL Server is available here.** Section 2.8 says "No SQL Server". A SQL
   Server 2022 container (`dh-mssql`, `mcr.microsoft.com/mssql/server:2022-latest`)
   is listening on `localhost:1433` with the CI credentials. `/usr/bin/dotnet
   --version` reports `10.0.114`. The Studio end-to-end suite's webServer runs
   `npx vite`, so the `vite` bump this change makes is on its path. Host
   `sqlcmd` is missing (`/opt/mssql-tools18/bin` is absent), but it is inside
   the container, where CI calls it with `docker exec`.

**What would satisfy me:**
- Section 5.3 gives the exact local recipe: the scratch `PLAYWRIGHT_BROWSERS_PATH`
  symlink folder and a separate clone of `feature/interviewer-portal` used as
  `SECTION_COMPARE_OLD`. The plan states that the browser is Chromium 153 and
  that the CI job remains the pinned-browser record.
- `compare:sections` is run on the branch's `out/` and on the base's `out/`
  with port 42xx. The branch report must show no difference that the base
  report does not show.
- `npm run test:browser` (website) is attempted the same way. It has no CI job
  until GAP-04, so "NOT RUN" would leave it uncovered.
- The Studio end-to-end suite (`npx playwright test` with the CI connection
  strings, on `DigitalHubContent_E2e`, reset first) is attempted. Otherwise
  NOT RUN records the specific blocker, for example sqlcmd not on the host
  path, not "no SQL Server".
- Optionally, the Chromium screenshot regression test and a Chromium-only
  screenshot comparison are run the same way.

#### F-2. Minor: sections 2.2, 3.1 steps 3 and 4, and 5.2 (lockfile review). The expected lockfile changes are incomplete, and "No semver-major change anywhere" is not true of the tree

I ran the plan's exact commands with `--package-lock-only --ignore-scripts` on
exports of both apps. Every target is reached, and the audits come out clean:
website full tree exit 0 with only `fast-uri` (moderate) left, website
production tree "found 0 vulnerabilities", Studio full tree exit 0. Diffing
the lockfiles also shows changes the plan does not list:

- `obug` 2.2.1 → **3.0.0**, a major version, pulled by `vitest@5.0.5`
  (`"obug": "^3.0.0"`). This happens in both apps.
- `why-is-node-running` moves **down**: 3.2.2 → 3.2.1 in the website and
  3.2.3 → 3.2.1 in the Studio, because `vitest@5.0.5` pins it exactly.
- Studio `postcss` 8.5.28 → 8.5.32. It feeds the Studio CSS build through
  Tailwind. In the website, `vite/node_modules/postcss` 8.5.28 → 8.5.32.
- `rolldown` and the `@rolldown/binding-*` packages go to 1.2.16, and
  `@oxc-project/types` to 0.156.0, both through `vite`. `chai` 6.3.0,
  `magic-string`, `std-env`, `tinybench`, `nanoid`, `@types/estree` and
  `@vitest/spy` 5.0.5 also change. In the Studio, npm adds six nested entries
  under `@tailwindcss/oxide-wasm32-wasi/node_modules/` (`@emnapi/*`,
  `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, `tslib`).

These changes are expected, but section 5.2 says "an unexplained change returns
the change to the architect". Without this list the developer will either stop
for no reason or explain the changes away.

**What would satisfy me:**
- Section 2.2 corrects the sentence: no direct dependency changes major
  version, but the transitive `obug` does.
- Steps 3 and 4 list the expected transitive changes above, or a rule that
  traces each one to its parent's declared range: `vitest@5.0.5`,
  `vite@8.3.5` or `next@16.4.3`.
- R-2 names the Studio `postcss` change. `npm run build` and the
  `check-preview-design` step already cover it.

#### F-3. Minor: whole plan. The pull request template was not read, and the plan does not plan the pull request body (B-9)

`.github/pull_request_template.md` requires these sections: "What and why",
"Scope and boundaries", "Security impact", "Tests and evidence" (NOT RUN with
the CI job), "Owner decisions" ("Quoted exactly, with the date and where they
were given"), the ten Definition of Done boxes, "Review findings accepted", and
Governance (`AGENTS.md` coverage table updated, `docs/deferred-items.md` updated
for any exception). B-9 says the boxes are ticked only when true. Box 7,
"Independent code review was run", and box 10, the integrator who merges and
re-runs the suites, need an owner in this pipeline.

**What would satisfy me:**
- A short section 5.6 or 11 entry says the pull request body follows the
  template, maps sections 6, 8, 9 and 11 onto it, and quotes the owner's words
  exactly as section 1 does.
- The plan names the boxes this change cannot tick. Box 5 has no changed-line
  coverage gate yet. The "deferred-items updated" box is N/A because no
  exception is made.

#### F-4. Minor: section 5.2, built-output comparison. There is no noise floor

`diff -r <base>/out <branch>/out` is a good, direct check for R-1. But two
`next build` runs of the same commit may already differ, for example in hashed
chunk names or the build id. The developer would then be explaining noise as
upgrade effects.

**What would satisfy me:** build the base `out/` twice and diff the two builds
first. Only differences that go beyond that noise floor need a per-file
explanation.

### Checked and found sound

- **Audit state (2.1).** Re-run on `6470fac` with the same results. Website
  full tree: exit 1, `{"moderate":3,"high":4,"critical":1,"total":8}`. Website
  production tree: exit 1, `{"high":2,"critical":1,"total":3}`. Studio full
  tree: exit 1, `{"moderate":2,"high":3,"total":5}`. Studio production tree:
  exit 0, total 0. Every advisory id, range and `fixAvailable` in the
  per-package table matches `npm audit --json`. That is 5 website packages and
  3 Studio packages at High or Critical, which matches the register.
- **Target versions (2.2).** Checked with `npm view … dist-tags`. Latest is
  `next` 16.4.3 (canary 16.5.0-canary.36), `sharp` 0.35.5, `source-map-js`
  1.2.2, `undici` 8.12.3, `vite` 8.3.5, `vitest` and `@vitest/mocker` 5.0.5.
  `next@16.4.3` declares `sharp ^0.35.5`, `postcss 8.5.23`, React
  `^18.2.0 || … || ^19.0.0`, `@playwright/test ^1.51.1` and node `>=20.9.0`.
  `vitest@5.0.5` peers on `vite ^6.4.0 || ^7.0.0 || ^8.0.0` and depends on
  `@vitest/mocker 5.0.5`. `jsdom@30.1.2` declares `undici ^8.11.2`.
  `@vitejs/plugin-react` peers on `vite ^8.0.0`. Neither app has another
  `@vitest/*` direct dependency whose peer pin could conflict.
- **Upgrade commands (3.1).** Simulated with the lockfile only, as described
  under F-2. Every package reaches its target, no `overrides` and no `--force`
  are needed, and both full-tree audits exit 0. The rejected alternatives
  (`audit fix --force`, `overrides`, a `KNOWN_FINDINGS` switch in `gate.mjs`,
  dropping the known-entry tests, keeping the stale entries, switching to the
  full tree now, two pull requests) are real alternatives, and the reasons
  given for rejecting them hold.
- **Self-test dependency (2.4).** Confirmed. `gate.test.mjs:14` reads the real
  allow-list. Lines 213–231 and the `knownAdvisory` fixture (lines 300–313,
  GHSA-cjq9) depend on `npm.website`. On a scratch export with
  `npm.website = []`, the self-test gives `not ok 12 - a known-only npm report
  passes`, `not ok 21 - npm mutations of every consumed field`, `# pass 60`,
  `# fail 2`. On the branch as it is, `node --test
  .github/security/gate.test.mjs` gives `# tests 62`, `# pass 62`, `# fail 0`.
- **The fixture-gate design will work.** `gate.mjs` imports only `node:fs`,
  `node:path` and `node:url` (lines 34–36), and reads `known-findings.json` and
  `fail-on-rules.json` from its own folder (lines 38–40). A byte-identical copy
  in a temp folder therefore behaves like the real gate against a fixture
  allow-list. The byte-identity test stops the copy from drifting. No other
  test reads `known.npm`. "Every known finding has an owner and a reason"
  still has its gitleaks and semgrep entries. Adding `3 known, 1 new` makes
  the tests stronger. No golden-pinned file is touched (P-6).
- **Red step (5.1).** Reproduced on an export with the website entries
  removed: `RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh
  website` exits 1 with `website: 6 finding(s) at the gate's level; 0 known,
  6 new.` That is the exact line the plan expects. The red commit only covers
  the website production tree, which is what the gate audits today. The
  Studio and development-tree Highs rely on before-and-after full-tree audit
  evidence (5.1 step 1, 5.2), which is the right split while GAP-07 is open.
- **Scope (4) and B-8.** One topic: the GAP-01 Wave 0 item, covering both
  apps as the register defines it. The files named exist (`website/package.json:28`
  and `:44`, `studio/package.json:46` and `:47`, `known-findings.json`,
  `gate.test.mjs`). `ci.yml`, which PR #38 owns (`change/ci-runner-pin` exists
  at `b472fe5`), is left alone. So are `run-npm-audit.sh` and its golden copy,
  `gate.mjs` and `security.yml` (GAP-07). Out-of-scope items are named.
- **Acceptance criteria.** The GAP-01 "Done when" is quoted word for word from
  the refinement plan's Wave 0 table, and the companion item is quoted too.
  The coverage table (11) maps every criterion and every G1 Wave 0 checklist
  line to a check. The commands match `ci.yml`: the
  `git fetch … feature/interviewer-portal` refspec, `design:check`, and
  `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run
  build`.
- **Security (6).** No route, policy, data, login, secret or migration is
  affected. Versions are pinned exactly as they are today. The allow-list only
  shrinks.
- **Owner decisions (9).** The owner's words are quoted exactly with date and
  place: "Start waves 0 & 1 and update me with each gap done" (Mohamed
  Elbadry, 2026-11-01, project thread). The refinement plan says Wave 0 "Waits
  on O-1". In my view that instruction authorises O-1's recommended "Fix now"
  path. That path needs no exception and, by design, no behaviour change, so
  O-1 is not a blocker for this plan. The plan rightly does not record O-1 as
  decided, and stops for the owner if any advisory survives or the built site
  changes.
- **Q-1.** I agree with the plan's reading. The rule in standard section 6 is
  marked "Status: Gap (step 4f)". The refinement plan, which section 10 of the
  standard names as the dated schedule, gives "each allow-list entry cites a
  D-NNN exception and expires" to GAP-07 in Wave 1. `docs/deferred-items.md`
  also says "An entry exists only once the owner has decided it", so no agent
  could write D-NNN entries for the 2 gitleaks and 7 semgrep entries anyway.
  This change only removes entries. No owner decision is needed to proceed.
- **Rollback (8) and risks (10).** Both are specific. Reverting the whole pull
  request restores the versions and the entries together. R-1 (export shape)
  is caught by `strip-runtime.ts`, `check-output.ts`, the `out/` diff, the
  section comparison and the screenshot review, with a clear stop rule for the
  "Next 16.3.6" fixture in `strip-runtime.test.ts`.

Round 1 verdict: CHANGES NEEDED (superseded by round 2 below).

## Round 2

Plan-reviewer, 1 November 2026. Reviewed `plan.md` round 2 (revision log,
section 12) against round 1's F-1 to F-4, plus the container notes in the
read-only `ENVIRONMENT.md`. Every claim below was checked by the reviewer in
this container. Nothing was changed except this file.

### Findings

#### R2-1. Minor: sections 2.8 and 5.3 step 4. The `sqlcmd` wrapper does not pass the harness's password through, so the Studio end-to-end run fails as written

Section 2.8 says the wrapper "is enough once its folder is first on `PATH`". It
is not. `studio/e2e/start-api.ts:98-102` (`runSql`) sends the administrator
password through the `SQLCMDPASSWORD` environment variable ("never the command
line"). The prepared wrapper is `exec docker exec -i dh-mssql
/opt/mssql-tools18/bin/sqlcmd "$@"`, and `docker exec` does not forward host
environment variables. Evidence, with the wrapper's folder first on `PATH`:

```
$ SQLCMDPASSWORD=CiOnlySa2026Passw0rd sqlcmd -S localhost,1433 -d master -U sa -C -I -b -Q "SELECT 1 AS ok" </dev/null
Password: Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : Login failed for user 'sa'..
exit 1
$ docker exec -i -e SQLCMDPASSWORD=CiOnlySa2026Passw0rd dh-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost,1433 -d master -U sa -C -I -b -Q "SELECT SUSER_ID(N'dh_content_app') AS app" </dev/null
app
-----------
       NULL
exit 0
```

The harness would therefore stop with "Could not run SQL against
DigitalHubContent_E2e", which is a blocker the developer could easily fix.
The plan's NOT RUN fallback and CI `studio` still cover the criterion, so this
is not a Major. The second command above also confirms that `dh_content_app`
does not exist yet, as 2.8 says.

**What would satisfy me:** before step 4, the developer or tester puts a
change-specific wrapper first on `PATH`. It lives in its own scratch folder,
so the shared one is left unchanged, and runs `exec docker exec -i -e
SQLCMDPASSWORD dh-mssql /opt/mssql-tools18/bin/sqlcmd "$@"`. The ad hoc
checks in 5.3 step 4 (session check, `CREATE LOGIN`) use the same wrapper,
with the password given by `-P` as in CI or by `-e SQLCMDPASSWORD`. A NOT RUN
caused by this wrapper problem is not acceptable evidence. The tech lead can
attach this as a condition at gate 1. It does not need another architect
round.

### Round 1 findings: verification of the answers

- **F-1 (Major): resolved.**
  - The prepared `PLAYWRIGHT_BROWSERS_PATH` folder exists. It holds
    `chromium-1194` and `chromium_headless_shell-1194` (with
    `INSTALLATION_COMPLETE`) and `ffmpeg-1011`, the layout that launched
    Chromium 153.0.8010.12 in round 1.
  - `/home/user/old-site` is a git checkout: `git branch --show-current` →
    `feature/interviewer-portal`, HEAD `eb05f0647c34…`, which equals
    `git ls-remote origin feature/interviewer-portal`. So it passes
    `run.mjs:39-40`.
  - Section 5.3 now has runnable recipes for all four checks:
    1. The section comparison runs on base and branch, with the explicit pass
       rule "no difference beyond base", on 42xx ports.
    2. `test:browser` runs on the default and consent builds. This matches
       `consent.spec.ts:11` and `pages.spec.ts:62`, which skip on the other
       build, and the refinement plan's "29 Playwright browser tests"
       (GAP-04).
    3. The Chromium screenshot regression test and the comparison run, using
       `test/screenshot-parity-browser.test.ts` and
       `tools/check-browser-test-report.mjs`. Both files exist, and the
       commands match `ci.yml`.
    4. The Studio end-to-end suite runs with the CI connection strings and
       `Auth__SigningKey`, which match `ci.yml`'s `studio` job env, and with
       `DH_E2E_API_PORT` and `DH_E2E_STUDIO_PORT`, which are honoured by
       `studio/e2e/env.ts:12-13`.
  - The difference between Chromium 153 and 141 is stated (R-9), and the CI
    jobs remain required (5.4). The shared-server risk (R-8) has a concrete
    check before the run, and the only database touched is
    `DigitalHubContent_E2e`, as `AGENTS.md` requires. The one remaining
    defect is R2-1.
- **F-2 (Minor): resolved.** Section 2.2 now says that no *direct* dependency
  changes major version and that transitive `obug` goes to 3.0.0. Steps 3 and
  4 list every transitive change from my round 1 lockfile diff, each with its
  parent:
  - `why-is-node-running` down to 3.2.1;
  - the Studio `postcss` 8.5.32 and the nested `vite/node_modules/postcss`;
  - `rolldown` and its bindings, `@oxc-project/types`, `chai`,
    `magic-string`, `std-env`, `tinybench`, `nanoid`, `@types/estree`,
    `@vitest/spy`;
  - the six nested `@tailwindcss/oxide-wasm32-wasi` entries.

  The trace rule ("the new version satisfies the range its parent declares,
  shown with `npm view`") is checkable and does not loosen B-7. R-2 names the
  `postcss` change, and `check-preview-design` covers it.
- **F-3 (Minor): resolved.** Section 5.6 maps every template section to a
  plan section. It quotes the owner exactly and states the expected box
  states truthfully:
  - box 4 is N/A;
  - box 5 cannot be ticked in full, because there is no changed-line coverage
    gate until GAP-18, which is confirmed in the refinement plan;
  - box 7 depends on the tech lead;
  - box 10 waits for the owner to name the integrator;
  - the deferred-items box is N/A.

  That is consistent with B-9 ("ticked only when true").
- **F-4 (Minor): resolved.** Section 5.2 builds the base twice and diffs the
  two builds as a noise floor before the base-vs-branch diff. Anything beyond
  the floor that touches HTML structure, head tags, the design set or JSON-LD
  stops the change. A `git archive` export is fine for this, because the build
  scripts (`prepare-design`, `prepare-content`, `gen:types`, `check-output`)
  do not call git.

### Unchanged and still sound

Sections 2.1, 2.3 to 2.7, 3.1 commits 1 and 2, 3.2, 4, 6 to 9 and the
remaining risks are unchanged from round 1 or changed only in wording. My
round 1 checks still hold: the audits, the `npm view` versions, the self-test
(62 of 62 today, two named failures with the entries removed), the
fixture-gate design, the red step "0 known, 6 new", scope, O-1 and Q-1. The
coverage table (11) now has rows for the end-to-end run, the browser suite,
the lockfile trace and the pull request body.

Verdict: APPROVED
