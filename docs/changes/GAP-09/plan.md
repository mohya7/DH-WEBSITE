# Plan: GAP-09. Pin every action by SHA, the SQL Server image by digest, and Node and .NET exactly

Architect, round 1, 19 November 2026. Branch `change/GAP-09`, worktree
`D:\work\DigitalHub\dh-platform-claude-gap-09`, cut from
`origin/rebuild/dotnet-platform` at `8b5d6a5`.

Files read: `docs/changes/README.md`, `AGENTS.md`, `ENGINEERING_STANDARDS.md`,
`docs/PROJECT_PROFILE.md`, `docs/quality/refinement-plan-2026-10-28.md`, and every
record in `docs/changes/ci-runner-pin/`. ADR 0001 and the admin audit do not apply
(this is G1, not G2 or G3). This folder has no `plan-review.md`, `plan-approval.md`
or `implementation.md`, so this is round 1 and not a revision.

Owner's request, exactly: "GAP-09 pin every GitHub Action by 40-character SHA, the
SQL Server image by digest, and Node and .NET to exact versions".

## 1. Item

- **Closes:** GAP-09 (register row, `refinement-plan-2026-10-28.md:73`; rule G-15,
  "Tools and actions pinned exactly").
- **Track:** G1, Wave 1 (gates and API checklist).
- **Register row:** "Actions on major tags (`@v4`); SQL Server image `2022-latest`;
  Node `22` and .NET `10.0.x` float | Actions by commit SHA, the image by digest,
  Node and .NET exact".
- **Done when** (`refinement-plan-2026-10-28.md:159`, shared with GAP-10): "Every
  `uses:` names a 40-character SHA; the image reference carries `@sha256:`;
  `node-version` and `dotnet-version` are exact".
- **Not closed here:** GAP-10 ("CI runs the production major version"). The
  production SQL Server version is not recorded. This change pins the digest of the
  major CI runs today (2022) and does not claim GAP-10.

## 2. Current state

**What `ci-runner-pin` and later changes already pinned.** `ci-runner-pin` (#38)
pinned every `ci.yml` job to `runs-on: ubuntu-24.04` and left GAP-09 open on
purpose. Later changes pinned five `uses:` lines by SHA: `ci.yml:114` and `:439`
`actions/setup-node@49933ea5… # v4.4.0`, `ci.yml:437`
`actions/checkout@11d5960a… # v4.4.0`, `ci.yml:492`
`actions/upload-artifact@ea165f8d… # v4.6.2`, and `workflow-lint.yml:58`
`actions/checkout@11d5960a… # v4.4.0`.

**`uses:` lines, the total and the ones not pinned to a 40-character SHA** (counted
with `grep -cE '^\s*-?\s*uses:'` and `grep -vcE '@[0-9a-f]{40}( |$)'`):

```
.github/workflows/ci.yml                  total=25 unpinned=21
.github/workflows/codeql.yml              total=4  unpinned=4
.github/workflows/security.yml            total=13 unpinned=13
.github/workflows/workflow-lint.yml       total=1  unpinned=0
.github/security/security.expected.yml    total=13 unpinned=13
.github/security/semgrep-job.expected.yml total=4  unpinned=4
```

The floating references are `actions/checkout@v4`, `actions/setup-node@v4`,
`actions/setup-dotnet@v4`, `actions/upload-artifact@v4`,
`actions/download-artifact@v4` (`ci.yml:308`, `:374`), `actions/setup-python@v5`
(`security.yml:167`), and `github/codeql-action/init@v3` and `/analyze@v3`
(`codeql.yml:53`, `:62`).

**What each floating tag resolves to today.** Command: `git ls-remote --tags
https://github.com/<repo> refs/tags/<major> refs/tags/<major>^{}`, run on 19
November 2026. Each major tag points at the same commit as the newest patch tag of
that major, so pinning to these SHAs does not change the code that runs:

| Action | Tag today | Commit (40 characters) | Same commit as |
| --- | --- | --- | --- |
| actions/checkout | v4 | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 |
| actions/setup-node | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 |
| actions/setup-dotnet | v4 | `67a3573c9a986a3f9c594539f4ab511d57bb3ce9` | v4.3.1 |
| actions/upload-artifact | v4 | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2 |
| actions/download-artifact | v4 | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | v4.3.0 |
| actions/setup-python | v5 | `a26af69be951a213d495a4c3e4e4022e16d87065` | v5.6.0 |
| github/codeql-action | v3 (annotated) | `9418214df1f2c4b8128c770156c409013b07d6b9` (`v3^{}`) | v3.39.3 (`v3.39.3^{}`) |

The `github/codeql-action` tags are annotated. `refs/tags/v3.39.3` is the tag
object `096a89ea781ad15884828b1490898d6948bd1605`, and the commit is on the `^{}`
line, `9418214d…`. The pin must be the commit.

**SQL Server image.** `ci.yml:46` (`api` job) and `ci.yml:199` (`studio` job) both
have `image: mcr.microsoft.com/mssql/server:2022-latest`. The last green CI run on
the base branch (run 44420794105, head `b8b1fb1`, 18 November) pulled it as:

```
API ... Initialize containers  ##[command]/usr/bin/docker pull mcr.microsoft.com/mssql/server:2022-latest
API ... Initialize containers  Digest: sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f
Studio ... Initialize containers Digest: sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f
```

A read-only HEAD request to the registry today (`curl -sI` on
`https://mcr.microsoft.com/v2/mssql/server/manifests/<tag>`) gives the same digest
for both tags:

```
== 2022-latest
Content-Type: application/vnd.oci.image.manifest.v1+json
Docker-Content-Digest: sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f
== 2022-CU28-ubuntu-22.04
Content-Type: application/vnd.oci.image.manifest.v1+json
Docker-Content-Digest: sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f
```

**Node.** `ci.yml:30`, `security.yml:61` and its golden copy
`security.expected.yml:61` set `NODE_VERSION: "22"`. Every `node-version:` line
reads `${{ env.NODE_VERSION }}`. In the same CI run it resolved as
`Found in cache @ /opt/hostedtoolcache/node/22.23.4/x64` and `node: v22.23.4`.

**.NET.** `dotnet-version: "10.0.x"` appears at `ci.yml:74`, `ci.yml:249`,
`codeql.yml:51`, `security.yml:114` and `security.expected.yml:114`. The repository
has no `global.json` (`ls global.json api/global.json` gives "No such file or
directory"). In the same CI run it resolved as:

```
dotnet-install: .NET Core Runtime with version '10.0.15' is already installed.
dotnet-install: .NET Core SDK with version '10.0.404' is already installed.
```

**Golden copies.** In `.github/security/gate.test.mjs`, `semgrepShapeProblems()`
(around line 1293) compares `security.yml` line for line with
`security.expected.yml` ("update both files in the same commit"). It also compares
the parsed `jobs.semgrep` with `semgrep-job.expected.yml`. So every change to
`security.yml` must be made the same way in both golden files. `ci.yml`,
`codeql.yml` and `workflow-lint.yml` have no golden copy. `gate.test.mjs` reads
`ci.yml` only in `inlineInterpreterProblems()`, which looks for inline `node -e`,
`python -c` and `--input-type`. Case 17 of `.github/lint/self-test.sh` reads only
`workflow-lint.yml`. No test refers to `@v4`, `2022-latest`, `10.0.x` or
`NODE_VERSION` (`grep -rn` over `.github/security/*.mjs` and `.github/lint` finds
no matches).

**Baselines run here (Windows, Node v24.19.0):**
- `node --test .github/security/gate.test.mjs`: `tests 86`, `pass 86`, `fail 0`.
- `bash .github/lint/self-test.sh`: `actionlint gate self-test: 5 failed`. The
  failing cases are 9, 11, 14 (twice) and 16, for example
  `FAIL 11 canary matches: exit 1, expected 0`. These cases already fail on the
  unchanged base on this machine, so the CI job "actionlint (every workflow)" is
  the evidence for this check, not a local run.

**Dependabot.** `.github/dependabot.yml` has a weekly `github-actions` entry.
Dependabot updates SHA-pinned `uses:` lines and the `# vX.Y.Z` comment after them.
It does not update `NODE_VERSION`, `dotnet-version` or the image digest.

**GAP-05 lines.** These stay as they are: the `continue-on-error: true` on
"Compare sections" (`ci.yml:326`) and on "Compare screenshots" (`ci.yml:398`), and
the comment above the section-compare steps (`ci.yml:291-296`).

## 3. Design

This change edits text only, in workflow inputs. Every new value is the one CI
already resolves today, so nothing that runs changes. Floating references become
fixed ones.

1. **Actions.** Replace each floating `uses: <action>@<major>` with
   `uses: <action>@<40-character commit> # v<exact patch>`, using the table in
   section 2. The comment keeps the version readable, and it is the form
   Dependabot updates. Lines that are already pinned stay as they are.
2. **SQL Server image.** On `ci.yml:46` and `:199`, use
   `image: mcr.microsoft.com/mssql/server:2022-CU28-ubuntu-22.04@sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f`.
   The tag stays beside the digest so the reader can see the version. When both
   are present, the runtime pulls by digest. The exact CU tag replaces
   `2022-latest` so the text does not say "latest" for an image that is fixed.
3. **Node.** Set `NODE_VERSION: "22.23.4"` at `ci.yml:30`, `security.yml:61` and
   `security.expected.yml:61`. No `node-version:` line changes, since they all
   read the variable.
4. **.NET.** Set `dotnet-version: "10.0.404"` at the five places listed in
   section 2.
5. **Comment.** Add one short comment above `env:` in `ci.yml`, `security.yml`
   (and so `security.expected.yml`) and `codeql.yml`. It says: actions are pinned
   by commit, the image by digest, and Node and .NET exactly (G-15, GAP-09);
   Dependabot moves the action pins; Node, .NET and the image are moved by hand in
   their own pull request. The comment must not contain `node -e`, `python -c` or
   `--input-type`.

**Alternatives rejected.**
- *Move to the newest majors while pinning* (`git ls-remote` shows checkout v7,
  setup-node v7, upload-artifact v7, download-artifact v8, setup-python v7 and
  codeql-action v4). That changes behaviour (the actions' Node runtime and the
  artifact format), and it is a second topic (B-8). Dependabot raises each major
  as its own pull request.
- *A `global.json` for .NET.* It would also bind every developer machine and the
  local build. That is a project decision beyond the owner's request, and the
  register asks for `dotnet-version` to be exact. Listed as a follow-up.
- *Digest only, with no tag* (`mssql/server@sha256:…`). Valid, but it hides which
  CU is running. Rejected for readability.
- *A committed guard that fails on any unpinned `uses:`.* That is a new gate (B-8,
  a report week, and a canary under GAP-21). It belongs with actionlint (GAP-08) or
  a later change. This change proves the pins with read-only checks instead
  (section 5).
- *Also pin `runs-on: ubuntu-latest` in `security.yml` and `codeql.yml`, and
  `python-version: "3.12"`.* None of these is in GAP-09's "Done when". They are
  listed as follow-ups, so the scope stays exactly the owner's request.

## 4. Scope

Files to change:

| File | Changes |
| --- | --- |
| `.github/workflows/ci.yml` | 21 `uses:` lines to SHA plus version comment (lines 70, 72, 133, 146, 152, 181, 188, 224, 226, 247, 280, 298, 301, 308, 313, 347, 364, 367, 374, 379, 411); image at 46 and 199; `NODE_VERSION` at 30; `dotnet-version` at 74 and 249; pin comment |
| `.github/workflows/security.yml` | 13 `uses:` lines (71, 73, 92, 94, 110, 112, 127, 142, 154, 165, 167, 171, 185); `NODE_VERSION` at 61; `dotnet-version` at 114; pin comment |
| `.github/security/security.expected.yml` | Exactly the same edits as `security.yml`, byte for byte |
| `.github/security/semgrep-job.expected.yml` | 4 `uses:` lines (6, 8, 12, 26), the same as the semgrep job in `security.yml` |
| `.github/workflows/codeql.yml` | 4 `uses:` lines (46, 48, 53, 62); `dotnet-version` at 51; pin comment |
| `docs/changes/GAP-09/*` | Pipeline records |

Out of scope, left alone:
- `ci.yml:291-296`, `:326` and `:398` (GAP-05: the `continue-on-error` on the
  section and screenshot comparison).
- `workflow-lint.yml` (already fully pinned) and `.github/lint/*`.
- `runs-on: ubuntu-latest` in `security.yml` and `codeql.yml`, and
  `python-version: "3.12"` in `security.yml`. These are follow-ups under G-15.
- GAP-10 (the production SQL Server major), `global.json`, and the G-15 status
  cell in `ENGINEERING_STANDARDS.md:68`. The status cell is a records update for
  the tech lead or the owner after the merge; it is not a workflow file.
- Any action major upgrade; website, Studio and API code; lockfiles; the files of
  GAP-11 and ADM-12 (no overlap, since neither touches `.github/`).

## 5. Test plan

**First, red on the base.** Run these read-only checks before any edit. Each must
fail on the base and pass after the change. They are the "failing test" for a
change that has no code. They are not committed as a gate (see section 3).

- **P-1, every `uses:` is a 40-character SHA.**
  `grep -nE '^\s*-?\s*uses:' .github/workflows/*.yml .github/security/*.yml | grep -vE '@[0-9a-f]{40}( |$)'`
  On the base: 55 lines, exit 0 (red). After: no output, exit 1 (green).
- **P-2, the image carries a digest.**
  `grep -n 'image:' .github/workflows/*.yml | grep -vE '@sha256:[0-9a-f]{64}'`
  On the base: lines 46 and 199 (red). After: no output, exit 1.
- **P-3, Node is exact.**
  `grep -nE 'NODE_VERSION: "[0-9]+\.[0-9]+\.[0-9]+"' .github/workflows/*.yml .github/security/*.yml`
  must list `ci.yml`, `security.yml` and `security.expected.yml`. Also,
  `grep -nE 'node-version:' .github/workflows/*.yml .github/security/*.yml | grep -v 'env.NODE_VERSION'`
  must print nothing. On the base the first command finds nothing (red).
- **P-4, .NET is exact.**
  `grep -nE 'dotnet-version:' .github/workflows/*.yml .github/security/*.yml | grep -vE '"10\.0\.[0-9]{3}"'`
  On the base: 5 lines (red). After: no output.
- **P-5, each SHA is a real tag commit.** For every distinct
  `owner/repo@sha # vX.Y.Z` in the diff, run
  `git ls-remote --tags https://github.com/<owner/repo> refs/tags/vX.Y.Z refs/tags/vX.Y.Z^{}`.
  It must print the pinned SHA (on the `^{}` line for annotated tags). Quote each
  result.
- **P-6, the GAP-05 lines are untouched.**
  `git diff origin/rebuild/dotnet-platform -- .github/workflows/ci.yml | grep -n 'continue-on-error'`
  prints nothing.

**Then, locally:**
- `node --test .github/security/gate.test.mjs`: 86 of 86 pass, so the golden
  copies match.
- `git diff --name-only origin/rebuild/dotnet-platform...HEAD`: only the files in
  section 4.
- `bash .github/lint/self-test.sh`: record the result. On this machine it already
  fails 5 cases on the base, so the CI job is the evidence.

**Then, in CI on the pull request head.** The local end-to-end harness is broken,
so CI is the evidence for the API, the Studio end-to-end suite and the lint gate.
- CI: "API — Release build, migrations, integration tests" is green. Its log shows
  `docker pull mcr.microsoft.com/mssql/server:2022-CU28-ubuntu-22.04@sha256:4525e3ef…`,
  `.NET Core SDK with version '10.0.404'` and `node: v22.23.4`.
- CI: "Studio — typecheck, build, end-to-end" is green, and its log shows the same
  image digest.
- CI: both Website jobs, "Section comparison" and "Screenshot parity" (only if the
  pull request has the label) finish as they do on the base. The section and
  screenshot compare steps keep their current non-blocking behaviour.
- Security workflow: the gate self-test, npm audit (website and Studio), dotnet
  audit, gitleaks and Semgrep jobs finish as they do on the base.
- CodeQL workflow: init and analyze run with the pinned action, if the workflow's
  triggers include this pull request. If they do not, write NOT RUN with the
  reason.
- Workflow lint: "actionlint (every workflow)" is green with 0 findings.
- Every job log shows `Download action repository '<owner/repo>@<sha>'` for the
  pinned SHAs.

**Track checklist, G1 Waves 1 to 3:**
- One gate per pull request (B-8): no gate is added or changed. This change pins
  inputs only.
- Report week for a new gate: not applicable, since there is no new gate.
- Canary fixture (GAP-21): not applicable, since there is no new gate. The
  golden-copy check still rejects a mismatch, unchanged.
- Actions pinned by 40-character SHA, the SQL Server image by digest, Node and .NET
  exactly: this change, proven by P-1 to P-5.
- Baselines only shrink: no baseline file is touched.

## 6. Security impact

A supply-chain improvement. Routes, policies, data, logins and secrets: none. Only
workflow inputs change; no `permissions:`, secret or credential line changes, and
the workflow-only SA password is untouched. Dependencies: none added. Every action,
image, Node version and .NET version is the one CI already runs, now fixed so that
a moved tag cannot change what runs. The cost: a security patch to Node, .NET or
the image now needs a pull request, because Dependabot covers only the actions.

## 7. Migrations

None. No schema or data change.

## 8. Rollback

Revert the pull request.

## 9. Owner decisions needed

None. The owner's request names every kind of value, and each pinned value is the
one CI resolves today. The production SQL Server major is still an open question
under GAP-10, not under this change.

## 10. Risks

- **A wrong SHA, or a tag object instead of a commit** (codeql-action). The job
  fails at "Download action repository". Caught by P-5 and by every CI job.
- **The golden copies drift.** Caught by `gate.test.mjs` locally and by the
  Security workflow's gate self-test job.
- **`workflow-yaml.mjs` misreads a trailing `# vX.Y.Z` comment on a `uses:` line**
  in `security.yml`. Both copies change the same way, so they stay equal, and the
  gate test proves the file still parses.
- **The exact .NET SDK is later missing from the image.** `setup-dotnet` then
  downloads it. The job is slower but not broken, and the CI log shows it.
- **The digest becomes unavailable.** Microsoft does not normally remove CU
  digests. If it happens, the API job fails at "Initialize containers", visible at
  once.
- **A merge conflict with GAP-05.** The two changes touch different lines in the
  same jobs, and whichever merges second rebases. P-6 proves this change leaves
  GAP-05's lines alone.
- **The pins go stale.** That is the accepted cost of G-15. The comment says how
  to move them.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Every `uses:` in `ci.yml` names a 40-character SHA | GAP-09 Done when | Planned | |
| Every `uses:` in `security.yml` and both golden copies names a 40-character SHA | GAP-09 Done when | Planned | |
| Every `uses:` in `codeql.yml` names a 40-character SHA | GAP-09 Done when | Planned | |
| Each pinned SHA is the commit of the tag named in its comment | GAP-09; P-8 | Planned | |
| The SQL Server image reference carries `@sha256:` (both jobs) | GAP-09 Done when | Planned | |
| `node-version` is exact in every workflow | GAP-09 Done when | Planned | |
| `dotnet-version` is exact in every workflow | GAP-09 Done when | Planned | |
| The golden copies match and the gate self-test passes | G1 checklist; golden rule | Planned | |
| CI (API, Website, Studio, section compare) is green on the pull request head, with the pinned values in the logs | G1 checklist; P-8 | Planned | |
| Security, CodeQL and Workflow lint finish as they do on the base | G1 checklist | Planned | |
| The GAP-05 lines in `ci.yml` are unchanged | Change context | Planned | |

## 12. Revision log

- **Round 1, 19 November 2026.** First plan. No review points yet.
