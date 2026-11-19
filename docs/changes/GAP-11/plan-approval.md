# GAP-11 plan approval (gate 1)

## Decision

Approved. The developer may start on these conditions. This approval is not an owner decision.

## Reasons

- It is the right change. It closes GAP-11 (G1, Wave 1) in the register's own words. SRI meets the "or" in the owner's request ("an integrity hash or a local fallback"), so the fallback can be rejected. The plan gives the reason: an inline fallback would break the CSP.
- Order: this is a Wave 1 item, and it does not depend on ISO-4 or ISO-5. It is not a Blocker that jumps the queue.
- Conflicts: none of the open remote branches I checked (change/GAP-12, GAP-08, GAP-06, GAP-04, GAP-01, ADM-10) touch `website/src/design/*`, `website/scripts/check-output.ts`, `website/test/design.test.ts` or `website/test/output.test.ts`. I ran `git diff --name-only` against `origin/rebuild/dotnet-platform` to check.
- Risk is low. The change is front-end only, adds no dependencies and has no migrations. A wrong hash fails loudly in the browser suite. Rollback is a revert.

## Owner decisions

- **O-1 (Tabler Icons stylesheet)** does not block. The register and "Done when" cover scripts only. The plan's default is that GAP-11 covers scripts only, and Tabler goes to a possible follow-up (GAP-11b) if the owner wants it. The question still goes to the owner, and the answer must be quoted in the records before the pull request.
- **O-2 (block at once or report for seven days)** does not block the start. The plan's default is the one the standard requires: report mode through `SRI_BLOCKING_FROM`, seven days after the merge. The developer builds that default unless the owner's own words say otherwise. Switching to blocking at once later means removing one date, which is a small change. Whichever mode ships, the owner's answer must be quoted in `implementation.md` before gate 2.

## Conditions for the developer

1. Reviewer Minor 1: put `SRI_BLOCKING_FROM` in `website/scripts/check-output.ts`, or in a module it imports, as an ISO date constant. Before that date, the check prints each problem as a warning and exits 0. On and after it, the check fails the build with a non-zero exit. Test 3 must show that the problem is detected in both modes and that the exit code follows the mode. Record this in `implementation.md`.
2. Reviewer Minor 2: test 3 goes in `website/test/output.test.ts`.
3. Reviewer Minor 3: the rule must also match protocol-relative `//host/...` sources. Test 3 includes a `//` case.
4. Derive the hashes a second time, independently, as the plan describes. If either derivation gives a different hash, stop and report it.
5. Commit the failing tests first, as their own commit, before the fix (B-6). Follow B-4 for commit subjects and trailers.
6. Change nothing outside section 4 of the plan. If `design-sources.ts` needs a change, report it.

## Reviewer Minors

I accept none of the three Minors as left open. Each becomes a condition above (1 to 3). None of them needs a new plan round.

Verdict: APPROVED
