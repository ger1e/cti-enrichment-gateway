# cti-enrichment-gateway

Private, personal, read-only CTI enrichment gateway for Vercel.

## MAX core

Implemented:

- authenticated `POST /api/enrich` using `Authorization: Bearer <CTI_GATEWAY_TOKEN>`
- safe `GET /api/health` exposing version and provider `configured` booleans only
- strict IP/CVE validation for the first active workflows
- constant-time gateway-token comparison
- bounded request and provider-response sizes
- per-provider timeouts and structured `429` handling
- bounded TTL/negative caching
- canonical evidence normalization
- partial-result handling when individual sources fail
- provenance fields, parser versions and SHA-256 provider-response hashes
- active IP workflow: RDAP
- active CVE workflow: CISA KEV -> FIRST EPSS
- MAX workflow blueprints for infrastructure, domain/URL, malware/hash and vulnerability enrichment

## API

Health:

```text
GET /api/health
```

Enrichment:

```http
POST /api/enrich
Authorization: Bearer <CTI_GATEWAY_TOKEN>
Content-Type: application/json

{"indicator":"8.8.8.8"}
```

or:

```json
{"indicator":"CVE-2026-12345"}
```

## Security boundaries

The gateway deliberately does not expose arbitrary outbound HTTP, arbitrary headers, shell execution, secret retrieval/listing, automatic urlscan submission, automatic malware submission, automatic sample download, or automatic detonation.

Secrets stay in Vercel environment variables. API responses never return secret values.

## Vercel environment variables

Gateway:

- `CTI_GATEWAY_TOKEN`

Provider credentials recognized by the configuration/health layer:

- `ABUSECH_API_KEY`
- `ABUSEIPDB_API_KEY`
- `GREYNOISE_API_KEY`
- `VIRUSTOTAL_API_KEY`
- `HYBRID_ANALYSIS_API_KEY`
- `URLSCAN_API_KEY`
- `WEBAMON_API_KEY`
- `OTX_API_KEY`
- `SHODAN_API_KEY`
- `CENSYS_PAT`
- `IPINFO_TOKEN`
- `MALPEDIA_API_TOKEN`
- `PULSEDIVE_API_KEY`
- `NVD_API_KEY`
- `CLOUDFLARE_RADAR_TOKEN`
- `SENTRY_AUTH_TOKEN`

A credential being recognized does not mean the provider is active. Providers enter active workflows only after their adapter and contract tests are implemented.

## No-key sources

Implemented:

- RDAP
- FIRST EPSS
- CISA KEV

Roadmap:

- RIPEstat
- OSV
- CIRCL Hashlookup
- MITRE ATT&CK TAXII

## Planned provider families

Infrastructure:

- IPinfo
- RDAP / RIPEstat
- GreyNoise
- AbuseIPDB
- Shodan
- Censys

Threat intelligence:

- OTX
- abuse.ch / ThreatFox / URLhaus
- VirusTotal
- urlscan.io, retrieval/search only by default
- Webamon, retrieval/search only by default

Malware:

- Malpedia
- MalwareBazaar
- Hybrid Analysis
- CIRCL Hashlookup

Vulnerability:

- CISA KEV
- FIRST EPSS
- NVD
- OSV

Operations:

- Sentry monitoring only; never an intelligence source

## Development

```bash
npm test
```

Core v1 uses Node's built-in test runner, `fetch`, `crypto` and `AbortController` and has no runtime dependency.

## Persistence

Core v1 has a bounded in-memory TTL cache. It improves warm-instance behavior but is not durable across Vercel cold starts or instances. Durable Redis/KV-compatible cache, temporal graph state, IOC lifecycle state, investigation snapshots, STIX export and Maltego transforms are follow-on layers behind the same normalization/orchestration interfaces.

Never commit API keys or other secrets to this repository.
