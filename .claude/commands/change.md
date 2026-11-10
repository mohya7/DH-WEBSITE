---
description: Run a change through the five-role pipeline (architect, plan-reviewer, tech-lead, developer, tester, tech-lead), stopping for the owner at the end
argument-hint: <id> [what to change, e.g. "ADM-06 fix paging in the content list"]
---

Run this change through the pipeline in `docs/changes/README.md`: $ARGUMENTS

You are the orchestrator. You do not plan, review, build or test yourself: each
step is done by its subagent, through the Agent tool with the named
`subagent_type`. Pass each one the change id, the folder
`docs/changes/<id>/`, the change branch, and the owner's request exactly as
given above. Between steps, read the file the step wrote and act on its last
verdict or status line, never on the subagent's summary alone.

## Setup

1. Take the id from the first word of the arguments (`GAP-01`, `ISO-2`,
   `ADM-06`); if there is none, make a short kebab-case one and say which.
2. Read `AGENTS.md` and `docs/changes/README.md`.
3. Branch: `change/<id>`, cut from the current `origin/rebuild/dotnet-platform`
   without tracking it (`git fetch origin rebuild/dotnet-platform` then
   `git switch -c change/<id> --no-track origin/rebuild/dotnet-platform`). If
   the branch exists, continue on it. Never work on `rebuild/dotnet-platform`
   itself.
4. If `docs/changes/<id>/` already has files, resume from the first step whose
   file is missing or not approved.

## Steps

1. **architect** writes `plan.md`.
2. **plan-reviewer** writes `plan-review.md`.
   - CHANGES NEEDED: back to step 1, then step 2 again. After the second
     rejection, stop and report to the owner.
3. **tech-lead**, gate 1, writes `plan-approval.md`.
   - CHANGES NEEDED: back to step 1, then steps 2 and 3. Counts toward the same
     limit of two returns.
4. Commit the plan files on the change branch, subject `<id>: Plan`.
5. **developer** implements and writes `implementation.md`.
   - BACK TO ARCHITECT: back to step 1 with the developer's notes, then every
     step again.
6. **tester** writes `test-report.md`.
   - CHANGES NEEDED: back to step 5, then step 6 again. After the second
     failure, stop and report to the owner.
7. **tech-lead**, gate 2, writes `delivery-approval.md`.
   - CHANGES NEEDED: back to step 5, then steps 6 and 7. Counts toward the same
     limit of two returns.
8. Commit the records, subject `<id>: Test report and approvals`.

At any step, BLOCKED ON OWNER stops the pipeline at once: report the decision
needed, quoting the file, and wait.

## Stop for the owner

After step 8, stop. Do not push, open a pull request or merge until the owner
confirms, as `AGENTS.md` requires. Report:

- the change, branch and head commit
- each step's verdict, with the number of rounds
- the coverage table from `implementation.md`
- the open Definition of Done items from `delivery-approval.md`
- any owner decision still needed

When the owner confirms, push with `git push -u origin change/<id>` and open the
pull request with the description the tech lead drafted, which follows
`.github/pull_request_template.md`. Merging stays with the integrator named for
the section.
