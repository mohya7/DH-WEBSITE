# Phase C — Public website

Build brief for the local agent and the cloud agent. The public website on Next.js, built from the Content API, looking **exactly** like the current site.

**Read first:** `AGENTS.md` / `CLAUDE.md` — especially "Local and cloud work". Then `docs/business-analysis.md`, `docs/phase-a-foundation.md`, and `docs/phase-b-studio.md`, including every note recorded there for Phase C.

Every section is marked **[LOCAL]** or **[CLOUD]**.

- **[LOCAL]** sections are done by the local agent on this machine, on `rebuild/dotnet-platform`.
- **[CLOUD]** sections are written by the cloud agent on their own branch, opened as a pull request, and **verified and merged by the local agent** using the checklist at the end of this brief.

Sections run in order. A section starts only when the previous one is merged and its coverage table is confirmed.

---

## Settled decisions — do not revisit

| Area | Decision |
|---|---|
| Framework | Next.js App Router, static export. No Node server in production |
| Content at build | The build reads the Content API. Development and cloud work read the content snapshot instead |
| Design | **Locked.** Existing stylesheets from `feature/interviewer-portal` ported as they are. No Tailwind, no restyling, no "improvements" |
| Proof of design | Automated screenshot comparison of every page at desktop, tablet, and mobile widths against `feature/interviewer-portal`. Any difference fails unless it is in the allowed-differences register below |
| Interactive visuals | The WebGL hero, GSAP animations, and smooth scrolling carry over unchanged in behaviour, loaded exactly as the current site loads them — GSAP, ScrollTrigger, and Lenis eagerly from jsDelivr (3.3). Lazy loading is a later, separate performance change |
| URLs | Clean URLs. No legacy redirects — the old live site is out of scope. Redirects come only from the redirects table |
| References | `{ type, id }` resolved to paths at build. An unpublished or missing target is never a link; its card is skipped |
| Listing sections | Case cards and the blog list hide when nothing is published. The vacancy list shows its empty-state message |
| Rich text | Rendered as React elements from TipTap JSON. Never an HTML string. No `dangerouslySetInnerHTML` anywhere |
| Table of contents | Anchors generated from heading text at build, unique within each article |
| Images | Served from the build output with explicit width and height, responsive sizes from the stored variants, and the per-usage alt text or decorative flag |
| Contact form | Posts to `/api/v1/public/contact` on the same origin. Reaching the API is IIS routing, set up in Phase D |
| Careers application | Posts to the existing Node hiring system during the transition. The endpoint is configuration, not code |
| Error pages | 404 and 500 built from existing components only — header, footer, hub hero, call to action. No new styles |
| SEO | Lighthouse SEO 100 on every page type. The build fails below it |
| Analytics | Google Tag Manager and GA4, Consent Mode v2 defaulting to denied. Nothing non-essential loads before consent |

---

## The content snapshot

The one thing both agents depend on.

| | |
|---|---|
| Path | `website/fixtures/snapshot/` |
| Content | `website/fixtures/snapshot/content.json` — the build content endpoint's response, byte for byte |
| Images | `website/fixtures/snapshot/media/` — every media file the content references, all widths |
| Provenance | `website/fixtures/snapshot/README.md` — source database, API commit, date and time, and item counts |
| Source database | `DigitalHubContent_Parity` — never `DigitalHubContent` |
| Contains | Published content only. No drafts, contact requests, users, audit entries, tokens, or secrets |
| Regenerated | By the local agent's export script only. Never edited by hand |

### Why a parity database

On the real database, the case studies and blog posts are placeholder drafts, and the 404 and 500 pages are drafts. A website built from that would be missing whole regions of the current design, and screenshot comparison could not prove anything about them.

So the local agent creates `DigitalHubContent_Parity`: a fresh database, all migrations, the standard import, and then — **through the API, as admin** — the placeholder case studies, blog posts, and error pages published. The snapshot is the published content of that database. It stays "published content only", and the design can be compared in full.

The real database is never changed for this. Whether real drafts are excluded is proven separately, in Section 10.

---

## Allowed differences register

Screenshot comparison fails on any difference except these. Adding to this list needs my confirmation.

| Page | Difference | Why |
|---|---|---|
| Careers | Vacancy list shows its empty-state message instead of three job links | All six vacancies were test data; none were migrated |
| Careers detail | The three dummy job pages do not exist | Same |
| 404, 500 | New pages with no counterpart | The current site has none |
| Any page | Link targets use clean URLs instead of `.html` | Decided URL change; not visible in screenshots |

---

## Section 1 [LOCAL] — Build content endpoint and snapshot

**1.1** `GET /api/v1/build/content` returns everything a build needs, in one response:
- Every published page and collection item, with its sections, SEO fields, and share image
- Every `{ type, id }` reference resolved to a path; unpublished or missing targets omitted, and listed separately so the build can report them
- Media metadata: id, file names, dimensions, stored widths, default alt text
- Navigation, with internal links resolved to paths
- Site settings
- Redirects
- The 404 and 500 pages

**1.2** Authenticated by a **build token** from configuration — not a user login and not a user role. Compared in constant time. Stored in user-secrets as `Build:Token`, never committed, never given to the cloud agent. Rate-limited.

**1.3** The endpoint is not under `/api/v1/public/*`, so it is never reachable through the website's routing.

**1.4** A script creates `DigitalHubContent_Parity` from scratch — drop, create, migrate with the elevated account, import from `feature/interviewer-portal` — then publishes the placeholder case studies, blog posts, and error pages **through the API**, and exports the snapshot to `website/fixtures/snapshot/`. Idempotent. Record the exact command in `docs/phase-c-website.md`.

**1.5** Integration tests: the endpoint refuses a missing or wrong token; returns no drafts; omits unpublished references and lists them; contains no field from users, audit, contact requests, or secrets.

**1.6** Update the snapshot path in `CLAUDE.md` and `AGENTS.md` — replace "set in the Phase C brief" with `website/fixtures/snapshot/`. Tighten "One agent at a time in this folder" to "One agent at a time in this folder, and never on the same branch as the cloud agent." Keep the two files identical.

**1.7** Save this brief as `docs/phase-c-website.md`.

**1.8** Report the snapshot's item counts per type, its total size, and confirm it holds no drafts and no secrets. Commit and push.

---

## Section 2 [CLOUD] — Website scaffold and data layer

**2.1** Next.js App Router in `website/`, static export, TypeScript.

**2.2** One data layer with two sources, chosen by configuration:
- `CONTENT_SOURCE=snapshot` reads `website/fixtures/snapshot/`
- `CONTENT_SOURCE=api` reads `GET /api/v1/build/content` using `CONTENT_API_URL` and `CONTENT_BUILD_TOKEN`

If neither is configured, the build **fails** with a clear message. No silent default.

**2.3** Types generated from `packages/sections/*.json` and `packages/collections/*.json`, so a section's props match its schema. Report how.

**2.4** Routes for every page type with clean URLs, generated with `generateStaticParams`. Nothing is rendered for a draft.

**2.5** Images: static export cannot use Next's image optimiser. Render images with explicit width and height and a `srcset` from the stored widths. Copy the files into the build output.

**2.6** Asset hashing from the framework. No `?v=` query strings anywhere.

**2.7** The build completes against the snapshot. Report the page count and every route.

---

## Section 3 [CLOUD] — Port the design

**3.1** Copy the stylesheets from `feature/interviewer-portal` into the website **unchanged** — the same files, the same class names, the same order of loading. List every file.

**3.2** Fonts loaded exactly as the current site loads them.

**3.3** The WebGL hero, GSAP, and Lenis as client components, loaded as the current site loads them, lazily, respecting `prefers-reduced-motion`. *Updated at Section 3:* "as the current site loads them" takes precedence over "lazily". GSAP, ScrollTrigger, and Lenis load from jsDelivr, eagerly, at the end of the body, on the same page types as today. They and the ported page scripts load as plain `<script>` tags in their original positions, not as client components; they respect `prefers-reduced-motion` as the current scripts do.

**3.4** No Tailwind, no CSS modules, no restyling. If a style would have to change to work in Next.js, **stop and report it** — do not change it.

**3.5** Known defect in the source, decide at Section 3: `css/about-page.css` on `feature/interviewer-portal` (at `eb05f064`) has a stray `}` at line 176, straight after the `@media (prefers-reduced-motion:reduce)` block closes. Browsers read it as the start of the next rule's selector, so the `.about-services` rule that follows is dropped. Porting the stylesheet unchanged carries the bug over. Decide at Section 3 whether to fix it in the port; if it is fixed, add it to the allowed differences register, because the About page will then differ from `feature/interviewer-portal` in screenshots. *Decided at Section 3:* not fixed in the port. It is ported exactly as it is and will be fixed later as its own change.

### Section 3 — how the design is ported

**Where the files are.** `website/design/` mirrors the source layout — `css/`, `js/`, `assets/` — with original file names, so every relative `url()`, `@import`, and module import resolves exactly as it does today. `website/design/.gitattributes` (`* -text`) keeps the bytes identical on every checkout, Windows included. `npm run design:check` compares every file with `feature/interviewer-portal`; `npm run design:port` re-ports them. The files are served as static files, byte for byte, never through Next's CSS pipeline: Next rejects `about-page.css` (3.5) and rewrites everything it imports.

**Cache busting.** The build copies `website/design/` to `/design/<hash>/`, where the hash covers every file's path and bytes. Any change gives a new folder. Section 8: serve `/design/*` with long, immutable caching.

**Extracted inline blocks.** The home and contact `<style>` blocks, and the six home-page inline scripts, are files with bytes identical to the block contents: `index.inline.css`, `get-in-touch.inline.css`, `index.inline-1.js` to `index.inline-6.js`. They load at the same point in the order. The home block's four `url()`s are three fragment references (`#delivery-line-grad`, `#delivery-line-mid`, `#delivery-pulse-glow`) and one `data:` URI; the contact block has none.

**What each page type loads.** `website/src/design/sets.ts`, one set per page type, taken from the old pages and compared with them by `npm run design:check`. 404 and 500 use the hub set.

**Not ported.** `content/site-content.js` and `js/content-runtime.js` (content is rendered at build), `js/webgl-fluid.mjs` (unused), and the contact page's inline script — the old contact form handler, posting to `/api/contact/requests`. Section 5.4 builds the form.

**What the ported scripts read from the page.** Every element, id, and selector each ported script looks up, and the section that renders it. Until that section lands, a script that reads its element without checking for it throws; today that is `#nav`: `index.inline-3.js` and `js/service-page.js` look it up with `getElementById('nav')` and throw where they use it (line 442 and line 7), the cause of both console errors on the built home and service pages. No ported script reads `window.DH_CONTENT` or listens for `dh:content-ready`; the old runtime filled some of these elements, and Sections 4 and 5 render them at build instead, before the scripts run.

| Elements and selectors | Read by | Provided by |
|---|---|---|
| `#nav`, `#navBurger`, `#mobileNav`, `.nav-inner`, `.nav-link`, `.has-dd`, `.has-dd > .nav-link`, `.has-dd.open`, `.nav-links .has-dd` | `js/shared.js`, `js/about-page.js`, `js/service-page.js`, `index.inline-3.js`; `index.inline-4.js` reads `#nav` | 5.2 header |
| `.nav-link.is-active[href]`, `.dd a.is-active[href]`, `.mobile-nav a[href]` | `js/nav-stay-on-page.js` | 5.2 header |
| `#navIntro`, `.nav-inner .brand`, `.brand-logo`, `.nav-intro-logo`, `.nav-intro-brand`, `.nav-wipe`, `.nav-wipe-cover` | `index.inline-2.js`, `index.inline-3.js` | 5.2 header (home intro) |
| `a` — every link | `js/shared.js`, `index.inline-3.js` | 5.2 and every component: plain `<a>` |
| `[data-reveal]`, `[data-section-reveal]`, `[data-stagger-item]` | `js/shared.js`, `js/about-page.js`, `js/service-page.js`, `js/hub-pages.js`, `index.inline-3.js` | 4.1 — every section component that carries them on the old pages |
| `#top`, `#heroSandCanvas`, `#heroFluidCanvas`, `.h1-wrap`, `.h1-line > span` | `js/hero-fluid.js`, `index.inline-3.js` | 4.1 `hero` (home) |
| `#stats`, `.numbers`, `.numbers-row`, `.stat-num[data-count]` | `js/about-page.js`, `index.inline-3.js` | 4.1 `stats` |
| `#servicesScroll`, `#servicesPin`, `#servicesTrack`, `.services-viewport`, `.svc-card`, `.section.services` | `index.inline-4.js` | 4.1 `service_cards` (home) |
| `#aboutConstellation`, `.pp-canvas`, `.pp-node`, `.pp-conn__line` | `js/about-page.js` | 4.1 `service_cards` (about) |
| `#newsCarousel`, `#newsViewport`, `#newsTrack`, `#newsPrev`, `#newsNext`, `#newsDots`, `.news-slide`, `.news-carousel__dot` | `index.inline-5.js` | 4.1 `news_carousel` (home) |
| `.news-hub-grid .news-slide__details`, `.news-hub-item`, `.news-slide__panel` | `js/hub-pages.js` | 4.1 `news_carousel` (news page) |
| `#blogsCarousel`, `#blogsViewport`, `#blogsTrack`, `#blogsPrev`, `#blogsNext`, `.blog-dest` | `index.inline-6.js` | 4.1 `blog_list` (home) |
| `.hub-filters`, `.hub-filter`, `[data-category]` | `js/hub-pages.js` | 4.1 `blog_list` and `case_cards` (blogs and cases pages) |
| `#jtlWrap`, `.jtl-item`, `.jtl-slide`, `.jtl-track`, `.jtl-line`, `.jtl-line__fill`, `.jtl-dot`, `.jtl-item__btn`, `.jtl-visual` | `js/about-page.js` | 4.1 `timeline` |
| `#teamStrip`, `#teamStripViewport`, `#teamStripInner`, `#teamStripProgress`, `#teamStripPrev`, `#teamStripNext`, `.team-strip__item`, `.team-card__action`, `.team-card__action--linkedin[href="#"]` | `js/about-page.js` | 4.1 `team_grid` |
| `.page-partner-view .partner-overview` | `js/hub-pages.js` | 4.1 `partner_overview`, inside the partner page's `page-partner-view` class (5.1) |
| `#problemPipeline`, `#problemPipelineStatus`, `.pp-card`, `.pp-canvas`, `.pp-node`, `.pp-conn__line`, `.pp-conn__break` | `js/service-page.js` | 4.1 `problem` (service pages) |
| `#eswdDeck`, `#eswdStage`, `#eswdMenu`, `#eswdProgressBar`, `#eswdSceneNum`, `#eswdSceneName`, `#eswdStageGlow`, `.eswd-scene`, `.eswd-menu__item`, `.eswd-menu__title`, `.eswd-menu__media`, `.eswd-deck__progress`, `.eswd-scene__label`, `.eswd-scene__photo`, `[data-feature-block]` | `js/service-page.js` | 4.1 `feature_grid` (service pages) |
| `#method`, `#methodRows`, `#methodWire`, `#methodWireLine`, `#methodWireBg`, `#methodWireDot`, `#methodWireNodes`, `.method-wire-wrap`, `.method-row`, `.method-spine-node`, `.method-frame` | `js/service-page.js` | 4.1 `methodology` |
| `#contactForm`, `#situation`, `#submitBtn`, `#submitText`, `button[type="submit"]` | `js/about-page.js`, `js/service-page.js`, `index.inline-3.js` | 5.4 contact form, where a page renders one |
| `form.careers-apply-form`, `.careers-apply-form__error`, `.submit-btn`, `[data-careers-apply-lead]`, `[data-careers-apply-intro]`, `[data-careers-apply-reset]`, and the inputs `resume`, `role`, `roleSlug`, `yearsOfExperience`, `expectedSalary`, `expectedSalaryRange`, `noticePeriod`, `noticePeriodWeeks` | `js/careers-apply.js` | 5.5 careers form |
| `#dg-local-explain`, `#dg-local-storage`, `#dg-save-locally`, `#dg-new-constructor`, `head` | `js/webgl-fluid-lib.js` | Nothing: the library's own debug panel creates them |

**Script positions Sections 4 and 5 must keep.** `index.inline-2.js` straight after the header's `</nav>`; `js/hero-fluid.js` (module) inside the home hero, after `.hero-wires`; everything else after the footer. `index.inline-3.js` sets the fallback logo to `assets/digital-hub-logo.png`, relative to the page, so Section 5 serves that file at `/assets/digital-hub-logo.png`.

**Loading differences React 19 makes.** Stylesheets carry `data-precedence="design"`; module preloads come after the stylesheets instead of between the Tabler link and the home stylesheet. Neither changes what is applied or when scripts run.

**Decided at Section 3: static HTML, no client runtime.** React renders every page's HTML at build. The browser receives static HTML plus the ported scripts, exactly like today's site. Next's client runtime would hydrate the page and undo the ported scripts' changes (React error #418), so `npm run build` removes it after `next build` (`scripts/strip-runtime.ts`):

| Removed | Why it is safe |
|---|---|
| `<script src="/_next/…">` tags | Next's and React's client code. It hydrates the page and runs client-side navigation; the site uses neither |
| `<link rel="preload" as="script" href="/_next/…">` | Preloads one of those scripts; nothing would run it |
| `<script>self.__next_f…</script>` bootstrap and payload | The React Server Components payload. Only the runtime reads it; the HTML already holds everything it describes |
| `<div hidden=""><!--$--><!--/$--></div>` | An empty outlet the runtime streams metadata into. Removing it keeps the first script first in `<body>`, as on the old pages |
| empty `<!--$--><!--/$-->` pairs | React's markers for hydration; they mark nothing |
| `.txt` files and `/_next/` scripts | Fetched only by the runtime and client-side navigation. No page references them after the above |

The output check fails the build if any page still has a trace of the runtime, if any `.txt` payload or `/_next/` file remains, or if any page's head tags, design set, title, sections, or image are missing from its static HTML. No component may use client-side effects or state to produce markup, and `"use client"` is allowed only in a listed set of files, each with its reason; `website/test/design.test.ts` ("static HTML only") enforces both. `npm run dev` still runs Next's runtime: check ported-script behaviour against `npm run build` output.

### Ported with changes

| File | Line | Before | After | Reason |
|---|---|---|---|---|
| `js/hero-fluid.js` | 7 | `import WebGLFluid from "./webgl-fluid-lib.js?v=26";` | `import WebGLFluid from "./webgl-fluid-lib.js";` | No `?v=` query strings anywhere (2.6). The design folder is content-hashed instead |

### Links

The website uses ordinary full-page links, never Next's client-side navigation, so the ported scripts run on every page load exactly as today. The website's link adapter renders plain `<a>` elements.

---

## Section 4 [CLOUD] — Section components

**4.1** One React component per section type — all 28 — in `packages/blocks/`, producing the **same markup and class names** as the current HTML, so the ported stylesheets apply without change.

**4.2** Components import nothing Next-specific. Images and links go through small adapters that the website and the Studio each supply.

**4.3** Rich text renderer: TipTap JSON to React elements, allowed nodes only. Table-of-contents anchors generated from heading text, unique per article.

**4.4** References render as links to their resolved paths. A reference with no path renders nothing — no broken link, no empty card.

**4.5** Listing sections: case cards and the blog list render nothing when empty; the vacancy list shows its empty-state message.

**4.6** A test per component against its schema's sample data.

### Section 4 — how the components are built

**Verified against the old pages after their runtime.** Each component renders what `feature/interviewer-portal` shows once `content-runtime.js` has filled it in. The comparison serves that branch statically, runs only `site-content.js` and `content-runtime.js`, and compares every `main > section` with the new build: elements, nesting, ids, classes, every other attribute, and text. It ignores only link targets and image file details (`src`, `srcset`, `sizes`, `width`, `height`, `loading`, `decoding`, `fetchpriority`, and `url()` in styles).

**Lists the old runtime built** (home services, partners, cases, blogs, news; team; vacancies; the home counters) are built from the published collections the same way; the section's fields supply the headings.

**`faq`** has no page on the old site. It uses the one FAQ design the old site has, the blog-post FAQ (`renderFaq` in `scripts/blog-pages.js`, `.blog-view-faq` in `hub-pages.css`): the same markup, first item open.

**Script-dependency table, as found.** `[data-feature-block]` is on the industry cards (`industries`), not the feature grid. `.eswd-menu__media` (`js/service-page.js`) and `.news-carousel__dot` (`index.inline-5.js`) are created by the scripts themselves and are not in the old HTML.

**Content-model gaps, not changed.** Three kinds of inline emphasis were lost at import because the fields are plain text: the `<em>` in case-study hero headings, the `<strong>` in service hero ledes, and the inline `<a class="accent">` at the end of the service problem leads. Keeping them needs a schema change (and a migration of the stored values), which is local work; the components render the plain text.

**Output check.** The static-page check now expects one `<h1>` (the hero's, or the item's title on a page without a hero) and one `<section>` in `<main>` for each section that renders; `sectionRenders` says which listing sections render nothing.

---

## Section 5 [CLOUD] — Pages, navigation, and forms

**5.1** Compose every page type from its sections. One `h1` per page — the page title.

**5.2** Header and footer from navigation and site settings. Email, phone, and social links from site settings only.

**5.3** 404 and 500 from existing components only.

**5.4** Contact form posts to the relative path `/api/v1/public/contact`: the honeypot field, client-side validation for convenience, and the labels, placeholders, button texts, success, and error messages from the section's fields.

**5.5** Careers application form posts to the Node hiring endpoint, from configuration. Same file limits as today: 5 MB, PDF, DOC, DOCX.

*Decided at Section 3 — 5.4 and 5.5:* the contact form's and careers form's behaviour — validation, submission, and messages — are plain scripts in the ported style, not React client components: the website ships no client runtime. React renders the forms' markup at build. The same rules apply: no `innerHTML` with content, and no personal data sent to analytics.

*Recorded at Section 3 — header and logo:*

- Once the header exists, the logo test for `index.inline-2.js` becomes a saved browser test, run against the built output (`npm run build`, runtime stripped): with the intro skipped (reduced motion), the logo moves into `.nav-inner .brand`, `#navIntro` is removed, and `nav-shown` on `<html>` and `nav-ready loaded intro-grid-reveal` on `<body>` persist after load.
- Section 5 serves `/assets/digital-hub-logo.png`, the fallback logo `index.inline-3.js` sets relative to the page.

**5.6** Report every page and the sections it renders.

*Recorded at Section 4 — what the section comparison found missing:*

- **Blog post pages render their full article**: body, table of contents, related
  items, and FAQ where present. Today they render only the title and image —
  `/blogs/azure-digital-egypt-2030` is 1,783 bytes with 85 characters of text —
  so all 15 of the five pages' sections render nothing.
- **The apply page renders its application form** (5.5). Today its second section
  renders nothing.
- **The section comparison counts a section that renders nothing as a failure**,
  and reports the full denominator: **119**, every section on the old pages, not
  103. At Section 4 it stands at 80 of 119 — 23 differing, 16 rendering nothing.
  Reporting only the sections the build happens to render hides the pages that
  are not built yet. Run it with `node tools/section-compare/server.mjs` in
  `website/`.

---

## Section 6 [CLOUD] — SEO

**6.1** Per page: title, meta description, canonical, share image with its alt, and noindex where set.

**6.2** Structured data:

| Page | Schema |
|---|---|
| Every page | Organization, WebSite, BreadcrumbList |
| Service | Service |
| Blog post | Article |
| Vacancy | JobPosting |
| Pages with an FAQ section, and blog posts with FAQ items | FAQPage |

Organization uses the site settings, including the postal address fields.

**6.3** `sitemap.xml` with last-modified dates from editorial dates, published and indexable pages only. `robots.txt`. `llms.txt`.

The last-modified date is the **editorial date**: `dateModified` where the item has
one, otherwise its most recent publish time. Never the snapshot's `generatedAt` or
the export time. Snapshot timestamps reflect when the snapshot was exported, not
when anyone changed the content, and they move on every refresh — they are
acceptable for development builds only.

**6.4** Run Lighthouse against the snapshot build and report every page type's SEO score. Report what could not be run.

---

## Section 7 [CLOUD] — Cookie consent and analytics

**7.1** Tag Manager container ID from site settings. Nothing loads when it is empty.

**7.2** Consent banner with categories — necessary, analytics, marketing. Consent Mode v2, defaulting to denied. Choice stored in a first-party cookie for 12 months. "Cookie settings" in the footer reopens it. Banner text from site settings.

*Decided at Section 3:* the consent banner is a plain script, not a React client component: the website ships no client runtime. React renders its markup at build. The same rules apply: no `innerHTML` with content, and no personal data sent to analytics.

**7.3** Events: contact form submitted, application submitted, calls to action clicked. **No personal data** — no names, email addresses, or form content.

**7.4** List every domain Tag Manager and GA4 need, for the content security policy in Section 8.

---

## Section 8 [CLOUD] — IIS configuration for the static site

**8.1** A `web.config` generated at build:
- Clean URL rewrites
- Redirects from the redirects table, as 301s
- Custom 404 and 500 pages returned with the correct status codes — never 200
- Security headers: Content-Security-Policy, Strict-Transport-Security, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`
- The Content-Security-Policy extended for the domains from 7.4, shipped in **report-only** mode first
- Cache headers: hashed assets immutable for a year; HTML short

**8.2** Routing to the API and the Node hiring system is Phase D. Do not add it here.

*Decided at the Section 8 check:* `Strict-Transport-Security` is `max-age=31536000`, without `includeSubDomains`. Revisit that once decision D1 (staging and production domains) is settled.

---

## Section 9 [CLOUD] — Studio preview and website address

**9.1** The Studio's preview renders a draft with the `packages/blocks` components and the website's stylesheets, **inside an iframe**, so the website's styles never leak into the Studio.

**9.2** `VITE_PUBLIC_SITE_URL` is set per environment. Remove the hard-coded fallback in `studio/src/content/model.ts`: a missing value fails loudly.

**9.3** No change to the Studio's own look.

---

## Section 10 [LOCAL] — Verification

**10.1** Serve `feature/interviewer-portal`'s public files statically, and the new site built in snapshot mode.

**10.2** Screenshot parity for every page at desktop, tablet, and mobile widths. Wait for the current site's runtime content to load before capturing. Any difference outside the allowed-differences register fails. Report each page's result.

**10.3** Lighthouse on every page type: SEO 100, Accessibility 95 or above, Performance 93.5 or above, Best Practices 99 or above.

**10.4** Mobile: zero horizontal overflow at 390px and 320px on every page.

**10.5** Structured data validates with no errors.

**10.6** Build against the real Content API in `api` mode, from `DigitalHubContent_Studio`. Confirm drafts are excluded, listing sections hide, and unpublished references render nothing.

**10.7** Every redirect in the table resolves to a page returning 200.

**10.8** The build output contains no source files, fixtures, configuration, or secrets.

**10.9** The contact form submits end to end to the API; the honeypot stores nothing.

**10.10** Studio preview renders a draft correctly; the Studio's end-to-end suite still passes.

**10.11** Every section's coverage table carried into one final Phase C table.

---

## How the local agent verifies a cloud pull request

For every [CLOUD] pull request, before merging:

1. Check out the branch. Confirm it changes only what its section covers
2. Confirm it adds no migration and does not touch the database
3. Build the website in snapshot mode
4. Run the website's tests, the API integration suite, and — if the Studio changed — the Studio's end-to-end suite
5. Run screenshot parity on the pages the section affects
6. Report with a coverage table: each item in that section, and the evidence
7. Merge only if everything passes. If anything fails, **report it back** — do not fix it silently
8. After merging, re-run the suites on `rebuild/dotnet-platform`

---

## Content tasks for later — not agent work

Recorded so they are not lost. Done by an editor in the Studio against the real database, before cutover:

- Review and publish the 404 and 500 pages
- Add a share image for the careers and apply pages
- Replace the TikTok link with the clean profile URL
- Rewrite and publish the placeholder case studies and blog posts

---

## Section 1 — how the snapshot is built

Regenerate the content snapshot with one command, from the repository root:

```bash
node api/tools/parity-snapshot.mjs
```

It drops and recreates `DigitalHubContent_Parity`, applies the migrations with
the elevated account, grants the application login, imports from
`feature/interviewer-portal`, starts the API against that catalog on port 5097,
publishes the placeholder case studies, blog posts and error pages **through the
API as admin**, then writes `website/fixtures/snapshot/`. It is idempotent: the
catalog is rebuilt from nothing every run.

The real database is never touched. The script refuses to start if the connection
string resolves to anything but `DigitalHubContent_Parity`, and the import tool
keeps its own allow-list of catalogs it may write to.

### The build token

`GET /api/v1/build/content` is authenticated by `Build:Token` from configuration,
compared in constant time. It is not a user login and not a role: an admin's
bearer token does not open it. Set it once per machine:

```bash
dotnet user-secrets set "Build:Token" "<a long random value>" --project api/src/DigitalHub.Api/DigitalHub.Api.csproj
```

Never commit it and never give it to the cloud agent, which builds against the
snapshot instead. The parity script generates its own throwaway token for the
API instance it starts, so the real one is not needed to refresh the snapshot.

When no token is configured the endpoint refuses every caller, so it cannot be
left open by leaving the setting out.
