#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectName             = 'para11ax'
$ProjectId               = 'prj_ojUpOTw8x8KOj9CrTs8jih1mrPjo'
$TeamSlug                = 'geri6'
$OrgId                   = 'team_hXokufMlDFuhPPT5r8jPf4aH'
$RepoUrl                 = 'https://github.com/ger1e/para11ax.git'
$ProductionAlias         = 'para11ax.vercel.app'
$RequiredNodeMajor       = 24
$PinnedVercelCliVersion  = '58.4.4'
$GatewayTokenDir         = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PARA11AX'
$GatewayTokenFile        = Join-Path $GatewayTokenDir 'gateway-token.dpapi'
$RepoRoot                = Split-Path -Parent $PSScriptRoot

$SecretNames = @(
    'PARA11AX_TOKEN',
    'PARA11AX_USER_SCANNER_URL',
    'PARA11AX_USER_SCANNER_TOKEN',
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
    'IPINFO_TOKEN',
    'MALPEDIA_API_TOKEN',
    'NVD_API_KEY',
    'CLOUDFLARE_RADAR_TOKEN',
    'RANSOMWARE_LIVE_API_KEY',
    'MODAT_API_KEY'
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

function New-GatewayToken {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }

    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Convert-SecureStringToPlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Secure)

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Save-GatewayToken {
    param([Parameter(Mandatory = $true)][string]$Token)

    $tokenBytes = [Text.Encoding]::UTF8.GetBytes($Token)
    $protectedBytes = $null
    $encoded = $null
    try {
        $protectedBytes = [Security.Cryptography.ProtectedData]::Protect(
            $tokenBytes,
            $null,
            [Security.Cryptography.DataProtectionScope]::CurrentUser
        )
        New-Item -ItemType Directory -Path $GatewayTokenDir -Force | Out-Null
        $encoded = [Convert]::ToBase64String($protectedBytes)
        [IO.File]::WriteAllText($GatewayTokenFile, $encoded, (New-Object Text.UTF8Encoding($false)))
    } finally {
        if ($tokenBytes) { [Array]::Clear($tokenBytes, 0, $tokenBytes.Length) }
        if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
        $encoded = $null
    }
}

function Get-StoredGatewayToken {
    if (-not (Test-Path $GatewayTokenFile)) { return $null }

    try {
        $encoded = [IO.File]::ReadAllText($GatewayTokenFile).Trim()
        $protectedBytes = [Convert]::FromBase64String($encoded)
        try {
            $tokenBytes = [Security.Cryptography.ProtectedData]::Unprotect(
                $protectedBytes,
                $null,
                [Security.Cryptography.DataProtectionScope]::CurrentUser
            )
            try {
                $token = [Text.Encoding]::UTF8.GetString($tokenBytes).Trim()
                if ([string]::IsNullOrWhiteSpace($token)) { return $null }
                return $token
            } finally {
                if ($tokenBytes) { [Array]::Clear($tokenBytes, 0, $tokenBytes.Length) }
            }
        } finally {
            if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
        }
    } catch {
        Write-Warning 'Stored gateway token could not be read with current-user DPAPI; a replacement will be created.'
        return $null
    }
}

function Ensure-Winget {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw 'winget is required to install or align Git/Node.js automatically. Install Microsoft App Installer, then rerun this script.'
    }
}

function Ensure-Git {
    if (Get-Command git.exe -ErrorAction SilentlyContinue) { return }
    Ensure-Winget
    Invoke-NativeChecked winget.exe install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements
    Refresh-ProcessPath
    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { throw 'Git installation completed but git.exe is not visible in PATH.' }
}

function Ensure-Node24 {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $major = $null
    if ($node) {
        $version = Invoke-NativeCapture node.exe --version
        if ($version -match '^v(?<major>\d+)\.') { $major = [int]$Matches.major }
    }
    if ($major -eq $RequiredNodeMajor) { return }

    Ensure-Winget
    Invoke-NativeChecked winget.exe install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
    Refresh-ProcessPath
    $version = Invoke-NativeCapture node.exe --version
    if ($version -notmatch '^v24\.') { throw "Node.js 24.x is required; detected $version after installation." }
}

function Ensure-NpmPolicy {
    if (-not (Test-Path '.npmrc')) { throw '.npmrc is missing.' }
    $required = @('engine-strict=true', 'audit=true', 'fund=false', 'save-exact=true')
    $lines = Get-Content '.npmrc'
    foreach ($line in $required) {
        if ($lines -notcontains $line) { throw ".npmrc is missing required policy: $line" }
    }
}

function Ensure-VercelCli {
    $current = $null
    if (Get-Command vercel.exe -ErrorAction SilentlyContinue) {
        try { $current = Invoke-NativeCapture vercel.exe --version } catch { $current = $null }
    }
    if ($current -and $current -match [regex]::Escape($PinnedVercelCliVersion)) { return }
    Invoke-NativeChecked npm.cmd install --global "vercel@$PinnedVercelCliVersion"
    Refresh-ProcessPath
}

function Ensure-Repo {
    if (Test-Path (Join-Path $RepoRoot '.git')) { return }
    $parent = Split-Path -Parent $RepoRoot
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Invoke-NativeChecked git.exe clone $RepoUrl $RepoRoot
}

function Set-VercelSecret {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $temp = [IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($temp, $Value, (New-Object Text.UTF8Encoding($false)))
        Get-Content -Raw $temp | & vercel.exe env add $Name production --yes 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Get-Content -Raw $temp | & vercel.exe env update $Name production --yes 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Unable to set Vercel environment variable $Name." }
        }
    } finally {
        Remove-Item $temp -Force -ErrorAction SilentlyContinue
    }
}

function Ensure-GatewayToken {
    $token = Get-StoredGatewayToken
    if ([string]::IsNullOrWhiteSpace($token)) {
        $token = New-GatewayToken
        Save-GatewayToken -Token $token
    }
    Set-VercelSecret -Name 'PARA11AX_TOKEN' -Value $token
    return $token
}

function Configure-Secrets {
    param([Parameter(Mandatory = $true)][string]$GatewayToken)

    foreach ($name in $SecretNames) {
        if ($name -eq 'PARA11AX_TOKEN') { continue }
        $existing = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ([string]::IsNullOrWhiteSpace($existing)) { $existing = [Environment]::GetEnvironmentVariable($name, 'User') }
        if ([string]::IsNullOrWhiteSpace($existing)) { $existing = [Environment]::GetEnvironmentVariable($name, 'Machine') }
        if ([string]::IsNullOrWhiteSpace($existing)) { continue }
        Set-VercelSecret -Name $name -Value $existing
    }
}

function Link-VercelProject {
    $env:VERCEL_ORG_ID = $OrgId
    $env:VERCEL_PROJECT_ID = $ProjectId
    Invoke-NativeChecked vercel.exe link --yes --project $ProjectName --scope $TeamSlug
}

function Deploy-Production {
    $output = Invoke-NativeCapture vercel.exe deploy --prod --yes --scope $TeamSlug
    if (-not $output) { throw 'Vercel production deployment did not return a deployment URL.' }
    Invoke-NativeChecked vercel.exe alias set $output $ProductionAlias --scope $TeamSlug
    return $output
}

Push-Location $RepoRoot
try {
    Ensure-Git
    Ensure-Node24
    Ensure-NpmPolicy
    Ensure-VercelCli
    Ensure-Repo
    Invoke-NativeChecked npm.cmd ci --ignore-scripts
    Invoke-NativeChecked npm.cmd audit --omit=dev
    Link-VercelProject
    $gatewayToken = Ensure-GatewayToken
    Configure-Secrets -GatewayToken $gatewayToken
    $deployment = Deploy-Production
    Write-Host "PARA11AX production deployed: $deployment"
    Write-Host "Production alias: https://$ProductionAlias"
    Write-Host "Gateway bearer stored with current-user DPAPI at: $GatewayTokenFile"
} finally {
    Pop-Location
}
