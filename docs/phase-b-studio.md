# Phase B — Content Studio

Build brief for Cursor. The Content Studio: the application editors use to manage every page, collection, image, and setting on the website.

**Read first:** `docs/business-analysis.md` (version 1.1) and `docs/phase-a-foundation.md`. Phase A built the API, identity, schema, and imported content. This phase builds the editing application on top of it.

Work in `D:\work\DigitalHub\dh-platform`, branch `rebuild/dotnet-platform`. Work through the sections in order. **Stop after each section, show the result, and wait for confirmation.** Sections 2 and 7 stop for an approach review before any code.

---

## Settled decisions — do not revisit

| Area | Decision |
|---|---|
| Studio stack | Vite + React + TypeScript, Ant Design, Tailwind, React Router, TanStack Query |
| Studio design | Not locked. Ant Design, themed with the brand: primary `#1270A0`, accent `#F4970B`, font Poppins |
| Hosting | Studio and API on the **same origin**, on their own subdomain, never the website's domain. Vite proxy in development, IIS in production. No CORS. See Hosting below |
| Tokens | Access token in memory only. Session restored after reload through `refresh`, echoing the `dh_csrf` cookie as the `X-CSRF-Token` header |
| Roles in the Studio | `admin` and `editor` only. The other three roles exist but are not assignable from the Studio until hiring moves |
| Rich text | TipTap, structured JSON, allowed nodes only |
| Preview | **Deferred to Phase C.** It renders the website's own section components, which are built there. Record this; do not build a separate preview renderer |
| Unpublished references | **Phase C.** A reference to an unpublished item is never rendered as a link. The card is skipped at build |
| Vacancy bridge to Node | **Phase D**, not this phase |
| Website design | Untouched by this phase |

### Hosting

- The Studio and its API are served from their own subdomain, never the website's domain. Third-party scripts on the website (Tag Manager and the tags it loads) must never run in the Studio's origin.
- Auth cookies are host-only: no Domain attribute, so they never reach the website's domain.
- The website's contact form reaches the API through routing of `/api/v1/public/*` only. The auth endpoints are not reachable on the website's domain.

## Permissions

| Area | `editor` | `admin` |
|---|---|---|
| Pages, sections, collections | Create, edit, publish, unpublish | Same |
| Delete content | No | Yes |
| Media library | Upload, edit alt text | Same, plus delete |
| Navigation, redirects | Edit | Edit |
| Contact inbox | Read, mark handled | Same |
| Site settings | Read | Edit |
| Users | — | Create, deactivate, reset password, assign role |
| Audit log | — | Read |

---

## Constraints

- Every endpoint has an explicit policy. The fallback policy from Phase A stays.
- Every write returns problem details on failure and carries the concurrency version.
- Every write that changes content writes an **audit entry in the same transaction**. If the audit write fails, the action fails. This is deliberately stricter than the hiring notifications, which must never block an action — an audit trail with gaps is worse than a failed save.
- Access tokens are never written to `localStorage` or `sessionStorage`.
- `dangerouslySetInnerHTML` appears nowhere in the Studio.
- Schema changes are shown before they are applied, and applied with the elevated account, never by the application.
- The content importer refuses to write once a revision, a working copy, or an audit entry exists. After editing starts it must not overwrite editors' work or recreate a renamed item under its old slug.
- Verify by running it.

---

## Section 1 — Studio application and sign-in

**1.1** Scaffold `studio/` with Vite, React, TypeScript, Ant Design, Tailwind, React Router, and TanStack Query.

**1.2** Tailwind's base reset overrides Ant Design's component styles. Disable it, or scope it so Ant Design wins. Report exactly how, for the Tailwind version installed.

**1.3** Ant Design theme tokens: primary `#1270A0`, accent `#F4970B`, font Poppins.

**1.4** Vite development proxy: `/api` and `/media` to the local API, so the Studio and API share an origin and the auth cookies work unchanged.

**1.5** Auth client:
- Sign-in screen calling `/api/v1/auth/login`
- Access token held in memory
- On load, attempt `refresh` using the `dh_csrf` cookie as the header, so a reload keeps the session
- On a 401, refresh once and retry; if refresh fails, return to sign-in
- Sign out calls `logout`

**1.6** An application shell: navigation for every area in this brief, the signed-in user and role, and screens hidden from roles that cannot use them. **Hiding is presentation only** — the API enforces every permission.

**1.7** Report: a reload keeps the session; signing out ends it; a second tab shares it correctly.

---

## Section 2 — Section type registry. Report the approach before building.

There are 28 section types — the 27 from Phase A plus `faq`. Each type's fields must be defined **once** and used in three places: the API validates against it, the Studio builds its editing form from it, and Phase C's website components render it.

**2.1** Propose how. The likely answer is one JSON Schema file per section type in a shared folder, validated in .NET with a JSON Schema library and turned into Ant Design forms in the Studio. Report the trade-offs and the libraries before choosing.

**2.2** Field kinds the registry must express: text, long text, rich text, number, boolean, URL, a media reference with its per-usage alt override and decorative flag, a reference to another item (`{ type, id }`), and lists of any of these. The slug is resolved at build.

**2.3** Adding a section type later must mean: one schema file, one website component — nothing else.

**2.4** Every one of the 103 imported sections must validate against its schema. Report any that fail.

**Stop.** I will confirm the approach before you build it.

---

## Section 3 — Content API

Under `/api/v1/`, following the Phase A conventions.

**3.1** For pages and every collection: list with pagination, search, and status filter; read one; create; update; delete (admin only).

**3.2** For sections owned by a page, service, partner, or case study: add, update fields, reorder, show or hide, remove. Fields validated against the registry on every write.

**3.3** Every update carries the version. A stale version returns 409.

**3.4** Draft and published are separate states. **Editing a published item edits a draft copy; the live content does not change until the next publish.** Report how the draft is stored — a working copy per item, or revision rows — and why.

**3.5** Vacancies are editable here like any collection. The bridge to Node is Phase D.

**3.6** Integration tests for every endpoint: success, validation failure, 409, and each role — editor, admin, anonymous, unknown role.

**Decided with the build.** One working copy per item. An item and its sections are one unit with one version on the owning item.

- Discard draft: an editor can throw away the working copy of a published item and return to the live content. The action is audited. A draft that has never been published has no separate copy to discard.
- A slug change in a working copy creates its redirect at publish, not when the draft is saved.
- The Section 5 media in-use check covers working copies as well as live content. Revisions are not counted. Restoring a revision checks its media references and reports any that no longer exist.
- Every save of a working copy validates its sections against their schemas, the same as a live write.
- Delete refuses a published item. It must be unpublished first. Deleting a draft removes its working copy and sections by cascade, removes its revisions in the same transaction, and removes redirects whose destination is that item's public path. Each removed redirect is audited with the delete.

---

## Section 4 — Publishing

**4.1** Publish checks, before anything changes:
- Every image usage has an effective alt text, or is marked decorative
- Meta title — falls back to the title when empty
- Meta description — falls back to the summary where the item has one; **publish is blocked if the effective description is empty**
- Every section validates against the registry
- Every internal link and every `{ type, id }` reference points at something that exists

Publish returns every failure at once, not the first one.

**4.2** On publish: store a revision snapshot, write the audit entry, set `published_at`, and return the item's state.

**4.3** Unpublish takes the item off the site at the next build. Audited.

**4.4** Slugs: lowercase letters, numbers, and hyphens; unique per type; never equal to the source of an active redirect.

**4.5** Renaming the slug of a **published** item creates a redirect from the old URL to the new automatically. Chains collapse: if A points to B and B is renamed to C, A points to C. A redirect that would create a loop is refused.

**4.6** Revisions: list per item, view a snapshot, restore. **Restoring creates a new draft — it never publishes.**

**4.7** The Studio shows each item as published, draft, or changed since published. It states plainly that published changes appear on the website at the next build.

**4.8** Report every imported published item whose effective meta description is empty. They will be blocked the next time an editor publishes them, and editors need that list.

**Decided with the build.** No new table. Revisions, the audit log, and redirects already store this.

- Publish checks the working copy when there is one, otherwise the row, and writes nothing until every check has been collected. Meta title falls back to the title and is not stored over the empty field. Meta description is required only for an item with its own page, and then falls back to the summary. Team members and news items have no public URL, so publish does not require one. An image usage is acceptable when its own alt text is set, or the library alt is set, or that usage is marked decorative. A media id that is not in the library blocks publish.
- An internal link is a path beginning with `/`. `http`, `https`, `mailto`, `tel`, and `#` links are not looked up. A `{ type, id }` reference, including `relatedItems` on a blog body, must name an item that exists. A target that exists but is not published does not block publish. It comes back as a warning, because the card is skipped at build. Warnings travel with the failures when publish is blocked, and on the item when it succeeds. Renaming the target's slug does not change the stored id, so the reference still resolves.
- Publishing copies the working copy onto the row, deletes that copy, sets `published_at`, stores a revision snapshot, and audits `publish`. The redirect compares the new path with the path stored in the latest revision. Chains that pointed at that path are retargeted. A new path that is already a redirect source is refused on save and on publish.
- Unpublish sets the item back to draft, keeps `published_at`, and audits `unpublish`. A pending working copy is folded onto the row. The redirect is written on the next publish when the path differs from that revision.
- Restore writes a working copy when the item is published, and writes the row when it is a draft. It never changes `status`. Media that the snapshot names and the library no longer has are returned as `missingMedia`; the draft is still saved.
- Each item's `state` is `draft`, `published`, or `changed`. A published item includes the notice that published changes appear on the website at the next build. The Studio screen that shows this is Section 7.

---

## Section 5 — Media library

**5.1** Move the image pipeline from the importer into a shared project used by both the importer and the API. One pipeline, not two.

**5.2** Upload endpoint: validate by content, 5 MB cap, strip metadata, convert to WebP, generate the 640, 1024, and 1600 widths when the source is wider, record dimensions, deduplicate by hash.

**5.3** Alt text is required on upload, unless the image is marked decorative.

**5.4** List, search, and edit alt text and caption.

**5.5** Delete is refused while the image is used anywhere — any image column, any section's fields, or any rich text document. The refusal lists every place it is used.

**5.6** Uploads rate-limited to 20 per hour per user.

**5.7** Report: the upload pipeline and the importer produce identical output for the same file.

**5.8** Accepted formats: JPEG, PNG, and WebP only, judged by content, not by extension or declared type. Refuse SVG outright — it can carry script, and /media is served from the Studio's own origin, so an uploaded SVG would be stored cross-site scripting inside the Studio. Refuse everything else too.

**5.9** Read the dimensions from the image header and refuse anything over a pixel-count cap before decoding it. A small compressed file can expand into gigabytes of memory. The cap is 25,000,000 pixels.

**5.10** The stored filename comes from the content hash. The uploaded filename is kept only as metadata and never used in any path.

**5.11** /media responses carry `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; script-src 'none'; style-src 'none'; sandbox`, so a file cannot be interpreted as anything but an image.

EXIF orientation is applied before metadata is stripped, so a portrait phone photo is stored upright. An embedded colour profile is converted to sRGB before the profile is stripped, so a wide-gamut photo keeps its colours. The stored file keeps neither the orientation tag nor the profile.

---

## Section 6 — Rich text

**6.1–6.3** The TipTap editor, paste handling in the Studio, and the internal link picker are editing screens. They move to Section 7 and are built with the other screens. The server paste filter is in place now: a paste from Word or a web page keeps only allowed nodes.

**6.4** Server-side validator in .NET rejects any document containing a node, mark, or attribute outside the allowed list. The Studio's editor is a convenience — **the server is the guard.**

**6.5** Tests: a document with a disallowed node, a `javascript:` link, and an image not from the media library are each rejected. A paste from Word and a paste from a web page each keep only allowed nodes.

**6.6** Internal links in rich text use the same `{ type, id }` reference, turned into a path at build, so a rename never breaks a link inside an article. A rich-text link may name a service, partner, case study, blog post, page, or vacancy.

**6.7** External links: parse the URL and allow only `http`, `https`, `mailto`, and `tel`. Reject `javascript:`, `data:`, `vbscript:`, and protocol-relative `//host` links, including case and whitespace variations. A test for each.

**6.8** Headings h2 to h4 only. h1 is the page title, one per page.

**6.9** Images inside rich text carry a media id only, never a URL.

**6.10** Cap document size at 1,048,576 UTF-8 bytes (1 MB) and nesting depth at 32. Reject anything over either cap. The largest stored article body is `digital-transformation-signs` at 9,244 UTF-8 bytes. Long articles with tables grow much larger as TipTap JSON, and 1 MB still leaves headroom on an authenticated endpoint.

---

## Section 7 — Editing screens. Report the approach before building.

**7.1** Propose the layout for:
- Collection list and item editor
- Page editor: the ordered list of sections with add, reorder by drag, show or hide, and edit
- The section form generated from the registry
- The SEO panel
- The media picker

Stop and report before building.

**7.2** After confirmation, build them. The SEO panel shows length counters for title and description, and a preview of the search result.

**7.3** Slug editing on a published item warns that a redirect will be created, and shows it.

**7.4** A 409 shows a clear message that someone else changed the item, and offers to reload it. Unsaved work is not silently discarded.

**7.5** Leaving a screen with unsaved changes asks first.

**7.6** The TipTap editor, moved from 6.1. Only paragraph, headings h2 to h4, bold, italic, link, bullet list, ordered list, blockquote, image from the media library, table, and code. Nothing else can be inserted.

**7.7** Paste handling, moved from 6.2. Pasting from Word or a web page keeps only allowed nodes and drops everything else. The editor calls the same filter the server uses.

**7.8** The internal link picker, moved from 6.3. Internal links are chosen from existing content. External links follow 6.7.

---

## Section 8 — Administration screens

**8.1** Navigation: header and footer menus, reorder, one level of nesting, links chosen from existing content or entered as URLs.

**8.2** Site settings, admin only: contact details, the postal address fields, social links, footer text, default SEO, organisation details, analytics container ID, and cookie banner text.

**8.3** Redirects: list, add, remove. The same chain and loop rules as 4.5.

**8.4** Users, admin only: create with role `admin` or `editor`; deactivate, which revokes refresh tokens immediately; reset a password, which sets a temporary one that must be changed at next sign-in. Minimum length 12. An admin cannot deactivate themselves or remove the last active admin.

**8.5** Audit log, admin only: filter by user, action, content type, and date.

**8.6** Contact inbox: list, read, mark handled — recording who and when.

**8.7** Error pages: create editable 404 and 500 pages. The 404 content links to the main sections, since old URLs from the previous site will land there.

---

## Section 9 — Public contact endpoint

**9.1** `POST /api/v1/public/contact`, anonymous by explicit marker.

**9.2** Honeypot field: when filled, return success and store nothing.

**9.3** Server-side validation of every field. Rate limit 10 per hour per IP.

**9.4** Stores to `contact_requests` with status `new`. The website form is wired to it in Phase C.

---

## Section 10 — Verify by running it

Report each result. If any step fails, stop and show it.

**API** — in the integration suite against `DigitalHubContent_Test`:
- 10.1 Every endpoint: success, validation failure, 409, and each role
- 10.2 An editor cannot delete content, edit settings, manage users, or read the audit log
- 10.3 Publish blocked by missing alt text, an empty description, an invalid section, and a broken reference — all reported at once
- 10.4 Editing a published item does not change its live content until publish
- 10.5 Slug rename on a published item creates a redirect; chains collapse; a loop is refused
- 10.6 Restoring a revision creates a draft and does not publish
- 10.7 Deleting an image in use is refused and lists every usage
- 10.8 A write whose audit entry fails is rolled back
- 10.9 Rich text with a disallowed node, a `javascript:` link, or an outside image is rejected
- 10.10 Contact honeypot stores nothing; the rate limit trips
- 10.11 Deactivating a user revokes their session immediately; the last admin cannot be removed

**Studio** — end-to-end with Playwright:
- 10.12 Sign in; reload keeps the session; sign out ends it
- 10.13 Edit a section on a page and publish
- 10.14 Two sessions edit the same item; the second save shows the conflict message
- 10.15 Upload an image with alt text and use it in a section
- 10.16 Try to delete that image; the refusal lists where it is used
- 10.17 An editor does not see admin screens, and calling an admin endpoint directly returns 403

---

## Section 11 — Report

**11.1** Every file and project added, and every migration.

**11.2** The section registry: the 28 types and their fields.

**11.3** Every imported published item with an empty effective meta description.

**11.4** Test counts: integration and end-to-end.

**11.5** Anything you were unsure about rather than guessing.

**11.6** What Phase C needs from this phase — in particular what the preview will plug into.

**11.7** Confirm no secret is committed.
