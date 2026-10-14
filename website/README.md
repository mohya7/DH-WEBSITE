# Website

Next.js App Router, static export, TypeScript. Built in Phase C
(`docs/phase-c-website.md`).

## Build

```bash
cd website
npm ci
CONTENT_SOURCE=snapshot CAREERS_APPLICATION_ENDPOINT=/api/careers/applications npm run build
CONTENT_SOURCE=api CONTENT_API_URL=http://localhost:5097 \
  CONTENT_BUILD_TOKEN=<Build:Token> CAREERS_APPLICATION_ENDPOINT=/api/careers/applications npm run build
```

The output is `out/`. There is no default source: with `CONTENT_SOURCE` unset,
or set to anything but `snapshot` or `api`, the build stops and says what to set.
On Windows PowerShell, set the variables with `$env:CONTENT_SOURCE = "snapshot"`.

`npm run build` runs seven steps, and any of them can stop the build:

| Step | What it does |
|---|---|
| `gen:types -- --check` | Fails if `packages/blocks/src/generated/schema-types.ts` is out of date with `packages/sections` or `packages/collections` |
| `prepare:content` | Reads the configured source **once**, checks it, writes `.content/` and `public/media/` |
| `prepare:design` | Copies `design/` to `public/design/<hash>/` |
| `next build` | Renders every page from `.content/` |
| `strip:runtime` | Removes Next's client runtime from every page: the site ships static HTML plus the ported scripts |
| `webconfig` | Writes `out/web.config` from the redirects in the prepared content |
| `check:output` | Checks `out/`, including that `web.config`, and prints the page count and every route |

`npm run dev` runs the first three steps, then `next dev`. The dev server still runs Next's client runtime, which can undo the ported scripts' changes; check their behaviour against `out/` from `npm run build`.

## Data layer — `src/content/`

| File | Role |
|---|---|
| `config.ts` | Reads `CONTENT_SOURCE`, `CONTENT_API_URL`, and `CONTENT_BUILD_TOKEN`. No default. Test only: `SNAPSHOT_SETTINGS_FIXTURE` |
| `sources.ts` | `snapshot`: `fixtures/snapshot/content.json` and `fixtures/snapshot/media/`. `api`: `GET {CONTENT_API_URL}/api/v1/build/content` with the `X-Build-Token` header, and media from `{CONTENT_API_URL}/media/` |
| `validate.ts` | Checks every section and item against its JSON Schema (Ajv, the same files the API uses), the counts, and the media |
| `routes.ts` | One route per published item with a path, at exactly the path the API resolved. Clean, unique, not reserved |
| `media.ts` | Variant file names, `srcset`, alt text, and which media published content uses |
| `prepare.ts`, `prepared.ts` | Write and read `.content/content.json` and `.content/manifest.json` |
| `site.ts` | What pages call: `getSite()` — routes, media, references, error pages |

**Why a prepare step.** Next renders pages in several worker processes. If each
one read the API, a build would make several requests to an endpoint limited to
30 an hour, and pages could come from different moments in the content. The
prepare step reads the source once. Every page is rendered from that copy.
`next build` on its own checks the configuration too, and refuses prepared
content that came from a different source or no longer matches the snapshot.

The token is sent only as a request header. It is never written to `.content/`,
to the output, or to the log.

## Types from the schemas — `npm run gen:types`

`scripts/generate-schema-types.ts` reads `packages/sections/*.json`,
`packages/sections/defs.json`, and `packages/collections/*.json`, and writes
`packages/blocks/src/generated/schema-types.ts`, beside the section components
that use it (`src/content/generated/schema-types.ts` re-exports it):

- one interface per section (`HeroFields`, …) and per collection (`BlogPostsFields`, …)
- `Media`, `Reference`, `Link`, `TextPair`, and `Block` from `defs.json`
- `Section`, a union discriminated by `type`, so a section's `fields` are typed by its type
- `sectionTypes` and `collectionNames` as constants

It handles only the JSON Schema keywords the schemas use, and stops with an error
on any other, so a new construct cannot be typed wrongly by accident. Commit the
regenerated file with any schema change: the build fails while it is stale.

Types cover the code. `validate.ts` covers the data: the build fails if the
content it received does not match the same schemas.

## Routes

`src/app/[[...path]]/page.tsx` serves every page type — home, pages, services,
partners, case studies, blog posts, vacancies — through `generateStaticParams`,
with `dynamicParams = false`. `src/app/not-found.tsx` builds `404.html`, and
`src/app/500/page.tsx` builds `500.html`, from the `error-404` and `error-500`
page records.

Pages are exported as `about.html`, `services/ai-automation.html`, and so on.
Links use the clean path (`/about`). Mapping one to the other in IIS is Section 8.

## Sections — `packages/blocks`

Pages render their sections with the components in `packages/blocks`
(Section 4). `src/content/blocks.ts` gives them their context: the page, the
image and link adapters (`src/adapters/`), reference resolution, and the
published collections. `src/content/block-data.ts` is the same without the
adapters, for build scripts. `next.config.ts` sets `turbopack.root` to the
repository root so the build can import a package outside `website/`.

## Images

Static export cannot use Next's image optimiser, and `next/image` is not
configured, so using it fails the build. `src/adapters/Image.tsx` renders `<img>`
with the stored width and height, a `srcset` from the stored variant widths
(`<hash>-w640.webp`, …), and the usage's alt text or an empty alt when
decorative. The prepare step copies the files published content uses into
`public/media/`, and Next copies them into `out/media/`.

## Design — `design/`

The stylesheets, scripts, and the assets they reference, ported from
`feature/interviewer-portal` byte for byte (Phase C, Section 3). The build copies
the folder to `/design/<hash>/`, where the hash covers every file, and each page
type loads its set from `src/design/sets.ts` with plain `<link>` and `<script>`
tags in the old order. They never go through Next's CSS pipeline.

```bash
npm run design:check                        # compare with origin/feature/interviewer-portal
npm run design:check -- --source-dir "D:\work\DigitalHub\New Website\DH-WEBSITE-main"
```

It checks every file's SHA-256 and every design set's loading order against the
old pages. The one permitted change is listed in `docs/phase-c-website.md`,
"Ported with changes". Never edit `design/` by hand.

## Tests

```bash
npm test            # Vitest
npm run typecheck   # tsc, including the compile-time checks in test/schema-types.test.ts
```

Browser checks run against the built output. Install Chromium once with
`npx playwright install chromium`, or use installed Chrome by setting
`PLAYWRIGHT_CHANNEL=chrome`. For example, in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:WEBSITE_TEST_PORT = '4177'
npm run test:browser
$env:SECTION_COMPARE_PORT = '4190'
npm run compare:sections
```

`WEBSITE_TEST_PORT` controls both Playwright and `tools/serve-built.mjs` (default
4177). `SECTION_COMPARE_PORT` controls both comparison entry points (default
4190). `PARITY_API_PORT` controls the snapshot API (legacy default 5097); use
4197 for the Section 5 task's 41xx rule. Servers never reuse an occupied port.

### Cookie consent and Tag Manager

The Tag Manager container id comes only from the site settings (Studio, Site
settings, "Analytics container ID"); there is no build variable for it. With no
id, the build has no banner, no consent script or stylesheet, no footer
"Cookie settings" link, and the content security policy has no Google tag hosts.
The snapshot has no id, so test the consent build with the test-only settings
fixture, which `CONTENT_SOURCE=api` refuses:

```powershell
$env:CONTENT_SOURCE = 'snapshot'
$env:SNAPSHOT_SETTINGS_FIXTURE = 'consent'   # fixtures/settings/consent.json: GTM-TEST1234
$env:CAREERS_APPLICATION_ENDPOINT = '/api/careers/applications'
npm run build
npm run test:browser       # browser-tests/consent.spec.ts runs only on this build
npm run compare:sections
```

`browser-tests/pages.spec.ts` checks the build without an id. Both specs read
`out/index.html` to tell the two builds apart.

`test/blocks/` renders every section of the snapshot through `packages/blocks`
with the website's adapters (4.6), and the rich-text renderer (4.3).

The `api` source is tested against a local HTTP server that behaves like the
build endpoint. It checks the token, returns 401 and 429, and serves media.

## Section comparison — `tools/section-compare`

Compares every `main > section`, desktop/mobile header, and footer with the same page on
`feature/interviewer-portal`, after only that page's content runtime has run.
Every verification of a website change uses it.

```bash
cd website
CONTENT_SOURCE=snapshot CAREERS_APPLICATION_ENDPOINT=/api/careers/applications npm run build
node tools/section-compare/server.mjs
```

Then open the printed address. Results are on the page, and in `window.__result`
for a script to read. Pass the source and build roots as arguments to override
the defaults (`node tools/section-compare/server.mjs <oldRoot> <newRoot> [port]`).

It serves the source branch with every script removed except `site-content.js`
and `content-runtime.js`, so the comparison sees what a visitor saw, without
GSAP, Lenis, or the page scripts mutating the DOM. The new pages are parsed, not
executed: the site ships static HTML.

A section that renders nothing in the new build **counts as a failure**, and the
denominator is every section on the old pages — not only the ones the new build
happens to render. Link targets, image file details, and `url()` inside style
attributes are ignored. Script elements are ignored on both sides; the build's
loading-order checks and browser tests verify scripts separately. Inline styles
are compared as sorted CSS declarations, so equivalent serialization matches.

`tools/section-compare/accepted-differences.json` is the committed register, with
reasons. Its rules accept six absent article sections, the careers empty state,
and the four service case-label corrections only. Other changes in those same
sections still fail. The section denominator stays 119; chrome is counted
separately. Absent draft pages have no chrome. `npm run compare:sections` writes
`artifacts/section-comparison.json` and exits nonzero for an unregistered
difference or a changed denominator. Part B's publication-date issue remains a
failure until the content-model change is approved; it is not an accepted difference.

The page pairs live in `tools/page-pairs.mjs`, the one list both comparisons use.
The section comparison loads it from its server at `/page-pairs.mjs`.

## Screenshot comparison — `tools/screenshot-parity`

Photographs every page pair, full page, at 1440, 768, and 390 px, in each chosen
browser, and compares the pixels of the old page and the built page.

```powershell
$env:SCREENSHOT_BROWSERS = 'chromium,firefox'   # default: chromium,firefox,webkit
$env:SCREENSHOT_PORT = '4298'                   # the old site; default 4390
$env:SCREENSHOT_CANDIDATE_PORT = '4299'         # the built site; default 4391
npm run compare:screenshots
```

| Variable | Meaning |
|---|---|
| `SCREENSHOT_BROWSERS` | Comma list of `chromium`, `firefox`, `webkit`. A browser that is asked for and cannot launch stops the run before any page is served; one that is not asked for is never launched. WebKit cannot run on the Windows development machines (Application Control). |
| `SCREENSHOT_PORT`, `SCREENSHOT_CANDIDATE_PORT` | Any two different ports from 1024 to 65535. Use your own range (Codex 41xx, Claude Code 42xx, Cursor 43xx). |
| `SCREENSHOT_OLD_ROOT`, `SCREENSHOT_NEW_ROOT` | The old site (default the local `DH-WEBSITE-main` checkout, only read) and the build (default `out/`). |
| `SCREENSHOT_OUT` | Where `report.html`, `results.json`, and the failing captures go (default `tools/screenshot-parity/output/`). |

How a capture is judged:

- **Settling.** Reduced motion; the page is scrolled once to the bottom and back;
  reveal targets and counters get their final state; every image is loaded and
  decoded; fonts are ready; then the page is captured until two consecutive
  captures are identical (at most five). A page that never gives two identical
  captures is `unstable`, which fails.
- **Zero tolerance.** Every changed pixel counts: pixelmatch threshold 0 with
  anti-aliased pixels included (`threshold.json`).
- **Images.** The media pipeline re-encodes images as WebP, so image pixels are
  replaced by one flat colour on both sides before the diff (marketing lead
  decision). Each `img` and `url()` background is compared by its box (position
  and size, within 0.5 px) and its intrinsic aspect ratio (within 1%): a moved,
  resized, reshaped, or missing image fails. Each image is also scaled to 32×32 on
  both sides and scored (1 is identical); the ten least similar are listed in the
  report without failing, so a wrong picture still gets seen.
- **Masks.** `masks.json` hides the two home hero canvases, which redraw every frame.
- **Register.** `accepted-differences.json` entries are scoped: each names the page
  pairs, widths, browsers, and one or more selectors, which are hidden on both
  sides for those captures only. Everything else on the page is still compared.
  An entry whose selectors hide nothing on either side is an error, so a stale
  entry cannot linger. A whole capture cannot be accepted. Agents only propose
  entries; Ali (marketing lead) approves each one before it is added. The
  approved entries:
  - `footer-company-column-links`: hides the footer Company column's link texts on
    every page; the column and its heading are still compared. Approved by Ali.
  - `footer-main-email`: hides the footer email link on every page except careers,
    apply, and the articles. Approved by Ali.
  - `footer-copyright-build-year`: hides the footer copyright line (the build
    year) on every page. Approved by Ali.
  - `article-footer-service-labels`: hides the footer Services column's link texts
    on the three article pages; the column and its heading are still compared.
    Approved by Ali.
  - `contact-section-email`: hides the sales email link in the contact page's
    contact details. Approved by Ali.
- **Absent pages.** A pair whose built page answers 404 is `absent-accepted` when
  the section register lists its old path as `absent-page`; otherwise it is an error.

`node tools/screenshot-parity/proof.mjs` proves the comparison on the old site
alone: old against old, one colour changed in a copy of a stylesheet, and a
masked canvas painted on one side.
