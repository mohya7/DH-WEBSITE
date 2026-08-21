# Digital Hub Content Studio

Digital Hub Content Studio is a lightweight CMS built directly into this project. It requires no database or third-party packages. The server maintains the complete admin content store and generates a public version containing published items only.

## Run locally

```powershell
npm start
```

- Website: `http://127.0.0.1:8765/`
- Admin panel: `http://127.0.0.1:8765/admin/`

`ADMIN_PASSWORD` **must** be set in the environment before starting the server. The process exits on startup if it is missing. Optionally set `ADMIN_USER` (defaults to `admin` for the initial account only when `dbo.admin_users` is empty on first start).

Hiring, onboarding, and admin accounts require a SQL Server connection. Set all four of these before start (process exits if any are missing):

| Variable | Purpose |
|----------|---------|
| `SQLSERVER_HOST` | SQL Server host (e.g. `localhost`) |
| `SQLSERVER_DATABASE` | Database name (e.g. `DigitalHubHiring`) |
| `SQLSERVER_USER` | SQL login (e.g. `dh_hiring_app`) |
| `SQLSERVER_PASSWORD` | SQL login password — never commit it |

The driver connects with `encrypt: true` and `trustServerCertificate: true` (required for typical local SQL Server 2025 setups).

Locally, put them in a gitignored `.env` at the project root (loaded automatically via `dotenv`). On a Windows service host you can instead set the same variables in the service configuration so secrets are not a file on disk. Shell `$env:…` still works and overrides `.env`.

```powershell
# Option A — .env (gitignored), then:
npm start

# Option B — shell for this session:
$env:ADMIN_USER='content-admin'   # optional; used only when creating the first admin account
$env:ADMIN_PASSWORD='...'         # required — long unique value; never commit it
$env:SQLSERVER_HOST='localhost'
$env:SQLSERVER_DATABASE='DigitalHubHiring'
$env:SQLSERVER_USER='dh_hiring_app'
$env:SQLSERVER_PASSWORD='...'     # required — never commit it
npm start
```

Set these values before the first start that creates the administrator. The initial administrator is then stored in SQL Server table `dbo.admin_users` (database `DigitalHubHiring`) with a Scrypt password hash.

## Roles and accounts

- **Administrator:** full access to all collections, page copy, backups, and User Management.
- **HR:** access to job cards, Careers page copy, and the private job-application inbox.

Administrators can create, edit, disable, reset passwords for, and delete HR accounts from **User Management**. Disabling or deleting an account revokes its active sessions immediately. Password resets also revoke existing sessions.

Role restrictions are enforced by the API. Hiding navigation items is only a user-interface convenience; unauthorized requests still return `403 Forbidden`.

## Content model

| Collection | Where it appears |
|---|---|
| Services | Homepage |
| Case Studies | Homepage and Case Studies hub |
| Blogs | Homepage and Blog hub |
| Partners | Homepage and Partners hub |
| Jobs | Careers page |
| Team | About Us page |

Hero copy and key section headings for the six main pages are managed from **Page Content**.

When a service, case study, blog post, partner, or job is created, its details link is generated automatically from its title. Existing links stay unchanged when an item is edited, and duplicate titles receive a numeric suffix.

## Files

- `content/admin-content.json`: complete admin source containing published items and drafts.
- SQL Server database (`SQLSERVER_DATABASE`, typically `DigitalHubHiring`): admin user accounts (`dbo.admin_users`), applications, CV binaries (`dbo.application_resumes`), hiring pipelines/interviews, and employee onboarding requests. Connected at startup via `mssql` using the `SQLSERVER_*` environment variables.
- `content/admin-users.json`: **legacy** local account file (gitignored). Kept on disk as a fallback copy; the server no longer reads or writes it.
- `content/contact-requests.json`: private Get in Touch enquiry records. This file is ignored by Git and blocked from public web access.
- `content/application-files/`: **legacy** directory (gitignored, still blocked from static serving). CVs are no longer written here; bytes live in `dbo.application_resumes`.
- `content/site-content.json`: generated public JSON data.
- `content/site-content.js`: synchronous public data used before card animations initialize.
- `assets/uploads/`: images uploaded through Content Studio.

Studio content (`admin-content.json` / `site-content.*`) and contact requests remain JSON. Admin accounts, applications, CVs, pipelines, onboarding, and the interviewer directory (`dbo.interviewers`, including optional job **title**) live in SQL Server. Task **Reviewed by** / **Score** are stored only as `dbo.applications.task_reviewed_by`, `task_reviewed_by_user_id`, and `task_score` (not inside the pipeline JSON).

**Backup:** back up the hiring SQL Server database (includes CV bytes in `dbo.application_resumes`). The legacy `content/application-files/` folder is unused for new applications.

Do not edit the two public content files manually. They are regenerated after every successful save.

## Security

- Eight-hour `HttpOnly`, `SameSite=Strict` sessions.
- CSRF protection for every write operation.
- Revision checks prevent overwriting newer content.
- Rate limiting for login attempts (per IP and username, same window pattern as public forms).
- Rate limiting and a honeypot field for public job applications and Get in Touch requests.
- PDF and Word CV uploads only, up to 5MB.
- PNG, JPG, WEBP, and GIF uploads only, up to 5MB.
- Audit history for the latest 50 content actions.

## Deployment

Editing content and receiving applications or Get in Touch requests require Node.js and the server in `server.js`. A static-only deployment can display published content, but it cannot receive forms or provide the private admin inboxes.
