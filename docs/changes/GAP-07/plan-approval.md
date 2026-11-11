# Plan approval: GAP-07 (gate 1)

## Round 1 (plan round 2)

Tech lead, 1 November 2026. Gate 1 for `docs/changes/GAP-07/plan.md` round 2
(uncommitted) on `change/GAP-07` at `57da65b`. The branch was cut from
`change/GAP-01`, which has not merged yet. I read `plan-review.md` rounds 1
and 2, and the example record set `docs/changes/GAP-01/`. The governing
documents are not on this branch (O-18, pending), so I read them from the
read-only reference copy:

- `AGENTS.md`, `ENGINEERING_STANDARDS.md` and `ENVIRONMENT.md`;
- `docs/changes/README.md`, `docs/PROJECT_PROFILE.md` and
  `docs/deferred-items.md`;
- `docs/quality/refinement-plan-2026-10-28.md`;
- `.claude/agents/tech-lead.md`.

I wrote neither the plan nor the review.

### Decision

Approved, with the conditions below.

`plan-review.md` round 2 ends `Verdict: APPROVED`. It resolves round 1's Major
(F-1) and four Minors (F-2 to F-5), and raises three new Minors (F-6, F-7,
F-8), none of which blocks.

### What I checked myself

All commands were run in `/home/user/wt-GAP-07` on `57da65b` with Node
v22.23.4. Nothing in the repository was changed except this file. Reports
went to the session scratchpad.

```
$ git rev-parse --is-shallow-repository
false
$ node --test .github/security/gate.test.mjs
# tests 63
# pass 63
# fail 0                                                   exit 0
$ grep -n -E "continue-on-error|BLOCKING_FROM" .github/workflows/security.yml
(no output)                                                exit 1
$ grep -n "needs:" .github/workflows/security.yml
79, 101, 120, 136, 159: needs: gate-self-test   (npm-audit, dotnet-vulnerable, gitleaks-pr, gitleaks-history, semgrep)
$ sed -n 13,14p .github/security/run-npm-audit.sh
npm audit --omit=dev --audit-level=high || true
npm audit --omit=dev --audit-level=high --json > "$RUNNER_TEMP/audit.json" || true
$ known-findings.json: npm.website [], npm.studio [], dotnet [], gitleaks 2, semgrep 7
```

Then the full-tree audit, without `--omit=dev`, as the new script will run
it, fed to the current gate:

```
website$ npm audit --audit-level=high --json       exit 0
  metadata.vulnerabilities {"info":0,"low":0,"moderate":1,"high":0,"critical":0,"total":1}
website: 0 finding(s) at the gate's level; 0 known, 0 new.   gate exit 0
studio$  npm audit --audit-level=high --json       exit 0
  metadata.vulnerabilities {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
studio: 0 finding(s) at the gate's level; 0 known, 0 new.    gate exit 0
```

These match plan 2.2. The NuGet result, the six-High historical proof (2.3)
and the line numbers in 3.1 step 10 were reproduced by the reviewer. I accept
that evidence, and the developer reproduces it (5.3).

In `gate.mjs`:

- `finish()` (259 to 269) sets `process.exitCode` from new findings only.
- `main()` (420 onwards) builds the npm and dotnet known sets from `entry.id`
  only.
- `reject()` exits at line 119, so a malformed report still fails before any
  allow-list check.
- The existing fixture gate (`gate.test.mjs` 36 to 47) builds its allow-list
  with `structuredClone(known)` from the real file. The plan's
  `fixture-clean` follows the same pattern.

So plan 3.1 step 6 ("set `process.exitCode = 1` for entry problems after
`finish()` runs") is right and needed.

### Reasons

**Right change, right point in the order.**

- GAP-07 is a G1 Wave 1 item (refinement plan line 157; register row line
  71), High impact and Low effort, so it goes in merge slot 1.
- Wave 1 runs from 3 to 16 November. The owner's instruction to work on both
  waves is quoted exactly in plan section 1: "Start waves 0 & 1 and update me
  with each gap done" (Mohamed Elbadry, 2026-11-01, project thread).
- It depends on GAP-01 (Wave 0) by design. On the pre-GAP-01 lockfile the
  full-tree audit fails with six Highs (2.3). The plan names this as R-3 and
  does not open its pull request before GAP-01 merges. That keeps Wave 0
  before Wave 1 in the merge order.
- ISO-4 and ISO-5 and the G3 Blockers are slot 2 and do not touch these
  files.

**No conflict with an open branch.** I ran
`git diff --stat 6470fac...<branch> -- .github/ docs/deferred-items.md ENGINEERING_STANDARDS.md`
against every local change branch and the two CI branches on the remote:

- `change/GAP-04`, `change/GAP-06`, `origin/change/ci-runner-pin` (PR #38) and
  `origin/ci/github-actions` touch only `.github/workflows/ci.yml`.
- `change/GAP-08` adds only new files under `.github/lint/` and
  `.github/workflows/workflow-lint.yml`.
- `change/GAP-11`, `change/GAP-12` and `change/GAP-13` touch nothing under
  those paths.

None of them touches `.github/security/`, `security.yml`,
`docs/deferred-items.md` or `ENGINEERING_STANDARDS.md`. The one future
overlap, GAP-09 and the Dependabot `github-actions` bumps on `security.yml`
and `security.expected.yml`, is named as R-2 and handled by sequencing
(condition 6).

**P-6, no gate weakened.**

- *Full tree.* Removing `--omit=dev` widens the audit, and
  `--audit-level=high` stays. No allow-list entry is added, and
  `known-findings.json`, the lockfiles and the `.csproj` files stay unchanged
  (checked by 5.2).
- *Entry rule.* It is a new fail-closed check. A missing register with entries
  present fails (N9). No date override exists, so nothing in a workflow can
  loosen it. An expired entry fails even when its advisory is gone.
- *Moving the npm and dotnet self-tests to `fixture-clean`.* I judged this
  move separately, because it changes which allow-list existing tests read. It
  is not a weakening:
  - Those tests assert report validation, severity filtering and exit codes.
    None of them asserts anything about the content of the real `npm` or
    `dotnet` sections, which are empty today.
  - The gate code they run stays byte-identical to the real gate.
  - The real file is still covered three ways. It is parsed at import (line
    10, then line 39). It is checked for owner and reason, and by N10 for
    shape, inside the self-test. The npm and NuGet jobs check it for expiry
    and against the register on every run.
  - `gitleaks` and `semgrep` keep the real gate and the real allow-list.
  - The move removes two accidental dependencies. One is a real entry's date:
    through `needs:`, an expiry would skip both gitleaks scans and Semgrep.
    The other is a real entry's id: it could make an exit-1 test pass or fail
    for the wrong reason.
  - N11 proves the property behaviourally and statically.

  The Done-when asks the gate to fail on an expired entry and a self-test to
  prove it. N3 to N6 and N11 do that on byte copies. It does not ask the
  self-test to fail on the real file. Enforcing expiry in the npm and NuGet
  jobs is also what the register itself says: "An expired entry fails the
  gate that cites it."

**P-7, O-20 is left to the owner.**

- The plan asks O-20 as a question, with two options and a recommendation, and
  states "Not answered; this plan does not assume an answer".
- It does not edit `known-findings.json`, so standard section 6 ("From the
  next change to it, each entry cites a `D-NNN` id …") is not triggered for the
  9 gitleaks and Semgrep entries by this change.
- C-10 is "Open: waits on O-20" and names both possible destinations.
- No D-NNN is invented and `docs/deferred-items.md` is not created. Only the
  owner creates entries.
- O-18 is listed as a dependency that changes only where the
  `ENGINEERING_STANDARDS.md` row is updated (C-9), not whether this change can
  proceed.

Nothing in this change needs an owner decision that is not quoted. So the
verdict is not BLOCKED ON OWNER.

**B-8, one topic.** This is one gate, G-11, the dependency audit. It has two
parts, the full tree and the dependency allow-list entry rule, and both come
from the one register row and the one Done-when. The routing in `gate.test.mjs`
is required by the entry rule (F-1). The header comments in `gate.mjs` and
`security.yml` would otherwise become false. The conditional standards row is
the status update the refinement plan asks each closing pull request to make.
The gitleaks and Semgrep half and the `dotnet-ef` tool manifests are kept out
as separate follow-ups, which is right.

**"Blocks at once" is acceptable here.** Standard section 3 lets a gate block
at once when it replaces protection that already existed, and the Done-when
says so. `npm-audit` and `dotnet-vulnerable` already block today: they have no
`continue-on-error` and no `*_BLOCKING_FROM`. This change widens what they
read rather than adding a new job. The usual reason for a seven-day report
period is that a new gate might turn red on code already merged. That does not
apply here:

- On top of GAP-01, the full-tree audit is 0 High and 0 Critical in both apps
  (my run above) and in the NuGet graph (the reviewer's run).
- The entry rule cannot fire until an entry exists, because all three sections
  are empty.

So the gate is green on the day it merges. That holds only if GAP-01 merges
first, which is condition 1.

I accept one residual risk. After merge, a new development-package High will
turn every pull request's npm job red at once. Until O-18 lands
`docs/deferred-items.md`, the only way out is an upgrade, not an exception
(R-1). That is S-7 working as written, and it is the same behaviour the
production tree already has. The coordinator should know that O-18 is the
route to an exception.

**Risk is acceptable otherwise.**

- Only CI files change, and rollback is one revert.
- The date rules are UTC only, with the boundary day tested (N6) and
  impossible dates rejected (N8).
- The register parser skips fenced blocks (N7) and fails closed when the
  register's format drifts (R-5).
- Golden copies change in the same commit as their originals, and no `run:`
  line changes.

### Conditions the developer must meet

1. **Sequencing on GAP-01.** Do not open the pull request until GAP-01 has
   merged into `origin/rebuild/dotnet-platform`. Then:
   - rebase onto that branch (B-3: no tracking, never a bare push);
   - confirm `git rev-parse --is-shallow-repository` is `false` (never
     `git fetch --depth`);
   - re-run 5.2 and 5.3 on the rebased head, with `<base>` set to the merged
     base commit, not `57da65b`.

   If the rebased full-tree audit shows any High or Critical finding, stop. Do
   not add an allow-list entry. Report it to the coordinator (R-1). An
   exception needs the owner's words and `docs/deferred-items.md`.
2. **F-6 (binding).** "The fixture gate is the real gate" must compare
   `gate.mjs` and `fail-on-rules.json` byte for byte in all four copies:
   `fixture-repo`, `fixture-clean`, `fixture-no-register` and
   `fixture-expired-real`. Quote that test passing in `implementation.md`.
   Section 4 of the plan governs, and step 10's list of three is incomplete.
3. **F-7 (binding).** `allowListShapeProblems`, `allowListProblems` and
   `parseRegister` are loaded only with
   `await import(pathToFileURL(gate).href)` inside the tests that use them.
   None of them is a top-level named import. The red run must fail exactly 10
   named tests (N1, N3 to N11) out of 74, not the whole file. Quote the
   actual counts and names. If they differ from 74 / 64 / 10, explain why
   before going on, and do not adjust the tests to hit the number.
4. **`fixture-clean` and `fixture-expired-real` are derived, not hand-copied.**
   Build each `known-findings.json` at test time from the real file, as the
   existing fixture gate does with `structuredClone(known)`:
   - `fixture-clean`: the real file with only `npm.website`, `npm.studio` and
     `dotnet` set to `[]`;
   - `fixture-expired-real`: the real file plus the D-900 and D-904 entries.

   The gitleaks and Semgrep sections, and any future top-level field, then
   stay current.
5. **Scope.** Change only the files in plan section 4, and keep the commit
   order: red tests first, then the fix.
   - `known-findings.json`, both lockfiles, every `package.json`, every
     `.csproj`, `run-dotnet-audit.sh` and its golden copy stay byte-identical
     (5.2).
   - Only the header comment of `security.yml` changes. No job, step,
     `run:`, `uses:` or `name:` line changes.
   - Do not create `docs/deferred-items.md` or `ENGINEERING_STANDARDS.md`. If
     the standard is not on the rebased base, record C-9 as moved in
     `implementation.md`.
   - List the `dotnet-ef` tool-manifest follow-up in `implementation.md`.
6. **Parallel files (R-2).** Before the developer starts, the coordinator
   confirms that no branch editing `security.yml`, `security.expected.yml` or
   `.github/security/` is open (GAP-09, Dependabot `github-actions`). If one
   opens before GAP-07 merges, whichever lands second rebases and updates the
   golden copy in the same commit. The developer re-runs the
   `diff security.yml security.expected.yml` check after every rebase.
7. **O-20 goes to the owner, unanswered.** The coordinator carries O-20 to
   the owner, word for word from plan section 9, with the next update. GAP-07
   does not wait for the answer. No role answers it, and no role edits the
   gitleaks or Semgrep sections under this change.

### Reviewer Minors accepted

- **F-6** (which fixture copies are byte-compared). Accepted as a binding
  instruction: condition 2. No plan revision is needed.
- **F-7** (dynamic-import rule for `allowListShapeProblems`). Accepted as a
  binding instruction: condition 3. No plan revision is needed.
- **F-8** (N11's static scan matches only two patterns). Accepted as written.
  The behavioural half of N11 is the real proof. The tester checks by reading
  `gate.test.mjs` that every spawn of the real gate goes through `run()`, and
  records that in `test-report.md`.
- Round 1 F-2 to F-5 were resolved in plan round 2. The reviewer verified that
  and I agree. Nothing is carried forward.

This approval is a pipeline role, not the owner's confirmation. It does not
answer O-18 or O-20, and it does not replace the owner's confirmation of the
Wave 0 exit gate.

Verdict: APPROVED
