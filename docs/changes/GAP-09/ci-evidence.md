# GAP-09 CI evidence

Recorded by the orchestrator after the push, on PR #68, head `28e16cc`
(code head `0e0a03f`). Closes the Definition of Done item "PR checks are green
on the final head (run IDs quoted)".

| Workflow | Run ID | Result |
| --- | --- | --- |
| CI | 44505740223 | API, Website (2 jobs), Studio and section comparison pass; screenshot parity skipped (optional, label not set) |
| CodeQL | 44505740178 | csharp and javascript-typescript pass |
| Security | 44505740140 | gate self-test, gitleaks (2), Semgrep, npm audit (2), NuGet pass |
| Workflow lint | 44505740158 | actionlint (every workflow) passes |

Pinned values seen in the logs:

| Value | Where | Evidence |
| --- | --- | --- |
| `mssql/server@sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f` | API job 135496748097, Studio job 135496748085 | 6 matches in each log |
| .NET SDK `10.0.404` | API job 135496748097 | 3 matches |
| Node `v22.23.4` | API and Studio jobs | 1 match in each |
| `github/codeql-action@9418214df1f2c4b8128c770156c409013b07d6b9` (C-2) | CodeQL job 135496747600 | download line present |
