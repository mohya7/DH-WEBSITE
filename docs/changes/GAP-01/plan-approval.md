# Plan approval: GAP-01 (gate 1)

## Round 1 (plan round 2)

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

Round 1 result: approved (superseded by round 2 below).

## Round 2 (plan round 3)

Tech lead, 1 November 2026. Gate 1 again, for `plan.md` round 3 (uncommitted
in the working tree on head `362a5e9`), after the developer stopped in
`implementation.md` round 1 (`Status: BACK TO ARCHITECT`) and
`plan-review.md` round 3 returned `Verdict: APPROVED` with one Minor (R3-1).

### Decision

Approved, with the conditions below, which replace round 1's.

### What I checked myself

- **Branch state.** `git log --oneline 6470fac..HEAD` shows the plan commit,
  then steps 1 to 4 (`3e620e1`, `2a4f836`, `115071e`, `dd1628b`), then the
  implementation record `362a5e9`. The red commit `2a4f836` comes before the
  upgrade commits, as round 1 condition 4 required.
  `git diff --name-only 6470fac HEAD` lists only the scoped files: the two
  `.github/security` files, both `package.json` files and both lockfiles, plus
  `docs/changes/GAP-01/`. `origin/rebuild/dotnet-platform` is still
  `6470fac`.
- **The hole is real.** `website/src/build/strip-runtime.ts`:
  - The `runtimeTraces` list (lines 46-49) has only `/_next/`, `__next_f` and
    the boundary markers.
  - Every removal is keyed on `/_next/`, `self.__next_f` or a boundary marker.
  - `runtimeTracesIn` is called only from `scripts/strip-runtime.ts:32`,
    `scripts/check-output.ts:134` and its own test file.

  So an inline `_R_` script that names `static/chunks/…` passes both the
  strip and the check, as plan 2.9 says. The reviewer measured the fix on a
  scratch export:
  - 1 match per page on all 29 pages;
  - 0 `TURBOPACK` left;
  - `diff -r` against base: exit 0 with no output;
  - the new trace strings appear 0 times in the base output and in the design.

  I accept that evidence. The developer must reproduce it on the real branch
  (condition 3).
- **Shallow fetch.** `git rev-parse --is-shallow-repository` prints `false`.
  Round 3 removed the `git fetch --depth=1` line from 5.2 and replaced it with
  that check.
- **The shared wrapper still forwards the variables.**
  `<scratchpad>/bin/sqlcmd` is
  `exec docker exec -i -e SQLCMDPASSWORD -e SQLCMDUSER -e SQLCMDSERVER dh-mssql …`.
  In round 1 it was checked working with `sa` and `dh_content_app` (exit 0).

### Reasons

**The scope extension is right, and is still one change.** Upgrading `next`
to 16.4.3 is not safe to merge unless the strip removes the new bootstrap.
Without the fix, every page would ship an inline script whose chunks are
deleted, while the build reports "no runtime". That is a fail-closed guard
with a hole (P-5). The fix is the smallest one that closes it:

- one narrow removal, anchored on
  `<script id="_R_">(globalThis["TURBOPACK"]`;
- two broad traces, `TURBOPACK` and `static/chunks/`;
- a red test committed first.

It touches only `website/src/build/strip-runtime.ts` and its test file. The
scripts, the locked design, `packages/` and the gate files stay untouched.
This strengthens an existing guard rather than adding a new gate, so B-8 is
met.

The pass condition is now zero difference against base. The base noise floor
was measured empty, so the site's behaviour does not change, and no owner
decision is needed beyond the O-1 position accepted in round 1. The rejected
alternatives hold:

- An older 16.4.x stays inside the `<=16.4.0` advisory ranges.
- Adding the trace without the removal leaves the website unbuildable.
- A broad removal could silently take out something else.

**Order and conflicts, re-checked** with each worktree's `git status` and
`git diff --name-only 6470fac HEAD`:

- **GAP-11** (worktree still at `6470fac`, no code yet) plans to change
  website source, including `scripts/check-output.ts`, which calls
  `runtimeTracesIn`. It does not touch `src/build/strip-runtime.ts`. Its
  built output will differ from base, and if it puts self-hosted GSAP or any
  inline script into the HTML, the new traces apply to it. The two must not
  be measured against each other's base (condition 2).
- **GAP-06** (`b92d325`) now changes `ci.yml`, two migrations and
  `api/tools/migration-checks/`. Those files do not overlap with this
  change. GAP-06 also uses the shared SQL Server, and the Studio
  end-to-end harness migrates `DigitalHubContent_E2e` from the branch's
  migrations, which are the base's.
- **GAP-08** (`3f7f772`: `.github/lint/`, `workflow-lint.yml`) and
  **GAP-12** (`ffc57ac`: API only) do not overlap.
- **PR #38** (`ci.yml`) and **PR #37** (docs) do not overlap.

GAP-01 is still Wave 0, G1 slot 1, and should merge before the Wave 1 items.

**Minors accepted.**

- **R3-1** (the wrapper fix lives only in this file). I carry the R2-1
  condition forward as condition 1. No architect round is needed.
- **The round 3 corrections.** I accept these, as the reviewer did:
  - the Studio lockfile written by npm 11.19.1, which keeps the base's `libc`
    fields and is still regenerated by npm (B-7), provided `npm ci` passes
    with npm 10.9.9;
  - `VITE_PUBLIC_SITE_URL` on the Studio build, matching `ci.yml`;
  - the corrected origin of `@types/estree`;
  - the website test counts (409 passed and 1 skipped, against 408 and 2).
    The extra base skip is the git-checkout-only test in `design.test.ts`.

### Conditions the developer must meet

1. **Studio end-to-end (5.3 step 4), carried forward unchanged from R2-1.**
   - Put `/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/bin`
     first on `PATH`. The shared wrapper there forwards `SQLCMDPASSWORD`,
     `SQLCMDUSER` and `SQLCMDSERVER`; check it with `cat` before the run and
     quote it. Plan 2.8's sentence that the wrapper "is enough" is true only
     with this forwarding.
   - `dh_content_app` already exists, so the `IF SUSER_ID(...) IS NULL` step
     does nothing.
   - A NOT RUN caused by the wrapper or the login is not acceptable evidence.
   - Right before the run, check the sessions on `DigitalHubContent_E2e` and
     quote the output. If a row comes back, or GAP-06 is using the shared
     server at that moment, wait and ask the coordinator.
   - Touch no other database.
2. **Rebase before delivery.**
   - Rebase on `rebuild/dotnet-platform` after PR #38 merges.
   - Rebase again if any other change touching `website/` lands first,
     GAP-11 in particular.
   - After each such rebase, redo these against the new base commit, never
     `6470fac` once the base has moved:
     - the base noise floor and the zero-difference `diff -r` (5.2 step 4);
     - the `TURBOPACK|static/chunks/` grep;
     - the section and screenshot comparisons, base vs branch.
   - If GAP-11's output trips one of the new traces, stop and report it. Do
     not loosen a trace (P-6).
3. **Red, then green, for the strip (steps 5 and 6).**
   - Commit 5 changes only `website/test/strip-runtime.test.ts`. Its fixture
     is cut from real 16.4.3 output, with the `_R_` element verbatim.
   - At commit 5, `npx vitest run test/strip-runtime.test.ts` fails on the new
     tests, and every other test passes. Quote the failures.
   - Commit 6 changes only `website/src/build/strip-runtime.ts`. After it:
     - all tests pass;
     - the full build exits 0;
     - the strip counts equal the base's plus one "Turbopack bootstrap
       script" per page;
     - `diff -r` against the base `out/` exits 0;
     - the grep finds nothing.
   - The only edit to an existing assertion is the added key in the
     `removed` `toEqual`. Quote the before and after in `implementation.md`.
4. **Keep to scope.**
   - Change only the files in plan section 4 (round 3).
   - These must stay byte-identical to the base: `scripts/strip-runtime.ts`,
     `scripts/check-output.ts`, `website/design/`, `packages/`, `ci.yml`,
     `gate.mjs`, `run-npm-audit.sh`, `security.yml` and the golden copies.
     Check with `git diff --stat`.
   - Use no `overrides` and no `--force`.
   - Stop and go back to the architect, or to the owner where the plan says
     so, if any of these happens:
     - any other export difference;
     - an untraceable lockfile entry;
     - a surviving advisory.
5. **Git safety.**
   - Never run `git fetch --depth` or any other command that makes the
     shared `.git` shallow.
   - Run `git rev-parse --is-shallow-repository` (must print `false`) before
     the design check, and quote it.
   - The design check uses the already fetched
     `origin/feature/interviewer-portal`.
6. **`npm ci` with both npm versions.** For the Studio lockfile, run `npm ci`
   with npm 10.9.9 (Node 22, as in CI) and with npm 11, and quote both exit
   codes.
7. **Deadline.** Push by Tuesday 3 November. If any condition cannot be met
   in time, report it to the coordinator by the end of 2 November, so the
   owner can choose between a slip and an exception. Do not cut checks to
   save time.

Verdict: APPROVED
