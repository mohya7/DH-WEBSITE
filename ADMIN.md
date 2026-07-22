# Digital Hub Content Studio

Digital Hub Content Studio is a lightweight CMS built directly into this project. It requires no database or third-party packages. The server maintains the complete admin content store and generates a public version containing published items only.

## Run locally

```powershell
npm start
```

- Website: `http://127.0.0.1:8765/`
- Admin panel: `http://127.0.0.1:8765/admin/`
- Development login: `admin` / `DigitalHub@2026`

Before production, run the server with private credentials:

```powershell
$env:ADMIN_USER='content-admin'
$env:ADMIN_PASSWORD='use-a-long-unique-password'
npm start
```

Set these values before the first production start. The initial administrator is then stored in `content/admin-users.json` with a Scrypt password hash.

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
- `content/admin-users.json`: local account store containing Scrypt password hashes. This file is ignored by Git.
- `content/job-applications.json`: private applicant records. This file is ignored by Git and blocked from public web access.
- `content/application-files/`: private CV files. This folder is ignored by Git and CVs can only be downloaded by a signed-in admin or HR user.
- `content/site-content.json`: generated public JSON data.
- `content/site-content.js`: synchronous public data used before card animations initialize.
- `assets/uploads/`: images uploaded through Content Studio.

Do not edit the two public content files manually. They are regenerated after every successful save.

## Security

- Eight-hour `HttpOnly`, `SameSite=Strict` sessions.
- CSRF protection for every write operation.
- Revision checks prevent overwriting newer content.
- Rate limiting for login attempts.
- Rate limiting and a honeypot field for public job applications.
- PDF and Word CV uploads only, up to 5MB.
- PNG, JPG, WEBP, and GIF uploads only, up to 5MB.
- Audit history for the latest 50 content actions.

## Deployment

Editing content and receiving applications require Node.js and the server in `server.js`. A static-only deployment can display published content, but it cannot receive application forms or provide the private HR inbox.
