# Plan approval: GAP-09

## Round 1

Tech lead, gate 1, 19 November 2026, against `plan.md` round 1 and
`plan-review.md` round 1 (`Verdict: APPROVED`) on `change/GAP-09` at `8b5d6a5`.

Owner's request, exactly: "GAP-09 pin every GitHub Action by 40-character SHA, the
SQL Server image by digest, and Node and .NET to exact versions".

### Decision

Approved, with the conditions below. This approval passes the plan to the
developer. It is not an owner decision and does not replace the owner's
confirmation of the push and the squash-merge.

### Reasons

- **Right change.** The plan does exactly what the owner asked: actions by commit
  SHA, the image by digest, Node and .NET exact. It quotes the register row and
  the "Done when", and it correctly does not claim GAP-10.
- **Right point in the order.** G1 Wave 0 (GAP-01 to GAP-03) is done on the base.
  Wave 1 gates GAP-04, GAP-06, GAP-07 and GAP-08 are merged (#43, #42, #44, #41).
  GAP-09 adds no gate and has no Blocker ahead of it on these files. ISO-4/ISO-5
  do not apply.
- **No branch conflict.** I checked `git branch -r` and the open worktrees. The
  remote branches that touch `.github/workflows` or `.github/security`
  (`change/GAP-04`, `GAP-06`, `GAP-07`, `GAP-08`) are already squash-merged; their
  two-dot diffs against the base are only stale history. GAP-11 and ADM-12 do not
  touch `.github/`. GAP-05 has no branch yet; the plan keeps its lines
  (`ci.yml:291-296`, `:326`, `:398`) out of scope, as the caller required.
- **Risk acceptable.** Text-only changes to workflow inputs, each new value equal
  to what CI resolves today (shown by run 44420794105 and `git ls-remote`). A
  wrong SHA or digest fails loudly in CI. Rollback is a revert.
- **Owner decisions.** None needed: the request names every value kind, and the
  production SQL Server major stays under GAP-10.

### Reviewer's Minors

All three are accepted as conditions, not left open:

1. Minor 1 (line endings): condition C-1.
2. Minor 2 (CodeQL check): condition C-2.
3. Minor 3 (GAP-05 comment lines): condition C-3.

### Conditions for the developer

- **C-1.** `security.expected.yml` gets the same content edits as
  `security.yml`; each file keeps its own line endings (`.gitattributes`:
  `*.expected.yml text eol=lf`). Do not copy one file over the other.
- **C-2.** CodeQL runs on `pull_request` (`codeql.yml:20`). The test report must
  show init and analyze green on the head with
  `Download action repository 'github/codeql-action@9418214df1f2c4b8128c770156c409013b07d6b9'`.
  NOT RUN only if the run is truly absent, with the reason.
- **C-3.** Do not touch the GAP-05 lines. Prove it beyond P-6: the content of the
  GAP-05 comment block (base `ci.yml:291-296`) and the two
  `continue-on-error: true` lines (base `:326`, `:398`) is identical on the head,
  allowing only for the line shift from the new pin comment, and no diff hunk
  changes those lines.
- **C-4.** Failing-first evidence: record P-1 to P-4 red on the base in
  `implementation.md` before the edit commit, with commands and output, and P-5
  output for every distinct SHA.
- **C-5.** Scope is the five files in plan section 4 plus `docs/changes/GAP-09/`.
  No action major upgrades, no `runs-on`, `python-version` or `global.json`
  change, no edit to `ENGINEERING_STANDARDS.md`.
- **C-6.** Commit subjects and trailers follow B-4.

### Open items carried forward

- Follow-ups under G-15, not in this change: `runs-on: ubuntu-latest` in
  `security.yml` and `codeql.yml`, `python-version: "3.12"`, a `global.json`, a
  committed unpinned-`uses:` guard, and the G-15 status cell in
  `ENGINEERING_STANDARDS.md:68` after the merge.
- CI on the pull request head is the evidence for the API, Studio, lint and
  CodeQL jobs, since local end-to-end and `self-test.sh` (5 cases fail on the
  base on this machine) are not usable here.

Verdict: APPROVED
