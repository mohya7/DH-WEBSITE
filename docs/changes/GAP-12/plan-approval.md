# GAP-12: plan approval (gate 1)

Technical lead, 2026-11-01, gate 1 on `docs/changes/GAP-12/plan.md` round 1,
branch `change/GAP-12` at `6470fac`. Read: the role definition,
`docs/changes/README.md`, `ENVIRONMENT.md`, the refinement plan and the other
governing documents from the read-only reference copies (they are not on the
base branch), `plan.md` and `plan-review.md`. This approval is a pipeline role,
not the owner's confirmation, and it is not an owner decision (P-7).

## Decision

Approved, with the conditions below.

## Reasons

- **Prerequisite met.** `plan-review.md` Round 1 ends `Verdict: APPROVED`, with
  no Blockers or Majors and three Minors.
- **Right change.** The plan closes GAP-12 exactly as the register row
  ("`Server: Kestrel` on every response | No server header | Low | Low | Wave 1")
  and the Wave 1 "Done when" ("An integration test asserts no `Server` header on
  API responses") state. The fix sits where Kestrel writes the header, the only
  place that also covers Kestrel's own 400s, and the scratch probes quoted in
  the plan show middleware removal does not work. The Kestrel guard test stops
  the regression test passing vacuously on TestServer.
- **Execution order.** GAP-12 is a G1 Wave 1 item, Low severity, with no
  Blocker or Major ahead of it in its own track and no ISO-4/ISO-5 dependency.
  The owner's words cover preparing it now: "Start waves 0 & 1 and update me
  with each gap done" and "continue working on wave 0 & 1" (Mohamed Elbadry,
  2026-11-01, project thread). Preparing it in parallel with Wave 0 is
  acceptable because the work is local and unpushed; Wave 0 before Wave 1
  governs merge order, which belongs to the integrator. This change must not be
  pushed, opened as a pull request or merged without the owner's OK, and it
  queues behind GAP-01 and the rest of Wave 0 in slot 1, one a day.
- **No conflict with open branches.** I checked `git branch -r` and the local
  worktrees. Open PRs #37 (pipeline docs) and #38 (`change/ci-runner-pin`,
  `ci.yml` only) do not touch `Program.cs`, the API tests or
  `docs/security-deployment.md`. The local change branches GAP-01 (npm
  dependencies; its plan says the API and NuGet are out of its scope), GAP-06,
  GAP-08 and GAP-11 have no edits yet and their register rows do not touch these
  files. The only remote branches that touch `Program.cs` or
  `docs/security-deployment.md` (`fix/forwarded-headers-empty`,
  `phase-c/api-security-fixes`) were already squash-merged into the base
  (#29 and earlier). The plan leaves `ci.yml` alone.
- **Risk acceptable.** One statement in `Program.cs`, one new test class, one
  docs section; no route, policy, dependency, secret or migration change;
  rollback is a revert. The test listens on loopback port 0 and runs serially in
  the `SqlServer` collection against `DigitalHubContent_Test`.
- **Owner decisions.** None needed. The IIS `Server` header is deferred to
  Phase D by finding 9 itself and is recorded, not decided, in
  `docs/security-deployment.md`.

## Conditions for the developer

1. Commit `ServerHeaderTests.cs` alone first, run it against the unchanged
   `Program.cs` in Release, and quote the red run in `implementation.md`: the
   guard passes, and the three header tests (four cases) fail on the `Server`
   assertion, not on a connection, database, status code or timeout. Then
   commit the fix (B-6, P-4).
2. The test's `UseKestrel` callback only sets `Listen(IPAddress.Loopback, 0)`
   and never touches `AddServerHeader`.
3. Call `StartServer()` in the test class or fixture constructor so every test,
   whatever order xUnit runs them in, sees a started Kestrel host (reviewer's
   Minor 2).
4. Quote the raw-socket test's failure message in the red run, and keep its
   10-second read timeout (reviewer's Minor 3).
5. The optional live check either lists the exact environment variables used,
   with `Database=DigitalHubContent_Test` and test-only `Auth__*` values and no
   real secrets, or is written NOT RUN with the reason (reviewer's Minor 1).
   Never point it at `DigitalHubContent`.
6. Full API suite in Release afterwards: 297 existing methods plus the new
   cases, 0 failed, quoted with exit code and summary line.
7. Stay inside the plan's scope table: no change to `ApiFactory`,
   `SecurityHeadersMiddleware`, other tests, `ci.yml` or packages. Use ports
   42xx for anything started by hand, and stop only processes you start.
8. Do not push or open a pull request; the change waits for the owner and the
   integrator's merge order (Wave 0 first).

## Reviewer's Minors

All three are accepted as Minors and are carried into the conditions above
(Minor 1 as condition 5, Minor 2 as condition 3, Minor 3 as condition 4). None
needs the plan to go back to the architect.

Verdict: APPROVED
