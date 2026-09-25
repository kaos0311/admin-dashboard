Set-Location "D:\projects\admin-dashboard"
$env:NODE_OPTIONS = "--stack-trace-limit=80"
npx vitest run src/test-utils/smoke.test.ts 2>&1 | Out-String | Write-Output