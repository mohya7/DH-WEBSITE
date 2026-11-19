# adr-0001-accept: Test report

Tester, step 5. Records for this change read first: `docs/changes/README.md`,
`AGENTS.md`, `ENGINEERING_STANDARDS.md`, `plan.md` (round 2), `plan-review.md`,
`plan-approval.md` (gate 1, conditions T1 to T4), `implementation.md`
(`Status: READY FOR TEST`).

## Round 1

- **Commit tested:** `46f6d560cc38bdba3efc5c12dda4a0a3c99b3143` (`46f6d56 adr-0001-accept: Implementation record`).
  The ADR and standard edits are in `66eba58cafb431a70d83f1926111e294427ed2e0`.
- **Where:** detached worktree `D:\work\DigitalHub\dh-platform-claude-adr0001-test`,
  made with `git worktree add --detach D:\work\DigitalHub\dh-platform-claude-adr0001-test 46f6d56`
  and removed afterwards. Git Bash. No database, no port, no process started.
  Nothing committed, pushed or edited apart from this file, which is not committed.
- **Date:** 19 November 2026.

### T1. The base

Run in one call:

```
$ git ls-remote origin refs/heads/rebuild/dotnet-platform
8b5d6a566b055cea8872f85013912b7ca3cb7ecd	refs/heads/rebuild/dotnet-platform
$ BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD); echo "BASE=$BASE"
BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd
```

It matches `implementation.md` ("`BASE` = `8b5d6a566b055cea8872f85013912b7ca3cb7ecd`").
Every check below that uses the base set `BASE` this way in the same Bash call and
printed it (C2): every printed value was `BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd`.

### T2. Red checks on the base (R1 to R4)

Run against the base content, extracted in the same call with
`git show $BASE:docs/adr/0001-split-public-forms-api.md > $S/base/adr.md` and
`git show $BASE:ENGINEERING_STANDARDS.md > $S/base/es.md` (`$S` is the scratchpad):

| # | Command | Exit | Output | Plan's base result |
| --- | --- | --- | --- | --- |
| R1 | `grep -n "Status: Proposed" $S/base/adr.md` | 0 | `3:- Status: Proposed. The direction is decided (owner decision below); the` | exit 0, `3:...` |
| R2 | `grep -nF -- '- Status: Accepted. Owner'"'"'s words: "accepted" (19 November 2026, in a Claude' $S/base/adr.md` | 1 | none | exit 1 |
| R3 | `` grep -nF '0001-split-public-forms-api.md` (proposed)' $S/base/es.md `` | 0 | `159:\| O-12 \| How to isolate the Studio from the website on the server \| **Decide...` | exit 0, `159:...` |
| R4 | `` grep -nF '0001-split-public-forms-api.md` (accepted 19 November 2026)' $S/base/es.md `` | 1 | none | exit 1 |

All four are red on the base, for the reason the plan gives.

### T2. Checks 1 to 8 on the head

All run in the worktree root at `46f6d56`, in one call that set and printed `BASE`.

**Check 1, R1 to R4 after the change.**

| # | Exit | Output | Expected |
| --- | --- | --- | --- |
| R1 | 1 | none | exit 1 |
| R2 | 0 | `3:- Status: Accepted. Owner's words: "accepted" (19 November 2026, in a Claude` | exit 0, `3:...` |
| R3 | 1 | none | exit 1 |
| R4 | 0 | `159:\| O-12 \| How to isolate the Studio from the website on the server \| **Decide...` | exit 0, `159:...` |

**Check 2, the owner's words.**

```
$ grep -cF 'reply to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can' docs/adr/0001-split-public-forms-api.md
1
exit 0
$ grep -cF '"accepted" (19 November 2026' docs/adr/0001-split-public-forms-api.md
1
exit 0
```

**Check 3, original text kept and O-13 note marked.**

```
$ grep -cF 'Proposed 28 October 2026: "The direction is decided (owner decision below);' docs/adr/0001-split-public-forms-api.md
1
exit 0
$ grep -cF "Note, recorded with the acceptance and not the owner's words: O-13 (point" docs/adr/0001-split-public-forms-api.md
1
exit 0
```

**Check 4, only the status lines changed in the ADR.**

```
$ git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md | grep -c "^@@"
1
exit 0
$ git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md
index 3772580..60dba6e 100644
@@ -3,2 +3,8 @@
-- Status: Proposed. The direction is decided (owner decision below); the
-  details here are for review before any code is written.
+- Status: Accepted. Owner's words: "accepted" (19 November 2026, in a Claude
+  Code session, reply to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can
+  start").
+- Note, recorded with the acceptance and not the owner's words: O-13 (point
+  5) is not decided by the acceptance and stays open for ISO-6; see
+  `ENGINEERING_STANDARDS.md` section 9, O-13.
+- Proposed 28 October 2026: "The direction is decided (owner decision below);
+  the details here are for review before any code is written."
```

One hunk, `@@ -3,2 +3,8 @@`. The two `-` lines are the base lines quoted in plan
section 2.

**Check 5, one line changed in the standard.**

```
$ git diff --numstat "$BASE" -- ENGINEERING_STANDARDS.md
1	1	ENGINEERING_STANDARDS.md
exit 0
$ wc -l < ENGINEERING_STANDARDS.md
187
exit 0
```

The hunk is `@@ -159 +159 @@`. Its `-` line ends
``Design in `docs/adr/0001-split-public-forms-api.md` (proposed) |`` and its `+`
line ends ``Design in `docs/adr/0001-split-public-forms-api.md` (accepted 19 November 2026) |``.
To prove nothing else on the row changed, I applied the planned substitution to the
`-` line and compared it with the `+` line:
`sed 's/(proposed) |$/(accepted 19 November 2026) |/' $S/a | cmp - $S/b` gives exit 0.
The new row has no non-ASCII byte (`LC_ALL=C grep -c '[^ -~]'` prints `0`).

**Check 6, exact changed-file list.**

```
$ git diff --name-only "$BASE"...HEAD | sort
ENGINEERING_STANDARDS.md
docs/adr/0001-split-public-forms-api.md
docs/changes/adr-0001-accept/implementation.md
docs/changes/adr-0001-accept/plan-approval.md
docs/changes/adr-0001-accept/plan-review.md
docs/changes/adr-0001-accept/plan.md
exit 0
```

As T2 expects at test time: the plan's eight paths, less `test-report.md` and
`delivery-approval.md`, which are not committed yet. The full list is re-checked
before the push (check 9 and 10 time).

**Check 7, every named path exists.** The `ls` of the ten paths in plan check 7
lists all ten, exit 0.

**Check 8, whitespace and line endings.**

```
$ git diff --check "$BASE"...HEAD
exit 0   (no output)
$ git ls-files --eol docs/adr/0001-split-public-forms-api.md ENGINEERING_STANDARDS.md
i/lf    w/crlf  attr/                 	ENGINEERING_STANDARDS.md
i/lf    w/crlf  attr/                 	docs/adr/0001-split-public-forms-api.md
exit 0
```

Bytes in the working tree, counted with `tr -cd`: ADR `LF=97 CR=97`, standard
`LF=187 CR=187`. No mixed endings.

### T3. The ADR diff against plan 3.1, by eye and by bytes

- **By bytes.** I extracted the fenced block under "**3.1**" in `plan.md` and ADR
  lines 3 to 10, stripped CR from both, and compared:
  `cmp $S/plan31.txt $S/adr310.txt` gives exit 0, 8 lines each. The ADR lines are
  plan 3.1 byte for byte.
- **Straight quotes, no stray bytes.** `LC_ALL=C grep -n '[^ -~]'` on ADR lines 3
  to 10 gives exit 1: every byte is printable ASCII, so the quotes are straight
  `"` and `'`, and there are no curly quotes or non-breaking spaces.
- **The owner's words against the request.** The request gives the word
  `"accepted"` and the question `"ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can start"`.
  Joining ADR lines 3 to 10 with single spaces (removing only the wrap), the
  fixed-string grep for
  `Status: Accepted. Owner's words: "accepted" (19 November 2026, in a Claude Code session, reply to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can start").`
  prints `1`. The pipe is kept, "ISO-1 to ISO-5" is unchanged, and the date and the
  place ("in a Claude Code session") match the request. The only difference from
  the request is the line wrap between "can" and "start", which plan 3.1 asks for
  ("wrapped to match the file").
- **The Status bullet holds only the owner's words.** Read by eye: the bullet is
  `Status: Accepted.` followed by the quoted word, its date, its place and the
  question. It adds no condition, no O-13 text and no paraphrase.
- **The O-13 note is marked.** It is its own bullet, opening "Note, recorded with
  the acceptance and not the owner's words:". It states a fact already on the
  base: O-13 is open (`ENGINEERING_STANDARDS.md:160` is the O-13 row, a
  recommendation only, in `## 9. Open owner decisions` at line 142; refinement plan
  line 268 lists "O-13 to O-17" as open, line 217 says "owner decides O-13" for
  ISO-6, and line 30 puts ISO-6 in Phase D). It does not answer O-13 and does not
  change point 5 (lines 60 and 72 of the head still read as on the base, per
  check 4's single hunk).
- **The original text is kept**, quoted with the ADR's own date (`- Date: 28 October 2026`, line 11).

Result: matches plan 3.1 and the owner's words exactly.

### T4. NOT RUN

| Check | Reason | Covered by |
| --- | --- | --- |
| Check 9, open-PR overlap | Runs just before the push, after the owner confirms (plan-approval, "Which checks run when") | `/change` at push time |
| Check 10, base still current | Same. It was current at test time (`ls-remote` printed the `BASE` above) | `/change` at push time |
| Check 11, CI on the PR head | The branch is not pushed until the owner confirms after gate 2 | The 13 required contexts on `rebuild/dotnet-platform`, re-read from the protection API at PR time: `API — Release build, migrations, integration tests` (CI `api`); `Website — typecheck, tests, design check, snapshot build` (CI `website`); `Website — browser tests, default and consent builds` (CI `website-browser`); `Studio — typecheck, build, end-to-end` (CI `studio`); `Section comparison against feature/interviewer-portal` (CI `section-compare`); `Security gate self-test` (Security `gate-self-test`); `npm audit (website) — High and Critical` and `npm audit (studio) — High and Critical` (Security `npm-audit`); `NuGet vulnerable packages (api) — High and Critical` (Security `dotnet-vulnerable`); `Secret scan (gitleaks, this pull request's commits)` (Security `gitleaks-pr`); `Secret scan (gitleaks, full history)` (Security `gitleaks-history`); `Semgrep (ERROR fails, WARNING reported)` (Security `semgrep`); `actionlint (every workflow)` (Workflow lint `actionlint`). Also `CodeQL`, `CodeQL (csharp)`, `CodeQL (javascript-typescript)` (`codeql.yml`); screenshot parity recorded as skipping |
| `dotnet test -c Release` in `api/` | No source change (check 6); Windows Application Control | CI `api` |
| `npm test`, `npm run typecheck`, `npm run build`, `npm run design:check`, `npm run compare:sections` in `website/`; browser suites | No source change | CI `website`, `website-browser`, `section-compare` |
| `npm test`, `npm run build`, `npm run test:e2e` in `studio/` | No source change | CI `studio` |
| `run-dotnet-audit.sh` | No package or project file changed (`git diff --name-only $BASE HEAD -- '*.json' '*.lock' '*.csproj' '*.yml' '*.ts' '*.tsx' '*.cs' '*.js' \| wc -l` prints `0`) | Security `dotnet-vulnerable` |
| gitleaks (`run-gitleaks.sh`) | Not installed (`which gitleaks`: no gitleaks) | Security `gitleaks-pr`, `gitleaks-history` |
| Route role matrix, host checks, unknown fields, body size, error shape, permission test | No route, policy, login or grant changes (check 6: two Markdown files and this folder) | N/A for this change; ISO-2 to ISO-5 |

No database was touched, so no reset was needed.

### Security

| Check | Command | Exit | Relevant output |
| --- | --- | --- | --- |
| npm audit, website, full tree | `cd website && RUNNER_TEMP=$S/rt sh ../.github/security/run-npm-audit.sh website` | 0 | `2 moderate severity vulnerabilities`; `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| npm audit, studio, full tree | `cd studio && RUNNER_TEMP=$S/rt sh ../.github/security/run-npm-audit.sh studio` | 0 | `found 0 vulnerabilities`; `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep | `RUNNER_TEMP=$S/rt sh .github/security/run-semgrep.sh` | 0 | `semgrep: 1 finding(s) at the gate's level; 1 known, 0 new.` (the known `csharp-sqli` in `AuditRollbackTests.cs:78`, listed in `known-findings.json`). The script's roots do not include `docs/` or `ENGINEERING_STANDARDS.md`, so this is the base's result, unchanged |
| Secrets in the diff | `git diff $BASE HEAD -- docs/adr ENGINEERING_STANDARDS.md \| grep -n -i -E "password\|secret\|token\|key\|connection"` | 1 | none |
| Secrets in the whole diff, records included | `git diff $BASE HEAD \| grep -n -i -E "password\|secret\|token\|api[_-]?key\|connectionstring\|BEGIN .*PRIVATE\|AKIA\|ghp_\|Server=\|pwd="` | 0 | 6 lines, each a descriptive mention (for example "No route, policy, login, secret, dependency", the required-context names `Secret scan (gitleaks, ...)`, and the file name `Identity/TemporaryPassword.cs` in the open-PR list). No credential, key or connection string |

The two moderate website advisories are below the gate's High level and are on the
base unchanged (no lockfile in check 6).

### Beyond the plan

1. **Does the new status contradict anything else on the head that refers to ADR
   0001's status?** `git grep -n -i "ADR 0001\|0001-split"` (run at `46f6d56`)
   returns the ADR itself, `ENGINEERING_STANDARDS.md:159` (now "accepted 19 November
   2026") and `:168`, `docs/changes/README.md:101`, the refinement plan lines 11, 25,
   27, 114, 208 and 288, `.claude/agents/architect.md:16` and `plan-reviewer.md:3,
   15, 31`, this change's records, and earlier change records (GAP-01, GAP-06,
   GAP-07, GAP-08, GAP-12, GAP-34, ADM-02, ADM-03, ADM-05, ADM-06, ADM-06b,
   ADM-06b-flake, ADM-07, ADM-07c, ci-runner-pin, semgrep-error-detail,
   semgrep-timeout, aborted-request-log-race).
   - None states that the ADR is proposed. `git grep -n -i "adr.*proposed\|proposed.*adr" -- ':!docs/changes/adr-0001-accept'`
     returns nothing.
   - The refinement plan's line 25 ("ADR 0001 reviewed and accepted") and line 27
     ("ADR accepted and CI honest first") are schedule cells that the change now
     satisfies, not contradicts. Plan section 3 rejects editing them, with reasons.
   - The earlier change records that say "`docs/adr/` is not on the base" or "does
     not apply" are dated historical records of other changes. They state no status.
   - Within the ADR, `grep -n -i "propos\|accept\|review\|O-13\|status"` finds only
     lines 3 to 10 (the new block) and lines 60 and 72 (point 5 and Consequences
     naming O-13). The O-13 note is there so these two lines are not read as
     decided. Nothing in the body says "proposed" or "pending".
   - The one stale statement left is `docs/business-analysis.md:453`
     ("| Contact form | Moves to the Content API |"). It went stale with O-12 on 28
     October, not with this change, and it moves to ISO-2 under "Moved items" in
     `implementation.md` (C5). This is planned, so it is not a finding.
2. **Commit hygiene.** `git show --stat 66eba58` lists exactly the two files
   (9 insertions, 3 deletions). The subject is `ADR 0001: Record the owner's
   acceptance`. The body quotes the owner's word, the date, the place and the
   question, and ends with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   trailer. `46f6d56` adds only `implementation.md`.
3. **Ordering note, not a finding.** `ENGINEERING_STANDARDS.md` lines 132 to 134
   say "A correction is appended with its date; the original stays". That sentence
   is about evidence. The ADR puts the new Status first and keeps the original
   below it, as plan 3.1 sets out and gate 1 approved. The original stays, and
   its date is given.

### Track checklist, G2 (`docs/changes/README.md` lines 101 to 106)

| Item | Result |
| --- | --- |
| Follow `docs/adr/0001-split-public-forms-api.md` | Applies. The body is unchanged (check 4, one hunk at lines 3 to 4) |
| ISO-1 changes no behaviour (208 and 22 tests) | N/A: not ISO-1. No code in check 6 |
| Public API answers only the two form routes | N/A: ISO-2 |
| `dh_public_forms` cannot read users, roles, sessions or audit, or change content | N/A: ISO-3 |
| ISO-4 merges only after ISO-5 | N/A |

### Findings

None. No Blocker, no Major, no Minor.

### Coverage rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| ADR 0001 Status is Accepted, with the owner's exact words, date and where given | Owner's request, 19 November 2026; P-7 | Verified | R2 exit 0 at line 3; check 2 both `1`; T3 `cmp` exit 0 against plan 3.1 and joined-text grep `1` against the request |
| The original Proposed text is kept with its date | `ENGINEERING_STANDARDS.md` section 7 | Verified | R1 exit 1 (old line gone); check 3 first grep `1`; check 4 last two `+` lines |
| The ADR body is otherwise unchanged | Owner's "accepted"; B-8 | Verified | Check 4: one hunk, `@@ -3,2 +3,8 @@` against `8b5d6a5` |
| O-13 recorded as a marked note, not the owner's words, not decided | `ENGINEERING_STANDARDS.md:160`; refinement plan 217, 268 | Verified | Check 3 second grep `1`; T3 by eye |
| `docs/business-analysis.md` 15.1 moved to ISO-2 | `AGENTS.md`; C5 | Verified as moved | `implementation.md` "Moved items" line; `business-analysis.md:453` unchanged on the head |
| The O-12 row says accepted; line count unchanged | `ENGINEERING_STANDARDS.md:159` | Verified | R3 exit 1, R4 exit 0 at 159; check 5 `1 1`, `187`; substitution `cmp` exit 0 |
| The refinement plan and other records are unchanged | Plan section 3; B-8 | Verified | Check 6 |
| Exact changed-file list; no overlap with open PRs | Plan section 4; B-1, B-5 | Partial | Check 6 verified; check 9 NOT RUN until the push |
| The 13 required checks pass on the PR head | Branch protection; P-8 | NOT RUN | Not pushed; check 11 at PR time |
| CodeQL passes; screenshot parity recorded as skipped | `codeql.yml:32`; P-8 | NOT RUN | Not pushed; check 11 at PR time |
| Every diff check runs against the run-time merge base, recorded as a SHA | B-3; C2 | Verified | `BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd` printed in the same call as R1 to R4 and checks 4, 5, 6 and 8 |
| Slot 2 step 1: "ADR 0001 reviewed and accepted" | Refinement plan line 25 | Verified on the branch | `66eba58`; closes on merge |
| ISO-1 can start | Refinement plan lines 27 and 212 | Verified on the branch | ADR Status Accepted (R2); effective on merge |

Verdict: APPROVED
