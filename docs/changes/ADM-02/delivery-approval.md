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

Verdict: BLOCKED ON OWNER
