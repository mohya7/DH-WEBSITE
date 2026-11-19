# GAP-11: Integrity hashes on every third-party script

## 1. Item

- Closes GAP-11 (refinement plan, register line 75; standard section 8, finding 8). Track: **G1, Wave 1**.
- Register target: "Integrity hash on every third-party script, or self-hosted".
- Done when (Wave 1 table, line 160): "Every external script in the built pages carries `integrity`".
- Owner's request (as given to the pipeline, 2026-11-19): "GAP-11 give every third-party script, starting with GSAP from cdn.jsdelivr.net, an integrity hash or a local fallback".

## 2. Current state

- `website/src/design/sets.ts:19-21` declares the only third-party scripts:
  `GSAP` (`npm/gsap@3.12.5/dist/gsap.min.js`), `SCROLL_TRIGGER` (`npm/gsap@3.12.5/dist/ScrollTrigger.min.js`), `LENIS` (`gh/studio-freight/lenis@1.0.23/bundled/lenis.min.js`), all on `cdn.jsdelivr.net`, used through `motion` in the `body-end` slot. `ScriptItem` (line 27) is `{ src; module? }` with no integrity field.
- `website/src/design/Design.tsx:28-30` renders `<script src type>`, with no `integrity` and no `crossorigin`.
- The old pages on feature/interviewer-portal load the same tags without integrity (grep of DH-WEBSITE-main `index.html`):
  `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js">` and the same for ScrollTrigger and Lenis.
- `website/scripts/check-output.ts:282-289` (`pageLoads`) reads every script's src and flags (module, async, defer) but never checks integrity. `expectedLoads` (line 295) compares only src and module.
- Other scripts: the consent script (`src/components/Consent.tsx:52`) and all `js/*` and `index.inline-*.js` files are self-hosted under `/design/<hash>/` or `/behaviors/`. Google Tag Manager appears only in the CSP in `src/iis/web-config.ts`. The consent script loads it at runtime after consent. It has no version and its content changes, so it cannot take SRI (see Out of scope).
- The CSP already pins the three exact URLs: `test/web-config.test.ts:82` asserts them in `script-src`.
- Current hashes, fetched 2026-11-19 with `curl -sfL <url> | openssl dgst -sha384 -binary | openssl base64 -A`:
  - gsap.min.js `sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt`
  - ScrollTrigger.min.js `sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d`
  - lenis.min.js `sha384-GuiQQtSonx5JfFrW04viv7KCVyTAZZKHCXVtcve0DYt8fUPKLdigmPuBh9XBEUD+`

  The developer derives each hash again by an independent route and stops if any differs. For GSAP, that route is `npm pack gsap@3.12.5` into the scratchpad, without installing it. For Lenis, it is a second fetch, compared with the GitHub tag's `bundled/lenis.min.js`.

## 3. Design

- Add `integrity?: string` to `ScriptItem` and set it on the three `motion` entries in `sets.ts`.
- `DesignScripts` renders `integrity={script.integrity}` and `crossOrigin="anonymous"` when an integrity value is set. SRI on a cross-origin script needs CORS, and jsDelivr sends `Access-Control-Allow-Origin: *`.
- Load order, position and the absence of async and defer stay as they are today, so the scripts run and the pages render exactly as before.
- A wrong hash makes the browser block the script. The browser suite catches that as `gsap is not defined`.

`check-output.ts` gets a new rule. Every `<script src>` with an absolute `http(s)://` src must carry `integrity="sha384-..."` and `crossorigin`. If one does not, the check reports a problem and the build fails. This applies the "Done when" check to the built pages. The canary required by GAP-21 is a unit test that feeds the check a page with a bare external script.

Rejected:
- **Self-host GSAP and Lenis** by copying them into `website/design/js/`. This removes the CDN, but it puts vendored third-party files in the locked design folder. It also changes the `design:check` set comparison against the old pages and needs a review of GSAP's licence. SRI gives the same supply-chain protection in a smaller change.
- **Local fallback** such as `window.gsap || document.write(...)`. This needs an inline script, which the CSP's `'self'` forbids, and it adds new runtime behaviour. SRI alone meets "Done when".
- **Compute the hashes by fetching at build time.** Builds would depend on the network, and a tampered file would be accepted silently. The hashes are committed constants instead.

## 4. Scope

Change:
- `website/src/design/sets.ts`: add `integrity?: string` to `ScriptItem`. Add three hash constants beside `GSAP`, `SCROLL_TRIGGER` and `LENIS`, and set them on the `motion` entries. Mention the hashes in the header comment.
- `website/src/design/Design.tsx`: render `integrity` and `crossOrigin="anonymous"` when an integrity value is set, and widen the local type cast.
- `website/scripts/check-output.ts`: add the check "external script without integrity", reported per page, and list it in the header comment.
- `website/scripts/design-sources.ts`: change only if the `--sets` comparison trips on the new attributes. It must keep comparing src and order with the old pages. The developer reports whether a change was needed.
- Tests: `website/test/design.test.ts`, plus the existing test file that covers `check-output.ts`. The developer names that file.

Out of scope:
- The Tabler Icons stylesheet (`TABLER_ICONS`) and the Google Fonts CSS. These are stylesheets, not scripts, and Google Fonts CSS varies by user agent, so it cannot take SRI. Tabler is a possible follow-up (O-1).
- Google Tag Manager: the consent script loads it after consent, it has no version, and it cannot take SRI. The CSP covers it.
- CSP changes in `src/seo/csp.ts` and `src/iis/web-config.ts`: none.
- `.github/workflows/*` (GAP-09) and the alt-text files (ADM-12): not touched.
- DH-WEBSITE-main: read only.

## 5. Test plan

Write these tests first, and commit and show them failing before the fix:
1. `website/test/design.test.ts`, "every external script in a design set has a sha384 integrity". For each set, every `ScriptItem` with an `https://` src has an `integrity` that matches `/^sha384-[A-Za-z0-9+/]{64}$/`. It fails today because the field does not exist.
2. `website/test/design.test.ts`, "DesignScripts renders integrity and crossorigin on external scripts". It renders `DesignScripts set="home" slot="body-end"` to static markup. The gsap tag must contain `integrity="sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt"` and `crossorigin="anonymous"`, and a local `js/` script must have neither. It fails today.
3. The check-output canary. A page containing `<script src="https://cdn.example/x.js"></script>` must yield the problem "external script without integrity". The same tag with integrity and crossorigin must yield none. It fails today because the rule does not exist.

Then run these in `website/`, quoting the command, exit code and key lines:
- `npm test`
- `npm run design:check`
- `npm run build`, which includes `check-output.ts` and must report 0 problems
- `npm run check:csp`
- `npm run test:browser`, on ports 42xx. A hash mismatch shows up as `gsap is not defined`.
- `npm run compare:sections` and `npm run compare:screenshots` against feature/interviewer-portal. Review the screenshot report by hand. The expected result is no differences.
- `npm audit --audit-level=high`. No dependency changes are expected, and this shows there are none.
- By hand: serve the built site locally on a 42xx port and open a page. The devtools console must show no integrity errors, and the scroll animations must run.
- API and end-to-end tests: the change does not touch the API, and the local e2e harness is broken (it fails at the Release migrations). Mark them NOT RUN locally and cite the CI `api` and `e2e` jobs on the pull request.

G1 Waves 1 to 3 checklist:
- One gate per pull request: yes. The integrity check is the only gate.
- New gate: the plan has it block at once, because there are 0 violations when it arrives and it replaces no existing protection. The checklist says a new gate reports for seven days first, so this needs the owner's answer (O-2).
- Canary fixture committed: test 3.
- Pins: no change to actions, images, Node or .NET.
- Baselines: none added.

## 6. Security impact

Protection improves: the browser refuses a tampered or substituted CDN file.

- Routes, policies, data, logins and secrets: none touched.
- Dependencies: none added.
- New failure mode: if jsDelivr ever serves different bytes for these pinned versions, the motion scripts stop running. The content still renders, and the browser suite and the console show the failure.

## 7. Migrations

None. The change touches neither the API nor the database.

## 8. Rollback

Revert the pull request.

## 9. Owner decisions needed

- **O-1**: "Should the Tabler Icons stylesheet from cdn.jsdelivr.net also get an integrity hash in a follow-up change (GAP-11b), or does GAP-11 cover scripts only, as the register says?"
- **O-2**: "May the new 'external script without integrity' build check block from the start, since nothing violates it today? Or must it first report for seven days through a `*_BLOCKING_FROM` date, as the G1 Waves 1 to 3 rule says for new gates?"

The check blocks from the start only if the owner says so in answer to O-2. Otherwise the developer adds `SRI_BLOCKING_FROM`, set to seven days after the merge.

## 10. Risks

- A wrong hash, or jsDelivr serving re-minified bytes, would block the scripts. Test 2's fixed value, the independent second derivation and `npm run test:browser` catch this.
- `crossorigin="anonymous"` changes how the browser fetches the files: it sends a CORS request without credentials to a public CDN, and no cookies are involved. Screenshot parity confirms that rendering is unchanged.
- The set comparison in `design:check --sets` or in `check-output.ts` could trip on the new attributes. The test plan runs both.
- React writes `crossOrigin` out as `crossorigin="anonymous"`. Test 2 asserts this.

## 11. Coverage table

| Item | Source | Status | Evidence |
| --- | --- | --- | --- |
| Every external script in the built pages carries `integrity` | Refinement plan line 160 | Planned | |
| GSAP, ScrollTrigger and Lenis from cdn.jsdelivr.net have integrity | Owner's request 2026-11-19 | Planned | |
| Build fails on an external script without integrity; canary rejected | G1 checklist; GAP-21 | Planned | |
| Rendering unchanged: section comparison and screenshot parity | CLAUDE.md settled design | Planned | |
| Browser suite green, so the scripts run | Test plan | Planned | |
| No workflow or alt-text files changed | Task constraint | Planned | |
| API and e2e: CI jobs green (local harness broken) | Task constraint | Planned | |
| O-1 and O-2 answered in the owner's words | P-7 | Planned | |

## 12. Revision log

- Round 1 (2026-11-19): first version. No review yet.

Status: PLANNED. Waiting on plan review; O-1 and O-2 are open for the owner.
