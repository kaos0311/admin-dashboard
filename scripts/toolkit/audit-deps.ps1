#Requires -Version 5.1
<#
.SYNOPSIS
    Audits npm dependencies for known vulnerabilities and outdated packages.
.DESCRIPTION
    Runs `npm audit` in the project root and (optionally) in the functions/
    sub-package.  Also runs `npm outdated` to show packages that have newer
    versions available.  The audit uses the production dependency tree by
    default; use -IncludeDev to also audit devDependencies.
.PARAMETER IncludeFunctions
    Also audit the functions/ sub-package (default: true).
.PARAMETER IncludeDev
    Include devDependencies in the audit (default: false - production only).
.PARAMETER Outdated
    Also run `npm outdated` to list packages with newer versions.
.PARAMETER Fix
    Attempt to automatically fix vulnerabilities with `npm audit fix`.
.EXAMPLE
    .\scripts\toolkit\audit-deps.ps1
    Audit production dependencies in both packages.
.EXAMPLE
    .\scripts\toolkit\audit-deps.ps1 -IncludeDev -Outdated
    Full audit including dev deps and outdated check.
.NOTES
    Exit code 0 = no vulnerabilities found; 1 = vulnerabilities found or fix failed.
#>
[CmdletBinding()]
param(
    [bool]$IncludeFunctions = $true,
    [switch]$IncludeDev,
    [switch]$Outdated,
    [switch]$Fix
)

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "Dependency Audit - Security & Outdated Packages"

$auditLevel = if ($IncludeDev) { "" } else { "--omit=dev" }
$allExitCodes = @()
$labels = @()

# ---------------------------------------------------------------------------
# Helper: run audit + outdated for a single package
# ---------------------------------------------------------------------------
function Invoke-AuditForPackage {
    param(
        [string]$Dir,
        [string]$Label
    )

    if (-not (Test-Path (Join-Path $Dir "package.json"))) {
        Write-WarningItem "$Label - no package.json, skipping."
        return 0
    }

    Write-SubHeader "$Label"

    # --- npm audit ---
    $auditCmd = "npm audit"
    if ($auditLevel) { $auditCmd += " $auditLevel" }
    if ($Fix) {
        $auditCmd = "npm audit fix"
        if ($auditLevel) { $auditCmd += " $auditLevel" }
        Write-Step "Running npm audit fix in $Dir ..."
    } else {
        Write-Step "Running npm audit in $Dir ..."
    }

    $auditCode = Invoke-ToolCommand -Command $auditCmd -WorkingDirectory $Dir
    if ($auditCode -eq 0) {
        Write-Success "No vulnerabilities found."
    } else {
        Write-WarningItem "Vulnerabilities detected (exit code $auditCode)."
    }

    # --- npm outdated (optional) ---
    $outdatedCode = 0
    if ($Outdated -and -not $Fix) {
        Write-Step "Checking for outdated packages in $Dir ..."
        # npm outdated returns exit code 1 if any outdated packages exist
        $outdatedCode = Invoke-ToolCommand -Command "npm outdated" -WorkingDirectory $Dir
        if ($outdatedCode -ne 0) {
            Write-Info "Outdated packages found (this is informational only)."
        } else {
            Write-Success "All packages are up to date."
        }
        # outdated is informational - don't fail the script for it
        $outdatedCode = 0
    }

    return $auditCode
}

# ---------------------------------------------------------------------------
# Main application
# ---------------------------------------------------------------------------
$mainCode = Invoke-AuditForPackage -Dir (Get-ProjectRoot) -Label "Main Application"
$allExitCodes += $mainCode
$labels += "Main application audit"

# ---------------------------------------------------------------------------
# Cloud Functions
# ---------------------------------------------------------------------------
if ($IncludeFunctions) {
    $funcDir = Get-FunctionsDir
    if (Test-Path $funcDir) {
        $funcCode = Invoke-AuditForPackage -Dir $funcDir -Label "Cloud Functions"
        $allExitCodes += $funcCode
        $labels += "Cloud Functions audit"
    } else {
        Write-WarningItem "functions/ directory not found - skipping."
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Exit-WithSummary -Title "Dependency Audit Summary" -ExitCodes $allExitCodes -Labels $labels