# Plan review: GAP-07

## Round 1

Plan-reviewer, 1 November 2026. Reviewed `docs/changes/GAP-07/plan.md`
(round 1, uncommitted) in `/home/user/wt-GAP-07` on `change/GAP-07` at
`57da65b` (cut from `change/GAP-01`, not merged yet). Governing documents read
from the read-only reference copy, since they are not on this branch (O-18):
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/changes/README.md`,
`docs/deferred-items.md`, `.claude/agents/plan-reviewer.md`. ADR 0001 and the
admin audit do not apply (G1). `docs/changes/GAP-01/` was read as the example
record set.

Every command below was run by the reviewer in this container (Node 22.23.4,
npm 10.9.9). Nothing in the repository was changed except this file; npm
reports and the historical lockfile went to the session scratchpad.
`git rev-parse --is-shallow-repository` = `false`; no fetch was run.

### Findings

#### F-1. Major: sections 3.1 step 10, 3.2 (fourth row), 10 (R-6). An expired real allow-list entry would still fail the self-test job and skip gitleaks and Semgrep: existing self-tests run the real gate with the real allow-list and expect exit 0

The plan's design rests on "Self-test checks shape, the jobs check expiry ...
Expiry fails only the npm or NuGet job that cites the entry", and R-6 says this
is "Designed out". That is true of N10 but not of the suite. Several existing
tests in `gate.test.mjs` call `run(...)`, which spawns the **real** gate,
which reads the **real** `known-findings.json`, for `npm studio` and `dotnet`,
and assert exit 0:

```
179 test("a clean report passes", () => {
180   const npm = run(["npm", write("clean-npm.json", cleanNpm), "studio"]);
181   assert.equal(npm.code, 0, npm.out);
183   const nuget = run(["dotnet", write("clean-nuget.json", cleanNuget)]);
184   assert.equal(nuget.code, 0, nuget.out);
```

Others of the same kind: line 199 (`nuget-framework-no-packages`), 304
(`npm-via-strings`, studio), 326 (`nuget-moderate`), and the
`dotnet mutations of every consumed field` test (lines 524 to 557:
`const runTool = tool === "npm" ? runFixture : run;`, so dotnet uses the real
gate, and its baseline and every accepted or optional mutation assert exit 0).

Under the plan, `main()` sets `process.exitCode = 1` for any npm or dotnet entry
problem after `finish()`, whatever the report holds (step 5: "fails the job
whether or not its advisory is still reported"). So the day a real
`npm.studio` or `dotnet` entry passes its expiry, or disagrees with the
register, these tests fail, `gate-self-test` fails, and every job that `needs:`
it (both npm jobs, NuGet, both gitleaks scans, Semgrep) is skipped. That is the
exact outcome the plan rejects in 3.2 and claims to have designed out. It also
makes the self-test suite depend on the calendar. Today the real sections are
empty, so the red/green counts in 5.1 and 5.2 hide it.

*Would satisfy me:* the plan names every existing test that runs the real gate
for `npm` or `dotnet` and expects exit 0, and says how each stops depending on
the real allow-list (for example a second byte-copy fixture gate whose
allow-list has empty `npm` and `dotnet` sections, with "the fixture gate is the
real gate" extended to it), stating why that is not a weakening (P-6: these
tests check report validation, not the allow-list). It adds a test that proves
the property, for example: a byte copy of the real test setup with an expired
`npm.studio` and `dotnet` entry in the real-position allow-list still passes
every non-allow-list test, or a static check that no test passes the real
`gate.mjs` an `npm`/`dotnet` run expecting exit 0. 5.1's red-run counts are
updated to match. Alternatively the plan may choose to let the self-test fail
on expiry, but then 3.1 step 10, the rejected alternative and R-6 must be
rewritten and the consequence (all scans skipped) accepted explicitly.

#### F-2. Minor: section 5.1 N10, section 3.1 step 7. The function N10 uses is not named

N10 is "Yes for the mutated half (no export)" and must not check the date. The
only exports planned are `parseRegister` and `allowListProblems(entries,
today, register)`; the latter checks expiry and the register, so it cannot be
what N10 calls without contradicting step 10 once real entries exist (and with
`register = null` on this branch every mutated entry would also report the
missing register, so the assertion would pass for the wrong reason). *Would
satisfy me:* name the shape-only export (or say N10 calls `allowListProblems`
with a fixed far-past `today` and a register built from the entries, and why
that is shape-only), and add it to step 7.

#### F-3. Minor: sections 1, 9 (O-20) and 11 (C-10). The coverage table assumes O-20's answer

O-20 itself is framed correctly as an owner question: it quotes the rule, gives
two real options, carries a recommendation (as section 9 of the standard does)
and states "Not answered; this plan does not assume an answer". But C-10's
status, "Moved: GAP-07b, after O-20", names a destination that exists only if
the owner picks the first option; under the second it is an ADR changing
section 6. Section 1 also says "Closes: GAP-07" while the register target
("each allow-list entry cites a D-NNN exception and expires") is met for the
dependency sections only. *Would satisfy me:* C-10 reads "Open: waits on O-20
(GAP-07b if the entries need D-NNN, an ADR if section 6 changes)", and section
1 says GAP-07's register target is closed for the npm and NuGet sections, with
the gitleaks and Semgrep half waiting on O-20. The Done-when itself is
dependency-only, so this does not block.

#### F-4. Minor: section 4, conditional `ENGINEERING_STANDARDS.md` row. G-11 "Met" while a known gap remains

G-11 is "every lockfile, full tree including dev". The plan itself leaves
`dotnet-ef` 10.0.12 from `api/dotnet-tools.json` and
`api/.config/dotnet-tools.json` unaudited (2.4, 3.2 last row) and lists it as
a follow-up. *Would satisfy me:* the proposed status names that residual
("Met for both npm lockfiles and the NuGet solution graph; local tool
manifests not audited, follow-up <id>"), or the plan argues why a tool manifest
is not a lockfile under G-11.

#### F-5. Minor: section 3.1 step 4. Register parsing and fenced blocks

The real register (reference copy) holds its template inside a fenced block
with `## D-NNN: <short title>` and `- Expires: <YYYY-MM-DD>`. Those do not
match `^D-\d{3}$`, so today nothing goes wrong, but a future example with a
real-looking id inside a fence would count as an entry or a duplicate. *Would
satisfy me:* the parser skips fenced code blocks, and N7 or N8 includes a
fenced `## D-900` that is not counted.

### Checked and found sound

- **Done-when fit.** Quoted word for word from the refinement plan, line 157:
  "The gate includes development packages, fails on an expired entry (proven
  by a self-test), and blocks at once, since it replaces the existing audit".
  Register row (line 71) and G-11 row also quoted exactly. "Includes
  development packages" is C-1 / N1 plus 5.3 step 4. "Fails on an expired
  entry (proven by a self-test)" is met by N3 to N5, which run a byte copy of
  the real gate (kept equal by "the fixture gate is the real gate") with
  expired fixture entries, inside the `gate-self-test` job; N6 pins the
  boundary day. The Done-when asks for the gate to fail and a self-test to prove
  it; it does not ask the self-test to fail on the real file, so enforcing
  expiry in the audit jobs satisfies it (subject to F-1). This also matches the
  register's own sentence: "An expired entry fails the gate that cites it."
- **Blocks at once.** `security.yml` on `57da65b` has no `continue-on-error`
  and no `*_BLOCKING_FROM`; the plan adds none and checks both with `grep`
  (5.2). Security runs on every `pull_request`, on push to the integration
  branch, weekly and on dispatch, so an expired entry is caught on the next
  pull request.
- **Golden copies in the same commit.** `run-npm-audit.sh` and
  `run-npm-audit.expected.sh` both change in commit 2; `security.yml` and
  `security.expected.yml` both change in commit 2; no `run:` line changes, so
  `securityRunAllowList` (lines 920 to 931) is unchanged. Today both pairs are
  identical (`diff`: no output). `pinnedScripts` (958 to 961) and
  `shellPinProblems` confirmed. `run-dotnet-audit.sh` and its copy are not
  edited. The red commit (commit 1) changes only `gate.test.mjs`, so no golden
  copy drifts between commits.
- **No gate weakened (P-6).** Dropping `--omit=dev` widens the audit;
  `--audit-level=high` stays; no allow-list entry is added; the gate gains a
  fail-closed input (missing register with entries present fails, N9); no date
  override exists. `known-findings.json`, lockfiles and `.csproj` files are
  untouched and 5.2 checks that. The three changed fixture tests keep their
  assertions. (F-1 is about the plan's own claim, not a weakening.)
- **Current state verified.**
  - `node --test .github/security/gate.test.mjs`: `# tests 63`, `# pass 63`,
    `# fail 0`.
  - `website$ npm audit --audit-level=high --json`: exit 0;
    `metadata.vulnerabilities` `{"info":0,"low":0,"moderate":1,"high":0,"critical":0,"total":1}`,
    only `fast-uri`; fed to the gate: `website: 0 finding(s) at the gate's
    level; 0 known, 0 new.`, exit 0. Studio: exit 0, gate `0 known, 0 new`,
    exit 0. Matches 2.2.
  - Historical proof (2.3): `6470fac:studio/package.json` and lockfile in the
    scratchpad; `--omit=dev` report through the gate: `studio: 0 finding(s) ...`,
    exit 0; full-tree report: `studio: 6 finding(s) at the gate's level; 0
    known, 6 new.`, exit 1, last lines `undici GHSA-qrxm-fqhp-jwvm` and `vite
    GHSA-587h-7wmj-h5pm`. Matches.
  - `gate.mjs`: `known` loaded at line 39; `main()` builds npm and dotnet
    known sets from `entry.id` only; `finish()` sets `process.exitCode` from
    new findings only and only prints stale ids. Matches 2.1.
  - `known-findings.json`: `npm.website`, `npm.studio`, `dotnet` empty; 2
    gitleaks and 7 Semgrep entries with `owner` and `reason`.
  - `docs/deferred-items.md` and `ENGINEERING_STANDARDS.md` are absent on the
    branch (`ls`: No such file or directory), so the "empty section, register
    not read" rule is needed and correct.
  - `gate.test.mjs` imports `gate.mjs` statically at line 10, so step 8 (no
    register read at load) and the dynamic import for new exports are right.
  - The npm mutation tests use the fixture gate with label `website`
    (`mutationFixtures.npm.label`), so giving the fixture's `npm.studio` and
    `dotnet` expired entries does not break them; no existing test calls
    `runFixture` with `studio` or `dotnet`.
- **Testability.** Failing tests first in their own commit (B-6, P-4), each
  named; N1, N3 to N10 would fail on `57da65b` for the reasons given; N2 is a
  stated canary. Commands are exact. No .NET test is run, so Release does not
  arise; `dotnet restore` writes only `obj/`.
- **Scope (B-8).** One gate (G-11). No overlap found with the other change
  branches: `change/GAP-04` and `change/GAP-06` touch `ci.yml` and app files,
  `change/GAP-08` adds `.github/lint/` and `workflow-lint.yml`, `change/GAP-12`
  touches the API, `change/GAP-11` and `change/GAP-13` only records. The
  `security.yml` overlap with GAP-09 (not started) is named as R-2 with
  sequencing.
- **O-20 numbering.** `change/GAP-13` uses O-18 and O-19; no branch uses O-20.
  The question is asked, not answered, and nothing is built on an answer except
  the C-10 wording (F-3).
- **Security.** No route, policy, secret, migration or database touched; no
  dependency added or upgraded; the register is read only from the checkout and
  only the D-NNN and date are printed.
- **Rollback and risks.** Revert restores the old behaviour; R-1, R-3, R-4,
  R-5, R-7 to R-9 are specific and handled. R-6 is wrong (F-1).
- **Track checklist (G1, Waves 1 to 3).** One gate; blocks at once because it
  replaces the existing audit; canary fixtures (N1 to N5); no pins changed;
  baseline unchanged.

The round 1 verdict was CHANGES NEEDED.

## Round 2

Plan-reviewer, 1 November 2026. Reviewed `docs/changes/GAP-07/plan.md`
round 2 (revision log, section 12), still uncommitted, on `change/GAP-07` at
`57da65b`. Every line number below was checked by the reviewer against
`.github/security/gate.test.mjs` on that commit
(`grep -n 'run(\|runGate(\|spawnSync\|runTool' gate.test.mjs`).

### Round 1 findings

- **F-1 (Major): resolved.** 3.1 step 10 now routes `run()` for `npm` and
  `dotnet` to a byte-copy `fixture-clean` gate whose `npm` and `dotnet`
  sections are empty, so no self-test reads the real dependency entries.
  - The exit-0 list is correct and complete: "a clean report passes" at 179
    (npm studio 180, dotnet 183 and 198, all inside that test); 303
    (`npm-via-strings`, studio); 325 and 327 (moderate passes, High fails);
    the dotnet mutation test 524 to 557 (`runTool` is `run` for dotnet).
  - The exit-1 list (85, 95, 104, 111, 117, 120, 139, 150, 163, 171, 174,
    210, 216, 231, 606, 628, 654, 677, 696, 705, 711) matches every other
    `run(` call for `npm` or `dotnet`. 85, 95 and 606 are loops over several
    tools; because routing is done inside `run()` by `args[0]`, they are
    covered whatever the loop holds. All gitleaks and Semgrep calls keep the
    real gate, as stated.
  - The only other spawn of the real gate is line 473 (`node
    --input-type=module -e` importing `consumedFields`), which does not call
    `main()` (`invokedDirectly` is false) and does not match the static scan's
    patterns. So the static half of N11 will pass on the intended code.
  - P-6 argument accepted. The tests check report validation, severity and
    exit codes. The code is byte-identical (checked). The real file is still
    parsed at import (line 10 imports `gate.mjs`, which loads
    `known-findings.json` at line 39). It is checked for shape by N10 and
    the existing owner and reason test, and for expiry and register by the
    jobs.
  - N11 would be red on `57da65b`: the old gate ignores expiry, so the
    expired-real copy exits 0 on clean reports. Counts 63 + 11 = 74, with 10
    red (N1, N3 to N11), are consistent.
  - The rejected alternative in 3.2, R-6 and the new C-11 are now true.
- **F-2 (Minor): resolved.** `allowListShapeProblems(entries)` is specified
  (3.1 step 7), shape only, and N10 calls it and asserts it reports nothing
  about a register or a date. `allowListProblems` builds on it.
- **F-3 (Minor): resolved.** Section 1 now separates "Closes" (Wave 1
  Done-when in full; the register target for `npm` and `dotnet`) from "Closes
  only in part" (gitleaks and Semgrep wait on O-20). C-10 reads "Open: waits on
  O-20 (GAP-07b if the entries need a D-NNN, an ADR if section 6 changes)".
  O-20 is unchanged, still unanswered, and nothing in the plan is built on an
  answer (P-7).
- **F-4 (Minor): resolved.** The conditional G-11 status is "Partial" and
  names the `dotnet-ef` tool manifests as the residual follow-up.
- **F-5 (Minor): resolved.** 3.1 step 4 skips fenced blocks (backticks or
  tildes), and N7 covers both a fenced-only `## D-900` (not counted) and a
  real plus fenced pair (not a duplicate).

### New findings (none block)

#### F-6. Minor: 3.1 step 10 vs section 4. Which fixture copies are byte-compared

3.1 step 10 says "the fixture gate is the real gate" is extended to
`fixture-repo`, `fixture-clean` and `fixture-no-register`. Section 4 says
"compares every copy byte for byte", which also covers `fixture-expired-real`
(N11). *Would satisfy me:* the developer follows section 4 and compares all
four copies. If N11's copy drifted, N11 would prove nothing (R-7).

#### F-7. Minor: 5.1 preamble. The dynamic-import rule names only two of the three exports

The rule is "Tests that need `allowListProblems` or `parseRegister` load them
with `await import(...)`". N10 uses the new `allowListShapeProblems`. A static
named import of it in the red commit would fail the whole file at link time,
not one test, and the red-run counts would be wrong. *Would satisfy me:* the
developer applies the same rule to `allowListShapeProblems`. No plan
revision is needed for this.

#### F-8. Minor (note): N11's static scan is pattern-based

N11's static scan forbids only `runGate(gate,` and `spawnSync(process.execPath,
[gate` outside `run()`. A spawn written another way, for example
`runGate(path.join(here, "gate.mjs"), ...)`, would slip past it. The
behavioural half (routing asserted inside `run()`) is the real proof. This is
noted for the tester, not a change request.

### Checked again and still sound

- The Done-when is quoted word for word. Expiry fails the npm and NuGet jobs
  and is proven by self-tests N3 to N6 and N11 on byte copies. The gate blocks
  at once: no `continue-on-error` and no `*_BLOCKING_FROM`.
- Golden copies change in the same commit as their originals:
  `run-npm-audit.sh` with `run-npm-audit.expected.sh`, and `security.yml`
  with `security.expected.yml`. No `run:` line changes. The red commit
  touches only `gate.test.mjs`.
- No gate, guard, baseline or test is weakened (P-6). `known-findings.json`,
  lockfiles and `.csproj` files are untouched.
- Scope is unchanged apart from the test-file routing, which stays inside
  `gate.test.mjs`. There is still no file overlap with GAP-04, GAP-06,
  GAP-08, GAP-11, GAP-12 or GAP-13.
- The rest of round 1's "checked and found sound" still holds.

Verdict: APPROVED
