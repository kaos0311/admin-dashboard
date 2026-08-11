#Requires -Version 5.1
<#
.SYNOPSIS
    Runs a full release-readiness gate before deployment.
.DESCRIPTION
    Executes a comprehensive set of checks to determine whether the project
    is ready for a production release.  The following checks are performed:

      1. Git working tree must be clean (no uncommitted changes)
      2. Must be on the main/master branch (or use -AllowBranch)
      3. Must be up to date with remote (no unpushed commits)
      4. ESLint must pass (main application)
      5. TypeScript type-checking must pass (main + functions)
      6. Next.js production build must succeed
      7. Cloud Functions build must succeed
      8. Unit tests must pass
      9. Dependency audit must not have high/critical vulnerabilities

    Each check is reported with a pass/fail status and a final summary
    determines overall readiness.
.PARAMETER AllowBranch
    Allow releasing from a branch other than main/master (e.g., -AllowBranch develop).
.PARAMETER SkipTests
    Skip the unit test step (not recommended for production releases).
.PARAMETER SkipAudit
    Skip the dependency audit step.
.PARAMETER SkipFunctions
    Skip the Cloud Functions build and type-check.
.EXAMPLE
    .\scripts\toolkit\release-readiness.ps1
    Run the full release readiness gate.
.EXAMPLE
    .\scripts\toolkit\release-readiness.ps1 -AllowBranch release-1.0
    Allow releasing from the release-1.0 branch.
.NOTES
    Exit code 0 = project is release-ready; 1 = one or more checks failed.
#>
[CmdletBinding()]
param(
    [string]$AllowBranch = "",
    [switch]$SkipTests,
    [switch]$SkipAudit,
    [switch]$SkipFunctions
)

. "$PSScriptRoot\toolkit-common.ps1"

$root = Get-ProjectRoot

Write-SectionHeader "Release Readiness Gate"

$results = @()
$labels  = @()

# ---------------------------------------------------------------------------
# 1. Git: working tree clean
# ---------------------------------------------------------------------------
Write-SubHeader "Check 1: Git Working Tree"

$statusOut = cmd /c "git status --porcelain 2>&1"
$lines = $statusOut -split "`n" | Where-Object { $_.Trim() }
$gitClean = ($lines.Count -eq 0)

if ($gitClean) {
    Write-Success "Working tree is clean"
} else {
    Write-Failure "Working tree has $($lines.Count) uncommitted change(s):"
    $lines | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    if ($lines.Count -gt 10) { Write-Info "    ... and $($lines.Count - 10) more" }
}
$results += if ($gitClean) { 0 } else { 1 }
$labels  += "Git working tree clean"

# ---------------------------------------------------------------------------
# 2. Git: branch check
# ---------------------------------------------------------------------------
Write-SubHeader "Check 2: Branch"

$branch = cmd /c "git rev-parse --abbrev-ref HEAD 2>&1"
$allowedBranches = @("main", "master")
if ($AllowBranch) { $allowedBranches += $AllowBranch }
$branchOk = $allowedBranches -contains $branch

if ($branchOk) {
    Write-Success "On branch: $branch"
} else {
    Write-Failure "On branch: $branch - must be on one of: $($allowedBranches -join ', ')"
    Write-Info "Use -AllowBranch $branch to override."
}
$results += if ($branchOk) { 0 } else { 1 }
$labels  += "On allowed branch"

# ---------------------------------------------------------------------------
# 3. Git: up to date with remote
# ---------------------------------------------------------------------------
Write-SubHeader "Check 3: Remote Sync"

$upstream = cmd /c "git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>&1"
$ahead = 0
$behind = 0
if ($upstream -and -not $upstream.Contains("fatal")) {
    $aheadBehind = cmd /c "git rev-list --left-right --count HEAD...@{u} 2>&1"
    if ($aheadBehind -and $aheadBehind -match '^\s*(\d+)\s+(\d+)') {
        $ahead = [int]$Matches[1]
        $behind = [int]$Matches[2]
    }
}

$syncOk = ($ahead -eq 0 -and $behind -eq 0)
if (-not $upstream -or $upstream.Contains("fatal")) {
    Write-WarningItem "No upstream tracking branch - cannot verify remote sync"
    $syncOk = $false
} elseif ($syncOk) {
    Write-Success "Up to date with remote ($upstream)"
} else {
    if ($ahead -gt 0) { Write-Failure "$ahead unpushed commit(s)" }
    if ($behind -gt 0) { Write-Failure "$behind commit(s) not pulled" }
}
$results += if ($syncOk) { 0 } else { 1 }
$labels  += "Up to date with remote"

# ---------------------------------------------------------------------------
# 4. Lint
# ---------------------------------------------------------------------------
Write-SubHeader "Check 4: ESLint"

$lintCode = Invoke-NpmScript -Script "lint" -Description "Running ESLint"
$results += $lintCode
$labels  += "ESLint passes"
if ($lintCode -eq 0) { Write-Success "Lint passed" }
else { Write-Failure "Lint failed" }

# ---------------------------------------------------------------------------
# 5. Typecheck
# ---------------------------------------------------------------------------
Write-SubHeader "Check 5: TypeScript Type-Check"

$tcCode = Invoke-NpmScript -Script "typecheck" -Description "Type-checking main application"
$results += $tcCode
$labels  += "Main app typecheck"

$funcTcCode = 0
if (-not $SkipFunctions) {
    $funcDir = Get-FunctionsDir
    if (Test-Path $funcDir) {
        $funcTcCode = Invoke-ToolCommand -Command "npx tsc --noEmit" `
            -WorkingDirectory $funcDir `
            -Description "Type-checking Cloud Functions"
        $results += $funcTcCode
        $labels  += "Functions typecheck"
    }
}

# ---------------------------------------------------------------------------
# 6. Build (Next.js)
# ---------------------------------------------------------------------------
Write-SubHeader "Check 6: Next.js Build"

$buildCode = Invoke-NpmScript -Script "build" -Description "Building Next.js production bundle"
$results += $buildCode
$labels  += "Next.js build succeeds"

# ---------------------------------------------------------------------------
# 7. Cloud Functions build
# ---------------------------------------------------------------------------
Write-SubHeader "Check 7: Cloud Functions Build"

$funcBuildCode = 0
if (-not $SkipFunctions) {
    $funcDir = Get-FunctionsDir
    if (Test-Path $funcDir) {
        $funcBuildCode = Invoke-NpmScript -Script "rebuild" `
            -WorkingDirectory $funcDir `
            -Description "Building Cloud Functions (clean + tsc)"
        $results += $funcBuildCode
        $labels  += "Functions build succeeds"
    } else {
        Write-WarningItem "functions/ not found - skipping functions build"
    }
}

# ---------------------------------------------------------------------------
# 8. Tests
# ---------------------------------------------------------------------------
Write-SubHeader "Check 8: Unit Tests"

if ($SkipTests) {
    Write-WarningItem "Tests skipped (-SkipTests)"
    $results += 0
    $labels  += "Unit tests (skipped)"
} else {
    $testCode = Invoke-NpmScript -Script "test" -Description "Running unit tests (vitest)"
    $results += $testCode
    $labels  += "Unit tests pass"
    if ($testCode -eq 0) { Write-Success "Tests passed" }
    else { Write-Failure "Tests failed" }
}

# ---------------------------------------------------------------------------
# 9. Dependency audit
# ---------------------------------------------------------------------------
Write-SubHeader "Check 9: Dependency Audit"

if ($SkipAudit) {
    Write-WarningItem "Audit skipped (-SkipAudit)"
    $results += 0
    $labels  += "Dependency audit (skipped)"
} else {
    $auditCode = Invoke-ToolCommand -Command "npm audit --omit=dev" `
        -WorkingDirectory $root `
        -Description "Auditing production dependencies"
    # npm audit returns non-zero if vulnerabilities found
    $results += $auditCode
    $labels  += "No production vulnerabilities"
    if ($auditCode -eq 0) { Write-Success "No production vulnerabilities" }
    else { Write-Failure "Production vulnerabilities detected - run audit-deps.ps1 for details" }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-SectionHeader "Release Readiness Summary"

$allPassed = $true
for ($i = 0; $i -lt $results.Count; $i++) {
    $passed = ($results[$i] -eq 0)
    if (-not $passed) { $allPassed = $false }
    Write-Result $passed $labels[$i]
}

Write-Host ""
if ($allPassed) {
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host "  PROJECT IS READY FOR RELEASE" -ForegroundColor Green
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host ""
    Write-Info "Branch: $branch"
    Write-Info "Commit: $(cmd /c 'git rev-parse --short HEAD 2>&1')"
    exit 0
} else {
    $failedCount = ($results | Where-Object { $_ -ne 0 }).Count
    Write-Host "  ========================================" -ForegroundColor Red
    Write-Host "  PROJECT IS NOT READY FOR RELEASE" -ForegroundColor Red
    Write-Host "  $failedCount check(s) failed - see above" -ForegroundColor Red
    Write-Host "  ========================================" -ForegroundColor Red
    exit 1
}