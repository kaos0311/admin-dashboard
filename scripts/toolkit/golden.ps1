#Requires -Version 5.1
<#
.SYNOPSIS
    Runs the AHM Golden Regression Suite.
.DESCRIPTION
    Executes the non-emulator Golden Regression tests with the existing Vitest
    infrastructure. Emulator-dependent Golden scenarios are documented in the
    manifest and intentionally not reported as passing by this command.
#>
[CmdletBinding()]
param(
    [switch]$IncludeEmulator
)

. "$PSScriptRoot\toolkit-common.ps1"

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

Write-SectionHeader "AHM Golden Regression Suite"

$root = Get-ProjectRoot
$functionsDir = Get-FunctionsDir

$exitCodes = @()
$labels = @()

$rootCode = Invoke-ToolCommand `
    -Command "npx vitest run src/golden/golden-regression.test.ts" `
    -WorkingDirectory $root `
    -Description "Root Golden Regression"
$exitCodes += $rootCode
$labels += "Root Golden Regression"

$functionsCode = Invoke-ToolCommand `
    -Command "npx vitest run --config vitest.config.ts src/golden/golden-regression.test.ts" `
    -WorkingDirectory $functionsDir `
    -Description "Functions Golden Regression"
$exitCodes += $functionsCode
$labels += "Functions Golden Regression"

$emulatorBlocked = $false
$emulatorCode = 0
if ($IncludeEmulator) {
    if (Test-LocalPortInUse -Port 8085) {
        $emulatorBlocked = $true
    } else {
        $emulatorCode = Invoke-ToolCommand `
            -Command 'firebase emulators:exec --project demo-advanced-home-medical --only firestore,auth "npx vitest run --config vitest.integration.config.ts src/golden/golden-regression.emulator.test.ts"' `
            -WorkingDirectory $functionsDir `
            -Description "Emulator Golden Regression"
        $exitCodes += $emulatorCode
        $labels += "Emulator Golden Regression"
    }
}

Write-SectionHeader "AHM Golden Regression Summary"

$allPassed = $true
for ($i = 0; $i -lt $exitCodes.Count; $i++) {
    $label = $labels[$i]
    $code = $exitCodes[$i]
    if ($code -eq 0) {
        Write-Success "$label ................ PASS"
    } else {
        Write-Failure "$label ................ FAIL (exit $code)"
        $allPassed = $false
    }
}

if ($IncludeEmulator) {
    if ($emulatorBlocked) {
        Write-WarningItem "Emulator Golden Regression ................ BLOCKED - Firestore emulator port 8085 is already in use."
    } elseif ($emulatorCode -eq 0) {
        Write-Success "Emulator Golden Regression ................ PASS"
    }
} else {
    Write-WarningItem "Emulator Golden Regression ................ SKIPPED - Run with -IncludeEmulator."
}

Write-Host ""
if ($emulatorBlocked) {
    Write-WarningItem "Required Emulator Golden Regression ................ BLOCKED"
    exit 2
}

if ($allPassed) {
    if ($IncludeEmulator) {
        Write-Success "Required Golden Regression ................ PASS"
    } else {
        Write-Success "Required Non-Emulator Golden Regression ................ PASS"
    }
    exit 0
}

if ($IncludeEmulator) {
    Write-Failure "Required Golden Regression ................ FAIL"
} else {
    Write-Failure "Required Non-Emulator Golden Regression ................ FAIL"
}
exit 1
