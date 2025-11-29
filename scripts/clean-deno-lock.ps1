# Remove specified npm package entries from deno.lock (Windows PowerShell)
# Usage: .\scripts\clean-deno-lock.ps1
# This script will:
# - Backup deno.lock
# - Remove specifiers and npm entries for the specified packages
# - Keep comments and formatting minimal

param(
    [switch]$WhatIf
)

$packages = @('better-sqlite3')
$lockPath = Join-Path (Get-Location) 'deno.lock'
if (-not (Test-Path $lockPath)) {
    Write-Host "No deno.lock found at $lockPath" -ForegroundColor Yellow
    return
}

$backup = "$lockPath.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if ($WhatIf) {
    Write-Host "Would backup $lockPath to $backup (WhatIf)"
}
else {
    Copy-Item -Path $lockPath -Destination $backup -Force
    Write-Host "Backed up deno.lock -> $backup"
}

# Read file and perform simple JSON edits: remove the specifier lines and npm entries for packages
$content = Get-Content -Raw -Path $lockPath
$json = $content | ConvertFrom-Json

foreach ($pkg in $packages) {
    $specifierKey = "npm:$pkg@*"
    # Remove specifier mapping if present
    $keysToRemove = @()
    foreach ($k in $json.specifiers.PSObject.Properties.Name) {
        if ($k -match "^npm:$pkg@") { $keysToRemove += $k }
    }
    foreach ($k in $keysToRemove) {
        Write-Host "Removing specifier: $k"
        $json.specifiers.PSObject.Properties.Remove($k)
    }
    # Remove npm entries that exactly match package@version
    $npmKeysToRemove = @()
    foreach ($k in $json.npm.PSObject.Properties.Name) {
        if ($k -match "^$pkg@") { $npmKeysToRemove += $k }
    }
    foreach ($k in $npmKeysToRemove) {
        Write-Host "Removing npm entry: $k"
        $json.npm.PSObject.Properties.Remove($k)
    }
}

if ($WhatIf) {
    Write-Host "Would write updated deno.lock (WhatIf)" -ForegroundColor Yellow
    return
}

# Write updated JSON back
$updated = $json | ConvertTo-Json -Depth 8
$updated | Out-File -FilePath $lockPath -Encoding UTF8 -Force
Write-Host "deno.lock updated. Please re-run 'deno cache' to ensure consistency." -ForegroundColor Green

# Also ensure node_modules does not contain the package
foreach ($pkg in $packages) {
    $pkgPath = Join-Path (Join-Path (Get-Location) 'node_modules') $pkg
    if (Test-Path $pkgPath) {
        Write-Host "Removing node_modules/$pkg (cleanup)"
        Remove-Item -Recurse -Path $pkgPath -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Done." -ForegroundColor Green
