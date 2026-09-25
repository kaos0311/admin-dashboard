param()
$ErrorActionPreference = "Stop"
$hook = "src/app/(admin)/inventory/hooks/useInventoryActions.ts"
$diffStats = & git diff --numstat -- $hook
Write-Host "NUMSTAT:"
Write-Host $diffStats
$headLines = (& git show "HEAD:$hook") | Measure-Object -Line
Write-Host "HEAD_LINES:"
Write-Host $headLines.Lines
$currentLines = Get-Content -Path $hook
Write-Host "CURRENT_LINES:"
Write-Host $currentLines.Count