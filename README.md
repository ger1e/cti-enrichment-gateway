# CTI Enrichment Gateway

Private, read-only CTI enrichment gateway for Vercel with a bounded Maltego Graph Desktop client.

The gateway normalizes heterogeneous CTI sources behind one authenticated API. Vendor credentials remain server-side; clients receive normalized evidence, relationships, provenance and provider-health state rather than raw secrets or unrestricted provider access.

## Scope

Current scope is personal research and lab use. Do not use the gateway for commercial-client, internal-enterprise, restricted, or otherwise sensitive data until the relevant provider licensing/data-handling terms and client authorization have been explicitly reviewed.

The API is retrieval-only. There are no routes for scan submission, takedown, rescan, upload, malware submission, sample download, detonation, arbitrary HTTP proxying, arbitrary outbound headers, shell execution, or secret retrieval.

## Architecture

```text
Maltego / authenticated API caller
        |
        | HTTPS + CTI_GATEWAY_TOKEN
        v
Vercel CTI Enrichment Gateway
        |
        +-- strict indicator validation/canonicalization
        +-- constant-time bearer authentication
        +-- bounded request/response handling
        +-- TTL/negative cache
        +-- provider registry + credential-aware activation
        +-- provider timeouts + structured 429 handling
        +-- normalized evidence + provenance + relationships
        +-- partial-result handling
        |
        +-- IP workflow
        +-- Domain workflow
        +-- URL workflow
        +-- Hash workflow
        +-- CVE workflow
        |
        v
Read-only CTI providers and public sources
```

Runtime parity is Node.js 24.x across Vercel, GitHub Actions, Codespaces and the Windows bootstrap.

## API

### Health

```http
GET /api/health
```

Health is deliberately non-secret. It returns gateway status/version, whether gateway authentication is configured, registered provider names with configuration booleans, Sentry observability state, and workflow manifests. It never returns credential values.

### Enrichment

```http
POST /api/enrich
Authorization: Bearer <CTI_GATEWAY_TOKEN>
Content-Type: application/json

{"indicator":"8.8.8.8"}
```

Supported deterministic indicator classes:

- IPv4
- IPv6
- domain / DNS name
- HTTP/HTTPS URL
- MD5
- SHA-1
- SHA-256
- CVE identifier

An optional `type` may be supplied only when it agrees with deterministic classification.

Response envelope:

```json
{
  "requestId": "uuid",
  "indicator": "canonical indicator",
  "type": "ip|domain|url|hash|cve",
  "queriedAt": "UTC timestamp",
  "status": "ok|partial|error",
  "evidence": [],
  "relationships": [],
  "failures": [],
  "huntContext": {},
  "meta": {
    "gatewayVersion": "commit/version",
    "cache": {},
    "providerHealth": {}
  }
}
```

Provider failures do not erase successful evidence from other providers. If no provider is configured for an otherwise valid workflow, the gateway returns an explicit structured gateway failure rather than a silent empty result.

## Active workflows

### IP

`IPinfo -> RDAP -> RIPEstat -> GreyNoise -> AbuseIPDB -> Shodan -> Censys -> Cloudflare Radar -> VirusTotal -> OTX -> ThreatFox -> urlscan -> Webamon -> Pulsedive`

### Domain

`RDAP -> urlscan -> Webamon -> VirusTotal -> OTX -> ThreatFox -> Pulsedive`

### URL

`urlscan -> Webamon -> URLhaus -> VirusTotal -> OTX -> ThreatFox -> Pulsedive`

### Hash

`CIRCL Hashlookup -> MalwareBazaar -> Malpedia -> VirusTotal -> Hybrid Analysis -> OTX -> ThreatFox -> Pulsedive`

### CVE

`CISA KEV -> FIRST EPSS -> NVD -> OSV -> OTX`

Credentialed adapters are skipped when their required environment variable is absent. NVD remains usable without `NVD_API_KEY` at the public rate.

## Provider boundaries

- abuse.ch: ThreatFox search, URLhaus URL lookup and MalwareBazaar `get_info` metadata only.
- GreyNoise: Community IP context only.
- AbuseIPDB: IP check only.
- Shodan: host lookup only.
- Censys: Platform v3 host lookup only.
- Cloudflare Radar: IP entity context only.
- VirusTotal: v3 object lookup only; no submission, rescan, analysis request or download.
- OTX: indicator general lookup only.
- urlscan: historical Search API only; no submission.
- Webamon: search/retrieval only; no scan or takedown action.
- Pulsedive: indicator lookup only; no analysis submission.
- CIRCL Hashlookup: known-file metadata lookup only.
- Malpedia: sample information/presence only; no raw/zip/sample retrieval.
- Hybrid Analysis: v2.38.0 hash search only; no submission, detonation, download or deprecated `/file-collection/*` path.
- CISA KEV, FIRST EPSS, NVD and OSV: vulnerability enrichment only.
- Sentry: observability only; never an IOC verdict, attribution or risk source.

MITRE ATT&CK remains a knowledge/mapping layer rather than an IOC-reputation provider and is not treated as a vote in enrichment.

## Evidence semantics

Providers are not votes. Scanner/noise classification, abuse reports, exposed services, malware associations, sandbox behavior, known-exploited membership, exploit probability and vulnerability metadata remain distinct observation types.

The gateway does not calculate a simple `N of M vendors say malicious` score.

Normalized evidence preserves, where available:

- provider and observation kind
- provider-native verdict/confidence semantics
- first seen / last seen
- tags
- malware family / actor context
- normalized attributes
- relationships
- source references
- retrieval timestamp
- parser version
- SHA-256 integrity hash of the normalized provider payload

Infrastructure proximity, certificate reuse, ASN ownership, hosting overlap and graph pivots are investigatory relationships, not automatic actor attribution.

## Security controls

- `POST /api/enrich` requires one gateway bearer token.
- Gateway bearer comparison is constant-time.
- Explicit non-JSON content types are rejected.
- Input size and indicator syntax are validated before provider calls.
- Provider hosts are fixed by adapters; caller input cannot select an arbitrary outbound host.
- Provider response bodies are bounded.
- Provider calls use explicit timeouts and structured rate-limit handling.
- Provider exception text is not reflected to callers.
- Authenticated responses use `Cache-Control: no-store` plus defensive response headers.
- Missing credentials cause provider omission/partial coverage, not hidden fallback.
- Generated Maltego MTZ files, local samples, captures, keys and environment files are ignored by Git.
- GitHub Actions are pinned to immutable commit SHAs.
- Vercel CLI is pinned in the Windows bootstrap rather than installed from `latest`.

See `SECURITY.md` for the repository security policy.

## Environment variables

Copy `.env.example` only for local development. Never commit populated values.

Gateway authentication:

- `CTI_GATEWAY_TOKEN`

Provider credentials:

- `ABUSECH_API_KEY`
- `ABUSEIPDB_API_KEY`
- `GREYNOISE_API_KEY`
- `VIRUSTOTAL_API_KEY`
- `HYBRID_ANALYSIS_API_KEY`
- `URLSCAN_API_KEY`
- `WEBAMON_API_KEY`
- `SENTRY_AUTH_TOKEN` — operations only
- `OTX_API_KEY`
- `SHODAN_API_KEY`
- `CENSYS_PAT`
- `PULSEDIVE_API_KEY`
- `IPINFO_TOKEN`
- `MALPEDIA_API_TOKEN`
- `NVD_API_KEY` — optional
- `CLOUDFLARE_RADAR_TOKEN`

No-key sources include RDAP, RIPEstat, CIRCL Hashlookup, CISA KEV, FIRST EPSS and OSV. NVD also supports no-key access at its public rate.

## Vercel bootstrap

On Windows PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\bootstrap-vercel.ps1
```

The bootstrap:

- enforces Node.js 24.x runtime parity
- installs/uses the pinned Vercel CLI version
- links the existing Vercel project/team identifiers
- attempts GitHub-to-Vercel project connection
- prompts for each secret using masked input
- writes secrets to Preview and Production Vercel environments as sensitive values
- permits Enter to skip credentials not yet available
- never writes secret values to GitHub

## Maltego Graph Desktop

The `maltego/` directory provides bounded local transforms for:

- IPv4
- IPv6
- domain
- DNS name
- URL
- hash
- CVE

Architecture:

```text
Maltego Graph Desktop
        |
        | local transform
        v
local gateway client
        |
        | HTTPS + CTI_GATEWAY_TOKEN
        v
/api/enrich
```

Vendor API credentials never enter Maltego. On Windows, the local gateway bearer is protected using current-user DPAPI. Remote redirects are refused, remote gateway URLs require HTTPS, response size is capped, and graph expansion is bounded/deduplicated.

Install from `maltego/`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1
```

The generated `cti-enrichment-gateway-local.mtz` is a local artifact and is intentionally ignored by Git.

## Development and verification

Primary commands:

```bash
npm run bootstrap
npm run verify:tooling
npm run verify:repo
npm run lint:shell
npm run check
npm test
```

Maltego client/mapper verification does not require installing TRX:

```bash
cd maltego
python3 -m unittest discover -s tests -v
cd ..
python3 -m compileall -q maltego
```

GitHub Actions performs the Node/repository checks, Maltego standard-library tests, Python compilation and PowerShell syntax validation. The workflow uses least-privilege repository permissions and disables checkout credential persistence.

## Persistence

The shipping cache is a bounded in-memory TTL/negative cache. It improves warm-instance behavior but is not durable across Vercel cold starts or instances.

Durable cache, quota state, temporal graph relationships, IOC lifecycle state and investigation snapshots belong behind a separate storage interface. No paid/durable resource is auto-provisioned by this repository.

## Repository guardrails

- `.env` and derivatives are ignored; `.env.example` is the only committed environment template.
- Captures, samples, analysis artifacts, private keys/certificates, Vercel state, generated MTZ files, dependencies and common caches are ignored.
- `scripts/verify-repo.sh` enforces runtime parity, deterministic npm policy, pinned CI actions, canonical secret names, Maltego CI gates, security-policy presence and artifact/secret ignore rules.
- Dependabot checks GitHub Actions and npm dependencies weekly.
- The scheduled `Tooling smoke` workflow provides daily fallback validation in addition to push, pull-request and manual-dispatch triggers.

Never commit API keys, gateway tokens, malware samples, packet captures, private keys, certificates, or client-sensitive analysis material to this repository.
