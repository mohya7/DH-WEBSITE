# ADM-12 plan approval (gate 1)

## Round 1

Approved plan: `docs/changes/ADM-12/plan.md` round 1. Plan review: `plan-review.md` round 1, `Verdict: APPROVED`, four Minors. Base `8b5d6a5`.

### Decision

Approved, with the conditions below.

### Reasons

- **Right change.** The plan quotes the owner's request exactly ("ADM-12 make alt text impossible to bypass in the media library") and the audit's "Done when" for lines 202-208. The fix is the audit's second named option: run the publish alt rule over every use. It reuses the `PublishChecks` alt rule without editing it. Counting draft uses and working copies is what "impossible to bypass" needs.
- **Order.** G3-1 is the Blocker batch, so it runs before any Major. It does not depend on Wave 0 or Wave 1, or on ISO-4 or ISO-5.
- **Branch conflicts.** I checked unmerged `origin/change/*` branches for the files the plan touches. Only `change/ADM-06b` touches `studio/src/pages/MediaLibraryPage.tsx`, and it is already squash-merged (#51). Its version of that file matches the base exactly. No open branch touches `MediaLibrary.cs`, `MediaUsage.cs` or `MediaLibraryTests.cs`. The plan touches no users or error-pages files, so it does not overlap ADM-04 or ADM-05.
- **Risk.** It needs no migration and changes no schema or route policy, and reverting the pull request rolls it back. The extra queries run only when an edit would blank the alt text.
- **Owner decisions.** O-1 (whether library metadata goes live on save) is quoted. It is recorded as a Moved item, not dropped, and does not block this change. Answering O-1 is up to the owner; this approval does not decide it.

### Conditions for the developer

1. **G3-1 failing test first.** Commit tests 1, 2 and 6 alone, before the fix commit. Record their failing output in `implementation.md`: the command, the exit code, and the 200 returned where 409 is expected. Run the build in Release. Run the API tests against `DigitalHubContent_Test` only. If the local harness cannot run the API tests, push the red commit on `change/ADM-12` only after the owner confirms a push. Otherwise record the red run as a CI run on that commit. Either way, `implementation.md` must name the commit SHA and the evidence. Do not claim a failure you did not see.
2. **Studio commands.** `studio/package.json` has no `typecheck` script and no `lint` script. Use `npm test` and `npm run build`; the build runs `tsc -b`, so it covers type checking. Record that substitution in `implementation.md`.
3. **Minor 1.** Seed the blog-body use, and any section use the save validation would refuse, directly through the db context, as `Delete_lists_every_place...` does. Note the body walk as defence in depth.
4. **Minor 4.** List the check-then-save race in `implementation.md` as an accepted risk. The publish check still catches that use at its own publish.
5. **Scope.** Touch only the five files in plan section 4, plus the change records. Do not touch `PublishChecks.cs`, `website/`, users files or error-pages files.
6. **Evidence for the API and e2e tests.** The local e2e harness is broken, so the CI jobs on the final head are the evidence for the API and e2e tests. Gate 2 lists them as open until they are green.

### Reviewer Minors accepted

- Minor 1: accepted, with condition 3.
- Minor 2: accepted, with condition 2. The plan's `npm run typecheck` is also not a real script.
- Minor 3: accepted. Nothing in `AGENTS.md`, `ENGINEERING_STANDARDS.md` or `docs/PROJECT_PROFILE.md` changes this design. The architect should confirm they were read in any later revision.
- Minor 4: accepted, with condition 4.

This approval moves the change to the developer. It is not the owner's confirmation and stands in for no owner decision.

Verdict: APPROVED
