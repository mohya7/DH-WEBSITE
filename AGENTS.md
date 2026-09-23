# Digital Hub platform rebuild — working rules

Rebuild of the Digital Hub website and Content Studio on .NET 10 and React.
Branch: rebuild/dotnet-platform. Folder: D:\work\DigitalHub\dh-platform.

Read before any work: docs/business-analysis.md, docs/phase-a-foundation.md,
docs/phase-b-studio.md.

Status: Phase A complete. Phase B Sections 1–12 built; final Studio verification
pending. Phase C (the public website) is next.

## How we work
- Stop after each section, report, and wait for confirmation.
- A section is done only when its coverage table — Item | Source | Status |
  Evidence — shows evidence for every item. Moved items name their destination.
- Never start the next section without confirmation.
- Verify by running it. Report failures before fixing them; never fix silently.
- One agent at a time in this folder.

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
