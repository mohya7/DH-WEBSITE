# GAP-05 implementation record

Developer, 2026-11-19. Branch `change/GAP-05`, plan commit `dfb924e`.
`plan-approval.md` ends `Verdict: APPROVED` (checked).

No code, test or workflow file was changed. I stopped before the red tests
because the plan's design for the `apply-form` entry cannot be followed as
written.

## Finding A-1: the `apply-form` selector is checked against the wrong element

The plan (section 3, Part A, and test 2) says the entry's `selector` is
`section#apply.careers-apply.careers-apply--form`, that the handler "like
`apply-by-email` at `compare.html:196`, checks `copy.matches(rule.selector)`
against the old section", and that "the stale entry's
`section.section.careers-detail` matched neither side, so it never applied".

What the code and the old page show:

- The compared element is a direct child of `main` (`sectionsOf`,
  `compare.html`: `main.children` filtered to `SECTION`). On
  `/careers/apply.html` the second such section is the outer
  `<section class="section careers-detail hub-section--tight">`
  (`git show feature/interviewer-portal:careers/apply.html`, line 221). Its row
  id is `section` (first class name), which is why the register and CI report
  name it `/careers/apply.html #section`.
- `section#apply.careers-apply.careers-apply--form` is nested inside it, under
  `div.careers-detail__inner` (old line 231). The CI difference shows it at
  depth 2 (`2<section class=careers-apply careers-apply--form|...`).
- So `copy.matches('section#apply.careers-apply.careers-apply--form')` on the
  compared copy is always false: the handler as designed would never accept,
  and the section comparison would still report 1 failure.
- The stale selector `section.section.careers-detail` does match the outer
  section on both sides (the new `HowToApply.tsx:8` renders the same classes).
  The plan's statement that it "matched neither side" is wrong; the old entry
  stopped applying only because #33 replaced the "How to apply" block with the
  form.

The fix is a design choice I may not make: for example keep
`selector: "section.section.careers-detail"` checked with `copy.matches` and
locate the inner form section with `copy.querySelector('section#apply.careers-apply.careers-apply--form')`
(the existing `apply-by-email` pattern), and restate test 2 as "the selector
matches the compared old section and that section contains exactly one
`section#apply.careers-apply.careers-apply--form`". The architect should revise
section 3, the Scope row for `accepted-differences.json`, test 2 and the
F-4 note in the revision log.

## Other observations for the revision (not findings against the plan)

- C-2: ISO-3 has not merged. `git fetch origin`; `git log --oneline -2
  origin/rebuild/dotnet-platform -- .github/workflows/ci.yml` shows `0a55da4`
  (ISO-2) and `8d8e01d` (GAP-09) only. The base head is `1a2fe2e` (#78). Even
  after the revision the `ci.yml` edit waits on ISO-3.
- C-3: `feature/interviewer-portal` is present locally, so test 2 can use
  `git show feature/interviewer-portal:careers/apply.html`.
- C-6: pushing a throwaway commit needs the owner's confirmation. Proposed
  instead: prove it locally (run the handler on the old section with one word of
  the apply form changed and show it is not accepted) or record it as pending
  on the pull request.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Careers apply section accepted, "(a) Accept current form" (O-11) | Plan line 155; risk 262 | Not started | Blocked by A-1 |
| `continue-on-error` gone from the section comparison | Plan line 155 | Not started | Waits on A-1 and on ISO-3 (C-2) |
| Section comparison reports 0 failures | Register line 69; plan line 155 | Not started | Blocked by A-1 |
| Screenshot step has a D-NNN entry expiring 2026-12-14 (O-21) | Register line 69; plan line 155 | Not started | Held so the change lands as one revised plan |
| Report-mode rule stated and applied | Standard section 3 | Not started | |
| Failing tests 1-4 committed first and shown failing | B-6; C-1 | Not started | Test 2 depends on A-1 |
| Gate shown to fire | C-6 | Not started | |
| No overlap with PR #78; `ci.yml` only after ISO-3 merged | C-2, C-5 | Not started | ISO-3 unmerged (see above) |

Status: BACK TO ARCHITECT
