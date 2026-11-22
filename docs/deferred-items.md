# Deferred-items register

Every exception to `ENGINEERING_STANDARDS.md`, and every accepted residual, is
an entry here. An entry exists only once the owner has decided it. Ids are
claimed at commit time after checking every open branch; whoever lands second
renumbers. An expired entry fails the gate that cites it.

Each entry has this form:

```markdown
## D-NNN: <short title>

- Rule waived: <rule id, for example S-7>
- Justification: <why>
- Owner decision: "<exact words>" (<date>, <where given>)
- Follow-up owner: <name>
- Expires: <YYYY-MM-DD>
- Follow-up pull request: <link or "not opened">
```

## D-001: The screenshot comparison does not block yet

- Rule waived: ENGINEERING_STANDARDS.md section 3, project gates kept as
  stricter rules: screenshot parity (label `screenshots`). The waived part is
  "GAP-05: the screenshot comparison blocks": the step "Compare screenshots" in
  `.github/workflows/ci.yml` keeps `continue-on-error: true`. P-6 still
  applies: nothing is loosened, only the blocking is deferred. The Chromium
  regression tests in the same job still block.
- Justification: the screenshot register
  (`website/tools/screenshot-parity/accepted-differences.json`) has no approved
  entries, and the last labelled run (44538086421, 2026-11-19) logged 126
  differing captures. Blocking now would turn every labelled pull request red
  or accept differences nobody has decided.
- Owner decision: "Exception, expires 14 Dec" (2026-11-19, via the
  orchestrator; O-21, GAP-05)
- Follow-up owner: "The /change pipeline" (owner, 2026-11-19, via the
  orchestrator): the agent pipeline prepares the triage and the owner approves
  each acceptance. Follow-up work: triage the 126 differing captures of run
  44538086421 into fixes or approved register entries, then make the step block.
- Expires: 2026-12-14
- Follow-up pull request: not opened

## D-002: Inline SVG `<script href>` is not checked for integrity

- Rule waived: GAP-11 "Done when" (refinement plan line 160: every external
  script in the built pages carries `integrity`), for inline-SVG
  `<script href>` and `<script xlink:href>` only.
- Justification: `checkScriptIntegrity` returns `[]` for an inline-SVG
  `<script href>` with an external URL (`docs/changes/GAP-11c/test-report.md`,
  Minor 1). The base regexp check missed it too, so this is not a regression
  (`docs/changes/GAP-11c/delivery-approval.md`). Follow-up work: GAP-11d makes
  `checkScriptIntegrity` flag `<svg><script href|xlink:href>` with an external
  URL; GAP-11d waits for GAP-11b, since both edit
  `website/scripts/check-output.ts`.
- Owner decision: "Yes, defer both" (2026-11-22, via the coordinator; O-1, GAP-11c-deferred)
- Follow-up owner: "The /change pipeline" (owner, 2026-11-22, via the coordinator)
- Expires: 2026-12-15
- Follow-up pull request: not opened

## D-003: Very deep nesting overflows the recursive walk in `scriptElements`

- Rule waived: none loosened. The check fails closed by throwing, so this is
  recorded as an accepted residual against GAP-11 "Done when" (refinement plan
  line 160).
- Justification: about 5000 nested `<div>` elements make the recursive `walk`
  in `scriptElements` throw `RangeError: Maximum call stack size exceeded`,
  also at 20000 (`docs/changes/GAP-11c/test-report.md`, Minor 2). Generated
  output never nests that deep, and the throw fails the check rather than
  passing it (`docs/changes/GAP-11c/delivery-approval.md`). Follow-up work:
  GAP-11d replaces the recursive `walk` with an iterative one, with a test at
  5000 and 20000 levels; GAP-11d waits for GAP-11b.
- Owner decision: "Yes, defer both" (2026-11-22, via the coordinator; O-1, GAP-11c-deferred)
- Follow-up owner: "The /change pipeline" (owner, 2026-11-22, via the coordinator)
- Expires: 2026-12-15
- Follow-up pull request: not opened
