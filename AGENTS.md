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
- Three agents: Codex, Claude Code, and Cursor's agent. Any of them builds, checks,
  and tests.
- Each works in its own worktree beside dh-platform: dh-platform-codex,
  dh-platform-claude, dh-platform-cursor. dh-platform stays on
  rebuild/dotnet-platform and is used only for merging.
- A builder owns its branch. A checker works on a detached checkout of the commit it
  checks, so the builder can keep working.
- Parallel work must change different files.
- No agent checks its own work. Rotation: Claude Code checks Codex, Cursor checks
  Claude Code, Codex checks Cursor.
- Findings go back to the builder. The checker does not fix them.
- One integrator per section, named in the prompt, merges checked branches into
  rebuild/dotnet-platform one at a time, re-running the suites after each.
- Ports: Codex 41xx, Claude Code 42xx, Cursor 43xx. Never stop a process you did not
  start.
- Only one agent at a time may reset or write a local database.
- No agent ever opens a session in DH-WEBSITE-main. It is read-only, on
  feature/interviewer-portal.

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
- That lock is lifted only for a design session Ali directs in this worktree.
  The agent does not change the design on its own. The steps are in
  docs/design-change-protocol.md.
- The Studio follows the old admin panel's look and flows (navy), with the new
  publishing, media, and roles underneath.
- Save is not publish. References are { type, id }. No whole-store import. No
  featured flag.
