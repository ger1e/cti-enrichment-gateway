# Maltego local transforms for CTI Enrichment Gateway

This directory connects Maltego Graph Desktop to the private CTI enrichment gateway without exposing vendor API credentials to Maltego.

## Architecture

```text
Maltego Graph Desktop
        |
        | local transform (maltego-trx 1.7.0)
        v
CTI Gateway client
        |
        | HTTPS + one bearer token
        v
https://cti-enrichment-gateway.vercel.app/api/enrich
        |
        v
Gateway provider router / normalized evidence
```

The transform layer never receives Shodan, Censys, VirusTotal, Malpedia, GreyNoise or other vendor secrets. It knows only the gateway URL and the gateway bearer token.

## Install on Windows

From PowerShell in this directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1
```

The installer ensures Python is available, creates `.venv`, installs `maltego-trx==1.7.0`, runs the integration unit tests, prompts once for `CTI_GATEWAY_TOKEN`, protects that token with Windows DPAPI for the current Windows user, generates `cti-enrichment-gateway-local.mtz`, and lists the discovered transforms.

Import `cti-enrichment-gateway-local.mtz` into Maltego Graph Desktop.

## Transforms

- CTI Enrich IPv4 -> `maltego.IPv4Address`
- CTI Enrich IPv6 -> `maltego.IPv6Address`
- CTI Enrich Domain -> `maltego.Domain`
- CTI Enrich DNS Name -> `maltego.DNSName`
- CTI Enrich URL -> `maltego.URL`
- CTI Enrich Hash -> `maltego.Hash`
- CTI Enrich CVE -> `maltego.Phrase` (use a value such as `CVE-2026-1234`)

Transforms return normalized graph entities from gateway relationships, malware-family/actor context and graphable provider attributes. When provider evidence has no graphable relationship, a compact evidence Phrase is returned rather than silently returning nothing.

## Configuration

Non-secret values:

```text
CTI_GATEWAY_URL=https://cti-enrichment-gateway.vercel.app
MALTEGO_MAX_ENTITIES=50
MALTEGO_INCLUDE_PROVIDER_NODES=false
```

`MALTEGO_MAX_ENTITIES` is bounded to 1-250. `MALTEGO_INCLUDE_PROVIDER_NODES=true` adds explicit provider evidence nodes and is intentionally off by default to avoid graph clutter.

Secret resolution order:

1. `CTI_GATEWAY_TOKEN` environment variable, if explicitly set.
2. Windows DPAPI-protected token saved by `install.ps1` under the current user's local application-data directory.

No vendor API secret is stored in this directory or in the generated MTZ.

## Security behavior

- Remote gateway URLs must use HTTPS; HTTP is accepted only for localhost development.
- Redirects are refused so the bearer token cannot be forwarded to another host.
- Response bodies are capped at 2 MB.
- Gateway errors never include the bearer token.
- Local graph expansion is capped and deduplicated.
- Provider failures are surfaced as partial-result messages rather than terminating successful enrichment from other providers.

## Manual commands

```powershell
.\.venv\Scripts\python.exe project.py list
.\.venv\Scripts\python.exe project.py mtz
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
