# Implementation: GAP-07

## Round 1

Developer, 1 November 2026. Branch `change/GAP-07` (no tracking, not pushed),
worktree `/home/user/wt-GAP-07`, cut from `change/GAP-01` at `57da65b`.
Plan: `plan.md` round 2. Gate 1: `plan-approval.md`, `Verdict: APPROVED`, with
7 conditions. Node v22.23.4, npm 10.9.9, .NET SDK 10.0.114.
`git rev-parse --is-shallow-repository` = `false`. No fetch was run.
Scratch evidence (not committed):
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap07/`
and `.../scratchpad/gap07-red.txt`, `gap07-red2.txt`, `gap07-green.txt`.

The governing documents (`AGENTS.md`, `ENGINEERING_STANDARDS.md`,
`docs/changes/README.md`, `docs/deferred-items.md`, `ENVIRONMENT.md`) are not on
this branch (O-18). I read them from the read-only reference copy the
orchestrator supplied.

## Result in one paragraph

All of plan section 3.1 is implemented on the current base (`57da65b`).

- The npm jobs now audit the full tree.
- Each npm and dotnet allow-list entry must cite a D-NNN held in
  `docs/deferred-items.md` with the same expiry, and it fails once that day
  has passed.
- `run()` in the self-test sends `npm` and `dotnet` to a clean byte copy of
  the gate.

The red run was 74 tests, 64 passed and 10 failed. The failures were exactly
N1 and N3 to N11, as the plan predicted. The fixed head passes 74 of 74. Every
5.2 and 5.3 check gives the result the plan expects. That includes the
historical proof: the new script on the pre-GAP-01 Studio lockfile fails with
the six Highs.

One deviation from the expected sequence is reported below ("Failure found
after the fix"). It is a bug in my own N11 static-scan pattern. I fixed it in
a separate test-only commit and did not loosen the scan.

**Still owed (condition 1): rebase onto GAP-01 and re-run 5.2 and 5.3.**
GAP-01 has not merged into `origin/rebuild/dotnet-platform`, so I cannot
rebase now. Before the pull request is opened, after GAP-01 merges:

- rebase this branch onto `origin/rebuild/dotnet-platform` (B-3: no tracking,
  never a bare push);
- confirm that `git rev-parse --is-shallow-repository` is `false`;
- re-run every command in 5.2 and 5.3, with `<base>` set to the merged GAP-01
  commit;
- re-run `diff .github/workflows/security.yml .github/security/security.expected.yml`
  (condition 6).

If the rebased full-tree audit shows any High or Critical finding, stop and
report it to the coordinator. Do not add an allow-list entry (R-1).

## Commits

| SHA | Subject | Plan step |
|---|---|---|
| `881a1ae` | GAP-07: Add failing tests for the full-tree audit and expiring allow-list entries | 5.1, red (B-6) |
| `8902d05` | GAP-07: Match only the real gate variable in N11's static scan | 5.1 (test fix, see "Failure found after the fix") |
| `3b1b9c6` | GAP-07: Audit the full dependency tree and expire allow-list entries | 3.1 steps 1 and 3 to 11 (fix; golden copies in the same commit) |
| (this file) | GAP-07: Record the implementation | — |

## What changed, file by file

| File | Change | Scope row (plan section 4) |
|---|---|---|
| `.github/security/gate.test.mjs` | `881a1ae`: added `fixtureRepo()`, which builds `<tmp>/<name>/.github/security/` (byte copies of `gate.mjs` and `fail-on-rules.json`, plus a derived `known-findings.json`) and optionally `<tmp>/<name>/docs/deferred-items.md`. It builds four copies, each from `structuredClone(known)` (condition 4). **`fixture-clean`**: `npm.website`, `npm.studio` and `dotnet` set to `[]`, no `docs/`. **`fixture-repo`**: `npm.website` has three entries citing D-901 to D-903, expiring 2999-12-31; `npm.studio` has one entry citing D-900, expiring 2000-01-01; `dotnet` has one entry citing D-904, expiring 2000-01-01; its register holds D-900 to D-904 and the template's fenced example. **`fixture-no-register`**: one `npm.website` entry citing D-901, no `docs/`. **`fixture-expired-real`**: the real file plus the D-900 `npm.studio` entry and the D-904 `dotnet` entry, with a register holding both. `run()` (line 99) sends `npm` and `dotnet` to `fixture-clean` and everything else to the real gate. `runGate()` records each gate it spawns in `spawnedGates`, which N11 uses. "the fixture gate is the real gate" compares both files in all four copies. New tests N1 to N11 are at the end of the file (lines 1725 to 1928). `8902d05`: the N11 direct-spawn pattern. | yes |
| `.github/security/gate.mjs` | `3b1b9c6`: added `parseRegister` (line 296), `allowListShapeProblems` (340) and `allowListProblems` (363), all exported and pure. `checkAllowList()` (395) reads the register and the UTC date; `main()` calls it for `npm` (562) and `dotnet` (567) after `finish()`, and it sets `process.exitCode = 1` on any problem. Header and usage comments reworded. `consumedFields`, `validateNpm` and `validateDotnet` are unchanged. | yes |
| `.github/security/run-npm-audit.sh` | `3b1b9c6`: `--omit=dev` dropped on lines 13 and 14. | yes |
| `.github/security/run-npm-audit.expected.sh` | `3b1b9c6`: same edit. | yes |
| `.github/workflows/security.yml` | `3b1b9c6`: header comment only. Line 5 drops "only", and lines 9 to 11 are added. No job, step, `run:`, `uses:` or `name:` line changes. | yes |
| `.github/security/security.expected.yml` | `3b1b9c6`: same edit. | yes |
| `docs/changes/GAP-07/implementation.md` | This record. | yes |

These stay byte-identical to `57da65b`: `known-findings.json`,
`run-dotnet-audit.sh` and its golden copy, every `package.json`, both
lockfiles and every `.csproj` (5.2 below). I did not create
`docs/deferred-items.md` or `ENGINEERING_STANDARDS.md`.

### Interpretation recorded: what `parseRegister` returns

Plan 3.1 step 7 says `parseRegister(text)` "returns a `Map` of D-NNN to its
`Expires` string (or a problem list for duplicates)". It returns
`{ entries, duplicates }`:

- `entries` is that `Map`. The value is `null` when the entry has no single
  `- Expires: YYYY-MM-DD` line.
- `duplicates` is the list of ids whose heading appears more than once.

`allowListProblems(entries, today, register)` takes this object, or `null`
when the file is missing. An entry fails as a duplicate only when it cites the
duplicated id ("when that heading appears twice", 3.1 step 4). The behaviour
is what the plan specifies. Only the return shape is my choice.

### Messages the gate prints

Each problem prints as `::error title=Allow-list entry (<label or kind>)::<problem>`:

- `<id> has no D-NNN in "deferred"`
- `<id> cites "<value>", which is not a D-NNN id`
- `<id> has no expires date`
- `<id> has expires "<value>", which is not a real YYYY-MM-DD date`
- `<id> cites D-NNN, but docs/deferred-items.md does not exist`
- `<id> cites D-NNN, which is not in docs/deferred-items.md`
- `<id> cites D-NNN, which appears more than once in docs/deferred-items.md`
- `<id> cites D-NNN, which has no "- Expires: YYYY-MM-DD" line in docs/deferred-items.md`
- `<id> expires on <date>, but D-NNN in docs/deferred-items.md expires on <date>`
- `<id> cites D-NNN, which expired on <date>; fix the finding or record a new owner decision`

## Commands run, with exit codes

### Baseline on `4a85138` (before any change)

```
$ node --test .github/security/gate.test.mjs     exit 0
# tests 63
# pass 63
# fail 0
```

With only the routing and fixture changes in place (before N1 to N11 were
added), the result was still `# tests 63  # pass 63  # fail 0`. The moved
tests pass unchanged through `fixture-clean`.

### Red run on `881a1ae` (condition 3)

```
$ node --test .github/security/gate.test.mjs     exit 1
not ok 64 - the npm audit script audits the full tree, development packages included
not ok 66 - an expired npm allow-list entry fails while its advisory is still reported
not ok 67 - an expired npm allow-list entry fails after its advisory is gone
not ok 68 - an expired NuGet allow-list entry fails
not ok 69 - an entry is valid through its expiry day and expired the day after
not ok 70 - an allow-list entry without a D-NNN, with a malformed one, or citing one the register does not hold fails
not ok 71 - an allow-list entry without an expiry, with a malformed or impossible date, or with a date that differs from the register fails
not ok 72 - an allow-list entry fails closed when docs/deferred-items.md is missing
not ok 73 - every npm and NuGet entry in known-findings.json cites a D-NNN and carries a valid expiry
not ok 74 - the self-test does not depend on the real npm and NuGet allow-list
# tests 74
# pass 64
# fail 10
```

This matches plan 5.1's expected 74 / 64 / 10: N1 and N3 to N11 fail, and N2
(test 65) plus the 63 existing tests pass. Each failure is for the planned
reason:

| Test | Failure |
|---|---|
| N1 | Both `npm audit` lines reported as "narrows the tree with --omit" |
| N3, N4, N5, N9 | `expected: 1, actual: 0`. N3's output reads `studio: 1 finding(s) at the gate's level; 1 known, 0 new.` |
| N6, N7, N8 | `parseRegister is not a function` |
| N10 | `allowListShapeProblems is not a function` |
| N11 | The expired-real copy exits 0 (`expected: 1, actual: 0`) |

The whole file loaded, because all three new exports are loaded with
`await import(pathToFileURL(gate).href)` inside the tests that use them.
There is no top-level named import (condition 3, F-7).

### Failure found after the fix (reported before fixing it)

With the fix applied, the first run was:

```
$ node --test .github/security/gate.test.mjs     exit 1
not ok 74 - the self-test does not depend on the real npm and NuGet allow-list
  error: the real gate is spawned directly: spawnSync(process.execPath, [gate
    1 !== 0
# tests 74
# pass 73
# fail 1
```

The cause is a bug in the test I wrote. The plan's literal pattern
`spawnSync(process.execPath, [gate` is a prefix of the shared helper's own
`spawnSync(process.execPath, [gateFile, ...args]` in `runGate()`. That
helper is not a direct spawn of the real gate. The red run never reached
this assertion, because N11's first assertion had already failed.

The fix is in commit `8902d05`, which changes only the test file. The pattern
is now a regex that ends at a word boundary after `gate`. A new assertion in
N11 checks that the regex still matches a direct spawn of the real gate
(`spawnSync(process.execPath, [gate, ...args]`), so the scan is not
loosened.

On `8902d05` with the gate still unfixed, the run was exit 1 with the same
ten failures as `881a1ae` (`# tests 74  # pass 64  # fail 10`). I ran it
with the fix files stashed; the output is in `gap07-red2.txt`.

### Green on `3b1b9c6` (plan 5.2)

```
$ node --test .github/security/gate.test.mjs                     exit 0
ok 12 - the fixture gate is the real gate
ok 13 - a known-only npm report passes
ok 14 - a new High advisory fails
ok 15 - a new Critical advisory fails
ok 64 - the npm audit script audits the full tree, development packages included
ok 65 - the NuGet audit script lists vulnerable packages across the whole graph
ok 66 - an expired npm allow-list entry fails while its advisory is still reported
ok 67 - an expired npm allow-list entry fails after its advisory is gone
ok 68 - an expired NuGet allow-list entry fails
ok 69 - an entry is valid through its expiry day and expired the day after
ok 70 - an allow-list entry without a D-NNN, with a malformed one, or citing one the register does not hold fails
ok 71 - an allow-list entry without an expiry, with a malformed or impossible date, or with a date that differs from the register fails
ok 72 - an allow-list entry fails closed when docs/deferred-items.md is missing
ok 73 - every npm and NuGet entry in known-findings.json cites a D-NNN and carries a valid expiry
ok 74 - the self-test does not depend on the real npm and NuGet allow-list
# tests 74
# pass 74
# fail 0

$ diff .github/security/run-npm-audit.sh .github/security/run-npm-audit.expected.sh         exit 0, no output
$ diff .github/security/run-dotnet-audit.sh .github/security/run-dotnet-audit.expected.sh   exit 0, no output
$ diff .github/workflows/security.yml .github/security/security.expected.yml                exit 0, no output
$ grep -n -- "--omit" .github/security/run-npm-audit.sh                                     exit 1, no match
$ grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml               exit 1, no match
$ git diff --stat 57da65b..HEAD   (before this file)
 .github/security/gate.mjs                  | 152 ++++++-
 .github/security/gate.test.mjs             | 361 ++++++++++++++++-
 .github/security/run-npm-audit.expected.sh |   4 +-
 .github/security/run-npm-audit.sh          |   4 +-
 .github/security/security.expected.yml     |   5 +-
 .github/workflows/security.yml             |   5 +-
 docs/changes/GAP-07/plan-approval.md       | 279 +++++++++++++
 docs/changes/GAP-07/plan-review.md         | 294 ++++++++++++++
 docs/changes/GAP-07/plan.md                | 627 +++++++++++++++++++++++++++++
$ git diff 57da65b..HEAD -- '*package-lock.json' '*package.json' '*.csproj' \
    .github/security/known-findings.json .github/security/run-dotnet-audit.sh \
    .github/security/run-dotnet-audit.expected.sh | wc -c                                 0
```

Test 12, "the fixture gate is the real gate", passes. It asserts that four
copies exist (`fixture-repo`, `fixture-clean`, `fixture-no-register`,
`fixture-expired-real`) and that `gate.mjs` and `fail-on-rules.json` in each
`Buffer.equals` the real files (condition 2, F-6).

`<base>` is `57da65b` here. After the rebase it is the merged GAP-01 commit,
and this whole block is re-run (condition 1).

### The jobs as CI runs them (plan 5.3)

`RUNNER_TEMP` was a folder under `.../scratchpad/gap07/`. Nothing was
installed. `npm audit` reads only the lockfile.

```
1. website$ RUNNER_TEMP=<s>/rt-website bash ../.github/security/run-npm-audit.sh website    exit 0
   fast-uri  3.0.0 - 3.1.8   Severity: moderate   (GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h,
     GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp)   fix available via `npm audit fix`
   1 moderate severity vulnerability
   website: 0 finding(s) at the gate's level; 0 known, 0 new.
2. studio$  RUNNER_TEMP=<s>/rt-studio bash ../.github/security/run-npm-audit.sh studio      exit 0
   found 0 vulnerabilities
   studio: 0 finding(s) at the gate's level; 0 known, 0 new.
3. api$ dotnet restore DigitalHub.slnx                                    exit 0   "All projects are up-to-date for restore."
   api$ RUNNER_TEMP=<s>/rt-api bash ../.github/security/run-dotnet-audit.sh   exit 0
   The given project `DigitalHub.Api` has no vulnerable packages given the current sources.
   The given project `DigitalHub.Api.Tests` has no vulnerable packages given the current sources.
   The given project `DigitalHub.ContentImport` has no vulnerable packages given the current sources.
   dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.
4. JSON from step 1:   metadata.vulnerabilities {"info":0,"low":0,"moderate":1,"high":0,"critical":0,"total":1}
                       metadata.dependencies {"prod":20,"dev":152,"optional":112,"peer":32,"peerOptional":0,"total":209}
                       vulnerabilities keys ["fast-uri"]
   Old flags, website$ npm audit --omit=dev --audit-level=high --json     exit 0
                       metadata.vulnerabilities {...,"moderate":0,...,"total":0}   vulnerabilities keys []
   Studio JSON:        metadata.dependencies {"prod":135,"dev":173,"optional":76,"peer":0,"peerOptional":0,"total":312}, total 0
5. website$ RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh other    exit 1
   run-npm-audit.sh app must be website or studio
6. Historical proof. <s>/hist/studio holds `git show 6470fac:studio/package.json` and
   `git show 6470fac:studio/package-lock.json`, and <s>/hist/.github/security is a copy of the branch's
   .github/security/.
   hist/studio$ RUNNER_TEMP=<s>/hist/rt bash ../.github/security/run-npm-audit.sh studio   exit 1
   5 vulnerabilities (2 moderate, 3 high)
   ::error title=New finding (studio)::high source-map-js GHSA-68fv-2mgg-jv7q: ...
   ::error title=New finding (studio)::high undici GHSA-xjj6-f33q-929c: ...
   ::error title=New finding (studio)::high undici GHSA-4w7w-5xrc-9h26: ...
   ::error title=New finding (studio)::high undici GHSA-2m5v-pch6-74hx: ...
   ::error title=New finding (studio)::high undici GHSA-qrxm-fqhp-jwvm: ...
   ::error title=New finding (studio)::high vite GHSA-587h-7wmj-h5pm: ...
   studio: 6 finding(s) at the gate's level; 0 known, 6 new.
```

No database was touched, no server was started, and no port was used.

### NOT RUN

- **CI evidence on the pull request (plan 5.4): NOT RUN.** The branch is not
  pushed, and no pull request may be opened before GAP-01 merges
  (condition 1). The Security workflow covers it: `Security gate self-test`,
  `npm audit (website)`, `npm audit (studio)` and
  `NuGet vulnerable packages (api)`. The local red run above is the red
  evidence; CI never ran on the red commit.
- **The rebase onto merged GAP-01 and the re-run of 5.2 and 5.3: NOT RUN.**
  GAP-01 has not merged yet. This is owed (condition 1).
- **actionlint on `security.yml`: NOT RUN.** GAP-08 has not merged. Only a
  comment changed, and the YAML is still parsed by the self-test's
  `parseWorkflowYaml` (test "the semgrep job and scan script match their
  golden copies" passes).

## Approval conditions

| # | Condition | How it is met |
|---|---|---|
| 1 | Sequencing on GAP-01 | Not met yet; owed. Built and tested on `57da65b`. The rebase, the shallow check, and the re-run of 5.2, 5.3 and the `security.yml` diff are still to do after GAP-01 merges (see above). The pull request must not be opened before then. |
| 2 | F-6: all four copies byte-compared | Test 12 loops over `fixtureGateDirs` (4 entries, asserted) and compares `gate.mjs` and `fail-on-rules.json`. Passes on `3b1b9c6`. |
| 3 | F-7: dynamic import only; red run 74 / 10 | All three exports are loaded with `await import(...)` inside N6, N7, N8 and N10. The top-level import line is unchanged. Red run: 74 tests, 64 pass, 10 fail, named above. |
| 4 | Derived fixtures | Each fixture's `known-findings.json` is `structuredClone(known)` with only the named sections set. `fixture-expired-real` appends to the real `npm.studio` and `dotnet` lists. |
| 5 | Scope | Only section 4 files changed (diff stat above). The protected files have an empty diff. Only the `security.yml` header changed. Neither `docs/deferred-items.md` nor `ENGINEERING_STANDARDS.md` was created. C-9 is recorded as moved, and the `dotnet-ef` follow-up is listed (below). |
| 6 | Parallel files | For the orchestrator. On this side, the `security.yml` and golden-copy diff is re-run after every rebase (owed under condition 1). |
| 7 | O-20 | For the orchestrator. The gitleaks and Semgrep sections and their code paths were not touched. |

## Follow-ups for the register (no id yet)

- **`dotnet-ef` tool manifests are not audited.** `dotnet list package` does
  not read `api/dotnet-tools.json` or `api/.config/dotnet-tools.json`, which
  pin the local tool `dotnet-ef` 10.0.12, and there is no NuGet audit command
  for tools. Auditing it needs a new mechanism, so it belongs in a separate
  change (B-8). It is the residual in G-11's "Partial" status (plan section 4,
  F-4).
- **`fast-uri` (moderate, website, development)** is below the gate's level.
  `npm audit fix` is available. It is left to Dependabot triage (GAP-02).
- **gitleaks and Semgrep entries: D-NNN and expiry.** This waits on O-20
  (C-10).

## Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| C-1 The npm gate audits development packages (full tree) in both apps | GAP-07 Done-when; G-11; baseline F4 | Done (on `57da65b`; re-run owed after rebase) | `3b1b9c6` drops `--omit=dev`. N1 passes. 5.3 step 4: `dependencies.dev` is 152 (website) and 173 (Studio), and `fast-uri` (dev) is reported, where the old flags gave `[]`. 5.3 step 6 shows the six historical Highs. |
| C-2 The NuGet gate covers the whole graph (tests, tools, transitive), pinned by a self-test | G-11 | Done | N2 passes, and its `--include-transitive`-less copy is reported. 5.3 step 3 lists the Api, Api.Tests and ContentImport projects. Tool manifests are out: see follow-ups. |
| C-3 The gate fails on an expired npm or NuGet entry, proven by a self-test | GAP-07 Done-when | Done | N3, N4, N5, N6 and N11 are red on `881a1ae` and green on `3b1b9c6`. |
| C-4 Each npm and NuGet entry cites a D-NNN held in `docs/deferred-items.md`, with the same expiry | Register target; standard section 6; S-7 | Done | N7, N8 and N9 (fail closed without the register) and N10 (the real file's shape), all green on `3b1b9c6`. |
| C-5 The gate blocks at once | Done-when; track checklist | Done | `grep -E "continue-on-error\|BLOCKING_FROM" security.yml` exits 1 with no match. No job lines changed. |
| C-6 Golden copies change in the same commit; `security.yml` matches `security.expected.yml` | `security.yml` header; P-6 | Done | `3b1b9c6` contains both pairs. All three `diff` commands give no output. The pinned-script and golden-copy self-tests pass. |
| C-7 Red tests committed before the fix | B-6, P-4 | Done | `881a1ae` (red: 74 / 64 / 10) comes before `3b1b9c6`. `8902d05` is a test-only correction, still red (64 / 10). |
| C-8 Full-tree audit today: 0 High or Critical in website, Studio and API | Success measure; G-11 | Done on `57da65b`; re-run owed after rebase | 5.3 steps 1 to 3: all three gates report `0 known, 0 new` and exit 0. |
| C-9 G-11 and S-7 status rows updated | Refinement plan | Moved | `ENGINEERING_STANDARDS.md` is not on this branch or its base (O-18 pending). It moves to the first change after the O-18 governing-docs pull request merges, or to this change if the file is on the base when it is rebased. The rows to write are the ones in plan section 4. |
| C-10 gitleaks and Semgrep entries: D-NNN and expiry | Standard section 6 | Open: waits on O-20 (GAP-07b if the entries need a D-NNN, an ADR if section 6 changes) | Not touched by this change. |
| C-11 The self-test does not depend on real npm or NuGet entry expiry or the register | Review F-1; 3.1 step 10 | Done | N11 green. The expired-real copy exits 1 on clean `npm studio` and `dotnet` reports. `run()` exits 0 on the same reports. `spawnedGates` shows `[clean, clean, real, real]` for npm, dotnet, gitleaks and semgrep. The static scan finds the real gate spawned only inside `run()`, after the npm/dotnet guard. |

## For the tester

- **F-8.** Read `gate.test.mjs` and confirm that every spawn of the real gate
  goes through `run()`. The only other process that loads the real
  `gate.mjs` is `loadConsumedFields()`, which uses `node --input-type=module`
  to import `consumedFields` and does not call `main()`.
- **`8902d05`** changed a test after the red commit. Check that it only
  narrows a pattern that wrongly matched `[gateFile`, and that its new
  positive assertion keeps the scan able to catch a direct spawn.
- **`parseRegister`'s return shape** differs from the plan's wording (see
  "Interpretation recorded").
- The register parser ends an entry at any `#` or `##` heading. A `###`
  subheading stays inside the entry. More than one `- Expires:` line in one
  entry counts as no valid line, so the entry fails closed.

Status: READY FOR TEST

## Round 2

Developer, 1 November 2026. Answers `delivery-approval.md` round 1
(`Verdict: CHANGES NEEDED`), which sends back the tester's T-2 from
`test-report.md` round 1. Same branch, worktree and base (`57da65b`). Node
v22.23.4, npm 10.9.9. `git rev-parse --is-shallow-repository` = `false`. No
fetch was run. Scratch evidence (not committed):
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap07-r2/`,
`.../scratchpad/gap07-r2-red.txt` and `.../scratchpad/gap07-r2-green.txt`.

**`test-report.md` and `delivery-approval.md` are not committed.** Gate 2's
"What round 2 must contain", step 3, asks for `test-report.md` round 1 to be
committed before round 2. The coordinator's instruction for this round was to
leave both files in place, uncommitted. I followed the coordinator. Both files
are untracked in the worktree, and committing them is left to the coordinator.

Round 1 above is unchanged. Its closing status line is superseded by this
round's.

### Commits

| SHA | Subject | Answers |
|---|---|---|
| `7628a49` | GAP-07: Add a failing test for npm configuration that omits dev packages | T-2, red (B-6) |
| `e3006f2` | GAP-07: Refuse an npm configuration that omits packages from the audit | T-2, fix (golden copy in the same commit) |
| (this round's record) | GAP-07: Record round 2 of the implementation | — |

### Findings and how each is answered

**T-2 (required): an npm setting outside the script could switch off the
full-tree audit. Fixed.**

`run-npm-audit.sh` lines 13 to 24, and `run-npm-audit.expected.sh`
identically, now run `omit=$(npm config get omit)` before either `npm audit`
line:

- If that command fails, the script prints
  `::error title=npm audit (<app>)::npm config get omit failed` and exits 1.
- If the value is not empty, it prints
  `::error title=npm audit (<app>)::npm is set to omit "<value>"; the audit must cover the full tree, development packages included. Remove NODE_ENV=production, NPM_CONFIG_OMIT, npm_config_production or the omit setting in .npmrc.`
  and exits 1.

Other properties of the fix:

- The two `npm audit` lines are unchanged. N1 still finds exactly those two
  lines: the `::error title=npm audit (` text follows `=`, not whitespace,
  so N1's pattern does not count it.
- No switch turns the check off.
- The script refuses rather than adding `--include=dev`. That follows gate 2's
  reasoning: N1 forbids `--include`, and a refusal shows the attempt in the
  log.
- `npm config get` sends its deprecation warnings (for example
  `npm warn config production`) to stderr. The script captures stdout only, so
  a warning cannot fill the value.

The new test (N12), "the npm audit script refuses an npm configuration that
omits packages", is at the end of `gate.test.mjs`. It works like this:

- It runs the real `run-npm-audit.sh` with `sh`, from app folders beside the
  `fixture-clean` gate, so `../.github/security/gate.mjs` resolves to the clean
  byte copy.
- A stub `npm` on `PATH` answers `npm audit` with a marker on stderr and, for
  `--json`, a clean report, so the test needs no network. It passes every other
  command, including `npm config get`, to the real npm.
- The environment is the test's own, with `NODE_ENV` and
  `npm_config_omit|production|only|include|dev` (any case) removed.

What it asserts:

- **No setting:** exit 0, the stub audit reached twice,
  `studio: 0 finding(s) at the gate's level; 0 known, 0 new.`, and no
  `::error`.
- **`NODE_ENV=production`, `NPM_CONFIG_OMIT=dev`,
  `npm_config_production=true`, and an `.npmrc` holding `omit=dev`** (in a
  `website` app folder): each exits 1, prints the refusal naming `"dev"`, and
  never reaches the stub audit.

The fourth case, `npm_config_production=true`, was not required. It is one
of gate 2's reproductions, so I added it.

**T-1 (optional): N11's static scan misses other spellings of a direct spawn.
Not taken in this round. Recorded as a follow-up for GAP-21**, as gate 2
allows. The behavioural half of N11 (`spawnedGates` shows
`[clean, clean, real, real]`) is unchanged.

**T-3 (optional): the register parser accepts an entry inside a fence indented
by up to three spaces, or inside an HTML comment. Not taken in this round.
Recorded as a follow-up for the change that lands `docs/deferred-items.md`**,
as gate 2 allows. It does not loosen the gate: the entry still needs a matching
D-NNN and the same expiry, and it still fails the day after.

### Commands run, with exit codes

#### Red run on `7628a49`

```
$ node --test .github/security/gate.test.mjs     exit 1
not ok 75 - the npm audit script refuses an npm configuration that omits packages
  error: NODE_ENV=production
    studio: 0 finding(s) at the gate's level; 0 known, 0 new.
    STUB-NPM-AUDIT audit --audit-level=high
    STUB-NPM-AUDIT audit --audit-level=high --json
    0 !== 1
# tests 75
# pass 74
# fail 1
```

The no-setting half passed. The first omit case went on to `npm audit` and
exited 0, which is the hole T-2 describes.

#### Green on `e3006f2`

```
$ node --test .github/security/gate.test.mjs     exit 0
ok 64 - the npm audit script audits the full tree, development packages included
ok 65 - the NuGet audit script lists vulnerable packages across the whole graph
ok 75 - the npm audit script refuses an npm configuration that omits packages
# tests 75
# pass 75
# fail 0
```

#### Gate 2's reproduction, re-run (required outcome step 3)

`<r2>/hist/studio` holds `git show 6470fac:studio/package.json` and
`package-lock.json`. `<r2>/hist/.github/security` is a copy of `e3006f2`'s
`.github/security/`.

```
hist/studio$ RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh studio
  (no setting)                 exit 1   5 vulnerabilities (2 moderate, 3 high)
                                        ::error title=New finding (studio)::high source-map-js GHSA-68fv-2mgg-jv7q: ...
                                        ::error title=New finding (studio)::high undici GHSA-xjj6-f33q-929c: ...
                                        ::error title=New finding (studio)::high undici GHSA-4w7w-5xrc-9h26: ...
                                        ::error title=New finding (studio)::high undici GHSA-2m5v-pch6-74hx: ...
                                        ::error title=New finding (studio)::high undici GHSA-qrxm-fqhp-jwvm: ...
                                        ::error title=New finding (studio)::high vite GHSA-587h-7wmj-h5pm: ...
                                        studio: 6 finding(s) at the gate's level; 0 known, 6 new.
  NODE_ENV=production          exit 1   ::error title=npm audit (studio)::npm is set to omit "dev"; the audit must cover the full tree, development packages included. Remove NODE_ENV=production, NPM_CONFIG_OMIT, npm_config_production or the omit setting in .npmrc.
  NPM_CONFIG_OMIT=dev          exit 1   (same refusal)
  npm_config_production=true   exit 1   npm warn config production Use `--omit=dev` instead.
                                        (same refusal)
  studio/.npmrc "omit=dev"     exit 1   (same refusal)
```

In round 1 (gate 2's run on `6e4eea9`) the four settings each exited 0 with
`found 0 vulnerabilities`.

#### The `NODE_ENV: production` workflow mutation

This was run in a scratch extract of `e3006f2`
(`git archive HEAD .github .semgrepignore .gitattributes` into `<r2>/mut`),
not in the worktree. The line `  NODE_ENV: production` was added after
`  NODE_VERSION: "22"` in the workflow-level `env:` of both `security.yml` and
`security.expected.yml`.

```
mut$ grep -c "NODE_ENV: production" .github/workflows/security.yml .github/security/security.expected.yml   1, 1
mut$ cmp .github/workflows/security.yml .github/security/security.expected.yml                             exit 0
mut$ node --test .github/security/gate.test.mjs                                                           exit 0   # tests 75  # pass 75  # fail 0
website$ NODE_ENV=production RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh website              exit 1
  ::error title=npm audit (website)::npm is set to omit "dev"; the audit must cover the full tree, ...
studio$  NODE_ENV=production RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh studio               exit 1
  ::error title=npm audit (studio)::npm is set to omit "dev"; the audit must cover the full tree, ...
```

The mutation still passes the self-test, as gate 2 expected. The npm job that
runs under that environment now fails with the refusal. The job step is
simulated by setting the variable on the script, because the workflow cannot
be run here.

#### Plan 5.2, re-run on `e3006f2`

```
$ diff run-npm-audit.sh run-npm-audit.expected.sh                       exit 0, no output
$ diff run-dotnet-audit.sh run-dotnet-audit.expected.sh                 exit 0, no output
$ diff .github/workflows/security.yml .github/security/security.expected.yml   exit 0, no output
$ grep -n -- "--omit" .github/security/run-npm-audit.sh                 exit 1, no match
$ grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml   exit 1, no match
$ git diff --stat 57da65b..HEAD -- . ':!docs'
 .github/security/gate.mjs                  | 152 +++++++++-
 .github/security/gate.test.mjs             | 428 ++++++++++++++++++++++++++++-
 .github/security/run-npm-audit.expected.sh |  16 +-
 .github/security/run-npm-audit.sh          |  16 +-
 .github/security/security.expected.yml     |   5 +-
 .github/workflows/security.yml             |   5 +-
$ git diff 57da65b..HEAD -- '*package-lock.json' '*package.json' '*.csproj' known-findings.json \
    run-dotnet-audit.sh run-dotnet-audit.expected.sh fail-on-rules.json .github/workflows/ci.yml | wc -c   0
```

The changed files are still only those in plan section 4 (condition 5).

#### Plan 5.3, re-run on `e3006f2`

```
1. website$ bash ../.github/security/run-npm-audit.sh website    exit 0   Severity: moderate / 1 moderate severity vulnerability
                                                                         website: 0 finding(s) at the gate's level; 0 known, 0 new.
2. studio$  bash ../.github/security/run-npm-audit.sh studio     exit 0   found 0 vulnerabilities
                                                                         studio: 0 finding(s) at the gate's level; 0 known, 0 new.
3. api$ dotnet restore DigitalHub.slnx                           exit 0
   api$ bash ../.github/security/run-dotnet-audit.sh             exit 0   no vulnerable packages: DigitalHub.Api, DigitalHub.Api.Tests,
                                                                         DigitalHub.ContentImport
                                                                         dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.
4. website JSON: vulnerabilities {"info":0,"low":0,"moderate":1,"high":0,"critical":0,"total":1}
                 dependencies {"prod":20,"dev":152,"optional":112,"peer":32,"peerOptional":0,"total":209}; keys ["fast-uri"]
5. website$ bash ../.github/security/run-npm-audit.sh other      exit 1   run-npm-audit.sh app must be website or studio
6. Historical proof: as above, no setting, exit 1 with the six Highs.
```

### NOT RUN

These are unchanged from round 1:

- **CI on the pull request: NOT RUN.** The branch is not pushed, and condition
  1 still applies.
- **The rebase onto merged GAP-01 and the re-run of 5.2 and 5.3: NOT RUN.**
  GAP-01 has not merged. This is still owed, and the re-run now includes the
  T-2 reproduction above.
- **actionlint on `security.yml`: NOT RUN.** GAP-08 has not merged.

### Coverage table changes

| Item | Status | Evidence (round 2) |
|---|---|---|
| C-1 The npm gate audits development packages (full tree) in both apps | Done (on `57da65b`; re-run owed after rebase) | Round 1 evidence, plus:<br>• `e3006f2`: the script refuses any non-empty `npm config get omit`.<br>• N12 is red on `7628a49` and green on `e3006f2`; it covers `NODE_ENV=production`, `NPM_CONFIG_OMIT=dev`, `npm_config_production=true` and `.npmrc omit=dev`.<br>• Gate 2's reproduction now exits 1 on all four settings, and the `NODE_ENV: production` workflow mutation now fails both npm jobs. |
| C-6 Golden copies change in the same commit | Done | `e3006f2` changes `run-npm-audit.sh` and `run-npm-audit.expected.sh` together, and their `diff` is empty. |
| C-7 Red tests committed before the fix | Done | Round 1, plus `7628a49` (red: 75 / 74 / 1) before `e3006f2`. |

Every other row is as in round 1.

### Follow-ups added

- **T-1:** a sturdier N11, which records the arguments in `spawnedGates` and
  asserts that the real gate was never spawned for `npm` or `dotnet`. Goes to
  GAP-21.
- **T-3:** the register parser should skip fences indented by up to three
  spaces and `<!-- ... -->` blocks, with a red-first test. Goes to the change
  that lands `docs/deferred-items.md`.

Status: READY FOR TEST
