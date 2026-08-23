#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repository       = 'ger1e/cti-enrichment-gateway'
$RequiredBranch   = 'main'
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

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' is not available in PATH."
    }
    return $command.Source
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
        $git = Require-Command 'git.exe'
        $origin = Invoke-NativeCapture $git remote get-url origin
        if ($origin -notin $AllowedOrigins) {
            throw "Unexpected origin '$origin'. Refusing to finalize an unapproved repository."
        }

        $branch = Invoke-NativeCapture $git branch --show-current
        if ($branch -ne $RequiredBranch) {
            throw "Checkout must be on main; found '$branch'."
        }

        $dirty = Invoke-NativeCapture $git status --porcelain
        if (-not [string]::IsNullOrWhiteSpace($dirty)) {
            throw 'Repository has modified or untracked files. Refusing to finalize dirty source.'
        }

        Invoke-NativeChecked $git fetch --depth 1 origin main
        $fetchedHead = Invoke-NativeCapture $git rev-parse FETCH_HEAD
        $currentHead = Invoke-NativeCapture $git rev-parse HEAD
        if ($currentHead -ne $fetchedHead) {
            throw "Local checkout is stale and does not match the current origin/main ($fetchedHead). Pull main and rerun."
        }

        return $currentHead
    } finally {
        Pop-Location
    }
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
        Write-Host 'Server-side branch protection is enabled; local procedural controls remain additive.'
    } else {
        Write-Host 'Server-side branch protection is unavailable on the current private/free plan.'
        Write-Host 'Procedural gate active: exact origin/main + clean tree + local smoke suite + exact-SHA deployment checks.'
    }
}

function Invoke-LocalToolingSmoke {
    Push-Location $RepoRoot
    try {
        $npm = Require-Command 'npm.cmd'
        $bash = Require-Command 'bash.exe'
        $python = Get-Command python.exe -ErrorAction SilentlyContinue
        if (-not $python) { $python = Get-Command python3.exe -ErrorAction SilentlyContinue }
        if (-not $python) { throw "Required command 'python.exe' or 'python3.exe' is not available in PATH." }
        $shellcheck = Require-Command 'shellcheck.exe'

        Write-Host 'Running locked dependency validation...'
        Invoke-NativeChecked $npm ci --ignore-scripts
        Invoke-NativeChecked $npm audit --omit=dev

        Write-Host 'Running repository checks and Node tests...'
        Invoke-NativeChecked $npm run check

        Write-Host 'Running Maltego Python tests and compile validation...'
        Push-Location (Join-Path $RepoRoot 'maltego')
        try {
            Invoke-NativeChecked $python.Source -m unittest discover -s tests -v
        } finally {
            Pop-Location
        }
        Invoke-NativeChecked $python.Source -m compileall -q (Join-Path $RepoRoot 'maltego')

        Write-Host 'Running shell syntax and ShellCheck validation...'
        Invoke-NativeChecked $bash -n (Join-Path $RepoRoot 'maltego/install.sh')
        Invoke-NativeChecked $shellcheck (Join-Path $RepoRoot 'maltego/install.sh')

        Write-Host 'Running PowerShell syntax validation...'
        $files = @(
            'scripts/bootstrap-vercel.ps1',
            'scripts/finalize.ps1',
            'maltego/install.ps1'
        )
        foreach ($file in $files) {
            $tokens = $null
            $parseErrors = $null
            [System.Management.Automation.Language.Parser]::ParseFile(
                (Resolve-Path (Join-Path $RepoRoot $file)),
                [ref]$tokens,
                [ref]$parseErrors
            ) | Out-Null
            if ($parseErrors.Count -gt 0) {
                $messages = ($parseErrors | ForEach-Object { $_.Message }) -join '; '
                throw "PowerShell syntax errors in $file: $messages"
            }
        }

        Write-Host 'Local Tooling smoke passed.'
    } finally {
        Pop-Location
    }
}

Write-Host '=== CTI Enrichment Gateway / finalization ==='
Write-Host 'This script never reads or prints provider secret values. Vercel secret entry remains inside the hardened bootstrap.'
Write-Host 'Governance mode: private/free procedural enforcement; server-side branch protection is optional when the GitHub plan supports it.'
Write-Host ''

$commit = Assert-ExactOriginMain
$gh = Ensure-GitHubCli
Assert-PrivateFreeGovernance -Gh $gh
Invoke-LocalToolingSmoke

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
$finalCommit = Assert-ExactOriginMain
if ($finalCommit -ne $commit) {
    throw 'origin/main changed during production deployment. Re-run finalization against the new verified main.'
}

Write-Host ''
Write-Host "Finalization complete for $Repository@$finalCommit."
Write-Host 'Private/free governance verified: exact main, clean source, local smoke suite, and exact-SHA deployment checks completed.'
