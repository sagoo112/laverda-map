#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Doctor', 'Check', 'Health', 'CheckAccess', 'Database', 'Logs', 'Start', 'Stop', 'Restart', 'Status', 'Test', 'Import', 'SetPassword')]
    [string]$Action = 'Start',
    [string]$StateDirectory = (Join-Path $env:LOCALAPPDATA 'LaverdaDev\workspace-app'),
    [ValidateSet('Api', 'Database')][string]$Log = 'Api',
    [ValidateSet('Runtime', 'Import', 'Admin')][string]$DatabaseRole = 'Runtime',
    [switch]$CheckConnection,
    [switch]$Follow,
    [switch]$StopAfterTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($StopAfterTest -and $Action -ne 'Test') { throw '-StopAfterTest is only valid with Test.' }
if ($CheckConnection -and $Action -ne 'Database') { throw '-CheckConnection is only valid with Database.' }
if ($env:OS -ne 'Windows_NT') { throw 'This helper requires Windows (local credential encryption).' }
$apiRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $apiRoot
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory)
$settingsPath = Join-Path $StateDirectory 'settings.json'
$baseUrl = 'http://127.0.0.1:8080'
$phpExe = Join-Path $projectRoot '.local-tools\php\php.exe'
$mariaDirectories = @(Get-ChildItem (Join-Path $projectRoot '.local-tools\mariadb') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\mariadbd.exe') } | Sort-Object Name -Descending)
if ($Action -notin @('Doctor', 'Logs') -and (!(Test-Path $phpExe) -or ($mariaDirectories.Count -eq 0 -and $Action -ne 'Check'))) {
    throw 'Expected portable PHP and MariaDB in .local-tools. See api/LOCAL-DEVELOPMENT.md.'
}
$mariaBin = if ($mariaDirectories.Count) { Join-Path $mariaDirectories[0].FullName 'bin' } else { $null }
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
        foreach ($key in $previous.Keys) {
            if ($null -eq $previous[$key]) { Remove-Item -LiteralPath ('Env:' + $key) -ErrorAction SilentlyContinue }
            else { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
        }
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
    }
    Use-LocalEnvironment 'Admin' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\migrate.php' }
    [void](Invoke-LocalControl 'grant-auth')
    if (!$script:config.SeedImported) {
        Use-LocalEnvironment 'Import' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\import_places.php' }
        $script:config.SeedImported = $true
        Save-LocalSettings
    }
    Start-LocalApi
}

function Set-LocalClubPassword {
    if ($null -eq (Get-OwnedProcess 'mariadb')) {
        throw 'Start the local stack with local.ps1 Start before setting its club password.'
    }
    $first = $null
    $second = $null
    $previousEncoding = $OutputEncoding
    try {
        $first = Read-Host 'New LOCAL club passphrase (15-72 UTF-8 bytes)' -AsSecureString
        $second = Read-Host 'Repeat LOCAL club passphrase' -AsSecureString
        $plain = [pscredential]::new('club', $first).GetNetworkCredential().Password
        $confirmation = [pscredential]::new('club', $second).GetNetworkCredential().Password
        if ($plain -cne $confirmation) { throw 'Passphrases do not match. Nothing changed.' }
        # Windows PowerShell otherwise replaces non-ASCII characters in native pipes.
        $OutputEncoding = [Text.UTF8Encoding]::new($false)
        Use-LocalEnvironment 'Admin' 'api_laverda_local' {
            @($plain, $confirmation) | & $phpExe (Join-Path $apiRoot 'scripts\set-password.php') laverda
            if ($LASTEXITCODE -ne 0) { throw 'Local club password update failed.' }
        }
    } finally {
        $OutputEncoding = $previousEncoding
        if ($null -ne $first) { $first.Dispose() }
        if ($null -ne $second) { $second.Dispose() }
        Remove-Variable plain, confirmation -ErrorAction SilentlyContinue
    }
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

function Test-LocalSources {
    $sources = @(Get-ChildItem $apiRoot -Recurse -File -Filter '*.php')
    foreach ($source in $sources) {
        $output = & $phpExe -l $source.FullName
        if ($LASTEXITCODE -ne 0) { throw "PHP syntax error: $output" }
    }
    Write-Host "PASS PHP syntax: $($sources.Count) files"
    Invoke-LocalPhpFile 'tests\unit.php'
    Invoke-LocalPhpFile 'tests\config.php'
    Invoke-LocalPhpFile 'tests\password.php'
    Invoke-LocalPhpFile 'tests\health.php'
}

function Show-LocalDoctor {
    $ok = $true
    if (Test-Path -LiteralPath $phpExe) {
        $version = & $phpExe -r 'echo PHP_VERSION;'
        if ($LASTEXITCODE -ne 0 -or [version]$version -lt [version]'8.3') { Write-Warning 'PHP 8.3+ required.'; $ok = $false }
        else { Write-Host "PHP $version" }
        $drivers = & $phpExe -r 'echo implode(chr(44), PDO::getAvailableDrivers());'
        if ($LASTEXITCODE -ne 0 -or $drivers -notmatch '(^|,)mysql(,|$)') { Write-Warning 'PHP pdo_mysql missing.'; $ok = $false }
        else { Write-Host 'PDO MySQL available.' }
    } else { Write-Warning 'Portable PHP missing in .local-tools/php.'; $ok = $false }
    if ($mariaDirectories.Count) { Write-Host 'Portable MariaDB available.' }
    else { Write-Warning 'Portable MariaDB missing in .local-tools/mariadb.'; $ok = $false }
    Write-Host ('Local settings exist: ' + (Test-Path -LiteralPath $settingsPath))
    Write-Host 'Doctor starts no server and creates no credentials or database.'
    if (!$ok) { throw 'Missing local prerequisites. See api/LOCAL-DEVELOPMENT.md.' }
}

function Test-LocalHealth {
    if ($null -eq (Get-OwnedProcess 'api')) { throw 'Start this local API first with local.ps1 Start.' }
    $health = Invoke-RestMethod "$baseUrl/health?format=json" -Headers @{ Accept = 'application/json' } -TimeoutSec 10
    Write-Host ('Health: ' + $health.status)
    foreach ($component in $health.checks.PSObject.Properties) { Write-Host ($component.Name + ': ' + $component.Value.status) }
    Invoke-LocalPhpFile 'scripts\check-deployment.php' @($baseUrl)
}

function Test-LocalAccess {
    if ($null -eq (Get-OwnedProcess 'api')) { throw 'Start this local API first with local.ps1 Start.' }
    $secret = Read-Host 'LOCAL club passphrase to verify (not change)' -AsSecureString
    $headers = $null
    try {
        $plain = [pscredential]::new('club', $secret).GetNetworkCredential().Password
        $body = @{ password = $plain } | ConvertTo-Json -Compress
        $session = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/tenants/laverda/auth/login" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 12
        if ($session.token -notmatch '^[a-f0-9]{64}$') { throw 'Invalid session response.' }
        $headers = @{ Authorization = 'Bearer ' + $session.token }
        $verified = Invoke-RestMethod "$baseUrl/api/v1/tenants/laverda/auth/session" -Headers $headers -TimeoutSec 12
        if ($verified.tenant -ne 'laverda') { throw 'Session belongs to another tenant.' }
        $directory = Invoke-RestMethod "$baseUrl/api/v1/tenants/laverda/places" -Headers $headers -TimeoutSec 12
        $entries = @($directory.entries)
        if ($entries.Count) {
            $id = [Uri]::EscapeDataString($entries[0].id)
            $place = Invoke-RestMethod "$baseUrl/api/v1/tenants/laverda/places/$id" -Headers $headers -TimeoutSec 12
            if ($place.id -cne $entries[0].id) { throw 'Place detail does not match the directory.' }
        }
        Write-Host ('PASS authenticated LOCAL session and directory: ' + $entries.Count + ' visible places.')
    } catch {
        # HTTP errors may carry request information. Never echo password-bearing bodies.
        throw 'Local access check failed. Check the club passphrase, API health or login attempt limit.'
    } finally {
        if ($headers) {
            try { [void](Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/tenants/laverda/auth/logout" -Headers $headers -TimeoutSec 12) }
            catch { Write-Warning 'Could not revoke the test session; it will expire automatically.' }
        }
        $secret.Dispose()
        Remove-Variable plain, body, headers, session -ErrorAction SilentlyContinue
    }
}

function Show-LocalLogs {
    $file = Join-Path $StateDirectory $(if ($Log -eq 'Database') { 'mariadb-error.log' } else { 'api-error.log' })
    if (!(Test-Path -LiteralPath $file)) { throw 'No local log file yet. Start the local environment first.' }
    if ($Follow) { Get-Content -LiteralPath $file -Tail 40 -Wait }
    else { Get-Content -LiteralPath $file -Tail 40 }
}

function Open-LocalDatabase {
    if ($null -eq (Get-OwnedProcess 'mariadb')) { throw 'Start this local database first with local.ps1 Start.' }
    $client = Join-Path $mariaBin 'mariadb.exe'
    if (!(Test-Path -LiteralPath $client)) { throw 'MariaDB command-line client missing.' }
    $users = @{ Runtime = 'laverda_api_local'; Import = 'laverda_import_local'; Admin = 'root' }
    $privateDirectory = Join-Path $StateDirectory ('client-' + [guid]::NewGuid().ToString('N'))
    $optionFile = Join-Path $privateDirectory 'client.ini'
    try {
        New-Item -ItemType Directory -Path $privateDirectory | Out-Null
        # Set the directory ACL BEFORE writing credentials. Both PS 5.1 and 7 support Set-Acl.
        $security = [Security.AccessControl.DirectorySecurity]::new()
        $security.SetAccessRuleProtection($true, $false)
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
        $security.AddAccessRule($rule)
        Set-Acl -LiteralPath $privateDirectory -AclObject $security
        $password = Get-LocalPassword $DatabaseRole
        $escaped = $password.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n')
        [IO.File]::WriteAllText($optionFile, ("[client]`npassword=`"" + $escaped + "`"`n"), [Text.UTF8Encoding]::new($false))
        # defaults-file must be FIRST. No password is passed as an argument or copied to the clipboard.
        $arguments = @(("--defaults-file=$optionFile"), '--protocol=tcp', '--host=127.0.0.1', '--port=3307',
            ("--user=" + $users[$DatabaseRole]), '--database=api_laverda_local', '--default-character-set=utf8mb4',
            '--connect-timeout=5', '--local-infile=0', '--safe-updates')
        if ($CheckConnection) {
            $arguments += @('--execute', 'SELECT DATABASE() AS database_name, CURRENT_USER() AS database_user, (SELECT COUNT(*) FROM places) AS places;')
        }
        Write-Host ('LOCAL MariaDB 127.0.0.1:3307 / api_laverda_local / ' + $users[$DatabaseRole])
        if (!$CheckConnection) { Write-Host 'SQL console: SHOW TABLES; to list tables, exit; to close only the client.' }
        Invoke-DatabaseClient -Executable $client -Arguments $arguments
    } finally {
        Remove-Variable password, escaped -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $optionFile) { Remove-Item -LiteralPath $optionFile -Force }
        if (Test-Path -LiteralPath $privateDirectory) { Remove-Item -LiteralPath $privateDirectory -Force }
    }
}

function Invoke-DatabaseClient([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'The local MariaDB client failed. Check database status and local credentials.' }
}

function Restart-LocalStack {
    Stop-LocalStack
    Start-LocalStack
    Show-LocalStatus
}

function Test-LocalStack {
    Start-LocalStack
    Test-LocalSources
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

if ($Action -eq 'Doctor') { Show-LocalDoctor; return }
if ($Action -eq 'Check') { Test-LocalSources; return }
if ($Action -eq 'Logs') { Show-LocalLogs; return }
if (Test-Path $settingsPath) {
    $config = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if ($config.ProjectRoot -ne $projectRoot -or $config.DataDirectory -ne (Join-Path $StateDirectory 'data')) {
        throw 'The saved local configuration belongs to another project or data directory.'
    }
} elseif ($Action -in @('SetPassword', 'CheckAccess', 'Health', 'Database')) {
    throw 'Initialize and start the local stack with local.ps1 Start first.'
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
    'Restart' { Restart-LocalStack }
    'Status' { Show-LocalStatus }
    'Test' {
        try { Test-LocalStack }
        finally { if ($StopAfterTest) { Stop-LocalStack } }
    }
    'SetPassword' { Set-LocalClubPassword }
    'Health' { Test-LocalHealth }
    'CheckAccess' { Test-LocalAccess }
    'Database' { Open-LocalDatabase }
    'Import' {
        Start-LocalStack
        Use-LocalEnvironment 'Admin' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\migrate.php' }
        Use-LocalEnvironment 'Import' 'api_laverda_local' { Invoke-LocalPhpFile 'scripts\import_places.php' }
        Write-Host 'Explicit import completed. Source values update matching database records.'
    }
}
