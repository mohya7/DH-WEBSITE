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
