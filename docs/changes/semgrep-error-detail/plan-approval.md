# Plan approval: semgrep-error-detail (gate 1)

Technical lead, 8 November 2026. Gate 1, the plan. Reviewed `plan.md` (architect,
round 2, `6e038e3`) and `plan-review.md` (round 1 `CHANGES NEEDED`, round 2
`Verdict: APPROVED`, `0660484`) on `change/semgrep-error-detail`, base
`origin/rebuild/dotnet-platform` at `5c38406`.

Read first, from the reference copy at
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/ref/`
(none of these is on the base yet): `.claude/agents/tech-lead.md`,
`docs/changes/README.md`, `AGENTS.md` and `ENGINEERING_STANDARDS.md`. Also
`/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md` for the order, and
`docs/changes/ci-runner-pin/plan-approval.md` on the base for the shape.

This approval moves the change to the developer. It is not the owner's
confirmation that `AGENTS.md` requires, and it is not an owner decision.

## Decision

Approved, with the conditions below. It is the right change, it is one topic,
and it should go ahead now because it unblocks a Wave 1 pull request. The
reviewer's round 1 Major and six Minors are resolved. The two round 2 Minors
(findings 8 and 9) do not affect the design, and I attach each one as a
condition so it is not lost.

## Reasons

**The right change.** The gate in `.github/security/gate.mjs` rejects a
non-PartialParsing Semgrep error correctly, but the line says nothing about which
error it was. I checked the code myself:

- `validateSemgrep` (lines 383 to 396) runs the four checks in the order the plan
  quotes, with `for (const error of report.errors)` at line 389 and
  `replaceAll` at line 394. A `warn` error with a non-empty path and a
  non-PartialParsing type therefore produces exactly the #44 line, `semgrep
  report field type is not a partial parse`, and nothing else.
- Appending a strictly-sanitised detail after the existing message is the
  smallest change that makes #44's cause visible without weakening the gate
  (P-6): no check, order, exit code or consumed field changes.
- It matches the owner's words. "go on" (Mohamed Elbadry, 8 November 2026,
  project timeline), on the card "A new one-topic change makes the gate print the
  rejected error's type and path and keep the report, so #44's cause becomes
  visible." The plan delivers type and path (plus position, level and rule), and
  moves "keep the report" to follow-up F2 with owner question O-1.

**The split of "keep the report" is acceptable.** I accept the reviewer's
judgement and checked the reasons that matter: keeping the report would need an
`if:` on the redact and upload steps in `security.yml`, a change to
`redact-report.mjs` (which maps every error to `{ type: "redacted" }`), and their
golden copies, which is a second topic (B-8) in files PR #44 also edits. The plan
records the move correctly: coverage row "Moved to F2, pending O-1", a non-goal in
§1, and O-1 going to the owner with the pull request. It does not assume an
answer. The owner decision this change needs is quoted with date and place; O-1
does not block it, but it is open and must stay visible (condition 7).

**The plan's state, checked here.**

- Baseline, Node v22.23.4: `node --test .github/security/gate.test.mjs` gives
  `# tests 63`, `# pass 63`, `# fail 0`, exit 0. This matches §2.
- The two `\b<field>\b` assertions are at lines 549 and 561
  (`grep -n 'spec.field}\\\\b' .github/security/gate.test.mjs`), not 548 and 559.
  `const mutationCounts = {}` is at line 510, the mutation test is the template
  `${tool} mutations of every consumed field` at line 518, "a malformed semgrep
  PartialParsing type fails" ends at line 880, and `const requiredRoots` is at
  883. These anchors are right.
- One more small slip the reviewer did not name: the read-tracking proxy's
  `length` exclusion is at line 1541, not 1538. It does not change the design.
- The accepted line `semgrep parse warning: ${parsePath}` is at `gate.mjs`
  line 433.

**Conflicts with open branches.**
`gh api 'repos/mohya7/DH-WEBSITE/pulls?state=open'` lists #44 (GAP-07, `4e1e4fe`),
#43 (GAP-04), #42 (GAP-06), #41 (GAP-08), #40 (GAP-12) and #37. Diffing
`gate.mjs` and `gate.test.mjs` from each change branch's merge base:

| Branch | Touches `gate.mjs` / `gate.test.mjs` | State |
| --- | --- | --- |
| `change/GAP-07` (PR #44) | both | Open |
| `change/GAP-01` | `gate.test.mjs` | Merged as PR #39 (squash, `merged: true`); `git merge-tree --write-tree HEAD origin/change/GAP-01` exits 0 anyway |
| `change/GAP-04`, `GAP-06`, `GAP-08`, `GAP-12`, `ci-runner-pin` | neither | |

Only #44 overlaps. `origin/change/GAP-07` is `4e1e4febae7ddf8598ad7b3504b40a68f491b189`,
the head the plan names. `git merge-tree --write-tree HEAD origin/change/GAP-07`
on `0660484` exits 0 (tree `d1e58e3`). The reviewer also showed a prototype of
both edited files merging cleanly with `4e1e4fe`. The edits stay away from #44's
hunks (header after line 23 against #44's `@@ -26`; tests after line 880 against
#44's appends at the end of the file).

**Order.** The refinement plan runs two merge slots, and we are in step 2
(Wave 1, 3 to 16 November, slot 1). This change is not a refinement item and adds
no gate, but GAP-07 (Wave 1) cannot pass CI until its Semgrep cause is visible
and fixed. It should take the next slot 1 merge ahead of #44, and #44 then takes
it in (F1). It depends on nothing open.

**Risk.** Low. Gate decisions are unchanged; the risk table names a check for
each real risk, and the mutation-guard weakening found in round 1 is closed by
`withoutDetail` with a required regression check. The residual risk is that a
real tag, path or rule is stricter than the patterns allow and prints
`(unrecognised)`; even then `error i of n` and the other slots narrow the search,
and F1 shows the real line. I accept it.

## Reviewer Minors

- **Finding 8 (line numbers 548/559, and "unchanged" in §5).** Accepted as a
  record fix, not a design change. The plan is not edited; the developer applies
  the correct lines and records the correction (conditions 3 and 4).
- **Finding 9 (log injection in the accepted parse-warning line).** Not accepted
  as a mere note. I reproduced it on the base gate: a report with one error
  `{ level: "warn", path: "a\n::error::x", type: ["PartialParsing", []] }` and
  `node .github/security/gate.mjs semgrep <file>` prints

  ```
  semgrep parse warning: a
  ::error::x
  ```

  and exits 0. That is a workflow-command injection reachable by whoever can
  commit a file name with a newline. It stays out of this change (B-8; this
  change does not make it worse), but F3 must be recorded and raised as a
  security defect, not a cosmetic follow-up (condition 6).

## Conditions for the developer

1. **Scope.** Change only `.github/security/gate.mjs` and
   `.github/security/gate.test.mjs`, plus `implementation.md`, exactly as §3 and §4
   describe: helpers above `isPartialParse`, the plain indexed loop with no array
   method, detail built only inside the rejecting branches, `rule_id` not added
   to `consumedFields`, the header comment after line 23. No workflow, golden
   copy, redactor, `results`-loop rejection or line 433 change.
2. **Red tests first (P-4, B-6).** Commit `withoutDetail`, its two assertions
   and N1 to N10 alone as `semgrep-error-detail: Red tests`, with the failing run
   quoted in `implementation.md` (63 existing pass, each new test fails on the
   assertion its "Fails today on" column names). Then commit `gate.mjs`
   separately. Do not push between them.
3. **Use the real lines.** The `\b<field>\b` assertions to wrap with
   `withoutDetail(...)` are at lines **549 and 561** of `gate.test.mjs`, not 548
   and 559; the proxy's `length` exclusion is at line 1541. Record both
   corrections in `implementation.md` (review finding 8).
4. **Report the mutation test as tightened, not unchanged.** Where §5 says the
   63 existing tests are "unchanged and green", `implementation.md` reports 62
   unchanged and one tightened ("mutations of every consumed field"), all green,
   and the final count (73 expected), quoted as run.
5. **Prove the guard and the output.** Quote the §3.3 regression check
   (`node --test --test-name-pattern='semgrep mutations' .github/security/gate.test.mjs`
   reports `# fail 1` with the type check folded into the level check), restore
   `gate.mjs`, and never commit the regression. Quote stderr and exit code `1`
   for one N1 and one N5 fixture run through the CLI.
6. **Record F3 as a security defect.** In `implementation.md`'s follow-ups, F3
   reads as a workflow-command (log) injection in the accepted
   `semgrep parse warning: <path>` line, with the reproduction above (exit 0,
   second line `::error::x`), to be scheduled as its own security change. It is
   not fixed in this change. The pull request description carries it too.
7. **O-1 stays open in the record.** `implementation.md` and the pull request
   say "type, path and rule printed; keeping the report moved to F2, pending
   O-1", and never describe the owner's card as fully delivered.
8. **Merge check against the live #44 head.** Run
   `git merge-tree --write-tree HEAD origin/change/GAP-07` on the final head and
   quote it. If #44's head is no longer `4e1e4fe`, say so and check against the
   new head. A conflict in either file is reported before anything else is done.
9. **Commits (B-4).** Subjects prefixed `semgrep-error-detail:`, imperative, a
   body that says why (the #44 line names no error), and the attribution
   trailers. Do not push or open the pull request; the orchestrator does that.

## Notes for the tester and gate 2

- C1 "Security gate self-test" must report the same count as the developer's
  local run. C2 Semgrep is expected green on this branch; if it fails, the new
  detail line is quoted and reported as a finding.
- The F1 proof (the detail line on #44's re-run) comes after this merges and is
  not a gate 2 requirement for this change.

Verdict: APPROVED
