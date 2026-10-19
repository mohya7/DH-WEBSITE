# Start, stop, and rebuild the local Content API, Studio, and website.
# Run from anywhere:  .\scripts\run-local.ps1 start
# Requires Windows PowerShell 5.1 or PowerShell 7.
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('start', 'stop', 'status', 'rebuild-site')]
    [string]$Command,

    [ValidateSet('snapshot', 'api')]
    [string]$Mode = 'snapshot'
)

$ErrorActionPreference = 'Stop'

# The only place the three ports are chosen.
# Change the numbers, or set these three variables before you run the script:
#   DH_LOCAL_API_PORT, DH_LOCAL_STUDIO_PORT, DH_LOCAL_WEBSITE_PORT
$ApiPort = if ($env:DH_LOCAL_API_PORT) { [int]$env:DH_LOCAL_API_PORT } else { 5088 }
$StudioPort = if ($env:DH_LOCAL_STUDIO_PORT) { [int]$env:DH_LOCAL_STUDIO_PORT } else { 5173 }
$WebsitePort = if ($env:DH_LOCAL_WEBSITE_PORT) { [int]$env:DH_LOCAL_WEBSITE_PORT } else { 4177 }

$ReviewCatalog = 'DigitalHubContent_Studio'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$StateDir = Join-Path $Root '.run-local'
$PidFile = Join-Path $StateDir 'pids.json'
$Project = Join-Path $Root 'api\src\DigitalHub.Api\DigitalHub.Api.csproj'

function Write-Step([string]$Message) {
    Write-Host $Message
}

function Get-SecretValue([string]$Name) {
    $lines = & dotnet user-secrets list --project $Project
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not read user-secrets. Install the .NET 10 SDK and run this from the repository.'
    }
    foreach ($line in @($lines)) {
        $prefix = "$Name = "
        if ($line.StartsWith($prefix)) {
            return $line.Substring($prefix.Length)
        }
    }
    return $null
}

function Get-ReviewConnection {
    $secret = Get-SecretValue 'ConnectionStrings:Content'
    if (-not $secret) {
        throw 'No ConnectionStrings:Content in user-secrets. See docs/run-locally.md.'
    }
    $studio = $secret -replace '(?i)(Database|Initial Catalog)=[^;]+', "Database=$ReviewCatalog"
    if ($studio -notmatch "(?i)(Database|Initial Catalog)=$([regex]::Escape($ReviewCatalog))(\s*;|$)") {
        throw "Refusing to start: the connection string did not become $ReviewCatalog."
    }
    if ($studio -match '(?i)(Database|Initial Catalog)=DigitalHubContent\s*(;|$)') {
        throw 'Refusing to start a review API on DigitalHubContent.'
    }
    return $studio
}

function Read-PidFile {
    if (-not (Test-Path $PidFile)) {
        return @()
    }
    $parsed = Get-Content -Raw -Path $PidFile | ConvertFrom-Json
    return @($parsed)
}

function Save-PidFile($Entries) {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    $Entries | ConvertTo-Json | Set-Content -Path $PidFile -Encoding utf8
}

function Get-RunningEntry($Entry) {
    if (-not $Entry) { return $null }
    $proc = Get-Process -Id $Entry.pid -ErrorAction SilentlyContinue
    if (-not $proc) { return $null }
    if ([string]$proc.StartTime.Ticks -ne [string]$Entry.startedTicks) { return $null }
    return $proc
}

function Start-LoggedProcess([string]$Name, [string]$CommandLine, [string]$WorkingDirectory, [hashtable]$Environment) {
    $log = Join-Path $StateDir "$Name.log"
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    if (Test-Path $log) { Remove-Item $log -Force }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = "/c $CommandLine > `"$log`" 2>&1"
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    foreach ($key in $Environment.Keys) {
        $psi.EnvironmentVariables[$key] = [string]$Environment[$key]
    }
    $proc = [System.Diagnostics.Process]::Start($psi)
    if (-not $proc) { throw "Could not start $Name." }
    return [pscustomobject]@{
        name = $Name
        pid = $proc.Id
        startedTicks = [string]$proc.StartTime.Ticks
        log = $log
    }
}

function Wait-ForPort([int]$Port, [int]$Seconds, [string]$Log) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect('127.0.0.1', $Port)
            return
        } catch {
            Start-Sleep -Milliseconds 400
        } finally {
            $client.Dispose()
        }
    }
    throw "Nothing is listening on 127.0.0.1:${Port}. Look at $Log"
}

function Stop-Recorded($Entry) {
    $proc = Get-RunningEntry $Entry
    if (-not $proc) {
        Write-Step "$($Entry.name) is not running."
        return
    }
    & taskkill.exe /PID $Entry.pid /T /F
    if ($LASTEXITCODE -ne 0) { throw "Could not stop $($Entry.name) (pid $($Entry.pid))." }
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-Process -Id $Entry.pid -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 200
    }
    throw "Process $($Entry.pid) ($($Entry.name)) did not stop."
}

function Show-Status {
    $entries = Read-PidFile
    $names = @('api', 'studio', 'website')
    $addresses = @{
        api = "http://127.0.0.1:$ApiPort"
        studio = "http://127.0.0.1:$StudioPort"
        website = "http://127.0.0.1:$WebsitePort"
    }
    foreach ($name in $names) {
        $entry = $entries | Where-Object { $_.name -eq $name } | Select-Object -First 1
        $running = Get-RunningEntry $entry
        if ($running) {
            Write-Step ("{0,-8} running   pid {1,-8} {2}" -f $name, $entry.pid, $addresses[$name])
        } else {
            Write-Step ("{0,-8} stopped          {1}" -f $name, $addresses[$name])
        }
    }
}

function Assert-Installed {
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'dotnet is not on PATH. Install the .NET 10 SDK.' }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node is not on PATH. Install Node.js 22.12 or newer.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is not on PATH.' }
    $studioModules = Join-Path $Root 'studio\node_modules'
    $websiteModules = Join-Path $Root 'website\node_modules'
    if (-not (Test-Path $studioModules) -or -not (Test-Path $websiteModules)) {
        throw 'Packages are not installed. From the repository root run: npm ci --prefix website; npm ci --prefix studio'
    }
}

function Update-StudioSiteUrl {
    $file = Join-Path $Root 'studio\.env.local'
    $line = "VITE_PUBLIC_SITE_URL=http://127.0.0.1:$WebsitePort"
    $kept = @()
    if (Test-Path $file) {
        $kept = @(Get-Content $file | Where-Object { $_ -notmatch '^\s*VITE_PUBLIC_SITE_URL\s*=' -and $_ -ne '' })
    }
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file, ((@($kept) + $line) -join "`n") + "`n", $utf8)
}

function Invoke-RebuildSite {
    Assert-Installed
    $website = Join-Path $Root 'website'
    $env:PUBLIC_SITE_URL = "http://127.0.0.1:$WebsitePort"
    Remove-Item Env:EXPECTED_PUBLIC_ORIGIN -ErrorAction SilentlyContinue
    if ($Mode -eq 'snapshot') {
        $env:CONTENT_SOURCE = 'snapshot'
        Remove-Item Env:CONTENT_API_URL -ErrorAction SilentlyContinue
        Remove-Item Env:CONTENT_BUILD_TOKEN -ErrorAction SilentlyContinue
        Write-Step "Building the website from the snapshot (no API). PUBLIC_SITE_URL=$($env:PUBLIC_SITE_URL)"
    } else {
        $token = Get-SecretValue 'Build:Token'
        if (-not $token) {
            throw 'No Build:Token in user-secrets. The api build needs it. See docs/run-locally.md. The token was not printed.'
        }
        $api = Read-PidFile | Where-Object { $_.name -eq 'api' } | Select-Object -First 1
        if (-not (Get-RunningEntry $api)) {
            throw "The API is not running. Start it first: .\scripts\run-local.ps1 start"
        }
        $env:CONTENT_SOURCE = 'api'
        $env:CONTENT_API_URL = "http://127.0.0.1:$ApiPort"
        $env:CONTENT_BUILD_TOKEN = $token
        Write-Step "Building the website from the API at $($env:CONTENT_API_URL). The build token is set and is not printed."
    }
    Push-Location $website
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "The website build failed (exit $LASTEXITCODE)." }
    } finally {
        Pop-Location
        Remove-Item Env:CONTENT_BUILD_TOKEN -ErrorAction SilentlyContinue
    }
    Write-Step 'Website build finished. Refresh the website address. If the site was already started, you do not need to start it again.'
}

switch ($Command) {
    'status' { Show-Status }
    'stop' {
        $entries = Read-PidFile
        if ($entries.Count -eq 0) {
            Write-Step 'Nothing was started by this script.'
        }
        foreach ($entry in $entries) {
            Stop-Recorded $entry
            Write-Step "Stopped $($entry.name) (pid $($entry.pid))."
        }
        if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
        Show-Status
    }
    'rebuild-site' { Invoke-RebuildSite }
    'start' {
        Assert-Installed
        $existing = Read-PidFile | Where-Object { Get-RunningEntry $_ }
        if ($existing) {
            throw 'This script already has something running. Run .\scripts\run-local.ps1 status, or stop first.'
        }
        $indexPage = Join-Path $Root 'website\out\index.html'
        if (-not (Test-Path $indexPage)) {
            throw 'The website has not been built. Run .\scripts\run-local.ps1 rebuild-site first.'
        }
        $connection = Get-ReviewConnection
        Update-StudioSiteUrl
        New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

        Write-Step "Starting the API on http://127.0.0.1:$ApiPort against $ReviewCatalog."
        $api = Start-LoggedProcess -Name 'api' -CommandLine "dotnet run --project `"$Project`" -c Release --no-launch-profile" -WorkingDirectory $Root -Environment @{
            ConnectionStrings__Content = $connection
            ASPNETCORE_ENVIRONMENT = 'Development'
            ASPNETCORE_URLS = "http://127.0.0.1:$ApiPort"
        }
        Wait-ForPort -Port $ApiPort -Seconds 420 -Log $api.log

        Write-Step "Starting the Studio on http://127.0.0.1:$StudioPort."
        $studio = Start-LoggedProcess -Name 'studio' -CommandLine 'npm run dev' -WorkingDirectory (Join-Path $Root 'studio') -Environment @{
            DH_API_URL = "http://127.0.0.1:$ApiPort"
            DH_STUDIO_PORT = "$StudioPort"
            VITE_PUBLIC_SITE_URL = "http://127.0.0.1:$WebsitePort"
        }
        Wait-ForPort -Port $StudioPort -Seconds 120 -Log $studio.log

        Write-Step "Starting the website on http://127.0.0.1:$WebsitePort."
        $website = Start-LoggedProcess -Name 'website' -CommandLine 'node tools/serve-built.mjs' -WorkingDirectory (Join-Path $Root 'website') -Environment @{
            WEBSITE_TEST_PORT = "$WebsitePort"
        }
        Wait-ForPort -Port $WebsitePort -Seconds 30 -Log $website.log

        $records = @(
            [pscustomobject]@{ name = 'api'; pid = $api.pid; startedTicks = $api.startedTicks },
            [pscustomobject]@{ name = 'studio'; pid = $studio.pid; startedTicks = $studio.startedTicks },
            [pscustomobject]@{ name = 'website'; pid = $website.pid; startedTicks = $website.startedTicks }
        )
        Save-PidFile $records
        Write-Step 'All three are running.'
        Show-Status
    }
}
