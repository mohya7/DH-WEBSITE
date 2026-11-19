# ISO-1 plan approval (tech lead, gate 1)

Tech lead, 19 November 2026. Plan approved: `docs/changes/ISO-1/plan.md`, revised in
round 2 (status "ready for plan review, round 2"). Review: `docs/changes/ISO-1/plan-review.md`.
The latest round is Round 2, and it ends `Verdict: APPROVED`. Worktree
`D:\work\DigitalHub\dh-platform-claude-iso-1`, branch `change/ISO-1`, base
`origin/rebuild/dotnet-platform` at `cdef7c90bf5546ecea891e9b12e2aec28d265716`. I
confirmed after `git fetch` that the base is still the tip of
`origin/rebuild/dotnet-platform`.

Sources read: `docs/changes/README.md`, `AGENTS.md`, `CLAUDE.md`, `ENGINEERING_STANDARDS.md`,
`docs/quality/refinement-plan-2026-10-28.md` (the timeline, Track G2 and GAP-38), and
every file in `docs/changes/ISO-1/`: `plan.md` and `plan-review.md`.

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires, and it is not an owner decision.

## Decision

The plan is approved, subject to the conditions below.

## Owner's words relied on

- Request, 19 November 2026: "ISO-1 move the contact and apply code (validation, intake,
  throttles, dedupe, email) into a DigitalHub.Forms library; no behaviour change."
- Go-ahead, 19 November 2026, in reply to "Should I start ISO-1 through /change?":
  "Yes, start ISO-1".
- ADR 0001 acceptance, 19 November 2026: "accepted". The acceptance is recorded on the
  base in commit `cdef7c9`, "ADR 0001: Record the owner's acceptance (#67)".

The plan takes no decision on the owner's behalf. Section 9 lists three notes:

- Reading "208 and 22" as 576 and 34. This is stricter than the literal wording, so
  under the README's "the stricter rule applies" it needs no decision.
- The `SourceContext` category rename. The reviewer ruled that it is part of the move
  the owner accepted, not a behaviour change. I agree, for the reasons the reviewer
  checked: no level override, no template field and no test reads it, and nothing is
  deployed.
- The route (a) question, decided below.

None of these is an owner question that blocks the change.

## The reviewer's call: is route (b) enough for the red evidence?

**Ruling: yes. Route (b) is enough for ISO-1, and the owner is not asked about a
red-branch push.** Route (c) must be tried first, under the conditions below. The
reasons, rule by rule:

- **B-6 and S-3.** B-6 requires "a security fix's red test committed before the fix".
  S-3 applies the same rule to security fixes. ISO-1 is not a security fix: it moves
  code and changes no behaviour, route, policy, login or data. The other part of B-6,
  "a pure rename is its own commit", does apply, and the plan meets it (commit 4,
  checked by C7). The "shown failing before the fix" requirement is in the G3
  checklist, which applies to admin findings. It is not in the G2 checklist that
  governs ISO-1.
- **P-4.** "A failing test exists before the fix." Commit 1 adds only
  `FormsLibraryTests.cs`, before any production change, and gate 2 can verify that
  order from `git log`. So the requirement that the test exists first is met by the
  commit history, whether or not anyone runs it.
- **P-8.** "Anything not verified is written NOT RUN, with the reason and the CI job
  that covers it." Route (b) records the red run as NOT RUN, with the quoted error as
  the reason. No CI job ever runs commit 1 alone, because `ci.yml` triggers only on
  `pull_request` and on pushes to `rebuild/dotnet-platform` (I read lines 13-18).
  The record must say so plainly rather than name a job that does not cover it (see
  condition 2). The static reading that replaces the run is mechanical and can be
  checked read-only. I checked its premises at the base myself:
  - `grep -n AssemblyName api/src/DigitalHub.Api/DigitalHub.Api.csproj` finds no
    match, so the assembly is named `DigitalHub.Api`.
  - `JwtSecurityTokenHandler` is used at `Auth/TokenService.cs:238`.
  - `AddIdentityCore` is at `Program.cs:61`, and `AddJwtBearer` at `Program.cs:216`.
  - `ApplicationUser : IdentityUser` is at `Data/ApplicationUser.cs:5`.
  - `DigitalHub.Images` is used in `Content/MediaLibrary.cs` and
    `Controllers/MediaController.cs`.

  Test 1 compares the assembly name, so its red state is certain. Every name on test
  2's forbidden list that the reading cites is a real reference of the base assembly.
- **P-6.** Nothing is weakened. No gate, guard or test changes, and the existing test
  sources stay byte-identical (5.2 step 1).
- **Proportion.** A red run guards against a new test that cannot fail. Here both tests
  assert on assembly identity, and the static reading shows where each failure comes
  from. A pre-gate push would cost an owner round and add a branch and a draft PR, with
  no gain in what we know. ADM-04 needed route (a) because its red tests were
  behavioural regression tests for a G3 finding. ISO-1's tests are not.

If route (c) runs and contradicts the static reading, for example if test 2 passes at
commit 1, this ruling no longer holds (condition 3).

## Execution order and conflicts

- **Order.** The refinement plan's timeline (step 3, 17 November to 4 December) puts
  G2 ISO-1 to ISO-5 in slot 2, after ADR 0001 is accepted and CI is honest. ADR 0001
  is accepted on the base (`cdef7c9`). ISO-1 is the first item of G2, and the plan
  marks the others as later (4.4). ISO-4 after ISO-5 does not apply here. Two rules
  concern ordering among other items, not ISO-1 itself:
  - "Wave 0 before Wave 1" is a G1 rule.
  - "Blockers before Majors" is a G3 rule.

  The timeline interleaves G2 "between G3-2 items". So ISO-1 is at the right point.
  Slot 2's pace (one PR a day) is the owner's to apply at merge time.
- **Open branches.** I ran `git branch -r` and listed the open PRs: #68 GAP-09, #69
  GAP-11, #70 ADM-12 and #60 (diag, do not merge). Then I listed each PR's files with
  `gh pr view <n> --json files`:
  - #68 touches only `.github/` and its records.
  - #69 touches only `website/` and its records.
  - #70 touches `api/src/DigitalHub.Api/Content/MediaLibrary.cs`, `MediaUsage.cs`,
    `api/tests/DigitalHub.Api.Tests/MediaLibraryTests.cs` and `studio/`. ISO-1 moves
    and edits none of these.

  `git diff --name-only origin/rebuild/dotnet-platform...origin/change/GAP-09` and the
  same for `change/GAP-11` list nothing under `api/src`, `api/tests`, `api/DigitalHub.slnx`
  or `api/README.md`. There is no file conflict.
- **A conflict in the evidence.** If #70 merges before ISO-1, rebasing ISO-1 adds
  ADM-12's tests to the head trx. Then the base list from run `44506830145` no longer
  matches, and `comm -13` would show more than the two `FormsLibraryTests` names
  (condition 4).

## Conditions the developer must meet

1. **Try route (c) for real.** `dotnet` 10.0.401 is installed on this machine
   (`dotnet --version`), so "no local .NET" cannot be assumed. Run the two commands in
   5.1(c) on commit 1 and quote the command, the exit code and the output. Use route
   (b) only after (c) fails, and quote the failure: build error, Application Control
   load error, or test host refusal.
2. **Word the NOT RUN honestly.** If route (b) is used, `implementation.md` and the
   test report record the red run as NOT RUN, give the quoted reason, and state that
   no CI job runs commit 1. The PR head's `api` job is cited only as green evidence.
   The tester re-checks each premise of the static reading on commit 1, read-only, and
   quotes the commands.
3. **Stop on contradiction.** If route (c) runs and either test does not fail at commit
   1 for the reason in 5.1, or passes, stop. The change goes back to the architect.
   Do not adjust the test to make it red.
4. **Re-baseline after a rebase.** If `rebuild/dotnet-platform` moves before the
   tester's run, take the "before" lists in 5.2 from the CI run on the new base
   commit, not from `44506830145`. Quote that run id, its counts and both sha256
   values. Then `comm -23` must still be empty, `comm -13` must list exactly the two
   new tests, and the totals must be the new base totals plus 2 (integration) and plus
   0 (end-to-end). If GAP-09 (#68) has merged, also re-check the artifact names
   `api-test-report` and `studio-e2e-report`. The same applies to the C1 warning
   baseline: use the new base run's `Warning(s)` line.
5. **Stay in scope.** Follow the five commits in 3.5 as written, with content changes
   and renames never in the same commit and an attribution trailer on each (B-4).
   Touch no file outside 4.1 to 4.3, and nothing under `api/src/DigitalHub.Api/Data/`,
   `studio/`, `website/` or `.github/`. The Web SDK fallback in 10.1 is allowed only on
   its stated trigger.
6. **Record the logger categories.** `implementation.md` names
   `DigitalHub.Forms.ApplicationIntake` and `DigitalHub.Forms.SmtpEmailSender` as the
   new logger categories (3.5).
7. **No database writes outside the test database.** Local runs use
   `DigitalHubContent_Test` only, one agent at a time, on ports 42xx. Never use
   `DigitalHubContent`. No migration is created or applied. If one seems needed, stop
   (section 7).

## Reviewer's Minors accepted

Round 1 raised six Minors, F2 to F7. Round 2 found all six resolved and raised no new
Blocker, Major or Minor, so no Minor is left open to accept. I also accept the four
points round 2 looked at and found harmless:

- Commit 3's temporary dependency from the API on Forms.
- The redundant `using` in commit 4 (CS8019 is hidden).
- The C8 grep running on a built tree.
- A Web SDK library referenced from the Web SDK API.

## Risk

Acceptable. Rollback is a revert of the pull request: no schema, data or configuration
changes. The main risks are a registration slip, a drift in the adapter's queries, and
a test lost silently. Each is caught by a named suite or check (section 10), and
"unchanged" is proven by test name, not only by count (5.2).

Verdict: APPROVED
