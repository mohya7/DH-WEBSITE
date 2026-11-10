# GAP-08: add actionlint (plan review)

Role: plan-reviewer (step 2). Branch `change/GAP-08`, worktree
`/home/user/wt-GAP-08`, base `6470fac`. Date 2026-11-01. Governing documents
read from the read-only copies supplied outside the repository (they are not on
the base, as the plan says): `docs/changes/README.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `ENVIRONMENT.md`.

## Round 1

### Findings

No Blockers. No Majors.

**1. Minor, section 3 "Report week".** The plan sets two bounds on
`ACTIONLINT_BLOCKING_FROM`: at least seven days after merge, and never after
2026-11-23. If the pull request merges after 16 November the two cannot both
hold, and the plan does not say what happens then. Evidence: refinement plan,
line 150, "each new gate blocking from its own date (the last on 23 November)";
standard, section 3, "A new gate reports for seven days from its merge". What
would satisfy me: one sentence saying that if the merge slips past 16 November
the developer stops and the change is BLOCKED ON OWNER (a schedule exception is
the owner's under P-7), rather than either bound being dropped silently.

**2. Minor, section 5, case 17.** Section 3 states the workflow has no `if:` on
the job or any step and no `paths:` filter on its triggers (both matter: either
can make the check skip, and a skipped check passes). Case 17 checks only the
date, `continue-on-error` and SHA pins. What would satisfy me: case 17 also
asserts no `if:` key and no `paths:`/`paths-ignore:` key in
`workflow-lint.yml`.

**3. Minor, section 10, "Merge order with GAP-09".** The plan says "GAP-09's
architect is told in this plan", but GAP-09's architect will not read GAP-08's
plan. What would satisfy me: the canary's header comment states that `@v4` is
deliberate and that SHA-pin checks must be scoped to `.github/workflows/`, so
the warning travels with the file; and the GAP-08 pull request description
repeats it.

### Checked and found sound

Each run here, in `/home/user/wt-GAP-08` or a scratch folder
`/tmp/claude-0/-home-user-DH-WEBSITE/7aefdfd4-6aa9-5555-b0de-70990eb7693f/scratchpad/rev-gap08-dl`.

- **Fit.** The register row (refinement plan line 72), the Wave 1 "Done when"
  (line 158, "0 findings across all workflows"), G-13 (standard line 66) and
  section 3 of the standard are quoted word for word.
- **actionlint 1.7.12.** Go proxy `@latest` returns `v1.7.12`, hash
  `914e7df2…`. Release tarball and `checksums.txt` downloaded (exit 0);
  `echo "8aca8db9…a3d8  actionlint_1.7.12_linux_amd64.tar.gz" | sha256sum --check --strict`
  → `OK`, exit 0; the line matches the release `checksums.txt`.
  `actionlint -version` → `1.7.12`. `api.github.com` → HTTP 403, as stated.
- **shellcheck 0.11.0.** Release tarball sha256 check against `8c3be12b…7198`
  → `OK`, exit 0; extracted binary sha256 `4da528dd…a55b`, as the plan quotes;
  `--version` → `0.11.0`. (PyPI cross-check not repeated; the release pin
  alone is what CI uses.)
- **0 findings today.** `actionlint -no-color -shellcheck=<0.11.0> -pyflakes=`
  → no output, exit 0; `-verbose` shows "Collected 3 YAML files … Found 0
  errors in 3 files" (`ci.yml`, `security.yml`, `codeql.yml`). With
  `-shellcheck=` also exit 0. PR #38's `ci.yml` (`b472fe5`, the only `.github`
  change on that branch) linted alone → exit 0.
- **Canary.** Fixture extracted from the plan; lines 11 to 20 match its
  comments. With the plan's `line:col:kind` template the output is exactly the
  six lines of `canary.expected`, exit 1. With `-shellcheck=/nonexistent` the
  `20:9:shellcheck` line disappears and nothing else reports it, exit 1: the
  silent-drop claim is true, and the canary catches it.
- **Exit codes.** `-bogusflag` → 2; bad `-format` template → 3. Also observed:
  actionlint run with no file arguments outside a git checkout fails with "no
  project was found", exit 3, which the plan's "any other exit fails" rule
  already turns into a failed gate rather than a silent pass.
- **checkout pin.** `git ls-remote https://github.com/actions/checkout` →
  `11d5960a326750d5838078e36cf38b85af677262 refs/tags/v4.4.0`, newest v4 tag.
- **Install model.** `.github/security/install-gitleaks.sh` is as described
  (`curl -sSfL`, `sha256sum --check --strict`, extract one binary); the plan
  copies it.
- **No collision with the security gate.** `shellPinProblems` (line 931) reads
  only `.github/security/*.sh`; `inlineInterpreterProblems` (line 1081) reads
  every `*.yml` in `.github/workflows/`, so the new workflow is covered and
  must avoid inline node/python, as the plan says. No test enumerates workflow
  files. `node --test .github/security/gate.test.mjs` → 62 tests, 62 pass,
  0 fail.
- **Scope (B-8).** One gate; only new files under `.github/lint/`, one new
  workflow and `docs/changes/GAP-08/`. `ci.yml`, `security.yml`, `codeql.yml`,
  `.github/security/`, `dependabot.yml` untouched. Dependabot's
  `github-actions` entry (directory `/`) covers `.github/workflows/` and does
  not see the canary under `.github/lint/`. No `actionlint.yaml` exists today.
- **Alternatives** are real (ci.yml/PR #38 conflict, security.yml golden copies,
  Docker/marketplace action, `go install`, runner shellcheck, blocking at once).
- **Testability.** Self-test and canary are committed first and fail while
  `run-actionlint.sh` is missing; 17 cases cover every rule in section 3 except
  the two noted in finding 2; stubs on `PATH` avoid any test-only switch in the
  gate. Release/.NET rules do not apply (no .NET change); suites not run are
  marked NOT RUN with the CI job that covers them.
- **Quality gates (P-6).** Nothing weakened; no ignore list, no config file,
  baseline 0; report week via `ACTIONLINT_BLOCKING_FROM`; canary always
  blocking; tools pinned by version and sha256 (G-15); runner `ubuntu-24.04`.
- **Security.** `permissions: contents: read`, `persist-credentials: false`,
  no secrets, no routes, no migrations.
- **Owner decisions.** None needed; the plan quotes the owner exactly ("Start
  waves 0 & 1 and update me with each gap done", 2026-11-01) and claims no
  exception. The required-status-check step is correctly left to GAP-03/O-9.
- **Rollback and risks** are specific and each has a named check.

Verdict: APPROVED
