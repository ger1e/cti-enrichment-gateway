### PARA11AX Architecture

#### Purpose

The gateway is a public-source, read-only CTI enrichment service for personal research/lab use. It accepts one bounded indicator or a bounded batch, selects a fixed workflow, queries only predeclared provider destinations, normalizes evidence, correlates compatible observations, and returns provenance-preserving JSON or STIX 2.1.

It is not a scanner, detonation service, arbitrary HTTP proxy, submission service, takedown system, secret broker, autonomous remediation system or automatic blocking engine.

#### Architecture at a glance

![PARA11AX request path](../assets/brand/para11ax-architecture.svg)

The hard external boundary is `safeFetch`: callers cannot choose an arbitrary provider, destination, protocol, method, header or credential. Upstream data remains untrusted until a provider-specific parser converts it into bounded evidence.

#### Request path

```text
Client / Maltego
  -> API auth and request limits (except public /api/para11ax/meta)
  -> strict canonical indicator classifier
  -> fixed workflow + fast|standard|full profile
  -> configured-provider filter
  -> tiered scheduler (max 4 providers concurrently)
  -> central safeFetch fixed-egress boundary
  -> provider parser
  -> bounded cache
  -> Evidence Schema v2 normalization + integrity fingerprint
  -> typed correlation / freshness / evidence quality / huntability
  -> deterministic decision support
  -> Evidence Graph v1.0 + Guidance v1.0 projections on ok/partial results
  -> JSON, bounded batch result, report bundle, or STIX 2.1 bundle
```

Batch enrichment reuses the same classifier, profile selector and single-indicator orchestrator. It adds canonical de-duplication, max-three indicator concurrency, one shared deadline and a global provider-call reservation. There is no second provider-routing implementation.

The browser analyst surface adds a separate local workspace layer after gateway enrichment. Cases, exact typed cross-case sightings, snapshots, semantic diffs and `.para11ax` bundles persist only through browser-local IndexedDB. That layer does not create a server-side IOC history or a second provider/network path.

#### Trust boundaries

##### Caller -> gateway

Bearer authentication protects enrichment, batch, STIX, status and health/operations surfaces as documented by the API contract. Request size, media type and indicator type are bounded before provider execution. Caller input never chooses arbitrary provider hosts, methods, credentials or provider names.

##### Gateway -> provider

`safeFetch` enforces exact fixed hosts, declared HTTPS methods/protocols, redirect refusal and request/response byte ceilings. Provider credentials are read server-side only. A caller cannot turn the gateway into an open proxy.

##### Provider data -> evidence

Every upstream response is untrusted. Parsers fail closed on malformed structures. MISP correlations require exact, non-deleted attribute semantics. Provider failures remain failures and are never transformed into clean/not-listed evidence.

##### Evidence -> analyst/export

Normalization preserves provider, parser version, retrieval time, cache state, duration and a canonical integrity fingerprint. Correlation is typed: scanner activity, Tor-exit status, registration/routing context and ATT&CK knowledge cannot become malware-reputation votes.

Decision support consumes only normalized evidence, typed correlation, coverage state and explicit relationships. It emits an explainable operational disposition, confidence tier, reasons, telemetry requirements, temporal context, ATT&CK mappings, an internal compact `decision.entityGraph`, and bounded hunt templates. It does not add evidence, infer actor attribution from infrastructure proximity, or execute hunts/remediation.

Train 5 adds two distinct top-level projections to normalized `ok`/`partial` responses:

- `evidenceGraph` — canonical Evidence Graph v1.0 with stable deterministic identity, explicit-only facts/relationships and hard bounds.
- `guidance` — Guidance v1.0 that inherits the existing decision/correlation semantics and can explain approved semantic-change categories without recalculating a second disposition or confidence model.

These are not replacements for `decision`. Error envelopes do not manufacture either projection.

Three graph concepts therefore remain intentionally separate:

```text
decision.entityGraph  -> compact decision-support pivots
evidenceGraph         -> canonical response Evidence Graph v1.0
browser case graph    -> local-only case/snapshot/exact-sighting projection
```

##### Browser local workspace

Train 4 case state is local to the analyst browser. IndexedDB is the persistence adapter; active-case state and gateway bearer state remain runtime-only. Case graph/index rebuilds use exact typed values and do not parse free-form notes into entities. Local cases introduce no direct network persistence route.

##### Gateway -> telemetry/status

Operational telemetry is allowlisted and excludes raw indicators by default. Authenticated status is count-only and `Cache-Control: no-store`; it exposes configuration booleans rather than credential values.

#### Scheduling and resilience

- Provider concurrency: maximum 4.
- Single-request deadline: 20 seconds.
- Static per-workflow provider-call ceilings.
- Retry: at most one retry, only for timeout/transport/429/5xx conditions and only inside the remaining request budget.
- Circuit breaker: instance-local and bounded; default opens after three consecutive retryable failures for 60 seconds.
- Cache: bounded LRU/TTL, namespaces and in-flight de-duplication. Only successful observations are cached. Successful semantic negatives use the shorter negative TTL; transport/provider failures are never cached.
- Batch: max 20 inputs, max 3 active indicators and max 200 provider calls globally.
- STIX: max 100 generated objects.
- Evidence Graph v1.0: bounded explicit projection; current implementation caps nodes/edges independently and fails closed rather than silently inventing/truncating semantic claims.
- Generated hunt plan: max 8 entries.

#### Analytical model

There is deliberately no universal maliciousness score. Evidence stays in semantic classes. Corroboration requires compatible independent observations; contradictions stay explicit.

For CVEs, KEV, EPSS and CVSS remain separate axes. Huntability is an operational mapping, not a threat-confidence or attribution score. Actor attribution is emitted only from explicit supporting evidence/relationships.

The decision-support layer is an operational synthesis, not a new evidence source. `hunt_now` means the existing evidence is sufficiently supported/current and directly huntable under the deterministic rules; it does not mean compromise is confirmed. Contradiction, staleness and material coverage loss downgrade confidence. Infrastructure-only observations remain context rather than threat confirmation.

Guidance v1.0 does not create a second scoring or decision engine. It carries the existing bounded disposition vocabulary (`hunt_now`, `investigate`, `monitor`, `context_only`, `insufficient`) and exposes evidence-backed reasons, limitations and semantic-change attention context.

Telemetry readiness is schema-level only. Generated KQL identifies the expected Microsoft Defender XDR/Sentinel tables, but the gateway does not validate tenant ingestion, retention, table availability or client-specific field customization; `environmentValidated` therefore remains false until checked externally.

#### Indicator types

Implemented canonical workflows:

- `ip`
- `domain`
- `url`
- `hash`
- `cve`
- `attack`
- `asn`
- `cidr`
- `certificate`

Certificate classification is explicit: `cert-sha256:<64-hex>`. A bare SHA-256 remains a file hash. The certificate workflow is bounded to contextual certificate metadata sources and does not manufacture a reputation verdict.

ASN/CIDR support is limited to defensible fixed lookups. No TLS/JA3 indicator class is implemented because no current fixed, bounded source satisfied the source gate when v2 was built. ATT&CK relationship expansion is intentionally omitted where it would require an unbounded collection-wide fetch.

#### State labels

- **Implemented:** present in source and covered by repository verification.
- **Configured:** required runtime secret/environment configuration is present.
- **Production-verified:** an exact deployed source SHA has passed the specific authenticated/live checks being claimed.
- **Gap/omitted:** capability intentionally absent because its source, semantics or boundedness did not meet the design gate.

Repository verification is not production acceptance. Public deployment metadata is not proof of credentialed provider readiness. See `OPERATIONS.md`.
