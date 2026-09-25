#Requires -Version 7.0
<#
.SYNOPSIS
    Reports a comprehensive, read-only snapshot of project health.
.DESCRIPTION
    Gathers and reports environment, dependency, configuration, and repository
    status information for the admin-dashboard project. This script is strictly
    read-only: it does not modify, install, build, deploy, or commit anything.

    Reported items:
      - Current directory
      - Git branch and working-tree status
      - Node and npm versions
      - PowerShell version
      - Presence of package.json and functions\package.json
      - Presence of node_modules and functions\node_modules
      - Available npm scripts from package.json
      - Available functions npm scripts
      - Presence of common environment files (contents are NOT displayed)
      - Presence of Firebase configuration files
      - Presence of Next.js configuration files
      - A final health summary
.EXAMPLE
    .\scripts\Get-ProjectHealth.ps1
    Print the full project health report.
.NOTES
    Exit code: 0 = report generated (informational only); 1 = script error.
    This script never fails based on project state - it only reports it.
#>
[CmdletBinding()]
param()

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

function Write-Yes {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [YES] $Message" -ForegroundColor Green
}

function Write-No {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [NO]  $Message" -ForegroundColor Red
}

function Write-Info {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [i]   $Message" -ForegroundColor DarkGray
}

function Write-Warn {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Safe command runner: returns [string] output, never throws.
# Uses cmd /c so stderr does not trip $ErrorActionPreference = 'Stop'.
# ---------------------------------------------------------------------------
function Invoke-SafeCommand {
    param([Parameter(Mandatory)][string]$Command)
    $output = cmd /c "$Command 2>&1"
    return ($output -join "`n").Trim()
}

# ---------------------------------------------------------------------------
# Read the "scripts" object from a package.json file (returns hashtable).
# ---------------------------------------------------------------------------
function Get-PackageScripts {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        if ($null -ne $json.scripts) {
            $ht = @{}
            foreach ($prop in $json.scripts.PSObject.Properties) {
                $ht[$prop.Name] = $prop.Value
            }
            return $ht
        }
    } catch {
        return @{ '__error__' = $_.Exception.Message }
    }
    return @{}
}

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
Write-SectionHeader 'Project Health Report'

# --- Current directory -----------------------------------------------------
Write-SubHeader 'Current Directory'
Write-Info "Working directory: $((Get-Location).Path)"
Write-Info "Project root:      $script:ProjectRoot"

# --- Runtime versions ------------------------------------------------------
Write-SubHeader 'Runtime Versions'

$nodeVer = Invoke-SafeCommand 'node --version'
if ($nodeVer -and -not $nodeVer.Contains('not recognized')) {
    Write-Info "Node version:       $nodeVer"
} else {
    Write-Warn "Node not found on PATH"
}

$npmVer = Invoke-SafeCommand 'npm --version'
if ($npmVer -and -not $npmVer.Contains('not recognized')) {
    Write-Info "npm version:        $npmVer"
} else {
    Write-Warn "npm not found on PATH"
}

Write-Info "PowerShell version: $($PSVersionTable.PSVersion.ToString())"
Write-Info "PSEdition:          $($PSVersionTable.PSEdition)"

# --- Git status ------------------------------------------------------------
Write-SubHeader 'Git Repository'

$gitDir = Join-Path $script:ProjectRoot '.git'
if (Test-Path -LiteralPath $gitDir) {
    $branch = Invoke-SafeCommand 'git rev-parse --abbrev-ref HEAD'
    Write-Info "Branch:             $branch"

    $statusOut = Invoke-SafeCommand 'git status --porcelain'
    $statusLines = $statusOut -split "`n" | Where-Object { $_.Trim() }
    if ($statusLines.Count -eq 0) {
        Write-Yes 'Working tree is clean'
    } else {
        Write-Warn "Working tree is dirty ($($statusLines.Count) change(s))"
        $staged = @(); $modified = @(); $untracked = @()
        foreach ($line in $statusLines) {
            if ($line.Length -lt 3) { continue }
            $code = $line.Substring(0, 2)
            $file = $line.Substring(3).Trim()
            if ($code -match '^\?\?') { $untracked += $file }
            elseif ($code -match '^[MADRC]') { $staged += $file }
            else { $modified += $file }
        }
        Write-Info "  Staged:    $($staged.Count)"
        Write-Info "  Modified:  $($modified.Count)"
        Write-Info "  Untracked: $($untracked.Count)"
    }
} else {
    Write-Warn 'Not a git repository (no .git directory)'
}

# --- Package manifests -----------------------------------------------------
Write-SubHeader 'Package Manifests'

$rootPkg = Join-Path $script:ProjectRoot 'package.json'
if (Test-Path -LiteralPath $rootPkg) {
    Write-Yes "package.json exists"
} else {
    Write-No  "package.json MISSING"
}

$funcPkg = Join-Path $script:FunctionsDir 'package.json'
if (Test-Path -LiteralPath $funcPkg) {
    Write-Yes "functions\package.json exists"
} else {
    Write-No  "functions\package.json MISSING"
}

# --- node_modules ----------------------------------------------------------
Write-SubHeader 'Dependencies (node_modules)'

$rootNm = Join-Path $script:ProjectRoot 'node_modules'
if (Test-Path -LiteralPath $rootNm) {
    Write-Yes "node_modules exists"
} else {
    Write-No  "node_modules MISSING (run 'npm install')"
}

$funcNm = Join-Path $script:FunctionsDir 'node_modules'
if (Test-Path -LiteralPath $funcNm) {
    Write-Yes "functions\node_modules exists"
} else {
    Write-No  "functions\node_modules MISSING (run 'cd functions && npm install')"
}

# --- npm scripts -----------------------------------------------------------
Write-SubHeader 'Available npm Scripts (root package.json)'

$rootScripts = Get-PackageScripts -Path $rootPkg
if ($null -eq $rootScripts) {
    Write-Warn 'Could not read root package.json scripts'
} elseif ($rootScripts.ContainsKey('__error__')) {
    Write-Warn "Error parsing root package.json: $($rootScripts['__error__'])"
} elseif ($rootScripts.Count -eq 0) {
    Write-Info 'No scripts defined in root package.json'
} else {
    foreach ($key in ($rootScripts.Keys | Sort-Object)) {
        Write-Info ("{0,-30} {1}" -f $key, $rootScripts[$key])
    }
}

Write-SubHeader 'Available npm Scripts (functions package.json)'

$funcScripts = Get-PackageScripts -Path $funcPkg
if ($null -eq $funcScripts) {
    Write-Info 'functions\package.json not found - no functions scripts'
} elseif ($funcScripts.ContainsKey('__error__')) {
    Write-Warn "Error parsing functions package.json: $($funcScripts['__error__'])"
} elseif ($funcScripts.Count -eq 0) {
    Write-Info 'No scripts defined in functions package.json'
} else {
    foreach ($key in ($funcScripts.Keys | Sort-Object)) {
        Write-Info ("{0,-30} {1}" -f $key, $funcScripts[$key])
    }
}

# --- Environment files (presence only, no contents) ------------------------
Write-SubHeader 'Environment Files (presence only - contents not shown)'

$envFiles = @('.env', '.env.local', '.env.development', '.env.production', '.env.example')
$envFound = 0
foreach ($envFile in $envFiles) {
    $envPath = Join-Path $script:ProjectRoot $envFile
    if (Test-Path -LiteralPath $envPath) {
        Write-Yes "$envFile present"
        $envFound++
    } else {
        Write-No  "$envFile absent"
    }
}
if ($envFound -eq 0) {
    Write-Warn 'No environment files found - environment variables may not be configured'
}

# --- Firebase configuration files ------------------------------------------
Write-SubHeader 'Firebase Configuration Files'

$firebaseFiles = @('firebase.json', '.firebaserc', 'firestore.rules', 'firestore.indexes.json', 'storage.rules')
$fbFound = 0
foreach ($fbFile in $firebaseFiles) {
    $fbPath = Join-Path $script:ProjectRoot $fbFile
    if (Test-Path -LiteralPath $fbPath) {
        Write-Yes "$fbFile present"
        $fbFound++
    } else {
        Write-No  "$fbFile absent"
    }
}
if ($fbFound -eq 0) {
    Write-Warn 'No Firebase configuration files found'
}

# --- Next.js configuration files -------------------------------------------
Write-SubHeader 'Next.js Configuration Files'

$nextFiles = @('next.config.ts', 'next.config.js', 'next.config.mjs', 'postcss.config.mjs', 'tsconfig.json', 'eslint.config.mjs')
$nextFound = 0
foreach ($nxFile in $nextFiles) {
    $nxPath = Join-Path $script:ProjectRoot $nxFile
    if (Test-Path -LiteralPath $nxPath) {
        Write-Yes "$nxFile present"
        $nextFound++
    } else {
        Write-No  "$nxFile absent"
    }
}
if ($nextFound -eq 0) {
    Write-Warn 'No Next.js configuration files found'
}

# --- Final summary ---------------------------------------------------------
Write-SectionHeader 'Health Summary'

$summary = @{
    GitRepo          = (Test-Path -LiteralPath $gitDir)
    RootPackageJson  = (Test-Path -LiteralPath $rootPkg)
    FuncPackageJson  = (Test-Path -LiteralPath $funcPkg)
    RootNodeModules  = (Test-Path -LiteralPath $rootNm)
    FuncNodeModules  = (Test-Path -LiteralPath $funcNm)
    EnvFilesFound    = $envFound
    FirebaseFiles    = $fbFound
    NextFiles        = $nextFound
}

$criticalOk = ($summary.GitRepo -and $summary.RootPackageJson -and $summary.RootNodeModules)
$warnings = 0
if (-not $summary.FuncPackageJson) { $warnings++ }
if (-not $summary.FuncNodeModules) { $warnings++ }
if ($envFound -eq 0) { $warnings++ }

Write-Info "Git repository:          $(if ($summary.GitRepo) { 'yes' } else { 'no' })"
Write-Info "Root package.json:       $(if ($summary.RootPackageJson) { 'yes' } else { 'no' })"
Write-Info "Functions package.json:  $(if ($summary.FuncPackageJson) { 'yes' } else { 'no' })"
Write-Info "Root node_modules:       $(if ($summary.RootNodeModules) { 'yes' } else { 'no' })"
Write-Info "Functions node_modules:  $(if ($summary.FuncNodeModules) { 'yes' } else { 'no' })"
Write-Info "Environment files found: $($summary.EnvFilesFound)"
Write-Info "Firebase files found:    $($summary.FirebaseFiles)"
Write-Info "Next.js files found:     $($summary.NextFiles)"
Write-Info "Warnings:                $warnings"
Write-Host ''

if ($criticalOk) {
    Write-Yes 'CRITICAL HEALTH CHECKS PASSED (git repo, root package.json, root node_modules)'
} else {
    Write-Warn 'One or more critical items missing - see above.'
}

Write-Host ''
Write-Info 'This report is read-only. No files were modified.'
exit 0