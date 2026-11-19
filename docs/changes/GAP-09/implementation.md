# Implementation: GAP-09

Developer, round 1, 19 November 2026. Branch `change/GAP-09`, plan at `f89662a`,
base `origin/rebuild/dotnet-platform` at `8b5d6a5`. `plan-approval.md` ends with
`Verdict: APPROVED`.

## Red on the base (C-4)

Run on the unchanged base, before any edit.

- **P-1** `grep -nE '^\s*-?\s*uses:' .github/workflows/*.yml .github/security/*.yml | grep -vE '@[0-9a-f]{40}( |$)'`
  exit 0, 55 lines (red). By reference: 21 `actions/checkout@v4`,
  11 `actions/setup-node@v4`, 11 `actions/upload-artifact@v4`,
  5 `actions/setup-dotnet@v4`, 3 `actions/setup-python@v5`,
  2 `actions/download-artifact@v4`, 1 `github/codeql-action/init@v3`,
  1 `github/codeql-action/analyze@v3`.
- **P-2** `grep -n 'image:' .github/workflows/*.yml | grep -vE '@sha256:[0-9a-f]{64}'`
  exit 0 (red):
  ```
  .github/workflows/ci.yml:46:        image: mcr.microsoft.com/mssql/server:2022-latest
  .github/workflows/ci.yml:199:        image: mcr.microsoft.com/mssql/server:2022-latest
  ```
- **P-3** `grep -nE 'NODE_VERSION: "[0-9]+\.[0-9]+\.[0-9]+"' ...` exit 1, no
  output (red). `grep -nE 'node-version:' ... | grep -v 'env.NODE_VERSION'` exit 1,
  no output (already fine).
- **P-4** `grep -nE 'dotnet-version:' ... | grep -vE '"10\.0\.[0-9]{3}"'` exit 0 (red):
  ```
  .github/workflows/ci.yml:74:          dotnet-version: "10.0.x"
  .github/workflows/ci.yml:249:          dotnet-version: "10.0.x"
  .github/workflows/codeql.yml:51:          dotnet-version: "10.0.x"
  .github/workflows/security.yml:114:          dotnet-version: "10.0.x"
  .github/security/security.expected.yml:114:          dotnet-version: "10.0.x"
  ```
- **P-5** `git ls-remote --tags https://github.com/<repo> refs/tags/<tag> 'refs/tags/<tag>^{}'`,
  each exit 0:
  ```
  actions/checkout v4.4.0           11d5960a326750d5838078e36cf38b85af677262 refs/tags/v4.4.0
  actions/setup-node v4.4.0         49933ea5288caeca8642d1e84afbd3f7d6820020 refs/tags/v4.4.0
  actions/setup-dotnet v4.3.1       67a3573c9a986a3f9c594539f4ab511d57bb3ce9 refs/tags/v4.3.1
  actions/upload-artifact v4.6.2    ea165f8d65b6e75b540449e92b4886f43607fa02 refs/tags/v4.6.2
  actions/download-artifact v4.3.0  d3f86a106a0bac45b974a628896c90dbdf5c8093 refs/tags/v4.3.0
  actions/setup-python v5.6.0       a26af69be951a213d495a4c3e4e4022e16d87065 refs/tags/v5.6.0
  github/codeql-action v3.39.3      096a89ea781ad15884828b1490898d6948bd1605 refs/tags/v3.39.3
                                    9418214df1f2c4b8128c770156c409013b07d6b9 refs/tags/v3.39.3^{}
  ```
  Every SHA matches plan section 2; codeql-action is pinned to the `^{}` commit.

These checks are read-only and not committed as a gate (plan section 3), so the
red evidence is this record, committed before the edit commit.

## What changed (plan section 4)

Commits: `d8cc541` (red record), `c8cd307` (the edit).

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | 21 `uses:` lines to `<sha> # vX.Y.Z`; image at old 46 and 199 to `mcr.microsoft.com/mssql/server:2022-CU28-ubuntu-22.04@sha256:4525e3ef…7b7f`; `NODE_VERSION: "22.23.4"`; `dotnet-version: "10.0.404"` twice; 3-line pin comment above `env:` |
| `.github/workflows/security.yml` | 13 `uses:` lines; `NODE_VERSION: "22.23.4"`; `dotnet-version: "10.0.404"`; pin comment above `env:` |
| `.github/security/security.expected.yml` | Same content edits; stays LF (C-1). `diff <(tr -d '\r' < security.yml) security.expected.yml` prints nothing |
| `.github/security/semgrep-job.expected.yml` | 4 `uses:` lines, same as the semgrep job |
| `.github/workflows/codeql.yml` | 4 `uses:` lines; `dotnet-version: "10.0.404"`; pin comment |

The five already-pinned lines were left as they are. Edits were made with
`perl -pi` substitutions anchored on `@<major>` followed by whitespace, so CRLF and
LF endings are kept per file (`file` confirms CRLF for the workflows, LF for the
golden copies).

**One placement note, not a design change.** Plan 3.5 puts the comment "above
`env:`" in `codeql.yml`, but `codeql.yml` has no top-level `env:`. The comment is
placed above `jobs:` there. Same text as the other files; contains no `node -e`,
`python -c` or `--input-type`.

## Commands run after the edit

| Command | Exit | Result |
| --- | --- | --- |
| P-1 grep (unpinned `uses:`) | 1 | no output (green) |
| P-2 grep (image without digest) | 1 | no output (green) |
| P-3 `NODE_VERSION` exact | 0 | `ci.yml:33`, `security.yml:64`, `security.expected.yml:64`, all `"22.23.4"`; non-variable `node-version:` grep exit 1, no output |
| P-4 grep (inexact `dotnet-version`) | 1 | no output (green) |
| P-6 `git diff origin/rebuild/dotnet-platform -- .github/workflows/ci.yml \| grep -n continue-on-error` | 1 | no output |
| C-3 `diff <(base ci.yml lines 291-296,326,398) <(head lines 294-299,329,401)` (CR stripped) | 0 | identical (shift +3 from the pin comment); `git diff -U0` hunks are at 26/30/46/70/…/298/301/…/411 only, none on 291-296, 326 or 398 |
| `node --test .github/security/gate.test.mjs` | 0 | `tests 86`, `pass 86`, `fail 0` |
| `git diff --name-only origin/rebuild/dotnet-platform...HEAD` | 0 | the five files above plus `docs/changes/GAP-09/*` (C-5) |
| `bash .github/lint/self-test.sh` | 1 | `actionlint gate self-test: 5 failed`, the same 5 that fail on the base on this machine; case 17 `workflow-lint.yml shape` ok. CI job "actionlint (every workflow)" is the evidence |

NOT RUN locally: .NET build/tests, Vitest, Playwright, Studio e2e. No code changed,
and the local e2e harness is broken. Covered by CI on the pull request head (jobs
API, Website, Studio, Security, CodeQL, Workflow lint), pending the push.

## Migrations

None.

## Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Every `uses:` in `ci.yml` names a 40-character SHA | GAP-09 Done when | Done | P-1 exit 1, no output; `c8cd307` |
| Every `uses:` in `security.yml` and both golden copies names a 40-character SHA | GAP-09 Done when | Done | P-1; gate test 86/86 |
| Every `uses:` in `codeql.yml` names a 40-character SHA | GAP-09 Done when | Done | P-1 |
| Each pinned SHA is the commit of the tag named in its comment | GAP-09; P-8 | Done | P-5 output above (codeql on `^{}`) |
| The SQL Server image reference carries `@sha256:` (both jobs) | GAP-09 Done when | Done | P-2 exit 1 |
| `node-version` is exact in every workflow | GAP-09 Done when | Done | P-3 |
| `dotnet-version` is exact in every workflow | GAP-09 Done when | Done | P-4 exit 1 |
| The golden copies match and the gate self-test passes | G1 checklist; golden rule | Done locally; CI pending | gate.test.mjs 86/86; CRLF-stripped diff empty; Security "gate self-test" job pending push |
| CI (API, Website, Studio, section compare) green on PR head, pinned values in logs | G1 checklist; P-8 | Pending CI | Not pushed (owner confirms push); tester checks logs for digest, `10.0.404`, `v22.23.4` |
| Security, CodeQL and Workflow lint finish as on the base | G1 checklist; C-2 | Pending CI | CodeQL on `pull_request`; expect `Download action repository 'github/codeql-action@9418214d…'` |
| The GAP-05 lines in `ci.yml` are unchanged | Change context; C-3 | Done | P-6 and C-3 rows above |

## Rework round 1 (delivery-approval.md D-1)

- **D-1:** the pin comment was missing from `codeql.yml` (my substitution
  script tested `$1` after a second match had reset it). Fixed in `df97f14`: the
  3-line comment is now above `jobs:` (lines 29-31), CRLF kept.
  `grep -n Pinned .github/workflows/*.yml` lists `ci.yml:27`, `codeql.yml:29`
  and `security.yml:60`. `gate.test.mjs` still 86 of 86. No other file
  changed; test-report.md and delivery-approval.md left uncommitted.

Status: READY FOR TEST
