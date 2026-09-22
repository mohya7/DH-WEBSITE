# Phase A — Foundation

Build brief for Cursor. The foundation for the Digital Hub website and Content Studio rebuild: repository, Content API, API conventions, shared identity, schema, and content migration.

**Read first:** `docs/business-analysis.md` — the signed-off analysis. It explains why every decision below was made. This brief tells you what to build.

Work through the sections in order. **Stop after each section, show the result, and wait for confirmation.**

This is a new project, separate from `DH-WEBSITE-main`. Read that repository for reference only. **Never modify it.**

---

## Settled decisions — do not revisit

| Area | Decision |
|---|---|
| Backend | .NET 10, ASP.NET Core Web API, controllers |
| Data access | EF Core, migrations in the repository |
| Database | SQL Server, content in its own database `DigitalHubContent` |
| Website | Next.js App Router, static export — built in Phase C |
| Studio | **Vite + React**, Ant Design, Tailwind — built in Phase B |
| Rich text | TipTap, stored as structured JSON |
| Identity | ASP.NET Core Identity, local accounts, **five roles from day one** |
| Tokens | Access token in memory; refresh token in an `HttpOnly` cookie |
| Images | Filesystem under the API, metadata in the database |
| Hosting | IIS on Windows Server. The Studio and its API are on their own subdomain, never the website's domain. See Hosting below |
| Language | English only |

### Hosting

- The Studio and its API are served from their own subdomain, never the website's domain. Third-party scripts on the website (Tag Manager and the tags it loads) must never run in the Studio's origin.
- Auth cookies are host-only: no Domain attribute, so they never reach the website's domain.
- The website's contact form reaches the API through routing of `/api/v1/public/*` only. The auth endpoints are not reachable on the website's domain.

---

## Constraints

- **Secrets never in the repository.** `dotnet user-secrets` locally. Never print a secret, password, or token.
- **No default credentials.** The application refuses to start without an initial admin password in configuration.
- **Schema changes stop for approval.** Report the migration before applying it.
- **Nothing is dropped silently.** Anything the seed cannot map is reported.
- **Verify by running it.** A section is done when it has been executed and measured, not when the code looks right.

---

## Section 1 — Repository

**1.1** Create the repository. If the GitHub CLI is installed and authenticated, use `gh repo create` as private. If not, stop and tell me — I will create it and give you the URL.

**1.2** Structure:

```
api/                .NET 10 solution
studio/             Vite + React — README only for now
website/            Next.js — README only for now
packages/blocks/    Shared React section components — README only for now
docs/
```

**1.3** In `packages/blocks/README.md`, record this constraint for Phase C:

> These components are used by both the Next.js website and the Vite Studio. They must not import anything Next-specific — no `next/image`, no `next/link`. Image and link rendering go through small adapter components each application supplies.

**1.4** `.gitignore` covering .NET, Node, secrets, `appsettings.*.json` files holding secrets, and local environment files.

**1.5** Save the business analysis as `docs/business-analysis.md` and this brief as `docs/phase-a-foundation.md`.

**1.6** Confirm nothing sensitive is committed.

---

## Section 2 — API scaffold and conventions

Build the conventions once, here, so every controller in every later phase follows them. The Hiring API will use the same conventions when it is rebuilt.

**2.1** .NET 10 solution with a Web API project using controllers. EF Core with the SQL Server provider, plus design and tools packages. Connection string from user-secrets.

**2.2** Conventions, implemented as shared infrastructure:

| Concern | Implementation |
|---|---|
| Base path | Every route under `/api/v1/` |
| Errors | RFC 7807 problem details for every error, including unhandled exceptions, with a stable `code` field |
| Dates | UTC, ISO 8601 in every response |
| Validation | Server-side on every input; failures return 400 problem details listing each field |
| Concurrency | A version token on every mutable entity; a stale write returns 409 |
| Pagination | One query-parameter convention and one response envelope |
| Tracing | A correlation ID on every request, returned in a response header and included in every log line |
| Authorisation | Policies per role; **no endpoint is reachable without an explicit policy or an explicit anonymous marker** |

**2.3** Unhandled exceptions return a generic problem detail. **No stack traces, internal paths, or SQL in any response.**

**2.4** Security headers on every API response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`. HSTS only when configured for HTTPS.

**2.5** Static files: the API serves **only** the media folder. Nothing else under `wwwroot` or the application directory is reachable. The old system exposed `.env` and its database credentials this way — test it.

**2.6** A `/health` endpoint that checks database connectivity.

**2.7** Structured logging with Serilog. Never log passwords, tokens, secrets, or personal data.

Report the conventions as implemented, with one example controller showing each in use.

---

## Section 3 — Shared identity

**3.1** ASP.NET Core Identity against `DigitalHubContent`.

**3.2** Five roles, created on first run:

| Role | Used by | From |
|---|---|---|
| `admin` | Studio | Phase B |
| `editor` | Studio | Phase B |
| `hr` | Hiring platform | Hiring rebuild |
| `marketing` | Hiring platform | Hiring rebuild |
| `interviewer` | Hiring platform | Hiring rebuild |

All five exist now so the hiring rebuild joins this identity instead of merging a second user store later.

**3.3** The initial admin user is created from configuration on first run. **If the password is not configured, the application refuses to start.** No default value anywhere in code, configuration, or documentation.

**3.4** Endpoints under `/api/v1/auth/`:

| Endpoint | Behaviour |
|---|---|
| `login` | Returns a short-lived access token in the body; sets the refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie |
| `refresh` | Issues a new access token and rotates the refresh token. The CSRF cookie `dh_csrf` is readable by the Studio (`Secure`, `SameSite=Strict`, path `/`) and must be echoed as `X-CSRF-Token`. The refresh cookie stays `HttpOnly` on `/api/v1/auth` |
| `logout` | Revokes the refresh token and clears the cookie |
| `me` | Returns the current user and role |

**3.5** Access tokens are never stored in `localStorage` by any client. Record this in `studio/README.md` for Phase B.

**3.6** Refresh tokens are stored hashed, rotate on every use, and a reused token revokes the whole chain.

**3.7** Password hashing uses Identity's defaults. Do not write a custom hasher.

**3.8** Rate limiting on `login`, keyed on **IP and username together**, so an attacker cannot lock out a real user by guessing against their account. Use ASP.NET Core's rate limiting middleware.

**3.9** Authorisation fails closed: a user whose role is missing or unrecognised gets nothing.

**3.10** Token signing key from configuration. Never committed.

---

## Section 4 — Schema. Report before applying.

**Source material, read only:**
- `D:\work\DigitalHub\New Website\DH-WEBSITE-main\content\admin-content.json`
- The designed HTML pages in that repository: `index.html`, `about-us.html`, `get-in-touch.html`, `services/`, `partners/`, `cases/`, `blogs/`, `careers/`, `news/`

**4.1** Report every collection and field in `admin-content.json`, with types.

**4.2** Report every designed page and the distinct kinds of section it contains. This becomes the list of section types. Expect roughly: hero, service hero with stage panel, feature grid, service cards, case study cards, partner logos, timeline, stats, team grid, testimonials, FAQ, rich text, call to action, contact details, news carousel, blog list, vacancy list. Report what is actually there.

**4.3** Propose the schema:

**Collections**, one table each: services, partners, case studies, blog posts, news, team members, vacancies.

Every collection table carries: `id`, `slug`, `title`, `status` (draft / published), `sort_order`, `published_at`, `created_at`, `updated_at`, a concurrency version, and SEO fields — meta title, meta description, share image, canonical override, noindex. Plus its own typed fields.

**Pages:** one table, with the same status, version, and SEO fields.

**Sections:** an ordered list per page **and** per collection detail item. Each has a type, a sort order, a visible flag, and typed fields. Report how section fields are stored — a JSON column validated per section type is the likely answer — and the trade-off before choosing.

**Rich text** fields store TipTap JSON, validated against the allowed node types: paragraph, headings h2–h4, bold, italic, link, bullet and ordered lists, blockquote, image from the media library, table, code.

**Media library:** file path, original name, content type, width, height, size, generated sizes, content hash, alt text, decorative flag, caption, uploader, created date.

**Redirects:** from path (unique), to path, status code, source (slug change / legacy / manual), created by, created date.

**Navigation:** header and footer menus, ordered, nestable one level.

**Site settings:** contact details, social links, footer text, default SEO, organisation details for structured data, analytics container ID, cookie banner text.

**Revisions:** a snapshot per publish, per item.

**Audit log:** user, action, entity type, entity id, timestamp, success, detail.

**Contact requests.**

**Identity tables**, from Section 3.

**4.4** Report the entity classes and the first migration. **Do not apply it until I confirm.**

### Confirmed with the schema

- `blog_posts.faq` is a JSON column with the same document as an `faq` section: `{ "items": [ { "question", "answer" } ] }`. Answers are plain text so an article can emit FAQPage structured data. `blogs[].faq` maps here. Empty source arrays become `{ "items": [] }`.
- `blog_posts.date_modified` is the editorial date. `blogs[].dateModified` maps to it. `updated_at` stays the row timestamp.
- `blogs[].answerBlock` maps to `blog_posts.answer_block`. Related posts are `relatedItems` on the body document, not a column. `blogs[].dataCallouts` and `blogs[].comparisonTable` are dropped: every value is empty or null, and a table inside an article is a TipTap table in `body`.
- Every foreign key to `media` (`image_id`, `share_image_id`, `default_share_image_id`) and `contact_requests.handled_by_id` to `AspNetUsers` is `ON DELETE NO ACTION`. Section ownership stays four nullable foreign keys with `ON DELETE CASCADE` and a check that exactly one is set.
- **Phase B must refuse to delete a media asset that is referenced by any column or by any section JSON.** The database will not clear those references.
- String arrays (`case_studies.categories`, `vacancies.interview_stages`) are JSON arrays in `nvarchar(max)`. `blog_posts.related_slugs` was dropped in Phase B; the column was empty, and related posts live on the body as `relatedItems`.
- `contact_requests.status` is `new` or `handled`, with `handled_by_id` and `handled_at`.
- Alt text defaults on `media.alt`. A usage may set an override. Publish checks the effective value.

---

## Section 5 — Database

After my confirmation:

**5.1** Create `DigitalHubContent` on the local instance, and `DigitalHubContent_Test` for integration tests.

**5.2** Create a dedicated login for the API with read and write on `DigitalHubContent` only. The same read and write grants exist on `DigitalHubContent_Test`, because the API under test uses this login. Not sysadmin. Not `db_owner`. No DDL. Not the existing hiring login. Password in user-secrets; never printed. The API connection string uses this login, not Windows authentication.

**5.3** Apply the migration with an elevated account, not the API login. Migrations are a deployment step. The application does not run them at startup.

**5.4** Set both databases to SIMPLE recovery.

**5.5** Integration tests run against `DigitalHubContent_Test` with the restricted login, not SQLite.

---

## Section 6 — Content migration

The largest part of this phase. The designed pages keep their content in HTML, not in the JSON file, so it has to be extracted.

The importer is a separate console tool, `api/tools/DigitalHub.ContentImport`. The API never reads the old repository and never runs this import at startup. The tool takes the path to `DH-WEBSITE-main`, connects with the restricted login, and is idempotent. `--dry-run` extracts and reports without writing. Images are read with SkiaSharp. The media folder under the API is content: it is gitignored except `.gitkeep`.

The source folder must be a clean checkout of `feature/interviewer-portal`. The importer refuses any other branch, and it records the commit it read. This import read `eb05f0647c3458cc612f8a9ed8625fbb0ebc7752`.

Phase C keeps that design unchanged. The existing stylesheets are ported as they are, and pages are checked for screenshot parity against `feature/interviewer-portal`.

Site settings email is `sales@digitalhubgroup.com`, the address on the page and in the company profile. The other address in the contact-page structured data is not imported. `site_settings` stores the postal address in `street_address`, `locality`, `region`, `postal_code`, and `country`. The footer text is the copyright line only. The footer and the contact section render from those fields. The source has no postal code, so that column is empty.

The old site live on digitalhub.com.eg is out of scope. Nothing is carried over from it: no redirects and no SEO settings. The redirects table starts empty, and the importer does not build a legacy redirect map.

**6.1** Import every collection item from `admin-content.json`.

Services, partners, team, news, pages, navigation, and site settings are real and are imported as they are. Case studies and blog posts are placeholder drafts: import every one, including `case-national-portal` and both HTML-only posts, with status `draft`. They stay in the Studio for editing and are not published. The vacancies table stays empty. Do not migrate the three career detail pages or the three JSON jobs as pages or vacancies. The careers hub and the apply page are migrated. The vacancy list shows no openings.

For Phase C, case cards and the blog list hide themselves when nothing is published. The vacancy list stays on the page and shows its empty-state message instead of hiding.

An image usage may set its own decorative flag. When that flag is set, publish does not require alt text for that usage. The media asset still holds the default alt. Internal links in imported content are rewritten to the clean URLs. The three careers-hub links to the dummy vacancy pages are removed at import. The vacancy list is generated from the vacancies table.

A `related_items` section stores each target as `{ "type", "slug" }` — `service`, `partner`, `case_study`, or `blog_post` — not as a URL path, so renaming a slug does not break the reference. Blog posts do not own sections. The related block on a post is the same shape, stored on the body document as `relatedItems`, separate from the TipTap `content`.

Team members use the `assets/team/` portraits the About page shows. The taller uploaded portraits are imported into the media library as unused alternates.

**6.2** Extract the content of every designed page from its HTML into sections — every heading, paragraph, image, link, and list — into the matching section type.

**6.3** Import every image the content references into the media library:
1. Validate by actual content, not extension
2. Strip all metadata
3. Convert to WebP
4. Generate 640, 1024, and 1600 pixel widths
5. Record dimensions and content hash
6. Carry existing alt text across from the HTML

Use a permissively licensed image library — SkiaSharp or NetVips. Do not use ImageSharp without checking its licence against the company's revenue.

**6.4** Import `contact-requests.json` into the contact requests table.

**6.5** No legacy redirects. The old live site is out of scope. The redirects table starts empty.

**6.6** The migration runs on database creation only and is idempotent. Running it again on a populated database changes nothing.

---

## Section 7 — Verify by running it

Report each result. If any step fails, stop and show it.

**Conventions**
- 7.1 An error from any endpoint returns problem details with a `code`, and no stack trace
- 7.2 Every response carries a correlation ID
- 7.3 A stale write returns 409
- 7.4 An endpoint without a policy or anonymous marker does not exist — confirm by listing every route and its policy

**Static files**
- 7.5 A media file returns 200
- 7.6 `appsettings.json`, `appsettings.Development.json`, the project file, and any path using `../` or encoded traversal all return 404

**Identity**
- 7.7 The application refuses to start without the initial admin password
- 7.8 Login, refresh, and logout work end to end
- 7.9 A reused refresh token revokes the chain
- 7.10 The login rate limit trips on repeated failures for one username without locking out a different username from the same IP
- 7.11 Each of the five roles exists
- 7.12 A user with no role, or an unknown role, is refused everywhere

**Migration**
- 7.13 Rows per table match items per collection in the source
- 7.14 Running the migration twice changes nothing
- 7.15 Skipped. The old live site is out of scope, so there is no legacy-redirect check.

---

## Section 8 — Report

**8.1** Repository URL and structure.

**8.2** Every table and its row count.

**8.3** The section types, and which pages use each.

**8.4** Per page: sections extracted, and anything that could not be mapped.

**8.5** Images imported, and every image missing alt text.

**8.6** Every redirect created.

**8.7** Anything you were unsure about rather than guessing.

**8.8** Confirm no secret is committed.
