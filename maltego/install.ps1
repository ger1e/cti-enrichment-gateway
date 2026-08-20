#Requires -Version 5.1
[CmdletBinding()]
param([string]$GatewayUrl = 'https://cti-enrichment-gateway.vercel.app')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}
function Ensure-Winget {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'winget is required when Python is not already installed.' }
}
function Ensure-Python {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) { return $py.Source }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { return $python.Source }
    Ensure-Winget
    Write-Host 'Installing Python 3.13...'
    & winget.exe install --id Python.Python.3.13 -e --source winget --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) { throw 'Python installation failed.' }
    Refresh-ProcessPath
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) { return $py.Source }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { return $python.Source }
    throw 'Python was installed but is not visible in PATH. Reopen PowerShell and rerun install.ps1.'
}

Write-Host '=== CTI Gateway / Maltego Local Transforms ==='
$BootstrapPython = Ensure-Python
if (-not (Test-Path $Python)) {
    if ((Split-Path -Leaf $BootstrapPython) -ieq 'py.exe') { & $BootstrapPython -3 -m venv $Venv } else { & $BootstrapPython -m venv $Venv }
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create Python virtual environment.' }
}
& $Python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'Failed to upgrade pip.' }
& $Python -m pip install --prefer-binary -r (Join-Path $Root 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Failed to install Maltego TRX dependencies.' }

Push-Location $Root
try {
    Write-Host 'Running local integration tests...'
    & $Python -m unittest discover -s tests -v
    if ($LASTEXITCODE -ne 0) { throw 'Maltego integration tests failed.' }

    $storedTokenConfigured = $false
    & $Python (Join-Path $Root 'credential_store.py') check *> $null
    if ($LASTEXITCODE -eq 0) {
        $storedTokenConfigured = $true
        Write-Host 'Reusing stored gateway token protected with current-user Windows DPAPI.'
    }

    if (-not $storedTokenConfigured) {
        $secure = Read-Host 'CTI_GATEWAY_TOKEN (stored with Windows DPAPI for this user)' -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
            if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Gateway token cannot be empty.' }
            $plain | & $Python (Join-Path $Root 'credential_store.py') save
            if ($LASTEXITCODE -ne 0) { throw 'Failed to store the gateway token with Windows DPAPI.' }
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
            $plain = $null
        }
    }

    [Environment]::SetEnvironmentVariable('CTI_GATEWAY_URL', $GatewayUrl, 'User')
    $env:CTI_GATEWAY_URL = $GatewayUrl
    Write-Host 'Generating Maltego local-transform package...'
    & $Python (Join-Path $Root 'project.py') mtz
    if ($LASTEXITCODE -ne 0) { throw 'Failed to generate the Maltego MTZ package.' }
    Write-Host 'Available transforms:'
    & $Python (Join-Path $Root 'project.py') list
    if ($LASTEXITCODE -ne 0) { throw 'Failed to list Maltego transforms.' }
} finally { Pop-Location }

Write-Host ''
Write-Host 'Installation complete.'
Write-Host "Gateway: $GatewayUrl"
Write-Host "Import this file into Maltego Graph Desktop: $Root\cti-enrichment-gateway-local.mtz"
Write-Host 'Vendor API credentials remain in Vercel; Maltego stores only the local DPAPI-protected gateway token.'
