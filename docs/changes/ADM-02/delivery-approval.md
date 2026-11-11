# ADM-02: delivery approval (gate 2)

Technical lead, gate 2, 11 November 2026. Branch `change/ADM-02`, local only.
Implementation head `a34947a`, with the test report on top at `d427847`. Base `77296ba`,
still the tip of `origin/rebuild/dotnet-platform`. Records read: `plan.md` round 2,
`plan-review.md` rounds 1 and 2, `plan-approval.md` (`432bdf1`), `implementation.md`
(`a34947a`, `Status: READY FOR TEST`), and `test-report.md` Round 1 (`d427847`,
`Verdict: APPROVED`, two Minors). This file is the only one written, and it is not
committed.

This approval is a pipeline role. It is not the owner's confirmation that
`AGENTS.md` requires, and it decides no owner question (P-7).

## Decision

**Blocked on the owner's answer to O-ADM02-1. Everything that can be checked
without CI is approved.**

- The diff matches the approved plan and the gate 1 conditions. The red commit
  comes before the fix. The local evidence is real, and I re-ran it.
- What is missing is the CI evidence gate 1 set for this gate: the red in job `api`
  at `7c93e52`, and the green on the final head. The red can be shown only after
  the owner answers O-ADM02-1. Condition 4 keeps the branch unpushed until then.
- Gate 1 said: "If the answer is 'No', or there is still no answer, gate 2 is
  `BLOCKED ON OWNER`". That is the state now.
- I am not sending the change back. There is no Blocker or Major, and the two
  Minors go to ADM-07 (see "F-1 and F-2").

## What I verified myself

| Check | Command | Result |
| --- | --- | --- |
| Commits and order | `git log --format='%h %s' origin/rebuild/dotnet-platform..HEAD` | `7c93e52` tests and harness, `14c244e` redirects, `244444c` formats, `a34947a` implementation record, `d427847` test report. The pipeline records `84bf73a` to `432bdf1` come before them |
| Red commit has no fix | `git show --stat 7c93e52` | 9 files: tests, the website harness, `package.json` and `ci.yml`. Nothing under `api/src/` or `api/tools/` (B-6) |
| B-4 | `git log -1 --format=%B` for each commit | Each subject is `ADM-02:` plus an imperative. Each body says why. Each ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line |
| Scope | `git diff --stat origin/rebuild/dotnet-platform...HEAD` | 22 files: the 17 in plan section 4, plus the five records in `docs/changes/ADM-02/`. No Studio file, no migration, no lockfile, no `*.csproj` |
| Diff against the plan | `git diff origin/rebuild/dotnet-platform...HEAD -- api/src api/tools .github website/package.json`, read in full | Matches 3.1 and 3.2. The four `AdminStore` functions and `ContentStore`'s slug check and `RetargetAsync` compare by `RedirectPaths.Key` and `Spellings`. `RetargetAsync`'s `ToPath` comparisons are unchanged (ADM-07 part 3). `SchemaFormats.Asserting()` uses its own `new FormatRegistry()`, `\A…\z`, lower case only. `Validate` is strict and `ValidateDraft` is lenient. Publish passes `publishing: true`; create, save, restore and unpublish pass `false` |
| Condition 1 | same diff, `ContentBundle.cs` | `built = record.Status is ContentStatus.Published or ContentStatus.Ended`. Working copies pass `publishing: false` |
| Condition 2 | same diff, `ContentStore.cs` | `bool publishing` is required on both `CheckDocumentAsync` and `CheckAsync`, and it comes before `CancellationToken`. `requireMedia = true` is the only optional parameter |
| Condition 7 | same diff, `ci.yml` | Exactly two steps in job `api`, before "Integration tests (Release)": `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0` and `npm ci` in `website`. No `if:`, no `continue-on-error` |
| Nothing else became strict | `grep -rn "\.Validate(" --include=*.cs api/src api/tools` | The only other caller of `SectionSchemaSet.Validate` is `ReferenceConverter.cs:215`. That is a report-only check (it prints failures and exits 1), as plan section 4 accepts. Plan section 4 covers this, and the pull request body states it |
| Fastest suite at the head | `npm ci` already in `website/`, then `npx vitest run test/check-content.test.ts` and `npm run -s typecheck` | `Tests 5 passed (5)`; typecheck exit 0 |
| Build | `dotnet build DigitalHub.slnx -c Release` (in `api/`) | exit 0, `13 Warning(s)`, `0 Error(s)`, the base's count |
| DB-free API tests at the head | `HOME=<fresh> ConnectionStrings__Content="Server=127.0.0.1,4299;…" dotnet test tests/DigitalHub.Api.Tests -c Release --no-build --filter "…SchemaFormatTests.The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case\|…ApiAcceptedContentTests.The_website_check_fails_on_a_bad_file\|…RedirectAddressRuleTests\|…RedirectPathRuleTests.The_api_rule_is_the_website_builds_rule"` | exit 0, `Passed!  - Failed: 0, Passed: 4, Skipped: 0, Total: 4` (F1, K1, W2, L5) |
| F1 red at the red commit | detached worktree at `7c93e52` in the scratchpad (removed afterwards), Release build, the same F1 filter | exit 1, `Failed: 1`. `not-a-uuid "not-a-uuid": website refuses, API accepts, expected the API to refuse` and the upper-case line, which is the reason the plan gives |

**The tester's evidence.** Each check is quoted with its command, exit code and
output lines. Everything that was not run is marked NOT RUN, with its reason and
its CI job. Where I re-ran a check, my results match the tester's: F1 red, F1, K1
and W2 green, C1 to C5, typecheck, and 13 warnings. I did not re-run the full
DB-free suite or the 173-name baseline diff. Both the developer and the tester
quote it the same way: `Failed: 344, Passed: 176, Total: 520`, with no name lost.

**Coverage table** (`implementation.md`). Every row has evidence, or says
"NOT RUN" with CI `api` named, or names its destination (ADM-01a, ADM-07, ADM-02b,
O-ADM02-2). The database rows cannot close until the CI run below.

## F-1 and F-2: where they go

Both go to the **ADM-07 change**, not to a D-NNN entry now. A D-NNN entry needs
the owner's words (P-7). ADM-07 is next in the G3-1 order, and it changes the same
two functions. If the ADM-07 plan does not take either finding, that plan must list
it as an owner question for a D-NNN entry, with an expiry. It may not drop it.

- **F-1 (Minor): two concurrent creates of `/x` and `/x/` can both succeed**
  (`AdminStore.CreateRedirectAsync`).
  - Not a regression. Before ADM-02 such a pair was always accepted.
  - The window needs two editors at once.
  - The effect is loud, not silent: the build stops with "Two redirects start at
    …", and a bundle import reports the pair.
  - For the ADM-07 architect: make the check and the insert one unit (a
    serializable transaction or `sp_getapplock` on the address key). Prove it with a
    concurrency test: N parallel creates of one address give exactly one 201.
- **F-2 (Minor): `OccupiesLivePathAsync` ignores ended vacancies**, which the build
  publishes (`BuildContentStore.cs:176`).
  - This was true before ADM-02 and is outside this diff. Condition 1 made it
    visible.
  - Whether a redirect from a closed role's page is wanted is a behaviour question.
    The ADM-07 plan must ask the owner, not assume an answer.
  - O-ADM02-2 query (b) also leaves out ended vacancies. If the owner runs it,
    widen it to `status IN ('published', 'ended')` for `vacancies`.

Both go in the pull request body under "Review findings accepted", with this
destination.

## CI evidence required before the owner is asked to confirm the merge

1. **The owner answers O-ADM02-1.**
2. **On "Yes":**
   - `git push origin 7c93e52:refs/heads/change/ADM-02`, then open the pull
     request with the body below.
   - Record the CI run id at head `7c93e52`. Job `api` must fail on exactly these
     21 cases and no others: R1 (2), R2 (2), R3, R4 (3), R5, R6, R7, F1, F2 (5),
     F4 (2), F5a and W1. Quote each one's assertion, from the TRX or the log.
   - F3 (2), F5b and W2 must pass in that run, along with every existing test.
   - W1's log (prefix `website check:`) must show the three lines of plan 5.1 and
     no other line from this run. Any other such line means condition 6 applies:
     back to the architect.
3. **On "No":** push the branch and open the pull request. The 20-case CI red is
   then NOT RUN. Gate 2 stays `BLOCKED ON OWNER` until `docs/deferred-items.md` has
   a D-NNN entry with the owner's exact words, the date, the follow-up owner and an
   expiry.
4. **In either case, the final head** (`git push origin change/ADM-02`): run ids
   and green results for every job in `ci.yml`:
   - `api`, with the TRX total: the base total plus the 26 new cases;
   - `website`;
   - `studio`, unit and end-to-end, with 10.21 at `studio.spec.ts:163` named;
   - `section-compare`;
   - `website-browser`;
   - `workflow-lint.yml`;
   - `security.yml`.
5. The developer adds the CI run ids and the red-test names to `implementation.md`.
   Then I do a short gate 2 round 2 on that evidence, and that round's verdict is
   the one the owner sees. No code change is expected.

O-ADM02-2 is **not** required for this gate. It stays open in the pull request
body as a G3-1 exit-gate item.

## Definition of Done (`.github/pull_request_template.md`)

| Box | Can it be ticked now? |
| --- | --- |
| Requirement and acceptance criteria stated and met | **Open.** Stated and met in code. The database proof (R, F2 to F5, W1) waits on CI |
| Code follows the engineering standards | Yes. Diff read in full; no new warnings |
| No new prohibited constructs in touched code | Yes. Data access stays in `AdminStore` and `ContentStore`; no config reads or network calls added |
| Every new or changed route has a guard and, with a record id, a record scope | Yes, trivially: no route changed |
| Tests exist for the changed behaviour; changed-line coverage meets the gate; every security fix has a regression test | Tests exist, and the regression tests are committed first. **Open:** they run only in CI. Changed-line coverage is not a CI gate yet (GAP-18, Wave 2) |
| PR checks green on the final head (run ids quoted) | **Open.** Nothing pushed |
| Independent code review run; findings fixed or accepted | Yes. Plan review rounds 1 and 2, test report Round 1. F-1 and F-2 are accepted and go to ADM-07 |
| Reviewed by someone other than the author, or the approver's review recorded and the AI governance rules followed | Yes for the pipeline roles. **Open:** the owner's review at merge |
| Rollback understood | Yes. Revert the pull request; commits 2 and 3 revert separately; no schema or data change (plan section 8) |
| Deployment note | **Open.** The integrator for slot 2 is named in the coordinator's prompt and re-runs the suites after the merge. Nothing deploys before Phase D |
| Governance: coverage table updated | Yes, in `implementation.md` |
| Governance: `docs/deferred-items.md` for any exception | **Open** only if O-ADM02-1 is "No" |
| Governance: documentation updated | Yes. Records in `docs/changes/ADM-02/`; no product document changes |

## Draft pull request description

```markdown
## What and why

ADM-02 (Blocker, G3-1): content the API accepts can stop every website build
(`docs/quality/admin-audit-2026-10-28.md`). It also closes parts 1 and 2 of ADM-07
(Major), which have the same root cause.

- Redirect checks now compare paths as the website build keys them: trailing slashes
  removed, so `/x` and `/x/` are one address. This applies to create (duplicate and
  self), live path, loop and chain, the bundle import check, the slug-is-a-redirect
  check (save and publish), and rename.
- Publishing, and importing a published or ended row, now asserts the schema's
  `uuid` format as a lower-case UUID. That is the website's pattern without `/i`,
  because the website's lookups compare exact lower-case ids. Drafts and working
  copies are not affected (save is not publish).
- `npm run check:content -- <file>` runs the website's schema, media and redirect
  checks on a build-content file. `ApiAcceptedContentTests` feeds it what the API
  just accepted. It is not a whole build: route and output checks are not included.

## Scope and boundaries

In scope: `RedirectPaths.cs`, `AdminStore.cs`, `ContentStore.cs`, `SchemaFormats.cs`
(new), `SectionSchemaSet.cs`, `CollectionSchemaSet.cs`, `ContentBundle.cs`, the
website check (`src/content/check-content.ts`, `scripts/check-content.ts`, the
`package.json` script), the tests, and two steps in `ci.yml` job `api` (SHA-pinned
`setup-node`, `npm ci` in `website/`).

Out of scope:
- ADM-07 part 3 (targets that do not exist, Studio warning, build report, the
  `ToPath` comparisons, the end-to-end test) goes to the ADM-07 change.
- "Report a failed build in the Studio" goes to ADM-01a.
- Rich-text ids go to ADM-02b (proposed).
- The old-site importer is unchanged; see plan section 4 for why.
- No Studio file and no migration.
- `ReferenceConverter --convert-references` now reports format and case failures in
  stored sections too.

## Security impact

No route, policy or schema change. Input validation is stricter (A-5). Nothing that
was refused before is accepted now. The new regex is anchored, with fixed repeats.
Job `api` now runs `npm ci` from the committed `website/package-lock.json` with
`permissions: contents: read`. `npm audit --audit-level=high`: 0 in the website and
the Studio. actionlint: 0 findings.

## Tests and evidence

- Red commit `7c93e52` (tests only): CI run <id>. Job `api` fails on exactly 21
  cases: R1 (2), R2 (2), R3, R4 (3), R5, R6, R7, F1, F2 (5), F4 (2), F5a, W1.
  <assertions>. F1 is also red locally (exit 1).
- Final head <sha>: CI run <id>. `api` <TRX total>, `website`, `studio`
  (10.21 green), `section-compare`, `website-browser`, `workflow-lint`, `security`
  are all green.
- Local, no database: Release build 0 errors and 13 warnings (the base's). The
  DB-free suite passes 176 = 173 base names + F1, K1, W2, with none lost. Website
  `vitest run` 425 passed; typecheck 0; `design:check` 0; snapshot build 0.
- Records: `docs/changes/ADM-02/` (plan, reviews, approvals, implementation, test
  report).

## Owner decisions

- O-ADM02-1 (push the red commit first): <owner's exact words, date, where>.
- O-ADM02-2 (rows in `DigitalHubContent_Studio` the new rules refuse): PENDING. It
  blocks only the G3-1 exit gate, not this merge. Read-only queries are in plan
  section 9; for `vacancies`, query (b) must include `ended`.
- Behaviour changes in this pull request, for the owner to accept at merge:
  - B1: a redirect that differs from an existing one only by a trailing slash is
    refused, `409 redirect_exists`.
  - B2: `/a → /a/`, or the reverse, is refused, `400 redirect_loop`.
  - B3: a redirect from a live page's address with a trailing slash is refused,
    `400 redirect_live_path`.
  - **B4: an item whose address is where a redirect with a trailing slash starts
    cannot be saved or published until that redirect is deleted.** A live page with
    such a legacy redirect can no longer be edited at all until then.
  - B5: a redirect to `/p/` when `/p → /q` exists is stored as `/q`.
  - B6: publishing, and importing a published or ended row, refuses a schema `uuid`
    value that is not a UUID. This includes an empty reference or image id left in
    the Studio. Saving such a draft still works.
  - B7: that rule refuses upper-case UUIDs too. The Studio never writes them.
- ADM-07 is split: parts 1 and 2 are here, part 3 is next. ADM-02b (rich-text ids)
  is proposed as a follow-up.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (database proof: CI run <id>)
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope (no route changed)
- [x] Tests exist for the behaviour changed; every security fix has a regression test (changed-line coverage is not gated yet, GAP-18)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed (owner review at merge)
- [x] Rollback is understood (revert; commits 2 and 3 revert separately; no schema or data change)
- [ ] Deployment note: integrator <name> merges into rebuild/dotnet-platform and re-runs the suites after the merge

## Review findings accepted

- F-1 (Minor): two concurrent creates of `/x` and `/x/` can both succeed. Not a
  regression, and the build fails loudly. It goes to the ADM-07 change (a single
  unit around check and insert, plus a concurrency test). If not taken there, the
  ADM-07 plan raises a D-NNN owner question.
- F-2 (Minor): a redirect can take over an ended vacancy's page. This was true
  before ADM-02. It goes to the ADM-07 change, which asks the owner whether that
  redirect is wanted.
- Plan review round 2 Minors 1 and 2 are fixed (gate 1 conditions 1 and 2).

## Governance

- [x] `AGENTS.md` coverage table or phase document updated (coverage table in `docs/changes/ADM-02/implementation.md`)
- [ ] `docs/deferred-items.md` updated for any exception (only if O-ADM02-1 is "No")
- [x] Documentation updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XbYNgkELy87ojZ7Td24A65
```

## Open items

- O-ADM02-1 has no answer. It blocks the push, the CI red and this gate.
- CI red at `7c93e52` and CI green on the final head, as listed above, then gate 2
  round 2.
- O-ADM02-2 is still not asked. It blocks only the G3-1 exit gate. I repeat gate 1's
  advice to ask it before the merge, because of B4.
- The coordinator must hand F-1 and F-2 to the ADM-07 architect with this file, and
  schedule ADM-02b.
- The slot 2 integrator must be named for the deployment note.

Round 1 result: BLOCKED ON OWNER (O-ADM02-1). The file's single verdict line is at
the end, after the latest round.

# Round 2

Technical lead, gate 2 round 2, 11 November 2026. Draft pull request #54
(`change/ADM-02` into `rebuild/dotnet-platform`, head `4857eff`; `gh api .../pulls/54`:
`draft=true state=open`). Round 1 is above and still stands, except where this
round changes it.

## Owner decision O-ADM02-1

- **The owner's words, as relayed by the coordinator:** "yes both" (Mohamed
  Elbadry, 11 November 2026, project chat), answering whether to push ADM-02's
  failing tests first. I have not seen the chat myself. The quote and its source
  come from the coordinator's message.
- **How I read it:** only as "Yes" to O-ADM02-1.
- **"Both" is unexplained.** The relayed question is a single one. I do not read
  "both" as an answer to O-ADM02-2, as acceptance of B1 to B7, or as scheduling
  ADM-02b.
- **Before the merge,** the coordinator records in the pull request body what the
  second question was, in the owner's words.

## What I verified myself

| Check | Command or source | Result |
| --- | --- | --- |
| Runs and jobs exist, and are on the right commits | `gh api repos/mohya7/DH-WEBSITE/actions/runs/<id>` and `/jobs` | Red run `43012090027`: `CI`, head `7c93e52`, `pull_request`. Job `api` `130493970283` ended `failure`. The run itself is `cancelled`, because job `studio` `130493970270` was cancelled; that is consistent with `cancel-in-progress` when the full branch was pushed. Green run `43012635577`: head `4857eff`, `success`. `api` `130495931919`, `website` `130495931416`, `studio` `130495931890`, `website-browser` `130495931861` and `section-compare` `130496269071` all `success`; screenshot parity `skipped` (optional, label-gated). `Security` `43012635671` and `Workflow lint` `43012635605` are `success` on `4857eff` |
| The red is the red commit | red log, `grep "HEAD is now"` | `422960b Merge 7c93e52… into b9c5f6f…`: the pull request merge ref of commit 1 alone, on the base that then held #52 and #53 (Studio files only) |
| Red counts | red log, `grep "Total tests\|Passed:\|Failed:"` | `Total tests: 519`, `Passed: 498`, `Failed: 21`. 519 is the base's 494 plus 25 new cases (K1 lands in commit 2) |
| The 21 failing names | red log, every `Failed DigitalHub…` line, counted | R1 (2), R2 (2), R3, R4 (3: pages, case-studies, blog-posts), R5, R6, R7, F1, F2 (5: reference-not-a-uuid, reference-empty, reference-32-digits, image-not-a-uuid, related-not-a-uuid), F4 (2: reference, image), F5a, W1. That is exactly the 21 of plan 5.4, and nothing else failed |
| Each failure is the planned red | red log, the `Error Message` of each | R1, R2, R3, R4: `Created {…}` (201 where 409 or 400 was expected). R3 shows `/…-q/ → /…-p/` created. R5: `OK {… "status":"published" …}`. R6: `Assert.Single() Failure: The collection contained 2 items`. R7: `No fromPath error for /adm02-…-i/: {}`. F1: `not-a-uuid … website refuses, API accepts` and the upper-case line. F2 and F4: `publish: OK {… "status":"published" …}` from `AssertSavedButNotPublishedAsync`. F5a: `Assert.False() Failure` (`Ok` was true). Each matches the "Red at base" column of plan 5.1 |
| W1's lines | red log, `grep "website check:"` | Exactly three (each printed twice, by xUnit and by the console): `pages/adm02-2ce1c459-bad: section 1 (case_cards) does not match sections/case_cards.json: /items/0/reference/id must match format "uuid"`; `Media 266D428D-97C5-4CBC-ABED-3B214E987189 is used by published content but is not in the media list.`; `Two redirects start at /adm02-2ce1c459-x/.` These are the three lines of plan 5.1. No other line from this run appeared, so condition 6 is not triggered |
| Guards passed at the red | red log, `grep "Passed …"` | F3 `A_draft_with_an_unchosen_reference_or_image_still_saves` (image, reference), F5b `A_draft_row_or_working_copy_with_an_unchosen_id_still_imports`, W2 `The_website_check_fails_on_a_bad_file`, and L5 `The_api_rule_is_the_website_builds_rule` all passed |
| Green counts | green log | `HEAD is now at ef47c94 Merge 4857eff… into b9c5f6f…`. `Total tests: 520`, `Passed: 520`, 0 `Failed`. 520 = 494 + 26 |
| All 26 new cases green | green log, `Passed DigitalHub…` for the ADM-02 classes, counted | R1 (2), R2 (2), R3, R4 (3), R5, R6, R7, K1, F1, F2 (5), F3 (2), F4 (2), F5a, F5b, W1, W2: 26. W1 printed no `website check:` line |
| The CI step ran as written | green log | `Download action repository 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020'`, then `Run npm ci`, `added 114 packages`. W1 found `website/node_modules` |
| The merge changes nothing of ADM-02 | `git diff --quiet a34947a 4857eff -- api website .github` | Exit 0: the product, test and workflow files are byte-identical to the commit the tester tested. `git diff --name-only b9c5f6f 4857eff` gives the 17 files of plan section 4 and the six `docs/changes/ADM-02/` records, nothing else |
| B-4 and B-5 on the new commits | `git log -1 --format=%B 5c33a7b 4857eff` | Both have `ADM-02:` subjects and both trailers. The base was merged in, with no rebase and no force-push |

So gate 1's red-first requirement and the G3 rule ("committed and shown failing
before the fix") are both met. F1 was red locally, and all 21 cases, the 20
database cases included, were red in CI on the tests-only commit before any fix
was pushed. The tester's local evidence stays valid, because the tested product
files did not change.

## Round 1 items, closed or still open

| Round 1 item | Status |
| --- | --- |
| O-ADM02-1 answered | Closed: "Yes" (see above, and the "both" caveat) |
| CI red at `7c93e52`, exactly 21, with assertions; F3, F5b, W2 pass; W1's three lines | Closed (table above) |
| CI green on the final head, every job, with run ids | Closed for `4857eff`. See open item 1 for the head that will carry this file |
| The developer adds the run ids to `implementation.md` | **Waived.** This was my procedural request, not an engineering standard or owner rule. The ids and the evidence are recorded here and go into the pull request body, so a third copy adds no assurance. `implementation.md` is unchanged since `a34947a` |
| F-1 and F-2 go to ADM-07 | Unchanged. The coordinator hands them to the ADM-07 architect |
| O-ADM02-2 | Still PENDING and not asked. It blocks only the G3-1 exit gate. I advise asking it before the merge, because of B4 |

## Definition of Done, round 2

| Box | Round 2 |
| --- | --- |
| Requirement and acceptance criteria stated and met | Yes. Database proof: run `43012635577`, job `130495931919` |
| Tests exist; every security fix has a regression test | Yes. Red in `43012090027` / `130493970283`, green in `43012635577`. Changed-line coverage is not gated yet (GAP-18) |
| PR checks green on the final head (run ids quoted) | Yes for `4857eff`. **Open** for the docs-only commit that will add this file (open item 1) |
| Reviewed by someone other than the author | **Open:** the owner's review at merge |
| Deployment note | **Open:** name the slot 2 integrator, who re-runs the suites after the merge |
| `docs/deferred-items.md` for any exception | Not needed: O-ADM02-1 is "Yes", so no exception is taken |
| Every other box | As in round 1: Yes |

## Pull request description, values to fill

Use round 1's draft, with these values:

- **Red:** "Red commit `7c93e52` (tests only): CI run 43012090027, job `api`
  130493970283, `Total tests: 519, Passed: 498, Failed: 21`. The 21: R1 (2),
  R2 (2), R3, R4 (3), R5, R6, R7, F1, F2 (5), F4 (2), F5a, W1, each failing as the
  plan predicted. W1's three lines: the `case_cards` uuid format, the upper-case
  media id not in the media list, and `Two redirects start at /adm02-…-x/`. F3,
  F5b and W2 passed."
- **Green:** "Final head `4857eff`: CI run 43012635577. `api` 130495931919
  (`Total tests: 520, Passed: 520`), `website` 130495931416, `studio` 130495931890,
  `website-browser` 130495931861, `section-compare` 130496269071, all green;
  screenshot parity skipped (optional). Security 43012635671 and Workflow lint
  43012635605 green."
- **Owner decisions:** "O-ADM02-1: "yes both" (Mohamed Elbadry, 11 November 2026,
  project chat)", followed by what "both" covers, in the owner's words, or "the
  second question is not recorded".
- **O-ADM02-2:** PENDING, the G3-1 exit gate only.
- **B1 to B7:** listed as in round 1, for the owner to accept at merge.
- **DoD:** tick "PR checks are green on the final head" only once open item 1 is
  green.

## Open items before the merge (not gate 2 conditions)

1. The coordinator commits this file, together with round 1's earlier commit
   `5c33a7b`, as a docs-only commit. CI must be green again on that new head, and
   the integrator quotes its run id. Docs-only, but it is the head that merges.
2. Fill the pull request body (above), mark #54 ready for review, and ask the owner
   to confirm the merge. The owner's confirmation is the acceptance of B1 to B7,
   B4 especially. This approval is not.
3. Record what "both" in the owner's answer covers.
4. The integrator merges #54 alone in slot 2 and re-runs the suites after it.
   ADM-07 is cut only after this merge.
5. Hand F-1 and F-2 to the ADM-07 architect. Schedule ADM-02b. Ask O-ADM02-2.
6. The tester's detached worktree `/home/user/dh-test-adm02` is still present. Its
   owner removes it.

## Decision, round 2

**Approved.** The CI evidence gate 1 and round 1 required is real, and I checked it
against the job logs and the GitHub API:

- red on the tests-only commit for exactly the 21 planned cases, each for the
  planned reason;
- the guards passing at the red;
- all 520 green on `4857eff`;
- every `ci.yml` job, plus Security and Workflow lint, green.

The merge from the base changed no ADM-02 file. The change now goes to the owner
for merge confirmation, with the open items above.

Verdict: APPROVED
