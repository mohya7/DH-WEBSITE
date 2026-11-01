# Delivery approval: GAP-07 (gate 2)

## Round 1

Tech lead, 1 November 2026. Gate 2 for `change/GAP-07` at head **`6e4eea9`**
(`6e4eea92837e5c7b765823dcf9fa972314c894bd`), fix at `3b1b9c6`, built on
`change/GAP-01` at `57da65b` (`57da65bee9413bd97fd8d27c24534f6e5c147093`), which
has **not** merged into `origin/rebuild/dotnet-platform`. So the base for every
diff below is `57da65b`, not `origin/rebuild/dotnet-platform` (that three-dot
diff would include GAP-01's own changes).

I read `docs/changes/README.md`, `.claude/agents/tech-lead.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `ENVIRONMENT.md` and
`.github/pull_request_template.md` from the read-only reference copy, because
they are not on this branch (O-18). I read every file in this folder:
`plan.md` round 2, `plan-review.md` rounds 1 and 2, `plan-approval.md` (7
conditions), `implementation.md` round 1 and `test-report.md` round 1
(uncommitted, `Verdict: APPROVED`, Minors T-1, T-2, T-3). For consistency I
also read the gate 2 records of GAP-08 and GAP-04
(`/home/user/wt-GAP-08/docs/changes/GAP-08/delivery-approval.md`,
`/home/user/wt-GAP-04/docs/changes/GAP-04/delivery-approval.md`). I built none
of this.

### Decision

**Changes needed.** The implementation matches the approved plan, stays in
scope, the failing tests came first, the tester's evidence is real, and
everything I re-ran is green. It goes back to the developer for the tester's
**T-2**: the property this change exists to add, "the npm jobs audit the full
tree", can be switched off by an npm setting that no check sees, while the job
still prints a clean result. That is the same kind of hole that GAP-08 (round 1,
`SHELLCHECK_OPTS` and a step `env` date) and GAP-04 (round 1, a step `env`
blocking date) were sent back for, and it gets the same answer.

The fix fits inside the plan: it touches only `run-npm-audit.sh`, its golden
copy and `gate.test.mjs`, which are all in plan section 4, and it makes C-1 and
the Done-when hold at run time. It needs no change to N1 as planned (see the
required route below), so the change goes to the developer and then to the
tester, not to the architect.

### Required: refuse an npm configuration that omits packages (T-2)

**Reproduced.** Scratch folder
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap07-gate2/`.
`hist/studio` holds `6470fac:studio/package.json` and `package-lock.json` (the
pre-GAP-01 Studio, six Highs in development packages), and `hist/.github/security`
is a copy of the head's `.github/security/`. npm 10.9.9, Node 22.23.4.

```
hist/studio$ RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh studio
  (no setting)                     exit 1   studio: 6 finding(s) at the gate's level; 0 known, 6 new.
  NPM_CONFIG_OMIT=dev              exit 0   found 0 vulnerabilities / studio: 0 finding(s) ...; 0 known, 0 new.
  NODE_ENV=production              exit 0   found 0 vulnerabilities / studio: 0 finding(s) ...; 0 known, 0 new.
  npm_config_production=true       exit 0   found 0 vulnerabilities / studio: 0 finding(s) ...; 0 known, 0 new.
  studio/.npmrc "omit=dev"         exit 0   found 0 vulnerabilities / studio: 0 finding(s) ...; 0 known, 0 new.
```

`NODE_ENV=production` is the case that decides this. npm's `omit` defaults to
`dev` whenever `NODE_ENV` is `production`. One line added to the workflow-level
`env:` of `security.yml`, beside `NODE_VERSION`, and the same line in
`security.expected.yml`, passes every check the change has. I made that edit in
a scratch extract of `6e4eea9` (`gap07-gate2/repo`, `.github`, `.semgrepignore`
and `.gitattributes`):

```
$ grep -c "NODE_ENV: production" .github/workflows/security.yml .github/security/security.expected.yml
.github/workflows/security.yml:1
.github/security/security.expected.yml:1
$ cmp .github/workflows/security.yml .github/security/security.expected.yml        exit 0
$ node --test .github/security/gate.test.mjs                                        exit 0
# tests 74  # pass 74  # fail 0
```

Why this is sent back and not a follow-up. The rule from GAP-08 and GAP-04 is
this. A loosening that comes from outside the gate's own checks, which a
reviewer would read as configuration and not as a gate edit, while the job
keeps printing a clean result, is a silent loosening under P-6 ("Never weaken a
gate, guard or test to make something pass"). Those are sent back. A loosening
that needs a plain edit to the gate's own lines sits behind the same trust
boundary as the gate, and is a follow-up. T-2 is the first kind:

- `NODE_ENV: production`, `NPM_CONFIG_OMIT` or a one-line `.npmrc` reads as
  ordinary Node configuration. It does not touch `run-npm-audit.sh`, N1 or any
  `run:` line.
- The golden copy does not change that. GAP-08 round 2 already found that the
  same pull request updates the golden copy, so it only makes the edit visible
  to a reviewer who already knows it matters.
- The job then prints `found 0 vulnerabilities` and `0 known, 0 new` with
  exit 0. That is exactly the result C-1 was meant to stop being misleading.
- The tester's mitigations do not close it. It is true that a committed `.npmrc`
  with `omit=dev` would break `npm ci` in `ci.yml`, but the workflow-level env
  route affects only `security.yml`, and the npm job runs no install.

**The tester's first suggestion does not work, so it is not the fix.**
`metadata.dependencies` in the JSON report counts the lockfile, not what was
audited:

```
hist/studio$ npm audit --audit-level=high --json | metadata.dependencies
  (no setting)          {"prod":135,"dev":173,"optional":76,"peer":0,"peerOptional":0,"total":312}
  NODE_ENV=production   {"prod":135,"dev":173,"optional":76,"peer":0,"peerOptional":0,"total":312}
```

A gate check on `dev === 0` would never fire.

**What does detect it.** `npm config get omit` reports the effective value
from every route, and it runs offline:

```
hist/studio$ npm config get omit
  (no setting)                     ""
  NODE_ENV=production              dev
  NPM_CONFIG_OMIT=dev              dev
  npm_config_production=true       dev
  NPM_CONFIG_ONLY=prod             dev
  NPM_CONFIG_OMIT=optional         optional
  .npmrc omit=dev                  dev
  .npmrc production=true           dev
```

I also probed `--include=dev` on both audit lines in the scratch copy. It
overrides every route above (all exit 1 with the six Highs). It is not the
required route for two reasons. Plan N1 forbids `--include` on the audit lines,
so using it would mean amending the plan. And an override hides that someone
tried, where a refusal shows it in the log (GAP-08 round 1: "refuse, not
unset").

**Required outcome:**

1. Before either `npm audit` line, `run-npm-audit.sh` reads npm's effective
   `omit` in the app folder. If it is not empty, the script prints an `::error`
   that names the value and says that the npm audit must cover the full tree,
   then exits 1. The two `npm audit` lines stay exactly as they are (N1 as
   planned). `run-npm-audit.expected.sh` gets the same edit in the same commit.
2. A new test in `gate.test.mjs` (or an extension of N1), committed and shown
   failing before the fix (B-6), runs the script in a temporary app folder.
   With `NODE_ENV=production`, with `NPM_CONFIG_OMIT=dev`, and with an `.npmrc`
   holding `omit=dev`, the script exits 1 with the message, before it reaches
   `npm audit`, so the test needs no network. Without any setting, it gets past
   the check (stub or skip the network step as you choose, in the test only).
   The script gets no switch that turns the check off.
3. Re-run and quote my reproduction above on the historical Studio lockfile:
   `NODE_ENV=production`, `NPM_CONFIG_OMIT=dev`, `npm_config_production=true`
   and `.npmrc omit=dev` each exit 1 with the refusal. With no setting, the run
   still exits 1 with the six Highs. Re-run 5.2 and 5.3 in full, and the
   `NODE_ENV: production` mutation of `security.yml` and the golden copy, which
   must now fail the npm job. It may still pass the self-test; the run-time
   refusal is the check.
4. Update C-1's evidence in the coverage table.

### Tester's other Minors: decision on each

- **T-1, N11's static scan misses other spellings of a direct spawn. Accepted
  as a recorded follow-up.** Each variant needs an edit to `gate.test.mjs`, the
  gate's own self-test, in a reviewed diff. That is the trust boundary GAP-08
  applied to its N1 to N8. Gate 1 accepted F-8 on the same basis, and the
  behavioural half of N11 (`spawnedGates` shows `[clean, clean, real, real]`)
  is the real proof. The developer may adopt the tester's sturdier check in
  round 2: record the arguments in `spawnedGates`, and have the last test
  assert that the real gate was never spawned with `npm` or `dotnet`. If not,
  it goes under "Review findings accepted" and to GAP-21.
- **T-3, the register parser accepts an entry inside an indented fence or an
  HTML comment. Accepted as a recorded follow-up.** It does not loosen the
  gate. The entry still needs a matching D-NNN heading and the same expiry,
  and it still fails on the day after. Adding one needs a reviewed edit to
  `known-findings.json` (the allow-list itself) and to
  `docs/deferred-items.md`, and a pull request diff shows the raw text. The
  harm is that the rendered register would not show the entry. Only the owner
  adds entries, and no register exists on the branch yet (O-18). The developer
  may close it in round 2 (a fence opened by up to three spaces, and
  `<!-- ... -->` blocks skipped), with a test written red first. If not, it is
  recorded for the change that lands `docs/deferred-items.md`.

### What I verified myself

Run in `/home/user/wt-GAP-07` on 1 November 2026 against `6e4eea9`, unless the
line says otherwise. Node v22.23.4, npm 10.9.9. I ran no `git fetch` of any
kind, and nothing in the worktree changed except this file.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Not shallow | `git rev-parse --is-shallow-repository` | 0 | `false` |
| Base | `git merge-base --is-ancestor 57da65b HEAD` | 0 | ancestor |
| Scope | `git diff --name-only 57da65b..HEAD` | 0 | `gate.mjs`, `gate.test.mjs`, `run-npm-audit.sh`, `run-npm-audit.expected.sh`, `security.yml`, `security.expected.yml`, and `docs/changes/GAP-07/` (plan, review, approval, implementation). These are exactly plan section 4. |
| Protected files | `git diff 57da65b..HEAD -- '*package-lock.json' '*package.json' '*.csproj' known-findings.json run-dotnet-audit.sh run-dotnet-audit.expected.sh fail-on-rules.json .github/workflows/ci.yml \| wc -c` | 0 | `0` |
| `security.yml` | `git diff 57da65b..HEAD -- .github/workflows/security.yml` | 0 | only `#` comment lines (1 changed, 3 added) |
| Blocks at once | `grep -n -E "continue-on-error\|BLOCKING_FROM" .github/workflows/security.yml` | 1 | no match |
| Golden copies | `cmp` on `run-npm-audit`, `run-dotnet-audit` and `security.yml` against their copies | 0, 0, 0 | equal |
| Self-test | `node --test .github/security/gate.test.mjs` | 0 | `# tests 74  # pass 74  # fail 0` |
| T-2 | as quoted above | | reproduced, plus the `NODE_ENV` workflow mutation |
| Parallel files (condition 6) | `git diff --name-only 6470fac...<branch> -- .github/security .github/workflows/security.yml` for every local `change/*` and remote branch | 0 | Only `change/GAP-01` (this change's base) and two stale October branches touch these files. `origin/phase-d/ci-semgrep` has no diff from the base. `origin/phase-d/ci-security` (14 October) is a subset of the base. No new branch is open on these files. |

**Test first (B-6).** The order is `881a1ae` (red), `8902d05` (test only),
`3b1b9c6` (fix), `6e4eea9` (record). I did not re-run the red commits. The
developer and the tester both quote 74 / 64 / 10 with the same ten names (N1,
N3 to N11), on `881a1ae` and on `8902d05`. The tester also ran them on a
separate detached checkout, and `git diff 8902d05 3b1b9c6` leaves the test file
unchanged. I accept that as real evidence.

**Evidence is real.** Every step in the tester's report quotes the command, the
exit code and the output lines. The tester's `atk.mjs` harness, the
mocked-clock runs at the expiry boundary and the T-2 steps match my own runs.
Every coverage-table row has evidence, except C-9, which is moved with its
destination, and C-10, which is open on O-20. Both are as gate 1 allowed.

**Commits (B-4).** Every commit starts with `GAP-07:`, has a body that says why
and quotes its test result, and ends with the attribution trailers.
`GAP-07: Plan` and `GAP-07: Record the implementation` follow the pipeline's
pattern for record commits. I do not ask for history to be rewritten.

### Gate 1 conditions

| # | Status |
| --- | --- |
| 1 Sequencing on GAP-01 | Not met yet; owed. See "What gate 2 approval covers" below. |
| 2 F-6, four byte-compared copies | Met (test 12; developer and tester quote it). |
| 3 F-7, dynamic import, 74 / 64 / 10 | Met. |
| 4 Derived fixtures | Met (`structuredClone(known)`, read in `gate.test.mjs`). |
| 5 Scope | Met (table above). C-9 is moved, and the `dotnet-ef` follow-up is listed. Round 2 must stay within the same files. |
| 6 Parallel files | Nothing open today (table above). Re-check after every rebase. |
| 7 O-20 | Untouched; for the coordinator. |

### What gate 2 approval covers, and what it does not

This applies to whichever round approves.

- **It covers:** the change's content at the tested head, judged on base
  `57da65b`. That means the diff, the tests, the evidence, and the decision on
  each finding.
- **It does not cover the rebased head.** Under condition 1 the pull request
  cannot open until GAP-01 has merged into `origin/rebuild/dotnet-platform`.
  Then the developer rebases without tracking, confirms the repository is not
  shallow, and re-runs 5.2 and 5.3 with `<base>` set to the merged commit. The
  developer records that as a new round of `implementation.md`. The tester adds
  a round to `test-report.md`, as the tester's report already says. Gate 2 is
  then held once more, briefly: `git range-diff` from the old range to the new,
  plus the re-run results. If the rebased full-tree audit shows any High or
  Critical, the developer stops and reports it to the coordinator. No
  allow-list entry is added (R-1), because an exception needs the owner's words
  and `docs/deferred-items.md`.
- **It does not cover:** pushing or opening the pull request (the owner's OK,
  as for GAP-01); CI on the final head; O-18 or O-20; and any owner
  confirmation. This file is a pipeline role, not the owner.

### What round 2 must contain

1. The T-2 fix above, with its red-first test commit, then the fix commit
   (golden copy in the same commit), each with B-4 trailers.
2. Optionally T-1 and T-3, each red first. If they are left, record them as
   follow-ups.
3. Commit `test-report.md` round 1 on `change/GAP-07` before round 2 starts. It
   is untracked now.
4. Append a round 2 to `implementation.md`; do not rewrite round 1. It quotes
   the red and green runs and the reproduction in required outcome step 3.

Then the tester runs round 2, and this gate is held again.

### Open items (whatever round passes)

- Condition 1: GAP-01 merges first, then the rebase, the re-run and a new
  tester round, as described above.
- The owner's OK to push and to open the pull request.
- CI on the final head: `Security gate self-test`, `npm audit (website)`,
  `npm audit (studio)`, `NuGet vulnerable packages (api)`, plus the CI
  workflow's `api`, `website` and `studio` jobs. Quote the run ids.
- actionlint on `security.yml` after GAP-08 merges. Only comments changed.
- Follow-ups with no id yet: the `dotnet-ef` tool manifests, which are not
  audited; `fast-uri`, a moderate development finding in the website, left to
  GAP-02's triage; T-1 and T-3 if not closed in round 2; C-9 (the G-11 and S-7
  status rows) after O-18; and C-10 on O-20.

### Definition of Done (status at `6e4eea9`)

- Can be ticked after round 2 passes: requirement met; standards; no
  prohibited constructs; route guards are N/A; tests and a regression test;
  independent review (plan review, tester, this gate); review by a role other
  than the author; rollback (revert the pull request; there is no schema or
  data change); deployment note (the integrator merges into
  `rebuild/dotnet-platform` and re-runs the suites).
- **Cannot be ticked yet:** "Tests exist for the behaviour changed", because
  the full-tree property has no test that holds against npm configuration
  (T-2); "PR checks are green on the final head"; and the governance box for
  `docs/deferred-items.md`, which is N/A until O-18 (no exception is added).

The draft pull request description comes with the approving round.

Round 1 result: changes needed (sent back to the developer for T-2).

## Round 2

Tech lead, 1 November 2026. Gate 2 again, for `change/GAP-07` at head
**`3b758b2`** (`3b758b21299f72e7208030278705dd2f06fb7f57`). The base is still
`57da65b` (GAP-01, not merged). Read: `implementation.md` round 2 (ends
`Status: READY FOR TEST`) and `test-report.md` round 2 (tested `3b758b2`, ends
`Verdict: APPROVED`, no Blocker or Major, new Minor T-4). Round 2 commits:

- `7628a49` adds the red test N12;
- `e3006f2` adds the `npm config get omit` refusal, with its golden copy;
- `3b758b2` records the round.

### Decision

**Approved**, with the open items below. T-2 is closed: I re-ran my round 1
reproductions myself and every one of them now fails the job. T-4 is accepted
as a recorded follow-up, by the same rule as round 1. T-1 and T-3 are recorded
as follow-ups, as round 1 allowed. As before, nothing is pushed, and the pull
request cannot open until condition 1 is done (see the scope statement below).

### T-2, verified myself

My round 1 scratch folder
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/gap07-gate2/`
was used again. `hist/.github/security` was replaced with a copy of the head's
`.github/security/` (`cmp` of `run-npm-audit.sh` exit 0), and `hist/studio` is
still the pre-GAP-01 Studio, which has six development Highs. Each run used
`RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh studio`:

```
                                    round 1 (6e4eea9)      round 2 (3b758b2)
(no setting)                        exit 1, 6 new          exit 1   studio: 6 finding(s) at the gate's level; 0 known, 6 new.
NPM_CONFIG_OMIT=dev                 exit 0, 0 new          exit 1   ::error title=npm audit (studio)::npm is set to omit "dev"; the audit must cover the full tree, ...
NODE_ENV=production                 exit 0, 0 new          exit 1   (same refusal)
npm_config_production=true          exit 0, 0 new          exit 1   (same refusal)
NPM_CONFIG_ONLY=prod                (not run)              exit 1   (same refusal)
npm_config_omit=optional            (not run)              exit 1   ::error ...npm is set to omit "optional"; ...
npm_config_workspace=nope           (not run)              exit 1   ::error title=npm audit (studio)::npm config get omit failed
studio/.npmrc "omit=dev"            exit 0, 0 new          exit 1   (same refusal)
studio/.npmrc "production=true"     (not run)              exit 1   (same refusal)
npm_config_include=dev + NODE_ENV=production   (not run)   exit 1   6 new (npm resolves to the full tree; no refusal needed)
```

The workflow mutation from round 1, re-run on a scratch extract of `3b758b2`
(`gap07-gate2/repo2`: `.github`, `.semgrepignore`, `.gitattributes`).
`  NODE_ENV: production` is added after `NODE_VERSION` in the workflow-level
`env:` of both `security.yml` and `security.expected.yml`:

```
$ node --test .github/security/gate.test.mjs                       exit 0   # tests 75  # pass 75  # fail 0
website$ NODE_ENV=production RUNNER_TEMP=... bash ../.github/security/run-npm-audit.sh website   exit 1
::error title=npm audit (website)::npm is set to omit "dev"; the audit must cover the full tree, ...
```

The self-test still passes the mutation, as round 1 said it might. The run-time
refusal is the check: under that environment, the npm job now fails with a
message that names the setting, where in round 1 it reported a clean result.
That is the outcome round 1 required. I simulated the job step by setting the
variable on the script, because the workflow cannot run here.

I read the fix (`e3006f2`, script lines 13 to 24). `omit=$(npm config get omit)`
captures stdout only, so npm's deprecation warnings on stderr cannot fill the
value. A failing `npm config get` exits 1, and any non-empty value exits 1.
There is no switch that turns the check off. The two `npm audit` lines are
unchanged (lines 25 and 26), so N1 holds as planned. The script refuses rather
than overriding with `--include=dev`, as round 1 asked. I also read N12 (in
`7628a49`, at the end of `gate.test.mjs`):

- It runs the real script.
- The stub `npm` answers only `audit` and passes `npm config get` to the real
  npm, so it cannot hide the value the check reads.
- It removes inherited `NODE_ENV` and `npm_config_omit`, `production`, `only`,
  `include` and `dev`, so the clean case is not at the mercy of the runner.

### T-4: decision

**T-4 (Minor), N12 would not catch a check narrowed to `dev`, or a
config-failure branch that exits 0. Accepted as a recorded follow-up.**

Both mutants are edits to `run-npm-audit.sh`, the gate's own script, together
with its golden copy, in a reviewed diff. That is the trust boundary GAP-08
applied to its N1 to N8, GAP-04 to its Minor 6 (removing the cap from its own
checker), and round 1 here to T-1. It is not the round 1 kind, a setting a
reviewer reads as configuration.

The shipped script is the strong form on both points, which the tester and I
each showed: `omit=optional` is refused, and a failing `npm config get` fails
closed. Narrowing to `= dev` would still refuse every route that actually drops
development packages, because each of them resolves to `dev`.

Follow-up for GAP-21: add an `npm_config_omit=optional` case and an
`npm_config_workspace=nope` case to N12.

### What else I verified myself

Run in `/home/user/wt-GAP-07` on `3b758b2`, Node v22.23.4, npm 10.9.9. I ran no
`git fetch`. Nothing in the worktree changed except this file.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Not shallow | `git rev-parse --is-shallow-repository` | 0 | `false` |
| Self-test | `node --test .github/security/gate.test.mjs` | 0 | `# tests 75  # pass 75  # fail 0` |
| Red first (B-6) | the same, on a scratch extract of `7628a49` | 1 | `not ok 75 - the npm audit script refuses an npm configuration that omits packages`; `# tests 75  # pass 74  # fail 1` |
| Round 2 scope | `git diff 6e4eea9..HEAD --stat`; `git diff 6e4eea9..HEAD -- gate.mjs security.yml \| wc -c` | 0 | only `gate.test.mjs` (+67), `run-npm-audit.sh` and its golden copy (+12 each), `implementation.md`; `0` |
| Whole scope | `git diff --name-only 57da65b..HEAD` | 0 | plan section 4 files and `docs/changes/GAP-07/` only |
| Protected files | `git diff 57da65b..HEAD -- '*package-lock.json' '*package.json' '*.csproj' known-findings.json run-dotnet-audit.sh run-dotnet-audit.expected.sh fail-on-rules.json ci.yml \| wc -c` | 0 | `0` |
| Golden copies | `cmp` on `run-npm-audit`, `run-dotnet-audit` and `security.yml` against their copies | 0, 0, 0 | equal |
| Commits (B-4) | `git log 6e4eea9..HEAD` | 0 | `GAP-07:` subjects, a body that says why and quotes the test result, `Co-Authored-By` and `Claude-Session` trailers on all three |

The tester's round 2 evidence is real. Section 3 lists 22 npm settings, each
with `npm config get omit`, a raw audit count and the script's exit code.
Section 4 shows five N12 mutation runs. Section 5 re-runs 5.2 and 5.3. Where
we overlap, my runs agree with the tester's.

`test-report.md` and this file are still uncommitted. That follows the
coordinator's instruction (`implementation.md` round 2 records it), so it is
not held against the developer. The orchestrator commits both before the push.

### What this approval covers, and what it does not (condition 1)

- **It covers** the change's content at `3b758b2`, judged on base `57da65b`:
  - the diff and the tests;
  - the developer's, tester's and my evidence;
  - the decision on T-1 to T-4.
- **It does not cover the rebased head.** Before the pull request may open:
  1. GAP-01 merges into `origin/rebuild/dotnet-platform`.
  2. The developer rebases without tracking and confirms the repository is
     not shallow (never `git fetch --depth`).
  3. The developer re-runs 5.2 and 5.3 with `<base>` set to the merged
     commit. That includes the T-2 reproduction and the `security.yml` golden
     copy diff (condition 6). The results go in a new round of
     `implementation.md`.
  4. The tester adds a round to `test-report.md`.
  5. Gate 2 is held once more, briefly, on `git range-diff` from the old
     range to the new and on the re-run results.

  If the rebased full-tree audit shows any High or Critical, the developer
  stops and reports it to the coordinator. No allow-list entry is added
  (R-1).
- **It does not cover:**
  - the owner's OK to push and to open the pull request;
  - CI on the final head;
  - O-18 and O-20;
  - any owner confirmation.

  This file is a pipeline role, not the owner.

### Open items

1. Condition 1, as above.
2. The orchestrator commits `test-report.md` (rounds 1 and 2) and this file.
3. The owner's OK to push and open the pull request.
4. CI on the final head, with run ids quoted:
   - `security.yml`: `Security gate self-test`, `npm audit (website)`,
     `npm audit (studio)`, `NuGet vulnerable packages (api)`, `gitleaks-pr`,
     `gitleaks-history`, `semgrep`;
   - `ci.yml`: `api`, `website`, `studio`.
5. Independent review under `AGENTS.md` rotation (Cursor checks Claude Code),
   and the owner's review.
6. actionlint on `security.yml` after GAP-08 merges. Only comments changed.
7. Follow-ups, none of them exceptions (no `docs/deferred-items.md` entry):
   - T-1 and T-4, for GAP-21;
   - T-3, for the change that lands `docs/deferred-items.md`;
   - the `dotnet-ef` tool manifests, which are not audited;
   - `fast-uri`, a moderate development finding in the website, for GAP-02;
   - C-9 (the G-11 and S-7 status rows), after O-18;
   - C-10 (the gitleaks and Semgrep entries), on O-20.

## Draft pull request description

Title: `GAP-07: Audit the full dependency tree and expire allow-list entries`

```markdown
<!-- claude-projects-attribution: {"github_login":"Mohamed-Elbadry-DH"} -->
_Requested by **Mohamed Elbadry** · [project thread](https://claude.ai/code/project/chan_01XVNyCimNZqPqPXf2VCDwp6?thread=cmsg_01XVNyCimNZqPqPXf2VCDwp6Yc7G3x1zMCKZMuJSV3oKJ2)_

## What and why

GAP-07 (Wave 1, G1, gate G-11). It closes the gate half of baseline F4: the
npm jobs ran `npm audit --omit=dev`, so development packages, which the build
machine runs, were never audited. Before GAP-01, that hid six Highs in the
Studio's development packages.

Done when (refinement plan, Wave 1): the dependency gate audits the full tree,
and it fails on an expired allow-list entry, proven by a self-test.

Changes:

- **Full tree.** `run-npm-audit.sh` drops `--omit=dev` from both
  `npm audit` lines. `--audit-level=high` stays.
- **No silent omission.** Before auditing, the script reads
  `npm config get omit`. If npm is set to omit anything (through
  `NODE_ENV=production`, `NPM_CONFIG_OMIT`, `npm_config_production`,
  `only=prod` or an `.npmrc`), or the value cannot be read, the job fails
  with an `::error` that names the setting. There is no switch that turns
  this off.
- **Expiring entries.** Each `npm` and `dotnet` entry in
  `.github/security/known-findings.json` must carry `"deferred": "D-NNN"` and
  `"expires": "YYYY-MM-DD"`. `docs/deferred-items.md` must hold exactly that
  D-NNN heading, outside fenced blocks, with the same `- Expires:` date. The
  entry fails the job the day after it expires (UTC), whether or not its
  advisory is still reported. A missing register fails closed. There is no
  date override.
- **Self-test.** `npm` and `dotnet` cases run against a byte copy of the gate
  whose npm and dotnet lists are empty. So a real entry expiring can never
  fail the self-test and, through `needs:`, skip gitleaks and Semgrep. New
  tests N1 to N12.
- **NuGet.** The audit already covered the whole solution graph and is
  unchanged. N2 now pins that.

The gate blocks at once. It replaces the existing blocking audit, so there is
no `*_BLOCKING_FROM` and no `continue-on-error`. All three entry lists are
empty, so it is green on the day it merges.

Records: `docs/changes/GAP-07/` holds the plan, the reviews, the
implementation, the test report and the delivery approval.

## Scope and boundaries

In scope:

- `.github/security/gate.mjs` and `gate.test.mjs`;
- `.github/security/run-npm-audit.sh` and its golden copy
  `run-npm-audit.expected.sh`;
- `.github/workflows/security.yml` and its golden copy
  `security.expected.yml`, header comment only: no job, step, `run:`, `uses:`
  or `name:` line changes;
- `docs/changes/GAP-07/`.

Out of scope and byte-identical to base:

- `known-findings.json`;
- `fail-on-rules.json`;
- `run-dotnet-audit.sh` and its golden copy;
- `ci.yml`;
- every `package.json` and lockfile;
- every `.csproj`.

Also out of scope:

- gitleaks and Semgrep entries getting a D-NNN and an expiry, which waits on
  O-20;
- auditing the `dotnet-ef` tool manifests;
- `fast-uri` (moderate, development), for GAP-02;
- the G-11 and S-7 status rows in `ENGINEERING_STANDARDS.md`, after O-18.

## Security impact

- **Dependencies:** the npm audit now covers development packages, in both
  apps. A new High or Critical in a development package fails the job at
  once. Until O-18 lands `docs/deferred-items.md`, the only way out is an
  upgrade, not an exception.
- **Gate:** it is stricter in three ways:
  - a full-tree audit;
  - a refusal of npm settings that would narrow it;
  - fail-closed expiry and register checks on the dependency allow-list.

  No allow-list entry is added, and no assertion is removed.
- **Routes, policies, data, logins, secrets:** none.

## Tests and evidence

Local evidence at head `3b758b2`, base `57da65b`. The full commands, exit
codes and output are in `docs/changes/GAP-07/implementation.md`,
`test-report.md` and `delivery-approval.md`. The base is _to be updated to
the merged GAP-01 commit after the rebase_.

- **Red before green (B-6):**
  - `881a1ae` fails 10 of 74 tests (N1, N3 to N11). `8902d05` gives the same
    result.
  - `7628a49` fails 1 of 75 (N12).
  - `e3006f2` passes 75 of 75.
- **Gate self-test:** `node --test .github/security/gate.test.mjs` passes 75
  of 75.
- **Golden copies:** `cmp` exits 0 for `run-npm-audit`, `run-dotnet-audit`
  and `security.yml`.
- **Blocks at once:** `grep -E "continue-on-error|BLOCKING_FROM" security.yml`
  finds no match.
- **Website:** `run-npm-audit.sh website` exits 0 with `0 known, 0 new`. The
  full tree has 152 development packages and holds `fast-uri` (moderate).
- **Studio:** `run-npm-audit.sh studio` exits 0 with `0 known, 0 new`. It has
  173 development packages.
- **API:** `run-dotnet-audit.sh` exits 0 for Api, Api.Tests and
  ContentImport.
- **Historical proof:** the pre-GAP-01 Studio lockfile (`6470fac`) fails the
  new script, exit 1, with the six Highs (`source-map-js`, four `undici`,
  `vite`). The old flags passed it, exit 0.
- **Omit settings:** on that same lockfile, each of these exits 1 with the
  refusal: `NODE_ENV=production`, `NPM_CONFIG_OMIT=dev`,
  `npm_config_production=true`, `NPM_CONFIG_ONLY=prod`, `.npmrc omit=dev` and
  `.npmrc production=true`. Before the fix, each one passed, exit 0. The
  tester tried 22 settings and found none that narrows the audit and gets
  past the check.
- **Expiry and register:** the tester attacked them, covering:
  - time zones and the UTC day boundary;
  - environment variables and arguments meant to override the date;
  - fences, duplicate headings and malformed dates;
  - a register that is missing or is a directory.

  Each case fails closed, except the two accepted below.

CI run ids on the final head: _to be filled after the push. Each run must be
green: `security.yml` (all jobs) and `ci.yml` (`api`, `website`, `studio`)._

NOT RUN locally:

| Check | Reason | Covered by |
|---|---|---|
| Semgrep, gitleaks | Not installed in the container | `security.yml` `semgrep`, `gitleaks-pr`, `gitleaks-history` |
| API, website and Studio suites | No file they build or read changed | `ci.yml` `api`, `website`, `studio` |
| actionlint | Not installed; GAP-08 not merged; only comments changed in `security.yml` | `workflow-lint.yml` after GAP-08 |

## Owner decisions

- "Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry,
  2026-11-01, project thread).
- "continue working on wave 0 & 1" (Mohamed Elbadry, 2026-11-01, project
  thread).
- **O-20** (D-NNN and expiry for the gitleaks and Semgrep entries): asked, not
  answered. This pull request does not assume an answer and does not touch
  those entries.
- **O-18** (the governing documents on the branch): pending. Until it lands,
  `docs/deferred-items.md` does not exist on the branch, so no dependency
  exception can be granted.
- **Exceptions:** none. No D-NNN entry is added.
- **Push:** _owner's OK to push, quoted here when given._

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such). The CI half is tracked in box 6.
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [ ] Every new or changed route has a guard and, when it carries a record id, a record scope. **N/A:** no route changed.
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test. **Partly met:** N1 to N12 cover every changed behaviour and were red first, but there is no changed-line coverage gate yet (GAP-18).
- [ ] PR checks are green on the final head (run IDs quoted). Open until CI runs on the rebased head.
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below. Open: every pipeline role was Claude Code, and `AGENTS.md` rotation has Cursor check Claude Code.
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed. Open: needs the owner's review.
- [x] Rollback is understood: revert this whole pull request. That restores `--omit=dev` and the id-only allow-list. No schema or data change.
- [ ] Deployment note: nothing deploys until Phase D. The integrator who merges into `rebuild/dotnet-platform` and re-runs the suites after the merge is _to be named by the owner_.

## Review findings accepted

- **T-1.** N11's static scan matches only some spellings of a direct spawn of
  the real gate. The behavioural half of N11 is the proof, and any other
  spelling needs a reviewed edit to the self-test. Follow-up: GAP-21.
- **T-3.** The register parser accepts an entry inside a fence indented by up
  to three spaces, or inside an HTML comment. The entry still needs a
  matching D-NNN and expiry, and it still expires. The only harm is that the
  rendered register would not show it. Follow-up: the change that lands
  `docs/deferred-items.md`.
- **T-4.** N12 would not catch the script's check being narrowed to `dev`
  only, or its config-failure branch exiting 0. The shipped script refuses
  any value and fails closed. Either weakening needs a reviewed edit to the
  script and its golden copy. Follow-up: GAP-21.
- **Maximum horizon.** An entry may expire as late as 9999-12-31. Neither S-7
  nor the register asks for a limit. Only the owner adds entries.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated. The change's coverage table is in `docs/changes/GAP-07/`.
- [ ] `docs/deferred-items.md` updated for any exception. **N/A:** no exception.
- [ ] Documentation updated. The header comments of `gate.mjs` and `security.yml` describe the new behaviour. The `ENGINEERING_STANDARDS.md` status rows wait on O-18 (C-9).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
