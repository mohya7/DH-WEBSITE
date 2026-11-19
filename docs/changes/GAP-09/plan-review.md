# Plan review: GAP-09

## Round 1

Reviewer: plan-reviewer, 19 November 2026, against `plan.md` round 1 on
`change/GAP-09` at `8b5d6a5`.

### Findings

1. **Minor, section 4 (security.expected.yml row).** "Exactly the same edits as
   `security.yml`, byte for byte" is not literally achievable. `security.yml` has
   CRLF line endings in this checkout and `security.expected.yml` has LF
   (`.gitattributes`: `.github/security/*.expected.yml text eol=lf`). The two match
   only once CR is ignored (`diff <(tr -d '\r' ...)`: identical). A developer who
   copies the file over to make it "byte for byte" would break the eol rule.
   Would satisfy: say "the same content, each file keeping its own line endings".

2. **Minor, section 5 (CodeQL in CI).** "if the workflow's triggers include this
   pull request" is left open, but `codeql.yml:20` has `pull_request:`. CodeQL
   will run. Would satisfy: make it a firm check that init and analyze are green
   and that the log shows the `9418214d...` download. Allow NOT RUN only if the run
   is really missing.

3. **Minor, section 5 P-6.** P-6 checks only the lines containing
   `continue-on-error`. It does not check the GAP-05 comment at `ci.yml:291-296`,
   which sits right above lines this change edits (298, 301). Would satisfy: add a
   check that no diff hunk changes lines 291-296, 326 or 398. For example,
   compare `sed -n '291,296p;326p;398p'` on the base and the head, allowing for
   the line shift caused by the new pin comment.

### Checked and found sound

- Fit: the item, the register row (line 73) and the "Done when" (line 159) are
  quoted exactly. The plan does not claim GAP-10, which is correct, since line 159
  is shared with GAP-10.
- Counts: I reran the `uses:` total and unpinned counts for all six files. They
  match (25/21, 4/4, 13/13, 1/0, 13/13, 4/4). Every line number in section 4 for
  `ci.yml` and `security.yml` is correct, and so are the image at 46/199,
  `NODE_VERSION` at 30, `dotnet-version` at 74/249 and `codeql.yml:51`.
- SHAs: I ran `git ls-remote` myself. setup-dotnet v4.3.1 is `67a3573c...`,
  download-artifact v4.3.0 is `d3f86a10...` and setup-python v5.6.0 is
  `a26af69b...`. codeql-action v3.39.3 is the annotated tag object `096a89ea...`,
  and its commit (`^{}`) is `9418214d...`. These match the table, and the plan
  correctly pins the commit, not the tag object.
- GAP-05 constraint: lines 326 and 398 (`continue-on-error: true`) and 291-296
  are excluded from scope.
- Golden copies: neither `gate.test.mjs` nor `workflow-yaml.mjs` reads `uses:`
  values. The reader does not strip trailing comments, but both copies change the
  same way, so the risk in section 10 is handled correctly.
- Scope is one topic (B-8). No gate, guard, baseline or test is weakened (P-6).
  No new gate, so no report week or canary is needed. The guard is correctly
  rejected as a separate gate.
- Testability: P-1 to P-4 are red on the base and green after the change. P-5
  proves the SHAs. The CI log checks prove the image digest, SDK 10.0.404 and
  Node v22.23.4. Each coverage row has a check.
- Security: no route, permission, secret or dependency changes. Migrations: none.
- Owner decisions: none needed. Each value equals what CI resolves today.
- Rejected alternatives (upgrading majors, `global.json`, digest only, a guard)
  are real alternatives, and each is set aside for a stated reason.
- Rollback (revert) and the risks are specific and adequate for a text-only change.

Verdict: APPROVED
