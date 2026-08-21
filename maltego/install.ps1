#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$GatewayUrl = 'https://cti-enrichment-gateway.vercel.app',
    [switch]$Check,
    [switch]$Repair,
    [switch]$Update,
    [switch]$Uninstall,
    [switch]$DeleteCredential,
    [switch]$NonInteractive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bootstrap = Join-Path $Root 'bootstrap_entry.py'

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Ensure-Winget {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw 'winget is required when a compatible Python is not already installed. Install Microsoft App Installer and rerun install.ps1.'
    }
}

function Test-PythonCandidate {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Prefix = @()
    )
    try {
        $raw = (& $Command @Prefix -c 'import sys; print(".".join(map(str, sys.version_info[:3])))' 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) { return $false }
        $version = [Version]$raw
        return ($version.Major -gt 3 -or ($version.Major -eq 3 -and $version.Minor -ge 10))
    } catch {
        return $false
    }
}

function Find-CompatiblePython {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        foreach ($selector in @('-3.12', '-3.13', '-3.11', '-3.10', '-3')) {
            if (Test-PythonCandidate -Command $py.Source -Prefix @($selector)) {
                return [PSCustomObject]@{ Command = $py.Source; Prefix = @($selector) }
            }
        }
    }

    foreach ($name in @('python3.12.exe', 'python3.13.exe', 'python3.11.exe', 'python3.10.exe', 'python.exe', 'python3.exe')) {
        $candidate = Get-Command $name -ErrorAction SilentlyContinue
        if ($candidate -and (Test-PythonCandidate -Command $candidate.Source)) {
            return [PSCustomObject]@{ Command = $candidate.Source; Prefix = @() }
        }
    }
    return $null
}

function Install-CompatiblePython {
    Ensure-Winget
    foreach ($package in @('Python.Python.3.12', 'Python.Python.3.13')) {
        Write-Host "Installing compatible Python through winget ($package)..."
        & winget.exe install --id $package -e --source winget --accept-package-agreements --accept-source-agreements --silent
        if ($LASTEXITCODE -eq 0) {
            Refresh-ProcessPath
            $candidate = Find-CompatiblePython
            if ($candidate) { return $candidate }
        }
    }
    throw 'Python >=3.10 installation failed. Install Python 3.12 or 3.13 and rerun install.ps1.'
}

function Resolve-BootstrapPython {
    $candidate = Find-CompatiblePython
    if ($candidate) { return $candidate }
    return Install-CompatiblePython
}

function Invoke-Bootstrap {
    param([Parameter(Mandatory = $true)]$Python)

    $arguments = @()
    $arguments += $Python.Prefix
    $arguments += $Bootstrap
    $arguments += @('--gateway-url', $GatewayUrl)
    if ($Check) { $arguments += '--check' }
    if ($Repair) { $arguments += '--repair' }
    if ($Update) { $arguments += '--update' }
    if ($Uninstall) { $arguments += '--uninstall' }
    if ($DeleteCredential) { $arguments += '--delete-credential' }
    if ($NonInteractive) { $arguments += '--non-interactive' }
    if ($VerbosePreference -ne 'SilentlyContinue') { $arguments += '--verbose' }

    & $Python.Command @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Maltego bootstrap failed with exit code $LASTEXITCODE."
    }
}

if ($DeleteCredential -and -not $Uninstall) {
    throw '-DeleteCredential is valid only with -Uninstall.'
}

Write-Host '=== CTI Gateway / Maltego Local Transforms ==='
Write-Host 'Windows uses current-user DPAPI for the gateway token; vendor API credentials remain server-side in Vercel.'
$Python = Resolve-BootstrapPython
Invoke-Bootstrap -Python $Python
