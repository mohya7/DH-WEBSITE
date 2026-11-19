# adr-0001-accept: Implementation

Developer, step 4. Worktree `D:\work\DigitalHub\dh-platform-claude-adr0001`, branch
`change/adr-0001-accept` (local, never pushed), 19 November 2026. Implements
`plan.md` round 2, approved at gate 1 (`plan-approval.md`, `Verdict: APPROVED`,
conditions C1 to C6). First round; no test report or delivery approval has sent
the work back.

Read first: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
and every file in `docs/changes/adr-0001-accept/`.

## Base (5.0, C1)

`BASE` = `8b5d6a566b055cea8872f85013912b7ca3cb7ecd` (`8b5d6a5 ADM-05: Publish the
404 and 500 pages from their screen (#59)`). The base has not moved since the plan.

```
$ git fetch origin rebuild/dotnet-platform
 * branch            rebuild/dotnet-platform -> FETCH_HEAD
fetch exit 0
$ git rebase origin/rebuild/dotnet-platform
Successfully rebased and updated refs/heads/change/adr-0001-accept.
rebase exit 0
$ BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD); echo "BASE=$BASE"
BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd
```

An ordinary rebase of the local change branch, which was never pushed. The plan
commit `df706e2` became `f51604c`. Nothing shared was rewritten.

Per C2 (R2-1), every check below that uses the base sets `BASE` in the same shell
call, or writes the SHA into the command, and prints it.

## Red on the base, before editing (C2, C3)

Run in one call with `BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd`, after
confirming the working tree equals `BASE` for both files
(`git diff --quiet "$BASE" -- docs/adr/0001-split-public-forms-api.md ENGINEERING_STANDARDS.md`,
exit 0).

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| R1 | `grep -n "Status: Proposed" docs/adr/0001-split-public-forms-api.md` | 0 | `3:- Status: Proposed. The direction is decided (owner decision below); the` |
| R2 | `grep -nF -- '- Status: Accepted. Owner'"'"'s words: "accepted" (19 November 2026, in a Claude' docs/adr/0001-split-public-forms-api.md` | 1 | none |
| R3 | `` grep -nF '0001-split-public-forms-api.md` (proposed)' ENGINEERING_STANDARDS.md `` | 0 | `159:\| O-12 \| How to isolate the Studio from the website on the server \| **Decide...` |
| R4 | `` grep -nF '0001-split-public-forms-api.md` (accepted 19 November 2026)' ENGINEERING_STANDARDS.md `` | 1 | none |

`git ls-files --eol` on both files: `i/lf w/crlf` for each, as the plan says.

## What changed, by Scope row

| Scope row (plan section 4) | File | Change |
| --- | --- | --- |
| 1 | `docs/adr/0001-split-public-forms-api.md` | Lines 3 and 4 replaced by the eight lines in plan 3.1, verbatim. No other line changed. The file goes from 91 to 97 lines. |
| 2 | `ENGINEERING_STANDARDS.md` | Line 159, O-12 row: `(proposed)` became `(accepted 19 November 2026)`. Still one line; the file stays at 187 lines. |
| 3 | `docs/changes/adr-0001-accept/implementation.md` | This record. |

Edits were made with an exact-string editor. No line-ending conversion: the working
tree stays CRLF throughout (97 CRLF of 97 lines in the ADR, 187 of 187 in the
standard, counted by bytes), and the index stays LF (check 8).

## Commits

| SHA | Subject | Paths staged |
| --- | --- | --- |
| `f51604c` | `adr-0001-accept: Plan` (architect's records, rebased from `df706e2`) | `plan.md`, `plan-review.md`, `plan-approval.md` |
| `66eba58` | `ADR 0001: Record the owner's acceptance` | `docs/adr/0001-split-public-forms-api.md`, `ENGINEERING_STANDARDS.md` |
| (next) | `adr-0001-accept: Implementation record` | `docs/changes/adr-0001-accept/implementation.md` |

`66eba58` full SHA: `66eba58cafb431a70d83f1926111e294427ed2e0`. Its body says why,
quotes the owner's words with the date, the place and the question, and ends with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git diff --cached
--name-only` before the commit printed exactly the two paths. There is no red-test
commit: this is a docs change, not a security fix, so B-6 does not apply and the
red greps above are its failing check (C3).

## Checks after the code commit (5.2, checks 1 to 8)

All run in one Bash call that began with
`BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD) && echo "BASE=$BASE"`,
which printed `BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd`. HEAD was `66eba58`.

**1. R1 to R4.**

| # | Exit | Output |
| --- | --- | --- |
| R1 | 1 | none |
| R2 | 0 | `3:- Status: Accepted. Owner's words: "accepted" (19 November 2026, in a Claude` |
| R3 | 1 | none |
| R4 | 0 | `159:\| O-12 \| ...` |

**2. The owner's words, exactly.**

```
$ grep -cF 'reply to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can' docs/adr/0001-split-public-forms-api.md
1
exit 0
$ grep -cF '"accepted" (19 November 2026' docs/adr/0001-split-public-forms-api.md
1
exit 0
```

**3. Original text kept; O-13 note marked.**

```
$ grep -cF 'Proposed 28 October 2026: "The direction is decided (owner decision below);' docs/adr/0001-split-public-forms-api.md
1
exit 0
$ grep -cF "Note, recorded with the acceptance and not the owner's words: O-13 (point" docs/adr/0001-split-public-forms-api.md
1
exit 0
```

**4. Only the status lines changed in the ADR.**

```
$ git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md | grep -c '^@@'
1
$ git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md   (from the hunk header)
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

The two `-` lines are exactly the base lines quoted in plan section 2. The `+`
lines are the plan 3.1 block, byte for byte.

**5. One line changed in the standard.**

```
$ git diff --numstat "$BASE" -- ENGINEERING_STANDARDS.md
1	1	ENGINEERING_STANDARDS.md
exit 0
$ wc -l < ENGINEERING_STANDARDS.md
187
```

The hunk (row middle elided here) is
`@@ -159 +159 @@`, `-... Design in `docs/adr/0001-split-public-forms-api.md` (proposed) |`,
`+... Design in `docs/adr/0001-split-public-forms-api.md` (accepted 19 November 2026) |`.

**6. Exact changed-file list.**

```
$ git diff --name-only "$BASE"...HEAD | sort
ENGINEERING_STANDARDS.md
docs/adr/0001-split-public-forms-api.md
docs/changes/adr-0001-accept/plan-approval.md
docs/changes/adr-0001-accept/plan-review.md
docs/changes/adr-0001-accept/plan.md
exit 0
```

As expected at this point: the plan's eight paths less `implementation.md` (not
yet committed when the check ran; it is added by the next commit), `test-report.md`
and `delivery-approval.md` (not written yet). The full list is re-checked before
the push.

**7. Every named path exists.** The `ls` of the ten paths in plan check 7 exits 0.

**8. Whitespace and line endings.**

```
$ git diff --check "$BASE"...HEAD
exit 0   (no output)
$ git ls-files --eol docs/adr/0001-split-public-forms-api.md ENGINEERING_STANDARDS.md
i/lf    w/crlf  attr/    ENGINEERING_STANDARDS.md
i/lf    w/crlf  attr/    docs/adr/0001-split-public-forms-api.md
```

## NOT RUN

| Item | Reason | Covered by |
| --- | --- | --- |
| Check 9, open-PR overlap | Runs just before the push, after the owner confirms (plan-approval "Which checks run when") | `/change` at push time |
| Check 10, base still current | Same; it was current at the rebase above | `/change` at push time |
| Check 11, CI on the PR head | The branch is not pushed until the owner confirms after gate 2 | The 13 required contexts on `rebuild/dotnet-platform`; `CodeQL`, `CodeQL (csharp)`, `CodeQL (javascript-typescript)`; screenshot parity recorded as skipping |
| .NET build and tests | No source change; Windows Application Control | CI `api` (`API — Release build, migrations, integration tests`) |
| Website and Studio suites, design check, section comparison | No source change | CI `website`, `website-browser`, `studio`, `section-compare` |

No database was touched. No migration.

## Migrations

None.

## Track checklist, G2

| Checklist item | This change |
| --- | --- |
| Follow `docs/adr/0001-split-public-forms-api.md` | Applies. The ADR body is unchanged (check 4); only its status is recorded. |
| ISO-1 changes no behaviour | N/A: not ISO-1. No code changes (check 6). |
| Public API answers only the two form routes | N/A: ISO-2. |
| `dh_public_forms` cannot read users, roles, sessions or audit | N/A: ISO-3. |
| ISO-4 merges only after ISO-5 | N/A. |

## Moved items

`docs/business-analysis.md` 15.1 ('Contact form | Moves to the Content API') moves to ISO-2, whose plan lists it in scope.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| ADR 0001 Status is Accepted, with the owner's exact words, date and where given | Owner's request, 19 November 2026; P-7 | Done | `66eba58`; R2 exit 0 at line 3; check 2 both `1`; check 4 diff |
| The original Proposed text is kept with its date | `ENGINEERING_STANDARDS.md` section 7 | Done | Check 3 first grep `1`; check 4 last two `+` lines |
| The ADR body is otherwise unchanged (accepted as written) | Owner's "accepted"; B-8 | Done | Check 4: one hunk, `@@ -3,2 +3,8 @@` against `8b5d6a5` |
| O-13 recorded as a marked note, not the owner's words, not decided by this acceptance | `ENGINEERING_STANDARDS.md` line 160; refinement plan lines 217 and 268 | Done | Check 3 second grep `1`; check 4 lines 6 to 8 of the hunk |
| `docs/business-analysis.md` 15.1 is moved to ISO-2 | `AGENTS.md`; standard section 7; C5 | Moved to ISO-2 | "Moved items" line above; gate 2 puts it in the PR body |
| The O-12 row says accepted, not proposed; line count unchanged | `ENGINEERING_STANDARDS.md` line 159 | Done | R3 exit 1, R4 exit 0 at 159; check 5 `1 1`, `187` |
| The refinement plan and the other records are unchanged | Plan section 3; B-8 | Done | Check 6 lists only the two files and this folder |
| Exact changed-file list; no overlap with open PRs | Plan section 4; B-1, B-5 | Partial | Check 6 as above; check 9 (overlap) NOT RUN until the push |
| The 13 required checks pass on the PR head | Branch protection; P-8; DoD box 6 | NOT RUN | Not pushed; check 11 at PR time |
| CodeQL passes; screenshot parity recorded as skipped | `codeql.yml:32`; P-8 | NOT RUN | Not pushed; check 11 at PR time |
| Every diff check runs against the run-time merge base, recorded as a SHA | B-3; plan review R1-1, R2-1 | Done | `BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd` printed in the same call as checks 4, 5, 6 and 8 |
| Slot 2 step 1: "ADR 0001 reviewed and accepted" | Refinement plan line 25 | Done on the branch | `66eba58`; closes on merge |
| ISO-1 can start | Refinement plan lines 27 and 212 | Done on the branch | ADR Status Accepted (R2); effective on merge |

## For the tester

- Check out `66eba58` detached (or the implementation-record commit after it); the
  ADR and standard edits are in `66eba58` only.
- The working tree is CRLF and the index LF. Git Bash `sed`/`cat -A` may hide the
  CR; count bytes if you check endings.
- At test time check 6 should list six paths (the five above plus
  `implementation.md`).

Status: READY FOR TEST
