# ADM-12 plan review

## Round 1

Reviewed `docs/changes/ADM-12/plan.md` (round 1) against base `8b5d6a5`.

### Findings

1. **Minor. Section 5, test 2 (blog body source).** The test says "a blog body image node without alt". `RichText.cs:612-617` refuses a body image with no alt unless it is decorative, so the API will not save that body. The current rule therefore makes body uses unable to rely on the asset alt. The test can only exist if it seeds the row directly, the way `Delete_lists_every_place...` does. To satisfy: say the body (and any section that the save validation would refuse) is seeded directly through the db context. Also add a line to Risks saying the body walk is defence in depth.
2. **Minor. Section 5, commands.** "`npm run lint` if present on the base" is not an exact command, and `studio/package.json` has no `lint` script. To satisfy: drop it, or name the real script.
3. **Minor. Section 2, "Files read".** The plan says it did not read `AGENTS.md`, `ENGINEERING_STANDARDS.md` or `docs/PROJECT_PROFILE.md` in full. Nothing I found conflicts with them, but the architect should confirm they were read.
4. **Minor. Section 10, Risks.** The check and the save are not in one transaction. A use added between the check and the save could slip through. The publish check still catches that use at its own publish, so this is acceptable, but it should be listed as an accepted risk.

### Checked and sound

- Fit: the quoted "Done when" text matches audit lines 202-208 word for word. The G3-1 batch criterion and the README G3 checklist are both present. The "go live without publishing" half is moved to O-1 and possible ADM-12b, not dropped, and is shown as Moved in the coverage table.
- Current state: `MediaLibrary.cs:114-132` `UpdateAsync` and `AltError` (lines 180-187) behave as described. `MediaOutcome.InUse` is at line 300. The controller copies `Usages` into the problem (`MediaController.cs:82`). The place strings ("... image", "... share image", "... default share image", "... body", "... section ...", "... working copy") match `MediaUsage.cs`. No other code writes `Alt` or `Decorative`: `MetadataError` has no caller outside `MediaLibrary.cs`.
- Design: the rule mirrors `PublishChecks` (lines 91, 94-101, 185-200), which is one of the audit's two named fixes. The rejected alternatives are real.
- Layering: the logic stays in `Content/` services, and the controller is unchanged.
- Scope: one topic. The files exist (the Studio test file is new on purpose). No users or error-pages files are touched, and nothing overlaps ADM-04 or ADM-05.
- Testability: the tests that should fail first (1, 2, 6) would fail today, because the route returns 200 and `save()` shows only the title. The over-blocking guards (3, 4) and the no-audit check (5) are present. The commands are Release, and the tests run against `DigitalHubContent_Test`. CI stands in for the broken local harness, as the brief says.
- Gates: none weakened, and no new gate.
- Security: the route and its policy are unchanged. `usages` exposes nothing new (the same roles already see it from GET and delete). No secrets, no new packages, no migration.
- Owner decisions: O-1 is listed and does not block this change.
- Rollback: reverting the pull request is enough, because there is no schema or data change.

Verdict: APPROVED
