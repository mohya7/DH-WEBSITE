# Run it on your machine

This starts three things on your computer:

- the **Content API** (the database behind the Studio)
- the **Studio** (where you sign in and edit)
- the **website** (the public pages, already built)

You use PowerShell inside Cursor. Open the repository folder, then **Terminal > New Terminal**. Every command below is typed there, from the repository folder (the one that contains `api`, `studio`, and `website`).

The API this script starts uses a review database named `DigitalHubContent_Studio`. It will not start on the real database `DigitalHubContent`. If it would, it stops with: `Refusing to start a review API on DigitalHubContent.`

## What does not work on your machine

- **The cookie banner.** It appears only when Site settings contain an Analytics container ID shaped like `GTM-` plus at least seven letters or digits. The copy of the site in the repository has no container ID, so there is no banner.
- **The contact form.** The page posts to `/api/v1/public/contact` on the website's own address. The local website is a folder of finished pages and does not hand that request to the API, so submitting the form does nothing.
- **Email.** Nothing here sends mail. A careers address on the site is only a link that opens your mail program.

Save in the Studio is not the same as Publish. A published change shows on the website only after you build the website again. The steps are below.

## 1. Check what is installed

```powershell
node -v
dotnet --version
Get-Service -Name 'MSSQL*' | Format-Table Name, Status -AutoSize
```

You should see:

- Node `v22.12` or newer (22, 24, or 26). The site refuses an older Node.
- A .NET version starting with `10.`
- At least one SQL Server service, and its status `Running`.

If a command is not found, install that program and open a new terminal.

## 2. First time only

Install the website and the Studio packages. The first run takes a few minutes.

```powershell
npm ci --prefix website
npm ci --prefix studio
```

You should see each one end without `npm error`.

Build the API once:

```powershell
dotnet build api\DigitalHub.slnx -c Release
```

The last lines should say `Build succeeded.` and `0 Error(s)`.

### The settings that stay on your machine

These are not files in the folder. They live in the .NET user-secrets store. This command prints the **names only**, never the values:

```powershell
$project = 'api\src\DigitalHub.Api\DigitalHub.Api.csproj'
dotnet user-secrets list --project $project | ForEach-Object { ($_ -split ' = ', 2)[0] }
```

You need these names:

| Name | Why |
|---|---|
| `ConnectionStrings:Content` | How the API signs in to SQL Server. The script changes only the database name, to `DigitalHubContent_Studio`. |
| `Auth:SigningKey` | The API will not start without it. |
| `Auth:InitialAdminEmail` | The email you type on the Studio sign-in page. |
| `Auth:InitialAdminPassword` | The password you type there. The API creates that account the first time it starts, after the database exists. |
| `Build:Token` | Only for a website build that reads the Studio's published content. Not needed for a first look. |

Do not run `dotnet user-secrets list` on its own. That prints the values.

If `Auth:SigningKey` is missing, this creates one and does not print it. You should see `Successfully saved Auth:SigningKey to the secret store.`

```powershell
$bytes = New-Object 'byte[]' 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
dotnet user-secrets set 'Auth:SigningKey' ([Convert]::ToBase64String($bytes)) --project $project
```

If the email or password is missing, type them when asked. You should see `Successfully saved ...` for each, and the password should not appear.

```powershell
$email = Read-Host 'Email you will use to sign in'
$secure = Read-Host 'Password you will use to sign in' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
dotnet user-secrets set 'Auth:InitialAdminEmail' $email --project $project
dotnet user-secrets set 'Auth:InitialAdminPassword' $plain --project $project
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$plain = $null
```

If `ConnectionStrings:Content` is missing, ask the person who runs the databases for the application connection string and set it the same way (`dotnet user-secrets set 'ConnectionStrings:Content' '...' --project $project`). Do not put that string in a file in this folder.

### The review database

The real database is `DigitalHubContent`. Your copy is `DigitalHubContent_Studio`. The application's login can read and write rows. It cannot create the database or change tables. Someone with the schema account does that once.

From the `api` folder, restore the database tool, then **show the migrations before applying them**:

```powershell
cd api
dotnet tool restore
dotnet tool run dotnet-ef -- migrations list --project src\DigitalHub.Api\DigitalHub.Api.csproj --configuration Release --connection '<schema-owner connection, Database=DigitalHubContent_Studio>'
```

Read the list. Then apply it. The last line is `Done.`

```powershell
dotnet tool run dotnet-ef -- database update --project src\DigitalHub.Api\DigitalHub.Api.csproj --configuration Release --connection '<same connection>'
cd ..
```

The connection you type must contain `Database=DigitalHubContent_Studio` (or `Initial Catalog=DigitalHubContent_Studio`). If it names `DigitalHubContent` and nothing after that name, stop. Do not apply it.

The schema account then grants the application login read and write on `DigitalHubContent_Studio` only:

```sql
CREATE USER [dh_content_app] FOR LOGIN [dh_content_app];
ALTER ROLE db_datareader ADD MEMBER [dh_content_app];
ALTER ROLE db_datawriter ADD MEMBER [dh_content_app];
```

If that user already exists, skip `CREATE USER`.

### The build token (only when the website should show Studio content)

```powershell
$bytes = New-Object 'byte[]' 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
dotnet user-secrets set 'Build:Token' ([Convert]::ToBase64String($bytes)) --project $project
```

You should see `Successfully saved Build:Token to the secret store.` You should not see the token. If the API is already running, stop it and start it again so it reads the new token.

## 3. Build the website once

Two ways. Use the snapshot for a first look. It does not need the API.

```powershell
.\scripts\run-local.ps1 rebuild-site
```

You should see `Building the website from the snapshot`, then a list of pages, then `Build output checks passed.` and `Website build finished.`

## 4. Start

```powershell
.\scripts\run-local.ps1 start
```

If PowerShell says the script is not allowed to run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-local.ps1 start
```

The first start compiles the API and can take a few minutes. Then you should see:

```
API      running   pid ...   http://127.0.0.1:5088
Studio   running   pid ...   http://127.0.0.1:5173
Website  running   pid ...   http://127.0.0.1:4177
```

Open the website address. You should see the Digital Hub home page. Open one of the other pages printed by the build, for example the about page if it was in that list.

Open the Studio address. It should show **Sign in**. Use the email and password from the first-time step. You should land on the overview. Click **Pages** (or any collection in the left column). You should see that collection's list.

`start` also writes `studio\.env.local` with one line, `VITE_PUBLIC_SITE_URL`, set to the website address. That is how **View website** and **Preview** know where the site is. The file is not committed.

If a part does not start, the message names a log under `.run-local\`. Those files are not committed.

## 5. See a Studio change on the website

1. In the Studio, open an item, edit it, and **Publish**. Save alone does not publish.
2. The API must still be running.
3. Build the website from the API:

```powershell
.\scripts\run-local.ps1 rebuild-site -Mode api
```

You should see `Building the website from the API at http://127.0.0.1:5088. The build token is set and is not printed.` Then `Build output checks passed.`

4. Refresh the page on the website address. The published text is there. A snapshot build (`rebuild-site` with no `-Mode`) goes back to the copy stored in the repository and hides the Studio edit.

The variables for each build:

| Variable | Snapshot build | API build |
|---|---|---|
| `CONTENT_SOURCE` | `snapshot` | `api` |
| `CONTENT_API_URL` | not used | `http://127.0.0.1:` plus the API port |
| `CONTENT_BUILD_TOKEN` | not used | `Build:Token` from user-secrets. The script sets it and does not print it. |
| `PUBLIC_SITE_URL` | `http://127.0.0.1:` plus the website port. The build refuses to run without it. `http` is allowed only for `127.0.0.1` and `localhost`. | the same |
| `VITE_PUBLIC_SITE_URL` | the same website address, for the Studio. `start` writes it. | the same |

## 6. Stop, status, and other ports

```powershell
.\scripts\run-local.ps1 status
.\scripts\run-local.ps1 stop
```

`stop` stops only the three processes this script started. It does not stop anything else. After `stop`, `status` should show `stopped` for all three.

The ports are the three numbers at the top of `scripts\run-local.ps1` (5088, 5173, and 4177). To use others without editing the file, set them first:

```powershell
$env:DH_LOCAL_API_PORT = '4388'
$env:DH_LOCAL_STUDIO_PORT = '4373'
$env:DH_LOCAL_WEBSITE_PORT = '4377'
.\scripts\run-local.ps1 status
```

`status` prints those addresses. `start` and `rebuild-site` use the same three.

## 7. Reset

```powershell
.\scripts\run-local.ps1 stop
.\scripts\run-local.ps1 rebuild-site
```

That puts the website back on the snapshot. It does not delete the review database, and it does not touch `DigitalHubContent`.

To empty the review database, stop the script first. Someone with the schema account drops **only** `DigitalHubContent_Studio`, then repeats the migration step in section 2. The next `start` creates the admin account again.
