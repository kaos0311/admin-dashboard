#Requires -Version 5.1
<#
.SYNOPSIS
    Runs a comprehensive project health check.
.DESCRIPTION
    Verifies that the development environment and project configuration are
    in a healthy state.  Checks include:
      - Node.js and npm versions
      - Required CLI tools (git, firebase, npx)
      - node_modules installed (root and functions/)
      - Key config files present (package.json, tsconfig.json, eslint.config.mjs,
        next.config.ts, firebase.json, firestore.rules, storage.rules)
      - Prisma schema present
      - Environment file presence (.env or .env.local)
      - Git repository initialized
      - Source directories present (src/, functions/src/)
      - Build output directories (.next/, functions/lib/)
      - Disk space availability
.PARAMETER Quiet
    Suppress informational output - only show warnings and errors.
.EXAMPLE
    .\scripts\toolkit\health-check.ps1
    Run a full health check.
.NOTES
    Exit code 0 = all critical checks passed; 1 = one or more critical checks failed.
#>
[CmdletBinding()]
param(
    [switch]$Quiet
)

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "Project Health Check"

$root = Get-ProjectRoot
$checks = @()
$warnings = @()

# ---------------------------------------------------------------------------
# 1. Node.js and npm
# ---------------------------------------------------------------------------
Write-SubHeader "Runtime Environment"

$nodeOk = Test-CommandExists "node"
$npmOk  = Test-CommandExists "npm"
$gitOk  = Test-CommandExists "git"
$fbOk   = Test-CommandExists "firebase"
$npxOk  = Test-CommandExists "npx"

if ($nodeOk) {
    $nodeVer = cmd /c "node --version 2>&1"
    Write-Success "Node.js: $nodeVer"
    $checks += $true
} else {
    Write-Failure "Node.js not found on PATH"
    $checks += $false
}

if ($npmOk) {
    $npmVer = cmd /c "npm --version 2>&1"
    Write-Success "npm: v$npmVer"
    $checks += $true
} else {
    Write-Failure "npm not found on PATH"
    $checks += $false
}

if ($gitOk) {
    $gitVer = cmd /c "git --version 2>&1"
    Write-Success "git: $gitVer"
    $checks += $true
} else {
    Write-WarningItem "git not found on PATH"
    $warnings += "git not found"
    $checks += $true
}

if ($fbOk) {
    Write-Success "firebase CLI available"
} else {
    Write-WarningItem "firebase CLI not found (optional - needed for deploys/emulators)"
    $warnings += "firebase CLI not found"
}

if ($npxOk) {
    Write-Success "npx available"
} else {
    Write-WarningItem "npx not found"
    $warnings += "npx not found"
}

# ---------------------------------------------------------------------------
# 2. Dependencies
# ---------------------------------------------------------------------------
Write-SubHeader "Dependencies"

$rootNodeModules = Join-Path $root "node_modules"
if (Test-Path $rootNodeModules) {
    $depCount = (Get-ChildItem $rootNodeModules -Directory).Count
    if (-not $Quiet) { Write-Success "Root node_modules present ($depCount packages)" }
    $checks += $true
} else {
    Write-Failure "Root node_modules missing - run 'npm install'"
    $checks += $false
}

$funcDir = Get-FunctionsDir
if (Test-Path $funcDir) {
    $funcNodeModules = Join-Path $funcDir "node_modules"
    if (Test-Path $funcNodeModules) {
        $funcDepCount = (Get-ChildItem $funcNodeModules -Directory).Count
        if (-not $Quiet) { Write-Success "Functions node_modules present ($funcDepCount packages)" }
        $checks += $true
    } else {
        Write-WarningItem "Functions node_modules missing - run 'cd functions && npm install'"
        $warnings += "functions/node_modules missing"
        $checks += $true
    }
}

# ---------------------------------------------------------------------------
# 3. Configuration files
# ---------------------------------------------------------------------------
Write-SubHeader "Configuration Files"

$configFiles = @(
    @{ Path = "package.json";          Critical = $true;  Label = "package.json" },
    @{ Path = "tsconfig.json";         Critical = $true;  Label = "tsconfig.json" },
    @{ Path = "eslint.config.mjs";     Critical = $true;  Label = "eslint.config.mjs" },
    @{ Path = "next.config.ts";        Critical = $true;  Label = "next.config.ts" },
    @{ Path = "firebase.json";         Critical = $true;  Label = "firebase.json" },
    @{ Path = ".firebaserc";           Critical = $false; Label = ".firebaserc" },
    @{ Path = "firestore.rules";        Critical = $true;  Label = "firestore.rules" },
    @{ Path = "firestore.indexes.json"; Critical = $false; Label = "firestore.indexes.json" },
    @{ Path = "storage.rules";         Critical = $true;  Label = "storage.rules" },
    @{ Path = "postcss.config.mjs";    Critical = $false; Label = "postcss.config.mjs" },
    @{ Path = "vitest.config.ts";      Critical = $false; Label = "vitest.config.ts" },
    @{ Path = "prisma.config.ts";      Critical = $false; Label = "prisma.config.ts" },
    @{ Path = "prisma/schema.prisma";  Critical = $false; Label = "prisma/schema.prisma" }
)

foreach ($cfg in $configFiles) {
    $fullPath = Join-Path $root $cfg.Path
    if (Test-Path $fullPath) {
        if (-not $Quiet) { Write-Success "$($cfg.Label) present" }
        $checks += $true
    } else {
        if ($cfg.Critical) {
            Write-Failure "$($cfg.Label) MISSING (critical)"
            $checks += $false
        } else {
            Write-WarningItem "$($cfg.Label) missing (optional)"
            $warnings += "$($cfg.Label) missing"
            $checks += $true
        }
    }
}

# ---------------------------------------------------------------------------
# 4. Environment files
# ---------------------------------------------------------------------------
Write-SubHeader "Environment"

$envFiles = @(".env", ".env.local", ".env.development", ".env.production", ".env.example")
$envFound = $false
foreach ($envFile in $envFiles) {
    $envPath = Join-Path $root $envFile
    if (Test-Path $envPath) {
        if (-not $Quiet) { Write-Success "$envFile present" }
        $envFound = $true
    }
}
if (-not $envFound) {
    Write-WarningItem "No .env files found - environment variables may not be configured"
    $warnings += "no .env files"
}
$checks += $true

# ---------------------------------------------------------------------------
# 5. Git repository
# ---------------------------------------------------------------------------
Write-SubHeader "Git Repository"

$gitDir = Join-Path $root ".git"
if (Test-Path $gitDir) {
    $branch = cmd /c "git rev-parse --abbrev-ref HEAD 2>&1"
    $commit = cmd /c "git rev-parse --short HEAD 2>&1"
    if (-not $Quiet) { Write-Success "On branch: $branch (commit $commit)" }
    $checks += $true
} else {
    Write-Failure "Not a git repository (no .git directory)"
    $checks += $false
}

# ---------------------------------------------------------------------------
# 6. Source directories
# ---------------------------------------------------------------------------
Write-SubHeader "Source Directories"

$srcDir = Get-SrcDir
if (Test-Path $srcDir) {
    $srcFileCount = (Get-ChildItem $srcDir -Recurse -Include *.ts,*.tsx -File).Count
    if (-not $Quiet) { Write-Success "src/ present ($srcFileCount TS/TSX files)" }
    $checks += $true
} else {
    Write-Failure "src/ directory missing"
    $checks += $false
}

if (Test-Path $funcDir) {
    $funcSrcDir = Join-Path $funcDir "src"
    if (Test-Path $funcSrcDir) {
        $funcFileCount = (Get-ChildItem $funcSrcDir -Recurse -Include *.ts -File).Count
        if (-not $Quiet) { Write-Success "functions/src/ present ($funcFileCount TS files)" }
        $checks += $true
    } else {
        Write-WarningItem "functions/src/ missing"
        $warnings += "functions/src/ missing"
        $checks += $true
    }
}

# ---------------------------------------------------------------------------
# 7. Build output directories
# ---------------------------------------------------------------------------
Write-SubHeader "Build Outputs"

$nextDir = Join-Path $root ".next"
if (Test-Path $nextDir) {
    if (-not $Quiet) { Write-Success ".next/ build output exists" }
} else {
    if (-not $Quiet) { Write-Info ".next/ not built yet (run build.ps1)" }
}
$checks += $true

$libDir = Join-Path $funcDir "lib"
if (Test-Path $libDir) {
    if (-not $Quiet) { Write-Success "functions/lib/ build output exists" }
} else {
    if (-not $Quiet) { Write-Info "functions/lib/ not built yet (run build-functions.ps1)" }
}
$checks += $true

# ---------------------------------------------------------------------------
# 8. Disk space
# ---------------------------------------------------------------------------
Write-SubHeader "Disk Space"

$drive = (Split-Path $root -Qualifier)
$disk = Get-PSDrive -Name $drive.Replace(":", "")
$freeGB = [math]::Round($disk.Free / 1GB, 2)
if ($freeGB -gt 5) {
    if (-not $Quiet) { Write-Success "$drive $freeGB GB free" }
    $checks += $true
} elseif ($freeGB -gt 1) {
    Write-WarningItem "$drive only $freeGB GB free - consider cleaning up"
    $warnings += "low disk space"
    $checks += $true
} else {
    Write-Failure "$drive only $freeGB GB free - critically low!"
    $checks += $false
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-SectionHeader "Health Check Summary"

$passed = 0
$failed = 0
foreach ($c in $checks) {
    if ($c) { $passed++ } else { $failed++ }
}

Write-Info "Checks passed:  $passed"
Write-Info "Checks failed:  $failed"
Write-Info "Warnings:       $($warnings.Count)"

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "  Warnings:" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "    - $w" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Success "Project health is GOOD - all critical checks passed."
    exit 0
} else {
    Write-Failure "$failed critical check(s) failed - see above for details."
    exit 1
}