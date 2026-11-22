# ADM-12e test report

## Round 1

Tester, step 5. 2026-11-22. Commit tested: **`7a14b83`** ("ADM-12e: Record the
implementation"), on `change/ADM-12e`. The code under test is `cd51f80` (fix and doc) on top
of `21f1b6c` (tests only); `7a14b83` adds only `implementation.md`.

Read: `docs/changes/README.md`, `AGENTS.md`/`CLAUDE.md`, `ENGINEERING_STANDARDS.md`, and every
file in `docs/changes/ADM-12e/` (`plan.md`, `plan-review.md`, `plan-approval.md`,
`implementation.md`). Owner decisions in force: O-1 "A: refuse both" (plan section 9, 19
November 2026) and "ADM-12e waits" for ISO-3 (`implementation.md`, Round 1 block).

Where: a detached checkout of my own,
`git -C D:\work\DigitalHub\dh-platform worktree add --detach D:\work\DigitalHub\dh-platform-claude-adm-12e-test 7a14b83`
(exit 0, "HEAD is now at 7a14b83"). At the end it was removed with `git worktree remove`
(exit 0), `git worktree prune`, and the leftover folder (ignored `studio/node_modules`) deleted;
`git worktree list` no longer lists it. Nothing was committed, pushed or edited in source,
tests, lockfiles or workflows. This file is the only file written, in the developer's worktree,
uncommitted.

Database: `DigitalHubContent_Test` only (`ApiFactory.ToTestCatalog` rewrites the catalog to
`_Test` and refuses anything else). Before every test run I checked
`tasklist /FI "IMAGENAME eq testhost.exe"`: no testhost was running each time (the only
`dotnet.exe` processes were MSBuild reuse nodes). No port was opened. `DigitalHubContent` and
DH-WEBSITE-main were not touched.

Line endings: the working copy is CRLF (`git ls-files --eol`: `i/lf w/crlf`). The mutants were
applied by a byte-level script that asserted CRLF and exactly one match per replacement.

### 1. Scope

`git diff --name-only 235779e 7a14b83`, exit 0:

```
api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs
api/tools/DigitalHub.ContentImport/ContentBundle.cs
docs/changes/ADM-12e/implementation.md
docs/content-bundle.md
```

Only plan section 4 files. Also checked:
- `git diff --name-only 266b124 235779e` lists only `docs/changes/ADM-12e/plan*.md`: the merge
  `235779e` brought in the base and nothing else.
- `git diff --name-only 90de0c0 235779e | grep -E "ContentBundle|content-bundle"`: exit 1, no
  match. The merge did not touch the scope files.
- `git diff --stat 235779e 21f1b6c`: only `ContentBundleTests.cs` (+129). `git diff --stat
  21f1b6c cd51f80`: only `ContentBundle.cs` and `docs/content-bundle.md`. Red commit before
  the fix (`git log --first-parent`: `7a14b83`, `cd51f80`, `21f1b6c`, `235779e`, `90de0c0`).
- No `MediaUsage.cs`, `MediaLibrary.cs`, `AdminStore.cs`, `PublishChecks.cs`, `ContentStore.cs`,
  users, error-pages, Studio, website, workflow, migration or lockfile change.
- Commit subjects start with `ADM-12e:`, bodies give the reason and quote O-1, each carries the
  attribution trailer.

### 2. Red first, at `21f1b6c`

`git checkout --detach 21f1b6c`, then from `api/`:

`dotnet build DigitalHub.slnx -c Release`: exit 0, `13 Warning(s)`, `0 Error(s)`.

`dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentBundleTests"`: **exit 1**.

```
Failed ...An_import_that_blanks_an_alt_a_target_card_relies_on_is_refused(decorative: False)
   Assert.False() Failure / Expected: False / Actual: True ... ContentBundleTests.cs:line 536
Failed ...An_import_that_blanks_an_alt_a_target_card_relies_on_is_refused(decorative: True)
   Assert.False() Failure / Expected: False / Actual: True ... ContentBundleTests.cs:line 536
Failed ...An_import_with_no_settings_row_that_blanks_the_default_share_image_alt_is_refused
   Assert.False() Failure / Expected: False / Actual: True ... ContentBundleTests.cs:line 564
Failed ...An_import_that_blanks_an_alt_a_target_page_section_relies_on_is_refused
   Assert.False() Failure / Expected: False / Actual: True ... ContentBundleTests.cs:line 586
Failed!  - Failed:     4, Passed:    35, Skipped:     0, Total:    39
```

Each fails on its own `Assert.False(... .Ok)` (F1 at the forced dry run, line 536, after the
unforced conflict assert passed; F2 and F3 at `Assert.False(forced.Ok)`). No failure mentions
a migration; the 35 existing facts pass, so the migration guard is not involved.

G1 and G2 on their own, same commit,
`dotnet test ... --no-build --filter "FullyQualifiedName~An_import_that_blanks_an_alt_no_target_use_relies_on_still_imports|FullyQualifiedName~A_first_import_of_an_image_without_alt_text_still_imports_with_a_note" --logger "console;verbosity=normal"`: exit 0.

```
Passed ...An_import_that_blanks_an_alt_no_target_use_relies_on_still_imports [4 s]
Passed ...A_first_import_of_an_image_without_alt_text_still_imports_with_a_note [3 s]
```

### 3. Green at the head, `7a14b83`

`dotnet build DigitalHub.slnx -c Release --no-incremental`: exit 0, `13 Warning(s)`,
`0 Error(s)`. Same count as the tests-only commit `21f1b6c` (13), and as the developer's base
measurement at `235779e` (13). No new warning.

`dotnet test ... -c Release --no-build --filter "FullyQualifiedName~ContentBundleTests|FullyQualifiedName~MediaLibraryTests"`:
exit 0, `Passed!  - Failed: 0, Passed: 58, Skipped: 0, Total: 58` (39 ContentBundleTests + 19
MediaLibraryTests, matching the developer's 39 and 19).

### 4. Mutants M1 to M6

Each one alone, on `7a14b83`: apply, `dotnet build DigitalHub.slnx -c Release`, then
`dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~ContentBundleTests"`
(all 39, so the five facts and any collateral are both visible), then
`git checkout -- api/tools/DigitalHub.ContentImport/ContentBundle.cs` and
`git diff --exit-code -- api/tools api/src`. `git status --porcelain` was empty after every
restore. No mutant was committed (HEAD stayed `7a14b83`).

| Id | Mutation (as applied) | Build | Test exit | Failed | Must fail | Restore `git diff --exit-code` | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | `if (string.IsNullOrWhiteSpace(asset.Alt) && withAlt.Contains(asset.Id))` to `if (string.IsNullOrWhiteSpace(asset.Alt))` | exit 0, 13 W, 0 E | 1 | G2 `A_first_import_of_an_image_without_alt_text_still_imports_with_a_note`; also existing `A_default_share_image_with_an_override_imports` (2 of 39) | G2 | 0 | Killed |
| M2 | The ADM-12e comment and `if` block (11 lines) deleted | exit 0, 13 W, 0 E | 1 | F1 (False), F1 (True), F2, F3 (4 of 39) | F1, F2, F3 | 0 | Killed |
| M3 | `if (asset.Decorative && string.IsNullOrWhiteSpace(asset.Alt) && withAlt.Contains(asset.Id))` | exit 0, 13 W, 0 E | 1 | F1 `(decorative: False)` only (1 of 39) | F1 `(false)` | 0 | Killed |
| M4 | `problems.Add($"media ... alt: the bundle removes ...` to `warnings.Add(...)` | exit 0, 13 W, 0 E | 1 | F1 (False), F1 (True), F2, F3 (4 of 39) | F1, F2, F3 | 0 | Killed |
| M5 | `var withAlt = await TargetAssetsWithAltAsync(...)` moved from before the table loop to after it (before the `--force` conflict check) | exit 0, 13 W, 0 E | 1 | F1 (False), F1 (True), F2, F3 (4 of 39) | F1, F2, F3 | 0 | Killed |
| M6 | `if (places.Count > 0)` line removed | exit 0, 13 W, 0 E | 1 | G1 `An_import_that_blanks_an_alt_no_target_use_relies_on_still_imports` (1 of 39) | G1 | 0 | Killed |

Every mutant built (no build failure is counted as a kill) and every one was killed by exactly
the facts the plan names. After the mutants, `dotnet build DigitalHub.slnx -c Release
--no-incremental` was run again on the clean head (exit 0, 13 W, 0 E) before the full suites.

### 5. Full suites, Release, `DigitalHubContent_Test`

Setup: `npm ci` in `website/`: exit 0 (only npm `allow-scripts` notices).

`dotnet test tests/DigitalHub.Api.Tests/DigitalHub.Api.Tests.csproj -c Release --no-build`,
run 1: **exit 1**.

```
Failed DigitalHub.Api.Tests.UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin [12 s]
  A role change failed on the server: 503 {"type":"https://tools.ietf.org/html/rfc7807","title":"Another change to the users is in progress. Try again.","status":503,"code":"users_busy"} | 200 {...}
  09:07:14.605 users lock requested (sp_getapplock)
  09:07:14.756 users lock requested (sp_getapplock)
  09:07:19.791 answered: A demotes B: 503
  09:07:21.178 answered: B demotes A: 200
Failed!  - Failed:     1, Passed:   601, Skipped:     0, Total:   602, Duration: 2 m 47 s
```

The second request waited the users lock's 5 s and got `users_busy` while the first was still
running (about 6.6 s). No users file is in this change; see Minor finding 1.

`dotnet test ... --no-build --filter "FullyQualifiedName~UserRoleConcurrencyTests"`: exit 0,
`Passed: 2, Total: 2`.

Full suite, run 2, same command: **exit 0**,
`Passed!  - Failed: 0, Passed: 602, Skipped: 0, Total: 602, Duration: 2 m 34 s`.
602 matches the developer's count (base 596 + 6; the plan's 601 was one short, explained in
`implementation.md` command 8).

`dotnet test tests/DigitalHub.PublicApi.Tests/DigitalHub.PublicApi.Tests.csproj -c Release --no-build`:
exit 0, `Passed!  - Failed: 0, Passed: 102, Skipped: 0, Total: 102`.

### 6. Test plan items not run locally

- **Studio end-to-end** (`npm run test:e2e`): NOT RUN. The local e2e harness is broken
  (coordinator's instruction). Pending on CI job `studio`, "Studio — typecheck, build,
  end-to-end". Not a failure. No Studio file changed.
- **Studio `npm test`, `npm run build`**: NOT RUN; no Studio file changed. CI job `studio`.
- **Website `npm test`, `npm run typecheck`, `npm run build`, `npm run design:check`,
  `npm run compare:sections`, browser suites**: NOT RUN; no website file changed. CI jobs
  `website`, `website-browser` and `section-compare`.
- **Workflow lint**: NOT RUN; no workflow changed. CI workflow "Workflow lint".

### 7. Security

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| npm audit, website, full tree | `npm audit --audit-level=high` in `website/` | 0 | `1 moderate severity vulnerability` (below the gate's level) |
| npm audit, studio, full tree | `npm audit --audit-level=high` in `studio/` (after `npm ci`, exit 0) | 0 | `found 0 vulnerabilities` |
| npm gate, website | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh website` | 0 | `website: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| npm gate, studio | `RUNNER_TEMP=<scratch> sh ../.github/security/run-npm-audit.sh studio` | 0 | `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| NuGet gate | `RUNNER_TEMP=<scratch> sh ../.github/security/run-dotnet-audit.sh` in `api/` | 0 | every project "has no vulnerable packages"; `dotnet: 0 finding(s) at the gate's level; 0 known, 0 new.` |
| Semgrep, full scan | `RUNNER_TEMP=<scratch> sh .github/security/run-semgrep.sh` (Semgrep 1.180.0, the CI version) | 1 | The gate stopped on a local scan error: `type Timeout; path .github/security/gate.test.mjs; rule ...express-open-redirect` (an unchanged file; Windows run). The JSON has 9 results, all in unchanged files (`ImageFiles.cs:49,54`, `Catalog.cs:31,48,57,84`, `AuditRollbackTests.cs:78`, `InfrastructureParityTests.cs:30,31`); the `ImageFiles.cs` and `Catalog.cs` ones are in `known-findings.json`. None is in a changed file. Not attributable to this change; the authoritative run is CI job "Semgrep (ERROR fails, WARNING reported)" in `security.yml`. |
| Semgrep, changed files | `semgrep scan --metrics=off --config p/csharp --config p/owasp-top-ten --config p/secrets api/tools/DigitalHub.ContentImport/ContentBundle.cs api/tests/DigitalHub.Api.Tests/ContentBundleTests.cs --json` | 0 | `results 0` (two PartialParsing notices, no Timeout) |
| gitleaks | not installed locally (`which gitleaks`: not found) | NOT RUN | CI jobs `gitleaks-pr` "Secret scan (gitleaks, this pull request's commits)" and `gitleaks-history` in `security.yml` |
| Secrets in the diff | `git diff 235779e 7a14b83 \| grep -iE "password\|secret\|apikey\|token\|connectionstring"` | 0 | only `cancellationToken` matches; no secret. No secret appeared in any output of this run |

Routes, role matrix, host checks, unknown fields, body size and error shape: not applicable.
No API route, policy, login or permission changes; the change is in the `DigitalHub.ContentImport`
command-line tool. The new code is one read-only EF query (`ids.Contains`, parameterised, the
same pattern as `ReadBackAsync`) in the existing transaction, and a call to the existing
`MediaUsage.FindPlacesWithoutOwnAltAsync`. The new problem text carries ids, collection names
and the bundle's original file name, as the existing note does; no content or credentials.
A malformed media id cannot reach the new query: `ReadAsync` shape-checks the bundle before
`ImportAsync` opens its transaction, and anything thrown inside the `try` is caught, undone
and reported in one line (`ContentBundle.cs`, "The import stopped: ...").

### 8. Beyond the plan (by reading the code at `7a14b83`; not run)

- **Whitespace-only alt.** Both sides use `string.IsNullOrWhiteSpace` in C#: a bundle alt of
  `" \t"` over a target alt is a blank and is refused; a target alt that is whitespace only
  is "no alt", so the asset keeps the note only. Consistent with `AltText.Effective`.
- **A use the bundle brings.** The places are read after every table's `SaveChangesAsync`, so
  a bundle that both blanks the asset and adds or clears a per-use override is judged on the
  state it would ship. M5 proves the read order matters.
- **Dry run without `--force`.** It is refused on the conflict, and `CheckAsync` is skipped
  because `problems` is already non-empty, so the ADM-12e problem is only shown once the
  operator repeats with `--force`. Acceptable: nothing is written either way, and F1 asserts
  the forced dry run reports it.
- **Two imports.** Import 1 blanks an asset nothing relies on (G1, allowed); import 2 adds a
  card with no override that relies on the now-blank asset. Import 2 blanks nothing, so it
  imports with the note. This is the first-import behaviour the plan keeps on purpose, and
  running `PublishChecks` at import is out of scope (plan section 4, "for the owner's
  information only"). Not a finding against this change.
- Concurrency, paging and body-size edges do not apply: no route, and the import runs in one
  transaction.

### Findings

No Blocker. No Major.

**Minor 1. Flaky, unrelated: `UserRoleConcurrencyTests.Two_admins_demoting_each_other_at_once_leave_one_admin`.**
- Severity: Minor. Not caused by this change (no users file in the diff); recorded because
  every failure is reported.
- Steps: full API suite in Release on `DigitalHubContent_Test`, run 1 above.
- Expected: one demotion answers 200 and the other refuses as the last admin (409) after
  waiting for the users lock.
- Actual: the second request waited the lock's 5 s and got 503 `users_busy` while the first
  took about 6.6 s on this machine. Passed alone and in a second full run. For the tech lead:
  a candidate follow-up against ADM-04's test, not a change to this one.

**Minor 2. `docs/content-bundle.md`: the new bullet says "See the next paragraph."**
- Severity: Minor (wording).
- Steps: read "What the import refuses", the bullet "Removing alt text the target relies on".
- Expected: a pointer that finds the paragraph it means.
- Actual: the next item is the "Newer edits on the target" bullet; the paragraph meant is the
  one after the list ("Images without alt text are listed as notes ..."). Something like "See
  the paragraph after this list" would be exact. Does not change behaviour.

### Coverage table rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Scope chosen, with reasons | `ADM-12d/plan-approval.md:122-131` | Verified | Code matches plan section 3.2 (option A); section 1 above |
| Owner's answer to O-1 recorded verbatim, with the date | P-7; plan section 9 | Verified | Plan section 9 "A: refuse both", 19 November 2026; quoted in `21f1b6c` and `cd51f80` bodies |
| Failing `ContentBundleTests` fact committed first: card use (F1) | README G3 rule | Verified | Section 2: at `21f1b6c` F1 (True) and F1 (False) fail at line 536 on `Assert.False(dry.Ok)`; `21f1b6c` precedes `cd51f80` |
| Target settings row checked when the bundle's `settings` table is empty (F2) | ADM-12e text | Verified | Red at line 564 (section 2); green (section 3); killed M2, M4, M5 |
| Target page uses checked (F3) | ADM-12e text | Verified | Red at line 586; green; killed M2, M4, M5 |
| The note for the old site's images kept (G1, G2) | `ContentBundle.cs` note; `docs/content-bundle.md` | Verified | G1 and G2 pass at `21f1b6c` and `7a14b83`; G2 kills M1, G1 kills M6 |
| `--force` does not bypass the refusal | ADM-12c precedent | Verified | F1 to F3 refused with `force: true`; M4 (warning instead of problem) killed |
| Mutants M1 to M6 fail as stated | Plan section 5 | Verified | Section 4: six of six killed by the named facts, each build exit 0 with 0 errors, each restore `git diff --exit-code` 0 |
| `docs/content-bundle.md` updated | Plan section 3.2; condition 5 | Verified | Diff in section 1; covers share images, article bodies, drafts, settings, keeps "`--force` does not override this" (Minor 2 is wording only) |
| Full API suite and Public API suite green in Release | Plan section 5, commands 4 and 5 | Verified | 602 of 602 (run 2; run 1 had the unrelated flake, Minor 1); Public API 102 of 102 |
| CI, Security and Workflow lint green on the PR head | README | Open (CI) | Not pushed. Local: npm and NuGet gates 0 new; Semgrep 0 results in changed files; gitleaks NOT RUN (CI `gitleaks-pr`, `gitleaks-history`); e2e pending on CI `studio` |
| ADM-12 (Blocker) closed for the importer path | `admin-audit-2026-10-28.md:202-208` | Verified locally | F1 to F3 red then green; mutants killed; CI open |

Track checklist G3 (`docs/changes/README.md`): the finding, evidence and fix come from
ADM-12 via follow-up ADM-12e (checked); the regression tests are committed and shown failing
before the fix (section 2); an end-to-end test per Major is not applicable (ADM-12 is a
Blocker and the importer has no Studio screen); a Minor not fixed becomes a D-NNN entry is not
applicable (O-1: A, fixed).

Round 1 result: APPROVED (no Blocker, no Major, two Minors).

## Round 2

Tester, step 5, light retest. 2026-11-22. Commit tested: **`fcda229`** ("ADM-12e: Point the
alt-text refusal bullet at the paragraph after the list"), on `change/ADM-12e`, read in the
developer's worktree `D:\work\DigitalHub\dh-platform-claude-adm-12e` (HEAD `fcda229`) with
read-only git commands. No checkout, build or test run was needed (coordinator: "No test runs
are needed"). Gate 2 returned Round 1 Minor 2 (the doc pointer) to the developer; Minor 1 (the
unrelated `UserRoleConcurrencyTests` flake) was not part of this round.

### Checks

1. `git diff --stat 7a14b83 fcda229`, exit 0:

   ```
    docs/changes/ADM-12e/implementation.md | 24 ++++++++++++++++++++++++
    docs/content-bundle.md                 |  2 +-
    2 files changed, 25 insertions(+), 1 deletion(-)
   ```

   Only the doc line and the records.

2. `git diff --exit-code --stat 7a14b83 fcda229 -- api/`: exit 0, no output. The code and tests
   are those tested in Round 1 (red at `21f1b6c`, M1 to M6 killed, 602 of 602, Public API 102 of
   102), so that evidence still holds.

3. `git diff 7a14b83 fcda229 -- docs/content-bundle.md`: one line.

   ```
   -  without alt text of its own. See the next paragraph.
   +  without alt text of its own. See the paragraph after this list.
   ```

   Read in `git show fcda229:docs/content-bundle.md`: the bullet "Removing alt text the target
   relies on" is followed by the "Newer edits on the target" bullet, which ends the list. The
   first paragraph after the list is "Images without alt text are **listed as notes** ... One
   exception: an import that removes the alt text of an image the target already has ... It is
   refused, whether or not the bundle marks the image decorative ... `--force` does not override
   this." The pointer now reaches that paragraph.

4. It matches the code's behaviour. In `ContentBundle.cs` (unchanged since Round 1) the refusal
   is `problems.Add(...)`, and `options.Force` only suppresses the conflict refusal, so
   `--force` cannot override it. Round 1 proved this by running it: F1 to F3 are refused with
   `force: true`, and mutant M4 (`warnings.Add` in place of `problems.Add`) was killed. The
   "Newer edits" bullet's "`--force` only overrides this; it never skips any other check" stays
   consistent.

5. The commit subject starts with `ADM-12e:`, the body gives the reason, and it carries the
   attribution trailer. `implementation.md` Round 2 records the fix, the scope commands and
   "Tests. NOT RUN in this round", which is correct for a documentation-only change.

Not run in this round: every test and security suite. Reason: `api/` is unchanged and only one
Markdown line differs. Round 1 holds the local evidence. CI jobs `api`, `studio` (e2e, pending
on CI), `website`, `section-compare`, Security (`gitleaks-pr`, `gitleaks-history`, Semgrep, the
audits) and Workflow lint cover the PR head.

### Findings

No Blocker. No Major. Round 1 Minor 2 is closed. Round 1 Minor 1 is unchanged: it is not
caused by this change, and it is left for the tech lead as a possible follow-up on the ADM-04
test.

### Coverage table rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| `docs/content-bundle.md` updated | Plan section 3.2; condition 5; gate 2 round 2 condition 1 | Verified | Check 3: the pointer now reaches the paragraph after the list |
| `--force` does not bypass the refusal | ADM-12c precedent | Verified | Check 4; Round 1 F1 to F3 and M4 |
| Code unchanged since the tested commit | Round 1 | Verified | Check 2: `git diff --exit-code 7a14b83 fcda229 -- api/` exit 0 |
| Scope | Plan section 4 | Verified | Check 1 |

Verdict: APPROVED
