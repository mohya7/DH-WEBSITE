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
- One agent per worktree, and never on the same branch as the cloud agent.

## Agents
- Codex, in Cursor on this machine, builds. One branch per piece of work, pushed to
  origin. Codex never merges.
- Claude Code, in Cursor on this machine, verifies Codex's branch against the
  checklist in docs/phase-c-website.md and merges it. No agent verifies its own work.
- One agent runs at a time in this folder.
- The Claude cloud agent finishes pull request #13 (GitHub Actions) and is then
  retired.
- No agent ever opens a session in DH-WEBSITE-main. It is read-only, and stays on
  feature/interviewer-portal.
- .NET may be built and run on this machine. If Application Control blocks anything,
  stop and report.

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
