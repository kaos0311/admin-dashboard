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
      4. Repository hygiene preflight must pass
      5. Secret preflight must pass
      6. AHM validation gate must pass with emulator coverage
      7. Dependency audits must not have production vulnerabilities

    Each check is reported with a pass/fail status and a final summary
    determines overall readiness.
.PARAMETER AllowBranch
    Allow releasing from a branch other than main/master (e.g., -AllowBranch develop).
.PARAMETER SkipAudit
    Skip the dependency audit step.
.PARAMETER IncludeHistorySecretScan
    Also scan Git history with the local redacted secret preflight.
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
    [switch]$SkipAudit,
    [switch]$IncludeHistorySecretScan
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
# 4. Repository hygiene
# ---------------------------------------------------------------------------
Write-SubHeader "Check 4: Repository Hygiene"

$hygieneCode = Invoke-ToolCommand -Command "node scripts\check-repo-hygiene.cjs" `
    -WorkingDirectory $root `
    -Description "Checking repository hygiene"
$results += $hygieneCode
$labels  += "Repository hygiene preflight"
if ($hygieneCode -eq 0) { Write-Success "Repository hygiene passed" }
else { Write-Failure "Repository hygiene failed" }

# ---------------------------------------------------------------------------
# 5. Secret preflight
# ---------------------------------------------------------------------------
Write-SubHeader "Check 5: Secret Preflight"

$secretCommand = "node scripts\check-secret-preflight.cjs"
if ($IncludeHistorySecretScan) {
    $secretCommand += " --history"
}

$secretCode = Invoke-ToolCommand -Command $secretCommand `
    -WorkingDirectory $root `
    -Description "Checking for obvious credential patterns"
$results += $secretCode
$labels  += "Secret preflight"
if ($secretCode -eq 0) { Write-Success "Secret preflight passed" }
else { Write-Failure "Secret preflight failed" }

# ---------------------------------------------------------------------------
# 6. Baseline validation with emulator coverage
# ---------------------------------------------------------------------------
Write-SubHeader "Check 6: AHM Validation"

$validationCode = Invoke-ToolCommand -Command "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\toolkit\validate.ps1 -IncludeEmulator" `
    -WorkingDirectory $root `
    -Description "Running AHM validation gate with emulator coverage"
$results += $validationCode
$labels  += "AHM validation with emulator coverage"
if ($validationCode -eq 0) { Write-Success "AHM validation passed" }
elseif ($validationCode -eq 2) { Write-WarningItem "AHM validation blocked" }
else { Write-Failure "AHM validation failed" }

# ---------------------------------------------------------------------------
# 7. Dependency audits
# ---------------------------------------------------------------------------
Write-SubHeader "Check 7: Dependency Audits"

if ($SkipAudit) {
    Write-WarningItem "Audit skipped (-SkipAudit)"
    $results += 0
    $labels  += "Dependency audits (skipped)"
} else {
    $auditCode = Invoke-ToolCommand -Command "npm audit --omit=dev" `
        -WorkingDirectory $root `
        -Description "Auditing root production dependencies"
    $results += $auditCode
    $labels  += "Root production dependency audit"
    if ($auditCode -eq 0) { Write-Success "Root production dependencies passed audit" }
    else { Write-Failure "Root production dependency vulnerabilities detected" }

    $functionsDir = Join-Path $root "functions"
    if (Test-Path $functionsDir) {
        $functionsAuditCode = Invoke-ToolCommand -Command "npm audit --omit=dev" `
            -WorkingDirectory $functionsDir `
            -Description "Auditing Functions production dependencies"
        $results += $functionsAuditCode
        $labels  += "Functions production dependency audit"
        if ($functionsAuditCode -eq 0) { Write-Success "Functions production dependencies passed audit" }
        else { Write-Failure "Functions production dependency vulnerabilities detected" }
    } else {
        Write-WarningItem "functions/ not found - cannot audit Functions production dependencies"
        $results += 1
        $labels  += "Functions production dependency audit"
    }
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
