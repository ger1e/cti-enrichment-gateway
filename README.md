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
        +-- fixed-source public-feed cache
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
        +-- ATT&CK workflow
        |
        v
Read-only CTI providers, public MISP feeds and fixed TAXII collections
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
- MITRE ATT&CK identifier: techniques/sub-techniques, tactics, groups, software, mitigations, campaigns, data sources/components and detection strategies

An optional `type` may be supplied only when it agrees with deterministic classification.

Response envelope:

```json
{
  "requestId": "uuid",
  "indicator": "canonical indicator",
  "type": "ip|domain|url|hash|cve|attack",
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

Public/no-key sources are placed before scarcer credentialed enrichment where their semantics justify it. Provider observations remain independent; workflow order is not a voting or risk-scoring order.

### IP

`IPinfo -> RDAP -> RIPEstat -> DShield -> Spamhaus DROP -> Tor Exit -> Feodo Tracker -> ThreatMiner -> CIRCL MISP OSINT -> Botvrij.eu MISP OSINT -> GreyNoise -> AbuseIPDB -> Shodan -> Censys -> Cloudflare Radar -> VirusTotal -> OTX -> ThreatFox -> urlscan -> Webamon -> Pulsedive`

### Domain

`RDAP -> ThreatMiner -> OpenPhish -> CIRCL MISP OSINT -> Botvrij.eu MISP OSINT -> urlscan -> Webamon -> VirusTotal -> OTX -> ThreatFox -> Pulsedive`

### URL

`OpenPhish -> ThreatMiner -> CIRCL MISP OSINT -> Botvrij.eu MISP OSINT -> urlscan -> Webamon -> URLhaus -> VirusTotal -> OTX -> ThreatFox -> Pulsedive`

### Hash

`CIRCL Hashlookup -> ThreatMiner -> CIRCL MISP OSINT -> Botvrij.eu MISP OSINT -> MalwareBazaar -> Malpedia -> VirusTotal -> Hybrid Analysis -> OTX -> ThreatFox -> Pulsedive`

### CVE

`CISA KEV -> FIRST EPSS -> CIRCL Vulnerability-Lookup -> CIRCL MISP OSINT -> Botvrij.eu MISP OSINT -> NVD -> OSV -> OTX`

### MITRE ATT&CK

`MITRE ATT&CK TAXII 2.1`

Credentialed adapters are skipped when their required environment variable is absent. NVD remains usable without `NVD_API_KEY` at the public rate. The MISP OSINT and ATT&CK TAXII integrations require no additional credential.

## Provider boundaries

- ThreatMiner: fixed read-only passive-DNS/sample relationship pivots only; results are context, not automatic malicious verdicts.
- DShield/SANS ISC: IP activity/reputation context only; observed scanner/report activity is not automatically malware attribution.
- Spamhaus DROP: fixed DROP IPv4/IPv6 netblock membership only; source shape is validated before a negative result is accepted.
- Tor Project: bulk exit-node membership only; Tor exit status is contextual and never treated as a malware verdict.
- Feodo Tracker: current botnet-C2 IP blocklist membership only; source shape is validated before a negative result is accepted.
- OpenPhish Community: official public phishing-feed exact URL/domain-host matching only; the gateway pins the official raw community feed and performs no submission.
- CIRCL MISP OSINT: fixed public MISP-format feed correlation using `hashes.csv`, followed by bounded exact event/attribute verification before a positive result is accepted. Feed membership is context, not an automatic malicious verdict.
- Botvrij.eu MISP OSINT: fixed public MISP-format feed correlation using `hashes.csv`, followed by bounded exact event/attribute verification before a positive result is accepted. Feed membership is context, not an automatic malicious verdict.
- MITRE ATT&CK TAXII 2.1: fixed read-only Enterprise, ICS and Mobile ATT&CK collections only. Results are catalog/knowledge mappings, never IOC reputation or a maliciousness vote.
- CIRCL Vulnerability-Lookup: public CVE lookup only; vulnerability metadata, EPSS metadata and KEV metadata remain separate fields.
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

The legacy SSLBL IP/C2 CSV feeds are intentionally not active. They were deprecated upstream, so treating their empty output as `not_listed` would create false-negative confidence. SSLBL certificate/JA3 data can be reconsidered only if matching indicator types are added with current supported sources.

MITRE ATT&CK is actively queried through its fixed TAXII 2.1 collections as a knowledge/mapping layer. It remains separate from IOC reputation and is never treated as a vote in enrichment.

## Evidence semantics

Providers are not votes. Scanner/noise classification, abuse reports, exposed services, phishing-feed membership, MISP feed membership, Tor-exit membership, DROP netblock membership, passive DNS, botnet-C2 feed membership, malware associations, sandbox behavior, ATT&CK catalog knowledge, known-exploited membership, exploit probability and vulnerability metadata remain distinct observation types.

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
- Explicit request media types must be `application/json` or a valid `application/*+json` structured JSON type.
- Input size and indicator syntax are validated before provider calls.
- Provider hosts are fixed by adapters; caller input cannot select an arbitrary outbound host.
- Provider response bodies are bounded.
- Bulk public feeds are fetched only from fixed adapter URLs, cached by source TTL, and reject redirects.
- Public MISP feeds use only their fixed `hashes.csv` and event-JSON paths; caller input cannot select another MISP instance or event URL.
- ATT&CK TAXII requests use only the fixed MITRE TAXII 2.1 root and hard-coded collection IDs; caller input cannot supply a TAXII server or collection.
- Public-feed parsers validate expected source structure and fail as provider errors rather than manufacturing false-negative `not_listed` results from malformed upstream content.
- MISP cache hits are verified against exact supported event attributes; a cache/event mismatch fails closed rather than becoming positive evidence.
- Provider calls use explicit timeouts and structured rate-limit handling.
- Provider exception text is not reflected to callers.
- Authenticated responses use `Cache-Control: no-store` plus defensive response headers.
- Missing credentials cause provider omission/partial coverage, not hidden fallback.
- The Windows bootstrap keeps the gateway bearer in a current-user DPAPI-protected local store and never prints it.
- Maltego reuses that same DPAPI-protected gateway bearer when available; vendor credentials never enter Maltego.
- Production deployment is refused unless the local repository is clean and `HEAD` exactly matches freshly fetched `origin/main`.
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

No-key sources include RDAP, RIPEstat, ThreatMiner, DShield/SANS ISC, Spamhaus DROP, Tor Project exit list, Feodo Tracker, OpenPhish Community, CIRCL MISP OSINT, Botvrij.eu MISP OSINT, MITRE ATT&CK TAXII 2.1, CIRCL Hashlookup, CIRCL Vulnerability-Lookup, CISA KEV, FIRST EPSS and OSV. NVD also supports no-key access at its public rate.

## Vercel bootstrap

On Windows PowerShell, from a clean local clone of `main`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\bootstrap-vercel.ps1
```

The bootstrap:

- enforces Node.js 24.x runtime parity
- installs/uses the pinned Vercel CLI version
- verifies the repository origin is the approved GitHub repository
- fetches `origin/main`, requires a clean working tree, and requires local `HEAD` to exactly equal the fetched commit before provisioning
- links the existing Vercel project/team identifiers
- verifies the GitHub-to-Vercel project connection non-interactively
- reuses an existing current-user DPAPI-protected `CTI_GATEWAY_TOKEN`, or accepts one through masked input, or generates a strong 48-byte bearer when Enter is pressed
- never prints the gateway bearer and stores only its DPAPI-protected local copy
- writes the gateway bearer to Preview and Production Vercel environments as a sensitive value
- prompts for each provider secret using masked input; Enter skips providers not yet configured
- writes configured provider secrets to Preview and Production as sensitive values
- lists configured environment-variable names, not values
- rechecks that the clean checkout still exactly matches freshly fetched `origin/main` immediately before deployment
- deploys that exact verified source tree with `vercel deploy --prod` and requires `/api/health` to confirm gateway authentication is configured
- never writes secret values to GitHub

The bootstrap is the authoritative local provisioning and production-deployment path because this repository intentionally does not contain provider credentials.

## Maltego Graph Desktop

The `maltego/` directory provides bounded local transforms for:

- IPv4
- IPv6
- domain
- DNS name
- URL
- hash
- CVE
- MITRE ATT&CK ID via a Phrase entity

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

Vendor API credentials never enter Maltego. On Windows, the local gateway bearer is protected using current-user DPAPI. The installer first reuses the bootstrap-created DPAPI token; it prompts only if no usable stored bearer exists. Remote redirects are refused, remote gateway URLs require HTTPS, response size is capped, and graph expansion is bounded/deduplicated.

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

GitHub Actions performs the Node/repository checks, public-release audit, Maltego standard-library tests, Python compilation and PowerShell syntax validation. The workflow uses least-privilege repository permissions and disables checkout credential persistence. Draft PRs do not run the full validation job; every ready PR runs the complete gate on each relevant update, and commit-message conventions never bypass validation.

## Persistence

The shipping caches are in-memory TTL/negative caches. The core enrichment cache is bounded by entry count; fixed-URL public-feed and TAXII caches are bounded by the finite adapter source set. They improve warm-instance behavior but are not durable across Vercel cold starts or instances.

Durable cache, quota state, temporal graph relationships, IOC lifecycle state and investigation snapshots belong behind a separate storage interface. No paid/durable resource is auto-provisioned by this repository.

## Repository guardrails

- `.env` and derivatives are ignored; `.env.example` is the only committed environment template.
- Captures, samples, analysis artifacts, private keys/certificates, Vercel state, generated MTZ files, dependencies and common caches are ignored.
- `scripts/verify-repo.sh` enforces runtime parity, deterministic npm policy, pinned CI actions, canonical secret names, Maltego CI gates, security-policy presence and artifact/secret ignore rules.
- Dependabot checks GitHub Actions and npm dependencies weekly.
- The scheduled `Tooling smoke` workflow provides daily fallback validation in addition to push, ready-for-review pull-request and manual-dispatch triggers.

Never commit API keys, gateway tokens, malware samples, packet captures, private keys, certificates, or sensitive analysis material to this repository.
