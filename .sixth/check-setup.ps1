Set-Location "D:\projects\admin-dashboard"
Test-Path "src/test-utils/setup.ts"
if (Test-Path "src/test-utils/setup.ts") {
    Get-Content "src/test-utils/setup.ts" -TotalCount 50
}