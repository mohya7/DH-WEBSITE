# Security settings the deployment must apply

The API and the Studio set what they can in code. These items live outside the
application and the deployment has to apply them. Hosting is AWS, run by the dev
team.

## Database: the application login

The API connects with its own SQL login (`dh_content_app` locally), never with an
elevated account. In every content catalog the login uses, the elevated account
runs:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'dh_content_app')
    CREATE USER [dh_content_app] FOR LOGIN [dh_content_app];
ALTER ROLE db_datareader ADD MEMBER [dh_content_app];
ALTER ROLE db_datawriter ADD MEMBER [dh_content_app];
DENY UPDATE, DELETE ON dbo.audit_log TO [dh_content_app];
```

- Read and write rows, no DDL (no `db_owner`, no `db_ddladmin`).
- **The audit log is append-only for this login.** The API only ever adds audit
  rows, so this DENY costs nothing, and someone who takes over the API host
  cannot erase what they did.
- The same lines run in CI (`.github/workflows/ci.yml`), the Studio end-to-end
  harness (`studio/e2e/start-api.ts`) and the parity tool
  (`api/tools/parity-snapshot.mjs`). `AuditLogPermissionTests` fails on a
  catalog where the DENY is missing.
- **Local catalogs that already exist** (`DigitalHubContent`,
  `DigitalHubContent_Test`, `DigitalHubContent_Studio`) need the `DENY` line run
  once with the elevated account. Until then `AuditLogPermissionTests` fails there.

## Database: the public forms login

The public forms API (`src/DigitalHub.PublicApi`, ADR 0001) connects with its own SQL
login, `dh_public_forms`. Its grants come from the migration
`AddPublicFormsRole`, which creates the role `dh_public_forms_role` with exactly:
INSERT on `contact_requests`; SELECT, INSERT, UPDATE on `application_counts`; SELECT on
`vacancies` and `site_settings`. The login and its membership are not in a migration,
because the password is a secret. After the migration, the elevated account runs:

```sql
-- master, once per server; the password comes from the server's secret store
CREATE LOGIN [dh_public_forms] WITH PASSWORD = N'<from the secret store>', CHECK_POLICY = ON;
-- each catalog the public forms API uses
CREATE USER [dh_public_forms] FOR LOGIN [dh_public_forms];
ALTER ROLE [dh_public_forms_role] ADD MEMBER [dh_public_forms];
```

- **Never** add this login to `db_datareader`, `db_datawriter` or any other role. Its
  only role is `dh_public_forms_role`.
- **What `PublicFormsPermissionTests` checks**, as the login the public API runs on.
  It proves these checks, and only these:
  - **Object grants.** The object-level permissions on every user object, in any schema,
    are exactly the six above. Objects that have a parent object, such as constraints and
    triggers, are not measured.
  - **Schema and database permissions.** The permissions on schema `dbo` and on the
    database are the same as those of a fresh user created without a login.
  - **Roles.** The login is not `sysadmin`. It is not in `db_owner`, `db_datareader`,
    `db_datawriter`, `db_ddladmin`, `db_securityadmin` or `db_accessadmin`. Its only
    database role is `dh_public_forms_role`.
  - **Every other table operation is refused.** SELECT, INSERT, UPDATE and DELETE on
    every `dbo` table, outside the six granted pairs, fail with error 229.
  - **Schema changes probed.** CREATE TABLE is refused with error 262. ALTER TABLE is
    refused on one table, `vacancies`, and TRUNCATE on one table, `contact_requests`.
- **What it does not check.** The test proves only the checks above. An administrator must
  not make any grant beyond the six, because many mistaken grants would leave the test
  green. These are examples, not a complete list:
  - IMPERSONATE grants on a user or a login;
  - ALTER, CONTROL or TAKE OWNERSHIP on a user or a role. CONTROL on a user reaches as
    far as impersonating it, for example CONTROL on `dh_content_app`;
  - grants on securables that are not objects: types, XML schema collections,
    assemblies, certificates and keys;
  - server roles other than `sysadmin`;
  - server-level permissions;
  - permissions on schemas other than `dbo`;
  - column-level grants. The object check ignores them, and it is not verified whether
    the table-wide probes catch a column-only grant.

  Follow-up F-ISO3-2 widens the test. Its exact assertion of the login's permissions would
  replace these examples.
- CI (`.github/workflows/ci.yml`, job `api`) runs the same statements, with two
  differences: a workflow-only password, and `CHECK_POLICY = OFF` on `CREATE LOGIN`,
  for its throwaway container. Locally the test login lives in `DigitalHubContent_Test`
  only, and its connection string is the user-secret `ConnectionStrings:PublicForms`.
- **Re-applying the migration after its `Down`:** `Down` removes the role's members and
  drops the role; the user `dh_public_forms` stays, with no permissions, which is
  harmless. A later `Up` creates the role with no member, so every form fails on that
  catalog until the elevated account runs the `ALTER ROLE ... ADD MEMBER` line again.
- The admin API's copies of the two form routes still run on `dh_content_app` until
  ISO-4 removes them.

## Sessions and passwords

Configuration (`appsettings.json`, override per environment):

| Setting | Default | Meaning |
|---|---|---|
| `Auth:AccessTokenMinutes` | 10 | Lifetime of an access token. |
| `Auth:RefreshTokenDays` | 14 | A session unused this long ends. Each refresh starts it again (the sliding idle window). |
| `Auth:SessionMaxDays` | 30 | A session ends this many days after its sign-in, however often it was refreshed. The user signs in again. |
| `Auth:ChangePasswordFailurePermitLimit` | 5 | Wrong current passwords per user per hour on change-password. |

- A password is refused if it is common: on the list in
  `api/src/DigitalHub.Api/Identity/common-passwords.txt` (10,001 entries, embedded
  in the API; source and licence in `common-passwords.LICENSE.txt`), a variant of
  one (case, trailing digits and symbols, leetspeak), or if it contains the
  user's email name or "digitalhub". This also applies to
  `Auth:InitialAdminPassword`: the API will not create the first admin with a
  common password. The length and character rules are unchanged.

Two behaviours are known and kept as they are:

- **A removed role keeps working for up to 10 minutes.** There is no endpoint
  that changes a user's role; if someone removes a role in the database, the
  user's current access token still carries it until it expires
  (`Auth:AccessTokenMinutes`). The next refresh reads the roles again and the
  new token no longer has it. Every request already checks that the user is
  active, the security stamp and the session (`SessionCheck`); to cut a user
  off at once, deactivate them or reset their password, which both end every
  session.
- **The change-password limit is per user, not per address.** After five wrong
  current passwords in an hour, change-password answers 429 for that user for
  the rest of the hour. Someone who already holds the user's access token can
  use that to stop the real user changing their password for up to an hour.
  An admin reset still works, and it ends that stolen session.

## API: response headers

- **No `Server` header from the API.** Kestrel's own `Server: Kestrel` banner
  is turned off in `Program.cs` (`AddServerHeader = false`, GAP-12, finding 9).
  This also covers the 400s Kestrel writes itself for malformed requests.
  `ServerHeaderTests` runs the API on real Kestrel and checks it.
- **The dev team, Phase D:** under IIS, IIS adds its own
  `Server: Microsoft-IIS/10.0` whatever Kestrel does. Remove it for the API
  site, for example with `<requestFiltering removeServerHeader="true" />` in the
  API's `web.config`, and confirm with the Phase D black-box probes that no API
  response carries a `Server` header.

## Studio: headers and routing

The Studio is a static build served by IIS on its own subdomain, with the API on
the same origin (`docs/phase-b-studio.md`, Hosting). `studio/public/web.config`
is copied into `studio/dist/` by the build and must be deployed with it. It sets,
on every Studio response:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; child-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |

- `style-src 'unsafe-inline'` is for Ant Design, which writes its styles at run
  time. Scripts stay `'self'` only.
- The draft preview is a `srcdoc` iframe sandboxed without scripts. It inherits
  this policy, so it loads only the website's stylesheets (Google Fonts, jsDelivr
  for the Tabler icon font, and the design files on the Studio's own origin). Its
  links point at the website because the preview writes absolute URLs, not
  because of `<base href>`, which `base-uri 'none'` refuses.
- Routing: client routes, including `/media` (the media library screen), load
  `index.html`; `/api/...` and uploaded files under `/media/...` are left to the
  API application. The rules are in a `<location inheritInChildApplications="false">`
  so they do not reach the API.
- Caching: `/assets/` and `/website-design/` are content-hashed and cached for a
  year (`immutable`); `index.html` is revalidated on every load.
- **The dev team:** if the Studio is served by something other than IIS (for
  example CloudFront in front of S3), set the same headers and the same routing
  there. HSTS is set where TLS ends, as for the API.

## Careers applications

An application is an email to the careers mailbox. The database keeps a count
(`application_counts`: vacancy, UTC date, count) and nothing about the person
or the CV. Deleting a vacancy removes its counts. Ending one does not. There is no candidate table.

Production SMTP is required or the form tells the person to email the careers
address directly and does not count the attempt. Set these outside the repo
(environment or user-secrets), never in a committed file:

- `Email__Host`, `Email__Port` (587), `Email__From`, `Email__User`, `Email__Password`
- An empty host is a local run. The API logs `email not sent (local)` and does
  not log the message.

The migration `20261020113912_AddApplicationCounts` creates that table and deletes the unused
`marketing` and `interviewer` roles, including any user assignments to them.
Those users are left with no role and cannot sign in to the Studio until an
admin assigns `admin`, `editor`, or `hr`. The application does not migrate at
startup. On the production catalog the elevated account applies this migration
before the new API starts. Do not run it against a catalog from a test.

The audit-log DENY above still applies. Applications do not write an audit row,
because an audit row would have to name the person.

`hr` can sign in, change their own password, read application counts, and end a
published vacancy. `admin` creates HR users the same way as any other user.
Counts are not visible to `admin` or `editor`.

The public form posts to `/api/v1/public/apply` on the website's origin. Phase D
must route `/api/v1/public/*` to this API the same way the Studio routes
`/api/...`. The proxy in front of the API must allow a request body of 5 MB plus
64 KB; a smaller limit refuses a valid CV before the API reads it.

`ForwardedHeaders:KnownProxies` must list the proxy that terminates the
connection. If it is empty, every candidate behind IIS is seen as one address
and they share a single IP bucket of 10 applications an hour.

`Email:TimeoutSeconds` defaults to 15 and is clamped between 1 and 120. A mail
server that accepts the connection and never answers returns the friendly page
within that time instead of holding the request.

A CV is checked for a PDF or Word signature and a size limit only. Macro-enabled
Word files and nested archives are accepted by design. HR's mail scanner must
treat the attachment as untrusted.
