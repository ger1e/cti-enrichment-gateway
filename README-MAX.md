# CTI Enrichment Gateway — MAX Core

Personal, read-only CTI enrichment gateway for Vercel.

## Implemented core

- Authenticated `POST /api/enrich` using `Authorization: Bearer <CTI_GATEWAY_TOKEN>`.
- Public-safe `GET /api/health` exposing only version and provider configured booleans.
- Strict IP/CVE validation for the first active workflows.
- Bounded request/provider response sizes.
- Constant-time gateway token comparison.
- Per-provider timeouts, structured `429` handling, bounded TTL cache, negative caching and partial-result responses.
- Canonical evidence normalization with source references, timestamps, parser version and SHA-256 response-integrity hash.
- Active IP workflow: RDAP.
- Active CVE workflow: CISA KEV -> FIRST EPSS.
- MAX workflow manifests for later IP, domain/URL, hash and CVE provider expansion.

## Security boundaries

The gateway deliberately has no arbitrary HTTP proxy, arbitrary-header endpoint, shell execution, secret read/list endpoint, automatic urlscan submission, automatic malware submission, automatic sample download or automatic detonation.

API secrets are server-side Vercel environment variables only. Health output contains booleans, never values.

## Required gateway secret

Create a strong random value in Vercel:

`CTI_GATEWAY_TOKEN`

Call enrichment with:

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

## Provider secrets recognized by health/configuration

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

These are configuration signals only until their corresponding provider adapter is implemented and tested.

## No-key source roadmap

- RDAP — implemented
- FIRST EPSS — implemented
- CISA KEV — implemented
- RIPEstat
- OSV
- CIRCL Hashlookup
- MITRE ATT&CK TAXII

## Development

```bash
npm test
```

Core v1 is dependency-free and uses Node's built-in test runner, fetch, crypto and AbortController.

## Current persistence model

The first core uses a bounded in-memory TTL cache. This improves warm-instance behavior but is not durable across Vercel instances or cold starts. Durable Redis/KV-compatible cache, temporal graph state, IOC lifecycle state and investigation snapshots are follow-on layers behind the same orchestration boundary.
