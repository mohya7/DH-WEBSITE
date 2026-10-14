# Moving the content with a bundle file

The website's content (pages, services, partners, case studies, blog posts,
vacancies, team members, news, their sections, the images, navigation,
redirects, and the site settings such as the careers email) is entered in the
Content Studio. It moves from one database to another as **one file**, a
*content bundle*, not by retyping it.

A bundle never contains user accounts, roles, passwords, sign-in tokens, the
audit log, or contact-form requests.

## What you need

- **This repository**, checked out on the same commit as the API you deploy.
  The tool reads the content schemas from `packages/` in the checkout, and it
  only accepts a bundle made at the same database migration as its code.
- **The .NET 10 SDK.**
- **The empty content database**, created and migrated (below).
- **Two settings**, as environment variables or dotnet user-secrets. They are
  never passed on the command line, and the tool never prints them:

| Setting | Environment variable | What it is |
|---|---|---|
| `ConnectionStrings:Content` | `ConnectionStrings__Content` | The database, signed in as the **application's SQL login** (read and write rows only). Windows sign-in is refused. |
| `Media:Root` | `Media__Root` | The folder the API serves `/media/` from. Use the **same folder** as the API's own `Media:Root` setting. |

## Making a bundle (the content owner does this)

On the machine with the Studio's database:

```powershell
dotnet run --project api/tools/DigitalHub.ContentImport -c Release -- export --out digitalhub-content-2026-10-14.zip
```

- **Reads only.** Export never changes the database.
- **What it prints:** the migration the database is at, and the number of rows
  per table and of media files.
- **Refusals:**
  - it refuses if the database is not at the migration the code expects;
  - it refuses if any image file a media row points at is missing from `Media:Root`;
  - it never overwrites an existing file.

The file is a zip:
- **`content.json`:** the format and its version, the export time, the
  migration, the row count and a SHA-256 checksum for every table, the list of
  media files with their sizes and checksums, and the rows.
- **`media/`:** the image files, named by their content hash.

## Loading a bundle into a new database (the dev team does this)

Do these steps in order, on staging first, then on production.

1. **Take a backup** of the target database, even if it is new. It is your way back.

2. **Migrate the database** to the bundle's migration. Use an account that may
   change the schema; the application's login may not.

   ```powershell
   dotnet tool restore --tool-manifest api/dotnet-tools.json
   dotnet tool run dotnet-ef -- database update --project api/src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --connection "<connection for the schema owner>"
   ```

3. **Grant the application's SQL login** read and write on that database
   (`db_datareader` and `db_datawriter`), and nothing else.

4. **Set the two settings** above for the tool, then rehearse:

   ```powershell
   dotnet run --project api/tools/DigitalHub.ContentImport -c Release -- import --in digitalhub-content-2026-10-14.zip --dry-run
   ```

   - **What it shows:** a table of what it would create, update, or leave unchanged per table, and
     how many media files are new.
   - **Checks:** every document goes through the same checks the Studio applies
     when an editor saves.
   - **No changes:** a dry run writes nothing, not even the image files.

5. **Import:**

   ```powershell
   dotnet run --project api/tools/DigitalHub.ContentImport -c Release -- import --in digitalhub-content-2026-10-14.zip
   ```

   - **One transaction:** either everything is imported or nothing is.
   - **On success:** it says *Imported*, and confirms every table matches the bundle's
     checksum.
   - **On a refusal:** it lists each item by table and id with the reason, and changes
     nothing.

6. **Start the API.** On first start it creates the Studio roles and the first
   admin account. That is a separate step from the content; see
   *First admin account* below.

7. **Build and deploy the website** as usual.

### How to verify

- **Counts:** the import prints the number of rows per table. They must equal
  the counts the export printed, which are also under `counts` in `content.json`.
- **Same bundle twice:** importing it again must report `0 create, 0 update`
  for every table. It changes nothing.
- **Exact copy:** an export of the new database must have the same
  `checksums` as the bundle, everything except `exportedAt`.

### What the import refuses

- **A different migration:** a bundle made at another migration. The message names both versions. Migrate
  first, with the code from the same commit.
- **A damaged or edited bundle:** a row count or checksum that does not match, an unknown table or
  field, or an unsafe file name.
- **Users or secrets:** any field that looks like a user or a secret (names
  containing `password`, `token`, `secret`, or `connectionstring`). The word in an
  article's text is fine; only field names are checked.
- **A document the Studio would refuse:** for example a wrong theme, an invalid
  section, a slug already used by another item, or a link to a missing page.
- **Newer edits on the target:** an item that was edited on the target after the
  bundle was made, or a row that differs and has no edit time (settings,
  navigation, redirects, images). The list says what would be overwritten.
  Repeat with `--force` only if overwriting is what you want.

Images without alt text are **listed as notes**, not refused, because the Studio
only checks alt text when an image is uploaded or edited.

### Rolling back

Restore the backup from step 1.

- **No deletions:** the import never deletes a row or a file. It only adds rows, and updates rows
  with the same id.
- **Leftover image files:** new image files have content-hash names. If you
  restore the database, any files the import added to `Media:Root` are unused.
  You may leave them or delete them.

## First admin account

Users are not content and never travel in a bundle. Today, on every start, the
API creates the Studio roles if they are missing. It also creates an admin
account from the settings `Auth:InitialAdminEmail` and
`Auth:InitialAdminPassword`, if no user with that email exists yet.

- **Where the password goes:** the server's secret store or an environment
  variable, never code, a config file in the repository, or a bundle.
- **Change it at once:** after the first sign-in, change the password in the
  Studio.
- **Keep the setting:** do not remove `Auth:InitialAdminPassword` afterwards.
  The API currently refuses to start without it. Once the account exists, its
  value is no longer used to sign in.

A safer one-time step is planned as a follow-up.
