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
