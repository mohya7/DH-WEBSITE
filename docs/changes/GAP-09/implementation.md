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
