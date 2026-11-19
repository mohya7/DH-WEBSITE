# Plan review: GAP-NEXT-UPGRADE

## Round 1

### Findings

1. **Major — Section 5, step 10 (parity against the base commit) cannot run as written.**
   `tools/section-compare/run.mjs:37-41` takes the "old" root from `SECTION_COMPARE_OLD` and throws unless `git -C <oldRoot> branch --show-current` is `feature/interviewer-portal`. A detached checkout of `cdef7c9` has no current branch, so `npm run compare:sections` "against that base build" fails with "Comparison source must stay on feature/interviewer-portal." The plan also gives no environment for `compare:screenshots`. That script reads `SCREENSHOT_OLD_ROOT`, `SCREENSHOT_NEW_ROOT` and `SCREENSHOT_OUT` (`tools/screenshot-parity/compare.mjs:171-173`). "Expect zero new differences" has no defined comparison artefact either.
   What would satisfy me: an exact, runnable method for the base comparison. For example, serve the base `out/` and the new `out/` and pass the URL form (`run.mjs` accepts `argv[2]` as a URL), or diff the two `out/` trees file by file. Name the env vars and output folders, and say what counts as "no new differences" (an identical section report, or an identical `out/` apart from named hashed asset names).

2. **Major — Section 5, steps 9 to 11: ports are not set.** `run.mjs` defaults to port 4190 (`SECTION_COMPARE_PORT ?? 4190`), and the screenshot and browser tools read their ports from the environment. CLAUDE.md requires agents to use ports 42xx. The plan must state the 42xx ports (`SECTION_COMPARE_PORT` and the screenshot and Playwright port variables) for every server-starting step.

3. **Minor — Section 9, O-1.** Settled by the orchestrator: the original brief allowed 16.4.5 or 16.4.6, so the 16.4.6 default is within the request. It should be marked resolved in the next revision, with the brief quoted, so it is not shown as open.

4. **Minor — Section 5, step 2 and section 10.** The lockfile-drift check is "review `git diff`". Add a concrete check, for example listing the changed package paths in the lockfile and requiring that they are only `node_modules/next`, `node_modules/@next/env` and `node_modules/@next/swc-*`. 16.4.6 may also change transitive deps of `next` (such as `@swc/helpers`, `postcss` or `styled-jsx`). If it does, the plan should say they are accepted as forced.

### Checked and found sound

- The register: GAP-01's "Done when" covers only Critical/High (line 65). A new id is justified, and the line 142 quote is accurate.
- `website/package.json:29` is `"next": "16.4.3"`, an exact pin. The base is `cdef7c9`.
- Every script named exists in `website/package.json`: typecheck, test, design:check, build (includes check-output), check:csp, test:browser, compare:sections, compare:screenshots.
- Scope is one topic (B-8). The GAP-11 files are excluded, and fast-uri, Studio, workflows and known-findings are excluded.
- Rejected alternatives are real (`audit fix --force`, a caret range, `next upgrade --agent`).
- No gate, baseline or allow-list is weakened (P-6). No new gate. No routes, secrets, migrations or databases.
- The red/green check (npm audit on the base, then after) is appropriate for a dependency bump.
- API/e2e are recorded as CI-only, not as passed locally, per the owner.
- Rollback (revert the PR) is adequate for a lockfile-only change.

Round 1 verdict, superseded by round 2: CHANGES NEEDED

## Round 2

### Findings

None at Blocker or Major.

- **Minor (no action required) — Section 5, step 10(a).** The allowed differences in the `diff -r` check ("build id, hashed chunk names, CSP hash lists, version string") are judged by hand in `implementation.md`. That is acceptable for a patch bump. The tester should quote the `diff -rq` summary verbatim so the judgement can be checked.

### Round 1 findings, rechecked

1. Base parity is resolved. It now uses a detached base worktree, a file-by-file `out/` diff with named allowed differences, and `compare:screenshots` with `SCREENSHOT_OLD_ROOT`, `SCREENSHOT_NEW_ROOT` and `SCREENSHOT_OUT`, passing on exit 0. The section tool is now used only against feature/interviewer-portal, which is the setup its branch guard (`run.mjs:41`) expects. Its pass condition (the change's result.json equals the base's) is exact.
2. Ports are resolved. They are all in the 42xx range: 4210, 4220 to 4225 and 4230. I checked that the variable names exist: `WEBSITE_TEST_PORT` (`playwright.config.ts:2`), `SCREENSHOT_PORT` and `SCREENSHOT_CANDIDATE_PORT` (`compare.mjs:48-50`), and `SECTION_COMPARE_PORT` (`run.mjs`).
3. O-1 is resolved and recorded with the brief's wording.
4. Lockfile drift is resolved. There is a concrete path-list check plus a version-line check, and any forced move must be a `next` dependency recorded in `implementation.md`.

### Still sound

Everything listed in round 1 still holds. The scope is unchanged, and the GAP-11 files and the read-only reference are not written.

Verdict: APPROVED
