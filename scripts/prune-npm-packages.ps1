# Remove specific npm packages from root node_modules
# Usage: .\scripts\prune-npm-packages.ps1 [-WhatIf] [-ShowMissing]
# By default, missing packages are silently skipped. Pass `-ShowMissing` to print 'Not found' messages.
param(
    [switch]$WhatIf,
    [switch]$ShowMissing
)

$packages = @('puppeteer','puppeteer-core','chromium-bidi','better-sqlite3','puppeteer-extra','puppeteer-extra-plugin-stealth')
$root = Get-Location
$nmDir = Join-Path $root 'node_modules'
if (-not (Test-Path $nmDir)) {
    Write-Host "No root node_modules present" -ForegroundColor Yellow
    return
}

foreach ($pkg in $packages) {
    $path = Join-Path $nmDir $pkg
    if (Test-Path $path) {
        if ($WhatIf) { Write-Host "Would remove: $path" }
        else {
            Write-Host "Removing: $path"
            Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        if ($ShowMissing) { Write-Host "Not found (skipping): $pkg" }
    }
}

# Also try to remove @puppeteer and other nested directories matching the names
$nested = Get-ChildItem -Path $nmDir -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -in $packages }
foreach ($d in $nested) {
    if ($WhatIf) { Write-Host "Would remove nested candidate: $($d.FullName)" }
    else {
        Write-Host "Removing nested candidate: $($d.FullName)" 
        Remove-Item -Path $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Attempt to run a cache call to refresh deno.lock (best-effort)
Write-Host "Refreshing cache (best-effort): deno cache src/server.ts" -ForegroundColor Cyan
& deno cache src/server.ts
Write-Host "Done. Consider regenerating lock file if using a deno version that supports lock creation." -ForegroundColor Green
