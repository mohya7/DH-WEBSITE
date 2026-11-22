# GAP-11c-deferred: plan approval (gate 1)

## Decision

Approved, with the conditions below.

## Reasons

- `plan-review.md` round 1 says `Verdict: APPROVED`.
- This is the right change. It closes the governance condition from GAP-11c gate 2
  (`docs/changes/GAP-11c/delivery-approval.md` line 24). It touches records only,
  so it does not take a code merge slot from GAP-11b or GAP-11d, and it puts nothing
  ahead of a Wave 0 item or a Blocker.
- Conflicts: `origin/rebuild/dotnet-platform` is at 266b124, the plan's base. Many
  old branches differ from the base on `docs/deferred-items.md` only because they
  predate the file. The architect found that only `change/GAP-05` adds an entry
  (D-001), and the plan handles that with ids D-002 and D-003 and a renumbering rule.
  The risk is acceptable.
- The owner decisions O-1 to O-3 (2026-11-22) are quoted verbatim with their date
  and channel. None are open.

## Conditions for the developer

1. Minor 1 (fix it): drop "under ENGINEERING_STANDARDS.md section 8 (supply chain)"
   from D-002's Rule waived line. Cite only the GAP-11 "Done when" (refinement plan
   line 160).
2. Minor 2 (fix it): either prove "Generated pages contain no inline-SVG scripts
   today" or remove it. To prove it, build the website, grep the built output for
   inline-SVG `<script`, and put the command, its exit code and its output in
   `implementation.md`. If you do not run the check, delete the claim. "Not a
   regression" is already supported by the evidence, so keep it.
3. Minor 3 (accept, record it): in `implementation.md`, name the CI workflows that
   actually trigger on a docs-only pull request, read from their `paths` filters in
   `.github/workflows/`. If none trigger, say so. I will check this at gate 2.
4. Before you commit, check every open branch again for ids it claims. If D-002 or
   D-003 has been taken, renumber.
5. Change only `docs/deferred-items.md` and `docs/changes/GAP-11c-deferred/*`. Use
   the six template lines in order, with the owner quotes copied exactly as in plan
   section 9.
6. The commit subject and trailers follow B-4. Do not push. The owner confirms the
   push.

## Reviewer Minors

- Minors 1 and 2 must be fixed (conditions 1 and 2).
- Minor 3 is left as it is in the plan; condition 3 settles it at delivery.

This approval is not owner confirmation of the push or the merge.

Verdict: APPROVED
