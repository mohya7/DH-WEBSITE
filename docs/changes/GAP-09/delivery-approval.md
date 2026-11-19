# Delivery approval: GAP-09

## Round 1

Tech lead, gate 2, 19 November 2026, against `implementation.md`, and against
`test-report.md` round 1 (`Verdict: APPROVED`, not yet committed), on
`change/GAP-09` at `89f0aec7664b7096918c5fc98f5c3af278c68c93`. Round 2 below supersedes the draft PR description in this round.

Owner's request, exactly: "GAP-09 pin every GitHub Action by 40-character SHA, the
SQL Server image by digest, and Node and .NET to exact versions".

This approval is not an owner decision. It does not replace the owner's
confirmation of the push and the squash-merge.

### Base

`git fetch` was run, then `git rev-parse origin/rebuild/dotnet-platform` and
`git merge-base HEAD origin/rebuild/dotnet-platform`. Both are `8b5d6a5`. The base
has not moved, so no merge is needed. Check again before the push.

### Decision

Changes needed. The workflow edits are correct and meet the request. One plan
item is missing, and two records say it was done.

**Finding D-1 (Major for the records, Minor in effect): the `codeql.yml` pin comment
is missing.** Plan 3.5 and the plan's file table (`plan.md:200`) list a pin
comment in `codeql.yml`. `implementation.md` says it is there ("pin comment",
and "The comment is placed above `jobs:` there"). The test report's finding 2
repeats this. But the diff for `codeql.yml` has only the 4 `uses:` lines and the
`dotnet-version` line. `grep -n 'Pinned' .github/workflows/codeql.yml` returns
nothing. So the implementation record is wrong, and the tester verified it
without checking. The comment is harmless, but I cannot approve a delivery whose
records describe a file that is not in the diff.

Back to the **developer**: either add the 3-line pin comment above `jobs:` in
`codeql.yml`, as `implementation.md` describes, or remove that claim from
`implementation.md` and record the gap. Then the **tester** re-checks the
`codeql.yml` diff line by line and corrects finding 2. Nothing else needs to
change.

### What I verified myself

| Check | Command | Result |
| --- | --- | --- |
| Scope | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` | The 5 planned files plus `docs/changes/GAP-09/*`. Nothing else (C-5) |
| Diff matches the plan | read the whole `.github` diff | Only `uses:`, `image:`, `NODE_VERSION`, `dotnet-version` lines and the pin comments in `ci.yml` and `security.yml` (and its golden copy) changed. No `runs-on`, `python-version`, secret or GAP-05 line changed. The `codeql.yml` comment is missing (D-1) |
| P-1 | `grep -nE '^\s*-?\s*uses:' .github/workflows/*.yml .github/security/*.yml \| grep -vE '@[0-9a-f]{40}( \|$)'` | exit 1, no output |
| A SHA against its tag | `git ls-remote https://github.com/actions/checkout refs/tags/v4.4.0` | `11d5960a326750d5838078e36cf38b85af677262`, the same as the pin |
| Golden copy (C-1) | `diff <(tr -d '\r' < .github/workflows/security.yml) .github/security/security.expected.yml` | exit 0 |
| Gate self-test | `node --test .github/security/gate.test.mjs` | exit 0, `tests 86`, `pass 86`, `fail 0` |
| Failing first (C-4) | `git log`; `git show --stat d8cc541` | `d8cc541` (red record, docs only) comes before `c8cd307` (the edit) |
| B-4 | `git log --format='%h %s%n%b' -4` | All four subjects are `GAP-09: <imperative>`, each with a `Co-Authored-By` trailer |

I read the tester's evidence for the image digest (the MCR `Docker-Content-Digest`),
the Node and .NET release listings, and C-3. It has commands, exit codes and
output. I did not re-run those.

### Coverage table

Every row has evidence, except the CI row. That row is pending the push, and that
is correct. The `codeql.yml` "pin comment" in the change table has no evidence
(D-1).

### Reviewer and tester Minors accepted

- Node `22.23.4` rather than `22.23.5`: accepted. It is what CI resolves today, and
  it meets the request. A later bump under G-15.
- Test report finding 2 (comment placement): not accepted as written, because the
  comment is not there. See D-1.

### Definition of Done: open items

- PR checks green on the final head, with run IDs: open until the owner pushes.
  That includes C-2 (the CodeQL `Download action repository
  'github/codeql-action@9418214d…'` line), the digest in the API and Studio
  service logs, and `10.0.404` and `v22.23.4` in the setup logs.
- Independent code review findings fixed or accepted: open (D-1).
- Rollback and deployment note: can be ticked. Rollback is a revert. Nothing
  deploys. The owner squash-merges, and CI, Security and Workflow lint run again
  on the base.
- Governance: the G-15 status cell in `ENGINEERING_STANDARDS.md:68` changes after
  the merge, not in this change, as the plan says.

### Draft pull request description

```markdown
## What and why

GAP-09 (G-15). Floating references (`@v4`, `mssql/server:2022-latest`, Node `22`,
.NET `10.0.x`) let what CI runs change without a commit. This pins every GitHub
Action to a 40-character commit SHA with a `# vX.Y.Z` comment, the SQL Server
service image to `2022-CU28-ubuntu-22.04@sha256:4525e3ef…7b7f`, Node to
`22.23.4`, and the .NET SDK to `10.0.404`. Each value is the one CI resolves
today, so behaviour does not change.

## Scope and boundaries

In scope: `.github/workflows/ci.yml`, `security.yml`, `codeql.yml`, and the
golden copies `.github/security/security.expected.yml` and
`semgrep-job.expected.yml`.
Out of scope: action major upgrades, `runs-on`, `python-version`, `global.json`,
the GAP-05 section-compare lines, the production SQL Server major (GAP-10), and
the G-15 status in `ENGINEERING_STANDARDS.md` (after the merge).

## Security impact

Supply chain only. A moved tag or image can no longer change CI without a
commit. No route, policy, data or secret changed. The workflow-only SQL Server
passwords are already on the base and are not touched.

## Tests and evidence

- P-1, no unpinned `uses:`: exit 1, no output.
- SHAs against tags with `git ls-remote` (codeql-action on the peeled `^{}`
  commit); image digest against the MCR `Docker-Content-Digest`; Node and .NET
  against their release listings.
- Golden copy: `diff <(tr -d '\r' < security.yml) security.expected.yml`, exit 0.
- `node --test .github/security/gate.test.mjs`: exit 0, 86 of 86.
- Red first: `d8cc541` records P-1 to P-4 failing on the base, before `c8cd307`.
- NOT RUN locally: `dotnet test`, the website and Studio suites, end-to-end,
  `self-test.sh`, gitleaks. No code changed. Covered by CI, Security, CodeQL and
  Workflow lint on this PR. Run IDs: <to fill in after the push>.

## Owner decisions

"GAP-09 pin every GitHub Action by 40-character SHA, the SQL Server image by
digest, and Node and .NET to exact versions" (owner, 19 November 2026, the
GAP-09 request).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no route changed)
- [x] Tests exist for the behaviour changed (pin checks P-1 to P-5, red first; gate self-test 86/86)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author (plan-reviewer, tester, tech-lead gates)
- [x] Rollback is understood: revert this PR
- [x] Deployment note: nothing deploys; the owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- Node is pinned to 22.23.4, not 22.23.5: that is what CI resolves today. A later bump under G-15.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (G-15 status after the merge)
- [ ] `docs/deferred-items.md` updated for any exception (none)
- [x] Documentation updated (`docs/changes/GAP-09/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Round 1 result: changes needed (D-1). Superseded by round 2.

## Round 2

Tech lead, gate 2, 19 November 2026. Checked against `test-report.md` round 2
(`Verdict: APPROVED`, not yet committed) on `change/GAP-09` at
`0e0a03fe214f56856feb1edb262fad114ca49169`.

### Base

After a fresh `git fetch`, `origin/rebuild/dotnet-platform` and the merge-base
are both still `8b5d6a5`, so no merge is needed. Check again just before the push.

### Decision

Approved. D-1 is fixed. This approval passes the change to the owner. It is not
an owner decision.

### What I verified myself

| Check | Command | Result |
| --- | --- | --- |
| D-1 fix | `git diff 89f0aec HEAD -- .github` | Only `codeql.yml` changed: the same 3-line pin comment as the other workflows, placed above `jobs:`. It contains no `node -e`, `python -c` or `--input-type` |
| Line endings | `file .github/workflows/codeql.yml` | CRLF, which matches the base |
| D-1 record | `git log -3` | `df97f14` adds the comment and `0e0a03f` records it. Both follow B-4 and carry the `Co-Authored-By` trailer |
| P-1 | the same grep as in round 1 | exit 1, no output |
| Golden copy | `diff <(tr -d '\r' < security.yml) security.expected.yml` | exit 0 |
| Scope | `git diff --name-only origin/rebuild/dotnet-platform...HEAD` | the same 5 files plus `docs/changes/GAP-09/` |
| Tester round 2 | read `test-report.md` round 2 | Finding 2 is corrected. The round-1 evidence still holds, because round 2 changed only a comment |

Round 1 checks that still hold:
- The gate self-test passed 86 of 86. No file it reads has changed since.
- The SHA check with `ls-remote` still holds.
- C-4 still holds: the red-first commit came before the edit.

### Definition of Done: open items

- **PR checks green on the final head, with run IDs:** open until the owner pushes `0e0a03f`, or the head that holds the committed records. This covers:
  - C-2: the CodeQL log must show `Download action repository 'github/codeql-action@9418214d…'`.
  - The pinned digest in the API and Studio service logs.
  - `10.0.404` and `v22.23.4` in the setup logs.
- **Records not committed yet:** `test-report.md` and this file are still uncommitted. They must be committed on `change/GAP-09` before the push.
- **G-15 status cell** in `ENGINEERING_STANDARDS.md:68`: changes after the merge.

### Draft pull request description (head `0e0a03f`)

The draft is the same as round 1 with two changes:
- The scope now notes that each of the three workflows has the pin comment.
- The evidence section names the head `0e0a03fe214f56856feb1edb262fad114ca49169` and lists D-1 as fixed in `df97f14`.

Here is the full text:

```markdown
## What and why

GAP-09 (G-15). Floating references (`@v4`, `mssql/server:2022-latest`, Node `22`,
.NET `10.0.x`) let what CI runs change without a commit. This change pins every
GitHub Action to a 40-character commit SHA with a `# vX.Y.Z` comment. It pins the
SQL Server service image to `2022-CU28-ubuntu-22.04@sha256:4525e3ef…7b7f`, Node to
`22.23.4`, and the .NET SDK to `10.0.404`. Each value is the one CI resolves
today, so behaviour does not change.

## Scope and boundaries

In scope: `.github/workflows/ci.yml`, `security.yml` and `codeql.yml`, each with a
short pin comment, plus the golden copies `.github/security/security.expected.yml`
and `semgrep-job.expected.yml`.
Out of scope: action major upgrades, `runs-on`, `python-version`, `global.json`,
the GAP-05 section-compare lines, the production SQL Server major (GAP-10), and
the G-15 status in `ENGINEERING_STANDARDS.md` (after the merge).

## Security impact

Supply chain only. A moved tag or image can no longer change CI without a
commit. No route, policy, data or secret changed.

## Tests and evidence

Head `0e0a03fe214f56856feb1edb262fad114ca49169`.
- P-1, no unpinned `uses:`: exit 1, no output.
- Each SHA checked against its tag with `git ls-remote` (codeql-action on the
  peeled `^{}` commit). The image digest checked against the MCR
  `Docker-Content-Digest`. Node and .NET checked against their release listings.
- Golden copy: `diff <(tr -d '\r' < security.yml) security.expected.yml`, exit 0.
- `node --test .github/security/gate.test.mjs`: exit 0, 86 of 86.
- Red first: `d8cc541` records P-1 to P-4 failing on the base, before `c8cd307`.
- Gate 2 finding D-1 (missing `codeql.yml` pin comment): fixed in `df97f14`.
- NOT RUN locally: `dotnet test`, the website and Studio suites, end-to-end,
  `self-test.sh` and gitleaks. No code changed. CI, Security, CodeQL and Workflow
  lint cover these on this PR. Run IDs: <fill in after the push>.

## Owner decisions

"GAP-09 pin every GitHub Action by 40-character SHA, the SQL Server image by
digest, and Node and .NET to exact versions" (owner, 19 November 2026, the
GAP-09 request).

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no route changed)
- [x] Tests exist for the behaviour changed (pin checks P-1 to P-5, red first; gate self-test 86/86)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author (plan-reviewer, tester, tech-lead gates)
- [x] Rollback is understood: revert this PR
- [x] Deployment note: nothing deploys; the owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- Node is pinned to 22.23.4, not 22.23.5, because 22.23.4 is what CI resolves today. A later bump under G-15.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated (G-15 status after the merge)
- [ ] `docs/deferred-items.md` updated for any exception (none)
- [x] Documentation updated (`docs/changes/GAP-09/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED
