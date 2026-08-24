#Requires -Version 5.1
<#
.SYNOPSIS
    Shared functions and utilities for the engineering toolkit scripts.
.DESCRIPTION
    This file is dot-sourced by all toolkit scripts. It provides:
      - Color-coded output helpers (Write-SectionHeader, Write-Step, etc.)
      - Project root / functions directory resolution
      - Command existence checks
      - NPM / CLI command runners that capture exit codes reliably
      - A summary helper for pass/fail reporting
.NOTES
    Do not run this file directly - it is meant to be dot-sourced:
        . "$PSScriptRoot\toolkit-common.ps1"
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# ---------------------------------------------------------------------------
# Project path resolution
#   toolkit lives at  <root>/scripts/toolkit/
#   so project root is two levels up from $PSScriptRoot
# ---------------------------------------------------------------------------
if ($PSScriptRoot) {
    $script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
} else {
    $script:ProjectRoot = (Get-Location).Path
}
$script:FunctionsDir  = Join-Path $script:ProjectRoot "functions"
$script:ScriptsDir    = Join-Path $script:ProjectRoot "scripts"
$script:SrcDir        = Join-Path $script:ProjectRoot "src"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function Write-SectionHeader {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor DarkCyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor DarkCyan
}

function Write-SubHeader {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ""
    Write-Host "--- $Title ---" -ForegroundColor DarkCyan
}

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host ""
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

function Write-WarningItem {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [i]   $Message" -ForegroundColor DarkGray
}

function Write-Result {
    param(
        [Parameter(Mandatory)][bool]$Success,
        [Parameter(Mandatory)][string]$Message
    )
    if ($Success) { Write-Success $Message }
    else          { Write-Failure $Message }
}

# ---------------------------------------------------------------------------
# Path accessors
# ---------------------------------------------------------------------------
function Get-ProjectRoot  { return $script:ProjectRoot }
function Get-FunctionsDir { return $script:FunctionsDir }
function Get-ScriptsDir   { return $script:ScriptsDir }
function Get-SrcDir       { return $script:SrcDir }

# ---------------------------------------------------------------------------
# Utility: check whether a command exists on PATH
# ---------------------------------------------------------------------------
function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
# Run an npm script in a given directory and return the exit code.
# Uses cmd /c so that stderr from npm does not trip PowerShell error handling.
# ---------------------------------------------------------------------------
function Invoke-NpmScript {
    param(
        [Parameter(Mandatory)][string]$Script,
        [string]$WorkingDirectory = "",
        [string]$Description = ""
    )
    if ($Description) { Write-Step $Description }

    $targetDir = if ($WorkingDirectory) { $WorkingDirectory } else { $script:ProjectRoot }

    if (-not (Test-Path (Join-Path $targetDir "package.json"))) {
        Write-Failure "No package.json found in: $targetDir"
        return 1
    }

    $originalLocation = Get-Location
    try {
        Push-Location $targetDir
        cmd /c "npm run $Script 2>&1" | Out-Host
        $code = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    return $code
}

# ---------------------------------------------------------------------------
# Run an arbitrary CLI command in a directory and return the exit code.
# ---------------------------------------------------------------------------
function Invoke-ToolCommand {
    param(
        [Parameter(Mandatory)][string]$Command,
        [string]$WorkingDirectory = "",
        [string]$Description = ""
    )
    if ($Description) { Write-Step $Description }

    $originalLocation = Get-Location
    try {
        if ($WorkingDirectory) { Push-Location $WorkingDirectory }
        cmd /c "$Command 2>&1" | Out-Host
        $code = $LASTEXITCODE
    }
    finally {
        if ($WorkingDirectory) { Pop-Location }
    }
    return $code
}

# ---------------------------------------------------------------------------
# Print a final summary block and exit with the correct code.
# ---------------------------------------------------------------------------
function Exit-WithSummary {
    param(
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][int[]]$ExitCodes,
        [string[]]$Labels = @()
    )
    Write-SectionHeader $Title

    $allPassed = $true
    for ($i = 0; $i -lt $ExitCodes.Count; $i++) {
        $code    = $ExitCodes[$i]
        $label   = if ($Labels -and $i -lt $Labels.Count) { $Labels[$i] } else { "Step $($i + 1)" }
        $passed  = ($code -eq 0)
        if (-not $passed) { $allPassed = $false }
        Write-Result $passed $label
    }

    Write-Host ""
    if ($allPassed) {
        Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "  ONE OR MORE CHECKS FAILED" -ForegroundColor Red
        exit 1
    }
}