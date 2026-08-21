# Threat Model

## Assets

- gateway bearer token
- provider API credentials
- normalized CTI evidence and provenance
- provider quotas/availability
- repository, CI and deployment integrity
- analyst privacy: queried indicators should not leak through operational surfaces

## Adversaries and failure sources

The design assumes an untrusted caller may control indicator text and request timing, upstream providers can be malformed/compromised/unavailable, credentials can be exposed outside the application, and repository/deployment supply chains can drift or be compromised.

## Threats, controls and tests

| Threat | Primary controls | Executable evidence |
|---|---|---|
| Leaked gateway bearer | bearer auth on sensitive APIs; no token reflection; redirects refused in Maltego/gateway clients; rotation via deployment secret store | auth/API tests; public-release audit |
| Provider secret compromise | server-side-only provider credentials; no caller-selected headers; status/meta expose booleans, not values; Maltego knows only gateway bearer | meta/status tests; Maltego credential-boundary tests |
| SSRF / arbitrary proxying | static provider registry; exact fixed hosts; declared methods/protocols; `safeFetch`; no provider override | egress-policy tests; manifest invariants |
| Redirect credential exfiltration | redirects set to `error`; off-manifest host rejected before network access | egress/chaos tests |
| Malicious or malformed upstream | response ceilings; parsers validate expected structures; malformed feeds fail closed; exception text normalized | public-feed, MISP, chaos tests |
| Quota/latency amplification | fixed profiles; tiered max-4 scheduler; static workflow call ceilings; 20s deadline; one retry; batch max 20/3/200 | scheduler/profile/batch tests |
| Provider outage / rate limiting | explicit partial failures; retry only timeout/transport/429/5xx; bounded circuit breaker | scheduler/circuit/chaos tests |
| Cache poisoning / stale outage state | bounded namespaced cache; in-flight cleanup; provider failures never cached; successful semantic negatives get short TTL | cache and chaos tests |
| Stale negative evidence | negative semantic TTL separate from positive TTL; freshness reported separately; cache state is not treated as source freshness | chaos/correlation tests |
| Provenance confusion | parser version, retrieval time, provider, raw-result hash and canonical evidence fingerprint preserved | evidence-v2/release-manifest tests |
| False corroboration | typed semantic classes; scanner/Tor/network/ATT&CK context excluded from reputation votes; contradictions explicit | correlation tests |
| False attribution | proximity/hosting relationships are pivots only; actor attribution emitted only from explicit evidence relationship | correlation/STIX tests |
| Malicious MISP content | exact hash-cache/event verification; deleted=false semantics; composite component matching; max five event fetches | MISP semantics tests |
| Unbounded ATT&CK graph expansion | fixed MITRE collection IDs, server-side type filtering; relationship expansion omitted when bounded filter is unavailable | TAXII relationship tests |
| Log/telemetry leakage | allowlisted telemetry; raw indicators excluded by default; count-only status; no-store authenticated status | telemetry/meta-status tests |
| STIX overclaiming | export only from gateway-generated enrichment; no fabricated confidence; explicit relationship gate for actor/malware; max 100 objects | STIX tests |
| Actions supply-chain compromise | GitHub Actions pinned to immutable SHAs; dependency-free runtime core; repository invariant checks | `scripts/verify-repo.sh` / Tooling smoke |
| Deployment/source drift | finalizer requires clean exact main; production acceptance compares deployed source SHA and runs smoke tests | finalizer contract + Task 13 acceptance |

## Residual risk

- Provider APIs can return semantically wrong but syntactically valid data. Provenance and contradiction handling reduce impact but cannot independently prove upstream truth.
- In-memory cache/circuit state is instance-local and non-durable.
- A stolen gateway bearer remains usable until rotation/revocation.
- A compromised deployment/repository administrator can bypass application controls; branch protection, account security and secret-store controls remain external dependencies.
- Source coverage changes over time. Absence from a provider is not proof of benignness.

## Out of scope by design

Active scanning, malware submission/detonation, remediation, credential testing, arbitrary web fetching, unbounded graph crawling and automated attribution are not gateway capabilities.
