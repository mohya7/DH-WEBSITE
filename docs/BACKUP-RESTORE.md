# Backup and restore — DigitalHubHiring and site content

Someone other than the person who wrote this may have to run it. The database and the JSON under `content/` are **independent**. Restoring one does not restore the other. Take both in the same hour.

**Recovery window:** SIMPLE recovery, hourly full database backups, hourly copy of content files. If the server dies, expect to lose **up to about one hour** of hiring and Studio work — not a day. Point-in-time (minute-level) restore is not available under SIMPLE.

**The CMS SQL login cannot take backups.** `dh_hiring_app` is the application account in `.env` / `SQLSERVER_USER`. It can read and write hiring data. It **cannot** run `BACKUP DATABASE`, `RESTORE DATABASE`, or `CREATE DATABASE`. If you log in as `dh_hiring_app` at 2am and run the backup command, SQL Server will return a permission error. IT must provision a **separate** login (Windows service account or SQL login) with `BACKUP DATABASE` on `DigitalHubHiring` (and restore rights for the person who would recover). Point Agent jobs and Task Scheduler at **that** account, never at `dh_hiring_app`.

A restore was proven on 13 Sep 2026: full backup restored to a **separate** database `DigitalHubHiring_RestoreDrill`, every table row count matched, and a CV `varbinary` written to disk from the copy had the same SHA-256 as live (`55B8F6C1…C6D57B`, 96,345-byte PDF). That drill database was dropped. Live was not overwritten.

---

## What is backed up, where, how often

| What | Where it lives | Backup |
|---|---|---|
| Applications, pipelines, interviews, CVs, accounts, slots, booking invitations, notifications, onboarding, deletion log, stage events | SQL Server database `DigitalHubHiring` | Native **full** backup, **hourly** |
| Studio pages and collections (including vacancies) | `content/admin-content.json` | File copy, **hourly**, same timestamp as the DB backup |
| Contact form submissions | `content/contact-requests.json` (gitignored) | Same file copy |
| Public projection | `content/site-content.json`, `content/site-content.js` | Same copy (also regenerable after an admin-content restore) |
| Uploaded images | `assets/uploads/` | Copy with content if you need images, not only JSON paths |

**Not** a backup: Studio “Download backup” alone (omits contact JSON, SQL, and upload binaries). Git is not the backup.

**Where files go (do not put them in the git repo or under a web-served folder):**

- Prefer another disk or a share the SQL Server service account can write, e.g. `E:\Backups\DigitalHub\` or `\\fileserver\sql-backups\DigitalHub\`.
- On this developer box the proven path was SQL’s own backup directory (same volume as the data files — acceptable for a drill, **not** ideal in production):

  `C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\Backup\`

**Retention:** keep **7 days** of hourly `.bak` files and matching content folders. Delete older files in the same job (do not overwrite a single filename). Optionally keep one extra weekly copy for 4 weeks.

**Recovery model:** `DigitalHubHiring` must stay **SIMPLE** after the first successful full backup. FULL without log backups inflates the log (it was 72 MB against 8 MB of data). Do not switch back to FULL unless IT will actually take transaction-log backups.

One-off after SIMPLE, if the log is still huge: `DBCC SHRINKFILE` is worth doing **once** (see below). Do not schedule shrinks.

---

## Schedule — Agent or Task Scheduler

### SQL Server Agent (Standard / Developer / Enterprise)

This machine is **Standard Developer Edition**; Agent exists. Create one job, e.g. `DigitalHubHiring_HourlyFull`, run every hour. **Do not** run the job as `dh_hiring_app`. Use the dedicated backup account IT created (`BACKUP DATABASE` permission, plus write access to the backup folder).

```sql
DECLARE @path nvarchar(400) =
  N'E:\Backups\DigitalHub\DigitalHubHiring_'
  + CONVERT(char(8), GETDATE(), 112) + N'_'
  + REPLACE(CONVERT(char(5), GETDATE(), 108), N':', N'') + N'.bak';

BACKUP DATABASE [DigitalHubHiring]
  TO DISK = @path
  WITH INIT, COMPRESSION, CHECKSUM, STATS = 10;
```

Second step (CmdExec or PowerShell): copy `content\*.json` to a folder with the same timestamp; delete `.bak` and content folders older than 7 days.

### Express (no Agent) — Task Scheduler + sqlcmd

Company SQL Server may be **Express**. Agent will not be there. Use **Windows Task Scheduler**, hourly, running as the **backup** account — not `dh_hiring_app`. That Windows (or SQL) account must be allowed `BACKUP DATABASE`. `dh_hiring_app` will fail with a permission error if you substitute it.

1. `sqlcmd` (ODBC 18 needs trust-server-certificate: `-C`):

```text
"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE" -S <instance> -E -C -Q "BACKUP DATABASE [DigitalHubHiring] TO DISK = N'E:\Backups\DigitalHub\DigitalHubHiring.bak' WITH INIT, COMPRESSION, CHECKSUM;"
```

Use a **timestamped** filename in a wrapping `.ps1` (do not keep a single `DigitalHubHiring.bak`). Example:

```powershell
$stamp = Get-Date -Format "yyyyMMdd_HHmm"
$bak = "E:\Backups\DigitalHub\DigitalHubHiring_$stamp.bak"
& "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE" -S localhost -E -C -Q "BACKUP DATABASE [DigitalHubHiring] TO DISK = N'$bak' WITH INIT, COMPRESSION, CHECKSUM;"
robocopy "D:\path\to\DH-WEBSITE-main\content" "E:\Backups\DigitalHub\content_$stamp" *.json /R:2 /W:5
Get-ChildItem "E:\Backups\DigitalHub\DigitalHubHiring_*.bak" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
Get-ChildItem "E:\Backups\DigitalHub\content_*" -Directory | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Recurse
```

2. Task Scheduler: Create Task → trigger hourly → action Start a program `powershell.exe` → arguments `-NoProfile -File E:\Backups\DigitalHub\hourly-backup.ps1`.

If SQL authentication is required instead of `-E`, pass `-U` / `-P` from a protected secret store — never commit the password.

---

## Restore the database (do not overwrite live until you mean to)

Need a **sysadmin** (or backup-plus-create-database) Windows or SQL login. **`dh_hiring_app` cannot do this.** It cannot `BACKUP DATABASE`, restore, or create `DigitalHubHiring_RestoreDrill`. Use the separate backup/restore account.

### 1. Confirm the backup file

```sql
RESTORE VERIFYONLY FROM DISK = N'E:\Backups\DigitalHub\DigitalHubHiring_yyyyMMdd_HHmm.bak' WITH CHECKSUM;
RESTORE HEADERONLY FROM DISK = N'E:\Backups\DigitalHub\DigitalHubHiring_yyyyMMdd_HHmm.bak';
RESTORE FILELISTONLY FROM DISK = N'E:\Backups\DigitalHub\DigitalHubHiring_yyyyMMdd_HHmm.bak';
```

Logical names on this instance: data `DigitalHubHiring`, log `DigitalHubHiring_log`.

### 2. Restore to a **new** name first (drill / prove)

Replace paths if the instance layout differs.

```sql
RESTORE DATABASE [DigitalHubHiring_RestoreDrill]
FROM DISK = N'E:\Backups\DigitalHub\DigitalHubHiring_yyyyMMdd_HHmm.bak'
WITH
  MOVE N'DigitalHubHiring' TO N'C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\DATA\DigitalHubHiring_RestoreDrill.mdf',
  MOVE N'DigitalHubHiring_log' TO N'C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\DATA\DigitalHubHiring_RestoreDrill_log.ldf',
  RECOVERY, STATS = 10;
```

sqlcmd:

```text
SQLCMD.EXE -S <instance> -E -C -Q "RESTORE DATABASE [DigitalHubHiring_RestoreDrill] FROM DISK = N'...bak' WITH MOVE N'DigitalHubHiring' TO N'...mdf', MOVE N'DigitalHubHiring_log' TO N'...ldf', RECOVERY;"
```

### 3. Overwrite live only after the drill looks right

Stop the Node CMS so it is not writing. Then:

```sql
ALTER DATABASE [DigitalHubHiring] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [DigitalHubHiring]
FROM DISK = N'E:\Backups\DigitalHub\DigitalHubHiring_yyyyMMdd_HHmm.bak'
WITH REPLACE, RECOVERY, STATS = 10;
ALTER DATABASE [DigitalHubHiring] SET MULTI_USER;
ALTER DATABASE [DigitalHubHiring] SET RECOVERY SIMPLE;
```

`WITH REPLACE` is destructive. The MOVE clauses are only needed if file paths changed.

### Drop a drill database

```sql
ALTER DATABASE [DigitalHubHiring_RestoreDrill] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE [DigitalHubHiring_RestoreDrill];
```

---

## Restore the content files

1. Stop or idle Studio saves so nothing overwrites mid-copy.
2. Copy the timestamped backup of `admin-content.json` and `contact-requests.json` over the live `content\` files (keep a copy of the broken live files first).
3. Copy `site-content.json` / `site-content.js` from the same backup, **or** start the CMS once so `writeData` / public projection regenerates them from `admin-content.json`.
4. Copy `assets/uploads\` from the same-hour backup if images are missing.
5. Do **not** use an old Studio export that omits `jobs` against a build from before the import fix. Current import **keeps** a collection if the JSON file does not contain that key; an explicit `"jobs": []` still clears vacancies.

---

## How to verify a restore worked

Database (against the restored copy, then against live after a real cutover):

```sql
-- Row counts (every user table)
SELECT t.name, SUM(p.rows) AS row_count
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
ORDER BY t.name;
```

**CVs:** row count is not enough. Pull bytes from the restored database and hash them.

```powershell
$id = "<application_id from dbo.application_resumes>"
$cs = "Server=<instance>;Database=DigitalHubHiring_RestoreDrill;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection $cs
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT content FROM dbo.application_resumes WHERE application_id = @id"
[void]$cmd.Parameters.AddWithValue("@id", $id)
$bytes = $cmd.ExecuteScalar()
$conn.Close()
[IO.File]::WriteAllBytes("$env:TEMP\restored-cv.bin", $bytes)
Get-FileHash "$env:TEMP\restored-cv.bin" -Algorithm SHA256
```

Compare to the same `application_id` on a known-good copy (or to a hash recorded at backup time). PDF files should start with `%PDF-`.

Content: open the homepage and Careers; confirm cards and vacancies. Open Studio as admin and confirm collections including jobs.

---

## If the backup is missing or corrupt

1. `RESTORE VERIFYONLY … WITH CHECKSUM`. If that fails, the file is not usable.
2. Try the **previous hour’s** `.bak` (that is why retention is 7 days of distinct files).
3. If every file fails, restore the newest content JSON you have and accept that SQL data since the last good `.bak` is gone. Do not invent rows.
4. If there is no file at all: hiring data is gone. Recreate the empty schema with the app’s `ensureHiringSchema`, restore `content\` from git **plus** the last `contact-requests.json` if any copy exists. Standing test accounts are not a production restore.

---

## One-off log shrink (after SIMPLE)

SIMPLE stops the log growing without bound; it does **not** shrink the file. A one-off shrink **is worth it** on this database (8 MB data, 72 MB log left over from FULL with no log backups). It is a few megabytes on a quiet instance.

Do **not** shrink on a schedule. Recurring shrinks fragment VLFs and just grow again. Do **not** shrink during a long hiring import. Leave a little headroom (about **16 MB**), not 1 MB.

```sql
USE [DigitalHubHiring];
DBCC SHRINKFILE (N'DigitalHubHiring_log', 16);
```

---

## Who owns what

| | Company IT (SQL host) | Application / website server |
|---|---|---|
| Instance, disks, service account, Agent or Task Scheduler on the **SQL** box | **IT** | — |
| `BACKUP DATABASE` job, `.bak` location, off-box copy, 7-day deletion | **IT** — **separate backup account**; not `dh_hiring_app` | — |
| Edition (Express vs Agent) | **IT** — if Express, they own the Task Scheduler + sqlcmd job on a box that can reach SQL, still **not** as `dh_hiring_app` | — |
| Database name; app login `dh_hiring_app` | IT creates `dh_hiring_app` for **CRUD only** (no `BACKUP DATABASE`) | Node `server.js` uses that login for hiring data only |
| `content\*.json` and `assets\uploads` | Copy off-box if IT already backs file servers | **App server** holds the live files; include them in the hourly copy (from the app host, or from a share IT backs up) |
| Restore decision, `WITH REPLACE` on live, CMS restart | **IT** + whoever owns the site, together | Stop/start `node server.js` |
| This document | Keep next to the handover | Repo `docs/BACKUP-RESTORE.md` |
