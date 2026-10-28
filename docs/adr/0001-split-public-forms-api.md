# ADR 0001: Split the public forms into their own API

- Status: Proposed. The direction is decided (owner decision below); the
  details here are for review before any code is written.
- Date: 28 October 2026
- Replaces: the approach in GAP-36 and GAP-38 of
  `docs/quality/refinement-plan-2026-10-28.md` (one API, kept apart by host
  filtering and a second database login)

## Context

The website is a static export. The only things on it that call a server are
the contact form and the apply form. Everything else the API does is for the
Studio: sign-in, content, media, users, settings, audit, the inbox and
applications.

Today both are one process, `DigitalHub.Api`, using one database login,
`dh_content_app`, which can read and write every table, users and sessions
included. The API answers every route on any host (`AllowedHosts: "*"`). The
only thing planned to keep Studio routes off the website's domain is IIS
routing in Phase D, which is not built. A flaw in the public form code would
run with the same rights as the Studio.

## Decision

Owner decision: "b" (28 October 2026, this session, reply to "A or B for the
isolation."). Option B was: two separate APIs, a small public-forms API with
its own database login behind the website, and the admin API on the Studio
subdomain behind an allow-list.

1. **New project `DigitalHub.PublicApi`** in `api/src/`, its own process and
   IIS site, reached only through the website's domain at `/api/v1/public/`.
   It holds exactly two routes, `POST /api/v1/public/contact` and
   `POST /api/v1/public/apply`, with their rate limits, body limits, CV
   checks and email sending. It has no authentication, no Identity, no JWT
   signing key, no refresh cookie and no Studio controllers. Its fallback
   policy denies everything else.
2. **Shared code moves to a library**, `DigitalHub.Forms`: the contact and
   apply validation, `ApplicationIntake`, the throttles, dedupe and the email
   sender. Both the public API and the tests reference it; the admin API does
   not need it.
3. **Its own database login, `dh_public_forms`**, granted only:
   - INSERT on `contact_requests`
   - SELECT, INSERT, UPDATE on `application_counts` (the daily count MERGE)
   - SELECT on `vacancies` (open-vacancy check) and `site_settings` (mail
     recipients)

   Nothing on users, roles, sessions, refresh tokens, audit, media, working
   copies or content. The grants are a migration, shown before it is applied.
4. **A small DbContext for the public API** that maps only those four tables,
   so its code cannot reach anything else even before the login refuses it.
5. **The admin API keeps every other route** and stops serving
   `/api/v1/public/*`. It answers only on the Studio host: `AllowedHosts` is
   set to the Studio host in Production, and decision O-13 puts the Studio
   subdomain behind an office and VPN allow-list at IIS or the AWS security
   group, with the build machine that calls `/api/v1/build/content` on the
   list.
6. **The website's `web.config`** proxies `/api/v1/public/*` to the public API
   and nothing else. There is no route from the website's domain to the admin
   API.

## Consequences

- A flaw in the public forms reaches four tables, not the whole database, and
  cannot reach sign-in, sessions or content.
- The Studio and its API can be closed to the internet entirely (O-13); the
  public forms keep working because they never touch the Studio host.
- Two processes to deploy, watch and patch instead of one. Phase D gains a
  second IIS site, a second app pool identity and a second connection string
  (in the server's secret store, never in the repository).
- Tests: the public API gets its own integration suite against
  `DigitalHubContent_Test`. A permission test, like `AuditLogPermissionTests`,
  proves `dh_public_forms` cannot read users or sessions or change content.
  The route-list test proves the admin API has no `/public/` route and the
  public API has only its two.
- Estimated one to two weeks more than the GAP-36 and GAP-38 approach.

## Rejected

- **Option A, one API with host filtering and a second login per request.**
  Less work, but the public code would still live in the process that holds
  the signing key and the Studio routes; a mistake in routing or filtering
  would expose them.
- **Leaving it to IIS routing alone.** One configuration mistake exposes every
  Studio route on the website's domain, and nothing tests it before deploy.

## Rollback

Until Phase D, revert the pull requests. After Phase D, redeploy the previous
release of the admin API and the website's `web.config` together; the
`dh_public_forms` login can stay, since nothing else uses it.
