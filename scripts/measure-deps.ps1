# Measure top-level node_modules and node_modules/.deno directory sizes
Write-Host "Top-level node_modules sizes:" -ForegroundColor Cyan
if (Test-Path -Path './node_modules') {
  Get-ChildItem -Path .\node_modules -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $sum = (Get-ChildItem -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeMB = if ($sum) { [math]::Round($sum/1MB,2) } else { 0 }
    [PSCustomObject]@{ Name = $_.Name; SizeMB = $sizeMB }
  } | Sort-Object -Property SizeMB -Descending | Format-Table -AutoSize
} else {
  Write-Host "No node_modules directory present" -ForegroundColor Yellow
}

Write-Host "`nnode_modules/.deno sizes:" -ForegroundColor Cyan
if (Test-Path -Path './node_modules/.deno') {
  Get-ChildItem -Path .\node_modules\.deno -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $sum = (Get-ChildItem -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeMB = if ($sum) { [math]::Round($sum/1MB,2) } else { 0 }
    [PSCustomObject]@{ Name = $_.Name; SizeMB = $sizeMB }
  } | Sort-Object -Property SizeMB -Descending | Format-Table -AutoSize
} else {
  Write-Host "No node_modules/.deno directory present" -ForegroundColor Yellow
}

# Show top big directories within node_modules/.deno
Write-Host "`nTop 20 largest directories under node_modules/.deno (deep)" -ForegroundColor Cyan
if (Test-Path -Path './node_modules/.deno') {
  Get-ChildItem -Path .\node_modules\.deno -Recurse -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $sum = (Get-ChildItem -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{ Path = $_.FullName; SizeMB = if($sum) { [math]::Round($sum/1MB,2) } else { 0 } }
  } | Sort-Object -Property SizeMB -Descending | Select-Object -First 20 | Format-Table -AutoSize
}