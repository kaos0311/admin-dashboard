Set-Location "D:\projects\admin-dashboard"
Write-Host "=== full stack trace ==="
$env:NODE_OPTIONS = "--stack-trace-limit=80"
node node_modules/vitest/vitest.mjs run src/test-utils/smoke.test.ts 2>&1 | Select-Object -First 120