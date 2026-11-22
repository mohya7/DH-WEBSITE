# GAP-11c-deferred: record the two GAP-11d follow-ups in the deferred-items register

## 1. Item

- Closes: the governance condition of GAP-11c gate 2
  (`docs/changes/GAP-11c/delivery-approval.md` line 24): "the two follow-ups
  above are to be added to `docs/deferred-items.md`, either at the merge or in
  GAP-11d."
- Track: G1, Wave 1 (GAP-11 family, supply chain), records only.
- Parent "Done when" (refinement plan line 160, GAP-11): "Every external script
  in the built pages carries `integrity`". This change does not move that
  criterion; it records two accepted residuals against it.
- Owner request: "do item 3" (2026-11-22, via the orchestrator).

## 2. Current state

- `docs/deferred-items.md` at 266b124 has the entry template and "No entries
  yet."
- Open branches checked for claimed ids (`git show <branch>:docs/deferred-items.md`
  over all local and remote `change/*` branches): only `change/GAP-05` claims
  an id, `D-001` ("The screenshot comparison does not block yet"). Next free
  ids: D-002, D-003. Re-check at commit time; whoever lands second renumbers.
- Source findings:
  - `docs/changes/GAP-11c/test-report.md` lines 50-51, 55-56 (Minor 1: SVG
    `<script href>` returns `[]`; Minor 2: 5000 nested `<div>` throws
    `RangeError: Maximum call stack size exceeded`, also at 20000).
  - `docs/changes/GAP-11c/delivery-approval.md` lines 17-18 and 71-72: both
    follow-ups target GAP-11d; Minor 1 is not a regression, Minor 2 fails closed.
- GAP-11d must wait for GAP-11b to merge: both edit
  `website/scripts/check-output.ts` (parallel changes must change different files).

## 3. Design

Add two entries in the file's exact template form (as D-001 on `change/GAP-05`
does), replacing "No entries yet.":

- **D-002: Inline SVG `<script href>` is not checked for integrity.**
  Rule waived: GAP-11 "Done when" (every external script carries `integrity`),
  under ENGINEERING_STANDARDS.md section 8 (supply chain), for inline-SVG
  `<script href>` only. Justification: from the test report; the base regexp
  check missed it too (not a regression); generated pages contain no inline-SVG
  scripts today. Follow-up work: GAP-11d makes `checkScriptIntegrity` flag
  `<svg><script href|xlink:href>` with an external URL; it waits for GAP-11b.
- **D-003: Very deep nesting overflows the recursive walk in `scriptElements`.**
  Rule waived: none loosened (the check fails closed by throwing); recorded as
  an accepted residual. Justification: about 5000 levels throws
  `RangeError`; generated output never nests that deep. Follow-up: GAP-11d
  replaces the recursive `walk` with an iterative one, with a test at 5000 and
  20000 levels.

The Owner decision, Follow-up owner and Expires lines use the owner's answers
to O-1 to O-3, quoted in section 9. `Follow-up pull request: not opened`.

Rejected: one combined entry (they have different rule status and may close
separately); recording them only in GAP-11d (gate 2 asked for the register now,
and the register is where gates look); inventing an expiry (the register forbids
entries the owner has not decided).

## 4. Scope

- Change: `docs/deferred-items.md` — replace "No entries yet." with D-002 and
  D-003.
- Create: `docs/changes/GAP-11c-deferred/` records (this plan and the later
  pipeline records).
- Out of scope: any code, including `website/scripts/check-output.ts` and its
  tests (GAP-11d); D-001 (GAP-05 branch); the refinement plan table.

## 5. Test plan

No code, so no failing test first. Checks after the edit:

- `git diff --stat origin/rebuild/dotnet-platform` shows only
  `docs/deferred-items.md` and `docs/changes/GAP-11c-deferred/*`.
- Each entry has all six template lines, in order, with no placeholder text:
  `grep -n -E "^- (Rule waived|Justification|Owner decision|Follow-up owner|Expires|Follow-up pull request):" docs/deferred-items.md`
  returns 6 lines per entry.
- `Expires` is a valid future `YYYY-MM-DD`; Owner decision quotes match the
  owner's answers verbatim.
- Ids re-checked against all open branches at commit time.
- Workflow lint / markdown checks run by CI pass on the pull request.
- Track checklist (G1 Waves 1 to 3): one topic per pull request (B-8) — yes;
  no gate added or loosened; baselines unchanged.

## 6. Security impact

None to routes, policies, data, logins, secrets or dependencies. The records
make two known gaps in the integrity check visible and time-bound; nothing is
loosened.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request.

## 9. Owner decisions needed

None open. Answered by the owner on 2026-11-22, via the coordinator:

- O-1: "Yes, defer both". This is quoted on both D-002 and D-003 as
  `Owner decision: "Yes, defer both" (2026-11-22, via the coordinator; O-1, GAP-11c-deferred)`.
- O-2: "2026-12-15". This becomes `Expires: 2026-12-15` on both entries.
- O-3: "The /change pipeline". This becomes
  `Follow-up owner: "The /change pipeline" (owner, 2026-11-22, via the coordinator)` on both entries.

## 10. Risks

- Id clash with D-001 on `change/GAP-05` or another branch: re-check at commit;
  renumber if second.
- The expiry (2026-12-15) passes before GAP-11b and GAP-11d merge, and a gate
  citing the entry fails. The owner set this date. If it slips, the entries
  need a new owner decision; the agents do not extend them.
- Wording drifts from the test report: the reviewer compares against
  test-report.md lines 55-56.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| D-002 SVG `<script href>` entry added in template form | delivery-approval.md l.17, 24; test-report.md l.55 | Planned | |
| D-003 recursive walk overflow entry added in template form | delivery-approval.md l.18, 24; test-report.md l.56 | Planned | |
| Both entries name GAP-11d and its wait on GAP-11b | owner request | Planned | |
| Owner quote, owner and expiry filled from the owner only | deferred-items.md header | Planned | |
| Only records files changed | owner request | Planned | |

## 12. Revision log

- Round 0: first version; no review records exist.
- Round 0a (2026-11-22): the owner answered O-1 ("Yes, defer both"), O-2
  ("2026-12-15", both entries) and O-3 ("The /change pipeline"). I recorded
  them in sections 3, 9 and 10. No decisions are open.
