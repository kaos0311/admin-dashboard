param()
$ErrorActionPreference = "Stop"
$files = @(
  "src/app/(admin)/inventory/hooks/useInventoryActions.ts",
  "src/services/inventory/inventory-scan-resolver.ts",
  "src/services/inventory/inventory-scan-resolver.test.ts"
)
& npx eslint @files --max-warnings=0
Write-Host "ESLINT_EXIT_CODE: $LASTEXITCODE"