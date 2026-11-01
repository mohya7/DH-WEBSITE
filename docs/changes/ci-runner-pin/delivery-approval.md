# Delivery approval: ci-runner-pin (gate 2)

Technical lead, 1 November 2026. Gate 2, the implementation and the tests.
Reviewed `change/ci-runner-pin` at head `eb076d4` (plan `74d722a`, change
`d9aa3f4`, implementation record `eb076d4`), plus the uncommitted
`test-report.md` (Round 1, `Verdict: APPROVED`), against `plan.md` (round 2),
`plan-review.md` (latest round `Verdict: APPROVED`) and `plan-approval.md`
(`Verdict: APPROVED`).

Read first: `docs/changes/README.md` and `.claude/agents/tech-lead.md` (PR #37
branch), `AGENTS.md`, `ENGINEERING_STANDARDS.md` and the pull request template
(from `origin/claude/cool-heisenberg-mh6zx9`), and every file in this folder.

This approval moves the change to the owner. It is not the owner's confirmation
that `AGENTS.md` requires, and it is not an owner decision.

## Decision

Approved for everything this container can prove. The diff is exactly the
approved plan, the local checks pass when I run them, and the tester's evidence
holds up. The change must not merge until the pull request's CI run on the final
head shows C1 to C4 and C6 as the plan defines them (open item 1).

## What I verified myself

**Base unchanged.** `git rev-parse origin/rebuild/dotnet-platform` and
`git ls-remote origin rebuild/dotnet-platform` both give
`6470fac3668aeeacabe4a47c39807d239ac33a09`, the commit the plan was cut from.

**The diff matches the plan, and nothing outside its scope changed.**

```
$ git diff --name-only origin/rebuild/dotnet-platform...HEAD
.github/workflows/ci.yml
docs/changes/ci-runner-pin/implementation.md
docs/changes/ci-runner-pin/plan-approval.md
docs/changes/ci-runner-pin/plan-review.md
docs/changes/ci-runner-pin/plan.md
```

`git diff origin/rebuild/dotnet-platform...HEAD -- .github/` is five hunks: a
four-line comment above `jobs:` and `runs-on: ubuntu-latest` →
`runs-on: ubuntu-24.04` in `api`, `website`, `studio`, `section-compare` and
`screenshot-parity`. Nothing else. That is Scope row 1 and approval condition 1.
The comment contains none of `node -e`, `python -c`, `python3 -c` or
`--input-type` (condition 3).

```
$ grep -n runs-on .github/workflows/*.yml
.github/workflows/ci.yml:43:    runs-on: ubuntu-24.04
.github/workflows/ci.yml:124:    runs-on: ubuntu-24.04
.github/workflows/ci.yml:179:    runs-on: ubuntu-24.04
.github/workflows/ci.yml:273:    runs-on: ubuntu-24.04
.github/workflows/ci.yml:338:    runs-on: ubuntu-24.04
.github/workflows/codeql.yml:33:    runs-on: ubuntu-latest
.github/workflows/security.yml:66:    runs-on: ubuntu-latest
...  (lines 80, 102, 122, 137, 160, all ubuntu-latest)
```

`security.yml`, `codeql.yml` and the golden copies are untouched, as the plan
says.

Parsed YAML, to rule out changes a line diff could hide:

```
$ ruby -ryaml -e 'a=YAML.load(`git show 6470fac:.github/workflows/ci.yml`); b=YAML.load_file(".github/workflows/ci.yml"); puts b["jobs"].map{|k,v| "#{k}=#{v["runs-on"]}"}.join(" "); a["jobs"].each{|k,v| v.delete("runs-on")}; b["jobs"].each{|k,v| v.delete("runs-on")}; puts(a==b ? "identical-except-runs-on" : "DIFFERENT")'
api=ubuntu-24.04 website=ubuntu-24.04 studio=ubuntu-24.04 section-compare=ubuntu-24.04 screenshot-parity=ubuntu-24.04
identical-except-runs-on
exit 0
```

**Gate self-test re-run** (the fastest suite that covers the change):

```
$ /opt/node22/bin/node --test .github/security/gate.test.mjs
# tests 62
# pass 62
# fail 0
exit 0
```

This matches the plan's baseline and the tester's run.

**Failing check first (B-6).** This is not a security fix and adds no test file.
The plan's failing check is T1 to T3. `implementation.md` records them before the
edit at `74d722a` (T1 `5`, T2 `0` exit 1) and after (T1 `0` exit 1, T2 `5`). The
tester re-ran both against `74d722a` and `eb076d4`. The fix commit `d9aa3f4`
comes after the plan commit `74d722a`. Condition 2 is met.

**Commits (B-4).**

| Commit | Subject | Body says why | Trailer |
| --- | --- | --- | --- |
| `74d722a` | `ci-runner-pin: Plan` | Yes | `Co-Authored-By` and `Claude-Session` |
| `d9aa3f4` | `ci-runner-pin: Pin every ci.yml job to ubuntu-24.04` | Yes: cites job 124875085547, the Playwright error, and reference job 118617022817 | Same |
| `eb076d4` | `ci-runner-pin: Add implementation record` | Yes | Same |

Each subject has the change id as prefix. The fix commit stages only
`ci.yml`, and the records commits stage only `docs/changes/ci-runner-pin/`, so no
two topics are mixed. `ci-runner-pin: Plan` reads as a noun rather than an
imperative. I accept it as the pipeline's convention for the records commit, and
it is not worth rewriting history for.

**The tester's evidence is real.** Each check in `test-report.md` is quoted with
its command, exit code and output. The ones I repeated (T4, T5, the parsed-YAML
equality, the gate self-test, the `runs-on` listing) give the same results. Its
extra checks go beyond the plan. Playwright 1.56.1's registry has
`ubuntu24.04-x64` builds for every browser `ci.yml` installs, and the API and
Website counts are the same on 24.04 and 26.04. They are consistent with the
plan's reasoning. Everything only CI can prove is written NOT RUN, and each one
names its CI job.

**Coverage table.** Every row in `test-report.md` has evidence or a NOT RUN that
names its CI job and pass bar:

| Item | Status at gate 2 | Evidence |
| --- | --- | --- |
| All five `ci.yml` jobs use `ubuntu-24.04` | Verified locally; `Image:` per job open (CI) | T1 to T3, Ruby parse, my `runs-on` listing |
| No other `.github/` line changes | Verified | `--name-only`, five hunks, parsed YAML identical |
| Studio: install succeeds, `26 passed`, 0 failed, 0 flaky | Open (CI, "Studio — typecheck, build, end-to-end") | Reference job 118617022817 line 3568 `26 passed (2.6m)` |
| Section comparison finishes on 24.04 | Open (CI, "Section comparison against feature/interviewer-portal") | Reference job 118617318962: `104/119 sections match; 14 accepted; 1 failures` |
| API and Website stay green | Open (CI, "API — …", "Website — …") | Reference 475/475; 379 passed, 31 skipped |
| Security gate self-test | Local verified (62/62, I re-ran it); CI open ("Security gate self-test") | Above |
| Screenshot parity (if labelled) | NOT RUN, accepted at gate 1 | Label-triggered, optional |

## Open items

1. **CI on the final head (blocks merge).** The branch is not pushed. No CI run
   exists for it (`git ls-remote` shows no `change/ci-runner-pin` on the
   remote). The final head will also be a later commit than `eb076d4`, because
   it adds `test-report.md` and this file. On that head's pull request run,
   whoever merges must read each job with
   `gh api repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs` and confirm:
   - C1 API: success, `Image: ubuntu-24.04`.
   - C2 Website: success, `Image: ubuntu-24.04`.
   - C3 Studio: "Install Playwright's Chromium" succeeds, then `26 passed` with
     0 failed and 0 flaky, quoted next to job 118617022817's line, with
     `Image: ubuntu-24.04`.
   - C4 Section comparison: the install step succeeds, the job succeeds, and the
     compare line equals `104/119 sections match; 14 accepted; 1 failures`
     (`/careers/apply.html #section`). A higher failure count fails this check.
   - C6 Security: "Security gate self-test" succeeds. "npm audit (website)" may
     be red, but only with the same three Next.js advisories as PR #37
     (`GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r`, `GHSA-673q-mjm6-r5xr`,
     GAP-01). A different set, or any other red job, blocks.

   If any check fails, the failure is reported before anyone fixes it, and the
   change goes back to the developer.
2. **Records still to commit.** `test-report.md` (uncommitted) and this file
   go in a records-only commit, with a `ci-runner-pin:` subject and the
   attribution trailer.
3. **Owner's confirmation.** `AGENTS.md` requires it before the merge. This
   approval does not replace it.
4. **Definition of Done boxes that cannot be ticked yet:** "PR checks are green
   on the final head" (item 1) and "Independent code review was run". This
   pipeline's plan review, test report and this gate are role reviews. If the
   owner wants `/code-review` or another agent's check under the rotation in
   `AGENTS.md`, it has not been run. The draft below leaves both unticked.
5. **Follow-ups, not part of this change:** upgrade Playwright to a release that
   supports Ubuntu 26.04 and re-baseline the screenshots, then move the image.
   Pin `security.yml` and `codeql.yml`, with both golden copies, under GAP-09.
   The Node 20 deprecation warning from the `@v4` actions also belongs to GAP-09.
   After this merges, PR #37 needs a fresh CI run.

## Draft pull request description

```markdown
## What and why

Pin every job in `.github/workflows/ci.yml` to `ubuntu-24.04` (change id `ci-runner-pin`; a CI breakage, not a refinement-plan item; related to GAP-09 without closing it).

GitHub moved `ubuntu-latest` to Ubuntu 26.04. Playwright 1.56.1 cannot install Chromium there, so "Studio — typecheck, build, end-to-end" and "Section comparison against feature/interviewer-portal" fail on every pull request at the browser install:

    Image: ubuntu-26.04
    Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.56.1!
    Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64

(job 124875085547 and job 124875337610, PR #37, a docs-only change). The same code was green on `ubuntu-24.04` at the base commit `6470fac` (run 39419624362, Studio job 118617022817: `26 passed (2.6m)`). This change puts all five jobs back on that OS release and adds a comment that explains why.

Records: `docs/changes/ci-runner-pin/` (plan, plan review, gate 1, implementation, test report, gate 2).

## Scope and boundaries

In scope: `.github/workflows/ci.yml`, five `runs-on` lines (`api`, `website`, `studio`, `section-compare`, `screenshot-parity`) and a four-line comment above `jobs:`.

Deliberately not touched: `security.yml`, `codeql.yml` and the golden copies `security.expected.yml` and `semgrep-job.expected.yml` (follow-up under GAP-09, in its own PR, B-8). Also not touched: every `uses: …@v4`, the SQL Server image, Node and .NET versions (GAP-09/GAP-10), the Playwright version and lockfiles (follow-up: upgrade, re-baseline screenshots, then move the image), and the existing `continue-on-error` (GAP-05).

## Security impact

None to the application. No route, policy, data, secret or package changes. `permissions: contents: read` is unchanged. Parsed YAML is identical to the base apart from `runs-on`. The label pins the OS release, not an image build.

## Tests and evidence

Local (Linux container):
- `grep -c "runs-on: ubuntu-latest" .github/workflows/ci.yml`: `5` before (at `74d722a`), `0` after, exit 1.
- `grep -c "runs-on: ubuntu-24.04" .github/workflows/ci.yml`: `0` before (exit 1), `5` after.
- `git diff --stat origin/rebuild/dotnet-platform -- .github/`: only `ci.yml`, 9+/5−.
- Parsed-YAML comparison against `6470fac`: `identical-except-runs-on`, exit 0.
- `/opt/node22/bin/node --test .github/security/gate.test.mjs`: `# tests 62`, `# pass 62`, `# fail 0`, exit 0.
- `actionlint`: NOT RUN, not installed (GAP-08). Covered by GitHub's workflow parse.

CI on this PR (fill in run and job ids):
- API: success, `Image: ubuntu-24.04`. Run <id>, job <id>.
- Website: success, `Image: ubuntu-24.04`. Job <id>.
- Studio: Chromium install succeeds; `26 passed` with 0 failed and 0 flaky (reference job 118617022817: `26 passed (2.6m)`); `Image: ubuntu-24.04`. Job <id>.
- Section comparison: install succeeds, job succeeds, `104/119 sections match; 14 accepted; 1 failures` (same as reference job 118617318962). Job <id>.
- Security gate self-test: success. Job <id>. "npm audit (website)" is red with the same three Next.js advisories as PR #37 (`GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r`, `GHSA-673q-mjm6-r5xr`), GAP-01, not caused by this change.
- Screenshot parity: NOT RUN, optional and runs only with the `screenshots` label.

## Owner decisions

"ok solve the issue" (Mohamed Elbadry, 1 November 2026, project thread), answering: "GitHub has moved ubuntu-latest to Ubuntu 26.04, and Playwright 1.56.1 can't install Chromium there, so every PR's Studio end-to-end job will fail until it's fixed. The fix is to pin ci.yml to ubuntu-24.04. Shall I make that a separate small change through the new pipeline?"

No exception is taken; no D-NNN entry.

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such) — local criteria met; CI criteria C1 to C4 and C6 are proved by this PR's run
- [x] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [x] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [x] Every new or changed route has a guard and, when it carries a record id, a record scope — no route changed
- [x] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test — the behaviour is the CI run itself; no application code or security fix
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [x] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed — plan review, test report and two tech-lead gates in `docs/changes/ci-runner-pin/`
- [x] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback) — revert; the Playwright jobs then fail again on 26.04
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded — nothing deploys; integrator <name> merges into `rebuild/dotnet-platform` and re-runs the suites after the merge

## Review findings accepted

- Plan review Round 1, two findings (end-to-end count, image version): both fixed in plan round 2.
- Test report Round 1: no findings.
- Gate 2: the subject `ci-runner-pin: Plan` is a noun rather than an imperative. Accepted as the records-commit convention.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated — not applicable; the coverage table is in `docs/changes/ci-runner-pin/`
- [ ] `docs/deferred-items.md` updated for any exception — not applicable; no exception
- [x] Documentation updated — the reason comment in `ci.yml` and the change records
```

Verdict: APPROVED
