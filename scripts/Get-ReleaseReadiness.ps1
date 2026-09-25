#Requires -Version 7.0
<#
.SYNOPSIS
    Pre-release gate: verifies a clean tree and a passing validation pipeline.
.DESCRIPTION
    Runs a release-readiness gate that combines Git hygiene checks with the
    Invoke-ProjectValidation.ps1 pipeline. This script NEVER commits, pushes,
    deploys, or modifies Git history - it only inspects and reports.

    Checks performed (in order):
      1. Git working tree is clean (unless -AllowDirty is provided)
      2. Current branch and latest commit reported
      3. Untracked files checked and reported
      4. Staged-but-uncommitted files checked and reported
      5. Modified files checked and reported
      6. Invoke-ProjectValidation.ps1 runs (lint, typecheck, build, functions build)

    Exit code 0 is returned ONLY when all required checks pass. When -AllowDirty
    is provided, the dirty-tree check is downgraded from a hard failure to a
    warning, but the validation pipeline must still pass.
.PARAMETER AllowDirty
    Allow the gate to proceed even when the Git working tree is not clean.
    Useful when validating newly added, uncommitted files (e.g., new scripts).
    The dirty state is still reported as a warning.
.PARAMETER SkipLint
    Forwarded to Invoke-ProjectValidation.ps1.
.PARAMETER SkipTypecheck
    Forwarded to Invoke-ProjectValidation.ps1.
.PARAMETER SkipBuild
    Forwarded to Invoke-ProjectValidation.ps1.
.PARAMETER SkipFunctions
    Forwarded to Invoke-ProjectValidation.ps1.
.EXAMPLE
    .\scripts\Get-ReleaseReadiness.ps1
    Run the full release gate (requires a clean tree).
.EXAMPLE
    .\scripts\Get-ReleaseReadiness.ps1 -AllowDirty
    Run the gate but allow an unclean working tree (validation must still pass).
.EXAMPLE
    .\scripts\Get-ReleaseReadiness.ps1 -AllowDirty -SkipBuild
    Allow dirty tree and skip the Next.js build and functions build.
.NOTES
    Exit code: 0 = all required checks passed; non-zero = a check failed.
    This script does not commit, push, deploy, or modify Git history.
#>
[CmdletBinding()]
param(
    [switch]$AllowDirty,
    [switch]$SkipLint,
    [switch]$SkipTypecheck,
    [switch]$SkipBuild,
    [switch]$SkipFunctions
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Project root resolution (this script lives at <root>\scripts\)
# ---------------------------------------------------------------------------
$script:ProjectRoot = if ($PSScriptRoot) {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
} else {
    (Get-Location).Path
}
$script:ValidationScript = Join-Path $PSScriptRoot 'Invoke-ProjectValidation.ps1'

# ---------------------------------------------------------------------------
# Output helpers (self-contained)
# ---------------------------------------------------------------------------
function Write-SectionHeader {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ''
    Write-Host ('=' * 72) -ForegroundColor DarkCyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 72) -ForegroundColor DarkCyan
}

function Write-SubHeader {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ''
    Write-Host "--- $Title ---" -ForegroundColor DarkCyan
}

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host ''
    Write-Host ">> $Message" -ForegroundColor White
}

function Write-Success {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [PASS] $Message" -ForegroundColor Green
}

function Write-Failure {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
}

function Write-Warn {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [i]   $Message" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Safe command runner: returns trimmed [string], never throws.
# ---------------------------------------------------------------------------
function Invoke-SafeCommand {
    param([Parameter(Mandatory)][string]$Command)
    $output = cmd /c "$Command 2>&1"
    return ($output -join "`n").Trim()
}

# ---------------------------------------------------------------------------
# Results tracking (script-scoped so Add-Result can mutate them)
# ---------------------------------------------------------------------------
$script:results = [System.Collections.Generic.List[hashtable]]::new()
$script:firstFailureCode = 0

function Add-Result {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][bool]$Passed,
        [int]$Code = 0
    )
    $script:results.Add(@{ Name = $Name; Passed = $Passed; Code = $Code })
    if (-not $Passed -and $script:firstFailureCode -eq 0) {
        $script:firstFailureCode = $Code
    }
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
Write-SectionHeader 'Release Readiness Gate'

# ---------------------------------------------------------------------------
# 1. Git repository present
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 1: Git Repository'

$gitDir = Join-Path $script:ProjectRoot '.git'
if (-not (Test-Path -LiteralPath $gitDir)) {
    Write-Failure "Not a git repository (no .git at $script:ProjectRoot)"
    Add-Result -Name 'Git repository present' -Passed $false -Code 1
    # Cannot continue without a repo
    Write-SectionHeader 'Release Readiness Summary'
    foreach ($r in $script:results) {
        if ($r.Passed) { Write-Success $r.Name } else { Write-Failure "$($r.Name) (exit $($r.Code))" }
    }
    Write-Host ''
    Write-Failure 'RELEASE NOT READY'
    exit 1
} else {
    Write-Success 'Git repository present'
    Add-Result -Name 'Git repository present' -Passed $true
}

# ---------------------------------------------------------------------------
# 2. Branch and latest commit
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 2: Branch and Latest Commit'

$branch = Invoke-SafeCommand 'git rev-parse --abbrev-ref HEAD'
$commitShort = Invoke-SafeCommand 'git rev-parse --short HEAD'
$commitFull = Invoke-SafeCommand 'git rev-parse HEAD'

Write-Info "Current branch:  $branch"
Write-Info "Latest commit:   $commitShort"
Write-Info "Full commit SHA: $commitFull"
Add-Result -Name 'Branch and commit reported' -Passed $true

# ---------------------------------------------------------------------------
# 3. Working tree cleanliness (unless -AllowDirty)
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 3: Working Tree Cleanliness'

$statusOut = Invoke-SafeCommand 'git status --porcelain'
$statusLines = $statusOut -split "`n" | Where-Object { $_.Trim() }
$isClean = ($statusLines.Count -eq 0)

if ($isClean) {
    Write-Success 'Working tree is clean'
    Add-Result -Name 'Working tree clean' -Passed $true
} else {
    if ($AllowDirty) {
        Write-Warn "Working tree is dirty ($($statusLines.Count) change(s)) - allowed via -AllowDirty"
        Add-Result -Name 'Working tree clean (allowed dirty)' -Passed $true
    } else {
        Write-Failure "Working tree is dirty ($($statusLines.Count) change(s)) - use -AllowDirty to override"
        $statusLines | Select-Object -First 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkRed }
        if ($statusLines.Count -gt 15) { Write-Info "    ... and $($statusLines.Count - 15) more" }
        Add-Result -Name 'Working tree clean' -Passed $false -Code 1
    }
}

# ---------------------------------------------------------------------------
# 4. Untracked files
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 4: Untracked Files'

$untracked = @()
foreach ($line in $statusLines) {
    if ($line.Length -ge 3 -and $line.Substring(0, 2) -match '^\?\?') {
        $untracked += $line.Substring(3).Trim()
    }
}

if ($untracked.Count -eq 0) {
    Write-Success 'No untracked files'
} else {
    Write-Warn "$($untracked.Count) untracked file(s):"
    $untracked | Select-Object -First 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
    if ($untracked.Count -gt 15) { Write-Info "    ... and $($untracked.Count - 15) more" }
}
# Untracked files are reported; they only fail the gate when not -AllowDirty
if ($untracked.Count -gt 0 -and -not $AllowDirty) {
    Add-Result -Name 'No untracked files' -Passed $false -Code 1
} else {
    Add-Result -Name 'No untracked files' -Passed $true
}

# ---------------------------------------------------------------------------
# 5. Staged but uncommitted files
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 5: Staged but Uncommitted Files'

$staged = @()
foreach ($line in $statusLines) {
    if ($line.Length -ge 3 -and $line.Substring(0, 2) -match '^[MADRC]') {
        $staged += $line.Substring(3).Trim()
    }
}

if ($staged.Count -eq 0) {
    Write-Success 'No staged-but-uncommitted files'
} else {
    Write-Warn "$($staged.Count) staged-but-uncommitted file(s):"
    $staged | Select-Object -First 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
    if ($staged.Count -gt 15) { Write-Info "    ... and $($staged.Count - 15) more" }
}
if ($staged.Count -gt 0 -and -not $AllowDirty) {
    Add-Result -Name 'No staged-but-uncommitted files' -Passed $false -Code 1
} else {
    Add-Result -Name 'No staged-but-uncommitted files' -Passed $true
}

# ---------------------------------------------------------------------------
# 6. Modified files (unstaged)
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 6: Modified Files (unstaged)'

$modified = @()
foreach ($line in $statusLines) {
    if ($line.Length -ge 3 -and $line.Substring(0, 2) -match '^.[MADRC]') {
        $modified += $line.Substring(3).Trim()
    }
}

if ($modified.Count -eq 0) {
    Write-Success 'No modified files'
} else {
    Write-Warn "$($modified.Count) modified file(s):"
    $modified | Select-Object -First 15 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
    if ($modified.Count -gt 15) { Write-Info "    ... and $($modified.Count - 15) more" }
}
if ($modified.Count -gt 0 -and -not $AllowDirty) {
    Add-Result -Name 'No modified files' -Passed $false -Code 1
} else {
    Add-Result -Name 'No modified files' -Passed $true
}

# ---------------------------------------------------------------------------
# 7. Validation pipeline (Invoke-ProjectValidation.ps1)
# ---------------------------------------------------------------------------
Write-SubHeader 'Check 7: Validation Pipeline'

if (-not (Test-Path -LiteralPath $script:ValidationScript)) {
    Write-Failure "Validation script not found: $script:ValidationScript"
    Add-Result -Name 'Validation pipeline' -Passed $false -Code 1
} else {
    Write-Step "Running Invoke-ProjectValidation.ps1 ..."
    $validationArgs = @()
    if ($SkipLint)       { $validationArgs += '-SkipLint' }
    if ($SkipTypecheck)  { $validationArgs += '-SkipTypecheck' }
    if ($SkipBuild)      { $validationArgs += '-SkipBuild' }
    if ($SkipFunctions)  { $validationArgs += '-SkipFunctions' }

    $validationCode = 0
    try {
        if ($validationArgs.Count -gt 0) {
            & $script:ValidationScript @validationArgs
        } else {
            & $script:ValidationScript
        }
        $validationCode = $LASTEXITCODE
    } catch {
        Write-Failure "Validation pipeline threw an error: $($_.Exception.Message)"
        $validationCode = 1
    }

    if ($validationCode -eq 0) {
        Write-Success 'Validation pipeline passed'
        Add-Result -Name 'Validation pipeline' -Passed $true
    } else {
        Write-Failure "Validation pipeline failed (exit $validationCode)"
        Add-Result -Name 'Validation pipeline' -Passed $false -Code $validationCode
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-SectionHeader 'Release Readiness Summary'

$passedCount = 0
$failedCount = 0
foreach ($r in $script:results) {
    if ($r.Passed) {
        Write-Success $r.Name
        $passedCount++
    } else {
        Write-Failure "$($r.Name) (exit $($r.Code))"
        $failedCount++
    }
}

Write-Host ''
Write-Info "Passed: $passedCount"
Write-Info "Failed: $failedCount"
Write-Info "Branch: $branch"
Write-Info "Commit: $commitShort"
Write-Host ''

if ($failedCount -eq 0) {
    Write-Success 'ALL REQUIRED CHECKS PASSED - RELEASE READY'
    exit 0
} else {
    Write-Failure "RELEASE NOT READY - $failedCount check(s) failed (first failure exit code: $($script:firstFailureCode))"
    if ($script:firstFailureCode -eq 0) { $script:firstFailureCode = 1 }
    exit $script:firstFailureCode
}