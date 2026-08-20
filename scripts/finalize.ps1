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

function Set-MainProtection {
    param([Parameter(Mandatory = $true)][string]$Gh)

    $payload = [ordered]@{
        required_status_checks = [ordered]@{
            strict = $true
            contexts = @($RequiredStatus)
        }
        enforce_admins = $true
        required_pull_request_reviews = [ordered]@{
            dismiss_stale_reviews = $true
            require_code_owner_reviews = $false
            required_approving_review_count = 0
        }
        restrictions = $null
        required_linear_history = $true
        allow_force_pushes = $false
        allow_deletions = $false
        required_conversation_resolution = $true
        lock_branch = $false
        allow_fork_syncing = $false
    } | ConvertTo-Json -Depth 8 -Compress

    $endpoint = "repos/$Repository/branches/main/protection"
    $null = ($payload | & $Gh api --method PUT $endpoint --input - 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'GitHub branch protection update failed. Confirm the authenticated account has repository admin access and the repository plan supports branch protection.'
    }
}

function Assert-MainProtection {
    param([Parameter(Mandatory = $true)][string]$Gh)

    $endpoint = "repos/$Repository/branches/main/protection"
    $json = Invoke-NativeCapture $Gh api $endpoint
    $protection = $json | ConvertFrom-Json

    if (-not $protection.required_status_checks -or -not $protection.required_status_checks.strict) {
        throw 'Branch protection verification failed: strict required status checks are not enabled.'
    }

    $contexts = @()
    if ($protection.required_status_checks.contexts) {
        $contexts += @($protection.required_status_checks.contexts)
    }
    if ($protection.required_status_checks.checks) {
        $contexts += @($protection.required_status_checks.checks | ForEach-Object { $_.context })
    }
    if ($RequiredStatus -notin $contexts) {
        throw "Branch protection verification failed: '$RequiredStatus' is not required."
    }

    if (-not $protection.enforce_admins.enabled) {
        throw 'Branch protection verification failed: administrators are not bound by protection.'
    }
    if (-not $protection.required_pull_request_reviews) {
        throw 'Branch protection verification failed: pull requests are not required.'
    }
    if ($protection.required_pull_request_reviews.required_approving_review_count -ne 0) {
        throw 'Branch protection verification failed: the solo-maintainer policy must require a PR without requiring self-approval.'
    }
    if ($protection.allow_force_pushes.enabled) {
        throw 'Branch protection verification failed: force pushes are allowed.'
    }
    if ($protection.allow_deletions.enabled) {
        throw 'Branch protection verification failed: branch deletion is allowed.'
    }
    if (-not $protection.required_linear_history.enabled) {
        throw 'Branch protection verification failed: linear history is not required.'
    }
    if (-not $protection.required_conversation_resolution.enabled) {
        throw 'Branch protection verification failed: review-conversation resolution is not required.'
    }

    Write-Host "Verified main protection: PR-only changes, strict '$RequiredStatus', admin enforcement, no force pushes/deletion."
}

Write-Host '=== CTI Enrichment Gateway / finalization ==='
Write-Host 'This script never reads or prints provider secret values. Vercel secret entry remains inside the hardened bootstrap.'
Write-Host ''

$commit = Assert-ExactOriginMain
$gh = Ensure-GitHubCli
Assert-ToolingSmokeSuccess -Gh $gh -Commit $commit

Write-Host 'Applying main branch protection...'
Set-MainProtection -Gh $gh
Assert-MainProtection -Gh $gh

$commitAfterProtection = Assert-ExactOriginMain
if ($commitAfterProtection -ne $commit) {
    throw 'origin/main changed during GitHub protection setup. Refusing to deploy a moving target.'
}

if (-not (Test-Path $BootstrapPath)) {
    throw 'scripts/bootstrap-vercel.ps1 is missing. Production deployment cannot continue.'
}

Write-Host ''
Write-Host 'GitHub protection verified. Starting the hardened exact-main Vercel bootstrap/deployment...'
& $BootstrapPath
if ($LASTEXITCODE -ne 0) {
    throw "bootstrap-vercel.ps1 failed with exit code $LASTEXITCODE"
}

Assert-MainProtection -Gh $gh
$finalCommit = Assert-ExactOriginMain
if ($finalCommit -ne $commit) {
    throw 'origin/main changed during production deployment. Re-run finalization against the new verified main.'
}

Write-Host ''
Write-Host "Finalization complete for $Repository@$finalCommit."
Write-Host "GitHub main protection is enforced and the hardened bootstrap completed production deployment/health verification."
