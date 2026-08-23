#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repository       = 'ger1e/cti-enrichment-gateway'
$RequiredBranch   = 'main'
$RequiredStatus   = 'Tooling smoke'
$RepoRoot         = Split-Path -Parent $PSScriptRoot
$BootstrapPath    = Join-Path $PSScriptRoot 'bootstrap-vercel.ps1'
$AllowedOrigins   = @(
    'https://github.com/ger1e/cti-enrichment-gateway.git',
    'https://github.com/ger1e/cti-enrichment-gateway',
    'git@github.com:ger1e/cti-enrichment-gateway.git'
)

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE"
    }
}

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    $output = (& $FilePath @Arguments 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE"
    }
    return $output
}

function Ensure-GitHubCli {
    $gh = Get-Command gh.exe -ErrorAction SilentlyContinue
    if (-not $gh) {
        $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
        if (-not $winget) {
            throw 'GitHub CLI (gh.exe) is required and could not be installed automatically because winget is unavailable.'
        }

        Write-Host 'Installing GitHub CLI...'
        Invoke-NativeChecked $winget.Source install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements --silent
        Refresh-ProcessPath
        $gh = Get-Command gh.exe -ErrorAction SilentlyContinue
    }

    if (-not $gh) {
        throw 'GitHub CLI (gh.exe) is required but is not available in PATH.'
    }

    & $gh.Source auth status --hostname github.com *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'GitHub CLI authentication is required. Complete the browser login flow once.'
        Invoke-NativeChecked $gh.Source auth login --hostname github.com --git-protocol https --web
    }

    & $gh.Source auth status --hostname github.com *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'GitHub CLI auth status is not healthy after login.'
    }

    $admin = Invoke-NativeCapture $gh.Source api "repos/$Repository" --jq '.permissions.admin'
    if ($admin.Trim().ToLowerInvariant() -ne 'true') {
        throw "The authenticated GitHub account does not have admin permission on $Repository."
    }

    return $gh.Source
}

function Assert-ExactOriginMain {
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
        throw "Run scripts/finalize.ps1 from a Git clone of $Repository."
    }

    Push-Location $RepoRoot
    try {
        $origin = Invoke-NativeCapture git.exe remote get-url origin
        if ($origin -notin $AllowedOrigins) {
            throw "Unexpected origin '$origin'. Refusing to finalize an unapproved repository."
        }

        $branch = Invoke-NativeCapture git.exe branch --show-current
        if ($branch -ne $RequiredBranch) {
            throw "Checkout must be on main; found '$branch'."
        }

        $dirty = Invoke-NativeCapture git.exe status --porcelain
        if (-not [string]::IsNullOrWhiteSpace($dirty)) {
            throw 'Repository has modified or untracked files. Refusing to finalize dirty source.'
        }

        Invoke-NativeChecked git.exe fetch --depth 1 origin main
        $fetchedHead = Invoke-NativeCapture git.exe rev-parse FETCH_HEAD
        $currentHead = Invoke-NativeCapture git.exe rev-parse HEAD
        if ($currentHead -ne $fetchedHead) {
            throw "Local checkout is stale and does not match the current origin/main ($fetchedHead). Pull main and rerun."
        }

        return $currentHead
    } finally {
        Pop-Location
    }
}

function Assert-ToolingSmokeSuccess {
    param(
        [Parameter(Mandatory = $true)][string]$Gh,
        [Parameter(Mandatory = $true)][string]$Commit
    )

    $json = Invoke-NativeCapture $Gh api "repos/$Repository/commits/$Commit/status"
    $status = $json | ConvertFrom-Json
    $matching = @($status.statuses | Where-Object { $_.context -eq $RequiredStatus })
    if ($matching.Count -eq 0) {
        throw "Required status '$RequiredStatus' is missing from commit $Commit."
    }

    $latest = $matching | Select-Object -First 1
    if ($latest.state -ne 'success') {
        throw "Required status '$RequiredStatus' is '$($latest.state)' on commit $Commit; success is required before finalization."
    }

    Write-Host "Verified $RequiredStatus = success on $Commit."
}

function Assert-PrivateFreeGovernance {
    param([Parameter(Mandatory = $true)][string]$Gh)

    $repoJson = Invoke-NativeCapture $Gh api "repos/$Repository"
    $repo = $repoJson | ConvertFrom-Json
    if (-not $repo.private) {
        throw 'Repository governance policy expects this repository to remain private.'
    }

    $branchJson = Invoke-NativeCapture $Gh api "repos/$Repository/branches/$RequiredBranch"
    $branch = $branchJson | ConvertFrom-Json
    if ($branch.protected) {
        Write-Host 'Server-side branch protection is enabled; procedural controls remain valid.'
    } else {
        Write-Host 'Server-side branch protection is unavailable on the current private/free plan.'
        Write-Host "Procedural gate active: exact origin/main + clean tree + exact remote SHA + '$RequiredStatus' success before deployment."
    }
}

Write-Host '=== CTI Enrichment Gateway / finalization ==='
Write-Host 'This script never reads or prints provider secret values. Vercel secret entry remains inside the hardened bootstrap.'
Write-Host 'Governance mode: private/free procedural enforcement; server-side branch protection is optional when the GitHub plan supports it.'
Write-Host ''

$commit = Assert-ExactOriginMain
$gh = Ensure-GitHubCli
Assert-PrivateFreeGovernance -Gh $gh
Assert-ToolingSmokeSuccess -Gh $gh -Commit $commit

$commitBeforeDeploy = Assert-ExactOriginMain
if ($commitBeforeDeploy -ne $commit) {
    throw 'origin/main changed during pre-deployment verification. Refusing to deploy a moving target.'
}

if (-not (Test-Path $BootstrapPath)) {
    throw 'scripts/bootstrap-vercel.ps1 is missing. Production deployment cannot continue.'
}

Write-Host ''
Write-Host 'Procedural GitHub gate verified. Starting the hardened exact-main Vercel bootstrap/deployment...'
& $BootstrapPath
if ($LASTEXITCODE -ne 0) {
    throw "bootstrap-vercel.ps1 failed with exit code $LASTEXITCODE"
}

Assert-PrivateFreeGovernance -Gh $gh
Assert-ToolingSmokeSuccess -Gh $gh -Commit $commit
$finalCommit = Assert-ExactOriginMain
if ($finalCommit -ne $commit) {
    throw 'origin/main changed during production deployment. Re-run finalization against the new verified main.'
}

Write-Host ''
Write-Host "Finalization complete for $Repository@$finalCommit."
Write-Host "Private/free governance verified: exact main, clean source, successful '$RequiredStatus', and exact-SHA deployment checks completed."
