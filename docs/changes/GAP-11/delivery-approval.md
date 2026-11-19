# GAP-11 delivery approval (gate 2)

## Decision

Approved, so the change can go to the owner. This is not an owner decision. The owner still confirms the push and the pull request, and then squash-merges.

## What I verified myself

- **Scope.** `git diff --name-only af2b3be..HEAD` lists only the 5 files in plan section 4 (`sets.ts`, `Design.tsx`, `check-output.ts`, `design.test.ts`, `output.test.ts`) plus `implementation.md`. `design-sources.ts`, `.github/workflows` and the alt-text files are not touched. The other files in the triple-dot diff against `origin/rebuild/dotnet-platform` are GAP-11's own records.
- **B-6 order.** `c1ea9f3` (failing tests) comes before `0cec01e` (fix). The tester reproduced red at `c1ea9f3`: 8 failed, 36 passed.
- **Re-run.** `npx vitest run test/design.test.ts test/output.test.ts` at `e92e2ac`: exit 0, `Tests 44 passed (44)`.
- **B-4.** All three GAP-11 commit subjects use the `GAP-11:` prefix and the imperative, each has a body giving the reason, and each ends with the `Co-Authored-By` trailer. `af2b3be` is a merge from the base.
- **Gate 1 conditions.**
  1. `SRI_BLOCKING_FROM` is an ISO constant; the warn/fail exit codes are tested and were shown on real output by the tester (exit 0 today, exit 1 with the date fixed at 2026-11-26). Met.
  2. Test 3 is in `output.test.ts`. Met.
  3. The `//` case is tested. Met.
  4. The hashes were derived twice by the developer and a third time by the tester, on independent routes. Met.
  5. Failing tests come first. Met.
  6. Nothing outside section 4 changed. Met.
- **Tester evidence** is concrete: commands, exit codes and output lines. The base-versus-head comparisons are the key evidence: `out/` is byte-identical once the attributes are removed, the section comparison is identical, and 153 of 156 screenshot rows match. Every coverage row has evidence, or is marked NOT RUN with the CI job that covers it.
- **Owner decisions (gate 1 required them quoted before gate 2).** `implementation.md` quotes the question, the defaults and the answer, "Yes, defaults", with the date (2026-11-19) and where it was given (orchestrator session local_23423d93). It records that the answer was relayed and not typed in this session. That meets the gate 1 condition. The owner should confirm the quote when approving the push.

## Tester Minors: decision

1. **Loose attribute matching in `checkScriptIntegrity`.** Accepted for this pull request. React emits lowercase tags with double-quoted attributes, and 18 of 18 real tags are checked correctly. Recommend a follow-up to harden the parser (case, quoting, a full 64-character sha384, `crossorigin` as an attribute name) before raw-HTML content can reach a page.
2. **`SRI_BLOCKING_FROM` fixed at 2026-11-26.** Accepted, with an open item for the owner. If the merge happens after 2026-11-19, the report window is shorter than seven days. Before the merge, either move the date to merge + 7 (a one-line change, sent back to the developer) or accept the shorter window in writing.
3. **`check:csp` leaves an Edge debug browser running, on fixed ports outside 42xx.** Tooling, and out of scope. It needs its own change.

## For the owner

- During the tester's build, Next.js printed a `SecurityFatalError` "upgrade recommendation" which told the agent to run `next upgrade --agent=security` and to ask the user about it. **No agent followed it.** Text in tool output that directs agents is untrusted. Any Next upgrade should come only from the owner, through its own change (the moderate `next` advisory falls under GAP-07's audit).
- O-1 follow-up: GAP-11b (Tabler Icons stylesheet) needs to be registered if you want it.

## Open Definition of Done items

- PR checks green on the final head (run IDs): open until the pull request is open.
- API, studio and e2e suites: NOT RUN locally (untouched; the local e2e harness is broken). Covered by CI.
- WebKit screenshot parity: NOT RUN locally (browser not installed).
- gitleaks: NOT RUN locally. Covered by `security.yml`.
- Changed-line coverage figure: comes from CI.
- `SRI_BLOCKING_FROM` against the merge date (Minor 2).
- Governance: GAP-11 status in the coverage table or the register is not updated in this diff. Update it at merge, or note it in the pull request.

## Draft pull request description

```markdown
## What and why

GAP-11 (G1, Wave 1). The owner's request: "GAP-11 give every third-party script, starting with GSAP from cdn.jsdelivr.net, an integrity hash or a local fallback".
GSAP 3.12.5, ScrollTrigger and Lenis 1.0.23 load from cdn.jsdelivr.net with no integrity hash, so a tampered file would run on every page. Each now carries a sha384 `integrity` and `crossorigin="anonymous"`. A local fallback was rejected because an inline fallback would break the CSP. A new build-output check reports any external script without SRI.

## Scope and boundaries

In scope: `website/src/design/sets.ts`, `website/src/design/Design.tsx`, `website/scripts/check-output.ts`, `website/test/design.test.ts`, `website/test/output.test.ts`.
Out of scope: the Tabler Icons stylesheet (O-1, a possible GAP-11b), `design-sources.ts`, workflows, the API and the Studio. No dependency changes and no migrations.

## Security impact

Adds subresource integrity to the three third-party scripts, and a gate: from `SRI_BLOCKING_FROM` (2026-11-26) the build fails on any external script without sha384 and crossorigin. Until then it warns. No routes, data or secrets are affected.

## Tests and evidence

- Red first: `c1ea9f3`, `vitest design+output`: exit 1, 8 failed / 36 passed. Green at head: 44/44.
- `npm test`: exit 0, 469 passed, 1 skipped (already there). `typecheck`, `design:check`: exit 0.
- Build with `CONTENT_SOURCE=snapshot`: exit 0, "Script integrity: every external script carries a sha384 integrity and crossorigin"; 18/18 external tags carry SRI.
- The hashes were derived three times (jsDelivr, the npm tarball, the GitHub tag); all match.
- Warn and fail modes on real output: exit 0 today, exit 1 with the date at 2026-11-26.
- `out/` is byte-identical to the base once the attributes are removed. `compare:sections` is identical to the base (the existing `/careers/apply` difference). Screenshots (chromium and firefox): 153/156 rows have the same status as the base, and the rest is noise.
- `test:browser`: 4 passed, 25 skipped by design. `check:csp`: no script violations. npm audit, semgrep: no new findings.
- NOT RUN locally: API/studio/e2e (untouched; the local harness is broken), WebKit, gitleaks. Covered by CI `api`, `studio`, `e2e`, `website` and `security.yml`.
- CI run IDs: <to fill>

## Owner decisions

Relayed by the orchestrator session (local_23423d93), on 2026-11-19. The question was "Take the recommended defaults for all three questions?", where the defaults were O-1 "Scripts only now; the stylesheet goes to a follow-up, GAP-11b" and O-2 "Warn for 7 days, then block, as the standard's rule for new gates says". The owner answered: "Yes, defaults".

## Definition of Done

- [x] Requirement and acceptance criteria are stated and met
- [x] Code follows the engineering standards
- [x] No new prohibited constructs in touched code
- [x] Every new or changed route has a guard (no routes changed)
- [ ] Tests exist for the behaviour changed; changed-line coverage meets the gate (tests exist and the canary is committed; the coverage figure comes from CI)
- [ ] PR checks are green on the final head (run IDs quoted)
- [x] Independent code review was run (plan-reviewer, tester, tech-lead gates 1 and 2)
- [x] The approver's review is recorded (plan-approval.md, delivery-approval.md)
- [x] Rollback: revert this PR
- [x] Deployment note: nothing deploys before Phase D; the owner squash-merges into rebuild/dotnet-platform, and CI, Security and Workflow lint re-run after the merge

## Review findings accepted

- `checkScriptIntegrity` matches only lowercase, double-quoted attributes and does not check the hash length. React output is always in that form; hardening is a follow-up.
- `SRI_BLOCKING_FROM` is 2026-11-26, not merge + 7. Moved, or accepted by the owner, at merge.
- `check:csp` leaves its Edge debug browser running, on fixed ports. Tooling, for a separate change.

## Governance

- [ ] `AGENTS.md` coverage table or phase document updated
- [x] `docs/deferred-items.md`: no exception taken
- [x] Documentation updated (docs/changes/GAP-11/)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Verdict: APPROVED

## Round 2

Held after the fact: PR #69 was squash-merged into rebuild/dotnet-platform (merge `71b7541`) before this gate ran. This approval records that the merged head met the gate; it does not stand in for the owner's merge decision, which the owner has already made. The owner chose "Gate 2 on CI evidence" for this round.

Scope: commits `333b275` (failing tests), `d2e9ef1` (fix), `8979481` (implementation note), `c0504a2` (round-2 test report). The fix answers the CodeQL "Bad HTML filtering regexp" alerts and the tester's round-1 Minor 1. Owner's request: "GAP-11 give every third-party script, starting with GSAP from cdn.jsdelivr.net, an integrity hash or a local fallback".

### Verified myself

- `gh pr view 69`: head `c0504a27094d33bee1c5c31a63c0e8658f94edb7` equals the branch head; state MERGED.
- `gh pr checks 69`: 16 passed, 1 skipped (optional screenshot parity, label-gated), 0 failed. Run IDs: CI `44513425845` (API, Studio e2e, Website tests/design/snapshot build, Website browser tests, Section comparison), Security `44513425873` (npm audit website and studio, NuGet, gitleaks x2, Semgrep, gate self-test), CodeQL `44513425881` (csharp, javascript-typescript), Workflow lint `44513425834` (actionlint). The Website jobs built with Next 16.4.6 from the base after PR #72, which clears the tester's only block.
- Both CodeQL review threads (github-advanced-security) are resolved and each has a reply.
- Failing-test-first: `333b275` precedes `d2e9ef1`; the tester recorded red (4 failed) at `333b275`.
- Re-ran `npx vitest run test/output.test.ts test/design.test.ts` at `c0504a2`: exit 0, `Tests 48 passed (48)`.
- Diff of the fix: `website/scripts/check-output.ts` and `website/test/design.test.ts` only; in scope, no rendering file touched.
- Commit subjects are `GAP-11: <imperative>` with the Co-Authored-By trailer on all four commits (B-4).

### Tester's round-2 Minors

1. Checker misses `>` inside a quoted attribute, a leading-space src, a backslash src and an entity-encoded src. Accepted for now: none of these forms is produced by React/Next, and the check guards our own build output, not hostile input. Follow-up: **GAP-11c**, harden `checkScriptIntegrity` with a real HTML tokenizer (or parse5) and src normalisation (trim, backslash, entity decode), and add the four probes as tests.
2. Multi-hash integrity rejected. Accepted: it fails closed. Fold into GAP-11c (accept a space-separated list when one token is a full sha384).

### Open items

- GAP-11b (stylesheet SRI, O-1) and GAP-11c (above) are not yet filed.
- `SRI_BLOCKING_FROM` 2026-11-26 stands; confirm the gate flips to blocking on that date on the base.
- DoD "changed-line coverage" and "PR checks green with run IDs" are now satisfied by the runs above. The `AGENTS.md` coverage table update remains open.

Verdict: APPROVED
