# MAX CTI Gateway Core Specification

## Goal

Build a personal, read-only CTI enrichment gateway that turns individual provider APIs into a coordinated evidence system for IP, domain/URL, hash, CVE, malware, infrastructure, hunt and graph workflows.

## Operating model

- Personal research and lab use only.
- Secrets remain server-side in Vercel environment variables and are never returned to callers.
- Read-only enrichment is the default.
- No arbitrary HTTP proxy, arbitrary headers, shell execution, secret retrieval, automatic urlscan submission, automatic malware submission, automatic sample download, or automatic detonation.
- Provider failure returns partial results rather than failing an entire enrichment.
- Preserve source provenance, timestamps, raw-response hashes, parser version and gateway version for reproducibility.
- Treat vendor observations according to their semantics. Do not collapse unrelated signals into a vendor-vote score.

## Core architecture

1. Input validation and canonicalization.
2. Gateway authentication.
3. Cache and quota-aware provider routing.
4. Provider adapters with strict outbound host allowlists and timeouts.
5. Canonical evidence normalization.
6. Entity resolution and temporal relationship storage.
7. IOC lifecycle and evidence-confidence handling.
8. Hunt-context generation.
9. Maltego/STIX-friendly output surfaces.
10. Sentry/operational telemetry with credential and sensitive-field scrubbing.

## Initial provider roles

- IP ownership/routing: IPinfo, RDAP, RIPEstat.
- Internet observation/noise: GreyNoise, AbuseIPDB, Shodan, Censys.
- Threat intelligence: OTX, ThreatFox, VirusTotal, Webamon, urlscan.
- Malware: Malpedia, MalwareBazaar, Hybrid Analysis, CIRCL Hashlookup.
- Vulnerability: CISA KEV, FIRST EPSS, NVD, OSV.
- Knowledge: MITRE ATT&CK TAXII.
- Operations: Sentry only; never an intelligence source.

## Canonical enrichment response

```json
{
  "requestId": "uuid",
  "indicator": "example",
  "type": "ip|domain|url|hash|cve|asn|malware|actor",
  "queriedAt": "ISO-8601 UTC",
  "status": "ok|partial|error",
  "evidence": [],
  "relationships": [],
  "failures": [],
  "huntContext": {},
  "meta": {
    "gatewayVersion": "string",
    "cache": {},
    "providerHealth": {}
  }
}
```

Each evidence item must preserve provider, observation semantics, confidence when supplied or derived, first/last seen when available, retrievedAt, source URL/reference, parser version and raw-response hash.

## Router behavior

- Cache first.
- Prefer deterministic/no-key/low-cost sources before scarce quota sources.
- Provider adapters declare timeout, cache TTL, negative-cache TTL and cost/scarcity class.
- Respect HTTP 429 and Retry-After.
- Never retry non-transient 4xx errors.
- A failed or quota-exhausted provider becomes a structured failure and the remaining workflow continues.
- Recursive pivots have explicit depth/entity budgets.

## Initial workflows

### IP

IPinfo/RDAP/RIPEstat -> GreyNoise -> AbuseIPDB -> Shodan -> Censys -> OTX/ThreatFox -> urlscan relationship pivots.

### Domain/URL

Canonicalization/RDAP -> urlscan -> Webamon -> URLhaus -> VirusTotal -> OTX/ThreatFox -> Censys certificate/web-property pivots -> discovered IPs into IP workflow.

### Hash

CIRCL Hashlookup -> MalwareBazaar -> Malpedia -> VirusTotal -> Hybrid Analysis -> OTX/ThreatFox -> extracted infrastructure into domain/IP workflows.

### CVE

CISA KEV -> FIRST EPSS -> NVD -> OSV -> normalized vulnerability context. Preserve KEV, EPSS, severity and package impact as separate dimensions.

## Hunt context

The gateway may derive a compact hunt object containing indicator, first/last seen, family, actor, confidence, ATT&CK techniques, related infrastructure, recommended telemetry, false-positive notes and source references. It must never claim internal telemetry was observed unless the caller supplies such evidence.

## Security requirements

- Constant-time gateway credential comparison where applicable.
- Validate method, content type and input size.
- Strict indicator parsers.
- Hard outbound provider allowlist.
- Per-provider timeout and response-size ceiling.
- Never log Authorization, API keys, tokens, sample contents or raw secrets.
- Health/config endpoints expose only boolean configured state, never values.
- Responses use security headers and disable caching for authenticated gateway responses unless specifically safe.

## Persistence roadmap

The first implementation defines storage interfaces and ships an in-memory bounded TTL cache suitable for tests and development. A durable production adapter (Redis/KV-compatible) can be added without changing router interfaces. Temporal graph, IOC lifecycle persistence and investigation snapshots build on the same storage boundary.

## Definition of done for core v1

- Tests for validation, auth, timeout, retry/429 handling, cache behavior, normalized partial failures, evidence hashing, provider registry, IP workflow and CVE workflow.
- Health endpoint returns version and provider configured booleans only.
- Generic enrichment endpoint supports at least IP and CVE orchestration with provider adapters that can be dependency-injected for tests.
- No secret can be retrieved through any API route.
- Vercel deployment builds successfully.
