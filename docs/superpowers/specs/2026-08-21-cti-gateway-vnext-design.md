# CTI Enrichment Gateway vNext — Ultimate Bounded Design

Date: 2026-08-21
Status: design for implementation
Scope: personal, read-only CTI enrichment gateway

## 1. Objective

Evolve the current gateway from a strong collection of fixed read-only adapters into a small, deterministic CTI enrichment platform with explicit contracts for routing, evidence provenance, resilience, export, graphing, observability and release integrity.

The design deliberately avoids a rewrite. Existing adapters, the canonical evidence model, Maltego integration, Vercel deployment flow and zero-runtime-dependency posture remain the baseline. New behavior is introduced behind focused modules and exhaustive contract tests.

Success means the gateway is faster, easier to audit, harder to misuse, more expressive for CTI analysis and safer under upstream failure without becoming a generic scanner, arbitrary HTTP proxy, malware detonation service or opaque scoring engine.

## 2. Hard invariants

These constraints are non-negotiable across every subsystem.

1. **Read-only by default.** No sample submission, detonation, scan initiation, takedown, account modification, message sending or other active operation.
2. **No caller-controlled outbound host.** Provider destinations remain fixed in code. Any future authenticated MISP/TAXII connector must be server-side configured, HTTPS-only and separately allowlisted; it is not part of the public-source path.
3. **No secret reflection.** Provider credentials and gateway bearer values never appear in responses, evidence, references, logs, error text, generated artifacts or Git history.
4. **No vendor-vote score.** Reputation, scanner activity, feed membership, Tor status, passive DNS, exploit probability, KEV status, ATT&CK knowledge and sandbox behavior remain separate semantics.
5. **Partial failure is explicit.** A failed provider must not erase successful evidence or silently become a negative verdict.
6. **Negative evidence is earned.** Malformed, redirected, oversized or structurally unexpected upstream data fails closed instead of manufacturing `not_listed` or `not_found`.
7. **Everything is bounded.** Request size, batch size, provider calls, concurrency, response bytes, relationship expansion, cache entries, event fetches, execution time and output entities all have hard ceilings.
8. **Deterministic classification.** Indicator type is inferred by strict validators; a caller-supplied type can only agree with that classification.
9. **Evidence before release.** Every merge that changes runtime behavior requires red/green regression evidence and the full repository gate.
10. **Production parity is separately verified.** A green repository does not imply a current Vercel deployment.

## 3. Chosen architecture

Three approaches were considered:

- **A. Rewrite around a full CTI framework or MISP backend.** Maximum functionality, but unnecessary operational state, dependency surface and attack surface for a personal gateway.
- **B. Keep adding independent adapters to the current sequential orchestrator.** Lowest effort, but routing drift, latency and evidence-contract inconsistency grow with every source.
- **C. Modular hardening of the existing gateway.** Keep the current adapter model, but introduce a provider manifest, bounded scheduler, stronger evidence envelope, export layer, observability and release metadata.

**Chosen: C.** It preserves the current strengths while giving each future source a small, auditable contract.

## 4. Target data flow

```text
Client / Maltego
    |
    v
Authentication + request budget
    |
    v
Normalize + classify
    |
    v
Request profile / provider policy
    |
    v
Bounded scheduler
    |-- fixed public sources
    |-- fixed credentialed sources when configured
    |-- optional knowledge collections
    v
Canonical evidence normalization
    |
    +--> provenance / integrity metadata
    +--> typed correlation + contradiction analysis
    +--> huntability / freshness descriptors
    |
    v
Canonical JSON response
    |-- optional STIX 2.1 export
    |-- Maltego graph mapping
    +-- authenticated batch response
```

## 5. Provider manifest as the single source of truth

Create a static provider manifest generated from registered adapters. Each provider exposes machine-readable metadata:

- name
- supported indicator types
- observation semantics
- credential environment variable, if any
- cost class (`free`, `quota`, `scarce`)
- priority tier
- timeout
- positive and negative cache TTL
- maximum response size
- fixed destination hosts
- parser version
- active/deprecated state
- source documentation/reference URL

Runtime routing, `/api/meta`, health output, README provider tables and invariant tests derive from this manifest instead of maintaining parallel lists.

A provider cannot register if its name is duplicated, its type list is empty, a timeout/body limit is missing, or its fixed host declaration is absent.

## 6. Central egress policy

Introduce one outbound transport boundary used by JSON and text adapters.

Requirements:

- exact HTTPS host allowlist supplied by the provider manifest
- HTTP permitted only where an existing upstream source genuinely requires it and a regression test documents why; otherwise rejected
- redirects rejected
- response-body ceiling enforced before and after read
- timeouts and AbortSignal preserved
- normalized 429/Retry-After handling
- response content type captured where available
- provider exceptions sanitized
- no arbitrary headers from the caller
- no arbitrary methods; provider adapter declares the allowed method and current runtime remains lookup-only

This is defense in depth: adapters still build fixed URLs, but the transport independently refuses host drift.

## 7. Bounded scheduler and request profiles

Replace the purely sequential provider loop with deterministic bounded scheduling.

### 7.1 Tiers

Providers are assigned stable tiers:

1. local/cache and authoritative public context
2. free/public external context
3. credentialed reputation/enrichment
4. scarce or slower enrichment
5. knowledge-only mappings

Within a tier, independent providers may execute concurrently up to a small fixed limit. Tiers remain ordered so a request does not unleash every scarce provider simultaneously.

### 7.2 Limits

Defaults:

- single-indicator provider concurrency: 4
- total provider-call ceiling per indicator: workflow-defined and statically testable
- request wall-clock budget: 20 seconds
- individual provider timeout: existing provider value, never above request budget
- batch indicator ceiling: 20
- batch global provider-call ceiling: 200
- batch concurrency: 3 indicators

No retry storm is allowed. Automatic retries are limited to a single retry only for explicitly retryable transport failures and only when `Retry-After`/remaining request budget permits it. 4xx semantic errors are not retried.

### 7.3 Profiles

Add a bounded `profile` option:

- `standard` — default deterministic workflow; balanced breadth
- `fast` — public/authoritative/high-signal subset, no scarce providers
- `full` — all configured read-only providers for the type

Profiles only select predefined provider sets. They never accept arbitrary provider names or URLs. Existing explicit provider-selection behavior, if retained, is restricted to the classified indicator's registered workflow and request budget.

## 8. Circuit breaker and provider health

Maintain per-instance provider state with a bounded map keyed only by registered provider names.

Track:

- consecutive failures
- last success/failure timestamp
- temporary open-until timestamp
- most recent retry-after
- exponentially smoothed latency or bounded recent latency sample

A provider that repeatedly fails enters a short circuit-open state and is returned as a structured `skipped` result rather than repeatedly consuming the request budget. State is intentionally ephemeral across Vercel instances; no durable service is provisioned.

Circuit state can never create a negative threat verdict.

## 9. Canonical evidence v2

Version the response/evidence contract explicitly.

Top-level response additions:

- `schemaVersion`
- `gatewayVersion`
- `requestId`
- `profile`
- `durationMs`
- `budget` summary
- `providerSummary` counts (`ok`, `failed`, `skipped`, `cached`)

Each evidence item adds or formalizes:

- provider
- observation type
- verdict/status
- confidence descriptor when the upstream source actually supplies one
- first seen / last seen
- retrieved at
- source age / freshness class
- cache state
- provider/parser version
- duration
- tags
- attributes
- typed relationships
- references
- integrity fingerprint

The integrity fingerprint is a SHA-256 over the canonical normalized provider result plus provider/parser version and request indicator. It is not claimed to be a hash of raw network bytes.

## 10. Evidence safety and reference sanitization

Centralize sanitization of external references and echoed indicator material.

- strip URL userinfo
- remove fragments
- redact common credential-bearing query keys (`token`, `key`, `api_key`, `apikey`, `auth`, `signature`, `sig`, `password`, `secret`, `session`, `code`)
- cap URL/reference length
- never copy provider query-string credentials into references
- sanitize exception strings before they reach structured failures
- logs use request ID/type/provider and optionally an indicator fingerprint, not raw secret-bearing URLs

The provider still receives the exact canonical indicator when its lookup semantics require it; sanitization is for evidence/log surfaces, not silent mutation of the lookup.

## 11. Typed correlation without a master score

Add a pure correlation layer after provider normalization.

It produces descriptors, not a single number:

- `corroboration`: independent sources supporting the same semantic observation
- `contradictions`: incompatible observations in the same semantic class
- `freshness`: current / aging / stale / unknown based on source-specific rules
- `huntability`: high / medium / low / none based on indicator type and evidence semantics
- `attributionConfidence`: only when upstream evidence explicitly supports actor/family relationships; otherwise omitted
- `riskAxes` for CVEs: KEV, EPSS, CVSS, exploit references, exposure context if available

Relationships are deduplicated by `(type, source, target, provider)` and capped.

## 12. MISP hardening and richer semantics

Keep CIRCL and Botvrij public MISP feeds fixed and no-secret.

Enhance parsing while preserving exact-match safety:

- ignore deleted attributes
- preserve `to_ids`, event publication state, threat level, event date and tags
- support selected composite MISP attribute types by exact component extraction: `domain|ip`, `hostname|port`, `ip-src|port`, `ip-dst|port`, `filename|md5`, `filename|sha1`, `filename|sha256`
- never treat the non-indicator component of a composite value as a match unless its type corresponds to the classified input
- preserve maximum five event-body fetches per feed/query
- event bodies remain request-local and uncached
- fixed `hashes.csv` indexes remain bounded source caches
- cache/event mismatch fails closed

No generic caller-supplied MISP instance is introduced in this pass.

## 13. TAXII / ATT&CK knowledge improvements

Keep the MITRE ATT&CK TAXII 2.1 root and collection IDs fixed.

Enhance the dedicated ATT&CK workflow:

- retain deterministic recognition of technique/sub-technique, tactic, group, software, mitigation, campaign, data source/component and detection strategy IDs
- preserve STIX object ID/type, ATT&CK version, platforms, tactics, revoked/deprecated flags and source references
- build bounded related-object context only from fixed ATT&CK collections
- relationship expansion has a hard entity cap and never downloads an unbounded collection per request
- knowledge mappings are labeled `attack_knowledge` and never contribute to IOC reputation

If efficient relationship filtering cannot be performed against the current TAXII service without large collection downloads, relationship expansion remains omitted rather than adding an unbounded fetch.

## 14. Additional indicator classes — gated

Add only types that have at least two useful existing/fixed sources or one authoritative source plus a clear analytical use.

Candidate classes for this pass:

- `asn` — strict `AS<number>` normalization; RIPE/network context
- `cidr` — strict IPv4/IPv6 network normalization; registration/network context and relevant blocklist membership

Candidate classes requiring fresh upstream validation before code:

- TLS certificate SHA-1
- JA3/JA4-style fingerprints

SSLBL or another source is included only if its current official endpoint is supported and non-deprecated at implementation time. A missing/currently deprecated source is documented as a coverage gap, not emulated.

## 15. Batch enrichment endpoint

Add authenticated `POST /api/batch`.

Request:

```json
{
  "indicators": ["..."],
  "profile": "standard"
}
```

Rules:

- maximum 20 indicators
- per-indicator normalization and independent error/result envelope
- duplicate canonical indicators collapsed before provider work and re-associated in output
- global provider-call and wall-clock budget
- bounded indicator concurrency
- no batch provider override that bypasses normal workflows
- partial batch completion is explicit

This is for IOC triage, not bulk scanning.

## 16. STIX 2.1 export

Add a pure, dependency-free canonical-to-STIX mapper and authenticated `POST /api/stix` endpoint.

The endpoint enriches one indicator (or accepts an already normalized internal result only through internal code, not arbitrary caller evidence) and emits a bounded STIX 2.1 Bundle.

Mapping principles:

- indicators become STIX Indicator objects only when a defensible STIX pattern exists
- ATT&CK knowledge retains original STIX IDs when supplied by MITRE
- malware/actor relationships become Malware/Intrusion Set references only when supported by evidence
- provenance is represented through external references and custom gateway metadata with conservative naming
- no fabricated confidence values
- bundle object count capped
- deterministic UUIDv5-like identity is not implemented with a fake namespace; stable IDs are only used where source IDs exist, otherwise valid random STIX IDs are generated per export

MISP export is not added unless there is a clear downstream consumer; ingest/correlation is the current MISP requirement.

## 17. API capability and authenticated status endpoints

Keep `/api/health` public-safe and minimal.

Add:

### `GET /api/meta`
Public-safe static capabilities only:

- gateway/schema version
- supported indicator types
- profiles
- provider names and supported types
- whether a provider requires credentials (never whether a particular secret value exists unless already safe by policy)
- API limits

### `GET /api/status`
Bearer-authenticated operational state:

- provider configured booleans
- circuit states
- bounded cache statistics
- parser/provider versions
- runtime uptime/instance-local counters
- no secret values
- no raw prior indicators

All authenticated responses remain `Cache-Control: no-store`.

## 18. Cache architecture

Replace unbounded ad-hoc maps with one small bounded cache primitive.

Requirements:

- max entries
- TTL
- negative TTL
- source-level cache namespace
- request-level in-flight de-duplication
- deterministic eviction (LRU or oldest-access approximation)
- no persistence assumptions
- cache key never contains provider credentials
- event/body exceptions such as MISP event JSON can explicitly opt out
- statistics expose counts only

The design remains safe under Vercel cold starts and multi-instance execution: cache is an optimization, never correctness-critical state.

## 19. Observability and privacy

Introduce a tiny internal telemetry interface with a no-op default.

Emit structured events for:

- request start/end
- provider start/end
- cache hit/miss
- provider failure class
- circuit open/close
- batch budget exhaustion

Default logs avoid raw indicators. They include request ID, indicator type, provider, duration and status. An explicit debug mode may log canonical indicators locally, but must remain off by default in production.

Sentry remains monitoring-only. Existing `SENTRY_AUTH_TOKEN` is not repurposed as a runtime ingestion credential. A future Sentry DSN integration is separate and optional; this pass will not send CTI evidence to Sentry.

## 20. Maltego parity

Every shipping indicator type that maps cleanly to a Maltego entity gets a bounded local transform.

Requirements:

- existing DPAPI bearer storage remains the only local secret
- no provider API key enters Maltego
- ATT&CK Phrase transform retained
- ASN/CIDR transforms added only if entity mapping is stable; otherwise Phrase input with deterministic gateway type is used
- result entity budget remains capped
- relationship/evidence nodes preserve provider provenance
- transform failures surface partial-result messages instead of dropping successful nodes

The MTZ remains generated locally, not committed.

## 21. QA and parser robustness

Expand tests in four layers.

### 21.1 Contract tests

Every provider must prove:

- fixed expected host
- expected HTTP method
- exact credential header/query behavior
- response size bound
- redirect refusal
- sanitized references
- no secret reflection
- supported types match the manifest

### 21.2 Failure/chaos tests

Cover:

- timeout/abort
- HTTP 429 + Retry-After
- 5xx
- malformed JSON/CSV/text
- HTML error bodies
- oversized body with and without Content-Length
- redirect
- partial outage
- cache poisoning attempt
- circuit breaker transitions
- request deadline exhaustion

### 21.3 Deterministic fuzz tests

Using only Node standard library, generate bounded malformed values for:

- domains/IDNA
- URLs
- hashes
- CVEs/ATT&CK IDs/ASNs/CIDRs
- CSV-like feeds
- MISP hash indexes

Fuzz runs use a fixed seed and bounded iteration count so CI is reproducible.

### 21.4 Integration invariants

Tests assert:

- every workflow name resolves to an implemented provider
- every provider is represented in the manifest
- README/provider tables are generated or checked from the same metadata
- no deprecated provider is active
- public source adapters require no credential
- no active fetch target falls outside the centralized egress allowlist

## 22. Release and CI hardening

Keep the existing `Tooling smoke` custom status and finalizer contract.

Add bounded gates:

- manifest parity check
- API schema/version parity check
- egress-host invariant check
- deterministic fuzz test step
- source fixture parser tests
- public-release secret/artifact audit
- Maltego transform discovery parity with supported entity types
- generated release manifest containing commit SHA, gateway version, schema version and provider/parser versions

Actions remain SHA-pinned. Checkout credentials remain non-persistent. No new third-party GitHub Action is introduced unless it is pinned by immutable commit SHA and adds unique value.

## 23. Versioning and compatibility

Introduce constants:

- gateway semantic version
- evidence schema version
- provider parser version already per adapter

`/api/enrich` remains backward compatible for existing required fields. New fields are additive. Breaking response changes require a new schema major version and explicit migration tests.

Unknown request fields may be rejected once request schemas are centralized, but existing documented fields remain accepted.

## 24. Documentation as executable contract

README is reduced to operational documentation and generated/checked provider tables.

Add focused docs:

- `docs/ARCHITECTURE.md`
- `docs/EVIDENCE-SCHEMA.md`
- `docs/PROVIDERS.md`
- `docs/API.md`
- `docs/THREAT-MODEL.md`
- `docs/OPERATIONS.md`

Documentation must distinguish:

- implemented behavior
- optional/configured behavior
- production deployment state
- known coverage gaps

No document may claim a provider, deployment, Windows path or protection setting has been verified without corresponding evidence.

## 25. Threat model additions

Explicitly model:

- leaked gateway bearer
- provider secret compromise
- malicious/compromised upstream returning huge or malformed responses
- redirect-based credential forwarding
- caller attempts to turn gateway into SSRF/proxy
- quota exhaustion
- provider latency amplification
- cache poisoning
- evidence provenance confusion
- stale negative intelligence
- malicious MISP event content
- log/reference leakage of tokenized URLs
- supply-chain compromise of GitHub Actions or runtime dependencies

Controls are mapped to tests where feasible.

## 26. Operational acceptance

Repository acceptance requires all of the following on the exact merge tree:

- all Node tests pass
- all Maltego unit tests pass
- Python compilation passes
- PowerShell parsing passes
- ShellCheck passes
- repository invariants pass
- public-release audit passes
- `Tooling smoke` final status is success
- no unresolved important review finding

After squash merge, exact `main` is independently checked again.

Production acceptance is separate:

- Vercel deployment corresponds to exact verified `main`
- required credential variables are configured without disclosure
- authenticated protected `/api/health` check succeeds
- `/api/meta` and authenticated `/api/status` reflect the expected schema/provider set
- a bounded smoke enrichment exercises at least one public source and one configured credentialed source without exposing secrets

## 27. Explicit non-goals

The following are intentionally excluded from this vNext pass:

- malware sample download or detonation automation
- active scanning or sandbox submission
- generic arbitrary URL fetch/proxy
- caller-provided TAXII/MISP endpoints
- durable paid database/queue provisioning
- autonomous blocking/containment
- opaque ML risk score
- automatic actor attribution
- bulk Internet scanning
- automatic KQL execution against private telemetry
- storing raw client/private indicators in third-party monitoring

These exclusions are features of the security model, not missing implementation.

## 28. Implementation decomposition

The implementation should land as a sequence of independently reviewable PR-sized phases, each using TDD and preserving a green main:

1. core version/manifest/evidence-v2 foundations
2. centralized egress policy and cache primitive
3. bounded scheduler, profiles, deadlines and circuit breaker
4. correlation/freshness/huntability layer
5. MISP/TAXII semantic hardening
6. ASN/CIDR gated indicator expansion
7. bounded batch endpoint
8. STIX 2.1 export
9. meta/status/telemetry endpoints
10. Maltego parity
11. deterministic fuzz/chaos tests and CI invariants
12. executable documentation/threat model/release manifest
13. final repository QA, cleanup and production parity verification

Each phase may be merged only after its exact merge tree is green. If a proposed upstream source or feature cannot satisfy the fixed-host, bounded-response or no-false-negative invariants, it is skipped and recorded as an explicit coverage gap.
