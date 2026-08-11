#Requires -Version 5.1
<#
.SYNOPSIS
    Engineering toolkit - unified entry point for all project scripts.
.DESCRIPTION
    This script provides a single entry point for the entire engineering
    toolkit.  It can run any individual check or a group of checks.

    Available commands:
      lint            Run ESLint (main app + optional functions)
      typecheck       Run TypeScript type-checking (main app + functions)
      build           Build the Next.js production bundle
      build-functions Build the Firebase Cloud Functions package
      audit           Audit npm dependencies for vulnerabilities
      dead-code       Detect potentially unused files and exports
      health          Run a comprehensive project health check
      git-status      Report Git repository status
      validate        Run the baseline validation gate
      golden          Run the Golden Regression Suite
      release         Run the full release-readiness gate
      all             Run lint + typecheck + build + build-functions
      help            Show this help message

    Pass extra flags after the command to forward them to the underlying
    script (see each script's parameters).
.EXAMPLE
    .\scripts\toolkit\toolkit.ps1 lint
    Run the lint script.
.EXAMPLE
    .\scripts\toolkit\toolkit.ps1 health
    Run the health check.
.EXAMPLE
    .\scripts\toolkit\toolkit.ps1 all
    Run lint, typecheck, build, and build-functions in sequence.
.EXAMPLE
    .\scripts\toolkit\toolkit.ps1 release -SkipTests
    Run release readiness gate, skipping unit tests.
.NOTES
    Exit code mirrors the underlying script's exit code.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("lint","typecheck","build","build-functions","audit","dead-code","health","git-status","validate","golden","release","all","help","")]
    [string]$Command = "help",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ForwardedArgs
)

$toolkitDir = $PSScriptRoot

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
if ($Command -eq "help" -or -not $Command) {
    Write-Host ""
    Write-Host "Engineering Toolkit" -ForegroundColor Cyan
    Write-Host "Usage: .\scripts\toolkit\toolkit.ps1 <command> [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  lint             Run ESLint static analysis" -ForegroundColor Gray
    Write-Host "  typecheck        Run TypeScript type-checking" -ForegroundColor Gray
    Write-Host "  build            Build Next.js production bundle" -ForegroundColor Gray
    Write-Host "  build-functions  Build Firebase Cloud Functions" -ForegroundColor Gray
    Write-Host "  audit            Audit npm dependencies for vulnerabilities" -ForegroundColor Gray
    Write-Host "  dead-code        Detect potentially unused code" -ForegroundColor Gray
    Write-Host "  health           Run comprehensive project health check" -ForegroundColor Gray
    Write-Host "  git-status       Report Git repository status" -ForegroundColor Gray
    Write-Host "  validate         Run baseline validation gate" -ForegroundColor Gray
    Write-Host "  golden           Run Golden Regression Suite" -ForegroundColor Gray
    Write-Host "  release          Run full release-readiness gate" -ForegroundColor Gray
    Write-Host "  all              Run lint + typecheck + build + build-functions" -ForegroundColor Gray
    Write-Host "  help             Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  .\scripts\toolkit\toolkit.ps1 lint" -ForegroundColor DarkGray
    Write-Host "  .\scripts\toolkit\toolkit.ps1 all" -ForegroundColor DarkGray
    Write-Host "  .\scripts\toolkit\toolkit.ps1 release -SkipTests" -ForegroundColor DarkGray
    Write-Host "  .\scripts\toolkit\toolkit.ps1 dead-code -IncludeFunctions" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# ---------------------------------------------------------------------------
# "all" - run lint, typecheck, build, build-functions in sequence
# ---------------------------------------------------------------------------
if ($Command -eq "all") {
    . "$toolkitDir\toolkit-common.ps1"

    Write-SectionHeader "Full Engineering Toolkit - All Checks"

    $scriptNames = @("lint","typecheck","build","build-functions")
    $scriptFiles = @("lint.ps1","typecheck.ps1","build.ps1","build-functions.ps1")

    $exitCodes = @()
    $labels = @()

    for ($i = 0; $i -lt $scriptNames.Count; $i++) {
        $scriptPath = Join-Path $toolkitDir $scriptFiles[$i]
        Write-Step "Running $($scriptNames[$i])..."
        & $scriptPath
        $code = $LASTEXITCODE
        $exitCodes += $code
        $labels += $scriptNames[$i]
        if ($code -ne 0) {
            Write-WarningItem "$($scriptNames[$i]) failed (exit $code) - continuing with remaining checks..."
        }
    }

    Exit-WithSummary -Title "All Checks Summary" -ExitCodes $exitCodes -Labels $labels
    exit 0
}

# ---------------------------------------------------------------------------
# Single command - forward to the appropriate script
# ---------------------------------------------------------------------------
$scriptMap = @{
    "lint" = "lint.ps1"
    "typecheck" = "typecheck.ps1"
    "build" = "build.ps1"
    "build-functions" = "build-functions.ps1"
    "audit" = "audit-deps.ps1"
    "dead-code" = "dead-code.ps1"
    "health" = "health-check.ps1"
    "git-status" = "git-status.ps1"
    "validate" = "validate.ps1"
    "golden" = "golden.ps1"
    "release" = "release-readiness.ps1"
}

$scriptFile = $scriptMap[$Command]
$scriptPath = Join-Path $toolkitDir $scriptFile

if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

# Build argument string for forwarding
$argString = ""
if ($ForwardedArgs) {
    $argString = ($ForwardedArgs -join " ")
}

# Execute with forwarded arguments
if ($argString) {
    $expr = "& '$scriptPath' $argString"
} else {
    $expr = "& '$scriptPath'"
}

Invoke-Expression $expr
exit $LASTEXITCODE
