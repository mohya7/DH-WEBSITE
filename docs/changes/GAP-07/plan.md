# Plan: GAP-07 — audit the full dependency tree; every dependency allow-list entry cites a D-NNN and expires

Architect, round 2, 1 November 2026 (round 1 the same day; this round answers
`plan-review.md` round 1, F-1 to F-5, see section 12). Change branch `change/GAP-07`, worktree
`/home/user/wt-GAP-07`, cut from `change/GAP-01` at `57da65b` (no tracking),
because this change builds on GAP-01's upgrades and on GAP-01 emptying the
website entries in `.github/security/known-findings.json`. **GAP-01 is not
merged yet** (section 10, R-3).

**Where the governing documents were read.** `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`,
`docs/quality/baseline-2026-10-27.md`, `docs/deferred-items.md`,
`docs/changes/README.md`, `docs/adr/0001-split-public-forms-api.md`,
`.claude/agents/architect.md` and `ENVIRONMENT.md` are **not on this branch**
(owner decision O-18, pending). They were read from the read-only reference
copy the orchestrator supplied. `docs/changes/GAP-01/` (on this branch) was
read as the example record set. ADR 0001 and the admin audit do not apply
(not G2 or G3). Consequences: `docs/deferred-items.md` does not exist on the
branch, so no D-NNN can be recorded here (R-1); and the standard's status rows
cannot be updated here unless the governing docs land first (section 4).

## 1. Item

- **Closes:** GAP-07's Wave 1 Done-when in full (quoted below; it is about
  the dependency gate only), the gate half of baseline finding F4
  ("Development dependencies are not audited. The gate runs `npm audit
  --omit=dev`"), and the machine side of standard section 6 step 4f for the
  dependency sections of `known-findings.json`.
- **Closes only in part:** GAP-07's register target ("each allow-list entry
  cites a D-NNN exception and expires") is closed for the `npm` and `dotnet`
  sections. For the `gitleaks` and `semgrep` sections it stays open and
  **waits on O-20** (section 9): this plan does not assume which way the
  owner answers.
- **Track:** G1, Wave 1 ("make CI honest", 3 to 16 November).
- **Register row (quoted):** "GAP-07 | Security | G-11; finding 7 |
  Production packages audited only; allow-list has no expiry | Full tree
  audited; each allow-list entry cites a D-NNN exception and expires | High |
  Low | Wave 1".
- **Wave 1 item (quoted):** "Audit the full dependency tree; every allow-list
  entry cites a D-NNN and expires | GAP-07 | Agent".
- **Done when (quoted):** "The gate includes development packages, fails on an
  expired entry (proven by a self-test), and blocks at once, since it replaces
  the existing audit".
- **Rule:** G-11 "Dependency vulnerabilities, every lockfile, full tree
  including dev | 0 unlisted or expired | `run-npm-audit.sh`,
  `run-dotnet-audit.sh`, `known-findings.json` | Partial: production tree
  only; no expiry; fails today (baseline F1, F3, F4)".
- **Reading of "each allow-list entry".** GAP-07 is the G-11 dependency gate,
  so this plan applies the D-NNN-and-expiry rule to the `npm` and `dotnet`
  sections of `known-findings.json`. Standard section 6 says of the whole file
  "From the next change to it, each entry cites a `D-NNN` id ... and carries
  an expiry". This change therefore does **not** edit `known-findings.json`
  (section 3.2), and whether the 2 gitleaks and 7 Semgrep entries need the
  same is asked as O-20 (section 9).
- **Owner's instruction:** "Start waves 0 & 1 and update me with each gap
  done" (Mohamed Elbadry, 2026-11-01, project thread), as quoted in
  `docs/changes/GAP-01/plan.md` section 1.

## 2. Current state

All commands run on `change/GAP-07` = `57da65b`, 1 November 2026, Node
v22.23.4, npm 10.9.9, .NET SDK 10.0.114. `npm audit` reads
`package-lock.json` only; nothing was installed. `git rev-parse
--is-shallow-repository` = `false`.

### 2.1 The gate today

`.github/security/run-npm-audit.sh` (13 to 15), production tree only:

```
13 npm audit --omit=dev --audit-level=high || true
14 npm audit --omit=dev --audit-level=high --json > "$RUNNER_TEMP/audit.json" || true
15 node ../.github/security/gate.mjs npm "$RUNNER_TEMP/audit.json" "$app"
```

`.github/security/run-dotnet-audit.sh` (5 to 7):

```
5 dotnet list DigitalHub.slnx package --vulnerable --include-transitive
6 dotnet list DigitalHub.slnx package --vulnerable --include-transitive --format json > "$RUNNER_TEMP/dotnet.json"
7 node ../.github/security/gate.mjs dotnet "$RUNNER_TEMP/dotnet.json"
```

Both are byte-identical to their golden copies (`diff run-npm-audit.sh
run-npm-audit.expected.sh` and the dotnet pair: no output). `gate.test.mjs`
`pinnedScripts` (lines 958 to 961) and `shellPinProblems` fail the self-test
if a script and its `.expected.sh` differ.

`.github/security/gate.mjs`:

- line 39 loads `known-findings.json` beside it; lines 421 to 425 build the
  known set for npm and dotnet from `entry.id` only. **No other entry field is
  read: no expiry, no D-NNN.** `finish()` (259 to 269) fails only when a
  finding is not listed; a listed id that is no longer found is only printed
  ("Known but no longer found").
- The gate itself does not distinguish production from development
  packages; the full-tree property lives only in the script's flags.

`.github/security/known-findings.json` on this branch: `npm.website: []`,
`npm.studio: []`, `dotnet: []` (GAP-01 removed the three website entries);
`gitleaks`: 2 entries; `semgrep`: 7 entries. Each entry has `owner` and
`reason` (self-test "every known finding has an owner and a reason",
`gate.test.mjs` 1257). None has an expiry or a D-NNN.

`.github/workflows/security.yml`: job `gate-self-test` runs `node --test
.github/security/gate.test.mjs`; jobs `npm-audit` (matrix website, studio)
and `dotnet-vulnerable` `needs: gate-self-test` and run the two scripts. No
`continue-on-error` and no `*_BLOCKING_FROM` anywhere in the file: the
existing audit already blocks. Header comment lines 5 to 8 say "Each job fails
only on a NEW High or Critical finding (or any new secret)". The file is
pinned byte for byte by `.github/security/security.expected.yml`, and every
`run:` line by `securityRunAllowList` (`gate.test.mjs` 920 to 931).

`gate.mjs` has no golden copy; its own self-tests guard it. `gate.test.mjs`
builds a byte copy of the gate in a temp folder (`fixtureGateDir`, lines 36 to
47) with a fixture allow-list of three `npm.website` entries; the tests "a
known-only npm report passes", "a new High advisory fails" and "a new Critical
advisory fails" (243 to 263) use it.

Self-test baseline:

```
$ node --test .github/security/gate.test.mjs
# tests 63
# pass 63
# fail 0
exit 0
```

### 2.2 What a full-tree audit reports today (on top of GAP-01)

```
website$ npm audit                          exit 1
  fast-uri  3.0.0 - 3.1.8   Severity: moderate
  (GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp)
  fix available via `npm audit fix`   node_modules/fast-uri
  1 moderate severity vulnerability
website$ npm audit --audit-level=high       exit 0
website$ npm audit --omit=dev               exit 0   found 0 vulnerabilities
studio$  npm audit                          exit 0   found 0 vulnerabilities
studio$  npm audit --audit-level=high       exit 0
studio$  npm audit --omit=dev               exit 0   found 0 vulnerabilities
```

`metadata` from `npm audit --audit-level=high --json` (full tree):

| App | vulnerabilities | dependencies |
|---|---|---|
| website | `{"info":0,"low":0,"moderate":1,"high":0,"critical":0,"total":1}` | `{"prod":20,"dev":152,"optional":112,"peer":32,"total":209}` |
| studio | `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}` | `{"prod":135,"dev":173,"optional":76,"peer":0,"total":312}` |

Fed to the current gate (as the new script would):

```
website: 0 finding(s) at the gate's level; 0 known, 0 new.   gate exit 0
studio: 0 finding(s) at the gate's level; 0 known, 0 new.    gate exit 0
```

NuGet (`api$ dotnet restore DigitalHub.slnx`, which writes only the
git-ignored `obj/`, then):

```
api$ dotnet list DigitalHub.slnx package --vulnerable --include-transitive    exit 0
The given project `DigitalHub.Api` has no vulnerable packages given the current sources.
The given project `DigitalHub.Api.Tests` has no vulnerable packages given the current sources.
The given project `DigitalHub.ContentImport` has no vulnerable packages given the current sources.
dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.   gate exit 0
```

The NuGet job is already full tree: the solution lists the API, the **test
project** and the importer; `--include-transitive` covers transitive packages
and project references (`DigitalHub.Images`, referenced by the API, shows
`SkiaSharp` 3.116.1 and its native assets as transitive packages of
`DigitalHub.Api`); development-only references such as
`Microsoft.EntityFrameworkCore.Design` and `.Tools` (`PrivateAssets=all`) are
listed as top-level packages. For NuGet, GAP-07 adds only the allow-list
entry rule.

**Conclusion:** switching to the full tree adds no High or Critical finding
today. No exception is needed and no D-NNN is planned. The only full-tree
finding is `fast-uri` (moderate, website, dev), below the gate's level
(section 4, out of scope).

### 2.3 Proof that the production-only gate missed real findings

The Studio's lockfile before GAP-01 (`6470fac`, the base of GAP-01), copied
to the scratchpad and audited there:

```
studio@6470fac$ npm audit --omit=dev --audit-level=high --json; gate npm studio
studio: 0 finding(s) at the gate's level; 0 known, 0 new.          gate exit 0
studio@6470fac$ npm audit --audit-level=high --json; gate npm studio
::error title=New finding (studio)::high source-map-js GHSA-68fv-2mgg-jv7q: ...
::error title=New finding (studio)::high undici GHSA-xjj6-f33q-929c: ...
::error title=New finding (studio)::high undici GHSA-4w7w-5xrc-9h26: ...
::error title=New finding (studio)::high undici GHSA-2m5v-pch6-74hx: ...
::error title=New finding (studio)::high undici GHSA-qrxm-fqhp-jwvm: ...
::error title=New finding (studio)::high vite GHSA-587h-7wmj-h5pm: ...
studio: 6 finding(s) at the gate's level; 0 known, 6 new.          gate exit 1
```

Six High advisories in development packages passed the existing gate. The
developer repeats this check after the change (5.3, check 6).

### 2.4 Lockfiles and manifests in scope

`git ls-files` finds two npm lockfiles (`website/`, `studio/`). `packages/blocks`
and `packages/theme` have a `package.json` with no dependencies (a React peer)
and no lockfile; they are installed through the apps. NuGet: `api/DigitalHub.slnx`.
`api/dotnet-tools.json` and `api/.config/dotnet-tools.json` pin the local tool
`dotnet-ef` 10.0.12; `dotnet list package` does not read tool manifests
(section 4, out of scope).

### 2.5 Other changes that touch the same files

- GAP-08 (actionlint) states `.github/security/` and `security.yml` stay
  unchanged. GAP-04 only runs the self-test. PR #38
  (`origin/change/ci-runner-pin`) changes only `ci.yml`.
- GAP-09 (pin actions by SHA, not planned yet) and Dependabot
  `github-actions` bumps (GAP-02) will edit `security.yml` and
  `security.expected.yml`. This change edits the header comment of both
  (section 4). `AGENTS.md`: "Parallel work must change different files"
  (R-2).

## 3. Design

### 3.1 Approach

1. **Full tree.** In `run-npm-audit.sh` lines 13 and 14, remove `--omit=dev`.
   Nothing else in the script changes. `run-npm-audit.expected.sh` gets the
   identical edit in the same commit. `--audit-level=high` stays: the gate's
   level is High and Critical, as the job name says.
2. **NuGet unchanged.** `run-dotnet-audit.sh` already audits the whole graph
   (2.2). A new self-test pins that property (N2), so removing
   `--include-transitive` or `--vulnerable` fails even if the golden copy is
   edited in the same commit.
3. **Allow-list entry rule, npm and dotnet sections.** Each entry in
   `known.npm.website`, `known.npm.studio` and `known.dotnet` must carry two
   new fields beside the existing `id`, `owner`, `reason`:
   - `"deferred": "D-NNN"` (regex `^D-\d{3}$`), the register entry in
     `docs/deferred-items.md` that records the owner's decision;
   - `"expires": "YYYY-MM-DD"`, a real calendar date (`2026-02-30` is
     rejected: parse as `YYYY-MM-DDT00:00:00Z` and require
     `toISOString().slice(0, 10)` to give the same string).
4. **Register cross-check.** When at least one entry is listed for the
   section being gated, `gate.mjs` reads
   `path.join(here, "..", "..", "docs", "deferred-items.md")` and parses the
   register: each `## D-NNN: <title>` heading starts an entry, whose
   `- Expires: YYYY-MM-DD` line is its expiry (the form in the register's
   template). Lines inside fenced code blocks (from a line starting with
   three backticks or three tildes to the matching closing fence) are
   skipped, so the template block in the register, or any future example
   with a real-looking id, is never counted as an entry or a duplicate. The entry fails when the register file is missing, when it has
   no heading for the cited D-NNN, when that heading appears twice, when the
   entry has no `Expires` line in that form, or when the register's date
   differs from the entry's `expires`. With an empty section, the register is
   not read, so the gate runs on this branch, where the register does not
   exist yet.
5. **Expiry.** `today` is `new Date().toISOString().slice(0, 10)` (UTC, the
   runner's clock). An entry is valid **through** its expiry day and expired
   when `today > expires` (string comparison of ISO dates). An expired entry
   fails the job **whether or not its advisory is still reported**: an
   expired exception must be renewed by the owner or removed, and a stale one
   must not linger. No environment variable or argument can change `today`,
   so nothing in a workflow can loosen it; tests prove the boundary through
   the exported pure function (N6) and the job through fixture dates
   `2000-01-01` (expired) and `2999-12-31` (valid).
6. **Where it is enforced.** In `gate.mjs` `main()`, for `kind === "npm"`
   (entries `known.npm[label] ?? []`) and `kind === "dotnet"`
   (`known.dotnet ?? []`). Each problem prints
   `::error title=Allow-list entry (<label or kind>)::<id> <problem>`, for
   example `GHSA-x cites D-012, which expired on 2026-11-30; fix the finding
   or record a new owner decision`, and the job exits 1. Because `finish()`
   sets `process.exitCode` from new findings alone, the developer sets
   `process.exitCode = 1` for entry problems **after** `finish()` runs, so
   both kinds of failure are printed and neither hides the other.
7. **Exports for the tests.** Three pure functions (no file reads, no
   clock):
   - `parseRegister(text)` returns a `Map` of D-NNN to its `Expires` string
     (or a problem list for duplicates), skipping fenced blocks (step 4);
   - `allowListShapeProblems(entries)` returns a problem for each entry whose
     `deferred` does not match `^D-\d{3}$` or whose `expires` is not a real
     `YYYY-MM-DD` date. It reads neither the register nor a date: **shape
     only**. N10 uses it;
   - `allowListProblems(entries, today, register)` returns
     `allowListShapeProblems(entries)` plus the register and expiry problems
     (`register` is the parsed map, or `null` when the file is missing).

   `main()` does the file read and the clock. They stay outside `validateNpm` and `validateDotnet`,
   so the field-read tracker ("every field the gate reads is listed",
   `gate.test.mjs` 1565) still sees only report fields.
8. **Not at module load.** The checks run in `main()` only. `gate.test.mjs`
   imports `gate.mjs` at the top; reading the register at load time would
   make every import depend on it.
9. **Blocks at once.** No `*_BLOCKING_FROM` date: this replaces the existing
   blocking audit (track checklist, Waves 1 to 3). The jobs keep no
   `continue-on-error`.
10. **Self-test checks shape, the jobs check expiry.** `gate-self-test` is
    `needs:` of every other Security job, so an expiry failure there would
    skip both gitleaks scans and Semgrep as well. Two parts make sure the
    self-test never depends on the real entries' dates or the register:
    - The real-file self-test (N10) calls `allowListShapeProblems` only.
    - **No self-test runs the real gate for `npm` or `dotnet`** (round 2,
      F-1). Today these tests spawn the real gate, which reads the real
      `known-findings.json`; the ones that expect exit 0 would turn red the
      day a real `npm.studio` or `dotnet` entry expires:
      - "a clean report passes" (`gate.test.mjs` 179: `npm studio` line 180,
        `dotnet` lines 183 and 198, `nuget-framework-no-packages`);
      - "an npm via array of only dependency names passes" (303, `studio`);
      - "a moderate NuGet advisory passes and a High one fails" (325 and 327);
      - "dotnet mutations of every consumed field" (524 to 557: `runTool` is
        `run` for dotnet; the baseline, every accepted mutation and every
        optional removal expect exit 0).

      The tests that run the real gate for `npm` or `dotnet` and expect exit
      1 (lines 85, 95, 104, 111, 117, 120, 139, 150, 163, 171, 174, 210, 216,
      231, 606, 628, 654, 677, 696, 705, 711) would stay red for the right
      reason only by luck of order, so they move too. In the test file,
      `run(args)` routes `npm` and `dotnet` to a **clean fixture gate**: a
      byte copy of `gate.mjs` and `fail-on-rules.json` in
      `<tmp>/fixture-clean/.github/security/`, whose `known-findings.json` is
      the real one with `npm.website`, `npm.studio` and `dotnet` set to `[]`
      (no `docs/`; with empty sections the register is not read).
      `gitleaks` and `semgrep` keep the real gate and real allow-list, as
      today. "the fixture gate is the real gate" is extended to every fixture
      copy (`fixture-repo`, `fixture-clean`, `fixture-no-register`).
    - **Why this is not a weakening (P-6).** Those tests check report
      validation, severity filtering and exit codes, not allow-list content;
      the code they run is byte-identical to the real gate (checked); the
      real npm and dotnet sections are still checked for shape by N10 in the
      self-test, and for expiry and register by the npm and NuGet jobs on
      every run, which is where the Done-when puts it. The only thing removed
      is a hidden dependency on the calendar.
    - **Proof (N11).** A test builds `<tmp>/fixture-expired-real/`, a byte
      copy of the real gate with the real allow-list plus an expired
      `npm.studio` entry (D-900, `2000-01-01`) and an expired `dotnet` entry
      (D-904, `2000-01-01`) and a matching register. It asserts that this
      gate fails a clean `npm studio` and a clean `dotnet` report (exit 1,
      "expired on 2000-01-01"), while `run()` with the same reports exits 0,
      and that the `run()` routing sends `npm` and `dotnet` to
      `fixture-clean` and nothing else. A static part scans
      `gate.test.mjs` and fails if the real `gate` path is spawned anywhere
      except inside `run()` (no other `runGate(gate,` and no
      `spawnSync(process.execPath, [gate`), and if `run()` reaches the real
      gate for `npm` or `dotnet`.
11. **Comments say what the gate now does.** `gate.mjs` header (lines 1 to 3
    and the npm and dotnet usage lines 29 and 30) and `security.yml` header
    lines 5 to 8 are reworded: the npm and NuGet jobs audit the full tree and
    also fail on an allow-list entry that is expired, has no D-NNN, or
    disagrees with `docs/deferred-items.md`. `security.expected.yml` gets the
    identical edit in the same commit. No `run:` line changes, so
    `securityRunAllowList` is unchanged.

### 3.2 Alternatives rejected

| Alternative | Why not |
|---|---|
| Keep the expiry only in `known-findings.json`, no register cross-check | Then "cites a D-NNN exception" is a string nobody checks; an entry could cite a decision that does not exist, or carry a later expiry than the owner gave. The cross-check makes the owner's register the source of truth. |
| Keep the expiry only in the register (JSON carries only `deferred`) | The JSON entry would no longer say when it expires to someone reading it; the register is a free-text Markdown file. Both carry it and the gate requires them equal. |
| A date override (`SECURITY_GATE_TODAY` or an argument) for testing | It is a loosening lever inside the gate. The pure function and far past/future fixture dates test the same logic without one. |
| Fail the self-test job on an expired real entry (or keep the existing tests on the real gate, which does the same by accident) | It would skip both gitleaks scans and Semgrep through `needs:`, and make the self-test depend on the calendar (3.1 step 10, N11). |
| Warn N days before expiry | Not in the Done-when; the owner's register already names the follow-up and date. Can be added later without changing the rule. |
| Apply the rule to the gitleaks and Semgrep sections now | Those 9 entries would each need an owner decision (P-7) that does not exist, which would block this change, and it is a second rule in the same pull request (B-8). Asked as O-20. |
| Edit the `description` in `known-findings.json` to describe the new fields | Standard section 6: "From the next change to it, each entry cites a `D-NNN` id ... and carries an expiry". Editing the file now would bring all 9 gitleaks and Semgrep entries under that rule before O-20 is answered. The rule is documented in `gate.mjs` and `security.yml` instead; the description stays true for the sections it already describes and is updated by the change that answers O-20. |
| Raise the npm level to moderate (would fail on `fast-uri`) | G-11 and S-7 name no lower level than the job's High and Critical; lowering the level is a behaviour change the owner has not asked for. Not weakening: the level is unchanged. |
| Leave `security.yml` untouched to avoid overlap with GAP-09 | Its pinned header would then state that the jobs fail "only on a NEW High or Critical finding", which becomes false. The overlap is handled by sequencing (R-2). |
| Audit `dotnet-ef` from the tool manifests | `dotnet list package` does not read them and there is no NuGet audit command for tools; it needs a new mechanism (a second gate, B-8). Listed as a follow-up. |

## 4. Scope

### Files to change

| File | Change |
|---|---|
| `.github/security/gate.test.mjs` | **First commit (red):** new tests N1 to N11 (section 5.1); `run()` routes `npm` and `dotnet` to the clean fixture gate, and the tests listed in 3.1 step 10 run through it unchanged in their assertions. The fixture gate moves to a fixture repository layout `<tmp>/fixture-repo/.github/security/` (gate.mjs, fail-on-rules.json, known-findings.json) with `<tmp>/fixture-repo/docs/deferred-items.md`, so the copied gate finds the register where the real one does. Fixture entries: `npm.website` keeps its three entries, each gaining `deferred` D-901, D-902, D-903 and `expires` `2999-12-31`; `npm.studio` gets one entry citing D-900, `expires` `2000-01-01`; `dotnet` gets one entry citing D-904, `expires` `2000-01-01`. The fixture register holds D-900 to D-904 with matching `- Expires:` lines. A second fixture repository without `docs/` (`fixture-no-register`) serves N9; `fixture-clean` (3.1 step 10) serves `run()`; `fixture-expired-real` serves N11. Test "the fixture gate is the real gate" compares every copy byte for byte. |
| `.github/security/gate.mjs` | **Second commit (fix):** steps 3 to 8 and 11 of 3.1: `parseRegister`, `allowListShapeProblems`, `allowListProblems` (all exported), the register read and the UTC date in `main()` for `npm` and `dotnet`, the exit code after `finish()`, the header and usage comments. `consumedFields` unchanged. |
| `.github/security/run-npm-audit.sh` | Second commit: drop `--omit=dev` on lines 13 and 14. |
| `.github/security/run-npm-audit.expected.sh` | Same edit, same commit. |
| `.github/workflows/security.yml` | Second commit: header comment lines 5 to 8 only (3.1 step 11). No job, step, `run:`, `uses:` or `name:` changes. |
| `.github/security/security.expected.yml` | Same edit, same commit. |
| `docs/changes/GAP-07/plan.md` | This plan (architect). Other records by their roles. |
| `ENGINEERING_STANDARDS.md` (conditional) | **Only if** the file is on `origin/rebuild/dotnet-platform` when the developer rebases (O-18 answered and merged): G-11 status to "Partial: full tree in both npm lockfiles and the whole NuGet solution graph; an expired, uncited or mismatched allow-list entry fails the job (gate self-tests N1 to N11). The `dotnet-ef` local tool manifests (`api/dotnet-tools.json`, `api/.config/dotnet-tools.json`) are not audited: follow-up, no id yet, named in `implementation.md`"; S-7 status to "Partial: dependency entries cite a D-NNN and expire, enforced by the gate; gitleaks and Semgrep entries wait on O-20"; section 6's `known-findings.json` line to say the same. If the file is not on the base, the developer does not create it and records the row in `implementation.md` as moved (coverage row C-9). |

### Out of scope (left alone on purpose)

- `.github/security/known-findings.json`: not edited (3.2). No entry is
  added: the full tree has no High or Critical finding today (2.2).
- `docs/deferred-items.md`: not created here. No exception is planned, and
  only the owner creates an entry (P-7).
- The gitleaks and Semgrep sections and their gate code paths (O-20).
- `fast-uri` (moderate, website, development): below the gate's level; `npm
  audit fix` is available; left to the Dependabot triage (GAP-02).
- `run-dotnet-audit.sh` and its golden copy: already full graph (2.2).
- `dotnet-ef` in the tool manifests: not covered by `dotnet list package`;
  follow-up, to be listed in `implementation.md` for the register.
- `uses:` pins, `runs-on`, Node and .NET versions in `security.yml` (GAP-09,
  PR #38); actionlint (GAP-08); canaries for other gates (GAP-21).
- Lockfiles, `package.json`, `.csproj`: unchanged (B-7: nothing upgraded).
- `ci.yml`, `codeql.yml`, `dependabot.yml`, website, Studio and API source.

## 5. Test plan

### 5.1 Failing tests first (committed before the fix, B-6)

All in `.github/security/gate.test.mjs`. "Red today" means the test fails on
`57da65b`'s `gate.mjs` and scripts. Tests that need `allowListProblems` or
`parseRegister` load them with `await import(pathToFileURL(gate).href)` inside
the test, not as a top-level named import: a missing named export in a static
ESM import fails the whole file at link time instead of failing one test.

| Id | Test name | Asserts | Red today? |
|---|---|---|---|
| N1 | the npm audit script audits the full tree, development packages included | `run-npm-audit.sh` has exactly two lines that invoke `npm audit`; neither contains `--omit`, `--production`, `--only` or `--include`; a copy with `--omit=dev` put back is reported by the same check | **Yes**: lines 13 and 14 carry `--omit=dev` |
| N2 | the NuGet audit script lists vulnerable packages across the whole graph | both `dotnet list` lines in `run-dotnet-audit.sh` name `DigitalHub.slnx`, `--vulnerable` and `--include-transitive`; a copy without `--include-transitive` is reported | No: a canary that keeps the property (GAP-21) |
| N3 | an expired npm allow-list entry fails while its advisory is still reported | fixture gate, label `studio`, report holding the D-900 advisory: exit 1, output names the advisory id, `D-900` and `expired on 2000-01-01` | **Yes**: today exit 0, "1 known, 0 new" |
| N4 | an expired npm allow-list entry fails after its advisory is gone | fixture gate, label `studio`, clean report: exit 1, same message | **Yes**: today exit 0 |
| N5 | an expired NuGet allow-list entry fails | fixture gate, `dotnet`, clean NuGet report: exit 1, names the D-904 entry and `expired on 2000-01-01` | **Yes** |
| N6 | an entry is valid through its expiry day and expired the day after | `allowListProblems([entry expires 2026-11-30], "2026-11-30", register)` returns `[]`; with `"2026-12-01"` returns one problem naming the expiry | **Yes**: no export |
| N7 | an allow-list entry without a D-NNN, with a malformed one, or citing one the register does not hold fails | `allowListProblems` returns a problem for: `deferred` missing; `"D-12"`; `"d-012"`; `"D-0123"`; `"D-999"` absent from the register; `parseRegister` reports a D-NNN heading that appears twice; and a register whose only `## D-900: ...` heading and `- Expires:` line sit inside a fenced block yields no D-900 (so an entry citing it fails as "not in the register"), while a real `## D-900` outside the fence plus the same fenced one is not a duplicate | **Yes** |
| N8 | an allow-list entry without an expiry, with a malformed or impossible date, or with a date that differs from the register fails | problems for: `expires` missing; `"30-11-2026"`; `"2026-02-30"`; register entry with no `- Expires:` line; register `2026-12-31` vs entry `2026-11-30` | **Yes** |
| N9 | an allow-list entry fails closed when docs/deferred-items.md is missing | fixture repository without `docs/`, a valid-looking `npm.website` entry, clean report: exit 1, output names `docs/deferred-items.md` | **Yes** |
| N10 | every npm and NuGet entry in known-findings.json cites a D-NNN and carries a valid expiry | `allowListShapeProblems` over the real `npm.website`, `npm.studio` and `dotnet` returns `[]` (empty today); on a structured clone with one entry lacking `deferred` and one with `expires: "soon"` it returns exactly those two problems (and nothing about a register or a date, since it reads neither). Does not check that the date has not passed (3.1 step 10) | **Yes** (no export) |
| N11 | the self-test does not depend on the real npm and NuGet allow-list | as 3.1 step 10, "Proof (N11)": the expired-real copy fails clean `npm studio` and `dotnet` reports; `run()` with the same reports exits 0; routing and static scan as described | **Yes**: the old gate passes the expired-real copy (exit 0), so the first assertion fails |

Changed, not new: "a known-only npm report passes", "a new High advisory
fails" and "a new Critical advisory fails" keep their assertions (`3 known, 0
new`; `3 known, 1 new`) against the fixture entries that now carry valid
D-901 to D-903 entries. After the fix they prove that a valid entry still
passes and still does not hide a new advisory.

Red run, expected after commit 1:

```
node --test .github/security/gate.test.mjs     exit 1
# tests 74   pass 64   fail 10    (N1, N3 to N11 fail; N2 and the 63 existing pass, the moved ones through fixture-clean)
```

The developer quotes the actual counts and the failing names.

### 5.2 After the fix

```
node --test .github/security/gate.test.mjs                       exit 0, 74 pass, 0 fail
diff .github/security/run-npm-audit.sh .github/security/run-npm-audit.expected.sh        no output
diff .github/security/run-dotnet-audit.sh .github/security/run-dotnet-audit.expected.sh  no output
diff .github/workflows/security.yml .github/security/security.expected.yml               no output
grep -n -- "--omit" .github/security/run-npm-audit.sh                                    no match, exit 1
grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml              no match, exit 1
git diff --stat <base>..HEAD                    only the files in section 4
git diff <base>..HEAD -- '*package-lock.json' '*.csproj' .github/security/known-findings.json   empty
```

`<base>` is `57da65b` before the rebase, and the merged GAP-01 commit on
`origin/rebuild/dotnet-platform` after it.

### 5.3 The jobs as CI runs them (this container)

`RUNNER_TEMP` is a folder in the developer's scratchpad.

1. `cd website && RUNNER_TEMP=<tmp> bash ../.github/security/run-npm-audit.sh website`
   — the text run shows `fast-uri` moderate only; gate line
   `website: 0 finding(s) at the gate's level; 0 known, 0 new.`; exit 0.
2. Same for `studio` — `found 0 vulnerabilities`; exit 0.
3. `cd api && dotnet restore DigitalHub.slnx && RUNNER_TEMP=<tmp> bash ../.github/security/run-dotnet-audit.sh`
   — "no vulnerable packages" for the three projects; exit 0.
4. Confirm the script runs the full tree: the JSON from step 1 has
   `metadata.dependencies.dev` > 0 and its `vulnerabilities` contains
   `fast-uri` (a development package); with the old flags it did not.
5. Wrong argument still fails: `bash ../.github/security/run-npm-audit.sh other`
   — exit 1, "app must be website or studio".
6. Historical proof (2.3) repeated with the new script: in a scratch folder
   holding `git show 6470fac:studio/package.json` and
   `git show 6470fac:studio/package-lock.json`, laid out so that
   `../.github/security/gate.mjs` resolves to a copy of the branch's
   `.github/security/` — exit 1 with the six High advisories in `source-map-js`,
   `undici` and `vite`.

Nothing here touches a database or starts a server; no port is used.

### 5.4 CI evidence on the pull request

Security workflow, run id quoted: `Security gate self-test`, `npm audit
(website)`, `npm audit (studio)`, `NuGet vulnerable packages (api)` green on
the final head, and their logs show the full-tree text run. CI workflow
green (no file it reads changes). If GAP-08 has merged by then, `workflow-lint`
green on `security.yml`. The red commit's Security run (self-test failing on
N1, N3 to N11) is quoted as the red evidence if CI ran on it; otherwise the
local red run (5.1) is the evidence and the CI run is written NOT RUN with the
reason.

### 5.5 Track checklist (G1, Waves 1 to 3), from `docs/changes/README.md`

- [ ] One gate per pull request (B-8): the dependency gate (G-11) only.
- [ ] A gate that replaces existing protection blocks at once: no
  `*_BLOCKING_FROM`, no `continue-on-error` (5.2).
- [ ] Every gate has a committed canary fixture it must reject (GAP-21): the
  expired D-900 and D-904 fixtures (N3 to N5, N11), the `--omit=dev` copy (N1),
  the `--include-transitive`-less copy (N2).
- [ ] Actions pinned by SHA, image by digest, Node and .NET exact: N/A here.
  This change adds no action, image or version and changes no `uses:` line;
  GAP-09 owns the pins.
- [ ] Baselines only shrink: `known-findings.json` unchanged (no entry added).

### 5.6 Pull request body (B-9)

As in `docs/changes/GAP-01/plan.md` 5.6: the template from the governing-docs
branch, with this plan's sections mapped onto it. Box 4 (route guards) N/A.
Box 5 (coverage) cannot be ticked in full: no changed-line coverage gate yet
(GAP-18); the regression half is met by the red commit. Governance:
"`docs/deferred-items.md` updated for any exception" is N/A (no exception).

## 6. Security impact

- **Routes, policies, data, logins, secrets:** none. Only CI files change.
- **Dependencies:** none added, none upgraded, no lockfile changes.
- **Gate strength:** stricter. The npm jobs now see development packages, which
  the build machine runs (baseline F4; 2.3 shows six Highs the old gate
  passed). An allow-list entry can no longer hide a finding indefinitely, and
  it must point to a recorded owner decision.
- **New input read by the gate:** `docs/deferred-items.md`, a committed file
  in the same checkout; read only when an entry exists; a missing or
  malformed file fails (P-5). Its text is parsed line by line and never
  printed beyond the D-NNN and the date.
- **Clock:** UTC runner date; no override exists.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. That restores `--omit=dev` and the id-only allow-list.
No data or schema is involved.

## 9. Owner decisions needed

**None blocks this change.** One new question, and two existing dependencies.

- **O-20 (new; id taken after O-19, which GAP-13's plan uses; renumbered at
  commit if it collides).** Exact question: "Standard section 6 says every
  entry in `.github/security/known-findings.json` cites a D-NNN and carries
  an expiry. GAP-07 applies that to the npm and NuGet entries. Do the 2
  gitleaks and 7 Semgrep entries, all recorded as false positives with an
  owner and a reason, also need a D-NNN exception with your words and an
  expiry (a follow-up change, GAP-07b, with nine register entries you decide),
  or should section 6 be changed by an ADR to cover dependency exceptions
  only?" Recommendation: the first, because the rule as written covers every
  entry and a rule changes only through an ADR. Not answered; this plan does
  not assume an answer, and does not edit `known-findings.json` so that the
  question stays open without blocking GAP-07.
- **O-18 (existing, pending): the governing-docs pull request.** Until it
  merges, `docs/deferred-items.md` is not on the base, so no D-NNN can be
  recorded and any new High or Critical finding must be fixed, not excepted
  (R-1). It also decides whether the `ENGINEERING_STANDARDS.md` row update is
  done here or moved (section 4, C-9).
- **GAP-01 must merge first** (a sequencing dependency, not an owner
  decision): R-3.

## 10. Risks

| Id | Risk | Effect | How it is caught or handled |
|---|---|---|---|
| R-1 | A new High or Critical advisory is published for a development package before this merges | The PR's npm job turns red at once, by design | It must be fixed (an upgrade in its own change). An exception needs an owner decision and `docs/deferred-items.md`, which waits on O-18. The plan does not invent one. |
| R-2 | GAP-09 or a Dependabot `github-actions` bump edits `security.yml` and `security.expected.yml` in parallel | Two branches change the same files, against `AGENTS.md` | The orchestrator sequences them: GAP-09 starts after GAP-07 merges, or GAP-07 rebases onto it. The hunks differ (header comment vs `uses:` lines); the golden-copy self-test fails if either copy is left behind. |
| R-3 | GAP-07 is opened or merged before GAP-01 | The pull request would carry GAP-01's commits, and on the old base the full-tree audit fails (2.3) | Open the pull request only after GAP-01 merges; rebase onto `origin/rebuild/dotnet-platform` (B-3, no tracking, never a bare push) and rerun 5.2 and 5.3 on the rebased head. |
| R-4 | Date edge cases (time zone, last day, impossible dates) | An entry expires a day early or late, or a typo passes | UTC only; N6 tests the boundary day; N8 rejects malformed and impossible dates. |
| R-5 | The register's Markdown drifts from the template (`Expires: 30 Nov 2026`) | The gate cannot read the expiry | It fails closed and names the expected form (N8). |
| R-6 | The self-test depends on a real entry's expiry or the register, so an expiry skips every other scan | Both gitleaks scans and Semgrep skipped through `needs:` | Round 2 (F-1): no self-test runs the real gate for `npm` or `dotnet` (they go through `fixture-clean`); N10 is shape only; N11 proves it, behaviourally and by a static scan of the test file. |
| R-7 | The fixture gate stops being the real gate after the layout move | Fixture tests prove nothing | The existing byte-comparison test is kept and runs against the new layout. |
| R-8 | `npm audit` cannot reach the registry | No report | Unchanged: the gate fails on empty output or an `error` field (existing self-tests). |
| R-9 | No cap on how far ahead an expiry may be | A long exception | The owner sets the date in the register and the gate requires the JSON to match it; a cap would be a new rule for the owner. |

## 11. Coverage table

| Item | Source | Status | Evidence |
|---|---|---|---|
| C-1 The npm gate audits development packages (full tree) in both apps | GAP-07 Done-when; G-11; baseline F4 | Planned | |
| C-2 The NuGet gate covers the whole graph (tests, tools, transitive), pinned by a self-test | G-11 "every lockfile, full tree" | Planned | |
| C-3 The gate fails on an expired npm or NuGet allow-list entry, proven by a self-test | GAP-07 Done-when | Planned | |
| C-4 Each npm and NuGet allow-list entry must cite a D-NNN held in `docs/deferred-items.md`, with the same expiry | GAP-07 register target; standard section 6; S-7 | Planned | |
| C-5 The gate blocks at once (no `*_BLOCKING_FROM`, no `continue-on-error`) | GAP-07 Done-when; track checklist | Planned | |
| C-6 Each script change carries its golden-copy change in the same commit; `security.yml` matches `security.expected.yml` | `security.yml` header; P-6 | Planned | |
| C-7 Red tests committed before the fix | B-6, P-4 | Planned | |
| C-8 Full-tree audit today: 0 High or Critical in website, Studio and API; no exception needed | Refinement plan success measure; G-11 | Planned | |
| C-9 G-11 and S-7 status rows updated, or moved to the first change after O-18 with that named in `implementation.md` | Refinement plan ("each pull request that closes a rule updates" the status column) | Planned | |
| C-10 gitleaks and Semgrep entries: D-NNN and expiry | Standard section 6; GAP-07 register target | Open: waits on O-20 (GAP-07b if the entries need a D-NNN, an ADR if section 6 changes) | |
| C-11 The self-test does not depend on real npm or NuGet entry expiry or the register | Review F-1; 3.1 step 10 | Planned | |

## 12. Revision log

- Round 1, 1 November 2026: first version. No review yet.
- Round 2, 1 November 2026: answers `plan-review.md` round 1 (verdict CHANGES
  NEEDED).
  - **F-1 (Major), accepted; the reviewer's first option.** The reviewer is
    right: the existing tests at `gate.test.mjs` 179 to 199, 303, 325 to 327
    and the dotnet mutation test (524 to 557) run the real gate with the real
    allow-list and expect exit 0, so an expired real entry would have failed
    `gate-self-test` and skipped every other scan, contrary to R-6. Changed:
    3.1 step 10 now names every such test, and also the real-gate `npm` and
    `dotnet` tests that expect exit 1; `run()` routes `npm` and `dotnet` to a
    byte-copy `fixture-clean` gate whose `npm` and `dotnet` sections are empty;
    "the fixture gate is the real gate" covers every copy; the paragraph "Why
    this is not a weakening (P-6)" says why; new test N11 proves the property
    behaviourally (an expired real-position entry fails the copy, `run()` still
    passes) and statically (the real gate is spawned only from `run()`, never
    for `npm` or `dotnet`). 3.2 (fourth row), 4 (`gate.test.mjs` row), 5.1
    (N11, red run now 74 tests, 64 pass, 10 fail), 5.2 (74 pass), 5.4, 5.5,
    R-6 and new coverage row C-11 updated. I found no concrete reason against
    this option: the second (accepting that an expiry skips all scans) is
    what 3.2 rejects.
  - **F-2 (Minor), accepted.** New shape-only export
    `allowListShapeProblems(entries)` (3.1 step 7); `allowListProblems` builds
    on it. N10 calls it and asserts it says nothing about a register or a
    date. Section 4 lists all three exports.
  - **F-3 (Minor), accepted.** Section 1 now says the Wave 1 Done-when is
    closed in full and the register target only for the `npm` and `dotnet`
    sections, the gitleaks and Semgrep half waiting on O-20. C-10 reads
    "Open: waits on O-20 (GAP-07b if the entries need a D-NNN, an ADR if
    section 6 changes)". O-20 itself is unchanged and still unanswered.
  - **F-4 (Minor), accepted.** The conditional G-11 status is now "Partial"
    and names the residual: the `dotnet-ef` tool manifests are not audited,
    follow-up named in `implementation.md` (no id yet). I do not argue that a
    tool manifest is outside G-11.
  - **F-5 (Minor), accepted.** 3.1 step 4: the register parser skips fenced
    code blocks. N7 adds a fenced `## D-900` that is not counted and is not a
    duplicate of a real one.
