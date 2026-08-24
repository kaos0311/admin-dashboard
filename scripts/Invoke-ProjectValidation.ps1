#Requires -Version 7.0
<#
.SYNOPSIS
    Runs the core project validation pipeline (lint, typecheck, build, functions build).
.DESCRIPTION
    Executes the project's validation checks in order and stops immediately when a
    command fails, preserving and reporting the correct exit code.

    Pipeline (in order):
      1. npm run lint          (skippable with -SkipLint)
      2. npm run typecheck     (skippable with -SkipTypecheck)
      3. npm run build         (skippable with -SkipBuild)
      4. Firebase Functions build (npm run build in functions/) - only when
         functions\package.json exists, skippable with -SkipFunctions

    This script does NOT modify any application code, install packages, change npm
    scripts, deploy, or commit. It only runs existing npm scripts and reports results.
.PARAMETER SkipLint
    Skip the `npm run lint` step.
.PARAMETER SkipTypecheck
    Skip the `npm run typecheck` step.
.PARAMETER SkipBuild
    Skip the `npm run build` (Next.js production build) step.
.PARAMETER SkipFunctions
    Skip the Firebase Functions build step.
.EXAMPLE
    .\scripts\Invoke-ProjectValidation.ps1
    Run the full validation pipeline.
.EXAMPLE
    .\scripts\Invoke-ProjectValidation.ps1 -SkipBuild
    Run lint and typecheck only, skipping the Next.js build and functions build.
.EXAMPLE
    .\scripts\Invoke-ProjectValidation.ps1 -SkipFunctions
    Run lint, typecheck, and build, skipping the Cloud Functions build.
.NOTES
    Exit code: 0 = all requested checks passed; non-zero = the exit code of the
    first failed check. Skipped checks are reported as "SKIP" and do not affect
    the exit code.
#>
[CmdletBinding()]
param(
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
$script:FunctionsDir = Join-Path $script:ProjectRoot 'functions'

# ---------------------------------------------------------------------------
# Output helpers (self-contained, no dependency on toolkit-common.ps1)
# ---------------------------------------------------------------------------
function Write-SectionHeader {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ''
    Write-Host ('=' * 72) -ForegroundColor DarkCyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 72) -ForegroundColor DarkCyan
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

function Write-Skip {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [SKIP] $Message" -ForegroundColor DarkYellow
}

function Write-Info {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [i]   $Message" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Run an npm script in a directory and return the exit code.
# Uses cmd /c so that stderr from npm does not trip PowerShell error handling.
# Push-Location/Pop-Location is wrapped in try/finally for safety.
# ---------------------------------------------------------------------------
function Invoke-NpmScriptSafe {
    param(
        [Parameter(Mandatory)][string]$Script,
        [string]$WorkingDirectory = '',
        [Parameter(Mandatory)][string]$Description
    )
    Write-Step $Description

    $targetDir = if ($WorkingDirectory) { $WorkingDirectory } else { $script:ProjectRoot }
    $pkgPath = Join-Path $targetDir 'package.json'
    if (-not (Test-Path -LiteralPath $pkgPath)) {
        Write-Failure "No package.json found in: $targetDir"
        return 1
    }

    try {
        Push-Location -LiteralPath $targetDir
        cmd /c "npm run $Script 2>&1" | Out-Host
        return $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Build the pipeline
# ---------------------------------------------------------------------------
Write-SectionHeader 'Project Validation Pipeline'

$steps = [System.Collections.Generic.List[hashtable]]::new()

if (-not $SkipLint) {
    $steps.Add(@{
        Name        = 'Lint (npm run lint)'
        Script      = 'lint'
        WorkingDir  = ''
        Run         = $true
    })
} else {
    $steps.Add(@{ Name = 'Lint (npm run lint)'; Run = $false })
}

if (-not $SkipTypecheck) {
    $steps.Add(@{
        Name        = 'Typecheck (npm run typecheck)'
        Script      = 'typecheck'
        WorkingDir  = ''
        Run         = $true
    })
} else {
    $steps.Add(@{ Name = 'Typecheck (npm run typecheck)'; Run = $false })
}

if (-not $SkipBuild) {
    $steps.Add(@{
        Name        = 'Build (npm run build)'
        Script      = 'build'
        WorkingDir  = ''
        Run         = $true
    })
} else {
    $steps.Add(@{ Name = 'Build (npm run build)'; Run = $false })
}

# Functions step: only run if functions\package.json exists and not skipped
$functionsPkgExists = Test-Path -LiteralPath (Join-Path $script:FunctionsDir 'package.json')
if (-not $SkipFunctions) {
    if ($functionsPkgExists) {
        $steps.Add(@{
            Name        = 'Functions build (functions/ npm run build)'
            Script      = 'build'
            WorkingDir  = $script:FunctionsDir
            Run         = $true
        })
    } else {
        $steps.Add(@{ Name = 'Functions build (functions/ npm run build)'; Run = $false; Missing = $true })
    }
} else {
    $steps.Add(@{ Name = 'Functions build (functions/ npm run build)'; Run = $false })
}

# ---------------------------------------------------------------------------
# Execute the pipeline - stop immediately on first failure
# ---------------------------------------------------------------------------
$results = [System.Collections.Generic.List[hashtable]]::new()
$firstFailureCode = 0
$stopped = $false

foreach ($step in $steps) {
    if ($stopped) {
        $results.Add(@{ Name = $step.Name; Status = 'NOTRUN'; Code = 0 })
        continue
    }

    if (-not $step.Run) {
        if ($step.ContainsKey('Missing') -and $step.Missing) {
            Write-Info "$($step.Name) - functions\package.json not found, skipping."
            $results.Add(@{ Name = $step.Name; Status = 'SKIP'; Code = 0 })
        } else {
            Write-Skip $step.Name
            $results.Add(@{ Name = $step.Name; Status = 'SKIP'; Code = 0 })
        }
        continue
    }

    $code = Invoke-NpmScriptSafe `
        -Script $step.Script `
        -WorkingDirectory $step.WorkingDir `
        -Description $step.Name

    if ($code -eq 0) {
        $results.Add(@{ Name = $step.Name; Status = 'PASS'; Code = 0 })
    } else {
        $results.Add(@{ Name = $step.Name; Status = "FAIL($code)"; Code = $code })
        $firstFailureCode = $code
        $stopped = $true
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-SectionHeader 'Validation Summary'

$passed = 0
$failed = 0
$skipped = 0
$notrun = 0

foreach ($r in $results) {
    switch ($r.Status) {
        'PASS'  { Write-Success "$($r.Name)"; $passed++ }
        { $_ -like 'FAIL*' } { Write-Failure "$($r.Name) - exit $($r.Code)"; $failed++ }
        'SKIP'  { Write-Skip "$($r.Name)"; $skipped++ }
        'NOTRUN' { Write-Info "$($r.Name) - not run (stopped due to prior failure)"; $notrun++ }
    }
}

Write-Host ''
Write-Info "Passed:   $passed"
Write-Info "Failed:   $failed"
Write-Info "Skipped:  $skipped"
Write-Info "Not run:  $notrun"
Write-Host ''

if ($failed -eq 0) {
    Write-Success 'ALL REQUESTED CHECKS PASSED'
    exit 0
} else {
    Write-Failure "VALIDATION FAILED - first failure exit code: $firstFailureCode"
    exit $firstFailureCode
}