#Requires -Version 5.1
<#
.SYNOPSIS
    Runs ESLint across the project (and optionally the functions package).
.DESCRIPTION
    Executes `npm run lint` in the project root. With the -IncludeFunctions
    switch it also runs `npm run lint` inside the functions/ directory so that
    Cloud Functions source is checked with its own ESLint config.
.PARAMETER IncludeFunctions
    Also lint the functions/ sub-package.
.PARAMETER Fix
    Pass --fix to ESLint so that auto-fixable problems are corrected.
.EXAMPLE
    .\scripts\toolkit\lint.ps1
    Lint the main application only.
.EXAMPLE
    .\scripts\toolkit\lint.ps1 -IncludeFunctions
    Lint the main application and the Cloud Functions package.
.EXAMPLE
    .\scripts\toolkit\lint.ps1 -Fix
    Lint and auto-fix the main application.
.NOTES
    Exit code 0 = all linting passed; 1 = one or more lint errors.
#>
[CmdletBinding()]
param(
    [switch]$IncludeFunctions,
    [switch]$Fix
)

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "ESLint - Static Analysis"

# ---------------------------------------------------------------------------
# Main application
# ---------------------------------------------------------------------------
$lintArgs = if ($Fix) { "lint -- --fix" } else { "lint" }
$mainCode = Invoke-NpmScript -Script $lintArgs `
    -Description "Linting main application (npm run lint)"

# ---------------------------------------------------------------------------
# Functions sub-package (optional)
# ---------------------------------------------------------------------------
$funcCode = 0
if ($IncludeFunctions) {
    if (Test-Path (Get-FunctionsDir)) {
        $funcLintArgs = if ($Fix) { "lint -- --fix" } else { "lint" }
        $funcCode = Invoke-NpmScript -Script $funcLintArgs `
            -WorkingDirectory (Get-FunctionsDir) `
            -Description "Linting Cloud Functions (functions/ npm run lint)"
    } else {
        Write-WarningItem "functions/ directory not found - skipping."
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$labels = @("Main application lint")
if ($IncludeFunctions) { $labels += "Cloud Functions lint" }
Exit-WithSummary -Title "Lint Summary" -ExitCodes @($mainCode, $funcCode) -Labels $labels