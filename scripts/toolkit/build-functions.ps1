#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the Firebase Cloud Functions TypeScript package.
.DESCRIPTION
    Runs the Cloud Functions build inside the functions/ directory.  By default
    this performs a clean rebuild (rimraf lib && tsc) to ensure stale output is
    removed.  Use -NoClean to skip the clean step and only run tsc.
    The compiled JavaScript is emitted to functions/lib/.
.PARAMETER NoClean
    Skip the `npm run clean` step and only run `tsc` (faster for incremental
    builds but may leave stale files from removed sources).
.PARAMETER Watch
    Start tsc in watch mode for continuous compilation (does not exit).
.EXAMPLE
    .\scripts\toolkit\build-functions.ps1
    Clean rebuild of Cloud Functions.
.EXAMPLE
    .\scripts\toolkit\build-functions.ps1 -NoClean
    Incremental build without cleaning lib/ first.
.NOTES
    Exit code 0 = build succeeded; 1 = build failed.
#>
[CmdletBinding()]
param(
    [switch]$NoClean,
    [switch]$Watch
)

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "Firebase Cloud Functions - Build"

$funcDir = Get-FunctionsDir

if (-not (Test-Path $funcDir)) {
    Write-Failure "functions/ directory not found at: $funcDir"
    exit 1
}

# ---------------------------------------------------------------------------
# Verify functions/node_modules
# ---------------------------------------------------------------------------
$funcNodeModules = Join-Path $funcDir "node_modules"
if (-not (Test-Path $funcNodeModules)) {
    Write-Step "functions/node_modules not found - running npm install ..."
    $installCode = Invoke-NpmScript -Script "install" `
        -WorkingDirectory $funcDir `
        -Description "Installing Cloud Functions dependencies"
    if ($installCode -ne 0) {
        Write-Failure "npm install in functions/ failed - cannot proceed."
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Watch mode (does not exit)
# ---------------------------------------------------------------------------
if ($Watch) {
    Write-Step "Starting Cloud Functions watch mode (tsc --watch) ..."
    $watchCode = Invoke-NpmScript -Script "watch" `
        -WorkingDirectory $funcDir `
        -Description "Watching Cloud Functions (tsc --watch)"
    exit $watchCode
}

# ---------------------------------------------------------------------------
# Clean step (optional)
# ---------------------------------------------------------------------------
$cleanCode = 0
if (-not $NoClean) {
    $cleanCode = Invoke-NpmScript -Script "clean" `
        -WorkingDirectory $funcDir `
        -Description "Cleaning functions/lib/ (rimraf)"
    if ($cleanCode -ne 0) {
        Write-WarningItem "Clean step failed - continuing with build anyway."
    }
}

# ---------------------------------------------------------------------------
# Build step (tsc)
# ---------------------------------------------------------------------------
$buildCode = Invoke-NpmScript -Script "build" `
    -WorkingDirectory $funcDir `
    -Description "Compiling Cloud Functions (tsc)"

# ---------------------------------------------------------------------------
# Verify output
# ---------------------------------------------------------------------------
$libDir = Join-Path $funcDir "lib"
if ($buildCode -eq 0 -and (Test-Path $libDir)) {
    $fileCount = (Get-ChildItem $libDir -Recurse -File).Count
    Write-Info "functions/lib/ contains $fileCount compiled file(s)."
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$labels = @("Cloud Functions build")
if (-not $NoClean) { $labels = @("Clean functions/lib/") + $labels }
Exit-WithSummary -Title "Cloud Functions Build Summary" -ExitCodes @($cleanCode, $buildCode) -Labels $labels