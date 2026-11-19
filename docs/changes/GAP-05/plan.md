# GAP-05: Make the section comparison block, and settle the screenshot comparison

Status: **Ready for plan review.** O-11 and O-21 are answered (section 9).

## 1. Item

- Closes: GAP-05 (refinement plan, Gap register line 69; Wave 1 table line 155).
  Source: "Locked design; finding 5" (`docs/quality/test-report-2026-10-27.md:46`).
- Track: **G1, Wave 1** (gates and API).
- Register "Done when" (line 69): "Both comparisons block, or the screenshot one
  has a recorded exception; 0 unaccepted differences".
- Wave 1 "Done when" (line 155): "`continue-on-error` is gone from the section
  comparison, which reports 0 failures; the screenshot step blocks or has a D-NNN
  entry". The item itself reads: "Restore or accept the careers apply section;
  make the section comparison blocking; make the screenshot comparison blocking
  or except it until its register has approved entries". By: "Agent; owner
  decides O-11".
- Risk row (line 262): "Settle the careers section (O-11) in the same pull
  request that removes `continue-on-error`".
- Handed over by GAP-09: its condition C-3 (`docs/changes/GAP-09/plan-approval.md:55`)
  left the GAP-05 comment block and both `continue-on-error` lines untouched for
  this change.

## 2. Current state

Worktree `D:\work\DigitalHub\dh-platform-claude-gap-05`, branch `change/GAP-05`
at `0488d89` (ADM-12d, #77). All required documents exist and were read.

**Workflow** (`.github/workflows/ci.yml`):

- `section-compare` job, lines 300-363. Comment at 304-308 ("Non-blocking until
  Section 5 has merged ... remove continue-on-error from the compare step").
  Step "Compare sections" has `continue-on-error: true` at **line 338**, and runs
  `npm run compare:sections` (`node tools/section-compare/run.mjs`), which sets
  `process.exitCode = pass ? 0 : 1` (`run.mjs:122`).
- `screenshot-parity` job, lines 365-427, runs only on a pull request labelled
  `screenshots` (line 374). Comment 369-371: "The comparison does not fail the
  workflow while the screenshot register waits for its first approved entries."
  Step "Compare screenshots" has `continue-on-error: true` at **line 410**
  (`compare.mjs:176` sets exit code 1 on any failure). The "Chromium regression
  tests" step before it already blocks.

**Section comparison, latest base run** (CI run 44554202307, push of #77 to
`rebuild/dotnet-platform`, 2026-11-19, conclusion success only because of
`continue-on-error`):

```
104/119 sections match; 14 accepted; 1 failures (including chrome).
Chrome: 42 match; 36 accepted out of 78.
Section 5 formerly missing sections: 9 match, 6 accepted (16/16 found).
differs: /careers/apply.html #section
```

Report artifact `section-compare/report.md`: "**Fail.** 1 not accepted". The
first lines of the difference:

```
- differs: `/careers/apply.html` `section`
  - old `2<section class=careers-apply careers-apply--form|data-reveal=|id=apply`
  - new `2<section class=careers-apply|data-reveal=|id=apply`
  - old `3<p data-careers-apply-intro=`
  - new `3<style `
  - old `4#text:Share your background and CV. We’re always meeting strong talent across engineering, data, and delivery.`
  - new `4#text:.apply-form { display: flex; flex-direction: column; gap: 0.85rem; max-width: 36rem; } ...`
  - old `3<form action=/api/careers/applications|class=careers-apply-form|data-role=General application|data-submit-url=/api/careers/applications|enctype=multipart/form-data|method=post`
  - new `3<h2 `
  - old `4<input name=role|type=hidden|value=General application`
  - new `4#text:Apply`
  - old `4<input name=roleSlug|type=hidden|value=`
  - new `3<form action=/api/v1/public/apply|class=apply-form|enctype=multipart/form-data|method=post`
```

**Why it differs** (root cause, found by reading the history):

- `website/tools/section-compare/accepted-differences.json` has entry
  `apply-by-email` (selector `section.section.careers-detail`, reason "the apply
  page links to the careers email; the website has no hiring system"). Its
  handler, `compare.html:193-215`, accepts only a "How to apply" block: an `h2`,
  a paragraph, an `a.btn-pill` `mailto:` link and a second paragraph. It was
  added by #22 (`6966046`, "Apply by email until the hiring application exists").
- #33 (`6470fac`, "Careers intake: apply by email, HR counts, end a vacancy")
  then replaced that block with a posted form, `website/src/components/ApplyForm.tsx`
  (used by `HowToApply.tsx:13` and `VacancyPage.tsx:17`): an inline `<style>`,
  `<h2>Apply</h2>`, `form.apply-form` posting to `/api/v1/public/apply` with
  fields `name, email, phone, message, cv, consent, website` (honeypot), and a
  `mailto:` fallback line. The entry therefore no longer matches, and the
  section has been unaccepted ever since.
- The locked design (`feature/interviewer-portal:careers/apply.html:231-280+`,
  read only with `git show`) is `section.careers-apply.careers-apply--form` with
  an intro paragraph and `form.careers-apply-form` using the ported classes
  (`careers-apply-form__trap`, `__file`, `__hint` ...) and the old hiring fields:
  `currentSalary, email, expectedSalary, expectedSalaryRange, fullName, linkedin,
  noticePeriod, noticePeriodWeeks, phone, resume, role, roleSlug, website,
  yearsOfExperience`. The new API (`PublicApplyController`, ISO-2) accepts the
  smaller field set. So the new section is both a different design (unported
  inline styles) and a different field set.

**Screenshot comparison.** `website/tools/screenshot-parity/accepted-differences.json`
has **0** entries in `differences` (`node -e` count). The last labelled run,
44538086421 (pull request for `change/GAP-NEXT-UPGRADE`, 2026-11-19), logged
**126** captures "… differs" and 86 matches; the Chromium regression step passed
("chromium regressions: passed 30, placeholder 1, problems 0"). The screenshot
comparison cannot block today without turning every labelled pull request red.

**Deferred register.** `docs/deferred-items.md`: "No entries yet." An entry
"exists only once the owner has decided it".

**Open pull request #78 (GAP-11c)** changes `website/package.json`,
`website/package-lock.json`, `website/scripts/check-output.ts`,
`website/test/output.test.ts` and its `docs/changes/GAP-11c/` records (`gh pr view 78`).
No file in this plan's scope is among them.

**Parallel change ISO-3 (no pull request yet).** Branch `change/ISO-3` (worktree
`D:\work\DigitalHub\dh-platform-claude-iso-3`, head `dd9a1f3`) also changes
`.github/workflows/ci.yml` (adds `FORMS_LOGIN`, `FORMS_PASSWORD`,
`ConnectionStrings__PublicForms` and the login creation step; plan review F-1).
The hunks differ from this plan's, but `CLAUDE.md` says "Parallel changes must
change different files", so the two are sequenced (section 4).

Local end-to-end harness is broken (caller's note); every comparison here is
evidenced by CI runs, not local runs.

## 3. Design

Two parts, one topic (the two parity comparisons in `ci.yml` become real gates).

**Part A: the careers apply section, then the section comparison blocks.**
The owner answered O-11 with (a), accept the current form. Option (b) is kept
below only as the record of what was rejected.

- **O-11 = (a) accept the current form.** Replace the stale `apply-by-email`
  entry with a new entry of a new kind, `apply-form`, handled in
  `compare.html` next to `apply-by-email`. Like `empty-vacancies`, it rebuilds
  the expected section from the old one and requires an exact match: it replaces
  only the old `<p data-careers-apply-intro>` and `form.careers-apply-form` with
  the exact current markup (the `<style>` block, `h2` "Apply", `form.apply-form`
  with the listed fields, the action `/api/v1/public/apply`, and the `mailto:`
  fallback built from `settings.careersEmail || settings.email`), and drops the
  `careers-apply--form` modifier class. Anything else in the section must match.
  The entry's `selector` is `section#apply.careers-apply.careers-apply--form`,
  which matches the old section (`feature/interviewer-portal:careers/apply.html:231`).
  The handler, like `apply-by-email` at `compare.html:196`, checks
  `copy.matches(rule.selector)` against the old section. The stale entry's
  `section.section.careers-detail` matched neither side, so it never applied,
  even before #33. Test 2 asserts that the selector matches the old section.
  The entry's `reason` quotes the owner's O-11 words. The handler for
  `apply-by-email` and its entry are removed, since nothing renders that block.
- **O-11 = (b) restore the locked design.** That is a design change to
  `ApplyForm.tsx` (two pages use it) and touches the ISO public-form contract,
  so it is too big for this pull request (B-8). Split: **GAP-05a** ports the old
  markup and classes, keeping the new API's field set, plus a scoped
  `apply-form-fields` acceptance for the field differences the owner accepts;
  **GAP-05** (this plan, Part A) then only removes `continue-on-error`. This
  plan would be revised to depend on GAP-05a.

In both cases, once the comparison reports 0 failures, delete
`continue-on-error: true` (line 338) and rewrite the comment at 304-308 to say
the step blocks and that a difference must be fixed or added to
`accepted-differences.json` with the owner's decision.

**Report mode (`*_BLOCKING_FROM`) does not apply to the section comparison.**
The standard (section 3): "A new gate reports for seven days from its merge
... then blocks, unless it replaces protection that already existed". This gate
is not new: the job has run on every pull request and push in report mode
(`continue-on-error`) since Section 5, far longer than seven days (it reported
the same single difference in the 2026-10-27 test report). Its report period is
spent, and the Wave 1 "Done when" asks for `continue-on-error` to be gone, not
for a date. The plan therefore blocks at once and adds no
`SECTION_COMPARE_BLOCKING_FROM`. The plan-reviewer should challenge this if they
read the rule differently; the fallback is a `SECTION_COMPARE_BLOCKING_FROM`
date seven days after merge, using the `BROWSER_TESTS_BLOCKING_FROM` pattern
already in `ci.yml`.

**Part B: the screenshot comparison.** With 126 unaccepted captures and an empty
register, blocking now is not possible without accepting differences nobody has
decided. The item allows "except it until its register has approved entries".
The owner answered O-21 "Exception, expires 14 Dec", so:

- Add a D-NNN entry to `docs/deferred-items.md` (next free id at commit time,
  checking open branches; expected D-001). Rule waived: no G-n id exists for
  it, so the entry cites the rule by location: "ENGINEERING_STANDARDS.md
  section 3, project gates kept as stricter rules: screenshot parity (label
  `screenshots`)", with the description "GAP-05: the screenshot comparison
  blocks". It also notes that P-6 still applies: nothing is loosened, only the
  blocking is deferred. justification, the owner's exact words,
  Follow-up owner: "The /change pipeline" (owner, 2026-11-19, via the
orchestrator): the agent pipeline prepares the triage and the owner approves
each acceptance, **Expires: 2026-12-14** (Wave 3 gates
block), follow-up pull request "not opened", follow-up work: triage the 126
differing captures of run 44538086421 into fixes or approved register entries.
- Keep `continue-on-error: true` on "Compare screenshots", and replace the
  comment at 369-371 with one that cites the D-NNN id and its expiry.
- A test (below) fails when the step has `continue-on-error` and no unexpired
  D-NNN is cited, so the exception cannot outlive its expiry silently ("An
  expired entry fails the gate that cites it").

On 2026-12-14 test 4 fails until the step blocks or the owner renews the entry.

**Rejected alternatives.**

- Widen the stale `apply-by-email` entry, or match the section loosely (for
  example by class only): weakens the gate (P-6); the entry must name exactly
  what is accepted.
- Remove `/careers/apply.html #section` from the compared sections: hides the
  difference, P-6.
- Restore the old markup in this pull request: two topics (B-8) and changes the
  public form contract that ISO-2 just settled.
- Make the screenshot comparison block with a pixel tolerance: the register
  description says "everything else on the page is still compared with zero
  tolerance"; loosening it is P-6.
- A committed canary for the section comparison: GAP-21 owns canary fixtures
  for every gate; the tool needs whole page pairs, which is its own change.
  Listed as out of scope, not dropped.

## 4. Scope

Files (O-11 = (a)):

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | Remove `continue-on-error: true` from "Compare sections" (line 338); rewrite comment 304-308. Rewrite comment 369-371 to cite the D-NNN and its expiry 2026-12-14; line 410 stays until then. Nothing else in the file changes. |
| `website/tools/section-compare/accepted-differences.json` | Remove `apply-by-email`; add `apply-form` with page `/careers/apply.html`, section `section`, selector, and a reason quoting O-11 verbatim: "(a) Accept current form" (owner, 2026-11-19, via the orchestrator). |
| `website/tools/section-compare/compare.html` | Remove the `apply-by-email` branch (193-215); add the `apply-form` branch that builds the exact expected section. |
| `website/test/parity-gates.test.ts` (new) | The tests in section 5. |
| `docs/deferred-items.md` | One D-NNN entry for the screenshot comparison, Owner decision: "Exception, expires 14 Dec" (2026-11-19, via the orchestrator); Follow-up owner: "The /change pipeline"; Expires: 2026-12-14. |
| `docs/changes/GAP-05/*` | Pipeline records. |

**Sequencing with ISO-3 (`ci.yml`).** ISO-3 goes first. GAP-05's developer
may write and commit everything else (the tests, `accepted-differences.json`,
`compare.html`, `docs/deferred-items.md`), but **does not commit the `ci.yml`
edit until ISO-3 has merged** into `rebuild/dotnet-platform`. Then the developer
runs `git fetch origin` and `git merge origin/rebuild/dotnet-platform` into
`change/GAP-05` (a merge, not a rebase, so commits already tested keep their
ids), and makes the `ci.yml` edit on top. Before that commit the developer
checks and quotes:

- `git log --oneline origin/rebuild/dotnet-platform -- .github/workflows/ci.yml`
  shows the ISO-3 squash commit;
- `git diff origin/rebuild/dotnet-platform change/ISO-3 -- .github/workflows/ci.yml`
  is empty (nothing of ISO-3's `ci.yml` is unmerged), or ISO-3's branch is gone;
- `git branch -a --format='%(refname:short)'` and, for each `change/*` branch
  not yet merged, `git diff --stat origin/rebuild/dotnet-platform...<branch> -- .github/workflows/ci.yml`
  shows no other change on `ci.yml`.

If ISO-3 is still unmerged when the rest of GAP-05 is ready, GAP-05 waits. The
tech lead may reverse the order at gate 1, and records it in `plan-approval.md`.
Otherwise this order stands. The tester's checkout and gate 2 use the commit
made after the merge.

Out of scope: `website/src/components/ApplyForm.tsx`, `HowToApply.tsx`,
`VacancyPage.tsx` and the public API (no markup or behaviour change under (a));
the screenshot register's 126 differences (follow-up under the D-NNN);
filling `website/tools/screenshot-parity/accepted-differences.json`; section
comparison canary (GAP-21); every file in open PR #78; any other `ci.yml` job;
DH-WEBSITE-main (read only, with `git show`).

## 5. Test plan

**Failing tests first**, in `website/test/parity-gates.test.ts`, committed and
shown failing before the fix:

1. `the section comparison step blocks`: reads `.github/workflows/ci.yml`, finds
   the `section-compare` job's "Compare sections" step, asserts it has no
   `continue-on-error`. Fails today (line 338).
2. `every section acceptance entry has a handler`: for each entry in
   `accepted-differences.json`, asserts `compare.html` contains
   `rule.kind === '<kind>'`, and that the `apply-form` entry exists for
   `/careers/apply.html` section `section` and its reason is not empty, and
   that its `selector` matches the old section. It parses the old
   `careers/apply.html` read with `git show feature/interviewer-portal:careers/apply.html`,
   or, where the branch is not fetched, a copy committed under `website/test/fixtures/`
   and checked against `ci.yml`'s old-site checkout in CI. Fails today (no
   `apply-form`).
3. `the apply-form acceptance names the form the site renders`: renders
   `ApplyForm` (as `pages.test.tsx` renders components) and asserts that the
   action, the field names and the `h2` text listed in the entry equal those in
   the rendered markup. It also asserts that the inline `<style>` text the
   handler copies into the expected section equals the `<style>` text that
   `ApplyForm` renders, after the same whitespace normalisation the
   comparison uses. A later markup or CSS change to the form then fails in a
   unit test, not only in CI. Fails today.
4. `the screenshot comparison is blocking or excepted`: if "Compare screenshots"
   has `continue-on-error`, the job comment must cite a `D-NNN` that exists in
   `docs/deferred-items.md` with an `Expires:` date on or after today. Fails
   today (no entry cited).

**Afterwards, by exact command** (in `website/`, Release not relevant):

- `npx vitest run test/parity-gates.test.ts` (4 pass)
- `npm test` (all website Vitest; the 409 known plus the 4 new)
- `npm run typecheck` and `npm run build` (snapshot build used by CI)
- `npm run compare:sections` with `SECTION_COMPARE_PORT=4290`,
  `SECTION_COMPARE_OLD` = a read-only `git worktree`-free export of
  `feature/interviewer-portal` (or NOT RUN locally, with CI job
  `section-compare` as the evidence). Expected: `0 failures`, `**Pass.**`.
- `actionlint` on `ci.yml` (GAP-08's job "Workflow lint"): 0 findings.
- CI on the pull request: `section-compare` passes with the step blocking and
  the summary showing "0 failures"; the pull request carries the `screenshots`
  label once so `screenshot-parity` runs, its regression step passes, and its
  report is reviewed by hand and quoted.
- Proof the gate fires: on the change branch, a throwaway commit that changes
  one word in the apply hero makes `section-compare` fail; quote the run, then
  drop the commit before review. (Stands in for the GAP-21 canary.)

**Track checklist, G1 Waves 1 to 3:** one gate per pull request (the parity
comparisons, B-8). Report period: not applied to the section comparison, with
the reason in section 3; the screenshot comparison is excepted by D-NNN, not
blocking. Canary fixture: deferred to GAP-21, proof-by-throwaway-commit above.
Actions stay pinned by 40-character SHA, image by digest, Node and .NET exact
(no `uses:`, `image:` or version line changes; reviewer checks the diff).
Baselines only shrink: section failures 1 to 0; accepted entries change by one
replaced entry, none widened.

## 6. Security impact

None to routes, policies, logins, secrets or dependencies: no API, Studio or
package change. The gate change strengthens design protection. Two notes: the
`section-compare` job checks out `feature/interviewer-portal` with
`persist-credentials: false` (unchanged); the screenshot job log prints the
CI-only SQL passwords from the workflow env (seen in run 44538086421); they are
CI-only values defined in the workflow, not secrets, and unchanged here.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. That restores `continue-on-error` and the old entry; no
data or schema involved.

## 9. Owner decisions needed

Id check (F-2): `git grep -hoE "\bO-[0-9]+\b"` over `docs/` and
`ENGINEERING_STANDARDS.md` on every local and remote branch returns ids up to
O-20 (O-18 to O-20 are used in `docs/changes/GAP-07/`). The screenshot decision
is therefore **O-21**. Earlier revisions called it O-18; only the id changed,
not the owner's words.

Both answered. Quoted verbatim, as given by the owner on 2026-11-19 via the
orchestrator:

- **O-11** (careers apply section: (a) accept the current apply form as a
  recorded difference, or (b) restore the old design around the new fields as
  GAP-05a). **Answered:** "(a) Accept current form". Effect: an exact-match
  `apply-form` acceptance quoting this decision; GAP-05 makes the section
  comparison block now. GAP-05a is not needed.
- **O-21** (new; next free id, see the id check above). Screenshot
  comparison: D-NNN exception or block now. **Answered:** "Exception, expires
  14 Dec". Effect: D-NNN entry, the screenshot comparison stays non-blocking
  until 2026-12-14 (Wave 3 gates block), with a follow-up to triage the 126
  differences.
- D-NNN follow-up owner (part of O-21). **Answered:** "The /change pipeline"
  (owner, 2026-11-19, via the orchestrator). Effect: the agent pipeline
  prepares the triage of the 126 differences; the owner approves each
  acceptance. No owner decision remains open.

## 10. Risks

- The `apply-form` entry accepts more than the owner accepted. Caught by: the
  handler rebuilds and requires an exact match; test 3 ties the entry to the
  rendered form; reviewer reads the entry against the O-11 words.
- Blocking turns CI red on unrelated pull requests (risk row 262). Caught by:
  the change reaches 0 failures in its own CI run before merge.
- Build-dependent text (copyright year, settings email) changes the section.
  The handler reads `settings` as the existing `apply-by-email` one does.
- Overlap on `ci.yml` with ISO-3, or with any other branch. Handled by the
  sequencing in section 4: the `ci.yml` edit is committed only after ISO-3 has
  merged and the base has been merged in, with the three commands quoted. No
  file overlaps with #78.
- On 2026-12-15, test 4 fails `npm test` in the `website` job on every pull
  request, including unrelated ones, unless the screenshot comparison blocks
  by then or the owner has renewed the D-NNN. This is intended ("An expired
  entry fails the gate that cites it"). Owner of the work: "The /change
  pipeline", which triages the 126 differences before the expiry. The test's
  failure message names the D-NNN, its expiry and this plan, so nobody is
  surprised.
- The handler's copy of the form's CSS drifts from `ApplyForm.tsx`. Caught by
  test 3 (style text) and by the now-blocking `section-compare` job.
- The D-NNN expires and nobody notices. Caught by test 4.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Careers apply section accepted, "(a) Accept current form" (O-11) | Plan line 155; risk 262 | Planned | |
| `continue-on-error` gone from the section comparison | Plan line 155 | Planned | |
| Section comparison reports 0 failures (0 unaccepted differences) | Register line 69; plan line 155 | Planned | |
| Screenshot step has a D-NNN entry expiring 2026-12-14 (O-21) | Register line 69; plan line 155 | Planned | |
| Report-mode rule stated and applied | Standard section 3; README G1 checklist | Planned | |
| Failing tests 1-4 committed first and shown failing | README; B-6 style | Planned | |
| Gate shown to fire (throwaway commit) | README G1 checklist (canary, GAP-21) | Planned | |
| No overlap with PR #78; `ci.yml` edit committed only after ISO-3 merged; no other `ci.yml` line changed | Caller; plan review F-1; GAP-09 C-3 | Planned | |

## 12. Revision log

- Round 0 (2026-11-19): first plan. No `plan-review.md`, `plan-approval.md` or
  `implementation.md` existed.
- Round 1 (2026-11-19): the owner answered O-11 "(a) Accept current form" and
  O-21 "Exception, expires 14 Dec" (via the orchestrator). Status changed from
  BLOCKED ON OWNER to ready for plan review; Design, Scope, section 9 and the
  coverage table fixed to option (a) and to the D-NNN entry expiring
  2026-12-14, with the triage of the 126 screenshot differences as its
  follow-up. Option (b) and GAP-05a dropped. The follow-up owner's name is
  still to be given.
- Round 2 (2026-11-19): the owner named the D-NNN follow-up owner, "The
  /change pipeline" (via the orchestrator). Recorded in Design, Scope and
  section 9; the open point is closed.
- Plan review Round 1 (`plan-review.md`, CHANGES NEEDED):
  - F-1: named ISO-3 (`change/ISO-3`, `dd9a1f3`) as a parallel change on
    `ci.yml`. Sequencing in section 4: ISO-3 merges first. GAP-05 commits its
    `ci.yml` edit only after that, by merging the base in (not rebasing), with
    three check commands quoted. Risk and coverage rows updated.
  - F-2: a grep over every branch shows O-ids up to O-20, so the screenshot
    decision is renumbered from O-18 to **O-21** throughout. The owner's words
    are unchanged. (Earlier log lines now read O-21 too.)
  - F-3: the D-NNN "Rule waived" cites the standard's section 3 project gate
    "screenshot parity", by location, since it has no G-n id.
  - F-4: the `apply-form` selector is `section#apply.careers-apply.careers-apply--form`,
    and test 2 asserts it matches the old section. Recorded that the stale
    selector never matched.
  - F-5: added the 2026-12-15 `npm test` failure as a risk, with its owner.
  - F-6: test 3 also compares the inline `<style>` text; risk added.
