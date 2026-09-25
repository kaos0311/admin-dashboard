#Requires -Version 5.1
<#
.SYNOPSIS
    Runs TypeScript type-checking for the main app and Cloud Functions.
.DESCRIPTION
    Executes `npm run typecheck` (tsc --noEmit) in the project root and
    `npx tsc --noEmit` inside the functions/ directory.  The main tsconfig.json
    excludes scripts/ and functions/, so each package is checked independently
    with its own compiler options.
.PARAMETER IncludeFunctions
    Also type-check the functions/ sub-package (default: true).
    Use -IncludeFunctions:$false to skip the functions check.
.EXAMPLE
    .\scripts\toolkit\typecheck.ps1
    Type-check both the main application and Cloud Functions.
.NOTES
    Exit code 0 = no type errors; 1 = type errors detected.
#>
[CmdletBinding()]
param(
    [bool]$IncludeFunctions = $true
)

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "TypeScript - Type Checking"

# ---------------------------------------------------------------------------
# Main application  (tsc --noEmit, excludes scripts/ and functions/)
# ---------------------------------------------------------------------------
$mainCode = Invoke-NpmScript -Script "typecheck" `
    -Description "Type-checking main application (tsc --noEmit)"

# ---------------------------------------------------------------------------
# Cloud Functions  (tsc --noEmit using functions/tsconfig.json)
# ---------------------------------------------------------------------------
$funcCode = 0
if ($IncludeFunctions) {
    if (Test-Path (Get-FunctionsDir)) {
        $funcCode = Invoke-ToolCommand -Command "npx tsc --noEmit" `
            -WorkingDirectory (Get-FunctionsDir) `
            -Description "Type-checking Cloud Functions (tsc --noEmit)"
    } else {
        Write-WarningItem "functions/ directory not found - skipping."
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$labels = @("Main application typecheck")
if ($IncludeFunctions) { $labels += "Cloud Functions typecheck" }
Exit-WithSummary -Title "Typecheck Summary" -ExitCodes @($mainCode, $funcCode) -Labels $labels