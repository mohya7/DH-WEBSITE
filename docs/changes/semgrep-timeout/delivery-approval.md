# Delivery approval: semgrep-timeout (gate 2)

Technical lead, 11 November 2026. Gate 2, the implementation and the tests.
Reviewed `change/semgrep-timeout` at head `648d4d5`: red tests `5139bdb`, scripts
and `knownFlags` `40b3c3c`, implementation record `1236536`, `test-report.md`
Round 1 `7bd9b0f` (`Verdict: APPROVED`, one Minor), and the record fix `648d4d5`.
Checked against `plan.md` (round 2, `12e8399`), `plan-review.md` (latest round
`Verdict: APPROVED`) and my `plan-approval.md` (`9eb83c1`, nine conditions).

Read first: `docs/changes/README.md`, `.claude/agents/tech-lead.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md` (reference copy in the scratchpad `ref/` folder), the
pull request template (`.github/pull_request_template.md` is not on the base; read
from `origin/claude/cool-heisenberg-mh6zx9`), and every file in this folder. Shape
follows `docs/changes/semgrep-error-detail/delivery-approval.md` on the base.

This approval moves the change to the owner. It is not the owner's confirmation
that `AGENTS.md` requires, and it is not an owner decision. Pushing, opening the
pull request and merging each still need the owner's own OK.

## Decision

Approved. The diff is the approved plan and nothing more: one flag and one
comment line in each scan script, and the self-test that pins them. The red
commit comes before the scripts, the suite is green on the head and on every
merged tree I built, and the tester's one Minor is fixed in the record. The only
proof left is CI on the pull request (open item 1). It is urgent: the 5-second
limit fails the base's own Semgrep job at random, and it blocks #44 and, per the
coordinator, #49.

## What I verified myself

All runs with `/opt/node22/bin/node` (v22.23.4), each in its own `git archive
<commit> | tar -x` copy under
`/tmp/claude-0/-home-user/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/g2`.
The worktree was not changed apart from this file.

**Red before green (B-6, condition 3).** `node --test
.github/security/gate.test.mjs`:

```
5139bdb (red)
not ok 55 - the semgrep job and scan script match their golden copies
not ok 69 - workflow-shape mutations are rejected
not ok 70 - the scan's timeout is pinned by its own check, not only the golden copy
# tests 74
# pass 71
# fail 3

648d4d5 (head)
# shape drop-timeout: old new, new caught
# shape timeout-unlimited: old new, new caught
# shape timeout-equals-spelling: old new, new caught
# shape add-timeout-threshold: old new, new caught
# tests 74
# pass 74
# fail 0
```

`git log --oneline` shows `5139bdb` (`gate.test.mjs` only, +38/−1) before
`40b3c3c` (both scripts +2 each, `knownFlags` +1).

**The diff matches the plan (conditions 1, 2, 7).** `git diff
origin/rebuild/dotnet-platform...HEAD` (three dots, merge base `cc99e20`):

```
 .github/security/gate.test.mjs                 |  40 +-
 .github/security/run-semgrep.expected.sh       |   2 +
 .github/security/run-semgrep.sh                |   2 +
 docs/changes/semgrep-timeout/implementation.md | 259 +++++++++++++
 docs/changes/semgrep-timeout/plan-approval.md  | 196 ++++++++++
 docs/changes/semgrep-timeout/plan-review.md    | 335 ++++++++++++++++
 docs/changes/semgrep-timeout/plan.md           | 515 +++++++++++++++++++++++++
 docs/changes/semgrep-timeout/test-report.md    | 292 ++++++++++++++
 8 files changed, 1640 insertions(+), 1 deletion(-)
```

I read the full code diff:

- Each script gains `  --timeout 30 \` directly after the `--output` line, and
  above `set +e` the comment `# Each rule gets 30 seconds per file; a Timeout
  still fails the gate. gate.test.mjs pins the value.` It contains none of the
  forbidden strings. The two scripts are identical.
- In `gate.test.mjs`:
  - the timeout check in `semgrepShapeProblems`, matching §3 point 2;
  - `"--timeout 30 \\"` added to `knownFlags`;
  - the four mutations after `add-max-target-bytes`, with the count going from
    26 to 30 (the only removed line);
  - the new test placed directly after "workflow-shape mutations are rejected".
    It checks that the unmodified files give no timeout problem, that each
    mutation exists and changes the script (`assert.notEqual`), and that each
    mutation draws the timeout message.
- `git diff --quiet origin/rebuild/dotnet-platform...HEAD --
  .github/security/gate.mjs .github/workflows` exits 0: neither `gate.mjs` nor
  any workflow changed. So a Timeout is still rejected at `gate.mjs:422`
  (P-6). The tester also fed a real local Timeout through it at 30 s and got
  exit 1.

**Merges against the live heads (condition 6).** `git fetch origin
rebuild/dotnet-platform change/GAP-07` (no `--depth`): base `f171f7a` (GAP-04,
#43), GAP-07 `e8a8d9d`. All `git merge-tree --write-tree` exit 0:

| Merge | Tree | Self-test on the tree | `--timeout 30 \` lines; golden copy |
| --- | --- | --- | --- |
| base `f171f7a` alone | — | `# tests 73`, `# pass 73`, `# fail 0` | 0; identical |
| `648d4d5` + base `f171f7a` | `5c80bb7` | `# tests 74`, `# pass 74`, `# fail 0` | 1; identical |
| `648d4d5` + GAP-07 `e8a8d9d` | `1037ad7` | `# tests 86`, `# pass 86`, `# fail 0` | 1; identical |
| (`648d4d5` merged with base) + GAP-07 | `82fb251` | `# tests 86`, `# pass 86`, `# fail 0` | 1; identical |

The last row is the tree #44 gets once the base takes this change.

**The failure is real on the base.** Using the GitHub API (read only):

- Base push run 42922461327 on `a866cf6`, job 130200612914, "Semgrep (ERROR
  fails, WARNING reported)" → `failure`, with
  `semgrep report field type is not a partial parse (error 1 of 35; level warn;
  type Timeout; path .github/security/gate.test.mjs; rule
  javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path)`.
- The pushes for `f5dd209`, `9c2a32b` and `f171f7a` passed (42925249855 on
  `f171f7a`).
- So the base still fails at random, as the plan says.

**Commits (condition 9, B-4).**

- Subjects are `semgrep-timeout:` and imperative.
- The bodies say why. Their claim that #41, #42 and #44 hit the timeout is
  confirmed by the tester's §7 (#42: job 130203984103 failed, 130204601188
  passed).
- Both attribution trailers are on all five commits (`grep -c` → 2 each).
- `git ls-remote origin refs/heads/change/semgrep-timeout` → empty, so nothing
  was pushed.

**The tester's evidence is real.** The red and green counts, the merge trees and
the #42 job ids I re-ran or re-read match the report. The tester also ran 20
mutations of the scan scripts, each applied to both copies and to the script
alone, and all 40 runs were caught. The tester ran gitleaks pr-diff with a
positive control as well. I accept both on the quoted commands and output.

## Conditions from gate 1

| # | Condition | Met | Evidence |
| --- | --- | --- | --- |
| 1 | Scope: three files plus `implementation.md` | Yes | Three-dot diff above; `gate.mjs` and workflows unchanged |
| 2 | Flag spelling and place; comment free of forbidden strings | Yes | Diff above; scripts identical |
| 3 | Red commit alone, 74/71/3 on 55, 69, 70 | Yes | `5139bdb` run above |
| 4 | Green 74/74 with four `new caught` lines; no push between | Yes | `648d4d5` run above; nothing on the remote |
| 5 | §5 steps 1 to 6 quoted as run | Yes | `implementation.md` steps 2 to 6; NOT RUN rows name the CI job |
| 6 | Merge checks against live heads, self-test on merged trees | Yes | Re-run here against `f171f7a` and `e8a8d9d` |
| 7 | Diffs against the merge base | Yes | `implementation.md` step 4 and the diff above |
| 8 | Done when 5 handed to #44 | Yes in the record | `implementation.md` coverage row 8; repeated in the PR description below; the coordinator passes it to GAP-07 |
| 9 | Commits: subjects, bodies, trailers, not pushed | Yes | Above |

**Deviation accepted.** `implementation.md` is its own commit (`1236536`), not
part of commit 2 as plan §4 put it. The code in `40b3c3c` is exactly §4's code,
and the separate commit lets the record quote that hash. The record fix
`648d4d5` changes only the "Deviations and notes" sentence about #42. It needs
no new test round: no code changed, and I checked the job ids it cites.

## Open items

1. **CI on this pull request (Done when 4, §5 step 8).** NOT RUN: not pushed. The
   PR's "Semgrep (ERROR fails, WARNING reported)" job must be green with no
   `type Timeout` line, and "Security gate self-test" must report 74. Record the
   base commit of the merge ref, the job id, and the Scan step's duration next to
   base run 42920334740. A Timeout at 30 s on this PR is a finding that goes back
   to the owner, not a reason to re-run.
2. **Done when 5, moved to PR #44 (GAP-07), after it merges the base.** GAP-07's
   tester re-runs #44's Semgrep job three times and records the three job ids in
   `docs/changes/GAP-07/test-report.md`. Not a requirement of this gate.
3. **Definition of Done boxes that cannot be ticked yet:**
   - "PR checks are green on the final head" (item 1).
   - "Independent code review was run". The plan review, the test report and
     both gates are role reviews in this pipeline. `/code-review` or a rotation
     check under `AGENTS.md` has not been run.
   - The deployment note, which needs the integrator's name.
4. **Owner's OK** to push the branch, open the pull request and merge it.

## Draft pull request description

```markdown
## Summary

Gives each Semgrep rule 30 seconds per file instead of the default 5. The
Semgrep job has been timing out on `.github/security/gate.test.mjs`, the longest
scanned file:

    semgrep report field type is not a partial parse (error 1 of 35; level warn;
    type Timeout; path .github/security/gate.test.mjs; rule
    javascript.express.security.audit.express-cookie-settings.express-cookie-session-no-path)

It has failed on:
- base push runs 42496209770 (`78ee598`) and 42922461327 (`a866cf6`, job
  130200612914);
- #41 (job 130198029247);
- #42 (job 130203984103; it passed on re-run);
- #44 (job 128779169900).

The same unchanged file passes on other runners, so the base sits on the
5-second edge, and every pull request can fail on it.

The gate is not weakened: a `Timeout` still fails it (`gate.mjs:422`, unchanged).
Nothing is excluded or skipped. The self-test now pins the value, so it cannot be
changed or dropped without a failing test that names it.

Change records: `docs/changes/semgrep-timeout/` (plan, plan review, both
approvals, implementation, test report).

## Scope and boundaries

In scope:
- `.github/security/run-semgrep.sh` and `.github/security/run-semgrep.expected.sh`:
  `--timeout 30` after `--output`, and one comment line saying why. The two
  files are identical.
- `.github/security/gate.test.mjs`:
  - `semgrepShapeProblems` requires the scan's `--timeout` lines to be exactly
    `--timeout 30`;
  - `knownFlags` accepts the line;
  - four new shape mutations (`drop-timeout`, `timeout-unlimited`,
    `timeout-equals-spelling`, `add-timeout-threshold`; count 26 → 30);
  - one new test proving the check fires on its own, not only through the golden
    copy.

Out of scope, not touched:
- `gate.mjs`;
- every workflow, `security.expected.yml` and `semgrep-job.expected.yml`;
- `.semgrepignore`, `known-findings.json` and `fail-on-rules.json`;
- `--timeout-threshold`, `--max-target-bytes`, `--jobs` and `--max-memory`, which
  stay at Semgrep's defaults.

The packs, excludes, roots and the Semgrep 1.180.0 pin are unchanged.

## Security impact

- No routes, policies, data, secrets or dependencies are affected. This is a CI
  change only.
- The same files and rules are scanned, and a Timeout still fails the gate.
- The only new exposure is time: a stalled rule can cost up to about 30 s per
  file instead of 5. It is measured locally at 31.7 s, and it is still reported
  and rejected. Semgrep skips a file after three timeouts on it
  (`--timeout-threshold` default 3).
- gitleaks pr-diff on the change: 0 findings, with a positive control caught.

## Owner decisions

- "yes" (Mohamed Elbadry, 10 November 2026, project timeline). This chose the
  option "Raise Semgrep's time limit: A small change gives Semgrep more time per
  file (e.g. 30s instead of 5s). Nothing is skipped; the scan may run a little
  longer." 30 is the card's own value.
- Pushing this branch, opening this pull request and merging it each need the
  owner's OK. The tech-lead approvals are pipeline roles, not owner decisions.

## Open items

- This PR's "Semgrep (ERROR fails, WARNING reported)" job must be green with no
  `type Timeout` line, and "Security gate self-test" must report 74 tests. Record
  the run ids and the Scan step's duration next to base run 42920334740.
- **Done when 5, moved to PR #44 (GAP-07), after it merges the base.** GAP-07's
  tester re-runs #44's "Semgrep (ERROR fails, WARNING reported)" job three times
  and records the three job ids and results in
  `docs/changes/GAP-07/test-report.md`.

## Follow-ups

- Add `timeout-minutes` to the Semgrep job in `security.yml` and both golden
  copies, as its own change (B-8). Today GitHub's 360-minute default bounds the
  job.
- If a Timeout recurs at 30 s, first measure the rule's real time with a one-off
  `--time` run, if the owner allows one. Then ask the owner before choosing a new
  value.
- Splitting `gate.test.mjs` by gate may help readability later, as its own
  change. The owner did not choose it as the fix.

## Test plan

- Red commit `5139bdb` (self-test only): `node --test
  .github/security/gate.test.mjs` gives 74 tests, 71 pass, 3 fail. Exactly
  tests 55, 69 and 70 fail, for the planned reasons.
- Head: 74 of 74 pass, with `shape <name>: old new, new caught` for the four new
  mutations.
- `diff run-semgrep.sh run-semgrep.expected.sh` gives no output, exit 0.
- `git merge-tree --write-tree`, each exit 0, with the self-test run on each
  tree:

  | Merged with | Self-test |
  | --- | --- |
  | base `f171f7a` | 74/74 |
  | GAP-07 `e8a8d9d` | 86/86 |
  | the base, then GAP-07 | 86/86 |

- 20 tester mutations of the scan scripts, each applied to both copies and to
  the script alone: 40 of 40 caught.
- Semgrep 1.180.0 accepts `--timeout 30` (exit 0, `errors []`). A real local
  Timeout at 30 s takes 31.7 s, and `gate.mjs semgrep` rejects it (exit 1).
- NOT RUN locally:
  - the registry packs (semgrep.dev is unreachable from the build container);
    covered by this PR's Semgrep job;
  - GAP-07's 2,149-line file in CI; moved to #44 (above).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such) — Done when 1 to 3 met; Done when 4's merge check met, its CI job open; Done when 5 moved to #44
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope — no route changed
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test — new check, four mutations and one test; red commit `5139bdb` before the fix
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed — plan review, test report and two tech-lead gates in `docs/changes/semgrep-timeout/`
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback) — revert; the 5-second default and the intermittent Timeout return together
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded — nothing deploys; integrator <name> merges into `rebuild/dotnet-platform` and re-runs the suites after the merge

## Review findings accepted

- Plan review Round 1: one Major and six Minors, all fixed in plan round 2.
  Round 2 had no findings.
- Test report Round 1, finding 1 (the record said there was no evidence for
  #42): fixed in `648d4d5`.
- Test report note B: moving the flag before `--metrics=off` fails only an
  existing mutation's text match. It is harmless, and nothing is weakened.
- `implementation.md` is its own commit rather than part of the code commit, so
  that it can quote the code commit's hash.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated — not applicable; the coverage table is in `docs/changes/semgrep-timeout/`
- [ ] `docs/deferred-items.md` updated for any exception — not applicable; no exception
- [x] Documentation updated — the comment in both scan scripts and the change records

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkF6ruKUzgGgv9dcZd
```

Verdict: APPROVED
