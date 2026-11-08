# Delivery approval: semgrep-error-detail (gate 2)

Technical lead, 8 November 2026. Gate 2, the implementation and the tests.
Reviewed `change/semgrep-error-detail` at head `72fc259`: red tests `331b19b`,
fix `a937510`, implementation record `8677d40`, and `test-report.md` Round 1
(`72fc259`, taken from the tester's detached commit `18c89a8`,
`Verdict: APPROVED`). Checked against `plan.md` (round 2, `6e038e3`),
`plan-review.md` (latest round `Verdict: APPROVED`) and my `plan-approval.md`
(`444d178`, nine conditions).

Read first: `docs/changes/README.md`, `.claude/agents/tech-lead.md`, `AGENTS.md`
and `ENGINEERING_STANDARDS.md` (reference copy in the scratchpad `ref/` folder),
the pull request template (`origin/claude/cool-heisenberg-mh6zx9`), and every file
in this folder. Shape follows `docs/changes/ci-runner-pin/delivery-approval.md` on
the base.

This approval moves the change to the owner. It is not the owner's confirmation
that `AGENTS.md` requires, and it is not an owner decision. Pushing, opening the
pull request and merging each still need the owner's own OK.

## Decision

Approved for everything this container can prove. The diff is the approved plan
and nothing else, the red commit precedes the fix, all nine gate-1 conditions are
met, and every check I re-ran gives the result the records quote. The change must
not merge until the pull request's CI on the final head shows C1 to C3 as the plan
defines them (open item 1). O-1 stays open and does not block the merge.

## What I verified myself

**Base and #44 unchanged.** `git ls-remote origin rebuild/dotnet-platform
change/GAP-07 change/semgrep-error-detail` gives `5c38406…` for the base and
`4e1e4fe…` for #44, and no `change/semgrep-error-detail` on the remote.
`git branch -r --contains 331b19b` is empty: nothing was pushed.

**Diff scope (condition 1).**

```
$ git diff --stat origin/rebuild/dotnet-platform...HEAD -- .github/ api website studio packages
 2 files changed, 192 insertions(+), 8 deletions(-)      # gate.mjs +35/-6, gate.test.mjs +157/-2
```

The other changed files are the six records in `docs/changes/semgrep-error-detail/`.
I read the whole code diff:

- `gate.mjs`: four header comment lines after old line 23; three pattern
  constants, `shown()` and `describeSemgrepError()` above `isPartialParse`, none
  exported, patterns exactly as §3.1; the errors loop is a plain indexed `for`;
  the detail is built inside each `reject(...)` template, so only after a check
  has failed; the check order, `reject`, `consumedFields`, the `results` loop and
  the accepted `semgrep parse warning:` line are unchanged.
- `gate.test.mjs`: `withoutDetail()` above `const mutationCounts`, the two
  `\b<field>\b` assertions at base lines 549 and 561 now match
  `withoutDetail(...)` (condition 3), and N1 to N10 after the malformed
  PartialParsing test. No other existing line changed.

**Red first (P-4, B-6, condition 2).** `331b19b` changes only `gate.test.mjs` and
precedes `a937510`, which changes only `gate.mjs`. I ran the red commit in its own
detached worktree (removed afterwards):

```
$ node --test .github/security/gate.test.mjs        # at 331b19b
not ok 45 … not ok 54   (exactly N1 to N10)
# tests 73
# pass 63
# fail 10
```

**Suite on the head (condition 4).** Node v22.23.4:

```
$ node --test .github/security/gate.test.mjs        # at 72fc259
# tests 73
# pass 73
# fail 0
exit 0
```

62 existing tests are unchanged, 1 is tightened, and 10 are new, as
`implementation.md` reports.

**Merge with PR #44 (condition 8).**

```
$ git merge-tree --write-tree HEAD origin/change/GAP-07     # HEAD = 72fc259, #44 = 4e1e4fe
a2ceac1911828f2921cc60cbb3f07c1448df4030
exit 0
$ git archive a2ceac1 | tar -x -C <scratch>/mrg && node --test .github/security/gate.test.mjs
# tests 85
# pass 85
# fail 0
exit 0
```

The tree differs from the developer's `ec4fc0a` and the tester's `454e763` only
because the head now carries more records. (A first run on a partial extraction
of `.github/security` alone failed six golden-copy tests, because they compare
against `.github/workflows` and `.gitattributes`. On the full tree, all pass.)

**Hostile fixtures, my own (condition 5).** Four reports with a canary in
`message`, `spans` and `type[1]`, run as CI runs it:

```
a.json  type ["X ::error::t2",[c]], rule "r\n::add-mask::<canary>"
  … field type is not a partial parse (error 1 of 1; level warn; type (unrecognised); path ok/p.cs; rule (unrecognised))   exit 1
b.json  level "warn\r\n::warning::lv", path "a b"
  … field level is not a parse warning (error 1 of 1; level (unrecognised); type Timeout; path (unrecognised); rule (none))   exit 1
c.json  path "x/(error 9 of 9; level warn)", rule_id "é"
  … field type is not a partial parse (error 1 of 1; level warn; type Timeout; path (unrecognised); rule (unrecognised))   exit 1
d.json  valid PartialParsing, path "..\\..\\<U+200B>evil"
  semgrep parse warning: ..//..//<U+200B>evil   exit 0
```

a to c: one line each, no canary, no line starting `::`, and the forged
` (error …)` text in the path is refused. d is the accepted line, which this
change does not touch. It prints a zero-width character unsanitised. That is F3
again, not a regression (the tester shows identical F3 output on base and head).

**Mutation guard (condition 5).** I did not repeat the §3.3 regression. The
developer quotes `# fail 1` with `semgrep ["errors",0,"type"] null did not name
the field`, and the tester reproduced it independently (M7, fail 16). I accept
the two independent runs.

**Records (conditions 3, 6, 7).** `implementation.md` records the 549/561 and
1541 corrections, the "62 unchanged, 1 tightened" count, F3 as a
workflow-command injection security defect with the reproduction, and O-1 in the
words "type, path and rule printed; keeping the report moved to F2, pending O-1".

**Commits (B-4, condition 9).**

| Commit | Subject | Body says why | Trailers |
| --- | --- | --- | --- |
| `331b19b` | `semgrep-error-detail: Red tests` | Yes | Both |
| `a937510` | `semgrep-error-detail: Name the rejected Semgrep error in the gate message` | Yes: #44's line names no error | Both |
| `8677d40` | `semgrep-error-detail: Record the implementation` | Yes | Both |
| `72fc259` | `semgrep-error-detail: Test report round 1` | Yes | Both |

**The tester's evidence is real.** Each check is quoted with command, exit code
and output. The ones I repeated (red and green counts, scope, merge and merged
suite, hostile output, F3 unchanged) agree. The 24-mutation table and the 178
hostile fixtures go beyond the plan. Semgrep and CI are written NOT RUN, each
naming its job.

## The tester's Minor and F3: how they are carried

- **Tester finding 1 (Minor, pre-existing): the self-test does not pin the
  accepted level to exactly `"warn"`.** Accepted for this change and carried as
  follow-up **F4**: a test-only change adding fixtures where `level: "warning"`
  and `level: "info"` with a valid PartialParsing type must fail. Reasons: it
  survives identically on the base `5c38406`, so this change does not widen it;
  the gate itself is correct (`error.level !== "warn"`), and only the self-test's
  power is short; and adding it here would be a second topic (B-8) after the
  plan was approved. Because it is a gap in a security gate's guard (P-6), F4
  should be scheduled with F3, not left open-ended.
- **F3 (security defect): workflow-command injection in the accepted
  `semgrep parse warning: <path>` line** (`gate.mjs` line 462 after this change).
  Not fixed here, as approved at gate 1. It is present on the base today and
  reachable by anyone who can commit a file name containing a newline. It goes
  in the pull request's Follow-ups as a security defect and needs its own change
  through this pipeline, scheduled ahead of ordinary Wave 1 work. It is not an
  exception, so no D-NNN entry. If the owner wants it tracked as one with an
  expiry instead, that is the owner's decision.

## Open items

1. **CI on the final head (blocks merge).** The branch is not pushed. The final
   head will be the commit that adds this file. On that head's run:
   - C1 "Security gate self-test": success with `# tests 73`, `# pass 73`.
   - C2 "Semgrep (ERROR fails, WARNING reported)": success expected. If it fails,
     the log line now carries the detail; quote it and report it before anyone
     fixes anything.
   - C3 the CI workflow's jobs: unaffected by this change; quote their
     conclusions. A red job that is not explained by an existing, named cause
     blocks.
2. **Owner's OK to push, open the pull request and merge.** `AGENTS.md` requires
   it. This approval does not replace it.
3. **O-1 is open.** It goes to the owner with the pull request. It does not block
   the merge, but until it is answered nobody describes the owner's card as fully
   delivered.
4. **Definition of Done boxes that cannot be ticked yet:** "PR checks are green on
   the final head" (item 1), "Independent code review was run" (the plan review,
   test report and both gates are role reviews in this pipeline; `/code-review`
   or a rotation check under `AGENTS.md` has not been run), and the deployment
   note (needs the integrator's name).
5. **F1 after merge.** PR #44 takes this change in and re-runs its Semgrep job;
   the detail line is quoted there. That is the proof the owner's goal was met,
   and it is not a requirement of this gate.

## Draft pull request description

```markdown
## Summary

The Semgrep gate now says which Semgrep error it rejected (change id `semgrep-error-detail`; a CI diagnosability defect, not a refinement-plan item; the existing gate G-10).

PR #44 (GAP-07) fails its Semgrep job with only:

    /home/runner/work/_temp/semgrep.json: semgrep report field type is not a partial parse

(job 126448055869). The line names no error, so nobody can tell what Semgrep hit. Each rejection in `validateSemgrep`'s errors loop now keeps its message unchanged and appends a detail:

    … field type is not a partial parse (error 2 of 3; level warn; type Timeout; path website/src/app/[[...path]]/page.tsx; rule javascript.lang.security.audit.example)

The detail gives the entry's position and, except for a non-object entry, its level, type tag, path and `rule_id`. Each value must match a strict bounded pattern with no `:`, `;`, `(`, `)`, quote, control character or non-ASCII, or it prints as `(none)` or `(unrecognised)`, so it cannot form a workflow command. The error's `message`, `spans` and `type[1]` are never read. A malformed PartialParsing type prints `type PartialParsing (malformed)`.

Delivered: type, path and rule printed; keeping the report moved to F2, pending O-1.

Records: `docs/changes/semgrep-error-detail/` (plan, plan review, gate 1, implementation, test report, gate 2).

## Scope and boundaries

In scope: `.github/security/gate.mjs` (+35/−6) and `.github/security/gate.test.mjs` (+157/−2).

Not touched: `security.yml` and every `*.expected.*` golden copy, `run-semgrep.sh`, `redact-report.mjs`, `known-findings.json`, `consumedFields`, every `results`-loop rejection, the rejections for npm, dotnet and gitleaks, and the accepted `semgrep parse warning:` line (F3). The cause of #44's error is not fixed here; it becomes visible (F1).

## Security impact

No route, policy, data, secret or dependency changes. Gate decisions are unchanged: same checks, same order, exit 1, same consumed fields (P-6). The CI log gains up to four strictly-checked tokens per rejection. The self-test's mutation guard is tightened so the detail's words cannot make it pass when the wrong check rejects.

## Owner decisions

- Starting the change: "go on" (Mohamed Elbadry, 8 November 2026, project timeline), answering the card "A new one-topic change makes the gate print the rejected error's type and path and keep the report, so #44's cause becomes visible."
- Pushing, opening this pull request and merging need the owner's own OK; the pipeline's approvals do not replace it.
- **O-1, open:** "This change prints the rejected error's type, path and rule, and does not change the uploaded report. Do you still want the report kept when the Semgrep job fails (follow-up F2, which changes `security.yml`, `redact-report.mjs` and their golden copies), or is the printed detail enough?" Not answered; no answer is assumed. It does not block this merge.

No exception is taken; no D-NNN entry.

## Open items

- CI on the final head (C1 to C3 below) must be green and quoted before merge.
- The owner's OK to push and merge.
- O-1.

## Follow-ups

- **F1.** After this merges, PR #44 takes it in and re-runs its Semgrep job; the detail line is quoted there, and the cause is fixed in its own change.
- **F2.** Keep the report when the Semgrep job fails, only if O-1 says so (or F1's detail is not enough).
- **F3, security defect.** Workflow-command injection in the accepted `semgrep parse warning: <path>` line. A valid PartialParsing warning with path `"a\n::error::x"` exits 0 and prints a second line `::error::x`; a file name with a newline is enough. Present on the base, unchanged here. Its own security change, scheduled ahead of ordinary Wave 1 work.
- **F4.** The self-test does not pin the accepted level to exactly `"warn"`: replacing the check with `["warn","warning"].includes(level)` passes the suite on base and head (tester finding 1, pre-existing). Test-only change: `level: "warning"` and `level: "info"` with a valid PartialParsing type must fail. Schedule with F3.

## Test plan

Local, Node v22.23.4:
- Base `5c38406`: `node --test .github/security/gate.test.mjs`: 63 / 63, exit 0.
- Red commit `331b19b` (tests only): 73 tests, 63 pass, 10 fail, exactly N1 to N10, exit 1.
- Head: 73 / 73, exit 0 (62 unchanged, 1 tightened, 10 new).
- Mutation-guard regression (type check folded into the level check, never committed): `semgrep mutations` fails, `semgrep ["errors",0,"type"] null did not name the field`.
- Tester: 23 of 24 gate mutations caught (the survivor is F4, pre-existing); 178 hostile fixtures exit 1 with one line, no line starting `::`, no injected text, no canary from `message`, `spans`, `type[1]` or extra fields.
- `git merge-tree --write-tree HEAD origin/change/GAP-07` (#44 at `4e1e4fe`): exit 0; the merged tree's suite: 85 / 85, exit 0.
- gitleaks `pr-diff` on the change: 0 findings.
- Semgrep locally: NOT RUN, registry packs unreachable; covered by C2.

CI on this PR (fill in run and job ids):
- C1 "Security gate self-test": success, `# tests 73`. Job <id>.
- C2 "Semgrep (ERROR fails, WARNING reported)": success expected; if red, the detail line is quoted. Job <id>.
- C3 CI workflow jobs: conclusions quoted. Run <id>.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such) — plan §1 Done-when 1 to 3; "keep the report" moved to F2, pending O-1; F1 proves the goal on #44 after merge
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope — no route changed
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test — N1 to N10, red commit `331b19b` before the fix
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed — plan review, test report and two tech-lead gates in `docs/changes/semgrep-error-detail/`
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback) — revert; the message loses its detail
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded — nothing deploys; integrator <name> merges into `rebuild/dotnet-platform` and re-runs the suites after the merge

## Review findings accepted

- Plan review Round 1: one Major and six Minors, fixed in plan round 2.
- Plan review Round 2, finding 8 (line numbers, "unchanged"): corrected in `implementation.md`.
- Plan review Round 2, finding 9: recorded as F3, a security defect, out of scope (B-8).
- Test report Round 1, finding 1 (level not pinned to `"warn"`, pre-existing): carried as F4.
- Test report note A: a tag, path or rule that matches its pattern is printed, even if secret-shaped; by design, since these come from Semgrep, the rule pack and the file path, not scanned content.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated — not applicable; the coverage table is in `docs/changes/semgrep-error-detail/`
- [ ] `docs/deferred-items.md` updated for any exception — not applicable; no exception
- [x] Documentation updated — the `gate.mjs` header and the change records
```

Verdict: APPROVED
