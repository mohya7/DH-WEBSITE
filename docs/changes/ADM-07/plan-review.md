# ADM-07: plan review

## Round 1

Plan reviewer, 11 November 2026. Plan: `docs/changes/ADM-07/plan.md` round 1, on
`change/ADM-07` at `4b66664` (base `6262f48`, ADM-02 merged as #54). I read the
plan in full and checked its claims against the code, the audit
(`/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`, ADM-07 at lines
149-156), the refinement plan, and ADM-02's `plan.md` (2.2, 3.4, 4) and
`delivery-approval.md` ("F-1 and F-2: where they go"). `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md` and `docs/adr/` do not exist in the worktree or on
`/mnt/project-files` (`ls`, exit 2), as the plan records. No SQL Server is
reachable here, so nothing database-backed was run.

### Findings

**1. Major. Section 3.3, 5.1, 9 (B5): the `503 redirect_busy` path has no test.**
- What is wrong: B5 promises "A create that waits more than 5 seconds for another
  one gets `503 redirect_busy`". No test in 5.1 reaches that branch. T7 at green
  keeps the second request's wait at about 2 s (the gate cap), and T8 never holds
  the lock for 5 s. So the result-code check (`@result < 0`), the mapping to 503
  rather than 500, the rollback on the early return, and the resource name are
  proven by nothing. The plan's own risk row "The lock is held too long, or leaks →
  Creates fail with 503" depends on this branch behaving as described.
- Evidence: 5.1 tables T1 to T9 and K2; 5.4 lists no 503 assertion. No code uses
  `sp_getapplock` today (`grep -rn sp_getapplock api/src`, no match), so there is no
  existing coverage to lean on.
- What would satisfy me: a named database test in `RedirectConcurrencyTests.cs`,
  in commit 1, for example
  `A_create_that_cannot_get_the_lock_in_time_is_refused_as_busy`: open a separate
  `SqlConnection` with the test connection string, `BEGIN TRAN` and
  `sp_getapplock @Resource = N'digitalhub:redirects', @LockMode = N'Exclusive', @LockOwner = N'Transaction'`;
  POST a create; assert `503`, code `redirect_busy`, and no row for that address;
  roll back the holder; the same POST is then 201. At base it is red (201 at once),
  so it also proves the lock uses the documented resource name. Add it to B5's
  coverage and to the 5.4 red list.

**2. Minor. Section 5.1 (T7): the gate's match rule and its timing need tightening
for the red to be "certain".**
- The paths are `/<m>-x`, so no parameter value *starts with* the marker; it starts
  with `/`. How `spellings.Contains(redirect.FromPath)` is parameterised also
  depends on EF Core 10's collection translation (one scalar parameter per element,
  or a single JSON-array parameter), so the value may be `["/adm07…","/adm07…/"]`.
  Say "a parameter whose value contains the marker". The plan's "confirm from the
  EF log" covers the rest.
- At red, the gate releases after 2 s if the second request has not arrived. On a
  cold factory (first login, JIT, first query compile) the two requests can arrive
  more than 2 s apart. Then the first inserts alone, the second gets 409, and T7 is
  green at the red commit. Add a warm-up (one create and delete through the same
  factory) before arming the gate.
- Write the coupling down: at green the second request waits in `sp_getapplock`
  while the gate holds the first, so the gate's cap must stay well under the 5 s
  lock timeout, or T7 turns into a 503.

**3. Minor. Section 5.1 (T8), 10: cold start can cause a 503 under the 5 s
timeout.** The first creates on a new `GatedApiFactory` compile the six
`OccupiesLivePathAsync` queries, the resolve query and the insert while holding the
lock, with seven others queued behind it. On a slow runner that can approach 5 s
and give a `redirect_busy` that is not a defect. Add the same warm-up before
round 1, and quote T8's slowest request time in 5.4.

**4. Minor. Section 5.1 (S1 to S3): the Studio unit tests would assert on a real
antd toast, which reintroduces the ADM-06b-flake defect.** S1 says "The page shows
'Redirect created, but …'". antd's static `message.*` renders in its own React root,
which outlives `cleanup()` (`docs/changes/ADM-06b-flake/plan.md`, "Outcome of the
investigation"). `listPaging.test.tsx:61-66` replaces `message.success` with a spy
for that reason, and its `afterEach` asserts `document.body.innerHTML` is empty
(165-169). The plan cites that file as the pattern but asserts on rendered text.
Satisfied by: S1 and S3 assert on spies for both `message.success` and
`message.warning` (the call and its text), and `redirects.test.tsx` keeps the
empty-body `afterEach`.

**5. Minor. Section 3.1 (build report), W3: the file lookup must be ordinal.**
"No page file in `out/`" via `fs.existsSync(htmlFileFor(key))` finds `About.html`
for `/About` on Windows and macOS, which are case-insensitive. W3 would then pass
in CI (`ubuntu-24.04`) and fail on the owner's Windows machine. Satisfied by saying
the report looks the file up in the walked file list (`walk(outDir)`, as
`checkOutput` builds `fileSet`), with an ordinal comparison.

**6. Minor. Sections 2.2, 3.5, 11: the reasons for keeping 201 are partly
mis-stated, and the coverage table overstates Phase C 10.7.**
- I checked the constraint. `AdminApiTests.cs:232-285` does expect 201 for
  `/old-a-<s> → /old-b-<s>` and for the chain `/old-c-<s> → /old-a-<s>`, and neither
  target is a page. But changing that test because the owner chose a new behaviour
  would not be "weakening" it (P-6). The real constraints are stronger and should
  lead: the audit's fix says "warns", and Phase B 4.5 and 8.3 require a redirect to
  another redirect's source to be accepted and collapsed, which a "target must be a
  page" rule would refuse. So the plan is not avoiding a test change the owner
  should decide; the audit has already decided. Reword 2.2 and the 3.5 row so they
  rest on the audit and Phase B, with the test as a consequence.
- The coverage row "The build reports redirects with no page | … Phase C 10.7; BA
  530" reads as if 10.7 ("Every redirect in the table resolves to a page returning
  200") were met. After this change a missing target is still built and the build
  passes (B3). Mark 10.7 and BA 530 "partly: reported, not enforced (B3); the
  IIS-level check is Phase D".

### Checked and found sound

- **Scope against the audit and the hand-over.** The audit's ADM-07 text is quoted
  word for word (lines 149-156). The remaining scope matches ADM-02 `plan.md` 4,
  "Out of scope" (lines 642-644), and 3.4, item by item: target check, Studio
  warning in `RedirectsPage.tsx`, build report, `ToPath` in `DeleteAsync` and
  `RetargetAsync`, and the end-to-end test. Bullets 1 and 2 and path normalisation
  are correctly left as closed by #54, and E1 re-proves them, as the G3 rule asks.
- **F-1 and F-2 are taken as gate 2 routed them** (`delivery-approval.md` lines
  58-81). F-2 is asked as O-ADM07-2, not assumed, with a D-NNN fallback that needs
  the owner's words and an expiry (18 December 2026). O-ADM07-1 is asked per change,
  not inferred from ADM-02's or ADM-06b's answers.
- **Quotes from the refinement plan.** The G3 "Done when" (line 17) and the G3-1
  row and exit gate (line 225) are quoted word for word.
- **Current-state claims, verified in code.** `CreateRedirectAsync` at
  `AdminStore.cs:129-174` has no transaction and the order the plan gives;
  `OccupiesLivePathAsync` counts Published vacancies only (643-647);
  `BuildContentStore.cs:176` builds Published or Ended vacancies; `ErrorSlugs` is
  `private` (38); `ContentStore.cs:250` is `redirect.ToPath == path`, and 1069 and
  1071 compare `ToPath` as stored, with the "Targets are compared as stored"
  comment at 1064-1066; `IX_redirects_from_path` is unique on the stored text
  (`ContentModelBuilder.cs:104`); no handler maps `DbUpdateException` outside
  `ApplicationIntake`, so a same-spelling race is a 500; `Program.cs:60` is a plain
  `UseSqlServer`, with no retrying strategy; `check-output.ts:74-75` has
  `errorFiles` and `staticFiles = ["privacy-careers.html"]`; `website/src/app` has
  `privacy-careers` as its only fixed page; `routes.ts` `cleanPath` is lower-case
  only.
- **Red first.** Commit 1 is tests only. T1 to T4 fail on the missing `targetLive`;
  T5 fails because `/m-p/` survives the delete (250); T6 fails because 1069 does not
  load `/m-p/`; E1 fails at step 3's toast (`RedirectsPage.tsx:84` always shows
  "Redirect created."); W1 to W4 fail on the missing export and still typecheck
  through the namespace cast. K2 lands with the fix, as ADM-02's K1 did. The Studio
  unit tests are kept out of commit 1 because `ci.yml`'s `studio` job runs "Unit
  tests" (237) before "End-to-end suite" (271): correct.
- **T7 is deterministic in design and feasible with EF.** EF Core is 10.0.12, so
  `ConfigureDbContext<ContentDbContext>(o => o.AddInterceptors(...))` composes with
  `AddDbContext`. `ApiFactory.ConfigureWebHost` (42-78) allows a subclass that calls
  `base.ConfigureWebHost` first, as `AbortedRequestTests.cs:145-152` does. Holding
  both duplicate-check readers until both arrive forces both checks before either
  insert: two 201s for mixed spellings, a 201 and a 500 for the same spelling. At
  green the second request blocks in `sp_getapplock`, which is not a redirects
  reader, so the gate releases the first alone. Finding 2 covers the remaining gaps.
- **T8 may be green at base, and that is acceptable** because T7 carries the
  deterministic red and the plan says T8's result is reported as it ran. T8 is the
  wording gate 2 asked for.
- **201 for a missing target.** Sound on the audit's "warns" and on Phase B
  4.5 and 8.3. Not a way around an owner decision. B1 records it (finding 6 is about
  the wording only).
- **`sp_getapplock` design.** One fixed resource name, owned by the transaction,
  read committed, 5 s timeout. It also closes the concurrent `/p → /q` and `/q → /p`
  loop, which a per-address lock would not. Needs only `public`, and CI's `api` job
  runs as `dh_content_app` (`ci.yml:64`, `security-deployment.md:16-17`), so the
  permission is proven there. The unlocked paths (`RetargetAsync`, bundle import)
  are named, reasoned and put in risks. The rejected alternatives are real ones.
- **No gate weakened.** `redirectTargetReport` only adds lines to the log and does
  not touch `report.problems` or any existing check in `check-output.ts`.
  `web.config` comparison (372-375) is unchanged. No existing test is edited; the
  listed guards stay unchanged. Report-only is the audit's wording, and B3 shows the
  choice to the owner.
- **No migration, lockfile, `package.json`, `*.csproj` or workflow change.** The
  file list in section 4 has none, and section 7 explains existing rows.
- **Security.** No route or policy changes (`[Authorize(Policy = "studio")]` on
  redirects). `targetLive` exposes nothing a Studio user cannot already list. The
  interceptor is test-only. No secrets; databases named correctly
  (`DigitalHubContent_Test`, `DigitalHubContent_E2e`).
- **No parallel conflict.** No open `change/*` branch other than the merged ADM-02
  and ADM-06b touches `AdminStore.cs`, `ContentStore.cs`, `BuildContentStore.cs`,
  `RedirectsPage.tsx` or `check-output.ts`.
- **Local evidence and commands.** The cited `dn.sh` and `base-passed.txt` (175
  names) exist. The .NET commands run in Release; database tests are marked NOT RUN
  with the CI job that covers them.
- **Rollback and risks** are specific. Each fix commit reverts on its own, and
  nothing is stored differently.

Round 1 result: CHANGES NEEDED (finding 1). The file's single verdict line is at
the end, after the latest round.

## Round 2

Plan reviewer, 11 November 2026. Plan round 2 at `1145b3f` ("ADM-07: Plan round
2"), read as `git diff df3af90 1145b3f -- docs/changes/ADM-07/plan.md` and then in
full where it changed. That commit touches only `plan.md` (`git diff --stat`, 1 file).
The worktree is clean.

### Round 1 findings

| # | Severity | Resolved? | Evidence |
| --- | --- | --- | --- |
| 1 | Major | **Yes** | T10 `A_create_that_cannot_get_the_lock_in_time_is_refused_as_busy` is in 5.1, in commit 1, and in 5.4's red list ("T10's must show 201 where 503 was expected"). Commit 6 makes it green. It asserts 503, `redirect_busy`, no row, and 201 after the holder rolls back. It is red at base, because no lock is taken today, and it pins the resource name. It is also added to 3.3, B5, section 10 and the coverage table. See new Minor 7 for one wording point |
| 2 | Minor | Yes | The match now uses "contains" and allows for both EF 10 parameter shapes, still confirmed from the EF log. There is a warm-up before arming. The 2 s cap and 5 s timeout coupling is written down and is to sit in a test comment. There are risk rows in 10 |
| 3 | Minor | Yes | The same warm-up runs before T8's round 1. Each round's slowest request is written out and quoted in 5.4. A `redirect_busy` at green is reported as a failure, not retried |
| 4 | Minor | Yes | S1 and S3 assert on hoisted spies for `message.success` and `message.warning`. The file keeps the empty-body `afterEach`. I checked the cited lines: `listPaging.test.tsx:57-67` and `165-169` match. S2's marker is inside `render()`'s root, so asserting it as text is right |
| 5 | Minor | Yes | 3.1 now looks files up in the walked list (`walk(outDir)` into a `Set`) and never calls `fs.existsSync`. I checked the cited lines: `check-output.ts:105-106` build `files` and `fileSet` that way. W3 states the `/About` case |
| 6 | Minor | Yes | 2.2 and the 3.5 row now rest on the audit's "warns" and Phase B 4.5 and 8.3. The `AdminApiTests` 201s are named as a consequence, and the P-6 claim is gone. The coverage table has a separate row marking 10.7 and BA 530 "Partly: reported, not enforced (B3)", with the IIS check in Phase D |

### New findings

**7. Minor. Section 5.1 (T10): the holder's connection string is not reachable as
the plan describes it.** T10 opens a `SqlConnection` with "the test connection
string (the factory's, rewritten to `DigitalHubContent_Test`)". But
`ApiFactory.TestConnectionString()` is `private static` (`ApiFactory.cs:188`).
Taken literally, the developer would have to edit `ApiFactory.cs`, which section 4
does not list. Two routes need no harness change:
- `ApiFactory.ElevatedTestConnectionString()` (`internal`, line 161), which the
  existing tests already use with `new SqlConnection` (`CareersTests.cs:247`,
  `AuditRollbackTests.cs:75`);
- or `GetConnectionString()` on a `ContentDbContext` resolved from the factory's
  services.

An application lock belongs to the database, not to the login, so either one
blocks the API's `dh_content_app` session. This does not block the plan. The
developer should use one of these routes, or record an `ApiFactory.cs` change as
a scope deviation in `implementation.md`.

### Checked in round 2 and found sound

- **Owner answers.** O-ADM07-1 ("Yes, red tests first") and O-ADM07-2 ("Yes, refuse
  it") are quoted with name, date (11 November 2026), place (project thread, card
  tap) and how they reached the architect (relayed by the coordinator; the
  architect says plainly that they did not see the thread). Each answer is read
  narrowly. The "delete the ended vacancy first" route is marked as the plan's
  reading, not the owner's words, and goes in the PR body. No owner decision is
  open, and none is assumed.
- **F-2 in scope.**
  - T9 now has no conditions and is in commit 1, red at base. At base the POST is
    201, and `CheckRedirectAsync` (`AdminStore.cs:873-892`) reaches the same
    `OccupiesLivePathAsync` that counts only Published vacancies, so there is no
    import error either.
  - Commit 7 is the one-line predicate, matching `BuildContentStore.cs:176`.
  - Section 6 now says one input that is accepted today is refused (B6).
  - The D-NNN fallback and T9-B have been removed, consistently.
- **The O-ADM02-2 context** (0 redirects in `DigitalHubContent_Studio`; the build
  content passed `check:content`) is recorded as relayed and not as the architect's
  own evidence. The plan uses it only to drop the clean-up and query-widening notes,
  which is safe. The G3-1 exit-gate row still says this change alone does not meet
  it.
- **Red first still holds.**
  - Commit 1 is tests only: T1 to T10, W1 to W4 and E1.
  - The Studio unit tests are still in commit 2, pushed after commit 1's CI has
    finished.
  - T7's warm-up runs before the gate is armed, so it cannot trip the gate.
- **Nothing new weakens a gate or test.** There is still no migration, lockfile,
  `package.json`, `*.csproj` or workflow change. T10's holder runs only against the
  test catalog and releases the lock in `finally`.
- **Unchanged from round 1 and still sound:** the scope against the audit and
  ADM-02's hand-over, T7's feasibility and determinism, T8 possibly green at base,
  the 201 decision, the single-name `sp_getapplock` design, security, rollback and
  risks.

There are no Blockers or Majors. Finding 7 is a Minor for the developer.

Verdict: APPROVED
