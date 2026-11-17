#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Start', 'Stop', 'Status', 'Test', 'Import')]
    [string]$Action = 'Start',
    [string]$StateDirectory = (Join-Path $env:LOCALAPPDATA 'LaverdaDev\workspace-app')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This helper requires Windows (local credential encryption).' }
$apiRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $apiRoot
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory)
$settingsPath = Join-Path $StateDirectory 'settings.json'
$baseUrl = 'http://127.0.0.1:8080'
$phpExe = Join-Path $projectRoot '.local-tools\php\php.exe'
$mariaDirectories = @(Get-ChildItem (Join-Path $projectRoot '.local-tools\mariadb') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\mariadbd.exe') } | Sort-Object Name -Descending)
if (!(Test-Path $phpExe) -or $mariaDirectories.Count -eq 0) {
    throw 'Expected portable PHP and MariaDB in .local-tools. See api/LOCAL-DEVELOPMENT.md.'
}
$mariaBin = Join-Path $mariaDirectories[0].FullName 'bin'
$phpConfigDirectory = Split-Path -Parent $phpExe
$config = $null

function New-LocalPassword {
    $bytes = New-Object byte[] 24
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    $plain = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    return (ConvertTo-SecureString $plain -AsPlainText -Force | ConvertFrom-SecureString)
}

function Get-LocalPassword([string]$Role) {
    $encrypted = $script:config.($Role + 'Password')
    return [pscredential]::new('local', (ConvertTo-SecureString $encrypted)).GetNetworkCredential().Password
}

function Save-LocalSettings {
    $json = $script:config | ConvertTo-Json
    [IO.File]::WriteAllText($settingsPath, $json, [Text.UTF8Encoding]::new($false))
}

function Test-LocalPort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return ($task.Wait(250) -and $client.Connected)
    } catch { return $false } finally { $client.Dispose() }
}

function Get-OwnedProcess([string]$Name) {
    $path = Join-Path $StateDirectory ($Name + '-process.json')
    if (!(Test-Path $path)) { return $null }
    $record = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $process = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    $recordedStart = $record.StartedAt
    # PowerShell 7.5+ may deserialize ISO timestamps as DateTime; Windows PS 5.1 uses strings.
    if ($recordedStart -is [datetime]) { $recordedStart = $recordedStart.ToUniversalTime().ToString('o') }
    if ($process.Path -ne $record.Executable -or
        $process.StartTime.ToUniversalTime().ToString('o') -ne $recordedStart) {
        # A PID can be reused after a reboot. Ignore the stale record, never the other process.
        Write-Verbose "Ignoring a stale $Name process record."
        return $null
    }
    return $process
}

function Save-OwnedProcess([string]$Name, [Diagnostics.Process]$Process) {
    $record = @{ Id = $Process.Id; Executable = $Process.Path;
        StartedAt = $Process.StartTime.ToUniversalTime().ToString('o') }
    [IO.File]::WriteAllText((Join-Path $StateDirectory ($Name + '-process.json')),
        ($record | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
}

function Invoke-LocalControl([string]$Command, [string]$Role = 'Admin', [string]$Database = 'api_laverda_local') {
    $users = @{ Admin = 'root'; Runtime = 'laverda_api_local'; Import = 'laverda_import_local' }
    $payload = @{ host = '127.0.0.1'; port = 3307; database = $Database;
        user = $users[$Role]; password = (Get-LocalPassword $Role) }
    if ($Command -eq 'provision') {
        $payload.runtimePassword = Get-LocalPassword 'Runtime'
        $payload.importPassword = Get-LocalPassword 'Import'
    }
    $output = ($payload | ConvertTo-Json -Compress) | & $phpExe (Join-Path $PSScriptRoot 'local.php') $Command
    if ($LASTEXITCODE -ne 0) { throw "Local database action '$Command' failed." }
    return ($output | ConvertFrom-Json)
}

function Use-LocalEnvironment([string]$Role, [string]$Database, [scriptblock]$Operation) {
    $users = @{ Admin = 'root'; Runtime = 'laverda_api_local'; Import = 'laverda_import_local' }
    $values = @{ DB_HOST = '127.0.0.1'; DB_PORT = '3307'; DB_NAME = $Database;
        DB_USER = $users[$Role]; DB_PASSWORD = (Get-LocalPassword $Role);
        CORS_ALLOWED_ORIGIN = '*'; PHPRC = $phpConfigDirectory }
    $previous = @{}
    foreach ($key in $values.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $values[$key], 'Process')
    }
    try { & $Operation } finally {
        foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    }
}

function Invoke-LocalPhpFile([string]$File, [string[]]$Arguments = @()) {
    & $phpExe (Join-Path $apiRoot $File) @Arguments
    if ($LASTEXITCODE -ne 0) { throw "PHP command failed: $File" }
}

function Start-LocalDatabase {
    $existing = Get-OwnedProcess 'mariadb'
    if ($null -ne $existing) { return }
    if (Test-LocalPort 3307) { throw 'Port 3307 is already occupied by another server. No existing server will be changed.' }
    $iniPath = Join-Path $script:config.DataDirectory 'my.ini'
    if (!(Test-Path $iniPath)) {
        if ((Test-Path $script:config.DataDirectory) -and
            @(Get-ChildItem -LiteralPath $script:config.DataDirectory -Force).Count -gt 0) {
            throw 'The data directory is not empty but has no my.ini. Existing files will not be overwritten.'
        }
        Write-Host 'Initializing a separate local MariaDB data directory (first start only)...'
        $bootstrapOutput = & (Join-Path $mariaBin 'mariadb-install-db.exe') `
            "--datadir=$($script:config.DataDirectory)" '--port=3307' "--password=$(Get-LocalPassword 'Admin')" 2>&1
        if ($LASTEXITCODE -ne 0) {
            $safeOutput = ($bootstrapOutput | Out-String).Replace((Get-LocalPassword 'Admin'), '[redacted]')
            throw "MariaDB initialization failed: $safeOutput"
        }
    }
    $arguments = @(('--defaults-file="' + $iniPath + '"'), '--bind-address=127.0.0.1', '--port=3307', '--console')
    $process = Start-Process -FilePath (Join-Path $mariaBin 'mariadbd.exe') -ArgumentList $arguments `
        -WorkingDirectory $StateDirectory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $StateDirectory 'mariadb-out.log') `
        -RedirectStandardError (Join-Path $StateDirectory 'mariadb-error.log')
    Save-OwnedProcess 'mariadb' $process
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-LocalPort 3307) { [void](Invoke-LocalControl 'ping'); return }
        if ($process.HasExited) { throw 'MariaDB exited. See mariadb-error.log in the local state directory.' }
        Start-Sleep -Milliseconds 250
    }
    throw 'MariaDB startup timed out. See the local logs.'
}

function Start-LocalApi {
    $existing = Get-OwnedProcess 'api'
    if ($null -eq $existing) {
        if (Test-LocalPort 8080) { throw 'Port 8080 is already occupied by another application.' }
        Use-LocalEnvironment 'Runtime' 'api_laverda_local' {
            $arguments = @('-S', '127.0.0.1:8080', '-t', ('"' + (Join-Path $apiRoot 'public') + '"'),
                ('"' + (Join-Path $apiRoot 'public\index.php') + '"'))
            $process = Start-Process -FilePath $phpExe -ArgumentList $arguments -WorkingDirectory $projectRoot `
                -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $StateDirectory 'api-out.log') `
                -RedirectStandardError (Join-Path $StateDirectory 'api-error.log')
            Save-OwnedProcess 'api' $process
        }
    }
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            $health = Invoke-RestMethod "$baseUrl/health" -TimeoutSec 2
            if ($health.status -eq 'Healthy') { return }
        } catch { }
        if ($null -eq (Get-OwnedProcess 'api')) { throw 'PHP exited. See api-error.log in the local state directory.' }
        Start-Sleep -Milliseconds 250
    }
    throw 'The API is not ready. Check the local API and MariaDB logs.'
}

function Start-LocalStack {
    $version = & $phpExe -r 'echo PHP_VERSION;'
    if ($LASTEXITCODE -ne 0 -or [version]$version -lt [version]'8.3') { throw 'PHP 8.3+ is required.' }
    $drivers = & $phpExe -r 'echo implode(chr(44), PDO::getAvailableDrivers());'
    if ($LASTEXITCODE -ne 0 -or $drivers -notmatch '(^|,)mysql(,|$)') { throw 'PHP pdo_mysql is required.' }
    Start-LocalDatabase
    if (!$script:config.SeedImported) {
        Write-Host 'Creating the application database and separate import/read-only accounts...'
        [void](Invoke-LocalControl 'provision')
        Use-LocalEnvironment 'Admin' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\migrate.php' }
        Use-LocalEnvironment 'Import' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\import_places.php' }
        $script:config.SeedImported = $true
        Save-LocalSettings
    }
    Start-LocalApi
}

function Show-LocalStatus {
    $database = Get-OwnedProcess 'mariadb'
    $api = Get-OwnedProcess 'api'
    Write-Host ('MariaDB: ' + $(if ($null -ne $database) { 'running at 127.0.0.1:3307' } else { 'stopped' }))
    Write-Host ('API:     ' + $(if ($null -ne $api) { 'running at ' + $baseUrl } else { 'stopped' }))
    Write-Host "Local data, encrypted credentials and logs: $StateDirectory"
    if ($null -ne $api) {
        $health = Invoke-RestMethod "$baseUrl/health" -TimeoutSec 3
        Write-Host "Health: $($health.status)"
    }
}

function Stop-LocalStack {
    $api = Get-OwnedProcess 'api'
    if ($null -ne $api) { Stop-Process -Id $api.Id -Force; [void]$api.WaitForExit(5000) }
    $database = Get-OwnedProcess 'mariadb'
    if ($null -ne $database) {
        [void](Invoke-LocalControl 'shutdown')
        if (!$database.WaitForExit(15000)) { throw 'MariaDB has not finished its graceful shutdown. It has not been force-killed.' }
    }
    Show-LocalStatus
}

function Test-LocalStack {
    Start-LocalStack
    $sources = @(Get-ChildItem $apiRoot -Recurse -File -Filter '*.php')
    foreach ($source in $sources) {
        $output = & $phpExe -l $source.FullName
        if ($LASTEXITCODE -ne 0) { throw "PHP syntax error: $output" }
    }
    Write-Host "PASS PHP syntax: $($sources.Count) files"
    Invoke-LocalPhpFile 'tests\unit.php'
    [void](Invoke-LocalControl 'check-readonly' 'Runtime')
    Write-Host 'PASS API account cannot write to places'
    foreach ($suite in @('integration', 'upgrade')) {
        $name = 'laverda_test_' + $suite + '_' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
        [void](Invoke-LocalControl 'create-test-database' 'Admin' $name)
        Write-Host "Running $suite suite in a NEW isolated database: $name"
        Use-LocalEnvironment 'Admin' $name { Invoke-LocalPhpFile ("tests\$suite.php") }
    }
    Use-LocalEnvironment 'Runtime' 'api_laverda_local' {
        Invoke-LocalPhpFile 'scripts\check-deployment.php' @($baseUrl)
    }
    $inspection = Invoke-LocalControl 'inspect' 'Runtime'
    Write-Host "Local Laverda data: $($inspection.places) places; MariaDB $($inspection.version)"
    Write-Host 'PASS local stack checks. The API remains available for browser testing.'
}

if (Test-Path $settingsPath) {
    $config = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if ($config.ProjectRoot -ne $projectRoot -or $config.DataDirectory -ne (Join-Path $StateDirectory 'data')) {
        throw 'The saved local configuration belongs to another project or data directory.'
    }
} elseif ($Action -in @('Status', 'Stop')) {
    Write-Host 'The local stack has not been initialized. Nothing to stop.'
    exit 0
} else {
    if (Test-LocalPort 3307) { throw 'Port 3307 is occupied. No local files or existing databases were changed.' }
    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
    $config = [pscustomobject]@{ ProjectRoot = $projectRoot; DataDirectory = (Join-Path $StateDirectory 'data');
        AdminPassword = (New-LocalPassword); RuntimePassword = (New-LocalPassword);
        ImportPassword = (New-LocalPassword); SeedImported = $false }
    Save-LocalSettings
}

switch ($Action) {
    'Start' { Start-LocalStack; Show-LocalStatus }
    'Stop' { Stop-LocalStack }
    'Status' { Show-LocalStatus }
    'Test' { Test-LocalStack }
    'Import' {
        Start-LocalStack
        Use-LocalEnvironment 'Admin' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\migrate.php' }
        Use-LocalEnvironment 'Import' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\import_places.php' }
        Write-Host 'Explicit import completed. Source values update matching database records.'
    }
}
