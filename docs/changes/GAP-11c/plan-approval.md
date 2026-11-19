# GAP-11c plan approval (gate 1)

Reviewed `plan.md` round 2 and `plan-review.md` (round 2: `Verdict: APPROVED`) at base `74d62e9` (= `origin/rebuild/dotnet-platform`).

## Decision

Approved for development.

## Reasons

- Right change: it closes the GAP-11 tester round-2 Minors 1 and 2, which GAP-11 `delivery-approval.md` explicitly deferred to GAP-11c. One topic (B-8), four files, build-time check only.
- Right point in the order: G1, Wave 1, hardening an existing gate. It adds no new gate and leaves `SRI_BLOCKING_FROM = "2026-11-26"` unchanged, so it does not jump the sequencing. Its parent GAP-11 is merged (#75).
- Conflicts: `git branch -r --no-merged` lists change/ADM-02, ADM-07, GAP-01, GAP-11 and GAP-NEXT-UPGRADE as touching the same files. These were squash-merged, so ancestry does not show them as merged. GAP-11 (#75) and GAP-NEXT-UPGRADE (#72) are confirmed on the base. I found no open, unmerged change in flight on `check-output.ts`, `output.test.ts` or `website/package*.json`.
- Design: a spec tokenizer (parse5, already in the tree via jsdom) plus WHATWG URL resolution replaces the regexp approach, which failed twice. Failing closed on unparsable src and on multi-hash in the browser is sound. The single-backslash correction (it resolves same-origin) is right and is tested both ways.
- Owner decision O-1 is quoted ("CI level is enough"). The criterion is `npm audit --audit-level=high`, matching `security.yml:84`. No owner decision is open.
- Risk is low: the change is dev-only, has no schema or data change, its rollback is a revert, and the `out/` diff against base proves no change to rendered output.

## Conditions for the developer

1. Commit tests 1 to 6 first, and record the red output in `implementation.md` before the fix: tests 1 to 5 red, test 6 and the guards green (B-6).
2. Install with `npm install --save-dev --save-exact parse5@8.0.1`, never hand-editing the lockfile. Show `npm ls parse5` with a single deduped 8.0.1, and show that the lockfile diff only adds the root devDependency entry.
3. The existing GAP-11 test blocks stay byte-for-byte unchanged.
4. Run the `diff -r` of `out/` between base and branch with the same env, and record that it finds no differences.
5. Run `check:csp` on ports 4225/4226 only.
6. `SRI_BLOCKING_FROM` grep shows no changed line.

## Reviewer's Minors accepted

- Round 2 Minor 1 (helpers are local to the round-2 describe block): accepted as guidance. The new GAP-11c block defines its own `bad`/`good`/`full` with the same signatures, without moving the existing ones. The developer notes this in `implementation.md`.

This approval is not the owner's confirmation. The push and the merge still wait for the owner after gate 2.

Verdict: APPROVED
