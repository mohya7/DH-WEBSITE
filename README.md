# Digital Hub — Deployment Handover

Deployment guide for the Digital Hub website and admin platform.

**Target:** Windows Server
**Prepared:** August 2026
**Audience:** internal developer deploying this application

**Repository:** `https://github.com/mohya7/DH-WEBSITE.git`
**Branch:** `feature/platform-hardening-and-sql-migration`

> [!IMPORTANT]
> Deploy from the `feature/platform-hardening-and-sql-migration` branch. It has **not** been merged to `main` — `main` still contains the pre-migration code, which uses JSON file storage and contains the security defects this work fixes. **Deploying `main` would undo all of it.**

---

## Table of contents

1. [What you are deploying](#1-what-you-are-deploying)
2. [Prerequisites on the server](#2-prerequisites-on-the-server)
3. [SQL Server setup](#3-sql-server-setup)
4. [Environment variables](#4-environment-variables)
   - [4a. Email (Amazon SES)](#4a-email-amazon-ses)
5. [Installing](#5-installing)
6. [HTTPS, HOST, and the session cookie](#6-https-host-and-the-session-cookie)
7. [Running the process](#7-running-the-process)
8. [Post-deployment verification](#8-post-deployment-verification)
9. [Backups](#9-backups)
10. [What not to do](#10-what-not-to-do)
11. [Known follow-ups](#11-known-follow-ups)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What you are deploying

A single Node.js process serving four things:

| Surface | What it is |
| --- | --- |
| Public website | `digitalhub.com.eg` — static HTML plus generated content |
| Content Studio | Admin panel for site content, blog, service pages |
| HR portal | Job applications, hiring pipeline, interviews |
| Marketing portal | Onboarding requests |

The HR and marketing portals are **not** separate applications. They are role-gated views inside the same admin panel, served by the same process.

### Where data lives

| Data | Store |
| --- | --- |
| Job applications, hiring pipelines, interviews | SQL Server — database `DigitalHubHiring` |
| Onboarding requests | SQL Server — same database |
| Admin user accounts | SQL Server — same database, table `dbo.admin_users` |
| Interviewer directory | SQL Server — same database, table `dbo.interviewers` |
| Candidate CV files | SQL Server — same database, table `dbo.application_resumes` |
| Site content, blog, service pages, vacancies | JSON — `content/admin-content.json` |
| Contact form submissions | JSON — `content/contact-requests.json` |

CV files are stored as **binary in the database, not on disk**. Uploads are capped at 5 MB and limited to `.pdf`, `.doc`, and `.docx`.

### Interviewers come from two places

The **Interviewers** tab in the HR portal shows a merged list:

- **HR account holders** appear automatically and are read-only there. Their name, email, and title come from `admin_users` — the title is the account's job title, which is also what candidates see in interview emails. They are changed in user settings, not in the Interviewers tab.
- **Manually added interviewers** live in `dbo.interviewers` and are fully editable. These are people who conduct interviews but have no login account.

Deactivating an HR account removes them from the assignment picker but leaves them visible in the Interviewers tab marked as disabled. Interview rounds store their own snapshot of the interviewer's name, title, and email, so an already-scheduled interview is unaffected by later account changes.

> [!NOTE]
> `content/admin-users.json` still exists on disk but is **no longer read**. It is retained as a fallback record of the accounts that existed before the migration. Do not edit it — changes there have no effect. The same applies to `content/application-files/`, which is now empty and unused.

### Consequence: login depends on the database

Admin accounts live in SQL Server, so **if the database is unreachable, nobody can log in** — including to the Content Studio, which otherwise does not need it. The login route returns a clear `503` (`AUTH_STORE_UNAVAILABLE`) in that case rather than a misleading "incorrect password". If the database is down at startup, the process exits rather than starting in a broken state.

---

## 2. Prerequisites on the server

- **Node.js 22 or later.** Enforced by `engines` in `package.json`.
- **SQL Server**, reachable from the web server.
- **HTTPS**, terminated either by Node or by a proxy in front of it (see [section 6](#6-https-host-and-the-session-cookie)).

---

## 3. SQL Server setup

The application needs a database and a login. Run this on the company instance, **changing the password**:

```sql
CREATE DATABASE DigitalHubHiring;
GO
CREATE LOGIN dh_hiring_app WITH PASSWORD = 'CHOOSE-A-STRONG-PASSWORD',
CHECK_POLICY = ON;
GO
USE DigitalHubHiring;
CREATE USER dh_hiring_app FOR LOGIN dh_hiring_app;
ALTER ROLE db_owner ADD MEMBER dh_hiring_app;
GO
```

The application creates its own tables on first startup. **Do not create them manually.**

### TCP/IP must be enabled

> [!WARNING]
> This is the most likely thing to block you. SQL Server ships with TCP/IP **disabled**. SSMS connects over shared memory, so SSMS working does **not** mean the application will connect. The Node driver requires TCP.

1. Open **SQL Server Configuration Manager** (`SQLServerManager17.msc` via <kbd>Win</kbd>+<kbd>R</kbd> — adjust the number to match the installed version)
2. **SQL Server Network Configuration → Protocols for MSSQLSERVER**
3. Right-click **TCP/IP → Enable**
4. **SQL Server Services →** right-click the instance → **Restart**
5. Verify: `Test-NetConnection <sqlhost> -Port 1433` should return `TcpTestSucceeded : True`

### Authentication mode

The login above is a SQL login, which requires **Mixed Mode** authentication. If the instance is Windows-only, either switch it to Mixed Mode or ask for a Windows service account instead — the latter needs a code change, so raise it before deploying.

---

## 4. Environment variables

All five are required. The server exits on startup if `ADMIN_PASSWORD` or any `SQLSERVER_*` variable is missing. That is deliberate — it prevents the app starting with a weak default.

| Variable | Value | Notes |
| --- | --- | --- |
| `SQLSERVER_HOST` | SQL Server hostname or IP | |
| `SQLSERVER_DATABASE` | `DigitalHubHiring` | |
| `SQLSERVER_USER` | `dh_hiring_app` | |
| `SQLSERVER_PASSWORD` | the password you set | |
| `ADMIN_PASSWORD` | initial admin password | Only used to create the first account if none exists |
| `COOKIE_SECURE` | `true` | Required in production. See [section 6](#6-https-host-and-the-session-cookie) |
| `HOST` | see [section 6](#6-https-host-and-the-session-cookie) | Defaults to `127.0.0.1` |
| `PORT` | defaults to `8765` | |

Email is configured separately — see [section 4a](#4a-email-amazon-ses). Without it, the application runs normally but interview notifications and reminders do not send.

### Where to set them

- In **development**, a `.env` file at the project root is loaded automatically via `dotenv`.
- In **production**, prefer real environment variables set in the service configuration rather than a `.env` file. Environment variables already set always win over `.env`, so both can coexist safely. A secret in the service config is better protected than one in a file on disk.

> [!CAUTION]
> **Never commit `.env`.** It is gitignored — verify with `git check-ignore .env` before your first commit.

### 4a. Email (Amazon SES)

Email is **optional**. Without it the application runs normally — but interview schedule notifications and the daily interview reminders will not send. No code changes are needed; the SES SMTP integration is already built into `lib/mail.js`.

**Variables**

| Variable | Value | Notes |
| --- | --- | --- |
| `MAIL_ENABLED` | `true` | Master switch. Email stays off without this |
| `AWS_REGION` | e.g. `eu-west-1` | Determines the default SMTP host |
| `SES_SMTP_USER` | SES SMTP username | Not an IAM console username — see below |
| `SES_SMTP_PASS` | SES SMTP password | Not an IAM console password |
| `SES_FROM` | `Digital Hub HR <hr@verified-domain.com>` | Address must be verified in SES |
| `HR_NOTIFY_EMAILS` | `hr@digitalhub.com.eg` | Where HR notifications go |
| `PUBLIC_BASE_URL` | the public admin URL | Used to build links inside emails |

**Optional overrides**

| Variable | Default |
| --- | --- |
| `SES_SMTP_HOST` | `email-smtp.{AWS_REGION}.amazonaws.com` |
| `SES_SMTP_PORT` | `587` |
| `MAIL_TZ` | `Africa/Cairo` |

**AWS prerequisites**

1. Verify the sending identity in SES — the domain or address used in `SES_FROM`.
2. Create **SMTP credentials** in the SES console. These are generated specifically for SMTP and are **different** from IAM console credentials. Using IAM credentials here will fail authentication.
3. Move out of the **SES sandbox**, or verify each recipient address individually. New SES accounts start sandboxed and can only send to verified addresses — this catches people out.

**Confirming it works**

On startup the log should read:

```
[mail] Amazon SES enabled · day reminders at 10:00 Africa/Cairo
```

If email is not configured, the log instead names the missing variables. That is expected, not an error.

**What email is used for**

- Interview schedule notifications when a round is scheduled or changed
- A daily reminder at 10:00 (`MAIL_TZ`) to interviewers with an interview that day

The reminder job runs on a one-minute interval and only acts during the 10:00 window. It has a 20-second SMTP timeout, so a hung mail server cannot block it indefinitely.

---

## 5. Installing

> [!WARNING]
> **Do not copy `node_modules` from another machine.** Two dependencies (`sharp` and `mssql`) contain compiled or platform-specific components built for one OS and one Node version. Copying them across machines produces confusing runtime failures.

```bash
# copy the project WITHOUT node_modules
npm install
```

If `npm install` fails on a native module, the server needs **Visual Studio Build Tools** with the C++ workload. `sharp` has the same requirement, so if the app has run on this machine before, the toolchain is probably already present.

---

## 6. HTTPS, HOST, and the session cookie

Decide which of these two options applies **before** deploying. They are configured differently.

### Option A — a proxy (IIS or similar) in front of Node

The proxy terminates HTTPS and forwards to Node over local HTTP.

- Leave `HOST` at its default `127.0.0.1`. Node should only accept local connections; the proxy reaches it locally.
- Set `COOKIE_SECURE=true`.
- Configure the proxy to serve the site over HTTPS only.

### Option B — Node serving directly

- Set `HOST=0.0.0.0` so the app accepts external connections. Without this the site is unreachable from outside the server.
- HTTPS must be terminated somewhere. Node does **not** do it in this application as written — raise this before deploying if there is no proxy.
- Set `COOKIE_SECURE=true`.

### Why `COOKIE_SECURE` matters

The admin session cookie is what proves a user is logged in. Without the `Secure` flag it can travel over unencrypted HTTP and be intercepted. `COOKIE_SECURE=true` is the only authority for this — the application deliberately ignores the `X-Forwarded-Proto` header, because clients can forge it.

> [!NOTE]
> If you set `COOKIE_SECURE=true` but the site is served over plain HTTP, login will not work — browsers refuse to store `Secure` cookies on insecure connections. This is the expected symptom of a missing HTTPS setup, **not a bug**.

---

## 7. Running the process

Node needs something to keep it running and restart it on failure. Two common approaches on Windows:

- **Windows Service wrapper** (`nssm`, `node-windows`) — register `node server.js` as a service. Environment variables go in the service configuration.
- **IIS with `iisnode`** — IIS manages the process and can terminate HTTPS. Environment variables go in `web.config`.

> [!IMPORTANT]
> **Run a single process.** This application keeps sessions and rate-limit counters in memory. If more than one Node process runs:
> - Users are logged out at random as requests hit different processes.
> - Login rate limiting is multiplied by the process count, weakening brute-force protection.
>
> SQL Server itself handles multiple processes fine — the constraint is the in-memory session store. If you need multiple instances, raise it first; it requires a shared session store.

---

## 8. Post-deployment verification

> [!CAUTION]
> **Do not skip this.** A previous demo of this application leaked candidate data because a path-handling bug allowed private files to be read without logging in. That bug is fixed and tested locally, but verifying on the live deployment is what proves the deployed code is the fixed code.

### 8.1 Private files must not be reachable

Open each URL below in a browser **while logged out**. Every one must return `404` or an error page. **If any returns file contents, take the site offline immediately and escalate.**

```
/content/admin-users.json
/content/./admin-users.json
/content//admin-users.json
/content/../content/admin-users.json
/content/%2e%2e/content/admin-users.json
/content/%2e/admin-users.json
/content/.//./admin-users.json
/CONTENT/admin-users.json
/content/contact-requests.json
/content/./contact-requests.json
/content/admin-content.json
/content/./admin-content.json
/content/application-files/anything.pdf
/content/./application-files/anything.pdf
/content
/content/
```

### 8.2 Public files must still work

These must load normally:

```
/
/content/site-content.json
/content/site-content.js
/assets/digital-hub-logo.png
```

> [!NOTE]
> Case variations of public filenames (e.g. `/content/Site-Content.json`) behave differently on Windows than on Linux. On Windows they resolve; on Linux they are denied. Both fail safely. Do not treat a denial as a bug.

### 8.3 Confirm the deployed code is current

- Confirm the deployment is from branch `feature/platform-hardening-and-sql-migration`, **not** `main`. Run `git branch --show-current` on the server, or check the commit hash against the branch.
- Check that `lib/hiring-db.js` exists on the server and that `package.json` lists `mssql` and does **not** list `better-sqlite3`. If `better-sqlite3` appears, an old version was deployed.
- Confirm six tables exist in `DigitalHubHiring`: `applications`, `application_resumes`, `onboarding_requests`, `admin_users`, `interviewers`, and `deletion_log`.

### 8.4 First-run admin account

On a fresh database with an empty `admin_users` table, the application creates one admin account at startup using `ADMIN_USER` and `ADMIN_PASSWORD`.

If you are migrating existing accounts rather than starting fresh, they must be inserted into `dbo.admin_users` before anyone can log in — the automatic import from the legacy JSON file has been removed. Raise this before deploying if accounts need carrying over.

> [!IMPORTANT]
> Change the bootstrap password immediately after first login.

### 8.5 Functional check

1. Server starts with no errors.
2. Submit a test application through the public careers form, with a real PDF attached.
3. Log in as an HR user — the application appears, the pipeline renders, a pipeline save persists after reload.
4. Download the CV — it opens correctly and matches what was uploaded.
5. Restart the service — the data survives and the CV still downloads.
6. Delete the test application via the HR delete button — the row, the CV, and any onboarding record all go.
7. Confirm interviewer assignment works — staff names and emails resolve on an interview round (this reads from `admin_users`).

> [!WARNING]
> If step 3 shows candidates as "un-enrolled" with an empty pipeline, **stop and escalate** — that indicates a data serialization problem, not empty data.

---

## 9. Backups

The SQL Server database is the complete record of all candidate and account data, including CV files. **There is no separate file directory to keep in sync.**

| What | Where |
| --- | --- |
| Applications, pipelines, onboarding, CVs, admin accounts | SQL Server database `DigitalHubHiring` |
| Site content, blog, vacancies, contact submissions | `content/*.json` |

Back up **both**. They are independent — a database restore does not affect site content, and vice versa.

- The database will grow. CVs are stored as binary, so every application adds roughly the size of its attachment (up to 5 MB) permanently. Budget backup storage accordingly and review growth periodically.
- A database restore also restores admin accounts and their passwords. **If passwords have been rotated since the backup, restoring reverts them.**
- The application's own content export/import (in the Content Studio) covers site content only — not hiring data. Hiring data is backed up through SQL Server.
- Exclude the SQL Server data directory from real-time antivirus scanning. AV file locks on Windows can interfere with database writes.

---

## 10. What not to do

- Do not copy `node_modules` between machines. Install fresh on the server.
- Do not run multiple Node processes without first addressing the in-memory session store.
- Do not put the site online before running [section 8.1](#81-private-files-must-not-be-reachable). That check is the whole point.
- Do not commit `.env` or put credentials in any tracked file.
- Do not reuse the old default admin password. It was documented publicly in an earlier version of `ADMIN.md` and is considered compromised.

---

## 11. Known follow-ups

Not blocking deployment, but on the list:

- **Vestigial columns.** `applications.resume_file` and `applications.resume_pending` are always empty and zero respectively, kept only because `admin/admin.js` still reads `resumePending`. They can be removed together with that client code in a later pass.
- **Optimistic concurrency on hiring writes.** If two HR users edit the same candidate's pipeline simultaneously, the second save overwrites the first without warning. Not an issue with a single HR user. Needs coordinated client and server changes if it becomes one.
- **CV downloads load fully into memory.** The SQL Server driver returns the whole binary column as one buffer, so each download holds up to 5 MB. Fine at current scale; revisit if many people download simultaneously.
- **Admin password rotation.** Every admin account that existed during the earlier demo should have its password changed. Password hashes were exposed and can be attacked offline.

---

## 12. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Server exits immediately at startup | A required environment variable is missing. The log names it. |
| `Failed to connect to <host>:1433` | TCP/IP disabled on SQL Server, firewall, or wrong credentials. See [section 3](#3-sql-server-setup). |
| Login fails silently, no error | `COOKIE_SECURE=true` but the site is served over HTTP. See [section 6](#6-https-host-and-the-session-cookie). |
| "Sign-in is temporarily unavailable" | The database is unreachable. Accounts live in SQL Server. See [section 3](#3-sql-server-setup). |
| Nobody can log in on a fresh install | `admin_users` is empty and `ADMIN_PASSWORD` was not set at first startup. See [section 8.4](#84-first-run-admin-account). |
| Log says mail is disabled | `MAIL_ENABLED` or an `SES_*` variable is missing. The log names which. See [section 4a](#4a-email-amazon-ses). |
| SES authentication fails | IAM console credentials used instead of SES SMTP credentials. See [section 4a](#4a-email-amazon-ses). |
| Emails send to some recipients but not others | SES account is still in sandbox mode. See [section 4a](#4a-email-amazon-ses). |
| Site unreachable from outside the server | `HOST` still `127.0.0.1` with no proxy in front. See [section 6](#6-https-host-and-the-session-cookie). |
| `npm install` fails on a native module | Missing C++ build tools. See [section 5](#5-installing). |
| HR portal shows candidates as un-enrolled | Serialization problem. Stop and escalate — do not assume data loss. |
