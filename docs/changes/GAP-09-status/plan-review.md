# GAP-09-status: plan review

## Round 1

### Findings

1. **Major — Sections 2, 4, 5 (check 4), 9: wrong line number for G-3.**
   The G-3 row is `ENGINEERING_STANDARDS.md:56`, not `:57`. Line 57 is G-4
   ("Partial: previous schema not tested"). Evidence: `sed -n 57p` prints the G-4
   row; `awk -F'|' 'NR==56||NR==68{print NR, NF}'` prints `56 7` and `68 7`.
   Check 4 as written (`NR==57`) checks the G-4 row, so it would pass even if the
   G-3 row were broken, and the scope line would point the developer at the wrong
   row. To satisfy me: correct every `:57` reference to `:56`, and make check 4 use
   `NR==56||NR==68` with the expected output `56 7` and `68 7`.

2. **Minor — Section 5, check 3: the `ubuntu-latest` grep also matches comments.**
   `ci.yml:39` and `:430` mention `ubuntu-latest` only in comments, so the check
   does show that the residuals are present, but it would not show that `ci.yml` is
   clean. To satisfy me: use `grep -rn "runs-on: ubuntu-latest"` instead, or say
   that the `ci.yml` matches are comments.

3. **Minor — Section 3, the G-15 cell.** "`runs-on: ubuntu-latest` in
   `security.yml` and `codeql.yml`" is accurate (security.yml:72, 86, 108, 128,
   143, 166; codeql.yml:36). Section 2 says "and further security jobs"; it would
   be better to list them all. Optional.

### Checked and sound

- Fit: closes the GAP-09 delivery-approval follow-up. The G-15 status stays
  Partial, which is justified by real residuals (P-8). The G-3 edit matches the
  owner's O-1 answer exactly, and the production version stays with GAP-10.
- The current G-15 text is false. I re-verified the facts the new cell relies on:
  0 unpinned `uses:`; the digest at `ci.yml:49` and `:202`; SDK 10.0.404 at
  ci.yml:77 and :252, codeql.yml:54 and security.yml:117; NODE_VERSION 22.23.4 in
  ci.yml:33 and security.yml:64; `python-version: "3.12"` at security.yml:172.
- Scope: one topic (B-8). No workflow, gate or baseline is touched (P-6). There is
  no register status column, so no register edit is needed.
- Security: none applies, and there are no migrations. Rollback (revert the PR) is
  adequate for a text-only change.
- Owner decision: O-1 is recorded with the owner's quote. Nothing is assumed.
- The rejected alternatives ("Met"; pinning in this change) are real.

Verdict (Round 1): CHANGES NEEDED

## Round 2

### Findings

None.

### Checked and sound

- Round 1 Major is resolved. Every G-3 reference now says `:56`, and check 4 is
  `NR==56||NR==68` with the expected output `56 7` and `68 7`, which matches the
  file.
- Round 1 Minor (check 3) is resolved. The check now greps
  `runs-on: ubuntu-latest`, and its expected output (codeql.yml:36; security.yml:72,
  86, 108, 128, 143, 166) matches the workflows.
- Round 1 Minor (residual list) is resolved. Section 2 now lists every
  `security.yml` line.
- No other part of the plan changed. The Round 1 "sound" items still hold.

Verdict: APPROVED
