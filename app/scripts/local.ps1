#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Doctor', 'Setup', 'Devices', 'Connect', 'Start', 'Android', 'Check', 'Export', 'Verify', 'Snapshot', 'GradleStop', 'Status', 'Stop')]
    [string]$Action = 'Doctor',
    [string]$DeviceId,
    [string]$SdkPath,
    [string]$StateDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This helper is for Windows PowerShell. See LOCAL-DEVELOPMENT.md for other platforms.' }
$appRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $appRoot
if (!$StateDirectory) { $StateDirectory = Join-Path $projectRoot '.local-tools\app-local' }
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory)
$metroFile = Join-Path $StateDirectory 'metro.json'
$usbFile = Join-Path $StateDirectory 'usb.json'
$expoCli = Join-Path $appRoot 'node_modules\expo\bin\cli'

function Get-Tool([string]$Name) {
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$command) { throw "Required program missing: $Name" }
    return $command.Source
}

function Get-AndroidSdk {
    if ($SdkPath) {
        if (!(Test-Path -LiteralPath (Join-Path $SdkPath 'platform-tools\adb.exe'))) { throw 'The explicit -SdkPath does not contain platform-tools/adb.exe.' }
        return [IO.Path]::GetFullPath($SdkPath)
    }
    $candidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT,
        (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Android\Sdk'))
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'platform-tools\adb.exe'))) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    throw 'Android SDK not found. Supply -SdkPath with the Android SDK Location shown in Android Studio.'
}

function Get-JavaDirectory {
    foreach ($candidate in @($env:JAVA_HOME, (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'))) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'bin\java.exe'))) { return $candidate }
    }
    $java = Get-Tool 'java.exe'
    return (Split-Path -Parent (Split-Path -Parent $java))
}

function Invoke-AppCommand([string]$Executable, [string[]]$Arguments) {
    Push-Location -LiteralPath $appRoot
    try {
        & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) { throw ('Command failed: ' + [IO.Path]::GetFileName($Executable)) }
    } finally { Pop-Location }
}

function Use-AppEnvironment([hashtable]$Values, [scriptblock]$Operation) {
    $previous = @{}
    foreach ($key in $Values.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ($null -eq $Values[$key]) { Remove-Item -LiteralPath ('Env:' + $key) -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($key, $Values[$key], 'Process') }
    }
    try { & $Operation } finally {
        foreach ($key in $previous.Keys) {
            if ($null -eq $previous[$key]) { Remove-Item -LiteralPath ('Env:' + $key) -ErrorAction SilentlyContinue }
            else { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
        }
    }
}

function Assert-Dependencies {
    [void](Assert-Node)
    if (!(Test-Path -LiteralPath $expoCli)) { throw 'App dependencies missing. Run local.ps1 Setup first.' }
}

function Assert-Node {
    $node = Get-Tool 'node.exe'
    $version = & $node -p 'process.versions.node'
    if ($LASTEXITCODE -ne 0 -or [version]$version -lt [version]'24.13') { throw 'Node 24.13+ required.' }
    return $node
}

function Test-MetroPort {
    $client = [Net.Sockets.TcpClient]::new()
    try { return ($client.ConnectAsync('127.0.0.1', 8081).Wait(250) -and $client.Connected) }
    catch { return $false } finally { $client.Dispose() }
}

function Test-AdbServer {
    $client = [Net.Sockets.TcpClient]::new()
    try { return ($client.ConnectAsync('127.0.0.1', 5037).Wait(250) -and $client.Connected) }
    catch { return $false } finally { $client.Dispose() }
}

function Read-AppRecord([string]$File) {
    if (!(Test-Path -LiteralPath $File)) { return $null }
    $record = Get-Content -LiteralPath $File -Raw | ConvertFrom-Json
    if ($record.ProjectRoot -ne $projectRoot) { throw 'Local app state belongs to another working copy.' }
    return $record
}

function Write-AppRecord([string]$File, [object]$Record) {
    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
    [IO.File]::WriteAllText($File, ($Record | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
}

function Get-OwnedMetro {
    $record = Read-AppRecord $metroFile
    if (!$record) { return $null }
    $process = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
    if (!$process) { return $null }
    $started = $record.StartedAt
    if ($started -is [datetime]) { $started = $started.ToUniversalTime().ToString('o') }
    if ($process.Path -ne $record.Executable -or $process.StartTime.ToUniversalTime().ToString('o') -ne $started) { return $null }
    return $process
}

function Stop-OwnedMetro {
    $process = Get-OwnedMetro
    if ($process) {
        # PID, executable and start time were checked; include only its own worker tree.
        & (Get-Tool 'taskkill.exe') /PID $process.Id /T /F *> $null
        if ($LASTEXITCODE -ne 0 -and !$process.HasExited) { throw 'Could not stop the recorded Metro process.' }
        [void]$process.WaitForExit(5000)
    }
    if (Test-Path -LiteralPath $metroFile) { Remove-Item -LiteralPath $metroFile }
}

function Invoke-Adb([string[]]$Arguments) {
    $adb = Join-Path (Get-AndroidSdk) 'platform-tools\adb.exe'
    $output = & $adb @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'adb failed. Check the selected device, USB connection and authorization.' }
    return $output
}

function Get-SelectedDevice {
    $devices = @(Invoke-Adb -Arguments @('devices') | ForEach-Object {
        if ($_ -match '^([A-Za-z0-9][A-Za-z0-9._:-]*)\s+device(?:\s|$)') { $Matches[1] }
    })
    if ($DeviceId) {
        if ($DeviceId -notin $devices) { throw 'Selected device is not connected/authorized. Check adb devices.' }
        return $DeviceId
    }
    if ($devices.Count -eq 1) { return $devices[0] }
    if ($devices.Count -eq 0) { throw 'No authorized Android device. Connect/unlock your phone and allow USB debugging.' }
    Write-Host ('Available devices: ' + ($devices -join ', '))
    throw 'More than one device: repeat with -DeviceId and the desired serial number.'
}

function Get-ReverseMappings([string]$Serial) {
    $mappings = @{}
    foreach ($line in @(Invoke-Adb -Arguments @('-s', $Serial, 'reverse', '--list'))) {
        if ($line -match '(tcp:\d+)\s+(tcp:\d+)\s*$') { $mappings[$Matches[1]] = $Matches[2] }
    }
    return $mappings
}

function Connect-LocalPhone {
    $serial = Get-SelectedDevice
    $mappings = Get-ReverseMappings $serial
    $record = Read-AppRecord $usbFile
    $connections = @()
    if ($record) { $connections = @($record.Connections) }
    foreach ($port in @('tcp:8080', 'tcp:8081')) {
        if ($mappings.ContainsKey($port) -and $mappings[$port] -ne $port) {
            throw "A different USB mapping already uses $port. Nothing was replaced."
        }
    }
    foreach ($port in @('tcp:8080', 'tcp:8081')) {
        if (!$mappings.ContainsKey($port)) {
            [void](Invoke-Adb -Arguments @('-s', $serial, 'reverse', $port, $port))
            $connections += [pscustomobject]@{ DeviceId = $serial; Port = $port }
            # Persist each acquired mapping so a later Stop can clean up even after an error.
            Write-AppRecord $usbFile @{ ProjectRoot = $projectRoot; Connections = @($connections) }
        }
    }
    Write-Host 'USB connected: phone API 8080 -> PC 8080; phone Metro 8081 -> PC 8081.'
    return $serial
}

function Disconnect-OwnedMappings {
    $record = Read-AppRecord $usbFile
    if (!$record) { return }
    if (!(Test-AdbServer)) { Write-Warning 'adb is already stopped. USB records are retained; no adb server was started.'; return }
    $remaining = @()
    foreach ($connection in @($record.Connections)) {
        if ($connection.DeviceId -notmatch '^[A-Za-z0-9][A-Za-z0-9._:-]*$' -or $connection.Port -notin @('tcp:8080', 'tcp:8081')) { throw 'Invalid USB state record.' }
        try {
            $mappings = Get-ReverseMappings $connection.DeviceId
            if ($mappings.ContainsKey($connection.Port) -and $mappings[$connection.Port] -eq $connection.Port) {
                [void](Invoke-Adb -Arguments @('-s', $connection.DeviceId, 'reverse', '--remove', $connection.Port))
            }
        } catch {
            $remaining += $connection
            Write-Warning 'Could not remove a USB mapping. Reconnect the device and repeat Stop.'
        }
    }
    if ($remaining.Count) { Write-AppRecord $usbFile @{ ProjectRoot = $projectRoot; Connections = @($remaining) } }
    else { Remove-Item -LiteralPath $usbFile }
}

function Get-LocalConfigStatus {
    Assert-Dependencies
    $node = Get-Tool 'node.exe'
    $result = Use-AppEnvironment @{ EXPO_NO_DOTENV = $null } {
        & $node (Join-Path $PSScriptRoot 'check-local-env.cjs')
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect local app configuration.' }
    }
    return ($result | ConvertFrom-Json)
}

function Show-AppDoctor {
    $ok = $true
    foreach ($tool in @('node.exe', 'npm.cmd')) {
        try { [void](Get-Tool $tool); Write-Host "OK $tool" } catch { Write-Host "MISSING $tool"; $ok = $false }
    }
    try {
        $version = & (Get-Tool 'node.exe') -p 'process.versions.node'
        if ([version]$version -lt [version]'24.13') { throw 'Node 24.13+ required.' }
        Write-Host "Node $version"
    } catch { Write-Warning 'Use Node 24.13 or newer.'; $ok = $false }
    try { Write-Host ('Android SDK: ' + (Get-AndroidSdk)) } catch { Write-Warning $_.Exception.Message; $ok = $false }
    try { Write-Host ('Java directory: ' + (Get-JavaDirectory)) } catch { Write-Warning 'Java/JDK not found.'; $ok = $false }
    if (Test-Path -LiteralPath $expoCli) {
        $status = Get-LocalConfigStatus
        Write-Host ('API origin configured: ' + $status.apiConfigured)
        Write-Host ('Android Maps key configured: ' + $status.mapsConfigured)
    } else { Write-Warning 'Dependencies missing: run Setup.' }
    Write-Host 'Doctor starts no server and changes no local configuration.'
    if (!$ok) { throw 'Some prerequisites are missing. See LOCAL-DEVELOPMENT.md.' }
}

function Initialize-App {
    [void](Assert-Node)
    if (Test-MetroPort) { throw 'Port 8081 is in use. Stop Metro before replacing node_modules.' }
    Invoke-AppCommand -Executable (Get-Tool 'npm.cmd') -Arguments @('ci')
    $envFile = Join-Path $appRoot '.env.local'
    if (!(Test-Path -LiteralPath $envFile)) {
        $template = "EXPO_PUBLIC_API_URL=http://127.0.0.1:8080`nGOOGLE_MAPS_ANDROID_API_KEY=`nEXPO_PUBLIC_CONTACT_EMAIL=kontakt@example.org`n"
        $stream = [IO.File]::Open($envFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        try { $bytes = [Text.UTF8Encoding]::new($false).GetBytes($template); $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
        Write-Host 'Created private .env.local template. Add your Android Maps key in an editor.'
    } else { Write-Host 'Existing .env.local preserved.' }
}

function Start-AppMetro {
    Assert-Dependencies
    if (!(Get-LocalConfigStatus).mapsConfigured) { throw 'Add GOOGLE_MAPS_ANDROID_API_KEY to .env.local first.' }
    $existing = Get-OwnedMetro
    if ($null -eq $existing -and (Test-MetroPort)) { throw 'Port 8081 belongs to another/unrecorded server. It will not be replaced.' }
    [void](Connect-LocalPhone)
    if ($null -ne $existing) { Write-Host 'This project Metro is already running.'; return }
    $node = Get-Tool 'node.exe'
    Use-AppEnvironment @{ ANDROID_HOME = (Get-AndroidSdk); ANDROID_SDK_ROOT = (Get-AndroidSdk); EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8080'; EXPO_PACKAGER_PROXY_URL = 'http://127.0.0.1:8081'; EXPO_NO_DOTENV = $null } {
        # Metro is interactive: reuse this console so the user can press a/r/Ctrl+C.
        $process = Start-Process -FilePath $node -ArgumentList @(('"' + $expoCli + '"'), 'start', '--dev-client', '--localhost', '--port', '8081') -WorkingDirectory $appRoot -NoNewWindow -PassThru
        # Cache the handle: Windows PowerShell 5.1 may otherwise lose ExitCode after exit.
        $null = $process.Handle
        try {
            Write-AppRecord $metroFile @{ ProjectRoot = $projectRoot; Id = $process.Id; Executable = $node; StartedAt = $process.StartTime.ToUniversalTime().ToString('o') }
            $process.WaitForExit()
            if ($process.ExitCode -ne 0) { throw ('Metro stopped with exit code ' + $process.ExitCode + '.') }
        } finally {
            if (!$process.HasExited) { & (Get-Tool 'taskkill.exe') /PID $process.Id /T /F *> $null; [void]$process.WaitForExit(5000) }
            if (Test-Path -LiteralPath $metroFile) { Remove-Item -LiteralPath $metroFile }
        }
    }
}

function Get-ExpoDeviceName([string]$Serial) {
    $resolver = Join-Path $appRoot 'scripts\resolve-android-device.cjs'
    $result = & (Get-Tool 'node.exe') $resolver $Serial
    if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the selected device for Expo. See the device error above.' }
    $device = $result | ConvertFrom-Json
    if (!$device.name) { throw 'Expo returned an empty device name.' }
    return $device.name
}

function Invoke-AndroidStep([string]$Executable, [string[]]$Arguments, [string]$LogPath) {
    Push-Location -LiteralPath $appRoot
    try {
        $writer = [IO.StreamWriter]::new($LogPath, $true, [Text.UTF8Encoding]::new($false))
        try {
            $writer.AutoFlush = $true
            $writer.WriteLine('--- Expo ' + $Arguments[1] + ' ---')
            $snapshotFailed = $false
            # Windows PowerShell wraps redirected stderr as ErrorRecord. Preserve it and
            # check the actual exit code after all output has been written.
            $ErrorActionPreference = 'Continue'
            $PSNativeCommandUseErrorActionPreference = $false
            & $Executable @Arguments 2>&1 | ForEach-Object {
                $line = [string]$_ -replace 'AIza[0-9A-Za-z_-]{30,}', '[MAPS_KEY_REDACTED]'
                $writer.WriteLine($line)
                Write-Host $line
                if ($line -match 'Cannot snapshot .+not a regular file') { $snapshotFailed = $true }
            }
            $exitCode = $LASTEXITCODE
        } finally { $writer.Dispose() }
        if ($exitCode -ne 0) {
            if ($snapshotFailed) {
                Write-Warning 'Gradle could not read a file. See the "Cannot snapshot / not a regular file" entry in app/LOCAL-DEVELOPMENT.md.'
            }
            throw ('Expo ' + $Arguments[1] + ' failed (exit ' + $exitCode + '). Full output: ' + $LogPath)
        }
    } finally { Pop-Location }
}

function Build-AppAndroid {
    Assert-Dependencies
    if ($null -eq (Get-OwnedMetro) -or !(Test-MetroPort)) { throw 'Start Metro with this helper in a separate window first. Unrecorded servers are not reused.' }
    if (!(Get-LocalConfigStatus).mapsConfigured) { throw 'Android Maps key is missing in .env.local.' }
    $serial = Connect-LocalPhone
    $node = Get-Tool 'node.exe'
    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
    $logPath = Join-Path $StateDirectory 'android-build.log'
    [IO.File]::WriteAllText($logPath, '')
    Write-Host "Android build log: $logPath"
    Use-AppEnvironment @{ ANDROID_HOME = (Get-AndroidSdk); ANDROID_SDK_ROOT = (Get-AndroidSdk); JAVA_HOME = (Get-JavaDirectory); EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8080'; EXPO_PACKAGER_PROXY_URL = 'http://127.0.0.1:8081'; EXPO_NO_DOTENV = $null } {
        [void](Get-ExpoDeviceName $serial)
        Invoke-AndroidStep -Executable $node -Arguments @($expoCli, 'prebuild', '--platform', 'android', '--no-install') -LogPath $logPath
        # Prebuild may take time: recheck the SAME serial before selecting by Expo's name.
        $deviceName = Get-ExpoDeviceName $serial
        Invoke-AndroidStep -Executable $node -Arguments @($expoCli, 'run:android', '--device', $deviceName, '--no-bundler') -LogPath $logPath
    }
}

function Test-AppSources {
    Assert-Dependencies
    Use-AppEnvironment @{ EXPO_NO_DOTENV = '1' } {
        Invoke-AppCommand -Executable (Get-Tool 'npm.cmd') -Arguments @('run', 'verify')
        Invoke-AppCommand -Executable (Get-Tool 'npm.cmd') -Arguments @('run', 'format:check')
        Invoke-AppCommand -Executable (Get-Tool 'node.exe') -Arguments @($expoCli, 'install', '--check')
    }
}

function Export-AppBundles {
    Assert-Dependencies
    Use-AppEnvironment @{ EXPO_NO_DOTENV = '1' } {
        Invoke-AppCommand -Executable (Get-Tool 'node.exe') -Arguments @($expoCli, 'export', '--platform', 'android', '--platform', 'ios', '--max-workers', '2')
    }
}

function Update-AppSnapshot {
    Assert-Dependencies
    Invoke-AppCommand -Executable (Get-Tool 'npm.cmd') -Arguments @('run', 'data:generate')
    Invoke-AppCommand -Executable (Get-Tool 'npm.cmd') -Arguments @('run', 'data:check')
}

function Stop-AppGradle {
    $wrapper = Join-Path $appRoot 'android\gradlew.bat'
    if (!(Test-Path -LiteralPath $wrapper)) { throw 'No generated Android project. Nothing to stop.' }
    Use-AppEnvironment @{ JAVA_HOME = (Get-JavaDirectory) } {
        Push-Location -LiteralPath (Join-Path $appRoot 'android')
        try {
            & $wrapper --stop
            if ($LASTEXITCODE -ne 0) { throw 'Gradle stop failed.' }
        } finally { Pop-Location }
    }
}

switch ($Action) {
    'Doctor' { Show-AppDoctor }
    'Setup' { Initialize-App }
    'Devices' { Invoke-Adb -Arguments @('devices', '-l') }
    'Connect' { [void](Connect-LocalPhone) }
    'Start' { Start-AppMetro }
    'Android' { Build-AppAndroid }
    'Check' { Test-AppSources }
    'Export' { Export-AppBundles }
    'Verify' { Test-AppSources; Export-AppBundles }
    'Snapshot' { Update-AppSnapshot }
    'GradleStop' { Stop-AppGradle }
    'Status' {
        Write-Host ('Recorded Metro running: ' + ($null -ne (Get-OwnedMetro)))
        Write-Host ('Port 8081 occupied: ' + (Test-MetroPort))
        Write-Host ('USB mappings recorded: ' + (Test-Path -LiteralPath $usbFile))
    }
    'Stop' { Stop-OwnedMetro; Disconnect-OwnedMappings; Write-Host 'Recorded Metro stopped; USB cleanup attempted (see warnings). API/MariaDB and other adb sessions are unchanged.' }
}
