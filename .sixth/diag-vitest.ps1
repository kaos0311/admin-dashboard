Set-Location "D:\projects\admin-dashboard"
Write-Host "=== node version ==="
node --version
Write-Host "=== npm version ==="
npm --version
Write-Host "=== vitest bin shim ==="
Get-Content "node_modules/.bin/vitest.cmd" -TotalCount 10
Write-Host "=== vitest package engines ==="
if (Test-Path "node_modules/vitest/package.json") {
    node -e "const p=require('./node_modules/vitest/package.json'); console.log(JSON.stringify({version:p.version, engines:p.engines}, null, 2))"
}
if (Test-Path "node_modules/vite/package.json") {
    node -e "const p=require('./node_modules/vite/package.json'); console.log(JSON.stringify({version:p.version, engines:p.engines}, null, 2))"
}
Write-Host "=== root package.json vitest-related ==="
node -e "const p=require('./package.json'); console.log(JSON.stringify({scripts:p.scripts, engines:p.engines, devDependencies:p.devDependencies.dep || null}, null, 2))" 2>&1 | Select-Object -First 60