$colorPattern = 'text-white|text-slate|text-zinc|text-gray|text-neutral|bg-black|bg-white|border-white'

$results =
Get-ChildItem app -Recurse -Include *.ts,*.tsx |
Select-String $colorPattern |
Group-Object Path |
Sort-Object Count -Descending |
Select-Object Count,Name

$total =
Get-ChildItem app -Recurse -Include *.ts,*.tsx |
Select-String $colorPattern |
Measure-Object

Clear-Host

Write-Host ""
Write-Host "THEME COLOR VIOLATIONS: $($total.Count)" -ForegroundColor Yellow
Write-Host ""

$results | Select-Object -First 25 | Format-Table -AutoSize

$results |
Export-Csv ".\theme-color-offenders.csv" -NoTypeInformation

Write-Host ""
Write-Host "Report written to theme-color-offenders.csv" -ForegroundColor Green
