# Phase B — Content Studio

Build brief for Cursor. The Content Studio: the application editors use to manage every page, collection, image, and setting on the website.

**Read first:** `docs/business-analysis.md` (version 1.1) and `docs/phase-a-foundation.md`. Phase A built the API, identity, schema, and imported content. This phase builds the editing application on top of it.

Work in `D:\work\DigitalHub\dh-platform`, branch `rebuild/dotnet-platform`. Work through the sections in order. **Stop after each section, show the result, and wait for confirmation.** No section starts until the previous one is verified complete. End every section with a coverage table: Item, Source, Status, Evidence. Nothing is done without evidence. Anything moved names the section it moved to, and that section's table includes it. Sections 2 and 7 stop for an approach review before any code.

---

## Settled decisions — do not revisit

| Area | Decision |
|---|---|
| Studio stack | Vite + React + TypeScript, Ant Design, Tailwind, React Router, TanStack Query |
| Studio design | Old Content Studio look and flows, approved in Section 12. Tokens live in `packages/theme` for Phase G. Website brand `#1270A0` is untouched. |
| Hosting | Studio and API on the **same origin**, on their own subdomain, never the website's domain. Vite proxy in development, IIS in production. No CORS. See Hosting below |
| Tokens | Access token in memory only. Session restored after reload through `refresh`, echoing the `dh_csrf` cookie as the `X-CSRF-Token` header |
| Roles in the Studio | `admin` and `editor` only. The other three roles exist but are not assignable from the Studio until hiring moves |
| Rich text | TipTap, structured JSON, allowed nodes only |
| Preview | **Deferred to Phase C.** It renders the website's own section components, which are built there. Record this; do not build a separate preview renderer |
| Unpublished references | **Phase C.** A reference to an unpublished item is never rendered as a link. The card is skipped at build |
| Error pages | **Phase C.** The current site has no 404 or 500 pages. Build them as new pages from existing design components — header, footer, hub hero, and call to action — with no new styles. Content is edited in the Studio (`error-404` / `error-500`) |
| Vacancy bridge to Node | **Phase D**, not this phase |
| ForwardedHeaders:KnownProxies | **Phase D deployment.** Set this to the production IIS proxy address. If it is empty, `X-Forwarded-For` is ignored and the contact rate limit counts every visitor as one |
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
- **`DigitalHubContent` is the imported content database.** Browser checks and end-to-end tests must never write to it. They use a separate database (integration tests already use `DigitalHubContent_Test`). After a Studio browser session that touched `DigitalHubContent`, drop it, re-apply migrations with the elevated account, re-import from `feature/interviewer-portal`, and recreate the development editor account.

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

The Ant Design form walker approved with this section is not built here. It is the section form in Section 7 (7.1). This section delivers the schemas and the API validation.

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

Allowed attributes, and nothing else: heading `level`; image `mediaId`, `alt`, and `decorative`; link `href`, or `type` and `id`; code block `language`; table cell and header `colspan` and `rowspan`. Bold, italic, and code marks have no attributes. Every other node has none.

**6.5** Tests: a document with a disallowed node, a `javascript:` link, and an image not from the media library are each rejected. A paste from Word and a paste from a web page each keep only allowed nodes.

**6.6** Internal links in rich text use the same `{ type, id }` reference, turned into a path at build, so a rename never breaks a link inside an article. A rich-text link may name a service, partner, case study, blog post, page, or vacancy.

**6.7** External links: parse the URL and allow only `http`, `https`, `mailto`, and `tel`. Reject `javascript:`, `data:`, `vbscript:`, and protocol-relative `//host` links, including case and whitespace variations. A test for each.

**6.8** Headings h2 to h4 only. h1 is the page title, one per page.

**6.9** Images inside rich text carry a media id only, never a URL. They also carry alt text, unless the image is marked decorative.

**6.10** Cap document size at 1,048,576 UTF-8 bytes (1 MB) and nesting depth at 32. Reject anything over either cap. The largest stored article body is `digital-transformation-signs` at 9,244 UTF-8 bytes. Long articles with tables grow much larger as TipTap JSON, and 1 MB still leaves headroom on an authenticated endpoint.

An empty blog body is a valid draft. Publish is refused until the body has text or an image, because the article page would otherwise be blank.

**Phase C.** The website renders the TipTap document. The page title is the only h1. An internal link is `{ type, id }`, resolved to a path at build; a missing or unpublished target is not rendered as a link. An image is loaded from its media id, never from a URL stored in the document. Alt text is the node's own alt, unless the image is decorative. An empty body renders no article content. Only the attributes in 6.4 are rendered.

---

## Section 7 — Editing screens. Report the approach before building.

**7.1** Propose the layout for:
- Collection list and item editor
- Page editor: the ordered list of sections with add, reorder by drag, show or hide, and edit
- The section form generated from the registry. This is the Ant Design form walker approved in Section 2; it was not built there
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

**9.5** The website reaches this endpoint through IIS, so the API sees the proxy's address, not the visitor's. Forwarded headers trust only the known proxy: `X-Forwarded-For` from that address is used; from any other address it is ignored. The rate limit uses the resulting visitor address.

**9.6** Every field has a length cap, including the message. Everything is stored and shown as plain text — the Studio inbox renders it escaped.

**9.7** The visitor's IP address is not stored with the enquiry. It is used only for the rate limit.

**9.8** New enquiries show a count on the contact inbox in the Studio menu. Email notification waits until SES is configured.

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
- 10.18 End-to-end runs use `DigitalHubContent_E2e`, reset before every run, never `DigitalHubContent`
- 10.19 A contact enquiry whose message contains `<script>alert(1)</script>` is stored unchanged and shows as plain text in the inbox
- 10.20 `dangerouslySetInnerHTML` appears nowhere in the Studio source; after sign-in neither `localStorage` nor `sessionStorage` holds a token

---

## Section 11 — Report

**11.1** Every file and project added, and every migration.

**11.2** The section registry: the 28 types and their fields.

**11.3** Every imported published item with an empty effective meta description.

**11.4** Test counts: integration and end-to-end.

**11.5** Anything you were unsure about rather than guessing.

**11.6** What Phase C needs from this phase — in particular what the preview will plug into.

**11.7** Confirm no secret is committed.

---

## Section 12 — Studio appearance

The Studio follows the **old Content Studio** on `feature/interviewer-portal` (`admin/index.html`, `admin/admin.js`, `admin/admin.css`): layout, navigation, screens, flows, and look. It is not the modern-CMS charcoal/rail direction.

Publishing, media, and roles stay as built in Sections 1–11. Save is not publish. There is no whole-store import and no featured flag. Socials stay in site settings; the footer reads them from there.

Do not take the kanban board, avatar stacks, the AI banner, gradient buttons, or any of that product's own features.

**12.6 stands.** The website's design is untouched by this section. `#1270A0` remains the website's primary. The Studio uses a lighter derivative, named below, and never writes tokens into the website.

### 12.1 Written proposal

#### Brand blue, and why it cannot be the Studio primary

`#1270A0` on the proposed card `#22272D` is **2.76:1**. On the page `#17191C` it is **3.23:1**. Both fail WCAG AA for text (4.5:1) and for UI components (3:1). It reads as a dark stain, not an accent.

Off-white `#E6E9ED` on `#1270A0` is **4.48:1** — a hair under AA for small text. The website can keep using it because its surfaces are light. The Studio cannot.

**Proposed Studio accent:** `#45A8D4` — the same hue as `#1270A0` (~199°), lifted in lightness, slightly eased in saturation so it does not fluoresce on dark grey.

| Colour | Use | On card `#22272D` | On page `#17191C` |
|---|---|---|---|
| `#1270A0` website brand | Website only. Not a Studio button, link, or selection | **2.76:1 — fail** | **3.23:1 — fail** |
| `#45A8D4` Studio accent | Links, selection, focus ring, active rail disk. **Not** the primary button fill | **5.59:1 — AA** | **6.55:1 — AA** |

**Primary button (approved):** near-black `#0E1114` with off-white `#E6E9ED` text, matching the reference — the primary action is quiet; colour is reserved for status.

| Pair | Contrast | Notes |
|---|---|---|
| `#E6E9ED` on `#0E1114` | **15.55:1** | Label. AAA |
| `#0E1114` on card `#22272D` | **1.26:1** | Fill vs card. The same quiet step as the reference. Going darker than this card cannot reach 3:1 — the card is already too dark. The control is identified by the label and the focus ring, not by a coloured slab. |
| `#45A8D4` on `#0E1114` | **7.04:1** | Focus ring on the button |

`#45A8D4` still appears as: text links, the selected collection title, the 2px focus ring, the filled disk of the active rail item (icon `#0C1A22`, **6.58:1**), table-row and pill selection, and the input caret/active border. It is never a button fill, never a banner, never a chip.

Ghost and default buttons are `surface.raised` with primary text. Destructive stays `#E06B6B` as text, not a red fill.

Orange `#F4970B` is **6.65:1** on the card as text or a small icon. It is never a background, never a button fill, never a banner wash.

#### Type

Poppins is a geometric display face. At 20px and above — page titles, card titles — it holds: the bold weight is tight, the shapes are calm, it matches the website's heading voice. At 12–14px it does not. The bowls of `a`, `e`, and `g` fill in, the wide proportions loosen tables and chips, and hinting on Windows is weaker than a UI face.

**Headings stay Poppins.** Body, labels, chips, tables, form controls, and the rich-text chrome use **Inter**. Inter is also geometric, so the pair does not clash, and it is drawn for 13px UI. Load `@fontsource/inter` the same way Poppins is loaded today. Do not introduce a third family.

#### Full palette

Surfaces, lightest last. Depth comes from these steps, not from drop shadows. Shadows, if any, are a 4% black at 8px blur and are not required for the hierarchy to read.

| Token | Hex | Role |
|---|---|---|
| `surface.page` | `#17191C` | Application canvas. In the `#15171a`–`#1a1d21` band. Never `#000`. |
| `surface.card` | `#22272D` | Lists, editor, sign-in card, drawers. Lighter than the page. |
| `surface.raised` | `#2B3138` | Icon-rail active disk, dropdowns, popovers, hover rows, sticky toolbars. |
| `surface.input` | `#1C2025` | Fields inset on a card — a fourth step so inputs read as wells, not as second cards. |
| `text.primary` | `#E6E9ED` | Titles, body, input value. Soft off-white, never `#fff`. |
| `text.secondary` | `#A4ADB6` | Subtitles, helper text, timestamps, column headers. |
| `text.muted` | `#8B949E` | Placeholders, disabled, legal asides. Still AA on the card. |
| `border.subtle` | `#343B43` | 1px at ~1.3:1 on the card — present, not a frame. |
| `accent` | `#45A8D4` | Links, selection, focus, primary fill. |
| `accent.on` | `#0C1A22` | Text on a primary fill. |
| `warning` | `#F4970B` | Attention text and icon only. |
| `error` | `#E06B6B` | Destructive text, error icon, validation. |

Contrast of text against surfaces:

| Foreground | Page `#17191C` | Card `#22272D` | Raised `#2B3138` |
|---|---|---|---|
| `#E6E9ED` | 14.46 | 12.35 | 10.78 |
| `#A4ADB6` | 7.74 | 6.61 | — |
| `#8B949E` | — | 4.89 | — |
| `#45A8D4` | 6.55 | 5.59 | — |
| `#F4970B` | — | 6.65 | — |
| `#E06B6B` | — | 4.64 | — |

Semantic chips (small tinted pills, 12px Inter, a 14px icon, never Ant `Tag` colours):

| State | Background | Foreground | Contrast | Icon |
|---|---|---|---|---|
| Draft | `#2A3036` | `#C8D0D8` | 8.55 | empty circle |
| Published | `#1E3A2C` | `#7DCEA0` | 6.61 | check |
| Changed | `#3A3118` | `#E8C36A` | 7.62 | pencil |
| Ended | `#3A3118` | `#F4970B` | 5.68 | minus |
| Warning (inline) | none | `#F4970B` on card | 6.65 | alert |
| Error | `#3A2224` | `#E06B6B` | 4.52 | x |

Chip foregrounds also pass on the card if the fill is omitted: draft 9.65, published 8.03, changed 8.91.

#### Radius, spacing, type scale

| Token | Value |
|---|---|
| Radius card | 20px |
| Radius raised / modal / drawer | 16px |
| Radius control (input, button, select) | 12px |
| Radius chip / pill / segmented | 999px |
| Radius icon disk | 999px |
| Space base | 8px |
| Page padding | 24px (32px on wide) |
| Card padding | 20px |
| Stack between cards | 16px |
| Rail inset from the viewport | 12px |

Type:

| Role | Face | Size / line / weight |
|---|---|---|
| Page title | Poppins | 22 / 28 / 600 |
| Card title | Poppins | 16 / 22 / 600 |
| Section title | Poppins | 14 / 20 / 600 |
| Body, form value | Inter | 14 / 22 / 400 |
| Secondary, table cell | Inter | 13 / 20 / 400 |
| Chip, overline, column header | Inter | 12 / 16 / 500 |

Card header, every time it appears: a 32px muted circle (`surface.raised`) holding a 16px icon in `text.secondary`; Poppins title; Inter subtitle in `text.secondary`. No orange block as a logo.

#### How each area changes

**Sign-in.** Page surface, one centred card. The orange square used as a mark today goes. Header: muted icon disk, “Content Studio”, subtitle “Digital Hub”. Inter fields, primary pill button. Error is the error chip colour as an inline message, not a pastel Ant Alert.

**Shell and icon rail.** Replace the 240px labelled `Sider` and the grouped `Menu`. A floating rail sits on the page surface, 12px from the left, radius 24px, `surface.card`, hairline border. It holds the four groups (Content, Library, Site, Administration) with **icon and label** on each row — icon-only would make editors hover to find things. The labels make the rail **176px** wide, not 72px. That width is reported; the labels stay. The active group is a filled `#45A8D4` disk for the icon (navy glyph) plus primary text, not a highlighted row. The current group’s screens are a **pill nav** in the top bar. The top bar is a quiet strip on the page: user email in secondary text, role as a chip, sign-out as a ghost control. The contact new-count is a small accent dot or a quiet numeric chip on the inbox pill — not Ant `Badge`.

**Collection lists.** One card. Title row is a card header (icon, collection name, secondary count). Filters are pill segmented controls (All / Draft / Published / Ended) plus a search field, not a default `Select`. Rows are a quiet table: no vertical rules, row hover is `surface.raised`, title is accent-as-link, state is a chip. “New” is the primary pill. Reorder controls stay; they become compact ghosts, not default Ant buttons.

**Item editor.** The item sits in a card. Header: type icon, title, slug as the grey subtitle, state chip. Publish / Unpublish / Discard / Delete become a tight cluster of pills on the right — primary for Publish, ghost for the rest, error text for Delete. The “not on the website yet” line is secondary text, not a gold Tag. Fields and the SEO panel are a single calm column with 16px gaps; the SEO preview is a raised inset, not a second visual language. The slug-redirect warning uses the warning colour as text and icon only.

**Section list and form.** The section list is a stack of small cards on the page, not a raw list. Each row: grip, type icon in a muted circle, type name, visibility as a quiet chip, no loud switches. The open section is a drawer or a raised card using the same header pattern. The form walker keeps Ant Form for behaviour; labels, spacing, and controls take the tokens. Media fields show a thumbnail on `surface.raised`, not a dashed Ant Upload well.

**Rich text editor.** TipTap’s chrome is the part that will look like a leftover unless it is restyled. Toolbar: raised pill group, 12px icons, accent for the active mark. The document surface is `surface.input` inside the card. Paragraphs are Inter 14; headings inside the document are Poppins so the editor hints at the website’s heading voice without pretending to be a preview (preview stays Phase C). The link and image modals use the same card language.

**Media library.** A card wrapping a grid, not a list that feels like a file manager. Tiles sit on `surface.raised`, 16px radius, alt as secondary text under the image. The detail pane is a drawer: header (image icon, original name, dimensions as subtitle), fields, usage list as secondary lines. Delete-in-use is an error-coloured message listing places — same words as today, quieter clothes.

**Administration screens.** Users, audit, redirects, navigation, settings, error pages, and the contact inbox keep their information density. They move onto cards, use chips instead of Tags, and use the pill primary for the one forward action on the screen. Tables follow the collection-list treatment. The inbox drawer renders the enquiry as Inter on the card — still escaped text, still the 10.19 answer to XSS. Settings stays a long form; group each block as a card header plus fields, not one undifferentiated Ant Form.

#### How Ant Design is themed, and what will fight it

Use `theme.darkAlgorithm` plus an explicit token map, not “dark class + hope”. Map every colour above onto Ant tokens (`colorBgBase`, `colorBgContainer`, `colorBgElevated`, `colorText`, `colorTextSecondary`, `colorBorder`, `colorPrimary`, `colorPrimaryHover`, `colorWarning`, `colorError`, `borderRadius`, `borderRadiusLG`, `fontFamily`, `fontFamilyCode`). Set `colorPrimary` to the accent so links, selection, and the focus ring stay blue. Override `Button` so `type="primary"` is `#0E1114` with `#E6E9ED` (`colorTextLightSolid`). Put the same values on CSS custom properties so Tailwind utilities and TipTap see one source.

These components will fight the language and need `components` overrides or a thin wrapper. They are the reason a token dump alone will not get us there:

| Component | Why it fights |
|---|---|
| `Layout` / `Layout.Sider` / `Layout.Header` | Built as a docked app frame. The rail is floating; the header is not a 64px white bar. Likely replaced by plain elements. |
| `Menu` | Selected row, group labels, indent. Cannot become circular icon disks. The rail is not a `Menu`. |
| `Badge` | Default is a loud red count. Contact count must be a chip or a 6px accent dot. |
| `Tag` | Saturated presets (green / gold / blue). Every status `Tag` is replaced by the chips above. |
| `Table` | Header wash, grid lines, white hover, dense row height. Override header/row colours and drop vertical borders. |
| `Card` | Default radius, border, and optional shadow. Set radius 20, border `border.subtle`, no shadow, `colorBgContainer`. |
| `Button` | Primary assumes the accent fill. Override to near-black `#0E1114` with off-white text; keep `colorPrimary` blue for links and focus. |
| `Tabs` | Ink-bar underline. Collection filters and editor panes should be `Segmented` pills, not `Tabs`. |
| `Segmented` | The right primitive; its default track is too light. Recolour track to `surface.input`, active thumb to `surface.raised`. |
| `Input` / `Input.Password` / `Input.Search` / `Input.TextArea` | Light fill, 6px radius, strong hover border. Map to `surface.input`, 12px radius, accent focus ring only. |
| `Select` / `DatePicker` | Same as Input, plus a light dropdown. Dropdown is `surface.raised`. |
| `Modal` / `Drawer` | White body, sharp corners, heavy mask. Radius 16, card surface, mask at 50% page colour. |
| `Alert` | Pastel fills. Prefer inline text + icon in warning/error colour. If `Alert` stays, restyle to chip colours. |
| `message` / `notification` | Light toasts. Elevated surface, primary text, no coloured slab. |
| `Typography.Title` | Default size/weight and near-white (too bright) in dark algorithm. Cap at the scale above; never `#fff`. |
| `Form` | Label colour and required-mark red. Labels are secondary 12px Inter; required mark uses error, not orange. |
| `Upload` | Dashed well, light drag state. Media fields should not look like Ant Upload. |
| `Pagination` / `Empty` / `Result` / `Spin` | Default illustrations and light wells. Recolour or replace `Result` (the 403 screen). |
| `Tooltip` / `Dropdown` / `Popover` | Light balloons. Raised surface, 12px radius. |
| `Checkbox` / `Radio` / `Switch` | Primary fill is fine if `colorPrimary` is the accent; unchecked borders must not go light-grey. |
| TipTap / ProseMirror | Not Ant. Needs its own stylesheet against the same tokens or it will stay a white box. |

Hard-coded `#1270A0`, `#fff`, `bg-slate-50`, and `border-slate-200` in `SignInPage`, `AppShell`, and `NavigationPage` are removed as part of the restyle. They are the present leak of the light default.

#### Closest CMS reference

**Payload** is the closest. Dark-first, quiet chrome, editorial rather than dashboard, icon-led navigation, status as small labels. It is the thing an editor of a headless site already expects.

Sanity is the second closest in temperament (calm desk, few colours) but its default is light and pane-heavy, and the desk metaphor is a layout we would be copying if we leaned on it. Contentful is a light enterprise table product. Storyblok is a visual, colourful editor — the opposite of this.

The Studio should feel like a dark Payload, wearing Digital Hub’s type and the dashboard’s *surface language*, not like Sanity, Contentful, or Storyblok.

#### Room for a light mode later

Yes, if every colour above is a semantic token (`surface.page`, `text.secondary`, `chip.published.bg`, …) held in one map and fed to both `ConfigProvider` and CSS variables. No hex in page components. A later light map inverts the surface stack (page lightest, cards still a step away from the page) and keeps the same accent, chips, and radii. Do not build the light map now. Do not put a theme switch in the shell. The token names are the only work this section does for that future.

#### Focus ring

A **2px solid `#45A8D4`** ring with **2px offset**. No glow, no white halo. On dark it reads as a bright cyan-blue line sitting just outside the control.

| Adjacent surface | Contrast of `#45A8D4` | AA 3:1 for non-text |
|---|---|---|
| Page `#17191C` | **6.55:1** | Pass |
| Card `#22272D` | **5.59:1** | Pass |
| Raised `#2B3138` | **4.88:1** | Pass |
| Input `#1C2025` | **6.08:1** | Pass |
| Primary button `#0E1114` | **7.04:1** | Pass |

Applied through `:focus-visible` on buttons, inputs (including search, textarea, password), native and Ant selects, chips, rail items, pill items, and keyboard-focusable table rows. Mouse click does not leave a stuck ring (`:focus-visible` only).

#### 12.2 Apply across every screen

Sign-in, the shell, every collection list, the item editor, section list and form, rich text, media library, navigation, redirects, contact inbox, settings, error pages, users, and the audit log. Same tokens, no leftover `bg-slate-50` / `#fff` / `#1270A0` in Studio chrome.

#### 12.3 Real logo

The website wordmark `digital-hub-logo.png` (white mark, the file the site already uses). Sign-in and the rail. No orange square.

#### 12.4 Shared package for Phase G

Tokens, CSS variables, type faces, and the logo live in `packages/theme` (`@digitalhub/theme`). Studio consumes that package. Phase G (hiring) can import the same tokens without taking Studio chrome. The website is not wired to it.

#### 12.5 Re-check

Every screen as admin and as editor, against `DigitalHubContent_E2e`, never `DigitalHubContent`.

#### 12.6 Website

No Studio token, font load, or Ant theme is shared with the website. The website keeps `#1270A0`, `#F4970B`, and Poppins as it has them. Phase C preview renders website components, not Studio chrome.

---

### Coverage

| Item | Source | Status | Evidence |
|---|---|---|---|
| 12.1 Written proposal: old panel look, layout, and flows | This section | Approved | Navy `#07111F` shell, 258px labelled sidebar, full-page editor. Change password from the user menu. Duplicate as a new draft only. Save is not publish. No featured flag. No whole-store import. Socials stay in site settings. |
| 12.2 Apply across every Studio screen | Build | Pass | Sign-in, Overview, collections, editor, media, site, admin screens use the old chrome. |
| 12.3 Real logo | Build | Pass | `packages/theme/assets/digital-hub-logo.png` on sign-in and the sidebar. |
| 12.4 Tokens in a shared package for Phase G | Build | Pass | `@digitalhub/theme` (`packages/theme`). Website not imported. |
| 12.5 Re-check every screen as admin and editor on `DigitalHubContent_E2e` | `studio/e2e/appearance.spec.ts` | Pass | Admin and editor walks; editor has no User Management or Audit log. |
| 12.6 Website design untouched | Settled decisions | Stands | Studio tokens are not shared with the website. |

---

## Running a review API

A review API must never start on `DigitalHubContent`. The connection string in
user-secrets names the real database, so a plain `dotnet run` binds to it. Start
the review API with an environment override instead, which leaves user-secrets
untouched and swaps only the catalog:

```powershell
$project = 'D:\work\DigitalHub\dh-platform\api\src\DigitalHub.Api\DigitalHub.Api.csproj'

$secret = (dotnet user-secrets list --project $project |
    Where-Object { $_ -like 'ConnectionStrings:Content = *' }) -replace '^ConnectionStrings:Content = ', ''
if (-not $secret) { throw 'No ConnectionStrings:Content in user-secrets.' }

$studio = $secret -replace '(?i)(Database|Initial Catalog)=[^;]+', 'Database=DigitalHubContent_Studio'
if ($studio -match '(?i)(Database|Initial Catalog)=DigitalHubContent\s*(;|$)') {
    throw 'Refusing to start a review API on DigitalHubContent.'
}

$env:ConnectionStrings__Content = $studio
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5088'

dotnet run --project $project -c Release --no-build --no-launch-profile
```

The guard refuses to start rather than fall back, so a mistyped catalog stops the
run instead of reaching the real database. The connection string is read into a
variable and never printed. `--no-launch-profile` keeps `launchSettings.json`
from putting the URLs or environment back.

Confirm the binding from the server, not from configuration:

```sql
SELECT DISTINCT DB_NAME(database_id)
FROM sys.dm_exec_sessions
WHERE host_process_id = <api pid> AND database_id > 4;
```
