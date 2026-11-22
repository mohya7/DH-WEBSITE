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

Status (round 1): BACK TO ARCHITECT

---

# Round 2: implementation of the revised plan

Plan revised at `2c25dd8` (plan-review Round 3 APPROVED, plan-approval Round 2
APPROVED, conditions C-1 to C-8). Finding A-1 is answered by the revised design:
the entry keeps `selector: "section.section.careers-detail"`, matched with
`copy.matches` on the outer compared section, and the handler replaces only the
single nested `section#apply.careers-apply.careers-apply--form`.

## Commits

| SHA | What |
| --- | --- |
| `3cd972e` | Red: `website/test/parity-gates.test.ts` (C-1) |
| `dc8cc13` | Fix: `compare.html`, `accepted-differences.json`, `docs/deferred-items.md`; the test switched to the jsdom environment (see "Failures reported") |
| this commit | This record |

`ci.yml` is **not** changed: ISO-3 has not merged (C-2, below).

## What changed, by Scope row

- `website/test/parity-gates.test.ts` (new). Tests 1 to 4 of plan section 5.
  Test 2 is split into two `it` blocks so that only its old-page part can be
  skipped. "every section acceptance entry has a handler" checks the kinds,
  the entry, a reason that quotes O-11, and that no `apply-by-email` is left;
  it always runs. "the apply-form selector matches the old compared section"
  (C-3) reads the old page only with
  `git show feature/interviewer-portal:careers/apply.html`, with no fixture,
  and is skipped only when that ref is absent. It asserts that exactly one
  direct child of `main` matches the selector and that it holds exactly one
  inner form section. Test 3 renders `ApplyForm` and checks the entry's
  `action`, `heading` and `fields`. It also checks that the style in the
  handler's template equals the rendered style after whitespace
  normalisation. Test 4 requires a cited, unexpired D-NNN when "Compare
  screenshots" has `continue-on-error`.
- `website/tools/section-compare/accepted-differences.json`: `apply-by-email`
  removed. `apply-form` added with page `/careers/apply.html`, section
  `section`, `selector: "section.section.careers-detail"`, `action`,
  `heading`, `fields`, and a reason that quotes O-11 verbatim: "(a) Accept
  current form" (C-7).
- `website/tools/section-compare/compare.html`: the `apply-by-email` branch is
  removed. A new `<template id="apply-form-markup">` holds the inner section
  exactly as `ApplyForm` renders it without a vacancy (generated with
  `renderToStaticMarkup`, email left blank). The `apply-form` branch works in
  three steps:
  1. It checks `copy.matches(rule.selector)`.
  2. It requires exactly one inner form section, and requires the template's
     action, `h2` and field names to equal the entry's; otherwise it skips.
     It fills the `mailto:` fallback from `settings.careersEmail ||
     settings.email`, or removes it when there is none, as `ApplyForm` does.
     Then it replaces the inner section.
  3. It requires an exact `same(copy, now)`.
- `docs/deferred-items.md`: D-001. The rule waived is cited by location. Owner
  decision "Exception, expires 14 Dec", quoted verbatim (C-7). Follow-up owner
  "The /change pipeline". Expires 2026-12-14. Follow-up pull request: not
  opened.
- `.github/workflows/ci.yml`: NOT CHANGED (C-2).

## Commands

All in `website/` unless stated. `npm ci` was run first (lockfile untouched).

- Red, before the fix: `npx vitest run test/parity-gates.test.ts`, exit 1,
  `Tests 5 failed (5)`:
  - "the section comparison step blocks": expected true to be false.
  - "every section acceptance entry has a handler": apply-form entry:
    expected undefined to be defined.
  - "the apply-form selector matches the old compared section": the same.
  - "the apply-form acceptance names the form the site renders": the same.
  - "the screenshot comparison is blocking or excepted": cites a D-NNN:
    expected [] to not have a length of +0.

  The old-page test **ran** (C-8). It failed on the missing entry; it was not
  skipped.
- After the fix: `npx vitest run test/parity-gates.test.ts`, exit 1,
  `Tests 2 failed | 3 passed (5)`. Passing: test 2 (both parts; the old-page
  part **ran**, C-8) and test 3. Failing as expected until the `ci.yml` edit:
  test 1 (line 338) and test 4 (no D-NNN cited in the job comment yet).
- `npm run typecheck`: exit 0 (after the fix below).
- `CONTENT_SOURCE=snapshot PUBLIC_SITE_URL=https://digitalhub.com.eg npm run build`:
  exit 0, "Build output checks passed."
- `npx vitest run` (whole website suite): `Test Files 2 failed | 23 passed (25)`,
  `Tests 3 failed | 475 passed | 1 skipped (479)`. Tests 1 and 4 fail as
  expected (ci.yml). The third failure is `no-hiring-system.test.ts` "keeps a
  candidate store ...": "website/artifacts/section-comparison.json contains
  /api/careers". That file is the ignored output that `run.mjs:85` always
  writes. My local comparison run below left it there. I deleted it
  (`rm -rf artifacts`) and re-ran
  `npx vitest run test/no-hiring-system.test.ts`: `Tests 2 passed (2)`. The
  one skipped test is not in `parity-gates.test.ts`.
- Section comparison against the clean build (from the repo root). I exported
  the old site with `git archive feature/interviewer-portal` into the
  scratchpad and ran `git init -b feature/interviewer-portal` there, so that
  `run.mjs:40` accepts it. Nothing was committed there, and the real branch is
  untouched. Then `SECTION_COMPARE_OLD=<scratch>/old-site
  SECTION_COMPARE_NEW=$PWD/out SECTION_COMPARE_PORT=4291
  SECTION_COMPARE_OUT=<scratch>/sc-clean npm run compare:sections` gave
  **exit 0**, `104/119 sections match; 15 accepted; 0 failures (including chrome).`,
  `accepted: /careers/apply.html #section (apply-form)`.
- C-6, proof that the gate fires, run locally with nothing committed or
  pushed. I copied `out` to `<scratch>/out-broken` and changed one word in the
  apply form of `careers/apply.html` ("Send application" to "Submit
  application"). The same command with `SECTION_COMPARE_NEW=<scratch>/out-broken`
  and `SECTION_COMPARE_PORT=4291` gave **exit 1**, `104/119 sections match; 14
  accepted; 1 failures (including chrome).`, `differs: /careers/apply.html #section`.
  The step in CI still has `continue-on-error` today. The CI proof that the
  step blocks follows the `ci.yml` edit.
- `actionlint`: NOT RUN, because `ci.yml` is unchanged in this round. The CI
  job "Workflow lint" covers it once the `ci.yml` edit is made.
- CI on the pull request: NOT RUN, because nothing is pushed; the push waits
  for the owner.

## Failures reported

- `npm run typecheck` after the red commit: exit 1, `test/parity-gates.test.ts(12,23):
  error TS7016: Could not find a declaration file for module 'jsdom'`. Fixed in
  `dc8cc13` by using `// @vitest-environment jsdom` and `DOMParser`, as
  `screenshot-parity-guard.test.ts` does. No type package was added, and the
  assertions are unchanged.
- The `no-hiring-system` failure above, caused by a local artifact, not by a
  code defect.

## C-4, D-NNN id

After `git fetch origin`, I ran
`git grep -hoE '\bD-[0-9]{3}\b' <ref> -- docs ENGINEERING_STANDARDS.md` over
every `refs/heads` and `refs/remotes` ref. It returned:
- D-001, only as this plan's "expected D-001";
- D-012, D-100, D-101, D-900 to D-904 and D-999, all examples and canary
  fixtures in GAP-07's records.

`git grep -hE '^## D-[0-9]{3}' <ref> -- docs/deferred-items.md` over the same
refs returned nothing, so no branch holds a real entry. D-001 is free, and I
took it.

## C-2, ISO-3

After `git fetch origin`, `git log --oneline -2 origin/rebuild/dotnet-platform --
.github/workflows/ci.yml` shows `0a55da4` (ISO-2) and `8d8e01d` (GAP-09), and
`git branch -r` has no `origin/change/ISO-3`. ISO-3 has not merged. So I have
not made the `ci.yml` edit (line 338, and the comments at 304-308 and 369-371
citing D-001 and its expiry), and I have not yet run the three checks of plan
section 4.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Careers apply section accepted, "(a) Accept current form" (O-11) | Plan line 155; risk 262 | Done | `dc8cc13`; local compare: `accepted: /careers/apply.html #section (apply-form)` |
| `continue-on-error` gone from the section comparison | Plan line 155 | Blocked | Waits on ISO-3 (C-2); test 1 red until then |
| Section comparison reports 0 failures | Register line 69; plan line 155 | Done locally | Local run on port 4291: `0 failures`, exit 0; CI after the push |
| Screenshot step has a D-NNN entry expiring 2026-12-14 (O-21) | Register line 69; plan line 155 | Partly done | D-001 in `dc8cc13`; the `ci.yml` comment citing it waits on ISO-3; test 4 red until then |
| Report-mode rule stated and applied | Standard section 3 | Partly done | No `*_BLOCKING_FROM` added; applied with the `ci.yml` edit |
| Failing tests 1-4 committed first and shown failing | B-6; C-1 | Done | `3cd972e`, `Tests 5 failed (5)` |
| Test 2 old-page assertions ran (C-8) | C-8 | Done | Ran in both quoted runs (red and green) |
| Gate shown to fire | C-6 | Done locally | Broken copy: exit 1, `differs: /careers/apply.html #section` |
| No overlap with PR #78; `ci.yml` only after ISO-3 merged | C-2, C-5 | Holding | `ci.yml` untouched; ISO-3 unmerged |

Status (round 2): BLOCKED (waiting on ISO-3)

---

# Round 3: the `ci.yml` edit after ISO-3 merged

ISO-3 merged as `266b124` (#79). I ran `git fetch origin` and
`git merge --no-edit origin/rebuild/dotnet-platform`, a merge and not a rebase.
The result is merge commit `afac55f`, with no conflicts. Then I made the
`ci.yml` edit in `74fd862`.

## The three checks of plan section 4 (C-2)

1. `git log --oneline origin/rebuild/dotnet-platform -- .github/workflows/ci.yml`
   shows `266b124 ISO-3: Give the public forms API its own dh_public_forms login,
   limited to four tables (#79)`, then `0a55da4` (ISO-2) and `8d8e01d` (GAP-09).
2. `git diff origin/rebuild/dotnet-platform change/ISO-3 -- .github/workflows/ci.yml`
   prints nothing. All of ISO-3's `ci.yml` change is on the base.
3. I listed the branches with `git branch -a --format='%(refname:short)'` and
   ran `git diff --stat origin/rebuild/dotnet-platform...<branch> --
   .github/workflows/ci.yml` for each `change/*` branch that is not an ancestor
   of the base. These branches show a `ci.yml` stat: `change/GAP-09`,
   `change/ISO-2`, `change/ISO-3`, `origin/change/ADM-02`,
   `origin/change/GAP-04`, `origin/change/GAP-06`, `origin/change/GAP-09`,
   `origin/change/ISO-2`, `origin/change/ISO-3` and `origin/change/ci-runner-pin`.
   Each one is already squash-merged into the base: #68, #76, #79, #54, #43,
   #42 and #38, all seen in `git log --oneline origin/rebuild/dotnet-platform`.
   A squash merge leaves the branch tip outside the base's history, so the
   three-dot stat shows that work again. No unmerged branch changes `ci.yml`.

## The `ci.yml` edit (C-5), commit `74fd862`

After ISO-3, the line numbers moved by 16. The diff is 6 lines added and 8
removed, and it touches only these places:
- the `section-compare` job comment (lines 320-324). It now says that the step
  blocks, and that a difference must be fixed or added to
  `accepted-differences.json` with the owner's decision quoted.
- `continue-on-error: true` on "Compare sections" (line 354). Removed.
- the `screenshot-parity` comment (line 386). It now cites D-001 in
  `docs/deferred-items.md` (GAP-05, O-21), says that it expires 2026-12-14,
  and says that the step must then block or be renewed.

`continue-on-error` on "Compare screenshots" stays. No `uses:`, `image:` or
version line changed. No `*_BLOCKING_FROM` was added, as the plan's report-mode
reasoning requires.

## Commands

Run in `website/`, after `rm -rf artifacts`.

- **Parity-gates tests:** `npx vitest run test/parity-gates.test.ts` gave
  exit 0, `Tests 5 passed (5)`. The old-page part of test 2 **ran** (C-8),
  because `feature/interviewer-portal` is present.
- **Typecheck:** `npm run typecheck` gave exit 0.
- **Full suite:** `npx vitest run` gave exit 1:
  `Test Files 4 failed | 21 passed (25)`,
  `Tests 26 failed | 458 passed | 1 skipped (485)`. The failures:
  - `screenshot-parity-browser.test.ts`: Chromium register-guard cases.
  - `design.test.ts` "match origin/feature/interviewer-portal ...": timed out
    in 5000ms.
  - `sources.test.ts` "reads the build endpoint once ...": timed out.
  - `no-hiring-system.test.ts`: timed out.
- **Re-run of those four files:** `npx vitest run test/no-hiring-system.test.ts
  test/sources.test.ts test/design.test.ts test/screenshot-parity-browser.test.ts`
  gave `Test Files 1 failed | 3 passed (4)`,
  `Tests 27 failed | 40 passed | 1 skipped (68)`.
  - Three files now pass: `design`, `sources` and `no-hiring-system`. Their
    failures in the full run were timeouts under load.
  - Every failure left is in `screenshot-parity-browser.test.ts`, with
    `Error: listen EADDRINUSE: address already in use 127.0.0.1:4284`. That
    test's baseline port is hard-coded at line 189. `netstat -ano` shows
    `127.0.0.1:4284 LISTENING` owned by PID 11968 (`node.exe`), which I did not
    start. I did not stop it, because CLAUDE.md says "Never stop a process you
    did not start".
  - GAP-05 does not change that test or anything it reads. This is NOT RUN
    locally because of the port conflict. The CI step "Chromium regression
    tests" in the `screenshot-parity` job covers it, and so does the `website`
    job. The tester should re-run it once port 4284 is free.
- **actionlint:** NOT RUN, because it is not installed on this machine. The CI
  job "Workflow lint" (GAP-08) covers it.
- **Section comparison:** run in Round 2 against the same website sources
  (`0 failures`, exit 0, port 4291). The merge changed no file it reads, so I
  did not run it again.
- **C-6, the gate fires:** proven locally in Round 2 (exit 1,
  `differs: /careers/apply.html #section`). The proof in CI, on the pull
  request, is still to come: it needs the owner to confirm the push.
- **CI on the pull request:** NOT RUN, because nothing is pushed.

## Coverage table (final)

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Careers apply section accepted, "(a) Accept current form" (O-11) | Plan line 155; risk 262 | Done | `dc8cc13`; local compare `accepted: /careers/apply.html #section (apply-form)` |
| `continue-on-error` gone from the section comparison | Plan line 155 | Done | `74fd862`; test 1 passes |
| Section comparison reports 0 failures | Register line 69; plan line 155 | Done locally | Round 2 local run on port 4291: `0 failures`, exit 0. CI is pending the push |
| Screenshot step has a D-NNN entry expiring 2026-12-14 (O-21) | Register line 69; plan line 155 | Done | D-001 (`dc8cc13`), cited in the `ci.yml` comment (`74fd862`); test 4 passes |
| Report-mode rule stated and applied | Standard section 3 | Done | No `*_BLOCKING_FROM`; the step blocks at once |
| Failing tests 1-4 committed first and shown failing | B-6; C-1 | Done | `3cd972e`, `Tests 5 failed (5)` |
| Test 2 old-page assertions ran (C-8) | C-8 | Done | Ran in the red, Round 2 and Round 3 runs |
| Gate shown to fire | C-6 | Done locally | Round 2 broken copy: exit 1. CI is pending the push |
| `ci.yml` edited only after ISO-3 merged, with no other line changed; no overlap with #78 | C-2, C-5 | Done | Merge `afac55f`, three checks above, 6+/8- diff in `74fd862` |

Status: READY FOR TEST
