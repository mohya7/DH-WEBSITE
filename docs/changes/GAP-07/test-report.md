# Test report: GAP-07

## Round 1

Tester, 1 November 2026. Commit tested: `6e4eea9` (`change/GAP-07` head; fix at
`3b1b9c6`), on top of `change/GAP-01` at `57da65b` (not merged). Detached
checkout `/home/user/wt-GAP-07-test`, removed when done. Node v22.23.4,
.NET SDK 10.0.114. `git rev-parse --is-shallow-repository` = `false`; no fetch
was run. No database touched, no server started, no port used. I did not build
this change.

Read: `plan.md`, `plan-review.md`, `plan-approval.md` (7 conditions),
`implementation.md`, and from the reference copy `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md`, `docs/changes/README.md`,
`docs/deferred-items.md`. Scratch evidence is under
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap07-test/`
and `.../scratchpad/t-*.txt` (not committed).

Experiments that needed a changed file (spawn variants in `gate.test.mjs`, an
expired entry in `known-findings.json`) were made only in the detached
checkout and reverted; `git status --short` was empty afterwards.

### 1. Red, then green

```
$ git checkout --detach 881a1ae; node --test .github/security/gate.test.mjs      exit 1
not ok 64 - the npm audit script audits the full tree, development packages included      (N1)
not ok 66 - an expired npm allow-list entry fails while its advisory is still reported   (N3)  expected: 1 actual: 0
not ok 67 - an expired npm allow-list entry fails after its advisory is gone              (N4)  expected: 1 actual: 0
not ok 68 - an expired NuGet allow-list entry fails                                       (N5)  expected: 1 actual: 0
not ok 69 - an entry is valid through its expiry day and expired the day after            (N6)  parseRegister is not a function
not ok 70 - ... without a D-NNN, with a malformed one, or citing one the register ...     (N7)  parseRegister is not a function
not ok 71 - ... without an expiry, with a malformed or impossible date, or ...            (N8)  parseRegister is not a function
not ok 72 - an allow-list entry fails closed when docs/deferred-items.md is missing       (N9)  expected: 1 actual: 0
not ok 73 - every npm and NuGet entry in known-findings.json cites a D-NNN ...            (N10) allowListShapeProblems is not a function
not ok 74 - the self-test does not depend on the real npm and NuGet allow-list            (N11) expected: 1 actual: 0
# tests 74  # pass 64  # fail 10

$ 8902d05   exit 1   # tests 74  # pass 64  # fail 10   (same ten names)
$ 3b1b9c6   exit 0   # tests 74  # pass 74  # fail 0
$ 6e4eea9   exit 0   # tests 74  # pass 74  # fail 0
```

74 / 64 / 10 with exactly N1 and N3 to N11 failing, each for the reason in
plan 5.1. The file loads on the red commit (failures are per test, not a link
error), so condition 3 (F-7) holds. N2 (test 65) passes throughout, as planned.

### 2. Commit 8902d05 only narrows N11's pattern

`git show 8902d05 --stat`: one file, `gate.test.mjs`, 4 insertions and 2
deletions, all inside N11. The substring `spawnSync(process.execPath, [gate`
becomes the regex `spawnSync\(process\.execPath, \[gate\b`, plus a positive
assertion that the regex matches `spawnSync(process.execPath, [gate, ...args]`.
`git diff 8902d05 3b1b9c6 --stat` shows no change to `gate.test.mjs`, so the
fix commit did not touch the tests.

The only text the old pattern matched that the new one does not is an
identifier that starts with `gate` (for example the helper's own `[gateFile`).
I appended dead-code spawn variants to the test file one at a time and ran N11
(`node --test --test-name-pattern="does not depend on the real npm"`):

| Variant (never called) | N11 |
|---|---|
| `spawnSync(process.execPath, [gate, "npm", "x.json", "studio"])` | fails, exit 1: "the real gate is spawned directly" |
| `spawnSync(process.execPath, [gate])` | fails, exit 1 |
| `runGate( gate, [...])` (extra space) | passes, exit 0 |
| `runGate(path.join(here, "gate.mjs"), [...])` | passes, exit 0 |
| `spawnSync("node", [gate, ...])` | passes, exit 0 |
| `const g2 = gate; runGate(g2, [...])` | passes, exit 0 |
| `spawnSync(process.execPath,[gate, "npm"])` (no space) | passes, exit 0 |

The direct-spawn form is caught, so 8902d05 does not loosen the check. None of
the variants that pass would have been caught by the old pattern either. They
are recorded as finding T-1.

### 3. F-8: every spawn of the real gate goes through run()

Read `gate.test.mjs` at `6e4eea9`. Every child process it starts:

- `runGate()` (line 30), the only `spawnSync` of a gate. Its callers are `run()`
  (line 100 `cleanGate` for npm and dotnet, line 101 `gate` otherwise),
  `runFixture()` (`fixtureGate`), N9 (`noRegisterGate`) and N11
  (`expiredRealGate`). `runGate(gate, ...)` appears once in the file, inside
  `run()`, after the npm/dotnet guard.
- `loadConsumedFields()` (line 569) imports the real `gate.mjs` with
  `--input-type=module -e`. `main()` runs only when `process.argv[1]` is the
  gate file (gate.mjs line 590), so this import never runs the gate.
- Line 1394 spawns the redactor, not the gate.
- In-process imports of the real gate (line 10, and the `await import` calls in
  the field test, N6 to N8 and N10) only load exports; `main()` does not run.

No path in the current file spawns the real gate for npm or dotnet. The static
half of N11 would not catch some future spellings (T-1).

Behavioural check: with the real `known-findings.json` given an expired
`npm.studio` entry and an expired `dotnet` entry (detached copy only):

```
$ node --test .github/security/gate.test.mjs        exit 0   # tests 74  # pass 74  # fail 0
studio$ RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh studio     exit 1
  ::error title=Allow-list entry (studio)::GHSA-real-expired cites D-100, but docs/deferred-items.md does not exist
  ::error title=Allow-list entry (studio)::GHSA-real-expired cites D-100, which expired on 2026-10-31; ...
api$ RUNNER_TEMP=... bash ../.github/security/run-dotnet-audit.sh            exit 1   (same two errors for D-101)
```

So an expired real entry fails the npm and NuGet jobs and does not fail the
self-test (and so does not skip gitleaks and Semgrep through `needs:`).

### 4. P-6: no gate weakened

```
$ cmp run-npm-audit.sh run-npm-audit.expected.sh                     exit 0
$ cmp run-dotnet-audit.sh run-dotnet-audit.expected.sh               exit 0
$ cmp .github/workflows/security.yml .github/security/security.expected.yml   exit 0
$ grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml   no match
  (grep over .github/ finds only ci.yml 273, 305, 377, unchanged, and gate.test.mjs fixtures)
$ grep -n -- "--omit\|audit-level" .github/security/run-npm-audit.sh
  13: npm audit --audit-level=high || true
  14: npm audit --audit-level=high --json > "$RUNNER_TEMP/audit.json" || true
$ git diff --stat 57da65b 6e4eea9 -- '*package-lock.json' '*package.json' '*.csproj' '*.slnx' '*.props' \
    .github/security/known-findings.json .github/security/fail-on-rules.json \
    .github/security/run-dotnet-audit.sh .github/security/run-dotnet-audit.expected.sh .github/workflows/ci.yml
  (empty)
$ git diff 57da65b 6e4eea9 -- .github/workflows/security.yml   only lines starting with "#" change
$ grep -n -E "process\.env|argv|Date\(" .github/security/gate.mjs
  122 argv (kind, file, label); 289 isRealDate; 403 today = new Date().toISOString().slice(0, 10)
```

No environment variable, argument or file sets the date or skips the rule.

**Trying to defeat the expiry rule and the register check.** A harness
(`.../scratchpad/gap07-test/harness/atk.mjs`) builds a repository per case
with a byte copy of the head `gate.mjs` and `fail-on-rules.json`, the real
`known-findings.json` with one `npm.studio` entry, and a register, then runs
`node gate.mjs npm <clean studio audit.json> studio`. Today is 2026-11-01 UTC.

| Case | Exit | Result |
|---|---|---|
| Expires 2026-10-31 (yesterday) | 1 | "expired on 2026-10-31" |
| Expires 2026-11-01 (today) | 0 | valid through the day |
| Expires today, `TZ=Pacific/Kiritimati` (local date already 2 Nov) | 0 | UTC only |
| Expires yesterday, `TZ=Etc/GMT+12` (local date still 1 Nov) | 1 | UTC only |
| Expired, with `EXPIRES_OVERRIDE`, `TODAY`, `GATE_DATE`, `SOURCE_DATE_EPOCH=0`, `BLOCKING_FROM` set | 1 | no override |
| Expired, extra argument `--today=2000-01-01` | 1 | ignored |
| Expired entry, register says 2099-01-01 | 1 | mismatch and expired |
| Entry 2099-01-01, register says 2026-10-31 | 1 | mismatch |
| Only entry inside a ` ``` ` fence / a `~~~` fence / a ` ```` ` fence holding ` ``` ` | 1 | "not in docs/deferred-items.md" |
| Unclosed fence before the entry | 1 | fails closed |
| Heading twice | 1 | "appears more than once" |
| Heading twice, one inside a fence | 0 | not a duplicate (as planned) |
| Two `- Expires:` lines (same date), or a second under a `###` subheading | 1 | "has no ... line" |
| `- Expires: 2026-11-01 (extended)` / `* Expires:` | 1 | fails closed |
| `## D-100:title` (no space) / BOM before the heading | 1 | fails closed |
| CRLF register, valid | 0 | |
| Two allow-list entries, one valid, one expired | 1 | expired one named |
| `expires` with a time part / `2026-02-29` | 1 | not a real date |
| `deferred` = `d-100` / `["D-100"]` / missing; `expires` missing | 1 | named |
| Register missing | 1 | "does not exist" |
| `docs/deferred-items.md` is a directory | 1 | `EISDIR` thrown, fails closed |
| **Only entry inside a fence indented by 3 spaces** | **0** | accepted (T-3) |
| **Only entry inside an HTML comment** | **0** | accepted (T-3) |
| Expires 9999-12-31, register the same | 0 | no maximum horizon; none is required by S-7 or the register (observation only) |

The expiry day's edges, with `Date` mocked through `node --import` and the
same fixture (entry and register expire 2026-11-01):

```
2026-11-01T00:00:00.000Z  TZ=Asia/Tokyo exit 0   TZ=America/Los_Angeles exit 0
2026-11-01T23:59:59.999Z  TZ=Asia/Tokyo exit 0   TZ=America/Los_Angeles exit 0
2026-11-02T00:00:00.000Z  TZ=Asia/Tokyo exit 1   TZ=America/Los_Angeles exit 1   "expired on 2026-11-01"
```

The reference register (`ref/docs/deferred-items.md`, template inside a fence,
"No entries yet") parses to no entries and no duplicates.

### 5. The jobs as CI runs them (plan 5.3)

```
1. website$ RUNNER_TEMP=<s>/rt-website bash ../.github/security/run-npm-audit.sh website   exit 0
   fast-uri ... Severity: moderate (4 advisories); 1 moderate severity vulnerability
   website: 0 finding(s) at the gate's level; 0 known, 0 new.
2. studio$  RUNNER_TEMP=<s>/rt-studio bash ../.github/security/run-npm-audit.sh studio     exit 0
   found 0 vulnerabilities
   studio: 0 finding(s) at the gate's level; 0 known, 0 new.
3. api$ dotnet restore DigitalHub.slnx                                                     exit 0
   api$ RUNNER_TEMP=<s>/rt-api bash ../.github/security/run-dotnet-audit.sh                exit 0
   DigitalHub.Api, DigitalHub.Api.Tests, DigitalHub.ContentImport: no vulnerable packages
   dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.
4. website JSON: vulnerabilities {"moderate":1,"high":0,"critical":0,"total":1}
                 dependencies {"prod":20,"dev":152,...,"total":209}; keys ["fast-uri"]
   studio JSON:  vulnerabilities total 0; dependencies {"prod":135,"dev":173,...,"total":312}
5. website$ bash ../.github/security/run-npm-audit.sh other                                exit 1
   run-npm-audit.sh app must be website or studio
6. Historical proof: <s>/hist/studio holds 6470fac:studio/package.json and package-lock.json,
   <s>/hist/.github/security is a copy of the head's .github/security/.
   hist/studio$ RUNNER_TEMP=<s>/hist/rt bash ../.github/security/run-npm-audit.sh studio    exit 1
   5 vulnerabilities (2 moderate, 3 high)
   ::error title=New finding (studio)::high source-map-js GHSA-68fv-2mgg-jv7q
   ::error title=New finding (studio)::high undici GHSA-xjj6-f33q-929c / GHSA-4w7w-5xrc-9h26 /
                                              GHSA-2m5v-pch6-74hx / GHSA-qrxm-fqhp-jwvm
   ::error title=New finding (studio)::high vite GHSA-587h-7wmj-h5pm
   studio: 6 finding(s) at the gate's level; 0 known, 6 new.
   Same lockfile, old flags: npm audit --omit=dev --audit-level=high --json | gate   exit 0
   studio: 0 finding(s) at the gate's level; 0 known, 0 new.
```

Plain `npm audit --audit-level=high` (full tree): website exit 0, studio
exit 0.

### 6. Other security checks

- No new or changed route, login or permission: the role matrix, host checks,
  unknown fields, body size and error shape are N/A.
- Secrets: `git diff 57da65b 6e4eea9` searched for password, secret, token,
  api key, private key, `ghp_`, `AKIA`. Only code identifiers (`token` in N1's
  flag check) and prose matched. No secret in the diff or in any output above.
- Semgrep and gitleaks: NOT RUN, neither is installed. Covered by the
  `semgrep`, `gitleaks-pr` and `gitleaks-history` jobs in `security.yml`.

### NOT RUN

- `dotnet test -c Release` (api), `npm test`, `typecheck`, `build`,
  `design:check`, `compare:sections` (website), `npm test`, `build`,
  `test:e2e` (studio): NOT RUN. The change touches only `.github/security/`,
  the `security.yml` header comment and `docs/changes/GAP-07/`; no file these
  suites build or read changed (protected-file diff above is empty). Covered by
  the CI workflow jobs `api`, `website` and `studio` on the pull request (plan
  5.4).
- CI evidence on the pull request (plan 5.4): NOT RUN. Not pushed; the pull
  request waits on GAP-01 (condition 1).
- Re-run on the rebased head (condition 1): NOT RUN; still owed by the
  developer after GAP-01 merges, and this report must then get a new round.
- actionlint: NOT RUN (not installed; GAP-08 not merged). Only comment lines
  in `security.yml` changed.

### Findings

No Blocker or Major.

**T-1 (Minor). N11's static scan can miss other spellings of a direct spawn of
the real gate.** Steps: append any of `runGate( gate, ["npm", ...])`,
`runGate(path.join(here, "gate.mjs"), ["npm", ...])`, `spawnSync("node", [gate,
...])` or `const g2 = gate; runGate(g2, ...)` to `gate.test.mjs`; run N11.
Expected: N11 fails. Actual: exit 0. None exists in the file today (section 3),
and the tech lead accepted F-8 as written, so this does not block. A sturdier
check: record the arguments in `spawnedGates` and have N11 (the last test)
assert that the real gate was never spawned with `npm` or `dotnet` during the
whole run.

**T-2 (Minor). The full-tree property can be undone outside the guarded files.**
Steps: in the historical Studio folder (section 5, step 6), add `studio/.npmrc`
with `omit=dev`, or run with `NPM_CONFIG_OMIT=dev`; run
`run-npm-audit.sh studio`. Expected: the six Highs fail the job. Actual:
`found 0 vulnerabilities`, exit 0. N1 and the golden copies check only the
script's flags. Neither `.npmrc` exists today. A committed `omit=dev` would
also break `npm ci` for the build and tests in the CI workflow, and an `env:`
change to `security.yml` must also change its golden copy, so both would be
visible. Suggested follow-up: have the gate fail when an npm report's
`metadata.dependencies.dev` is 0, or have N1 assert that no `.npmrc` in
`website/` or `studio/` sets `omit`, `only` or `production`.

**T-3 (Minor). The register parser accepts entries that a Markdown reader does
not show.** Steps: register whose only `## D-100: ...` and `- Expires:` lines
sit inside a fence indented by 1 to 3 spaces, or inside `<!-- ... -->`; entry
cites D-100. Expected: "not in docs/deferred-items.md", as for an unindented
fence. Actual: exit 0. Expiry and the matching date are still enforced, and
only the owner adds entries, so the rule is not defeated; the register can
simply hold an entry that renders invisibly. Suggested fix: treat a fence
opened by up to three spaces as a fence, and skip HTML comment blocks.

### Track checklist (G1, Waves 1 to 3)

- One gate per pull request: yes, G-11 only.
- Replaces existing protection, blocks at once: no `*_BLOCKING_FROM`, no
  `continue-on-error` in `security.yml`.
- Committed canary fixtures it must reject: the expired D-900 and D-904
  fixtures (N3 to N5, N11), the `--omit=dev` copy (N1), the
  `--include-transitive`-less copy (N2); all green, and N1, N3 to N5 and N11
  were red before the fix.
- Pins: N/A, no `uses:` line changed.
- Baselines only shrink: `known-findings.json` unchanged.

### Coverage table rows verified

| Item | Status | Tester evidence |
|---|---|---|
| C-1 full tree, both apps | Verified | Script lines 13 and 14 have no `--omit`; dev counts 152 and 173; `fast-uri` (dev) reported; historical lockfile exit 1 with six Highs, old flags exit 0 |
| C-2 NuGet whole graph | Verified | N2 green; three projects listed |
| C-3 expired entry fails, self-test proof | Verified | N3 to N6 and N11 red then green; harness and mocked-clock runs above |
| C-4 D-NNN in register with same expiry | Verified | N7 to N10 green; harness cases above; T-3 noted |
| C-5 blocks at once | Verified | grep above |
| C-6 golden copies | Verified | three `cmp` exit 0 |
| C-7 red before fix | Verified | 881a1ae and 8902d05 64 / 10; 3b1b9c6 74 / 74 |
| C-8 0 High or Critical today | Verified on `57da65b` base | Section 5 steps 1 to 3; re-run owed after rebase |
| C-9 standards rows | Moved (not tested) | As recorded in `implementation.md` |
| C-10 gitleaks and Semgrep entries | Open (O-20) | Not touched: `known-findings.json` unchanged |
| C-11 self-test independent of real entries | Verified | Expired real entries: self-test 74 / 74, studio and dotnet jobs exit 1; F-8 read in section 3 |

Round 1 result: approved, Minors T-1, T-2, T-3. Gate 2 (`delivery-approval.md`
round 1) sent T-2 back as required; superseded by round 2.

## Round 2

Tester, 1 November 2026. Commit tested: `3b758b2` (`change/GAP-07` head):
`7628a49` red test N12, `e3006f2` fix, `3b758b2` implementation round 2. Same
base, `57da65b` (GAP-01, not merged). Detached checkout
`/home/user/wt-GAP-07-test`, removed when done; mutation experiments were made
only there and reverted (`git status --short` empty). Node v22.23.4, npm
10.9.9, `/bin/sh` is dash (N12 runs the script with `sh`; CI runs it with
`bash`, which my reproductions use). Not shallow, no fetch, no database, no
port. Scratch: `.../scratchpad/gap07-test/hist2/`,
`.../scratchpad/gap07-test/harness/omit.sh`, `.../scratchpad/r2-*.txt`.

Read `delivery-approval.md` round 1 (T-2 required; T-1 and T-3 optional) and
`implementation.md` round 2.

### 1. What changed

`git diff 6e4eea9 3b758b2 --stat`: `gate.test.mjs` +67 (N12 only),
`run-npm-audit.sh` +12, `run-npm-audit.expected.sh` +12, `implementation.md`.
`gate.mjs` and `security.yml` are unchanged since round 1 (diff 0 bytes). The
script now runs `omit=$(npm config get omit)` before both `npm audit` lines,
exits 1 with `npm config get omit failed` if that command fails, and exits 1
with `npm is set to omit "<value>" ...` if the value is not empty. No switch
turns it off.

### 2. Red, then green

```
7628a49   node --test .github/security/gate.test.mjs   exit 1   # tests 75  # pass 74  # fail 1
          not ok 75 - the npm audit script refuses an npm configuration that omits packages
            error: NODE_ENV=production / studio: 0 finding(s) at the gate's level; 0 known, 0 new.
e3006f2   exit 0   # tests 75  # pass 75  # fail 0
3b758b2   exit 0   # tests 75  # pass 75  # fail 0
```

75 / 74 / 1 then 75 / 75, as stated.

### 3. Trying to make npm omit development packages

Folder `hist2/studio` holds `6470fac:studio/package.json` and
`package-lock.json` (six Highs, all in development packages); `hist2/.github/security`
is a byte copy of the head's (script `cmp` exit 0). For each setting
`omit.sh` records: what `npm config get omit` prints (stdout only) and its exit
code; how many High packages a raw `npm audit --audit-level=high --json`
reports under that setting (3 = full tree, 0 = development omitted); and the
result of `bash ../.github/security/run-npm-audit.sh studio`.

| Setting | `config get omit` | Raw highs | Script | Outcome |
|---|---|---|---|---|
| none | "" (0) | 3 | exit 1, 6 new | full audit |
| `NODE_ENV=production` | "dev" | 0 | exit 1, refused | caught |
| `NODE_ENV=prod` | "" | 3 | exit 1, 6 new | npm does not omit |
| `NPM_CONFIG_OMIT=dev` / `npm_config_omit=dev` | "dev" | 0 | exit 1, refused | caught |
| `npm_config_omit=optional` | "optional" | 3 | exit 1, refused | fails closed |
| `npm_config_production=true` | "dev" | 0 | exit 1, refused | caught |
| `npm_config_only=prod` / `=production` | "dev" | 0 | exit 1, refused | caught |
| `npm_config_dev=false`, `npm_config_also=` | "" | 3 | exit 1, 6 new | npm does not omit |
| `NPM_CONFIG_USERCONFIG` file with `omit=dev` | "dev" | 0 | exit 1, refused | caught |
| `NPM_CONFIG_USERCONFIG` file with `only=prod` | "dev" | 0 | exit 1, refused | caught |
| `NPM_CONFIG_GLOBALCONFIG` file with `omit=dev` | "dev" | 0 | exit 1, refused | caught |
| `npm_config_prefix` whose `etc/npmrc` has `omit=dev` | "dev" | 0 | exit 1, refused | caught |
| `HOME` with `.npmrc` `omit=dev` | "" | 3 | exit 1, 6 new | npm did not read it here (user config path is set by the environment); no omission |
| `studio/.npmrc`: `omit=dev`, `omit[]=dev`, `only=prod`, `production=true` | "dev" | 0 | exit 1, refused | caught |
| `.npmrc` with `omit=dev` one folder above the app | "" | 3 | exit 1, 6 new | npm does not read it |
| `npm_config_include=dev` with `NODE_ENV=production` | "" | 3 | exit 1, 6 new | full audit |
| `npm_config_json=true` (alone / with `omit=dev`) | "" / "dev" | 3 / 0 | 6 new / refused | output not wrapped in quotes; caught |
| `npm_config_loglevel=silly` (alone / with `omit=dev`) | "" / "dev" | 3 / 0 | 6 new / refused | logs go to stderr, not into the value |
| `npm_config_parseable=true` with `omit=dev` | "dev" | 0 | exit 1, refused | caught |
| `npm_config_workspace=nope` (makes `npm config get` fail) | "" (exit 1) | error | exit 1, `npm config get omit failed` | fails closed |
| `npm_config_package_lock=false` | "" | error | exit 1, gate: `npm audit report field error is set` | fails closed |
| `NPM_CONFIG_USERCONFIG` pointing at a folder | "" | 3 | exit 1, 6 new | full audit |

In every case where npm actually omitted development packages (raw highs 0),
the script refused before `npm audit`. I found no setting that narrows the
audit and gets past the check. `npm_config_production=true` prints
`npm warn config production ...` on stderr only; the captured value is still
`dev`.

On the real tree (head): `website$ NODE_ENV=production RUNNER_TEMP=... bash
../.github/security/run-npm-audit.sh website` exits 1 with
`::error title=npm audit (website)::npm is set to omit "dev"; ...`; without it,
exit 0.

### 4. Can N12's stub npm mask a real failure?

The stub answers only when its first argument is `audit` (marker on stderr, a
clean report for `--json`, exit 0) and `exec`s the real npm for everything
else, including `npm config get`. The real npm is found with `command -v npm`
before the stub is put on `PATH`. The refusal cases assert exit 1, the refusal
text, and that the stub was never reached; the clean case asserts exit 0, the
stub reached exactly twice, the fixture-clean gate's summary line and no
`::error`. The stub never answers `npm config get`, so it cannot hide the
value the check reads; if the runner's own config omitted packages, the clean
case would fail, not pass. The stub replaces only the audit result, which N12
does not claim to test (5.3 and the historical run do).

Mutation runs of N12 alone (`--test-name-pattern`), script and golden copy
changed together, reverted afterwards:

| Mutation of `run-npm-audit.sh` | N12 |
|---|---|
| Refusal prints but does not `exit 1` | fails |
| Check only `NODE_ENV=production` | fails |
| Whole check deleted | fails |
| `[ -n "$omit" ]` narrowed to `[ "$omit" = dev ]` | passes |
| `npm config get omit failed` branch exits 0 | passes |

The two surviving mutants are weaker implementations that do not exist; the
shipped script refuses any non-empty value and fails closed when
`npm config get` fails (section 3, `npm_config_workspace=nope`). Recorded as
T-4 (Minor).

### 5. Plan 5.2 and 5.3 on `3b758b2`

```
$ cmp run-npm-audit.sh run-npm-audit.expected.sh                  exit 0
$ cmp run-dotnet-audit.sh run-dotnet-audit.expected.sh            exit 0
$ cmp .github/workflows/security.yml .github/security/security.expected.yml   exit 0
$ grep -n -- "--omit" .github/security/run-npm-audit.sh           exit 1, no match
$ grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml   exit 1, no match
$ git diff --stat 57da65b HEAD -- . ':!docs'
  gate.mjs 152, gate.test.mjs 428, run-npm-audit.expected.sh 16, run-npm-audit.sh 16,
  security.expected.yml 5, security.yml 5   (plan section 4 files only)
$ git diff 57da65b HEAD -- '*package-lock.json' '*package.json' '*.csproj' known-findings.json
    fail-on-rules.json run-dotnet-audit.sh run-dotnet-audit.expected.sh ci.yml | wc -c      0

1. website$ RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh website   exit 0
   website: 0 finding(s) at the gate's level; 0 known, 0 new.
2. studio$  ... studio                                                         exit 0
   found 0 vulnerabilities / studio: 0 finding(s) at the gate's level; 0 known, 0 new.
3. api$ dotnet restore DigitalHub.slnx exit 0; run-dotnet-audit.sh             exit 0
   Api, Api.Tests, ContentImport: no vulnerable packages; dotnet: 0 finding(s) ... 0 known, 0 new.
4. website JSON: {"moderate":1,"high":0,"critical":0,"total":1}, dev 152, keys ["fast-uri"]
   studio JSON:  total 0, dev 173
5. run-npm-audit.sh other                                                      exit 1, "app must be website or studio"
6. Historical 6470fac Studio, head script, no setting:                         exit 1
   5 vulnerabilities (2 moderate, 3 high)
   high source-map-js GHSA-68fv-2mgg-jv7q; undici GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26,
   GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm; vite GHSA-587h-7wmj-h5pm
   studio: 6 finding(s) at the gate's level; 0 known, 6 new.
```

Secrets: the round 2 diff under `.github` has no match for password, secret,
token, api key, private key, `ghp_` or `AKIA`.

### NOT RUN

Unchanged from round 1: Semgrep and gitleaks (not installed; `semgrep`,
`gitleaks-pr`, `gitleaks-history` jobs); the api, website and studio suites (no
file they read changed; CI jobs `api`, `website`, `studio`); CI on the pull
request (not pushed); actionlint (GAP-08 not merged); the re-run after the
rebase onto merged GAP-01 (condition 1, still owed, and it now includes the
T-2 reproduction).

### Findings

No Blocker or Major. T-2 is resolved.

**T-4 (Minor). N12 does not pin two properties of the check.** Steps: in
`run-npm-audit.sh` and its golden copy, change `[ -n "$omit" ]` to
`[ "$omit" = dev ]`, or make the `npm config get omit failed` branch `exit 0`;
run N12. Expected: N12 fails. Actual: it passes. The shipped script is correct
on both (section 3). Suggested: add an `npm_config_omit=optional` case (or
`omit=dev` plus `omit=optional` in an `.npmrc`) and a case that makes
`npm config get` fail, such as `npm_config_workspace=nope`.

**T-1 and T-3 (Minor)** stand as in round 1; the developer recorded them as
follow-ups (GAP-21, and the change that lands `docs/deferred-items.md`), which
gate 2 allows.

### Coverage table rows verified (round 2)

| Item | Status | Tester evidence |
|---|---|---|
| C-1 full tree, both apps | Verified | Round 1, plus section 3: every setting that makes npm omit development packages is refused; historical lockfile exit 1 with six Highs |
| C-6 golden copies | Verified | `e3006f2` changes the script and its golden copy together; three `cmp` exit 0 |
| C-7 red before fix | Verified | `7628a49` 75 / 74 / 1 before `e3006f2` 75 / 75 |
| C-8 0 High or Critical today | Verified on `57da65b` base | Section 5 steps 1 to 3; re-run owed after rebase |
| Other rows | Unchanged from round 1 | `gate.mjs` and `security.yml` unchanged since `6e4eea9` |

Round 2 result: approved, T-2 resolved, Minors T-1, T-3, T-4. Superseded by
round 3.

## Round 3

Tester, 4 November 2026. Commit tested: `66ec60d` (`change/GAP-07` head after
the rebase), on base `5c38406` (`origin/rebuild/dotnet-platform`, the GAP-01
squash merge #39, above `f96d719`, the runner pin #38). Detached checkout
`/home/user/wt-GAP-07-test`, removed when done. Not shallow (`false`); no
fetch of any kind; nothing pushed; no database or port. Node v22.23.4, npm
10.9.9, .NET SDK 10.0.114. Scratch:
`.../scratchpad/gap07-test/r3/`. Rounds 1 and 2 name commits by their pre-rebase
SHAs; the developer's round 3 table maps them (for example `3b1b9c6` is now
`0139205` and `e3006f2` is `490b560`).

### 1. The rebase changed no code

```
$ git merge-base --is-ancestor 5c38406 HEAD        exit 0
$ git range-diff 57da65b..3b758b2 5c38406..ff62b2b
 1: 4a85138 = 1: edcb9e7 GAP-07: Plan
 2: 881a1ae = 2: e1889a5 ... failing tests for the full-tree audit ...
 3: 8902d05 = 3: 289b7a5 ... N11's static scan
 4: 3b1b9c6 = 4: 0139205 ... Audit the full dependency tree ...
 5: 6e4eea9 = 5: 2949520 ... Record the implementation
 6: 7628a49 = 6: c58ce5b ... failing test for npm configuration ...
 7: e3006f2 = 7: 490b560 ... Refuse an npm configuration ...
 8: 3b758b2 = 8: 51b2397 ... Record round 2 ...
 -: ------- > 9: ff62b2b GAP-07: Test report and approvals
$ diff <(git diff 57da65b..3b758b2 -- .github) <(git diff 5c38406..66ec60d -- .github)   exit 0, identical
$ git diff --stat ff62b2b 66ec60d          implementation.md only (+172)
$ git show ff62b2b --stat                  delivery-approval.md, test-report.md only
$ git diff --stat 57da65b 5c38406          .github/workflows/ci.yml and docs/changes/ci-runner-pin/ only
$ git diff --stat 57da65b 5c38406 -- .github/security .github/workflows/security.yml website studio api   (empty)
```

Every commit is `=` (patch unchanged), the one new commit holds only the two
records, and the base brings in nothing the gate or the audits read.

### 2. Self-test and plan 5.2 on `66ec60d`

```
$ node --test .github/security/gate.test.mjs                       exit 0   # tests 75  # pass 75  # fail 0
$ cmp run-npm-audit.sh run-npm-audit.expected.sh                  exit 0
$ cmp run-dotnet-audit.sh run-dotnet-audit.expected.sh            exit 0
$ cmp .github/workflows/security.yml .github/security/security.expected.yml   exit 0
$ grep -n -- "--omit" .github/security/run-npm-audit.sh           exit 1, no match
$ grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml   exit 1, no match
$ git diff --stat 5c38406 HEAD -- . ':!docs'
  gate.mjs 152, gate.test.mjs 428, run-npm-audit.expected.sh 16, run-npm-audit.sh 16,
  security.expected.yml 5, security.yml 5   (plan section 4 files only)
$ git diff 5c38406 HEAD -- '*package-lock.json' '*package.json' '*.csproj' known-findings.json
    fail-on-rules.json run-dotnet-audit.sh run-dotnet-audit.expected.sh ci.yml | wc -c      0
```

### 3. The three audits as CI runs them, on the new base (plan 5.3)

```
1. website$ RUNNER_TEMP=<r3>/rt-w bash ../.github/security/run-npm-audit.sh website   exit 0
   website: 0 finding(s) at the gate's level; 0 known, 0 new.
   JSON: {"info":0,"low":0,"moderate":1,"high":0,"critical":0,"total":1}, dev 152, keys ["fast-uri"]
2. studio$  RUNNER_TEMP=<r3>/rt-s bash ../.github/security/run-npm-audit.sh studio    exit 0
   found 0 vulnerabilities / studio: 0 finding(s) at the gate's level; 0 known, 0 new.
   JSON: total 0, dev 173
3. api$ dotnet restore DigitalHub.slnx                                                 exit 0
   api$ RUNNER_TEMP=<r3>/rt-a bash ../.github/security/run-dotnet-audit.sh             exit 0
   DigitalHub.Api, DigitalHub.Api.Tests, DigitalHub.ContentImport: no vulnerable packages
   dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.
   dotnet.json: 0 vulnerable package entries (top-level and transitive)
4. website$ npm audit --audit-level=high   exit 0;   studio$ npm audit --audit-level=high   exit 0
5. website$ bash ../.github/security/run-npm-audit.sh other                            exit 1
   run-npm-audit.sh app must be website or studio
```

**No High or Critical finding on the new base** in the website, the Studio
(full tree, development packages included) or the NuGet graph. The stop rule
(condition 1, R-1) does not apply; no allow-list entry exists or was added.

### 4. T-2 refusals and the historical lockfile, on the rebased scripts

`<r3>/hist/studio` holds `6470fac:studio/package.json` and `package-lock.json`;
`<r3>/hist/.github/security` is a byte copy of `66ec60d`'s (script `cmp`
exit 0). Same harness as round 2 (`harness/omit.sh`).

| Setting | `config get omit` | Raw highs | Script |
|---|---|---|---|
| none | "" | 3 | exit 1, 6 new (below) |
| `NODE_ENV=production` | "dev" | 0 | exit 1, refused |
| `NPM_CONFIG_OMIT=dev` | "dev" | 0 | exit 1, refused |
| `npm_config_production=true` | "dev" | 0 | exit 1, refused |
| `npm_config_only=prod` | "dev" | 0 | exit 1, refused |
| `NPM_CONFIG_USERCONFIG` file with `omit=dev` | "dev" | 0 | exit 1, refused |
| `studio/.npmrc` `omit=dev` | "dev" | 0 | exit 1, refused |
| `npm_config_workspace=nope` (`npm config get` fails) | "" (exit 1) | error | exit 1, `npm config get omit failed` |

```
hist/studio$ RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh studio        exit 1
  5 vulnerabilities (2 moderate, 3 high)
  ::error title=New finding (studio)::high source-map-js GHSA-68fv-2mgg-jv7q
  ::error title=New finding (studio)::high undici GHSA-xjj6-f33q-929c / GHSA-4w7w-5xrc-9h26 /
                                             GHSA-2m5v-pch6-74hx / GHSA-qrxm-fqhp-jwvm
  ::error title=New finding (studio)::high vite GHSA-587h-7wmj-h5pm
  studio: 6 finding(s) at the gate's level; 0 known, 6 new.
website$ NODE_ENV=production RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh website   exit 1
  ::error title=npm audit (website)::npm is set to omit "dev"; the audit must cover the full tree, ...
```

### NOT RUN

- CI on the pull request (plan 5.4): NOT RUN, not pushed. Now that GAP-01 has
  merged the pull request may be opened; the Security workflow jobs
  `Security gate self-test`, `npm audit (website)`, `npm audit (studio)` and
  `NuGet vulnerable packages (api)` cover it, and their run must be quoted.
- Semgrep and gitleaks (not installed; `semgrep`, `gitleaks-pr`,
  `gitleaks-history` jobs); the api, website and studio suites (no file they
  read changed; CI jobs `api`, `website`, `studio`); actionlint (GAP-08 not
  merged): unchanged from rounds 1 and 2.

### Findings

No new finding; no Blocker or Major. T-1, T-3 and T-4 (Minor) stand as
recorded, as follow-ups.

### Coverage table rows verified (round 3)

| Item | Status | Tester evidence |
|---|---|---|
| C-1 full tree, both apps | Verified on `5c38406` | Section 3 (dev 152 and 173, `fast-uri` reported); section 4 refusals and six historical Highs |
| C-2 NuGet whole graph | Verified on `5c38406` | Section 3 step 3 |
| C-6 golden copies | Verified | Three `cmp` exit 0 |
| C-8 0 High or Critical today | Verified on `5c38406` | Section 3; condition 1's re-run is discharged |
| Other rows | Unchanged | Range-diff all `=`; `.github` diff byte-identical to round 2's |

Verdict: APPROVED

## Round 4: Semgrep after the time-limit fix (Done when 5 of semgrep-timeout)

Date: 11 November 2026. Head `277a636`, which merges base `3e1fc47`
(`rebuild/dotnet-platform` after #50, semgrep-timeout) into GAP-07. The merged
`run-semgrep.sh` carries `--timeout 30`.

Before #50, this pull request's Semgrep job failed on a per-rule Timeout on
`.github/security/gate.test.mjs` (job 128779169900).

The job "Semgrep (ERROR fails, WARNING reported)" was run three times on
`277a636`, in Security run 42930747579:

| Attempt | Job | Scan step | Result |
|---|---|---|---|
| 1 | 130228758510 | 38 s | success |
| 2 | 130231638344 | 35 s | success |
| 3 | 130246509916 | 44 s | success |

A success means `gate.mjs semgrep` accepted the report, so no Timeout error
was present (a Timeout still fails the gate). Every other Security job and the
CI run 42930747621 were green on attempt 1.

Local, on `277a636`: `node --test .github/security/gate.test.mjs` gives 86
tests, 86 pass, 0 fail.

Verdict: APPROVED (Done when 5 met).
