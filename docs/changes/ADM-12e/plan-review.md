# ADM-12e plan review

## Round 1

Plan-reviewer, step 2. 2026-11-19. Reviewed `docs/changes/ADM-12e/plan.md` (Round 1, with
the owner update for O-1) on `change/ADM-12e` at `0488d89`. This is the first review of
this change; there are no earlier rounds.

Read: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`docs/quality/admin-audit-2026-10-28.md` (ADM-12), `docs/changes/ADM-12d/plan-approval.md`
and `delivery-approval.md`, and the code the plan cites.

### Findings

No Blocker. No Major.

**Minor 1. Section 3.2, the `docs/content-bundle.md` text does not name every use the check
reads, and the refusal list is not updated.**
- What is wrong: the new paragraph says the import is refused "while a page, card, section,
  draft or the settings row uses the image". `MediaUsage.FindPlacesWithoutOwnAltAsync`
  (`MediaUsage.cs:118-198`) also reports share images on all eight collections and blog
  bodies. The section "What the import refuses" (`docs/content-bundle.md:144-184`) gets no
  entry, so an operator who reads that list will not find this refusal (the ADM-12c
  settings refusal is not in it either).
- Evidence: `MediaUsage.cs:121-133` (share and card images), `:141-146` (blog body);
  `docs/content-bundle.md:144-184`.
- What would satisfy me: the paragraph names share images and article bodies too (or says
  "any place that uses the image without alt text of its own"), and optionally a bullet in
  "What the import refuses" points to it. Developer's discretion within the doc file
  already in scope; no new file.

**Minor 2. Section 5, the media root for F1 to F3 and G1 is not stated.**
- What is wrong: the facts say "with `--force`" but not whether `ImportAsync` is called
  with `_source` (files already present, as the ADM-12c forced case does,
  `ContentBundleTests.cs:460`) or `_target` (files new). Either works for the red facts,
  because a refused import writes no file (`ContentBundle.cs:244-250`), but G1 succeeds,
  so with `_target` it writes the two media files. That is harmless (`Dispose` deletes the
  folder), but the fact should say which root it uses so the tester reproduces it exactly.
- What would satisfy me: the developer states the root per fact in `implementation.md`;
  for the forced facts, `_source` matches the ADM-12c precedent.

**Minor 3. Section 5, F2 and F3 do not isolate their use kind.**
- What is wrong: `SeedAsync` already makes the case study card and its working copy rely on
  `MediaId` (`ContentBundleTests.cs:853`, `:858-860`), so F2 and F3 would go red today and
  green after the fix even if the check read only cards. Their distinguishing power rests
  entirely on the `Contains` of the settings and section place strings, which the plan does
  assert, so this is acceptable. Noted so the developer does not weaken those `Contains`
  assertions to a bare `Assert.False(result.Ok)`.
- What would satisfy me: keep the place-string assertions in F2 and F3 exactly as planned.

### Checked and found sound

- **Fit.** Closes follow-up ADM-12e as recorded at `ADM-12d/plan-approval.md:122-131` and
  `delivery-approval.md:228-231`; the quoted text matches word for word. The ADM-12 "Fix"
  quote matches `admin-audit-2026-10-28.md:206-207` (elision marked), and the G3-1 exit gate
  quote matches `refinement-plan-2026-10-28.md:225`. The scope ("every target use, when the
  import blanks an alt the target had") answers "Decide the scope", and the follow-up's
  three named kinds (settings with an empty table, pages, cards) each have a fact.
- **Current state, verified at `0488d89`.** The media loop is a warning only
  (`ContentBundle.cs:431-439`); `MetadataError` only flags non-decorative blank alt
  (`MediaLibrary.cs:185-195`); no caller of `FindPlacesWithoutOwnAltAsync` in `api/tools`
  (grep: only `MediaLibrary.cs:129` and its definition); ADM-12c loops over the bundle's
  `settings` rows only (`:454-468`); `PublishChecks.AddAsync`'s only caller is
  `ContentStore.cs:316`; `MediaAsset` has no `UpdatedAt`/`SavedAt`, so `Older` returns
  "differs on the target, and has no edit time" (`:1147`) and the import refuses without
  `--force` (`:227-228`); the table import never deletes target rows absent from the bundle
  (no `Remove`/`ExecuteDelete` in the table code); `AdminStore.cs:233` and `:273` hold the
  quoted text. The step-by-step gap in section 2 follows from this code.
- **Architecture.** The rule is reused from the one function that holds it
  (`MediaUsage.FindPlacesWithoutOwnAltAsync`), not copied; the importer already references
  `DigitalHub.Api.Content` (`ContentBundle.cs:9`). No route, Studio, website or schema
  change, so A-11, A-12, S-1 and ADR 0001 are not engaged. Reading the target's alt before
  the table loop and the places after every save is the correct order (`CheckAsync` runs at
  `:232`, after `SaveChangesAsync` at `:224`). The rejected alternatives (settings only,
  every blank-alt asset, decorative only, leave it, note only, run `PublishChecks`) are real
  and correctly reasoned. Media ids are shape-checked before the import loop
  (`ContentBundle.cs:1040-1042`), so the new pre-loop read cannot crash on a malformed id;
  the `ids.Contains` query follows the existing `ReadBackAsync` pattern (`:1174-1183`).
- **Scope (B-8).** One topic. Three files plus records, all existing. No users or
  error-pages file. Three-dot diffs of every `origin/change/*` and `origin/diag/*` branch
  over these files show only `change/ADM-02` and `change/ADM-12c`, both already merged;
  open PRs #78 and #60 touch other files.
- **Testability.** F1 (theory, both decorative values), F2, F3 fail today on
  `Assert.False(result.Ok)`: with `--force` today the result is `Ok` (confirmed by the
  existing `A_default_share_image_with_an_override_imports`, and by the code path). G1 and
  G2 pass today and after the fix. The place strings the facts assert match the function's
  formats (`"case-studies {id:D} image"`, `"site-settings 80000000-0000-0000-0000-000000000001
  default share image"`, `"pages {id:D} section {id:D}"`), and the case-study working copy
  carries `fields.imageId` (`ContentDocuments.cs:110`), so it is a place too. The note text
  G1 and G2 assert matches `MediaLibrary.cs:188` and `ContentBundle.cs:439`.
  `CaseStudy.ImageAltOverride` exists for G1. Red tests committed first (P-4, S-3, B-6).
  Mutants M1 to M6 each have a fact that kills them (checked against the code: M1 by G2,
  M3 by F1 `(false)`, M5 because the read after the save sees the blank alt, M6 by G1).
  Expected count 601 = 595 (`ADM-12d/test-report.md:103`) + 6. Commands are exact and in
  Release; the e2e harness is NOT RUN with the CI job named.
- **Quality gates (P-6).** No gate, guard, baseline or test is weakened; no helper changed;
  the ADM-12c facts assert with `Contains`/`StartsWith` (`ContentBundleTests.cs:463`,
  `:472`), so a second problem does not break them. No new gate.
- **Security.** No route, policy, login, secret, dependency or migration. The change only
  adds a refusal inside the existing transaction; the output carries ids and the original
  file name, as the existing note does. Databases named correctly
  (`DigitalHubContent_Test`; never `DigitalHubContent`).
- **Owner decision.** O-1 is a real behaviour change (`docs/content-bundle.md:186-187`
  promises notes, not refusals), correctly put to the owner under P-7. The answer "A:
  refuse both" is quoted with the date (19 November 2026) and where it was given, and it
  matches the coordinator's brief for this run. The design, F1 `(false)` and M3 implement A.
  No other owner decision is needed.
- **Rollback and risks.** Revert-only rollback is true: no schema or data change, and a
  refusal writes nothing. Each risk in section 10 names the fact or mutant that catches it.
- **G3 checklist.** The e2e line is correctly not applicable: ADM-12 is a Blocker (the
  per-item e2e rule is for G3-2 Majors) and the importer has no Studio screen.

Verdict: APPROVED
