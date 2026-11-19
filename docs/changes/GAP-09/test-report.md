# Test report: GAP-09

## Round 1

Tester, 19 November 2026. Commit tested: `89f0aec7664b7096918c5fc98f5c3af278c68c93`
on `change/GAP-09`, on a detached worktree `dh-platform-claude-gap-09-test`. The worktree has since been removed.
Red-record commit `d8cc541`, edit commit `c8cd307`, base `8b5d6a5`. Nothing is pushed.

Owner's request: "GAP-09 pin every GitHub Action by 40-character SHA, the SQL Server
image by digest, and Node and .NET to exact versions".

### Red on the base

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Base unpinned | `git show d8cc541:.github/workflows/ci.yml \| grep -cE 'uses: .*@v[0-9]+\s*$'` | 0 | `21` |
| Base image/versions | `git show d8cc541:.github/workflows/ci.yml \| grep -nE 'image:\|dotnet-version\|NODE_VERSION:'` | 0 | `NODE_VERSION: "22"`, `mssql/server:2022-latest` (46, 199), `dotnet-version: "10.0.x"` (74, 249) |
| Red commit is docs only | `git diff --stat 8b5d6a5 d8cc541` | 0 | 4 files, all under `docs/changes/GAP-09/` |

### Green on the head

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| P-1 | `grep -nE '^\s*-?\s*uses:' .github/workflows/*.yml .github/security/*.yml \| grep -vE '@[0-9a-f]{40}( \|$)'` | 1 | no output |
| Pins by ref | `grep -hoE 'uses: \S+ # \S+' ... \| sort \| uniq -c` | 0 | checkout 23, setup-node 13, upload-artifact 12, setup-dotnet 5, setup-python 3, download-artifact 2, codeql init 1, analyze 1. Every SHA is the same for each tag |
| P-2 | `grep -n 'image:' .github/workflows/*.yml` | 0 | `ci.yml:49` and `:202` are `mcr.microsoft.com/mssql/server:2022-CU28-ubuntu-22.04@sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f` |
| P-3 / P-4 | `grep -rnE 'node-version\|NODE_VERSION:\|dotnet-version' .github` | 0 | `NODE_VERSION: "22.23.4"` (ci 33, security 64, expected 64). Every `node-version` reads `env.NODE_VERSION`. `dotnet-version: "10.0.404"` at ci 77 and 252, codeql 51, security 117, expected 117 |
| Diff contains only pin lines | `git diff 8b5d6a5 HEAD -- .github \| grep '^[-+]' \| grep -vE 'uses:\|image:\|NODE_VERSION\|dotnet-version\|^\+\s*#'` | 1 | no output |
| Gate self-test | `node --test .github/security/gate.test.mjs` | 0 | `tests 86`, `pass 86`, `fail 0` |

### Independent verification (security)

| Item | Command | Result |
| --- | --- | --- |
| Action SHAs | `git ls-remote --tags https://github.com/<repo> refs/tags/<tag> 'refs/tags/<tag>^{}'` for all 7 repos | All exit 0. Every SHA in use matches its tag: checkout v4.4.0 `11d5960a…7262`, setup-node v4.4.0 `49933ea5…0020`, setup-dotnet v4.3.1 `67a3573c…3ce9`, upload-artifact v4.6.2 `ea165f8d…fa02`, download-artifact v4.3.0 `d3f86a10…8093`, setup-python v5.6.0 `a26af69b…7065`. codeql-action v3.39.3 is an annotated tag (`096a89ea…`), and the pin uses the peeled commit `9418214d…b6b9`, which is correct |
| Image digest | `curl -sI -H 'Accept: <OCI/docker manifest types>' https://mcr.microsoft.com/v2/mssql/server/manifests/2022-CU28-ubuntu-22.04` | `200`, `Docker-Content-Digest: sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f`, so the digest matches the tag. A GET by digest also returns 200 |
| Node exists | `curl -s https://nodejs.org/dist/index.json`; `curl -sI https://nodejs.org/dist/v22.23.4/` | v22.23.4 is listed, 200. v22.23.5 also exists (see the Minor finding) |
| .NET SDK exists | `curl -s https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json` | `10.0.404` is listed |
| No new secret | review of the `.github` diff (filtered above) | No `+` line other than pins and comments. The `CiOnly…` passwords are already on the base and the diff does not touch them |
| npm audit (full tree) | `npm ci && npm audit --audit-level=high` in `website/` and `studio/` | exit 0, exit 0 |
| Semgrep | `RUNNER_TEMP=<tmp> bash .github/security/run-semgrep.sh` | exit 0, `1 known, 0 new` |
| run-npm-audit.sh | `RUNNER_TEMP=<tmp> bash .github/security/run-npm-audit.sh website` (and `studio`) | exit 1 with a Node v24.19.0 stack trace, an environment failure on this machine (CI uses the pinned Node 22). The plain `npm audit` above passes. Covered by Security job `npm audit` |
| gitleaks | not installed | NOT RUN. Covered by `security.yml` job `gitleaks` |
| run-dotnet-audit.sh | no `.csproj`/lockfile change | NOT RUN, not relevant. Covered by `security.yml` job `dotnet audit` |
| Role matrix, host checks, body caps, RFC 7807 | no route changed | Not applicable |

### Conditions

| Condition | Verified | Evidence |
| --- | --- | --- |
| C-1 golden copy, own line endings | Yes | `diff <(tr -d '\r' < security.yml) security.expected.yml` exit 0. `file`: workflows CRLF, `*.expected.yml` LF |
| C-2 CodeQL download line | Pending CI | Not pushed. Pin is `github/codeql-action/{init,analyze}@9418214df1f2c4b8128c770156c409013b07d6b9`. The log line must be checked on the PR run |
| C-3 GAP-05 lines untouched | Yes | `diff <(base ci.yml 291-296,326,398) <(head 294-299,329,401)` with CR stripped: exit 0. `git diff -U0 … ci.yml \| grep -c continue-on-error` = `0` |
| C-4 red before edit | Yes | `d8cc541` is docs only and comes before `c8cd307`. P-1 to P-5 are recorded |
| C-5 scope | Yes | `git diff --name-only 8b5d6a5..HEAD`: the 5 planned files plus `docs/changes/GAP-09/*`. No `runs-on`, `python-version`, `global.json` or standards edit (filtered diff is empty) |
| C-6 subjects/trailers | Yes | All 4 commits are `GAP-09: …` with a `Co-Authored-By` trailer |

### NOT RUN

- `dotnet test -c Release`, website/studio `npm test`, `typecheck`, `build`, `design:check`, `compare:sections`, studio `test:e2e`. No code changed (workflow inputs only), and the plan names CI as the evidence. Covered by `ci.yml` jobs API, Website, Studio and section compare, pending the owner's push.
- `bash .github/lint/self-test.sh`. It fails 5 cases on the base on this machine (per the plan). Covered by Workflow lint "actionlint (every workflow)".
- CI evidence (pinned digest, `10.0.404` and `v22.23.4` in the logs, CodeQL green): pending the owner's push.

### Findings

1. **Minor**: Node 22.23.4 is not the latest 22.23 patch.
   - Steps: `curl -s https://nodejs.org/dist/index.json | grep v22.23`.
   - Expected: the pin is the newest patch, or the choice is recorded.
   - Actual: v22.23.5 exists. The plan pins 22.23.4 because that is what CI resolves today. This meets the request. Moving to a newer patch is a later bump; a Renovate/Dependabot follow-up under G-15 would cover it.
2. **Withdrawn in round 2 (incorrect).** This round said the `codeql.yml` pin comment
   was present above `jobs:`. It was not: `git show 89f0aec:.github/workflows/codeql.yml | grep -c Pinned`
   prints `0`. I did not check the file and relied on `implementation.md`. Gate 2 raised
   the gap as D-1. The correct round-1 finding was **Minor: the pin comment is missing
   in `codeql.yml`, against plan 3.5**.

No Blocker or Major.

### Coverage rows verified

| Item | Status | Evidence |
| --- | --- | --- |
| Every `uses:` in ci/security/golden/codeql names a 40-character SHA | Verified | P-1 exit 1 |
| Each SHA is the tag's commit | Verified | independent `git ls-remote`, codeql on `^{}` |
| SQL Server image has `@sha256:` in both jobs, and it matches the tag | Verified | P-2; MCR `Docker-Content-Digest` |
| `node-version` exact | Verified | `22.23.4`, exists on nodejs.org |
| `dotnet-version` exact | Verified | `10.0.404`, in release metadata |
| Golden copies match, gate self-test | Verified locally | 86/86; diff empty |
| GAP-05 lines unchanged | Verified | C-3 diff exit 0 |
| CI, Security, CodeQL, Workflow lint green on PR head | Pending CI | not pushed |

Round 1 result (superseded by round 2): approved, with finding 2 corrected above.

## Round 2

Tester, 19 November 2026. Commit tested: `0e0a03f` (fix `df97f14`, record `0e0a03f`), on a
new detached worktree `dh-platform-claude-gap-09-test`, removed afterwards. This round re-tests gate-2 finding D-1.

| Check | Command | Exit | Output |
| --- | --- | --- | --- |
| Files since round 1 | `git diff --name-only 89f0aec HEAD` | 0 | `.github/workflows/codeql.yml`, `docs/changes/GAP-09/implementation.md` |
| D-1 diff | `git diff 89f0aec HEAD -- .github` | 0 | Only 3 added comment lines, `# Pinned (G-15, GAP-09): …`, at `codeql.yml:29-31`, directly above `jobs:` (line 32). Nothing removed |
| Same text as ci.yml | `diff <(tr -d '' < ci.yml \| grep -A2 '^# Pinned') <(… codeql.yml …)` | 0 | identical |
| No forbidden tokens in comment | inspection | - | no `node -e`, `python -c` or `--input-type` |
| Line endings | `grep -c $'$' codeql.yml` on checkout and blob | 0 | No CR in the file. All 67 lines are LF, so the file is consistent (not mixed) |
| P-1 | unpinned `uses:` grep | 1 | no output |
| Pins/image/versions | `grep -rnE 'image:.*@sha256\|NODE_VERSION:\|dotnet-version' .github \| wc -l` | 0 | `10`, same as round 1 |
| C-1 | `diff <(tr -d '' < security.yml) security.expected.yml` | 0 | empty |
| Gate self-test | `node --test .github/security/gate.test.mjs` | 0 | `pass 86`, `fail 0` |
| C-5 scope | `git diff --name-only 8b5d6a5..HEAD \| grep -v docs/` | 0 | the 5 planned files only |
| C-6 | `git log 89f0aec..HEAD` | 0 | both commits are `GAP-09: …` with a `Co-Authored-By` trailer |

The round-1 checks of SHAs, digest, versions, npm audit and Semgrep stand. Round 2
changed only one comment and one doc, so none of them can be affected. NOT RUN items and
pending CI (including C-2) are as in round 1, pending the owner's push.

### Findings

1. **Minor**: Node 22.23.4 is not the latest patch (v22.23.5 exists). This is carried from round 1 and is a follow-up under G-15.

D-1 is resolved. No Blocker or Major.

### Coverage rows verified

| Item | Status | Evidence |
| --- | --- | --- |
| Pin comment in `codeql.yml` (plan 3.5, D-1) | Verified | `codeql.yml:29-31`, same text as `ci.yml` |
| All other round-1 rows | Verified, unchanged | P-1, count 10, C-1, 86/86 |
| CI, Security, CodeQL, Workflow lint on PR head | Pending CI | not pushed |

Verdict: APPROVED
