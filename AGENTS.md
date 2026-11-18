# Digital Hub platform rebuild — working rules

Rebuild of the Digital Hub website and Content Studio on .NET 10 and React.
Branch: rebuild/dotnet-platform. Folder: D:\work\DigitalHub\dh-platform.

Read before any work: docs/business-analysis.md, docs/phase-a-foundation.md,
docs/phase-b-studio.md.

Status: Phase A complete. Phase B complete — verified by 22 of 22 end-to-end tests
in three consecutive runs, and 208 of 208 integration tests. Phase C, the public
website, is next.

## How we work
- Stop after each section, report, and wait for confirmation.
- A section is done only when its coverage table — Item | Source | Status |
  Evidence — shows evidence for every item. Moved items name their destination.
- Never start the next section without confirmation.
- Verify by running it. Report failures before fixing them; never fix silently.
- One agent per worktree, and never two agents on the same branch.

## Agents
- Every change runs through `/change` (`.claude/commands/change.md`) in a Claude
  Code project thread, one agent per role: architect, plan-reviewer, tech-lead
  gate 1, developer, tester, tech-lead gate 2. `docs/changes/README.md` describes
  the roles, their records and their verdicts.
- The agents do everything up to the merge. After gate 2 the pipeline stops for
  the owner, and pushes the change branch and opens the pull request only when
  the owner confirms.
- The owner squash-merges the pull request into rebuild/dotnet-platform. No agent
  merges. CI, Security and Workflow lint run again on rebuild/dotnet-platform
  after each merge.
- Each change has its own branch, change/<id>, in its own worktree beside
  dh-platform. dh-platform stays on rebuild/dotnet-platform; nothing is committed
  there.
- No agent checks its own work: the tester never built the change it tests. The
  tester works on a detached checkout of the developer's commit, so the developer
  can keep working.
- Findings go back to the role that wrote the work: plan findings to the
  architect, delivery findings to the developer. The reviewers, the tech lead and
  the tester do not fix them.
- Parallel changes must change different files.
- Agents use ports 42xx. Never stop a process you did not start.
- Only one agent at a time may reset or write a local database.
- No agent ever opens a session in DH-WEBSITE-main. It is read-only, on
  feature/interviewer-portal.

The standard's roles, by agent and pipeline step:

| Standard's role | Agent | Step |
| --- | --- | --- |
| Planner | `architect` | 1: `plan.md` |
| Architect | `architect` designs; `plan-reviewer` reviews the design | 1 and 2 |
| Approver | `tech-lead` approves between roles; the owner confirms the push and squash-merges | 3 and 6; the push and the merge |
| Tester | `tester`, on the developer's commit | 5 |

## Schema
- Show every migration before applying it. No exceptions, however small.
- Apply with the elevated account. The application never migrates at startup.

## Databases
- Never write to DigitalHubContent in any test or check.
- Integration tests: DigitalHubContent_Test.
- End-to-end: DigitalHubContent_E2e, reset before every run.
- Manual review: DigitalHubContent_Studio.

## Sources and branches
- Content and design come only from branch feature/interviewer-portal, in
  D:\work\DigitalHub\New Website\DH-WEBSITE-main. Read-only. Never modify it.
- Never use the main branch as a source.
- Never change main, release/v1, or feature/interviewer-portal.

## Secrets
- dotnet user-secrets only. Never printed, never committed.

## Environment
- Windows Application Control blocks Debug test builds. Run tests in Release.

## Settled design
- The website design is locked: port existing stylesheets unchanged; verify by
  screenshot parity against feature/interviewer-portal.
- The Studio follows the old admin panel's look and flows (navy), with the new
  publishing, media, and roles underneath.
- Save is not publish. References are { type, id }. No whole-store import. No
  featured flag.
