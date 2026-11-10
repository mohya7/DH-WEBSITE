# ADM-06: plan approval (gate 1)

Technical lead, gate 1, 10 November 2026. Plan approved: `docs/changes/ADM-06/plan.md`,
round 2. Review relied on: `docs/changes/ADM-06/plan-review.md`, Round 2,
`Verdict: APPROVED`.

This approval moves the plan to the developer. It is not the owner's confirmation
that `AGENTS.md` requires. It is not an owner decision under P-7, and it does not
answer O-ADM06-1.

## Decision

Approved, with the conditions below. The scope is ADM-06a only: the API binding
fix and its tests. ADM-06 itself stays open until ADM-06b merges.

## What I checked myself

Read: `docs/changes/README.md`, `AGENTS.md`, `.claude/commands/change.md`,
`ENGINEERING_STANDARDS.md` and `docs/deferred-items.md` (both through
`git show origin/claude/cool-heisenberg-mh6zx9:<path>`), the refinement plan and the
admin audit in `/mnt/project-files/docs/quality/`, and both files in
`docs/changes/ADM-06/`.

- **Plan claims against the code, at `cc99e20`.**
  - `PageQuery.cs` is as quoted: no attribute, `[Range(1, 10_000)]` and `[Range(1, 100)]`.
  - `grep -rn PageQuery --include=*.cs api` finds `[FromQuery] PageQuery page` in
    exactly five actions: `MediaController.cs:17` and `AdminControllers.cs:33`,
    `:110`, `:128`, and `ContentController.cs:18`.
  - The probe is the sixth use, `ConventionProbeController.cs:33`, with
    parameter `query`.
- **The audit entry.** The quoted ADM-06 text matches
  `admin-audit-2026-10-28.md` word for word. The G3-1 exit gate and the Track G3
  rule match the refinement plan (lines 220 and 225).
- **The design.** I did not rebuild it. The reviewer's Round 1 check ran on the
  real `ApiFactory` host, not the standalone app: all six `PageQuery` parameters had
  model name `<null>` before the fix and `''` after it, with 400s and
  `errors.Page`/`errors.PageSize`. That is independent evidence, and it agrees with
  plan 2.2.
- **Branches and open pull requests** (`git branch -r`; `gh api
  repos/mohya7/DH-WEBSITE/pulls?state=open`; `gh api .../pulls/<n>/files`).
  - Open: #41 (GAP-08), #42 (GAP-06), #43 (GAP-04) and #44 (GAP-07). None of them
    touches `PageQuery.cs`, `ConventionProbeController.cs`, the two new test files
    or `docs/changes/ADM-06/`.
  - #40 (GAP-12) has closed: it merged at 2026-11-10T23:19:54Z as `a866cf6`, which
    is now the head of `origin/rebuild/dotnet-platform`. It changes `Program.cs`,
    `ServerHeaderTests.cs`, `docs/security-deployment.md` and `docs/changes/GAP-12/`.
    It does not overlap this change, but the base has moved (condition 1).
  - I diffed every remote branch against the base for the plan's files and found
    no match.

## Execution order

- **Right item, right place.**
  - Step 2 of the refinement plan puts G3-1 in slot 2 from 3 to 16 November, in
    the order "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a". ADM-06 comes first, and
    it is a Blocker, so Blockers come before Majors.
  - Wave 0's GAP-01 merged (#39), and Wave 1 runs in slot 1. Neither shares a
    file with this change.
  - The ISO-4/ISO-5 rule does not apply (no G2 work).
  - ADM-06 waits on none of O-14 to O-17.
- **The split into ADM-06a and ADM-06b is accepted.**
  - B-8 says "One module, one fix ... per pull request". The API fix and the
    Studio controls are two modules.
  - Plan 3.3 says why, gives ADM-06b the next slot-2 day, and keeps ADM-06 open
    until both merge. The coverage table names ADM-06b as the destination of
    every moved row.
  - The plan asks the owner to say before gate 1 if one pull request is
    preferred. The owner has not said so, and nothing in the record shows that
    preference.
- **Schedule (the reviewer's observation). Weighed: it does not block this
  change, but the owner must be told.**
  - Today is Tuesday 10 November. Slot 2 takes at most one pull request a working
    day, so the working days left to the 16 November gate are 11, 12, 13 and 16
    November: four merges at most.
  - G3-1 has nine items, plus ADM-06b, which makes ten pull requests. After ADM-06a
    (11 November) and ADM-06b (12 November), eight items are left for two days:
    ADM-03, 02, 07, 10, 05, 04, 12 and 01a. The reviewer wrote "seven", but the
    list it gives has eight.
  - Without the split there would be nine pull requests for four days. Either
    way, G3-1 cannot meet its 16 November exit gate, because slot 2 started on
    10 November, not 3 November.
  - The schedule gap therefore does not argue against this plan. It argues for
    doing the first blocker now, at its smallest size. ADM-06a is one attribute
    and tests, the lowest-risk merge in the batch.
  - Moving the G3-1 date is the owner's decision. This approval does not move it
    or assume it moves. The orchestrator should put it to the owner as a
    schedule decision before the batch's exit gate, not at it. The refinement
    plan's own risk row also applies: "if the queue passes three pull requests,
    slot 2 pauses for a day".

## Owner decisions

- **O-ADM06-1: still PENDING.** It was asked on a decision card and has not been
  answered. The plan marks it "BLOCKED for the push step only" and assumes neither
  answer.
  - Development, both commits, local red and green, testing and gate 2 do not
    depend on it.
  - The push waits for the owner in any case (`.claude/commands/change.md`: "Do
    not push, open a pull request or merge until the owner" confirms).
  - The "No" branch makes the delivery BLOCKED ON OWNER until the owner accepts
    NOT RUN red in words (a D-NNN entry) or answers "Yes". I accept that branch
    as written.
  - I do not, and cannot, decide it at gate 2.
- **The owner's request** is quoted exactly: "merge  and start next task" (Mohamed
  Elbadry, 10 November 2026, project thread).
- No other owner decision is needed. No D-NNN exception is claimed.

## Conditions the developer must meet

1. **Base.** Before commit 1, fast-forward `change/ADM-06` to
   `origin/rebuild/dotnet-platform` (`a866cf6`, GAP-12). The branch has no commits
   yet, and GAP-12 touches none of this change's files.
   - Recapture the database-free baseline of passing test names at that head, as
     in plan 2.5, and diff against it in 5.3, not against the `cc99e20` list.
   - Quote the new baseline's command, exit code and counts in
     `implementation.md`.
   - If the base moves again before the pull request, say so. Do not rebase
     across the red/green commit pair in a way that merges them.
2. **Commits exactly as in plan 5.2, in that order.**
   - Commit 1 adds the two new test files and the probe rename, and nothing in
     `api/src/`.
   - Commit 2 changes only `PageQuery.cs`.
   - Subjects are as planned, with the `ADM-06:` prefix (B-4). The body says why,
     and the attribution trailer is included.
   - The probe rename is not a "pure rename" under B-6: it changes how the probe
     binds and is what turns `Notes_list_uses_the_page_envelope` red. So it
     belongs in commit 1.
3. **Local red and green as in plan 5.3, quoted as run.**
   - Red: `Failed: 6, Passed: 7, Total: 13`, with each failure's assertion
     message.
   - Green: `Passed: 13`, followed by the full database-free suite diffed against
     the baseline, and the Release solution build with 0 errors and no new
     warnings.
   - Use Release, a fresh `HOME` for each run, the closed-port connection string
     on `127.0.0.1,4299`, and ports 42xx only.
   - Do not touch `DigitalHubContent`.
4. **Tests 1 to 8 as specified in 5.1.**
   - Test 1 asserts the exact set of five actions, not "at least one".
   - Test 7 uses no padding on `before` and `after`.
   - Tests 4 to 8 clean up the rows they create.
   - Tests 4 to 8 are written NOT RUN locally, with the reason (no SQL Server) and
     CI job `api` as the job that covers them.
5. **No push and no pull request.** O-ADM06-1 is pending, and the pipeline stops
   for the owner after gate 2 in any case. Record the decision's status in
   `implementation.md`. Do not record an answer that has not been given.
6. **Scope.** Change only the files in plan section 4.
   - Do not change anything in `studio/`, the controllers, the stores or
     `ConventionTests.cs`.
   - Do not change any file of open pull requests #41 to #44.
   - If the plan cannot be followed, stop and send it back to step 1.

## Reviewer's Minors

Round 2 has none open. All four Round 1 findings (one Major, three Minors) were
resolved, and I agree they are resolved:

- section 9 and 5.5 match;
- ADM-06b has a slot and dates;
- the red counts and the filter are correct;
- the details of tests 7 and 8 are fixed.

I accept as stated in plan section 10, without further change:

- **Observation:** the timestamp-tie risk in the newest-first orderings, passed to
  ADM-15 and ADM-16.
- **Behaviour change:** out-of-range `page` and `pageSize` now return 400. This
  restores the declared A-8 limit. Grep shows that no caller sends such values.

## Risk

Low. The change is one class attribute in production code, with no route,
policy, migration, package or secret change, and a complete revert.

The residual risks are these:

- the CI-only red for tests 4 to 8, which is owner-gated;
- the G3-1 schedule, which is owner-level and has the same effect whether or not
  ADM-06 is split.

Verdict: APPROVED
