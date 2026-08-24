#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the Next.js production application.
.DESCRIPTION
    Executes `npm run build` (next build) in the project root, producing the
    .next/ output directory.  This is the production build used for deployment.
    The Cloud Functions build is handled separately by build-functions.ps1.
.EXAMPLE
    .\scripts\toolkit\build.ps1
    Build the Next.js production bundle.
.NOTES
    Exit code 0 = build succeeded; 1 = build failed.
#>
[CmdletBinding()]
param()

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "Next.js - Production Build"

# ---------------------------------------------------------------------------
# Verify node_modules are installed
# ---------------------------------------------------------------------------
$nodeModules = Join-Path (Get-ProjectRoot) "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Step "node_modules not found - running npm install ..."
    $installCode = Invoke-NpmScript -Script "install" -Description "Installing dependencies"
    if ($installCode -ne 0) {
        Write-Failure "npm install failed - cannot proceed with build."
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Run next build
# ---------------------------------------------------------------------------
$buildCode = Invoke-NpmScript -Script "build" `
    -Description "Building Next.js production bundle (next build)"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Exit-WithSummary -Title "Build Summary" -ExitCodes @($buildCode) -Labels @("Next.js production build")