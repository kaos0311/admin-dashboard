#Requires -Version 5.1
<#
.SYNOPSIS
    Detects potentially dead (unused) code in the project.
.DESCRIPTION
    Performs heuristic static analysis to find:
      1. Source files in src/ that are never imported by any other file.
      2. Exported symbols (functions, constants, classes, types) that are
         never imported elsewhere.

    The analysis uses regex-based import scanning and path resolution that
    understands the @/ path alias (-> src/) and relative imports.

    IMPORTANT: This is a heuristic tool.  It WILL produce false positives for:
      - Next.js App Router entry points (src/app/**) - these are excluded.
      - Files referenced via dynamic import() with computed paths.
      - Files loaded by convention (middleware.ts, instrumentation.ts, etc.).
      - Re-exported barrel files.
      - Symbols used only in string literals or type inference.

    Review each result manually before deleting code.
.PARAMETER IncludeFunctions
    Also scan the functions/src/ directory.
.PARAMETER ExportReport
    Write a CSV report of potentially dead files to dead-code-report.csv.
.EXAMPLE
    .\scripts\toolkit\dead-code.ps1
    Scan src/ for potentially unused files and exports.
.EXAMPLE
    .\scripts\toolkit\dead-code.ps1 -IncludeFunctions -ExportReport
    Scan both packages and write a CSV report.
.NOTES
    Exit code 0 = analysis completed (even if dead code was found).
    The script never fails the build - it is informational only.
#>
[CmdletBinding()]
param(
    [switch]$IncludeFunctions,
    [switch]$ExportReport
)

. "$PSScriptRoot\toolkit-common.ps1"

Write-SectionHeader "Dead Code Detection - Heuristic Analysis"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$srcDir = Get-SrcDir
$scanDirs = @($srcDir)
if ($IncludeFunctions) {
    $funcSrc = Join-Path (Get-FunctionsDir) "src"
    if (Test-Path $funcSrc) { $scanDirs += $funcSrc }
}

# Regex character class matching a single or double quote.
# Using hex escapes avoids PowerShell string-terminator confusion.
$qt = '[\x27\x22]'

# Files/dirs to exclude from "dead file" detection (entry points by convention)
$entryPointPatterns = @(
    'app[\\/]api[\\/]',
    'app[\\/].*page[\\/]',
    'app[\\/].*layout[\\/]',
    'app[\\/].*loading[\\/]',
    'app[\\/].*error[\\/]',
    'app[\\/].*not-found',
    'app[\\/]global-error',
    'app[\\/]template',
    'app[\\/]default',
    'middleware[\\/]',
    'instrumentation[\\/]',
    '\.test\.',
    '\.spec\.',
    '\.d\.ts$',
    'index\.(ts|tsx)$'
)

# ---------------------------------------------------------------------------
# Collect all source files
# ---------------------------------------------------------------------------
$allFiles = @()
$deadFiles = @()

foreach ($dir in $scanDirs) {
    if (-not (Test-Path $dir)) { continue }

    $files = Get-ChildItem $dir -Recurse -Include *.ts,*.tsx -File |
        Where-Object {
            $rel = $_.FullName.Substring($dir.Length)
            $isTest = $rel -match '\.test\.' -or $rel -match '\.spec\.' -or $rel -match '\.d\.ts$'
            -not $isTest
        }

    foreach ($file in $files) {
        $allFiles += [PSCustomObject]@{
            File      = $file
            Directory = $dir
            Relative  = $file.FullName.Substring($dir.Length).TrimStart('\', '/')
        }
    }
}

Write-Info "Scanning $($allFiles.Count) source file(s) across $($scanDirs.Count) directory/directories."

# ---------------------------------------------------------------------------
# Build a combined content index for fast searching
# ---------------------------------------------------------------------------
$contentIndex = @{}
foreach ($entry in $allFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($entry.File.FullName)
        if ($content) {
            $contentIndex[$entry.File.FullName] = $content
        }
    } catch {
        # Skip files that cannot be read
    }
}

# Combine all content into one string for searching
$allContent = ($contentIndex.Values | Out-String)

# ---------------------------------------------------------------------------
# File-level dead code detection
# ---------------------------------------------------------------------------
Write-SubHeader "Potentially Unused Files"

foreach ($entry in $allFiles) {
    $rel = $entry.Relative
    $isEntryPoint = $false
    foreach ($pattern in $entryPointPatterns) {
        if ($rel -match $pattern) { $isEntryPoint = $true; break }
    }
    if ($isEntryPoint) { continue }

    # Compute the @/ import specifier for this file
    # e.g., src/components/Button.tsx -> @/components/Button
    $specifier = $entry.Relative -replace '\.(ts|tsx)$', ''
    $specifier = $specifier -replace '\\', '/'
    $atSpec = "@/$specifier"

    # Also compute the filename without extension (for relative imports)
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($entry.File.Name)

    # Search for this file being imported anywhere
    $imported = $false

    # Search for @/ specifier
    $escapedSpec = [regex]::Escape($atSpec)
    $fromPattern = "from\s+$qt" + $escapedSpec
    $importPattern = "import\s*\($qt" + $escapedSpec
    $requirePattern = "require\s*\($qt" + $escapedSpec

    if ($allContent -match $fromPattern -or
        $allContent -match $importPattern -or
        $allContent -match $requirePattern) {
        $imported = $true
    }

    # If not found via @/ specifier, check relative imports
    if (-not $imported) {
        $escapedName = [regex]::Escape($fileName)
        $fromRelPattern = "from\s+$qt.*" + $escapedName + $qt
        $importRelPattern = "import\s*\($qt.*" + $escapedName + $qt
        if ($allContent -match $fromRelPattern -or
            $allContent -match $importRelPattern) {
            $imported = $true
        }
    }

    if (-not $imported) {
        $deadFiles += $entry
        Write-WarningItem $entry.Relative
    }
}

if ($deadFiles.Count -eq 0) {
    Write-Success "No potentially unused files detected (all files appear to be imported)."
} else {
    Write-Info "$($deadFiles.Count) potentially unused file(s) found - review manually before deleting."
}

# ---------------------------------------------------------------------------
# Export-level dead code detection (simplified)
# ---------------------------------------------------------------------------
Write-SubHeader "Potentially Unused Exports"

$deadExports = @()

foreach ($entry in $allFiles) {
    $content = $contentIndex[$entry.File.FullName]
    if (-not $content) { continue }

    # Extract exported symbol names
    # Matches: export function Foo, export const Foo, export class Foo,
    #          export type Foo, export interface Foo, export enum Foo
    $exportPattern = 'export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)'
    $matches = [regex]::Matches($content, $exportPattern)

    foreach ($match in $matches) {
        $symbolName = $match.Groups[1].Value

        # Search for this symbol being imported in any OTHER file
        $symbolImported = $false
        $escapedSymbol = [regex]::Escape($symbolName)

        foreach ($otherEntry in $allFiles) {
            if ($otherEntry.File.FullName -eq $entry.File.FullName) { continue }
            $otherContent = $contentIndex[$otherEntry.File.FullName]
            if (-not $otherContent) { continue }

            # Check if symbol appears in an import statement
            $bracePattern = '\{\s*[^}]*\b' + $escapedSymbol + '\b[^}]*\s*\}'
            if ($otherContent -match $bracePattern -and
                $otherContent -match 'import\s*\{') {
                $symbolImported = $true
                break
            }
        }

        if (-not $symbolImported) {
            $deadExports += [PSCustomObject]@{
                Symbol = $symbolName
                File   = $entry.Relative
            }
        }
    }
}

# Display dead exports (limit to 50 for readability)
if ($deadExports.Count -eq 0) {
    Write-Success "No potentially unused exports detected."
} else {
    $deadExports | Select-Object -First 50 | ForEach-Object {
        Write-WarningItem "$($_.Symbol)  (in $($_.File))"
    }
    if ($deadExports.Count -gt 50) {
        Write-Info "... and $($deadExports.Count - 50) more (see CSV report if -ExportReport was used)."
    }
    Write-Info "$($deadExports.Count) potentially unused export(s) found - review manually."
}

# ---------------------------------------------------------------------------
# CSV report (optional)
# ---------------------------------------------------------------------------
if ($ExportReport) {
    $reportPath = Join-Path (Get-ProjectRoot) "dead-code-report.csv"
    $reportData = @()

    $deadFiles | ForEach-Object {
        $reportData += [PSCustomObject]@{
            Type = "UnusedFile"
            Name = $_.Relative
            Path = $_.File.FullName
        }
    }
    $deadExports | ForEach-Object {
        $reportData += [PSCustomObject]@{
            Type = "UnusedExport"
            Name = $_.Symbol
            Path = $_.File
        }
    }

    if ($reportData.Count -gt 0) {
        $reportData | Export-Csv $reportPath -NoTypeInformation
        Write-Info "CSV report written to: $reportPath"
    } else {
        Write-Info "No dead code found - no CSV report generated."
    }
}

# ---------------------------------------------------------------------------
# Summary (informational only - never fails)
# ---------------------------------------------------------------------------
Write-SectionHeader "Dead Code Summary"
Write-Info "Potentially unused files:   $($deadFiles.Count)"
Write-Info "Potentially unused exports: $($deadExports.Count)"
Write-Host ""
Write-Host "  NOTE: This is a heuristic analysis. Review each result manually" -ForegroundColor Yellow
Write-Host "  before deleting code. False positives are expected for" -ForegroundColor Yellow
Write-Host "  convention-based entry points, dynamic imports, and re-exports." -ForegroundColor Yellow
Write-Host ""
Write-Success "Dead code analysis complete."
exit 0