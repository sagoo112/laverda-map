#requires -Version 5.1
# Tests the actual helper functions with disposable processes and simulated adb/HTTP.
# No phone, application server, real password, development DB or SDK build is used.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$appRoot = Join-Path $projectRoot 'app'
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('laverda-local-tools-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch | Out-Null
$StateDirectory = $scratch
$metroFile = Join-Path $scratch 'metro.json'
$usbFile = Join-Path $scratch 'usb.json'
$DeviceId = ''
$SdkPath = ''
$ClearCache = $false
$checks = 0
$workers = @()
function Assert([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw ('FAIL ' + $Message) }
    $script:checks++
}
function Import-HelperFunctions([string]$File) {
    $tokens = $null; $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile($File, [ref]$tokens, [ref]$errors)
    if ($errors) { throw ($errors | Out-String) }
    foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
        # Keep inline parameter declarations as well as the body; import definitions only.
        $declaration = $definition.Extent.Text -replace '^function\s+', 'function script:'
        . ([scriptblock]::Create($declaration))
    }
}
Import-HelperFunctions (Join-Path $appRoot 'scripts\local.ps1')
Import-HelperFunctions (Join-Path $projectRoot 'api\scripts\local.ps1')
try {
    $env:LAVERDA_TEST_RESTORE = 'original'
    Use-AppEnvironment @{ LAVERDA_TEST_RESTORE = 'temporary' } { Assert ($env:LAVERDA_TEST_RESTORE -eq 'temporary') 'temporary environment applied' }
    Assert ($env:LAVERDA_TEST_RESTORE -eq 'original') 'environment restored after success'
    try { Use-AppEnvironment @{ LAVERDA_TEST_RESTORE = 'temporary' } { throw 'expected fixture error' } }
    catch { Assert ($_.Exception.Message -eq 'expected fixture error') 'original error retained' }
    Assert ($env:LAVERDA_TEST_RESTORE -eq 'original') 'environment restored after failure'

    $node = Get-Tool 'node.exe'
    $argvScript = Join-Path $scratch 'argument fixture.cjs'
    [IO.File]::WriteAllText($argvScript, 'if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["two words","--no-bundler"])) process.exit(19);', [Text.UTF8Encoding]::new($false))
    $before = (Get-Location).Path
    Invoke-AppCommand -Executable $node -Arguments @($argvScript, 'two words', '--no-bundler')
    Assert ((Get-Location).Path -eq $before) 'native arguments and working directory preserved'
    $androidLogFixture = Join-Path $scratch 'android-log.cjs'
    $androidLog = Join-Path $scratch 'android-build.log'
    [IO.File]::WriteAllText($androidLogFixture, @'
console.log("fixture stdout");
console.error("Cannot snapshot fixture: not a regular file");
console.error("AIza" + "x".repeat(35));
process.exit(17);
'@)
    try { Invoke-AndroidStep -Executable $node -Arguments @($androidLogFixture, 'run:android') -LogPath $androidLog; throw 'failed build accepted' }
    catch { Assert ($_.Exception.Message -like 'Expo run:android failed (exit 17).*') 'Android logs stderr before reporting native exit code' }
    $loggedBuild = [IO.File]::ReadAllText($androidLog)
    Assert ($loggedBuild.Contains('fixture stdout') -and $loggedBuild.Contains('Cannot snapshot fixture') -and $loggedBuild.Contains('[MAPS_KEY_REDACTED]') -and !$loggedBuild.Contains(('AIza' + ('x' * 35)))) 'Android log keeps the root error and redacts the Maps key'
    $SdkPath = Join-Path $scratch 'missing-sdk'
    try { [void](Get-AndroidSdk); throw 'invalid SDK accepted' }
    catch { Assert ($_.Exception.Message -like 'The explicit -SdkPath*') 'explicit invalid SDK rejected' }
    $SdkPath = ''

    $timerScript = Join-Path $scratch 'timer.cjs'
    [IO.File]::WriteAllText($timerScript, 'setInterval(() => {}, 1000);', [Text.UTF8Encoding]::new($false))
    $owned = Start-Process -FilePath $node -ArgumentList ('"' + $timerScript + '"') -WindowStyle Hidden -PassThru
    $foreign = Start-Process -FilePath $node -ArgumentList ('"' + $timerScript + '"') -WindowStyle Hidden -PassThru
    $workers = @($owned, $foreign)
    Write-AppRecord $metroFile @{ ProjectRoot = $projectRoot; Id = $owned.Id; Executable = $node; StartedAt = '2000-01-01T00:00:00.0000000Z' }
    Stop-OwnedMetro
    Assert (!$owned.HasExited -and !$foreign.HasExited) 'stale PID record never kills a process'
    Write-AppRecord $metroFile @{ ProjectRoot = 'another-project'; Id = $owned.Id }
    try { Stop-OwnedMetro; throw 'foreign project accepted' }
    catch { Assert ($_.Exception.Message -like 'Local app state belongs*') 'foreign project record rejected' }
    Write-AppRecord $metroFile @{ ProjectRoot = $projectRoot; Id = $owned.Id; Executable = $node; StartedAt = $owned.StartTime.ToUniversalTime().ToString('o') }
    Stop-OwnedMetro
    $owned.Refresh(); $foreign.Refresh()
    Assert ($owned.HasExited -and !$foreign.HasExited) 'only owned Metro process tree stopped'

    $apiRecord = Join-Path $StateDirectory 'api-process.json'
    $phpExe = (Get-Process -Id $foreign.Id).Path
    Save-OwnedProcess 'api' $foreign $phpExe
    $record = Get-Content -LiteralPath $apiRecord -Raw | ConvertFrom-Json
    Assert ($record.Executable -eq $phpExe -and $null -ne (Get-OwnedProcess 'api')) 'API process record uses the executable supplied at launch'
    $record.Executable = $null
    $record | ConvertTo-Json | Set-Content -LiteralPath $apiRecord
    Assert ($null -ne (Get-OwnedProcess 'api')) 'API recovers a legacy record with a missing path for the expected executable'
    $phpExe = Join-Path $scratch 'different.exe'
    Assert ($null -eq (Get-OwnedProcess 'api')) 'API rejects a different executable when recovering a legacy record'
    $phpExe = (Get-Process -Id $foreign.Id).Path
    $record.StartedAt = '2000-01-01T00:00:00.0000000Z'
    $record | ConvertTo-Json | Set-Content -LiteralPath $apiRecord
    Assert ($null -eq (Get-OwnedProcess 'api')) 'API rejects a reused PID when recovering a legacy record'

    $script:deviceLines = @('List of devices attached', "fixture-phone`tdevice")
    $script:mappings = @{ 'tcp:8080' = 'tcp:8080' }
    $script:adbCalls = @()
    function Invoke-Adb([string[]]$Arguments) {
        $script:adbCalls += ,$Arguments
        if (($Arguments -join ' ') -eq 'devices') { return $script:deviceLines }
        if ($Arguments.Count -lt 4 -or $Arguments[0] -ne '-s' -or $Arguments[1] -ne 'fixture-phone' -or $Arguments[2] -ne 'reverse') { throw 'Unexpected adb arguments' }
        if ($Arguments[3] -eq '--list') { return @($script:mappings.Keys | ForEach-Object { 'UsbFfs ' + $_ + ' ' + $script:mappings[$_] }) }
        if ($Arguments[3] -eq '--remove') { $script:mappings.Remove($Arguments[4]); return }
        $script:mappings[$Arguments[3]] = $Arguments[4]
    }
    $script:adbRunning = $true
    function Test-AdbServer { return $script:adbRunning }
    Assert ((Connect-LocalPhone) -eq 'fixture-phone') 'single authorized device selected'
    Assert ($script:mappings['tcp:8081'] -eq 'tcp:8081') 'both USB ports mapped'
    Disconnect-OwnedMappings
    Assert ($script:mappings.ContainsKey('tcp:8080') -and !$script:mappings.ContainsKey('tcp:8081')) 'pre-existing manual USB mapping preserved'
    $script:mappings['tcp:8081'] = 'tcp:8081'
    Write-AppRecord $usbFile @{ ProjectRoot = $projectRoot; Connections = @(@{ DeviceId = 'fixture-phone'; Port = 'tcp:8081' }) }
    $script:adbRunning = $false
    $previousCalls = $script:adbCalls.Count
    Disconnect-OwnedMappings
    Assert ($script:adbCalls.Count -eq $previousCalls -and (Test-Path -LiteralPath $usbFile)) 'Stop never restarts an already stopped adb server'
    $script:adbRunning = $true
    Disconnect-OwnedMappings
    $script:mappings = @{ 'tcp:8080' = 'tcp:9999' }
    try { [void](Connect-LocalPhone); throw 'conflicting mapping accepted' }
    catch { Assert ($_.Exception.Message -like 'A different USB mapping*') 'conflicting USB mapping rejected' }
    Assert (!$script:mappings.ContainsKey('tcp:8081')) 'conflict detected before creating other mapping'
    $script:deviceLines += "second-phone`tdevice"
    try { [void](Get-SelectedDevice); throw 'ambiguous device selected' }
    catch { Assert ($_.Exception.Message -like 'More than one device*') 'multiple devices require explicit selection' }
    $DeviceId = 'fixture-phone'
    Assert ((Get-SelectedDevice) -eq 'fixture-phone') 'explicit device selection supported'
    $DeviceId = 'not-connected'
    try { [void](Get-SelectedDevice); throw 'unknown device selected' }
    catch { Assert ($_.Exception.Message -like 'Selected device is not connected*') 'unauthorized or missing device rejected' }

    # Exercise real foreground process startup/cleanup using a non-server Node fixture.
    $expoCli = Join-Path $scratch 'metro fixture.cjs'
    $fixtureCode = 'if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["start","--dev-client","--localhost","--port","8081"]) || process.env.EXPO_PUBLIC_API_URL !== "http://127.0.0.1:8080") process.exit(23); else setTimeout(() => process.exit(0), 400);'
    [IO.File]::WriteAllText($expoCli, $fixtureCode, [Text.UTF8Encoding]::new($false))
    function Assert-Dependencies { }
    function Get-LocalConfigStatus { return @{ mapsConfigured = $true } }
    function Connect-LocalPhone { return 'fixture-phone' }
    $script:portBusy = $false
    function Test-MetroPort { return $script:portBusy }
    function Get-AndroidSdk { return $scratch }
    $previousApi = [Environment]::GetEnvironmentVariable('EXPO_PUBLIC_API_URL', 'Process')
    Start-AppMetro
    Assert (!(Test-Path -LiteralPath $metroFile)) 'foreground process cleans up Metro ownership record'
    Assert ([Environment]::GetEnvironmentVariable('EXPO_PUBLIC_API_URL', 'Process') -eq $previousApi) 'local API override is not persisted'
    $ClearCache = $true
    [IO.File]::WriteAllText($expoCli, $fixtureCode.Replace('"8081"]', '"8081","--clear"]'), [Text.UTF8Encoding]::new($false))
    Start-AppMetro
    Assert (!(Test-Path -LiteralPath $metroFile)) 'Metro cache reset passes --clear and cleans up the ownership record'
    $ClearCache = $false

    $originalAppRoot = $appRoot
    $appRoot = Join-Path $scratch 'setup-fixture'
    New-Item -ItemType Directory -Path $appRoot | Out-Null
    $envFile = Join-Path $appRoot '.env.local'
    [IO.File]::WriteAllText($envFile, 'fixture-existing-private-config', [Text.UTF8Encoding]::new($false))
    $script:installs = 0
    function Invoke-AppCommand([string]$Executable, [string[]]$Arguments) {
        Assert (($Arguments -join ' ') -eq 'ci') 'Setup uses the reproducible lockfile install'
        $script:installs++
    }
    Initialize-App
    Assert ([IO.File]::ReadAllText($envFile) -eq 'fixture-existing-private-config') 'Setup never overwrites existing env values'
    Remove-Item -LiteralPath $envFile
    Initialize-App
    Assert ([IO.File]::ReadAllText($envFile).Contains('EXPO_PUBLIC_API_URL=http://127.0.0.1:8080')) 'Setup creates a missing local template'
    $script:portBusy = $true
    try { Initialize-App; throw 'busy Metro accepted for Setup' }
    catch { Assert ($_.Exception.Message -like 'Port 8081 is in use*') 'Setup refuses to change dependencies while Metro is active' }
    Assert ($script:installs -eq 2) 'busy Setup does not invoke npm'
    $script:portBusy = $false
    $appRoot = $originalAppRoot

    $baseUrl = 'http://127.0.0.1:8080'
    $script:loginPassword = 'fixture passphr' + [char]0x00e4 + 'se only'
    $script:logoutCount = 0
    $script:failDirectory = $false
    function Get-OwnedProcess([string]$Name) { return [pscustomobject]@{ Id = -1 } }
    function Read-Host {
        param([string]$Prompt, [switch]$AsSecureString)
        Assert $AsSecureString.IsPresent 'access check uses hidden input'
        return (ConvertTo-SecureString $script:loginPassword -AsPlainText -Force)
    }
    function Invoke-RestMethod {
        param([Parameter(Position = 0)][string]$Uri, [string]$Method = 'Get', [hashtable]$Headers, [string]$ContentType, [object]$Body, [int]$TimeoutSec)
        Assert ($Uri.StartsWith($baseUrl + '/')) 'access check only calls fixed local origin'
        if ($Uri.EndsWith('/auth/login')) {
            $request = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json
            Assert ($request.password -ceq $script:loginPassword) 'Unicode password preserved in JSON'
            return @{ token = ('a' * 64) }
        }
        Assert ($Headers.Authorization -ceq ('Bearer ' + ('a' * 64))) 'test token sent only as bearer header'
        if ($Uri.EndsWith('/auth/session')) { return @{ tenant = 'laverda' } }
        if ($Uri.EndsWith('/places')) {
            if ($script:failDirectory) { throw 'fixture-private-password-body' }
            return @{ entries = @(@{ id = 'fixture/1' }) }
        }
        if ($Uri.EndsWith('/places/fixture%2F1')) { return @{ id = 'fixture/1' } }
        if ($Uri.EndsWith('/auth/logout')) { $script:logoutCount++; return @{ status = 'ok' } }
        throw 'Unexpected local URL'
    }
    Test-LocalAccess
    Assert ($script:logoutCount -eq 1) 'test session revoked after success'
    $script:failDirectory = $true
    try { Test-LocalAccess; throw 'failed directory accepted' }
    catch { Assert ($_.Exception.Message -like 'Local access check failed.*' -and $_.Exception.Message -notlike '*fixture-private*') 'HTTP errors hide password-bearing request details' }
    Assert ($script:logoutCount -eq 2) 'test session revoked after request failure'

    # DB login uses private, short-lived options instead of password arguments.
    $mariaBin = Join-Path $scratch 'client-fixture'
    New-Item -ItemType Directory -Path $mariaBin | Out-Null
    [IO.File]::WriteAllText((Join-Path $mariaBin 'mariadb.exe'), '')
    $DatabaseRole = 'Runtime'
    $CheckConnection = $true
    $script:databaseRunning = $true
    $script:clientFails = $false
    $script:clientCalls = 0
    $script:privateOptionPath = $null
    $script:fixturePassword = 'dummy "quoted" \ secret' + [char]0x00e4
    function Get-OwnedProcess([string]$Name) {
        if ($Name -eq 'mariadb' -and !$script:databaseRunning) { return $null }
        return [pscustomobject]@{ Id = -1 }
    }
    function Get-LocalPassword([string]$Role) {
        Assert ($Role -ceq $DatabaseRole) 'DB login decrypts only the selected role'
        return $script:fixturePassword
    }
    function Invoke-DatabaseClient([string]$Executable, [string[]]$Arguments) {
        $script:clientCalls++
        Assert ($Arguments[0].StartsWith('--defaults-file=')) 'private options file is the first client argument'
        Assert (!(($Arguments -join ' ').Contains($script:fixturePassword)) -and !(($Arguments -join ' ') -match '--password')) 'password is absent from client arguments'
        $script:privateOptionPath = $Arguments[0].Substring('--defaults-file='.Length)
        $expected = "[client]`npassword=`"dummy \`"quoted\`" \\ secret" + [char]0x00e4 + "`"`n"
        Assert ([IO.File]::ReadAllText($script:privateOptionPath) -ceq $expected) 'quoted option password round-trips as UTF-8'
        $acl = Get-Acl -LiteralPath (Split-Path -Parent $script:privateOptionPath)
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
        Assert ($acl.AreAccessRulesProtected -and $rules.Count -eq 1 -and $rules[0].IdentityReference.Value -eq $sid) 'credential directory allows only the current Windows identity'
        $fileRules = @((Get-Acl -LiteralPath $script:privateOptionPath).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
        Assert ($fileRules.Count -eq 1 -and $fileRules[0].IdentityReference.Value -eq $sid) 'credential file inherits the restricted access rule'
        Assert ('--host=127.0.0.1' -in $Arguments -and '--port=3307' -in $Arguments -and '--database=api_laverda_local' -in $Arguments) 'DB login is fixed to the local development DB'
        $expectedUser = @{ Runtime = 'laverda_api_local'; Import = 'laverda_import_local'; Admin = 'root' }[$DatabaseRole]
        Assert (("--user=$expectedUser") -in $Arguments -and '--safe-updates' -in $Arguments) 'selected DB role and safe updates applied'
        if ($CheckConnection) { Assert ('--execute' -in $Arguments -and $Arguments[-1].StartsWith('SELECT DATABASE()')) 'connection check uses a fixed read-only query' }
        else { Assert ('--execute' -notin $Arguments) 'normal login leaves an interactive SQL console' }
        if ($script:clientFails) { throw 'expected client failure' }
    }
    Open-LocalDatabase
    Assert (!(Test-Path -LiteralPath $script:privateOptionPath) -and !(Test-Path -LiteralPath (Split-Path -Parent $script:privateOptionPath))) 'private credential file and directory cleaned after success'
    $DatabaseRole = 'Import'
    $CheckConnection = $false
    Open-LocalDatabase
    $DatabaseRole = 'Admin'
    $script:clientFails = $true
    try { Open-LocalDatabase; throw 'client failure accepted' }
    catch { Assert ($_.Exception.Message -ceq 'expected client failure') 'DB client error is propagated' }
    Assert (!(Test-Path -LiteralPath $script:privateOptionPath)) 'credential file cleaned after client error'
    $script:databaseRunning = $false
    try { Open-LocalDatabase; throw 'stopped DB accepted' }
    catch { Assert ($_.Exception.Message -like 'Start this local database*') 'DB login refuses a stopped or foreign DB without starting it' }
    Assert ($script:clientCalls -eq 3) 'no client launched for a stopped DB'

    $script:sequence = @()
    function Stop-LocalStack { $script:sequence += 'stop' }
    function Start-LocalStack { $script:sequence += 'start' }
    function Show-LocalStatus { $script:sequence += 'status' }
    Restart-LocalStack
    Assert (($script:sequence -join ',') -ceq 'stop,start,status') 'Restart stops before starting and displaying status'
    $script:sequence = @()
    function Stop-LocalStack { throw 'expected stop failure' }
    try { Restart-LocalStack; throw 'failed restart accepted' }
    catch { Assert ($_.Exception.Message -ceq 'expected stop failure' -and $script:sequence.Count -eq 0) 'Restart aborts before starting when stop fails' }

    $script:appCommands = @()
    $script:failCommand = ''
    function Invoke-AppCommand([string]$Executable, [string[]]$Arguments) {
        $command = $Arguments -join ' '
        $script:appCommands += $command
        if ($command -ceq $script:failCommand) { throw 'expected command failure' }
    }
    Update-AppSnapshot
    Assert (($script:appCommands -join ',') -ceq 'run data:generate,run data:check') 'Snapshot generates before checking the test fixture'
    $script:appCommands = @()
    $script:failCommand = 'run data:generate'
    try { Update-AppSnapshot; throw 'failed snapshot accepted' }
    catch { Assert ($_.Exception.Message -ceq 'expected command failure' -and $script:appCommands.Count -eq 1) 'Snapshot aborts when generation fails' }
    $script:appCommands = @()
    $script:failCommand = 'run verify'
    try { Test-AppSources; Export-AppBundles; throw 'failed verify accepted' }
    catch { Assert ($_.Exception.Message -ceq 'expected command failure' -and $script:appCommands.Count -eq 1) 'Verify stops before package check or export on failure' }
    $script:appCommands = @()
    $script:failCommand = ''
    Test-AppSources
    Export-AppBundles
    Assert ($script:appCommands.Count -eq 4 -and $script:appCommands[0] -ceq 'run verify' -and $script:appCommands[1] -ceq 'run format:check' -and $script:appCommands[2].EndsWith('install --check') -and $script:appCommands[3].EndsWith('export --platform android --platform ios --max-workers 2')) 'Verify includes checks and both bundle exports in order'

    $appRoot = Join-Path $scratch 'gradle-fixture'
    $fixtureAndroid = Join-Path $appRoot 'android'
    New-Item -ItemType Directory -Path $fixtureAndroid -Force | Out-Null
    $wrapper = Join-Path $fixtureAndroid 'gradlew.bat'
    $batch = "@echo off`r`nif not `"%~1`"==`"--stop`" exit /b 23`r`nif not `"%CD%`"==`"%LAVERDA_TEST_GRADLE_DIR%`" exit /b 24`r`nif not `"%JAVA_HOME%`"==`"%LAVERDA_TEST_GRADLE_JAVA%`" exit /b 25`r`nexit /b 0`r`n"
    [IO.File]::WriteAllText($wrapper, $batch, [Text.ASCIIEncoding]::new())
    function Get-JavaDirectory { return (Join-Path $scratch 'dummy-jdk') }
    $beforeGradle = (Get-Location).Path
    $previousJava = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Process')
    Use-AppEnvironment @{ LAVERDA_TEST_GRADLE_DIR = $fixtureAndroid; LAVERDA_TEST_GRADLE_JAVA = (Get-JavaDirectory) } { Stop-AppGradle }
    Assert ((Get-Location).Path -ceq $beforeGradle -and [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Process') -ceq $previousJava) 'Gradle wrapper runs in Android with temporary JDK and restores the shell'
    Remove-Item -LiteralPath $wrapper
    try { Stop-AppGradle; throw 'missing Gradle accepted' }
    catch { Assert ($_.Exception.Message -like 'No generated Android project*') 'GradleStop refuses a missing wrapper without downloading Gradle' }
    $appRoot = $originalAppRoot

    # Exercise the actual Android build sequence without Gradle, prebuild or a phone.
    $script:androidCommands = @()
    $script:deviceResolutions = 0
    $script:disconnectAfterPrebuild = $false
    $script:prebuildFails = $false
    function Get-OwnedMetro { return [pscustomobject]@{ Id = -1 } }
    function Test-MetroPort { return $true }
    function Get-ExpoDeviceName([string]$Serial) {
        Assert ($Serial -ceq 'fixture-phone') 'Android resolves the same serial used for USB forwarding'
        $script:deviceResolutions++
        if ($script:disconnectAfterPrebuild -and $script:deviceResolutions -eq 2) { throw 'expected disconnected phone' }
        return 'Pixel_8_Pro'
    }
    function Invoke-AndroidStep([string]$Executable, [string[]]$Arguments, [string]$LogPath) {
        $script:androidCommands += ,$Arguments
        Assert ($env:EXPO_PUBLIC_API_URL -ceq 'http://127.0.0.1:8080') 'Android builds use the temporary local API origin'
        if ($script:prebuildFails) { throw 'expected prebuild failure' }
    }
    Build-AppAndroid
    Assert ($script:androidCommands.Count -eq 2 -and $script:deviceResolutions -eq 2) 'Android checks the target before and after prebuild'
    Assert (($script:androidCommands[0] | Select-Object -Skip 1) -join ' ' -ceq 'prebuild --platform android --no-install') 'Android keeps the existing non-clean prebuild arguments'
    Assert (($script:androidCommands[1] | Select-Object -Skip 1) -join ' ' -ceq 'run:android --device Pixel_8_Pro --no-bundler') 'Android passes the Expo name rather than serial without conflicting port flags'
    $script:androidCommands = @()
    $script:deviceResolutions = 0
    $script:disconnectAfterPrebuild = $true
    try { Build-AppAndroid; throw 'disconnected build accepted' }
    catch { Assert ($_.Exception.Message -ceq 'expected disconnected phone' -and $script:androidCommands.Count -eq 1) 'Android does not install after the selected phone disconnects' }
    $script:androidCommands = @()
    $script:deviceResolutions = 0
    $script:disconnectAfterPrebuild = $false
    $script:prebuildFails = $true
    try { Build-AppAndroid; throw 'failed prebuild accepted' }
    catch { Assert ($_.Exception.Message -ceq 'expected prebuild failure' -and $script:androidCommands.Count -eq 1 -and $script:deviceResolutions -eq 1) 'Android stops before install if prebuild fails' }
    Write-Output ('PASS ' + $checks + ' local helper checks; PowerShell ' + $PSVersionTable.PSVersion.ToString())
} finally {
    foreach ($worker in $workers) { if (!$worker.HasExited) { Stop-Process -Id $worker.Id -Force; [void]$worker.WaitForExit(5000) } }
    Remove-Item Env:LAVERDA_TEST_RESTORE -ErrorAction SilentlyContinue
    $safePrefix = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'laverda-local-tools-'))
    if (![IO.Path]::GetFullPath($scratch).StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe fixture cleanup path' }
    Remove-Item -LiteralPath $scratch -Recurse -Force
}
