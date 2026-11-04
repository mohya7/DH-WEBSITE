# Test report: ci-runner-pin

Tester (senior tester and security engineer), 1 November 2026.

## Round 1

**Commit tested:** `eb076d450ed3e1eb7ab6d2774b1dcad0295b14fd` (head of
`change/ci-runner-pin`; plan commit `74d722a`, change commit `d9aa3f4`,
records commit `eb076d4`), on a detached worktree
`/home/user/dh-ci-runner-pin-test`, removed afterwards. Base `6470fac`, which is
still the tip of `origin/rebuild/dotnet-platform`
(`git ls-remote origin rebuild/dotnet-platform` → `6470fac3668a…`).

Read: `docs/changes/README.md` and `.claude/agents/tester.md` (PR #37 branch),
`AGENTS.md`, and `plan.md` (round 2), `plan-review.md`, `plan-approval.md`,
`implementation.md` in this folder.

Environment: Linux cloud container, Node 22 at `/opt/node22/bin`, Ruby present,
no SQL Server, no GitHub Actions runner. The branch has not been pushed yet
(`gh api "repos/mohya7/DH-WEBSITE/actions/runs?branch=change/ci-runner-pin" --jq .total_count`
→ `0`), so no CI run of this change exists to read.

### 1. Failing check first (red at `74d722a`, green at `eb076d4`)

There is no red-test commit; the plan's failing check is T1 to T3 (approval
condition 2). Run against `git show 74d722a:.github/workflows/ci.yml` and then the
head:

| # | Command | At `74d722a` | At `eb076d4` |
| --- | --- | --- | --- |
| T1 | `grep -c "runs-on: ubuntu-latest" .github/workflows/ci.yml` | `5`, exit 0 | `0`, exit 1 |
| T2 | `grep -c "runs-on: ubuntu-24.04" .github/workflows/ci.yml` | `0`, exit 1 | `5`, exit 0 |
| T3 | `grep -n "runs-on" .github/workflows/ci.yml` | (5 × `ubuntu-latest`, per implementation.md) | `43`, `124`, `179`, `273`, `338`, all `runs-on: ubuntu-24.04`, exit 0 |

Red for the reason the plan gives (all five floating), green on the head.

### 2. Test plan, every local command

```
$ git diff --stat 6470fac -- .github/                                # T4
 .github/workflows/ci.yml | 14 +++++++++-----
 1 file changed, 9 insertions(+), 5 deletions(-)
exit 0
$ git diff --stat origin/rebuild/dotnet-platform -- .github/         # T4 as written
 .github/workflows/ci.yml | 14 +++++++++-----
exit 0
$ git diff -U0 6470fac -- .github/workflows/ci.yml | grep '^[-+]' | grep -v '^+++\|^---'   # T5
+# Every job runs on ubuntu-24.04, not ubuntu-latest. ubuntu-latest moved to Ubuntu 26.04,
+# where Playwright 1.56.1 cannot install its browsers, so the end-to-end and comparison jobs fail.
+# Moving to a newer image means upgrading Playwright and re-baselining the screenshots in the
+# same change.
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-24.04
   (the last two lines four more times; nothing else)
```

Parsed-YAML equality, beyond a line diff (proves no value other than `runs-on`
changed, including inside folded scalars):

```
$ ruby -ryaml -e 'a=YAML.load(`git show 6470fac:.github/workflows/ci.yml`); b=YAML.load_file(".github/workflows/ci.yml"); a["jobs"].each{|k,v| v.delete("runs-on")}; b["jobs"].each{|k,v| v.delete("runs-on")}; puts(a==b ? "parsed-identical-except-runs-on" : "DIFFERENT")'
parsed-identical-except-runs-on
```

YAML parse (plan, local checks):

```
$ ruby -ryaml -e 'd=YAML.load_file(".github/workflows/ci.yml"); puts d["jobs"].map{|k,v| "#{k}=#{v["runs-on"]}"}.join(" "); p d["permissions"]'
api=ubuntu-24.04 website=ubuntu-24.04 studio=ubuntu-24.04 section-compare=ubuntu-24.04 screenshot-parity=ubuntu-24.04
{"contents"=>"read"}
exit 0
```

Comment check (approval condition 3):

```
$ sed -n 36,40p .github/workflows/ci.yml | grep -nE "node -e|python3? -c|--input-type"
(no output)
exit 1
```

Security gate self-test:

```
$ /opt/node22/bin/node --test .github/security/gate.test.mjs
# tests 62
# pass 62
# fail 0
exit 0
```

Line endings: `file .github/workflows/ci.yml` → `Unicode text, UTF-8 text`;
`grep -c $'\r'` → `0`.

`actionlint`: NOT RUN, not installed (`which actionlint` finds nothing; GAP-08).
Covered by GitHub's own workflow parse when the PR's CI starts.

The `dotnet test`, `npm test`, `typecheck`, `build`, `design:check`,
`compare:sections` and `test:e2e` commands of the role's standard list: NOT RUN
here. This change touches no source, test, package or lockfile
(`git diff --quiet 6470fac -- website/package*.json studio/package*.json` → exit 0),
and the plan places their proof on the PR's CI (C1 to C5). No SQL Server here.

### 3. CI checks (C1 to C6): NOT RUN

Only GitHub Actions can prove these, and the branch has no CI run yet. Gate 2 /
the orchestrator must read them from the PR run with
`gh api repos/mohya7/DH-WEBSITE/actions/jobs/<id>/logs`.

| # | Job | Pass bar | Reference on 24.04 at `6470fac` (run 39419624362) |
| --- | --- | --- | --- |
| C1 | API — Release build, migrations, integration tests | success, `Image: ubuntu-24.04` | job 118617023321: `Image: ubuntu-24.04`, `Total tests: 475`, `Passed: 475` |
| C2 | Website — typecheck, tests, design check, snapshot build | success, `Image: ubuntu-24.04` | job 118617023300: `Test Files 20 passed \| 1 skipped (21)`, `Tests 379 passed \| 31 skipped (410)` |
| C3 | Studio — typecheck, build, end-to-end | install step succeeds, `26 passed`, 0 failed, 0 flaky, `Image: ubuntu-24.04` | job 118617022817 line 3568: `26 passed (2.6m)` |
| C4 | Section comparison against feature/interviewer-portal | install step succeeds, job success, compare result equal to reference | job 118617318962 line 537: `104/119 sections match; 14 accepted; 1 failures (including chrome).` (`differs: /careers/apply.html #section`); the compare step itself exits 1 (line 591) and is absorbed by `continue-on-error` |
| C5 | Screenshot parity (optional, label "screenshots") | NOT RUN unless labelled (accepted at gate 2 by plan-approval.md) | last non-skipped run, job 117987303956 (19 Oct): `Image: ubuntu-24.04`, Firefox 142.0.1 and WebKit 26.0 downloaded, job success |
| C6 | Security → Security gate self-test | success | passes locally, 62 of 62 |

### 4. Beyond the plan

**Is 24.04 actually supported by Playwright 1.56.1, for every browser `ci.yml`
installs?** Yes. `npm pack playwright-core@1.56.1`, unpacked in its own
directory: `lib/server/registry/index.js` has `ubuntu24.04-x64` download paths for
chromium (line 116), chromium headless shell (147), firefox (240,
`firefox-ubuntu-24.04.zip`), webkit (302, `webkit-ubuntu-24.04.zip`) and ffmpeg
(333); `nativeDeps.js` has an `ubuntu24.04-x64` entry (line 458) with chromium,
firefox and webkit dependency lists, which is what `--with-deps` installs. There
is no `ubuntu26` entry in either file, which matches the failure on PR #37
(`BEWARE: your OS is not officially supported … Cannot install dependencies for
ubuntu26.04-x64 with Playwright 1.56.1!`).

**Other OS-dependent steps in `ci.yml`.**
- The only `apt-get` is the `mssql-tools18 unixodbc-dev` fallback in the Studio
  job (lines 244 to 247). The 24.04 image does not ship `/opt/mssql-tools18`, so
  the fallback runs every time. Reference job 118617022817 shows it succeeding
  from `https://packages.microsoft.com/ubuntu/24.04/prod noble/main amd64
  mssql-tools18 amd64 18.7.1.1-1` (line 458). On 26.04 it used
  `packages.microsoft.com/ubuntu/26.04/prod resolute` (job 124875085547, line 476),
  so pinning moves this back to the repository that worked on 20 October.
- The SQL Server service containers (`mcr.microsoft.com/mssql/server:2022-latest`)
  and their health commands run `/opt/mssql-tools18` inside the container image,
  so they do not depend on the host OS release. The `docker create` line works on
  both images (reference line 70; API job green on 26.04).
- `actions/setup-node@v4` and `actions/setup-dotnet@v4` download toolchains per
  OS release; both worked on 24.04 at the base commit.
- `sudo`, `$GITHUB_PATH`, `$RUNNER_TEMP`: standard on all hosted Ubuntu images.

**Did the 26.04 move affect the jobs that passed?** Compared the PR #37 run on
26.04 with the base run on 24.04: API `Total tests: 475`, `Passed: 475` on both,
27 `##[warning]` lines on both (the same CS8601/CS8604 build warnings). Website
`Tests 379 passed | 31 skipped (410)` on both, and the design check prints the
same `identical … 881cc633…` hashes. Nothing in the passing jobs changed, so
moving them back to 24.04 restores, not alters, their results. The Website job's
built site (`website-out`) is consumed by the comparison jobs; with all five
pinned, build and comparison run on the same release again.

**Other workflows.** `security.yml` (6 × `runs-on: ubuntu-latest`) and
`codeql.yml` (1) are untouched and stay on `ubuntu-latest`, as the plan's scope
says. They do not install Playwright, and every Security job but the npm audit
(website) one passed on 26.04 in run 41315679989.

**Golden copies untouched.**
`git diff --quiet 6470fac -- .github/workflows/security.yml .github/workflows/codeql.yml .github/security/ .github/dependabot.yml`
→ exit 0. `security.expected.yml` and `semgrep-job.expected.yml` still carry
`runs-on: ubuntu-latest` (6 and 1), matching `security.yml`.

### 5. Security

- **Permissions block unchanged.** Parsed `permissions` is `{"contents"=>"read"}`;
  the parsed-YAML equality above proves no `permissions`, `env`, `concurrency`,
  `on`, `services`, `uses` or step changed.
- **No secret in the diff.**
  `git diff 6470fac eb076d4 | grep -iE "^\+.*(ghp_|github_pat_|AKIA|BEGIN .*PRIVATE|password *[:=]|secret *[:=]|token *[:=])"`
  → no output, exit 1. The added lines are four comment lines and five
  `runs-on` values. The existing workflow-only SQL Server passwords and the CI
  signing key are unchanged context lines, already documented in the file header
  as throwaway values.
- **gitleaks, Semgrep:** NOT RUN, not installed (`which gitleaks semgrep` finds
  nothing). Covered by `security.yml` jobs "Secret scan (gitleaks, this pull
  request's commits)", "Secret scan (gitleaks, full history)" and "Semgrep (ERROR
  fails, WARNING reported)".
- **`run-dotnet-audit.sh`:** NOT RUN, no NuGet change, no .NET SDK of
  consequence here. Covered by "NuGet vulnerable packages (api) — High and
  Critical".
- **npm audit, full tree** (`npm audit --audit-level=high`, exit 1 in both):
  website `high 4, critical 1` (`next` critical; `sharp`, `source-map-js`,
  `undici`, `vite` high); studio `high 3, critical 0` (`source-map-js`, `undici`,
  `vite`). Pre-existing: no package or lockfile changed.
- **`run-npm-audit.sh`** (the gate, `--omit=dev`):
  `website: 6 finding(s) at the gate's level; 3 known, 3 new.` with the new ones
  `GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r`, `GHSA-673q-mjm6-r5xr` (next);
  `studio: 0 finding(s) at the gate's level; 0 known, 0 new.` The PR #37 Security
  job 124875181438 printed the same `website: 6 finding(s) at the gate's level;
  3 known, 3 new.` So this is the same advisory set already red on PR #37
  (GAP-01), not caused by this change; per plan-approval.md it does not block.
- Routes, roles, host checks, body limits, error shapes: not applicable; no
  application code changed.

### 6. Track checklist, G1 Waves 1 to 3

| Check | Result |
| --- | --- |
| One gate per pull request (B-8) | Yes. No gate added; one input pinned |
| New gate reports 7 days, then blocks | Not applicable, no new gate |
| Canary fixture per gate (GAP-21) | Not applicable, no new gate |
| Actions by SHA, SQL image by digest, Node/.NET exact | Not changed, still open (GAP-09/GAP-10): `uses: …@v4`, `2022-latest`, `NODE_VERSION: "22"`, `10.0.x` unchanged, as the plan states |
| Baselines only shrink | No baseline touched (`known-findings.json` unchanged) |

### Findings

No Blocker, no Major, no Minor against the change.

Notes for gate 2 (not defects of this change):

1. **Security workflow will be red on this PR** at "npm audit (website) — High
   and Critical", with the same 3 new Next.js advisories as PR #37
   (`GHSA-2464-fhr4-w9xw`, `GHSA-p3m5-59mp-jv5r`, `GHSA-673q-mjm6-r5xr`). GAP-01.
   A different advisory set, or any failure in the gate self-test, would block.
2. **C4's "matches the last green run"** means the reference
   `104/119 sections match; 14 accepted; 1 failures` (`/careers/apply.html
   #section`); a green job with that same line is a pass, a larger failure count
   is not.
3. **The pin is the OS release, not an image build**, and the Studio job's
   `mssql-tools18` apt fallback runs on every 24.04 run, so it depends on
   `packages.microsoft.com/ubuntu/24.04`. Both already recorded in the plan's
   risks; no action here.
4. Every job on 26.04 printed `Node.js 20 is deprecated … actions/checkout@v4,
   actions/setup-node@v4 …`. This is from the actions, not the image; GAP-09
   territory.

### Coverage rows verified

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| All five `ci.yml` jobs use `runs-on: ubuntu-24.04` | Owner, 1 Nov 2026 | Verified locally | T1 `0`/T2 `5`/T3 five lines at `eb076d4`; red at `74d722a`; Ruby parse lists all five as `ubuntu-24.04`. `Image:` per job: CI (C1 to C4) NOT RUN |
| No other line of `.github/` changes, apart from the reason comment | Plan, Scope | Verified | T4 only `ci.yml` 9+/5−; T5 hunks; parsed YAML identical except `runs-on`; security/codeql/golden/dependabot diff exit 0 |
| Studio job installs Chromium and end-to-end reports 26 passed, 0 failed, 0 flaky on 24.04 | Owner; jobs 124875085547, 118617022817 | NOT RUN (CI, "Studio — typecheck, build, end-to-end") | Playwright 1.56.1 has `ubuntu24.04-x64` chromium build and native deps; reference `26 passed (2.6m)` |
| Section comparison installs Chromium and finishes on 24.04 | Owner; job 124875337610 | NOT RUN (CI, "Section comparison against feature/interviewer-portal") | Reference job 118617318962 on 24.04: success, `104/119 … 1 failures` |
| API and Website jobs stay green on 24.04 | Plan, Done when 3 | NOT RUN (CI, "API — …", "Website — …") | Same counts on 24.04 and 26.04 (475/475; 379 passed, 31 skipped) |
| Security gate self-test passes, 62 of 62 locally and green in CI | Plan, Done when 3 | Local verified; CI NOT RUN ("Security gate self-test") | `node --test .github/security/gate.test.mjs`: 62 pass, 0 fail, exit 0 |
| Screenshot parity on 24.04 (only if labelled) | Plan, C5 | NOT RUN (label-triggered, "Screenshot parity (optional, label \"screenshots\")") | 1.56.1 has `ubuntu24.04-x64` firefox and webkit builds; job 117987303956 succeeded on 24.04 on 19 Oct |

Every check that can run in this container passes, and nothing found is Blocker
or Major. The approval is for the local scope; gate 2 must still read C1 to C4 and
C6 from the pull request's CI run before merging.

Verdict: APPROVED
