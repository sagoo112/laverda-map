# Creates a private SQL file for phpMyAdmin without starting a database or server.
[CmdletBinding()]
param([string]$Tenant = 'laverda')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$phpExe = Join-Path $projectRoot '.local-tools\php\php.exe'
if (!(Test-Path -LiteralPath $phpExe)) { throw 'Install the portable PHP runtime in .local-tools/php first.' }
$first = Read-Host 'New club passphrase (15-72 UTF-8 bytes)' -AsSecureString
$second = Read-Host 'Repeat club passphrase' -AsSecureString
$firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
$previousOutputEncoding = $OutputEncoding
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer)
    $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)
    if ($plain -cne $confirmation) { throw 'Passphrases do not match.' }
    # Windows PowerShell otherwise replaces non-ASCII passphrase characters in native pipes.
    $OutputEncoding = [Text.UTF8Encoding]::new($false)
    $sql = @($plain, $confirmation) | & $phpExe (Join-Path $PSScriptRoot 'set-password.php') $Tenant --sql
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate password SQL.' }
    $directory = Join-Path $projectRoot '.local-tools'
    $target = Join-Path $directory 'club-password-private.sql'
    [IO.File]::WriteAllText($target, ($sql -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
    Write-Host "Private SQL created: $target"
    Write-Host 'After migration and tenant import, import this file using phpMyAdmin. Never publish or commit it.'
} finally {
    $OutputEncoding = $previousOutputEncoding
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer)
    $first.Dispose(); $second.Dispose()
    Remove-Variable plain, confirmation -ErrorAction SilentlyContinue
}
