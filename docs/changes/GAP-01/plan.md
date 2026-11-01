# Plan: GAP-01 — clear every High and Critical npm advisory in the website and the Studio

Architect, round 3, 1 November 2026 (rounds 1 and 2 the same day). Change branch `change/GAP-01`, cut from
`origin/rebuild/dotnet-platform` at `6470fac` (no tracking).

**Where the governing documents were read.** `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/quality/baseline-2026-10-27.md`, `docs/deferred-items.md`,
`docs/changes/README.md`, `.claude/agents/architect.md` and the updated
`AGENTS.md` are **not on `rebuild/dotnet-platform` yet**. They are on
`origin/claude/cool-heisenberg-mh6zx9` and were read from a read-only copy of
that branch, together with `.github/pull_request_template.md` (read in round 2;
round 1 did not have it). The container notes in the same copy
(`ENVIRONMENT.md`) were read in round 2. Consequences for this change:

- `docs/deferred-items.md` does not exist on the base branch. If any advisory
  cannot be fixed and needs a D-NNN exception, that exception cannot be
  recorded on this branch until the governing-docs pull request lands (see
  Risks, R-3). This plan expects no exception: every advisory has a published
  fix (section 2).
- `docs/changes/` does not exist on the base branch. This plan creates
  `docs/changes/GAP-01/`.
- ADR 0001 and the admin audit do not apply (not G2 or G3).

This is a revision. Round 2 answered `plan-review.md` round 1 (F-1 to F-4)
and was approved at gate 1 (`plan-approval.md`). Round 3 answers the
developer's stop in `implementation.md` round 1 (head `362a5e9`,
`Status: BACK TO ARCHITECT`): `next` 16.4.3 adds an inline Turbopack bootstrap
script to every page, and the strip and its fail-closed trace check let it
through. Section 12 records how each point is answered. The new design is
section 3.1 steps 5 and 6.

## 1. Item

- **Closes:** GAP-01 (register: "Security | S-7; findings 1, 3, 7"), and the
  baseline findings F1 (Critical `next` advisories), F3 (three known Highs past
  the 7-day deadline) and the dependency half of F4 (development Highs). It does
  **not** close GAP-07 (switching the gate itself to the full tree, with
  expiries), which is Wave 1.
- **Track:** G1, Wave 0 (security deadline, 28 October to 3 November).
- **Wave 0 item, as written in the refinement plan:** "Upgrade the website to
  `next` 16.4.3, refresh `sharp` and `source-map-js`, and update `vite`,
  `undici` and `vitest` in both apps".
- **Done when (quoted):** "`npm audit --audit-level=high` on the full tree
  reports 0 in the website and the Studio; the website entries are removed from
  `known-findings.json`; tests, design check, build and section comparison are
  green; the screenshot report is reviewed by hand, since that step cannot fail
  yet".
- **Companion item (only if needed):** "Record an exception for any advisory the
  upgrade cannot fix | GAP-01 | Owner, then agent | Each remaining advisory cites
  a D-NNN entry in `docs/deferred-items.md` that quotes the owner and has an
  expiry". Not expected to be needed.
- **Owner's instruction:** "Start waves 0 & 1 and update me with each gap done"
  (Mohamed Elbadry, 2026-11-01, project thread). Standard section 9, O-1:
  "Fix or accept the Critical `next` advisories (baseline F1)", recommendation
  "Fix now: upgrade the website to `next@16.4.3` in its own pull request". See
  section 9 for how this plan treats O-1.

## 2. Current state

### 2.1 Audit, as run on `change/GAP-01` (= `6470fac`), Node 22.23.4, npm 10.9.9

No `node_modules` is installed; `npm audit` reads `package-lock.json` only.

| Command (in the app folder) | Exit | Summary (`metadata.vulnerabilities`) |
|---|---|---|
| website: `npm audit --audit-level=high` | 1 | moderate 3, high 4, critical 1, total 8 |
| website: `npm audit --omit=dev --audit-level=high` | 1 | high 2, critical 1, total 3 |
| studio: `npm audit --audit-level=high` | 1 | moderate 2, high 3, total 5 |
| studio: `npm audit --omit=dev --audit-level=high` | 0 | total 0 |

Per package, from `npm audit --json` (full tree):

| App | Package (lockfile version, prod/dev) | npm severity | Advisories at High or Critical | Resolved by | Path to it |
|---|---|---|---|---|---|
| website | `next` 16.3.6, prod, direct (`"next": "16.3.6"`) | critical | GHSA-2464-fhr4-w9xw (critical, `>=16.0.0 <=16.4.0`), GHSA-673q-mjm6-r5xr (critical, `<=16.4.0`), GHSA-p3m5-59mp-jv5r (high, `<=16.4.0`), GHSA-cjq9-62q9-8jv4 (high, `<16.3.8`); plus 6 moderate/low | `next` 16.4.3 (`fixAvailable: {"name":"next","version":"16.4.3","isSemVerMajor":false}`) | direct |
| website | `sharp` 0.35.4, prod, optional | high | GHSA-wq5f-xc86-pv6w (`<0.35.5`) | 0.35.5 | `next` optionalDependencies `^0.35.4`; `next@16.4.3` declares `^0.35.5` |
| website | `source-map-js` 1.2.1, prod | high | GHSA-68fv-2mgg-jv7q (`>=1.0.0 <1.2.2`) | 1.2.2 | `postcss` 8.5.23 (pinned by `next`), `vite/node_modules/postcss` 8.5.28, `css-tree`, all `^1.2.1` |
| website | `undici` 8.12.1, dev | high | GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm (all `>=8.0.0 <8.12.2`); plus 4 moderate | 8.12.2 or later (8.12.3 is latest) | `jsdom` 30.1.2 `^8.11.2` |
| website | `vite` 8.3.1, dev | high | GHSA-587h-7wmj-h5pm (`>=8.3.0 <=8.3.2`); plus 5 moderate/low | 8.3.3 or later (8.3.5 is latest) | peer of `vitest` / `@vitest/mocker` `^8.0.0` |
| website | `vitest` 5.0.2, dev, direct; `@vitest/mocker` 5.0.2 | moderate | none at High (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp moderate, `<5.0.3`) | `vitest` 5.0.5 | direct |
| website | `fast-uri` 3.1.8, dev | moderate | none at High (4 moderate/low, `<3.1.9`) | 3.1.9 | `ajv` 8.20.0 `^3.0.1` |
| studio | `vite` 8.3.0, dev, direct (`"vite": "8.3.0"`) | high | GHSA-587h-7wmj-h5pm; plus 5 moderate/low | `vite` 8.3.5 (`fixAvailable` names 8.3.5) | direct |
| studio | `undici` 8.11.2, dev | high | same four Highs as the website | 8.12.3 | `jsdom` 30.1.2 `^8.11.2` |
| studio | `source-map-js` 1.2.1, dev | high | GHSA-68fv-2mgg-jv7q | 1.2.2 | `postcss` 8.5.28, `@tailwindcss/node`, `css-tree`, all `^1.2.1` |
| studio | `vitest` 5.0.2, dev, direct; `@vitest/mocker` 5.0.2 | moderate | none at High | `vitest` 5.0.5 | direct |

This matches the register's count: 5 website packages and 3 Studio packages at
High or Critical (refinement plan, measures table: "8 (5 website, 3 Studio)").

### 2.2 Target versions (`npm view`, 1 November 2026)

| Package | Target | Published | Range it must fit |
|---|---|---|---|
| `next` | 16.4.3 (latest stable; 16.5.0 is canary only) | 2026-10-23 | direct, exact pin |
| `sharp` | 0.35.5 (latest) | 2026-09-27 | `next@16.4.3`: `^0.35.5` |
| `source-map-js` | 1.2.2 (latest) | 2026-09-30 | `^1.2.1` everywhere |
| `undici` | 8.12.3 (latest) | 2026-10-19 | `jsdom@30.1.2`: `^8.11.2` |
| `vite` | 8.3.5 (latest 8.3.x) | 2026-10-21 | `vitest@5.0.5` peer `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; Studio `@vitejs/plugin-react` peer `^8.0.0` |
| `vitest` / `@vitest/mocker` | 5.0.5 | 2026-10-15 | direct, exact pin; `vitest@5.0.5` depends on `@vitest/mocker` 5.0.5 |

`next@16.4.3` keeps `postcss` at exactly 8.5.23 and peers on React
`^18.2.0 || ^19.0.0` (website uses 19.3.0) and `@playwright/test ^1.51.1`
(website uses 1.56.1). Engines `node >=20.9.0`. No **direct** dependency
changes major version. One **transitive** package does: `obug` 2.2.1 → 3.0.0,
required by `vitest@5.0.5` (`"obug": "^3.0.0"`), in both apps (found by the
plan-reviewer's lockfile-only simulation, round 1 F-2).

### 2.3 The security gate today

- `.github/workflows/security.yml`, job `npm-audit` (matrix website, studio)
  runs `bash ../.github/security/run-npm-audit.sh <app>`, which runs
  `npm audit --omit=dev --audit-level=high` and feeds the JSON to
  `node ../.github/security/gate.mjs npm <file> <app>`. The gate fails only on a
  High/Critical advisory id not listed under `known-findings.json` →
  `npm.<app>`. **Production tree only**; the full tree is GAP-07 (Wave 1).
- `.github/security/known-findings.json` → `npm.website` lists exactly
  GHSA-cjq9-62q9-8jv4 (`next`), GHSA-wq5f-xc86-pv6w (`sharp`),
  GHSA-68fv-2mgg-jv7q (`source-map-js`); `npm.studio` is `[]`.
- The gate is red on the website today (baseline F1). Run locally against the
  production report above:

  ```
  $ node ../.github/security/gate.mjs npm website-prod.json website   # exit 1
  ::error title=New finding (website)::critical next GHSA-2464-fhr4-w9xw: ...
  ::error title=New finding (website)::high next GHSA-p3m5-59mp-jv5r: ...
  ::error title=New finding (website)::critical next GHSA-673q-mjm6-r5xr: ...
  website: 6 finding(s) at the gate's level; 3 known, 3 new.
  ```
  Studio, production report: exit 0, "studio: 0 finding(s) at the gate's level;
  0 known, 0 new." Studio, full report: exit 1, "0 known, 6 new".
- **Golden copies.** `run-npm-audit.sh` is pinned by
  `run-npm-audit.expected.sh` (identical today: `diff` exit 0), and
  `security.yml` by `security.expected.yml`. `gate.mjs`, `gate.test.mjs` and
  `known-findings.json` have no golden copy. This change touches none of the
  pinned files, so **no golden copy changes**.
- **Gate self-test.** `node --test .github/security/gate.test.mjs` on this
  branch: exit 0, `# tests 62`, `# pass 62`, `# fail 0`.

### 2.4 Removing the website entries breaks two gate self-tests

`gate.test.mjs` reads the real allow-list (line 14:
`const known = JSON.parse(fs.readFileSync(path.join(here, "known-findings.json"), "utf8"));`)
and builds npm fixtures from it:

- line 213, "a known-only npm report passes": runs
  `npmReport(known.npm.website)` and asserts `/3 known, 0 new/`;
- lines 219–231, "a new High advisory fails" / "a new Critical advisory fails":
  spread `known.npm.website` into the report (they still pass with an empty
  list, but then they no longer prove that a known entry beside a new one does
  not hide the new one);
- lines 300–313, `knownAdvisory` (`url` GHSA-cjq9-62q9-8jv4) is the npm
  mutation fixture, labelled `website`; the mutation harness (line 487) asserts
  the unmutated fixture exits 0, which holds only while GHSA-cjq9 is listed.

Simulated on a scratch export of `HEAD` with `npm.website` set to `[]`
(nothing in the repository was changed):

```
$ node --test .github/security/gate.test.mjs
not ok 12 - a known-only npm report passes
    The input did not match the regular expression /3 known, 0 new/.
not ok 21 - npm mutations of every consumed field
# pass 60
# fail 2
```

So the self-test has to stop depending on the real allow-list's npm contents
before the entries can go, without losing any assertion (P-6).

### 2.5 Other places that name the old versions

`git grep` outside the lockfiles: `website/package.json:28` (`"next": "16.3.6"`),
`website/package.json:44` and `studio/package.json:47` (`"vitest": "5.0.2"`),
`studio/package.json:46` (`"vite": "8.3.0"`), and the three
`known-findings.json` entries. `website/test/strip-runtime.test.ts:8` has the
comment "The shape of a page as `next build` exports it (Next 16.3.6), trimmed",
over a fixture of Next's exported runtime markup.

### 2.6 How the website is protected against a changed export

`npm run build` runs `next build`, then `scripts/strip-runtime.ts` (removes
Next's client runtime and stops the build if any trace is left) and
`scripts/check-output.ts` (routes, assets, design set order, no runtime, head
tags, sitemap, JSON-LD). Both fail closed, so a change in Next's export shape
fails the build rather than shipping. Static export with
`output: "export"` and no `next/image` (`website/next.config.ts`).

### 2.7 CI on the base branch right now

PR #38 (`change/ci-runner-pin`) pins `ci.yml` runners to `ubuntu-24.04`
because Playwright 1.56.1 cannot install Chromium on `ubuntu-latest`
(now 26.04). Until it merges, the `ci.yml` jobs `studio`, `section-compare` and
`screenshot-parity` fail at `npx playwright install` on every pull request. This
change does not touch `ci.yml`.

### 2.8 This container (corrected in round 2)

- **Chromium.** `/opt/pw-browsers` holds revision 1243 (Chromium 153).
  Playwright 1.56.1 (`playwright-core/browsers.json`) wants revision **1194**
  (Chromium 141) under `chrome-linux/`, so the default path fails. The prepared
  folder
  `/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/pw-browsers`
  maps the 1194 names to the installed 1243 binaries (it holds `chromium-1194`,
  `chromium_headless_shell-1194`, `ffmpeg-1011`). With
  `PLAYWRIGHT_BROWSERS_PATH` set to it, `chromium.launch()` works (the
  plan-reviewer launched Chromium 153.0.8010.12 this way). The repository
  scripts use `chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })`
  (`website/tools/section-compare/run.mjs:56`, `website/playwright.config.ts:7`),
  so they honour the variable with no repository change. Firefox and WebKit are
  not installed. Never run `playwright install`.
- **Old site.** `/home/user/old-site` is a real clone checked out on
  `feature/interviewer-portal` (`git branch --show-current` →
  `feature/interviewer-portal`, HEAD `eb05f0647c34…`, the same commit
  `git ls-remote` reports). Read-only. `run.mjs:39-40` requires exactly this:
  the old root must be a git checkout whose current branch is
  `feature/interviewer-portal`; a `git archive` export is refused.
- **SQL Server and .NET.** SQL Server 2022 in Docker container `dh-mssql` on
  `localhost:1433`, with the same workflow-only `sa` password as `ci.yml`.
  It is shared: other changes' databases are on it (for example `GAP06_*`),
  and the login `dh_content_app` does not exist yet (checked with
  `sys.server_principals`: no row). `/usr/bin/dotnet` is SDK 10.0.114. Host
  `sqlcmd` is not installed; the wrapper
  `/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/bin/sqlcmd`
  runs `docker exec -i dh-mssql /opt/mssql-tools18/bin/sqlcmd "$@"`. The
  Studio end-to-end harness calls `sqlcmd` only with `-Q` (inline SQL,
  `studio/e2e/start-api.ts:102`), so the wrapper is enough once its folder is
  first on `PATH`.
- **Design check source.** `origin/feature/interviewer-portal` is reachable but
  not fetched in this repository; the design check needs the fetch shown in
  5.2.

### 2.9 What the developer found (round 3)

From `implementation.md` round 1, and checked again here:

- Commits `3e620e1`, `2a4f836`, `115071e`, `dd1628b` carry out 3.1 steps 1
  to 4. Every audit is clean (full tree and production, both apps), the
  website gate went from "0 known, 6 new" (exit 1) to "0 known, 0 new"
  (exit 0), and the gate self-test is 63/63.
- **The noise floor is empty**: two builds of the base have no difference
  (`diff -r out-base-1 out-base-2` exit 0). Base against branch:
  every HTML page differs, nothing else does, and each page is identical once
  one element is removed. That element is the inline script `next` 16.4.3
  puts before `</body>`, for example in `about.html`:
  ```html
  <script id="_R_">(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push({"otherChunks":["static/chunks/2rxg2vmc3djp4.js","static/chunks/3rwt2kk_qwk5n.js","static/chunks/3r-o8o3vf8kuq.js"],"runtimeModuleIds":[56944]});</script>
  ```
  In 16.3.6 the same `id="_R_"` element was an external
  `<script src="/_next/static/chunks/….js" id="_R_" async="">`, which the
  "runtime script tags" removal strips (see the fixture at
  `website/test/strip-runtime.test.ts:20`).
- **Why the guards missed it.** `website/src/build/strip-runtime.ts` removes
  `/_next/` script tags, `/_next/` script preloads, `self.__next_f` scripts and
  empty boundary markers. `runtimeTraces` matches only `/\/_next\//`,
  `/__next_f/` and boundary markers. The new script names its chunks as
  `static/chunks/…`, without `/_next/`, so nothing removes it and nothing
  detects it. `scripts/strip-runtime.ts` and `scripts/check-output.ts:134`
  both use `runtimeTracesIn`, so the build passes and prints that no page
  contains Next's client runtime. This is a fail-closed guard (P-5) with a
  hole.
- **No false positive for the new traces.** In this container,
  `grep -rl -E "TURBOPACK|static/chunks/"` finds 0 files in the whole base
  `out-base-1` (all files, not only HTML), and 0 matches in `website/design/`.
  On the branch `out/`, `grep -rl TURBOPACK --include=*.html` finds 28 files.
- **Corrections the developer recorded** (accepted, see 12):
  - The Studio lockfile was regenerated with **npm 11.19.1**. npm 10.9.9
    dropped the `libc` field from 12 platform entries that the base lockfile
    carries (18 `libc` fields), so the lockfile was last written by a newer
    npm. With npm 11 the committed diff contains version changes only, and
    both npm 10 and npm 11 accept it with `npm ci`. This is still a lockfile
    regenerated by npm (B-7). The website lockfile has no `libc` fields and
    was regenerated with npm 10.9.9.
  - The Studio build needs `VITE_PUBLIC_SITE_URL` (`ci.yml` sets
    `https://website.ci.invalid`); without it, base and branch both fail with
    "VITE_PUBLIC_SITE_URL is not set".
  - `@types/estree` 1.0.9 → 1.0.10 comes through `vitest` (`@vitest/mocker` →
    `estree-walker@3.0.3`, `^1.0.0`), not through `vite` as round 2 said.
  - Website vitest: branch 409 passed and 1 skipped, base 408 passed and 2
    skipped, 410 in both. The extra base skip is `test/design.test.ts:76`
    (`it.skipIf(!hasSource)`), which needs a git checkout; the base was a
    `git archive` export. Environment, not the change.
  - The round 2 command `git fetch --no-tags --depth=1 … feature/interviewer-portal`
    made the shared `.git` shallow for every worktree (the coordinator has
    since undone it). `origin/feature/interviewer-portal` is already fetched in
    full here (`ENVIRONMENT.md`), so the line is removed from 5.2.

## 3. Design

### 3.1 Approach

One pull request. Steps 1 to 4 are already committed (2.9); round 3 adds
steps 5 and 6 on top of `362a5e9`. In order:

1. **Gate self-test: stop depending on the real npm allow-list.**
   `gate.test.mjs` gets a second gate instance that reads a fixture allow-list:
   at test start, copy `gate.mjs` and `fail-on-rules.json` byte for byte into a
   new folder under the test's temp `dir`, and write beside them a
   `known-findings.json` that is a deep copy of the real one with only
   `npm.website` replaced by three synthetic entries (ids such as
   `GHSA-fixture-known-0001` … `0003`, one critical and two high, with
   `package`, `severity`, `title`, `owner`, `reason`). `gate.mjs` already reads
   its allow-list from its own folder (`path.join(here, "known-findings.json")`),
   so no change to `gate.mjs` is needed. Then:
   - "a known-only npm report passes" runs the fixture gate on
     `npmReport(fixtureKnown.npm.website)` and keeps `/3 known, 0 new/`.
   - "a new High advisory fails" and "a new Critical advisory fails" run the
     fixture gate on the fixture known entries plus the new one; same
     assertions as today, and each also asserts the line
     `3 known, 1 new`, so a known entry is shown not to hide a new one.
   - `knownAdvisory.url` becomes the first fixture id, and the npm mutation runs
     (baseline and every mutation, including the `acceptedValues` npm `url`
     sample) use the fixture gate. Dotnet, gitleaks and semgrep mutations keep
     using the real gate and the real allow-list.
   - One new test: "the fixture gate is the real gate": the copied `gate.mjs`
     and `fail-on-rules.json` are byte-identical to the originals. This stops
     the fixture copy from drifting into a different gate.
   This commit changes no gate behaviour and must pass against the **current**
   `known-findings.json` (63 tests, 0 failures) before the entries are removed.
2. **Stop allowing the website's three advisories** (the red step, B-6).
   Remove the three objects from `known-findings.json` → `npm.website`, leaving
   `"website": []`. Nothing else in the file changes. After this commit the gate
   self-test still passes (63/63), and the website audit gate fails on all six
   production findings: `run-npm-audit.sh website` exits 1 with
   "0 known, 6 new". That is the failing test the upgrade turns green.
3. **Website upgrade.** In `website/`, with npm (B-7), never editing the
   lockfile by hand and never `--force`:
   ```
   npm install --save-exact next@16.4.3
   npm install --save-exact --save-dev vitest@5.0.5
   npm update sharp source-map-js undici vite
   ```
   `package.json`: `next` 16.3.6 → 16.4.3, `vitest` 5.0.2 → 5.0.5 (both stay
   exact pins, as today). Lockfile expected afterwards: `next` and `@next/env`
   and the `@next/swc-*` optionals 16.4.3, `sharp` 0.35.5 (with its `@img/*`
   optionals), `source-map-js` 1.2.2, `undici` 8.12.3, `vite` 8.3.5,
   `vitest` and every `@vitest/*` 5.0.5. If `npm update` leaves any of these
   below its fixed version, the developer runs `npm audit fix` (no `--force`)
   once and records the output; if that still leaves one, stop and return to
   the architect (do not add overrides).

   **Expected transitive changes** (from the plan-reviewer's lockfile-only
   run of these exact commands, round 1 F-2), each traced to its parent:
   - from `vitest@5.0.5`: `obug` 2.2.1 → **3.0.0** (major; `^3.0.0`),
     `why-is-node-running` 3.2.2 → **3.2.1** (down; pinned exactly),
     `@vitest/spy` and the other `@vitest/*` 5.0.5, `chai` 6.3.0,
     `magic-string`, `std-env`, `tinybench`;
   - from `vite@8.3.5`: `rolldown` and `@rolldown/binding-*` 1.2.16,
     `@oxc-project/types` 0.156.0, `vite/node_modules/postcss` 8.5.28 →
     8.5.32, `nanoid`;
   - from `vitest@5.0.5` through `@vitest/mocker` → `estree-walker`:
     `@types/estree` 1.0.10 (corrected in round 3);
   - from `next@16.4.3`: `@next/env`, `@next/swc-*`, `sharp` and `@img/*`.

   **Rule for anything else:** a changed, added or removed lockfile entry is
   expected when it is a dependency of `next@16.4.3`, `vitest@5.0.5`,
   `vite@8.3.5`, `undici`, `source-map-js` or `sharp` and its new version
   satisfies the range that parent declares (`npm view <parent>@<version>
   dependencies`). The developer shows that trace for each entry not in the
   list above. An entry that cannot be traced this way returns the change to
   the architect.
4. **Studio update.** In `studio/`:
   ```
   npm install --save-exact --save-dev vite@8.3.5 vitest@5.0.5
   npm update undici source-map-js
   ```
   `package.json`: `vite` 8.3.0 → 8.3.5, `vitest` 5.0.2 → 5.0.5. Lockfile
   expected: `vite` 8.3.5, `vitest`/`@vitest/*` 5.0.5, `undici` 8.12.3,
   `source-map-js` 1.2.2. Expected transitive changes, as in step 3: `obug`
   2.2.1 → 3.0.0, `why-is-node-running` 3.2.3 → 3.2.1, the `vitest` and
   `vite` families listed there, **`postcss` 8.5.28 → 8.5.32** (the Studio's
   top-level `postcss`, which Tailwind uses for the CSS build; it moves
   through `vite@8.3.5`'s `^8.5.28` range), and six new nested entries under
   `@tailwindcss/oxide-wasm32-wasi/node_modules/` (`@emnapi/*`,
   `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, `tslib`). Same fallback rule
   and same trace rule as step 3.

   The Studio lockfile is regenerated with npm 11.19.1 (2.9): npm 10.9.9
   would drop the `libc` fields the base lockfile has. `npm ci` must pass with
   both npm 10.9.9 (Node 22, as in CI) and npm 11.
5. **Red test: the strip and the trace check must handle Next 16.4.3's
   Turbopack bootstrap** (B-6, P-4). Only `website/test/strip-runtime.test.ts`
   changes. Keep the existing 16.3.6 fixture and every existing test. Add:
   - a second fixture, `exported1643`: one real page from the branch's
     16.4.3 build (for example `about.html` before stripping, taken from
     `.next`'s export or by building with the strip step skipped), trimmed the
     same way as the 16.3.6 fixture and labelled "(Next 16.4.3)". It must
     contain the inline `<script id="_R_">(globalThis["TURBOPACK"] …` element
     verbatim;
   - test "removes Next 16.4.3's inline Turbopack bootstrap":
     `stripRuntime(exported1643)` leaves no `_R_` element and no `TURBOPACK`
     text, counts 1 under the new removal's name, equals the expected stripped
     HTML written out in full (as the 16.3.6 test does), and
     `runtimeTracesIn` of the result is `[]`;
   - test "the trace check catches the Turbopack bootstrap if it is left in":
     `runtimeTracesIn` of the bare 16.4.3 `_R_` script returns the new trace
     name(s); and, in the existing "does not remove what it does not
     recognise" test, add an unrecognised variant, for example
     `<script>globalThis.TURBOPACK=[]</script>`, which must be left in place
     by `stripRuntime` and reported by `runtimeTracesIn`;
   - in "stripping the output folder", one case with an `exported1643` page:
     `stripOutput` returns `problems: []`, and a page holding the
     unrecognised variant gives a problem naming that page.

   The existing test "removes each part of the runtime, and nothing else"
   compares the whole `removed` map with `toEqual`; it gains the new key with
   count 0 for the 16.3.6 page. That is the only edit to an existing
   assertion, and it adds a key; nothing is loosened.

   Before the fix this commit is **red**: `npx vitest run
   test/strip-runtime.test.ts` fails on the new tests (quote the failures),
   and every other test still passes.
6. **Fix: remove the bootstrap and detect any Turbopack trace.** Only
   `website/src/build/strip-runtime.ts` changes:
   - a new entry in `removals`, after "runtime script tags", for example
     name "Turbopack bootstrap script", why: "Next 16.4's inline `_R_`
     script: it registers the runtime's chunks with Turbopack so they can
     hydrate the page. Those chunks are deleted with `/_next/`, and the site
     does not hydrate.", pattern matching exactly an inline script whose
     body starts with the Turbopack bootstrap:
     `/<script id="_R_">\(globalThis\["TURBOPACK"\][\s\S]*?<\/script>/g`.
     It is narrow on purpose: anything else stays in the page for the trace
     check to catch;
   - two new entries in `runtimeTraces`: `{ name: "the Turbopack runtime",
     pattern: /TURBOPACK/ }` and `{ name: "a Next chunk path", pattern:
     /static\/chunks\// }`. These close the hole whatever shape the next
     release uses. 2.9 shows neither string occurs in the base output or in
     `website/design/`, so they reject nothing the site ships today.

   `scripts/strip-runtime.ts` and `scripts/check-output.ts` need no change;
   both already call `runtimeTracesIn`. After this commit the step 5 tests
   pass, and the build strips the script from every page.

Commits 3, 4 and 6 are each followed by `npm ci` from the lockfile (B-7)
where a lockfile changed, and the checks in section 5.

Commit subjects (B-4, task id prefix, body says why, attribution trailer):
`GAP-01: make the gate self-test independent of the real npm allow-list`,
`GAP-01: stop allowing the website's next, sharp and source-map-js advisories`,
`GAP-01: upgrade the website to next 16.4.3 and refresh its vulnerable packages`,
`GAP-01: update vite, vitest, undici and source-map-js in the Studio`,
`GAP-01: test that the build strips Next 16.4.3's Turbopack bootstrap` (red),
`GAP-01: strip the Turbopack bootstrap and detect any Turbopack trace`.

The pull request carries the `screenshots` label so the `screenshot-parity`
job runs.

### 3.2 Alternatives rejected

- **`npm audit fix --force`.** It is what npm suggests for `next` and `vitest`,
  but it may jump ranges and rewrite unrelated nodes. Explicit versions keep
  the lockfile diff reviewable.
- **`overrides` in `package.json` for `source-map-js` / `undici` / `sharp`.**
  Not needed: every fixed version is inside the ranges its parents already
  declare. An override would outlive the advisory and hide future resolution.
- **A `KNOWN_FINDINGS` environment variable (or argument) in `gate.mjs` so the
  tests can point at a fixture.** It would change the gate in a dependency
  pull request (B-8), and give CI a second way to choose the allow-list. Copying
  the real gate into the test's temp folder gets the same isolation with no
  production change.
- **Rewrite the self-tests to use only "new" advisories.** That would drop the
  proof that a known entry is warned and passed, and that it does not hide a
  new one: a weaker test (P-6).
- **Keep the website entries and let the gate print "Known but no longer
  found".** The Done-when requires their removal, and the standard says a fixed
  violation leaves the baseline in the same pull request (section 6).
- **Switch `run-npm-audit.sh` to the full tree now.** That is GAP-07 (Wave 1):
  it changes a golden-pinned script and adds expiries, a separate gate change
  (B-8). This change proves the full tree is clean by running the full-tree
  audit directly (section 5).
- **Two pull requests (website, Studio).** The register item and its Done-when
  are one unit covering both apps, and the Studio change is three dev
  packages. One pull request keeps the 3 November deadline. O-1's "in its own
  pull request" is met: `next` is not bundled with any unrelated change.
- **Stay on `next` 16.3.x or pin to 16.4.0/16.4.1 to avoid the new script.**
  Only 16.4.3 is outside every advisory range we must clear
  (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr and GHSA-p3m5-59mp-jv5r affect
  `<=16.4.0`); other 16.4.x releases were not checked for the script and are
  not what O-1 recommends.
- **A Next config option to suppress the bootstrap.** None is known for
  static export, and a config change would alter the build for every page
  in ways the strip does not test. The strip exists for this job.
- **Only add the trace, and fail the build until a later change adds the
  removal.** It would leave the website unbuildable in Wave 0.
- **A broad removal (any inline script mentioning `TURBOPACK`).** Removing
  more than the known shape could take something unexpected out silently. A
  narrow removal plus broad traces fails closed instead.
- **Also bump `fast-uri` (website, moderate, dev, via `ajv`).** Not in the
  item, below the Done-when's level; left for the grouped Dependabot patch
  updates (GAP-02) or GAP-07. See section 4, out of scope.

## 4. Scope

### Files to change

| File | Change |
|---|---|
| `.github/security/gate.test.mjs` | Fixture gate copy and fixture allow-list for the npm known-list tests and the npm mutation fixture; `3 known, 1 new` assertions; new byte-identity test (commit 1). No test removed, no assertion loosened. |
| `.github/security/known-findings.json` | Remove the three `npm.website` entries; `"website": []` (commit 2). |
| `website/package.json` | `next` 16.3.6 → 16.4.3; `vitest` 5.0.2 → 5.0.5. |
| `website/package-lock.json` | Regenerated by npm (commit 3). |
| `studio/package.json` | `vite` 8.3.0 → 8.3.5; `vitest` 5.0.2 → 5.0.5. |
| `studio/package-lock.json` | Regenerated by npm 11.19.1 (commit 4; 2.9). |
| `website/test/strip-runtime.test.ts` | Round 3, commit 5 (red): a Next 16.4.3 fixture and tests for the Turbopack bootstrap removal and traces; the new `removed` key in the existing `toEqual`. Existing 16.3.6 fixture and tests kept. |
| `website/src/build/strip-runtime.ts` | Round 3, commit 6: one new removal ("Turbopack bootstrap script") and two new traces (`TURBOPACK`, `static/chunks/`). |
| `docs/changes/GAP-01/*.md` | Pipeline records (this plan, and the later reviews, implementation and test report). |

### Out of scope (left alone on purpose)

- `.github/security/run-npm-audit.sh`, its `.expected.sh` copy, `gate.mjs`,
  `security.yml`, `security.expected.yml`: the full-tree gate and expiries are
  GAP-07.
- `.github/workflows/ci.yml`: PR #38 (`change/ci-runner-pin`) owns its runner
  lines; nothing else in it needs to change.
- The `gitleaks` and `semgrep` entries in `known-findings.json` and their D-NNN
  status (GAP-07 / standard step 4f; see section 9, Q-1).
- `fast-uri` (moderate) in the website; any other package not listed above.
- The locked design: `website/design/`, `packages/blocks`, the ported
  scripts and stylesheets, and every other file under `website/src` except
  `src/build/strip-runtime.ts`. `scripts/strip-runtime.ts` and
  `scripts/check-output.ts` are not edited (they already use the shared
  functions).
- Any other difference the 16.4.3 export might show after the fix: there must
  be none (5.2). A difference that is not the `_R_` script stops the change
  again.
- `@playwright/test` / `playwright` versions (1.56.1) and the Chromium
  mismatch in this container.
- The API (`api/`), `packages/`, and NuGet.
- The section comparison's `continue-on-error` and the careers apply
  difference (GAP-05, O-11).

## 5. Test plan

### 5.1 Failing test first

1. **Before anything changes**, the developer captures the starting evidence
   on `6470fac` (commands quoted with exit codes):
   `npm audit --audit-level=high` in `website/` (exit 1) and `studio/` (exit 1);
   `node --test .github/security/gate.test.mjs` (62 pass).
2. **Commit 1** (self-test refactor) — must be **green** with the current
   allow-list: `node --test .github/security/gate.test.mjs` → 63 tests,
   0 fail. Proof that no assertion was dropped: the developer lists, in
   `implementation.md`, each changed test with its before and after
   assertions.
3. **Commit 2** — the red test. With the entries removed and the old
   dependencies still in place:
   ```
   cd website
   export RUNNER_TEMP=<scratch dir>
   bash ../.github/security/run-npm-audit.sh website     # expect exit 1
   ```
   Expected last line: `website: 6 finding(s) at the gate's level; 0 known, 6 new.`
   And `node --test .github/security/gate.test.mjs` still 63/63 (the refactor
   holds without the real entries). Committed before the fix (B-6).
4. **Commits 3 and 4** turn it green: the same command exits 0 with
   `website: 0 finding(s) at the gate's level; 0 known, 0 new.` and no
   "Known but no longer found" text.

### 5.2 Checks after the upgrade (runnable in this container)

Website (`cd website`):

```
npm ci
npm audit --audit-level=high                         # exit 0
npm audit --json                                     # metadata.vulnerabilities: high 0, critical 0
npm audit --omit=dev --audit-level=high              # exit 0
RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh website   # exit 0, "0 known, 0 new"
node -e '<print lockfile versions of next, @next/env, sharp, source-map-js, undici, vite, vitest, @vitest/mocker>'
npm run typecheck
npx vitest run                                       # same test count as on 6470fac, 0 failed
git rev-parse --is-shallow-repository               # must print false; never run git fetch --depth here
npm run design:check                                 # exit 0, uses the already fetched origin/feature/interviewer-portal
npx vitest run test/strip-runtime.test.ts            # commit 5: new tests fail; commit 6: all pass
CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build   # exit 0
```

**Built-output comparison** (catches a changed static export directly, R-1).
In a scratch export of `6470fac` (`git archive 6470fac | tar -x -C
<scratch>/base`, then `npm ci` in its `website/`):
1. **Noise floor first.** Build the base twice with the same two environment
   variables, copying `out/` aside after each (`out-base-1`, `out-base-2`),
   and run `diff -r out-base-1 out-base-2`. Record every file that differs;
   that is the noise floor (for example a build id or a hashed name).
2. Build the branch with the same variables and run
   `diff -r out-base-1 <branch>/website/out`.
3. Only differences **beyond the noise floor** (a file not in the floor, or a
   difference of another kind in a floor file) need a per-file explanation in
   `implementation.md`. Any such change to a page's HTML structure, head
   tags, design set or JSON-LD stops the change and returns it to the
   architect.
4. **Round 3 pass condition, after commit 6.** The round 1 floor was empty,
   so the requirement is **zero difference**: `diff -r out-base-1
   <branch>/website/out` exits 0 (every file, not only HTML), and
   `grep -rl -E "TURBOPACK|static/chunks/" <branch>/website/out` finds
   nothing. The strip's printed counts on the branch equal the base's, plus
   one "Turbopack bootstrap script" removal per page. If the floor is
   re-measured and is no longer empty, any difference must be in the floor.
   Any other result stops the change.

The base `out-base-1` is also the "base" input for the section comparison
in 5.3.

Studio (`cd studio`):

```
npm ci
npm audit --audit-level=high                         # exit 0
npm audit --json                                     # high 0, critical 0
npm audit --omit=dev --audit-level=high              # exit 0
RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh studio    # exit 0, "0 known, 0 new"
npx tsc -b
npm test                                             # same test count as on 6470fac, 0 failed
VITE_PUBLIC_SITE_URL=https://website.ci.invalid npm run build   # as ci.yml; includes check-preview-design
```

Repository root:

```
node --test .github/security/gate.test.mjs           # 63 pass, 0 fail
diff .github/security/run-npm-audit.sh .github/security/run-npm-audit.expected.sh   # exit 0 (unchanged)
git diff --stat 6470fac -- .github/workflows .github/security/*.expected* .github/security/run-*.sh   # empty
```

Lockfile review (B-7): `git diff 6470fac -- website/package-lock.json
studio/package-lock.json` is summarised in `implementation.md` as the list of
packages added, removed or changed. Each is either in the expected lists in
3.1 steps 3 and 4, or traced by the rule given there. An untraceable change
returns the change to the architect.

### 5.3 Browser and database checks, run here (rewritten in round 2)

Common setup for every command in this section (a Claude Code session uses
ports 42xx; stop only what you start):

```
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/pw-browsers
export PATH=/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/bin:$PATH
```

The browser here is **Chromium 153 (revision 1243) standing in for the pinned
Chromium 141 (1194)**. A local result is valid evidence where old and new are
measured in the same browser (section and screenshot comparison, base vs
branch). The CI jobs remain the record for the pinned browser, and must also
be green (5.4).

**1. Section comparison, base and branch** (`cd website` in each tree):

```
SECTION_COMPARE_OLD=/home/user/old-site \
SECTION_COMPARE_NEW=<scratch>/base/website/out-base-1 \
SECTION_COMPARE_PORT=4290 SECTION_COMPARE_OUT=<scratch>/section-base \
npm run compare:sections                    # run from the base tree's website/

SECTION_COMPARE_OLD=/home/user/old-site \
SECTION_COMPARE_NEW=/home/user/DH-WEBSITE/website/out \
SECTION_COMPARE_PORT=4290 SECTION_COMPARE_OUT=<scratch>/section-branch \
npm run compare:sections                    # run from the branch's website/
```

`/home/user/old-site` is only read, never changed. Pass: the branch's
`report.md` shows no difference that the base's `report.md` does not show
(today that is expected to be only the unaccepted careers apply difference,
GAP-05/O-11). Exit codes and the difference lists of both reports go in the
evidence. A new difference stops the change (R-1).

**2. Website browser suite** (no CI job until GAP-04, so this local run is
the only coverage). On the branch, in `website/`:

```
CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build
WEBSITE_TEST_PORT=4291 npm run test:browser          # pages.spec.ts; consent.spec.ts reports skipped
SNAPSHOT_SETTINGS_FIXTURE=consent CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build
WEBSITE_TEST_PORT=4291 npm run test:browser          # consent.spec.ts runs on this build
CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build   # restore the default out/
```

Run the same two passes on the base tree first, so the counts can be
compared. Pass: 0 failed on the branch, and passed/skipped counts equal to the
base's (the refinement plan counts 29 tests across both builds).

**3. Screenshot checks, Chromium only** (`cd website` on the branch):

```
npx vitest run test/screenshot-parity-browser.test.ts --reporter=default --reporter=json --outputFile.json=<scratch>/screenshot-browser.json
node tools/check-browser-test-report.mjs <scratch>/screenshot-browser.json 30
SCREENSHOT_OLD_ROOT=/home/user/old-site SCREENSHOT_NEW_ROOT=$PWD/out \
SCREENSHOT_BROWSERS=chromium SCREENSHOT_PORT=4292 SCREENSHOT_CANDIDATE_PORT=4293 \
SCREENSHOT_OUT=<scratch>/screenshots-branch npm run compare:screenshots
```

and the same comparison from the base tree with
`SCREENSHOT_NEW_ROOT=<scratch>/base/website/out-base-1` and
`SCREENSHOT_OUT=<scratch>/screenshots-base`. The regression tests must pass
(as in CI, where that step blocks). The two comparison reports are reviewed by
hand, page by page: each branch difference is listed in `test-report.md` and
marked "same as base" or "new". Firefox and WebKit are NOT RUN here (not
installed); they are covered by `ci.yml` `screenshot-parity`.

**4. Studio end-to-end suite** (`cd studio` on the branch, after `npm ci`).
The harness (`studio/e2e/env.ts`) derives `DigitalHubContent_E2e` from the
connection strings, and drops, recreates, migrates and grants it itself; it
refuses any other catalog. Before starting:
- check that no other session is using that database:
  `sqlcmd -S localhost -U sa -P CiOnlySa2026Passw0rd -C -Q "SELECT session_id FROM sys.dm_exec_sessions WHERE database_id = DB_ID('DigitalHubContent_E2e')"`.
  If any row comes back, another change is using it: wait and ask the
  coordinator; do not run (only one agent at a time resets a local database,
  `AGENTS.md`). No other database on the shared server is touched;
- create the restricted login only if it is missing, exactly as the CI step
  does (workflow-only password from `ci.yml`):
  `sqlcmd -S localhost -U sa -P CiOnlySa2026Passw0rd -C -b -Q "IF SUSER_ID(N'dh_content_app') IS NULL CREATE LOGIN [dh_content_app] WITH PASSWORD = N'CiOnlyApp2026Passw0rd', CHECK_POLICY = OFF;"`.

Then, with the `ci.yml` `studio` job's environment and 42xx ports:

```
ConnectionStrings__Content='Server=localhost,1433;Database=DigitalHubContent;User ID=dh_content_app;Password=CiOnlyApp2026Passw0rd;Encrypt=True;TrustServerCertificate=True' \
ConnectionStrings__ContentAdmin='Server=localhost,1433;Database=DigitalHubContent;User ID=sa;Password=CiOnlySa2026Passw0rd;Encrypt=True;TrustServerCertificate=True' \
Auth__SigningKey=ci-only-signing-key-not-a-secret-0123456789abcdef \
DH_E2E_API_PORT=4294 DH_E2E_STUDIO_PORT=4295 PLAYWRIGHT_HTML_OPEN=never \
npx playwright test --reporter=list
```

(`Database=DigitalHubContent` in these strings is what the harness requires
as input; it rewrites them to `DigitalHubContent_E2e` and refuses to run
against `DigitalHubContent`.) The webServer starts `npx vite`, so the `vite`
bump is on this path. Pass: 22 of 22, 0 failed. If it cannot run, write NOT RUN
with the specific blocker and the error line (for example "the
`DigitalHubContent_E2e` database is in use by another session"), and rely on
`ci.yml` `studio`.

**5. Not run here, with reason:**

| Check | Reason | Covered by |
|---|---|---|
| API build and integration tests | No change in `api/`; this change is npm-only. | `ci.yml` `api` |
| Screenshot comparison in Firefox and WebKit | Not installed; never run `playwright install`. | `ci.yml` `screenshot-parity` (label `screenshots`) |
| Security workflow jobs other than npm | Nothing they read changes; the npm part and the gate self-test are reproduced in 5.2. | `security.yml` `gate-self-test`, `npm-audit` (website, studio), `dotnet-vulnerable`, `gitleaks-pr`, `gitleaks-history`, `semgrep`; `codeql.yml` `analyze` |

### 5.4 CI evidence on the pull request

- The pull request is rebased on `rebuild/dotnet-platform` **after PR #38
  merges** (B-3), so `studio`, `section-compare` and `screenshot-parity` can
  install Chromium. Until then those three jobs fail for a reason unrelated to
  this change, and their results do not count as evidence either way. The
  local runs in 5.3 give the evidence meanwhile; they do not replace the CI
  jobs, which must be green on the final head before delivery.
- Green: `ci.yml` `api`, `website`, `studio`; `security.yml` all jobs (the
  website `npm-audit` job turns green for the first time since F1).
- `section-compare`: the step is `continue-on-error`, so "green" is judged on
  its report (artifact `section-compare`, also in the job summary): it must
  show **no difference that the base branch's latest `section-compare` report
  does not already show** (today that is the one unaccepted careers apply
  difference, GAP-05/O-11). Any new difference fails this criterion.
- `screenshot-parity`: the "Chromium regression tests" step passes, and the
  report (artifact `screenshot-parity`) is reviewed by hand by the tester, page
  by page, against the base branch's report if one exists; each difference is
  listed in `test-report.md` and judged "same as base" or "new". A new
  difference stops the change for the owner (R-1).

### 5.5 Track checklist (G1, Wave 0), from `docs/changes/README.md`

- [ ] `npm audit --audit-level=high` on the full tree, production and
  development, reports 0 in the website and the Studio.
- [ ] Fixed entries are removed from `.github/security/known-findings.json`.
- [ ] Each remaining advisory cites a D-NNN entry in `docs/deferred-items.md`
  with the owner's quote and an expiry (expected: none remains, so no entry).
- [ ] Tests, design check, build and section comparison are green, and the
  screenshot report is reviewed by hand.
- [ ] Lockfiles are regenerated by npm, never hand-edited (B-7).
- [ ] A `github-actions` bump updates its golden copy in `.github/security/`
  (N/A: no action is bumped; golden copies unchanged, checked above).

### 5.6 Pull request body (B-9)

The pull request body uses `.github/pull_request_template.md` (from
`origin/claude/cool-heisenberg-mh6zx9`; it is not on the base branch yet, so
the developer copies its headings). Mapping:

| Template section | Source in this plan |
|---|---|
| What and why | Section 1 (GAP-01, F1, F3, F4; the Done-when quoted) |
| Scope and boundaries | Section 4, including out of scope |
| Security impact | Section 6 |
| Tests and evidence | Sections 5.1 to 5.4, each check with command, exit code and output lines, CI run ids; every NOT RUN with reason and CI job |
| Owner decisions | Section 9, with the owner's words quoted exactly: "Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry, 2026-11-01, project thread). O-1 stated as not answered in words. |
| Definition of Done | See below |
| Review findings accepted | Any plan-review, test-report or delivery finding not fixed, with the reason |
| Governance | See below |

Boxes are ticked only when true. Expected state:
- Box 1 (requirement and criteria met), 2, 3, 6 (checks green on the final
  head, run ids quoted), 9 (rollback: section 8): tickable once true.
- Box 4 (route guards): N/A, no route changes; written as N/A, not ticked.
- **Box 5 cannot be ticked in full**: there is no changed-line coverage gate
  yet (GAP-18). The body says so; the "regression test for a security fix"
  half is met by the red gate step (5.1).
- Box 7 (independent code review): the pipeline's `tester` and `tech-lead`
  gate 2 are recorded; whether that counts as the independent review is for
  the tech-lead to state in `delivery-approval.md`. Ticked only if it does.
- Box 8 (reviewed by someone other than the author): the pipeline's reviewer
  roles and records, with the AI governance rules followed.
- Box 10 (deployment note): no deploy until Phase D; the body names the
  integrator who merges into `rebuild/dotnet-platform` and confirms the suites
  are re-run after the merge. The integrator is not named in any document this
  plan read, so the body leaves it for the owner to name; it is not ticked
  until then.
- Governance: "`docs/deferred-items.md` updated for any exception" is N/A (no
  exception). "`AGENTS.md` coverage table or phase document updated" and
  "Documentation updated": the change's coverage table is
  `docs/changes/GAP-01/` (section 11); no other documentation changes.

## 6. Security impact

- **Dependencies:** this is the change. It removes 2 Critical and 4 High
  advisory ids in production packages (`next`, `sharp`, `source-map-js`), the
  development Highs (`vite` GHSA-587h-7wmj-h5pm and four `undici` ids in both
  apps, `source-map-js` in the Studio), and the `vitest` moderates. All upgrades are patch or minor within the same
  major. Production impact is limited because the site is a static export
  (no Next server, no Image Optimization in production), but the build machine
  runs all of these packages.
- **Gate:** the allow-list shrinks by three entries; `gate.mjs` and every
  golden-pinned file are unchanged; the self-test gains one test and loses
  none. After this change the website and Studio npm allow-lists are empty, so
  any new High/Critical fails at once.
- **Routes, policies, data, logins, secrets:** none. No API, database, Studio
  source or website source change.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. That restores the old versions and the three
allow-list entries together, which returns the website `npm-audit` job to its
current red state (F1). Reverting only commit 3 or 4 without commit 2 would
leave the gate red; revert the whole pull request.

## 9. Owner decisions needed

- **O-1** ("Fix or accept the Critical `next` advisories (baseline F1)").
  The owner has not answered O-1's question in words. The owner's instruction
  is "Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry,
  2026-11-01, project thread); this plan carries out Wave 0's first item,
  which is O-1's recommended "Fix now" path. Fixing needs no exception and is
  intended to change no behaviour, so this plan does **not** record O-1 as
  decided and does not need it decided to proceed. If gate 1 judges that O-1
  must be answered in the owner's own words first, the verdict is
  BLOCKED ON OWNER on O-1, with the question exactly as written in the
  standard.
- **No exception is planned.** If any High/Critical advisory survives the
  upgrade, or the upgrade changes the built site, the change stops; the owner
  decides between a fix and a D-NNN exception (refinement plan, companion
  item), and that exception cannot be written until `docs/deferred-items.md`
  exists on the base branch.
- **Q-1, for the plan-reviewer and tech-lead (owner only if they read the
  rule strictly).** Standard section 6 says: "From the next change to it, each
  entry cites a `D-NNN` id in `docs/deferred-items.md` and carries an expiry.
  Status: Gap (step 4f)." This change edits `known-findings.json` only by
  removing entries; it adds and keeps no npm entry, and leaves the 2 `gitleaks`
  and 7 `semgrep` entries untouched. This plan reads the sentence as applying
  to entries a change adds or keeps in the area it edits, with the rest
  scheduled as step 4f / GAP-07, which the standard itself marks "Gap". If the
  reviewers read it as requiring D-NNN entries for all nine remaining entries
  before any edit, that is an owner decision; the question would be: "Before
  GAP-01 removes the three fixed website entries from known-findings.json, do
  the 2 gitleaks and 7 semgrep entries need D-NNN entries with expiries, or
  does that wait for GAP-07?"

## 10. Risks

| Id | Risk | How it is caught |
|---|---|---|
| R-1 | `next` 16.4.3 changes the static export. **Happened** (2.9): the inline `_R_` Turbopack bootstrap. | Steps 5 and 6 (red test, then the removal and two fail-closed traces); zero `diff -r` against base (5.2 step 4); `design:check`; section comparison and screenshots against base (5.3, CI). Any other difference stops the change again. |
| R-10 | The new traces reject something legitimate in a later build (a design file or content containing `TURBOPACK` or `static/chunks/`) | 2.9: neither string is in the base output or `website/design/`; a false positive fails the build loudly (fail closed), never ships silently. |
| R-11 | The new removal takes out more than the bootstrap | The pattern is anchored on `<script id="_R_">(globalThis["TURBOPACK"]` and stops at the first `</script>`; the full expected-HTML assertion in step 5 and the zero `diff -r` prove nothing else is removed. |
| R-2 | `vite`/`vitest` updates (and their transitive moves: `obug` 3.0.0, Studio `postcss` 8.5.32, `rolldown` 1.2.16) break the Studio build, its CSS, or either test suite | `npx tsc -b`, `npm test`, `npm run build` in the Studio (its `check-preview-design` step covers the CSS build that `postcss` feeds); `npx vitest run` in the website, with test counts compared to `6470fac`; the local Studio end-to-end run (5.3.4) and CI `studio`. |
| R-3 | An advisory survives (npm resolves an older version, or a new advisory appears before merge) | Full-tree `npm audit --json` in both apps, rerun by the tester on the final head; the website `npm-audit` gate. A survivor stops the change for the owner; no D-NNN can be written until `docs/deferred-items.md` is on the base branch. |
| R-4 | The self-test refactor weakens a test | Commit 1 must pass on the current allow-list; `implementation.md` lists each changed assertion before and after; the byte-identity test keeps the fixture gate equal to `gate.mjs`; the plan-reviewer and tester compare test counts (62 → 63). |
| R-5 | Lockfile drift: unrelated packages move, or the lockfile is not what `npm ci` accepts | `npm ci` in both apps; the lockfile change list in `implementation.md`; CI runs `npm ci`. |
| R-6 | CI evidence blocked by the runner problem, not by this change | Local runs in 5.3 give the evidence meanwhile; rebase after PR #38 merges (5.4) and require the CI jobs green on the final head. |
| R-8 | The shared SQL Server: the end-to-end harness drops and recreates `DigitalHubContent_E2e` while another change uses it | The session check before the run (5.3.4); only that database is touched; if busy, wait and ask the coordinator. |
| R-9 | Local Chromium 153 differs from the pinned 141 | Local comparisons are always base vs branch in the same browser; CI with the pinned browser stays the record. |
| R-7 | The 3 November deadline | Small, patch-level change; if it slips, the owner decides on an exception (refinement plan risk table). |

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| Full-tree `npm audit --audit-level=high` reports 0 in the website | Refinement plan, Wave 0, GAP-01 Done-when; README G1 Wave 0 | Planned | |
| Full-tree `npm audit --audit-level=high` reports 0 in the Studio | Same | Planned | |
| Production-tree audit 0 in both apps; `run-npm-audit.sh` exits 0 for both with "0 known, 0 new" | README G1 Wave 0 ("production and development"); `security.yml` `npm-audit` | Planned | |
| Website entries removed from `known-findings.json` | GAP-01 Done-when; standard section 6 | Planned | |
| Red test committed before the fix (gate fails on the website with the entries removed) | B-6, P-4 | Planned | |
| Gate self-test passes with no assertion weakened | P-6; `security.yml` `gate-self-test` | Planned | |
| Each remaining advisory cites a D-NNN with an expiry (none expected) | README G1 Wave 0; refinement plan companion item; S-7 | Planned | |
| Website tests green | GAP-01 Done-when; `ci.yml` `website` | Planned | |
| Studio unit tests green | GAP-01 Done-when; `ci.yml` `studio` | Planned | |
| Studio end-to-end 22/22, here (5.3.4) and in CI | GAP-01 Done-when ("tests"); `ci.yml` `studio` | Planned | |
| Website browser suite: 0 failed, counts equal to base (5.3.2) | GAP-01 Done-when ("tests"); GAP-04 not yet in CI | Planned | |
| Design check green | GAP-01 Done-when; `ci.yml` `website` | Planned | |
| Website and Studio builds green | GAP-01 Done-when; `ci.yml` `website`, `studio` | Planned | |
| Built site unchanged: zero difference against base after commit 6; no `TURBOPACK` or `static/chunks/` in `out/` | Refinement plan risk "`next` 16.4.3 changes the static export"; implementation.md round 1 stop | Planned | |
| Red test for the Turbopack bootstrap committed before the fix (commit 5 fails, commit 6 passes) | B-6, P-4, P-5 | Planned | |
| Locked design untouched (`website/design/`, `packages/blocks`, design check green) | `AGENTS.md` settled design | Planned | |
| Section comparison green: no difference beyond base's report, here (5.3.1) and in CI | GAP-01 Done-when; `ci.yml` `section-compare` | Planned | |
| Screenshot regression tests pass and report reviewed by hand (Chromium here, three browsers in CI) | GAP-01 Done-when; `ci.yml` `screenshot-parity` | Planned | |
| Lockfile changes all expected or traced to a parent range | B-7; plan-review F-2 | Planned | |
| Pull request body follows the template; boxes ticked only when true | B-9; plan-review F-3 | Planned | |
| Lockfiles regenerated by npm; `npm ci` passes | B-7 | Planned | |
| Golden copies unchanged (no `github-actions` bump) | README G1 Wave 0 | Planned | |

## 12. Revision log

- Round 1 (1 November 2026): first version.
- Round 2 (1 November 2026), answering `plan-review.md` round 1
  (`Verdict: CHANGES NEEDED`):
  - **F-1 (Major), local browser and database checks.** Accepted. Section 2.8
    is corrected: Chromium launches through the prepared
    `PLAYWRIGHT_BROWSERS_PATH` symlink folder (Chromium 153 standing in for
    141), `/home/user/old-site` is a real checkout of
    `feature/interviewer-portal`, and SQL Server 2022, .NET 10.0.114 and a
    `sqlcmd` wrapper are available. Section 5.3 is rewritten as runnable
    steps: (1) `compare:sections` on base and branch `out/`, with
    `SECTION_COMPARE_OLD=/home/user/old-site` (not an export, since
    `run.mjs:39-40` requires the branch checkout) and port 4290, passing only
    if the branch shows no difference beyond the base; (2) `npm run
    test:browser` on the default and the consent build, base and branch;
    (3) the Chromium screenshot regression test and a Chromium-only
    screenshot comparison, base and branch, reviewed by hand; (4) the Studio
    end-to-end suite with the `ci.yml` connection strings and 42xx ports,
    after checking nobody is using `DigitalHubContent_E2e` and creating the
    `dh_content_app` login only if missing; NOT RUN only with a specific
    blocker. The plan states that the local browser is Chromium 153 and that
    the CI jobs remain the pinned-browser record (5.3, 5.4, R-9). Added R-8
    for the shared server and coverage rows for the browser suite and the
    end-to-end suite.
  - **F-2 (Minor), lockfile expectations.** Accepted. Section 2.2 now says no
    direct dependency changes major version but transitive `obug` goes to
    3.0.0. Steps 3 and 4 list the expected transitive changes the reviewer
    found (`obug`, `why-is-node-running` down to 3.2.1, `postcss` 8.5.32,
    `rolldown`/`@rolldown/binding-*` 1.2.16, `@oxc-project/types` 0.156.0,
    `chai`, `magic-string`, `std-env`, `tinybench`, `nanoid`,
    `@types/estree`, `@vitest/spy`, the six nested
    `@tailwindcss/oxide-wasm32-wasi` entries) and a trace rule for anything
    else: a change is expected when its parent (`next@16.4.3`,
    `vitest@5.0.5`, `vite@8.3.5`, `undici`, `source-map-js`, `sharp`)
    declares a range the new version satisfies. R-2 names the Studio
    `postcss` change, covered by `npm run build` and `check-preview-design`.
  - **F-3 (Minor), pull request body.** Accepted. New section 5.6 maps the
    template's sections onto this plan, quotes the owner's words exactly, and
    names the boxes that cannot be ticked: box 4 N/A, box 5 not in full (no
    changed-line coverage gate, GAP-18), box 7 only if the tech-lead records
    the pipeline review as the independent review, box 10 waits for the owner
    to name the integrator; "deferred-items updated" is N/A. The note that the
    template was not read is removed from the header.
  - **F-4 (Minor), noise floor.** Accepted. 5.2 now builds the base twice and
    diffs the two builds first; only differences beyond that floor need a
    per-file explanation.
- Round 3 (1 November 2026), answering `implementation.md` round 1
  (`Status: BACK TO ARCHITECT`, head `362a5e9`) and the coordinator's notes:
  - **The stop: `next` 16.4.3's inline `<script id="_R_">` Turbopack
    bootstrap on every page, missed by the strip and by the fail-closed trace
    check.** Scope extended by the smallest fix that closes it: step 5 (red
    test in `website/test/strip-runtime.test.ts` with a fixture from the real
    16.4.3 output) and step 6 (one narrow removal and two traces,
    `TURBOPACK` and `static/chunks/`, in `website/src/build/strip-runtime.ts`).
    No other website file, and nothing in the locked design, changes. The pass
    condition is now zero difference against base (5.2 step 4). 2.9 records
    that neither trace string occurs in today's output or design. Alternatives
    rejected in 3.2. New risks R-10, R-11; R-1 updated; coverage rows added.
  - **Shallow fetch.** The `git fetch --depth=1` line is removed from 5.2 and
    replaced by `git rev-parse --is-shallow-repository` (must be `false`); the
    design check uses the fully fetched `origin/feature/interviewer-portal`.
  - **Studio lockfile with npm 11.19.1.** Accepted and recorded (2.9, step 4,
    scope table): it keeps the base lockfile's `libc` fields, the diff is
    versions only, `npm ci` passes with npm 10 and 11, and it is regenerated
    by npm (B-7).
  - **`VITE_PUBLIC_SITE_URL` for the Studio build.** Added to the 5.2 command
    with the `ci.yml` value.
  - **`@types/estree` origin.** Corrected: it comes through `vitest`
    (`@vitest/mocker` → `estree-walker`), not `vite`.
  - **Website test counts** (409 + 1 skipped against 408 + 2 skipped, the
    extra base skip being a git-checkout-only test): accepted as
    environment; 2.9.
  - Steps 1 to 4 and their evidence stand. The checks the developer could not
    reach (5.3 browser, section, screenshot and end-to-end runs; CI) run on
    the head after commit 6.
