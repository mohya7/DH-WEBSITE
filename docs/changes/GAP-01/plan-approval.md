# Plan approval: GAP-01 (gate 1)

Tech lead, 1 November 2026. Gate 1 for `docs/changes/GAP-01/plan.md` round 2,
on `change/GAP-01` at `6470fac` (equal to `origin/rebuild/dotnet-platform`:
`git rev-parse HEAD origin/rebuild/dotnet-platform` → both `6470fac3668a…`).
Governing documents read from the read-only copy of
`origin/claude/cool-heisenberg-mh6zx9` (`docs/changes/README.md`,
`.claude/agents/tech-lead.md`, `docs/quality/refinement-plan-2026-10-28.md`,
`ENVIRONMENT.md`), plus `plan.md` and `plan-review.md` rounds 1 and 2.

## Decision

Approved, with the conditions below.

`plan-review.md` round 2 ends `Verdict: APPROVED`, with one Minor (R2-1).

## Reasons

**Right change, right point in the order.** GAP-01 is the first Wave 0 item
in the refinement plan (line 142), is High impact and Low effort, and has a
fixed deadline of 3 November. It is G1, so it uses slot 1. No G1 Wave 1 item
should merge before it. The owner's instruction is quoted exactly in the plan:
"Start waves 0 & 1 and update me with each gap done" (Mohamed Elbadry,
2026-11-01, project thread), followed in the same thread by "continue working on
wave 0 & 1". Wave 0 "waits on O-1". I agree with the architect and the
reviewer that this instruction authorises O-1's recommended path, "Fix now:
upgrade the website to `next@16.4.3` in its own pull request". That path needs
no exception and is designed to change no behaviour. The plan does not record
O-1 as decided. It stops for the owner if an advisory survives or the built
site changes. So O-1 does not block this plan. "In its own pull request" is
met, because the pull request carries only the GAP-01 dependency fix and the
self-test refactor that fix requires.

**No conflict with open branches.** Each check below was run with
`git diff --name-only 6470fac...<branch>` and `git -C <worktree> status`:

- `change/GAP-12` touches `api/src/DigitalHub.Api/Program.cs`,
  `docs/security-deployment.md` and a new API test.
- `change/GAP-08`, `change/GAP-11` and `change/GAP-06` have no commits beyond
  `6470fac`. Their worktrees hold only `docs/changes/`.
- `origin/change/ci-runner-pin` (PR #38) touches only `ci.yml`.
- PR #37 (pipeline docs) touches only governance documents.

None of them touches `package.json`, either lockfile, `known-findings.json` or
`gate.test.mjs`. Two of them interact with this change without touching its
files:

- GAP-11 changes website source (`sets.ts`, `Design.tsx`, `check-output.ts`),
  so the built output changes.
- The Studio end-to-end harness and GAP-06 both use the shared SQL Server.

Conditions 2 and 3 cover these.

**Risk is acceptable.** Every target version is a patch or minor release
inside its current major. The reviewer reproduced the upgrade on the lockfile
alone, and both full-tree audits came out clean. The gate itself
(`gate.mjs`, `run-npm-audit.sh`, `security.yml`, the golden copies) is not
touched, and the allow-list only shrinks. The self-test refactor keeps every
assertion, strengthens two of them (`3 known, 1 new`), and adds a
byte-identity test against drift. R-1, the export changing, has four separate
catches:

- the fail-closed build scripts;
- a base-vs-branch `out/` diff measured against a noise floor;
- section comparison, base vs branch;
- screenshot review, base vs branch.

Each has a stop rule. Rollback is one revert.

**Q-1.** I accept the plan's and the reviewer's reading. Standard section 6
marks the D-NNN-per-entry rule "Gap (step 4f)". The refinement plan schedules
it under GAP-07. `docs/deferred-items.md` admits only entries the owner has
decided. This change only removes entries, so it needs no owner decision.

**R2-1 has been fixed in the environment, and I checked it myself.** The shared
wrapper now forwards the variables:

```
$ cat <scratchpad>/bin/sqlcmd
exec docker exec -i -e SQLCMDPASSWORD -e SQLCMDUSER -e SQLCMDSERVER dh-mssql /opt/mssql-tools18/bin/sqlcmd "$@"
$ SQLCMDPASSWORD=… sqlcmd -S localhost,1433 -d master -U sa -C -I -b -Q "…SUSER_ID(N'dh_content_app')…; …COUNT(*) … DigitalHubContent_E2e" </dev/null
app 262 / e2e_sessions 0          exit 0
$ SQLCMDPASSWORD=CiOnlyApp2026Passw0rd sqlcmd -S localhost,1433 -d master -U dh_content_app -C -I -b -Q "SELECT SUSER_NAME()" </dev/null
dh_content_app                    exit 0
```

The password reaches sqlcmd through the environment, as
`studio/e2e/start-api.ts` (`runSql`) sends it. No change-specific wrapper is
needed. Plan 2.8 is now out of date in one detail: `dh_content_app` exists,
since another session created it, and it accepts the `ci.yml` workflow-only
password. The plan's `IF SUSER_ID(...) IS NULL` guard makes that step a
no-op, which is correct.

## Conditions the developer must meet

1. **Studio end-to-end (5.3 step 4).** Run it with the shared wrapper first on
   `PATH`. A NOT RUN caused by the wrapper or by the login is not acceptable
   evidence. Run the session check on `DigitalHubContent_E2e` right before
   the run, and quote its output. If the check returns a row, or GAP-06 is
   working on the shared server at that moment, wait and ask the coordinator.
   Touch no other database.
2. **Rebase before delivery.** Rebase on `rebuild/dotnet-platform` after
   PR #38 merges (5.4), and again if any other change touching `website/`
   lands first. For example, if GAP-11 merges before this change, rebase
   and redo two checks against the new base commit:
   - the base-vs-branch `out/` diff, with its noise floor;
   - the section and screenshot comparisons, base vs branch.

   The developer must not compare against `6470fac` once the base has moved.
3. **Keep to scope.** Change only the files in section 4. `ci.yml`,
   `gate.mjs`, `run-npm-audit.sh`, `security.yml` and the golden copies
   must stay byte-identical to the base (check with `git diff --stat`, as in
   5.2). Use no `overrides` and no `--force`. If a lockfile entry cannot be
   traced, if an advisory survives, or if the export changes beyond the noise
   floor, stop and go back to the architect, or to the owner where the plan
   says so.
4. **Red before green.** Commit 1 is green against the current allow-list:
   63 pass, 0 fail. Commit 2 must come before commit 3, with the gate red,
   ending "0 known, 6 new", and the output quoted in `implementation.md`.
5. **Deadline.** Push by Tuesday 3 November. If any condition above cannot
   be met in time, report it to the coordinator by the end of 2 November, so
   the owner can choose between a slip and an exception before the deadline.
   Do not cut checks to save time.

## Reviewer Minors accepted

- **R2-1 (sqlcmd wrapper does not forward `SQLCMDPASSWORD`).** Closed by the
  environment fix verified above. Condition 1 makes the end-to-end run
  mandatory. No plan change is needed.
- Round 1 F-2, F-3 and F-4 were resolved in plan round 2. The reviewer
  verified that, and I agree. Nothing is carried forward.

Verdict: APPROVED
