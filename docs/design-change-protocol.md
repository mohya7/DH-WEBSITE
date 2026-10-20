# Design change protocol

Ali edits the website design in this worktree. A sync carries that edit through every check that still expects the old bytes. The agent does not invent a design change, does not run `npm run design:port`, and does not edit copy or content.

The byte-for-byte lock against `feature/interviewer-portal` stays in force for every other change. It is lifted only for files Ali changed in a design session.

## What Ali changes, and what else must change

| What Ali changes | What else must change | How to verify |
| --- | --- | --- |
| Any file under `website/design/` | The folder is the only design source. `website/scripts/prepare-design.ts` copies it to `public/design/<hash>/` and then into `out/design/<hash>/`. The hash is the first 16 hex characters of SHA-256 over every served file's path and bytes (`website/src/design/folder.ts`). `.gitattributes` is not served and is not hashed. A new hash appears by itself; do not paste it. | From `website/`: `npx tsx -e "import { designHash, designFileList } from './src/design/folder.ts'; console.log(designHash(), designFileList().length)"` then `npm run build` with `CONTENT_SOURCE=snapshot`. `scripts/check-output.ts` fails if `out/design/<hash>/` is not those bytes. |
| The same files | `website/src/design/lock.ts` records a SHA-256 per file, taken from `feature/interviewer-portal` at `eb05f064`, plus one allowed line in `js/hero-fluid.js` (the `?v=26` import). `lockedDesignProblems` fails the website tests and the Studio build when a file's bytes differ. `website/scripts/design-sources.ts` (`npm run design:check`) also fails, because it compares the folder with `origin/feature/interviewer-portal`. | After updating the recorded hash for each file Ali changed, `npx vitest run test/design.test.ts` and `npm run design:check`. See the sync steps: the git comparison has to accept the new recorded bytes, or CI stays red. Do not re-port. |
| A new, renamed, or deleted design file | Add, rename, or remove the row in `lock.ts` and the load entry in `website/src/design/sets.ts`. Sets name which CSS and scripts each page type loads, in the old order, including Poppins, Tabler, GSAP, ScrollTrigger, and Lenis. | `npm run design:check` prints loading-order problems. `test/design.test.ts` checks the sets. |
| CSS variables in `css/shared.css` (`--blue` `#1A9AD6`, `--blue-light` `#36B0E5`, `--accent`) | These are not read by React. Duplicated hex values that must be updated to the same colors: `packages/blocks/src/sections/Methodology.tsx`, `ServiceHero.tsx`, `DeliveryFlow.tsx` (`#F4970B`, `#36B0E5`, `#1A9AD6`). `website/src/components/ApplyForm.tsx` has its own `<style>` (`#d5dbe3`, white, spacing) and does not use the design variables. | Search the repo for the old hex. Rebuild and look at the apply form and those sections. |
| `website/design/` bytes | Studio preview does not keep a second copy. `studio/vite/websiteDesign.ts` serves and emits `website/design/` at `/website-design/<hash>/`. `studio/scripts/check-preview-design.ts` runs at the end of `npm run build` and fails unless that copy matches, and unless `lockedDesignProblems` is clean. | From `studio/`: `npx vitest run test/previewDesign.test.ts`, then `npm run build` (this runs the preview check). No Studio end-to-end run locally. |
| A color the preview end-to-end test names | `studio/e2e/preview.spec.ts` expects `rgb(54, 176, 229)`, which is `--blue-light`. CI runs that test. Update the expected color only when Ali changed that token, and say so in the report. | The CI Studio job. Do not run Studio e2e locally. |
| The website logo file | `website/assets/digital-hub-logo.png` is copied to `public/assets/` by `prepare-design.ts`. The Studio shell and sign-in use `packages/theme/assets/digital-hub-logo.png`. There is no favicon file in the website source. | Both logo files match if Ali replaced the brand mark. `npm run build` in `website/` copies the website one. |
| A font or a new style/script host | Hosts are fixed in `website/src/design/sets.ts` and in the content-security policy written for the site and described in `docs/security-deployment.md` (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr.net`). Tests: `website/test/web-config.test.ts`, `studio/test/webConfig.test.ts`. | `npm run build` and those tests. Do not edit `.github/security`. |
| Studio chrome (navy, Ant Design, DM Sans / Inter) | `packages/theme/tokens.ts`, `packages/theme/tokens.css`, and `studio/src/theme.ts` (`colorPrimary` from `action.primary`). This theme is not the website design. Leave it unless Ali says the Studio chrome changed. | `studio` typecheck and unit tests. |
| Pixels of a built page | There is no committed screenshot baseline. `website/tools/screenshot-parity/` captures the built site and a static serve of `feature/interviewer-portal` at 1440, 768, and 390 in Chromium, Firefox, and WebKit. `accepted-differences.json` hides only named elements. A color or spacing change fails until an entry covers it. | `npm run compare:screenshots` from `website/` when the tool can run. CI runs it only with the `screenshots` label. |
| Markup, class names, or visible text in a section | `website/tools/section-compare/` compares the built DOM with `feature/interviewer-portal` after that branch's content runtime. Its `accepted-differences.json` is a second register (absent pages, empty vacancies, a few labels). A CSS-only change does not move this comparison. A class or structure change does. The comparison still matters: it guards content structure, not Ali's new look. | `npm run compare:sections` from `website/`. CI runs it on every website build. |
| Docs that still say the folder matches the old branch byte for byte | `website/README.md` ("Never edit `design/` by hand"), `docs/phase-c-website.md` section 3, and the one line in `docs/business-analysis.md`. Update them in the docs commit of the sync so they name the design session instead of the old lock. | Read the diff. |

Share images (`shareImageId`, Open Graph) are content media, not design files. A design sync does not change them. If Ali wants a new share image, that is a separate decision.

There is no Arabic or `dir=rtl` layout, and no dark-theme switch. `prefers-reduced-motion` lives in the ported CSS and scripts. Keyboard focus is `:focus-visible` in `css/shared.css`, `css/responsive.css`, `css/about-page.css`, `css/service-page.css`, `css/hub-pages.css`, and `website/behaviors/consent.css`. After a sync, spot-check a desktop page, a 390px page, focus on the header and a form control, and say if contrast is below WCAG AA. Do not repaint Ali's colors to pass contrast; report it.

`website/behaviors/home-sr.css` and `website/behaviors/consent.css` are outside `website/design/`. Touch them only when Ali's change is about the home "Learn more" text or the cookie banner.

## Sync procedure

Run this when Ali says "sync design". Work on `phase-e/design-refresh` in `D:\work\DigitalHub\dh-platform-cursor`. Ports for any local server are 43xx.

1. See what changed. Do not revert it.

   ```powershell
   git status --short
   git diff -- website/design website/assets packages/theme/assets packages/blocks/src/sections website/src/components/ApplyForm.tsx
   ```

   Write a plain summary: which pages or sections, and whether it is color, type, spacing, or layout.

2. If a change breaks a hard rule (contrast below WCAG AA, a section the API cannot render, a broken RTL layout), stop and propose the fix. Do not apply it unless Ali agrees.

3. Update dependents, and nothing else.
   - For each changed file in `website/design/`, set `sourceSha256` in `website/src/design/lock.ts` to the SHA-256 of the new bytes. If the file is `js/hero-fluid.js` and line 7 is still the import without `?v=26`, keep that `change` record and hash the bytes with line 7 restored to the old import. If Ali edited that line, drop the record and hash the file as it is.
   - `npm run design:check` and `website/test/design.test.ts` (`match origin/feature/interviewer-portal`) compare the folder with that branch. Updating the hash is not enough: `checkDesign` still reports a mismatch. In the same sync, change that check so a file passes when its working-tree bytes match `lock.ts`, and so a difference from `feature/interviewer-portal` is printed and does not fail the command. Leave every file Ali did not touch on the old comparison. Do not run `npm run design:port`.
   - Update duplicated hex in the blocks and `ApplyForm.tsx` only where Ali changed that color or that form.
   - Update `studio/e2e/preview.spec.ts` only when `--blue-light` changed.
   - Copy a new logo into both logo paths when Ali replaced the mark.
   - Add a CSP host only when Ali's files load a new host. Do not edit `.github/security`.

4. Re-baseline only Ali's change.
   - Screenshot register: `website/tools/screenshot-parity/accepted-differences.json`. One entry per changed page or section. Selectors hide only the elements Ali changed. Reason text: `design change by Ali, <date>`. Widths stay `[1440, 768, 390]` unless the change is one width. Do not accept a whole page.
   - Section register: `website/tools/section-compare/accepted-differences.json`, only when the DOM changed, with the same reason. A color-only edit gets no section entry.
   - There are no stored PNG baselines to regenerate.

5. Verify, from `website/` unless noted. No content, copy, API, database, or role changes. No Studio end-to-end locally.

   ```powershell
   git diff --check
   npx tsx -e "import { designHash, designFileList } from './src/design/folder.ts'; console.log(designHash(), designFileList().length)"
   npm run typecheck
   npx vitest run test/design.test.ts
   npm run design:check
   $env:CONTENT_SOURCE = 'snapshot'
   $env:PUBLIC_SITE_URL = 'https://digitalhub.com.eg'
   npm run build
   Remove-Item Env:CONTENT_SOURCE, Env:PUBLIC_SITE_URL
   ```

   From `studio/`:

   ```powershell
   npx tsc -b --pretty false
   npx vitest run test/previewDesign.test.ts
   npm run build
   ```

   Screenshot compare, when it can run, from `website/` (tell Ali to add the `screenshots` label so CI runs the same job):

   ```powershell
   $env:SCREENSHOT_PORT = '4390'
   $env:SCREENSHOT_CANDIDATE_PORT = '4391'
   npm run compare:screenshots
   ```

   Spot-check one desktop page, one 390px page, header and form focus, and contrast. `npm run compare:sections` when markup changed.

6. Commit in this order, then push. Do not merge.
   - Ali's design edit, as he left it.
   - Dependents (lock, duplicated colors, logo, CSP, tests).
   - Register entries.
   - Docs (`website/README.md`, `docs/phase-c-website.md`, `docs/business-analysis.md`).

   Report in `D:\work\DigitalHub\agent-tasks\reports\cursor-design-sync-<n>.md`.

## What cannot stay consistent by itself

- `npm run design:check` and the vitest that reads `origin/feature/interviewer-portal` will fail after the first real edit until step 3 retargets them. That retarget is a code change made during the sync, not a reason to revert Ali's files.
- Screenshot parity has no image baseline. It fails until a register entry names the elements Ali changed. CI skips that job unless the pull request has the `screenshots` label.
- Section comparison does not see a color change. It will fail a layout change that alters the DOM, and the register entry has to be written by hand.
- Contrast is not measured by a test. A failure is reported to Ali.
- Open Graph images are content. They are not updated in a design sync.
- The Studio's own theme is a different design. It is not updated because the website CSS changed.
