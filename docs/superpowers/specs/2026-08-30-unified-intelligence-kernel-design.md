<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# Unified Intelligence Kernel + Deterministic Value Scheduler

Date: 2026-08-30
Status: Approved design
Scope: Architectural

## Purpose

Increase PARA11AX analyst value from the existing provider set without adding new providers, new egress destinations, an LLM, active interaction, or opaque threat scoring.

The system will improve two things in parallel:

1. Deterministic execution priority for the existing admitted providers so deadline-constrained or partial runs retain the highest intelligence value possible.
2. A reusable deterministic intelligence layer between normalized Evidence v2 and the existing Decision Support / Guidance / report stack so richer conclusions can be derived from the same evidence without mutating or fabricating evidence.

IP enrichment is the reference implementation. Once the IP contract is validated, the same kernel contract will be adopted by domain, URL, hash, CVE, and certificate using observable-specific policy modules.

## Hard Boundaries

The design must preserve all of the following:

- No LLM or generative synthesis layer.
- No new providers.
- No new network destinations.
- No active interaction with enriched infrastructure.
- No provider selection conditioned on previous enrichment results.
- No fabricated relationships, entities, verdicts, timestamps, or threat claims.
- No universal numeric maliciousness or risk score.
- Raw Evidence v2 remains authoritative and immutable.
- Provider failures, timeouts, skips, and unavailable credentials remain coverage state, not negative reputation evidence.
- Identical inputs and policy versions must produce identical scheduler order and identical kernel output.

## Current Architecture and Target Flow

Current high-level flow:

`providers -> Evidence v2 -> correlation -> Decision Support -> Guidance -> report/export`

Target flow:

`deterministic value scheduler -> providers -> Evidence v2 -> correlation -> Intelligence Kernel -> Decision Support -> Guidance -> report/export`

The scheduler and Intelligence Kernel are intentionally separate.

The scheduler answers only: "Which already-admitted provider should be attempted first?"

The Intelligence Kernel answers only: "What deterministic analyst context can be derived from the normalized evidence and explicit relationships already present?"

Neither component creates evidence.

## Architecture

### 1. Intelligence Kernel Boundary

Add a new pure, versioned module under `src/core/`, conceptually `intelligence-kernel.js`, plus observable policy modules under a focused subdirectory such as `src/core/intelligence-policy/`.

Inputs:

- observable `type`;
- canonical subject / indicator;
- normalized Evidence v2 items;
- explicit normalized relationships;
- existing correlation output;
- coverage state;
- injected `now`;
- observable-specific policy module.

The kernel must not:

- perform network access;
- import provider adapters;
- read environment variables;
- mutate Evidence v2;
- infer unstated entities from naming heuristics;
- use system time except through the injected `now` value;
- persist state.

Output is deeply frozen, schema-versioned, and additive.

Initial version: `Intelligence Kernel v1.0`.

Every material derived conclusion must expose at least one of:

- supporting evidence fingerprints;
- explicit relationship identifiers/provider provenance;
- deterministic rule identifiers.

### 2. Kernel Output Contract

The kernel emits categorical, explainable analyst context rather than an opaque score.

#### `evidenceStrength`

Values:

- `none`
- `weak`
- `moderate`
- `strong`

Basis may include:

- source diversity;
- semantic directness;
- freshness;
- independent corroboration;
- contradiction pressure;
- coverage loss.

The emitted object must include machine-readable reasons and supporting evidence fingerprints/provider names where applicable.

#### `sourceDiversity`

Tracks:

- unique providers;
- source roles;
- semantic classes;
- direct threat evidence versus contextual evidence;
- duplicate-capability versus distinct-capability coverage.

This prevents raw provider count from being treated as equivalent to genuinely diverse evidence.

#### `corroboration`

Corroboration must describe:

- the semantic claim being corroborated;
- polarity / finding class;
- participating providers;
- whether those providers represent independent source roles or duplicate capability;
- evidence fingerprints.

Two providers agreeing is not automatically treated as strong corroboration if they represent effectively the same capability or source role.

#### `contradiction`

Contradiction output must include:

- severity;
- affected semantic class;
- positive providers;
- negative providers;
- evidence fingerprints;
- whether the contradiction is disposition-relevant.

Contradictions are preserved and surfaced. The kernel must never silently resolve them.

#### `temporalRelevance`

Tracks:

- first observed;
- last observed;
- active span;
- current / aging / stale / unknown distribution;
- observation-time versus retrieval-time distinction;
- recency gaps where deterministically calculable.

Missing observation timestamps remain `unknown`. Retrieval time must not be promoted into observation time.

#### `relationshipValue`

Explicit relationships are categorized as:

- `direct`;
- `supporting`;
- `contextual`;
- `low_value`.

The classification is observable-policy driven and must retain source/provider provenance.

No relationship may be invented from provider names, host naming conventions, ASN naming, or narrative assumptions.

#### `pivotCandidates`

Bounded pivots may include supported observable types such as:

- IP;
- domain;
- URL;
- hash;
- CVE.

Every pivot must carry:

- target type;
- target value;
- relationship type;
- provider/source;
- evidence fingerprints where available;
- deterministic priority class;
- explicit basis.

The kernel does not execute pivots automatically.

#### `threatContext`

Threat context must distinguish at least:

- direct reputation/threat evidence;
- C2 / botnet / malware distribution evidence;
- scanner/noise activity;
- TOR/proxy context;
- infrastructure/registration/routing context;
- exposure/service context;
- explicit negative reputation evidence;
- unsupported/insufficient states.

This prevents infrastructure richness from being conflated with maliciousness.

#### `huntRelevance`

Tracks:

- direct-search viability;
- applicable telemetry templates;
- supported relationship pivots;
- ATT&CK-linked hypotheses;
- required tables;
- environment validation state;
- evidence fingerprints used to justify hunt suggestions.

The kernel derives hunt relevance, while existing Decision Support remains responsible for final hunt-plan assembly during the first compatibility phase.

#### `coverageImpact`

Coverage impact distinguishes:

- duplicate coverage loss;
- unique semantic capability loss;
- source-role loss;
- material versus non-material coverage degradation.

A provider timeout is not automatically material loss. Loss is material only when the missing source removes uniquely valuable capability under the current observable policy.

#### `analystPriority`

Values:

- `immediate`
- `investigate`
- `monitor`
- `contextual`
- `insufficient`

Priority must include explicit deterministic reasons. It is not a probability and is not a maliciousness score.

#### `limitations`

All uncertainty or degraded-analysis conditions required to prevent overclaiming must be explicit. Initial normalized limitation identifiers include:

- `single_source_threat_support`;
- `contradictory_threat_evidence`;
- `stale_evidence_only`;
- `unknown_observation_time`;
- `infrastructure_only_evidence`;
- `material_coverage_loss`;
- `intelligence_projection_unavailable`.

### 3. IP Reference Policy

IP is the first complete observable policy.

Its policy must explicitly distinguish:

- identity / ASN / ownership;
- registration and routing;
- geographic/network context;
- exposure and services;
- reputation and abuse;
- malware/C2/ransomware evidence;
- TOR/scanner/noise context;
- related infrastructure;
- temporal context;
- ATT&CK/behavior relevance;
- analyst actions and huntability;
- coverage and limitations.

The IP policy must treat cases such as these differently:

Case A:

`multiple independent reputation sources + fresh C2 feed + direct huntability`

Case B:

`multiple infrastructure sources + exposed ports + scanner activity`

Even with similar provider counts, Case A must have materially stronger direct threat context and analyst priority than Case B.

## Deterministic Provider Value Scheduler

### 1. Purpose

Improve partial-result quality under the existing request deadline without changing which providers are admitted.

Existing hard execution controls remain in force:

- provider concurrency max: 4;
- provider attempts max: 2;
- request deadline: 20 seconds;
- workflow call budget remains sufficient for bounded retry across all admitted providers.

The scheduler must not skip a provider because another provider already returned a result.

### 2. Ranking Model

Provider order is derived from a lexicographically ordered categorical priority vector, not a single opaque score.

For a given provider/type pair, compare these dimensions in order:

1. `authorityClass`: `authoritative > first_party > specialist > aggregator > community > contextual`;
2. `semanticUniqueness`: `unique > complementary > duplicative`;
3. `intelligenceValue`: `direct > supporting > contextual`;
4. `pivotValue`: `high > medium > low > none`;
5. `latencyClass`: `fast > normal > slow`;
6. existing `costClass`: `free > quota > scarce`;
7. existing numeric `tier`: lower tier first;
8. original workflow position: lower index first.

The order above is normative. It makes execution order reproducible and makes the first differing dimension the explanation for why provider A precedes provider B.

Profile admission remains unchanged and occurs before value ranking. A `scarce` provider excluded by the selected profile is not re-admitted by scheduler metadata.

### 3. Provider/Type Scheduler Metadata

Scheduler metadata is defined per provider/type pair because the same provider can have different analyst value for IP, domain, hash, or another observable.

The provider manifest should therefore carry a nested declarative structure equivalent to:

`schedulerByType[type] = { authorityClass, semanticUniqueness, intelligenceValue, pivotValue, latencyClass }`

Allowed values are exactly the categorical enums defined in the Ranking Model section.

Existing metadata remains available as supporting policy and fallback context:

- `semanticClassHints`;
- `sourceRole`;
- `costClass`;
- `timeoutMs`;
- `tier`;
- workflow order;
- profile admission rules.

The scheduler must not infer priority from provider names, historical runtime behavior, or previous request results.

### 4. Fallback

If `schedulerByType[type]` is absent, incomplete, or invalid, that provider/type pair falls back deterministically to the current ordering contract:

`tier -> workflow order`

Fallback is local to the malformed/missing provider/type scheduler descriptor. A metadata defect must not prevent an otherwise-admitted provider from executing.

The fallback path must be surfaced in scheduler rationale as `legacy_priority_fallback`.

### 5. Capability Registry Exposure

The capability registry should expose, for each provider/type pair:

- scheduler policy version;
- normalized categorical descriptors;
- resulting order/rank for the applicable workflow/profile when requested by the calling surface;
- whether fallback was used;
- first differing comparator dimension used as the execution-order rationale where meaningful.

This allows the API/WebUI to explain source priority without coupling scheduling to analytical conclusions.

Scheduler policy receives its own version identifier independent from the Intelligence Kernel version.

## Decision Support and Guidance Integration

The Intelligence Kernel is additive during the first rollout phase.

Decision Support will accept kernel output where available and prefer it for richer reasoning, while preserving compatibility fallback behavior for:

- old fixtures;
- old cached envelopes;
- calls that do not yet supply kernel output;
- observable types not yet migrated.

Guidance will project the kernel-backed decision state without converting derived conclusions into evidence.

Existing structures remain available:

- correlation;
- decision;
- guidance;
- evidence graph;
- raw evidence export.

Any kernel conclusion referenced by Decision Support or Guidance must retain traceability to evidence fingerprints, explicit relationships, or deterministic rule identifiers.

## Evidence Graph Relationship

Evidence Graph remains a supporting representation, not the primary reasoning engine in v1.0.

The kernel may consume explicit relationships and may emit ranked pivot context that can be represented in the graph, but the system will not make graph topology the sole basis for analyst disposition.

This keeps single-IOC enrichment understandable while leaving room for stronger graph reasoning in a future version.

## Failure Handling

Failure isolation is mandatory.

If kernel derivation fails:

- valid provider evidence remains successful;
- the enrichment request is not converted into a provider failure;
- Decision Support falls back to its existing deterministic logic where possible;
- the response records the exact limitation `intelligence_projection_unavailable`;
- raw Evidence v2 remains available.

If scheduler metadata evaluation fails:

- provider admission remains unchanged;
- the affected provider/type pair falls back to `tier -> workflow order`;
- execution continues under the existing egress, retry, concurrency, and deadline controls;
- scheduler rationale records `legacy_priority_fallback`.

Provider timeout, credential absence, circuit state, or upstream failure remains coverage information only.

## Versioning and Semantic Change Control

Version separately:

- Intelligence Kernel schema/policy;
- scheduler policy;
- existing Decision Support / Guidance schemas as required.

A semantic change that can alter any of the following requires a version bump and regression fixtures:

- evidence strength;
- analyst priority;
- contradiction severity;
- relationship/pivot ranking;
- coverage materiality;
- Decision Support disposition;
- scheduler ordering.

## Rollout

### Stage 1 — IP Reference Implementation

Implement and validate:

- deterministic value scheduler for IP;
- Intelligence Kernel v1.0;
- IP policy module;
- Decision Support integration;
- Guidance integration;
- IP report integration;
- copy/export parity;
- capability-registry scheduler visibility.

Existing fallback behavior remains operational.

### Stage 2 — Reusable Framework Adoption

After IP validation, migrate in this order:

1. domain;
2. URL;
3. hash;
4. CVE;
5. certificate.

Each observable receives its own policy module and regression corpus.

No observable is considered migrated until tests prove no regression in:

- raw evidence;
- provenance;
- coverage semantics;
- existing export contracts;
- deterministic behavior.

## Testing Strategy

Implementation must follow TDD.

### Scheduler Tests

Required cases:

- deterministic ordering for all profiles;
- exact comparator precedence for every categorical dimension;
- stable ordering for identical metadata;
- provider/type-specific metadata behavior;
- fallback on absent scheduler metadata;
- fallback on incomplete scheduler metadata;
- fallback on invalid scheduler metadata;
- `legacy_priority_fallback` rationale;
- profile admission unchanged;
- no result-conditioned provider suppression;
- retry/concurrency/deadline invariants unchanged;
- capability registry exposes deterministic scheduling rationale.

### Intelligence Kernel Tests

Required cases:

- strong multi-source direct threat support;
- single-source direct threat support;
- explicit negative reputation evidence;
- contradictory reputation evidence;
- C2/feed evidence versus scanner/noise-only evidence;
- infrastructure-only evidence;
- current, aging, stale, mixed, and unknown temporal states;
- source diversity versus duplicate-capability provider count;
- material versus duplicate coverage loss;
- explicit relationship ranking;
- bounded pivot generation;
- malformed/absent relationship handling;
- no guessed pivots;
- fingerprint/provenance/rule-ID traceability;
- deterministic output from identical inputs;
- deep-freeze/immutability guarantees;
- no Evidence v2 mutation.

### Integration Tests

Required cases:

- Decision Support behavior with kernel output;
- Decision Support compatibility without kernel output;
- Guidance compatibility and evidence-reference validation;
- kernel failure isolation;
- exact `intelligence_projection_unavailable` limitation on kernel failure;
- IP report semantic sections;
- copy/export parity;
- raw evidence preservation;
- Evidence Graph compatibility;
- old fixtures/cached-envelope compatibility.

### Regression and Release Verification

Required gates:

- full Node test suite;
- Maltego suite where applicable;
- repository invariants;
- public-release guard;
- shell/PowerShell validation where applicable;
- CodeQL;
- production deployment verification;
- runtime error telemetry review;
- live static asset verification.

Authenticated protected enrichment must only be claimed as verified when an authenticated live request has actually been executed.

## Success Criteria

The design is successful when all of the following are true:

- The same provider set yields stronger analyst conclusions without adding external data sources.
- Deadline-constrained partial runs preferentially contain higher-value evidence.
- Identical input plus identical policy versions produce identical scheduler and kernel outputs.
- No new egress destination or dependency is introduced.
- No opaque numeric maliciousness score is added.
- No evidence or relationship is fabricated.
- Raw Evidence v2 remains authoritative and immutable.
- Provider failure state cannot become negative threat evidence.
- Contradictions remain explicit.
- Missing time remains unknown.
- Every material analyst recommendation is traceable to evidence, explicit relationship data, or a named deterministic rule.
- IP becomes a stable reference implementation suitable for reuse by domain, URL, hash, CVE, and certificate without forcing those observables into IP-specific semantics.

## Non-Goals

This design explicitly does not include:

- new CTI/OSINT providers;
- new network pivots performed automatically;
- LLM-generated analysis;
- active scanning;
- automatic case creation;
- automatic remediation;
- graph-native autonomous investigation;
- runtime-learning provider ranking;
- probabilistic provider reliability scoring;
- replacement of Evidence v2;
- removal of existing raw/correlation/decision/guidance surfaces.

## Implementation Constraint Summary

The implementation must remain deterministic, source-grounded, read-only with respect to external infrastructure, bounded by the existing egress model, backwards compatible during rollout, and test-first.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
