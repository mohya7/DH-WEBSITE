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
