# GAP-05 plan approval (gate 1)

Tech lead, 2026-11-19. Plan: `docs/changes/GAP-05/plan.md` (revision log Round 2,
plan review rounds 1 and 2). Branch `change/GAP-05`, base `0488d89`.

## Decision

Approved, with the conditions below. `plan-review.md` Round 2 ends
`Verdict: APPROVED`.

## What I checked myself

- **Prerequisite.** `plan-review.md` Round 2 verdict APPROVED; the only open finding is F-7 (Minor).
- **Decision id O-21.** I ran `git grep -hoE '\bO-2[0-9]\b'` over `docs` and
  `ENGINEERING_STANDARDS.md` on every local and remote ref after `git fetch`.
  The only O-2x id it returned was `O-20`. O-21 is free, so I confirm it as the
  id of the screenshot decision. The owner's words for O-11 ("(a) Accept current
  form"), O-21 ("Exception, expires 14 Dec") and the follow-up owner ("The
  /change pipeline") are quoted with the date and the channel. I treat them as
  the owner's decisions as relayed by the orchestrator. My approval adds nothing
  to them.
- **ISO-3 sequencing.** I ran `git fetch`. There is no `origin/change/ISO-3`;
  the branch exists only locally, at `6ffff50` ("ISO-3: Implementation record"),
  so it is still in the pipeline and has no pull request. `git diff --stat
  0488d89...change/ISO-3 -- .github/workflows/ci.yml` shows 20 lines added and 4
  removed. The last commit that touched `ci.yml` on `origin/rebuild/dotnet-platform`
  is `0a55da4` (ISO-2), so ISO-3 has not merged. The base has moved to `1a2fe2e`
  (#78, GAP-11c), which does not touch any file in this plan's scope. **I keep
  the order in the plan: ISO-3 merges first.** I do not reverse it, because
  ISO-3 is further along (implementation is recorded) and it is the isolation
  track's critical path.
- **Execution order.** GAP-05 is Wave 1 (G1). Wave 0 gates are merged on the
  base (GAP-07, GAP-09 and #78). No Blocker in the register depends on it. It
  takes one merge slot.
- **Scope.** The plan touches five files and the pipeline records. Of the
  remote change branches, only ISO-3 touches `ci.yml`, and this plan handles
  that by sequencing.
- **Risk.** The section comparison blocks at once. The plan argues that its
  report period is spent and the reviewer agreed; I accept that. On 2026-12-15
  test 4 turns `npm test` red unless the screenshot comparison blocks or the
  owner renews the entry. This is intended and has a named owner.

## Conditions for the developer

- **C-1. Order of commits.** Commit tests 1 to 4 first and show them failing
  (command, exit code, output) before you commit the fix.
- **C-2. ISO-3 first.** Do not commit the `ci.yml` edit until ISO-3 has merged
  into `origin/rebuild/dotnet-platform`. Then run `git fetch origin` and
  `git merge origin/rebuild/dotnet-platform` (a merge, not a rebase), and quote
  the three checks from plan section 4 in `implementation.md` before you commit
  `ci.yml`. If ISO-3 has not merged when the rest is ready, stop and report.
  Do not reorder on your own.
- **C-3. F-7.** For test 2, choose one source for the old `careers/apply.html`
  and name it in `implementation.md`. I prefer `git show
  feature/interviewer-portal:careers/apply.html`, skipped with a stated reason
  when the ref is absent, plus the CI `section-compare` job as the backstop. If
  you commit a fixture copy instead, name the step or test that checks it
  against the old site in CI.
- **C-4. D-NNN id.** Take the next free D-NNN only at commit time, after you
  grep every branch, and quote the grep.
- **C-5. Scope.** Change nothing in `ci.yml` beyond line 338 and the two
  comments. Leave line 410 in place. Make no `uses:`, `image:` or version change.
- **C-6. Proof that the gate fires.** Make the throwaway commit, quote the
  failing `section-compare` run, and drop the commit before gate 2. It must not
  appear in the final history.
- **C-7. Owner's words.** Quote O-11 and O-21 verbatim in the entry `reason` and
  in the D-NNN entry. Do not paraphrase them.

## Reviewer Minors accepted

- F-7, which C-3 resolves.
- F-3 (resolved): the "Rule waived" field cites the rule by location, because
  that rule has no G-n id.

## Round 2

Re-approval after the developer returned the plan with A-1
(`implementation.md` at `7cd890e`). The plan was revised, and `plan-review.md`
Round 3 is `Verdict: APPROVED`, with one Minor, F-8.

### What I checked myself

- **A-1 is real and the fix is right.** `git show
  origin/feature/interviewer-portal:careers/apply.html | grep -n "<section"`
  shows the outer `section.section.careers-detail` at line 221 and the nested
  `section#apply.careers-apply.careers-apply--form` at line 231. `sectionsOf`
  (`compare.html:64`) compares only the direct children of `main`. The revised
  design matches `copy.matches("section.section.careers-detail")` on the outer
  section, then finds the inner section with `querySelector`, replaces only that
  element, and requires an exact `same(copy, now)`. This is the stricter and
  correct form, and it accepts nothing beyond O-11.
- **My Round 1 statement is corrected.** In Round 1 I approved the inner
  selector on the reviewer's F-4 without checking the page myself. That was my
  error. Round 2 rests on the page lines quoted above.
- **ISO-3.** I re-ran `git fetch`. There is still no `origin/change/ISO-3`, and
  the last `ci.yml` commit on `origin/rebuild/dotnet-platform` is still `0a55da4`
  (ISO-2). ISO-3 has not merged, so the order stands: ISO-3 goes first.
- **O-21** is unchanged and free. The owner's words are unchanged.

### Developer conditions (these replace Round 1's)

- **C-1.** Commit tests 1 to 4 first and show them failing (command, exit code,
  output) before the fix.
- **C-2.** Do not commit the `ci.yml` edit until ISO-3 has merged into
  `origin/rebuild/dotnet-platform`. Then `git fetch origin` and `git merge
  origin/rebuild/dotnet-platform` (not a rebase), and quote the three checks
  from plan section 4. If ISO-3 is unmerged when the rest is ready, stop and
  report.
- **C-3.** Test 2 reads the old page only with `git show
  feature/interviewer-portal:careers/apply.html`, with no fixture copy. It
  asserts that the outer selector matches a direct child of `main` and that
  exactly one inner form section is inside it.
- **C-4.** Take the next free D-NNN id at commit time and quote the grep over
  every branch.
- **C-5.** In `ci.yml`, change only line 338 and the comments at 304-308 and
  369-371. Line 410 stays. Make no `uses:`, `image:` or version change.
- **C-6. Proof that the gate fires, locally, with nothing pushed.**
  1. Copy the built output to the scratchpad and change one word there.
  2. Run `npm run compare:sections` against the copy with
     `SECTION_COMPARE_NEW`, `SECTION_COMPARE_OLD` and `SECTION_COMPARE_PORT=4291`.
  3. Quote the non-zero exit code and the failure line.

  Do not push `change/GAP-05` or any throwaway branch, and do not open a pull
  request: the push waits for the owner's confirmation after gate 2. Do not
  commit any proof artefact. If the tool cannot run locally, record it as NOT
  RUN with the reason. Gate 2 will then list it as open, to be proven by the CI
  `section-compare` run after the owner confirms the push.
- **C-7.** Quote O-11 and O-21 verbatim in the entry `reason` and in the D-NNN
  entry.
- **C-8 (F-8).** State in `implementation.md` whether test 2's old-page
  assertions ran or were skipped in each run you quote. A skip is accepted only
  where `feature/interviewer-portal` is absent, as in the shallow `website` CI
  checkout. Locally, they must run.

### Reviewer Minors accepted

- F-8, resolved by C-8.
- F-7, now settled by C-3.

Verdict: APPROVED
