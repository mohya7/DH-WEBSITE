# GAP-05 plan review

## Round 1

Reviewed `docs/changes/GAP-05/plan.md` (revision log Round 2) at `0488d89`, on
branch `change/GAP-05`. Claims checked against the code with read-only commands.

### Findings

**F-1 (Major). Section 2 "Open pull request #78" and section 10 "Overlap".
`ci.yml` is also changed by a parallel change, ISO-3.**
The plan checks overlap only against open PR #78. The local branch
`change/ISO-3` (in its own worktree) changes `.github/workflows/ci.yml`:
`git diff 0488d89...change/ISO-3 -- .github/workflows/ci.yml` shows 20 lines
added and 4 removed (`FORMS_LOGIN`, `FORMS_PASSWORD`, `ConnectionStrings__PublicForms`,
the login creation step). `CLAUDE.md`: "Parallel changes must change different
files." The hunks are different, but the rule is about files, not hunks.
Satisfied by: the plan names ISO-3 as a parallel change on `ci.yml` and states
the order (GAP-05 waits for ISO-3 to merge and rebases, or the reverse), with the
tech lead's sequencing recorded. It must not rely on "checked at commit time"
alone.

**F-2 (Major). Section 9 and the Design, "O-18".
The decision id O-18 is already in use.**
`docs/changes/GAP-07/delivery-approval.md` uses O-18 for a different open
question ("O-18 (the governing documents on the branch): pending", line 610,
and lines 15, 169, 283, 539) and also uses O-20. Recording the screenshot
exception as O-18 makes two decisions share one id, and the D-NNN entry and the
coverage table will cite it. The plan says "tech lead to confirm the number" but
then uses it throughout as settled.
Satisfied by: the plan takes the next free O-id after checking every change
folder and branch (O-19 is not used either on this base, but O-20 is), or the
tech lead records the number; every reference updated.

**F-3 (Minor). Section 3, Part B, D-NNN entry. "Rule waived" is not a rule id.**
The register template in `docs/deferred-items.md` says "Rule waived: <rule id,
for example S-7>". The plan writes "Locked design: screenshot parity blocks
(GAP-05)". Satisfied by: the rule id the parity requirement comes from (the
standard's locked-design or P-6 rule, whichever the refinement plan cites for
GAP-05), with the GAP-05 text as the description.

**F-4 (Minor). Section 2, root cause. The stale entry fails for a second reason.**
The `apply-by-email` handler (`compare.html:196`) skips when
`!copy.matches(rule.selector)`; the selector is `section.section.careers-detail`
while the old section is `section.careers-apply.careers-apply--form#apply`. The
entry would not have matched even before #33. This does not change the design,
but the new `apply-form` entry must use a selector that matches the old section,
and test 2 should assert that the selector matches (or the handler must not use
one). Satisfied by: one line in the design naming the selector to be used.

**F-5 (Minor). Section 10, Risks. Test 4 turns every pull request red on
2026-12-15.** That is the intended effect ("An expired entry fails the gate that
cites it"), but it fails `npm test` in the `website` job for every unrelated
change, not only the screenshot job. State this as a risk with its owner (the
/change pipeline triage) so it is not a surprise.

**F-6 (Minor). Section 3, Part A. The handler duplicates the inline `<style>`
text of `ApplyForm.tsx`.** Test 3 ties only action, field names and `h2` to the
rendered form; a CSS-only edit to `ApplyForm.tsx` will first be caught by the
`section-compare` CI job. Acceptable, since that job now blocks; note it in the
risks, or have test 3 also compare the style text.

### Checked and found sound

- Fit: the acceptance criteria quote register line 69 and Wave 1 line 155
  word for word; risk row 262 is honoured (O-11 settled in the same pull request).
- Current state: `continue-on-error: true` at `ci.yml:338` and `:410`; comments
  at 304-308 and 369-371 as quoted; `apply-by-email` handler at
  `compare.html:193-215`; `docs/deferred-items.md` has "No entries yet."; no
  D-NNN is claimed on any branch checked.
- Report-mode rule: `ENGINEERING_STANDARDS.md:48-49` and `docs/changes/README.md:95-97`.
  The argument that the comparison has run in report mode since Section 5 and
  is not new is sound; blocking at once, with the `*_BLOCKING_FROM` fallback
  named, is acceptable.
- Owner decisions: O-11 "(a) Accept current form", the exception "Exception,
  expires 14 Dec" and follow-up owner "The /change pipeline" are quoted
  verbatim with date and channel; nothing is assumed. Expiry 2026-12-14 is given.
- Gates (P-6): nothing is widened; the stale entry is replaced by an exact-match
  rebuild like `empty-vacancies`; rejected alternatives (loose match, dropping
  the section, pixel tolerance) are real and correctly rejected.
- Tests: four failing tests named, each fails today for the stated reason;
  commands exact; Release does not apply to Vitest. The canary is deferred to
  GAP-21 (refinement plan line 176), with a throwaway-commit proof in its place.
- `no-hiring-system.test.ts` allows `website/tools`, so the handler is not
  caught by its needles.
- Security: no route, policy, secret, dependency or migration change; no
  `uses:`/image/version line changes planned. Rollback is a plain revert.
- Scope: one topic; all listed files exist except the new test, which is new on
  purpose; no file of PR #78 is touched.

## Round 2

I re-reviewed the revised `plan.md` (revision log Round 3) against the Round 1
findings.

### Findings

**F-7 (Minor). Section 5, test 2. Two possible sources for the old page.**
Test 2 reads the old `careers/apply.html` either with `git show` or from "a copy
committed under `website/test/fixtures/`". The developer has to pick one and
name it. If a fixture copy is used, the plan must say how it is checked against
the old site in CI (the step or test that does it). This is not a blocker,
because test 2 fails today either way.

### Round 1 findings, resolved

- F-1: ISO-3 is named (`change/ISO-3`, `dd9a1f3`). ISO-3 merges first, and the
  `ci.yml` edit is committed only after that, with checks that can be verified
  (section 4). GAP-05 waits if ISO-3 has not merged. Resolved.
- F-2: the decision is renumbered O-21 everywhere. I found no other use of O-21
  on any local branch, and the owner's words are unchanged. Resolved.
- F-3: the D-NNN entry cites the rule by its location in
  `ENGINEERING_STANDARDS.md` section 3, since there is no G-n id. Acceptable.
- F-4: the selector is `section#apply.careers-apply.careers-apply--form`, and
  test 2 checks that it matches the old section. Resolved.
- F-5: the `npm test` failure on 2026-12-15 is listed as a risk, with its owner.
  Resolved.
- F-6: test 3 compares the inline `<style>` text. Resolved.

Everything recorded as sound in Round 1 is still sound.

## Round 3

I re-reviewed the revised `plan.md` after the developer's finding A-1
(`implementation.md` at `7cd890e`).

### Correction to my Round 1 finding F-4

F-4 was wrong, and I approved the bad selector in Round 2.
`git show feature/interviewer-portal:careers/apply.html` shows that the compared
`#section` is the outer `<section class="section careers-detail hub-section--tight">`
(line 221). `section.careers-apply.careers-apply--form#apply` is nested inside
it (line 231). The old selector `section.section.careers-detail` was right.
Because of my F-4, the plan named the inner section as the selector, so the
acceptance could never match. That is the defect A-1 reports.

### Findings

None at Blocker or Major.

**F-8 (Minor). Section 5, test 2. The old-page checks are skipped in CI.**
In the shallow `website` checkout, test 2 skips its old-page assertions. That
is acceptable, because the `section-compare` job checks out
`feature/interviewer-portal` and blocks. The developer should state in
`implementation.md` whether the skip was taken in the local run.

### Checked and found sound

- A-1: the entry keeps `selector: "section.section.careers-detail"` with
  `copy.matches` on the outer section. The handler finds the inner
  `section#apply.careers-apply.careers-apply--form` with `querySelector`,
  replaces only that element, and requires an exact `same(copy, now)`. This is
  the pattern `apply-by-email` used (`compare.html:193-215`), and it accepts
  nothing more than the owner did.
- Test 2: it asserts that the outer selector matches a direct child of `main`
  and that exactly one inner form section is inside it. It still fails today
  because there is no `apply-form` entry.
- C-3: test 2 reads the old page only with `git show`, with no fixture copy.
  This also settles my Round 2 F-7.
- C-6: the gate is shown to fire locally, with nothing pushed.
  `SECTION_COMPARE_NEW`, `SECTION_COMPARE_OLD` and `SECTION_COMPARE_PORT` exist
  in `run.mjs:37-42`. Port 4291 is in the agents' 42xx range. If the tool
  cannot run locally, the plan records the proof as NOT RUN with the reason,
  and gate 2 must state it is outstanding.
- My Round 1 and 2 findings (ISO-3 sequencing, O-21, the cited rule, the expiry
  risk, the style check) are unchanged and still resolved.

Verdict: APPROVED
