# ISO-2 plan approval (gate 1)

Technical lead, gate 1. Plan: `docs/changes/ISO-2/plan.md`, round 2 (1,620 lines).
Review: `docs/changes/ISO-2/plan-review.md`, Round 2, `Verdict: APPROVED`, with two
Minors (R2-1, R2-2). Worktree `D:\work\DigitalHub\dh-platform-claude-iso-2`, branch
`change/ISO-2`.

This approval is a pipeline role. It is not the owner's confirmation that `AGENTS.md`
requires, and it is not an owner decision (P-7).

## Decision

**Approved, with the conditions below.** The developer may start at commit 1.

## What I read and checked myself

Read: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, `ENGINEERING_STANDARDS.md`,
`docs/quality/refinement-plan-2026-10-28.md` (Track G2 and the isolation gaps),
`docs/changes/ISO-1/delivery-approval.md` ("F1: decision"), and both ISO-2 records.

Run, read-only, in the worktree on 19 November 2026:

- `git fetch origin; git rev-parse origin/rebuild/dotnet-platform HEAD` gives
  `522b17549736851f9f8848b1bdaadd14229b6557` twice. The branch sits on the base the
  plan names, and the base has not moved since review round 2.
- `gh pr list --state open`: #72 (GAP-NEXT-UPGRADE), #70 (ADM-12), #68 (GAP-09),
  #60 (draft diag). `gh pr view <n> --json state,files`: #68 is `OPEN` and changes
  `.github/workflows/ci.yml`; #70 touches only `MediaLibrary*`, `MediaUsage.cs` and
  studio media files; #72 touches only `website/package.json` and
  `website/package-lock.json` (and its own records). This matches plan 2.9.
- For every remote branch not merged into the base, `git diff --name-only` against the
  files ISO-2 touches (`api/DigitalHub.slnx`, `api/README.md`, the admin test csproj,
  `FormsLibraryTests.cs`, `api/tests/Shared`, `ENGINEERING_STANDARDS.md`,
  `website/test/no-hiring-system.test.ts`, `ci.yml`, the two new project folders). The
  hits other than `change/GAP-09` are on branches already squash-merged (ISO-1 #71,
  ADR 0001 #67, ADM-02 #54) or on stale October branches with no open PR. The only live
  overlap is `ci.yml` with #68.
- Spot checks of the plan's claims against the base: `FormsLibraryTests.cs` holds the
  eight-name exact list the plan quotes; `no-hiring-system.test.ts` `inModel` is the line
  the plan quotes and `cv_blob` is a needle (so R2-1 is right); `ENGINEERING_STANDARDS.md`
  lines 26 and 80 are the P-5 and S-2 "Enforced by" text the plan quotes;
  `ApiFactory.TestConfiguration()` reads user-secrets into a standalone
  `ConfigurationBuilder`; `ci.yml`'s `Integration tests (Release)` and
  `Upload test report` steps are as quoted; `api/src` holds only `DigitalHub.Api`,
  `DigitalHub.Forms` and `DigitalHub.Images`; `docs/PROJECT_PROFILE.md` line 21 says
  "every `api/v1` route is in the role matrix" (R2-2).

## Reasons

**Right change.** It is exactly the owner's request of 19 November 2026, quoted in the
plan word for word, with the go-ahead "start iso 2" and ADR 0001's "accepted". The
"Done when" is the refinement plan's own. The boundaries with ISO-3 (login), ISO-4
(admin drops the routes), ISO-5 (proxy) and ISO-6 are kept and listed.

**Right point in the order.** ISO-1 is merged (#71, the base). ISO-2 is the next G2
item, inside the track's 17 November to 4 December window. It changes no admin route,
so the "ISO-4 after ISO-5" rule is untouched. "Blockers before Majors" is a G3 rule
and does not bind G2. Wave ordering: #72 (Wave 0) and #68 (Wave 1) are both ahead of
ISO-2 in the queue, and ISO-2 cannot open its pull request before #68 is merged or
closed (commit 7), so it does not jump either of them. Merge slots: three non-draft PRs
are open today; ISO-2 joins the queue only after #68 leaves it, so the queue does not
pass three on its account.

**No conflicting branch**, apart from `ci.yml` with #68, which the plan sequences.

**ISO-1 gate 2's three requirements for ISO-2 are met by the plan:**

| Requirement (`ISO-1/delivery-approval.md`, "What this commits ISO-2 to") | Where the plan meets it | Judgement |
|---|---|---|
| 1. Add `Microsoft.AspNetCore.Identity`, `...Authentication`, `...Authentication.BearerToken`, `...Authentication.Cookies`, or a prefix rule for `Microsoft.AspNetCore.Authentication` and `*.Identity*` that allows what Forms needs; show the base references still pass | 3.6 point 1: `ReferenceGuard` with exact names plus the families `Microsoft.AspNetCore.Authentication`, `Microsoft.AspNetCore.Identity`, `Microsoft.Extensions.Identity`, `Microsoft.IdentityModel`. 2.6 lists the 23 compiled references of `DigitalHub.Forms.dll` and none is forbidden | Met. Every old exact name stays covered (I checked the eight against the families), so nothing is narrowed. `Azure.Identity` is outside the families; it is SqlClient's Entra ID package, not a compiled reference of Forms or the public API, and ADR 0001 does not forbid it. I accept that reading of `*.Identity*` |
| 2a. A canary proves the guard can fail: the tester's F1 type, shown failing the guard and then removed | 3.6 point 2: (a) committed `GuardCanary` with T-F1, red at commit 1 against the old list, green at commit 2; (b) committed name canary T-G3 in the public suite; (c) the literal transient demonstration on Forms and PublicApi (T-G1), recorded in `implementation.md` | Met, and more than asked: the canary is committed, so the guard stays proven able to fail |
| 2b. The same or an equivalent guard applies to `DigitalHub.PublicApi`'s own assembly | T-G2 over the PublicApi and Forms assemblies, with the shared linked `ReferenceGuard.cs` so the two guards cannot drift; C8 quotes the dll's references; stop condition if any forbidden name appears, the guard never narrowed | Met |
| 3. The plan cites the ruling and test-report F1 | Section 1 "Carries", and 3.6 | Met |

**The #68 / `ci.yml` stop is sound.** `AGENTS.md`: "Parallel changes must change
different files." Commits 1 to 6 touch no `.github/` file and can be built and tested
while #68 is open. Commit 7 is made only after #68 is merged or closed and the branch is
rebased; if #68 is still open when commit 6 is done, the developer stops, records it,
and the pipeline waits, reported to the owner. The step adds no `uses:` line, so it
needs no SHA pin and leaves #68's pinned `upload-artifact` line alone, and it writes
into the existing `api-test-report` artifact. Waiting costs time only; the alternative
(editing `ci.yml` in parallel and resolving a conflict in a security-pinning PR's
territory) is worse. Without commit 7 the "Done when" suite would build in CI but never
run there, so the stop is needed, not just tidy.

**Risk is acceptable.** Nothing is deployed, no schema changes, rollback is a revert.
The two real risks, the 404 gate being too strict behind the proxy and the copied
infrastructure drifting, are owned: the first by ISO-5's browser tests before ISO-4,
the second by the committed parity test T-D1 over the six "must not drift" files and
follow-up F-1. The duplication (about 1,970 lines, about 990 permanent) is measured and
not hidden from step 4e.

**No owner decision is needed.** The 404-not-405, trailing-slash 404 and start-up
refusal of `Auth` settings are stricter than ADR 0001 and change no existing behaviour.
The two `ENGINEERING_STANDARDS.md` edits change only "Enforced by" records, not a rule,
id or status. F-1 is a proposal for the owner to schedule; no owner words are claimed
for it.

## Reviewer Minors accepted, carried as conditions

- **R2-1 (C14's one-off proof).** Accepted as condition 1.
- **R2-2 (the public API's role matrix).** Accepted as condition 2. The plan is not
  edited; the developer records it in `implementation.md`.

## Conditions on the developer

1. **R2-1.** For C14's one-off proof, do not use `cv_blob_test` (it contains the needle
   `cv_blob`, so it fails whatever line 114 says). Use a name that matches `hiringName`
   but no needle, `HasColumnName("candidate_note")`, in a scratch copy of the public
   `Data` file. Show the vitest run **failing** with the line-114 change and
   **passing** with line 114 temporarily restored to the base text, then remove both
   scratch edits and show `git status` clean. Record commands, exit codes and output.
2. **R2-2.** In `implementation.md`, state that T-R1 (`Only_the_two_form_routes_are_mapped`)
   is the public API's role matrix: two anonymous POST routes and nothing else. Add a
   seventh "Hand-off" item: ISO-4 must keep `docs/PROJECT_PROFILE.md` line 21 ("every
   `api/v1` route is in the role matrix") true once the admin copies of the two routes
   are gone.
3. **Commit 7 and #68.** Do not touch `.github/` in commits 1 to 6. Before commit 7,
   run C20 and quote `gh pr view 68 --json state`. Only on `MERGED` or `CLOSED`: rebase
   `change/ISO-2` on the fetched `origin/rebuild/dotnet-platform`, then add the one step
   of 3.8 and nothing else (C12). If #68 is still open after commit 6, stop, record it in
   `implementation.md`, and hand back; do not route around it.
4. **After any rebase**, keep commits 1 to 7 as separate commits in the planned order
   (the red commits 1 and 4 must still precede their fixes, B-6), quote the new SHAs,
   take every baseline from the CI run on the new base (5.3 "If the base moves"), and
   re-run C1 to C5 and C14 on the rebased head.
5. **User secrets.** `PublicApiFactory` reads the store into a standalone
   `ConfigurationBuilder`, as `ApiFactory.TestConfiguration()` does, and passes only the
   rewritten connection string to the host with `UseSetting`. It never adds the store to
   the host's configuration. T-I2 must be run on a machine whose store holds an
   `Auth:SigningKey`; show that it does by key name only (for example a count of
   matching key names), never a value.
6. **Hand-off.** `implementation.md` carries the six items of plan 4.1 plus condition 2,
   and the PR body's "Open items" carries the public API's `AllowedHosts` and F-1. I will
   carry both to the owner and into the ISO-5 request at gate 2.
7. **Databases and processes.** Only `DigitalHubContent_Test`. One suite at a time;
   before each run, check that no `testhost` or `vstest` process is running and stop none
   you did not start. Release only.
8. **No push and no pull request** before gate 2 and the owner's confirmation. Pushing to
   get CI evidence also needs the owner's confirmation (plan 3.9).
9. Every stop condition in 3.6 and 3.9 stands as written. A test is never adjusted to
   reach the planned red or green state (P-6).

Verdict: APPROVED
