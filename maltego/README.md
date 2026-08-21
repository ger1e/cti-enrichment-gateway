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
Gateway provider router / normalized evidence v2
```

The transform layer never receives provider secrets. It knows only the gateway URL and the gateway bearer token.

## Install on Windows

From PowerShell in this directory:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1
```

The installer ensures Python is available, creates `.venv`, installs `maltego-trx==1.7.0`, runs integration tests, prompts once for `CTI_GATEWAY_TOKEN`, protects that token with Windows DPAPI for the current Windows user, generates `cti-enrichment-gateway-local.mtz`, and lists discovered transforms.

Import `cti-enrichment-gateway-local.mtz` into Maltego Graph Desktop.

## Transforms

- CTI Enrich IPv4 -> `maltego.IPv4Address`
- CTI Enrich IPv6 -> `maltego.IPv6Address`
- CTI Enrich Domain -> `maltego.Domain`
- CTI Enrich DNS Name -> `maltego.DNSName`
- CTI Enrich URL -> `maltego.URL`
- CTI Enrich Hash -> `maltego.Hash`
- CTI Enrich CVE -> `maltego.Phrase`
- CTI Enrich MITRE ATT&CK -> `maltego.Phrase`
- CTI Enrich ASN -> `maltego.Phrase` input such as `AS3333`; graph output uses `maltego.AS` where appropriate
- CTI Enrich CIDR -> `maltego.Phrase` input such as `192.0.2.0/24` or `2001:db8::/32`

Transforms map normalized relationships, malware-family/actor context and graphable provider attributes. Evidence v2 additionally renders bounded Phrase nodes for provider provenance, corroboration, contradictions, freshness, huntability and separate KEV/EPSS/CVSS axes. Integrity fingerprints and parser versions are graphable; raw upstream hashes are deliberately not emitted as Maltego properties.

ATT&CK TAXII results are knowledge/mapping context, not IOC reputation or a maliciousness vote. CIDR remains a Phrase because no stable built-in network-prefix entity is assumed. ASN uses the stable AS entity when the mapper can do so without changing the input contract.

## Configuration

Non-secret values:

```text
CTI_GATEWAY_URL=https://cti-enrichment-gateway.vercel.app
MALTEGO_MAX_ENTITIES=50
MALTEGO_INCLUDE_PROVIDER_NODES=false
```

`MALTEGO_MAX_ENTITIES` is bounded to 1-250. Evidence-v2 provenance nodes are emitted when an integrity fingerprint exists; `MALTEGO_INCLUDE_PROVIDER_NODES=true` also forces provider evidence nodes for legacy/attribute-rich responses.

Secret resolution order:

1. `CTI_GATEWAY_TOKEN` environment variable, if explicitly set.
2. Windows DPAPI-protected token saved by `install.ps1` under the current user's local application-data directory.

No provider API secret is stored in this directory or in the generated MTZ.

## Security behavior

- Remote gateway URLs must use HTTPS; HTTP is accepted only for localhost development.
- Redirects are refused so the bearer token cannot be forwarded to another host.
- Response bodies are capped at 2 MB.
- Gateway errors never include the bearer token.
- Local graph expansion is capped at 250 and deduplicated.
- Provider failures are surfaced as partial-result messages rather than terminating successful enrichment from other providers.
- Vendor credential names/values are excluded from transform/project output.

## Manual commands

```powershell
.\.venv\Scripts\python.exe project.py list
.\.venv\Scripts\python.exe project.py mtz
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
