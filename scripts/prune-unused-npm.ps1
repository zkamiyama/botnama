# Prune unused npm packages (Windows PowerShell)
# Usage: .\scripts\prune-unused-npm.ps1 [-WhatIf] [-ShowMissing]
# - ShowMissing: print messages about missing packages instead of being silent.
# Usage: .\scripts\prune-unused-npm.ps1
# This script will:
# - Search for usage of a list of npm packages in `src` and `plugins`
# - If not used, backup and delete their directories from root node_modules
# - Run `deno cache --lock=deno.lock --lock-write src/server.ts` to refresh `deno.lock`

param(
    [switch]$WhatIf,
    [switch]$ShowMissing
)

$packagesToCheck = @('puppeteer','puppeteer-core','chromium-bidi','better-sqlite3')
$root = Get-Location
Write-Host "Working root: $root"

# Search for each package in src, plugins, routes, services, websocket, events
$searchPaths = @("src","plugins","routes","services","websocket","events")

$used = @{}
foreach ($pkg in $packagesToCheck) {
    $used[$pkg] = $false
    foreach ($p in $searchPaths) {
        if (Test-Path $p) {
            $matches = Get-ChildItem -Path $p -Recurse -Include *.ts,*.js,*.tsx,*.jsx -ErrorAction SilentlyContinue | Select-String -Pattern $pkg -SimpleMatch
            if ($matches) {
                $used[$pkg] = $true
                break
            }
        }
    }
}

# Show results
Write-Host "Search results:" -ForegroundColor Cyan
foreach ($pkg in $packagesToCheck) {
    Write-Host "  $pkg :" ($used[$pkg] ? 'USED' : 'NOT USED')
}

# Only operate if all are not used (or user approves)
$notUsed = $packagesToCheck | Where-Object { -not $used[$_] }
if ($notUsed.Count -eq 0) {
    Write-Host "No specified npm packages are safe to remove (they appear used in project). Exiting." -ForegroundColor Yellow
    return
}

Write-Host "Packages safe to remove:" -ForegroundColor Green
$notUsed | ForEach-Object { Write-Host "  $_" }

if ($WhatIf) {
    Write-Host "Would remove these packages from root node_modules and update deno.lock (WhatIf)" -ForegroundColor Yellow
    return
}

# If there is a node_modules in repo root
$nmPath = Join-Path $root 'node_modules'
if (Test-Path $nmPath) {
    # Backup
    $backupName = "node_modules.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    $backupPath = Join-Path $root $backupName
    Write-Host "Backing up node_modules -> $backupName"
    Move-Item $nmPath $backupPath -Force

    # Recreate node_modules folder
    New-Item -ItemType Directory -Path $nmPath | Out-Null

    # Now remove each package under backup
    foreach ($pkg in $notUsed) {
        $pkgPath = Join-Path $backupPath $pkg
        if (Test-Path $pkgPath) {
            Write-Host "Removing $pkg from backup node_modules"
            Remove-Item -Path $pkgPath -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            if ($ShowMissing) { Write-Host "$pkg not found in backup node_modules" }
        }
    }

    # Copy rest of modules back
    Write-Host "Restoring remaining modules from backup to node_modules"
    Get-ChildItem -Path $backupPath -Directory | ForEach-Object {
        $dir = $_
        $dest = Join-Path $nmPath $dir.Name
        Write-Host "  Restoring: $($dir.Name)"
        Move-Item $dir.FullName $dest -ErrorAction SilentlyContinue
    }

    # Cleanup: if backup is empty, remove it
    $left = Get-ChildItem -Path $backupPath -Recurse -ErrorAction SilentlyContinue | Measure-Object
    if ($left.Count -eq 0) {
        Write-Host "Backup empty; removing $backupPath"
        Remove-Item -Path $backupPath -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "Backup preserved at $backupPath" -ForegroundColor Yellow
    }
} else {
    if ($ShowMissing) { Write-Host "No root node_modules found; nothing to prune." -ForegroundColor Yellow }
}

# Re-generate deno.lock limited to src/server.ts
Write-Host 'Regenerating deno.lock using `deno cache --lock=deno.lock --lock-write src/server.ts`' -ForegroundColor Cyan
& deno cache --lock=deno.lock --lock-write src/server.ts

Write-Host "Done. Verify changes; run `git status` and test compile and runtime." -ForegroundColor Green
