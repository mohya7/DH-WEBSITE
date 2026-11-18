## What and why

<!-- The change and the reason for it. Name the section, finding or task id. -->

## Scope and boundaries

<!-- In scope. Out of scope. Files or modules deliberately not touched. -->

## Security impact

<!-- Routes, policies, data, secrets or dependencies affected. "None" is an answer. -->

## Tests and evidence

<!--
Each check as run: command, exit code, the relevant output lines, CI run ids.
Anything not run: NOT RUN, the reason, and the CI job that covers it.
-->

## Owner decisions

<!-- Quoted exactly, with the date and where they were given. A summary is not the owner's words. -->

## Definition of Done

- [ ] Requirement and acceptance criteria are stated and met (criteria that only a deploy can prove are named as such)
- [ ] Code follows the engineering standards (layout, naming, size, error handling, no prohibited patterns)
- [ ] No new prohibited constructs in touched code (untyped values, data access outside its layer, config reads outside the config module, direct network calls outside the API client)
- [ ] Every new or changed route has a guard and, when it carries a record id, a record scope
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate; every security fix has a regression test
- [ ] PR checks are green on the final head (run IDs quoted)
- [ ] Independent code review was run and its findings are fixed or explicitly accepted below
- [ ] Reviewed by someone other than the author, or the approver's review is recorded and the AI governance rules were followed
- [ ] Rollback is understood (normally: revert this PR; schema or data changes state their own rollback)
- [ ] Deployment note: who pushes, and that the deploy will be watched to the end and recorded

<!--
Until Phase D nothing deploys. For the last box, name the integrator who merges
into rebuild/dotnet-platform and confirm the suites are re-run after the merge.
-->

## Review findings accepted

<!-- Each finding not fixed, with the reason. -->

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated
- [ ] `docs/deferred-items.md` updated for any exception
- [ ] Documentation updated

<!--
## Also covers

Only for a commit this pull request answers for (for example the commit it
reverts): full SHA and the reason.
-->
