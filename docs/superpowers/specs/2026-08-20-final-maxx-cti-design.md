# Final MAXX CTI Gateway Design

Date: 2026-08-20
Branch: `final/maxx-cti`
Base: current `main`

## Goal

Produce one clean, production-oriented personal CTI gateway that preserves the hardened MAXX repository/runtime baseline from `main`, incorporates the tested CTI core/provider adapters and Maltego integration from `feature/max-cti-core`, removes obsolete scaffolding, and reaches a single verifiable deployment path.

The result must be maintainable, read-only by default, secret-safe, quota-aware, reproducible, and usable from Maltego Graph Desktop through one private gateway token while all vendor credentials remain server-side.

## Final architecture

```text
Maltego / direct API caller
        |
        | HTTPS + CTI_GATEWAY_TOKEN
        v
Vercel CTI Enrichment Gateway
        |
        +-- input validation / canonicalization
        +-- authentication / security headers
        +-- cache / timeout / quota / provider-health routing
        +-- provider registry
        +-- normalized evidence model
        +-- hunt context / graph relationships
        |
        +-- IP workflow
        +-- domain workflow
        +-- URL workflow
        +-- hash workflow
        +-- CVE workflow
        |
        v
Read-only CTI providers / public sources
```

The gateway is the only component that knows vendor API credentials. Maltego receives normalized entities and relationships rather than raw vendor responses.

## Runtime and repository baseline

The final branch starts from current `main`, not from the older feature branch. This preserves the newest repository hardening, including Node 24/runtime alignment, deterministic line-ending/editor rules, pinned CI actions, dependency policy, Codespaces tooling, bootstrap safeguards, secret-safe ignore/template controls, and repository invariant checks.

Feature work is ported onto that base in small logical commits. The old `feature/max-cti-core` history is not merged wholesale.

## API surface

### `GET /api/health`

Returns only safe operational/configuration metadata:

- gateway status
- gateway version / commit
- whether gateway authentication is configured
- provider names
- provider configured booleans
- provider runtime/health state when available
- active workflow manifests

It must never expose secret values.

### `POST /api/enrich`

Authenticated with:

```http
Authorization: Bearer <CTI_GATEWAY_TOKEN>
Content-Type: application/json
```

Request:

```json
{
  "indicator": "8.8.8.8"
}
```

Optional `type` may be supplied only when it agrees with deterministic classification.

Response shape:

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

## Indicator support

Deterministic validation/canonicalization supports:

- IPv4
- IPv6
- domain / DNS name
- HTTP/HTTPS URL
- MD5
- SHA-1
- SHA-256
- CVE identifier

Invalid, ambiguous, oversized or type-mismatched input is rejected before provider calls.

## Provider model

Each provider adapter has one responsibility and declares:

- name
- supported indicator types
- secret requirement, if any
- timeout
- positive cache TTL
- negative cache TTL
- cost/scarcity class
- parser version
- fixed outbound host/path behavior
- normalized read-only `run()` implementation

Provider failures never erase successful evidence from other providers.

## Final active workflows

### IP

1. IPinfo
2. RDAP
3. RIPEstat
4. GreyNoise
5. AbuseIPDB
6. Shodan
7. Censys Platform
8. Cloudflare Radar where configured/applicable
9. VirusTotal
10. OTX
11. ThreatFox
12. urlscan historical search
13. Webamon search
14. Pulsedive

### Domain

1. RDAP/domain registration where supported
2. urlscan historical search
3. Webamon search
4. VirusTotal
5. OTX
6. ThreatFox
7. Pulsedive
8. Censys/domain-certificate pivots only when supported by the current tested adapter contract

### URL

1. urlscan historical search
2. Webamon search
3. URLhaus lookup
4. VirusTotal
5. OTX
6. ThreatFox
7. Pulsedive

### Hash

1. CIRCL Hashlookup
2. MalwareBazaar lookup
3. Malpedia metadata/presence
4. VirusTotal
5. Hybrid Analysis search/report lookup
6. OTX
7. ThreatFox
8. Pulsedive

### CVE

1. CISA KEV
2. FIRST EPSS
3. NVD 2.0
4. OSV
5. OTX when the current read-only contract produces useful CVE context

## Explicitly excluded provider actions

The final gateway does not expose or call state-changing or artifact-acquisition operations by default:

- urlscan submission
- Webamon scanning or takedown
- VirusTotal file/URL submission, rescan or sample download
- MalwareBazaar sample download
- Malpedia raw sample retrieval
- Hybrid Analysis submission, detonation or sample download
- Pulsedive analysis submission
- arbitrary HTTP proxying
- arbitrary outbound headers
- shell execution
- secret read/list endpoints

Any future action-capable path is a separate feature with explicit approval and separate security review.

## Evidence semantics

Providers are not votes. Results keep their native semantic meaning, such as:

- registration / allocation
- routing / ASN context
- Internet scanner/noise classification
- abuse report
- exposed service observation
- malware association
- sandbox behavior
- known exploited vulnerability membership
- exploit probability
- vulnerability metadata

The gateway must not derive maliciousness from a simple provider-count majority.

Every evidence item preserves:

- provider
- observation kind
- verdict where meaningful
- confidence where supplied/derived defensibly
- first seen / last seen where available
- tags
- malware family / actor when available
- normalized attributes
- relationships
- source references
- retrieval timestamp
- parser version
- SHA-256 integrity hash of the normalized upstream payload

## Cache, quota and failure handling

Routing behavior:

1. cache first
2. deterministic/no-key/cheap sources before scarce sources where practical
3. provider-specific timeout
4. bounded response size
5. respect HTTP 429 / `Retry-After`
6. short negative-cache TTLs
7. continue after one provider fails
8. return explicit `partial` status with structured failures

No hidden fallback is permitted.

## Security model

Hard requirements:

- Node 24 hardened runtime baseline from current `main`
- constant-time gateway-token comparison
- HTTPS-only external use
- `Cache-Control: no-store` for authenticated responses
- strict request size limits
- strict response size limits
- strict indicator parsers
- fixed provider endpoints/hosts
- provider timeouts
- no credential logging
- no secret values in API responses
- Sentry, if enabled, is observability only and must scrub credential-bearing headers/fields
- deterministic CI and repository invariant checks remain enabled

## Maltego integration

Maltego Graph Desktop remains a thin local visualization/pivot layer.

```text
Maltego Desktop
      |
local Python transforms
      |
HTTPS + one gateway token
      v
/api/enrich
```

Local transform support includes:

- IPv4
- IPv6
- domain
- DNS name
- URL
- hash
- CVE

The local gateway bearer is protected with Windows DPAPI. Vendor API credentials never enter Maltego.

Mapper behavior:

- convert normalized relationships to Maltego entities
- map IP/domain/URL/hash/ASN entities to native Maltego types when possible
- create bounded evidence/family/actor phrase nodes
- deduplicate entities
- enforce graph expansion/entity budgets
- preserve provider and relationship metadata

The existing TRX-based local-transform path is retained only as the currently working Desktop integration boundary. A future SDK migration must not change the gateway API contract.

## Persistence boundary

The final release keeps persistence behind an explicit storage interface.

Minimum shipping requirement:

- bounded in-memory TTL cache that is correct and safe

Preferred production enhancement, only if provisioned and verified without hidden billing/credential risk:

- durable cache/state adapter for provider cache, quota metadata, temporal graph relationships, IOC lifecycle state and investigation snapshots

Durable state is not required to merge the gateway if the in-memory behavior is fully documented; it must not be faked by implying Vercel function memory is durable.

## Repository cleanup

The final branch should remove or consolidate obsolete material introduced during iterative development:

- duplicate or contradictory READMEs
- placeholder docs that add no operational value
- stale roadmap statements for work now implemented
- temporary CI probes
- redundant test notes / `.note` files
- obsolete branch-specific implementation-status claims

Keep one authoritative root README plus focused architecture/security/operator docs.

## Migration strategy

Use a clean-port strategy from `feature/max-cti-core` into `final/maxx-cti`:

1. preserve current `main` runtime/tooling/CI files
2. port validation/core HTTP/provider primitives
3. port provider adapters
4. port workflow manifests
5. port API handlers
6. port contract/security tests
7. port Maltego integration and tests
8. reconcile package/runtime metadata with Node 24 baseline
9. consolidate documentation
10. run all verification gates

Do not force-update `main` and do not merge the old feature branch wholesale.

## Testing and verification gates

No merge or production deployment is allowed until all applicable gates are green.

### Node/unit tests

- input validation and canonicalization
- authentication
- security headers
- request/response bounds
- cache behavior
- timeouts
- HTTP 429 handling
- provider registry
- provider endpoint/auth contracts
- provider secret omission behavior
- read-only endpoint guarantees
- canonical normalization
- partial failure semantics
- IP/domain/URL/hash/CVE workflows
- health endpoint secret non-disclosure

### Maltego tests

- gateway client HTTPS enforcement
- redirect refusal
- bearer handling without logging secret
- mapper entity typing
- relationship mapping
- deduplication
- entity budget enforcement
- Python compilation

### Repository/runtime checks

- Node 24 invariant
- package-lock consistency
- pinned CI action/invariant checks from `main`
- PowerShell bootstrap syntax/invariants
- secret scanning / no committed credential material
- deterministic line-ending/editor policy

### Deployment checks

On Vercel preview:

1. build succeeds
2. `/api/health` returns safe metadata only
3. unauthenticated enrich returns 401
4. invalid indicators return 400 without provider calls
5. one controlled lookup for each configured provider family verifies current authentication and response parsing
6. provider failures remain partial rather than crashing the request
7. no response/log contains credential values
8. Maltego test transform successfully reaches the preview/production gateway

Production deployment occurs only after preview verification is green.

## Merge strategy

When all gates pass:

1. open/update a clean PR from `final/maxx-cti` to `main`
2. review final diff for unintended deletions and secrets
3. squash merge to produce one coherent MAXX CTI feature commit set
4. verify `main` CI
5. verify production Vercel deployment
6. close the obsolete `feature/max-cti-core` PR/branch only after the new main path is confirmed

## Definition of done

The project is complete when:

- current `main` hardening is preserved
- all final read-only adapters are active only when configured
- all five indicator workflows execute through the same normalized orchestration path
- secret values are impossible to retrieve through supported API surfaces
- Maltego can enrich through the gateway with one local DPAPI-protected bearer
- full local/CI/preview verification is green
- production Vercel deployment is verified
- obsolete duplicate scaffolding is removed
- the final PR is squash-merged to `main`
- post-merge production smoke checks pass
