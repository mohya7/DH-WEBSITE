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
