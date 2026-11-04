# Delivery approval: GAP-01 (gate 2)

## Round 1

Tech lead, 1 November 2026. Gate 2 for `change/GAP-01` at head **`d772f03`**
(`d772f03cd3dcd5bff02ae543c6667586a6ff7536`), base
`origin/rebuild/dotnet-platform` = merge-base = `6470fac`. Read first:
`docs/changes/README.md`, `.claude/agents/tech-lead.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md` (B-4 to B-9), `ENVIRONMENT.md`,
`.github/pull_request_template.md` and
`docs/quality/refinement-plan-2026-10-28.md`. These come from the read-only
copy of `origin/claude/cool-heisenberg-mh6zx9`, because they are not on the
base branch yet. I also read every file in this folder: `plan.md` round 3,
`plan-review.md` rounds 1 to 3, `plan-approval.md` rounds 1 and 2,
`implementation.md` rounds 1 and 2, and `test-report.md` round 1.

## Decision

**Approved**, with the open items below. Nothing is pushed yet. The owner's OK
to push is the first open item.

The required inputs are present:

- `implementation.md` round 2 ends `Status: READY FOR TEST`.
- `test-report.md` round 1 tested `d772f03`, ends `Verdict: APPROVED`, and
  reports no Blocker, Major or Minor.
- `plan-review.md` round 3 and `plan-approval.md` round 2 both end
  `Verdict: APPROVED`.

## What I verified myself

Every command below ran on 1 November 2026, Node 22.23.4 and npm 10.9.9,
against the head content (`d772f03`), unless the line says otherwise.
`git rev-parse --is-shallow-repository` printed `false`. I ran no `git fetch`
of any kind.

### Scope matches the plan

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD
  .github/security/gate.test.mjs, .github/security/known-findings.json,
  docs/changes/GAP-01/{implementation,plan-approval,plan-review,plan}.md,
  studio/package-lock.json, studio/package.json,
  website/package-lock.json, website/package.json,
  website/src/build/strip-runtime.ts, website/test/strip-runtime.test.ts
  12 files changed
$ git diff --stat 6470fac HEAD -- .github/workflows .github/security/gate.mjs \
    .github/security/run-npm-audit.sh '.github/security/*.expected*' \
    website/scripts website/design packages api
  (empty)
```

These are exactly the files in plan section 4 (round 3). Nothing protected
changed.

I read the code diff in full:

- **`known-findings.json`:** only `npm.website` goes from three entries to
  `[]`.
- **Both `package.json` files:** exact pins move to the planned versions, with
  no `overrides`.
- **`strip-runtime.ts`:** one narrow removal, anchored on
  `<script id="_R_">(globalThis["TURBOPACK"]` and lazy to the first
  `</script>`, plus the two traces `TURBOPACK` and `static/chunks/`.
- **`strip-runtime.test.ts`:** the existing 16.3.6 fixture and tests are kept.
  The only edits to existing assertions are additions: a `0` key, a third loop
  item and one new `expect`.
- **`gate.test.mjs`:** the npm tests now use a fixture copy of the gate. The
  assertions are kept, `/3 known, 1 new/` is added twice, and the copied gate
  is asserted byte-identical to the real one.

### Red before green (B-6)

The order is plan (`18b9ab3`), then self-test refactor (`3e620e1`), then
**red gate** (`2a4f836`, only `known-findings.json`), then the upgrades
(`115071e`, `dd1628b`), then **red strip test** (`6ad1366`, only the test
file), then the fix (`8f03751`, only `strip-runtime.ts`). `git show --stat`
on each confirms that each commit touches only the files named here.

I re-ran the strip red step on a scratch `git archive 6ad1366` export, with
the website's `node_modules` linked in. Nothing in the repository was changed.

```
(6ad1366)                          npx vitest run test/strip-runtime.test.ts   exit 1
     × removes each part of the runtime, and nothing else
     × does not remove what it does not recognise, so the output check can catch it
     × removes Next 16.4.3's inline Turbopack bootstrap
     × the trace check catches the Turbopack bootstrap if it is left in
     × strips a Next 16.4.3 page with no problem, and names a page that keeps a Turbopack trace
      Tests  5 failed | 4 passed (9)
(same export + 8f03751's strip-runtime.ts)                                       exit 0
      Tests  9 passed (9)
```

That matches `implementation.md` and `test-report.md` section 1. The gate red
step ("0 known, 6 new", exit 1 at `2a4f836`) was reproduced by the tester. I
accept that evidence and did not re-run it.

### Audits and the gate (G1 Wave 0 checklist)

| Check | Exit | Result |
|---|---|---|
| `website$ npm audit --audit-level=high` (full tree) | 0 | `{"moderate":1,"high":0,"critical":0,"total":1}` (`fast-uri`, out of scope) |
| `website$ npm audit --omit=dev --audit-level=high` | 0 | `found 0 vulnerabilities` |
| `website$ RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `studio$ npm audit --audit-level=high` (full tree) | 0 | `{"moderate":0,"high":0,"critical":0,"total":0}` |
| `studio$ npm audit --omit=dev --audit-level=high` | 0 | `found 0 vulnerabilities` |
| `studio$ RUNNER_TEMP=<scratch> bash ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| `node --test .github/security/gate.test.mjs` | 0 | `# tests 63 # pass 63 # fail 0` (base 62) |

### Website and Studio suites

```
website$ npx vitest run test/strip-runtime.test.ts            exit 0   Tests 9 passed (9)
website$ npm run typecheck                                    exit 0
(full-tree git archive d772f03, node_modules linked)
website$ npx vitest run                                       exit 0   Test Files 20 passed | 1 skipped (21); Tests 381 passed | 32 skipped (413)
studio$  npm test                                             exit 0   Test Files 8 passed (8); Tests 32 passed (32)
$ grep -rl -E "TURBOPACK|static/chunks/" website/out          exit 1   (no file)
```

The 32 skips are environmental:

- 31 are in `screenshot-parity-browser.test.ts`, which skips without a browser
  path.
- 1 is in `design.test.ts`, which needs a git checkout.

The tester ran the suite in a real checkout with the browser path set and got
412 passed and 1 skipped. Both runs have the same 413 total, 0 failed.

I ran the full suite in an export rather than in `/home/user/DH-WEBSITE`
because of a stray file in the working tree. A full `npx vitest run` there
fails one test, `no-hiring-system.test.ts`, on a gitignored, untracked
`website/artifacts/section-comparison.json` (16:14 UTC) that a
`compare:sections` run left behind. The tester saw the same thing on base
(`test-report.md` 8). It is not caused by this change, and CI never has that
file. I did not delete it, since this role edits nothing else.

### Tester's evidence is real

The test report quotes a command, exit code and output lines for every check.
Each NOT RUN has a reason and a named CI job:

- Semgrep;
- the API;
- Firefox and WebKit screenshots;
- CI.

Every row of its coverage table has evidence, except "Rebase after PR #38 and
CI green on final head", which is open (below).

I checked the tester's judgements and accept them:

- **Built output.** It is byte-identical to base (`diff -r` exit 0), with an
  empty noise floor.
- **Section comparison.** The base and branch reports are identical.
- **Screenshots.** 74 of 78 rows match base. The 4 rows that move are
  unstable captures.
- **Browser suite.** It passes 29/29 through a scratch CDN mirror, with the
  same outcomes as base. Without the mirror, the same 9 `gsap is not defined`
  failures appear on both.
- **Studio.** End-to-end passes 26/26.
- **Gate mutations.** The tester's three mutations of `gate.mjs` each fail the
  self-test. That shows P-6: the fixture allow-list did not weaken the gate.

### Commits (B-4)

All ten commits in `6470fac..d772f03` meet B-4:

- the subject is prefixed `GAP-01:` and written as an imperative summary;
- the body says why (I read `8f03751` in full and spot-checked the others);
- the commit ends with the `Co-Authored-By` and `Claude-Session` trailers.

### Conflicts with open work

`gh api repos/mohya7/DH-WEBSITE/pulls?state=open` shows only two open pull
requests:

- **#37** (pipeline docs, `claude/project-thread-fmllvw`), which touches
  governance documents only.
- **#38** (`change/ci-runner-pin`, open, not merged, head `b472fe5`), which
  touches `ci.yml` only.

Neither overlaps this change. Several `origin/` branches touch the same
`package.json`, lockfile, `strip-runtime.ts` or `.github/security` files:

- `phase-c/*`
- `phase-d/ci-*`
- `ci/github-actions`
- `cleanup/pr-25-notes`

All of them have their last commit before the base's date (11 to 19 October)
and no open pull request, so they are old, squash-merged branches, not
competing work. The worktree branches GAP-06, GAP-08, GAP-11 and GAP-12 were
checked at gate 1 round 2, and none touches these files. GAP-11's effect on
the built output is covered by open item 2.

## Findings

None at Blocker, Major or Minor. I accept these notes and do not need a fix
for any of them:

- **Stale e2e count.** The plan's count of 22 is out of date. The suite has
  26 tests on base and on branch.
- **Studio lockfile entries.** The plan expected six nested
  `@tailwindcss/oxide-wasm32-wasi` entries in the Studio lockfile, and they
  are absent. The base is the same, the tester showed this is npm's
  lock-only behaviour, and `npm ci` passes with npm 10 and npm 11.
- **Browser-suite evidence.** The browser suite's "0 failed" needed a scratch
  mirror of `cdn.jsdelivr.net`, because this container's proxy refuses that
  host. No file in the repository was changed. There is no CI job for that
  suite until GAP-04.
- **Lower-case Turbopack globals.** A lower-case `__turbopack_*` global with no
  chunk path would not be traced. Next 16.4.3 emits none, and the zero
  `diff -r` and empty grep prove it. If a later `next` release emits one, the
  section and screenshot comparisons are the backstop.

## Open items (before merge)

1. **Owner's OK to push.** No one has pushed anything. The developer never
   pushes. The integrator pushes `change/GAP-01` and opens the pull request
   with the draft body below only after the owner says to. This approval is
   not the owner's confirmation (README, `AGENTS.md`).
2. **Rebase after PR #38 merges** (plan 5.4, gate 1 condition 2). Rebase
   `change/GAP-01` on `rebuild/dotnet-platform` after PR #38 merges. Rebase
   again if any other change touching `website/` lands first, GAP-11 in
   particular. Never compare against `6470fac` once the base has moved. After
   each rebase, redo these against the new base commit:
   - the base noise floor and the zero-difference `diff -r` of `out/`;
   - the `TURBOPACK|static/chunks/` grep;
   - the section comparison and the Chromium screenshot comparison, base vs
     branch;
   - the full-tree audits and `run-npm-audit.sh` in both apps, since a new
     advisory may appear before merge (R-3);
   - the gate self-test.

   If a new trace fires on the new base's output, stop and report it. Do not
   loosen the trace (P-6). If PR #38 has not merged in time to push by
   Tuesday 3 November, tell the coordinator by the end of 2 November, as gate
   1 condition 7 requires. The owner then chooses between opening the pull
   request on the current base, where `studio`, `section-compare` and
   `screenshot-parity` fail for the runner reason only, and a slip.
3. **CI green on the final head** (plan 5.4, DoD box 6). These must pass, with
   run ids quoted in the pull request:
   - `ci.yml`: `api`, `website`, `studio`;
   - `security.yml`: all jobs, including `npm-audit` for the website (green
     for the first time since F1), `gate-self-test` and `semgrep`;
   - `codeql.yml`.

   Two jobs are judged on their reports:
   - **`section-compare`:** no difference beyond the base branch's latest
     report, which today shows only the careers apply difference
     (GAP-05/O-11).
   - **`screenshot-parity`** (the pull request carries the `screenshots`
     label): the Chromium regression step passes, and the tester reviews the
     report by hand in all three browsers, including Firefox and WebKit, which
     were not run here. Each difference is judged "same as base" or "new".

   A new difference stops the change for the owner.
4. **Commit the records.** `docs/changes/GAP-01/test-report.md` is still
   untracked. It must be committed on `change/GAP-01` together with this file
   before the push, so the pull request carries its own evidence.
5. **Independent review and second reviewer (DoD boxes 7 and 8).** Every
   pipeline role on this change, from architect to gate 2, ran as Claude Code.
   `AGENTS.md` says "No agent checks its own work. Rotation: … Cursor checks
   Claude Code". So I do not count the plan-review, test and gate 2 records as
   the independent review. The box is ticked after one of these:
   - a Cursor check of the final head;
   - the owner's own review, or the owner stating that the pipeline records
     satisfy it, quoted exactly.
6. **Integrator (DoD box 10).** No document I read names the integrator who
   merges into `rebuild/dotnet-platform` and re-runs the suites after the
   merge. The owner names one.
7. **Wave 0 exit gate** (refinement plan, Wave 0): "Security is green on
   `rebuild/dotnet-platform`, the first scheduled run has appeared, and the
   owner confirms." Merging GAP-01 is necessary but not enough. The scheduled
   run depends on the owner's setting changes:
   - **GAP-02 / O-2:** make `rebuild/dotnet-platform` the default branch.
   - **GAP-03 / O-9:** branch protection, which needs a paid plan for a
     private repository.

   These are separate items, not part of this pull request. Wave 0 also
   names O-7. The owner confirms the exit gate. This approval does not.

## Draft pull request description

Title: `GAP-01: Clear every High and Critical npm advisory in the website and the Studio`

Label: `screenshots`

```markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6Yc7G3x1zMCKZMuJSV3oKJ2)_

## What and why

GAP-01 (Wave 0, G1, security deadline 3 November). It closes baseline F1
(Critical `next` advisories), F3 (three allowed Highs with no expiry) and the
dependency half of F4. Before this change, the website had 2 Critical and 4
High advisories in production packages (`next`, `sharp`, `source-map-js`),
and both apps had development Highs (`vite`, `undici`, `source-map-js`).

Done when (refinement plan, quoted): "`npm audit --audit-level=high` on the
full tree reports 0 in the website and the Studio; the website entries are
removed from `known-findings.json`; tests, design check, build and section
comparison are green; the screenshot report is reviewed by hand, since that
step cannot fail yet".

Changes:

- **Website:** `next` 16.3.6 → 16.4.3 and `vitest` 5.0.2 → 5.0.5. `sharp`,
  `source-map-js`, `undici` and `vite` are refreshed inside their existing
  ranges.
- **Studio:** `vite` 8.3.0 → 8.3.5 and `vitest` 5.0.2 → 5.0.5. `undici` and
  `source-map-js` are refreshed.
- **Allow-list:** the three website entries are removed from
  `.github/security/known-findings.json`.
- **Gate self-test:** it now uses a byte-identical fixture copy of the gate,
  so it no longer depends on the real npm allow-list.
- **Build strip:** `next` 16.4.3 adds an inline Turbopack bootstrap
  (`<script id="_R_">`) to every exported page, and the strip missed it. The
  build strip now removes it, and two new fail-closed traces (`TURBOPACK`,
  `static/chunks/`) stop any other Turbopack form from shipping.

Records: `docs/changes/GAP-01/` holds the plan, the reviews, the
implementation, the test report and the delivery approval.

## Scope and boundaries

In scope:

- `.github/security/gate.test.mjs` and `.github/security/known-findings.json`;
- `website/` and `studio/` `package.json` and `package-lock.json`, regenerated
  by npm (B-7);
- `website/src/build/strip-runtime.ts` and `website/test/strip-runtime.test.ts`;
- `docs/changes/GAP-01/`.

Out of scope and byte-identical to base:

- `gate.mjs`, `run-npm-audit.sh` and its golden copy, `security.yml` and the
  golden copies;
- `.github/workflows/`;
- `website/scripts/`, `website/design/` and `packages/`;
- `api/`.

Also out of scope:

- `fast-uri` (moderate) is left for GAP-02 or GAP-07.
- Switching the gate to the full tree with expiries is GAP-07.
- The careers apply section difference is GAP-05 / O-11.

## Security impact

- **Dependencies:** this pull request is the fix. 0 High and 0 Critical
  remain in either app, in production or development packages. Every upgrade
  is a patch or minor release in the same major. There are no `overrides` and
  no `--force`.
- **Gate:** the allow-list only shrinks, and the website and Studio npm lists
  are now empty, so any new High or Critical fails at once. `gate.mjs` is
  unchanged. The self-test goes from 62 to 63 tests, and no assertion is
  removed or loosened.
- **Build:** the static-HTML guard is strengthened, and the built site is
  byte-identical to base.
- **Routes, policies, data, logins, secrets:** none.

## Tests and evidence

Local evidence at head `d772f03`, base `6470fac` (full commands, exit codes
and output in `docs/changes/GAP-01/implementation.md`, `test-report.md` and
`delivery-approval.md`):

- **Website audit:** full tree exit 0, `{"moderate":1,"high":0,"critical":0}`.
  Production exit 0. `run-npm-audit.sh website` exit 0:
  `0 known, 0 new.`
- **Studio audit:** full tree exit 0, total 0. Production exit 0.
  `run-npm-audit.sh studio` exit 0: `0 known, 0 new.`
- **Red tests before the fixes (B-6):**
  - At `2a4f836`, `run-npm-audit.sh website` exits 1 with
    `0 known, 6 new.`
  - At `6ad1366`, `vitest run test/strip-runtime.test.ts` exits 1 with
    `5 failed | 4 passed`. At head it passes 9/9.
- **Gate self-test:** `node --test .github/security/gate.test.mjs` passes
  63/63. Three mutations of `gate.mjs` each make it fail.
- **Website:**
  - typecheck exit 0;
  - `npm test` 412 passed, 1 skipped (base 409 + the 3 new tests);
  - `design:check` exit 0;
  - the build exits 0 and strips 29 Turbopack bootstrap scripts, one per page.
- **Built output against base:** `diff -r` of base and branch `out/` exits 0,
  with an empty noise floor. `grep TURBOPACK|static/chunks/` finds no file.
- **Section comparison, base vs branch:** the reports are identical. The
  result is 104/119 match and 14 accepted, plus the known careers apply
  difference.
- **Website browser suite (Chromium):** 29/29 pass on branch and base, with
  identical outcomes. The run used a scratch CDN mirror because this
  container blocks `cdn.jsdelivr.net`.
- **Screenshots (Chromium):** the regression tests pass 30, with 0 problems.
  In the comparison, 74 of 78 rows match base, and the 4 that move are
  unstable captures, reviewed by hand.
- **Studio:**
  - `tsc -b` exit 0;
  - `npm test` 32/32;
  - the build exits 0;
  - `npm ci` exits 0 with npm 10.9.9 and with npm 11.19.1;
  - end-to-end passes 26/26 on `DigitalHubContent_E2e`.
- **Secrets and .NET:** gitleaks finds no leaks in the pull request diff, and
  full history shows only the 2 known entries. The .NET audit is 0.

CI run ids on the final head: _to be filled after the push. Each run must be
green: `ci.yml` (`api`, `website`, `studio`, `section-compare`,
`screenshot-parity`), `security.yml` (all jobs) and `codeql.yml`._

NOT RUN locally:

| Check | Reason | Covered by |
|---|---|---|
| Semgrep | Not installed in the container | `security.yml` `semgrep` |
| API build and tests | No change under `api/` | `ci.yml` `api` |
| Firefox and WebKit screenshots | Not installed | `ci.yml` `screenshot-parity` |

## Owner decisions

- "Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry,
  2026-11-01, project thread).
- "continue working on wave 0 & 1" (Mohamed Elbadry, 2026-11-01, project
  thread).
- **O-1** ("Fix or accept the Critical `next` advisories (baseline F1)"): the
  owner has not answered it in words. This pull request takes O-1's
  recommended path, "Fix now: upgrade the website to `next@16.4.3` in its own
  pull request". That path needs no exception and changes no behaviour (the
  built site is byte-identical).
- **Exceptions:** none. No D-NNN entry is needed.
- **Push:** _owner's OK to push, quoted here when given._

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such). The CI half is tracked in box 6.
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [ ] Every new or changed route has a guard and, when it carries a record id, a record scope. **N/A:** no route changed.
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test. **Partly met:** tests and the regression tests (the red gate step and the red strip test) exist, but there is no changed-line coverage gate yet (GAP-18).
- [ ] PR checks are green on the final head (run IDs quoted). Open until CI runs on the rebased head.
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below. Open: every pipeline role was Claude Code, and `AGENTS.md` rotation has Cursor check Claude Code.
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed. Open: needs the owner's review.
- [x] Rollback is understood: revert this whole pull request. That restores the old versions and the three allow-list entries together. Reverting only an upgrade commit would leave the gate red.
- [ ] Deployment note: nothing deploys until Phase D. The integrator who merges into `rebuild/dotnet-platform` and re-runs the suites after the merge is _to be named by the owner_.

## Review findings accepted

- **Stale e2e count.** The plan's end-to-end count of 22 is out of date. The
  suite has 26 tests on base and on branch.
- **Studio lockfile entries.** The plan expected six nested
  `@tailwindcss/oxide-wasm32-wasi` entries, and they are absent from the
  Studio lockfile. The base is the same. This is npm's lock-only behaviour,
  and `npm ci` passes with npm 10 and npm 11.
- **Lower-case Turbopack globals.** A lower-case `__turbopack_*` global with
  no chunk path would not be traced. Next 16.4.3 emits none (zero `diff -r`,
  empty grep).
- **Browser-suite evidence.** The local browser suite needed a scratch CDN
  mirror. The suite has no CI job until GAP-04.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated. The change's coverage table is in `docs/changes/GAP-01/`.
- [ ] `docs/deferred-items.md` updated for any exception. **N/A:** no exception.
- [ ] Documentation updated. **N/A:** no documentation describes the changed versions or the strip internals.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
