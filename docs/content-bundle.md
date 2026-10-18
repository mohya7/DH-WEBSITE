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
  - **Run from the checkout:** the tool reads the content schemas from
    `packages/` in the checkout, so run it there, not from a copied build.
  - **Same migration:** it only accepts a bundle made at the same database
    migration as its code.
- **The .NET 10 SDK.**
- **The empty content database**, created and migrated (below).
- **Two settings**, as environment variables or dotnet user-secrets. They are
  never passed on the command line, and the tool never prints them:

| Setting | Environment variable | What it is |
|---|---|---|
| `ConnectionStrings:Content` | `ConnectionStrings__Content` | The database, signed in as the **application's SQL login** (read and write rows only). Windows sign-in is refused. |
| `Media:Root` | `Media__Root` | The folder the API serves `/media/` from. Use the **same folder** as the API's own `Media:Root` setting. If the API has no `Media:Root`, it is the `media` folder next to the API (`api/src/DigitalHub.Api/media` when run from the repository). |

**To set them for one PowerShell session** (the values are examples):

```powershell
$env:ConnectionStrings__Content = "Server=sql01;Database=DigitalHubContent;User ID=<application login>;Password=<its password>;Encrypt=True;TrustServerCertificate=True"
$env:Media__Root = "D:\sites\digitalhub-api\media"
```

Close the session afterwards, so the password does not stay in it.

## Making a bundle (the content owner does this)

On the machine with the Studio's database, from the repository root, with the
two settings pointing at that database and its media folder:

```powershell
dotnet run --project api/tools/DigitalHub.ContentImport -c Release -- export --out digitalhub-content-2026-10-16.zip
```

- **Reads only.** Export never changes the database.
- **What it prints:**
  - the server and catalog it reads;
  - the migration the database is at;
  - the number of rows per table, and in total;
  - the number of media files.
- **Refusals:**
  - it refuses if the database is not at the migration the code expects;
  - it refuses if any image file a media row points at is missing from
    `Media:Root`, which also shows you have the right folder;
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
   change the schema; the application's login may not. Run these **from the
   `api` folder** of the repository (the tool manifest is found from there):

   ```powershell
   cd api
   dotnet tool restore
   dotnet tool run dotnet-ef -- database update --project src/DigitalHub.Api/DigitalHub.Api.csproj --configuration Release --connection "<connection for the schema owner>"
   cd ..
   ```

   The last line it prints is `Done.`

3. **Grant the application's SQL login** read and write on that database, and
   nothing else. As the schema owner, in that database:

   ```sql
   CREATE USER [<application login>] FOR LOGIN [<application login>];
   ALTER ROLE db_datareader ADD MEMBER [<application login>];
   ALTER ROLE db_datawriter ADD MEMBER [<application login>];
   ```

4. **Set the two settings** above for the tool, then rehearse from the
   repository root:

   ```powershell
   dotnet run --project api/tools/DigitalHub.ContentImport -c Release -- import --in digitalhub-content-2026-10-16.zip --dry-run
   ```

   - **What it shows:**
     - the server and catalog it would write;
     - a table of what it would create, update, or leave unchanged per table, and in total;
     - how many media files are new.
   - **Checks:** every document goes through the same checks the Studio applies
     when an editor saves.
   - **No changes:** a dry run writes nothing, not even the image files.

5. **Import.** A real import writes the catalog that `ConnectionStrings:Content`
   names, so it must be confirmed by that catalog's exact name. The dry run
   printed it as `Catalog:`. Take the backup (step 1) before this step.

   ```powershell
   dotnet run --project api/tools/DigitalHub.ContentImport -c Release -- import --in digitalhub-content-2026-10-16.zip --confirm-catalog <catalog name>
   ```

   - **Without the confirmation:** without `--confirm-catalog`, or with a
     different name, it prints the server and catalog it would have written and
     changes nothing.
   - **One transaction:** either everything is imported or nothing is. New
     image files are written last, just before the database commits. If
     anything fails, it removes exactly the files it wrote (never a file that
     was there before), and changes nothing.
   - **On success:** it says *Imported*, and confirms every table matches the
     bundle's checksum.
   - **On a refusal:** it lists each item by table and id with the reason, says
     *Nothing was changed*, and exits with a non-zero code.

6. **Start the API.** On first start it creates the Studio roles and the first
   admin account. That is a separate step from the content; see
   *First admin account* below.

7. **Build and deploy the website** as usual.

### How to verify

- **Counts:** the import prints the number of rows per table and in total. They
  must equal the counts the export printed, which are also under `counts` in
  `content.json`.
- **Same bundle twice:** importing it again must report `0 create, 0 update`
  for every table. It changes nothing.
- **Exact copy:** an export of the new database must have the same
  `checksums` as the bundle, everything except `exportedAt`.

### What the import refuses

- **A different migration:** a bundle made at another migration. The message
  names both versions. Migrate first, with the code from the same commit.
- **A damaged or edited bundle:** a row count or checksum that does not match,
  an unknown table or field, a value of the wrong type, or an unsafe or unlisted
  file name.
- **A bundle over the limits:**
  - a media file larger than the API's own upload limit (5 MB);
  - `content.json` larger than 256 MiB;
  - more than 2 GiB in total, or more than 20,000 files;
  - any entry that expands more than 100 times;
  - JSON nested more than 64 levels deep, counting JSON that a column keeps
    as text, more than 5,000,000 JSON values, or more than 1 GiB of JSON kept
    as text.

  Both the size an entry declares and the bytes actually read are checked. An
  entry is never read past the size it declares. A limit always refuses the
  whole bundle; nothing over a limit is skipped.
- **A file the upload would refuse:** every image must be what the Studio's
  upload stores: a WebP file named by its content hash, never SVG, within the
  upload's size and pixel limits. Every media row's type is `image/webp`, and
  its path and generated sizes are `/media/<file name>` files in the bundle.
- **Users or secrets:** any field that looks like a user or a secret (names
  containing `password`, `token`, `secret`, or `connectionstring`, ignoring
  case, `_`, `-`, accents, and invisible characters such as zero-width spaces;
  Cyrillic and Greek letters that look like these Latin letters count as
  them). This applies at any depth, including inside JSON that a
  column keeps as text (section fields, drafts, revision snapshots, rich text,
  generated sizes). A field name used twice in one object is refused too.
  Revision snapshots and saved drafts must have the draft
  shape, with no unknown member. The word in an article's text is fine; only
  field names are checked. The lookalike rule covers Cyrillic and Greek only;
  other scripts and other names (such as `apikey`) are not checked.
- **A document the Studio would refuse:** for example a wrong theme, an invalid
  section, a slug already used by another item, or a link to a missing page.
- **Newer edits on the target:** an item that was edited on the target after the
  bundle was made, or a row that differs and has no edit time (settings,
  navigation, redirects, images). The list says what would be overwritten.
  Repeat with `--force` only if overwriting is what you want. `--force` only
  overrides this; it never skips any other check.

Images without alt text are **listed as notes**, not refused, because the Studio
only checks alt text when an image is uploaded or edited.

A missing setting, a database that cannot be reached, or a login that fails is
reported in one line, with a non-zero exit code, and changes nothing.

### Rolling back

Restore the backup from step 1.

- **No deletions:** the import never deletes a row. It only adds rows, and
  updates rows with the same id. It deletes a file only to undo its own failed
  import.
- **Leftover image files:** new image files have content-hash names. If you
  restore the database after a *successful* import, any files it added to
  `Media:Root` are unused. You may leave them or delete them.

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
