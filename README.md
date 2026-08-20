# cti-enrichment-gateway

Private, personal, read-only CTI enrichment gateway for Vercel.

## MAX core

Implemented:

- authenticated `POST /api/enrich` using `Authorization: Bearer <CTI_GATEWAY_TOKEN>`
- safe `GET /api/health` exposing version and provider `configured` booleans only
- strict IP/domain/URL/hash/CVE validation and canonicalization
- constant-time gateway-token comparison
- bounded request and provider-response sizes
- per-provider timeouts and structured `429` handling
- bounded TTL/negative caching
- canonical evidence normalization and partial-result handling
- source references, parser versions and SHA-256 provider-response hashes
- credential-aware provider activation: missing required credentials are skipped rather than breaking the workflow
- Maltego local-transform layer over the same gateway contract

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

Provider observations preserve their own semantics. The gateway does not calculate a vendor-vote maliciousness score.

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

The same endpoint accepts domains, HTTP(S) URLs, MD5/SHA1/SHA256 hashes and CVE identifiers.

## Security boundaries

The gateway deliberately does not expose arbitrary outbound HTTP, arbitrary headers, shell execution, secret retrieval/listing, urlscan submission, Webamon scanning/takedowns, Pulsedive analysis submission, VirusTotal rescan/analyse/download, malware submission, sample download, or sandbox detonation.

Secrets stay in Vercel environment variables. API responses never return secret values.

## Vercel environment variables

Gateway:

- `CTI_GATEWAY_TOKEN`

Provider credentials:

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
- `NVD_API_KEY` (optional; raises NVD rate allowance)
- `CLOUDFLARE_RADAR_TOKEN`
- `SENTRY_AUTH_TOKEN` (operations only)

No-key sources active in the gateway include RDAP, RIPEstat, CIRCL Hashlookup, CISA KEV, FIRST EPSS and OSV. NVD also works without a key at its public rate.

## Provider boundaries

- abuse.ch: ThreatFox search, URLhaus URL lookup and MalwareBazaar `get_info` metadata only
- Hybrid Analysis: API v2.38.0 hash search only; no deprecated `/file-collection/*` paths
- Malpedia: sample information only; no raw/zip/sample retrieval
- urlscan: historical Search API only; no submission
- Webamon: `/search` only
- Pulsedive: `indicator.php` lookup only; no `analyze.php`
- VirusTotal: v3 object lookup only; no rescan/analyse/download
- Sentry: monitoring only; never an intelligence verdict source
- MITRE ATT&CK remains a knowledge/mapping layer rather than an IOC reputation provider

## Development

```bash
npm test
```

The Node gateway uses the built-in test runner, `fetch`, `crypto` and `AbortController` and has no runtime npm dependency.

## Persistence

The current gateway cache is in-memory and therefore not durable across Vercel cold starts or instances. Durable cache/temporal-graph/snapshot storage remains a separate production-state layer.

Never commit API keys or other secrets to this repository.
