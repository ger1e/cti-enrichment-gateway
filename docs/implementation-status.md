# Implementation status

Implemented on `feature/max-cti-core`:

- strict IP, domain, URL, MD5, SHA1, SHA256 and CVE classification/canonicalization
- constant-time bearer authentication
- security headers and no-store responses
- bounded TTL/negative cache
- provider registry with credential-aware activation
- timeout and 429-aware provider runner
- raw response SHA-256 integrity hash
- canonical evidence normalization and structured partial failures
- read-only provider adapters:
  - IPinfo Lite
  - RDAP (IP + domain)
  - RIPEstat Network Info
  - GreyNoise Community
  - AbuseIPDB
  - Shodan host lookup
  - Censys Platform v3 host lookup
  - Cloudflare Radar IP details
  - VirusTotal v3 object lookup (IP/domain/URL/file hash)
  - AlienVault OTX indicator general lookup
  - ThreatFox search only
  - urlscan historical Search API only
  - Webamon Pro search only
  - Pulsedive indicator lookup only
  - URLhaus URL lookup only
  - CIRCL hashlookup
  - MalwareBazaar `get_info` metadata only
  - Malpedia sample info only; no sample retrieval
  - Hybrid Analysis v2.38.0 hash search only
  - CISA KEV
  - FIRST EPSS
  - NVD CVE API 2.0
  - OSV vulnerability lookup
- Sentry remains operations-only and is not registered as an intelligence provider
- no scan/submission/takedown/rescan/sample-download/detonation adapter routes
- Maltego local transforms for IPv4/IPv6/domain/DNS/URL/hash/CVE over the gateway

Credentialed providers with no configured secret are skipped at runtime. NVD remains usable without its optional API key at the lower public rate.

Verification performed during the adapter rollout: a reconstructed branch-equivalent Node test tree completed 56 tests with 56 passes and 0 failures. GitHub Actions workflow is present, but a connector-visible workflow run/status was not available at the time of verification, so hosted CI is not claimed as passed.

Remaining production/runtime gates:

- exercise each configured credential against its live provider from Vercel and record schema drift/errors
- attach durable storage for cache/temporal graph/snapshots if persistent state is desired
- deploy/verify the feature branch preview before merging
- keep MITRE ATT&CK as the knowledge/mapping layer rather than pretending it is an IOC reputation endpoint
