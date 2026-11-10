# ADM-06: plan review

## Round 1

Reviewer: plan-reviewer, 10 November 2026. Plan reviewed: `docs/changes/ADM-06/plan.md`,
round 1, in `/home/user/dh-change-adm06` at `cc99e20` (plan untracked).

Read first: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md` and
`docs/PROJECT_PROFILE.md` (both from `origin/claude/cool-heisenberg-mh6zx9`, not on
the base), `/mnt/project-files/docs/quality/refinement-plan-2026-10-28.md`,
`/mnt/project-files/docs/quality/admin-audit-2026-10-28.md`. ADR 0001 does not
apply (G3, not G2).

### How I checked the binding claim

I did not rely on section 2.2's standalone app. I copied `api/` at `cc99e20` with
`git archive` into
`/tmp/claude-0/-home-user/a2e5e522-d1b3-56cb-8c85-c4d5ca889de1/scratchpad/rv-adm06/`,
renamed the probe's parameter `query` to `page` (as section 4 plans), and added a
throwaway test class that (a) lists every `ControllerActionDescriptor` parameter of
type `PageQuery` with its `BindingInfo.BinderModelName`, its binding source and the
type metadata's `BinderModelName`, read from the real `ApiFactory` host, and
(b) calls the probe with ten query strings. Release build, SDK 10.0.114, fresh
`HOME`, closed-port connection string on 127.0.0.1,4299 (no database touched).

Before the fix (`dotnet build ... -c Release`: exit 0, 13 warnings, 0 errors):

```
DigitalHub.Api Redirects.List        bi='<null>' src=Query type='<null>'
DigitalHub.Api Audit.List            bi='<null>' src=Query type='<null>'
DigitalHub.Api ContactRequests.List  bi='<null>' src=Query type='<null>'
DigitalHub.Api Content.List          bi='<null>' src=Query type='<null>'
DigitalHub.Api Media.List            bi='<null>' src=Query type='<null>'
DigitalHub.Api.Tests ConventionProbe.List bi='<null>' src=Query type='<null>'
?page=2&pageSize=2   -> 200 ... "page":1,"pageSize":20
?page=0&pageSize=5   -> 200 (defaults)      ?page=2&pageSize=101 -> 200 (defaults)
?page=10001          -> 200 (defaults)      ?pageSize=0 -> 400 errors.PageSize
ConventionTests.Notes_list_uses_the_page_envelope: Assert.Equal() Failure  Expected: 2  Actual: 4
```

After adding only `[ModelBinder(Name = "")]` and `using Microsoft.AspNetCore.Mvc;` to
`PageQuery.cs` (build: exit 0, 13 warnings, 0 errors):

```
all six rows: bi='' src=Query type=''
(no query)           -> 200 page 1, pageSize 20
?page=2&pageSize=2   -> 200 items "Rv 2","Rv 3", "page":2,"pageSize":2
?PAGE=2&PAGESIZE=2   -> 200 page 2, size 2
?page=0&pageSize=5   -> 400 {"errors":{"Page":[...]},"code":"validation_failed"}
?page=2&pageSize=101 -> 400 errors.PageSize     ?page=10001 -> 400 errors.Page
?pageSize=0          -> 400 errors.PageSize     ?page=abc  -> 400 errors.Page
Notes_list_uses_the_page_envelope: passes
```

So the class-level attribute is true for ASP.NET Core 10 on this host: all five
production actions (and the probe) get the empty model name through
`BindingInfo`, the binding source stays `Query`, the host's own
`InvalidModelStateResponseFactory` produces the 400 with `errors.Page` /
`errors.PageSize` keys, and a request with no paging keys still gets the defaults.
The audit action's other query parameters (`userId`, `action`, `entityType`, `from`,
`to`) and the content action's route `collection` and `status` do not collide with
`Page`/`PageSize`. I stopped the four MSBuild node processes my two builds started
(PIDs 4169, 4170, 4561, 4562); older dotnet processes were not mine and were left
alone.

### Findings, most severe first

**1. Major. Section 9 (O-ADM06-1) and 5.5 (G3 checklist row): the "no" branch hands
an owner decision to the tech lead.**
- What is wrong: section 9 says that if the owner answers no, tests 4 to 8's red
  evidence is written NOT RUN and "The tech lead then decides at gate 2 whether that
  meets the G3 rule." The G3 rule ("The regression test is committed and shown
  failing before the fix", `docs/changes/README.md`; "Every fix carries a
  regression test that fails first", refinement plan Track G3) is not the tech
  lead's to relax. `docs/changes/README.md`: "Only the owner decides exceptions and
  behaviour changes (P-7) ... Without the owner's words the verdict is BLOCKED ON
  OWNER", and "A tech-lead approval ... never counts as an owner decision under
  P-7." The plan also never states O-ADM06-1's status in words: it is phrased as a
  question plus "Development ... do not wait on this", but not marked pending or
  BLOCKED, so a later role can read it as settled either way.
- Evidence: plan section 9, second sub-bullet; 5.5 row 2 ("otherwise NOT RUN red,
  with the reason"). `.claude/commands/change.md`: push happens only after the owner
  confirms after step 8, so the push order is in any case owner-gated.
  Docker's CLI exists in the container but its daemon is not running
  (`docker info`: "failed to connect to the docker API"), so the plan's "No SQL
  Server" is accurate and there is no local route to red for tests 4 to 8.
- What would satisfy me: section 9 marks O-ADM06-1 as **pending, BLOCKED for the
  push step only**, and states the "no" branch without tech-lead discretion. Either
  (a) the plan argues now, for gate 1 to accept or reject, that the G3 rule is met
  by tests 1 to 3 plus `Notes_list_uses_the_page_envelope` (the regression tests
  for the one defect, all five actions covered by test 1), with tests 4 to 8 as the
  audit's additional "page-2 test per endpoint" whose red is NOT RUN with the reason;
  or (b) a "no" answer makes the delivery BLOCKED ON OWNER until the owner either
  accepts NOT RUN red in words (a D-NNN entry with the quote and an expiry) or
  answers yes. Pick one and make 5.5 match it.

**2. Minor. Section 3.3 and section 1: ADM-06b has no slot and one wrong premise.**
- The split itself is sound (finding below), but the audit ranks ADM-06 a blocker
  "because enquiries past the 50th become unreachable", which only ADM-06b fixes for
  staff, and the G3-1 exit gate ("each blocker reproduced before its fix and passing
  after it") falls on 16 November. The plan gives ADM-06b no position in slot 2 and
  no date. State that ADM-06b is the next slot-2 change after ADM-06a and must merge
  inside G3-1 (by 16 November), or name the date and say what happens to the exit
  gate if it slips.
- 3.3 says ADM-06b "cannot show red against the API until ADM-06a lands, because no
  screen can reach page 2 before then." That is backwards: a Studio test that a
  screen reaches the 51st enquiry is red today with or without ADM-06a; what needs
  ADM-06a is the green. Correct the sentence so ADM-06b's architect is not told its
  red-first is blocked.

**3. Minor. Section 5.3, red expectations: two statements will not match what the
developer quotes.**
- "`ConventionTests.Notes_list_uses_the_page_envelope` fails on `pageSize` (20, not
  2)." It fails first on the item count, because that assertion comes first
  (`ConventionTests.cs`, `Assert.Equal(2, ...GetArrayLength())`). My run:
  `Assert.Equal() Failure  Expected: 2  Actual: 4`.
- The filter `FullyQualifiedName~ConventionTests` also matches
  `StudioConventionTests.DangerouslySetInnerHTML_appears_nowhere_in_the_studio_source`.
  `ConventionTests` has seven facts; with one red, six pass, plus the one Studio
  test makes seven. "The other seven ConventionTests pass" is therefore wrong as
  worded. Name the classes exactly (or filter on `DigitalHub.Api.Tests.ConventionTests.`)
  and state the expected counts per class.

**4. Minor. Section 5.1, tests 7 and 8, and section 10: details the developer will
trip on.**
- Test 7: say explicitly that `before` and `after` are taken with no padding. The
  precedent the developer will copy (`AdminApiTests.cs`, audit filter test) pads
  by two seconds each way; with padding, the window can include the three
  `create_redirect` entries test 4 wrote moments earlier in the same class, and the
  `total` 3 assertion fails in CI only, where it cannot be debugged locally.
- Section 10's risk row and 3.2 say "Tests 5 to 7 seed distinct timestamps". Test 7
  does not seed; its timestamps come from `DateTime.UtcNow` in `AdminStore.Audit`
  on three sequential requests, stored as `datetime2` (7). That is distinct in
  practice, but correct the claim.
- Test 8: `POST /api/v1/pages` takes a `slug` as well as a title
  (`ContentWrite.Slug`; the existing audit test sends both). Name the slugs
  (unique, with the suffix).

### Checked and found sound

- **Fit.** Section 1 quotes the audit's ADM-06 entry (lines 133-145) word for word,
  and the G3-1 exit gate and Track G3 rule from the refinement plan word for word.
  G3-1 order "ADM-06, 03, 02, 07, 10, 05, 04, 12, 01a" matches the refinement plan
  line 26. The FR-S-07, FR-S-15 and FR-S-18 rows are quoted correctly.
- **Current state.** `PageQuery.cs` is as quoted. `grep` finds `[FromQuery] PageQuery
  page` in exactly the five actions named, at the lines named, plus the probe with
  parameter `query`. Policies match the controllers. Stores page with
  `Skip/Take` and the orderings stated (`FromPath`; `At` desc; `CreatedAt` desc;
  sort order or title then slug, `pages` not in `OrderedCollections`). The Studio
  grep is right: only `previewData.ts:57` sends `page`, every caller's `pageSize` is
  at most 100, so the newly enforced `[Range]` breaks no caller.
- **Design and the ModelBinder claim.** Verified on the real host, above. The type
  attribute covers all five actions and the probe, sets no binding source, and
  restores `[Range]` validation. Rejected alternatives are real (the audit's two
  options, plain ints, a custom binder, tie-breakers) and the reasons hold,
  including keeping out of `AdminControllers.cs`, which ADM-02, 07 and 10 will edit.
  A-11 layering is untouched (no controller or store change).
- **Split versus the audit's fix text.** All three fix bullets are accounted for:
  bullets 1 and 3 here, bullet 2 moved with a named destination (ADM-06b) in the
  coverage table, and ADM-06 is not marked done until both merge. B-8 ("One module,
  one fix") supports one API change and one Studio change. Subject to finding 2.
- **Scope.** Two existing files change (`PageQuery.cs`, `ConventionProbeController.cs`)
  plus two new test files and the records. `gh api .../pulls/<n>/files` for #40 to
  #44 shows none of them touches these files (#40 `Program.cs`,
  `ServerHeaderTests.cs`; #41 `.github/lint`; #42 `ci.yml`, two migrations; #43
  `ci.yml`, `website/`; #44 `.github/security`). New tests in new files avoid the
  files ADM-02, 03, 07 and 10 will change.
- **Testability.** Test 1 is red today (all `<null>`, above) and cannot pass
  vacuously (exact action set). Tests 2 and 3 are red today except the `pageSize=0`
  case, which the plan says passes. Error keys `Page`/`PageSize` are confirmed on the
  real host. Tests 4 to 8 seed through routes or `ContentDbContext` as existing
  tests do (`Contact_handled_records_who_and_when`, `NewMedia`), filter to their
  own rows via the stores' real `search`/`action`/`from`/`to` filters, and clean
  up; media avoids the upload rate limit. Commands are Release, with the closed-port
  connection string the factory rewrites to `DigitalHubContent_Test`.
- **Gates (P-6).** No gate, guard, baseline or test is weakened; the probe rename
  makes an existing test stricter. No new gate, so no `*_BLOCKING_FROM` or canary is
  owed.
- **Security.** No route or policy change; no record-id route added; no package
  (`ModelBinderAttribute` is in the shared framework); no secret; no migration.
  Rows past page 1 were already within each role's permission. The newly enforced
  400 on out-of-range paging restores the declared A-8 limit rather than changing
  intended behaviour.
- **Rollback and risks.** Revert is complete (nothing stored); the risks are
  specific and each names what catches it.
- **Owner decisions.** No D-NNN exception is claimed. O-ADM06-1 is asked, not
  assumed answered (subject to finding 1). The owner quote "merge  and start next
  task" is reproduced as given.

Round 1 result: CHANGES NEEDED (one Major, three Minors). The file's single
verdict line is at the end, after the latest round.

## Round 2

Reviewer: plan-reviewer, 10 November 2026. Plan reviewed: `docs/changes/ADM-06/plan.md`,
round 2 (revision log, section 12). Re-read sections 3.3, 5, 9, 10 and 11 in full
and checked each Round 1 finding against the text, not the revision log.

### Round 1 findings

**1. Major (O-ADM06-1 "no" branch): resolved.**
- Section 9 now reads "Status: PENDING. BLOCKED for the push step only.", quotes
  the question and the two answers on the decision card, and says "This plan
  assumes neither."
- The "no" branch is option (b) of Round 1: tests 4 to 8 NOT RUN red, the G3 rule
  "not met for them", delivery **BLOCKED ON OWNER** until the owner accepts NOT RUN
  in words (a D-NNN entry with the quote, the rule waived, a follow-up owner and an
  expiry) or answers "Yes". "No other role may decide this. Not the tech lead at
  gate 2" is stated, with the P-7 and README quotes.
- 5.4 and the 5.5 checklist row match section 9; the coverage table row reads
  "Planned (CI red for tests 4 to 8 waits on O-ADM06-1)". Nothing downstream
  depends on assuming an answer: development, local red and green, testing and
  both gates proceed; only the push of commit 1 waits, which
  `.claude/commands/change.md` already gates on the owner.

**2. Minor (ADM-06b slot and red premise): resolved.**
- 3.3 makes ADM-06b the next slot-2 change after ADM-06a, ahead of ADM-03, with
  targets Wednesday 11 November and Thursday 12 November (`date -d`: both
  weekdays as named), inside the G3-1 exit gate of Monday 16 November. If it slips,
  ADM-06 stays open and moving or closing the gate is left to the owner, not
  assumed. Two risk rows record this.
- The red sentence is corrected: ADM-06b's red tests fail today; only its green
  needs ADM-06a.

**3. Minor (5.3 red expectations): resolved, and verified.**
- The filter now ends each class name with a dot. I ran it in my scratch copy
  (`FullyQualifiedName~DigitalHub.Api.Tests.RvPagingTests.|FullyQualifiedName~DigitalHub.Api.Tests.ConventionTests.`,
  `--no-build`, fresh `HOME`, closed-port connection string): `Total: 18` = my 11
  throwaway cases + 7 `ConventionTests`; `StudioConventionTests` did not run.
- Per-class counts are right: `PageQueryBindingTests` 6 cases (test 1, test 2,
  test 3 x 4) with only `pageSize=0` passing at red; `ConventionTests` 7 with one
  failing. Red `Failed: 6, Passed: 7, Total: 13`; green `Passed: 13`.
- `Notes_list_uses_the_page_envelope` is now expected to fail first on the item
  count; `ConventionTests.cs:43` is the `Assert.Equal(2, ...GetArrayLength())`
  line, as stated.

**4. Minor (tests 7 and 8, risk table): resolved.**
- Test 7 takes `before`/`after` with no padding and says why; it also asserts page
  1's order and no `id` overlap, so a timestamp tie fails it rather than passing
  it wrongly.
- 3.2 and the risk table now say only tests 5 and 6 seed timestamps.
- Test 8 names unique slugs with the suffix. Test 4's redirect sources and test
  8's page slugs share the `adm06-<suffix>-x` shape but each test draws its own
  suffix, so they cannot collide.

### New in round 2

No new findings. Observation for the tech lead, not a defect of this plan: with
ADM-06a on 11 November and ADM-06b on 12 November, slot 2 has two working days
left before the 16 November gate (13 and 16 November) for the remaining seven
G3-1 items (ADM-03, 02, 07, 10, 05, 04, 12, 01a less those already in flight).
The batch cannot fit one pull request a day whether or not ADM-06 is split; the
plan states its own one-day cost (section 10) and leaves the gate to the owner,
which is correct.

### Checked and found sound (round 2)

- Design unchanged from round 1 and still verified on the real host (Round 1
  evidence). Scope unchanged: same two existing files, two new test files, the
  records; no file of open PRs #40 to #44.
- No gate, guard, baseline or test weakened; no route, policy, secret, package or
  migration change.
- Owner decision O-ADM06-1 stays pending and is not assumed; no D-NNN is claimed.
- I started no build in round 2 (`--no-build`), and no process of mine is left
  running.

Verdict: APPROVED
