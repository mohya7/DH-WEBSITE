# ADM-12d plan review

Plan reviewer, step 2. Reviewed `docs/changes/ADM-12d/plan.md` (Round 0, 2026-11-19)
on branch `change/ADM-12d`, base `8027e87`.

## Round 1

### Findings

**1. Major: section 3.2 and section 5 step 4. Mutant M1 does not compile, and the
mutant runs do not require a successful build.**

- What is wrong: M1 is "Delete line 100 (`Add(errors, "image", ...)`)". At `8027e87`,
  line 99 is `if (EffectiveAlt(over, fieldAsset.Alt) is null)` and line 100 is the
  `Add(...)` statement it guards, with no braces. Line 101 is the closing `}` of the
  outer `if`. Deleting line 100 leaves `if (...)` followed directly by `}`. That is a
  syntax error (CS1525, invalid expression term `}`), so the mutant build fails.
- Evidence: `sed -n 96,102p api/src/DigitalHub.Api/Content/PublishChecks.cs` shows
  ```
              if (EffectiveAlt(over, fieldAsset.Alt) is null)
                  Add(errors, "image", "Add alt text for the image.");
          }
  ```
- Why it matters: step 4 says "rebuild with step 2's command, run step 3's command",
  and step 3 runs with `--no-build`. Step 4 does not say the mutant rebuild must exit
  0. If the build fails and the run goes ahead, `--no-build` tests the stale,
  unmutated assemblies, and both facts pass. Either the developer stops on "the mutant
  did not fail as expected", or a failed build gets recorded as a mutant that
  survived. M1 is the mutant the tester repeats on the detached checkout, and it is
  the main evidence that the facts catch the ADM-12 bug ("ships cards with no alt
  text"). M2 and M3 compile as written.
- What would satisfy me: (a) M1 written as an edit that compiles and removes the
  error. For example, delete lines 99-100 together, or change line 99's condition to
  `if (false)`. Give the exact text of the edit. (b) In step 4, each mutant's rebuild
  must exit 0 with `0 Error(s)` before step 3's filter runs, and the build's exit code
  is recorded with the test's. Running the mutant filter without `--no-build` would
  also work.

**2. Minor: section 3.1, Fact A step 4, and section 10, last risk row. The check that
the PUT keeps `imageId` appears only in the risk table.**

- What is wrong: the risk row says "the developer asserts, from the PUT response,
  that `fields.imageId` is still the seeded id". Fact A's steps do not include it.
  Without it, step 5's 200 could come from a draft that has no image at all. Then the
  override half would prove nothing, and mutant M2 is the only thing that would catch
  it.
- What would satisfy me: add the assertion to Fact A step 4, so the developer builds
  it from the design and not from the risk table.

**3. Minor: section 3.1, step 6. Cleanup in `finally` can hide the real failure.**

- What is wrong: `RemoveItemAsync` ends with
  `Assert.Equal(HttpStatusCode.NoContent, response.Status)`. If that assertion throws
  inside `finally` after an earlier assertion has already failed, xUnit reports the
  cleanup failure, not the original one. This matters most during the mutant runs,
  whose failing assertion lines are the recorded evidence. The existing alt facts
  (lines 680 and 715) clean up inline, without `finally`.
- What would satisfy me: either clean up inline, as the neighbouring facts do, or
  state that the mutant evidence is the first failing assertion in the test output,
  checked against the expected step in the 3.2 table. The item-before-asset order
  must stay either way: `TeamMember.ImageId` has an FK to `Media` with
  `DeleteBehavior.NoAction` (`ContentModelBuilder.cs:78`, `:262`), so the asset cannot
  be removed while the item still exists.

**4. Minor: section 11, rows 4 and 5, and section 3.3, last bullet. The mutation
approach is credited to the owner.**

- What is wrong: the coverage table names "Owner's brief for this run" as the source
  for the mutation runs and for "pass against today's code". Section 3.3 says P-6 "and
  the owner's brief" rule out a red commit. The owner's quoted request is only "ADM-12d
  Test the card-image alt check at publish". The approach comes from the pipeline's
  instructions for this run, not from an owner decision. Per `docs/changes/README.md`,
  only the owner's own words count as owner decisions.
- What would satisfy me: give the real source. That is the run's brief from the
  coordinator, together with P-4, B-6 and the G3 rule "shown failing before the fix".
  Those rules assume a fix, and there is none, so the mutation runs are this plan's
  way of meeting the G3 rule's intent. Do not credit the approach to the owner.

### Checked and found sound

- **Fit.** The item matches the ADM-12d follow-up text in
  `docs/changes/ADM-12c/plan-approval.md:54`, quoted word for word. The ADM-12 audit
  text (`admin-audit-2026-10-28.md:202-208`) and the G3-1 exit gate
  (`refinement-plan-2026-10-28.md:225`) are also quoted exactly. Both parts of the
  follow-up are dealt with: the `image` key test, and the importer question, assessed
  and decided.
- **Current state.** `PublishChecks.cs:94-101` is the card-image check as quoted.
  `EffectiveAlt`/`First` (lines 324-333) ignore `Decorative`. `AltText.IsPublishable`
  returns true for a decorative asset, so the swap that Fact B and M3 guard against is
  a real regression path. `ContentStore.PublishAsync` (lines 304-318) returns
  `publish_blocked` with an `errors` dictionary of string arrays (`PublishBlocked`,
  line 1351), so asserting "exactly one key, `image`, with exactly one message" is
  possible. `fields.imageId`/`imageAltOverride` are allowed on the five collections
  named (`ContentDocuments.cs:109-114`). Save checks only their shape. `CheckAsync`
  needs only that the media exists, and the seeded asset does.
- **No existing test.** A grep for the message `"Add alt text for the image."` in
  `api/tests` finds nothing, and the plan's grep evidence is accurate.
- **Fact design.** Team members have no description rule (the public-path and
  error-page logic in `AddAsync`, proven by the fact at line 559) and no body rule. So
  `image` can be asserted as the only error. Expected results for mutants M2 and M3
  are right: M2 fails A at step 5 only, and M3 fails B at step 3 only. The helpers
  `BareImage`, `RemoveMediaAsync`, `RemoveItemAsync` (with `team-members`), `Code`,
  `Text` and `ReadPage` exist as described. `RemoveItemAsync` unpublishes before
  deleting, and `DeleteAsync` refuses a published item (`ContentStore.cs:245-246`).
- **Rejected alternatives.** These are real alternatives: a theory over all five
  collections, seeding through the database, a presence-only assertion, an e2e test,
  and a red commit. The reasons given hold.
- **Scope (B-8).** One topic: one test file, plus records. No branch, local or
  remote, among ADM-04, ADM-07c, GAP-11, GAP-09-status, GAP-NEXT-UPGRADE, ISO-1, ISO-2
  and adr-0001-accept touches `ContentPublishTests.cs` or `PublishChecks.cs` relative
  to the base. On ADM-05, `PublishChecks.cs` differs only by history, with no content
  diff, as the plan says. No users or error-pages files are touched.
- **Importer decision (ADM-12e).** It is a behaviour change in another module, so
  keeping it out of scope is right (P-7, B-8). The facts behind it check out:
  blank-alt media is a warning on purpose (`ContentBundle.cs:434-439`). The settings
  check loops only over the bundle's own `settings` rows (lines 454-468). The
  settings row is created by the first save (`Content/AdminStore.cs:273`), which
  corrects the ADM-12c premise in `plan-approval.md:50`. The proposed follow-up text
  is left for the tech lead to record, and the plan does not edit other change
  records.
- **Quality gates (P-6).** No gate, guard, baseline or test is weakened. No new gate.
  The mutants are local only. `git diff --exit-code -- api/src` and the step 7
  file-list check stop them from being committed.
- **Commands.** Release throughout. `api/DigitalHub.slnx` and `api/dotnet-tools.json`
  exist. The filters match the two fact names. `npm ci` in `website/` comes before the
  full suite, as in CI. The local e2e is NOT RUN, with CI named as the evidence. That
  matches the known broken local harness.
- **Databases.** `ApiFactory` refuses any catalog but `DigitalHubContent_Test`
  (`ApiFactory.cs:131`). Nothing writes to `DigitalHubContent` or
  `DigitalHubContent_Studio`. The plan asks to coordinate the single test-database
  writer.
- **Security, migrations, rollback.** No route, policy, secret, dependency or
  migration changes, so none of those checks apply. Rollback is a revert of tests and
  records only. The risks are specific, and each one names how it is caught.
- **Owner decisions.** None is needed for this change. ADM-12e is marked as needing
  its own owner request and is not assumed.

Round 1 result: changes needed (1 Major, 3 Minors).

## Round 2

Reviewed the revised `plan.md` ("Revision round 2", 2026-11-19). Section 12 answers
each Round 1 finding.

### Round 1 findings

- **Major 1 (M1 does not compile; no build check): closed.** Section 3.2 now gives
  each mutant as an exact one-line replacement from the text at `8027e87`. Each one
  compiles:
  - M1 replaces line 100 with `{ }`. The `if` at line 99 keeps an empty block as its
    body, which is valid C#. CS0642 (possible mistaken empty statement) applies only
    to a bare `;`, not to `{ }`.
  - M2 (`EffectiveAlt(null, fieldAsset.Alt)`) leaves `over` assigned from a
    method-call result and never read. CS0219 is raised only for a constant
    assignment, so this builds with no warning, and `alt` is still used.
  - M3 adds `!fieldAsset.Decorative &&`. `MediaAsset.Decorative` is a `bool`, so it
    compiles.

  I confirmed that nothing under the repository sets `TreatWarningsAsErrors` or
  `WarningsAsErrors` in any `*.csproj`, `*.props` or `*.targets`, and that there is no
  `Directory.Build.props` or `.editorconfig` at the root or under `api/`. A
  warning could not turn a mutant into a build failure.

  Section 3.2 (steps 1-4) and section 5, step 4 both require
  `dotnet build DigitalHub.slnx -c Release` to exit 0 with `0 Error(s)`, recorded,
  before the `--no-build` filter runs. A failed build stops the run, and the plan says
  outright that it is never recorded as a survived mutant. After the restore, the
  developer checks `git diff --exit-code -- api/src`, rebuilds, and re-runs the two
  facts green. So the `--no-build` runs in steps 5 and 6 test the restored code. The
  tester's repeat of M1 uses the same build-then-test steps. A risk row was added
  (line 445). The expected failures are unchanged and still right: M1 fails A and B
  at step 3, M2 fails A at step 5, M3 fails B at step 3.
- **Minor 2 (the PUT keeps `imageId`): closed.** Fact A, step 4 now asserts that
  the PUT response still has the seeded image id and the override text.
- **Minor 3 (cleanup in `finally`): closed.** The reason for keeping `finally` is
  sound. Under M3, Fact B publishes the item, and inline cleanup would leave a
  published blank-alt team member in `DigitalHubContent_Test`. The evidence rule in
  3.1, step 6 settles the masking risk: the recorded failure must be the expected
  assertion at the expected step, and a cleanup failure is reported, not counted as
  evidence. The item-before-asset order and its FK reason are kept.
- **Minor 4 (approach credited to the owner): closed.** Sections 3.2, 3.3 and 11 now
  give P-4, B-6, the G3 rule and the coordinator's brief as the source of the method.
  They state that the owner did not choose it. The owner's quoted request is
  unchanged.

### New findings

**1. Minor: section 3.1, Fact A step 4. The JSON path for the PUT assertion.**

- What is wrong: the plan says to assert `fields.imageId` "from the PUT response".
  The item response nests the draft under `content`. `Present`
  (`ContentStore.cs:1146-1174`) returns `content = Body(collection, content)`, and
  `Body` (lines 1275-1288) carries `draft.Fields`. So the path is
  `content.fields.imageId` and `content.fields.imageAltOverride`, read with the
  existing `Text(body, "content", "fields", "imageId")` helper.
- Why it is only Minor: a wrong path makes `GetProperty` throw, so the test fails
  loudly at its first run on unchanged code. It cannot pass silently.
- What would satisfy me: the developer uses the `content.fields` path. No plan
  revision is needed.

### Re-checked and still sound

- **Scope:** still one test file plus `docs/changes/ADM-12d/*`. No users or
  error-pages files, and no product file is committed.
- **Commands:** Release only, `DigitalHubContent_Test` only, and CI is named as the
  e2e evidence.
- **ADM-12e:** still out of scope, and still left for an owner request.
- **No gate weakened (P-6).** No owner decision is needed for this change.

Verdict: APPROVED
