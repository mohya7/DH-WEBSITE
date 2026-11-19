# GAP-11 plan review

## Round 1 (2026-11-19)

### Findings

1. **Minor - section 9 / 5 (O-2 default path).** If the owner does not allow immediate blocking, the plan says only "the developer adds `SRI_BLOCKING_FROM`, set to seven days after the merge". The standard (ENGINEERING_STANDARDS.md line 48) and the refinement plan (line 134) put the date "in the workflow", but this rule lives in `website/scripts/check-output.ts`, run by `npm run build`. The plan does not say where the date is read from, what the check prints before the date (warning with exit 0), or how the canary (test 3) still proves rejection during report mode. Satisfy by stating: the constant's location, report-mode behaviour (warn, exit 0) and blocking behaviour (exit non-zero) after the date, and that test 3 asserts the problem is detected regardless of mode.
2. **Minor - section 4 / 5 (test file).** "The existing test file that covers `check-output.ts`. The developer names that file." It exists: `website/test/output.test.ts` (also `test/design.test.ts` touches the set comparison). Name it in the plan so test 3 is precisely located.
3. **Minor - section 3 (check rule scope).** The rule matches only `<script src>` with an absolute `http(s)://` src. A protocol-relative `//cdn...` src would escape it. Include `//` in the match, or say why it cannot occur.

### Checked and sound

- Fit: closes GAP-11; register target (line 75) and Done when (line 160, "Every external script in the built pages carries `integrity`") quoted word for word. Owner's request quoted exactly; the "or a local fallback" alternative is legitimately rejected because SRI satisfies the "or".
- Current state verified: `sets.ts:19-21` holds GSAP, ScrollTrigger, Lenis on cdn.jsdelivr.net; `ScriptItem` is `{ src; module? }`; `Design.tsx` renders `<script src type>` only; `check-output.ts` `pageLoads`/`expectedLoads` compare src and flags, not integrity.
- Architecture: website-only, no API/Studio code, so ADR 0001 isolation and A-11/S-1/A-12 layering are unaffected. Settled design kept (no locked design files changed; screenshot and section parity run). Rejected alternatives (self-host, inline fallback blocked by CSP, build-time fetch) are real.
- Scope: one topic; files exist; no workflow, alt-text (ADM-12), CSP or DH-WEBSITE-main changes. ADM-05 on the base touched only API/Studio, so no overlap.
- Testability: three failing-first tests, named, that fail today (field and rule absent); fixed expected hash in test 2; independent second derivation of hashes; browser suite catches a bad hash. Commands match `website/package.json` scripts. .NET Release rule not applicable; API/e2e marked NOT RUN with CI cited.
- Gates: nothing weakened; new gate has a canary (test 3); blocking mode is put to the owner (O-2) rather than assumed.
- Security: no routes, secrets, dependencies or migrations; `crossorigin="anonymous"` is correct for SRI on jsDelivr.
- Owner decisions O-1 and O-2 listed as open, not assumed. Rollback (revert) is adequate for a front-end-only change; risks are specific.

Verdict: APPROVED
