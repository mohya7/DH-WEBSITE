# SYSTEM-INVENTORY

Read-only technical inventory of repository `DH-WEBSITE-main`.  
Generated from files on disk. Claims cite paths. Where evidence is missing: `[UNKNOWN]` with the location checked.

---

# STEP 1 — SYSTEM DISCOVERY

## 1.1 Directory tree (depth 3)

Exclusions applied: `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`).  
`dist/`, `build/`, `.next/` were not present at repo root when the tree was listed.

```
DH-WEBSITE-main/
.cursor/
  settings.json
admin/
  admin.css
  admin.js
  index.html
assets/
  blog/
  careers/
  cases/
  clients/
    original/
    uploads/
  history/
  method/
  news/
  services/
  team/
  uploads/
  AWS-logo.webp
  digital-hub-logo.png
  efinance-logo.svg
  huawei-logo.webp
  microsoft-logo.png
  nexthink-logo.png
  vodafone-logo.svg
blogs/
  augment-vs-outsource-tech-team.html
  azure-digital-egypt-2030.html
  digital-employee-experience.html
  digital-transformation-signs.html
  enterprise-ai-production.html
  index.html
careers/
  apply.html
  data-analyst.html
  dotnet-backend-developer.html
  full-stack-developer.html
  index.html
cases/
  data-center-transformation.html
  index.html
  ministry-planning.html
  nexthink-dex-bank.html
content/
  application-files/          (LEGACY — gitignored; CVs now in SQL Server dbo.application_resumes)
  admin-content.json
  admin-content.json.bak-20260812-173900
  admin-users.json            (LEGACY — gitignored; accounts now in SQL Server dbo.admin_users)
  contact-requests.json       (gitignored; present on disk)
  job-applications.json       (LEGACY — superseded; hiring store is SQL Server DigitalHubHiring)
  onboarding-requests.json    (LEGACY — superseded; hiring store is SQL Server DigitalHubHiring)
  site-content.js
  site-content.json
  validation-config.json
lib/
  hiring-db.js                (SQL Server hiring/onboarding via mssql + SQLSERVER_* env)
  mail.js
css/
  about-page.css
  careers-page.css
  hub-pages.css
  responsive.css
  service-page.css
  shared.css
  tv.css
js/
  about-page.js
  careers-apply.js
  content-runtime.js
  hero-fluid.js
  hub-pages.js
  nav-stay-on-page.js
  service-page.js
  shared.js
  webgl-fluid-lib.js
  webgl-fluid.mjs
news/
  index.html
partners/
  efinance.html
  huawei.html
  index.html
  microsoft.html
  nexthink.html
  vodafone.html
scripts/
  (many .js build/SEO/image utilities; scripts/package.json)
services/
  ai-automation.html
  data-analytics.html
  enterprise-software.html
  outsourcing.html
.gitignore
about-us.html
ADMIN.md
get-in-touch.html
index.html
llms.txt
package.json
robots.txt
server.js
```

Additional root note: `docs/` did not exist before this inventory; this report is the first file under `docs/`.

## 1.2 Manifest files found

| Path | Type |
|------|------|
| `package.json` | npm (root app) |
| `scripts/package.json` | npm (scripts subfolder) |
| `composer.json` | **Not found** (repo-wide glob) |
| `requirements.txt` | **Not found** (repo-wide glob) |
| `go.mod` | **Not found** (repo-wide glob) |

Lockfiles present (excluded from tree listing above but verified): `package-lock.json`, `scripts/package-lock.json`.

## 1.3 Systems A–D — existence verdict

| System | In this repo? | Root / surface | Evidence |
|--------|---------------|----------------|----------|
| **A. Public website** (digitalhub.com.eg rebuild) | **YES** | Repo root: static HTML under `/`, `services/`, `partners/`, `cases/`, `blogs/`, `careers/`, `news/`, plus `css/`, `js/`, `assets/` | `index.html`; `SITE_URL = 'https://digitalhub.com.eg'` in `server.js:15`; sitemap fixed pages in `server.js:2352-2381`; `robots.txt:10` Sitemap URL |
| **B. CMS** (blog/content management, admin panel) | **YES** | `admin/` UI + `server.js` content APIs + `content/admin-content.json` | `ADMIN.md` (“Digital Hub Content Studio”); `admin/index.html`; collections/pages in `server.js:39-40`; `writeDerivedFiles` regenerates public content `server.js:767-781` |
| **C. HR portal** | **YES** (not a separate package) | Same `admin/` SPA, role `hr` | `permissionsFor` `canUseHiring: hr` `server.js:711`; client brand “HR PORTAL” / route gates in `admin/admin.js` (role checks ~183–225, ~699–705); HR APIs under `/api/admin/applications`, pipeline, vacancies, calendar-related client views |
| **D. Marketing portal** | **YES** (not a separate package) | Same `admin/` SPA, role `marketing` | `permissionsFor` `canUseOnboarding: hr \|\| marketing` `server.js:712`; `requireOnboarding` allows hr+marketing `server.js:984-991`; marketing-only route gate `admin/admin.js` (~704); onboarding Marketing actions `server.js:2021-2051` |

**Not found as separate apps/repos in this tree:** standalone HR or Marketing repositories, PHP/Laravel apps, React/Next apps, Docker Compose stacks, or CI workflow directories (`.github/` absent — glob for Dockerfiles / YAML deploy configs returned no project deploy configs; only asset `assets/method/deploy.webp`).

Architectural note (verified): A–D share one Node HTTP process (`server.js`) and one admin SPA (`admin/`). C and D are **role-gated surfaces**, not independent deployable roots.

---

# STEP 2 — PER-SYSTEM INVENTORY

---

## 2.A Public website

### 2.A.1 Stack and runtime

- **Language:** HTML, CSS, client JavaScript; served by Node when `server.js` runs.
- **Framework:** None declared in `package.json` (no Express/Next/React/Vue). Static files + lightweight custom server.
- **Manifest versions (`package.json`):**
  - Project `"version": "1.0.0"`
  - `"type": "commonjs"`
  - Dependencies: `nodemailer` `^9.0.5`, `sharp` `^0.35.3` (used by server for uploads/mail; public pages do not import them directly)
- **Scripts (`package.json:6-12`):**
  - `start` / `dev`: `node server.js`
  - `seo:build`: `node scripts/seo-build.js`
  - `seo:audit`: `node scripts/seo-audit.js`
  - `check`: multi-file `node --check …`
  - `test`: `npm run check && npm run seo:audit`
- **Node version constraint in root `package.json`:** **none** (`engines` absent).  
  Indirect: `package-lock.json` `node_modules/sharp` / platform packages declare `"node": ">=20.9.0"`; `nodemailer` declares `"node": ">=6.0.0"`.
- **`package.json` `"main": "index.js"`** (`package.json:5`) but **no `index.js` file exists** (repo-wide glob for `index.js` → 0 files). Actual entry used by scripts: `server.js`.
- **Rendering model: hybrid static + client hydration + occasional server-generated HTML**
  - Designed pages are on-disk `.html` files (e.g. `index.html`, `services/*.html`).
  - CMS-driven card/section copy injected by `js/content-runtime.js` reading `window.DH_CONTENT` from `content/site-content.js` (and/or `/api/content` / `site-content.json` — see runtime).
  - If no on-disk HTML exists for a published CMS detail path, `serveStatic` can emit `renderGeneratedDetail` HTML (`server.js:2865-2877`, `2726+`).
  - Proof of static preference: comment at `server.js:2865-2866`.

### 2.A.2 Directory map (top-level under repo root relevant to public site)

| Directory / file | Actual contents (from inspection) |
|------------------|-----------------------------------|
| `index.html`, `about-us.html`, `get-in-touch.html` | Marketing landing / about / contact pages |
| `services/` | Four designed service detail HTML pages |
| `partners/` | Partners hub + five partner pages |
| `cases/` | Case studies hub + three case pages |
| `blogs/` | Blog hub + five article HTML pages |
| `careers/` | Careers hub, three job HTML pages, `apply.html` |
| `news/` | News hub `index.html` |
| `css/` | Shared and page-specific stylesheets |
| `js/` | Public-site scripts (nav, content runtime, service/about/careers behaviors, WebGL fluid) |
| `assets/` | Images/logos/uploads for the site |
| `content/site-content.json`, `content/site-content.js` | Generated public CMS snapshot |
| `robots.txt`, `llms.txt` | Crawler / LLM guidance files |
| `server.js` | HTTP server that serves the static tree and APIs |

**Entry points:**
- Public browsing: any `*.html` via static server; default `/` → `/index.html` (`server.js:2836`).
- Process entry: `npm start` → `node server.js` (`package.json:7`).

### 2.A.3 Data layer

- **Persistent public marketing content:** file-based JSON/JS generated from admin store.
  - Paths: `content/site-content.json`, `content/site-content.js`
  - Naming: fixed filenames (not per-record files)
  - File count for public mirror: **2** generated files (+ optional backups elsewhere)
  - Written by `writeDerivedFiles` (`server.js:767-781`)
- **Representative top-level structure** (`content/site-content.json`): keys `meta`, `pages`, `collections`.
  - `meta`: `version`, `revision`, `updatedAt`
  - `pages`: `home`, `blogs`, `cases`, `partners`, `careers`, `about`, `news` (field unions documented in content exploration: label/title/lead/sectionTitle/sectionLead; home adds `seoTitle`, `social`; about adds `seoTitle`, `history`)
  - `collections`: `services`, `partners`, `caseStudies`, `blogs`, `news`, `jobs`, `team` — published items only (`publicView` filters `status === 'published'` at `server.js:749-755`)
- **Representative published blog record keys** (from live `site-content.json`):  
  `id`, `title`, `summary`, `href`, `image`, `alt`, `category`, `categoryLabel`, `readTime`, `accent`, `status`, `featured`, `order`, `cluster`, `body`, `answerBlock`, `faq`, `dataCallouts`, `relatedPosts`, `comparisonTable`, `datePublished`, `dateModified`, `tableOfContents`
- **No SQL/ORM** for the public site. No schema migrations directory found.
- **Schema validation on public write:** public files are derived outputs; validation happens on admin writes via `cleanItem` / `finalizeBlogItem` (`server.js:1232+`, `1408+`). Mode from `content/validation-config.json` (`blogPublishValidation`: `"warn"`).
- **Concurrency for public files:** regenerated on each `writeData`; no file lock beyond temp+copy pattern used for admin JSON (`server.js:793-798`). No advisory lock found.

**Client-side state:** `js/content-runtime.js` uses in-page `window.DH_CONTENT`; sidebar collapse etc. is admin-only. Public careers form posts to API (not localStorage for submissions — verified by `js/careers-apply.js` posting to API paths used elsewhere).

### 2.A.4 Routes and pages

#### Static / public HTML pages (on disk)

| Path | File | Access |
|------|------|--------|
| `/` → `/index.html` | `index.html` | Public |
| `/about-us.html` | `about-us.html` | Public |
| `/get-in-touch.html` | `get-in-touch.html` | Public |
| `/services/enterprise-software.html` | `services/enterprise-software.html` | Public |
| `/services/data-analytics.html` | `services/data-analytics.html` | Public |
| `/services/ai-automation.html` | `services/ai-automation.html` | Public |
| `/services/outsourcing.html` | `services/outsourcing.html` | Public |
| `/partners/index.html` (+ `/partners/`) | `partners/index.html` | Public |
| `/partners/microsoft.html` | `partners/microsoft.html` | Public |
| `/partners/huawei.html` | `partners/huawei.html` | Public |
| `/partners/nexthink.html` | `partners/nexthink.html` | Public |
| `/partners/efinance.html` | `partners/efinance.html` | Public |
| `/partners/vodafone.html` | `partners/vodafone.html` | Public |
| `/cases/index.html` | `cases/index.html` | Public |
| `/cases/ministry-planning.html` | `cases/ministry-planning.html` | Public |
| `/cases/data-center-transformation.html` | `cases/data-center-transformation.html` | Public |
| `/cases/nexthink-dex-bank.html` | `cases/nexthink-dex-bank.html` | Public |
| `/blogs/index.html` | `blogs/index.html` | Public |
| `/blogs/digital-employee-experience.html` | `blogs/digital-employee-experience.html` | Public |
| `/blogs/digital-transformation-signs.html` | `blogs/digital-transformation-signs.html` | Public |
| `/blogs/azure-digital-egypt-2030.html` | `blogs/azure-digital-egypt-2030.html` | Public |
| `/blogs/enterprise-ai-production.html` | `blogs/enterprise-ai-production.html` | Public |
| `/blogs/augment-vs-outsource-tech-team.html` | `blogs/augment-vs-outsource-tech-team.html` | Public |
| `/careers/index.html` | `careers/index.html` | Public |
| `/careers/dotnet-backend-developer.html` | `careers/dotnet-backend-developer.html` | Public |
| `/careers/data-analyst.html` | `careers/data-analyst.html` | Public |
| `/careers/full-stack-developer.html` | `careers/full-stack-developer.html` | Public |
| `/careers/apply.html` | `careers/apply.html` | Public |
| `/news/index.html` | `news/index.html` | Public |
| `/sitemap.xml` | generated by `sitemapXml()` | Public (`server.js:2815-2820`) |
| `/llms.txt` | `llms.txt` | Public (`server.js:2822-2834`) |
| `/admin/` | `admin/index.html` | Public HTML shell; API behind auth (see B/C/D) |

Enforcement for “public”: no auth on `serveStatic` for these paths. Blocked content paths: `server.js:2837-2842`.

#### Public API endpoints (website-facing)

| Method | Path | Auth | Reads | Writes |
|--------|------|------|-------|--------|
| GET | `/api/content` | Public | `admin-content.json` via `publicView(readData())` | none | `server.js:1624-1626` |
| POST | `/api/careers/applications` | Public (+ rate limit + honeypot) | jobs for role validation; multipart resume | SQL Server `applications` + `application_resumes` (single transaction via `lib/hiring-db.js`) | `server.js` careers POST |
| POST | `/api/contact/requests` | Public (+ rate limit + honeypot) | body fields | `contact-requests.json` | `server.js:1647-1655` |

### 2.A.5 Authentication and authorisation

- **None for browsing** public HTML/CSS/JS/assets.
- Form endpoints are unauthenticated but rate-limited (`canSubmitApplication` ≤8/hour/IP `server.js:1492-1502`; `canSubmitContact` ≤10/hour/IP `server.js:1505-1515`) and honeypot field `website` short-circuits to fake success (`server.js:1632`, `1650`).

### 2.A.6 Integrations

| Integration | Where | Env / config |
|-------------|-------|--------------|
| Google Fonts (Poppins) | Linked from many HTML pages (e.g. blogs/cases) | CDN URLs in HTML — no env |
| Tabler Icons webfont | `cdn.jsdelivr.net` links in HTML | no env |
| Social profile URLs in JSON-LD / SEO | Hardcoded in pages / `scripts/seo-build.js` (LinkedIn, Facebook) | CMS can also store social on `pages.home.social` |
| Absolute site URL | `SITE_URL` constant `server.js:15` | not env-driven |
| Email (SES) | Used for HR interview mail, not general public marketing mail | see `lib/mail.js` — only triggered from hiring flows |

No payment SDKs, no analytics tag managers (`gtag` / GA) found in targeted greps of JS/HTML for analytics product scripts (HR “analytics” views are in-app hiring metrics, not Google Analytics).

### 2.A.7 State of completion

- Public marketing pages are full designed HTML (working static).
- CMS sync scripts rewrite portions of service/partner/about HTML on content save (`writeDerivedFiles`).
- `careers/apply.html` + `js/careers-apply.js` submit to live API.
- **TODO/FIXME/HACK/XXX:** none found in `*.js|html|css|md` repo grep.
- Dead/duplicate notes:
  - Duplicate path separators in Windows listings for some blog files (`blogs\…` vs `blogs/…`) — same files.
  - `scripts/_audit-report-tmp.js` / `_audit-report-tmp.json` look like temporary audit artifacts (names), not wired into `package.json` scripts.
  - `package.json` `main: index.js` with missing `index.js`.

---

## 2.B CMS (Content Studio)

### 2.B.1 Stack and runtime

- Same Node process as public site (`server.js`).
- Admin UI: vanilla JS SPA in `admin/admin.js` (~4718 lines), markup `admin/index.html` (~821 lines), styles `admin/admin.css` (~1010 lines).
- **No separate CMS framework** (no WordPress, Strapi, Sanity).
- Build/dev/start: same as root `package.json` (`npm start` / `npm run dev`).
- Rendering: **SPA shell** at `/admin/` talking JSON APIs; not SSR for admin views.
- Proof: hash routing in `admin/admin.js` (`readStoredAdminRoute` / `writeAdminRoute`); session bootstrap via `GET /api/admin/session`.

### 2.B.2 Directory map

| Path | Contents |
|------|----------|
| `admin/` | Entire CMS UI |
| `content/admin-content.json` | Authoritative CMS store (drafts + published) |
| `content/site-content.*` | Generated public projection |
| `content/validation-config.json` | Blog publish validation mode |
| `content/admin-users.json` | **LEGACY** account file (gitignored; not read at runtime) |
| SQL Server `DigitalHubHiring`.`dbo.admin_users` | Admin / HR / Marketing accounts |
| `assets/uploads/` | CMS/HR/Marketing uploaded assets |
| `scripts/blog-pages.js`, `partner-logos.js`, `service-suite-images.js`, `service-methodology.js`, `about-history.js`, `site-social.js` | Sync HTML/assets from CMS data on save |
| `ADMIN.md` | Operator documentation |
| `lib/mail.js` | Shared mail helper (used more by HR) |

**Entry:** `/admin/` → `admin/index.html`.

### 2.B.3 Data layer

#### Primary store: `content/admin-content.json`

- Pattern: single JSON document.
- Top-level keys: `meta`, `pages`, `collections`.
- `meta` keys include: `version`, `revision`, `updatedAt`, `updatedBy`, `audit`.
- `audit[]` keys: `id`, `action`, `label`, `at`, `by` (capped at 50 — `server.js:1469`).
- Collections (keys in `COLLECTIONS` `server.js:39`): `services`, `partners`, `caseStudies`, `blogs`, `news`, `jobs`, `team`.
- Field allow-lists for items: `fields` object `server.js:50-62`.
- Approximate counts observed in live file: services 4, partners 5, caseStudies 4, blogs 3, jobs 1 (draft), team 6, news 3.
- Write path: `writeData` temp file → copy → unlink (`server.js:793-798`) then `writeDerivedFiles`.

#### Users: SQL Server `dbo.admin_users` (`DigitalHubHiring`)

- Accessed via async `readUsers` / `writeUsers` → `hiringDb.readAdminUsersStore` / `writeAdminUsersStore` (MERGE upsert by `id`; deletes use `hardDeleteAdminUser`).
- Row fields (API shape): `id`, `username`, `name`, `email`, `jobTitle`, `photo`, `role`, `active`, `passwordHash`, `mustSetPassword`, `inviteTokenHash`, `inviteExpiresAt`, `lastLoginAt`, `createdAt`, `updatedAt`.
- Empty-table bootstrap: `ensureAdminBootstrap` seeds the first admin from `ADMIN_USER` / `ADMIN_PASSWORD` after the SQL pool opens.
- Legacy file `content/admin-users.json` remains on disk (gitignored) but is **not** imported or written by the server.

#### Validation config: `content/validation-config.json`

```json
{ "blogPublishValidation": "warn" }
```

Read by `blogValidationMode()` (`server.js:783-790`).

#### Schema validation on write

- Collection items: `cleanItem` (`server.js:1232+`) using `fields` allow-lists.
- Pages: `cleanPage` (`server.js:1414+`).
- Blogs: `finalizeBlogItem` (`server.js:1408+`) can warn or block publish when mode is `enforce`.
- Revision concurrency: `checkRevision` requires `If-Match` header match `meta.revision` (`server.js:1475-1486`); used on content/page/item mutations.
- Atomicity: temp+rename/copy pattern per JSON file; **no multi-file transactions**. Comment at login acknowledges concurrent user writes (`server.js:1698`).

### 2.B.4 Routes and pages

#### Admin UI hash routes (client)

| Hash | View | Role (client + API) |
|------|------|---------------------|
| `#dashboard` | Overview | admin / hr / marketing |
| `#content/<collection>` | Collection editor | admin (non-jobs); hr (`jobs` only) |
| `#pages` | Page copy | admin-only |
| `#users` | User management | admin-only |
| `#tools` | Backup/import + static “health” | admin-only |
| `#contactRequests` | Contact inbox | admin-only |
| (HR/Marketing routes listed under C/D) | | |

Client gates: `admin/admin.js` ~699–705 / ~771–781.  
API gates: `requireAdmin`, `canEditCollection`, `canEditPage` (`server.js:1050-1066`, `1060-1066`).

#### CMS-related API endpoints

| Method | Path | Auth | Reads | Writes |
|--------|------|------|-------|--------|
| POST | `/api/admin/login` | Public credentials | `dbo.admin_users` | session Map; `lastLoginAt` | `server.js` login route |
| GET | `/api/admin/session` | Cookie optional | session + users | none | `1715-1719` |
| POST | `/api/admin/logout` | Auth + CSRF | session | deletes session cookie | `1722-1726` |
| POST | `/api/admin/auth/setup-password` | Invite token | users | passwordHash | `1658-1677` |
| POST | `/api/admin/auth/change-password` | Auth + CSRF | users | passwordHash | `1737-1758` |
| GET | `/api/admin/users` | Admin | users | none | `1731-1734` |
| POST | `/api/admin/users` | Admin + CSRF | users | creates user | `1761-1808` |
| PUT/DELETE | `/api/admin/users/:id` | Admin + CSRF | users | update/delete | `1811-1870` |
| GET | `/api/admin/content` | Auth | admin-content (role-filtered `adminView`) | none | `1873-1877` |
| PUT | `/api/admin/content` | Admin + CSRF + If-Match | import body | replaces pages/collections | `1879-1898` |
| POST | `/api/admin/items/:collection` | Auth + CSRF + collection ACL + If-Match | content | create item | `2267-2276` |
| PUT | `/api/admin/items/:collection/:id` | same | content | update | `2282-2288` |
| DELETE | `/api/admin/items/:collection/:id` | same | content | delete | `2291-2308` |
| PUT | `/api/admin/pages/:page` | Admin + CSRF + If-Match | content | page fields | `2198-2209` |
| POST | `/api/admin/upload` | Auth + CSRF; admin/hr/marketing | body dataUrl | `assets/uploads/*` + audit bump | `2212-2252` |
| GET | `/api/admin/contact-requests` | Admin | contact-requests.json | none | `2176-2179` |
| PUT | `/api/admin/contact-requests/:id` | Admin + CSRF | contact store | status | `2182-2195` |

### 2.B.5 Authentication and authorisation

- **Mechanism:** opaque session token in cookie `dh_admin_session`, stored in process memory `sessions` Map (`server.js:83`, `1008-1022`, set at `1711`).
- **CSRF:** random `csrf` per session; mutations require header `X-CSRF-Token` (`requireMutationAuth` `server.js:1040-1047`).
- **Password hashing:** Node `crypto.scryptSync`, stored as `salt:hash` hex (`server.js:556-567`).
- **Invite tokens:** SHA-256 hash of raw token (`hashInviteToken` `server.js:569-571`).
- **Roles (CMS-relevant):**
  - `admin`: all non-job collections, all pages, users, tools, contact inbox (`permissionsFor` `server.js:700-713`; `adminView` `716-727`).
  - `hr`: jobs collection only in CMS data view (`adminView` `739-746`); hiring elsewhere.
  - `marketing`: empty collections/pages in `adminView` (`729-737`); onboarding elsewhere.
- **Bootstrap credentials (env only — no password defaults in source):**
  - Env vars: `ADMIN_USER`, `ADMIN_PASSWORD` (`server.js` near startup constants).
  - If `ADMIN_PASSWORD` is unset, the process exits immediately with a fatal error (no fallback password).
  - `ADMIN_USER` defaults to `'admin'` only for the initial empty-table bootstrap username when `dbo.admin_users` has no rows.
  - Documented in `ADMIN.md` (required env vars).
  - Login form username may be prefilled `admin` in `admin/index.html` (UI convenience only).
- **Cookie flags:** `HttpOnly; SameSite=Strict; Path=/; Max-Age=…` — see Set-Cookie construction in `server.js` login handler.

### 2.B.6 Integrations

- **sharp:** image processing on upload (`server.js:2239-2243`).
- **Filesystem:** writes HTML/assets via sync scripts under `scripts/`.
- **Email:** not core CMS publishing; SES used for interview notifications (HR).

### 2.B.7 State of completion

- Content CRUD, page editing, uploads, backup import/export UI, user management: implemented.
- Blog FAQ / comparison table validation marked **“warn-only for now”** in UI copy (`admin/admin.js:1099`, `1115`); config file also `"warn"`.
- Tools “System health Operational” / collections count “7” are **static markup** (admin inventory: `admin/index.html` ~634).
- Notifications bell: markup without JS handler (admin inventory).
- **Bug:** content import `PUT /api/admin/content` references undefined identifier `data` instead of `current` at `server.js:1887` — will throw `ReferenceError` on import path when executed.
- Dead function related to vacancies: `closeOpenPipelinesForJob` defined `server.js:662` but **never called** (repo grep only finds definition).

---

## 2.C HR portal

### 2.C.1 Stack and runtime

- Same stack as CMS: Node + vanilla admin SPA.
- Identified by `role === 'hr'` and `permissions.canUseHiring` (`server.js:711`).
- Client brand string “HR PORTAL” (`admin/admin.js` ~221–225).

### 2.C.2 Directory map

No separate HR root directory. HR surfaces live in:

| Path | Role |
|------|------|
| `admin/index.html` | HR views: applications, hrPortal, hrAnalytics, hrCalendar, interviewLog, onboarding, jobs content |
| `admin/admin.js` | All HR UI logic |
| SQL Server `DigitalHubHiring` | **Current store:** applications, CV binaries (`dbo.application_resumes`), pipelines, onboarding, admin users (`lib/hiring-db.js` / `mssql` / `SQLSERVER_*`) |
| `content/job-applications.json` | **SUPERSEDED** — former JSON applications store; no longer read/written |
| `content/application-files/` | **LEGACY** — former on-disk CV store (gitignored; still static-denied; unused for new uploads) |
| `content/onboarding-requests.json` | **SUPERSEDED** — former JSON onboarding store; no longer read/written |
| `content/admin-content.json` → `collections.jobs` | Vacancies |
| `lib/mail.js` | Interview schedule/reminder email |
| `lib/hiring-db.js` | SQL Server pool/schema + application/onboarding store helpers |

### 2.C.3 Data layer

> **Current (SQL Server).** Hiring, onboarding, and admin user accounts persist in SQL Server database `DigitalHubHiring` via `lib/hiring-db.js` (`mssql` package; `SQLSERVER_HOST`, `SQLSERVER_DATABASE`, `SQLSERVER_USER`, `SQLSERVER_PASSWORD`). Wrappers `readApplications` / `writeApplications` / `readOnboarding` / `writeOnboarding` / `readUsers` / `writeUsers` in `server.js` are async. Studio content and contact requests remain JSON. Notes below describe the API object shape (unchanged for the SPA).

#### ~~`content/job-applications.json`~~ / ~~`data/hiring.sqlite`~~ → SQL Server `dbo.applications` (+ `pipeline` NVARCHAR JSON column)

- Top-level: `version`, `updatedAt`, `applications`.
- Observed count on disk: **4** applications.
- Gitignored (`.gitignore:7`).
- Representative application keys:  
  `id`, `reference`, `role`, `roleSlug`, `fullName`, `phone`, `email`, `currentSalary`, `yearsOfExperience`, `expectedSalary`, `noticePeriodWeeks`, `linkedin`, `resumeName`, `resumeFile`, `status`, `submittedAt`, `updatedAt`, `pipeline`
- Dedicated task-review columns (not stored in pipeline JSON): `task_reviewed_by`, `task_reviewed_by_user_id`, `task_score`
- Interviewer directory: merged list of HR `admin_users` (read-only; title from `job_title`) plus manual `dbo.interviewers` rows — used by pipeline pickers and interview mail
- `pipeline` keys: `stage`, `phoneScreen`, `pathway`, `task`, `interviews`, `offer`, `history`
- `task`: `title`, `notes`, `status`, `decision` (reviewed-by / score come from the dedicated columns on read)
- `offer`: `status`, `declinedReason`
- `interviews[]`: `id`, `label`, `format`, `interviewer`, `interviewerUserId`, `interviewerEmail`, `scheduledAt`, `reminderSentOn`, `score`, `notes`, `result`
- `history[]`: `at`, `by`, `action`, `detail`
- Defaults / enums: `DEFAULT_INTERVIEW_STAGES`, `PHONE_SCREEN_OUTCOMES`, `TASK_*`, `INTERVIEW_*`, `OFFER_STATUSES`, `PATHWAYS` (`server.js:134-142`).
- Validation on pipeline write: `cleanPipelinePayload` / `normalizeInterviewEntry` (score 0–10 half-steps; staff interviewer required when scheduled — `server.js:223-246`).
- Write pattern: upsert/MERGE via `hiringDb.writeApplicationsStore` (does not delete absent ids).
- Concurrency: **no If-Match / revision** on applications (unlike CMS content). Last write wins. In-memory rate maps for public posts only.

#### Onboarding store (shared with Marketing)

> **Current (SQL Server).** Onboarding rows live in `DigitalHubHiring.dbo.onboarding_requests` (FK to `applications`, `ON DELETE CASCADE`) via `lib/hiring-db.js`. See 2.D.3. Historical JSON notes for `content/onboarding-requests.json` remain for archaeology only.

### 2.C.4 Routes and pages

#### UI (hash)

| Hash | Purpose | Auth |
|------|---------|------|
| `#applications` | Job applications inbox | HR (admin client-blocked) |
| `#hrPortal` | Active hiring pipelines | HR |
| `#hrAnalytics` | Closed-outcome analytics | HR |
| `#hrCalendar` | Interview calendar | HR |
| `#interviewLog` | Interview history | HR |
| `#onboarding` | Employee onboarding (HR side) | HR (+ marketing) |
| `#content/jobs` | Vacancies CMS | HR |

Client blocks admin from hiring views (`admin/admin.js` ~699–705).

#### API

| Method | Path | Auth | Reads | Writes |
|--------|------|------|-------|--------|
| GET | `/api/admin/applications` | HR | SQL Server applications | none |
| PUT | `/api/admin/applications/:id` | HR + CSRF | apps | status | `2114-2126` |
| PUT | `/api/admin/applications/:id/pipeline` | HR + CSRF | apps | pipeline; may send mail; may create onboarding | `2129-2173` |
| GET | `/api/admin/applications/:id/resume` | HR | `dbo.application_resumes` | streams CV bytes |
| GET | `/api/admin/staff-interviewers` | HR | merged HR accounts + `dbo.interviewers` (active) | none |
| GET | `/api/admin/interviewers` | HR | merged HR accounts + `dbo.interviewers` | none |
| POST | `/api/admin/vacancies/end` | HR (jobs ACL) + CSRF | jobs + apps | sets job `draft`; returns counts | `2054-2088` |
| GET/POST/PUT | `/api/admin/onboarding…` | HR/Marketing | see 2.D | see 2.D |

### 2.C.5 Authentication and authorisation

- Same cookie session as CMS.
- Server enforcer: `requireHr` (`server.js:1070-1076`).
- Interviewer directory limited to active `hr` or `admin` users with valid email (`listStaffInterviewers` `server.js:201-217`).
- Admin role **cannot** call HR application APIs (requireHr). Admin UI also blocks hiring routes.

### 2.C.6 Integrations

- **Amazon SES SMTP** via nodemailer (`lib/mail.js`) for schedule notices + day-of reminders (`server.js:287-358`, `360-368`).
- Env vars: see STEP 3.3 / `lib/mail.js:6-18`.
- Reminder job: `setInterval` 60s (`server.js:360-368`), fires at 10:00 `MAIL_TZ` / Africa/Cairo.

### 2.C.7 State of completion

- Hiring pipeline, calendar, interview log, analytics UI, interview email automation: present and wired.
- `closeOpenPipelinesForJob` exists but is unused — ending a vacancy (`/api/admin/vacancies/end`) only unpublishes the job (`status = 'draft'`) and reports `activeCount`; it does **not** invoke the closer (`server.js:2054-2088` vs dead `662-697`).
- Notifications bell unused (admin inventory).
- No TODO/FIXME comments found.

---

## 2.D Marketing portal

### 2.D.1 Stack and runtime

- Same admin SPA; `role === 'marketing'`.
- Client restricts navigation to `dashboard` + `onboarding` (`admin/admin.js` ~704).
- Server: onboarding APIs via `requireOnboarding` (`server.js:984-991`).

### 2.D.2 Directory map

No separate Marketing package. Surfaces:

| Path | Use |
|------|-----|
| `admin/` views `#dashboard`, `#onboarding` | Marketing UI |
| SQL Server `DigitalHubHiring` (`onboarding_requests`) | **Current** deliverable workflow store |
| `content/onboarding-requests.json` | **SUPERSEDED** |
| `assets/uploads/` | Uploaded posts/cards/IDs |

### 2.D.3 Data layer

#### ~~`content/onboarding-requests.json`~~ / ~~`data/hiring.sqlite`~~ → SQL Server `dbo.onboarding_requests`

> **Current (SQL Server).** API shape (`requests[]` with camelCase fields and parsed `assets` object) is unchanged for the SPA; persistence is SQL Server via `lib/hiring-db.js` (`mssql` / `SQLSERVER_*`). Former JSON and SQLite paths are superseded. Historical field notes:

- Top-level: `version`, `updatedAt`, `requests`.
- Observed count: historical inventory noted **3** (JSON era).
- Gitignored (`.gitignore` includes `content/onboarding-requests.json`).
- Representative request keys:  
  `id`, `applicationId`, `reference`, `fullName`, `jobTitle`, `email`, `mobile`, `linkedin`, `idNumber`, `status`, `assets`, `notesHr`, `notesMarketing`, `createdBy`, `sentAt`, `returnedAt`, `completedAt`, `createdAt`, `updatedAt`
- `assets` keys (`ONBOARDING_ASSET_KEYS` `server.js:28`): `onboardingPost`, `joiningPost`, `businessCard`, `employeeId`
- Statuses: `draft`, `sent`, `returned`, `completed` (`server.js:27`).
- Validation: email/mobile/linkedin/asset path cleaners (`server.js:853-898`, `2026-2044`).
- Write: upsert/MERGE via `hiringDb.writeOnboardingStore`.
- Concurrency: no revision tokens; last write wins.

**Legacy JSON exposure note:** if `content/onboarding-requests.json` were recreated on disk, treat it as sensitive. Prefer the content deny path under `content/` (allow only `site-content.*`) rather than relying on a blocklist name alone.

### 2.D.4 Routes and pages

| Hash | Purpose | Auth |
|------|---------|------|
| `#dashboard` | Marketing overview | marketing |
| `#onboarding` | Deliverables workspace | marketing (sees `sent`/`returned` only on GET filter `server.js:1921-1923`) |

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | `/api/admin/onboarding` | HR or Marketing | HR syncs joined apps; Marketing filtered list | `1912-1924` |
| POST | `/api/admin/onboarding` | HR only | Start draft from joined application | `1927-1952` |
| PUT | `/api/admin/onboarding/:id` | HR or Marketing | HR: edit/send/complete; Marketing: assets + return | `1955-2051` |
| POST | `/api/admin/upload` | marketing allowed (`canUploadAssets` `server.js:994-996`) | upload assets | |

### 2.D.5 Authentication and authorisation

- Same session/CSRF model.
- Accounts created by admin with `normalizeAccountRole` allowing only `hr` or `marketing` for managed users (`server.js:1079-1082`); primary `admin` is protected from edit/delete (`server.js:1819-1820`).
- Marketing cannot manage CMS collections/pages (`adminView` empty; `canEditCollection` false for non-jobs and marketing isn’t jobs).

### 2.D.6 Integrations

- File uploads via same `/api/admin/upload` (images/PDF → `assets/uploads`).
- No separate Marketing email integration found beyond shared SES module unused for marketing-specific templates.

### 2.D.7 State of completion

- Onboarding send/return/complete flow implemented end-to-end on server and client.
- Attribute `data-onboarding-marketing` is toggled in JS but **no HTML elements use it** (admin inventory).
- Draft filter hidden for Marketing (client).
- No TODO/FIXME comments.

---

# STEP 3 — CROSS-SYSTEM

## 3.1 Shared code

| Shared asset | Used by |
|--------------|---------|
| `server.js` | A (static+public API), B, C, D |
| `admin/*` | B, C, D |
| `content/admin-content.json` | B writes; A reads published projection; C reads jobs |
| `content/site-content.js` / `.json` | A runtime |
| `assets/uploads/` | B uploads; D onboarding assets; public URLs |
| `lib/mail.js` | C (interview mail); configured for Amazon SES |
| `css/`, `js/shared.js`, brand assets | A primarily; generated detail pages also |
| `scripts/*` sync helpers | B save pipeline affecting A HTML |
| `package.json` dependencies `sharp`, `nodemailer` | server features spanning B/C |

## 3.2 Coupling

- **Fully shared process and filesystem** — not isolated microservices.
- Coupling mechanisms:
  1. Shared JSON files on disk.
  2. Same HTTP server routes.
  3. CMS save regenerates public `site-content.*` and mutates designed HTML via scripts.
  4. HR marking offer `joined` auto-creates onboarding draft for Marketing (`ensureOnboardingDraftForApplication` `server.js:947-959`, pipeline PUT `2150-2158`).
  5. In-memory sessions Map — not shared across multiple Node processes / restarts.

## 3.3 Environment variables

Every variable referenced in code (name only; defaults noted; never print secret values):

| Name | System(s) | File:reference | Default if any |
|------|-----------|----------------|----------------|
| `TZ` | All (server process) | `server.js:3` | falls through to `MAIL_TZ` or `'Africa/Cairo'` |
| `MAIL_TZ` | Mail / TZ | `server.js:3`; `lib/mail.js:23` | `'Africa/Cairo'` |
| `PORT` | All | `server.js:13` | `8765` |
| `HOST` | All | `server.js:14` | `'127.0.0.1'` |
| `ADMIN_USER` | B (bootstrap admin) | `server.js:16` | `'admin'` |
| `ADMIN_PASSWORD` | B (bootstrap admin) | `server.js` startup | **required** — process exits if unset; no default |
| `SES_REGION` | Mail | `lib/mail.js:36` via `envFirst` | (region chain) |
| `AWS_REGION` | Mail | `lib/mail.js:36` | |
| `AWS_DEFAULT_REGION` | Mail | `lib/mail.js:36` | if all empty, `sesRegion()` returns `'eu-west-1'` |
| `SES_SMTP_HOST` | Mail | `lib/mail.js:40` | else `email-smtp.{region}.amazonaws.com` |
| `SMTP_HOST` | Mail (legacy) | `lib/mail.js:40` | |
| `SES_SMTP_PORT` | Mail | `lib/mail.js:47` | `587` |
| `SMTP_PORT` | Mail (legacy) | `lib/mail.js:47` | |
| `SES_SMTP_USER` | Mail | `lib/mail.js:51` | |
| `SMTP_USER` | Mail (legacy) | `lib/mail.js:51` | |
| `SES_SMTP_PASS` | Mail | `lib/mail.js:55` | |
| `SMTP_PASS` | Mail (legacy) | `lib/mail.js:55` | |
| `SES_FROM` | Mail | `lib/mail.js:59` | |
| `SMTP_FROM` | Mail (legacy) | `lib/mail.js:59` | |
| `MAIL_FROM` | Mail (legacy) | `lib/mail.js:59` | |
| `MAIL_ENABLED` | Mail | `lib/mail.js:63` | if unset, auto-true when user+pass+from present |
| `SES_ENABLED` | Mail | `lib/mail.js:63` | alias |
| `HR_NOTIFY_EMAILS` | Mail / HR | `lib/mail.js:74` | `''` |
| `PUBLIC_BASE_URL` | Mail links | `lib/mail.js:81` | |
| `APP_BASE_URL` | Mail links | `lib/mail.js:81` | alias |

`.env` is gitignored (`.gitignore:2`, `:16-17`) — **no committed `.env` contents inspected** (file may or may not exist locally; treated as out of scope for values).

## 3.4 Deployment

| Artifact | Present? | Notes |
|----------|----------|-------|
| Dockerfile / docker-compose | **No** (glob) | |
| `.github/workflows` / CI YAML | **No** project CI configs found | |
| Elastic Beanstalk / appspec / buildspec | **No** | |
| `ADMIN.md` Deployment section | Yes | States Node + `server.js` required for editing/forms; static-only can show published content but not forms/admin (`ADMIN.md:73-75`) |
| Hosting target | `SITE_URL` `https://digitalhub.com.eg`; www→apex 301 (`server.js:2918-2920`) | Exact cloud host / how deploy is triggered: **[UNKNOWN]** — checked for Docker/CI/deploy scripts; none found. Ops process not in repo. |
| Trigger | **[UNKNOWN]** | No deploy script in `package.json` beyond `start` |

## 3.5 Dependencies

### Root `package.json` direct dependencies

| Package | Declared | Locked (`package-lock.json`) | Notes |
|---------|----------|------------------------------|-------|
| `nodemailer` | `^9.0.5` | `9.0.5` | engines node `>=6.0.0`; license MIT-0 |
| `sharp` | `^0.35.3` | `0.35.3` | platform packages engines `node: >=20.9.0` |

No `deprecated` field observed on these lockfile entries in the sections read. Whether packages are “unmaintained” beyond lockfile metadata: **[UNKNOWN]** — lockfile does not mark them deprecated.

### `scripts/package.json` direct dependencies

| Package | Declared | Notes |
|---------|----------|-------|
| `sharp` | `^0.35.2` | Separate scripts lockfile; version skew vs root `0.35.3` |

Node built-ins used heavily: `http`, `fs`, `path`, `crypto`, `zlib` (`server.js` requires).

---

# STEP 4 — RISK REGISTER

Ranked by severity (highest first). Only issues with concrete file evidence.

| Sev | Category | Issue | Evidence |
|-----|----------|-------|----------|
| **Critical** | Security | (Mitigated) `ADMIN_PASSWORD` is required at startup; process exits if unset — no default admin password in source | `server.js` startup fatal check; `ADMIN.md` |
| **Critical** | Security | (Mitigated) Onboarding no longer persists in a public JSON file; store is SQL Server. Legacy `content/onboarding-requests.json` remains gitignored if recreated | `.gitignore`; `lib/hiring-db.js` |
| **High** | Security | Session cookie lacks `Secure` flag (HTTPS sites can still send cookie over HTTP if mixed) | Set-Cookie at `server.js:1711` |
| **High** | Security | Sessions stored only in process memory — lost on restart; no multi-instance sticky support | `sessions = new Map()` `server.js:83` |
| **High** | Data integrity | `PUT /api/admin/content` uses undefined `data` when cleaning imported pages — import path broken / throws | `server.js:1887` (`data.pages` vs `current`) |
| **High** | Data integrity / concurrency | Contact requests and users JSON updates have **no revision/If-Match**; hiring/onboarding use SQL Server upserts without optimistic concurrency | Applications/`hiring-db` vs content `checkRevision` |
| **High** | Security / docs mismatch | `ADMIN.md` claims “Rate limiting for login attempts” but **no login attempt limiter** exists in `server.js` (only application/contact limiters) | `ADMIN.md:67`; `canSubmitApplication`/`canSubmitContact` only; login handler `1680-1712` has no attempt map |
| **Medium** | Security | `robots.txt` does not Disallow legacy `/content/onboarding-requests.json` or `/content/contact-requests.json` (contact blocked at server; onboarding store is SQL Server) | `robots.txt:1-10` |
| **Medium** | Data integrity | Vacancy end does not close open pipelines despite helper existing | `closeOpenPipelinesForJob` only at `server.js:662`; unused; end vacancy `2054-2088` |
| **Medium** | Security | Public rate limits keyed by `req.socket.remoteAddress` — may be ineffective behind reverse proxies without trusting `X-Forwarded-For` (no such trust code found) | `clientAddress` `server.js:1488-1489` |
| **Medium** | Maintainability | Dual `sharp` versions (root `0.35.3` vs `scripts/` `0.35.2`) | `package.json`, `scripts/package.json` |
| **Medium** | Maintainability | `package.json` `"main": "index.js"` but `index.js` missing | `package.json:5`; glob `index.js` → 0 |
| **Medium** | Security | Admin content store `admin-content.json` is tracked in git (includes audit trail / drafts); private applicant/contact files gitignored — inconsistent sensitivity handling | `.gitignore` vs tracked `content/admin-content.json` |
| **Low** | Maintainability | Blog FAQ/comparison validation still warn-only | `content/validation-config.json`; `admin/admin.js:1099`, `1115` |
| **Low** | Maintainability | Dead/unused UI: notifications bell; static “Operational” health | `admin/index.html` / `admin/admin.css` (admin inventory) |
| **Low** | Performance | Reminder job scans all applications every minute when mail enabled | `startInterviewReminderJob` `server.js:360-368` |
| **Low** | Maintainability | (Cleared) Temporary scripts `_audit-report-tmp.*` removed in Section 6 cleanup | — |

---

# Appendix — File counts for content data files (verified on disk during inventory)

| File | Present | Gitignored | Approx. records |
|------|---------|------------|-----------------|
| `content/admin-content.json` | yes | no | collections as above |
| `content/site-content.json` | yes | no | published projection |
| `content/site-content.js` | yes | no | same payload |
| `content/validation-config.json` | yes | no | 1 config key |
| `content/admin-users.json` | yes | yes | **LEGACY** — runtime store is `dbo.admin_users` |
| `content/job-applications.json` | no (legacy) | yes | superseded — SQL Server `applications` |
| `content/contact-requests.json` | yes | yes | 0 requests |
| `content/onboarding-requests.json` | no (legacy) | yes | superseded — SQL Server `onboarding_requests` |
| `content/application-files/` | yes (dir) | yes (dir) | **LEGACY** — runtime CVs are `dbo.application_resumes` |
| SQL Server `DigitalHubHiring` | yes (external DB) | n/a | applications, `application_resumes`, pipelines, onboarding, `admin_users`, deletion_log |
| `content/admin-content.json.bak-20260812-173900` | yes | no | backup |

---

# Appendix — Systems not in this repo

- Separate Marketing or HR mobile apps: **not found**.
- Separate blog CMS outside `admin/`: **not found**.
- Database server schemas/migrations: **not found**.
- CI/CD pipeline definitions: **not found** under `.github/` or common deploy filenames.

End of inventory.
