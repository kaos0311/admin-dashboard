#Requires -Version 5.1
<#
.SYNOPSIS
    Runs the AHM baseline validation gate.
.DESCRIPTION
    Orchestrates existing validation commands without duplicating their
    implementation. Required checks report PASS, FAIL, BLOCKED, SKIPPED, or
    NOT RUN, and the final exit code reflects the overall result.
.PARAMETER SkipNextBuild
    Skip the Next.js production build. Skipped required checks prevent PASS.
.PARAMETER SkipFunctionsBuild
    Skip the Cloud Functions build. Skipped required checks prevent PASS.
.PARAMETER SkipFunctionsTests
    Skip the Cloud Functions unit tests. Skipped required checks prevent PASS.
.PARAMETER IncludeEmulator
    Also run the existing Firebase emulator integration test command.
.EXAMPLE
    .\scripts\toolkit\toolkit.ps1 validate
.EXAMPLE
    .\scripts\toolkit\toolkit.ps1 validate -IncludeEmulator
#>
[CmdletBinding()]
param(
    [switch]$SkipNextBuild,
    [switch]$SkipFunctionsBuild,
    [switch]$SkipFunctionsTests,
    [switch]$IncludeEmulator
)

. "$PSScriptRoot\toolkit-common.ps1"

function New-ValidationResult {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Status,
        [int]$Code = 0,
        [string]$Detail = ""
    )
    return [PSCustomObject]@{
        Name = $Name
        Status = $Status
        Code = $Code
        Detail = $Detail
    }
}

function Invoke-RequiredNpmCheck {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Script,
        [string]$WorkingDirectory = "",
        [switch]$Skipped
    )

    if ($Skipped) {
        return New-ValidationResult -Name $Name -Status "SKIPPED" -Detail "Skipped by command option."
    }

    $code = Invoke-NpmScript -Script $Script -WorkingDirectory $WorkingDirectory -Description $Name
    if ($code -eq 0) {
        return New-ValidationResult -Name $Name -Status "PASS" -Code 0
    }

    return New-ValidationResult -Name $Name -Status "FAIL" -Code $code
}

function Invoke-RequiredToolCheck {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Command,
        [string]$WorkingDirectory = "",
        [switch]$Skipped
    )

    if ($Skipped) {
        return New-ValidationResult -Name $Name -Status "SKIPPED" -Detail "Skipped by command option."
    }

    $code = Invoke-ToolCommand -Command $Command -WorkingDirectory $WorkingDirectory -Description $Name
    if ($code -eq 0) {
        return New-ValidationResult -Name $Name -Status "PASS" -Code 0
    }

    return New-ValidationResult -Name $Name -Status "FAIL" -Code $code
}

function Test-LocalPortInUse {
    param([Parameter(Mandatory)][int]$Port)

    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return [bool]$connections
    }
    catch {
        return $false
    }
}

Write-SectionHeader "AHM Validation"

$root = Get-ProjectRoot
$functionsDir = Get-FunctionsDir
$results = @()
$stop = $false

function Add-NotRun {
    param([Parameter(Mandatory)][string]$Name)
    $script:results += New-ValidationResult -Name $Name -Status "NOT RUN" -Detail "Stopped because a previous required check failed."
}

function Add-ResultAndStopOnFailure {
    param([Parameter(Mandatory)]$Result)
    $script:results += $Result
    if ($Result.Status -eq "FAIL" -or $Result.Status -eq "BLOCKED") {
        $script:stop = $true
    }
}

Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Lint" -Script "lint" -WorkingDirectory $root)

if ($stop) { Add-NotRun "Typecheck" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Typecheck" -Script "typecheck" -WorkingDirectory $root) }
if ($stop) { Add-NotRun "Root Tests" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Root Tests" -Script "test" -WorkingDirectory $root) }
if ($stop) { Add-NotRun "Golden Regression" } else { Add-ResultAndStopOnFailure (Invoke-RequiredToolCheck -Name "Golden Regression" -Command "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\toolkit\golden.ps1" -WorkingDirectory $root) }
if ($IncludeEmulator) {
    if ($stop) { Add-NotRun "Emulator Golden Regression" } else { Add-ResultAndStopOnFailure (Invoke-RequiredToolCheck -Name "Emulator Golden Regression" -Command "powershell -NoProfile -ExecutionPolicy Bypass -File scripts\toolkit\golden.ps1 -IncludeEmulator" -WorkingDirectory $root) }
}
if ($stop) { Add-NotRun "Domain Writes" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Domain Writes" -Script "validate:domain-writes" -WorkingDirectory $root) }
if ($stop) { Add-NotRun "Inventory Writes" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Inventory Writes" -Script "validate:inventory-writes" -WorkingDirectory $root) }
if ($stop) { Add-NotRun "Functions Tests" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Functions Tests" -Script "test" -WorkingDirectory $functionsDir -Skipped:$SkipFunctionsTests) }
if ($stop) { Add-NotRun "Functions Build" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Functions Build" -Script "build" -WorkingDirectory $functionsDir -Skipped:$SkipFunctionsBuild) }
if ($stop) { Add-NotRun "Next Build" } else { Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Next Build" -Script "build" -WorkingDirectory $root -Skipped:$SkipNextBuild) }

if ($IncludeEmulator) {
    if ($stop) {
        Add-NotRun "Emulator Tests"
    } elseif (Test-LocalPortInUse -Port 8085) {
        Add-ResultAndStopOnFailure (
            New-ValidationResult `
                -Name "Emulator Tests" `
                -Status "BLOCKED" `
                -Detail "Firestore emulator port 8085 is already in use."
        )
    } else {
        Add-ResultAndStopOnFailure (Invoke-RequiredNpmCheck -Name "Emulator Tests" -Script "emulators:test" -WorkingDirectory $root)
    }
} else {
    $results += New-ValidationResult -Name "Emulator Tests" -Status "SKIPPED" -Detail "Optional; run with -IncludeEmulator."
}

Write-SectionHeader "AHM Validation Summary"

$hasFail = $false
$hasBlocked = $false
$hasRequiredSkip = $false

foreach ($result in $results) {
    $suffix = ""
    if ($result.Detail) { $suffix = " - $($result.Detail)" }
    if ($result.Code -ne 0) { $suffix = " (exit $($result.Code))$suffix" }

    switch ($result.Status) {
        "PASS" { Write-Success "$($result.Name) ................ $($result.Status)$suffix" }
        "FAIL" { Write-Failure "$($result.Name) ................ $($result.Status)$suffix"; $hasFail = $true }
        "BLOCKED" { Write-WarningItem "$($result.Name) ................ $($result.Status)$suffix"; $hasBlocked = $true }
        "SKIPPED" {
            Write-WarningItem "$($result.Name) ................ $($result.Status)$suffix"
            if ($result.Name -ne "Emulator Tests" -and $result.Name -ne "Golden Regression") {
                $hasRequiredSkip = $true
            }
        }
        "NOT RUN" { Write-WarningItem "$($result.Name) ................ $($result.Status)$suffix" }
    }
}

Write-Host ""

if ($hasFail) {
    Write-Failure "Overall ................ FAIL"
    exit 1
}

if ($hasBlocked -or $hasRequiredSkip) {
    Write-WarningItem "Overall ................ BLOCKED"
    exit 2
}

Write-Success "Overall ................ PASS"
exit 0
