$files = @(
    'd:/projects/admin-dashboard/scripts/Invoke-ProjectValidation.ps1',
    'd:/projects/admin-dashboard/scripts/Get-ProjectHealth.ps1',
    'd:/projects/admin-dashboard/scripts/Get-ReleaseReadiness.ps1'
)
foreach ($f in $files) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$tokens, [ref]$errors)
    if ($errors.Count -eq 0) {
        Write-Host 'OK: $f'
    } else {
        Write-Host 'ERROR: $f'
        foreach ($e in $errors) {
            Write-Host '  L$($e.Extent.StartLineNumber): $($e.Message)'
        }
    }
}
Write-Host 'PARSE COMPLETE'
