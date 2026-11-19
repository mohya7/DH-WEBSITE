# ADM-04 delivery approval (gate 2)

Tech lead, 19 November 2026. Head `aa6ada9` on `change/ADM-04`, PR #58 (draft).
Base `origin/rebuild/dotnet-platform` = `8b5d6a5` (ADM-05, #59).

**Decision: approved, with conditions D1 to D5.** This is not the owner's
confirmation. The owner reads B1 to B10 and the known exposure in the PR body, then
squash-merges.

## The request

There is no separate owner request quoted in `plan.md`. Section 1 quotes the audit
finding as the item it closes (`admin-audit-2026-10-28.md` lines 105-116):

> **ADM-04: users cannot have their role changed, be reactivated or be deleted, and
> a deactivated email can never be used again.** ... Fix: Change role, keeping the
> last-admin guard. Reactivate. Decision O-15 on delete. The matching UI.

The owner's "continue" and "resume" on 19 November 2026 resumed the pipeline (as
relayed by the coordinator). They are not a decision on the change.

## What I verified myself

| Check | Command or source | Result |
| --- | --- | --- |
| Base is in the head, merge not rebase | `git merge-base --is-ancestor origin/rebuild/dotnet-platform HEAD` | exit 0; base `8b5d6a5` |
| Scope matches the plan | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 15 files: `UserAccessStore.cs`, `UserAccessController.cs`, `TemporaryPassword.cs`, `Program.cs` (+1), three new API test files, `UsersPage.tsx`, `users.test.tsx`, `users.spec.ts`, and the five ADM-04 records. Nothing else |
| C1: no forbidden file touched | the same diff, filtered on `AdminStore\|AdminControllers\|ContentStore\|PublishChecks\|ErrorPagesPage\|TokenService\|SessionCheck` | no match (grep exit 1) |
| The ADM-05 merge touches no ADM-04 file | `git diff --name-only 399c4e0 aa6ada9`, filtered on ADM-04's file patterns | no match (grep exit 1). The merge brings in only ADM-05's, GAP-07's and security-gate files |
| Red API, commit 1 `bf634e2` | CI `43249521862`, API job log | `Failed: 15`. Failing tests by name: T1 `An_admin_changes_an_editors_role_and_it_is_audited`, T2 `A_role_change_ends_the_users_sessions`, T3 `The_last_active_admin_keeps_the_admin_role`, `An_admin_cannot_change_their_own_role`, `A_role_change_checks_its_input`, the two reactivation tests, `Reactivating_an_active_or_unknown_user_is_refused`, `Reactivation_does_not_revive_old_sessions`, `ReactivationLogTests...appears_in_no_application_log_event_and_no_audit_row`, `Editors_and_HR_cannot_change_roles_or_reactivate`, `A_refresh_that_races_a_role_change_cannot_keep_the_old_role`, `A_role_change_waits_for_the_users_lock_and_then_refuses_as_busy`, `A_demoted_or_deactivated_admin_cannot_finish_a_users_change`, and the two `UserRoleConcurrencyTests`. 15 tests = T1 to T11 and T13 to T16 |
| Red E1, commit 1 | the same run, Studio job log | `✘ e2e/users.spec.ts:34:1 › ADM-04 users: change a role, deactivate, reactivate`. The second red in that job, `redirects.spec.ts:37`, is the ADM-07 flake that ADM-07c (#62) fixed later. It is not ADM-04's |
| Red Studio, commit 2 `486588c` | `test-report.md` line 26 (local run, allowed by C4 (b)) | `Tests 5 failed \| 2 passed (7)`: S1, S2, S4, S5, S6 red; S3, S7 green. I did not re-run it at `486588c` |
| Red T17, `deff0ce` (security fix, B-6) | job `135211492167` (run `44420391530`, branch `diag/ADM-04-t17-red`) | `Passed: 561, Failed: 1`: `An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id`. The fix `81b951b` comes after it in `git log` |
| Green API on the head | job `135225062513` | `Passed: 576`, T17 among them |
| Every workflow green on `aa6ada9` | `gh run view` | CI `44424309403` (API, Studio, both Website jobs, section comparison: success; screenshot parity skipped, optional); CodeQL `44424309387` (csharp, js-ts); Security `44424309415` (all 7 jobs); Workflow lint `44424309393` |
| Fastest suite re-run by me | `cd studio && npm ci && npx vitest run test/users.test.tsx` on `aa6ada9` | `npm ci` exit 0; `Tests 7 passed (7)`, exit 0. `node_modules` was missing from the worktree, so I installed it first |
| C8 current lines (R3-2) | `grep -n` and `sed -n 959p` on `AdminStore.cs` at `aa6ada9` | `NewAcceptedTemporaryPasswordAsync` 452, `IsDeactivated` 787, `NewTemporaryPassword` 790, `Audit` 959, `Validation(string)` 974, `Validation(Dictionary)` 977, `Missing` 984. These match the tester's lines |
| Commit subjects and trailers (B-4) | `git log origin/rebuild/dotnet-platform..HEAD` | Every non-merge commit is `ADM-04: <imperative>`, has a body saying why, and carries `Co-Authored-By`. The two merge subjects say what they bring in. The extra `Claude-Session` trailer on some commits is allowed |
| PR #58 state | `gh pr view 58` | open, draft, `MERGEABLE`, head `aa6ada9`. The body (782 characters) is not the 4c draft yet |

C2 to C9 are met as the tester found them in rounds 1 to 3. I read the round 3 evidence
(C5's three valid runs, C7 through T19, C6's line reads) and did not repeat it.

## R3-1 and R3-2: accepted as conditions on the records commit, no return

Both are wrong or missing lines in a record. Neither changes code, a test, or what the
owner merges. Using the last allowed return on them would cost a day in slot 2 and
fix nothing that runs. This file now records both facts:

- **R3-1.** The ADM-05 merge is `aa6ada9` (parents `399c4e0` and `8b5d6a5`). After it,
  CI re-ran every suite: CI `44424309403`, API job `135225062513`, `576/576`, plus
  the CodeQL, Security and Workflow lint runs above. Locally, the tester re-ran
  `studio` (`116 passed`). That meets C2's re-run requirement.
- **R3-2.** The current source lines are the ones in the table above. **ADM-04b's plan
  takes its lines from here or re-reads them, not from `implementation.md` section 6**
  (condition D2).

## Conditions

- **D1.** One records commit on `change/ADM-04` adds `test-report.md` (round 3) and
  this file, with the subject `ADM-04: Test report round 3 and delivery approval`, a
  body and the attribution trailer. Records only. CI must be green again on that new
  head before the owner merges (DoD box 6).
- **D2.** ADM-04b (C12) cites the C8 lines from this file, or re-reads them at its
  own base. It is planned next in slot 2, before ADM-12 and ADM-01a.
- **D3.** Before the PR leaves draft, replace the PR #58 body with the final
  description below. It is the 4c draft with three gaps filled: final head run ids
  in place of "see the records", the ten Definition of Done boxes from the template,
  and the Deployment note. Do not use the 4c text as it stands.
- **D4.** Close **#65** now. It is a duplicate: the same SHA `deff0ce`, and the
  cited red job ran on #66's branch. Keep **#66** (`diag/ADM-04-t17-red`, job
  `135211492167`) open as a draft until the owner has merged #58, then close it
  without merging and delete both red branches. `change/ADM-04-red` (bf634e2) needs
  no PR. Its run `43249521862` stays on #58's own history.
- **D5. Timing.** ADM-05 merged at 23:50 UTC on 18 November, which is 19 November
  local time. Slot 2 allows one merge a day, so #58 is ready for the owner from
  **20 November** at the earliest. The owner squash-merges. No agent merges.

## Open items

- CI green on the final head after D1 (box 6). It is green on `aa6ada9`.
- The PR body is replaced (D3) and the PR leaves draft.
- The owner confirms B1 to B10 and the known exposure, then squash-merges.
- Known exposure until ADM-04b: a demotion racing a deactivate, or two deactivates,
  can still leave no active admin. ADM-04b closes it.
- `docs/deferred-items.md`: nothing deferred by an exception. The ADM-04b work is
  planned follow-up work.
- The owner's card answers were relayed by the coordinator. No agent saw them
  first-hand.

## Final PR #58 description

```markdown
## What and why
ADM-04 (Blocker, G3-1): an admin can change a Studio user's role and reactivate a
deactivated user, keeping the last-admin guard. Closes audit fixes 1, 2 and 4 of
ADM-04 (`admin-audit-2026-10-28.md` lines 105-116; FR-S-02). Fix 3, delete, is settled
by O-15: no delete.

## Scope and boundaries
In scope: new `UserAccessController` (`PUT /users/{id}/role`, `POST /users/{id}/reactivate`),
`UserAccessStore`, `TemporaryPassword`, one registration line in `Program.cs`,
`UsersPage.tsx`, and tests (`UserRoleAndReactivationTests`, `UserRoleConcurrencyTests`,
`ReactivationLogTests`, `users.test.tsx`, `users.spec.ts`). No migration, package or grant.

Deliberately not touched: `AdminStore.cs`, `AdminControllers.cs`, `TokenService.cs`,
`SessionCheck.cs`. Deactivate is unchanged. ADM-04b moves it under the same lock and
removes the helpers copied from `AdminStore.cs`.

Behaviour changes, for the owner:
- B1: An admin can change any other active user's role between admin, editor and HR,
  from User Management, after a confirmation.
- B2: A role change signs the user out everywhere. They sign in again with the new role.
- B3: An admin cannot change their own role, however the id is spelled. Another admin
  does it.
- B4: A deactivated user's role cannot be changed until they are reactivated.
- B5: The last active admin cannot be made editor or HR (`last_admin`).
- B6: A deactivated user can be reactivated. They keep their role, get a new temporary
  password shown once to the admin, and must change it at sign-in.
- B7: Creating a user with a deactivated user's email still fails. The screen now offers
  "Reactivate instead".
- B8: Two new audit actions: `change_user_role` and `reactivate_user`.
- B9: A role change or reactivation can answer "Another change to the users is in
  progress. Try again." (503, after 5 s at most) if another admin's change holds the lock.
- B10: A request from an admin who was demoted or deactivated while it was in flight is
  refused (403), even though it started with a valid token.

**Known exposure until ADM-04b:** a demotion racing a deactivate, or two deactivates, can
still leave no active admin. The deactivate path has this today, and the elevated account
can recover from it.

## Security impact
Two new routes, both under the `studio-admin` policy, each carrying a user id. Anonymous
callers get 401 (T18). Editor, HR, no-role and must-change users get 403 (T11,
`CareersTests`). Deactivated users get 401: `SessionCheck` fails the token before the
route runs (`CareersTests`, and T14 for an admin deactivated before the request). An
admin deactivated while the request waits for the lock gets 403 (T16). An admin's own record is refused in any spelling of the id (T8,
T17). The actor is re-read inside an exclusive app lock (T14 to T16). A role change
revokes refresh tokens and rotates the security stamp (T2, T13). The temporary password
is in no log or audit row (T10), and its response is `Cache-Control: no-store` (T4).
Bodies are capped at 4 KB. No secrets or dependencies change.

## Tests and evidence
Red first:
- `bf634e2`, CI 43249521862: the API job has `Failed: 15` (T1 to T11, T13 to T16). Studio
  E1 is red: `e2e/users.spec.ts:34`.
- `486588c`, Studio, run locally: `vitest run test/users.test.tsx`, exit 1,
  `5 failed | 2 passed` (S1, S2, S4 to S6 red; S3, S7 green).
- `deff0ce`, job 135211492167 (run 44420391530): `Failed: 1`, T17
  `An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id`. Fixed
  in `81b951b`.

Green on `aa6ada9` (the change plus base `8b5d6a5`):
- CI 44424309403: API job 135225062513 `Passed: 576`; Studio and both Website jobs
  succeeded; screenshot parity skipped (optional).
- CodeQL 44424309387, Security 44424309415 and Workflow lint 44424309393: all succeeded.
- Locally: `npx vitest run test/users.test.tsx`, exit 0, `7 passed`.

The final head is the records commit, docs only. Its run ids go here before merge.

## Owner decisions
By card tap, Mohamed Elbadry, 12 November 2026, 12:09 UTC, in the project thread, as
relayed by the coordinator:
- O-ADM04-1 (O-15): "No, deactivate is enough"
- O-ADM04-2: "New temporary password"
- O-ADM04-3: "Yes, red tests first"

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted). Green on `aa6ada9`; open for the records commit
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback). Revert. No schema or data change
- [x] Deployment note: who pushes, and that the deploy will be watched to the end and recorded. Nothing deploys before Phase D. The owner squash-merges into `rebuild/dotnet-platform`. No agent merges and there is no integrator (GAP-34). The required checks run on the merge commit, and the next change's records cite them

## Review findings accepted
- Test round 1, finding 2: the Role column is 130 px wide, a stated screen choice.
  Finding 3 is pre-existing and project-wide, so it is left.
- Test round 3, R3-1 and R3-2: record-only gaps in `implementation.md` (no row for the
  ADM-05 merge; stale C8 lines). Both are corrected in `delivery-approval.md`, which
  ADM-04b uses.
- Gate 1: a deactivate racing a demotion can still leave no active admin. Accepted until
  ADM-04b.

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (the coverage tables are in `docs/changes/ADM-04/`)
- [x] `docs/deferred-items.md` updated for any exception (none taken)
- [x] Documentation updated (`docs/changes/ADM-04/`)

## Also covers
Nothing else.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
