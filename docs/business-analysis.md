# Business Analysis — Digital Hub Platform Rebuild

**Current state and future state**

| | |
|---|---|
| Version | 1.1 — updated after Phase A |
| Date | 21 September 2026 |
| Audience | Tech lead, backend and frontend teams, IT and DevOps, marketing |
| Purpose | Agree where the platform stands and what changes, before DevOps design begins |

**14 Oct 2026: all hiring-system content removed (standalone decision)**

**Changes in 1.1:** the old live site is out of scope, so there are no legacy redirects; the design is locked and verified by screenshot parity; content comes only from branch `feature/interviewer-portal`; case studies and blogs are placeholder drafts; no vacancies migrated; Phase A complete.

---

## 1. Executive summary

Digital Hub has a public website and a content management system. The current platform runs on Node.js and SQL Server. It has never been deployed.

The company's engineering standard is React and .NET, and the internal review recommends aligning with it. This analysis records what exists and defines the target: the website and Content Studio rebuilt on React and .NET.

**At a glance**

| | Today | Target |
|---|---|---|
| Public pages | 29, static HTML | 26, Next.js static export — the 3 test career pages are not migrated |
| Pages editable by staff | Collections plus home and about | Every page |
| Content storage | JSON file | SQL Server |
| Roles | Old admin accounts | `admin` and `editor` |
| SEO score | 69 | 100 |
| Accessibility score | 87.8 | 95 minimum |
| Deployed | No | Yes, on IIS |

---

## 2. Scope

**In scope for this stage**
- Public website rebuild
- Content Studio rebuild
- Shared identity for Studio accounts (`admin` and `editor`)
- Content migration from branch `feature/interviewer-portal`

**Out of scope**
- The 18 unwritten articles in the content plan — content work, running in parallel
- **The old live site on `digitalhub.com.eg`.** A legacy single-page app serving the same empty shell on every URL. Nothing is carried over from it — no content, no design, no SEO settings, no redirects

---

## 3. Analysis approach

**Sources**
- The working codebase on branch `feature/interviewer-portal`
- Architecture and phase documentation produced during the build
- Verification reports: test suites, mobile audits, security checks, restore drill
- The internal security and architecture review
- Decisions agreed with the product owner

**Method**
1. Record the current state as built, not as intended
2. Define the target from agreed decisions
3. Compare capability by capability and classify each change
4. Map business processes before and after
5. Derive requirements, migration needs, risks, and what DevOps must provide

Where the current system taught something the hard way, it is recorded as a requirement so the rebuild does not rediscover it.

---

## 4. Stakeholders and users

| Group | Interest | Uses |
|---|---|---|
| Website visitors | Find services, trust the company, get in touch | Public website |
| Candidates | Apply | Careers pages |
| Content editors (marketing) | Publish and maintain site content | Content Studio |
| Administrators | Manage users and settings | Content Studio |
| Tech lead and development teams | Maintainable, aligned stack | Everything |
| IT and DevOps | Hosting, databases, backups, monitoring | Infrastructure |
| Management | Brand, risk | Outcomes |

---

## 5. Current state

### 5.1 Systems and architecture

One Node.js process serves everything.

| Component | Technology | Notes |
|---|---|---|
| HTTP server | Custom Node server, no framework | `server.js` |
| Public website | Static HTML, content injected at load by a script | 29 pages |
| Admin application | Vanilla JavaScript single-page app | Site content administration |
| Data access | Parameterised queries via `mssql` | Audited: roughly 50 query sites, all bound |
| Email | SES over SMTP | Templates built, **SES not configured** |
| Sessions | In process memory | Forces a single process |

### 5.2 Data stores

| Store | Holds |
|---|---|
| `content/admin-content.json` | All site content: 7 collections, 2 editable pages |
| `content/site-content.json` and `.js` | Public projection of published content |
| `content/contact-requests.json` | Contact enquiries |

**Content collections:** services, partners, case studies, blog posts, news, team, vacancies.

### 5.3 Capabilities built

| Area | Capability |
|---|---|
| Website | 29 pages, mobile-audited, interactive WebGL hero and animated sections |
| Content | Collections editing, home and about page editing, image upload with WebP conversion, content export and import |

### 5.4 Security posture

| Control | State |
|---|---|
| Static file access | Default-deny, allow-list on the resolved path |
| Credentials | No defaults; server refuses to start without an admin password; exposed credentials rotated |
| Passwords | scrypt with per-user salt |
| CSRF | Validated on every state-changing request |
| Authorisation | Server-side, fails closed; field-level exclusions by allow-list |
| Security headers | CSP enforced, HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options` |
| Rate limiting | Login, public forms, password setup, uploads, admin writes |
| Session invalidation | On logout, password change, deactivation, deletion |

### 5.5 Quality baseline

| Measure | Value |
|---|---|
| Lighthouse Performance | 93.5 |
| Lighthouse Accessibility | 87.8 |
| Lighthouse Best Practices | 99.3 |
| Lighthouse SEO | 69 |
| Mobile horizontal overflow, 29 pages at 390px and 320px | 0 |

### 5.6 Delivery status

| Item | State |
|---|---|
| Deployed anywhere | **No** |
| Active branch | `feature/interviewer-portal` |
| Frozen snapshot | `release/v1` at `3b7fda0` |
| Legacy branch | `main` — pre-migration code, never used as a source |
| Content and design source | Branch `feature/interviewer-portal` only; the importer refuses any other source |
| Backup | Procedure written, restore drill passed, **no schedule running** |

### 5.7 Known issues and open findings

| Item | Source |
|---|---|
| Potential XSS — forms accept script payloads; details not yet supplied | Security review |
| `trustServerCertificate: true` — needs the production position | Security review |
| No general administrative audit trail | Security review |
| Sessions and rate limits in memory — single process only | Security review |
| Technology stack differs from company standard | Architecture review |
| No analytics or cookie consent | Analysis |
| No redirect handling; renaming a page breaks its URL | Analysis |
| Most designed pages not editable by staff | Analysis |

---

## 6. Future state

### 6.1 Target architecture

```
                    IIS on Windows Server
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Public website ──── static files, no runtime calls  │
  │                                                      │
  │  Content Studio ──── Content API ──── DigitalHubContent
  │         │                                            │
  │         └──── Shared identity                        │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

**Principle:** the public website never depends on another service at request time. It is built from published content and served as static files. If the Studio or an API is down, the website stays up.

### 6.2 Applications

| Application | Stack | Hosting |
|---|---|---|
| Public website | Next.js App Router, static export | IIS, static files |
| Content Studio | Vite + React, Ant Design, Tailwind | IIS, static files |
| Content API | .NET 10, ASP.NET Core, controllers, EF Core | IIS, ASP.NET Core Module |

### 6.3 Data

| Database | Contents |
|---|---|
| `DigitalHubContent` — new | Collections, pages and sections, media library, redirects, navigation, site settings, revisions, audit log, contact enquiries, identity |

**Content model:** one table per collection. Every page and every collection detail item is an ordered list of sections, each of a defined type with editable fields. Rich text is stored as structured TipTap documents, validated on the server.

**Files:** content images on the filesystem under the Content API, metadata in the database, copied into the website build output so the public site is self-contained.

### 6.4 Shared identity

One identity service used by every application.

| Role | Application | Can |
|---|---|---|
| `admin` | Studio | Everything, including users and settings |
| `editor` | Studio | Create, edit, publish content |

**Authentication:** local accounts with ASP.NET Core Identity. Short-lived access token held in memory; refresh token in an `HttpOnly` cookie, protected against cross-site request forgery.

### 6.5 API conventions

Shared by the Content API.

| Concern | Convention |
|---|---|
| Base path | `/api/v1/...` |
| Errors | RFC 7807 problem details, consistent codes |
| Dates | UTC, ISO 8601 |
| Authorisation | Role-based policies, server-side, fail closed |
| Concurrency | Version token on every mutable resource; stale writes rejected with 409 |
| Pagination | Consistent query parameters and response envelope |
| Tracing | Correlation ID on every request, returned in the response and logged |
| Validation | Server-side on every input; client validation is convenience only |

---

## 8. Gap analysis

| Capability | Current | Future | Change |
|---|---|---|---|
| Page rendering | Static HTML, content injected at load | Next.js static export | Rebuild |
| Content storage | JSON file | SQL Server | Rebuild |
| Content editing interface | Vanilla JavaScript | React, Ant Design | Rebuild |
| Page editability | Collections plus two pages | Every page, by sections | New |
| Rich text | Sanitised HTML | TipTap structured documents | Rebuild |
| Images | Upload and WebP conversion | Media library: metadata stripped, sizes, dimensions, alt text enforced, deduplicated | Rebuild and extend |
| SEO | Partial; score 69 | Full system; target 100 | New |
| Redirects | None | Automatic on slug change, manual management. No legacy map — the old live site is out of scope | New |
| Preview | None | Live preview with the site's own components | New |
| Revision history | Revision counter | Snapshot per publish, restore | New |
| Audit | Deletions only | All administrative actions | New |
| Analytics and consent | None | Tag Manager, GA4, Consent Mode v2 | New |
| Asset versioning | Manual query strings, drifted | Framework content hashing | Retire |
| Generated blog pages | Regenerated on save | Generated at build | Rebuild |
| Contact form | Node, JSON file | Content API, SQL, Studio inbox | Rebuild |
| Identity | In-memory sessions | Shared identity, JWT, `admin` and `editor` | Rebuild |
| Email | SES templates, not configured | Studio password reset via SES | Partial |
| Security controls | Implemented in Node | Carried into IIS and .NET | Rebuild |
| Rate limiting | In-memory | ASP.NET Core rate limiting | Rebuild |
| Backup | Procedure only | Scheduled, the content database plus image files | Extend |
| Build and deployment | None | Build pipeline to IIS | New |

---

## 9. Business processes

### 9.1 Content publishing

**Current**
1. Administrator signs in to the Node admin
2. Edits an item and saves
3. Server writes the JSON file and regenerates the public projection and blog pages
4. Change is live immediately

**Future**
1. Editor signs in to the Studio
2. Edits a draft — sections, rich text, images, SEO fields
3. Previews it using the website's own components
4. Publishes. The Studio checks alt text and SEO fields, stores a revision, records an audit entry, and creates a redirect if the slug changed
5. A website build is triggered
6. The build fetches published content, generates pages, sitemap, robots file, structured data, and redirect rules
7. The build fails if any page type scores below 100 for SEO
8. The output is deployed to IIS

**What changes for editors:** publishing no longer goes live instantly. It goes live at the next build. Editors need to know this, and the Studio should show when content is awaiting a build.

### 9.2 Contact enquiry

**Current:** visitor submits → Node validates, checks the honeypot and rate limit → JSON file → admin inbox.

**Future:** visitor submits → Content API validates, checks the honeypot and rate limit → SQL Server → Studio inbox → analytics event with no personal data.

### 9.5 Access management

**Current:** an administrator creates an account in Node and sends an invite link.

**Future:** an administrator creates the account in the shared identity with a role. Password reset by email once SES is configured; until then, by an administrator.

---

## 10. Requirements

### 10.1 Functional — Content Studio

| ID | Requirement |
|---|---|
| FR-S-01 | Sign in with a local account; lockout and rate limiting on failed attempts |
| FR-S-02 | Administrators create, deactivate, and reset users and assign roles |
| FR-S-03 | Create, edit, reorder, publish, unpublish, and delete items in every collection |
| FR-S-04 | Compose every page from sections: add, edit, reorder, hide |
| FR-S-05 | Compose service, partner, and case study detail pages from sections |
| FR-S-06 | Edit rich text with TipTap; the server rejects any node type not on the allowed list |
| FR-S-07 | Media library: upload, validate by content, strip metadata, convert to WebP, generate sizes, record dimensions, deduplicate, reuse |
| FR-S-08 | Alt text required on every image unless marked decorative |
| FR-S-09 | SEO fields per page and item, with length counters and a search-result preview |
| FR-S-10 | A slug change on published content creates a redirect automatically; chains collapse; slugs in use as redirect sources cannot be reused |
| FR-S-11 | Add and remove redirects manually |
| FR-S-12 | Live preview of drafts using the website's components |
| FR-S-13 | A save with a stale version is rejected, with a clear message |
| FR-S-14 | Revision history per item, with restore |
| FR-S-15 | Audit log of every administrative action, viewable by administrators |
| FR-S-16 | Edit header and footer navigation |
| FR-S-17 | Edit site settings: contact details, social links, footer, default SEO, organisation details, analytics container, cookie banner text |
| FR-S-18 | Contact enquiries inbox |
| FR-S-19 | Publishing is blocked when required SEO fields or alt text are missing |
| FR-S-21 | Edit the content of the 404 and 500 pages |
| FR-S-22 | Show whether published content is live or awaiting a build |

### 10.2 Functional — Public website

| ID | Requirement |
|---|---|
| FR-W-01 | Reproduce every migrated page, rendered statically from published content, **visually identical** to branch `feature/interviewer-portal` |
| FR-W-02 | Clean URLs. No legacy redirects; old URLs reach the custom 404 page, which links to the main sections |
| FR-W-03 | Meta title, description, canonical, share image, and noindex per page |
| FR-W-04 | Structured data per page type: Organization, WebSite, BreadcrumbList, Article, Service, JobPosting, FAQPage |
| FR-W-05 | Generate `sitemap.xml`, `robots.txt`, and `llms.txt` at build |
| FR-W-06 | Contact form posts to the Content API with honeypot and validation |
| FR-W-08 | Cookie consent with categories, Consent Mode v2 defaulting to denied, reopenable from the footer |
| FR-W-09 | Analytics events for form submissions and calls to action; no personal data sent |
| FR-W-10 | Custom 404 and 500 pages returned with the correct status codes |
| FR-W-11 | Interactive visuals retained, loaded lazily, respecting reduced-motion settings |
| FR-W-12 | Images served from the build output with explicit dimensions and responsive sizes |

### 10.3 Non-functional

| ID | Requirement | Measure |
|---|---|---|
| NFR-01 | SEO | Lighthouse SEO 100 on every page type; build fails below it |
| NFR-02 | Accessibility | WCAG 2.1 AA; Lighthouse 95 minimum |
| NFR-03 | Performance | Lighthouse Performance 93.5 minimum; Best Practices 99 minimum |
| NFR-04 | Mobile | Zero horizontal overflow at 390px and 320px; 44px tap targets; 16px inputs |
| NFR-05 | Security headers | CSP extended for analytics and tested in report-only first; HSTS; `nosniff`; `Referrer-Policy`; `X-Frame-Options` |
| NFR-06 | File exposure | Default-deny static serving; no private path reachable, verified on the deployed site |
| NFR-07 | Authorisation | Server-side, fail closed; responses built from allow-lists |
| NFR-08 | Rate limiting | Login by IP and username; password reset, uploads, and writes per user |
| NFR-09 | Credentials | No defaults; application refuses to start without an initial admin password |
| NFR-10 | Secrets | Never in the repository |
| NFR-11 | Website availability | No runtime dependency on the Studio or APIs |
| NFR-12 | Recovery | Hourly full backups of the content database and the image folder; SIMPLE recovery; data loss capped at one hour; restore drill passed before go-live |
| NFR-13 | Logging | Structured; never records passwords, tokens, secrets, or personal data |
| NFR-14 | Tokens | Access token in memory; refresh token in `HttpOnly` cookie; CSRF protection on refresh |
| NFR-15 | Scaling readiness | No session or rate-limit state held only in process memory if more than one instance is ever run |
| NFR-16 | Browsers | Current versions of Chrome, Edge, Firefox, and Safari, including iOS Safari |
| NFR-17 | Design parity | No design change. Existing stylesheets ported as they are. Automated screenshot comparison of every page at desktop, tablet, and mobile widths against `feature/interviewer-portal`; any difference fails |

---

## 11. Data migration

| Source | Target | Method | Verified by |
|---|---|---|---|
| Collections in `admin-content.json` | Collection tables | Importer tool, dry run first | Row counts match the source. **Done** |
| Designed HTML pages | Pages and sections | Extraction from HTML | Per-page report. **Done** — 9 pages, 103 sections |
| Images referenced by content | Media library | Upload pipeline | **Done** — 63 images, all with alt text; decorative usages marked per usage |
| `contact-requests.json` | Contact enquiries table | Import | **Done** — the file held no requests |
| Vacancies | Not migrated — all six were test data | — | Table empty; real vacancies created in the Studio |
| Case studies and blog posts | Imported as **draft** — placeholder content | Importer | Not published until rewritten |

**Content parity sign-off is required before cutover.** A named reviewer from marketing compares every page on the new site against branch `feature/interviewer-portal`.

**The importer is a one-off tool.** It reads only a clean `feature/interviewer-portal` checkout, reports its source commit, and is idempotent. Phase A imported from commit `eb05f06`.

---

## 12. Integrations and dependencies

| From | To | When | Purpose |
|---|---|---|---|
| Website build | Content API | Build time | Fetch published content |
| Contact form | Content API | Runtime | Submit enquiries |
| IIS | Website, Content API, Studio | Runtime | The public website is on its own domain. The Studio and its API are on the same origin, on their own subdomain, never the website's domain. Only `/api/v1/public/*` is routed through the website's domain, for the contact form; the auth endpoints are not |
| Studio | SES | Runtime | Password reset, once configured |
| Website | Tag Manager and GA4 | Runtime, after consent | Analytics |

---

## 13. Assumptions and constraints

**Constraints**
- React and .NET only. Node runs at build time for the website; no Node server in production
- IIS on Windows Server
- SQL Server
- English only
- Website builds are triggered manually

**Assumptions**
- The company SQL Server instance can host the content database
- IIS can be configured with URL Rewrite
- SES will be configured before password reset by email is needed
- Marketing can supply a content reviewer for parity sign-off

---

## 14. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Search traffic lost at cutover | Low | Medium | Accepted. The old live site serves an empty shell with one title on every URL, so little is indexed. Custom 404 guides visitors; monitor Search Console after cutover |
| R2 | Content lost when extracting from HTML | Low | Medium | Mitigated — dry run reviewed before import; parity sign-off |
| R16 | Placeholder case studies or blogs published by mistake | Medium | High | Imported as drafts; publishing requires an editor's explicit action |
| R17 | Design drifts during the rebuild | Medium | High | Existing stylesheets ported as they are; automated screenshot parity |
| R3 | Editors think publishing is broken | Medium | Medium | Studio shows "awaiting build"; editors briefed |
| R4 | Staff edit content in the old Node admin after cutover | Medium | High | Switch off Node content editing at cutover |
| R6 | Nothing is live for a long period | High | High | Staged delivery; website and Studio ship first |
| R9 | XSS pattern carried into the new system | Medium | High | Structured rich text; no raw HTML rendering; resolve the review finding |
| R10 | CSP blocks analytics or site features | Medium | Medium | Report-only first, then enforce |
| R11 | Image library licence costs | Low | Medium | Use a permissively licensed library |
| R12 | Backups never scheduled | Medium | High | IT owns the schedule; go-live blocked until it runs |
| R14 | Page builder grows beyond scope | Medium | Medium | A fixed list of section types; new types by change request |
| R15 | Studio routing constrained by static export | Low | Medium | Resolved — Studio built with Vite + React (D7) |

---

## 15. Decisions

### 15.1 Made

| Area | Decision |
|---|---|
| Staging | Website and Studio first |
| Identity | Shared, `admin` and `editor`, local accounts, JWT |
| Website | Next.js App Router, static export |
| Studio | Vite + React single-page app, Ant Design with Tailwind |
| Backend | .NET 10, controllers, EF Core |
| Databases | Content database `DigitalHubContent` |
| Content build | Website build calls the Content API; manual trigger |
| Images | Filesystem with metadata in the database; copied into the website build |
| Rich text | TipTap, stored as structured documents |
| Editability | Every page, by sections |
| Language | English only |
| URLs | Clean URLs; no legacy redirects |
| Old live site | Out of scope entirely |
| Design | Unchanged; existing stylesheets ported as they are |
| Content source | Branch `feature/interviewer-portal` only |
| Placeholder content | Case studies and blogs imported as drafts |
| Analytics | Tag Manager and GA4 with Consent Mode v2 |
| Contact form | Moves to the Content API |
| Careers | Applying is by email to `careersEmail`, or the main email when that is empty |
| Vacancies | In the content database. None migrated — all were test data |
| Hosting | IIS on Windows Server |

### 15.2 Open

| # | Decision | Recommendation |
|---|---|---|
| D1 | Staging and production domains | — |
| D3 | SQL Server certificate for production | Full validation with a trusted certificate |
| D4 | SES configuration | Needed before password reset by email |
| D5 | Environments and their databases | Development, staging, production, each with its own content database |
| D7 | Studio framework | **Decided: Vite + React** |
| D8 | XSS finding details | Awaiting the review team |

**D7 — Studio framework. Decided: Vite + React.** Next.js static export cannot serve routes like `/items/[id]` for identifiers unknown at build time, and a Node server in production is ruled out. SEO does not apply behind a login, so the Studio is a plain React single-page app. The website stays on Next.js. Shared section components must therefore avoid Next-specific imports.

---

## 16. Roadmap

| Phase | Delivers | Exit criteria |
|---|---|---|
| 0 — Analysis | This document | Reviewed and signed off; open decisions resolved |
| A — Foundation | Repository, Content API, schema, shared identity, migration and seed | **Done** — commit `8c2f0d0` on `rebuild/dotnet-platform` |
| B — Studio | Every Studio requirement | All FR-S requirements accepted |
| C — Website | Every website requirement, shared section components | All FR-W and NFR-01 to 05 met on staging |
| D — Deployment setup | IIS for the website, Studio, and Content API, including the website's public API routes and the production proxy address for the contact rate limit | The three applications run on IIS |
| E — Parallel run | New site on staging beside the current system | Content parity sign-off; screenshot parity passed; reachability test passed |
| F — Cutover | New website and Studio live | Rollback tested; backups scheduled and verified |

The previous site is kept deployable until the new one has run without incident. Switching back is a routing change, not a rebuild.

---

## 17. Acceptance criteria and success measures

**Go-live requires all of these:**
- Lighthouse SEO 100 on every page type
- Lighthouse accessibility 95 or above; performance 93.5 or above
- Zero horizontal overflow at 390px and 320px on every page
- Screenshot parity with `feature/interviewer-portal` on every page, at desktop, tablet, and mobile widths
- Structured data validates with no errors
- No private path reachable on the deployed site
- Content parity signed off
- A restore drill passed against the production backups
- Backups running on schedule

**Measured after go-live:**
- Organic search traffic against the pre-cutover baseline
- Pages indexed, from Search Console
- Contact form submissions
- Time for an editor to publish a change

---

## 18. Inputs to DevOps

What DevOps must design from this analysis.

**Environments:** development, staging, production — each with its own content database.

**Artifacts**

| Artifact | Build | Runs on |
|---|---|---|
| Website | Next.js static export | IIS, static site |
| Studio | React production build | IIS, static site |
| Content API | .NET publish | IIS, ASP.NET Core Module |

**Website build pipeline**
1. Triggered manually
2. Fetches published content from the Content API
3. Copies published images into the output
4. Generates pages, sitemap, robots file, `llms.txt`, and redirect rules
5. Runs Lighthouse on every page type; fails below the SEO threshold
6. Validates structured data and checks every redirect lands on a live page
7. Deploys to IIS

**IIS configuration:** URL Rewrite for redirects and clean URLs; custom error pages with correct status codes; security headers; TLS termination.

**Configuration and secrets:** connection strings, token signing key, initial admin password, SES credentials, analytics container ID. None in the repository.

**Monitoring and alerts:** health endpoints; uptime on the website, Studio, and APIs; error tracking; alerts on build failure, backup failure or a backup that did not run, disk above 80%, and certificate expiry within 30 days.

**Backups:** hourly full backups of `DigitalHubContent`, SIMPLE recovery, off the data disk, seven days kept. **The image folder is backed up with the content database** — images live on the filesystem, so a database restore without them leaves broken images.

**Runbooks required:** migration, cutover, rollback, restore.

---

## 19. Next steps

1. Review this analysis with the tech lead, IT, and marketing
2. Resolve the remaining open decisions — D1, D3, D4, D5, and D8
3. Sign off the analysis
4. DevOps designs environments, pipelines, and the IIS topology from section 18
5. Phase A begins

**The Phase A foundation brief** (`docs/phase-a-foundation.md`) implements this analysis: the shared identity, the API conventions in section 6.5, and the Vite + React Studio.
