#Requires -Version 5.1
<#
.SYNOPSIS
    Reports the current Git repository status.
.DESCRIPTION
    Provides a comprehensive overview of the Git working tree:
      - Current branch and upstream tracking
      - Ahead/behind counts vs. remote
      - Staged, modified, and untracked file counts
      - Stash count
      - Recent commit log (last 10 commits)
      - Whether the working tree is clean
.PARAMETER Short
    Show a compact one-line summary instead of the full report.
.PARAMETER NumCommits
    Number of recent commits to display (default: 10).
.EXAMPLE
    .\scripts\toolkit\git-status.ps1
    Show full Git status report.
.EXAMPLE
    .\scripts\toolkit\git-status.ps1 -Short
    Show a compact summary line.
.NOTES
    Exit code 0 = working tree is clean; 1 = uncommitted changes exist.
#>
[CmdletBinding()]
param(
    [switch]$Short,
    [int]$NumCommits = 10
)

. "$PSScriptRoot\toolkit-common.ps1"

$root = Get-ProjectRoot

# Verify this is a git repo
$gitDir = Join-Path $root ".git"
if (-not (Test-Path $gitDir)) {
    Write-Failure "Not a git repository (no .git directory at $root)"
    exit 1
}

# ---------------------------------------------------------------------------
# Gather git data
# ---------------------------------------------------------------------------
$branch     = cmd /c "git rev-parse --abbrev-ref HEAD 2>&1"
$commit     = cmd /c "git rev-parse --short HEAD 2>&1"
$remote     = cmd /c "git config --get branch.$branch.remote 2>&1"
$upstream   = cmd /c "git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>&1"
$statusOut  = cmd /c "git status --porcelain 2>&1"
$stashList  = cmd /c "git stash list 2>&1"

# Parse porcelain status
$staged    = @()
$modified  = @()
$untracked = @()

$lines = $statusOut -split "`n" | Where-Object { $_.Trim() }
foreach ($line in $lines) {
    $code = $line.Substring(0, 2)
    $file = $line.Substring(3).Trim()
    if ($code -match '^\?\?') {
        $untracked += $file
    } elseif ($code -match '^[MADRC]') {
        $staged += $file
    } elseif ($code -match '^.[MADRC]') {
        $modified += $file
    } else {
        $modified += $file
    }
}

# Ahead/behind
$aheadBehind = cmd /c "git rev-list --left-right --count HEAD...@{u} 2>&1"
$ahead = 0
$behind = 0
if ($aheadBehind -and $aheadBehind -match '^\s*(\d+)\s+(\d+)') {
    $ahead = [int]$Matches[1]
    $behind = [int]$Matches[2]
}

# Stash count
$stashCount = 0
if ($stashList) {
    $stashLines = $stashList -split "`n" | Where-Object { $_.Trim() }
    $stashCount = $stashLines.Count
}

$isClean = ($staged.Count -eq 0 -and $modified.Count -eq 0 -and $untracked.Count -eq 0)

# ---------------------------------------------------------------------------
# Short output
# ---------------------------------------------------------------------------
if ($Short) {
    $status = if ($isClean) { "clean" } else { "dirty" }
    $summary = "[$branch] $commit | $status"
    if ($ahead -gt 0) { $summary += " | +$ahead ahead" }
    if ($behind -gt 0) { $summary += " | -$behind behind" }
    if ($staged.Count -gt 0) { $summary += " | $($staged.Count) staged" }
    if ($modified.Count -gt 0) { $summary += " | $($modified.Count) modified" }
    if ($untracked.Count -gt 0) { $summary += " | $($untracked.Count) untracked" }
    if ($stashCount -gt 0) { $summary += " | $stashCount stash" }
    Write-Host $summary
    if ($isClean) { exit 0 } else { exit 1 }
}

# ---------------------------------------------------------------------------
# Full report
# ---------------------------------------------------------------------------
Write-SectionHeader "Git Status Report"

Write-SubHeader "Branch"
Write-Info "Current branch:  $branch"
Write-Info "HEAD commit:    $commit"
if ($upstream -and -not $upstream.Contains("fatal")) {
    Write-Info "Upstream:        $upstream"
} else {
    Write-WarningItem "No upstream tracking branch configured"
}
if ($ahead -gt 0) {
    Write-WarningItem "$ahead commit(s) ahead of remote"
}
if ($behind -gt 0) {
    Write-WarningItem "$behind commit(s) behind remote"
}
if ($ahead -eq 0 -and $behind -eq 0 -and $upstream -and -not $upstream.Contains("fatal")) {
    Write-Success "Up to date with remote"
}

Write-SubHeader "Working Tree"
if ($isClean) {
    Write-Success "Working tree is clean"
} else {
    if ($staged.Count -gt 0) {
        Write-WarningItem "$($staged.Count) staged file(s):"
        $staged | Select-Object -First 20 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
        if ($staged.Count -gt 20) { Write-Info "  ... and $($staged.Count - 20) more" }
    }
    if ($modified.Count -gt 0) {
        Write-WarningItem "$($modified.Count) modified file(s):"
        $modified | Select-Object -First 20 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
        if ($modified.Count -gt 20) { Write-Info "  ... and $($modified.Count - 20) more" }
    }
    if ($untracked.Count -gt 0) {
        Write-WarningItem "$($untracked.Count) untracked file(s):"
        $untracked | Select-Object -First 20 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
        if ($untracked.Count -gt 20) { Write-Info "  ... and $($untracked.Count - 20) more" }
    }
}

Write-SubHeader "Stash"
if ($stashCount -gt 0) {
    Write-WarningItem "$stashCount stash entry/entries"
} else {
    Write-Success "No stashed changes"
}

Write-SubHeader "Recent Commits (last $NumCommits)"
$logOut = cmd /c "git log --oneline -$NumCommits 2>&1"
$lines = $logOut -split "`n" | Where-Object { $_.Trim() }
foreach ($l in $lines) {
    Write-Host "  $l" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-SectionHeader "Git Status Summary"
Write-Info "Branch:       $branch"
Write-Info "Commit:       $commit"
Write-Info "Staged:       $($staged.Count)"
Write-Info "Modified:     $($modified.Count)"
Write-Info "Untracked:    $($untracked.Count)"
Write-Info "Stash:        $stashCount"
Write-Info "Ahead/Behind: $ahead / $behind"
Write-Host ""
if ($isClean -and $ahead -eq 0 -and $behind -eq 0) {
    Write-Success "Repository is clean and up to date."
    exit 0
} else {
    if (-not $isClean) { Write-Failure "Working tree has uncommitted changes." }
    if ($ahead -gt 0) { Write-Failure "$ahead unpushed commit(s)." }
    if ($behind -gt 0) { Write-Failure "$behind commit(s) not pulled." }
    exit 1
}