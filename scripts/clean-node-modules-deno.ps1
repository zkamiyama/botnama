# Clean the node_modules/.deno cache to avoid broken symlinks and stale caches
param(
  [switch]$WhatIf
)

$nmDenoPath = Join-Path (Get-Location) 'node_modules' '.deno'
if (-not (Test-Path $nmDenoPath)) {
  Write-Host "No node_modules/.deno directory found; nothing to clean" -ForegroundColor Yellow
  return
}

$backup = "$nmDenoPath.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if ($WhatIf) {
  Write-Host "Would backup $nmDenoPath -> $backup" -ForegroundColor Yellow
  return
}

Write-Host "Backing up $nmDenoPath -> $backup" -ForegroundColor Cyan
try {
  Move-Item -Path $nmDenoPath -Destination $backup -Force -ErrorAction Stop
} catch {
  Write-Host "Move-Item failed (falling back to Robocopy copy): $($_.Exception.Message)" -ForegroundColor Yellow
  # Use robocopy to reliably copy deep paths / symlinks
  $robocopyCmd = "robocopy `"$($nmDenoPath)`" `"$($backup)`" /E /COPYALL /NFL /NDL /NJH /NJS"
  Write-Host "Running: $robocopyCmd" -ForegroundColor Cyan
  $rec = cmd.exe /c $robocopyCmd
  # Then remove original folder (attempt to fix attributes if necessary)
  Write-Host "Removing original $nmDenoPath" -ForegroundColor Cyan
  Try { Remove-Item -Path $nmDenoPath -Recurse -Force -ErrorAction Stop } Catch { Write-Host "Remove-Item failed: $($_.Exception.Message)" -ForegroundColor Yellow }
}

Write-Host "Cleaning node_modules/.deno (deleted) and regenerating Deno cache" -ForegroundColor Cyan
# Rebuild cache via deno cache command
# Note: cache may re-populate `node_modules/.deno` on demand
& deno cache src/server.ts

Write-Host "Done. If you want to fully remove the backup, delete $backup manually when ready." -ForegroundColor Green
