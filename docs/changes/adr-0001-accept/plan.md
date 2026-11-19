# adr-0001-accept: Record the owner's acceptance of ADR 0001

Architect's plan, round 2. Worktree `D:\work\DigitalHub\dh-platform-claude-adr0001`,
branch `change/adr-0001-accept`, cut from `origin/rebuild/dotnet-platform` at
`b8b1fb1`.

The base has since moved. `git ls-remote origin refs/heads/rebuild/dotnet-platform`
now prints `8b5d6a566b055cea8872f85013912b7ca3cb7ecd`, which is one commit on:
`8b5d6a5 ADM-05: Publish the 404 and 500 pages from their screen (#59)`.
`git diff --name-only b8b1fb1 origin/rebuild/dotnet-platform` lists 14 ADM-05
files (4 API source, 1 API test, 6 `docs/changes/ADM-05/*.md`, 3 Studio). None
is in this change's scope:

```
$ git diff --stat b8b1fb1 origin/rebuild/dotnet-platform -- docs/adr ENGINEERING_STANDARDS.md docs/changes/adr-0001-accept
exit 0   (no output)
```

The developer rebases the change branch onto the current
`origin/rebuild/dotnet-platform` before editing (B-3). Every check in section 5
compares against `BASE`, the merge base found at run time, never against a
fixed SHA (5.0).

Read for this plan, all on the base: `docs/changes/README.md`, `AGENTS.md`,
`ENGINEERING_STANDARDS.md`, `docs/PROJECT_PROFILE.md`,
`docs/quality/refinement-plan-2026-10-28.md`, `docs/adr/0001-split-public-forms-api.md`
(G2), `docs/quality/admin-audit-2026-10-28.md` (only for O-13 references; no G3
finding applies), `docs/deferred-items.md`, `.github/pull_request_template.md`,
`docs/business-analysis.md` section 15. None is missing. Round 2 also reads
`docs/changes/adr-0001-accept/plan-review.md` (Round 1, `Verdict: CHANGES
NEEDED`). Each of its findings is answered in section 12.

## 1. Item

- **Id.** `adr-0001-accept`, kebab-case because the change closes no single
  register item: there is no GAP, ISO or ADM id for accepting the ADR
  (`docs/changes/README.md` line 25: "or a short kebab-case name when there is none").
- **Track.** G2, isolation. It is the prerequisite that the refinement plan puts in
  slot 2 of execution step 1, before ISO-1 to ISO-5.
- **"Done when", quoted.** The refinement plan has no Done-when row for this step.
  The nearest text is the execution-order row, line 25:
  > | 1 | 28 Oct to 3 Nov | Wave 0: security deadline | Owner decisions in one round, ADR 0001 reviewed and accepted | The deadline is fixed, and every later step waits on a decision |

  and line 27, the G2 step it unblocks:
  > | 3 | 17 Nov to 4 Dec | Wave 2 (17 to 25 Nov), then Wave 3 from 26 Nov | G2: ISO-1 to ISO-5, the split, between G3-2 items | ADR accepted and CI honest first; the split lands before the Wave 3 route list, so the list is written once for two APIs |

  This change closes "ADR 0001 reviewed and accepted" only. "Owner decisions in one
  round" in the same cell is not part of it.
- **Owner's words (P-7).** As given in the owner's request for this change:
  "accepted", 19 November 2026, in a Claude Code session, replying to
  "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can start".

## 2. Current state

**ADR 0001 is Proposed.** `docs/adr/0001-split-public-forms-api.md`, lines 3 and 4:

```
- Status: Proposed. The direction is decided (owner decision below); the
  details here are for review before any code is written.
```

Red check on the base, as run:

```
$ grep -n "Status: Proposed" docs/adr/0001-split-public-forms-api.md
3:- Status: Proposed. The direction is decided (owner decision below); the
exit 0
$ grep -rn "Accepted" docs/adr/
exit 1
```

`git log -- docs/adr/0001-split-public-forms-api.md` shows one commit, `793c43e
2026-11-19 Adopt the engineering standard and the quality records on the base (#63)`.
It is the only ADR (`ls docs/adr` prints `0001-split-public-forms-api.md`), and
there is no ADR template yet (GAP-13, standard step 1b).

**Other places that state the ADR's status.** I searched every Markdown file for
`0001`, `ADR 0001`, `(proposed)` and `Status: Proposed`. Only one other line
states the status: `ENGINEERING_STANDARDS.md` line 159, the O-12 row, ends
"Design in `docs/adr/0001-split-public-forms-api.md` (proposed)".

```
$ grep -n "(proposed)" ENGINEERING_STANDARDS.md | cut -c1-80
159:| O-12 | How to isolate the Studio from the website on the server | **Decide
exit 0
```

The other references name the ADR without a status: the refinement plan (lines 11,
25, 27, 208, 288), `ENGINEERING_STANDARDS.md` line 168, `docs/changes/README.md`
line 101 (G2 checklist), `.claude/agents/architect.md` and `plan-reviewer.md`, and
earlier change records that say the ADR does not apply to them.
`docs/PROJECT_PROFILE.md`, `docs/deferred-items.md`, `.github/pull_request_template.md`,
`AGENTS.md` and `CLAUDE.md` do not mention ADR 0001 or its status.

**The ADR's open points.** I read all 91 lines:

- Decision points 1 to 6, Consequences, Rejected and Rollback carry no "TBD",
  "open question" or pending marker. The direction is O-12, recorded as
  **Decided** in `ENGINEERING_STANDARDS.md` line 159 with the owner's "b" of
  28 October.
- One point depends on a decision that is still open. Point 5 (lines 52 to 57)
  says "decision O-13 puts the Studio subdomain behind an office and VPN
  allow-list", and Consequences (line 66) says the Studio "can be closed to the
  internet entirely (O-13)". O-13 is not decided: `ENGINEERING_STANDARDS.md`
  line 160 gives only a recommendation ("Yes, if staff work from known
  networks..."), and refinement plan line 268 lists it as open ("O-1 to O-11,
  O-13 to O-17; O-12 is decided"). O-13 belongs to ISO-6, in Phase D (refinement
  plan lines 30 and 217), which is outside the question the owner answered
  ("so G2 (ISO-1 to ISO-5) can start").
- "The details here are for review before any code is written" (line 4). The base
  has no record of a review of the ADR's details: no change folder for it, and the
  refinement plan's "independent review" (line 7) is of the 27 October plan draft.
  The ADR was added after that review ("Added later on 28 October" and
  "Restructured later on 28 October", lines 286 and 288).

**The ADR's facts against the code, checked for this plan.** If the owner accepts
the text as written, it should match the code it describes. It does:

| ADR says | Code on the base |
| --- | --- |
| Two routes, `POST /api/v1/public/contact` and `/apply` (point 1) | `PublicContactController.cs:11` `[Route("api/v1/public/contact")]`; `PublicApplyController.cs:11` `[Route("api/v1/public/apply")]` |
| `AllowedHosts: "*"` (Context) | `api/src/DigitalHub.Api/appsettings.json:43` `"AllowedHosts": "*"` |
| One login, `dh_content_app`, reads and writes everything (Context) | `docs/security-deployment.md:16-18`: `db_datareader`, `db_datawriter`, `DENY UPDATE, DELETE ON dbo.audit_log` |
| Four tables: `contact_requests`, `application_counts`, `vacancies`, `site_settings` (point 3) | `ContentModelBuilder.cs:30` `ConfigureRecord<Vacancy>(builder, "vacancies")`, and lines 133, 180 and 195 for `site_settings`, `contact_requests` and `application_counts`; the public code touches only `db.ContactRequests` (`PublicContactStore.cs:71`), `db.Vacancies` (`ApplicationIntake.cs:62`), `db.SiteSettings` (`ApplicationIntake.cs:217`) and `MERGE application_counts` (`ApplicationIntake.cs:236`) |
| `AuditLogPermissionTests` exists as the model for the permission test | `api/tests/DigitalHub.Api.Tests/AuditLogPermissionTests.cs` |
| Projects in `api/src/` | `ls api/src`: `DigitalHub.Api`, `DigitalHub.Images` (neither `DigitalHub.PublicApi` nor `DigitalHub.Forms` exists yet, as expected) |

**Open pull requests.** None touches either file this change edits. At round 2,
`gh pr list --repo mohya7/DH-WEBSITE --state open` lists #58, #60, #65 and #66.
#59 merged as `8b5d6a5`, and #57 is no longer open.

```
$ gh pr diff <n> --repo mohya7/DH-WEBSITE --name-only
#58 ADM-04:      api/src/.../UserAccessStore.cs, UserAccessController.cs, Identity/TemporaryPassword.cs, Program.cs, three api tests, docs/changes/ADM-04/*.md (5), studio/e2e/users.spec.ts, studio/src/pages/UsersPage.tsx, studio/test/users.test.tsx
#60 diag:        studio/e2e/redirects.spec.ts
#65, #66:        the same 15 files as #58
```

No open PR changes `docs/adr/`, `ENGINEERING_STANDARDS.md` or
`docs/changes/adr-0001-accept/`. Check 9 re-runs this before the push.

**Line endings.** Both files are stored LF and checked out CRLF
(`git ls-files --eol`: `i/lf w/crlf` for each), matching `core.autocrlf=true`.

## 3. Design

Record the acceptance where the status is stated, and nowhere else.

**3.1 `docs/adr/0001-split-public-forms-api.md`.** Replace lines 3 and 4 with
exactly these lines, wrapped to match the file:

```
- Status: Accepted. Owner's words: "accepted" (19 November 2026, in a Claude
  Code session, reply to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can
  start").
- Note, recorded with the acceptance and not the owner's words: O-13 (point
  5) is not decided by the acceptance and stays open for ISO-6; see
  `ENGINEERING_STANDARDS.md` section 9, O-13.
- Proposed 28 October 2026: "The direction is decided (owner decision below);
  the details here are for review before any code is written."
```

- The owner's word and the question are quoted byte for byte from the owner's
  request, with straight double quotes and the pipe in the question kept (P-7).
  The Status bullet holds the owner's words and nothing else.
- The O-13 note is its own bullet and says plainly that it is not the owner's
  words. It gives its source, the open O-13 row (`ENGINEERING_STANDARDS.md:160`;
  refinement plan lines 217 and 268). It states a fact already on the base, so
  that point 5 cannot be read as deciding the allow-list. It does not answer
  O-13, and it does not change point 5.
- The original status text stays, quoted with its date
  (`ENGINEERING_STANDARDS.md` section 7: "A correction is appended with its date;
  the original stays"). The date matches the ADR's own `Date: 28 October 2026`
  (line 5).
- Nothing else in the ADR changes. The owner accepted the text as written, so
  the body is not edited, not even to fix wording.

**3.2 `ENGINEERING_STANDARDS.md` line 159.** In the O-12 row, replace
`` `docs/adr/0001-split-public-forms-api.md` (proposed) `` with
`` `docs/adr/0001-split-public-forms-api.md` (accepted 19 November 2026) ``.
The row stays one line, so the file stays at 187 lines and no line number moves.
Records cite `ENGINEERING_STANDARDS.md:12` (GAP-34), and this edit keeps that
citation valid. This is not a rule change under line 12 ("A rule changes only
through an ADR in `docs/adr/`"). The row is a status note in the open-decisions
table, and the change it records is an ADR's acceptance.

**Does "accepted" cover the ADR as written?** Yes, for everything the owner was
asked about. Points 1 to 6, Consequences, Rejected and Rollback contain no open
alternative or pending owner choice except O-13. The owner's question named
ISO-1 to ISO-5, and O-13 gates only ISO-6 in Phase D. So no question remains that
this change needs answered, and the change can be written truthfully without one.
O-13 stays an open register decision (section 9).

**Is a review owed before acceptance?** The ADR asks for the details to be
"for review before any code is written". No rule on the base sets an ADR review
procedure: there is no ADR template, and GAP-13 is still open. Three things cover
it:

1. The owner has read and accepted the text.
2. This change's plan review (step 2) and gate 1 (step 3) review the ADR text
   against the code. Section 2 gives the first fact check, and the reviewer can
   repeat it.
3. Each ISO-n plan is reviewed against the ADR again before its code is written
   (`docs/changes/README.md` line 101: "Follow
   `docs/adr/0001-split-public-forms-api.md`").

No code is written before steps 2 and 3, so the order the ADR asks for holds. If
the reviewer finds a factual error in the ADR body, this change does not fix it:
the owner accepted the text as written, so a correction needs the owner and its
own change.

**Rejected alternatives.**

- *Edit the refinement plan (line 25 Wave 0 cell, line 208 G2 section, line 268
  risk row).* Rejected for three reasons. The file is "the reviewed snapshot"
  (line 3). Finished records cite its line numbers (for example
  `refinement-plan-2026-10-28.md:225` in ADM-07c and line 21 in ADM-10), and any
  added line would break them. And line 25 is a schedule, not a status: marking
  the cell done would also claim "Owner decisions in one round", which is not
  done. This change's records are the evidence that the step happened.
- *Edit `docs/changes/README.md`'s G2 checklist.* Rejected. It states no status;
  "Follow `docs/adr/0001-split-public-forms-api.md`" is already right.
- *Add a status table, or update `docs/business-analysis.md` 15.1 ("Contact form |
  Moves to the Content API").* Rejected as a second topic (B-8). That row went
  stale on 28 October with O-12, not with this acceptance. Its destination is
  **ISO-2**, the change that actually moves the contact form into
  `DigitalHub.PublicApi`. That plan must list 15.1 in its scope. Standard
  section 7 ("Decisions | `docs/adr/` (Gap: step 1b); until then
  `docs/business-analysis.md` section 15") does not require 15.1 to change here.
  This decision has an ADR in `docs/adr/`, and that ADR is its decision record,
  so the "until then" fallback does not apply to it.
- *Replace the Status line without keeping the Proposed text.* Rejected: the
  original stays (standard section 7).
- *Leave the O-13 sentence out.* Considered. Without it, an accepted point 5 reads
  as if the allow-list were decided. One sentence of on-base fact prevents that
  without answering the question.

## 4. Scope

| File | Change |
| --- | --- |
| `docs/adr/0001-split-public-forms-api.md` | Lines 3 and 4 replaced by the eight lines in 3.1. No other line changes. |
| `ENGINEERING_STANDARDS.md` | Line 159: `(proposed)` becomes `(accepted 19 November 2026)`. No other change; still 187 lines. |
| `docs/changes/adr-0001-accept/plan.md`, `plan-review.md`, `plan-approval.md`, `implementation.md`, `test-report.md`, `delivery-approval.md` | Pipeline records. |

Commit subject (B-4): `ADR 0001: Record the owner's acceptance`, with a body
that quotes the owner's words and the attribution trailer.

**Out of scope, deliberately left alone:**

- `docs/quality/refinement-plan-2026-10-28.md`, including lines 25, 208 and 268
  (reasons in section 3).
- `docs/changes/README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_PROFILE.md`,
  `docs/deferred-items.md`, `docs/business-analysis.md`, `docs/security-deployment.md`.
- `ENGINEERING_STANDARDS.md` section 7's "Decisions | `docs/adr/` (Gap: step 1b)"
  row, and the ADR template. Both belong to GAP-13.
- O-13, and every other open owner decision.
- All code, tests, migrations, workflows and lockfiles. ISO-1 to ISO-6 are not
  started here.

## 5. Test plan

A docs-only change has no unit test. The failing checks first are greps that are
red on the base and must turn green.

**5.0 The base, found at run time.** Before editing, the developer fetches and
rebases the change branch, as an ordinary rebase of `change/adr-0001-accept`,
which is not a protected branch:

```
git fetch origin rebuild/dotnet-platform
git rebase origin/rebuild/dotnet-platform
BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD); echo "$BASE"
```

`implementation.md` and `test-report.md` record `BASE` as a full SHA. It is
`8b5d6a566b055cea8872f85013912b7ca3cb7ecd` today if the base does not move
again. Checks 4, 5, 6 and 8 compare against `$BASE`. The red checks R1 to R4
are run on `BASE` before the edit.

**5.1 Red on the base (run on `BASE` before editing; already run for this plan on
`b8b1fb1`, section 2. Neither file differs between `b8b1fb1` and `8b5d6a5`).**

| # | Command (Git Bash, worktree root) | Base result | After the change |
| --- | --- | --- | --- |
| R1 | `grep -n "Status: Proposed" docs/adr/0001-split-public-forms-api.md` | `3:...`, exit 0 | exit 1 |
| R2 | `grep -nF -- '- Status: Accepted. Owner'"'"'s words: "accepted" (19 November 2026, in a Claude' docs/adr/0001-split-public-forms-api.md` | exit 1 | `3:...`, exit 0 |
| R3 | `` grep -nF '0001-split-public-forms-api.md` (proposed)' ENGINEERING_STANDARDS.md `` | `159:...`, exit 0 | exit 1 |
| R4 | `` grep -nF '0001-split-public-forms-api.md` (accepted 19 November 2026)' ENGINEERING_STANDARDS.md `` | exit 1 | `159:...`, exit 0 |

**5.2 Checks after the change, each quoted with its command, exit code and output.**

1. R1 to R4 as in the last column.
2. The owner's words, exactly:
   `grep -cF 'reply to "ADR 0001 | Accept it, so G2 (ISO-1 to ISO-5) can' docs/adr/0001-split-public-forms-api.md`
   prints `1`, and `grep -cF '"accepted" (19 November 2026' docs/adr/0001-split-public-forms-api.md`
   prints `1`.
3. The original text is kept:
   `grep -cF 'Proposed 28 October 2026: "The direction is decided (owner decision below);' docs/adr/0001-split-public-forms-api.md`
   prints `1`. The O-13 note is marked as not the owner's words:
   `grep -cF "Note, recorded with the acceptance and not the owner's words: O-13 (point" docs/adr/0001-split-public-forms-api.md`
   prints `1`.
4. Only the status lines changed in the ADR:
   `git diff -U0 "$BASE" -- docs/adr/0001-split-public-forms-api.md | grep -c '^@@'`
   prints `1`. The hunk header is `@@ -3,2 +3,8 @@`, and the `-` lines are exactly
   the two base lines quoted in section 2.
5. One line changed in the standard:
   `git diff --numstat "$BASE" -- ENGINEERING_STANDARDS.md` prints `1	1	ENGINEERING_STANDARDS.md`,
   and `wc -l < ENGINEERING_STANDARDS.md` prints `187`.
6. Exact changed-file list, against the base found in 5.0:
   `git diff --name-only "$BASE"...HEAD | sort` prints exactly
   ```
   ENGINEERING_STANDARDS.md
   docs/adr/0001-split-public-forms-api.md
   docs/changes/adr-0001-accept/delivery-approval.md
   docs/changes/adr-0001-accept/implementation.md
   docs/changes/adr-0001-accept/plan-approval.md
   docs/changes/adr-0001-accept/plan-review.md
   docs/changes/adr-0001-accept/plan.md
   docs/changes/adr-0001-accept/test-report.md
   ```
   (`delivery-approval.md` is in the list only once gate 2 has written it.)
7. Every path named in the changed text and this plan exists:
   `ls docs/adr/0001-split-public-forms-api.md ENGINEERING_STANDARDS.md docs/quality/refinement-plan-2026-10-28.md docs/changes/README.md docs/security-deployment.md api/tests/DigitalHub.Api.Tests/AuditLogPermissionTests.cs api/src/DigitalHub.Api/Controllers/PublicContactController.cs api/src/DigitalHub.Api/Controllers/PublicApplyController.cs api/src/DigitalHub.Api/Content/ApplicationIntake.cs api/src/DigitalHub.Api/Content/PublicContactStore.cs`
   exits 0.
8. Whitespace and line endings: `git diff --check "$BASE"...HEAD` exits 0 with no
   output, and `git ls-files --eol docs/adr/0001-split-public-forms-api.md ENGINEERING_STANDARDS.md`
   still shows `i/lf` for both.
9. No overlap with open pull requests, re-run just before the push:
   `gh pr list --repo mohya7/DH-WEBSITE --state open --json number --jq '.[].number'`,
   then `gh pr diff <n> --repo mohya7/DH-WEBSITE --name-only` for each. Compared
   with check 6, the intersection is empty.
10. Base still current, just before the push:
    `git ls-remote origin refs/heads/rebuild/dotnet-platform` prints the `BASE`
    from 5.0. If it has moved, repeat 5.0 (an ordinary rebase of the change
    branch, then a fresh `BASE`) and re-run checks 1 to 9 (B-3). The rebased
    branch has never been pushed, so no force-push of anything is involved.
11. CI on the PR head. Quote `gh pr checks <pr> --repo mohya7/DH-WEBSITE` with
    run ids and the head SHA.
    - **The 13 required checks.** Each must be `pass`. These are the exact
      contexts in
      `gh api repos/mohya7/DH-WEBSITE/branches/rebuild/dotnet-platform/protection --jq '.required_status_checks.contexts'`,
      as read for round 2 (`strict: false`):
      1. `API — Release build, migrations, integration tests` (CI, `api`)
      2. `Website — typecheck, tests, design check, snapshot build` (CI, `website`)
      3. `Website — browser tests, default and consent builds` (CI, `website-browser`)
      4. `Studio — typecheck, build, end-to-end` (CI, `studio`)
      5. `Section comparison against feature/interviewer-portal` (CI, `section-compare`)
      6. `Security gate self-test` (Security, `gate-self-test`)
      7. `npm audit (website) — High and Critical` (Security, `npm-audit`)
      8. `npm audit (studio) — High and Critical` (Security, `npm-audit`)
      9. `NuGet vulnerable packages (api) — High and Critical` (Security, `dotnet-vulnerable`)
      10. `Secret scan (gitleaks, this pull request's commits)` (Security, `gitleaks-pr`)
      11. `Secret scan (gitleaks, full history)` (Security, `gitleaks-history`)
      12. `Semgrep (ERROR fails, WARNING reported)` (Security, `semgrep`)
      13. `actionlint (every workflow)` (Workflow lint, `actionlint`)

      All four workflows run on every pull request, with no paths filter
      (`ci.yml` lines 13 to 18, `security.yml:46`, `workflow-lint.yml:23`), so a
      docs-only PR reports all 13. The tester re-reads the protection list at
      test time. If it differs from these 13, the tester quotes the new list and
      checks every entry on it.
    - **CodeQL, not required but expected to run.** The repository is public
      (`gh api repos/mohya7/DH-WEBSITE --jq '"private=\(.private) visibility=\(.visibility)"'`
      prints `private=false visibility=public`), so `codeql.yml:32`
      (`if: github.event.repository.private == false || vars.CODEQL_ENABLED == 'true'`)
      runs `analyze`. `CodeQL (csharp)`, `CodeQL (javascript-typescript)` and the
      code-scanning result `CodeQL` must each be `pass`, quoted with their run id,
      as on #58 (run `44424309387`).
    - **Screenshot parity, not required.** `Screenshot parity (optional, label
      "screenshots")` runs only with the label and shows `skipping` without it.
      It is recorded as skipped, not as passed.

**NOT RUN locally, with the job that covers each.** .NET build and tests (Windows
Application Control; covered by CI `api` in Release). Website and Studio
suites, the design check and the section comparison (no source changes; covered by
CI `website`, `studio`, `website-browser` and `section-compare`). No database is
touched.

**Track checklist, G2 (`docs/changes/README.md` lines 101 to 106).**

| Checklist item | This change |
| --- | --- |
| Follow `docs/adr/0001-split-public-forms-api.md` | Applies. The ADR body is unchanged (check 4), and only its status is recorded. |
| ISO-1 changes no behaviour: 208 integration and 22 end-to-end tests pass unchanged | N/A: not ISO-1. No code changes (check 6); the required API and Studio checks are green (check 11). |
| The public API answers only the two form routes; every other path returns 404 | N/A: ISO-2. |
| `dh_public_forms` proven unable to read users, roles, sessions or audit, or change content | N/A: ISO-3. |
| ISO-4 merges only after ISO-5 | N/A: neither is in this change. |

## 6. Security impact

None in code or configuration. No route, policy, login, grant, secret, data or
dependency changes, and checks 6 and 11 prove it. The record does authorise later
work that changes the security boundary (ISO-1 to ISO-5: a new process, a new
login `dh_public_forms` and its grants, `AllowedHosts`, and the website proxy).
Each of those is planned and reviewed in its own change.

## 7. Migrations

None.

## 8. Rollback

Revert the pull request. The ADR returns to Proposed, and G2 (ISO-1 onward) is
blocked again until the owner's acceptance is recorded once more.

## 9. Owner decisions needed

None for this change. The owner's words are in hand (section 1).

Still open in the register, unchanged by this change and not asked here: O-13
(Studio subdomain allow-list). The ADR's point 5 depends on it, and ISO-6 waits
on it in Phase D. ISO-1 to ISO-5 do not.

## 10. Risks

| Risk | Effect | How it is caught |
| --- | --- | --- |
| The owner's words are paraphrased or mis-punctuated | P-7 breach | Checks 2 and R2 use fixed-string greps on the exact words and question |
| The ADR body is edited beyond the status | The owner's acceptance would cover text the owner did not see | Check 4: one hunk, `@@ -3,2 +3,8 @@`, against the run-time `BASE` |
| A line number moves in `ENGINEERING_STANDARDS.md` and breaks the `:12` citations | Stale evidence in GAP-34 records | Check 5: numstat `1 1`, 187 lines |
| The O-13 note is read as answering O-13, or as the owner's words | A decision or condition recorded that the owner did not give | The note is its own bullet, says "not the owner's words" and cites `ENGINEERING_STANDARDS.md` section 9, O-13; check 3 greps that wording |
| An open PR or a newer base touches the same files | Merge conflict, or a stale base | 5.0 rebases first; checks 9 and 10 just before the push |
| Checks compare against a stale base and pick up another change's files | False file list or whitespace result | Every diff check uses the run-time `BASE` from 5.0, recorded as a SHA |
| CI evidence recorded against stale assumptions (CodeQL, required checks) | False evidence (P-8) | Check 11 lists the 13 required contexts and is re-read from the protection API at test time; CodeQL is expected to run |
| Slot 2 pace: refinement plan line 21 allows one slot 2 merge a day, and line 269 pauses slot 2 when the queue passes three | Merge ordering against #58 | Not an agent's choice. The owner squash-merges and orders the queue; the PR body notes it is slot 2 (G2) |
| A factual error in the ADR body comes up in review | The accepted text is wrong | Out of scope to fix (3, "Is a review owed"); it goes to the owner as a new change |

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| ADR 0001 Status is Accepted, with the owner's exact words, date and where given | Owner's request, 19 November 2026; P-7 | Planned | |
| The original Proposed text is kept with its date | `ENGINEERING_STANDARDS.md` section 7 | Planned | |
| The ADR body is otherwise unchanged (accepted as written) | Owner's "accepted"; B-8 | Planned | |
| O-13 is recorded, as a marked note that is not the owner's words, as not decided by this acceptance | `ENGINEERING_STANDARDS.md` line 160; refinement plan lines 217 and 268 | Planned | |
| `docs/business-analysis.md` 15.1 is moved to ISO-2 | `AGENTS.md` (moved items name their destination); standard section 7 | Planned | |
| The O-12 row says accepted, not proposed; line count unchanged | `ENGINEERING_STANDARDS.md` line 159 | Planned | |
| The refinement plan and the other records are unchanged | Section 3, rejected alternatives; B-8 | Planned | |
| Exact changed-file list; no overlap with open PRs | Section 4; B-1, B-5 | Planned | |
| The 13 required checks pass on the PR head, as listed by the branch protection API | Branch protection on `rebuild/dotnet-platform`; P-8; Definition of Done box 6 | Planned | |
| `CodeQL (csharp)`, `CodeQL (javascript-typescript)` and `CodeQL` pass; screenshot parity recorded as skipped | `codeql.yml:32`; P-8 | Planned | |
| Every diff check runs against the run-time merge base, recorded as a SHA | B-3; plan review round 1, finding 1 | Planned | |
| Slot 2 step 1: "ADR 0001 reviewed and accepted" | Refinement plan line 25 | Planned | |
| ISO-1 can start | Refinement plan lines 27 and 212 | Planned | |

## 12. Revision log

Round 1: first version.

Round 2 answers plan review Round 1 (`plan-review.md`, `Verdict: CHANGES NEEDED`,
2 Majors and 3 Minors):

| # | Finding | Answer | What changed |
| --- | --- | --- | --- |
| 1 | Major: checks 4, 5, 6, 8 and 10 tied to `b8b1fb1`; the base moved to `8b5d6a5` | Accepted | Header records the move (`ls-remote` prints `8b5d6a566b05...`; one ADM-05 commit, 14 files, none in scope, `--stat` empty). New 5.0: fetch, ordinary rebase of the change branch, `BASE=$(git merge-base origin/rebuild/dotnet-platform HEAD)` recorded as a SHA. Checks 4, 5, 6 and 8 use `"$BASE"`; check 10 repeats 5.0 if the base moves. New risk row and coverage row. |
| 2 | Major: CodeQL expectation wrong (the repository is public); required checks not stated | Accepted | Check 11 rewritten. It lists the 13 required contexts exactly as the protection API returned them (`strict: false`), each `pass`, with its workflow and job; the tester re-reads the list at test time. CodeQL `CodeQL (csharp)`, `CodeQL (javascript-typescript)` and `CodeQL` are expected to pass (`codeql.yml:32`; `private=false visibility=public`; as on #58, run `44424309387`). Screenshot parity is not required and is recorded as skipped. As the coordinator directed, visibility, protection and P-1/O-9 staleness are evidence here and not this change's scope. |
| 3 | Minor: the O-13 sentence reads as part of the owner's acceptance | Accepted | 3.1: the Status bullet now holds only the owner's words. The O-13 text is its own bullet: "Note, recorded with the acceptance and not the owner's words: ... see `ENGINEERING_STANDARDS.md` section 9, O-13." The ADR hunk is now `@@ -3,2 +3,8 @@` (checks 4 and the risk row updated). Check 3 greps the note's wording. R2 and check 2 are unchanged and still each match one line. |
| 4 | Minor: `docs/business-analysis.md` 15.1 had two destinations | Accepted | One destination, ISO-2, with the reason the standard's section 7 "until then section 15" clause does not apply: the ADR in `docs/adr/` is itself the decision record. Coverage row added. |
| 5 | Minor: `vacancies` mapping citation; stale open-PR list | Accepted | Section 2 cites `ContentModelBuilder.cs:30` `ConfigureRecord<Vacancy>(builder, "vacancies")`. The open-PR list is now #58, #60, #65 and #66 (#59 merged as `8b5d6a5`, #57 no longer open); check 9 still re-runs it. |

Note on round 2's own evidence: to read the moved base, I ran `git fetch origin
rebuild/dotnet-platform`, which updates only the remote-tracking ref. Nothing was
committed, rebased or pushed.

## What this unblocks next

**ISO-1** (refinement plan line 212): "move the contact and apply code
(validation, intake, throttles, dedupe, email) into a `DigitalHub.Forms` library;
no behaviour change", done when "All 208 integration tests and the 22 end-to-end
tests pass unchanged". It is not planned here. One note for its architect: until
ISO-4, the admin API still serves `/api/v1/public/*`, so it will reference
`DigitalHub.Forms` for a while. The ADR's point 2 ("the admin API does not need
it") describes the end state after ISO-4.
