# Decision-Grade Evidence MAX Design

## Goal
Make gateway output decision-grade for analysts by separating threat assessment, evidence quality, infrastructure context, coverage, and limitations without adding providers, infrastructure dependencies, arbitrary scoring weights, or new public endpoints.

## Scope
This is a final hardening layer over the current MAX intelligence enrichment architecture. Existing provider adapters, scheduler, caching, circuit breaking, normalization, Vercel secret handling, endpoint paths, and bounded-output guarantees remain authoritative.

## Non-Goals
- No database, Redis, queue, vector store, graph store, agent loop, or persistent historical state.
- No ML/LLM verdicting.
- No weighted provider-reputation coefficients or global maliciousness score.
- No new providers or client-side vendor credentials.
- No new public endpoint paths.
- No increase to scheduler concurrency above 4 or request deadline above 20 seconds.

## Decision Model
### Evidence quality
`evidenceQuality` continues to answer only: how well-supported is the available normalized evidence set?

It may consider provider diversity, usable evidence count, evidence freshness classes, and contradictions. It must not contain or imply a threat verdict, maliciousness score, or provider trust weight.

### Threat assessment
Add `threatAssessment` to correlation output. It answers only: what do explicit threat/reputation semantic classes support?

Allowed states:
- `supported`: at least two independent threat/reputation providers support the same positive polarity and no opposing threat/reputation evidence exists.
- `contradicted`: positive and negative threat/reputation evidence both exist.
- `negative`: at least one explicit negative/benign reputation observation exists and no positive threat/reputation evidence exists.
- `insufficient`: positive threat/reputation evidence exists but lacks independent corroboration, or no decisive threat/reputation polarity can be established.
- `not_applicable`: the indicator type/workflow has no threat/reputation semantics, such as ATT&CK knowledge-only enrichment.

Infrastructure, passive DNS, routing, registration, internet exposure, scanner activity, Tor context, vulnerability metadata, ransomware claims, and community reports must not by themselves make `threatAssessment` positive.

### Assessment basis
Add bounded `assessmentBasis` under `threatAssessment` containing only provider names and semantic classes that actually contributed to the threat assessment. It must not include raw indicator values, request URLs, response bodies, secret names, or arbitrary provider payload fields.

Maximum provider entries: 25. Provider names and semantic classes are sorted deterministically.

### Limitations
Add a bounded top-level `limitations` array containing deterministic machine-readable strings when relevant. Supported values:
- `single_source_threat_support`
- `contradictory_threat_evidence`
- `stale_evidence_only`
- `unknown_observation_time`
- `partial_provider_failure`
- `material_coverage_loss`
- `infrastructure_only_evidence`

The array is deduplicated, sorted, and capped at 16 values. These strings explain evidentiary limitations; they do not change threat polarity by themselves.

## Coverage
Add a top-level `coverage` object to enrichment output, derived from provider execution metadata rather than correlation evidence.

Fields:
- `selected`: number of providers selected for the resolved workflow/profile.
- `executed`: number that actually executed.
- `succeeded`: number that produced a successful provider result, including semantic negatives.
- `failed`: number that returned explicit provider failure.
- `skipped`: number skipped by missing credential, deadline, circuit breaker, unsupported condition, or profile/cost gate after selection.
- `materialLoss`: boolean.

`materialLoss` is true when either:
- more than 25% of selected providers failed or were skipped after selection, or
- every selected provider from a semantic class represented in the workflow failed/skipped, causing that class to have no successful evidence.

Coverage is operational completeness, not evidence quality and not threat assessment.

## Freshness Semantics
Do not treat a recent API retrieval timestamp as proof that the underlying intelligence observation is recent.

For each evidence item, freshness should prefer explicit observation time in this order when present: `lastSeen`, then `firstSeen`. `retrievedAt` is only a retrieval timestamp and may be used to classify retrieval freshness separately, not observation freshness.

Extend freshness items with:
- `observationClass`: `current`, `aging`, `stale`, or `unknown`.
- `retrievalClass`: `current`, `aging`, `stale`, or `unknown`.

Top-level existing `freshness.overall` becomes observation-oriented. A freshly retrieved record with no first/last-seen timestamp must remain observation freshness `unknown`.

## Infrastructure Context Tightening
`infrastructureContext.corroboratedFacts` may only include explicit infrastructure relationship types:
- `asn`
- `hostname`
- `domain`
- `ip`
- `cidr`
- `netblock`
- `registration`
- `nameserver`
- `mx`
- `certificate`

Arbitrary relationship types such as `uses`, `attributed_to`, `malware`, `campaign`, `actor`, or vendor-specific labels must never enter infrastructure corroboration even if emitted by multiple providers.

A fact requires at least two distinct providers. Results remain sorted and capped at 50.

## Telemetry and Status
Keep default telemetry aggregate-only and indicator-free.

Extend telemetry stats with bounded deterministic provider outcome counters:
- `providerOutcomes[provider].success`
- `providerOutcomes[provider].failure`
- `providerOutcomes[provider].timeout`
- `providerOutcomes[provider].rate_limited`
- `providerOutcomes[provider].skipped`

Counts only. No indicator, URL, header, secret, response body, exception string, or provider raw data may be retained.

Authenticated `/api/status` may expose these aggregate counters automatically through existing telemetry stats. Public `/api/meta` remains static capability metadata and must expose no configuration or runtime state.

## API Compatibility
Preserve all existing endpoints and HTTP methods:
- `/api/enrich`
- `/api/batch`
- `/api/stix`
- `/api/meta`
- `/api/health`
- `/api/status`

Existing response fields remain present. New fields are additive only. Deterministic ordering and current object/relationship caps remain enforced.

## Security Invariants
- `MODAT_API_KEY` and every vendor credential remain server-side Vercel environment variables.
- No vendor credential enters Maltego artifacts.
- All provider egress remains fixed-host/manifest constrained.
- Redirects remain fail-closed.
- Provider error text remains normalized and non-reflective.
- Telemetry remains secret-free and indicator-free by default.
- Health/status expose credential presence booleans or aggregate counts only, never secret values.

## Adversarial Verification
Add tests for:
1. Modat + Shodan + Censys infrastructure agreement with zero threat sources -> `threatAssessment` must not be `supported`.
2. VirusTotal malicious + ThreatFox malicious -> `supported` when no negative reputation evidence exists.
3. Positive and benign reputation evidence -> `contradicted`.
4. One positive threat source only -> `insufficient` plus `single_source_threat_support`.
5. Only stale observation timestamps -> `stale_evidence_only`.
6. Fresh retrieval but missing first/last-seen -> observation freshness `unknown` plus `unknown_observation_time`.
7. Partial provider outage -> coverage counts reflect it and `partial_provider_failure` is emitted.
8. Material semantic-class coverage loss -> `material_coverage_loss`.
9. Duplicate evidence from one provider does not count as independent corroboration.
10. Arbitrary duplicated relationship types do not enter `infrastructureContext.corroboratedFacts`.
11. Telemetry provider outcomes retain counts only and cannot retain an indicator or secret.
12. Existing Modat neutrality, scheduler, manifest, STIX, API-auth, secret-invariant, and cross-platform Maltego tests stay green.

## Release Gate
Before merge:
- targeted correlation/telemetry/coverage tests pass;
- complete Node test suite passes;
- repository invariant and public-release audits pass;
- Linux/macOS/Windows Tooling smoke passes;
- Vercel preview status is success;
- diff review confirms no secret exposure, provider-order drift, unbounded collection, or endpoint break.

After squash merge:
- fresh `main` Tooling smoke must be success;
- Vercel production deployment must be `READY` from the exact merge SHA;
- `/api/meta` returns 200 and remains non-secret;
- unauthenticated `/api/status` returns 401;
- production runtime error clusters remain zero or are explicitly investigated before completion is claimed.
