# adr-0001-accept: Delivery approval (gate 2)

Tech lead, gate 2. Worktree `D:\work\DigitalHub\dh-platform-claude-adr0001`, branch
`change/adr-0001-accept` (local, not pushed), head
`46f6d560cc38bdba3efc5c12dda4a0a3c99b3143`, 19 November 2026. Read first:
`docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
`.github/pull_request_template.md`, and every file in this folder: `plan.md`
(round 2), `plan-review.md` (Round 2, `Verdict: APPROVED`), `plan-approval.md`
(gate 1, `Verdict: APPROVED`, conditions C1 to C6 and T1 to T4),
`implementation.md` (`Status: READY FOR TEST`) and `test-report.md` (Round 1,
`Verdict: APPROVED`, no findings; untracked).

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires before the push, and it is not an owner decision (P-7).

## Decision

Approved for the owner. The diff is exactly the approved plan: two status edits
in two documents and this folder's records. The owner's words are recorded byte
for byte. No code, test, migration, workflow or lockfile changed. The push waits
for the owner's confirmation and the conditions below.

## What I verified myself

All run in Git Bash in the worktree root at `46f6d56`, in calls that each began
with `BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD) && echo "BASE=$BASE"`.
Every call printed `BASE=8b5d6a566b055cea8872f85013912b7ca3cb7ecd`, which equals
the SHA in `implementation.md` and `test-report.md`.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Base current | `git ls-remote origin refs/heads/rebuild/dotnet-platform` | 0 | `8b5d6a566b055cea8872f85013912b7ca3cb7ecd	refs/heads/rebuild/dotnet-platform` |
| 1, R1 | `grep -n "Status: Proposed" docs/adr/0001-split-public-forms-api.md` | 1 | none |
| 1, R2 | `grep -nF -- '- Status: Accepted. Owner'"'"'s words: "accepted" (19 November 2026, in a Claude' docs/adr/...` | 0 | `3:- Status: Accepted. Owner's words: "accepted" (19 November 2026, in a Claude` |
| 1, R3 | `` grep -nF '0001-split-public-forms-api.md` (proposed)' ENGINEERING_STANDARDS.md `` | 1 | none |
| 1, R4 | `` grep -nF '0001-split-public-forms-api.md` (accepted 19 November 2026)' ENGINEERING_STANDARDS.md `` | 0 | `159:\| O-12 \| How to isolate the Studio from the website on t...` |
| 4 | `git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md \| grep -c '^@@'` | 0 | `1`; the hunk is `@@ -3,2 +3,8 @@`, the two `-` lines are the base Status lines, the eight `+` lines are plan 3.1 |
| 5 | `git diff --numstat "$BASE" -- ENGINEERING_STANDARDS.md`; `wc -l < ENGINEERING_STANDARDS.md` | 0 | `1	1	ENGINEERING_STANDARDS.md`; `187` |
| 5, rest of the row unchanged | the `-` row with `s/(proposed) \|$/(accepted 19 November 2026) \|/` applied, `cmp` against the `+` row | 0 | identical |
| 6 | `git diff --name-only "$BASE"...HEAD \| sort` | 0 | `ENGINEERING_STANDARDS.md`, `docs/adr/0001-split-public-forms-api.md`, and `docs/changes/adr-0001-accept/` `implementation.md`, `plan-approval.md`, `plan-review.md`, `plan.md`. That is the plan's eight less `test-report.md` and this file, which are not committed yet |
| 8 | `git diff --check "$BASE"...HEAD` | 0 | no output |
| 8 | `git ls-files --eol` on both files | 0 | `i/lf w/crlf` for each |
| Owner's words against plan 3.1 | the fenced 3.1 block from `git show HEAD:.../plan.md`, `cmp` against ADR lines 3 to 10 from `git show HEAD:...` | 0 | 8 lines each, identical |
| Straight quotes, no stray bytes | `LC_ALL=C grep -c '[^ -~]'` on ADR lines 3 to 10 | 1 | `0` |
| Owner's words against the request | ADR lines 3 to 5, unwrapped, `grep -cF 'Owner'"'"'s words: "accepted" (19 November 2026, in a Claude Code session, reply to "ADR 0001 \| Accept it, so G2 (ISO-1 to ISO-5) can start")'` | 0 | `1` |
| Commits | `git log --format='%h %s' "$BASE"..HEAD` | 0 | `46f6d56 adr-0001-accept: Implementation record`, `66eba58 ADR 0001: Record the owner's acceptance`, `f51604c adr-0001-accept: Plan` |
| Trailers (B-4) | `git log --format='%h %(trailers:key=Co-Authored-By,valueonly)' "$BASE"..HEAD` | 0 | each of the three: `Claude Opus 5.5 <noreply@anthropic.com>` |
| Code commit scope | `git show --stat 66eba58` | 0 | `ENGINEERING_STANDARDS.md \| 2 +-`, `docs/adr/0001-split-public-forms-api.md \| 10 ++++++++--`; nothing else |
| Open-PR overlap, early read (not check 9) | for each of `gh pr list --repo mohya7/DH-WEBSITE --state open`: `gh pr diff <n> --name-only \| grep -cE '^(docs/adr/\|ENGINEERING_STANDARDS.md\|docs/changes/adr-0001-accept/)'` | - | `#66 0`, `#65 0`, `#60 0`, `#58 0` |

**Diff against the plan.** It matches plan section 4 and gate 1 condition C4:
lines 3 and 4 of the ADR replaced by the eight lines of 3.1 and nothing else, and
`(proposed)` changed to `(accepted 19 November 2026)` on line 159 of the standard
with the line count unchanged. Nothing outside the scope changed.

**Failing check first.** This is a docs change, not a security fix, so B-6's
red-test commit does not apply (gate 1, C3). Its failing checks are R1 to R4 on
the base, which the developer and the tester each ran and quoted as red (R1 and R3
exit 0, R2 and R4 exit 1). On the head they are green, as above.

**Commit subjects (B-4).** `ADR 0001: Record the owner's acceptance` has the task
prefix, an imperative summary, a body that says why and quotes the owner's words,
date, place and question, and the attribution trailer. The two record commits use
the `adr-0001-accept:` prefix, as earlier changes do for their records.

**The tester's evidence is real.** `test-report.md` quotes every command with its
exit code and output, on a detached worktree at `46f6d56`, with `BASE` printed in
the same call. My re-runs of checks 1, 4, 5, 6 and 8 and the byte comparison
give the same results. The tester also ran the website and Studio npm audit
gates and Semgrep (exit 0 each, nothing new). Everything not run is written NOT
RUN with the CI job that covers it.

**Coverage table.** Every row of the plan's table has evidence in
`test-report.md`, which I checked row by row against my own runs. Three rows are
Partial or NOT RUN only because they wait on the push: open-PR overlap (check 9),
the 13 required checks and CodeQL (check 11). They are the push conditions and
open items below, not gaps in the delivery. The 15.1 row is recorded as moved to
ISO-2, which names its destination as `AGENTS.md` requires.

## Push conditions

These come after the owner confirms, in this order. `/change` does them at push
time.

1. **Check 10, just before the push.** `git ls-remote origin refs/heads/rebuild/dotnet-platform`
   must print `8b5d6a566b055cea8872f85013912b7ca3cb7ecd`. If the base has moved,
   repeat plan 5.0 (fetch, then an ordinary rebase of the unpushed change
   branch), take a fresh `BASE`, and re-run checks 1 to 9 on the new head before
   pushing.
2. **Commit the last two records first.** Stage `test-report.md` and
   `delivery-approval.md` by exact path and commit them with the `adr-0001-accept:`
   prefix and the trailer. Then check 6 must print exactly the plan's eight paths.
3. **Check 9, just before the push.** For each open PR from
   `gh pr list --repo mohya7/DH-WEBSITE --state open --json number --jq '.[].number'`,
   `gh pr diff <n> --repo mohya7/DH-WEBSITE --name-only`. Its intersection with
   the eight paths of check 6 must be empty. If it is not, stop and report.
4. **Check 11, in CI after the push**, recorded on the PR before the owner
   merges. Quote `gh pr checks <pr> --repo mohya7/DH-WEBSITE` with run ids and
   the head SHA. Re-read the required contexts with
   `gh api repos/mohya7/DH-WEBSITE/branches/rebuild/dotnet-platform/protection --jq '.required_status_checks.contexts'`.
   Each of the 13 listed in plan check 11 (or whatever the list then holds) must be
   `pass`. `CodeQL`, `CodeQL (csharp)` and `CodeQL (javascript-typescript)` must
   be `pass`. Screenshot parity is recorded as skipping, not as passed. A red
   check goes back to the developer. It is not re-run until green, and it is not
   waived.

## Definition of Done

| Box | State | Why |
| --- | --- | --- |
| Requirement and acceptance criteria stated and met | Tick | The owner's request and the refinement plan line 25 cell "ADR 0001 reviewed and accepted"; checks 1 to 8. ISO-1 is unblocked when this merges |
| Code follows the engineering standards | Tick (no code) | Two Markdown files; checks 6 and 8 |
| No new prohibited constructs | Tick (no code) | Check 6 |
| Every new or changed route has a guard | Tick (N/A) | No route changed |
| Tests exist for the behaviour changed | Tick (N/A) | No behaviour change, and no security fix. The red-then-green greps R1 to R4 are the failing check |
| PR checks are green on the final head (run IDs quoted) | **OPEN** | Not pushed. Check 11 closes it |
| Independent code review run, findings fixed or accepted | Tick | `plan-review.md` (two rounds) and `test-report.md` (no findings), by roles other than the developer |
| Reviewed by someone other than the author, or approver's review recorded | Tick | Gate 1 and this gate are recorded. The owner's confirmation and squash merge are the owner's, not this gate's |
| Rollback is understood | Tick | Revert the PR. The ADR goes back to Proposed and G2 is blocked again |
| Deployment note | Tick, with the GAP-34 text | The owner squash-merges into `rebuild/dotnet-platform`, and no agent merges (`AGENTS.md`). Nothing deploys until Phase D |
| Governance: `AGENTS.md` coverage table or phase document updated | Tick | The coverage table is in `implementation.md` and `test-report.md`; `AGENTS.md` needs no change |
| Governance: `docs/deferred-items.md` updated | Tick (N/A) | No exception |
| Governance: documentation updated | Tick | The ADR and `ENGINEERING_STANDARDS.md` are the change |

## Open items

- **Owner:** confirmation to push. That confirmation is the owner's alone.
- **Push:** checks 10 and 9, and the commit of `test-report.md` and this file
  (push conditions 1 to 3).
- **CI:** check 11 on the final head. DoD box "PR checks are green" stays open
  until it passes.
- **Merge:** the owner squash-merges. This is slot 2 of step 1. Refinement plan
  line 21 allows one slot 2 merge a day, and #58 (ADM-04) is also slot 2, so the
  order is the owner's to set.
- **Carried forward, not blocking:** `docs/business-analysis.md` 15.1 moves to
  ISO-2. O-13 stays open for ISO-6. Gate 1's note that P-1 and O-9 are stale,
  now that protection is on and the repository is public, goes with the GAP and
  O-9 records work.

## Draft pull request description

Title: `ADR 0001: Record the owner's acceptance`

```markdown
## What and why

Records the owner's acceptance of ADR 0001 (`docs/adr/0001-split-public-forms-api.md`,
split the public forms into their own API), so that G2, ISO-1 to ISO-5, can start.
Change id `adr-0001-accept`. It is the "ADR 0001 reviewed and accepted" part of
execution step 1, slot 2, in `docs/quality/refinement-plan-2026-10-28.md` (line 25),
which step 3 (G2) waits on ("ADR accepted and CI honest first", line 27). It does
not claim "Owner decisions in one round" from the same cell.

Slot 2 (G2). Refinement plan line 21 allows one slot 2 merge a day, and #58 is also
slot 2. The owner sets the order.

## Scope and boundaries

In scope:
- `docs/adr/0001-split-public-forms-api.md`: lines 3 and 4 (Status) replaced by
  the accepted Status with the owner's words, a marked note that O-13 stays open
  for ISO-6, and the original Proposed text with its date. The body is unchanged,
  because the owner accepted it as written.
- `ENGINEERING_STANDARDS.md` line 159 (O-12 row): `(proposed)` becomes
  `(accepted 19 November 2026)`. The file keeps 187 lines, so cited line numbers
  stay valid.
- `docs/changes/adr-0001-accept/`: plan, plan review, both approvals,
  implementation and test report.

Out of scope, deliberately not touched: the refinement plan (a reviewed snapshot
whose line numbers are cited), `docs/changes/README.md`, `AGENTS.md`, `CLAUDE.md`,
`docs/PROJECT_PROFILE.md`, `docs/deferred-items.md`, `docs/business-analysis.md`,
`docs/security-deployment.md`, the ADR template and standard section 7 (GAP-13),
O-13 and every other open owner decision, and all code, tests, migrations,
workflows and lockfiles. ISO-1 to ISO-6 are not started here.

Moved items: `docs/business-analysis.md` 15.1 ('Contact form | Moves to the
Content API') moves to ISO-2, whose plan lists it in scope.

## Security impact

None in code or configuration: no route, policy, login, grant, secret, data or
dependency changes. The acceptance authorises later work that changes the
security boundary (ISO-1 to ISO-5: a new process, the `dh_public_forms` login and
its grants, `AllowedHosts`, the website proxy). Each of those is planned and
reviewed in its own change.

## Tests and evidence

Base `8b5d6a566b055cea8872f85013912b7ca3cb7ecd`, set with
`BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD)` in the same call as
each check. Full evidence is in `docs/changes/adr-0001-accept/test-report.md`
(tester, detached checkout of `46f6d56`) and `delivery-approval.md` (gate 2
re-runs).

- R1 to R4 (fixed-string greps for the old and new Status and O-12 text): red on
  the base (exit 0, 1, 0, 1), green on the head (exit 1, 0, 1, 0).
- `git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md`: one hunk,
  `@@ -3,2 +3,8 @@`. ADR lines 3 to 10 `cmp` equal to plan 3.1 (exit 0), all
  printable ASCII.
- `git diff --numstat "$BASE" -- ENGINEERING_STANDARDS.md`: `1	1`; `wc -l`: `187`.
- `git diff --name-only "$BASE"...HEAD | sort`: the two files and the six records.
- `git diff --check "$BASE"...HEAD`: exit 0, no output. `git ls-files --eol`:
  `i/lf w/crlf` for both files.
- npm audit gate (website, studio) and Semgrep gate: exit 0, nothing new (tester).
- Open-PR overlap (check 9) and base current (check 10), just before the push:
  <fill in at push time>.
- CI on the final head `<sha>`: <the 13 required checks with run ids; CodeQL,
  CodeQL (csharp), CodeQL (javascript-typescript); screenshot parity skipping>.

NOT RUN locally: .NET build and tests (no source change; Windows Application
Control), covered by CI `api`. Website and Studio suites, design check and
section comparison (no source change), covered by CI `website`,
`website-browser`, `studio` and `section-compare`. gitleaks (not installed),
covered by Security `gitleaks-pr` and `gitleaks-history`. No database was touched.

## Owner decisions

- ADR 0001: "accepted". 19 November 2026, in a Claude Code session, replying to
  "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can start".

Not decided here and still open: O-13 (Studio subdomain allow-list), which ISO-6
waits on in Phase D. The ADR's note says so, and that note is marked as not the
owner's words.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns). No code changed
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client). No code changed
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope. No route changed
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test. No behaviour change. The red-then-green checks are R1 to R4
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback). Revert. The ADR returns to Proposed and G2 is blocked again
- [x] Deployment note: the owner squash-merges into rebuild/dotnet-platform; no agent merges (`AGENTS.md`). CI, Security and Workflow lint run again on rebuild/dotnet-platform after the merge. Nothing deploys until Phase D

## Review findings accepted

- Plan review R2-1: `$BASE` does not survive between Bash calls. Accepted. Every
  check sets `BASE` in the same call and prints it.
- Plan review R2-2: the 15.1 hand-off was findable only in the plan. Accepted. It
  is in `implementation.md` and in this description under "Moved items".
- Plan review Round 1 note: P-1 ("no branch protection recorded") and O-9 are
  stale now that protection is on and the repository is public. Accepted as out
  of scope, for the GAP and O-9 records work.
- Tester: no findings.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated. The coverage table is in `implementation.md` and `test-report.md`
- [x] `docs/deferred-items.md` updated for any exception. No exception
- [x] Documentation updated. The ADR and `ENGINEERING_STANDARDS.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
