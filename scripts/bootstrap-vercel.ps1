#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectName = 'cti-enrichment-gateway'
$ProjectId   = 'prj_ojUpOTw8x8KOj9CrTs8jih1mrPjo'
$TeamSlug    = 'geri6'
$OrgId       = 'team_hXokufMlDFuhPPT5r8jPf4aH'
$RepoUrl     = 'https://github.com/ger1e/cti-enrichment-gateway.git'

$SecretNames = @(
    'ABUSECH_API_KEY',
    'ABUSEIPDB_API_KEY',
    'GREYNOISE_API_KEY',
    'VIRUSTOTAL_API_KEY',
    'HYBRID_ANALYSIS_API_KEY',
    'URLSCAN_API_KEY',
    'WEBAMON_API_KEY',
    'SENTRY_AUTH_TOKEN',
    'OTX_API_KEY',
    'SHODAN_API_KEY',
    'CENSYS_PAT',
    'PULSEDIVE_API_KEY',
    'SECURITYTRAILS_API_KEY',
    'IPINFO_TOKEN',
    'NVD_API_KEY',
    'CLOUDFLARE_RADAR_TOKEN'
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

function Ensure-Winget {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw 'winget is required to install missing Git/Node.js automatically. Install Microsoft App Installer, then rerun this script.'
    }
}

function Ensure-Git {
    if (Get-Command git.exe -ErrorAction SilentlyContinue) { return }

    Ensure-Winget
    Write-Host 'Installing Git...'
    Invoke-NativeChecked winget.exe install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent
    Refresh-ProcessPath

    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        throw 'Git installation completed but git.exe is not visible in PATH. Reopen PowerShell and rerun the script.'
    }
}

function Ensure-Node {
    if ((Get-Command node.exe -ErrorAction SilentlyContinue) -and (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { return }

    Ensure-Winget
    Write-Host 'Installing Node.js LTS...'
    Invoke-NativeChecked winget.exe install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --silent
    Refresh-ProcessPath

    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'Node.js installation completed but node/npm are not visible in PATH. Reopen PowerShell and rerun the script.'
    }
}

function Ensure-VercelCli {
    $vercel = Get-Command vercel.cmd -ErrorAction SilentlyContinue
    if (-not $vercel) {
        Write-Host 'Installing latest Vercel CLI...'
        Invoke-NativeChecked npm.cmd install -g vercel@latest
        Refresh-ProcessPath
        $vercel = Get-Command vercel.cmd -ErrorAction SilentlyContinue
    }

    if (-not $vercel) {
        throw 'Vercel CLI installation completed but vercel.cmd is not visible in PATH. Reopen PowerShell and rerun the script.'
    }

    return $vercel.Source
}

function Ensure-VercelLogin {
    param([Parameter(Mandatory = $true)][string]$Vercel)

    & $Vercel whoami *> $null
    if ($LASTEXITCODE -eq 0) { return }

    Write-Host 'Vercel login required. Complete the browser/email login flow once.'
    Invoke-NativeChecked $Vercel login
}

function Prepare-LinkedWorkspace {
    param([Parameter(Mandatory = $true)][string]$Vercel)

    $workDir = Join-Path ([IO.Path]::GetTempPath()) 'cti-enrichment-gateway-bootstrap'
    New-Item -ItemType Directory -Path $workDir -Force | Out-Null
    Push-Location $workDir

    try {
        if (-not (Test-Path '.git')) {
            Invoke-NativeChecked git.exe init
        }

        & git.exe remote get-url origin *> $null
        if ($LASTEXITCODE -eq 0) {
            Invoke-NativeChecked git.exe remote set-url origin $RepoUrl
        } else {
            Invoke-NativeChecked git.exe remote add origin $RepoUrl
        }

        New-Item -ItemType Directory -Path '.vercel' -Force | Out-Null
        $projectJson = @{ orgId = $OrgId; projectId = $ProjectId } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText((Join-Path $workDir '.vercel\project.json'), $projectJson, (New-Object Text.UTF8Encoding($false)))

        Write-Host "Linked local bootstrap workspace to $TeamSlug/$ProjectName."

        Write-Host 'Connecting GitHub repository to the Vercel project...'
        & $Vercel git connect --scope $TeamSlug
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'Git connection was not completed. Environment-variable setup will continue; you can rerun `vercel git connect --scope geri6` later.'
        }

        return $workDir
    } catch {
        Pop-Location
        throw
    }
}

function Set-SensitiveVercelEnv {
    param(
        [Parameter(Mandatory = $true)][string]$Vercel,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Value
    )

    foreach ($target in @('production', 'preview')) {
        $Value | & $Vercel env add $Name $target --sensitive --force --scope $TeamSlug
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to set $Name for $target."
        }
    }
}

Write-Host '=== CTI Enrichment Gateway / Vercel bootstrap ==='
Write-Host 'Secrets are entered locally with masked input and are never written to GitHub.'
Write-Host 'Press Enter on any secret you do not have yet; it will be skipped.'
Write-Host ''

Ensure-Git
Ensure-Node
$Vercel = Ensure-VercelCli

Write-Host "Vercel CLI: $(& $Vercel --version)"
Ensure-VercelLogin -Vercel $Vercel
$workspace = Prepare-LinkedWorkspace -Vercel $Vercel

try {
    foreach ($name in $SecretNames) {
        $secure = Read-Host "$name (Enter = skip)" -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }

        if ([string]::IsNullOrWhiteSpace($plain)) {
            Write-Host "Skipped $name"
            $plain = $null
            continue
        }

        Set-SensitiveVercelEnv -Vercel $Vercel -Name $name -Value $plain
        Write-Host "Added/updated $name for Production + Preview"
        $plain = $null
        [GC]::Collect()
    }

    Write-Host ''
    Write-Host 'Configured Vercel environment variables:'
    & $Vercel env ls --scope $TeamSlug
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Could not list environment-variable names, but completed writes above were individually checked.'
    }
} finally {
    if ((Get-Location).Path -eq $workspace) {
        Pop-Location
    }
}

Write-Host ''
Write-Host 'Bootstrap complete.'
Write-Host 'No secret values were written to the repository.'
Write-Host 'Git auto-deploy will work once `vercel git connect` has completed successfully.'
